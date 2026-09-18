// เส้นจด/อ่านสมุดการส่งออกไฟล์ — ดูเหตุผลทั้งหมดที่ lib/export-log.ts
//
// 🔒 **อยู่หลังด่านล็อกอินเหมือนจอ** (กติกาข้อ ⑤ ของท่านประธาน) — middleware ครอบ /api/*
//    ทั้งหมดอยู่แล้ว ยกเว้น /api/auth และ /api/google ⇒ เส้นนี้ยิงจากนอกระบบไม่ได้
//    ⚠️ **ห้ามย้ายไปไว้ใต้ /api/auth** ไม่ว่าด้วยเหตุผลใด
//
// POST — จดหนึ่งบรรทัด (จอเรียกเองหลังไฟล์ออก) · ไม่รับชื่อคนจากตัวจอ **อ่านจากคุกกี้เท่านั้น**
//        (ถ้ารับชื่อจากตัวจอ ใครก็พิมพ์ชื่อคนอื่นลงสมุดได้ ⇒ สมุดที่โกหกได้ใช้สืบไม่ได้)
// GET  — อ่านย้อนหลัง **เฉพาะแอดมิน** (พนักงานเห็นไม่ได้ว่าใครส่งออกอะไร)
import { NextRequest, NextResponse } from 'next/server'
import { authToken, sameToken } from '@/lib/auth-token'
import { isStaffToken, verifyStaffToken } from '@/lib/staff-token'
import { logExport, readExportLog } from '@/lib/export-log'

export const dynamic = 'force-dynamic'

/** ใครกดอยู่ · `admin` = รหัสหลักของร้าน (ใช้ร่วมกันหลายคน ⇒ ชี้ตัวคนไม่ได้ ห้ามเดา) */
async function whois(req: NextRequest): Promise<{ who: string; admin: boolean }> {
  const adminPass = process.env.SITE_PASSWORD
  const auth = req.cookies.get('gucut_auth')?.value
  if (auth && adminPass && sameToken(auth, await authToken(adminPass))) {
    return { who: 'แอดมิน (รหัสหลักของร้าน — แยกเป็นรายคนไม่ได้)', admin: true }
  }
  if (auth && isStaffToken(auth) && adminPass) {
    const claims = await verifyStaffToken(auth, adminPass)
    if (claims) return { who: claims.n || `ผู้ใช้ ${claims.u}`, admin: false }
  }
  /* ผ่าน middleware มาได้แต่เราระบุตัวไม่ได้ (รหัสพนักงานที่ตั้งจาก env)
     ⇒ **เขียนว่าไม่รู้ ห้ามเขียนว่าแอดมิน** */
  return { who: 'ไม่ทราบผู้ใช้ (ล็อกอินด้วยรหัสที่ตั้งไว้ใน env)', admin: false }
}

export async function POST(req: NextRequest) {
  const { who } = await whois(req)
  let body: { screen?: unknown; scope?: unknown; rows?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'อ่าน body ไม่ได้' }, { status: 400 })
  }
  const ok = await logExport({
    at: new Date().toISOString(),
    who,
    screen: String(body.screen ?? '(ไม่ระบุจอ)'),
    scope: body.scope == null ? null : String(body.scope),
    rows: Number(body.rows ?? 0),
  })
  /* จดไม่ได้ก็ตอบ 200 — ตัวเรียกไม่ได้รอผลอยู่แล้ว และไฟล์ถึงมือผู้ใช้ไปแล้ว
     แต่ **บอกความจริงในคำตอบ** ว่าจดไม่ได้ เผื่อมีคนมาไล่ดูทีหลัง */
  return NextResponse.json({ ok, note: ok ? null : 'ยังไม่ได้ตั้งที่เก็บ (Blobs) หรือเก็บไม่สำเร็จ' })
}

export async function GET(req: NextRequest) {
  const { admin } = await whois(req)
  if (!admin) return NextResponse.json({ error: 'เฉพาะแอดมิน' }, { status: 403 })
  const rows = await readExportLog(300)
  /* 🔴 อ่านไม่ได้ ≠ ไม่มีบันทึก — แยกให้จอเขียนถูก */
  if (rows === null) return NextResponse.json({ rows: null, unknown: true })
  return NextResponse.json({ rows, unknown: false })
}
