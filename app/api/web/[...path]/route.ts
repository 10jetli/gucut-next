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

const ALLOW = new Set(['orders', 'live', 'chat', 'social', 'coupon', 'points', 'marketing', 'permit-doc', 'time', 'read-id', 'ai-bots', 'netlify-credits', 'status', 'legacy', 'clip-shop', 'clip-stats', 'seo-audit', 'video-pick', 'ad-stats', 'bot-rules', 'core', 'reviews-ingest', 'shopee', 'zort-archive'])

async function forward(req: NextRequest, path: string[]) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY' }, { status: 503 })
  if (!path.length || !ALLOW.has(path[0])) return NextResponse.json({ error: 'not allowed' }, { status: 403 })

  const url = new URL(req.url)
  /* 🧪 **ปลายทางปลอมสำหรับทดสอบ "จอพูดอะไรตอนของพัง" — ใช้ได้เฉพาะตอนรันในเครื่อง**
     ทำไมต้องมี: คำเตือนบนจอเกือบทุกอันเขียนไว้ว่า "ถ้าท่อล่มจะขึ้นแบบนี้"
     แต่ **ไม่เคยมีใครทำให้ท่อล่มจริงเพื่อดูว่ามันขึ้นแบบนั้นจริงไหม**
     ⇒ ตั้ง GUCUT_WEB_BASE ชี้ไปเซิร์ฟเวอร์ปลอมในเครื่อง แล้วป้อน 500 / ก้อนว่าง / ข้อมูลขาดช่อง
     🔴 **ตัวแปรนี้ถูกเมินทิ้งตอน production เสมอ** — ตั้งบน Netlify ก็ไม่มีผล
        ไม่งั้นมันจะกลายเป็นสวิตช์เปลี่ยนปลายทางของหลังร้านทั้งระบบ ซึ่งอันตรายกว่าที่ได้
     ⚠️ ⇒ ใช้ได้กับ `npm run dev` เท่านั้น · `next start` นับเป็น production จึงเมินตัวแปรนี้ */
  const base = process.env.NODE_ENV === 'production'
    ? 'https://gucut.com'
    : (process.env.GUCUT_WEB_BASE || 'https://gucut.com')
  const target = `${base}/api/${path.join('/')}${url.search}`
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
     🔴 **เคยลองแก้ cold start ด้วยการ "ปลุกล่วงหน้า" แล้ว — ล้มเหลว ถอดทิ้งไปแล้ว 6 ก.ย. 2569**
        เคยมี lib/warm.ts ยิง ?ping=1 ตอนแตะเมนู เพื่อให้คำขอจริงเจอเครื่องอุ่น
        ทดลอง **2 รอบ คนละแบบ อย่างละ 3 ครั้ง สลับลำดับ เว้นให้เย็นเท่ากัน** — ไม่เห็นผลทั้งสองรอบ
        รอบสอง: ไม่ปลุกเลย 1366ms · ปลุกด้วย ping 1604ms · ปลุกด้วยคำขอที่แตะฐาน 1428ms
        และรหัสเครื่อง (inst) ยืนยัน **12/12 คู่ตกเครื่องเดียวกัน** ⇒ ไม่ใช่เพราะไปคนละเครื่อง
        ⇒ ความอุ่นไม่ได้ช่วยอย่างที่คิด · เสียงรบกวนของการวัด (±400ms) ใหญ่กว่าผลที่ตามหา
        ⚠️ **อย่ารื้อกลับมาโดยไม่มีผลวัดใหม่ที่แยกแยะได้** — ของเดิมจ่ายค่าเรียกทุกครั้งที่แตะเมนู
           แล้วไม่ได้อะไรกลับมาเลย · (cold start มีจริง 927→426 n=16 แต่เราแตะมันไม่ได้จากข้างนอก)

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

  const out = new Headers({
    'content-type': r.headers.get('content-type') || 'application/json',
    'x-upstream-ms': String(upstreamMs),
    'x-proxy-ms': String(Date.now() - t0),
  })
  /* 🔴 **ท่อกลางสร้าง header ชุดใหม่ ⇒ header ของปลายทาง "หายทั้งหมด" โดยไม่มีอะไรฟ้อง**
     เจอก่อนของจริงจะพัง 5 ก.ย. 2569 — ฝั่งท่อกำลังจะติด x-d1-count/x-d1-ms/x-d1-max
     มากับทุกคำตอบเพื่อให้ดูได้ว่าคำขอนั้นยิง D1 กี่รอบ (เขาวัดได้ว่า **รอบละ 0.27 วิ**)
     ถ้าไม่ส่งต่อ เขาจะเห็นหัวข้อมูลตอนยิงตรงที่ gucut.com แต่**หายเกลี้ยงเมื่อดูผ่านหน้าจอ**
     แล้วสรุปผิดได้ว่า "จอไม่ได้ยิงเส้นนั้น" ทั้งที่ยิงอยู่
     ⇒ ส่งต่อทุกหัวที่ขึ้นต้นด้วย x- **ยกเว้นสองตัวที่เป็นของท่อกลางเอง** (กันปลายทางทับ)
     ⚠️ ส่งต่อแบบ "ขึ้นต้นด้วย x-" ไม่ใช่รายชื่อตายตัว — ฝั่งท่อเพิ่มหัวใหม่เมื่อไหร่
        มันไหลผ่านมาเอง ไม่ต้องมีใครจำมาแก้ไฟล์นี้ (เหตุผลเดียวกับที่ `list=` ที่ไม่รู้จัก
        ตัดสินจาก "ตกมาถึงบรรทัดท้ายสุด" ไม่ใช่จากรายชื่อ)
     ⚠️ **ห้ามส่งต่อหัวอื่นแบบเหมารวม** — set-cookie / authorization ของปลายทาง
        ไม่ควรไหลมาถึงเบราว์เซอร์ */
  const MINE = new Set(['x-upstream-ms', 'x-proxy-ms'])
  r.headers.forEach((v, k) => {
    const key = k.toLowerCase()
    if (key.startsWith('x-') && !MINE.has(key)) out.set(key, v)
  })

  return new NextResponse(body, { status: r.status, headers: out })
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
