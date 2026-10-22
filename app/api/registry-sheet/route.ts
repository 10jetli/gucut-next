/* 📥 สถานะตัวดึงชีททะเบียน — จอ /core/registry อ่าน (อยู่หลังกำแพงล็อกอินตามปกติ)
 * ตอบ: อนุญาตแล้วไหม · เป้าล่าสุดที่ผ่านตาข่าย · 20 รอบล่าสุด (เวลา · สถานะ · เหตุ) — ไม่มีแถวข้อมูลของชีท */
import { NextResponse } from 'next/server'
import { อ่านสถานะ } from '@/lib/registry-sheet'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await อ่านสถานะ()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `อ่านสถานะตัวดึงไม่ได้: ${String(e instanceof Error ? e.message : e)}` }, { status: 500 })
  }
}
