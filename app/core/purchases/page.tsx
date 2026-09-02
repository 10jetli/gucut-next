'use client'
// รายการซื้อ — ตัวแทนหน้า "รายการซื้อ" ของ ZORT
//
// ⚠️ ของฝั่งเราไม่ได้อยู่ที่เดียวเหมือน ZORT — การซื้อจริงของร้านกระจายอยู่ 2 ที่:
//    · สั่งของกับโรงงาน  → /api/sheets  (ใบสั่งซื้อจริงที่ทำให้ของเข้าคลัง)
//    · นำเข้าจากจีน      → /api/import  (ยัง "พิจารณา" อยู่ ไม่ใช่ใบซื้อ)
//    จอนี้จึงรวมให้ดูที่เดียวแบบ ZORT แต่ **ไม่ทำซ้ำหน้าที่ของหน้าเดิม** —
//    แก้ไข/อัปรูป/เปลี่ยนสถานะ ยังทำที่ ติดตามออเดอร์ กับ นำเข้าจากจีน เหมือนเดิม
//
// ⚠️ ช่องว่างที่ยังปิดไม่ได้จากฝั่งจอ: การซื้อพวกนี้ **ยังไม่ตัดเข้าคลังเงา**
//    ZORT รับของเข้าแล้วสต็อกขึ้นเอง แต่ของเราต้องมีคนเขียน stock_moves ให้ก่อน
//    ซึ่งอยู่ในเขตท่อหลังบ้าน (netlify/**) — เขียนบอกไว้บนจอแล้ว ห้ามถอด
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { TrackerOrder, TrackerStatus } from '@/lib/types'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

const STATUS_LABEL: Record<TrackerStatus, string> = {
  pending: 'ยังไม่มัดจำ',
  talking: 'เริ่มคุยแล้ว',
  deposit: 'มัดจำแล้ว',
  production: 'กำลังผลิต',
  shipping: 'กำลังส่ง',
  warehouse: 'ถึงโกดัง',
  done: 'เสร็จแล้ว',
}
const STATUS_COLOR: Record<TrackerStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  talking: 'bg-sky-100 text-sky-700',
  deposit: 'bg-amber-100 text-amber-700',
  production: 'bg-blue-100 text-blue-700',
  shipping: 'bg-indigo-100 text-indigo-700',
  warehouse: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
}
// ยังไม่จบ = ยังเป็นเงินที่ผูกไว้กับของที่ยังไม่ถึงมือ
const OPEN: TrackerStatus[] = ['pending', 'talking', 'deposit', 'production', 'shipping']

const money = (s: string) => Number(String(s ?? '').replace(/[^0-9.-]/g, '')) || 0

