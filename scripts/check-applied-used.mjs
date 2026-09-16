#!/usr/bin/env node
/* ด่านก่อน build: จอที่รู้จักช่อง `applied` **ต้องเอามาเทียบจริง** ไม่ใช่ประกาศไว้เฉย ๆ
 *
 * 🔑 `applied` คือช่องที่ท่อบอกว่า "เงื่อนไขที่ฉันใช้จริงคืออะไร"
 *    มีไว้ให้จอตรวจว่า **ที่ขอไป** กับ **ที่ได้มา** ตรงกันไหม
 *    ⇒ กฎประจำโปรเจกต์: **ตอบ 200 ไม่ได้แปลว่าทำให้** (เจอมาแล้วหลายรอบ:
 *       `list=purchases&status=` ถูกเมินเงียบ ๆ · `offset` ถูกเมินที่เส้นเอกสารบัญชี ฯลฯ)
 *
 * 🔴 ที่มาของด่านนี้ (17 ก.ย. 2569): จอลูกค้า **ประกาศ `applied` ไว้ตั้งแต่ 15 ก.ย.**
 *    และเทียบแค่สองสวิตช์ · ส่วน **คำค้น (`q`) ไม่เคยถูกเทียบเลย**
 *    ⇒ ถ้าท่อเมินคำค้น จอจะโชว์รายชื่อทั้งกองให้คนที่เพิ่งพิมพ์ค้นหา โดยไม่มีอะไรฟ้อง
 *    ⇒ ด่านนี้กันไม่ให้ "ประกาศแล้วลืมใช้" เกิดอีก
 *
 * วิธีตรวจ: ไฟล์ `app/**\/page.tsx` ที่ประกาศ `applied?:` ในชนิดข้อมูล
 *   ต้องมีการ **อ่านค่ามาเทียบ** (`applied.` หรือ `applied?.`) อย่างน้อยหนึ่งจุดนอกบรรทัดที่ประกาศ
 * ⚠️ ตรวจได้แค่ "มีการเทียบ" ไม่ได้ตรวจว่าเทียบครบทุกช่อง — ยังต้องดูด้วยตา
 *    (แต่จับกรณี "ประกาศแล้วไม่ใช้เลย" ซึ่งเป็นกรณีที่เกิดจริง)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name === 'page.tsx') out.push(p)
  }
  return out
}

const ปัญหา = []
for (const file of walk(join(ROOT, 'app'))) {
  const src = readFileSync(file, 'utf8')
  if (!/\bapplied\?\s*:/.test(src)) continue          // จอนี้ไม่รู้จัก applied ⇒ ไม่เกี่ยว
  /* ต้องมีการอ่านค่าไปใช้จริง — นับเฉพาะบรรทัดที่ **ไม่ใช่** บรรทัดประกาศชนิดข้อมูล */
  const ใช้จริง = src.split('\n').some((line) =>
    /\bapplied\s*(\?\.|\.)/.test(line) && !/\bapplied\?\s*:/.test(line))
  if (!ใช้จริง) ปัญหา.push(file.replace(ROOT, ''))
}

if (ปัญหา.length) {
  console.error('🔴 จอที่ประกาศช่อง `applied` ไว้ แต่ไม่ได้เอามาเทียบ:\n')
  for (const f of ปัญหา) console.error(`  ${f}`)
  console.error('\n⇒ `applied` คือคำตอบของท่อว่า "ใช้เงื่อนไขอะไรจริง ๆ"')
  console.error('   จอต้องเทียบกับสิ่งที่ส่งไป แล้วขึ้นคำเตือนเมื่อไม่ตรง (ตอบ 200 ไม่ได้แปลว่าทำให้)')
  process.exit(1)
}
console.log('✅ จอที่รู้จัก `applied` เอามาเทียบครบแล้ว')
