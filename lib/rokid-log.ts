// บันทึกบทสนทนาที่วิ่งผ่านสะพานแว่น Rokid — เจ้าของร้านสั่งเอง 9 ก.ย. 2569 ("ควรเก็บบันทึกไว้")
//
// **ทำไมต้องมี**: สิ่งที่พูดใส่แว่นกับสิ่งที่แว่นตอบ ไม่มีใครนอกจากคนใส่แว่นที่เห็น
// ตลอดวันที่ 9 ก.ย. เราไล่บั๊กด้วยการให้เจ้าของร้านถ่ายรูปเลนส์กับวาดรูปมาให้ดู
// ⇒ ช้ามาก และ **มองไม่เห็นสิ่งที่สำคัญที่สุด: ตัวแปลงเสียงได้ยินว่าอะไร**
//    (พูดชัดแต่ถอดเสียงผิด = เราจะไล่โทษเซิร์ฟเวอร์ทั้งวันโดยที่ต้นเหตุอยู่ที่ไมค์)
//
// 🔒 **กติกาความเป็นส่วนตัวที่เจ้าของร้านตกลงไว้ — ห้ามถอดข้อใดข้อหนึ่ง**
//   1. เก็บ **ข้อความเท่านั้น ไม่เก็บไฟล์เสียง**
//   2. **เก็บ 7 วันแล้วลบอัตโนมัติ** (กติกาเดียวกับรูปบัตรที่ /permit/ และลิงก์ย่อ)
//   3. ดูได้เฉพาะผู้ที่ผ่านด่านรหัสหลังร้าน
//   4. **ห้ามส่งเข้า Telegram ห้าม console.log** — เหมือนข้อมูลบัตรประชาชน
//   5. **ห้ามบันทึกกุญแจ** ไม่ว่าจะของสะพานหรือของ Anthropic
//
// ⚠️ **หนึ่งบทสนทนา = หนึ่งคีย์** ห้ามเปลี่ยนไปอ่านก้อนเดียวมาต่อท้ายแล้วเขียนกลับ
//    (กติกาเดียวกับตัวนับคนเข้าเว็บ/ลงเวลาพนักงาน) ถึงตอนนี้จะมีผู้ใช้คนเดียว
//    แต่วันที่มีแว่นสองตัวหรือกดรัว ๆ บันทึกจะหายเงียบ ๆ โดยไม่มีอะไรฟ้อง
//
// ⚠️ **ตัวบันทึกห้ามทำให้คำตอบพัง** — Blobs ล่ม/ยังไม่ได้ตั้งค่า = ข้ามเงียบ ๆ
//    ไม่มีบันทึก ดีกว่าแว่นตอบไม่ได้

import { getStore } from '@netlify/blobs'

const STORE = 'rokid-log'
const KEEP_DAYS = 7
const MAX_TEXT = 2000 // กันข้อความยาวผิดปกติมาทำให้ blob บวม

export interface RokidLogEntry {
  /** เวลาที่ตอบเสร็จ — เก็บ UTC เสมอ จอเป็นคนบวก +7 (ดูกติกาเวลาใน CLAUDE.md) */
  at: string
  question: string
  answer: string
  model: string
  /** เวลาที่ใช้ทั้งคำขอ (มิลลิวินาที) — ตัวเลขที่ใช้ตัดสินว่าทันเพดานของแว่นไหม */
  ms: number
  ok: boolean
  error?: string
  /** สตรีมหรือตอบก้อนเดียว — คนละเส้นทางโค้ด ต้องแยกได้เวลาไล่ปัญหา */
  stream: boolean
}

const clip = (s: unknown) => String(s ?? '').slice(0, MAX_TEXT)

/** คีย์เรียงตามเวลาอยู่แล้วเพราะขึ้นต้นด้วย ISO ⇒ list มาแล้ว sort ได้ตรง ๆ */
function keyFor(at: string) {
  return `t/${at}-${Math.random().toString(36).slice(2, 8)}`
}

/** วันที่ในคีย์เก่ากว่า N วันไหม — อ่านจากชื่อคีย์ ไม่ต้องเปิดไฟล์ (ถูกกว่ามาก) */
function isExpired(key: string, now: number) {
  const iso = key.slice(2, 12) // t/YYYY-MM-DD...
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false // อ่านวันไม่ออก = ไม่กล้าลบ
  return now - t > KEEP_DAYS * 86400_000
}

/**
 * บันทึกหนึ่งบทสนทนา
 * ⚠️ ผู้เรียก **ต้อง await** — Netlify แช่แข็งฟังก์ชันทันทีที่ตอบเสร็จ
 *    ปล่อยลอย = ตายกลางทางแบบไม่มี error (กติกาเหล็กใน CLAUDE.md)
 */
export async function logTurn(e: RokidLogEntry): Promise<void> {
  try {
    const store = getStore(STORE)
    await store.setJSON(keyFor(e.at), {
      ...e,
      question: clip(e.question),
      answer: clip(e.answer),
      error: e.error ? clip(e.error) : undefined,
    })
  } catch {
    // เงียบโดยตั้งใจ — ดูหัวไฟล์ข้อ "ตัวบันทึกห้ามทำให้คำตอบพัง"
  }
}

export interface RokidLogPage {
  entries: RokidLogEntry[]
  /** จำนวนที่ลบทิ้งเพราะเกิน 7 วัน — โชว์บนจอเพื่อพิสูจน์ว่าตัวลบทำงานจริง */
  pruned: number
}

/**
 * อ่านบันทึกล่าสุด + เก็บกวาดของเกิน 7 วันไปในตัว
 * (ไม่ต้องตั้งงานตามเวลาเพิ่ม — กติกาเดียวกับ store `gucut-live`)
 */
export async function listTurns(limit = 200): Promise<RokidLogPage> {
  const store = getStore(STORE)
  const { blobs } = await store.list({ prefix: 't/' })
  const now = Date.now()

  const expired = blobs.filter(b => isExpired(b.key, now))
  // ลบทีละใบแต่ห้ามให้ใบที่ลบไม่ได้ทำให้ทั้งหน้าพัง
  await Promise.all(expired.map(b => store.delete(b.key).catch(() => {})))

  const live = blobs
    .filter(b => !isExpired(b.key, now))
    .sort((a, b) => (a.key < b.key ? 1 : -1)) // ใหม่สุดขึ้นก่อน
    .slice(0, limit)

  const entries = (
    await Promise.all(
      live.map(b => store.get(b.key, { type: 'json' }).catch(() => null)),
    )
  ).filter(Boolean) as RokidLogEntry[]

  return { entries, pruned: expired.length }
}
