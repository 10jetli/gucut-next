'use client'
// ยอดขายทุกช่องทาง — Shopee / Lazada / TikTok / GUCUT.com / POS ทั้ง 2 สาขา
//
// ⚠️ ย้ายมาอ่าน **คลังเงา (D1)** แล้ว 2 ก.ย. 2569 — เดิมยิง /api/sales-report ซึ่งดึงสดจาก ZORT
//    ตามกฎ "จอที่ยัง fetch /api/zort อยู่ = ยังไม่เสร็จ" จอนี้จึงต้องยืนได้เองวันที่เลิกใช้ ZORT
//    ตัวเลขชุดเดียวกับที่ /core/sales ใช้ จึงเทียบกันได้ตรง ๆ ไม่ใช่คนละแหล่ง
// รีเฟรชด้วยปุ่มเท่านั้น ไม่มี auto-refresh (กติกาเจ้าของร้าน)
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, Tabs, TableWrap, TH, THR, TD, TDR, EmptyState, ChannelTag,
} from '@/components/zort'

interface Report {
  range: { from: string; to: string; days: number }
  totals: { sales: number; orders: number; avg: number; prevSales: number; prevOrders: number }
  daily: { date: string; sales: number; orders: number }[]
  channels: { label: string; name: string; store: string; sales: number; orders: number; prevSales: number }[]
  // ยอดเงินรายสินค้ามาจาก /api/core?list=topproducts (รวมจาก order_items จริง)
  // ยังเป็น optional ไว้ เผื่อท่อนั้นล่ม — โชว์ขีดดีกว่าโชว์เลขที่เดาเอง
  topProducts: { name: string; sku: string; qty: number; amount?: number }[] | null
  /** ⚠️ ท่อสินค้าขายดีล้มเหลว — ต้องแยกจาก "ไม่มียอดขาย" ให้ขาด
   *  ตารางว่างเพราะยิงไม่ผ่าน แล้วเขียนว่า "ยังไม่มียอดขายในช่วงนี้"
   *  = พูดแทนธุรกิจว่าขายไม่ได้ ทั้งที่เราแค่ถามไม่สำเร็จ */
  topError?: string
}

interface CoreRow { number: string; channel: string; amount: number; order_date: string }
interface CoreChan { channel: string; orders: number; amount: number }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/** ดึงยอดรวมของช่วง — **ไม่ดึงแถวออเดอร์แล้ว** (แก้ 5 ก.ย. 2569)
 *  🔴 เดิมวนดึงทีละ 200 ใบ สูงสุด 12 หน้า = 2,400 ใบ มาบวกเป็นกราฟรายวันเองในเบราว์เซอร์
 *     ⇒ ช้าโดยไม่จำเป็น และ **ถ้าช่วงไหนเกิน 2,400 ใบ กราฟจะขาดหายเงียบ ๆ**
 *     (โรคเดียวกับจอการเงินที่เพิ่งแก้ — ค่าที่ต้องเห็นข้อมูลทั้งชุด ต้องให้ฐานคิดให้) */
async function fetchRange(from: string, to: string) {
  const qs = new URLSearchParams({ list: 'orders', from, to, limit: '1' })
  const res = await fetch(`/api/web/core?${qs}`)
  const d = await res.json()
  if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
  if (d?.skip) throw new Error(d.skip)
  return {
    total: Number(d.total ?? 0),
    amount: Number(d.totalAmount ?? 0),
    channels: (Array.isArray(d.byChannel) ? d.byChannel : []) as CoreChan[],
  }
}

/** ยอดรายวันจากฐานข้อมูล — GROUP BY วัน ยิงครั้งเดียวได้ทั้งช่วง
 *  ⚠️ **วันที่ไม่มีออเดอร์จะไม่มีแถวคืนมา** (ท่อเขียนเตือนไว้ในคำตอบเอง)
 *     ฝั่งกราฟต้องเติมวันว่างเป็น 0 เสมอ ไม่งั้นเส้นลากข้ามวันที่ขายไม่ได้
 *     แล้วกราฟจะดูเหมือนร้านขายได้ทุกวัน */
