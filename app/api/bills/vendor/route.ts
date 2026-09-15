import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { BillEntry, listVendorBlobFiles, loadBillIndexBlobs, saveBillIndexBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pad = (n: number) => String(n).padStart(2, '0')

// รับเฉพาะไฟล์บิลจริง: PDF (และ .zip ใบเสร็จของ Omise) — ตัด csv/อื่นๆ ทิ้ง
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)


/* 🔴 เพิ่ม 15 ก.ย. 2569 — ท่านประธานเจอ "Gmail API error 403 quota exceeded" เต็มจอที่ /bills/shopify
   เหตุ: เปิดหน้าบิลทีไร **ยิง Gmail ทุกครั้ง** (แคชแค่ย่นช่วงวันที่ ไม่ได้ข้ามการยิง)
        เปิดหลายเจ้าติด ๆ กัน = ชนเพดาน "units per minute per user"
   🔑 ที่แย่กว่าคือ catch เดิมคืน 500 ทิ้งแคชทั้งก้อน ⇒ **ข้อมูลอยู่ในมือแต่จอไม่โชว์อะไรเลย**
      = เอา "ดึงไม่สำเร็จ" ไปแสดงเป็น "ไม่มีข้อมูล" (three-states-not-two)
   ⇒ ตอนนี้: Gmail ล้ม + มีแคช ⇒ โชว์ของเก่าพร้อมบอกตรง ๆ ว่ายังไม่ได้สแกนใหม่เพราะอะไร
   ⚠️ ไม่มีแคชเลย ⇒ ยังต้องคืน error เหมือนเดิม ห้ามแกล้งขึ้นเขียวว่า "ไม่มีบิล" */
function monthsFromEntries(entries: BillEntry[]) {
  const months: Record<string, any[]> = {}
  for (const e of entries) {
    ;(months[e.month] ??= []).push({
      filename: e.filename, messageId: e.messageId, attachmentId: e.attachmentId,
      size: e.size, subject: e.subject,
    })
  }
  return months
}

/* ไฟล์ตัวจริงที่อัปโหลดไว้ (…_REAL_…) — **แทนที่** ใบที่ระบบสร้างจากอีเมล (GEN) ของเดือนนั้น
   จึงไม่มีทางเห็นสองใบซ้อนกันในเดือนเดียว */
async function attachRealFiles(months: Record<string, any[]>, vendorId: string, vendorName: string) {
  try {
    const blobFiles = await listVendorBlobFiles(vendorId)
    const realByMonth: Record<string, any[]> = {}
    for (const f of blobFiles) {
      const m = f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/)
      if (!m) continue
      ;(realByMonth[m[1]] ??= []).push({
        filename: m[2], messageId: '', attachmentId: f.id, size: f.size,
        subject: `ไฟล์ตัวจริงจาก ${vendorName}`,
      })
    }
    for (const [m, files] of Object.entries(realByMonth)) {
      const existing = (months[m] ?? []).filter(x => x.attachmentId !== 'GEN')
      months[m] = files.concat(existing)
    }
  } catch { /* อ่านที่เก็บไฟล์ไม่ได้ ⇒ แสดงเฉพาะบิลจากอีเมลตามปกติ */ }
  return months
}

