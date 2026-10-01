#!/usr/bin/env node
/* พิสูจน์ว่า `--self-test` ของ `สมอตรงฟรีไหม.mjs` **จับความพลาดจริงที่เคยเกิดขึ้นได้**
 * 🚫 ไม่อยู่ใน prebuild — สร้าง git worktree + รันสองรอบ (~15 วินาที)
 *
 * 🔴 ที่มา: commit **b6a9e94** (30 ก.ย. 2569)
 *    ผมจัดลำดับไฟล์ใหม่โดยตัดช่วง "ตั้งแต่คอมเมนต์เกณฑ์ ถึง const เรียง"
 *    ⇒ **บล็อกประกาศ `อ่อน/แข็ง` + ลูปกวาด ที่อยู่ระหว่างนั้นถูกตัดไปด้วย**
 *    ⇒ `node --check` ผ่าน · `--self-test` (รุ่นนั้น) ผ่าน · ด่านในลูกโซ่ไม่กระทบ
 *    ⇒ **ของเสียเข้า commit** และกู้ได้ที่ 9902cd0 เพราะมีประวัติ git
 *    (ดูของจริง: `git diff b6a9e94 9902cd0 -- scripts/สมอตรงฟรีไหม.mjs`)
 *
 * 🔑 สูตรปลูกของไฟล์นี้จึงเป็น **รูปที่เกิดขึ้นจริงในประวัติ ไม่ใช่รูปที่ผมคิดขึ้นเอง**
 *    (กฎบ้าน: สูตรปลูกที่ประดิษฐ์เองพิสูจน์แค่ว่าด่านจับสิ่งที่เราจินตนาการได้)
 *
 * 🟢 **ตัวควบคุมลบอยู่ในไฟล์นี้ด้วย** — รอบ "ไม่ปลูก" ต้องเขียว
 *    ไม่มีข้อนี้ ด่านที่แดงตลอดเวลาก็อ่านว่า "พิสูจน์แล้ว"
 *    📌 และตัวควบคุมลบนี้เคยแดงด้วยเหตุอื่นมาแล้ว (1 ต.ค. 2569):
 *       worktree ไม่มี node_modules ⇒ ด่านในทะเบียนแดงหมด ⇒ กวาดได้ 0 คู่
 *       ⇒ เกณฑ์ "ได้ผล ≥ 1 คู่" จึงถูกเปลี่ยนเป็น "ลูปเดินผ่าน ≥ 1 กลุ่ม"
 *          ซึ่ง **ไม่ขึ้นกับว่าด่านในรีโปเขียวหรือแดง**
 *
 * วิธีใช้: node scripts/พิสูจน์โหมดถูกเดิน.mjs   (exit 0 = พิสูจน์ครบ)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ชื่อสคริปต์ = 'scripts/สมอตรงฟรีไหม.mjs'
const ที่ = mkdtempSync(join(tmpdir(), 'wt-anchor-'))
const WT = join(ที่, 'w')
const git = (...a) => spawnSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' })

const รัน = (ป้าย) => {
  const r = spawnSync(process.execPath, [join(WT, ชื่อสคริปต์), '--self-test'],
    { encoding: 'utf8', cwd: WT, timeout: 600e3 })
  const out = (r.stdout || '') + (r.stderr || '')
  console.log(`\n── ${ป้าย} ⇒ exit ${r.status}`)
  for (const l of out.split('\n').filter((l) => /— เดินจบ|— exit|— \*\*ข้าม|โหมดที่เดินรอบนี้/.test(l))) {
    console.log(l)
  }
  return { exit: r.status, out }
}

let ผ่าน = false
try {
  const r0 = git('worktree', 'add', '--detach', WT, 'HEAD')
  if (r0.status !== 0) { console.error(r0.stderr); process.exit(1) }
  /* ใช้ไฟล์ **รุ่นที่อยู่ในมือตอนนี้** (ไม่ใช่รุ่นใน HEAD) — คำถามคือ "โค้ดวันนี้จับได้ไหม" */
  const ใหม่ = readFileSync(join(ROOT, ชื่อสคริปต์), 'utf8')
  writeFileSync(join(WT, ชื่อสคริปต์), ใหม่)

  console.log('🟢 ① ตัวควบคุมลบ — โค้ดปัจจุบันที่ **ไม่ปลูก** ต้องเขียว')
  const ก่อน = รัน('ไม่ปลูก')

  const เริ่ม = ใหม่.indexOf('const อ่อน = [], แข็ง = []')
  const จบหมาย = "process.stderr.write('\\r')"
  const จบ = ใหม่.indexOf(จบหมาย)
  /* 🔑 **ปลูกไม่ลงต้องตาย ไม่ใช่รายงานว่าผ่าน** — ถ้าหาจุดตัดไม่เจอ ผลรอบนี้ตีความไม่ได้
     (คลาสที่เหยียบ 10 ครั้งในวันเดียว: ปลูกไม่ตรงตัวจับแล้วอ่านผลว่าสำเร็จ) */
  if (เริ่ม < 0 || จบ < 0 || จบ < เริ่ม) {
    console.error('🔴 ปลูกไม่ลง: หาจุดตัดไม่เจอ (โครงไฟล์เปลี่ยน) ⇒ ผลรอบนี้ตีความไม่ได้')
    process.exit(1)
  }
  const ปลูกแล้ว = ใหม่.slice(0, เริ่ม)
    + '/* ปลูก: ลบบล็อกลูปกวาด (รูปเดียวกับ b6a9e94) */\n'
    + ใหม่.slice(จบ + จบหมาย.length)
  if (ปลูกแล้ว.includes('for (const [คำสั่ง, กลุ่ม] of ตามด่าน)')) {
    console.error('🔴 ปลูกไม่ลง: ลูปกวาดยังอยู่ ⇒ ผลรอบนี้ตีความไม่ได้')
    process.exit(1)
  }
  writeFileSync(join(WT, ชื่อสคริปต์), ปลูกแล้ว)
  console.log('\n🔴 ② ปลูกรูปจริงของ b6a9e94 (ลบลูปกวาด) — ต้องแดง **และต้องเอ่ยถึงโหมดที่พัง**')
  const หลัง = รัน('ปลูกแล้ว')

  /* สมอของการพิสูจน์: ข้อความตอนแดงต้องเอ่ยถึง **โหมด** ไม่ใช่แดงเฉย ๆ
     (ไม่งั้นแดงเพราะอะไรก็ได้ แล้วเราอ่านว่าตาข่ายทำงาน) */
  const เอ่ยถึงโหมด = /❌ (กวาดเต็ม|ทะเบียน)/.test(หลัง.out)
  console.log('\n═══ สรุป ═══')
  console.log(`ไม่ปลูก  exit ${ก่อน.exit} (ต้อง 0)`)
  console.log(`ปลูกแล้ว exit ${หลัง.exit} (ต้องไม่ใช่ 0)`)
  console.log(`ข้อความตอนแดงเอ่ยถึงโหมดที่พัง: ${เอ่ยถึงโหมด ? 'ใช่' : 'ไม่'}`)
  ผ่าน = ก่อน.exit === 0 && หลัง.exit !== 0 && เอ่ยถึงโหมด
  console.log(ผ่าน
    ? '✅ พิสูจน์ครบ: เงียบตอนไม่ปลูก · แดงตอนปลูก · และบอกว่าโหมดไหนพัง'
    : '🔴 ยังพิสูจน์ไม่ครบ')
} finally {
  git('worktree', 'remove', '--force', WT)
  rmSync(ที่, { recursive: true, force: true })
}
process.exit(ผ่าน ? 0 : 1)
