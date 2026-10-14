#!/usr/bin/env node
/* วัดว่า **ท่อส่งสัญญาแท็บชำระเงินครบจริงหรือยัง** — อ่านอย่างเดียว · ยิงของจริง
 *
 * 🔴 ที่มา 14 ต.ค. 2569: จอ `/core/sales` ขอ 4 ข้อจากฝั่งท่อ (byPayStatus · payStatusesAll ·
 *    byStatus ฐานใหม่ · tabBase) และข้อที่อันตรายที่สุดคือ **"ข้อ byStatus ห้ามมาคนเดียว"**:
 *    ถ้าท่อเปลี่ยนฐานของ `byStatus` แต่ไม่ส่ง `tabBase` มา **จอจะซ่อนตัวเลขแท็บไว้ฟรีตลอดกาล**
 *    และไม่มีอะไรฟ้อง เพราะ **ชื่อช่องไม่เปลี่ยนเลย** ⇒ ด่านที่ดูแต่ชื่อช่องมองไม่เห็นข้อนี้
 * ⇒ ตัวนี้จึงวัด **พฤติกรรม** ไม่ใช่ชื่อช่อง: ยิงสองครั้ง (ไม่กรอง vs กรอง `paystatus=`)
 *    แล้วถามว่า `byStatus` **เท่ากันไหม** — เท่ากัน = ฐานไม่ผูกกับ paystatus แล้วจริง
 *
 * 🔑 ตัวตัดสิน `ฐานตัวนับไม่ผูกกับชำระเงิน` **import มาจาก `lib/sales-tabs.ts` ตัวเดียวกับที่จอใช้**
 *    (ลอกกฎมาไว้ที่นี่อีกชุด = วันที่จอเปลี่ยนกฎ ตัววัดจะเขียวฟรี)
 *
 * ⚠️ สามสถานะ ห้ามยุบ: ครบสัญญา · ขัดกัน (แดง) · **ท่อยังไม่ส่ง / ตัดสินไม่ได้** (ไม่ใช่แดง)
 * 🚫 ไม่อยู่ใน prebuild — ต้องใช้เน็ตและคีย์ · รันหลังท่อ deploy: node scripts/วัดสัญญาแท็บชำระเงิน.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ฐานตัวนับไม่ผูกกับชำระเงิน, ช่องสัญญาแท็บชำระเงิน } from '../lib/sales-tabs.ts'

const ฐาน = process.env.GUCUT_WEB_BASE || 'https://gucut.com'
const ร้าน = 'z1'
const ถึง = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const จาก = new Date(Date.now() + 7 * 3600e3 - 365 * 864e5).toISOString().slice(0, 10)
/** ค่าดิบที่ใช้ทดสอบ — ต้องเป็นค่าที่ **มีอยู่จริงในข้อมูล** ไม่งั้นตัวกรองไม่กัด ⇒ ตัดสินไม่ได้ */
const ค่าทดสอบ = 'Pending'

/* 🔑 สคริปต์อ่านกุญแจเอง — ห้ามให้กุญแจไปโผล่เป็นตัวแปรเชลล์หรือใน log */
let คีย์
try {
  คีย์ = readFileSync(join(homedir(), '.gucut-admin-key'), 'utf8').trim()
} catch {
  console.log('⏳ ไม่มี ~/.gucut-admin-key ⇒ **ยังไม่ได้วัด** (ไม่ใช่ "ท่อไม่ส่ง")')
  process.exit(0)
}

const ยิง = async (เพิ่ม = '') => {
  const url = `${ฐาน}/api/core?list=orders&store=${ร้าน}&from=${จาก}&to=${ถึง}`
    + `&cancelled=1&limit=1${เพิ่ม}`
  const r = await fetch(url, { headers: { 'x-admin-key': คีย์ } })
  if (!r.ok) throw new Error(`HTTP ${r.status} จาก /api/core`)
  return r.json()
}

const เรียง = (xs) => (Array.isArray(xs) ? xs : [])
  .map((x) => `${x.status}=${Number(x.orders || 0)}`).sort().join(' · ')

let ไม่กรอง, กรอง
try {
  ;[ไม่กรอง, กรอง] = await Promise.all([ยิง(), ยิง(`&paystatus=${ค่าทดสอบ}`)])
} catch (e) {
  console.log(`⏳ ยิงท่อไม่ได้ (${String(e.message).slice(0, 80)}) ⇒ **ยังไม่ได้วัด**`)
  process.exit(0)
}

console.log(`ขอบเขต: ร้าน ${ร้าน} · ${จาก}–${ถึง} · รวมใบยกเลิก · paystatus ทดสอบ = ${ค่าทดสอบ}`)
console.log(`   ทั้งชุด total=${ไม่กรอง.total} · กรองแล้ว total=${กรอง.total}`)

const มี = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const ขาด = ช่องสัญญาแท็บชำระเงิน.filter((k) => !มี(ไม่กรอง, k))
const ฐานประกาศแล้ว = ฐานตัวนับไม่ผูกกับชำระเงิน(ไม่กรอง.tabBase)

