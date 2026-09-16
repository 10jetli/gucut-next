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
//   node scripts/fake-pipe.mjs 4010 partialgood ← 🔴 **โหมดหลักที่ควรใช้กวาด** — 200 + ก้อนถูกรูปแต่ขาดช่องลูก
//   node scripts/fake-pipe.mjs 4010 503     ← เขียนไม่ได้ ตอบ 503 + เหตุผลไทย (GET ยังปกติ)
//   node scripts/fake-pipe.mjs 4010 skip    ← สถานะที่สาม "ทำต่อไม่ได้" (ต้องขึ้นเหลือง ไม่ใช่แดง)
//   node scripts/fake-pipe.mjs 4010 nocounts ← มีงานค้างแต่ไม่มียอดแยกกอง (เทสคำเตือน "ใบผี")
//   node scripts/fake-pipe.mjs 4010 mkstale ← คอลัมน์ Marketplace เป็นของเก่า (เทสแถบ MarketStaleBar)
//   โหมด good รู้จัก ?zortbundle=&wh= ด้วย: NEW = มีตัวเลข · KLD/ANJ = 'Access Denied.'
//                                          · **SILENT = ไม่มีตัวเลขและไม่บอกเหตุผล** (ทางที่ของจริงไม่มี)
//   node scripts/fake-pipe.mjs 4010 stalestock  ← ?list=bundles ซิงก์สต็อกค้าง 3 ชม. (เทสแถบแดง "ซิงก์น่าจะหยุด")
//   node scripts/fake-pipe.mjs 4010 nostocktime ← ?list=bundles ไม่ส่ง stockSyncedAt (เทส "ยังไม่รู้" ห้ามเขียนว่าหยุด)
//   node scripts/fake-pipe.mjs 4010 zcount ← เส้น ?zortlist= บอก count 350 แต่ส่งแถวมาแค่หน้าแรก
//                                              (เทสคำเตือน "มีทั้งหมด N แสดง M" ซึ่งของจริงยังไม่มีชุดใหญ่ให้ลอง)
// แล้วอีกหน้าต่าง:
//   cd ~/gucut-next && GUCUT_WEB_BASE=http://127.0.0.1:4010 GUCUT_WEB_ADMIN_KEY=devkey123 \
//     SITE_PASSWORD=devpass npx next dev -p 3101
// ⚠️ **GUCUT_WEB_ADMIN_KEY ต้องเป็นอังกฤษ/ตัวเลขเท่านั้น** — ใส่ภาษาไทยแล้วสร้าง header ไม่ได้
//    ท่อกลางจะ 500 ทุกคำขอ โดยข้อความผิดพลาดชี้ไปคนละเรื่อง (เสียเวลาไปหนึ่งรอบ 6 ก.ย. 2569)
//
//
// 🔴 **กติกาการกวาดจอ — เขียนไว้เพราะเคยรายงานผิดมาแล้ว (7 ก.ย. 2569)**
//    ตัวกวาดรอบแรกรอแค่ ~13 วินาทีแล้วสรุปว่า "จอว่าง" ⇒ **เอา "ช้า" ไปเขียนเป็น "พัง"**
//    ของจริง: /core/stock กับ /core/pos ใช้เวลา ~13 วิ (แคชหมดอายุพอดี) แล้วขึ้นครบ 2,666 รายการ
//    ⇒ พาไล่บั๊กผิดตัว และถ้าเชื่อรายงานนั้นก็จะ "แก้" ของที่ไม่ได้พัง
//    ⇒ **ต้องรอจนเห็นสภาพสุดท้ายจริง ๆ** ไม่ใช่รอครบเวลาแล้วตัดสิน:
//       รอจนกว่าจะเจออย่างใดอย่างหนึ่ง — มีเนื้อหาจริง · กล่องแดง/เหลือง · ตัวจับพลาด
//       ยังไม่เจอสักอย่างภายในเพดาน (แนะนำ 45 วิ) ⇒ รายงานว่า **"ยังโหลดไม่จบใน N วิ"**
//       ซึ่งเป็นคนละอาการกับ "จอว่าง" และคนละอาการกับ "พัง"
// ⚠️ **ห้ามเอาไปรันบนเซิร์ฟเวอร์จริงเด็ดขาด** — มันตอบมั่วโดยตั้งใจ
// ⚠️ ผลที่ได้คือ "จอเขียนว่าอะไร" ไม่ใช่ "จอถูกหรือผิด" — คนต้องอ่านแล้วตัดสินเอง
//    เกณฑ์ที่ใช้ตัดสิน (จากบทเรียนทั้งวัน):
//      ① ล้มเหลวแล้วจอต้อง **ไม่เขียนเลข** (โดยเฉพาะเลข 0) เป็นข้อเท็จจริง
//      ② ต้องไม่ค้างที่ "กำลังโหลด…" ตลอดกาล
//      ③ ต้องบอกว่า **ทำอะไรต่อ** ไม่ใช่แค่บอกว่าพัง
import { createServer } from 'node:http'

