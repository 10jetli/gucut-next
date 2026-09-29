#!/usr/bin/env node
/* ซอง ZIP ของบิล (`lib/billzip.ts`) — **ของที่ถูกส่งต่อให้บัญชียื่นภาษี**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) 137 บรรทัด · ก่อนหน้านี้ **ไม่มีอะไรใน scripts/ เอ่ยถึงมันเลย**
 * ผู้ใช้จริง 2 เส้น: /api/bills/zip (คนกดบนจอ) · /api/bills/fetchzip (g1 ใช้รหัส)
 *
 * 🔑 ทำไมไฟล์นี้อันตรายเป็นพิเศษ แม้ตรรกะจะเหมือนหน้าจอ:
 *    **บิลที่หายจากซอง ไม่มีใครเห็นว่าหาย** — จอยังโชว์ครบ ซองยัง .zip เปิดได้
 *    คนเอาไปส่งบัญชีแล้วจบ ⇒ ค้นพบอีกทีตอนยื่นภาษีผิด
 *    ⇒ ทุกกรณี "ดึงไม่ได้" ต้องมีใบแจ้งอยู่ **ในซอง** ไม่ใช่แค่ใน log ที่ไม่มีใครอ่าน
 *
 * 🔑 กฎที่ตรึงไว้ และที่มาของแต่ละข้อ:
 *    ① ใบจริงใบเดียวกันคนละชื่อ = ใบเดียว (เคส TikTok ส.ค. 8→4 · 15 ก.ย. 2569)
 *    ② เดือนมาจาก **รอบบิลในเอกสาร** ไม่ใช่ชื่อไฟล์ (ท่านประธานสั่ง 18 ก.ย. 2569)
 *       🔴 และข้อนี้ต้อง **ตรงกับหน้าจอ** — เทสนี้จึงเทียบ `สร้างซองบิล` กับ `สรุปบิลรายเจ้า`
 *          ด้วยข้อมูลชุดเดียวกัน · ถ้าจอจัดใบนี้ไว้ ส.ค. แต่ซอง ส.ค. ไม่มีมัน = คนละกติกาสองที่
 *          (กฎ CLAUDE.md ข้อ 4: ห้ามเอาเลขจากแหล่งหนึ่งไปวางคู่กับของจากอีกแหล่ง)
 *    ③ ดึงไฟล์ไม่ได้ ⇒ **ห้ามหายเงียบ** ต้องมีใบ ⚠️ ในซอง และต้องถูกนับใน `ขาด`
 *    ④ ไม่มีบิลเลย ⇒ ใส่ใบอธิบายในซอง (ซองเปล่าอ่านไม่ออกว่าพังหรือไม่มีของ)
 *    ⑤ ชื่อไฟล์ที่มี `/` หรือ `\` ต้องถูกล้าง — ไม่งั้นซองแตกเป็นโฟลเดอร์ซ้อน
 *    ⑥ id ที่ที่เก็บคืนมาเป็นรูป `BLOB:<คีย์>` ⇒ ไม่ถอดคำนำหน้า = **อ่านไม่ได้ทุกใบ**
 *
 * ⚠️ ขอบเขต: ปลอม Gmail · ตัวแปลงอีเมลเป็น PDF · ที่เก็บบิล
 *    ของจริงทั้งหมด: ตรรกะคัดซ้ำ · จัดเดือน · bill-filing.ts · jszip (ซองที่อ่านกลับคือซองจริง)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'

const out = mkdtempSync(join(tmpdir(), `billzip-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  /* คอมไพล์ของจริงด้วย tsconfig ชั่วคราวที่รู้จัก `@/*` — ได้ type-check จริง แล้วค่อยต่อ import ไปตัวปลอม
     🔑 คอมไพล์ `billreport.ts` มาด้วย เพราะกฎข้อ ② ต้องเทียบซองกับจอ **ด้วยข้อมูลชุดเดียวกัน** */
  const tsconfig = join(out, 'tsconfig.json')
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      target: 'es2022', module: 'es2022', moduleResolution: 'bundler', skipLibCheck: true,
      strict: true, baseUrl: process.cwd(), paths: { '@/*': ['./*'] },
      /* ⚠️ tsconfig อยู่ใน /tmp ⇒ tsc หา @types เองไม่เจอ (ไฟล์พวกนี้ใช้ Buffer) */
      typeRoots: [join(process.cwd(), 'node_modules/@types')], types: ['node'],
      rootDir: join(process.cwd(), 'lib'), outDir: out, esModuleInterop: true,
    },
    files: [join(process.cwd(), 'lib/billzip.ts'), join(process.cwd(), 'lib/billreport.ts')],
  }))
  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')

  /* ที่เก็บบิลปลอม — อ่านคำสั่งจากไฟล์ JSON ที่เทสเขียนใหม่ก่อนทุกรอบ (ห้าม cache: ของค้างให้เลขที่น่าเชื่อแต่ผิด)
     🔑 `downloadBlobFile` ตอบเฉพาะคีย์ที่ **ถอด `BLOB:` แล้ว** ⇒ ถ้าโค้ดลืมถอด จะอ่านไม่ได้ทุกใบ (กฎ ⑥) */
  writeFileSync(join(out, 'ปลอม-billblobs.js'), `
import { readFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนซอง, 'utf8'));
const คีย์ของ = (ชื่อ) => 'b/tiktok/' + ชื่อ;
export async function loadBillIndexBlobs() { return อ่าน().ดัชนี; }
export async function loadRealPeriods() { return อ่าน().รอบบิล; }
export async function listVendorBlobNames() { return อ่าน().ชื่อไฟล์; }
export async function listVendorBlobFiles() {
  return อ่าน().ชื่อไฟล์.map((name) => ({ name, id: 'BLOB:' + คีย์ของ(name), size: 10 }));
}
export async function downloadBlobFile(key) {
  const p = อ่าน();
  const ชื่อ = p.ชื่อไฟล์.find((n) => คีย์ของ(n) === key);
  if (!ชื่อ) return null;                      // คีย์ผิดรูป (เช่นยังมี BLOB: ติดมา) ⇒ อ่านไม่ได้
  if ((p.ดาวน์โหลดไม่ได้ ?? []).includes(ชื่อ)) return null;
  return Buffer.from('%PDF-1.4 ' + ชื่อ);
}
`)
  writeFileSync(join(out, 'ปลอม-gmail.js'), `
import { readFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนซอง, 'utf8'));
export const VENDORS = [{ id: 'tiktok', name: 'TikTok', everyMonth: true, portal: null }];
export async function getAccessToken() { return 'โทเคนปลอม'; }
export async function fetchMessageDetail(_t, id) {
  return { subject: 'ใบเสร็จ ' + id, from: 'no-reply@tiktok', date: '2026-08-31', text: 'รวม 1,234 บาท', html: null };
}
export async function fetchAttachment(_t, _m, attachmentId) {
  if ((อ่าน().ดึงเมลไม่ได้ ?? []).includes(attachmentId)) throw new Error('Gmail ตอบ 429 quota');
  return Buffer.from('%PDF-1.4 แนบ ' + attachmentId);
}
export function extractAmounts(s) { return [{ amount: 1234, raw: String(s).slice(0, 20) }]; }
`)
  writeFileSync(join(out, 'ปลอม-emailPdf.js'),
    'export async function emailToPdf() { return Buffer.from(\'%PDF-1.4 สร้างจากอีเมล\') }\n')
  writeFileSync(join(out, 'ปลอม-vendors.js'),
    "export const BILL_VENDORS = [{ id: 'tiktok', name: 'TikTok', portal: null, everyMonth: true }]\n")

  /* ⚠️ **ลำดับมีผล** — เติม .js ให้พาธสัมพัทธ์ให้เสร็จก่อน แล้วค่อยแทนพาธย่อ
     สลับลำดับ ⇒ ได้ `ปลอม-xxx.js.js` แล้วพังด้วยเหตุที่ไม่เกี่ยวกับสิ่งที่ทดสอบ */
  for (const f of readdirSync(out).filter((x) => x.endsWith('.js') && !x.startsWith('ปลอม-'))) {
    const ที่ = join(out, f)
    writeFileSync(ที่, readFileSync(ที่, 'utf8')
      .replace(/(from\s+['"]\.\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2')
      .replace(/(['"])@\/lib\/billblobs\1/g, "'./ปลอม-billblobs.js'")
      .replace(/(['"])@\/lib\/gmail\1/g, "'./ปลอม-gmail.js'")
      .replace(/(['"])@\/lib\/emailPdf\1/g, "'./ปลอม-emailPdf.js'")
      .replace(/(['"])@\/lib\/vendors\1/g, "'./ปลอม-vendors.js'")
      .replace(/(['"])@\/lib\/bill-filing\1/g, "'./bill-filing.js'")
      .replace(/(['"])jszip\1/g, JSON.stringify(join(process.cwd(), 'node_modules/jszip/lib/index.js'))))
  }
  /* 🔑 ยืนยันว่าตัวปลอมถูกต่อจริง — ไม่งั้นพังด้วยเหตุที่อ่านว่า "เทสพัง" ไม่ใช่ "โค้ดผิด" */
  for (const f of ['billzip.js', 'billreport.js']) {
    const s = readFileSync(join(out, f), 'utf8')
    ok(`${f}: ต่อ import ไปตัวปลอมครบ (ไม่เหลือ @/lib/ ค้าง)`, !s.includes('@/lib/'),
      s.split('\n').filter((l) => l.includes('@/lib/')).join(' · '))
  }

  const ไฟล์ป้อน = join(out, 'ป้อน.json')
  process.env['ป้อนซอง'] = ไฟล์ป้อน
  const ตั้ง = (o) => writeFileSync(ไฟล์ป้อน, JSON.stringify({
    ชื่อไฟล์: [], ดัชนี: { lastScan: '2026-09-29', entries: [] }, รอบบิล: {},
    ดาวน์โหลดไม่ได้: [], ดึงเมลไม่ได้: [], ...o,
  }), 'utf8')
  const { สร้างซองบิล } = await import(join(out, 'billzip.js'))
  const { สรุปบิลรายเจ้า } = await import(join(out, 'billreport.js'))
  const เจ้า = { id: 'tiktok', name: 'TikTok', portal: null, everyMonth: true }
  /** เปิดซองที่สร้างออกมาอ่านจริง ๆ — ไม่เชื่อเลข `ได้` ลอย ๆ (เลขกับของข้างในอาจคนละกติกา) */
  const แกะซอง = async (r) => Object.keys((await JSZip.loadAsync(r.buf)).files)

  console.log('① 🔴 ใบเดียวกันที่อัปสองครั้งคนละชื่อ ⇒ ในซองต้องมีใบเดียว (เคส TikTok ส.ค.)')
  {
    ตั้ง({ ชื่อไฟล์: [
      '2026-08_REAL_THTT202606634060-บริษัท ศีตกาล เทรดดิ้ง จำกัด-Invoice.pdf',
      '2026-08_REAL_TikTok-Invoice-THTT202606634060.pdf',
      '2026-08_REAL_THTT202606634061-อีกใบจริง.pdf',
    ] })
    const r = await สร้างซองบิล('tiktok', '2026-08')
    const ใน = await แกะซอง(r)
    ok('ok', r.ok === true, r.error)
    ok('ได้ = 2 (ไม่ใช่ 3)', r.ได้ === 2, `ได้ ${r.ได้} ⇒ ใบเดียวกันคนละชื่อเข้าซองซ้ำ (บั๊กเดิม 8 ทั้งที่มี 4)`)
    ok('ในซองมีไฟล์บิล 2 ใบจริง ๆ (นับจากของข้างในซอง ไม่ใช่จากเลขที่รายงาน)',
      ใน.filter((n) => n.endsWith('.pdf')).length === 2, ใน.join(' · '))
    ok('ไม่มีใบแจ้ง ⚠️ (ไม่มีอะไรดึงไม่ได้)', !ใน.some((n) => n.startsWith('⚠️')), ใน.join(' · '))
    ok('ขาด = 0', r.ขาด === 0, String(r.ขาด))
  }

  console.log('② 🔴 เดือนมาจากรอบบิลในเอกสาร — และซองต้องจัดเหมือนหน้าจอ **เป๊ะ**')
  {
    const ชื่อ = '2026-09_REAL_THTT202609000222-ชื่อไฟล์บอกกันยายน.pdf'
    ตั้ง({ ชื่อไฟล์: [ชื่อ], รอบบิล: { [ชื่อ]: '2026-08' } })
    const ซองสิงหา = await สร้างซองบิล('tiktok', '2026-08')
    const ซองกันยา = await สร้างซองบิล('tiktok', '2026-09')
    ok('ซอง ส.ค. มีใบนี้ (ตามรอบบิลในเอกสาร)', ซองสิงหา.ได้ === 1, String(ซองสิงหา.ได้))
    ok('ซอง ก.ย. ไม่มีใบนี้ (ชื่อไฟล์ไม่ใช่ตัวตัดสิน)', ซองกันยา.ได้ === 0, String(ซองกันยา.ได้))
    /* 🔑 ข้อที่แพงที่สุดถ้าพลาด: จอกับซองใช้คนละกติกา ⇒ คนเห็นบนจอครบ แต่ซองขาด */
    const จอ = await สรุปบิลรายเจ้า(เจ้า)
    ok('จอจัดใบนี้ไว้เดือนเดียวกับซองที่มีมัน', จอ.เดือน['2026-08']?.จำนวน === 1 && !จอ.เดือน['2026-09'],
      `จอจัดไว้ ${JSON.stringify(จอ.เดือน)} แต่ซอง ส.ค. ได้ ${ซองสิงหา.ได้} ⇒ สองที่คนละกติกา`)
  }

  console.log('③ 🔴 ดึงไฟล์ไม่ได้ ⇒ ห้ามหายเงียบ ต้องมีใบแจ้งอยู่ **ในซอง** และถูกนับใน ขาด')
  {
    ตั้ง({
      ดัชนี: { lastScan: '2026-09-29', entries: [
        { month: '2026-08', filename: 'ใบที่ดึงได้.pdf', attachmentId: 'A1', messageId: 'M1', subject: 'ใบเสร็จ 1' },
        { month: '2026-08', filename: 'ใบที่ดึงไม่ได้.pdf', attachmentId: 'A2', messageId: 'M2', subject: 'ใบเสร็จ 2' },
      ] },
      ดึงเมลไม่ได้: ['A2'],
    })
    const r = await สร้างซองบิล('tiktok', '2026-08')
    const ใน = await แกะซอง(r)
    ok('ได้ = 1 · ขาด = 1', r.ได้ === 1 && r.ขาด === 1, `ได้ ${r.ได้} ขาด ${r.ขาด}`)
    const ใบแจ้ง = ใน.find((n) => n.startsWith('⚠️'))
    ok('มีใบแจ้งในซอง (ไม่ใช่แค่ใน log ที่ไม่มีใครอ่าน)', !!ใบแจ้ง, ใน.join(' · '))
    ok('ใบแจ้งอ้างชื่อไฟล์ที่ขาด', !!ใบแจ้ง && ใบแจ้ง.includes('ใบที่ดึงไม่ได้'), String(ใบแจ้ง))
    /* ยังคง ok:true เพราะซองที่ได้ครึ่งเดียวยังมีประโยชน์ — แต่ต้องอ่านออกว่าขาด */
    ok('ยังคืน ok:true (ซองครึ่งเดียวยังใช้ได้ ถ้าบอกว่าขาดอะไร)', r.ok === true, r.error)
  }

  console.log('④ ดาวน์โหลดใบจริงไม่ได้ ⇒ ต้องนับเป็น ขาด ไม่ใช่เงียบ')
  {
    ตั้ง({ ชื่อไฟล์: ['2026-08_REAL_THTT202608000777-ใบจริงที่ถังอ่านไม่ได้.pdf'], ดาวน์โหลดไม่ได้: ['2026-08_REAL_THTT202608000777-ใบจริงที่ถังอ่านไม่ได้.pdf'] })
    const r = await สร้างซองบิล('tiktok', '2026-08')
    ok('ได้ = 0 · ขาด = 1', r.ได้ === 0 && r.ขาด === 1, `ได้ ${r.ได้} ขาด ${r.ขาด}`)
    const ใน = await แกะซอง(r)
    ok('ซองบอกว่าไม่พบบิล (ไม่ใช่ซองเปล่าเงียบ ๆ)', ใน.includes('ไม่พบบิล.txt'), ใน.join(' · '))
  }

  console.log('⑤ ไม่มีบิลเลย ⇒ ใส่ใบอธิบาย (ซองเปล่าอ่านไม่ออกว่าพังหรือไม่มีของ)')
  {
    ตั้ง({})
    const r = await สร้างซองบิล('tiktok', '2026-08')
    const ใน = await แกะซอง(r)
    ok('มี ไม่พบบิล.txt', ใน.includes('ไม่พบบิล.txt'), ใน.join(' · '))
    ok('ได้ = 0 · ขาด = 0 (ไม่มีของ ≠ ดึงไม่ได้)', r.ได้ === 0 && r.ขาด === 0, `ได้ ${r.ได้} ขาด ${r.ขาด}`)
  }

  console.log('⑥ GEN ⇒ ตัดทิ้งเฉพาะเดือนที่มีใบจริงแล้ว (กติกาเดียวกับจอ)')
  {
    const ฐาน = { ดัชนี: { lastScan: '2026-09-29', entries: [
      { month: '2026-08', filename: 'GEN-สิงหา.pdf', attachmentId: 'GEN', messageId: 'M9', subject: 'ใบเสร็จ' },
    ] } }
    ตั้ง({ ...ฐาน, ชื่อไฟล์: ['2026-08_REAL_THTT202608000888-ใบจริง.pdf'] })
    const มีใบจริง = await สร้างซองบิล('tiktok', '2026-08')
    ตั้ง(ฐาน)
    const ไม่มีใบจริง = await สร้างซองบิล('tiktok', '2026-08')
    ok('เดือนที่มีใบจริง ⇒ GEN ถูกตัด เหลือ 1', มีใบจริง.ได้ === 1, String(มีใบจริง.ได้))
    ok('เดือนที่ไม่มีใบจริง ⇒ GEN ยังเข้าซอง', ไม่มีใบจริง.ได้ === 1, String(ไม่มีใบจริง.ได้))
    ok('GEN ถูกแปลงเป็น .pdf ในซอง', (await แกะซอง(ไม่มีใบจริง)).some((n) => /GEN.*\.pdf$/.test(n)),
      (await แกะซอง(ไม่มีใบจริง)).join(' · '))
  }

  console.log('⑦ ชื่อไฟล์ที่มี / หรือ \\ ต้องถูกล้าง — ไม่งั้นซองแตกเป็นโฟลเดอร์ซ้อน')
  {
    ตั้ง({ ดัชนี: { lastScan: '2026-09-29', entries: [
      { month: '2026-08', filename: 'INV/2026/08 ใบเสร็จ.pdf', attachmentId: 'A1', messageId: 'M1', subject: 'ใบเสร็จ' },
    ] } })
    const ใน = await แกะซอง(await สร้างซองบิล('tiktok', '2026-08'))
    ok('ไม่มีรายการใดในซองมี / ในชื่อ', !ใน.some((n) => n.includes('/')), ใน.join(' · '))
  }

  console.log('⑧ summary.csv ต้องมีทุกซอง · เลขข้างในต้องตรงกับที่รายงาน · Excel ต้องอ่านไทยออก')
  {
    ตั้ง({
      ชื่อไฟล์: ['2026-08_REAL_THTT202608000999-ใบจริง.pdf'],
      ดัชนี: { lastScan: '2026-09-29', entries: [
        { month: '2026-08', filename: 'ดึงไม่ได้.pdf', attachmentId: 'A2', messageId: 'M2', subject: 'ใบเสร็จ' },
      ] },
      ดึงเมลไม่ได้: ['A2'],
    })
    const r = await สร้างซองบิล('tiktok', '2026-08')
    const zip = await JSZip.loadAsync(r.buf)
    ok('มี summary.csv', !!zip.files['summary.csv'])
    const csv = await zip.file('summary.csv').async('string')
    ok('ขึ้นต้นด้วย BOM (ไม่มี ⇒ Excel อ่านไทยเป็นขยะ แล้วบัญชีคิดว่าไฟล์เสีย)',
      csv.charCodeAt(0) === 0xfeff, `อักขระแรก U+${csv.charCodeAt(0).toString(16)}`)
    ok('เลขในไฟล์ตรงกับที่ฟังก์ชันรายงาน', csv.includes(`"${r.ได้}"`) && csv.includes(`"${r.ขาด}"`),
      `ได้ ${r.ได้} ขาด ${r.ขาด} · csv: ${csv.split('\n')[1]}`)
    ok('มีรายชื่อที่ขาด ไม่ใช่แค่จำนวน', csv.includes('รายการที่ขาด') && csv.includes('ดึงไม่ได้.pdf'),
      csv.replace(/\n/g, ' ⏎ ').slice(0, 200))
  }

  console.log('⑨ เจ้า/เดือนที่รับไม่ได้ ⇒ ok:false พร้อมเหตุ **ห้ามคืนซองเปล่าที่ดูปกติ**')
  {
    ตั้ง({})
    for (const [ชื่อกรณี, v, m] of [
      ['ไม่รู้จักเจ้านี้', 'ไม่มีเจ้านี้', '2026-08'],
      ['เจ้าเป็น null', null, '2026-08'],
      ['ไม่ส่งเดือน', 'tiktok', null],
      ['เดือนผิดรูป', 'tiktok', '08-2026'],
    ]) {
      const r = await สร้างซองบิล(v, m)
      ok(`${ชื่อกรณี} ⇒ ok:false + มีเหตุ + ไม่มีซอง`,
        r.ok === false && typeof r.error === 'string' && r.error.length > 0 && !r.buf,
        JSON.stringify(r).slice(0, 120))
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอม Gmail · ตัวแปลงอีเมลเป็น PDF · ที่เก็บบิล'
  + ' — ของจริง: ตรรกะคัดซ้ำ · จัดเดือน · bill-filing · jszip (ซองที่แกะอ่านคือซองจริง)')
process.exit(ตก ? 1 : 0)
