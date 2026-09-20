#!/usr/bin/env node
/* ทิศพึ่งพาต้องลงล่างเสมอ: `lib/` · `scripts/` · `netlify/` **ห้ามพึ่ง** `components/` หรือ `app/`
 *
 * 🔴 **ที่มา 20 ก.ย. 2569 (ใบ S5)** — วัดกฎข้อ 7 แล้วเจอของจริงฝั่งจอ 1 จุด:
 *    `lib/product-menu.ts` อ่านชนิด `RowMenuItem` จาก `components/zort` ⇒ **lib พึ่ง components**
 *    ⇒ ชั้นล่างพึ่งชั้นบน = วันหนึ่งจะย้าย component ไม่ได้ หรือลากจอทั้งกองเข้ามาในงานเซิร์ฟเวอร์
 *    ⇒ แก้แล้ว (ย้ายชนิดไป `lib/types.ts` + re-export ที่เดิมเพื่อให้ผู้เรียกไม่ต้องแก้)
 *
 * 🔑 **และข้อที่ฝั่งท่อชี้ในวันเดียวกัน — ตะแกรงที่ครอบแค่ `import … from` จะพลาดรูปที่สำคัญที่สุด**
 *    เขาเจอฝั่งเขาเป็น `await import(...)` ที่ **ใส่ไว้เพื่อกัน circular dependency**
 *    ⇒ ⇒ **dynamic import ที่ใส่เพื่อกันวงกลม คือหลักฐานว่าทิศผิด ไม่ใช่การแก้**
 *    ⇒ ด่านนี้จึงครอบสามรูป: `import … from` · `await import(…)` · `require(…)`
 *
 * 🔒 **เพดาน 0 · ลดไม่ได้อีกแล้ว** — วันนี้ฝั่งจอไม่มีสักจุด (วัดแล้ว ไม่ได้เดา)
 *    ⇒ เจอเมื่อไหร่คือของใหม่เสมอ ⇒ ด่านตกทันที
 *
 * ⚠️ **ด่านนี้มีตัวควบคุมในตัวเอง** (รันทุกครั้งก่อนตัดสิน) — เพราะเลข 0 จากตะแกรงที่ไม่เคยถูกพิสูจน์
 *    อ่านได้สองทาง: *ไม่มีของ* หรือ *ตะแกรงมองไม่เห็น* ⇒ ที่นี่แยกให้ขาดทุกรอบ
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ชั้นล่าง = ['lib', 'scripts', 'netlify']
const ชั้นบน = '(@/components|@/app|\\.\\./components|\\.\\./app|\\./components|\\./app)'

const ตะแกรง = {
  'import … from': new RegExp(`import[^;\\n]*?from\\s*['"]${ชั้นบน}[^'"]*['"]`, 'g'),
  'await import(…)': new RegExp(`await\\s+import\\s*\\(\\s*['"]${ชั้นบน}[^'"]*['"]`, 'g'),
  'require(…)': new RegExp(`require\\s*\\(\\s*['"]${ชั้นบน}[^'"]*['"]`, 'g'),
}

/* ── ตัวควบคุม: ตะแกรงต้องจับรูปที่รู้ว่าผิด และต้องไม่จับรูปที่ถูก ── */
function ตะแกรงใช้ได้ไหม() {
  const เคส = [
    ["import type { X } from '@/components/zort'", 'import … from', true],
    ["const m = await import('@/components/zort')", 'await import(…)', true],
    ["const n = require('../components/ui/ErrorBox')", 'require(…)', true],
    ["import { fmtBaht } from '@/lib/format'", 'import … from', false],       // ชั้นเดียวกัน ⇒ ห้ามจับ
    ["const ok = await import('@/lib/format')", 'await import(…)', false],
  ]
  let ตก = 0
  for (const [ข้อความ, ชื่อ, ควรจับ] of เคส) {
    const จับได้ = new RegExp(ตะแกรง[ชื่อ].source).test(ข้อความ)
    if (จับได้ !== ควรจับ) {
      ตก++
      console.error(`   🔴 ตัวควบคุมไม่ผ่าน [${ชื่อ}]: ${JSON.stringify(ข้อความ)} ⇒ ได้ ${จับได้} ควรได้ ${ควรจับ}`)
    }
  }
  return ตก === 0
}

