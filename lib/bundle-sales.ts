/* ยอดขายรายเดือนของ "สินค้าเป็นชุด" — คิดจาก **บัตรสต็อกของชุด** ไม่ใช่รายงานของ ZORT
 *
 * 🔴 **ที่มา (ใบ t_mu2p83ql · 15 ก.ย. 2569)** — เดิมจอชุดถามยอดจาก `?list=topproducts`
 *    **เดือนละหนึ่งครั้ง** (การ์ด 1 ครั้ง + กราฟอีก 6 ครั้ง) และเกือบทุกชุดได้ค่าว่าง
 *    ⇒ จอต้องขึ้น "ยังไม่รู้" ตลอด ทั้งที่ของจริงมีข้อมูลอยู่แล้วในบัตรสต็อกของชุดเอง
 *
 * 🔑 **พิสูจน์ว่าสองแหล่งนี้ให้เลขเดียวกัน (ยิงจริง 15 ก.ย. 2569)** — ไม่ได้เชื่อเอาเอง:
 *    · `03409-3` เดือน ก.ย. 2569 — บัตรสต็อกรวมได้ **2 ชิ้น / 338.40 บาท**
 *      และ `?list=topproducts&from=2026-09-01&to=2026-09-30` ตอบ **2 / 338.4** ⇒ ตรงเป๊ะ
 *    · ทั้งช่วง (2025-01-01 ถึง 2026-09-30) บัตรสต็อก 6 แถว = 1,038.40 · topproducts = 6 / 1038.4
 *    · ไล่ครบ **14 ชุดที่เคยขาย**: ที่อยู่ในช่วงวันที่เดียวกัน ตรงกันทุกตัว (8/8)
 *      อีก 6 ชุดที่ topproducts ไม่มีบรรทัด **ไม่ใช่เพราะขาดข้อมูล** — ใบขายของมันอยู่ปี 2565/2567
 *      ซึ่งอยู่นอกช่วงที่ยิงถาม (ตรวจแล้วรายตัว)
 *    ⇒ บัตรสต็อกให้ของเท่ากัน **แต่ได้ประวัติทั้งหมดในการยิงครั้งเดียว** ⇒ เลิกยิงเดือนละครั้ง
 *
 * ⚠️ **ขอบเขตของตัวเลขนี้ (เขียนบนจอด้วย ห้ามให้คนเดาเอง)**
 *    · นับเฉพาะแถวชนิด "ขาย" ของ **รหัสชุด** — ZORT บันทึกการขายชุดไว้ที่รหัสชุด ไม่ใช่รหัสลูก
 *      (ใบ t_mu2ndt8a พิสูจน์แล้วว่าใบของชุดกับใบของลูกไม่ซ้ำกัน) ⇒ ไม่นับซ้ำ
 *    · สถานะที่พบจริงในบัตรสต็อกของชุดทั้ง 23 แถว (15 ก.ย. 2569): `Success` 20 · `Waiting` 3
 *      **ยังไม่เคยเจอใบยกเลิก** ⇒ ฟังก์ชันนี้ยังตัด `Voided` ออกไว้ล่วงหน้า และ**บอกจำนวนที่ตัด**
 *      (ถ้าวันหนึ่งมีจริงจะได้ไม่เงียบ) — ไม่ใช่การเดาว่ามี
 *    · `amount` คือค่าที่บัตรสต็อกส่งมาต่อแถว **ไม่ได้คิดเอง**
 *
 * 🔴 **ไม่ครบ ≠ ศูนย์** — ถ้าท่อตัดแถว (`truncated`/`hasMore`) หรืออ่านบางแหล่งไม่ได้ (`failed`)
 *    ยอดเดือนนั้น **ห้ามแสดงเป็นตัวเลข** ต้องเป็น "ยังไม่รู้" เพราะแถวที่หายไปคือยอดที่หายไป
 */

/** แถวขายเท่าที่ `?list=stockcard&kind=sale` ส่งมาจริง (ยิงดูแล้ว ไม่ได้เดาช่อง) */
export interface BundleSaleRow {
  date?: string
  status?: string
  qty?: number
  amount?: number
}

