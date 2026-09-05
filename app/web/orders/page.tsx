'use client'
// ออเดอร์เว็บ (gucut.com) — ฉบับเนทีฟในหลังร้านหลัก
//
// เจ้าของร้านสั่งยกระดับสามรอบ: "รวมเป็นเนื้อเดียวแท้ ๆ" → "สวยแบบ ZORT"
// → "แบบเว็บระดับชั้นนำของโลก" (28 ส.ค. 2569)
// มาตรฐานที่ยึด: Stripe/Shopify Admin — ไอคอนเส้น SVG (ไม่ใช้อีโมจิ) ·
// ตัวเลขแนวบัญชี tabular-nums · skeleton แบบ shimmer · แถวขยายแบบลื่น ·
// กราฟรายได้ 7 วันวาดเอง (ไม่พึ่งไลบรารีกราฟ) · ลำดับชั้นตัวอักษรเข้มงวด
//
// ข้อมูลวิ่งผ่านท่อ /api/web/orders → gucut.com (รหัสอยู่ฝั่งเซิร์ฟเวอร์)
// หน้าเดิมที่ gucut.com/admin/orders/ ยังอยู่ครบ — สำรองกันและกัน
import { useCallback, useEffect, useMemo, useState } from 'react'

type Status = 'pending' | 'new' | 'confirmed' | 'shipped' | 'done' | 'cancelled'
interface OrderItem { title: string; variant: string; price: number; qty: number }
interface Order {
  id: string
  at: number
  status: Status
  customer: { name: string; phone: string; address: string; province: string; zip: string; note: string }
  items: OrderItem[]
  paymentLabel: string
  discount: number
  subtotal: number
  shipping: number
  codFee: number
  total: number
  taxInvoice: { name: string; taxId: string; address: string } | null
  hasSlip: boolean
  paidAt?: number
  tracking?: { no: string; channel: string; at: string } | null
  zort?: { ok: boolean; skipped?: boolean; message?: string }
  priceAdjusted?: boolean
}

/* ── ไอคอนเส้นแบบ Lucide — วาดเองไม่พึ่งไลบรารี ── */
function I({ d, className = 'w-4 h-4', sw = 1.8 }: { d: string; className?: string; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  )
}
const IC = {
  bag: 'M6 7h12l1 13H5L6 7zM9 7a3 3 0 016 0',
  coins: 'M12 3a7 4 0 100 8 7 4 0 000-8zM5 7v5c0 2.2 3.1 4 7 4s7-1.8 7-4V7M5 12v5c0 2.2 3.1 4 7 4s7-1.8 7-4v-5',
  clock: 'M12 3a9 9 0 109 9 9 9 0 00-9-9zM12 7v5l3 2',
  truck: 'M2 6h12v10H2zM14 9h4l3 3v4h-7zM6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6',
  search: 'M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4.2-4.2',
  refresh: 'M20 11a8 8 0 10.9 4.5M20 4v6h-6',
  chevron: 'M9 6l6 6-6 6',
  phone: 'M5 4h4l1.5 4L8 10a12 12 0 006 6l2-2.5 4 1.5v4c0 1-1 2-2 2A17 17 0 013 6c0-1 1-2 2-2z',
  doc: 'M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5',
  pin: 'M12 21s-6.5-5.7-6.5-10.5a6.5 6.5 0 0113 0C18.5 15.3 12 21 12 21zM12 12.5a2 2 0 100-4 2 2 0 000 4z',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  party: 'M6 15l-3 6 6-3M8 9l7 7M5 12a7 7 0 0110-7M13 3l1 2M19 5l-1.5 1.5M21 11l-2 1',
  alert: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5',
  external: 'M14 5h5v5M19 5l-8 8M9 5H5v14h14v-4',
}

