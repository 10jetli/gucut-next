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
import { ต้องมีของให้ตรวจ } from './lib/ต้องมีของให้ตรวจ.mjs'
import { ตัดคอมเมนต์ } from './lib/ตัดคอมเมนต์.mjs'

// ⚠️ **ต้องอ่านทุกที่ที่พาคนไปหน้าได้ ไม่ใช่แค่ nav-config**
//    รอบแรกอ่านแค่ nav-config แล้วมันฟ้องว่า /core/manual ไม่มีทางเข้า
//    ทั้งที่เข้าได้จากแผงตารางจุด 9 ช่องบนหัวจอ ⇒ **ตัวตรวจที่ฟ้องผิดจะถูกเมิน**
//    แล้ววันที่มันฟ้องถูกก็จะไม่มีใครเชื่อ (แย่กว่าไม่มีตัวตรวจ)
const nav = ['lib/nav-config.ts', 'components/layout/TopBarActions.tsx', 'components/layout/TopBar.tsx']
  .map((p) => { try { return ตัดคอมเมนต์(readFileSync(p, 'utf8')) } catch { return '' } }).join('\n')
// เอาเฉพาะ href ที่เป็นเส้นทางในเว็บนี้ (ตัดลิงก์ออกนอกและไฟล์นิ่งทิ้ง)
const hrefs = [...nav.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1])
  .filter((h) => h.startsWith('/') && !h.includes('.html') && !h.startsWith('//'))
/* 🔒 อ่านไฟล์เมนูไม่ได้ = ไม่มี href ให้ตรวจ ⇒ ห้ามเขียว (งาน S2 · 18 ก.ย. 2569)
   ⚠️ ต้องอยู่ **หลังจบเชน** — ฉบับแรกผมแทรกคั่นกลาง .map().filter() แล้วด่านพังทันที
      (และพังแบบ exit 0 ด้วย ⇒ build ไม่รู้ตัว · ดูหมายเหตุท้ายไฟล์นี้) */
ต้องมีของให้ตรวจ(hrefs.length, 'check-nav')

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

/* ── พื้นขั้นต่ำ: กันตัวตรวจ "ตาบอดแล้วขึ้นเขียว" ───────────────────────────
   🔴 อาการที่กลัว: วันไหนรูปแบบไฟล์เมนูเปลี่ยน ตัวดึงลิงก์อ่านไม่เจอสักอัน
      ⇒ hrefs = 0 ⇒ ไม่มีลิงก์ให้ผิด ⇒ พิมพ์ "✅ ทุกลิงก์มีหน้าจริงรออยู่"
      **เขียวสนิททั้งที่ไม่ได้ตรวจอะไรเลย** — เขียวแบบนี้อันตรายกว่าฟ้องแดง
   ⇒ ตั้งพื้นหยาบ ๆ ไว้: ของจริงมี 67 ลิงก์ / 92 หน้า (6 ก.ย. 2569)
      ตัวเลขต่ำกว่าพื้นนี้แปลว่า "ตัวอ่านพัง" ไม่ใช่ "เมนูหด"
   ⚠️ พื้นต้องต่ำกว่าของจริงเยอะ ๆ โดยตั้งใจ — ตั้งชิดของจริงเมื่อไหร่
      มันจะฟ้องทุกครั้งที่ลบเมนูตามปกติ แล้วคนจะเลิกอ่าน (บทเรียนเดียวกับรอบเสียงหอน) */
// ✅ **พิสูจน์ด้วยการพังของจริง 6 ก.ย. 2569** — เปลี่ยนชื่อไฟล์เมนูให้หาไม่เจอ
//    (จำลองวันที่มีคนย้าย/เปลี่ยนชื่อ `lib/nav-config.ts` ซึ่งตัวอ่านกลืน error เป็นสตริงว่าง)
//    ⇒ ลิงก์ร่วง 67 → 7 · พื้นฟ้องถูกต้อง · และบรรทัด ✅ ข้างล่างยังขึ้นเหมือนเดิม
//    นั่นแหละคือเหตุผลที่ข้อความสีแดงต้องเขียนตรง ๆ ว่า "ผลเขียวข้างล่างเชื่อไม่ได้"
const FLOOR_LINKS = 30
const FLOOR_PAGES = 40
if (hrefs.length < FLOOR_LINKS || pages.size < FLOOR_PAGES) {
  console.log(`\n🔴 ตัวเลขต่ำผิดปกติ (พื้นที่ตั้งไว้ ${FLOOR_LINKS} ลิงก์ / ${FLOOR_PAGES} หน้า)`)
  console.log('   น่าจะเป็น "ตัวอ่านพัง" ไม่ใช่ "เมนูหด" ⇒ ผลเขียวข้างล่างนี้เชื่อไม่ได้')
}

