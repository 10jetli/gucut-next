/* ความสดของ "สูตรสินค้าเป็นชุด" ที่ซิงก์จาก ZORT — ใช้ร่วม 4 จอ
 *
 * 🔴 **ที่มา (14 ก.ย. 2569)**: เดิมสูตรชุดเป็น "ภาพนิ่งเก็บครั้งเดียว" ⇒ จอ 4 จุดเขียนเตือนไว้ว่า
 *    "ไม่ได้ซิงก์เอง · ร้านแก้สูตรแล้วไม่มีอะไรเตือน" · ตอนนี้ฝั่งท่อทำให้ **ซิงก์ทุกชั่วโมง** แล้ว
 *    (gucut-web a17692b · ตรวจ 360/360) ⇒ **ข้อความเดิมกลายเป็นเท็จ** ต้องแก้ทั้งสี่จุด
 *
 * 🔴 **สองเวลานี้คนละเรื่อง ห้ามสลับ** (ฝั่งท่อกำชับ)
 *    · `changedAt` (collectedAt / recipeAt) = **สูตรเปลี่ยนล่าสุดเมื่อไหร่**
 *      ⚠️ สูตรที่ไม่เคยเปลี่ยนจะค้างอยู่ที่ 3 ก.ย. ตลอดไป
 *         ⇒ **ห้ามเอาไปเขียนว่า "ตรวจล่าสุด"** ไม่งั้นจอจะดูเหมือนซิงก์หยุดไปตั้งแต่ต้นเดือน
 *    · `checkedAt` (recipeCheckedAt) = **ไปถาม ZORT ล่าสุดเมื่อไหร่** ← อันนี้คือความสด
 *
 * ⚠️ **เวลาจากท่อเป็น UTC** ⇒ ต้อง +7 ก่อนแสดง (บทเรียนเดียวกับกำหนดส่งในจอใบสั่งผลิตเมื่อบ่ายนี้)
 * ⚠️ `checkedAt` เป็น null = **"ไม่รู้" ไม่ใช่ "ไม่ได้ซิงก์"** — ห้ามเขียนว่าซิงก์หยุด
 *    เพราะอาจแค่ท่อรุ่นเก่าไม่ได้ส่งช่องนี้มา
 * ⚠️ รอบซิงก์ครบทั้งร้านใช้เวลาราว 4 ชม. (รอบละ 90 ชุด)
 *
 * 🔴 **ตารางเปลี่ยนแล้ว 18 ก.ย. 2569 — ข้อความ "ทุกชั่วโมง" ข้างบนเป็นของเก่า**
 *    ฝั่งท่อเปลี่ยน `27,57 * * * *` (ทุกครึ่งชั่วโมง) → `0 3 * * *` (วันละครั้ง 03:00 UTC = 10:00 ไทย)
 *    เหตุผล: ลดเครดิต — เวลาทำงานรวมลง 69% (gucut-web aacde9e · 18 ก.ย. 10:14 +07)
 *    ⚠️ เก็บประโยคเดิมไว้เป็น **ประวัติ** ไม่ลบ · แต่ของที่ใช้ตัดสินคือค่าข้างล่างนี้เท่านั้น
 *
 * 🔑 **บทเรียนที่ทำให้ไฟล์นี้ต้องมีป้ายคำด้วย ไม่ใช่มีแค่ตัวเลข** (19 ก.ย. 2569)
 *    วันนั้นรอบเดียวกันมี **สี่คำตอบที่ขัดกันเอง**: cron วันละครั้ง · desc ทุกครึ่งชั่วโมง
 *    · ข้อความบนจอ 5 จุดบอกทุกชั่วโมง · และเกณฑ์ในไฟล์นี้เตือนที่ 6 ชม.
 *    ⇒ แม้แต่ในฝั่งเราเอง **คำกับเกณฑ์ก็ไม่ตรงกัน** ⇒ จอพูดอย่าง ตัดสินอีกอย่าง
 *    ⇒ ทางแก้ไม่ใช่ไล่แก้คำให้ตรง แต่คือ **ให้คำกับเกณฑ์ออกมาจากบรรทัดเดียวกัน**
 */

/** รอบจริงของงาน `bundle-recipe-sync` — **ที่เดียวของทั้ง repo**
 *  เปลี่ยนที่นี่แล้วทั้งข้อความบนจอและเกณฑ์เตือนขยับตามพร้อมกัน */
export const RECIPE_SYNC_LABEL = 'วันละครั้ง (ราว 10 โมงเช้า)'

/** เกินกี่ชั่วโมงถือว่าซิงก์หยุด
 *  🔴 **25 ไม่ใช่ 6** — รอบจริงคือวันละครั้ง ⇒ เผื่อ 1 ชม. ให้รอบเลื่อน (ฝั่งท่อยืนยัน 18 ก.ย. 2569)
 *  ถ้าตั้งไว้ 6 ตามของเดิม แถบแดงจะขึ้นตั้งแต่บ่าย 4 ยันสิบโมงวันรุ่งขึ้น = **~18 ชม./วัน ทั้งที่งานปกติ**
 *  ⇒ จอที่ร้องทุกวันจะถูกเลิกอ่าน ซึ่งแย่กว่าไม่มีจอสถานะเลย (กฎที่ `check-cron-table.mjs` เขียนไว้เอง) */
export const RECIPE_STALE_HOURS = 25

export type RecipeState = 'ok' | 'stale' | 'unknown'

