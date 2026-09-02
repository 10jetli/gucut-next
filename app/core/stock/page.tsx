'use client'
// สินค้า/สต็อก — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT
//
// ตัวแทนหน้า "สินค้า" ของ ZORT · หน้าเดิม /products ยิงไป ZORT ตรง ๆ
// ⚠️ ตัวเลขที่นี่คือ "ภาพถ่ายสต็อกตอนตี 1" ไม่ใช่สดวินาทีนี้ — ต้องเขียนบอกบนจอเสมอ
//    ปล่อยให้เข้าใจว่าสดจะกลายเป็นจอที่โกหกเงียบ ๆ ตอนของขยับระหว่างวัน
import { useCallback, useEffect, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Row { sku: string; name: string; qty: number; price: number; sold: number }
interface Resp {
  skip?: string
  day: string; soldDays: number
  total: number; outOfStock: number; low: number; value: number
  limit: number; offset: number; rows: Row[]
}

const PAGE = 50
const SORTS = [
  { id: 'qty', label: 'ของใกล้หมดก่อน' },
  { id: 'sold', label: 'ขายดีก่อน' },
  { id: 'sku', label: 'เรียงตาม SKU' },
]

export default function CoreStockPage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('qty')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, sortId = sort) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'stock', sort: sortId, limit: String(PAGE), offset: String(off),
      })
      if (q.trim()) qs.set('q', q.trim())
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
  }, [q, sort])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">📦 สินค้า / สต็อก — จากคลังของเราเอง</h1>
        <span className="text-[11px] text-gray-400">
          อ่านจากฐาน GUCUT Core (D1) ล้วน · จอนี้ยังทำงานได้แม้วันที่เลิกใช้ ZORT แล้ว
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
          <label className="text-[12px] text-gray-500 md:col-span-2">
            ค้น SKU หรือชื่อสินค้า
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(0) }}
              placeholder="เช่น โซ่ หรือ NW-1234"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            เรียงลำดับ
            <select value={sort}
              onChange={(e) => { setSort(e.target.value); load(0, e.target.value) }}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <button onClick={() => load(0)} disabled={loading}
            className="text-[13px] font-semibold text-white bg-blue-600 rounded-lg px-3.5 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? '⏳ กำลังค้น…' : '🔍 ค้นหา'}
          </button>
        </div>
      </Card>

      {error && <ErrorBox title="ดึงสต็อกไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && <Card><p className="text-[13px] text-gray-500">{data.skip}</p></Card>}

      {data && !data.skip && (
        <>
          <Card>
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ ตัวเลขนี้คือ <b>ภาพถ่ายสต็อกของวันที่ {data.day}</b> (ถ่ายตอนตี 1) ไม่ใช่ยอดสดวินาทีนี้ ·
              ของที่ขยับระหว่างวันจะเห็นในภาพถ่ายรอบถัดไป
            </p>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="🧮" tone="blue" label="SKU ทั้งหมด" value={fmtNum(data.total)} unit="ตัว" />
            <StatCard icon="🚫" tone="red" label="ของหมด" value={fmtNum(data.outOfStock)} unit="ตัว" />
            <StatCard icon="⚠️" tone="orange" label="เหลือน้อย (≤3)" value={fmtNum(data.low)} unit="ตัว" />
            <StatCard icon="💎" tone="green" label="มูลค่าสต็อก" value={fmtBaht(data.value)} />
          </div>

          <Card padded={false} className="overflow-hidden">
            {rows.length === 0 && <p className="text-[13px] text-gray-400 p-4">ไม่พบสินค้าในเงื่อนไขนี้</p>}
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[620px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">SKU</th>
                      <th className="text-left font-medium px-3 py-2.5">ชื่อสินค้า</th>
                      <th className="text-right font-medium px-3 py-2.5">คงเหลือ</th>
                      <th className="text-right font-medium px-3 py-2.5">ขาย {data.soldDays} วัน</th>
                      <th className="text-right font-medium px-4 py-2.5">ราคาขาย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.sku} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{r.sku}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[280px] truncate">{r.name || '—'}</td>
                        <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                          r.qty <= 0 ? 'text-red-500' : r.qty <= 3 ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {r.qty <= 0 ? 'หมด' : fmtNum(r.qty)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{fmtNum(r.sold)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">{fmtBaht(r.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.total > PAGE && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                <span className="text-[12px] text-gray-500">
                  แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} ตัว
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
        </>
      )}
    </div>
  )
}
