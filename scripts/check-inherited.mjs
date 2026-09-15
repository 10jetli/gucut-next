// ตรวจ "ข้อความที่จอใหม่รับมรดกจากตัวประกอบร่วม" — ใบกระดาน t_mu1hfv1a (CEO อนุมัติ 14 ก.ย. 2569)
//
// 🔴 **รูปร่างของบั๊กที่ตัวนี้เกิดมาจับ** (เจอ 3 ครั้งในวันเดียว 14 ก.ย. 2569)
//    ข้อความยืนยันอยู่ใน *ตัวประกอบร่วม* แต่ความจริงของมันขึ้นกับ *จอที่เอาไปใช้*
//    ⇒ จอใหม่เข้ามาใช้ แล้วได้ข้อความนั้นติดมาโดยไม่มีใครตัดสินใจว่ามันจริงกับจอนั้นไหม
//      ① `/core/soon/[key]` สั่ง "ต้องกด Export Excel ก่อนปิดบัญชี" ให้ทุกคีย์ที่มีธง impossible
//         — คีย์แบบนั้นมี 19 อัน แต่มีของให้ export จริงแค่ 3 ⇒ สั่งงานที่ไม่มีอยู่จริง 16 หน้า
//      ② `LedgerScreen` เขียนว่า "ปุ่ม <สร้าง…> ยังทำงานไม่ได้" ⇒ เท็จทันทีที่จอสร้างเสร็จ
//      ③ `LedgerScreen` เขียนว่า "(ไม่ใช่คำบอกเล่าจากการเปิดจอดูเมื่อ 3 ก.ย.)" ⇒ จอใหม่
//         ไม่เคยมีคำบอกเล่านั้น = อ้างถึงเหตุการณ์ที่ไม่เคยเกิด
//
// 🔴 **ทำไมตัวตรวจเดิมจับไม่ได้** — `check-claims` กับ `check-honesty` อ่านทีละไฟล์
//    แต่ **ในไฟล์ของจอใหม่ไม่มีข้อความนั้นอยู่เลยสักตัวอักษร** ⇒ มองไม่เห็นทั้งคู่
//
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ **ข้อจำกัด — อ่านก่อนเชื่อผลของตัวนี้** (CEO สั่งให้เขียนไว้ กันคนรุ่นถัดไปเชื่อเกินจริง)
//
//  1. **มันตัดสินไม่ได้ว่าข้อความไหนจริง** — ไม่มีทางรู้ หน้าที่มันคือ *บังคับให้มีคนตัดสิน*
//     ณ นาทีที่ควรตัดสิน (ตอนจอใหม่เข้ามาใช้ / ตอนข้อความเปลี่ยน) เท่านั้น
//  2. **มันจับ "คู่ที่ผิดมาตั้งแต่ภาพถ่ายแรก" ไม่ได้** — ถ้าข้อความผิดกับจอนั้นอยู่แล้ว
//     ตอนตั้งต้น ภาพถ่ายจะบันทึกความผิดไว้เป็นของที่ตรวจแล้ว
//     ⇒ ย้อนเวลากลับไป **มันจะจับเคส ① ไม่ได้** เพราะคู่นั้นผิดตั้งแต่คีย์แรก
//        มันจับได้เฉพาะ **มรดกที่เพิ่งเกิด** (เคส ② และ ③)
//  3. **ความเสี่ยงที่แท้จริงคือคนกดผ่านโดยไม่อ่าน** — กันไม่ได้ 100%
//     ถ้าถึงวันที่คนเมิน ตัวตรวจนี้จะ **แย่กว่าไม่มี** เพราะให้ความอุ่นใจปลอม ๆ
//     ⇒ CEO นัดทบทวน 2 สัปดาห์หลัง 14 ก.ย. 2569 · เมินเมื่อไหร่ให้ **ถอดทิ้ง** ไม่ใช่ปล่อยไว้
// ════════════════════════════════════════════════════════════════════════════
//
// 🔑 **วิธีที่เลือก และทำไมไม่เลือกวิธีที่ดูฉลาดกว่า**
//    เคยคิดจะ "กวาดเฉพาะประโยคที่เข้าข่ายคำยืนยัน" (มีวันที่ / มีคำว่า ต้อง · ทำไม่ได้ …)
//    ⇒ **ทิ้งไป** เพราะตัวกรองที่แคบ = ตาบอดทุกครั้งที่มีคนเขียนคำยืนยันด้วยถ้อยคำใหม่
//       (บทเรียนซ้ำ 5 ครั้งจาก check-soon · และ check-claims ก็โดนมาแล้วสองรอบ)
//    ⇒ ตัวนี้จึงเอา **ข้อความไทยทั้งหมดที่ขึ้นจอ** ของตัวประกอบร่วมมาทำลายนิ้วมือ
//       ไม่คัดว่าอันไหนเป็นคำยืนยัน ⇒ **ไม่มีทางตาบอดเพราะตัวกรองแคบ**
//       แลกมาด้วยเสียงรบกวน: แก้ถ้อยคำในตัวประกอบร่วม = ทุกจอที่ใช้ต้องตรวจใหม่
//       ⚠️ ซึ่ง **ถูกแล้ว** — แก้ประโยคที่ใช้ร่วมกัน 10 จอ ก็ควรยืนยันว่ายังจริงทั้ง 10 จอ
//    ⚠️ **คอมเมนต์ในโค้ดถูกตัดทิ้งก่อนทำลายนิ้วมือ** ไม่งั้นแก้คอมเมนต์ก็ต้องตรวจใหม่ทั้งหมด
//
// 📐 **"จอที่ใช้" ของหน้า soon คือ "รูปทรงของคีย์" ไม่ใช่ตัวคีย์**
//    หน้า `/core/soon/[key]` วาดข้อความชุดเดียวกันให้ทุกคีย์ · สิ่งที่ต่างคือ **กิ่งไหนทำงาน**
//    ซึ่งตัดสินด้วยว่าคีย์นั้นมีธงอะไรบ้าง ⇒ คีย์ 60 อันยุบเหลือ 9 รูปทรง
//    ⇒ คีย์ใหม่ที่ **รูปทรงเดิม** ไม่ต้องตรวจซ้ำ (คำตัดสินเดิมใช้ได้) · รูปทรงใหม่ ⇒ ต้องตรวจ
//
// วิธีใช้
//   node scripts/check-inherited.mjs                          ตรวจ (อยู่ใน prebuild · ตกได้)
//   node scripts/check-inherited.mjs --ok "<คู่>" --by "ชื่อ"   บันทึกว่าตรวจแล้ว **ทีละคู่**
// 🔴 **ไม่มีคำสั่งอัปเดตทั้งไฟล์รวดเดียว และห้ามเพิ่ม** (CEO สั่ง) — ถ้ามีเมื่อไหร่
//    วันที่คนเหนื่อยจะกดผ่านทั้งไฟล์ แล้วตาข่ายนี้จะกลายเป็นของประดับทันที
//    ⚠️ **แต่พูดตรง ๆ: เขียนลูปในเชลล์เรียกทีละคู่ก็ได้ผลเท่ากัน ห้ามไม่ได้จริง**
//       สิ่งที่กันได้คือทำให้ **มองเห็น**: ทุกบรรทัดมีชื่อผู้ตรวจกับวันที่
//       ⇒ คู่จำนวนมากที่ลงชื่อคนเดียวกันวันเดียวกัน = สัญญาณให้ไปถามว่าอ่านจริงไหม
//       (ภาพถ่ายตั้งต้น 16 คู่แรกเป็นแบบนั้นเอง — คุณส้มอ่านทีละจอจริง แล้วบันทึกด้วยลูป
//        และการอ่านรอบนั้นเจอของจริง 2 จุด: เอกสารบัญชีประกาศ "0 รายการ" ทั้งที่มี 694 ใบ
//        · หน้า soon ขึ้นป้าย "ทำไม่ได้" ให้คีย์ที่ impossibleScope เป็น write ซึ่งอ่านได้จริง)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const SNAP = 'scripts/.inherited-claims.json'

