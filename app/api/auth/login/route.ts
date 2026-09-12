import { NextRequest, NextResponse } from 'next/server'
import { authToken } from '@/lib/auth-token'
import { clientIp } from '@/lib/client-ip'
import { findStaffUserByPassword } from '@/lib/staff-users'
import { signStaffToken, STAFF_TOKEN_TTL_SEC } from '@/lib/staff-token'

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

// ── ตัวกันเดารหัสรัว ๆ ──────────────────────────────────────────────
// ⚠️ **นับในหน่วยความจำของอินสแตนซ์ ไม่ใช่ที่ส่วนกลาง** — Netlify ปั้นอินสแตนซ์ใหม่ได้ตลอด
//    ⇒ คนยิงเดาที่โชคดีเจออินสแตนซ์ใหม่ จะได้เริ่มนับใหม่
//    **ห้ามเขียนบนจอว่า "กันเดารหัสแล้ว" แบบเต็มปาก** — มันแค่ทำให้แพงขึ้น ไม่ใช่ปิดสนิท
//    ของที่ปิดประตูจริงคือคุกกี้เป็นลายนิ้วมือ 256 บิต (lib/auth-token.ts) ไม่ใช่ตัวนับนี้
// ⚠️ ผูกกับ IP ที่ Netlify ใส่มาเท่านั้น ห้ามเชื่อ x-forwarded-for ที่ลูกค้าปลอมได้เอง
//    ปลอมหัวข้อมูลได้ = เปลี่ยนกุญแจตัวนับได้ทุกครั้งที่ยิง ⇒ ตัวนับไร้ความหมาย
const WINDOW_MS = 15 * 60 * 1000
const MAX_TRIES = 5
const tries = new Map<string, { n: number; until: number }>()

// 🔴 **ไม่รู้ IP = ไม่นับ ไม่ล็อก** (lib/client-ip.ts คืน null) — ห้ามยัดทุกคนลงกุญแจ 'unknown' ก้อนเดียว
//    ถ้ายัดรวม: ใครก็ได้ยิงผิด 5 ครั้ง แล้ว **ทั้งร้านล็อกอินไม่ได้ 15 นาที**
//    = เปลี่ยนตัวกันเดารหัส ให้กลายเป็นปุ่มปิดร้านที่ใครก็กดได้ (แย่กว่าไม่มีตัวกัน)
//    เจอตอนทดสอบในเครื่อง 6 ก.ย. — ในเครื่องไม่มีหัวข้อมูลนี้ ทุกคำขอเลยตกถังเดียวกันหมด
function whoIs(req: NextRequest): string | null {
  return clientIp(req)
}
function blockedFor(ip: string | null): number {
  if (!ip) return 0
  const e = tries.get(ip)
  if (!e) return 0
  if (Date.now() > e.until) { tries.delete(ip); return 0 }
  return e.n >= MAX_TRIES ? Math.ceil((e.until - Date.now()) / 60000) : 0
}
function countWrong(ip: string | null) {
  if (!ip) return
  const now = Date.now()
  const e = tries.get(ip)
  if (!e || now > e.until) tries.set(ip, { n: 1, until: now + WINDOW_MS })
  else e.n += 1
  // กันหน่วยความจำบวมจากบอตที่เปลี่ยน IP ไปเรื่อย ๆ
  // ⚠️ Array.from ก่อนวน — target ของโปรเจกต์นี้วน Map ตรง ๆ ไม่ได้ (tsc ฟ้อง TS2802)
  if (tries.size > 500) Array.from(tries.keys()).forEach((k) => {
    const v = tries.get(k); if (v && now > v.until) tries.delete(k)
  })
}

