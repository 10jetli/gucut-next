/* ทดสอบรายงาน "ใบที่ยังไม่ได้ส่ง" — รัน: node scripts/tests/shelf-report.test.mjs
 *
 * 🔴 **ป้อนคำตอบปลอมเข้าเส้นจริง** แทนที่แค่ขอบเครือข่าย (pipe)
 *    ตัวไล่หน้า · ตัวคัดใบ · ตัวจัดกลุ่ม · ตัวประกอบข้อความ เดินของจริงทั้งหมด
 *    (กฎ test-must-hit-the-path — เคยพลาดด้วยการประกอบวัตถุด้วยมือมาแล้ว)
 *
 * เกณฑ์ผ่านที่ CEO ตั้งไว้ 12 ก.ย. 2569 ครบทั้งสาม:
 *   ไม่มีใบค้าง ⇒ ต้องส่งข้อความว่าไม่มี (ไม่ใช่เงียบ) · ดึงล้ม ⇒ ต้องบอกว่าอ่านไม่ครบ
 *   มีใบค้าง ⇒ รหัสเรียงถูก และมีขอบเขตกำกับ
 */
import { runShelfReport } from '../../netlify/functions/shelf-report.mjs'

const TODAY = '2026-09-12'
const day = (back) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - back * 864e5).toISOString().slice(0, 10)

/** ท่อปลอม: rows หนึ่งหน้า + รายการสินค้าต่อใบ */
const fakePipe = ({ rows, items = {}, total = null, failOrders = new Set(), throwOnPage = -1 }) => {
  let page = 0
  return async (qs) => {
    if (qs.startsWith('list=orders')) {
      if (page === throwOnPage) throw new Error('ท่อตอบ 500: จำลองท่อล่มกลางคัน')
      page++
      return { ok: true, rows, total: total ?? rows.length }
    }
    const id = decodeURIComponent(qs.replace('order=', ''))
    if (failOrders.has(id)) throw new Error('อ่านใบนี้ไม่ได้')
    return { ok: true, items: items[id] ?? [] }
  }
}
/* แถวจริงจากท่อมีช่อง `source` (z1/z2) เสมอ — ตัวแยกรายร้านอ่านช่องนี้
   ถ้า fixture ไม่มี จะได้ "(ไม่ระบุ)" ซึ่งเป็นของปลอมที่ไม่เหมือนของจริง */
const order = (id, back, group = 'waiting_ship', source = 'z1') =>
  ({ id, source, number: id.replace('z1/', ''), channel: 'Lazada-gucut', order_date: day(back), shipStatusGroup: group })
const line = (sku, name, qty = 1) => ({ sku, name, qty })

let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

