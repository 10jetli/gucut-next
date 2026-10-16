/* วัดว่าพจนานุกรมอะไหล่ครอบชื่อจริงได้แค่ไหน — และ **พิมพ์คำที่ยังไม่รู้จักออกมาทุกคำ**
   รัน: node scripts/วัดคำแปลอะไหล่.mjs [--รายชื่อ]

   🔑 เหตุที่ต้องมีไฟล์นี้: "แปลไทยแล้ว" เป็นคำกล่าวอ้างที่ตรวจได้
      ถ้าไม่วัด เราจะรายงานว่าแปลแล้วโดยที่ของจริงแปลได้ครึ่งเดียว
      และ **จอจะดูเหมือนแปลสำเร็จ** เพราะคำที่ไม่รู้จักยังเป็นอังกฤษอยู่ปน ๆ กันอย่างกลมกลืน

   ⚠️ ตัวเลขที่รายงานคือ **สัดส่วนชื่อที่แปลครบทุกคำ** ไม่ใช่สัดส่วนคำ
      สัดส่วนคำจะสวยเกินจริงเสมอ เพราะคำที่พบบ่อย (screw/washer) แปลง่ายที่สุด
      ⇒ ชื่อที่เหลืออังกฤษค้างหนึ่งคำ ยังเป็นชื่อที่คนอ่านไม่เข้าใจอยู่ดี */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ที่เก็บผัง = process.env.PARTS_DIR || '../gucut-web/public/parts'

/* อ่านพจนานุกรมจากไฟล์ .ts ตรง ๆ ไม่ได้ (node import .ts ไม่ได้)
   ⇒ ใช้ท่าเดียวกับ legal.mjs ของโปรเจกต์: นับวงเล็บหาก้อนแล้ว eval เป็น object
   ⚠️ อ่านไม่เจอให้ **โยน error** ห้ามคืนก้อนว่าง — ก้อนว่างทำให้ผลออกมาเป็น
      "ไม่รู้จักทุกคำ" ซึ่งดูเหมือนพจนานุกรมห่วย ทั้งที่ของจริงคือสคริปต์อ่านพลาด */
function อ่านพจนานุกรม(path) {
  const s = readFileSync(path, 'utf8')
  const ชื่อตัวแปร = 'พจนานุกรมอะไหล่: Record<string, string> = '
  const i = s.indexOf(ชื่อตัวแปร)
  if (i < 0) throw new Error(`อ่านพจนานุกรมไม่เจอใน ${path} — รูปไฟล์เปลี่ยน ต้องมาดูก่อน`)
  const เริ่ม = s.indexOf('{', i + ชื่อตัวแปร.length)
  let ลึก = 0, จบ = -1
  for (let k = เริ่ม; k < s.length; k++) {
    if (s[k] === '{') ลึก++
    else if (s[k] === '}' && --ลึก === 0) { จบ = k; break }
  }
  if (จบ < 0) throw new Error('วงเล็บพจนานุกรมไม่ครบ')
  const ก้อน = eval('(' + s.slice(เริ่ม, จบ + 1) + ')')
  if (!Object.keys(ก้อน).length) throw new Error('พจนานุกรมว่าง — ไม่ปกติ')

  const ไม่แปล = s.indexOf('ไม่ต้องแปล = new Set([')
  if (ไม่แปล < 0) throw new Error('อ่านรายการไม่ต้องแปลไม่เจอ')
  const a = s.indexOf('[', ไม่แปล), b = s.indexOf('])', a)
  return { ก้อน, ยกเว้น: new Set(eval(s.slice(a, b + 1))) }
}

const { ก้อน: พจน, ยกเว้น } = อ่านพจนานุกรม(join(import.meta.dirname, '../lib/parts-thai.ts'))
const เรียงยาวก่อน = Object.keys(พจน).sort((a, b) => b.length - a.length)