const port = Number(process.argv[2] || 4010)
const rawMode = String(process.argv[3] || '500')

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
    /* ⚠️ แถวนี้จงใจ **ไม่มี expectedFrom** — สำเนาที่เก็บก่อนวันที่ท่อเพิ่มช่องนี้
       จอต้องเขียนว่า "ไม่รู้ว่าเทียบกับเลขของใคร" ห้ามเดาว่าเป็นคนกรอก */
    { key: 't/wallet', rows: 46, expected: 46, complete: true, at: '2026-09-06T15:00:00.000Z' }, // ← ของเก่า ไม่มี emptyVerified
    { key: 't/branch', rows: 3, expected: 3, complete: true, expectedFrom: 'คนกรอก', emptyVerified: false, at: '2026-09-06T17:01:54.453Z' },
    { key: 't/income', rows: 0, expected: 0, complete: true, expectedFrom: 'ยืนยันว่าจอว่าง', emptyVerified: true, at: '2026-09-06T15:20:00.000Z' },
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
  /* 🔴 โหมด `503` = **อ่านได้ปกติ แต่เขียนไม่ได้** ⇒ ให้ GET เดินเข้าตัวจัดการของโหมด `good`
     ไม่งั้นจอไม่มีข้อมูลให้กดลบ/กดบันทึกตั้งแต่แรก ⇒ ทดสอบทางเขียนไม่ได้เลย
     (เจอกับตัวเอง 14 ก.ย. 2569: เปิดจอคอมเมนต์แล้วไม่มีปุ่มลบให้กด)
     ⚠️ ตรงกับของจริงด้วย: Blobs อ่านสะดุดเป็นครั้งคราว ไม่ใช่ล่มทั้งระบบ */
  const mode = rawMode === '503' && req.method === 'GET' ? 'good' : rawMode
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
  /* ── โหมด 503: ปลายทางอ่านข้อมูลเดิมไม่ได้ จึง "ไม่เขียนอะไรเลย" ───────────
     🔴 **ท่าใหม่ของฝั่งท่อตั้งแต่ 14 ก.ย. 2569** (gucut-web 6428c2d · 5bce111)
        ของเดิมอ่านพลาดแล้ว **เขียนความว่างเปล่าทับของจริง** แล้วตอบ ok
        ตอนนี้อ่านพลาด ⇒ 503 + ข้อความไทยที่บอกว่า "ยังไม่ได้บันทึกอะไร"
     ⇒ โหมดนี้มีไว้ตรวจว่า **จอเอาข้อความนั้นขึ้นให้คนเห็นจริงไหม**
        หรือกลืนแล้วขึ้นคำกลาง ๆ ของตัวเองแทน (ซึ่งกลบข้อมูลสำคัญที่สุด: ของยังอยู่ครบ)
     ⚠️ ใช้กับคำสั่งเขียนเท่านั้น (POST/DELETE/PATCH) — GET ยังตอบปกติ
        เพราะของจริงก็เป็นแบบนั้น: อ่านได้ แต่เขียนไม่ได้ */
  if (mode === '503' && req.method !== 'GET') {
    res.writeHead(503, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      error: 'อ่านข้อมูลเดิมไม่ได้ชั่วคราว — ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง',
    }))
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
  /* ── รายการซื้อ (จอ /core/purchases) — มีไว้ทดสอบ **ด่านเทียบ `applied`** โดยเฉพาะ
     🔴 ที่มา 17 ก.ย. 2569: ท่อจริงส่ง `applied` (q · limit · offset · from · to) มาให้แล้ว
        จอจึงเทียบได้ว่า "ที่ขอไป" กับ "ที่ท่อใช้จริง" ตรงกันไหม — แต่ **ด่านที่ไม่เคยเห็นของไม่ตรง
        ก็ยังไม่รู้ว่ามันจับได้จริงไหม** (บทเรียน guard-must-be-tested-with-planted-bug)
     ⇒ โหมด good = `applied` ตรงกับที่ขอ (จอต้องเงียบ)
        โหมด partialgood = `applied.q` **เพี้ยนไปจากที่ขอ** (จอต้องขึ้นคำเตือน) */
  /* ── ผู้ติดต่อ (จอ /core/customers) — ทดสอบ **ด่านเทียบ `applied`** ของจอนั้น
     🔴 ท่อจริงส่ง `applied` = { q · withPhone · withEmail } ⇒ จอเทียบได้ว่า "ที่ขอ" กับ "ที่ใช้จริง" ตรงไหม
     ⚠️ ห้ามใส่ชื่อ/เบอร์ของจริงในไฟล์นี้ — ใช้ชื่อสมมติล้วน (กฎข้อมูลส่วนบุคคลของทีม)
        โหมด good ⇒ applied ตรง · โหมด partialgood ⇒ applied เพี้ยน (จอต้องฟ้อง) */
  if ((mode === 'good' || mode === 'partialgood') && /[?&]list=contacts\b/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const q = (u.searchParams.get('q') || '').trim()
    const wp = u.searchParams.get('withphone') === '1'
    const we = u.searchParams.get('withemail') === '1'
    const rows = [
      { id: 1, name: 'ลูกค้าทดสอบ หนึ่ง', code: 'C-ทดสอบ-1', phone: '0000000000', email: '', type: null },
      { id: 2, name: 'ลูกค้าทดสอบ สอง', code: 'C-ทดสอบ-2', phone: '', email: 'test2@example.invalid', type: null },
    ]
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, total: rows.length, limit: 50, offset: 0, rows,
      applied: mode === 'partialgood'
        ? { q: q ? q + 'เพี้ยน' : 'คำที่จอไม่ได้ขอ', withPhone: !wp, withEmail: we }
        : { q: q || null, withPhone: wp, withEmail: we },
    }))
  }
  if ((mode === 'good' || mode === 'partialgood' || mode === 'badecho') && /[?&]list=purchases\b/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const q = (u.searchParams.get('q') || '').trim()
    const limit = Number(u.searchParams.get('limit')) || 50
    const offset = Number(u.searchParams.get('offset')) || 0
    const rows = [
      { number: 'PO-ทดสอบ-1', vendor: 'ผู้ขายทดสอบ', po_date: '2026-09-10', status: 'Success', amount: 1000, payment_status: 'Paid', warehouse: 'NEW' },
      { number: 'PO-ทดสอบ-2', vendor: 'ผู้ขายทดสอบ', po_date: '2026-09-11', status: 'Pending', amount: 2000, payment_status: 'Pending', warehouse: 'NEW' },
    ]
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, total: rows.length, amount: 3000, limit, offset, rows,
      byStatus: [{ status: 'Success', c: 1 }, { status: 'Pending', c: 1 }],
      applied: mode === 'partialgood'
        ? { q: q ? q + 'เพี้ยน' : 'คำที่จอไม่ได้ขอ', limit: limit - 1, offset, from: null, to: null }
        : { q: q || null, limit, offset, from: null, to: null },
      /* 🏬 ท่อจริงบอกกลับที่ **ชั้นบน** ว่าใช้ร้านไหน และเลือกให้เองหรือเปล่า
         (ยิงยืนยัน 17 ก.ย. 2569 ครบ 4 เส้น: purchases · returnorders · quotations · transfers)
         โหมด badecho = **ตอบร้านผิดจากที่ขอ** — ปลูกบั๊กให้ `<StoreEcho>` ต้องดัง */
      ...(mode === 'badecho'
        ? { store: 'z1', storeDefaulted: true }
        /* โหมด partialgood = **ไม่บอกเลยว่าร้านไหน** ⇒ จอต้องขึ้น "ยืนยันไม่ได้" ไม่ใช่เงียบ
           (สถานะที่สาม: ไม่รู้ ≠ ตรงกันดี) */
        : mode === 'partialgood'
          ? {}
          : { store: u.searchParams.get('store') || 'z1', storeDefaulted: !u.searchParams.get('store') }),
    }))
  }
  if (mode === 'partialgood') {
    /* 🔴 **โหมดที่อันตรายที่สุด และควรใช้เป็นโหมดหลักในการกวาด** (บทเรียน 7 ก.ย. 2569)
       ตอบ 200 พร้อมก้อนที่ "ถูกรูปแต่ขาดช่องลูก" ⇒ ผ่านด่าน `x ? …` ทุกด่าน
       ⇒ จอที่เช็คแค่ "มีก้อนแม่ไหม" จะพังทั้งหน้า (เจอจริงที่จอคนเข้าเว็บ)
       ⚠️ โหมด 500 จับโรคนี้ไม่ได้เลย เพราะตอนล่มก้อนแม่เป็น null ทุกจอจึงรอด */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      // มีก้อนแม่ครบ แต่ข้างในขาดช่องที่จอเอาไปคำนวณ
      counts: {}, recon: [{}], channels: [{}], shopee: [{}], stock: [{}],
      rows: [{}], byChannel: [{}], byStatus: [{}], months: [{}], customers: [{}], warehouses: [{}],
      orders: [{}], 'ต้องส่งของ': [{}],
      members: {}, pwa: {}, days: [{}], countries: [{}], pages: [{}], channelsToday: [{}],
      total: undefined, saved: [{}],
    }))
  }
  if (mode === 'mkstale' && req.url.includes('list=')) {
    /* ทดสอบแถบ MarketStaleBar — ตอบแบบ good แต่ติดธง "คอลัมน์ Marketplace เป็นของเก่า"
       (สามฟิลด์ตามสัญญาท่อ 7 ก.ย. 2569: stale มีเฉพาะตอนเก่า · staleMs · at มีเสมอ) */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, total: 2, shown: 2, limit: 50, offset: 0,
      rows: [
        { sku: 'NW-01', name: 'ทดสอบ 1', qty: 5, buy: 100, sell: 200, marketplaces: ['shopee'] },
        { sku: 'NW-02', name: 'ทดสอบ 2', qty: 0, buy: 50, sell: 90, marketplaces: [] },
      ],
      checkedMarketplaces: ['gucut', 'shopee', 'lazada', 'tiktok'],
      marketplacesAt: new Date(Date.now() - 3 * 3600e3).toISOString(),
      marketplacesStale: true,
      marketplacesStaleMs: 3 * 3600e3 + 25 * 60e3,
    }))
  }
  /* ══ ใบคืนสินค้า (จอ /returns/receive) — mock มี state จริงในหน่วยความจำ ══
     สัญญาตาม lib/returns-api.ts (ร่างเสนอ 7 ก.ย. ดึก) · ท่อจริงยังไม่มี — จอสร้างล่วงหน้า
     กติกาทดสอบที่ฝังไว้: orderId '2' (SO-002) = ถูก "สมชาย" ถืออยู่ → ทดสอบทาง lock/takeover
     · grade ให้ moveResult ชิ้นที่สองเป็น duplicate → ทดสอบป้ายเหลือง "เคยบันทึกแล้ว" */
  /* ห้องทำงาน AI (จอ /office) — ทดสอบครบสามกติกา: แถวสด · แถวเก่า+ฟิลด์ null · ไม่มีแถว (Codex) */
  /* ══ แชทคอมเมิร์ซ (จอ /core/chat กับ /web/chat) — mock มี state จริงในหน่วยความจำ ══
     🔴 **ทำไมต้องมี** (14 ก.ย. 2569): สองจอนั้นมีเส้นทาง "เขียนแล้วล้มเหลว" ที่เพิ่งแก้ (df055c5)
        แต่พิสูจน์ด้วยตาไม่ได้เลย เพราะท่อปลอมตอบก้อนว่าง ⇒ จอขึ้น "ยังไม่มีลูกค้าทักเข้ามา"
        เปิดห้องไม่ได้ ⇒ กดส่ง/กดลบไม่ได้ ⇒ ไม่มีทางเห็นว่าตอนล้มมันพูดอะไร
     ⚠️ ทางเดียวที่เหลือคือใช้ท่อจริงอ่านห้องแล้วดักเฉพาะ POST ให้ล้ม — **ห้ามทำ**
        ถ้าตัวดักพลาด ข้อความทดสอบจะไปถึงลูกค้าจริง ⇒ จึงต้องมีของปลอมให้ครบแทน
     รูปร่างตามที่จออ่านจริง: rooms[] ตาม interface Room · thread.messages[] ตาม interface Msg */
  if (mode === 'good' && req.url.startsWith('/api/chat')) {
    const u = new URL(req.url, 'http://x')
    globalThis.__chat ??= {
      rooms: new Map([
        ['c1', { cid: 'c1', name: 'คุณสมชาย (ทดสอบ)', phone: '0812345678',
                 product: { h: 'โซ่เลื่อยยนต์ NEWWAVE 3652', t: 'โซ่' }, unread: 2,
                 messages: [
                   { from: 'c', text: 'โซ่รุ่นนี้ยังมีของไหมครับ', at: Date.now() - 3600e3 },
                   { from: 's', text: 'มีครับ เหลือ 3 เส้น', at: Date.now() - 3500e3, by: 'แอดมิน' },
                   { from: 'c', text: 'ขอที่อยู่ร้านหน่อยครับ', at: Date.now() - 600e3 },
                 ] }],
        ['c2', { cid: 'c2', name: 'ลูกค้าไม่ระบุชื่อ', phone: '', product: null, unread: 0,
                 messages: [{ from: 'c', text: 'สอบถามราคาบาร์ 22 นิ้ว', at: Date.now() - 2 * 86400e3 }] }],
      ]),
    }
    const st = globalThis.__chat
    const body = req.method === 'POST'
      ? await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } }) })
      : null
    const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }

    if (req.method === 'DELETE') {
      const cid = u.searchParams.get('cid')
      if (!st.rooms.has(cid)) return json({ error: 'ไม่มีห้องนี้' }, 404)
      st.rooms.delete(cid)
      return json({ ok: true })
    }
    if (req.method === 'POST') {
      const r = st.rooms.get(body?.cid)
      if (!r) return json({ error: 'ไม่มีห้องนี้' }, 404)
      r.messages.push({ from: 's', text: String(body?.text ?? ''), at: Date.now(), by: 'แอดมิน' })
      return json({ ok: true })
    }
    const cid = u.searchParams.get('cid')
    if (cid) {
      const r = st.rooms.get(cid)
      if (!r) return json({ error: 'ไม่มีห้องนี้' }, 404)
      r.unread = 0
      return json({ ok: true, thread: { cid, messages: r.messages } })
    }
    return json({
      ok: true,
      rooms: [...st.rooms.values()].map((r) => ({
        cid: r.cid, name: r.name, phone: r.phone, product: r.product,
        last: r.messages.length ? r.messages[r.messages.length - 1] : null,
        unread: r.unread, n: r.messages.length,
      })),
    })
  }

  /* ══ คูปอง (จอ /web/coupons) — เหตุผลเดียวกับแชท: ต้องกดลบได้ถึงจะเห็นเส้นทางตอนล้ม ══ */
  if (mode === 'good' && req.url.startsWith('/api/coupon')) {
    globalThis.__coupon ??= {
      list: [
        { code: 'WELCOME50', title: 'ลด 50 บาท ลูกค้าใหม่', type: 'amount', value: 50, max: 0, min: 300,
          until: '2026-12-31', quota: 100, perUser: 1, visible: true, memberOnly: false, off: false, used: 12 },
        { code: 'SAW10', title: 'ลด 10% เลื่อยยนต์', type: 'percent', value: 10, max: 500, min: 1000,
          until: '2026-10-31', quota: 50, perUser: 1, visible: true, memberOnly: true, off: false, used: 3 },
      ],
    }
    const st = globalThis.__coupon
    const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }
    if (req.method === 'POST') {
      const body = await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } }) })
      if (body?.action === 'delete') {
        const before = st.list.length
        st.list = st.list.filter((c) => c.code !== body?.code)
        if (st.list.length === before) return json({ error: 'ไม่มีโค้ดนี้' }, 404)
        return json({ ok: true })
      }
      if (body?.code) {
        const i = st.list.findIndex((c) => c.code === body.code)
        if (i >= 0) st.list[i] = { ...st.list[i], ...body }
        else st.list.push({ ...body, used: 0 })
        return json({ ok: true })
      }
      return json({ error: 'ไม่รู้จักคำสั่งนี้' }, 400)
    }
    return json({ ok: true, coupons: st.list })
  }

  if (mode === 'good' && req.url.startsWith('/api/office')) {
    globalThis.__office ??= {
      /* ⚠️ คละเจ้าของโดยตั้งใจ — ต้องมีครบทุกกลุ่ม + แถวที่ **ไม่มี owner** (ท่อรุ่นเก่า)
         + กลุ่มที่มีแต่งานเสร็จแล้ว (g1) เพื่อทดสอบว่าหัวกลุ่มซ่อนแต่แถวยังเห็น */
      tasks: [
        { id: 't1', text: 'ไปกด GRUB หน้าเครื่อง g1', note: 'บูตค้างจากเคอร์เนล 139', owner: 'ประธาน', done: false, at: Date.now() - 2 * 3600e3 },
        { id: 't2', text: 'เอา PEAK API key มาให้ทีม', owner: 'ประธาน', done: false, at: Date.now() - 26 * 3600e3 },
        { id: 't3', text: 'กรอกตัวเลข sold.json', owner: 'ประธาน', done: true, at: Date.now() - 3 * 86400e3, doneAt: Date.now() - 3600e3 },
        { id: 't4', text: '🔧 [Codex] แก้ bycustomer ชน D1', owner: 'codex', done: false, at: Date.now() - 5 * 3600e3 },
        { id: 't5', text: '🖥 [gucut2] จัดกลุ่มกระดานตามเจ้าของ', owner: 'gucut2', done: false, at: Date.now() - 30 * 60e3 },
        { id: 't6', text: '📦 [รอ push 21:00] งานวันนี้', owner: 'gucut', done: false, at: Date.now() - 4 * 3600e3 },
        { id: 't7', text: '⚙️ [g1] ทำ systemd ให้ตัวบริการแว่น', owner: 'g1', done: true, at: Date.now() - 2 * 86400e3, doneAt: Date.now() - 7200e3 },
        { id: 't8', text: 'งานเก่าจากท่อรุ่นก่อนหน้า (ยังไม่มีเจ้าของ)', done: false, at: Date.now() - 45 * 60e3 },
      ],
    }
    if (req.method === 'POST') {
      const body = await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } }) })
      const t = globalThis.__office.tasks.find((x) => x.id === (body?.taskDone ?? body?.taskUndo ?? body?.taskReady))
      if (t && body?.taskDone) { t.done = true; t.doneAt = Date.now() }
      if (t && body?.taskUndo) { t.done = false; delete t.doneAt; delete t.ready; delete t.readyAt }
      if (t && body?.taskReady) { t.ready = true; t.readyAt = Date.now() }
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, tasks: globalThis.__office.tasks }))
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      now: Date.now(),
      tasks: globalThis.__office.tasks,
      agents: [
        { agent: 'gucut', five: 5, week: 46, ctx: 97, model: 'Opus 5 (1M)', cost: 131.5, commits: 8, at: Date.now() - 40e3 },
        { agent: 'gucut2', five: 30, week: 39, ctx: null, model: 'Opus 5 (1M)', cost: 99.9, commits: 4, at: Date.now() - 11 * 60e3 },
      ],
    }))
  }
  if (mode === 'good' && /return-receive=|return-grade=|return-photo=|return-takeover=|returnphoto=|[?&]return=|list=returns-inbox/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const json = (obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
    const body = req.method === 'POST'
      ? await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } }) })
      : null

    globalThis.__returns ??= { seq: 1, docs: new Map() }
    const st = globalThis.__returns

    if (u.searchParams.get('list') === 'returns-inbox') {
      if (!st.docs.has('RT-U9001')) st.docs.set('RT-U9001', {
        returnId: 'RT-U9001', ref: 'RT-U9001', state: 'received', unmatched: true, quarantineNo: 'Q-901',
        staff: 'สมหญิง', createdAt: new Date(Date.now() - 50 * 3600e3).toISOString(),
        lastActivityAt: new Date(Date.now() - 50 * 3600e3).toISOString(),
        items: [{ sku: '', name: 'ของทดสอบค้างกอง', qty: 1 }], photoCount: 1,
      })
      const q = u.searchParams.get('q') ?? ''
      const rows = [...st.docs.values()].filter((d) => !q || d.orderId === q || (d.orderNumber ?? '').includes(q))
      return json({ rows, total: rows.length, reconHeartbeatAt: new Date(Date.now() - 30 * 3600e3).toISOString() })
    }
    if (u.searchParams.get('returnphoto')) {
      const d = st.docs.get(u.searchParams.get('returnphoto'))
      if (!d || !(d.photoCount > 0)) return json({ error: 'ไม่มีรูปใบนี้' }, 404)
      return json({ ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' })
    }
    if (u.searchParams.get('return')) {
      const d = st.docs.get(u.searchParams.get('return'))
      return d ? json({ doc: d }) : json({ error: 'ไม่พบใบนี้' }, 404)
    }
    if (u.searchParams.get('return-receive')) {
      if (!body || !Array.isArray(body.items)) return json({ error: 'body ไม่ครบ' }, 400)
      if (body.orderId === '2') {
        /* จำลองใบขายถูกคนอื่นถือ — สร้างใบค้างไว้ให้ takeover ได้ */
        const rid = 'RT-LOCKED-1'
        if (!st.docs.has(rid)) st.docs.set(rid, {
          returnId: rid, ref: 'RT-SO-002', state: 'received', unmatched: false,
          orderId: '2', orderNumber: 'SO-002', customer: 'ลูกค้าทดสอบ 2',
          lockedBy: 'สมชาย', lockSince: new Date(Date.now() - 20 * 60e3).toISOString(),
          staff: 'สมชาย', createdAt: new Date(Date.now() - 20 * 60e3).toISOString(),
          items: body.items.map((it) => ({ sku: it.sku ?? '', name: it.name ?? 'สินค้าทดสอบ', qty: it.qty })),
        })
        return json({ lockedBy: 'สมชาย', lockSince: st.docs.get(rid).lockSince, returnId: rid })
      }
      /* ใบค้างของ orderId เดิม → existing */
      const open = [...st.docs.values()].find((d) => d.orderId === body.orderId && !d.unmatched && (d.state === 'received' || d.state === 'graded'))
      if (open && body.orderId) return json({ returnId: open.returnId, ref: open.ref, state: open.state, existing: true })
      const n = st.seq++
      const rid = body.unmatched ? `RT-U${1000 + n}` : `RT-SO-00${n}`
      const doc = {
        returnId: rid, ref: body.unmatched ? rid : `RT-SO-001`, state: 'received',
        unmatched: !!body.unmatched, quarantineNo: body.unmatched ? `Q-${String(n).padStart(3, '0')}` : undefined,
        orderId: body.orderId ?? undefined, orderNumber: body.orderId ? 'SO-001' : undefined,
        customer: body.orderId ? 'ลูกค้าทดสอบ' : undefined,
        staff: 'devpass-admin', createdAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(),
        items: body.items.map((it) => ({ sku: it.sku ?? '', name: it.name ?? (it.sku === 'NW-01' ? 'สินค้าทดสอบหนึ่ง' : 'สินค้าทดสอบสอง (หลายชิ้น)'), qty: it.qty })),
        photoCount: 0, noPhotoReason: body.noPhotoReason,
      }
      st.docs.set(rid, doc)
      return json({ returnId: rid, ref: doc.ref, state: 'received' })
    }
    if (u.searchParams.get('return-photo')) {
      const d = st.docs.get(body?.returnId)
      if (!d) return json({ error: 'ไม่พบใบนี้' }, 404)
      d.photoCount = (d.photoCount ?? 0) + 1
      return json({ ok: true, stored: d.photoCount })
    }
    if (u.searchParams.get('return-grade')) {
      const d = st.docs.get(body?.returnId)
      if (!d) return json({ error: 'ไม่พบใบนี้' }, 404)
      /* จำลอง move ล้มบางชิ้นรอบแรก (ชิ้นที่สอง) → move_failed · ยิงซ้ำรอบสอง → ครบ = moved
         ทดสอบทั้งจอ "เข้าสต็อกไม่ครบ" และกติกา retry-ชุดเดิม (รีวิวท่อ 7 ก.ย. ดึก) */
      const firstTry = !d._retried
      d._retried = true
      d.items = d.items.map((it, i) => {
        const g = (body.items ?? []).find((x) => x.sku === it.sku) ?? body.items?.[i]
        const mv = d.unmatched ? undefined
          : (i === 1 ? (firstTry && d.items.length > 1 ? undefined : 'duplicate') : 'added')
        return { ...it, verdict: g?.verdict, note: g?.note, moveResult: mv }
      })
      d.state = d.unmatched ? 'graded'
        : (d.items.every((it) => it.moveResult) ? 'moved' : 'move_failed')
      d.lastActivityAt = new Date().toISOString()
      return json({ returnId: d.returnId, state: d.state, items: d.items })
    }
    if (u.searchParams.get('return-takeover')) {
      const d = st.docs.get(body?.returnId)
      if (!d) return json({ error: 'ไม่พบใบนี้' }, 404)
      if (!body?.reason) return json({ error: 'ต้องเลือกเหตุผล' }, 400)
      delete d.lockedBy; delete d.lockSince
      d.takeovers = [...(d.takeovers ?? []), { at: new Date().toISOString(), from: 'สมชาย', to: 'devpass-admin', reason: body.reason, note: body.note }]
      d.staff = 'devpass-admin (รับช่วงจาก สมชาย)'
      return json({ doc: d })
    }
    return json({ error: 'เส้นใบคืนที่ไม่รู้จัก' }, 404)
  }
  if (mode === 'good' && /[?&]order=/.test(req.url)) {
    /* ใบเดียวพร้อมรายการสินค้า (จอ wizard แพ็คสินค้า) — รูปตาม getOrder ของจริง: {order, items}
       🔴 **สามใบนี้มีไว้ทดสอบสามสถานะของช่องเงินที่ฝั่งท่อกำลังเพิ่ม** (14 ก.ย. 2569)
          ?order=...FULL  → รู้ครบ ⇒ ยอดต้องลงตัวพอดี จอต้องเงียบ (ไม่มีกล่องเตือน)
          ?order=...NULL  → ใบซิงก์ก่อนมีคอลัมน์ ⇒ ทุกช่องเป็น null ⇒ ต้องขึ้น "ไม่รู้" ห้ามขึ้น 0
          ?order=อื่น ๆ   → ท่อรุ่นก่อน (ไม่มีช่องเลย) ⇒ ต้องขึ้น "ส่วนต่างที่อธิบายไม่ได้" แบบเดิม
       ⚠️ ถ้าไม่มีทั้งสามแบบ จะทดสอบได้แค่ทางเดียวแล้วเข้าใจว่าจอถูกทั้งหมด */
    const which = /[?&]order=[^&]*FULL/.test(req.url) ? 'full'
      : /[?&]order=[^&]*NULL/.test(req.url) ? 'null'
        : /[?&]order=[^&]*ODD/.test(req.url) ? 'odd'
          : /[?&]order=[^&]*ZERO/.test(req.url) ? 'zero' : 'old'
    const base = { id: 'z1-1', source: 'z1', number: 'SO-001', channel: 'Shopee', status: 'Pending',
      customer: 'ลูกค้าทดสอบ', order_date: '2026-09-05', tracking_no: 'TH000TEST', pay_status: 'paid',
      ship_channel: 'Flash express', ship_name: 'ผู้รับทดสอบ', ship_date: '2026-09-06' }
    /* 🔴 **สัญญาจริง (ยืนยันกับใบจริง 14 ก.ย. 2569 18:06 น. ใบ 1118734271446942)**:
         หัวใบ = ผลรวม items[].amount − bill_discount + ship_amount
       ⚠️ **items[].amount หักส่วนลดรายบรรทัดมาแล้ว** ⇒ ส่วนลดรายบรรทัดไม่เข้าสมการ
       🔴 ตัวเลขชุดเดิมในไฟล์นี้ผมแต่งให้เข้ากับสูตรที่ผมเชื่อ (ลบส่วนลดบรรทัดด้วย)
          ⇒ **เทสที่สร้างจากความเข้าใจผิดเดียวกับโค้ด จะเขียวเสมอ** — บั๊กเลยรอดมาถึงใบจริง
          ⇒ แก้ตัวเลขให้ตรงสัญญาจริง: 1,000 − 50 + 70 = 1,020 */
    const items = [
      { line: 1, sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', qty: 1, amount: 500 },
      { line: 2, sku: 'NW-02', name: 'สินค้าทดสอบสอง (หลายชิ้น)', qty: 3, amount: 500 },
    ]
    res.writeHead(200, { 'content-type': 'application/json' })
    if (which === 'full') {
      return res.end(JSON.stringify({
        order: { ...base, amount: 1020, bill_discount: 50, ship_amount: 70 },
        items: [{ ...items[0], discount: 10 }, { ...items[1], discount: 5 }],
      }))
    }
    if (which === 'zero') {
      /* 🔴 **สภาพหลังฝั่งท่อกวาดย้อนหลัง** (ฝั่งท่อแจ้ง 14 ก.ย. 2569 · gucut-web 44fbecc)
         ใบที่ ZORT ไม่ได้ส่งส่วนลดมาจริงจะได้ **0 ไม่ใช่ null** เพราะตัวซิงก์เขียนค่าทุกบรรทัด
         ⇒ จอต้องเปลี่ยนจาก "ยังยืนยันไม่ได้" เป็น **"ลงตัว" แล้วเงียบ** เอง โดยไม่ต้องแก้โค้ดจอ
         ⚠️ อันนี้คือคำที่ผมพูดไว้กับฝั่งท่อ ⇒ **ต้องพิสูจน์ ไม่ใช่เชื่อเอา** */
      return res.end(JSON.stringify({
        order: { ...base, amount: 1070, bill_discount: 0, ship_amount: 70 },
        items: [{ ...items[0], discount: 0 }, { ...items[1], discount: 0 }],
      }))
    }
    if (which === 'odd') {
      /* 🔴 **สถานะที่สี่ที่สำคัญที่สุด: รู้ค่าครบแล้วแต่ยอดยังไม่ลงตัว**
         แปลว่าสูตรที่จอใช้กับที่ท่อใช้ไม่ตรงกัน (มีช่องที่เรายังไม่รู้จัก)
         ⇒ จอต้องขึ้นแดงว่า "ยังเหลือที่อธิบายไม่ได้" ไม่ใช่เงียบเพราะคิดว่าอธิบายได้แล้ว
         ⚠️ ถ้าไม่มีเคสนี้ จอที่คำนวณผิดจะดูเหมือนถูกตลอดกาล */
      return res.end(JSON.stringify({
        order: { ...base, amount: 1125, bill_discount: 50, ship_amount: 70 },
        items: [{ ...items[0], discount: 10 }, { ...items[1], discount: 5 }],
      }))
    }
    if (which === 'null') {
      return res.end(JSON.stringify({
        order: { ...base, amount: 1070, bill_discount: null, ship_amount: null },
        items: [{ ...items[0], discount: null }, { ...items[1], discount: null }],
      }))
    }
    return res.end(JSON.stringify({ order: { ...base, amount: 1070 }, items }))
  }
  /* รายละเอียดใบเสนอราคา/ใบโอน (จอ detail ใหม่ — โครงจากซอร์สท่อจริง) */
  /* ── ฉลาก/บาร์โค้ด (จอ /core/stock/print) ────────────────────────────────
     🔴 **สี่กองที่จอต้องแยกให้ออก** — ท่อปลอมนี้จงใจส่งมาครบทั้งสี่ในครั้งเดียว
        เพราะกองที่ทำให้ของพังคือกองที่ "หน้าตาเหมือนไม่มีบาร์โค้ด" แต่ความจริงคือ "ไม่รู้"
     ⚠️ ส่ง ok:true พร้อม complete:false + failed ไม่ว่าง **โดยตั้งใจ**
        ถ้าจอตัดสินจาก ok อย่างเดียว มันจะบอกว่า "ครบ" ทั้งที่ขาด */
  /* ── สถานะสำเนา (จอ /core/backup) ─────────────────────────────────────
     📌 **รูปคำตอบลอกจากของจริง** ที่ฝั่งท่อยิงวัดให้ 14 ก.ย. 2569 (GET ?backupstatus=1)
        { ok, ready, lastRun:"YYYY-MM-DD HH:MM:SS"(UTC), stores:[{store,keys,bytes,gone,last}],
          protected:[{store,what,skip[]}], never:[{store,why}] }
     🔴 **ทำไมต้องมี**: ก่อนหน้านี้ท่อปลอมไม่รู้จักเส้นนี้ ⇒ กวาดทีไรจอก็ขึ้นสภาพ "ว่างเปล่า"
        ทุกครั้ง ⇒ เห็นแต่ทางพัง ไม่เคยเห็นทางที่ถูก ⇒ ตัดสินไม่ได้ว่าด่านใหม่กลบของจริงไหม
        (ด่าน "เขียวได้เฉพาะเมื่อมีทั้งเวลาและคีย์จริง" ต้องพิสูจน์ทั้งสองทาง ไม่ใช่ทางเดียว) */
  if (mode === 'good' && /[?&]backupstatus=/.test(req.url)) {
    const t = new Date(Date.now() - 12 * 60000).toISOString().slice(0, 19).replace('T', ' ')
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, ready: true, lastRun: t,
      stores: [
        { store: 'gucut-admin', keys: 6, bytes: 20480, gone: 0, last: t },
        { store: 'gucut-coupon', keys: 33, bytes: 157696, gone: 2, last: t },
        { store: 'gucut-chat', keys: 15, bytes: 40960, gone: 0, last: t },
      ],
      protected: [{ store: 'gucut-admin', what: 'ทุกคีย์', skip: [] }],
      never: [{ store: 'gucut-temp', why: 'ของชั่วคราว ไม่ต้องสำรอง' }],
    }))
  }

  /* ── ผูกสินค้ากับคลิป (จอ /web/clip-shop) ──────────────────────────────
     เส้นนี้ต้องมีเพื่อให้จอโหลด "รายการที่ผูกไว้" สำเร็จ ⇒ ปุ่มบันทึกถึงจะใช้งานได้
     (รายชื่อคลิปมาจาก /api/webfile/feed.json ซึ่งยิงไป gucut.com จริงเสมอ ไม่ผ่านท่อปลอม) */
  if (mode === 'good' && /\/api\/clip-shop/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ map: { 'clip-001': { h: '/p/nw-3860/', t: 'โซ่ NEWWAVE 3860' } } }))
  }

  /* ── คอมเมนต์ใต้คลิป (จอ /web/comments) ────────────────────────────────
     🔴 **ต้องมี ไม่งั้นทดสอบทางลบไม่ได้เลย** — ก่อนหน้านี้ท่อปลอมไม่รู้จักเส้นนี้
        ⇒ จอขึ้น "ยังไม่มีคอมเมนต์" ⇒ ไม่มีปุ่มลบให้กด ⇒ เส้นทางที่อยากทดสอบไม่เคยถูกเดินเลย
     รูปคำตอบตามของจริง: GET เปล่า = { counts: { <คลิป>: [หัวใจ, จำนวนคอมเมนต์] } }
                        GET ?id= = { comments: [{ i, n, t, at }] } */
  if (mode === 'good' && /\/api\/social/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const id = u.searchParams.get('id')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (id) {
      return res.end(JSON.stringify({
        comments: [
          { i: 'c1', n: 'ลูกค้าทดสอบ', t: 'โซ่รุ่นนี้ใช้กับเครื่อง 5800 ได้ไหมครับ', at: Date.now() - 3600e3 },
          { i: 'c2', n: 'สมชาย', t: 'ของถึงเร็วมาก ขอบคุณครับ', at: Date.now() - 7200e3 },
        ],
      }))
    }
    return res.end(JSON.stringify({
      counts: { 'clip-001': [12, 2], 'clip-002': [3, 0] },
      views: { 'clip-001': 340, 'clip-002': 88 },
    }))
  }

  /* ── zortlist: รายได้อื่น · รายจ่ายอื่น · โอนเงิน · สินค้าหลากคุณสมบัติ ───────
     🔴 **ของจริงร้านมี 0 รายการทุกชุด** ⇒ ทางที่ "มีแถว" จะไม่มีวันถูกเดินบน production
        ⇒ ถ้าไม่ใส่ mock ตรงนี้ เราจะไม่มีวันรู้ว่าตารางแสดงถูกไหม
        (บทเรียนซ้ำจากจอสำรองข้อมูลและจอคอมเมนต์วันนี้: ท่อปลอมไม่รู้จักเส้น = เห็นแต่ทางว่างเปล่า)
     ⚠️ ชื่อช่างมาจากเอกสาร ZORT ล้วน — ของจริงยังไม่เคยเห็น ⇒ ใส่ให้ครบตามเอกสาร
        และจงใจให้ **แถวที่สองขาดช่องบางตัว** เพื่อพิสูจน์ว่าจอขึ้น "—" ไม่ใช่พัง */
  if ((mode === 'good' || mode === 'zcount') && /[?&]zortlist=/.test(req.url)) {
    const kind = new URL(req.url, 'http://x').searchParams.get('zortlist')
    const data = {
      incomes: [
        { id: 1, incomedate: '2026-09-10T00:00:00', contactname: 'ลูกค้าทดสอบ', amount: 1500, paymentstatus: 'Paid' },
        { id: 2, incomedate: '2026-09-08T00:00:00' },
      ],
      expenses: [
        { id: 3, expensedate: '2026-09-09T00:00:00', contactname: 'ร้านค่าไฟ', amount: 2400, paymentstatus: 'Unpaid' },
      ],
      moneytransfers: [
        { id: 4, actiondate: '2026-09-11T00:00:00', reference: 'MT-001', amount: 5000, status: 'Success' },
      ],
      variations: [
        { id: 5, sku: 'NW-CHAIN', name: 'โซ่ NEWWAVE หลายความยาว', variants: [{ variantid: 1, variantname: '16 นิ้ว' }, { variantid: 2, variantname: '18 นิ้ว' }] },
      ],
    }
    const rows = data[kind] || []
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, kind, label: kind, applied: { page: 1, limit: 200 },
      /* 🔴 mode=zcount: `count` เป็นของทั้งชุด แต่แถวมาแค่หน้าแรก — ทางที่ต้องขึ้นคำเตือน
            "มีทั้งหมด N แสดง M" (ของจริงเกิดเมื่อชุดเกิน 200 ซึ่งร้านนี้ไม่มีให้ลอง) */
      count: mode === 'zcount' ? 350 : rows.length,
      rowKeys: rows.length ? Object.keys(rows[0]) : [], rows,
    }))
  }

  if (mode === 'good' && /[?&]productlabels=/.test(req.url)) {
    const ask = decodeURIComponent(new URL(req.url, 'http://x').searchParams.get('productlabels') || '')
      .split(',').map((x) => x.trim()).filter(Boolean)
    const rows = []; const missing = []; const failed = []
    for (const sku of ask) {
      if (/^MISS/i.test(sku)) missing.push(sku)
      else if (/^FAIL/i.test(sku)) failed.push({ sku, error: 'ZORT ตอบ 502' })
      else if (/^QUIET/i.test(sku)) { /* จงใจไม่พูดถึงรหัสนี้เลย — จอต้องนับเป็น "ไม่รู้" ไม่ใช่ทำหาย */ }
      else if (/^NOBC/i.test(sku)) rows.push({ sku, name: `สินค้าไม่มีบาร์โค้ด ${sku}`, barcode: null, noBarcode: true, sellprice: 250, unittext: 'ชิ้น' })
      else if (/^THAI/i.test(sku)) rows.push({ sku, name: 'สินค้ารหัสไทย', barcode: 'บาร์โค้ดไทย', noBarcode: false, sellprice: 99, unittext: 'ชิ้น' })
      else rows.push({ sku, name: `สินค้าทดสอบ ${sku}`, barcode: `885${String(sku).replace(/\D/g, '').padStart(10, '0')}`, noBarcode: false, sellprice: 1250.5, unittext: 'ชิ้น' })
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, complete: failed.length === 0, rows, missing, failed,
      note: 'ท่อปลอม — ไม่ใช่ข้อมูลจริง',
    }))
  }

  /* ── เพิ่มสินค้าชุด / เพิ่มคลัง (ฟอร์มสั้นผ่าน ShortAddForm) ─────────────
     ไม่มี confirm = ซ้อม · มี confirm = ตอบว่าสำเร็จ (ท่อปลอม ไม่ได้เขียนอะไรจริง) */
  /* ── คืนสินค้าให้ผู้ขาย (จอ /core/purchases/returns/new) ──────────────────
     🔴 ส่ง linesTotal ที่ **ตั้งใจให้ต่างจากจอ** เมื่อใบมีบรรทัดที่ sku ขึ้นต้นว่า MISMATCH
        เพื่อพิสูจน์ว่าจอจับได้จริงว่า "สองฝั่งเข้าใจช่องไม่ตรงกัน" ไม่ใช่แค่เขียนกล่องไว้เฉย ๆ */
  if (mode === 'good' && /[?&]addpurchasereturn=/.test(req.url)) {
    const body = (await new Promise((ok) => {
      let b = ''; req.on('data', (c) => (b += c))
      req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } })
    })) || {}
    const items = body.items || []
    let linesTotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0)
    if (items.some((it) => /^MISMATCH/i.test(String(it.sku || '')))) linesTotal += 111
    res.writeHead(200, { 'content-type': 'application/json' })
    if (!body.confirm) {
      return res.end(JSON.stringify({
        ok: true, dryRun: true, ref: body.ref, linesTotal,
        willSend: { number: body.number || body.ref, status: body.status, day: body.day,
          vendor: body.vendor, list: items.map((it) => ({ sku: it.sku, name: it.name, quantity: it.qty, pricepernumber: it.price })) },
      }))
    }
    return res.end(JSON.stringify({ ok: true, ref: body.ref, message: 'ท่อปลอม: ไม่ได้เขียนอะไรจริง' }))
  }

  /* ── ใบสั่งซื้อ/ใบเสนอราคา: คืน linesTotal ตามกติกาจริงของท่อ (gucut-web 994f84b) ──
     🔴 **null = มีบรรทัดไม่มีราคา ⇒ ท่อไม่คิดยอด** — ไม่ใช่ 0
        ท่อปลอมต้องเลียนแบบข้อนี้ ไม่งั้นจะไม่มีวันได้ทดสอบเส้นทาง "เทียบไม่ได้" */
  if (mode === 'good' && /[?&](addpo|addquotation)=/.test(req.url) && req.method === 'POST') {
    const body = (await new Promise((ok) => {
      let b = ''; req.on('data', (c) => (b += c))
      req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } })
    })) || {}
    const items = body.items || []
    const anyNoPrice = items.some((it) => it.price === undefined || it.price === null || it.price === '')
    const linesTotal = anyNoPrice ? null : items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0)
    res.writeHead(200, { 'content-type': 'application/json' })
    if (!body.confirm) {
      return res.end(JSON.stringify({
        ok: true, dryRun: true, ref: body.ref, linesTotal,
        willSend: { list: items.map((it) => ({ sku: it.sku, quantity: it.qty, pricepernumber: it.price })) },
      }))
    }
    return res.end(JSON.stringify({ ok: true, ref: body.ref, message: 'ท่อปลอม: ไม่ได้เขียนอะไรจริง' }))
  }

  if (mode === 'good' && /[?&](addbundle|addwarehouse)=/.test(req.url)) {
    const which = /addbundle=/.test(req.url) ? 'addbundle' : 'addwarehouse'
    const body = (await new Promise((ok) => {
      let b = ''; req.on('data', (c) => (b += c))
      req.on('end', () => { try { ok(JSON.parse(b)) } catch { ok(null) } })
    })) || {}
    res.writeHead(200, { 'content-type': 'application/json' })
    if (!body.confirm) {
      return res.end(JSON.stringify({
        ok: true, dryRun: true, ref: body.ref,
        willSend: which === 'addbundle'
          ? { name: body.name, sku: body.sku, sellprice: String(body.price ?? ''), sell_vat_status: body.vat, list: (body.items || []).map((it) => ({ sku: it.sku, quantity: it.qty })) }
          : { code: body.code, name: body.name, address: body.address },
      }))
    }
    return res.end(JSON.stringify({ ok: true, ref: body.ref, message: 'ท่อปลอม: ไม่ได้เขียนอะไรจริง' }))
  }

  if (mode === 'good' && /[?&]quotation=/.test(req.url)) {
    /* id ที่ขึ้นต้นด้วย bad = จำลอง **บั๊กของจริง 9 ก.ย. 2569**: ท่อหยิบบรรทัดสินค้ามาเป็นหัวใบ
       ⇒ number กลายเป็นจำนวนสินค้า · fields เป็นช่องของบรรทัด · lines เป็น null
       จอต้องจับได้แล้วหยุดแสดงตัวเลข ไม่ใช่โชว์เงินผิดเงียบ ๆ */
    if (/[?&]quotation=bad/.test(req.url)) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({
        live: true, number: '3',
        'เงินที่ ZORT เก็บไว้': { pricepernumber: 10, totalprice: 30 },
        lines: null,
        fields: ['bundleCode', 'id', 'name', 'number', 'pricepernumber', 'productid', 'sku', 'unittext'],
      }))
    }
    /* id ที่ขึ้นต้นด้วย old = **ท่อรุ่นก่อน 9 ก.ย. 2569** ที่ยังไม่ตั้งชื่อช่องเงิน
       ต้องมีไว้ทดสอบ เพราะ deploy สองฝั่งเหลื่อมกันเสมอ — จอเจอรุ่นเก่าได้จริง
       จอต้องไม่เดาว่าช่องไหนคือยอดใบ แต่ก็ต้องไม่พังหรือขึ้นว่างเปล่า */
    if (/[?&]quotation=old/.test(req.url)) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({
        live: true, number: 'QT-6809-OLD',
        'เงินที่ ZORT เก็บไว้': { amount: 12500, vatamount: 817.76, totalprice: 12500 },
        lines: [{ 'ทุกช่องในบรรทัด': { sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', number: 1, pricepernumber: 12500 } }],
        fields: ['amount', 'customerid', 'list', 'number', 'status', 'totalprice', 'vatamount'],
      }))
    }
    /* ท่อรุ่นใหม่ (6ab53c6 ขึ้นไป) — มีช่องที่ตั้งชื่อแล้ว + บรรทัดที่แยกช่องแล้ว
       ⚠️ ยอด ฿0 ในบรรทัดที่สองตั้งใจใส่ไว้: จอต้องเขียน ฿0 ไม่ใช่ขีด (0 เป็นค่าที่ถูกต้อง) */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      live: true, number: 'QT-6809-001',
      status: 'Pending', date: '2026-09-08', customer: 'สมชาย ใจดี',
      amount: 12500, vatAmount: 817.76, discountAmount: 0, shippingAmount: 100,
      'เงินที่ ZORT เก็บไว้': { amount: 12500, vatamount: 817.76, totalprice: 12500, shippingamount: 100 },
      lines: [
        {
          sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', qty: 1, unit: 'ชิ้น', pricePerUnit: 12500, total: 12500,
          'ทุกช่องในบรรทัด': { sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', number: 1, pricepernumber: 12500, totalprice: 12500 },
        },
        {
          sku: 'NW-FREE', name: 'ของแถม', qty: 2, unit: 'ชิ้น', pricePerUnit: 0, total: 0,
          'ทุกช่องในบรรทัด': { sku: 'NW-FREE', name: 'ของแถม', number: 2, pricepernumber: 0, totalprice: 0 },
        },
      ],
      fields: ['amount', 'customerid', 'customername', 'list', 'number', 'quotationdate', 'status', 'totalprice', 'vatamount'],
    }))
  }
  if (mode === 'good' && /[?&]transfer=/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      live: true, number: 'TF-6809-002', status: 'Pending', date: '2026-09-08',
      from: 'NEW', to: 'SHOP2', tracking: 'TH000TRF',
      lines: [{ sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', qty: 3 }],
      fields: ['fromwarehousecode', 'list', 'number', 'status', 'towarehousecode', 'trackingno', 'transferdate'],
    }))
  }
  /* สต็อกการ์ด (จอ /core/stock/<sku> การ์ด "รายงาน")
     ⚠️ ต้องมีสามแบบในตารางเดียว เพราะจอทำกับสามแบบนี้ต่างกัน:
        ขาย+ค้นเจอ = กดเข้าใบได้ · ขาย+ค้นไม่เจอ = ต้องบอกตรงแถว · ซื้อ = **ต้องกดไม่ได้**
        (ปลายทางของใบซื้อคนละจอ และยังไม่ยืนยันว่า ref ผูกกลับได้ ⇒ เดาแล้วพาไปผิดใบ) */
  if (mode === 'good' && /list=stockcard/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      applied: { sku: new URL(req.url, 'http://x').searchParams.get('sku'), kind: new URL(req.url, 'http://x').searchParams.get('kind') || 'all', limit: 100 },
      kinds: [{ key: 'all', label: 'การเคลื่อนไหว' }, { key: 'sale', label: 'รายการขายเท่านั้น' }],
      missingKinds: ['รายการโอนระหว่างคลัง'],
      warehouses: null,
      total: 3, shown: 3, truncated: false,
      counts: { sale: 2, buy: 1, adjust: 0 },
      rows: [
        { date: '2026-09-05', kind: 'ขาย', status: 'Success', ref: 'SO-001', party: 'สมชาย ใจดี', qty: -2, amount: 2000 },
        { date: '2026-09-04', kind: 'ขาย', status: 'Success', ref: 'SO-ไม่มีในกระจก', party: 'อ*****ก', qty: -1, amount: 900 },
        { date: '2026-09-01', kind: 'ซื้อ', status: 'Success', ref: 'PO-001', party: 'โรงงาน', qty: 50, amount: 25000 },
      ],
    }))
  }
  /* ค้นใบขายด้วยเลขที่ใบ (จอแพ็คสินค้าใช้หา id จริงตอนกด — id = `<ร้าน>/<เลขที่ใบ>`)
     ⚠️ ต้องแยกสองเคสให้ทดสอบได้: q=SO-001 → เจอหนึ่งใบ · q อื่น → ไม่เจอ
        เพราะทางที่จอต้องทำต่างกันคนละทิศ (เด้งไป detail vs เขียนบอกตรงแถว) */
  if (mode === 'good' && /list=orders/.test(req.url) && /[?&]q=/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const q = u.searchParams.get('q') || ''
    const rows = q === 'SO-001'
      ? [{ id: 'z1/SO-001', number: 'SO-001', channel: 'Shopee', status: 'Pending', amount: 1000 }]
      : []
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, rows, total: rows.length, limit: 5, offset: 0 }))
  }
  /* สรุปลูกค้า (จอ /core/customer-report) — โครงจากซอร์สท่อจริง ?bycustomer=
     ⚠️ ต้องมีทั้ง **ลูกค้ามีชื่อ** และกอง **unnamed** ในคำตอบเดียว เพราะจอต้องทำสองอย่างต่างกัน:
        ชื่อจริง = กดเข้าหน้ารายคนได้ · ไม่ระบุชื่อ = **ห้ามกด** (มันคือหลายคนรวมกัน ไม่ใช่ลูกค้าหนึ่งราย)
        ถ้า mock มีแต่ชื่อจริง จะทดสอบข้อห้ามนั้นไม่ได้เลย */
  if (mode === 'good' && /[?&]bycustomer=/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      customers: [
        { name: 'สมชาย ใจดี', orders: 12, sales: 48000, lastDay: '2026-09-07', channels: [{ channel: 'หน้าร้าน', orders: 12 }] },
        { name: 'อ*****ก', orders: 3, sales: 5400, lastDay: '2026-09-05', channels: [{ channel: 'Shopee', orders: 3 }] },
      ],
      unnamed: { orders: 88, sales: 120000, lastDay: '2026-09-08' },
      totalOrders: 103, totalSales: 173400, distinctNames: 2,
      /* 🔴 **เดิมเป็น `monthly: []`** ⇒ กราฟแนวโน้มในจอ /core/customer-report ไม่เคยวาดเลย
         แม้แต่ในโหมด good ⇒ จอขึ้นข้อความสำรองว่า "ท่อยังไม่ส่งข้อมูลรายเดือนมา"
         แล้วผมไปรายงาน CEO ว่าท่อจริงไม่ส่ง (14 ก.ย. 2569) — **ซึ่งไม่จริง ท่อจริงส่งครบ**
         📌 บทเรียน: **ท่อปลอมที่ขาดมิติหนึ่ง ทำให้เราเห็นจอพูดเหมือนท่อจริงพัง**
            ⇒ ก่อนรายงานว่าท่อไม่ส่งอะไร ต้องยิงของจริงเทียบก่อนเสมอ
               ไม่มีคีย์ยิงเอง = ฝากคนที่มียิงให้ ไม่ใช่สรุปจากท่อปลอม */
      historyFrom: '2026-06-01',
      monthly: [
        { ym: '2026-06', newCustomers: 12, repeatCustomers: 4 },
        { ym: '2026-07', newCustomers: 9, repeatCustomers: 7 },
        { ym: '2026-08', newCustomers: 15, repeatCustomers: 11 },
        { ym: '2026-09', newCustomers: 6, repeatCustomers: 9 },
      ],
    }))
  }
  /* ใบคืนสินค้า: รายการ + รายใบ (จอ /core/return-orders → /detail)
     ⚠️ แถวที่สองตั้งใจ **ไม่มี id** — ท่อรุ่นก่อน 8d22291 ไม่ส่ง id มา
        จอต้องแสดงแถวนั้นเป็นข้อความธรรมดา ไม่ใช่ลิงก์ที่กดแล้วเปิดไม่ได้
     ⚠️ ใบรายใบ **ไม่มีช่องเงินที่ตั้งชื่อแล้ว** ตามสัญญาท่อจริง — จอต้องไม่เดายอดคืนเอง */
  if (mode === 'good' && /list=returnorders/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      rows: [
        { id: 305814904, number: 'CN-001', reference: 'SO-001', customer: 'สมชาย ใจดี', amount: 57, status: 'Success', warehouse: 'NEW', date: '2026-09-09', paid: 'Paid' },
        { number: 'CN-ไม่มี-id', reference: 'SO-002', customer: 'อ*****ก', amount: 120, status: 'Pending', warehouse: '', date: '2026-09-08', paid: '' },
      ],
      total: 2,
    }))
  }
  if (mode === 'good' && /[?&]returnorder=/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      live: true, number: 'CN-001', status: 'Success', date: '2026-09-09',
      customer: 'สมชาย ใจดี', reference: 'SO-001',
      'เงินที่ ZORT เก็บไว้': { amount: 57, amount_pretax: 53.27, vatamount: 3.73, shippingamount_pretax: 9.35 },
      lines: [
        { sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', qty: 1, unit: 'ชิ้น', 'ทุกช่องในบรรทัด': { sku: 'NW-01', number: 1, name: 'สินค้าทดสอบหนึ่ง' } },
      ],
      fields: ['amount', 'customername', 'list', 'number', 'reference', 'returndate', 'status', 'vatamount'],
    }))
  }
  /* จอสินค้าบน Marketplace — โหมดท่อรุ่นใหม่ (รับ channel + คืน channelCounts)
     ⚠️ สลับเป็นท่อรุ่นเก่าได้ด้วย mode 'oldpipe' เพื่อทดสอบว่าจอถอยกลับไปกวาดเองแล้วขึ้นป้าย */
  /* โหมด 'midpipe' = ท่อรุ่นกลาง: **รับตัวกรองช่องทางแล้ว แต่ยังไม่คืน channelCounts**
     (คือสภาพจริงของ production ช่วง 11-12 ก.ย. 2569) — ใช้ทดสอบว่าจอ
     **ไม่โชว์ตัวเลขบนแท็บ** แทนที่จะนับจากแถวหน้าเดียวแล้วได้เลขผิดแบบดูสมเหตุสมผล */
  if ((mode === 'good' || mode === 'oldpipe' || mode === 'midpipe' || mode === 'nototal' || mode === 'badecho') && /[?&]list=stock\b/.test(req.url) && /[?&]marketplaces=1/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const limit = Math.min(200, Number(u.searchParams.get('limit')) || 50)
    const offset = Math.max(0, Number(u.searchParams.get('offset')) || 0)
    const channel = (u.searchParams.get('channel') || '').trim()
    const q = (u.searchParams.get('q') || '').trim().toLowerCase()
    const TOTAL = 300
    // แจกช่องทางแบบคาดเดาได้: หาร 3 ลงตัว = shopee · หาร 5 = lazada · หาร 7 = tiktok · ที่เหลือไม่ลงเลย
    const all = []
    for (let i = 1; i <= TOTAL; i++) {
      const tags = []
      if (i % 3 === 0) tags.push('shopee')
      if (i % 5 === 0) tags.push('lazada')
      if (i % 7 === 0) tags.push('tiktok')
      if (i % 2 === 0) tags.push('gucut')
      /* 🖼️ **สามสถานะของรูปสินค้า** — จอต้องแยกออกทั้งสาม (ใบ t_mu2u6eg6)
           ① มีรูปย่อในถังเรา (ตารางขึ้นรูปได้เลย) — ในของจริงมาจาก sku-images.json
           ② ZORT มีรูป แต่ยังไม่มีรูปย่อ ⇒ จอต้องให้ตัวย่อของ Next ย่อให้ (เพิ่ม 16 ก.ย. 2569)
           ③ ไม่มีรูปเลย ⇒ กล่องเทา + บอกเหตุผลใน tooltip
         ⚠️ URL ในข้อ ② ตั้งใจให้ **โหลดไม่ขึ้น** (โฮสต์อนุญาตแต่ไฟล์ไม่มีจริง)
            เพราะสิ่งที่ต้องทดสอบคือ "ย่อไม่สำเร็จแล้วต้องกลับไปเป็นกล่องเทา ไม่ใช่รูปแตก" */
      const รูป = i % 4 === 0
        ? { imagePath: `https://image.zort.co.th/ImagesStorage/ProductImages/0/0/ทดสอบ-${i}.png` }
        : i % 4 === 1 ? { imageFile: `ทดสอบ-${i}.webp` } : { imagePath: '' }
      all.push({ sku: `MP-${String(i).padStart(3, '0')}`, name: `สินค้าทดสอบ ${i}`, qty: i, active: true, marketplaces: tags, ...รูป })
    }
    const counts = { shopee: 0, lazada: 0, tiktok: 0, gucut: 0, none: 0 }
    for (const r of all) { if (!r.marketplaces.length) counts.none++; for (const t of r.marketplaces) counts[t]++ }
    let pool = all
    if (q) pool = pool.filter((r) => r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    // 🔴 ท่อรุ่นเก่า: **เมินตัวกรองเงียบ ๆ แล้วตอบ 200** — เคสที่จอต้องจับให้ได้
    const oldPipe = mode === 'oldpipe'
    if (channel && !oldPipe) pool = pool.filter((r) => channel === 'none' ? !r.marketplaces.length : r.marketplaces.includes(channel))
    const page = pool.slice(offset, offset + limit)
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, day: '2026-09-11', ...(mode === 'nototal' ? {} : { total: TOTAL }), rows: page,
      checkedMarketplaces: ['shopee', 'lazada', 'tiktok'], marketplacesAt: '2026-09-11T08:00:00.000Z',
      ...(oldPipe ? {} : { rowsMatched: pool.length, rowsReturned: page.length }),
      ...(channel && !oldPipe ? { channel, ...(mode === 'midpipe' ? {} : { channelCounts: counts }) } : {}),
      /* 🔑 เส้นสต็อกของท่อจริง **ไม่มีช่อง `applied`** แต่ echo `only`/`kind` ที่ชั้นบน
         (ยิงยืนยัน 17 ก.ย. 2569: ไม่ส่ง ⇒ null · ส่ง ⇒ ค่าเดิมเป๊ะ)
         โหมด badecho = **echo ผิดจากที่ขอ** — ปลูกบั๊กไว้ให้คำเตือนบนจอต้องขึ้น
         (ถ้าไม่มีโหมดนี้ คำเตือนจะไม่เคยถูกทดสอบเลย = ด่านที่ไม่มีใครลองยิงใส่) */
      ...(mode === 'badecho'
        ? { only: 'low', kind: 'goods' }
        : { only: u.searchParams.get('only'), kind: u.searchParams.get('kind') }),
    }))
  }
  /* หมวดหมู่ + สินค้าในหมวด — มี 218 รหัสโดยตั้งใจ (เลขจริงของหมวด 'อะไหล่ 5200…')
     เพื่อให้ทดสอบขอบของการแบ่งหน้าได้: หน้าแรก 200 · หน้าสอง 18 · ปุ่มถัดไปต้องดับ */
  if (mode === 'good' && /[?&]list=categories\b/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      rows: [{ name: 'หมวดทดสอบ 218', skus: 218, onhand_value: 1000, available_value: 900, zort: true }],
      total: 1,
      /* ท่อจริงส่งจำนวนหมวดทั้งหมดมาด้วย (ยืนยัน 14 ก.ย. 2569) — ท่อปลอมเคยไม่ส่ง
         ⇒ จอขึ้น "จำนวน ไม่รู้ (ท่อไม่ได้ส่งมา) หมวด" ซึ่งเป็นอาการของท่อปลอม ไม่ใช่ของจริง */
      categories: 1,
    }))
  }
  if (mode === 'good' && /[?&]list=stock\b/.test(req.url) && /[?&]category=/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const limit = Math.min(200, Number(u.searchParams.get('limit')) || 200)
    const offset = Math.max(0, Number(u.searchParams.get('offset')) || 0)
    /* ชื่อหมวดมีคำว่า 'เล็ก' = หมวดที่ของไม่ถึงหน้าเดียว — ใช้ทดสอบว่าปุ่มหน้าต้องไม่โผล่ */
    const TOTAL = /เล็ก/.test(u.searchParams.get('category') || '') ? 5 : 218
    const rows = []
    for (let i = offset; i < Math.min(TOTAL, offset + limit); i++) {
      rows.push({ sku: `CAT-${String(i + 1).padStart(3, '0')}`, name: `สินค้าทดสอบ ${i + 1}`, onhand: 1, available: 1 })
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, total: TOTAL, shown: TOTAL, rows }))
  }
  /* ประวัติของเข้า-ออก (?list=moves[&sku=]) — มีแถวของ NW-01 ให้เห็นว่าตัวกรองทำงาน */
  if (mode === 'good' && /[?&]list=moves\b/.test(req.url)) {
    const sku = decodeURIComponent((req.url.match(/[?&]sku=([^&]*)/) || [])[1] || '').trim()
    const all = [
      { id: 2, sku: 'NW-01', qty: 50, reason: 'receive', ref: 'PO-001', at: '2026-09-01 02:10:00' },
      { id: 1, sku: 'NW-99', qty: -2, reason: 'damage', ref: 'DMG-001', at: '2026-08-30 04:00:00' },
    ]
    const rows = sku ? all.filter((r) => r.sku === sku) : all
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, rows, total: rows.length }))
  }
  /* ออเดอร์เว็บ (/api/orders) — จอ /web/orders
     ⚠️ จงใจส่ง unreadable > 0 เพื่อทดสอบว่าจอ **ไม่พูดว่า "ทั้งหมด N ใบ"** ตอนมีใบอ่านไม่ได้
        (ใบที่อ่านไม่ได้คือออเดอร์ลูกค้าจริงที่ร้านอาจไม่รู้ว่ามี) */
  if (mode === 'good' && /\/api\/orders/.test(req.url) && req.method === 'GET') {
    const now = Date.now()
    const mk = (i, status) => ({
      id: `ORD-${String(i).padStart(3, '0')}`, status, total: 1000 + i,
      name: `ลูกค้า ${i}`, phone: '0800000000', at: new Date(now - i * 3600e3).toISOString(),
      items: [{ sku: 'NW-01', name: 'ทดสอบ', qty: 1, price: 1000 + i }],
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      orders: [mk(1, 'new'), mk(2, 'pending'), mk(3, 'shipped'), mk(4, 'done')],
      unreadable: 2,
    }))
  }
  /* รายชื่อคลัง (?list=warehouses) — จอคงเหลือรายคลังไล่ถามทีละคลังจากรายการนี้
     ⚠️ ใส่คลังปลอมชื่อ SILENT ไว้ด้วย เพื่อให้ทางที่ "ZORT เงียบ" ถูกเดินจริงตอนทดสอบ */
  if (mode === 'good' && /[?&]list=warehouses/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, count: 4, note: 'ท่อปลอม — ห้ามเอาไปสรุปเรื่องของจริง',
      warehouses: [
        { code: 'NEW', name: 'โกดัง', province: '', isPos: false },
        { code: 'KLD', name: 'KLD', province: '', isPos: true },
        { code: 'ANJ', name: 'ANJ', province: '', isPos: true },
        { code: 'SILENT', name: 'คลังที่ ZORT เงียบ', province: '', isPos: true },
      ],
    }))
  }

  /* คงเหลือรายคลังของชุด (?zortbundle=<sku>&wh=<คลัง>) — **สามทางของช่องเหตุผล**
     🔴 ของจริงเดินได้แค่สองทาง (NEW = มีตัวเลข · KLD/ANJ = 'Access Denied.')
        ทางที่สาม "ZORT เงียบ ไม่ส่งตัวเลขและไม่บอกเหตุผล" **ไม่มีวันเกิดบน production**
        ⇒ ถ้าไม่จำลอง เราจะไม่มีทางรู้ว่าจอเขียนถูกไหมตอนนั้น (บทเรียนซ้ำ: ตาข่ายที่เห็น
           แต่ทางที่ถูก พิสูจน์ไม่ได้ว่าทางที่พังจะพูดถูก)
       · wh=NEW    ⇒ 18 / 0 · resCode null
       · wh=KLD    ⇒ null/null + resCode '100' resDesc 'Access Denied.'  (เหมือนของจริง)
       · wh=SILENT ⇒ null/null + **ไม่มี resCode/resDesc เลย** ⇒ จอต้องขึ้น "ยังไม่รู้ว่าเพราะอะไร"
                     **ห้ามขึ้นว่าติดสิทธิ์** เพราะไม่มีอะไรบอกแบบนั้น */
  if (mode === 'good' && /[?&]zortbundle=/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const sku = u.searchParams.get('zortbundle')
    const w = (u.searchParams.get('wh') || '').toUpperCase()
    const denied = w === 'KLD' || w === 'ANJ'
    const silent = w === 'SILENT'
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, found: true, sku, id: 999999, warehousecode: w || null,
      summaryStock: { stock: '18', availablestock: '0' },
      detailStock: (denied || silent) ? { stock: null, availablestock: null } : { stock: '18', availablestock: '0' },
      detail: {
        http: 200,
        resCode: denied ? '100' : null,
        resDesc: denied ? 'Access Denied.' : null,
        keys: ['resCode', 'resDesc', 'detail'],
      },
    }))
  }

  /* สินค้าเป็นชุด (?list=bundles) — มีไว้เดิน **สามทาง** ของแถบอายุตัวเลขคงเหลือ/พร้อมขาย
     🔴 ของจริงซิงก์ตรงเวลาอยู่ ⇒ ทาง "ซิงก์หยุด" กับ "ไม่รู้เวลา" จะไม่มีวันถูกเห็นบน production
        (บทเรียนที่จดไว้: ตาข่ายที่เห็นแต่ทางที่ถูก พิสูจน์ไม่ได้ว่าทางที่พังจะพูดถูก)
       · mode=good        ⇒ ซิงก์เมื่อ 5 นาทีก่อน (เขียว)
       · mode=stalestock  ⇒ ซิงก์เมื่อ 3 ชม.ก่อน  (แดง "ตัวซิงก์น่าจะหยุด")
       · mode=nostocktime ⇒ ไม่ส่ง stockSyncedAt เลย (เทา "ยังไม่รู้" **ห้ามเขียนว่าหยุด**)
     ⚠️ พร้อมขาย = 0 ในแถวแรก ⇒ ต้องขึ้นเครื่องหมาย ⚠ "0 อาจหมายถึงติดลบ"
        และแถวที่สองคงเหลือติดลบจริง ⇒ แดง · แถวที่สามไม่มีตัวเลขเลย ⇒ ขีด */
  if (/[?&]list=bundles(&|$)/.test(req.url) && ['good', 'stalestock', 'nostocktime'].includes(mode)) {
    const iso = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString().replace('T', ' ').slice(0, 19)
    const body = {
      ok: true, total: 3, active: 3, inactive: 0, negative: 1, limit: 50, offset: 0,
      recipeAt: '2026-09-03 02:12:25',
      recipeCheckedAt: iso(20),
      note: 'ท่อปลอม — ห้ามเอาไปสรุปเรื่องของจริง',
      rows: [
        { sku: 'FAKE-A', name: 'ชุดทดสอบ พร้อมขายเป็นศูนย์', sellprice: 6700, onhand: 18, available: 0, active: 1, unit: 'SET', itemCount: 4, itemsValue: 6975 },
        { sku: 'FAKE-B', name: 'ชุดทดสอบ คงเหลือติดลบ', sellprice: 1200, onhand: -4, available: -4, active: 1, unit: 'SET', itemCount: 2, itemsValue: null },
        { sku: 'FAKE-C', name: 'ชุดทดสอบ ไม่มีตัวเลขเลย', active: 1, unit: 'SET', itemCount: 1 },
      ],
    }
    if (mode === 'good') body.stockSyncedAt = iso(5)
    if (mode === 'stalestock') body.stockSyncedAt = iso(180)
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(body))
  }

  /* SKU ที่คลังไม่รู้จัก (?list=missing-sku) — จอต้องใช้เลขจากท่อ ไม่ใช่นับจากแถว
     ⚠️ จงใจให้ **แถวที่ส่งมาน้อยกว่ายอดที่ประกาศ** เพื่อทดสอบว่าจอขึ้นป้ายเตือน
        และเลขบนปุ่มยังถูกต้อง (มาจากท่อ ไม่ได้นับจากแถวที่ขาด) */
  if (mode === 'good' && /[?&]list=missing-sku/.test(req.url)) {
    const rows = []
    for (let i = 1; i <= 10; i++) {
      rows.push({
        sku: `MS-${String(i).padStart(3, '0')}`, name: `รหัสไม่รู้จัก ${i}`, shopee: i,
        baseSku: `MS-${i}`, baseQty: i * 2, baseName: `รหัสฐาน ${i}`,
        buildable: i % 2 === 0 ? i : null,
        matchesShopee: i % 4 === 0 ? false : i % 2 === 0 ? true : null,
      })
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, day: '2026-09-12',
      total: 276, mappedToBase: 276, unknown: 0,
      withRecipe: 265, computed: 265, agreeWithShopee: 156,
      recipeAt: '2026-09-06T10:00:00.000Z',
      rows,
    }))
  }
  /* ค้นสินค้าในจอขายหน้าร้าน (?poslookup=<คำค้น>) — เจอเฉพาะ NW-01 เพื่อให้ทดสอบได้สองทิศ */
  if (mode === 'good' && /[?&]poslookup=/.test(req.url)) {
    const term = decodeURIComponent((req.url.match(/[?&]poslookup=([^&]*)/) || [])[1] || '')
    const hit = term && 'NW-01'.toLowerCase().includes(term.toLowerCase())
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      rows: hit ? [{ sku: 'NW-01', name: 'ทดสอบ', price: 100, stock: 1 }] : [],
      total: hit ? 1 : 0,
    }))
  }
  /* ใบสั่งซื้อรายใบ (?purchase=<เลขใบ>) — โครงตาม getPurchaseDetail ของท่อจริง */
  if (mode === 'good' && /[?&]purchase=/.test(req.url)) {
    const no = decodeURIComponent(req.url.match(/[?&]purchase=([^&]*)/)[1] || '')
    if (no !== 'PO-001') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, error: `ไม่พบใบสั่งซื้อ ${no} ในกระจก` }))
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, number: 'PO-001', vendor: 'โรงงาน', poDate: '2026-09-01',
      status: 'Success', paymentStatus: null, warehouse: null, note: null,
      amount: 5000, lineTotal: 5000,
      lines: [{ line: 1, sku: 'NW-01', name: 'ทดสอบ', qty: 50, price: 100 }],
      updatedAt: '2026-09-01 03:00:00', source: 'กระจกคลังเงา (ไม่ได้ยิง ZORT สด)',
    }))
  }
  /* ตรวจตัวกรองรายคลังกับ ZORT (?zortwarehouse=) — การ์ดรายคลังในหน้าสินค้าใช้ */
  if (mode === 'good' && /[?&]zortwarehouse=/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      verdict: 'ยังไม่พบว่าตัวกรองคลังมีผล — ทุกท่าคืนข้อมูลชุดเดิม (ZORT น่าจะเมินพารามิเตอร์)',
      note: 'ตอบ 200 ไม่ได้แปลว่าใช้ได้',
    }))
  }
  /* ขาที่สองของจอ /core/coverage — นับใบจาก ZORT ตรง ๆ ทีละเดือน (?zortmonthly=1&ym=YYYY-MM)
     ⚠️ ต้องมีครบ **สามผลลัพธ์** เพราะจอต้องเขียนคนละคำ:
        ZORT มีใบ (แต่กระจกว่าง = เรายังไม่กวาด) · ZORT ไม่มีใบจริง (ปิดคดี) · ถาม ZORT ไม่ได้
        ⚠️ กรณีสุดท้ายต้องเป็น error **ห้ามเป็น 0** — 0 แปลว่า "ไม่มีใบจริง" ซึ่งคนละเรื่อง */
  if ((mode === 'good' || mode === 'gap') && /[?&]zortmonthly=/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    const ym = u.searchParams.get('ym') || ''
    /* 🔴 **ต้องตอบต่างกันตามร้าน** (บทเรียน 9 ก.ย. 2569 บ่าย)
       ท่อจริง default เป็น z1 ร้านเดียว แต่ตัวเลขฝั่งกระจกรวมสองร้าน
       ⇒ จอที่ลืมบวกสองร้านจะขึ้น "ต่างกันมาก" ทุกเดือนทั้งที่ไม่มีอะไรผิด
       ท่อปลอมรุ่นก่อนตอบเลขเดียวไม่ว่าถามร้านไหน ⇒ **การทดสอบมองไม่เห็นมิตินี้เลย**
       จอจึงผ่านครบทั้งห้าเส้นทางโดยที่บั๊กยังอยู่ครบ (เจอตอนยิงของจริงหลัง deploy) */
    /* รองรับ store=all แบบท่อจริง (ee196c1) — ต้องมีเพื่อทดสอบทางหลักของจอ
       ⚠️ และต้องมีโหมด "ท่อรุ่นเก่าที่ไม่รู้จัก all แล้วตกกลับ z1 เงียบ ๆ" ด้วย
          (ym ที่ลงท้ายด้วย -07 จำลองท่อเก่า) — นั่นคือพฤติกรรมที่ทำให้บั๊กซ่อนอยู่ได้
          จอต้องจับได้ว่าคำตอบไม่ใช่ของ all จริง แล้วถอยไปถามทีละร้าน */
    const rawStore = u.searchParams.get('store') || 'z1'
    const oldPipe = ym.endsWith('-07')
    if (rawStore === 'all' && !oldPipe) {
      const z1 = (n) => n - Math.round(n * 0.6)
      const z2 = (n) => Math.round(n * 0.6)
      const base = ym === '2026-04' ? 95 : ym === '2026-03' ? 0 : 118
      if (ym === '2026-05') {
        return res.end(JSON.stringify({
          error: 'ถามไม่สำเร็จ 1 ใน 2 ร้าน — ไม่คืนผลรวมบางส่วน', ym, store: 'all',
          failedParts: [{ store: 'z1', error: 'ZORT ตอบ 500' }, { store: 'z2', error: null }],
        }))
      }
      /* 🔴 **ผลที่สี่: ตอบ 200 + `skip`** = "ทำส่วนนี้ต่อไม่ได้" ไม่ใช่ทั้ง error และไม่ใช่ 0
         เพิ่ม 16 ก.ย. 2569 เพราะจอเดิมยุบ skip เข้าไปในสาย error ⇒ ช่องเดือนเขียนเหมือนท่อล้ม
         ⚠️ ห้ามใช้เดือนเดียวกับเคส error (2026-05) ไม่งั้นทดสอบได้ทีละอย่างเท่านั้น */
      if (ym === '2026-06') {
        return res.end(JSON.stringify({ skip: 'ยังไม่ได้ต่อสิทธิ์อ่านรายงานรายเดือนของ ZORT — นับใบเดือนนี้ไม่ได้', ym, store: 'all' }))
      }
      return res.end(JSON.stringify({
        ok: true, ym, store: 'all', stores: ['z1', 'z2'],
        zortCount: z1(base) + z2(base),
        perStore: [{ store: 'z1', zortCount: z1(base) }, { store: 'z2', zortCount: z2(base) }],
        countsCancelled: true,
      }))
    }
    const store = rawStore === 'z2' ? 'z2' : 'z1'
    const part = (n) => (store === 'z2' ? Math.round(n * 0.6) : n - Math.round(n * 0.6))
    res.writeHead(200, { 'content-type': 'application/json' })
    if (ym === '2026-05') return res.end(JSON.stringify({ error: 'ZORT ตอบ 500' }))
    // สถานะที่สามรายเดือน (ดูคอมเมนต์ในขา store=all) — ต้องมีในขานี้ด้วย ไม่งั้นทางถอยยังไม่ถูกทดสอบ
    if (ym === '2026-06') return res.end(JSON.stringify({ skip: 'ยังไม่ได้ต่อสิทธิ์อ่านรายงานรายเดือนของ ZORT — นับใบเดือนนี้ไม่ได้' }))
    // เดือนที่กระจกว่างแต่ ZORT มีใบ = เคสที่ต้องขึ้นแดง "เรายังไม่ได้กวาด"
    if (ym === '2026-04') return res.end(JSON.stringify({ ok: true, ym, store, zortCount: part(95), countsCancelled: true }))
    if (ym === '2026-03') return res.end(JSON.stringify({ ok: true, ym, store, zortCount: 0, countsCancelled: true }))
    return res.end(JSON.stringify({ ok: true, ym, store, zortCount: part(118), countsCancelled: true }))
  }
  /* ยอดรายเดือน (จอ /core/coverage "กระจกครบไหม") — โครงจากซอร์สท่อจริง ?monthly=
     ⚠️ ต้องทดสอบ **สองทิศ**: mode good = ไม่มีเดือนหาย · mode gap = หายกลางช่วง
        ถ้าจอไม่เปลี่ยนหน้าตาระหว่างสองโหมดนี้ แปลว่าจอนั้นแยกแยะไม่ได้ = ยังไม่ได้ทดสอบ */
  if ((mode === 'good' || mode === 'gap') && /[?&]monthly=/.test(req.url)) {
    const months = []
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(Date.UTC(2026, 8 - i, 1))
      const ym = dt.toISOString().slice(0, 7)
      if (mode === 'gap' && (ym === '2026-03' || ym === '2026-04')) continue // เดือนที่ SQL ไม่คืนแถว
      /* โหมด gap มีเดือน "มีใบแต่น้อยผิดปกติ" ด้วย (ของจริง: ม.ค. 2567 = 250 ใบ ระหว่างเดือนพันกว่าใบ)
         เดือนแบบนี้ผ่านด่าน "ไม่มีแถวเลย" ไปได้ ⇒ ต้องมีไว้ทดสอบด่านที่สอง ไม่งั้นไม่รู้ว่ามันทำงานไหม */
      const low = mode === 'gap' && ym === '2026-06'
      months.push({ ym, orders: low ? 12 : 120 + i, sales: low ? 24000 : 250000 + i * 1000 })
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true, store: 'ทั้ง 2 ร้าน', from: '2025-10-01', to: '2026-09-09',
      months: months.reverse(),
      totalOrders: months.reduce((a, m) => a + m.orders, 0),
      totalSales: months.reduce((a, m) => a + m.sales, 0),
    }))
  }
  /* ประวัติดันสต็อกขึ้นแพลตฟอร์ม (จอ /core/stock-push) — โครงจาก payload จริง 8 ก.ย. 2569 */
  /* แผนดันสต็อกรอบถัดไป (?stockpush=1) — โครงจากการยิงของจริง 11 ก.ย. 2569
     ⚠️ จงใจให้ **สามเจ้าไม่เหมือนกัน**: shopee ปกติ · lazada bucketsAddUp=false (ต้องขึ้นแดง)
        · tiktok ตอบ skip (ต้องขึ้นเหลือง ไม่ใช่ 0) — ทดสอบว่าจอแยกสามทิศได้จริง */
  if (mode === 'good' && /[?&]stockpush=1/.test(req.url)) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      mode: 'ซ้อมอย่างเดียว — ไม่เขียนอะไรกลับแพลตฟอร์ม',
      shopee: {
        platformSkus: 320, same: 205, wouldPush: 73, reopen: 14, close: 0, up: 59, down: 0,
        skipNegative: 27, skipUnknown: 15, bucketsAddUp: true, day: '2026-09-11',
        pushSample: [
          { sku: '03386-33.5T', name: 'โซ่เลื่อยยนต์ NEWWAVE 3623', from: 0, to: 587, delta: 587, kind: 'reopen' },
          { sku: '00313', name: 'หัวเทียนเลื่อยยนต์ NEWWAVE', from: 702, to: 705, delta: 3, kind: 'up' },
        ],
      },
      lazada: {
        platformSkus: 1964, same: 1678, wouldPush: 76, reopen: 1, close: 0, up: 74, down: 1,
        skipNegative: 6, skipUnknown: 10, bucketsAddUp: false, day: '2026-09-11',
        excludedGuess: 2, excludedOneToMany: 192, excludedOneToManyKeys: 91,
        pushSample: [{ sku: 'LZ-001', name: 'ของทดสอบ Lazada', from: 10, to: 12, delta: 2, kind: 'up' }],
      },
      tiktok: { skip: 'ยังไม่มีตารางแปลง id — ดันไม่ได้จนกว่าจะทำเสร็จ' },
      safetyNote: 'ห้ามดันรหัสที่คลังเราติดลบ · ห้ามดันรหัสที่คลังไม่รู้จัก',
      readNote: 'reopen = ของมีแต่ปิดขายอยู่ · close = แพลตฟอร์มโชว์ว่ามีแต่เราไม่มี · ผลตรงข้ามกัน',
    }))
  }
  if (mode === 'good' && /stockpushlog=|stockpushverify=/.test(req.url)) {
    const u = new URL(req.url, 'http://x')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (u.searchParams.get('stockpushverify')) {
      const skus = (u.searchParams.get('stockpushverify') || '').split(',')
      return res.end(JSON.stringify({
        ok: true,
        landed: skus.slice(1),
        notLanded: skus.slice(0, 1).map((sku) => ({ sku, 'ยังต้องดัน': '714→716' })),
        note: 'เทียบกับสต็อกสดบนแพลตฟอร์ม',
      }))
    }
    return res.end(JSON.stringify({
      ok: true,
      log: [
        { at: new Date(Date.now() - 20 * 60e3).toISOString(), platform: 'lazada', fired: 15, pushed: 15, rejected: 0,
          rows: [
            { sku: '03409-3', from: 0, to: 503, kind: 'reopen' },
            { sku: '03496-3', from: 505, to: 510, kind: 'up' },
            { sku: '05086', from: 3, to: 0, kind: 'close' },
            { sku: '00291', from: 120, to: 118, kind: 'down' },
          ] },
        { at: new Date(Date.now() - 21 * 60e3).toISOString(), platform: 'lazada', fired: 1, pushed: 1, rejected: 0,
          rows: [{ sku: '00313', from: 714, to: 716, kind: 'up' }] },
        { at: new Date(Date.now() - 26 * 3600e3).toISOString(), platform: 'lazada', fired: 2, pushed: 1, rejected: 1,
          rows: [{ sku: 'XX-BAD', from: 1, to: 2, kind: 'up' }] },
      ],
    }))
  }
  if (mode === 'good' && /[?&]shopinfo=/.test(req.url)) {
    /* ข้อมูลนิติบุคคล (จอ settings-company) — **ของปลอมทั้งชุด ห้ามเอาชื่อ/เลขจริงมาใส่**
       (กติกา: ห้ามพิมพ์ชื่อร้านลงไฟล์ · ที่นี่ยิ่งห้าม เพราะเป็น fixture ทดสอบ)
       ใส่วันหมดอายุสามแบบให้จอพิสูจน์ expiryTone: หมดแล้ว · ใกล้หมด · เหลือยาว */
    const soon = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10)
    const far = new Date(Date.now() + 400 * 86400e3).toISOString().slice(0, 10)
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      ok: true,
      seller: { name: 'บริษัท ทดสอบผู้ขาย จำกัด', nameEn: 'TEST SELLER CO., LTD.', taxId: '0000000000001', phone: '099-000-0000', email: 'test@example.com' },
      licensee: { name: 'หจก. ทดสอบผู้ผลิต', taxId: '0000000000002' },
      licenses: [
        { kind: 'ใบอนุญาตทดสอบ (หมดแล้ว)', no: 'ทส 1/2560', issued: '2017-01-01', expires: '2018-01-01', authority: 'หน่วยงานทดสอบ' },
        { kind: 'ใบอนุญาตทดสอบ (ใกล้หมด)', no: 'ทส 2/2569', issued: '2026-01-01', expires: soon, authority: 'หน่วยงานทดสอบ' },
        { kind: 'ใบอนุญาตทดสอบ (เหลือยาว)', no: 'ทส 3/2569', issued: '2026-01-01', expires: far, authority: 'หน่วยงานทดสอบ' },
      ],
      trademarks: [{ mark: 'TESTMARK', regNo: '000000000', owner: 'หจก. ทดสอบผู้ผลิต', registered: '2020-01-01', expires: far }],
      distributorships: [{ brand: 'TESTMARK', appointer: 'หจก. ทดสอบผู้ผลิต', appointee: 'บริษัท ทดสอบผู้ขาย จำกัด', scope: 'ตัวแทนทดสอบ', issued: '2026-01-01', expires: null }],
    }))
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
      /* ⚠️ ใบที่สองตั้งใจให้ **ค้นไม่เจอ** ใน list=orders — จอแพ็คต้องหา id เองตอนกด
         (ท่อจริงไม่ส่ง id มากับ pending) ⇒ ต้องมีใบที่หาไม่เจอไว้ทดสอบทิศตรงข้าม
         ไม่งั้นจะเห็นแต่ทางที่สำเร็จแล้วนึกว่าจอจัดการครบ */
      'ต้องส่งของ': [
        { number: 'SO-001', channel: 'Shopee', day: '2026-09-05', amount: 1000 },
        { number: 'SO-ไม่มีในกระจก', channel: 'TIKTOK', day: '2026-09-08', amount: 2700 },
      ],
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
  console.log(`ท่อปลอมโหมด "${rawMode}" ฟังอยู่ที่ http://127.0.0.1:${port}`)
  console.log('ต่อไป: cd ~/gucut-next && GUCUT_WEB_BASE=http://127.0.0.1:' + port + ' npm run dev')
})
