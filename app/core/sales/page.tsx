'use client'
// รายการขาย — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT เลยสักคำสั่ง
//
// จอนี้คือตัวแทนหน้า "รายการขาย" ของ ZORT ซึ่งเป็นจอที่ร้านเปิดบ่อยที่สุด
// หน้าเดิม /orders กับ /sales ยิงไป ZORT ตรง ๆ — ตัด ZORT เมื่อไหร่จอเปล่าทันที
// ตัวนี้จึงเป็นจอแรกที่ "อยู่ได้โดยไม่มี ZORT" · ระหว่างนี้ใช้คู่กันไปก่อนเพื่อเทียบว่าตรงไหม
import { useCallback, useEffect, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Row {
  id: string; source: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
}
interface ChannelRow { channel: string; orders: number; amount: number }
interface ListResp {
  skip?: string
  from: string; to: string
  total: number; totalAmount: number
  limit: number; offset: number
  rows: Row[]; byChannel: ChannelRow[]; channels: string[]
}
interface Detail {
  error?: string
  order?: Row & { updated_at?: string }
  items?: { line: number; sku: string; name: string; qty: number; amount: number }[]
}

const thaiToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const daysAgo = (n: number) =>
  new Date(Date.now() + 7 * 3600e3 - n * 864e5).toISOString().slice(0, 10)

const PAGE = 50

export default function CoreSalesPage() {
  // ค่าเริ่มต้นคำนวณครั้งเดียวตอนสร้าง state — ไม่ให้ค่าขยับทุก render
  const [from, setFrom] = useState(() => daysAgo(30))
  const [to, setTo] = useState(() => thaiToday())
  const [channel, setChannel] = useState('')
  const [q, setQ] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [offset, setOffset] = useState(0)

  const [data, setData] = useState<ListResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailFor, setDetailFor] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'orders', from, to, limit: String(PAGE), offset: String(off),
      })
      if (channel) qs.set('channel', channel)
      if (q.trim()) qs.set('q', q.trim())
      if (cancelled) qs.set('cancelled', '1')
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [from, to, channel, q, cancelled])

  // โหลดครั้งแรกเท่านั้น — เปลี่ยนตัวกรองแล้วต้องกด "ค้นหา" เอง
  // (กติกาเจ้าของร้าน: หน้าที่ยิง API ต้องกดเอง ไม่ยิงเองรัว ๆ ตอนพิมพ์)
  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(id: string) {
    if (detailFor === id) { setDetailFor(''); setDetail(null); return }
    setDetailFor(id)
    setDetail(null)
    try {
      const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
      const d = await res.json()
      setDetail(d)
    } catch (e) {
      setDetail({ error: String(e instanceof Error ? e.message : e) })
    }
  }

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">🧾 รายการขาย — จากคลังของเราเอง</h1>
        <span className="text-[11px] text-gray-400">
          อ่านจากฐาน GUCUT Core (D1) ล้วน · จอนี้ยังทำงานได้แม้วันที่เลิกใช้ ZORT แล้ว
        </span>
      </div>

      {/* ตัวกรอง */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
          <label className="text-[12px] text-gray-500">
            ตั้งแต่
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            ถึง
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            ช่องทาง
            <select value={channel} onChange={(e) => setChannel(e.target.value)}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              <option value="">ทุกช่องทาง</option>
              {(data?.channels ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-[12px] text-gray-500 md:col-span-2">
            ค้นเลขที่ใบ / ชื่อลูกค้า
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(0) }}
              placeholder="เช่น SO-1234 หรือ สมชาย"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <button onClick={() => load(0)} disabled={loading}
            className="text-[13px] font-semibold text-white bg-blue-600 rounded-lg px-3.5 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? '⏳ กำลังค้น…' : '🔍 ค้นหา'}
          </button>
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12.5px] text-gray-600">
          <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />
          รวมใบที่ยกเลิกด้วย (ปกติไม่นับเป็นยอดขาย)
        </label>
      </Card>

      {error && <ErrorBox title="ดึงรายการขายไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <Card><p className="text-[13px] text-gray-500">{data.skip}</p></Card>
      )}

      {data && !data.skip && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon="🧾" tone="blue" label="จำนวนใบในช่วงนี้" value={fmtNum(data.total)} unit="ใบ" />
            <StatCard icon="💰" tone="green" label="ยอดรวมในช่วงนี้" value={fmtBaht(data.totalAmount)} />
            <StatCard icon="🏪" tone="purple" label="ช่องทางที่มียอด" value={fmtNum((data.byChannel ?? []).length)} unit="ช่องทาง" />
          </div>

          {(data.byChannel ?? []).length > 0 && (
            <Card>
              <p className="text-[13px] font-semibold text-gray-700 mb-2.5">ยอดแยกช่องทาง (เฉพาะช่วงที่กรองอยู่)</p>
              <div className="flex flex-wrap gap-2">
                {data.byChannel.map((c) => (
                  <button key={c.channel} onClick={() => { setChannel(c.channel); load(0) }}
                    className="text-[12px] border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition-colors">
                    <b className="text-gray-800">{c.channel}</b>
                    <span className="text-gray-500"> · {fmtNum(c.orders)} ใบ · {fmtBaht(c.amount)}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card padded={false} className="overflow-hidden">
            {rows.length === 0 && <p className="text-[13px] text-gray-400 p-4">ไม่พบใบขายในเงื่อนไขนี้</p>}
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[720px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">วันที่</th>
                      <th className="text-left font-medium px-3 py-2.5">เลขที่ใบ</th>
                      <th className="text-left font-medium px-3 py-2.5">ช่องทาง</th>
                      <th className="text-left font-medium px-3 py-2.5">ลูกค้า</th>
                      <th className="text-left font-medium px-3 py-2.5">สถานะ</th>
                      <th className="text-right font-medium px-4 py-2.5">ยอด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}
                        onClick={() => openDetail(r.id)}
                        className={`border-t border-gray-50 cursor-pointer hover:bg-blue-50/40 transition-colors ${detailFor === r.id ? 'bg-blue-50/60' : ''}`}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{r.order_date}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{r.number}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.channel}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[200px] truncate">{r.customer}</td>
                        <td className="px-3 py-2.5 text-gray-500">{r.status}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtBaht(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* หน้าถัดไป/ก่อนหน้า */}
            {data.total > PAGE && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                <span className="text-[12px] text-gray-500">
                  แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} ใบ
                </span>
                <div className="flex gap-2">
                  <button onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}
                    className="text-[12.5px] font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                    ← ก่อนหน้า
                  </button>
                  <button onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}
                    className="text-[12.5px] font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                    ถัดไป →
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* รายละเอียดใบที่กด */}
          {detailFor && (
            <Card>
              <p className="text-[13px] font-semibold text-gray-700 mb-2.5">
                📄 รายละเอียดใบ {detail?.order?.number ?? detailFor}
              </p>
              {!detail && <p className="text-[13px] text-gray-400">กำลังโหลด…</p>}
              {detail?.error && <p className="text-[13px] text-red-500">{detail.error}</p>}
              {detail?.items && detail.items.length === 0 && (
                <p className="text-[13px] text-gray-400">ใบนี้ไม่มีรายการสินค้าในคลังเงา</p>
              )}
              {detail?.items && detail.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px] min-w-[480px]">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">SKU</th>
                        <th className="text-left font-medium px-3 py-2">ชื่อสินค้า</th>
                        <th className="text-right font-medium px-3 py-2">จำนวน</th>
                        <th className="text-right font-medium px-3 py-2">ยอด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.line} className="border-t border-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{it.sku || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{it.name}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmtNum(it.qty)}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtBaht(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
