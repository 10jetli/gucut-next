'use client'
// การเงิน — ตัวแทนเมนู "การเงิน" ของ ZORT
//
// ⚠️ กติกาของจอนี้: **โชว์เฉพาะตัวเลขที่เรารู้จริง** ห้ามเดา
//    · รายรับจากการขาย → คลังเงา (D1) เชื่อได้
//    · มูลค่าสต็อกที่ถืออยู่ → ภาพถ่ายสต็อก × ราคาขาย เชื่อได้แต่ต้องบอกว่าเป็นราคาขายไม่ใช่ทุน
//    · ค่าใช้จ่าย → บิลจาก Gmail **นับใบได้ แต่ยอดเงินเดาจากเนื้อความ** จึงไม่เอามารวมเป็นตัวเลข
//      (ดู lib/gmail.ts: amounts เป็น best-effort) เอาเลขเดามาวางในหน้าการเงิน = อันตรายกว่าไม่มี
//    · บัญชี/ภาษี/ใบกำกับ ตัวจริงอยู่ที่ PEAK — จอนี้ไม่แสร้งทำแทน
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

interface Row { amount: number; order_date: string }
interface StockResp { total: number; value: number; outOfStock: number; day: string }
interface Bill { vendorId: string; vendorName: string; emoji: string; subject: string; date: string }

const PAGE = 200
const MAX_PAGES = 12
const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)
const thisMonth = () => thaiDay(0).slice(0, 7)

