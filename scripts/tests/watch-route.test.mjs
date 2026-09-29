#!/usr/bin/env node
/* ตัวเฝ้า "เดือนนี้เจ้าไหนยังไม่มีบิล" (`app/api/bills/watch/route.ts`)
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · กอง T2)
 *
 * 🔴 เส้นนี้เป็น **ตัวเตือน** ⇒ ความเสียหายของมันคือ "เตือนผิด" กับ "เงียบตอนควรเตือน"
 *    ไม่ใช่ข้อมูลเสีย ⇒ เทสต้องจับสองทิศนี้ ไม่ใช่แค่ว่าตอบ 200
 *    (บทเรียน: ตัวเตือนที่ร้องตอนไม่มีอะไรผิด ทำให้คนเลิกอ่านคำเตือน
 *     และตัวเตือนที่เงียบตอนของหาย จะไปรู้ตัวตอนทำบัญชีสิ้นปี)
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① รหัสผิด/ไม่มี/ไม่ได้ตั้ง env ⇒ 401
 *    ② **สามสถานะ** มีบิล · ไม่มีบิล · **อ่านคลังไม่ได้** — กองที่สามห้ามยุบเข้าสองกองแรก
 *       ยุบเข้า "ไม่มีบิล" = เตือนผิดตอน Blobs ล่ม · ยุบเข้า "มีบิล" = เงียบตอนของหายจริง
 *    ③ `ok` ต้องเป็น false เมื่อมีเจ้าที่อ่านไม่ได้ — **"ยังไม่รู้" ไม่ใช่ "เรียบร้อย"**
 *    ④ เฝ้าเฉพาะเจ้าที่ติดธง everyMonth และ `watched` ต้องเท่าจำนวนนั้น
 *    ⑤ นับสองแหล่งรวมกัน (บิลในดัชนี + ไฟล์ `<เดือน>_REAL_`) และต้องไม่นับของเดือนอื่น
 *    ⑥ เดือนค่าเริ่มต้น = เดือนก่อนหน้า **ตามเวลาไทย** — ช่วง 00:00–07:00 ไทยคือรอยที่พลาด
 *    ⑦ **สามสถานะของ month** (CEO ตัดสิน 30 ก.ย. 2569)
 *       ไม่ส่งมาเลย ⇒ ถอยไปเดือนก่อนหน้า · ส่งมาแล้วรูปผิด ⇒ 400 · นอกช่วง 01–12 ⇒ 400
 *       เดิมสองกองหลังถอยเงียบเหมือนกองแรก ⇒ ตอบว่า "เดือนที่คุณถามไม่มีบิล"
 *       ทั้งที่ไปตรวจอีกเดือน = **คำตอบที่ถูกทุกคำแต่ตอบคำถามอื่น**
 *    ⑧ ต้องถามทั้งสองแหล่งของทุกเจ้าที่เฝ้า — ไม่ใช่ถามแหล่งเดียวแล้วสรุป
 */
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นTS = 'app/api/bills/watch/route.ts'
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
      /* ⚠️ อ่านไฟล์ใหม่ทุกครั้งที่ถูกแตะ (Proxy) — ถ้าอ่านครั้งเดียวตอน import
         ค่าจะถูกแช่ไว้ ⇒ เคสหลังใช้ข้อมูลของเคสแรก แล้ว**ข้อที่พึ่ง const จะตกอยู่ข้อเดียว**
         ซึ่งหลอกกว่าตกทั้งหมด (เหยียบมาแล้ว 3 ครั้ง 29 ก.ย. 2569) */
      '@/lib/vendors': `
import { readFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนwatch, 'utf8')).vendors;
export const BILL_VENDORS = new Proxy([], {
  get(_t, p) { const a = อ่าน(); const v = a[p]; return typeof v === 'function' ? v.bind(a) : v },
  has(_t, p) { return p in อ่าน() },
});
`,
      '@/lib/billblobs': `
import { readFileSync, appendFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนwatch, 'utf8'));
const จด = (o) => appendFileSync(process.env.จดwatch, JSON.stringify(o) + '\\n', 'utf8');
export async function loadBillIndexBlobs(id) {
  จด({ ทำ: 'idx', id });
  const ของ = อ่าน().ของ?.[id] ?? {};
  if (ของ.idxพัง) throw new Error(ของ.idxพัง);
  return ของ.idx ?? null;
}
export async function listVendorBlobFiles(id) {
  จด({ ทำ: 'blobs', id });
  const ของ = อ่าน().ของ?.[id] ?? {};
  if (ของ.blobsพัง) throw new Error(ของ.blobsพัง);
  return ของ.blobs ?? [];
}
`,
    },
  })
  งาน = ผล.ที่ออก
  const ไฟล์ป้อน = join(งาน, 'ป้อน.json')
  const ไฟล์จด = join(งาน, 'จด.jsonl')
  process.env['ป้อนwatch'] = ไฟล์ป้อน
  process.env['จดwatch'] = ไฟล์จด
  writeFileSync(ไฟล์ป้อน, JSON.stringify({ vendors: [] }), 'utf8')
  writeFileSync(ไฟล์จด, '', 'utf8')
  const { GET } = await import(ผล.พาธของ(เส้นTS))

  const ยิง = async (search, ป้อน) => {
    writeFileSync(ไฟล์ป้อน, JSON.stringify(ป้อน), 'utf8')
    writeFileSync(ไฟล์จด, '', 'utf8')
    const r = await GET({ nextUrl: new URL(`https://x.test/api/bills/watch${search}`) })
    const เรียก = readFileSync(ไฟล์จด, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { r, ก้อน: r.ก้อน, เรียก }
  }
  process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  const ร = '?secret=รหัสจริง'
  const เจ้า = (over = {}) => ({
    vendors: [
      { id: 'line', name: 'LINE', everyMonth: true },
      { id: 'adobe', name: 'Adobe', everyMonth: true },
      { id: 'netlify', name: 'Netlify', note: 'ไม่ส่งใบเข้าเมล', everyMonth: true },
      { id: 'omise', name: 'Omise' },              // ไม่ติดธง ⇒ ไม่เฝ้า
      { id: 'shopify', name: 'www (Shopify)' },     // ไม่ติดธง ⇒ ไม่เฝ้า
    ],
    ...over,
  })

  console.log('① รหัส — ทุกทางที่ปฏิเสธต้อง 401')
  {
    for (const [ชื่อ, s] of [
      ['ไม่ส่งรหัส', ''],
      ['รหัสผิด', '?secret=มั่ว'],
      ['รหัสว่าง', '?secret='],
    ]) {
      const { r } = await ยิง(s, เจ้า())
      ok(`${ชื่อ} ⇒ 401`, r.status === 401, String(r.status))
    }
    delete process.env.DRIVESYNC_SECRET
    const { r } = await ยิง(ร, เจ้า())
    ok('ไม่ได้ตั้ง env ⇒ 401 (ไม่ใช่ปล่อยผ่านเพราะ required ว่าง)', r.status === 401, String(r.status))
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  }

  console.log('② สามสถานะ — อ่านคลังไม่ได้ ต้องไม่ไปโผล่ในกอง "ไม่มีบิล" หรือ "มีบิล"')
  {
    const p = เจ้า({
      ของ: {
        line: { idx: { entries: [{ month: '2026-08', filename: 'a.pdf' }] }, blobs: [] },
        adobe: { idx: { entries: [] }, blobs: [] },
        netlify: { idxพัง: 'Blobs ตอบ 503' },
      },
    })
    const { ก้อน } = await ยิง(`${ร}&month=2026-08`, p)
    ok('เจ้าที่มีบิล ⇒ อยู่ใน found', ก้อน.found.some((f) => f.id === 'line'), JSON.stringify(ก้อน.found))
    ok('เจ้าที่ไม่มีบิล ⇒ อยู่ใน missing', ก้อน.missing.some((m) => m.id === 'adobe'), JSON.stringify(ก้อน.missing))
    ok('เจ้าที่อ่านคลังไม่ได้ ⇒ อยู่ใน unreadable', ก้อน.unreadable.some((u) => u.id === 'netlify'),
      JSON.stringify(ก้อน.unreadable))
    ok('และ **ห้าม**โผล่ใน missing (ไม่งั้นเตือนผิดตอน Blobs ล่ม)',
      !ก้อน.missing.some((m) => m.id === 'netlify'),
      'นับเป็นไม่มีบิล = เตือนว่าบิลขาดทั้งที่แค่อ่านไม่ได้ ⇒ คนไล่หาบิลที่มีอยู่')
    ok('และ **ห้าม**โผล่ใน found (ไม่งั้นเงียบตอนของหายจริง)',
      !ก้อน.found.some((f) => f.id === 'netlify'),
      'นับเป็นมีบิล = เงียบตอนบิลขาดจริง ⇒ ไปรู้ตอนทำบัญชีสิ้นปี')
    ok('บอกเหตุที่อ่านไม่ได้ ไม่ใช่แค่ว่าอ่านไม่ได้',
      /503/.test(ก้อน.unreadable.find((u) => u.id === 'netlify')?.why ?? ''),
      JSON.stringify(ก้อน.unreadable))
    ok('อ่านคลังไฟล์ไม่ได้ก็ลงกองที่สามเหมือนกัน', (await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { blobsพัง: 'list ล้ม' }, adobe: { idx: { entries: [] } }, netlify: { idx: { entries: [] } } },
    }))).ก้อน.unreadable.some((u) => u.id === 'line'), 'สองแหล่ง แหล่งใดล้มก็ยังไม่รู้คำตอบ')
  }

  console.log('③ ok — "ยังไม่รู้" ไม่ใช่ "เรียบร้อย"')
  {
    const ครบ = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: {
        line: { idx: { entries: [{ month: '2026-08' }] } },
        adobe: { idx: { entries: [{ month: '2026-08' }] } },
        netlify: { blobs: [{ name: '2026-08_REAL_x.pdf' }] },
      },
    }))
    ok('ครบทุกเจ้า ⇒ ok = true', ครบ.ก้อน.ok === true, JSON.stringify(ครบ.ก้อน))
    const ขาด = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { idx: { entries: [{ month: '2026-08' }] } }, adobe: { idx: { entries: [] } }, netlify: { blobs: [{ name: '2026-08_REAL_x.pdf' }] } },
    }))
    ok('มีเจ้าขาดบิล ⇒ ok = false', ขาด.ก้อน.ok === false, String(ขาด.ก้อน.ok))
    const ไม่รู้ = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { idx: { entries: [{ month: '2026-08' }] } }, adobe: { idx: { entries: [{ month: '2026-08' }] } }, netlify: { idxพัง: 'ล่ม' } },
    }))
    ok('ไม่มีเจ้าขาด แต่มีเจ้าที่อ่านไม่ได้ ⇒ ok = false',
      ไม่รู้.ก้อน.ok === false,
      'ok = true ตอนยังอ่านไม่ครบ = ตอบว่าเรียบร้อยทั้งที่ยังไม่รู้ ⇒ ข่าวดีปลอม')
  }

  console.log('④ เฝ้าเฉพาะเจ้าที่ติดธง everyMonth')
  {
    const { ก้อน, เรียก } = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { idx: { entries: [] } }, adobe: { idx: { entries: [] } }, netlify: { idx: { entries: [] } } },
    }))
    ok('watched = 3 (ไม่ใช่ 5)', ก้อน.watched === 3, String(ก้อน.watched))
    const ที่ถูกถาม = [...new Set(เรียก.map((c) => c.id))].sort()
    ok('ไม่ไปถามเจ้าที่ไม่ได้เฝ้า', !ที่ถูกถาม.includes('omise') && !ที่ถูกถาม.includes('shopify'),
      JSON.stringify(ที่ถูกถาม))
    ok('เจ้าที่ไม่เฝ้าไม่โผล่ในคำตอบเลย',
      !JSON.stringify([ก้อน.found, ก้อน.missing, ก้อน.unreadable]).includes('omise'),
      JSON.stringify(ก้อน))
    /* 🔑 ตัวควบคุมลบ: ไม่มีเจ้าไหนติดธง ⇒ watched 0 และ ok ต้องเป็น true
       (ถ้าเขียน ok จาก "มี found ไหม" จะได้ false ⇒ เตือนตอนไม่มีอะไรให้เฝ้า) */
    const ไม่มีธง = await ยิง(`${ร}&month=2026-08`, { vendors: [{ id: 'omise', name: 'Omise' }] })
    ok('ตัวควบคุมลบ: ไม่มีเจ้าติดธง ⇒ watched 0 · ok true · ไม่เตือนอะไร',
      ไม่มีธง.ก้อน.watched === 0 && ไม่มีธง.ก้อน.ok === true && ไม่มีธง.ก้อน.missing.length === 0,
      JSON.stringify(ไม่มีธง.ก้อน))
  }

  console.log('⑤ นับสองแหล่งรวมกัน และไม่นับของเดือนอื่น')
  {
    const p = เจ้า({
      ของ: {
        line: {
          idx: { entries: [{ month: '2026-08' }, { month: '2026-07' }, { month: '2026-08' }] },
          blobs: [{ name: '2026-08_REAL_a.pdf' }, { name: '2026-07_REAL_b.pdf' }, { name: 'อื่น.pdf' }],
        },
        adobe: { idx: { entries: [{ month: '2026-07' }] }, blobs: [{ name: '2026-07_REAL_c.pdf' }] },
        netlify: { idx: null, blobs: [{ name: '2026-08_REAL_d.pdf' }] },
      },
    })
    const { ก้อน } = await ยิง(`${ร}&month=2026-08`, p)
    ok('line: ดัชนี 2 + ไฟล์จริง 1 = 3', ก้อน.found.find((f) => f.id === 'line')?.n === 3,
      JSON.stringify(ก้อน.found))
    ok('ของเดือนอื่นไม่ถูกนับ ⇒ adobe อยู่ใน missing',
      ก้อน.missing.some((m) => m.id === 'adobe') && !ก้อน.found.some((f) => f.id === 'adobe'),
      'นับข้ามเดือน = เดือนที่ขาดจริงจะถูกกลบด้วยบิลของเดือนอื่น')
    ok('ไม่มีดัชนี (null) แต่มีไฟล์จริง ⇒ ยังนับได้ ไม่พัง',
      ก้อน.found.find((f) => f.id === 'netlify')?.n === 1,
      JSON.stringify(ก้อน.found))
    ok('ไฟล์ที่ไม่มีคำนำหน้า <เดือน>_REAL_ ไม่ถูกนับ', ก้อน.found.find((f) => f.id === 'line')?.n === 3,
      'นับทุกไฟล์ในคลัง = ไฟล์เก่าค้างทำให้เดือนใหม่ดูมีบิล')
  }

  console.log('⑥ เดือนค่าเริ่มต้น = เดือนก่อนหน้า **ตามเวลาไทย**')
  {
    const Dเดิม = globalThis.Date
    const ตั้งเวลา = (iso) => {
      class D extends Dเดิม {
        constructor(...a) { if (a.length === 0) super(iso); else super(...a) }
        static now() { return new Dเดิม(iso).getTime() }
      }
      globalThis.Date = D
    }
    const ของว่าง = เจ้า({ ของ: { line: { idx: { entries: [] } }, adobe: { idx: { entries: [] } }, netlify: { idx: { entries: [] } } } })
    try {
      /* 🔴 รอยที่พลาด: ไทย 01:00 วันที่ 1 ก.ย. = UTC 18:00 วันที่ 31 ส.ค.
         ใช้เวลา UTC ดิบจะได้ "2026-07" ⇒ ตรวจผิดเดือนไปทั้งเดือน โดยไม่มี error */
      /* ⚠️ เรียกครั้งเดียวต่อข้อ แล้วเก็บผลไว้ — ถ้าเอา `await ยิง()` ไปใส่ในข้อความตอนตกด้วย
         มันจะยิงซ้ำ ⇒ ข้อความอาจรายงานค่าจากรอบที่ไม่ใช่รอบที่ตัดสิน */
      const วัด = async (iso) => { ตั้งเวลา(iso); return (await ยิง(ร, ของว่าง)).ก้อน.month }
      const เดือนที่รอยต่อ = await วัด('2026-08-31T18:00:00Z')
      ok('ไทย 1 ก.ย. 01:00 (UTC 31 ส.ค. 18:00) ⇒ เดือนก่อนหน้า = 2026-08', เดือนที่รอยต่อ === '2026-08',
        `ได้ ${เดือนที่รอยต่อ} ⇒ UTC ดิบให้ 2026-07 = ตรวจผิดเดือนไปทั้งเดือน โดยไม่มี error`)
      const ข้ามปี = await วัด('2026-01-04T22:00:00Z')
      ok('ไทย 5 ม.ค. ⇒ ข้ามปี = 2025-12', ข้ามปี === '2025-12', String(ข้ามปี))
      const กลางเดือน = await วัด('2026-09-15T05:00:00Z')
      ok('กลางเดือน ก.ย. ⇒ 2026-08', กลางเดือน === '2026-08', String(กลางเดือน))
      /* 🟢 ตัวควบคุมลบของการเลื่อนเวลา: จุดที่ไทยกับ UTC อยู่วันเดียวกัน ต้องได้เดือนเดียวกัน
         ⇒ ถ้าเลื่อนผิดทิศ (ลบ 7 ชม.) ข้อนี้ยังเขียว แต่ข้อ "ไทย 1 ก.ย. 01:00" จะแดง
            ⇒ สองข้อคู่กันจึงแยก "เลื่อนถูกทิศ" ออกจาก "ไม่ได้เลื่อนเลย" ได้ */
      const สิ้นปี = await วัด('2026-12-31T12:00:00Z')
      ok('ตัวควบคุมลบ: 31 ธ.ค. เที่ยง UTC (ไทย 19:00 วันเดียวกัน) ⇒ 2026-11', สิ้นปี === '2026-11',
        String(สิ้นปี))
    } finally {
      globalThis.Date = Dเดิม
    }
  }

  console.log('⑦ **สามสถานะของ month** — ไม่ส่ง=ถอยได้ · รูปผิด=400 · นอกช่วง=400')
  {
    const ของว่าง = เจ้า({ ของ: { line: { idx: { entries: [] } }, adobe: { idx: { entries: [] } }, netlify: { idx: { entries: [] } } } })

    /* 🟢 **ตัวควบคุมลบ และเป็นทางที่ของจริงใช้**
       `netlify/functions/bills-watch.mjs` ยิงเส้นนี้โดย **ไม่ส่ง month** เลย
       ⇒ ข้อนี้แดงเมื่อไหร่ = ตัวเฝ้าบิลของจริงตายทันที ไม่ใช่แค่เทสเพี้ยน */
    const ไม่ส่ง = await ยิง(ร, ของว่าง)
    ok('🟢 ไม่ส่ง month เลย ⇒ ถอยไปเดือนก่อนหน้า (ทางที่ของจริงใช้)',
      ไม่ส่ง.r.status === 200 && /^\d{4}-(0[1-9]|1[0-2])$/.test(ไม่ส่ง.ก้อน.month || ''),
      `${ไม่ส่ง.r.status} · ${ไม่ส่ง.ก้อน.month} ⇒ แดงข้อนี้ = ตัวเฝ้าบิลของจริงตาย`)

    for (const เดือน of ['2026-03', '2026-01', '2026-12']) {
      const { r, ก้อน } = await ยิง(`${ร}&month=${เดือน}`, ของว่าง)
      ok(`🟢 ตัวควบคุมลบ: month=${เดือน} ต้องผ่านและใช้เดือนนั้น`,
        r.status === 200 && ก้อน.month === เดือน,
        `${r.status} · ${ก้อน.month} ⇒ ไม่มีข้อนี้ ด่านที่ปฏิเสธทุกเดือนก็เขียว`)
    }

    /* 🔴 เดิมสองกองล่างนี้ **ถอยไปค่าเริ่มต้นเงียบ ๆ** เหมือนกรณีไม่ส่ง
       ⇒ ผู้เรียกอ้างเดือนหนึ่ง เราไปตรวจอีกเดือน แล้วตอบว่า "เดือนนั้นไม่มีบิล"
       ⇒ เป็นคำตอบที่**ถูกทุกคำแต่ตอบคำถามอื่น** ซึ่งคนอ่านแยกไม่ออกเลย */
    for (const [ชื่อ, q] of [
      ['รูปผิด 2026-3', '2026-3'],
      ['เป็นข้อความ', 'มีนาคม'],
      ['ไม่มีเดือน', '2026'],
      ['มีช่องแต่ว่าง', ''],
      ['นอกช่วง 2026-13', '2026-13'],
      ['นอกช่วง 2026-00', '2026-00'],
      ['นอกช่วง 2026-99', '2026-99'],
    ]) {
      const { r, ก้อน, เรียก } = await ยิง(`${ร}&month=${encodeURIComponent(q)}`, ของว่าง)
      ok(`${ชื่อ} ("${q}") ⇒ 400`, r.status === 400,
        `${r.status} · month ที่ใช้ ${ก้อน?.month} ⇒ ถอยเงียบ = ตรวจเดือนอื่นแล้วตอบเหมือนตรวจเดือนที่ถาม`)
      ok(`${ชื่อ} ⇒ บอกค่าที่ส่งมากลับไปด้วย`, ก้อน?.['ส่งมา'] === q,
        `${JSON.stringify(ก้อน)} ⇒ ไม่บอก = คนแก้ไม่รู้ว่าตัวเองพิมพ์อะไรไป`)
      ok(`${ชื่อ} ⇒ **ไม่ไปอ่านคลังเลย** (ปฏิเสธก่อนทำงาน)`, เรียก.length === 0,
        `${JSON.stringify(เรียก.map((c) => c.ทำ))} ⇒ อ่านคลังก่อนแล้วค่อยตีกลับ = จ่ายค่าอ่านฟรีทุกครั้ง`)
    }
  }

  console.log('⑧ ถามทั้งสองแหล่งของทุกเจ้าที่เฝ้า — ไม่ใช่ถามแหล่งเดียวแล้วสรุป')
  {
    const { เรียก } = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { idx: { entries: [] } }, adobe: { idx: { entries: [] } }, netlify: { idx: { entries: [] } } },
    }))
    for (const id of ['line', 'adobe', 'netlify']) {
      ok(`${id}: ถามทั้งดัชนีและคลังไฟล์`,
        เรียก.some((c) => c.ทำ === 'idx' && c.id === id) && เรียก.some((c) => c.ทำ === 'blobs' && c.id === id),
        JSON.stringify(เรียก.filter((c) => c.id === id)))
    }
    ok('ไม่ถามซ้ำเกินจำเป็น (2 ครั้งต่อเจ้า)', เรียก.length === 6, `${เรียก.length} ครั้ง`)
  }

  console.log('⑨ note ของเจ้าต้องไปถึงคำตอบ — อธิบายว่าทำไมเจ้านี้ดูขาด')
  {
    const { ก้อน } = await ยิง(`${ร}&month=2026-08`, เจ้า({
      ของ: { line: { idx: { entries: [{ month: '2026-08' }] } }, adobe: { idx: { entries: [{ month: '2026-08' }] } }, netlify: { idx: { entries: [] } } },
    }))
    const n = ก้อน.missing.find((m) => m.id === 'netlify')
    ok('missing พาชื่อเจ้าไปด้วย', n?.name === 'Netlify', JSON.stringify(n))
    ok('missing พา note ไปด้วย', n?.note === 'ไม่ส่งใบเข้าเมล',
      `${JSON.stringify(n)} ⇒ ไม่มี note = คนเห็นว่า Netlify ขาดบิลแล้วไปหาในเมลซึ่งไม่มีอยู่จริง`)
  }
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมทะเบียนเจ้าและที่เก็บบิล — ของจริงคือตรรกะสามสถานะ · การนับ · และเดือนตามเวลาไทย')
console.log('🟢 ทางที่ของจริงใช้ (ไม่ส่ง month) มีข้อคุมไว้ — แดงข้อนั้น = ตัวเฝ้าบิลของจริงตาย')
process.exit(ตก ? 1 : 0)
