'use client'
// ของค้างดันไม่ขึ้น — รายรหัส (18 ก.ย. 2569)
//
// ทำไมต้องมี: จอดันสต็อกเดิมตอบได้แค่ "รอบที่แล้วยิงอะไร" กับ "รอบหน้าจะยิงอะไร"
// แต่ตอบไม่ได้เลยว่า **รหัสที่ค้างมาหลายวันแล้วไม่เคยขึ้น มีตัวไหนบ้าง**
// (CTO ชี้ 18 ก.ย. 2569: "งานที่คุ้มจริงคือเคลียร์ของค้าง" แล้วเปิดเส้น ?pushstuck=1 ให้)
//
// โครงคำตอบจากการยิงของจริง 18 ก.ย. 2569 — ห้ามเดาชื่อคีย์:
//   ?pushstuck=1[&channel=&reason=&limit=&offset=]
//   → { ok, 'ทั้งหมดที่ตรงเงื่อนไข', applied, supportedFilters, 'กองในหน้านี้',
//       '⚠️ ขอบเขต', rows:[{sku,channel,skip_reason,skip_streak,skip_first_at,skip_last_at,
//                           last_error,last_error_at,planned_qty,pushed_qty,verified_qty}],
//       limitRequested, limitApplied, limitClamped, pagingDone, pagingNote, nextOffset }
//
// 🔴 **กองของท่อชื่อ "มี error จากแพลตฟอร์ม" แต่ 85/85 แถวในกองนั้นไม่ใช่ error**
//    ยิงของจริงวันนี้: reason=error → 85 แถว · ทุกแถว last_error เขียนว่า
//    "ทิศลง (down X→Y) ต้องสั่งแยกด้วย allowClose:true" = **เราเลือกไม่ส่งเอง**
//    ขณะที่ reason=policy_down → 0 แถว ทั้งที่หมายเหตุขอบเขตของท่อเองบอกว่า
//    "policy_down / cap_wait ไม่ใช่ error ห้ามนับรวมเป็นบั๊ก"
//    ⇒ จอนี้แยกให้เห็นเอง **โดยอ่านจากข้อความ last_error ไม่ใช่เดาจากจำนวน**
//    ⚠️ ถ้าท่อเปลี่ยนถ้อยคำ แถวจะตกกลับไปกอง "ยังบอกไม่ได้" ซึ่งเป็นฝั่งที่ปลอดภัย
//       (พลาดแล้วกลายเป็น "ไม่รู้" ดีกว่าพลาดแล้วกลายเป็น "ตั้งใจไม่ส่ง")
//
// 🗓️ **ตัวแยกกองฝั่งจอนี้มีวันหมดอายุ** — CEO แก้ที่ต้นทางให้แล้ว (commit แล้ว ยังไม่ deploy 18 ก.ย. 16:3x)
//    เพิ่ม `notSentKind` ที่ตัวยิง: policy_down/stale_plan ห้ามนับเป็น error · platform_error/unknown_id นับ
//    และ policy_down จะลง `skip_reason` ให้ด้วย ⇒ ฟังก์ชัน `กองของแถว()` ข้างล่างจะหยิบไปใช้เองทันที
//    เพราะมันอ่าน skip_reason **ก่อน** ข้อความ ⇒ ไม่ต้องแก้โค้ดตอนของขึ้น
//    🔴 **ห้ามถอดตัวอ่านข้อความออกก่อนเห็นของจริงบนเว็บ** (CEO กำชับเอง) — ช่วงคาบเกี่ยว
//       แถวเก่าที่ยังไม่ถูกเขียนทับจะกลับไปกอง error อีกครั้งถ้าถอดเร็วไป
//       เงื่อนไขถอด: เปิดจอแล้วกอง "ไม่ได้ส่งโดยตั้งใจ" ยังมีของครบโดยที่ `skip_reason` เป็น policy_down
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { BtnGhost, Pill } from '@/components/zort'
import { thaiDateTime } from '@/components/zort/PushStatusBoard'
/* ข้อความจากท่อมี **ดาวคู่** ติดมาด้วย — ต้องผ่านตัวนี้ ไม่งั้นดาวขึ้นจอ */
import PipeNote from '@/components/ui/PipeNote'

