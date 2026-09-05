'use client'
// สถิติคลิป — ฉบับเนื้อเดียว · ท่อ /api/web/clip-stats
import { useEffect, useState } from 'react'

interface Row { id: string; views: number; half: number; full: number; likes: number; comments: number; dur?: number }
const POSTER = (id: string) => `https://video.gucut.com/v2/${id}/poster.jpg`
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

export default function WebClipStatsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/web/clip-stats')
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d.rows) ? d.rows : []))
      .catch(() => { setErr('โหลดสถิติไม่สำเร็จ'); setRows([]) })
  }, [])

  const totalViews = (rows ?? []).reduce((a, r) => a + r.views, 0)

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">สถิติคลิป</h1>
        {rows && <p className="text-[12px] text-gray-400 mt-0.5">{rows.length} คลิปที่มีคนดู · รวม {totalViews.toLocaleString('th-TH')} คนดู</p>}
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_90px_90px_90px_80px_80px] items-center px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-300 border-b border-gray-50">
          <span>คลิป</span><span className="text-right">คนดู</span><span className="text-right">ดูถึงครึ่ง</span>
          <span className="text-right">ดูจนจบ</span><span className="text-right">หัวใจ</span><span className="text-right">คอมเมนต์</span>
        </div>
        {rows === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-50" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-gray-400">ยังไม่มีคลิปที่มีคนดู</p>
        ) : rows.map((r, i) => (
          <div key={r.id} className="md:grid md:grid-cols-[1fr_90px_90px_90px_80px_80px] md:items-center flex flex-wrap items-center gap-2 px-4 md:px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
            <span className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-black text-gray-300 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={POSTER(r.id)} alt="" className="w-9 h-14 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
              <span className="text-[11.5px] text-gray-400 truncate" dir="ltr">{String(r.id ?? '').slice(0, 12)}…</span>
            </span>
            <span className="md:text-right text-[13px] font-black text-gray-900 tabular-nums max-md:ml-auto">{r.views.toLocaleString('th-TH')}</span>
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{pct(r.half, r.views)}%</span>
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{pct(r.full, r.views)}%</span>
            <span className="md:text-right text-[12px] text-rose-500 tabular-nums">{r.likes.toLocaleString('th-TH')}</span>
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{r.comments.toLocaleString('th-TH')}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/clips/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
