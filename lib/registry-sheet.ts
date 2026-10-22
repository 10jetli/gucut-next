/* 📥 ขาชีททะเบียน — รับข้อมูลที่ Apps Script ในบัญชีท่านประธาน **ส่งมาเอง** ทุก 15 นาที
 * (เปลี่ยนวิธี 22 ต.ค. 13:39 — เลิก OAuth เพราะ refresh token ของแอปโหมดทดสอบตายทุก 7 วัน ขัด "ครั้งเดียวจบ"
 *  ใช้ท่าเดียวกับ ads-push ของร้านที่พิสูจน์แล้ว: สคริปต์ฝั่ง Google POST เข้ามาพร้อมกุญแจ)
 *
 * 🔴 ชีทเป็นของภรรยาท่าน + เป็นบัญชีตามกฎหมาย ⇒ ฝั่งเรา **ไม่แตะชีทเลย** — สคริปต์อยู่ในบัญชีท่าน
 *    อ่านผ่านสำเนาชั่วคราวของตัวเองแล้วลบทิ้ง (ทางที่ความจำทีมระบุว่าถูก) · ส่งมาเฉพาะหัวคอลัมน์เต็ม
 *    กับคอลัมน์ที่อนุญาต (ยี่ห้อ/ขนาด/รุ่น/วันจำหน่าย) — **ไม่มีซีเรียล ชื่อผู้ซื้อ เลขใบอนุญาต**
 *
 * 🔑 ทางเดินของตัวเลข: ชีท → Apps Script (ทุก 15 นาที) → /api/registry-sheet-push → Blob `latest`
 *    → g1 ดึงไปเขียน เป้าสต็อกทะเบียน.json → ตัวซิงก์ทะเบียน→ZORT ทำต่อ (มีด่านของมันเอง)
 *
 * 🔴 ตาข่าย (ใบสั่ง ③) — ออโต้ที่ผิดจะผิดทุกช่องทางพร้อมกัน:
 *    1. ไม่มีของส่งมา/ผิดรูป ⇒ ไม่แตะ `latest` + ตัวเฝ้า (registry-sheet-pull) จดความเงียบ + เตือน
 *    2. ยอดรหัสไหนลดเกินครึ่ง หรือเหลือ 0 ทั้งที่รอบก่อนมี ⇒ ไม่แตะ `latest` + เตือน (หน้าตาของ "อ่านพลาด")
 *    3. หัวคอลัมน์เปลี่ยนจากที่ล็อกไว้ ⇒ หยุด — กติกานับผูกกับตำแหน่งหัว
 *    4. ยังไม่มีกติกานับที่ยืนยันแล้ว ⇒ **โหมดสำรวจ**: จดแค่หัวคอลัมน์ + จำนวนแถว ไม่ผลิตเป้า
 *    5. ทุกรอบจด log (เวลา · ผล · เหตุ) ⇒ ย้อนดูได้
 */
import { getStore } from '@netlify/blobs'

const STORE = 'registry-sheet'
const เก็บรอบ = 200

export interface แท็บ { ชื่อ: string; แถว: string[][] }

/* ── ตรวจรูปก้อนที่สคริปต์ส่งมา — ของผิดรูปไม่เข้า pipeline (ไม่งั้นจอขึ้นค่าแปลกแทนที่จะแดง) ── */
export function ตรวจรูปแท็บ(x: unknown): { ok: true; แท็บ: แท็บ[]; ชีทแก้ไขล่าสุด?: string } | { ok: false; เหตุ: string } {
  const ก้อน = x as { แท็บ?: unknown; ชีทแก้ไขล่าสุด?: unknown }
  if (!Array.isArray(ก้อน?.แท็บ) || ก้อน.แท็บ.length === 0) return { ok: false, เหตุ: 'ต้องมีช่อง แท็บ เป็นอาร์เรย์อย่างน้อย 1 แท็บ' }
  if (ก้อน.แท็บ.length > 40) return { ok: false, เหตุ: `แท็บ ${ก้อน.แท็บ.length} เยอะผิดปกติ (เพดาน 40)` }
  const ออก: แท็บ[] = []
  for (const t of ก้อน.แท็บ as any[]) {
    if (typeof t?.ชื่อ !== 'string' || !t.ชื่อ.trim()) return { ok: false, เหตุ: 'แท็บไม่มีชื่อ' }
    if (!Array.isArray(t?.แถว)) return { ok: false, เหตุ: `แท็บ "${t.ชื่อ}" ไม่มีช่อง แถว` }
    if (t.แถว.length > 5000) return { ok: false, เหตุ: `แท็บ "${t.ชื่อ}" มี ${t.แถว.length} แถว เยอะผิดปกติ (เพดาน 5000)` }
    const แถว: string[][] = []
    for (const r of t.แถว as any[]) {
      if (!Array.isArray(r) || r.length > 40) return { ok: false, เหตุ: `แท็บ "${t.ชื่อ}" มีแถวที่ไม่ใช่อาร์เรย์ หรือเกิน 40 ช่อง` }
      แถว.push(r.map((c: any) => String(c ?? '').slice(0, 120)))
    }
    ออก.push({ ชื่อ: String(t.ชื่อ).slice(0, 60), แถว })
  }
  const แก้ = typeof ก้อน.ชีทแก้ไขล่าสุด === 'string' && Number.isFinite(Date.parse(ก้อน.ชีทแก้ไขล่าสุด)) ? ก้อน.ชีทแก้ไขล่าสุด : undefined
  return { ok: true, แท็บ: ออก, ชีทแก้ไขล่าสุด: แก้ }
}

