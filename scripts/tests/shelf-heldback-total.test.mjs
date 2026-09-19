/* `heldBackTotal` — **เดินทางที่ `held.length > 10` ให้จริง ไม่ใช่จดเป็นหนี้**
 * (19 ก.ย. 2569 · ฝั่งท่อทำก่อนกับ `logTotal` ของ `/api/points` — เขา mock แล้วยิง handler จริง
 *  ผมทำแบบนั้นไม่ได้ จึงแยกตัวประกอบคำตอบออกมาแล้วเดินทางนั้นตรง ๆ · อ่อนกว่าหนึ่งชั้น)
 *
 * 🔑 เหตุที่ยิง handler ในเครื่องไม่ได้: `askedToday`/`answeredDays` มาจาก Netlify Blobs
 *    ⇒ ในเครื่องล้มแล้วถูก `.catch` ให้เป็นชุดว่าง ⇒ `held` ว่างเสมอ ⇒ **ทางนั้นไม่มีวันถูกเดิน**
 *    ⇒ นี่คือรูปหนึ่งของ "ทางที่ไม่เคยถูกเดิน" ที่ **การทดสอบตรรกะแยกจับไม่ได้**
 *       เพราะตรรกะแยกจะผ่านเสมอ ส่วนของจริงไม่เคยไปถึง
 *
 * ⚠️ **สิ่งที่เทสนี้ไม่ได้พิสูจน์** (เขียนไว้ตรง ๆ ตามกติกาที่ฝั่งท่อตั้ง):
 *    planFor ส่ง `held` ตัวจริงเข้า `ผลแผน()` ถูกไหม — เป็นหนึ่งบรรทัด เห็นได้ใน diff
 *    และตัวปลอมเห็นได้แค่มิติที่เราใส่ให้ ⇒ ยังต้องยิงเส้นจริงหลัง deploy
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ผลแผน } from '../../netlify/functions/shelf-ask.mjs'

const ฐาน = {
  sourceName: 'ทดสอบ',
  picked: { orders: [], tooOld: 0, tooNew: 0, badDay: 0 },
  asked: 0,
  missed: [],
  skippedOverCap: 0,
  groups: [],
  ask: [],
  overflow: [],
  today: '2026-09-19',
}
const กอง = (n) => Array.from({ length: n }, (_, i) => ({ sku: `SKU-${i}`, why: 'ถามไปแล้ววันนี้' }))

test('เกินเพดาน: ตัดที่ 10 แต่บอกจำนวนเต็ม 47', () => {
  const r = ผลแผน({ ...ฐาน, held: กอง(47) })
  assert.equal(r.heldBack.length, 10, 'รายการต้องถูกตัดที่ 10')
  assert.equal(r.heldBackTotal, 47, '🔴 จำนวนเต็มต้องเป็น 47 — ไม่งั้นจอเห็น 10 แล้วอ่านว่าครบ')
  assert.equal(r.heldBack[0].sku, 'SKU-0', 'ต้องเป็น 10 ตัวแรก ไม่ใช่สุ่ม')
})

/* ตัวควบคุมลบ — ถ้าไม่มีสองข้อนี้ เทสข้างบนผ่านได้ด้วยโค้ดที่ตั้ง heldBackTotal เป็นค่าคงที่ */
test('ตัวควบคุมลบ ①: ต่ำกว่าเพดาน ⇒ สองค่าต้องเท่ากัน', () => {
  const r = ผลแผน({ ...ฐาน, held: กอง(5) })
  assert.equal(r.heldBack.length, 5)
  assert.equal(r.heldBackTotal, 5)
})

test('ตัวควบคุมลบ ②: ไม่มีของค้าง ⇒ 0 ไม่ใช่ null/undefined', () => {
  const r = ผลแผน({ ...ฐาน, held: [] })
  assert.deepEqual(r.heldBack, [])
  assert.equal(r.heldBackTotal, 0, 'ต้องเป็นเลข 0 — "ไม่มี" ต้องต่างจาก "ไม่รู้"')
})

test('พอดีเพดาน 10 ⇒ ยังต้องบอกจำนวน และต้องไม่ดูเหมือนถูกตัด', () => {
  const r = ผลแผน({ ...ฐาน, held: กอง(10) })
  assert.equal(r.heldBack.length, 10)
  assert.equal(r.heldBackTotal, 10)
})
