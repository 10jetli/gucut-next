import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { VENDORS, getAccessToken, fetchAttachment, fetchMessageDetail, extractAmounts } from '@/lib/gmail'
import { emailToPdf } from '@/lib/emailPdf'
import { loadBillIndexBlobs, listVendorBlobFiles, downloadBlobFile } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)

// GET /api/bills/zip?vendor=tiktok&month=2026-09 -> ZIP ของเดือนนั้น เจ้านั้น
//
// 🔴 สร้างใหม่ 15 ก.ย. 2569 — ปุ่ม "โหลดทั้งเดือน" รอบแรกต่อเข้า /api/bills/download
//    แล้ว **ได้ไม่ตรงกับที่จอโชว์**: กันยายนโชว์ 3 ใบ แต่ ZIP ว่างเปล่า (631 ไบต์)
//    สิงหาคมโชว์ 8 ใบ แต่ ZIP ได้ 11KB (ควรราว 600KB)
//
// 🔑 เหตุ: สองฝั่งหาไฟล์คนละวิธี
//    · จอ  อ่านจาก **ดัชนีที่แคชไว้** (สแกนย้อน 1 ปี แล้วจัดเดือนตามวันที่บนหัวบิล)
//    · ZIP เดิม **ค้น Gmail ใหม่** ในช่วงแคบ (ตั้งแต่วันที่ 1 ของเดือนนั้นไป 3 เดือน)
//      ⇒ บิลที่ "หัวบิลเป็นเดือน M แต่เมลมาถึงก่อนหน้านั้น" ตกหน้าต่างค้นหาไปทั้งใบ
//
// ⇒ ตัวนี้ยึด **ดัชนีเดียวกับที่จอใช้** เป็นแหล่งความจริง ⇒ ได้เท่าที่เห็นเสมอ
//    (กฎ: ปุ่มที่เขียนว่า "โหลดทั้งเดือน" ต้องได้ทุกใบที่ตาเห็นในเดือนนั้น ไม่ใช่ "เท่าที่ค้นเจอรอบนี้")
//
// ⚠️ ไฟล์ที่ดึงไม่ได้ **ห้ามหายเงียบ** — ใส่บันทึกลงซองแทน (ซองนี้เอาไปให้บัญชียื่นภาษี
//    บิลหายหนึ่งใบ = เอกสารภาษีขาดหนึ่งใบ โดยไม่มีใครรู้ว่าขาด)
export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const month = req.nextUrl.searchParams.get('month')

  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: `ไม่รู้จักผู้ให้บริการ: ${vendorId}` }, { status: 400 })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'ต้องระบุ ?month=YYYY-MM' }, { status: 400 })
  }

  try {
    const zip = new JSZip()
    const missing: string[] = []
    let added = 0

    // ── ① ไฟล์ตัวจริงที่อัปโหลดไว้ (…_REAL_…) — มีก่อนใครเสมอ ──
    //    เดือนไหนมีใบจริง จอจะตัดใบที่ระบบสร้างเองออก ⇒ ซองต้องทำแบบเดียวกัน ไม่งั้นได้สองใบซ้อน
    let มีใบจริง = false
    try {
      for (const f of await listVendorBlobFiles(vendor.id)) {
        const m = f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/)
        if (!m || m[1] !== month) continue
        const buf = await downloadBlobFile(f.id)
        if (!buf) { missing.push(`ไฟล์ตัวจริง ${m[2]} (อ่านไม่ได้)`); continue }
        zip.file(sanitize(m[2]), buf)
        added++; มีใบจริง = true
      }
    } catch (e: any) {
      missing.push(`อ่านไฟล์ตัวจริงไม่ได้: ${String(e?.message ?? e)}`)
    }

    // ── ② บิลจากอีเมล ตามดัชนีเดียวกับที่จอใช้ ──
    const idx = await loadBillIndexBlobs(vendor.id)
    const entries = (idx?.entries ?? []).filter(e => e.month === month)

    if (!entries.length && !added) {
      zip.file('ไม่พบบิล.txt',
        `เดือน ${month} ไม่พบบิลของ ${vendor.name} ในรายการที่ระบบเก็บไว้\n\n`
        + `หมายเหตุ: ซองนี้สร้างจาก "รายการเดียวกับที่แสดงบนหน้าจอ"\n`
        + `ถ้าบนจอมีบิลแต่ในซองไม่มี แปลว่าดัชนีกับจอไม่ตรงกัน — แจ้งให้ตรวจด้วย\n`)
    }

    let token: string | null = null
    for (const e of entries) {
      // ถ้าเดือนนี้มีใบจริงแล้ว ให้ข้ามใบที่ระบบสร้างเอง (ให้ตรงกับที่จอแสดง)
      if (มีใบจริง && e.attachmentId === 'GEN') continue
      try {
        token ??= await getAccessToken()
        let buf: Buffer | Uint8Array
        let name = e.filename
        if (e.attachmentId === 'GEN') {
          const detail = await fetchMessageDetail(token, e.messageId)
          buf = await emailToPdf({
            vendorName: vendor.name, subject: detail.subject, from: detail.from,
            date: detail.date, amounts: extractAmounts(`${detail.subject} ${detail.text ?? ''}`),
            body: detail.text, html: detail.html,
          })
          if (!/\.pdf$/i.test(name)) name = name.replace(/\.[^.]+$/, '') + '.pdf'
        } else {
          buf = await fetchAttachment(token, e.messageId, e.attachmentId)
        }
        zip.file(sanitize(name), buf as any)
        added++
      } catch (err: any) {
        const เหตุ = String(err?.message ?? err)
        zip.file(`⚠️ดึงไฟล์ไม่ได้_${sanitize(e.filename || 'ไฟล์แนบ')}.txt`,
          `ดึงบิลใบนี้ไม่สำเร็จ\n`
          + `ผู้ให้บริการ: ${vendor.name}\nเดือน: ${month}\nหัวข้ออีเมล: ${e.subject}\n`
          + `ไฟล์: ${e.filename}\nสาเหตุ: ${เหตุ}\n\n`
          + `⚠️ ซองนี้จึง **ขาดบิลใบนี้** — เปิดใน Gmail แล้วโหลดเอง\n`
          + (/quota|429|403/i.test(เหตุ)
              ? `💡 ดูเหมือนโควตา Gmail ต่อนาทีเต็ม รอสักครู่แล้วกดใหม่ได้เลย\n` : ''))
        missing.push(`${e.filename} (${เหตุ.slice(0, 80)})`)
      }
    }

    // ── ③ สรุปให้คนเปิดซองเห็นว่าได้ครบไหม ──
    zip.file('summary.csv',
      '﻿"ผู้ให้บริการ","เดือน","จำนวนที่ใส่ซองได้","จำนวนที่ขาด"\n'
      + `"${vendor.name}","${month}","${added}","${missing.length}"\n`
      + (missing.length ? '\n"รายการที่ขาด"\n' + missing.map(m => `"${m.replace(/"/g, '""')}"`).join('\n') : ''))

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${vendor.name} ${month}.zip`)}`,
        // บอกจอว่าได้กี่ใบ/ขาดกี่ใบ โดยไม่ต้องแกะซอง
        'X-Bills-Added': String(added),
        'X-Bills-Missing': String(missing.length),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
