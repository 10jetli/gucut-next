#!/usr/bin/env node
/* ด่านก่อน build: **จออ่านชื่อช่องที่ท่อไม่เคยส่งมา**
 *
 * 🔴 **ที่มา 18 ก.ย. 2569 — การ์ดแบนด์วิดท์ที่จอ `/core/usage`**
 *    จอเขียน `d.bandwidth.used` · `included` · `period`
 *    ท่อส่ง `usedGB` · `includedGB` · `periodStart` · `periodEnd`
 *    ⇒ **ไม่ตรงกันเลยสักช่อง** และเพราะโค้ดเขียนว่า `Number(...) || 0`
 *      จอจึงพิมพ์ว่า **"ใช้ไป 0"** มาตลอด ทั้งที่แปลว่า "ยังไม่รู้"
 *    ⇒ วันที่โควตาหมดจริงจนเว็บล่ม จอที่ควรเตือนเรื่องนี้ก็ยังขึ้น 0
 *
 * 🔑 **ทำไมชนิดข้อมูลของ TypeScript จับไม่ได้**: ค่ามาจาก JSON ของท่อซึ่งไม่มีชนิดจริง
 *    เราเขียน interface เอง ⇒ เขียนผิดก็ยังคอมไพล์ผ่าน · นี่คือช่องว่างที่ด่านนี้ปิด
 *
 * 🕳️ **จุดบอดที่รู้ตัว: ชื่อช่องภาษาไทยด่านนี้มองไม่เห็น**
 *    ตัวจับชื่อช่องรับเฉพาะ `[A-Za-z_]` ⇒ ช่องอย่าง `แก่สุดกี่วัน` · `ไม่มีวันที่` (ท่อส่งจริง)
 *    จะถูกข้ามทั้งหมด ⇒ **ต้องตรวจด้วยมือ** ตอนรับช่องไทยใหม่จากท่อ
 *    (วิธีตรวจเร็ว: `grep -o "ชื่อช่อง" ../gucut-web/netlify/functions/core.mjs | sort | uniq -c`)
 *    เขียนไว้ตรงนี้เพราะ **ด่านที่ไม่บอกขอบเขตของตัวเอง จะถูกเชื่อเกินจริง**
 *
 * ⚠️ **ด่านนี้เป็นตัวชี้เป้า ไม่ใช่ตัวตัดสิน** — ถ้าชื่อช่องถูกประกอบขึ้นฝั่งจอเอง
 *    หรือมาจากเส้นอื่นที่ไม่ใช่ท่อ ให้ใส่ใน `ยกเว้น` **พร้อมเหตุผลที่ตรวจแล้ว**
 *
 * ⚠️ **ต้องข้ามอย่างมีเสียง เมื่อไม่มีซอร์สท่อในเครื่อง** (เช่นตอน Netlify build)
 *    ห้ามเงียบแล้วผ่าน เพราะจะแยกไม่ออกระหว่าง "ตรวจแล้วไม่เจอ" กับ "ไม่ได้ตรวจ"
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PIPE = join(ROOT, '..', 'gucut-web')

/* ช่องที่จอ "สร้างเอง" หรือมาจากที่อื่น ไม่ใช่ชื่อช่องจากท่อ — ตรวจแล้วทีละอัน 18 ก.ย. 2569 */
const ยกเว้น = {
  'Report.topProducts': 'app/sales: จอประกอบเองจากแถวที่ท่อส่งมา (ดู bestRows.map)',
  'Report.topError': 'app/sales: ข้อความที่จอเขียนเองเมื่อยิงท่อสินค้าขายดีไม่สำเร็จ',
  'Report.returnsError': 'app/sales: ข้อความที่จอเขียนเองเมื่อดึงใบคืนไม่สำเร็จ',
  'Data.marketplaceCounts': 'app/core/marketplace: ท่อยังไม่มีตัวนับนี้ · จอคืน null และขึ้น "—" ถูกแล้ว (ตรวจ 18 ก.ย. 2569)',
  'Resp.registry': 'app/core/settings-company: ท่อไม่มีช่องนี้ ⇒ ส่วนนั้นไม่เคยขึ้นจอ — เขียนกำกับไว้ในไฟล์แล้ว',
  'Job.howToTell': 'app/core/settings-jobs: ตารางงานคัดมือในไฟล์จอเอง ไม่ได้มาจากท่อ',
  'Job.ifDead': 'app/core/settings-jobs: เหตุผลเดียวกับ Job.howToTell',
  'Report.prevSales': 'app/sales: จอคำนวณเองจากยอดช่วงก่อนหน้า (ดู prev.amount)',
  'Report.prevOrders': 'app/sales: จอคำนวณเองจากยอดช่วงก่อนหน้า (ดู prev.total)',
  'Bill.vendorId': 'app/core/finance: ก้อน Bill มาจาก /api/bills ของ Next ไม่ใช่ท่อ core',
  'Bill.vendorName': 'app/core/finance: เหตุผลเดียวกับ Bill.vendorId',
  'Bill.subject': 'app/core/finance: เหตุผลเดียวกับ Bill.vendorId',
  'MemberResp.collectedDayTH': 'app/core/stock/[sku]: **จอเตรียมรับล่วงหน้า** — ท่อยังไม่ส่ง จอจึงแปลงเองไปพลางก่อน และจะใช้ค่าท่อทันทีที่มา (18 ก.ย. 2569)',
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

if (!existsSync(PIPE)) {
  /* 🔴 ไม่มีซอร์สท่อ = **ยังไม่ได้ตรวจ** ไม่ใช่ "ผ่าน" — ต้องพิมพ์ให้เห็นชัด */
  console.log('⏭️  ข้ามด่านคีย์ท่อ: ไม่มี ../gucut-web ในเครื่องนี้ ⇒ **ยังไม่ได้ตรวจ** (ไม่ใช่ตรวจแล้วผ่าน)')
  process.exit(0)
}

/* อ่านซอร์สท่อให้ครบทุกนามสกุล — รอบแรกที่เขียนสคริปต์นี้อ่านแต่ .mjs
   แล้วได้ 4 ช่องของจอข้อมูลบริษัทมาเป็น "ไม่มีในท่อ" ทั้งที่แหล่งจริงอยู่ใน src/lib/shop.ts
   ⇒ ตัวตรวจที่ส่องไม่ครบ จะรายงาน "ไม่มี" แทน "หาไม่เจอ" ซึ่งเป็นคลาสเดียวกับบั๊กที่ด่านนี้ไล่จับ */
let ข้อความท่อ = ''
for (const base of ['netlify', 'src', 'scripts']) {
  const dir = join(PIPE, base)
  if (!existsSync(dir)) continue
  const กอง = []
  const เดิน = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (name === 'node_modules') continue
      const st = statSync(p)
      if (st.isDirectory()) เดิน(p)
      else if (/\.(mjs|js|ts|tsx|json)$/.test(name)) กอง.push(p)
    }
  }
  เดิน(dir)
  for (const f of กอง) ข้อความท่อ += '\n' + readFileSync(f, 'utf8')
}

