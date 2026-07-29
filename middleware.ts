import { NextRequest, NextResponse } from 'next/server'

// ป้องกันทั้งเว็บด้วยรหัสผ่าน (ตั้งค่าใน env)
// - SITE_PASSWORD  = แอดมิน เข้าได้ทุกหน้า
// - STAFF_PASSWORD = พนักงาน (รหัสเก่าใช้ร่วมกัน) เข้าได้เฉพาะหน้า "โอนสินค้า" (/catalog) + API โอนสินค้า
// - STAFF_NAME_1..8 / STAFF_PASS_1..8 = พนักงานรายคน (คนละรหัส) สิทธิ์เท่ากับ STAFF_PASSWORD
// - ยังไม่ล็อกอิน → เด้งไปหน้า /login
// - API ที่ยังไม่ล็อกอิน → 401
// - พนักงานเปิดหน้าอื่นนอกเหนือสิทธิ์ → เด้งกลับไปหน้าโอนสินค้า (หรือ 403 ถ้าเป็น API)
// - ยกเว้น: /login, /api/auth/*, /api/google/* (OAuth callback), ไฟล์ static
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/google', '/api/telegram']

// เส้นทางที่พนักงาน (สิทธิ์โอนสินค้าเท่านั้น) เข้าได้
const STAFF_ALLOWED_PREFIXES = ['/catalog', '/api/transfer']

function staffAllowed(pathname: string) {
  return STAFF_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
}

const cleanEnv = (v?: string) => (v ?? '').trim()
function staffPasswords() {
  const list: string[] = []
  for (let i = 1; i <= 8; i++) {
    const pass = cleanEnv(process.env[`STAFF_PASS_${i}`])
    if (pass) list.push(pass)
  }
  return list
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const adminPass = process.env.SITE_PASSWORD
  const staffPass = process.env.STAFF_PASSWORD
  if (!adminPass) return NextResponse.next() // ยังไม่ได้ตั้งรหัส = ไม่ล็อก

  const auth = req.cookies.get('gucut_auth')?.value
  const isAdmin = !!auth && auth === adminPass
  const isLegacyStaff = !isAdmin && !!staffPass && !!auth && auth === staffPass
  const isNamedStaff = !isAdmin && !!auth && staffPasswords().includes(auth)
  const isStaff = isLegacyStaff || isNamedStaff

  if (!isAdmin && !isStaff) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized', message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isStaff && !staffAllowed(pathname)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Forbidden', message: 'บัญชีนี้มีสิทธิ์เฉพาะโอนสินค้า' }, { status: 403 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/catalog/index.html'
    url.hash = '#trf'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
