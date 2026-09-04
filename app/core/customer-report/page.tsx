'use client'
// รายงาน → ลูกค้า — **ใครซื้อเท่าไหร่** รวมยอดจากออเดอร์ในคลังเงา (D1)
//
// ⚠️ **จอนี้ไม่ได้ลอกจาก ZORT** — ยังไม่เคยเห็นจอ รายงาน→ลูกค้า ของจริง
//    (ยิงไปแล้วถูกพาไปหน้า error ของ ZORT) ⇒ เป็นของเราเอง ห้ามเขียนว่าเหมือน ZORT
//    เดิมจออยู่ที่ /core/customers แล้วย้ายมาที่นี่ 3 ก.ย. 2569 เพราะ **ผู้ติดต่อ** ของ ZORT
//    คือ *ทะเบียนรายชื่อ* คนละเรื่องกับ *รายงานว่าใครซื้อเท่าไหร่* — เอาไปทับกันไม่ได้
//    ⇒ ทะเบียนผู้ติดต่อ 28,250 ราย อยู่ที่ /core/customers ตามเดิม
// ⚠️ รวมยอดในเบราว์เซอร์จาก /api/core?list=orders ทีละหน้า (ท่อหลังบ้านเป็นเขตอีกฝั่ง)
// ⚠️ จับลูกค้าด้วย "ชื่อ" ไม่ใช่เบอร์โทร — ชื่อซ้ำถูกนับรวมเป็นคนเดียว ต้องเขียนบอกบนจอ
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, BtnGhost, LinkText, summaryLine, EmptyState, thaiDate,
} from '@/components/zort'

interface Row { id: string; channel: string; amount: number; customer: string; order_date: string }
interface Person { name: string; orders: number; amount: number; last: string; channels: string[] }

const PAGE_FETCH = 200
const MAX_PAGES = 12
const PER_PAGE = 50
const NO_NAME = 'ไม่ระบุชื่อ'

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

const RANGES = [
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]

