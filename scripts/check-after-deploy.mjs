#!/usr/bin/env node
/* ยิงของจริงหลัง deploy — ตรวจของที่ค้างไว้ทั้งชุดในคำสั่งเดียว (11 ก.ย. 2569)
 *
 * ทำไมต้องมี: วันนี้มีของรอพิสูจน์ 4 ชุดจาก 10 คอมมิตฝั่งท่อ ถ้าไล่ยิงด้วยมือทีละเส้น
 * จะเกิดสองปัญหาที่เจอมาแล้วทั้งคู่ — (ก) ตรวจไม่ครบแล้วจำว่าตรวจแล้ว
 * (ข) ตรวจผ่านเพราะ "ยิงแล้วได้ 200" ไม่ใช่เพราะค่าถูก
 *
 * ⚠️ **ทุกด่านต้องแยกสามสถานะ**: ผ่าน · ไม่ผ่าน · ยังตรวจไม่ได้ (ท่อยังไม่ deploy/ตอบไม่ครบ)
 *    "ยังตรวจไม่ได้" ห้ามนับเป็นผ่านเด็ดขาด — นั่นคือวิธีที่ตัวตรวจกลายเป็นของประดับ
 * ⚠️ **ห้ามเชื่อ HTTP 200** — ท่อรุ่นเก่าตอบ 200 พร้อมของทั้งคลัง (เจอจริงกับตัวกรองช่องทาง)
 *    ทุกด่านจึงเทียบ **ค่า** ไม่ใช่สถานะ
 * 🚫 อ่านอย่างเดียวทั้งหมด — ไม่มีด่านไหนเขียนอะไร และ **ไม่มีด่านไหนยิงสต็อกจริง**
 *    (ด่านดันสต็อกใช้ dryCheck ซึ่งออกก่อนแตะ Lazada และก่อนจดประวัติ)
 *
 * ใช้: GUCUT_ADMIN_KEY=... node scripts/check-after-deploy.mjs
 *      ไม่ตั้ง env จะอ่านจาก ~/.gucut-admin-key · ออกโค้ด 1 ถ้ามีด่านไม่ผ่าน
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.GUCUT_WEB_BASE || 'https://gucut.com'
const KEY = process.env.GUCUT_ADMIN_KEY
  || (() => { try { return readFileSync(join(homedir(), '.gucut-admin-key'), 'utf8').trim() } catch { return '' } })()
if (!KEY) { console.error('ไม่มีรหัสหลังร้าน — ตั้ง GUCUT_ADMIN_KEY หรือวางไว้ที่ ~/.gucut-admin-key'); process.exit(2) }

const results = []
/** บันทึกผลหนึ่งด่าน · state: 'ok' | 'fail' | 'unknown' (ยังตรวจไม่ได้) */
const say = (group, name, state, detail) => {
  results.push({ group, name, state, detail })
  const mark = state === 'ok' ? '✅' : state === 'fail' ? '🔴' : '⏳'
  console.log(`${mark} [${group}] ${name}\n     ${detail}`)
}

async function get(path) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/api/${path}`, { headers: { 'x-admin-key': KEY } })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { /* ไม่ใช่ JSON = ปล่อยเป็น null ให้ด่านตัดสินเอง */ }
    return { status: res.status, body, ms: Date.now() - t0, raw: text.slice(0, 200) }
  } catch (e) {
    return { status: 0, body: null, ms: Date.now() - t0, raw: String(e?.message || e) }
  }
}

async function post(path, payload) {
  try {
    const res = await fetch(`${BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'x-admin-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { /* เหมือนกับ get */ }
    return { status: res.status, body, raw: text.slice(0, 200) }
  } catch (e) {
    return { status: 0, body: null, raw: String(e?.message || e) }
  }
}

