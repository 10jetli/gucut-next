import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment } from '@/lib/gmail'
import { pdfBillMonth } from '@/lib/billdate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pad = (n: number) => String(n).padStart(2, '0')

// รับเฉพาะไฟล์บิลจริง: PDF (และ .zip ใบเสร็จของ Omise) — ตัด csv/อื่นๆ ทิ้ง
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)

// GET /api/bills/vendor?vendor=shopify
// สแกนอีเมลของเจ้านั้นย้อนหลัง ~13 เดือน อ่านวันที่บนหัวบิลทุก PDF แล้วจัดกลุ่มตามเดือน
export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: 'ไม่รู้จัก vendor นี้' }, { status: 400 })

  try {
    const token = await getAccessToken()
    const now = new Date()
    const after = `${now.getFullYear() - 1}/${pad(now.getMonth() + 1)}/01`
    const before = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate() + 1)}`
    const bills = await searchVendorBills(token, vendor, after, before)

    // months: { '2026-06': [ {filename, messageId, attachmentId, size, subject} ] }
    const months: Record<string, any[]> = {}
    for (const b of bills) {
      const emailMonth = b.date.slice(0, 7)
      const billFiles = b.attachments.filter(a => isBillFile(a.filename))
      for (const att of billFiles) {
        let m = emailMonth
        if (/\.pdf$/i.test(att.filename)) {
          try {
            const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
            m = (await pdfBillMonth(buf)) ?? emailMonth
          } catch { /* ใช้เดือนอีเมลแทน */ }
        }
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
          filename: '(อีเมลไม่มีไฟล์แนบ — เปิดดูใน Gmail)',
          messageId: b.messageId,
          attachmentId: '',
          size: 0,
          subject: b.subject,
        })
      }
    }

    return NextResponse.json({ vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
