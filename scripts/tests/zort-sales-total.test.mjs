/* ยอดขายรวมแบบ ZORT — ตรึงด้วยตัวเลขจริง ส.ค. 2569 (ZORT 479,530.2) */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ยอดขายแบบZORT } from '../../lib/zort-sales-total.ts'

const ช่วง = { ตั้งแต่: '2026-08-01', ถึง: '2026-08-31' }
const คืน20ใบ = Array.from({ length: 20 }, (_, i) => ({ status: 'Success', amount: i === 0 ? 11275.5 - 19 * 100 : 100, date: '2026-08-15' }))

test('ส.ค. 2569 ร้าน z1: 490,805.7 − ใบคืน 20 ใบ 11,275.5 = 479,530.2 (เลขของ ZORT)', () => {
  const r = ยอดขายแบบZORT({ ขายชำระแล้ว: 490805.7, ใบคืน: คืน20ใบ, ...ช่วง })
  assert.equal(r.ยอด, 479530.2)
  assert.deepEqual(r.คืนในช่วง, { ใบ: 20, บาท: 11275.5 })
})

test('หักตามวันที่ใบคืน ไม่ใช่วันขาย — ใบคืนนอกช่วงไม่ถูกหัก · ใบคืนที่ไม่สำเร็จไม่ถูกหัก', () => {
  const r = ยอดขายแบบZORT({ ขายชำระแล้ว: 1000, ใบคืน: [
    { status: 'Success', amount: 100, date: '2026-08-31' },
    { status: 'Success', amount: 50, date: '2026-09-01' },
    { status: 'Voided', amount: 70, date: '2026-08-10' },
  ], ...ช่วง })
  assert.equal(r.ยอด, 900)
})

test('ไม่รู้ ≠ 0: ดึงใบคืนไม่ได้ ⇒ ยอด null พร้อมเหตุ · ยอดขายไม่ใช่ตัวเลข ⇒ null', () => {
  assert.equal(ยอดขายแบบZORT({ ขายชำระแล้ว: 1000, ใบคืน: null, ...ช่วง }).ยอด, null)
  assert.equal(ยอดขายแบบZORT({ ขายชำระแล้ว: undefined, ใบคืน: [], ...ช่วง }).ยอด, null)
  assert.equal(ยอดขายแบบZORT({ ขายชำระแล้ว: 1000, ใบคืน: [{ status: 'Success', amount: null, date: '2026-08-02' }], ...ช่วง }).ยอด, null)
})
