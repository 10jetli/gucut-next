#!/usr/bin/env node
/* ด่านก่อน build: จอที่ "ส่งของจริงออกนอกระบบได้" ต้องมีป้ายที่ตั้งใจ ไม่ใช่ป้ายที่ตกทอดมาโดยบังเอิญ
 *
 * 🔴 **ที่มา 18 ก.ย. 2569 (งาน S4/S3)** — เปิดจอจริงบน production แล้วพบว่า
 *    จอที่ `REAL_SEND_ENABLED = true` เหมือนกันทั้งสี่จอ **ติดป้ายคนละแบบ**:
 *      /core/quotations/new · /core/stock/new · /core/purchases/new ⇒ 🟡 "งานเขียนยังทำที่ ZORT"
 *      /core/sales/new                                              ⇒ 🟢 "ใช้แทน ZORT ได้เลย"
 *    สาเหตุ: `/core/sales/new` **ไม่มีในทะเบียน** ⇒ `zortReadyOf()` ตัดท้ายไปเจอ `/core/sales`
 *    ซึ่งเป็นจอ "ดูรายการ" (replace) ⇒ จอที่เขียนเอกสารจริงได้ป้ายของจอที่อ่านอย่างเดียว
 *
 * 🔑 **ด่านนี้ไม่ตัดสินว่าป้ายไหนถูก** — นั่นเป็นนโยบายที่ CEO เป็นเจ้าของ
 *    มันบังคับแค่ว่า **ต้องมีคนเลือกป้ายให้จอที่เขียนของจริง** ไม่ใช่ปล่อยให้ตกทอดมาเงียบ ๆ
 *    (ป้ายที่ตกทอดมาโดยบังเอิญ = ไม่มีใครเคยตัดสินใจ แต่ทุกคนอ่านเหมือนมีคนตัดสินแล้ว)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
function walk(d, out = []) {
  let names
  try { names = readdirSync(d) } catch { return out }
  for (const n of names) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') walk(p, out) }
    else if (n === 'page.tsx') out.push(p)
  }
  return out
}

const หน้า = walk(join(ROOT, 'app'))
ต้องมีของให้ตรวจ(หน้า.length, 'check-ready-badge')

let ทะเบียน = ''
try { ทะเบียน = readFileSync(join(ROOT, 'lib/zort-ready.ts'), 'utf8') } catch { /* ไม่มีไฟล์ */ }
/* 🔒 อ่านทะเบียนไม่ได้ = ตรวจอะไรไม่ได้ (เหตุผลเดียวกับ ต้องมีของให้ตรวจ) */
if (!ทะเบียน.includes('ZORT_READY')) {
  console.error('🔴 อ่าน lib/zort-ready.ts ไม่ได้ หรือไม่มี ZORT_READY — ด่านนี้ตรวจอะไรไม่ได้ ถือว่าไม่ผ่าน')
  process.exit(1)
}

const ขาด = []
let เขียนได้ = 0
for (const f of หน้า) {
  const s = readFileSync(f, 'utf8')
  /* ⚠️ **เฉพาะจอที่เปิดส่งจริงอยู่ตอนนี้** — จอที่ปิดอยู่ยังไม่เขียนอะไรออกไป
     ป้ายที่ตกทอดมาจึงยังไม่อันตราย · บังคับทุกจอที่มีตัวแปรนี้ = ด่านที่เข้มเกินเหตุ
     แล้วคนจะใส่บรรทัดลงทะเบียนแบบขอไปที เพื่อให้ build ผ่าน ซึ่งแย่กว่าไม่มีด่าน */
  if (!/const\s+REAL_SEND_ENABLED\s*=\s*true\b/.test(s)) continue
  เขียนได้++
  const path = f.slice((ROOT + '/app').length).replace(/\/page\.tsx$/, '') || '/'
  /* ต้องมีบรรทัดของตัวเองในทะเบียน — ตกทอดจากพ่อไม่นับ */
  if (!new RegExp(`'${path.replace(/[/]/g, '\\/')}'\\s*:`).test(ทะเบียน)) ขาด.push(path)
}

console.log(`ตรวจป้ายจอที่เปิดส่งจริงอยู่: ${เขียนได้} จอ · ไม่มีบรรทัดของตัวเองในทะเบียน ${ขาด.length} จอ`)
if (ขาด.length) {
  console.error('\n🔴 จอที่เขียนของจริงออกนอกระบบได้ แต่ **ป้ายตกทอดมาจากเส้นทางแม่**')
  for (const p of ขาด) console.error(`   ${p}`)
  console.error('\n   ⇒ คนอ่านป้ายจะเชื่อว่ามีคนตัดสินใจให้จอนี้แล้ว ทั้งที่ไม่มีใครเคยเลือก')
  console.error('   วิธีแก้: เพิ่มบรรทัดของเส้นทางนั้นเองใน lib/zort-ready.ts พร้อมเหตุผลสั้น ๆ')
  process.exit(1)
}
console.log('✅ ทุกจอที่ส่งของจริงได้ มีป้ายที่ถูกเลือกไว้เอง ไม่ได้ตกทอดมา')
