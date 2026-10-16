/* เทสที่รัน **ไฟล์เคสร่วมสองฝั่ง** กับด่านพื้นลูกโซ่ของฝั่งนี้
 *
 * 🔑 แชร์ **เคส** ไม่ใช่ **โค้ด** — ฝั่งใดเพี้ยน เคสจับฝั่งนั้นฝั่งเดียว
 *    (ตรรกะร่วมตัวเดียว ⇒ วันที่มันผิด ผิดพร้อมกันสองฝั่ง ⇒ ไม่มีใครเห็น)
 * ⚠️ ไฟล์เคสอยู่นอกรีโป ⇒ รายงาน mtime ทุกรอบ · อ่านไม่ได้ ⇒ **ตัดสินไม่ได้ ไม่ใช่ผ่าน**
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ด่าน = fileURLToPath(new URL('../check-chain-floor.mjs', import.meta.url))
/* 🔴 **ห้ามฝังพาธของเครื่องใดเครื่องหนึ่ง** — ของเดิมเขียน `/home/jetli/...` ตายตัว
   ⇒ เทสนี้ **ตกเสมอบนเครื่องอื่น** (เครื่อง Mac ของทีม) ⇒ ด่านก่อน push แดงค้าง
   ⇒ คนที่ทำงานเครื่องนั้น push งานของตัวเองไม่ได้เลย ทั้งที่งานไม่เกี่ยวกับเทสนี้
   (เจอจริง 17 ต.ค. 2569 · คลาสเดียวกับกฎ "ห้ามฝัง IP วงแลน")
   ⇒ ใช้บ้านของผู้ใช้เป็นฐาน · ยังเคารพ CHAIN_FLOOR_CASES เหมือนเดิมถ้าตั้งไว้ */
const ไฟล์เคส = process.env.CHAIN_FLOOR_CASES
  || join(homedir(), 'claude-shared', 'lib', 'เคส-พื้นจำนวนด่านในสาย.json')

/** จัดฉาก package.json ให้มีชื่อด่าน N ตัว (ชื่อซ้ำได้ตามเคส) */
function ยิง({ จำนวนด่าน, พื้น, เหตุที่ลด, ชื่อซ้ำ, ไฟล์พื้นหาย }) {
  const d = mkdtempSync(join(tmpdir(), 'พื้นลูกโซ่-'))
  const ชื่อ = Array.from({ length: จำนวนด่าน }, (_, i) => `scripts/check-ก${i}.mjs`)
  /* ชื่อซ้ำ: ให้ตัวแรกโผล่สองครั้ง (เช่น `--self-test` แล้วรันจริง) ⇒ ต้องนับเป็นตัวเดียว */
  const สาย = (ชื่อซ้ำ ? [ชื่อ[0], ...ชื่อ] : ชื่อ).map((x) => `node ${x}`).join(' ; ')
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { 'ตรวจ': สาย } }))
  const ไฟล์พื้น = join(d, 'พื้น.json')
  writeFileSync(ไฟล์พื้น, JSON.stringify({ 'พื้น': พื้น, ...(เหตุที่ลด ? { 'เหตุที่ลด': เหตุที่ลด } : {}) }))
  if (ไฟล์พื้นหาย) unlinkSync(ไฟล์พื้น)
  const r = spawnSync('node', [ด่าน], {
    encoding: 'utf8', env: { ...process.env, CHAIN_FLOOR_ROOT: d, CHAIN_FLOOR_FILE: ไฟล์พื้น },
  })
  const out = (r.stdout || '') + (r.stderr || '')
  const สถานะ = /คุมไม่ได้รอบนี้/.test(out) ? 'คุมไม่ได้' : r.status === 0 ? 'ผ่าน' : 'ตก'
  const พื้นหลัง = (() => { try { return JSON.parse(readFileSync(ไฟล์พื้น, 'utf8'))['พื้น'] } catch { return null } })()
  rmSync(d, { recursive: true, force: true })
  return { สถานะ, out, พื้นหลัง }
}

