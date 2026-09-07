'use client'
// รับคืนสินค้าหน้าร้าน — **wizard 4 ขั้นตามร่างสุดท้าย /returns v2** (ผ่านเวทีถกสามเสียง #1-#4)
// ผัง: ~/claude-shared/debate/returns-ร่างสุดท้าย.md + lock-returns-ข้อสรุป.md + outside-leg-ข้อสรุป.md
//
// ① หาใบขาย (เลขใบ/เลขพัสดุ) → เลือกชิ้น+จำนวน · [หาใบไม่เจอ → unmatched]
// ② ถ่ายรูปตอนรับ ≥1 · [ถ่ายไม่ได้ → พิมพ์เหตุผลบังคับ] → POST receive (เซิร์ฟเวอร์ออก returnId+ล็อก)
//   → อัปรูปทีละใบ ยืนยันสำเร็จก่อนไปต่อ (upload_failed ≠ ไม่มีรูป — retry ได้)
// ③ ประเมินทีละชิ้น: ปุ่มใหญ่ 2 ปุ่ม "ขายต่อได้" / "เสียหาย" (+หมายเหตุ เช่น "ซ่อมได้")
// ④ สรุปทวนกับลูกค้า → กด 1 ครั้ง → POST grade (บันทึก+ยิง move ธุรกรรมเดียว) → ผลจริงสามสถานะ
//
// 🔴 กติกาจากเวทีที่จอนี้ต้องถือ:
// - ใบขายมีใบคืนค้างอยู่ → เสนอ "ทำต่อจากที่ค้าง" ก่อนเสมอ ห้ามเปิดใบใหม่เงียบ ๆ (รู Codex #2)
// - ใบถูกคนอื่นถือ → อ่านได้แต่กดไม่ได้ + บอกใคร/ตั้งแต่เมื่อไหร่ + ปุ่มรับช่วง (ต้องเลือกเหตุผล)
// - จำนวนคืนได้ = เซิร์ฟเวอร์ตัดสิน (คงเหลือสะสมต่อ SKU) จอแค่ส่งที่คนเลือก
// - ผล move: added=เขียว · duplicate=เหลืองบอกตรง ๆ · อ่านไม่ออก="ไม่รู้ผล ห้ามกดซ้ำ"+ปุ่ม resume
//
// ⚠️ รูปใช้ <input capture> ไม่ใช่ getUserMedia แบบจอลงเวลา — ต่างโดยตั้งใจ:
//    ลงเวลาต้องถ่ายเงียบเร็ว (กดปุ๊บได้ปั๊บ) จึงเปิดกล้องรอ · จอนี้พนักงานตั้งใจถ่ายของหลายมุม
//    กล้อง OS ให้พรีวิว/แฟลช/โฟกัสดีกว่า และไม่ต้องถือ permission ค้างทั้ง session
// ⚠️ ย่อรูป ≤1400px ฝั่งเครื่องก่อนส่งเสมอ (กติการูปของร้าน)
//
// 🔌 **สัญญาข้อมูลทั้งหมดอยู่ lib/returns-api.ts — ร่างเสนอ รอฝั่งท่อยืนยัน** จอนี้ยังไม่ผูกเมนู
//    จนกว่า API จริงขึ้น (สร้างล่วงหน้าตามแผน CEO 7 ก.ย. ดึก: ทำส่วนไม่รอ API ก่อน)
import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { ChannelTag, Pill, thaiDate } from '@/components/zort'
import {
  returnsApi, setStaffPin, ReturnDoc, Verdict, STATE_LABEL, TAKEOVER_REASONS,
} from '@/lib/returns-api'

/* ── ชิ้นที่กำลังเลือกในขั้น ① — ฝั่งจอเท่านั้น ยังไม่ถึงเซิร์ฟเวอร์ ── */
interface PickItem { sku: string; name: string; sold: number; qty: number }
interface Photo {
  dataUrl: string
  /** pending=ยังไม่ส่ง · uploaded=ปลายทางยืนยันแล้ว · failed=ส่งไม่สำเร็จ (retry ได้) */
  status: 'pending' | 'uploaded' | 'failed'
}

const STEPS = ['หาใบขาย', 'ถ่ายรูปตอนรับ', 'ประเมินทีละชิ้น', 'ยืนยัน + ผลจริง']

