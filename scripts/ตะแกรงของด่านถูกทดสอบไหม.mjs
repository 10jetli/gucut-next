#!/usr/bin/env node
/* **ด่านที่มี self-test ≠ ด่านที่ถูกทดสอบ** — 🚫 ไม่อยู่ใน prebuild (ช้า · แก้ไฟล์ชั่วคราว)
 * (19 ก.ย. 2569 · ใบ S2)
 *
 * 🔴 ที่มา: วันนี้ `check-public-paths-have-keys --self-test` **ยังเขียว**
 *    ทั้งที่ผมเอาตะแกรงของมันออกแล้วใส่ `/ZZNOPEZZ/` แทน
 *    ⇒ self-test นั้นทดสอบ "ทางเดินของสคริปต์" ไม่ได้ทดสอบ **ตัวที่ใช้ตัดสิน**
 *
 * 🔑 วิธีตรวจ: **ทำให้ตะแกรงพัง แล้วดูว่า self-test ร้องไหม**
 *    · self-test แดง ⇒ ✅ regex ตัวนั้นถูกทดสอบจริง
 *    · self-test เขียว ⇒ 🔴 regex ตัวนั้นพังแล้วไม่มีอะไรฟ้อง
 *
 * ═══ 🔴🔴 บทเรียนราคาแพงจากรุ่นแรกของไฟล์นี้เอง (19 ก.ย. 2569) ═══
 * รุ่นแรก **หาไฟล์ด่านด้วยเงื่อนไข "มีคำว่า self-test อยู่ในไฟล์"**
 * ⇒ ไฟล์นี้เองก็มีคำนั้น ⇒ มันรันตัวเองด้วย `--self-test`
 * ⇒ ซึ่งทำให้มันสแกนใหม่ทั้งรอบ แล้วรันตัวเองอีก **ไม่รู้จบ**
 * ⇒ ได้ลูกหลานนับสิบตัววิ่งพร้อมกัน **แก้ไฟล์ด่านจริงทับกันมั่ว**
 *   และเมื่อผมสั่งกู้ไฟล์ ตัวที่ยังวิ่งอยู่ก็เขียนทับกลับมาอีก
 * 🔑 สามข้อที่ได้ และเป็นเหตุผลของกติกาข้างล่าง:
 *   ① **เงื่อนไข "ไฟล์ที่มีคำว่า X" จะจับตัวเองเสมอ เมื่อเครื่องมือพูดถึง X**
 *      (ตะแกรงผูกกับ "คำ" ไม่ได้ผูกกับ "บทบาท" — โรคเดิมของทีมทั้งวัน)
 *   ② **เครื่องมือที่แก้ไฟล์จริง ต้องคืนใน `finally` และดักสัญญาณตาย**
 *      ตายกลางทาง = ไฟล์ค้างสภาพพัง และ **ไม่มีอะไรฟ้อง**
 *   ③ **ต้องมีทางกู้ที่ไม่ต้องพึ่งตัวเอง** ⇒ บังคับให้ไฟล์เป้าหมายสะอาดใน git ก่อน
 *      เพื่อให้ `git checkout --` เป็นตาข่ายรับเสมอ
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ สิ่งที่เครื่องมือนี้บอกไม่ได้:
 *    · regex ของข้อความที่พิมพ์ออกจอ ไม่ใช่ของการตัดสิน ⇒ เขียวถูกแล้ว
 *      ⇒ ผลลัพธ์คือ **รายการให้ไล่ดู ไม่ใช่รายการให้แก้**
 *    · ตะแกรง **กว้างเกิน** (ร้องใส่ของถูก) จับไม่ได้เลย — คนละทิศ ต้องปลูกของถูกทดสอบแยก
 *
 * วิธีใช้: node scripts/ตะแกรงของด่านถูกทดสอบไหม.mjs [ไฟล์ด่าน...]
 */
import { readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ตัวเอง = realpathSync(fileURLToPath(import.meta.url))

/* 🔒 ①+③ กันเรียกตัวเอง — ไม่ว่าจะถูกเรียกด้วยธงอะไร ไฟล์นี้ไม่ทำอะไรเลยเมื่อมี --self-test
   (ถ้าวันหนึ่งมีคนเผลอใส่ไฟล์นี้เข้ารายการเป้าหมาย มันต้องจบทันที ไม่ใช่เริ่มรอบใหม่) */
if (process.argv.includes('--self-test')) {
  console.log('⏭️  ไฟล์นี้ไม่มี self-test ของตัวเอง — และ **ห้ามมี** เพราะมันรันไฟล์อื่นด้วยธงนี้')
  console.log('   (รุ่นแรกจับตัวเองเข้ารายการ ⇒ เรียกตัวเองไม่รู้จบ ⇒ แก้ไฟล์ด่านจริงทับกันมั่ว)')
  process.exit(0)
}

/** ด่านที่มี `--self-test` — **ต้องไม่รวมตัวเอง** */
function ด่านที่มีself_test() {
  const out = []
  for (const ราก of ['scripts', 'scripts/lib']) {
    let รายการ
    try { รายการ = readdirSync(join(ROOT, ราก)) } catch { continue }
    for (const n of รายการ) {
      if (!n.endsWith('.mjs')) continue
      const p = join(ROOT, ราก, n)
      try {
        if (realpathSync(p) === ตัวเอง) continue          // 🔒 กติกา ①
        if (readFileSync(p, 'utf8').includes('--self-test')) out.push(p)
      } catch { /* อ่านไม่ได้ = ข้าม */ }
    }
  }
  return out
}

/** หน้ากากความยาวเท่าเดิม: ปิด shebang/คอมเมนต์ ด้วยช่องว่าง ⇒ ตำแหน่งยังตรงกับซอร์สจริง
 *  🔴 รุ่นแรกไม่มีหน้ากาก ⇒ นับคอมเมนต์และ shebang เป็น regex ⇒ รายงานเลขที่เป็นขยะเกินครึ่ง
 *  ⚠️ **ไม่ปิดสตริง** โดยตั้งใจ — regex หลายตัวมี `'` อยู่ข้างใน (เช่น `ส่งจริงได้\('…'\)`)
 *     ปิดสตริงแบบไม่รู้จัก regex จะกลืนตัวที่สำคัญที่สุดไปทั้งตัว (เจอมาแล้วรอบหนึ่ง) */
function หน้ากาก(src) {
  const a = src.split('')
  let i = 0
  const ปิด = (จาก, ถึง) => { for (let k = จาก; k < ถึง && k < a.length; k++) if (a[k] !== '\n') a[k] = ' ' }
  if (src.startsWith('#!')) { const e = src.indexOf('\n'); const ถึง = e < 0 ? src.length : e; ปิด(0, ถึง); i = ถึง }
  for (; i < src.length; i++) {
    const c = src[i], d = src[i + 1]
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const ถึง = e < 0 ? src.length : e + 2; ปิด(i, ถึง); i = ถึง - 1; continue }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const ถึง = e < 0 ? src.length : e; ปิด(i, ถึง); i = ถึง - 1; continue }
  }
  return a.join('')
}

