/* ทดสอบ "จำตัวกรองไว้" — รัน: node scripts/tests/remembered-filter.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ของที่จำไว้ถูกเอาไป **ใส่กลับให้ผู้ใช้โดยอัตโนมัติ**
 *    ถ้ารับของที่รูปไม่ตรงเข้ามา จอจะกรองด้วยค่าที่ไม่มีใครตั้งใจ แล้วคนอ่านตัวเลขผิดทั้งวัน
 *    และถ้าเผลอจำ "คำค้นหา" ไปด้วย คนจะเปิดจอมาเห็นแถวเดียวแล้วนึกว่าขายได้ใบเดียว
 *
 * ⚠️ localStorage ใช้ไม่ได้ก็มี (โหมดส่วนตัว/ปิดไว้) ⇒ ทุกทางต้องไม่โยน error ใส่จอ
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-remembered-filter')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/remembered-filter.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')

  /* ที่เก็บปลอม — ทดสอบตรรกะจริงโดยไม่ต้องมีเบราว์เซอร์
     ⚠️ ต้องตั้งก่อน import เพราะโมดูลอ่าน window ตอนถูกเรียก (ไม่ใช่ตอนโหลด) */
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)) },
      removeItem: (k) => { store.delete(k) },
    },
  }
  const { loadFilter, saveFilter, clearFilter, describeFilter } = await import(join(out, 'remembered-filter.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail += 1 }
  }

  const KEY = 'test:sales'
  // ① ไป-กลับได้ครบ
  saveFilter(KEY, { days: 30, store: 'z2', channel: 'TIKTOK', status: 'Success', from: '2026-09-01', to: '2026-09-15' })
  const back = loadFilter(KEY)
  ok('จำแล้วอ่านกลับได้ครบทุกช่อง',
    back?.days === 30 && back.store === 'z2' && back.channel === 'TIKTOK'
    && back.status === 'Success' && back.from === '2026-09-01' && back.to === '2026-09-15',
    JSON.stringify(back))

  // ② ไม่เคยจำ ⇒ null (ไม่ใช่ก้อนว่างที่เอาไปกรองจนได้ 0 แถว)
  ok('ยังไม่เคยจำ ⇒ null', loadFilter('test:ไม่เคยมี') === null)

  // ③ ของที่รูปไม่ตรง/รุ่นเก่า ⇒ ทิ้ง ไม่เอามาใช้
  store.set(KEY, 'ไม่ใช่ JSON')
  ok('ของเสีย (ไม่ใช่ JSON) ⇒ null ไม่โยน error', loadFilter(KEY) === null)
  store.set(KEY, JSON.stringify({ v: 999, f: { store: 'z2' } }))
  ok('รุ่นข้อมูลไม่ตรง ⇒ ทิ้ง', loadFilter(KEY) === null)
  store.set(KEY, JSON.stringify({ v: 1, f: { store: 5, days: 'abc', ของแปลก: 1 } }))
  ok('ชนิดผิด/ช่องที่ไม่รู้จัก ⇒ ไม่ไหลเข้าจอ', loadFilter(KEY) === null)

  // ④ 🔴 ห้ามจำคำค้นหา — ต่อให้มีคนยัดมาก็ต้องไม่หลุดออกไป
  store.set(KEY, JSON.stringify({ v: 1, f: { store: 'z1', q: 'SO-123' } }))
  const noQ = loadFilter(KEY)
  ok('คำค้นหาที่ถูกยัดมา ไม่ถูกส่งต่อ', noQ && noQ.store === 'z1' && !('q' in noQ), JSON.stringify(noQ))

  // ⑤ ล้างแล้วต้องหายจริง
  saveFilter(KEY, { store: 'z2' })
  clearFilter(KEY)
  ok('ล้างแล้วอ่านได้ null', loadFilter(KEY) === null)

  // ⑥ เขียน/อ่านไม่ได้เลย (โหมดส่วนตัว) ⇒ เงียบ ไม่โยน
  globalThis.window = {
    localStorage: {
      getItem() { throw new Error('ปิดการเก็บข้อมูล') },
      setItem() { throw new Error('ปิดการเก็บข้อมูล') },
      removeItem() { throw new Error('ปิดการเก็บข้อมูล') },
    },
  }
  let threw = false
  try { saveFilter(KEY, { store: 'z1' }); loadFilter(KEY); clearFilter(KEY) } catch { threw = true }
  ok('ที่เก็บใช้ไม่ได้ ⇒ ไม่โยน error ใส่จอ', !threw)
  ok('ที่เก็บใช้ไม่ได้ ⇒ อ่านได้ null', loadFilter(KEY) === null)

  // ⑦ คำอธิบายบนจอต้องเป็นภาษาคน และไม่พูดถึงค่าที่เท่ากับค่าตั้งต้น
  const d = describeFilter({ days: 90, store: 'z2', channel: 'TIKTOK' }, { days: 90 })
  ok('ค่าที่เท่าค่าตั้งต้นไม่ต้องประกาศ', !d.join(' ').includes('90 วัน'), JSON.stringify(d))
  ok('ค่าที่ต่างจากตั้งต้นต้องประกาศครบ',
    d.some((s) => s.includes('z2')) && d.some((s) => s.includes('TIKTOK')), JSON.stringify(d))
  // 🔴 ป้ายที่จอส่งมามีคำว่า "ร้าน" อยู่แล้ว ⇒ ต้องไม่ได้ "ร้าน หน้าร้าน (z2)"
  const withLabel = describeFilter({ store: 'z2' }, { days: 90 }, { store: (v) => `หน้าร้าน (${v})` })
  ok('มีตัวแปลป้าย ⇒ ไม่เติมคำว่า "ร้าน" ซ้ำ', withLabel[0] === 'หน้าร้าน (z2)', JSON.stringify(withLabel))
  const noLabel = describeFilter({ store: 'z2' }, { days: 90 })
  ok('ไม่มีตัวแปลป้าย ⇒ ยังบอกว่าเป็นร้าน', noLabel[0] === 'ร้าน z2', JSON.stringify(noLabel))
  ok('ไม่มีของที่จำไว้ ⇒ ไม่มีอะไรให้ประกาศ', describeFilter(null, { days: 90 }).length === 0)
} finally {
  rmSync(out, { recursive: true, force: true })
}
if (fail) { console.error(`\n❌ จำตัวกรองไว้: ไม่ผ่าน ${fail} ข้อ`); process.exit(1) }
console.log('✅ จำตัวกรองไว้: ผ่านทุกข้อ')
