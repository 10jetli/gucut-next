'use client'
import { useEffect, useState } from 'react'
import type { FactoryOrder } from '@/lib/types'

type StatusFilter = 'all' | 'production' | 'pending' | 'deposit' | 'done'

const STATUS_LABEL: Record<string, string> = {
  production: 'กำลังผลิต',
  pending:    'รอดำเนินการ',
  deposit:    'วางมัดจำแล้ว',
  done:       'เสร็จแล้ว',
}

const STATUS_COLOR: Record<string, string> = {
  production: 'bg-blue-100 text-blue-700',
  pending:    'bg-yellow-100 text-yellow-700',
  deposit:    'bg-purple-100 text-purple-700',
  done:       'bg-green-100 text-green-700',
}

export default function FactoryPage() {
  const [orders, setOrders] = useState<FactoryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch('/api/sheets')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.detail ?? d.error)
        setOrders(d.orders ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter)

  const stats = {
    all:        orders.length,
    production: orders.filter(o => o.status === 'production').length,
    pending:    orders.filter(o => o.status === 'pending').length,
    deposit:    orders.filter(o => o.status === 'deposit').length,
    done:       orders.filter(o => o.status === 'done').length,
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-black text-blue-600">{stats.production}</p>
          <p className="text-[11px] text-blue-500">กำลังผลิต</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-2xl font-black text-yellow-600">{stats.pending}</p>
          <p className="text-[11px] text-yellow-600">รอดำเนินการ</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'production', 'pending', 'deposit', 'done'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f === 'all' ? `ทั้งหมด (${stats.all})` : `${STATUS_LABEL[f] ?? f} (${stats[f as keyof typeof stats]})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</p>}

      {error && (
        <div className="bg-red-50 rounded-xl p-4 text-sm text-red-600">
          <p className="font-semibold">โหลดไม่ได้</p>
          <p className="text-[11px] mt-1 break-all">{error}</p>
          <p className="text-[11px] mt-2 text-red-400">
            ตรวจสอบว่า Google Sheets ถูก Share เป็น &quot;Anyone with the link can view&quot;
          </p>
        </div>
      )}

      {/* Order cards */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filtered.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">ไม่มีรายการ</p>
          )}
          {filtered.map((o, i) => (
            <FactoryCard key={o.id ?? i} order={o} />
          ))}
        </div>
      )}
    </div>
  )
}

function FactoryCard({ order }: { order: FactoryOrder }) {
  const statusCls = STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'
  const statusLabel = STATUS_LABEL[order.status] ?? order.status

  // Parse images
  let images: Array<{ thumb: string; url: string }> = []
  try {
    if (order.images) images = JSON.parse(order.images)
  } catch { /* ignore */ }

  // Format due date — use Gregorian calendar (en-GB gives "20 Mar 2026" style)
  const fmtDate = (s: string) => {
    if (!s) return ''
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const due = fmtDate(order.due)

  return (
    <div className="px-4 py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 leading-tight">{order.product}</p>
          <p className="text-[12px] text-gray-500 mt-0.5">🏭 {order.factory}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCls}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex gap-4 mt-2 text-[12px] text-gray-600">
        {order.qty ? <span>จำนวน: <strong>{order.qty}</strong></span> : null}
        {order.deposit ? <span>มัดจำ: <strong className="text-orange-600">{order.deposit}</strong></span> : null}
        {order.total ? <span>รวม: <strong className="text-gray-900">{order.total}</strong></span> : null}
      </div>

      {due && (
        <p className="text-[11px] text-gray-400 mt-1">📅 กำหนด: {due}</p>
      )}

      {order.note && (
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{order.note}</p>
      )}

      {images.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {images.map((img, idx) => (
            <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt=""
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100"
              />
            </a>
          ))}
        </div>
      )}

      {order.updated && (
        <p className="text-[10px] text-gray-300 mt-2">อัพเดต: {fmtDate(String(order.updated))}</p>
      )}
    </div>
  )
}
