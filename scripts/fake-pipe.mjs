// ท่อปลอม — เอาไว้ดูว่า "จอพูดอะไรตอนของพัง" ของจริง ไม่ใช่เดาจากโค้ด
//
// 📍 **ไฟล์ตัวจริงอยู่ที่นี่** (`gucut-next/scripts/fake-pipe.mjs`) — เดิมอยู่ใน ~/claude-shared
//    ย้ายเข้ารีโปเพราะเครื่องมือทดสอบต้องเดินทางไปกับโค้ดที่มันทดสอบ
//    (อยู่นอกรีโป = คนที่ clone มาไม่มีวันรู้ว่ามีของชิ้นนี้ แล้วก็ไม่มีใครทดสอบเรื่องนี้อีกเลย)
//
// ทำไมต้องมี (6 ก.ย. 2569): คำเตือนบนจอเกือบทุกอันเขียนว่า "ถ้าท่อล่มจะขึ้นแบบนี้"
// แต่ไม่เคยมีใคร **ทำให้ท่อล่มจริง** เพื่อดูว่ามันขึ้นแบบนั้นจริงไหม
// ⇒ ตัวนี้ปลอมเป็น gucut.com/api/* แล้วป้อนความพังแบบต่าง ๆ ให้จอกิน
//
// วิธีใช้ (ต้องใช้ dev เท่านั้น — next start นับเป็น production แล้วท่อกลางจะเมิน GUCUT_WEB_BASE)
//   node scripts/fake-pipe.mjs 4010 500      ← ล่ม 500 ทุกเส้น
//   node scripts/fake-pipe.mjs 4010 empty    ← ตอบ {} ทุกเส้น (ก้อนว่าง)
//   node scripts/fake-pipe.mjs 4010 partial  ← ตอบครึ่ง ๆ กลาง ๆ (ขาดช่องสำคัญ)
//   node scripts/fake-pipe.mjs 4010 slow     ← ตอบช้า 30 วิ (ทดสอบ timeout)
//   node scripts/fake-pipe.mjs 4010 html     ← ตอบ HTML แทน JSON (เจอจริงตอนโดนหน้า error)
//   node scripts/fake-pipe.mjs 4010 failedparts ← 200 แต่บอกเองว่าบางส่วนล้ม (failed[])
//   node scripts/fake-pipe.mjs 4010 good    ← ตอบครบทุกช่อง (ใช้พิสูจน์ว่าตัวกันไม่ฟ้องมั่ว)
//   node scripts/fake-pipe.mjs 4010 skip    ← สถานะที่สาม "ทำต่อไม่ได้" (ต้องขึ้นเหลือง ไม่ใช่แดง)
//   node scripts/fake-pipe.mjs 4010 nocounts ← มีงานค้างแต่ไม่มียอดแยกกอง (เทสคำเตือน "ใบผี")
// แล้วอีกหน้าต่าง:
//   cd ~/gucut-next && GUCUT_WEB_BASE=http://127.0.0.1:4010 GUCUT_WEB_ADMIN_KEY=devkey123 \
//     SITE_PASSWORD=devpass npx next dev -p 3101
// ⚠️ **GUCUT_WEB_ADMIN_KEY ต้องเป็นอังกฤษ/ตัวเลขเท่านั้น** — ใส่ภาษาไทยแล้วสร้าง header ไม่ได้
//    ท่อกลางจะ 500 ทุกคำขอ โดยข้อความผิดพลาดชี้ไปคนละเรื่อง (เสียเวลาไปหนึ่งรอบ 6 ก.ย. 2569)
//
// ⚠️ **ห้ามเอาไปรันบนเซิร์ฟเวอร์จริงเด็ดขาด** — มันตอบมั่วโดยตั้งใจ
// ⚠️ ผลที่ได้คือ "จอเขียนว่าอะไร" ไม่ใช่ "จอถูกหรือผิด" — คนต้องอ่านแล้วตัดสินเอง
//    เกณฑ์ที่ใช้ตัดสิน (จากบทเรียนทั้งวัน):
//      ① ล้มเหลวแล้วจอต้อง **ไม่เขียนเลข** (โดยเฉพาะเลข 0) เป็นข้อเท็จจริง
//      ② ต้องไม่ค้างที่ "กำลังโหลด…" ตลอดกาล
//      ③ ต้องบอกว่า **ทำอะไรต่อ** ไม่ใช่แค่บอกว่าพัง
import { createServer } from 'node:http'

const port = Number(process.argv[2] || 4010)
const mode = String(process.argv[3] || '500')

/** ตอบครึ่ง ๆ กลาง ๆ — มีคีย์บางตัว ขาดตัวสำคัญ (แบบท่อรุ่นเก่า/รุ่นกำลังเปลี่ยน)
 *  จงใจ **ไม่ใส่** counts · totalPaidAmount · added เพื่อดูว่าจอเขียน 0 หรือเขียนว่าไม่รู้ */
const PARTIAL = {
  ready: true,
  rows: [],
  byChannel: [],
  byStatus: [],
  channels: [],
  from: '2026-09-01', to: '2026-09-06',
  total: 3, totalAmount: 1234.5,
  limit: 50, offset: 0,
  ok: true,
}

