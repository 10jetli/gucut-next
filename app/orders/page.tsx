'use client'
import { useEffect, useState } from 'react'
import type { Order } from '@/lib/types'
import OrderCard from '@/components/ui/OrderCard'
import LoadingState from '@/components/ui/LoadingState'
import PillButton from '@/components/ui/PillButton'
import Card from '@/components/ui/Card'

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
      <div className="sticky top-0 md:top-14 bg-white/90 backdrop-blur-md z-10 flex gap-2 px-4 py-2.5 border-b border-gray-100">
        {['1', '2'].map(s => (
          <PillButton key={s} active={store === s} onClick={() => setStore(s)}>
            {s === '1' ? 'Gucut' : 'Ceojet'}
          </PillButton>
        ))}
      </div>
      <div className="p-4">
        <Card padded={false} className="overflow-hidden">
          {loading && <LoadingState />}
          {!loading && orders.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">ไม่มี orders</p>
          )}
          {orders.map(o => <OrderCard key={o.number} order={o} />)}
        </Card>
      </div>
    </div>
  )
}
