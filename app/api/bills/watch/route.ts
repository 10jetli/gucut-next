import { NextRequest, NextResponse } from 'next/server'
import { BILL_VENDORS } from '@/lib/vendors'
import { loadBillIndexBlobs, listVendorBlobFiles } from '@/lib/billblobs'
import { เดือนบิลถูกต้อง, เกณฑ์เดือนบิล } from '@/lib/billmonth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/watch?secret=<DRIVESYNC_SECRET>[&month=YYYY-MM]
//
// ตอบว่า "เดือนที่ตรวจ เจ้าไหนยังไม่มีบิล" เฉพาะเจ้าที่ติดธง everyMonth
//
// 🔴 **ทำไมต้องมีตัวนี้** (8 ก.ย. 2569) — ตัวเก็บบิลบางเจ้าพึ่งเบราว์เซอร์ที่ล็อกอินไว้
//    (LINE ต้องเปิด manager.line.biz · Adobe ต้องเปิด account.adobe.com) พอ session
//    หมดอายุ งานจะ "ข้ามอย่างสุภาพ" แล้วเงียบ — ซึ่ง**หน้าตาเหมือนเดือนที่ยังไม่มีบิลเป๊ะ**
//    วันที่เขียนตัวนี้ ตรวจแล้วพบว่า session ของ LINE **หมดอายุอยู่จริง ณ ตอนนั้น**
//    ⇒ ถ้าไม่มีตัวเฝ้า จะไปรู้ตัวตอนทำบัญชีสิ้นปี ว่าบิลขาดไปหลายเดือน
//
// ⚠️ **"ไม่มีบิล" ในที่นี้แปลว่า "ยังไม่มีในคลัง" เท่านั้น ห้ามแปลว่า "ไม่ได้ถูกเรียกเก็บ"**
//    เป็นคนละคำถามกัน — ข้อความที่ส่งออกต้องเขียนให้ชัดว่าให้ไป**ตรวจ** ไม่ใช่สรุปว่าไม่ต้องจ่าย
// ⚠️ อ่านอย่างเดียว ไม่แก้ไขอะไรเลย — เรียกซ้ำกี่ครั้งก็ปลอดภัย

/** เดือนก่อนหน้าตามเวลาไทย (UTC+7) — เซิร์ฟเวอร์รัน UTC ต้องเลื่อนก่อนเสมอ
 *  ⚠️ ใช้ 'now' แบบ UTC ตรง ๆ จะเหลื่อมได้ 7 ชม. ตรงรอยต่อเดือน (กติกาเวลาใน CLAUDE.md) */
function prevMonthTH(now = new Date()): string {
  const th = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const y = th.getUTCFullYear()
  const m = th.getUTCMonth() // 0-based ของเดือนปัจจุบัน ⇒ ใช้เป็นเดือนก่อนหน้าแบบ 1-based ได้เลย
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? ''
  const required = process.env.DRIVESYNC_SECRET
  if (!required || secret !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  /* 🔑 **สามสถานะ ไม่ใช่สอง** (CEO ตัดสิน 30 ก.ย. 2569)
     · ไม่ส่ง `month` มาเลย  ⇒ ถอยไปเดือนก่อนหน้าได้ — ผู้เรียกไม่ได้อ้างเดือนอะไร
       และนี่คือทางที่ **ของจริงใช้**: `netlify/functions/bills-watch.mjs` ยิงโดยไม่ส่ง month
       ⇒ ด่านที่พลาดไปปฏิเสธทางนี้ = ตัวเฝ้าบิลตายทั้งระบบ
     · ส่งมาแล้วรูปผิด      ⇒ **400** — ผู้เรียกอ้างเดือนหนึ่ง แล้วเราไปตรวจอีกเดือนเงียบ ๆ
       ⇒ คำตอบอ่านว่า "เดือนที่คุณถามไม่มีบิล" ทั้งที่ไม่ได้ตรวจเดือนนั้นเลย
          = **คำตอบที่ถูกทุกคำแต่ตอบคำถามอื่น** ซึ่งคนอ่านแยกไม่ออก
     · อยู่นอกช่วง 01–12     ⇒ **400** — ไม่มีผู้เรียกที่ถูกต้องคนไหนส่งค่านั้น
       เดิมตอบว่าทุกเจ้าขาดบิลของเดือนที่ไม่มีอยู่จริง ⇒ **คำเตือนเท็จ**
       และคำเตือนเท็จครั้งที่สองทำให้คนเลิกอ่านคำเตือน
     ⚠️ `?month=` (มีช่องแต่ว่าง) นับเป็น **ส่งมาแล้วรูปผิด** ⇒ 400
        เพราะคนพิมพ์ `month=` คือคนที่ตั้งใจจะระบุเดือน ไม่ใช่คนที่ไม่ได้ระบุ
     📏 กวาดผู้เรียกแล้ว 30 ก.ย. 2569: มีตัวเดียวและไม่ส่ง month ⇒ ด่านนี้ไม่ทำให้ของที่เดินอยู่พัง */
  const q = req.nextUrl.searchParams.get('month')
  if (q !== null && !เดือนบิลถูกต้อง(q)) {
    return NextResponse.json({ error: เกณฑ์เดือนบิล, ส่งมา: q }, { status: 400 })
  }
  const month = q ?? prevMonthTH()
  const watched = BILL_VENDORS.filter(v => v.everyMonth)

  const missing: { id: string; name: string; note?: string }[] = []
  const found: { id: string; n: number }[] = []
  /* 🔴 สามสถานะ: มีบิล · ไม่มีบิล · **อ่านคลังไม่ได้**
     เจ้าที่อ่านไม่ได้ห้ามนับเป็น "ไม่มีบิล" — จะกลายเป็นเตือนผิดตอน Blobs ล่ม
     และห้ามนับเป็น "มีบิล" — จะกลายเป็นเงียบตอนของหายจริง ต้องมีกองที่สาม */
  const unreadable: { id: string; why: string }[] = []

  await Promise.all(
    watched.map(async (v) => {
      try {
        /* ⚠️ **ห้าม .catch(()=>[]) ตรงนี้** — คลังไฟล์จริงอ่านไม่ได้แล้วคืนอาร์เรย์ว่าง
           จะกลายเป็น "เจ้านี้ไม่มีบิล" ทั้งที่จริงคือ "เรายังไม่รู้" แล้วเตือนผิด
           ปล่อยให้ throw ไปตกที่กอง unreadable ซึ่งเป็นกองที่ตอบว่า "ยังไม่รู้" โดยเฉพาะ
           (ตัวตรวจ prebuild ของ repo จับข้อนี้ได้เอง — ของดี อย่าถอด) */
        const [idx, blobs] = await Promise.all([
          loadBillIndexBlobs(v.id),
          listVendorBlobFiles(v.id),
        ])
        const fromEmail = (idx?.entries ?? []).filter(e => e.month === month).length
        const fromReal = blobs.filter(f => f.name.startsWith(`${month}_REAL_`)).length
        const n = fromEmail + fromReal
        if (n > 0) found.push({ id: v.id, n })
        else missing.push({ id: v.id, name: v.name, note: v.note })
      } catch (e) {
        unreadable.push({ id: v.id, why: e instanceof Error ? e.message : String(e) })
      }
    })
  )

  return NextResponse.json({
    month,
    watched: watched.length,
    found,
    missing,
    unreadable,
    /* ok = ตรวจครบและไม่มีอะไรขาด · มีเจ้าที่อ่านไม่ได้ = ยังไม่ ok เพราะยังไม่รู้คำตอบ */
    ok: missing.length === 0 && unreadable.length === 0,
  })
}
