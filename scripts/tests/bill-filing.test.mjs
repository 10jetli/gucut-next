/* เดือนที่ใช้จัดแฟ้มบิล ต้องมาจาก "รอบบิลในเอกสาร" ไม่ใช่ชื่อไฟล์
 * รัน: node scripts/tests/bill-filing.test.mjs
 *
 * 🔴 **ท่านประธานสั่ง 18 ก.ย. 2569** และ CTO ขอเทสข้อนี้ไว้ตรง ๆ:
 *    "ต้องมีเทสที่ป้อนไฟล์ชื่อ 2026-07 ที่ในใบเป็น 2026-06 แล้วยืนยันว่าจัดเข้า 06
 *     และถ้าใครแก้กลับไปใช้ชื่อไฟล์ เทสต้องแดง"
 *
 * ⚠️ เทสนี้ยิง **ของจริงสองชั้น** ไม่ใช่ชั้นเดียว:
 *    ชั้นที่ 1 `filingMonthOf()` — ตัวตัดสินเดือน
 *    ชั้นที่ 2 `billFilingMonth()` — ตัวอ่านรอบบิลจากข้อความในใบ (ใช้ข้อความจริงของ Adobe)
 *    เพราะถ้าเทสชั้นเดียว วันที่ตัวอ่านพัง เทสจะยังเขียวอยู่ทั้งที่ของจริงจัดผิดเดือน
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-filing')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

try {
  execFileSync('npx', ['tsc', 'lib/bill-filing.ts', 'lib/bill-identity.ts', 'lib/bill-text.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  /* tsc คง import เป็น './bill-text' (ไม่มีนามสกุล) ตามสไตล์ที่ Next ต้องใช้ แต่ Node ESM ต้องมี .js
     ⇒ เติมให้ตอนรันเทส ไม่แก้ที่ไฟล์จริง (เหมือน bill-identity.test.mjs) */
  const ident = join(out, 'bill-identity.js')
  writeFileSync(ident, readFileSync(ident, 'utf8').replace(/from '\.\/bill-text'/g, "from './bill-text.js'"))
  const { filingMonthOf, filingNote, splitRealName } = await import(join(out, 'bill-filing.js'))
  const { billFilingMonth } = await import(ident)

  console.log('① 🔴 เคสจริงที่ทำให้ต้องแก้ — Adobe ใบ 3480010335')
  {
    /* ข้อความรูปนี้มาจากใบจริง (เก็บเฉพาะรูปแบบ ไม่ใช่เลขที่เอกสารจริงทั้งใบ) */
    const ในใบ = 'Invoice Date 01-JUL-2026\nBilling Period 01-JUN-2026 to 30-JUN-2026\nTotal 1,070.00'
    const รอบบิล = billFilingMonth(ในใบ)
    ok('ตัวอ่านรู้ว่ารอบบิลคือ 2026-06 (ไม่ใช่วันที่ออกใบ 2026-07)',
      รอบบิล.month === '2026-06' && รอบบิล.source === 'รอบบิลที่พิมพ์ในใบ', JSON.stringify(รอบบิล))

    const c = filingMonthOf('2026-07_REAL_Adobe_invoice.pdf', รอบบิล.month)
    ok('🔴 ชื่อไฟล์ 2026-07 + ในใบ 2026-06 ⇒ ต้องจัดเข้า 2026-06', c.month === '2026-06', JSON.stringify(c))
    ok('   และต้องบอกได้ว่าตัดสินจากอะไร', c.from === 'รอบบิลในเอกสาร', c.from)
    ok('   และต้องติดธงว่าชื่อไฟล์ไม่ตรงกับเดือนที่จัด', c.mismatch === true)
    ok('   และมีข้อความกำกับให้เอาขึ้นจอ (กันคนรอบหน้าแก้กลับ)',
      /2026-07/.test(filingNote(c) ?? '') && /2026-06/.test(filingNote(c) ?? '') && /ตั้งใจ/.test(filingNote(c) ?? ''),
      String(filingNote(c)))
  }

  console.log('② 🔴 ด่านกันคนแก้กลับไปใช้ชื่อไฟล์')
  {
    /* ถ้าใครเปลี่ยน filingMonthOf ให้ชื่อไฟล์ชนะ ข้อนี้จะแดงทันที
       (เขียนแยกเป็นข้อของตัวเอง เพื่อให้ข้อความตอนแดงบอกตรง ๆ ว่าละเมิดคำสั่งข้อไหน) */
    const c = filingMonthOf('2026-12_REAL_x.pdf', '2026-01')
    ok('🔴 ชื่อไฟล์ห้ามชนะรอบบิลในเอกสาร ไม่ว่ากรณีใด (คำสั่งท่านประธาน 18 ก.ย. 2569)',
      c.month === '2026-01', JSON.stringify(c))
  }

  console.log('③ อ่านเอกสารไม่ได้ = ยังไม่รู้ ⇒ ถอยไปใช้ชื่อไฟล์ ไม่ใช่ทิ้งไฟล์')
  {
    const c = filingMonthOf('2026-07_REAL_scan.pdf', null)
    ok('ไม่รู้รอบบิล ⇒ ใช้ชื่อไฟล์ไปก่อน', c.month === '2026-07' && c.from === 'ชื่อไฟล์', JSON.stringify(c))
    ok('   และไม่ติดธงว่าไม่ตรง (เพราะยังไม่มีอะไรให้เทียบ)', c.mismatch === false)
    ok('   ⇒ ไม่มีข้อความกำกับ', filingNote(c) === null)
    const ว่าง = filingMonthOf('ไฟล์ที่ไม่ใช่รูป REAL.pdf', null)
    ok('ชื่อไฟล์ไม่ใช่รูป YYYY-MM_REAL_ และไม่รู้รอบบิล ⇒ ตอบว่าไม่รู้ ห้ามเดาเดือน',
      ว่าง.month === null && ว่าง.from === 'ไม่รู้', JSON.stringify(ว่าง))
  }

  console.log('④ ค่าที่ผิดรูปต้องไม่ถูกนับเป็นเดือน')
  {
    ok('รอบบิลรูปแบบเพี้ยน ⇒ ไม่เอามาใช้ (ถอยไปชื่อไฟล์)',
      filingMonthOf('2026-07_REAL_x.pdf', 'มิถุนายน 2026').month === '2026-07')
    ok('splitRealName แยกชื่อจริงออกได้',
      splitRealName('2026-07_REAL_a b.pdf').rest === 'a b.pdf')
    ok('ตรงกันอยู่แล้ว ⇒ ไม่ติดธง',
      filingMonthOf('2026-06_REAL_x.pdf', '2026-06').mismatch === false)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
