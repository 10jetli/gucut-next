#!/usr/bin/env node
/* เครื่องคิดแผนสั่งซื้อ `lib/reorder.ts` — **ตัวที่ตัดสินว่าจะจ่ายเงินซื้อของเท่าไหร่**
 * (ใบ t_mu8i1pu1 · 28 ก.ย. 2569) วัดแล้วว่าไฟล์นี้ไม่มีเทสและไม่มีด่านเอ่ยถึงเลย
 * ทั้งที่ /core/reorder · /core/leadtime · /api/reorder · /api/import อ่านผลของมัน
 *
 * 🔑 **ท่อปลอมแทนเครือข่าย ตรรกะจริงทั้งหมด**
 *    `zortFetch` ยิง https ตรง ๆ (ไม่ได้ใช้ global fetch) ⇒ สตับ fetch ไม่ได้
 *    ⇒ คอมไพล์ลงที่ชั่วคราว **แล้วเขียนทับเฉพาะไฟล์ zort.js ในที่ชั่วคราวนั้น** ด้วยท่อปลอม
 *      (ไม่แตะรีโป · ตรรกะรวมยอด/หักคืน/จัดระดับความด่วน เป็นของจริงทุกบรรทัด)
 *
 * 🔴 สามข้อที่ทดสอบ เลือกจาก "ถ้าพลาดแล้วเสียเงินเท่าไหร่"
 *    ① ใบยกเลิกต้องไม่นับเป็นยอดขาย — นับด้วย = สั่งของเกินตามใบที่ไม่มีอยู่จริง
 *    ② ของคืนต้องหักออกจากยอดขาย — ไม่หัก = ยอดสูงเกินจริง = สั่งเกิน
 *    ③ ดึงของคืนไม่ได้ ต้องประกาศ `returnsUnavailable` — เงียบ = สั่งเกินโดยไม่มีอะไรฟ้อง
 *      (หัวไฟล์ lib/reorder.ts เตือนข้อนี้ไว้เอง: เดิม `.catch(() => [])` เงียบสนิท)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `reorder-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const วันก่อน = (n) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10)

try {
  execFileSync('npx', ['tsc', 'lib/reorder.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  /* tsc พิมพ์เส้นทางแบบไม่มีนามสกุล ('./format') ซึ่ง node ESM หาไม่เจอ ⇒ เติม .js ให้ก่อน
     (ท่าเดียวกับ order-money.test.mjs — ถ้าลืมข้อนี้จะได้ ERR_MODULE_NOT_FOUND ที่อ่านเหมือนไฟล์หาย) */
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  for (const f of readdirSync(out).filter((x) => x.endsWith('.js'))) {
    const ที่ = join(out, f)
    writeFileSync(ที่, readFileSync(ที่, 'utf8').replace(/(from\s+['"]\.\/[^'"]+)(['"])/g, '$1.js$2'))
  }

  /* ── ท่อปลอม: อ่านคำสั่งจากไฟล์ที่เทสเขียนก่อนเรียกแต่ละรอบ ─────────────
     ⚠️ อ่านไฟล์ทุกครั้งที่ถูกเรียก (ไม่ cache) เพื่อให้แต่ละรอบใช้ข้อมูลของตัวเอง
        — ของค้างจากรอบก่อนให้เลขที่น่าเชื่อแต่ผิด */
  writeFileSync(join(out, 'zort.js'), `
import { readFileSync } from 'node:fs'
export const STORES = {}
export async function zortFetch(endpoint, params = {}) {
  const คำสั่ง = JSON.parse(readFileSync(process.env.ท่อปลอม, 'utf8'))
  if ((คำสั่ง.โยน ?? []).includes(endpoint)) throw new Error('ท่อปลอม: สั่งให้ล้มที่ ' + endpoint)
  return { list: คำสั่ง.แถว?.[endpoint] ?? [], count: (คำสั่ง.แถว?.[endpoint] ?? []).length }
}
`)
  const { computeReorder } = await import(join(out, 'reorder.js'))
  const คำสั่งไฟล์ = join(out, 'คำสั่ง.json')
  process.env['ท่อปลอม'] = คำสั่งไฟล์
  const ตั้ง = (o) => writeFileSync(คำสั่งไฟล์, JSON.stringify(o), 'utf8')

  const สินค้า = [{ sku: 'A1', name: 'สินค้าทดสอบ', sellprice: 100, availablestock: 40 }]
  const ใบขาย = (qty, status = '', วัน = วันก่อน(10)) => ({
    status, orderdateString: วัน, saleschannel: 'หน้าร้าน',
    list: [{ sku: 'A1', number: qty }],
  })

  console.log('① ใบยกเลิกต้องไม่นับเป็นยอดขาย')
  {
    ตั้ง({ แถว: {
      'Order/GetOrders': [ใบขาย(10), ใบขาย(50, 'ยกเลิก'), ใบขาย(70, 'cancelled')],
      'ReturnOrder/GetReturnOrders': [], 'Product/GetProducts': สินค้า } })
    const r = await computeReorder()
    const a = r.skus.find((x) => x.sku === 'A1')
    ok('นับใบที่ใช้ได้ใบเดียว', r.orders === 1, `orders=${r.orders}`)
    ok('ยอดขายเป็น 10 ไม่ใช่ 130', a?.sold === 10, `sold=${a?.sold} ⇒ ใบยกเลิกถูกนับ = สั่งของเกิน`)
  }

  console.log('② ของคืนต้องหักออกจากยอดขาย')
  {
    ตั้ง({ แถว: {
      'Order/GetOrders': [ใบขาย(10)],
      'ReturnOrder/GetReturnOrders': [ใบขาย(3)],
      'Product/GetProducts': สินค้า } })
    const r = await computeReorder()
    const a = r.skus.find((x) => x.sku === 'A1')
    ok('ยอดขายสุทธิ 7', a?.sold === 7, `sold=${a?.sold}`)
    ok('ไม่ประกาศว่าดึงของคืนไม่ได้ (เพราะดึงได้)', r.returnsUnavailable === undefined,
      `returnsUnavailable=${r.returnsUnavailable}`)
  }

  console.log('③ ดึงของคืนไม่ได้ ⇒ ต้องประกาศออกมา ไม่ใช่เงียบแล้วให้ยอดสูงเกินจริง')
  {
    ตั้ง({ โยน: ['ReturnOrder/GetReturnOrders'], แถว: {
      'Order/GetOrders': [ใบขาย(10)], 'Product/GetProducts': สินค้า } })
    const r = await computeReorder()
    const a = r.skus.find((x) => x.sku === 'A1')
    ok('ประกาศ returnsUnavailable = true', r.returnsUnavailable === true, `ได้ ${r.returnsUnavailable}`)
    ok('ยอดขายกลายเป็น 10 (สูงกว่าตอนหักคืนได้)', a?.sold === 10, `sold=${a?.sold}`)
    ok('หมายเหตุหน่วยหน้าต่างยังมาด้วย (ผู้เรียกต้องเขียนบนจอ)',
      typeof r['หน่วยหน้าต่าง'] === 'string' && r['หน่วยหน้าต่าง'].includes('วันปฏิทินไทย'),
      String(r['หน่วยหน้าต่าง']).slice(0, 60))
  }

  console.log('④ ของหมดแต่เคยขาย ⇒ ต้องด่วนสุดและมีจำนวนแนะนำ · ของเหลือเยอะ ⇒ ไม่ต้องสั่ง')
  {
    ตั้ง({ แถว: {
      'Order/GetOrders': [ใบขาย(5, '', วันก่อน(5)), ใบขาย(5, '', วันก่อน(40)), ใบขาย(5, '', วันก่อน(80))],
      'ReturnOrder/GetReturnOrders': [],
      'Product/GetProducts': [
        { sku: 'A1', name: 'ของหมด', sellprice: 100, availablestock: 0 },
        { sku: 'B1', name: 'ของล้น', sellprice: 100, availablestock: 99999 },
      ] } })
    const r = await computeReorder()
    const a = r.skus.find((x) => x.sku === 'A1')
    const b = r.skus.find((x) => x.sku === 'B1')
    ok('ของหมดที่เคยขาย = ระดับ 2', a?.level === 2, `level=${a?.level}`)
    ok('ของหมดต้องมีจำนวนแนะนำ > 0', (a?.suggest ?? 0) > 0, `suggest=${a?.suggest}`)
    ok('ของที่ไม่เคยขายและเหลือเยอะ = ไม่สั่ง (suggest 0)', b?.suggest === 0, `suggest=${b?.suggest}`)
    ok('ความเชื่อมั่นของตัวที่ขายไม่กี่สัปดาห์ต้องเป็น "ต่ำ"', a?.confidence === 'ต่ำ', `ได้ ${a?.confidence}`)
  }

  console.log('⑤ บรรทัดสินค้าที่ไม่มีรหัส ต้องไม่กลายเป็นรหัสว่าง')
  {
    ตั้ง({ แถว: {
      'Order/GetOrders': [{ orderdateString: วันก่อน(3), list: [{ sku: '   ', number: 9 }, { sku: 'A1', number: 1 }] }],
      'ReturnOrder/GetReturnOrders': [], 'Product/GetProducts': สินค้า } })
    const r = await computeReorder()
    ok('ไม่มีรหัสว่างในผล', !r.skus.some((x) => !x.sku.trim()), JSON.stringify(r.skus.map((x) => x.sku)))
    ok('รหัสที่มีจริงยังนับได้', r.skus.find((x) => x.sku === 'A1')?.sold === 1,
      `sold=${r.skus.find((x) => x.sku === 'A1')?.sold}`)
  }
  console.log('⑥ ตรึงความสัมพันธ์ระหว่างเครื่องพยากรณ์กับตัวจัดระดับ — กันกิ่งตายกลายเป็นกิ่งเป็นแบบไม่มีใครรู้')
  {
    /* 🔑 lib/reorder.ts มีกิ่ง `daysLeft === null && stock <= 0 && sold > 0 ⇒ ด่วนสุด`
       วัดแล้วว่า **เดินไม่ถึง** ด้วย forecast รุ่นนี้ (perDay เป็น 0 เฉพาะตอนไม่มียอดขายเลย)
       ⇒ ข้อนี้ไม่ได้ทดสอบกิ่งนั้น (ทดสอบไม่ได้) แต่ตรึง **เงื่อนไขที่ทำให้มันตาย** ไว้
       ⇒ วันไหน forecast คืน daysLeft = null พร้อมมียอดขาย ข้อนี้จะแดง = ต้องกลับมาเขียนเทสให้กิ่งนั้น
       (ตรงกับกฎของเรา: กิ่งที่เดินไม่ถึงคือที่ที่คำกล่าวอ้างเน่า — ต้องมีอะไรคอยฟ้องเมื่อมันมีชีวิต) */
    const แบบ = [
      ['ขายครั้งเดียวนานมาแล้ว', [{ orderdateString: วันก่อน(350), list: [{ sku: 'A1', number: 5 }] }]],
      ['ขายครั้งเดียวเมื่อวาน', [{ orderdateString: วันก่อน(1), list: [{ sku: 'A1', number: 5 }] }]],
      ['ขายกระจายสามครั้ง', [{ orderdateString: วันก่อน(300), list: [{ sku: 'A1', number: 2 }] },
        { orderdateString: วันก่อน(150), list: [{ sku: 'A1', number: 1 }] },
        { orderdateString: วันก่อน(20), list: [{ sku: 'A1', number: 3 }] }]],
    ]
    const ผิด = []
    for (const [ชื่อ, ใบ] of แบบ) {
      ตั้ง({ แถว: { 'Order/GetOrders': ใบ, 'ReturnOrder/GetReturnOrders': [],
        'Product/GetProducts': [{ sku: 'A1', name: 'ของหมด', sellprice: 100, availablestock: 0 }] } })
      const a = (await computeReorder()).skus.find((x) => x.sku === 'A1')
      if (a?.daysLeft === null && (a?.sold ?? 0) > 0) ผิด.push(`${ชื่อ}: daysLeft=null แต่ sold=${a.sold}`)
      if (a?.level !== 2) ผิด.push(`${ชื่อ}: ของหมดแต่ไม่ด่วนสุด (level=${a?.level})`)
    }
    ok('ของหมดที่เคยขาย = ด่วนสุดทุกแบบ · และไม่มีกรณี daysLeft=null พร้อมมียอดขาย',
      ผิด.length === 0, ผิด.join(' · '))
  }

} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
