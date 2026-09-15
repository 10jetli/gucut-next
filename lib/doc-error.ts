/* แปลคำตอบที่ล้มเหลวของ "เส้นเอกสารรายใบ" ให้เป็นข้อความที่บอกได้ว่าต้องทำอะไรต่อ
 * (`?transfer=` · `?returnorder=` · `?quotation=` · ท่อ gucut-web 01f7b9f · 15 ก.ย. 2569)
 *
 * 🔴 **ทำไมต้องมี** — เดิมทั้งสามจอเขียนเหมือนกันหมดว่า "ดึง…จาก ZORT ไม่ได้"
 *    ซึ่งคลุมสามเรื่องที่ต้องทำคนละอย่าง:
 *      · พิมพ์เลข id ผิด            ⇒ แก้ที่เลข (เรายังไม่ได้ถาม ZORT ด้วยซ้ำ)
 *      · ติดต่อ ZORT ไม่ได้/อ่านคำตอบไม่ออก ⇒ **ยังไม่รู้ว่ามีใบไหม** ⇒ ลองใหม่
 *      · ZORT ตอบแล้วแต่ไม่ส่งใบให้   ⇒ อาจไม่มีใบนี้จริง หรือเลขผิด
 *    คนอ่านข้อความเดียวกันทั้งสามกรณี จะเดาเอาเองว่า "ไม่มีใบนี้" ซึ่งผิดได้ทั้งสองทาง
 *
 * ⚠️ **ห้ามเขียนว่า "ไม่มีใบนี้" จากการที่ ZORT ไม่ส่งใบมา** (ฝั่งท่อกำชับตรง ๆ)
 *    ยังไม่มีใครพิสูจน์ว่า ZORT ตอบแบบนั้นเฉพาะตอน "ไม่มีใบ" เท่านั้น
 *    ⇒ ใช้คำที่เปิดสองทางไว้: "ZORT ไม่ส่งใบนี้ให้ — อาจพิมพ์เลขผิด หรือไม่มีใบนี้"
 *
 * 📏 **ของจริงที่ยิงเองเมื่อ 15 ก.ย. 2569** (ยิงผ่านคีย์อ่านอย่างเดียว):
 *    · `?transfer=abc` · `?quotation=abc` ⇒ HTTP 200 + `{ok:false, badId:true, error:"id …ต้องเป็นตัวเลขของ ZORT"}`
 *    · `?transfer=999999999` · `?returnorder=999999999` · `?quotation=999999999`
 *      ⇒ HTTP 200 + `{ok:false, error:"ZORT ตอบมาแต่หาหัวใบไม่เจอ", fields:[…]}`
 *    ⚠️ **ยังไม่เคยเห็น `unknown:true` และ `zortStatus` ด้วยตาตัวเอง** — รองรับไว้ตามสัญญาที่ฝั่งท่อส่งมา
 *       แต่เขียนกำกับไว้ว่ายังไม่ได้ยิงเจอ (ห้ามเล่าว่าทดสอบครบทุกทางทั้งที่ยังไม่เจอ)
 *    ⚠️ ทุกแบบมาเป็น **HTTP 200** ⇒ จอที่ดูแต่ `res.ok` จะคิดว่าสำเร็จ ⇒ ต้องดู `ok:false` ด้วย
 */

/** รูปคำตอบเท่าที่เส้นเอกสารรายใบส่งมาได้ (อ่านจากของจริง + สัญญาของฝั่งท่อ) */
export interface DocFail {
  ok?: boolean
  error?: string
  /** id ไม่ใช่ตัวเลข ⇒ **ยังไม่ได้ยิงไป ZORT เลย** */
  badId?: boolean
  /** ติดต่อ ZORT ไม่ได้ / อ่านคำตอบไม่ได้ ⇒ ยังไม่รู้ว่ามีใบไหม */
  unknown?: boolean
  /** ZORT ตอบ แต่ไม่ส่งใบ — เก็บสถานะ/รหัส/ข้อความของ ZORT ไว้ให้เอาไปถามต่อได้ */
  zortStatus?: number | string | null
  zortCode?: string | number | null
  zortDesc?: string | null
  skip?: string
}

