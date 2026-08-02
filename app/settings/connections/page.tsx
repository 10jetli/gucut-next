'use client'
import { useEffect, useState, useCallback } from 'react'
import LoadingState from '@/components/ui/LoadingState'

interface ConnStatus {
  id: string
  name: string
  detail: string
  ok: boolean
  message: string
  latencyMs: number
}

// ── ฟอร์มกุญแจ ZORT (ใช้กับแท็บโอนสินค้าในแคตตาล็อก — เก็บใน localStorage เครื่องนี้เท่านั้น) ──
const LS_TRF = 'gucut_zort_conn_v1'
const TRF_META = [
  { l: 'ศีตกาล/โกดัง', wh: 'NEW' },
  { l: 'ZAMA/ANJ', wh: 'ANJ' },
  { l: 'ZAMA/KLD', wh: 'KLD' },
]

interface ZortAcc { l: string; wh: string; s: string; k: string; x: string }

function ZortKeysCard() {
  const [accs, setAccs] = useState<ZortAcc[]>(TRF_META.map(m => ({ ...m, s: '', k: '', x: '' })))
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_TRF)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length === 3) { setAccs(arr); setSaved(true) }
      }
    } catch {}
  }, [])

  const upd = (i: number, key: 's' | 'k' | 'x', v: string) => {
    setAccs(prev => prev.map((a, idx) => (idx === i ? { ...a, [key]: v } : a)))
  }

  const saveKeys = async () => {
    if (accs.some(a => !a.s || !a.k || !a.x)) { setMsg('กรอกให้ครบทุกช่อง'); return }
    setTesting(true)
    setMsg('กำลังทดสอบการเชื่อมต่อทั้ง 3 บัญชี...')
    try {
      for (const a of accs) {
        const r = await fetch('https://open-api.zortout.com/v4/Warehouse/GetWarehouses', {
          headers: { storename: a.s, apikey: a.k, apisecret: a.x, 'Content-Type': 'application/json' },
        })
        const j = await r.json()
        if (!j || !j.list) throw new Error('เชื่อมต่อ ' + a.l + ' ไม่ได้ — ตรวจกุญแจอีกครั้ง')
      }
      localStorage.setItem(LS_TRF, JSON.stringify(accs))
      setSaved(true)
      setEditing(false)
      setMsg('✅ บันทึกแล้ว — แท็บโอนสินค้าใช้งานได้ทันที')
    } catch (e: any) {
      setMsg('❌ ' + e.message)
    } finally {
      setTesting(false)
    }
  }

  const clearKeys = () => {
    if (!confirm('ลบกุญแจ ZORT ออกจากเครื่องนี้?')) return
    localStorage.removeItem(LS_TRF)
    setAccs(TRF_META.map(m => ({ ...m, s: '', k: '', x: '' })))
    setSaved(false)
    setEditing(false)
    setMsg(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[14px] font-semibold text-gray-800">🔄 กุญแจ ZORT (ระบบโอนสินค้า)</p>
        <span className={'text-[10.5px] px-2 py-0.5 rounded-full font-semibold ' + (saved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
          {saved ? 'ตั้งค่าแล้วในเครื่องนี้' : 'ยังไม่ได้ตั้งค่า'}
        </span>
      </div>
      <p className="text-[12px] text-gray-400 mt-0.5">ใช้กับแท็บโอนสินค้าในแคตตาล็อก · เก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์</p>

      {!saved && !editing && (
        <button onClick={() => setEditing(true)} className="mt-3 text-[13px] font-medium text-blue-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-blue-50 transition-colors">
          ➕ กรอกกุญแจ 3 บัญชี
        </button>
      )}
      {saved && !editing && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setEditing(true)} className="text-[13px] font-medium text-blue-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-blue-50 transition-colors">✏️ แก้ไขกุญแจ</button>
          <button onClick={clearKeys} className="text-[13px] font-medium text-red-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-red-50 transition-colors">🗑 ลบออกจากเครื่อง</button>
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-4">
          {accs.map((a, i) => (
            <div key={a.wh} className="border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-gray-700 mb-2">{a.l} <span className="text-gray-400 font-normal">(คลัง {a.wh})</span></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={a.s} onChange={e => upd(i, 's', e.target.value)} placeholder="Store name (อีเมล ZORT)" className="text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                <input value={a.k} onChange={e => upd(i, 'k', e.target.value)} placeholder="API Key" className="text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                <input value={a.x} onChange={e => upd(i, 'x', e.target.value)} placeholder="API Secret" type="password" className="text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <button onClick={saveKeys} disabled={testing} className="text-[13px] font-semibold text-white bg-[#17386b] rounded-xl px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_6px_16px_-6px_rgba(23,56,107,0.5)]">
              {testing ? 'กำลังทดสอบ...' : 'ทดสอบและบันทึก'}
            </button>
            <button onClick={() => { setEditing(false); setMsg(null) }} className="text-[13px] text-gray-500 px-3 py-2 hover:text-gray-700 transition-colors">ยกเลิก</button>
          </div>
        </div>
      )}

      {msg && <p className="text-[12.5px] mt-3 text-gray-700">{msg}</p>}
    </div>
  )
}

export default function ConnectionsPage() {
  const [conns, setConns] = useState<ConnStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/connections')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'โหลดไม่สำเร็จ')
      setConns(j.connections ?? [])
      setCheckedAt(j.checkedAt)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const okCount = conns.filter(c => c.ok).length

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">เชื่อมต่อบริการอื่น</h1>
          <p className="text-[11.5px] text-gray-400 mt-0.5" suppressHydrationWarning>
            {checkedAt ? 'ตรวจล่าสุด ' + new Date(checkedAt).toLocaleTimeString('th-TH') : 'สถานะการเชื่อมต่อและโทเคนของทุกบริการ'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[13px] font-medium text-blue-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'กำลังตรวจ...' : '🔄 ตรวจสอบอีกครั้ง'}
        </button>
      </div>

      {!loading && !error && (
        <div className={'rounded-2xl border p-4 text-[13px] ' + (okCount === conns.length ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
          {okCount === conns.length
            ? '✅ ทุกการเชื่อมต่อใช้งานได้ปกติ (' + okCount + '/' + conns.length + ')'
            : '⚠️ มีการเชื่อมต่อที่มีปัญหา ' + (conns.length - okCount) + ' รายการ — ดูรายละเอียดด้านล่าง'}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">เกิดข้อผิดพลาด: {error}</div>
      )}

      {loading && <LoadingState />}

      <div className="space-y-3">
        {conns.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 flex items-start gap-4 transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_28px_-14px_rgba(15,23,42,0.2)]">
            <span className={'mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0 ' + (c.ok ? 'bg-emerald-500' : 'bg-red-500')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold text-gray-800">{c.name}</p>
                <span className={'text-[10.5px] px-2 py-0.5 rounded-full font-semibold ' + (c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                  {c.ok ? 'เชื่อมต่อแล้ว' : 'มีปัญหา'}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-0.5">{c.detail}</p>
              <p className={'text-[12.5px] mt-1.5 break-words ' + (c.ok ? 'text-gray-600' : 'text-red-600')}>{c.message}</p>
            </div>
            <span className="text-[11px] text-gray-300 shrink-0">{c.latencyMs} ms</span>
          </div>
        ))}
      </div>

      <ZortKeysCard />
    </div>
  )
}
