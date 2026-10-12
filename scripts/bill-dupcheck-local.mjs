#!/usr/bin/env node
/* ตรวจบิลซ้ำจาก **โฟลเดอร์ในเครื่อง** — ไม่ต้องมีสิทธิ์ production
 * รัน: node scripts/bill-dupcheck-local.mjs <โฟลเดอร์> [รหัสเจ้า]
 *
 * 🔴 ที่มา (16 ก.ย. 2569 · ใบ t_mu3g8tq5): ท่านประธานจับได้เองว่าบิล Adobe ซ้ำ
 *    เส้น /api/bills/dupcheck ตรวจของในถัง production ได้ แต่ต้องมี DRIVESYNC_SECRET
 *    ⇒ ตัวนี้มีไว้ให้ "ใครก็ได้ที่มีไฟล์บิลอยู่ในเครื่อง" ตรวจได้ทันที (เช่นโหลดมาจาก Gmail แล้ววางไว้โฟลเดอร์เดียว)
 *
 * 🔒 อ่านอย่างเดียว — ไม่ลบ ไม่ย้าย ไม่แก้ไฟล์
 * 🔒 ค่าเริ่มต้น **ปิดบังเลขที่เอกสาร** (โชว์ 4 ตัวแรก + ความยาว) เพราะผลมักถูกก๊อปไปแปะที่อื่น
 *    อยากเห็นเลขเต็มให้เติม --เลขเต็ม (แล้วอย่าแปะลง repo หรือ claude-shared)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2).filter((a) => a !== '--เลขเต็ม')
const showFull = process.argv.includes('--เลขเต็ม')
const dir = args[0]
const vendorId = args[1] || 'ไม่ระบุเจ้า'
if (!dir) {
  console.log('ใช้: node scripts/bill-dupcheck-local.mjs <โฟลเดอร์ที่มีไฟล์ PDF> [รหัสเจ้า] [--เลขเต็ม]')
  process.exit(2)
}

/* คอมไพล์ตัวอ่านตัวตนใบจาก TypeScript ที่ใช้ของจริง — ไม่เขียนตรรกะซ้ำในสคริปต์นี้
   (ตรรกะซ้ำสองที่ = วันหนึ่งสองที่ตอบไม่เหมือนกัน แล้วไม่มีใครรู้ว่าอันไหนถูก) */
const out = mkdtempSync(join(tmpdir(), 'bill-id-'))
execFileSync('npx', ['tsc', 'lib/bill-identity.ts', 'lib/bill-text.ts', '--outDir', out,
  '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
  '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
writeFileSync(join(out, 'package.json'), '{"type":"module"}')
const idFile = join(out, 'bill-identity.js')
writeFileSync(idFile, readFileSync(idFile, 'utf8').replace(/from '\.\/bill-text'/g, "from './bill-text.js'"))
const { billIdentity, billFilingMonth } = await import(idFile)

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')
const mask = (s) => (!s ? '—' : showFull ? s : `${String(s).slice(0, 4)}…(${String(s).length} ตัว)`)

const files = readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort()
const byKey = new Map()
const undecidable = []
const misfiled = []
for (const name of files) {
  const p = join(dir, name)
  if (!statSync(p).isFile()) continue
  let text = ''
  try { text = String((await pdfParse(readFileSync(p), { max: 2 })).text ?? '').slice(0, 4000) } catch { /* อ่านไม่ออก */ }
  const id = billIdentity(text, vendorId)
  if (!id.key) { undecidable.push({ name, why: id.why }); continue }
  ;(byKey.get(id.key) ?? byKey.set(id.key, []).get(id.key)).push({ name, invoiceNo: id.invoiceNo, period: id.period })
  const fm = billFilingMonth(text)
  const inName = (name.match(/(\d{4})[-_.]?(\d{2})/) || [])
  if (fm.source === 'รอบบิลที่พิมพ์ในใบ' && fm.month && inName[1] && `${inName[1]}-${inName[2]}` !== fm.month) {
    misfiled.push({ name, เดือนในชื่อไฟล์: `${inName[1]}-${inName[2]}`, รอบบิลในใบ: fm.month })
  }
}

console.log(`\nโฟลเดอร์: ${dir} · ไฟล์ PDF ${files.length} ไฟล์ · นับเป็นเจ้า "${vendorId}"`)
const dups = Array.from(byKey.entries()).filter(([, v]) => v.length > 1)
console.log(`\n🔁 ใบซ้ำ (ใบเดียวกันหลายไฟล์): ${dups.length} กลุ่ม · ไฟล์เกินมา ${dups.reduce((a, [, v]) => a + v.length - 1, 0)} ไฟล์`)
for (const [key, list] of dups) {
  console.log(`   กุญแจ ${key.includes('inv:') ? key.replace(/inv:.*/, 'inv:' + mask(list[0].invoiceNo)) : key}`)
  for (const f of list) console.log(`      · ${f.name}`)
}
console.log(`\n🗓️ จัดผิดเดือน (ชื่อไฟล์ไม่ตรงรอบบิลในใบ): ${misfiled.length}`)
for (const m of misfiled) console.log(`   · ${m.name} — ชื่อไฟล์ ${m.เดือนในชื่อไฟล์} · รอบบิลจริง ${m.รอบบิลในใบ}`)
console.log(`\n⚠️ ตัดสินไม่ได้ว่าซ้ำหรือไม่: ${undecidable.length} (ต้องให้คนเปิดดู — ระบบไม่เดา)`)
for (const u of undecidable) console.log(`   · ${u.name} — ${u.why}`)
console.log('\n🔒 สคริปต์นี้ไม่ลบไม่ย้ายไฟล์ · ถ้าจะลบของซ้ำ ให้คนตัดสินทีละใบ (บิลลบแล้วกู้ไม่ได้)')