/** ช่องความครบที่ท่อส่งมาคู่กับแถว — จอต้องอ่าน ไม่ใช่ดูแค่จำนวนแถว */
export interface SalesMeta {
  hasMore?: boolean
  truncated?: boolean
  failed?: string[]
}

export interface MonthSales {
  /** `YYYY-MM` ของเดือนนั้น */
  key: string
  label: string
  /** null = **ยังไม่รู้** (ข้อมูลไม่ครบ) · 0 = รู้แล้วว่าเดือนนั้นไม่มีการขาย */
  amount: number | null
  qty: number | null
}

const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ข้อมูลครบพอจะพูดว่า "เดือนนี้ขายได้เท่านี้" ไหม
 *  ⚠️ แถวว่างไม่ได้แปลว่าไม่ครบ — ชุดที่ยังไม่เคยขายก็ได้ 0 แถวอย่างถูกต้อง */
export function salesComplete(meta: SalesMeta | null | undefined): boolean {
  if (!meta) return false
  if (meta.hasMore === true || meta.truncated === true) return false
  if (Array.isArray(meta.failed) && meta.failed.length > 0) return false
  return true
}

/** ป้ายเดือนแบบไทย พ.ศ. สองหลัก เช่น `ก.ย. 69` */
export function monthLabel(year: number, monthIndex0: number, shortYear = true): string {
  const be = year + 543
  return `${THAI_MONTH[monthIndex0]} ${shortYear ? String(be).slice(2) : String(be)}`
}

/** รวมยอดของเดือนหนึ่งจากแถวบัตรสต็อก
 *  @param rows แถวขาย (null = ยังอ่านไม่ได้ ⇒ คืน null ทั้งคู่)
 *  @param key  เดือนในรูป `YYYY-MM`
 *  🔴 คืน `amount: null` เมื่อ **ข้อมูลไม่ครบ** ไม่ใช่เมื่อไม่มีแถว */
export function sumMonth(
  rows: BundleSaleRow[] | null | undefined,
  meta: SalesMeta | null | undefined,
  key: string,
): { amount: number | null; qty: number | null; voided: number } {
  if (!Array.isArray(rows) || !salesComplete(meta)) return { amount: null, qty: null, voided: 0 }
  let amount = 0
  let qty = 0
  let voided = 0
  for (const r of rows) {
    if (typeof r?.date !== 'string' || r.date.slice(0, 7) !== key) continue
    if (String(r?.status ?? '').trim() === 'Voided') { voided += 1; continue }
    amount += Number(r?.amount) || 0
    /* บัตรสต็อกส่ง qty ของการขายมาเป็น **ค่าติดลบ** (ของออกจากคลัง) ⇒ นับเป็นจำนวนที่ขายได้ */
    qty += Math.abs(Number(r?.qty) || 0)
  }
  return { amount, qty, voided }
}

/** ชุดข้อมูลกราฟย้อนหลัง N เดือนจนถึงเดือนของ `now` (เดือนล่าสุดอยู่ขวาสุด) */
export function monthlySeries(
  rows: BundleSaleRow[] | null | undefined,
  meta: SalesMeta | null | undefined,
  now: Date,
  months = 6,
): MonthSales[] {
  const out: MonthSales[] = []
  for (let back = months - 1; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const s = sumMonth(rows, meta, key)
    out.push({ key, label: monthLabel(d.getFullYear(), d.getMonth()), amount: s.amount, qty: s.qty })
  }
  return out
}

/** วันขายล่าสุดที่บัตรสต็อกมี (`YYYY-MM-DD`) · null = ไม่มีแถวหรืออ่านไม่ได้ */
export function lastSaleDate(rows: BundleSaleRow[] | null | undefined): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  let max = ''
  for (const r of rows) {
    const d = typeof r?.date === 'string' ? r.date : ''
    if (d > max) max = d
  }
  return max || null
}
