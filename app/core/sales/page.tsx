'use client'
// รายการขาย — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT เลยสักคำสั่ง
//
// **หน้าตาลอกจากจอ "รายการขาย" ของ ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
// เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" — คนใช้ ZORT ทุกวันต้องย้ายมาแล้วใช้เป็นทันที
// ผังที่ลอกมา: ชื่อจอ → บรรทัด "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" → ปุ่มขวาบน
//              → แถวค้นหา + ตัวเลือกช่วงเวลา → แท็บสถานะมีจำนวนในวงเล็บ
//              → ตาราง: # · วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ
import { useCallback, useEffect, useState } from 'react'
import { fmtBaht } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, toneOfStatus, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, summaryLine,
} from '@/components/zort'

interface Row {
  id: string; source: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
}
interface ChannelRow { channel: string; orders: number; amount: number }
interface ListResp {
  skip?: string
  from: string; to: string
  total: number; totalAmount: number
  limit: number; offset: number
  rows: Row[]; byChannel: ChannelRow[]; channels: string[]
}
interface Detail {
  error?: string
  order?: Row
  items?: { line: number; sku: string; name: string; qty: number; amount: number }[]
}

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

const PAGE = 50
const RANGES = [
  { days: 7, label: 'ย้อนหลัง 7 วัน' },
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]

export default function CoreSalesPage() {
  const [days, setDays] = useState(90)
  const [channel, setChannel] = useState('')
  const [q, setQ] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [offset, setOffset] = useState(0)

  const [data, setData] = useState<ListResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailFor, setDetailFor] = useState('')

  const load = useCallback(async (off = 0, opt?: { days?: number; channel?: string; cancelled?: boolean }) => {
    const d = opt?.days ?? days
    const ch = opt?.channel ?? channel
    const withCancel = opt?.cancelled ?? cancelled
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'orders', from: thaiDay(d - 1), to: thaiDay(0),
        limit: String(PAGE), offset: String(off),
      })
      if (ch) qs.set('channel', ch)
      if (q.trim()) qs.set('q', q.trim())
      if (withCancel) qs.set('cancelled', '1')
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [days, channel, cancelled, q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(id: string) {
    if (detailFor === id) { setDetailFor(''); setDetail(null); return }
    setDetailFor(id)
    setDetail(null)
    try {
      const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
      setDetail(await res.json())
    } catch (e) {
      setDetail({ error: String(e instanceof Error ? e.message : e) })
    }
  }

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  // แท็บช่องทาง — ZORT ใช้แท็บสถานะพร้อมจำนวนในวงเล็บ ของเราใช้ช่องทางเพราะมีข้อมูลจริง
  const tabs = [
    { id: '', label: 'ทั้งหมด', count: data?.total },
    ...(data?.byChannel ?? []).map((c) => ({ id: c.channel, label: c.channel, count: c.orders })),
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการขาย"
        summary={
          <>
            {data ? summaryLine(data.total, data.totalAmount) : 'กำลังโหลด…'}
            {' | '}
            <span className="text-gray-400">อ่านจากคลังของเราเอง ไม่ได้ยิง ZORT</span>
          </>
        }
        actions={
          <>
            <BtnGhost onClick={() => { setCancelled(!cancelled); load(0, { cancelled: !cancelled }) }}>
              {cancelled ? 'ซ่อนใบที่ยกเลิก' : 'รวมใบที่ยกเลิก'}
            </BtnGhost>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขรายการขาย ชื่อลูกค้า"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">แสดง</span>
            <select
              value={days}
              onChange={(e) => { const d = Number(e.target.value); setDays(d); load(0, { days: d }) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </>
        }
      />

      {data && (
        <div className="text-[12.5px] text-gray-500 mb-3">
          🔍 ค้นหา: วันที่ {data.from} – {data.to}
          {channel && ` · ช่องทาง ${channel}`}
        </div>
      )}

      {error && <ErrorBox title="ดึงรายการขายไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <Tabs
            tabs={tabs}
            active={channel}
            onChange={(id) => { setChannel(id); load(0, { channel: id }) }}
          />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ลูกค้า</th>
                  <th className={TH}>ช่องทาง</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-[13px] text-gray-400 text-center">ไม่พบใบขายในเงื่อนไขนี้</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className={`border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 ${detailFor === r.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-500`}>{r.order_date}</td>
                    <td className={TD}>
                      <span className="text-blue-600 font-medium">{r.number}</span>
                    </td>
                    <td className={`${TD} max-w-[190px] truncate`}>{r.customer || '—'}</td>
                    <td className={TD}>{r.channel || '—'}</td>
                    <td className={TDR}>{fmtBaht(r.amount)}</td>
                    <td className={TD}><Pill tone={toneOfStatus(r.status)}>{r.status || '—'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.total > PAGE && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
                <span className="text-[12px] text-gray-500">
                  แสดง {(offset + 1).toLocaleString('th-TH')}–{shown.toLocaleString('th-TH')} จาก {data.total.toLocaleString('th-TH')} รายการ
                </span>
                <div className="flex gap-2">
                  <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                    ← ก่อนหน้า
                  </BtnGhost>
                  <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}>
                    ถัดไป →
                  </BtnGhost>
                </div>
              </div>
            )}
          </TableWrap>

          {detailFor && (
            <div className="mt-4 bg-white border border-gray-200 rounded-md">
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-[13.5px] font-semibold text-gray-800">
                  รายละเอียดใบ {detail?.order?.number ?? detailFor}
                </p>
              </div>
              {!detail && <p className="text-[13px] text-gray-400 p-4">กำลังโหลด…</p>}
              {detail?.error && <p className="text-[13px] text-red-500 p-4">{detail.error}</p>}
              {detail?.items && detail.items.length === 0 && (
                <p className="text-[13px] text-gray-400 p-4">ใบนี้ไม่มีรายการสินค้าในคลังเงา</p>
              )}
              {detail?.items && detail.items.length > 0 && (
                <table className="w-full min-w-[480px]">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className={TH}>รหัสสินค้า</th>
                      <th className={TH}>สินค้า</th>
                      <th className={THR}>จำนวน</th>
                      <th className={THR}>ยอด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.line} className="border-b border-gray-100 last:border-0">
                        <td className={`${TD} text-blue-600`}>{it.sku || '—'}</td>
                        <td className={TD}>{it.name}</td>
                        <td className={TDR}>{it.qty.toLocaleString('th-TH')}</td>
                        <td className={TDR}>{fmtBaht(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
