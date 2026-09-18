import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { billFilingMonth, billIdentity } from '@/lib/bill-identity'
import { คัดซ้ำพร้อมรายงาน, เลขที่ใบ, type ไฟล์ซ้ำ } from '@/lib/bill-dedupe'
import {
  BillEntry, listVendorBlobFiles, loadBillIndexBlobs, saveBillIndexBlobs,
  downloadBlobFile, loadRealPeriods, saveRealPeriods,
} from '@/lib/billblobs'
import { filingMonthOf, filingNote, splitRealName } from '@/lib/bill-filing'

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
    /* ⚠️ ต้องส่ง invoiceNo ต่อไปด้วย ไม่งั้น `คัดซ้ำ()` จะไม่เห็นเลขที่อ่านจากเอกสาร
       (16 ก.ย. 2569 — จุดที่ทำให้ของ Adobe ซ้ำ คือเลขไม่เคยเดินทางมาถึงตัวคัดซ้ำ) */
    ;(months[e.month] ??= []).push({
      filename: e.filename, messageId: e.messageId, attachmentId: e.attachmentId,
      size: e.size, subject: e.subject, invoiceNo: e.invoiceNo ?? null,
    })
  }
  return months
}

/* ไฟล์ตัวจริงที่อัปโหลดไว้ (…_REAL_…) — **แทนที่** ใบที่ระบบสร้างจากอีเมล (GEN) ของเดือนนั้น
   จึงไม่มีทางเห็นสองใบซ้อนกันในเดือนเดียว

   🔴 **เดือนที่ใช้จัด มาจากรอบบิลในเอกสาร ไม่ใช่คำนำหน้าชื่อไฟล์** (ท่านประธานสั่ง 18 ก.ย. 2569)
      ของเดิมที่นี่อ่านเดือนจาก `^(\d{4}-\d{2})_REAL_` ⇒ ใบ Adobe ของ มิ.ย. ที่ชื่อไฟล์ขึ้นต้น 2026-07
      ไปนอนอยู่ในแฟ้ม ก.ค. · ตัวอ่านเอกสารรู้ว่าเป็น 06 มาตลอด **แต่ไม่มีใครถามมัน**
      ⇒ ดูเหตุผลเต็มและกติกาที่ห้ามละเมิดใน lib/bill-filing.ts
   ⚠️ **ไม่แตะชื่อไฟล์ในถังเลย** — ชื่อไฟล์เป็นกุญแจกันซ้ำและถูกอ้างในดัชนี
      ⇒ ชื่อไฟล์กับเดือนที่จัด **ไม่ตรงกันได้โดยตั้งใจ** และต้องเขียนกำกับให้คนเห็น */
const เพดานแกะPDFต่อรอบ = 15

async function realFilesByMonth(vendorId: string, vendorName: string) {
  const realByMonth: Record<string, any[]> = {}
  const จัดตามรอบบิล: { file: string; จากชื่อไฟล์: string | null; จัดเข้า: string }[] = []
  try {
    const blobFiles = await listVendorBlobFiles(vendorId)
    const แคช = await loadRealPeriods(vendorId)
    let แกะไปแล้ว = 0
    let แคชเปลี่ยน = false

    for (const f of blobFiles) {
      const { month: nameMonth, rest } = splitRealName(f.name)
      if (!nameMonth || !rest) continue
      /* ยังไม่เคยอ่านไฟล์นี้ ⇒ แกะ PDF หนึ่งครั้งแล้วจำไว้
         ⚠️ มีเพดานต่อรอบ เพื่อไม่ให้จอค้างตอนเจ้าที่มีไฟล์เยอะ ๆ เปิดครั้งแรก
            ไฟล์ที่เหลือจะถูกอ่านในรอบถัด ๆ ไป ⇒ ระหว่างนั้นมันใช้ชื่อไฟล์ไปก่อน (ซึ่งบอกไว้ในโค้ดแล้วว่าชั่วคราว) */
      if (!(f.name in แคช) && แกะไปแล้ว < เพดานแกะPDFต่อรอบ) {
        แกะไปแล้ว++
        try {
          const buf = await downloadBlobFile(f.id)
          const { text } = buf ? await pdfBillInfo(buf) : { text: '' }
          แคช[f.name] = billFilingMonth(text ?? '').month
          แคชเปลี่ยน = true
        } catch {
          /* อ่านไฟล์นี้ไม่ได้ ⇒ **ห้ามจำว่า null** เพราะ null แปลว่า "อ่านแล้วไม่เจอ"
             ปล่อยให้ไม่มีคีย์ไว้ เพื่อให้รอบหน้าลองใหม่ (ไม่รู้ ≠ ไม่มี) */
        }
      }
      const c = filingMonthOf(f.name, แคช[f.name])
      const m = c.month ?? nameMonth
      if (c.mismatch) จัดตามรอบบิล.push({ file: rest, จากชื่อไฟล์: c.nameMonth, จัดเข้า: m })
      ;(realByMonth[m] ??= []).push({
        filename: rest, messageId: '', attachmentId: f.id, size: f.size,
        subject: `ไฟล์ตัวจริงจาก ${vendorName}`,
        /* ⚠️ ติดหมายเหตุไปกับตัวไฟล์ด้วย — คนที่เห็นไฟล์ในแฟ้ม มิ.ย. ที่ชื่อขึ้นต้น 07
           ต้องอ่านเหตุผลได้ตรงนั้น ไม่ใช่ต้องไปหาในที่อื่น */
        หมายเหตุเดือน: filingNote(c),
      })
    }
    if (แคชเปลี่ยน) await saveRealPeriods(vendorId, แคช)
  } catch { /* อ่านที่เก็บไฟล์ไม่ได้ ⇒ แสดงเฉพาะบิลจากอีเมลตามปกติ */ }
  return { realByMonth, จัดตามรอบบิล }
}