/* 🔴🔴 **ด่านนี้เคยพิมพ์แดงแล้วปล่อยผ่าน (พบ 19 ก.ย. 2569 · ใบ S2)**
   ปลูกลิงก์ `/core/zzfakepage` ลงเมนู ⇒ พิมพ์ `🔴 เมนูชี้ไปหน้าที่ไม่มีอยู่ 1 รายการ`
   แต่ **exit 0** ⇒ prebuild เดินต่อ ⇒ **ลิงก์ 404 ขึ้นเว็บได้จริง**
   ⇒ หัวไฟล์เขียนว่า "พิสูจน์แล้วว่าจับได้จริง" ซึ่งจริง — **แต่จับได้ ≠ ห้ามผ่าน**
   🔑 กฎที่ได้: พิสูจน์ด่านต้องดู **exit code** ไม่ใช่ดูว่ามันพิมพ์อะไรออกมา
      (และเวลาวัด ห้ามต่อท่อ `| head` เพราะ `$?` จะเป็นของ head — บทเรียนเดิมของทีม)
   ⚠️ ส่วน `orphan` ข้างล่างยังเป็นคำแนะนำ ไม่ใช่ตัวตัด — ตั้งใจให้ไม่ฟ้องตก
      (ตอนนี้มี 22 หน้า ซึ่งหลายหน้าตั้งใจเปิดจากจออื่น) */
let ตก = false
if (hrefs.length < FLOOR_LINKS || pages.size < FLOOR_PAGES) ตก = true
if (missing.length) {
  console.log(`\n🔴 เมนูชี้ไปหน้าที่ไม่มีอยู่ ${missing.length} รายการ — กดแล้ว 404:`)
  for (const m of missing) console.log('   ' + m)
  ตก = true
} else console.log('✅ ทุกลิงก์ในเมนูมีหน้าจริงรออยู่')

/* ══ ทะเบียนหน้าที่ไม่มีเมนูโดยเจตนา ════════════════════════════════════════════
   🔴 **ก่อนหน้านี้ส่วนนี้เป็นคำแนะนำล้วน ไม่เคยทำให้ตก** ⇒ เลข 22 โตได้เงียบ ๆ
      และ **เลขเปล่าแยกไม่ออกว่า "ตั้งใจไม่มีเมนู" กับ "ลืมใส่เมนู"**
      (คลาสเดียวกับที่ `check-aria-state` แก้ไปแล้ว: กองที่ถูกยกเว้นมีสองชนิดที่อ่านเหมือนกัน)
   ⇒ เปลี่ยนเป็น **ทะเบียนรายหน้า** · ค่าในทะเบียนคือ **จอที่เปิดหน้านั้น**
   🔑 **และด่านตรวจเหตุนั้นได้เอง** — ถ้าจอที่ประกาศไว้เลิกลิงก์มาแล้ว ด่านจะฟ้อง
      ⇒ เหตุที่ตรวจไม่ได้จะเน่าเงียบ ๆ · เหตุที่ตรวจได้จะฟ้องตัวเองตอนเน่า
   📏 ค่าทั้ง 22 รายการวัดมาจากของจริง (กวาด `app/` + `components/` หา `"<path>` / `'<path>` / `` `<path> ``
      เมื่อ 5 ต.ค. 2569) **ไม่ได้เดา** — ทุกหน้ามีจอที่ลิงก์มาจริงทั้ง 22 หน้า
      ⇒ ไม่มีหน้าไหน "หลุดโดยไม่ตั้งใจ" ในวันที่ตั้งทะเบียน ⇒ เลขนี้จึงเป็นพื้นที่เชื่อถือได้ */
