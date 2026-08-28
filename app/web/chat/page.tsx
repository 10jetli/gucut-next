'use client'
// แชทลูกค้าเว็บ — ฉบับเนื้อเดียวในหลังร้านหลัก (มาตรฐานเดียวกับหน้าออเดอร์เว็บ)
// สองคอลัมน์แบบแอปแชท: รายชื่อห้องซ้าย · บทสนทนาขวา · โพลทุก 5 วิ
// ข้อมูลผ่านท่อ /api/web/chat → gucut.com (หน้าเดิมยังเป็นทางสำรอง)
import { useCallback, useEffect, useRef, useState } from 'react'

interface Room {
  cid: string; name: string; phone: string
  product: { h: string; t: string } | null
  last: { from: string; text: string; at: number } | null
  unread: number; n: number
}
interface Msg { from: 'c' | 's'; text: string; at: number; by?: string }

const POLL_MS = 5000
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const IC = {
  chat: 'M21 12a8 8 0 01-8 8H4l2.3-2.9A8 8 0 1121 12z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  phone: 'M5 4h4l1.5 4L8 10a12 12 0 006 6l2-2.5 4 1.5v4c0 1-1 2-2 2A17 17 0 013 6c0-1 1-2 2-2z',
}
const when = (ms: number) => {
  const d = new Date(ms), now = new Date()
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export default function WebChatPage() {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [err, setErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const loadRooms = useCallback(async () => {
    try {
      const r = await fetch('/api/web/chat')
      if (!r.ok) throw new Error()
      setRooms((await r.json()).rooms || [])
      setErr('')
    } catch { setErr('ต่อกับเซิร์ฟเวอร์ไม่ได้') }
  }, [])
  const loadThread = useCallback(async (cid: string) => {
    try {
      const r = await fetch(`/api/web/chat?cid=${cid}`)
      if (r.ok) setMsgs((await r.json()).thread?.messages || [])
    } catch { /* รอบหน้าลองใหม่ */ }
  }, [])

  useEffect(() => {
    loadRooms()
    const t = setInterval(() => { loadRooms(); if (open) loadThread(open) }, POLL_MS)
    return () => clearInterval(t)
  }, [open, loadRooms, loadThread])
  useEffect(() => { if (open) loadThread(open) }, [open, loadThread])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  async function send() {
    const text = reply.trim()
    if (!text || !open) return
    setReply('')
    setMsgs((m) => [...m, { from: 's', text, at: Date.now() }])
    await fetch('/api/web/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cid: open, text }),
    }).catch(() => {})
    loadThread(open); loadRooms()
  }
  async function removeRoom(cid: string) {
    if (!confirm('ลบห้องแชทนี้ทิ้ง? ข้อความทั้งหมดจะหายถาวร')) return
    await fetch(`/api/web/chat?cid=${cid}`, { method: 'DELETE' }).catch(() => {})
    setOpen(null)
    setRooms((r) => (r ?? []).filter((x) => x.cid !== cid))
  }

  const room = (rooms ?? []).find((r) => r.cid === open)
  const totalUnread = (rooms ?? []).reduce((a, r) => a + r.unread, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">
            แชทลูกค้า
            {totalUnread > 0 && <span className="ml-2 align-middle rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white">{totalUnread}</span>}
          </h1>
        </div>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden grid md:grid-cols-[300px_1fr] h-[calc(100vh-14rem)] min-h-[420px]">
        {/* รายชื่อห้อง */}
        <div className={`border-r border-gray-100 overflow-y-auto ${open ? 'hidden md:block' : ''}`}>
          {rooms === null ? (
            <div className="p-4 space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-50" />)}</div>
          ) : rooms.length === 0 ? (
            <div className="py-16 text-center text-gray-300">
              <I d={IC.chat} className="w-8 h-8 mx-auto mb-2" />
              <p className="text-[13px] text-gray-400">ยังไม่มีลูกค้าทักเข้ามา</p>
            </div>
          ) : rooms.map((r) => (
            <button key={r.cid} onClick={() => setOpen(r.cid)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors hover:bg-gray-50/80 ${open === r.cid ? 'bg-blue-50/60' : ''}`}>
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-[13px] font-black flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
                {(r.name || 'ล').charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-gray-900 truncate">{r.name || 'ลูกค้า'}</span>
                  {r.last && <span className="text-[10.5px] text-gray-300 shrink-0 tabular-nums">{when(r.last.at)}</span>}
                </span>
                <span className="block text-[11.5px] text-gray-400 truncate">
                  {r.last ? `${r.last.from === 's' ? 'ร้าน: ' : ''}${r.last.text}` : '—'}
                </span>
              </span>
              {r.unread > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{r.unread}</span>}
            </button>
          ))}
        </div>

        {/* บทสนทนา */}
        <div className={`flex flex-col min-w-0 ${open ? '' : 'hidden md:flex'}`}>
          {!room ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <I d={IC.chat} className="w-10 h-10 mb-2" />
              <p className="text-[13px] text-gray-400">เลือกห้องแชทจากด้านซ้าย</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button onClick={() => setOpen(null)} className="md:hidden text-gray-400 text-lg">‹</button>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-gray-900 truncate">{room.name || 'ลูกค้า'}</span>
                  {room.product && <span className="block text-[11px] text-gray-400 truncate">สนใจ: {room.product.t}</span>}
                </span>
                {room.phone && (
                  <a href={`tel:${room.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[12px] font-semibold text-blue-600">
                    <I d={IC.phone} className="w-3.5 h-3.5" /> {room.phone}
                  </a>
                )}
                <button onClick={() => removeRoom(room.cid)} className="text-gray-300 hover:text-red-500 transition-colors" title="ลบห้อง">
                  <I d={IC.trash} className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50/50">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 's' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                      m.from === 's' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-0.5 text-[10px] tabular-nums ${m.from === 's' ? 'text-white/60' : 'text-gray-300'}`}>{when(m.at)}</p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2.5">
                <input value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="พิมพ์ข้อความตอบลูกค้า…"
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                <button onClick={send} disabled={!reply.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-40">
                  <I d={IC.send} className="w-3.5 h-3.5" /> ส่ง
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-300">ข้อความชุดเดียวกับ gucut.com/admin/chat/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
