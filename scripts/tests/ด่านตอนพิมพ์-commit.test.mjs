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
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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
/* 🔴 **ของจริง 14 ต.ค. 2569 — รอบที่สอง**: ผมเคยแก้เรื่องนี้แล้ว แต่แก้ **เฉพาะจุดที่มองอยู่**
   ⇒ จุดเรียกอื่นยังไม่ได้ชี้ `BYPASS_LOG` ⇒ เทสเขียนลง **ตารางร่องรอยจริง** ต่ออีก 4 แถว
     (21:36:27 · 21:51:31 และอีกสองแถวก่อนหน้า — ทุกแถวตรงกับ **ช่วงที่ด่าน push รัน npm test**)
   ⇒ ⇒ ตาราง 4/4 แถวกลายเป็นของเทส ⇒ **อ่านไม่ได้ว่าใครข้ามด่านจริง**
   🔑 แก้ที่ **กลไก ไม่ใช่ที่จุด**: ให้ตัวรันฉีดไฟล์ชั่วคราวให้เองทุกครั้ง
      จุดเรียกที่อยากได้ไฟล์ของตัวเองค่อยส่ง `BYPASS_LOG` ทับ — **ลืมไม่ได้อีก เพราะค่าตั้งต้นปลอดภัย** */
const รัน = (f, env = {}) => {
  const ล็อกชั่วคราว = join(mkdtempSync(join(tmpdir(), 'ร่องรอยเทส-')), 'bypass.md')
  writeFileSync(ล็อกชั่วคราว, '| เวลา | ช่อง | HEAD | เหตุ |\n|---|---|---|---|\n')
  return spawnSync('bash', [hook], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, GUCUT_PREPUSH_FLAG: f, BYPASS_LOG: ล็อกชั่วคราว, ...env },
  })
}
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
    /* 🔴 ต้องชี้ `BYPASS_LOG` ไปที่ไฟล์ชั่วคราว — ไม่งั้นเทสนี้เขียนลง **ตารางจริง**
       (เกิดขึ้นแล้ว 14 ต.ค. 2569: แถว 19:05:37 ในตารางมาจากเทสนี้ ไม่ใช่จากคนข้ามด่าน)
       ⇒ ⇒ ร่องรอยที่ปนของเทส ทำให้ตารางตอบ "ใครข้ามด่านจริง" ไม่ได้อีก */
    const ล็อกปลอม = join(tmpdir(), `bypass-${process.pid}-${Date.now()}.md`)
    writeFileSync(ล็อกปลอม, '| x | y | z | w |\n')
    const r = รัน(f, { ALLOW_COMMIT_DURING_PUSH: '1', BYPASS_LOG: ล็อกปลอม })
    assert.equal(r.status, 0, 'ทางออกที่เขียนไว้แต่ใช้ไม่ได้ = ทางที่ไม่เคยถูกเดิน')
  } finally { ลบ() }
})

/* 🔑 **เทสของกลไก ไม่ใช่ของจุด** — ข้อนี้ต้องแดงถ้ามีใครเพิ่มจุดเรียกใหม่แล้วลืมฉีดไฟล์ชั่วคราว
   (ก่อนแก้ 14 ต.ค. 2569 ข้อนี้แดง: ตารางจริงถูกเติม 4 แถวจากเทสนี้เอง)
   ⚠️ ต้องเดินทางที่ **เคยรั่วจริง** คือทางธงค้าง — ทางที่ไม่เคยถูกเดินไม่ได้พิสูจน์อะไร */
test('🔴 เทสนี้ต้องไม่เขียนลง **ตารางร่องรอยจริง** ไม่ว่าทางไหน', () => {
  const ตารางจริง = join(ROOT, 'scripts', 'lib', 'บันทึกการข้ามด่าน.md')
  const ก่อน = readFileSync(ตารางจริง, 'utf8')
  const เก่าเกินสองชั่วโมง = String(Math.floor(Date.now() / 1000) - 10000)
  const { f, ลบ } = เขียนธง([ที่นี่, 'abcdef1234567890', เก่าเกินสองชั่วโมง])
  try {
    const r = รัน(f)
    assert.equal(r.status, 0, 'ทางธงค้างต้องผ่าน (ไม่งั้นเทสนี้ไม่ได้เดินทางที่เคยรั่ว)')
    assert.ok(/ธงค้าง/.test(r.stdout), 'ต้องเดินกิ่งธงค้างจริง ๆ')
  } finally { ลบ() }
  assert.equal(readFileSync(ตารางจริง, 'utf8'), ก่อน,
    'เทสเขียนลงตารางจริง ⇒ ตารางตอบไม่ได้อีกว่า **ใครข้ามด่านจริง** (ของที่พลาดมาแล้วสองรอบ)')
})
