/* เทสตรึงการอ่าน `?list=bundleitems` (21 ต.ค. 2569 · ใบ CEO 17:56)
 * 🔴 rows: [] มีหลายความหมาย — ห้ามตัดสินว่า "ไม่มี" จากจำนวนแถวอย่างเดียว
 * 🔑 สามสถานะของช่อง asked: ไม่มีคีย์ (ท่อรุ่นเก่า) ≠ null (โหมดนี้ไม่ได้ถาม) ≠ {exists: true/false}
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { สภาพแถวชุด } from '../../lib/bundleitems.ts'

test('มีแถว ⇒ มีแถว (ไม่สนช่อง asked)', () => {
  assert.deepEqual(สภาพแถวชุด({ rows: [{ sku: 'A' }, { sku: 'B' }], asked: { exists: false } }), { ชนิด: 'มีแถว', จำนวน: 2 })
})

test('รหัสไม่มีในทะเบียน ⇒ ไม่รู้จักรหัส (ไม่ใช่ ว่างจริง)', () => {
  assert.deepEqual(สภาพแถวชุด({ rows: [], asked: { kind: 'bundle', sku: 'ZZZ-NOPE-999', exists: false } }), { ชนิด: 'ไม่รู้จักรหัส', รหัส: 'ZZZ-NOPE-999' })
})

test('รู้จักรหัส แต่ 0 แถว ⇒ ว่างจริง', () => {
  assert.deepEqual(สภาพแถวชุด({ rows: [], asked: { sku: '00073-30-KK', exists: true } }), { ชนิด: 'ว่างจริง' })
})

test('ท่อรุ่นเก่า ไม่มีคีย์ asked ⇒ ยังแยกไม่ได้ (ห้ามเดาว่าว่าง)', () => {
  assert.deepEqual(สภาพแถวชุด({ rows: [] }), { ชนิด: 'ยังแยกไม่ได้' })
})

test('asked เป็น null (โหมดสรุปรวม) ⇒ ยังแยกไม่ได้ ไม่ใช่ ว่างจริง', () => {
  assert.deepEqual(สภาพแถวชุด({ rows: [], total: null, asked: null }), { ชนิด: 'ยังแยกไม่ได้' })
})

test('คำตอบพัง (null/ไม่ใช่ออบเจกต์) ⇒ ยังแยกไม่ได้', () => {
  assert.deepEqual(สภาพแถวชุด(null), { ชนิด: 'ยังแยกไม่ได้' })
  assert.deepEqual(สภาพแถวชุด('x'), { ชนิด: 'ยังแยกไม่ได้' })
})