const เปิดจากจออื่น = new Map([
  ['/core/branches/new', ['app/core/branches/page.tsx']],
  ['/core/bundles/new', ['app/core/bundles/page.tsx']],
  ['/core/categories/detail', ['app/core/categories/page.tsx']],
  ['/core/customers/detail', ['app/core/customers/page.tsx']],
  ['/core/customers/new', ['app/core/customers/page.tsx']],
  ['/core/import', ['components/zort/ImportButton.tsx']],
  ['/core/packing/pack', ['app/core/packing/page.tsx']],
  ['/core/purchases/detail', ['app/core/purchases/page.tsx']],
  ['/core/purchases/returns/new', ['app/core/purchases/returns/page.tsx']],
  ['/core/quotations/detail', ['app/core/quotations/page.tsx']],
  ['/core/quotations/new', ['app/core/quotations/page.tsx']],
  ['/core/return-orders/detail', ['app/core/return-orders/page.tsx']],
  ['/core/sales/detail', ['app/core/packing/page.tsx', 'app/core/logistics/page.tsx']],
  ['/core/sales/new', ['app/core/sales/page.tsx']],
  ['/core/sales/print', ['app/core/sales/page.tsx']],
  ['/core/setting-sms', ['components/zort/SettingsNav.tsx']],
  ['/core/setting-tracking', ['components/zort/SettingsNav.tsx']],
  ['/core/settings-users/add', ['app/core/settings-users/page.tsx']],
  ['/core/stock/cost', ['app/core/stock/page.tsx']],
  ['/core/stock/no-image', ['app/core/stock/page.tsx']],
  ['/core/stock/print', ['app/core/stock/page.tsx']],
  ['/core/transfers/detail', ['app/core/transfers/page.tsx']],
])

/** ไฟล์นี้มีลิงก์ไปหน้านั้นไหม — ตรวจสามรูปที่โค้ดนี้ใช้จริง (`"` `'` `` ` ``)
 *  ⚠️ ไม่ตัดคอมเมนต์ก่อนโดยตั้งใจ: คอมเมนต์ที่เอ่ยถึงพาธก็นับว่า "มีคนชี้ทางไว้"
 *     ⇒ ถ้าตัด จะได้ลบลวงตอนทางเข้าอยู่ในคำอธิบาย · ขอบเขตนี้เขียนไว้เพราะมันเลือกได้สองทาง */
export function ไฟล์ชี้ไปหน้า(ซอร์ส, หน้า) {
  const s = String(ซอร์ส ?? '')
  return s.includes('"' + หน้า) || s.includes("'" + หน้า) || s.includes('`' + หน้า)
}

/* ── ตัวควบคุมของตรรกะใหม่ · รันก่อนตัดสินทุกครั้ง ────────────────────────── */
{
  const คุม = [
    ['<Link href="/core/stock/cost">x</Link>', '/core/stock/cost', true, 'ควรจับ: href ด้วยอัญประกาศคู่'],
    ["router.push('/core/stock/cost')", '/core/stock/cost', true, 'ควรจับ: อัญประกาศเดี่ยว'],
    ['`/core/stock/cost?x=1`', '/core/stock/cost', true, 'ควรจับ: เทมเพลตสตริง'],
    ['<Link href="/core/stock">x</Link>', '/core/stock/cost', false, 'ต้องไม่จับ: หน้าแม่ไม่ใช่หน้าลูก'],
    ['const s = "core/stock/cost"', '/core/stock/cost', false, 'ต้องไม่จับ: ไม่มีอัญประกาศนำหน้าสแลช'],
  ]
  let ตกคุม = 0
  for (const [src, หน้า, ควร, ชื่อ] of คุม) {
    if (ไฟล์ชี้ไปหน้า(src, หน้า) !== ควร) { console.log(`🔴 ตัวควบคุมตก — ${ชื่อ}`); ตกคุม++ }
  }
  if (ตกคุม) {
    console.log('🔴 ตะแกรงหาทางเข้าแยกแยะไม่ได้แล้ว ⇒ เลขข้างล่างอ่านไม่ได้')
    process.exit(1)
  }
  console.log(`✅ ตัวควบคุมตะแกรงทางเข้า ${คุม.length} เคสผ่านก่อนตัดสิน (จับ 3 · ไม่จับ 2)`)
}

if (orphan.length) {
  console.log(`\n⚠️ หน้าใน /core ที่ไม่มีทางเข้าจากเมนู ${orphan.length} หน้า`)
  console.log('   (ทุกหน้าต้องอยู่ในทะเบียน `เปิดจากจออื่น` พร้อมจอที่เปิดมัน)')
  for (const o of orphan) {
    const จอ = เปิดจากจออื่น.get(o)
    console.log(`   ${o}${จอ ? `  ← ${จอ.join(' · ')}` : '  🔴 ไม่อยู่ในทะเบียน'}`)
  }
}

