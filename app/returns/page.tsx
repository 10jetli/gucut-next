'use client'
// สินค้าที่ลูกค้าคืน — รวมทุกช่องทาง (Shopee · Lazada · TikTok · หน้าร้าน)
//
// ออเดอร์ทุกช่องทางวิ่งมารวมที่ ZORT อยู่แล้ว ใบคืนของก็เหมือนกัน
// หน้านี้จึงดูที่เดียวเห็นครบ ไม่ต้องไล่เปิดหลังร้านทีละเจ้า
//
// ⚠️ หัวใจของหน้านี้คือแท็บ "สินค้าที่ถูกคืนบ่อย" ไม่ใช่รายการใบคืน
//    ยอดคืนรวมบอกแค่ว่าเจ็บเท่าไหร่ แต่บอกไม่ได้ว่าต้องไปแก้อะไร
import { useCallback, useEffect, useState } from 'react'
import type { ReturnsResult } from '@/lib/returns'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'

const baht = (n: number) => '฿' + Math.round(n).toLocaleString('th-TH')

const CH_COLOR: Record<string, string> = {
  Shopee: 'bg-orange-100 text-orange-700',
  Lazada: 'bg-blue-100 text-blue-700',
  Tiktok: 'bg-gray-900 text-white',
  Shopify: 'bg-emerald-100 text-emerald-700',
  GUCUT: 'bg-red-100 text-red-700',
}