async function fetchDaily(days: number) {
  const res = await fetch(`/api/web/core?daily=1&days=${days}`)
  const d = await res.json()
  if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
  return (Array.isArray(d.days) ? d.days : []) as { day: string; orders: number; sales: number }[]
}

// ⚠️ ZORT ตั้งต้นที่ "ย้อนหลัง 3 เดือน" — เราจึงต้องมีช่วงนั้นให้เลือกด้วย
const PERIODS = [
  { days: 1, label: 'วันนี้' },
  { days: 7, label: 'ย้อนหลัง 7 วัน' },
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
]

/** รวมยอดรายวันเป็นถัง วัน/เดือน/ไตรมาส/ปี — ZORT มีปุ่มสี่อันนี้ที่มุมขวาล่างของกราฟ */
type Bucket = 'day' | 'month' | 'quarter' | 'year'
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'day', label: 'วัน' },
  { id: 'month', label: 'เดือน' },
  { id: 'quarter', label: 'ไตรมาส' },
  { id: 'year', label: 'ปี' },
]
function bucketKey(date: string, b: Bucket): string {
  const [y, m] = date.split('-')
  if (b === 'year') return y
  if (b === 'quarter') return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`
  if (b === 'month') return `${y}-${m}`
  return date
}
function groupDaily(daily: Report['daily'], b: Bucket): Report['daily'] {
  if (b === 'day') return daily
  const map = new Map<string, { sales: number; orders: number }>()
  for (const d of daily) {
    const k = bucketKey(d.date, b)
    const cur = map.get(k) ?? { sales: 0, orders: 0 }
    cur.sales += d.sales
    cur.orders += d.orders
    map.set(k, cur)
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }))
}

/** ดาวน์โหลดสรุปยอดขายเป็นไฟล์ Excel เปิดได้ (CSV + BOM ให้ Excel อ่านภาษาไทยออก)
 *  ⚠️ ZORT มีปุ่มนี้จริง ⇒ ของเราต้องทำงานจริงด้วย ไม่ใช่ปุ่มประดับ */
function downloadSummary(report: Report) {
  const lines = [
    ['ช่วงวันที่', `${report.range.from} ถึง ${report.range.to}`],
    ['ยอดขายรวม (บาท)', String(report.totals.sales)],
    ['จำนวนใบขาย', String(report.totals.orders)],
    ['เฉลี่ยต่อใบ (บาท)', String(Math.round(report.totals.avg))],
    [],
    ['วันที่', 'ยอดขาย (บาท)', 'จำนวนใบ'],
    ...report.daily.map((d) => [d.date, String(d.sales), String(d.orders)]),
    [],
    ['ช่องทาง', 'ยอดขาย (บาท)', 'จำนวนใบ'],
    ...report.channels.map((c) => [c.name, String(c.sales), String(c.orders)]),
  ]
  const csv = lines.map((r) => (r ?? []).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `สรุปยอดขาย-${report.range.from}-ถึง-${report.range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// สีประจำช่องทาง — เทียบจากชื่อจริงใน ZORT ไม่ตรงกับใครใช้สีเทา
function chanColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('shopee')) return 'bg-orange-500'
  if (n.includes('lazada')) return 'bg-indigo-500'
  if (n.includes('tiktok')) return 'bg-gray-900'
  if (n.includes('gucut')) return 'bg-red-500'
  if (n.includes('pos') || n.includes('หน้าร้าน')) return 'bg-emerald-500'
  return 'bg-gray-400'
}

function pct(cur: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (!prev) return cur ? { text: 'ใหม่', tone: 'up' } : { text: '—', tone: 'flat' }
  const p = ((cur - prev) / prev) * 100
  if (Math.abs(p) < 0.05) return { text: '0%', tone: 'flat' }
  return { text: `${p > 0 ? '+' : ''}${p.toFixed(1)}%`, tone: p > 0 ? 'up' : 'down' }
}

function PctBadge({ cur, prev }: { cur: number; prev: number }) {
  const { text, tone } = pct(cur, prev)
  const cls =
    tone === 'up' ? 'text-emerald-600 bg-emerald-50' : tone === 'down' ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50'
  return <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{text}</span>
}

