/* 🧭 สถานะรายขาของผังการอัปเดตสต็อก — ใบสั่ง 22 ต.ค. 13:30 ท่านประธาน "ทำให้มันออโต้ · วางระบบครั้งเดียวจบ"
 * กติกา: ทุกขาต้อง **เดินเองแล้วรายงานเอง** หรือ **พังแล้วฟ้องเอง** — ไม่มีคำว่า "ตรวจด้วยมือ" เหลือ
 *
 * ทางเดิน: ตัวงานบน g1 เขียน ~/claude-shared/สถานะ-<ขา>.json {เมื่อ, ผล, รายละเอียด, รอบนาที}
 *          → ~/bin/flow_status_upload.py (ทุก 5 นาที) POST /api/flow-status-upload → Blob ที่นี่
 *          → จอ /core/registry อ่าน /api/flow-status
 * 🔴 จอบน Netlify อ่านไฟล์ g1 ตรงไม่ได้ ⇒ ต้องมีตัวส่ง · ตัวส่งตายเอง ⇒ ทุกขาเก่าพร้อมกัน ⇒ จอแดงทุกขา (ไม่ใช่เขียวค้าง)
 * 🔑 "เก่า" ตัดสินที่ **จอ** จากเวลาที่ตัวงานจดเอง (ไม่ใช่เวลาที่อัปโหลด) — ตัวส่งที่ยังวิ่งแต่ตัวงานตายต้องแดง */
import { getStore } from '@netlify/blobs'

export type ผลขา = 'ok' | 'warn' | 'bad'
export interface รายงานขา { เมื่อ: string; ผล: ผลขา; รายละเอียด: string; รอบนาที: number }
export interface ก้อนสถานะ { ขา: Record<string, รายงานขา>; อัปโหลดเมื่อ: string }

const STORE = 'flow-status'
/* 🔴 Next แพตช์ fetch ให้แคชได้ — คลาสเดียวกับที่เจอตอนซ้อมขาชีท 22 ต.ค. (GET ของ blobs ถูกแคช
   ทั้งที่ route เป็น force-dynamic) ⇒ บังคับ no-store ที่ client ตรง ๆ */
const fetchสด: typeof fetch = (u, init) => fetch(u, { ...init, cache: 'no-store' })
const ร้านสด = () => getStore({ name: STORE, fetch: fetchสด })

/** ตรวจรูปก่อนเก็บ — ของผิดรูปไม่เก็บ (ไม่งั้นจอจะขึ้นค่าแปลก ๆ แทนที่จะแดง) */
export function ตรวจรูป(x: unknown): { ok: true; ขา: Record<string, รายงานขา> } | { ok: false; เหตุ: string } {
  const ขา = (x as { ขา?: unknown })?.ขา
  if (!ขา || typeof ขา !== 'object' || Array.isArray(ขา)) return { ok: false, เหตุ: 'ต้องมีช่อง ขา เป็นก้อน' }
  const ออก: Record<string, รายงานขา> = {}
  for (const [ชื่อ, v] of Object.entries(ขา as Record<string, any>)) {
    // ชื่อขา: ไทย/อังกฤษ/เลข/ขีด ยาว 1-60 — ไม่ใช้ธง u (target ของรีโปยัง es5) จึงระบุช่วงอักษรไทยตรง ๆ
    if (!/^[A-Za-z0-9ก-๙_-]{1,60}$/.test(ชื่อ)) return { ok: false, เหตุ: `ชื่อขาไม่ถูกรูป: ${ชื่อ.slice(0, 40)}` }
    if (!v || typeof v.เมื่อ !== 'string' || !Number.isFinite(Date.parse(v.เมื่อ))) return { ok: false, เหตุ: `${ชื่อ}: เมื่อ อ่านไม่ได้` }
    if (!['ok', 'warn', 'bad'].includes(v.ผล)) return { ok: false, เหตุ: `${ชื่อ}: ผล ต้องเป็น ok/warn/bad` }
    if (!(Number(v.รอบนาที) > 0)) return { ok: false, เหตุ: `${ชื่อ}: รอบนาที ต้องมากกว่า 0` }
    ออก[ชื่อ] = { เมื่อ: v.เมื่อ, ผล: v.ผล, รายละเอียด: String(v.รายละเอียด ?? '').slice(0, 600), รอบนาที: Number(v.รอบนาที) }
  }
  return { ok: true, ขา: ออก }
}

/** เงียบเกิน 2 เท่าของรอบตัวเอง = ตาย (ใบสั่ง: "เก่ากว่า 2× รอบของมัน ⇒ แดง") */
export function เงียบเกิน(r: รายงานขา, ตอนนี้: number): boolean {
  return ตอนนี้ - Date.parse(r.เมื่อ) > 2 * r.รอบนาที * 60_000
}

export async function เก็บ(ขา: Record<string, รายงานขา>) {
  const s = ร้านสด()
  const เดิม = ((await s.get('legs', { type: 'json' }).catch(() => null)) as ก้อนสถานะ | null)?.ขา ?? {}
  // รวมกับของเดิม — ขาที่รอบนี้ไม่ส่งมายังอยู่ แล้วจะเก่าเองจนแดง (ไม่หายเงียบ)
  const ก้อน: ก้อนสถานะ = { ขา: { ...เดิม, ...ขา }, อัปโหลดเมื่อ: new Date().toISOString() }
  await s.setJSON('legs', ก้อน)
  return ก้อน
}

export async function อ่าน(): Promise<ก้อนสถานะ | null> {
  return ((await ร้านสด().get('legs', { type: 'json' }).catch(() => null)) as ก้อนสถานะ | null) ?? null
}
