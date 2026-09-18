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
  const { thaiDate, thaiDateUtc, thaiDayFromUtc } = await import(join(out, 'format.js'))

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

  /* ── thaiDateUtc / thaiDayFromUtc ────────────────────────────────────
     🔴 **ที่มา 18 ก.ย. 2569** — ท่านประธานจับได้ว่าจอมาร์เก็ตเพลสรายงานอายุข้อมูลเกินจริง 1 วัน
        เหตุ: ท่อเขียนเวลาลง D1 ด้วย `datetime('now')` = **UTC ที่ไม่มีตัวบอกโซน**
        แล้วฝั่งจอเขียน `thaiDate(x.slice(0, 10))` ⇒ ตัดเวลาทิ้งก่อน ตัวแปลงเลยไม่รู้ว่าต้องแปลง
        กวาดคลาสเดียวกันวันนั้นเจออีก 3 จอ ⇒ ย้ายตรรกะมาไว้ที่เดียวและคุมด้วยเทสนี้
     ⚠️ เคสสำคัญที่สุดคือ **17:00–24:00 UTC** ซึ่งเป็นวันถัดไปแล้วในเมืองไทย */
  console.log('\n— thaiDateUtc (เวลา UTC จากฐาน → วันไทย) —')
  const casesUtc = [
    ['2026-09-17 17:00:00', '18 ก.ย. 2569', 'ทรงของ SQLite datetime() — เที่ยงคืนพอดีเวลาไทย (ของเดิมได้ 17 = เพี้ยนหนึ่งวัน)'],
    ['2026-09-17 16:59:59', '17 ก.ย. 2569', 'ก่อนเที่ยงคืนไทยหนึ่งวินาที ต้องยังเป็น 17 (ขอบที่จับ off-by-one)'],
    ['2026-09-17T17:00:00.000Z', '18 ก.ย. 2569', 'ทรง ISO ที่บอกโซนมาเอง ต้องได้ผลเดียวกัน'],
    ['2026-12-31 17:00:00', '1 ม.ค. 2570', 'ข้ามปี'],
    ['2026-09-17', '17 ก.ย. 2569', '**วันที่เปล่า ๆ ห้ามบวก 7** — ไม่ใช่จุดเวลา บวกแล้วจะเลื่อนกลับทาง'],
    ['', '—', 'ค่าว่าง'],
    ['ไม่ใช่วันที่', 'ไม่ใช่วันท', 'อ่านไม่ออก ⇒ ไม่เดา (ตัด 10 ตัวแล้วส่งต่อให้ thaiDate คืนค่าดิบ)'],
  ]
  for (const [input, want, why] of casesUtc) {
    const got = thaiDateUtc(input)
    const ok = got === want
    if (!ok) fail++
    console.log(`  ${ok ? '✅' : '❌'} ${JSON.stringify(input).padEnd(30)} ⇒ ${String(got).padEnd(14)} ${why}`)
    if (!ok) console.log(`     ต้องได้ ${want}`)
  }

  /* จอมาร์เก็ตเพลสใช้ตัวนี้ตรง ๆ เพื่อเอาไปคิด "อายุกี่วัน" ⇒ ต้องได้ YYYY-MM-DD เสมอ */
  const wantDay = '2026-09-18'
  const gotDay = thaiDayFromUtc('2026-09-17 17:30:00')
  if (gotDay !== wantDay) { fail++; console.log(`  ❌ thaiDayFromUtc ⇒ ${gotDay} ต้องได้ ${wantDay}`) }
  else console.log(`  ✅ thaiDayFromUtc('2026-09-17 17:30:00') ⇒ ${gotDay} (ใช้คิดอายุข้อมูลต่อ)`)
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
