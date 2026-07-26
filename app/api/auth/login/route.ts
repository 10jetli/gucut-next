import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/auth/login  { password }  → ตั้ง cookie gucut_auth ถ้ารหัสถูก
export async function POST(req: NextRequest) {
  const expected = process.env.SITE_PASSWORD
  if (!expected) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SITE_PASSWORD บน Vercel' }, { status: 500 })
  }
  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch { /* ไม่มี body */ }

  if (password !== expected) {
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('gucut_auth', expected, {
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
