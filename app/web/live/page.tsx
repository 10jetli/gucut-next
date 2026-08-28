'use client'
// คนเข้าเว็บ — ฉบับเนื้อเดียวในหลังร้านหลัก · ท่อ /api/web/live
// ⚠️ กติกาเจ้าของร้าน: ห้ามรีเฟรชอัตโนมัติเป็นค่าเริ่มต้น ต้องกดเอง
import { useCallback, useEffect, useState } from 'react'

interface Stats {
  online: number; onlineWindowMin: number; today: number
  days: { d: string; n: number }[]
  pages: { p: string; n: number }[]
  countries: { cc: string; n: number }[]
  channelsToday: { ch: string; n: number; label: string; kind: string }[]
  members?: { total: number; new7: number; via: Record<string, number>; recent: { created: number; name: string }[] } | null
  pwa?: { today: number; week: number; installs7: number } | null
}
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const IC = {
  pulse: 'M3 12h4l2.5-6 4 12 2.5-6H21',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3.5 3.5 0 10-2-6.4M15.5 14.5A6 6 0 0122 21',
  phone2: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2',
  refresh: 'M20 11a8 8 0 10.9 4.5M20 4v6h-6',
}
const flag = (cc: string) => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...cc.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️'
function countryName(cc: string) {
  try { return new Intl.DisplayNames(['th'], { type: 'region' }).of(cc) || cc } catch { return cc }
}

export default function WebLivePage() {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState('')
  const [spin, setSpin] = useState(false)

  const load = useCallback(async () => {
    setSpin(true); setErr('')
    try {
      const r = await fetch('/api/web/live')
      if (!r.ok) throw new Error()
      setS(await r.json())
    } catch { setErr('โหลดสถิติไม่สำเร็จ — ลองกดรีเฟรช') }
    finally { setSpin(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const maxDay = Math.max(1, ...(s?.days ?? []).map((d) => d.n))

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">คนเข้าเว็บ</h1>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-600 shadow-sm hover:bg-gray-50 hover:text-blue-600 transition-colors">
          <I d={IC.refresh} className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} /> รีเฟรช
        </button>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {/* แถวตัวเลขหลัก */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">ออนไลน์ตอนนี้</p>
            <span className="relative flex w-2.5 h-2.5 mt-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" /></span>
          </div>
          <p className="text-[30px] font-black text-gray-900 mt-1 tabular-nums leading-none">{s ? s.online : '—'}</p>
          <p className="text-[11.5px] text-gray-400 mt-1.5">เคลื่อนไหวใน {s?.onlineWindowMin ?? 5} นาทีล่าสุด</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">วันนี้</p>
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className="text-[30px] font-black text-gray-900 tabular-nums leading-none">{s ? s.today.toLocaleString('th-TH') : '—'}</p>
            <div className="flex items-end gap-[3px] h-10 pb-0.5">
              {(s?.days ?? []).map((d, i, arr) => (
                <span key={d.d} title={`${d.d} · ${d.n.toLocaleString('th-TH')} คน`}
                  className={`w-[8px] rounded-full ${i === arr.length - 1 ? 'bg-blue-500' : 'bg-blue-100'}`}
                  style={{ height: `${Math.max(10, (d.n / maxDay) * 100)}%` }} />
              ))}
            </div>
          </div>
          <p className="text-[11.5px] text-gray-400 mt-1.5">คน · แท่ง = 7 วันล่าสุด</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">สมาชิก</p>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600"><I d={IC.users} className="w-[17px] h-[17px]" /></span>
          </div>
          <p className="text-[30px] font-black text-gray-900 mt-1 tabular-nums leading-none">{s?.members ? s.members.total : '—'}</p>
          <p className={`text-[11.5px] mt-1.5 font-medium ${s?.members?.new7 ? 'text-emerald-600' : 'text-gray-400'}`}>
            {s?.members?.new7 ? `+${s.members.new7} ใน 7 วัน` : 'คน'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เปิดจากแอป (PWA)</p>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-sky-50 text-sky-600"><I d={IC.phone2} className="w-[17px] h-[17px]" /></span>
          </div>
          <p className="text-[30px] font-black text-gray-900 mt-1 tabular-nums leading-none">{s?.pwa ? s.pwa.week : '—'}</p>
          <p className="text-[11.5px] text-gray-400 mt-1.5">คนใน 7 วัน · วันนี้ {s?.pwa?.today ?? 0}{s?.pwa?.installs7 ? ` · ติดตั้งใหม่ +${s.pwa.installs7}` : ''}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* หน้า + ช่องทาง */}
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
          <p className="px-4 md:px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">กำลังดูหน้าไหนอยู่</p>
          <div className="divide-y divide-gray-50">
            {(s?.pages ?? []).slice(0, 8).map((p) => (
              <div key={p.p} className="flex items-center gap-3 px-4 md:px-5 py-2.5">
                <span className="flex-1 min-w-0 text-[12.5px] text-gray-700 truncate" dir="ltr">{decodeURIComponent(p.p)}</span>
                <span className="text-[12.5px] font-black text-gray-900 tabular-nums">{p.n}</span>
              </div>
            ))}
            {s && s.pages.length === 0 && <p className="px-5 py-6 text-[12.5px] text-gray-400 text-center">ยังเงียบอยู่</p>}
          </div>
          <p className="px-4 md:px-5 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-t border-gray-100">มาจากช่องทางไหน (วันนี้)</p>
          <div className="px-4 md:px-5 pb-4 flex flex-wrap gap-1.5">
            {(s?.channelsToday ?? []).map((c) => (
              <span key={c.ch} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-2.5 py-1 text-[11.5px] text-gray-600">
                {c.label} <b className="text-gray-900 tabular-nums">{c.n}</b>
              </span>
            ))}
          </div>
        </div>
        {/* ประเทศ + สมาชิกล่าสุด */}
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
          <p className="px-4 md:px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">มาจากประเทศไหน (วันนี้)</p>
          <div className="divide-y divide-gray-50">
            {(s?.countries ?? []).slice(0, 6).map((c) => (
              <div key={c.cc} className="flex items-center gap-3 px-4 md:px-5 py-2.5">
                <span className="text-[16px]">{flag(c.cc)}</span>
                <span className="flex-1 text-[12.5px] text-gray-700">{c.cc === 'ZZ' ? 'ไม่ทราบ' : countryName(c.cc)}</span>
                <span className="text-[12.5px] font-black text-gray-900 tabular-nums">{c.n.toLocaleString('th-TH')}</span>
              </div>
            ))}
          </div>
          {s?.members?.recent && s.members.recent.length > 0 && (
            <>
              <p className="px-4 md:px-5 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-t border-gray-100">สมาชิกล่าสุด</p>
              <div className="px-4 md:px-5 pb-4 space-y-1.5">
                {s.members.recent.map((m, i) => (
                  <p key={i} className="flex justify-between text-[12.5px]">
                    <span className="text-gray-700 truncate">{m.name || '(ไม่ใส่ชื่อ)'}</span>
                    <span className="text-gray-400 shrink-0 tabular-nums">{m.created ? new Date(m.created).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-300">นับที่เซิร์ฟเวอร์ ตัวบล็อกโฆษณาหลบไม่ได้ · รีเฟรชด้วยการกดเอง (กติการ้าน)</p>
    </div>
  )
}
