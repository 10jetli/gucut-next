import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const cleanEnv = (v?: string) => (v ?? '').trim()
function staffList() {
  const list: { name: string; pass: string }[] = []
  for (let i = 1; i <= 8; i++) {
    const name = cleanEnv(process.env[`STAFF_NAME_${i}`])
    const pass = cleanEnv(process.env[`STAFF_PASS_${i}`])
    if (name && pass) list.push({ name, pass })
  }
  return list
}

// GET /api/auth/whoami → บอกสิทธิ์ + ชื่อของผู้ใช้ปัจจุบัน (ใช้โดยหน้าแคตตาล็อกแบบ static
// เพื่อซ่อนเมนู/หน้าที่พนักงานไม่มีสิทธิ์เข้า — เส้นทางนี้อยู่ใต้ /api/auth จึงไม่ถูก
// middleware บังคับให้ล็อกอินก่อน แต่ตัวมันเองไม่ได้เปิดเผยข้อมูลอะไรถ้ายังไม่ล็อกอิน)
export async function GET(req: NextRequest) {
  const adminPass = process.env.SITE_PASSWORD
  const legacyStaffPass = process.env.STAFF_PASSWORD
  const auth = req.cookies.get('gucut_auth')?.value

  let role: 'admin' | 'staff' | null = null
  let name = ''
  if (auth && adminPass && auth === adminPass) {
    role = 'admin'
  } else if (auth) {
    const staffMatch = staffList().find(s => s.pass === auth)
    if (staffMatch) { role = 'staff'; name = staffMatch.name }
    else if (legacyStaffPass && auth === legacyStaffPass) { role = 'staff' }
  }

  return NextResponse.json({ role, name })
}
