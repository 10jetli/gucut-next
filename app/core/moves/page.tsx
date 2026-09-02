'use client'
// ปรับสต็อกมือ — รับของเข้า · โอน · ของเสีย · ปรับยอดจากการนับ · ลูกค้าคืนของ
//
// ทำไมสำคัญ: คลังเงาคิดสต็อกจาก "ภาพถ่ายวันฐาน − ที่ขายไป" ซึ่งขาดครึ่งของความจริง
// ของที่ซื้อเข้ามาใหม่หรือโอนระหว่างสาขาไม่มีทางเข้าระบบเลย — ปล่อยไว้คลังเราเพี้ยนสะสม
// จอนี้คือทางเดียวที่ข้อมูลฝั่งนั้นจะเข้ามาได้ จนกว่าจะมีท่ออัตโนมัติ
//
// ⚠️ **ref บังคับกรอกเสมอ** — ref คือ "ใบนี้คือใบไหน" (เลขใบสั่งซื้อ · เลขใบโอน · รอบนับสต็อก)
//    ฝั่งเซิร์ฟเวอร์กันซ้ำด้วยดัชนี UNIQUE(reason,ref,sku) → กดปุ่มสองครั้งของไม่เข้าสองรอบ
//    ถ้าปล่อยให้ ref ว่างได้ ตาข่ายนั้นพังทันที
// ⚠️ ของออก (โอนออก · ของเสีย) ต้องส่ง qty **ติดลบ** — จอบวกเครื่องหมายให้เอง
//    ห้ามให้คนกรอกเครื่องหมายเอง เพราะกรอกผิดทีเดียวสต็อกวิ่งผิดทางสองเท่า
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Move { id: number; sku: string; qty: number; reason: string; ref: string; at: string }

// ต้องตรงกับ REASONS ใน netlify/lib/stock-moves.mjs เป๊ะ — ไม่ตรง เซิร์ฟเวอร์ตีกลับ
const REASONS: { id: string; label: string; dir: 'in' | 'out' }[] = [
  { id: 'receive', label: 'รับของเข้า', dir: 'in' },
  { id: 'transfer_in', label: 'โอนเข้า', dir: 'in' },
  { id: 'transfer_out', label: 'โอนออก', dir: 'out' },
  { id: 'adjust', label: 'ปรับยอดจากการนับสต็อก', dir: 'in' },
  { id: 'damage', label: 'ของเสีย/ชำรุด', dir: 'out' },
  { id: 'return_in', label: 'ลูกค้าคืนของ', dir: 'in' },
]
const labelOf = (id: string) => REASONS.find((r) => r.id === id)?.label ?? id

