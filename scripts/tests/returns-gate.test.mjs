/* ทุกจุดในรีโปที่ยิง `/api/returns?…` ต้องผ่าน **ด่านตัวจริง** ของท่อนั้น
 * รัน: node scripts/tests/returns-gate.test.mjs
 *
 * 🔴 **ที่มา 28 ก.ย. 2569 (ใบ B08)** — จอ `/returns` ยิง `/api/returns?days=30`
 *    แล้วได้ **403 ทุกครั้งตั้งแต่ 7 ก.ย. 2569** (21 วัน) เพราะคอมมิต 755a7f3 เขียนท่อ
 *    whitelist ของจอรับคืนสินค้าทับ path เดิมที่เคยเป็นท่อสรุปใบคืน
 *    วัดจริงตอนเจอ: `curl /api/returns?days=30` ⇒ `HTTP 403`
 *    ⚠️ ไม่มีด่านไหนในรีโปฟ้องได้เลย เพราะ **ตัวตัดสินอยู่ใน route.ts ⇒ เทสเรียกไม่ได้**
 *    ⇒ ย้ายตัวตัดสินไป `lib/returns-gate.ts` แล้วเทสนี้เรียกของจริง (ไม่ได้เลียนแบบตรรกะ)
 *
 * 🔑 คลาสของบั๊กที่ด่านนี้กัน: **จอยิงเส้นที่ท่อ default-deny ปฏิเสธ**
 *    อาการคือจอตายเงียบ · build เขียว · tsc เขียว · ไม่มี error ในโค้ดเลย
 *
 * ⚠️ ตัดคอมเมนต์ก่อนกวาดเสมอ — ไฟล์พวกนี้ **เอ่ยชื่อเส้นในคอมเมนต์** (รวมทั้งไฟล์นี้เอง)
 *    การเอ่ยถึง ≠ การเรียก (บทเรียนเดียวกับ scripts/เส้นที่ไม่มีใครเรียก.mjs)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ตัดคอมเมนต์ } from '../lib/ตัดคอมเมนต์.mjs'

const out = join(process.cwd(), 'scripts', 'tests', '.out-returns-gate')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

/** ไฟล์ที่อาจยิงเส้นนี้ — จอ (.tsx) และตัวเรียกกลาง (.ts) · ไม่กวาด route.ts ของท่อเอง */
function เดิน(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) เดิน(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes(join('app', 'api', 'returns'))) out.push(p)
  }
  return out
}

/* ค่าแทนช่องที่ประกอบตอนรัน: ต้องยาวพอให้กติกา "คำค้น ≥ 3 ตัว" ไม่ตกเพราะค่าจำลองสั้น
   (ไม่งั้นด่านจะแดงเพราะค่าที่เทสแต่ง ไม่ใช่เพราะโค้ดผิด) */
const ค่าจำลอง = 'ตัวอย่างค่าจริง'

/** อ่าน URL ออกจากสตริงในโค้ด — **ต้องรู้จัก `${…}` ที่ซ้อน backtick ข้างใน**
 *  🔴 รอบแรกผมใช้ regex `['"\`](…)['"\`]` ⇒ มันจบสตริงที่ backtick **ข้างใน** `${q ? `&q=…` : ''}`
 *     ⇒ ได้ URL ขาดกลาง `?list=returns-inbox${q ?` ⇒ **ด่านแดงเพราะตะแกรงของผมเอง ไม่ใช่เพราะโค้ดผิด**
 *     (บวกลวงชนิดที่อ่านเหมือนเจอบั๊กจริง — ถ้าเชื่อไปคือไปแก้โค้ดที่ไม่ได้ผิด)
 *  ⇒ เดินอักขระเอง: เจอ `${` ให้กระโดดข้ามทั้งก้อน (นับวงเล็บปีกกาซ้อน) แล้วใส่ค่าจำลองแทน */