/* 🔴 **ห้ามใช้ regex หาปีกกาปิด** — `interface Line { a: string }` ที่อยู่บรรทัดเดียว
   จะทำให้ตัวอ่านวิ่งเลยไปจบที่ `\n}` ของบล็อกถัดไป แล้วกินโค้ดที่ไม่เกี่ยวเข้ามาเป็น "ช่อง"
   (เจอจริงตอนรันครั้งแรก: ได้ `Line.BLANK` มาจาก `const BLANK: Line = {...}` ที่อยู่บรรทัดล่าง)
   ⇒ นับปีกกาเอาเองแทน */
function อ่านinterface(src) {
  const out = []
  const re = /interface\s+(\w+)\s*\{/g
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length
    let ลึก = 1
    while (i < src.length && ลึก > 0) {
      if (src[i] === '{') ลึก++
      else if (src[i] === '}') ลึก--
      i++
    }
    out.push([m[1], src.slice(m.index + m[0].length, i - 1)])
  }
  return out
}
/* 🔴 **ต้องจับช่องที่ซ้อนอยู่ในบรรทัดเดียวด้วย** — ด่านรุ่นแรกของผมเองอ่านเฉพาะชื่อที่ขึ้นต้นบรรทัด
   ⇒ ปลูกบั๊กเดิมกลับเข้าไป (`bandwidth?: { usedBW?: number }`) แล้ว **ด่านยังเขียว**
   ทั้งที่บั๊กจริงของวันนี้อยู่ในช่องซ้อนพอดี ⇒ ด่านที่ไม่เคยเห็นของจริงพัง ไม่นับว่าใช้ได้
   ⚠️ ต้องตัดคอมเมนต์ทิ้งก่อน ไม่งั้นคำอังกฤษหน้าเครื่องหมาย : ในคอมเมนต์ (เช่น ชื่อไฟล์) จะถูกนับเป็นชื่อช่อง */
const fieldRe = /([A-Za-z_]\w*)\??\s*:/g
const ตัดคอมเมนต์ = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

const พบ = []
for (const file of walk(join(ROOT, 'app'))) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  const src = readFileSync(file, 'utf8')
  /* ตรวจเฉพาะจอที่คุยกับท่อจริง ๆ */
  if (!src.includes('/api/web/core') && !src.includes('coreJson')) continue
  for (const [ชื่อ, เนื้อ] of อ่านinterface(src)) {
    for (const [, ช่อง] of ตัดคอมเมนต์(เนื้อ).matchAll(fieldRe)) {
      if (ช่อง.length < 4) continue              // ชื่อสั้นมากเสี่ยงชนคำทั่วไป
      const คีย์ = `${ชื่อ}.${ช่อง}`
      if (ยกเว้น[คีย์]) continue
      if (new RegExp('\\b' + ช่อง + '\\b').test(ข้อความท่อ)) continue
      พบ.push(`${rel}  ${คีย์}`)
    }
  }
}

console.log(`ตรวจคีย์ที่จออ่านจากท่อ: เทียบกับซอร์ส ../gucut-web · ยกเว้นไว้ ${Object.keys(ยกเว้น).length} ช่อง`)
if (พบ.length) {
  console.error('\n🔴 จออ่านชื่อช่องที่ไม่มีในซอร์สท่อเลย — ค่าจะเป็น undefined เงียบ ๆ')
  for (const x of พบ) console.error('   ' + x)
  console.error('\n   ⚠️ undefined ที่ถูกเขียนว่า `Number(x) || 0` จะกลายเป็น **0 ที่ดูเหมือนค่าจริง**')
  console.error('   วิธีแก้: เทียบชื่อช่องกับที่ท่อส่งจริง หรือถ้าจอสร้างค่าเอง ให้ใส่ใน `ยกเว้น` พร้อมเหตุผลที่ตรวจแล้ว')
  process.exit(1)
}
console.log('✅ ทุกชื่อช่องที่จออ่าน มีอยู่ในซอร์สท่อจริง')
