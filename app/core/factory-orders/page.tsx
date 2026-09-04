'use client'
// รายการซื้อ — ผังลอกจากจอ "รายการซื้อ" ของ ZORT (~/claude-shared/zort-ui/06-รายการซื้อ.jpg)
// คอลัมน์ของ ZORT: # · วันที่ · รายการ (เลข PO) · ผู้ขาย · มูลค่า · สถานะ · ชำระเงิน
//
// ⚠️ ของฝั่งเราไม่ได้อยู่ที่เดียวเหมือน ZORT — การซื้อจริงของร้านกระจายอยู่ 2 ที่:
//    · สั่งของกับโรงงาน  → /api/sheets  (ใบสั่งซื้อจริงที่ทำให้ของเข้าคลัง)
//    · ดรอปชิปปิ้ง       → /api/import  (ยัง "พิจารณา" อยู่ ไม่ใช่ใบซื้อ)
//    จอนี้รวมให้ดูที่เดียวแบบ ZORT แต่ **ไม่ทำซ้ำหน้าที่หน้าเดิม** —
//    แก้ไข/อัปรูป/เปลี่ยนสถานะ ยังทำที่ ติดตามออเดอร์ กับ ดรอปชิปปิ้ง เหมือนเดิม
// ⚠️ การซื้อพวกนี้ **ยังไม่ตัดเข้าคลังเงา** — ZORT รับของเข้าแล้วสต็อกขึ้นเอง
//    ของเราต้องบันทึกที่หน้า "ปรับสต็อกมือ" ก่อน · เขียนเตือนไว้บนจอ ห้ามถอด
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { TrackerOrder, TrackerStatus } from '@/lib/types'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, THR, TD, TDR, BtnGhost, LinkText,
  type PillTone, EmptyState,
} from '@/components/zort'

const STATUS_LABEL: Record<TrackerStatus, string> = {
  pending: 'ยังไม่มัดจำ',
  talking: 'เริ่มคุยแล้ว',
  deposit: 'มัดจำแล้ว',
  production: 'กำลังผลิต',
  shipping: 'กำลังส่ง',
  warehouse: 'ถึงโกดัง',
  done: 'เสร็จแล้ว',
}
const STATUS_TONE: Record<TrackerStatus, PillTone> = {
  pending: 'gray',
  talking: 'blue',
  deposit: 'orange',
  production: 'blue',
  shipping: 'blue',
  warehouse: 'orange',
  done: 'green',
}
// ยังไม่จบ = ยังเป็นเงินที่ผูกไว้กับของที่ยังไม่ถึงมือ
const OPEN: TrackerStatus[] = ['pending', 'talking', 'deposit', 'production', 'shipping']

const money = (s: string) => Number(String(s ?? '').replace(/[^0-9.-]/g, '')) || 0

