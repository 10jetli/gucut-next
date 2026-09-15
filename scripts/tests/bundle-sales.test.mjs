/* ทดสอบยอดขายรายเดือนของสินค้าเป็นชุด — รัน: node scripts/tests/bundle-sales.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ตรรกะนี้ตัดสินว่าจอจะพูดว่า **"ขายได้ 0 บาท"** หรือ **"ยังไม่รู้"**
 *    ซึ่งเป็นคนละเรื่องกันคนละทิศ — พูดผิดข้างเดียวก็ทำให้คนตัดสินใจผิด:
 *      · ข้อมูลไม่ครบแล้วขึ้น 0  ⇒ คนเชื่อว่าชุดนี้ขายไม่ออก (ของจริงอาจขายดี แต่แถวโดนตัด)
 *      · ไม่มีแถวแล้วขึ้น "ยังไม่รู้" ⇒ คนไม่กล้าใช้ตัวเลขทั้งจอ ทั้งที่ของจริงคือไม่ได้ขายจริง ๆ
 *    และมีกับดักของจริงอีกข้อ: บัตรสต็อกส่ง `qty` ของการขายมาเป็น **ค่าติดลบ**
 *
 * 🔑 เรียกฟังก์ชันตัวจริงที่จอใช้ (แปลง lib/bundle-sales.ts ด้วย tsc ของโปรเจกต์)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-bundle-sales')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/bundle-sales.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { sumMonth, monthlySeries, salesComplete, lastSaleDate, monthLabel } =
    await import(join(out, 'bundle-sales.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail += 1 }
  }

  /* แถวจริงของชุด 03409-3 (ยิงจาก ?list=stockcard&kind=sale 15 ก.ย. 2569 · ตัดเลขที่ใบ/ชื่อลูกค้าออก) */
  const rows = [
    { date: '2026-09-09', status: 'Success', qty: -1, amount: 169.2 },
    { date: '2026-09-01', status: 'Success', qty: -1, amount: 169.2 },
    { date: '2026-07-31', status: 'Success', qty: -1, amount: 170 },
    { date: '2026-07-28', status: 'Success', qty: -1, amount: 180 },
    { date: '2025-04-10', status: 'Waiting', qty: -1, amount: 170 },
    { date: '2025-04-09', status: 'Waiting', qty: -1, amount: 180 },
  ]
  const full = { hasMore: false, truncated: false, failed: [] }

  // ① ตรงกับเลขที่ ZORT เองตอบผ่าน topproducts (2 ชิ้น / 338.40 บาท) — นี่คือหลักฐานที่ผูกสองแหล่งเข้าด้วยกัน
  const sep = sumMonth(rows, full, '2026-09')
  ok('ก.ย. 2569 = 338.40 บาท เท่ากับที่ topproducts ตอบ', Math.abs(sep.amount - 338.4) < 0.001, `ได้ ${sep.amount}`)
  ok('ก.ย. 2569 = 2 ชิ้น (qty ติดลบต้องกลับเป็นบวก)', sep.qty === 2, `ได้ ${sep.qty}`)

  // ② เดือนที่ไม่มีแถว ทั้งที่ข้อมูลครบ ⇒ ศูนย์จริง ไม่ใช่ "ยังไม่รู้"
  const aug = sumMonth(rows, full, '2026-08')
  ok('เดือนที่ไม่มีแถว + ข้อมูลครบ ⇒ 0 (ไม่ใช่ null)', aug.amount === 0 && aug.qty === 0)

  // ③ ข้อมูลไม่ครบ ⇒ ต้องเป็น null ทุกกรณี ห้ามกลายเป็น 0
  for (const [name, meta] of [
    ['ท่อบอกว่ายังมีอีก (hasMore)', { hasMore: true, truncated: false, failed: [] }],
    ['ท่อตัดแถว (truncated)', { hasMore: false, truncated: true, failed: [] }],
    ['อ่านบางแหล่งไม่ได้ (failed)', { hasMore: false, truncated: false, failed: ['orders'] }],
    ['ไม่มี meta เลย', null],
  ]) {
    const r = sumMonth(rows, meta, '2026-09')
    ok(`${name} ⇒ ยังไม่รู้ (null) ไม่ใช่ 0`, r.amount === null && r.qty === null, `ได้ ${r.amount}`)
  }
  ok('อ่านแถวไม่ได้เลย (null) ⇒ null', sumMonth(null, full, '2026-09').amount === null)
  ok('salesComplete: ครบ ⇒ true', salesComplete(full) === true)
  ok('salesComplete: failed ไม่ว่าง ⇒ false', salesComplete({ failed: ['x'] }) === false)

  // ④ ใบยกเลิกต้องไม่ถูกนับเป็นเงิน และต้องนับจำนวนที่ตัดออกไว้ให้จอบอกได้
  const withVoid = sumMonth([...rows, { date: '2026-09-15', status: 'Voided', qty: -5, amount: 9999 }], full, '2026-09')
  ok('ใบยกเลิกไม่ถูกบวกเป็นยอดขาย', Math.abs(withVoid.amount - 338.4) < 0.001, `ได้ ${withVoid.amount}`)
  ok('ใบยกเลิกถูกนับแยกไว้บอกบนจอ', withVoid.voided === 1)

  // ⑤ กราฟ 6 เดือน — เดือนล่าสุดอยู่ขวาสุด และเดือนที่ไม่มีแถวเป็น 0 เมื่อข้อมูลครบ
  const series = monthlySeries(rows, full, new Date(2026, 8, 15), 6)
  ok('กราฟได้ 6 เดือน', series.length === 6, `ได้ ${series.length}`)
  ok('เดือนขวาสุดคือเดือนปัจจุบัน', series[5].key === '2026-09')
  ok('เดือนซ้ายสุดคือ 5 เดือนก่อน', series[0].key === '2026-04')
  ok('ก.ค. ในกราฟ = 350', Math.abs(series[3].amount - 350) < 0.001, `ได้ ${series[3].amount}`)
  ok('พ.ค. ที่ไม่มีการขาย = 0 ไม่ใช่ null', series[1].amount === 0)
  const unknownSeries = monthlySeries(rows, { truncated: true }, new Date(2026, 8, 15), 6)
  ok('ข้อมูลไม่ครบ ⇒ ทั้ง 6 เดือนเป็น null', unknownSeries.every((s) => s.amount === null))

  // ⑥ ป้ายเดือนเป็น พ.ศ. ไม่ใช่ ค.ศ.
  ok('ป้ายเดือน ก.ย. 2026 ⇒ "ก.ย. 69"', monthLabel(2026, 8) === 'ก.ย. 69', monthLabel(2026, 8))
  ok('วันขายล่าสุด = 2026-09-09', lastSaleDate(rows) === '2026-09-09', String(lastSaleDate(rows)))
  ok('ไม่มีแถว ⇒ ไม่มีวันขายล่าสุด', lastSaleDate([]) === null)
} finally {
  rmSync(out, { recursive: true, force: true })
}
if (fail) { console.error(`\n❌ ยอดขายรายเดือนของชุด: ไม่ผ่าน ${fail} ข้อ`); process.exit(1) }
console.log('✅ ยอดขายรายเดือนของชุด: ผ่านทุกข้อ')