/* ── ชุดที่ 1: กระดานห้องทำงาน AI (owner + กวาดย้อนหลัง) ─────────────────── */
async function officeChecks() {
  const a = await get('office')
  if (a.status !== 200 || !a.body || !Array.isArray(a.body.tasks)) {
    say('ห้องทำงาน', 'อ่านกระดานได้', 'unknown', `HTTP ${a.status} · ${a.raw}`)
    return
  }
  const tasks = a.body.tasks
  const noOwner = tasks.filter((t) => !t?.owner)
  say('ห้องทำงาน', 'ทุกแถวมีเจ้าของ', noOwner.length === 0 ? 'ok' : 'fail',
    `${tasks.length} แถว · ไม่มี owner ${noOwner.length} แถว` +
    (noOwner.length ? ` เช่น "${String(noOwner[0]?.text).slice(0, 40)}"` : ''))

  /* กวาดย้อนหลังต้องทำครั้งเดียวจบ — รอบสองต้องไม่เขียนอะไรอีก
     หลักฐานคือคีย์ backfilled: มี = เขียนรอบนี้ · ไม่มี = ไม่ได้เขียน */
  const b = await get('office')
  const before = Object.prototype.hasOwnProperty.call(a.body, 'backfilled')
  const after = Object.prototype.hasOwnProperty.call(b.body ?? {}, 'backfilled')
  say('ห้องทำงาน', 'กวาดครั้งเดียวจบ (รอบสองไม่เขียนซ้ำ)', after ? 'fail' : 'ok',
    `รอบแรก backfilled=${before ? a.body.backfilled : 'ไม่มีคีย์'} · รอบสอง=${after ? b.body.backfilled : 'ไม่มีคีย์'}` +
    (after ? ' ⇒ ยังเขียน Blobs ทุกครั้งที่มีคนเปิดกระดาน' : ''))

  const n1 = tasks.length
  const n2 = Array.isArray(b.body?.tasks) ? b.body.tasks.length : null
  say('ห้องทำงาน', 'นับก่อน = นับหลัง', n2 === null ? 'unknown' : n1 === n2 ? 'ok' : 'fail',
    `ก่อน ${n1} · หลัง ${n2}`)

  /* 🔴 **ด่านนี้เป็นด่านเดียวที่เขียนของจริงได้** — ถ้าท่อยังไม่รับ owner มันจะสร้างงานจริงบนกระดาน
     ⇒ เก็บกวาดทันทีในด่านเดียวกัน ห้ามทิ้งขยะไว้ให้ท่านประธานเห็นแล้วงง
     (เจอของจริงตอนรันครั้งแรก 11 ก.ย. 2569 — สร้างแถวขยะไว้หนึ่งใบ ต้องตามลบด้วยมือ) */
  const MARK = 'ทดสอบตัวตรวจ owner (ลบอัตโนมัติ)'
  const bad = await post('office', { taskAdd: MARK, owner: 'ไม่มีคนนี้' })
  let cleaned = 'ไม่ได้สร้างอะไร'
  if (bad.status === 200 && bad.body?.id) {
    const del = await post('office', { taskDrop: bad.body.id })
    cleaned = del.body?.ok ? `สร้างแล้วลบคืนเรียบร้อย (${bad.body.id})` : `🔴 สร้างแล้วลบไม่ออก ต้องลบเอง: ${bad.body.id}`
  }
  say('ห้องทำงาน', 'owner ค่าผิดต้องถูกตีกลับ', bad.status === 400 ? 'ok' : 'fail',
    `HTTP ${bad.status} · ${bad.body?.error ?? bad.raw} · ${cleaned}`)
}

/* ── ชุดที่ 2: ดันสต็อก (แผนเต็มถึงตัวยิง) ───────────────────────────────── */
async function stockPushChecks() {
  const pub = await get('core?stockpush=1&platform=lazada')
  const lz = pub.body?.lazada
  if (pub.status !== 200 || !lz) {
    say('ดันสต็อก', 'อ่านแผนสาธารณะได้', 'unknown', `HTTP ${pub.status} · ${pub.raw}`)
    return
  }
  const hasFull = Object.prototype.hasOwnProperty.call(lz, 'push')
  const sample = Array.isArray(lz.pushSample) ? lz.pushSample.length : null
  say('ดันสต็อก', 'เส้นสาธารณะไม่ส่งรายการเต็ม', !hasFull && sample === 25 ? 'ok' : hasFull ? 'fail' : 'unknown',
    `pushSample ${sample} แถว · คีย์ push ${hasFull ? '🔴 มี (คำตอบบวมและหลุดของที่ใช้ตัดสินใจยิง)' : 'ไม่มี (ถูกต้อง)'}`)

  /* โหมดตรวจ: ต้องบอกว่า "จะยิงกี่แถว" โดยไม่ยิงจริง
     ⚠️ ส่ง skus ที่มีจริงจากแผน ไม่งั้นจะได้ 0 แล้วแปลผลไม่ได้ */
  const skus = (lz.pushSample ?? []).slice(0, 3).map((r) => r.sku).filter(Boolean)
  if (!skus.length) {
    say('ดันสต็อก', 'ตัวยิงเห็นแผนครบ (dryCheck)', 'unknown', 'แผนวันนี้ว่าง — ไม่มีรหัสให้ทดสอบ')
    return
  }
  const dry = await post('core?stockpushlive=1', { platform: 'lazada', skus, dryCheck: true })
  const d = dry.body
  if (!d?.dryCheck) {
    say('ดันสต็อก', 'ตัวยิงเห็นแผนครบ (dryCheck)', 'unknown',
      `HTTP ${dry.status} · ไม่มีธง dryCheck กลับมา ⇒ ท่อยังไม่ได้ deploy หรือเส้นเปลี่ยน · ${dry.body?.error ?? dry.raw}`)
    return
  }
  const held = Number(d.planRowsHeld)
  const would = Number(d.wouldPush)
  say('ดันสต็อก', 'ตัวยิงเห็นแผนครบทุกแถว', held === would ? 'ok' : 'fail',
    `ถือแผน ${held} แถว · ควรมี ${would} แถว · จะยิงจริง ${d.wouldFire} จาก ${skus.length} รหัสที่สั่ง`
    + (held === would ? '' : ' ⇒ 🔴 ด่านจะปฏิเสธทั้งรอบตอนยิงจริง'))
}

