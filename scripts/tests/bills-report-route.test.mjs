#!/usr/bin/env node
/* เส้นรายงานความครบบิล (`app/api/bills/report/route.ts`) — **route.ts ตัวแรกที่มีเทส**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569)
 *
 * 🔑 ทำไมตัวนี้ก่อน — คิวเรียงตามเกณฑ์ที่ใบสั่งไว้ คือ **แตะเงิน/สต็อก** ไม่ใช่เรียงตามความง่าย
 *    และในคิว 22 ไฟล์ ตัวนี้อยู่กอง T2 (พึ่งแต่ `lib/` ของเราเอง)
 *    ⇒ ไม่ต้องปลอมของนอกบ้าน ซึ่งฝั่งท่อเตือนว่า "เทสที่ปลอมทุกอย่าง" มีค่าน้อยกว่ายิงจริงหลัง deploy
 *
 * 🔒 กฎที่ไฟล์นี้ประกาศเอง และเทสตรึงไว้:
 *    ① **ไม่มีรหัส/รหัสผิด ⇒ 401** และ **ไม่ได้ตั้ง env ก็ต้อง 401** (ไม่รู้ ⇒ ปิด ไม่ใช่เปิด)
 *    ② ผู้ให้บริการที่ไม่รู้จัก ⇒ **400 พร้อมบอกชื่อ** ไม่ใช่เงียบแล้วคืนทุกเจ้า
 *    ③ 🔴 **อ่านอย่างเดียว ห้ามคืนเนื้อไฟล์** — บิลมีชื่อ ที่อยู่ เลขภาษีของร้าน
 *       ⇒ ตรวจแบบบัญชีขาว: คำตอบมีได้เฉพาะ ชื่อไฟล์ · เดือน · จำนวน
 *          (บัญชีดำของคำจะตกยุคทุกครั้งที่มีคนเพิ่มช่องใหม่)
 *    ④ หมายเหตุบนคำตอบต้องบอกว่า **ตัวเลขตรงกับที่จอแสดง** — ข้อความเป็นส่วนหนึ่งของความถูกต้อง
 *       (รอบแรกเส้นนี้เขียนตรรกะแยกจากจอ แล้ว TikTok ส.ค. ได้ 9 ทั้งที่จอโชว์ 4)
 *
 * ⚠️ ขอบเขต: ปลอม `next/server` · ทะเบียนเจ้า · ตัวสรุป — ของจริงคือ **ตรรกะของเส้นเอง**
 *    (ลำดับการตรวจรหัส · การตรวจชื่อเจ้า · รูปคำตอบ) · ไม่ได้ทดสอบว่า middleware ปล่อยผ่าน
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `bills-report-route-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  /* 🔑 บรรทัดนี้พิมพ์ **เฉพาะตอนตก** ⇒ ใช้เป็นสมอของสูตรปลูกได้
     (ชื่อข้อบรรทัดบนถูกพิมพ์ตอนผ่านด้วย ⇒ เอาเป็นสมอแล้วตรงฟรีเสมอ) */
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}

