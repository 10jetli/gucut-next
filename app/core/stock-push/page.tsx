'use client'
// ดันสต็อกขึ้นแพลตฟอร์ม — ประวัติ + ตรวจว่าถึงหน้าร้านจริง (8 ก.ย. 2569)
//
// เกิดหลังหมุดแรกของฝั่ง "เขียน": ดัน Lazada สำเร็จ 16/16 (canary จับ E0501 ที่ไม่มีเอกสารบอก)
// โครงคำตอบจาก payload จริงที่ CEO ส่งให้ก่อนเขียนจอ — ห้ามเดาชื่อคีย์:
//   ?stockpushlog=1 → {ok, log:[{at(ISO), platform, fired, pushed, rejected, rows:[{sku,from,to,kind}]}]}
//     log ใหม่สุดอยู่หัว เก็บ 50 รอบ · kind ∈ reopen|up|down|close
//   ?stockpushverify=<skus,comma> → {ok, landed:[sku], notLanded:[{sku, 'ยังต้องดัน':'x→y'}], note}
//
// 🔴 **จอนี้ไม่มีปุ่มยิงจริงโดยตั้งใจ — ห้ามเพิ่มกลับ** (ยืนยันกับท่อ 8 ก.ย. 2569)
//    การยิง stockpushlive = การเขียนของจริงออกนอกระบบ ต้องเป็นการอนุมัติรายครั้งของ
//    เจ้าของร้านผ่าน AI ที่กางแผนสดให้ดูก่อน · ปุ่มบนจอ = ของที่กดง่ายกว่าคิด
//    (วันเดียวกันเพิ่งเจอมือลั่นบนกระดานงานสองรอบ) · จอทำแค่ ดู + verify
//    อยากดันรอบใหม่ → ติ๊กสั่งงานบนกระดานที่ 2.gucut.com (เรียกทีม ไม่ยิงเอง)
//    (เดิมชี้ /office — ท่านประธานสั่งลบหน้านั้น 14 ก.ย. 2569 เพราะย้ายไป 2.gucut.com แล้ว)
//
// ⚠️ log จดเฉพาะแถวที่ fired — แถว not_sent/rejected รายตัวไม่อยู่ใน log
//    (อยู่ในคำตอบตอนยิงเท่านั้น) จอต้องบอกข้อจำกัดนี้ตรง ๆ ห้ามให้คนอ่านเข้าใจว่าเห็นครบ
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill } from '@/components/zort'
import { thaiDate } from '@/lib/format'
/* serverTimeMs อยู่ใน returns-api (เกิดจากบั๊กโซนเวลาตอนประกบ /returns) — ตัวเดียวกันใช้ทุกจอ */
import PushStatusBoard, { thaiDateTime, มีตัวยิง, type PushStateResp } from '@/components/zort/PushStatusBoard'

interface PushRow { sku?: string; from?: number; to?: number; kind?: string }
interface PushRound {
  at?: string; platform?: string
  fired?: number; pushed?: number; rejected?: number
  rows?: PushRow[]
}
interface LogResp { ok?: boolean; log?: PushRound[]; error?: string; skip?: string }
interface VerifyResp {
  ok?: boolean; landed?: string[]
  notLanded?: Array<{ sku?: string; 'ยังต้องดัน'?: string }>
  note?: string; error?: string; skip?: string
}

/* ── แผนรอบถัดไป (ซ้อม) — โครงจากการยิง ?stockpush=1 ของจริง 11 ก.ย. 2569 ห้ามเดาชื่อคีย์ ──
   ทุกช่องเป็น optional เพราะท่ออาจเพิ่ม/ลดได้ และ **ไม่มีค่า ≠ ศูนย์** (จอต้องขึ้นขีด) */
