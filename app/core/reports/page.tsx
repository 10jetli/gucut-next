'use client'
// รายงาน → สินค้า — **ลอกจาก `zort-ui/57-zort-รายงาน-สินค้า.jpg`**
// ผัง: ชื่อจอ "สินค้า" → สองการ์ดคู่ (สรุปมูลค่าสินค้าทั้งหมด | มูลค่าสินค้าคงเหลือรายคลัง)
//      → การ์ด "สินค้าจม": รหัสสินค้า · สินค้า (หมวดหมู่ตัวเล็กใต้ชื่อ) · วันที่ขายล่าสุด ·
//        จำนวนคงเหลือ · มูลค่าสินค้าคงเหลือ (บาท)
//
// ⚠️ จอนี้เคยเป็นรายงาน "ยอดรายเดือน · ช่องทาง · สินค้าขายดี" ซึ่ง **ซ้ำกับจอยอดขาย**
//    และไม่ตรงกับชื่อเมนู (รายงาน → สินค้า) ⇒ จัดใหม่ตาม ZORT
//    ของเดิมไม่ได้หาย — การวิเคราะห์ยอดขายอยู่ที่ รายงาน → ยอดขาย (/sales) ครบอยู่แล้ว
import { useCallback, useEffect, useState } from 'react'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate,
} from '@/components/zort'

interface StockResp { skip?: string; day?: string; total?: number; value?: number }
interface DeadRow {
  sku: string; name?: string; category?: string
  lastSoldAt?: string | null; onhand?: number; value?: number
}
interface DeadResp { skip?: string; days?: number; total?: number; rows?: DeadRow[] }

const DEAD_RANGES = [
  { days: 90, label: 'ขายไม่ได้เกิน 3 เดือน' },
  { days: 180, label: 'ขายไม่ได้เกิน 6 เดือน' },
  { days: 365, label: 'ขายไม่ได้เกิน 1 ปี' },
]

