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
  // สถานะตามของคืน (สองขั้น: ขนส่งส่งถึง → ร้านรับ+ใครรับ) — เก็บฝั่งเซิร์ฟเวอร์
  const [recv, setRecv] = useState<Record<string, { delivered?: number; received?: number; by?: string }>>({})
  const [recvFilter, setRecvFilter] = useState<'' | 'waiting' | 'delivered' | 'received'>('')
  // ชื่อคนรับ — จำไว้ในเครื่อง กรอกครั้งเดียวพอ
  const [recvName, setRecvName] = useState('')

  // ── ชื่อ/เบอร์ผู้ซื้อตัวจริง (ถาม Shopee Open API ตอนกดปุ่ม) ──
  // เก็บในหน่วยความจำหน้าเท่านั้น ไม่ลง localStorage — เป็นข้อมูลส่วนบุคคลของลูกค้า
  // ⚠️ กดทีละใบโดยตั้งใจ ไม่ดึงล่วงหน้าทั้งหน้า — เปลืองโควตา Shopee และไม่มีเหตุให้ดูทุกใบ
  type Buyer = { loading?: boolean; err?: string; buyer?: string; name?: string; phone?: string; address?: string }
  const [buyer, setBuyer] = useState<Record<string, Buyer>>({})

  const openBuyer = useCallback(async (sn: string) => {
    setBuyer((b) => ({ ...b, [sn]: { loading: true } }))
    try {
      const r = await fetch(`/api/web/shopee/buyer?sn=${encodeURIComponent(sn)}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.error) throw new Error(j?.error || `Shopee ตอบ ${r.status}`)
      setBuyer((b) => ({ ...b, [sn]: { buyer: j.buyer, name: j.name, phone: j.phone, address: j.address } }))
    } catch (e) {
      setBuyer((b) => ({ ...b, [sn]: { err: e instanceof Error ? e.message : String(e) } }))
    }
  }, [])

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

  useEffect(() => {
    fetch('/api/returns/received')
      .then((r) => r.json())
      .then((j) => { if (j?.map) setRecv(j.map) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try { setRecvName(localStorage.getItem('gucut-recv-name') || '') } catch {}
  }, [])

  const markRecv = async (number: string, stage: 'delivered' | 'received' | 'clear') => {
    const by = stage === 'received' ? recvName.trim() : undefined
    // ปรับหน้าจอทันที ไม่รอเซิร์ฟเวอร์ — พลาดค่อยเด้งกลับตอนรีเฟรช
    setRecv((prev) => {
      const next = { ...prev }
      const cur = next[number] || {}
      if (stage === 'delivered') next[number] = { ...cur, delivered: Date.now() }
      else if (stage === 'received') next[number] = { delivered: cur.delivered || Date.now(), received: Date.now(), by }
      else delete next[number]
      return next
    })
    if (stage === 'received') { try { localStorage.setItem('gucut-recv-name', recvName.trim()) } catch {} }
    await fetch('/api/returns/received', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number, stage, by }),
    }).catch(() => {})
  }

  // ขนส่งรับไปแล้วเกิน 7 วันแต่ของยังไม่ถึง = ต้องทวงขนส่ง/แพลตฟอร์ม
  const daysSince = (d: string) => d ? Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400_000) : -1
  const flashUrl = (no: string, carrier: string) =>
    /flash/i.test(carrier) ? `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(no)}` : ''

  if (!data && busy) return <LoadingState text="กำลังดึงใบคืนของจาก ZORT..." />

  const channels = data ? Object.entries(data.byChannel).sort((a, b) => b[1].orders - a[1].orders) : []
  const low = q.trim().toLowerCase()

  const skus = (data?.skus || [])
    .filter((s) => !ch || s.byChannel[ch])
    .filter((s) => !low || s.sku.toLowerCase().includes(low) || s.name.toLowerCase().includes(low))
    .slice(0, 100)

  const preList = (data?.list || [])
    .filter((o) => !ch || o.channel === ch)
    .filter((o) => !low || o.number.toLowerCase().includes(low) || o.customer.toLowerCase().includes(low)
      || o.lines.some((l) => l.sku.toLowerCase().includes(low)))
  const nRecv = preList.filter((o) => recv[o.number]?.received).length
  const nDeliv = preList.filter((o) => recv[o.number]?.delivered && !recv[o.number]?.received).length
  const nWait = preList.length - nRecv - nDeliv

  const list = (data?.list || [])
    .filter((o) => !ch || o.channel === ch)
    .filter((o) => {
      if (!recvFilter) return true
      const st = recv[o.number]
      if (recvFilter === 'received') return !!st?.received
      if (recvFilter === 'delivered') return !!st?.delivered && !st?.received
      return !st?.delivered && !st?.received
    })
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
            {tab === 'list' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  ['', `ทั้งหมด ${preList.length}`, 'bg-gray-100 text-gray-600'],
                  ['waiting', `🟡 ยังไม่ได้รับ ${nWait}`, 'bg-amber-100 text-amber-800'],
                  ['delivered', `🔵 ถึงแล้วรอตรวจ ${nDeliv}`, 'bg-blue-100 text-blue-800'],
                  ['received', `🟢 รับแล้ว ${nRecv}`, 'bg-emerald-100 text-emerald-800'],
                ] as const).map(([v, lb, tone]) => (
                  <button key={v} onClick={() => setRecvFilter(v)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${recvFilter === v ? 'bg-gray-900 text-white' : tone}`}>
                    {lb}
                  </button>
                ))}
                <input value={recvName} onChange={(e) => setRecvName(e.target.value)}
                  placeholder="ชื่อคนรับของ"
                  className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-500" />
              </div>
            )}
          </div>

          {tab === 'list' && preList.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-900">ภาพรวมการตามของ</h2>
              {/* แถบสัดส่วน: มองแวบเดียวรู้ว่ารับครบหรือยัง */}
              <div className="mt-3 flex h-5 w-full overflow-hidden rounded-full bg-gray-100">
                {nRecv > 0 && <div className="bg-emerald-500" style={{ width: `${(nRecv / preList.length) * 100}%` }} />}
                {nDeliv > 0 && <div className="bg-blue-500" style={{ width: `${(nDeliv / preList.length) * 100}%` }} />}
                {nWait > 0 && <div className="bg-amber-400" style={{ width: `${(nWait / preList.length) * 100}%` }} />}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />รับแล้ว <b className="tabular-nums">{nRecv}</b></span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />ถึงแล้วรอตรวจ <b className="tabular-nums">{nDeliv}</b></span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />ยังไม่ได้รับ <b className="tabular-nums">{nWait}</b></span>
                <span className="ml-auto text-gray-400">รวม {preList.length} ใบ</span>
              </div>

              {/* เทียบรายเดือน: ใบคืนเดือนไหนเยอะผิดปกติเห็นทันที */}
              {Object.keys(data.byMonth).length > 1 && (() => {
                const months = Object.entries(data.byMonth).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12)
                const max = Math.max(...months.map(([, n]) => n))
                return (
                  <div className="mt-4 border-t pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">ใบคืนรายเดือน (เทียบ {months.length} เดือน)</p>
                    <div className="mt-2 flex h-24 items-end gap-1.5">
                      {months.map(([m, n]) => (
                        <div key={m} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold tabular-nums text-gray-600">{n}</span>
                          <div className={`w-full rounded-t ${n === max ? 'bg-red-400' : 'bg-blue-300'}`}
                            style={{ height: `${Math.max(6, (n / max) * 64)}px` }} />
                          <span className="truncate text-[9.5px] text-gray-400">{m.slice(2).replace('-', '/')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </Card>
          )}

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
                const st = recv[o.number] || {}
                const age = daysSince(o.shipDate || o.date)
                const overdue = !st.delivered && !st.received && age > 7 && boxes > 0
                const fmtD = (t?: number) => t ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''
                // สีทั้งใบบอกสถานะ — มองปราดเดียวรู้ว่าใบไหนของถึงมือแล้ว ใบไหนยังลอยอยู่
                const tone = st.received
                  ? 'border-l-emerald-500 bg-emerald-50/70 border-emerald-200/70'
                  : st.delivered
                  ? 'border-l-blue-500 bg-blue-50/70 border-blue-200/70'
                  : overdue
                  ? 'border-l-red-500 bg-red-50/70 border-red-200/70'
                  : 'border-l-amber-400 bg-amber-50/60 border-amber-200/60'
                const bigChip = st.received
                  ? ['✓ รับแล้ว', 'bg-emerald-600']
                  : st.delivered
                  ? ['ถึงแล้ว·รอตรวจ', 'bg-blue-600']
                  : overdue
                  ? ['ค้างนาน!', 'bg-red-600']
                  : ['ยังไม่ได้รับ', 'bg-amber-500']
                const bx = o.ref ? buyer[o.ref] : undefined   // ชื่อ/เบอร์ตัวจริงที่กดเปิดไว้แล้ว
                return (
                <div key={o.number} className={`rounded-2xl border border-l-4 p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${tone}`}>
                  <span className={`float-right ml-2 rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${bigChip[1]}`}>{bigChip[0]}</span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-gray-900">{o.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CH_COLOR[o.channel] || 'bg-gray-100 text-gray-700'}`}>
                      {o.channel}
                    </span>
                    <span className="text-xs text-gray-500">{o.date}</span>
                  </div>
                  {o.ref && <p className="mt-0.5 text-xs text-gray-400">ออเดอร์เดิม #{o.ref}</p>}

                  {/* ตามของสองขั้น: ขนส่งส่งถึง → ร้านตรวจรับ (จดว่าใครรับ) — กดเอง Flash ไม่เปิด API */}
                  <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${st.received ? 'bg-emerald-50' : st.delivered ? 'bg-blue-50' : overdue ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <span className={`font-semibold ${st.received ? 'text-emerald-700' : st.delivered ? 'text-blue-700' : overdue ? 'text-red-700' : 'text-amber-700'}`}>
                      {st.received
                        ? `✓ ร้านรับแล้ว${st.by ? ` · ${st.by} รับ` : ''}${st.received ? ` · ${fmtD(st.received)}` : ''}`
                        : st.delivered
                        ? `📦 ขนส่งส่งถึงแล้ว ${fmtD(st.delivered)} · รอตรวจรับ`
                        : overdue
                        ? `⚠️ เกิน ${age} วันของยังไม่ถึงร้าน — เช็คพัสดุ/ทวงขนส่ง`
                        : boxes > 0 ? `รอของ · ขนส่งรับไปแล้ว ${age >= 0 ? age + ' วัน' : ''}` : 'รอของ · ยังไม่มีเลขพัสดุ'}
                    </span>
                    <span className="ml-auto flex gap-1.5">
                      {!st.delivered && !st.received && (
                        <button onClick={() => void markRecv(o.number, 'delivered')}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">ขนส่งส่งถึงแล้ว</button>
                      )}
                      {!st.received && (
                        <button onClick={() => void markRecv(o.number, 'received')}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">ร้านรับแล้ว</button>
                      )}
                      {(st.delivered || st.received) && (
                        <button onClick={() => void markRecv(o.number, 'clear')}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-400">ล้าง</button>
                      )}
                    </span>
                  </div>

                  {/* ใครส่งคืน มาจากไหน — ค่าที่มาทาง ZORT ถูก Shopee เซ็นเซอร์มาแล้ว
                      ปุ่ม "เปิดตัวจริง" ยิงถาม Shopee Open API ทีละใบ (ต้องเชื่อมร้านก่อน) */}
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    {o.customer && <p><span className="text-gray-400">ลูกค้า </span><span className="font-medium text-gray-800">{o.customer}</span>
                      {o.phone && <span className="text-gray-600"> · โทร {o.phone}</span>}
                      {o.channel === 'Shopee' && o.ref && !bx && (
                        <button onClick={() => void openBuyer(o.ref)}
                          className="ml-1.5 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">เปิดตัวจริง</button>
                      )}
                      {bx?.loading && <span className="ml-1.5 text-gray-400">กำลังถาม Shopee…</span>}
                      {bx?.err && <span className="ml-1.5 text-red-600">{bx.err}</span>}
                    </p>}
                    {bx && !bx.loading && !bx.err && (
                      <p className="sm:col-span-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
                        <span className="text-gray-400">ตัวจริงจาก Shopee </span>
                        <span className="font-medium text-gray-900">{bx.name || bx.buyer || '—'}</span>
                        {bx.phone && <> · <a href={`tel:${bx.phone}`} className="font-semibold text-blue-600">{bx.phone}</a></>}
                        {bx.address && <span className="text-gray-600"> · {bx.address}</span>}
                      </p>
                    )}
                    {(o.address || o.province) && <p><span className="text-gray-400">ส่งจาก </span><span className="text-gray-700">{o.address || o.province}</span></p>}
                    {(o.tracking || boxes > 0) && (
                      <p>
                        <span className="text-gray-400">พัสดุ </span>
                        <span className="font-medium tabular-nums text-gray-800">{boxes} กล่อง</span>
                        {o.carrier && <span className="text-gray-700"> · {o.carrier}</span>}
                        {o.shipDate && <span className="text-gray-500"> · ขนส่งรับ {o.shipDate}</span>}
                      </p>
                    )}
                    {(o.trackings?.length ? o.trackings : o.tracking ? [{ no: o.tracking, carrier: o.carrier, date: '' }] : []).map((t) => {
                      const fl = flashUrl(t.no, t.carrier || o.carrier)
                      return (
                      <p key={t.no} className="font-mono text-[11.5px] text-gray-700">
                        {t.no}
                        <button onClick={() => void navigator.clipboard?.writeText(t.no).catch(() => {})}
                          className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 font-sans text-[10px] text-gray-500 active:bg-gray-200">คัดลอก</button>
                        {fl && <a href={fl} target="_blank" rel="noreferrer"
                          className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-blue-600">เช็คสถานะ</a>}
                      </p>
                      )
                    })}
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
                </div>
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
