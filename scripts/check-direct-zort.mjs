#!/usr/bin/env node
/* ด่านก่อน build: จอที่ยิง `/api/zort` ตรง ๆ **ต้องเขียนบนจอว่าตัวเองจะว่างวันที่เลิกใช้ ZORT**
 *
 * 🔴 ที่มา: กฎของโปรเจกต์ที่เขียนไว้เองใน `app/sales/page.tsx` —
 *    **"จอที่ยัง fetch /api/zort อยู่ = ยังไม่เสร็จ"**
 *    เพราะกระจกข้อมูล (ท่อกลาง) คือของที่จะอยู่ต่อ ส่วน ZORT คือของที่ตั้งใจจะเลิกจ่าย
 *    ⇒ จอที่ยังยิงตรงจะ **ว่างเปล่าเงียบ ๆ** ในวันที่ปิด ZORT และไม่มีอะไรบอกคนเปิดจอ
 *
 * 📋 ของจริงวันที่เขียนด่านนี้ (16 ก.ย. 2569): เหลือ 2 จอ — `app/orders` · `app/products`
 *    ทั้งคู่ **ไม่มีลิงก์ในเมนูแล้ว** แต่เปิดด้วย URL ได้ (บุ๊กมาร์กเก่าบนแท็บเล็ตหน้าร้าน)
 *    ⇒ กฎท่านประธานห้ามลบของเดิม ⇒ ทางออกคือ **พูดความจริงบนจอ** ว่าของจริงอยู่ที่ไหน
 *
 * วิธีตรวจ: ไฟล์ `app/**\/page.tsx` ที่มี `/api/zort` ต้องมีข้อความเตือนที่มีคำว่า
 *   "เลิกใช้ ZORT" อยู่ในไฟล์เดียวกัน (ข้อความบนจอ ไม่ใช่คอมเมนต์ — เช็คว่าอยู่นอก // และ /* *​/)
 * ⚠️ ตรวจได้แค่ "มีข้อความ" ไม่ได้ตรวจว่าวางถูกที่ ⇒ ยังต้องเปิดดูด้วยตา
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'
import { ตัดคอมเมนต์ } from './lib/ตัดคอมเมนต์.mjs'

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

/* ใช้ตัวกลาง scripts/lib/ตัดคอมเมนต์.mjs แล้ว (รวบ 19 ก.ย. 2569)
   ของเดิมแทนคอมเมนต์ด้วย **สตริงว่าง** ⇒ คำสองข้างติดกันได้ · ตัวกลางแทนด้วยช่องว่าง
   และตัวกลางตัดคอมเมนต์ **ท้ายบรรทัด** ด้วย ซึ่งของเดิมไม่ตัด */

const ปัญหา = []
/* 🔒 ไม่มีไฟล์ให้ตรวจ = ไม่ผ่าน (ดู scripts/lib/ต้องมีของให้ตรวจ.mjs) */
const ไฟล์ที่ตรวจ = walk(join(ROOT, 'app'))
ต้องมีของให้ตรวจ(ไฟล์ที่ตรวจ.length, 'check-direct-zort')
for (const file of ไฟล์ที่ตรวจ) {
  const src = readFileSync(file, 'utf8')
  if (!/['"`]\/api\/zort/.test(src)) continue
  const เนื้อจอ = ตัดคอมเมนต์(src)
  if (!/เลิกใช้ ZORT/.test(เนื้อจอ)) ปัญหา.push(file.replace(ROOT, ''))
}

if (ปัญหา.length) {
  console.error('🔴 จอที่ยิง /api/zort ตรง ๆ แต่ไม่ได้เขียนบอกคนใช้:\n')
  for (const f of ปัญหา) console.error(`  ${f}`)
  console.error('\n⇒ ใส่ข้อความบนจอ (ไม่ใช่คอมเมนต์) ว่าจอนี้จะว่างวันที่ **เลิกใช้ ZORT**')
  console.error('   พร้อมลิงก์ไปจอที่อ่านจากกระจกข้อมูลแทน — ห้ามลบจอเดิม (กฎท่านประธาน)')
  process.exit(1)
}
console.log('✅ จอที่ยิง ZORT ตรง ๆ เขียนบอกคนใช้ครบแล้ว')
