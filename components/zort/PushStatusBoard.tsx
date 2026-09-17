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
 * 🔴 **แถบ "อัปเดตออโต้" วัดจากเวลายิงสำเร็จจริงใน log เท่านั้น** — ไม่มีสวิตช์ให้อ่านโดยตั้งใจ
 *
 * ⚠️ เวลาใน log เป็น **UTC** (`2026-09-11T22:42:18Z`) — ต้องแปลงเป็นเวลาไทยก่อนแสดง
 *    ใบงานต้นทางอ่านเป็น "11 ก.ย. 22:42" ซึ่งคือ UTC · เวลาไทยจริงคือ 12 ก.ย. 05:42 (ห่าง 7 ชม. ข้ามวัน)
 */
import { serverTimeMs } from '@/lib/returns-api'
import { isSkip } from '@/components/ui/ErrorBox'

export type PlatformKey = 'shopee' | 'lazada' | 'tiktok'

export interface BoardRound { at?: string; platform?: string; fired?: number; pushed?: number; rejected?: number }
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

/** ช่องทางไหน **มีตัวยิงจริง** — ยืนยันจากโค้ดท่อ 17 ก.ย. 2569:
 *  lazada = `stock-push-live.mjs` (อนุมัติ 8 ก.ย.) · shopee = ไม่มีตัวยิงเลย · tiktok = `tiktok-stock.mjs` อ่านอย่างเดียว
 *  ⚠️ **ค่านี้เก่าได้** — ถ้า log มีรอบยิงสำเร็จของช่องทางที่เขียนว่าไม่มีตัวยิง จอจะเชื่อ log แทน (ดู `hasPusher`) */
const PUSHER_AT_WRITE_TIME: Record<PlatformKey, boolean> = { lazada: true, shopee: false, tiktok: false }

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

/* ── 🟢 ออนไลน์ — แยก "ระบบเรา" กับ "ช่องทาง" คนละบรรทัด คนละที่แก้ ── */
function oursBar(logLoading: boolean, logErr: string, logAt: number | null): Bar {
  if (logLoading && logAt === null) return { tone: 'unknown', text: 'กำลังถามท่อของเรา…' }
  if (logErr) return isSkip(logErr)
    ? { tone: 'warn', text: `ท่อของเราตอบว่ายังทำงานส่วนนี้ไม่ได้: ${logErr}` }
    : { tone: 'bad', text: `ท่อของเราไม่ตอบ — ${logErr}` }
  if (logAt === null) return { tone: 'unknown', text: 'ยังไม่ได้ถามท่อของเรา' }
  return { tone: 'ok', text: `ท่อของเราตอบ (ถามเมื่อ ${thaiClock(logAt)})` }
}
function channelBar(label: string, side: BoardSide | undefined, asked: boolean, planErr: string, planAt: number | null): Bar {
  if (!asked) return { tone: 'unknown', text: `ยังไม่ได้ถามว่าติดต่อ ${label} ได้ไหม` }
  if (!side) return { tone: 'unknown', text: planErr ? `ไม่รู้ — ถามท่อไม่สำเร็จ จึงไม่รู้ว่า ${label} ติดต่อได้ไหม` : `ไม่รู้ — ท่อไม่ได้ส่งข้อมูล ${label} มา` }
  if (typeof side.skip === 'string') return { tone: 'bad', text: `อ่านข้อมูลจาก ${label} ไม่ได้รอบนี้: ${side.skip}` }
  if (N(side.platformSkus) === null) return { tone: 'unknown', text: `ท่อตอบแต่ไม่มีจำนวนรหัสของ ${label} — ไม่รู้ว่าอ่านได้จริงไหม` }
  return { tone: 'ok', text: `อ่านสต็อกจาก ${label} ได้ ${n(side.platformSkus)} รหัส${planAt ? ` (ถามเมื่อ ${thaiClock(planAt)})` : ''}` }
}