function หาRegex(src) {
  const m = หน้ากาก(src)
  const out = []
  const re = /(^|[=(,:[\s!&|?])\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([gimsuy]*)/g
  for (const x of m.matchAll(re)) {
    const ดัชนี = x.index + x[1].length
    const ยาว = x[0].length - x[1].length
    out.push({ ดัชนี, ข้อความ: src.slice(ดัชนี, ดัชนี + ยาว) })
  }
  return out
}

const เป้า = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const ไฟล์ทั้งหมด = (เป้า.length ? เป้า.map((p) => join(ROOT, p)) : ด่านที่มีself_test())
  .filter((p) => { try { return realpathSync(p) !== ตัวเอง } catch { return false } })

if (!ไฟล์ทั้งหมด.length) {
  console.error('🔴 ไม่เจอไฟล์ด่านที่มี --self-test สักตัว ⇒ ตรวจอะไรไม่ได้รอบนี้ ⇒ ไม่ผ่าน')
  process.exit(1)
}

/* 🔒 กติกา ③ — ไฟล์เป้าหมายต้องสะอาดใน git ก่อน เพื่อให้ `git checkout --` เป็นตาข่ายรับ
   ถ้ามีของแก้ค้างอยู่ แล้วเครื่องมือตายกลางทาง จะแยกไม่ออกว่าอะไรเป็นของใคร */
const สกปรก = spawnSync('git', ['status', '--porcelain', '--', ...ไฟล์ทั้งหมด], { cwd: ROOT, encoding: 'utf8' })
if ((สกปรก.stdout || '').trim()) {
  console.error('🔴 ไฟล์ด่านที่จะทดสอบยังมีของแก้ค้างใน git:')
  console.error((สกปรก.stdout || '').trim().split('\n').map((l) => '   ' + l).join('\n'))
  console.error('   ⇒ เครื่องมือนี้ **แก้ไฟล์จริงชั่วคราว** ⇒ ต้องมี git เป็นตาข่ายรับก่อน')
  console.error('   ⇒ commit หรือ stash ก่อนแล้วค่อยรันใหม่')
  process.exit(1)
}

const รัน = (p) => spawnSync(process.execPath, [p, '--self-test'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })

/* 🔒 กติกา ② — ทะเบียนไฟล์ที่กำลังถูกแก้ + คืนทุกทางออก รวมถึงตอนถูกสั่งตาย */
const กำลังแก้ = new Map()
const คืนทั้งหมด = () => { for (const [p, s] of กำลังแก้) { try { writeFileSync(p, s) } catch { /* สุดทางแล้ว */ } } กำลังแก้.clear() }
process.on('exit', คืนทั้งหมด)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { คืนทั้งหมด(); process.exit(130) })
process.on('uncaughtException', (e) => { คืนทั้งหมด(); console.error('🔴 ตายกลางทาง — คืนไฟล์แล้ว:', e.message); process.exit(1) })

let ไม่ถูกทดสอบรวม = 0, ถูกทดสอบรวม = 0
for (const p of ไฟล์ทั้งหมด) {
  const rel = relative(ROOT, p)
  const เดิม = readFileSync(p, 'utf8')
  const ฐาน = รัน(p)
  if (ฐาน.status !== 0) {
    console.log(`⏭️  ${rel}: --self-test เดิมก็ไม่ผ่านอยู่แล้ว (exit ${ฐาน.status}) ⇒ **ข้าม ไม่ใช่ผ่าน**`)
    continue
  }
  const รายการ = หาRegex(เดิม)
  const ไม่ถูกทดสอบ = []
  let ถูกทดสอบ = 0
  for (const r of รายการ) {
    กำลังแก้.set(p, เดิม)
    try {
      writeFileSync(p, เดิม.slice(0, r.ดัชนี) + '/ZZNEVERMATCHZZ/' + เดิม.slice(r.ดัชนี + r.ข้อความ.length))
      const ผล = รัน(p)
      if (ผล.status === 0) ไม่ถูกทดสอบ.push(r.ข้อความ); else ถูกทดสอบ++
    } finally {
      writeFileSync(p, เดิม)
      กำลังแก้.delete(p)
    }
  }
  ถูกทดสอบรวม += ถูกทดสอบ
  ไม่ถูกทดสอบรวม += ไม่ถูกทดสอบ.length
  console.log(`${ไม่ถูกทดสอบ.length ? '🔴' : '✅'} ${rel}: regex ${รายการ.length} ตัว · self-test จับได้ ${ถูกทดสอบ} · **จับไม่ได้ ${ไม่ถูกทดสอบ.length}**`)
  for (const x of ไม่ถูกทดสอบ) console.log(`      ${x.length > 72 ? x.slice(0, 72) + '…' : x}`)
}

console.log(`\nรวม: ตะแกรงที่ self-test จับได้ ${ถูกทดสอบรวม} · **จับไม่ได้ ${ไม่ถูกทดสอบรวม}**`)
console.log('⚠️ "จับไม่ได้" = รายการให้ไล่ดู ไม่ใช่รายการให้แก้ — regex ของข้อความบนจอไม่ต้องมี self-test')
console.log('🔑 ตรวจได้ทิศเดียว: **แคบเกิน** · ทิศ "กว้างเกินจนร้องใส่ของถูก" ต้องปลูกของถูกทดสอบแยก')
