#!/usr/bin/env node
/* ที่เก็บบิล + ทะเบียนตัวตนของใบ (`lib/billblobs.ts`) — 225 บรรทัด ไม่มีเทสแตะเลย
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) ผู้ใช้จริงคือเส้นบิล 6 เส้น (drivesync · vendor · dupcheck · file · watch · fixmonth)
 *
 * 🔴 ของจริงที่ทำให้ไฟล์นี้มีทะเบียนตัวตน: **ท่านประธานจับได้เองว่าบิล Adobe ซ้ำ**
 *    ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน
 *    ต้นเหตุ: กันซ้ำด้วย **ชื่อไฟล์** ⇒ ใบเดิมที่มาในชื่อใหม่ผ่านด่านทุกครั้ง
 *
 * 🔑 สี่กฎที่ไฟล์ประกาศเอง และเทสนี้ตรึงไว้:
 *    ① กันซ้ำด้วย **ตัวตนของใบ** ก่อนชื่อไฟล์
 *    ② `identity = null` **ห้ามแปลว่า "ไม่ซ้ำ"** ⇒ ยังเก็บไฟล์ แต่ต้องบอกว่า "ยังตัดสินไม่ได้"
 *       (ทิ้งบิลจริงเสียหายกว่าเก็บซ้ำ)
 *    ③ เลขที่เอกสารที่มี `/` (เช่น INV/2026/08) ต้องถูก encode ⇒ ไม่ไปตัดคีย์เป็นชั้น ๆ
 *    ④ ลบไฟล์ต้องคืน false เมื่อไม่มีไฟล์นั้น — แยก "ลบแล้ว" ออกจาก "ไม่เคยมี"
 *       (บิลคือเอกสารบัญชี ลบแล้วไม่มีถังขยะให้กู้)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `billblobs-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/billblobs.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')

  /* ที่เก็บปลอม — และ **เปิดให้ดูคีย์ที่ถูกเขียนจริง** เพราะกฎข้อ ③ พูดถึงรูปของคีย์ */
  const bl = join(out, 'node_modules', '@netlify', 'blobs')
  mkdirSync(bl, { recursive: true })
  writeFileSync(join(bl, 'package.json'), '{"name":"@netlify/blobs","type":"module","main":"index.js"}')
  writeFileSync(join(bl, 'index.js'), `
export const ถัง = new Map();
export function getStore() {
  return {
    /* 🔑 ของจริงเช็คว่ามีไฟล์ไหมด้วย getMetadata ไม่ใช่ get ⇒ ตัวปลอมต้องมีด้วย
       (เจอตอนรันครั้งแรก: store.getMetadata is not a function ⇒ ตัวปลอมแคบกว่าของจริง
        ⚠️ ตัวปลอมที่ขาดเมธอด ทำให้เทสล้มด้วยเหตุที่ไม่เกี่ยวกับสิ่งที่ทดสอบ) */
    async getMetadata(key) { return ถัง.has(key) ? { size: 1 } : null; },
    async get(key, opt) {
      if (!ถัง.has(key)) return null;
      const v = ถัง.get(key);
      return opt?.type === 'json' ? (typeof v === 'string' ? JSON.parse(v) : v) : v;
    },
    async set(key, v) { ถัง.set(key, v); },
    async setJSON(key, v) { ถัง.set(key, v); },
    async delete(key) { ถัง.delete(key); },
    async list({ prefix } = {}) {
      const keys = [...ถัง.keys()].filter((k) => !prefix || k.startsWith(prefix));
      return { blobs: keys.map((key) => ({ key, size: 1 })) };
    },
  };
}
`)
  const { ถัง } = await import(join(out, 'node_modules/@netlify/blobs/index.js'))
  const m = await import(join(out, 'billblobs.js'))
  const { syncBillByIdentity, findBillByIdentity, rememberBillIdentity, blobFileExists,
    deleteBillBlob, listVendorBlobNames } = m
  const ไบต์ = Buffer.from('%PDF-1.4 ของปลอมสำหรับเทส')

  console.log('① เขียนใบใหม่ ⇒ เก็บจริง และขึ้นทะเบียนตัวตน')
  {
    ถัง.clear()
    const r = await syncBillByIdentity('adobe', 'บิล-ส.ค.pdf', 'application/pdf', ไบต์, 'INV-1001')
    ok('เขียนใหม่', r.written === true && r.reason === 'เขียนใหม่', JSON.stringify(r))
    ok('ไฟล์อยู่ในที่เก็บจริง', await blobFileExists('adobe', 'บิล-ส.ค.pdf'))
    ok('ทะเบียนตัวตนชี้ไปไฟล์นั้น', (await findBillByIdentity('adobe', 'INV-1001')) === 'บิล-ส.ค.pdf')
  }

  console.log('② 🔴 ใบเดิมที่มาในชื่อไฟล์ใหม่ ⇒ ต้องไม่เขียนซ้ำ (เคสบิล Adobe ของท่านประธาน)')
  {
    const r = await syncBillByIdentity('adobe', 'ชื่อใหม่คนละแบบ.pdf', 'application/pdf', ไบต์, 'INV-1001')
    ok('ไม่เขียน', r.written === false, JSON.stringify(r))
    ok('บอกเหตุว่าเป็นใบเดิมคนละชื่อ', r.reason === 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น', r.reason)
    ok('บอกด้วยว่าไปซ้ำกับไฟล์ไหน', r.sameAs === 'บิล-ส.ค.pdf', String(r.sameAs))
    ok('ไฟล์ชื่อใหม่ต้องไม่ถูกสร้าง', !(await blobFileExists('adobe', 'ชื่อใหม่คนละแบบ.pdf')))
  }

  console.log('③ 🔴 อ่านตัวตนไม่ได้ (null) — ห้ามแปลว่า "ไม่ซ้ำ" และห้ามทิ้งบิล')
  {
    const r = await syncBillByIdentity('adobe', 'อ่านเลขที่ไม่ออก.pdf', 'application/pdf', ไบต์, null)
    ok('ยังเก็บไฟล์ (ทิ้งบิลจริงเสียหายกว่า)', r.written === true && await blobFileExists('adobe', 'อ่านเลขที่ไม่ออก.pdf'))
    ok('แต่ต้องบอกว่า **ยังตัดสินไม่ได้** ไม่ใช่ "เขียนใหม่" เฉย ๆ',
      r.reason === 'เขียนใหม่ (ยังตัดสินไม่ได้ว่าซ้ำ)', r.reason)
  }

  console.log('④ ชื่อไฟล์ซ้ำแต่ยังไม่มีทะเบียน ⇒ ลงทะเบียนย้อนหลังให้ (ไฟล์เก่าก่อนมีทะเบียน)')
  {
    ถัง.clear()
    await syncBillByIdentity('line', 'ใบเก่า.pdf', 'application/pdf', ไบต์, null)   // ไม่มีทะเบียน
    ok('ยังไม่มีทะเบียนของ INV-77', (await findBillByIdentity('line', 'INV-77')) === null)
    const r = await syncBillByIdentity('line', 'ใบเก่า.pdf', 'application/pdf', ไบต์, 'INV-77')
    ok('ไม่เขียนทับ', r.written === false && r.reason === 'มีไฟล์ชื่อนี้อยู่แล้ว', JSON.stringify(r))
    ok('แต่ลงทะเบียนตัวตนย้อนหลังให้แล้ว', (await findBillByIdentity('line', 'INV-77')) === 'ใบเก่า.pdf',
      'ไม่ลงทะเบียน ⇒ ครั้งหน้าใบเดิมมาในชื่ออื่นจะถูกเก็บซ้ำ')
  }

  console.log('⑤ 🔴 เลขที่เอกสารที่มี "/" ต้องไม่ตัดคีย์เป็นชั้น ๆ')
  {
    ถัง.clear()
    await rememberBillIdentity('meta', 'INV/2026/08', 'บิลเมต้า.pdf')
    const คีย์ = [...ถัง.keys()].find((k) => k.startsWith('i/meta/'))
    ok('คีย์ทะเบียนมีชั้นเดียว (encode แล้ว)', (คีย์.match(/\//g) || []).length === 2, คีย์)
    ok('ยังอ่านกลับได้ด้วยเลขที่เดิม', (await findBillByIdentity('meta', 'INV/2026/08')) === 'บิลเมต้า.pdf')
    /* ถ้าไม่ encode: INV/2026/08 จะทำให้คีย์กลายเป็น i/meta/INV/2026/08 ⇒ ชนกับคีย์ของใบอื่น
       ที่ขึ้นต้นเหมือนกัน และ list ด้วย prefix จะได้ของผิดกอง */
    await rememberBillIdentity('meta', 'INV/2026/09', 'บิลเมต้าอีกใบ.pdf')
    ok('สองเลขที่คนละใบ อยู่คนละคีย์', (await findBillByIdentity('meta', 'INV/2026/08')) === 'บิลเมต้า.pdf'
      && (await findBillByIdentity('meta', 'INV/2026/09')) === 'บิลเมต้าอีกใบ.pdf')
  }

  console.log('⑥ ลบไฟล์ — ต้องแยก "ลบแล้ว" ออกจาก "ไม่เคยมี" (บิลลบแล้วไม่มีถังขยะให้กู้)')
  {
    ถัง.clear()
    await syncBillByIdentity('tiktok', 'ลบได้.pdf', 'application/pdf', ไบต์, 'X-1')
    ok('ลบไฟล์ที่มีจริง ⇒ true', (await deleteBillBlob('tiktok', 'ลบได้.pdf')) === true)
    ok('ลบไฟล์ที่ไม่เคยมี ⇒ false (ไม่ใช่ true ลอย ๆ)',
      (await deleteBillBlob('tiktok', 'ไม่เคยมีไฟล์นี้.pdf')) === false)
    ok('หายไปจากรายชื่อจริง', !(await listVendorBlobNames('tiktok')).includes('ลบได้.pdf'))
  }

  console.log('⑦ แยกเจ้าของบิลออกจากกัน — ตัวตนซ้ำข้ามเจ้าต้องไม่ชนกัน')
  {
    ถัง.clear()
    await rememberBillIdentity('adobe', 'INV-9', 'ของ adobe.pdf')
    await rememberBillIdentity('line', 'INV-9', 'ของ line.pdf')
    ok('เลขเดียวกันคนละเจ้า ไม่ทับกัน',
      (await findBillByIdentity('adobe', 'INV-9')) === 'ของ adobe.pdf'
      && (await findBillByIdentity('line', 'INV-9')) === 'ของ line.pdf')
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมเฉพาะที่เก็บ (Netlify Blobs) — กติกากันซ้ำและรูปคีย์เป็นของจริง')
process.exit(ตก ? 1 : 0)
