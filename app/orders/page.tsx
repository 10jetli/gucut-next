'use client'
import { useEffect, useState } from 'react'
import type { Order } from '@/lib/types'
import OrderCard from '@/components/OrderCard'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState('1')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/zort?endpoint=Order/GetOrders&limit=50&store=${store}`)
      .then(r => r.json())
      .then(d => setOrders(d?.list ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [store])

  return (
    <div>
      <div className="sticky top-[57px] bg-white z-10 flex gap-2 px-4 py-2 border-b border-gray-100">
        {['1', '2'].map(s => (
          <button
            key={s}
            onClick={() => setStore(s)}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
              store === s ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === '1' ? 'Gucut' : 'Ceojet'}
          </button>
        ))}
      </div>
      <div className="bg-white mt-2 rounded-xl mx-4 shadow-sm overflow-hidden">
        {loading && <p className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</p>}
        {!loading && orders.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">ไม่มี orders</p>
        )}
        {orders.map(o => <OrderCard key={o.number} order={o} />)}
      </div>
    </div>
  )
}