export default function CoreCustomersPage() {
  const [days, setDays] = useState(90)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'repeat' | 'once'>('all')
  const [page, setPage] = useState(0)

  const [people, setPeople] = useState<Person[]>([])
  const [scanned, setScanned] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (range = days) => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      const from = thaiDay(range - 1)
      const to = thaiDay(0)
      const all: Row[] = []
      let total = Infinity
      let p = 0
      while (all.length < total && p < MAX_PAGES) {
        const qs = new URLSearchParams({
          list: 'orders', from, to, limit: String(PAGE_FETCH), offset: String(p * PAGE_FETCH),
        })
        const res = await fetch(`/api/web/core?${qs}`)
        const d = await res.json()
        if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
        if (d?.skip) throw new Error(d.skip)
        total = Number(d.total ?? 0)
        const rows: Row[] = Array.isArray(d.rows) ? d.rows : []
        all.push(...rows)
        p++
        if (rows.length < PAGE_FETCH) break
      }
      if (all.length < total) setTruncated(true)

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
            name, orders: 1, amount: Number(o.amount) || 0,
            last: o.order_date || '', channels: o.channel ? [o.channel] : [],
          })
        }
      }
      // Array.from ไม่ใช่ spread — tsconfig ของโปรเจกต์นี้ target ต่ำกว่า es2015
      setPeople(Array.from(map.values()))
      setScanned(all.length)
      setDays(range)
      setPage(0)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setPeople([])
      setScanned(0)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load(90) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const named = people.filter((p) => p.name !== NO_NAME)
  const repeat = named.filter((p) => p.orders >= 2)
  const once = named.filter((p) => p.orders === 1)

  const filtered = useMemo(() => {
    const base = tab === 'repeat' ? repeat : tab === 'once' ? once : people
    const needle = q.trim().toLowerCase()
    const list = needle ? base.filter((p) => p.name.toLowerCase().includes(needle)) : base
    return [...list].sort((a, b) => b.amount - a.amount)
  }, [people, repeat, once, tab, q])

  const totalAmount = people.reduce((s, p) => s + p.amount, 0)
  const shown = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ลูกค้า"
        summary={
          <>
            {summaryLine(people.length, totalAmount)}
            {' | '}
            <span className="text-gray-400">รวมจากออเดอร์ {scanned.toLocaleString('th-TH')} ใบในคลังของเราเอง</span>
          </>
        }
        actions={
          <BtnGhost onClick={() => load()} disabled={loading}>
            {loading ? 'กำลังรวม…' : 'ดึงใหม่'}
          </BtnGhost>
        }
      />

      <SearchRow
        value={q}
        onChange={(v) => { setQ(v); setPage(0) }}
        onSubmit={() => setPage(0)}
        placeholder="ค้นชื่อลูกค้า"
        advanced={<LinkText onClick={() => setPage(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">แสดง</span>
            <select
              value={days}
              onChange={(e) => load(Number(e.target.value))}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </>
        }
      />

      {error && <ErrorBox title="ดึงข้อมูลลูกค้าไม่ได้">{error}</ErrorBox>}
      {loading && people.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {truncated && (
            <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
              ⚠️ ออเดอร์ในช่วงนี้เยอะเกินกว่าที่ดึงไหวรอบเดียว — รวมจาก {scanned.toLocaleString('th-TH')} ใบแรกเท่านั้น
              <b> ตัวเลขยังไม่ครบ</b> ลองเลือกช่วงที่สั้นลง
            </div>
          )}

          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: people.length },
              { id: 'repeat', label: 'ซื้อซ้ำ', count: repeat.length },
              { id: 'once', label: 'ซื้อครั้งเดียว', count: once.length },
            ]}
            active={tab}
            onChange={(id) => { setTab(id as 'all' | 'repeat' | 'once'); setPage(0) }}
          />

          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>ชื่อ</th>
                  <th className={TH}>ช่องทางที่ซื้อ</th>
                  <th className={THR}>จำนวนใบ</th>
                  <th className={THR}>ยอดรวม</th>
                  <th className={THR}>ซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={6} icon="👥" title="ไม่พบลูกค้าในเงื่อนไขนี้"
                    detail="รายชื่อลูกค้ารวมจากใบขาย — ถ้าเพิ่งมีออเดอร์ใหม่ ต้องรอรอบซิงก์ถัดไป" />
                )}
                {shown.map((p, i) => (
                  <tr key={p.name} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{page * PER_PAGE + i + 1}</td>
                    <td className={TD}>
                      {/* ⚠️ ไม่ทำสีฟ้า เพราะยังไม่มีหน้าปลายทางให้กด — สีฟ้าในตารางคือสัญญาว่ากดได้ */}
                      <span className="text-gray-900 font-medium">{p.name}</span>
                      {p.name === NO_NAME && (
                        <span className="ml-1.5 text-[11px] text-gray-400">(หลายคนรวมกัน)</span>
                      )}
                    </td>
                    <td className={`${TD} text-gray-500 max-w-[220px] truncate`}>{p.channels.join(' · ') || '—'}</td>
                    <td className={TDR}>{p.orders.toLocaleString('th-TH')}</td>
                    <td className={TDR}>{fmtMoney(p.amount)}</td>
                    <td className={`${TDR} text-gray-500`}>{thaiDate(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* แถบล่างแบบ ZORT: ซ้ายบอกจำนวน ขวาเลื่อนหน้า */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {filtered.length === 0 ? 0 : (page * PER_PAGE + 1).toLocaleString('th-TH')}–
                {Math.min((page + 1) * PER_PAGE, filtered.length).toLocaleString('th-TH')} จาก{' '}
                {filtered.length.toLocaleString('th-TH')} ราย
              </span>
              <div className="flex items-center gap-2">
                <BtnGhost onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← ก่อนหน้า</BtnGhost>
                <span className="text-[12px] text-gray-500">หน้า {page + 1} / {pageCount}</span>
                <BtnGhost onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page + 1 >= pageCount}>ถัดไป →</BtnGhost>
              </div>
            </div>
          </TableWrap>

          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ ZORT มีคอลัมน์ <b>เลขประจำตัวผู้เสียภาษี · เบอร์โทรศัพท์ · อีเมล</b> แต่คลังเงาของเรา
            <b> ไม่ได้เก็บสามอย่างนี้ไว้</b> จึงไม่ใส่คอลัมน์เปล่าให้ดูเหมือนมีข้อมูล ·
            และจับลูกค้าด้วย<b>ชื่อที่บันทึกในออเดอร์</b> ไม่ใช่เบอร์โทร — ชื่อสะกดต่างกันจะนับเป็นคนละคน
            ใช้ดูภาพรวมได้ แต่ยังไม่ใช่ทะเบียนลูกค้าจริง
          </p>
        </>
      )}
    </div>
  )
}
