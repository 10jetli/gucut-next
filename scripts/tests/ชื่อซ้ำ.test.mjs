/* ป้ายเตือน "ชื่อลูกค้าซ้ำ" — ทดสอบด้วยการ **ป้อนค่าจริงแล้วรัน** ไม่ใช่อ่านโค้ด
 * (19 ก.ย. 2569 · ฝั่งท่อเพิ่มธง `ชื่อซ้ำกันหลายราย`)
 *
 * 🔑 ข้อที่ใบนี้คุ้มกัน: `undefined` (ท่อรุ่นเก่า) **ห้ามถูกอ่านเป็น "ไม่ซ้ำ"**
 *    เพราะถ้ายุบสองอย่างนี้ จอจะเงียบสนิทในวันที่ท่อยังไม่ได้ deploy
 *    ⇒ คนเห็นยอดของคนอื่นโดยไม่มีอะไรบอก
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* อ่าน .ts ตรง ๆ ไม่ได้ ⇒ แปลงเฉพาะส่วนที่ต้องใช้ด้วย regex ง่าย ๆ ไม่ได้เหมือนกัน
   ⇒ ลอกตรรกะมาไม่ได้เด็ดขาด (จะกลายเป็นทดสอบสำเนา) ⇒ ใช้ tsc ที่ build ไว้แล้วก็ยังไม่มี
   ⇒ วิธีที่ซื่อที่สุดที่ทำได้ตอนนี้: ถอด type annotation ออกแล้ว import เป็นโมดูลจริง */
const ที่อยู่ = fileURLToPath(new URL('../../lib/ชื่อซ้ำ.ts', import.meta.url))
const src = readFileSync(ที่อยู่, 'utf8')
  .replace(/export type[^\n]*\n/g, '')
  .replace(/\)\s*:\s*[^{\n]+\{/g, ') {')          // ชนิดของค่าที่คืน
  .replace(/:\s*(boolean \| undefined|boolean)\b/g, '')  // ชนิดของพารามิเตอร์
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
const f = mod.ป้ายชื่อซ้ำจาก

test('ท่อบอกว่าซ้ำ ⇒ ป้ายแดง', () => {
  assert.equal(f(true, true, true), 'ซ้ำ')
})
test('🔑 ท่อรุ่นเก่าไม่ส่งคีย์มา ⇒ "ยังบอกไม่ได้" ไม่ใช่เงียบ', () => {
  assert.equal(f(true, undefined, true), 'ยังบอกไม่ได้')
})
test('ท่อยืนยันว่าไม่ซ้ำ ⇒ ไม่ต้องเตือน', () => {
  assert.equal(f(true, false, true), null)
})
test('เปิดด้วย id ⇒ ไม่เตือนแม้ท่อบอกว่าซ้ำ (ไม่มีความกำกวมเรื่องชื่อ)', () => {
  assert.equal(f(false, true, true), null)
})
test('ยังโหลดไม่เสร็จ ⇒ ยังไม่พูดอะไร', () => {
  assert.equal(f(true, undefined, false), null)
})
test('🔒 สามสถานะต้องให้ผลต่างกันจริง (กันการยุบ undefined กับ false)', () => {
  const ผล = [f(true, true, true), f(true, undefined, true), f(true, false, true)]
  assert.equal(new Set(ผล).size, 3, `ต้องได้ 3 ผลต่างกัน แต่ได้ ${JSON.stringify(ผล)}`)
})