/** ตัวประกอบร่วมที่เฝ้าอยู่ — **ขอบเขตที่ CEO อนุมัติ ห้ามขยายทั้งรีโป**
 *
 *  🔴 **เกณฑ์เดียวในการเพิ่ม: ตัวประกอบร่วมนั้นพิมพ์ "ข้อความที่คนอ่าน" ออกจอหรือไม่**
 *     มี ⇒ จอใหม่ที่เอาไปใช้จะได้ข้อความนั้นติดมาโดยไม่มีใครตัดสินใจ = รูปร่างของบั๊ก
 *     ไม่มี (เช่น ตัวช่วยคำนวณล้วน ๆ) ⇒ **ห้ามใส่** · CEO กำชับ 15 ก.ย. 2569:
 *     "อย่าให้ตาข่ายบวมจนคนเมิน" — ตาข่ายที่ฟ้องเรื่องไม่สำคัญ จะถูกเมินตอนฟ้องเรื่องสำคัญ
 *
 *  `companions` = ไฟล์ที่ **ข้อความของมันไปโผล่ผ่านตัวประกอบร่วมตัวนี้**
 *     🔴 มีไว้อุดจุดบอด: `coverageText()` ใน lib/csv-export.ts เขียนประโยคที่ลงไปใน
 *        ไฟล์ Excel และขึ้นบนจอ แต่มันเป็น lib ไม่ใช่ component ⇒ ไม่มีใครเป็น "ผู้ใช้" ของมัน
 *        ⇒ ถ้าไม่นับรวม แก้ประโยคตรงนั้นแล้วตาข่ายเงียบสนิท ทั้งที่ 8 จอเปลี่ยนคำพูดพร้อมกัน */
