// ตรวจว่า "หน้ายังไม่ได้ทำ" ที่ถูกลิงก์จากจอจริง มีคำอธิบายรออยู่จริงไหม
//
// 🔴 **ปัญหาที่ตัวตรวจนี้เกิดมาแก้** (เจอ 14 ก.ย. 2569)
//    มี 6 คีย์ที่จอจริงลิงก์ไป แต่ไม่เคยมีในทะเบียน `lib/zort-menu.ts`
//      product-edit · product-delete · product-print · quotation · shipping · leadtime
//    หน้า `/core/soon/[key]` รับคีย์ที่ไม่รู้จักได้โดยไม่พัง — ขึ้นว่า "หน้านี้ยังไม่มีเนื้อหา" เฉย ๆ
//    ⇒ **ไม่พัง แต่ไม่บอกอะไรเลย** ไม่รู้ว่ามันคืออะไร ไม่รู้ว่าระหว่างนี้ไปทำที่ไหน
//    ⇒ ขัดกับเหตุผลที่ทะเบียนนั้นเกิดมาตรง ๆ (หัวไฟล์เขียนเองว่า "ห้ามให้กดแล้วเจอหน้าเปล่าเงียบ ๆ")
//
// ⚠️ ของแบบนี้ **ไม่มีทางเจอจาก build หรือ tsc** เพราะไม่มีอะไรผิดทางเทคนิคเลย
//    เจอได้ทางเดียวคือมีคนกดเข้าไปดู หรือมีตัวตรวจแบบนี้
//
// ใช้: node scripts/check-soon.mjs   (อยู่ใน prebuild — คีย์ที่ไม่มีทะเบียน = ไม่ให้ build ผ่าน)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ตัดคอมเมนต์ } from './lib/ตัดคอมเมนต์.mjs'

const ROOTS = ['app', 'lib', 'components']
const files = []
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (e === 'node_modules' || e.startsWith('.')) continue
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx?|mjs)$/.test(e)) files.push(p)
  }
}
for (const r of ROOTS) { try { walk(r) } catch { /* ไม่มีโฟลเดอร์นี้ก็ข้าม */ } }

/** คีย์ที่ถูกลิงก์จริงจากจอ → ลิงก์มาจากไฟล์ไหนบ้าง (ไว้บอกคนแก้ว่าไปดูที่ไหน)
 *
 * 🔴 **ครั้งที่ห้าที่ regex แข็งเกินไปในตัวตรวจตัวนี้ — และครั้งนี้ทำให้ตัวตรวจ "ตาบอด"** (14 ก.ย. 2569)
 *    `lib/nav-config.ts` ไม่ได้เขียนเส้นทางเต็ม แต่มีตัวช่วย:
 *        const soon = (key, label) => ({ href: `/core/soon/${key}`, label, soon: true })
 *        soon('customer-group', 'กลุ่มลูกค้า')
 *    ⇒ ในไฟล์ไม่มีสตริง `/core/soon/customer-group` ให้จับเลย
 *    ⇒ **เมนูทั้งแถบมองไม่เห็น** · รายงานว่า "มีทะเบียนแต่ยังไม่มีใครลิงก์ 21 คีย์"
 *       ทั้งที่ 21 คีย์นั้นอยู่ในเมนูจริงและกดเข้าไปได้
 *    🔴 อันตรายจริงอยู่อีกด้าน: ถ้ามีคนเพิ่ม `soon('คีย์ใหม่', …)` ในเมนู **โดยไม่ทำทะเบียน**
 *       ตัวตรวจนี้จะ **ปล่อยผ่านเงียบ ๆ** — ซึ่งคือสิ่งเดียวที่มันเกิดมาเพื่อกัน
 *    ⇒ อ่านสองรูปแบบ: เส้นทางเต็ม **และ** การเรียก soon('คีย์', …)
 *  📌 บทเรียนที่ซ้ำห้าครั้ง: ตัวตรวจที่อ่านโค้ดด้วย regex จะเจอรูปแบบที่ไม่ได้เผื่อไว้เสมอ
 *     และ "ไม่เจอ" ของมันหน้าตาเหมือน "ไม่มี" ทุกประการ */