function หาเส้นในไฟล์(เนื้อ) {
  const ผล = []
  for (let i = 0; i < เนื้อ.length; i++) {
    const q = เนื้อ[i]
    if (q !== '\'' && q !== '"' && q !== '`') continue
    if (!เนื้อ.startsWith('/api/returns', i + 1)) continue
    let j = i + 1
    let url = ''
    let จบ = false
    while (j < เนื้อ.length) {
      if (เนื้อ[j] === q) { จบ = true; break }
      if (เนื้อ[j] === '$' && เนื้อ[j + 1] === '{') {
        let ลึก = 1
        j += 2
        while (j < เนื้อ.length && ลึก > 0) {
          if (เนื้อ[j] === '{') ลึก++
          else if (เนื้อ[j] === '}') ลึก--
          j++
        }
        /* 🔑 ช่องที่ประกอบตอนรันมีสองหน้าที่ต่างกัน — แยกด้วยอักขระที่อยู่ข้างหน้ามัน:
           · ต่อจาก `=` ⇒ มันคือ **ค่าของพารามิเตอร์** (`?order=${id}`) ⇒ ใส่ค่าจำลอง
           · ไม่ต่อจาก `=` ⇒ มันคือ **ท่อนต่อของ query** (`${q ? '&q=…' : ''}`) ⇒ ใส่ค่าว่าง
             (ท่อนแบบนี้ที่รันจริงอาจเป็นค่าว่างได้ ⇒ ต้องผ่านด่านตอนเป็นค่าว่างด้วย)
           🔴 รอบแรกผมใส่ค่าจำลองทุกช่อง ⇒ ได้ `list=returns-inboxตัวอย่างค่าจริง`
              ⇒ ด่านแดงเพราะค่าที่เทสแต่งเอง = บวกลวงรอบที่สองของด่านนี้ */
        url += url.endsWith('=') ? ค่าจำลอง : ''
        continue
      }
      url += เนื้อ[j]
      j++
    }
    if (!จบ) continue
    /* กันเส้นอื่นที่ชื่อขึ้นต้นเหมือนกัน (`/api/returns-summary` · `/api/returns-feed`) */
    if (!/^\/api\/returns(\?|$)/.test(url)) { i = j; continue }
    ผล.push({ url, at: i })
    i = j
  }
  return ผล
}

try {
  execFileSync('npx', ['tsc', 'lib/returns-gate.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { ตัดสินคำขอ } = await import(join(out, 'returns-gate.js'))

  /* ── ① ตัวควบคุม: ด่านต้องแยกผ่าน/ไม่ผ่านได้จริง (ไม่ใช่ตอบผ่านทุกอย่าง) ── */
  console.log('① ตัวควบคุม — ด่านตัวจริงต้องตอบต่างกันสองทิศ')
  {
    const ผ่าน = ตัดสินคำขอ(new URL('https://x/api/returns?return=CN-1'), 'GET')
    ok('เส้นของจอรับคืนผ่าน', ผ่าน.ผ่าน === true, JSON.stringify(ผ่าน))
    const ตก = ตัดสินคำขอ(new URL('https://x/api/returns?days=30'), 'GET')
    ok('🔴 `?days=30` ต้องไม่ผ่าน (คือบั๊กที่ทำให้จอ /returns ตาย 21 วัน)', ตก.ผ่าน === false, JSON.stringify(ตก))
    const สั้น = ตัดสินคำขอ(new URL('https://x/api/returns?list=orders&q=ab'), 'GET')
    ok('🔴 คำค้นสั้นกว่า 3 ตัวต้องไม่ผ่าน', สั้น.ผ่าน === false, JSON.stringify(สั้น))
    const พ่วง = ตัดสินคำขอ(new URL('https://x/api/returns?return=CN-1&movedel=1'), 'GET')
    ok('🔴 พารามิเตอร์แปลกปลอมที่พ่วงมาต้องไม่ผ่าน', พ่วง.ผ่าน === false, JSON.stringify(พ่วง))
  }

  /* ── ② ของจริงในรีโป: ทุกจุดที่ยิงเส้นนี้ต้องผ่านด่าน ── */
  console.log('② ทุกจุดในรีโปที่ยิง /api/returns')
  const พบ = []
  for (const f of [...เดิน('app'), ...เดิน('lib')]) {
    const เนื้อ = ตัดคอมเมนต์(readFileSync(f, 'utf8'))
    for (const จุด of หาเส้นในไฟล์(เนื้อ)) {
      const หลัง = เนื้อ.slice(จุด.at, จุด.at + 400)
      const method = /method:\s*'POST'|method:\s*"POST"/.test(หลัง) ? 'POST' : 'GET'
      พบ.push({ f, url: จุด.url, method })
    }
  }
  /* 🔴 กวาดไม่เจอสักจุด = **ตะแกรงพัง ไม่ใช่ผ่าน** (ในรีโปนี้มีจอรับคืนยิงอยู่จริงหลายจุด) */
  ok('ตะแกรงยังเจอจุดที่ยิงเส้นนี้ (ไม่เจอ = ตะแกรงพัง)', พบ.length > 0, `เจอ ${พบ.length}`)
  for (const { f, url, method } of พบ) {
    const ผล = ตัดสินคำขอ(new URL(`https://x${url}`), method)
    const อีกทิศ = ตัดสินคำขอ(new URL(`https://x${url}`), method === 'GET' ? 'POST' : 'GET')
    const แนะ = !ผล.ผ่าน && อีกทิศ.ผ่าน ? ` (ผ่านถ้าใช้ ${method === 'GET' ? 'POST' : 'GET'} — เมธอดไม่ตรง)` : ''
    ok(`${f}: ${method} ${url}`, ผล.ผ่าน === true, `${ผล.เหตุ ?? ''}${แนะ}`)
  }
  console.log(`   (ตรวจไปทั้งหมด ${พบ.length} จุด)`)
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
