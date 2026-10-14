/* เทสของ `scripts/check-ด่านอ้างใบ.mjs` — ด่านที่ถามว่า "ด่านตัวนี้บังคับบทเรียนใบไหน"
 *
 * 🔑 **ทุกข้อในไฟล์นี้มีคู่ตรงข้าม** ตามกติกาในไฟล์เคสร่วมของทีม:
 *    *ห้ามเพิ่มเคส "ผ่าน" โดยไม่มีเคส "ต้องตก" คู่กัน — ชุดที่ผ่านหมดพิสูจน์แค่ว่าด่านไม่เคยปฏิเสธอะไร*
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ด่าน = fileURLToPath(new URL('../check-ด่านอ้างใบ.mjs', import.meta.url))

/** ที่ทดลองใหม่ทุกครั้ง ([[ที่ทดลองที่ใช้ซ้ำคือที่ทดลองที่มีของค้าง]]) */
function ที่ทดลอง({ ด่านในสาย = {}, ใบในคลัง = [], ฐาน = { 'ไม่มีช่องเลย': 0 } }) {
  const d = mkdtempSync(join(tmpdir(), 'ด่านอ้างใบ-'))
  mkdirSync(join(d, 'scripts', 'lib'), { recursive: true })
  mkdirSync(join(d, 'คลัง'), { recursive: true })
  const สาย = Object.keys(ด่านในสาย).map((f) => `node ${f}`).join(' ; ')
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { 'ตรวจ': สาย } }))
  for (const [f, เนื้อ] of Object.entries(ด่านในสาย)) {
    mkdirSync(join(d, f, '..'), { recursive: true })
    writeFileSync(join(d, f), เนื้อ)
  }
  for (const n of ใบในคลัง) writeFileSync(join(d, 'คลัง', `${n}.md`), '# ใบทดสอบ')
  writeFileSync(join(d, 'ฐาน.json'), JSON.stringify(ฐาน))
  return d
}
const รัน = (d) => {
  const r = spawnSync('node', [ด่าน], {
    encoding: 'utf8',
    env: { ...process.env, GATE_CARDS_ROOT: d, GATE_CARDS_BASE: join(d, 'ฐาน.json'), TEAM_LESSONS: join(d, 'คลัง') },
  })
  return { rc: r.status, out: (r.stdout || '') + (r.stderr || '') }
}
const ล้าง = (d) => rmSync(d, { recursive: true, force: true })

test('ด่านที่มีช่อง `บังคับใบ:` ชี้ใบที่มีจริง ⇒ ผ่าน และนับถูก', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ก.mjs': '/* บังคับใบ: ใบที่มีจริง */\n' },
    ใบในคลัง: ['ใบที่มีจริง'],
  })
  const r = รัน(d)
  assert.equal(r.rc, 0, `ควรผ่าน · ได้: ${r.out}`)
  assert.match(r.out, /อ้างใบ 1/)
  assert.match(r.out, /ใบที่มีด่านอ้างถึง: \*\*1\/1\*\*/)
  ล้าง(d)
})

test('🔴 อ้างใบที่**ไม่มีไฟล์จริง** ⇒ ตก (ข้อที่ฝั่งท่อเพิ่ม)', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ข.mjs': '/* บังคับใบ: ใบที่ไม่มีอยู่จริง */\n' },
    ใบในคลัง: ['ใบอื่น'],
  })
  const r = รัน(d)
  assert.equal(r.rc, 1,
    '🔴 คลาสคู่มือที่ชี้ไปไฟล์ที่ไม่มี — ลิงก์ตายอ่านเหมือนลิงก์เป็น'
    + ` ⇒ ต้องตก · ได้: ${r.out}`)
  assert.match(r.out, /อ้างใบ "ใบที่ไม่มีอยู่จริง" แต่ไม่มีไฟล์นี้ในคลังทีม/)
  ล้าง(d)
})

test('`ไม่อ้างใบ:` ที่มีเหตุยาวพอ ⇒ ผ่าน · เหตุสั้น ⇒ ตก (สองทิศ)', () => {
  const ยาว = ที่ทดลอง({ ด่านในสาย: { 'scripts/check-ค.mjs': '/* ไม่อ้างใบ: ด่านนี้บังคับรูปแบบที่เครื่องกำหนด ไม่ใช่กติกาที่ทีมตั้ง */\n' } })
  const ก = รัน(ยาว)
  assert.equal(ก.rc, 0, `เหตุยาวพอต้องผ่าน · ได้: ${ก.out}`)
  assert.match(ก.out, /ไม่อ้างใบ 1/)
  ล้าง(ยาว)

  const สั้น = ที่ทดลอง({ ด่านในสาย: { 'scripts/check-ง.mjs': '/* ไม่อ้างใบ: ไม่เกี่ยว */\n' } })
  const ข = รัน(สั้น)
  assert.equal(ข.rc, 1,
    'ช่องที่รับเหตุสั้นได้ คือช่องที่ทุกคนจะเขียนว่า "ไม่เกี่ยว"'
    + ` ⇒ ต้องตก · ได้: ${ข.out}`)
  assert.match(ข.out, /เหตุสั้นกว่า 20 ตัวอักษร/)
  ล้าง(สั้น)
})

