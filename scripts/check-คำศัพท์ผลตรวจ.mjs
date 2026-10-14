#!/usr/bin/env node
/* 📖 **คำศัพท์ของผลตรวจ SEO/GEO — จอต้องรู้จักทุกค่าที่ท่อส่ง** (14 ต.ค. 2569)
 *
 * 🔴 ของจริงที่ด่านนี้เกิดมาเพื่อกัน (เจอบนเว็บจริงเช้านี้):
 *    จอ `/web/seo` นิยามเองว่า `level: fix|improve|ok` · `cat: seo|speed|ai`
 *    ท่อส่งจริง `level: high|mid|low|ok` · `cat: seo|geo|speed` ⇒ **ไม่ตรงกันสักค่า**
 *    และเพราะโค้ดจอเป็น ternary ที่ลงท้ายด้วย "เรียบร้อย/เขียว"
 *    ⇒ ปัญหาระดับ **high 4 ข้อขึ้นจุดเขียวว่า "เรียบร้อย"** · แท็บ `ai` ว่างตลอดกาล
 *    ⇒ คะแนน GEO 89 มีใน API แต่จออ่าน `scores.ai` ซึ่ง undefined
 *    **ไม่มี error · build ผ่านมาตลอด · ไม่มีอะไรฟ้องเลย**
 *
 * 🔑 ตรวจ **ทิศเดียว** โดยตั้งใจ: ทุกค่าที่ท่อ *ประกาศ* หรือ *ส่งจริง* จอต้องรู้จัก
 *    ค่าที่จอรู้จักเกินมา ไม่ทำให้พัง (แค่กิ่งที่ไม่มีใครเดิน) ⇒ ไม่ fail ⇒ ไม่มีบวกลวง
 *
 * 🚫 ไม่มีคำศัพท์ในสารบัญ ⇒ บอกว่า **"ยังไม่รู้"** ห้ามผ่านเงียบ ๆ
 *    (ท่อรุ่นเก่ายังไม่ประกาศ ⇒ ต้อง deploy ท่อ + `node scripts/ดึงสารบัญท่อ.mjs` ก่อน)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { บอกอายุสารบัญ } from './lib/อายุสารบัญ.mjs'

const ราก = fileURLToPath(new URL('..', import.meta.url))
const อ่าน = (p) => readFileSync(join(ราก, p), 'utf8')

const snap = JSON.parse(อ่าน('lib/pipe-snapshot.json'))
บอกอายุสารบัญ(snap, 'check-คำศัพท์ผลตรวจ')

const vocab = snap?.endpoints?.auditVocab ?? null
const note = snap?.endpoints?.auditVocabNote ?? null

const จอ = อ่าน('app/web/seo/page.tsx')
const ชุดจาก = (ชื่อ) => {
  const m = จอ.match(new RegExp(`^type ${ชื่อ} = ([^\\n]+)$`, 'm'))
  return m ? m[1].split('|').map((x) => x.trim().replace(/^'|'$/g, '')) : null
}
const catจอ = ชุดจาก('Cat')
const levelจอ = ชุดจาก('Level')
if (!catจอ || !levelจอ) {
  console.log('🔴 check-คำศัพท์ผลตรวจ: อ่าน type Cat/Level ในหน้าจอไม่ได้ (มีคนเปลี่ยนรูปแบบ?) ⇒ ตรวจไม่ได้')
  process.exit(1)
}

/* ระดับที่จอ "แสดงผลได้จริง" ไม่ใช่แค่ที่ชนิดยอมรับ — ตารางสีคือของที่ผู้ใช้เห็น */
const ตารางระดับ = [...จอ.matchAll(/^\s{2}(high|mid|low|ok):\s*\{/gm)].map((m) => m[1])

if (!vocab) {
  console.log(`⚠️  check-คำศัพท์ผลตรวจ: สารบัญยังไม่มีคำศัพท์ของผลตรวจ ⇒ **ยังไม่ได้ตรวจ** ไม่ใช่ผ่าน`)
  console.log(`   เหตุที่ท่อให้มา: ${note ?? '(ไม่มี — น่าจะเป็นสารบัญรุ่นก่อนที่ท่อจะประกาศ)'}`)
  console.log('   ⇒ deploy ท่อแล้วรัน `node scripts/ดึงสารบัญท่อ.mjs` เพื่อให้ด่านนี้ทำงานได้')
  console.log(`   (จอรู้จัก cat: ${catจอ.join('|')} · level: ${levelจอ.join('|')})`)
  process.exit(0)
}

const รวม = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])]
const catท่อ = รวม(vocab?.ประกาศ?.cat, vocab?.ที่พบจริง?.cat)
const levelท่อ = รวม(vocab?.ประกาศ?.level, vocab?.ที่พบจริง?.level)
const scoreKeys = vocab?.ที่พบจริง?.scoreKeys ?? []

const ขาด = []
for (const c of catท่อ) if (!catจอ.includes(c)) ขาด.push(`cat "${c}" — ท่อส่งแต่จอไม่รู้จัก ⇒ แท็บนั้นจะว่างเปล่า`)
for (const l of levelท่อ) if (!levelจอ.includes(l)) ขาด.push(`level "${l}" — ท่อส่งแต่ชนิดในจอไม่รับ`)
for (const l of levelท่อ) if (!ตารางระดับ.includes(l)) ขาด.push(`level "${l}" — ไม่มีในตารางสี ⇒ ผู้ใช้จะเห็น "ไม่รู้จัก"`)
for (const k of scoreKeys) if (!catจอ.includes(k)) ขาด.push(`คะแนนด้าน "${k}" — ท่อส่งมาแต่จอไม่มีช่องให้โชว์`)

console.log(`📖 คำศัพท์ผลตรวจ — ท่อ cat: ${catท่อ.join('|')} · level: ${levelท่อ.join('|')}`)
console.log(`   จอ   cat: ${catจอ.join('|')} · level: ${levelจอ.join('|')} · ตารางสี: ${ตารางระดับ.join('|')}`)
if (ขาด.length) {
  console.log('🔴 **จอไม่รู้จักค่าที่ท่อส่ง** — ค่าที่ไม่รู้จักจะไหลไปกองที่กิ่งท้ายสุดของจอ:')
  for (const x of ขาด) console.log('   · ' + x)
  console.log('   ⇒ แก้ที่จอให้ตามท่อ (ท่อเป็นเจ้าของนิยาม) หรือถ้าท่อเปลี่ยนคำศัพท์จริง ให้แก้ทั้งสองฝั่งพร้อมกัน')
  process.exit(1)
}
console.log('   ✓ จอรู้จักครบทุกค่าที่ท่อประกาศและที่ส่งจริง (ตรวจเท่าที่สารบัญรู้)')
