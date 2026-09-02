'use client'
// แชทคอมเมิร์ซ — จอรวมแชททุกช่องทางไว้ที่เดียว
// **ลอกผังจาก ZORT Chat Commerce ของจริง** (ภาพจอที่เจ้าของร้านส่งมา 2 ก.ย. 2569)
// ซ้าย = หัวข้อ "รวมแชท" · แถวบัญชีช่องทาง · ตัวกรอง · รายชื่อห้อง | ขวา = บทสนทนา
//
// ⚠️ **ตอนนี้ต่อจริงได้ช่องทางเดียว: ข้อความที่ลูกค้าทักผ่านหน้าเว็บร้าน**
//    Facebook กับ LINE ยัง "ยังไม่ได้เชื่อม" — และนั่นไม่ใช่ของที่ลืมทำ แต่มีด่านจริงอยู่
//    ⇒ กดที่ช่องทางที่ยังไม่เชื่อม จะเห็นว่าติดอะไรและต้องทำอะไรถึงจะเปิดได้ (ดู HOWTO ด้านล่าง)
//
// ⚠️ **ห้ามทำให้ดูเหมือนเชื่อมแล้ว** — จอที่โชว์ Facebook/LINE เป็นแท็บเปล่าเงียบ ๆ
//    จะทำให้เข้าใจว่า "ไม่มีใครทักมา" ทั้งที่จริงคือเรายังไม่ได้รับข้อความเลย
//    แล้วลูกค้าที่ทักมาจริงจะถูกทิ้งไว้โดยไม่มีใครรู้ (โรคประจำโปรเจกต์: ระบบถูก แต่สื่อสารผิด)
//
// ⚠️ **หน้าเดิม /web/chat ยังอยู่ ห้ามลบ** เป็นจอเว็บล้วนแบบง่าย ใช้เป็นทางสำรอง
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

/* ────────────────────────── ข้อมูล ────────────────────────── */

interface Room {
  cid: string; name: string; phone: string
  product: { h: string; t: string } | null
  last: { from: string; text: string; at: number } | null
  unread: number; n: number
}
interface Msg { from: 'c' | 's'; text: string; at: number; by?: string }

type ChKey = 'web' | 'facebook' | 'line'

interface Channel {
  key: ChKey
  name: string
  account: string
  logo?: string
  /** ต่อจริงแล้วหรือยัง — ตัวนี้คุมทั้งสีไอคอนและข้อความบนจอ ห้ามฝืนเป็น true */
  live: boolean
}

const CHANNELS: Channel[] = [
  { key: 'web', name: 'เว็บไซต์', account: 'gucut.com', live: true },
  { key: 'facebook', name: 'Facebook', account: 'เลื่อยยนต์ gucut newwave', logo: '/logos/facebook.webp', live: false },
  { key: 'line', name: 'LINE', account: '@gucut1', logo: '/logos/line.png', live: false },
]

/** ติดอะไรอยู่ และต้องทำอะไรถึงจะเปิดได้ — เขียนจากข้อเท็จจริง ไม่ใช่ "เร็ว ๆ นี้" */
const HOWTO: Record<Exclude<ChKey, 'web'>, { blocker: string; steps: string[]; safe: string }> = {
  facebook: {
    blocker:
      'ยังไม่ได้สร้างแอป Facebook ของร้าน — ข้อความที่ลูกค้าทักเพจจึงยังไม่ไหลเข้ามาที่นี่',
    steps: [
      'สร้างแอปที่ developers.facebook.com ในชื่อร้าน',
      'ขอสิทธิ์ pages_messaging และ pages_manage_metadata แล้วรอ Facebook ตรวจ',
      'ให้เพจอนุญาตแอป แล้วชี้ webhook ข้อความมาที่เว็บเรา',
    ],
    safe:
      'ทำได้เลยโดยไม่กระทบของที่ใช้อยู่ — เพจหนึ่งเพจอนุญาตหลายแอปพร้อมกันได้ ZORT ยังรับข้อความต่อได้ตามปกติ',
  },
  line: {
    blocker:
      'LINE ให้บัญชีหนึ่งบัญชีมี webhook ได้ **เส้นทางเดียว** และตอนนี้ชี้ไปที่ ZORT อยู่ — ย้ายมาที่เราเมื่อไหร่ แชท LINE ในแอป ZORT หยุดรับข้อความทันที',
    steps: [
      'ทำจอนี้ให้ใช้งานได้ครบก่อน (ตอบ · ค้นหา · แท็ก · ประวัติ)',
      'ตกลงวันสับสวิตช์ แล้วย้าย webhook ของ @gucut1 มาที่เว็บเรา',
      'เลิกใช้แชทในแอป ZORT Social Commerce',
    ],
    safe:
      'เป็นขั้นท้าย ๆ ของโครงการโดยตั้งใจ — ห้ามแตะ webhook ตราบใดที่ร้านยังตอบลูกค้าผ่าน ZORT อยู่ทุกวัน',
  },
}

