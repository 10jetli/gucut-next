'use client'
// ยอดขายทุกช่องทาง — Shopee / Lazada / TikTok / GUCUT.com / POS ทั้ง 2 สาขา (รวมจาก ZORT 2 ร้าน)
// รีเฟรชด้วยปุ่มเท่านั้น ไม่มี auto-refresh (กติกาเจ้าของร้าน: หน้าที่ยิง API ภายนอกต้องกดเอง)
import { useEffect, useState, useCallback } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Report {
  range: { from: string; to: string; days: number }
  totals: { sales: number; orders: number; avg: number; prevSales: number; prevOrders: number }
  daily: { date: string; sales: number; orders: number }[]
  channels: { label: string; name: string; store: string; sales: number; orders: number; prevSales: number }[]
  topProducts: { name: string; sku: string; qty: number; amount: number }[] | null
}

const PERIODS = [
  { days: 1, label: 'วันนี้' },
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
]

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

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sales-report?days=${d}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setReport(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
      setRefreshed(new Date())
    }
  }, [])

  useEffect(() => { load(days) }, [load, days])

  const maxChanSales = Math.max(...(report?.channels.map((c) => c.sales) ?? [0]), 1)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">ยอดขายทุกช่องทาง</h1>
          <span className="text-[11px] text-gray-400" suppressHydrationWarning>
            Shopee · Lazada · TikTok · GUCUT.com · หน้าร้าน 2 สาขา — อัพเดต {refreshed.toLocaleTimeString('th-TH')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                  days === p.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="text-[12px] md:text-[13px] font-semibold text-blue-600 bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm flex items-center gap-1.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <span className={loading ? 'spinner inline-block' : ''}>🔄</span> รีเฟรช
          </button>
        </div>
      </div>

      {error && <ErrorBox title="ดึงข้อมูลจาก ZORT ไม่สำเร็จ">{error}</ErrorBox>}
      {loading && !report && <LoadingState />}

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon="💰" tone="green" label={`ยอดขาย (${days === 1 ? 'วันนี้' : `${days} วัน`})`}
              value={fmtBaht(report.totals.sales)}
              note={`ช่วงก่อนหน้า ${fmtBaht(report.totals.prevSales)} · ${pct(report.totals.sales, report.totals.prevSales).text}`}
              noteTone={report.totals.sales >= report.totals.prevSales ? 'green' : 'red'}
            />
            <StatCard
              icon="📦" tone="blue" label="คำสั่งซื้อ"
              value={fmtNum(report.totals.orders)} unit="orders"
              note={`ช่วงก่อนหน้า ${fmtNum(report.totals.prevOrders)} · ${pct(report.totals.orders, report.totals.prevOrders).text}`}
              noteTone={report.totals.orders >= report.totals.prevOrders ? 'green' : 'red'}
            />
            <StatCard icon="🧾" tone="purple" label="เฉลี่ยต่อออเดอร์" value={fmtBaht(report.totals.avg)} />
            <StatCard icon="🛒" tone="orange" label="ช่องทางที่มียอด" value={report.channels.length} unit="ช่องทาง" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* อันดับช่องทาง */}
            <Card className="xl:col-span-2">
              <p className="text-[13px] font-semibold text-gray-700 mb-3">🏪 อันดับช่องทางการขาย</p>
              {report.channels.length === 0 && <p className="text-[13px] text-gray-400">ไม่มียอดขายในช่วงนี้</p>}
              <div className="space-y-3">
                {report.channels.map((c, i) => (
                  <div key={`${c.name}|${c.store}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                        <span className="text-[13px] font-semibold text-gray-800 truncate">{c.label}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{fmtNum(c.orders)} ออเดอร์</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[13px] font-bold text-gray-900">{fmtBaht(c.sales)}</span>
                        <PctBadge cur={c.sales} prev={c.prevSales} />
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${chanColor(c.name)}`}
                        style={{ width: `${Math.max((c.sales / maxChanSales) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* กราฟแนวโน้ม */}
            <Card className="xl:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-gray-700">📈 แนวโน้มรายวัน</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80 inline-block" /> ยอดขาย</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> ออเดอร์</span>
                </div>
              </div>
              {days === 1 ? (
                <p className="text-[13px] text-gray-400">โหมด &quot;วันนี้&quot; ไม่มีกราฟรายวัน — เลือก 7 หรือ 30 วันเพื่อดูแนวโน้ม</p>
              ) : (
                <TrendChart daily={report.daily} />
              )}
            </Card>
          </div>

          {/* สินค้าขายดี */}
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b border-gray-100">
              <p className="text-[13px] font-semibold text-gray-700">🏆 สินค้าขายดี ({days === 1 ? 'วันนี้' : `${days} วันล่าสุด`})</p>
            </div>
            {report.topProducts === null ? (
              <p className="text-[13px] text-gray-400 p-4 md:p-5">
                ZORT ไม่ส่งรายการสินค้ามากับข้อมูลออเดอร์รวม — ส่วนนี้จะแสดงเมื่อข้อมูลพร้อม
              </p>
            ) : report.topProducts.length === 0 ? (
              <p className="text-[13px] text-gray-400 p-4 md:p-5">ไม่มีข้อมูลสินค้าในช่วงนี้</p>
            ) : (
              report.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 px-4 md:px-5 py-2.5 border-b border-gray-50 last:border-0">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    i < 3 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{p.name}</p>
                    {p.sku && <p className="text-[11px] text-gray-400">{p.sku}</p>}
                  </div>
                  <span className="text-[12px] text-gray-500 shrink-0">×{fmtNum(p.qty)}</span>
                  <span className="text-[13px] font-bold text-gray-900 w-24 text-right shrink-0">{fmtBaht(p.amount)}</span>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}
