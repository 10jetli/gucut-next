/* ทดสอบความสดของสูตรสินค้าเป็นชุด — รัน: node scripts/tests/recipe-fresh.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: เป็นตรรกะ "เวลา + โซนเวลา" ซึ่งวันนี้พลาดมาแล้วหนึ่งรอบ
 *    (กำหนดส่งในจอใบสั่งผลิตแสดง UTC ดิบ ⇒ เลื่อนไปหนึ่งวัน)
 *    และคราวนี้มีกับดักเพิ่ม: **สองเวลาที่สลับกันแล้วจอจะโกหกทันที**
 *      changedAt = สูตรเปลี่ยนล่าสุด (ไม่เปลี่ยนก็ค้างที่ 3 ก.ย. ตลอดไป)
 *      checkedAt = ไปถาม ZORT ล่าสุด ← อันนี้คือความสด
 *    สลับกันเมื่อไหร่ จอจะขึ้นว่า "ซิงก์หยุดไปตั้งแต่ต้นเดือน" ทั้งที่ซิงก์ทุกชั่วโมงอยู่
 *
 * 🔑 เรียกฟังก์ชันตัวจริงที่จอใช้ (แปลง lib/recipe-fresh.ts ด้วย tsc ของโปรเจกต์)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-recipe-fresh')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/recipe-fresh.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { recipeFreshness, toThai, thaiMoment, RECIPE_STALE_HOURS } = await import(join(out, 'recipe-fresh.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }
  /* เวลาอ้างอิง: 14 ก.ย. 2026 15:00 UTC = 22:00 เวลาไทย */
  const NOW = Date.parse('2026-09-14T15:00:00Z')

  console.log('① 🔴 เวลาจากท่อเป็น UTC — ต้อง +7 ก่อนแสดง')
  {
    ok('มี Z ต่อท้าย', thaiMoment(toThai('2026-09-14T12:00:00Z')) === '14 ก.ย. 2569 19:00 น.',
      thaiMoment(toThai('2026-09-14T12:00:00Z')))
    ok('ไม่มีโซน (รูปที่ท่อส่งจริง) ⇒ ถือเป็น UTC', thaiMoment(toThai('2026-09-14 12:00:00')) === '14 ก.ย. 2569 19:00 น.',
      thaiMoment(toThai('2026-09-14 12:00:00')))
    ok('🔴 ข้ามวันเมื่อ +7 แล้วเลยเที่ยงคืน', thaiMoment(toThai('2026-09-14T17:30:00Z')) === '15 ก.ย. 2569 00:30 น.',
      thaiMoment(toThai('2026-09-14T17:30:00Z')))
    ok('ค่าว่าง/อ่านไม่ออก ⇒ null (ไม่ใช่วันที่มั่ว)', toThai('') === null && toThai('ไม่ใช่เวลา') === null)
  }

  console.log('② สถานะความสด')
  {
    const fresh = recipeFreshness('2026-09-14T14:30:00Z', '2026-09-03T04:00:00Z', NOW)
    ok('ตรวจเมื่อครึ่งชั่วโมงก่อน ⇒ ok', fresh.state === 'ok' && fresh.ageHours === 0.5, JSON.stringify(fresh))
    ok('   และยังบอกวันที่สูตรเปลี่ยนล่าสุดแยกต่างหาก', thaiMoment(fresh.changedThai).startsWith('3 ก.ย. 2569'))

    const stale = recipeFreshness('2026-09-14T05:00:00Z', '2026-09-03T04:00:00Z', NOW)
    ok(`เกิน ${RECIPE_STALE_HOURS} ชม. ⇒ stale`, stale.state === 'stale' && stale.ageHours === 10, JSON.stringify(stale))

    const edge = recipeFreshness('2026-09-14T09:00:00Z', null, NOW)   // 6 ชม. พอดี
    ok('6 ชม. พอดี ⇒ ยัง ok (เกินเท่านั้นถึงเตือน)', edge.state === 'ok', JSON.stringify(edge))
  }

  console.log('③ 🔴 ไม่รู้ ≠ ซิงก์หยุด')
  {
    for (const v of [null, undefined, '']) {
      const r = recipeFreshness(v, '2026-09-03T04:00:00Z', NOW)
      ok(`checkedAt = ${JSON.stringify(v)} ⇒ unknown (ไม่ใช่ stale)`, r.state === 'unknown' && r.ageHours === null, JSON.stringify(r))
    }
    ok('   แต่ยังบอกวันที่สูตรเปลี่ยนได้ตามปกติ',
      recipeFreshness(null, '2026-09-03T04:00:00Z', NOW).changedThai !== null)
  }

  console.log('④ 🔴 กับดักหลัก: สลับสองเวลาแล้วผลต้องต่างกันชัดเจน')
  {
    const right = recipeFreshness('2026-09-14T14:30:00Z', '2026-09-03T04:00:00Z', NOW)
    const swapped = recipeFreshness('2026-09-03T04:00:00Z', '2026-09-14T14:30:00Z', NOW)
    ok('ใส่ถูกทาง ⇒ ok', right.state === 'ok')
    ok('🔴 สลับทาง ⇒ stale ทันที (เทสนี้คือที่ดักความผิดพลาดนั้น)', swapped.state === 'stale',
      JSON.stringify(swapped))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
