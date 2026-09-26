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
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'
import { ตัดคอมเมนต์ } from './lib/ตัดคอมเมนต์.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

export function เส้นที่ใช้secret(files) {
  const out = []
  for (const [path, src] of files) {
    /* 🔴 19 ก.ย. 2569 (งาน S2): ตัวกรองเดิมข้ามเฉพาะบรรทัดที่ **ขึ้นต้น** ด้วยคอมเมนต์
       ⇒ คอมเมนต์ **ท้ายบรรทัด** ที่มีคำว่า process.env.DRIVESYNC_SECRET ยังถูกนับเป็นโค้ด
       ⇒ เส้นที่ไม่เคยตรวจ secret เลย จะถูกจัดว่า "ตรวจเอง" แล้วด่านไปบังคับให้ใส่ใน PUBLIC_PATHS
          = **เปิดเส้นออกจากกำแพงล็อกอินเพราะคอมเมนต์** ⇒ ผิดทิศที่อันตรายที่สุดของด่านนี้
       ⚠️ แต่ `ไม่เปิดสาธารณะโดยตั้งใจ:` ข้างล่าง **ตั้งใจให้เป็นคอมเมนต์** ⇒ อ่านจาก src ดิบต่อไป */
    const code = ตัดคอมเมนต์(src)
    if (!/process\.env\.DRIVESYNC_SECRET/.test(code)) continue
    /* 🔴 **ขยายขอบเขต 26 ก.ย. 2569 — รีโปนี้มีโค้ดที่รันจริง *สองกอง* ไม่ใช่กองเดียว**
       เดิมกวาดแค่ `app/api/**\/route.ts` ⇒ ไฟล์ใน `netlify/functions/` ที่ตรวจ
       `DRIVESYNC_SECRET` เอง **ไม่เคยถูกตรวจเลย** (ของจริงที่หลุด: shelf-ask · shelf-report)
       ⇒ ⇒ คลาสเดียวกับ `check-floating` ที่ ROOTS แคบ — **ครั้งที่สองในวันเดียว**
       🔑 คำถามที่ควรถามด่านทุกตัว: *มันกวาดโฟลเดอร์ไหน และรีโปนี้มีโค้ดที่รันจริงอยู่โฟลเดอร์ไหน* */
    const route = /^netlify\/functions\//.test(path)
      ? '/.netlify/functions/' + path.replace(/^netlify\/functions\//, '').replace(/\.(mjs|cjs|js|ts)$/, '')
      : '/' + path.replace(/^app\//, '').replace(/\/route\.tsx?$/, '')
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

function walk(dir, รูปไฟล์, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, รูปไฟล์, acc)
    else if (รูปไฟล์.test(n)) acc.push(p)
  }
  return acc
}

/** สองกองที่รันจริงในรีโปนี้ — เพิ่มกองใหม่ที่นี่ที่เดียว
 *  ⚠️ เพิ่มกองแล้วต้องเพิ่มการแปลงพาธใน `เส้นที่ใช้secret()` ด้วย ไม่งั้นจะได้ route ที่ผิด */
const กองที่รันจริง = [
  { โฟลเดอร์: 'app/api', รูปไฟล์: /^route\.tsx?$/ },
  { โฟลเดอร์: 'netlify/functions', รูปไฟล์: /\.(mjs|cjs|js)$/ },
]

/* 🔑 **รันตัวหลักเฉพาะตอนถูกเรียกตรง ๆ** (20 ก.ย. 2569)
   เดิมไฟล์นี้ลงมือกวาด `app/api` ทันทีที่ถูก `import` ⇒ เทสแยกไฟล์เอาฟังก์ชันไปใช้ไม่ได้
   (มันจะกวาดของจริงแล้วอาจ `process.exit` ทับผลของเทส)
   ⇒ ⇒ **โครงสร้างที่ทดสอบยาก ทำให้ไม่มีใครเขียนเทส** — ไม่ใช่เพราะไม่มีใครอยากเขียน */
const เป็นตัวหลัก = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (เป็นตัวหลัก && process.argv.includes('--self-test')) {
  const mw = "const PUBLIC_PATHS = ['/login', '/api/bills/drivesync']"
  const ok = ตรวจ(mw, [['app/api/bills/drivesync/route.ts', 'if (s !== process.env.DRIVESYNC_SECRET) x']])
  const bad = ตรวจ(mw, [['app/api/bills/dupcheck/route.ts', 'const required = process.env.DRIVESYNC_SECRET']])
  const cmt = ตรวจ(mw, [['app/api/bills/status/route.ts', '// ต่างจาก report ที่ใช้ DRIVESYNC_SECRET']])
  const intent = ตรวจ(mw, [['app/api/bills/fixmonth/route.ts', '// ไม่เปิดสาธารณะโดยตั้งใจ: เขียนข้อมูล\nconst r = process.env.DRIVESYNC_SECRET']])
  /* เคสของกอง netlify/functions (เพิ่ม 26 ก.ย. 2569 พร้อมการขยายขอบเขต)
     ⚠️ ต้องมีทั้ง **ควรจับ** และ **ต้องไม่จับ** ไม่งั้นมองไม่เห็นตะแกรงที่กว้างเกิน */
  const nfBad = ตรวจ(mw, [['netlify/functions/shelf-report.mjs', 'if (q !== process.env.DRIVESYNC_SECRET) x']])
  const nfOk = ตรวจ("const PUBLIC_PATHS = ['/.netlify/functions/shelf-report']",
    [['netlify/functions/shelf-report.mjs', 'if (q !== process.env.DRIVESYNC_SECRET) x']])
  const nfIntent = ตรวจ(mw, [['netlify/functions/shelf-ask.mjs',
    '// ไม่เปิดสาธารณะโดยตั้งใจ: ตัวตั้งเวลาเรียกภายใน\nif (q !== process.env.DRIVESYNC_SECRET) x']])
  const nfเฉยๆ = ตรวจ(mw, [['netlify/functions/lib-notify.mjs', 'const a = 1']])
  const nfPass = nfBad.ผิด.length === 1 && nfBad.ผิด[0].includes('/.netlify/functions/shelf-report')
    && nfOk.ผิด.length === 0 && nfIntent.ผิด.length === 0 && nfเฉยๆ.จำนวน === 0
  const pass = nfPass && ok.ผิด.length === 0 && bad.ผิด.length === 1 && cmt.ผิด.length === 0 && cmt.จำนวน === 0 && intent.ผิด.length === 0
  console.log(pass ? '✅ self-test ผ่าน (ถูก/ลืมเพิ่ม/แค่คอมเมนต์/ตั้งใจปิด + กอง netlify 4 เคส)' : '🔴 self-test ไม่ผ่าน', JSON.stringify({ ok, bad, cmt, intent }))
  process.exit(pass ? 0 : 1)
}

if (เป็นตัวหลัก) {
  const files = []
  const นับกอง = []
  for (const { โฟลเดอร์, รูปไฟล์ } of กองที่รันจริง) {
    let ของกอง = []
    try { ของกอง = walk(join(ROOT, โฟลเดอร์), รูปไฟล์) } catch { ของกอง = [] }
    นับกอง.push(`${โฟลเดอร์} ${ของกอง.length} ไฟล์`)
    for (const p of ของกอง) files.push([relative(ROOT, p), readFileSync(p, 'utf8')])
  }
  const r = ตรวจ(readFileSync(join(ROOT, 'middleware.ts'), 'utf8'), files)
  /* 🔑 พิมพ์ขอบเขตที่กวาดทุกรอบ — ไม่ใช่แค่จำนวนที่เจอ
     เพราะ "เจอ 2 เส้น" กับ "เจอ 2 เส้นจากที่กวาด 2 กอง" เป็นประโยคคนละอัน
     (บทเรียนวันนี้: ผมรายงานจำนวนโดยไม่บอกขอบเขต แล้วมันไม่ครบ) */
  console.log(`ขอบเขตที่กวาด: ${นับกอง.join(' · ')}`)
  console.log(`ตรวจเส้นที่ใช้ DRIVESYNC_SECRET: ${r.จำนวน ?? 0} เส้น`)
  if (r.ผิด.length) {
    for (const x of r.ผิด) console.log('  🔴', x)
    process.exit(1)
  }
}
