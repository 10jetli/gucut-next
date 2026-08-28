'use client'
// คอมเมนต์ใต้คลิป — ฉบับเนื้อเดียว · ท่อ /api/web/social
import { useCallback, useEffect, useState } from 'react'

interface Cmt { i: string; n: string; t: string; at: number }
interface Clip { id: string; comments: Cmt[] }
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const ago = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60000)
  if (m < 60) return `${Math.max(1, m)} นาทีก่อน`
  if (m < 1440) return `${Math.floor(m / 60)} ชม.ก่อน`
  return `${Math.floor(m / 1440)} วันก่อน`
}

export default function WebCommentsPage() {
  const [clips, setClips] = useState<Clip[] | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const counts: Record<string, [number, number]> = await fetch('/api/web/social').then((r) => r.json()).then((d) => d.counts ?? {})
      const ids = Object.entries(counts).filter(([, c]) => (c?.[1] ?? 0) > 0)
        .sort((a, b) => (b[1][1] ?? 0) - (a[1][1] ?? 0)).map(([id]) => id)
      const list = await Promise.all(ids.map(async (id) => ({
        id,
        comments: await fetch(`/api/web/social?id=${encodeURIComponent(id)}`)
          .then((r) => r.json()).then((d) => (d.comments ?? []) as Cmt[]).catch(() => []),
      })))
      setClips(list.filter((c) => c.comments.length))
    } catch { setErr('โหลดคอมเมนต์ไม่สำเร็จ'); setClips([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(id: string, cid: string) {
    if (!confirm('ลบคอมเมนต์นี้?')) return
    const r = await fetch(`/api/web/social?id=${encodeURIComponent(id)}&cid=${encodeURIComponent(cid)}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) { setErr('ลบไม่สำเร็จ ลองใหม่'); return }
    setClips((cur) => (cur ?? []).map((c) => c.id === id ? { ...c, comments: c.comments.filter((x) => x.i !== cid) } : c).filter((c) => c.comments.length))
  }

  const total = (clips ?? []).reduce((a, c) => a + c.comments.length, 0)

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">
          คอมเมนต์ใต้คลิป
          {clips !== null && <span className="ml-2 align-middle text-[13px] font-semibold text-gray-400">{total} ข้อความ</span>}
        </h1>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {clips === null ? (
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-50" />)}
        </div>
      ) : clips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm py-16 text-center">
          <p className="text-[13px] text-gray-400">ยังไม่มีคอมเมนต์ใต้คลิปไหนเลย</p>
        </div>
      ) : clips.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 md:px-5 py-3 border-b border-gray-50">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-400 to-pink-600 text-white flex items-center justify-center shrink-0">
              <I d="M3.5 7.5h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7a1 1 0 011-1zM15.5 11l5-3v9l-5-3" className="w-4 h-4" />
            </span>
            <span className="text-[12.5px] font-bold text-gray-700 truncate flex-1" dir="ltr">คลิป {c.id}</span>
            <a href={`https://gucut.com/videos/?v=${encodeURIComponent(c.id)}`} target="_blank" rel="noreferrer"
              className="text-[11.5px] font-semibold text-gray-400 hover:text-blue-600">ดูคลิป ↗</a>
          </div>
          <div className="divide-y divide-gray-50">
            {c.comments.map((m) => (
              <div key={m.i} className="group flex items-start gap-3 px-4 md:px-5 py-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 text-[12px] font-black flex items-center justify-center shrink-0">
                  {(m.n || '?').charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-gray-800">{m.n || 'ไม่ระบุชื่อ'}</span>
                    <span className="text-[10.5px] text-gray-300">{ago(m.at)}</span>
                  </span>
                  <span className="block text-[13px] text-gray-600 mt-0.5 break-words">{m.t}</span>
                </span>
                <button onClick={() => remove(c.id, m.i)}
                  className="shrink-0 p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" title="ลบ">
                  <I d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/comments/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
