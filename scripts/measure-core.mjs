#!/usr/bin/env node
/* วัดเวลาเส้นที่หนัก แล้วเทียบก่อน/หลังแก้ได้ (9 ก.ย. 2569)
 *
 * เกิดจาก: `?bycustomer=1&days=90` ล้มด้วย D1 429 (CPU time limit) ที่ ~37 วิ
 * ไล่ตัวแปรด้วยมือแล้วพบว่า **จำนวนวันคือตัวการ ไม่ใช่ limit** (30 วันผ่านที่ 17.6 วิ)
 * ⇒ ทำให้วัดซ้ำได้เหมือนเดิมทุกครั้ง แทนการยิงมือแล้วจำตัวเลขเอง
 *
 * ใช้: node scripts/measure-core.mjs            (ค่าเริ่มต้น: เส้น bycustomer 4 แบบ)
 *      node scripts/measure-core.mjs 'monthly=1&months=120'   ← วัดเส้นอื่น
 *
 * ⚠️ **ต้องพิสูจน์ว่าคำขอแตะงานจริง ไม่ใช่แค่ตอบเร็ว** (กฎ measure-must-prove-work)
 *    401/403 ตอบ 24 ไบต์ใน 0.4 วิ ดูเหมือนผลวัดที่ดีที่สุดในตาราง
 *    ⇒ สคริปต์นี้จึงพิมพ์ทั้ง **รหัส HTTP · ขนาดคำตอบ · จำนวนแถวที่ได้** คู่กับเวลาเสมอ
 * ⚠️ ยิง 3 รอบแล้วรายงานทั้งสามค่า — รอบเดียวไม่ใช่การวัด (แคชอุ่น/เย็นต่างกันมาก)
 * ⚠️ อ่านอย่างเดียว ไม่เขียนอะไรทั้งสิ้น
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.GUCUT_WEB_BASE || 'https://gucut.com'
const KEY = process.env.GUCUT_ADMIN_KEY
  || (() => { try { return readFileSync(join(homedir(), '.gucut-admin-key'), 'utf8').trim() } catch { return '' } })()
if (!KEY) { console.error('ไม่มีรหัสหลังร้าน — ตั้ง GUCUT_ADMIN_KEY หรือวางไว้ที่ ~/.gucut-admin-key'); process.exit(2) }

const ROUNDS = 3
const QUERIES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'bycustomer=1&days=90&limit=500',
      'bycustomer=1&days=90&limit=100',
      'bycustomer=1&days=30&limit=500',
      'bycustomer=1&days=30&limit=100',
    ]

/** นับ "แถวที่ได้จริง" จากคีย์ที่เส้นต่าง ๆ ใช้ — ไม่รู้จักก็บอกว่าไม่รู้ ห้ามเดาเป็น 0 */
function rowCount(body) {
  if (!body || typeof body !== 'object') return null
  for (const k of ['customers', 'rows', 'items', 'months', 'saved']) {
    if (Array.isArray(body[k])) return body[k].length
  }
  return null
}

for (const q of QUERIES) {
  const runs = []
  for (let i = 0; i < ROUNDS; i++) {
    const t0 = Date.now()
    let status = 0; let bytes = 0; let body = null; let err = ''
    try {
      const res = await fetch(`${BASE}/api/core?${q}`, { headers: { 'x-admin-key': KEY } })
      status = res.status
      const text = await res.text()
      bytes = text.length
      try { body = JSON.parse(text) } catch { err = 'คำตอบไม่ใช่ JSON' }
    } catch (e) { err = String(e instanceof Error ? e.message : e) }
    runs.push({ ms: Date.now() - t0, status, bytes, rows: rowCount(body), error: err || body?.error || null })
  }

  const times = runs.map((r) => r.ms)
  const ok = runs.filter((r) => r.status === 200 && !r.error).length
  console.log(`\n${q}`)
  console.log(`  เวลา (${ROUNDS} รอบ): ${times.map((t) => (t / 1000).toFixed(1) + ' วิ').join(' · ')}`)
  for (const r of runs) {
    const rowTxt = r.rows === null ? 'นับแถวไม่ได้' : `${r.rows.toLocaleString('th-TH')} แถว`
    console.log(`    HTTP ${r.status} · ${r.bytes.toLocaleString('th-TH')} ไบต์ · ${rowTxt}`
      + (r.error ? ` · ⚠️ ${String(r.error).slice(0, 70)}` : ''))
  }
  /* 🔴 เร็วเพราะทำงานสำเร็จ กับ เร็วเพราะถูกปฏิเสธ ต้องแยกให้ขาด */
  if (ok === 0) console.log('  ⇒ 🔴 ล้มทั้ง 3 รอบ — เวลาข้างบน**ไม่ใช่เวลาทำงาน** แต่เป็นเวลาจนกว่าจะล้ม')
  else if (ok < ROUNDS) console.log(`  ⇒ 🟡 สำเร็จ ${ok}/${ROUNDS} รอบ — ไม่นิ่ง ห้ามสรุปจากค่าเดียว`)
  else console.log(`  ⇒ ✅ สำเร็จทั้ง ${ROUNDS} รอบ`)
}

console.log('\n⚠️ เพดานของ Netlify คือ ~26 วิต่อคำขอ — ค่าที่เข้าใกล้ 20 วิถือว่าอันตรายแล้ว')
console.log('⚠️ ตัวเลขนี้รวมเวลาเดินทางข้ามทวีปด้วย (ฟังก์ชันอยู่ US · D1 อยู่ APAC ~286ms ต่อรอบคิวรี)')
