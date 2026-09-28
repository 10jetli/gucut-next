/* ทุกชื่อเส้นที่จอยิงผ่านท่อกลาง `/api/web/<ชื่อ>` ต้องอยู่ใน ALLOW ของท่อนั้นจริง
 * รัน: node scripts/tests/web-relay-allow.test.mjs
 *
 * 🔴 **ที่มา 28 ก.ย. 2569 (ใบ t_mukwzjtz)** — จะทำจอ `feed-health` แล้วฝั่งท่อถามก่อนว่า
 *    "เส้นนั้นอยู่ใน allowlist ของท่อกลางหรือยัง" ⇒ ตรวจแล้ว **ยังไม่อยู่**
 *    ⇒ ถ้าทำจอก่อน จอจะได้ **403** แล้วเสียเวลาไล่หาเหตุที่จอ ทั้งที่รูอยู่คนละชั้น
 *    🔑 คลาสเดียวกับใบ B08 เช้าวันเดียวกัน: **จอยิงเส้นที่ท่อ default-deny ปฏิเสธ ⇒ ตายเงียบ 21 วัน**
 *
 * ⚠️ ตัดคอมเมนต์ก่อนกวาด — ไฟล์ในรีโปนี้เอ่ยชื่อเส้นในคอมเมนต์เยอะ (การเอ่ยถึง ≠ การเรียก)
 * ⚠️ อ่าน ALLOW จาก **ซอร์สของท่อจริง** ไม่ใช่พิมพ์รายชื่อซ้ำในเทส (รายชื่อที่พิมพ์สองที่จะเพี้ยนกันเสมอ)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ตัดคอมเมนต์ } from '../lib/ตัดคอมเมนต์.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เพิ่ม = '') => {
  if (เงื่อนไข) console.log(`  ✅ ${ชื่อ}`)
  else { ตก++; console.log(`  ❌ ${ชื่อ} ${เพิ่ม}`) }
}

/* ── ① อ่านรายชื่อที่ท่ออนุญาต จากซอร์สของท่อเอง ── */
const ไฟล์ท่อ = 'app/api/web/[...path]/route.ts'
const ซอร์สท่อ = ตัดคอมเมนต์(readFileSync(ไฟล์ท่อ, 'utf8'))
const m = /const ALLOW = new Set\(\[([\s\S]*?)\]\)/.exec(ซอร์สท่อ)
/* 🔴 อ่านไม่ได้ = **ตะแกรงพัง ไม่ใช่ผ่าน** — ต้องแดงทันที ไม่ใช่เงียบแล้วปล่อยทุกชื่อผ่าน */
ok('อ่าน ALLOW จากซอร์สท่อกลางได้', !!m, `หา ALLOW ใน ${ไฟล์ท่อ} ไม่เจอ — เปลี่ยนรูปแล้วต้องมาแก้เทสนี้ด้วย`)
const ALLOW = new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [])
ok('ALLOW มีสมาชิกมากกว่า 0', ALLOW.size > 0, `ได้ ${ALLOW.size}`)
console.log(`   📏 ท่อกลางอนุญาต ${ALLOW.size} ชื่อ`)

/* ── ② กวาดทุกจุดที่จอยิงผ่านท่อกลาง ── */
function เดิน(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) เดิน(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes(join('api', 'web'))) out.push(p)
  }
  return out
}
const พบ = []
for (const f of [...เดิน('app'), ...เดิน('lib'), ...เดิน('components')]) {
  const เนื้อ = ตัดคอมเมนต์(readFileSync(f, 'utf8'))
  for (const x of เนื้อ.matchAll(/['"`]\/api\/web\/([a-z0-9-]+)/gi)) พบ.push({ f, ชื่อ: x[1] })
}
ok('ตะแกรงยังเจอจุดที่ยิงผ่านท่อกลาง (ไม่เจอ = ตะแกรงพัง)', พบ.length > 0, `เจอ ${พบ.length}`)

const เสีย = []
for (const { f, ชื่อ } of พบ) if (!ALLOW.has(ชื่อ)) เสีย.push(`${f} → /api/web/${ชื่อ}`)
ok(`ทุกชื่อที่จอยิง (${new Set(พบ.map((x) => x.ชื่อ)).size} ชื่อไม่ซ้ำ) อยู่ใน ALLOW`,
  เสีย.length === 0,
  `\n      ${เสีย.join('\n      ')}\n      ⇒ จอจะได้ 403 ทันทีที่เปิดหน้านั้น — เติมชื่อใน ALLOW ของท่อกลางก่อน`)

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
