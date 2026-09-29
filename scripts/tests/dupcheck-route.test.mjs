#!/usr/bin/env node
/* เส้นตรวจบิลซ้ำ (`app/api/bills/dupcheck/route.ts`) — 233 บรรทัด · เส้นที่ใช้ **ยืนยันตัวเลข** ให้ท่านประธาน
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · คิวตามเกณฑ์ของใบ · กอง T2)
 *
 * 🔴 ที่มาของเส้นนี้: ท่านประธานจับได้เองว่าบิล Adobe ถูกเก็บซ้ำ (16 ก.ย. 2569)
 *    ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน
 *
 * 🔑 **กฎที่แพงที่สุดของเส้นนี้ และเป็นเหตุที่ต้องมีเทส: ตัวตรวจต้องไม่เปลี่ยนสิ่งที่มันตรวจ**
 *    เส้นนี้ **เขียนแคชรอบบิลตามค่าเริ่มต้น** ⇒ ยิงรอบแรกได้ค่าหนึ่ง รอบสองได้อีกค่า
 *    แล้วแยกไม่ออกว่าเปลี่ยนเพราะระบบ หรือเปลี่ยนเพราะการไปยิงเอง ⇒ รายงานไม่ได้ทั้งใบ
 *    ⇒ `nowrite=1` ปิดการเขียน · และคำตอบต้อง **บอกทุกรอบ** ว่าเขียนหรือไม่เขียน
 *    ⇒ เทสนี้ตรึงทั้งสองทิศ: ปิดแล้วต้องไม่เขียนจริง · ไม่ปิดแล้วต้องเขียนและบอกว่าเขียน
 *
 * 🔒 และตรึงกฎ "ห้ามข้ามเงียบ" ทุกทาง — ของจริง 17 ก.ย. 2569 ยิงครั้งแรกได้
 *    "ไฟล์ในถัง 9 · อ่านรอบนี้ 0 · ใบซ้ำ 0" ซึ่งอ่านว่า "ไม่มีซ้ำ" ทั้งที่ไม่ได้อ่านสักใบ
 *    (ต้นเหตุ: ไม่ตัดคำนำหน้า `BLOB:` ⇒ โหลดได้ค่าว่างทั้ง 9 ไฟล์)
 *
 * ⚠️ ขอบเขต: ปลอมที่เก็บบิล · ตัวอ่าน PDF · ตัวอ่านตัวตน
 *    **ของจริง: `lib/dupcheck-verdict.ts` (คำตัดสินว่าสรุปได้ไหม) และ `lib/bill-filing.ts` (ตัวจัดเดือน)**
 *    เพราะสองตัวนั้นคือที่ที่ความหมายอยู่ และมีเทสของตัวเองคุมอีกชั้น
 */
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นTS = 'app/api/bills/dupcheck/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นTS],
    ปลอม: {
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200 }
  static json(ก้อน, init) { const r = new NextResponse('', init); r.ก้อน = ก้อน; return r }
}
`,
      /* ที่เก็บบิลปลอม — **จดทุกการเรียกลงไฟล์** เพื่อตรวจว่าไม่แตะไฟล์บิล และเขียนแคชหรือไม่ */
      '@/lib/billblobs': `
import { readFileSync, appendFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนdup, 'utf8'));
const จด = (o) => appendFileSync(process.env.จดเรียก, JSON.stringify(o) + '\\n', 'utf8');
export async function listVendorBlobFiles(vendorId) {
  จด({ ทำ: 'list', vendorId });
  const p = อ่าน();
  if (p.คลังพัง) throw new Error(p.คลังพัง);
  return p.ไฟล์.map((f) => ({ name: f.name, id: 'BLOB:b/' + f.name, size: 10 }));
}
export async function downloadBlobFile(key) {
  จด({ ทำ: 'download', key });
  const p = อ่าน();
  /* 🔑 ตอบเฉพาะคีย์ที่ **ถอด BLOB: แล้ว** ⇒ ถ้าโค้ดลืมถอด จะได้ค่าว่างทุกไฟล์ */
  const f = p.ไฟล์.find((x) => 'b/' + x.name === key);
  if (!f) return null;
  if (f.โหลดพัง) throw new Error(f.โหลดพัง);
  return f.เนื้อ === null ? null : Buffer.from('%PDF ' + f.name);
}
export async function loadRealPeriods() { จด({ ทำ: 'loadPeriods' }); return อ่าน().แคช ?? {}; }
export async function saveRealPeriods(vendorId, map) { จด({ ทำ: 'savePeriods', vendorId, map }); }
/* ของที่ **ห้ามถูกเรียกเลย** — ถ้าถูกเรียกคือเส้นนี้แตะไฟล์บิล */
export async function deleteBillBlob(...a) { จด({ ทำ: 'ลบไฟล์บิล', a }); return true; }
export async function syncBillByIdentity(...a) { จด({ ทำ: 'เขียนไฟล์บิล', a }); return {}; }
`,
      '@/lib/billdate': `
