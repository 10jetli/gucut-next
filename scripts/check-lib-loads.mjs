#!/usr/bin/env node
/* ตัวช่วยใน `scripts/lib/` ต้อง **โหลดได้จริง** ไม่ใช่แค่ไวยากรณ์ผ่าน
 *
 * 🔴 ที่มา 20 ก.ย. 2569 — ฝั่งท่อเจอของจริง: แก้ไฟล์ตัวสร้างแล้ว **ลืมใส่ `import`**
 *    ⇒ `ReferenceError` ตอนรัน แต่ **เทส 709 ข้อผ่านหมด** เพราะด่านที่คุมไฟล์นั้น
 *       อ่าน **ข้อความในซอร์ส** ไม่ได้ **รันมัน**
 *    🔑 ⇒ **ด่านรูปแบบกับด่านของจริงจับคนละอย่าง**
 *       `node --check` จับได้แค่ไวยากรณ์ — **ReferenceError เป็นเรื่องตอนรัน มันมองไม่เห็น**
 *
 * 📏 วัดฝั่งเราวันเดียวกัน: `scripts/lib/` มี 7 ตัวช่วย · สายรัน 71 ขั้นเรียกใช้จริง 4
 *    ⇒ **3 ตัวไม่เคยถูกรันเลย** รวมถึง `ปลูกแล้ววัด.mjs` ซึ่งเป็นเครื่องมือที่ **สองรีโปใช้ร่วมกัน**
 *       เพื่อพิสูจน์ว่าด่านจับบั๊กได้ ⇒ ถ้ามันพัง เราจะพิสูจน์อะไรไม่ได้ทั้งสองฝั่ง
 *
 * 🚫 **ตัวนี้ครอบอะไรไม่ได้บ้าง — ต้องเขียนไว้ ไม่งั้นเขียวของมันจะถูกอ่านเกินจริง**
 *    · ครอบ: โหลดโมดูลได้ · โค้ดระดับบนสุดไม่โยน · มี export อย่างน้อยหนึ่งตัว
 *    · **ไม่ครอบ: ข้างในตัวฟังก์ชัน** — `ReferenceError` ที่ซ่อนในฟังก์ชันที่ไม่มีใครเรียก ยังหลุดได้
 *      ⇒ ทางแก้ที่แท้จริงของเรื่องนั้นคือ **เรียกมันจริงในเทส** ไม่ใช่ด่านนี้
 */
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

const dir = resolve(process.cwd(), 'scripts/lib')
const ไฟล์ = readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort()
const พัง = []
let มีexport = 0

for (const n of ไฟล์) {
  try {
    const m = await import(pathToFileURL(join(dir, n)).href)
    const ชื่อexport = Object.keys(m)
    if (ชื่อexport.length === 0) {
      พัง.push(`${n} — โหลดได้แต่ **ไม่มี export เลย** ⇒ ไม่มีใครใช้ได้ (ตั้งใจแบบนี้ไหม)`)
    } else {
      มีexport++
    }
  } catch (e) {
    /* 🔑 พิมพ์ชนิดของ error ด้วย — `ReferenceError` (ลืม import) ต่างจาก `SyntaxError` คนละทางแก้ */
    พัง.push(`${n} — โหลดไม่ได้: **${e?.constructor?.name ?? 'Error'}** ${String(e?.message ?? e).slice(0, 160)}`)
  }
}

console.log(`ตรวจว่าตัวช่วยโหลดได้จริง: **${ไฟล์.length} ไฟล์** ใน scripts/lib/ · โหลดได้และมี export ${มีexport}`)
console.log('   ⚠️ ครอบแค่ระดับบนสุดของโมดูล — ReferenceError ที่ซ่อนในฟังก์ชันที่ไม่มีใครเรียก **ยังหลุดได้**')
if (พัง.length) {
  console.error('\n🔴 ตัวช่วยที่โหลดไม่ได้ (หรือไม่มีของให้ใช้)')
  for (const x of พัง) console.error('   ' + x)
  console.error('\n   ⚠️ `node --check` ผ่านไม่ได้แปลว่ารันได้ — ไวยากรณ์ถูกกับชื่อมีอยู่จริง คนละเรื่อง')
  process.exit(1)
}
console.log('✅ ตัวช่วยทุกตัวโหลดได้และมีของให้ใช้จริง')