const WATCHED = [
  { file: 'components/zort/LedgerScreen.tsx' },
  { file: 'app/core/soon/[key]/page.tsx' },
  /* ข้อความหัวไฟล์ Excel + ป้าย "ครบ/ไม่ครบ" ไปโผล่ทุกจอที่มีปุ่มส่งออก (CEO อนุมัติ 15 ก.ย. 2569) */
  { file: 'components/zort/ExportButton.tsx', companions: ['lib/csv-export.ts'] },
  /* คำกำกับบาร์โค้ดสามสถานะ (ZORT มี / ไม่มี / ยังไม่รู้) — ผิดจอไหนคือฉลากที่สแกนได้ค่าผิด */
  { file: 'components/zort/SkuCodes.tsx' },
  /* คำเตือน "บัตรนี้ยังไม่ใช่ประวัติทั้งหมด" + ของที่ตั้งใจไม่มี (คลัง · คงเหลือสะสม) */
  { file: 'components/zort/StockCard.tsx' },
  /* แผงค้นหาขั้นสูง — ประโยค "กรองที่เซิร์ฟเวอร์ ครอบทุกรายการ" เป็นคำสัญญาเรื่องขอบเขต
     ถ้าจอไหนจริง ๆ กรองแค่หน้าที่เห็น ประโยคนี้จะกลายเป็นคำโกหกทันที (15 ก.ย. 2569) */
  { file: 'components/zort/AdvancedSearch.tsx' },
  /* ปุ่มเลือกร้าน z1/z2 — ประโยค "ยอดและตัวนับทั้งหมดเป็นของร้านที่เลือกเท่านั้น" เป็นคำสัญญาเรื่องขอบเขต
     และชื่อเรียกร้าน ("ร้านออนไลน์/หน้าร้าน") ยังไม่ได้ข้อยุติทั้งระบบ ⇒ ถ้าใครแก้คำที่นี่
     จอทั้งห้าจะเปลี่ยนคำพร้อมกันโดยไม่มีใครอ่านซ้ำ (CEO อนุมัติเข้ารายชื่อ 15 ก.ย. 2569) */
  { file: 'components/zort/StorePicker.tsx' },
]

