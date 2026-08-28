'use client'
// ออเดอร์เว็บ (gucut.com) — ฉบับเนทีฟในหลังร้านหลัก
//
// งาน "รวมหลังร้านเป็นเนื้อเดียวแท้ ๆ · UI สวยแบบ ZORT" (เจ้าของร้านสั่ง 28 ส.ค. 2569
// รอบสอง: "ดีมาก แต่ขอสวยกว่านี้" — ยกเครื่องด้วย UI kit กลางของระบบทั้งชุด)
// ข้อมูลวิ่งผ่านท่อ /api/web/orders → gucut.com (รหัสอยู่ฝั่งเซิร์ฟเวอร์)
// หน้าเดิมที่ gucut.com/admin/orders/ ยังอยู่ครบ — สำรองกันและกัน
import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import PillButton from '@/components/ui/PillButton'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

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

const STATUS: { key: Status; t: string; chip: string; dot: string; avatar: string }[] = [
  { key: 'pending',   t: 'รอชำระ', chip: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300',    avatar: 'from-gray-300 to-gray-400' },
  { key: 'new',       t: 'ใหม่',    chip: 'bg-orange-50 text-orange-600',    dot: 'bg-orange-500',  avatar: 'from-orange-400 to-red-400' },
  { key: 'confirmed', t: 'รับแล้ว', chip: 'bg-blue-50 text-blue-600',        dot: 'bg-blue-500',    avatar: 'from-blue-400 to-blue-600' },
  { key: 'shipped',   t: 'ส่งแล้ว', chip: 'bg-indigo-50 text-indigo-600',    dot: 'bg-indigo-500',  avatar: 'from-indigo-400 to-purple-500' },
  { key: 'done',      t: 'สำเร็จ',  chip: 'bg-emerald-50 text-emerald-600',  dot: 'bg-emerald-500', avatar: 'from-emerald-400 to-teal-500' },
  { key: 'cancelled', t: 'ยกเลิก',  chip: 'bg-red-50 text-red-400',          dot: 'bg-red-300',     avatar: 'from-gray-200 to-gray-300' },
]
const S_OF = Object.fromEntries(STATUS.map((s) => [s.key, s])) as Record<Status, (typeof STATUS)[number]>
const NEXT: Partial<Record<Status, { to: Status; t: string; icon: string }[]>> = {
  pending:   [{ to: 'cancelled', t: 'ยกเลิกออเดอร์', icon: '✕' }],
  new:       [{ to: 'confirmed', t: 'รับออเดอร์', icon: '✓' }, { to: 'cancelled', t: 'ยกเลิก', icon: '✕' }],
  confirmed: [{ to: 'shipped', t: 'ส่งของแล้ว', icon: '🚚' }, { to: 'cancelled', t: 'ยกเลิก', icon: '✕' }],
  shipped:   [{ to: 'done', t: 'จบงาน', icon: '🎉' }],
}

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const baht = (n: number) => '฿' + Number(n || 0).toLocaleString('th-TH')
const isToday = (ms: number) => new Date(ms).toDateString() === new Date().toDateString()

export default function WebOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [openId, setOpenId] = useState('')
  const [slips, setSlips] = useState<Record<string, string | null>>({})
  const [busyId, setBusyId] = useState('')
  const [updated, setUpdated] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try {
      const r = await fetch('/api/web/orders')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setOrders(Array.isArray(d.orders) ? d.orders : [])
      setUpdated(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      setErr('โหลดรายการไม่สำเร็จ — ลองกดรีเฟรช')
      setOrders((o) => o ?? [])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const stat = useMemo(() => {
    const list = orders ?? []
    const counts: Record<string, number> = {}
    let paidRevenue = 0
    let pendingValue = 0
    let today = 0
    for (const o of list) {
      counts[o.status] = (counts[o.status] || 0) + 1
      if (o.paidAt || ['confirmed', 'shipped', 'done'].includes(o.status)) paidRevenue += o.total
      if (o.status === 'pending') pendingValue += o.total
      if (isToday(o.at)) today++
    }
    return { counts, paidRevenue, pendingValue, today }
  }, [orders])

  const shown = useMemo(
    () => (orders ?? []).filter((o) => filter === 'all' || o.status === filter),
    [orders, filter],
  )

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

  return (
    <div className="space-y-5">
      {/* ── หัวหน้า ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900">ออเดอร์เว็บ</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            gucut.com {updated && <>· อัปเดต {updated}</>}
          </p>
        </div>
        <button onClick={load}
          className="text-[12px] md:text-[13px] font-semibold text-blue-600 bg-white md:border md:border-gray-200 md:rounded-xl md:px-3.5 md:py-2 md:shadow-sm flex items-center gap-1.5 hover:bg-blue-50 transition-colors">
          <span className="text-[15px]">⟳</span> รีเฟรช
        </button>
      </div>

      {err && <ErrorBox title="มีปัญหา">{err}</ErrorBox>}

      {/* ── Stat cards แบบหน้าแรก ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="📦" tone="blue" label="ออเดอร์วันนี้" value={orders ? stat.today : '—'} unit="orders" />
        <StatCard icon="💰" tone="green" label="ยอดที่จ่ายแล้ว (ทั้งหมด)" value={baht(stat.paidRevenue)} />
        <StatCard icon="⏳" tone="orange" label="รอชำระ" value={stat.counts.pending || 0} unit="ใบ"
          note={stat.pendingValue > 0 ? `ค้างอยู่ ${baht(stat.pendingValue)}` : undefined} noteTone="orange" />
        <StatCard icon="🚚" tone="purple" label="กำลังจัดส่ง" value={stat.counts.shipped || 0} unit="ใบ"
          note={stat.counts.done ? `สำเร็จแล้ว ${stat.counts.done} ใบ` : undefined} noteTone="green" />
      </div>

      {/* ── ตารางออเดอร์ ── */}
      <Card padded={false}>
        <div className="px-4 md:px-5 pt-4 pb-3 flex flex-wrap items-center gap-2 border-b border-gray-100">
          <PillButton active={filter === 'all'} onClick={() => setFilter('all')}>
            ทั้งหมด {orders ? `(${orders.length})` : ''}
          </PillButton>
          {STATUS.map((s) => (
            <PillButton key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
              {s.t}{stat.counts[s.key] ? ` (${stat.counts[s.key]})` : ''}
            </PillButton>
          ))}
        </div>

        {orders === null ? (
          <LoadingState />
        ) : shown.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-2">🗂️</p>
            <p className="text-sm text-gray-400">ไม่มีออเดอร์ในหมวดนี้</p>
          </div>
        ) : (
          <div>
            {/* หัวตาราง (จอใหญ่) */}
            <div className="hidden md:grid grid-cols-[1fr_130px_110px_110px_150px] items-center px-5 py-2 text-[11px] font-bold text-gray-400 border-b border-gray-50">
              <span>ลูกค้า / ออเดอร์</span>
              <span>วันที่</span>
              <span className="text-right">ยอดรวม</span>
              <span className="text-center">ชำระ</span>
              <span className="text-right">สถานะ</span>
            </div>
            {shown.map((o) => {
              const c = S_OF[o.status] ?? STATUS[1]
              const open = openId === o.id
              const paid = !!o.paidAt || ['confirmed', 'shipped', 'done'].includes(o.status)
              return (
                <div key={o.id} className={`border-b border-gray-50 last:border-0 transition-colors ${open ? 'bg-blue-50/30' : ''}`}>
                  <button onClick={() => openRow(o)}
                    className="w-full px-4 md:px-5 py-3 md:grid md:grid-cols-[1fr_130px_110px_110px_150px] md:items-center flex flex-wrap items-center gap-2 text-left hover:bg-gray-50/80 transition-colors">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${c.avatar} text-white text-sm font-black flex items-center justify-center shrink-0 shadow-sm`}>
                        {(o.customer?.name || '?').trim().charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold text-gray-800 truncate">{o.customer?.name || '-'}</span>
                        <span className="block text-[11px] text-gray-400 truncate">
                          #{o.id} · {o.items.length} รายการ
                          {o.zort && !o.zort.ok && !o.zort.skipped && <span className="text-amber-500"> · ⚠️ ZORT</span>}
                          {o.priceAdjusted && <span className="text-amber-500"> · 🏷️</span>}
                        </span>
                      </span>
                    </span>
                    <span className="text-[12px] text-gray-500 max-md:order-3">{fmtWhen(o.at)}</span>
                    <span className="text-[13.5px] font-black text-gray-900 md:text-right tabular-nums max-md:ml-auto">{baht(o.total)}</span>
                    <span className="md:text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${paid ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {paid ? '● จ่ายแล้ว' : '○ ยังไม่จ่าย'}
                      </span>
                    </span>
                    <span className="md:text-right">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {c.t}
                      </span>
                    </span>
                  </button>

                  {open && (
                    <div className="px-4 md:px-5 pb-5">
                      <div className="grid md:grid-cols-3 gap-3">
                        {/* สินค้า */}
                        <Card className="!shadow-none border-gray-100" padded>
                          <p className="text-[11px] font-bold text-gray-400 mb-2">🧾 รายการสินค้า</p>
                          {o.items.map((i, n) => (
                            <p key={n} className="text-[13px] text-gray-700 flex justify-between gap-2 py-0.5">
                              <span className="truncate">{i.title}{i.variant && i.variant !== '-' ? ` (${i.variant})` : ''} ×{i.qty}</span>
                              <span className="shrink-0 tabular-nums">{baht(i.price * i.qty)}</span>
                            </p>
                          ))}
                          <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-[12.5px] text-gray-500 space-y-1">
                            {o.discount > 0 && <p className="flex justify-between"><span>ส่วนลด</span><span className="text-emerald-600">-{baht(o.discount)}</span></p>}
                            <p className="flex justify-between"><span>ค่าส่ง</span><span>{baht(o.shipping)}</span></p>
                            <p className="flex justify-between text-[14px] font-black text-gray-900"><span>รวมทั้งสิ้น</span><span className="tabular-nums">{baht(o.total)}</span></p>
                            <p className="text-gray-400">{o.paymentLabel}{o.priceAdjusted ? ' · 🏷️ ราคาปรับตาม ZORT' : ''}</p>
                          </div>
                        </Card>

                        {/* ผู้รับ */}
                        <Card className="!shadow-none border-gray-100" padded>
                          <p className="text-[11px] font-bold text-gray-400 mb-2">📍 ผู้รับ</p>
                          <p className="text-[13.5px] font-bold text-gray-800">{o.customer?.name}</p>
                          <a href={`tel:${o.customer?.phone}`}
                             className="inline-flex items-center gap-1.5 mt-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[12.5px] font-semibold text-blue-600">
                            📞 {o.customer?.phone}
                          </a>
                          <p className="text-[12.5px] text-gray-600 mt-2 leading-relaxed">{o.customer?.address} {o.customer?.province} {o.customer?.zip}</p>
                          {o.customer?.note && <p className="text-[12.5px] text-amber-700 mt-1.5 bg-amber-50 rounded-lg px-2 py-1">📝 {o.customer.note}</p>}
                          {o.taxInvoice && (
                            <p className="text-[11.5px] text-gray-500 mt-2">🧾 ใบกำกับภาษี: {o.taxInvoice.name} · {o.taxInvoice.taxId}</p>
                          )}
                        </Card>

                        {/* เส้นทางออเดอร์ + สลิป */}
                        <Card className="!shadow-none border-gray-100" padded>
                          <p className="text-[11px] font-bold text-gray-400 mb-2">🕘 เส้นทางออเดอร์</p>
                          <ol className="relative border-l-2 border-gray-100 ml-1.5 space-y-2.5 text-[12.5px]">
                            <li className="pl-3">
                              <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                              <span className="text-gray-700 font-semibold">สั่งซื้อ</span>
                              <span className="text-gray-400 ml-1.5">{fmtWhen(o.at)}</span>
                            </li>
                            {paid && (
                              <li className="pl-3">
                                <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                                <span className="text-gray-700 font-semibold">ชำระเงิน</span>
                                {o.paidAt && <span className="text-gray-400 ml-1.5">{fmtWhen(o.paidAt)}</span>}
                              </li>
                            )}
                            {o.tracking?.no && (
                              <li className="pl-3">
                                <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                                <span className="text-gray-700 font-semibold">จัดส่ง</span>{' '}
                                <a target="_blank" rel="noreferrer" className="text-blue-600 font-semibold"
                                   href={`https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(o.tracking.no)}`}>
                                  {o.tracking.no}
                                </a>
                              </li>
                            )}
                            {o.status === 'done' && (
                              <li className="pl-3">
                                <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                                <span className="text-gray-700 font-semibold">สำเร็จ 🎉</span>
                              </li>
                            )}
                          </ol>
                          {o.hasSlip && (
                            <div className="mt-3">
                              <p className="text-[11px] font-bold text-gray-400 mb-1.5">สลิปโอนเงิน</p>
                              {slips[o.id] === undefined ? (
                                <p className="text-[12px] text-gray-400">กำลังโหลดสลิป…</p>
                              ) : slips[o.id] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={slips[o.id] as string} alt="สลิป" className="max-h-52 rounded-xl border border-gray-200 shadow-sm" />
                              ) : (
                                <p className="text-[12px] text-gray-400">เปิดสลิปไม่ได้</p>
                              )}
                            </div>
                          )}
                        </Card>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3.5">
                        {(NEXT[o.status] ?? []).map((b) => (
                          <button key={b.to} disabled={busyId === o.id}
                            onClick={() => patch(o, { status: b.to })}
                            className={`rounded-xl px-4 py-2 text-[13px] font-bold shadow-sm transition-all disabled:opacity-50 ${
                              b.to === 'cancelled'
                                ? 'bg-white border border-red-200 text-red-500 hover:bg-red-50'
                                : 'bg-blue-600 text-white shadow-[0_6px_14px_-6px_rgba(37,99,235,0.7)] hover:bg-blue-700'
                            }`}>
                            {busyId === o.id ? 'กำลังบันทึก…' : `${b.icon} ${b.t}`}
                          </button>
                        ))}
                        {o.zort && !o.zort.ok && !o.zort.skipped && (
                          <button disabled={busyId === o.id} onClick={() => patch(o, { action: 'zort' })}
                            className="rounded-xl bg-white border border-amber-300 px-4 py-2 text-[13px] font-bold text-amber-600 shadow-sm hover:bg-amber-50 disabled:opacity-50">
                            ↻ ส่งเข้า ZORT ซ้ำ
                          </button>
                        )}
                        {o.zort?.ok && <span className="text-[12px] text-emerald-600 font-semibold">✓ เข้า ZORT แล้ว</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <p className="text-center text-[11px] text-gray-300">
        ข้อมูลชุดเดียวกับ gucut.com/admin/orders/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง
      </p>
    </div>
  )
}
