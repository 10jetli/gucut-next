#!/usr/bin/env node
/* เส้น /api/bills/scan — ให้ g1 สั่งสแกนเมลของเจ้าทางเมล (15 ต.ค. 2569 · ใบ t_mv8utgnt)
 * ตรึง: ① ไม่มี/ผิด secret ⇒ 401 (เส้นนี้อยู่ใน PUBLIC_PATHS ⇒ secret คือกำแพงเดียว)
 *       ② รับเฉพาะเจ้าทางเมล ⇒ เจ้าสคริปต์/เจ้าที่ซ่อน ⇒ 400
 *       ③ คืนแค่สถานะ **ไม่คืนรายการบิล** (เส้นเดิมคืน months ทั้งก้อน)
 *       ④ ถอยไปใช้ของเก่า (staleReason) ≠ OK · พัง ⇒ 503 ไม่ใช่ 502
 * วิธี: คอมไพล์เส้นจริง + lib/vendors จริง · ปลอม next/server กับ ../vendor/route (ไม่ยิง Gmail) */
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, ค, เหตุ = '') => {
  console.log(`  ${ค ? '✅' : '❌'} ${ชื่อ}${ค ? '' : ` — ${เหตุ}`}`)
  if (!ค) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}
const เส้น = 'app/api/bills/scan/route.ts'
const ผล = คอมไพล์เพื่อทดสอบ({
  ไฟล์: [เส้น],
  ปลอม: {
    'next/server': `
export class NextRequest {
  constructor(url, init = {}) { this.url = String(url); this.nextUrl = new URL(String(url)); this._h = init.headers || {} }
  get headers() { const h = this._h; return { get: (k) => h[k.toLowerCase()] ?? null } }
}
export const NextResponse = { json: (b, init) => ({ status: init?.status ?? 200, ok: (init?.status ?? 200) < 300, async json() { return b } }) }
`,
    /* ⚠️ ตัวช่วยเติม .js ให้พาธสัมพัทธ์ก่อนแทนตัวปลอม ⇒ คีย์ต้องมี .js (ไม่งั้นคอมไพล์เส้นจริงที่ดึง pdf-parse มาด้วย) */
    '../vendor/route.js': `
export async function GET(req) {
  const mode = globalThis.__โหมดสแกน
  if (mode === 'โยน') throw new Error('boom')
  if (mode === 'พัง') return { status: 500, ok: false, async json() { return { error: 'gmail 401' } } }
  if (mode === 'เก่า') return { status: 200, ok: true, async json() { return { months: { '2026-09': [1] }, staleReason: 'token หมด' } } }
  globalThis.__vendorที่ถูกเรียก = req.nextUrl.searchParams.get('vendor')
  return { status: 200, ok: true, async json() { return { months: { '2026-09': [{ ลับ: 'ข้อมูลบิล' }] }, newMessages: true } } }
}
`,
  },
})
const { POST } = await import(ผล.พาธของ(เส้น))
const ยิง = async (vendor, secret) => {
  const headers = secret == null ? {} : { 'x-drivesync-secret': secret }
  const r = await POST({ url: `https://x/api/bills/scan?vendor=${vendor}`, nextUrl: new URL(`https://x/api/bills/scan?vendor=${vendor}`), headers: { get: (k) => headers[k.toLowerCase()] ?? null } })
  return { status: r.status, j: await r.json() }
}
process.env.DRIVESYNC_SECRET = 'ลับมาก-123'

console.log('① secret')
ok('ไม่มี secret ⇒ 401', (await ยิง('google')).status === 401)
ok('secret ผิด ⇒ 401', (await ยิง('google', 'ผิด')).status === 401)
ok('secret ยาวไม่เท่ากัน ⇒ 401 (ไม่โยน)', (await ยิง('google', 'ลับ')).status === 401)
delete process.env.DRIVESYNC_SECRET
ok('เซิร์ฟเวอร์ไม่ได้ตั้ง secret ⇒ 401 (ห้ามเปิดโล่ง)', (await ยิง('google', '')).status === 401)
process.env.DRIVESYNC_SECRET = 'ลับมาก-123'
const S = 'ลับมาก-123'

console.log('② รับเฉพาะเจ้าทางเมลที่แสดงบนหน้าบิล')
for (const v of ['google', 'apple', 'omise', 'anthropic']) {
  globalThis.__โหมดสแกน = 'ปกติ'
  const r = await ยิง(v, S); ok(`${v} ⇒ 200`, r.status === 200, JSON.stringify(r.j))
}
ok('เรียกฟังก์ชันสแกนเดิมด้วย vendor ที่ขอ', globalThis.__vendorที่ถูกเรียก === 'anthropic', globalThis.__vendorที่ถูกเรียก)
for (const v of ['meta', 'line', 'shopify', 'lazada', 'ไม่มี']) ok(`${v} ⇒ 400`, (await ยิง(v, S)).status === 400)

console.log('③ คืนแค่สถานะ ไม่คืนรายการบิล')
globalThis.__โหมดสแกน = 'ปกติ'
const ปกติ = await ยิง('google', S)
ok('status OK', ปกติ.j.status === 'OK', JSON.stringify(ปกติ.j))
ok('ไม่มี months ในคำตอบ', !('months' in ปกติ.j) && !JSON.stringify(ปกติ.j).includes('ข้อมูลบิล'))

console.log('④ สามผลไม่ยุบ · ล้ม = 503')
globalThis.__โหมดสแกน = 'เก่า'; const เก่า = await ยิง('google', S)
ok('staleReason ⇒ STALE 503 (ไม่ใช่ OK)', เก่า.status === 503 && เก่า.j.status === 'STALE', JSON.stringify(เก่า))
ok('STALE ไม่หลุด months', !('months' in เก่า.j))
globalThis.__โหมดสแกน = 'พัง'; const พัง = await ยิง('google', S)
ok('error ⇒ ERROR 503', พัง.status === 503 && พัง.j.status === 'ERROR' && พัง.j.detail.includes('gmail'), JSON.stringify(พัง))
globalThis.__โหมดสแกน = 'โยน'; const โยน = await ยิง('google', S)
ok('โยน ⇒ ERROR 503', โยน.status === 503 && โยน.j.status === 'ERROR', JSON.stringify(โยน))

console.log(ตก ? `\n🔴 ตก ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