/* ── ข้อความไทยที่ขึ้นจอ (ตัดคอมเมนต์ออกก่อน) ───────────────────────────────
   ไม่ได้พยายามแยก "ประโยค" ให้สวย — เป็นตัวจับความเปลี่ยนแปลง ไม่ใช่ตัวอ่านความหมาย
   ขอแค่ **เดิมพันเดิมได้ผลเดิมเสมอ** และ **เห็นข้อความทุกอัน** */
const thaiCount = (s) => (s.match(/[฀-๿]/g) ?? []).length
/* ⚠️ ชิ้นที่ "มีไทยปนนิดเดียว" คือเศษโค้ดที่หลุดมา ไม่ใช่ประโยคที่คนอ่าน
   (เช่น `Array.isArray r.variants ตัวเลือก null null`) ⇒ ตัดออกด้วยสัดส่วน ไม่ใช่รายชื่อคำ
   ⚠️ ใช้สัดส่วน **ไม่ใช่บัญชีดำ** เพราะบัญชีดำจะตกยุคทุกครั้งที่โค้ดเปลี่ยนรูป */
const mostlyThai = (t) => {
  const solid = t.replace(/\s/g, '').length
  return solid > 0 && thaiCount(t) / solid >= 0.25
}

/* ⚠️ **ล้างให้เหลือ "ข้อความที่คนอ่านเห็น" ก่อนทำลายนิ้วมือ** ไม่ใช่เอาบรรทัดโค้ดดิบ ๆ
   เหตุผลสองข้อ:
     · คนที่ต้องมานั่งตัดสินว่า "จริงกับจอนี้ไหม" ต้องอ่านเป็นประโยค ไม่ใช่อ่าน JSX
     · ถ้าเอาโค้ดดิบไปทำลายนิ้วมือ แค่แก้ className หรือขึ้นบรรทัดใหม่ก็ต้องตรวจซ้ำทุกจอ
       ⇒ เสียงรบกวนล้วน ๆ และเสียงรบกวนคือสิ่งที่ฆ่าตาข่ายแบบนี้
   ⚠️ `title=` เก็บไว้ เพราะเป็นข้อความที่คนเห็นจริงตอนชี้ค้าง (เคยใช้บอกเรื่องสำคัญมาแล้ว) */
function piecesOf(raw) {
  const out = []
  let line = raw
    .replace(/className=(?:"[^"]*"|\{[^{}]*\})/g, ' ')
    .replace(/style=\{\{[^}]*\}\}/g, ' ')
  /* ① ข้อความในเครื่องหมายคำพูด (รวม title/placeholder ที่คนเห็นตอนชี้ค้าง) */
  for (const m of line.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`\\$]*)`/g)) {
    const t = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\s+/g, ' ').trim()
    if (thaiCount(t) >= 6 && mostlyThai(t)) out.push(t)
  }
  /* ② ข้อความเปล่าใน JSX (ที่ไม่ได้อยู่ในเครื่องหมายคำพูด) */
  line = line.replace(/'[^'\\]*'|"[^"\\]*"|`[^`\\$]*`/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
  const bare = line.replace(/[{}<>?:&|=()[\];,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (thaiCount(bare) >= 6 && mostlyThai(bare)) out.push(bare)
  return out
}


function screenText(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
  const seen = new Set()
  const lines = []
  for (const raw of s.split('\n')) {
    for (const t of piecesOf(raw)) {
      if (!seen.has(t)) { seen.add(t); lines.push(t) }
    }
  }
  return lines
}

const hashOf = (lines) => createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 12)