export interface StuckRow {
  sku?: string; channel?: string
  skip_reason?: string | null
  skip_streak?: number | null
  skip_first_at?: string | null
  skip_last_at?: string | null
  last_error?: string | null
  last_error_at?: string | null
  planned_qty?: number | null
  pushed_qty?: number | null
  verified_qty?: number | null
}
export interface StuckResp {
  ok?: boolean
  'ทั้งหมดที่ตรงเงื่อนไข'?: number | null
  'กองในหน้านี้'?: Record<string, number>
  '⚠️ ขอบเขต'?: string
  applied?: Record<string, unknown>
  supportedFilters?: string[]
  rows?: StuckRow[]
  limitApplied?: number; limitClamped?: boolean
  pagingDone?: boolean; pagingNote?: string; nextOffset?: number
  error?: string; skip?: string
}

/** เลขที่เชื่อได้ หรือ null — ไม่รู้ ≠ 0 (กฎเดียวกับทั้งจอ) */
const N = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const numText = (v: unknown) => { const n = N(v); return n === null ? '—' : n.toLocaleString('th-TH') }

/* ── กองที่จอจัดเอง ──
   เรียงจาก "ต้องลงมือ" ไป "ตั้งใจไว้แบบนั้น" — คนเปิดจอมาเพื่อหาว่าต้องแก้อะไร */
type GroupKey = 'negative' | 'unknown' | 'conflict' | 'error' | 'policy_down' | 'cap_wait' | 'other'
const GROUPS: Array<{ key: GroupKey; title: string; why: string; tone: 'red' | 'orange' | 'blue' | 'gray' }> = [
  { key: 'negative', title: 'คลังเราติดลบ', why: 'สต็อกในคลังเงาติดลบ ⇒ ไม่มีตัวเลขที่ปลอดภัยให้ดัน · ต้องแก้ที่ ZORT ก่อน', tone: 'red' },
  { key: 'unknown', title: 'คลังเราไม่รู้จักรหัสนี้', why: 'มีบนหน้าร้านแพลตฟอร์ม แต่ไม่มีในคลังเรา ⇒ ตัวเลขบนหน้าร้านค้างเก่าอยู่', tone: 'orange' },
  { key: 'conflict', title: 'ข้อมูลขัดกัน', why: 'ท่อบอกว่าข้อมูลสองฝั่งไม่ตรงกันจนตัดสินไม่ได้', tone: 'orange' },
  { key: 'error', title: 'มี error จริงจากแพลตฟอร์ม', why: 'แพลตฟอร์มปฏิเสธ ⇒ ต้องดูข้อความจริงทีละตัว', tone: 'red' },
  { key: 'policy_down', title: 'ไม่ได้ส่งโดยตั้งใจ — ทิศลง', why: 'เราเลือกไม่ส่งการลดสต็อกอัตโนมัติ ต้องสั่งแยกด้วย allowClose ⇒ ไม่ใช่บั๊ก แต่แปลว่าหน้าร้านค้างสูงกว่าจริง', tone: 'blue' },
  { key: 'cap_wait', title: 'ไม่ได้ส่ง — เกินเพดานรอบนี้', why: 'คิวยาวเกินเพดานต่อรอบ รอบถัดไปจะถูกหยิบเอง', tone: 'gray' },
  { key: 'other', title: 'ยังบอกไม่ได้ว่าติดที่อะไร', why: 'ท่อไม่ได้บอกเหตุ และข้อความก็อ่านไม่ออกว่าเป็นกองไหน — ไม่ได้แปลว่าไม่มีปัญหา', tone: 'gray' },
]

/** ทิศลงที่เราเลือกไม่ส่งเอง — อ่านจากข้อความที่ท่อส่งมา ไม่ใช่จากชื่อกองของท่อ */
const เป็นทิศลงที่ตั้งใจไม่ส่ง = (r: StuckRow) => /ทิศลง|allowClose/.test(r.last_error || '')

