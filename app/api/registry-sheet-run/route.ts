/* 📥 ขาชีททะเบียน — เส้นสำหรับเครื่อง (อยู่ใน PUBLIC_PATHS ของ middleware · ตรวจกุญแจเองในเส้น)
 *   GET หัว x-admin-key=<GUCUT_WEB_ADMIN_KEY> ⇒ เป้าล่าสุด + รอบล่าสุด
 *   (ตัวดึงบน g1 อ่านไปเขียน เป้าสต็อกทะเบียน.json · ตัวเฝ้าความเงียบบน Netlify ก็อ่านเส้นนี้)
 *   ขาเข้าของข้อมูลคือ /api/registry-sheet-push (Apps Script ส่งเอง) — เส้นนี้ไม่มี POST แล้ว
 * 🔴 ไม่ตั้งกุญแจ = ปิด (ต่างจาก drivesync ที่ไม่ตั้งแล้วเปิด) — เส้นนี้ตอบยอดคงเหลือของบัญชีตามกฎหมาย */
import { NextRequest, NextResponse } from 'next/server'
import { อ่านสถานะ } from '@/lib/registry-sheet'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const คีย์ = process.env.GUCUT_WEB_ADMIN_KEY
  if (!คีย์ || req.headers.get('x-admin-key') !== คีย์) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const s = await อ่านสถานะ()
    return NextResponse.json({ ok: true, latest: s.latest, รอบล่าสุด: s.log[0] ?? null })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 })
  }
}
