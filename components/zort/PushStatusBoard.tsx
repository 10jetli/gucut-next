'use client'
/* กระดานสถานะดันสต็อก 3 แถบ × 3 ช่องทาง (17 ก.ย. 2569 · ท่านประธานอนุมัติ · ใบงาน `งาน-จอสถานะดันสต็อก.md`)
 *
 * ท่านประธานขอ: "ต้องมีสถานะด้วยนะว่า เชื่อมกันได้ 100% · ออนไลน์ · อัปเดตออโต้"
 *
 * 🔴 **ทุกแถบมี 4 สถานะ — ⬜ ไม่รู้ ห้ามยุบรวมกับ 🟢**
 *    ตัวตรวจที่ยังไม่ได้ถาม / ถามไม่สำเร็จ ต้องขึ้น ⬜ พร้อมบอกว่าทำไมไม่รู้
 *    ⇒ เขียวแปลว่า "วัดแล้วดี" เท่านั้น ไม่ใช่ "ยังไม่เจออะไรเสีย"
 *
 * 🔴 **จอนี้ไม่ยิงเส้นแผน (`?stockpush=1`) ตอนเปิดหน้า** — เส้นนั้นกวาดของจริงทั้งสามเจ้า ~15–25 วิ
 *    ⇒ แถบ "เชื่อม" กับ "ช่องทางออนไลน์" จะเป็น ⬜ จนกว่าคนจะกดถาม (กติกาหน้าสถานะของร้าน)
 *
 * 🔴 **แถบ "อัปเดตออโต้" วัดจาก `counts.ยืนยันล่าสุด` ของสมุดสถานะ (`?pushstate=1`)** — CEO สั่ง 17 ก.ย. 2569
 *    🚫 ห้ามใช้ `autoOn` (สวิตช์) · เดิมรุ่นแรกวัดจาก log ซึ่งนับเฉพาะรอบที่ยิงออก
 *       ⇒ วันไหนสต็อกตรงอยู่แล้ว ตัวกวาดวิ่งถูกแต่ไม่มีรอบยิง แถบจะแดงผิด · สมุดสถานะแก้ข้อนี้
 *
 * ⚠️ เวลาใน log เป็น **UTC** (`2026-09-11T22:42:18Z`) — ต้องแปลงเป็นเวลาไทยก่อนแสดง
 *    ใบงานต้นทางอ่านเป็น "11 ก.ย. 22:42" ซึ่งคือ UTC · เวลาไทยจริงคือ 12 ก.ย. 05:42 (ห่าง 7 ชม. ข้ามวัน)
 */
import { serverTimeMs } from '@/lib/returns-api'
import { isSkip } from '@/components/ui/ErrorBox'

export type PlatformKey = 'shopee' | 'lazada' | 'tiktok'
const PLATFORM_KEYS: PlatformKey[] = ['lazada', 'shopee', 'tiktok']

/** คำตอบ `?pushstate=1` — สมุดสถานะดันสต็อกของ CEO (gucut-web · 17 ก.ย. 2569)
 *  อ่านฐานอย่างเดียว เร็ว ⇒ จอเรียกตอนเปิดหน้าได้ · เวลาทุกช่องเป็น ISO (UTC)
 *  ⚠️ `counts` **รวมทุกช่องทาง ไม่ได้แยก** — วันนี้มีตัวยิงช่องทางเดียวจึงใช้ได้ (ดู `นับรวมหลายช่องทาง`) */
