import JSZip from 'jszip'
import { VENDORS, getAccessToken, fetchAttachment, fetchMessageDetail, extractAmounts } from '@/lib/gmail'
import { emailToPdf } from '@/lib/emailPdf'
import { loadBillIndexBlobs, listVendorBlobFiles, loadRealPeriods, downloadBlobFile } from '@/lib/billblobs'
import { filingMonthOf } from '@/lib/bill-filing'

// สร้างซอง ZIP ของบิลเดือนหนึ่ง เจ้าหนึ่ง — **ที่เดียว** ใช้ทั้ง
//   · /api/bills/zip      (หน้าเว็บ · ต้องล็อกอิน)
//   · /api/bills/fetchzip (g1 · ใช้รหัส DRIVESYNC_SECRET)
//
// 🔑 แยกมาไว้ที่เดียวเพราะถ้าเขียนสองที่ ตัวเลขกับกติกาคัดซ้ำจะเพี้ยนกันภายในไม่กี่วัน
//    (เคยเกิดแล้ววันนี้กับตรรกะนับบิล — รายงานได้ 9 ทั้งที่จอโชว์ 4)

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)

const เลขที่ใบ = (n: string) =>
  (n.match(/(THTT\d{6,}|FBADS-[\d-]{6,}|IN-\d{6,}|INV[-_]?\d{6,})/i)?.[1] ?? '').toUpperCase()

export interface ผลสร้างซอง {
  ok: boolean
  error?: string
  buf?: Buffer
  ชื่อไฟล์?: string
  ได้: number
  ขาด: number
}

