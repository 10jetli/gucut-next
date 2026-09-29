#!/usr/bin/env node
/* เส้นดาวน์โหลดซองบิล (`app/api/bills/zip/route.ts`) — 23 บรรทัดที่ส่งไฟล์ให้บัญชียื่นภาษี
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569 · คิวตามเกณฑ์ของใบ · กอง T2)
 *
 * 🔑 ไฟล์สั้น แต่ทุกบรรทัดตัดสินว่าคนที่กดดาวน์โหลด **รู้ไหมว่าซองขาดบิล**
 *    ตรรกะสร้างซองมีเทสของตัวเองแล้ว (`billzip.test.mjs` 30 ข้อ)
 *    ⇒ ที่ยังไม่มีใครตรวจคือ **เส้นนี้ส่งของออกไปถูกไหม และบอกความขาดผ่านอะไร**
 *
 * 🔒 ข้อที่ตรึงไว้
 *    ① สร้างซองไม่ได้ ⇒ **400 พร้อมเหตุ** ไม่ใช่ส่งซองเปล่าที่เปิดได้แต่ไม่มีอะไร
 *    ② 🔴 **จำนวนที่ขาดต้องออกไปกับคำตอบ** (`X-Bills-Missing`) — ไม่งั้นคนโหลดไม่รู้ว่าซองไม่ครบ
 *       แล้วส่งต่อบัญชี ⇒ ค้นพบอีกทีตอนยื่นภาษีผิด
 *    ③ ชื่อไฟล์ไทยต้องถูก encode แบบ `filename*=UTF-8''…` ไม่ใช่ `filename=` เปล่า
 *       (ชื่อไฟล์เป็นภาษาไทยทุกใบ · ใส่ผิดรูป ⇒ เบราว์เซอร์ตั้งชื่อเป็นตัวขยะหรือทิ้งชื่อ)
 *    ④ Content-Type ต้องเป็น application/zip ไม่ใช่ json
 *    ⑤ ส่ง vendor/month ที่ผู้ใช้ให้มา **ตามจริง** ไม่เติมค่าเริ่มต้นแทน
 *       (เติมเอง ⇒ คนขอเดือนหนึ่งได้อีกเดือน โดยไฟล์ยังโหลดได้ปกติ)
 *
 * ⚠️ ขอบเขต: ปลอม next/server กับตัวสร้างซอง — ของจริงคือ **การประกอบคำตอบของเส้นนี้**
 */
import { rmSync } from 'node:fs'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const เส้นTS = 'app/api/bills/zip/route.ts'
/* 🔴 **ฝาแฝดที่ต่างกันตรงจุดเดียว และจุดนั้นคือกำแพงเดียวที่กั้นเนื้อบิล**
   · `/api/bills/zip`      — **ไม่ได้อยู่ใน PUBLIC_PATHS** ⇒ middleware ตรวจโทเคนล็อกอินให้
   · `/api/bills/fetchzip` — **อยู่ใน PUBLIC_PATHS** (ยืนยันจาก middleware.ts บรรทัด 37)
     ⇒ ด่านเดียวที่กั้นคือ `secret` ในตัวเส้นเอง · ถอดออก = ซองบิลเปิดสาธารณะทันที
     (บิลมีชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี)
   🔑 เทสสองข้อล่างสุดจึงเป็น **คู่** โดยตั้งใจ: zip ไม่มีรหัสก็ต้องผ่าน · fetchzip ไม่มีรหัสต้อง 401
      ⇒ วันที่ใครยุบสองเส้นเป็นเส้นเดียว **ข้อใดข้อหนึ่งจะแดงแน่นอน** ไม่ว่ายุบไปทางไหน */
