#!/usr/bin/env node
/* เทียบ "ท่อมีเส้นอะไรบ้าง" กับ "จอเรียกอะไรบ้าง" — หาของที่ท่อมีแต่ไม่มีใครใช้
 *
 * 🔴 **ที่มา 18 ก.ย. 2569 (ค่ำ)** — เจอเส้น `list=channel-gaps` ที่ท่อมีมาตลอด
 *    **ไม่มีจอไหนเรียกเลยทั้ง repo** และในนั้นมี 91 รหัสที่เคยขายได้บนช่องทางนั้นแล้วเงียบ
 *    ทั้งที่ยังมีของในคลัง 96,944 ชิ้น ⇒ เป็นเรื่องเงิน ไม่ใช่ของประดับ
 *    ⚠️ **วิธีที่เจอคือความบังเอิญ** — ยิงชื่อ list ผิด แล้วท่อตีกลับ 400 พร้อมรายชื่อ `accepts`
 *    CEO สรุปเองว่า "ท่อมีของที่ไม่มีใครรู้ว่ามี และวิธีค้นพบคือความบังเอิญ ⇒ นั่นคือปัญหา"
 *    ⇒ สคริปต์นี้ทำให้ตรวจได้ ไม่ต้องรอความบังเอิญอีก
 *
 * 🚫 **ไม่อยู่ใน prebuild โดยตั้งใจ** — มันต้องยิงเน็ตและต้องมีคีย์
 *    ด่านที่พึ่งเน็ตจะทำให้ build ตกในวันที่ท่อล่ม ซึ่งเป็นวันที่เราต้องการ deploy ที่สุด
 *    ⇒ สั่งรันเองเป็นครั้ง ๆ:  node scripts/check-pipe-coverage.mjs
 *    (ต้องมี GUCUT_WEB_ADMIN_KEY ใน .env.local หรือใน env)
 *
 * ⚠️ **รายชื่อของท่ออ่านสดทุกครั้ง ไม่เก็บสำเนาไว้ใน repo** — สำเนาจะกลายเป็นคำเท็จวันที่ท่อเพิ่มเส้น
 *    (บทเรียนของวันเดียวกัน: เลขเกณฑ์/รายการที่ลอกไว้สองที่จะเพี้ยนจากกันเสมอ)
 *
 * 🔴 **ข้อจำกัดที่ต้องรู้ — `accepts` ของท่อยังไม่ครบ (พบ 18 ก.ย. 2569 ทันทีที่เขียนสคริปต์นี้)**
 *    `list=returns-inbox` **ใช้งานได้จริง** (ตอบ 200 พร้อม rows/total/qFields)
 *    แต่ **ไม่อยู่ใน `accepts` ทั้ง 23 ชนิด** ⇒ สารบัญที่เราใช้เป็นแหล่งความจริง **ไม่ครบ**
 *    ยิงตรวจเทียบแล้ว: ชื่ออื่นที่ลองทั้งหมด (returns-receive · shipments · payments · slips · users · roles)
 *    ได้ 400 ตามปกติ ⇒ ไม่ใช่ว่าท่อรับทุกชื่อ · เป็นเส้นที่มีจริงแต่ตกสารบัญ
 *    ⇒ **ผลของสคริปต์นี้จึงเป็น "อย่างน้อยเท่านี้" ไม่ใช่ "ครบเท่านี้"** — แจ้งฝั่งท่อแล้ว
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

/* อ่านคีย์จาก env ก่อน แล้วค่อยลอง .env.local (ไฟล์นี้ถูก ignore จาก git อยู่แล้ว) */
function คีย์() {
  if (process.env.GUCUT_WEB_ADMIN_KEY) return process.env.GUCUT_WEB_ADMIN_KEY
  try {
    const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^GUCUT_WEB_ADMIN_KEY=(.+)$/m)
    return m ? m[1].trim() : null
  } catch { return null }
}

function walk(d, out = []) {
  let names
  try { names = readdirSync(d) } catch { return out }
  for (const n of names) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') walk(p, out) }
    else if (n.endsWith('.tsx') || n.endsWith('.ts')) out.push(p)
  }
  return out
}

const key = คีย์()
if (!key) {
  console.error('🔴 ไม่มี GUCUT_WEB_ADMIN_KEY — สคริปต์นี้ต้องยิงท่อจริงถึงจะรู้ว่าท่อมีเส้นอะไร')
  console.error('   ใส่ใน .env.local หรือ export ก่อนรัน · **ห้าม hardcode ลงไฟล์นี้** (repo เป็น PUBLIC)')
  process.exit(1)
}

/* ถามท่อด้วยชื่อที่รู้ว่าไม่มีจริง ⇒ ท่อตอบ 400 พร้อมรายชื่อ accepts ทั้งหมด
   (ใช้ข้อความ error ของท่อเป็นแหล่งความจริง ไม่ใช่รายชื่อที่เราจำไว้เอง) */
const res = await fetch('https://gucut.com/api/core?list=__ไม่มีจริง__&limit=1', {
  headers: { 'x-admin-key': key },
})
const j = await res.json().catch(() => null)
const ท่อมี = Array.isArray(j?.accepts) ? j.accepts : null
if (!ท่อมี) {
  console.error(`🔴 ท่อไม่ได้ส่งรายชื่อ accepts มา (HTTP ${res.status}) — ตรวจไม่ได้รอบนี้`)
  console.error('   ⇒ **ไม่ใช่ "ไม่มีเส้นที่ไม่ได้ใช้"** แค่ยังไม่รู้ · ' + JSON.stringify(j).slice(0, 160))
  process.exit(1)
}

/* จอเรียกอะไรบ้าง — ทั้ง `list=xxx` ใน URL ตรง ๆ และ `list: 'xxx'` ใน URLSearchParams */
const จอเรียก = new Set()
for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/list=([a-z-]+)/g)) จอเรียก.add(m[1])
  for (const m of s.matchAll(/list:\s*'([a-z-]+)'/g)) จอเรียก.add(m[1])
}

const ไม่มีใครใช้ = ท่อมี.filter((x) => !จอเรียก.has(x))
const เรียกแต่ท่อไม่รู้จัก = [...จอเรียก].filter((x) => !ท่อมี.includes(x)).sort()

console.log(`ท่อมี ${ท่อมี.length} ชนิด · จอเรียก ${จอเรียก.size} ชนิด`)
if (ไม่มีใครใช้.length) {
  console.log(`\n💤 ท่อมีแต่ไม่มีจอไหนเรียก ${ไม่มีใครใช้.length} เส้น: ${ไม่มีใครใช้.join(' · ')}`)
  console.log('   ⇒ **ไม่ใช่ของพัง** แต่คือของที่อาจมีค่าและไม่มีใครรู้ว่ามี — เปิดดูเนื้อก่อนตัดสิน')
} else {
  console.log('\n✅ ทุกเส้นที่ท่อมี มีจอเรียกใช้อย่างน้อยหนึ่งจอ')
}
if (เรียกแต่ท่อไม่รู้จัก.length) {
  console.log(`\n⚠️ จอเรียกชื่อที่ท่อไม่รู้จัก: ${เรียกแต่ท่อไม่รู้จัก.join(' · ')}`)
  console.log('   ⚠️ อาจเป็นผลลวงจากตัวกวาด — เช่นจอใช้ `zortlist=` ซึ่งเป็นคนละพารามิเตอร์')
  console.log('   ⇒ **ยิงยืนยันทีละชื่อก่อนแจ้ง** (ของจริงรอบแรกของผมลวงทั้งหมด)')
}
