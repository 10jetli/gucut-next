/* ป้ายกำกับขอบเขต "เลขบนจอนับเฉพาะสินค้าที่มีรหัส"
 * รัน: node scripts/tests/sku-scope.test.mjs
 *
 * 🔴 **ท่านประธานตัดสิน 18 ก.ย. 2569**: ไม่เก็บสินค้าที่ไม่มีรหัสเข้ากระจก ให้เขียนกำกับบนจอแทน
 *    CTO กำชับสามข้อที่เทสนี้คุมไว้ทีละข้อ:
 *      ② ห้ามเขียนจำนวนตายตัว — ต้องอ่านจาก `noSkuInZort` ของท่อทุกครั้ง
 *      ③ ท่อไม่ส่งจำนวนมา ⇒ **ห้ามเขียนจำนวน** (ไม่รู้จำนวน ≠ รู้ว่าเป็นศูนย์)
 *      ⑤ ประโยคเดียวกันต้องใช้ได้ทั้งบนจอและในหัวไฟล์ Excel ⇒ ต้องเป็นข้อความล้วน ไม่มีมาร์กดาวน์
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-skuscope')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

try {
  execFileSync('npx', ['tsc', 'lib/sku-scope.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { skuScopeNote } = await import(join(out, 'sku-scope.js'))

  console.log('① 🔴 รู้จำนวน ⇒ เขียนจำนวนที่ได้มา ไม่ใช่เลขที่ฝังไว้')
  {
    ok('226 ⇒ พูดถึง 226', skuScopeNote(226).includes('226'), skuScopeNote(226))
    ok('บอกด้วยว่านับเฉพาะที่มีรหัส', skuScopeNote(226).includes('เฉพาะสินค้าที่มีรหัส'))
    ok('บอกว่า ZORT นับรวมไว้ (ไม่งั้นคนจะคิดว่าของหาย)', /ZORT/.test(skuScopeNote(226)))
    /* 🔴 ข้อนี้คือด่านกันเลขตายตัว: ถ้าใครฝัง 226 ไว้ในโค้ด ค่าอื่นจะไม่เปลี่ยนตาม */
    ok('🔴 เปลี่ยนจำนวน ⇒ ข้อความต้องเปลี่ยนตาม (กันเลขตายตัว)',
      skuScopeNote(7).includes('7') && !skuScopeNote(7).includes('226'), skuScopeNote(7))
    ok('เลขหลักพันมีลูกน้ำให้อ่านง่าย', skuScopeNote(1234).includes('1,234'), skuScopeNote(1234))
  }

  console.log('② 🔴 ไม่รู้จำนวน ⇒ ห้ามเขียนจำนวน แต่ห้ามเงียบ')
  {
    for (const v of [undefined, null, 'ไม่รู้', NaN, -1, {}]) {
      const s = skuScopeNote(v)
      ok(`${JSON.stringify(v) ?? 'undefined'} ⇒ ยังบอกขอบเขต`, s.includes('เฉพาะสินค้าที่มีรหัส'), s)
      ok(`   และไม่มีตัวเลขจำนวนโผล่มา`, !/\d/.test(s), s)
    }
  }

  console.log('③ รู้ว่าเป็นศูนย์ ⇒ พูดออกมาว่าครบแล้ว (คนละเรื่องกับไม่รู้)')
  {
    const s = skuScopeNote(0)
    ok('บอกว่ามีรหัสครบทุกตัว', /ครบทุกตัว/.test(s), s)
    ok('🔴 ต้องไม่อ่านเหมือน "ไม่รู้จำนวน"', !/ไม่ได้บอก/.test(s), s)
  }

  console.log('④ ใช้ได้ทั้งบนจอและในไฟล์ CSV')
  {
    const s = skuScopeNote(226)
    ok('🔴 ไม่มี ** มาร์กดาวน์ (ข้อความนี้ลงไฟล์ CSV ด้วย)', !s.includes('**'), s)
    ok('ไม่มีขึ้นบรรทัดใหม่ (จะทำให้คอลัมน์ในไฟล์เลื่อน)', !/[\r\n]/.test(s), s)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
