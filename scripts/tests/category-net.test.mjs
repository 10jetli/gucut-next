/* ตาข่ายข้ามแหล่งของจอหมวดสินค้า — รัน: node scripts/tests/category-net.test.mjs
 *
 * 🔴 ของเดิมในจอเป็น tautology (เทียบผลบวกกับผลบวกของตัวเอง) ⇒ เขียวตลอดกาล
 *    และคอมเมนต์เรียกตัวเองว่า "ตาข่ายข้ามแหล่ง" ⇒ CEO คัดมาแก้เพราะ **ป้ายมันโกหก**
 *    "ตาข่ายที่ไม่มีคมยังพอทน แต่ตาข่ายที่ทำให้คนเลิกหาตาข่ายจริง อันตรายกว่าไม่มีเลย"
 *
 * ⚠️ ตัวเลขในเทสนี้เป็นของจริงที่วัดไว้ 12 ก.ย. 2569 (2,672 + 226 = 2,898)
 *    ⇒ ถ้าวันหนึ่งของจริงเปลี่ยน เทสยังถูกอยู่ เพราะเทสตรวจ **กติกา** ไม่ได้ตรึงของจริง
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'catnet-'))
execFileSync('npx', ['tsc', 'lib/category-net.ts', '--outDir', out,
  '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'es2020,dom'],
  { cwd: process.cwd(), stdio: 'inherit' })
writeFileSync(join(out, 'package.json'), '{"type":"module"}')
const { categoryCoverage } = await import(join(out, 'category-net.js'))

let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

console.log('① ของจริงวันนี้: 2,672 + 226 = 2,898 ⇒ ครบ')
{
  const c = categoryCoverage({ sumSkus: 2672, zortTotal: 2898, noSkuInZort: 226 })
  ok('สถานะ ok', c.state === 'ok', JSON.stringify(c))
  ok('ส่วนต่างเป็นศูนย์', c.gap === 0)
}

console.log('② คลังเงาขาดสินค้าไป ⇒ ต้องฟ้อง (นี่คือของที่ตาข่ายเดิมจับไม่ได้เลย)')
{
  /* จำลอง: ท่อนับหมวดได้น้อยลง 50 รหัส (GROUP BY พลาด / แถวหาย / คิวรีเริ่มตัด)
     ⚠️ ตาข่ายเดิมจะเขียว เพราะมันเทียบผลบวกกับผลบวกของตัวเอง */
  const c = categoryCoverage({ sumSkus: 2622, zortTotal: 2898, noSkuInZort: 226 })
  ok('สถานะ gap', c.state === 'gap', JSON.stringify(c))
  ok('บอกว่าขาด 50 รหัส', c.gap === 50, String(c.gap))
}

console.log('③ ZORT เพิ่มสินค้าใหม่แต่กระจกยังไม่ดึงมา ⇒ ต้องฟ้อง')
{
  const c = categoryCoverage({ sumSkus: 2672, zortTotal: 2950, noSkuInZort: 226 })
  ok('สถานะ gap', c.state === 'gap')
  ok('ขาด 52 รหัส', c.gap === 52, String(c.gap))
}

console.log('④ เรามีเกินกว่าที่ ZORT บอก ⇒ ต้องฟ้องเหมือนกัน (ทิศกลับด้านก็คือผิด)')
{
  const c = categoryCoverage({ sumSkus: 2700, zortTotal: 2898, noSkuInZort: 226 })
  ok('สถานะ gap', c.state === 'gap')
  ok('ส่วนต่างเป็นลบ (เกิน)', (c.gap ?? 0) < 0, String(c.gap))
}

console.log('⑤ 🔴 ยังตรวจไม่ได้ ⇒ ต้องไม่ใช่ ok และต้องไม่ใช่ gap')
{
  for (const [label, input] of [
    ['ไม่มีเลขฝั่ง ZORT เลย', { sumSkus: 2672 }],
    ['zortTotal เป็น null', { sumSkus: 2672, zortTotal: null, noSkuInZort: 226 }],
    ['รู้ยอดรวมแต่ไม่รู้จำนวนที่ไม่มีรหัส', { sumSkus: 2672, zortTotal: 2898 }],
    ['zortTotal เป็นข้อความ', { sumSkus: 2672, zortTotal: '2898', noSkuInZort: 226 }],
  ]) {
    const c = categoryCoverage(input)
    ok(`${label} ⇒ unknown`, c.state === 'unknown', JSON.stringify(c))
  }
  /* 🔑 ข้อที่สำคัญที่สุดของกอง ⑤: "รู้ยอดรวมแต่ไม่รู้จำนวนไร้รหัส" ต้องไม่เติม 0 ให้
     เพราะเติม 0 = เดาว่าไม่มีสินค้าไร้รหัสเลย ซึ่งของจริงมี 226 ตัว
     ⇒ ผลที่ได้จะกลายเป็น "ขาด 226 รหัส" = แดงทั้งที่ระบบปกติ ⇒ คนจะปิดตาข่ายทิ้ง */
  const wrong = categoryCoverage({ sumSkus: 2672, zortTotal: 2898 })
  ok('🔴 ห้ามเติม 0 แทนจำนวนที่ไม่มีรหัส (จะกลายเป็นแดงทั้งที่ปกติ)', wrong.gap === null, String(wrong.gap))
}

rmSync(out, { recursive: true, force: true })
console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ตก ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
