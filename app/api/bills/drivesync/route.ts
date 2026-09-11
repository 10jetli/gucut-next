import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { emailToPdf } from '@/lib/emailPdf'
import { syncBillToBlobs, blobFileExists } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ⚠️ เพดานที่ทำให้ตัวเก็บบิลตายทุกวัน (วัดจริง 12 ก.ย. 2569 ด้วยการยิง 12 เจ้าพร้อมกันด้วยมือ)
//   403 "Quota exceeded for quota metric 'Total Query Cost' and limit
//        'Units per minute per user' of service 'gmail.googleapis.com'"
//   ⇒ เพดานเป็น **ต่อนาที** และคิดเป็น "หน่วยต้นทุน" ไม่ใช่จำนวนคำขอ
//   ⇒ การหน่วงให้ห่างกันในช่วง 26 วินาทีของ Netlify **ไม่ช่วยเลย** ต้องลดจำนวนคำขอจริง ๆ
// สองอย่างที่ลดคำขอ (ห้ามถอด ไม่งั้นกลับไปตายเหมือนเดิม):
//   ① เช็คว่ามีไฟล์ใน Blobs แล้วหรือยัง **ก่อน** โหลดไฟล์แนบ — ของเดิมโหลดมาทั้งก้อน
//      แล้วค่อยรู้ว่ามีอยู่แล้ว (syncBillToBlobs เช็คทีหลัง) ⇒ จ่ายค่าโหลดซ้ำทุกวัน
//   ② ช่วงวันที่แคบสำหรับงานรายวัน (?days=) — ของเดิมค้นย้อนหลัง 1 ปีทุกเช้า
//      ⇒ ดึงรายละเอียดเมล 25 ฉบับ + ไฟล์แนบทั้งปี ซ้ำทุกวันทั้ง 12 เจ้า

const pad = (n: number) => String(n).padStart(2, '0')
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_')

async function syncVendor(vendor: (typeof VENDORS)[number], days: number) {
  const token = await getAccessToken()
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  const after = `${from.getFullYear()}/${pad(from.getMonth() + 1)}/${pad(from.getDate())}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const before = `${tomorrow.getFullYear()}/${pad(tomorrow.getMonth() + 1)}/${pad(tomorrow.getDate())}`
  const bills = await searchVendorBills(token, vendor, after, before)

  let uploaded = 0, skipped = 0, failed = 0
  let alreadyHave = 0, fetched = 0   // ① มีอยู่แล้วกี่ใบ (ไม่ยิง Gmail) · โหลดจริงกี่ใบ
  const errors: string[] = []

  for (const b of bills) {
    const emailMonth = b.date.slice(0, 7)
    const billFiles = b.attachments.filter(a => isBillFile(a.filename))

    if (billFiles.length) {
      for (const att of billFiles) {
        try {
          const filenameNow = `${emailMonth}_${b.messageId}_${safeName(att.filename)}`
          // ① ชื่อไฟล์คำนวณได้ครบตั้งแต่ยังไม่โหลด ⇒ ถามถังก่อน ประหยัดคำขอ Gmail ทั้งใบ
          if (await blobFileExists(vendor.id, filenameNow)) { alreadyHave++; skipped++; continue }
          fetched++
          const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
          if (vendor.accountId && /\.pdf$/i.test(att.filename)) {
            const { text } = await pdfBillInfo(buf)
            if (!pdfHasAccountId(text, vendor.accountId)) { skipped++; continue }
          }
          const mimeType = /\.zip$/i.test(att.filename) ? 'application/zip' : 'application/pdf'
          const didUpload = await syncBillToBlobs(vendor.id, filenameNow, mimeType, buf)
          didUpload ? uploaded++ : skipped++
        } catch (e: any) {
          failed++
          errors.push(`${b.messageId}: ${e.message ?? e}`)
        }
      }
    } else {
      try {
        const filenameNow = `${emailMonth}_${b.messageId}_ใบเสร็จ.pdf`
        if (await blobFileExists(vendor.id, filenameNow)) { alreadyHave++; skipped++; continue }
        fetched++
        const detail = await fetchMessageDetail(token, b.messageId)
        const buf = await emailToPdf({
          vendorName: vendor.name, subject: detail.subject, from: detail.from,
          date: detail.date, amounts: [], body: detail.text, html: detail.html,
        })
        const didUpload = await syncBillToBlobs(vendor.id, filenameNow, 'application/pdf', buf)
        didUpload ? uploaded++ : skipped++
      } catch (e: any) {
        failed++
        errors.push(`${b.messageId}: ${e.message ?? e}`)
      }
    }
  }

  return { vendor: vendor.id, name: vendor.name, windowDays: days, total: bills.length, uploaded, skipped, alreadyHave, fetched, failed, errors: errors.slice(0, 5) }
}

async function handle(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const key = req.nextUrl.searchParams.get('secret')
  const required = process.env.DRIVESYNC_SECRET
  if (required && key !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: 'ไม่รู้จัก vendor นี้ (ใส่ ?vendor=<id>)' }, { status: 400 })
  // ②  ?days=N — งานรายวันส่งค่าแคบมาเอง · เรียกมือเปล่าได้ช่วงกว้างเหมือนเดิม (1 ปี)
  const daysRaw = Number(req.nextUrl.searchParams.get('days'))
  const days = Number.isFinite(daysRaw) && daysRaw >= 1 && daysRaw <= 1000 ? Math.floor(daysRaw) : 365
  try {
    const result = await syncVendor(vendor, days)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