export default function CoreMovesPage() {
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('receive')
  const [ref, setRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState<'ok' | 'warn' | 'err'>('ok')

  const [moves, setMoves] = useState<Move[]>([])
  const [total, setTotal] = useState(0)
  const [filterSku, setFilterSku] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (s = filterSku) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'moves', limit: '60' })
      if (s.trim()) qs.set('sku', s.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setMoves(Array.isArray(d.rows) ? d.rows : [])
      setTotal(Number(d.total ?? 0))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setMoves([])
    } finally {
      setLoading(false)
    }
  }, [filterSku])

  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dir = REASONS.find((r) => r.id === reason)?.dir ?? 'in'

  async function save() {
    const n = Math.abs(Number(qty))
    if (!sku.trim()) { setMsgTone('err'); setMsg('ต้องกรอก SKU'); return }
    if (!Number.isFinite(n) || n === 0) { setMsgTone('err'); setMsg('จำนวนต้องเป็นตัวเลขและไม่เท่ากับ 0'); return }
    if (!ref.trim()) { setMsgTone('err'); setMsg('ต้องกรอกเลขอ้างอิง — ไม่มีเลขนี้ระบบกันยิงซ้ำไม่ได้'); return }

    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/web/core?move=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim(),
          // จอเป็นคนใส่เครื่องหมาย ไม่ใช่คนกรอก
          qty: dir === 'out' ? -n : n,
          reason,
          ref: ref.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      if (d.added === 0 && d.duplicate > 0) {
        setMsgTone('warn')
        setMsg(`ใบนี้เคยบันทึกไปแล้ว (SKU ${sku.trim()} · อ้างอิง ${ref.trim()}) — ระบบไม่บันทึกซ้ำให้`)
      } else {
        setMsgTone('ok')
        setMsg(`บันทึกแล้ว ${labelOf(reason)} ${dir === 'out' ? '-' : '+'}${fmtNum(n)} ชิ้น`)
        setSku('')
        setQty('')
      }
      await load(filterSku)
    } catch (e) {
      setMsgTone('err')
      setMsg(String(e instanceof Error ? e.message : e))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    setMsg('')
    try {
      const res = await fetch(`/api/web/core?movedel=${id}`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setMsgTone('ok')
      setMsg(`ลบใบเลข ${id} แล้ว`)
      await load(filterSku)
    } catch (e) {
      setMsgTone('err')
      setMsg(String(e instanceof Error ? e.message : e))
    }
  }

  const msgCls =
    msgTone === 'err' ? 'text-red-600 bg-red-50 border-red-100'
      : msgTone === 'warn' ? 'text-amber-700 bg-amber-50 border-amber-100'
        : 'text-emerald-700 bg-emerald-50 border-emerald-100'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">✏️ ปรับสต็อกมือ</h1>
        <span className="text-[11px] text-gray-400">
          รับของเข้า · โอน · ของเสีย · ปรับยอดจากการนับ — สิ่งที่ออเดอร์บอกไม่ได้
        </span>
      </div>

      <p className="text-[12px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
        ℹ️ คลังเงาคิดสต็อกจาก <b>ภาพถ่ายวันฐาน − ที่ขายไป</b> ซึ่งไม่รู้จักของที่ซื้อเข้ามาใหม่
        หรือโอนระหว่างสาขาเลย · ทุกใบที่บันทึกที่นี่จะถูกนำไปบวก/ลบตอนเทียบสต็อกรอบถัดไป
      </p>

      <Card>
        <p className="text-[13px] font-semibold text-gray-700 mb-3">บันทึกรายการใหม่</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end">
          <label className="text-[12px] text-gray-500">
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)}
              placeholder="เช่น NW-5200-BAR"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            เหตุผล
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.dir === 'in' ? 'เข้า' : 'ออก'})</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-gray-500">
            จำนวน (ชิ้น)
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric"
              placeholder="กรอกจำนวนบวกเสมอ"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            เลขอ้างอิง <span className="text-red-500">*</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)}
              placeholder="เลขใบสั่งซื้อ / ใบโอน / รอบนับ"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <button onClick={save} disabled={saving}
            className="text-[13px] font-semibold text-white bg-blue-600 rounded-lg px-3.5 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? '⏳ กำลังบันทึก…' : '💾 บันทึก'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2.5">
          กรอกจำนวนเป็น<b>เลขบวกเสมอ</b> — เลือก &quot;โอนออก&quot; หรือ &quot;ของเสีย&quot; แล้วระบบใส่เครื่องหมายลบให้เอง ·
          <b> เลขอ้างอิงต้องกรอก</b> เพราะระบบใช้กันการบันทึกซ้ำ กดสองครั้งของจะไม่เข้าสองรอบ
        </p>
        {msg && (
          <p className={`text-[12.5px] mt-3 border rounded-lg px-3 py-2 ${msgCls}`}>{msg}</p>
        )}
      </Card>

      {error && <ErrorBox title="ดึงประวัติไม่ได้">{error}</ErrorBox>}
      {loading && moves.length === 0 && <LoadingState />}

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-5 py-3 border-b border-gray-100">
          <p className="text-[13px] font-semibold text-gray-700">
            ประวัติการปรับสต็อก {total > 0 && <span className="text-gray-400 font-normal">({fmtNum(total)} ใบ)</span>}
          </p>
          <div className="flex gap-2">
            <input value={filterSku} onChange={(e) => setFilterSku(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load() }}
              placeholder="กรองด้วย SKU"
              className="text-[12.5px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <button onClick={() => load()} disabled={loading}
              className="text-[12.5px] font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
              ค้นหา
            </button>
          </div>
        </div>
        {!loading && moves.length === 0 && (
          <p className="text-[13px] text-gray-400 p-4">ยังไม่มีการปรับสต็อก</p>
        )}
        {moves.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[640px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">เมื่อไหร่</th>
                  <th className="text-left font-medium px-3 py-2.5">SKU</th>
                  <th className="text-left font-medium px-3 py-2.5">เหตุผล</th>
                  <th className="text-left font-medium px-3 py-2.5">อ้างอิง</th>
                  <th className="text-right font-medium px-3 py-2.5">จำนวน</th>
                  <th className="text-right font-medium px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{m.at}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{m.sku}</td>
                    <td className="px-3 py-2.5 text-gray-600">{labelOf(m.reason)}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{m.ref}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${m.qty >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => remove(m.id)}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-600 hover:underline">
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-50 leading-relaxed">
          ลบได้ทีละใบเท่านั้นโดยตั้งใจ — บัญชีสต็อกที่ลบเป็นชุดได้ พลาดครั้งเดียวประวัติหายเป็นสิบใบ
          โดยไม่มีอะไรเตือน · ใบที่ลบแล้วจะหายจากการคำนวณสต็อกรอบถัดไปทันที
        </p>
      </Card>
    </div>
  )
}