/* ── 🔄 อัปเดตออโต้ — เวลายิงสำเร็จจริงเท่านั้น ── */
function autoBar(key: PlatformKey, log: BoardRound[] | null, logErr: string, now: number): Bar {
  if (log === null) return { tone: 'unknown', text: logErr ? 'อ่านประวัติการยิงไม่ได้ — ไม่รู้ว่ายิงสำเร็จล่าสุดเมื่อไหร่ (ไม่ได้แปลว่าไม่เคยยิง)' : 'กำลังอ่านประวัติการยิง…' }
  const ของเจ้านี้ = log.filter((r) => String(r.platform ?? '').toLowerCase() === key)
  const สำเร็จ = ของเจ้านี้
    .filter((r) => (N(r.pushed) ?? 0) > 0)
    .map((r) => ({ r, ms: serverTimeMs(r.at) }))
    .filter((x): x is { r: BoardRound; ms: number } => x.ms !== null)
    .sort((a, b) => b.ms - a.ms)
  const hasPusher = PUSHER_AT_WRITE_TIME[key] || สำเร็จ.length > 0
  if (!hasPusher) return { tone: 'unknown', text: 'ยังดันไม่ได้ — ไม่มีตัวยิง' }
  if (!สำเร็จ.length) return { tone: 'bad', text: `ยังไม่เคยยิงสำเร็จ${ของเจ้านี้.length ? ` (มี ${ของเจ้านี้.length} รอบที่ยิงแล้วไม่สำเร็จ)` : ''}${log.length >= 50 ? ' · ⚠️ log เก็บแค่ 50 รอบล่าสุด' : ''}` }

  const last = สำเร็จ[0]
  const age = now - last.ms
  const tone: Tone = age <= 3600e3 ? 'ok' : age <= 24 * 3600e3 ? 'warn' : 'bad'
  /* รอบที่ใหม่กว่ารอบสำเร็จล่าสุด แต่ถูกปฏิเสธ — ต้องเห็น ไม่งั้นเวลาสำเร็จเก่า ๆ ดูเหมือนแค่ "ยังไม่ถึงรอบ" */
  const ปฏิเสธหลังจากนั้น = ของเจ้านี้.filter((r) => (serverTimeMs(r.at) ?? 0) > last.ms && (N(r.rejected) ?? 0) > 0)
  return {
    tone: ปฏิเสธหลังจากนั้น.length ? 'bad' : tone,
    text: (
      <>
        ยิงสำเร็จล่าสุด <b>{thaiDateTime(last.r.at)}</b> ({ago(last.ms, now)})
        {tone === 'bad' && ' — ไม่มีรอบไหนยิงสำเร็จหลังจากนั้น ⇒ ตอนนี้ยังไม่ได้อัปเดตอัตโนมัติ'}
        {ปฏิเสธหลังจากนั้น.length > 0 && (
          <span className="block text-red-800 mt-0.5">⚠️ หลังจากนั้นมี {ปฏิเสธหลังจากนั้น.length} รอบที่ถูกปฏิเสธ</span>
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
  log: BoardRound[] | null; logLoading: boolean; logErr: string; logAt: number | null
  plan: Partial<Record<PlatformKey, BoardSide>> | null; planBusy: boolean; planErr: string; planAt: number | null
  onAsk: () => void
}) {
  const { log, logLoading, logErr, logAt, plan, planBusy, planErr, planAt, onAsk } = props
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
            อัปเดตออโต้วัดจาก<b>เวลายิงสำเร็จจริง</b> ไม่ได้ดูว่าเปิดสวิตช์ไว้
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
          const auto = autoBar(key, log, logErr, now)
          return (
            <div key={key} className="border border-gray-200 rounded-md p-2.5 space-y-1.5">
              <p className="text-[13px] font-semibold text-gray-900">{label}</p>
              <BarRow icon="🔗" name="เชื่อม" bar={linkBar(side, asked, planErr)} />
              {/* ⚠️ ไอคอนหน้าชื่อแถบห้ามเป็นดวงไฟสี — เดิมใช้ 🟢 ตายตัว วางข้าง "⬜ ไม่รู้" แล้วอ่านขัดกันเอง */}
              <BarRow icon="📶" name="ออนไลน์ — ระบบเรา" bar={oursBar(logLoading, logErr, logAt)} />
              <BarRow icon="📶" name={`ออนไลน์ — ${label}`} bar={channelBar(label, side, asked, planErr, planAt)} />
              <BarRow icon="🔄" name="อัปเดตออโต้" bar={auto} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