// GET /api/bills/vendor?vendor=shopify
// ใช้ cache ผลสแกน (เก็บใน Drive) — สแกน Gmail + อ่าน PDF เฉพาะอีเมลใหม่เท่านั้น
// เติม &rescan=1 เพื่อบังคับสแกนใหม่ทั้งหมด, &debug=1 เพื่อดูรายละเอียดการอ่าน PDF
export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const rescan = req.nextUrl.searchParams.get('rescan') === '1'
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: 'ไม่รู้จัก vendor นี้' }, { status: 400 })

  try {
    const token = await getAccessToken()
    const now = new Date()

    // ── โหลด cache (ถ้ามี) แล้วสแกนเพิ่มเฉพาะช่วงหลังการสแกนล่าสุด (เผื่อย้อน 3 วัน) ──
    const idx = rescan ? null : await loadBillIndexBlobs(vendor.id)
    let after: string
    if (idx) {
      const d = new Date(idx.lastScan)
      d.setDate(d.getDate() - 3)
      after = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    } else {
      after = `${now.getFullYear() - 1}/${pad(now.getMonth() + 1)}/01`
    }
    const before = (() => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}` })()
    const bills = await searchVendorBills(token, vendor, after, before)

    const done = new Set(idx?.done ?? [])
    const entries: BillEntry[] = idx ? idx.entries.slice() : []
    const debugInfo: any[] = []
    let changed = false

    for (const b of bills) {
      if (done.has(b.messageId)) continue
      done.add(b.messageId)
      changed = true
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
        entries.push({
          month: m,
          filename: att.filename,
          messageId: b.messageId,
          attachmentId: att.attachmentId,
          size: att.size,
          subject: b.subject,
        })
      }
      if (!b.attachments.length) {
                let genSkip = false
                if (vendor.accountId) {
                            try {
                                          const detail = await fetchMessageDetail(token, b.messageId)
                                          const combined = (detail.text || '') + ' ' + (detail.html || '')
                                          if (!pdfHasAccountId(combined, vendor.accountId)) genSkip = true
                            } catch {}
                }
        if (!genSkip) entries.push({
          month: emailMonth,
          filename: 'ใบเสร็จ.pdf',
          messageId: b.messageId,
          attachmentId: 'GEN',
          size: 0,
          subject: b.subject,
        })
      }
    }

    // บันทึก cache เมื่อมีของใหม่ (หรือยังไม่เคยมี cache) — ถ้าบันทึกพลาดก็ไม่เป็นไร รอบหน้าสแกนใหม่
    if (changed || !idx) {
      try { await saveBillIndexBlobs(vendor.id, { lastScan: now.toISOString(), done: Array.from(done), entries }) } catch {}
    }

    // ── จัดกลุ่มเป็นรายเดือน (ตัดเดือนที่เก่ากว่า ~13 เดือนทิ้ง) ──
    const cutoff = `${now.getFullYear() - 1}-${pad(now.getMonth() + 1)}`
    const months: Record<string, any[]> = {}
    for (const e of entries) {
      if (e.month < cutoff) continue
      ;(months[e.month] ??= []).push({
        filename: e.filename,
        messageId: e.messageId,
        attachmentId: e.attachmentId,
        size: e.size,
        subject: e.subject,
      })
    }

    // ── รวมไฟล์บิล "ตัวจริง" ที่อัปโหลดไว้ใน Google Drive (ผ่าน /api/bills/upload) ──
    // ชื่อไฟล์รูปแบบ YYYY-MM_REAL_<ชื่อ>.pdf — ถ้าเดือนไหนมีไฟล์ตัวจริง ให้ตัด PDF
    // ที่สร้างจากอีเมล (GEN) ของเดือนนั้นทิ้ง เหลือแต่ตัวจริง
    try {
      // ไฟล์จริงที่อัปโหลดไว้ (…_REAL_…) — เก็บบน Netlify Blobs
      const blobFiles = await listVendorBlobFiles(vendor.id)
      const realByMonth: Record<string, any[]> = {}
      for (const f of blobFiles) {
        const m = f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/)
        if (!m) continue
        ;(realByMonth[m[1]] ??= []).push({
          filename: m[2],
          messageId: '',
          attachmentId: f.id,
          size: f.size,
          subject: `ไฟล์ตัวจริงจาก ${vendor.name}`,
        })
      }
      for (const [m, files] of Object.entries(realByMonth)) {
        const existing = (months[m] ?? []).filter(x => x.attachmentId !== 'GEN')
        months[m] = files.concat(existing)
      }
    } catch { /* ถ้าอ่าน Drive ไม่ได้ ให้แสดงเฉพาะบิลจากอีเมลตามปกติ */ }

    return NextResponse.json({
      vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months,
      cached: !!idx, newMessages: changed,
      ...(debug ? { debugInfo } : {}),
    })
  } catch (e: any) {
    const เหตุ = String(e?.message ?? e)
    // ถอยไปใช้ของที่เคยเก็บไว้ — ดีกว่าจอว่างเปล่าพร้อม error ที่คนอ่านไม่รู้จะทำอะไรต่อ
    try {
      const idx = await loadBillIndexBlobs(vendor.id)
      if (idx?.entries?.length) {
        const months = await attachRealFiles(monthsFromEntries(idx.entries), vendor.id, vendor.name)
        return NextResponse.json({
          vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months,
          cached: true, newMessages: false,
          // 🔑 ฟิลด์นี้มีความหมายเดียว: "ยังไม่ได้สแกนใหม่ เพราะ…" — ห้ามเอาไปตัดสินใจอย่างอื่น
          staleReason: เหตุ,
          lastScan: idx.lastScan,
        })
      }
    } catch { /* อ่านแคชไม่ได้อีก ⇒ ตกไปที่ error ข้างล่างตามเดิม */ }
    return NextResponse.json({ error: เหตุ }, { status: 500 })
  }
}
