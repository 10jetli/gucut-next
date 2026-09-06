// ไล่หา "ท่าที่ทำให้จอโกหกตอนของพัง" — ตัวตรวจที่เกิดจากการกวาดจริงคืน 6-7 ก.ย. 2569
//
// ทำไมต้องมี: คืนนั้นกวาดด้วย `scripts/fake-pipe.mjs` แล้วเจอ **~30 จุด** ที่จอพูดสิ่งที่ไม่จริง
// ตอนดึงข้อมูลไม่สำเร็จ — และเกือบทุกจุด **อ่านโค้ดเฉย ๆ ไม่เห็น** เพราะแต่ละบรรทัดถูกของมันเอง
// ⇒ ผิดตอน "อยู่ด้วยกัน" เท่านั้น (ข้อความว่างเปล่า + กล่องแดง · หัวจอ + เนื้อจอ)
//
// ตัวนี้จับได้แค่ **ท่าที่รู้จัก** ไม่ได้ตัดสินว่าจอโกหกจริงไหม
// ⇒ หน้าที่มันคือ "ยกมือถามคนเขียน" ไม่ใช่ห้าม · **ไม่ทำให้ build ตก** (เหมือนตัวตรวจตัวอื่น)
//
// ⚠️ **ตัวกรองต้องแคบ** — บทเรียนจาก check-nav/check-claims: ตัวตรวจที่ฟ้องผิดจะถูกเมิน
//    แล้ววันที่มันฟ้องถูกก็จะไม่มีใครเชื่อ (แย่กว่าไม่มีตัวตรวจ)
//
// ✅ **พิสูจน์แล้วว่าจับของจริงได้** — เอาไปรันกับโค้ดก่อนแก้ (git stash) เจอครบทุกจุดที่แก้ไปคืนนั้น
//    · `.catch(console.error)` ที่ /orders · /products
//    · `.then(setCfg)` ที่ พิกเซล · โฆษณา · SEO · ลูกค้าเก่า
//    · `.catch(() => {})` ที่ ลูกค้าเก่า
//
// 📌 **ผลรอบแรก 7 ก.ย. 2569: 57 จุด ⇒ แคบตัวกรอง ⇒ 22 จุด ⇒ แก้ของจริง 2 จอ ⇒ เหลือ 18 จุด**
//    18 จุดที่เหลือ **ตรวจด้วยตาแล้วและตัดสินว่ารับได้** — จดไว้เพื่อไม่ต้องไล่ซ้ำ:
//    · เลขในบล็อกที่ถูกกันด้วยเงื่อนไขอยู่แล้ว (buy-report · packing · ป้ายแท็บ missing-sku)
//    · `.catch(() => {})` ที่เป็นการยิง POST/DELETE แล้วโหลดใหม่ทันที (แชท · คูปอง)
//    · ตัวนับบนเมนู (Sidebar/MobileNav) — พังก็แค่ไม่มีตัวเลขบนป้าย ไม่ได้โกหกอะไร
//    ⚠️ **เลขนี้เพิ่มขึ้นเมื่อไหร่ = มีท่าเก่ากลับมา** ให้ไปดูจุดใหม่ ไม่ใช่ปรับตัวกรองให้เงียบ
//
// รันเอง: node scripts/check-honesty.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.tsx')) files.push(p)
  }
}
walk('app')
walk('components')

/** ท่าที่รู้ว่าทำให้จอโกหกได้ — ทุกอันเคยเป็นบั๊กจริงมาแล้วอย่างน้อยหนึ่งครั้ง */
const RULES = [
  {
    id: 'กลืนเงียบ',
    why: 'จับ error แล้วไม่บอกใคร ⇒ จอจะโชว์ "ว่างเปล่า/ศูนย์" แทนที่จะบอกว่าดึงไม่ได้',
    // ⚠️ ยอมให้ catch เปล่าได้กับ localStorage/clipboard (พังก็ไม่กระทบข้อมูลบนจอ)
    match: /\.catch\(\s*(console\.error|\(\s*\)\s*=>\s*\{\s*\})\s*\)/,
    skipLine: /localStorage|sessionStorage|clipboard|navigator\.|scrollTo|\.play\(\)/,
  },
  {
    id: 'เอาคำตอบดิบไปตั้งเป็น state',
    why: 'ปลายทางตอบ error เป็น JSON ⇒ ก้อน error กลายเป็นข้อมูล ⇒ อ่าน .x ต่อแล้วพังทั้งหน้า',
    match: /\.then\(\s*set[A-Z]\w*\s*\)/,
  },
  {
    id: 'ศูนย์แทนไม่รู้ (เฉพาะเลขสรุป)',
    why: '`?? 0` กับ **เลขสรุปของทั้งจอ** ⇒ "เซิร์ฟเวอร์ไม่ได้ส่งมา" กลายเป็น "มีศูนย์"',
    /* ⚠️ **จงใจจับเฉพาะเลขสรุป ไม่จับเลขในแถว** — รอบแรกจับหมดได้ 45 จุด
       ซึ่งส่วนใหญ่เป็นค่าในตาราง (แถวนั้นมีอยู่จริงอยู่แล้ว `r.qty ?? 0` จึงไม่ได้โกหก)
       ⇒ เสียงหอน ⇒ ตัวตรวจถูกเมิน ⇒ วันที่ฟ้องถูกก็ไม่มีใครเชื่อ
       เกณฑ์: ตัวแปรต้องเป็น "ก้อนคำตอบทั้งก้อน" (data/d/st/all/info/sum/stat/…)
       และบรรทัดต้องไม่ใช่ช่องในตาราง (<td) */
    match: /(fmtNum|fmtMoney|toLocaleString)\(\s*(data|d|st|all|info|sum|stat|resp|res|cfg|counts|totals)[?.][^)]*\?\?\s*0/,
    skipLine: /<td|<Td|TD}/,
  },
]

let hits = 0
const found = []
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    // ข้ามคอมเมนต์ — ในโปรเจกต์นี้คอมเมนต์อธิบายบั๊กเก่าเยอะมาก จะกลายเป็นเสียงหอนทันที
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    for (const r of RULES) {
      if (!r.match.test(line)) continue
      if (r.skipLine && r.skipLine.test(line)) continue
      hits++
      found.push({ rule: r.id, why: r.why, at: `${f}:${i + 1}`, code: t.slice(0, 88) })
    }
  })
}

console.log(`ท่าที่ทำให้จอโกหกได้: ${hits} จุด`)
if (hits) {
  const byRule = new Map()
  for (const h of found) byRule.set(h.rule, [...(byRule.get(h.rule) ?? []), h])
  for (const [rule, list] of byRule) {
    console.log(`\n⚠️ ${rule} (${list.length}) — ${list[0].why}`)
    for (const h of list.slice(0, 8)) console.log(`   ${h.at}\n     ${h.code}`)
    if (list.length > 8) console.log(`   … อีก ${list.length - 8} จุด`)
  }
  console.log('\n📌 ไม่ใช่ทุกจุดคือบั๊ก — ตัวนี้ชี้ "ท่าที่เคยพลาด" ให้คนดูด้วยตา')
  console.log('   เกณฑ์ตัดสิน: ถ้าเส้นนี้ล้ม จอจะเขียนว่าอะไร · เขียนเลข 0 หรือ "ไม่มี…" ไหม')
} else {
  console.log('✅ ไม่เจอท่าที่รู้จัก')
}
console.log('\n🧪 วิธีตรวจของจริง (ตัวตรวจนี้ไม่ได้แทน): node scripts/fake-pipe.mjs 4010 500')
