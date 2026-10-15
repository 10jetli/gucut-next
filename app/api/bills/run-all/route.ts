import { NextResponse } from 'next/server'
import { อ่านสถานะบิลบนg1, สั่งกวาดบิลบนg1, ลองใหม่ได้ } from '@/lib/bills-g1'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// /api/bills/run-all — ปุ่ม "ดึงบิลทั้งหมด" บนหน้า /bills (ท่านประธานสั่ง 15 ต.ค. 2569)
//
// POST ⇒ สั่ง g1 กวาด 6 เจ้าที่เก็บด้วยสคริปต์ (g1 ตอบทันทีแล้วทำต่อเบื้องหลัง)
// GET  ⇒ อ่านความคืบหน้าของรอบกวาดบน g1 (หน้าเรียกซ้ำทุกไม่กี่วินาที)
//
// 🔑 คีย์ของ g1 อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น — เบราว์เซอร์ไม่เคยเห็น
// ⚠️ 4 เจ้าที่เก็บทางเมล (Google Ads · Apple · Omise · Anthropic) **ไม่ได้สั่งจากที่นี่**
//    หน้าเรียก `/api/bills/vendor?vendor=<id>` ทีละเจ้าเอง ⇒ แต่ละเจ้าได้เวลาและผลของตัวเอง
//    (รวมไว้ในคำขอเดียวจะชนเพดานเวลาของฟังก์ชัน แล้วเจ้าท้าย ๆ หายเงียบ)
// ⚠️ ชั้น "บัญชี" ยิงได้แต่ GET (middleware) ⇒ POST จะได้ 403 — หน้าต้องบอกว่าทำไมกดไม่ได้

/* 🔴 ล้มฝั่ง g1 ⇒ ตอบ **503 ไม่ใช่ 502** — 502 เป็นรหัสเดียวที่ขอบของ Netlify แทน body ทิ้ง
      (วัด 8 รหัส 4 ต.ค. 2569: 200 400 409 424 429 500 503 body รอดครบ · 502 ⇒ 16 ไบต์ text/plain)
      ⇒ ถ้าตอบ 502 จอจะเห็นแค่รหัสเปล่า แยก "คีย์ไม่ตรง" ออกจาก "g1 ล่ม" ไม่ได้ ทั้งที่ทางแก้ตรงข้ามกัน
   🔑 จอตัดสินจากช่อง (upstreamOk · ชนิด · retryable) ไม่ใช่จากรหัส HTTP หรือข้อความ
   ⚠️ 403 ของเส้นนี้มาจาก middleware เท่านั้น (บัญชีอ่านอย่างเดียว) — เส้นนี้เองไม่ตอบ 401/403 */
const หัวท่อ = { upstream: 'g1 (ping.gucut.com)' }

export async function POST() {
  const สั่ง = await สั่งกวาดบิลบนg1()
  if (สั่ง.ok) return NextResponse.json({ ok: true, ...หัวท่อ, upstreamOk: true, upstreamStatus: สั่ง.upstreamStatus, ข้อความ: สั่ง.ข้อความ })
  return NextResponse.json(
    { ok: false, ...หัวท่อ, upstreamOk: false, upstreamStatus: สั่ง.upstreamStatus, ชนิด: สั่ง.ชนิด, retryable: ลองใหม่ได้(สั่ง.ชนิด), ข้อความ: สั่ง.ข้อความ },
    { status: 503 },
  )
}

export async function GET() {
  const g1 = await อ่านสถานะบิลบนg1()
  if (g1.ok) return NextResponse.json({ ...g1, ...หัวท่อ, upstreamOk: true })
  return NextResponse.json(
    { ...g1, ...หัวท่อ, upstreamOk: false, retryable: ลองใหม่ได้(g1.ชนิด) },
    { status: 503 },
  )
}
