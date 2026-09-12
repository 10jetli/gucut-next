// ── เส้นจัดการผู้ใช้งานที่เพิ่มจากหน้าเว็บ — เฉพาะแอดมิน ──────────────────────────
//
// GET    → รายชื่อ (ไม่มี salt/hash และไม่มีเงาของรหัสเลย) + บอกว่าที่เก็บอ่านได้ไหม
// POST   { name, password }      → เพิ่ม
// PATCH  { id, active }          → ปิด/เปิดการใช้งาน
// DELETE ?id=…                   → ลบบันทึกทิ้ง (มีไว้เก็บบัญชีทดสอบ — คนจริงให้ "ปิด" พอ)
//
// 🔴 **ด่านแอดมินตรวจสองชั้นโดยตั้งใจ**
//    ชั้นแรก: middleware — พนักงานเข้าได้เฉพาะ prefix ที่อนุญาต เส้นนี้ไม่อยู่ในนั้น
//    ชั้นสอง: ในไฟล์นี้เทียบคุกกี้กับลายนิ้วมือของ SITE_PASSWORD เอง
//    ⇒ วันที่มีคนแก้ allowlist ของ middleware แล้วเผลอปล่อยเส้นนี้หลุด จะยังไม่พัง
//       (เส้นที่ "สร้างผู้ใช้ใหม่ได้" คือเส้นที่ห้ามพึ่งด่านเดียว)
//
// 🔴 **ห้ามส่งรหัสกลับ ห้าม log รหัส** — ทุกทางออกผ่าน publicView() ของ lib/staff-users.ts
//    และข้อความผิดพลาดห้ามมีเนื้อรหัสติดไป (เช่นห้ามเขียนว่า "รหัส abc สั้นเกินไป")
import { NextRequest, NextResponse } from 'next/server'
import { authToken, sameToken } from '@/lib/auth-token'
import { listStaffUsers, addStaffUser, setStaffUserActive, removeStaffUser, MAX_USERS } from '@/lib/staff-users'

export const dynamic = 'force-dynamic'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const adminPass = (process.env.SITE_PASSWORD ?? '').trim()
  if (!adminPass) return false
  const auth = req.cookies.get('gucut_auth')?.value
  return !!auth && sameToken(auth, await authToken(adminPass))
}
const deny = () => NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 })

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return deny()
  try {
    return NextResponse.json({ ok: true, users: await listStaffUsers(), max: MAX_USERS })
  } catch (e: any) {
    /* 🔴 อ่านที่เก็บไม่ได้ ≠ ไม่มีผู้ใช้ — ต้องบอกให้จอขึ้นแถบเตือน ห้ามคืนรายการว่างเฉย ๆ
       (วันนั้นการล็อกอินจะตกไปใช้ช่อง env ซึ่งเส้นล็อกอินประกาศไว้แล้วว่าใช้ทางถอย) */
    return NextResponse.json({ ok: false, storeError: String(e?.message ?? e), users: null, max: MAX_USERS }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return deny()
  let body: any = null
  try { body = await req.json() } catch { /* ไม่มี body */ }
  const name = String(body?.name ?? '')
  const password = String(body?.password ?? '')
  try {
    const r = await addStaffUser(name, password)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, user: r.user })
  } catch (e: any) {
    return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${String(e?.message ?? e)}` }, { status: 503 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) return deny()
  let body: any = null
  try { body = await req.json() } catch { /* ไม่มี body */ }
  const id = String(body?.id ?? '')
  if (!id || typeof body?.active !== 'boolean') {
    return NextResponse.json({ error: 'ต้องส่ง id และ active (true/false)' }, { status: 400 })
  }
  try {
    const ok = await setStaffUserActive(id, body.active)
    if (!ok) return NextResponse.json({ error: 'ไม่พบผู้ใช้นี้' }, { status: 404 })
    /* ⏳ บอกความจริงเรื่องเวลาที่มีผล — ห้ามให้จอเขียนว่า "ออกจากระบบทันที" ถ้าไม่จริง */
    return NextResponse.json({
      ok: true,
      note: body.active
        ? 'เปิดใช้งานแล้ว — ล็อกอินได้ทันที'
        : 'ปิดแล้ว — ล็อกอินครั้งใหม่ถูกปฏิเสธทันที · เครื่องที่ยังค้างล็อกอินอยู่จะหลุดเมื่อโทเคนหมดอายุ (ไม่เกิน 8 ชั่วโมง)',
    })
  } catch (e: any) {
    return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${String(e?.message ?? e)}` }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) return deny()
  const id = String(new URL(req.url).searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'ต้องมี ?id=' }, { status: 400 })
  try {
    const ok = await removeStaffUser(id)
    if (!ok) return NextResponse.json({ error: 'ไม่พบผู้ใช้นี้' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: `ลบไม่สำเร็จ: ${String(e?.message ?? e)}` }, { status: 503 })
  }
}