export interface PushStateResp {
  ok?: boolean; error?: string; skip?: string
  inconclusive?: boolean; why?: string
  /** 🚫 **ห้ามใช้ทำแถบใด ๆ** — บอกแค่ว่าสวิตช์ยิงจริงเปิดไหม (CEO กำชับ) */
  autoOn?: boolean
  lastSweep?: { at?: string; channel?: string; mode?: string; planned?: number; pushed?: number; rejected?: number; skipped?: number; ms?: number; note?: string | null } | null
  counts?: {
    ทั้งหมด?: number | null; เคยยืนยัน?: number | null; กำลังถูกข้าม?: number | null
    มีข้อผิดพลาด?: number | null; ยืนยันล่าสุด?: string | null; ถูกข้ามนานสุดตั้งแต่?: string | null
    /** เพิ่มฝั่งท่อ aca11a2 (17 ก.ย. 2569) — แยก "ไม่เคยยิง" / "ยิงแล้วรอยืนยัน" / "ยิงแล้วยืนยันไม่ได้" ออกจากกัน
     *  ท่อรุ่นก่อนไม่มีสองช่องนี้ ⇒ undefined = ไม่รู้ ไม่ใช่ 0 */
    เคยยิง?: number | null; ยิงล่าสุด?: string | null
  } | null
  stuck?: Array<{ sku?: string; channel?: string; skip_reason?: string; skip_streak?: number; skip_first_at?: string; last_error?: string | null }>
  /* 🔑 กองที่ท่อ **คัดมาแล้ว** ว่าค้างนานผิดปกติ (ฝั่งท่อ 19 ก.ย. 2569 · ท่านประธานติ๊กใบให้ทำ)
     ⚠️ ฝั่งท่อกำชับสองข้อ และจอนี้เคยผิดทั้งสองข้อ:
       ① **ห้ามเอา `กำลังถูกข้าม` ทั้งกองมาขึ้นเตือน** — 43+33+15 รหัสจะเหลืองทุกวันจนคนเลิกอ่าน
       ② **ห้ามฝังเลข 24 ในจอ** — เกณฑ์มาจากท่อ (`ค้างนานเกณฑ์ชั่วโมง`)
     ⇒ ตัวที่ใช้ตัดสิน "แดง" คือกองนี้ ไม่ใช่การคำนวณอายุเองของจอ
     ⚠️ สามสถานะ: `[]` = ตรวจแล้วไม่มี ⇒ เงียบได้ · **ไม่มีคีย์/null = อ่านไม่ได้ ⇒ ต้องบอกว่าตัดสินไม่ได้**
        (เขียน `?? []` เมื่อไหร่ สองกรณีนี้จะเงียบเหมือนกัน ซึ่งเป็นคนละเรื่องกันคนละขั้ว) */
  'ค้างนานผิดปกติ'?: Array<{ channel?: string; skip_reason?: string; 'รหัส'?: number; 'เก่าสุด'?: string; 'รอบติดกันมากสุด'?: number }> | null
  'ค้างนานเกณฑ์ชั่วโมง'?: number | null
  /** ช่องทางที่ **ยิงไม่ออก** — ท่อเป็นเจ้าของรายชื่อนี้ จอห้ามฝังเอง (CEO สั่ง 17 ก.ย. 2569) */
  channelsWithoutWriter?: string[]
  /** 📊 แยกรายช่องทาง (ท่อ 0002c04 · 17 ก.ย. 2569 ตอนมีตัวยิงสามเจ้า)
   *  ⚠️ ช่องบนสุด lastSweep/counts **รวมทุกเจ้า** ⇒ มีช่องนี้เมื่อไหร่ต้องอ่านช่องนี้ ไม่งั้นรอบซ้อมของเจ้าหนึ่งทับรอบยิงจริงของอีกเจ้า
   *  🚫 `autoOn` ในนี้ก็ห้ามใช้ทำสีแถบเหมือนกัน — เขียนเป็นข้อความบอกสวิตช์ได้อย่างเดียว */
  byChannel?: Partial<Record<string, {
    มีตัวยิง?: boolean; autoOn?: boolean
    lastSweep?: PushStateResp['lastSweep']; counts?: PushStateResp['counts']
  }>>
}
/** รอบยิงจริงหนึ่งรอบจาก `?stockpushlog=1` (เวลา UTC) — ใช้จับ "ยิงจริงแล้วพัง" ที่สมุดสถานะมองไม่เห็น */
export interface BoardPushRound {
  at?: string; platform?: string; fired?: number; pushed?: number; rejected?: number
  rows?: Array<{ result?: string; why?: string }>
}
export interface BoardSide {
  platformSkus?: number; same?: number; wouldPush?: number
  skipNegative?: number; skipUnknown?: number; skipConflict?: number
  excludedGuess?: number; excludedOneToMany?: number
  bucketsAddUp?: boolean
  skip?: string
}

type Tone = 'ok' | 'warn' | 'bad' | 'unknown'
const TONE: Record<Tone, { dot: string; box: string; word: string }> = {
  ok: { dot: '🟢', box: 'border-emerald-200 bg-emerald-50 text-emerald-900', word: 'ปกติ' },
  warn: { dot: '🟡', box: 'border-amber-200 bg-amber-50 text-amber-900', word: 'ควรมาดู' },
  bad: { dot: '🔴', box: 'border-red-200 bg-red-50 text-red-900', word: 'เสีย' },
  unknown: { dot: '⬜', box: 'border-gray-200 bg-gray-50 text-gray-700', word: 'ไม่รู้' },
}

/* 🔴 เดิมมีตาราง PUSHER_AT_WRITE_TIME ฝังรายชื่อช่องทางที่มีตัวยิงไว้ในจอ — **ถอดแล้ว**
   CEO สั่ง: ตรวจจาก `channelsWithoutWriter` ที่ท่อส่งมาเท่านั้น วันที่สร้างตัวยิงเสร็จ ท่อเอาออกเอง จอไม่ต้องแก้ */

/** ตัวกวาดตั้งเวลาไว้ทุก 15 นาที (`stock-push-sweep.mjs` schedule *\/15) ⇒ เงียบเกิน 2 รอบ = ผิดปกติ */
const รอบกวาด_นาที = 15

const N = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const n = (v: unknown) => { const x = N(v); return x === null ? '—' : x.toLocaleString('th-TH') }

