#!/usr/bin/env node
/* ตรวจไวยากรณ์ไฟล์ `.mjs` ทุกไฟล์ในรีโป — **ต้องอยู่ก่อนด่านอื่นใน prebuild**
 * (19 ก.ย. 2569 · ยกโครงจากฝั่งท่อ ซึ่งเจอบั๊กคลาสนี้วันเดียวกัน)
 *
 * 🔴 ที่มาฝั่งผม — ของจริงวันนี้ ไม่ใช่เหตุสมมติ:
 *    ผมแทรกโค้ดเข้า `netlify/functions/shelf-report.mjs` ด้วย `indexOf('export const config')`
 *    ⇒ ไปเจอ **คำที่ถูกเอ่ยในคอมเมนต์หัวไฟล์** ⇒ แทรกลงกลางคอมเมนต์ ⇒ **ไฟล์พังทั้งไฟล์**
 *    ⚠️ `npm run build` **ผ่าน** เพราะ Next ไม่คอมไพล์ `netlify/functions`
 *    ⇒ จับได้เพราะบังเอิญมีเทสตัวหนึ่ง import ไฟล์นั้น
 *
 * 🔑 **และนั่นคือความบังเอิญ ไม่ใช่ตาข่าย** — วัดแล้ว 19 ก.ย. 2569:
 *    6 ไฟล์ใน `netlify/functions/` **ไม่มีเทสไหนแตะเลย**
 *    (bills-daily · bills-netlify · bills-watch · lib-notify · lib-shelf-report · shelf-ask)
 *    ⇒ ถ้าผมพังตัวใดตัวหนึ่งในนั้นแทน **ไม่มีอะไรจับได้เลยจนกว่างานตามเวลาจะวิ่งบน Netlify**
 *    ⇒ ซึ่งคือตอนที่บิลไม่ถูกเก็บ และไม่มีใครรู้ (คลาสเดียวกับที่เจอเมื่อคืน)
 *
 * 🔑 ทำไมต้องอยู่ **ก่อน** ชุดทดสอบ: เทสเห็นเฉพาะไฟล์ที่ถูก import
 *    ⇒ เทสเขียวไม่ได้แปลว่าทุกไฟล์ parse ได้
 *
 * 🔒 กวาดได้ 0 ไฟล์ = **ตัวเดินไฟล์พัง ไม่ใช่รีโปสะอาด** ⇒ ตก
 */
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function เดิน(dir, out = []) {
  let รายการ
  try { รายการ = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of รายการ) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) เดิน(p, out)
    else if (e.name.endsWith('.mjs')) out.push(p)
  }
  return out
}

const ราก = ['scripts', 'netlify', 'lib', 'app', 'public']
let ไฟล์ = []
for (const r of ราก) {
  const เต็ม = join(ROOT, r)
  try { if (statSync(เต็ม).isDirectory()) ไฟล์ = ไฟล์.concat(เดิน(เต็ม)) } catch { /* ไม่มี = ข้าม */ }
}

/* 🔒 กติกาเดิมของเรา: ไม่มีของให้ตรวจ ⇒ แดง ไม่ใช่เขียว */
if (ไฟล์.length === 0) {
  console.error('🔴 หาไฟล์ .mjs ไม่เจอสักไฟล์ — **ตัวเดินไฟล์พัง ไม่ใช่รีโปสะอาด**')
  console.error(`   รากที่กวาด: ${ราก.join(' · ')}`)
  process.exit(1)
}

const พัง = []
for (const p of ไฟล์) {
  const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' })
  if (r.status !== 0) {
    const บรรทัดแรก = (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join('\n      ')
    พัง.push(`${relative(ROOT, p)}\n      ${บรรทัดแรก}`)
  }
}

console.log(`ไวยากรณ์ .mjs: ตรวจ ${ไฟล์.length} ไฟล์ (${ราก.join(' · ')})`)
if (พัง.length) {
  console.error(`\n🔴 parse ไม่ผ่าน ${พัง.length} ไฟล์ — **ไฟล์พัง ไม่ใช่เรื่องสไตล์**`)
  for (const x of พัง) console.error('   ' + x)
  console.error('   ⚠️ `npm run build` มองไม่เห็นไฟล์พวกนี้ (Next ไม่คอมไพล์ netlify/functions)')
  console.error('      และชุดทดสอบเห็นเฉพาะไฟล์ที่ถูก import ⇒ ด่านนี้คือตัวเดียวที่ครอบทุกไฟล์')
  process.exit(1)
}
console.log('✅ ทุกไฟล์ parse ได้')
