import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/auth/whoami → บอกสิทธิ์ของผู้ใช้ปัจจุบัน (ใช้โดยหน้าแคตตาล็อกแบบ static
// เพื่อซ่อนเมนู/หน้าที่พนักงานไม่มีสิทธิ์เข้า — เส้นทางนี้อยู่ใต้ /api/auth จึงไม่ถูก
// middleware บังคับให้ล็อกอินก่อน แต่ตัวมันเองไม่ได้เปิดเผยข้อมูลอะไรถ้ายังไม่ล็อกอิน)
export async function GET(req: NextRequest) {
  const adminPass = process.env.SITE_PASSWORD
  const staffPass = process.env.STAFF_PASSWORD
  const auth = req.cookies.get('gucut_auth')?.value

  let role: 'admin' | 'staff' | null = null
  if (auth && adminPass && auth === adminPass) role = 'admin'
  else if (auth && staffPass && auth === staffPass) role = 'staff'

  return NextResponse.json({ role })
}
