/* เทียบยอดใบขาย: ผลรวมบรรทัด − ส่วนลดท้ายบิล + ค่าส่ง = ยอดหัวใบ
 *
 * 🔴 **ทำไมต้องแยกออกมาเป็นไฟล์ของตัวเอง** (14 ก.ย. 2569)
 *    สูตรนี้เคยอยู่ในจอ (.tsx) แล้ว **ผมเขียนผิด — ลบส่วนลดรายบรรทัดซ้ำสองรอบ**
 *    จอจะฟ้องว่า "ยังเหลือที่อธิบายไม่ได้ 10.80" ทั้งที่ใบถูกต้องทุกบาท
 *    ⇒ บั๊กอยู่บน production จนกว่าจะมีคนบังเอิญเปิดใบที่ส่วนลดไม่เป็นศูนย์
 *    ⇒ ตรรกะเรื่องเงินต้องอยู่ที่เดียวและ **มีเทสเรียกตัวจริง** (ไฟล์ .tsx เรียกจากเทสไม่ได้)
 *       บทเรียนเดียวกับ lib/category-net.ts และ lib/format.ts — เทสที่เลียนแบบตรรกะเขียวทั้งที่ของพัง
 *
 * 🔴 **สัญญาที่ฝั่งท่อยืนยันจากโค้ด core-sync.mjs (44fbecc · 14 ก.ย. 2569)**
 *    `items[].amount` = **ยอดสุทธิของบรรทัด หักส่วนลดมาแล้วทั้งสองทาง**
 *      · ปกติ = totalprice ที่ ZORT ส่งมา
 *      · ทางถอยตอน totalprice หาย = (ราคาต่อชิ้น − ส่วนลดต่อชิ้น) × จำนวน
 *    ⇒ `items[].discount` (บาท **ต่อชิ้น**) มีไว้ **แสดงผลเท่านั้น ห้ามเอาไปหักซ้ำ**
 *    ⇒ ใบที่ discount เป็น null จึงยัง **เทียบยอดได้ตามปกติ** — ไม่ต้องรอกวาดย้อนหลัง
 *
 * 📏 ใบทวนสูตรที่ดีที่สุด (ฝั่งท่อจดไว้ใน handoff): **1118734271446942**
 *    qty 3 · discount 3.6 ต่อชิ้น · amount 169.2 | หัวใบ 169.2 · bill_discount 12 · ship_amount 12
 *    ⇒ เป็นใบเดียวที่เจอว่า **ทุกตัวแปรไม่เป็นศูนย์** ⇒ ใบที่ตัวแปรเป็น 0 พิสูจน์ได้แค่ว่า "ไม่พัง"
 */

export interface OrderMoneyLine {
  /** ยอดสุทธิของบรรทัด (หักส่วนลดแล้ว) */
  amount?: number | null
  qty?: number | null
  /** ส่วนลด **ต่อชิ้น** · null = แถวนี้ซิงก์ก่อนมีคอลัมน์ (ไม่รู้) · ไม่มีช่อง = ท่อรุ่นก่อน */
  discount?: number | null
}

export interface OrderMoneyInput {
  lines: OrderMoneyLine[]
  /** ยอดหัวใบตามที่ท่อส่งมา */
  amount: number
  /** ไม่มีช่อง (undefined) = ท่อรุ่นก่อน · null = ใบนี้ซิงก์ก่อนมีคอลัมน์ · เลข = ใช้ได้ */
  billDiscount?: number | null
  shipAmount?: number | null
}

/** สถานะการเทียบยอด — **สี่อย่าง ห้ามยุบ** เพราะพาไปคนละการกระทำ */
export type OrderMoneyState =
  /** เทียบแล้วลงตัว ⇒ จอเงียบได้ */
  | 'ok'
  /** รู้ครบแต่ไม่ลงตัว ⇒ มีช่องที่เรายังไม่รู้จัก ต้องแจ้งฝั่งท่อ */
  | 'mismatch'
  /** ท่อไม่ได้ส่งช่องส่วนลด/ค่าส่งมาเลย ⇒ อธิบายส่วนต่างไม่ได้ */
  | 'no-fields'
  /** ท่อส่งช่องมาแต่ใบนี้เป็น null ⇒ อธิบายส่วนต่างไม่ได้ (คนละสาเหตุกับ no-fields) */
  | 'unknown'

export interface OrderMoney {
  linesTotal: number
  /** ส่วนต่างดิบระหว่างยอดหัวใบกับผลรวมบรรทัด (ไว้แสดงตอนอธิบายไม่ได้) */
  gap: number
  /** ส่วนลดรายบรรทัดรวม (คูณ qty แล้ว) · null = ไม่รู้ หรือท่อไม่ส่งช่องมา
   *  ⚠️ **ข้อมูลประกอบเท่านั้น ไม่เข้าสมการ** */
  lineDiscount: number | null
  hasDiscountField: boolean
  lineDiscountUnknown: boolean
  /** ยอดที่ควรเป็นตามสูตร · null = เทียบไม่ได้ */
  expected: number | null
  /** ยอดหัวใบ − ยอดที่ควรเป็น · null = เทียบไม่ได้ */
  leftover: number | null
  state: OrderMoneyState
}

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** ตัวเลขที่ใช้ได้จริงไหม — แยก "ไม่มีช่อง" ออกจาก "มีช่องแต่เป็น null/อ่านไม่ออก" */
function known(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function reconcileOrder(input: OrderMoneyInput): OrderMoney {
  const lines = input.lines ?? []
  const linesTotal = round2(lines.reduce((s, l) => s + num(l.amount), 0))
  const total = num(input.amount)
  const gap = round2(total - linesTotal)

  const hasDiscountField = lines.some((l) => 'discount' in l)
  const lineDiscountUnknown = hasDiscountField && lines.some((l) => l.discount === null)
  /* ⚠️ ต่อชิ้น ⇒ คูณ qty · แต่ค่านี้ **ไม่เข้าสมการ** ใช้แสดงผลอย่างเดียว */
  const lineDiscount = hasDiscountField && !lineDiscountUnknown
    ? round2(lines.reduce((s, l) => s + num(l.discount) * num(l.qty), 0))
    : null

  const bd = input.billDiscount
  const sa = input.shipAmount
  if (!known(bd) || !known(sa)) {
    /* ไม่มีช่องเลย vs มีช่องแต่ใบนี้ไม่รู้ค่า — คนละเรื่อง ต้องบอกคนละแบบ */
    const state: OrderMoneyState = (bd === undefined || sa === undefined) ? 'no-fields' : 'unknown'
    return { linesTotal, gap, lineDiscount, hasDiscountField, lineDiscountUnknown, expected: null, leftover: null, state }
  }

  /* 🔴 **ห้ามลบ lineDiscount ตรงนี้** — ยอดบรรทัดหักมาแล้ว ลบอีกคือลบซ้ำ (เคยพลาดมาแล้ว) */
  const expected = round2(linesTotal - bd + sa)
  const leftover = round2(total - expected)
  return {
    linesTotal, gap, lineDiscount, hasDiscountField, lineDiscountUnknown,
    expected, leftover, state: Math.abs(leftover) <= 0.009 ? 'ok' : 'mismatch',
  }
}
