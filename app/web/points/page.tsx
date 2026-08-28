'use client'
// แต้มสะสมเว็บ — ฉบับเนื้อเดียว · ท่อ /api/web/points
import { useCallback, useEffect, useState } from 'react'

interface Cfg { on: boolean; earnPer: number; redeemValue: number; minRedeem: number; maxPercent: number }
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100'

export default function WebPointsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState('')
  const [n, setN] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    fetch('/api/web/points').then((r) => r.json()).then(setCfg).catch(() => setMsg('โหลดค่าไม่สำเร็จ'))
  }, [])
  useEffect(load, [load])

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/web/points', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error)
      setMsg(done)
      if (body.action === 'adjust') { setPhone(''); setN(''); setNote('') }
    } catch (e) { setMsg(String((e as Error).message || 'บันทึกไม่สำเร็จ')) }
    finally { setBusy(false) }
  }

  const F = ({ l, children }: { l: string; children: React.ReactNode }) => (
    <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">{l}</span>{children}</label>
  )

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">แต้มสะสม</h1>
      </div>
      {msg && <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">{msg}</p>}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-black text-gray-900">กติกาแต้ม</p>
          {cfg && (
            <button onClick={() => setCfg({ ...cfg, on: !cfg.on })}
              className={`relative w-11 h-6 rounded-full transition-colors ${cfg.on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${cfg.on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          )}
        </div>
        {!cfg ? (
          <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-gray-50" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <F l="ซื้อกี่บาทได้ 1 แต้ม"><input type="number" className={inputCls} value={cfg.earnPer || ''} onChange={(e) => setCfg({ ...cfg, earnPer: Number(e.target.value) })} /></F>
              <F l="1 แต้มแลกได้กี่บาท"><input type="number" step="0.01" className={inputCls} value={cfg.redeemValue || ''} onChange={(e) => setCfg({ ...cfg, redeemValue: Number(e.target.value) })} /></F>
              <F l="แลกขั้นต่ำ (แต้ม)"><input type="number" className={inputCls} value={cfg.minRedeem || ''} onChange={(e) => setCfg({ ...cfg, minRedeem: Number(e.target.value) })} /></F>
              <F l="ลดได้สูงสุดกี่ % ของยอด"><input type="number" className={inputCls} value={cfg.maxPercent || ''} onChange={(e) => setCfg({ ...cfg, maxPercent: Number(e.target.value) })} /></F>
            </div>
            <button onClick={() => post({ action: 'settings', ...cfg }, 'บันทึกกติกาแล้ว ✓')} disabled={busy}
              className="rounded-xl bg-gray-900 px-5 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
              {busy ? 'กำลังบันทึก…' : 'บันทึกกติกา'}
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 space-y-3">
        <p className="text-[13px] font-black text-gray-900">ปรับแต้มให้ลูกค้ารายคน</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <F l="เบอร์โทรลูกค้า"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" /></F>
          <F l="แต้ม (+เพิ่ม / -หัก)"><input type="number" className={inputCls} value={n} onChange={(e) => setN(e.target.value)} placeholder="เช่น 100 หรือ -50" /></F>
          <F l="หมายเหตุ"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ชดเชยแต้มเก่า" /></F>
        </div>
        <button onClick={() => post({ action: 'adjust', phone, n: Number(n), note }, 'ปรับแต้มแล้ว ✓')}
          disabled={busy || !phone.trim() || !n}
          className="rounded-xl bg-blue-600 px-5 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(37,99,235,0.7)] hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40">
          {busy ? 'กำลังบันทึก…' : 'ปรับแต้ม'}
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/points/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
