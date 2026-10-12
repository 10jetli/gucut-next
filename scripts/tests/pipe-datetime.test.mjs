/* ทดสอบตัวแปลงเวลาจากท่อ — รัน: node scripts/tests/pipe-datetime.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ฝั่งท่อเพิ่งเสียเวลาทั้งเช้าของ 19 ก.ย. 2569 กับคลาสนี้
 *    (`at` เก็บเป็น ISO มี `T` แต่เทียบกับ `datetime('now')` ที่ใช้เว้นวรรค
 *     ⇒ `T` > ช่องว่างเสมอ ⇒ ตัวกรองชั่วโมงกลายเป็นรายวัน
 *     และตัวเตือนรหัสค้างตัวเดียวกันนี้ **เตือนน้อยกว่าความจริง**)
 *
 * 🔑 ฝั่งจอมีสำเนาของการแปลงนี้ 9 จุด เขียนกัน 4 แบบ และ **ล้มไม่เหมือนกัน**
 *    เทสนี้ตรึงพฤติกรรมของตัวกลาง เพื่อให้ทุกจุดที่ย้ายมาใช้ได้คำตอบเดียวกัน
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-pipe-datetime')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/format.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { มิลลิวินาทีจากท่อ } = await import(join(out, 'format.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }
  const เท่ากับ = (v, iso) => มิลลิวินาทีจากท่อ(v) === Date.parse(iso)

  console.log('① สามรูปแบบที่ท่อส่งมาจริง — ต้องได้เวลาเดียวกันเมื่อมันหมายถึงเวลาเดียวกัน')
  {
    ok('เว้นวรรค ไม่มีโซน ⇒ ถือเป็น UTC',
      เท่ากับ('2026-09-19 02:20:14', '2026-09-19T02:20:14Z'),
      String(มิลลิวินาทีจากท่อ('2026-09-19 02:20:14')))
    ok('ISO มี Z ⇒ ใช้ตามนั้น',
      เท่ากับ('2026-09-19T02:20:14.199Z', '2026-09-19T02:20:14.199Z'))
    ok('ISO มีออฟเซ็ต ⇒ เคารพออฟเซ็ต (ไม่ใช่เหมาเป็น UTC)',
      เท่ากับ('2026-09-19T02:20:14+07:00', '2026-09-18T19:20:14Z'))
    ok('เว้นวรรคกับ ISO ที่หมายถึงเวลาเดียวกัน ⇒ ต้องเท่ากัน',
      มิลลิวินาทีจากท่อ('2026-09-19 02:20:14') === มิลลิวินาทีจากท่อ('2026-09-19T02:20:14Z'))
  }

  console.log('② 🔴 ท่าที่ผิดสองแบบที่เจอในโค้ดจริง — ตัวกลางต้องไม่ทำแบบนั้น')
  {
    /* แบบ "เติม Z เสมอ": `${v.replace(' ','T')}Z` ⇒ ค่า ISO กลายเป็น …ZZ ⇒ Invalid Date */
    ok('ค่า ISO ต้องไม่กลายเป็น Invalid Date', มิลลิวินาทีจากท่อ('2026-09-19T02:20:14.199Z') !== null)
    /* แบบ "ไม่เติม Z เลย": ค่าเว้นวรรคถูกอ่านเป็นเวลาท้องถิ่น ⇒ เพี้ยนตามโซนของเครื่อง */
    ok('ค่าเว้นวรรคต้องไม่ถูกอ่านเป็นเวลาท้องถิ่น',
      มิลลิวินาทีจากท่อ('2026-09-19 02:20:14') === Date.parse('2026-09-19T02:20:14Z'))
  }

  console.log('③ 🔴 อ่านไม่ออก ⇒ null ไม่ใช่ 0 และไม่ใช่ NaN (0 = 1 ม.ค. 1970 ซึ่งดูเหมือนเวลาจริง)')
  {
    ok('ว่าง ⇒ null', มิลลิวินาทีจากท่อ('') === null)
    ok('null/undefined ⇒ null', มิลลิวินาทีจากท่อ(null) === null && มิลลิวินาทีจากท่อ(undefined) === null)
    ok('ข้อความที่ไม่ใช่เวลา ⇒ null', มิลลิวินาทีจากท่อ('ไม่ใช่เวลา') === null)
    ok('ไม่คืน NaN', !Number.isNaN(มิลลิวินาทีจากท่อ('ของเสีย')))
  }

  console.log('④ ช่องว่างหัวท้ายจากท่อ ไม่ควรทำให้อ่านไม่ออก')
  {
    ok('มีช่องว่างหน้า-หลัง ⇒ ยังอ่านได้',
      เท่ากับ('  2026-09-19 02:20:14  ', '2026-09-19T02:20:14Z'))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}
console.log(fail ? `\n🛑 ตก ${fail} ข้อ` : '\n✅ ตัวแปลงเวลาจากท่อผ่านครบ')
process.exit(fail ? 1 : 0)