try {
  /* ⚠️ เส้นนี้ import ด้วยพาธย่อ `@/lib/...` ⇒ ต้องคอมไพล์ด้วย tsconfig ที่มี `paths`
     (ธงบรรทัดเดียวไม่มีทางใส่ `paths` ได้ ⇒ tsc ตอบ TS2307 แล้วเราจะไปงงว่าโค้ดผิด)
     และต้องชี้ typeRoots เอง เพราะ tsconfig อยู่ใน /tmp */
  const tsconfig = join(out, 'tsconfig.json')
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      target: 'es2022', module: 'es2022', moduleResolution: 'bundler', skipLibCheck: true,
      baseUrl: process.cwd(), paths: { '@/*': ['./*'] },
      typeRoots: [join(process.cwd(), 'node_modules/@types')], types: ['node'],
      /* 🔴 rootDir ต้องเป็นรากรีโป ไม่ใช่โฟลเดอร์ของเส้นนั้น
         เพราะ tsc พ่นไฟล์ที่ถูก import ต่อ (lib/*.ts) ออกมาด้วย ⇒ ถ้า rootDir แคบกว่า
         มันตอบ TS6059 ว่าไฟล์อยู่นอก rootDir ⇒ ผลคือที่ออกจะเป็น out/app/api/... */
      rootDir: process.cwd(), outDir: out,
    },
    files: [join(process.cwd(), 'app/api/bills/report/route.ts')],
  }))
  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  /* ปลอม next/server เท่าที่เส้นนี้ใช้ — NextResponse.json กับ req.nextUrl.searchParams */
  writeFileSync(join(out, 'ปลอม-next-server.js'), `
export const NextResponse = {
  json: (ก้อน, init) => ({ status: init?.status ?? 200, async json() { return ก้อน } }),
}
`)
  writeFileSync(join(out, 'ปลอม-vendors.js'), `
export const BILL_VENDORS = [
  { id: 'tiktok', name: 'TikTok', collect: 'g1' },
  { id: 'adobe', name: 'Adobe', collect: null },
]
`)
  writeFileSync(join(out, 'ปลอม-billreport.js'), `
import { readFileSync } from 'node:fs';
export async function สรุปทุกเจ้า(only) {
  const ป้อน = JSON.parse(readFileSync(process.env.ป้อนสรุป, 'utf8'));
  return only ? ป้อน.filter((v) => v.id === only) : ป้อน;
}
`)
  const ไล่ไฟล์ = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ไล่ไฟล์(join(d, e.name)) : (e.name.endsWith('.js') && !e.name.startsWith('ปลอม-') ? [join(d, e.name)] : []))
  for (const ที่ of ไล่ไฟล์(out)) {
    writeFileSync(ที่, readFileSync(ที่, 'utf8')
      .replace(/(from\s+['"]\.\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2')
      .replace(/(['"])next\/server\1/g, JSON.stringify(join(out, 'ปลอม-next-server.js')))
      .replace(/(['"])@\/lib\/vendors\1/g, JSON.stringify(join(out, 'ปลอม-vendors.js')))
      .replace(/(['"])@\/lib\/billreport\1/g, JSON.stringify(join(out, 'ปลอม-billreport.js'))))
  }
  const เส้น = join(out, 'app/api/bills/report/route.js')
  const ซอร์ส = readFileSync(เส้น, 'utf8')
  ok('ต่อ import ไปตัวปลอมครบ (ไม่เหลือ @/lib/ หรือ next/server)',
    !ซอร์ส.includes('@/lib/') && !/from ['"]next\/server['"]/.test(ซอร์ส),
    ซอร์ส.split('\n').filter((l) => l.includes('@/lib/') || l.includes('next/server')).join(' · '))

  const ไฟล์สรุป = join(out, 'สรุป.json')
  process.env['ป้อนสรุป'] = ไฟล์สรุป
  writeFileSync(ไฟล์สรุป, JSON.stringify([
    { id: 'tiktok', ชื่อ: 'TikTok', รวมทุกเดือน: 4,
      เดือน: { '2026-08': { จำนวน: 4, ใบจริงที่อัปไว้: 4, ไฟล์: ['THTT1.pdf'] } },
      สแกนล่าสุด: '2026-09-29', เจอบิลใหม่ล่าสุด: null },
    { id: 'adobe', ชื่อ: 'Adobe', รวมทุกเดือน: 0, เดือน: {}, สแกนล่าสุด: null, เจอบิลใหม่ล่าสุด: null },
  ]), 'utf8')
  const { GET } = await import(เส้น)
  /** คำขอปลอม — เส้นนี้อ่านแค่ req.nextUrl.searchParams */
  const คำขอ = (qs) => ({ nextUrl: new URL(`https://x/api/bills/report${qs}`) })
  const ยิง = async (qs) => { const r = await GET(คำขอ(qs)); return { status: r.status, ก้อน: await r.json() } }

  console.log('① 🔴 รหัส — ไม่มี/ผิด/ไม่ได้ตั้ง env ต้อง 401 ทั้งสามกรณี')
  {
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
    ok('ไม่ส่งรหัส ⇒ 401', (await ยิง('')).status === 401)
    ok('รหัสผิด ⇒ 401', (await ยิง('?secret=มั่ว')).status === 401)
    ok('รหัสว่าง ⇒ 401', (await ยิง('?secret=')).status === 401)
    ok('รหัสถูก ⇒ 200', (await ยิง('?secret=รหัสจริง')).status === 200)
    /* 🔴 ไม่ได้ตั้ง env ⇒ **ปิด** ไม่ใช่เปิด — ถ้าเขียนแค่ secret !== required
       วันที่ env หลุดหาย เส้นนี้จะเปิดให้ทุกคนที่ส่งค่าว่างมา */
    delete process.env.DRIVESYNC_SECRET
    ok('ไม่ได้ตั้ง env + ไม่ส่งรหัส ⇒ 401', (await ยิง('')).status === 401)
    ok('ไม่ได้ตั้ง env + ส่งรหัสอะไรก็ได้ ⇒ 401', (await ยิง('?secret=อะไรก็ได้')).status === 401,
      'ผ่าน ⇒ วันที่ env หลุดหาย เส้นนี้เปิดให้คนนอกอ่านรายชื่อบิลทั้งคลัง')
    process.env.DRIVESYNC_SECRET = 'รหัสจริง'
  }

  console.log('② ผู้ให้บริการที่ไม่รู้จัก ⇒ 400 พร้อมบอกชื่อ (ไม่ใช่เงียบแล้วคืนทุกเจ้า)')
  {
    const r = await ยิง('?secret=รหัสจริง&vendor=ไม่มีเจ้านี้')
    ok('ได้ 400', r.status === 400, String(r.status))
    ok('บอกชื่อที่ส่งมา', String(r.ก้อน.error).includes('ไม่มีเจ้านี้'), JSON.stringify(r.ก้อน))
    ok('ไม่คืนข้อมูลเจ้าอื่นมาด้วย', r.ก้อน.เจ้า === undefined, JSON.stringify(r.ก้อน).slice(0, 120))
    const ตัวควบคุมลบ = await ยิง('?secret=รหัสจริง&vendor=tiktok')
    ok('เจ้าที่รู้จัก ⇒ 200 และได้เจ้าเดียว', ตัวควบคุมลบ.status === 200
      && Object.keys(ตัวควบคุมลบ.ก้อน.เจ้า).join() === 'tiktok', JSON.stringify(Object.keys(ตัวควบคุมลบ.ก้อน.เจ้า ?? {})))
  }

  console.log('③ 🔴 อ่านอย่างเดียว — คำตอบห้ามมีเนื้อไฟล์ (บัญชีขาว ไม่ใช่บัญชีดำของคำ)')
  {
    const { ก้อน } = await ยิง('?secret=รหัสจริง')
    const ช่องบนสุด = Object.keys(ก้อน).sort().join(',')
    ok('ระดับบนสุดมีเฉพาะ หมายเหตุ กับ เจ้า', ช่องบนสุด === 'หมายเหตุ,เจ้า', ช่องบนสุด)
    const ยอมให้มี = ['id', 'ชื่อ', 'ลิงก์ต้นทาง', 'ต้องมีทุกเดือน', 'รวมทุกเดือน', 'เดือน',
      'สแกนล่าสุด', 'เจอบิลใหม่ล่าสุด', 'อ่านไม่ได้', 'เก็บโดย']
    const เกิน = Object.values(ก้อน.เจ้า).flatMap((v) => Object.keys(v)).filter((k) => !ยอมให้มี.includes(k))
    ok('ไม่มีช่องเกินบัญชีขาวในข้อมูลรายเจ้า', เกิน.length === 0,
      `ช่องเกิน: ${[...new Set(เกิน)].join(' · ')} ⇒ บิลมีชื่อ ที่อยู่ เลขภาษีของร้าน`)
    const ก้อนข้อความ = JSON.stringify(ก้อน)
    for (const ห้าม of ['dataUrl', 'base64', 'buf', 'content', '%PDF']) {
      ok(`ไม่มี "${ห้าม}" ในคำตอบ`, !ก้อนข้อความ.includes(ห้าม), ก้อนข้อความ.slice(0, 120))
    }
    ok('ยังคืนชื่อไฟล์/เดือน/จำนวนตามที่ต้องการ',
      ก้อน.เจ้า.tiktok.รวมทุกเดือน === 4 && ก้อน.เจ้า.tiktok.เดือน['2026-08'].ไฟล์[0] === 'THTT1.pdf')
  }

  console.log('④ หมายเหตุต้องบอกว่าตัวเลขตรงกับจอ และไม่ได้ยิง Gmail')
  {
    const { ก้อน } = await ยิง('?secret=รหัสจริง')
    ok('บอกว่าตรงกับที่จอแสดง', /ตรงกับที่จอแสดง/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
    ok('บอกว่าอ่านจากแคช ไม่ได้ยิง Gmail', /ไม่ได้ยิง Gmail/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
    ok('บอกว่าคัดซ้ำด้วยเลขที่ใบแล้ว', /คัดซ้ำ/.test(ก้อน.หมายเหตุ), ก้อน.หมายเหตุ)
  }

  console.log('⑤ ช่อง เก็บโดย ต้องมีทุกเจ้า และ null ต้องคงเป็น null (ไม่รู้ ≠ ไม่มีคนเก็บ)')
  {
    const { ก้อน } = await ยิง('?secret=รหัสจริง')
    ok('tiktok เก็บโดย g1', ก้อน.เจ้า.tiktok.เก็บโดย === 'g1', String(ก้อน.เจ้า.tiktok.เก็บโดย))
    ok('adobe เก็บโดย null (คงค่า ไม่แปลงเป็นสตริงว่าง)', ก้อน.เจ้า.adobe.เก็บโดย === null,
      JSON.stringify(ก้อน.เจ้า.adobe.เก็บโดย))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอม next/server · ทะเบียนเจ้า · ตัวสรุป — ของจริงคือตรรกะของเส้นเอง'
  + ' (ลำดับตรวจรหัส · ตรวจชื่อเจ้า · รูปคำตอบ) · ไม่ได้ทดสอบว่า middleware ปล่อยผ่าน')
process.exit(ตก ? 1 : 0)
