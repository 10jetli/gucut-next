'use client'
// ผูกสินค้ากับคลิป — ฉบับเนื้อเดียว · ท่อ /api/web/clip-shop
// ฟีดคลิปกับดัชนีสินค้าเป็นไฟล์สาธารณะของ gucut.com ดึงตรงได้
import { useCallback, useEffect, useMemo, useState } from 'react'

interface FeedClip { v: { v: string; dur?: number }; p?: unknown }
interface Pick { h: string; t: string; p: number; img: string | null }
interface IndexItem { h: string; t: string; p: number; i?: string }
const POSTER = (id: string) => `https://video.gucut.com/v2/${id}/poster.jpg`

export default function WebClipShopPage() {
  const [clips, setClips] = useState<FeedClip[]>([])
  const [map, setMap] = useState<Record<string, Pick>>({})
  const [index, setIndex] = useState<IndexItem[]>([])
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyEmpty, setOnlyEmpty] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/webfile/feed.json').then((r) => r.json()).then(setClips).catch(() => {})
    fetch('/api/web/clip-shop').then((r) => r.json()).then((d) => setMap(d.map ?? {})).catch(() => {})
    fetch('/api/webfile/search-index.json').then((r) => r.json()).then((d) => setIndex(d.items ?? d)).catch(() => {})
  }, [])

  const shown = useMemo(() => (onlyEmpty ? clips.filter((c) => !c.p && !map[c.v.v]) : clips), [clips, map, onlyEmpty])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return index.filter((x) => x.t.toLowerCase().includes(s) || x.h.toLowerCase().includes(s)).slice(0, 20)
  }, [q, index])

  const save = useCallback(async (clip: string, product: Pick | null) => {
    setMsg('')
    const r = await fetch('/api/web/clip-shop', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clip, product }),
    }).catch(() => null)
    if (!r?.ok) { setMsg('บันทึกไม่สำเร็จ ลองใหม่'); return }
    setMap((cur) => {
      const next = { ...cur }
      if (product) next[clip] = product
      else delete next[clip]
      return next
    })
    setOpenFor(null); setQ('')
  }, [])

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">ผูกสินค้ากับคลิป</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">ผูกแล้วคลิปในฟีดจะมีปุ่มกดซื้อ · ผูกแล้ว {Object.keys(map).length} คลิป</p>
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-gray-600">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          โชว์เฉพาะที่ยังไม่ผูก
        </label>
      </div>
      {msg && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{msg}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {shown.map((c) => {
          const id = c.v.v
          const linked = map[id]
          const open = openFor === id
          return (
            <div key={id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={POSTER(id)} alt="" className="w-full aspect-[9/14] object-cover bg-gray-100" loading="lazy" />
              <div className="p-2.5">
                {linked ? (
                  <>
                    <p className="text-[11.5px] font-bold text-gray-800 line-clamp-2 leading-snug">{linked.t}</p>
                    <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">฿{Number(linked.p).toLocaleString('th-TH')}</p>
                    <button onClick={() => save(id, null)} className="mt-1.5 w-full rounded-lg border border-red-200 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50">ถอดสินค้าออก</button>
                  </>
                ) : open ? (
                  <div className="space-y-1.5">
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อสินค้า…"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11.5px] outline-none focus:border-blue-400" />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {results.map((x) => (
                        <button key={x.h} onClick={() => save(id, { h: x.h, t: x.t, p: x.p, img: x.i || null })}
                          className="w-full text-left rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700 hover:bg-blue-50">
                          {x.t} <span className="text-gray-400">฿{Number(x.p).toLocaleString('th-TH')}</span>
                        </button>
                      ))}
                      {q.trim().length >= 2 && results.length === 0 && <p className="text-[10.5px] text-gray-400 px-1">ไม่พบสินค้า</p>}
                    </div>
                    <button onClick={() => { setOpenFor(null); setQ('') }} className="w-full rounded-lg border border-gray-200 py-1 text-[10.5px] text-gray-400">ปิด</button>
                  </div>
                ) : (
                  <button onClick={() => setOpenFor(id)} className="w-full rounded-lg bg-gray-900 py-1.5 text-[11px] font-bold text-white hover:bg-gray-800">+ ผูกสินค้า</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {clips.length > 0 && shown.length === 0 && <p className="py-10 text-center text-[13px] text-gray-400">ผูกครบทุกคลิปแล้ว 🎉</p>}
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/clip-shop/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
