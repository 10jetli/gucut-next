/* หมุดตัวเลขที่ **ต้องยิงของจริงถึงจะวัดได้** — 🚫 ไม่อยู่ใน prebuild
 * (19 ก.ย. 2569 · ใบ S4 · ยกโครงชั้นจากฝั่งท่อ)
 *
 * 🔑 **ทำไมต้องแยกเป็นอีกไฟล์ ไม่ใช่รวมกับหมุดใน prebuild**
 *   หมุดบางตัววัดด้วยคำสั่งในเครื่องได้ (นับไฟล์ · อ่าน middleware) ⇒ อยู่ใน prebuild ได้
 *   หมุดบางตัว **ต้องยิงเว็บจริง** (เส้นนี้ปฏิเสธคนไม่มีกุญแจจริงไหม) ⇒ วัดในเครื่องไม่ได้เลย
 *   ⇒ prebuild รัน **บ่อยกว่า deploy หลายเท่า** ⇒ ยิงเน็ตตอน build = กินเวลาฟังก์ชัน = กินเครดิต
 *   🔑 ฝั่งท่อสรุปข้อนี้ให้คมกว่าที่ผมคิด:
 *      **ข้อจำกัด "วัดในเครื่องไม่ได้" ไม่ใช่เหตุผลให้เลิกติดหมุด
 *        เป็นเหตุผลให้ถามว่าหมุดนี้ควรอยู่ชั้นไหน**
 *
 * รูปหมุด:  วัดได้ยิงจริง(<สิ่งที่นับ>)=<เลข>
 * วิธีใช้:   node scripts/หมุดที่ต้องยิงจริง.mjs        (รันหลัง deploy หรือเรียกมือ)
 *
 * ⚠️ **ยังไม่ได้ผูกกับรอบ deploy อัตโนมัติ** — ตอนนี้ต้องเรียกมือ
 *    เพราะ Netlify build ถูกปิดอยู่ (ท่านประธานสั่ง 19 ก.ย. 2569) ⇒ ไม่มีรอบ deploy ให้ผูก
 *    ⇒ เขียนไว้ตรง ๆ ว่ายังขาดขั้นนี้ **ห้ามอ่านว่าครบวง**
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ฐาน = process.env.GUCUT_SCREEN_BASE || 'https://admin.gucut.com'

/** เส้นจริงใต้คำนำหน้าใน PUBLIC_PATHS — กางก่อนนับ (จำนวนรายการ ≠ จำนวนเส้น) */
function เส้นจริง() {
  const m = readFileSync(join(ROOT, 'middleware.ts'), 'utf8').match(/const PUBLIC_PATHS = \[([\s\S]*?)\]/)
  const รายการ = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
  const out = new Set()
  const เดิน = (d, ฐานURL) => {
    let e
    try { e = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const x of e) {
      if (x.name.startsWith('.')) continue
      const p = join(d, x.name)
      if (x.isDirectory()) เดิน(p, ฐานURL + '/' + x.name)
      else if (/^route\.tsx?$/.test(x.name)) out.add(ฐานURL)
    }
  }
  for (const p of รายการ) {
    const ก่อน = out.size
    เดิน(join(ROOT, 'app' + p), p)
    if (out.size === ก่อน) out.add(p)     // ไม่มีลูก ⇒ นับตัวมันเอง
  }
  return [...out]
}

/** ทะเบียนวิธีวัด — **ยิงของจริงเท่านั้น** · 🚫 หมุดที่ไม่มีคีย์ในนี้ ⇒ ตก */
const วิธีวัด = {
  'เส้นสาธารณะที่ปฏิเสธคนไม่มีกุญแจ': async () => {
    /* เปิดโดยชอบธรรม — ชุดเดียวกับที่ `ยิงเส้นสาธารณะไม่มีกุญแจ.mjs` ยกเว้นไว้
       ⚠️ เลขเกณฑ์อยู่สองที่ ⇒ รู้ตัวว่าเป็นหนี้ · จดไว้ ยังไม่รวบเพราะรูปคนละแบบ */
    const ชอบธรรม = ['/login', '/api/auth', '/api/google', '/api/rokid/v1/models', '/api/rokid/v1/chat/completions']
    let ปฏิเสธ = 0
    for (const u of เส้นจริง()) {
      if (ชอบธรรม.some((k) => u === k || u.startsWith(k + '/'))) continue
      try {
        const r = await fetch(ฐาน.replace(/\/+$/, '') + u, { method: 'GET', redirect: 'manual' })
        if (r.status === 401 || r.status === 403) ปฏิเสธ++
      } catch { /* ยิงไม่ถึง ⇒ ไม่นับ */ }
    }
    return ปฏิเสธ
  },
}

/* ── หาหมุดในซอร์ส ── */
function ไฟล์ทั้งหมด(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) ไฟล์ทั้งหมด(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(p)) out.push(p)
  }
  return out
}
const รูปหมุด = /วัดได้ยิงจริง\(([^)]+)\)=([0-9,]+)/g
const เจอ = []
for (const ราก of ['app', 'components', 'lib', 'scripts']) {
  const เต็ม = join(ROOT, ราก)
  let รายการ
  try { รายการ = statSync(เต็ม).isDirectory() ? ไฟล์ทั้งหมด(เต็ม) : [เต็ม] } catch { continue }
  for (const p of รายการ) {
    for (const m of readFileSync(p, 'utf8').matchAll(รูปหมุด)) {
      เจอ.push({ ไฟล์: relative(ROOT, p), สิ่งที่นับ: m[1].trim(), เลข: Number(m[2].replace(/,/g, '')) })
    }
  }
}

if (!เจอ.length) {
  console.error('🔴 ไม่เจอหมุด `วัดได้ยิงจริง(...)` สักจุด ⇒ ตรวจอะไรไม่ได้รอบนี้ ⇒ ไม่ผ่าน')
  process.exit(1)
}

let ตก = 0
console.log(`หมุดที่ต้องยิงจริง: ${เจอ.length} จุด · ฐาน ${ฐาน} · ทะเบียน ${Object.keys(วิธีวัด).length} รายการ`)
for (const x of เจอ) {
  const วัด = วิธีวัด[x.สิ่งที่นับ]
  if (!วัด) {
    console.error(`🔴 ${x.ไฟล์}: หมุด "${x.สิ่งที่นับ}" ไม่มีวิธีวัดในทะเบียน ⇒ คำรับรองที่แต่งตัวเป็นกลไก`)
    ตก++; continue
  }
  let จริง = null
  try { จริง = await วัด() } catch { จริง = null }
  if (จริง === null) {
    console.error(`🔴 ${x.ไฟล์}: ยิงวัด "${x.สิ่งที่นับ}" ไม่สำเร็จ ⇒ **ตัดสินไม่ได้ ไม่ใช่ผ่าน**`)
    ตก++; continue
  }
  if (จริง !== x.เลข) {
    console.error(`🔴 ${x.ไฟล์}: "${x.สิ่งที่นับ}" หมุดเขียน ${x.เลข} · **ยิงวัดได้ ${จริง}**`)
    console.error('   ⇒ แก้เลขในหมุด **และอ่านคำสั่งรอบ ๆ ว่ายังจริงไหม**')
    ตก++; continue
  }
  console.log(`   ✅ ${x.สิ่งที่นับ} = ${จริง} (${x.ไฟล์})`)
}
if (ตก) { console.error(`\n🔴 ตก ${ตก} จุด`); process.exit(1) }
console.log('✅ ทุกหมุดตรงกับที่ยิงวัดได้จริง')
