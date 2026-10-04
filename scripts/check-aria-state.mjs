#!/usr/bin/env node
/* **ปุ่มตัวเลือกต้องบอกสถานะให้เครื่องอ่านได้ ไม่ใช่บอกด้วยสีเท่านั้น**
 *
 * 🔴 **ที่มา 4 ต.ค. 2569** — ปุ่มตัวเลือก 39 ปุ่ม/25 ไฟล์ บอกว่า "อันนี้เลือกอยู่" ด้วย `className`
 *    เท่านั้น ⇒ คนที่ใช้โปรแกรมอ่านหน้าจอไม่รู้ว่ากำลังดูข้อมูลของตัวเลือกไหน
 *    และตัวทดสอบกดจริงตัดสินว่า "จอไม่เปลี่ยน" ⇒ แดงลวง
 *
 * 🔑 **ด่านนี้ไม่ใช่ตัวนับ เป็นทะเบียน** (บทเรียน `the-skipped-bucket-holds-the-most-important-items`)
 *    กองที่ถูกยกเว้นมี **สองชนิดที่อ่านเหมือนกัน**: ยกเว้นโดยเจตนา กับ หลุดไปโดยไม่มีใครตัดสิน
 *    ⇒ ตัวเลขรวมแยกสองชนิดนี้ไม่ได้ ⇒ บังคับให้ **ทุกจุดที่ยกเว้นต้องมีเหตุรายจุด**
 *    ⇒ จุดใหม่ที่ไม่อยู่ในทะเบียน = ตก · รายการในทะเบียนที่ไม่ตรงกับของจริงแล้ว = ตก (เน่า)
 *
 * ⚠️ **ขอบเขตที่ด่านนี้ตอบไม่ได้** — มันเห็นแค่ว่า "มีแอตทริบิวต์ไหม"
 *    ไม่ได้ตอบว่าค่าที่เขียนถูกไหม (เงื่อนไขอาจกลับหัว) และไม่ได้ตอบว่ากดแล้วค่าเปลี่ยนจริงไหม
 *    ⇒ สองคำถามนั้นตอบด้วย `~/claude-shared/tools/จอเรา-ยืนยัน-aria.py` (กดจริงแล้วอ่านค่ากลับ)
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 📌 **ทะเบียนจุดที่ยกเว้นโดยเจตนา** — คีย์คือไฟล์ · ค่าคือเหตุที่ `aria-pressed` จะเป็นคำโกหก
 *  🔑 ป้ายที่เครื่องอ่านได้และ **ผิด** แย่กว่าไม่มีป้าย เพราะโปรแกรมอ่านหน้าจอจะประกาศความเท็จ
 *     ออกเสียงให้คนที่ตรวจเองไม่ได้ ⇒ การยกเว้นที่นี่คือ **การตัดสินใจ** ไม่ใช่การยอมแพ้ */
const ยกเว้นโดยเจตนา = new Map([
  ['app/bills/[vendor]/page.tsx',
    'ปุ่มรวมบิลทั้งเดือน — สีบอกว่า "เดือนนี้กำลังซิป" ไม่ใช่ "เดือนนี้ถูกเลือก" ⇒ ใส่ aria-busy แทนแล้ว'],
  ['app/core/pos/page.tsx',
    'แป้นตัวเลข — ปุ่ม AC เป็นสีแดงเพราะมันคือ AC ไม่ใช่เพราะถูกกด ⇒ ไม่มีสถานะ "เลือกอยู่"'],
  ['app/web/orders/page.tsx',
    'ปุ่มเปลี่ยนสถานะออเดอร์ — ปุ่มสั่งงาน สีบอกว่า "ยกเลิก" หรือ "ยืนยัน" ไม่ใช่สถานะที่เลือกอยู่'],
  ['components/layout/Sidebar.tsx',
    'พับ/คลี่กลุ่มเมนู — ไม่ใช่ตัวเลือก ⇒ ใส่ aria-expanded แทนแล้ว'],
])

const พื้นประชากร = 150   // กวาดได้น้อยกว่านี้ = ตะแกรงพัง ไม่ใช่ "รีโปสะอาด"

