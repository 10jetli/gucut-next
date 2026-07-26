import { NextRequest, NextResponse } from 'next/server'

// ป้องกันทั้งเว็บด้วยรหัสผ่านเดียว (ตั้งค่าใน env: SITE_PASSWORD)
// - ยังไม่ล็อกอิน → เด้งไปหน้า /login
// - API ที่ยังไม่ล็อกอิน → 401
// - ยกเว้น: /login, /api/auth/*, /api/google/* (OAuth callback), ไฟล์ static
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/google']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const expected = process.env.SITE_PASSWORD
  if (!expected) return NextResponse.next() // ยังไม่ได้ตั้งรหัส = ไม่ล็อก

  const ok = req.cookies.get('gucut_auth')?.value === expected
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized', message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