/* ── พฤติกรรมของฐาน: byStatus เท่ากันทั้งสองคำขอไหม ───────────────────────────
   ⚠️ ตัวกรองต้อง **กัดจริง** ก่อน ไม่งั้นเท่ากันแบบไม่มีความหมาย
      (รูปเดียวกับที่สารบัญท่อเขียนไว้เอง: "ได้ 0 ทั้งสองชุด ⇒ พิสูจน์อะไรไม่ได้") */
const กัด = Number(กรอง.total) !== Number(ไม่กรอง.total) && Number(กรอง.total) > 0
const เท่ากัน = เรียง(ไม่กรอง.byStatus) === เรียง(กรอง.byStatus)
const ฐานตามพฤติกรรม = !กัด ? null : เท่ากัน      // null = ตัดสินไม่ได้

console.log(`   byStatus ไม่กรอง : ${เรียง(ไม่กรอง.byStatus) || '(ไม่มี)'}`)
console.log(`   byStatus กรองแล้ว: ${เรียง(กรอง.byStatus) || '(ไม่มี)'}`)
console.log(`   ตัวกรองกัดจริง: ${กัด ? 'ใช่' : 'ไม่ ⇒ ตัดสินฐานไม่ได้'}`
  + ` · ฐานตามพฤติกรรม: ${ฐานตามพฤติกรรม === null ? 'ไม่รู้' : ฐานตามพฤติกรรม ? 'ไม่ผูกกับ paystatus' : 'ยังผูกอยู่'}`)
console.log(`   ช่องที่ขาด: ${ขาด.length ? ขาด.join(' · ') : '(ไม่ขาด)'}`
  + ` · tabBase ประกาศว่าไม่ผูกกับ paystatus: ${ฐานประกาศแล้ว ? 'ใช่' : 'ไม่'}`)
if (มี(ไม่กรอง, 'payStatusesAll')) {
  const v = ไม่กรอง.payStatusesAll
  console.log(`   payStatusesAll = ${v === null ? 'null (อ่านไม่ได้ — ถูกตามสัญญา)' : JSON.stringify(v)}`)
}
if (Array.isArray(ไม่กรอง.byPayStatus)) {
  console.log('   byPayStatus = ' + ไม่กรอง.byPayStatus
    .map((x) => `${x.payStatus}=${Number(x.orders || 0)}`).sort().join(' · '))
}

/* ── คำตัดสิน ───────────────────────────────────────────────────────────────── */
const ปัญหา = []
// 🔴 ข้อที่ด่านนี้เกิดมาจับ: ฐานเปลี่ยนตามพฤติกรรม แต่ไม่ประกาศ ⇒ จอซ่อนตัวเลขฟรีตลอดกาล
if (ฐานตามพฤติกรรม === true && !ฐานประกาศแล้ว)
  ปัญหา.push('byStatus ไม่ถูกกรองด้วย paystatus แล้ว **แต่ไม่มี tabBase ประกาศ** ⇒ จอจะซ่อนตัวเลขแท็บไว้ทั้งที่เชื่อได้แล้ว')
// 🔴 ทิศกลับ: ประกาศแล้วแต่พฤติกรรมยังผูกอยู่ ⇒ จอจะโชว์เลขที่กดแล้วไม่ตรง (แย่กว่าซ่อน)
if (ฐานประกาศแล้ว && ฐานตามพฤติกรรม === false)
  ปัญหา.push('tabBase ประกาศว่าไม่ผูกกับ paystatus **แต่พฤติกรรมยังผูกอยู่** ⇒ จอจะโชว์ตัวเลขแท็บที่กดแล้วไม่ตรง')
if (มี(ไม่กรอง, 'byPayStatus') && !มี(ไม่กรอง, 'payStatusesAll'))
  ปัญหา.push('มี byPayStatus แต่ไม่มี payStatusesAll ⇒ แท็บจะหายตอนกรองแล้วไม่เจอสักใบ (เหตุผลเดียวกับ statusesAll)')

if (ปัญหา.length) {
  console.log('\n🔴 **สัญญาขัดกัน**')
  for (const x of ปัญหา) console.log(`   · ${x}`)
  process.exit(1)
}
if (ขาด.length === ช่องสัญญาแท็บชำระเงิน.length && ฐานตามพฤติกรรม !== true) {
  console.log('\n⏳ **ท่อยังไม่ส่งของชุดนี้** (ไม่ใช่ความผิด) — จอรองรับไว้แล้วแบบสามสถานะ')
  process.exit(0)
}
if (ขาด.length) {
  console.log(`\n🟡 **มาไม่ครบ** — ยังขาด ${ขาด.join(' · ')} · จออ่านว่า "ไม่รู้" ไม่ใช่ 0`)
  process.exit(0)
}
console.log('\n✅ **ครบสัญญาสี่ข้อ และพฤติกรรมตรงกับที่ประกาศ**')
