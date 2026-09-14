/* ทดสอบ thaiDate — รัน: node scripts/tests/thai-date.test.mjs
 *
 * 🔴 **ที่มา (14 ก.ย. 2569 · ใบ t_mu11ncpo)**: จอใบสั่งผลิตโชว์กำหนดส่งเป็น
 *    `2026-03-19T17:00:00.000Z` ดิบ ๆ ⇒ อ่านไม่ออก และถ้าใครอ่านเอาเองจะได้ 19 มี.ค.
 *    ทั้งที่ค่านั้นคือ **เที่ยงคืนวันที่ 20 มี.ค. เวลาไทย** — กำหนดส่งที่ผิดไปหนึ่งวัน
 *    คือเรื่องที่คนเอาไปนัดกับโรงงานจริง
 *
 * ⚠️ **ตัวแปลงนี้ต้องทำสองอย่างที่ขัดกัน** ⇒ จึงต้องมีเทสคุม:
 *    · ค่าที่มีเวลา+โซน = "จุดเวลา" ⇒ **ต้องแปลงเป็นเวลาไทยก่อน**
 *    · ค่าที่เป็นวันที่เปล่า (yyyy-MM-dd) = "วันที่" อยู่แล้ว ⇒ **ห้ามคิดโซน** (จะเลื่อนกลับทาง)
 *    ทำถูกแค่ทางเดียวคือผิดอีกทางเสมอ
 *
 * 🔑 **เทสนี้เรียกฟังก์ชันตัวจริงที่จอใช้** ไม่ได้เลียนแบบตรรกะ
 *    (แปลง lib/format.ts ด้วย tsc ของโปรเจกต์ แบบเดียวกับ excel-rows.test.mjs)
 *    เหตุผล: โปรเจกต์นี้เจ็บมาแล้วจากเทสที่เลียนแบบ — เขียวทั้งที่ของจริงพัง
 *    ⇒ ตอนแรกเขียนเทสนี้แบบคัดลอกตรรกะ แล้วย้าย thaiDate จาก .tsx มาไว้ที่ lib/format.ts
 *      เพื่อให้เรียกตัวจริงได้ (14 ก.ย. 2569)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-thai-date')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/format.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { thaiDate } = await import(join(out, 'format.js'))

  const cases = [
    ['2026-03-19T17:00:00.000Z', '20 มี.ค. 2569', 'เที่ยงคืนเวลาไทย — ของเดิมได้ 19 (เลื่อนไปหนึ่งวัน)'],
    ['2026-03-19T16:59:59.000Z', '19 มี.ค. 2569', 'ก่อนเที่ยงคืนไทย 1 วินาที ต้องยังเป็น 19 (เคสขอบที่จับ off-by-one)'],
    ['2026-09-14', '14 ก.ย. 2569', 'วันที่เปล่า — ห้ามคิดโซนเวลา ไม่งั้นเลื่อนกลับทาง'],
    ['2026-12-31T17:00:00.000Z', '1 ม.ค. 2570', 'ข้ามปี (ต้องข้ามทั้ง ค.ศ. และ พ.ศ.)'],
    ['2026-03-19T00:00:00+07:00', '19 มี.ค. 2569', 'ค่าที่บอกโซน +07 มาเอง'],
    ['', '—', 'ค่าว่าง'],
    ['ไม่ใช่วันที่', 'ไม่ใช่วันที่', 'อ่านไม่ออก ⇒ คืนค่าดิบ ห้ามเดา'],
  ]
  for (const [input, want, why] of cases) {
    const got = thaiDate(input)
    const ok = got === want
    if (!ok) fail++
    console.log(`  ${ok ? '✅' : '❌'} ${JSON.stringify(input).padEnd(30)} ⇒ ${String(got).padEnd(14)} ${why}`)
    if (!ok) console.log(`     ต้องได้ ${want}`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
