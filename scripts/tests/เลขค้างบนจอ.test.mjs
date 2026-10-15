#!/usr/bin/env node
/* ห่อด่าน scripts/check-เลขค้างบนจอ.mjs ให้ **ด่าน push รันจริง** (15 ต.ค. 2569)
 *
 * 🔴 เหตุที่ต้องห่อ: ด่าน push (scripts/hooks/pre-push) รันแค่ `scripts/tests/*.test.mjs` + `npm run build`
 *    **ไม่ได้รันสาย `npm run ตรวจ`** และไม่มีใครอื่นรันสายนั้น (วัด 15 ต.ค. 2569: git grep เจอแค่ใน package.json)
 *    ⇒ ด่าน check-*.mjs ที่อยู่แต่ในสาย ตรวจ = ด่านที่ไม่มีใครเรียก
 *    (หลักฐาน: สูตรปลูกของ bills-status-route พังตั้งแต่ 9fd7e676 แล้ว push ผ่านมา 10+ รอบโดยไม่มีอะไรขึ้น)
 * ⚠️ ด่าน push ไม่ตีกลับ (ท่านประธานสั่ง 0fd04e40) ⇒ ตกแล้วของยังขึ้น แต่บรรทัดท้ายของด่านจะขึ้น 🔴 เทส=ตก
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ด่าน = join(ROOT, 'scripts/check-เลขค้างบนจอ.mjs')
let ตก = 0
for (const [ชื่อ, args] of [['ตรวจตัวเอง (ข้อสอบ 3 เคสจริง + ตัวควบคุมลบ)', ['--self-test']], ['ทั้งรีโปเทียบสมุดหนี้', []]]) {
  const r = spawnSync(process.execPath, [ด่าน, ...args], { cwd: ROOT, encoding: 'utf8' })
  const ok = r.status === 0
  console.log(`${ok ? '✅' : '❌'} ${ชื่อ}`)
  if (!ok) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`); console.log((r.stdout + r.stderr).split('\n').slice(-12).join('\n')) }
  else console.log((r.stdout || '').split('\n').filter((l) => l.startsWith('📒') || l.startsWith('✅')).join('\n'))
}
process.exit(ตก ? 1 : 0)
