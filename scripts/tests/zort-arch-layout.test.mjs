#!/usr/bin/env node
/* เทสเรขาคณิตของผัง ZORT — **ตัวแทนของตาคน**
 *
 * 🔴 ที่มา 20 ก.ย. 2569: จอนี้ถูกเขียนในวันที่เปิดดูด้วยตาไม่ได้เลยสักทาง
 *    (Netlify ปิด build · `next dev` ติด systemd ของท่านประธานที่ถือ `.next`)
 *    ⇒ กฎของบ้าน: **build ผ่าน ≠ จอถูก** ⇒ ไม่มีตา ต้องมีตัววัด
 *
 * บั๊กชุดแรกของผังแรก (3 ก.ย. 2569) คือ "ตัวหนังสือทะลุกรอบ 9 จุด" ซึ่ง build จับไม่ได้
 * ⇒ เทสนี้จับสิ่งที่ตาจะเห็น: กล่องล้นขอบ · กล่องทับกัน · เส้นชี้ไปหากล่องที่ไม่มี
 *
 * ⚠️ เทสนี้ **ไม่ได้แปลว่าจอสวย** — มันแปลว่า "ไม่มีของทับกันและไม่มีของหลุดขอบ"
 *    การเปิดดูด้วยตายังต้องทำอยู่ดีเมื่อ deploy ได้
 */
import { จัดชั้น, แบ่งแถว, วางกล่อง, แทรกแถบกติกา, แยกหัวกับวงเล็บ } from '../../lib/zort-arch-layout.ts'

let ตก = 0
const ต้อง = (ชื่อ, เงื่อนไข, รายละเอียด = '') => {
  if (เงื่อนไข) console.log(`✅ ${ชื่อ}`)
  else { ตก++; console.error(`🔴 ${ชื่อ}${รายละเอียด ? ' — ' + รายละเอียด : ''}`) }
}

/* รูปจำลองของจริง — ลอก **โครงสร้าง** มาจากคำตอบจริงของท่อ (16 กล่อง / 14 เส้น / ชั้นแรก 10 ใบ)
   ไม่ลอกเนื้อหา เพราะเนื้อหาเป็นของท่อ และจะเปลี่ยนเมื่อไหร่ก็ได้ */
const nodes = [
  { id: 'a1', menu: 'ใบเสนอราคา', group: 'ขาย', ours: 'core/quotations' },
  { id: 'a2', menu: 'รับคืนสินค้า', group: 'ขาย', ours: 'core/return-orders', stock: 'เพิ่มเข้า' },
  { id: 'a3', menu: 'ใบสั่งซื้อ', group: 'ซื้อ', ours: 'core/purchases' },
  { id: 'a4', menu: 'คืนสินค้าผู้ขาย', group: 'ซื้อ', ours: '—', stock: 'ตัดออก' },
  { id: 'a5', menu: 'โอนย้ายสินค้า', group: 'คลัง', ours: 'core/transfers', stock: 'ย้ายคลัง ยอดรวมเท่าเดิม' },
  { id: 'a6', menu: 'สินค้าชุด', group: 'คลัง', ours: 'core/bundles' },
  { id: 'a7', menu: 'ลูกค้า/คู่ค้า', group: 'ผู้ติดต่อ', ours: 'core/customers' },
  { id: 'a8', menu: 'ช่องทางขาย (Shopee/Lazada/TikTok)', group: 'เชื่อมต่อ', ours: 'core/channels' },
  { id: 'a9', menu: 'แชท (social.zortout.com)', group: 'เชื่อมต่อ', ours: 'core/chat' },
  { id: 'a10', menu: 'ขายหน้าร้าน POS', group: 'ขาย', ours: 'core/pos' },
  { id: 'b1', menu: 'รายการขาย', group: 'ขาย', ours: 'core/sales', stock: 'ตัดออก' },
  { id: 'b2', menu: 'รับสินค้าเข้าคลัง', group: 'ซื้อ', ours: 'core/receive', stock: 'เพิ่มเข้า' },
  { id: 'b3', menu: 'คลัง/สาขา', group: 'ตั้งค่า', ours: 'core/branches' },
  { id: 'c1', menu: 'สินค้า', group: 'คลัง', ours: 'core/stock' },
  { id: 'c2', menu: 'เอกสารบัญชี', group: 'เอกสาร', ours: 'core/accounting-docs' },
  { id: 'd1', menu: 'PEAK (นอก ZORT)', group: 'ปลายทาง', ours: 'core/peak' },
]
const edges = [
  { from: 'a8', to: 'b1', basis: 'code' }, { from: 'a10', to: 'b1', basis: 'std' },
  { from: 'a9', to: 'b1', basis: 'std' }, { from: 'a1', to: 'b1', basis: 'std' },
  { from: 'b1', to: 'c1', basis: 'probe' }, { from: 'a6', to: 'c1', basis: 'code' },
  { from: 'a2', to: 'c1', basis: 'code' }, { from: 'a3', to: 'b2', basis: 'code' },
  { from: 'b2', to: 'c1', basis: 'code' }, { from: 'a4', to: 'c1', basis: 'code' },
  { from: 'a5', to: 'b3', basis: 'probe' }, { from: 'b1', to: 'c2', basis: 'code' },
  { from: 'c2', to: 'd1', basis: 'std' }, { from: 'a7', to: 'b1', basis: 'code' },
]
const ข = { M: 40, IN: 1160, CARD_W: 219.2, GAP_X: 16, GAP_Y: 64, TOP: 30 }
const W = ข.M * 2 + ข.IN
const สูงปลอม = (n) => 70 + (n.stock ? 22 : 0) + (แยกหัวกับวงเล็บ(n.menu)[1] ? 22 : 0)