export default function CorePurchasesPage() {
  const [orders, setOrders] = useState<TrackerOrder[]>([])
  const [importCount, setImportCount] = useState<number | null>(null)
  const [tab, setTab] = useState<'open' | 'all' | TrackerStatus>('open')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [sheetRes, impRes] = await Promise.allSettled([
      fetch('/api/sheets').then((r) => r.json()),
      fetch('/api/import').then((r) => r.json()),
    ])
    if (sheetRes.status === 'fulfilled' && Array.isArray(sheetRes.value?.orders)) {
      setOrders(sheetRes.value.orders as TrackerOrder[])
    } else {
      // ใบสั่งซื้อดึงไม่ได้ต้องบอก ไม่ใช่โชว์ตารางว่างเหมือนไม่มีของสั่งค้าง
      setError('ดึงรายการสั่งของกับโรงงานไม่ได้')
      setOrders([])
    }
    setImportCount(
      impRes.status === 'fulfilled' && Array.isArray(impRes.value?.items)
        ? impRes.value.items.length
        : null
    )
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (tab === 'open' && !OPEN.includes(o.status)) return false
      if (tab !== 'open' && tab !== 'all' && o.status !== tab) return false
      if (!needle) return true
      return (
        String(o.product ?? '').toLowerCase().includes(needle) ||
        String(o.factory ?? '').toLowerCase().includes(needle)
      )
    })
  }, [orders, tab, q])

  const openOrders = orders.filter((o) => OPEN.includes(o.status))
  const openValue = openOrders.reduce((s, o) => s + money(o.total), 0)
  const paidDeposit = openOrders.reduce((s, o) => s + money(o.deposit), 0)

  const tabs = [
    { id: 'open', label: 'ที่ยังไม่จบ', count: openOrders.length },
    { id: 'all', label: 'ทั้งหมด', count: orders.length },
    ...(Object.keys(STATUS_LABEL) as TrackerStatus[]).map((s) => ({
      id: s, label: STATUS_LABEL[s], count: orders.filter((o) => o.status === s).length,
    })),
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการซื้อ"
        summary={
          <>
            จำนวน {orders.length.toLocaleString('th-TH')} รายการ, ที่ยังไม่จบ{' '}
            {openOrders.length.toLocaleString('th-TH')} ใบ มูลค่า {fmtMoney(openValue)}
            {paidDeposit > 0 && <> · มัดจำไปแล้ว {fmtMoney(paidDeposit)}</>}
            {' | '}
            <Link href="/core/moves" className="text-blue-600 hover:underline">บันทึกรับของเข้าคลัง</Link>
          </>
        }
        actions={
          <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => {}}
        placeholder="ค้นชื่อสินค้า หรือโรงงาน"
        advanced={<LinkText onClick={() => {}}>ค้นหา</LinkText>}
        right={
          importCount !== null ? (
            <Link href="/import" className="text-[13px] text-blue-600 hover:underline">
              ดรอปชิปปิ้ง ({importCount.toLocaleString('th-TH')} รายการที่กำลังดู) →
            </Link>
          ) : undefined
        }
      />

      {error && <ErrorBox title="ดึงรายการซื้อไม่ได้">{error}</ErrorBox>}
      {loading && orders.length === 0 && <LoadingState />}

      <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
        ⚠️ <b>ของที่ซื้อเข้ามายังไม่บวกเข้าคลังเงาอัตโนมัติ</b> — ZORT รับของเข้าแล้วสต็อกขึ้นเอง
        แต่ของเราต้องไปบันทึกที่หน้า <Link href="/core/moves" className="text-blue-600 underline">ปรับสต็อกมือ</Link> ก่อน
      </div>

      {!loading && (
        <>
          <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as typeof tab)} />

          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>สินค้า</th>
                  <th className={TH}>ผู้ขาย / โรงงาน</th>
                  <th className={THR}>จำนวน</th>
                  <th className={THR}>มัดจำ</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>กำหนด</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={8} icon="🏭" title="ไม่มีใบสั่งของในเงื่อนไขนี้"
                    detail="ลองเปลี่ยนแท็บสถานะ · ใบสั่งของกับโรงงานกรอกจากระบบสั่งของ ไม่ได้มาจาก ZORT" />
                )}
                {shown.map((o, i) => (
                  <tr key={o.id} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={TD}><span className="text-gray-800">{o.product || '—'}</span></td>
                    <td className={`${TD} text-gray-600 max-w-[190px] truncate`}>{o.factory || '—'}</td>
                    <td className={TDR}>{Number(o.qty || 0).toLocaleString('th-TH')}</td>
                    <td className={`${TDR} text-gray-500`}>{money(o.deposit) ? fmtMoney(money(o.deposit)) : '—'}</td>
                    <td className={TDR}>{money(o.total) ? fmtMoney(money(o.total)) : '—'}</td>
                    <td className={TD}>
                      <Pill tone={STATUS_TONE[o.status] ?? 'gray'}>{STATUS_LABEL[o.status] ?? o.status}</Pill>
                    </td>
                    <td className={`${TD} text-gray-500 whitespace-nowrap`}>{o.due || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {shown.length.toLocaleString('th-TH')} จาก {orders.length.toLocaleString('th-TH')} รายการ
              </span>
              <Link href="/tracker" className="text-[12px] text-blue-600 hover:underline">
                แก้ไข / อัปรูป / เปลี่ยนสถานะ ที่หน้าติดตามออเดอร์ →
              </Link>
            </div>
          </TableWrap>
        </>
      )}
    </div>
  )
}