/* ── ใครใช้ตัวประกอบร่วมบ้าง ─────────────────────────────────────────────── */
const appFiles = []
const walk = (d) => {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.tsx')) appFiles.push(p)
  }
}
walk('app')
/* 🔴 **ตัวประกอบร่วมเอาตัวประกอบร่วมด้วยกันไปใช้ได้** — `StockCard` ใช้ `<ExportButton>`
   ถ้ากวาดแต่ใน app/ จะมองไม่เห็นคู่นั้น แล้วข้อความจะไหลเข้าจอผ่านสองชั้นโดยไม่มีใครตรวจ
   (จุดบอดแบบเดียวกับที่ check-soon เคยมองไม่เห็นเมนูเพราะกวาดผิดที่) */
walk('components')

/** รูปทรง → รายชื่อคีย์ที่อยู่ในรูปทรงนั้น (ไว้พิมพ์ตัวอย่างตอนฟ้อง ไม่ใช่ส่วนหนึ่งของชื่อคู่) */
let shapeExamples = new Map()
const exampleOf = (consumer) => {
  const keys = shapeExamples.get(consumer)
  return keys ? ` (เช่น ${keys.slice(0, 3).join(' · ')}${keys.length > 3 ? ` … รวม ${keys.length} คีย์` : ''})` : ''
}

/** ชื่อแท็กที่ใช้ใน JSX ของตัวประกอบร่วมตัวนั้น (ไฟล์ชื่อเดียวกับแท็กเสมอในรีโปนี้) */
const tagOf = (file) => file.split('/').pop().replace(/\.tsx?$/, '')

function consumersOf(component) {
  if (component.endsWith('LedgerScreen.tsx')) {
    /* ⚠️ ดูจาก **การใช้งานใน JSX** (`<LedgerScreen`) ไม่ใช่จากบรรทัด import
       เพราะ import เขียนได้หลายรูป (ผ่าน barrel · เปลี่ยนชื่อ · หลายบรรทัด)
       แต่จะใช้จริงต้องมีแท็กเสมอ ⇒ รูปแบบเดียวที่เลี่ยงยาก
       🔴 และ **ห้ามนับไฟล์ที่พูดถึงชื่อนี้ในคอมเมนต์เฉย ๆ** — สามจอ (leadtime · wallet ·
          setting-notify) เขียนไว้ว่า "จอนี้ไม่ได้ใช้ LedgerScreen" ⇒ จับด้วยชื่อลอย ๆ จะนับผิด */
    return appFiles.filter((f) => /<LedgerScreen[\s/>]/.test(readFileSync(f, 'utf8'))).sort()
  }
  /* ตัวประกอบร่วมทั่วไป: ผู้ใช้ = ไฟล์ที่ **ใช้แท็กนั้นจริงใน JSX**
     (เหตุผลเดียวกับ LedgerScreen: import เขียนได้หลายรูป แต่จะใช้จริงต้องมีแท็ก
      และห้ามนับไฟล์ที่พูดถึงชื่อนี้ในคอมเมนต์เฉย ๆ) */
  if (!component.endsWith('soon/[key]/page.tsx')) {
    const tag = tagOf(component)
    const re = new RegExp(`<${tag}[\\s/>]`)
    return appFiles.filter((f) => f !== component && re.test(readFileSync(f, 'utf8'))).sort()
  }

  /* หน้า soon: "ผู้ใช้" คือรูปทรงของคีย์ในทะเบียน — ดูคำอธิบายหัวไฟล์ */
  const reg = readFileSync('lib/zort-menu.ts', 'utf8')
  const FIELDS = ['impossible', 'impossibleScope', 'exportByHand', 'awaitingDecision', 'builtAt', 'meanwhile']
  const hits = [...reg.matchAll(/^ {2}'?([a-zA-Z0-9-]+)'?:\s*\{/gm)]
  const shapes = new Map()
  hits.forEach((m, i) => {
    const body = reg.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : reg.length)
    const shape = FIELDS.filter((f) => new RegExp(`\\b${f}:`).test(body)).join('+') || '(ไม่มีธงเลย)'
    if (!shapes.has(shape)) shapes.set(shape, [])
    shapes.get(shape).push(m[1])
  })
  /* 🔴 **ชื่อคู่ต้องเป็น "รูปทรง" ล้วน ๆ ห้ามมีตัวอย่างคีย์หรือจำนวนคีย์ปนเข้าไป**
     เคยใส่ "(เช่น xxx · 18 คีย์)" ลงไปในชื่อคู่ ⇒ พอเพิ่มคีย์ที่ 19 ในรูปทรงเดิม
     ชื่อคู่เปลี่ยน ⇒ ตัวตรวจฟ้องว่าเป็น **คู่ใหม่** ทั้งที่คำตัดสินเดิมยังใช้ได้
     ⇒ เสียงรบกวนล้วน ๆ และเสียงรบกวนคือสิ่งที่ทำให้คนเลิกอ่านตาข่าย
     ⇒ ตัวอย่าง/จำนวน ไปอยู่ตอนพิมพ์ผลแทน (ดู exampleOf) */
  shapeExamples = new Map([...shapes.entries()].map(([k, v]) => [`รูปทรง:${k}`, v]))
  return [...shapes.keys()].sort().map((shape) => `รูปทรง:${shape}`)
}