// กราฟแท่งยอดขายรายวัน + เส้นจำนวนออเดอร์ — SVG ล้วน ไม่พึ่งไลบรารี
function TrendChart({ daily }: { daily: Report['daily'] }) {
  const W = 720, H = 200, PAD = 8
  const maxSales = Math.max(...daily.map((d) => d.sales), 1)
  const maxOrders = Math.max(...daily.map((d) => d.orders), 1)
  const n = daily.length
  const bw = Math.min(40, ((W - PAD * 2) / n) * 0.55)
  const x = (i: number) => PAD + ((W - PAD * 2) * (i + 0.5)) / n
  const line = daily
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - 24 - (d.orders / maxOrders) * (H - 48)).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="กราฟยอดขายรายวัน">
      {daily.map((d, i) => {
        const h = (d.sales / maxSales) * (H - 48)
        return (
          <g key={d.date}>
            <rect x={x(i) - bw / 2} y={H - 24 - h} width={bw} height={Math.max(h, 1)} rx={4} className="fill-blue-500/80" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {parseInt(d.date.slice(8), 10)}
            </text>
            {d.sales > 0 && (
              <text x={x(i)} y={H - 30 - h} textAnchor="middle" className="fill-gray-500 text-[9px] font-medium">
                {d.sales >= 1000 ? `${(d.sales / 1000).toFixed(d.sales >= 10000 ? 0 : 1)}K` : Math.round(d.sales)}
              </text>
            )}
          </g>
        )
      })}
      <path d={line} fill="none" strokeWidth={2} className="stroke-emerald-500" strokeLinejoin="round" strokeLinecap="round" />
      {daily.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={H - 24 - (d.orders / maxOrders) * (H - 48)} r={3} className="fill-emerald-500" />
      ))}
    </svg>
  )
}

