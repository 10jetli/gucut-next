#!/usr/bin/env node
/* ด่านเดือนของสองเส้นที่ยิง Gmail — `app/api/bills/route.ts` และ `app/api/bills/download/route.ts`
 * (ใบ t_mu8i1pu1 · 30 ก.ย. 2569 · หนี้ข้อ 1·2 ที่ CEO อนุมัติให้แก้)
 *
 * ⚠️ **ขอบเขตของไฟล์นี้: เฉพาะด่านเดือน** ไม่ได้ตรวจการรวมบิล การประกอบ ZIP หรือการคุยกับ Gmail
 *    เขียนไว้ตรง ๆ เพราะเขียวของไฟล์นี้ **ไม่ได้แปลว่าสองเส้นนี้ถูกทั้งเส้น**
 *    (สองเส้นนี้ยังไม่มีเทสคลุมทั้งเส้น — เป็นหนี้ที่รู้ตัว ไม่ใช่ของที่ลืม)
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① เดือนไม่ครบ/ผิดรูป/นอกช่วง 01–12 ⇒ **400 และห้ามแตะ Gmail**
 *       ทำไมต้องเช็ค "ห้ามแตะ Gmail" ด้วย: Gmail มีโควตาต่อนาที และเคยชนเพดานมาแล้ว
 *       ⇒ ตีกลับหลังยิงไปแล้ว = จ่ายโควตาให้คำขอที่เราปฏิเสธเอง
 *    ② 🟢 **ตัวควบคุมลบ** — เดือนขอบ 01 และ 12 ต้องผ่านด่าน (ไม่ใช่ 400)
 *       ไม่มีข้อนี้ ด่านที่เขียนผิดเป็น "ปฏิเสธทุกเดือน" ก็เขียวทั้งชุด
 *       แล้วปุ่มโหลด ZIP บนหน้า /bills จะตายทุกปุ่มโดยไม่มีใครรู้
 *    ③ `download` ระบุเจ้าที่ไม่รู้จัก ⇒ 400 **ห้ามเงียบแล้วส่ง ZIP รวมทุกเจ้าไปแทน**
 *
 * 📏 กวาดผู้เรียกก่อนรัดด่าน (CEO สั่ง 30 ก.ย. 2569) — ทั้งสองเส้นมีผู้เรียกเดียว
 *    และส่งเดือนที่อยู่ในช่วงเสมอ ⇒ ไม่มีผู้เรียกไหนส่ง `month=` ว่าง
 */
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นรวม = 'app/api/bills/route.ts'
const เส้นโหลด = 'app/api/bills/download/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นรวม, เส้นโหลด],
    ปลอม: {
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.status = init?.status ?? 200; this.headers = new Headers(init?.headers) }
  static json(ก้อน, init) { const r = new NextResponse('', init); r.ก้อน = ก้อน; return r }
}
`,
      /* 🔑 Gmail ปลอมที่ **จดทุกการเรียก** — ใช้ตรวจว่าด่านตีกลับ **ก่อน** จ่ายโควตา */
      '@/lib/gmail': `
import { appendFileSync } from 'node:fs';
const จด = (o) => appendFileSync(process.env.จดgmail, JSON.stringify(o) + '\\n', 'utf8');
/* ⚠️ **ตัวปลอมไม่ต้องมี type ใด ๆ** — ตัวช่วยคอมไพล์ทำงานสองจังหวะ:
   tsc คอมไพล์เทียบ **ของจริง** ก่อน แล้วจึงสลับ import ไปหาตัวปลอมทีหลัง
   ⇒ ตัวปลอมเป็น **JS ที่รันได้** เท่านั้น · เขียนคำสั่ง export type ลงไป = SyntaxError ตอนรัน
   ⚠️ และห้ามใช้เครื่องหมาย backtick ในคอมเมนต์ของตัวปลอม — ตัวปลอมอยู่ใน template literal
      ⇒ backtick ตัวแรกปิดสตริงทันที แล้วพังที่ไฟล์เทส ไม่ใช่ที่ตัวปลอม (เหยียบสด ๆ 30 ก.ย. 2569)
   และชนิดที่ import มาเป็น type อย่างเดียว (BillMessage) tsc ตัดออกจาก import ให้แล้ว
   ⇒ ตัวปลอมไม่ต้องมีชื่อนั้นเลย (เจอจริง 30 ก.ย. 2569) */
export const VENDORS = [
  { id: 'tiktok', name: 'TikTok Ads', emoji: '🎵' },
  { id: 'adobe', name: 'Adobe', emoji: '🅰️' },
];
export async function getAccessToken() { จด({ ทำ: 'ขอโทเคน' }); return 'tok'; }
export async function searchVendorBills(token, v, after, before) {
  จด({ ทำ: 'ค้นบิล', vendor: v.id, after, before }); return [];
}
export async function fetchAttachment() { จด({ ทำ: 'โหลดไฟล์แนบ' }); return Buffer.from(''); }
export async function fetchMessageDetail() { จด({ ทำ: 'อ่านอีเมล' }); return {}; }
export function monthRange(month) {
  จด({ ทำ: 'คิดช่วงวัน', month });
  return { after: month + '/01', before: month + '/28' };
}
`,
      '@/lib/billdate': `
export async function pdfBillInfo() { return { text: '' }; }
export function pdfHasAccountId() { return true; }
`,
      '@/lib/emailPdf': `export async function emailToPdf() { return Buffer.from(''); }`,
      jszip: `
