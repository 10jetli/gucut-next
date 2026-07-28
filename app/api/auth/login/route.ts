import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/auth/login  { password }  → ตั้ง cookie gucut_auth ถ้ารหัสถูก (แอดมินหรือพนักงาน)
export async function POST(req: NextRequest) {
  const adminPass = process.env.SITE_PASSWORD
  const staffPass = process.env.STAFF_PASSWORD
  if (!adminPass) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SITE_PASSWORD บน Vercel' }, { status: 500 })
  }
  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch { /* ไม่มี body */ }

  const isAdmin = password === adminPass
  const isStaff = !isAdmin && !!staffPass && password === staffPass
  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  const role = isAdmin ? 'admin' : 'staff'
  const res = NextResponse.json({ ok: true, role })
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
