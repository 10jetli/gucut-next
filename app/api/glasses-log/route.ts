import { NextResponse } from 'next/server'
import { listTurns } from '@/lib/rokid-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// บทสนทนาจากแว่น Rokid — ให้จอหลังร้านอ่าน
//
// 🔴 **ทำไมชื่อเส้นทางไม่ใช่ `/api/rokid/log` และห้ามเปลี่ยนกลับ**
//    `middleware.ts` มี `/api/rokid` อยู่ใน PUBLIC_PATHS แล้วเทียบด้วย **startsWith**
//    (จำเป็น เพราะแว่นยิงเข้ามาเองโดยไม่มี session — มันใช้ ROKID_BRIDGE_KEY แทน)
//    ⇒ `/api/rokid/log` **และ** `/api/rokid-log` เข้าเงื่อนไขนั้นทั้งคู่
//      = ใครก็เปิดอ่านบทสนทนาของเจ้าของร้านได้โดยไม่ต้องล็อกอิน
//    จึงต้องอยู่คนละตระกูลชื่อไปเลย ⇒ `/api/glasses-log` ซึ่งด่านล็อกอินคุ้มตามปกติ
//    ⚠️ เพิ่มเส้นใหม่ที่ขึ้นต้นด้วย `/api/rokid` เมื่อไหร่ ให้ถามก่อนว่า
//       "เส้นนี้ตั้งใจให้เปิดสาธารณะจริงไหม" — ค่าเริ่มต้นของ prefix นี้คือ **เปิด**

export async function GET() {
  try {
    const { entries, pruned } = await listTurns(200)
    return NextResponse.json({ ok: true, count: entries.length, pruned, entries })
  } catch (err) {
    // แยก "อ่านไม่ได้" ออกจาก "ไม่มีบทสนทนา" — สองอย่างนี้ต่างกันคนละเรื่อง
    // (กติกาสามสถานะ: กำลังโหลด / ดึงไม่สำเร็จ / ไม่มีข้อมูลจริง)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