if (!ตะแกรงใช้ได้ไหม()) {
  console.error('🔴 ตะแกรงของด่านนี้ตัดสินตัวควบคุมผิด ⇒ **ผลของมันอ่านไม่ได้** (ไม่ใช่ "ไม่มีของ")')
  process.exit(1)
}

function เดิน(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) เดิน(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(n)) out.push(p)
  }
  return out
}

let ไฟล์ = []
for (const b of ชั้นล่าง) {
  try { ไฟล์ = ไฟล์.concat(เดิน(join(ROOT, b))) } catch { /* ไม่มีโฟลเดอร์นั้น = ข้าม */ }
}
/* 🔒 ไม่มีไฟล์ให้กวาด = ตัวเดินไฟล์พัง ไม่ใช่รีโปสะอาด */
if (ไฟล์.length < 50) {
  console.error(`🔴 กวาดได้แค่ ${ไฟล์.length} ไฟล์ — **ตัวเดินไฟล์พัง ไม่ใช่ทิศพึ่งพาถูก**`)
  process.exit(1)
}

/* 🔑 **ยกเว้นไฟล์ตัวเองไฟล์เดียว** — ตัวควบคุมข้างบนเขียนรูปที่ผิดไว้เป็นข้อความ
   ⇒ ด่านนี้จับตัวเองได้ทันทีที่รันครั้งแรก (คลาส "เครื่องมือที่กวาดไฟล์จะเจอตัวเอง")
   ⇒ ⇒ ยกเว้น **หนึ่งที่** ดีกว่าถอดตัวควบคุมทิ้ง เพราะตัวควบคุมคือสิ่งที่ทำให้เลข 0 อ่านได้
   ⚠️ ราคาที่จ่าย: ไฟล์นี้ไฟล์เดียวที่ด่านนี้ไม่ตรวจ ⇒ ถ้ามีใครเขียน import ผิดทิศ *ในไฟล์นี้* จะไม่มีใครเห็น */
const ตัวเอง = relative(ROOT, fileURLToPath(import.meta.url))

const เจอ = []
for (const p of ไฟล์) {
  const rel = relative(ROOT, p)
  if (rel === ตัวเอง) continue
  const src = readFileSync(p, 'utf8')
  for (const [ชื่อ, re] of Object.entries(ตะแกรง)) {
    for (const m of src.matchAll(re)) {
      const บรรทัด = src.slice(0, m.index).split('\n').length
      เจอ.push(`${rel}:${บรรทัด}  [${ชื่อ}]  ${m[0].slice(0, 90)}`)
    }
  }
}

console.log(`ทิศพึ่งพา: กวาด **${ไฟล์.length} ไฟล์** ใน ${ชั้นล่าง.join('/ ')}/ · สามรูป (import · await import · require) · เพดาน 0`)
console.log('   ✅ ตัวควบคุมห้าเคสผ่านก่อนตัดสิน ⇒ เลขข้างล่างอ่านได้')
if (เจอ.length) {
  console.error(`\n🔴 ชั้นล่างพึ่งชั้นบน ${เจอ.length} จุด — **ทิศกลับหัว**`)
  for (const x of เจอ) console.error('   ' + x)
  console.error('\n   ⇒ ย้ายของที่ใช้ร่วมลงไปชั้นล่าง (เช่น `lib/types.ts`) แล้ว **re-export ที่เดิม**')
  console.error('      เพื่อให้ผู้เรียกเดิมไม่ต้องแก้ (ท่าที่ใช้กับ `RowMenuItem` 20 ก.ย. 2569)')
  console.error('   🔑 ถ้าใส่ `await import` เพื่อกัน circular dependency ⇒ นั่นคือ **หลักฐานว่าทิศผิด ไม่ใช่การแก้**')
  process.exit(1)
}
console.log('✅ ไม่มีชั้นล่างพึ่งชั้นบนสักจุด')
