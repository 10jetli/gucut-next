/** เปิดใบขายจาก "เลขที่ใบ" — ต้องหา id จริงก่อนเสมอ
 *
 * ทำไมต้องมีไฟล์นี้ (9 ก.ย. 2569): `id` ของออเดอร์ในกระจกคือ `<ร้าน>/<เลขที่ใบ>` (เช่น `z1/SO-202609015`)
 * แต่หลายเส้นของท่อส่งมาแค่ `number` เปล่า ๆ ⇒ เอาไปเปิด `?order=` ตรง ๆ ได้ "ไม่พบใบนี้ในคลังเงา" ทุกใบ
 * และ **เดา prefix เองไม่ได้** เพราะเส้นพวกนั้นไม่ส่ง `source` มาด้วย (ใบร้านที่สองจะพังอีกแบบเงียบ ๆ)
 *
 * ⚠️ ผลลัพธ์แยกสามทางโดยตั้งใจ ห้ามยุบเหลือสองทาง:
 *    เจอใบเดียว (ไปได้) · เจอหลายใบ (เลขซ้ำข้ามร้าน — เปิดให้อัตโนมัติไม่ได้) · ไม่เจอ/ท่อล่ม
 *    ยุบเมื่อไหร่ = พาคนไปหน้าที่เขียนว่าไม่พบ แล้วให้เขาเดาเองว่าพังตรงไหน
 *
 * 🗑️ ถ้าท่อเริ่มส่ง `id` มากับรายการเมื่อไหร่ ให้เลิกใช้ไฟล์นี้ในจอนั้นแล้วลิงก์ตรง ๆ
 *    (`scripts/check-detail-live.mjs` จะขึ้น 🗑️ บอกเองเมื่อถึงวันนั้น)
 */
export type OpenOrderResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'notfound' | 'ambiguous' | 'error'; msg: string }

export async function findOrderId(number: string): Promise<OpenOrderResult> {
  try {
    const res = await fetch(`/api/web/core?list=orders&q=${encodeURIComponent(number)}&limit=5`)
    const j = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, reason: 'error', msg: `เปิดไม่ได้ (ท่อตอบ ${res.status})` }
    const rows: Array<{ id?: string; number?: string }> = Array.isArray(j?.rows) ? j.rows : []
    const hit = rows.filter((r) => r.number === number && r.id)
    if (hit.length === 1) return { ok: true, id: String(hit[0].id) }
    if (hit.length > 1) {
      return { ok: false, reason: 'ambiguous', msg: 'เจอหลายใบเลขเดียวกัน เปิดให้อัตโนมัติไม่ได้ — ค้นในจอรายการขาย' }
    }
    return { ok: false, reason: 'notfound', msg: 'ไม่พบใบนี้ในคลังเงา — อาจยังไม่ถึงรอบซิงก์' }
  } catch (e) {
    return { ok: false, reason: 'error', msg: `เปิดไม่ได้: ${e instanceof Error ? e.message : String(e)}` }
  }
}
