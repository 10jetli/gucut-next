/* สถานะดันสต็อกสามสถานะ (lib/stock-push-state.ts) — ตรึงด้วยรูปคำตอบจริงของ ?pushstate=1 16 ต.ค. 2569 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { อ่านสถานะดันสต็อก } from '../../lib/stock-push-state.ts'

const now = Date.parse('2026-10-16T08:00:00Z')
const จริง = {
  'ค้างนานเกณฑ์ชั่วโมง': 24,
  byChannel: {
    lazada: { 'มีตัวยิง': true, autoOn: true, lastSweep: { at: '2026-10-05T21:30:35.110Z' } },
    shopee: { 'มีตัวยิง': true, autoOn: true, lastSweep: { at: '2026-10-16T07:50:19.035Z' } },
    tiktok: { 'มีตัวยิง': true, autoOn: true, lastSweep: { at: '2026-10-16T07:55:12.475Z' } },
  },
}

test('ของจริง 16 ต.ค.: Lazada เกิน 24 ชม. ⇒ หยุด · อีกสองเจ้าปกติ', () => {
  const r = อ่านสถานะดันสต็อก(จริง, now)
  assert.equal(r.สถานะ, 'หยุด')
  assert.deepEqual(r.ราย.filter((x) => x.หยุด).map((x) => x.ช่องทาง), ['lazada'])
  assert.ok(Math.floor(r.ราย.find((x) => x.ช่องทาง === 'lazada').ชม / 24) === 10)
})

test('ทุกเจ้าวิ่งปกติ ⇒ ปกติ (ตัวควบคุม)', () => {
  const j = structuredClone(จริง); j.byChannel.lazada.lastSweep.at = '2026-10-16T07:45:00Z'
  assert.equal(อ่านสถานะดันสต็อก(j, now).สถานะ, 'ปกติ')
})

test('🔴 อ่านไม่ได้ ⇒ ไม่รู้ ห้ามปกติ', () => {
  for (const bad of [null, {}, { error: 'x' }, 'html', { byChannel: null }]) assert.equal(อ่านสถานะดันสต็อก(bad, now).สถานะ, 'ไม่รู้')
})

test('🔴 ท่อไม่ส่งเกณฑ์ ⇒ ไม่รู้ (ไม่ฝังเลขเอง)', () => {
  const j = structuredClone(จริง); delete j['ค้างนานเกณฑ์ชั่วโมง']; j.byChannel.lazada.lastSweep.at = '2026-10-16T07:45:00Z'
  assert.equal(อ่านสถานะดันสต็อก(j, now).สถานะ, 'ไม่รู้')
})

test('🔴 ช่องทางไม่มีเวลารอบล่าสุด ⇒ ไม่รู้ (ไม่ใช่ปกติ)', () => {
  const j = structuredClone(จริง); j.byChannel.lazada.lastSweep = {}
  assert.equal(อ่านสถานะดันสต็อก(j, now).สถานะ, 'ไม่รู้')
})

test('ช่องทางที่ปิดอัตโนมัติเอง ไม่นับว่าหยุด', () => {
  const j = structuredClone(จริง); j.byChannel.lazada.autoOn = false
  assert.equal(อ่านสถานะดันสต็อก(j, now).สถานะ, 'ปกติ')
})
