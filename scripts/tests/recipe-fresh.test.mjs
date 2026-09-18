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
  const { recipeFreshness, toThai, thaiMoment, RECIPE_STALE_HOURS_ทางถอย: RECIPE_STALE_HOURS, ป้ายรอบซิงก์,
    stockSyncFreshness, STOCK_STALE_MINUTES, agoText } = await import(join(out, 'recipe-fresh.js'))

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

    /* 🔴 **ข้อมูลทดสอบต้องขยับตามเกณฑ์ ไม่งั้นเทสจะเลิกทดสอบอะไรเงียบ ๆ** (19 ก.ย. 2569)
       เกณฑ์เปลี่ยน 6 → 25 ชม. (รอบจริงเป็นวันละครั้ง) ⇒ ของเดิมอายุ 10 ชม. กลายเป็น `ok`
       ⚠️ ทางที่ผิดตรงนี้คือ **แก้ค่าที่คาดหวังให้ผ่าน** ⇒ ได้เทสที่ผ่านโดยไม่ได้ทดสอบอะไร
          (คลาสเดียวกับ `q=CN` ที่แมตช์ทุกใบ — ดูบทเรียน test-must-discriminate ④)
       ⇒ ต้องเลื่อน **ข้อมูล** ให้กลับไปอยู่คนละฝั่งของเส้นแบ่ง แล้วคงคำถามเดิมไว้ */
    const stale = recipeFreshness('2026-09-13T09:00:00Z', '2026-09-03T04:00:00Z', NOW)   // 30 ชม.
    ok(`เกิน ${RECIPE_STALE_HOURS} ชม. ⇒ stale`, stale.state === 'stale' && stale.ageHours === 30, JSON.stringify(stale))

    const edge = recipeFreshness('2026-09-13T14:00:00Z', null, NOW)   // 25 ชม. พอดี
    ok(`${RECIPE_STALE_HOURS} ชม. พอดี ⇒ ยัง ok (เกินเท่านั้นถึงเตือน)`,
      edge.state === 'ok' && edge.ageHours === RECIPE_STALE_HOURS, JSON.stringify(edge))

    /* 🔒 **ด่านกันเกณฑ์เลื่อนแล้วไม่มีใครรู้** — ผูกเกณฑ์กับรอบจริงที่ฝั่งท่อยืนยัน
       รอบ = วันละครั้ง ⇒ เกณฑ์ต้องมากกว่า 24 ชม. เสมอ · ต่ำกว่านั้น = จอจะแดงทุกวันทั้งที่ปกติ */
    ok('เกณฑ์ต้องเผื่อรอบวันละครั้ง (> 24 ชม.)', RECIPE_STALE_HOURS > 24, String(RECIPE_STALE_HOURS))

    /* 🔴 **"ไม่มีคีย์" กับ "คีย์เป็น null" ต้องออกคนละทาง** (19 ก.ย. 2569)
       ฝั่งท่อเรียกรวมว่า null แต่สองอันนี้คนละเรื่อง ⇒ ถ้ายุบเป็นทางเดียวจะพังคนละแบบ:
       ยุบไปทาง "ใช้ค่าสำรอง" ⇒ ท่อบอกว่าไม่รู้รอบ แล้วจอยังตัดสินด้วยเลขที่เดาเอง
       ยุบไปทาง "ไม่รู้รอบ" ⇒ ท่อรุ่นเก่าทำให้จอเงียบสนิท ทั้งที่เมื่อวานยังเตือนได้ */
    const ท่อเก่า = recipeFreshness('2026-09-13T09:00:00Z', null, NOW)              // ไม่ส่งอาร์กิวเมนต์ = ไม่มีคีย์
    ok('ท่อไม่มีคีย์เกณฑ์ ⇒ ตัดสินด้วยค่าสำรอง **และประกาศว่าใช้ค่าสำรอง**',
      ท่อเก่า.state === 'stale' && ท่อเก่า.ใช้ค่าสำรอง === true, JSON.stringify(ท่อเก่า))

    const ท่อไม่รู้ = recipeFreshness('2026-09-13T09:00:00Z', null, NOW, null)
    ok('ท่อส่ง null ⇒ ไม่รู้รอบ **ห้ามถอยไปใช้เลขฝัง**',
      ท่อไม่รู้.state === 'ไม่รู้รอบ' && ท่อไม่รู้.ใช้ค่าสำรอง === false, JSON.stringify(ท่อไม่รู้))

    const ท่อบอก = recipeFreshness('2026-09-13T09:00:00Z', null, NOW, 48)
    ok('ท่อส่งเกณฑ์ 48 ชม. ⇒ อายุ 30 ชม. ยัง ok (ใช้เกณฑ์ของท่อ ไม่ใช่ของเรา)',
      ท่อบอก.state === 'ok' && ท่อบอก.ใช้ค่าสำรอง === false, JSON.stringify(ท่อบอก))

    ok('ป้ายรอบ: 24 ชม. ⇒ "วันละครั้ง"', ป้ายรอบซิงก์(24) === 'วันละครั้ง', ป้ายรอบซิงก์(24))
    ok('ป้ายรอบ: 1 ชม. ⇒ "ทุกชั่วโมง"', ป้ายรอบซิงก์(1) === 'ทุกชั่วโมง', ป้ายรอบซิงก์(1))
    ok('ป้ายรอบ: ไม่รู้ ⇒ ว่าง (ไม่เดาคำ)', ป้ายรอบซิงก์(null) === '', JSON.stringify(ป้ายรอบซิงก์(null)))
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
  console.log('⑤ 🔴 ความสดของ "ตัวเลขสต็อกชุด" — คนละนาฬิกากับสูตร (ท่อซิงก์ทุกครึ่งชั่วโมง)')
  {
    /* ที่มา: จอโชว์ 00073-11.8-NW คงเหลือ 41 พร้อมขาย 23 · ZORT 18 / -10
       เพราะตาราง bundles ไม่มีอะไรซิงก์เลย ⇒ ต้องโชว์อายุของตัวเลข ไม่ใช่โชว์เลขเปล่า */
    const a = stockSyncFreshness('2026-09-14T14:50:00Z', NOW)   // 10 นาที
    ok('ซิงก์เมื่อ 10 นาทีก่อน ⇒ ok', a.state === 'ok' && a.ageMinutes === 10, JSON.stringify(a))
    const b = stockSyncFreshness('2026-09-14T13:29:00Z', NOW)   // 91 นาที
    ok(`เกิน ${STOCK_STALE_MINUTES} นาที ⇒ stale`, b.state === 'stale' && b.ageMinutes === 91, JSON.stringify(b))
    const edge = stockSyncFreshness('2026-09-14T13:30:00Z', NOW) // 90 นาทีพอดี
    ok('90 นาทีพอดี ⇒ ยัง ok (เกินเท่านั้นถึงเตือน)', edge.state === 'ok', JSON.stringify(edge))
    for (const v of [null, undefined, '']) {
      const r = stockSyncFreshness(v, NOW)
      ok(`stockSyncedAt = ${JSON.stringify(v)} ⇒ unknown (ไม่ใช่ stale)`, r.state === 'unknown' && r.ageMinutes === null)
    }
    ok('🔴 แปลง UTC → ไทยเหมือนกันทั้งสองตัว (ไม่ลืม +7 ที่ตัวใหม่)',
      thaiMoment(stockSyncFreshness('2026-09-14T15:27:07Z', NOW).syncedThai).startsWith('14 ก.ย. 2569 22:27'),
      thaiMoment(stockSyncFreshness('2026-09-14T15:27:07Z', NOW).syncedThai))

    /* 🔴 กับดักที่ฝั่งท่อกำชับ: เอาเวลาของ "สูตร" มาใช้กับ "สต็อก"
       recipeAt ของจริงค้างอยู่ที่ 3 ก.ย. ⇒ ถ้าเอามาใช้ คอลัมน์คงเหลือจะขึ้นแดงตลอดกาล
       ทั้งที่สต็อกซิงก์ตรงเวลา ⇒ เทสนี้ยืนยันว่าสองค่าให้ผลต่างกันจริง */
    ok('🔴 ใส่ recipeAt (3 ก.ย.) แทน stockSyncedAt ⇒ stale ทันที — เทสนี้ดักการสลับ',
      stockSyncFreshness('2026-09-03T02:12:23Z', NOW).state === 'stale')
    ok('   ขณะที่ stockSyncedAt ของจริงรอบเดียวกัน ⇒ ok',
      stockSyncFreshness('2026-09-14T15:27:07Z', NOW).state === 'ok')

    ok('คำอ่านอายุ: 8 นาที', agoText(8) === '8 นาทีที่แล้ว', agoText(8))
    ok('คำอ่านอายุ: 190 นาที ⇒ ชม.+นาที', agoText(190) === '3 ชม. 10 น.ที่แล้ว', agoText(190))
    ok('คำอ่านอายุ: 120 นาที ⇒ ไม่มีเศษนาที', agoText(120) === '2 ชม.ที่แล้ว', agoText(120))
    ok('คำอ่านอายุ: null ⇒ "ไม่รู้" (ไม่ใช่ 0 นาที)', agoText(null) === 'ไม่รู้', agoText(null))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
