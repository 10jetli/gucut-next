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

const ALLOW = new Set(['orders', 'live', 'chat', 'social', 'coupon', 'points', 'marketing', 'permit-doc', 'time', 'read-id', 'ai-bots', 'netlify-credits', 'status', 'legacy', 'clip-shop', 'clip-stats', 'seo-audit', 'video-pick', 'ad-stats', 'bot-rules', 'core', 'reviews-ingest', 'shopee'])

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

  /* ⏱️ **วัดว่าท่อกลางเพิ่มเวลาไปเท่าไหร่ — ตอบคำถามที่เดาไม่ได้จากข้างนอก**
     เจ้าของร้านบอกว่า admin ช้าทุกเมนู (5 ก.ย. 2569) ฝั่งนี้รับงาน "ท่อกลางกินเวลาเท่าไหร่"
     แต่ **วัดจากข้างนอกไม่ได้** เพราะ /api/web/* ต้องล็อกอินก่อน ⇒ ให้ท่อบอกเวลาตัวเองมาเลย
       x-upstream-ms = เวลาที่รอ gucut.com ตอบ (งานจริง — ฝั่งท่อรับไปแก้)
       x-proxy-ms    = upstream + เวลาอ่าน body ออกมา
       ส่วนต่างสองตัว = ราคาของการมีท่อกลาง **เฉพาะส่วนที่โค้ดนี้เห็น**
     ⚠️ **ไม่รวมเวลาปลุกฟังก์ชัน (cold start)** เพราะนาฬิกาเริ่มจับตอนโค้ดวิ่งแล้ว
        ตัวนั้นต้องวัดจากข้างนอก: เวลาที่เบราว์เซอร์เห็น ลบด้วย x-proxy-ms
        (วัด /login จากนอก 5 ก.ย. ได้ 2.1 วิ ครั้งแรก แล้วเหลือ 0.7-0.95 วิ เมื่ออุ่น ⇒ ราว 1.2-1.4 วิ)
     ⚠️ ใส่ใน header ไม่ใช่ใน body — body เป็นของ API ปลายทาง แตะไม่ได้
        (จอบางจอ parse ตรง ๆ · เติมช่องเข้าไปคือเปลี่ยนสัญญาข้อมูลโดยไม่มีใครรู้)
     ⚠️ ไม่ log ไม่เก็บ — แค่ส่งกลับให้คนที่เปิด DevTools ดูได้ทันที */
  const t0 = Date.now()
  const r = await fetch(target, init)
  const upstreamMs = Date.now() - t0
  const body = await r.arrayBuffer()
  return new NextResponse(body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'application/json',
      'x-upstream-ms': String(upstreamMs),
      'x-proxy-ms': String(Date.now() - t0),
    },
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
