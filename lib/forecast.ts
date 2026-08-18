// เครื่องพยากรณ์ความต้องการสินค้า — แบบที่ใช้กันจริงในวงการคลังสินค้า
//
// ===========================================================================
// ⚠️ อ่านก่อนแก้: ทำไมไม่ใช้ "AI" แบบ ChatGPT ทำนายตัวเลข
//
// Walmart / Amazon / Costco ไม่ได้เอาโมเดลภาษามาเดายอดขาย เขาใช้สถิติพยากรณ์
// ความต้องการ (demand forecasting) ที่รันกับสินค้าหลายแสนรายการพร้อมกัน
// เพราะมันอธิบายได้ ตรวจสอบได้ และแม่นกว่าสำหรับตัวเลขซ้ำ ๆ แบบนี้มาก
// เอาโมเดลภาษามาเดา "ควรสั่งกี่ชิ้น" = ได้เลขที่ฟังดูดีแต่ตรวจสอบไม่ได้ และผิดบ่อย
//
// ไฟล์นี้จึงเป็นสถิติล้วน ๆ ไม่มีการเรียกโมเดลภาษาใด ๆ
// ===========================================================================
//
// ปัญหาเฉพาะของร้านอะไหล่ ที่สูตรค่าเฉลี่ยธรรมดาแก้ไม่ได้
//
//   1) ของส่วนใหญ่ขายนาน ๆ ที (intermittent demand)
//      ร้านนี้มี 2,256 SKU แต่ครึ่งหนึ่งขายไม่ถึงปีละครั้ง
//      ถ้าเอา "ยอดขายทั้งปี ÷ 365" จะได้ 0.005 ชิ้น/วัน ซึ่งไร้ความหมาย
//      → ใช้วิธี Croston/SBA: แยกคิด "ขายครั้งละกี่ชิ้น" กับ "นานกี่วันจึงขายอีกครั้ง"
//
//   2) ยอดขายไม่นิ่ง — บางสัปดาห์ขาย 50 บางสัปดาห์ขาย 0
//      → ต้องมี safety stock ตามความผันผวนจริง ไม่ใช่บวกเผื่อมั่ว ๆ
//
//   3) ขายตามฤดูกาล — เลื่อยยนต์ขายดีช่วงเก็บเกี่ยว/หน้าแล้ง
//      → คูณดัชนีฤดูกาลของเดือนที่ของจะมาถึง ไม่ใช่ของเดือนนี้
//
//   4) ของบางตัวกำลังมาแรง บางตัวกำลังตาย
//      → เทียบ 12 สัปดาห์ล่าสุดกับช่วงก่อนหน้า
// ===========================================================================

/** ยอดขายรายสัปดาห์ 52 ช่อง (ช่อง 0 = สัปดาห์เก่าสุด, ช่องท้าย = ล่าสุด) */
export type Weekly = number[]

export interface ForecastInput {
  weekly: Weekly
  stock: number
  price: number
  leadDays: number
  coverDays: number
  /** เดือน (0-11) ที่ของจะมาถึง — ใช้เลือกดัชนีฤดูกาล */
  arriveMonth: number
  /** ดัชนีฤดูกาลรายเดือน 12 ช่อง (1 = ปกติ) — คิดจากยอดขายรวมทั้งร้าน */
  seasonIndex: number[]
}

export interface ForecastOut {
  perDay: number         // ความต้องการเฉลี่ยต่อวัน (ปรับ trend + ฤดูกาลแล้ว)
  sigmaLT: number        // ความผันผวนตลอดช่วงรอของ
  safety: number         // สต๊อกกันเหนียว
  rop: number            // จุดที่ควรสั่ง
  suggest: number        // ควรสั่งกี่ชิ้น
  daysLeft: number | null
  trend: number          // 1 = ทรงตัว · >1 กำลังมาแรง · <1 กำลังตาย
  intermittent: boolean  // ขายนาน ๆ ที (ใช้ Croston)
  dead: boolean          // ไม่ขายเลยแต่มีของค้าง = เงินจม
  overstock: boolean     // ของพอขายเกิน 1 ปี
}

/**
 * ระดับบริการ 95% — ยอมให้ของขาดได้ราว 1 ครั้งใน 20 รอบสั่ง
 * ตั้งสูงกว่านี้ = ของไม่ขาดแต่เงินจมเยอะขึ้นมาก (ต้องแลกกันเสมอ)
 * 1.65 คือค่า z ของ 95% ในตารางแจกแจงปกติ
 */
const Z = 1.65

/** ถือว่า "ขายนาน ๆ ที" เมื่อสัปดาห์ที่ขายไม่ออกเกิน 60% ของทั้งปี */
const INTERMITTENT_AT = 0.6

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0)

function stdev(a: number[]): number {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1))
}

/**
 * Croston / SBA — วิธีมาตรฐานสำหรับของที่ขายนาน ๆ ที
 *
 * แยกคิดสองอย่างแทนที่จะเฉลี่ยรวม
 *   z = ขายครั้งละกี่ชิ้น (เฉพาะสัปดาห์ที่ขายได้)
 *   p = ทุกกี่สัปดาห์จึงขายได้อีกครั้ง
 * ความต้องการต่อสัปดาห์ = z / p
 *
 * ตัวคูณ 0.95 คือส่วนแก้ของ Syntetos–Boylan (SBA)
 * — Croston ดั้งเดิมประเมินสูงเกินจริงอย่างเป็นระบบ ทำให้สั่งของเกินเรื่อย ๆ
 */
