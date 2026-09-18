/* เกณฑ์เตือนแบนด์วิดท์ Netlify — แยกออกมาเป็นฟังก์ชันล้วนเพื่อ **ป้อนค่าปลอมให้มันร้องได้**
 *
 * 🔴 **ที่มา 18 ก.ย. 2569 — CEO ตั้งโจทย์หลังเว็บล่มเพราะเครดิตหมด**
 *    *"ตัวที่ทำหน้าที่เตือน ต้องพิสูจน์ว่ามันเคยเตือนได้จริง ไม่ใช่พิสูจน์ว่ามีตัวเตือนอยู่"*
 *    ⇒ ตอนไปดูของจริงพบว่า การ์ดแบนด์วิดท์ที่จอ /core/usage **ไม่มีเกณฑ์เตือนอยู่เลยแม้แต่อันเดียว**
 *      มันแค่พิมพ์ตัวเลขออกมา (และพิมพ์ผิดด้วย — อ่านคีย์ที่ท่อไม่ได้ส่ง เลยขึ้น "ใช้ไป 0" ตลอด)
 *      ⇒ วันที่เครดิตหมดจริง จอนี้จึงเงียบสนิท ทั้งที่เป็นจอที่ทั้งทีมเชื่อว่าเป็นตาข่าย
 *
 * ⚠️ **"ยังไม่รู้" ห้ามกลายเป็น "ปกติ"** — ถ้าไม่รู้โควตา (`includedGB` ไม่มา/เป็น 0)
 *    จะคิดเปอร์เซ็นต์ไม่ได้ ⇒ ต้องคืน `unknown` **ห้ามคืน ok** เพราะเขียวโดยไม่ได้ตรวจ
 *    คือสิ่งเดียวกับที่ทำให้เราไม่รู้ตัวรอบนี้
 */

export type ระดับเตือน = 'unknown' | 'ok' | 'watch' | 'warn' | 'over'

export interface ผลเตือน {
  level: ระดับเตือน
  /** เปอร์เซ็นต์ที่ใช้ไป · `null` = คิดไม่ได้ (ไม่รู้โควตา) — **ไม่ใช่ 0** */
  pct: number | null
  /** ข้อความที่ต้องขึ้นจอ — เขียนให้คนอ่านแล้วรู้ว่าต้องทำอะไรต่อ */
  ข้อความ: string
}

/** เกณฑ์ (เปอร์เซ็นต์ของโควตารอบบิล) — แก้ที่นี่ที่เดียว และเทสอ่านค่าจากตัวนี้ ไม่ใช่เขียนเลขซ้ำ */
export const เกณฑ์ = { watch: 75, warn: 90, over: 100 }

export function bandwidthAlert(b?: { usedGB?: number; includedGB?: number } | null): ผลเตือน {
  const used = typeof b?.usedGB === 'number' && Number.isFinite(b.usedGB) ? b.usedGB : null
  const inc = typeof b?.includedGB === 'number' && Number.isFinite(b.includedGB) ? b.includedGB : null
  if (used === null) {
    return { level: 'unknown', pct: null, ข้อความ: 'ยังไม่รู้ยอดแบนด์วิดท์รอบนี้ — ท่อไม่ได้ส่งมา (ไม่ใช่ว่าใช้ไป 0)' }
  }
  if (inc === null || inc <= 0) {
    return {
      level: 'unknown', pct: null,
      ข้อความ: `ใช้ไป ${used} GB แต่ยังไม่รู้โควตาของแพ็กเกจ ⇒ บอกไม่ได้ว่าใกล้เต็มหรือยัง`,
    }
  }
  const pct = Math.round((used / inc) * 1000) / 10
  if (pct >= เกณฑ์.over) {
    return { level: 'over', pct, ข้อความ: `เกินโควตารอบบิลแล้ว (${pct}%) — เว็บมีสิทธิ์ถูกปิดชั่วคราว ต้องแจ้งท่านประธานทันที` }
  }
  if (pct >= เกณฑ์.warn) {
    return { level: 'warn', pct, ข้อความ: `ใช้ไป ${pct}% ของโควตารอบบิล — ใกล้เต็ม ให้ชะลอการ deploy และแจ้งท่านประธาน` }
  }
  if (pct >= เกณฑ์.watch) {
    return { level: 'watch', pct, ข้อความ: `ใช้ไป ${pct}% ของโควตารอบบิล — เริ่มต้องจับตา` }
  }
  return { level: 'ok', pct, ข้อความ: `ใช้ไป ${pct}% ของโควตารอบบิล` }
}

