/* ท่อปลอมสำหรับพิสูจน์ว่า `วัดสัญญาแท็บชำระเงิน.mjs` **ร้องได้จริงและร้องถูกเหตุ**
   โลกที่เราสั่งให้ผิดได้ — ไม่ต้องทำให้ของจริงผิด (ใบ: ท่อปลอมใช้เป็นเครื่องปลูกของเสียได้) */
import { createServer } from 'node:http'
const โหมด = process.argv[2]
const เต็ม = [{ status: 'Success', orders: 6775 }, { status: 'Voided', orders: 489 },
  { status: 'Pending', orders: 167 }, { status: 'Waiting', orders: 1 }]
const แคบ = [{ status: 'Pending', orders: 144 }, { status: 'Success', orders: 15 }]
createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  const กรอง = u.searchParams.has('paystatus')
  const o = { ok: true, total: กรอง ? 159 : 7432, byStatus: กรอง ? แคบ : เต็ม }
  if (โหมด === 'ฐานเปลี่ยนไม่ประกาศ') o.byStatus = เต็ม
  if (โหมด === 'ประกาศแต่ยังผูก') o.tabBase = { excludes: ['status', 'paystatus'] }
  if (โหมด === 'ขาดสารบัญ') { o.byPayStatus = [{ payStatus: 'Pending', orders: 159 }]; o.byStatus = เต็ม; o.tabBase = { excludes: ['status', 'paystatus'] } }
  if (โหมด === 'ครบ') {
    o.byStatus = เต็ม
    o.byPayStatus = [{ payStatus: 'Paid', orders: 7257 }, { payStatus: 'Pending', orders: 159 }]
    o.payStatusesAll = ['Paid', 'Pending', 'Voided']
    o.tabBase = { excludes: ['status', 'paystatus'] }
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(o))
}).listen(8191, '127.0.0.1')