console.log('① มีใบค้าง ⇒ รหัสเรียงถูก + ขอบเขตครบ')
{
  const rows = [
    order('z1/A', 3), order('z1/B', 9), order('z1/C', 20),
    order('z1/D', 1),                        // ใหม่เกินเกณฑ์ 2 วัน
    order('z1/E', 5, 'done'),                // ส่งแล้ว
    order('z1/F', 40),                       // เก่าเกินช่วง
  ]
  const items = {
    'z1/A': [line('00313', 'หัวเทียน NEWWAVE')],
    'z1/B': [line('00313', 'หัวเทียน NEWWAVE'), line('00627', '00627 สปริงเล็ก')],
    'z1/C': [line('02779', 'โครงเครื่อง')],
    // ชื่อจริงในฐานบางตัวขึ้นต้นด้วยรหัสตัวเอง — ต้องถูกตัดตอนแสดง (ข้อ ⑤ ของ CEO)
  }
  const r = await runShelfReport({ pipe: fakePipe({ rows, items }), today: TODAY })
  ok('สถานะเป็น ok', r.state === 'ok', r.state)
  ok('นับใบค้างถูก (3 ใบ)', r.raw.stuckOrders === 3, String(r.raw.stuckOrders))
  ok('นับรหัสถูก (3 รหัส)', r.raw.distinctSkus === 3, String(r.raw.distinctSkus))
  ok('ใบเก่าเกินช่วงถูกนับแยก ไม่หายเงียบ', r.raw.tooOld === 1, String(r.raw.tooOld))
  ok('รหัสที่ค้างหลายใบที่สุดขึ้นก่อน (00313 ค้าง 2 ใบ)',
     r.text.indexOf('00313') < r.text.indexOf('02779'), r.text)
  ok('บอกยอดรวมทั้งหมด (ใบ + รหัส)', /ค้างอยู่ <b>3 ใบ<\/b> · <b>3 รหัสสินค้า<\/b>/.test(r.text), r.text)
  /* 🔴 ป้ายต้องพูดตามที่ยิงจริง — คำขอไม่ได้กรองร้าน ⇒ ห้ามเขียนว่าร้านเดียว
     (ของเดิมเขียน "ร้าน z1" ตายตัวทั้งที่ข้อมูลเป็นทุกร้าน — CEO จับได้ 12 ก.ย. 2569) */
  ok('ขอบเขต: บอกว่าทุกร้าน พร้อมแยกจำนวนรายร้าน', /ทุกร้าน \(z1 3 ใบ\)/.test(r.text), r.text)
  ok('🔴 ห้ามอ้างว่ากรองร้านเดียวโดยที่ไม่ได้กรอง', !/ขอบเขต: ร้าน z1 ·/.test(r.text))
  ok('บอกจำนวนใบที่ถูกตัวกรองอายุกรองออก', /อีก 1 ใบเพิ่งค้างไม่ถึง 2 วัน/.test(r.text), r.text)
  ok('ใบเก่ากว่าช่วงตรวจมีบรรทัดของตัวเอง ไม่ถูกทิ้ง', /ใบเก่ากว่าช่วงตรวจ/.test(r.text), r.text)
  ok('🔴 ห้ามตัดสินแทนคนอ่านว่าใบเก่าไม่เกี่ยว', !/ไม่ใช่งานแพ็กวันนี้/.test(r.text))
  ok('ชื่อสินค้าที่ขึ้นต้นด้วยรหัสตัวเอง ต้องไม่โชว์รหัสซ้ำ', !/00627 00627/.test(r.text), r.text)
  ok('ขอบเขต: ช่วงวันที่เป็นวันไทย', /ใบวันที่ .* – .*2569/.test(r.text), r.text)
  ok('ขอบเขต: เกณฑ์อายุ', /เฉพาะใบที่ค้างเกิน 2 วัน/.test(r.text))
  ok('ขอบเขต: อ่านได้กี่ใบจากกี่ใบ', /อ่านใบในช่วงนี้ 6 จาก 6 ใบ/.test(r.text), r.text)
  ok('เขียนเกณฑ์การเลือกไว้ในข้อความ', /เกณฑ์: ค้างหลายใบที่สุด → ใบเก่าสุด/.test(r.text))
  ok('มีชื่อสินค้า ไม่ใช่รหัสเปล่า', /หัวเทียน NEWWAVE/.test(r.text))
  ok('บอกอายุใบเก่าสุดของรหัสนั้น', /ใบเก่าสุด \d+ วัน/.test(r.text))
  ok('หมายเหตุว่าสถานะยังไม่ได้ยืนยันกับแพลตฟอร์ม', /ยังไม่ได้ยืนยันกับแพลตฟอร์มโดยตรง/.test(r.text))
  ok('🔴 ห้ามสรุปว่าสินค้าหมด', !/สินค้าหมด/.test(r.text), r.text)
  ok('🔴 ต้องมีคำปฏิเสธว่ายังไม่ยืนยันว่าของหมด', /ไม่ใช่การยืนยันว่าของหมด/.test(r.text))
}

console.log('② ไม่มีใบค้าง ⇒ ต้องส่งข้อความว่าไม่มี ห้ามเงียบ')
{
  const rows = [order('z1/X', 5, 'done'), order('z1/Y', 9, 'shipping')]
  const r = await runShelfReport({ pipe: fakePipe({ rows }), today: TODAY })
  ok('สถานะเป็น empty', r.state === 'empty', r.state)
  ok('มีข้อความจริง ไม่ใช่ค่าว่าง', typeof r.text === 'string' && r.text.length > 40)
  ok('บอกว่าไม่มีใบค้างส่ง', /ไม่มีใบค้างส่ง/.test(r.text), r.text)
  ok('ยังมีขอบเขตกำกับ', /ทุกร้าน/.test(r.text) && /ใบวันที่/.test(r.text), r.text)
}