export default function SalesReportPage() {
  const [days, setDays] = useState(7)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshed, setRefreshed] = useState(new Date())
  const [tab, setTab] = useState<'all' | 'branch' | 'chan' | 'mkt'>('all')
  const [bucket, setBucket] = useState<Bucket>('day')

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError('')
    try {
      const to = thaiDay(0)
      const from = thaiDay(d - 1)
      const prevTo = thaiDay(d)
      const prevFrom = thaiDay(d * 2 - 1)

      const [cur, prev, best, daily] = await Promise.all([
        fetchRange(from, to),
        fetchRange(prevFrom, prevTo),
        // ยอดขายรายสินค้าพร้อม "ยอดเงินจริง" จาก order_items (ไม่ใช่ qty คูณราคาขาย ซึ่งเป็นการเดา)
        fetch(`/api/web/core?list=topproducts&from=${from}&to=${to}&limit=10`)
          .then((r) => r.json())
          .catch(() => null),
        fetchDaily(d),
      ])

      // ยอดรายวัน — ฐานรวมมาให้แล้ว จอแค่**เติมวันที่ไม่มีออเดอร์ให้เป็นศูนย์**
      // ⚠️ ท่อไม่คืนแถวของวันที่ขายไม่ได้ ถ้าไม่เติมเอง เส้นกราฟจะลากข้ามวันนั้น
      //    แล้วดูเหมือนร้านขายได้ทุกวัน — ซึ่งเป็นการโกหกด้วยการละเว้น
      const byDay = new Map<string, { sales: number; orders: number }>()
      for (let i = d - 1; i >= 0; i--) byDay.set(thaiDay(i), { sales: 0, orders: 0 })
      for (const row of daily) {
        const slot = byDay.get(row.day)
        if (!slot) continue
        slot.sales = Number(row.sales) || 0
        slot.orders = Number(row.orders) || 0
      }

      const prevByChan = new Map(prev.channels.map((c) => [c.channel, c.amount]))
      const bestRows: { sku: string; name: string; qty: number; amount: number }[] =
        Array.isArray(best?.items) ? best.items.filter((r: { qty: number }) => r.qty > 0) : []
      const topError = !best ? 'ยิงไปที่ท่อสินค้าขายดีไม่สำเร็จ'
        : (typeof best.error === 'string' ? best.error
          : (Array.isArray(best.items) ? '' : 'ท่อสินค้าขายดีตอบมาในรูปแบบที่อ่านไม่ได้'))

      setReport({
        range: { from, to, days: d },
        totals: {
          sales: cur.amount,
          orders: cur.total,
          avg: cur.total ? cur.amount / cur.total : 0,
          prevSales: prev.amount,
          prevOrders: prev.total,
        },
        daily: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
        channels: cur.channels.map((c) => ({
          label: c.channel,
          name: c.channel,
          store: '',
          sales: c.amount,
          orders: c.orders,
          prevSales: prevByChan.get(c.channel) ?? 0,
        })),
        topError,
        topProducts: bestRows.map((r) => ({
          name: r.name || r.sku, sku: r.sku, qty: r.qty, amount: r.amount,
        })),
      })
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
      setRefreshed(new Date())
    }
  }, [])

  useEffect(() => { load(days) }, [load, days])


  const grouped = report ? groupDaily(report.daily, bucket) : []
  // ⚠️ แยก "ช่องทางมาร์เก็ตเพลส" กับ "คลัง/สาขา" ด้วยชื่อช่องทางจริง ไม่ใช่เดาจากลำดับ
  const MKT = /shopee|lazada|tiktok/i
  const POSCH = /pos|หน้าร้าน/i
  const chans = report?.channels ?? []
  const shown =
    tab === 'mkt' ? chans.filter((c) => MKT.test(c.name))
      : tab === 'branch' ? chans.filter((c) => POSCH.test(c.name))
        : chans
  const maxShown = Math.max(...shown.map((c) => c.sales), 1)

  return (
    <div className="p-4 md:p-6">
      {/* หัวจอแบบ ZORT: ชื่อจอ → บรรทัดช่วงเวลา → แท็บ (ภาพ 03-รายงานยอดขาย.jpg) */}
      <PageHead
        title="ยอดขาย"
        actions={
          <BtnGhost onClick={() => load(days)} disabled={loading}>
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </BtnGhost>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-[14px] font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer"
        >
          {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
        <span className="text-[12.5px] text-gray-400" suppressHydrationWarning>
          {report ? `${report.range.from} – ${report.range.to}` : ''} · อัพเดต {refreshed.toLocaleTimeString('th-TH')}
        </span>
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: 'ทั้งหมด' },
          { id: 'branch', label: 'ตามคลัง/สาขา' },
          { id: 'chan', label: 'ตามช่องทางการขาย' },
          { id: 'mkt', label: 'ตาม Marketplace' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {error && <ErrorBox title="ดึงข้อมูลจากคลังของเราไม่สำเร็จ">{error}</ErrorBox>}
      {loading && !report && <LoadingState />}

      {report && (
        <div className="space-y-4 mt-4">
          {tab === 'all' && (
            <>
              {/* สองการ์ดคู่กันแบบ ZORT: สรุปยอดขายรวม | รายงาน (กราฟ) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <p className="text-[15px] font-semibold text-gray-900 mb-2">สรุปยอดขายรวม</p>
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-[34px] font-semibold text-blue-600 leading-none">
                      {fmtMoney(report.totals.sales)}
                    </p>
                    <p className="text-[12.5px] text-gray-500 mt-2">
                      {fmtNum(report.totals.orders)} ใบ · เฉลี่ยใบละ {fmtMoney(report.totals.avg)} บาท
                    </p>
                    <button
                      onClick={() => downloadSummary(report)}
                      className="mt-5 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50"
                    >
                      Download Excel – สรุปยอดขาย
                    </button>
                  </div>
                </Card>

                <Card>
                  <p className="text-[15px] font-semibold text-gray-900 mb-2">รายงาน</p>
                  <TrendChart daily={grouped} />
                  {/* ปุ่มสลับช่วงมุมขวาล่างของการ์ด — ตำแหน่งเดียวกับ ZORT */}
                  <div className="flex justify-end gap-1 mt-2">
                    {BUCKETS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setBucket(b.id)}
                        className={`text-[12px] px-2.5 py-1 rounded ${
                          bucket === b.id ? 'text-blue-600 font-semibold underline' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* การ์ดยอดขายรายสินค้า — คอลัมน์ตามภาพ ZORT */}
              <Card padded={false}>
                <p className="text-[15px] font-semibold text-gray-900 px-4 md:px-5 pt-4">ยอดขาย</p>
                <TableWrap>
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-white border-b border-gray-200">
                      <tr>
                        <th className={TH}>รหัสสินค้า</th>
                        <th className={TH}>สินค้า</th>
                        <th className={THR}>จำนวน</th>
                        <th className={THR}>ยอดขาย(บาท)</th>
                        <th className={THR}>ยอดขาย (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!report.topProducts || report.topProducts.length === 0) && (
                        <EmptyState
                          cols={5}
                          icon={report.topError ? '⚠️' : '📊'}
                          title={report.topError ? 'ดึงยอดขายรายสินค้าไม่ได้' : 'ยังไม่มียอดขายรายสินค้าในช่วงนี้'}
                          detail={report.topError
                            ? `ตารางนี้ว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะขายไม่ได้ — ${report.topError}`
                            : 'ลองขยายช่วงเวลาด้านบน · ตัวเลขนับจากรายการสินค้าในใบขายจริง'} />
                      )}
                      {(report.topProducts ?? []).map((p) => {
                        const amount = typeof p.amount === 'number' ? p.amount : null
                        const share = amount !== null && report.totals.sales
                          ? (amount / report.totals.sales) * 100 : null
                        return (
                          <tr key={p.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className={`${TD} text-blue-600 whitespace-nowrap`}>{p.sku}</td>
                            <td className={TD}>
                              <Link href={`/core/stock/${encodeURIComponent(p.sku)}`} className="text-blue-600 hover:underline">
                                {p.name}
                              </Link>
                            </td>
                            <td className={TDR}>{fmtNum(p.qty)}</td>
                            {/* ⚠️ ไม่มียอดเงินจริงให้แสดงขีด ห้ามคูณ qty × ราคาขาย ซึ่งเป็นการเดา */}
                            <td className={TDR}>{amount !== null ? fmtMoney(amount) : <span className="text-gray-300">—</span>}</td>
                            <td className={TDR}>
                              {share !== null
                                ? <span className="text-[11.5px] font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">{share.toFixed(2)}%</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </Card>
            </>
          )}

          {tab !== 'all' && (
            <Card padded={false}>
              <p className="text-[15px] font-semibold text-gray-900 px-4 md:px-5 pt-4">
                {tab === 'branch' ? 'ยอดขายตามคลัง/สาขา' : tab === 'mkt' ? 'ยอดขายตาม Marketplace' : 'ยอดขายตามช่องทางการขาย'}
              </p>
              <TableWrap>
                <table className="w-full min-w-[620px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className={TH}>ช่องทาง</th>
                      <th className={THR}>จำนวนใบ</th>
                      <th className={THR}>ยอดขาย(บาท)</th>
                      <th className={THR}>เทียบช่วงก่อน</th>
                      <th className={TH} style={{ width: 160 }}>สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <EmptyState cols={5} icon="🏪" title="ยังไม่มียอดขายในกลุ่มนี้"
                        detail={tab === 'branch'
                          ? 'ยอดขายหน้าร้านจะขึ้นเมื่อเปิดบิลผ่านจอขายหน้าร้าน'
                          : 'ออเดอร์จากมาร์เก็ตเพลสจะเข้ามาในรอบซิงก์ถัดไป'} />
                    )}
                    {shown.map((c) => (
                      <tr key={c.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className={TD}><ChannelTag name={c.name} /></td>
                        <td className={TDR}>{fmtNum(c.orders)}</td>
                        <td className={TDR}>{fmtMoney(c.sales)}</td>
                        <td className={TDR}><PctBadge cur={c.sales} prev={c.prevSales} /></td>
                        <td className={TD}>
                          <span className="block h-2 rounded-full bg-gray-100 overflow-hidden">
                            <span className={`block h-full rounded-full ${chanColor(c.name)}`}
                              style={{ width: `${Math.max(2, (c.sales / maxShown) * 100)}%` }} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
