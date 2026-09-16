#!/usr/bin/env node
/* ด่านก่อน build: จอที่ส่ง `store=` ไปหาท่อ **ต้องอ่านคำตอบว่าท่อใช้ร้านไหนจริง**
 *
 * 🔴 ที่มา (17 ก.ย. 2569 · ใบ t_mu2u9mym): ไล่ดูทุกจอที่มีปุ่มเลือกร้าน พบว่า
 *    **ทุกจอส่ง `store=` ไปทุกครั้ง และไม่มีจอไหนอ่านคำตอบกลับเลย**
 *    ⇒ วันที่ท่อเมิน `store` เงียบ ๆ ปุ่มจะค้างที่ "หน้าร้าน" แต่ตัวเลขเป็นของ "ร้านออนไลน์"
 *
 * 🔑 **ทำไมช่องนี้ต่างจากตัวกรองอื่น** — ตัวกรองผิดคนมักเอะใจเองเพราะของมาน้อย/มากผิดปกติ
 *    แต่ **ร้านผิดจะได้ของมาครบถ้วนสวยงาม เพียงแต่เป็นของอีกร้าน** ไม่มีอะไรดูผิดเลย
 *    และเลขที่ใบของสองร้าน **ซ้ำกันได้** ⇒ อ่านผิดร้านแล้วไม่มีสัญญาณอะไรทั้งสิ้น
 *
 * วิธีตรวจ: ไฟล์ `app/**\/page.tsx` ที่ส่ง `store` ไปกับคำขอ ต้องมี `<StoreEcho` ในไฟล์เดียวกัน
 * ⚠️ ตรวจได้แค่ "มีตัวเทียบอยู่" ไม่ได้ตรวจว่าใส่ `ว่างคือ` ถูกเส้น — ยังต้องดูด้วยตา
 *    (เส้นเอกสารค่าว่าง = z1 · เส้นรายการขายค่าว่าง = ทุกร้าน ⇒ ใส่ผิดคือเตือนหลอก)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name === 'page.tsx') out.push(p)
  }
  return out
}

/* 🔴 **ตัวจับรุ่นแรกฟ้องผิด 2 จาก 3** (แก้ทันทีวันเดียวกัน 17 ก.ย. 2569)
   เดิมจับ `{ store: … }` ดื้อ ๆ ⇒ ไปโดน **ช่องในชนิดข้อมูล** (`interface NeverRow { store: string }`
   ซึ่งเป็นชื่อ *ถังเก็บไฟล์* ไม่ใช่ร้าน) และ **ช่องในอ็อบเจกต์ข้อมูล** (`store: ''` ในแถวช่องทางขาย)
   ⇒ ด่านที่ฟ้องผิดจะถูกคนกดผ่านจนเคยชิน แล้ววันที่มันฟ้องถูกก็จะโดนกดผ่านไปด้วย
   ⇒ จับเฉพาะที่ **ส่งออกไปกับคำขอจริง** เท่านั้น: `.set('store', …)` หรือ `store:` ที่อยู่ใน
     วงเล็บของ `URLSearchParams(` หรือ `&store=` ที่อยู่ใน URL */
function ส่งร้านจริง(src) {
  if (/\.set\(\s*['"]store['"]/.test(src)) return true
  if (/[?&]store=/.test(src)) return true
  for (const m of src.matchAll(/URLSearchParams\(\s*\{/g)) {
    /* อ่านต่อจากวงเล็บปีกกาจนปิด แล้วดูว่ามีช่อง store ไหม */
    let i = m.index + m[0].length - 1, ลึก = 0
    for (; i < src.length; i++) {
      if (src[i] === '{') ลึก++
      else if (src[i] === '}') { ลึก--; if (ลึก === 0) break }
    }
    if (/[{,]\s*store:/.test(src.slice(m.index, i + 1))) return true
  }
  return false
}

const ปัญหา = []
for (const file of walk(join(ROOT, 'app'))) {
  const src = readFileSync(file, 'utf8')
  /* ⚠️ เฉพาะจอที่คุยกับ **ท่อของเรา** — จอที่ยิง `/api/zort` ตรง ใช้รหัสร้านคนละชุด (1/2 ไม่ใช่ z1/z2)
     และมีสัญญาคนละฉบับ ⇒ บังคับด้วยกติกาเดียวกันไม่ได้ (ตัวจับรุ่นก่อนฟ้อง `app/orders` ผิด) */
  if (!src.includes('/api/web/core')) continue
  if (!ส่งร้านจริง(src)) continue
  /* 🔴 **ห้ามใช้ includes('<StoreEcho') เฉย ๆ** — ทดสอบด้วยการปลูกบั๊ก 17 ก.ย. 2569 แล้วด่านไม่ดัง
     เพราะชื่อที่ยาวกว่า (`<StoreEchoX`) **มีข้อความนั้นเป็นคำนำหน้าอยู่แล้ว** ⇒ ผ่านฟรี
     ⇒ ต้องบังคับว่าหลังชื่อต้องเป็นตัวจบแท็กจริง (เว้นวรรค · ขึ้นบรรทัด · `/` · `>`) */
  if (/<StoreEcho[\s/>]/.test(src)) continue
  /* ทางออกสำหรับเส้นที่รูปคำตอบไม่เหมือนชาวบ้าน — ต้องเขียนเหตุผลกำกับ ไม่ใช่ปิดเงียบ
     (แนวเดียวกับ check-inherited: ด่านตัดสินแทนคนไม่ได้ หน้าที่มันคือบังคับให้มีคนตัดสิน) */
  if (src.includes('ตรวจร้านเอง:')) continue
  ปัญหา.push(file.replace(ROOT, ''))
}

if (ปัญหา.length) {
  console.error('🔴 จอที่ส่ง `store=` ไปหาท่อ แต่ไม่ได้เทียบว่าท่อใช้ร้านไหนจริง:\n')
  for (const f of ปัญหา) console.error(`  ${f}`)
  console.error('\n⇒ ใส่ <StoreEcho ขอ={store} ได้={data?.store} ท่อเลือกให้={data?.storeDefaulted} />')
  console.error('   เส้นรายการขายที่รวมทุกร้านได้ ให้เพิ่ม ว่างคือ="ทุกร้าน" ด้วย')
  console.error('   เหตุผล: ร้านผิด = ได้ของมาครบถ้วนสวยงาม แต่เป็นของอีกร้าน — ไม่มีอะไรดูผิดเลย')
  process.exit(1)
}
console.log('✅ ทุกจอที่ส่ง `store=` เทียบคำตอบของท่อแล้ว')