export type DocErrorKind = 'badId' | 'unknown' | 'zortRefused' | 'other'

export interface DocErrorView {
  kind: DocErrorKind
  /** หัวข้อกล่องแดง — สั้น บอกว่าเรื่องอะไร */
  title: string
  /** บรรทัดหลัก — บอกว่าตอนนี้รู้อะไรแล้ว */
  text: string
  /** บรรทัดรอง — บอกว่าให้ทำอะไรต่อ */
  next: string
  /** ข้อความดิบจากท่อ/ZORT ที่เอาไปถามต่อได้ (ไม่แปล ไม่ตัด) */
  raw?: string
}

/** คำตอบนี้ล้มเหลวไหม — **ต้องดู `ok:false` ด้วย ไม่ใช่ดูแค่ HTTP** */
export function isDocFail(d: unknown, httpOk = true): boolean {
  if (!d || typeof d !== 'object') return true
  const o = d as DocFail
  if (o.ok === false) return true
  if (typeof o.error === 'string' && o.error) return true
  return !httpOk
}

export function docErrorView(d: DocFail | null | undefined, httpStatus?: number): DocErrorView {
  const raw = typeof d?.error === 'string' && d.error ? d.error : undefined

  if (d?.badId) {
    return {
      kind: 'badId',
      title: 'เลขที่อ้างอิงไม่ถูกรูป',
      text: 'เลข id ที่ส่งมาไม่ใช่ตัวเลขของ ZORT ⇒ ระบบยังไม่ได้ถาม ZORT เลย',
      next: 'ตรวจลิงก์หรือเลขที่พิมพ์มาอีกครั้ง — ไม่ใช่เรื่องที่ ZORT ล่ม',
      raw,
    }
  }

  if (d?.unknown) {
    return {
      kind: 'unknown',
      title: 'ยังไม่รู้ว่ามีใบนี้หรือไม่',
      text: 'ติดต่อ ZORT ไม่ได้ หรืออ่านคำตอบไม่ออก ⇒ ยังตอบไม่ได้ว่าใบนี้มีอยู่หรือไม่',
      next: 'ลองใหม่อีกครั้ง · ถ้ายังเหมือนเดิมให้แจ้งทีม — อย่าเพิ่งสรุปว่าไม่มีใบนี้',
      raw,
    }
  }

  /* ZORT ตอบแล้วแต่ไม่ส่งใบ — รวมกรณีที่ท่อบอกสถานะมา และกรณีที่บอกแค่ว่าหาหัวใบไม่เจอ
     🔴 คำต้องเปิดไว้สองทาง ห้ามฟันว่า "ไม่มีใบนี้" */
  const hasZortInfo = d?.zortStatus !== undefined && d?.zortStatus !== null
  const looksRefused = hasZortInfo || (raw?.includes('ZORT') ?? false)
  if (looksRefused) {
    const bits = [
      hasZortInfo ? `ZORT ตอบสถานะ ${String(d?.zortStatus)}` : null,
      d?.zortCode != null ? `resCode ${String(d.zortCode)}` : null,
      d?.zortDesc ? `“${d.zortDesc}”` : null,
    ].filter(Boolean)
    return {
      kind: 'zortRefused',
      title: 'ZORT ไม่ส่งใบนี้ให้',
      text: `ZORT ตอบกลับมาแล้ว แต่ไม่ได้ส่งข้อมูลใบนี้มา${bits.length ? ` (${bits.join(' · ')})` : ''}`,
      next: 'อาจพิมพ์เลขผิด หรือไม่มีใบนี้ — ยังสรุปไม่ได้ว่าไม่มี เพราะยังไม่เคยพิสูจน์ว่า ZORT ตอบแบบนี้เฉพาะตอนไม่มีใบ',
      raw,
    }
  }

  return {
    kind: 'other',
    title: 'ดึงใบนี้ไม่สำเร็จ',
    text: raw ?? (httpStatus ? `ท่อตอบ HTTP ${httpStatus}` : 'ไม่รู้สาเหตุ'),
    next: 'ลองใหม่อีกครั้ง — ยังไม่รู้ว่าใบนี้มีอยู่หรือไม่',
    raw,
  }
}
