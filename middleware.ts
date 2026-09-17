import { NextRequest, NextResponse } from 'next/server'
import { authToken, sameToken } from '@/lib/auth-token'
import { isStaffToken, roleOf, verifyStaffToken } from '@/lib/staff-token'

// ป้องกันทั้งเว็บด้วยรหัสผ่าน (ตั้งค่าใน env)
// - SITE_PASSWORD  = แอดมิน เข้าได้ทุกหน้า
// - STAFF_PASSWORD = พนักงาน (รหัสเก่าใช้ร่วมกัน) เข้าได้เฉพาะหน้า "โอนสินค้า" (/catalog) + API โอนสินค้า
// - STAFF_NAME_1..8 / STAFF_PASS_1..8 = พนักงานรายคน (คนละรหัส) สิทธิ์เท่ากับ STAFF_PASSWORD
// - **ผู้ใช้ที่เพิ่มจากหน้าเว็บ** (/core/settings-users/add) = คุกกี้เป็นโทเคนเซ็นชื่อ
//   สิทธิ์ **เท่ากับพนักงาน env เป๊ะ** ไม่มีสิทธิ์ใหม่ ไม่มีระบบสิทธิ์ใหม่ (คำสั่ง CEO ข้อ 4)
//   🔴 ตรวจด้วย **ลายเซ็น** ไม่ใช่การอ่านฐาน — middleware รันบน edge runtime
//      การอ่าน Blobs ที่นี่ยังไม่เคยพิสูจน์ว่าใช้ได้ และถ้าพลาด = ทั้งเว็บ 500 ทุกหน้า
//      ⇒ แลกกับข้อจำกัดที่ต้องรู้: **ปิดผู้ใช้แล้ว คนที่ล็อกอินค้างอยู่จะยังเข้าได้จนโทเคนหมดอายุ**
//      (ล็อกอินครั้งใหม่ถูกปิดทันที) · ดู lib/staff-token.ts
// - ยังไม่ล็อกอิน → เด้งไปหน้า /login
// - API ที่ยังไม่ล็อกอิน → 401
// - พนักงานเปิดหน้าอื่นนอกเหนือสิทธิ์ → เด้งกลับไปหน้าโอนสินค้า (หรือ 403 ถ้าเป็น API)
// - ยกเว้น: /login, /api/auth/*, /api/google/* (OAuth callback), ไฟล์ static
// - /api/bills/drivesync, /api/bills/upload และ /api/bills/watch มี secret ของตัวเอง (DRIVESYNC_SECRET)
//   ⚠️ เพิ่มเส้นที่ใช้ DRIVESYNC_SECRET ต้องมาเพิ่มที่ PUBLIC_PATHS ด้วยเสมอ — ไม่งั้นด่านล็อกอิน
//   จะตอบ 401 ก่อนถึงโค้ดที่ตรวจ secret แล้วมันจะ **หน้าตาเหมือน secret ผิด** (เจอมาแล้ว 8 ก.ย. 2569)
//   🔁 **เกิดซ้ำจริง 17 ก.ย. 2569** — `/api/bills/dupcheck` (ใบบิลซ้ำ t_mu3g8tq5) ลืมเพิ่ม ⇒ คนมี secret ยิงได้ 401 "กรุณาเข้าสู่ระบบก่อน"
//      ใบค้าง 1 วันเต็มที่ "รอคนมี secret ยิงให้" ทั้งที่ยิงยังไงก็ไม่ผ่าน · ตอนนี้มีเทสกันแล้ว (scripts/check-secret-routes.mjs)
// - /api/rokid (สะพานแว่น Rokid → Claude) มีกุญแจของตัวเอง (ROKID_BRIDGE_KEY)
//
// 🔴 **คุกกี้เก็บ "ลายนิ้วมือของรหัส" ไม่ใช่ตัวรหัส** (เปลี่ยน 6 ก.ย. 2569 — ดู lib/auth-token.ts)
//    ของเดิมเทียบ `คุกกี้ == รหัสผ่าน` ตรง ๆ ⇒ คนยิงเดา **ไม่ต้องผ่านหน้าล็อกอินเลย**
//    ตั้งคุกกี้แล้วขอหน้าไหนก็ได้ ⇒ ตัวกันเดาที่หน้าล็อกอินกันได้แค่ประตูเดียวจากสองประตู
//    ตอนนี้เดาคุกกี้ให้ตรงต้องเดาเลข 256 บิต ⇒ ประตูที่สองปิดด้วยความยาวของเลข
//    ⚠️ **ห้ามกลับไปเทียบกับตัวรหัสผ่านตรง ๆ อีก** ต่อให้เพิ่มตัวนับครั้งแล้วก็ตาม
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/google', '/api/telegram', '/api/bills/drivesync', '/api/bills/upload', '/api/bills/watch', '/api/bills/report', '/api/bills/fetchzip', '/api/bills/dupcheck', '/api/rokid']
// เส้นทางที่พนักงาน (สิทธิ์โอนสินค้าเท่านั้น) เข้าได้
/* /returns/receive + /api/returns เพิ่ม 7 ก.ย. 2569 (ร่าง /returns v2 ข้อ 6 — ผ่านเวทีสามเสียง):
   จอรับคืนบนมือถือพนักงาน · ท่อ /api/returns เป็น whitelist เฉพาะเส้นจอนี้ ไม่ใช่ /api/web ทั้งก้อน */
