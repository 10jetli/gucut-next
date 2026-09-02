'use client'
// รายงาน — ตัวแทนเมนู "รายงาน" ของ ZORT · อ่านจากคลังเงา (D1) ล้วน
//
// สามมุมที่ร้านถามบ่อยสุด: ขายได้เท่าไหร่แต่ละเดือน · ช่องทางไหนทำเงิน · อะไรขายดี
// ⚠️ รวมยอดรายเดือนในเบราว์เซอร์จากออเดอร์ที่ดึงมาเป็นหน้า ๆ (ท่อหลังบ้านเป็นเขตอีกฝั่ง)
//    ชนเพดานเมื่อไหร่ต้องขึ้นแถบเตือนว่าตัวเลขไม่ครบ ห้ามโชว์เฉย ๆ เหมือนครบแล้ว
// ⚠️ "สินค้าขายดี" มาจาก /api/core?list=stock ซึ่งนับเฉพาะ SKU ที่ยังมีในภาพถ่ายสต็อกวันล่าสุด
//    ของที่เลิกขายไปแล้วจะไม่โผล่ — เขียนบอกไว้บนจอ
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

interface Row {
  id: string; number: string; channel: string
  amount: number; customer: string; order_date: string
}
interface ChannelRow { channel: string; orders: number; amount: number }
interface StockRow { sku: string; name: string; qty: number; sold: number }

const PAGE = 200
const MAX_PAGES = 12
const RANGES = [
  { id: 90, label: '90 วัน' },
  { id: 180, label: '6 เดือน' },
  { id: 365, label: '1 ปี' },
]

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const idx = Number(m) - 1
  return `${THAI_MONTH[idx] ?? m} ${Number(y) + 543 - 2500}`
}

