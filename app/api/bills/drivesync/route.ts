import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { billFilingMonth, billIdentity } from '@/lib/bill-identity'
import { emailToPdf } from '@/lib/emailPdf'
import { syncBillByIdentity, blobFileExists } from '@/lib/billblobs'
/* 🔑 ตัวนับแยกเหตุผลอยู่ที่ lib/bill-tally.ts — `skipped` เป็นผลบวกที่คิดจากสามตัวนั้น
   ⇒ บวกไม่ลงตัวไม่ได้โดยโครงสร้าง (CEO สั่งข้อนี้ตอนอนุมัติงาน 12 ก.ย. 2569) */
import { emptyTally, countExists, countWrongAccount, countPdfUnreadable, countDupBill, countNeedsHumanCheck, countNoWrite, tallyReport } from '@/lib/bill-tally'

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

  const t = emptyTally()
  const errors: string[] = []

  for (const b of bills) {
    const emailMonth = b.date.slice(0, 7)
    const billFiles = b.attachments.filter(a => isBillFile(a.filename))

    if (billFiles.length) {
      for (const att of billFiles) {
        try {
          const filenameByEmail = `${emailMonth}_${b.messageId}_${safeName(att.filename)}`
          // ① ชื่อไฟล์คำนวณได้ครบตั้งแต่ยังไม่โหลด ⇒ ถามถังก่อน ประหยัดคำขอ Gmail ทั้งใบ
          //    ⚠️ ด่านนี้กันได้แค่ "ไฟล์ชื่อเดิมเป๊ะ" — ใบเดียวกันที่มาในชื่อใหม่ต้องให้ด่านตัวตนจับ (ข้างล่าง)
          if (await blobFileExists(vendor.id, filenameByEmail)) { countExists(t); continue }
          t.fetched++
          const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
          /* 🔴 อ่านเนื้อ PDF **ทุกใบ** ไม่ใช่เฉพาะเจ้าที่มี accountId (เปลี่ยน 16 ก.ย. 2569 · ใบ t_mu3g8tq5)
             เพราะเนื้อในใบคือที่เดียวที่บอก **ตัวตนของใบ** กับ **รอบบิล** ได้
             เดิมอ่านเฉพาะเจ้าที่ตั้ง accountId ⇒ เจ้าอย่าง Adobe ไม่เคยถูกอ่านเลย ⇒ กันซ้ำไม่ได้เลย */
          let pdfText = ''
          if (/\.pdf$/i.test(att.filename)) pdfText = (await pdfBillInfo(buf)).text
          if (vendor.accountId && /\.pdf$/i.test(att.filename)) {
            const text = pdfText
            /* 🔴 **แยกแล้ว 14 ก.ย. 2569** — เดิมสองเคสนี้ถูกนับกองเดียวกัน แล้วรอบก่อนเขียนเตือนไว้เองว่า
                  "ห้ามสรุปจาก skippedWrongAccount ว่าเป็นบิลของบัญชีอื่น จนกว่าจะพิสูจน์ว่าอ่าน PDF ออก"
               ⇒ อ่านเนื้อไม่ออกเลย = **เราไม่รู้ว่าเป็นบิลของใคร** ไม่ใช่ "รู้แล้วว่าไม่ใช่ของเรา"
                  ของที่อ่านไม่ออกอาจเป็นบิลจริงของร้านที่กำลังหายไปเงียบ ๆ ทุกวัน
               ⚠️ เกณฑ์ "อ่านไม่ออก" ตั้งไว้หลวม ๆ ที่เนื้อว่างจริง ๆ เท่านั้น
                  ไม่ตั้งเป็นจำนวนตัวอักษรขั้นต่ำ เพราะจะกลายเป็นเลขที่ไม่มีใครอธิบายที่มาได้ */
            const readable = text.trim().length > 0
            if (!readable) {
              countPdfUnreadable(t, { messageId: b.messageId, month: emailMonth, file: att.filename })
              continue
            }
            if (!pdfHasAccountId(text, vendor.accountId)) {
              countWrongAccount(t, { messageId: b.messageId, month: emailMonth, file: att.filename })
              continue
            }
          }
          const mimeType = /\.zip$/i.test(att.filename) ? 'application/zip' : 'application/pdf'
          /* ② จัดแฟ้มตาม **รอบบิลที่พิมพ์ในใบ** ไม่ใช่เดือนของอีเมล
             🔴 ต้นเหตุของ "ใบ มิ.ย. ไปโผล่แฟ้ม ก.ค." — บิลรอบสิ้นเดือนถูกส่งอีเมลต้นเดือนถัดไป
                อ่านรอบบิลไม่ได้ ⇒ ถอยมาใช้เดือนอีเมลเหมือนเดิม (ไม่เดา และไม่ทิ้งของ) */
          const filing = billFilingMonth(pdfText)
          const filenameNow = filing.month && filing.source === 'รอบบิลที่พิมพ์ในใบ'
            ? `${filing.month}_${b.messageId}_${safeName(att.filename)}`
            : filenameByEmail
          /* ③ กันซ้ำด้วย **ตัวตนของใบ** (เลขที่เอกสาร หรือ รอบบิล+ยอดรวม)
             ⚠️ ไฟล์ zip อ่านเนื้อไม่ได้ ⇒ ใช้ "อีเมลฉบับนี้ + ชื่อไฟล์แนบ" เป็นตัวตนแทน
                กันการโหลดซ้ำของอีเมลฉบับเดิมได้จริง · **แต่ยังไม่กันกรณี zip ใบเดียวกันมาสองอีเมล**
                (เขียนไว้ตรง ๆ ดีกว่าติดธง "ต้องให้คนดู" ทุกใบ zip ซึ่งจะกลายเป็นเสียงรบกวน) */
          const ident = billIdentity(pdfText, vendor.id)
          const identKey = ident.key ?? (/\.pdf$/i.test(att.filename) ? null : `${vendor.id}|mail:${b.messageId}|att:${safeName(att.filename)}`)
          const res = await syncBillByIdentity(vendor.id, filenameNow, mimeType, buf, identKey)
          if (res.written) {
            t.uploaded++
            /* ติดธงให้คนดูเฉพาะ **ไฟล์ PDF ที่อ่านตัวตนไม่ได้** — zip ใช้ตัวตนจากอีเมลไปแล้ว */
            if (!identKey) countNeedsHumanCheck(t, { messageId: b.messageId, month: filing.month ?? emailMonth, file: att.filename, why: ident.why ?? 'ไม่รู้เหตุ' })
          } else if (res.reason === 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น') {
            countDupBill(t, { messageId: b.messageId, month: filing.month ?? emailMonth, file: att.filename, sameAs: res.sameAs ?? '(ไม่ทราบชื่อไฟล์เดิม)' })
          } else if (res.reason === 'มีไฟล์ชื่อนี้อยู่แล้ว') {
            countExists(t)
          } else {
            countNoWrite(t)
          }
        } catch (e: any) {
          t.failed++
          errors.push(`${b.messageId}: ${e.message ?? e}`)
        }
      }
    } else {
      try {
        const filenameNow = `${emailMonth}_${b.messageId}_ใบเสร็จ.pdf`
        if (await blobFileExists(vendor.id, filenameNow)) { countExists(t); continue }
        t.fetched++
        const detail = await fetchMessageDetail(token, b.messageId)
        const buf = await emailToPdf({
          vendorName: vendor.name, subject: detail.subject, from: detail.from,
          date: detail.date, amounts: b.amounts ?? [], body: detail.text, html: detail.html,
        })
        /* ใบที่เราสร้างจากอีเมลเอง: ตัวตนของมันคือ "อีเมลฉบับนั้น" ⇒ ใช้ messageId เป็นกุญแจได้ตรง ๆ
           (ไม่ต้องอ่านเนื้อ PDF เพราะเราเป็นคนสร้างไฟล์นี้จากอีเมลฉบับเดียว) */
        const res = await syncBillByIdentity(vendor.id, filenameNow, 'application/pdf', buf, `${vendor.id}|mail:${b.messageId}`)
        if (res.written) t.uploaded++
        else if (res.reason === 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น') {
          countDupBill(t, { messageId: b.messageId, month: emailMonth, file: 'ใบเสร็จจากอีเมล', sameAs: res.sameAs ?? '(ไม่ทราบชื่อไฟล์เดิม)' })
        } else if (res.reason === 'มีไฟล์ชื่อนี้อยู่แล้ว') countExists(t)
        else countNoWrite(t)
      } catch (e: any) {
        t.failed++
        errors.push(`${b.messageId}: ${e.message ?? e}`)
      }
    }
  }

  return { vendor: vendor.id, name: vendor.name, windowDays: days, total: bills.length, ...tallyReport(t), errors: errors.slice(0, 5) }
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
