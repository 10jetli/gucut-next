'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Order, Return } from '@/lib/types'
import OrderCard from '@/components/ui/OrderCard'
import { fmtBaht } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'

export default function DashboardPage() {
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [weekRevenue, setWeekRevenue] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [returns, setReturns] = useState<Return[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [factoryStats, setFactoryStats] = useState({ production: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshed, setRefreshed] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

      const [todayRes, weekRes, prodRes, returnRes, recentRes, sheetsRes] = await Promise.allSettled([
        fetch(`/api/zort?endpoint=Order/GetOrders&orderdateafter=${today}&orderdatebefore=${today}`).then(r => r.json()),
        fetch(`/api/zort?endpoint=Order/GetOrders&orderdateafter=${weekAgo}&orderdatebefore=${today}&limit=200`).then(r => r.json()),
        fetch(`/api/zort?endpoint=Product/GetProducts&limit=1`).then(r => r.json()),
        fetch(`/api/zort?endpoint=ReturnOrder/GetReturnOrders&limit=100`).then(r => r.json()),
        fetch(`/api/zort?endpoint=Order/GetOrders&limit=10`).then(r => r.json()),
        fetch('/api/sheets').then(r => r.json()),
      ])

      if (todayRes.status === 'fulfilled' && todayRes.value?.list) {
        setTodayOrders(todayRes.value.list)
      }
      if (weekRes.status === 'fulfilled' && weekRes.value?.list) {
        const total = weekRes.value.list.reduce((s: number, o: Order) => s + (o.amount ?? 0), 0)
        setWeekRevenue(total)
      }
      if (prodRes.status === 'fulfilled') {
        setProductCount(prodRes.value?.count ?? 0)
      }
      if (returnRes.status === 'fulfilled' && returnRes.value?.list) {
        setReturns(returnRes.value.list)
      }
      if (recentRes.status === 'fulfilled' && recentRes.value?.list) {
        setRecentOrders(recentRes.value.list.slice(0, 5))
      }
      if (sheetsRes.status === 'fulfilled' && sheetsRes.value?.orders) {
        const orders = sheetsRes.value.orders as Array<{ status: string }>
        setFactoryStats({
          production: orders.filter(o => o.status === 'production').length,
          pending:    orders.filter(o => o.status === 'pending' || o.status === 'deposit').length,
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshed(new Date())
    }
  }, [])

  useEffect(() => { load() }, [load])

  const returnTotal = returns.reduce((s, r) => s + (r.paymentamount ?? 0), 0)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Page header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hidden md:block text-lg font-bold text-gray-800">ภาพรวมร้าน</h1>
          <span className="text-[11px] text-gray-400" suppressHydrationWarning>อัพเดต {refreshed.toLocaleTimeString('th-TH')}</span>
        </div>
        <button onClick={load} className="text-[12px] md:text-[13px] text-blue-600 bg-white md:border md:border-gray-200 md:rounded-lg md:px-3 md:py-1.5 md:shadow-sm flex items-center gap-1 hover:bg-blue-50 transition-colors">
          🔄 รีเฟรช
        </button>
      </div>

      {loading && <LoadingState />}

      {/* ── Stat cards: แถวเดียว 4 ใบบนจอ PC แบบ Zort ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-[12px] text-gray-400 mb-1">📦 Orders วันนี้</p>
          <p className="text-2xl md:text-3xl font-black text-gray-900">{todayOrders.length} <span className="text-sm font-normal text-gray-500">orders</span></p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-[12px] text-gray-400 mb-1">💰 ยอดขาย (7 วัน)</p>
          <p className="text-2xl md:text-3xl font-black text-gray-900">{fmtBaht(weekRevenue)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-[12px] text-gray-400 mb-1">🛍 สินค้าทั้งหมด</p>
          <p className="text-2xl md:text-3xl font-black text-gray-900">{productCount} <span className="text-sm font-normal text-gray-500">ใน ZORT</span></p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-[12px] text-gray-400 mb-1">↩️ สินค้าตีกลับ (30 วัน)</p>
          <p className="text-2xl md:text-3xl font-black text-gray-900">{returns.length} <span className="text-sm font-normal text-gray-500">รายการ</span></p>
          {returns.length > 0 && <p className="text-[12px] text-red-500 mt-1">มูลค่า {fmtBaht(returnTotal)}</p>}
        </div>
      </div>

      {/* ── แถวล่าง: โรงงาน + Orders ล่าสุด ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 xl:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] md:text-[13px] font-semibold text-gray-600">🏭 การสั่งของกับโรงงาน</p>
            <Link href="/factory" className="text-[11px] text-blue-500">ดูทั้งหมด →</Link>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-black text-orange-500">{factoryStats.pending}</p>
              <p className="text-[11px] text-gray-400">ยังไม่มัดจำ</p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-500">{factoryStats.production}</p>
              <p className="text-[11px] text-gray-400">กำลังผลิต</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-gray-100">
            <p className="text-[13px] font-semibold text-gray-700">📋 Orders ล่าสุด</p>
            <Link href="/orders" className="text-[11px] text-blue-500">ดูทั้งหมด →</Link>
          </div>
          {recentOrders.map((o) => (
            <OrderCard key={o.number} order={o} />
          ))}
        </div>
      </div>
    </div>
  )
}