function StepHead({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center mb-5 overflow-x-auto">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          {i > 0 && <div className={`w-8 md:w-16 h-px ${i <= step ? 'bg-blue-500' : 'bg-gray-300'}`} />}
          <div className="flex flex-col items-center px-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px]
              ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
              {['🔍', '📷', '⚖️', '✅'][i]}
            </div>
            <span className={`text-[10px] mt-0.5 whitespace-nowrap ${i === step ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** ย่อรูปฝั่งเครื่อง ≤1400px — กติการูปของร้าน (กล้องมือถือให้ไฟล์ 4-8MB) */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image()
      i.onload = () => ok(i); i.onerror = no; i.src = url
    })
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } finally { URL.revokeObjectURL(url) }
}

export default function ReturnReceivePage() {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /* ขั้น ① */
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<Array<{ id?: string; number?: string; channel?: string; customer?: string; order_date?: string }> | null>(null)
  const [order, setOrder] = useState<{ id: string; number: string; channel?: string; customer?: string } | null>(null)
  const [pick, setPick] = useState<PickItem[]>([])
  const [unmatched, setUnmatched] = useState(false)
  const [unmatchedNote, setUnmatchedNote] = useState('')
  /* ใบค้างของใบขายนี้ — เจอแล้วต้องเสนอทำต่อ ห้ามเปิดใหม่เงียบ ๆ */
  const [pendingDoc, setPendingDoc] = useState<ReturnDoc | null>(null)

  /* ขั้น ② */
  const [photos, setPhotos] = useState<Photo[]>([])
  const [noPhoto, setNoPhoto] = useState(false)
  const [noPhotoReason, setNoPhotoReason] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /* ใบจริงจากเซิร์ฟเวอร์ (หลัง receive) */
  const [doc, setDoc] = useState<ReturnDoc | null>(null)
  /* ใบถูกคนอื่นถือ */
  const [locked, setLocked] = useState<{ by: string; since?: string; returnId?: string } | null>(null)
  const [takeReason, setTakeReason] = useState<'shift-change' | 'unreachable' | 'other'>('shift-change')
  const [takeNote, setTakeNote] = useState('')

  /* ขั้น ③ */
  const [verdicts, setVerdicts] = useState<Record<string, { verdict?: Verdict; note: string }>>({})

  /* ขั้น ④ */
  const [result, setResult] = useState<ReturnDoc['items'] | null>(null)
  /* "ไม่รู้ผล" — grade ส่งแล้วอ่านคำตอบไม่ออก ห้ามกดซ้ำ ต้อง resume ดูสถานะจริง */
  const [unknownResult, setUnknownResult] = useState(false)

  const reset = () => {
    setStep(0); setBusy(false); setError(''); setQ(''); setCandidates(null); setOrder(null)
    setPick([]); setUnmatched(false); setUnmatchedNote(''); setPendingDoc(null)
    setPhotos([]); setNoPhoto(false); setNoPhotoReason(''); setDoc(null); setLocked(null)
    setVerdicts({}); setResult(null); setUnknownResult(false)
  }

  /* ── ขั้น ①: ค้นใบขาย (เส้นเดียวกับ wizard แพ็ค — number/customer/tracking_no) ── */
  const search = useCallback(async () => {
    const term = q.trim()
    if (!term) return
    /* ท่อ /api/returns บังคับคำค้น ≥ 3 ตัว (กัน browse) — จอบอกก่อนยิง ไม่ให้เจอ 403 งง ๆ */
    if (term.length < 3) { setError('พิมพ์อย่างน้อย 3 ตัวอักษร — จอนี้ค้นเพื่อรับคืนเท่านั้น เปิดไล่ดูทั้งร้านไม่ได้'); return }
    setBusy(true); setError(''); setCandidates(null); setOrder(null); setPendingDoc(null)
    try {
      const to = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
      const from = new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10)
      const res = await fetch(`/api/returns?list=orders&q=${encodeURIComponent(term)}&from=${from}&to=${to}&limit=10`)
      const d = await res.json().catch(() => null)
      if (d === null || !res.ok || d?.error) throw new Error(d?.error || `ท่อตอบ ${res.status}`)
      if (typeof d?.skip === 'string') throw new Error(d.skip)
      if (!Array.isArray(d?.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      if (d.rows.length === 0) setError(`ไม่พบใบที่ตรงกับ "${term}" ในปีหลังสุด — ถ้าใบเก่ากว่านั้น/ซื้อหน้าร้านยุคก่อน ใช้ปุ่ม "หาใบไม่เจอ"`)
      else setCandidates(d.rows)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [q])

  const openOrder = useCallback(async (id: string) => {
    setBusy(true); setError('')
    try {
      /* ใบค้างของใบขายนี้มีไหม — ต้องรู้ก่อนให้เลือกชิ้น (รู Codex #2: ห้ามเปิดใบซ้ำเงียบ ๆ) */
      const inbox = await returnsApi.inbox(id).catch(() => null)
      const open = inbox && Array.isArray(inbox.rows)
        ? inbox.rows.find((r) => r.orderId === id && (r.state === 'received' || r.state === 'graded'))
        : null
      if (open) setPendingDoc(open)

      const res = await fetch(`/api/returns?order=${encodeURIComponent(id)}`)
      const d = await res.json().catch(() => null)
      if (d === null || !res.ok || d?.error) throw new Error(d?.error || `ท่อตอบ ${res.status}`)
      if (!d?.order || !Array.isArray(d?.items)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี order/items)')
      setOrder({ id, number: String(d.order.number ?? id), channel: d.order.channel, customer: d.order.customer })
      setPick(d.items.map((it: { sku?: string; name?: string; qty?: number }) => ({
        sku: String(it.sku ?? ''), name: String(it.name ?? '—'),
        sold: typeof it.qty === 'number' ? it.qty : 0, qty: 0,
      })))
      setCandidates(null)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [])

  /** resume ใบค้าง/ใบหลัง timeout — GET ตาม returnId แล้ววาดจากสถานะจริง */
  const resume = useCallback(async (returnId: string) => {
    setBusy(true); setError('')
    try {
      const d = await returnsApi.get(returnId)
      if (!d.doc) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี doc)')
      setDoc(d.doc); setPendingDoc(null); setUnknownResult(false)
      if (d.doc.state === 'moved') { setResult(d.doc.items); setStep(3) }
      else if (d.doc.state === 'received') {
        setVerdicts(Object.fromEntries(d.doc.items.map((it) => [it.sku, { verdict: it.verdict, note: it.note ?? '' }])))
        setStep(2)
      } else if (d.doc.state === 'graded' || d.doc.state === 'move_failed') {
        setVerdicts(Object.fromEntries(d.doc.items.map((it) => [it.sku, { verdict: it.verdict, note: it.note ?? '' }])))
        if (d.doc.state === 'move_failed') setResult(d.doc.items)
        setStep(3)
      } else setError(`ใบ ${returnId} ถูกยกเลิกไปแล้ว — เริ่มใบใหม่ได้`)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [])

  /* ── ขั้น ②: รูป ── */
  const addPhotos = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        const dataUrl = await shrink(f)
        setPhotos((p) => [...p, { dataUrl, status: 'pending' }])
      }
    } catch { setError('อ่านรูปไม่สำเร็จ — ลองถ่ายใหม่') } finally { setBusy(false) }
  }, [])

  /** POST receive → ได้ returnId → อัปรูปทีละใบ (ยืนยันสำเร็จก่อนไปต่อ) */
  const submitReceive = useCallback(async () => {
    setBusy(true); setError(''); setLocked(null)
    try {
      const items = unmatched
        ? pick.filter((p) => p.qty > 0).map((p) => ({ sku: p.sku || undefined, name: p.name, qty: p.qty }))
        : pick.filter((p) => p.qty > 0).map((p) => ({ sku: p.sku, qty: p.qty }))
      const r = await returnsApi.receive({
        orderId: unmatched ? null : order?.id, unmatched, unmatchedNote: unmatched ? unmatchedNote : undefined,
        items, noPhotoReason: noPhoto ? noPhotoReason : undefined,
      })
      if (r.lockedBy) { setLocked({ by: r.lockedBy, since: r.lockSince, returnId: r.returnId }); return }
      if (!r.returnId) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี returnId)')
      if (r.existing) {
        /* ใบมีอยู่แล้ว (กดซ้ำ/ใบค้าง) — พาไปทำต่อ ไม่ใช่แจ้งเตือนเฉย ๆ */
        await resume(r.returnId); return
      }
      /* อัปรูปทีละใบ — ใบไหนล้มติดธง failed ให้ retry ไม่บล็อกใบอื่น */
      let anyFail = false
      for (let i = 0; i < photos.length; i++) {
        try {
          await returnsApi.photo({ returnId: r.returnId, index: i, dataUrl: photos[i].dataUrl })
          setPhotos((p) => p.map((ph, j) => (j === i ? { ...ph, status: 'uploaded' } : ph)))
        } catch {
          anyFail = true
          setPhotos((p) => p.map((ph, j) => (j === i ? { ...ph, status: 'failed' } : ph)))
        }
      }
      if (anyFail) { setError('รูปบางใบส่งไม่สำเร็จ — กด "ส่งรูปซ้ำ" (ใบคืนถูกสร้างแล้ว ไม่หาย)'); return }
      await resume(r.returnId)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [order, pick, unmatched, unmatchedNote, noPhoto, noPhotoReason, photos, resume])

  const retryPhotos = useCallback(async () => {
    if (!doc && !locked) return
    const rid = doc?.returnId
    if (!rid) return
    setBusy(true); setError('')
    let anyFail = false
    for (let i = 0; i < photos.length; i++) {
      if (photos[i].status === 'uploaded') continue
      try {
        await returnsApi.photo({ returnId: rid, index: i, dataUrl: photos[i].dataUrl })
        setPhotos((p) => p.map((ph, j) => (j === i ? { ...ph, status: 'uploaded' } : ph)))
      } catch { anyFail = true; setPhotos((p) => p.map((ph, j) => (j === i ? { ...ph, status: 'failed' } : ph))) }
    }
    setBusy(false)
    if (anyFail) setError('ยังส่งไม่สำเร็จบางใบ — เน็ตอาจมีปัญหา ลองอีกครั้ง')
    else if (rid) await resume(rid)
  }, [photos, doc, locked, resume])

  /* ── ขั้น ④: ยืนยัน → grade+move ธุรกรรมเดียว ── */
  const confirm = useCallback(async () => {
    if (!doc) return
    setBusy(true); setError('')
    try {
      const items = doc.items.map((it) => ({
        sku: it.sku, verdict: verdicts[it.sku]?.verdict as Verdict, note: verdicts[it.sku]?.note || undefined,
      }))
      const r = await returnsApi.grade({ returnId: doc.returnId, items })
      if (!Array.isArray(r.items)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี items)')
      setResult(r.items)
      /* state จากเซิร์ฟเวอร์คือความจริง — moved ต่อเมื่อทุกชิ้นมี moveResult (รีวิวท่อ) */
      setDoc((cur) => (cur ? { ...cur, state: r.state ?? cur.state, items: r.items ?? cur.items } : cur))
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      if (msg.includes('อ่านคำตอบไม่ออก')) { setUnknownResult(true); setError('') }
      else setError(msg)
    } finally { setBusy(false) }
  }, [doc, verdicts])

  const pickedCount = pick.filter((p) => p.qty > 0).length
  const photosOk = photos.length > 0 || (noPhoto && noPhotoReason.trim().length >= 4)
  const allGraded = doc ? doc.items.every((it) => verdicts[it.sku]?.verdict) : false

  return (
    <div className="p-4 md:p-6 max-w-[720px] mx-auto">
      <StepHead step={step} />
      {/* ป้ายตามร่าง v2 ข้อ 5: ช่วงเงาไม่ยิง CN- เข้า ZORT — ใครทำใบคืนใน ZORT ทำต่อแบบเดิม */}
      <p className="text-[11px] text-center text-gray-400 -mt-3 mb-4">
        ช่วงเดินคู่ขนาน: ใบคืนใน <b>ZORT ยังทำมือตามเดิม</b> — จอนี้บันทึกฝั่งเรา แล้ว recon รายวันเทียบสองฝั่ง
      </p>
      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดำเนินการต่อไม่ได้'}>{error}</ErrorBox>}

      {/* ── ใบถูกคนอื่นถือ — อ่านได้ กดไม่ได้ + รับช่วงต้องเลือกเหตุผล (เวที #2) ── */}
      {locked && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-4 mb-4">
          <p className="text-[13.5px] text-amber-900 font-semibold">
            🔒 {locked.by} กำลังทำใบนี้อยู่{locked.since ? ` (ตั้งแต่ ${thaiDate(locked.since)})` : ''}
          </p>
          <p className="text-[12px] text-amber-800 mt-1 leading-relaxed">
            ดูสถานะได้ แต่แก้ไม่ได้ — ถ้าต้องทำแทนจริง เลือกเหตุผลแล้วกดรับช่วง
            (ทุกการรับช่วงขึ้นจอแอดมินเป็นรายการแยก ไม่มีการแย่งเงียบ ๆ)
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <select value={takeReason} onChange={(e) => setTakeReason(e.target.value as typeof takeReason)}
              className="text-[12.5px] border border-amber-300 rounded px-2 py-1.5 bg-white">
              {TAKEOVER_REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            {takeReason === 'other' && (
              <input value={takeNote} onChange={(e) => setTakeNote(e.target.value)} placeholder="เหตุผล"
                className="text-[12.5px] border border-amber-300 rounded px-2 py-1.5 w-[180px]" />
            )}
            <button disabled={busy || (takeReason === 'other' && takeNote.trim().length < 4)}
              onClick={async () => {
                if (!locked.returnId) { setError('ใบนี้ยังไม่มี returnId — ให้คนที่ถือใบทำต่อ หรือแจ้งแอดมิน'); return }
                setBusy(true); setError('')
                try {
                  const d = await returnsApi.takeover({ returnId: locked.returnId, reason: takeReason, note: takeNote || undefined })
                  if (!d.doc) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี doc)')
                  setLocked(null); await resume(d.doc.returnId)
                } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
              }}
              className="text-[12.5px] font-semibold text-white rounded-full px-4 py-1.5 disabled:opacity-40"
              style={{ background: '#b45309' }}>
              รับช่วงใบนี้
            </button>
          </div>
        </div>
      )}

      {/* ══ ขั้น ① หาใบขาย + เลือกชิ้น ══ */}
      {step === 0 && !locked && (
        <div className="bg-white border border-gray-200 rounded-md p-4 md:p-6">
          {!order && !unmatched && (
            <>
              <h1 className="text-[17px] font-bold text-gray-900 text-center mb-1">รับคืนสินค้า</h1>
              <p className="text-[12px] text-gray-500 text-center mb-2">กรอกเลขที่ใบขาย หรือเลขพัสดุจากกล่อง</p>
              {/* ตัวตนพนักงาน: PIN ลงเวลา → header x-staff-pin เซิร์ฟเวอร์แปลงเป็นชื่อเอง
                  ห้ามส่งชื่อจาก body (ตกลงกับท่อ) — ตอนนี้ยังไม่บังคับ รอท่อเปิดด่าน */}
              <p className="text-center mb-4">
                <input type="password" inputMode="numeric" maxLength={6} placeholder="PIN พนักงาน"
                  onChange={(e) => setStaffPin(e.target.value)}
                  className="w-[120px] text-center text-[13px] border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400" />
              </p>
              <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex justify-center gap-2 mb-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="เลขที่ใบ หรือเลขพัสดุ"
                  className="w-[240px] text-center text-[14px] border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-500" />
                <button type="submit" disabled={busy || !q.trim()}
                  className="text-[13px] font-semibold text-white rounded-full px-5 disabled:opacity-50" style={{ background: '#4669e5' }}>
                  {busy ? 'กำลังหา…' : 'ค้นหา'}
                </button>
              </form>
              {Array.isArray(candidates) && candidates.length > 0 && (
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100 mb-3">
                  {candidates.map((r, i) => (
                    <button key={r.id ?? i} disabled={!r.id} onClick={() => r.id && openOrder(String(r.id))}
                      title={r.id ? undefined : 'ใบนี้ท่อไม่ส่ง id มา — เปิดไม่ได้'}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex items-center gap-3 disabled:opacity-40">
                      <span className="font-mono text-[12.5px] text-gray-900">{r.number || '—'}</span>
                      <ChannelTag name={r.channel || ''} />
                      <span className="text-[12px] text-gray-600 flex-1 truncate">{r.customer || ''}</span>
                      <span className="text-[11.5px] text-gray-400">{thaiDate(r.order_date)}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* ทางออกที่มีธง — ข้อยุติเวที #1 ข้อ 2 (gucut2 ยอมถอน "ห้ามเด็ดขาด") */}
              <p className="text-center">
                <button onClick={() => { setUnmatched(true); setPick([{ sku: '', name: '', sold: 0, qty: 1 }]) }}
                  className="text-[12.5px] text-amber-700 hover:underline">
                  หาใบไม่เจอ → รับแบบติดธงรอแอดมินผูกใบ
                </button>
              </p>
            </>
          )}

          {(order || unmatched) && (
            <>
              {order && (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[14px] font-semibold">{order.number}</span>
                  <ChannelTag name={order.channel || ''} />
                  <span className="text-[12px] text-gray-500">{order.customer || ''}</span>
                  <button onClick={() => { setOrder(null); setPick([]); setPendingDoc(null) }} className="text-[11.5px] text-gray-400 hover:underline ml-auto">เปลี่ยนใบ</button>
                </div>
              )}
              {unmatched && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3 text-[12px] text-amber-800">
                  🚩 <b>ใบไม่ผูกใบขาย (unmatched)</b> — รับของ+ถ่ายรูปได้ปกติ แต่<b>ไม่เข้าสต็อก</b>
                  จนกว่าแอดมินผูกใบ/อนุมัติ · ระบุที่มาเท่าที่รู้:
                  <input value={unmatchedNote} onChange={(e) => setUnmatchedNote(e.target.value)}
                    placeholder="เช่น ลูกค้าบอกซื้อหน้าร้านปีที่แล้ว ไม่มีใบเสร็จ"
                    className="block w-full mt-1.5 text-[12.5px] border border-amber-300 rounded px-2 py-1.5 bg-white" />
                  <button onClick={() => { setUnmatched(false); setPick([]) }} className="text-[11.5px] text-amber-700 hover:underline mt-1">← กลับไปหาใบ</button>
                </div>
              )}

              {/* ใบค้างของใบขายนี้ — เสนอทำต่อ "ก่อน" ปุ่มไปต่อเสมอ */}
              {pendingDoc && (
                <div className="bg-blue-50 border border-blue-300 rounded-md px-3 py-2.5 mb-3">
                  <p className="text-[12.5px] text-blue-900">
                    📌 ใบขายนี้มีใบคืน<b>ค้างอยู่แล้ว</b>: {pendingDoc.returnId} · <Pill tone={STATE_LABEL[pendingDoc.state].tone}>{STATE_LABEL[pendingDoc.state].text}</Pill>
                    {pendingDoc.staff && <> · โดย {pendingDoc.staff}</>}
                  </p>
                  <button onClick={() => resume(pendingDoc.returnId)} disabled={busy}
                    className="text-[12.5px] font-semibold text-white rounded-full px-4 py-1.5 mt-1.5" style={{ background: '#4669e5' }}>
                    ทำต่อจากที่ค้าง
                  </button>
                  <span className="text-[11.5px] text-blue-700/70 ml-2">เปิดใบใหม่ซ้ำ = เสี่ยงคืนเกิน เซิร์ฟเวอร์จะตีกลับ</span>
                </div>
              )}

              <p className="text-[12.5px] font-semibold text-gray-700 mb-1.5">
                {unmatched ? 'ของที่รับมา (พิมพ์ชื่อ+จำนวน)' : 'เลือกชิ้นที่ลูกค้าคืน + จำนวน'}
              </p>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 mb-3">
                {pick.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    {unmatched ? (
                      <input value={it.name} onChange={(e) => setPick((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        placeholder="ชื่อของ เช่น เลื่อย NW-9999 สภาพมีรอย" className="flex-1 text-[12.5px] border border-gray-200 rounded px-2 py-1.5" />
                    ) : (
                      <>
                        <span className="font-mono text-[11.5px] text-gray-500 w-[96px] shrink-0 truncate">{it.sku || '—'}</span>
                        <span className="text-[12.5px] text-gray-800 flex-1">{it.name}</span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">ซื้อ {it.sold}</span>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPick((p) => p.map((x, j) => j === i ? { ...x, qty: Math.max(0, x.qty - 1) } : x))}
                        className="w-7 h-7 rounded border border-gray-300 text-gray-600">−</button>
                      <span className={`w-7 text-center text-[13.5px] font-bold ${it.qty > 0 ? 'text-blue-700' : 'text-gray-300'}`}>{it.qty}</span>
                      <button onClick={() => setPick((p) => p.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x))}
                        className="w-7 h-7 rounded border border-gray-300 text-gray-600">＋</button>
                    </div>
                  </div>
                ))}
              </div>
              {unmatched && (
                <button onClick={() => setPick((p) => [...p, { sku: '', name: '', sold: 0, qty: 1 }])}
                  className="text-[12px] text-blue-600 hover:underline mb-3">+ เพิ่มรายการ</button>
              )}
              {/* จำนวนเกินที่ซื้อ: จอเตือนได้ แต่คนตัดสินจริงคือเซิร์ฟเวอร์ (คงเหลือสะสมทุกใบ) */}
              {!unmatched && pick.some((p) => p.qty > p.sold) && (
                <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-3">
                  ⚠️ บางชิ้นเลือกเกินจำนวนที่ซื้อ — เซิร์ฟเวอร์จะตีกลับ (และนับรวมใบคืนก่อนหน้าด้วย)
                </p>
              )}
              <button disabled={pickedCount === 0 || busy || (unmatched && pick.some((p) => p.qty > 0 && !p.name.trim()))}
                onClick={() => setStep(1)}
                className="w-full text-[14px] font-semibold text-white rounded-full py-2.5 disabled:opacity-40" style={{ background: '#4669e5' }}>
                ถัดไป: ถ่ายรูปตอนรับ ({pickedCount} รายการ)
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ ขั้น ② รูป ══ */}
      {step === 1 && !locked && (
        <div className="bg-white border border-gray-200 rounded-md p-4 md:p-6">
          <p className="text-[13.5px] font-semibold text-gray-800 mb-1">ถ่ายรูปของที่รับ (สภาพกล่อง + ตัวสินค้า)</p>
          <p className="text-[11.5px] text-gray-400 mb-3">อย่างน้อย 1 รูป — รูปคือหลักฐานสภาพ ณ วินาทีรับ แก้ทีหลังไม่ได้</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
          <div className="flex flex-wrap gap-2 mb-3">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={`รูป ${i + 1}`} className="w-20 h-20 object-cover rounded border border-gray-200" />
                <span className={`absolute -top-1.5 -right-1.5 text-[10px] rounded-full px-1 ${
                  p.status === 'uploaded' ? 'bg-emerald-500 text-white' : p.status === 'failed' ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}
                  title={p.status === 'uploaded' ? 'ส่งแล้ว' : p.status === 'failed' ? 'ส่งไม่สำเร็จ — จะ retry ให้' : 'ยังไม่ส่ง'}>
                  {p.status === 'uploaded' ? '✓' : p.status === 'failed' ? '!' : '…'}
                </span>
                <button onClick={() => setPhotos((ph) => ph.filter((_, j) => j !== i))}
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 text-[10px] bg-white border border-gray-300 rounded-full">✕</button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded border-2 border-dashed border-gray-300 text-gray-400 text-[24px]">📷</button>
          </div>
          {/* escape ตามข้อยุติเวที #1 ข้อ 3 — กล้องพังต้องไปต่อได้ แต่เหตุผลบังคับ */}
          {photos.length === 0 && (
            <label className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-2 mb-3">
              <input type="checkbox" checked={noPhoto} onChange={(e) => setNoPhoto(e.target.checked)} className="mt-0.5" />
              <span>ถ่ายไม่ได้ (กล้องพัง/ไม่มีสิทธิ์) — ต้องพิมพ์เหตุผลติดใบไว้ให้แอดมินเห็น
                {noPhoto && (
                  <input value={noPhotoReason} onChange={(e) => setNoPhotoReason(e.target.value)}
                    placeholder="เช่น กล้องเครื่องนี้เสีย ใช้เครื่องสำรองไม่ได้" autoFocus
                    className="block w-full mt-1 text-[12.5px] border border-amber-300 rounded px-2 py-1.5 bg-white" />
                )}
              </span>
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(0)} className="text-[12.5px] text-gray-500 px-3">← กลับ</button>
            {photos.some((p) => p.status === 'failed') ? (
              <button onClick={retryPhotos} disabled={busy}
                className="flex-1 text-[14px] font-semibold text-white rounded-full py-2.5 disabled:opacity-40" style={{ background: '#b45309' }}>
                {busy ? 'กำลังส่ง…' : 'ส่งรูปซ้ำ (ใบคืนสร้างแล้ว ไม่หาย)'}
              </button>
            ) : (
              <button onClick={submitReceive} disabled={!photosOk || busy}
                className="flex-1 text-[14px] font-semibold text-white rounded-full py-2.5 disabled:opacity-40" style={{ background: '#4669e5' }}>
                {busy ? 'กำลังบันทึก…' : 'บันทึกรับของ + ส่งรูป'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ ขั้น ③ ประเมินทีละชิ้น ══ */}
      {step === 2 && doc && (
        <div className="bg-white border border-gray-200 rounded-md p-4 md:p-6">
          <p className="text-[12px] text-gray-500 mb-0.5">ใบคืน <span className="font-mono">{doc.returnId}</span>
            {doc.unmatched && <> · 🚩 unmatched{doc.quarantineNo && <> · เลขกัก <b className="font-mono">{doc.quarantineNo}</b> (เขียนติดของ)</>}</>}</p>
          <p className="text-[13.5px] font-semibold text-gray-800 mb-3">ดูของจริงทีละชิ้น แล้วตอบ: ขายต่อได้ไหม</p>
          <div className="space-y-3 mb-4">
            {doc.items.map((it) => {
              const v = verdicts[it.sku] ?? { note: '' }
              return (
                <div key={it.sku || it.name} className="border border-gray-200 rounded-md p-3">
                  <p className="text-[12.5px] text-gray-800 mb-2">
                    <span className="font-mono text-[11px] text-gray-400 mr-1.5">{it.sku || '—'}</span>
                    {it.name || '—'} <b>× {it.qty}</b>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setVerdicts((m) => ({ ...m, [it.sku]: { ...v, verdict: 'return_in' } }))}
                      className={`py-2.5 rounded-md text-[13.5px] font-semibold border-2 ${v.verdict === 'return_in'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-500'}`}>
                      ✅ ขายต่อได้
                    </button>
                    <button onClick={() => setVerdicts((m) => ({ ...m, [it.sku]: { ...v, verdict: 'damage' } }))}
                      className={`py-2.5 rounded-md text-[13.5px] font-semibold border-2 ${v.verdict === 'damage'
                        ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-200 text-gray-500'}`}>
                      ❌ เสียหาย
                    </button>
                  </div>
                  {/* "ซ่อมได้" = หมายเหตุใต้เสียหาย (เวที #2: ตัด 🔧 สถานะไร้นาฬิกาออก) */}
                  {v.verdict === 'damage' && (
                    <input value={v.note} onChange={(e) => setVerdicts((m) => ({ ...m, [it.sku]: { ...v, note: e.target.value } }))}
                      placeholder="หมายเหตุ เช่น ซ่อมได้ / แตกทั้งชิ้น"
                      className="w-full mt-2 text-[12.5px] border border-gray-200 rounded px-2 py-1.5" />
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={() => setStep(3)} disabled={!allGraded}
            className="w-full text-[14px] font-semibold text-white rounded-full py-2.5 disabled:opacity-40" style={{ background: '#4669e5' }}>
            ถัดไป: สรุปทวนกับลูกค้า
          </button>
        </div>
      )}

      {/* ══ ขั้น ④ สรุป → ยืนยัน → ผลจริง ══ */}
      {step === 3 && doc && (
        <div className="bg-white border border-gray-200 rounded-md p-4 md:p-6">
          {unknownResult ? (
            <div className="text-center">
              <div className="text-[36px] mb-1">❓</div>
              <p className="text-[15px] font-bold text-gray-900 mb-1">ไม่รู้ผล — ห้ามกดยืนยันซ้ำ</p>
              <p className="text-[12.5px] text-gray-600 mb-3 leading-relaxed">
                ส่งคำยืนยันไปแล้วแต่อ่านคำตอบไม่ออก (เน็ตอาจหลุดพอดี) —
                เซิร์ฟเวอร์อาจบันทึกไปแล้วก็ได้ กดซ้ำเสี่ยงซ้ำซ้อน · กดปุ่มเดียวนี้เพื่อดูสถานะจริง
              </p>
              <button onClick={() => resume(doc.returnId)} disabled={busy}
                className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2" style={{ background: '#4669e5' }}>
                {busy ? 'กำลังเช็ค…' : 'เช็คสถานะจริงของใบนี้'}
              </button>
            </div>
          ) : result && doc.state === 'move_failed' ? (
            <div className="text-center">
              <div className="text-[36px] mb-1">⚠️</div>
              <p className="text-[15px] font-bold text-red-800 mb-1">บันทึกแล้ว แต่เข้าสต็อกไม่ครบ — ใบ {doc.returnId}</p>
              <p className="text-[12px] text-gray-600 mb-3">
                คำตัดสินถูกบันทึกครบ · ชิ้นที่ขึ้น <b>&ldquo;ยังไม่ลงสต็อก&rdquo;</b> ยิงซ้ำได้ปลอดภัย
                (ชิ้นที่ลงแล้วระบบไม่บวกซ้ำ) — <b>ห้ามเริ่มใบใหม่</b>
              </p>
              <div className="text-left border border-gray-200 rounded-md divide-y divide-gray-100 mb-3">
                {result.map((it) => (
                  <div key={it.sku || it.name} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                    <span className="flex-1">{it.name || it.sku} × {it.qty}</span>
                    {it.moveResult
                      ? <Pill tone={it.verdict === 'return_in' ? 'green' : 'red'}>
                          {it.verdict === 'return_in' ? 'กลับเข้าสต็อกแล้ว' : 'เข้ากองเสียหายแล้ว'}
                        </Pill>
                      : <Pill tone="red">ยังไม่ลงสต็อก</Pill>}
                  </div>
                ))}
              </div>
              <button onClick={confirm} disabled={busy}
                className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2" style={{ background: '#b91c1c' }}>
                {busy ? 'กำลังยิงซ้ำ…' : 'ลองส่งเข้าสต็อกอีกครั้ง'}
              </button>
            </div>
          ) : result ? (
            <div className="text-center">
              <div className="text-[36px] mb-1">✅</div>
              <p className="text-[15px] font-bold text-gray-900 mb-2">ใบ {doc.returnId} เข้าระบบแล้ว</p>
              <div className="text-left border border-gray-200 rounded-md divide-y divide-gray-100 mb-3">
                {result.map((it) => (
                  <div key={it.sku || it.name} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                    <span className="flex-1">{it.name || it.sku} × {it.qty}</span>
                    <Pill tone={it.verdict === 'return_in' ? 'green' : 'red'}>
                      {it.verdict === 'return_in' ? 'กลับเข้าสต็อก' : 'เข้ากองเสียหาย'}
                    </Pill>
                    {it.moveResult === 'duplicate' && (
                      <Pill tone="orange">เคยบันทึกแล้ว — ไม่บวกซ้ำ</Pill>
                    )}
                  </div>
                ))}
              </div>
              {doc.unmatched && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                  🚩 ใบ unmatched — <b>ยังไม่เข้าสต็อก</b> จนกว่าแอดมินผูกใบ/อนุมัติ
                  {doc.quarantineNo && <> · เขียนเลขกัก <b className="font-mono">{doc.quarantineNo}</b> ติดของแล้ววางกองกักเท่านั้น</>}
                </p>
              )}
              <button onClick={reset} className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2" style={{ background: '#4669e5' }}>
                รับใบถัดไป
              </button>
            </div>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold text-gray-800 mb-2">อ่านทวนกับลูกค้าก่อนกดยืนยัน</p>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 mb-3">
                {doc.items.map((it) => {
                  const v = verdicts[it.sku]
                  return (
                    <div key={it.sku || it.name} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                      <span className="flex-1">{it.name || it.sku} × {it.qty}</span>
                      <Pill tone={v?.verdict === 'return_in' ? 'green' : 'red'}>
                        {v?.verdict === 'return_in' ? 'ขายต่อได้' : 'เสียหาย'}
                      </Pill>
                      {v?.note && <span className="text-[11px] text-gray-400">({v.note})</span>}
                    </div>
                  )
                })}
              </div>
              <p className="text-[11.5px] text-gray-400 mb-3">
                กดยืนยันแล้วระบบบันทึกคำตัดสิน{doc.unmatched ? ' (ใบ unmatched — สต็อกยังไม่ขยับจนแอดมินอนุมัติ)' : 'และปรับสต็อกทันที'} · แก้ทีหลังต้องให้แอดมินทำใบแก้
              </p>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="text-[12.5px] text-gray-500 px-3">← แก้คำตัดสิน</button>
                <button onClick={confirm} disabled={busy}
                  className="flex-1 text-[14px] font-semibold text-white rounded-full py-2.5 disabled:opacity-40" style={{ background: '#4669e5' }}>
                  {busy ? 'กำลังบันทึก…' : 'ยืนยัน — บันทึกจริง'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 text-center">
        จอสำหรับพนักงานหน้าร้าน · รายการใบคืนทั้งหมดดูที่{' '}
        <Link href="/returns" className="text-blue-600 hover:underline">สินค้าที่ถูกคืนบ่อย</Link>
        {' '}(จอแอดมินรายใบกำลังตามมา)
      </p>
    </div>
  )
}
