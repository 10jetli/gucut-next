#!/usr/bin/env node
/* เส้นรับ/ลบไฟล์บิลตัวจริง (`app/api/bills/upload/route.ts`)
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · กอง T2)
 *
 * 🔴 **เส้นเดียวในระบบที่ลบเอกสารบัญชีได้** และอยู่ **นอกกำแพงล็อกอิน**
 *    (`/api/bills/upload` อยู่ใน PUBLIC_PATHS · middleware.ts บรรทัด 37)
 *    ⇒ `secret` ในไฟล์นี้คือด่านเดียว · บิลลบแล้วไม่มีถังขยะให้กู้
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① **กุญแจมาก่อนวิธี** — GET ไม่มีรหัส ⇒ 401 · มีรหัส ⇒ 405
 *       (เดิมได้ 405 ทุกกรณี ⇒ ตัวตรวจ**พิสูจน์ไม่ได้**ว่าเส้นนี้ปฏิเสธคนแปลกหน้า)
 *       และ GET ต้อง **ไม่เขียนไม่ลบ** — ตัวตรวจห้ามก่อผลในสิ่งที่มันตรวจ
 *    ② ทุกทางที่ปฏิเสธ (401/400) ⇒ **ห้ามเขียนห้ามลบ**
 *    ③ ไฟล์ต้องเป็น PDF จริง (ยาว ≥ 1000 และขึ้นต้น %PDF-) + **ตัวควบคุมลบที่ขอบ**
 *    ④ ชื่อไฟล์ถูกล้างอักขระเส้นทาง ⇒ `/` กลายเป็น `_` (ไม่มีทางเขียนออกนอกโฟลเดอร์เจ้า)
 *    ⑤ ชื่อในถังต้องเป็น `<เดือน>_REAL_<ชื่อ>.pdf` เป๊ะ — ทั้งระบบแกะเดือนและธง REAL จากรูปนี้
 *    ⑥ กันซ้ำด้วย **ตัวตนของใบ** · อ่านตัวตนไม่ได้ ⇒ ถอยไปกันด้วยชื่อไฟล์
 *       **ห้ามทิ้งไฟล์** (บิลหายแย่กว่าบิลซ้ำ) และต้องบอกว่ารอบนี้กันซ้ำด้วยอะไร
 *    ⑦ จดรอบบิลด้วย **ชื่อที่ใช้จริงในถัง** ไม่ใช่ชื่อที่ผู้ส่งกรอก · อ่านรอบไม่ได้ ⇒ ไม่จดอะไร
 *       · จดไม่สำเร็จ **ห้ามทำให้การอัปล้มเหลว** (ไฟล์เข้าถังแล้วสำคัญกว่าแคช)
 *    ⑧ DELETE: **ไม่มี wildcard ไม่มีลบเป็นชุด** · แยก deleted=true ออกจาก 404 ให้ชัด
 */
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  /* 🔑 บรรทัดนี้พิมพ์ **เฉพาะตอนตก** ⇒ ใช้เป็นสมอของสูตรปลูกได้
     (ชื่อข้อบรรทัดบนถูกพิมพ์ตอนผ่านด้วย ⇒ เอาเป็นสมอแล้วตรงฟรีเสมอ) */
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}
const เส้นTS = 'app/api/bills/upload/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นTS],
    ปลอม: {
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; this.headers = new Headers(init?.headers) }
  static json(ก้อน, init) { const r = new NextResponse(JSON.stringify(ก้อน), init); r.ก้อน = ก้อน; return r }
}
`,
      /* ⚠️ Proxy อ่านไฟล์ใหม่ทุกครั้ง — const ที่อ่านครั้งเดียวตอน import จะแช่ค่าไว้ */
      '@/lib/vendors': `
import { readFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนup, 'utf8')).vendors;
export const BILL_VENDORS = new Proxy([], {
  get(_t, p) { const a = อ่าน(); const v = a[p]; return typeof v === 'function' ? v.bind(a) : v },
});
`,
      '@/lib/bill-ingest': `
import { readFileSync } from 'node:fs';
export async function ตัวตนของไฟล์อัป(buf, vendorId) {
  const c = JSON.parse(readFileSync(process.env.ป้อนup, 'utf8')).ตัวตน ?? {};
  if (c.พัง) throw new Error(c.พัง);
  return { key: c.key ?? null, why: c.why ?? null, period: c.period };
}
`,
      '@/lib/billblobs': `