const STAFF_ALLOWED_PREFIXES = ['/catalog', '/api/transfer', '/api/catalog', '/returns/receive', '/api/returns']

/* ── ชั้นที่สาม: "บัญชี" (เพิ่ม 14 ก.ย. 2569 · งานกระดาน t_mu1bkqy4) ─────────────
   ZORT มีสามชั้น (Admin · พนักงาน · บัญชี) ของเรามีสอง ⇒ เพิ่มชั้นบัญชีที่ **เห็นเฉพาะการเงิน**

   🔴 **บัญชี = อ่านอย่างเดียว ทุกเส้น** — บังคับด้วยเมธอด ไม่ใช่รายชื่อเส้น
      เหตุผล: จอการเงินเกือบทุกจอยิงผ่าน `/api/web/...` ซึ่งเป็น **ท่อกลางเส้นเดียว**
      ที่พาไปได้ทุกอย่างรวมทั้งการเขียนเข้า ZORT ⇒ อนุญาตทั้งเส้นเมื่อไหร่
      = ให้สิทธิ์เขียนทุกอย่างไปด้วยโดยไม่ได้ตั้งใจ
      ⇒ กันด้วย "ต้องเป็น GET" จึงกันได้ทั้งเส้นที่เรายังไม่ได้คิดถึง

   ⚠️ **ผลข้างเคียงที่ต้องรู้และเขียนบนจอ**: ปุ่มไหนที่ทำงานด้วย POST (เช่นดึงบิลเดือนนี้)
      บัญชีจะกดไม่ได้ ⇒ ต้องบอกบนจอ ไม่ใช่ปล่อยให้กดแล้วเงียบ
   ⚠️ ห้ามใส่ `/core/settings-users` หรือ `/core/settings-roles` — คนดูเงินไม่ควรเห็นทะเบียนคน */
const ACCOUNT_ALLOWED_PREFIXES = [
  '/core/finance', '/core/other-income', '/core/other-expense', '/core/money-transfers',
  '/core/wallet', '/core/accounting-docs', '/core/peak', '/bills',
  '/core/settings-profile',            // ต้องดูได้ว่าตัวเองเป็นใคร/สิทธิ์อะไร
  '/api/web', '/api/bills',            // เส้นที่จอพวกนั้นใช้ — **GET เท่านั้น** (บังคับข้างล่าง)
  '/api/auth',                         // ออกจากระบบได้
]

function allowedBy(list: string[], pathname: string) {
  return list.some((p) => pathname === p || pathname.startsWith(p))
}
const staffAllowed = (pathname: string) => allowedBy(STAFF_ALLOWED_PREFIXES, pathname)

