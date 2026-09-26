#!/usr/bin/env node
/* ด่านขั้นแรกสุดของ prebuild: **รุ่น node ที่กำลังรัน ต้องเปิดไฟล์ `.ts` ได้**
 *
 * 🔴 **ที่มา — วัดจากของจริง 26 ก.ย. 2569 ไม่ใช่หลักการ**
 *    ผมเองตรึง `NODE_VERSION = "20"` ไว้ที่ `netlify.toml` (คอมมิต c1804fd) ด้วยเหตุผลที่ฟังดูดี
 *    ("ให้ตรงกับฝั่งท่อ") ⇒ **Netlify build ล้มทุกใบตั้งแต่นั้น** — `exit code 2` ใน 49 วินาที
 *    ⇒ ของที่ล้มจริงคือขั้นที่ 11 ของสายนี้:
 *        TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
 *          for /…/lib/หัวยุค.ts    ← `scripts/tests/หัวยุค.test.mjs` import ไฟล์ .ts ตรง ๆ
 *    ⇒ เพราะ **node 22 ถอด type ให้เองได้ · node 20 ทำไม่ได้**
 *
 * 🔑 **เหตุที่ต้องมีด่านนี้ ไม่ใช่แค่แก้ตัวเลขแล้วจบ**
 *    ข้อความ `ERR_UNKNOWN_FILE_EXTENSION` **ไม่ได้บอกว่าเหตุคือรุ่น node** — มันบอกว่า "นามสกุลไม่รู้จัก"
 *    ⇒ คนอ่าน (รวมทั้งผมเอง) จะไปไล่หาว่าไฟล์นั้นผิดอะไร แทนที่จะดูรุ่น node
 *    ⇒ ⇒ ด่านนี้จึงมีหน้าที่เดียว: **ทำให้ข้อความตอนตกบอกเหตุที่แท้จริง ที่ขั้นแรกสุด**
 *    (กฎของทีม: สัญญาณพังต้องมาจากข้อความที่โค้ดเราเขียนเอง)
 *
 * ⚠️ **ห้ามแก้ด่านนี้ให้ผ่านโดยลดเกณฑ์** — ถ้าวันหนึ่งอยากใช้ node 20 จริง
 *    ต้องเลิก import `.ts` จากสคริปต์ `.mjs` ก่อน (นับรายชื่อได้จากคำสั่งในข้อความตอนตก)
 *
 * รัน: node scripts/check-node-version.mjs            ⇒ rc=0 ผ่าน · rc=1 ตก
 *      node scripts/check-node-version.mjs --self-test ⇒ ทดสอบตัวตัดสินด้วยค่าปลายสองข้าง
 */
import { execFileSync } from 'node:child_process'

/** รุ่นต่ำสุดที่ **ถอด type ของ .ts ให้เองได้** — node เพิ่มความสามารถนี้ใน 22.6 (หลัง 22.18 เปิดเป็นค่าตั้งต้น)
 *  🔑 เลขนี้คือ **ข้อเท็จจริงของ runtime** ไม่ใช่ความชอบของเรา ⇒ เปลี่ยนได้ต่อเมื่อวัดใหม่แล้วต่าง */
const MAJOR_ต่ำสุด = 22

/** ตัวตัดสินล้วน — แยกออกมาเพื่อทดสอบได้โดยไม่ต้องมี node หลายรุ่นในเครื่อง
 *  @param {string} รุ่น เช่น 'v20.20.2'
 *  @returns {{ผ่าน:boolean, major:number|null}} */
export function ตัดสินรุ่น(รุ่น) {
  const m = String(รุ่น ?? '').match(/^v?(\d+)\./)
  if (!m) return { ผ่าน: false, major: null }
  const major = Number(m[1])
  return { ผ่าน: major >= MAJOR_ต่ำสุด, major }
}

/** หารายชื่อสคริปต์ที่ import ไฟล์ `.ts` ตรง ๆ — เอาไว้พิมพ์ในข้อความตอนตก
 *  ⚠️ หาไม่ได้ ⇒ คืน null แล้วให้ข้อความเขียนว่า "หารายชื่อไม่ได้" ไม่ใช่เขียนว่า "ไม่มี" */
function หาผู้พึ่งพา() {
  try {
    const out = execFileSync('grep', ['-rlE', "from '[^']*\\.ts'", 'scripts/'], { encoding: 'utf8' })
    return out.split('\n').filter(Boolean)
  } catch {
    return null
  }
}

function selfTest() {
  let ผ่าน = 0
  let ตก = 0
  /* 🔑 ค่าปลายสองข้าง + ค่าที่อ่านไม่ออก — ไม่ใช่ทดสอบแต่ค่าที่ผ่าน
     (บทเรียน: ชื่อช่องบอกหน่วยไม่ได้ ⇒ เกณฑ์กลับหัวได้โดยไม่มีอะไรฟ้อง) */
  const เคส = [
    ['v22.23.2', true], ['v22.6.0', true], ['v24.0.0', true],
    ['v20.20.2', false], ['v18.19.0', false], ['v21.7.3', false],
    ['', false], ['ไม่ใช่รุ่น', false], [undefined, false],
  ]
  for (const [รุ่น, ควรผ่าน] of เคส) {
    const ได้ = ตัดสินรุ่น(รุ่น).ผ่าน
    if (ได้ === ควรผ่าน) { ผ่าน++ } else {
      ตก++
      console.error(`   🔴 ${JSON.stringify(รุ่น)} ⇒ ได้ ${ได้} ควรได้ ${ควรผ่าน}`)
    }
  }
  console.log(`self-test ด่านรุ่น node: ผ่าน ${ผ่าน} · ตก ${ตก}`)
  return ตก === 0 ? 0 : 1
}

if (process.argv.includes('--self-test')) process.exit(selfTest())

const { ผ่าน, major } = ตัดสินรุ่น(process.version)
if (ผ่าน) {
  console.log(`✅ node ${process.version} ถอด type ของ .ts ได้ (ต้อง ≥ ${MAJOR_ต่ำสุด})`)
  process.exit(0)
}

console.error(`\n🔴 node ที่กำลังรันคือ ${process.version} — สายด่านนี้ต้องการ **≥ ${MAJOR_ต่ำสุด}**`)
console.error('   เหตุ: สคริปต์เทสบางตัว `import` ไฟล์ `.ts` ตรง ๆ ซึ่ง node จะถอด type ให้เองได้ตั้งแต่ 22.6')
console.error(`   บน node ${major ?? '?'} จะล้มกลางสายด้วยข้อความที่ **ไม่บอกเหตุ**:`)
console.error('     TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"')
const ผู้พึ่งพา = หาผู้พึ่งพา()
if (ผู้พึ่งพา === null) {
  console.error('   (หารายชื่อไฟล์ที่พึ่งพาไม่ได้ในรอบนี้ — ไม่ได้แปลว่าไม่มี)')
} else {
  console.error(`   ไฟล์ที่พึ่งพาความสามารถนี้ ${ผู้พึ่งพา.length} ไฟล์:`)
  for (const f of ผู้พึ่งพา) console.error(`     · ${f}`)
}
console.error('\n   🔧 แก้ที่ไหน:')
console.error('     · ที่ Netlify ⇒ `netlify.toml` ช่อง `NODE_VERSION` (ตอนนี้ควรเป็น "22")')
console.error('     · ในเครื่อง ⇒ ใช้ node 22 (`nvm use 22`)')
console.error('   ⚠️ อย่าแก้ด่านนี้ให้ผ่าน — เกณฑ์นี้มาจากความสามารถของ runtime ไม่ใช่ความชอบของเรา')
process.exit(1)