export default function CoreProductReportPage() {
  const [stock, setStock] = useState<StockResp | null>(null)
  const [dead, setDead] = useState<DeadResp | null>(null)
  const [deadDays, setDeadDays] = useState(90)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (days = deadDays) => {
    setLoading(true)
    setError('')
    try {
      const [sRes, dRes] = await Promise.all([
        fetch('/api/web/core?list=stock&limit=1').then((r) => r.json()),
        // ⚠️ ท่อนี้ยังไม่มี — ขอไว้แล้ว · ล้มก็ไม่ทำให้ทั้งจอพัง แค่ตารางสินค้าจมว่าง
        fetch(`/api/web/core?list=deadstock&days=${days}`).then((r) => r.json()).catch(() => null),
      ])
      if (sRes?.error) throw new Error(sRes.error)
      setStock(sRes)
      setDead(dRes && !dRes.error ? dRes : null)
    } catch (e) {
      setStock(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [deadDays])

  useEffect(() => { load() }, [load])

  function downloadStockValue() {
    if (!stock) return
    const rows = [
      ['รายงานมูลค่าสินค้าทั้งหมด'],
      ['วันที่ภาพถ่ายสต็อก', stock.day ?? ''],
      ['จำนวนรายการ', String(stock.total ?? '')],
      ['มูลค่ารวม (บาท)', String(stock.value ?? '')],
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `มูลค่าสินค้าทั้งหมด-${stock.day ?? ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deadRows = (dead?.rows ?? []).filter((r) => {
    const s = q.trim().toLowerCase()
    return !s || r.sku.toLowerCase().includes(s) || (r.name ?? '').toLowerCase().includes(s)
  })

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้า"
        actions={<BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงรายงานไม่ได้">{error}</ErrorBox>}
      {loading && !stock && <LoadingState />}

      {stock && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-[15px] font-semibold text-gray-900 mb-2">สรุปมูลค่าสินค้าทั้งหมด</p>
              <div className="flex flex-col items-center justify-center py-10">
                <p className="text-[32px] font-semibold text-blue-600 leading-none">
                  {typeof stock.value === 'number' ? fmtMoney(stock.value) : '—'}
                  <span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                </p>
                {stock.day && (
                  // ⚠️ ต้องบอกว่าเป็นภาพถ่ายวันไหน ไม่ใช่ยอดสดวินาทีนี้
                  <p className="text-[12px] text-gray-500 mt-2">
                    จากภาพถ่ายสต็อกวันที่ {thaiDate(stock.day)} · {fmtNum(stock.total ?? 0)} รายการ
                  </p>
                )}
                <button
                  onClick={downloadStockValue}
                  className="mt-5 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50"
                >
                  Download Excel
                </button>
              </div>
            </Card>

            <Card>
              <p className="text-[15px] font-semibold text-gray-900 mb-2">มูลค่าสินค้าคงเหลือรายคลัง</p>
              {/* ⚠️ ZORT โชว์เป็นกราฟวงกลมแยกรายคลัง — เราทำไม่ได้เพราะ ZORT ไม่เปิด API
                  ให้ดึงสต็อกรายคลัง (ยิงมาแล้วไม่ผ่านทุกทาง) ⇒ เขียนบอกตรง ๆ
                  **ห้ามวาดวงกลม 100% ของคลังเดียว** เพราะจะดูเหมือนมีข้อมูลแยกคลังจริง */}
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-[34px] opacity-60">🥧</span>
                <p className="text-[13px] text-gray-700 mt-2">ยังไม่มีข้อมูลแยกรายคลัง</p>
                <p className="text-[12px] text-gray-500 mt-1 max-w-[360px] leading-relaxed">
                  ZORT ไม่เปิดช่องทางให้ดึงสต็อกแยกตามคลัง — คลังของเราเก็บสต็อกรวมทั้งร้าน
                  จึงแยกเป็นรายคลังไม่ได้ (เป็นข้อจำกัดของต้นทาง ไม่ใช่ของที่ยังทำไม่เสร็จ)
                </p>
              </div>
            </Card>
          </div>

          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">สินค้าจม</p>
              <select
                value={deadDays}
                onChange={(e) => { const d = Number(e.target.value); setDeadDays(d); load(d) }}
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                {DEAD_RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]"
              />
            </div>

            <TableWrap>
              <table className="w-full min-w-[760px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัสสินค้า</th>
                    <th className={TH}>สินค้า</th>
                    <th className={TH}>วันที่ขายล่าสุด</th>
                    <th className={THR}>จำนวนคงเหลือ</th>
                    <th className={THR}>มูลค่าสินค้าคงเหลือ (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {deadRows.length === 0 && (
                    <EmptyState
                      cols={5}
                      icon="📦"
                      title={dead ? 'ไม่มีสินค้าจมในช่วงนี้' : 'ยังไม่มีข้อมูลสินค้าจม'}
                      detail={dead
                        ? 'ทุกตัวที่มีของในคลังยังขายได้ในช่วงเวลาที่เลือก — ลองขยายช่วงเวลาด้านบน'
                        : 'ต้องให้ฝั่งเซิร์ฟเวอร์คิด "วันที่ขายล่าสุด" ของแต่ละรหัสก่อน (ขอไว้แล้ว) — จอพร้อมแสดงทันทีที่ข้อมูลมา'}
                    />
                  )}
                  {deadRows.map((r) => (
                    <tr key={r.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-blue-600 whitespace-nowrap`}>{r.sku}</td>
                      <td className={TD}>
                        <span className="text-blue-600">{r.name || '—'}</span>
                        {r.category && <span className="block text-[11px] text-gray-400">หมวดหมู่: {r.category}</span>}
                      </td>
                      {/* ⚠️ ไม่เคยขายเลย ≠ ขายล่าสุดนานแล้ว — ต้องเขียนต่างกัน */}
                      <td className={`${TD} text-gray-600 whitespace-nowrap`}>
                        {r.lastSoldAt ? thaiDate(r.lastSoldAt) : <span className="text-gray-400">ยังไม่เคยขาย</span>}
                      </td>
                      <td className={TDR}>{fmtNum(Number(r.onhand ?? 0))}</td>
                      <td className={TDR}>{typeof r.value === 'number' ? fmtMoney(r.value) : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            การวิเคราะห์ยอดขาย (ยอดรายเดือน · ช่องทางที่ทำเงิน · สินค้าขายดี) ย้ายไปอยู่ที่
            <b> รายงาน → ยอดขาย</b> ซึ่งตรงกับผังของ ZORT · จอนี้เป็นรายงาน<b>สินค้า</b> ตามชื่อเมนู
          </p>
        </>
      )}
    </div>
  )
}