export default function CorePurchasesPage() {
  const [orders, setOrders] = useState<TrackerOrder[]>([])
  const [importCount, setImportCount] = useState<number | null>(null)
  const [filter, setFilter] = useState<'open' | 'all' | TrackerStatus>('open')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [sheetRes, impRes] = await Promise.allSettled([
      fetch('/api/sheets').then((r) => r.json()),
      fetch('/api/import').then((r) => r.json()),
    ])
    if (sheetRes.status === 'fulfilled' && Array.isArray(sheetRes.value?.orders)) {
      setOrders(sheetRes.value.orders as TrackerOrder[])
    } else {
      // ใบสั่งซื้อดึงไม่ได้ต้องบอก ไม่ใช่โชว์ตารางว่างเหมือนไม่มีของสั่งค้าง
      setError('ดึงรายการสั่งของกับโรงงานไม่ได้')
      setOrders([])
    }
    if (impRes.status === 'fulfilled' && Array.isArray(impRes.value?.items)) {
      setImportCount(impRes.value.items.length)
    } else {
      setImportCount(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter === 'open' && !OPEN.includes(o.status)) return false
      if (filter !== 'open' && filter !== 'all' && o.status !== filter) return false
      if (!needle) return true
      return (
        String(o.product ?? '').toLowerCase().includes(needle) ||
        String(o.factory ?? '').toLowerCase().includes(needle)
      )
    })
  }, [orders, filter, q])

  const openOrders = orders.filter((o) => OPEN.includes(o.status))
  const openValue = openOrders.reduce((s, o) => s + money(o.total), 0)
  const paidDeposit = openOrders.reduce((s, o) => s + money(o.deposit), 0)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">🧾 รายการซื้อ</h1>
          <span className="text-[11px] text-gray-400">
            รวมการซื้อของร้านไว้ที่เดียวแบบ ZORT · แก้ไขรายตัวยังทำที่หน้าเดิม
          </span>
        </div>
        <button onClick={load} disabled={loading}
          className="text-[12.5px] font-semibold text-blue-600 bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50">
          <span className={loading ? 'spinner inline-block' : ''}>🔄</span> รีเฟรช
        </button>
      </div>

      {error && <ErrorBox title="ดึงรายการซื้อไม่ได้">{error}</ErrorBox>}
      {loading && orders.length === 0 && <LoadingState />}

      <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
        ⚠️ <b>ของที่ซื้อเข้ามายังไม่บวกเข้าคลังเงาอัตโนมัติ</b> — ZORT รับของเข้าแล้วสต็อกขึ้นเอง
        แต่ของเรายังต้องรอท่อ &quot;รับของเข้า&quot; ฝั่งหลังบ้าน ตอนนี้จึงเห็นเป็นรายการซื้อเฉย ๆ
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="📋" tone="blue" label="ใบสั่งซื้อที่ยังไม่จบ" value={fmtNum(openOrders.length)} unit="ใบ" />
        <StatCard icon="💰" tone="orange" label="มูลค่าที่ยังค้างอยู่" value={fmtBaht(openValue)}
          note={paidDeposit > 0 ? `มัดจำไปแล้ว ${fmtBaht(paidDeposit)}` : undefined} />
        <StatCard icon="🇨🇳" tone="purple" label="รายการนำเข้าจีนที่กำลังดู"
          value={importCount === null ? '—' : fmtNum(importCount)} unit="รายการ"
          note="ยังไม่ใช่ใบซื้อ" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {([['open', 'ที่ยังไม่จบ'], ['all', 'ทั้งหมด']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`text-[12.5px] font-semibold rounded-xl px-3 py-1.5 border transition-colors ${
                filter === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
          {(Object.keys(STATUS_LABEL) as TrackerStatus[]).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-[12.5px] font-semibold rounded-xl px-3 py-1.5 border transition-colors ${
                filter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นชื่อสินค้า หรือโรงงาน"
            className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px]" />
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-gray-100">
          <p className="text-[13px] font-semibold text-gray-700">🏭 สั่งของกับโรงงาน</p>
          <Link href="/tracker" className="text-[11px] text-blue-600 font-medium hover:text-blue-700">
            แก้ไข/อัปรูป ที่หน้าติดตามออเดอร์ →
          </Link>
        </div>
        {!loading && shown.length === 0 && (
          <p className="text-[13px] text-gray-400 p-4">ไม่มีใบสั่งซื้อในเงื่อนไขนี้</p>
        )}
        {shown.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[720px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">สินค้า</th>
                  <th className="text-left font-medium px-3 py-2.5">โรงงาน</th>
                  <th className="text-right font-medium px-3 py-2.5">จำนวน</th>
                  <th className="text-right font-medium px-3 py-2.5">มัดจำ</th>
                  <th className="text-right font-medium px-3 py-2.5">ยอดรวม</th>
                  <th className="text-left font-medium px-3 py-2.5">สถานะ</th>
                  <th className="text-left font-medium px-4 py-2.5">กำหนด</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[240px] truncate">{o.product || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[160px] truncate">{o.factory || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmtNum(o.qty)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{money(o.deposit) ? fmtBaht(money(o.deposit)) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{money(o.total) ? fmtBaht(money(o.total)) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{o.due || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-700">🇨🇳 นำเข้าจากจีน</p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {importCount === null
                ? 'ดึงข้อมูลไม่ได้ตอนนี้'
                : `กำลังพิจารณาอยู่ ${fmtNum(importCount)} รายการ — ยังไม่ใช่ใบซื้อจนกว่าจะสั่งจริง`}
            </p>
          </div>
          <Link href="/import" className="text-[12.5px] font-semibold text-blue-600 border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-blue-50 transition-colors shrink-0">
            เปิดหน้านำเข้า →
          </Link>
        </div>
      </Card>
    </div>
  )
}
