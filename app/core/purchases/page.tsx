'use client'
// รายการซื้อ — **ใบสั่งซื้อ (PO) จาก ZORT** อ่านจากกระจกในคลังเงา ไม่ได้ยิง ZORT สด
//
// **หน้าตาลอกจาก `zort-ui/27-zort-รายการซื้อ.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ, มูลค่าทั้งหมด X บาท | ตรวจสอบการรับสินค้าเข้า"
//      → ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง · สร้างอย่างง่าย
//      → แถวค้นหา → แท็บ ทั้งหมด · รอโอน · รอชำระ · สำเร็จ
//      → ตาราง # · วันที่ · รายการ · ผู้ติดต่อ · มูลค่า · สถานะ · ชำระเงิน · ⋮
//
// ⚠️ **จอนี้คนละอย่างกับ "สั่งของกับโรงงาน" ที่ร้านใช้อยู่** (ย้ายไป /core/factory-orders)
//    ของเดิมอ่าน /api/sheets = ระบบสั่งของกับโรงงาน (สินค้า · มัดจำ · กำหนดส่ง)
//    ส่วนจอนี้คือใบสั่งซื้อของ ZORT ⇒ **คนละข้อมูล คนละความหมาย**
//    เคยคิดจะดัดจอเดิมให้หัวคอลัมน์ตรงภาพแล้วจบ ซึ่งง่ายกว่าและดูเหมือนเสร็จทันที
//    แต่จะได้จอที่ **หน้าตาผ่านแต่ข้อมูลผิดความหมาย** — "เหมือน ZORT 100%"
//    หมายถึงเหมือนทั้งหน้าตาและความหมายของข้อมูล ไม่ใช่เหมือนแค่หน้าตา
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, PaymentPill,
} from '@/components/zort'

interface Row {
  number: string
  vendor: string
  po_date: string
  status: string
  amount: number
  payment_status?: string
  warehouse?: string
}
interface Resp {
  skip?: string
  total: number
  amount: number
  limit: number
  offset: number
  byStatus?: { status: string; c: number }[]
  rows: Row[]
}

const PAGE = 50

// ชื่อสถานะในคลังเงาเป็นภาษาอังกฤษดิบจาก ZORT — **แปลบนจอเท่านั้น**
// ค่าที่ส่งกลับ API ต้องเป็นค่าดิบ ไม่งั้นกรองไม่ตรง (กติกาเดียวกับจอรายการขาย)
const STATUS_TH: Record<string, string> = {
  Success: 'สำเร็จ',
  Voided: 'ยกเลิก',
  Pending: 'รอดำเนินการ',
  Waiting: 'รอโอน',
  WaitingPayment: 'รอชำระ',
}
const statusTh = (s: string) => STATUS_TH[s] ?? (s || 'ไม่ระบุสถานะ')
const statusTone = (s: string) =>
  s === 'Success' ? 'green' : s === 'Voided' ? 'red' : s ? 'orange' : 'gray'

export default function CorePurchasesPage() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, tabId = tab) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'purchases', limit: String(PAGE), offset: String(off) })
      if (tabId !== 'all') qs.set('status', tabId)
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
  }, [q, tab])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  const shown = offset + rows.length
  const byStatus = Array.isArray(data?.byStatus) ? data!.byStatus! : []
  const countOf = (s: string) => byStatus.find((x) => x.status === s)?.c ?? 0

  // ⚠️ **แท็บที่เป็น 0 ก็ต้องโชว์** — ZORT โชว์ "รอโอน (0) · รอชำระ (0)" ไว้เสมอ
  //    ถ้าโชว์เฉพาะแท็บที่มีของ วันที่มีใบรอชำระเข้ามาแท็บจะโผล่มาเองแบบไม่มีใครคาด
  //    และคนใช้จะไม่รู้ว่าเคยมีตัวกรองนี้อยู่ตลอด
  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: data?.total },
    { id: 'Waiting', label: 'รอโอน', count: countOf('Waiting') },
    { id: 'WaitingPayment', label: 'รอชำระ', count: countOf('WaitingPayment') },
    { id: 'Success', label: 'สำเร็จ', count: countOf('Success') },
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการซื้อ"
        summary={
          data
            ? <>
              จำนวน {fmtNum(data.total)} รายการ, มูลค่าทั้งหมด {fmtMoney(data.amount)}
              {' | '}
              <Link href="/core/moves" className="text-blue-600 hover:underline">ตรวจสอบการรับสินค้าเข้า</Link>
            </>
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* ปุ่มตามภาพ ZORT — พาไปหน้าที่บอกว่ายังไม่ได้ทำ ไม่ทำปุ่มหลอก */}
            <Link href="/core/soon/buy-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/buy-create"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              สร้าง
            </Link>
            <Link href="/core/soon/buy-create-quick"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              สร้างอย่างง่าย
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขที่ใบสั่งซื้อ หรือชื่อผู้ขาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการซื้อไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <Tabs
            tabs={tabs}
            active={tab}
            onChange={(id) => { setTab(id); load(0, id) }}
          />

          <TableWrap>
            <table className="w-full min-w-[900px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ผู้ติดต่อ</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>ชำระเงิน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={8} icon="🔍" title="ไม่พบใบสั่งซื้อที่ค้นหา" detail="ลองพิมพ์เลขที่ใบหรือชื่อผู้ขายให้สั้นลง" />
                    : <EmptyState cols={8} icon="🧾" title="ยังไม่มีใบสั่งซื้อในแท็บนี้"
                        detail="ใบสั่งซื้อดึงมาจาก ZORT — เปิดใบใหม่ที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.number} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-500`}>{thaiDate(r.po_date)}</td>
                    <td className={TD}><span className="text-blue-600">{r.number}</span></td>
                    <td className={TD}><span className="text-blue-600">{r.vendor || '—'}</span></td>
                    <td className={TDR}>{fmtMoney(r.amount)}</td>
                    <td className={TD}>
                      <Pill tone={statusTone(r.status)}>{statusTh(r.status)}</Pill>
                      {/* ZORT เขียนชื่อคลังตัวเล็กใต้ป้ายสถานะ */}
                      {r.warehouse && <span className="block text-[11px] text-gray-400 mt-0.5">{r.warehouse}</span>}
                    </td>
                    <td className={TD}>
                      <PaymentPill value={r.payment_status} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกเลขที่ใบ', onClick: () => { navigator.clipboard?.writeText(r.number).catch(() => {}) } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} รายการ
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

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ยอดรวมตรงกับ ZORT ทุกบาท (ตรวจแล้ว {fmtNum(data.total)} ใบ · {fmtMoney(data.amount)}) ·
            จอนี้เป็น<b>ใบสั่งซื้อของ ZORT</b> คนละอย่างกับ{' '}
            <Link href="/core/factory-orders" className="text-blue-600 hover:underline">สั่งของกับโรงงาน</Link>
            {' '}ที่ร้านใช้ติดตามมัดจำและกำหนดส่ง
          </p>
        </>
      )}
    </div>
  )
}
