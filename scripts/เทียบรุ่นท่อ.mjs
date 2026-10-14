#!/usr/bin/env node
/* เทียบ **รุ่นของท่อที่สารบัญสำรวจไว้** กับ **รุ่นที่วิ่งอยู่จริง** (หัว `x-core-build`)
 *
 * 🔑 ฝั่งท่อชี้ข้อนี้ 14 ต.ค. 2569 และผมเห็นด้วย: **อายุเป็นตัวแทน · รุ่นเป็นของจริง**
 *    · แดงลวง: สารบัญเก่า 26 วัน แต่ท่อไม่เคย deploy ⇒ ทุกช่องยังถูก
 *    · เขียวลวง: ดึงมา 1 นาทีแล้วท่อ deploy ⇒ ชั้นนอก "สด" แต่เนื้อผิดทันที
 *      (วันนี้ท่อ deploy หลายรอบ ⇒ ทิศนี้ไม่ใช่ทฤษฎี)
 *
 * 🚫 **ไม่อยู่ใน prebuild** — ใช้เน็ต + คีย์ (หัว `x-core-build` ขอคีย์ · ยิง gucut.com เปล่า ๆ ไม่เห็นหัวนี้)
 *    ⇒ ด่าน prebuild อ่านได้แค่อายุ และมันพิมพ์ตรง ๆ ว่า "ยังไม่ได้เทียบรุ่น"
 * 🔑 สคริปต์ **อ่านคีย์เอง** จาก `~/.gucut-admin-key` — ห้ามให้คีย์ไปโผล่เป็นตัวแปรเชลล์
 *
 * ใช้: node scripts/เทียบรุ่นท่อ.mjs   (exit 1 = สารบัญสำรวจคนละรุ่น ⇒ ควรดึงใหม่)
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { บอกรุ่นสารบัญ, บอกอายุสารบัญ } from './lib/อายุสารบัญ.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const snap = JSON.parse(readFileSync(join(ROOT, 'lib/pipe-snapshot.json'), 'utf8'))
const ฐาน = process.env.GUCUT_WEB_BASE || 'https://gucut.com'

let คีย์
try {
  คีย์ = readFileSync(join(homedir(), '.gucut-admin-key'), 'utf8').trim()
} catch {
  console.log('⏳ ไม่มี ~/.gucut-admin-key ⇒ **ยังไม่ได้เทียบรุ่น** (ไม่ใช่ "ตรงรุ่น")')
  process.exit(0)
}

let รุ่นจริง = null
try {
  const r = await fetch(`${ฐาน}/api/core?endpoints=1`, { headers: { 'x-admin-key': คีย์ } })
  รุ่นจริง = r.headers.get('x-core-build')
} catch (e) {
  console.log(`⏳ ยิงท่อไม่ได้ (${String(e.message).slice(0, 60)}) ⇒ **ยังไม่ได้เทียบรุ่น**`)
  process.exit(0)
}
if (!รุ่นจริง) {
  /* 🔴 ท่อไม่ส่งหัวนี้ = **เราบอกรุ่นไม่ได้** ⇒ ห้ามอ่านว่า "ตรงรุ่น" */
  console.log('🔴 ท่อไม่ส่งหัว `x-core-build` ⇒ **บอกรุ่นที่วิ่งอยู่ไม่ได้** ⇒ เทียบไม่ได้')
  process.exit(1)
}

บอกอายุสารบัญ(snap)
console.log(`\n🏷️  รุ่นที่วิ่งอยู่จริง: ${รุ่นจริง}`)
const แถว = บอกรุ่นสารบัญ(snap, รุ่นจริง)
const ไม่ตรง = แถว.filter((x) => x.ตรงกัน === false)
const บอกไม่ได้ = แถว.filter((x) => x.ตรงกัน === null)

if (ไม่ตรง.length) {
  console.log(`\n🔴 **สารบัญสำรวจท่อคนละรุ่น ${ไม่ตรง.length} ก้อน** ⇒ ดึงใหม่: node scripts/ดึงสารบัญท่อ.mjs`)
  console.log('   ⚠️ และตอนดึง ถ้าท่อ deploy ระหว่างสำรวจ **สารบัญจะเป็นส่วนผสมสองรุ่น**')
  console.log('      (รูปเดียวกับต้นไม้ขยับระหว่างด่าน push วิ่ง — เจอของจริงเช้านี้)')
  process.exit(1)
}
if (บอกไม่ได้.length) {
  console.log(`\n🟡 ตรงรุ่นเท่าที่จดไว้ · แต่ ${บอกไม่ได้.length} ก้อน **ไม่ได้จดรุ่น** ⇒ ก้อนนั้นยังบอกไม่ได้`)
  process.exit(0)
}
console.log('\n✅ ทุกก้อนในสารบัญสำรวจท่อ **รุ่นเดียวกับที่วิ่งอยู่**')