const linked = new Map()
const PATTERNS = [
  /\/core\/soon\/([a-z0-9-]+)/g,     // เขียนเส้นทางเต็มในเพจ
  /\bsoon\(\s*'([a-z0-9-]+)'/g,       // ตัวช่วยใน nav-config.ts
]
for (const f of files) {
  if (f.endsWith('zort-menu.ts') || f.endsWith('check-soon.mjs')) continue
  const src = ตัดคอมเมนต์(readFileSync(f, 'utf8'))
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) {
      linked.set(m[1], [...(linked.get(m[1]) ?? []), f])
    }
  }
}

const reg = ตัดคอมเมนต์(readFileSync('lib/zort-menu.ts', 'utf8'))
const keys = new Set([...reg.matchAll(/^ {2}'?([a-zA-Z0-9-]+)'?:\s*\{/gm)].map((m) => m[1]))
/** คีย์ที่ทำเสร็จแล้ว (มี builtAt อยู่ในก้อนของมัน)
 *  🔴 **ครั้งที่สี่ที่ regex แข็งเกินไปในตัวตรวจตัวนี้** (14 ก.ย. 2569)
 *     รุ่นก่อนตัดก้อนด้วย `\n  },` ⇒ คีย์ที่เขียน **บรรทัดเดียว** (`'x': { a, b },`)
 *     ไม่จบที่ตัวเอง เลยกลืนก้อนของคีย์ถัดไปเข้ามารวม builtAt ด้วย
 *     ⇒ รายงานว่า `setting-roles` ทำเสร็จแล้ว ทั้งที่ builtAt เป็นของ `user-add`
 *  ⇒ เลิกพึ่งรูปแบบวงเล็บทั้งหมด · ตัดก้อนด้วย **ตำแหน่งคีย์ถัดไป** แทน
 *     (ก่อนหน้า: คีย์ไม่มีเครื่องหมายคำพูด · คีย์ต่างรูปแบบในไฟล์เดียว · builtAt ไม่อยู่บรรทัดแรก)
 *  📌 บทเรียนที่ซ้ำสี่ครั้ง: ตัวตรวจที่อ่านโค้ดด้วย regex จะเจอรูปแบบที่ไม่ได้เผื่อไว้เสมอ
 *     ถ้าตัดสินใจอะไรจากผลของมัน ให้ตรวจกับไฟล์จริงอีกชั้นก่อนเชื่อ */
const keyHits = [...reg.matchAll(/^ {2}'?([a-zA-Z0-9-]+)'?:\s*\{/gm)]
const built = new Set(
  keyHits
    .filter((m, i) => {
      const body = reg.slice(m.index, i + 1 < keyHits.length ? keyHits[i + 1].index : reg.length)
      return /\bbuiltAt:/.test(body)
    })
    .map((m) => m[1]),
)

const missing = [...linked.keys()].filter((k) => !keys.has(k)).sort()
const unused = [...keys].filter((k) => !linked.has(k) && !built.has(k)).sort()

console.log(`หน้ายังไม่ได้ทำ: ถูกลิงก์จริง ${linked.size} คีย์ · มีทะเบียน ${keys.size} คีย์`)

if (built.size) {
  console.log(`\n🟢 ทำเสร็จแล้ว ${built.size} คีย์ (หน้า soon จะพาต่อไปหน้าจริง) — ${[...built].join(' · ')}`)
}

if (unused.length) {
  /* ไม่ใช่ความผิด — ทะเบียนเตรียมไว้ล่วงหน้าได้ แต่บอกไว้เพื่อไม่ให้ลืมว่ามีของค้าง */
  console.log(`\nℹ️ มีทะเบียนแต่ยังไม่มีใครลิงก์ ${unused.length} คีย์ (เตรียมไว้ล่วงหน้าได้ ไม่ใช่ปัญหา)`)
  console.log(`   ${unused.join(' · ')}`)
}

if (missing.length) {
  console.log(`\n🔴 ถูกลิงก์จากจอจริง แต่ไม่มีทะเบียน ${missing.length} คีย์ — กดแล้วเจอหน้าเปล่าที่ไม่บอกอะไรเลย`)
  for (const k of missing) console.log(`   ${k}  ← ${[...new Set(linked.get(k))].join(' · ')}`)
  console.log('\n   แก้: เพิ่มคีย์นี้ใน lib/zort-menu.ts พร้อม title · what · meanwhile')
  console.log('   (ถ้าทำเสร็จแล้ว ให้ใส่ builtAt ชี้หน้าจริงแทน)')
  process.exit(1)
}

console.log('\n✅ ทุกหน้าที่ถูกลิงก์ มีคำอธิบายรออยู่')
