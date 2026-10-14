/* ท่อปลอมสำหรับพิสูจน์ว่า `วัดสัญญาแท็บชำระเงิน.mjs` **ร้องได้จริงและร้องถูกเหตุ**
   โลกที่เราสั่งให้ผิดได้ — ไม่ต้องทำให้ของจริงผิด (ใบ: ท่อปลอมใช้เป็นเครื่องปลูกของเสียได้)
   ใช้: node fixtures-ท่อปลอม-แท็บชำระเงิน.mjs <โหมด>   (เรียกโดย scripts/ปลูก-สัญญาแท็บชำระเงิน.sh) */
import { createServer } from 'node:http'
const โหมด = process.argv[2]
const เต็ม = [{ status: 'Success', orders: 6775 }, { status: 'Voided', orders: 489 },
  { status: 'Pending', orders: 167 }, { status: 'Waiting', orders: 1 }]
const แคบ = [{ status: 'Pending', orders: 144 }, { status: 'Success', orders: 15 }]
/** ก้อนแยกฐาน "ยกเว้น status" — **ต้องเท่ากันทุกคำขอ** */
const payฐานแท็บ = [{ payStatus: 'Paid', orders: 7257, amount: 7_000_000 },
  { payStatus: 'Pending', orders: 159, amount: 300_000 }]
/** ก้อนแยกฐาน `w` — ต้องขยับตามตัวกรอง */
const payตามกรอง = (กรองstatus) => (กรองstatus
  ? [{ payStatus: 'Paid', orders: 1, amount: 500 }]
  : payฐานแท็บ)
/** ก้อนแยกตาม `status` บนฐาน `w` — **ผลรวมเงินต้องเท่ากับ payตามกรอง** (แบ่งแถวชุดเดียวกัน) */
const statusตามกรอง = (กรองstatus) => (กรองstatus
  ? [{ status: 'Waiting', orders: 1, amount: 500 }]
  : [{ status: 'Success', orders: 7000, amount: 7_100_000 },
    { status: 'Pending', orders: 160, amount: 200_000 }])   // รวม 7,300,000 = payฐานแท็บ

createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  const กรองpay = u.searchParams.has('paystatus')
  const กรองstatus = u.searchParams.has('status')
  const o = {
    ok: true,
    total: กรองpay ? 159 : กรองstatus ? 1 : 7432,
    byStatus: กรองpay ? แคบ : เต็ม,
  }
  const ครบชุด = () => {
    o.byStatus = กรองstatus ? [{ status: 'Waiting', orders: 1 }] : เต็ม
    o.byPayStatus = payฐานแท็บ
    o.payStatusesAll = ['Paid', 'Pending', 'Voided']
    o.tabBase = { excludes: ['status', 'paystatus'] }
    o.byPayStatusFiltered = payตามกรอง(กรองstatus)
    o.byStatusFiltered = statusตามกรอง(กรองstatus)
    o.totalPaidAmountByPay = 7_000_000
    o.totalUnpaidAmountByPay = 300_000
  }
  if (โหมด === 'ฐานเปลี่ยนไม่ประกาศ') o.byStatus = เต็ม
  if (โหมด === 'ประกาศแต่ยังผูก') o.tabBase = { excludes: ['status', 'paystatus'] }
  if (โหมด === 'ขาดสารบัญ') {
    o.byPayStatus = payฐานแท็บ; o.byStatus = เต็ม
    o.tabBase = { excludes: ['status', 'paystatus'] }
  }
  if (โหมด === 'ครบ') ครบชุด()
  // 🔴 สองช่องเงินใช้ฐานเดียวกัน ⇒ เลขเงินบนหัวจอเป็นของทุกสถานะ ทั้งที่แถวถูกกรองแล้ว
  if (โหมด === 'สองช่องฐานเดียวกัน') { ครบชุด(); o.byPayStatusFiltered = payฐานแท็บ }
  // 🔴 ก้อนแยกฐานแท็บผูกกับ status ⇒ กดแท็บชำระเงินแล้วตัวนับแท็บสถานะเพี้ยน
  if (โหมด === 'ฐานแท็บผูกกับstatus') { ครบชุด(); if (กรองstatus) o.byPayStatus = payตามกรอง(true) }
  // 🔴 สองก้อนบนฐาน `w` คิดจากคนละฐาน ⇒ ผลรวมเงินไม่เท่ากัน ⇒ จอที่เอามาเทียบได้ส่วนต่างลวง
  if (โหมด === 'สองก้อนคนละฐาน') {
    ครบชุด()
    o.byStatusFiltered = [{ status: 'Success', orders: 7000, amount: 9_999_999 }]
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(o))
}).listen(8191, '127.0.0.1')