/** ดึงแท็กเปิดของ JSX ทั้งก้อน โดย **เดินอักขระ** หาคู่ `>` ที่ความลึกวงเล็บ/คำพูด 0
 *  🔴 ห้ามใช้ regex ตัดที่ `>` — `=>` และ generic `<T>` ทำให้ขาดกลางทาง
 *     (เหยียบจริง 4 ต.ค. 2569: ตะแกรง `[^<>]` ให้ 3 จุด ทั้งที่ของจริง 63) */
export function แท็กเปิด(src, ชื่อ = 'button') {
  const out = []
  const re = new RegExp(`<${ชื่อ}(?=[\\s/>])`, 'g')
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, ลึก = 0, q = null
    for (; i < src.length; i++) {
      const c = src[i]
      if (q) { if (c === q && src[i - 1] !== '\\') q = null; continue }
      if (c === '"' || c === "'" || c === '`') { q = c; continue }
      if (c === '{') ลึก++
      else if (c === '}') ลึก--
      else if (c === '>' && ลึก === 0) break
    }
    out.push(src.slice(m.index, i + 1))
  }
  return out
}

const คลาสเลือก = /(?:bg-(?:blue|indigo|sky|slate-800|gray-900|black)|text-white|border-blue|font-(?:semibold|bold|medium)|ring-)/
const ARIA = /aria-(?:pressed|selected|current|checked)\s*=/

/** แท็กนี้เป็น "ปุ่มตัวเลือกที่บอกสถานะด้วยสีเท่านั้น" ไหม */
export function บอกด้วยสีเท่านั้น(แท็ก) {
  if (ARIA.test(แท็ก)) return false
  const cn = แท็ก.match(/className=\{([\s\S]*)\}/)
  if (!cn) return false
  if (!/\?/.test(cn[1])) return false          // ไม่มีเงื่อนไข = ไม่ได้สลับสถานะ
  if (!คลาสเลือก.test(cn[1])) return false
  return /onClick=/.test(แท็ก)                 // ไม่มี onClick = ไม่ใช่ตัวเลือก
}

/* ── ตัวควบคุมของด่านนี้เอง · รันทุกครั้งก่อนตัดสิน ───────────────────────────── */
const เคสควบคุม = [
  // [ซอร์ส, ควรจับ]
  ['<button onClick={() => f(1)} className={`x ${on ? "bg-blue-600" : "bg-white"}`}>y</button>', true,
    'ควรจับ: ลูกศรฟังก์ชันใน prop ต้องไม่ทำให้ตัวเดินอักขระขาดที่ => '],
  ['<button onClick={() => f(1)} className={`x ${on ? "bg-blue-600" : "bg-white"}`} aria-pressed={on}>y</button>', false,
    'ต้องไม่จับ: มี aria-pressed แล้ว'],
  ['<button disabled={busy} className={`x ${busy ? "bg-gray-900" : "bg-white"}`}>y</button>', false,
    'ต้องไม่จับ: ไม่มี onClick ⇒ ไม่ใช่ตัวเลือก'],
  ['<button onClick={go} className="px-2 bg-blue-600">y</button>', false,
    'ต้องไม่จับ: className ไม่มีเงื่อนไข ⇒ ไม่ได้สลับสถานะ'],
  ['<button onClick={() => f()} className={`x ${on ? "opacity-50" : ""}`}>y</button>', false,
    'ต้องไม่จับ: คลาสที่สลับไม่ใช่คลาสที่สื่อว่าเลือกอยู่'],
]
let คุมตก = 0
for (const [src, ควร, ชื่อ] of เคสควบคุม) {
  const t = แท็กเปิด(src)
  const ได้ = t.length === 1 && บอกด้วยสีเท่านั้น(t[0])
  if (ได้ !== ควร) { console.error(`🔴 ตัวควบคุมตก — ${ชื่อ} (คาด ${ควร} ได้ ${ได้})`); คุมตก++ }
}
if (คุมตก) {
  console.error('🔴 ตะแกรงของด่านนี้แยกแยะไม่ได้แล้ว ⇒ เลขที่มันรายงานอ่านไม่ได้')
  process.exit(1)
}
console.log(`✅ ตัวควบคุม ${เคสควบคุม.length} เคสผ่านก่อนตัดสิน (จับ ${เคสควบคุม.filter((c) => c[1]).length} · ไม่จับ ${เคสควบคุม.filter((c) => !c[1]).length}) ⇒ เลขข้างล่างอ่านได้`)

