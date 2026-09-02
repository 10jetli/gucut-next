'use client'
// สินค้า — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT
//
// **หน้าตาลอกจากจอ "สินค้า" ของ ZORT ของจริง** (~/claude-shared/zort-ui/02-สินค้า.jpg)
// ผังที่ลอกมา: ชื่อจอ → "จำนวน N รายการ" → ปุ่มขวาบน → แถวค้นหา
//              → แท็บ ทั้งหมด/เปิดใช้งาน/ปิดใช้งาน → ตาราง # · รหัส · ชื่อสินค้า ·
//                ราคาซื้อ · ราคาขาย · คงเหลือ · พร้อมขาย
// ⚠️ **คงเหลือติดลบต้องเป็นสีแดง** — ZORT ทำแบบนี้ (เห็นในภาพ -2 -3) เป็นสัญญาณว่าขายเกิน
// ⚠️ ตัวเลขที่นี่คือ "ภาพถ่ายสต็อกตอนตี 1" ไม่ใช่ยอดสด — ต้องเขียนบอกบนจอเสมอ
//    ปล่อยให้เข้าใจว่าสดจะกลายเป็นจอที่โกหกเงียบ ๆ ตอนของขยับระหว่างวัน
import { useCallback, useEffect, useState } from 'react'
import { fmtBaht } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, Num, BtnGhost, LinkText, RowMenu,
} from '@/components/zort'

interface Row { sku: string; name: string; qty: number; price: number; sold: number }
interface Resp {
  skip?: string
  day: string; soldDays: number
  total: number; outOfStock: number; low: number; value: number
  limit: number; offset: number; rows: Row[]
}

const PAGE = 50
const SORTS = [
  { id: 'qty', label: 'ของใกล้หมดก่อน' },
  { id: 'sold', label: 'ขายดีก่อน' },
  { id: 'sku', label: 'เรียงตามรหัส' },
]

export default function CoreStockPage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('qty')
  const [tab, setTab] = useState<'all' | 'out' | 'low'>('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, sortId = sort) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'stock', sort: sortId, limit: String(PAGE), offset: String(off),
      })
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, sort])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ⚠️ **ตัวนับในแท็บเป็นเลขทั้งคลังแล้ว แต่การกรองแถวยังทำได้แค่ในหน้าที่กำลังดู**
  //    (เซิร์ฟเวอร์ยังไม่มีตัวกรอง only=out/low — ขอไปแล้ว)
  //    ระหว่างนี้ต้องเขียนบอกบนจอตรง ๆ ว่ากรองแค่หน้านี้ ไม่งั้นคนอ่านนึกว่าเห็นครบทั้งคลัง
  const all = data?.rows ?? []
  const rows = tab === 'out' ? all.filter((r) => r.qty <= 0)
    : tab === 'low' ? all.filter((r) => r.qty > 0 && r.qty <= 3)
      : all
  const shown = offset + all.length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้า"
        summary={
          data ? (
            <>
              จำนวน {data.total.toLocaleString('th-TH')} รายการ | ของหมด{' '}
              <span className="text-red-500 font-semibold">{data.outOfStock.toLocaleString('th-TH')}</span> ·
              เหลือน้อย <span className="text-orange-600 font-semibold">{data.low.toLocaleString('th-TH')}</span> ·
              มูลค่าสต็อก {fmtBaht(data.value)}
            </>
          ) : 'กำลังโหลด…'
        }
        actions={
          <BtnGhost onClick={() => load(offset)} disabled={loading}>
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </BtnGhost>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="ค้นหา รหัสสินค้า หรือชื่อสินค้า"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">เรียง</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); load(0, e.target.value) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        }
      />

      {error && <ErrorBox title="ดึงสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
            ⚠️ ตัวเลขนี้คือ <b>ภาพถ่ายสต็อกของวันที่ {data.day}</b> (ถ่ายตอนตี 1) ไม่ใช่ยอดสดวินาทีนี้
          </div>

          <Tabs
            // ⚠️ **ตัวนับต้องเป็นเลขทั้งคลัง ไม่ใช่เลขของหน้าที่กำลังดู**
            //    ของเดิมนับจาก all (50 แถวในหน้านี้) ⇒ ตัวเลขในวงเล็บกับความจริงคนละเรื่อง
            //    หลักเดียวกับ byStatus ในจอรายการขาย: แท็บคือสารบัญของข้อมูลทั้งหมด
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: data.total },
              { id: 'out', label: 'ของหมด', count: data.outOfStock },
              { id: 'low', label: 'เหลือน้อย', count: data.low },
            ]}
            active={tab}
            onChange={(id) => setTab(id as 'all' | 'out' | 'low')}
          />

          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>ราคาขาย</th>
                  <th className={THR}>คงเหลือ</th>
                  <th className={THR}>ขาย {data.soldDays} วัน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-[13px] text-gray-400 text-center">ไม่พบสินค้าในเงื่อนไขนี้</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700 font-medium`}>{r.sku}</td>
                    <td className={TD}><span className="text-blue-600">{r.name || '—'}</span></td>
                    <td className={TDR}>{r.price ? fmtBaht(r.price) : '0'}</td>
                    <td className={TDR}><Num v={r.qty} zeroRed /></td>
                    <td className={TDR}>{r.sold.toLocaleString('th-TH')}</td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกรหัสสินค้า', onClick: () => { navigator.clipboard?.writeText(r.sku).catch(() => {}) } },
                          { label: 'ปรับสต็อกของรหัสนี้', onClick: () => { window.location.href = `/core/moves?sku=${encodeURIComponent(r.sku)}` } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {(offset + 1).toLocaleString('th-TH')}–{shown.toLocaleString('th-TH')} จาก {data.total.toLocaleString('th-TH')} รายการ
                {tab !== 'all' && (
                  <span className="text-amber-600">
                    {' '}· ⚠️ ตอนนี้แท็บนี้กรองเฉพาะ {all.length} แถวในหน้านี้ ตัวเลขในวงเล็บคือทั้งคลัง
                    (รอตัวกรองฝั่งเซิร์ฟเวอร์)
                  </span>
                )}
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
          </TableWrap>
        </>
      )}
    </div>
  )
}
