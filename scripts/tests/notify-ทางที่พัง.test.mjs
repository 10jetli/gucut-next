/* `lib-notify` — ตัวส่งแจ้งเตือนตอนงานตามเวลาล้ม
 * 🔑 **ไฟล์นี้ทำงานเฉพาะตอนมีอะไรผิดปกติ ⇒ ทางของมันจึงไม่เคยถูกเดินเลย**
 *    (19 ก.ย. 2569 · วัดได้ line 39.06% · branch 100.00% — หน้าตาสมบูรณ์แบบในคอลัมน์ที่คนใช้คัด)
 *    ⇒ เทสชุดนี้จึงจำลอง **ความผิดปกติ** ไม่ใช่การใช้งานปกติ ตามใบ
 *      `code-that-only-runs-when-something-is-wrong-has-never-run`
 *
 * 🔴 บั๊กจริงที่ไฟล์นั้นเกิดมาแก้ (8 ก.ย. 2569): ตัวส่งเดิมเขียน `if (!token) return`
 *    ⇒ โปรเจกต์นี้ไม่มีคีย์ Telegram เลย ⇒ **ข้อความเตือนไม่เคยออกสักครั้ง และไม่มีอะไรฟ้อง**
 *    ⇒ เคส ② ข้างล่างคือรูปนั้นเป๊ะ — ต้องได้ `sent:false` **พร้อมเหตุผล** ไม่ใช่เงียบ
 *
 * 🔑 ข้อบังคับที่ทุกเคสต้องผ่านพร้อมกัน: **ห้าม throw** และ **ห้ามคืน `sent:true` เมื่อส่งไม่ออก**
 *    เพราะผู้เรียกเอาค่านี้ไปใส่ในคำตอบของตัวเอง ⇒ ถ้าโกหกตรงนี้ จอจะบอกว่าเตือนแล้ว
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notify } from '../../netlify/functions/lib-notify.mjs'

const คีย์ = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'GUCUT_WEB_ADMIN_KEY']
const ตั้งค่า = (o) => { for (const k of คีย์) { if (o[k] === undefined) delete process.env[k]; else process.env[k] = o[k] } }

/** แทน fetch แล้ว **นับจำนวนครั้ง** — เพื่อพิสูจน์ได้ว่า "ไม่ได้ยิง" ไม่ใช่แค่ "ยิงแล้วเงียบ" */
function แทนFetch(ตอบ) {
  const เรียก = []
  globalThis.fetch = async (url, init) => { เรียก.push({ url: String(url), init }); return ตอบ(String(url)) }
  return เรียก
}
const ตอบJson = (ok, body) => ({ ok, status: ok ? 200 : 500, json: async () => body })

test('① ข้อความว่าง ⇒ ไม่ยิงอะไรเลย และบอกเหตุผล', async () => {
  ตั้งค่า({ GUCUT_WEB_ADMIN_KEY: 'k' })
  const เรียก = แทนFetch(() => { throw new Error('ไม่ควรถูกเรียก') })
  const r = await notify('   ')
  assert.deepEqual(r, { sent: false, via: 'none', error: 'ข้อความว่าง' })
  assert.equal(เรียก.length, 0, 'ต้องไม่ยิงเน็ตเลย')
})

test('② รูปของบั๊กจริง: ไม่มีคีย์สักตัว ⇒ ต้องบอกว่าส่งไม่ออก ไม่ใช่เงียบ', async () => {
  ตั้งค่า({})
  const เรียก = แทนFetch(() => { throw new Error('ไม่ควรถูกเรียก') })
  const r = await notify('บิล LINE เก็บไม่สำเร็จ')
  assert.equal(r.sent, false)
  assert.equal(r.via, 'none')
  assert.match(r.error, /ส่งไม่ได้เลย/, '🔴 ต้องมีเหตุผลติดมาด้วย — ของเดิมคืนเงียบ ๆ แล้วไม่มีใครรู้ว่าไม่เคยเตือน')
  assert.equal(เรียก.length, 0)
})

test('③ ทางตรง: Telegram ตอบปฏิเสธ ⇒ sent:false พร้อมคำของเขา', async () => {
  ตั้งค่า({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' })
  แทนFetch(() => ตอบJson(true, { ok: false, description: 'chat not found' }))
  const r = await notify('x')
  assert.deepEqual(r, { sent: false, via: 'direct', error: 'chat not found' })
})

test('④ ทางตรง: เน็ตพัง/หมดเวลา ⇒ **ห้าม throw** ต้องคืนเหตุผล', async () => {
  ตั้งค่า({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' })
  globalThis.fetch = async () => { throw new Error('The operation was aborted') }
  const r = await notify('x')
  assert.equal(r.sent, false)
  assert.equal(r.via, 'direct')
  assert.match(r.error, /aborted/, 'เหตุผลจริงต้องไปถึงผู้เรียก ไม่ใช่ข้อความกลาง ๆ')
})

test('⑤ ทางสำรอง: ท่อตอบ 500 และ body อ่านไม่ออก ⇒ ต้องได้ HTTP 500 ไม่ใช่ undefined', async () => {
  ตั้งค่า({ GUCUT_WEB_ADMIN_KEY: 'k' })
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error('ไม่ใช่ JSON') } })
  const r = await notify('x')
  assert.deepEqual(r, { sent: false, via: 'gucut.com', error: 'HTTP 500' })
})

test('⑥ ทางสำรอง: ต้องแนบ x-admin-key และยิงไปที่ /api/notify', async () => {
  ตั้งค่า({ GUCUT_WEB_ADMIN_KEY: 'ลับ' })
  const เรียก = แทนFetch(() => ตอบJson(true, { ok: true }))
  const r = await notify('x')
  assert.deepEqual(r, { sent: true, via: 'gucut.com' })
  assert.match(เรียก[0].url, /\/api\/notify$/)
  assert.equal(เรียก[0].init.headers['x-admin-key'], 'ลับ', 'ไม่แนบกุญแจ = ท่อตอบ 401 แล้วเราจะโทษที่อื่น')
})

/* ตัวควบคุมลบ — ถ้าไม่มีข้อนี้ เทสข้างบนผ่านได้ด้วยฟังก์ชันที่คืน sent:false เสมอ */
test('⑦ ทางตรงสำเร็จ ⇒ sent:true · via:direct (ตัวควบคุมลบ)', async () => {
  ตั้งค่า({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' })
  แทนFetch(() => ตอบJson(true, { ok: true }))
  assert.deepEqual(await notify('x'), { sent: true, via: 'direct' })
})

test('⑧ ทางสำรอง: เน็ตพังระหว่างยิงท่อ ⇒ ห้าม throw (บรรทัดที่ coverage ชี้ว่ายังไม่เคยเดิน)', async () => {
  ตั้งค่า({ GUCUT_WEB_ADMIN_KEY: 'k' })
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
  const r = await notify('x')
  assert.equal(r.sent, false)
  assert.equal(r.via, 'gucut.com')
  assert.match(r.error, /ECONNREFUSED/)
})