function กองของแถว(r: StuckRow): GroupKey {
  const reason = typeof r.skip_reason === 'string' ? r.skip_reason : ''
  if (reason === 'negative' || reason === 'unknown' || reason === 'conflict') return reason
  if (reason === 'policy_down' || reason === 'cap_wait') return reason
  /* ท่อยัดแถวทิศลงไว้ในกอง error — จอแยกออกมาเองจากข้อความ */
  if (r.last_error) return เป็นทิศลงที่ตั้งใจไม่ส่ง(r) ? 'policy_down' : 'error'
  return 'other'
}

const วันที่ค้าง = (r: StuckRow) => {
  const first = r.skip_first_at ? Date.parse(r.skip_first_at) : NaN
  if (!Number.isFinite(first)) return null
  return Math.floor((Date.now() - first) / 86400000)
}

/* ── ต้นเหตุของกอง "คลังเราติดลบ" ──────────────────────────────────
   🔴 **เจอของจริง 18 ก.ย. 2569 · นี่คือเหตุผลทั้งหมดที่ก้อนนี้มีอยู่**
      กองติดลบมี 59 แถว / 29 รหัส — ดูเหมือนงานใหญ่
      แต่ 24 ใน 29 รหัสเป็น **รหัสแปรของมาร์เก็ตเพลส** (`01209-22.5T` …)
      ที่ไม่มีแถวของตัวเองในคลังเงาเลย · ตัวที่ติดลบจริงคือ **รหัสฐาน** (`01209` = -134.5)
      ⇒ ของค้างทั้ง 59 แถว มาจากสินค้าจริงแค่ **7 ตัว** และแก้ `01209` ตัวเดียวปลดได้ 44 แถว
      (พิสูจน์แล้ว 24/24 ไม่มีข้อยกเว้น — รหัสฐานของทุกตัวอยู่ในรายการติดลบจริง)
   🔴 **และนี่คือโรคข้อ 4 ของ CLAUDE.md ข้ามจอ**: จอคลังหน้า `only=neg` บอกว่าติดลบ 22 รหัส
      กองดันไม่ขึ้นบอก 29 รหัส · **ซ้อนกันแค่ 5** ⇒ คนที่ถูกสั่งให้ "ไปแก้ของติดลบ"
      เปิดจอคลังแล้วแก้ครบ 22 ตัว จะยังเหลือตัวขวางการดันอีก 24 รหัสโดยไม่มีอะไรบอก
   ⚠️ **ห้ามจับคู่ด้วยการตัดที่ขีดกลางเฉย ๆ** — นั่นคือการเดากติกาการตั้งรหัส
      จอจะยอมรับว่าเป็นต้นเหตุ **ก็ต่อเมื่อรหัสฐานนั้นอยู่ในรายการติดลบจริงจากท่อ**
      จับคู่ไม่ได้ ⇒ นับแยกและพูดออกมา ไม่ใช่เดาให้เข้าพวก */
interface NegRow { sku?: string; qty?: number | null; available?: number | null; name?: string }
interface NegResp { ok?: boolean; rows?: NegRow[]; shown?: number; error?: string; skip?: string }

