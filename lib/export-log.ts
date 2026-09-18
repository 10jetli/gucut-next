// ── สมุดบันทึกการส่งออกไฟล์ — ท่านประธานขอไว้ 18 ก.ย. 2569 ────────────────────────
//
// คำของท่าน (ตอนอนุมัติให้ส่งออก Excel ได้ทุกจอ รวมจอผู้ติดต่อที่มีข้อมูลลูกค้า):
//   *"ถ้าทำได้ ขอให้จดไว้ด้วยว่าใครกดส่งออกจอไหน เมื่อไหร่ ได้กี่แถว
//     ในที่ที่ผมเปิดดูได้ วันหนึ่งถ้ามีคนถามว่าข้อมูลลูกค้าหลุดจากไหน จะได้ตอบได้"*
//
// 🔑 **คำถามที่สมุดนี้ต้องตอบให้ได้จริง** คือ "ใครเอาข้อมูลลูกค้าออกไป"
//    ⇒ ของที่ต้องจดคือ **คน · จอ · เวลา · จำนวนแถว** เท่านั้น
//
// 🔒 **ห้ามจดเนื้อข้อมูล** — ไม่มีชื่อลูกค้า ไม่มีเบอร์ ไม่มีที่อยู่ ไม่มีเลขที่เอกสาร
//    เพราะสมุดที่ไว้สืบเรื่องข้อมูลรั่ว **ต้องไม่กลายเป็นที่รั่วเสียเอง**
//    (กติกาเดียวกับ lib/rokid-log.ts ที่เก็บแต่ข้อความ ไม่เก็บเสียง)
//
// ⚠️ **ตัวจดห้ามทำให้งานหลักพัง** — Blobs ล่ม/ยังไม่ได้ตั้งค่า = ข้ามเงียบ ๆ
//    ไฟล์ถึงมือผู้ใช้แล้วตอนเรียกตัวนี้ · จดไม่ได้ ไม่ใช่เหตุให้บอกว่าส่งออกไม่สำเร็จ
//
// ⚠️ **หนึ่งครั้ง = หนึ่งคีย์** ห้ามอ่านก้อนเดียวมาต่อท้ายแล้วเขียนกลับ
//    (สองคนกดพร้อมกันแล้วบันทึกหายเงียบ ๆ — บทเรียนเดิมของตัวนับคนเข้าเว็บ)
import { getStore } from '@netlify/blobs'

const STORE = 'gucut-export-log'
/** เก็บ 180 วัน — ยาวกว่า rokid-log เพราะคำถาม "ข้อมูลหลุดจากไหน" มักมาช้าเป็นเดือน */
const KEEP_DAYS = 180
const MAX_TEXT = 120

export interface ExportLogEntry {
  /** เวลา UTC เสมอ — จอเป็นคนบวก +7 (กติกาเวลาของโปรเจกต์) */
  at: string
  /** ชื่อผู้ใช้ตามที่ล็อกอินมา · 'แอดมิน' = เข้าด้วยรหัสหลักของร้าน (แยกตัวคนไม่ได้)
   *  🔴 **ห้ามเขียนว่าเป็นคนใดคนหนึ่งเมื่อแยกไม่ได้** — รหัสหลักใช้ร่วมกันหลายคน */
  who: string
  /** ชื่อจอตามที่ผู้ใช้เห็น เช่น "ผู้ติดต่อ" */
  screen: string
  /** ขอบเขตที่กดส่งออก เช่น "ลูกค้า · ช่วง 01/09–18/09" */
  scope?: string | null
  /** ได้กี่แถว — ไฟล์ที่ไม่ครบไม่ออกอยู่แล้ว เลขนี้จึงเป็นจำนวนแถวที่ออกไปจริง */
  rows: number
}

const clip = (s: unknown) => String(s ?? '').slice(0, MAX_TEXT)

/** คีย์ขึ้นต้นด้วยเวลา ⇒ list มาแล้วเรียงได้เลย และดูวันหมดอายุจากชื่อคีย์ได้ไม่ต้องเปิดไฟล์ */
const keyFor = (at: string) => `e/${at}-${Math.random().toString(36).slice(2, 8)}`

function store() {
  try {
    return getStore(STORE)
  } catch {
    return null
  }
}

/** จดหนึ่งบรรทัด · คืน true เมื่อจดได้จริง — **ห้ามโยน error ออกไป** */
export async function logExport(e: ExportLogEntry): Promise<boolean> {
  const s = store()
  if (!s) return false
  try {
    await s.setJSON(keyFor(e.at), {
      at: e.at,
      who: clip(e.who),
      screen: clip(e.screen),
      scope: e.scope ? clip(e.scope) : null,
      rows: Number.isFinite(e.rows) ? Math.max(0, Math.trunc(e.rows)) : 0,
    })
    return true
  } catch {
    return false
  }
}

/** อ่านย้อนหลัง (ใหม่ก่อน) — ใช้โดยเส้น GET ที่ให้เฉพาะแอดมินเท่านั้น
 *  ⚠️ คืน `null` เมื่อ **อ่านไม่ได้** ซึ่งคนละเรื่องกับ "ไม่มีบันทึก" (กฎสามสถานะ) */
export async function readExportLog(limit = 200): Promise<ExportLogEntry[] | null> {
  const s = store()
  if (!s) return null
  try {
    const { blobs } = await s.list({ prefix: 'e/' })
    const now = Date.now()
    const keys = blobs
      .map((b) => b.key)
      .filter((k) => {
        const t = Date.parse(k.slice(2, 26))
        /* อ่านวันไม่ออก = **เก็บไว้** ไม่ใช่ทิ้ง — ของที่เราอ่านไม่ออกห้ามหายเงียบ */
        return Number.isNaN(t) || now - t < KEEP_DAYS * 86400_000
      })
      .sort()
      .reverse()
      .slice(0, limit)
    const out: ExportLogEntry[] = []
    for (const k of keys) {
      // eslint-disable-next-line no-await-in-loop
      const v = (await s.get(k, { type: 'json' })) as ExportLogEntry | null
      if (v) out.push(v)
    }
    return out
  } catch {
    return null
  }
}
