'use client'
// ตรวจสุขภาพ SEO GEO AEO — ฉบับเนื้อเดียว
// ผลตรวจสร้างตอน build ของเว็บ (ท่อ /api/web/seo-audit) + บอต AI ที่มาจริง (/api/web/ai-bots)
// + สวิตช์คุมบอต (/api/web/bot-rules)
import { useEffect, useState } from 'react'

type Cat = 'seo' | 'speed' | 'ai'
interface Finding { cat: Cat; level: 'fix' | 'improve' | 'ok'; title: string; count: number; unit?: string; why: string; how: string; sample?: string[] }
interface Audit { at: number; findings: Finding[]; scores: Record<Cat, number>; score: number; files: { path: string; label: string; kb: number }[] }
interface BotDays { days?: Record<string, Record<string, number>> }
interface BotRow { bot: string; today: number; week: number }
interface Blockable { name: string; note: string }

const CATS: { key: Cat; t: string; sub: string }[] = [
  { key: 'seo', t: 'ค้นหา', sub: 'Google / Bing' },
  { key: 'speed', t: 'ความเร็ว', sub: 'โหลดไว ขึ้นอันดับ' },
  { key: 'ai', t: 'ผู้ช่วย AI', sub: 'ChatGPT / Gemini' },
]
const scoreColor = (n: number) => (n >= 90 ? 'text-emerald-600' : n >= 70 ? 'text-amber-600' : 'text-red-500')

