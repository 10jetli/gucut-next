#!/usr/bin/env node
/* ด่านก่อน build: สวิตช์ "ปุ่มส่งจริง" ต้องอ่านจาก `lib/real-send.ts` ที่เดียว
 *
 * 🔴 ที่มา (19 ก.ย. 2569 · ใบ S4) — `const REAL_SEND_ENABLED = true/false` เคยกระจาย **12 ไฟล์**
 *    ค่านั้นไม่ใช่ค่าคงที่ของโค้ด แต่คือ **สถานะการอนุมัติของท่านประธาน** = ของนอกโค้ด
 *    ⇒ `app/core/purchases/page.tsx` เขียนว่าจอสร้างใบซื้อ "ยังปิดอยู่" ทั้งที่เปิดตั้งแต่ 14 ก.ย.
 *       **เป็นเท็จมา 5 วันโดยไม่มีอะไรฟ้อง** เพราะข้อความไม่ได้ผูกกับสวิตช์จริง
 *
 * 🔑 ด่านนี้ตรวจสองอย่าง — ข้อ ② สำคัญกว่าข้อ ①
 *    ① ห้ามเขียนค่าตาย (`= true` / `= false`) นอกไฟล์ทะเบียน
 *    ② **ทุกจอที่ยังมีสวิตช์ ต้องมีคีย์อยู่ในทะเบียนจริง** — ไม่งั้นจะได้ `false` เงียบ ๆ
 *       จากตัวสำรอง `?? false` แล้วปุ่มที่เคยเปิดจะปิดไปโดยไม่มีใครรู้
 *       (ทางที่ผิดของข้อนี้คือ "ปุ่มหาย" ซึ่งเงียบกว่า "ปุ่มเปิดเกิน" มาก)
 *
 * 🧪 ทดสอบว่าด่านร้องได้จริง: `node scripts/check-real-send-registry.mjs --self-test`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ทะเบียนไฟล์ = 'lib/real-send.ts'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

const ทะเบียน = readFileSync(join(ROOT, ทะเบียนไฟล์), 'utf8')
const คีย์ในทะเบียน = new Set([...ทะเบียน.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]))

function ตรวจ({ ปลูกบั๊ก = false } = {}) {
  const ผิด = []
  for (const file of walk(join(ROOT, 'app'))) {
    const rel = file.slice(ROOT.length).replace(/^\/+/, '')
    let t = readFileSync(file, 'utf8')
    if (ปลูกบั๊ก && rel === 'app/core/customers/new/page.tsx') {
      t = t.replace(/const REAL_SEND_ENABLED = ส่งจริงได้\([^)]*\)/, 'const REAL_SEND_ENABLED = true')
    }
    const ค่าตาย = t.match(/^const REAL_SEND_ENABLED\s*=\s*(true|false)\s*$/m)
    if (ค่าตาย) {
      ผิด.push(`${rel}  🔴 เขียนค่าตาย \`= ${ค่าตาย[1]}\` — ต้องใช้ ส่งจริงได้('<คีย์>') จาก ${ทะเบียนไฟล์}`)
      continue
    }
    const เรียก = t.match(/const REAL_SEND_ENABLED\s*=\s*ส่งจริงได้\('([^']+)'\)/)
    if (เรียก && !คีย์ในทะเบียน.has(เรียก[1])) {
      ผิด.push(`${rel}  🔴 ถามคีย์ "${เรียก[1]}" ซึ่ง**ไม่มีในทะเบียน** ⇒ จะได้ false เงียบ ๆ ปุ่มจะหายไปโดยไม่มีใครรู้`)
    }
  }
  return ผิด
}

if (process.argv.includes('--self-test')) {
  const ร้อง = ตรวจ({ ปลูกบั๊ก: true })
  const จับได้ = ร้อง.some((x) => x.includes('customers/new') && x.includes('ค่าตาย'))
  console.log(จับได้
    ? '🧪 self-test ผ่าน — ปลูกค่าตายแล้วด่านร้องจริง'
    : '🛑 self-test ตก — ปลูกบั๊กแล้วด่านเงียบ ⇒ ด่านนี้เชื่อไม่ได้')
  process.exit(จับได้ ? 0 : 1)
}

const ผิด = ตรวจ()
if (ผิด.length) {
  console.log('\n🛑 สวิตช์ปุ่มส่งจริงต้องมาจากทะเบียนที่เดียว\n')
  for (const x of ผิด) console.log('  ', x)
  console.log(`\n   เหตุผล: ค่านี้คือสถานะการอนุมัติของท่านประธาน ไม่ใช่ค่าคงที่ของโค้ด`)
  console.log(`   เขียนซ้ำหลายที่ = วันหนึ่งจะขัดกันเอง แล้วจอจะพูดเท็จโดยไม่มีอะไรฟ้อง\n`)
  process.exit(1)
}
console.log(`✅ สวิตช์ปุ่มส่งจริงอ่านจาก ${ทะเบียนไฟล์} ที่เดียว · คีย์ในทะเบียน ${คีย์ในทะเบียน.size} จอ`)