console.log('── กลุ่ม ① จัดชั้นจากเส้นจริง ──')
const ชั้น = จัดชั้น(nodes, edges)
ต้อง('กล่องที่ไม่มีใครชี้เข้า อยู่ชั้น 0', nodes.filter((n) => !edges.some((e) => e.to === n.id)).every((n) => ชั้น[n.id] === 0))
ต้อง('ปลายทางอยู่ลึกกว่าต้นทางทุกเส้น', edges.every((e) => ชั้น[e.to] > ชั้น[e.from]),
  edges.filter((e) => ชั้น[e.to] <= ชั้น[e.from]).map((e) => `${e.from}→${e.to}`).join(','))

console.log('\n── กลุ่ม ② วางกล่องแล้วไม่ล้น ไม่ทับ ──')
const แถว = แบ่งแถว(nodes, ชั้น, 5)
ต้อง('ไม่มีแถวไหนเกิน 5 ใบ', แถว.every((r) => r.ใน.length <= 5))
ต้อง('กล่องครบทุกใบหลังแบ่งแถว', แถว.reduce((s, r) => s + r.ใน.length, 0) === nodes.length)
const วาง = วางกล่อง(แถว, ข, สูงปลอม)
const แถบ = แทรกแถบกติกา(แถว, วาง, 60, ข.GAP_Y)
const ก = Object.entries(วาง.พิกัด)
ต้อง('ทุกกล่องมีพิกัดเป็นตัวเลข', ก.every(([, v]) => [v.x, v.y, v.w, v.h].every(Number.isFinite)))
ต้อง('ไม่มีกล่องล้นขอบซ้าย/ขวา', ก.every(([, v]) => v.x >= ข.M - 0.5 && v.x + v.w <= W - ข.M + 0.5),
  ก.filter(([, v]) => v.x < ข.M - 0.5 || v.x + v.w > W - ข.M + 0.5).map(([k]) => k).join(','))
ต้อง('ไม่มีกล่องล้นขอบล่าง', ก.every(([, v]) => v.y + v.h <= แถบ.สูงรวม))
const ทับ = []
for (let i = 0; i < ก.length; i++) for (let j = i + 1; j < ก.length; j++) {
  const [ka, a] = ก[i], [kb, b] = ก[j]
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) ทับ.push(`${ka}×${kb}`)
}
ต้อง('ไม่มีกล่องทับกันเลย', ทับ.length === 0, ทับ.join(' '))
ต้อง('แถบกติกาสต็อกอยู่กลางผัง ไม่ใช่ท้ายสุด', แถบ.ตำแหน่ง > ข.TOP && แถบ.ตำแหน่ง < แถบ.สูงรวม * 0.9,
  `ตำแหน่ง ${แถบ.ตำแหน่ง} จากสูงรวม ${แถบ.สูงรวม}`)

console.log('\n── กลุ่ม ③ เส้นต้องชี้ไปหากล่องที่มีอยู่จริง ──')
const ขาด = edges.filter((e) => !วาง.พิกัด[e.from] || !วาง.พิกัด[e.to])
ต้อง('ทุกเส้นมีกล่องปลายทั้งสองข้าง', ขาด.length === 0, ขาด.map((e) => `${e.from}→${e.to}`).join(','))

console.log('\n── กลุ่ม ④ ของแปลกที่ท่ออาจส่งมาวันหนึ่ง ──')
ต้อง('ข้อมูลว่าง ⇒ ไม่พัง', (() => {
  const ช = จัดชั้น([], [])
  const ถ = แบ่งแถว([], ช, 5)
  return Object.keys(ช).length === 0 && ถ.length === 0
})())
ต้อง('เส้นที่ชี้ไปหากล่องที่ไม่มี ⇒ ไม่พัง และไม่สร้างกล่องผี', (() => {
  const ช = จัดชั้น([{ id: 'x', menu: 'x' }], [{ from: 'x', to: 'ไม่มีจริง' }])
  return !('ไม่มีจริง' in ช)
})())
ต้อง('กราฟที่วนเป็นวง ⇒ จบภายในเวลา ไม่ค้าง', (() => {
  const t = Date.now()
  จัดชั้น([{ id: 'p', menu: 'p' }, { id: 'q', menu: 'q' }], [{ from: 'p', to: 'q' }, { from: 'q', to: 'p' }])
  return Date.now() - t < 1000
})())
ต้อง('แยกวงเล็บแล้วตัวอักษรไม่หายสักตัว', (() => {
  for (const n of nodes) {
    const [หัว, วง] = แยกหัวกับวงเล็บ(n.menu)
    const รวม = วง ? `${หัว} ${วง}` : หัว
    if (รวม.replace(/\s+/g, '') !== n.menu.replace(/\s+/g, '')) return false
  }
  return true
})())

console.log(`\n${ตก ? `🔴 ตก ${ตก} ข้อ` : '✅ ผ่านทุกข้อ'}`)
process.exit(ตก ? 1 : 0)
