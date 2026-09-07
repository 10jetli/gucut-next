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

export const dynamic = 'force-dynamic'

/** พารามิเตอร์หลักที่จอรับคืนใช้ — อย่างอื่น 403 ทั้งหมด */
const PRIMARY_GET = ['return', 'order'] as const
const PRIMARY_POST = ['return-receive', 'return-grade', 'return-photo', 'return-takeover'] as const
/** พารามิเตอร์ประกอบที่ยอมให้ติดมา (ต่อเมื่อมีพารามิเตอร์หลักถูกต้องแล้ว) */
const EXTRA_OK = new Set(['q', 'from', 'to', 'limit', 'list'])

function pickPrimary(u: URL, method: string): string | null {
  if (u.searchParams.get('list') === 'returns-inbox') return 'list=returns-inbox'
  if (method === 'GET' && u.searchParams.get('list') === 'orders') {
    const q = (u.searchParams.get('q') ?? '').trim()
    /* ค้นเท่านั้น ห้าม browse — คำค้นสั้น/ว่าง = เจอครึ่งร้าน */
    return q.length >= 3 ? 'list=orders' : null
  }
  const pool = method === 'POST' ? PRIMARY_POST : PRIMARY_GET
  for (const k of pool) if (u.searchParams.get(k)) return k
  return null
}

async function forward(req: NextRequest) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY' }, { status: 503 })

  const u = new URL(req.url)
  const primary = pickPrimary(u, req.method)
  if (!primary) {
    return NextResponse.json(
      { error: 'ท่อนี้เปิดเฉพาะเส้นจอรับคืนสินค้า (และค้นใบขายต้องมีคำค้นอย่างน้อย 3 ตัว)' },
      { status: 403 })
  }
  /* พารามิเตอร์แปลกปลอม = ปฏิเสธทั้งคำขอ — กันคนพ่วงเส้นอื่นมากับคำขอที่หน้าตาถูก */
  for (const k of Array.from(u.searchParams.keys())) {
    const known = (PRIMARY_GET as readonly string[]).includes(k)
      || (PRIMARY_POST as readonly string[]).includes(k) || EXTRA_OK.has(k)
    if (!known) return NextResponse.json({ error: `พารามิเตอร์ไม่รู้จัก: ${k}` }, { status: 403 })
  }

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