/** ของปลอมสำหรับ /api/zort-archive — ใช้ทดสอบจอ "ของที่คัดจาก ZORT"
 *  ⚠️ ตั้งใจให้มีทั้งกรณี **ครบ · ยังไม่ครบ · ว่างที่ตรวจแล้ว · ไม่มี source · ไม่มีเวลา**
 *     เพราะสี่อย่างนี้คือจุดที่จอชอบโกหก */
const ARCHIVE = {
  ok: true,
  saved: [
    { key: 't/wallet', rows: 46, expected: 46, complete: true, at: '2026-09-06T15:00:00.000Z' }, // ← ของเก่า ไม่มี emptyVerified
    { key: 't/branch', rows: 3, expected: 3, complete: true, emptyVerified: false, at: '2026-09-06T17:01:54.453Z' },
    { key: 't/income', rows: 0, expected: 0, complete: true, emptyVerified: true, at: '2026-09-06T15:20:00.000Z' },
    { key: 't/transfer', rows: 0, expected: 0, at: null },
  ],
  notYet: ['receipt', 'bank', 'return', 'cod'],
  note: 'ของที่คัดจากหน้าจอ ZORT ด้วยมือ',
}
const ARCHIVE_ONE = {
  wallet: {
    ok: true, screen: 'wallet',
    head: ['ชื่อกระเป๋าเงิน', 'ธนาคาร', 'เลขบัญชี', 'คงเหลือ'],
    rows: [
      { name: 'บัญชีหลัก', bank: 'กสิกร', acc: 'x-1234', bal: '1,250,000.00' },
      { name: 'พร้อมเพย์ร้าน', bank: '-', acc: '', bal: '0.00' },
    ],
    rowCount: 2, expected: 46, complete: false,
    source: 'จอ ZORT กระเป๋าเงิน · ช่วง 2560-2569',
    at: '2026-09-06T15:00:00.000Z',
  },
  branch: {
    ok: true, screen: 'branch',
    head: ['#', 'รหัส', 'ชื่อคลัง/สาขา', 'ประเภท', 'มูลค่าสินค้าคงเหลือ', 'เคลื่อนไหวล่าสุด'],
    rows: [{ no: 1, code: 'NEW', name: 'โกดัง', type: 'ทั่วไป', value: '16,423,602.72', lastMove: '6 ก.ย. 2569 23:15' }],
    rowCount: 3, expected: 3, complete: true, emptyVerified: false,
    source: 'จอ ZORT คลังสินค้า/สาขา', at: '2026-09-06T17:01:54.453Z',
  },
  income: { ok: true, screen: 'income', head: [], rows: [], rowCount: 0, emptyVerified: true, source: 'ช่วง 2560-2569', at: '2026-09-06T15:20:00.000Z' },
  transfer: { ok: true, screen: 'transfer', head: [], rows: [], rowCount: 0 },
}