export default function CoreReportsPage() {
  const [days, setDays] = useState(90)
  const [orders, setOrders] = useState<Row[]>([])
  const [byChannel, setByChannel] = useState<ChannelRow[]>([])
  const [best, setBest] = useState<StockRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (range = days) => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      const from = thaiDay(range)
      const to = thaiDay(0)

      const all: Row[] = []
      let total = Infinity
      let page = 0
      let channels: ChannelRow[] = []
      while (all.length < total && page < MAX_PAGES) {
        const qs = new URLSearchParams({
          list: 'orders', from, to, limit: String(PAGE), offset: String(page * PAGE),
        })
        const res = await fetch(`/api/web/core?${qs}`)
        const d = await res.json()
        if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
        if (d?.skip) throw new Error(d.skip)
        total = Number(d.total ?? 0)
        if (page === 0 && Array.isArray(d.byChannel)) channels = d.byChannel
        const rows: Row[] = Array.isArray(d.rows) ? d.rows : []
        all.push(...rows)
        page++
        if (rows.length < PAGE) break
      }
      if (all.length < total) setTruncated(true)
      setOrders(all)
      setByChannel(channels)

      // สินค้าขายดี — ยืมตัวเรียง sold จากจอสต็อก ไม่ต้องรวมเอง
      const sRes = await fetch(`/api/web/core?list=stock&sort=sold&limit=15&soldDays=${Math.min(90, range)}`)
      const sd = await sRes.json()
      setBest(Array.isArray(sd?.rows) ? sd.rows.filter((r: StockRow) => r.sold > 0) : [])
      setDays(range)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setOrders([])
      setByChannel([])
      setBest([])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load(90) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const byMonth = useMemo(() => {
    const map = new Map<string, { orders: number; amount: number }>()
    for (const o of orders) {
      const ym = (o.order_date || '').slice(0, 7)
      if (!ym) continue
      const cur = map.get(ym) ?? { orders: 0, amount: 0 }
      cur.orders += 1
      cur.amount += Number(o.amount) || 0
      map.set(ym, cur)
    }
    return Array.from(map.entries())
      .map(([ym, v]) => ({ ym, ...v }))
      .sort((a, b) => a.ym.localeCompare(b.ym))
  }, [orders])

  const totalAmount = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const avg = orders.length ? totalAmount / orders.length : 0
  const peakMonth = byMonth.reduce<{ ym: string; amount: number } | null>(
    (best2, m) => (!best2 || m.amount > best2.amount ? m : best2), null
  )
  const maxMonth = Math.max(...byMonth.map((m) => m.amount), 1)
  const maxChannel = Math.max(...byChannel.map((c) => c.amount), 1)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="รายงาน"
        summary="ยอดรายเดือน · ช่องทางที่ทำเงิน · สินค้าขายดี — อ่านจากคลังของเราเอง"
        actions={
          <div className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => load(r.id)} disabled={loading}
              className={`text-[12.5px] font-semibold rounded-xl px-3 py-1.5 border transition-colors disabled:opacity-50 ${
                days === r.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}>
              {r.label}
            </button>
          ))}
          </div>
        }
      />

      {error && <ErrorBox title="ดึงรายงานไม่ได้">{error}</ErrorBox>}
      {loading && orders.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {truncated && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ ออเดอร์ในช่วงนี้เยอะเกินกว่าที่ดึงไหวรอบเดียว — รายงานคิดจาก {fmtNum(orders.length)} ใบแรกเท่านั้น
              <b> ตัวเลขยังไม่ครบ</b> ลองเลือกช่วงที่สั้นลง
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon="🧾" tone="blue" label={`ออเดอร์ ${days} วัน`} value={fmtNum(orders.length)} unit="ใบ" />
            <StatCard icon="💰" tone="green" label="ยอดขายรวม" value={fmtBaht(totalAmount)} />
            <StatCard icon="🧮" tone="purple" label="เฉลี่ยต่อใบ" value={fmtBaht(avg)} />
            <StatCard icon="🏆" tone="orange" label="เดือนที่ขายดีสุด"
              value={peakMonth ? monthLabel(peakMonth.ym) : '—'}
              note={peakMonth ? fmtBaht(peakMonth.amount) : undefined} />
          </div>

          {/* ยอดรายเดือน */}
          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-3">ยอดขายรายเดือน</p>
            {byMonth.length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มีข้อมูล</p>}
            <div className="space-y-2.5">
              {byMonth.map((m) => (
                <div key={m.ym}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12.5px] font-medium text-gray-800">{monthLabel(m.ym)}</span>
                    <span className="text-[12.5px] text-gray-500">
                      {fmtNum(m.orders)} ใบ · <b className="text-gray-900">{fmtBaht(m.amount)}</b>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.max((m.amount / maxMonth) * 100, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ช่องทาง */}
            <Card>
              <p className="text-[13px] font-semibold text-gray-700 mb-3">ช่องทางที่ทำเงิน</p>
              {byChannel.length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มีข้อมูล</p>}
              <div className="space-y-2.5">
                {byChannel.map((c) => (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[12.5px] font-medium text-gray-800 truncate">{c.channel}</span>
                      <span className="text-[12.5px] text-gray-500 shrink-0">
                        {fmtNum(c.orders)} ใบ · <b className="text-gray-900">{fmtBaht(c.amount)}</b>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max((c.amount / maxChannel) * 100, 2)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* สินค้าขายดี */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-gray-100">
                <p className="text-[13px] font-semibold text-gray-700">สินค้าขายดี 15 อันดับ</p>
              </div>
              {best.length === 0 && <p className="text-[13px] text-gray-400 p-4">ยังไม่มีข้อมูล</p>}
              {best.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px] min-w-[420px]">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left font-medium px-4 py-2">#</th>
                        <th className="text-left font-medium px-3 py-2">สินค้า</th>
                        <th className="text-right font-medium px-3 py-2">ขายไป</th>
                        <th className="text-right font-medium px-4 py-2">เหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {best.map((r, i) => (
                        <tr key={r.sku} className="border-t border-gray-50">
                          <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800 truncate max-w-[220px]">{r.name || r.sku}</div>
                            {r.name && <div className="text-[11px] text-gray-400">{r.sku}</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtNum(r.sold)}</td>
                          <td className={`px-4 py-2 text-right ${r.qty <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                            {r.qty <= 0 ? 'หมด' : fmtNum(r.qty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-50">
                นับเฉพาะ SKU ที่ยังมีในภาพถ่ายสต็อกล่าสุด — ของที่เลิกขายไปแล้วจะไม่โผล่ในอันดับนี้
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