interface PlanSample { sku?: string; name?: string; from?: number; to?: number; delta?: number; kind?: string }
interface PlanSide {
  platformSkus?: number; same?: number; wouldPush?: number
  reopen?: number; close?: number; up?: number; down?: number
  skipNegative?: number; skipUnknown?: number
  /** 🔴 ท่อส่งมาจริงตั้งแต่แรก แต่จอไม่มีช่องนี้และไม่เคยแสดงเลย (เจอ 14 ก.ย. 2569)
   *  ⇒ มีกองที่ถูกข้ามทั้งกองที่คนอ่านจอมองไม่เห็น · วันที่เจอ shopee มี 1 รหัส */
  skipConflict?: number
  /** ท่อคิดให้แล้วว่ากองย่อยบวกกันได้ยอดรวมไหม — **false = ห้ามเชื่อตัวเลขรอบนั้น** */
  bucketsAddUp?: boolean
  day?: string
  pushSample?: PlanSample[]
  /* ── สัญญาท่อ-จอ 14 ก.ย. 2569 (ทาง 1: ขอแผนเต็มรายแพลตฟอร์ม) ──
     ท่อส่งสี่ช่องนี้มาทุกเจ้าทุกคำตอบ · `full=1` ต้องระบุ platform ไม่งั้นตอบ 400
     🔴 **แผนที่เป็น skip หรือ error จะไม่มีสี่ช่องนี้ — ห้ามอ่านว่าครบ** (ท่อกำชับเอง)
        ⇒ จอต้องแยก "ท่อบอกว่าครบ" ออกจาก "ท่อไม่ได้บอก" · ไม่มีค่า = ไม่รู้ ไม่ใช่ครบ */
  pushScope?: 'sample' | 'full'
  pushShown?: number
  pushCapped?: boolean
  pushComplete?: boolean
  skipNegativeSample?: PlanSample[] | string[]
  skipUnknownSample?: PlanSample[] | string[]
  skipConflictSample?: PlanSample[] | string[]
  /** เฉพาะ Lazada — กองที่ถูกตัดออกก่อนคิดแผน (ต้องโชว์ ห้ามซ่อน) */
  excludedGuess?: number; excludedOneToMany?: number; excludedOneToManyKeys?: number
  sameOnRecheck?: number
  skip?: string
}
interface PlanResp {
  ok?: boolean; mode?: string
  shopee?: PlanSide; lazada?: PlanSide; tiktok?: PlanSide
  safetyNote?: string; readNote?: string
  error?: string; skip?: string
}

const PLATFORMS: Array<{ key: 'shopee' | 'lazada' | 'tiktok'; label: string }> = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'lazada', label: 'Lazada' },
  { key: 'tiktok', label: 'TikTok' },
]

/** เลขที่เชื่อได้ หรือ null — **ห้ามแปลงค่าที่ไม่มีเป็น 0** (0 แปลว่า "ไม่มีอะไรต้องทำ") */
const N = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const numText = (v: unknown) => {
  const n = N(v)
  return n === null ? '—' : n.toLocaleString('th-TH')
}

const KIND: Record<string, { text: string; tone: 'blue' | 'green' | 'orange' | 'red' | 'gray' }> = {
  reopen: { text: 'เปิดขายอีกครั้ง', tone: 'blue' },
  up: { text: 'เพิ่ม', tone: 'green' },
  down: { text: 'ลด', tone: 'orange' },
  close: { text: 'ปิดกันขายเกิน', tone: 'red' },
}

/* ตัวแปลงเวลาไทยย้ายไปอยู่ที่กระดานสถานะ — ใช้ชุดเดียวกันทั้งจอ (log เก็บเวลาเป็น UTC) */
const thaiTime = thaiDateTime


/* รายการรหัสในกองที่ถูกข้าม — เลขอย่างเดียวตรวจอะไรไม่ได้
   🔴 **ปัญหาที่ตัวนี้เกิดมาแก้** (14 ก.ย. 2569 · งานกระดาน t_mtxxib66)
      จอโชว์ "ข้าม — คลังเราไม่รู้จักรหัสนี้ 10" แต่ **ไม่เคยแสดงว่าเป็นรหัสไหน**
      (ชนิดข้อมูล skipUnknownSample ประกาศไว้ตั้งแต่แรก แต่ไม่มีใครเอามาใช้)
      ⇒ คนที่สงสัยว่า "กองไม่รู้จักหลุดเข้าแผนหรือเปล่า" ตรวจเองไม่ได้เลย ต้องไปถามฝั่งท่อทุกครั้ง
   ⚠️ **มีเลขแต่ไม่มีรายการ ต้องพูดออกมา** — ไม่ใช่ไม่แสดงอะไรเลย
      ของจริงที่เจอ: lazada บอก skipUnknown 10 แต่ส่งตัวอย่างมา 0 แถว
      ขณะที่ shopee 15→15 และ tiktok 7→7 ส่งครบ ⇒ ถ้าเงียบ คนจะนึกว่ากองนั้นว่าง */
const rowsOf = (p?: PlanSide) => (Array.isArray(p?.pushSample) ? p!.pushSample : [])

function SkipBucket({ label, count, sample }: { label: string; count?: number; sample?: PlanSample[] | string[] }) {
  const n = N(count)
  if (n === null || n === 0) return null
  const rows = Array.isArray(sample) ? sample : []
  const skus = rows.map((r) => (typeof r === 'string' ? r : r?.sku)).filter(Boolean) as string[]
  return (
    <details className="mt-1.5 border border-gray-200 rounded">
      <summary className="text-[11.5px] text-gray-600 px-2 py-1 cursor-pointer">
        {label} — {numText(count)} รหัส{' '}
        <span className="text-gray-400">
          {skus.length ? `(ดูตัวอย่าง ${skus.length}${skus.length < n ? ` จาก ${numText(count)}` : ''})` : '(ท่อไม่ได้ส่งรายการมา)'}
        </span>
      </summary>
      <div className="px-2 py-1.5">
        {skus.length ? (
          <p className="text-[11px] font-mono text-gray-600 break-all leading-relaxed">{skus.join(' · ')}</p>
        ) : (
          <p className="text-[11.5px] text-amber-800">
            ⚠️ ท่อบอกว่ามี <b>{numText(count)}</b> รหัสในกองนี้ แต่<b>ไม่ได้ส่งรายการมาด้วย</b>
            {' '}⇒ ตรวจเองไม่ได้ว่าเป็นรหัสไหน · <b>ไม่ได้แปลว่ากองนี้ว่าง</b>
          </p>
        )}
      </div>
    </details>
  )
}