export async function สร้างซองบิล(vendorId: string | null, month: string | null): Promise<ผลสร้างซอง> {
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return { ok: false, error: `ไม่รู้จักผู้ให้บริการ: ${vendorId}`, ได้: 0, ขาด: 0 }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, error: 'ต้องระบุ month=YYYY-MM', ได้: 0, ขาด: 0 }
  }

  const zip = new JSZip()
  const missing: string[] = []
  let added = 0

  // ── ① ไฟล์ตัวจริงที่อัปไว้ (…_REAL_…) มาก่อนเสมอ ──
  let มีใบจริง = false
  const รายชื่อใบจริง: string[] = []
  try {
    /* 🔴 15 ก.ย. 2569 — ตัวคัดซ้ำรอบแรกเทียบแค่ "ใบจริง vs บิลจากเมล"
       **ไม่เคยเทียบใบจริงด้วยกันเอง** ⇒ TikTok ส.ค. ยังได้ 8 ใบทั้งที่มี 4
       เหตุ: ใบเดียวกันถูกอัปเป็น "ใบจริง" สองครั้งคนละชื่อ
             THTT202606634060-บริษัท ศีตกาล เทรดดิ้ง จำกัด-Invoice.pdf   (ตัวเก็บบน g1)
             TikTok-Invoice-THTT202606634060.pdf                        (ไฟล์แนบในเมล)
       🔑 จับได้เพราะยิงของจริงแล้วเลขไม่ตรงกับที่ควรเป็น — ไม่ใช่จากการอ่านโค้ด
       ⚠️ เก็บไฟล์ในถังไว้ทั้งคู่ **ไม่ลบ** (ของภาษี) — คัดที่ชั้นแสดงผลเท่านั้น */
    /* 🔴 **เดือนของไฟล์มาจากรอบบิลในเอกสาร ไม่ใช่ชื่อไฟล์** (ท่านประธานสั่ง 18 ก.ย. 2569)
       ⚠️ ข้อนี้สำคัญเป็นพิเศษกับ zip เพราะไฟล์ที่ดาวน์โหลดไปคือของที่เอาไปส่งบัญชีจริง
          ถ้าจอจัดใบนี้ไว้ มิ.ย. แต่ zip ของ มิ.ย. ไม่มีมันอยู่ข้างใน = คนละกติกาสองที่
       อ่านจากแคชรอบบิลเท่านั้น ไม่แกะ PDF ที่นี่ (หน้ารายเจ้าเป็นคนเติมแคชให้) */
    const รอบบิลแคช = await loadRealPeriods(vendor.id).catch(() => ({} as Record<string, string | null>))
    const ทั้งหมด = (await listVendorBlobFiles(vendor.id))
      .map(f => ({ f, m: f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/) }))
      .filter(x => x.m && (filingMonthOf(x.f.name, (รอบบิลแคช as Record<string, string | null>)[x.f.name]).month ?? x.m[1]) === month)
      .sort((a, b) => a.m![2].localeCompare(b.m![2]))
    const ใบจริงคัดแล้ว = new Map<string, typeof ทั้งหมด[number]>()
    const ใบจริงไม่มีเลข: typeof ทั้งหมด = []
    for (const x of ทั้งหมด) {
      const no = เลขที่ใบ(x.m![2])
      if (!no) { ใบจริงไม่มีเลข.push(x); continue }
      if (!ใบจริงคัดแล้ว.has(no)) ใบจริงคัดแล้ว.set(no, x)
    }
    for (const { f, m } of [...Array.from(ใบจริงคัดแล้ว.values()), ...ใบจริงไม่มีเลข]) {
      if (!m) continue
      // ⚠️ id ที่ list คืนมาเป็นรูป `BLOB:<key>` — ต้องถอดคำนำหน้าก่อน ไม่งั้นอ่านไม่ได้ทุกใบ
      const buf = await downloadBlobFile(f.id.replace(/^BLOB:/, ''))
      if (!buf) { missing.push(`ไฟล์ตัวจริง ${m[2]} (อ่านไม่ได้)`); continue }
      zip.file(sanitize(m[2]), buf)
      รายชื่อใบจริง.push(m[2])
      added++; มีใบจริง = true
    }
  } catch (e: any) {
    missing.push(`อ่านไฟล์ตัวจริงไม่ได้: ${String(e?.message ?? e)}`)
  }

  // ── ② บิลจากอีเมล ตามดัชนีเดียวกับที่จอใช้ ──
  const idx = await loadBillIndexBlobs(vendor.id)
  const เห็นแล้ว = new Set(รายชื่อใบจริง.map(เลขที่ใบ).filter(Boolean))
  const entries = (idx?.entries ?? []).filter(e => {
    if (e.month !== month) return false
    if (มีใบจริง && e.attachmentId === 'GEN') return false    // เดือนที่มีใบจริง ตัด GEN ทิ้ง
    const no = เลขที่ใบ(e.filename)
    if (!no) return true
    if (เห็นแล้ว.has(no)) return false
    เห็นแล้ว.add(no)
    return true
  })

  if (!entries.length && !added) {
    zip.file('ไม่พบบิล.txt',
      `เดือน ${month} ไม่พบบิลของ ${vendor.name} ในรายการที่ระบบเก็บไว้\n\n`
      + `ซองนี้สร้างจาก "รายการเดียวกับที่แสดงบนหน้าจอ"\n`
      + `ถ้าบนจอมีบิลแต่ในซองไม่มี แปลว่าดัชนีกับจอไม่ตรงกัน — แจ้งให้ตรวจด้วย\n`)
  }

  let token: string | null = null
  for (const e of entries) {
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
      // ⚠️ ไฟล์ที่ดึงไม่ได้ **ห้ามหายเงียบ** — ซองนี้เอาไปให้บัญชียื่นภาษี
      zip.file(`⚠️ดึงไฟล์ไม่ได้_${sanitize(e.filename || 'ไฟล์แนบ')}.txt`,
        `ดึงบิลใบนี้ไม่สำเร็จ\nผู้ให้บริการ: ${vendor.name}\nเดือน: ${month}\n`
        + `หัวข้ออีเมล: ${e.subject}\nไฟล์: ${e.filename}\nสาเหตุ: ${เหตุ}\n\n`
        + `⚠️ ซองนี้จึง **ขาดบิลใบนี้** — เปิดใน Gmail แล้วโหลดเอง\n`
        + (/quota|429|403/i.test(เหตุ) ? `💡 ดูเหมือนโควตา Gmail ต่อนาทีเต็ม รอสักครู่แล้วลองใหม่\n` : ''))
      missing.push(`${e.filename} (${เหตุ.slice(0, 80)})`)
    }
  }

  zip.file('summary.csv',
    '﻿"ผู้ให้บริการ","เดือน","จำนวนที่ใส่ซองได้","จำนวนที่ขาด"\n'
    + `"${vendor.name}","${month}","${added}","${missing.length}"\n`
    + (missing.length ? '\n"รายการที่ขาด"\n' + missing.map(m => `"${m.replace(/"/g, '""')}"`).join('\n') : ''))

  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  return { ok: true, buf, ชื่อไฟล์: `${vendor.name} ${month}.zip`, ได้: added, ขาด: missing.length }
}
