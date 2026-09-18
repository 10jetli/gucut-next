#!/usr/bin/env node
/* ด่านก่อน build: ห้ามแปลง "ท่อไม่ได้บอก" ให้เป็นเลข 0 ตอนอ่านคำตอบของท่อ
 *
 * 🔴 ที่มา (16 ก.ย. 2569 · กวาดด้วยท่อปลอมโหมด partialgood)
 *    `total: Number(d.total ?? 0)` ในจอยอดขาย ทำให้จอเขียนว่า **"0 ใบ · เฉลี่ยใบละ 0 บาท"**
 *    ทั้งที่ความจริงคือ "ท่อไม่ได้ส่งยอดมา" ⇒ เลข 0 บนจอเงินคือเลขที่คนเอาไปตัดสินใจ
 *    และในไฟล์เดียวกัน **มีคอมเมนต์ห้ามเรื่องนี้ไว้เองแล้ว** สำหรับช่องใบคืน
 *    ⇒ กฎที่เขียนไว้ที่เดียวแต่ไม่ได้ใช้ให้ทั่ว ก็ยังพังเหมือนเดิม ⇒ ต้องมีด่าน
 *
 * ขอบเขตที่ตรวจ (แคบไว้เพื่อไม่ให้ถูกเมิน):
 *   จับเฉพาะ `Number(<ก้อนคำตอบ>.<ช่องสรุป> ?? 0)` — ก้อนคำตอบคือ d · j · data · res · resp · body
 *   และช่องสรุปคือชื่อที่ "พูดถึงทั้งชุด" (total · totalAmount · count · amount · sum · sales · orders …)
 *   ⚠️ **ไม่จับค่าต่อแถว** (เช่น `Number(r.qty ?? 0)`) เพราะแถวนั้นมีของจริงอยู่แล้ว
 *      เป็นคนละคำถามกับ "ทั้งชุดมีเท่าไหร่"
 * ทางที่ถูก: ใช้ null แทน 0 แล้วให้จอเขียนว่า "ยังไม่รู้" (กฎสามสถานะ: ไม่รู้ ≠ 0 ≠ ไม่มี)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const ก้อนคำตอบ = 'd|j|zj|data|res|resp|body'
const ช่องสรุป = 'total|totalAmount|totalPaidAmount|count|amount|sum|sales|orders|rowsMatched|shown'
  + '|noSkuInZort|zortTotal|zortCount|zortAmount|services|unshipped|shipped'
/* 🔴 **ต้องจับทั้ง `?? 0` และ `|| 0`** (แก้ 18 ก.ย. 2569)
   ของเดิมจับเฉพาะ `?? 0` ⇒ **พลาดของจริงที่เจอวันนี้**:
   `app/core/categories/page.tsx` เขียน `Number(zj.noSkuInZort) || 0`
   ⇒ ท่อไม่ส่งช่องนี้มา = ได้ 0 ⇒ ตาข่ายเทียบหมวดบวก "ไม่มีรหัส 0" แล้วประกาศว่าไม่ครบ
     ทั้งที่แปลว่ายังไม่รู้ · `lib/category-net.ts` รองรับ null ถูกอยู่แล้ว จอเป็นคนทำพิษ
   ⚠️ `|| 0` อันตรายกว่า `?? 0` ด้วยซ้ำ เพราะมันกลืน 0 จริงและค่าว่างไปด้วย
   ⚠️ และชื่อก้อนคำตอบต้องครอบตัวแปรที่จอใช้จริง (`zj` ของจอหมวดหมู่) ไม่ใช่เฉพาะชื่อยอดนิยม */
const RE = new RegExp(
  `Number\\(\\s*(?:${ก้อนคำตอบ})\\??\\.(?:${ช่องสรุป})\\b\\s*\\)?\\s*(?:\\?\\?|\\|\\|)\\s*0`
)

/** จุดที่ยอมได้ — ต้องมีเหตุผล */
const ยกเว้น = {
  // 'app/xxx/page.tsx:123': 'เหตุผล'
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(p)
  }
  return out
}

const พบ = []
let ไฟล์ = 0
/* 🔒 ไม่มีไฟล์ให้ตรวจ = ไม่ผ่าน (ดู scripts/lib/ต้องมีของให้ตรวจ.mjs) */
const ไฟล์ที่ตรวจ = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
ต้องมีของให้ตรวจ(ไฟล์ที่ตรวจ.length, 'check-unknown-vs-zero')
for (const file of ไฟล์ที่ตรวจ) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  ไฟล์++
  /* ⚠️ ต้องรู้จัก **คอมเมนต์บล็อกหลายบรรทัด** ด้วย — รอบแรกด่านไปฟ้องบรรทัดในคอมเมนต์
     ที่กำลัง *อธิบายบั๊กนี้* (เขียนโค้ดตัวอย่างไว้ในคำอธิบาย) ⇒ เสียงรบกวนที่ทำให้คนเลิกเชื่อด่าน */
  let ในคอมเมนต์ = false
  readFileSync(file, 'utf8').split('\n').forEach((ln, i) => {
    const t = ln.trim()
    const เปิด = t.includes('/*'), ปิด = t.includes('*/')
    const เดิม = ในคอมเมนต์
    if (เปิด && !ปิด) ในคอมเมนต์ = true
    else if (ปิด) ในคอมเมนต์ = false
    if (เดิม || (เปิด && !ปิด)) return
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
    if (!RE.test(ln)) return
    if (ยกเว้น[`${rel}:${i + 1}`]) return
    พบ.push(`${rel}:${i + 1}  ${t.slice(0, 110)}`)
  })
}

console.log(`ตรวจ "ไม่รู้ ≠ 0" ในไฟล์ ${ไฟล์} ไฟล์ · ยกเว้นไว้ ${Object.keys(ยกเว้น).length}`)
if (พบ.length) {
  console.error('\n🔴 แปลงคำตอบที่ขาดช่องให้เป็นเลข 0 — จอจะยืนยันเลขที่ยังไม่รู้')
  for (const x of พบ) console.error('   ' + x)
  console.error('\n   วิธีแก้: คืน null แทน 0 (เช่น `const num = (v) => typeof v === "number" ? v : null`)')
  console.error('   แล้วให้จอเขียนว่า "ยังไม่รู้" · ถ้าจุดนั้นยอมได้จริง ให้ใส่เหตุผลใน `ยกเว้น` ของ scripts/check-unknown-vs-zero.mjs')
  process.exit(1)
}
console.log('✅ ไม่มีการแปลง "ท่อไม่ได้บอก" ให้เป็น 0 ในช่องที่พูดถึงทั้งชุด')
