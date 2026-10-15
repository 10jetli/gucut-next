#!/usr/bin/env node
/* เส้น /api/bills/run-all — ปุ่ม "ดึงบิลทั้งหมด" (15 ต.ค. 2569)
 *
 * 🔴 ล้มฝั่ง g1 ต้องตอบ **503 ไม่ใช่ 502** — 502 เป็นรหัสเดียวที่ขอบของ Netlify แทน body ทิ้ง
 *    (วัด 4 ต.ค. 2569: 8 รหัส body รอดครบ ยกเว้น 502 ⇒ 16 ไบต์ text/plain)
 *    ⇒ ถ้าตอบ 502 จอเห็นแค่รหัสเปล่า "คีย์ไม่ตรง" กับ "g1 ล่ม" กลายเป็นอาการเดียว ทั้งที่ทางแก้ตรงข้าม
 * 🔑 และจอตัดสินจากช่อง (upstreamOk · ชนิด · retryable) ⇒ เทสตรึงว่าแต่ละเหตุได้ช่องของตัวเอง
 *
 * วิธี: คอมไพล์เส้นจริง + lib/bills-g1 จริง · ปลอมแค่ next/server กับ globalThis.fetch (ฝั่ง g1)
 * ⇒ ของจริงที่ถูกทดสอบ = การแปลงคำตอบ g1 เป็นรหัส/ช่อง · ของปลอม = g1 เอง
 */
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}
const เส้นTS = 'app/api/bills/run-all/route.ts'
const ผล = คอมไพล์เพื่อทดสอบ({
  ไฟล์: [เส้นTS],
  ปลอม: {
    'next/server': `
export const NextResponse = {
  json: (ก้อน, init) => ({ status: init?.status ?? 200, async json() { return ก้อน } }),
}
`,
  },
})
const { GET, POST } = await import(ผล.พาธของ(เส้นTS))

/** ตั้งให้ g1 ตอบแบบที่ต้องการ · null = ติดต่อไม่ได้ */
const ตั้งg1 = (status, body) => {
  globalThis.fetch = async () => {
    if (status === null) throw new Error('getaddrinfo ENOTFOUND')
    return { ok: status >= 200 && status < 300, status, async json() { return body } }
  }
}
const ยิง = async (fn) => { const r = await fn(); return { status: r.status, j: await r.json() } }

process.env.GUCUT_WEB_ADMIN_KEY = 'คีย์ทดสอบ'
const เคส = [
  ['คีย์ไม่ตรง (g1 ตอบ 403)', 403, {}, 'คีย์ไม่ตรง', false],
  ['คีย์ไม่ตรง (g1 ตอบ 401)', 401, {}, 'คีย์ไม่ตรง', false],
  ['g1 ตอบ 500', 500, {}, 'g1ตอบผิดปกติ', true],
  ['ติดต่อ g1 ไม่ได้', null, null, 'ติดต่อg1ไม่ได้', true],
]
for (const [ชื่อ, st, body, ชนิด, ลองใหม่] of เคส) {
  console.log(`① ${ชื่อ}`)
  ตั้งg1(st, body)
  for (const [ป้าย, fn] of [['POST', POST], ['GET', GET]]) {
    const { status, j } = await ยิง(fn)
    ok(`${ป้าย} ตอบ 503 (ไม่ใช่ 502)`, status === 503, String(status))
    ok(`${ป้าย} upstreamOk = false`, j.upstreamOk === false, JSON.stringify(j.upstreamOk))
    ok(`${ป้าย} ชนิด = ${ชนิด}`, j.ชนิด === ชนิด, String(j.ชนิด))
    ok(`${ป้าย} retryable = ${ลองใหม่}`, j.retryable === ลองใหม่, String(j.retryable))
  }
}

console.log('② ไม่มีคีย์ ⇒ ชนิด ไม่มีคีย์ (คนละชนิดกับ คีย์ไม่ตรง) และลองใหม่ไม่หาย')
delete process.env.GUCUT_WEB_ADMIN_KEY
ตั้งg1(200, {})
for (const [ป้าย, fn] of [['POST', POST], ['GET', GET]]) {
  const { status, j } = await ยิง(fn)
  ok(`${ป้าย} ตอบ 503`, status === 503, String(status))
  ok(`${ป้าย} ชนิด = ไม่มีคีย์`, j.ชนิด === 'ไม่มีคีย์', String(j.ชนิด))
  ok(`${ป้าย} retryable = false`, j.retryable === false, String(j.retryable))
}

console.log('③ ตัวควบคุมลบ — g1 ปกติ ⇒ 200 + upstreamOk true')
process.env.GUCUT_WEB_ADMIN_KEY = 'คีย์ทดสอบ'
ตั้งg1(200, { ok: true, msg: 'started', บิล: { รอบกวาด: null, รายเจ้า: {} } })
{
  const p = await ยิง(POST)
  ok('POST 200', p.status === 200, String(p.status))
  ok('POST upstreamOk true', p.j.upstreamOk === true)
  const g = await ยิง(GET)
  ok('GET 200', g.status === 200, String(g.status))
  ok('GET upstreamOk true', g.j.upstreamOk === true)
}

console.log('④ g1 ตอบ 200 แต่ไม่มีช่อง บิล ⇒ ถูกตัดทอน ไม่ใช่ปกติ')
ตั้งg1(200, { ping: 'ok' })
{
  const g = await ยิง(GET)
  ok('GET 503', g.status === 503, String(g.status))
  ok('ชนิด = คำตอบถูกตัดทอน', g.j.ชนิด === 'คำตอบถูกตัดทอน', String(g.j.ชนิด))
}

console.log(ตก ? `\n🔴 ตก ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: g1 ปลอม — ไม่ได้พิสูจน์ว่าขอบของ Netlify ส่ง body ของ 503 ถึงจอจริง (นั่นมาจากการวัด 4 ต.ค.)')
process.exit(ตก ? 1 : 0)
