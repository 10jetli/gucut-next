/* ด่าน: `scripts/hooks/pre-commit` ต้อง **ยืนขวางตอนพิมพ์** เมื่อด่าน push กำลังวิ่ง
 *
 * 🔴 คลาสที่ผมเหยียบ **สองครั้งในวันเดียว** (14 ต.ค. 2569) ทั้งที่ใบบทเรียนห้ามไว้แล้ว:
 *    commit ใหม่ระหว่างด่าน push วิ่ง ⇒ ผลของด่านเป็น **ส่วนผสม** ⇒ ผิดสองทิศ
 *      ① เขียวลวง: ก้อนใหม่ลอดไปถึงปลายทางทั้งที่ด่านตรวจ sha เก่า
 *      ② แดงลวง: ของที่ยังไม่ commit ทำให้ build ตก ⇒ ด่านโทษของที่ push ไป
 * 🔑 ฝั่งท่อสรุปข้อที่ถูก: **บทเรียนที่ไม่มีด่านอยู่ตอนพิมพ์ จะถูกเหยียบก่อนเสมอ**
 *    ⇒ ไฟล์นี้คือการย้ายใบนั้นจาก "จำไว้" มาเป็น "ยืนขวางตอนพิมพ์"
 * ⚠️ ทุกกิ่งต้องถูกเดิน — **ด่านที่ไม่เคยตก = ข้อความตอนตกที่ยังไม่มีใครอ่าน**
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const hook = join(ROOT, 'scripts', 'hooks', 'pre-commit')
const ที่นี่ = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, encoding: 'utf8' }).trim()

const เขียนธง = (บรรทัด) => {
  const d = mkdtempSync(join(tmpdir(), 'ธงด่าน-'))
  const f = join(d, 'flag')
  writeFileSync(f, บรรทัด.join('\n') + '\n')
  return { f, ลบ: () => rmSync(d, { recursive: true, force: true }) }
}
const รัน = (f, env = {}) => spawnSync('bash', [hook], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, GUCUT_PREPUSH_FLAG: f, ...env },
})
const เมื่อกี้ = () => String(Math.floor(Date.now() / 1000) - 30)

test('ไม่มีธง ⇒ ผ่าน (ด่านต้องไม่ขวางงานปกติ)', () => {
  const r = รัน(join(tmpdir(), 'ไม่มีไฟล์ธงนี้'))
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

test('🛑 ธงของรีโปนี้และยังสด ⇒ **บล็อก** พร้อมบอกทั้งสองทิศของความผิด', () => {
  const { f, ลบ } = เขียนธง([ที่นี่, 'abcdef1234567890', เมื่อกี้()])
  try {
    const r = รัน(f)
    assert.equal(r.status, 1, 'ต้องบล็อก — ไม่งั้นใบบทเรียนนี้ก็ยังเป็นแค่ความจำ')
    assert.ok(/เขียวลวง/.test(r.stdout) && /แดงลวง/.test(r.stdout),
      'ต้องบอกทั้งสองทิศ ไม่ใช่บอกแค่ว่า "ห้าม" — คนที่ไม่รู้เหตุจะหาทางข้าม')
    assert.ok(/commit บนกิ่งอื่น/.test(r.stdout), 'ต้องเสนอทางที่ทำงานต่อได้ ไม่ใช่สั่งให้หยุด')
  } finally { ลบ() }
})

test('ธงของ **รีโปอื่น** ⇒ ผ่าน (เครื่องนี้มีสองรีโป)', () => {
  const { f, ลบ } = เขียนธง(['/home/jetli/รีโปอื่น', 'abc', เมื่อกี้()])
  try {
    assert.equal(รัน(f).status, 0, 'ธงของรีโปอื่นไม่เกี่ยวกับ commit นี้')
  } finally { ลบ() }
})

test('ธงเก่ากว่า 2 ชม. ⇒ **เตือนแต่ไม่บล็อก** (ด่านที่บล็อกด้วยของค้างคือด่านที่คนจะถอด)', () => {
  const เก่า = String(Math.floor(Date.now() / 1000) - 3 * 3600)
  const { f, ลบ } = เขียนธง([ที่นี่, 'abc', เก่า])
  try {
    const r = รัน(f)
    assert.equal(r.status, 0)
    assert.ok(/ธงค้าง/.test(r.stdout), 'ต้องบอกว่าเป็นธงค้าง และบอกวิธีลบ')
  } finally { ลบ() }
})

test('ทางออกที่ประกาศไว้ต้องใช้ได้จริง (ALLOW_COMMIT_DURING_PUSH=1)', () => {
  const { f, ลบ } = เขียนธง([ที่นี่, 'abc', เมื่อกี้()])
  try {
    const r = รัน(f, { ALLOW_COMMIT_DURING_PUSH: '1' })
    assert.equal(r.status, 0, 'ทางออกที่เขียนไว้แต่ใช้ไม่ได้ = ทางที่ไม่เคยถูกเดิน')
  } finally { ลบ() }
})