export default function ReturnsPage() {
  const [data, setData] = useState<(ReturnsResult & { cached?: boolean; stale?: boolean }) | null>(null)
  const [tab, setTab] = useState<'sku' | 'list'>('sku')
  const [days, setDays] = useState(30)
  const [ch, setCh] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (d: number, refresh = false) => {
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/returns?days=${d}${refresh ? '&refresh=1' : ''}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'ดึงข้อมูลไม่สำเร็จ')
      setData(j)
    } catch (e) {
      setErr(String((e as Error)?.message || e))
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void load(days) }, [days, load])

  if (!data && busy) return <LoadingState text="กำลังดึงใบคืนของจาก ZORT..." />

  const channels = data ? Object.entries(data.byChannel).sort((a, b) => b[1].orders - a[1].orders) : []
  const low = q.trim().toLowerCase()

  const skus = (data?.skus || [])
    .filter((s) => !ch || s.byChannel[ch])
    .filter((s) => !low || s.sku.toLowerCase().includes(low) || s.name.toLowerCase().includes(low))
    .slice(0, 100)

  const list = (data?.list || [])
    .filter((o) => !ch || o.channel === ch)
    .filter((o) => !low || o.number.toLowerCase().includes(low) || o.customer.toLowerCase().includes(low)
      || o.lines.some((l) => l.sku.toLowerCase().includes(low)))
    .slice(0, 100)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">สินค้าที่ลูกค้าคืน</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            รวมทุกช่องทางจาก ZORT — Shopee · Lazada · TikTok · หน้าร้าน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value={1}>เมื่อวาน</option>
            <option value={3}>3 วัน</option>
            <option value={7}>7 วัน</option>
            <option value={15}>15 วัน</option>
            <option value={30}>30 วัน</option>
            <option value={90}>90 วัน</option>
            <option value={365}>1 ปี</option>
            <option value={1095}>3 ปี</option>
          </select>
          <button
            onClick={() => void load(days, true)}
            disabled={busy}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'กำลังดึง...' : 'ดึงใหม่'}
          </button>
        </div>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}
      {data?.stale && (
        <ErrorBox>ดึงข้อมูลใหม่ไม่สำเร็จ — กำลังแสดงตัวเลขที่ดึงไว้ครั้งก่อน</ErrorBox>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon="↩️" label="ใบคืนของ" value={data.total} />
            <StatCard icon="💸" label="มูลค่าที่คืน" value={baht(data.amount)} tone="red" />
            <StatCard icon="📦" label="สินค้าที่ถูกคืน" value={`${data.skus.length} รายการ`} />
          </div>

          {/* แยกตามช่องทาง — กดเพื่อกรอง */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900">แยกตามช่องทาง</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setCh('')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${!ch ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                ทั้งหมด
              </button>
              {channels.map(([name, v]) => (
                <button
                  key={name}
                  onClick={() => setCh(ch === name ? '' : name)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    ch === name ? 'bg-gray-900 text-white' : CH_COLOR[name] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {name} · {v.orders} ใบ · {baht(v.amount)}
                </button>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {(['sku', 'list'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {t === 'sku' ? 'สินค้าที่ถูกคืนบ่อย' : 'รายการใบคืน'}
              </button>
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา SKU · ชื่อสินค้า · เลขใบคืน"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {tab === 'sku' ? (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="py-2 pr-2 font-medium">สินค้า</th>
                      <th className="py-2 pr-2 text-right font-medium">คืนกี่ชิ้น</th>
                      <th className="py-2 pr-2 text-right font-medium">กี่ใบ</th>
                      <th className="py-2 text-right font-medium">มูลค่า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((s) => (
                      <tr key={s.sku} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-gray-900">{s.name || s.sku}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {s.sku}
                            {Object.entries(s.byChannel).map(([c, n]) => (
                              <span key={c} className="ml-1.5">{c} {n}</span>
                            ))}
                          </p>
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold tabular-nums text-red-600">{s.qty}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-gray-600">{s.orders}</td>
                        <td className="py-2 text-right tabular-nums text-gray-900">{baht(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {skus.length === 0 && <p className="py-6 text-center text-sm text-gray-500">ไม่พบข้อมูล</p>}
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                💡 ตัวที่ถูกคืนซ้ำ ๆ มักมีสาเหตุจริง — รูปไม่ตรงของ · สเปกกำกวม · ใส่ไม่ได้กับรุ่นที่ลูกค้ามี ·
                ของเสียบ่อย เช็คหน้าสินค้าตัวนั้นก่อนสั่งของเข้ามาเพิ่ม
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {list.map((o) => {
                const boxes = o.trackings?.length ? o.trackings.length : o.tracking ? 1 : 0
                return (
                <Card key={o.number}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-gray-900">{o.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CH_COLOR[o.channel] || 'bg-gray-100 text-gray-700'}`}>
                      {o.channel}
                    </span>
                    <span className="text-xs text-gray-500">{o.date}</span>
                  </div>
                  {o.ref && <p className="mt-0.5 text-xs text-gray-400">ออเดอร์เดิม #{o.ref}</p>}

                  {/* ใครส่งคืน มาจากไหน — Shopee เซ็นเซอร์ชื่อ/เบอร์/บ้านเลขที่มาเอง เห็นได้สุดแค่นี้ */}
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    {o.customer && <p><span className="text-gray-400">ลูกค้า </span><span className="font-medium text-gray-800">{o.customer}</span>
                      {o.phone && <span className="text-gray-600"> · โทร {o.phone}</span>}</p>}
                    {(o.address || o.province) && <p><span className="text-gray-400">ส่งจาก </span><span className="text-gray-700">{o.address || o.province}</span></p>}
                    {(o.tracking || boxes > 0) && (
                      <p>
                        <span className="text-gray-400">พัสดุ </span>
                        <span className="font-medium tabular-nums text-gray-800">{boxes} กล่อง</span>
                        {o.carrier && <span className="text-gray-700"> · {o.carrier}</span>}
                        {o.shipDate && <span className="text-gray-500"> · ขนส่งรับ {o.shipDate}</span>}
                      </p>
                    )}
                    {(o.trackings?.length ? o.trackings : o.tracking ? [{ no: o.tracking, carrier: '', date: '' }] : []).map((t) => (
                      <p key={t.no} className="font-mono text-[11.5px] text-gray-700">
                        {t.no}
                        <button onClick={() => void navigator.clipboard?.writeText(t.no).catch(() => {})}
                          className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 font-sans text-[10px] text-gray-500 active:bg-gray-200">คัดลอก</button>
                      </p>
                    ))}
                    {o.warehouse && <p><span className="text-gray-400">คลังรับคืน </span><span className="text-gray-700">{o.warehouse}</span></p>}
                    {o.paymentStatus && <p><span className="text-gray-400">เงินคืน </span><span className={o.paymentStatus === 'Paid' ? 'font-medium text-emerald-700' : 'text-gray-700'}>{o.paymentStatus === 'Paid' ? 'คืนแล้ว' : o.paymentStatus}</span></p>}
                    {o.note && <p className="sm:col-span-2"><span className="text-gray-400">หมายเหตุ </span><span className="text-gray-700">{o.note}</span></p>}
                  </div>

                  <ul className="mt-2 space-y-0.5 border-t pt-2">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="min-w-0 flex-1 text-gray-800">{l.name}<span className="ml-1.5 text-[11px] text-gray-400">{l.sku}</span></span>
                        <span className="shrink-0 tabular-nums text-gray-400">×{l.qty}</span>
                        <span className="shrink-0 tabular-nums text-gray-600">{baht(l.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-end gap-x-3 border-t pt-1.5 text-xs text-gray-500">
                    {typeof o.qty === 'number' && o.qty > 0 && <span>รวม {o.qty} ชิ้น</span>}
                    {o.shipping > 0 && <span>ค่าส่ง {baht(o.shipping)}</span>}
                    {o.platformDiscount > 0 && <span>ส่วนลดแพลตฟอร์ม {baht(o.platformDiscount)}</span>}
                    <span className="text-sm font-semibold text-gray-900">คืนเงิน {baht(o.amount)}</span>
                  </div>
                </Card>
                )
              })}
              {list.length === 0 && (
                <Card><p className="py-6 text-center text-sm text-gray-500">ไม่พบข้อมูล</p></Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