console.log('③ ดึงข้อมูลล้ม ⇒ บอกว่าอ่านไม่ได้ ห้ามสรุปจากที่ได้มา')
{
  const rows = Array.from({ length: 200 }, (_, i) => order(`z1/P${i}`, 5))
  // หน้าแรกผ่าน หน้าที่สองล้ม (total บอกว่ามี 400) — เคสที่อันตรายที่สุด เพราะได้ของมาครึ่งเดียว
  const r = await runShelfReport({ pipe: fakePipe({ rows, total: 400, throwOnPage: 1 }), today: TODAY })
  ok('สถานะเป็น error', r.state === 'error', r.state)
  ok('บอกว่าดึงไม่สำเร็จ', /ดึงข้อมูลไม่สำเร็จ/.test(r.text))
  ok('บอกเหตุผลจริงที่ท่อตอบ', /500/.test(r.text), r.text)
  ok('🔴 ห้ามมีตัวเลขสรุปใด ๆ ในข้อความ', !/ค้างอยู่/.test(r.text), r.text)
  ok('บอกว่าไม่ได้แปลว่าไม่มีใบค้าง', /ไม่ได้แปลว่าไม่มีใบค้างส่ง/.test(r.text))
  ok('ห้ามสั่งนับของจากใบนี้', /อย่าสั่งนับของ/.test(r.text))
}

console.log('④ อ่านได้บางส่วน ⇒ ต้องประกาศว่าไม่ครบ (สามแบบ)')
{
  const rows = [order('z1/A', 3), order('z1/B', 9)]
  const items = { 'z1/A': [line('00313', 'หัวเทียน')], 'z1/B': [line('00627', 'สปริง')] }
  const r1 = await runShelfReport({ pipe: fakePipe({ rows, items, failOrders: new Set(['z1/B']) }), today: TODAY })
  ok('อ่านรายการสินค้าไม่ได้บางใบ ⇒ ประกาศ', /อ่านรายการสินค้าไม่ได้ 1 ใบ/.test(r1.text), r1.text)
  ok('ประกาศว่าของจริงอาจมากกว่านี้', /ของจริงอาจมากกว่านี้/.test(r1.text))

  const many = Array.from({ length: 30 }, (_, i) => order(`z1/Q${i}`, 3 + i % 20))
  const itemsMany = Object.fromEntries(many.map((o, i) => [o.id, [line(`S${i}`, `ของ ${i}`)]]))
  const r2 = await runShelfReport({ pipe: fakePipe({ rows: many, items: itemsMany }), today: TODAY, itemsCap: 10 })
  ok('ใบที่เกินโควตาเวลา ⇒ ประกาศจำนวนที่ยังไม่ได้เปิดดู', /ยังไม่ได้เปิดดูรายการสินค้าอีก 20 ใบ/.test(r2.text), r2.text)

  const r3 = await runShelfReport({ pipe: fakePipe({ rows, items, total: 99 }), today: TODAY })
  ok('ท่อบอกว่ามีมากกว่าที่อ่านได้ ⇒ ประกาศว่าอ่านใบไม่ครบ', /อ่านใบไม่ครบ \(ขาด 97 ใบ\)/.test(r3.text), r3.text)
}

console.log('⑤ เพดานวันละ 3 รหัส — แต่ยอดรวมต้องบอกครบ')
{
  const rows = Array.from({ length: 5 }, (_, i) => order(`z1/R${i}`, 3 + i))
  const items = Object.fromEntries(rows.map((o, i) => [o.id, [line(`SK${i}`, `ของ ${i}`)]]))
  const r = await runShelfReport({ pipe: fakePipe({ rows, items }), today: TODAY })
  const listed = (r.text.match(/^\d+\. <b>SK/gm) || []).length
  ok('ลงรายการไม่เกิน 3 รหัส', listed === 3, `ลง ${listed} รหัส`)
  ok('บอกว่ายังมีอีกกี่รหัส', /อีก 2 รหัสก็ค้างอยู่เหมือนกัน/.test(r.text), r.text)
  ok('ยอดรวมยังบอกครบ 5 รหัส', /<b>5 รหัสสินค้า<\/b>/.test(r.text), r.text)
}

console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ตก ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