export default function WebSeoPage() {
  const [audit, setAudit] = useState<Audit | null>(null)
  const [tab, setTab] = useState<Cat>('seo')
  const [bots, setBots] = useState<BotRow[] | null>(null)
  const [blockable, setBlockable] = useState<Blockable[] | null>(null)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/web/seo-audit').then((r) => r.json()).then(setAudit).catch(() => setMsg('โหลดผลตรวจไม่สำเร็จ'))
    fetch('/api/web/ai-bots').then((r) => r.json()).then((d: BotDays) => {
      // รวมยอดต่อบอต: วันนี้ + 7 วันล่าสุด (ข้อมูลมาเป็นราย "วัน → บอต → จำนวนหน้า")
      const days = d?.days || {}
      const keys = Object.keys(days).sort()
      const last7 = keys.slice(-7)
      const todayKey = keys[keys.length - 1]
      const agg = new Map<string, BotRow>()
      for (const k of last7) {
        for (const [bot, n] of Object.entries(days[k] || {})) {
          const cur = agg.get(bot) || { bot, today: 0, week: 0 }
          cur.week += Number(n) || 0
          if (k === todayKey) cur.today += Number(n) || 0
          agg.set(bot, cur)
        }
      }
      setBots(Array.from(agg.values()))
    }).catch(() => setBots([]))
    fetch('/api/web/bot-rules').then((r) => r.json()).then((d) => {
      setBlockable(Array.isArray(d.blockable) ? d.blockable : [])
      setBlocked(new Set(Array.isArray(d.blocked) ? d.blocked : []))
    }).catch(() => setBlockable([]))
  }, [])

  async function toggleBot(name: string) {
    const next = new Set(blocked)
    if (next.has(name)) next.delete(name); else next.add(name)
    setBlocked(next)
    const r = await fetch('/api/web/bot-rules', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blocked: Array.from(next) }),
    }).catch(() => null)
    if (!r?.ok) { setMsg('บันทึกสวิตช์ไม่สำเร็จ'); return }
    setMsg('บันทึกแล้ว ✓ มีผลภายใน ~5 นาที')
  }

  const shown = (audit?.findings ?? []).filter((f) => f.cat === tab)

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">ตรวจสุขภาพ SEO GEO AEO</h1>
        {audit && <p className="text-[12px] text-gray-400 mt-0.5">ตรวจจากข้อมูลจริงตอน build ล่าสุด · อัปเดตทุกครั้งที่ deploy</p>}
      </div>
      {msg && <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">{msg}</p>}

      {/* คะแนน 3 ด้าน */}
      <div className="grid grid-cols-3 gap-3">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setTab(c.key)}
            className={`bg-white rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] transition-all ${tab === c.key ? 'border-blue-300 ring-4 ring-blue-50' : 'border-gray-100/80 hover:-translate-y-0.5'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{c.t}</p>
            <p className={`text-[28px] font-black tabular-nums leading-none mt-1 ${audit ? scoreColor(audit.scores[c.key]) : 'text-gray-300'}`}>
              {audit ? audit.scores[c.key] : '—'}
            </p>
            <p className="text-[10.5px] text-gray-400 mt-1">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* รายการงาน */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
        {audit === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-50" />)}</div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-emerald-600 font-semibold">ด้านนี้ไม่มีงานค้าง ✓</p>
        ) : shown.map((f, i) => (
          <details key={i} className="group">
            <summary className="flex items-center gap-3 px-4 md:px-5 py-3 cursor-pointer list-none hover:bg-gray-50/80 transition-colors">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.level === 'fix' ? 'bg-red-500 ring-4 ring-red-50' : f.level === 'improve' ? 'bg-amber-500 ring-4 ring-amber-50' : 'bg-emerald-500 ring-4 ring-emerald-50'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-gray-900">{f.title}</span>
                <span className="block text-[11.5px] text-gray-400">{f.count.toLocaleString('th-TH')} {f.unit || 'รายการ'} · {f.level === 'fix' ? 'ควรแก้ก่อน' : f.level === 'improve' ? 'แก้แล้วดีขึ้น' : 'เรียบร้อย'}</span>
              </span>
              <span className="text-gray-200 group-open:rotate-90 transition-transform">›</span>
            </summary>
            <div className="px-4 md:px-5 pb-4 pl-10 text-[12.5px] space-y-1.5 bg-gray-50/50">
              <p className="pt-2 text-gray-700"><b className="text-gray-900">ทำไมต้องแก้:</b> {f.why}</p>
              <p className="text-gray-700"><b className="text-gray-900">แก้ยังไง:</b> {f.how}</p>
              {f.sample && f.sample.length > 0 && (
                <p className="text-gray-400 break-all">ตัวอย่าง: {f.sample.slice(0, 3).join(' · ')}</p>
              )}
            </div>
          </details>
        ))}
      </div>

      {/* บอต AI มาจริงไหม */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        <p className="px-4 md:px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">บอต AI มาเก็บข้อมูลหรือยัง (7 วัน)</p>
        <div className="divide-y divide-gray-50">
          {bots === null ? (
            <p className="px-5 py-6 text-[12.5px] text-gray-400">กำลังโหลด…</p>
          ) : bots.filter((b) => b.week > 0).length === 0 ? (
            <p className="px-5 py-6 text-[12.5px] text-gray-400 text-center">7 วันนี้ยังไม่มีบอต AI เข้ามา</p>
          ) : bots.filter((b) => b.week > 0).sort((a, b) => b.week - a.week).slice(0, 10).map((b) => (
            <div key={b.bot} className="flex items-center gap-3 px-4 md:px-5 py-2.5">
              <span className="flex-1 text-[13px] font-semibold text-gray-800">{b.bot}</span>
              <span className="text-[12px] text-gray-400 tabular-nums">วันนี้ {b.today}</span>
              <span className="text-[13px] font-black text-gray-900 tabular-nums w-16 text-right">{b.week.toLocaleString('th-TH')} หน้า</span>
            </div>
          ))}
        </div>
      </div>

      {/* สวิตช์คุมบอต — เขียว = อนุญาตให้เก็บ */}
      {blockable && blockable.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
          <p className="px-4 md:px-5 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">อนุญาตให้ AI เจ้าไหนเก็บข้อมูล</p>
          <p className="px-4 md:px-5 pb-2 text-[11px] text-gray-400">ปิดได้เฉพาะบอต AI — Googlebot/บอตโซเชียลไม่มีในรายการโดยตั้งใจ · เปลี่ยนแล้วมีผลใน ~5 นาที</p>
          <div className="divide-y divide-gray-50">
            {blockable.map((b) => {
              const on = !blocked.has(b.name)
              return (
                <div key={b.name} className="flex items-center gap-3 px-4 md:px-5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-gray-800">{b.name}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{b.note}</span>
                  </span>
                  <button onClick={() => toggleBot(b.name)}
                    className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${on ? 'left-[19px]' : 'left-0.5'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/seo/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
