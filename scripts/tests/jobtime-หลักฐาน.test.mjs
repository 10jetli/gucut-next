/* `อ่านผลจาก()` ของตัวจับเวลา — **ตัววัดต้องพิสูจน์ว่าแตะงานจริง** (คำกำชับในใบ S1)
 * (20 ก.ย. 2569)
 *
 * 🔴 รูที่เจอตอนเอาคำกำชับในใบมาส่องเครื่องมือของตัวเอง:
 *    ① คำตอบที่ **ไม่ใช่ JSON** (เช่น 200 พร้อมหน้า error ของปลายทาง — อาการจริงที่ทีมเจอกับ ZORT)
 *      ⇒ เดิมได้ `ผล: null, note: null` ⇒ **ไม่มีหลักฐานสักชิ้น** และหน้าตาเหมือน "ยังตัดสินไม่ได้"
 *    ② ไม่เคยบันทึก **ขนาด body** ทั้งที่ใบสั่งไว้ตรง ๆ ⇒ 200 ตัวเปล่ากับ 200 ที่มีของ แยกไม่ออก
 *    ③ ย่อรายการด้วย `.slice(0, 6)` **โดยไม่บอกจำนวนเต็ม** ⇒ คลาสเดียวกับที่ทีมไล่กันคืนนี้
 *      — และผมเขียนรูนี้ไว้เองในเครื่องมือที่สร้างเมื่อไม่กี่ชั่วโมงก่อน
 *
 * 🔑 เทสชุดนี้จำลอง **คำตอบที่ผิดปกติ** เป็นหลัก ตามใบ
 *    `code-that-only-runs-when-something-is-wrong-has-never-run`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { อ่านผลจาก } from '../../netlify/functions/lib-jobtime.mjs'

const ตอบ = (body, status = 200, type = 'application/json') =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } })

test('① รูที่เพิ่งอุด: 200 แต่เนื้อเป็น HTML ⇒ ต้องมีหลักฐาน ไม่ใช่ความเงียบ', async () => {
  const r = await อ่านผลจาก(ตอบ('<html><body>Service Unavailable</body></html>', 200, 'text/html'))
  assert.equal(r.ผล, null, 'ตัดสินไม่ได้ — ห้ามอ่านเป็นสำเร็จ')
  assert.match(r.note, /HTTP 200/)
  assert.match(r.note, /ไบต์/, '🔴 ต้องบอกขนาด body — ใบ S1 สั่งไว้ตรง ๆ')
  assert.match(r.note, /คำตอบไม่ใช่ JSON/, 'ความเงียบต้องถูกเขียนออกมาเป็นคำ')
})

test('② 200 ตัวเปล่า ต้องแยกออกจาก 200 ที่มีของ ด้วยขนาดไบต์', async () => {
  const ว่าง = await อ่านผลจาก(ตอบ('', 200, 'text/plain'))
  const มีของ = await อ่านผลจาก(ตอบ({ ok: true, rows: 5 }))
  assert.match(ว่าง.note, /· 0 ไบต์ ·/)
  assert.ok(!/· 0 ไบต์ ·/.test(มีของ.note), 'ตัวที่มีของต้องไม่ใช่ 0 ไบต์')
})

test('③ สำเร็จพร้อมตัวเลข ⇒ เก็บเลขเป็นหลักฐาน (ตัวควบคุมลบ)', async () => {
  const r = await อ่านผลจาก(ตอบ({ ok: true, rows: 5, total: 12, files: [1, 2, 3] }))
  assert.equal(r.ผล, 'ok')
  assert.match(r.note, /rows 5/)
  assert.match(r.note, /total 12/)
  assert.match(r.note, /files 3/, 'อาร์เรย์เก็บเป็นจำนวนสมาชิก')
})

test('④ ล้มจริง ⇒ failed และเห็นรหัสสถานะ', async () => {
  const r = await อ่านผลจาก(ตอบ({ ok: false, error: 'พัง' }, 500))
  assert.equal(r.ผล, 'failed')
  assert.match(r.note, /HTTP 500/)
})

test('⑤ skip ⇒ ตัดสินไม่ได้ และยังต้องบอกขนาด', async () => {
  const r = await อ่านผลจาก(ตอบ({ skip: 'ยังไม่ถึงเวลา' }))
  assert.equal(r.ผล, null, 'skip ไม่ใช่สำเร็จ และไม่ใช่ล้ม')
  assert.match(r.note, /skip: ยังไม่ถึงเวลา/)
  assert.match(r.note, /ไบต์/)
})

test('⑥ เลขเกิน 6 ช่อง ⇒ ต้องบอกจำนวนเต็ม ไม่ใช่ตัดเงียบ', async () => {
  const body = { ok: true }
  for (let i = 0; i < 9; i++) body[`n${i}`] = i
  const r = await อ่านผลจาก(ตอบ(body))
  assert.match(r.note, /อีก 3 · รวม 9/, '🔴 ตัดรายการแล้วเงียบ = คำกล่าวอ้างเท็จว่าครบ')
})

test('⑦ สำเร็จแต่ไม่มีเลขเลย ⇒ ต้องเขียนว่าไม่มี ไม่ใช่ปล่อยว่าง', async () => {
  const r = await อ่านผลจาก(ตอบ({ ok: true }))
  assert.equal(r.ผล, 'ok')
  assert.match(r.note, /ไม่มีตัวเลขในคำตอบ/, '"ok" ที่ไม่มีเลขประกอบ = คำรับรอง ไม่ใช่หลักฐาน')
})

test('⑧ ไม่ใช่ Response ⇒ ไม่แกล้งตอบ', async () => {
  assert.deepEqual(await อ่านผลจาก({ ok: true }), { ผล: null, note: null })
})