/* ══ dynamic route ใน /core ก็ต้องมีทางเข้า ════════════════════════════════════
   🔴 **จุดบอดที่เจอตอนทำทะเบียนข้างบนเสร็จ (5 ต.ค. 2569)** — ตัวกรอง `orphan` ข้างบน
      มีเงื่อนไข `!p.endsWith('/*')` ⇒ **เส้น dynamic ไม่เคยถูกตรวจเลยสักเส้น**
      และ dynamic route คือ **จอรายละเอียด** ซึ่งเป็นชนิดที่เข้าถึงได้จากจออื่นเท่านั้น
      ⇒ เป็นกองที่ "เข้าถึงไม่ได้" ได้ง่ายที่สุด แต่ด่านมองไม่เห็นที่สุด
   🔑 **ที่นี่ไม่ต้องมีทะเบียน** — ต่างจากหน้า static ข้างบนที่ "ไม่มีเมนู" เป็นเจตนาที่คนต้องประกาศ
      เส้น dynamic **ไม่มีทางอยู่ในเมนูได้เลย** (ต้องมีพารามิเตอร์) ⇒ ไม่มีอะไรให้ตัดสินรายเส้น
      ⇒ กฎเดียวที่พอ: **ต้องมีไฟล์ไหนก็ได้ลิงก์ไปพาธฐานของมัน**  ⇒ ด่านคิดเองได้ทั้งหมด
   📏 พื้นวันที่ตั้ง (วัดแล้ว 5 ต.ค. 2569): dynamic ใน `app/` ทั้งหมด 9 เส้น · ใน `/core` **4 เส้น**
      และทั้ง 4 มีจอลิงก์มาจริง ⇒ ตั้งด่านนี้ได้โดยไม่ต้องยกเว้นอะไรเลย
   ⚠️ ขอบเขต: ตรวจแค่ `/core` — เส้นใต้ `/api` ถูกเรียกด้วย URL ที่ **ประกอบตอนรัน**
      ซึ่งตะแกรงข้อความมองไม่เห็นโดยธรรมชาติ (ใบ a-name-built-at-runtime-is-invisible-to-every-sieve)
      ⇒ เอามารวมจะได้ลบลวงทุกรอบ */
const dynมีทางเข้า = []
const dynไม่มีทางเข้า = []
{
  const dyn = []
  const เดินหา = (dir, url = '') => {
    for (const n of readdirSync(dir)) {
      const pth = join(dir, n)
      if (!statSync(pth).isDirectory()) continue
      if (n.startsWith('[')) { dyn.push({ url: `${url}/${n}`, dir: pth }); continue }
      เดินหา(pth, `${url}/${n}`)
    }
  }
  เดินหา('app')
  const ไฟล์ = new Map()
  const เก็บ = (dir) => {
    for (const n of readdirSync(dir)) {
      const pth = join(dir, n)
      if (statSync(pth).isDirectory()) เก็บ(pth)
      else if (n.endsWith('.tsx') || n.endsWith('.ts')) ไฟล์.set(pth, readFileSync(pth, 'utf8'))
    }
  }
  เก็บ('app'); เก็บ('components')
  for (const d of dyn.filter((x) => x.url.startsWith('/core'))) {
    const ฐาน = d.url.replace(/\/\[[^\]]+\]$/, '')
    /* ลิงก์ไปเส้น dynamic ต้องมี `/` ต่อท้ายฐาน (`/core/branches/` + ค่า) ⇒ กันไม่ให้
       ลิงก์ไปหน้าแม่ (`/core/branches`) ถูกนับว่าเป็นทางเข้าของจอลูก */
    const ใคร = [...ไฟล์].filter(([f, src]) => !f.startsWith(d.dir)
      && (src.includes('`' + ฐาน + '/') || src.includes('"' + ฐาน + '/') || src.includes("'" + ฐาน + '/')))
      .map(([f]) => f)
    if (ใคร.length) dynมีทางเข้า.push(`${d.url} ← ${ใคร.slice(0, 2).join(' · ')}`)
    else dynไม่มีทางเข้า.push(d.url)
  }
}
if (dynไม่มีทางเข้า.length) {
  console.log(`\n🔴 **เส้น dynamic ใน /core ที่ไม่มีจอไหนลิงก์มา** ${dynไม่มีทางเข้า.length} เส้น:`)
  for (const d of dynไม่มีทางเข้า) console.log('   · ' + d)
  console.log('   ⇒ เส้น dynamic อยู่ในเมนูไม่ได้ (ต้องมีพารามิเตอร์) ⇒ ทางเข้าเดียวคือลิงก์จากจออื่น')
  console.log('   ⇒ ไม่มีใครลิงก์มา = **จอที่เปิดไม่ได้เลย** ไม่ใช่แค่หายาก')
  ตก = true
} else {
  console.log(`✅ เส้น dynamic ใน /core ทั้ง ${dynมีทางเข้า.length} เส้น มีจอลิงก์มาจริง`)
  for (const d of dynมีทางเข้า) console.log('   ' + d)
}

