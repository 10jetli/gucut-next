'use client'
// รายการขาย → แพ็คสินค้า → **โหมดแพ็คทีละใบ (wizard)** — ลอกผังจาก `zort-ui/86`
//
// ผัง ZORT (Pickandpack): จอเต็มไม่มีแถบข้าง · หัวเป็นขั้นตอน 3 ขั้น
//   ① กรอกหมายเลขรายการ → ② จัดการแพ็คสินค้า → ③ แพ็คสำเร็จ
//   กลางจอ "เริ่มต้นการแพ็คสินค้า" + ช่องกรอกเลขใบ/Tracking No. + ปุ่มน้ำเงิน "แพ็คสินค้า"
// ⚠️ **กับดัก URL ของ ZORT**: /Pickandpack/Main เปิดตรง ๆ ไม่ได้ ต้องมี `?mc=<base64>&type=2`
//    (ฝั่งท่อเจอตอนไล่คลิกจริง 7 ก.ย. 2569) — ของเราตั้งใจให้เปิดตรง ๆ ได้เลย
// ⚠️ ของเราอยู่ใน shell ปกติ (มีแถบข้าง) — Next ใช้ layout ร่วมทั้งแอป
//    แยกจอเต็มต้องทำ layout พิเศษซึ่งไม่คุ้มกับความต่างแค่นี้ · เนื้อในตามผังครบ
//
// 🔴 **ขั้น ③ "แพ็คสำเร็จ" ของเราไม่เขียนอะไรกลับไปที่ไหนทั้งสิ้น — ต้องบอกบนจอตรง ๆ**
//    ของ ZORT ขั้นสามคือการบันทึกสถานะแพ็คจริงในระบบมัน · ของเรา สถานะจริงอยู่ที่ ZORT
//    ทำปุ่มที่ดูเหมือนบันทึกแต่ไม่บันทึก = จอโกหก (กติกาข้อ 6: ผลสำเร็จของการเขียน
//    เขียนได้เฉพาะเมื่อปลายทางยืนยัน) ⇒ ค่าของจอนี้คือ **เช็คของครบชิ้นก่อนปิดกล่อง**
//
// ✅ ค้นได้ทั้ง **เลขที่ใบ และเลขพัสดุ** — ท่อเพิ่ม tracking_no ใน q ให้แล้ว 7 ก.ย.
//    (ขึ้นพร้อมกันใน deploy 21:00 เดียวกัน จึงไม่มีช่วงที่จอพูดเกินจริง)
//    ท่อยิงพิสูจน์แล้ว: ใบออนไลน์เดือนล่าสุดมีเลขพัสดุครบ ใบไม่มีเลขเป็น POS ล้วน
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { ChannelTag, Pill, thaiDate } from '@/components/zort'

interface OrderRow {
  id?: string; number?: string; channel?: string; status?: string; customer?: string
  order_date?: string; amount?: number; tracking_no?: string; source?: string
}
interface Item { line?: number; sku?: string; name?: string; qty?: number; amount?: number }

const STEPS = ['กรอกหมายเลขรายการ', 'จัดการแพ็คสินค้า', 'แพ็คสำเร็จ']