const srv = createServer(async (req, res) => {
  const now = new Date().toISOString()
  console.log(`[${now}] ${req.method} ${req.url}`)
  // เส้นคลังของที่คัดจาก ZORT — ตอบของจริงเสมอ ไม่สนโหมด (ยกเว้นโหมดพังทั้งท่อ)
  if (req.url.startsWith('/api/zort-archive') && mode !== '500' && mode !== 'html') {
    const u = new URL(req.url, 'http://x')
    const one = u.searchParams.get('screen')
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(one ? (ARCHIVE_ONE[one] ?? { head: [], rows: [] }) : ARCHIVE))
  }
  if (mode === 'slow') { await new Promise((r) => setTimeout(r, 30_000)) }
  if (mode === '500') {
    res.writeHead(500, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ error: 'ท่อปลอม: จำลองว่าเซิร์ฟเวอร์ล่ม' }))
  }
  if (mode === 'html') {
    res.writeHead(502, { 'content-type': 'text/html' })
    return res.end('<html><body>502 Bad Gateway</body></html>')
  }
  if (mode === 'skip') {
    /* สถานะที่สาม: "ทำต่อไม่ได้" — คลังเงายังไม่ตั้งค่า / ยังไม่มีภาพถ่ายสต็อก
       จอต้องขึ้น **เหลือง ไม่ใช่แดง** และห้ามขึ้นเลข 0 (สัญญาฝั่งท่อ 6 ก.ย. 2569)
       ⚠️ ตามสัญญานั้น เมื่อมี skip **ช่องข้อมูลจะไม่ถูกส่งมาด้วย** — ตัวปลอมนี้จึงส่งแค่ skip */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ skip: 'คลังเงายังไม่ได้ตั้งค่า D1 — ยังทำส่วนนี้ต่อไม่ได้' }))
  }
  if (mode === 'good' && req.url.startsWith('/api/clip-stats')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, rows: [{ id: 'v1', views: 120, half: 80, full: 40, likes: 9, comments: 2, dur: 31 }] }))
  }
  if (mode === 'good') {
    /* 🟢 โหมด "ปกติ" — ตอบครบทุกช่องที่จอฝั่งเราอ่าน
       ⚠️ **มีไว้พิสูจน์ว่าตัวกันของใหม่ไม่ฟ้องมั่ว** ไม่ได้มีไว้พิสูจน์ว่าข้อมูลถูก
          (ค่าที่อยู่ในนี้เป็นของปลอมทั้งหมด — ห้ามเอาไปเทียบกับของจริง) */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ready: true, ok: true,
      counts: { orders: 12345, items: 2672, snapshots: 900 },
      recon: [{ day: '2026-09-05', zort_orders: 10, zort_amount: 1000, core_orders: 10, core_amount: 1000, diff_notes: 'ตรงกัน' }],
      channels: ['Shopee', 'POS'],
      shopee: [], stock: [],
      from: '2026-09-01', to: '2026-09-06',
      total: 2, totalAmount: 2000, totalPaidAmount: 1500, totalUnpaidAmount: 500,
      limit: 50, offset: 0,
      rows: [
        { id: 1, number: 'SO-001', sku: 'NW-01', name: 'ทดสอบ', qty: 1, amount: 1000, day: '2026-09-05', status: 'Success', channel: 'Shopee', customer: 'ลูกค้าทดสอบ', teeth: 100, teethPerDay: 2, daysLeft: 50 },
        { id: 2, number: 'SO-002', sku: 'NW-02', name: 'ทดสอบ 2', qty: 2, amount: 1000, day: '2026-09-06', status: 'Pending', channel: 'POS', customer: 'ลูกค้าทดสอบ 2', teeth: 40, teethPerDay: 4, daysLeft: 10 },
      ],
      byChannel: [{ channel: 'Shopee', orders: 1, amount: 1000 }],
      byStatus: [{ status: 'Success', orders: 1, amount: 1000 }],

      months: [{ ym: '2026-09', orders: 2, sales: 2000 }],
      customers: [{ name: 'ลูกค้าทดสอบ', orders: 2, sales: 2000, lastDay: '2026-09-06' }],
      warehouses: [{ code: 'NEW', name: 'โกดังหลัก' }],
      'ต้องส่งของ': [{ number: 'SO-001', channel: 'Shopee', day: '2026-09-05', amount: 1000 }],
      byPay: [], methods: {}, moves: [], items: [],
      /* ── ของฝั่ง /web/* (คนละ endpoint แต่ท่อปลอมตอบก้อนเดียว) ── */
      /* ⚠️ ต้องใส่ให้ครบตามชนิดข้อมูลจริงของจอ ไม่งั้นจอจะพัง (ตัวจับพลาดของหน้าเว็บรับไว้ได้
         แต่เราจะทดสอบ "ทางที่ทุกอย่างปกติ" ไม่ได้เลย) */
      orders: [
        {
          id: 'W-001', at: 1757000000000, status: 'new',
          customer: { name: 'ลูกค้าเว็บ', phone: '0812345678', address: 'ที่อยู่ทดสอบ', province: 'หนองคาย', zip: '43000', note: '' },
          items: [{ title: 'สินค้าทดสอบ', variant: '-', price: 1000, qty: 1 }],
          paymentLabel: 'โอนผ่าน Beam', discount: 0, subtotal: 1000, shipping: 100, codFee: 0, total: 1100,
          taxInvoice: null, hasSlip: false, paidAt: 1757000100000,
        },
      ],
      /* สถิติคลิป — ชื่อช่องตามจอ /web/clips */
      clipStats: [{ id: 'v1', views: 120, half: 80, full: 40, likes: 9, comments: 2, dur: 31 }],
      counts: { orders: 12345, items: 2672, snapshots: 900 },
    }))
  }
  if (mode === 'failedparts') {
    // ท่อยังตอบ 200 แต่บอกเองว่าบางส่วนดึงไม่สำเร็จ — จอต้องเขียนว่า "ดึงไม่ได้" ไม่ใช่ "ยังไม่มีข้อมูล"
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ...PARTIAL,
      counts: { orders: 12345, items: 2672, snapshots: 900 },
      failed: ['recon', 'stock', 'channels', 'shopee'],
      failedWhy: { recon: 'D1 ตอบช้าเกินกำหนด', stock: 'ไม่มีสิทธิ์อ่านตาราง' },
    }))
  }
  if (mode === 'nocounts') {
    /* มีรายการงานค้างจริง แต่ **ไม่มีช่อง counts** — ใช้ทดสอบว่าคำเตือน "ใบผี" หายไปเงียบ ๆ ไหม */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ 'ต้องส่งของ': [{ number: 'SO-9', channel: 'Shopee', day: '2026-09-05', amount: 500 }] }))
  }
  if (mode === 'empty') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end('{}')
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(PARTIAL))
})

srv.listen(port, '127.0.0.1', () => {
  console.log(`ท่อปลอมโหมด "${mode}" ฟังอยู่ที่ http://127.0.0.1:${port}`)
  console.log('ต่อไป: cd ~/gucut-next && GUCUT_WEB_BASE=http://127.0.0.1:' + port + ' npm run dev')
})
