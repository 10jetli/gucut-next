#!/usr/bin/env node
/* พิสูจน์ว่า **สมุดของด่านสมอจดจริงตอนจับได้** (CEO ข้อ ④ · 1 ต.ค. 2569)
 * 🚫 ไม่อยู่ใน prebuild — สร้าง git worktree + ปลูกสูตรจำลอง (~5 วินาที)
 *
 * 🔴 เหตุที่ต้องมีไฟล์นี้: ตัวนับที่ไม่เคยถูกทำให้ขยับ **คือตัวนับที่ยังไม่รู้ว่าขยับได้ไหม**
 *    และคลาสที่อันตรายที่สุดของข้อ ④ คือ **ลำดับบรรทัด**:
 *    ถ้า `จดลงสมุด` ถูกวางไว้หลัง `process.exit(1)` ⇒ **รอบที่จับได้จะไม่เคยถูกจด**
 *    ⇒ สมุดจะมีแต่รอบที่ผ่าน ⇒ อ่านแล้วสรุปว่า "ไม่เคยมีใครพลาด" = ข่าวดีปลอม
 *    ⇒ ⇒ ไฟล์นี้จึงตรวจ **ทั้งสองอย่างพร้อมกัน**: ด่านแดง **และ** สมุดมีใบใหม่
 *
 * 🟢 ตัวควบคุมลบ: รอบก่อนปลูก ด่านต้องเขียว **และสมุดต้องไม่ถูกแตะ**
 *    (ด่านที่จดทุก build ก็จะผ่านข้อ "จดได้" โดยไม่ได้พิสูจน์อะไร)
 *
 * วิธีใช้: node scripts/พิสูจน์สมุดจดได้.mjs   (exit 0 = พิสูจน์ครบ)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ที่ = mkdtempSync(join(tmpdir(), 'wt-logbook-'))
const WT = join(ที่, 'w')
const git = (...a) => spawnSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' })

const ไฟล์ที่ต้องเอาไป = [
  'scripts/check-anchor-new.mjs',
  'scripts/lib/บันทึกสมอ.mjs',
  'scripts/lib/บันทึกสมอ.json',
]
const สมุดใน = (ที่ไหน) => {
  const p = join(ที่ไหน, 'scripts/lib/บันทึกสมอ.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}
const รันด่าน = () => {
  const r = spawnSync(process.execPath, [join(WT, 'scripts/check-anchor-new.mjs')],
    { cwd: WT, encoding: 'utf8', timeout: 300e3 })
  return { exit: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

let ผ่าน = false
try {
  const r0 = git('worktree', 'add', '--detach', WT, 'HEAD')
  if (r0.status !== 0) { console.error(r0.stderr); process.exit(1) }
  for (const f of ไฟล์ที่ต้องเอาไป) {
    if (!existsSync(join(ROOT, f))) { console.error(`🔴 ไม่มีไฟล์ต้นทาง ${f}`); process.exit(1) }
    writeFileSync(join(WT, f), readFileSync(join(ROOT, f), 'utf8'))
  }

  console.log('🟢 ① ตัวควบคุมลบ — ไม่ปลูก ⇒ ด่านเขียว และสมุดต้องไม่ถูกแตะ')
  const รอบก่อน = (สมุดใน(WT)?.รอบ ?? []).length
  const ก่อน = รันด่าน()
  const รอบหลังควบคุม = (สมุดใน(WT)?.รอบ ?? []).length
  console.log(`   exit ${ก่อน.exit} · รอบในสมุด ${รอบก่อน} → ${รอบหลังควบคุม}`)

  /* ② ปลูกสูตรที่ **สมอตรงฟรีแน่นอน**: ใช้ด่านที่ไม่ต้องมี node_modules
        และตั้งสมอเป็นข้อความที่ด่านนั้นพิมพ์ **ตอนผ่าน** ⇒ โผล่ทั้งที่ไม่ได้ปลูก */
  const พาธทะเบียน = join(WT, 'scripts/lib/ทะเบียนด่าน.mjs')
  const เดิม = readFileSync(พาธทะเบียน, 'utf8')
  const สูตรจำลอง = `  {
    /* ปลูกเพื่อพิสูจน์สมุด — สมอ 'ผ่านเกณฑ์' ถูกพิมพ์ตอนด่านผ่าน ⇒ ตรงฟรีแน่นอน */
    ด่าน: 'scripts/check-node-version.mjs',
    ไฟล์: 'lib/format.ts',
    เล่า: 'สูตรจำลองของ พิสูจน์สมุดจดได้.mjs',
    แก้: (s) => s,
    ต้องมีในไฟล์: 'TH_MONTHS',
    ต้องเอ่ยถึง: 'ผ่านเกณฑ์',
  },
`
  const ปิดท้าย = เดิม.lastIndexOf('\n]')
  if (ปิดท้าย < 0) { console.error('🔴 ปลูกไม่ลง: หาท้ายทะเบียนไม่เจอ ⇒ ตีความไม่ได้'); process.exit(1) }
  const ปลูกแล้ว = เดิม.slice(0, ปิดท้าย + 1) + สูตรจำลอง + เดิม.slice(ปิดท้าย + 1)
  writeFileSync(พาธทะเบียน, ปลูกแล้ว)
  /* 🔑 ยืนยันว่าปลูกลงจริงก่อนอ่านผล — ปลูกไม่ลงแล้วอ่านผลว่าสำเร็จคือคลาสที่เหยียบซ้ำบ่อยที่สุด */
  if (!readFileSync(พาธทะเบียน, 'utf8').includes("ต้องเอ่ยถึง: 'ผ่านเกณฑ์'")) {
    console.error('🔴 ปลูกไม่ลง: ไม่พบสูตรจำลองในไฟล์ ⇒ ตีความไม่ได้')
    process.exit(1)
  }

  console.log('\n🔴 ② ปลูกสูตรที่สมอตรงฟรี ⇒ ด่านต้องแดง **และสมุดต้องมีใบใหม่**')
  const หลัง = รันด่าน()
  const สมุด = สมุดใน(WT)
  const รอบหลังปลูก = (สมุด?.รอบ ?? []).length
  const ใบล่าสุด = (สมุด?.รอบ ?? []).at(-1)
  console.log(`   exit ${หลัง.exit} · รอบในสมุด ${รอบหลังควบคุม} → ${รอบหลังปลูก}`)
  if (ใบล่าสุด) {
    console.log(`   ใบล่าสุด: ผ่านตา ${ใบล่าสุด.ผ่านตา} · ตรงฟรี ${ใบล่าสุด.จับได้?.ตรงฟรี}`
      + ` · ไม่มีสมอ ${ใบล่าสุด.จับได้?.ไม่มีสมอ} · commit ${ใบล่าสุด.commit}`)
  }

  console.log('\n═══ สรุป ═══')
  const ข้อ = [
    ['ไม่ปลูก ⇒ ด่านเขียว', ก่อน.exit === 0],
    ['ไม่ปลูก ⇒ สมุดไม่ถูกแตะ', รอบหลังควบคุม === รอบก่อน],
    ['ปลูก ⇒ ด่านแดง', หลัง.exit !== 0],
    ['ปลูก ⇒ สมุดมีใบใหม่ (จดก่อนตาย)', รอบหลังปลูก === รอบหลังควบคุม + 1],
    ['ใบใหม่บันทึกว่าจับได้ ตรงฟรี ≥ 1', (ใบล่าสุด?.จับได้?.ตรงฟรี ?? 0) >= 1],
    ['ตัวหารคือสูตรใหม่ที่ผ่านตา ไม่ใช่จำนวน build', (ใบล่าสุด?.ผ่านตา ?? 0) >= 1],
  ]
  for (const [ชื่อ, ok] of ข้อ) console.log(`${ok ? '✅' : '❌'} ${ชื่อ}`)
  ผ่าน = ข้อ.every(([, ok]) => ok)
  console.log(ผ่าน ? '✅ พิสูจน์ครบ: สมุดจดตอนจับได้ และเงียบตอนไม่มีเหตุการณ์' : '🔴 ยังพิสูจน์ไม่ครบ')
} finally {
  git('worktree', 'remove', '--force', WT)
  rmSync(ที่, { recursive: true, force: true })
}
process.exit(ผ่าน ? 0 : 1)
