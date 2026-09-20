#!/usr/bin/env node
/* เทสของ `lib/หัวยุค.ts` — ค่าที่จะถูกใส่ในหัว HTTP
 *
 * 🔴 **ทำไมต้องมีเทสนี้** (21 ก.ย. 2569) — ค่านี้ถูกใส่ใน middleware ที่ **ห่อทางออกทั้ง 11 ทาง**
 *    ⇒ ถ้าค่าผิดรูป `Headers.set` โยน ⇒ **ทั้งเว็บพังพร้อมกัน** ไม่ใช่พังทีละหน้า
 *    ⇒ ⇒ ของที่อยู่บนทุกทางออก **ต้องมีเทส** ไม่ใช่ "ดูแล้วน่าจะปลอดภัย"
 * 🔑 เคสไทยเป็นเคสหลักของบ้านเรา ไม่ใช่เคสขอบ (เราตั้งชื่อ env และเขียนคอมเมนต์เป็นไทยทั้งรีโป)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ค่าหัวที่ปลอดภัย } from '../../lib/หัวยุค.ts'

test('คอมมิต SHA ปกติ ⇒ ใช้ได้', () => {
  assert.equal(ค่าหัวที่ปลอดภัย('cbb05c8a91'), 'cbb05c8a91')
})

test('อักขระไทย ⇒ ไม่ใส่ (คืน null) ไม่ใช่โยน', () => {
  assert.equal(ค่าหัวที่ปลอดภัย('รุ่นทดสอบ'), null)
})

test('emoji ⇒ ไม่ใส่', () => {
  assert.equal(ค่าหัวที่ปลอดภัย('build-🚀'), null)
})

test('ค่าว่าง/ช่องว่างล้วน ⇒ null (ห้ามใส่หัวว่าง)', () => {
  assert.equal(ค่าหัวที่ปลอดภัย(''), null)
  assert.equal(ค่าหัวที่ปลอดภัย('   '), null)
})

test('ไม่ใช่สตริง ⇒ null', () => {
  assert.equal(ค่าหัวที่ปลอดภัย(undefined), null)
  assert.equal(ค่าหัวที่ปลอดภัย(123), null)
  assert.equal(ค่าหัวที่ปลอดภัย(null), null)
})

test('ยาวเกิน ⇒ ตัด ไม่ใช่ทิ้ง', () => {
  assert.equal(ค่าหัวที่ปลอดภัย('a'.repeat(100))?.length, 64)
})

test('ค่าที่ผ่านตัวกรอง ต้องใส่หัวได้จริง (ยิงกับ Headers ของจริง)', () => {
  const ok = ค่าหัวที่ปลอดภัย('abc-123_x')
  const h = new Headers()
  assert.doesNotThrow(() => h.set('x-screen-build', ok))
  assert.equal(h.get('x-screen-build'), 'abc-123_x')
})

test('ตัวควบคุมลบ: ค่าที่ตัวกรองปฏิเสธ ถ้าฝืนใส่ Headers จะโยนจริง', () => {
  /* 🔑 ข้อนี้พิสูจน์ว่า **ตัวกรองไม่ได้กันของที่ไม่มีอันตราย** — ถ้าไม่มีเคสนี้
     ตัวกรองอาจเข้มเกินจำเป็นโดยไม่มีใครรู้ */
  const h = new Headers()
  assert.throws(() => h.set('x-screen-build', 'รุ่นทดสอบ'))
})
