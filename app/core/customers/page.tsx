'use client'
// ลูกค้า / คู่ค้า — รวมยอดจากออเดอร์ในคลังเงา (D1)
//
// ตัวแทนหน้า "ลูกค้า/คู่ค้า" ของ ZORT
// ⚠️ รวมยอด**ในเบราว์เซอร์** จากออเดอร์ที่ดึงมาเป็นหน้า ๆ ผ่าน /api/core?list=orders
//    ทำแบบนี้เพราะฝั่งท่อหลังบ้าน (netlify/**) เป็นเขตของอีกฝั่ง แตะไม่ได้
//    ข้อมูลยังเล็ก (ออเดอร์หลักพัน) จึงพอไหว · วันไหนโตจนช้า ค่อยขอ endpoint รวมยอดฝั่งเซิร์ฟเวอร์
// ⚠️ จับลูกค้าด้วย "ชื่อ" ไม่ใช่เบอร์โทร — ชื่อซ้ำจะถูกนับรวมเป็นคนเดียว
//    ต้องเขียนบอกบนจอ ห้ามให้เข้าใจว่าเป็นตัวตนจริง
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Row {
  id: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
}
interface Person {
  name: string; orders: number; amount: number
  last: string; channels: string[]
}

const PAGE = 200
const MAX_PAGES = 12 // เพดานกันดึงยาวไม่จบ — ถ้าชนต้องบอกบนจอว่าข้อมูลไม่ครบ
const NO_NAME = 'ไม่ระบุชื่อ'

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

const SORTS = [
  { id: 'amount', label: 'ยอดซื้อมากสุด' },
  { id: 'orders', label: 'ซื้อบ่อยสุด' },
  { id: 'last', label: 'ซื้อล่าสุด' },
]