function croston(weekly: Weekly): number {
  const hits: number[] = []
  const gaps: number[] = []
  let gap = 0
  for (const v of weekly) {
    gap++
    if (v > 0) { hits.push(v); gaps.push(gap); gap = 0 }
  }
  if (!hits.length) return 0
  const z = mean(hits)
  const p = mean(gaps) || 1
  return (z / p) * 0.95
}

export function forecast(inp: ForecastInput): ForecastOut {
  const { weekly, stock, leadDays, coverDays, arriveMonth, seasonIndex } = inp
  const weeks = weekly.length || 1
  const zeroRatio = weekly.filter((v) => v === 0).length / weeks
  const intermittent = zeroRatio > INTERMITTENT_AT

  // ---- ความต้องการพื้นฐานต่อสัปดาห์ ----
  const basePerWeek = intermittent ? croston(weekly) : mean(weekly)

  // ---- แนวโน้ม: 12 สัปดาห์ล่าสุด เทียบกับ 12 สัปดาห์ก่อนหน้า ----
  // ⚠️ ครอบด้วยเพดาน 0.5–2.0 — ของที่บังเอิญขายรวดเดียวสัปดาห์เดียว
  //    จะทำให้อัตราส่วนพุ่งเป็นสิบเท่า แล้วสั่งของท่วมคลัง
  const recent = weekly.slice(-12)
  const prior = weekly.slice(-24, -12)
  const mr = mean(recent), mp = mean(prior)
  let trend = mp > 0 ? mr / mp : (mr > 0 ? 1.2 : 1)
  trend = Math.min(2, Math.max(0.5, trend))

  // ---- ฤดูกาล: ใช้ดัชนีของเดือนที่ "ของจะมาถึง" ไม่ใช่เดือนนี้ ----
  // สั่งวันนี้ของถึงอีก 45 วัน จึงต้องเตรียมของให้พอกับความต้องการของเดือนนั้น
  const season = seasonIndex[arriveMonth] || 1

  const perWeek = basePerWeek * trend * season
  const perDay = perWeek / 7

  // ---- ความผันผวนตลอดช่วงรอของ ----
  // σ ของยอดรายสัปดาห์ × √(จำนวนสัปดาห์ที่ต้องรอ) — สูตรมาตรฐานของ safety stock
  const weeksLT = leadDays / 7
  const sigmaLT = stdev(weekly) * Math.sqrt(weeksLT)
  const safety = Math.ceil(Z * sigmaLT)

  // ---- จุดสั่งซื้อ และจำนวนที่ควรสั่ง ----
  const demandLT = perDay * leadDays
  const rop = Math.ceil(demandLT + safety)
  const target = Math.ceil(perDay * coverDays + safety)
  const suggest = Math.max(0, target - stock)

  const daysLeft = perDay > 0 ? Math.round(stock / perDay) : null
  const sold = sum(weekly)

  return {
    perDay: Math.round(perDay * 1000) / 1000,
    sigmaLT: Math.round(sigmaLT * 10) / 10,
    safety,
    rop,
    suggest,
    daysLeft,
    trend: Math.round(trend * 100) / 100,
    intermittent,
    dead: sold === 0 && stock > 0,
    overstock: daysLeft !== null && daysLeft > 365,
  }
}

/**
 * ดัชนีฤดูกาลรายเดือน — คิดจากยอดขายรวมของทั้งร้าน ไม่ใช่รายสินค้า
 *
 * ⚠️ ห้ามคิดแยกรายสินค้า — สินค้าหนึ่งตัวมีข้อมูลปีเดียว 12 จุด
 *    แยกเป็นรายเดือนแล้วเหลือจุดละ 1 ค่า ซึ่งเป็นสัญญาณรบกวนล้วน ๆ
 *    รวมทั้งร้านจะได้รูปฤดูกาลที่เชื่อถือได้ แล้วเอาไปใช้กับทุกตัว
 */
export function seasonalIndex(monthlyTotals: number[]): number[] {
  const avg = mean(monthlyTotals)
  if (!avg) return Array(12).fill(1)
  // ครอบไว้ 0.7–1.4 กันเดือนที่มีโปรใหญ่ครั้งเดียวลากดัชนีจนเพี้ยน
  return monthlyTotals.map((m) => Math.min(1.4, Math.max(0.7, m / avg)))
}

/**
 * จัดกลุ่ม ABC ตามมูลค่าขาย — กฎ 80/15/5
 * A = ตัวทำเงิน ต้องไม่ให้ขาดเด็ดขาด · C = ปล่อยได้ ไม่ต้องดูทุกวัน
 */
export function abcClass(values: { sku: string; value: number }[]): Record<string, 'A' | 'B' | 'C'> {
  const sorted = [...values].sort((a, b) => b.value - a.value)
  const total = sum(sorted.map((v) => v.value)) || 1
  const out: Record<string, 'A' | 'B' | 'C'> = {}
  // ⚠️ ต้องตัดสินจากยอดสะสม "ก่อน" บวกตัวเอง ไม่ใช่หลังบวก
  //    ถ้าใช้ยอดหลังบวก ตัวที่ทำเงินคนเดียว 84% ของร้านจะถูกจัดเป็น B ทันที
  //    เพราะยอดสะสมพุ่งข้าม 80% ตั้งแต่ตัวแรก — ซึ่งกลับหัวกลับหางกับความจริง
  //    (จับได้ตอนทดสอบด้วยตัวเลขสมมติ 18 ส.ค. 2569)
  let acc = 0
  for (const v of sorted) {
    const before = acc / total
    acc += v.value
    out[v.sku] = before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C'
  }
  return out
}
