/* ทดสอบ lib-jobtime ด้วยการ **รันจริง** — เน้นข้อเดียว: ตัวจับเวลาห้ามทำให้งานจริงเปลี่ยนผล */
import { test } from 'node:test'
import assert from 'node:assert/strict'
const { วัดเวลางาน, อ่านผลจาก } = await import(new URL('../../netlify/functions/lib-jobtime.mjs', import.meta.url).href)

process.env.GUCUT_WEB_ADMIN_KEY = ''   // ⇒ จดลงสมุดไม่ได้ (จำลองวันที่ช่องล่ม)

test('ส่งสมุดไม่ได้ ⇒ งานจริงยังคืนผลเดิม ไม่โยน error', async () => {
  const r = await วัดเวลางาน('ทดสอบ', async () => ({ ของ: 42 }))
  assert.deepEqual(r.ผลลัพธ์, { ของ: 42 })
  assert.equal(r.จดเวลา, false)
  assert.ok(r.ms >= 0)
})

test('🔑 งานจริงโยน error ⇒ ต้องโยนต่อ ไม่ถูกกลืน', async () => {
  await assert.rejects(
    () => วัดเวลางาน('ทดสอบ', async () => { throw new Error('ของจริงพัง') }),
    /ของจริงพัง/,
  )
})

test('ไม่ใส่ ตัดสินผล ⇒ ผลเป็น null (ยังตัดสินไม่ได้) ไม่ใช่ ok', async () => {
  const r = await วัดเวลางาน('ทดสอบ', async () => ({}))
  assert.equal(r.ผล, null)
})

test('ตัดสินผล คืน failed ⇒ บันทึกเป็น failed', async () => {
  const r = await วัดเวลางาน('ทดสอบ', async () => ({ bad: 1 }), { ตัดสินผล: (x) => (x.bad ? 'failed' : 'ok') })
  assert.equal(r.ผล, 'failed')
})

/* ── อ่านผลจาก Response: สามสถานะตามสัญญาของโปรเจกต์ ── */
const res = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })

test('{ok:true} + ตัวเลข ⇒ ok และ note มีหลักฐานว่าแตะงานจริง', async () => {
  const x = await อ่านผลจาก(res({ ok: true, saved: 3, skipped: 1 }))
  assert.equal(x.ผล, 'ok')
  assert.match(x.note, /saved 3/)
})
test('🔑 {skip} ⇒ ยังตัดสินไม่ได้ (ไม่ใช่ ok และไม่ใช่ failed)', async () => {
  const x = await อ่านผลจาก(res({ skip: 'ยังไม่ได้ตั้งคีย์' }))
  assert.equal(x.ผล, null)
  assert.match(x.note, /skip/)
})
test('{ok:false} ⇒ failed', async () => {
  assert.equal((await อ่านผลจาก(res({ ok: false, error: 'พัง' }, 502))).ผล, 'failed')
})
test('🔒 สามสถานะต้องต่างกันจริง (กัน skip ถูกยุบเป็น ok)', async () => {
  const ผล = [
    (await อ่านผลจาก(res({ ok: true }))).ผล,
    (await อ่านผลจาก(res({ skip: 'x' }))).ผล,
    (await อ่านผลจาก(res({ ok: false }, 502))).ผล,
  ]
  assert.equal(new Set(ผล).size, 3, `ต้องได้ 3 ผลต่างกัน แต่ได้ ${JSON.stringify(ผล)}`)
})
test('คำตอบที่ไม่ใช่ JSON ⇒ ตัดสินไม่ได้ ไม่ใช่ ok', async () => {
  assert.equal((await อ่านผลจาก(new Response('ok'))).ผล, null)
})
