import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { listVendorDriveFiles } from '@/lib/drive'
import { BillEntry } from '@/lib/billcache'
import { listVendorBlobFiles, loadBillIndexBlobs, saveBillIndexBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pad = (n: number) => String(n).padStart(2, '0')

// รับเฉพาะไฟล์บิลจริง: PDF (และ .zip ใบเสร็จของ Omise) — ตัด csv/อื่นๆ ทิ้ง
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)

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
      // ไฟล์จริง: Blobs เป็นหลัก · Drive เป็นตาข่ายช่วงย้าย (ไฟล์เก่าที่ยังไม่ migrate)
      //   dedup ตามชื่อไฟล์ — ตัวที่อยู่ Blobs แล้วชนะ (f.id ของ Blobs เป็น BLOB:<key> อยู่แล้ว)
      const blobFiles: { id: string; name: string; size: number }[] = await listVendorBlobFiles(vendor.id).catch(() => [])
      let driveFiles: { id: string; name: string; size: number }[] = []
      try { driveFiles = (await listVendorDriveFiles(token, vendor.id)).map(f => ({ id: `DRIVE:${f.id}`, name: f.name, size: f.size })) } catch {}
      const seen = new Set(blobFiles.map(f => f.name))
      const allReal = blobFiles.concat(driveFiles.filter(f => !seen.has(f.name)))
      const realByMonth: Record<string, any[]> = {}
      for (const f of allReal) {
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
