'use client'
import type { Order } from '@/lib/types'

function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusColor(s: string) {
  if (s === 'Complete' || s === 'Paid') return 'text-green-600'
  if (s === 'Pending' || s === 'WaitPayment') return 'text-yellow-600'
  if (s === 'Cancel') return 'text-red-500'
  return 'text-gray-500'
}

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    Shopee: 'bg-orange-100 text-orange-700',
    Lazada: 'bg-blue-100 text-blue-700',
    TikTok: 'bg-pink-100 text-pink-700',
    Line:   'bg-green-100 text-green-700',
  }
  const key = Object.keys(colors).find((k) => channel.includes(k)) ?? ''
  const cls = colors[key] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cls}`}>
      {channel.split(' ')[0]}
    </span>
  )
}

export default function OrderCard({ order }: { order: Order }) {
  const dt = order.createdatetimeString ?? ''
  const date = dt.slice(0, 10)
  const time = dt.slice(11, 16)
  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-blue-500 truncate">
          #{order.number}
        </span>
        <ChannelBadge channel={order.saleschannel ?? 'Direct'} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[13px] text-gray-600 truncate">{order.customername}</span>
        <span className="text-[14px] font-bold text-gray-900 flex-shrink-0">
          {fmtBaht(order.amount ?? 0)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className={`text-[12px] font-semibold ${statusColor(order.status)}`}>
          {order.status}
        </span>
        <span className="text-[11px] text-gray-400">
          {date} {time}
        </span>
      </div>
    </div>
  )
}
