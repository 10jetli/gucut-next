/* 🤖 สถานะของตัวเก็บบิลที่ **รันเป็นสคริปต์บน g1** — อ่านจาก ping.gucut.com (15 ต.ค. 2569)
 *
 * 🔴 ที่มา: หน้า /bills ขึ้นว่าทุกเจ้า "ไม่ได้สแกนมา 13 วัน" แต่ของจริงคืนก่อน
 *    meta · tiktok · adobe · cloudflare ทำงานปกติ (meta เจอบิลใหม่ด้วย)
 *    เหตุ: หน้าตัดสินด้วย `lastScan` ในดัชนี ซึ่ง **มีแต่ทางเมล (`/api/bills/vendor`) ที่เขียน**
 *    เจ้าที่เก็บด้วยสคริปต์ยิงเข้า `/api/bills/upload` ซึ่ง **ไม่แตะ lastScan**
 *    ⇒ 6 เจ้านั้นจะขึ้น "ไม่ได้สแกน N วัน" ตลอดกาล ต่อให้ทำงานดีแค่ไหน
 *
 * 🔑 ทำไมเลือก "อ่านสถานะจาก g1" แทน "ให้ /api/bills/upload เขียน lastScan":
 *    `upload` ถูกเรียก **เฉพาะตอนเจอบิล** ⇒ คืนที่สคริปต์สแกนแล้วไม่เจอบิลใหม่ lastScan จะไม่ขยับ
 *    ⇒ ป้ายยังโกหกต่อ (คนละทาง) · และ `AUTH_REQUIRED` (ต้องล็อกอิน) **ไม่มีทางไหลผ่าน upload เลย**
 *    ⇒ แหล่งเดียวที่รู้ทั้ง "สแกนเมื่อไหร่" และ "สแกนได้ไหม" คือไฟล์สถานะบน g1 เอง
 *
 * ⚠️ สามสถานะเสมอ: อ่าน g1 ไม่ได้ ⇒ **"ไม่รู้"** ห้ามกลายเป็น "ปกติ" (ไม่รู้ ≠ ไม่มีปัญหา)
 */

const PING = 'https://ping.gucut.com'
/* 🔴 ต้องใส่ User-Agent เอง — ด่านหน้าเว็บบล็อก UA ของสคริปต์ด้วย 403 ซึ่งหน้าตาเหมือนคีย์ผิดเป๊ะ
      (เจอจริง 14 ต.ค. 2569 กับ urllib ⇒ fetch ของ Node ก็มี UA ของตัวเองที่โดนได้เหมือนกัน) */
const UA = 'Mozilla/5.0 (gucut-next; bills-status)'

export interface รายงานจากg1 {
  status: string
  at: string          // 'YYYY-MM-DD HH:MM:SS' เวลาไทย (เครื่อง g1 ตั้ง +07 — เทียบกับ epoch ของรอบแล้วตรงกัน)
  detail?: string
  ใหม่?: number
}
export interface รอบกวาด {
  สถานะ: string
  กำลังทำ: string | null
  ทำไปแล้ว: number
  ทั้งหมด: number
  เมื่อ?: number
}
export type ผลอ่านg1 =
  | { ok: true; รอบกวาด: รอบกวาด | null; รายเจ้า: Record<string, รายงานจากg1> }
  | { ok: false; เหตุ: string }

function คีย์(): string | null {
  return process.env.GUCUT_WEB_ADMIN_KEY || null
}

/* 🔑 "ไม่มีคีย์" กับ "คีย์ไม่ตรง" ต้องเป็นคนละข้อความ (CEO ขอ 15 ต.ค. 2569)
      ไม่มีคีย์ = env ของเว็บนี้ไม่ได้ตั้ง (แก้ที่ Netlify) · คีย์ไม่ตรง = g1 ตอบ 401/403 (แก้ที่ค่าของคีย์สองฝั่ง)
      ⚠️ 403 ยังอาจมาจากด่านหน้าเว็บที่บล็อก User-Agent ได้ด้วย ⇒ เขียนไว้ทั้งสองทาง ไม่ฟันธง */
export function เหตุจากรหัสg1(status: number): string {
  if (status === 401 || status === 403) {
    return `g1 ปฏิเสธคีย์ (HTTP ${status}) — เว็บนี้มีคีย์ แต่ค่าไม่ตรงกับที่ g1 รู้จัก (หรือด่านหน้าเว็บบล็อกคำขอ)`
  }
  return `g1 ตอบ HTTP ${status}`
}

