'use client'
// ออเดอร์เว็บ (gucut.com) — ฉบับเนทีฟในหลังร้านหลัก
//
// หน้าแรกของงาน "รวมหลังร้านเป็นเนื้อเดียวแท้ ๆ" (เจ้าของร้านสั่ง 28 ส.ค. 2569
// "อยากจะเอามารวมกัน เอา admin.gucut.com เป็นหลัก จัด UI ให้สวยงามแบบ ZORT")
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

const STATUS: { key: Status; t: string; chip: string; dot: string }[] = [
  { key: 'pending',   t: 'รอชำระ',   chip: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
  { key: 'new',       t: 'ใหม่',      chip: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  { key: 'confirmed', t: 'รับแล้ว',   chip: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
  { key: 'shipped',   t: 'ส่งแล้ว',   chip: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
  { key: 'done',      t: 'สำเร็จ',    chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'cancelled', t: 'ยกเลิก',    chip: 'bg-red-50 text-red-500',          dot: 'bg-red-400' },
]
const chipOf = (s: Status) => STATUS.find((x) => x.key === s) ?? STATUS[1]
// เดินหน้าทีละขั้น — ปุ่มถัดไปที่สมเหตุสมผลต่อสถานะปัจจุบัน
const NEXT: Partial<Record<Status, { to: Status; t: string }[]>> = {
  pending:   [{ to: 'cancelled', t: 'ยกเลิก' }],
  new:       [{ to: 'confirmed', t: 'รับออเดอร์' }, { to: 'cancelled', t: 'ยกเลิก' }],
  confirmed: [{ to: 'shipped', t: 'ส่งของแล้ว' }, { to: 'cancelled', t: 'ยกเลิก' }],
  shipped:   [{ to: 'done', t: 'จบงาน' }],
}

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const baht = (n: number) => '฿' + Number(n || 0).toLocaleString('th-TH')

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
      setUpdated(new Date().toLocaleTimeString('th-TH'))
    } catch {
      setErr('โหลดรายการไม่สำเร็จ — ลองกดรีเฟรช')
      setOrders((o) => o ?? [])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const o of orders ?? []) c[o.status] = (c[o.status] || 0) + 1
    return c
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-800">ออเดอร์เว็บ gucut.com</h1>
          <p className="text-xs text-gray-400 mt-0.5">{updated ? `อัปเดต ${updated}` : 'กำลังโหลด…'}</p>
        </div>
        <button onClick={load}
          className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50">
          ⟳ รีเฟรช
        </button>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* สรุปยอดตามสถานะ — กดเพื่อกรองได้ */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        <button onClick={() => setFilter('all')}
          className={`rounded-xl px-3 py-2.5 text-left shadow-sm border ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
          <p className="text-[11px] opacity-70">ทั้งหมด</p>
          <p className="text-lg font-black leading-tight">{orders?.length ?? '—'}</p>
        </button>
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`rounded-xl px-3 py-2.5 text-left shadow-sm border ${filter === s.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
            <p className="text-[11px] opacity-70">{s.t}</p>
            <p className="text-lg font-black leading-tight">{counts[s.key] || 0}</p>
          </button>
        ))}
      </div>

      {/* ตารางออเดอร์ */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {orders === null ? (
          <p className="p-8 text-center text-sm text-gray-400">กำลังโหลด…</p>
        ) : shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">ไม่มีออเดอร์ในหมวดนี้</p>
        ) : shown.map((o) => {
          const c = chipOf(o.status)
          const open = openId === o.id
          return (
            <div key={o.id} className="border-b border-gray-100 last:border-0">
              <button onClick={() => openRow(o)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50">
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {o.customer?.name || '-'}
                    <span className="ml-2 font-normal text-gray-400 text-xs">#{o.id}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtWhen(o.at)} · {o.items.length} รายการ · {o.paymentLabel}
                    {o.paidAt ? ' · จ่ายแล้ว ✓' : ''}
                    {o.tracking?.no ? ` · ${o.tracking.no}` : ''}
                  </p>
                </div>
                <p className="text-sm font-black text-gray-800 shrink-0">{baht(o.total)}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.chip}`}>{c.t}</span>
                {o.zort && !o.zort.ok && !o.zort.skipped && (
                  <span className="shrink-0 text-amber-500 text-xs" title="ส่งเข้า ZORT ไม่สำเร็จ">⚠️</span>
                )}
              </button>

              {open && (
                <div className="px-4 pb-4 bg-gray-50/60">
                  <div className="grid md:grid-cols-2 gap-3 pt-3">
                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <p className="text-xs font-bold text-gray-400 mb-1.5">รายการสินค้า</p>
                      {o.items.map((i, n) => (
                        <p key={n} className="text-[13px] text-gray-700 flex justify-between gap-2 py-0.5">
                          <span className="truncate">{i.title}{i.variant && i.variant !== '-' ? ` (${i.variant})` : ''} ×{i.qty}</span>
                          <span className="shrink-0">{baht(i.price * i.qty)}</span>
                        </p>
                      ))}
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-[13px] text-gray-500 space-y-0.5">
                        {o.discount > 0 && <p className="flex justify-between"><span>ส่วนลด</span><span>-{baht(o.discount)}</span></p>}
                        <p className="flex justify-between"><span>ค่าส่ง</span><span>{baht(o.shipping)}</span></p>
                        <p className="flex justify-between font-black text-gray-800"><span>รวม</span><span>{baht(o.total)}</span></p>
                        {o.priceAdjusted && <p className="text-amber-600">🏷️ ราคาบางตัวถูกปรับตามคลัง ZORT</p>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white border border-gray-200 p-3">
                      <p className="text-xs font-bold text-gray-400 mb-1.5">ผู้รับ</p>
                      <p className="text-[13px] font-bold text-gray-800">{o.customer?.name}
                        <a href={`tel:${o.customer?.phone}`} className="ml-2 font-normal text-blue-600">{o.customer?.phone}</a>
                      </p>
                      <p className="text-[13px] text-gray-600 mt-0.5">{o.customer?.address} {o.customer?.province} {o.customer?.zip}</p>
                      {o.customer?.note && <p className="text-[13px] text-amber-700 mt-1">📝 {o.customer.note}</p>}
                      {o.taxInvoice && (
                        <p className="text-[12px] text-gray-500 mt-1.5">🧾 ใบกำกับภาษี: {o.taxInvoice.name} · {o.taxInvoice.taxId}</p>
                      )}
                      {o.tracking?.no && (
                        <p className="text-[13px] mt-1.5">🚚 {o.tracking.channel || 'ขนส่ง'}{' '}
                          <a target="_blank" rel="noreferrer" className="text-blue-600 font-semibold"
                             href={`https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(o.tracking.no)}`}>
                            {o.tracking.no}
                          </a>
                        </p>
                      )}
                      {o.hasSlip && (
                        <div className="mt-2">
                          <p className="text-xs font-bold text-gray-400 mb-1">สลิปโอนเงิน</p>
                          {slips[o.id] === undefined ? (
                            <p className="text-xs text-gray-400">กำลังโหลดสลิป…</p>
                          ) : slips[o.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={slips[o.id] as string} alt="สลิป" className="max-h-56 rounded-lg border border-gray-200" />
                          ) : (
                            <p className="text-xs text-gray-400">เปิดสลิปไม่ได้</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-3">
                    {(NEXT[o.status] ?? []).map((b) => (
                      <button key={b.to} disabled={busyId === o.id}
                        onClick={() => patch(o, { status: b.to })}
                        className={`rounded-lg px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50 ${b.to === 'cancelled' ? 'bg-white border border-red-200 text-red-500' : 'bg-blue-600 text-white'}`}>
                        {busyId === o.id ? 'กำลังบันทึก…' : b.t}
                      </button>
                    ))}
                    {o.zort && !o.zort.ok && !o.zort.skipped && (
                      <button disabled={busyId === o.id} onClick={() => patch(o, { action: 'zort' })}
                        className="rounded-lg bg-white border border-amber-300 px-4 py-2 text-sm font-bold text-amber-600 shadow-sm disabled:opacity-50">
                        ส่งเข้า ZORT ซ้ำ
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        ข้อมูลชุดเดียวกับ gucut.com/admin/orders/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง
      </p>
    </div>
  )
}
