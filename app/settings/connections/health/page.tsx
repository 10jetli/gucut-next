'use client'
// ตรวจสุขภาพการเชื่อมต่อ — **ยิงของจริงทุกครั้งที่กด** (Gmail · ZORT 2 ร้าน · Google Sheets)
//
// ⚠️ **คนละจอกับ "ทะเบียนการเชื่อมต่อ" (/settings/connections)** ซึ่งลอกผังมาจาก ZORT
//    ทะเบียน = "เราต่ออะไรไว้บ้าง" · จอนี้ = "ตอนนี้มันยังเดินอยู่ไหม"
//    เดิมจอนี้อยู่ที่ /settings/connections แล้วย้ายมาที่นี่ 3 ก.ย. 2569 — **ไม่ได้ลบ**
// ⚠️ ห้ามให้เช็คอัตโนมัติ ต้องกดเอง (กติกาเจ้าของร้าน — ประหยัดทรัพยากร)
import { useEffect, useState, useCallback } from 'react'
import LoadingState from '@/components/ui/LoadingState'

interface ConnStatus {
  id: string
  name: string
  detail: string
  ok: boolean
  message: string
  latencyMs: number
}

export default function ConnectionsPage() {
  const [conns, setConns] = useState<ConnStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/connections')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'โหลดไม่สำเร็จ')
      setConns(j.connections ?? [])
      setCheckedAt(j.checkedAt)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const okCount = conns.filter(c => c.ok).length

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">ตรวจสุขภาพการเชื่อมต่อ</h1>
          <p className="text-[11.5px] text-gray-400 mt-0.5" suppressHydrationWarning>
            {checkedAt ? 'ตรวจล่าสุด ' + new Date(checkedAt).toLocaleTimeString('th-TH') : 'สถานะการเชื่อมต่อและโทเคนของทุกบริการ'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[13px] font-medium text-blue-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'กำลังตรวจ...' : '🔄 ตรวจสอบอีกครั้ง'}
        </button>
      </div>

      {!loading && !error && (
        <div className={'rounded-2xl border p-4 text-[13px] ' + (okCount === conns.length ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
          {okCount === conns.length
            ? '✅ ทุกการเชื่อมต่อใช้งานได้ปกติ (' + okCount + '/' + conns.length + ')'
            : '⚠️ มีการเชื่อมต่อที่มีปัญหา ' + (conns.length - okCount) + ' รายการ — ดูรายละเอียดด้านล่าง'}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">เกิดข้อผิดพลาด: {error}</div>
      )}

      {loading && <LoadingState />}

      <div className="space-y-3">
        {conns.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 flex items-start gap-4 transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_28px_-14px_rgba(15,23,42,0.2)]">
            <span className={'mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0 ' + (c.ok ? 'bg-emerald-500' : 'bg-red-500')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold text-gray-800">{c.name}</p>
                <span className={'text-[10.5px] px-2 py-0.5 rounded-full font-semibold ' + (c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                  {c.ok ? 'เชื่อมต่อแล้ว' : 'มีปัญหา'}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mt-0.5">{c.detail}</p>
              <p className={'text-[12.5px] mt-1.5 break-words ' + (c.ok ? 'text-gray-600' : 'text-red-600')}>{c.message}</p>
            </div>
            <span className="text-[11px] text-gray-300 shrink-0">{c.latencyMs} ms</span>
          </div>
        ))}
      </div>
    </div>
  )
}
