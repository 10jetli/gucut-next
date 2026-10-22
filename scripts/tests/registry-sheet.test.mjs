#!/usr/bin/env node
/* ตัวดึงชีททะเบียนอัตโนมัติ (`lib/registry-sheet.ts`) — ท่านประธานสั่ง 22 ต.ค. 2569 "ทำให้มันออโต้สิ"
 *
 * 🔴 ทำไมเทสนี้สำคัญ: ออโต้ที่ผิดจะผิด **ทุกช่องทางพร้อมกัน** (ใบสั่ง-สต็อกออโต้.md ข้อ ③)
 *    ⇒ ทุกตาข่ายต้อง **เคยถูกป้อนของเสียแล้วร้อง** ไม่ใช่แค่ผ่านตอนของดี
 * ⚠️ เรียกฟังก์ชันตัวจริงทั้งหมด · ไฟล์ .xlsx สร้างจริงด้วย jszip (ไม่ใช่ก้อน JSON ที่ทำเป็น xlsx)
 * ⚠️ fetch ปลอมแทน Google — **ตัวปลอมจดทุกคำขอ** ⇒ เทสยืนยันได้ว่าไม่มีคำขอไหนเป็นเมธอดเขียน
 */
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const พาธjszip = require.resolve('jszip')

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}