/* ── อ่านภาพถ่ายเดิม ─────────────────────────────────────────────────────── */
let snap = { components: {}, pairs: {} }
try { snap = JSON.parse(readFileSync(SNAP, 'utf8')) } catch { /* ยังไม่มี = ตั้งต้นใหม่ */ }
snap.components ??= {}
snap.pairs ??= {}

const now = new Map()       // คู่ → { component, consumer, hash }
const current = new Map()   // component → { hash, lines }
for (const w of WATCHED) {
  const comp = w.file
  /* ข้อความของ companions นับรวมเป็นของตัวประกอบร่วมตัวนี้ (ดูเหตุผลหัว WATCHED) */
  const lines = [comp, ...(w.companions ?? [])]
    .flatMap((f) => screenText(readFileSync(f, 'utf8')).map((t) => (f === comp ? t : `[${f}] ${t}`)))
  const h = hashOf(lines)
  current.set(comp, { hash: h, lines })
  const users = consumersOf(comp)
  /* 🔴 **"หาไม่เจอ" หน้าตาเหมือน "ไม่มี" ทุกประการ** — ถ้าวันหนึ่งวิธีหาผู้ใช้พัง
     ตัวตรวจจะเงียบสนิทและดูเหมือนผ่าน ⇒ ตัวประกอบร่วมที่เฝ้าอยู่ต้องมีผู้ใช้เสมอ
     (บทเรียนจาก check-soon ที่ตาบอดอยู่หลายวันโดยไม่มีอะไรฟ้อง) */
  if (users.length === 0) {
    console.log(`🔴 หาผู้ใช้ของ ${comp} ไม่เจอเลยสักราย — วิธีค้นน่าจะพัง ไม่ใช่ว่าไม่มีคนใช้`)
    process.exit(1)
  }
  for (const consumer of users) now.set(`${comp} :: ${consumer}`, { comp, consumer, hash: h })
}

/* ── โหมดบันทึกว่าตรวจแล้ว — ทีละคู่เท่านั้น ─────────────────────────────── */
const argv = process.argv.slice(2)
const okAt = argv.indexOf('--ok')
if (okAt !== -1) {
  const key = argv[okAt + 1]
  const byAt = argv.indexOf('--by')
  const by = byAt === -1 ? '' : argv[byAt + 1]
  if (!key || !by) {
    console.log('ต้องระบุทั้งคู่และผู้ตรวจ:  --ok "<คู่>" --by "ชื่อผู้ตรวจ"')
    console.log('🔴 ผู้ตรวจไม่ใช่ของประดับ — วันหนึ่งถ้ามีคนกดผ่านโดยไม่อ่าน ต้องย้อนดูได้ว่าใคร')
    process.exit(2)
  }
  const cur = now.get(key)
  if (!cur) {
    console.log(`ไม่รู้จักคู่นี้: ${key}`)
    console.log('คู่ที่มีอยู่จริงตอนนี้:')
    for (const k of now.keys()) console.log(`   ${k}`)
    process.exit(2)
  }
  snap.components[cur.comp] ??= {}
  snap.components[cur.comp][cur.hash] = { lines: current.get(cur.comp).lines }
  snap.pairs[key] = { hash: cur.hash, by, at: new Date().toISOString().slice(0, 10) }
  writeFileSync(SNAP, `${JSON.stringify(snap, null, 2)}\n`)
  console.log(`✅ บันทึกแล้ว 1 คู่ (ครั้งละคู่เดียวเสมอ)\n   ${key}\n   ผู้ตรวจ ${by}`)
  process.exit(0)
}

