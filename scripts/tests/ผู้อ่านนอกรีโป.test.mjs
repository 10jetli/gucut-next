/* เทสของ `scripts/lib/ของนอกรีโป.mjs` + ด่าน `scripts/check-ผู้อ่านนอกรีโป.mjs`
 *
 * 🔑 **ตัวควบคุมลบคือหัวใจของไฟล์นี้ — ฝั่งท่อเป็นคนขอ (14 ต.ค. 2569)**
 *    เกณฑ์หยาบ ("เอ่ยชื่ออีกรีโป + มี readFileSync ที่ไหนก็ได้") ให้บวกลวง:
 *    ฝั่งท่อวัดได้ 6 ตัว ของจริง 1 ตัว · ฝั่งผมวัดได้ 6 ตัว ของจริง 5 ตัว
 *    ⇒ ด่านที่ใช้เกณฑ์หยาบจะ **บังคับให้ไฟล์ที่ไม่ได้อ่านดิสก์ import ของที่ไม่ได้ใช้**
 *    ⇒ ⇒ เทสนี้จึงมีทั้งสองทิศ: ปลูกของจริงต้องฟ้อง · ปลูกคอมเมนต์ต้องเงียบ
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { สภาพไฟล์นอกรีโป, บอกสภาพไฟล์นอกรีโป, นาทีที่ถือว่าเพิ่งแก้ } from '../lib/ของนอกรีโป.mjs'

const ด่าน = fileURLToPath(new URL('../check-ผู้อ่านนอกรีโป.mjs', import.meta.url))

/** 🔴 ที่ทดลองใหม่ทุกครั้ง — ที่ทดลองที่ใช้ซ้ำคือที่ทดลองที่มีของค้าง */
function ที่ทดลอง(ไฟล์) {
  const d = mkdtempSync(join(tmpdir(), 'ผู้อ่านนอกรีโป-'))
  mkdirSync(join(d, 'scripts', 'lib'), { recursive: true })
  for (const [ที่, เนื้อ] of Object.entries(ไฟล์)) {
    const p = join(d, ที่)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, เนื้อ)
  }
  return d
}
function รันด่าน(ราก) {
  try {
    const out = execFileSync('node', [ด่าน], {
      encoding: 'utf8', env: { ...process.env, CROSS_REPO_SCAN_ROOT: ราก },
    })
    return { rc: 0, out }
  } catch (e) { return { rc: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}

test('สภาพไฟล์นอกรีโป: สามสถานะ — อ่านได้ / ไม่มีไฟล์ / ไม่เดาเป็น 0', () => {
  const d = ที่ทดลอง({ 'ของจริง.mjs': 'x' })
  const มี = สภาพไฟล์นอกรีโป(join(d, 'ของจริง.mjs'))
  assert.equal(มี.มี, true)
  assert.equal(typeof มี.นาที, 'number')

  const ไม่มี = สภาพไฟล์นอกรีโป(join(d, 'ไม่มีไฟล์นี้.mjs'))
  assert.equal(ไม่มี.มี, false, 'ไฟล์ที่ไม่มี ต้องตอบ มี:false')
  assert.equal(ไม่มี.นาที, null,
    '🔴 **"อ่านไม่ได้" ห้ามกลายเป็น 0 นาที** — ถ้าตกเป็น 0 มันจะเข้าเกณฑ์ "เพิ่งแก้" ทุกครั้ง'
    + ' ⇒ คำเตือนจะร้องตลอดเวลา ⇒ คนจะเลิกอ่านคำเตือนนั้น')
  assert.equal(ไม่มี.เพิ่งแก้, null, '"ไม่รู้" ต้องไม่ใช่ false และไม่ใช่ true')
  assert.match(บอกสภาพไฟล์นอกรีโป(join(d, 'ไม่มีไฟล์นี้.mjs')), /ไม่มีไฟล์นี้ในเครื่อง/)
  rmSync(d, { recursive: true, force: true })
})

test('เกณฑ์ ≤30 นาที ทำงานสองทิศ — ของเก่าต้องไม่เตือน', () => {
  const d = ที่ทดลอง({ 'เก่า.mjs': 'x', 'สด.mjs': 'x' })
  const เก่า = join(d, 'เก่า.mjs')
  const นานมาแล้ว = Date.now() / 1000 - (นาทีที่ถือว่าเพิ่งแก้ + 10) * 60
  utimesSync(เก่า, นานมาแล้ว, นานมาแล้ว)
  assert.equal(สภาพไฟล์นอกรีโป(เก่า).เพิ่งแก้, false,
    `ของที่แก้เกิน ${นาทีที่ถือว่าเพิ่งแก้} นาที ต้องไม่เตือน — ไม่งั้นคำเตือนไม่มีความหมาย`)
  assert.equal(สภาพไฟล์นอกรีโป(join(d, 'สด.mjs')).เพิ่งแก้, true, 'ไฟล์ที่เพิ่งเขียน ต้องเตือน')
  rmSync(d, { recursive: true, force: true })
})

test('ด่าน: ผู้อ่านข้ามรีโปที่ไม่รายงานที่มา ⇒ ตก (ทิศ ①)', () => {
  const d = ที่ทดลอง({
    'scripts/ด่านปลอม.mjs': [
      "import { readFileSync } from 'node:fs'",
      "const PIPE = join(ROOT, '..', 'gucut-web')",
      "readFileSync(join(PIPE, 'netlify', 'functions', 'core.mjs'), 'utf8')",
    ].join('\n'),
  })
  const r = รันด่าน(d)
  assert.equal(r.rc, 1, 'ไฟล์ที่ประกอบพาธไปอีกรีโปแล้วอ่าน ต้องถูกฟ้อง')
  assert.match(r.out, /ไม่รายงานว่าของที่มันอ่านถูกแก้เมื่อไหร่/)
  assert.match(r.out, /ด่านปลอม\.mjs/, 'ต้องบอกชื่อไฟล์ที่ต้องแก้')
  assert.match(r.out, /พาธข้ามรีโป:/, 'ต้องโชว์บรรทัดที่เป็นเหตุ ไม่ใช่แค่ชื่อไฟล์')
  rmSync(d, { recursive: true, force: true })
})

test('🔴 ตัวควบคุมลบ ①: เอ่ยชื่ออีกรีโปใน**คอมเมนต์**เท่านั้น ⇒ ด่านต้องเงียบ', () => {
  const d = ที่ทดลอง({
    'scripts/คอมเมนต์ล้วน.mjs': [
      "import { readFileSync } from 'node:fs'",
      '/* ฝั่งท่อแก้แล้ว (gucut-web 5bce111) ⇒ จอต้องอ่านช่องใหม่',
      " * และพาธของเขาคือ ../gucut-web/netlify/functions/core.mjs */",
      "// ดู gucut-web/scripts/gen-shop-data.mjs",
      "readFileSync('./ของในรีโปเราเอง.json', 'utf8')",
    ].join('\n'),
  })
  const r = รันด่าน(d)
  assert.equal(r.rc, 0,
    '🔴 **ฝั่งท่อขอข้อนี้เอง**: ไฟล์ที่เอ่ยชื่ออีกรีโปในคอมเมนต์ ไม่ได้อ่านดิสก์'
    + ' ⇒ ถ้าด่านฟ้อง มันจะบังคับให้ import ของที่ไม่ได้ใช้'
    + ` (ของเขาเข้าข่ายนี้ 5 ไฟล์ · ของผม 54 ไฟล์) · ผลที่ได้: ${r.out.slice(0, 300)}`)
  assert.match(r.out, /เหลือแค่ในคอมเมนต์/, 'ต้องพิมพ์จำนวนที่หักออก ไม่ใช่หักเงียบ')
  rmSync(d, { recursive: true, force: true })
})

test('🔴 ตัวควบคุมลบ ②: ชื่ออีกรีโปที่เป็น**ข้อมูลเทส** ไม่ใช่พาธ ⇒ ด่านต้องเงียบ', () => {
  /* ของจริงที่ด่านรุ่นแรกฟ้องผิด: `scripts/tests/prepush-เวลา.test.mjs`
     บรรทัดนั้นเป็น log ปลอมที่เอาไว้ทดสอบตัวแยกชื่อรีโป ไม่ใช่พาธ */
  const d = ที่ทดลอง({
    'scripts/tests/เวลา.test.mjs': [
      "import { readFileSync } from 'node:fs'",
      "const แถว = ['2026-09-27  gucut-web   ใช้ 240 วินาที', '2026-09-28  gucut-web-สำรอง  ใช้ 9600']",
      "readFileSync('./log.txt', 'utf8')",
    ].join('\n'),
  })
  const r = รันด่าน(d)
  assert.equal(r.rc, 0,
    'ชื่อรีโปที่อยู่กลางสตริงข้อความ ไม่ใช่พาธ ⇒ ห้ามฟ้อง'
    + ` · รุ่นแรกของด่านนี้ฟ้องผิดตรงนี้จริง · ผลที่ได้: ${r.out.slice(0, 300)}`)
  rmSync(d, { recursive: true, force: true })
})

test('ด่าน: ผู้อ่านข้ามรีโปที่ import แหล่งเดียวแล้ว ⇒ ผ่าน', () => {
  const d = ที่ทดลอง({
    'scripts/ด่านดี.mjs': [
      "import { readFileSync } from 'node:fs'",
      "import { บอกไฟล์นอกรีโป } from './lib/ของนอกรีโป.mjs'",
      "const PIPE = join(ROOT, '..', 'gucut-web')",
      "บอกไฟล์นอกรีโป(join(PIPE, 'x.mjs'))",
    ].join('\n'),
  })
  const r = รันด่าน(d)
  assert.equal(r.rc, 0, `ไฟล์ที่รายงานที่มาแล้วต้องผ่าน · ผลที่ได้: ${r.out.slice(0, 300)}`)
  assert.match(r.out, /ต้องรายงานที่มา: 1 ไฟล์/, 'ต้องนับว่าเข้าข่ายกี่ไฟล์ ไม่ใช่เงียบเมื่อผ่าน')
  rmSync(d, { recursive: true, force: true })
})

test('ด่านจริงในรีโปนี้: ผู้อ่านข้ามรีโปทุกตัวรายงานที่มาแล้ว', () => {
  const r = รันด่าน(fileURLToPath(new URL('../..', import.meta.url)))
  assert.equal(r.rc, 0, `ด่านต้องเขียวกับรีโปจริง · ผลที่ได้: ${r.out.slice(0, 600)}`)
  const m = /ต้องรายงานที่มา: (\d+) ไฟล์/.exec(r.out)
  assert.ok(m, 'ด่านต้องพิมพ์จำนวนไฟล์ที่เข้าข่ายทุกรอบ')
  assert.ok(Number(m[1]) >= 5,
    '🔴 **เลขนี้ห้ามตกลงไปเป็น 0 เงียบ ๆ** — ถ้าตัวจับพัง ด่านจะเขียวเพราะไม่เจอใคร'
    + ` ไม่ใช่เพราะทุกคนทำถูก (วัดด้วยการแพตช์ fs ได้ 5 ตัว) · ได้ ${m[1]}`)
})
