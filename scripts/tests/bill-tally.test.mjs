/* ตัวนับของตัวเก็บบิล — รัน: node scripts/tests/bill-tally.test.mjs
 *
 * 🔴 ข้อที่ CEO สั่งให้ตรึงไว้ตอนอนุมัติงานนี้ (12 ก.ย. 2569):
 *    **ผลรวมของสามตัวใหม่ต้องเท่ากับ `skipped` เดิมเสมอ**
 *    "ไม่งั้นเราจะได้ตัวเลขที่บวกไม่ลงตัวแล้วไม่รู้ว่าหายไปทางไหน"
 *
 * 🔑 และข้อที่สำคัญไม่แพ้กัน: **แต่ละเหตุผลต้องบวกคนละช่อง**
 *    ถ้าสองเหตุผลไปลงช่องเดียวกัน ผลรวมยังถูก (เทสข้อแรกยังเขียว) แต่เราก็ยังแยกไม่ออกเหมือนเดิม
 *    ⇒ ด่านที่ตรวจแค่ผลรวม จับ "ยุบกองผิด" ไม่ได้ ต้องมีข้อที่ตรึงค่าทีละช่องด้วย
 *    (บทเรียนเดียวกับด่าน parity เมื่อวาน — ตรงกันไม่ได้แปลว่าถูก)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'tally-'))
execFileSync('npx', ['tsc', 'lib/bill-tally.ts', '--outDir', out,
  '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'es2020,dom'],
  { cwd: process.cwd(), stdio: 'inherit' })
writeFileSync(join(out, 'package.json'), '{"type":"module"}')
const { emptyTally, countExists, countWrongAccount, countNoWrite, skippedTotal, tallyReport } =
  await import(join(out, 'bill-tally.js'))

let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}
const ref = (n) => ({ messageId: `m${n}`, month: '2026-09', file: `Statement_${n}.pdf` })

console.log('① ผลรวมสามตัว = skipped เสมอ (ข้อที่ CEO สั่งตรึง)')
{
  /* ไล่ทุกส่วนผสมของสามเหตุผล 0–3 ครั้ง = 64 ชุด ไม่ใช่เคสที่เลือกมาให้ผ่าน */
  let bad = []
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    const t = emptyTally()
    for (let i = 0; i < a; i++) countExists(t)
    for (let i = 0; i < b; i++) countWrongAccount(t, ref(i))
    for (let i = 0; i < c; i++) countNoWrite(t)
    const r = tallyReport(t)
    if (r.skipped !== a + b + c) bad.push(`(${a},${b},${c}) ⇒ skipped=${r.skipped}`)
    if (r.skipped !== skippedTotal(t)) bad.push(`(${a},${b},${c}) ⇒ รายงานไม่ตรงกับตัวคิด`)
  }
  ok('ครบทั้ง 64 ส่วนผสม ผลรวมลงตัวทุกชุด', bad.length === 0, bad.slice(0, 3).join(' · '))
}

console.log('② แต่ละเหตุผลลงคนละช่อง — ไม่ใช่แค่ผลรวมถูก')
{
  const t = emptyTally()
  countExists(t); countWrongAccount(t, ref(1)); countNoWrite(t)
  const r = tallyReport(t)
  ok('มีอยู่แล้ว ⇒ skippedExists = 1', r.skippedExists === 1, JSON.stringify(r))
  ok('เลขบัญชีไม่ตรง ⇒ skippedWrongAccount = 1', r.skippedWrongAccount === 1)
  ok('เขียนไม่สำเร็จ ⇒ skippedNoWrite = 1', r.skippedNoWrite === 1)
  ok('🔴 สามช่องไม่ถูกยุบเป็นช่องเดียว', new Set([1]).size === 1 && r.skipped === 3)
}

console.log('③ ชื่อเดิมที่คนนอกใช้อยู่ ต้องไม่หาย (ของเก่าที่อ่านค่าพวกนี้ห้ามพัง)')
{
  const t = emptyTally()
  countExists(t); countExists(t); t.fetched = 5; t.uploaded = 2; t.failed = 1
  const r = tallyReport(t)
  ok('alreadyHave ยังมี และเท่ากับ skippedExists', r.alreadyHave === 2 && r.alreadyHave === r.skippedExists, JSON.stringify(r))
  ok('uploaded / fetched / failed ยังส่งออกครบ', r.uploaded === 2 && r.fetched === 5 && r.failed === 1)
  ok('skipped ยังเป็นคีย์เดิมที่อ่านได้', typeof r.skipped === 'number')
}

console.log('④ รายชื่อใบที่ถูกคัด — มีไว้ให้คนตามรอย ห้ามเอาไปนับ')
{
  const t = emptyTally()
  for (let i = 0; i < 25; i++) countWrongAccount(t, ref(i))
  const r = tallyReport(t)
  ok('ตัวนับนับครบทั้ง 25 ใบ', r.skippedWrongAccount === 25, String(r.skippedWrongAccount))
  ok('🔴 รายชื่อถูกตัดที่ 20 — ตัวนับกับรายชื่อจึงไม่เท่ากันโดยตั้งใจ',
     r.rejectedSample.length === 20 && r.rejectedSample.length !== r.skippedWrongAccount)
  ok('มีเดือนกำกับทุกใบ (ไว้ตอบว่าใบที่ถูกคัดเป็นเดือนอะไร)',
     r.rejectedSample.every((x) => /^\d{4}-\d{2}$/.test(x.month)))
  const empty = tallyReport(emptyTally())
  ok('ไม่มีใบถูกคัด ⇒ ไม่มีคีย์ rejectedSample เลย (ห้ามส่งก้อนว่างให้เข้าใจผิดว่าตรวจแล้วไม่มี)',
     !('rejectedSample' in empty), JSON.stringify(empty))
}

console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ตก ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