/* ── ตรวจ ────────────────────────────────────────────────────────────────── */
const fresh = []   // คู่ใหม่ ยังไม่เคยมีใครตรวจ
const stale = []   // เคยตรวจแล้ว แต่ข้อความในตัวประกอบร่วมเปลี่ยนไป
for (const [key, cur] of now) {
  const rec = snap.pairs[key]
  if (!rec) { fresh.push([key, cur]); continue }
  if (rec.hash !== cur.hash) stale.push([key, cur, rec])
}
const gone = Object.keys(snap.pairs).filter((k) => !now.has(k))

console.log(`ข้อความรับมรดก: เฝ้า ${WATCHED.length} ตัวประกอบร่วม · คู่ทั้งหมด ${now.size} · ตรวจแล้ว ${now.size - fresh.length - stale.length}`)

const show = (lines, was) => {
  const old = new Set(was ?? [])
  const added = lines.filter((l) => !old.has(l))
  const list = was ? added : lines
  console.log(`   ${was ? `ข้อความที่เพิ่ง เพิ่ม/เปลี่ยน ${added.length} บรรทัด` : `ข้อความที่จอนี้จะพูดแทนคุณ ${lines.length} บรรทัด`}:`)
  for (const l of list.slice(0, 40)) console.log(`     • ${l.slice(0, 150)}`)
  if (list.length > 40) console.log(`     … อีก ${list.length - 40} บรรทัด`)
}

for (const [key, cur] of fresh) {
  console.log(`\n🔴 คู่ใหม่ ยังไม่มีใครตรวจ\n   ${key}${exampleOf(cur.consumer)}`)
  show(current.get(cur.comp).lines)
  console.log('   ⇒ อ่านทีละบรรทัดว่า **จริงกับผู้ใช้รายนี้ไหม** แล้วค่อยบันทึก:')
  console.log(`   node scripts/check-inherited.mjs --ok ${JSON.stringify(key)} --by "ชื่อคุณ"`)
}
for (const [key, cur, rec] of stale) {
  console.log(`\n🟡 ข้อความในตัวประกอบร่วมเปลี่ยนหลังตรวจครั้งก่อน (${rec.by} · ${rec.at})\n   ${key}${exampleOf(cur.consumer)}`)
  show(current.get(cur.comp).lines, snap.components[cur.comp]?.[rec.hash]?.lines)
  console.log(`   node scripts/check-inherited.mjs --ok ${JSON.stringify(key)} --by "ชื่อคุณ"`)
}
if (gone.length) {
  console.log(`\nℹ️ คู่ที่หายไปแล้ว ${gone.length} (จอถูกลบหรือเลิกใช้ตัวประกอบร่วม) — ลบบรรทัดออกจาก ${SNAP} ได้`)
  for (const k of gone) console.log(`   ${k}`)
}

if (fresh.length || stale.length) {
  console.log(`\n🔴 ยังไม่ผ่าน — ${fresh.length} คู่ใหม่ · ${stale.length} คู่ที่ข้อความเปลี่ยน`)
  console.log('   ⚠️ ห้ามบันทึกรวดเดียว — ตั้งใจให้ช้า เพราะต้นทางของบั๊กคือ "ไม่มีใครอ่านตอนจอใหม่เข้ามา"')
  process.exit(1)
}
console.log('\n✅ ทุกคู่ถูกอ่านและรับรองแล้ว')
