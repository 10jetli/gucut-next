#!/usr/bin/env node
/* 🔐 เส้น API ที่ตรวจ DRIVESYNC_SECRET เอง ต้องอยู่ใน PUBLIC_PATHS ของ middleware — ไม่งั้นด่านล็อกอินตอบ 401 ก่อน
 *
 * ทำไมต้องมี (เกิดจริงสองครั้ง):
 *   · 8 ก.ย. 2569 — ยิงด้วย secret ถูกแต่ได้ 401 หน้าตาเหมือน secret ผิด (คอมเมนต์ใน middleware.ts เตือนไว้)
 *   · 17 ก.ย. 2569 — /api/bills/dupcheck (ใบบิลซ้ำ t_mu3g8tq5) ลืมเพิ่มอีก ⇒ ใบค้าง "รอคนมี secret ยิง" ทั้งที่ยิงยังไงก็ไม่ผ่าน
 *   คอมเมนต์เตือนไม่พอ ⇒ ให้ build ตกแทน
 *
 * กติกา: ไฟล์ app/api/**\/route.ts ที่ **เทียบค่ากับ process.env.DRIVESYNC_SECRET** ต้อง
 *   (ก) มี path อยู่ใน PUBLIC_PATHS หรือ
 *   (ข) มีคำ `ไม่เปิดสาธารณะโดยตั้งใจ:` พร้อมเหตุผล (ต้องล็อกอิน + secret สองชั้น)
 * ⚠️ แค่กล่าวถึง DRIVESYNC_SECRET ในคอมเมนต์ไม่นับ — ดูเฉพาะบรรทัดโค้ดที่อ่าน process.env.DRIVESYNC_SECRET
 * ทดสอบตัวตรวจเอง: node scripts/check-secret-routes.mjs --self-test
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

export function เส้นที่ใช้secret(files) {
  const out = []
  for (const [path, src] of files) {
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    if (!/process\.env\.DRIVESYNC_SECRET/.test(code)) continue
    const route = '/' + path.replace(/^app\//, '').replace(/\/route\.tsx?$/, '')
    out.push({ route, ตั้งใจ: /ไม่เปิดสาธารณะโดยตั้งใจ:/.test(src) })
  }
  return out
}

export function ตรวจ(middlewareSrc, files) {
  const m = middlewareSrc.match(/const PUBLIC_PATHS = \[([^\]]*)\]/)
  if (!m) return { ผิด: ['อ่าน PUBLIC_PATHS ใน middleware.ts ไม่ออก — ตัวตรวจเองพัง'] }
  const pub = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  const ผิด = []
  for (const r of เส้นที่ใช้secret(files)) {
    if (r.ตั้งใจ) continue
    if (!pub.some((p) => r.route === p || r.route.startsWith(p + '/') || r.route.startsWith(p))) {
      ผิด.push(`${r.route} ตรวจ DRIVESYNC_SECRET เอง แต่ไม่อยู่ใน PUBLIC_PATHS ⇒ คนมี secret ได้ 401 จากด่านล็อกอิน`)
    }
  }
  return { ผิด, จำนวน: เส้นที่ใช้secret(files).length }
}

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/^route\.tsx?$/.test(n)) acc.push(p)
  }
  return acc
}

if (process.argv.includes('--self-test')) {
  const mw = "const PUBLIC_PATHS = ['/login', '/api/bills/drivesync']"
  const ok = ตรวจ(mw, [['app/api/bills/drivesync/route.ts', 'if (s !== process.env.DRIVESYNC_SECRET) x']])
  const bad = ตรวจ(mw, [['app/api/bills/dupcheck/route.ts', 'const required = process.env.DRIVESYNC_SECRET']])
  const cmt = ตรวจ(mw, [['app/api/bills/status/route.ts', '// ต่างจาก report ที่ใช้ DRIVESYNC_SECRET']])
  const intent = ตรวจ(mw, [['app/api/bills/fixmonth/route.ts', '// ไม่เปิดสาธารณะโดยตั้งใจ: เขียนข้อมูล\nconst r = process.env.DRIVESYNC_SECRET']])
  const pass = ok.ผิด.length === 0 && bad.ผิด.length === 1 && cmt.ผิด.length === 0 && cmt.จำนวน === 0 && intent.ผิด.length === 0
  console.log(pass ? '✅ self-test ผ่าน (ถูก/ลืมเพิ่ม/แค่คอมเมนต์/ตั้งใจปิด)' : '🔴 self-test ไม่ผ่าน', JSON.stringify({ ok, bad, cmt, intent }))
  process.exit(pass ? 0 : 1)
}

const files = walk(join(ROOT, 'app/api')).map((p) => [relative(ROOT, p), readFileSync(p, 'utf8')])
const r = ตรวจ(readFileSync(join(ROOT, 'middleware.ts'), 'utf8'), files)
console.log(`ตรวจเส้นที่ใช้ DRIVESYNC_SECRET: ${r.จำนวน ?? 0} เส้น`)
if (r.ผิด.length) {
  for (const x of r.ผิด) console.log('  🔴', x)
  process.exit(1)
}
