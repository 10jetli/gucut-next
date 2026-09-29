#!/usr/bin/env node
/* ท่อกลางของจอรับคืนสินค้า (`app/api/returns/route.ts`) — **เส้นเดียวที่พนักงานหน้าร้านใช้ได้**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · คิวตามเกณฑ์ของใบ: แตะเงิน/สต็อก · กอง T2)
 *
 * 🔑 ทำไมเส้นนี้สำคัญเป็นพิเศษ
 *    /api/web/* เปิดให้เฉพาะแอดมิน · เปิดทั้งก้อนให้พนักงาน = เห็นยอดขาย ต้นทุน คูปองทั้งระบบ
 *    ⇒ เส้นนี้จึง whitelist เฉพาะพารามิเตอร์ที่จอรับคืนใช้ แล้ว middleware เปิดให้ staff
 *    ⇒ **รูที่นี่ = พนักงานเห็นข้อมูลเกินหน้าที่** ไม่ใช่แค่จอพัง
 *
 * 🔑 **ใช้ `lib/returns-gate.ts` ตัวจริง ไม่ปลอม** — ตัวตัดสินมีเทสของตัวเองอยู่แล้ว
 *    สิ่งที่ยังไม่มีใครตรวจคือ **เส้นนี้เชื่อคำตัดสินนั้นจริงไหม**
 *    (ของจริง 28 ก.ย. 2569 · ใบ B08: จอ /returns ถูกท่อนี้ปฏิเสธมา 21 วันโดยไม่มีด่านไหนฟ้อง)
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① ไม่ได้ตั้ง `GUCUT_WEB_ADMIN_KEY` ⇒ **503 พร้อมบอกว่าอะไรขาด** ไม่ใช่ส่งต่อแบบไม่มีกุญแจ
 *    ② ตัวตัดสินปฏิเสธ ⇒ **403 พร้อมเหตุ** (default-deny · พารามิเตอร์ที่ไม่รู้จักคือปฏิเสธ)
 *    ③ 🔴 **production ต้องเมิน `GUCUT_WEB_BASE`** — ถ้าไม่เมิน จอจริงถูกเบนไปท่อปลอมได้
 *    ④ ต้องแนบ `x-admin-key` ไปปลายทาง และ **กุญแจต้องไม่หลุดกลับไปหาผู้เรียก**
 *    ⑤ ส่งต่อตัวตนพนักงานเป็น **หัวข้อความ** เท่านั้น · ไม่มีหัว ⇒ ไม่ส่งหัวเปล่า
 *    ⑥ ต่อปลายทางไม่ได้ ⇒ **502 พร้อมข้อความที่แยก "ท่อพัง" ออกจาก "ปลายทางปฏิเสธ"**
 *    ⑦ สถานะจากปลายทางต้องผ่านมาตามจริง ห้ามเขียนทับเป็น 200
 */
