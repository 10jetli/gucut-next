#!/usr/bin/env node
/* พฤติกรรมของป้าย "ใช้แทน ZORT ได้หรือยัง" (`lib/zort-ready.ts`)
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569)
 *
 * 🔴 **ทำไมต้องมีเทสนี้ ทั้งที่มี `check-ready-badge.mjs` อยู่แล้ว**
 *    ด่านนั้นอ่าน `lib/zort-ready.ts` เป็น **ข้อความ** (ตัดคอมเมนต์แล้ว regex)
 *    ⇒ มัน **ไม่เคยรัน** `zortReadyOf` · `ส่งจริงได้` · `ป้ายของเส้นทาง` เลยแม้ครั้งเดียว
 *    ⇒ และวันนี้ (29 ก.ย. 2569) นั่นคือเหตุที่บั๊กรอด: กิ่งคำเตือนที่ CEO สั่งใส่เมื่อ 18 ก.ย.
 *       **ไม่มีวันถูกเดิน** เพราะ `ARCH_ADMIN.realSend.screens` เป็นอาร์เรย์ว่าง
 *       (ตัวสแกนใน gen-arch จับแต่รูป `= true` ค่าคงที่ ส่วนจอย้ายไปเรียก `ส่งจริงได้('คีย์')` ตั้งแต่ 19 ก.ย.)
 *    ⇒ จอที่ท่านประธานเปิดปุ่มแล้ว 4 จอ ติดป้าย "งานเขียนยังทำที่ ZORT" อยู่ 10 วัน
 *       ซึ่งอ่านได้ว่า **ให้ไปทำซ้ำที่ ZORT** ⇒ เสี่ยงได้เอกสารสองใบต่อการขายครั้งเดียว
 *    🔑 บทเรียน: ด่านที่ตรึง **รูปร่างโค้ด** เขียวได้ตลอด ขณะที่ **พฤติกรรม** ตายอยู่
 *
 * 🔑 กฎที่ตรึงไว้:
 *    ① `zortReadyOf` เทียบตรงตัวก่อน แล้วตัดท้ายทีละชั้น — **แต่ `'/'` ต้องไม่ถูกตัดไปถึง**
 *       🔴 ถ้าถึง เส้นทางที่ไม่รู้จักทุกเส้นจะได้ป้ายของหน้าแรก = 🟢 "ใช้แทน ZORT ได้เลย"
 *          ซึ่งเป็นทิศที่แพงที่สุด (ดูข้อ ③)
 *    ② จอที่ไม่อยู่ในทะเบียน ⇒ **ไม่มีป้าย** โดยตั้งใจ (ป้าย ZORT บนจอที่ ZORT ไม่มี = เสียงรบกวน)
 *    ③ **ทิศความผิดไม่เท่ากัน** (CEO ตัดสิน 18 ก.ย. 2569): 🟡 ผิด = ทำงานซ้ำ · 🟢 ผิด = **งานหาย**
 *       ⇒ จอที่เปิดปุ่มส่งจริงแล้ว **ห้ามถูกเลื่อนเป็นเขียวเอง** — ต้องยังเหลือง แต่เปลี่ยนถ้อยคำ
 *    ④ ถ้อยคำของกิ่งนั้นต้องมีสามส่วนครบ: เปิดได้จริง · ห้ามเปิดซ้ำ **พร้อมบอกผลถ้าทำ** · ยังขาดอะไร
 *    ⑤ `ส่งจริงได้` ไม่รู้ ⇒ false (ไม่ไปสัญญาแทน) และต้องเทียบเส้นทางพลวัตเป็นแบบแผน ไม่ใช่สตริงตรง ๆ
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `zort-ready-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/zort-ready.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  /* ปลอมผังเท่านั้น — เพราะข้อ ⑤ ต้องคุมได้ว่า "จอไหนเปิดปุ่ม" เพื่อเดินกิ่งที่ของจริงเคยเดินไม่ถึง
     ⚠️ ทะเบียน ZORT_READY เป็นของจริงทุกบรรทัด ไม่ปลอม */
  /* 🔴 **ต้องอ่านสดทุกครั้งที่ถูกแตะ ห้ามอ่านครั้งเดียวตอน import**
     รุ่นแรกผมเขียน `export const ARCH_ADMIN = JSON.parse(readFileSync(...))` ⇒ ค่าถูกตรึง
     ตอนโมดูลถูกโหลดครั้งแรก (ซึ่งตอนนั้นผังยังว่าง) ⇒ `ตั้งผัง()` ที่เรียกทีหลังไม่มีผลเลย
     ⇒ เทสล้ม 8 ข้อ **ด้วยเหตุที่ไม่เกี่ยวกับโค้ดที่ทดสอบ** และอ่านผลผิดได้ง่ายมากว่าโค้ดพัง
     🔑 ตัวชี้ว่าเป็นบั๊กของเทส: ข้อที่คาดพฤติกรรม "ผังว่าง" กลับผ่านหมด */
  writeFileSync(join(out, 'ปลอม-arch.js'), `
import { readFileSync } from 'node:fs';
export const ARCH_ADMIN = new Proxy({}, {
  get: (_t, k) => JSON.parse(readFileSync(process.env.ป้อนผัง, 'utf8'))[k],
});
`)
  for (const f of readdirSync(out).filter((x) => x.endsWith('.js') && !x.startsWith('ปลอม-'))) {
    const ที่ = join(out, f)
    writeFileSync(ที่, readFileSync(ที่, 'utf8')
      .replace(/(from\s+['"]\.\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2')
      .replace(/(['"])\.\/arch-admin\.js\1/g, "'./ปลอม-arch.js'"))
  }
  const ไฟล์ผัง = join(out, 'ผัง.json')
  process.env['ป้อนผัง'] = ไฟล์ผัง
  const ตั้งผัง = (screens) => writeFileSync(ไฟล์ผัง, JSON.stringify({ realSend: { screens } }), 'utf8')
  ตั้งผัง([])
  const m = await import(join(out, 'zort-ready.js'))
  const { zortReadyOf, ป้ายของเส้นทาง, ส่งจริงได้, READY_BADGE, ZORT_READY, กระทบสต็อก } = m

  console.log('① เทียบตรงตัวก่อน แล้วตัดท้ายทีละชั้น')
  {
    ok('เส้นทางที่อยู่ในทะเบียนตรงตัว', zortReadyOf('/core/sales') === ZORT_READY['/core/sales'])
    ok('เส้นทางลูกที่ไม่มีในทะเบียน ⇒ ตัดท้ายไปเจอแม่',
      zortReadyOf('/core/sales/detail/SO-123') === ZORT_READY['/core/sales/detail'],
      String(zortReadyOf('/core/sales/detail/SO-123')))
    ok('ตัดท้ายหลายชั้นได้', zortReadyOf('/core/sales/detail/a/b/c') === ZORT_READY['/core/sales/detail'])
  }

  console.log('② 🔴 ห้ามตัดท้ายไปถึง "/" — ไม่งั้นทุกเส้นทางที่ไม่รู้จักได้ป้ายหน้าแรก (🟢)')
  {
    ok('เส้นทางชั้นเดียวที่ไม่รู้จัก ⇒ null', zortReadyOf('/ไม่มีจอนี้จริง') === null,
      `${zortReadyOf('/ไม่มีจอนี้จริง')} ⇒ ได้ป้ายของหน้าแรก = สัญญาแทนจอที่ไม่มีอยู่`)
    ok('เส้นทางลึกที่ไม่รู้จักเลยทั้งสาย ⇒ null', zortReadyOf('/ไม่มี/จอ/นี้') === null,
      String(zortReadyOf('/ไม่มี/จอ/นี้')))
    ok('"/" เองยังได้ป้ายตามทะเบียน (เทียบตรงตัว)', zortReadyOf('/') === ZORT_READY['/'])
    ok('จอที่ไม่อยู่ในทะเบียน ⇒ ไม่มีป้าย (โดยตั้งใจ)', ป้ายของเส้นทาง('/bills') === null,
      JSON.stringify(ป้ายของเส้นทาง('/bills')))
  }

  console.log('③ ส่งจริงได้ — ไม่รู้ ⇒ false · เส้นทางพลวัตเทียบเป็นแบบแผน')
  {
    ตั้งผัง([])
    ok('ผังว่าง ⇒ false ทุกเส้นทาง (ไม่ไปสัญญาแทน)', ส่งจริงได้('/core/sales/new') === false)
    writeFileSync(ไฟล์ผัง, JSON.stringify({ realSend: {} }), 'utf8')
    ok('ผังไม่มีช่อง screens ⇒ false ไม่ใช่พัง', ส่งจริงได้('/core/sales/new') === false)
    ตั้งผัง([{ path: '/core/sales/new', open: true }, { path: '/core/import', open: false }])
    ok('จอที่ open:true ⇒ true', ส่งจริงได้('/core/sales/new') === true)
    ok('จอที่ open:false ⇒ false', ส่งจริงได้('/core/import') === false)
    ok('ทนเครื่องหมาย / ท้ายเส้นทาง', ส่งจริงได้('/core/sales/new/') === true)
    ตั้งผัง([{ path: '/core/stock/[sku]/edit', open: true }])
    ok('เส้นทางพลวัตเทียบเป็นแบบแผน', ส่งจริงได้('/core/stock/ABC-123/edit') === true,
      'เทียบสตริงตรง ๆ ⇒ จอที่เปิดแล้วถูกอ่านว่าปิด')
    ok('แบบแผนไม่กินเส้นทางที่ลึกกว่า', ส่งจริงได้('/core/stock/ABC/123/edit') === false)
  }

  console.log('④ 🔴 ป้ายต้องขึ้นต้นด้วย "ความสามารถ:" (CEO ตัดสิน 19 ก.ย. 2569)')
  {
    /* เดิมไม่มีคำกำกับ ⇒ ตอนท่อพัง จอขึ้น 🟢 "ใช้แทน ZORT ได้เลย" คู่กับ "ดึงข้อมูลไม่สำเร็จ"
       แล้วอ่านขัดกัน — ป้ายพูดถึงความสามารถของจอ ไม่ใช่ข้อมูลรอบนี้ */
    for (const k of ['replace', 'readonly']) {
      ok(`${k} ขึ้นต้นด้วย "ความสามารถ:"`, READY_BADGE[k].text.startsWith('ความสามารถ:'),
        READY_BADGE[k].text)
    }
    ok('replace เขียว · readonly เหลือง',
      READY_BADGE.replace.tone === 'green' && READY_BADGE.readonly.tone === 'amber')
  }

  console.log('⑤ 🔴 กิ่งที่เคยตายอยู่ — จอ readonly ที่เปิดปุ่มส่งจริงแล้ว ต้องได้ถ้อยคำสามส่วนครบ')
  {
    /* 🔴 นี่คือกิ่งที่ 10 วันที่ผ่านมา **ไม่มีวันถูกเดิน** เพราะผังส่ง screens ว่าง
       เทสนี้บังคับให้มันถูกเดิน โดยป้อนผังที่บอกว่าจอนี้เปิดปุ่มแล้ว */
    const จอ = Object.keys(ZORT_READY).find((p) => ZORT_READY[p] === 'readonly')
    ok('มีจอ readonly ในทะเบียนให้ทดสอบ', typeof จอ === 'string', String(จอ))
    ตั้งผัง([{ path: จอ, open: true }])
    const ป้าย = ป้ายของเส้นทาง(จอ)
    ok('ยัง **เหลือง** ไม่ถูกเลื่อนเป็นเขียวเอง', ป้าย.tone === 'amber',
      `${ป้าย.tone} ⇒ 🟢 ผิด = งานหาย (คนเลิกเปิด ZORT ทั้งที่ยังต้องเปิด) แพงกว่า 🟡 ผิด = ทำงานซ้ำ`)
    ok('ส่วน ① บอกว่าเปิดได้จริง', /ได้จริง/.test(ป้าย.หัว), ป้าย.หัว)
    ok('ส่วน ② ห้ามเปิดซ้ำ', /ห้ามเปิดใบเดิมซ้ำ/.test(ป้าย.หัว), ป้าย.หัว)
    ok('ส่วน ② บอก **ผลถ้าทำ** ไม่ใช่แค่ห้าม', /สองใบ/.test(ป้าย.หัว),
      `${ป้าย.หัว} ⇒ ห้ามเฉย ๆ คนที่ไม่แน่ใจจะเลือกทางที่รู้สึกปลอดภัยกว่า = ไปเปิดที่ ZORT ด้วย`)
    ok('ส่วน ③ บอกว่ายังขาดอะไร', /ยังไม่ครบกระบวนการ/.test(ป้าย.ท้าย) && /PEAK/.test(ป้าย.ท้าย), ป้าย.ท้าย)
    ok('ไม่ใช้ข้อความ readonly เดิมที่ชวนให้ไปทำซ้ำ', !/งานเขียนยังทำที่ ZORT/.test(ป้าย.หัว),
      `${ป้าย.หัว} ⇒ นี่คือข้อความที่ CEO วินิจฉัยว่าอ่านได้ว่าให้ไปทำซ้ำที่ ZORT`)
  }

  console.log('⑥ จอ readonly ที่ยังไม่เปิดปุ่ม ⇒ ได้ข้อความเดิม (ตัวควบคุมลบของข้อ ⑤)')
  {
    const จอ = Object.keys(ZORT_READY).find((p) => ZORT_READY[p] === 'readonly')
    ตั้งผัง([])
    const ป้าย = ป้ายของเส้นทาง(จอ)
    ok('ได้ข้อความ readonly มาตรฐาน', ป้าย.หัว === READY_BADGE.readonly.text, ป้าย.หัว)
    ok('ท้ายบอกเงื่อนไขที่ต้องผ่าน', /PEAK/.test(ป้าย.ท้าย), ป้าย.ท้าย)
  }

  console.log('⑦ จอ replace ⇒ เขียว และท้ายว่าง (ไม่มีเงื่อนไขค้าง)')
  {
    ตั้งผัง([])
    const ป้าย = ป้ายของเส้นทาง('/core/sales')
    ok('เขียว', ป้าย.tone === 'green' && ป้าย.dot === '🟢', JSON.stringify(ป้าย))
    ok('ท้ายว่าง', ป้าย.ท้าย === '', JSON.stringify(ป้าย.ท้าย))
  }

  console.log('⑧ กระทบสต็อก — เตือนเฉพาะจอที่เอกสารทำให้สต็อกขยับ')
  {
    ok('/core/sales/new อยู่ในชุด', กระทบสต็อก.has('/core/sales/new'))
    ok('ใบเสนอราคาไม่อยู่ในชุด (เตือนไปก็เป็นเสียงรบกวน)', !กระทบสต็อก.has('/core/quotations/new'))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมเฉพาะผัง (ARCH_ADMIN) — ทะเบียน ZORT_READY · ลูปตัดท้าย · แบบแผนเส้นทางพลวัต'
  + ' · การประกอบถ้อยคำ เป็นของจริงทั้งหมด')
process.exit(ตก ? 1 : 0)