/* ── สร้าง .xlsx จริง: แท็บละอาร์เรย์ของแถว · ใช้ sharedStrings เหมือนไฟล์ที่ Excel บันทึก ── */
async function ทำxlsx(แท็บ) {
  const zip = new JSZip()
  const คำ = []
  const ดัชนี = (s) => { let i = คำ.indexOf(s); if (i < 0) { คำ.push(s); i = คำ.length - 1 } return i }
  const คอล = (i) => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26) } return s }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  แท็บ.forEach((t, n) => {
    const rows = t.แถว.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === '' ? '' : typeof v === 'number'
      ? `<c r="${คอล(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${คอล(ci)}${ri + 1}" t="s"><v>${ดัชนี(v)}</v></c>`).join('')}</row>`).join('')
    zip.file(`xl/worksheets/sheet${n + 1}.xml`, `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`)
  })
  zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns:r="r"><sheets>${แท็บ.map((t, n) => `<sheet name="${esc(t.ชื่อ)}" sheetId="${n + 1}" r:id="rId${n + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships>${แท็บ.map((_, n) => `<Relationship Id="rId${n + 1}" Target="worksheets/sheet${n + 1}.xml"/>`).join('')}</Relationships>`)
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst>${คำ.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`)
  return zip.generateAsync({ type: 'uint8array' })
}

/* ── Blob ปลอม (ในหน่วยความจำ) ── */
const ปลอมBlobs = `
const ของ = globalThis.__ถังทดสอบ ??= new Map()
export function getStore() {
  return {
    async get(k, o) { if (!ของ.has(k)) return null; const v = ของ.get(k); return o?.type === 'json' ? JSON.parse(v) : v },
    async set(k, v) { ของ.set(k, String(v)) },
    async setJSON(k, v) { ของ.set(k, JSON.stringify(v)) },
  }
}`

const ไฟล์ = 'lib/registry-sheet.ts'
let งาน
try {
  งาน = คอมไพล์เพื่อทดสอบ({ ไฟล์: [ไฟล์], ปลอม: { '@netlify/blobs': ปลอมBlobs, jszip: `import J from ${JSON.stringify(พาธjszip)}; export default J` } })
  const m = await import(งาน.พาธของ(ไฟล์))
  const { อ่านxlsx, สำรวจ, ลายนิ้วมือ, ลดฮวบ, วิ่งรอบ, เก็บโทเคน, ไฟล์ชีท, สิทธิ์ที่ขอ } = m
  const ถัง = globalThis.__ถังทดสอบ

  /* หัวคอลัมน์สมมติเพื่อทดสอบตัวอ่าน — 🔴 ไม่ใช่หัวของชีทจริง (ยังไม่มีใครส่งมา) */
  const หัว = ['ลำดับ', 'หมายเลขซีเรียล', 'ยี่ห้อ', 'ขนาด', 'วันที่จำหน่าย', 'ผู้ซื้อ']
  const เล่ม = [
    { ชื่อ: '2566', แถว: [['บัญชีรับและจำหน่าย'], [], หัว, [1, 'S1', 'KINGKONG', '30', '', ''], [2, 'S2', 'KINGKONG', '30', '1/10/2569', 'ลูกค้าทดสอบ']] },
    { ชื่อ: '2567 & ใหม่', แถว: [หัว, [1, 'S9', 'NEWWAVE', '16', '', '']] },
  ]
  const ไบต์ = await ทำxlsx(เล่ม)

  console.log('\n── อ่าน .xlsx จริง ──')
  const แท็บ = await อ่านxlsx(ไบต์)
  ok('ได้ 2 แท็บ ชื่อถูก (ถอด &amp;)', แท็บ.length === 2 && แท็บ[1].ชื่อ === '2567 & ใหม่', JSON.stringify(แท็บ.map((t) => t.ชื่อ)))
  ok('ตัวเลขกับข้อความอ่านถูกตำแหน่ง', แท็บ[0].แถว[3][1] === 'S1' && แท็บ[0].แถว[3][0] === '1', JSON.stringify(แท็บ[0].แถว[3]))
  ok('ช่องว่างตรงกลางไม่ทำให้คอลัมน์เลื่อน', แท็บ[0].แถว[3][3] === '30' && แท็บ[0].แถว[4][5] === 'ลูกค้าทดสอบ', JSON.stringify(แท็บ[0].แถว[4]))
  let พัง = ''
  try { await อ่านxlsx(new Uint8Array([1, 2, 3])) } catch (e) { พัง = String(e?.message || e) }
  ok('ไบต์ที่ไม่ใช่ xlsx ⇒ โยน error (ไม่คืนเล่มเปล่าเงียบ ๆ)', พัง !== '', พัง)

  console.log('\n── สำรวจ: เก็บแค่แถวหัว ห้ามเก็บแถวข้อมูล (มีชื่อลูกค้า) ──')
  const ส = สำรวจ(แท็บ)
  ok('เจอแถวหัวที่แถว 3 ของแท็บแรก', ส[0].แถวหัว === 3, JSON.stringify(ส[0]))
  ok('นับแถวมีของหลังหัว 2', ส[0].แถวมีของหลังหัว === 2, JSON.stringify(ส[0]))
  ok('ผลสำรวจไม่มีชื่อลูกค้าหรือซีเรียลเลย', !JSON.stringify(ส).includes('ลูกค้าทดสอบ') && !JSON.stringify(ส).includes('S1'), JSON.stringify(ส))
  const ส2 = สำรวจ(await อ่านxlsx(await ทำxlsx([{ ...เล่ม[0], แถว: [['บัญชี'], [], [...หัว.slice(0, 3), 'ความยาว', ...หัว.slice(4)], ...เล่ม[0].แถว.slice(3)] }, เล่ม[1]])))
  ok('หัวเปลี่ยนหนึ่งคำ ⇒ ลายนิ้วมือเปลี่ยน', ลายนิ้วมือ(ส) !== ลายนิ้วมือ(ส2))

  console.log('\n── ตาข่าย: ลดฮวบ ──')
  ok('รอบแรก (ไม่มีของเดิม) ⇒ ไม่ร้อง', ลดฮวบ(null, { a: 1 }).length === 0)
  ok('9 → 8 ⇒ ไม่ร้อง (ขายจริงทีละชิ้น)', ลดฮวบ({ a: 9 }, { a: 8 }).length === 0)
  ok('8 → 0 ⇒ ร้อง', ลดฮวบ({ a: 8 }, { a: 0 }).length === 1)
  ok('14 → 6 ⇒ ร้อง (ลดเกินครึ่ง)', ลดฮวบ({ a: 14 }, { a: 6 }).length === 1)
  ok('รหัสหายจากผลนับ ⇒ ร้อง (ไม่รู้ ≠ ไม่มี)', ลดฮวบ({ a: 3 }, {}).length === 1)
  ok('1 → 0 ⇒ ร้อง (เหลือ 0 ทั้งที่รอบก่อนมี)', ลดฮวบ({ a: 1 }, { a: 0 }).length === 1)

  console.log('\n── วิ่งรอบจริงกับ Google ปลอม ──')
  process.env.GOOGLE_CLIENT_ID = 'id'; process.env.GOOGLE_CLIENT_SECRET = 'sec'
  const คำขอ = []
  let โหมด = 'ดี'
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url); คำขอ.push({ u, method: o.method ?? 'GET' })
    const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } })
    if (u.startsWith('https://oauth2.googleapis.com/token')) return โหมด === 'โทเคนตาย' ? J({ error: 'invalid_grant' }, 400) : J({ access_token: 'AT' })
    if (u.includes(`/files/${ไฟล์ชีท}?fields=`)) return โหมด === 'ไม่มีสิทธิ์' ? J({ error: { message: 'File not found' } }, 404) : J({ id: ไฟล์ชีท, name: 'บัญชี.xlsx', mimeType: 'x', modifiedTime: '2026-10-05T13:38:44Z' })
    if (u.includes(`/files/${ไฟล์ชีท}?alt=media`)) return โหมด === 'โหลดพัง' ? new Response('x', { status: 500 }) : new Response(ไบต์)
    return J({ error: 'ไม่รู้จัก' }, 599)
  }

  let r = await วิ่งรอบ()
  ok('ยังไม่มี token ⇒ ยังไม่ได้อนุญาต · ไม่ยิง Google เลย', r.สถานะ === 'ยังไม่ได้อนุญาต' && คำขอ.length === 0, JSON.stringify(r))

  โหมด = 'ไม่มีสิทธิ์'
  let g = await เก็บโทเคน('RT-คนอื่น')
  ok('บัญชีที่เปิดชีทไม่ได้ ⇒ ไม่เก็บ token', g.ok === false && !ถัง.has('token'), JSON.stringify(g))
  โหมด = 'ดี'
  g = await เก็บโทเคน('RT')
  ok('บัญชีที่เปิดชีทได้ ⇒ เก็บ token', g.ok === true && ถัง.has('token'), JSON.stringify(g))
  โหมด = 'ไม่มีสิทธิ์'
  g = await เก็บโทเคน('RT-คนอื่น')
  ok('บัญชีอื่นกดทีหลัง ⇒ ไม่ทับ token เดิม', JSON.parse(ถัง.get('token')).refresh === 'RT', ถัง.get('token'))

  โหมด = 'ดี'
  r = await วิ่งรอบ()
  ok('อ่านได้แต่ยังไม่มีกติกานับ ⇒ สำรวจ · ไม่ผลิตเป้า', r.สถานะ === 'สำรวจ' && !r.stocks && !ถัง.has('latest'), JSON.stringify(r).slice(0, 200))
  ok('รอบสำรวจจดหัวคอลัมน์ไว้ให้คนดู', r.สำรวจ?.[0]?.หัว?.includes('หมายเลขซีเรียล'), JSON.stringify(r.สำรวจ))

  for (const [ชื่อ, ม] of [['token ตาย', 'โทเคนตาย'], ['ดาวน์โหลดพัง', 'โหลดพัง']]) {
    โหมด = ม
    r = await วิ่งรอบ()
    ok(`${ชื่อ} ⇒ อ่านไม่ได้ + มีเหตุ · ไม่สร้างเป้า`, r.สถานะ === 'อ่านไม่ได้' && r.เหตุ && !ถัง.has('latest'), JSON.stringify(r))
  }
  const log = JSON.parse(ถัง.get('log'))
  ok('ทุกรอบถูกจด (4 รอบ ใหม่สุดก่อน)', log.length === 4 && log[0].สถานะ === 'อ่านไม่ได้' && log[3].สถานะ === 'ยังไม่ได้อนุญาต', JSON.stringify(log.map((x) => x.สถานะ)))

  console.log('\n── อ่านอย่างเดียว ──')
  const ยิงGoogle = คำขอ.filter((x) => x.u.includes('googleapis.com/drive'))
  ok('คำขอเข้า Drive ทุกตัวเป็น GET', ยิงGoogle.length > 0 && ยิงGoogle.every((x) => x.method === 'GET'), JSON.stringify(ยิงGoogle))
  ok('ไม่มีคำขอ copy/export/update ไฟล์', !คำขอ.some((x) => /\/copy|export|upload|batchUpdate/.test(x.u)), JSON.stringify(คำขอ.map((x) => x.u)))
  ok('ขอสิทธิ์ drive.readonly อย่างเดียว', สิทธิ์ที่ขอ === 'https://www.googleapis.com/auth/drive.readonly')
} catch (e) {
  ตก++
  console.log('  ❌ เทสล้มทั้งไฟล์:', e?.stack || e)
} finally {
  if (งาน?.ที่ออก) rmSync(งาน.ที่ออก, { recursive: true, force: true })
}

console.log(ตก === 0 ? '\n✅ ผ่านหมด' : `\n❌ ตก ${ตก} ข้อ`)
process.exit(ตก === 0 ? 0 : 1)
