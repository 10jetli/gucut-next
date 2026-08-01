import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { listVendorDriveFiles } from '@/lib/drive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pad = (n: number) => String(n).padStart(2, '0')

// รับเฉพาะไฟล์บิลจริง: PDF (และ .zip ใบเสร็จของ Omise) — ตัด csv/อื่นๆ ทิ้ง
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)

// GET /api/bills/vendor?vendor=shopify
// สแกนอีเมลของเจ้านั้นย้อนหลัง ~13 เดือน อ่านวันที่บนหัวบิลทุก PDF แล้วจัดกลุ่มตามเดือน
// เติม &debug=1 เพื่อดูรายละเอียดการอ่านแต่ละไฟล์ PDF (ใช้ตอนแก้บั๊ก)
export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: 'ไม่รู้จัก vendor นี้' }, { status: 400 })

  try {
    const token = await getAccessToken()
    const now = new Date()
    const after = `${now.getFullYear() - 1}/${pad(now.getMonth() + 1)}/01`
    const before = (() => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}` })()
      const bills = await searchVendorBills(token, vendor, after, before)

    const months: Record<string, any[]> = {}
    const debugInfo: any[] = []
    for (const b of bills) {
      const emailMonth = b.date.slice(0, 7)
      const billFiles = b.attachments.filter(a => isBillFile(a.filename))
      for (const att of billFiles) {
        let m = emailMonth
        let skip = false
        let parseErr = ''
        let textLen = 0
        let textSnippet = ''
        let matched: boolean | null = null
        if (/\.pdf$/i.test(att.filename)) {
          try {
            const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
            const { month: pdfMonth, text } = await pdfBillInfo(buf)
            textLen = text.length
            textSnippet = text.slice(0, 1800)
            if (vendor.accountId) {
              matched = pdfHasAccountId(text, vendor.accountId)
              if (!matched) skip = true
            }
            m = pdfMonth ?? emailMonth
          } catch (e: any) { parseErr = e.message ?? String(e) }
        }
        if (debug) {
          debugInfo.push({ subject: b.subject, filename: att.filename, month: m, skip, parseErr, textLen, textSnippet, matched })
        }
        if (skip) continue
        ;(months[m] ??= []).push({
          filename: att.filename,
          messageId: b.messageId,
          attachmentId: att.attachmentId,
          size: att.size,
          subject: b.subject,
        })
      }
      if (!b.attachments.length) {
        ;(months[emailMonth] ??= []).push({
          filename: 'ใบเสร็จ.pdf',
          messageId: b.messageId,
          attachmentId: 'GEN',
          size: 0,
          subject: b.subject,
        })
      }
    }

    // ── รวมไฟล์บิล "ตัวจริง" ที่อัปโหลดไว้ใน Google Drive (ผ่าน /api/bills/upload) ──
    // ชื่อไฟล์รูปแบบ YYYY-MM_REAL_<ชื่อ>.pdf — ถ้าเดือนไหนมีไฟล์ตัวจริง ให้ตัด PDF
    // ที่สร้างจากอีเมล (GEN) ของเดือนนั้นทิ้ง เหลือแต่ตัวจริง
    try {
      const driveFiles = await listVendorDriveFiles(token, vendor.id)
      const realByMonth: Record<string, any[]> = {}
      for (const f of driveFiles) {
        const m = f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/)
        if (!m) continue
        ;(realByMonth[m[1]] ??= []).push({
          filename: m[2],
          messageId: '',
          attachmentId: `DRIVE:${f.id}`,
          size: f.size,
          subject: `ไฟล์ตัวจริงจาก ${vendor.name}`,
        })
      }
      for (const [m, files] of Object.entries(realByMonth)) {
        const existing = (months[m] ?? []).filter(x => x.attachmentId !== 'GEN')
        months[m] = [...files, ...existing]
      }
    } catch { /* ถ้าอ่าน Drive ไม่ได้ ให้แสดงเฉพาะบิลจากอีเมลตามปกติ */ }

    return NextResponse.json({ vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months, ...(debug ? { debugInfo } : {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