/** อ่านช่อง "บิล" จาก ping.gucut.com · ล้มเหลว ⇒ คืนเหตุ ไม่โยนทิ้ง */
export async function อ่านสถานะบิลบนg1(): Promise<ผลอ่านg1> {
  const k = คีย์()
  if (!k) return { ok: false, เหตุ: 'เซิร์ฟเวอร์ไม่มีคีย์สำหรับถาม g1 (ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY)' }
  try {
    const r = await fetch(`${PING}/`, {
      headers: { 'x-admin-key': k, 'user-agent': UA },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return { ok: false, เหตุ: เหตุจากรหัสg1(r.status) }
    const j = await r.json()
    const บิล = j?.['บิล']
    /* 🔑 ไม่มีช่อง "บิล" = ได้คำตอบแบบตัดทอน (ไม่มีคีย์หรือคีย์ไม่ผ่าน) ⇒ "ไม่รู้" ไม่ใช่ "ไม่มีเจ้า" */
    if (!บิล || typeof บิล !== 'object') return { ok: false, เหตุ: 'g1 ไม่ส่งช่อง "บิล" มา (คำตอบถูกตัดทอน)' }
    return { ok: true, รอบกวาด: บิล['รอบกวาด'] ?? null, รายเจ้า: บิล['รายเจ้า'] ?? {} }
  } catch (e) {
    return { ok: false, เหตุ: `ถาม g1 ไม่ได้: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** สั่งกวาดบิล 6 เจ้าบน g1 — g1 ตอบทันทีแล้วทำต่อเบื้องหลัง (ทีละเจ้า โดยตั้งใจ) */
export async function สั่งกวาดบิลบนg1(): Promise<{ ok: boolean; ข้อความ: string; สถานะ: number }> {
  const k = คีย์()
  if (!k) return { ok: false, ข้อความ: 'เซิร์ฟเวอร์ไม่มีคีย์สำหรับสั่ง g1 (ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY)', สถานะ: 0 }
  try {
    const r = await fetch(`${PING}/bills-run`, {
      method: 'POST',
      headers: { 'x-admin-key': k, 'user-agent': UA, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20000),
    })
    const j = await r.json().catch(() => ({}))
    const ok = r.ok && j?.ok !== false
    return { ok, ข้อความ: ok ? String(j?.msg ?? 'เริ่มแล้ว') : (r.ok ? String(j?.msg ?? j?.error ?? 'g1 ปฏิเสธ') : เหตุจากรหัสg1(r.status)), สถานะ: r.status }
  } catch (e) {
    return { ok: false, ข้อความ: `สั่ง g1 ไม่ได้: ${e instanceof Error ? e.message : String(e)}`, สถานะ: 0 }
  }
}

export type สถานะเจ้า = 'ปกติ' | 'ควรมาดู' | 'อัปมือ' | 'ต้องล็อกอิน' | 'ไม่รู้'

/** แปลง 'YYYY-MM-DD HH:MM:SS' (เวลาไทย) ⇒ ISO · อ่านไม่ออก ⇒ null (ไม่เดา) */
export function เวลาg1เป็นISO(at: unknown): string | null {
  if (typeof at !== 'string') return null
  const m = at.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/)
  if (!m) return null
  const t = Date.parse(`${m[1]}T${m[2]}+07:00`)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** รายงานล่าสุดเก่ากว่านี้ ⇒ ตัวเก็บน่าจะไม่ได้รัน (สคริปต์รันทุกคืน ⇒ เผื่อพลาดหนึ่งคืน) */
export const ชั่วโมงที่ถือว่าเงียบ = 48

/** ตัดสินสถานะของเจ้าที่เก็บด้วยสคริปต์ — **ฟังก์ชันล้วน** เทสเรียกตัวเดียวกับที่ route ใช้ */
export function สถานะจากg1(
  vendorId: string,
  g1: ผลอ่านg1,
  nowMs: number = Date.now(),
): { สถานะ: สถานะเจ้า; เหตุ: string; สแกนล่าสุด: string | null } {
  if (!g1.ok) return { สถานะ: 'ไม่รู้', เหตุ: `อ่านสถานะจาก g1 ไม่ได้ — ${g1.เหตุ}`, สแกนล่าสุด: null }
  const r = g1.รายเจ้า[vendorId]
  if (!r) return { สถานะ: 'ไม่รู้', เหตุ: 'ตัวเก็บบน g1 ยังไม่เคยรายงานเจ้านี้', สแกนล่าสุด: null }
  const iso = เวลาg1เป็นISO(r.at)
  const detail = r.detail ? String(r.detail) : ''
  if (r.status === 'AUTH_REQUIRED') {
    return { สถานะ: 'ต้องล็อกอิน', เหตุ: detail || 'เซสชันหมดอายุ — ท่านประธานต้องล็อกอินใหม่', สแกนล่าสุด: iso }
  }
  if (r.status !== 'OK') {
    return { สถานะ: 'ควรมาดู', เหตุ: `${r.status}${detail ? `: ${detail}` : ''}`, สแกนล่าสุด: iso }
  }
  if (!iso) return { สถานะ: 'ไม่รู้', เหตุ: `อ่านเวลาที่ g1 รายงานไม่ออก (${String(r.at)})`, สแกนล่าสุด: null }
  const ชม = (nowMs - Date.parse(iso)) / 3600e3
  if (ชม > ชั่วโมงที่ถือว่าเงียบ) {
    return { สถานะ: 'ควรมาดู', เหตุ: `g1 รายงานล่าสุดเมื่อ ${Math.floor(ชม / 24)} วันก่อน — ตัวเก็บอาจไม่ได้รัน`, สแกนล่าสุด: iso }
  }
  /* OK ⇒ "ปกติ" และ **ไม่ใส่เหตุ** (detail ไปแสดงในแผงผลของปุ่มแทน) — ป้ายเหลืองมีไว้สำหรับเรื่องที่ต้องทำอะไร */
  return { สถานะ: 'ปกติ', เหตุ: '', สแกนล่าสุด: iso }
}
