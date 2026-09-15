/* "จำตัวกรองไว้" — ลอกจากติ๊ก `remember_filter` ของ ZORT (แผง "ตัวกรอง" ใน `/Sell/list`)
 *
 * 🔴 **อันตรายของฟีเจอร์นี้คือ "จอโกหกโดยไม่มีใครสั่ง"**
 *    ถ้าเปิดจอมาแล้วตัวกรองเก่าถูกใส่กลับให้เงียบ ๆ คนจะเห็นรายการน้อยกว่าความจริง
 *    แล้วสรุปว่า "วันนี้ขายได้เท่านี้" ทั้งที่กำลังดูของที่กรองไว้เมื่อวาน
 *    ⇒ กติกาของตัวนี้: **จำได้ แต่ต้องประกาศทุกครั้งที่ใช้ของที่จำไว้ และล้างได้ในคลิกเดียว**
 *
 * 🔑 **จำเฉพาะ "ตัวเลือก" ไม่จำ "คำที่พิมพ์"**
 *    คำค้นหาที่ค้างอยู่คือของที่หลอกที่สุด — คนพิมพ์เลขใบเมื่อวานไว้ วันนี้เปิดมาเห็น 1 แถว
 *    แล้วนึกว่าทั้งวันขายได้ใบเดียว ⇒ `q` **ไม่อยู่ในของที่จำ** (และเขียนบอกบนจอด้วย)
 *
 * ⚠️ `localStorage` เข้าถึงไม่ได้ก็มี (โหมดส่วนตัว · ผู้ใช้ปิดไว้) ⇒ **ทุกทางต้อง try/catch**
 *    และเมื่ออ่านไม่ได้ ให้ทำเหมือนไม่เคยจำ — ห้ามให้ทั้งจอพังเพราะเรื่องนี้
 * ⚠️ ของที่จำไว้เป็นของ **เครื่องนี้ ผู้ใช้คนนี้** เท่านั้น ไม่ได้ส่งขึ้นเซิร์ฟเวอร์
 * ⚠️ มี `v` (รุ่นของรูปข้อมูล) ติดไว้ — วันที่เพิ่ม/ตัดช่อง ให้ขยับเลขนี้
 *    ของเก่ารูปไม่ตรงจะถูกทิ้งแทนที่จะเอามาใช้ผิด ๆ
 */

export interface SalesFilterMemo {
  /** ช่วง "แสดง N วัน" ที่เลือกไว้ */
  days?: number
  store?: string
  channel?: string
  status?: string
  /** ช่วงวันที่กำหนดเอง (ว่าง = ไม่ได้กำหนด) */
  from?: string
  to?: string
}

const VERSION = 1

interface Stored { v: number; at: string; f: SalesFilterMemo }

/** อ่านของที่จำไว้ · คืน null เมื่อไม่มี/อ่านไม่ได้/รูปไม่ตรงรุ่น */
export function loadFilter(key: string): SalesFilterMemo | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(key)
    if (!raw) return null
    const o = JSON.parse(raw) as Stored | null
    if (!o || typeof o !== 'object' || o.v !== VERSION || !o.f || typeof o.f !== 'object') return null
    const f = o.f
    /* รับเฉพาะช่องที่รู้จัก และชนิดต้องตรง — ของที่ถูกแก้มือใน devtools ต้องไม่ไหลเข้าจอ */
    const out: SalesFilterMemo = {}
    if (typeof f.days === 'number' && Number.isFinite(f.days) && f.days > 0) out.days = f.days
    for (const k of ['store', 'channel', 'status', 'from', 'to'] as const) {
      if (typeof f[k] === 'string') out[k] = f[k]
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

/** จำไว้ · ล้มเหลวเงียบได้ (แต่ห้ามโยน) */
export function saveFilter(key: string, f: SalesFilterMemo): void {
  try {
    if (typeof window === 'undefined') return
    const body: Stored = { v: VERSION, at: new Date().toISOString(), f }
    window.localStorage.setItem(key, JSON.stringify(body))
  } catch {
    /* เขียนไม่ได้ = ไม่จำ · จอยังใช้งานได้ตามปกติ */
  }
}

export function clearFilter(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  } catch {
    /* ลบไม่ได้ก็ปล่อย — รอบหน้าที่อ่านไม่ได้จะถือว่าไม่เคยจำ */
  }
}

/** มีอะไรที่ "ไม่ใช่ค่าตั้งต้น" ถูกจำไว้บ้าง — ใช้เขียนบอกบนจอ
 *  🔴 ต้องบอกเป็น **คำที่คนอ่านรู้เรื่อง** ไม่ใช่ชื่อตัวแปร */
export function describeFilter(
  f: SalesFilterMemo | null,
  defaults: { days: number },
  /** ตัวแปลรหัสเป็นคำที่คนอ่านรู้เรื่อง — จอเป็นคนส่งเข้ามา
   *  🔴 **ไม่ผูกคำของร้าน/สถานะไว้ในไฟล์นี้** เพราะคำพวกนั้นมีเจ้าของอยู่แล้ว
   *     (ร้าน = components/zort/StorePicker · สถานะ = lib/zort-words)
   *     เขียนซ้ำที่นี่เมื่อไหร่ = แผนที่คำแปลชุดที่สอง ซึ่งวันหนึ่งจะไม่ตรงกัน */
  labels?: { store?: (v: string) => string; status?: (v: string) => string },
): string[] {
  if (!f) return []
  const out: string[] = []
  if (typeof f.days === 'number' && f.days !== defaults.days) out.push(`ช่วง ${f.days} วัน`)
  if (f.from || f.to) out.push(`ช่วงวันที่กำหนดเอง ${f.from || '—'} ถึง ${f.to || '—'}`)
  /* ⚠️ ป้ายที่จอส่งมามีคำว่า "ร้าน" อยู่ในตัวแล้ว (เช่น "หน้าร้าน (z2)")
     ⇒ เติมคำว่า "ร้าน" ซ้ำจะได้ "ร้าน หน้าร้าน (z2)" ⇒ เติมเฉพาะตอนไม่มีตัวแปล */
  if (f.store) out.push(labels?.store ? labels.store(f.store) : `ร้าน ${f.store}`)
  if (f.channel) out.push(`ช่องทาง ${f.channel}`)
  if (f.status) out.push(`สถานะ ${labels?.status ? labels.status(f.status) : f.status}`)
  return out
}
