/* ตัวช่วย "ปลูกแล้ววัด" ต้องแยก **สามผลลัพธ์ที่หน้าตาเหมือนกัน** ออกจากกันได้จริง
 * (19 ก.ย. 2569 — ฝั่งจอเหยียบ "ปลูกไม่ลง แล้วอ่านว่าด่านพัง" 4 ครั้งในวันเดียว)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ปลูกแล้ววัด } from '../lib/ปลูกแล้ววัด.mjs'
import { execFileSync } from 'node:child_process'

const เป้า = 'netlify/functions/bills-watch.mjs'   // ไฟล์จริง · ไม่มีเทสไหน import
const ด่าน = ['node', 'scripts/check-syntax.mjs']

test('🔑 ปลูกไม่ลง (ข้อความไม่มีในไฟล์) ⇒ บอกว่า "ปลูกไม่ลง" ไม่ใช่ "ด่านจับไม่ได้"', () => {
  const r = ปลูกแล้ววัด({ ไฟล์: เป้า, แก้: (s) => s.replace('ZZไม่มีข้อความนี้ZZ', 'x'), ด่าน })
  assert.equal(r.ผล, 'ปลูกไม่ลง')
})

test('ปลูกลงแต่ไม่ทำให้พังจริง ⇒ "ปลูกไม่ลง" (ตัวยืนยันไม่ล้ม)', () => {
  const r = ปลูกแล้ววัด({
    ไฟล์: เป้า,
    แก้: (s) => s + '\n// ZZเติมคอมเมนต์เฉย ๆZZ\n',
    ยืนยันปลูกลง: ['node', '--check', เป้า],
    ด่าน,
  })
  assert.equal(r.ผล, 'ปลูกไม่ลง')
})

test('ปลูกลงจริง + ด่านจับได้ + เอ่ยถึงไฟล์ ⇒ "ด่านจับได้"', () => {
  const r = ปลูกแล้ววัด({
    ไฟล์: เป้า,
    /* รูปเดียวกับบั๊กจริง: ข้อความหลายบรรทัดต่อท้ายบรรทัด `//` */
    แก้: (s) => {
      const l = s.split('\n')
      const i = l.findIndex((x) => x.trim().startsWith('//'))
      l[i] = l[i] + 'export default async function zz(a) {\n  const x = ('
      return l.join('\n')
    },
    ยืนยันปลูกลง: ['node', '--check', เป้า],
    ด่าน,
    ต้องเอ่ยถึง: 'bills-watch',
  })
  assert.equal(r.ผล, 'ด่านจับได้')
})

test('🔒 คืนไฟล์ครบทุกกรณี — ไฟล์ต้องสะอาดใน git หลังรันทุกเทสข้างบน', () => {

  const out = execFileSync('git', ['status', '--porcelain', '--', เป้า], { encoding: 'utf8' })
  assert.equal(out.trim(), '', `ไฟล์ค้างสภาพปลูก: ${out}`)
})
