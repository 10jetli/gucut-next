'use client'
import { useEffect, useState, useCallback } from 'react'

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
          <h1 className="text-lg font-bold text-gray-800">เชื่อมต่อบริการอื่น</h1>
          <p className="text-[11.5px] text-gray-400 mt-0.5" suppressHydrationWarning>
            {checkedAt ? 'ตรวจล่าสุด ' + new Date(checkedAt).toLocaleTimeString('th-TH') : 'สถานะการเชื่อมต่อและโทเคนของทุกบริการ'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[13px] text-blue-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'กำลังตรวจ...' : '🔄 ตรวจสอบอีกครั้ง'}
        </button>
      </div>

      {!loading && !error && (
        <div className={'rounded-xl border p-4 text-[13px] ' + (okCount === conns.length ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700')}>
          {okCount === conns.length
            ? '✅ ทุกการเชื่อมต่อใช้งานได้ปกติ (' + okCount + '/' + conns.length + ')'
            : '⚠️ มีการเชื่อมต่อที่มีปัญหา ' + (conns.length - okCount) + ' รายการ — ดูรายละเอียดด้านล่าง'}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">เกิดข้อผิดพลาด: {error}</div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">กำลังตรวจสอบการเชื่อมต่อทุกบริการ...</div>
      )}

      <div className="space-y-3">
        {conns.map((c) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 flex items-start gap-4">
            <span className={'mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0 ' + (c.ok ? 'bg-green-500' : 'bg-red-500')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold text-gray-800">{c.name}</p>
                <span className={'text-[10.5px] px-2 py-0.5 rounded-full font-semibold ' + (c.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
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