/* ── เครดิต Netlify ────────────────────────────────────────────────────
   🔴 **CEO สั่งย้ายเกณฑ์มาไว้ที่นี่ 18 ก.ย. 2569** เพราะเครดิตคือตัวที่ทำให้เว็บล่มจริง
      (แบนด์วิดท์เป็นแค่ตัวขับเคลื่อนตัวหนึ่ง · นาที build ไม่มีเพดานจาก Netlify ⇒ คิด % ไม่ได้)

   ⚠️ **สามกับดักของเส้นนี้ ฝั่งท่อเขียนเตือนไว้เองใน netlify-credits.mjs:**
   1. ไม่มีคีย์เลย = **อ่านไม่ได้** ไม่ใช่ "ใช้ไป 0"
      (5 ก.ย. 2569 เคยรายงานว่า "ใช้ไป 0 เหลือ 15,000" อย่างมั่นใจ ทั้งที่ชั่วโมงก่อนอ่านได้ 7,099
       ⇒ ถ้าเชื่อจะนึกว่าเครดิตรีเซ็ตแล้ว deploy ได้ตามสบาย ซึ่งตรงข้ามกับความจริง)
   2. `stale: true` = ค่าที่อ่านได้ครั้งล่าสุด **ไม่ใช่ค่าสด** ⇒ จอต้องเขียนกำกับ ห้ามโชว์เหมือนของสด
   3. `plan` มีค่า default 5000 ฝังในโค้ดท่อ ⇒ ถ้า Netlify ไม่ส่ง `plan_credits` มา
      จอจะได้ 5000 ที่ **ไม่มีใครยืนยัน** ⇒ รองรับธง `planConfirmed` ไว้ล่วงหน้า
      (ฝั่งท่อจะเพิ่มให้ · จนกว่าจะมี ให้ถือว่า "ยังไม่ยืนยัน" และเขียนบอกบนจอ) */

export interface ข้อมูลเครดิต {
  plan?: number
  used?: number
  left?: number
  /** ท่อยืนยันเพดานจาก Netlify จริงไหม — ไม่มีธง = ยังไม่ยืนยัน (ค่า default 5000 ของท่อ) */
  planConfirmed?: boolean
  /** ค่านี้เป็นของเก่าที่อ่านได้ครั้งล่าสุด ไม่ใช่ค่าสด */
  stale?: boolean
  /** ท่อบอกเองว่าอ่านไม่ได้ */
  unknown?: boolean
  off?: boolean
}

export interface ผลเตือนเครดิต extends ผลเตือน {
  /** เหลือกี่เครดิต · null = ไม่รู้ */
  left: number | null
  /** ต้องเขียนกำกับบนจอว่าค่านี้ไม่ใช่ของสด */
  stale: boolean
  /** เพดานที่ใช้คิด % ได้รับการยืนยันจาก Netlify หรือเป็นค่า default ของท่อ */
  planConfirmed: boolean
}

export function creditAlert(c?: ข้อมูลเครดิต | null): ผลเตือนเครดิต {
  const stale = c?.stale === true
  const ฐาน = { left: null as number | null, stale, planConfirmed: c?.planConfirmed === true }
  if (c?.off) return { ...ฐาน, level: 'unknown', pct: null, ข้อความ: 'ยังไม่ได้ตั้งคีย์อ่านเครดิต — จอนี้ยังไม่ได้เฝ้าอะไรเลย' }
  if (c?.unknown) return { ...ฐาน, level: 'unknown', pct: null, ข้อความ: 'อ่านเครดิตไม่ได้รอบนี้ — ไม่ได้แปลว่าเครดิตหมด แปลว่ายังไม่รู้' }
  const used = typeof c?.used === 'number' && Number.isFinite(c.used) ? c.used : null
  const plan = typeof c?.plan === 'number' && Number.isFinite(c.plan) && c.plan > 0 ? c.plan : null
  const left = typeof c?.left === 'number' && Number.isFinite(c.left) ? c.left : null
  if (used === null || plan === null) {
    return { ...ฐาน, left, level: 'unknown', pct: null, ข้อความ: 'อ่านเครดิตไม่ได้รอบนี้ — ไม่ได้แปลว่าเครดิตหมด แปลว่ายังไม่รู้' }
  }
  const pct = Math.round((used / plan) * 1000) / 10
  const เหลือ = left === null ? plan - used : left
  const คำท้าย = stale ? ' ⚠️ ค่านี้ไม่ใช่ของสด เป็นค่าที่อ่านได้ครั้งล่าสุด' : ''
  const base = { ...ฐาน, left: เหลือ, pct }
  if (pct >= เกณฑ์.over) {
    return { ...base, level: 'over', ข้อความ: `เครดิตหมดแล้ว (ใช้ไป ${pct}% ของ ${plan}) — deploy จะไม่ทำงาน ต้องแจ้งท่านประธานทันที${คำท้าย}` }
  }
  if (pct >= เกณฑ์.warn) {
    return { ...base, level: 'warn', ข้อความ: `เครดิตเหลือ ${เหลือ} จาก ${plan} (ใช้ไป ${pct}%) — ให้หยุดรวบ deploy และแจ้งท่านประธาน${คำท้าย}` }
  }
  if (pct >= เกณฑ์.watch) {
    return { ...base, level: 'watch', ข้อความ: `เครดิตเหลือ ${เหลือ} จาก ${plan} (ใช้ไป ${pct}%) — เริ่มต้องจับตา รวบงานต่อหนึ่ง deploy${คำท้าย}` }
  }
  return { ...base, level: 'ok', ข้อความ: `เครดิตเหลือ ${เหลือ} จาก ${plan} (ใช้ไป ${pct}%)${คำท้าย}` }
}
