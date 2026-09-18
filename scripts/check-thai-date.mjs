#!/usr/bin/env node
/* ด่านก่อน build: ห้ามส่ง "วันที่ดิบจากท่อ" ขึ้นจอ — ทั้งร้านอ่าน พ.ศ. ไม่ใช่ ค.ศ.
 *
 * 🔴 ที่มา: 15 ก.ย. 2569 กวาดรอบแรกคิดว่าจบ · 16 ก.ย. กวาดรอบสองเจอค่าดิบปี ค.ศ. อีก 4 จุด
 *    รอบสามวันเดียวกันเจออีก 3 จุด (จอรายละเอียดใบขาย · จอลูกค้ารายคน · จอสะพาน PEAK)
 *    ⇒ คลาสเดียวกับคำสถานะ: ปัญหาอยู่ที่ "ไม่มีตัวตรวจ" ไม่ใช่ความขยันในการกวาด
 *       (บทเรียน: กวาดด้วยมือรอบที่สาม = ต้องทำด่าน)
 *
 * ทางผ่านที่ถูกต้อง (ด่านปล่อย):
 *   · ผ่าน `thaiDate(` / `thaiShort(` / `thaiDayTime(` / `fmt…(`
 *   · อยู่ใน `${…}` ของ title/tooltip ที่ตั้งใจโชว์ค่าดิบ (เราบังคับให้เก็บค่าดิบไว้ตรวจย้อน)
 *   · เป็นคีย์/การเทียบในโค้ด (`key=` · `===`)
 *   · ส่งเป็น prop ให้ component ที่จัดรูปแบบเองข้างใน (ต้องอ่านโค้ดยืนยันแล้ว)
 *   · หรืออยู่ในรายการ `ยกเว้น` พร้อมเหตุผล
 *
 * ⚠️ กติกาของ thaiDate ที่ห้ามลืม: แปลงโซนเวลา **เฉพาะค่าที่บอกโซนมา**
 *    ค่าที่เป็นวันที่เปล่า ๆ (yyyy-MM-dd) อ่านตรง ๆ — คิดโซนจะทำให้วันเลื่อน
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
/* ชื่อช่องที่ลงท้ายแบบวันเวลา — ดักที่ "รูปแบบชื่อ" เพราะท่อตั้งชื่อไม่เหมือนกันทุกเส้น */
/* ⚠️ ต้องครอบคำลงท้าย `Day` ด้วย — 16 ก.ย. 2569 จอลูกค้ารายคนโชว์ `firstDay`/`lastDay`
   เป็นปี ค.ศ. ดิบ และด่านรุ่นแรกจับไม่ได้เพราะดูแต่ `Date`/`At` */
const RE = /\{\s*[A-Za-z_][\w]*\.[A-Za-z_]*(?:[Dd]ate|At|_at|[Dd]ay)\b\s*(?:(?:\?\?|\|\|)\s*[^{}]*)?\}/

const componentที่จัดรูปแบบเอง = {
  MarketStaleBar: 'components/zort/DataFreshness.tsx — เรียก thaiDayTime() ข้างใน (อ่านโค้ดยืนยันแล้ว 16 ก.ย. 2569)',
  StaleBar: 'components/zort/DataFreshness.tsx — จัดรูปแบบเวลาเองข้างใน',
  MarketCoverage: 'components/zort/index.tsx — เรียก thaiHm(at) และเก็บค่าดิบใน title (อ่านโค้ดยืนยันแล้ว 16 ก.ย. 2569)',
}

/** ชื่อช่องที่ลงท้ายพ้องกับวันเวลา แต่เก็บ "จำนวน" — ต้องมีเหตุผล (ตรวจแล้วว่าเป็นตัวเลข) */
const ชื่อที่ไม่ใช่วันที่ = {
  today: 'app/web/seo: BotRow.today เป็น **จำนวนหน้าที่บอตเข้าวันนี้** (number) ไม่ใช่วันที่ — อ่าน interface ยืนยันแล้ว 16 ก.ย. 2569',
}

