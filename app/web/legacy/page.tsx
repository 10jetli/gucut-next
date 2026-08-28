'use client'
// ประวัติลูกค้าเก่า (สมัย Shopify) — ฉบับเนื้อเดียว · ท่อ /api/web/legacy
import { useCallback, useEffect, useState } from 'react'

interface Item { t: string; q: number; p: number; sku?: string }
interface Ord { id: string; at: string; paid: string; ship: string; total: number; phone: string; name: string; addr: string; items: Item[] }
interface Person { name: string; phone: string; email?: string; spent: number; orders: number; addr?: string }
interface Summary { note: string; orders: number; customers: number; revenue: number }
interface Result { q: string; orders: Ord[]; customers: Person[]; spent: number }

const baht = (n: number) => '฿' + Math.round(n).toLocaleString('th-TH')
const day = (s: string) => (s ? s.slice(0, 10) : '')
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}

export default function WebLegacyPage() {
  const [sum, setSum] = useState<Summary | null>(null)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/web/legacy').then((r) => r.json()).then(setSum).catch(() => {})
  }, [])

  const search = useCallback(async (term: string) => {
    if (!term.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/web/legacy?q=${encodeURIComponent(term.trim())}`)
      if (!r.ok) throw new Error()
      setRes(await r.json())
    } catch { setErr('ค้นหาไม่สำเร็จ ลองใหม่') }
    finally { setBusy(false) }
  }, [])

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">ประวัติลูกค้าเก่า</h1>
        {sum && <p className="text-[12px] text-gray-400 mt-0.5">สมัย Shopify · {sum.orders.toLocaleString('th-TH')} ออเดอร์ · {sum.customers.toLocaleString('th-TH')} ลูกค้า · ยอดรวม {baht(sum.revenue)}</p>}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><I d="M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4.2-4.2" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(q) }}
            placeholder="ค้นหาด้วย ชื่อ · เบอร์โทร · เลขออเดอร์เก่า"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-[13px] shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
        <button onClick={() => search(q)} disabled={busy || !q.trim()}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98] disabled:opacity-40">
          {busy ? 'กำลังหา…' : 'ค้นหา'}
        </button>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {res && (
        <>
          {res.customers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
              {res.customers.map((p, i) => (
                <div key={i} className="flex items-center gap-3.5 px-4 md:px-5 py-3.5">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-gray-600 text-white text-[13px] font-black flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
                    {(p.name || '?').charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-gray-900">{p.name}</span>
                    <span className="block text-[12px] text-gray-400">{p.phone}{p.addr ? ` · ${p.addr}` : ''}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[13.5px] font-black text-gray-900 tabular-nums">{baht(p.spent)}</span>
                    <span className="block text-[11px] text-gray-400">{p.orders} ออเดอร์</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {res.orders.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-gray-400">ไม่พบออเดอร์เก่าที่ตรงกับ &ldquo;{res.q}&rdquo;</p>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
              {res.orders.map((o) => (
                <details key={o.id} className="group">
                  <summary className="flex items-center gap-3 px-4 md:px-5 py-3 cursor-pointer list-none hover:bg-gray-50/80 transition-colors">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-gray-900">{o.name} <span className="font-normal text-gray-400 text-[11.5px]">#{o.id}</span></span>
                      <span className="block text-[11.5px] text-gray-400">{day(o.at)} · {o.items.length} รายการ{o.paid ? ' · จ่ายแล้ว' : ''}{o.ship ? ' · ส่งแล้ว' : ''}</span>
                    </span>
                    <span className="text-[13.5px] font-black text-gray-900 tabular-nums shrink-0">{baht(o.total)}</span>
                    <span className="text-gray-200 group-open:rotate-90 transition-transform"><I d="M9 6l6 6-6 6" className="w-3.5 h-3.5" /></span>
                  </summary>
                  <div className="px-4 md:px-5 pb-3.5 text-[12.5px] text-gray-600 space-y-0.5 bg-gray-50/50">
                    {o.items.map((it, n) => (
                      <p key={n} className="flex justify-between gap-2 pt-1.5"><span className="truncate">{it.t} ×{it.q}</span><span className="tabular-nums shrink-0">{baht(it.p * it.q)}</span></p>
                    ))}
                    {o.addr && <p className="pt-1.5 text-gray-400">📍 {o.addr}</p>}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
      {!res && sum && <p className="text-[12px] text-gray-400 text-center py-6">{sum.note}</p>}
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/legacy/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