import { readFileSync, appendFileSync } from 'node:fs';
const อ่าน = () => JSON.parse(readFileSync(process.env.ป้อนup, 'utf8'));
const จด = (o) => appendFileSync(process.env.จดup, JSON.stringify(o) + '\\n', 'utf8');
export async function syncBillByIdentity(vendorId, filename, mime, bytes, identity) {
  จด({ ทำ: 'เขียนด้วยตัวตน', vendorId, filename, identity, ไบต์: bytes.length });
  return อ่าน().ผลเขียน ?? { written: true, reason: 'เขียนใหม่' };
}
export async function syncBillToBlobs(vendorId, filename, mime, bytes) {
  จด({ ทำ: 'เขียนด้วยชื่อ', vendorId, filename, ไบต์: bytes.length });
  return อ่าน().เขียนด้วยชื่อสำเร็จ ?? true;
}
export async function deleteBillBlob(vendorId, name) {
  จด({ ทำ: 'ลบ', vendorId, name });
  return อ่าน().ลบสำเร็จ ?? true;
}
export async function loadRealPeriods(vendorId) {
  จด({ ทำ: 'อ่านรอบ', vendorId });
  if (อ่าน().รอบพัง) throw new Error(อ่าน().รอบพัง);
  return อ่าน().รอบเดิม ?? {};
}
export async function saveRealPeriods(vendorId, m) {
  จด({ ทำ: 'จดรอบ', vendorId, m });
  if (อ่าน().จดรอบพัง) throw new Error(อ่าน().จดรอบพัง);
}
`,
    },
  })
  งาน = ผล.ที่ออก
  const ไฟล์ป้อน = join(งาน, 'ป้อน.json')
  const ไฟล์จด = join(งาน, 'จด.jsonl')
  process.env['ป้อนup'] = ไฟล์ป้อน
  process.env['จดup'] = ไฟล์จด
  writeFileSync(ไฟล์ป้อน, JSON.stringify({ vendors: [] }), 'utf8')
  writeFileSync(ไฟล์จด, '', 'utf8')
  const { GET, POST, DELETE, OPTIONS } = await import(ผล.พาธของ(เส้นTS))

  const เจ้า = [{ id: 'line', name: 'LINE' }, { id: 'adobe', name: 'Adobe' }]
  const pdf = (n = 2000) => {
    const b = Buffer.alloc(n, 0x20)
    Buffer.from('%PDF-1.7').copy(b, 0)
    return b
  }
  const ตั้ง = (o = {}) => writeFileSync(ไฟล์ป้อน, JSON.stringify({ vendors: เจ้า, ...o }), 'utf8')
  const เก็บ = () => readFileSync(ไฟล์จด, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const ล้าง = () => writeFileSync(ไฟล์จด, '', 'utf8')

  const ยิงPOST = async (ช่อง, ไบต์ = pdf()) => {
    ล้าง()
    const fd = new FormData()
    for (const [k, v] of Object.entries(ช่อง)) if (v !== undefined) fd.set(k, v)
    if (ไบต์) fd.set('file', new Blob([ไบต์], { type: 'application/pdf' }), 'x.pdf')
    const r = await POST({ async formData() { return fd } })
    const เรียก = เก็บ()
    return { r, ก้อน: r.ก้อน, เรียก, แตะถังไหม: เรียก.some((c) => c.ทำ.startsWith('เขียน') || c.ทำ === 'ลบ') }
  }
  const ยิงDELETE = async (qs) => {
    ล้าง()
    const r = await DELETE({ nextUrl: new URL(`https://admin.gucut.com/api/bills/upload${qs}`) })
    const เรียก = เก็บ()
    return { r, ก้อน: r.ก้อน, เรียก, ลบไหม: เรียก.some((c) => c.ทำ === 'ลบ') }
  }
  const ครบ = { secret: 'รหัสจริง', vendor: 'line', month: '2026-08', filename: 'ใบเสร็จ LINE.pdf' }
  process.env.DRIVESYNC_SECRET = 'รหัสจริง'

  console.log('① กุญแจมาก่อนวิธี — GET ไม่มีรหัส 401 · มีรหัส 405 · และห้ามแตะถัง')
  {
    ตั้ง()
    for (const [ชื่อ, qs] of [['ไม่มีรหัส', ''], ['รหัสผิด', '?secret=มั่ว'], ['รหัสว่าง', '?secret=']]) {
      ล้าง()
      const r = await GET({ url: `https://admin.gucut.com/api/bills/upload${qs}` })
      ok(`GET ${ชื่อ} ⇒ 401 (ไม่ใช่ 405)`, r.status === 401,
        `${r.status} ⇒ 405 ทุกกรณี = พิสูจน์ไม่ได้ว่าเส้นนี้ปฏิเสธคนแปลกหน้า`)
      ok(`GET ${ชื่อ} ⇒ ไม่แตะถัง`, เก็บ().length === 0, JSON.stringify(เก็บ()))
    }
    ล้าง()
    const ถูก = await GET({ url: 'https://admin.gucut.com/api/bills/upload?secret=รหัสจริง' })
    ok('GET รหัสถูก ⇒ 405 พร้อมบอกว่าต้องใช้ POST', ถูก.status === 405
      && /POST/.test(JSON.stringify(ถูก.ก้อน)), `${ถูก.status} ${JSON.stringify(ถูก.ก้อน)}`)
    ok('GET รหัสถูก ⇒ ยังไม่แตะถัง (ตัวตรวจห้ามก่อผลในสิ่งที่มันตรวจ)', เก็บ().length === 0,
      JSON.stringify(เก็บ()))
    const o = await OPTIONS()
    ok('OPTIONS ⇒ 204 พร้อมหัว CORS (ตัวเก็บบิลบน g1 ยิงข้ามโดเมน)',
      o.status === 204 && o.headers.get('Access-Control-Allow-Methods')?.includes('DELETE'),
      `${o.status} · ${o.headers.get('Access-Control-Allow-Methods')}`)
  }

  console.log('② ทุกทางที่ปฏิเสธ ⇒ ห้ามเขียนห้ามลบ')
  {
    ตั้ง({ ตัวตน: { key: 'k1', period: '2026-08' } })
    const เคส = [
      ['ไม่ส่งรหัส', { ...ครบ, secret: undefined }, 401],
      ['รหัสผิด', { ...ครบ, secret: 'มั่ว' }, 401],
      ['vendor ไม่รู้จัก', { ...ครบ, vendor: 'มั่ว' }, 400],
      ['vendor ว่าง', { ...ครบ, vendor: '' }, 400],
      ['month ผิดรูป', { ...ครบ, month: '2026-8' }, 400],
      ['month ว่าง', { ...ครบ, month: '' }, 400],
    ]
    for (const [ชื่อ, ช่อง, สถานะ] of เคส) {
      const { r, แตะถังไหม } = await ยิงPOST(ช่อง)
      ok(`${ชื่อ} ⇒ ${สถานะ} และไม่แตะถัง`, r.status === สถานะ && !แตะถังไหม,
        `สถานะ ${r.status} · แตะถัง ${แตะถังไหม}`)
    }
    const { r: ไม่มีไฟล์, แตะถังไหม } = await ยิงPOST(ครบ, null)
    ok('ไม่แนบไฟล์ ⇒ 400 และไม่แตะถัง', ไม่มีไฟล์.status === 400 && !แตะถังไหม, String(ไม่มีไฟล์.status))
    delete process.env.DRIVESYNC_SECRET
    const ไม่มีenv = await ยิงPOST(ครบ)
    ok('ไม่ได้ตั้ง env ⇒ 401 และไม่แตะถัง', ไม่มีenv.r.status === 401 && !ไม่มีenv.แตะถังไหม,
      'ปล่อยผ่านตอน env หลุด = เส้นที่ลบเอกสารบัญชีได้เปิดสาธารณะ')
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  }

  console.log('③ ต้องเป็น PDF จริง — พร้อมตัวควบคุมลบที่ขอบ (1000 ไบต์พอดีต้องผ่าน)')
  {
    ตั้ง({ ตัวตน: { key: 'k1', period: '2026-08' } })
    const สั้น = await ยิงPOST(ครบ, pdf(999))
    ok('999 ไบต์ ⇒ 400 และไม่เขียน', สั้น.r.status === 400 && !สั้น.แตะถังไหม, String(สั้น.r.status))
    const ไม่ใช่pdf = await ยิงPOST(ครบ, Buffer.alloc(2000, 0x41))
    ok('ไม่ขึ้นต้น %PDF- ⇒ 400 และไม่เขียน', ไม่ใช่pdf.r.status === 400 && !ไม่ใช่pdf.แตะถังไหม,
      String(ไม่ใช่pdf.r.status))
    /* 🟢 ตัวควบคุมลบ: ไม่มีข้อนี้ ด่านที่ปฏิเสธ **ทุกไฟล์** ก็เขียว
       ⇒ แล้วตัวเก็บบิลอัตโนมัติจะถูกปฏิเสธเงียบ ๆ ทุกคืน โดยไม่มีใครเห็น */
    const พอดี = await ยิงPOST(ครบ, pdf(1000))
    ok('🟢 ตัวควบคุมลบ: 1000 ไบต์พอดีและเป็น PDF ⇒ ผ่านและเขียน',
      พอดี.r.status === 200 && พอดี.แตะถังไหม,
      `${พอดี.r.status} ⇒ ถ้าข้อนี้แดง = ด่านปฏิเสธของที่ควรรับ ⇒ บิลไม่เข้าคลังทุกคืนแบบเงียบ`)
  }

  console.log('④⑤ ชื่อไฟล์ — ล้างอักขระเส้นทาง และรูป <เดือน>_REAL_<ชื่อ>.pdf เป๊ะ')
  {
    ตั้ง({ ตัวตน: { key: 'k1', period: '2026-08' } })
    const ธรรมดา = await ยิงPOST(ครบ)
    const ชื่อในถัง = ธรรมดา.เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename
    ok('ชื่อในถัง = 2026-08_REAL_ใบเสร็จ LINE.pdf', ชื่อในถัง === '2026-08_REAL_ใบเสร็จ LINE.pdf',
      `${ชื่อในถัง} ⇒ ทั้งระบบแกะเดือนและธง REAL จากรูปนี้ เพี้ยนแล้วบิลหายจากทุกจอ`)
    const ไม่มีนามสกุล = await ยิงPOST({ ...ครบ, filename: 'ใบเสร็จ' })
    ok('ไม่มี .pdf ⇒ เติมให้', ไม่มีนามสกุล.เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename
      === '2026-08_REAL_ใบเสร็จ.pdf',
      String(ไม่มีนามสกุล.เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename))
    const เส้นทาง = await ยิงPOST({ ...ครบ, filename: '../../etc/passwd.pdf' })
    const ชื่อเส้นทาง = เส้นทาง.เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename ?? ''
    ok('อักขระเส้นทางถูกล้าง — ไม่มี / เหลืออยู่', !ชื่อเส้นทาง.includes('/'),
      `${ชื่อเส้นทาง} ⇒ เหลือ / ไว้ = เขียนออกนอกโฟลเดอร์ของเจ้านั้นได้`)
    ok('และยังขึ้นต้นด้วย <เดือน>_REAL_ เหมือนเดิม', ชื่อเส้นทาง.startsWith('2026-08_REAL_'),
      ชื่อเส้นทาง)
    const ยาว = await ยิงPOST({ ...ครบ, filename: `${'ก'.repeat(300)}.pdf` })
    const ชื่อยาว = ยาว.เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename ?? ''
    ok('ชื่อยาวถูกตัดที่ 150 ตัว (ไม่ใช่ปล่อยยาวจนคีย์ในถังพัง)',
      ชื่อยาว.length === '2026-08_REAL_'.length + 150 + 4 || ชื่อยาว.length <= '2026-08_REAL_'.length + 154,
      `ยาว ${ชื่อยาว.length} ตัว`)
    /* 🔑 เดือนนอกช่วง 01–12 ⇒ **400 และไม่เขียน** (CEO ตัดสิน 30 ก.ย. 2569 · กติกาเดียวกับ fixmonth)
       เดิม `2026-13` ผ่านและเขียนไฟล์จริงชื่อ `2026-13_REAL_…`
       ⇒ ไฟล์อยู่ในถังจริง แต่ไม่มีจอไหนไล่เดือน 13 ⇒ **บิลที่มีอยู่ดูเหมือนขาด**
          และตัวเฝ้า (`bills/watch`) จะเตือนว่าขาดด้วย ⇒ อ่านรวมกันได้ว่า "บิลหาย" */
    for (const ด of ['2026-13', '2026-00', '2026-99']) {
      const { r, แตะถังไหม } = await ยิงPOST({ ...ครบ, month: ด })
      ok(`month=${ด} (นอกช่วง) ⇒ 400 และไม่เขียน`, r.status === 400 && !แตะถังไหม,
        `${r.status} · แตะถัง ${แตะถังไหม} ⇒ ผ่าน = ไฟล์เข้าถังในชื่อที่ไม่มีจอไหนไล่เจอ`)
    }
    /* 🟢 ตัวควบคุมลบของด่านช่วงเดือน — เดือนขอบทั้งสองข้างต้องยังเขียนได้
       ไม่มีข้อนี้ ด่านที่เขียนผิดเป็น "ปฏิเสธทุกเดือน" ก็เขียว
       แล้วตัวเก็บบิลอัตโนมัติจะถูกปฏิเสธเงียบ ๆ ทุกคืน โดยไม่มีอะไรฟ้อง */
    for (const ด of ['2026-01', '2026-12']) {
      const { r, เรียก } = await ยิงPOST({ ...ครบ, month: ด })
      ok(`🟢 ตัวควบคุมลบ: month=${ด} ⇒ ผ่านและเขียนในชื่อ ${ด}_REAL_…`,
        r.status === 200 && เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename?.startsWith(`${ด}_REAL_`),
        `${r.status} · ${เรียก.find((c) => c.ทำ.startsWith('เขียน'))?.filename}`)
    }
  }

  console.log('⑥ กันซ้ำด้วยตัวตนของใบ · อ่านตัวตนไม่ได้ ⇒ ถอยไปชื่อไฟล์ **ห้ามทิ้งไฟล์**')
  {
    ตั้ง({ ตัวตน: { key: 'INV-777', period: '2026-08' } })
    const มีตัวตน = await ยิงPOST(ครบ)
    ok('มีตัวตน ⇒ เรียกตัวเขียนที่กันซ้ำด้วยตัวตน',
      มีตัวตน.เรียก.some((c) => c.ทำ === 'เขียนด้วยตัวตน' && c.identity === 'INV-777'),
      JSON.stringify(มีตัวตน.เรียก.map((c) => c.ทำ)))
    ok('และบอกบนคำตอบว่ากันซ้ำด้วยอะไร', มีตัวตน.ก้อน['กันซ้ำด้วย'] === 'ตัวตนของใบ',
      JSON.stringify(มีตัวตน.ก้อน))

    ตั้ง({ ตัวตน: { key: null, why: 'ข้อความใน PDF ว่าง' }, เขียนด้วยชื่อสำเร็จ: true })
    const ไร้ตัวตน = await ยิงPOST(ครบ)
    ok('อ่านตัวตนไม่ได้ ⇒ **ยังเขียนไฟล์** (บิลหายแย่กว่าบิลซ้ำ)',
      ไร้ตัวตน.r.status === 200 && ไร้ตัวตน.เรียก.some((c) => c.ทำ === 'เขียนด้วยชื่อ'),
      JSON.stringify(ไร้ตัวตน.เรียก.map((c) => c.ทำ)))
    ok('และบอกเหตุที่อ่านตัวตนไม่ได้กลับไป (ไม่ใช่เงียบ)',
      ไร้ตัวตน.ก้อน['ตัวตนอ่านไม่ได้เพราะ'] === 'ข้อความใน PDF ว่าง'
      && /ชื่อไฟล์/.test(ไร้ตัวตน.ก้อน['กันซ้ำด้วย'] ?? ''),
      `${JSON.stringify(ไร้ตัวตน.ก้อน)} ⇒ ไม่บอก = ไม่มีใครรู้ว่าใบนี้ไม่ได้ผ่านตัวกันซ้ำตัวจริง`)
    ok('และไม่เรียกตัวเขียนแบบตัวตนซ้อนอีกตัว',
      !ไร้ตัวตน.เรียก.some((c) => c.ทำ === 'เขียนด้วยตัวตน'),
      JSON.stringify(ไร้ตัวตน.เรียก.map((c) => c.ทำ)))

    ตั้ง({
      ตัวตน: { key: 'INV-777', period: '2026-08' },
      ผลเขียน: { written: false, reason: 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น', sameAs: '2026-08_REAL_เก่า.pdf' },
    })
    const ซ้ำ = await ยิงPOST(ครบ)
    ok('ใบซ้ำ ⇒ uploaded=false · skipped=true · บอกเหตุและชื่อใบที่ซ้ำกับ',
      ซ้ำ.ก้อน.uploaded === false && ซ้ำ.ก้อน.skipped === true
      && ซ้ำ.ก้อน.sameAs === '2026-08_REAL_เก่า.pdf' && /มีอยู่แล้ว/.test(ซ้ำ.ก้อน.reason ?? ''),
      `${JSON.stringify(ซ้ำ.ก้อน)} ⇒ ตอบ ok เฉย ๆ ทั้งสองกรณี = ตัวเก็บบิลแยกไม่ออกว่าเข้าถังไหม`)
    ok('ยังตอบ 200 (ข้ามเพราะซ้ำ ไม่ใช่ความล้มเหลว)', ซ้ำ.r.status === 200, String(ซ้ำ.r.status))
  }

  console.log('⑦ จดรอบบิล — ใช้ชื่อในถัง · อ่านรอบไม่ได้ไม่จด · จดพลาดห้ามล้มการอัป')
  {
    ตั้ง({ ตัวตน: { key: 'k1', period: '2026-07' }, รอบเดิม: { 'ของเก่า.pdf': '2026-06' } })
    const จด = await ยิงPOST(ครบ)
    const ที่จด = จด.เรียก.find((c) => c.ทำ === 'จดรอบ')
    ok('จดรอบด้วย **ชื่อที่ใช้จริงในถัง**', ที่จด?.m?.['2026-08_REAL_ใบเสร็จ LINE.pdf'] === '2026-07',
      `${JSON.stringify(ที่จด?.m)} ⇒ จดด้วยชื่อที่ผู้ส่งกรอก = คีย์ไม่ตรงกับไฟล์ในถัง ⇒ จอหาไม่เจอ`)
    ok('และไม่ทับรอบของใบอื่นที่จดไว้แล้ว', ที่จด?.m?.['ของเก่า.pdf'] === '2026-06',
      JSON.stringify(ที่จด?.m))

    ตั้ง({ ตัวตน: { key: 'k1' } })   // period undefined = อ่านรอบไม่ได้
    const ไม่รู้รอบ = await ยิงPOST(ครบ)
    ok('อ่านรอบไม่ได้ (undefined) ⇒ **ไม่จดอะไรเลย** ให้จอลองอ่านใหม่รอบหน้า',
      !ไม่รู้รอบ.เรียก.some((c) => c.ทำ === 'จดรอบ' || c.ทำ === 'อ่านรอบ'),
      `${JSON.stringify(ไม่รู้รอบ.เรียก.map((c) => c.ทำ))} ⇒ จดค่าว่างลงไป = แคชบอกว่า "รู้แล้วว่าไม่มีรอบ"`)
    ok('แต่ยังเขียนไฟล์ตามปกติ', ไม่รู้รอบ.เรียก.some((c) => c.ทำ.startsWith('เขียน')),
      JSON.stringify(ไม่รู้รอบ.เรียก.map((c) => c.ทำ)))

    ตั้ง({ ตัวตน: { key: 'k1', period: '2026-07' }, จดรอบพัง: 'Blobs ล่ม' })
    const จดพัง = await ยิงPOST(ครบ)
    ok('จดรอบไม่สำเร็จ ⇒ การอัป **ยังสำเร็จ** (ไฟล์เข้าถังสำคัญกว่าแคช)',
      จดพัง.r.status === 200 && จดพัง.เรียก.some((c) => c.ทำ.startsWith('เขียน')),
      `${จดพัง.r.status} ⇒ ล้มทั้งคำขอเพราะแคช = ตัวเก็บบิลคืนนั้นได้ error แล้วไม่ส่งซ้ำ`)

    ตั้ง({ ตัวตน: { พัง: 'อ่าน PDF ไม่ได้' } })
    const ตัวตนพัง = await ยิงPOST(ครบ)
    ok('ตัวอ่านตัวตนโยน error ⇒ 500 พร้อมข้อความ (ไม่ใช่ 200 ที่อ่านว่าสำเร็จ)',
      ตัวตนพัง.r.status === 500 && /อ่าน PDF ไม่ได้/.test(JSON.stringify(ตัวตนพัง.ก้อน)),
      `${ตัวตนพัง.r.status} ${JSON.stringify(ตัวตนพัง.ก้อน)}`)
    ok('และไม่เขียนไฟล์ในรอบที่พังกลางทาง', !ตัวตนพัง.แตะถังไหม,
      JSON.stringify(ตัวตนพัง.เรียก.map((c) => c.ทำ)))
  }

  console.log('⑧ DELETE — ไม่มี wildcard · แยก deleted=true ออกจาก 404')
  {
    ตั้ง({ ลบสำเร็จ: true })
    const ชื่อเต็ม = '2026-08_REAL_ใบเสร็จ LINE.pdf'
    for (const [ชื่อ, qs] of [
      ['ไม่มีรหัส', `?vendor=line&name=${encodeURIComponent(ชื่อเต็ม)}`],
      ['รหัสผิด', `?secret=มั่ว&vendor=line&name=${encodeURIComponent(ชื่อเต็ม)}`],
    ]) {
      const { r, ลบไหม } = await ยิงDELETE(qs)
      ok(`DELETE ${ชื่อ} ⇒ 401 และไม่ลบ`, r.status === 401 && !ลบไหม, `${r.status} · ลบ ${ลบไหม}`)
    }
    const เจ้ามั่ว = await ยิงDELETE(`?secret=รหัสจริง&vendor=มั่ว&name=${encodeURIComponent(ชื่อเต็ม)}`)
    ok('vendor ไม่รู้จัก ⇒ 400 และไม่ลบ', เจ้ามั่ว.r.status === 400 && !เจ้ามั่ว.ลบไหม, String(เจ้ามั่ว.r.status))
    for (const [ชื่อ, name] of [
      ['ไม่ส่ง name', ''],
      ['wildcard *', '2026-08_REAL_*'],
      ['wildcard ?', '2026-08_REAL_?.pdf'],
      ['มี / ในชื่อ', '../2026-08_REAL_x.pdf'],
    ]) {
      const { r, ลบไหม } = await ยิงDELETE(`?secret=รหัสจริง&vendor=line&name=${encodeURIComponent(name)}`)
      ok(`name "${name || '(ว่าง)'}" ⇒ 400 และ **ไม่ลบ**`, r.status === 400 && !ลบไหม,
        `${r.status} · ลบ ${ลบไหม} ⇒ ตัวลบที่รับ pattern = วันหนึ่งลบทั้งเดือนเพราะพิมพ์ผิดตัวเดียว`)
    }
    const ลบจริง = await ยิงDELETE(`?secret=รหัสจริง&vendor=line&name=${encodeURIComponent(ชื่อเต็ม)}`)
    ok('ชื่อเต็มถูกต้อง ⇒ ลบและตอบ deleted=true',
      ลบจริง.r.status === 200 && ลบจริง.ก้อน.deleted === true, JSON.stringify(ลบจริง.ก้อน))
    ok('ส่งชื่อให้ตัวลบเป๊ะตามที่รับมา (ไม่แปลงเอง)',
      ลบจริง.เรียก.find((c) => c.ทำ === 'ลบ')?.name === ชื่อเต็ม,
      JSON.stringify(ลบจริง.เรียก))
    ตั้ง({ ลบสำเร็จ: false })
    const ไม่มีไฟล์ = await ยิงDELETE(`?secret=รหัสจริง&vendor=line&name=${encodeURIComponent(ชื่อเต็ม)}`)
    ok('ไม่มีไฟล์ชื่อนั้น ⇒ **404 ไม่ใช่ 200 ok**', ไม่มีไฟล์.r.status === 404,
      `${ไม่มีไฟล์.r.status} ⇒ ตอบ ok ทั้งสองกรณี = คนเรียกแยกไม่ออกว่าลบถูกใบไหม`)
    ok('และบอกชื่อกับเจ้ากลับไปให้ตรวจได้',
      ไม่มีไฟล์.ก้อน.name === ชื่อเต็ม && ไม่มีไฟล์.ก้อน.vendor === 'line',
      JSON.stringify(ไม่มีไฟล์.ก้อน))
  }
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมที่เก็บบิล · ตัวอ่านตัวตน · ทะเบียนเจ้า — ของจริงคือตรรกะรับเข้า/ปฏิเสธ/ลบของเส้นนี้')
console.log('🟢 ด่านช่วงเดือนมีตัวควบคุมลบกำกับ (2026-01 / 2026-12 ต้องยังเขียนได้)')
process.exit(ตก ? 1 : 0)