async function attachRealFiles(months: Record<string, any[]>, vendorId: string, vendorName: string) {
  const { realByMonth } = await realFilesByMonth(vendorId, vendorName)
  for (const [m, files] of Object.entries(realByMonth)) {
    const existing = (months[m] ?? []).filter(x => x.attachmentId !== 'GEN')
    months[m] = files.concat(existing)
  }
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
        let invoiceNo: string | null = null
        let period: string | null = null
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
            /* 🗓️ **รอบบิลชนะวันที่ออกใบ** (แก้ 16 ก.ย. 2569) — เดิมใช้ "วันที่แรกในเอกสาร"
               ⇒ บิลรอบสิ้นเดือนที่ออกใบต้นเดือนถัดไปถูกจัดผิดเดือน (ท่านประธานเจอใบ มิ.ย. ไปอยู่ ก.ค.) */
            const filing = billFilingMonth(text)
            /* 🔴 **รับ `วันที่แรกในใบ` ด้วย ไม่ใช่รับแค่รอบบิล** (แก้ 18 ก.ย. 2569 ตามที่ CTO ชี้)
               ของเดิมยอมรับเฉพาะ `รอบบิลที่พิมพ์ในใบ` ⇒ ใบที่ไม่มีรอบบิล (เช่น Adobe)
               **ตกไปใช้ `pdfMonth` ซึ่งเป็นค่าที่ไม่มีที่มากำกับ**
               ⇒ ทั้งสองทางอาจให้เลขเดียวกันวันนี้ แต่ทางหนึ่ง**บอกได้ว่าเดือนนี้มาจากไหน**
                 อีกทางบอกไม่ได้ · และวันหลังถ้า `billFilingMonth` ฉลาดขึ้น (เช่นอ่านป้าย Invoice Date
                 แทนที่จะหยิบวันแรกที่เจอ) ทางนี้จะได้ของที่ดีขึ้นเอง ส่วน `pdfMonth` ไม่ได้
               ⚠️ ลำดับยังเหมือนเดิม: รอบบิล > วันที่ในใบ > เดือนของอีเมล */
            m = filing.month ?? pdfMonth ?? emailMonth
            const ident = billIdentity(text, vendor.id)
            invoiceNo = ident.invoiceNo
            period = filing.month ?? null
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
          invoiceNo,
          period,
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

    /* 🔴 แก้ 15 ก.ย. 2569 — เดิมบันทึก `lastScan` **เฉพาะตอนเจอของใหม่**
       ⇒ ค่านั้นความหมายจริงคือ "เจอบิลใหม่ล่าสุดเมื่อไหร่" ไม่ใช่ "สแกนล่าสุดเมื่อไหร่"
       พอเอาไปขึ้นจอเป็น "ดึงล่าสุด" มันโกหกทันที:
       TikTok ขึ้นว่า "ดึงล่าสุด 1 ส.ค. · เงียบมา 44 วัน" ทั้งที่ตัวเก็บทำงานทุกวัน
       และเพิ่งเก็บไป 98 ใบในวันเดียวกัน — เจ้าที่ไม่มีบิลใหม่มานานจะดูเหมือนระบบพัง
       ⇒ แยกสองความหมายออกจากกัน: `lastScan` = สแกนครั้งล่าสุด · `lastNew` = เจอของใหม่ครั้งล่าสุด
       🔑 กฎทั่วไป: ฟิลด์ที่เอาไปขึ้นจอ ต้องมีความหมายเดียว และตรงกับคำที่เขียนบนจอ */
    try {
      await saveBillIndexBlobs(vendor.id, {
        lastScan: now.toISOString(),
        lastNew: changed ? now.toISOString() : (idx?.lastNew ?? idx?.lastScan ?? null),
        done: Array.from(done),
        entries,
      } as any)
    } catch { /* บันทึกพลาดไม่เป็นไร รอบหน้าสแกนใหม่ */ }

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
        invoiceNo: e.invoiceNo ?? null,
      })
    }

    // ── รวมไฟล์บิล "ตัวจริง" ที่อัปโหลดไว้ใน Google Drive (ผ่าน /api/bills/upload) ──
    // ชื่อไฟล์รูปแบบ YYYY-MM_REAL_<ชื่อ>.pdf — ถ้าเดือนไหนมีไฟล์ตัวจริง ให้ตัด PDF
    // ที่สร้างจากอีเมล (GEN) ของเดือนนั้นทิ้ง เหลือแต่ตัวจริง
    /* ⚠️ เดิมบล็อกนี้เขียนซ้ำกับ attachRealFiles ข้างบนคนละก๊อบปี้
       ⇒ ตอนแก้เรื่องเดือนตามรอบบิล ถ้าแก้ที่เดียวจะได้จอที่จัดเดือนคนละแบบตามทางที่ข้อมูลเดินมา
       ⇒ รวมมาเรียกตัวเดียวกัน (บทเรียนซ้ำของโปรเจกต์: บทเรียนที่แก้ทางหนึ่ง ไม่เดินไปหาพี่น้องของมัน) */
    const ของจริง = await realFilesByMonth(vendor.id, vendor.name)
    for (const [m, files] of Object.entries(ของจริง.realByMonth)) {
      const existing = (months[m] ?? []).filter(x => x.attachmentId !== 'GEN')
      months[m] = files.concat(existing)
    }

    /* 🔴 คัดซ้ำแล้ว **ต้องบอกว่าซ่อนอะไรไว้** — ของเดิมซ่อนเงียบ ๆ
       ⇒ ท่านประธานต้องเปิด PDF ทีละใบเองถึงจะรู้ว่าไฟล์ไหนซ้ำ (ใบ t_mu3g8tq5) */
    const ซ่อนไว้: Record<string, ไฟล์ซ้ำ[]> = {}
    for (const k of Object.keys(months)) {
      const r = คัดซ้ำพร้อมรายงาน(months[k])
      months[k] = r.เก็บไว้
      if (r.ซ่อนไว้.length) ซ่อนไว้[k] = r.ซ่อนไว้
    }
    return NextResponse.json({
      vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months,
      ...(Object.keys(ซ่อนไว้).length ? { ซ่อนไฟล์ซ้ำ: ซ่อนไว้ } : {}),
      /* 🔴 ไฟล์ที่ชื่อบอกเดือนหนึ่ง แต่จัดเข้าอีกเดือนตามรอบบิลในเอกสาร
         ⇒ **ต้องส่งขึ้นจอ** ไม่งั้นคนเห็นไฟล์ชื่อ 2026-07 อยู่ในแฟ้ม มิ.ย. แล้วคิดว่าระบบพัง */
      ...(ของจริง.จัดตามรอบบิล.length ? { จัดตามรอบบิล: ของจริง.จัดตามรอบบิล } : {}),
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
        const ซ่อนไว้2: Record<string, ไฟล์ซ้ำ[]> = {}
        for (const k of Object.keys(months)) {
          const r = คัดซ้ำพร้อมรายงาน(months[k])
          months[k] = r.เก็บไว้
          if (r.ซ่อนไว้.length) ซ่อนไว้2[k] = r.ซ่อนไว้
        }
        return NextResponse.json({
          vendor: vendor.id, name: vendor.name, emoji: vendor.emoji, months,
          ...(Object.keys(ซ่อนไว้2).length ? { ซ่อนไฟล์ซ้ำ: ซ่อนไว้2 } : {}),
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
