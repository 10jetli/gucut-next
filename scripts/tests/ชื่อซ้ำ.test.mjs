/* ป้ายเตือน "ชื่อลูกค้าซ้ำ" — ทดสอบด้วยการ **ป้อนค่าจริงแล้วรัน** ไม่ใช่อ่านโค้ด
 * (19 ก.ย. 2569 · ฝั่งท่อเพิ่มธง `ชื่อซ้ำกันหลายราย`)
 *
 * 🔑 ข้อที่ใบนี้คุ้มกัน: `undefined` (ท่อรุ่นเก่า) **ห้ามถูกอ่านเป็น "ไม่ซ้ำ"**
 *    เพราะถ้ายุบสองอย่างนี้ จอจะเงียบสนิทในวันที่ท่อยังไม่ได้ deploy
 *    ⇒ คนเห็นยอดของคนอื่นโดยไม่มีอะไรบอก
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { โหลดโมดูลจากTS } from '../lib/โหลดโมดูลจากTS.mjs'

/* ⚠️ ลอกตรรกะมาไว้ในเทสไม่ได้เด็ดขาด (จะกลายเป็นทดสอบสำเนา)
   ⇒ ถอด type annotation ออกแล้ว import ไฟล์จริง — ตัวช่วยอยู่ที่ scripts/lib/โหลดโมดูลจากTS.mjs
   (รวมจากสองสำเนา 19 ก.ย. 2569 · ตัวช่วยประกาศจุดบอดของตัวเองไว้ในหัวไฟล์) */
const mod = await โหลดโมดูลจากTS(
  new URL('../../lib/ชื่อซ้ำ.ts', import.meta.url),
  [[/:\s*(boolean \| undefined|boolean)\b/g, '']],
)
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
