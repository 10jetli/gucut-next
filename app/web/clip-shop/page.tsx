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
  /** 🔴 โหลดของตั้งต้นไม่สำเร็จ ≠ ไม่มีของ (แก้ 6 ก.ย. 2569)
   *  เดิม catch เปล่า ๆ ทั้งสามเส้น ⇒ รายชื่อสินค้าว่าง แล้วช่องค้นหาขึ้นว่า "ไม่พบสินค้า"
   *  ⇒ คนผูกสินค้ากับคลิปจะสรุปว่า **ร้านไม่มีสินค้าตัวนั้น** ทั้งที่แค่โหลดดัชนีไม่ได้ */
  const [loadErr, setLoadErr] = useState('')

  /** รู้หรือยังว่าคลิปไหนผูกไว้แล้ว — ไม่รู้ = ห้ามเขียนจำนวน และห้ามให้ตัวกรอง "ที่ยังไม่ผูก" หลอกตา */
  const [mapKnown, setMapKnown] = useState(false)

  useEffect(() => {
    fetch('/api/webfile/feed.json').then((r) => r.json()).then(setClips)
      .catch(() => setLoadErr('โหลดรายชื่อคลิปไม่สำเร็จ'))
    /* 🔴 ท่อตอบ 500 พร้อม JSON ⇒ .json() ไม่ throw ⇒ catch ไม่ทำงาน ⇒ map = {} เงียบ ๆ
       ⇒ หัวจอเขียน "ผูกแล้ว 0 คลิป" ทั้งที่ของจริงอาจผูกไว้แล้วหลายสิบ
       ⇒ คนไปไล่ผูกใหม่ทับของเดิม (เจอด้วยท่อปลอม 7 ก.ย. 2569) */
    fetch('/api/web/clip-shop')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
        if (!('map' in d)) throw new Error('ตอบมาไม่ครบ')
        return d
      })
      .then((d) => { setMap(d.map ?? {}); setMapKnown(true) })
      .catch(() => setLoadErr('โหลดรายการที่ผูกไว้ไม่สำเร็จ — ยังไม่รู้ว่าคลิปไหนผูกไว้แล้ว อย่าเพิ่งผูกทับ'))
    fetch('/api/webfile/search-index.json').then((r) => r.json()).then((d) => setIndex(d.items ?? d))
      .catch(() => setLoadErr('โหลดรายชื่อสินค้าไม่สำเร็จ — ค้นหาสินค้ายังใช้ไม่ได้'))
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
          <p className="text-[12px] text-gray-400 mt-0.5">
            ผูกแล้วคลิปในฟีดจะมีปุ่มกดซื้อ · ผูกแล้ว{' '}
            {mapKnown ? `${Object.keys(map).length} คลิป` : 'ยังไม่รู้ (โหลดไม่สำเร็จ)'}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-gray-600">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          โชว์เฉพาะที่ยังไม่ผูก
        </label>
      </div>
      {msg && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{msg}</p>}
      {/* 🔴 โหลดของตั้งต้นไม่สำเร็จต้องขึ้นจอ — ไม่งั้นจอดูเหมือน "ไม่มีคลิป/ไม่มีสินค้า" */}
      {loadErr && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          ⚠️ {loadErr} · <b>ไม่ได้แปลว่าไม่มีของ</b> — ลองรีเฟรชหน้า
        </p>
      )}

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
                      {/* 🔴 ดัชนีโหลดไม่ได้ = ค้นไม่ได้ **ไม่ใช่ไม่มีสินค้า** */}
                      {q.trim().length >= 2 && results.length === 0 && (
                        <p className={`text-[10.5px] px-1 ${index.length === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {index.length === 0 ? 'ค้นไม่ได้ — ยังโหลดรายชื่อสินค้าไม่สำเร็จ' : 'ไม่พบสินค้า'}
                        </p>
                      )}
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
