/* เส้น API ที่ไม่มีใครในรีโปเรียก — **รายงานอย่างเดียว ไม่ทำให้ build ตก**
 * (19 ก.ย. 2569 · ใบ S5)
 *
 * 🔑 ทำไมต้องมี: เส้นที่ไม่มีใครเรียกแล้ว **ไม่ได้หายไปไหน** — มันยังรับคำขอได้จริง
 *    · บางเส้นยิง ZORT ⇒ กินโควตาของร้านถ้ามีใครเรียก
 *    · บางเส้นอยู่ใน PUBLIC_PATHS ⇒ อยู่นอกกำแพงล็อกอิน
 *    · และโค้ดที่ไม่มีใครเรียก **ไม่มีใครเจอบั๊กของมัน** — `/api/sales-report` มีเพดานเงียบ
 *      6 หน้า × 200 = 1,200 ใบ ซึ่งไม่มีวันมีใครเห็น เพราะไม่มีใครเรียกมันตั้งแต่ 2 ก.ย. 2569
 *
 * 🚫 **ไม่ทำให้ build ตก โดยตั้งใจ** — คำตัดสินต้องใช้คนอ่าน:
 *    · webhook/callback ของแพลตฟอร์มภายนอกไม่มีใครในรีโปเรียกอยู่แล้ว (ถูกต้อง)
 *    · พาธที่ประกอบตอนรัน (`[key]` · `[name]`) กวาดแบบนี้จับไม่ได้
 *    ⇒ มันคือ **รายการให้ไล่ดู** ไม่ใช่รายการให้ลบ
 *
 * ⚠️ **ตัดคอมเมนต์ก่อนกวาดเสมอ** — รอบแรกผมไม่ตัด ได้ 10 เส้น · ตัดแล้วได้ 16
 *    หกตัวที่หายไปถูก "ค้ำ" ด้วยการ **เอ่ยชื่อเส้นในคอมเมนต์** (เช่น "เดิมยิง /api/sales-report")
 *    ⇒ **การเอ่ยถึง ≠ การเรียก** · ตัวกวาดที่ไม่ตัดคอมเมนต์จะรายงานว่าเส้นตายยังมีชีวิต
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { ตัดคอมเมนต์ } from './lib/ตัดคอมเมนต์.mjs'
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'

const ROOT = process.cwd()

function เดิน(dir, นามสกุล, out = []) {
  let รายการ
  try { รายการ = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of รายการ) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) เดิน(p, นามสกุล, out)
    else if (นามสกุล.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

/* ── เส้นทั้งหมด ── */
const เส้น = []
for (const p of เดิน(join(ROOT, 'app/api'), ['route.ts', 'route.tsx'])) {
  เส้น.push('/' + relative(join(ROOT, 'app'), join(p, '..')).split(sep).join('/'))
}
ต้องมีของให้ตรวจ(เส้น.length, 'เส้นที่ไม่มีใครเรียก', 5)

/* ── ข้อความของฝั่งที่ "เรียก" (ตัดคอมเมนต์แล้ว) ── */
let ข้อความ = ''
for (const ราก of ['app', 'components', 'lib', 'scripts']) {
  const ฐาน = join(ROOT, ราก)
  if (!existsSync(ฐาน)) continue
  for (const p of เดิน(ฐาน, ['.ts', '.tsx', '.mjs'])) {
    if (p.startsWith(join(ROOT, 'app/api'))) continue      // เส้นเรียกตัวเองไม่นับ
    ข้อความ += '\n' + ตัดคอมเมนต์(readFileSync(p, 'utf8'))
  }
}

/* ── เส้นที่อยู่นอกกำแพงล็อกอิน = ออกแบบให้ถูกเรียกจากนอก ── */
let สาธารณะ = []
try {
  const m = readFileSync(join(ROOT, 'middleware.ts'), 'utf8').match(/const PUBLIC_PATHS = \[([\s\S]*?)\]/)
  if (m) สาธารณะ = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
} catch { /* ไม่มีไฟล์ */ }
const นอกกำแพง = (u) => สาธารณะ.some((p) => u === p || u.startsWith(p + '/'))

const ไม่เจอ = เส้น.filter((u) => !ข้อความ.includes(u)).sort()
const เรียกจากนอกได้ = ไม่เจอ.filter(นอกกำแพง)
const ต้องดู = ไม่เจอ.filter((u) => !นอกกำแพง(u))

console.log(`เส้น API ทั้งหมด ${เส้น.length} · ไม่พบการเรียกในรีโป ${ไม่เจอ.length}`)
console.log(`   🌐 อยู่ใน PUBLIC_PATHS (ออกแบบให้เรียกจากนอก) ${เรียกจากนอกได้.length}: ${เรียกจากนอกได้.join(' ') || '—'}`)
console.log(`   🔎 **ต้องไล่ดู ${ต้องดู.length} เส้น**`)
for (const u of ต้องดู) console.log(`      ${u}`)
console.log('   ⚠️ รายการนี้ให้ไล่ดู **ไม่ใช่รายการให้ลบ** — พาธที่ประกอบตอนรัน ([key]/[name]) จับไม่ได้')
console.log('   🔑 เส้นที่ไม่มีใครเรียก ไม่ได้หายไป — มันยังรับคำขอได้ และไม่มีใครเจอบั๊กของมัน')