import { rmSync } from 'node:fs'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นTS = 'app/api/returns/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นTS],
    ปลอม: {
      /* ปลอมแค่ชั้นเปลือกของ Next — NextResponse ต้องใช้ได้ทั้งแบบ .json และแบบ new */
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; this.headers = new Headers(init?.headers) }
  async text() { return this.body }
  static json(ก้อน, init) {
    const r = new NextResponse(JSON.stringify(ก้อน), init)
    r.ก้อน = ก้อน
    return r
  }
}
`,
    },
  })
  งาน = ผล.ที่ออก
  const { GET, POST } = await import(ผล.พาธของ(เส้นTS))

  /** คำขอปลอม — เส้นนี้อ่าน url · method · headers · text() */
  const คำขอ = (qs, { method = 'GET', หัว = {}, body = '' } = {}) => ({
    url: `https://admin.gucut.com/api/returns${qs}`,
    method,
    headers: new Headers(หัว),
    async text() { return body },
  })
  let ยิงไป = []
  const ตั้งปลายทาง = (ตอบ) => {
    ยิงไป = []
    globalThis.fetch = async (u, init) => { ยิงไป.push({ url: String(u), init }); return ตอบ() }
  }
  const ตอบดี = (สถานะ = 200, เนื้อ = '{"ok":true}') => () => ({
    status: สถานะ, headers: new Headers({ 'content-type': 'application/json' }), async text() { return เนื้อ },
  })
  const เดิมkey = process.env.GUCUT_WEB_ADMIN_KEY
  const เดิมenv = process.env.NODE_ENV
  const เดิมbase = process.env.GUCUT_WEB_BASE

  console.log('① 🔴 ไม่ได้ตั้งกุญแจ ⇒ 503 พร้อมบอกว่าอะไรขาด (ไม่ส่งต่อแบบไม่มีกุญแจ)')
  {
    delete process.env.GUCUT_WEB_ADMIN_KEY
    ตั้งปลายทาง(ตอบดี())
    const r = await GET(คำขอ('?list=returns-inbox'))
    ok('ได้ 503', r.status === 503, String(r.status))
    ok('บอกชื่อตัวแปรที่ขาด', /GUCUT_WEB_ADMIN_KEY/.test(JSON.stringify(r.ก้อน)), JSON.stringify(r.ก้อน))
    ok('ไม่ยิงปลายทางเลย', ยิงไป.length === 0,
      `ยิงไป ${ยิงไป.length} ครั้ง ⇒ ส่งคำขอออกไปโดยไม่มีกุญแจ = ปลายทางเห็นคำขอที่ยืนยันตัวตนไม่ได้`)
    process.env.GUCUT_WEB_ADMIN_KEY = 'กุญแจทดสอบ'
  }

  console.log('② 🔴 ตัวตัดสิน (ของจริง) ปฏิเสธ ⇒ 403 พร้อมเหตุ และห้ามยิงปลายทาง')
  {
    ตั้งปลายทาง(ตอบดี())
    const r = await GET(คำขอ('?list=orders&days=30'))
    ok('ได้ 403', r.status === 403, String(r.status))
    ok('มีเหตุเป็นข้อความ', typeof r.ก้อน?.error === 'string' && r.ก้อน.error.length > 3, JSON.stringify(r.ก้อน))
    ok('ไม่ยิงปลายทาง', ยิงไป.length === 0, `ยิงไป ${ยิงไป.length} ⇒ ปฏิเสธแล้วยังส่งต่อ = whitelist ไม่มีผล`)
    /* ตัวควบคุมลบ — คำขอที่ตัวตัดสินอนุญาต ต้องผ่านและยิงปลายทางจริง */
    ตั้งปลายทาง(ตอบดี())
    const ผ่าน = await GET(คำขอ('?list=returns-inbox'))
    ok('คำขอที่อนุญาต ⇒ ผ่านและยิงปลายทาง', ผ่าน.status === 200 && ยิงไป.length === 1,
      `สถานะ ${ผ่าน.status} · ยิงไป ${ยิงไป.length}`)
  }

  console.log('③ 🔴 production ต้องเมิน GUCUT_WEB_BASE — ไม่งั้นจอจริงถูกเบนไปท่อปลอมได้')
  {
    process.env.GUCUT_WEB_BASE = 'http://127.0.0.1:8130'
    process.env.NODE_ENV = 'production'
    ตั้งปลายทาง(ตอบดี())
    await GET(คำขอ('?list=returns-inbox'))
    ok('production ยิงไป gucut.com', ยิงไป[0].url.startsWith('https://gucut.com/api/core'),
      `${ยิงไป[0].url} ⇒ production เชื่อ env ⇒ ข้อมูลจริงถูกเบนไปที่อื่นได้`)
    process.env.NODE_ENV = 'development'
    ตั้งปลายทาง(ตอบดี())
    await GET(คำขอ('?list=returns-inbox'))
    ok('dev ใช้ค่า override ได้ (ตัวควบคุมลบของข้อนี้)',
      ยิงไป[0].url.startsWith('http://127.0.0.1:8130/api/core'), ยิงไป[0].url)
    if (เดิมbase === undefined) delete process.env.GUCUT_WEB_BASE; else process.env.GUCUT_WEB_BASE = เดิมbase
    if (เดิมenv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = เดิมenv
  }

  console.log('④ กุญแจต้องไปกับคำขอ และต้องไม่หลุดกลับไปหาผู้เรียก')
  {
    ตั้งปลายทาง(ตอบดี())
    const r = await GET(คำขอ('?list=returns-inbox'))
    const หัว = ยิงไป[0].init.headers
    ok('แนบ x-admin-key ไปปลายทาง', หัว['x-admin-key'] === 'กุญแจทดสอบ', JSON.stringify(หัว['x-admin-key']))
    const กลับ = JSON.stringify({ body: r.body, headers: [...r.headers.entries()] })
    ok('กุญแจไม่หลุดกลับไปในคำตอบ', !กลับ.includes('กุญแจทดสอบ'), กลับ.slice(0, 140))
  }

  console.log('⑤ ตัวตนพนักงานส่งเป็นหัวข้อความ · ไม่มีหัว ⇒ ไม่ส่งหัวเปล่า')
  {
    ตั้งปลายทาง(ตอบดี())
    await GET(คำขอ('?list=returns-inbox', { หัว: { 'x-staff-pin': '4321' } }))
    ok('ส่งต่อ x-staff-pin', ยิงไป[0].init.headers['x-staff-pin'] === '4321',
      JSON.stringify(ยิงไป[0].init.headers['x-staff-pin']))
    ตั้งปลายทาง(ตอบดี())
    await GET(คำขอ('?list=returns-inbox'))
    ok('ไม่มี PIN ⇒ ไม่ส่งหัวเลย (ไม่ใช่หัวค่าว่าง)', !('x-staff-pin' in ยิงไป[0].init.headers),
      'ส่งหัวค่าว่าง ⇒ ปลายทางอ่านได้ว่ายืนยันตัวตนแล้วว่าเป็นคนไม่มีชื่อ')
  }

  console.log('⑥ 🔴 ต่อปลายทางไม่ได้ ⇒ 502 พร้อมข้อความที่แยก "ท่อพัง" ออกจาก "ปลายทางปฏิเสธ"')
  {
    ตั้งปลายทาง(() => { throw new Error('The operation was aborted due to timeout') })
    const r = await GET(คำขอ('?list=returns-inbox'))
    ok('ได้ 502 ไม่ใช่ 403 หรือ 500', r.status === 502, String(r.status))
    ok('บอกว่าต่อหลังร้านเว็บไม่ได้', /ต่อหลังร้านเว็บไม่ได้/.test(JSON.stringify(r.ก้อน)), JSON.stringify(r.ก้อน))
    ok('อ้างข้อความจริงของความผิดพลาด', /timeout/.test(JSON.stringify(r.ก้อน)),
      `${JSON.stringify(r.ก้อน)} ⇒ ไม่บอกเหตุ = จอแยกไม่ออกว่าหมดเวลาหรือถูกปฏิเสธ`)
  }

  console.log('⑦ สถานะจากปลายทางต้องผ่านมาตามจริง ห้ามเขียนทับเป็น 200')
  {
    for (const st of [400, 401, 409, 500]) {
      ตั้งปลายทาง(ตอบดี(st, '{"error":"ปลายทางว่าไม่ได้"}'))
      const r = await GET(คำขอ('?list=returns-inbox'))
      ok(`ปลายทาง ${st} ⇒ ส่งต่อ ${st}`, r.status === st, String(r.status))
    }
    ตั้งปลายทาง(ตอบดี(200, '{"ok":true}'))
    const p = await POST(คำขอ('?return-receive=1', { method: 'POST', body: '{"items":[]}' }))
    ok('POST ส่ง body ต่อไปครบ', ยิงไป[0].init.body === '{"items":[]}', String(ยิงไป[0].init.body))
    ok('POST ได้สถานะจากปลายทาง', p.status === 200, String(p.status))
  }

  if (เดิมkey === undefined) delete process.env.GUCUT_WEB_ADMIN_KEY; else process.env.GUCUT_WEB_ADMIN_KEY = เดิมkey
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอม next/server กับ fetch — **ตัวตัดสินพารามิเตอร์เป็นของจริง**'
  + ' (lib/returns-gate.ts) · ไม่ได้ทดสอบว่า middleware เปิดให้ staff จริง ซึ่งเป็นคนละชั้น')
process.exit(ตก ? 1 : 0)