/** เทียบกุญแจโดยไม่บอกใบ้ผ่านเวลาที่ใช้ — ท่าเดียวกับ ads-push.mjs ของร้าน */
export function กุญแจตรง(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ── สำรวจหัวคอลัมน์ — 🔴 เก็บแค่แถวหัวกับจำนวน ไม่เก็บแถวข้อมูล ───────────── */
const คำหัว = /ซีเรียล|หมายเลข|ยี่ห้อ|ขนาด|รุ่น|จำหน่าย|วันที่|ลำดับ|ใบอนุญาต|ผู้ซื้อ|รับ/
export interface สำรวจแท็บ { ชื่อ: string; แถวหัว: number | null; หัว: string[]; แถวมีของหลังหัว: number }
/** หาแถวหัว = แถวใน 15 แถวแรกที่มีคำหัวมากที่สุด (อย่างน้อย 2 คำ) — เก็บเฉพาะแถวนั้น */
export function สำรวจ(แท็บทั้งหมด: แท็บ[]): สำรวจแท็บ[] {
  return แท็บทั้งหมด.map((t) => {
    let ดี = -1, คะแนนดี = 1
    t.แถว.slice(0, 15).forEach((r, i) => {
      const k = r.filter((x) => คำหัว.test(x)).length
      if (k > คะแนนดี) { ดี = i; คะแนนดี = k }
    })
    const หัว = ดี >= 0 ? t.แถว[ดี].map((x) => x.slice(0, 40)) : []
    const หลัง = ดี >= 0 ? t.แถว.slice(ดี + 1).filter((r) => r.some((x) => x !== '')).length : 0
    return { ชื่อ: t.ชื่อ, แถวหัว: ดี >= 0 ? ดี + 1 : null, หัว, แถวมีของหลังหัว: หลัง }
  })
}
/** ลายนิ้วมือของรูปแบบเล่ม — เปลี่ยนเมื่อแท็บ/หัวคอลัมน์เปลี่ยน */
export const ลายนิ้วมือ = (ส: สำรวจแท็บ[]) => JSON.stringify(ส.map((x) => [x.ชื่อ, x.แถวหัว, x.หัว]))

/* ── ตาข่ายข้อ 2 — แยกเป็นฟังก์ชันล้วนให้เทสเรียกตัวจริงได้ ──────────────── */
export function ลดฮวบ(เดิม: Record<string, number> | null, ใหม่: Record<string, number>): string[] {
  if (!เดิม) return []
  const ผิด: string[] = []
  for (const [k, ก่อน] of Object.entries(เดิม)) {
    const หลัง = ใหม่[k]
    if (ก่อน > 0 && หลัง === undefined) ผิด.push(`${k}: ${ก่อน} → หายจากผลนับ`)
    else if (ก่อน > 0 && หลัง === 0) ผิด.push(`${k}: ${ก่อน} → 0`)
    else if (ก่อน >= 2 && หลัง !== undefined && หลัง < ก่อน / 2) ผิด.push(`${k}: ${ก่อน} → ${หลัง} (ลดเกินครึ่ง)`)
  }
  return ผิด
}

/* ── รอบหนึ่งรอบ ─────────────────────────────────────────────────────── */
export type สถานะรอบ = 'พร้อม' | 'สำรวจ' | 'หยุด-ลดฮวบ' | 'หยุด-หัวเปลี่ยน' | 'อ่านไม่ได้'
export interface ผลรอบ {
  เมื่อ: string
  สถานะ: สถานะรอบ
  เหตุ?: string
  ชีทแก้ไขล่าสุด?: string
  สำรวจ?: สำรวจแท็บ[]
  stocks?: Record<string, number>
  ลดฮวบ?: string[]
}
export interface ข้อมูลล่าสุด { stocks: Record<string, number>; เมื่อ: string; ชีทแก้ไขล่าสุด?: string }

/** กติกานับแถว → รหัส · ⏳ **ยังไม่มี** จนกว่าจะเห็นหัวคอลัมน์จริงและนับได้ตรงกับที่ CEO ยืนยัน 22 ต.ค.
 *  (185 ชิ้น · บาร์ 132 · เลื่อย 53 · ตรงรายรหัสทั้ง 24 ตัว) ⇒ ระหว่างนี้คืน null = โหมดสำรวจ
 *  🔴 ห้ามเดาหัวคอลัมน์แล้วผลิตเป้า — เป้าผิดไหลไป ZORT และทุกแพลตฟอร์มพร้อมกัน */
export function นับตามกติกา(_แท็บ: แท็บ[]): Record<string, number> | null {
  return null
}

/* 🔴 Next แพตช์ fetch ให้แคชได้ — เจอตอนซ้อม 22 ต.ค.: GET `log` ของ blobs ถูกแคช (route เป็น
   force-dynamic แล้วก็ยังโดน) ⇒ จอโชว์รอบเก่าตลอดกาลทั้งที่ถังขยับแล้ว = จอโกหกแบบไม่มีอะไรฟ้อง
   ⇒ ยัด fetch ที่บังคับ no-store เข้า client ตรง ๆ ไม่พึ่งพฤติกรรมแคชของเฟรมเวิร์กในแต่ละรุ่น */
const fetchสด: typeof fetch = (u, init) => fetch(u, { ...init, cache: 'no-store' })
const ร้าน = () => getStore({ name: STORE, fetch: fetchสด })

/** จดรอบลง log (ใหม่สุดก่อน) — ตัวเฝ้าความเงียบ (registry-sheet-pull.mjs) ก็เขียนรูปเดียวกันนี้ */
export async function จด(ผล: ผลรอบ) {
  const s = ร้าน()
  const เดิม = ((await s.get('log', { type: 'json' }).catch(() => null)) as ผลรอบ[] | null) ?? []
  await s.setJSON('log', [ผล, ...เดิม].slice(0, เก็บรอบ))
  return ผล
}

/** รับก้อนจากสคริปต์หนึ่งรอบ — pipeline ตาข่ายครบ (เรียกจาก /api/registry-sheet-push) */
export async function รับชีท(แท็บทั้งหมด: แท็บ[], ชีทแก้ไขล่าสุด?: string): Promise<ผลรอบ> {
  const s = ร้าน()
  const เมื่อ = new Date().toISOString()
  const ส = สำรวจ(แท็บทั้งหมด)
  const ลาย = ลายนิ้วมือ(ส)
  const ล็อก = (await s.get('layout', { type: 'text' }).catch(() => null)) as string | null
  if (ล็อก && ล็อก !== ลาย) return จด({ เมื่อ, สถานะ: 'หยุด-หัวเปลี่ยน', ชีทแก้ไขล่าสุด, สำรวจ: ส, เหตุ: 'แท็บหรือหัวคอลัมน์ต่างจากที่ล็อกไว้ — กติกานับอาจนับผิดช่อง ⇒ ไม่ผลิตเป้า รอคนดู' })
  const stocks = นับตามกติกา(แท็บทั้งหมด)
  if (!stocks) return จด({ เมื่อ, สถานะ: 'สำรวจ', ชีทแก้ไขล่าสุด, สำรวจ: ส, เหตุ: 'สคริปต์ส่งถึงแล้ว · ยังไม่มีกติกานับที่ยืนยันกับเลข 22 ต.ค. ⇒ จดแค่หัวคอลัมน์ ยังไม่ผลิตเป้า' })
  const ก่อน = (await s.get('latest', { type: 'json' }).catch(() => null)) as ข้อมูลล่าสุด | null
  const ฮวบ = ลดฮวบ(ก่อน?.stocks ?? null, stocks)
  if (ฮวบ.length) return จด({ เมื่อ, สถานะ: 'หยุด-ลดฮวบ', ชีทแก้ไขล่าสุด, stocks, ลดฮวบ: ฮวบ, เหตุ: 'ยอดลดผิดปกติ — หน้าตาของการอ่านพลาดมากกว่าขายหมดจริง ⇒ ไม่แทนเป้าเดิม รอคนยืนยัน' })
  if (!ล็อก) await s.set('layout', ลาย)
  await s.setJSON('latest', { stocks, เมื่อ, ชีทแก้ไขล่าสุด } satisfies ข้อมูลล่าสุด)
  return จด({ เมื่อ, สถานะ: 'พร้อม', ชีทแก้ไขล่าสุด, stocks })
}

export async function อ่านสถานะ() {
  const s = ร้าน()
  const [log, latest] = await Promise.all([
    s.get('log', { type: 'json' }).catch(() => null),
    s.get('latest', { type: 'json' }).catch(() => null),
  ])
  return {
    latest: (latest as ข้อมูลล่าสุด | null) ?? null,
    log: ((log as ผลรอบ[] | null) ?? []).slice(0, 20),
  }
}