/* ── ตัดสิน: สามทิศ ───────────────────────────────────────────────────────── */
const orphanใหม่ = orphan.filter((o) => !เปิดจากจออื่น.has(o))
const ทะเบียนเน่า = [...เปิดจากจออื่น.keys()].filter((k) => !orphan.includes(k))
const เหตุเน่า = []
{
  const ไฟล์ทั้งหมด = new Map()
  const เดิน = (dir) => {
    for (const name of readdirSync(dir)) {
      const pth = join(dir, name)
      if (statSync(pth).isDirectory()) เดิน(pth)
      else if (name.endsWith('.tsx') || name.endsWith('.ts')) ไฟล์ทั้งหมด.set(pth, readFileSync(pth, 'utf8'))
    }
  }
  เดิน('app'); เดิน('components')
  for (const [หน้า, จอ] of เปิดจากจออื่น) {
    if (!orphan.includes(หน้า)) continue        // เน่าคนละแบบ จับที่ `ทะเบียนเน่า`
    const ยังชี้ = จอ.filter((f) => ไฟล์ทั้งหมด.has(f) && ไฟล์ชี้ไปหน้า(ไฟล์ทั้งหมด.get(f), หน้า))
    if (ยังชี้.length === 0) เหตุเน่า.push(`${หน้า} ← ประกาศว่าเปิดจาก ${จอ.join(' · ')} แต่ไม่มีไฟล์ไหนลิงก์มาแล้ว`)
  }
}

if (orphanใหม่.length) {
  console.log(`\n🔴 **หน้าใหม่ที่ไม่มีทางเข้าจากเมนู และไม่อยู่ในทะเบียน** ${orphanใหม่.length} หน้า:`)
  for (const o of orphanใหม่) console.log('   · ' + o)
  console.log('   ⇒ ใส่ลงเมนูที่ `lib/nav-config.ts` **หรือ** ถ้าตั้งใจให้เปิดจากจออื่น')
  console.log('      ให้เพิ่มลงทะเบียน `เปิดจากจออื่น` ใน scripts/check-nav.mjs **พร้อมพาธไฟล์ของจอนั้น**')
  console.log('   🔑 เลขรวมแยกไม่ออกว่า "ตั้งใจ" กับ "ลืม" ⇒ ทะเบียนบังคับให้ตัดสินรายหน้า')
  ตก = true
}
if (ทะเบียนเน่า.length) {
  console.log(`\n🔴 **รายการในทะเบียนที่ไม่ใช่ orphan อีกแล้ว** ${ทะเบียนเน่า.length} รายการ:`)
  for (const k of ทะเบียนเน่า) console.log('   · ' + k)
  console.log('   ⇒ หน้านั้นมีเมนูแล้ว หรือถูกลบไปแล้ว ⇒ ลบออกจากทะเบียน')
  console.log('   🔑 ทะเบียนที่มีรายการผีจะปล่อยหน้าใหม่ผ่านฟรีเมื่อพาธเดิมกลับมา')
  ตก = true
}
if (เหตุเน่า.length) {
  console.log(`\n🔴 **เหตุในทะเบียนเน่าแล้ว** ${เหตุเน่า.length} รายการ:`)
  for (const e of เหตุเน่า) console.log('   · ' + e)
  console.log('   ⇒ หน้านั้นไม่มีทั้งเมนูและไม่มีจอไหนลิงก์มา = **เข้าไม่ถึงจริง**')
  console.log('   🔑 นี่คือข้อที่เลขเปล่า 22 มองไม่เห็นตลอดกาล')
  ตก = true
}
if (!orphanใหม่.length && !ทะเบียนเน่า.length && !เหตุเน่า.length) {
  console.log(`\n✅ ทุกหน้าที่ไม่มีเมนู อยู่ในทะเบียนครบ ${เปิดจากจออื่น.size} หน้า และจอที่ประกาศยังลิงก์มาจริงทุกหน้า`)
}

/* ⛔ ตัดสินท้ายสุด — ต้องอยู่หลังจากพิมพ์ทุกอย่างแล้ว คนจะได้เห็นรายการครบก่อนตก */
if (ตก) {
  console.log('\n   ⇒ แก้ href ให้ตรงกับเส้นทางจริง หรือสร้างหน้านั้น ก่อนจะ build ต่อได้')
  process.exit(1)
}
