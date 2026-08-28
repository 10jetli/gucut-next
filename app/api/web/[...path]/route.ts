// ท่อกลางไปหลังร้านเว็บ (gucut.com) — /api/web/<เส้นทาง>
//
// ส่วนหนึ่งของงาน "รวมหลังร้านเป็นเนื้อเดียวแท้ ๆ" (เจ้าของร้านสั่ง 28 ส.ค. 2569)
// หน้าเนทีฟในโดเมนนี้เรียกท่อนี้ → ท่อส่งต่อไป gucut.com/api/<เส้นทาง>
// พร้อมรหัสหลังร้านเว็บจาก env — รหัสไม่เคยหลุดถึงเบราว์เซอร์
//
// ⚠️ middleware.ts คุมล็อกอินให้แล้ว (ทุกเส้นทางที่ไม่อยู่ใน PUBLIC_PATHS)
// ⚠️ อนุญาตเฉพาะ API ที่หน้าเนทีฟใช้จริง — เพิ่มหน้าใหม่ต้องมาเพิ่มรายการที่นี่
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOW = new Set(['orders', 'live', 'chat', 'social', 'coupon', 'points', 'marketing', 'permit-doc', 'time', 'read-id', 'ai-bots', 'netlify-credits'])

async function forward(req: NextRequest, path: string[]) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY' }, { status: 503 })
  if (!path.length || !ALLOW.has(path[0])) return NextResponse.json({ error: 'not allowed' }, { status: 403 })

  const url = new URL(req.url)
  const target = `https://gucut.com/api/${path.join('/')}${url.search}`
  const init: RequestInit = {
    method: req.method,
    headers: { 'x-admin-key': key, 'content-type': req.headers.get('content-type') || 'application/json' },
    signal: AbortSignal.timeout(25000),
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await req.text()

  const r = await fetch(target, init)
  const body = await r.arrayBuffer()
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
  })
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path)
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path)
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path)
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path)
}