test('🔴 เหตุผลที่**มีช่องว่าง**ต้องผ่าน (บั๊กที่เจ็บมาแล้ววันนี้)', () => {
  const d = ที่ทดลอง({ ด่านในสาย: { 'scripts/check-จ.mjs': '/* ไม่อ้างใบ: ตรวจ รูปแบบ ของ เครื่อง ไม่ใช่ กติกา ที่ ทีม ตั้ง */\n' } })
  const r = รัน(d)
  assert.equal(r.rc, 0,
    '🔴 รูป `\\S{20,}` ของผมใน check-ชื่อตัวแปรเชลล์ ตีกลับเหตุผลที่มีช่องว่างทุกอัน'
    + ' ⇒ ช่องใหม่นี้ต้องไม่เหยียบคลาสเดิมซ้ำ'
    + ` · ได้: ${r.out}`)
  ล้าง(d)
})

test('🔴 หนี้โตเกินฐาน ⇒ ตก (ด่านใหม่ที่ไม่มีช่อง)', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ฉ.mjs': '// ไม่มีช่องอะไรเลย\n' },
    ฐาน: { 'ไม่มีช่องเลย': 0 },
  })
  const r = รัน(d)
  assert.equal(r.rc, 1, `หนี้โตต้องตก ไม่งั้นด่านนี้เป็นรายงาน ไม่ใช่ด่าน · ได้: ${r.out}`)
  assert.match(r.out, /หนี้โต: ไม่มีช่องเลย 1 > ฐาน 0/)
  ล้าง(d)
})

test('🔴 ฐานค้างสูงกว่าของจริง ⇒ ตก (กันการเลื่อนเพดานให้ผ่าน)', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ช.mjs': '/* บังคับใบ: ใบจริง */\n' },
    ใบในคลัง: ['ใบจริง'],
    ฐาน: { 'ไม่มีช่องเลย': 5 },
  })
  const r = รัน(d)
  assert.equal(r.rc, 1,
    'ฐานที่ค้างสูงเป็น **ที่ซ่อน** ให้ด่านใหม่ที่ไม่มีช่องแอบเข้ามาได้ 5 ตัวโดยไม่มีอะไรฟ้อง'
    + ` · ได้: ${r.out}`)
  assert.match(r.out, /ฐานค้างสูงกว่าของจริง/)
  ล้าง(d)
})

test('🔶 อ่านคลังทีมไม่ได้ ⇒ บอกว่าตรวจชื่อใบไม่ได้ ไม่ใช่ "ชื่อถูกทุกใบ"', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ซ.mjs': '/* บังคับใบ: ใบอะไรก็ได้ */\n' },
  })
  const r = spawnSync('node', [ด่าน], {
    encoding: 'utf8',
    env: { ...process.env, GATE_CARDS_ROOT: d, GATE_CARDS_BASE: join(d, 'ฐาน.json'), TEAM_LESSONS: join(d, 'คลังที่ไม่มี') },
  })
  const out = (r.stdout || '') + (r.stderr || '')
  assert.match(out, /อ่านคลังทีมไม่ได้/, `ต้องประกาศว่าตรวจไม่ได้ · ได้: ${out}`)
  assert.match(out, /ไม่ใช่ "ชื่อถูกทุกใบ"/, 'ความเงียบตอนอ่านไม่ได้ = ข่าวดีปลอม')
  ล้าง(d)
})

test('เลขที่ต้องโชว์ทุกรอบ: เทสที่กันออก + ความไม่สมมาตรของคลังทีม', () => {
  const d = ที่ทดลอง({
    ด่านในสาย: { 'scripts/check-ฌ.mjs': '/* บังคับใบ: ใบจริง */\n', 'scripts/tests/ก.test.mjs': 'x' },
    ใบในคลัง: ['ใบจริง'],
  })
  const r = รัน(d)
  assert.match(r.out, /เทสที่ถูกกันออกรอบนี้ 1 ตัว/,
    'ฝั่งท่อสั่งให้พิมพ์เลขนี้ทุกรอบ — หนี้ที่ไม่ถูกพิมพ์คือหนี้ที่หายไปจากกระดาน')
  assert.match(r.out, /ย้าย\*\*ทีละตัว\*\* ห้ามย้ายทั้งกอง/,
    'ย้ายทั้งกอง = เปลี่ยนงานวัดเป็นงานกรอก')
  assert.match(r.out, /เทียบกับฝั่งท่อตรง ๆ ไม่ได้/,
    'ความไม่สมมาตรที่ไม่ถูกประกาศ จะถูกอ่านเป็นความต่างของคน')
  ล้าง(d)
})
