import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, monthRange } from '@/lib/gmail'
import { pdfBillMonth } from '@/lib/billdate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)

// GET /api/bills/download?month=2026-06 → ZIP โดยจัดไฟล์ตาม "เดือนบนหัวบิล" (อ่านจากใน PDF)
// - ค้นอีเมลกว้างถึง +3 เดือน เผื่อบิลถูก forward เข้ามาช้า
// - PDF: อ่านวันที่ในไฟล์ → เก็บเฉพาะใบที่เป็นของเดือนที่ขอ
// - ไฟล์อื่น/อ่านวันที่ไม่ได้: ใช้เดือนของอีเมลแทน
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'ต้องระบุ ?month=YYYY-MM' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    const { after } = monthRange(month)
    const [y, mo] = month.split('-').map(Number)
    const end = new Date(Date.UTC(y, mo - 1 + 3, 1))
    const before = `${end.getUTCFullYear()}/${String(end.getUTCMonth() + 1).padStart(2, '0')}/01`
    const zip = new JSZip()

    const rows: string[][] = [['ผู้ให้บริการ', 'วันที่บิล', 'หัวข้ออีเมล', 'ยอดที่พบ', 'ไฟล์แนบ']]
    const missing: string[] = []

    for (const vendor of VENDORS) {
      let bills
      try {
        bills = await searchVendorBills(token, vendor, after, before)
      } catch {
        missing.push(`${vendor.name} (ค้นหาไม่สำเร็จ)`)
        continue
      }
      let added = 0
      for (const b of bills) {
        const emailMonth = b.date.slice(0, 7)
        const attNames: string[] = []
        for (const att of b.attachments) {
          try {
            const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
            let fileMonth: string | null = null
            if (/\.pdf$/i.test(att.filename)) fileMonth = await pdfBillMonth(buf)
            const belongs = fileMonth ? fileMonth === month : emailMonth === month
            if (!belongs) continue
            const name = `${fileMonth ?? emailMonth}_${sanitize(att.filename)}`
            zip.folder(sanitize(vendor.name))!.file(name, buf)
            attNames.push(name)
            added++
          } catch { /* ข้ามไฟล์ที่ดึงไม่ได้ */ }
        }
        // อีเมลไม่มีไฟล์แนบ → เก็บเนื้อหาเป็น .txt (เฉพาะอีเมลของเดือนนี้)
        if (!b.attachments.length && emailMonth === month) {
          zip.folder(sanitize(vendor.name))!.file(
            `${b.date.slice(0, 10)}_${sanitize(b.subject || 'บิล')}.txt`,
            `From: ${b.from}\nSubject: ${b.subject}\nDate: ${b.date}\nยอดที่พบ: ${b.amounts.join(', ') || '-'}\n\n${b.snippet}\n(อีเมลนี้ไม่มีไฟล์แนบ — เปิดดูฉบับเต็มใน Gmail)`,
          )
          attNames.push('(ไม่มีไฟล์แนบ)')
          added++
        }
        if (attNames.length) {
          rows.push([vendor.name, b.date.slice(0, 10), b.subject, b.amounts.join(' | '), attNames.join(' ; ')])
        }
      }
      if (!added) missing.push(vendor.name)
    }

    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    zip.file('summary.csv', csv)
    if (missing.length) {
      zip.file('ไม่พบบิล.txt', `เดือน ${month} ไม่พบบิลจาก:\n- ${missing.join('\n- ')}\n\n(บิลบางเจ้าอาจส่งเข้าอีเมลอื่น เช่น gucut@icloud.com / gucut1@gmail.com — ตั้ง forward มาที่ Gmail หลัก)`)
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Ads ${month}.zip"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
