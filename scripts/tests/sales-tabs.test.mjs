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

/* ══ 📑 รายชื่อแท็บ: **ทางสำรองต้องไม่หาย · ไม่ขยับ · ไม่เงียบ** ═══════════════════
   🔴 ฝั่งท่ออ่านโค้ดจอแล้วชี้สองข้อ 14 ต.ค. 2569 (ยืนยันทั้งคู่):
     ① `statusesAllError` ท่อส่งมาให้ แต่ทั้งรีโปจอไม่มีใครอ่าน ⇒ ทางสำรองเดินเงียบ
     ② ของเดิมถอยไปใช้ "ที่จำได้ในเซสชันนี้" เท่านั้น ⇒ รอบแรกที่สารบัญล้ม **แถบว่าง**
        ⇒ อ่านได้ว่า "จอนี้ไม่มีตัวกรอง" (อาการ 18 ก.ย. แต่หายทั้งแถบ)
   🔑 ข้อขัดแย้ง (ไม่หด vs ไม่ว่าง) แก้ด้วย **ยูเนียนแบบต่อท้าย** — เทสล็อกทั้งสองข้อไว้ */
import { รายชื่อสถานะของแท็บ } from '../../lib/sales-tabs.ts'

test('มีสารบัญทั้งระบบ ⇒ ใช้ตัวนั้น และ **ไม่ประกาศทางสำรอง**', () => {
  const r = รายชื่อสถานะของแท็บ({
    statusesAll: ['Pending', 'Success'], ที่จำได้: ['เก่า'],
    byStatus: [{ status: 'Voided', orders: 1 }],
  })
  assert.deepEqual(r.รายชื่อ, ['Pending', 'Success'])
  assert.equal(r.ทางสำรองเพราะ, null, 'ทางปกติต้องไม่ขึ้นคำเตือน ไม่งั้นเสียงหอนทุกรอบ')
})

test('🔴 สารบัญล้ม **รอบแรกของการเปิดหน้า** (ยังไม่เคยจำอะไร) ⇒ ต้องไม่ว่าง', () => {
  const r = รายชื่อสถานะของแท็บ({
    statusesAll: null, statusesAllError: 'อ่านรายชื่อสถานะจากคลังเงาไม่ได้รอบนี้',
    ที่จำได้: [], byStatus: [{ status: 'Success', orders: 9 }, { status: 'Voided', orders: 2 }],
  })
  assert.deepEqual(r.รายชื่อ, ['Success', 'Voided'],
    'รอบแรกที่สารบัญล้มต้องยังมีแท็บจาก byStatus — แถบว่าง = คนอ่านว่าจอนี้ไม่มีตัวกรอง')
  assert.ok(r.ทางสำรองเพราะ?.includes('อ่านรายชื่อสถานะ'), 'ต้องประกาศเหตุที่ท่อบอกมา ไม่ใช่เงียบ')
})

test('🔴 ยูเนียนต้อง **ต่อท้าย ไม่หด ไม่เรียงใหม่** ⇒ ปุ่มไม่ขยับที่ตอนกรอง', () => {
  const จำได้ = ['Pending', 'Success', 'Voided']
  /* กรองอยู่ ⇒ byStatus รอบนี้เหลือสถานะเดียว · ของเดิมถ้าเอา byStatus แทน จะหดเหลือ 1 แท็บ */
  const r = รายชื่อสถานะของแท็บ({
    statusesAll: [], ที่จำได้: จำได้, byStatus: [{ status: 'Success', orders: 3 }],
  })
  assert.deepEqual(r.รายชื่อ, จำได้, 'ต้องไม่หด และลำดับต้องเท่าเดิมเป๊ะ (ปุ่มขยับ = คนกดผิด)')
})

test('สถานะใหม่ที่เพิ่งโผล่ ต้องถูก **ต่อท้าย** ไม่ใช่แทรกหน้า', () => {
  const r = รายชื่อสถานะของแท็บ({
    statusesAll: null, ที่จำได้: ['Pending', 'Success'],
    byStatus: [{ status: 'Returned', orders: 1 }, { status: 'Pending', orders: 5 }],
  })
  assert.deepEqual(r.รายชื่อ, ['Pending', 'Success', 'Returned'])
})

test('ท่อเงียบ (ไม่ส่งสารบัญ ไม่บอกเหตุ) ⇒ ข้อความต้องบอกว่า **ท่อไม่ได้บอกเหตุ**', () => {
  const r = รายชื่อสถานะของแท็บ({ statusesAll: null, ที่จำได้: ['Success'] })
  assert.ok(r.ทางสำรองเพราะ?.includes('ไม่ได้บอกเหตุ'),
    '"ท่ออ่านไม่ได้" กับ "ท่อเงียบ" คนละเรื่อง ⇒ ข้อความต้องแยก (ไม่รู้ ≠ อ่านไม่ได้)')
})

test('ลำดับแท็บตาม ZORT: ทั้งหมด · รอโอน · รอชำระ · สำเร็จ แล้วค่อยแท็บที่เรามีเกิน (อ่าน /Sell/list 15 ต.ค. 2569)', () => {
  const r = สร้างแถบแท็บขาย(ฐาน)
  assert.deepEqual(r.tabs.map((t) => t.id), ['', 'Pending', idแท็บชำระเงิน, 'Success', 'Returned', 'Voided', 'Waiting'])
})

test('ร้านที่ไม่มีสถานะ Pending ในสารบัญ ⇒ ไม่สร้างแท็บรอโอนลอย ๆ แต่รอชำระยังอยู่ถัดจากทั้งหมด', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, รายชื่อสถานะ: ['Success', 'Voided'] })
  assert.deepEqual(r.tabs.map((t) => t.id), ['', idแท็บชำระเงิน, 'Success', 'Voided'])
})

test('ท่อรับหลายสถานะแล้ว ⇒ แท็บรอโอนแบบ ZORT = Pending+Waiting · ตัวนับ = ผลบวก · ไม่มีแท็บรอส่งแยก', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, ท่อรับหลายสถานะ: true })
  assert.deepEqual(r.tabs.map((t) => t.id), ['', 'Pending,Waiting', idแท็บชำระเงิน, 'Success', 'Returned', 'Voided'])
  assert.equal(หา(r, 'Pending,Waiting').count, 176 + 1)
  assert.equal(หา(r, 'Pending,Waiting').label, 'สถานะ:Pending')
})

test('ท่อรุ่นเก่า (ไม่ประกาศ) ⇒ ห้ามส่ง Pending,Waiting — แท็บแยกแบบเดิม', () => {
  const r = สร้างแถบแท็บขาย(ฐาน)
  assert.ok(!r.tabs.some((t) => t.id.includes(',')), 'ท่อเก่าตอบ 0 ใบกับค่าคั่นจุลภาค ⇒ แท็บที่ส่งแบบนั้นคือแท็บหลอก')
})

test('กำลังกรองชำระเงิน (ตัวนับสถานะไม่รู้) ⇒ แท็บรอโอนรวมก็ต้องไม่มีวงเล็บ ห้ามบวกเป็น 0', () => {
  const r = สร้างแถบแท็บขาย({ ...ฐาน, ท่อรับหลายสถานะ: true, fPay: 'Pending' })
  assert.equal(หา(r, 'Pending,Waiting').count, undefined)
})
