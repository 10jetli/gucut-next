import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, monthRange } from '@/lib/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)

// GET /api/bills/download?month=2026-06 → ZIP รวมไฟล์แนบทุกบิล + summary.csv
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'ต้องระบุ ?month=YYYY-MM' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    const { after, before } = monthRange(month)
    const zip = new JSZip()

    const rows: string[][] = [['ผู้ให้บริการ', 'วันที่', 'หัวข้ออีเมล', 'ยอดที่พบ', 'ไฟล์แนบ']]
    const missing: string[] = []

    for (const vendor of VENDORS) {
      let bills
      try {
        bills = await searchVendorBills(token, vendor, after, before)
      } catch {
        missing.push(`${vendor.name} (ค้นหาไม่สำเร็จ)`)
        continue
      }
      if (!bills.length) { missing.push(vendor.name); continue }

      const folder = zip.folder(sanitize(vendor.name))!
      for (const b of bills) {
        const dateStr = b.date.slice(0, 10)
        const attNames: string[] = []
        for (const att of b.attachments) {
          try {
            const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
            const name = `${dateStr} ${sanitize(att.filename)}`
            folder.file(name, buf)
            attNames.push(name)
          } catch { attNames.push(`${att.filename} (โหลดไม่สำเร็จ)`) }
        }
        // อีเมลไม่มีไฟล์แนบ → เก็บ snippet ไว้เป็นหลักฐานอ้างอิง
        if (!b.attachments.length) {
          folder.file(`${dateStr} ${sanitize(b.subject)}.txt`,
            `From: ${b.from}\nDate: ${b.date}\nSubject: ${b.subject}\n\n${b.snippet}\n\nยอดที่พบ: ${b.amounts.join(', ') || '-'}\n(อีเมลนี้ไม่มีไฟล์แนบ — เปิดดูฉบับเต็มใน Gmail)`)
        }
        rows.push([vendor.name, dateStr, b.subject, b.amounts.join(' | '), attNames.join(' | ')])
      }
    }

    // summary.csv (BOM เพื่อให้ Excel เปิดภาษาไทยถูก)
    const csv = '﻿' + rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    zip.file('summary.csv', csv)
    if (missing.length) {
      zip.file('ไม่พบบิล.txt', `เดือน ${month} ไม่พบบิลของ:\n- ${missing.join('\n- ')}\n\nกรุณาตามเก็บจากแหล่งอื่น (เช่น gucut@icloud.com / gucut1@gmail.com)`)
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Ads ${month}.zip"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
