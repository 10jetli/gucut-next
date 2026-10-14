/* ด่าน: เงิน "ได้เข้าจริง / ยังไม่เข้า" ต้องคิดจากคอลัมน์ `pay_status`
 *
 * 🔴 ที่มา 14 ต.ค. 2569 — ฝั่งท่อเจอเพราะตัวเลขที่จอวัดมา:
 *    `totalPaidAmount`/`totalUnpaidAmount` ของเดิมคิดจากคอลัมน์ `status`
 *    📏 วัดจริง (z1 · 1 ปี · 7,748 ใบ): 23 ใบ "รอโอน แต่จ่ายแล้ว" · **15 ใบ "ปิดใบแล้วแต่เงินยังไม่เข้า"**
 *    ⇒ ทิศที่แพงคือ 15 ใบนั้น: จอเขียนว่าได้เงินแล้ว ⇒ **ไม่มีใครไปตามเก็บ** (ข่าวดีปลอม)
 *
 * 🔑 ข้อที่ฝั่งท่อยืนยันและด่านนี้บังคับ: ท่อส่ง **ก้อนแยก** มาด้วย ไม่ใช่ส่งแต่ยอดรวม
 *    เพราะถ้าส่งแต่ตัวเลข ท่อจะเป็นคนแปลชื่อค่า ⇒ วันที่ ZORT ส่ง `Partial Payment` มา
 *    เงินกองนั้นจะไม่อยู่ในทั้งสองช่องและ **ไม่มีอะไรฟ้อง** ⇒ จอต้องเห็นชื่อค่าดิบและพูดออกมา
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { อ่านเงินตามการชำระ } from '../../lib/sales-tabs.ts'

test('ท่อรุ่นเก่า (มีแต่ยอดรวมจาก status) ⇒ ใช้ได้ **แต่ที่มาต้องบอกว่า status**', () => {
  const r = อ่านเงินตามการชำระ({ totalPaidAmount: 1_000, totalUnpaidAmount: 200 })
  assert.equal(r.ที่มา, 'status', 'ที่มาต้องติดไปกับเลข ไม่งั้นจอเขียนป้ายเองแล้วเดาผิด')
  assert.equal(r.จ่ายแล้ว, 1_000)
  assert.equal(r.ยังไม่จ่าย, 200)
})

test('ท่อรุ่นใหม่ ⇒ ใช้ช่อง *ByPay และที่มาเป็น pay_status', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: 900, totalUnpaidAmountByPay: 300,
    totalPaidAmount: 1_000, totalUnpaidAmount: 200,   // ของเก่าต้องถูกเมิน
    byPayStatusFiltered: [{ payStatus: 'Paid', orders: 9, amount: 900 },
      { payStatus: 'Pending', orders: 3, amount: 300 }],
  })
  assert.equal(r.ที่มา, 'pay_status', 'ท่อส่งช่องใหม่มาแล้ว ⇒ ที่มาต้องเป็น pay_status ไม่ใช่ status')
  assert.equal(r.จ่ายแล้ว, 900, 'ต้องเป็นเลขจากคอลัมน์ pay_status ไม่ใช่ของเก่า')
  assert.equal(r.ยังไม่จ่าย, 300)
  assert.deepEqual(r.ค่าที่ยังไม่จัดกอง, [])
  assert.equal(r.สองแหล่งไม่ตรง, undefined)
})

test('🔴 ค่าที่จอยังไม่รู้ว่าจัดกองไหน (Partial Payment) **ต้องถูกพูดออกมา ห้ามกลืน**', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: 900, totalUnpaidAmountByPay: 300,
    byPayStatusFiltered: [{ payStatus: 'Paid', orders: 9, amount: 900 },
      { payStatus: 'Pending', orders: 3, amount: 300 },
      { payStatus: 'Partial Payment', orders: 1, amount: 50 }],
  })
  assert.deepEqual(r.ค่าที่ยังไม่จัดกอง, ['Partial Payment'],
    'กลืนเงียบ = เงิน 50 บาทหายจากทั้งสองตัวเลขโดยไม่มีอะไรฟ้อง')
})

test('`Voided` ไม่ใช่ค่าที่ไม่รู้จัก — มันคือเงินที่ไม่ใช่ของร้าน', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: 900, totalUnpaidAmountByPay: 300,
    byPayStatusFiltered: [{ payStatus: 'Paid', orders: 9, amount: 900 },
      { payStatus: 'Pending', orders: 3, amount: 300 },
      { payStatus: 'Voided', orders: 2, amount: 7_000 }],
  })
  assert.deepEqual(r.ค่าที่ยังไม่จัดกอง, [], 'ขึ้นเตือนทุกรอบ = เสียงหอน แล้วคนเลิกอ่าน')
})

test('🔴 ยอดรวมกับก้อนแยกไม่ตรงกัน ⇒ ต้องฟ้อง ไม่ใช่เลือกเชื่อข้างหนึ่ง', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: 900, totalUnpaidAmountByPay: 300,
    byPayStatusFiltered: [{ payStatus: 'Paid', orders: 9, amount: 900 },
      { payStatus: 'Pending', orders: 3, amount: 1_250 }],
  })
  assert.ok(r.สองแหล่งไม่ตรง && r.สองแหล่งไม่ตรง.includes('ยังไม่จ่าย'),
    'ท่อส่งสองแหล่งมาให้ ⇒ ไม่เทียบคือทิ้งตาข่ายที่มีอยู่แล้ว')
})

test('ต่างกันไม่ถึงบาท (ปัดเศษ) ⇒ ไม่ฟ้อง', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: 900.4, totalUnpaidAmountByPay: 300,
    byPayStatusFiltered: [{ payStatus: 'Paid', orders: 9, amount: 900 },
      { payStatus: 'Pending', orders: 3, amount: 300 }],
  })
  assert.equal(r.สองแหล่งไม่ตรง, undefined)
})

test('ท่อบอกว่าอ่านไม่ได้ (null) ⇒ **คง null ไว้** ห้ามกลายเป็น 0 หรือ undefined', () => {
  const r = อ่านเงินตามการชำระ({
    totalPaidAmountByPay: null, totalUnpaidAmountByPay: null, byPayStatusFiltered: null,
    totalPaidAmount: 1_000, totalUnpaidAmount: 200,
  })
  assert.equal(r.จ่ายแล้ว, null, 'อ่านไม่ได้ ≠ 0 และ ≠ ของเก่าที่คิดผิดคอลัมน์')
  assert.equal(r.ยังไม่จ่าย, null)
  assert.equal(r.ที่มา, 'pay_status')
})

test('ท่อไม่ส่งอะไรเลย ⇒ ไม่รู้ (ที่มา = null) · จอต้องไม่โชว์เลขเงิน', () => {
  const r = อ่านเงินตามการชำระ({})
  assert.equal(r.ที่มา, null)
  assert.equal(r.จ่ายแล้ว, undefined)
  assert.equal(r.ยังไม่จ่าย, undefined)
})

/* ══ 📋 คำสัญญาที่ให้ฝั่งท่อไว้ 14 ต.ค. 2569 — **ทำเป็นกลไก ไม่ใช่ความจำ** ════════
   ฝั่งท่อจดทะเบียน "ปลายเปิด" ไว้สี่ช่อง โดยถามจอว่า **ถ้าสมาชิกโต จะมีอะไรพังไหม**
   ⇒ คำตอบอยู่ที่ **ฝั่งที่เรนเดอร์** ไม่ใช่ฝั่งที่ส่ง ⇒ ทะเบียนนั้นล้าสมัยทันทีที่จอเปลี่ยนวิธีใช้
   ⇒ เขาขอข้อเดียว: *"วันไหนเอาช่องที่จดว่า **ใช้คิดเลข** ไปเรนเดอร์ออกจอ บอกชื่อช่องก็พอ"*
   🔑 คำสัญญาที่พึ่งความจำของคนตอนกำลังทำงานอื่น = คำสัญญาที่จะถูกข้าม
      ⇒ ผูกกับเทส: ช่องที่จดว่า "คิดเลข" **ต้องไม่โผล่ในจอเลย** · โผล่เมื่อไหร่เทสจะบอกให้ไปแจ้ง
   ⚠️ **ขอบเขตของด่านนี้แคบโดยตั้งใจ** — ครอบได้แค่ `byStatusFiltered` ซึ่งจอไม่อ่านเลยแม้แต่ช่องเดียว
      ส่วน `byPayStatus` จออ่านอยู่จริง (เป็นตัวเลขในวงเล็บของแท็บ) ⇒ แยก "อ่านเป็นเลข" กับ
      "เรนเดอร์เป็นรายชื่อ" ด้วยการ grep ไม่ได้ ⇒ **ไม่อ้างว่าครอบ** (ดูใบ ตัวนับที่วัดกลไกเดียว) */
test('ช่องที่จดกับท่อว่า "ใช้คิดเลข" ต้องไม่ถูกเรนเดอร์ในจอ — โผล่แล้วต้องไปแจ้งฝั่งท่อ', () => {
  const ROOT2 = fileURLToPath(new URL('../..', import.meta.url))
  const เดิน = (ที่) => readdirSync(ที่, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? เดิน(join(ที่, e.name))
      : /\.tsx?$/.test(e.name) ? [join(ที่, e.name)] : []))
  const เจอ = เดิน(join(ROOT2, 'app'))
    .filter((f) => readFileSync(f, 'utf8').includes('byStatusFiltered'))
    .map((f) => f.slice(ROOT2.length))
  assert.deepEqual(เจอ, [],
    'จอเริ่มอ่าน `byStatusFiltered` แล้ว ⇒ **ต้องบอกฝั่งท่อให้เลื่อนเป็นปลายเปิด**'
    + ' (เขาจดไว้ว่า "ใช้คิดเลข ไม่ได้ทำปุ่ม" ตามที่เราตอบไป) · ไฟล์: ' + เจอ.join(' · '))
})
