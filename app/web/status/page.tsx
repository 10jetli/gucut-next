'use client'
// สถานะระบบเว็บ — ฉบับเนื้อเดียวในหลังร้านหลัก · ท่อ /api/web/status
// ⚠️ กติกาเจ้าของร้าน: ตรวจเมื่อกดเอง ห้ามตรวจอัตโนมัติ (ประหยัดทรัพยากร)
import { useState } from 'react'

type State = 'ok' | 'slow' | 'warn' | 'off' | 'down'
interface Row { name: string; state: State; note?: string; ms: number }

const LOOK: Record<State, { label: string; text: string; dot: string; ring: string }> = {
  ok:   { label: 'ระบบปกติ',     text: 'text-emerald-600', dot: 'bg-emerald-500', ring: 'ring-emerald-50' },
  slow: { label: 'ช้าผิดปกติ',   text: 'text-amber-600',   dot: 'bg-amber-500',   ring: 'ring-amber-50' },
  warn: { label: 'ควรมาดู',      text: 'text-amber-600',   dot: 'bg-amber-500',   ring: 'ring-amber-50' },
  off:  { label: 'ยังไม่เปิดใช้', text: 'text-gray-400',    dot: 'bg-gray-300',    ring: 'ring-gray-50' },
  down: { label: 'ใช้ไม่ได้',     text: 'text-red-500',     dot: 'bg-red-500',     ring: 'ring-red-50' },
}
function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}

export default function WebStatusPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [at, setAt] = useState('')

  async function run() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/web/status')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setRows(Array.isArray(d.checks) ? d.checks : [])
      setAt(new Date().toLocaleTimeString('th-TH'))
    } catch { setErr('ตรวจไม่สำเร็จ — ลองใหม่อีกครั้ง') }
    finally { setBusy(false) }
  }

  const bad = (rows ?? []).filter((r) => r.state === 'down').length
  const warn = (rows ?? []).filter((r) => r.state === 'warn' || r.state === 'slow').length

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">สถานะระบบ</h1>
          {at && (
            <p className="text-[12px] mt-0.5">
              <span className="text-gray-400">ตรวจล่าสุด {at} · </span>
              {bad > 0 ? <span className="font-bold text-red-500">ใช้ไม่ได้ {bad} เรื่อง</span>
                : warn > 0 ? <span className="font-bold text-amber-600">ควรมาดู {warn} เรื่อง</span>
                : <span className="font-bold text-emerald-600">ทุกอย่างปกติ ✓</span>}
            </p>
          )}
        </div>
        <button onClick={run} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
          <I d="M20 11a8 8 0 10.9 4.5M20 4v6h-6" className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'กำลังตรวจ… (ยิงของจริงทุกตัว)' : 'ตรวจตอนนี้'}
        </button>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {rows === null && !busy ? (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] py-16 text-center">
          <p className="text-[13px] text-gray-400">กด &ldquo;ตรวจตอนนี้&rdquo; เพื่อยิงเช็คของจริงทั้ง 22 เรื่อง</p>
          <p className="text-[11.5px] text-gray-300 mt-1">ตั้งใจให้กดเองเท่านั้น ไม่ตรวจอัตโนมัติ — ประหยัดทรัพยากร</p>
        </div>
      ) : busy && rows === null ? (
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 space-y-3 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-gray-50" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
          {(rows ?? []).map((r) => {
            const l = LOOK[r.state] ?? LOOK.ok
            return (
              <div key={r.name} className="flex items-center gap-3.5 px-4 md:px-5 py-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.dot} ring-4 ${l.ring}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-gray-900">{r.name}</span>
                  {r.note && <span className="block text-[12px] text-gray-500 mt-0.5">{r.note}</span>}
                </span>
                <span className="text-right shrink-0">
                  <span className={`block text-[12px] font-bold ${l.text}`}>{l.label}</span>
                  <span className="block text-[10.5px] text-gray-300 tabular-nums">{r.ms} ms</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-center text-[11px] text-gray-300">ยิงเช็คของจริงทุกตัว ไม่ใช่ข้อความตายตัว — ชุดเดียวกับ gucut.com/admin/status/</p>
    </div>
  )
}
