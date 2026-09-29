#!/usr/bin/env node
/* เส้นย้ายบิลข้ามเดือน (`app/api/bills/fixmonth/route.ts`) — **เส้นเดียวในกองบิลที่เขียนข้อมูล**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · คิวตามเกณฑ์ของใบ · กอง T2)
 *
 * 🔴 ต่างจาก dupcheck/report ที่อ่านอย่างเดียว — เส้นนี้ **ย้ายรายการบิลไปเดือนอื่น**
 *    ซึ่งเปลี่ยนตัวเลขบนจอบิลและเปลี่ยนสิ่งที่บัญชีเอาไปยื่น
 *    ⇒ ทุกทางที่ปฏิเสธคำขอ **ต้องไม่เขียนอะไรเลย** ไม่ใช่แค่ตอบ error แล้วเขียนไปแล้ว
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① รหัสผิด/ไม่มี/ไม่ได้ตั้ง env ⇒ 401 **และห้ามเขียน**
 *    ② พารามิเตอร์ไม่ครบ/เดือนผิดรูป ⇒ 400 **และห้ามเขียน**
 *    ③ ไม่มีแคชของเจ้านั้น ⇒ 404 ไม่ใช่ 200 พร้อม changed 0
 *       (สองอย่างนี้คนละเรื่อง: "ไม่มีเจ้านี้" กับ "ไม่มีอะไรตรงเงื่อนไข")
 *    ④ เขียนเฉพาะเมื่อมีอะไรเปลี่ยนจริง — ไม่มีอะไรเปลี่ยน ⇒ ห้ามเรียกตัวเขียน
 *       (เขียนทุกครั้ง = แคชถูกแตะโดยไม่มีเหตุ และ mtime จะโกหกว่ามีการแก้)
 *    ⑤ `changed` ต้องนับ **รายการที่เปลี่ยนจริง** ไม่ใช่รายการที่ชื่อตรงเงื่อนไข
 *       (ที่อยู่เดือนถูกแล้วต้องไม่ถูกนับ ⇒ ยิงซ้ำได้โดยเลขไม่พอง)
 *
 * 🟠 **สองข้อที่เทสนี้ตรึง "พฤติกรรมวันนี้" ไว้ พร้อมเขียนว่าทำไมน่าเป็นห่วง — ยังไม่แก้**
 *    (เส้นนี้เขียนข้อมูลบัญชี ⇒ เปลี่ยนกติกาต้องบอกก่อน ไม่ใช่แก้เงียบ ๆ)
 *    · เดือนผ่านแค่รูป `\d{4}-\d{2}` ⇒ **`2026-13` และ `2026-00` ผ่าน** แล้วบิลถูกย้ายไปเดือนที่ไม่มีจริง
 *    · `match` เทียบแบบ "มีข้อความนี้อยู่" **ไม่มีความยาวขั้นต่ำ** ⇒ ส่ง `match: "2"` ย้ายเกือบทุกใบ
 *      ⇒ พลาดพิมพ์ครั้งเดียวย้ายบิลทั้งเจ้า และคำตอบจะบอกว่าสำเร็จพร้อมเลขที่ดูสมเหตุสมผล
 */
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นTS = 'app/api/bills/fixmonth/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นTS],
    ปลอม: {
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.status = init?.status ?? 200 }
  static json(ก้อน, init) { const r = new NextResponse('', init); r.ก้อน = ก้อน; return r }
}
`,
      '@/lib/billblobs': `
