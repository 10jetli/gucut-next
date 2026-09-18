import { NextRequest, NextResponse } from 'next/server'
import { deleteBillBlob, syncBillToBlobs, syncBillByIdentity , loadRealPeriods, saveRealPeriods } from '@/lib/billblobs'
import { ตัวตนของไฟล์อัป } from '@/lib/bill-ingest'
import { BILL_VENDORS } from '@/lib/vendors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/bills/upload — รับไฟล์บิล PDF "ตัวจริง" จากงานดึงบิลอัตโนมัติรายวัน
// (เช่น ดึงจาก manager.line.biz / Adobe แล้วส่งเข้ามาตรงๆ ไม่ต้องผ่านอีเมล)
// ฟอร์ม multipart: secret (=DRIVESYNC_SECRET), vendor (line/adobe/...), month (YYYY-MM),
//                  filename (ชื่อไฟล์แสดงผล), file (ตัวไฟล์ PDF)
// เก็บลง Google Drive โฟลเดอร์บิลของเจ้านั้น ชื่อไฟล์ YYYY-MM_REAL_<filename>
// แล้วหน้า /bills/<vendor> จะแสดงไฟล์จริงนี้แทน PDF ที่สร้างจากอีเมล

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (body: any, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS })

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 150)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const secret = String(form.get('secret') ?? '')
    const required = process.env.DRIVESYNC_SECRET
    if (!required || secret !== required) return json({ error: 'Unauthorized' }, 401)

    const vendorId = String(form.get('vendor') ?? '')
    if (!BILL_VENDORS.some(v => v.id === vendorId)) {
      return json({ error: 'ไม่รู้จัก vendor นี้' }, 400)
    }

    const month = String(form.get('month') ?? '')
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'month ต้องเป็นรูปแบบ YYYY-MM' }, 400)

    const filename = safeName(String(form.get('filename') ?? 'invoice.pdf'))
    const file = form.get('file')
    if (!(file instanceof Blob)) return json({ error: 'ต้องแนบไฟล์ในฟิลด์ file' }, 400)

    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length < 1000 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return json({ error: 'ไฟล์ไม่ใช่ PDF ที่ถูกต้อง' }, 400)
    }

    const driveName = `${month}_REAL_${filename.endsWith('.pdf') ? filename : filename + '.pdf'}`
    /* 🔴 **กันซ้ำด้วยตัวตนของใบ เหมือนขาอีเมล** (แก้ 18 ก.ย. 2569 · ใบ t_mu3g8tq5)
       เดิมเส้นนี้ใช้ `syncBillToBlobs` ซึ่งกันซ้ำด้วย **ชื่อไฟล์** อย่างเดียว
       ⇒ บิลที่ตัวเก็บสคริปต์ส่งเข้ามา **ไม่เคยผ่านตัวกันซ้ำด้วยตัวตนเลย**
          ของจริงที่ตามมา: คู่ "สำเนาอีเมล + สำเนาสคริปต์" TikTok 92 ไฟล์ · Apple 9 ไฟล์
       ⚠️ อ่านตัวตนไม่ได้ ⇒ ถอยไปกันด้วยชื่อไฟล์เหมือนเดิม **ห้ามทิ้งไฟล์** (บิลหายแย่กว่าบิลซ้ำ) และบอกเหตุกลับไป */
    const { key: identKey, why: identWhy, period } = await ตัวตนของไฟล์อัป(buf, vendorId)
    /* 🗓️ **จดรอบบิลของไฟล์นี้ไว้ตั้งแต่ตอนอัป** (ท่านประธานสั่ง 18 ก.ย. 2569:
       เดือนที่ใช้จัดต้องมาจากรอบบิลในเอกสาร ไม่ใช่ชื่อไฟล์)
       ⚠️ จดด้วย `driveName` ซึ่งเป็นชื่อที่ถูกใช้จริงในถัง — ไม่ใช่ชื่อที่ผู้ส่งกรอกมา
       ⚠️ `period === undefined` = อ่านใบไม่ได้ ⇒ **ไม่จดอะไรเลย** เพื่อให้จอลองอ่านใหม่รอบหน้า
       ⚠️ จดไม่สำเร็จห้ามทำให้การอัปล้มเหลว — ไฟล์เข้าถังแล้วสำคัญกว่าแคช */
    if (period !== undefined) {
      try {
        const m = await loadRealPeriods(vendorId)
        m[driveName] = period
        await saveRealPeriods(vendorId, m)
      } catch { /* จดไม่ได้ ⇒ จอจะแกะ PDF เองรอบหน้า */ }
    }
    if (identKey) {
      const res = await syncBillByIdentity(vendorId, driveName, 'application/pdf', buf, identKey)
      return json({
        ok: true, uploaded: res.written, skipped: !res.written, name: driveName, size: buf.length,
        ...(res.written ? {} : { reason: res.reason, sameAs: res.sameAs ?? null }),
        กันซ้ำด้วย: 'ตัวตนของใบ',
      })
    }
    const uploaded = await syncBillToBlobs(vendorId, driveName, 'application/pdf', buf)
    return json({
      ok: true, uploaded, skipped: !uploaded, name: driveName, size: buf.length,
      กันซ้ำด้วย: 'ชื่อไฟล์ (อ่านตัวตนของใบไม่ได้)', ตัวตนอ่านไม่ได้เพราะ: identWhy,
    })
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500)
  }
}

// DELETE /api/bills/upload?secret=<DRIVESYNC_SECRET>&vendor=<id>&name=<ชื่อไฟล์เต็ม>
//
// 🔴 มีไว้แก้ใบที่อัปเข้ามาผิดเท่านั้น — บิลเป็นเอกสารบัญชี ลบแล้วกู้ไม่ได้
// ⚠️ **ต้องระบุ name เต็มเป๊ะ** (รวมส่วน `YYYY-MM_REAL_`) ไม่มี wildcard ไม่มีลบเป็นชุด
//    โดยตั้งใจ — ตัวลบที่รับ pattern ได้ คือตัวที่วันหนึ่งจะลบทั้งเดือนเพราะพิมพ์ผิดตัวเดียว
// ⚠️ แยกสองผลลัพธ์เสมอ: deleted=true (ลบจริง) vs 404 (ไม่มีไฟล์ชื่อนั้น)
//    ห้ามตอบ ok เฉย ๆ ทั้งสองกรณี — คนเรียกจะแยกไม่ออกว่าลบถูกใบไหม
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const required = process.env.DRIVESYNC_SECRET
    if (!required || (sp.get('secret') ?? '') !== required) return json({ error: 'Unauthorized' }, 401)

    const vendorId = sp.get('vendor') ?? ''
    if (!BILL_VENDORS.some(v => v.id === vendorId)) return json({ error: 'ไม่รู้จัก vendor นี้' }, 400)

    const name = sp.get('name') ?? ''
    if (!name || name !== safeName(name)) return json({ error: 'ต้องระบุ name เป็นชื่อไฟล์เต็มที่ถูกต้อง' }, 400)

    const deleted = await deleteBillBlob(vendorId, name)
    if (!deleted) return json({ error: 'ไม่พบไฟล์ชื่อนี้', vendor: vendorId, name }, 404)
    return json({ ok: true, deleted: true, vendor: vendorId, name })
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500)
  }
}