export default function StuckPushList() {
  const [d, setD] = useState<StuckResp | null>(null)
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<GroupKey | ''>('')
  /** รหัสที่คลังเงาบอกว่าติดลบ → จำนวนคงเหลือ · null = ยังไม่รู้ (ถามไม่ได้/ท่อไม่มีตัวกรองนี้) */
  const [neg, setNeg] = useState<Map<string, number | null> | null>(null)

  const load = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      /* limit=200 — วันที่เขียนมีของค้าง 176 รหัส ⇒ ขอทีเดียวจบ
         แต่ **ห้ามสมมติว่าจบ** จอเช็ค pagingDone แล้วพูดออกมาถ้ายังไม่จบ */
      const res = await fetch('/api/web/core?pushstuck=1&limit=200')
      const j = (await res.json().catch(() => null)) as StuckResp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(SKIP + j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(j.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      setD(j)
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); setD(null) } finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])

  /* รายการติดลบจากคลังเงา — โหลดแยก ล้มเหลวได้โดยไม่ทำให้ทั้งก้อนพัง
     (ถามไม่ได้ ⇒ ไม่โชว์ส่วนต้นเหตุ ไม่ใช่โชว์ว่าไม่มีต้นเหตุ) */
  useEffect(() => {
    let ทิ้งแล้ว = false
    ;(async () => {
      try {
        const res = await fetch('/api/web/core?list=stock&only=neg&limit=200')
        const j = (await res.json().catch(() => null)) as NegResp | null
        if (ทิ้งแล้ว || !j || !res.ok || j.error || !Array.isArray(j.rows)) return
        const m = new Map<string, number | null>()
        for (const r of j.rows) {
          if (!r.sku) continue
          const q = typeof r.qty === 'number' ? r.qty : typeof r.available === 'number' ? r.available : null
          m.set(r.sku, q)
        }
        setNeg(m)
      } catch { /* เงียบโดยตั้งใจ — ส่วนต้นเหตุจะไม่ขึ้น ซึ่งตรงกับความจริงว่ายังไม่รู้ */ }
    })()
    return () => { ทิ้งแล้ว = true }
  }, [])

  const rows = d?.rows ?? []
  const total = N(d?.['ทั้งหมดที่ตรงเงื่อนไข'])
  const ครบหน้าเดียว = d?.pagingDone === true
  const bucket = (k: GroupKey) => rows.filter((r) => กองของแถว(r) === k)

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <p className="text-[14px] font-semibold text-gray-900">ของค้างดันไม่ขึ้น — รายรหัส</p>
          <p className="text-[11.5px] text-gray-400 mt-0.5">
            รหัสที่รอบก่อน ๆ ดันไม่สำเร็จหรือถูกข้าม · อ่านจากสมุดสถานะ ไม่ได้ยิงแพลตฟอร์มใหม่
          </p>
        </div>
        <BtnGhost onClick={load} disabled={busy}>{busy ? 'กำลังโหลด…' : 'โหลดใหม่'}</BtnGhost>
      </div>

      {err && <div className="mt-2"><ErrorBox title={isSkip(err) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดูของค้างไม่ได้'}>{err}</ErrorBox></div>}
      {busy && <LoadingState />}

      {!busy && d && (
        <>
          <p className="text-[22px] font-black text-gray-900 tabular-nums leading-tight mt-1">
            {numText(total)}
            <span className="text-[12px] font-normal text-gray-500 ml-1.5">รหัสค้างอยู่ตอนนี้</span>
          </p>

          {/* 🔴 เลขรวมมาจากท่อ (ทั้งชุด) แต่แถวที่กองอยู่ข้างล่างมาจากหน้านี้
              ⇒ ถ้ายังไม่จบหน้า **ต้องเขียนบนจอ** ห้ามวางคู่กันเฉย ๆ (กฎแท็บข้อ 4) */}
          {!ครบหน้าเดียว && (
            <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5">
              ⚠️ <b>เลขรวมกับรายการข้างล่างมาคนละชุด</b> — เลข {numText(total)} คือทั้งชุด
              แต่รายการที่จัดกองข้างล่างนับจาก {rows.length} แถวที่ขอมาได้รอบนี้เท่านั้น
              {d.pagingNote ? <> · <PipeNote>{d.pagingNote}</PipeNote></> : ''}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            {GROUPS.map((g) => {
              const list = bucket(g.key)
              if (!list.length) return null
              const on = open === g.key
              return (
                <button key={g.key} onClick={() => setOpen(on ? '' : g.key)}
                  className={`text-left border rounded-md p-2.5 ${on ? 'border-gray-800 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                  <span className="flex items-baseline gap-1.5">
                    <Pill tone={g.tone}>{list.length.toLocaleString('th-TH')}</Pill>
                    <span className="text-[12.5px] font-semibold text-gray-800">{g.title}</span>
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-1 leading-relaxed">{g.why}</span>
                </button>
              )
            })}
          </div>

          {/* ── ต้นเหตุของกองติดลบ — เปลี่ยนกำแพงรหัสให้เป็นรายการที่ลงมือได้ ──
              เรียงตาม "แก้ตัวนี้แล้วปลดได้กี่แถว" เพราะคนมีเวลาจำกัดต้องรู้ว่าเริ่มตรงไหน */}
          {(() => {
            if (!neg) return null
            const ติดลบ = bucket('negative')
            if (!ติดลบ.length) return null
            /* ยอมรับเป็นต้นเหตุเฉพาะรหัสที่ท่อยืนยันว่าติดลบจริง — ห้ามเดาจากรูปแบบรหัส */
            const ต้นเหตุของ = (sku?: string) => {
              if (!sku) return null
              if (neg.has(sku)) return sku
              const ฐาน = sku.split('-')[0]
              return ฐาน !== sku && neg.has(ฐาน) ? ฐาน : null
            }
            const นับ = new Map<string, number>()
            let หาไม่เจอ = 0
            for (const r of ติดลบ) {
              const b = ต้นเหตุของ(r.sku)
              if (!b) { หาไม่เจอ++; continue }
              นับ.set(b, (นับ.get(b) ?? 0) + 1)
            }
            const เรียง = Array.from(นับ.entries()).sort((a, b) => b[1] - a[1])
            if (!เรียง.length && !หาไม่เจอ) return null
            return (
              <div className="mt-2 border border-red-200 bg-red-50 rounded-md px-3 py-2.5">
                {/* 🔴 **ทดสอบแล้วเจอถ้อยคำที่โกหกเอง** (18 ก.ย. 2569 · บีบให้จับคู่ไม่ได้)
                    ฉบับแรกเขียน "มาจากสินค้าจริง 0 ตัว" พร้อมคำอธิบายเรื่องรหัสฐานเต็ม ๆ
                    ทั้งที่ตอนนั้นจอ **จับคู่ไม่ได้สักแถว** ⇒ อ่านได้ว่าไม่มีต้นเหตุ = ตรงข้ามกับความจริง
                    ⇒ ไม่มีของให้สรุป ห้ามขึ้นหัวข้อสรุป */}
                {เรียง.length > 0 && (
                  <>
                    <p className="text-[12.5px] font-semibold text-red-900">
                      🎯 ของค้าง {ติดลบ.length} แถวในกองติดลบ มาจากสินค้าจริง {เรียง.length} ตัว
                    </p>
                    <p className="text-[11.5px] text-red-800 mt-0.5 leading-relaxed">
                      รหัสแปรของมาร์เก็ตเพลสไม่มีสต็อกของตัวเอง — มันติดลบตาม<b>รหัสฐาน</b>
                      {' '}⇒ แก้ที่รหัสฐานทีเดียวปลดได้ทั้งพวง · <b>จอคลังหน้าของหมดไม่ได้โชว์รหัสแปรพวกนี้</b>
                    </p>
                  </>
                )}
                {เรียง.length === 0 && (
                  <p className="text-[12.5px] font-semibold text-red-900">
                    🔎 ยังบอกไม่ได้ว่าของค้าง {ติดลบ.length} แถวในกองติดลบมาจากสินค้าตัวไหน
                  </p>
                )}
                <div className="mt-1.5 space-y-0.5">
                  {เรียง.map(([sku, n]) => (
                    <div key={sku} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                      <span className="font-mono font-semibold text-red-900">{sku}</span>
                      <span className="text-red-700 tabular-nums">คงเหลือ {numText(neg.get(sku))}</span>
                      <span className="text-red-800">⇒ ปลดได้ <b>{n}</b> แถว</span>
                    </div>
                  ))}
                </div>
                {/* จับคู่ไม่ได้ต้องพูดออกมา — ไม่งั้นคนเชื่อว่ารายการข้างบนครอบคลุมทั้งกอง */}
                {หาไม่เจอ > 0 && (
                  <p className="text-[11.5px] text-red-900 mt-1.5">
                    ⚠️ อีก <b>{หาไม่เจอ}</b> แถว<b>ยังจับคู่ต้นเหตุไม่ได้</b> — คลังเงาไม่ได้บอกว่ารหัสนี้หรือรหัสฐานติดลบ
                    {' '}⇒ ต้องตามด้วยมือ ไม่ใช่ไม่มีปัญหา
                  </p>
                )}
              </div>
            )
          })()}

          {/* 🔴 กองของท่อเรียกทั้ง 85 แถวว่า error ทั้งที่ข้อความบอกเองว่าเป็นทิศลงที่เราไม่ส่ง
              ⇒ พูดออกมาบนจอ ไม่ใช่แก้เงียบ ๆ แล้วปล่อยให้ตัวเลขสองที่ไม่ตรงกัน */}
          {rows.some(เป็นทิศลงที่ตั้งใจไม่ส่ง) && (
            <p className="text-[11.5px] text-blue-900 bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5 mt-2 leading-relaxed">
              📖 <b>{rows.filter(เป็นทิศลงที่ตั้งใจไม่ส่ง).length} รหัสถูกย้ายกองโดยจอนี้</b> — ท่อจัดไว้ในกอง
              <code className="mx-1">reason=error</code>แต่ข้อความของมันเขียนว่า
              &ldquo;ทิศลง … ต้องสั่งแยกด้วย allowClose&rdquo; = <b>เราเลือกไม่ส่งเอง ไม่ใช่แพลตฟอร์มปฏิเสธ</b>
              {' '}· ผลที่ตามมาจริง: <b>สต็อกบนหน้าร้านค้างสูงกว่าคลังเรา</b> ⇒ เสี่ยงขายเกิน
            </p>
          )}

          {open && (() => {
            const g = GROUPS.find((x) => x.key === open)!
            const list = bucket(open)
            return (
              <div className="mt-3 border border-gray-200 rounded-md overflow-x-auto">
                <p className="text-[12.5px] font-semibold text-gray-800 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  {g.title} — {list.length.toLocaleString('th-TH')} รหัส
                </p>
                <table className="w-full min-w-[620px] text-[12px]">
                  <thead className="bg-white border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">รหัส</th>
                      <th className="text-left px-3 py-1.5 font-medium">ช่องทาง</th>
                      <th className="text-right px-3 py-1.5 font-medium">ข้ามติดกัน</th>
                      <th className="text-left px-3 py-1.5 font-medium">ค้างมาตั้งแต่</th>
                      <th className="text-left px-3 py-1.5 font-medium">ข้อความล่าสุดจากท่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r, i) => {
                      const วัน = วันที่ค้าง(r)
                      return (
                        <tr key={`${r.sku ?? i}-${r.channel ?? ''}`} className="border-b border-[#e8ecf8] last:border-0">
                          <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-800">{r.sku || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{r.channel || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                            {numText(r.skip_streak)}{N(r.skip_streak) !== null ? ' รอบ' : ''}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500" title={r.skip_first_at ? `ค่าที่ท่อส่งมา: ${r.skip_first_at}` : undefined}>
                            {r.skip_first_at ? `${thaiDateTime(r.skip_first_at)}${วัน === null ? '' : วัน === 0 ? ' (วันนี้)' : ` (${วัน} วัน)`}` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 break-words max-w-[280px]">{r.last_error || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* ขอบเขตต้องมาจากท่อ ห้ามพิมพ์ตายไว้ — ท่อแก้กติกาเมื่อไหร่จอจะโกหกทันที */}
          {d['⚠️ ขอบเขต'] && (
            <p className="text-[11.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-3 leading-relaxed">
              ⚠️ <PipeNote>{d['⚠️ ขอบเขต']}</PipeNote>
            </p>
          )}
          {rows.length === 0 && (
            <p className="text-[12.5px] text-emerald-700 mt-2">ไม่มีรหัสค้างในสมุดสถานะตอนนี้</p>
          )}
        </>
      )}
    </div>
  )
}