export interface RecipeFreshness {
  /** ok = สดอยู่ · stale = เกินเวลาที่ควร ⇒ ซิงก์น่าจะหยุด · unknown = ท่อไม่ได้บอกมา */
  state: RecipeState
  /** อายุของการตรวจล่าสุด (ชั่วโมง) · null = ไม่รู้ */
  ageHours: number | null
  /** เวลาที่ตรวจกับ ZORT ล่าสุด แปลงเป็นเวลาไทยแล้ว · null = ไม่รู้ */
  checkedThai: Date | null
  /** เวลาที่สูตรเปลี่ยนล่าสุด แปลงเป็นเวลาไทยแล้ว · null = ไม่รู้ */
  changedThai: Date | null
}

/** แปลงเวลาจากท่อ (UTC) เป็นเวลาไทย · รับได้ทั้ง "2026-09-14T12:00:00Z" และ "2026-09-14 12:00:00"
 *  ⚠️ รูปที่ไม่มีโซนติดมา **ถือว่าเป็น UTC** ตามที่ฝั่งท่อระบุ — ไม่ใช่เวลาเครื่องผู้ใช้ */
export function toThai(utc?: string | null): Date | null {
  const s = String(utc ?? '').trim()
  if (!s) return null
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  return new Date(t.getTime() + 7 * 3600_000)
}

export function recipeFreshness(
  checkedAtUtc?: string | null,
  changedAtUtc?: string | null,
  now = Date.now(),
): RecipeFreshness {
  const checkedThai = toThai(checkedAtUtc)
  const changedThai = toThai(changedAtUtc)
  if (!checkedThai) return { state: 'unknown', ageHours: null, checkedThai: null, changedThai }
  /* อายุคิดจากเวลาจริง (UTC ทั้งคู่) — บวก 7 ทั้งสองฝั่งแล้วลบกันได้ผลเท่ากัน แต่เขียนตรง ๆ ชัดกว่า */
  const ageMs = now - (checkedThai.getTime() - 7 * 3600_000)
  const ageHours = Math.round((ageMs / 3600_000) * 10) / 10
  return {
    state: ageHours > RECIPE_STALE_HOURS ? 'stale' : 'ok',
    ageHours,
    checkedThai,
    changedThai,
  }
}

/** "14 ก.ย. 2569 19:05 น." — เวลาไทยพร้อมนาที (ใช้กับ checkedAt ที่ต้องรู้ชั่วโมง) */
const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function thaiMoment(d: Date | null): string {
  if (!d) return '—'
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${TH_MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() + 543} ${hh}:${mm} น.`
}

/* ── ความสดของ "ตัวเลขสต็อกชุด" (คงเหลือ / พร้อมขาย) ────────────────────────
 * 🔴 **คนละเรื่องกับความสดของสูตร ห้ามใช้ปนกัน** (ฝั่งท่อกำชับ 14 ก.ย. 2569)
 *    · สูตรชุด (มีอะไรอยู่ในชุด)       ⇒ `recipeCheckedAt` · ซิงก์ทุกชั่วโมง
 *    · ตัวเลขสต็อกชุด (คงเหลือ/พร้อมขาย) ⇒ `stockSyncedAt`  · ซิงก์ทุกครึ่งชั่วโมง
 *    เอา recipeCheckedAt/recipeAt มาเขียนกำกับคอลัมน์คงเหลือ = โกหกคนอ่าน
 *
 * 🔴 **ที่มา**: จอเราโชว์ชุด 00073-11.8-NW คงเหลือ 41 พร้อมขาย 23 · ZORT คงเหลือ 18 พร้อมขาย -10
 *    ต้นเหตุ = ตาราง bundles ไม่มีอะไรซิงก์ให้เลย ค้างที่ 187/360 ชุด
 *    ⇒ ฝั่งท่อแก้แล้ว (gucut-web 587eb18) **และจอต้องโชว์อายุของตัวเลข**
 *       ไม่งั้นรอบหน้าที่ซิงก์หยุด จอจะยืนยันเลขเก่าอย่างมั่นใจเหมือนเดิม
 * ⚠️ null = "ไม่รู้" ไม่ใช่ "ซิงก์หยุด" (เหตุผลเดียวกับ checkedAt ข้างบน)
 */

/** เกินกี่นาทีถือว่าซิงก์สต็อกชุดหยุด — ท่อซิงก์ทุก 30 นาที เผื่อพลาดสองรอบ */
export const STOCK_STALE_MINUTES = 90

export interface StockFreshness {
  state: RecipeState
  /** อายุของการซิงก์ล่าสุด (นาที) · null = ไม่รู้ */
  ageMinutes: number | null
  /** เวลาซิงก์ล่าสุด แปลงเป็นเวลาไทยแล้ว · null = ไม่รู้ */
  syncedThai: Date | null
}

export function stockSyncFreshness(syncedAtUtc?: string | null, now = Date.now()): StockFreshness {
  const syncedThai = toThai(syncedAtUtc)
  if (!syncedThai) return { state: 'unknown', ageMinutes: null, syncedThai: null }
  const ageMinutes = Math.round((now - (syncedThai.getTime() - 7 * 3600_000)) / 60_000)
  return { state: ageMinutes > STOCK_STALE_MINUTES ? 'stale' : 'ok', ageMinutes, syncedThai }
}

/** "8 นาทีที่แล้ว" / "3 ชม. 10 น.ที่แล้ว" — อ่านง่ายกว่าเลขนาทีดิบเมื่อค้างนาน */
export function agoText(minutes: number | null): string {
  if (minutes === null) return 'ไม่รู้'
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} ชม. ${m} น.ที่แล้ว` : `${h} ชม.ที่แล้ว`
}
