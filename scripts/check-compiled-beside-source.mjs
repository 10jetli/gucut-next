#!/usr/bin/env node
/* ด่านก่อน build: **ห้ามมีไฟล์ที่คอมไพล์แล้วนอนข้างซอร์สชื่อเดียวกัน**
 *
 * 🔴 **ที่มา 29 ก.ย. 2569 · เจอตอนตรวจต้นไม้ก่อน push พอดี**
 *    เทสที่ผมเขียนคอมไพล์ด้วย `tsc -p` โดยตั้ง `rootDir` แคบกว่าไฟล์ที่ถูก import ต่อ
 *    ⇒ tsc ตอบ **TS6059** แต่ **ยังพ่นไฟล์ออกมา** และพ่น **ข้างซอร์ส** ไม่ใช่ลง outDir
 *    ⇒ ได้ `lib/billreport.js` นอนข้าง `lib/billreport.ts` (รวม 4 ไฟล์) โดยไม่มีอะไรแจ้ง
 *
 * 🔑 ทำไมต้องเป็นด่าน ไม่ใช่แค่ลบทิ้ง
 *    `tsconfig.json` เปิด `allowJs: true` ⇒ ตัวรวมโมดูลอาจแก้ `@/lib/x` ไปที่ **`.js` เก่า**
 *    แทน `.ts` ที่เพิ่งแก้ ⇒ **แก้โค้ดแล้วพฤติกรรมไม่เปลี่ยน โดยไม่มี error**
 *    ซึ่งเป็นคลาสที่ไล่หาสาเหตุยากที่สุด และจะดูเหมือน "แก้ไม่ถูกจุด" ทำให้ไปแก้ที่อื่นต่อ
 *
 * 🚫 **ทางแก้ที่ดูถูกแต่ผิด: ใส่ `lib/*.js` ลง .gitignore**
 *    มันทำให้ไฟล์หายจาก `git status` **แต่ยังอยู่และยังบังซอร์สได้เหมือนเดิม**
 *    ⇒ เปลี่ยนจาก "ของอันตรายที่มองเห็น" เป็น "ของอันตรายที่มองไม่เห็น" = แย่ลง
 *    🔑 ของที่อันตรายเพราะ *มันอยู่ที่นั่น* ห้ามแก้ด้วยการ *ทำให้มองไม่เห็น*
 *
 * วิธีใช้
 *   node scripts/check-compiled-beside-source.mjs             ตรวจ (อยู่ใน prebuild · ตกได้)
 *   node scripts/check-compiled-beside-source.mjs --self-test ป้อนสภาพปลอมให้มันร้อง
 */
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
/** โฟลเดอร์ซอร์สที่ห้ามมีผลผลิตคอมไพเลอร์ปนอยู่ */
const ที่เฝ้า = ['lib', 'components', 'components/ui', 'components/layout', 'components/zort']

/** คืนรายชื่อคู่ที่ผิด — แยกเป็นฟังก์ชันเพื่อ **ป้อนสภาพปลอมให้มันร้องได้จริง** */
export function หาคู่ที่ผิด(อ่านไฟล์) {
  const ผิด = []
  for (const d of ที่เฝ้า) {
    let ไฟล์
    try { ไฟล์ = อ่านไฟล์(d) } catch { continue }   // ไม่มีโฟลเดอร์ = ข้าม ไม่ใช่ตก
    const มี = new Set(ไฟล์)
    for (const f of ไฟล์) {
      if (!f.endsWith('.js')) continue
      const คู่ = f.replace(/\.js$/, '')
      if (มี.has(`${คู่}.ts`) || มี.has(`${คู่}.tsx`)) ผิด.push(`${d}/${f}`)
    }
  }
  return ผิด
}

if (process.argv.includes('--self-test')) {
  /* 🔑 ต้องมีทั้งเคสที่ร้องและ **ตัวควบคุมลบ** — ตาข่ายที่ร้องทุกอินพุตใช้ไม่ได้เท่ากับตาข่ายที่ไม่เคยร้อง */
  const เคส = [
    ['มี .js นอนข้าง .ts', () => ['billreport.ts', 'billreport.js'], 1],
    ['มี .js นอนข้าง .tsx', () => ['OrderCard.tsx', 'OrderCard.js'], 1],
    ['ตัวควบคุมลบ: มีแต่ .ts', () => ['billreport.ts', 'vendors.ts'], 0],
    ['ตัวควบคุมลบ: .js ที่ไม่มีคู่ .ts (ของที่ตั้งใจเขียนเป็น .js)', () => ['ของแท้.js'], 0],
  ]
  let ตก = 0
  for (const [ชื่อ, อ่าน, ควรได้] of เคส) {
    const ได้ = หาคู่ที่ผิด(อ่าน).length / ที่เฝ้า.length
    const ตรง = Math.round(ได้) === ควรได้
    console.log(`  ${ตรง ? '✅' : '❌'} ${ชื่อ}`)
    if (!ตรง) ตก++
  }
  console.log(ตก ? `\n❌ self-test ไม่ผ่าน ${ตก} เคส` : `\n🧪 self-test ผ่าน ${เคส.length} เคส (ต้องร้อง 2 · ตัวควบคุมลบ 2)`)
  process.exit(ตก ? 1 : 0)
}

const ผิด = หาคู่ที่ผิด((d) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)) : []))
console.log(`ตรวจผลผลิตคอมไพเลอร์ปนซอร์ส: เฝ้า ${ที่เฝ้า.length} โฟลเดอร์`)
if (ผิด.length) {
  console.error(`\n🔴 พบไฟล์ที่คอมไพล์แล้วนอนข้างซอร์ส ${ผิด.length} ไฟล์:`)
  for (const f of ผิด) console.error(`   · ${f}  (คู่กับ ${f.replace(/\.js$/, '.ts')})`)
  console.error('\n   ⚠️ `allowJs: true` เปิดอยู่ ⇒ ตัวรวมโมดูลอาจหยิบ .js เก่าแทน .ts ที่เพิ่งแก้')
  console.error('      ⇒ แก้โค้ดแล้วพฤติกรรมไม่เปลี่ยน **โดยไม่มี error** ซึ่งไล่หาสาเหตุยากที่สุด')
  console.error('   🔑 มักเกิดจากเทสที่คอมไพล์เองแล้วตั้ง rootDir แคบเกิน (tsc ตอบ TS6059 แต่ยังพ่นไฟล์)')
  console.error('   🚫 ห้ามแก้ด้วย .gitignore — ซ่อนแล้วมันยังบังซอร์สได้เหมือนเดิม')
  process.exit(1)
}
console.log('✅ ไม่มีผลผลิตคอมไพเลอร์นอนข้างซอร์ส')