const cleanEnv = (v?: string) => (v ?? '').trim()
function staffPasswords() {
  const list: string[] = []
  for (let i = 1; i <= 8; i++) {
    const pass = cleanEnv(process.env[`STAFF_PASS_${i}`])
    if (pass) list.push(pass)
  }
  return list
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const adminPass = process.env.SITE_PASSWORD
  const staffPass = process.env.STAFF_PASSWORD
  if (!adminPass) return NextResponse.next() // ยังไม่ได้ตั้งรหัส = ไม่ล็อก

  const auth = req.cookies.get('gucut_auth')?.value
  // ⚠️ ไม่มีคุกกี้ = จบตรงนี้ ไม่ต้องเสียเวลาแฮชอะไรเลย (บอตยิงหน้าเว็บทั้งวัน)
  const isAdmin = !!auth && sameToken(auth, await authToken(adminPass))
  let isStaff = false
  /* 🔴 ชั้น "บัญชี" มาจาก **โทเคนที่เซ็นชื่อแล้วเท่านั้น** — ผู้ใช้ env ไม่มีชั้นนี้
     (env ไม่มีที่เก็บชั้นสิทธิ์ และเราไม่เพิ่ม env ใหม่ตามกติกาเดิมของระบบนี้) */
  let isAccount = false
  if (!isAdmin && auth) {
    /* ผู้ใช้จากหน้าเว็บมาก่อน — คุกกี้ขึ้นต้น 'gs1.' แยกจากท่าเดิม (เลขฐานสิบหก 64 ตัว) ได้ขาด
       ⇒ ของเดิมไม่ถูกแตะเลย: คุกกี้ท่าเดิมไม่เคยเข้าเงื่อนไขนี้ */
    if (isStaffToken(auth)) {
      const claims = await verifyStaffToken(auth, adminPass)
      if (claims) {
        isStaff = true
        /* ⚠️ โทเคนเก่าที่ยังไม่หมดอายุไม่มีช่อง r ⇒ roleOf คืน 'staff' ⇒ พฤติกรรมเดิมเป๊ะ */
        isAccount = roleOf(claims) === 'account'
      }
    } else if (staffPass && sameToken(auth, await authToken(staffPass))) isStaff = true
    else {
      for (const p of staffPasswords()) {
        if (sameToken(auth, await authToken(p))) { isStaff = true; break }
      }
    }
  }

  if (!isAdmin && !isStaff) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized', message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  /* ── ชั้นบัญชี: เห็นเฉพาะการเงิน และอ่านอย่างเดียว ────────────────────────
     🔴 **ตรวจก่อนชั้นพนักงาน** เพราะคนกลุ่มนี้ถือ isStaff=true ด้วย (โทเคนชนิดเดียวกัน)
        ถ้าปล่อยให้ตกไปที่ด่านพนักงาน จะถูกเด้งไปหน้าโอนสินค้าซึ่งไม่ใช่สิทธิ์ของเขา */
  if (isAccount) {
    /* 🔴 กันเขียนด้วย **เมธอด** — ท่อกลาง /api/web เส้นเดียวพาไปได้ทุกอย่างรวมทั้งเขียนเข้า ZORT
       ⇒ อนุญาตทั้งเส้นแล้วกันเฉพาะบางพารามิเตอร์ = ต้องไล่กันทุกตัวที่มีและที่จะมี ⇒ พลาดแน่
       ⚠️ HEAD ปลอดภัยเท่า GET · นอกนั้นปฏิเสธหมด */
    const readOnly = req.method === 'GET' || req.method === 'HEAD'
    if (!readOnly && pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'สิทธิ์ "บัญชี" ดูได้อย่างเดียว — แก้ไขหรือบันทึกไม่ได้' },
        { status: 403 },
      )
    }
    if (!allowedBy(ACCOUNT_ALLOWED_PREFIXES, pathname)) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'สิทธิ์ "บัญชี" เห็นเฉพาะหน้าการเงิน' },
          { status: 403 },
        )
      }
      const url = req.nextUrl.clone()
      url.pathname = '/core/finance'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
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