test('ด่านพื้นลูกโซ่ผ่าน **ทุกเคสในไฟล์ร่วม**', () => {
  if (!existsSync(ไฟล์เคส)) {
    assert.fail(`🔴 ไม่มีไฟล์เคสร่วม (${ไฟล์เคส}) ⇒ **ตัดสินไม่ได้ ไม่ใช่ผ่าน**`)
  }
  const st = statSync(ไฟล์เคส)
  console.log(`   📂 ไฟล์เคสร่วม (นอกรีโป): แก้ล่าสุด ${new Date(st.mtimeMs).toLocaleString('th-TH')} · ${st.size} ไบต์`)
  const เคส = JSON.parse(readFileSync(ไฟล์เคส, 'utf8'))['เคส']
  const ตก = []
  for (const c of เคส) {
    const r = ยิง({
      จำนวนด่าน: c['จำนวนด่าน'], พื้น: c['พื้น'], เหตุที่ลด: c['เหตุที่ลด'],
      ชื่อซ้ำ: c['ชื่อซ้ำ'], ไฟล์พื้นหาย: c['ไฟล์พื้นหาย'],
    })
    if (r.สถานะ !== c['คาดหวัง']) {
      ตก.push(`${c['ชื่อ']} — ต้อง "${c['คาดหวัง']}" ได้ "${r.สถานะ}"`)
      continue
    }
    /* ช่อง `พื้นหลังต้องเป็น` = ตรวจ **ผลข้างเคียงที่ด่านเขียนลงไฟล์** ไม่ใช่แค่คำตัดสิน */
    if (c['พื้นหลังต้องเป็น'] !== undefined && r.พื้นหลัง !== c['พื้นหลังต้องเป็น']) {
      ตก.push(`${c['ชื่อ']} — พื้นหลังด่านทำงานต้องเป็น ${c['พื้นหลังต้องเป็น']} แต่ได้ ${r.พื้นหลัง}`)
    }
  }
  console.log(`   ผ่านเคสร่วม **${เคส.length - ตก.length}/${เคส.length}**`)
  assert.deepEqual(ตก, [],
    '🔴 รูปของฝั่งนี้ไม่ตรงพฤติกรรมที่ตกลงกัน ⇒ **แก้ด่านให้ผ่านเคส ห้ามแก้ไฟล์เคส**')
})

test('🔴 ต่ำกว่า 5 ⇒ ข้อความต้องบอกว่า **ตะแกรงพัง** ไม่ใช่ **สายหด**', () => {
  const r = ยิง({ จำนวนด่าน: 3, พื้น: 25, เหตุที่ลด: null })
  assert.equal(r.สถานะ, 'ตก')
  assert.match(r.out, /ตะแกรงพัง ไม่ใช่สายหด/,
    '🔑 ทางแก้คนละอย่าง: สายหด ⇒ หาด่านที่ถูกถอด · ตะแกรงพัง ⇒ หาว่าทำไมอ่านสายไม่ออก'
    + ' ⇒ ข้อความผิดจะส่งคนไปไล่หาด่านที่ไม่ได้หายไปไหน')
  assert.doesNotMatch(r.out, /ลูกโซ่หด \d+ ตัว/, 'ห้ามพิมพ์ข้อความ "สายหด" ในกรณีนี้')
})

test('ตะแกรงของฝั่งนี้ต้องนับ **ชื่อด่านที่มีอักษรไทย** ได้', () => {
  /* 🔴 ฝั่งท่อเจอบั๊กนี้ที่ฝั่งเขา: คลาสอักขระ `[\w.-]` ของ JS **ไม่ครอบอักษรไทย**
     ⇒ ด่านชื่อไทยถูกมองไม่เห็น ⇒ สายหดได้โดยด่านไม่รู้ตัว
     ของผมใช้คลาสปฏิเสธ `[^\s;&]+` ⇒ รอด **โดยโครงสร้าง ไม่ใช่เพราะเลือกไว้**
     ⇒ เทสนี้ตรึงไว้ ไม่ให้ใครเปลี่ยนเป็นคลาสยอมรับในอนาคต */
  const d = mkdtempSync(join(tmpdir(), 'พื้นลูกโซ่ไทย-'))
  const ชื่อ = ['scripts/check-ชื่อไทย.mjs', 'scripts/ด่านภาษาไทย.mjs',
    'scripts/check-ascii.mjs', 'scripts/check-b.mjs', 'scripts/check-c.mjs', 'scripts/check-d.mjs']
  writeFileSync(join(d, 'package.json'),
    JSON.stringify({ scripts: { 'ตรวจ': ชื่อ.map((x) => `node ${x}`).join(' ; ') } }))
  const fp = join(d, 'พื้น.json'); writeFileSync(fp, JSON.stringify({ 'พื้น': 6 }))
  const r = spawnSync('node', [ด่าน], {
    encoding: 'utf8', env: { ...process.env, CHAIN_FLOOR_ROOT: d, CHAIN_FLOOR_FILE: fp },
  })
  const out = (r.stdout || '') + (r.stderr || '')
  assert.match(out, /ของจริง \*\*6\*\*/,
    `🔴 นับด่านชื่อไทยไม่ครบ ⇒ สายหดได้โดยไม่มีใครรู้ · ได้: ${out.slice(0, 200)}`)
  rmSync(d, { recursive: true, force: true })
})