function StepHead({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          {i > 0 && <div className={`w-16 md:w-28 h-px ${i <= step ? 'bg-blue-500' : 'bg-gray-300'}`} />}
          <div className="flex flex-col items-center px-2">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px]
              ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
              {i === 0 ? '🔍' : i === 1 ? '📦' : '✅'}
            </div>
            <span className={`text-[11px] mt-1 ${i === step ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
              ขั้นตอนที่ {i + 1}
            </span>
            <span className={`text-[11px] ${i === step ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PackWizardPage() {
  const [step, setStep] = useState(0)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /* หลายใบตรงคำค้น — ให้เลือกก่อน ห้ามหยิบใบแรกเงียบ ๆ (หยิบผิดใบ = แพ็คผิดกล่อง) */
  const [candidates, setCandidates] = useState<OrderRow[] | null>(null)
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [picked, setPicked] = useState<Record<number, boolean>>({})

  const openOrder = useCallback(async (id: string) => {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || `ท่อตอบ ${res.status}`)
      if (typeof d?.skip === 'string') throw new Error(d.skip)
      if (!d?.order || !Array.isArray(d?.items)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี order/items)')
      setOrder(d.order); setItems(d.items); setPicked({}); setCandidates(null); setStep(1)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [])

  const search = useCallback(async () => {
    const term = q.trim()
    if (!term) return
    setBusy(true); setError(''); setCandidates(null)
    try {
      /* ช่วงค้น 120 วันพอ — งานแพ็คคือใบสด ๆ ใบเก่ากว่านั้นไม่ใช่งานแพ็คแล้ว */
      const to = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
      const from = new Date(Date.now() - 120 * 86400e3).toISOString().slice(0, 10)
      const res = await fetch(`/api/web/core?list=orders&q=${encodeURIComponent(term)}&from=${from}&to=${to}&limit=10`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || `ท่อตอบ ${res.status}`)
      if (typeof d?.skip === 'string') throw new Error(d.skip)
      if (!Array.isArray(d?.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      if (d.rows.length === 0) {
        setError(`ไม่พบใบที่ตรงกับ "${term}" ใน 120 วันหลังสุด — ค้นได้ทั้งเลขที่ใบและเลขพัสดุ (ใบ POS ไม่มีเลขพัสดุ ใช้เลขที่ใบ)`)
      } else if (d.rows.length === 1 && d.rows[0]?.id) {
        await openOrder(String(d.rows[0].id))
      } else {
        setCandidates(d.rows)
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [q, openOrder])

  const allPicked = items.length > 0 && items.every((_, i) => picked[i])
  const reset = () => { setStep(0); setQ(''); setOrder(null); setItems([]); setPicked({}); setCandidates(null); setError('') }

  return (
    <div className="p-4 md:p-6 max-w-[760px] mx-auto">
      <StepHead step={step} />

      {error && !isSkip(error) && <ErrorBox title="ดำเนินการต่อไม่ได้">{error}</ErrorBox>}
      {error && isSkip(error) && <ErrorBox title="ยังทำงานส่วนนี้ต่อไม่ได้">{error}</ErrorBox>}

      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-6 md:p-10 text-center">
          <h1 className="text-[19px] font-bold text-gray-900 mb-2">เริ่มต้นการแพ็คสินค้า</h1>
          <p className="text-[12.5px] text-gray-500 mb-1">กรอกหมายเลขรายการ หรือ Tracking No. แล้วกด &ldquo;แพ็คสินค้า&rdquo;</p>
          <p className="text-[11.5px] text-gray-400 mb-4">
            ยิงเลขพัสดุจากใบปะหน้าได้เลย — ใบขายออนไลน์มีเลขพัสดุในคลังเงาครบ
            (ใบ POS ไม่มีเลขพัสดุ ให้ค้นด้วยเลขที่ใบแทน)
          </p>
          <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex flex-col items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
              placeholder="เลขที่ใบ หรือเลขพัสดุ"
              className="w-[260px] text-center text-[14px] border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-500" />
            <button type="submit" disabled={busy || !q.trim()}
              className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-50"
              style={{ background: '#4669e5' }}>
              {busy ? 'กำลังค้นหา…' : 'แพ็คสินค้า'}
            </button>
          </form>

          {Array.isArray(candidates) && candidates.length > 1 && (
            <div className="mt-5 text-left">
              <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
                พบ {candidates.length} ใบที่ตรงคำค้น — เลือกใบที่จะแพ็ค (จอไม่เดาให้ เดาผิด = แพ็คผิดกล่อง)
              </p>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
                {candidates.map((r, i) => (
                  /* ⚠️ แถวที่ไม่มี id เปิดต่อไม่ได้จริง — ต้อง disabled ให้เห็น ไม่ใช่ปุ่มกดแล้วเงียบ */
                  <button key={r.id ?? i} onClick={() => r.id && openOrder(String(r.id))}
                    disabled={!r.id}
                    title={r.id ? undefined : 'ใบนี้ท่อไม่ส่ง id มา — เปิดรายละเอียดไม่ได้'}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="font-mono text-[12.5px] text-gray-900">{r.number || '—'}</span>
                    <ChannelTag name={r.channel || ''} />
                    <span className="text-[12px] text-gray-600 flex-1 truncate">{r.customer || ''}</span>
                    <span className="text-[11.5px] text-gray-400">{thaiDate(r.order_date)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && order && (
        <div className="bg-white border border-gray-200 rounded-md p-5">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-mono text-[15px] font-semibold text-gray-900">{order.number || '—'}</span>
            <ChannelTag name={order.channel || ''} />
            {typeof order.status === 'string' && <Pill tone="gray">{order.status}</Pill>}
          </div>
          <p className="text-[12.5px] text-gray-500 mb-3">
            {order.customer || '(ไม่มีชื่อลูกค้า)'} · {thaiDate(order.order_date)}
            {typeof order.tracking_no === 'string' && order.tracking_no && (
              <> · เลขพัสดุ <span className="font-mono">{order.tracking_no}</span></>
            )}
          </p>

          <p className="text-[12.5px] font-semibold text-gray-700 mb-2">
            หยิบของให้ครบทีละชิ้น แล้วติ๊กช่อง — ครบทุกชิ้นถึงจะกดปิดกล่องได้
          </p>
          <div className="border border-gray-200 rounded-md divide-y divide-gray-100 mb-4">
            {items.map((it, i) => (
              <label key={i} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${picked[i] ? 'bg-emerald-50/60' : ''}`}>
                <input type="checkbox" checked={!!picked[i]}
                  onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.checked }))}
                  className="w-4 h-4" />
                <span className="font-mono text-[12px] text-gray-500 w-[110px] shrink-0 truncate">{it.sku || '—'}</span>
                <span className="text-[12.5px] text-gray-800 flex-1">{it.name || '—'}</span>
                <span className={`text-[13px] font-bold ${(it.qty ?? 0) > 1 ? 'text-red-600' : 'text-gray-700'}`}>
                  × {typeof it.qty === 'number' ? it.qty.toLocaleString('th-TH') : '?'}
                </span>
              </label>
            ))}
            {items.length === 0 && (
              <p className="px-3 py-4 text-[12.5px] text-gray-400">
                ใบนี้ไม่มีรายการสินค้าในคลังเงา — กระจกอาจยังไม่ได้เก็บบรรทัดสินค้าของใบนี้
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep(2)} disabled={!allPicked}
              className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
              style={{ background: '#4669e5' }}>
              แพ็คสำเร็จ
            </button>
            <button onClick={reset} className="text-[12.5px] text-gray-500 hover:underline">ยกเลิก เริ่มใบใหม่</button>
            {!allPicked && items.length > 0 && (
              <span className="text-[11.5px] text-gray-400">
                ติ๊กแล้ว {Object.values(picked).filter(Boolean).length}/{items.length} ชิ้น
              </span>
            )}
          </div>
        </div>
      )}

      {step === 2 && order && (
        <div className="bg-white border border-gray-200 rounded-md p-6 md:p-10 text-center">
          <div className="text-[40px] mb-2">✅</div>
          <h1 className="text-[18px] font-bold text-gray-900 mb-1">เช็คของครบทุกชิ้นแล้ว — {order.number}</h1>
          <p className="text-[12.5px] text-gray-500 mb-3">
            {items.length.toLocaleString('th-TH')} รายการ · ยอดใบ {typeof order.amount === 'number' ? fmtMoney(order.amount) : '—'}
          </p>
          {/* 🔴 ความจริงที่ต้องบอก: จอนี้ไม่ได้เขียนสถานะไปที่ไหน */}
          <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block mb-4">
            ⚠️ จอนี้ช่วย<b>เช็คของก่อนปิดกล่อง</b>เท่านั้น — ไม่ได้บันทึกสถานะ &ldquo;แพ็คแล้ว&rdquo;
            ลงระบบไหน สถานะจริงของใบยังอยู่ที่ ZORT ตามเดิม
          </p>
          <div>
            <button onClick={reset}
              className="text-[13.5px] font-semibold text-white rounded-full px-6 py-2"
              style={{ background: '#4669e5' }}>
              แพ็คใบถัดไป
            </button>
          </div>
        </div>
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 text-center">
        ดูว่าวันนี้ต้องแพ็คใบไหนบ้างที่{' '}
        <Link href="/core/packing" className="text-blue-600 hover:underline">แพ็คสินค้า (รายการงานค้าง)</Link>
      </p>
    </div>
  )
}
