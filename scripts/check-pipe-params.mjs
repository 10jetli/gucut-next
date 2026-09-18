#!/usr/bin/env node
/* ด่านก่อน build: **จอส่งตัวกรองไปยังเส้นที่ไม่อ่านมัน** (ตัวกรองเงียบฝั่งจอ)
 *
 * 🔴 **ที่มา 18 ก.ย. 2569 · ใบงาน t_mu65jec4** — กวาดท่อหาตัวกรองเงียบแล้วเจอว่า
 *    ชื่อพารามิเตอร์เดียวกัน **มีอยู่ที่เส้นอื่น** ⇒ การเทียบระดับ repo บอกว่า "สะอาด" ทั้งที่ไม่สะอาด
 *    ของจริง: `type` มีที่เส้น `?quotation` แต่ `list=quotations` อ่านแค่ limit/page/store
 *    ⇒ ถ้าจอส่ง `type` ไปที่ `list=quotations` มันจะถูกเมินเงียบ ๆ **แถวที่เห็นคือชุดเดิมทั้งชุด**
 *    (โรคเดียวกับที่ท่อเคยเจ็บเองตอน `only=cod` หาย: จอโชว์แถวเหมือนแท็บ "ทั้งหมด" โดยดูปกติทุกประการ)
 *
 * 🔑 **ต้องตรวจทีละเส้น ไม่ใช่ทีละ repo** — นี่คือแก่นของด่านนี้
 *
 * ⚠️ ด่านนี้ตรวจได้เฉพาะ URL ที่เขียนตรง ๆ ในโค้ด (`/api/web/core?list=xxx&yyy=`)
 *    URL ที่ประกอบจากตัวแปรทีละชิ้นยังมองไม่เห็น ⇒ **ต้องกวาดด้วยมือเพิ่ม**
 *    เขียนไว้เพราะด่านที่ไม่บอกขอบเขตของตัวเอง จะถูกเชื่อเกินจริง
 * ⚠️ ไม่มี ../gucut-web ⇒ ข้ามแบบมีเสียง (พิมพ์ว่ายังไม่ได้ตรวจ) ไม่ใช่เงียบแล้วผ่าน
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PIPE = join(ROOT, '..', 'gucut-web')
const CORE = join(PIPE, 'netlify', 'functions', 'core.mjs')

/* พารามิเตอร์ที่ทุกเส้นรับได้ (ตัวจัดการกลางอ่านให้ก่อนแยกเส้น) */
const กลาง = new Set(['list', 'store', 'limit', 'offset', 'page', 'q'])

/** เส้นที่รู้แล้วว่าไม่อ่านค่านั้น **แต่จอส่งไปโดยมีเหตุผล** — ต้องเขียนเหตุผลทุกบรรทัด */
const ยกเว้น = {
  // ยังไม่มี — ถ้าจะใส่ ต้องเขียนว่าใครยืนยันว่าไม่เป็นไร และเพราะอะไร
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

if (!existsSync(CORE)) {
  console.log('⏭️  ข้ามด่านตัวกรอง: ไม่มี ../gucut-web/netlify/functions/core.mjs ⇒ **ยังไม่ได้ตรวจ**')
  process.exit(0)
}

/* ── แบ่งไฟล์ท่อเป็นบล็อกต่อเส้น ─────────────────────────────────
   หาจุดเริ่มของแต่ละเส้น แล้วถือว่าบล็อกจบตรงจุดเริ่มของเส้นถัดไป
   (หยาบแต่พอ — เราต้องการรู้แค่ว่า "ชื่อนี้ถูกอ่านในบริเวณของเส้นนี้ไหม") */
const src = readFileSync(CORE, 'utf8')
const จุดเริ่ม = []
for (const m of src.matchAll(/searchParams\.get\("list"\)\s*===\s*"(\w+)"/g)) จุดเริ่ม.push([m[1], m.index])
for (const m of src.matchAll(/searchParams\.(?:get|has)\("(\w+)"\)/g)) จุดเริ่ม.push([m[1], m.index])
จุดเริ่ม.sort((a, b) => a[1] - b[1])

/** ชื่อพารามิเตอร์ที่ถูกอ่านในบล็อกของเส้นนั้น */
function ที่เส้นอ่าน(เส้น) {
  const ชุด = new Set()
  for (let i = 0; i < จุดเริ่ม.length; i++) {
    if (จุดเริ่ม[i][0] !== เส้น) continue
    const จบ = i + 1 < จุดเริ่ม.length ? จุดเริ่ม[i + 1][1] : src.length
    /* เผื่อบล็อกยาว: อ่านต่อไปอีก 3,000 ตัวอักษรจากจุดเริ่ม ถ้าเส้นถัดไปอยู่ใกล้เกินไป
       (ตัวจัดการหลายเส้นเรียกฟังก์ชันแล้วส่งพารามิเตอร์ต่อในบรรทัดถัด ๆ ไป) */
    const เนื้อ = src.slice(จุดเริ่ม[i][1], Math.max(จบ, จุดเริ่ม[i][1] + 3000))
    for (const m of เนื้อ.matchAll(/\.get\(\s*"([^"]+)"/g)) ชุด.add(m[1])
  }
  return ชุด
}

const พบ = []
for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')), walk(join(ROOT, 'lib')))) {
  const rel = file.slice(ROOT.length).replace(/^\/+/, '')
  const s = readFileSync(file, 'utf8')
  for (const m of s.matchAll(/\/api\/web\/core\?list=(\w+)([^`'"\s)]*)/g)) {
    const เส้น = m[1]
    const อ่านได้ = ที่เส้นอ่าน(เส้น)
    if (!อ่านได้.size) continue          // ไม่รู้จักเส้นนี้ ⇒ ไม่ตัดสิน
    for (const คู่ of m[2].split('&')) {
      const ชื่อ = คู่.replace(/^&/, '').split('=')[0].trim()
      if (!ชื่อ || !/^[a-z][\w-]*$/i.test(ชื่อ)) continue
      if (กลาง.has(ชื่อ) || อ่านได้.has(ชื่อ)) continue
      const คีย์ = `${เส้น}.${ชื่อ}`
      if (ยกเว้น[คีย์]) continue
      พบ.push(`${rel}  ส่ง "${ชื่อ}" ไปที่ list=${เส้น} — เส้นนั้นไม่อ่านค่านี้`)
    }
  }
}

console.log(`ตรวจตัวกรองที่จอส่ง: เทียบทีละเส้นกับ core.mjs · ยกเว้นไว้ ${Object.keys(ยกเว้น).length} คู่`)
if (พบ.length) {
  console.error('\n🔴 จอส่งตัวกรองไปยังเส้นที่ไม่อ่านมัน — ตัวกรองจะถูกเมินเงียบ ๆ')
  for (const x of [...new Set(พบ)]) console.error('   ' + x)
  console.error('\n   ⚠️ อาการ: คนกดกรองแล้ว **แถวที่เห็นคือชุดเดิมทั้งชุด** ไม่มี error ไม่มีอะไรแดง')
  console.error('   วิธีแก้: เลิกส่งค่านั้น หรือขอให้ฝั่งท่ออ่านมัน (และสะท้อน applied/ignored กลับมา)')
  console.error('   ถ้าส่งไปโดยมีเหตุผล ให้ใส่ใน `ยกเว้น` พร้อมเหตุผลและคนที่ยืนยัน')
  process.exit(1)
}
console.log('✅ ไม่มีจอไหนส่งตัวกรองไปยังเส้นที่ไม่อ่านมัน')