const STATUS: { key: Status; t: string; chip: string; dot: string; grad: string }[] = [
  { key: 'pending',   t: 'รอชำระ', chip: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-300',    grad: 'from-gray-300 to-gray-400' },
  { key: 'new',       t: 'ใหม่',    chip: 'bg-orange-50 text-orange-600',   dot: 'bg-orange-500',  grad: 'from-orange-400 to-rose-400' },
  { key: 'confirmed', t: 'รับแล้ว', chip: 'bg-blue-50 text-blue-600',       dot: 'bg-blue-500',    grad: 'from-sky-400 to-blue-600' },
  { key: 'shipped',   t: 'ส่งแล้ว', chip: 'bg-violet-50 text-violet-600',   dot: 'bg-violet-500',  grad: 'from-indigo-400 to-violet-500' },
  { key: 'done',      t: 'สำเร็จ',  chip: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500', grad: 'from-emerald-400 to-teal-500' },
  { key: 'cancelled', t: 'ยกเลิก',  chip: 'bg-red-50 text-red-400',         dot: 'bg-red-300',     grad: 'from-gray-200 to-gray-300' },
]
const S_OF = Object.fromEntries(STATUS.map((s) => [s.key, s])) as Record<Status, (typeof STATUS)[number]>
const NEXT: Partial<Record<Status, { to: Status; t: string; icon: string }[]>> = {
  pending:   [{ to: 'cancelled', t: 'ยกเลิกออเดอร์', icon: IC.x }],
  new:       [{ to: 'confirmed', t: 'รับออเดอร์', icon: IC.check }, { to: 'cancelled', t: 'ยกเลิก', icon: IC.x }],
  confirmed: [{ to: 'shipped', t: 'ส่งของแล้ว', icon: IC.truck }, { to: 'cancelled', t: 'ยกเลิก', icon: IC.x }],
  shipped:   [{ to: 'done', t: 'จบงาน', icon: IC.party }],
}

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const baht = (n: number) => '฿' + Number(n || 0).toLocaleString('th-TH')
const dayKey = (ms: number) => new Date(ms).toLocaleDateString('sv-SE')

/* ── การ์ดสถิติ ── */
function Stat({ icon, tone, label, value, sub, subTone = 'text-gray-400' }: {
  icon: string; tone: string; label: string; value: React.ReactNode; sub?: React.ReactNode; subTone?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_18px_32px_-16px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
          <I d={icon} className="w-[17px] h-[17px]" />
        </span>
      </div>
      <p className="text-[26px] md:text-[30px] font-black text-gray-900 mt-1 tracking-tight tabular-nums leading-none">{value}</p>
      {sub && <p className={`text-[12px] mt-1.5 font-medium ${subTone}`}>{sub}</p>}
    </div>
  )
}

/* ── skeleton แถวแบบ shimmer — มาตรฐานเว็บชั้นนำ ไม่ใช้วงหมุน ── */
function SkeletonRows() {
  return (
    <div className="divide-y divide-gray-50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="w-9 h-9 rounded-full bg-gray-100" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-40 max-w-[50%] rounded bg-gray-100" />
            <span className="block h-2.5 w-56 max-w-[70%] rounded bg-gray-50" />
          </span>
          <span className="h-3 w-16 rounded bg-gray-100" />
          <span className="h-5 w-16 rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

export default function WebOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState('')
  const [slips, setSlips] = useState<Record<string, string | null>>({})
  const [busyId, setBusyId] = useState('')
  const [spin, setSpin] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    setSpin(true)
    try {
      const r = await fetch('/api/web/orders')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setOrders(Array.isArray(d.orders) ? d.orders : [])
    } catch {
      setErr('โหลดรายการไม่สำเร็จ — ลองกดรีเฟรช')
      setOrders((o) => o ?? [])
    } finally {
      setSpin(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const stat = useMemo(() => {
    const list = orders ?? []
    const counts: Record<string, number> = {}
    let paidRevenue = 0, pendingValue = 0, today = 0
    // รายได้รายวัน 7 วันล่าสุด + 7 วันก่อนหน้า (นับเฉพาะที่จ่ายแล้ว) — ใช้วาดกราฟ+เทียบแนวโน้ม
    const byDay = new Map<string, number>()
    let last7 = 0, prev7 = 0
    const now = Date.now()
    const todayKey = dayKey(now)
    for (const o of list) {
      counts[o.status] = (counts[o.status] || 0) + 1
      const paid = !!o.paidAt || ['confirmed', 'shipped', 'done'].includes(o.status)
      if (paid) {
        paidRevenue += o.total
        const age = (now - o.at) / 86400000
        if (age < 7) { last7 += o.total; byDay.set(dayKey(o.at), (byDay.get(dayKey(o.at)) || 0) + o.total) }
        else if (age < 14) prev7 += o.total
      }
      if (o.status === 'pending') pendingValue += o.total
      if (dayKey(o.at) === todayKey) today++
    }
    const days: { k: string; v: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(now - i * 86400000)
      days.push({ k, v: byDay.get(k) || 0 })
    }
    const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null
    return { counts, paidRevenue, pendingValue, today, days, last7, trend }
  }, [orders])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (orders ?? []).filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!needle) return true
      return (
        String(o.id ?? '').toLowerCase().includes(needle) ||
        (o.customer?.name || '').toLowerCase().includes(needle) ||
        (o.customer?.phone || '').includes(needle)
      )
    })
  }, [orders, filter, q])

  async function openRow(o: Order) {
    const next = openId === o.id ? '' : o.id
    setOpenId(next)
    if (next && o.hasSlip && slips[o.id] === undefined) {
      try {
        const r = await fetch(`/api/web/orders?id=${encodeURIComponent(o.id)}`)
        const d = await r.json()
        setSlips((m) => ({ ...m, [o.id]: d.slip ?? null }))
      } catch {
        setSlips((m) => ({ ...m, [o.id]: null }))
      }
    }
  }

  async function patch(o: Order, body: Record<string, string>) {
    if (busyId) return
    setBusyId(o.id)
    setErr('')
    try {
      const r = await fetch('/api/web/orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: o.id, ...body }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error()
      if (d?.order) setOrders((l) => (l ?? []).map((x) => (x.id === o.id ? d.order : x)))
      else if (body.status) setOrders((l) => (l ?? []).map((x) => (x.id === o.id ? { ...x, status: body.status as Status } : x)))
    } catch {
      setErr('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId('')
    }
  }

  const maxDay = Math.max(1, ...stat.days.map((d) => d.v))

  return (
    <div className="space-y-5">
      {/* ── หัวหน้า ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">ออเดอร์เว็บ</h1>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><I d={IC.search} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา ชื่อ · เบอร์ · เลขออเดอร์"
            className="w-[220px] md:w-[260px] rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-[13px] shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-blue-600">
          <I d={IC.refresh} className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} /> รีเฟรช
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          <I d={IC.alert} className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* ── แถวสถิติ + กราฟ ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={IC.bag} tone="bg-blue-50 text-blue-600" label="ออเดอร์วันนี้"
          value={orders ? stat.today : '—'} sub={`ทั้งหมด ${orders?.length ?? '—'} ใบในระบบ`} />
        <div className="bg-white rounded-2xl border border-gray-100/80 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">รายได้ 7 วัน</p>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
              <I d={IC.coins} className="w-[17px] h-[17px]" />
            </span>
          </div>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div>
              <p className="text-[26px] md:text-[30px] font-black text-gray-900 tracking-tight tabular-nums leading-none">{baht(stat.last7)}</p>
              {stat.trend !== null && (
                <p className={`text-[12px] mt-1.5 font-semibold ${stat.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.trend >= 0 ? '▲' : '▼'} {Math.abs(stat.trend)}% เทียบ 7 วันก่อน
                </p>
              )}
            </div>
            {/* กราฟแท่งจิ๋ว 7 วัน — วาดเอง */}
            <div className="flex items-end gap-[3px] h-12 pb-0.5">
              {stat.days.map((d, i) => (
                <span key={d.k} title={`${d.k} · ${baht(d.v)}`}
                  className={`w-[9px] rounded-full transition-all duration-500 ${i === 6 ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                  style={{ height: `${Math.max(10, (d.v / maxDay) * 100)}%` }} />
              ))}
            </div>
          </div>
        </div>
        <Stat icon={IC.clock} tone="bg-amber-50 text-amber-600" label="รอชำระ"
          value={stat.counts.pending || 0}
          sub={stat.pendingValue > 0 ? `มูลค่าค้าง ${baht(stat.pendingValue)}` : 'ไม่มียอดค้าง'}
          subTone={stat.pendingValue > 0 ? 'text-amber-600' : 'text-gray-400'} />
        <Stat icon={IC.truck} tone="bg-violet-50 text-violet-600" label="กำลังจัดส่ง"
          value={stat.counts.shipped || 0}
          sub={`สำเร็จแล้ว ${stat.counts.done || 0} ใบ`} subTone="text-emerald-600" />
      </div>

      {/* ── ตาราง ── */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        <div className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-1.5 border-b border-gray-100">
          {(['all', ...STATUS.map((s) => s.key)] as const).map((k) => {
            const active = filter === k
            const label = k === 'all' ? 'ทั้งหมด' : S_OF[k as Status].t
            const n = k === 'all' ? orders?.length : stat.counts[k]
            return (
              <button key={k} onClick={() => setFilter(k as 'all' | Status)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                  active ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {label}{typeof n === 'number' && n > 0 ? <span className={`ml-1 ${active ? 'text-white/60' : 'text-gray-400'}`}>{n}</span> : null}
              </button>
            )
          })}
        </div>

        <div className="hidden md:grid grid-cols-[1fr_120px_110px_100px_140px_28px] items-center px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-300 border-b border-gray-50 sticky top-0 bg-white/90 backdrop-blur z-10">
          <span>ลูกค้า / ออเดอร์</span><span>วันที่</span><span className="text-right">ยอดรวม</span>
          <span className="text-center">ชำระ</span><span className="text-right">สถานะ</span><span />
        </div>

        {orders === null ? (
          <SkeletonRows />
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3"><I d={IC.bag} className="w-6 h-6" /></span>
            <p className="text-[13px] text-gray-400">{q ? `ไม่พบออเดอร์ที่ตรงกับ "${q}"` : 'ไม่มีออเดอร์ในหมวดนี้'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {shown.map((o) => {
              const c = S_OF[o.status] ?? STATUS[1]
              const open = openId === o.id
              const paid = !!o.paidAt || ['confirmed', 'shipped', 'done'].includes(o.status)
              return (
                <div key={o.id} className={`transition-colors ${open ? 'bg-blue-50/40' : ''}`}>
                  <button onClick={() => openRow(o)}
                    className="group w-full px-4 md:px-5 py-3 md:grid md:grid-cols-[1fr_120px_110px_100px_140px_28px] md:items-center flex flex-wrap items-center gap-2 text-left transition-colors hover:bg-gray-50/70">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${c.grad} text-white text-[13px] font-black flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white`}>
                        {(o.customer?.name || '?').trim().charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold text-gray-900 truncate">{o.customer?.name || '-'}</span>
                        <span className="block text-[11px] text-gray-400 truncate tabular-nums">
                          #{o.id} · {o.items.length} รายการ
                          {o.zort && !o.zort.ok && !o.zort.skipped && <span className="text-amber-500"> · ZORT ⚠</span>}
                        </span>
                      </span>
                    </span>
                    <span className="text-[12px] text-gray-500 tabular-nums max-md:order-3">{fmtWhen(o.at)}</span>
                    <span className="text-[13.5px] font-black text-gray-900 md:text-right tabular-nums max-md:ml-auto">{baht(o.total)}</span>
                    <span className="md:text-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${paid ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${paid ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}
                      </span>
                    </span>
                    <span className="md:text-right">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.t}
                      </span>
                    </span>
                    <span className={`hidden md:flex justify-end text-gray-300 transition-transform duration-200 ${open ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}>
                      <I d={IC.chevron} className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  {/* รายละเอียด — ขยายแบบลื่นด้วย grid-rows trick */}
                  <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="px-4 md:px-5 pb-5">
                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="rounded-xl border border-gray-100 bg-white p-4">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5"><I d={IC.doc} className="w-3.5 h-3.5" /> รายการสินค้า</p>
                            {o.items.map((i, n) => (
                              <p key={n} className="text-[13px] text-gray-700 flex justify-between gap-2 py-0.5">
                                <span className="truncate">{i.title}{i.variant && i.variant !== '-' ? ` (${i.variant})` : ''} ×{i.qty}</span>
                                <span className="shrink-0 tabular-nums">{baht(i.price * i.qty)}</span>
                              </p>
                            ))}
                            <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200 text-[12.5px] text-gray-500 space-y-1">
                              {o.discount > 0 && <p className="flex justify-between"><span>ส่วนลด</span><span className="text-emerald-600 tabular-nums">-{baht(o.discount)}</span></p>}
                              <p className="flex justify-between"><span>ค่าส่ง</span><span className="tabular-nums">{baht(o.shipping)}</span></p>
                              <p className="flex justify-between text-[14.5px] font-black text-gray-900"><span>รวมทั้งสิ้น</span><span className="tabular-nums">{baht(o.total)}</span></p>
                              <p className="text-gray-400">{o.paymentLabel}{o.priceAdjusted ? ' · ราคาปรับตามคลัง ZORT' : ''}</p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-100 bg-white p-4">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5"><I d={IC.pin} className="w-3.5 h-3.5" /> ผู้รับ</p>
                            <p className="text-[13.5px] font-bold text-gray-900">{o.customer?.name}</p>
                            <a href={`tel:${o.customer?.phone}`}
                               className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-blue-600 transition-colors hover:bg-blue-100">
                              <I d={IC.phone} className="w-3.5 h-3.5" /> {o.customer?.phone}
                            </a>
                            <p className="text-[12.5px] text-gray-600 mt-2.5 leading-relaxed">{o.customer?.address} {o.customer?.province} {o.customer?.zip}</p>
                            {o.customer?.note && <p className="text-[12.5px] text-amber-700 mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5">{o.customer.note}</p>}
                            {o.taxInvoice && <p className="text-[11.5px] text-gray-500 mt-2">ใบกำกับภาษี: {o.taxInvoice.name} · {o.taxInvoice.taxId}</p>}
                          </div>

                          <div className="rounded-xl border border-gray-100 bg-white p-4">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5"><I d={IC.clock} className="w-3.5 h-3.5" /> เส้นทางออเดอร์</p>
                            <ol className="relative border-l-2 border-gray-100 ml-1.5 space-y-3 text-[12.5px]">
                              <li className="pl-3.5 relative">
                                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                                <span className="text-gray-800 font-semibold">สั่งซื้อ</span>
                                <span className="text-gray-400 ml-1.5 tabular-nums">{fmtWhen(o.at)}</span>
                              </li>
                              {paid && (
                                <li className="pl-3.5 relative">
                                  <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                  <span className="text-gray-800 font-semibold">ชำระเงิน</span>
                                  {o.paidAt && <span className="text-gray-400 ml-1.5 tabular-nums">{fmtWhen(o.paidAt)}</span>}
                                </li>
                              )}
                              {o.tracking?.no && (
                                <li className="pl-3.5 relative">
                                  <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                                  <span className="text-gray-800 font-semibold">จัดส่ง</span>{' '}
                                  <a target="_blank" rel="noreferrer"
                                     className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                                     href={`https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(o.tracking.no)}`}>
                                    {o.tracking.no} <I d={IC.external} className="w-3 h-3" />
                                  </a>
                                </li>
                              )}
                              {o.status === 'done' && (
                                <li className="pl-3.5 relative">
                                  <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                  <span className="text-gray-800 font-semibold">สำเร็จ</span>
                                </li>
                              )}
                            </ol>
                            {o.hasSlip && (
                              <div className="mt-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">สลิปโอนเงิน</p>
                                {slips[o.id] === undefined ? (
                                  <div className="h-32 w-24 rounded-xl bg-gray-50 animate-pulse" />
                                ) : slips[o.id] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={slips[o.id] as string} alt="สลิป" className="max-h-52 rounded-xl border border-gray-200 shadow-sm" />
                                ) : (
                                  <p className="text-[12px] text-gray-400">เปิดสลิปไม่ได้</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-4">
                          {(NEXT[o.status] ?? []).map((b) => (
                            <button key={b.to} disabled={busyId === o.id}
                              onClick={() => patch(o, { status: b.to })}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold transition-all disabled:opacity-50 ${
                                b.to === 'cancelled'
                                  ? 'bg-white border border-red-200 text-red-500 hover:bg-red-50'
                                  : 'bg-gray-900 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]'
                              }`}>
                              <I d={b.icon} className="w-3.5 h-3.5" />
                              {busyId === o.id ? 'กำลังบันทึก…' : b.t}
                            </button>
                          ))}
                          {o.zort && !o.zort.ok && !o.zort.skipped && (
                            <button disabled={busyId === o.id} onClick={() => patch(o, { action: 'zort' })}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-amber-300 px-4 py-2 text-[13px] font-bold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50">
                              <I d={IC.send} className="w-3.5 h-3.5" /> ส่งเข้า ZORT ซ้ำ
                            </button>
                          )}
                          {o.zort?.ok && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 font-semibold">
                              <I d={IC.check} className="w-3.5 h-3.5" /> เข้า ZORT แล้ว
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-gray-300">
        ข้อมูลชุดเดียวกับ gucut.com/admin/orders/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง
      </p>
    </div>
  )
}
