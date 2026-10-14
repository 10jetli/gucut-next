/* ด่าน: แถบแท็บจอรายการขาย `/core/sales` — **สองมิติในแถบเดียว**
 *
 * 🔴 ทำไมต้องมีด่านนี้ (14 ต.ค. 2569 · คุณส้ม · งาน "ลอก ZORT 100%")
 *    แท็บ "รอชำระ" ของ ZORT อ่านคอลัมน์ `pay_status` ส่วนแท็บอื่นอ่าน `status`
 *    📏 วัดจากกระจกจริง (z1 · 1 ต.ค. 2568–14 ต.ค. 2569 · ครบ 7,748 ใบ = `total` ของท่อเอง):
 *       status=Pending 176 · pay_status=Pending 168 · ซ้อนกัน 153
 *       ⇒ 23 ใบ "รอโอน แต่จ่ายแล้ว" · 15 ใบ "สำเร็จ แต่ยังไม่ได้เงิน"
 *    ⇒ ถ้าแท็บนี้ไปอ่าน `byStatus` จอจะโกหกสองทาง **โดยที่เลขดูสมเหตุสมผลทุกตัว**
 *
 * 🔑 ตัวเลขในเทสนี้เป็น **รูปของข้อมูลจริง** (ค่าจากการวัดวันนั้น) ไม่ใช่ค่าสุ่ม
 *    ⇒ ข้อ "ห้ามอ่าน byStatus" จึงจับได้จริง: ถ้าอ่านผิดคอลัมน์ เลขจะเป็น 176 ไม่ใช่ 168
 * ⚠️ เทสนี้เรียก **ฟังก์ชันตัวเดียวกับที่จอใช้** (ไม่เลียนแบบเกณฑ์เอง)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { สร้างแถบแท็บขาย, คำนำหน้าแท็บชำระเงิน, แท็บชำระเงินของZORT } from '../../lib/sales-tabs.ts'

/** ชุดข้อมูลรูปเดียวกับที่ท่อส่งจริง (ค่าที่วัดได้ 14 ต.ค. 2569) */
const สถานะทั้งระบบ = ['Pending', 'Returned', 'Success', 'Voided', 'Waiting']
const byStatusเต็ม = [
  { status: 'Success', orders: 7072 },
  { status: 'Voided', orders: 499 },
  { status: 'Pending', orders: 176 },
  { status: 'Waiting', orders: 1 },
]
/** ของจริงตอนส่ง `paystatus=Pending`: ท่อคิด `byStatus` จากกองที่กรองแล้ว ⇒ เหลือ 2 แถว */
const byStatusตอนกรองชำระเงิน = [
  { status: 'Pending', orders: 153 },
  { status: 'Success', orders: 15 },
]
const ฐาน = {
  รายชื่อสถานะ: สถานะทั้งระบบ,
  byStatus: byStatusเต็ม,
  byPayStatus: null,
  tabBase: null,
  total: 7748,
  status: '',
  fPay: '',
  ป้ายสถานะ: (st) => `สถานะ:${st}`,
  ป้ายชำระเงิน: (v) => `ชำระเงิน:${v}`,
}
const idแท็บชำระเงิน = `${คำนำหน้าแท็บชำระเงิน}${แท็บชำระเงินของZORT}`
const หา = (r, id) => r.tabs.find((t) => t.id === id)

test('แท็บรอชำระมีอยู่เสมอ และ **ไม่มีวงเล็บ** เมื่อท่อยังไม่ส่ง byPayStatus (ไม่รู้ ≠ 0)', () => {
  const r = สร้างแถบแท็บขาย(ฐาน)
  const t = หา(r, idแท็บชำระเงิน)
  assert.ok(t, 'แท็บรอชำระต้องมีอยู่ — ท่อกรอง paystatus= ได้อยู่แล้ว ⇒ กดได้จริง')
  assert.equal(t.count, undefined, 'ไม่รู้จำนวน ⇒ ต้องไม่มีวงเล็บ ห้ามเป็น 0')
})

test('🔴 ตัวนับแท็บรอชำระต้องมาจาก byPayStatus **ห้ามยืม byStatus** (176 ≠ 168)', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, byPayStatus: [{ payStatus: 'Pending', orders: 168 }] })
  const t = หา(r, idแท็บชำระเงิน)
  assert.equal(t.count, 168, 'ต้องเป็นเลขของคอลัมน์ pay_status')
  assert.notEqual(t.count, 176, 'ถ้าได้ 176 = ไปอ่าน byStatus ซึ่งเป็นคนละคำถาม')
})

test('byPayStatus มาแล้วแต่ไม่มีค่านั้น = **0 จริง** (ต่างจากไม่รู้)', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, byPayStatus: [{ payStatus: 'Paid', orders: 7057 }] })
  assert.equal(หา(r, idแท็บชำระเงิน).count, 0)
})

