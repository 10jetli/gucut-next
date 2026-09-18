#!/usr/bin/env node
/* ด่านก่อน build: `{ตัวเลข && <…>}` ทำให้ **เลข 0 โผล่บนจอ/บนกระดาษ**
 *
 * 🔴 ที่มา (17 ก.ย. 2569 · ใบ t_mu2u9mym): ใบยืนยันการจัดส่งพิมพ์ออกมาแล้วมี **เลข 0** โผล่กลางใบ
 *    เหตุ: `is_cod` ของท่อเป็น **ตัวเลข 0/1 ไม่ใช่ boolean** ⇒ `{s.order?.is_cod && <div>…</div>}`
 *          React เรนเดอร์ค่า `0` ออกมาตรง ๆ (ไม่ใช่ซ่อน)
 *    ⚠️ **build ผ่าน · ไม่มี error · ไม่มีอะไรแดง** — เห็นได้ทางเดียวคือเปิดอ่านใบทั้งใบ
 *       (ตรงกับโรคประจำโปรเจกต์: ระบบทำงานถูก แต่สื่อสารผิด)
 *
 * วิธีตรวจ: หา `{<ชื่อที่เป็นตัวเลขแน่ ๆ> && <` ที่ **ไม่มีตัวเปรียบเทียบ** อยู่ในวงเล็บเดียวกัน
 *   (`>` `<` `===` `!==` `typeof` `!!` `Boolean(` ⇒ ปลอดภัยแล้ว เพราะผลเป็น boolean)
 * ⚠️ รายชื่อ "ชื่อที่เป็นตัวเลข" ตั้งจากของที่เจอจริงในโปรเจกต์นี้ — ไม่ได้ครอบจักรวาล
 *    ถ้าเจอชื่อใหม่ที่พลาด ให้เติมในลิสต์ (อย่าปิดด่าน)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = new URL('..', import.meta.url).pathname
/** ชื่อช่อง/ตัวแปรที่ "เป็นตัวเลข" แน่ ๆ ในโปรเจกต์นี้ */
/* ⚠️ ห้ามใส่ `counts` — ในโปรเจกต์นี้ `counts` เป็น **ก้อนอ็อบเจกต์** (แผนที่ชนิด→จำนวน)
   `{obj && …}` ปลอดภัยอยู่แล้ว ⇒ ใส่ไปจะฟ้องผิด 2 จุด (เจอตอนรันครั้งแรก 17 ก.ย. 2569) */
const ตัวเลข = ['length', 'count', 'total', 'qty', 'amount', 'shown', 'scanned', 'orders']
const เป็นตัวเลขนำหน้า = /\bis_[a-z_]+$/      // is_cod · is_active … (ท่อส่งมาเป็น 0/1)
const ปลอดภัย = /(>=|<=|>|<|===|!==|==|!=|typeof|!!|Boolean\(|\?\?|\.some\(|\.every\(|\.includes\()/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const ปัญหา = []
/* 🔒 ไม่มีไฟล์ให้ตรวจ = ไม่ผ่าน (ดู scripts/lib/ต้องมีของให้ตรวจ.mjs) */
const ไฟล์ที่ตรวจ = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]
ต้องมีของให้ตรวจ(ไฟล์ที่ตรวจ.length, 'check-zero-render')
for (const file of ไฟล์ที่ตรวจ) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    /* จับรูป `{ …ชื่อ && <` หรือ `{ …ชื่อ && (` */
    const m = line.match(/\{\s*([A-Za-z0-9_.?[\]'"\s]*?)\s*&&\s*[<(]/)
    if (!m) return
    const ซ้าย = m[1]
    if (ปลอดภัย.test(ซ้าย)) return
    const ชื่อท้าย = (ซ้าย.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/) || [])[1] || ''
    const เสี่ยง = ตัวเลข.includes(ชื่อท้าย) || เป็นตัวเลขนำหน้า.test(ซ้าย.trim())
    if (!เสี่ยง) return
    ปัญหา.push({ ไฟล์: file.replace(ROOT, ''), บรรทัด: i + 1, โค้ด: line.trim().slice(0, 90) })
  })
}

if (ปัญหา.length) {
  console.error('🔴 พบ `{ตัวเลข && <…>}` — ถ้าค่าเป็น 0 React จะพิมพ์ **เลข 0** ลงบนจอ/บนกระดาษ:\n')
  for (const p of ปัญหา) {
    console.error(`  ${p.ไฟล์}:${p.บรรทัด}`)
    console.error(`    ${p.โค้ด}`)
    console.error('    ⇒ แก้เป็น `!!ค่า &&` หรือ `ค่า > 0 &&` (ให้ผลเป็น boolean ก่อน)\n')
  }
  process.exit(1)
}
console.log('✅ ไม่พบ `{ตัวเลข && <…>}` ที่จะทำให้เลข 0 โผล่')