import { readFileSync } from 'node:fs';
export async function pdfBillInfo(buf) {
  const ชื่อ = String(buf).replace('%PDF ', '');
  const f = JSON.parse(readFileSync(process.env.ป้อนdup, 'utf8')).ไฟล์.find((x) => x.name === ชื่อ);
  if (f?.อ่านข้อความพัง) throw new Error(f.อ่านข้อความพัง);
  return { text: f?.ข้อความ ?? '' };
}
`,
      '@/lib/bill-identity': `
import { readFileSync } from 'node:fs';
const หา = (text) => JSON.parse(readFileSync(process.env.ป้อนdup, 'utf8')).ไฟล์.find((x) => (x.ข้อความ ?? '') === text);
export function billIdentity(text) {
  const f = หา(text);
  return f?.ตัวตน ?? { key: null, invoiceNo: null, period: null, why: 'ไม่ทราบเหตุ' };
}
export function billFilingMonth(text) {
  const f = หา(text);
  return f?.รอบบิล ?? { month: null, source: 'ไม่รู้' };
}
`,
      '@/lib/vendors': `
export const BILL_VENDORS = [{ id: 'adobe', name: 'Adobe' }];
`,
    },
  })
  งาน = ผล.ที่ออก
  const ไฟล์ป้อน = join(งาน, 'ป้อน.json')
  const ไฟล์จด = join(งาน, 'จด.jsonl')
  process.env['ป้อนdup'] = ไฟล์ป้อน
  process.env['จดเรียก'] = ไฟล์จด
  writeFileSync(ไฟล์ป้อน, JSON.stringify({ ไฟล์: [] }), 'utf8')
  writeFileSync(ไฟล์จด, '', 'utf8')
  const { GET } = await import(ผล.พาธของ(เส้นTS))

  const ยิง = async (qs, ป้อน) => {
    writeFileSync(ไฟล์ป้อน, JSON.stringify(ป้อน), 'utf8')
    writeFileSync(ไฟล์จด, '', 'utf8')
    const r = await GET({ nextUrl: new URL(`https://x/api/bills/dupcheck${qs}`) })
    const เรียก = readFileSync(ไฟล์จด, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { r, ก้อน: r.ก้อน, ผลเจ้าแรก: r.ก้อน?.ผล?.[0], เรียก }
  }
  /** ไฟล์ปลอมหนึ่งใบที่อ่านได้ครบ */
  const ใบ = (name, key, เพิ่ม = {}) => ({
    name, ข้อความ: `เนื้อของ ${name}`,
    ตัวตน: { key, invoiceNo: key, period: '2026-08' },
    รอบบิล: { month: '2026-08', source: 'รอบบิลที่พิมพ์ในใบ' }, ...เพิ่ม,
  })
  process.env.DRIVESYNC_SECRET = 'รหัสจริง'

  console.log('① รหัส — ไม่มี/ผิด/ไม่ได้ตั้ง env ⇒ 401 ทั้งสามกรณี')
  {
    const ป้อน = { ไฟล์: [ใบ('a.pdf', 'K1')] }
    ok('ไม่ส่งรหัส ⇒ 401', (await ยิง('', ป้อน)).r.status === 401)
    ok('รหัสผิด ⇒ 401', (await ยิง('?secret=มั่ว', ป้อน)).r.status === 401)
    delete process.env.DRIVESYNC_SECRET
    ok('ไม่ได้ตั้ง env ⇒ 401 แม้ส่งอะไรมา', (await ยิง('?secret=x', ป้อน)).r.status === 401,
      'ผ่าน ⇒ วันที่ env หลุด เส้นที่อ่านเลขเอกสารจริงเปิดให้คนนอก')
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
    ok('รหัสถูก ⇒ 200', (await ยิง('?secret=รหัสจริง&vendor=adobe', ป้อน)).r.status === 200)
  }

  console.log('② 🔴 nowrite=1 ⇒ ไม่เขียนแคชเลย และคำตอบต้องบอกว่าไม่เขียน')
  {
    const ป้อน = { ไฟล์: [ใบ('2026-07_REAL_a.pdf', 'K1')], แคช: {} }
    const { ก้อน, ผลเจ้าแรก, เรียก } = await ยิง('?secret=รหัสจริง&vendor=adobe&nowrite=1', ป้อน)
    ok('ไม่เรียก saveRealPeriods เลย', !เรียก.some((c) => c.ทำ === 'savePeriods'),
      JSON.stringify(เรียก.map((c) => c.ทำ)))
    ok('ช่อง เขียนแคชรอบนี้ = false', ผลเจ้าแรก['เขียนแคชรอบนี้'] === false,
      String(ผลเจ้าแรก['เขียนแคชรอบนี้']))
    ok('มีช่อง nowrite: true ให้เห็น', ผลเจ้าแรก.nowrite === true, String(ผลเจ้าแรก.nowrite))
    ok('หมายเหตุบอกว่าไม่เขียนอะไรเลย', /ไม่เขียนอะไรเลย/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
  }

  console.log('③ 🔴 ค่าเริ่มต้น ⇒ เขียนแคช และต้องบอกว่าเขียน + เตือนให้ใช้ nowrite ตอนยืนยันตัวเลข')
  {
    const ป้อน = { ไฟล์: [ใบ('2026-07_REAL_a.pdf', 'K1')], แคช: {} }
    const { ก้อน, ผลเจ้าแรก, เรียก } = await ยิง('?secret=รหัสจริง&vendor=adobe', ป้อน)
    ok('เรียก saveRealPeriods จริง', เรียก.some((c) => c.ทำ === 'savePeriods'),
      JSON.stringify(เรียก.map((c) => c.ทำ)))
    ok('ช่อง เขียนแคชรอบนี้ = true', ผลเจ้าแรก['เขียนแคชรอบนี้'] === true,
      `${ผลเจ้าแรก['เขียนแคชรอบนี้']} ⇒ เขียนแล้วไม่บอก = คนยิงสองรอบได้เลขต่างกันแล้วหาเหตุไม่เจอ`)
    ok('ไม่มีช่อง nowrite', ผลเจ้าแรก.nowrite === undefined, String(ผลเจ้าแรก.nowrite))
    ok('หมายเหตุเตือนให้ใส่ nowrite ตอนยืนยันตัวเลข', /nowrite=1/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
    /* แคชไม่เปลี่ยน ⇒ ไม่ต้องเขียน (ตัวควบคุมลบของข้อนี้) */
    const เดิม = await ยิง('?secret=รหัสจริง&vendor=adobe',
      { ไฟล์: [ใบ('2026-07_REAL_a.pdf', 'K1')], แคช: { '2026-07_REAL_a.pdf': '2026-08' } })
    ok('แคชตรงอยู่แล้ว ⇒ ไม่เขียนซ้ำ', !เดิม.เรียก.some((c) => c.ทำ === 'savePeriods')
      && เดิม.ผลเจ้าแรก['เขียนแคชรอบนี้'] === false, JSON.stringify(เดิม.เรียก.map((c) => c.ทำ)))
  }

  console.log('④ 🔴 ห้ามแตะไฟล์บิลเลย — ไม่ลบ ไม่เขียนทับ (บิลลบแล้วไม่มีถังขยะให้กู้)')
  {
    const { เรียก, ก้อน } = await ยิง('?secret=รหัสจริง&vendor=adobe',
      { ไฟล์: [ใบ('a.pdf', 'K1'), ใบ('b.pdf', 'K1')] })
    const แตะ = เรียก.filter((c) => c.ทำ === 'ลบไฟล์บิล' || c.ทำ === 'เขียนไฟล์บิล')
    ok('ไม่เรียกตัวลบ/ตัวเขียนไฟล์บิลเลย', แตะ.length === 0, JSON.stringify(แตะ))
    ok('หมายเหตุประกาศว่าไม่แตะไฟล์บิล', /ไม่แตะไฟล์บิลเลย/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
  }

  console.log('⑤ 🔴 อ่านคลังไม่ได้ ⇒ ต้องไม่ตอบว่าสะอาด (ใช้ตัวตัดสินของจริง)')
  {
    const { ผลเจ้าแรก } = await ยิง('?secret=รหัสจริง&vendor=adobe', { ไฟล์: [], คลังพัง: 'ถังตอบ 500' })
    ok('มีช่อง อ่านคลังไฟล์ไม่ได้ พร้อมเหตุ', /500/.test(String(ผลเจ้าแรก['อ่านคลังไฟล์ไม่ได้'])),
      String(ผลเจ้าแรก['อ่านคลังไฟล์ไม่ได้']))
    ok('สรุปได้ = false', ผลเจ้าแรก['สรุปได้'] === false,
      `${ผลเจ้าแรก['สรุปได้']} ⇒ ตอบ true คือบอกว่าสะอาดทั้งที่ไม่ได้อ่านอะไรเลย`)
    ok('เหตุข้อแรกคือ อ่านคลังไฟล์ไม่ได้', ผลเจ้าแรก['ยังสรุปไม่ได้เพราะ'][0] === 'อ่านคลังไฟล์ไม่ได้',
      JSON.stringify(ผลเจ้าแรก['ยังสรุปไม่ได้เพราะ']))
    ok('ใบซ้ำว่างแต่ต้องไม่ถูกอ่านว่าสะอาด (มีเหตุค้างกำกับ)',
      ผลเจ้าแรก['ใบซ้ำ'].length === 0 && ผลเจ้าแรก['ยังสรุปไม่ได้เพราะ'].length > 0)
  }

  console.log('⑥ 🔴 ข้ามเงียบห้ามมี — ทุกเหตุที่ข้ามต้องถูกนับ และมีคำเตือนเมื่ออ่านไม่ครบ')
  {
    const { ผลเจ้าแรก } = await ยิง('?secret=รหัสจริง&vendor=adobe', {
      ไฟล์: [
        ใบ('ดี.pdf', 'K1'),
        { name: 'ซอง.zip' },
        ใบ('โหลดพัง.pdf', 'K2', { โหลดพัง: 'ถังตอบ 404' }),
        ใบ('อ่านไม่ออก.pdf', 'K3', { อ่านข้อความพัง: 'PDF เสีย' }),
      ],
    })
    ok('นับไฟล์ที่ไม่ใช่ PDF', ผลเจ้าแรก['ข้าม']['ไม่ใช่PDF'].includes('ซอง.zip'),
      JSON.stringify(ผลเจ้าแรก['ข้าม']['ไม่ใช่PDF']))
    ok('นับไฟล์ที่โหลดไม่ได้ พร้อมเหตุ',
      ผลเจ้าแรก['ข้าม']['โหลดไม่ได้'].some((x) => x.file === 'โหลดพัง.pdf' && /404/.test(x.why)),
      JSON.stringify(ผลเจ้าแรก['ข้าม']['โหลดไม่ได้']))
    ok('นับไฟล์ที่อ่านข้อความไม่ได้ พร้อมเหตุ',
      ผลเจ้าแรก['ข้าม']['อ่านข้อความไม่ได้'].some((x) => x.file === 'อ่านไม่ออก.pdf'),
      JSON.stringify(ผลเจ้าแรก['ข้าม']['อ่านข้อความไม่ได้']))
    ok('อ่านรอบนี้ = 1 (ไม่ใช่ 4)', ผลเจ้าแรก['อ่านรอบนี้'] === 1, String(ผลเจ้าแรก['อ่านรอบนี้']))
    ok('มีคำเตือนว่าอ่านไม่ครบ ห้ามสรุปว่าไม่มีซ้ำ', /ห้ามสรุปว่าไม่มีซ้ำ/.test(String(ผลเจ้าแรก['เตือน'])),
      String(ผลเจ้าแรก['เตือน']))
    ok('สรุปได้ = false เพราะอ่านไม่ครบ', ผลเจ้าแรก['สรุปได้'] === false)
  }

  console.log('⑦ 🔴 ต้องตัดคำนำหน้า BLOB: ก่อนโหลด — ไม่ตัด = อ่านได้ 0 ทุกไฟล์ (ของจริง 17 ก.ย.)')
  {
    const { ผลเจ้าแรก, เรียก } = await ยิง('?secret=รหัสจริง&vendor=adobe', { ไฟล์: [ใบ('a.pdf', 'K1')] })
    const คีย์ที่ส่ง = เรียก.filter((c) => c.ทำ === 'download').map((c) => c.key)
    ok('ส่งคีย์ที่ถอด BLOB: แล้ว', คีย์ที่ส่ง.every((k) => !String(k).startsWith('BLOB:')),
      JSON.stringify(คีย์ที่ส่ง))
    ok('และอ่านได้จริง 1 ไฟล์', ผลเจ้าแรก['อ่านรอบนี้'] === 1, String(ผลเจ้าแรก['อ่านรอบนี้']))
  }

  console.log('⑧ ใบซ้ำ — คนละชื่อ กุญแจเดียวกัน ⇒ จัดกลุ่ม และนับ "ไฟล์ที่เกินมา"')
  {
    const { ผลเจ้าแรก } = await ยิง('?secret=รหัสจริง&vendor=adobe',
      { ไฟล์: [ใบ('ก.pdf', 'K1'), ใบ('ข.pdf', 'K1'), ใบ('ค.pdf', 'K1'), ใบ('ง.pdf', 'K9')] })
    ok('ได้ 1 กลุ่มซ้ำ', ผลเจ้าแรก['ใบซ้ำ'].length === 1, JSON.stringify(ผลเจ้าแรก['ใบซ้ำ'].length))
    ok('กลุ่มมี 3 ไฟล์', ผลเจ้าแรก['ใบซ้ำ'][0]['จำนวนไฟล์'] === 3, String(ผลเจ้าแรก['ใบซ้ำ'][0]['จำนวนไฟล์']))
    ok('จำนวนใบซ้ำ = 2 (ไฟล์ที่เกินมา ไม่ใช่จำนวนไฟล์ในกลุ่ม)', ผลเจ้าแรก['จำนวนใบซ้ำ'] === 2,
      `${ผลเจ้าแรก['จำนวนใบซ้ำ']} ⇒ นับเป็น 3 = เสนอลบใบจริงทิ้งไปหนึ่งใบ`)
    ok('ใบที่ไม่ซ้ำไม่เข้ากลุ่ม', !JSON.stringify(ผลเจ้าแรก['ใบซ้ำ']).includes('ง.pdf'))
  }

  console.log('⑨ กลุ่มที่เลขในชื่อไฟล์ขัดกัน ⇒ ต้องติดธง ไม่นับเป็นซ้ำชัด')
  {
    const { ผลเจ้าแรก } = await ยิง('?secret=รหัสจริง&vendor=adobe', {
      ไฟล์: [ใบ('2026-08_REAL_THTT202608000111-a.pdf', 'K1'), ใบ('2026-08_REAL_THTT202608000222-b.pdf', 'K1')],
    })
    ok('ติดธง ขัดกับชื่อไฟล์', ผลเจ้าแรก['ใบซ้ำ'][0]['ขัดกับชื่อไฟล์'] === true,
      JSON.stringify(ผลเจ้าแรก['ใบซ้ำ'][0]))
    ok('นับในช่อง กลุ่มขัดกับชื่อไฟล์', ผลเจ้าแรก['กลุ่มขัดกับชื่อไฟล์'] === 1,
      String(ผลเจ้าแรก['กลุ่มขัดกับชื่อไฟล์']))
    /* ตัวควบคุมลบ — เลขในชื่อตรงกัน ⇒ ไม่ติดธง */
    const ตรง = await ยิง('?secret=รหัสจริง&vendor=adobe', {
      ไฟล์: [ใบ('2026-08_REAL_THTT202608000111-a.pdf', 'K1'), ใบ('2026-08_REAL_THTT202608000111-b.pdf', 'K1')],
    })
    ok('เลขตรงกัน ⇒ ไม่ติดธง', ตรง.ผลเจ้าแรก['กลุ่มขัดกับชื่อไฟล์'] === 0,
      String(ตรง.ผลเจ้าแรก['กลุ่มขัดกับชื่อไฟล์']))
  }

  console.log('⑩ คำเตือนเรื่องความลับต้องอยู่ในคำตอบทุกรอบ (ผลมีเลขเอกสารจริง)')
  {
    const { ก้อน } = await ยิง('?secret=รหัสจริง&vendor=adobe', { ไฟล์: [ใบ('a.pdf', 'K1')] })
    ok('มีคำเตือนห้ามแปะลง repo', /ห้ามแปะลง repo/.test(ก้อน['คำเตือน']), String(ก้อน['คำเตือน']))
  }
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมที่เก็บบิล · ตัวอ่าน PDF · ตัวอ่านตัวตน —'
  + ' **ของจริง: ตัวตัดสินว่าสรุปได้ไหม (dupcheck-verdict) และตัวจัดเดือน (bill-filing)**')
process.exit(ตก ? 1 : 0)
