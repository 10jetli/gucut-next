// ตรวจว่า "ทุกลิงก์ในเมนู มีหน้าจริงรออยู่" และ "ทุกหน้าจริง มีทางเข้าจากเมนู"
//
// ทำไมต้องมี: 6 ก.ย. 2569 เจอแถวในเช็คลิสต์ค้างเป็น "ยังไม่ได้เทียบ" มาหลายวัน
// ทั้งที่จอทำเสร็จแล้ว — **เพราะตารางชี้ไปคนละ path กับจอจริง**
// คลาสเดียวกับที่เคยเจอ: หา `/core/returns` ไม่เจอเลยคิดว่าไม่มีจอ แต่ของจริงอยู่ `/returns`
// ⇒ "ไม่เจอไฟล์" ≠ "ไม่มีจอ" · ให้เครื่องไล่เทียบแทนคน
//
// ✅ **พิสูจน์แล้วว่าจับได้จริง 6 ก.ย. 2569** — ใส่ลิงก์ปลอม `/core/ของปลอมไม่มีจริง`
//    ลงเมนูแล้วรัน ⇒ ฟ้องถูกต้อง 1 รายการ · ถอดออกแล้วกลับมาเขียว
//    ⚠️ **ตัวตรวจที่ไม่เคยถูกป้อนของเสียเข้าไปดู ให้ผลเขียวที่แปลว่า "ยังไม่เจอ" ไม่ใช่ "ไม่มี"**
//       (ท่านี้ยืมมาจากฝั่งท่อ — เขาป้อนคำกล่าวอ้างเท็จสองทิศก่อนเชื่อผลเขียวของตัวเอง)
// รันเอง: node scripts/check-nav.mjs
// ⚠️ ตัวนี้ **ไม่ทำให้ build ตก** โดยตั้งใจ — มันเป็นตัวชี้ให้ดู ไม่ใช่ตัวตัดสิน
//    หน้าที่จงใจไม่ใส่เมนู (จอลูก/จอที่เปิดจากลิงก์ในจออื่น) มีจริงและถูกต้อง
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ⚠️ **ต้องอ่านทุกที่ที่พาคนไปหน้าได้ ไม่ใช่แค่ nav-config**
//    รอบแรกอ่านแค่ nav-config แล้วมันฟ้องว่า /core/manual ไม่มีทางเข้า
//    ทั้งที่เข้าได้จากแผงตารางจุด 9 ช่องบนหัวจอ ⇒ **ตัวตรวจที่ฟ้องผิดจะถูกเมิน**
//    แล้ววันที่มันฟ้องถูกก็จะไม่มีใครเชื่อ (แย่กว่าไม่มีตัวตรวจ)
const nav = ['lib/nav-config.ts', 'components/layout/TopBarActions.tsx', 'components/layout/TopBar.tsx']
  .map((p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }).join('\n')
// เอาเฉพาะ href ที่เป็นเส้นทางในเว็บนี้ (ตัดลิงก์ออกนอกและไฟล์นิ่งทิ้ง)
const hrefs = [...nav.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1])
  .filter((h) => h.startsWith('/') && !h.includes('.html') && !h.startsWith('//'))

const pages = new Set()
function walk(dir, url) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name.startsWith('(') || name.startsWith('_')) { walk(p, url); continue }
      if (name.startsWith('[')) { pages.add(`${url}/*`); continue } // เส้นทางที่มีตัวแปร
      walk(p, `${url}/${name}`)
    } else if (name === 'page.tsx' || name === 'page.ts') {
      pages.add(url || '/')
    }
  }
}
walk('app', '')

const missing = hrefs.filter((h) => {
  const clean = h.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
  if (pages.has(clean)) return false
  // เส้นทางที่มีตัวแปร เช่น /core/stock/<sku>
  return ![...pages].some((p) => p.endsWith('/*') && clean.startsWith(p.slice(0, -2)))
})

const inMenu = new Set(hrefs.map((h) => h.split('?')[0].replace(/\/$/, '')))
const orphan = [...pages].filter((p) =>
  p.startsWith('/core') && !p.endsWith('/*') && !inMenu.has(p))

console.log(`เมนู ${hrefs.length} ลิงก์ · หน้าจริง ${pages.size} หน้า`)
if (missing.length) {
  console.log(`\n🔴 เมนูชี้ไปหน้าที่ไม่มีอยู่ ${missing.length} รายการ — กดแล้ว 404:`)
  for (const m of missing) console.log('   ' + m)
} else console.log('✅ ทุกลิงก์ในเมนูมีหน้าจริงรออยู่')

if (orphan.length) {
  console.log(`\n⚠️ หน้าใน /core ที่ไม่มีทางเข้าจากเมนู ${orphan.length} หน้า`)
  console.log('   (บางหน้าตั้งใจให้เปิดจากจออื่น — ตรวจด้วยตาว่าตัวไหนคือของที่ลืมใส่เมนู)')
  for (const o of orphan) console.log('   ' + o)
}