test('🔴 กรองชำระเงินอยู่ + ท่อไม่ประกาศฐาน ⇒ ตัวนับฝั่งสถานะต้องเป็น "ไม่รู้" ทั้งแถบ', () => {
  const r = สร้างแถบแท็บขาย({
    ...ฐาน, fPay: 'Pending', byStatus: byStatusตอนกรองชำระเงิน,
    byPayStatus: [{ payStatus: 'Pending', orders: 168 }],
  })
  assert.equal(r.ตัวนับสถานะเชื่อได้, false,
    'ตัวนับฝั่งสถานะต้องเป็นไม่รู้ เพราะท่อรุ่นนี้คิดตัวนับแท็บจากกองที่กรองแล้ว')
  // ของจริงถ้าปล่อยไว้: แท็บ "ยกเลิก" จะอ่านว่า (0) ทั้งที่ระบบมี 499 ใบ
  assert.equal(หา(r, 'Voided').count, undefined, 'ยกเลิกต้องไม่มีวงเล็บ ห้ามเป็น 0')
  assert.equal(หา(r, 'Waiting').count, undefined)
  assert.equal(หา(r, '').count, undefined, '"ทั้งหมด" ก็ถูกกรองด้วยมิติชำระเงิน ⇒ ไม่รู้')
  // แต่ตัวนับของแท็บที่กำลังเลือก (มิติชำระเงิน) ยังบอกได้ เพราะมาจากแหล่งของตัวเอง
  assert.equal(หา(r, idแท็บชำระเงิน).count, 168)
})

test('ท่อประกาศว่าฐานตัวนับไม่ผูกกับ paystatus ⇒ ตัวนับฝั่งสถานะกลับมาโชว์ได้', () => {
  const r = สร้างแถบแท็บขาย({
    ...ฐาน, fPay: 'Pending', tabBase: { excludes: ['status', 'paystatus'] },
    byStatus: byStatusเต็ม, byPayStatus: [{ payStatus: 'Pending', orders: 168 }],
  })
  assert.equal(r.ตัวนับสถานะเชื่อได้, true)
  assert.equal(หา(r, 'Voided').count, 499)
  assert.equal(หา(r, '').count, 7748)
})

test('ฐานที่ประกาศแต่ไม่ครอบ paystatus (เช่น ยกเว้นแค่ status) ⇒ ยังเชื่อไม่ได้', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, fPay: 'Pending', tabBase: { excludes: ['status'] } })
  assert.equal(r.ตัวนับสถานะเชื่อได้, false,
    'ฐานที่ท่อประกาศไม่ครอบ paystatus ⇒ ยังเชื่อตัวนับฝั่งสถานะไม่ได้')
})

test('id ของสองมิติห้ามชนกัน — `Pending` มีอยู่ในทั้งสองคอลัมน์', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, fPay: 'Pending' })
  const ids = r.tabs.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length, 'id ซ้ำ = กดแท็บหนึ่งแล้วไฮไลต์อีกแท็บ')
  assert.ok(ids.includes('Pending') && ids.includes(idแท็บชำระเงิน))
  assert.equal(r.active, idแท็บชำระเงิน, 'กรองชำระเงินอยู่ ⇒ ต้องไฮไลต์แท็บฝั่งชำระเงิน ไม่ใช่ฝั่งสถานะ')
})

test('ไฮไลต์ต้องตรงกับตัวกรองจริง — กรองสองมิติพร้อมกัน = ไม่ไฮไลต์แท็บไหน', () => {
  const เฉพาะสถานะ = สร้างแถบแท็บขาย({ ...ฐาน, status: 'Voided' })
  assert.equal(เฉพาะสถานะ.active, 'Voided')
  assert.equal(เฉพาะสถานะ.ไม่มีแท็บตรง, false)

  const สองมิติ = สร้างแถบแท็บขาย({ ...ฐาน, status: 'Voided', fPay: 'Pending' })
  assert.equal(สองมิติ.ไม่มีแท็บตรง, true, 'ต้องบอกบนจอ ไม่ใช่ปล่อยให้ "ทั้งหมด" ไฮไลต์')
  assert.notEqual(สองมิติ.active, '', '🔴 ห้ามไฮไลต์ "ทั้งหมด" ตอนตารางถูกกรองอยู่')

  const ชำระเงินค่าที่ไม่มีแท็บ = สร้างแถบแท็บขาย({ ...ฐาน, fPay: 'Paid' })
  assert.equal(ชำระเงินค่าที่ไม่มีแท็บ.ไม่มีแท็บตรง, true)
})

test('ไม่มี byStatus เลย (ท่อรุ่นเก่า/ล้ม) ⇒ ไม่รู้ ไม่ใช่ 0 · แต่แท็บยังอยู่ครบ', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, byStatus: null, total: null })
  assert.equal(หา(r, 'Voided').count, undefined)
  assert.equal(หา(r, '').count, undefined)
  assert.equal(r.tabs.length, สถานะทั้งระบบ.length + 2, 'ทั้งหมด + สถานะทั้งระบบ + รอชำระ')
})