function แปล(ชื่อ) {
  let งาน = String(ชื่อ || '').trim()
  if (!งาน || /[฀-๿]/.test(งาน)) return { ไทย: งาน, เหลือ: [] }
  for (const คำ of เรียงยาวก่อน) {
    const หนี = คำ.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    งาน = งาน.replace(new RegExp(`(?<![A-Za-z])${หนี}(?![A-Za-z])`, 'gi'), พจน[คำ])
  }
  const เหลือ = []
  /* ⚠️ **รหัสขนาดไม่ใช่คำ** — `IS-M5x18` `C1Q-S57C` `O-ring 7x1.5`
     ตัวจับคำเดิมหยิบเฉพาะส่วนตัวอักษร (`is-m` `q-s` `o-`) แล้วรายงานว่าไม่รู้จัก
     ⇒ 6 อันดับแรกของรายชื่อ "ยังไม่แปล" กลายเป็นของที่ตั้งใจไม่แปลตั้งแต่ต้น
        คนอ่านจะเลิกเชื่อรายชื่อนั้นทั้งใบ = ตัววัดที่ไม่มีใครใช้
     เกณฑ์: โทเคนที่มีตัวเลขติดอยู่ในก้อนเดียวกัน = รหัส ไม่ใช่คำ */
  for (const m of งาน.matchAll(/[A-Za-z][A-Za-z0-9-]*/g)) {
    if (/\d/.test(m[0])) continue
    const l = m[0].replace(/-+$/, '').toLowerCase()
    if (l.length < 2 || ยกเว้น.has(l) || เหลือ.includes(l)) continue
    เหลือ.push(l)
  }
  return { ไทย: งาน.replace(/\s{2,}/g, ' ').trim(), เหลือ }
}

let ครบ = 0, บางส่วน = 0, ไทยอยู่แล้ว = 0, รวม = 0
const ค้าง = new Map()
const ตัวอย่างค้าง = new Map()
for (const f of readdirSync(ที่เก็บผัง)) {
  if (!f.endsWith('.json') || f === 'models.json') continue
  const d = JSON.parse(readFileSync(join(ที่เก็บผัง, f), 'utf8'))
  for (const g of d.กลุ่ม || []) for (const a of g.อะไหล่ || []) {
    const ชื่อ = String(a.ชื่อ || '').trim()
    if (!ชื่อ) continue
    รวม++
    if (/[฀-๿]/.test(ชื่อ)) { ไทยอยู่แล้ว++; continue }
    const { เหลือ } = แปล(ชื่อ)
    if (!เหลือ.length) ครบ++
    else {
      บางส่วน++
      for (const w of เหลือ) {
        ค้าง.set(w, (ค้าง.get(w) || 0) + 1)
        if (!ตัวอย่างค้าง.has(w)) ตัวอย่างค้าง.set(w, ชื่อ)
      }
    }
  }
}

const แปลเอง = ครบ + ไทยอยู่แล้ว
console.log(`\nชื่ออะไหล่ทั้งหมด ${รวม} แถว`)
console.log(`  เป็นไทยครบ        ${แปลเอง}  (${((แปลเอง / รวม) * 100).toFixed(1)}%)`)
console.log(`    • พจนานุกรมแปลครบ ${ครบ}`)
console.log(`    • กรอกไทยไว้แต่แรก ${ไทยอยู่แล้ว}`)
console.log(`  ยังมีอังกฤษค้าง   ${บางส่วน}  (${((บางส่วน / รวม) * 100).toFixed(1)}%)`)
console.log(`\nคำที่ยังไม่มีในพจนานุกรม ${ค้าง.size} คำ — เรียงตามจำนวนแถวที่กระทบ`)
const เรียง = [...ค้าง.entries()].sort((a, b) => b[1] - a[1])
const แสดง = process.argv.includes('--รายชื่อ') ? เรียง : เรียง.slice(0, 40)
for (const [w, c] of แสดง) console.log(`  ${String(c).padStart(4)}  ${w.padEnd(18)} ← ${ตัวอย่างค้าง.get(w)}`)
if (แสดง.length < เรียง.length) console.log(`  … อีก ${เรียง.length - แสดง.length} คำ (ใส่ --รายชื่อ เพื่อดูครบ)`)
console.log('')
