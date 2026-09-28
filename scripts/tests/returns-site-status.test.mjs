/* ใบคืนจากเว็บหน้าร้าน: คำตอบแต่ละรูปต้องถูกแปลว่าอะไร — รัน: node scripts/tests/returns-site-status.test.mjs
 *
 * 🔴 **ที่มา (ใบ B08 · 28 ก.ย. 2569)** — ท่อ `/api/returns-feed` ของฝั่งเว็บมีทางออกฉุกเฉิน
 *    `catch { return json({ list: [] }) }` ⇒ **อ่านคลังใบคืนไม่ได้ ⇒ ตอบ HTTP 200 + list ว่าง**
 *    ⇒ ฝั่งจอเห็นคำตอบที่ถูกต้องทุกประการ แล้วบวกเข้ายอด 0 ใบ
 *    ⇒ **ยอดคืนทั้งหน้าต่ำกว่าจริง โดยไม่มีอะไรแดงเลย**
 *    วัดของจริงวันนี้: `GET https://gucut.com/api/returns-feed?days=30`
 *    ⇒ `{"list":[],"unreadable":0,"qtyUnreadableLines":0,...}` (ทางปกติ **มีตัวนับ**)
 *
 * 🔑 เกณฑ์ที่ใช้แยก: ท่อเขียนสัญญาไว้เองว่า **ตัวนับส่งมาเสมอ ต่อให้เป็น 0**
 *    ⇒ ไม่มี `unreadable` เป็นตัวเลข = ไม่ใช่คำตอบปกติ ⇒ **ห้ามนับเป็นศูนย์**
 *    ⚠️ ต้นตอจริงอยู่ในรีโปท่อ (แก้ที่นั่นคนละใบ) — ฝั่งนี้กันได้แค่ "ไม่เชื่อคำตอบที่ผิดสัญญา"
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-returns-site')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

try {
  /* เรียกฟังก์ชันตัวจริงที่จอใช้ ไม่ได้เลียนแบบตรรกะ */
  execFileSync('npx', ['tsc', 'lib/returns.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  /* tsc (moduleResolution bundler) พิมพ์ `from './format'` แบบไม่มีนามสกุล ⇒ node หาไฟล์ไม่เจอ
     ⇒ เติม `.js` ให้เส้นทางภายในทุกไฟล์ที่เพิ่งแปลง (ไฟล์ทิ้งทั้งโฟลเดอร์ตอนจบ) */
  for (const f of readdirSync(out).filter((x) => x.endsWith('.js'))) {
    const ที่ = join(out, f)
    writeFileSync(ที่, readFileSync(ที่, 'utf8').replace(/(from\s+['"]\.\/[^'"]+)(['"])/g, '$1.js$2'))
  }
  const { ตัดสินคำตอบฟีด } = await import(join(out, 'returns.js'))

  const ใบ = { number: 'W-1', ref: 'W-1', date: '2026-09-20', channel: 'GUCUT', amount: 500, lines: [] }

  console.log('① ทางปกติ — มีตัวนับมาด้วย (ต่อให้ 0 ใบ)')
  {
    const r = ตัดสินคำตอบฟีด({ list: [], unreadable: 0, qtyUnreadableLines: 0, priceUnreadableLines: 0 })
    ok('ไม่มีใบคืนจริง ⇒ ถือว่าอ่านได้', r.status.ok === true, JSON.stringify(r.status))
    ok('นับได้ 0 ใบ', r.status.orders === 0 && r.list.length === 0)
    ok('ตัวนับเป็น 0 ไม่ใช่ null', r.status.unreadable === 0)
  }
  {
    const r = ตัดสินคำตอบฟีด({ list: [ใบ, ใบ], unreadable: 2, qtyUnreadableLines: 1, priceUnreadableLines: 3 })
    ok('มีใบคืน 2 ใบ ⇒ อ่านได้', r.status.ok === true && r.status.orders === 2)
    ok('ส่งต่อจำนวนใบที่ฝั่งเว็บอ่านไม่ได้', r.status.unreadable === 2)
    ok('ส่งต่อบรรทัดที่อ่านจำนวน/ราคาไม่ได้', r.status.qtyUnreadableLines === 1 && r.status.priceUnreadableLines === 3)
  }

  console.log('② 🔴 ทางออกฉุกเฉินของท่อ — 200 + list ว่าง แต่ไม่มีตัวนับ (คือบั๊ก B08)')
  {
    const r = ตัดสินคำตอบฟีด({ list: [] })
    ok('🔴 ห้ามแปลว่า "ไม่มีใบคืน"', r.status.ok === false, JSON.stringify(r.status))
    ok('เหตุต้องพูดถึงตัวนับที่ขาด', /ตัวนับ/.test(String(r.status.reason)), String(r.status.reason))
    ok('🔴 ตัวนับต้องเป็น null (ไม่รู้) ไม่ใช่ 0', r.status.unreadable === null)
    ok('ไม่เอาใบใด ๆ เข้ายอด', r.list.length === 0)
  }

  console.log('③ รูปคำตอบที่เพี้ยนอย่างอื่น ต้องไม่ผ่านเช่นกัน')
  {
    for (const [ชื่อ, j] of [
      ['ก้อนว่าง {}', {}],
      ['null', null],
      ['list เป็นสตริง', { list: 'ไม่มี', unreadable: 0 }],
      ['list เป็นก้อน (สัญญาเก่าที่ไม่มีอยู่จริง)', { list: { rows: [] }, unreadable: 0 }],
      ['ตัวนับเป็นสตริง "0"', { list: [], unreadable: '0' }],
    ]) {
      const r = ตัดสินคำตอบฟีด(j)
      ok(`🔴 ${ชื่อ} ⇒ ไม่ผ่าน`, r.status.ok === false && r.list.length === 0, JSON.stringify(r.status))
    }
  }

  console.log('④ ตัวควบคุม — สองทิศต้องตอบต่างกันจริง (ไม่ใช่ปฏิเสธทุกอย่าง)')
  {
    const ผ่าน = ตัดสินคำตอบฟีด({ list: [ใบ], unreadable: 0 })
    const ตก = ตัดสินคำตอบฟีด({ list: [ใบ] })
    ok('มีตัวนับ ⇒ ผ่าน · ไม่มีตัวนับ ⇒ ไม่ผ่าน', ผ่าน.status.ok === true && ตก.status.ok === false,
      `${ผ่าน.status.ok} / ${ตก.status.ok}`)
    ok('🔴 ใบที่มาพร้อมคำตอบผิดสัญญา ต้องไม่ถูกนับเข้ายอด', ตก.list.length === 0 && ตก.status.orders === 0)
  }

  console.log('⑤ ขา ZORT — คำตอบที่ไม่มีช่อง list คือ "ถามไม่สำเร็จ" ไม่ใช่ "ไม่มีใบคืน"')
  {
    const { ตัดสินคำตอบZORT } = await import(join(out, 'returns.js'))
    ok('ตอบมาพร้อม list ⇒ ถามสำเร็จ', ตัดสินคำตอบZORT({ list: [], count: 0 }).ok === true)
    const ตก = ตัดสินคำตอบZORT({ status: 401, description: 'apikey ไม่ถูกต้อง' })
    ok('🔴 ตอบ JSON ปฏิเสธ (ไม่มี list) ⇒ ถามไม่สำเร็จ', ตก.ok === false, JSON.stringify(ตก))
    ok('เหตุต้องยกคำที่ ZORT ตอบมาให้เห็น', /apikey/.test(String(ตก.reason)), String(ตก.reason))
    ok('🔴 ก้อนว่าง ⇒ ถามไม่สำเร็จ (ไม่ใช่ 0 ใบ)', ตัดสินคำตอบZORT({}).ok === false)
    ok('🔴 null ⇒ ถามไม่สำเร็จ', ตัดสินคำตอบZORT(null).ok === false)
    ok('list เป็นก้อน ⇒ ถามไม่สำเร็จ', ตัดสินคำตอบZORT({ list: { rows: [] } }).ok === false)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
