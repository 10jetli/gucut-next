'use client'
// รายงาน → ยอดซื้อ — **ลอกจาก `zort-ui/56-zort-รายงาน-ยอดซื้อ.jpg`**
// ผัง: ชื่อจอ "ยอดซื้อ" → บรรทัดช่วงเวลา + ค้นหาขั้นสูง
//      → การ์ดคู่: "สรุปยอดซื้อ" (ตัวเลขใหญ่ / ไม่มียอดซื้อ + Download Excel) | "รายงาน" (กราฟ)
//      → การ์ด "ยอดซื้อ" รายสินค้า: รหัสสินค้า · สินค้า · จำนวน · ยอดซื้อ (บาท) · ยอดซื้อ (%)
//
// ✅ **ตารางรายสินค้าเติมได้แล้ว** (`list=purchaseitems` · 3 ก.ย. 2569) — 217 รหัส · 234 บรรทัด
//    ⚠️ **แต่ท่อนี้ยังไม่รับช่วงวันที่** ⇒ ตารางรายสินค้าเป็น "ทุกช่วงเวลา" ไม่ใช่ช่วงที่เลือกด้านบน
//       ต้องเขียนกำกับให้ชัด ไม่งั้นคนอ่านจะนึกว่ามันขยับตามตัวกรอง แล้วสรุปตัวเลขผิด
//
// ⚠️ **"ไม่มียอดซื้อในช่วงนี้" ≠ "ร้านไม่เคยซื้อของ"**
//    ZORT เองก็ขึ้น "ไม่มียอดซื้อ" ในช่วง 3 เดือนล่าสุด เพราะใบซื้อทั้ง 32 ใบเก่ากว่านั้น
//    ถ้าจอเงียบ ๆ ว่าง คนอ่านจะสรุปผิดทันที ⇒ ต้องบอกว่ามีกี่ใบและใบล่าสุดเมื่อไหร่
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate, thaiShort } from '@/components/zort'

interface Po { number: string; vendor?: string; po_date?: string; amount?: number; status?: string }
interface Resp { total?: number; amount?: number; rows?: Po[] }
interface ItemRow { sku: string; name?: string; qty?: number; amount?: number; orders?: number; lastDate?: string }
interface ItemsResp { skus?: number; lines?: number; amount?: number; rows?: ItemRow[] }

type Grain = 'day' | 'month' | 'quarter' | 'year'
const GRAINS: { id: Grain; label: string }[] = [
  { id: 'day', label: 'วัน' },
  { id: 'month', label: 'เดือน' },
  { id: 'quarter', label: 'ไตรมาส' },
  { id: 'year', label: 'ปี' },
]

function isoAgo(months: number) {
  const t = new Date()
  t.setMonth(t.getMonth() - months)
  return t.toISOString().slice(0, 10)
}
function todayIso() { return new Date().toISOString().slice(0, 10) }

/** ป้ายแกนนอนตามความละเอียดที่เลือก — ต้องเรียงตามเวลาจริง ไม่ใช่เรียงตามตัวอักษร */
function bucketOf(iso: string, g: Grain) {
  const [y, m, d] = iso.split('-')
  if (g === 'year') return { key: y, label: `${Number(y) + 543}` }
  if (g === 'quarter') {
    const q = Math.floor((Number(m) - 1) / 3) + 1
    return { key: `${y}-Q${q}`, label: `Q${q}/${Number(y) + 543}` }
  }
  if (g === 'month') {
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return { key: `${y}-${m}`, label: `${TH[Number(m) - 1]}/${Number(y) + 543}` }
  }
  return { key: `${y}-${m}-${d}`, label: `${Number(d)}/${Number(m)}` }
}

