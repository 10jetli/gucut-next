'use client'
// เลือกคลิปที่ขึ้นหน้าวิดีโอ — ฉบับเนื้อเดียว และ "มีผลจริง" เป็นครั้งแรก
// (ของเดิมเก็บใน localStorage ที่ไม่มีใครอ่าน — ตอนนี้เก็บที่เซิร์ฟเวอร์
//  ฟีดของลูกค้าเคารพภายใน ~1 นาที) · ท่อ /api/web/video-pick + /api/webfile/feed.json
import { useEffect, useMemo, useState } from 'react'

interface FeedClip { v: { v: string; dur?: number; vw?: number; vh?: number } }
const POSTER = (id: string) => `https://video.gucut.com/v2/${id}/poster.jpg`
const dur = (s?: number) => {
  if (!s) return ''
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

export default function WebVideoPickPage() {
  const [clips, setClips] = useState<FeedClip[] | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/webfile/feed.json').then((r) => r.json()),
      fetch('/api/web/video-pick').then((r) => r.json()),
    ]).then(([feed, pick]) => {
      setClips(Array.isArray(feed) ? feed : [])
      setHidden(new Set(Array.isArray(pick?.hidden) ? pick.hidden : []))
    }).catch(() => { setMsg('โหลดคลิปไม่สำเร็จ'); setClips([]) })
  }, [])

  const toggle = (id: string) => {
    setHidden((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
    setDirty(true)
  }

  async function save() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/web/video-pick', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hidden: Array.from(hidden) }),
      })
      if (!r.ok) throw new Error()
      setDirty(false)
      setMsg('บันทึกแล้ว ✓ ฟีดลูกค้าอัปเดตภายใน ~1 นาที')
    } catch { setMsg('บันทึกไม่สำเร็จ ลองใหม่') }
    finally { setBusy(false) }
  }

  const showing = useMemo(() => (clips ?? []).filter((c) => !hidden.has(c.v.v)).length, [clips, hidden])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">เลือกคลิป</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            แตะคลิปเพื่อซ่อน/โชว์ในหน้าวิดีโอของลูกค้า · โชว์อยู่ {showing} จาก {clips?.length ?? '—'} คลิป
          </p>
        </div>
        <button onClick={save} disabled={busy || !dirty}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98] disabled:opacity-40">
          {busy ? 'กำลังบันทึก…' : dirty ? 'บันทึกการเลือก' : 'บันทึกแล้ว ✓'}
        </button>
      </div>
      {msg && <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">{msg}</p>}

      {clips === null ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 animate-pulse">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[9/14] rounded-2xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {clips.map((c) => {
            const id = c.v.v
            const off = hidden.has(id)
            return (
              <button key={id} onClick={() => toggle(id)}
                className={`relative rounded-2xl overflow-hidden border-2 transition-all ${off ? 'border-transparent opacity-40 grayscale' : 'border-emerald-400 shadow-[0_8px_16px_-10px_rgba(16,185,129,0.5)]'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={POSTER(id)} alt="" className="w-full aspect-[9/14] object-cover bg-gray-100" loading="lazy" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white tabular-nums">{dur(c.v.dur)}</span>
                <span className={`absolute top-1 right-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${off ? 'bg-gray-800/80 text-white' : 'bg-emerald-500 text-white'}`}>
                  {off ? 'ซ่อน' : 'โชว์'}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <p className="text-center text-[11px] text-gray-300">เก็บที่เซิร์ฟเวอร์ — มีผลกับลูกค้าทุกคน (ของเดิมเก็บในเครื่องซึ่งไม่มีผลจริง)</p>
    </div>
  )
}