// POST /api/auth/login  { password }  → ตั้ง cookie gucut_auth ถ้ารหัสถูก (แอดมินหรือพนักงาน)
export async function POST(req: NextRequest) {
  const adminPass = process.env.SITE_PASSWORD
  const legacyStaffPass = process.env.STAFF_PASSWORD // รหัสพนักงานตัวเก่า (ใช้ร่วมกัน) — เก็บไว้เผื่อยังไม่ได้ย้ายมาใช้รหัสแยกคน
  if (!adminPass) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SITE_PASSWORD บน Vercel' }, { status: 500 })
  }
  const ip = whoIs(req)
  const mins = blockedFor(ip)
  if (mins > 0) {
    // ⚠️ ข้อความเดียวกับตอนรหัสผิด **ห้ามบอกว่า "ถูกพักชั่วคราว" ต่างจาก "รหัสผิด"**?
    //    ตรงนี้บอกได้ — คนพิมพ์ผิดจริงต้องรู้ว่าทำไมพิมพ์ถูกแล้วยังเข้าไม่ได้
    //    (ต่างจากหน้า /time/ ที่ห้ามแยก เพราะที่นั่นข้อความแยก = บอกว่า PIN ไหนมีตัวตน)
    return NextResponse.json(
      { error: `ใส่รหัสผิดหลายครั้ง กรุณารออีก ${mins} นาที` }, { status: 429 },
    )
  }

  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch { /* ไม่มี body */ }

  const isAdmin = password === adminPass

  /* ── ผู้ใช้ที่เพิ่มจากหน้าเว็บ (เก็บแบบย้อนกลับไม่ได้ใน Blobs) ──
     🔴 **ลองทางใหม่ก่อน แล้วค่อยตกไปทางเดิม** (คำสั่ง CEO 12 ก.ย. 2569 ข้อ 1)
        ⇒ วันที่ที่เก็บใหม่ล่ม **ไม่มีใครถูกล็อกออก** เพราะ env ยังรับอยู่เหมือนเดิมทุกคน
     ⚠️ **ทางถอยต้องประกาศตัวเมื่อถูกใช้** — เก็บเหตุผลไว้ใน storeError แล้วส่งกลับไปกับคำตอบ
        (และหน้าผู้ใช้งานอ่านจาก /api/staff-users เพื่อขึ้นแถบเตือน)
        ไม่งั้นทางถอยจะกลายเป็นทางหลักโดยไม่มีใครรู้ ([[fallbacks-must-announce]])
     ⚠️ ไม่ลองทางนี้ถ้าเป็นแอดมิน — ประหยัดเวลาแฮช และแอดมินไม่เกี่ยวกับรายชื่อนี้ */
  let webUser: { id: string; name: string } | null = null
  let storeError: string | null = null
  if (!isAdmin) {
    try {
      const u = await findStaffUserByPassword(password)
      if (u) webUser = { id: u.id, name: u.name }
    } catch (e: any) {
      storeError = String(e?.message ?? e)
    }
  }

  const staffMatch = !isAdmin && !webUser ? staffList().find(s => s.pass === password) : undefined
  const isLegacyStaff = !isAdmin && !webUser && !staffMatch && !!legacyStaffPass && password === legacyStaffPass
  if (!isAdmin && !webUser && !staffMatch && !isLegacyStaff) {
    countWrong(ip)
    /* 🔴 ข้อความเดียวเสมอ — ห้ามแยก "ไม่มีชื่อนี้" ออกจาก "รหัสผิด" และห้ามบอกว่า
       ถูกปิดการใช้งาน (คนที่ถูกปิดต้องได้ข้อความเดียวกับคนที่พิมพ์รหัสผิด) */
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }
  if (ip) tries.delete(ip) // เข้าได้แล้ว = ล้างประวัติ ไม่งั้นคนพิมพ์ผิด 4 ครั้งแล้วถูกจะโดนล็อกทีหลังแบบงง ๆ

  const role = isAdmin ? 'admin' : 'staff'
  const name = webUser ? webUser.name : staffMatch ? staffMatch.name : ''
  /* ⚠️ บอกด้วยว่าเข้าทางไหน + ทางถอยถูกใช้หรือเปล่า — คนตรวจต้องแยกได้ว่าวันนี้
     ระบบใหม่ทำงาน หรือเรากำลังอยู่บนทางถอยโดยไม่รู้ตัว */
  const via = isAdmin ? 'admin' : webUser ? 'web-user' : staffMatch ? 'env-slot' : 'env-legacy'
  const res = NextResponse.json({
    ok: true, role, name, via,
    ...(storeError ? { fallback: true, fallbackReason: `อ่านรายชื่อผู้ใช้จากที่เก็บไม่ได้ (${storeError}) — ใช้ช่อง env แทน` } : {}),
  })

  /* คุกกี้สองชนิด **โดยตั้งใจ** (อย่ายุบรวม):
       ผู้ใช้ env → ลายนิ้วมือของรหัส (ท่าเดิม ไม่แตะ) — middleware แฮชรหัสใน env มาเทียบได้
       ผู้ใช้จากหน้าเว็บ → โทเคนเซ็นชื่อ — เพราะรหัสถูกเก็บแบบย้อนกลับไม่ได้
         middleware จึงแฮชเทียบไม่ได้ ต้องตรวจด้วยลายเซ็น (ดู lib/staff-token.ts) */
  const cookie = webUser
    ? await signStaffToken({ u: webUser.id, n: webUser.name }, adminPass)
    : await authToken(password)
  res.cookies.set('gucut_auth', cookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    // ⏳ โทเคนพนักงานจากหน้าเว็บอายุสั้นกว่าโดยตั้งใจ — ยิ่งสั้น การปิดผู้ใช้ยิ่งมีผลเร็ว
    maxAge: webUser ? STAFF_TOKEN_TTL_SEC : 60 * 60 * 24 * 90,
  })
  return res
}

// DELETE /api/auth/login → ออกจากระบบ
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('gucut_auth', '', { path: '/', maxAge: 0 })
  return res
}
