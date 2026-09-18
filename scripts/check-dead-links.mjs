#!/usr/bin/env node
/* ด่านก่อน build: ลิงก์ภายในต้องชี้ไปหน้าที่มีอยู่จริง
 *
 * 🔴 ที่มา 18 ก.ย. 2569 (งานยืน "ZORT 100% — ห้ามมีปุ่มหลอก")
 *    ปุ่มหลอกที่จับง่ายที่สุดคือปุ่มที่ไม่มี onClick — กวาดแล้ว **ไม่เจอสักอัน**
 *    แต่ยังมีอีกทรงที่จับด้วยตาไม่ได้เลย: **ลิงก์ที่ชี้ไปหน้าที่ไม่มีอยู่**
 *    กดแล้วได้ 404 (หรือเด้งหน้าล็อกอินเพราะ middleware ทำงานก่อน routing
 *    ⇒ ยิ่งดูเหมือนปกติ · ดูหัวข้อ "สองวิธีที่ห้ามใช้" ใน CLAUDE.md)
 *    ⚠️ เรามี 118 หน้า + 48 เส้นท่อ · เปลี่ยนชื่อโฟลเดอร์ทีเดียวลิงก์ตายเงียบทันที
 *
 * ปลูกบั๊กพิสูจน์แล้ว: เปลี่ยน href ของปุ่ม "สร้างใบขาย" เป็นหน้าที่ไม่มี ⇒ ด่านร้องชี้บรรทัดถูก
 *
 * ขอบเขตที่ตั้งใจไม่ตรวจ (เขียนไว้ไม่ให้คนรุ่นหลังเข้าใจว่าครอบคลุมกว่าจริง):
 *   · `/api/...` — เส้นท่อ มีด่านของตัวเอง (check-pipe-params)
 *   · `/catalog/...` — เว็บ static คนละระบบ ห้ามแตะ
 *   · ลิงก์ที่ประกอบจากตัวแปร (`href={detailHref(id)}`) — ด่านนี้อ่านได้แต่สตริงตรง ๆ
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const R = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
function walk(d, ext, out = []) {
  let names
  try { names = readdirSync(d) } catch { return out }
  for (const n of names) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') walk(p, ext, out) }
    else if (n.endsWith(ext)) out.push(p)
  }
  return out
}

const routes = walk(join(R, 'app'), 'page.tsx').map((p) => p.slice((R + '/app').length).replace(/\/page\.tsx$/, '') || '/')
const apis = walk(join(R, 'app'), 'route.ts').map((p) => p.slice((R + '/app').length).replace(/\/route\.ts$/, '') || '/')

/* [param] = ส่วนเดียว · [...path] = กี่ส่วนก็ได้ */
const matchers = [...routes, ...apis].map(
  (r) => new RegExp('^' + r.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '$')
)
const มีจริง = (p) => matchers.some((m) => m.test(p))

/* 🔴 ไม่มีหน้าเลย = อ่านโครงไม่ออก ⇒ ห้ามผ่านเงียบ (ด่านที่ตรวจศูนย์ไฟล์แล้วบอกผ่าน คือด่านเขียวตลอด) */
if (routes.length === 0) {
  console.error('🔴 อ่านรายชื่อหน้าไม่ได้เลย — ด่านนี้ตรวจอะไรไม่ได้ ถือว่าไม่ผ่าน')
  process.exit(1)
}

const พบ = new Set()
for (const f of [...walk(join(R, 'app'), '.tsx'), ...walk(join(R, 'components'), '.tsx'), ...walk(join(R, 'lib'), '.ts')]) {
  const rel = f.slice(R.length + 1)
  const s = readFileSync(f, 'utf8')
  const re = /href(?:=|:\s*)["'](\/[^"'#?]*)/g
  let m
  while ((m = re.exec(s))) {
    const p = m[1].replace(/\/$/, '') || '/'
    if (p.startsWith('/api/') || p.startsWith('/catalog')) continue
    if (/\.(png|jpg|jpeg|svg|ico|webmanifest|txt|xml|json|pdf|css|js)$/.test(p)) continue
    if (มีจริง(p)) continue
    พบ.add(`${rel}:${s.slice(0, m.index).split('\n').length}  ${p}`)
  }
}

console.log(`ตรวจลิงก์ภายใน: หน้า ${routes.length} · เส้นท่อ ${apis.length}`)
if (พบ.size) {
  console.error('\n🔴 มีลิงก์ที่ชี้ไปหน้าที่ไม่มีอยู่จริง — กดแล้วคนใช้จะเจอ 404 หรือถูกเด้งไปหน้าล็อกอิน')
  for (const x of [...พบ].sort()) console.error('   ' + x)
  console.error('\n   วิธีแก้: สร้างหน้านั้น หรือแก้ href ให้ตรงกับเส้นทางจริง')
  process.exit(1)
}
console.log('✅ ทุกลิงก์ภายในชี้ไปหน้าที่มีอยู่จริง')