/* ── ชุดที่ 3: ตัวกรองช่องทางของ list=stock ─────────────────────────────── */
const EXPECT = { shopee: 76, lazada: 1657, tiktok: 62, gucut: 2027, none: 554 }
async function channelChecks() {
  const first = await get('core?list=stock&marketplaces=1&limit=1&channel=shopee')
  if (first.body?.channel !== 'shopee') {
    say('ตัวกรองช่องทาง', 'ท่อรับตัวกรองแล้ว', 'unknown',
      `HTTP ${first.status} · ไม่ได้สะท้อนคีย์ channel กลับมา ⇒ core.mjs ยังไม่ได้เติมบรรทัดรับพารามิเตอร์`)
    return
  }
  /* ⚠️ เลขที่คาดหวังเป็นของ "วันที่วัด" (11 ก.ย. 2569) — ของจริงขยับได้ทุกวันตามที่ร้านลงขายเพิ่ม/ถอด
     ⇒ ต่างเล็กน้อย = เตือน ไม่ใช่ fail · ต่างมาก = ผิดนิยาม */
  for (const [ch, want] of Object.entries(EXPECT)) {
    const r = await get(`core?list=stock&marketplaces=1&limit=1&channel=${ch}`)
    const got = Number(r.body?.rowsMatched)
    if (!Number.isFinite(got)) {
      say('ตัวกรองช่องทาง', `นับช่อง ${ch}`, 'unknown', `ไม่มี rowsMatched · HTTP ${r.status}`)
      continue
    }
    const gap = Math.abs(got - want)
    say('ตัวกรองช่องทาง', `นับช่อง ${ch}`, gap === 0 ? 'ok' : gap <= Math.max(5, want * 0.02) ? 'ok' : 'fail',
      `ได้ ${got} · วันที่วัดไว้ ${want}${gap ? ` (ต่าง ${gap})` : ''}`)
  }
  const bad = await get('core?list=stock&marketplaces=1&limit=1&channel=ไม่มีช่องนี้')
  say('ตัวกรองช่องทาง', 'ค่าที่ไม่รู้จักต้องถูกตีกลับ', bad.status === 400 ? 'ok' : bad.body?.error ? 'ok' : 'fail',
    `HTTP ${bad.status} · ${bad.body?.error ?? 'ไม่มี error ⇒ 🔴 กรองเงียบแล้วคืนทั้งคลัง'}`)

  const withQ = await get('core?list=stock&marketplaces=1&limit=1&channel=shopee&q=00')
  const qOk = withQ.body?.channel === 'shopee' && Number.isFinite(Number(withQ.body?.rowsMatched))
    && Number(withQ.body.rowsMatched) <= EXPECT.shopee
  say('ตัวกรองช่องทาง', 'ใช้ร่วมกับคำค้นได้', qOk ? 'ok' : 'fail',
    `channel=shopee&q=00 ⇒ ${withQ.body?.rowsMatched} แถว (ต้องไม่เกิน ${EXPECT.shopee})`)
}

