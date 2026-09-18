#!/usr/bin/env node
/* ด่านก่อน build: ลิงก์ที่ส่งพารามิเตอร์ข้ามจอ ปลายทางต้อง "อ่านค่านั้นจริง"
 *
 * 🔴 ที่มา — บั๊กคลาสนี้กัดสองครั้งแล้ว:
 *    · 8 ก.ย. 2569 เจ้าของร้านจับได้เองว่า "ปุ่มหมวดกดไม่ได้" ⇒ คราวนั้นแก้เฉพาะ `category`
 *    · 16 ก.ย. 2569 ผมไล่ตามลิงก์เองแล้วเจอว่า `?q=` **ถูกเมินทั้ง 5 จุด** (จอสินค้า 4 · จอรายการขาย 1)
 *      กด "ดูในจอคลังสินค้า" ของรหัสหนึ่ง ⇒ ได้รายการทั้งคลัง 2,666 ตัว ช่องค้นหาว่างเปล่า
 *      ⇒ ลิงก์ที่สัญญาว่าจะพาไปหาของ แต่ไม่พาไปถึง (คนใช้ต้องพิมพ์ค้นเองอีกรอบ)
 *
 * วิธีตรวจ: หา `href` ที่มี `?<คีย์>=` แล้วดูว่าไฟล์ของเส้นทางปลายทางมีการอ่านคีย์นั้นไหม
 *   (`sp.get('คีย์')` · `searchParams.get('คีย์')` · `URLSearchParams(window.location.search).get('คีย์')`)
 * ⚠️ ตัวนี้ตรวจได้แค่ "มีการอ่านค่า" ไม่ได้ตรวจว่า "เอาไปใช้ถูก" — ยังต้องกดดูด้วยตา
 *    (แต่จับกรณีที่ไม่อ่านเลย ซึ่งเป็นกรณีที่เกิดจริงทั้งสองครั้ง)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = new URL('..', import.meta.url).pathname
/** ลิงก์ที่ปลายทางยังไม่อ่านค่า แต่ตั้งใจ — ต้องมีเหตุผล */
const ยกเว้น = {
  // ตัวอย่างรูปแบบ: 'core/xxx?foo': 'เหตุผล'
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

/** หาไฟล์เพจของเส้นทาง — รองรับเส้นคงที่และเส้นที่มี [param] */
function pageFileOf(route) {
  const clean = route.replace(/^\/+/, '').replace(/\/+$/, '')
  const direct = join(ROOT, 'app', clean, 'page.tsx')
  if (existsSync(direct)) return direct
  /* เส้นที่มีตัวแปร เช่น /core/stock/00313 ⇒ app/core/stock/[sku]/page.tsx
     ไล่ถอยทีละชั้นแล้วมองหาโฟลเดอร์ [..] */
  const parts = clean.split('/')
  for (let i = parts.length; i > 0; i--) {
    const base = join(ROOT, 'app', ...parts.slice(0, i - 1))
    if (!existsSync(base)) continue
    const dyn = readdirSync(base).find((d) => d.startsWith('[') && existsSync(join(base, d, 'page.tsx')))
    if (dyn) return join(base, dyn, 'page.tsx')
  }
  return null
}

const พบ = []
let ตรวจไป = 0
/* 🔒 ไม่มีไฟล์ให้ตรวจ = ไม่ผ่าน (ดู scripts/lib/ต้องมีของให้ตรวจ.mjs) */
const ไฟล์ที่ตรวจ = walk(join(ROOT, 'app'))
ต้องมีของให้ตรวจ(ไฟล์ที่ตรวจ.length, 'check-link-params')
for (const file of ไฟล์ที่ตรวจ) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/href=\{?`?(\/[a-zA-Z0-9\-/_.$\[\]{}]+)\?([a-zA-Z_][\w]*)=/g)) {
    let [, route, key] = m
    if (route.includes('${') || route.includes('[')) {
      /* เส้นทางที่ประกอบจากตัวแปร — ตัดส่วนที่เป็นตัวแปรออกแล้วหาเพจจากส่วนคงที่ */
      route = route.split('${')[0].replace(/\/+$/, '')
    }
    const target = pageFileOf(route)
    if (!target) continue                       // ไม่ใช่เพจในโปรเจกต์นี้ (แคตตาล็อก static ฯลฯ)
    ตรวจไป++
    const เป้า = readFileSync(target, 'utf8')
    const อ่าน = new RegExp(`get\\(\\s*['"\`]${key}['"\`]\\s*\\)`).test(เป้า)
    const คีย์ยกเว้น = `${route.replace(/^\//, '')}?${key}`
    if (!อ่าน && !ยกเว้น[คีย์ยกเว้น]) {
      พบ.push(`${rel} → ${route}?${key}=  (ปลายทาง ${target.slice(ROOT.length)} ไม่ได้อ่าน '${key}')`)
    }
  }
}

console.log(`ตรวจลิงก์ที่ส่งพารามิเตอร์: ${ตรวจไป} จุด · ยกเว้นไว้ ${Object.keys(ยกเว้น).length}`)
if (พบ.length) {
  const uniq = Array.from(new Set(พบ))
  console.error('\n🔴 ลิงก์ส่งค่าไป แต่จอปลายทางไม่ได้อ่านค่านั้น ⇒ กดแล้วไม่ถึงของที่สัญญาไว้')
  for (const x of uniq) console.error('   ' + x)
  console.error('\n   วิธีแก้: ให้จอปลายทางอ่านค่าจาก URL (sp.get(…) หรือ URLSearchParams(window.location.search))')
  console.error('   ถ้าลิงก์นั้นตั้งใจไม่ให้ปลายทางอ่าน ให้ใส่เหตุผลใน `ยกเว้น` ของ scripts/check-link-params.mjs')
  process.exit(1)
}
console.log('✅ ทุกลิงก์ที่ส่งค่า ปลายทางอ่านค่านั้นจริง')