export default function StockPushPage() {
  const [log, setLog] = useState<PushRound[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* ผล verify ต่อรอบ — คีย์ = at ของรอบ */
  const [verify, setVerify] = useState<Record<string, VerifyResp | 'busy'>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/web/core?stockpushlog=1')
      const d = (await res.json().catch(() => null)) as LogResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof d.skip === 'string') throw new Error(SKIP + d.skip)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(d.log)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี log)')
      setLog(d.log)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); setLog(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  /* ── สมุดสถานะดันสต็อก (`?pushstate=1` · CEO 17 ก.ย. 2569) ──
     ✅ **อ่านฐานอย่างเดียว ไม่ยิงแพลตฟอร์ม เร็ว ⇒ โหลดตอนเปิดหน้าได้** (ต่างจาก `?stockpush=1` ที่ต้องกดเอง) */
  const [pstate, setPstate] = useState<PushStateResp | null>(null)
  const [pstateLoading, setPstateLoading] = useState(true)
  const [pstateErr, setPstateErr] = useState('')
  const loadState = useCallback(async () => {
    setPstateLoading(true); setPstateErr('')
    try {
      const res = await fetch('/api/web/core?pushstate=1')
      const d = (await res.json().catch(() => null)) as PushStateResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof d.skip === 'string') throw new Error(SKIP + d.skip)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      /* inconclusive = ต่อฐานไม่ได้ ⇒ เก็บไว้ให้กระดานพูดเองว่า "อ่านสมุดไม่ได้" ไม่ใช่โยนทิ้งเป็น error ลอย ๆ */
      if (!d.inconclusive && d.ok !== true) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี ok)')
      setPstate(d)
    } catch (e) { setPstateErr(String(e instanceof Error ? e.message : e)); setPstate(null) } finally { setPstateLoading(false) }
  }, [])
  useEffect(() => { loadState() }, [loadState])

  /* ── แผนรอบถัดไป (ซ้อม) ──
     🔴 **กดเองเท่านั้น ห้ามโหลดตอนเปิดจอ** — เส้นนี้ไปกวาดของจริงทั้งสามแพลตฟอร์ม
        (ยิงจริงวัดได้ ~15-25 วิ) เปิดจอแล้วยิงเองทุกครั้ง = จ่ายค่ากวาดฟรีทุกครั้งที่มีคนแวะดู
        และขัดกติกาหน้าจอต้องกดเองของร้านอยู่แล้ว
     ⚠️ ซ้อมอย่างเดียว — เส้นนี้ไม่เขียนอะไรกลับแพลตฟอร์ม (ท่อเขียนกำกับมาในคีย์ mode) */
  const [plan, setPlan] = useState<PlanResp | null>(null)
  const [planBusy, setPlanBusy] = useState(false)
  const [planErr, setPlanErr] = useState('')
  const [planAt, setPlanAt] = useState<number | null>(null)
  const loadPlan = useCallback(async () => {
    setPlanBusy(true); setPlanErr('')
    try {
      const res = await fetch('/api/web/core?stockpush=1')
      const d = (await res.json().catch(() => null)) as PlanResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof d.skip === 'string') throw new Error(SKIP + d.skip)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      /* 🔴 ตอบ 200 แต่ไม่มีแพลตฟอร์มไหนเลย = ยังบอกไม่ได้ว่าไม่มีอะไรต้องดัน
         (สถานะที่สี่: สำเร็จแต่ตอบก้อนเปล่า — เคยกัดมาแล้วหลายจอ) */
      if (!PLATFORMS.some((p) => d[p.key] && typeof d[p.key] === 'object'))
        throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีข้อมูลของแพลตฟอร์มไหนเลย) — ยังบอกไม่ได้ว่าต้องดันอะไร')
      setPlan(d)
      setPlanAt(Date.now())
    } catch (e) { setPlanErr(String(e instanceof Error ? e.message : e)); setPlan(null) } finally { setPlanBusy(false) }
  }, [])

  /* ขอแผน **เต็ม** ของเจ้าเดียว — ใช้ตอนจะอนุมัติจริง
     🔴 ตัวอย่าง 25 แถวพอสำหรับ "ดูว่าหน้าตาเป็นยังไง" แต่ **ไม่พอสำหรับอนุมัติ**
        คนอนุมัติต้องเห็นทุกแถวที่ตัวเองกำลังอนุมัติ (กฎเดิม: เพดานที่ตั้งไว้กันเกินเวลา
        ห้ามเอาไปใช้ตัดสินใจ — เคสตะไบ 00313 หลุดอันดับเพราะเพดาน 25 ใบ)
     ⚠️ ถามทีละเจ้าโดยตั้งใจ — ท่อจะได้กวาดเจ้าเดียวแทนที่จะกวาดทั้งสาม (15-25 วิ) */
  const [fullBusy, setFullBusy] = useState<string>('')
  const loadFull = useCallback(async (key: 'shopee' | 'lazada' | 'tiktok') => {
    setFullBusy(key); setPlanErr('')
    try {
      const res = await fetch(`/api/web/core?stockpush=1&platform=${key}&full=1`)
      const d = (await res.json().catch(() => null)) as PlanResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      const side = d[key]
      if (!side || typeof side !== 'object') throw new Error(`ท่อไม่ได้ส่งข้อมูลของ ${key} มา`)
      setPlan((cur) => (cur ? { ...cur, [key]: side } : d))
    } catch (e) { setPlanErr(String(e instanceof Error ? e.message : e)) } finally { setFullBusy('') }
  }, [])

  const runVerify = useCallback(async (round: PushRound) => {
    const key = round.at ?? ''
    const skus = (round.rows ?? []).map((r) => r.sku).filter(Boolean) as string[]
    if (!skus.length) return
    setVerify((v) => ({ ...v, [key]: 'busy' }))
    try {
      const res = await fetch(`/api/web/core?stockpushverify=${encodeURIComponent(skus.join(','))}`)
      const d = (await res.json().catch(() => null)) as VerifyResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(d.landed) || !Array.isArray(d.notLanded))
        throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี landed/notLanded)')
      setVerify((v) => ({ ...v, [key]: d }))
    } catch (e) {
      setVerify((v) => ({ ...v, [key]: { error: String(e instanceof Error ? e.message : e) } }))
    }
  }, [])

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ดันสต็อกขึ้นแพลตฟอร์ม"
        summary={
          <>
            ประวัติการดันสต็อกจากคลังเงาขึ้นหน้าร้านแพลตฟอร์ม + ตรวจว่าถึงจริง
            {' | '}
            <span className="text-gray-400">งานเขียนชิ้นแรกที่ทำแทน ZORT — Lazada เปิดใช้แล้ว 8 ก.ย. 2569</span>
          </>
        }
        actions={<BtnGhost onClick={() => { load(); loadState() }} disabled={loading || pstateLoading}>{loading || pstateLoading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* 🔴 **เดิมตรงนี้เป็นป้ายเขียนตายตัว** "✅ Lazada — ยิงจริงแล้ว (16/16 · 8 ก.ย. 2569)"
          ⇒ เขียวค้างตลอดไม่ว่าของจริงจะหยุดยิงไปกี่วัน = สิ่งที่ท่านประธานบ่นว่า "ไม่ออโต้" แต่จอไม่เคยบอก
          ⇒ แทนด้วยกระดานที่วัดจากข้อมูลจริง (ท่านประธานอนุมัติ 17 ก.ย. 2569) */}
      <PushStatusBoard
        state={pstate} stateLoading={pstateLoading} stateErr={pstateErr}
        plan={plan} planBusy={planBusy} planErr={planErr} planAt={planAt}
        onAsk={loadPlan}
      />

      {/* 🔴 ไม่มีปุ่มยิงจริง — บอกทางที่ถูกแทน */}
      <p className="text-[12px] text-blue-900 bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2 mb-4 leading-relaxed">
        จอนี้<b>ดูอย่างเดียวโดยตั้งใจ</b> — การดันรอบใหม่เป็นการอนุมัติรายครั้งของเจ้าของร้าน
        ผ่าน AI ที่กางแผนสดให้ดูก่อน ไม่ใช่ปุ่มบนจอ · อยากดันรอบใหม่: กด{' '}
        <a href="https://2.gucut.com" target="_blank" rel="noreferrer" className="underline font-semibold">ติ๊กสั่งงานบนกระดานที่ 2.gucut.com</a>
      </p>

      {/* ══ แผนรอบถัดไป (ซ้อม) — "ทำให้พร้อมกดจริง แต่ยังไม่กด" (ท่านประธานสั่ง 11 ก.ย. 2569) ══
          หน้าที่ของก้อนนี้: ตอบให้ได้ว่า **ถ้ากดตอนนี้จะเกิดอะไร** ก่อนมีใครกด
          ⚠️ ตัวเลขทุกตัวมาจากท่อ ห้ามจอคิดเอง · ไม่มีค่า = ขีด ไม่ใช่ 0 */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <p className="text-[14px] font-semibold text-gray-900">แผนดันรอบถัดไป (ซ้อม — ไม่เขียนอะไรกลับแพลตฟอร์ม)</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">
              ถามท่อว่า &ldquo;ถ้าดันตอนนี้จะเกิดอะไร&rdquo; · ใช้เวลาราว 15-25 วิ เพราะกวาดของจริงทั้งสามเจ้า
            </p>
          </div>
          <BtnGhost onClick={loadPlan} disabled={planBusy}>
            {planBusy ? 'กำลังถาม…' : plan ? 'ถามใหม่อีกครั้ง' : 'ดูแผนรอบถัดไป'}
          </BtnGhost>
        </div>

        {planErr && <div className="mt-2"><ErrorBox title={isSkip(planErr) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดูแผนไม่ได้'}>{planErr}</ErrorBox></div>}
        {planBusy && <LoadingState />}

        {!planBusy && !plan && !planErr && (
          <p className="text-[12.5px] text-gray-400 mt-2">ยังไม่ได้ถาม — กดปุ่มด้านขวาเพื่อดูว่ารอบถัดไปจะดันอะไรบ้าง</p>
        )}

        {!planBusy && plan && (
          <>
            {plan.mode && <p className="text-[11.5px] text-emerald-700 mt-1 mb-2">🔒 {plan.mode}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PLATFORMS.map(({ key, label }) => {
                const p = plan[key]
                /* สามสถานะ: ท่อไม่ส่งเจ้านี้มา ≠ ส่งมาแต่บอก skip ≠ ส่งแผนมาจริง */
                if (!p || typeof p !== 'object') {
                  return (
                    <div key={key} className="border border-gray-200 rounded-md p-3">
                      <p className="text-[13px] font-semibold text-gray-800">{label}</p>
                      <p className="text-[12px] text-gray-400 mt-1">ท่อไม่ได้ส่งแผนของเจ้านี้มา — ยังบอกไม่ได้ว่าต้องดันอะไร</p>
                    </div>
                  )
                }
                if (typeof p.skip === 'string') {
                  return (
                    <div key={key} className="border border-amber-200 bg-amber-50 rounded-md p-3">
                      <p className="text-[13px] font-semibold text-amber-900">{label}</p>
                      <p className="text-[12px] text-amber-800 mt-1">⏳ {p.skip}</p>
                    </div>
                  )
                }
                const would = N(p.wouldPush)
                const writer = มีตัวยิง(pstate, key)
                return (
                  <div key={key} className="border border-gray-200 rounded-md p-3">
                    {/* 🔴 แผนมีจริง แต่ช่องทางนี้ยิงไม่ออก — ห้ามให้ดูเหมือนการ์ด Lazada (CEO ชี้ 17 ก.ย. 2569)
                        รายชื่อมาจาก `channelsWithoutWriter` ของท่อ ไม่ได้ฝังในจอ */}
                    {writer === false && (
                      <p className="text-[11.5px] font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded px-2 py-1 mb-1.5">
                        ⬜ ยังดันไม่ได้ — ไม่มีตัวยิง · ตัวเลขในการ์ดนี้เป็นแผนที่คิดได้ <u>กดยังไงก็ยิงไม่ออก</u>
                      </p>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold text-gray-800">{label}</p>
                      {/* 🗓️ วันที่บนจอเป็น พ.ศ. ทั้งระบบ — ค่าดิบเก็บใน title */}
                      <p className="text-[11px] text-gray-400" title={p.day ? `ค่าที่ท่อส่งมา: ${p.day}` : undefined}>
                        {p.day ? `ข้อมูลวันที่ ${thaiDate(p.day)}` : ''}</p>
                    </div>
                    <p className="text-[22px] font-black text-gray-900 tabular-nums leading-tight mt-1">
                      {numText(p.wouldPush)}
                      <span className="text-[12px] font-normal text-gray-500 ml-1.5">รหัสที่จะถูกดัน</span>
                    </p>
                    {/* 🔴 reopen กับ close ผลตรงข้ามกัน — ท่อเขียนกำกับมาเอง (readNote) ห้ามรวมเป็นเลขเดียว */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 rounded px-1.5 py-0.5">เปิดขายอีกครั้ง {numText(p.reopen)}</span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5">เพิ่ม {numText(p.up)}</span>
                      <span className="bg-orange-50 text-orange-800 border border-orange-200 rounded px-1.5 py-0.5">ลด {numText(p.down)}</span>
                      <span className="bg-red-50 text-red-800 border border-red-200 rounded px-1.5 py-0.5">ปิดกันขายเกิน {numText(p.close)}</span>
                    </div>
                    <dl className="mt-2 text-[11.5px] text-gray-600 space-y-0.5">
                      <div className="flex justify-between gap-2"><dt>รหัสบนหน้าร้านเจ้านี้</dt><dd className="tabular-nums">{numText(p.platformSkus)}</dd></div>
                      <div className="flex justify-between gap-2"><dt>ตรงกันอยู่แล้ว</dt><dd className="tabular-nums">{numText(p.same)}</dd></div>
                      {/* ⚠️ กองที่ "ข้าม" ต้องโชว์เสมอ — ไม่โชว์ = คนอ่านเข้าใจว่าแผนครอบคลุมทุกรหัส */}
                      <div className="flex justify-between gap-2"><dt>ข้าม — คลังเราติดลบ</dt><dd className="tabular-nums">{numText(p.skipNegative)}</dd></div>
                      <div className="flex justify-between gap-2"><dt>ข้าม — คลังเราไม่รู้จักรหัสนี้</dt><dd className="tabular-nums">{numText(p.skipUnknown)}</dd></div>
                      {/* กองที่สาม — ท่อส่งมาตลอดแต่จอไม่เคยแสดง ⇒ ยอดที่คนเห็นไม่ครบกองที่ถูกข้าม */}
                      {N(p.skipConflict) !== null && (
                        <div className="flex justify-between gap-2"><dt>ข้าม — ข้อมูลขัดกัน</dt><dd className="tabular-nums">{numText(p.skipConflict)}</dd></div>
                      )}
                      {N(p.excludedOneToMany) !== null && (
                        <div className="flex justify-between gap-2 text-gray-500">
                          <dt>ตัดก่อนคิดแผน — หนึ่งรหัสผูกหลายรายการ</dt>
                          <dd className="tabular-nums">{numText(p.excludedOneToMany)}{N(p.excludedOneToManyKeys) !== null ? ` (${numText(p.excludedOneToManyKeys)} รหัส)` : ''}</dd>
                        </div>
                      )}
                      {N(p.excludedGuess) !== null && (
                        <div className="flex justify-between gap-2 text-gray-500"><dt>ตัดก่อนคิดแผน — จับคู่ด้วยการเดารหัส</dt><dd className="tabular-nums">{numText(p.excludedGuess)}</dd></div>
                      )}
                    </dl>
                    {/* 🔴 ท่อบอกเองว่ากองย่อยบวกกันได้ยอดรวมไหม — false ต้องดัง ไม่ใช่ซ่อน
                        ไม่มีค่าเลย = ท่อรุ่นเก่าไม่ได้เช็ค ⇒ เขียนว่า "ยังไม่รู้" ห้ามแกล้งเขียว */}
                    {p.bucketsAddUp === false ? (
                      <p className="text-[11.5px] text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2">
                        🔴 <b>ตัวเลขย่อยบวกกันไม่ได้ยอดรวม</b> — ห้ามใช้แผนรอบนี้ตัดสินใจ แจ้งฝั่งท่อก่อน
                      </p>
                    ) : p.bucketsAddUp === true ? (
                      <p className="text-[11px] text-gray-400 mt-2">✓ ท่อเช็คแล้วว่ากองย่อยบวกกันได้ยอดรวม</p>
                    ) : (
                      <p className="text-[11px] text-amber-700 mt-2">ท่อรุ่นนี้ยังไม่ได้บอกว่ากองย่อยบวกกันครบไหม</p>
                    )}
                    {/* 🔴 **ครบหรือยัง ต้องมาจากท่อ ไม่ใช่จอเดาจากจำนวนแถว** (สัญญาท่อ-จอ 14 ก.ย. 2569)
                        สามสถานะ ห้ามยุบเหลือสอง:
                          true      = ท่อยืนยันว่าครบทุกแถว ⇒ ใช้ตัดสินใจอนุมัติได้
                          false     = ท่อบอกเองว่ายังไม่ครบ ⇒ ห้ามใช้อนุมัติ
                          ไม่มีค่า  = **ท่อไม่ได้บอก** (แผนที่เป็น skip/error จะไม่มีช่องนี้)
                                      ⇒ "ไม่รู้" ห้ามเขียนเป็น "ครบ" — ท่อกำชับข้อนี้มาเอง */}
                    {p.pushComplete === true ? (
                      <p className="text-[11.5px] text-emerald-700 mt-2">
                        ✅ ท่อยืนยันว่ารายการนี้<b>ครบทุกแถว</b>
                        {N(p.pushShown) !== null && ` (${numText(p.pushShown)} แถว)`} — ใช้ตัดสินใจอนุมัติได้
                        {p.pushCapped === true && <span className="text-amber-800"> · แต่ชนเพดานของท่อแล้ว</span>}
                      </p>
                    ) : (
                      <div className="mt-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        {p.pushComplete === false
                          ? <>⚠️ <b>รายการยังไม่ครบ</b> — เห็น {numText(p.pushShown ?? rowsOf(p).length)} จาก {numText(p.wouldPush)} แถว</>
                          : <>⚠️ <b>ท่อยังไม่ได้บอกว่ารายการครบไหม</b> — ถือว่า <b>ยังไม่รู้</b> ห้ามอ่านว่าครบ</>}
                        {' '}· <b>อย่าเพิ่งใช้หน้านี้ตัดสินใจอนุมัติ</b> จนกว่าจะเห็นครบทุกแถว
                        <div className="mt-1">
                          <BtnGhost onClick={() => loadFull(key)} disabled={fullBusy === key || planBusy}>
                            {fullBusy === key ? 'กำลังขอแผนเต็ม…' : `ขอแผนเต็มของ ${label}`}
                          </BtnGhost>
                        </div>
                      </div>
                    )}
                    <SkipBucket label="ข้าม — คลังเราติดลบ" count={p.skipNegative} sample={p.skipNegativeSample} />
                    <SkipBucket label="ข้าม — คลังเราไม่รู้จักรหัสนี้" count={p.skipUnknown} sample={p.skipUnknownSample} />
                    <SkipBucket label="ข้าม — ข้อมูลขัดกัน" count={p.skipConflict} sample={p.skipConflictSample} />
                    {would === 0 && <p className="text-[12px] text-emerald-700 mt-1.5">ไม่มีอะไรต้องดันสำหรับเจ้านี้</p>}
                  </div>
                )
              })}
            </div>

            {/* ตัวอย่างแถวจริง — ตัวเลขสรุปไม่พอ คนอนุมัติต้องเห็นว่า "ดันแล้วตัวเลขเปลี่ยนจากเท่าไหร่เป็นเท่าไหร่" */}
            {PLATFORMS.map(({ key, label }) => {
              const p = plan[key]
              const rows = Array.isArray(p?.pushSample) ? (p!.pushSample as PlanSample[]) : []
              if (!rows.length) return null
              const would = N(p?.wouldPush)
              return (
                <details key={key} className="mt-3 border border-gray-200 rounded-md">
                  <summary className="text-[12.5px] text-gray-700 px-3 py-2 cursor-pointer">
                    {p?.pushScope === 'full' ? 'รหัสที่จะดันทั้งหมด' : 'ตัวอย่างรหัสที่จะดัน'} — {label}{' '}
                    <span className="text-gray-400">
                      ({rows.length} แถว{would !== null && would > rows.length ? ` จาก ${numText(would)}` : ''})
                    </span>
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-[12px]">
                      <thead className="bg-gray-50 border-y border-gray-200 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-medium">รหัส</th>
                          <th className="text-left px-3 py-1.5 font-medium">ชื่อสินค้า</th>
                          <th className="text-right px-3 py-1.5 font-medium">บนหน้าร้าน</th>
                          <th className="text-right px-3 py-1.5 font-medium">จะเปลี่ยนเป็น</th>
                          <th className="text-left px-3 py-1.5 font-medium">ชนิด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const k = r.kind ? KIND[r.kind] : undefined
                          return (
                            <tr key={`${r.sku ?? i}`} className="border-b border-[#e8ecf8] last:border-0">
                              <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-800">{r.sku || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-600">{r.name || '—'}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{numText(r.from)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-900">{numText(r.to)}</td>
                              <td className="px-3 py-1.5">
                                {k ? <Pill tone={k.tone}>{k.text}</Pill> : <span className="text-gray-400">{r.kind || '—'}</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )
            })}

            {/* ข้อควรรู้จากท่อ — **อ่านจากคำตอบ ห้ามพิมพ์ตายไว้ในจอ** (ท่อแก้กติกาแล้วจอจะโกหกทันที) */}
            {(plan.safetyNote || plan.readNote) && (
              <div className="text-[11.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-3 leading-relaxed space-y-1">
                {plan.readNote && <p>📖 {plan.readNote}</p>}
                {plan.safetyNote && <p>🛡 {plan.safetyNote}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงประวัติไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && log && (
        log.length === 0 ? (
          <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-8 text-center">
            ยังไม่เคยมีการดันสต็อก — ประวัติรอบแรกจะโผล่ที่นี่
          </p>
        ) : (
          <div className="space-y-3">
            {log.map((round) => {
              const key = round.at ?? ''
              const v = verify[key]
              const bad = (round.rejected ?? 0) > 0
              return (
                <div key={key} className={`bg-white border rounded-md p-4 ${bad ? 'border-red-300' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-gray-900">{thaiTime(round.at)}</span>
                    <Pill tone="blue">{round.platform ?? '?'}</Pill>
                    <span className="text-[12px] text-gray-500">
                      ยิง {round.fired ?? '?'} · สำเร็จ {round.pushed ?? '?'}
                    </span>
                    {bad && <Pill tone="red">ถูกปฏิเสธ {round.rejected}</Pill>}
                    <button onClick={() => runVerify(round)} disabled={v === 'busy' || !(round.rows ?? []).length}
                      className="ml-auto text-[12px] text-blue-600 hover:underline disabled:opacity-40">
                      {v === 'busy' ? 'กำลังเทียบสด…' : 'ตรวจว่าถึงหน้าร้านจริง'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(round.rows ?? []).map((r, i) => {
                      const k = KIND[r.kind ?? ''] ?? { text: r.kind ?? '?', tone: 'gray' as const }
                      return (
                        <span key={r.sku ?? i} className="text-[11.5px] border border-gray-200 rounded px-2 py-0.5 bg-gray-50">
                          <span className="font-mono">{r.sku ?? '—'}</span>{' '}
                          <span className="text-gray-400">{r.from ?? '?'}→{r.to ?? '?'}</span>{' '}
                          <Pill tone={k.tone}>{k.text}</Pill>
                        </span>
                      )
                    })}
                  </div>
                  {bad && (
                    <p className="text-[11.5px] text-red-700 mt-2">
                      ⚠️ รอบนี้มีแถวถูกปฏิเสธ {round.rejected} แถว — บอกไม่ได้ว่าแถวไหน
                      {' '}ดูจากบันทึกตอนยิงหรือถามฝั่งท่อ
                      {/* 🔴 ของเดิมเขียนว่า "จดเฉพาะแถวที่ยิงติด" — **ไม่จริง** (ยิงของจริงดู 14 ก.ย. 2569)
                          รอบ 2026-09-08T03:06 และ 03:05 มี pushed=0 · rejected=1 · rows=1
                          ⇒ rows **รวมแถวที่ถูกปฏิเสธด้วย** แค่ไม่ได้ติดป้ายว่าตัวไหนถูกปฏิเสธ
                          คำอธิบายเดิมทำให้คนเชื่อว่าทุกรหัสในแถวด้านบนยิงสำเร็จหมด */}
                    </p>
                  )}

                  {v && v !== 'busy' && (
                    v.error ? (
                      <p className="text-[12px] text-red-700 mt-2">ตรวจไม่สำเร็จ: {v.error} (ตรวจไม่ได้ ≠ ไม่ถึง — ลองใหม่ได้)</p>
                    ) : (
                      <div className="text-[12px] mt-2 border-t border-gray-100 pt-2">
                        {/* 🔴 **ผลตรวจต้องบอกขอบเขตของตัวเองเสมอ** (งานกระดาน t_mtxx4x5k · แก้ 14 ก.ย. 2569)
                            ของเดิมเขียนแค่ "ถึงหน้าร้านแล้ว N ตัว" ⇒ อ่านแล้วเหมือนตรวจครบทั้งรอบ
                            แต่ตัวพิสูจน์ส่งไปเฉพาะรหัสที่อยู่ใน `rows` ของ log เท่านั้น
                            ซึ่ง **ไม่รับประกันว่าเท่ากับจำนวนที่ยิงไปจริง** (`pushed`)
                            ⇒ วันที่ log จดมาไม่ครบ จอจะรายงานความสำเร็จจากกองที่ถูกตัด
                               โดยไม่มีอะไรบอก — โรคเดียวกับ "เลขทั้งกอง วางคู่กับแถวหน้าเดียว" */}
                        <span className="text-emerald-700">✅ ถึงหน้าร้านแล้ว {(v.landed ?? []).length} ตัว</span>
                        <span className="text-gray-400">
                          {' '}· ตรวจจากรหัสใน log {(round.rows ?? []).length} รหัส
                          {typeof round.pushed === 'number' && ` (รอบนี้ยิงสำเร็จ ${round.pushed})`}
                        </span>
                        {typeof round.pushed === 'number' && (round.rows ?? []).length < round.pushed && (
                          <span className="block text-amber-800 mt-0.5">
                            ⚠️ <b>ตรวจไม่ครบรอบ</b> — log จดรหัสไว้ {(round.rows ?? []).length} จากที่ยิงสำเร็จ {round.pushed}
                            {' '}⇒ อีก {round.pushed - (round.rows ?? []).length} รหัส <b>ยังไม่ถูกตรวจเลย</b> ไม่ใช่ตรวจแล้วผ่าน
                          </span>
                        )}
                        {(v.notLanded ?? []).length > 0 && (
                          <span className="block text-red-700 mt-0.5">
                            🔴 ยังไม่ถึง {(v.notLanded ?? []).length} ตัว:{' '}
                            {(v.notLanded ?? []).map((n) => `${n.sku ?? '?'} (ยังต้องดัน ${n['ยังต้องดัน'] ?? '?'})`).join(' · ')}
                          </span>
                        )}
                        {v.note && <span className="block text-gray-400 mt-0.5">{v.note}</span>}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 leading-relaxed">
        เวลาเป็นเวลาไทย (แปลงจากนาฬิกาเซิร์ฟเวอร์) · log เก็บ 50 รอบล่าสุด และ<b>จดเฉพาะแถวที่ยิง</b> —
        แถวที่ไม่ถูกส่ง/ถูกปฏิเสธรายตัวอยู่ในคำตอบตอนยิงเท่านั้น ·
        ปุ่ม &ldquo;ตรวจว่าถึงหน้าร้านจริง&rdquo; เทียบกับสต็อกสดบนแพลตฟอร์ม ไม่ใช่กับ log
        (ตาข่ายต้องเทียบกับต้นทางนอกระบบ — กฎ mirror-needs-outside-check)
      </p>
    </div>
  )
}