if (process.argv.includes('--self-test')) process.exit(0)

/* ── กวาดของจริง ─────────────────────────────────────────────────────────────── */
const ไฟล์ = execSync("find app components -name '*.tsx'", { cwd: ROOT, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

if (ไฟล์.length < พื้นประชากร) {
  console.error(`🔴 กวาดได้แค่ ${ไฟล์.length} ไฟล์ (พื้น ${พื้นประชากร}) ⇒ **ตะแกรงพัง** ไม่ใช่รีโปสะอาด`)
  process.exit(1)
}

let นับแท็ก = 0
const เจอ = new Map()        // ไฟล์ → จำนวนจุด
for (const f of ไฟล์) {
  const src = readFileSync(new URL(f, new URL('..', import.meta.url)), 'utf8')
  for (const t of แท็กเปิด(src)) {
    นับแท็ก++
    if (บอกด้วยสีเท่านั้น(t)) เจอ.set(f, (เจอ.get(f) || 0) + 1)
  }
}

const รวม = [...เจอ.values()].reduce((a, b) => a + b, 0)
console.log(`สถานะที่เครื่องอ่านได้: กวาด **${ไฟล์.length} ไฟล์** · แท็ก <button> **${นับแท็ก}** ตัว`)
console.log(`   ปุ่มตัวเลือกที่บอกสถานะด้วย className เท่านั้น: **${รวม}** จุด ใน ${เจอ.size} ไฟล์`)
console.log(`   ⚠️ ด่านนี้ตอบแค่ "มีแอตทริบิวต์ไหม" — ไม่ได้ตอบว่าค่าถูกหรือกดแล้วเปลี่ยนจริง`)
console.log(`      (สองข้อนั้นวัดด้วย จอเรา-ยืนยัน-aria.py · บนเว็บจริง 4 ต.ค. 2569: ผ่าน 82 ตก 0)`)

const ใหม่ = [...เจอ.keys()].filter((f) => !ยกเว้นโดยเจตนา.has(f))
const เน่า = [...ยกเว้นโดยเจตนา.keys()].filter((f) => !เจอ.has(f))

if (ใหม่.length) {
  console.error('\n🔴 **จุดใหม่ที่ไม่อยู่ในทะเบียนยกเว้น** — ปุ่มตัวเลือกที่บอกสถานะด้วยสีเท่านั้น:')
  for (const f of ใหม่) console.error(`   · ${f} (${เจอ.get(f)} จุด)`)
  console.error('   ⇒ ใส่ `aria-pressed` ให้มัน **หรือ** ถ้ามันไม่ใช่ตัวเลือก ให้เพิ่มลงทะเบียน')
  console.error('      ใน scripts/check-aria-state.mjs **พร้อมเหตุรายจุด** — ตัวเลขรวมแยกไม่ออกว่า')
  console.error('      ยกเว้นโดยเจตนา หรือหลุดไปโดยไม่มีใครตัดสิน')
}
if (เน่า.length) {
  console.error('\n🔴 **รายการในทะเบียนที่เน่าแล้ว** — เขียนยกเว้นไว้แต่ไม่มีจุดที่ตรงอีกแล้ว:')
  for (const f of เน่า) console.error(`   · ${f} — "${ยกเว้นโดยเจตนา.get(f)}"`)
  console.error('   ⇒ ลบออกจากทะเบียน · ทะเบียนที่มีรายการผีจะปล่อยจุดใหม่ผ่านฟรีเมื่อไฟล์ชื่อซ้ำกลับมา')
}
if (ใหม่.length || เน่า.length) process.exit(1)

console.log(`\n✅ ทุกจุดที่ยกเว้น **มีเหตุรายจุด** ครบ ${ยกเว้นโดยเจตนา.size} ไฟล์:`)
for (const [f, เหตุ] of ยกเว้นโดยเจตนา) console.log(`   · ${f} — ${เหตุ}`)
