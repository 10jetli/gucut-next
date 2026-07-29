import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// รายชื่อพนักงาน (คนละรหัสผ่าน แยกกันได้ว่าใครล็อกอิน) — ตั้งใน Vercel env
// env ที่ต้องตั้ง: STAFF_NAME_1..8 / STAFF_PASS_1..8 (คู่ไหนไม่ครบจะถูกข้าม)
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

// POST /api/auth/login  { password }  → ตั้ง cookie gucut_auth ถ้ารหัสถูก (แอดมินหรือพนักงาน)
export async function POST(req: NextRequest) {
  const adminPass = process.env.SITE_PASSWORD
  const legacyStaffPass = process.env.STAFF_PASSWORD // รหัสพนักงานตัวเก่า (ใช้ร่วมกัน) — เก็บไว้เผื่อยังไม่ได้ย้ายมาใช้รหัสแยกคน
  if (!adminPass) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SITE_PASSWORD บน Vercel' }, { status: 500 })
  }
  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch { /* ไม่มี body */ }

  const isAdmin = password === adminPass
  const staffMatch = !isAdmin ? staffList().find(s => s.pass === password) : undefined
  const isLegacyStaff = !isAdmin && !staffMatch && !!legacyStaffPass && password === legacyStaffPass
  if (!isAdmin && !staffMatch && !isLegacyStaff) {
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  const role = isAdmin ? 'admin' : 'staff'
  const name = staffMatch ? staffMatch.name : ''
  const res = NextResponse.json({ ok: true, role, name })
  res.cookies.set('gucut_auth', password, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 วัน
  })
  return res
}

// DELETE /api/auth/login → ออกจากระบบ
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('gucut_auth', '', { path: '/', maxAge: 0 })
  return res
}
