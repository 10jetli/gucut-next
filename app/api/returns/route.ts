// ท่อกลางเฉพาะจอรับคืนสินค้า — /api/returns?<เส้นเดียวกับ /api/core>
//
// ทำไมต้องมีท่อแยกจาก /api/web/core (ร่าง /returns v2 ข้อ 6 — ผ่านเวทีถกสามเสียง):
// พนักงานหน้าร้านต้องใช้จอรับคืนบนมือถือด้วย**รหัสรายคน** แต่ /api/web/* เปิดให้เฉพาะแอดมิน
// เปิด /api/web ทั้งก้อนให้ staff = พนักงานเห็นยอดขาย/ต้นทุน/คูปองทั้งระบบ ⇒ 🔴 ห้าม
// ⇒ ท่อนี้ whitelist **เฉพาะพารามิเตอร์ที่จอรับคืนใช้จริง** แล้ว middleware เปิดให้ staff
//    (STAFF_ALLOWED_PREFIXES มี /api/returns — เพิ่มพร้อมไฟล์นี้)
//
// ⚠️ กติกา whitelist: เช็ค "พารามิเตอร์หลักหนึ่งตัวต่อคำขอ" ไม่ใช่เช็คว่าคำต้องห้ามไม่อยู่
//    (default-deny — พารามิเตอร์ที่ไม่รู้จัก = 403 ไม่ใช่ปล่อยผ่าน)
// ⚠️ list=orders ผ่านท่อนี้**ต้องมีคำค้น ≥ 3 ตัว** — จอใช้ค้นใบเพื่อรับคืนเท่านั้น
//    ไม่ใส่เงื่อนไขนี้ = พนักงานเปิดดูรายการขายทั้งร้านย้อนหลังได้ (เกินหน้าที่จอนี้)
// ⚠️ x-staff-pin ส่งต่อให้ปลายทางแปลงเป็นชื่อเอง — ห้ามรับ/ส่งชื่อจาก body (ตกลงกับท่อ)
import { NextRequest, NextResponse } from 'next/server'
/* 🔑 ตัวตัดสินพารามิเตอร์ย้ายไป lib/returns-gate.ts แล้ว — เพื่อให้เทสยิงตัวจริงได้
   (28 ก.ย. 2569 · ใบ B08 — จอ /returns ถูกท่อนี้ปฏิเสธมา 21 วันโดยไม่มีด่านไหนฟ้อง) */
import { ตัดสินคำขอ } from '@/lib/returns-gate'

export const dynamic = 'force-dynamic'

async function forward(req: NextRequest) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY' }, { status: 503 })

  const u = new URL(req.url)
  const ผล = ตัดสินคำขอ(u, req.method)
  if (!ผล.ผ่าน) return NextResponse.json({ error: ผล.เหตุ }, { status: 403 })

  /* dev override เดียวกับท่อกลางหลัก — production เมินตัวแปรเสมอ (เหตุผลเต็มใน /api/web) */
  const base = process.env.NODE_ENV === 'production'
    ? 'https://gucut.com'
    : (process.env.GUCUT_WEB_BASE || 'https://gucut.com')
  const target = `${base}/api/core${u.search}`

  const headers: Record<string, string> = {
    'x-admin-key': key,
    'content-type': req.headers.get('content-type') || 'application/json',
  }
  const pin = req.headers.get('x-staff-pin')
  if (pin) headers['x-staff-pin'] = pin

  const init: RequestInit = { method: req.method, headers, signal: AbortSignal.timeout(25000) }
  if (req.method === 'POST') init.body = await req.text()

  try {
    const res = await fetch(target, init)
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    })
  } catch (e) {
    /* หมดเวลา/ต่อไม่ติด — บอกตรง ๆ ให้จอแยก "ท่อพัง" ออกจาก "ปลายทางปฏิเสธ" ได้ */
    return NextResponse.json(
      { error: `ต่อหลังร้านเว็บไม่ได้: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 })
  }
}

export async function GET(req: NextRequest) { return forward(req) }
export async function POST(req: NextRequest) { return forward(req) }
