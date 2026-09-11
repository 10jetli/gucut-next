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
//   node scripts/fake-pipe.mjs 4010 skip    ← สถานะที่สาม "ทำต่อไม่ได้" (ต้องขึ้นเหลือง ไม่ใช่แดง)
//   node scripts/fake-pipe.mjs 4010 nocounts ← มีงานค้างแต่ไม่มียอดแยกกอง (เทสคำเตือน "ใบผี")
//   node scripts/fake-pipe.mjs 4010 mkstale ← คอลัมน์ Marketplace เป็นของเก่า (เทสแถบ MarketStaleBar)
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
  if (mode === 'good' && req.url.startsWith('/api/office')) {
    globalThis.__office ??= {
      tasks: [
        { id: 't1', text: 'ไปกด GRUB หน้าเครื่อง g1', note: 'บูตค้างจากเคอร์เนล 139', done: false, at: Date.now() - 2 * 3600e3 },
        { id: 't2', text: 'เอา PEAK API key มาให้ทีม', done: false, at: Date.now() - 26 * 3600e3 },
        { id: 't3', text: 'กรอกตัวเลข sold.json', done: true, at: Date.now() - 3 * 86400e3, doneAt: Date.now() - 3600e3 },
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
    /* ใบเดียวพร้อมรายการสินค้า (จอ wizard แพ็คสินค้า) — รูปตาม getOrder ของจริง: {order, items} */
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      order: { id: 'z1-1', source: 'z1', number: 'SO-001', channel: 'Shopee', status: 'Pending',
        amount: 1000, customer: 'ลูกค้าทดสอบ', order_date: '2026-09-05', tracking_no: 'TH000TEST', pay_status: 'paid' },
      items: [
        { line: 1, sku: 'NW-01', name: 'สินค้าทดสอบหนึ่ง', qty: 1, amount: 500 },
        { line: 2, sku: 'NW-02', name: 'สินค้าทดสอบสอง (หลายชิ้น)', qty: 3, amount: 500 },
      ],
    }))
  }
  /* รายละเอียดใบเสนอราคา/ใบโอน (จอ detail ใหม่ — โครงจากซอร์สท่อจริง) */
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
      historyFrom: '2026-06-01', monthly: [],
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
  console.log(`ท่อปลอมโหมด "${mode}" ฟังอยู่ที่ http://127.0.0.1:${port}`)
  console.log('ต่อไป: cd ~/gucut-next && GUCUT_WEB_BASE=http://127.0.0.1:' + port + ' npm run dev')
})
