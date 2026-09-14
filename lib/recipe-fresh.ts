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
 * ⚠️ รอบซิงก์ครบทั้งร้านใช้เวลาราว 4 ชม. (รอบละ 90 ชุด) ⇒ เกิน 6 ชม. ถือว่าผิดปกติ
 */

/** เกินกี่ชั่วโมงถือว่าซิงก์หยุด — เผื่อจากรอบเต็ม ~4 ชม. ไว้แล้ว */
export const RECIPE_STALE_HOURS = 6

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
