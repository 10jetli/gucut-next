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
import { readFileSync } from 'node:fs'

/* 🔑 **เลขเกณฑ์ไม่ได้อยู่ในไฟล์นี้ — อ่านจาก `package.json` ช่อง `engines.node` ของรีโปที่กำลังตรวจ**
 *
 * 🔴 เหตุ (ฝั่งท่อชี้ 26 ก.ย. 2569 หลังผมเสนอจะย้ายด่านนี้ไปเป็นของร่วม):
 *    *"แชร์กลไกได้ แชร์ตัวเลขไม่ได้"* — บั๊กของผมวันนี้เกิดจากการ **ตรึงรุ่นให้ตรงกับรีโปอื่น**
 *    ⇒ ถ้าตัวตรวจถือรุ่นไว้ในตัวเองแล้วเอาไปใช้ร่วมกัน = **สร้างบั๊กเดิมในรูปที่ใหญ่กว่า (ผิดทีเดียวสองรีโป)**
 *    ⇒ ⇒ ต่างจากทะเบียนลายนิ้วมือส่วนขยาย ซึ่งเป็น **ความจริงข้อเดียวกันของทุกคน**
 *        ส่วนรุ่น node เป็น **ความจริงของแต่ละโค้ดเบส** ⇒ แต่ละรีโปประกาศของตัวเอง
 * ⚠️ ไม่มี `engines.node` ⇒ **ตก** ไม่ใช่ผ่าน (ไม่มีเกณฑ์ = ตรวจไม่ได้ ไม่ใช่ตรวจแล้วผ่าน) */
/** ตัวอ่านประกาศ **ล้วน** — แยกออกมาเพื่อทดสอบเคส "ไม่มี engines" ได้ **โดยไม่ต้องแก้ package.json จริง**
 *  @param {unknown} ประกาศ ค่าที่อยู่ใน engines.node เช่น '>=22.6.0'
 *  @returns {number|null} major ที่ประกาศไว้ · null = ไม่มีเกณฑ์ */
export function เกณฑ์จากประกาศ(ประกาศ) {
  const m = String(ประกาศ ?? '').match(/(\d+)/)
  return m ? Number(m[1]) : null
}

function อ่านเกณฑ์จากรีโป() {
  const ทาง = new URL('../package.json', import.meta.url)
  const pkg = JSON.parse(readFileSync(ทาง, 'utf8'))
  const ประกาศ = pkg?.engines?.node
  return { major: เกณฑ์จากประกาศ(ประกาศ), ประกาศ: ประกาศ ?? null, ที่มา: 'package.json → engines.node' }
}

const เกณฑ์ = อ่านเกณฑ์จากรีโป()
const MAJOR_ต่ำสุด = เกณฑ์.major

/** ตัวตัดสินล้วน — แยกออกมาเพื่อทดสอบได้โดยไม่ต้องมี node หลายรุ่นในเครื่อง
 *  @param {string} รุ่น เช่น 'v20.20.2'
 *  @returns {{ผ่าน:boolean, major:number|null}} */