export default function CoreCustomersPage() {
  const [from, setFrom] = useState(() => thaiDay(90))
  const [to, setTo] = useState(() => thaiDay(0))
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('amount')

  const [people, setPeople] = useState<Person[]>([])
  const [scanned, setScanned] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      const all: Row[] = []
      let total = Infinity
      let page = 0
      while (all.length < total && page < MAX_PAGES) {
        const qs = new URLSearchParams({
          list: 'orders', from, to, limit: String(PAGE), offset: String(page * PAGE),
        })
        const res = await fetch(`/api/web/core?${qs}`)
        const d = await res.json()
        if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
        if (d?.skip) throw new Error(d.skip)
        total = Number(d.total ?? 0)
        const rows: Row[] = Array.isArray(d.rows) ? d.rows : []
        all.push(...rows)
        page++
        if (rows.length < PAGE) break
      }
      if (all.length < total) setTruncated(true)

      // รวมยอดต่อคน
      const map = new Map<string, Person>()
      for (const o of all) {
        const name = (o.customer || '').trim() || NO_NAME
        const cur = map.get(name)
        if (cur) {
          cur.orders += 1
          cur.amount += Number(o.amount) || 0
          if (o.order_date > cur.last) cur.last = o.order_date
          if (o.channel && !cur.channels.includes(o.channel)) cur.channels.push(o.channel)
        } else {
          map.set(name, {
            name,
            orders: 1,
            amount: Number(o.amount) || 0,
            last: o.order_date || '',
            channels: o.channel ? [o.channel] : [],
          })
        }
      }
      // Array.from ไม่ใช่ spread — tsconfig ของโปรเจกต์นี้ target ต่ำกว่า es2015
      setPeople(Array.from(map.values()))
      setScanned(all.length)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setPeople([])
      setScanned(0)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? people.filter((p) => p.name.toLowerCase().includes(needle))
      : people
    const sorted = [...list]
    if (sort === 'orders') sorted.sort((a, b) => b.orders - a.orders)
    else if (sort === 'last') sorted.sort((a, b) => b.last.localeCompare(a.last))
    else sorted.sort((a, b) => b.amount - a.amount)
    return sorted
  }, [people, q, sort])

  // "ลูกค้า" ไม่นับกองไม่ระบุชื่อ — มันคือหลายคนรวมกัน ไม่ใช่คนเดียว
  const named = people.filter((p) => p.name !== NO_NAME)
  const repeat = named.filter((p) => p.orders >= 2).length
  const totalAmount = people.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">👥 ลูกค้า / คู่ค้า — จากคลังของเราเอง</h1>
        <span className="text-[11px] text-gray-400">
          รวมยอดจากออเดอร์ในฐาน GUCUT Core (D1) · ไม่ได้ยิง ZORT
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
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
            ค้นชื่อ
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อลูกค้า"
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-500">
            เรียงลำดับ
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="mt-1 w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <button onClick={load} disabled={loading}
            className="text-[13px] font-semibold text-white bg-blue-600 rounded-lg px-3.5 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? '⏳ กำลังรวม…' : '🔄 ดึงใหม่'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2.5">
          ค้นชื่อกับเรียงลำดับทำในหน้าจอทันที ไม่ต้องกดดึงใหม่ · เปลี่ยน<b>ช่วงวัน</b>แล้วต้องกดดึงใหม่
        </p>
      </Card>

      {error && <ErrorBox title="ดึงข้อมูลลูกค้าไม่ได้">{error}</ErrorBox>}
      {loading && people.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {truncated && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ ออเดอร์ในช่วงนี้เยอะเกินกว่าที่ดึงไหวรอบเดียว — รวมยอดจาก {fmtNum(scanned)} ใบแรกเท่านั้น
              <b> ตัวเลขจึงยังไม่ครบ</b> ลองย่นช่วงวันให้สั้นลง
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon="👥" tone="blue" label="ลูกค้าที่มีชื่อ" value={fmtNum(named.length)} unit="ราย" />
            <StatCard icon="🔁" tone="green" label="ลูกค้าซื้อซ้ำ (≥2 ใบ)" value={fmtNum(repeat)} unit="ราย"
              note={named.length > 0 ? `${Math.round((repeat / named.length) * 100)}% ของลูกค้าที่มีชื่อ` : undefined} />
            <StatCard icon="💰" tone="purple" label="ยอดรวมในช่วงนี้" value={fmtBaht(totalAmount)}
              note={`จากออเดอร์ ${fmtNum(scanned)} ใบ`} />
          </div>

          <Card padded={false} className="overflow-hidden">
            {shown.length === 0 && <p className="text-[13px] text-gray-400 p-4">ไม่พบลูกค้าในเงื่อนไขนี้</p>}
            {shown.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[640px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">ชื่อลูกค้า</th>
                      <th className="text-left font-medium px-3 py-2.5">ช่องทางที่ซื้อ</th>
                      <th className="text-right font-medium px-3 py-2.5">จำนวนใบ</th>
                      <th className="text-right font-medium px-3 py-2.5">ยอดรวม</th>
                      <th className="text-right font-medium px-4 py-2.5">ซื้อล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 300).map((p) => (
                      <tr key={p.name} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[240px] truncate">
                          {p.name}
                          {p.name === NO_NAME && (
                            <span className="ml-1.5 text-[11px] text-gray-400">(หลายคนรวมกัน)</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{p.channels.join(' · ') || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmtNum(p.orders)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtBaht(p.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap">{p.last || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shown.length > 300 && (
                  <p className="text-[12px] text-gray-400 px-4 py-3 border-t border-gray-50">
                    แสดง 300 รายแรกจาก {fmtNum(shown.length)} ราย — ใช้ช่องค้นชื่อเพื่อหาคนที่ต้องการ
                  </p>
                )}
              </div>
            )}
            <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-50 leading-relaxed">
              ⚠️ จับลูกค้าด้วย <b>ชื่อที่บันทึกไว้ในออเดอร์</b> ไม่ใช่เบอร์โทร —
              ชื่อสะกดต่างกันจะนับเป็นคนละคน และชื่อซ้ำกันจะถูกนับรวมเป็นคนเดียว
              ใช้ดูภาพรวมได้ แต่ยังไม่ใช่ทะเบียนลูกค้าจริง
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
