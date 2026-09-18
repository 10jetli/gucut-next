#!/usr/bin/env node
/* ด่านก่อน build: ห้ามส่ง "ค่าสถานะดิบจากท่อ" ขึ้นจอโดยไม่ผ่านตารางคำของ ZORT
 *
 * 🔴 ที่มา — ท่านประธานถ่ายจอ /core/sales มาให้ดู: คอลัมน์เดียวกัน แถวบน "ชำระครบ" แถวล่าง "Pending"
 *    คำสั่ง: "ใช้ภาษาแบบ zort ให้เหมือน 100% ลูกน้องผมใช้ จะให้เขารู้สึกว่าไม่ได้ปรับตัวมาก"
 *
 * 🔴 ทำไมต้องเป็นด่าน ไม่ใช่การกวาดด้วยมือ — กวาดด้วยมือมาแล้ว 3 รอบ (15–16 ก.ย. 2569)
 *    รอบ 1 เจอ 5 ไฟล์ · รอบ 2 เจออีก 4 จอ · รอบ 3 เจออีก 5 จุด
 *    เหตุที่รอด: แพตเทิร์นค้นหาแต่ละรอบไม่ครอบรูปแบบการเขียน — `{r.status}` · `{r.status ?? '—'}` · `{d.status || …}`
 *    ⇒ ต้องมีตัวตรวจที่ครอบทุกแบบ และรันทุกครั้งก่อน build
 *
 * กติกา: บรรทัดที่ "เอาค่าสถานะมาวางเป็นข้อความบนจอ" ต้องมีอย่างใดอย่างหนึ่ง
 *   · ผ่าน `zortWord(` หรือ `statusText(` (ตารางคำที่เดียวของระบบ — lib/zort-words.ts)
 *   · เป็นการ **เทียบค่าในโค้ด** (มี `===` / `!==`) เช่นเลือกสีของป้าย — ค่าในโค้ดไม่ต้องแปล
 *   · อยู่ใน backtick (`${...}`) ซึ่งใช้กับ title/tooltip ที่ตั้งใจโชว์ "ค่าที่ท่อส่งมา"
 *   · หรืออยู่ในรายการ `ยกเว้น` ข้างล่างพร้อมเหตุผล
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const ช่องสถานะ = 'status|pay_status|paymentStatus|payStatus|transferStatus'
/* จับเฉพาะ "วางค่าดิบลงจอตรง ๆ" คือในปีกกามีแค่ตัวค่า + ค่าสำรองง่าย ๆ (?? หรือ ||)
   ไม่จับเมื่อถูกห่อด้วยฟังก์ชัน (`{statusTh(r.status)}`) หรือถูกใช้เป็นคีย์ของแผนที่ (`{MAP[r.status]}`)
   — สองแบบนั้นเป็นทางผ่านที่ถูกต้อง และตัวห่อเองก็เรียก zortWord อยู่แล้ว
   ⚠️ ไม่รวม `shipStatus` เพราะเป็นสถานะฝั่งมาร์เก็ตเพลส (Shopee/Lazada) ไม่ใช่คำของ ZORT
      จอที่โชว์ค่านั้นเขียนที่มากำกับไว้แล้วว่าเป็น "สถานะฝั่งแพลตฟอร์ม" */
const RE = new RegExp(String.raw`\{\s*[A-Za-z_][\w]*\.(${ช่องสถานะ})\b\s*(?:(?:\?\?|\|\|)\s*[^{}]*)?\}`)

/** component ที่รับค่าดิบไปแปลเองข้างใน — ส่งค่าดิบให้มันได้ (ต้องตรวจแล้วว่าแปลจริง) */
const componentที่แปลเอง = {
  PaymentPill: 'components/zort/index.tsx — เรียก zortWord(PAY_STATUS) ข้างใน (อ่านโค้ดยืนยันแล้ว 16 ก.ย. 2569)',
}

/** ไฟล์ที่ไม่ได้มิเรอร์ ZORT — ต้องมีเหตุผล */
const ยกเว้นไฟล์ = {
  'app/tracker/page.tsx': 'จอติดตามงานของเราเอง ใช้สถานะชุดของเราเอง ไม่ใช่สถานะของ ZORT',
  'app/returns/receive/page.tsx': 'สถานะการอัปโหลดรูปในเครื่อง (uploaded/failed) ไม่ใช่สถานะเอกสารของ ZORT',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const พบ = []
/* 🔒 ไม่มีไฟล์ให้ตรวจ = ไม่ผ่าน (ดู scripts/lib/ต้องมีของให้ตรวจ.mjs) */
const ไฟล์ที่ตรวจ = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]
ต้องมีของให้ตรวจ(ไฟล์ที่ตรวจ.length, 'check-zort-words')
for (const file of ไฟล์ที่ตรวจ) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  if (ยกเว้นไฟล์[rel]) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((ln, i) => {
    const t = ln.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
    if (!RE.test(ln)) return
    if (ln.includes('zortWord') || ln.includes('statusText')) return       // ผ่านตารางคำแล้ว
    if (ln.includes('===') || ln.includes('!==')) return                    // เทียบค่าในโค้ด ไม่ใช่ข้อความบนจอ
    if (ln.includes('${')) return                                           // อยู่ใน title/tooltip ที่โชว์ค่าดิบตั้งใจ
    if (/\bres\.status\b|\br\.status\}\)|HTTP/.test(ln)) return             // สถานะ HTTP ไม่เกี่ยว
    // ส่งเป็น prop ให้ component ที่แปลเองข้างใน ⇒ ผ่าน (แต่ต้องอยู่ในรายการที่ตรวจแล้ว)
    if (Object.keys(componentที่แปลเอง).some((c) => ln.includes('<' + c))) return
    พบ.push(`${rel}:${i + 1}  ${t.slice(0, 110)}`)
  })
}

console.log(`ตรวจคำสถานะบนจอ: ไฟล์ .tsx ทั้งหมดในสาย app/ components/ · ยกเว้นไว้ ${Object.keys(ยกเว้นไฟล์).length} ไฟล์`)
if (พบ.length) {
  console.error('\n🔴 มีค่าสถานะดิบขึ้นจอโดยไม่ผ่านตารางคำของ ZORT')
  for (const x of พบ) console.error('   ' + x)
  console.error('\n   วิธีแก้: import ชุดคำจาก lib/zort-words.ts แล้วห่อด้วย zortWord(MAP, value).text')
  console.error('   ⚠️ เลือกชุดคำตาม **ชนิดจอ** (ตาราง / ตัวกรอง / จอรายละเอียด) และตามชนิดเอกสารของแถว')
  console.error('   ถ้าเป็นจอที่ไม่ได้มิเรอร์ ZORT ให้ใส่ไฟล์ + เหตุผลใน `ยกเว้นไฟล์` ของ scripts/check-zort-words.mjs')
  process.exit(1)
}
console.log('✅ ไม่มีค่าสถานะดิบหลุดขึ้นจอ')