const ยกเว้น = {
  'app/core/soon/[key]/page.tsx': 'ช่อง builtAt ของที่นี่เก็บ **เส้นทางหน้าเว็บ** ไม่ใช่วันที่ (ชื่อพ้องกันเท่านั้น)',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/* ── กฎที่สอง: ตัดเวลาทิ้งก่อนส่งเข้าตัวแปลง ──────────────────────────
   🔴 **ที่มา 18 ก.ย. 2569** — ท่านประธานจับได้ที่จอมาร์เก็ตเพลสว่าอายุข้อมูลเกินจริง 1 วัน
      กวาดตามคลาสเดียวกันแล้วเจออีก 3 จอ (missing-sku · zort-claims · stock รายตัว)
   ⚠️ **ทั้งสี่จุดรอดด่านนี้มาได้** เพราะบรรทัดมีคำว่า `thaiDate` ⇒ กฎข้อแรกปล่อยผ่าน (บรรทัด `if (/thaiDate|…/)`)
      ⇒ ด่านที่ดูแค่ "มีตัวแปลงไหม" ไม่พอ ต้องดูด้วยว่า **ตัวแปลงได้ของครบไหม**
   ท่าที่ผิด: `thaiDate(x.at.slice(0, 10))` — ตัด `T..Z` ทิ้งก่อน ⇒ thaiDate ไม่มีทางรู้ว่าต้องแปลงโซน
   ท่าที่ถูก: `thaiDateUtc(x.at)` (ค่าจากฐาน/UTC) หรือ `thaiDate(x.at)` (ค่าที่บอกโซนมาเอง) */
/* ⚠️ **ห้ามใช้ `[^)]*` ตรงกลาง** — ท่าที่เจอจริงคือ `thaiDate(String(x.at).slice(0, 10))`
   ซึ่งมีวงเล็บปิดคั่นอยู่ข้างใน ⇒ ด่านรุ่นแรกของผมเองปล่อยผ่านทั้งที่ปลูกบั๊กกลับเข้าไปแล้ว
   (พิสูจน์ด้วยการปลูกบั๊ก 18 ก.ย. 2569 — ถ้าไม่ลองจะได้ด่านที่ "เขียวเสมอ" ซึ่งแย่กว่าไม่มีด่าน) */
const RE_ตัดก่อนแปลง = /\b(thaiDate|thaiDateTime|thaiShort|thaiDayTime)\s*\([^;]{0,120}?\.slice\(\s*0\s*,\s*10\s*\)/
const พบตัดก่อนแปลง = []

const พบ = []
for (const file of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  if (ยกเว้น[rel]) continue
  const บรรทัด = readFileSync(file, 'utf8').split('\n')
  บรรทัด.forEach((ln, i) => {
    const t = ln.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
    if (RE_ตัดก่อนแปลง.test(ln)) พบตัดก่อนแปลง.push(`${rel}:${i + 1}  ${t.slice(0, 110)}`)
    if (!RE.test(ln)) return
    /* thaiDateTime อยู่ที่ components/zort/PushStatusBoard.tsx — อ่านโค้ดยืนยันแล้ว 18 ก.ย. 2569
       ว่าบวก +7 ชม.แล้วออกปี พ.ศ. (ใช้กับเวลาจากฐานซึ่งเป็น UTC) */
    if (/thaiDate|thaiDateTime|thaiShort|thaiDayTime|fmt[A-Z]/.test(ln)) return
    if (ln.includes('${') || ln.includes('key=') || ln.includes('===')) return
    /* prop ของ component มักขึ้นบรรทัดใหม่ ⇒ มองย้อนขึ้นไป 3 บรรทัดหาแท็กที่เปิดอยู่
       (เจอจริง: `at={data.marketplacesAt} />` อยู่บรรทัดที่ 3 ของ <MarketCoverage …>) */
    const ก้อน = บรรทัด.slice(Math.max(0, i - 3), i + 1).join(' ')
    if (Object.keys(componentที่จัดรูปแบบเอง).some((c) => ก้อน.includes('<' + c))) return
    /* ชื่อพ้องแต่เก็บจำนวน (เช่น `today` = จำนวนครั้งวันนี้) ⇒ ปล่อย แต่ต้องมีเหตุผลในบัญชีข้างบน */
    if (Object.keys(ชื่อที่ไม่ใช่วันที่).some((f) => new RegExp('\\.' + f + '\\b').test(ln))) return
    พบ.push(`${rel}:${i + 1}  ${t.slice(0, 110)}`)
  })
}

console.log(`ตรวจวันที่บนจอ: ไฟล์ .tsx ในสาย app/ components/ · ยกเว้นไว้ ${Object.keys(ยกเว้น).length} ไฟล์`)
if (พบ.length) {
  console.error('\n🔴 มีวันที่ดิบ (ปี ค.ศ.) ขึ้นจอโดยไม่ผ่านตัวจัดรูปแบบ')
  for (const x of พบ) console.error('   ' + x)
  console.error('\n   วิธีแก้: ห่อด้วย thaiDate(...) จาก lib/format.ts และเก็บค่าดิบไว้ใน title')
  console.error('   ถ้าช่องนั้นไม่ใช่วันที่จริง (ชื่อพ้องกัน) ให้ใส่ไฟล์ + เหตุผลใน `ยกเว้น` ของ scripts/check-thai-date.mjs')
  process.exit(1)
}
if (พบตัดก่อนแปลง.length) {
  console.error('\n🔴 ตัดเวลาทิ้งก่อนส่งเข้าตัวแปลงวันที่ — วันบนจอจะเป็นวัน UTC ไม่ใช่วันไทย')
  for (const x of พบตัดก่อนแปลง) console.error('   ' + x)
  console.error('\n   ค่าจากฐาน/ท่อ (UTC) ⇒ ใช้ `thaiDateUtc(ค่า)` จาก lib/format.ts')
  console.error('   ค่าที่บอกโซนมาเอง (…Z หรือ +07:00) ⇒ ส่งค่าเต็มเข้า `thaiDate(ค่า)` ตรง ๆ ห้าม .slice(0, 10)')
  console.error('   เหตุผล: .slice ทิ้งเวลาและโซนไปก่อน ⇒ ตัวแปลงไม่มีทางรู้ว่าต้องแปลง และไม่มีอะไรฟ้อง')
  process.exit(1)
}
console.log('✅ ไม่มีวันที่ดิบหลุดขึ้นจอ · ไม่มีการตัดเวลาทิ้งก่อนส่งเข้าตัวแปลง')