const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
/** เวลาไทยจากสตริงเวลาของเซิร์ฟเวอร์ (UTC) — ใช้ร่วมกับจอดันสต็อก */
export function thaiDateTime(iso?: string | null): string {
  const ms = serverTimeMs(iso)
  if (ms === null) return '—'
  const t = new Date(ms + 7 * 3600e3)
  return `${t.getUTCDate()} ${M[t.getUTCMonth()]} ${t.getUTCFullYear() + 543} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}
const thaiClock = (ms: number) => thaiDateTime(new Date(ms).toISOString())

function ago(ms: number, now: number): string {
  const s = Math.max(0, now - ms)
  const min = Math.floor(s / 60e3)
  if (min < 60) return `${min} นาทีที่แล้ว`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

interface Bar { tone: Tone; text: React.ReactNode }

/* ── 🔗 เชื่อม — ตัวเลขทุกกอง ห้ามซ่อนกองไหน ── */
function linkBar(side: BoardSide | undefined, asked: boolean, planErr: string): Bar {
  if (!asked) return { tone: 'unknown', text: 'ยังไม่ได้ถาม — กดปุ่ม "ตรวจการเชื่อมตอนนี้" (ใช้เวลาราว 15–25 วิ)' }
  if (!side) return { tone: 'unknown', text: planErr ? `ถามไม่สำเร็จ — ไม่รู้ (${planErr})` : 'ท่อไม่ได้ส่งข้อมูลช่องทางนี้มา — ไม่รู้' }
  /* อ่านช่องทางไม่ได้ = นับกองไม่ได้ ⇒ **ไม่รู้** (เดิมให้เหลือง แต่แถบช่องทางแดงจากเหตุเดียวกัน ⇒ จอพูดสองระดับ
     ในเรื่องเดียว เจอตอนทดสอบด้วยท่อปลอม 17 ก.ย. 2569) · ความเสียไปแสดงที่แถบ "ออนไลน์ — ช่องทาง" ที่เดียว */
  if (typeof side.skip === 'string') return { tone: 'unknown', text: `นับไม่ได้ — อ่านข้อมูลช่องทางนี้ไม่ได้รอบนี้ (${side.skip})` }

  /* ทุกกองที่ท่อส่งมา — กองไหนไม่มีค่า (ท่อไม่ส่ง) ไม่เอามาบวก แต่ก็ไม่แกล้งเป็น 0 */
  const กอง: Array<[string, number | undefined, boolean]> = [
    ['ตรง', side.same, false],
    ['ต่าง (จะถูกดัน)', side.wouldPush, false],
    ['ไม่รู้จัก', side.skipUnknown, true],
    ['ติดลบ', side.skipNegative, true],
    ['ข้อมูลขัดกัน', side.skipConflict, true],
    ['จับคู่แบบเดา (ไม่ดัน)', side.excludedGuess, true],
    ['หลายรหัสชี้ตัวเดียว (ไม่ดัน)', side.excludedOneToMany, true],
  ]
  const มีค่า = กอง.filter(([, v]) => N(v) !== null)
  const ผลรวม = มีค่า.reduce((a, [, v]) => a + (v as number), 0)
  const ทั้งหมด = N(side.platformSkus)
  const เศษ = ทั้งหมด === null ? null : ทั้งหมด - ผลรวม
  const ปัญหา = มีค่า.filter(([, v, isProblem]) => isProblem && (v as number) > 0)

  let tone: Tone = ปัญหา.length ? 'warn' : 'ok'
  const เตือน: string[] = []
  if (side.bucketsAddUp === false) { tone = 'bad'; เตือน.push('ท่อบอกเองว่ากองย่อยบวกไม่ได้ยอดรวม — ห้ามเชื่อตัวเลขรอบนี้') }
  if (side.bucketsAddUp === undefined) { tone = tone === 'ok' ? 'warn' : tone; เตือน.push('ท่อไม่ได้บอกว่ากองบวกครบไหม') }
  if (เศษ !== null && เศษ !== 0) { tone = 'bad'; เตือน.push(`มี ${n(Math.abs(เศษ))} รหัส${เศษ > 0 ? 'ไม่อยู่ในกองไหนที่จอรู้จัก' : 'ถูกนับเกินยอดรวม'}`) }
  if (ทั้งหมด === null) { tone = tone === 'ok' ? 'warn' : tone; เตือน.push('ท่อไม่ได้บอกจำนวนรหัสทั้งหมดบนช่องทาง') }

  return {
    tone,
    text: (
      <>
        <span className="tabular-nums">
          {มีค่า.map(([label, v], i) => <span key={label}>{i ? ' · ' : ''}{label} <b>{n(v)}</b></span>)}
          {' '}<span className="text-gray-500">(จากทั้งหมด {n(ทั้งหมด)} รหัส)</span>
        </span>
        {เตือน.map((w) => <span key={w} className="block text-red-800 mt-0.5">⚠️ {w}</span>)}
      </>
    ),
  }
}

/* ── 📶 ออนไลน์ — แยก "ระบบเรา" กับ "ช่องทาง" คนละบรรทัด คนละที่แก้ ──
   "ระบบเรา" = **ตัวกวาดวิ่งเสร็จล่าสุดเมื่อไหร่** (ไม่ใช่แค่หน้าเว็บตอบ) */
function oursBar(st: (PushStateResp & { แยกรายช่องทาง?: boolean }) | null, loading: boolean, err: string, now: number): Bar {
  if (loading && !st) return { tone: 'unknown', text: 'กำลังอ่านสมุดสถานะ…' }
  if (err) return isSkip(err)
    ? { tone: 'warn', text: `ท่อของเราตอบว่ายังทำงานส่วนนี้ไม่ได้: ${err}` }
    : { tone: 'bad', text: `ท่อของเราไม่ตอบ — ${err}` }
  if (!st) return { tone: 'unknown', text: 'ยังไม่ได้อ่านสมุดสถานะ' }
  if (st.inconclusive) return { tone: 'bad', text: `ท่อของเราตอบ แต่อ่านสมุดสถานะไม่ได้ — ${st.why ?? 'ไม่บอกเหตุ'}` }
  const ls = st.lastSweep
  if (ls === null) return { tone: 'bad', text: st.แยกรายช่องทาง ? 'ท่อของเราตอบ แต่ตัวกวาดอัตโนมัติของช่องทางนี้ยังไม่เคยวิ่งเลย' : 'ท่อของเราตอบ แต่ตัวกวาดอัตโนมัติยังไม่เคยวิ่งเลย' }
  const ms = serverTimeMs(ls?.at)
  if (ms === null) return { tone: 'unknown', text: 'ท่อไม่ได้บอกว่าตัวกวาดวิ่งล่าสุดเมื่อไหร่' }
  const age = now - ms
  const tone: Tone = age <= 2 * รอบกวาด_นาที * 60e3 ? 'ok' : age <= 2 * 3600e3 ? 'warn' : 'bad'
  /* 🔴 **`fast-skip` เคยตกลงมาที่ "โหมดไม่รู้จัก" ทั้งที่เจอแทบทุกรอบ** (เจอ 18 ก.ย. 2569)
     แล้วแถบขึ้น 🟢 ปกติ พร้อมเวลาล่าสุดสด ๆ ⇒ อ่านแล้วเชื่อว่ารอบนั้นทำงาน
     ความจริงคือ **ข้ามไปเลย ไม่ได้คิดแผนใหม่และไม่ได้เขียนอะไร** (planned 0 · ใช้ 294 ms)
     ⇒ วันนั้นเรานัดกันว่า "รอบถัดไปจะเขียนทับเอง" แล้วรอเก้อครึ่งชั่วโมง เพราะไม่มีรอบไหนเขียนเลย
     ⚠️ โหมดที่ยังไม่รู้จักต้องขึ้นว่าไม่รู้จักต่อไป — ห้ามเดาความหมายให้โหมดใหม่ */
  const โหมด = ls?.mode === 'live' ? 'ยิงจริง'
    : ls?.mode === 'dry' ? 'ซ้อม (ยังไม่ยิงของจริง)'
    : ls?.mode === 'fast-skip' ? 'ข้ามเร็ว — ไม่ได้คิดแผนใหม่และไม่ได้เขียนอะไรลงสมุด'
    : `โหมดไม่รู้จัก: ${ls?.mode ?? '—'}`
  return {
    tone,
    text: <>ตัวกวาดวิ่งล่าสุด <b>{thaiDateTime(ls?.at)}</b> ({ago(ms, now)}) · โหมด {โหมด}
      {tone !== 'ok' && ` — ตั้งไว้ทุก ${รอบกวาด_นาที} นาที แต่เงียบไปนานกว่านั้น`}
      {ls?.note && <span className="block text-red-800">⚠️ รอบนั้นแจ้งว่า: {ls.note}</span>}</>,
  }
}
function channelBar(label: string, side: BoardSide | undefined, asked: boolean, planErr: string, planAt: number | null): Bar {
  if (!asked) return { tone: 'unknown', text: `ยังไม่ได้ถามว่าติดต่อ ${label} ได้ไหม` }
  if (!side) return { tone: 'unknown', text: planErr ? `ไม่รู้ — ถามท่อไม่สำเร็จ จึงไม่รู้ว่า ${label} ติดต่อได้ไหม` : `ไม่รู้ — ท่อไม่ได้ส่งข้อมูล ${label} มา` }
  if (typeof side.skip === 'string') return { tone: 'bad', text: `อ่านข้อมูลจาก ${label} ไม่ได้รอบนี้: ${side.skip}` }
  if (N(side.platformSkus) === null) return { tone: 'unknown', text: `ท่อตอบแต่ไม่มีจำนวนรหัสของ ${label} — ไม่รู้ว่าอ่านได้จริงไหม` }
  return { tone: 'ok', text: `อ่านสต็อกจาก ${label} ได้ ${n(side.platformSkus)} รหัส${planAt ? ` (ถามเมื่อ ${thaiClock(planAt)})` : ''}` }
}

/** มุมมองของช่องทางเดียว — ท่อมี byChannel ⇒ ใช้รอบกวาด/ตัวนับของช่องทางนั้น · ไม่มี ⇒ ใช้ช่องรวมเดิม (ท่อรุ่นเก่า) */
export function มุมมองช่องทาง(st: PushStateResp | null, key: PlatformKey): (PushStateResp & { แยกรายช่องทาง?: boolean }) | null {
  const bc = st?.byChannel?.[key]
  if (!st || st.inconclusive || !bc) return st
  return { ...st, lastSweep: bc.lastSweep ?? null, counts: bc.counts ?? null, แยกรายช่องทาง: true }
}

/** ช่องทางนี้ **มีตัวยิงไหม** ตามที่ท่อบอก — true/false/null(ไม่รู้) */
export function มีตัวยิง(st: PushStateResp | null, key: PlatformKey): boolean | null {
  if (!st || st.inconclusive || !Array.isArray(st.channelsWithoutWriter)) return null
  return !st.channelsWithoutWriter.map((c) => String(c).toLowerCase()).includes(key)
}

/* ── 🔄 อัปเดตออโต้ — วัดจาก `counts.ยืนยันล่าสุด` เท่านั้น (CEO สั่ง 17 ก.ย. 2569) ──
   🚫 ห้ามแตะ `autoOn` · `verified_at` ตั้งได้ที่เดียวคือรอบกวาดถัดไปพิสูจน์ว่ารหัสหายจากแผนจริง */
function autoBar(key: PlatformKey, st: (PushStateResp & { แยกรายช่องทาง?: boolean }) | null, err: string, now: number): Bar {
  const writer = มีตัวยิง(st, key)
  if (writer === null) return { tone: 'unknown', text: err ? 'อ่านสมุดสถานะไม่ได้ — ไม่รู้ว่าช่องทางนี้อัปเดตอัตโนมัติอยู่ไหม' : 'ไม่รู้ — ท่อไม่ได้บอกว่าช่องทางไหนมีตัวยิง' }
  if (!writer) return { tone: 'unknown', text: 'ยังดันไม่ได้ — ไม่มีตัวยิง' }
  const c = st?.counts
  if (!c) return { tone: 'unknown', text: st?.แยกรายช่องทาง ? 'สมุดยังไม่มีรหัสของช่องทางนี้ — ยังไม่เคยกวาด ไม่รู้' : 'ท่อไม่ได้ส่งตัวนับของสมุดสถานะมา — ไม่รู้' }
  const นับรวมหลายช่องทาง = !st?.แยกรายช่องทาง && PLATFORM_KEYS.filter((k) => มีตัวยิง(st, k)).length > 1
  const หมายเหตุรวม = นับรวมหลายช่องทาง ? ' · ⚠️ ตัวเลขนี้รวมทุกช่องทางที่มีตัวยิง ท่อยังไม่แยกรายช่องทาง' : ''
  const ms = serverTimeMs(c.ยืนยันล่าสุด)
  /* 🔑 **ยังไม่เคยยืนยัน มีสามสาเหตุที่หน้าตาเหมือนกันเป๊ะ** (CEO ชี้ 17 ก.ย. 2569 · ท่อ aca11a2)
     ไม่เคยยิง · ยิงแล้วรอรอบกวาดยืนยัน · ยิงแล้วยืนยันไม่ได้ (สายขาดหลังยิง) — แก้คนละที่กันทั้งหมด
     ⇒ ใช้ `เคยยิง` + `ยิงล่าสุด` แยกออก · ท่อรุ่นเก่าที่ไม่มีช่องนี้ ⇒ ตกไปใช้ข้อความเดิม */
  const ยิงแล้ว = N(c.เคยยิง)
  const ยิงล่าสุดms = serverTimeMs(c.ยิงล่าสุด)
  if (ms === null && ยิงแล้ว !== null && ยิงแล้ว > 0) {
    const รอมา = ยิงล่าสุดms === null ? null : now - ยิงล่าสุดms
    const เกินสองรอบ = รอมา !== null && รอมา > 2 * รอบกวาด_นาที * 60e3
    return {
      tone: เกินสองรอบ || รอมา === null ? 'bad' : 'warn',
      text: <>ยิงแล้ว <b>{n(ยิงแล้ว)}</b> รหัส (ล่าสุด {thaiDateTime(c.ยิงล่าสุด)}{ยิงล่าสุดms !== null && ` · ${ago(ยิงล่าสุดms, now)}`})
        {' '}แต่<b>ยังไม่มีรหัสไหนยืนยันได้ว่าถึงแพลตฟอร์ม</b>
        {เกินสองรอบ
          ? ` — เลยมาเกิน 2 รอบกวาดแล้ว ⇒ สายน่าจะขาดหลังยิง (ยิงแล้วแต่รอบกวาดยืนยันไม่ได้)`
          : ' — รอรอบกวาดถัดไปยืนยัน'}{หมายเหตุรวม}</>,
    }
  }
  if (ms === null) {
    const ls = st?.lastSweep
    const เหตุ = ls === null ? 'ตัวกวาดยังไม่เคยวิ่ง'
      : ยิงแล้ว === 0 ? 'สมุดยังไม่มีรหัสไหนถูกบันทึกว่ายิงออกไป (ถ้าแถบ "ยิงจริงล่าสุด" มีรอบที่ยิงผ่าน แปลว่าสมุดไม่ได้จดรอบนั้น — คนละเรื่องกับยิงไม่ออก)'
      /* 🔴 เดิมเขียน "ยังไม่ได้ยิงของจริงสักรหัส" — **เท็จ** วันที่รอบยิงจริง 14:01 ถูกปฏิเสธทั้งรอบ
         แล้วรอบซ้อม 14:15 มาทับ `lastSweep` (เจอบนข้อมูลจริง 17 ก.ย. 2569) ⇒ พูดเฉพาะเรื่องรอบล่าสุดที่รู้แน่ */
      : ls?.mode === 'dry' ? 'รอบกวาดล่าสุดเป็นโหมดซ้อม (ไม่ได้ยิง) — ดูแถบ "ยิงจริงล่าสุด" ว่าเคยยิงจริงแล้วผลเป็นอย่างไร'
      : 'ยังไม่มีรหัสไหนที่รอบกวาดถัดไปพิสูจน์ได้ว่าลงจริง'
    return { tone: 'bad', text: `ยังไม่เคยยืนยันว่าดันถึงแพลตฟอร์มจริงสักรหัส · ${เหตุ}${หมายเหตุรวม}` }
  }
  const age = now - ms
  /* 🔴 ตัวนับของสมุดเป็น **ยอดรวมทุกช่องทาง** ⇒ มีตัวยิงเกินหนึ่งช่องทางเมื่อไหร่ เวลายืนยันนี้อาจเป็นของช่องทางอื่นทั้งหมด
     ⇒ ห้ามให้ดวงไฟยืนยันแทนช่องทางนี้ (เจอตอนทดสอบ 17 ก.ย. 2569: Shopee ขึ้นเขียวจากเวลาของ Lazada) ⇒ ⬜ ไม่รู้ */
  const tone: Tone = นับรวมหลายช่องทาง ? 'unknown' : age <= 3600e3 ? 'ok' : age <= 24 * 3600e3 ? 'warn' : 'bad'
  return {
    tone,
    text: <>{นับรวมหลายช่องทาง && 'ไม่รู้รายช่องทาง — '}ยืนยันว่าถึงแพลตฟอร์มล่าสุด <b>{thaiDateTime(c.ยืนยันล่าสุด)}</b> ({ago(ms, now)})
      {' '}· เคยยืนยัน {n(c.เคยยืนยัน)}{ยิงแล้ว !== null && ` จากที่ยิง ${n(ยิงแล้ว)}`} · ในสมุด {n(c.ทั้งหมด)} รหัส{หมายเหตุรวม}</>,
  }
}

/* ── 🎯 ยิงจริงล่าสุด — อ่านจากประวัติการยิง ไม่ใช่สมุดสถานะ ──
   🔴 **ที่มา (17 ก.ย. 2569 14:01): ยิงจริงขึ้น Lazada 76 ตัว ถูกปฏิเสธทั้ง 76 — แต่กระดานไม่มีอะไรแดงเลย**
      · `lastSweep` ถูกรอบซ้อม 14:15 เขียนทับภายใน 15 นาที ⇒ ความล้มเหลวหายจากจอ
      · สมุดสถานะบอก `มีข้อผิดพลาด 0` (บั๊กฝั่งท่อ: ตัวกันเวลาตัดการเขียนผลยิงทิ้ง)
      ⇒ แหล่งเดียวที่จำความล้มเหลวไว้คือ `stockpush/log` ⇒ จอต้องอ่านจากตรงนี้ด้วย
   กติกา: รอบยิงจริงล่าสุดของช่องทาง **มีถูกปฏิเสธ ⇒ 🔴** จนกว่าจะมีรอบใหม่กว่าที่ยิงผ่าน
   ⚠️ "ยิงผ่าน" ในแถบนี้ = แพลตฟอร์มตอบรับ · ยังไม่ใช่ "ยืนยันแล้ว" (อันนั้นคือแถบอัปเดตออโต้) */
function lastLiveBar(key: PlatformKey, log: BoardPushRound[] | null, logErr: string, st: PushStateResp | null, now: number): Bar | null {
  if (มีตัวยิง(st, key) === false) return null
  if (log === null) return logErr ? { tone: 'unknown', text: 'อ่านประวัติการยิงไม่ได้ — ไม่รู้ว่ายิงจริงล่าสุดผ่านไหม' } : null
  const รอบ = log
    .filter((r) => String(r.platform ?? '').toLowerCase() === key)
    .map((r) => ({ r, ms: serverTimeMs(r.at) }))
    .filter((x): x is { r: BoardPushRound; ms: number } => x.ms !== null)
    .sort((a, b) => b.ms - a.ms)
  if (!รอบ.length) return { tone: 'unknown', text: 'ยังไม่เคยยิงจริง' }
  const { r, ms } = รอบ[0]
  const ปฏิเสธ = N(r.rejected) ?? 0
  const เข้า = N(r.pushed) ?? 0
  const ยิง = N(r.fired)
  /* เหตุผลที่พบบ่อยสุดในรอบนั้น — ให้คนเห็นว่าพังเพราะอะไร ไม่ใช่แค่ว่าพัง */
  const นับเหตุ = new Map<string, number>()
  for (const x of r.rows ?? []) if (x.result === 'rejected' && x.why) นับเหตุ.set(x.why, (นับเหตุ.get(x.why) ?? 0) + 1)
  const เหตุหลัก = Array.from(นับเหตุ.entries()).sort((a, b) => b[1] - a[1])[0]
  const tone: Tone = ปฏิเสธ > 0 ? 'bad' : เข้า > 0 ? 'ok' : 'warn'
  return {
    tone,
    text: (
      <>
        ยิงจริงล่าสุด <b>{thaiDateTime(r.at)}</b> ({ago(ms, now)}) · ยิง {n(ยิง)} · เข้า <b>{n(เข้า)}</b> · ถูกปฏิเสธ <b>{n(ปฏิเสธ)}</b>
        {เหตุหลัก && <span className="block">เหตุ: {เหตุหลัก[0]}{นับเหตุ.size > 1 ? ` (และเหตุอื่นอีก ${นับเหตุ.size - 1} แบบ)` : ''}</span>}
      </>
    ),
  }
}

/* ── 🧊 ถูกข้าม — ตอบคำถามท่านประธาน "รหัสที่ถูกข้ามทุกรอบมาสามวัน จอขึ้นสีอะไร" ⇒ แดง ──
   เกิน 1 ชม. เหลือง · เกิน 24 ชม. แดง · ไม่ว่าเหตุที่ข้ามจะถูกกฎแค่ไหน (ของที่ถูกข้ามก็ทำให้ขายเกินได้) */
const เหตุข้าม: Record<string, string> = { negative: 'คลังเราติดลบ', unknown: 'คลังเราไม่รู้จักรหัสนี้', conflict: 'ข้อมูลขัดกัน' }
function skipBar(key: PlatformKey, st: (PushStateResp & { แยกรายช่องทาง?: boolean }) | null, now: number): Bar | null {
  if (มีตัวยิง(st, key) !== true) return null
  const c = st?.counts
  if (!c) return { tone: 'unknown', text: st?.แยกรายช่องทาง ? 'สมุดยังไม่มีรหัสของช่องทางนี้ — ยังไม่เคยกวาด ไม่รู้ว่ามีรหัสค้างไหม' : 'ไม่รู้ — ท่อไม่ได้ส่งตัวนับมา' }
  const จำนวน = N(c.กำลังถูกข้าม)
  if (จำนวน === null) return { tone: 'unknown', text: 'ยังไม่มีข้อมูลในสมุด — ไม่รู้ว่ามีรหัสค้างไหม' }
  if (จำนวน === 0) return { tone: 'ok', text: 'ไม่มีรหัสที่กำลังถูกข้าม' }
  const ms = serverTimeMs(c.ถูกข้ามนานสุดตั้งแต่)
  const age = ms === null ? null : now - ms
  /* 🔴 **มีรหัสถูกข้ามอยู่ ⇒ ห้ามขึ้น 🟢 ปกติ** (แก้ 17 ก.ย. 2569 หลังตัวกวาดวิ่งจริงรอบแรก)
     รุ่นก่อนให้เขียวถ้าข้ามไม่ถึง 1 ชม. ⇒ ของจริงขึ้น "🟢 ปกติ · กำลังถูกข้าม 15 รหัส" = อ่านขัดกันเอง
     และข้อเสนอที่อนุมัติเขียนว่าช่วงนี้ "ไม่มีสี" ไม่ใช่ "เขียว" · กองที่ข้าม (ติดลบ/ไม่รู้จัก/ขัดกัน) ไม่หายเองด้วย
     ⇒ มีข้าม = อย่างน้อยเหลือง · เกิน 24 ชม. = แดง */
  /* 🔴 **เลิกคำนวณเกณฑ์เอง** (แก้ 19 ก.ย. 2569) — เดิมเขียน `age > 24 * 3600e3` ฝังเลขไว้ในจอ
     ⇒ วันที่ฝั่งท่อเปลี่ยนเกณฑ์ จอจะตัดสินด้วยเลขเก่าโดยไม่มีอะไรฟ้อง (คลาสเดียวกับรอบซิงก์สูตรชุด)
     ⇒ ตอนนี้ใช้ **กองที่ท่อคัดมาแล้ว** เป็นตัวตัดสิน · จอไม่ต้องรู้ด้วยซ้ำว่าเกณฑ์กี่ชั่วโมง */
  const ค้างนาน = st?.['ค้างนานผิดปกติ']
  const ของช่องนี้ค้างนาน = Array.isArray(ค้างนาน)
    ? ค้างนาน.filter((x) => String(x.channel ?? '').toLowerCase() === key) : null
  const เกณฑ์ชม = N(st?.['ค้างนานเกณฑ์ชั่วโมง'])
  const tone: Tone = ของช่องนี้ค้างนาน === null
    ? 'warn'                                   // ท่อไม่ได้ส่งกองคัดมา ⇒ ตัดสินไม่ได้ ⇒ ไม่เขียว ไม่แดง
    : (ของช่องนี้ค้างนาน.length > 0 ? 'bad' : 'warn')
  const ของช่องทางนี้ = (st?.stuck ?? []).filter((x) => String(x.channel ?? '').toLowerCase() === key)
  return {
    tone,
    text: (
      <>
        กำลังถูกข้าม <b>{n(จำนวน)}</b> รหัส · นานสุดตั้งแต่ <b>{thaiDateTime(c.ถูกข้ามนานสุดตั้งแต่)}</b>
        {ms !== null && ` (${ago(ms, now)})`}
        {/* ⚠️ บรรทัดนี้คือ "คำเตือนจริง" — กองข้ามทั้งกองข้างบนเป็นแค่บริบท
            ที่ท่อคัดมาแล้วว่าค้างนานผิดปกติเท่านั้นที่ควรทำให้คนลงมือ */}
        {ของช่องนี้ค้างนาน === null && (
          <span className="block">⚠️ ท่อยังไม่ส่งกอง &quot;ค้างนานผิดปกติ&quot; มา ⇒ <b>บอกไม่ได้ว่ามีรหัสค้างนานไหม</b> (ไม่ใช่ว่าไม่มี)</span>
        )}
        {ของช่องนี้ค้างนาน !== null && ของช่องนี้ค้างนาน.length > 0 && (
          <span className="block">
            🔴 <b>ค้างนานผิดปกติ</b>{เกณฑ์ชม !== null && <> (เกินเกณฑ์ {n(เกณฑ์ชม)} ชม. ที่ท่อกำหนด)</>} —{' '}
            {ของช่องนี้ค้างนาน.map((g, i) => (
              <span key={`${g.skip_reason}-${i}`}>
                {i ? ' · ' : ''}{เหตุข้าม[String(g.skip_reason)] ?? `เหตุที่จอยังไม่รู้จัก (${g.skip_reason})`}{' '}
                <b>{n(g['รหัส'])}</b> รหัส (ติดกัน {n(g['รอบติดกันมากสุด'])} รอบ)
              </span>
            ))}
            {' '}⇒ สต็อกหน้าร้านของรหัสพวกนี้ <b>ค้างอยู่ที่ค่าเก่า</b> และไม่นับเป็น error จึงไม่มีอะไรร้อง
          </span>
        )}
        {ของช่องทางนี้.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer">ดูรหัสที่ค้างนานสุด {ของช่องทางนี้.length} รายการ
              {ของช่องทางนี้.length < จำนวน && ` (ท่อส่งมาแค่ ${ของช่องทางนี้.length} จาก ${n(จำนวน)})`}</summary>
            <ul className="mt-1 space-y-0.5">
              {ของช่องทางนี้.map((x) => (
                <li key={`${x.sku}-${x.skip_first_at}`} className="font-mono text-[11px]">
                  {x.sku} · {เหตุข้าม[String(x.skip_reason)] ?? `เหตุที่จอยังไม่รู้จัก (${x.skip_reason})`}
                  {' '}· ข้ามติดกัน {n(x.skip_streak)} รอบ · ตั้งแต่ {thaiDateTime(x.skip_first_at)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </>
    ),
  }
}

function BarRow({ icon, name, bar }: { icon: string; name: string; bar: Bar }) {
  const t = TONE[bar.tone]
  return (
    <div className={`border rounded px-2.5 py-1.5 text-[12px] leading-relaxed ${t.box}`}>
      <span className="font-semibold">{icon} {name}</span>{' '}
      <span className="whitespace-nowrap">{t.dot} {t.word}</span>
      <span className="block">{bar.text}</span>
    </div>
  )
}

export default function PushStatusBoard(props: {
  state: PushStateResp | null; stateLoading: boolean; stateErr: string
  log: BoardPushRound[] | null; logErr: string
  plan: Partial<Record<PlatformKey, BoardSide>> | null; planBusy: boolean; planErr: string; planAt: number | null
  onAsk: () => void
}) {
  const { state, stateLoading, stateErr, log, logErr, plan, planBusy, planErr, planAt, onAsk } = props
  const now = Date.now()
  const asked = plan !== null || !!planErr
  const CH: Array<{ key: PlatformKey; label: string }> = [
    { key: 'lazada', label: 'Lazada' },
    { key: 'shopee', label: 'Shopee' },
    { key: 'tiktok', label: 'TikTok' },
  ]
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div>
          <p className="text-[14px] font-semibold text-gray-900">สถานะการดันสต็อก — เชื่อม · ออนไลน์ · อัปเดตออโต้</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">
            ⬜ = <b>ไม่รู้</b> (ยังไม่ได้ถาม หรือถามไม่สำเร็จ) — ไม่ได้แปลว่าปกติ ·
            อัปเดตออโต้วัดจาก<b>เวลาที่รอบกวาดยืนยันว่าเลขถึงแพลตฟอร์มจริง</b> ไม่ได้ดูว่าเปิดสวิตช์ไว้
          </p>
        </div>
        <button type="button" onClick={onAsk} disabled={planBusy}
          className="text-[12.5px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3.5 py-1.5 hover:bg-gray-50 disabled:opacity-50">
          {planBusy ? 'กำลังถามทั้งสามช่องทาง…' : 'ตรวจการเชื่อมตอนนี้'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {CH.map(({ key, label }) => {
          const side = plan?.[key]
          const writer = มีตัวยิง(state, key)
          const link = linkBar(side, asked, planErr)
          /* แยกรายช่องทางเมื่อท่อมี byChannel — ทั้ง "ระบบเรา" · อัปเดตออโต้ · ถูกข้าม */
          const stK = มุมมองช่องทาง(state, key)
          const ours = oursBar(stK, stateLoading, stateErr, now)
          const skip = skipBar(key, stK, now)
          const สวิตช์ = state?.byChannel?.[key]?.autoOn
          return (
            <div key={key} className="border border-gray-200 rounded-md p-2.5 space-y-1.5">
              <p className="text-[13px] font-semibold text-gray-900">{label}</p>
              {/* 🔴 ช่องทางที่ยิงไม่ออก: "แผนจะดัน" มีจริง แต่กดยังไงก็ไม่ออก ⇒ ต้องบอกคู่กับตัวเลข (CEO ชี้ 17 ก.ย. 2569) */}
              {writer === false && (
                <p className="text-[12px] font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded px-2.5 py-1.5">
                  ⬜ ยังดันไม่ได้ — ไม่มีตัวยิง
                  <span className="block font-normal text-gray-600">ตัวเลขข้างล่างคือแผนที่คิดได้ ไม่ใช่ของที่จะถูกดัน</span>
                </p>
              )}
              {/* ข้อความบอกสวิตช์เท่านั้น — 🚫 ห้ามเอา autoOn ไปทำสีแถบ (CEO กำชับ)
                  🔴 **ขยาย 18 ก.ย. 2569 (CEO อนุมัติให้เขียนกำกับ)** — ของจริงวันนั้น
                     shopee/tiktok สวิตช์ปิด แต่จอโชว์ `planned 59` และ `47` เฉย ๆ
                     ⇒ คนอ่านนึกว่ากำลังจะดัน **ทั้งที่ไม่มีวันดัน** = จอโกหกโดยระบบไม่ล้ม
                  ⚠️ เงื่อนไขที่ CEO กำชับ ห้ามพลาด:
                     ① คิดจาก `autoOn` ที่ท่อส่งมา **ห้ามเขียนฝังว่าเจ้าไหนปิด**
                        วันไหนท่านประธานสั่งเปิด ข้อความนี้หายเอง ไม่ต้องรอใครมาถอด
                     ② `ยิงล่าสุด` ต้องมาจาก `counts` ตรง ๆ **ห้ามพิมพ์วันที่เป็นข้อความ**
                        และต้องแยกสามทาง: มีเวลา ≠ null (ยังไม่เคยยิง) ≠ ไม่มีช่อง (ท่อรุ่นเก่า ไม่รู้)
                     ③ ต้องเขียนว่า **รอคำสั่งท่านประธาน** ไม่งั้นคนอ่านนึกว่าของเสีย แล้วไปตั้ง env เอง */}
              {writer === true && typeof สวิตช์ === 'boolean' && (
                <p className="text-[11.5px] text-gray-600">
                  สวิตช์ยิงอัตโนมัติของช่องทางนี้: <b>{สวิตช์ ? 'เปิด' : 'ปิด'}</b>
                  {สวิตช์ === false && (() => {
                    const c = stK?.counts
                    const มีช่อง = !!c && 'ยิงล่าสุด' in c
                    const ล่าสุด = c?.ยิงล่าสุด
                    return (
                      <span className="block text-amber-800 mt-0.5">
                        ⚠️ ตัวกวาดคิดแผนให้ดูได้ แต่<b>จะไม่ยิงอะไรออกไปเลย</b> —
                        เลขแผนข้างล่างจึงไม่ใช่ของที่กำลังจะถูกดัน ·{' '}
                        {!มีช่อง
                          ? <>ท่อรุ่นนี้ไม่ได้บอกว่ายิงล่าสุดเมื่อไหร่</>
                          : ล่าสุด
                            ? <>ยิงจริงล่าสุด <b>{thaiDateTime(ล่าสุด)}</b></>
                            : <><b>ยังไม่เคยยิงสักครั้ง</b></>}
                        {' '}· <b>รอคำสั่งท่านประธานว่าจะเปิดสวิตช์ไหม</b> (ไม่ใช่ของเสีย ห้ามไปตั้งค่าเอง)
                      </span>
                    )
                  })()}
                </p>
              )}
              <BarRow icon="🔗" name="เชื่อม" bar={link} />
              {/* ⚠️ ไอคอนหน้าชื่อแถบห้ามเป็นดวงไฟสี — เดิมใช้ 🟢 ตายตัว วางข้าง "⬜ ไม่รู้" แล้วอ่านขัดกันเอง */}
              <BarRow icon="📶" name="ออนไลน์ — ระบบเรา" bar={ours} />
              <BarRow icon="📶" name={`ออนไลน์ — ${label}`} bar={channelBar(label, side, asked, planErr, planAt)} />
              {(() => { const b = lastLiveBar(key, log, logErr, state, now); return b && <BarRow icon="🎯" name="ยิงจริงล่าสุด" bar={b} /> })()}
              <BarRow icon="🔄" name="อัปเดตออโต้" bar={autoBar(key, stK, stateErr, now)} />
              {skip && <BarRow icon="🧊" name="ถูกข้าม" bar={skip} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
