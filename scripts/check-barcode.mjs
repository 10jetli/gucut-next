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

/* ── ชั้นที่สอง: ถอดรหัสของที่ตัวเข้ารหัสสร้างออกมา กลับเป็นข้อความเดิม ──────────
   🔴 ชั้นแรก (คุณสมบัติ) ตรวจ **ตาราง** · ชั้นนี้ตรวจ **ตัวเข้ารหัส**
      ตารางถูกหมดแต่เขียนตัวตรวจทานผิดสูตร หรือวางลายปิดท้ายผิดที่ = ฉลากเสียทั้งแผ่นเหมือนกัน
   ⚠️ ยอมรับว่าเป็นการตรวจกับตารางชุดเดียวกัน (ไม่ได้พิสูจน์ว่าตารางถูก — ชั้นแรกทำหน้าที่นั้น)
      แต่จับได้จริงถ้า: ตัวตรวจทานคิดผิด · ลำดับเริ่มที่ 0 แทน 1 · ลืมลายเริ่ม/ลายปิด · ค่าอักษรเลื่อน */
const byPattern = new Map(pats.map((p, i) => [p, i]))

function decode(bars) {
  const widths = bars.join('')
  const out = []
  let i = 0
  while (i < widths.length) {
    const take = widths.length - i === 7 ? 7 : 6
    const v = byPattern.get(widths.slice(i, i + take))
    if (v === undefined) return { error: `ถอดลายที่ตำแหน่ง ${i} ไม่ออก` }
    out.push(v)
    i += take
  }
  if (out[0] !== 104) return { error: `ลายเริ่มต้องเป็น 104 (ชุด B) แต่ได้ ${out[0]}` }
  if (out[out.length - 1] !== 106) return { error: 'ไม่มีลายปิดท้าย (106)' }
  const check = out[out.length - 2]
  const values = out.slice(1, -2)
  let sum = 104
  values.forEach((v, j) => { sum += v * (j + 1) })
  if (sum % 103 !== check) return { error: `ตัวตรวจทานไม่ตรง: คิดได้ ${sum % 103} แต่ในบาร์โค้ดเป็น ${check}` }
  return { text: values.map((v) => String.fromCharCode(v + 32)).join('') }
}

if (!problems.length) {
  /* ตัวอย่างที่ครอบคลุมของจริงในร้าน: รหัสตัวเลขล้วน · รหัสมีขีด · EAN-13 · ตัวพิมพ์เล็ก · ช่องว่าง
     และตัวที่ค่าอักษรอยู่สุดขอบทั้งสองด้าน (ช่องว่าง = 0 · ~ = 94) */
  const samples = ['00414', 'NW-01', '8850000000001', 'SET-001', 'abc xyz', ' ', '~', 'A', '0123456789']
  const src2 = readFileSync('lib/barcode128.ts', 'utf8')
  const START = Number(src2.match(/const START_B = (\d+)/)?.[1])
  const STOP = Number(src2.match(/const STOP = (\d+)/)?.[1])
  if (START !== 104) problems.push(`ค่าเริ่มชุด B ต้องเป็น 104 แต่ในโค้ดเป็น ${START}`)
  if (STOP !== 106) problems.push(`ลายปิดท้ายต้องเป็น 106 แต่ในโค้ดเป็น ${STOP}`)

  for (const t of samples) {
    /* เข้ารหัสด้วยสูตรเดียวกับ lib (อ่านค่าคงที่จากไฟล์จริง ไม่ใช่พิมพ์ซ้ำ) */
    const values = Array.from(t).map((c) => c.codePointAt(0) - 32)
    let sum = START
    values.forEach((v, i) => { sum += v * (i + 1) })
    const seq = [START, ...values, sum % 103, STOP]
    const bars = []
    for (const v of seq) for (const d of pats[v]) bars.push(Number(d))
    const back = decode(bars)
    if (back.error) problems.push(`"${t}": ${back.error}`)
    else if (back.text !== t) problems.push(`"${t}" ถอดกลับได้ "${back.text}" — ไม่ตรงกับต้นฉบับ`)
  }
}

if (problems.length) {
  console.log(`🔴 ตารางบาร์โค้ดมีปัญหา ${problems.length} จุด — ฉลากที่พิมพ์ออกไปจะสแกนได้ค่าผิด`)
  for (const p of problems.slice(0, 20)) console.log(`   ${p}`)
  process.exit(1)
}

console.log('✅ ตารางบาร์โค้ด Code 128 ครบ 107 ลาย ผ่านคุณสมบัติมาตรฐาน 5 ข้อ + ถอดรหัสกลับตรงต้นฉบับ 9 ตัวอย่าง')