export function ตัดสินรุ่น(รุ่น, ขั้นต่ำ = MAJOR_ต่ำสุด) {
  const m = String(รุ่น ?? '').match(/^v?(\d+)\./)
  if (!m) return { ผ่าน: false, major: null }
  const major = Number(m[1])
  if (!Number.isFinite(ขั้นต่ำ)) return { ผ่าน: false, major, ไม่มีเกณฑ์: true }
  return { ผ่าน: major >= ขั้นต่ำ, major }
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
    const ได้ = ตัดสินรุ่น(รุ่น, 22).ผ่าน
    if (ได้ === ควรผ่าน) { ผ่าน++ } else {
      ตก++
      console.error(`   🔴 ${JSON.stringify(รุ่น)} ⇒ ได้ ${ได้} ควรได้ ${ควรผ่าน}`)
    }
  }
  /* เคสที่ทีมเพิ่งเจ็บมา: **ไม่มีเกณฑ์ประกาศไว้ ⇒ ต้องตก ไม่ใช่ผ่าน**
     ⚠️ **ส่ง `undefined` เข้า `ตัดสินรุ่น` ทดสอบเรื่องนี้ไม่ได้** — JS จะเอา
        ค่าเริ่มต้นของพารามิเตอร์ (`MAJOR_ต่ำสุด`) มาใช้แทน ⇒ กลายเป็นเคส "มีเกณฑ์" เงียบ ๆ
        (self-test รอบแรกฟ้องข้อนี้ให้ผมจริง ๆ ⇒ เก็บไว้เป็นเหตุผลว่าทำไมทดสอบคนละทาง)
     ⇒ จึงทดสอบ **ตัวอ่านประกาศ** ตรง ๆ ว่าคืน null เมื่อไม่มีของให้อ่าน
        แล้วทดสอบ `ตัดสินรุ่น` ด้วย null/NaN ซึ่งเป็นค่าที่ของจริงจะส่งมา */
  for (const ไม่มี of [undefined, null, '', 'ยี่สิบสอง', {}]) {
    const ได้ = เกณฑ์จากประกาศ(ไม่มี)
    if (ได้ === null) { ผ่าน++ } else { ตก++; console.error(`   🔴 ประกาศ ${JSON.stringify(ไม่มี)} ⇒ ควรได้ null ได้ ${ได้}`) }
  }
  for (const [ประกาศ, คาด] of [['>=22.6.0', 22], ['20.x', 20], ['^18.0.0', 18]]) {
    const ได้ = เกณฑ์จากประกาศ(ประกาศ)
    if (ได้ === คาด) { ผ่าน++ } else { ตก++; console.error(`   🔴 ประกาศ ${ประกาศ} ⇒ ควรได้ ${คาด} ได้ ${ได้}`) }
  }
  for (const ไม่มีเกณฑ์ of [null, NaN]) {
    const r = ตัดสินรุ่น('v22.23.2', ไม่มีเกณฑ์)
    if (r.ผ่าน === false && r.ไม่มีเกณฑ์ === true) { ผ่าน++ } else { ตก++; console.error(`   🔴 ขั้นต่ำ ${ไม่มีเกณฑ์} ⇒ ควรตกและติดธงไม่มีเกณฑ์`) }
  }
  console.log(`self-test: ผ่าน ${ผ่าน} · ตก ${ตก} · เกณฑ์ที่อ่านจากรีโป = ${MAJOR_ต่ำสุด} (${เกณฑ์.ที่มา})`)
  return ตก === 0 ? 0 : 1
}

if (process.argv.includes('--self-test')) process.exit(selfTest())

const { ผ่าน, major } = ตัดสินรุ่น(process.version)
if (ผ่าน) {
  console.log(`✅ node ${process.version} ผ่านเกณฑ์ของรีโปนี้ (≥ ${MAJOR_ต่ำสุด} · ประกาศที่ ${เกณฑ์.ที่มา} = ${JSON.stringify(เกณฑ์.ประกาศ)})`)
  process.exit(0)
}

if (!Number.isFinite(MAJOR_ต่ำสุด)) {
  console.error(`\n🔴 รีโปนี้ไม่ได้ประกาศรุ่น node ขั้นต่ำ (${เกณฑ์.ที่มา} = ${JSON.stringify(เกณฑ์.ประกาศ)})`)
  console.error('   ⇒ **ไม่มีเกณฑ์ = ตรวจไม่ได้ ไม่ใช่ตรวจแล้วผ่าน** ⇒ ประกาศที่ package.json ช่อง engines.node')
  process.exit(1)
}
console.error(`\n🔴 node ที่กำลังรันคือ ${process.version} — รีโปนี้ประกาศว่าต้อง **≥ ${MAJOR_ต่ำสุด}** (${เกณฑ์.ที่มา})`)
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
console.error(`     · ที่ Netlify ⇒ netlify.toml ช่อง NODE_VERSION (ต้อง ≥ ${MAJOR_ต่ำสุด})`)
console.error('     · ในเครื่อง ⇒ ใช้ node 22 (`nvm use 22`)')
console.error('   ⚠️ อย่าแก้ด่านนี้ให้ผ่าน — เกณฑ์นี้มาจากความสามารถของ runtime ไม่ใช่ความชอบของเรา')
process.exit(1)