export default class JSZip {
  file() {}
  async generateAsync() { return Buffer.from('PK'); }
}
`,
    },
  })
  งาน = ผล.ที่ออก
  const ไฟล์จด = join(งาน, 'gmail.jsonl')
  process.env['จดgmail'] = ไฟล์จด
  writeFileSync(ไฟล์จด, '', 'utf8')
  const { GET: รวม } = await import(ผล.พาธของ(เส้นรวม))
  const { GET: โหลด } = await import(ผล.พาธของ(เส้นโหลด))

  const ยิง = async (fn, qs) => {
    writeFileSync(ไฟล์จด, '', 'utf8')
    const r = await fn({ nextUrl: new URL(`https://admin.gucut.com/api/bills${qs}`) })
    const เรียก = readFileSync(ไฟล์จด, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { r, ก้อน: r.ก้อน, เรียก, แตะGmailไหม: เรียก.length > 0 }
  }

  const เคสที่ต้องตีกลับ = [
    ['ไม่ส่ง month', ''],
    ['month ว่าง', '?month='],
    ['ผิดรูป 2026-6', '?month=2026-6'],
    ['เป็นข้อความ', '?month=' + encodeURIComponent('มีนาคม')],
    ['มีแต่ปี', '?month=2026'],
    ['นอกช่วง 2026-13', '?month=2026-13'],
    ['นอกช่วง 2026-00', '?month=2026-00'],
    ['นอกช่วง 2026-99', '?month=2026-99'],
  ]

  for (const [ชื่อเส้น, fn] of [['/api/bills', รวม], ['/api/bills/download', โหลด]]) {
    console.log(`① ${ชื่อเส้น} — เดือนไม่ผ่าน ⇒ 400 **และห้ามแตะ Gmail**`)
    for (const [ชื่อ, qs] of เคสที่ต้องตีกลับ) {
      const { r, แตะGmailไหม, เรียก } = await ยิง(fn, qs)
      ok(`${ชื่อ} ⇒ 400`, r.status === 400, String(r.status))
      ok(`${ชื่อ} ⇒ ไม่แตะ Gmail`, !แตะGmailไหม,
        `${JSON.stringify(เรียก.map((c) => c.ทำ))} ⇒ ตีกลับหลังยิงแล้ว = จ่ายโควตาให้คำขอที่เราปฏิเสธเอง`)
    }
    console.log(`② 🟢 ตัวควบคุมลบของ ${ชื่อเส้น} — เดือนขอบต้องผ่าน`)
    for (const เดือน of ['2026-01', '2026-12', '2569-06']) {
      const { r, แตะGmailไหม } = await ยิง(fn, `?month=${เดือน}`)
      ok(`🟢 month=${เดือน} ⇒ ไม่ใช่ 400 และเดินต่อไปถาม Gmail`,
        r.status !== 400 && แตะGmailไหม,
        `สถานะ ${r.status} · แตะ Gmail ${แตะGmailไหม}`
        + ' ⇒ ถ้าข้อนี้แดง = ด่านปฏิเสธเกินหน้าที่ แล้วปุ่มโหลด ZIP ตายทุกปุ่ม')
    }
  }

  console.log('③ /api/bills/download — เจ้าที่ไม่รู้จัก ⇒ 400 ห้ามเงียบแล้วส่ง ZIP รวมทุกเจ้า')
  {
    const { r, ก้อน, แตะGmailไหม } = await ยิง(โหลด, '?month=2026-08&vendor=' + encodeURIComponent('มั่ว'))
    ok('ได้ 400', r.status === 400, String(r.status))
    ok('บอกชื่อเจ้าที่ไม่รู้จักกลับไป', /มั่ว/.test(JSON.stringify(ก้อน)), JSON.stringify(ก้อน))
    ok('และไม่แตะ Gmail', !แตะGmailไหม,
      'คนขอของอย่างหนึ่งแล้วได้อีกอย่างโดยไม่รู้ตัว = แย่กว่าขึ้น error')
    /* 🟢 ตัวควบคุมลบ: เจ้าที่รู้จักต้องผ่าน */
    const ดี = await ยิง(โหลด, '?month=2026-08&vendor=tiktok')
    ok('🟢 ตัวควบคุมลบ: เจ้าที่รู้จัก ⇒ เดินต่อ', ดี.r.status !== 400 && ดี.แตะGmailไหม,
      `${ดี.r.status} · แตะ Gmail ${ดี.แตะGmailไหม}`)
    ok('และถามเฉพาะเจ้าที่ขอ ไม่ใช่ทุกเจ้า',
      new Set(ดี.เรียก.filter((c) => c.ทำ === 'ค้นบิล').map((c) => c.vendor)).size === 1,
      JSON.stringify(ดี.เรียก.filter((c) => c.ทำ === 'ค้นบิล').map((c) => c.vendor)))
  }
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: **เฉพาะด่านเดือนและด่านเจ้า** ของสองเส้นนี้ — ไม่ได้ตรวจการรวมบิลหรือการประกอบ ZIP')
console.log('   ⇒ เขียวของไฟล์นี้ไม่ได้แปลว่าสองเส้นนี้ถูกทั้งเส้น (เป็นหนี้ที่รู้ตัว)')
process.exit(ตก ? 1 : 0)