const เส้นดึงTS = 'app/api/bills/fetchzip/route.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({
    ไฟล์: [เส้นTS, เส้นดึงTS],
    ปลอม: {
      'next/server': `
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; this.headers = new Headers(init?.headers) }
  static json(ก้อน, init) { const r = new NextResponse(JSON.stringify(ก้อน), init); r.ก้อน = ก้อน; return r }
}
`,
      /* ตัวสร้างซองปลอม — **จดสิ่งที่ถูกส่งเข้ามา** เพื่อตรวจข้อ ⑤ */
      '@/lib/billzip': `
import { readFileSync, writeFileSync } from 'node:fs';
export async function สร้างซองบิล(vendor, month) {
  writeFileSync(process.env.จดคำขอ, JSON.stringify({ vendor, month }), 'utf8');
  return JSON.parse(readFileSync(process.env.ป้อนซอง, 'utf8'));
}
`,
    },
  })
  งาน = ผล.ที่ออก
  const { writeFileSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const ไฟล์ซอง = join(งาน, 'ซอง.json')
  const ไฟล์คำขอ = join(งาน, 'คำขอ.json')
  process.env['ป้อนซอง'] = ไฟล์ซอง
  process.env['จดคำขอ'] = ไฟล์คำขอ
  writeFileSync(ไฟล์ซอง, '{"ok":false,"error":"ตั้งต้น","ได้":0,"ขาด":0}', 'utf8')
  writeFileSync(ไฟล์คำขอ, '{}', 'utf8')
  const { GET } = await import(ผล.พาธของ(เส้นTS))
  const คำขอ = (qs) => ({ nextUrl: new URL(`https://admin.gucut.com/api/bills/zip${qs}`) })
  const ยิง = async (qs, ซอง) => {
    writeFileSync(ไฟล์ซอง, JSON.stringify(ซอง), 'utf8')
    const r = await GET(คำขอ(qs))
    return { r, ส่งเข้า: JSON.parse(readFileSync(ไฟล์คำขอ, 'utf8')) }
  }

  console.log('① สร้างซองไม่ได้ ⇒ 400 พร้อมเหตุ (ไม่ใช่ซองเปล่าที่เปิดได้แต่ไม่มีอะไร)')
  {
    const { r } = await ยิง('?vendor=มั่ว&month=2026-08',
      { ok: false, error: 'ไม่รู้จักผู้ให้บริการ: มั่ว', ได้: 0, ขาด: 0 })
    ok('ได้ 400', r.status === 400, String(r.status))
    ok('บอกเหตุจากตัวสร้างซอง', /ไม่รู้จักผู้ให้บริการ/.test(JSON.stringify(r.ก้อน)), JSON.stringify(r.ก้อน))
    ok('ไม่ส่งไฟล์ออกไป', r.headers.get('Content-Type') !== 'application/zip',
      String(r.headers.get('Content-Type')))
  }

  console.log('② 🔴 จำนวนที่ขาดต้องออกไปกับคำตอบ — ไม่งั้นคนโหลดไม่รู้ว่าซองไม่ครบ')
  {
    const { r } = await ยิง('?vendor=tiktok&month=2026-08',
      { ok: true, buf: 'PK-ปลอม', ชื่อไฟล์: 'TikTok 2026-08.zip', ได้: 3, ขาด: 2 })
    ok('มีหัว X-Bills-Missing', r.headers.get('X-Bills-Missing') === '2',
      `${r.headers.get('X-Bills-Missing')} ⇒ ไม่บอก = คนส่งต่อบัญชีแล้วรู้อีกทีตอนยื่นภาษีผิด`)
    ok('มีหัว X-Bills-Added', r.headers.get('X-Bills-Added') === '3', String(r.headers.get('X-Bills-Added')))
    ok('ขาด 0 ก็ยังต้องส่งหัวมา (ไม่ใช่ละไว้)',
      (await ยิง('?vendor=tiktok&month=2026-08',
        { ok: true, buf: 'PK', ชื่อไฟล์: 'a.zip', ได้: 4, ขาด: 0 })).r.headers.get('X-Bills-Missing') === '0',
      'ละไว้ตอนขาด 0 ⇒ จอแยกไม่ออกระหว่าง "ครบ" กับ "ไม่มีข้อมูล"')
  }

  console.log('③ ชื่อไฟล์ไทยต้อง encode แบบ filename*=UTF-8 (ไม่ใช่ filename= เปล่า)')
  {
    const { r } = await ยิง('?vendor=tiktok&month=2026-08',
      { ok: true, buf: 'PK', ชื่อไฟล์: 'ใบเสร็จ ทิกทอก 2026-08.zip', ได้: 1, ขาด: 0 })
    const cd = r.headers.get('Content-Disposition')
    ok("ใช้รูป filename*=UTF-8''", /filename\*=UTF-8''/.test(cd), String(cd))
    ok('ชื่อถูก encode (ไม่มีอักษรไทยดิบในหัว)', !/[฀-๿]/.test(cd), String(cd))
    ok('อ่านกลับได้ตรงชื่อเดิม',
      decodeURIComponent(cd.split("filename*=UTF-8''")[1]) === 'ใบเสร็จ ทิกทอก 2026-08.zip', String(cd))
    ok('เป็น attachment (ไม่ใช่เปิดในแท็บ)', /^attachment;/.test(cd), String(cd))
  }

  console.log('④ Content-Type ต้องเป็น application/zip')
  {
    const { r } = await ยิง('?vendor=tiktok&month=2026-08',
      { ok: true, buf: 'PK', ชื่อไฟล์: 'a.zip', ได้: 1, ขาด: 0 })
    ok('application/zip', r.headers.get('Content-Type') === 'application/zip',
      String(r.headers.get('Content-Type')))
    ok('ส่งเนื้อซองออกไป ไม่ใช่ JSON', r.body === 'PK', String(r.body).slice(0, 30))
  }

  console.log('⑤ ส่ง vendor/month ตามที่ผู้ใช้ให้มา ห้ามเติมค่าเริ่มต้นแทน')
  {
    const ครบ = await ยิง('?vendor=adobe&month=2026-07', { ok: true, buf: 'PK', ชื่อไฟล์: 'a.zip', ได้: 1, ขาด: 0 })
    ok('ส่ง vendor ตามจริง', ครบ.ส่งเข้า.vendor === 'adobe', JSON.stringify(ครบ.ส่งเข้า))
    ok('ส่ง month ตามจริง', ครบ.ส่งเข้า.month === '2026-07', JSON.stringify(ครบ.ส่งเข้า))
    /* 🔴 ไม่ส่งพารามิเตอร์มา ⇒ ต้องส่ง null ต่อไปให้ตัวสร้างซองปฏิเสธ
       **ห้ามเติมเดือนปัจจุบันหรือเจ้าตัวแรกแทน** — คนขอเดือนหนึ่งจะได้อีกเดือน
       โดยไฟล์ยังโหลดได้ปกติ ซึ่งเป็นความผิดที่ไม่มีอะไรฟ้อง */
    const ว่าง = await ยิง('', { ok: false, error: 'ต้องระบุ month=YYYY-MM', ได้: 0, ขาด: 0 })
    ok('ไม่ส่ง vendor ⇒ ส่ง null ต่อไป', ว่าง.ส่งเข้า.vendor === null, JSON.stringify(ว่าง.ส่งเข้า))
    ok('ไม่ส่ง month ⇒ ส่ง null ต่อไป', ว่าง.ส่งเข้า.month === null, JSON.stringify(ว่าง.ส่งเข้า))
    ok('และได้ 400 จากตัวสร้างซอง', ว่าง.r.status === 400, String(ว่าง.r.status))
  }
  console.log('⑥ ฝาแฝด /api/bills/fetchzip — อยู่นอกกำแพงล็อกอิน ⇒ รหัสในเส้นเป็นด่านเดียว')
  {
    const { GET: ดึง } = await import(ผล.พาธของ(เส้นดึงTS))
    const ยิงดึง = async (qs, ซอง) => {
      writeFileSync(ไฟล์ซอง, JSON.stringify(ซอง), 'utf8')
      writeFileSync(ไฟล์คำขอ, '{"ยังไม่ถูกเรียก":true}', 'utf8')
      const r = await ดึง({ nextUrl: new URL(`https://admin.gucut.com/api/bills/fetchzip${qs}`) })
      return { r, ส่งเข้า: JSON.parse(readFileSync(ไฟล์คำขอ, 'utf8')) }
    }
    const ซองดี = { ok: true, buf: 'PK', ชื่อไฟล์: 'LINE 2026-08.zip', ได้: 2, ขาด: 1 }

    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
    for (const [ชื่อ, qs] of [
      ['ไม่ส่งรหัส', '?vendor=line&month=2026-08'],
      ['รหัสผิด', '?secret=มั่ว&vendor=line&month=2026-08'],
      ['รหัสว่าง', '?secret=&vendor=line&month=2026-08'],
    ]) {
      const { r, ส่งเข้า } = await ยิงดึง(qs, ซองดี)
      ok(`${ชื่อ} ⇒ 401`, r.status === 401, String(r.status))
      /* 🔴 ข้อที่แพงกว่าสถานะ: ห้าม**สร้างซองก่อน**แล้วค่อยเช็ครหัส
         สร้างซอง = อ่านไฟล์บิลจริงทั้งเดือนออกจากคลัง ⇒ คนไม่มีสิทธิ์ทำให้เราไปหยิบของออกมา
         (ถึงจะไม่ได้ส่งออกไป ก็เป็นงานที่คนนอกสั่งได้ และเป็นทางให้วัดว่ามีของกี่ใบ) */
      ok(`${ชื่อ} ⇒ **ไม่ไปสร้างซองเลย**`, ส่งเข้า.ยังไม่ถูกเรียก === true,
        `${JSON.stringify(ส่งเข้า)} ⇒ เช็ครหัสหลังสร้างซอง = คนนอกสั่งให้เราอ่านไฟล์บิลได้`)
    }
    delete process.env.DRIVESYNC_SECRET
    const ไม่มีenv = await ยิงดึง('?secret=&vendor=line&month=2026-08', ซองดี)
    ok('ไม่ได้ตั้ง env ⇒ 401 (ไม่ใช่ปล่อยผ่านเพราะ required ว่าง = ตรงกับ secret ว่าง)',
      ไม่มีenv.r.status === 401,
      `${ไม่มีenv.r.status} ⇒ env หลุดแล้วเส้นเปิดสาธารณะ ทั้งที่ไม่มีอะไรเปลี่ยนในโค้ด`)
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'

    const ถูก = await ยิงดึง('?secret=รหัสจริง&vendor=line&month=2026-08', ซองดี)
    ok('รหัสถูก ⇒ ส่งซองออกไปเหมือนเส้นฝาแฝด', ถูก.r.status === 200
      && ถูก.r.headers.get('Content-Type') === 'application/zip', String(ถูก.r.status))
    ok('และพาจำนวนที่ขาดไปด้วย (คนละเส้นแต่กติกาเดียวกัน)',
      ถูก.r.headers.get('X-Bills-Missing') === '1' && ถูก.r.headers.get('X-Bills-Added') === '2',
      `ขาด ${ถูก.r.headers.get('X-Bills-Missing')} · ได้ ${ถูก.r.headers.get('X-Bills-Added')}`)
    ok('ส่ง vendor/month ตามที่ขอ ไม่เติมค่าเริ่มต้นแทน',
      ถูก.ส่งเข้า.vendor === 'line' && ถูก.ส่งเข้า.month === '2026-08', JSON.stringify(ถูก.ส่งเข้า))
    ok('สร้างซองไม่ได้ ⇒ 400 พร้อมเหตุ (ไม่ใช่ 401 ที่ทำให้คนคิดว่ารหัสผิด)',
      (await ยิงดึง('?secret=รหัสจริง&vendor=มั่ว&month=2026-08',
        { ok: false, error: 'ไม่รู้จักผู้ให้บริการ: มั่ว', ได้: 0, ขาด: 0 })).r.status === 400,
      'ตอบ 401 ตอนซองสร้างไม่ได้ ⇒ คนไปแก้รหัสทั้งที่รหัสถูกอยู่แล้ว')

    /* 🔒 **คู่ที่พิสูจน์ว่าสองเส้นยังแยกกันอยู่** — ดูเหตุผลเต็มที่หัวไฟล์
       ข้อนี้ต้องเป็น "ผ่าน" ไม่ใช่ "401" เพราะกำแพงของเส้นนี้อยู่ที่ middleware ไม่ได้อยู่ในไฟล์ */
    const zipไม่มีรหัส = await ยิง('?vendor=line&month=2026-08', ซองดี)
    ok('🔒 /api/bills/zip ไม่มีรหัสก็ยังผ่าน (กำแพงอยู่ที่ middleware)', zipไม่มีรหัส.r.status === 200,
      `${zipไม่มีรหัส.r.status} ⇒ ถ้าข้อนี้แดงคู่กับข้อ fetchzip ข้างบน = มีคนยุบสองเส้นเข้าหากัน`)
  }

} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('🔒 ไฟล์นี้ครอบสองเส้น: /api/bills/zip (หลังกำแพงล็อกอิน) และ /api/bills/fetchzip (นอกกำแพง)')
console.log('⚠️ ขอบเขต: ปลอม next/server กับตัวสร้างซอง — ของจริงคือการประกอบคำตอบของเส้นนี้'
  + ' (ตรรกะสร้างซองมีเทสของตัวเองแล้ว 30 ข้อใน billzip.test.mjs)')
process.exit(ตก ? 1 : 0)
