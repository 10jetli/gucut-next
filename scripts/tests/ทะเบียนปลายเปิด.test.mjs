/* ด่าน: `scripts/check-ทะเบียนปลายเปิด.mjs` ต้องจับความไม่ตรงกัน **ทั้งสองทิศ**
 *
 * 🔴 ที่มา 14 ต.ค. 2569 — ฝั่งท่อเขียนเองว่า:
 *    *"ของที่กันไว้รอบนี้ไม่ใช่กระบวนการ มันคือการที่ผมเผอิญไปอ่านโค้ดเอง
 *      — ไม่มีด่านไหนอ่านทะเบียนเทียบโค้ดอีกฝั่ง ⇒ ต้องเป็นนิสัยสองด้าน ไม่ใช่โชค"*
 *    ⇒ ด่านนั้นคือด้านของผม · **เทสนี้คือสิ่งที่ทำให้มันไม่ใช่โชคอีกต่อไป**
 *
 * 🔑 ใช้ทะเบียนตัวอย่างในรีโปนี้ (ไม่เขียนไฟล์ลงรีโปของอีกฝั่ง —
 *    "ต้นไม้ร่วมไม่มีสภาพกลางงาน") ⇒ ด่านรับพาธผ่าน `OPEN_ENDED_REGISTRY`
 *    ⚠️ ช่องนั้นมีไว้ **เพื่อให้ทดสอบได้** — ทางที่ทดสอบไม่ได้ คือทางที่จะไม่ถูกทดสอบ
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ด่าน = join(ROOT, 'scripts', 'check-ทะเบียนปลายเปิด.mjs')
const ทะเบียน = join(ROOT, 'scripts', 'tests', 'fixtures', 'ทะเบียนปลายเปิด-ตัวอย่าง.mjs')

const รัน = (โหมด) => spawnSync(process.execPath, [ด่าน], {
  encoding: 'utf8',
  env: { ...process.env, OPEN_ENDED_REGISTRY: ทะเบียน, REGISTRY_MODE: โหมด },
})

test('ทะเบียนตรงกับโค้ด ⇒ เขียว (rc=0) และไม่พิมพ์คำว่าไม่ตรงกัน', () => {
  const r = รัน('ตรง')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.ok(!/ไม่ตรงกัน/.test(r.stdout + r.stderr), 'ด่านที่ร้องทุกครั้งแยกไม่ออกจากด่านที่ร้องเพราะมีปัญหาจริง')
})

test('🔴 ทิศ ①: ทะเบียนจดว่าจออ่าน แต่โค้ดไม่เอ่ยถึงแล้ว ⇒ แดงพร้อมชื่อช่อง', () => {
  const r = รัน('ทิศ1')
  assert.equal(r.status, 1)
  assert.ok(/ทะเบียนค้างอยู่กับจอที่เลิกอ่าน/.test(r.stderr),
    'ต้องบอกว่าทะเบียนค้าง ไม่ใช่บอกแค่ว่า "ไม่ตรง"')
})

test('🔴 ทิศ ②: ทะเบียนจดว่าไม่มีใครอ่าน แต่จออ่านแล้ว ⇒ แดงพร้อมเหตุที่อันตราย', () => {
  const r = รัน('ทิศ2')
  assert.equal(r.status, 1)
  assert.ok(/ถอดข้อจำกัด/.test(r.stderr),
    'ต้องบอกผลที่ตามมา (ฝั่งท่ออาจถอดข้อจำกัดเพราะคิดว่าไม่มีใครใช้) ไม่ใช่แค่ว่าไม่ตรง')
})

test('ไม่มีทะเบียนให้อ่าน ⇒ **ข้ามอย่างมีเสียง** (rc=0 แต่ต้องบอกว่ายังไม่ได้ตรวจ)', () => {
  const r = spawnSync(process.execPath, [ด่าน], {
    encoding: 'utf8',
    env: { ...process.env, OPEN_ENDED_REGISTRY: join(ROOT, 'ไม่มีไฟล์นี้.mjs') },
  })
  assert.equal(r.status, 0)
  assert.ok(/ยังไม่ได้ตรวจ/.test(r.stdout),
    'เงียบแล้วผ่าน = แยก "ตรวจแล้วไม่เจอ" กับ "ไม่ได้ตรวจ" ไม่ออก')
})