import { readFileSync, appendFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนfix, 'utf8'));
const จด = (o) => appendFileSync(process.env.จดfix, JSON.stringify(o) + '\\n', 'utf8');
export async function loadBillIndexBlobs(vendor) { จด({ ทำ: 'load', vendor }); return อ่าน().ดัชนี; }
export async function saveBillIndexBlobs(vendor, idx) { จด({ ทำ: 'save', vendor, idx }); }
`,
    },
  })
  งาน = ผล.ที่ออก
  const ไฟล์ป้อน = join(งาน, 'ป้อน.json')
  const ไฟล์จด = join(งาน, 'จด.jsonl')
  process.env['ป้อนfix'] = ไฟล์ป้อน
  process.env['จดfix'] = ไฟล์จด
  writeFileSync(ไฟล์ป้อน, JSON.stringify({ ดัชนี: null }), 'utf8')
  writeFileSync(ไฟล์จด, '', 'utf8')
  const { POST } = await import(ผล.พาธของ(เส้นTS))

  const ยิง = async (body, ป้อน = { ดัชนี: null }) => {
    writeFileSync(ไฟล์ป้อน, JSON.stringify(ป้อน), 'utf8')
    writeFileSync(ไฟล์จด, '', 'utf8')
    const r = await POST({ async json() { return body } })
    const เรียก = readFileSync(ไฟล์จด, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { r, ก้อน: r.ก้อน, เรียก, เขียนไหม: เรียก.some((c) => c.ทำ === 'save') }
  }
  const ดัชนี = (entries) => ({ ดัชนี: { lastScan: '2026-09-29', entries } })
  process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  const ครบ = { secret: 'รหัสจริง', vendor: 'adobe', match: 'THTT111', month: '2026-08' }

  console.log('① รหัส — ทุกทางที่ปฏิเสธต้อง 401 **และห้ามเขียน**')
  {
    const ป้อน = ดัชนี([{ filename: 'THTT111.pdf', month: '2026-07' }])
    for (const [ชื่อ, b] of [
      ['ไม่ส่งรหัส', { ...ครบ, secret: undefined }],
      ['รหัสผิด', { ...ครบ, secret: 'มั่ว' }],
      ['รหัสว่าง', { ...ครบ, secret: '' }],
    ]) {
      const { r, เขียนไหม } = await ยิง(b, ป้อน)
      ok(`${ชื่อ} ⇒ 401 และไม่เขียน`, r.status === 401 && !เขียนไหม, `สถานะ ${r.status} · เขียน ${เขียนไหม}`)
    }
    delete process.env.DRIVESYNC_SECRET
    const ไม่มีenv = await ยิง(ครบ, ป้อน)
    ok('ไม่ได้ตั้ง env ⇒ 401 และไม่เขียน', ไม่มีenv.r.status === 401 && !ไม่มีenv.เขียนไหม,
      'ผ่าน ⇒ วันที่ env หลุด ใครก็ย้ายบิลข้ามเดือนได้')
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  }

  console.log('② พารามิเตอร์ไม่ครบ/เดือนผิดรูป ⇒ 400 และห้ามเขียน')
  {
    const ป้อน = ดัชนี([{ filename: 'THTT111.pdf', month: '2026-07' }])
    for (const [ชื่อ, b] of [
      ['ไม่มี vendor', { ...ครบ, vendor: '' }],
      ['ไม่มี match', { ...ครบ, match: '' }],
      ['ไม่มี month', { ...ครบ, month: undefined }],
      ['month ผิดรูป 2026-8', { ...ครบ, month: '2026-8' }],
      ['month ผิดรูป 26-08', { ...ครบ, month: '26-08' }],
      ['month เป็นข้อความ', { ...ครบ, month: 'สิงหาคม' }],
    ]) {
      const { r, เขียนไหม } = await ยิง(b, ป้อน)
      ok(`${ชื่อ} ⇒ 400 และไม่เขียน`, r.status === 400 && !เขียนไหม, `สถานะ ${r.status} · เขียน ${เขียนไหม}`)
    }
  }

  console.log('③ ไม่มีแคชของเจ้านั้น ⇒ 404 (ไม่ใช่ 200 พร้อม changed 0)')
  {
    const { r, เขียนไหม } = await ยิง(ครบ, { ดัชนี: null })
    ok('ได้ 404', r.status === 404, String(r.status))
    ok('ไม่เขียน', !เขียนไหม)
    ok('บอกว่าไม่มีแคชของเจ้านี้', /no cache/i.test(JSON.stringify(r.ก้อน)), JSON.stringify(r.ก้อน))
  }

  console.log('④ เขียนเฉพาะเมื่อมีอะไรเปลี่ยนจริง')
  {
    const เปลี่ยน = await ยิง(ครบ, ดัชนี([
      { filename: 'THTT111-a.pdf', month: '2026-07' },
      { filename: 'THTT999-b.pdf', month: '2026-07' },
    ]))
    ok('มีรายการตรง ⇒ เขียน', เปลี่ยน.เขียนไหม, JSON.stringify(เปลี่ยน.เรียก.map((c) => c.ทำ)))
    ok('changed = 1', เปลี่ยน.ก้อน.changed === 1, String(เปลี่ยน.ก้อน.changed))
    ok('ย้ายเฉพาะใบที่ชื่อตรง', เปลี่ยน.เรียก.find((c) => c.ทำ === 'save').idx.entries
      .find((e) => e.filename === 'THTT999-b.pdf').month === '2026-07',
      'ย้ายใบที่ไม่ตรงด้วย = ย้ายบิลผิดใบโดยคำตอบยังบอกว่าสำเร็จ')
    const ไม่ตรงเลย = await ยิง(ครบ, ดัชนี([{ filename: 'อื่น.pdf', month: '2026-07' }]))
    ok('ไม่มีรายการตรง ⇒ ไม่เขียน และ changed = 0',
      !ไม่ตรงเลย.เขียนไหม && ไม่ตรงเลย.ก้อน.changed === 0,
      `เขียน ${ไม่ตรงเลย.เขียนไหม} · changed ${ไม่ตรงเลย.ก้อน.changed}`)
  }

  console.log('⑤ changed นับรายการที่เปลี่ยนจริง — ยิงซ้ำได้โดยเลขไม่พอง')
  {
    const อยู่แล้ว = await ยิง(ครบ, ดัชนี([{ filename: 'THTT111.pdf', month: '2026-08' }]))
    ok('อยู่เดือนถูกแล้ว ⇒ changed = 0', อยู่แล้ว.ก้อน.changed === 0, String(อยู่แล้ว.ก้อน.changed))
    ok('และไม่เขียน (ไม่แตะแคชโดยไม่มีเหตุ)', !อยู่แล้ว.เขียนไหม,
      'เขียนทุกครั้ง ⇒ mtime ของแคชโกหกว่ามีการแก้ ⇒ ตัวเฝ้าที่ดู mtime จะเข้าใจผิด')
    const ผสม = await ยิง(ครบ, ดัชนี([
      { filename: 'THTT111-a.pdf', month: '2026-07' },
      { filename: 'THTT111-b.pdf', month: '2026-08' },
      { filename: 'THTT111-c.pdf', month: '2026-06' },
    ]))
    ok('สามใบตรงชื่อ แต่เปลี่ยนจริง 2 ⇒ changed = 2', ผสม.ก้อน.changed === 2,
      `${ผสม.ก้อน.changed} ⇒ นับ 3 = รายงานว่าย้าย 3 ใบทั้งที่ย้าย 2`)
  }

  console.log('🟠 ⑥ พฤติกรรมวันนี้ที่ตรึงไว้พร้อมข้อสังเกต — **ยังไม่แก้ รอบอกก่อน**')
  {
    /* 🟠 เดือนผ่านแค่รูป \d{4}-\d{2} ⇒ 2026-13 และ 2026-00 ผ่าน
       ⇒ บิลถูกย้ายไปเดือนที่ไม่มีจริง แล้วหายจากทุกจอที่ไล่เดือน 01–12
       🚫 ไม่แก้เองเพราะเส้นนี้เขียนข้อมูลบัญชี เปลี่ยนกติกาต้องบอกก่อน */
    const เดือน13 = await ยิง({ ...ครบ, month: '2026-13' }, ดัชนี([{ filename: 'THTT111.pdf', month: '2026-07' }]))
    ok('2026-13 ผ่านด่านรูปแบบ (พฤติกรรมวันนี้)', เดือน13.r.status === 200, String(เดือน13.r.status))
    console.log('     🟠 ข้อสังเกต: เดือน 13 ผ่านได้ ⇒ บิลย้ายไปเดือนที่ไม่มีจริง แล้วหายจากจอที่ไล่ 01–12')
    /* 🟠 match ไม่มีความยาวขั้นต่ำ ⇒ ส่ง "2" ย้ายเกือบทุกใบ */
    const สั้น = await ยิง({ ...ครบ, match: '2' }, ดัชนี([
      { filename: 'THTT111-2026.pdf', month: '2026-07' },
      { filename: 'FBADS-2026-01.pdf', month: '2026-07' },
      { filename: 'ไม่มีเลข.pdf', month: '2026-07' },
    ]))
    ok('match "2" ย้าย 2 ใบ (พฤติกรรมวันนี้)', สั้น.ก้อน.changed === 2, String(สั้น.ก้อน.changed))
    console.log('     🟠 ข้อสังเกต: match ไม่มีความยาวขั้นต่ำ ⇒ พลาดพิมพ์ครั้งเดียวย้ายบิลทั้งเจ้า')
    console.log('        และคำตอบจะบอกว่าสำเร็จพร้อมเลขที่ดูสมเหตุสมผล ⇒ ไม่มีอะไรฟ้อง')
  }
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมที่เก็บดัชนี — ของจริงคือตรรกะตัดสินและการนับของเส้นนี้')
console.log('🟠 มีสองข้อที่ตรึง "พฤติกรรมวันนี้" ไว้ ไม่ใช่ "พฤติกรรมที่ควรเป็น" — อ่านหัวไฟล์')
process.exit(ตก ? 1 : 0)