const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${THAI_MONTH[Number(m) - 1] ?? m} ${Number(y) + 543 - 2500}`
}

export default function CoreFinancePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [stock, setStock] = useState<StockResp | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [bills, setBills] = useState<Bill[] | null>(null)
  const [billLoading, setBillLoading] = useState(false)
  const [billError, setBillError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      const from = thaiDay(180)
      const to = thaiDay(0)
      const all: Row[] = []
      let total = Infinity
      let page = 0
      while (all.length < total && page < MAX_PAGES) {
        const qs = new URLSearchParams({
          list: 'orders', from, to, limit: String(PAGE), offset: String(page * PAGE),
        })
        const res = await fetch(`/api/web/core?${qs}`)
        const d = await res.json()
        if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
        if (d?.skip) throw new Error(d.skip)
        total = Number(d.total ?? 0)
        const got: Row[] = Array.isArray(d.rows) ? d.rows : []
        all.push(...got)
        page++
        if (got.length < PAGE) break
      }
      if (all.length < total) setTruncated(true)
      setRows(all)

      const sRes = await fetch('/api/web/core?list=stock&limit=1')
      const sd = await sRes.json()
      setStock(sd?.skip ? null : sd)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setRows([])
      setStock(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // บิลยิง Gmail ทีละหลายเจ้า ช้าได้เป็นสิบวินาที — ต้องกดเอง ไม่ยิงตอนเปิดหน้า
  async function loadBills() {
    setBillLoading(true)
    setBillError('')
    try {
      const res = await fetch(`/api/bills?month=${thisMonth()}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setBills(Array.isArray(d.bills) ? d.bills : [])
    } catch (e) {
      setBillError(String(e instanceof Error ? e.message : e))
      setBills(null)
    } finally {
      setBillLoading(false)
    }
  }

  const byMonth = new Map<string, { sales: number; orders: number }>()
  for (const o of rows) {
    const ym = (o.order_date || '').slice(0, 7)
    if (!ym) continue
    const cur = byMonth.get(ym) ?? { sales: 0, orders: 0 }
    cur.sales += Number(o.amount) || 0
    cur.orders += 1
    byMonth.set(ym, cur)
  }
  const months = Array.from(byMonth.entries())
    .map(([ym, v]) => ({ ym, ...v }))
    .sort((a, b) => b.ym.localeCompare(a.ym))
  const total6 = rows.reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const thisM = byMonth.get(thisMonth())?.sales ?? 0
  const maxMonth = Math.max(...months.map((m) => m.sales), 1)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="การเงิน"
        summary="รายรับจากการขายและมูลค่าของในคลัง — อ่านจากคลังของเราเอง"
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงข้อมูลการเงินไม่ได้">{error}</ErrorBox>}
      {loading && rows.length === 0 && <LoadingState />}

      <p className="text-[12px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
        ℹ️ <b>บัญชี ภาษี และใบกำกับตัวจริงอยู่ที่ PEAK</b> — จอนี้ไม่ได้ทำแทน
        แสดงเฉพาะเงินเข้าจากการขายกับมูลค่าของในคลังที่ระบบเรารู้จริง
      </p>

      {!loading && !error && (
        <>
          {truncated && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ ออเดอร์ 6 เดือนเยอะเกินกว่าที่ดึงไหวรอบเดียว — คิดจาก {fmtNum(rows.length)} ใบแรก
              <b> ตัวเลขยังไม่ครบ</b>
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon="📅" tone="blue" label={`รายรับเดือนนี้ (${monthLabel(thisMonth())})`} value={fmtBaht(thisM)} />
            <StatCard icon="💰" tone="green" label="รายรับ 6 เดือน" value={fmtBaht(total6)}
              note={`${fmtNum(rows.length)} ใบ`} />
            <StatCard icon="📦" tone="purple" label="มูลค่าของในคลัง"
              value={stock ? fmtBaht(stock.value) : '—'}
              note={stock ? `คิดที่ราคาขาย · ${fmtNum(stock.total)} SKU` : undefined} />
            <StatCard icon="🚫" tone="red" label="SKU ที่ของหมด"
              value={stock ? fmtNum(stock.outOfStock) : '—'} unit="ตัว"
              note={stock ? `ภาพถ่าย ${stock.day}` : undefined} />
          </div>

          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-3">รายรับรายเดือน (6 เดือนล่าสุด)</p>
            {months.length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มีข้อมูล</p>}
            <div className="space-y-2.5">
              {months.map((m) => (
                <div key={m.ym}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12.5px] font-medium text-gray-800">{monthLabel(m.ym)}</span>
                    <span className="text-[12.5px] text-gray-500">
                      {fmtNum(m.orders)} ใบ · <b className="text-gray-900">{fmtBaht(m.sales)}</b>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max((m.sales / maxMonth) * 100, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              ยอดนี้คือ<b>มูลค่าขาย</b>ตามที่บันทึกในออเดอร์ ยังไม่ได้หักค่าธรรมเนียมมาร์เก็ตเพลส
              ค่าส่ง หรือส่วนลดที่แพลตฟอร์มออกให้ — ตัวเลขที่หักครบต้องดูที่ PEAK
            </p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-[13px] font-semibold text-gray-700">🧾 บิลค่าใช้จ่ายเดือนนี้</p>
              <div className="flex items-center gap-2">
                <button onClick={loadBills} disabled={billLoading}
                  className="text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  {billLoading ? '⏳ กำลังดึง…' : '📥 ดึงบิลเดือนนี้'}
                </button>
                <Link href="/bills" className="text-[11px] text-blue-600 font-medium hover:text-blue-700">
                  หน้ารวมบิล →
                </Link>
              </div>
            </div>
            {billError && <p className="text-[12.5px] text-red-500">{billError}</p>}
            {bills === null && !billError && (
              <p className="text-[12.5px] text-gray-400">
                กดปุ่มเพื่อดึง — ต้องค้นอีเมลหลายเจ้า ใช้เวลาสักครู่ จึงไม่ดึงเองตอนเปิดหน้า
              </p>
            )}
            {bills !== null && (
              <>
                <p className="text-[13px] text-gray-700 mb-2">
                  ได้รับบิล <b>{fmtNum(bills.length)}</b> ใบในเดือน {monthLabel(thisMonth())}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    bills.reduce((m, b) => m.set(b.vendorName, (m.get(b.vendorName) ?? 0) + 1), new Map<string, number>())
                  ).map(([name, n]) => (
                    <span key={name} className="text-[12px] border border-gray-200 rounded-xl px-3 py-1.5">
                      <b className="text-gray-800">{name}</b>
                      <span className="text-gray-500"> · {fmtNum(n)} ใบ</span>
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  ⚠️ นับ<b>จำนวนใบ</b>อย่างเดียว ไม่รวมยอดเงิน — ยอดในบิลถูกเดาจากเนื้อความอีเมล
                  ยังเชื่อเป็นตัวเลขการเงินไม่ได้ ต้องเปิดไฟล์แนบดูเอง
                </p>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
