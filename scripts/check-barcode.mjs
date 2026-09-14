// ตรวจตารางลาย Code 128 ใน lib/barcode128.ts ว่าไม่มีตัวเลขพิมพ์ผิด
//
// 🔴 **ทำไมต้องมีตัวตรวจนี้** — ตารางนี้คือตัวเลข 642 หลักที่พิมพ์ด้วยมือ
//    พิมพ์ผิดหนึ่งหลัก ⇒ ได้ฉลากที่ **สแกนออกแต่ได้ค่าผิด** หรือสแกนไม่ออกเฉพาะบางรหัส
//    ทั้งสองแบบ **build ผ่าน · tsc ผ่าน · จอดูสวยปกติ** ⇒ ไม่มีทางเจอถ้าไม่ตรวจตรง ๆ
//    (ตรงกับโรคประจำวันของโปรเจกต์: ระบบทำงานถูก แต่สื่อสารผิด)
//
// ตรวจคุณสมบัติของมาตรฐาน ไม่ใช่เทียบกับตารางอีกชุด (ก๊อบมาเทียบกันเอง = ไม่ได้ตรวจอะไร):
//   1. มี 107 ลาย (ค่า 0–106)
//   2. ลาย 0–105 มี 6 ช่วง กว้างรวม 11 โมดูล · ลาย 106 (ปิดท้าย) มี 7 ช่วง กว้างรวม 13
//   3. ผลรวมความกว้างของ **แท่งดำ** ทุกลายเป็นเลขคู่ (คุณสมบัติจริงของ Code 128)
//   4. ไม่มีลายซ้ำกันสองค่า (ลายซ้ำ = ถอดรหัสได้สองความหมาย)
//   5. ทุกช่วงกว้าง 1–4 โมดูล
//
// ใช้: node scripts/check-barcode.mjs   (อยู่ใน prebuild — ผิดแล้วไม่ให้ build ผ่าน)
import { readFileSync } from 'node:fs'

const src = readFileSync('lib/barcode128.ts', 'utf8')
const block = src.match(/export const CODE128_PATTERNS = \[([\s\S]*?)\n\]/)
if (!block) {
  console.log('🔴 หาตาราง CODE128_PATTERNS ใน lib/barcode128.ts ไม่เจอ')
  process.exit(1)
}
const pats = [...block[1].matchAll(/'(\d+)'/g)].map((m) => m[1])

const problems = []
const add = (m) => problems.push(m)

if (pats.length !== 107) add(`จำนวนลายต้องเป็น 107 แต่นับได้ ${pats.length}`)

pats.forEach((p, i) => {
  const d = [...p].map(Number)
  const isStop = i === 106
  const wantLen = isStop ? 7 : 6
  const wantSum = isStop ? 13 : 11
  const sum = d.reduce((a, b) => a + b, 0)
  /* แท่งดำอยู่ช่วงเลขคู่ (0,2,4…) เพราะลายเริ่มที่แท่งดำเสมอ */
  const barSum = d.filter((_, j) => j % 2 === 0).reduce((a, b) => a + b, 0)

  if (d.length !== wantLen) add(`ลายที่ ${i} (${p}) ต้องมี ${wantLen} ช่วง แต่มี ${d.length}`)
  if (sum !== wantSum) add(`ลายที่ ${i} (${p}) ต้องกว้างรวม ${wantSum} แต่ได้ ${sum}`)
  if (barSum % 2 !== 0) add(`ลายที่ ${i} (${p}) ผลรวมแท่งดำเป็น ${barSum} — ต้องเป็นเลขคู่`)
  if (d.some((x) => x < 1 || x > 4)) add(`ลายที่ ${i} (${p}) มีช่วงกว้างเกิน 1–4 โมดูล`)
})

const seen = new Map()
pats.forEach((p, i) => {
  if (seen.has(p)) add(`ลาย ${p} ซ้ำกันที่ค่า ${seen.get(p)} และ ${i} — ถอดรหัสได้สองความหมาย`)
  else seen.set(p, i)
})

if (problems.length) {
  console.log(`🔴 ตารางบาร์โค้ดมีปัญหา ${problems.length} จุด — ฉลากที่พิมพ์ออกไปจะสแกนได้ค่าผิด`)
  for (const p of problems.slice(0, 20)) console.log(`   ${p}`)
  process.exit(1)
}

console.log(`✅ ตารางบาร์โค้ด Code 128 ครบ 107 ลาย ผ่านคุณสมบัติมาตรฐานทั้ง 5 ข้อ`)
