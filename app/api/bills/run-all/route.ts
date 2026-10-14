import { NextResponse } from 'next/server'
import { อ่านสถานะบิลบนg1, สั่งกวาดบิลบนg1 } from '@/lib/bills-g1'

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

export async function POST() {
  const สั่ง = await สั่งกวาดบิลบนg1()
  return NextResponse.json({ ok: สั่ง.ok, ข้อความ: สั่ง.ข้อความ }, { status: สั่ง.ok ? 200 : 502 })
}

export async function GET() {
  const g1 = await อ่านสถานะบิลบนg1()
  return NextResponse.json(g1, { status: g1.ok ? 200 : 502 })
}