const POLL_MS = 5000

const when = (ms: number) => {
  const d = new Date(ms), now = new Date()
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function ChannelIcon({ ch, size = 18, dim = false }: { ch: Channel; size?: number; dim?: boolean }) {
  if (ch.logo) {
    return (
      <Image
        src={ch.logo}
        alt={ch.name}
        width={size}
        height={size}
        className={`rounded-[4px] object-contain ${dim ? 'grayscale opacity-45' : ''}`}
      />
    )
  }
  // เว็บไซต์ไม่มีโลโก้แพลตฟอร์ม — วาดเป็นลูกโลกสีแบรนด์
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[4px] bg-[#1b3b73] text-white ${dim ? 'opacity-45' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
      </svg>
    </span>
  )
}

/* ────────────────────────── จอ ────────────────────────── */

export default function ChatCommercePage() {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [filter, setFilter] = useState<'all' | ChKey>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const loadRooms = useCallback(async () => {
    try {
      const r = await fetch('/api/web/chat')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setRooms(Array.isArray(d?.rooms) ? d.rooms : [])
      setErr('')
    } catch {
      setErr('ต่อกับเซิร์ฟเวอร์ไม่ได้ — ข้อความที่เห็นอาจไม่ใช่ล่าสุด')
    }
  }, [])

  const loadThread = useCallback(async (cid: string) => {
    try {
      const r = await fetch(`/api/web/chat?cid=${encodeURIComponent(cid)}`)
      if (r.ok) {
        const d = await r.json()
        setMsgs(Array.isArray(d?.thread?.messages) ? d.thread.messages : [])
      }
    } catch { /* รอบหน้าลองใหม่ */ }
  }, [])

  // ⚠️ หยุดโพลตอนแท็บถูกบัง — จอนี้เปิดค้างทั้งวัน ยิงทุก 5 วิตลอดคืนโดยไม่มีคนดูคือเปล่าประโยชน์
  useEffect(() => {
    loadRooms()
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadRooms()
      if (open) loadThread(open)
    }, POLL_MS)
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
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cid: open, text }),
    }).catch(() => {})
    loadThread(open)
    loadRooms()
  }

  // ห้องทั้งหมดตอนนี้มาจากช่องทางเว็บอย่างเดียว — พอต่อช่องทางอื่นได้ ค่อยอ่าน r.channel จริง
  const list = useMemo(() => {
    let out = rooms ?? []
    if (filter !== 'all' && filter !== 'web') out = []
    const s = q.trim().toLowerCase()
    if (s) {
      out = out.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(s) ||
          (r.phone || '').includes(s) ||
          (r.last?.text || '').toLowerCase().includes(s),
      )
    }
    return out
  }, [rooms, filter, q])

  const room = (rooms ?? []).find((r) => r.cid === open)
  const webUnread = (rooms ?? []).reduce((a, r) => a + (Number(r.unread) || 0), 0)
  const notLive = filter !== 'all' && filter !== 'web' ? HOWTO[filter as Exclude<ChKey, 'web'>] : null
  const notLiveCh = CHANNELS.find((c) => c.key === filter)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-baseline gap-3 mb-3">
        <h1 className="text-[26px] leading-tight font-semibold text-gray-900">แชทคอมเมิร์ซ</h1>
        <p className="text-[12.5px] text-gray-500">
          รวมแชททุกช่องทางไว้จอเดียว · ตอนนี้ต่อจริงแล้ว 1 จาก 3 ช่องทาง
        </p>
      </div>

      {err && (
        <p className="text-[12.5px] text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 mb-3">{err}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden grid md:grid-cols-[340px_1fr] h-[calc(100vh-13rem)] min-h-[460px]">
        {/* ───────── ซ้าย: ช่องทาง + รายชื่อห้อง ───────── */}
        <div className={`border-r border-gray-200 flex flex-col min-w-0 ${open ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-3.5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[14.5px] font-semibold text-gray-900">รวมแชท</p>
            {webUnread > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{webUnread}</span>
            )}
          </div>

          {/* แถวบัญชีช่องทาง — แบบเดียวกับ ZORT ที่โชว์ไอคอนเพจไว้บนสุด
              ⚠️ ช่องทางที่ยังไม่เชื่อมต้องดูออกทันที: ไอคอนขาวดำ + ป้าย "ยังไม่เชื่อม" */}
          <div className="px-3 py-2.5 border-b border-gray-100 flex gap-2">
            {CHANNELS.map((c) => {
              const active = filter === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => { setFilter(active ? 'all' : c.key); setOpen(null) }}
                  title={c.live ? `${c.name} · ${c.account}` : `${c.name} · ยังไม่ได้เชื่อม`}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 transition-colors ${
                    active ? 'border-[#1b3b73] bg-[#eef3fb]' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <ChannelIcon ch={c} size={16} dim={!c.live} />
                  <span className={`text-[11.5px] ${c.live ? 'text-gray-700' : 'text-gray-400'}`}>{c.name}</span>
                  {!c.live && <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                </button>
              )
            })}
          </div>

          <div className="px-3 py-2 border-b border-gray-100">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ เบอร์ หรือข้อความ"
              className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {rooms === null ? (
              <div className="p-3 space-y-2 animate-pulse">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded bg-gray-50" />)}
              </div>
            ) : filter !== 'all' && filter !== 'web' ? (
              <p className="px-3.5 py-6 text-[12.5px] text-gray-400 leading-relaxed">
                ช่องทางนี้ยังไม่ได้เชื่อม จึงยังไม่มีข้อความเข้ามาที่นี่เลย —
                ดูรายละเอียดทางขวา
              </p>
            ) : list.length === 0 ? (
              <p className="px-3.5 py-6 text-[12.5px] text-gray-400">
                {q ? 'ไม่พบข้อความที่ค้นหา' : 'ยังไม่มีลูกค้าทักเข้ามา'}
              </p>
            ) : (
              list.map((r) => (
                <button
                  key={r.cid}
                  onClick={() => setOpen(r.cid)}
                  className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left border-b border-gray-50 hover:bg-gray-50 ${
                    open === r.cid ? 'bg-[#eef3fb]' : ''
                  }`}
                >
                  <span className="relative shrink-0">
                    <span className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 text-[13px] font-bold flex items-center justify-center">
                      {(r.name || 'ล').charAt(0)}
                    </span>
                    {/* ป้ายช่องทางมุมล่างซ้ายของรูป — เหมือน ZORT ที่ติดไอคอน f / LINE ไว้ */}
                    <span className="absolute -bottom-0.5 -left-0.5 ring-2 ring-white rounded-[4px]">
                      <ChannelIcon ch={CHANNELS[0]} size={13} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-900 truncate">{r.name || 'ลูกค้า'}</span>
                      {r.last && <span className="text-[10.5px] text-gray-400 shrink-0 tabular-nums">{when(r.last.at)}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="block text-[11.5px] text-gray-500 truncate flex-1">
                        {r.last ? `${r.last.from === 's' ? 'ร้าน: ' : ''}${r.last.text}` : '—'}
                      </span>
                      {r.unread > 0 && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ───────── ขวา: บทสนทนา / วิธีเชื่อมช่องทาง ───────── */}
        <div className={`flex flex-col min-w-0 ${open ? 'flex' : 'hidden md:flex'}`}>
          {notLive && notLiveCh ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-[520px] mx-auto">
                <div className="flex items-center gap-2.5 mb-3">
                  <ChannelIcon ch={notLiveCh} size={26} dim />
                  <div>
                    <p className="text-[16px] font-semibold text-gray-900">{notLiveCh.name}</p>
                    <p className="text-[12px] text-gray-500">{notLiveCh.account}</p>
                  </div>
                  <span className="ml-auto text-[11.5px] font-semibold text-amber-800 bg-amber-100 rounded px-2 py-0.5">
                    ยังไม่ได้เชื่อม
                  </span>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-4">
                  <p className="text-[13px] font-semibold text-gray-800 mb-1.5">ติดอะไรอยู่</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{notLive.blocker}</p>

                  <p className="text-[13px] font-semibold text-gray-800 mt-4 mb-1.5">ต้องทำอะไรถึงจะเปิดได้</p>
                  <ol className="text-[13px] text-gray-700 leading-relaxed list-decimal pl-5 space-y-1">
                    {notLive.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>

                  <p className="text-[12.5px] text-gray-600 leading-relaxed mt-4 pt-3 border-t border-gray-100">
                    <b>กระทบของที่ใช้อยู่ไหม:</b> {notLive.safe}
                  </p>
                </div>

                <p className="text-[12px] text-gray-400 leading-relaxed mt-3">
                  ส่วนแชทของ Shopee · Lazada · TikTok ต้องได้สิทธิ์ Chat API ของแต่ละเจ้าก่อน
                  ซึ่งเป็นสิทธิ์ที่ขอยากที่สุดในสามอย่างที่ยื่นไป — ระหว่างนี้ยังตอบที่ Duoke
                </p>
              </div>
            </div>
          ) : !room ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <svg width="92" height="92" viewBox="0 0 92 92" fill="none" aria-hidden>
                <rect x="8" y="18" width="52" height="38" rx="10" fill="#c7d6f7" />
                <rect x="32" y="34" width="52" height="38" rx="10" fill="#f2c6dc" />
                <rect x="42" y="47" width="20" height="4" rx="2" fill="#fff" />
                <rect x="42" y="56" width="13" height="4" rx="2" fill="#fff" opacity=".8" />
              </svg>
              <p className="text-[16px] font-semibold text-gray-800 mt-4">เลือกห้องแชทจากด้านซ้าย</p>
              <p className="text-[12.5px] text-gray-500 mt-1 max-w-[380px] leading-relaxed">
                ตอนนี้จอนี้รับข้อความจาก<b>หน้าเว็บร้าน</b>ช่องทางเดียว ·
                กดไอคอน Facebook หรือ LINE ด้านซ้ายเพื่อดูว่าติดอะไรอยู่
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-200">
                <button onClick={() => setOpen(null)} className="md:hidden text-gray-400 text-lg leading-none">‹</button>
                <ChannelIcon ch={CHANNELS[0]} size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{room.name || 'ลูกค้า'}</span>
                  {room.product && <span className="block text-[11px] text-gray-500 truncate">สนใจ: {room.product.t}</span>}
                </span>
                {room.phone && (
                  <a href={`tel:${room.phone}`} className="text-[12px] font-semibold text-blue-600 hover:underline">
                    {room.phone}
                  </a>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 's' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${
                      m.from === 's' ? 'bg-[#1b3b73] text-white' : 'bg-white text-gray-800 border border-gray-200'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-0.5 text-[10px] tabular-nums ${m.from === 's' ? 'text-white/60' : 'text-gray-400'}`}>
                        {when(m.at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-2.5">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="พิมพ์ข้อความตอบลูกค้า…"
                  className="flex-1 rounded border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                />
                <button
                  onClick={send}
                  disabled={!reply.trim()}
                  className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: '#1b3b73' }}
                >
                  ส่ง
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[11.5px] text-gray-400 mt-2.5 leading-relaxed">
        ข้อความชุดเดียวกับหน้า <b>แชทลูกค้า</b> เดิม (ยังใช้ได้เป็นทางสำรอง) ·
        จอนี้หยุดดึงข้อความเองเมื่อสลับไปแท็บอื่น
      </p>
    </div>
  )
}