/** กราฟเส้นแบบ ZORT — เส้นเดียว จุดกลม เส้นแนวนอนจาง ๆ · SVG ล้วน ไม่พึ่งไลบรารี */
function BuyChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 640, H = 210, L = 54, R = 10, T = 12, B = 34
  const max = Math.max(...points.map((p) => p.value), 0)
  // ⚠️ ทุกจุดเป็นศูนย์ต้องยังวาดเส้นฐานให้เห็น — กราฟเปล่าดูเหมือนกราฟพัง
  const top = max > 0 ? max : 40
  const ticks = 4
  const x = (i: number) => points.length <= 1 ? L : L + ((W - L - R) * i) / (points.length - 1)
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="กราฟยอดซื้อ">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (top / ticks) * i
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-gray-200" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {v >= 1000 ? `${Math.round(v / 1000)}K` : Math.round(v)}
            </text>
          </g>
        )
      })}
      <path d={line} fill="none" strokeWidth={2} className="stroke-[#7c9cf0]" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={p.label} cx={x(i)} cy={y(p.value)} r={3.5} className="fill-[#5b7fe0]" />)}
      {points.map((p, i) => (
        <text key={`t-${p.label}`} x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-500 text-[10px]">{p.label}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle" className="fill-gray-400 text-[10px]">ช่วงเวลา</text>
    </svg>
  )
}

export default function BuyReportPage() {
  const [rows, setRows] = useState<Po[] | null>(null)
  const [all, setAll] = useState<Resp | null>(null)
  const [from, setFrom] = useState(isoAgo(3))
  const [to, setTo] = useState(todayIso())
  const [adv, setAdv] = useState(false)
  const [grain, setGrain] = useState<Grain>('month')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ItemsResp | null>(null)
  const [itemsErr, setItemsErr] = useState('')
  const [itemQ, setItemQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // ใบซื้อมีหลักสิบใบ ดึงมาทั้งหมดครั้งเดียวแล้วกรองช่วงเวลาในเครื่อง
      const [res, iRes] = await Promise.all([
        fetch('/api/web/core?list=purchases&limit=500'),
        // ⚠️ ล้มก็ไม่ทำให้ทั้งจอพัง แต่ต้องจำไว้ว่าล้มเพราะอะไร (ท่อพัง ≠ ไม่มีของ)
        fetch('/api/web/core?list=purchaseitems&limit=500').then((r) => r.json()).catch(() => null),
      ])
      setItems(iRes && !iRes.error ? iRes : null)
      setItemsErr(!iRes ? 'ยิงไปที่ท่อรายการสินค้าในใบซื้อไม่สำเร็จ' : (typeof iRes.error === 'string' ? iRes.error : ''))
      const j: Resp = await res.json()
      if (!res.ok || (j as { error?: string })?.error) {
        throw new Error((j as { error?: string })?.error ?? `HTTP ${res.status}`)
      }
      setAll(j)
      setRows(Array.isArray(j.rows) ? j.rows : [])
    } catch (e) {
      setRows(null)
      setAll(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const inRange = useMemo(
    () => (rows ?? []).filter((r) => r.po_date && r.po_date >= from && r.po_date <= to),
    [rows, from, to],
  )
  const sum = inRange.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  const points = useMemo(() => {
    const m = new Map<string, { label: string; value: number }>()
    // เติมช่องว่างของช่วงเวลาให้ครบก่อน ไม่งั้นเดือนที่ไม่มีใบซื้อจะหายไปจากกราฟ
    const cur = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    let guard = 0
    while (cur <= end && guard++ < 400) {
      const iso = cur.toISOString().slice(0, 10)
      const b = bucketOf(iso, grain)
      if (!m.has(b.key)) m.set(b.key, { label: b.label, value: 0 })
      if (grain === 'day') cur.setDate(cur.getDate() + 1)
      else if (grain === 'month') cur.setMonth(cur.getMonth() + 1)
      else if (grain === 'quarter') cur.setMonth(cur.getMonth() + 3)
      else cur.setFullYear(cur.getFullYear() + 1)
    }
    for (const r of inRange) {
      if (!r.po_date) continue
      const b = bucketOf(r.po_date, grain)
      const slot = m.get(b.key) ?? { label: b.label, value: 0 }
      slot.value += Number(r.amount) || 0
      m.set(b.key, slot)
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v)
  }, [inRange, from, to, grain])

  const itemAll = Array.isArray(items?.rows) ? items!.rows! : []
  const itemRows = itemAll.filter((r) => {
    const s2 = itemQ.trim().toLowerCase()
    return !s2 || r.sku.toLowerCase().includes(s2) || (r.name ?? '').toLowerCase().includes(s2)
  })
  const itemsTotal = itemAll.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  const listed = inRange.filter((r) => {
    const s = q.trim().toLowerCase()
    return !s || r.number.toLowerCase().includes(s) || (r.vendor ?? '').toLowerCase().includes(s)
  })

  function downloadExcel() {
    const head = ['เลขที่ใบซื้อ', 'วันที่', 'ผู้ขาย', 'ยอดซื้อ (บาท)']
    const body = listed.map((r) => [r.number, r.po_date ?? '', r.vendor ?? '', String(r.amount ?? 0)])
    const csv = [head, ...body, ['รวม', '', '', String(sum)]]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ยอดซื้อ-${from}-ถึง-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const newest = (rows ?? []).reduce((a: string, r) => (r.po_date && r.po_date > a ? r.po_date : a), '')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ยอดซื้อ"
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      <div className="flex flex-wrap items-center gap-3 -mt-1 mb-4">
        <p className="text-[17px] font-semibold text-gray-800">
          {thaiShort(from)} – {thaiShort(to)}
        </p>
        <button onClick={() => setAdv((v) => !v)} className="text-[13px] text-blue-600 hover:underline">
          ค้นหาขั้นสูง
        </button>
      </div>

      {adv && (
        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 mb-4 flex flex-wrap items-end gap-4">
          <label className="text-[12px] text-gray-600">
            ตั้งแต่
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="block mt-1 text-[13px] border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-600">
            ถึง
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="block mt-1 text-[13px] border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <BtnGhost onClick={() => { setFrom(isoAgo(3)); setTo(todayIso()) }}>ย้อนหลัง 3 เดือน</BtnGhost>
        </div>
      )}

      {error && <ErrorBox title="ดึงยอดซื้อไม่ได้">{error}</ErrorBox>}
      {loading && !rows && <LoadingState />}

      {rows && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[15px]">🛒</span>
                <p className="text-[15px] font-semibold text-gray-900">สรุปยอดซื้อ</p>
              </div>
              <div className="flex flex-col items-center justify-center py-12">
                {sum > 0
                  ? (
                    <p className="text-[32px] font-semibold text-blue-600 leading-none">
                      {fmtMoney(sum)}<span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                    </p>
                  )
                  : <p className="text-[30px] font-bold text-blue-600 leading-none">ไม่มียอดซื้อ</p>}
                <p className="text-[12px] text-gray-500 mt-2">
                  {fmtNum(inRange.length)} ใบ ในช่วงที่เลือก
                </p>
                <button onClick={downloadExcel}
                  className="mt-5 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50">
                  Download Excel
                </button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-[15px]">📈</span>
                  <p className="text-[15px] font-semibold text-gray-900">รายงาน</p>
                </div>
                {/* ZORT มีตัวเลือกชนิดรายงานตรงนี้ — ของเรามีข้อมูลชนิดเดียวจริง ๆ จึงมีตัวเดียว
                    ⚠️ ใส่ตัวเลือกที่เลือกแล้วไม่เปลี่ยนอะไร = ปุ่มหลอก */}
                <span className="text-[12.5px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5">ยอดซื้อรวม</span>
              </div>
              <BuyChart points={points} />
              <div className="flex items-center justify-end gap-1 mt-2">
                {GRAINS.map((g) => (
                  <button key={g.id} onClick={() => setGrain(g.id)}
                    className={`text-[12px] px-2.5 py-1 rounded border ${
                      grain === g.id ? 'border-gray-400 text-gray-900 font-semibold underline' : 'border-gray-200 text-gray-500'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* ⚠️ กล่องนี้คือส่วนที่กัน "ว่าง = ไม่เคยซื้อของ" — ห้ามถอด */}
          {sum === 0 && (all?.total ?? 0) > 0 && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
              ช่วงที่เลือกไม่มีใบซื้อ <b>แต่ไม่ได้แปลว่าร้านไม่เคยซื้อของ</b> — ในคลังเงามีใบซื้อทั้งหมด
              <b> {fmtNum(all?.total ?? 0)} ใบ</b> รวม <b>{fmtMoney(all?.amount ?? 0)} บาท</b>
              {newest && <> · ใบล่าสุด <b>{thaiDate(newest)}</b></>} ⇒ กด <b>ค้นหาขั้นสูง</b> แล้วขยายช่วงเวลา
            </div>
          )}

          {/* ── ตารางยอดซื้อรายสินค้าแบบ ZORT ── */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 mr-auto">
                <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-[15px]">📊</span>
                <p className="text-[15px] font-semibold text-gray-900">ยอดซื้อ รายสินค้า</p>
              </div>
              <span className="text-[12.5px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5">สินค้า</span>
              <input value={itemQ} onChange={(e) => setItemQ(e.target.value)} placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]" />
            </div>

            <TableWrap>
              <table className="w-full min-w-[760px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัสสินค้า</th>
                    <th className={TH}>สินค้า</th>
                    <th className={THR}>จำนวน</th>
                    <th className={THR}>ยอดซื้อ (บาท)</th>
                    <th className={THR}>ยอดซื้อ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length === 0 && (
                    <EmptyState
                      cols={5}
                      icon={itemsErr ? '⚠️' : '📦'}
                      title={itemsErr ? 'ดึงรายการสินค้าในใบซื้อไม่ได้' : 'ไม่มีข้อมูล'}
                      detail={itemsErr
                        ? `ตารางนี้ว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่เคยซื้อสินค้า — ${itemsErr}`
                        : (itemQ ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีรายการสินค้าในใบซื้อ')} />
                  )}
                  {itemRows.map((r) => (
                    <tr key={r.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-blue-600 whitespace-nowrap`}>{r.sku}</td>
                      <td className={TD}>
                        <span className="text-blue-600">{r.name || '—'}</span>
                        {r.lastDate && (
                          <span className="block text-[11px] text-gray-400">
                            ซื้อล่าสุด {thaiDate(r.lastDate)}{r.orders ? ` · ${fmtNum(r.orders)} ใบ` : ''}
                          </span>
                        )}
                      </td>
                      <td className={TDR}>{fmtNum(Number(r.qty ?? 0))}</td>
                      <td className={TDR}>{fmtMoney(Number(r.amount ?? 0))}</td>
                      <td className={TDR}>
                        {itemsTotal > 0 ? `${((Number(r.amount ?? 0) / itemsTotal) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            {/* 🔴 ห้ามถอด — ตารางนี้ไม่ขยับตามช่วงเวลาด้านบน คนอ่านต้องรู้ */}
            {items && (
              <p className="text-[12px] text-amber-800 bg-amber-50 border-t border-amber-200 px-4 py-2.5 leading-relaxed">
                ⚠️ ตารางรายสินค้านี้เป็นยอด <b>ทุกช่วงเวลา</b> ไม่ได้ขยับตามช่วงวันที่ด้านบน
                (ท่อยังไม่รับตัวกรองวันที่) · รวม <b>{fmtNum(items.skus ?? 0)}</b> รหัส
                จาก <b>{fmtNum(items.lines ?? 0)}</b> บรรทัด เป็นเงิน <b>{fmtMoney(items.amount ?? 0)}</b> บาท
                {typeof all?.amount === 'number' && Math.abs((items.amount ?? 0) - all.amount) > 1 && (
                  <> · น้อยกว่ายอดรวมใบซื้อทั้งหมด <b>{fmtMoney(all.amount - (items.amount ?? 0))}</b> บาท
                    เพราะบางใบไม่มีรายการสินค้าแนบมา</>
                )}
              </p>
            )}
          </Card>

          {/* ── ตารางรายใบซื้อ (ของเราเอง ZORT ไม่มีจอนี้) ── */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 mr-auto">
                <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-[15px]">🧾</span>
                <p className="text-[15px] font-semibold text-gray-900">ยอดซื้อ รายใบ</p>
              </div>
              {/* ZORT ให้เลือกดูรายสินค้า/รายผู้ขาย — เรามีแค่รายใบซื้อจริง ๆ จึงเขียนตามที่มี */}
              <span className="text-[12.5px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5">รายใบซื้อ</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]" />
            </div>

            <TableWrap>
              <table className="w-full min-w-[720px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>เลขที่ใบซื้อ</th>
                    <th className={TH}>ผู้ขาย</th>
                    <th className={TH}>วันที่</th>
                    <th className={THR}>ยอดซื้อ (บาท)</th>
                    <th className={THR}>ยอดซื้อ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.length === 0 && (
                    <EmptyState cols={5} icon="🧾" title="ไม่มีข้อมูล"
                      detail={q ? 'ไม่พบใบซื้อที่ค้นหาในช่วงเวลานี้' : 'ช่วงเวลาที่เลือกไม่มีใบซื้อ — ลองขยายช่วงที่ค้นหาขั้นสูง'} />
                  )}
                  {listed.map((r) => (
                    <tr key={r.number} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-blue-600 whitespace-nowrap`}>{r.number}</td>
                      <td className={TD}>{r.vendor || <span className="text-gray-400">-</span>}</td>
                      <td className={`${TD} text-gray-600 whitespace-nowrap`}>{r.po_date ? thaiDate(r.po_date) : '-'}</td>
                      <td className={TDR}>{fmtMoney(Number(r.amount) || 0)}</td>
                      <td className={TDR}>{sum > 0 ? `${(((Number(r.amount) || 0) / sum) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ZORT มีเฉพาะตาราง<b>รายสินค้า</b> · ตาราง<b>รายใบ</b> เป็นของเพิ่มของเราเอง
            เพราะช่วงเวลาที่เลือกด้านบนมีผลกับตารางนั้นจริง (ตารางรายสินค้ายังไม่ขยับตามช่วงเวลา)
          </p>
        </>
      )}
    </div>
  )
}