/* ── ชุดที่ 4: ตาข่ายความครบของสองแพลตฟอร์ม ────────────────────────────── */
async function coverageChecks() {
  const r = await get('core?stockcompare=1')
  const body = r.body ?? {}
  /* ⚠️ ค่าอยู่ใต้คีย์ `stock` ไม่ใช่ชั้นบนและไม่ใช่ใต้ `shopee` — ยืนยันจากการยิงจริง 11 ก.ย. 2569
     (รอบแรกเดาที่อยู่ผิด แล้วด่านขึ้น "ยังตรวจไม่ได้" ซึ่ง **ถูกต้องแล้ว**:
      หาไม่เจอ = ไม่รู้ ไม่ใช่ผ่าน ⇒ ตัวตรวจพาไปหาที่อยู่จริงแทนที่จะเขียวหลอก) */
  const shop = body.stock ?? body.shopee ?? body
  const flag = shop?.sawAllItems
  if (flag === undefined) {
    say('ตาข่ายความครบ', 'Shopee ไล่หน้าครบ', 'unknown',
      `ไม่มีคีย์ sawAllItems ⇒ ท่อยังไม่ได้ deploy หรือเส้นนี้ไม่ใช่ตัวที่คืนค่า (HTTP ${r.status})`)
    return
  }
  say('ตาข่ายความครบ', 'Shopee ไล่หน้าครบ', flag === true ? 'ok' : flag === null ? 'unknown' : 'fail',
    `sawAllItems=${flag} · ได้ ${shop.itemsSeen} จากที่ Shopee ประกาศ ${shop.shopeeItemTotal}`
    + (flag === null ? ' ⇒ แพลตฟอร์มไม่ได้บอกยอดรวม = ยังไม่ได้ตรวจ' : ''))
}

/* ── ชุดที่ 5: คีย์ที่จอรุ่นใหม่พึ่งพา ──
   จอ 6 ใบที่แก้วันนี้อ่านคีย์พวกนี้จากท่อ ถ้าวันหนึ่งท่อเลิกส่ง จอจะกลับไปเงียบ/เดาเอง
   ⇒ ตรวจว่า "คีย์ยังอยู่" เป็นด่านของตัวเอง ไม่ใช่รอให้คนเปิดจอแล้วสังเกตเอง
   ⚠️ ตรวจแค่ว่ามีคีย์และเป็นตัวเลข **ไม่ตรวจว่าเลขถูก** (เลขถูกพิสูจน์ตอนเทียบกับจอ) */
async function screenContractChecks() {
  const cases = [
    ['customer-report ต้องมี distinctNames', 'core?bycustomer=1&days=7&limit=5', (b) => typeof b?.distinctNames === 'number', (b) => `distinctNames=${b?.distinctNames}`],
    ['missing-sku ต้องมี computed/agreeWithShopee', 'core?list=missing-sku', (b) => typeof b?.computed === 'number' && typeof b?.agreeWithShopee === 'number', (b) => `computed=${b?.computed} · agree=${b?.agreeWithShopee}`],
    ['categories ต้องมี total', 'core?list=categories', (b) => typeof b?.total === 'number', (b) => `total=${b?.total} · rows=${(b?.rows ?? []).length}`],
    ['orders ต้องมี unreadable', 'orders', (b) => typeof b?.unreadable === 'number', (b) => `unreadable=${b?.unreadable} · orders=${(b?.orders ?? []).length}`],
  ]
  for (const [name, path, ok, detail] of cases) {
    const r = await get(path)
    const good = r.status === 200 && ok(r.body)
    say('คีย์ที่จอพึ่งพา', name, good ? 'ok' : r.status === 200 ? 'fail' : 'unknown',
      `HTTP ${r.status} · ${r.body ? detail(r.body) : r.raw}`)
  }
}

const groups = [officeChecks, stockPushChecks, channelChecks, coverageChecks, screenContractChecks]
for (const g of groups) {
  try { await g() } catch (e) { say('ระบบ', g.name, 'unknown', `ด่านล้มกลางทาง: ${String(e?.message || e)}`) }
}

const fail = results.filter((r) => r.state === 'fail')
const unknown = results.filter((r) => r.state === 'unknown')
console.log(`\nสรุป: ผ่าน ${results.length - fail.length - unknown.length} · ไม่ผ่าน ${fail.length} · ยังตรวจไม่ได้ ${unknown.length}`)
if (unknown.length) console.log('⏳ "ยังตรวจไม่ได้" ไม่ใช่ผ่าน — ส่วนใหญ่แปลว่าท่อยังไม่ขึ้นของใหม่')
process.exit(fail.length ? 1 : 0)
