'use client'
// รายงาน → ลูกค้า — **ใครซื้อเท่าไหร่** รวมยอดจากออเดอร์ในคลังเงา (D1)
//
// ✅ **ได้ภาพจอจริงแล้ว 6 ก.ย. 2569** (zort-ui/75·76 — เดิม 404 เพราะ URL ต้องมี ? ต่อท้าย)
//    ผัง: การ์ดคู่ จำนวนลูกค้า(วงกลม)|แนวโน้ม(เส้น) → ตารางจังหวัด → ตารางลูกค้า+ยอดขาย(%)
//    ลอกครบเท่าที่ข้อมูลมี · ที่ทำไม่ได้เขียนบนจอพร้อมเหตุผล (แนวโน้มรายเดือน · จังหวัด)
//    เดิมจออยู่ที่ /core/customers แล้วย้ายมาที่นี่ 3 ก.ย. 2569 เพราะ **ผู้ติดต่อ** ของ ZORT
//    คือ *ทะเบียนรายชื่อ* คนละเรื่องกับ *รายงานว่าใครซื้อเท่าไหร่* — เอาไปทับกันไม่ได้
//    ⇒ ทะเบียนผู้ติดต่อ (28,250 ราย เมื่อ 6 ก.ย. 2569 — เลขนับได้ ต้องมีวันที่กำกับ) อยู่ที่ /core/customers ตามเดิม
// ⚠️ รวมยอดในเบราว์เซอร์จาก /api/core?list=orders ทีละหน้า (ท่อหลังบ้านเป็นเขตอีกฝั่ง)
// ⚠️ จับลูกค้าด้วย "ชื่อ" ไม่ใช่เบอร์โทร — ชื่อซ้ำถูกนับรวมเป็นคนเดียว ต้องเขียนบอกบนจอ
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, BtnGhost, LinkText, summaryLine, EmptyState, thaiDate,
} from '@/components/zort'

interface Row { id: string; channel: string; amount: number; customer: string; order_date: string }
/** ⚠️ channels เป็น **อาร์เรย์ของ object** ไม่ใช่ข้อความคั่นลูกน้ำ (ฝั่งท่อเลือกแบบนี้ และถูก)
 *  ชื่อช่องทางคนตั้งเอง วันไหนมีลูกน้ำในชื่อ จอจะแตกชื่อเดียวเป็นสองช่องทางเงียบ ๆ
 *  — คอลัมน์ขนส่งเคยมีของแบบนี้จริงมาแล้ว */
interface Person {
  name: string; orders: number; amount: number; last: string
  channels?: { channel: string; orders: number }[]
  /** วันซื้อครั้งแรก **ทั้งประวัติ** (ไม่ใช่แค่ในช่วง) — ฝั่งท่อเพิ่ม 6 ก.ย. ขึ้นรอบ 21:00
   *  ⚠️ ก่อน deploy ท่อ ช่องนี้ undefined ⇒ จอถอยไปใช้นิยามช่วงแบบเดิมเอง ห้ามพัง */
  firstDay?: string | null
  /** ท่อคิดให้เสร็จ: คนนี้เป็นลูกค้าใหม่ในช่วงที่เลือกไหม (firstDay อยู่ในช่วง) */
  newInRange?: boolean
}

/** กราฟรายเดือนสามเส้น — ⚠️ **สองกองแรกนับเป็นคน กองไม่ระบุชื่อนับเป็นใบ ห้ามบวกรวมกัน**
 *  (ฝั่งท่อกำชับตอนออกแบบ 6 ก.ย. — หน่วยต่างกัน เส้นอยู่กราฟเดียวกันได้แต่ต้องมีป้ายหน่วย) */
interface MonthlyRow { month: string; newCustomers?: number; repeatCustomers?: number; unnamedOrders?: number }

const PER_PAGE = 50
const NO_NAME = 'ไม่ระบุชื่อ'

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

const RANGES = [
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]


/** กราฟแนวโน้มรายเดือนแบบ ZORT (ภาพ 75) — สามเส้น
 *  ⚠️ **สองเส้นแรกหน่วยเป็น "คน" เส้นไม่ระบุชื่อหน่วยเป็น "ใบ" — ห้ามบวกรวมกัน**
 *     (ฝั่งท่อกำชับตอนออกแบบ) ⇒ เส้นใบใช้**แกนขวาแยก** + ป้ายหน่วยกำกับทั้งสองแกน
 *     สามเส้นบนกราฟเดียวที่หน่วยไม่เท่ากันโดยไม่มีป้าย = ชวนให้คนอ่านบวกรวมโดยไม่รู้ตัว */
function TrendChart({ rows }: { rows: MonthlyRow[] }) {
  const W = 460; const H = 180; const padL = 34; const padR = 38; const padY = 22
  const n = rows.length
  if (n === 0) return null
  const maxP = Math.max(...rows.map((r) => Math.max(Number(r.newCustomers) || 0, Number(r.repeatCustomers) || 0)), 1)
  const maxU = Math.max(...rows.map((r) => Number(r.unnamedOrders) || 0), 1)
  const x = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1))
  const yP = (v: number) => H - padY - (v / maxP) * (H - padY * 2)
  const yU = (v: number) => H - padY - (v / maxU) * (H - padY * 2)
  const line = (get: (r: MonthlyRow) => number, y: (v: number) => number) =>
    rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(r)).toFixed(1)}`).join(' ')
  const mLabel = (m: string) => {
    const [yy, mm] = String(m).split('-').map(Number)
    const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return mm >= 1 && mm <= 12 ? `${M[mm - 1]}/${(yy + 543) % 100}` : String(m)
  }
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] mb-1">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#8ea8f8' }} />ลูกค้าใหม่ (คน)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#f2938c' }} />ซื้อซ้ำ (คน)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1 bg-gray-400" />ไม่ระบุชื่อ (<b>ใบ</b> — แกนขวา)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="แนวโน้มลูกค้ารายเดือน">
        {[0.5, 1].map((f2) => (
          <line key={f2} x1={padL} x2={W - padR} y1={yP(maxP * f2)} y2={yP(maxP * f2)} stroke="#eef1f7" />
        ))}
        <path d={line((r) => Number(r.unnamedOrders) || 0, yU)} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={line((r) => Number(r.newCustomers) || 0, yP)} fill="none" stroke="#8ea8f8" strokeWidth="2" />
        <path d={line((r) => Number(r.repeatCustomers) || 0, yP)} fill="none" stroke="#f2938c" strokeWidth="2" />
        {rows.map((r, i) => (
          <text key={r.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[9px]">{mLabel(r.month)}</text>
        ))}
        <text x={2} y={yP(maxP) + 4} className="fill-gray-400 text-[9px]">{maxP} คน</text>
        <text x={W - 2} y={yU(maxU) + 4} textAnchor="end" className="fill-gray-400 text-[9px]">{maxU} ใบ</text>
      </svg>
    </div>
  )
}

export default function CoreCustomersPage() {
  const [days, setDays] = useState(90)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'repeat' | 'once'>('all')
  const [page, setPage] = useState(0)

  const [people, setPeople] = useState<Person[]>([])
  const [scanned, setScanned] = useState(0)
  /** ท่อบอกเองว่านับรวมกี่ร้าน — ห้ามจอเดา */
  const [scope, setScope] = useState('')
  const [truncated, setTruncated] = useState(false)
  /** วันแรกสุดที่กระจกมีข้อมูล — '' = ท่อยังไม่ส่ง (ก่อน deploy รอบ 21:00) */
  const [historyFrom, setHistoryFrom] = useState('')
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (range = days) => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      /* 🔴 **เดิมดึงออเดอร์ทั้งช่วงมาจัดกลุ่มเองในเบราว์เซอร์** (แก้ 5 ก.ย. 2569)
         สูงสุด 12 หน้า × 200 = 2,400 ใบ · เกินกว่านั้น **อันดับลูกค้าจะผิดเงียบ ๆ**
         เพราะคนที่ซื้อในใบที่ไม่ได้ดึงมาจะหายไปจากตารางทั้งคน
         ⇒ ให้ฐาน GROUP BY ชื่อลูกค้าให้ ยิงครั้งเดียวได้ทั้งช่วง

         ⚠️ **ใบที่ไม่มีชื่อลูกค้า ท่อแยกมาให้ต่างหาก ไม่ปนในตารางอันดับ**
            ของจริง 90 วัน = 819 ใบ · 325,980 บาท (เกือบทั้งหมดเป็น POS หน้าร้าน)
            ถ้าปล่อยให้รวมเป็นแถวเดียว มันจะขึ้นเป็น "ลูกค้าอันดับ 1 ซื้อ 819 ใบ"
            ซึ่งไม่ใช่คน แต่เป็นกองของคนที่ไม่ได้ระบุชื่อ */
      const res = await fetch(`/api/web/core?bycustomer=1&days=${range}&limit=500`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      if (d?.skip) throw new Error(SKIP + d.skip)
      /* 🔴 ตอบ 200 แต่ไม่มีช่อง customers = ยังไม่รู้ ไม่ใช่ "ช่วงนี้ไม่มีลูกค้า"
         หัวจอเป็นตัวเลขเงินด้วย ⇒ ต้องไม่เขียนเลขเลยเมื่อไม่รู้ */
      if (!('customers' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายชื่อลูกค้า) — ยังสรุปยอดไม่ได้')
      // ตัดที่ limit เมื่อไหร่ต้องบอก — ท่อส่งธงมาเอง จอไม่ต้องเดา
      setTruncated(d?.truncated === true)
      setScope(typeof d.store === 'string' ? d.store : '')

      const list: Person[] = (Array.isArray(d.customers) ? d.customers : []).map(
        (c: { name: string; orders: number; sales: number; lastDay: string; channels?: { channel: string; orders: number }[]
              firstDay?: string | null; newInRange?: boolean }) => ({
          name: c.name, orders: Number(c.orders) || 0,
          amount: Number(c.sales) || 0, last: c.lastDay || '',
          channels: Array.isArray(c.channels) ? c.channels : [],
          firstDay: typeof c.firstDay === 'string' ? c.firstDay : null,
          // รับได้ทั้งไม่มีฟิลด์ (ท่อยังไม่ deploy) และมีเป็น boolean — ชนิดอื่นถือว่าไม่รู้
          newInRange: typeof c.newInRange === 'boolean' ? c.newInRange : undefined,
        }),
      )
      // ขอบประวัติของกระจก — ตัวกันนิยาม "ใหม่" เพี้ยนตรงขอบ (กระจกเริ่ม ~มิ.ย. 2569)
      setHistoryFrom(typeof d.historyFrom === 'string' ? d.historyFrom : '')
      setMonthly(Array.isArray(d.monthly) ? d.monthly : [])
      const un = d?.unnamed
      if (un && Number(un.orders) > 0) {
        list.push({
          name: NO_NAME, orders: Number(un.orders) || 0,
          amount: Number(un.sales) || 0, last: un.lastDay || '',
        })
      }
      setPeople(list)
      setScanned(list.reduce((n, x) => n + x.orders, 0))
      setDays(range)
      setPage(0)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setPeople([])
      setScanned(0)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load(90) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const named = people.filter((p) => p.name !== NO_NAME)
  const repeat = named.filter((p) => p.orders >= 2)
  const once = named.filter((p) => p.orders === 1)

  const filtered = useMemo(() => {
    const base = tab === 'repeat' ? repeat : tab === 'once' ? once : people
    const needle = q.trim().toLowerCase()
    const list = needle ? base.filter((p) => p.name.toLowerCase().includes(needle)) : base
    return [...list].sort((a, b) => b.amount - a.amount)
  }, [people, repeat, once, tab, q])

  const totalAmount = people.reduce((s, p) => s + p.amount, 0)
  const shown = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ลูกค้า"
        summary={
          /* 🔴 ดึงไม่ได้ **ห้ามเขียนเลขใด ๆ** — เดิมขึ้น "จำนวน 0 ราย · 0 บาท · รวมจากออเดอร์ 0 ใบ"
             อยู่เหนือกล่องแดง ⇒ อ่านได้ว่า "ช่วงนี้ไม่มีลูกค้าเลย" ซึ่งเป็นคนละเรื่องกับ "ดึงไม่ได้"
             และเป็นตัวเลขเงินด้วย (เจอด้วยท่อปลอม 6 ก.ย. 2569) */
          error ? (isSkip(error)
            ? <span className="text-amber-800">ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง</span>
            : <span className="text-red-600">ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง</span>) : (
          <>
            {/* 🔴 **ยอดรวมนี้บวกจากแถวที่แสดงเท่านั้น** — ตอนถูกตัดที่ 500 ราย มันคือยอดของ 500 รายแรก
                ไม่ใช่ยอดทั้งช่วง ⇒ ต้องเขียนกำกับ ไม่ใช่ปล่อยให้อ่านเป็นยอดรวมจริง
                (คลาสเดียวกับที่จับได้ทั้งวัน — ตัวเลขถูกในขอบเขตของตัวเอง แต่ป้ายไม่บอกขอบเขต) */}
            {truncated
              ? <>จำนวน {people.length.toLocaleString('th-TH')} ราย · ยอดรวมของรายที่แสดง {fmtMoney(totalAmount)} บาท</>
              : summaryLine(people.length, totalAmount)}
            {' | '}
            <span className="text-gray-400">
              รวมจากออเดอร์ {scanned.toLocaleString('th-TH')} ใบในคลังของเราเอง{scope ? ` · ${scope}` : ''}
            </span>
          </>
        )}
        actions={
          <BtnGhost onClick={() => load()} disabled={loading}>
            {loading ? 'กำลังรวม…' : 'ดึงใหม่'}
          </BtnGhost>
        }
      />

      <SearchRow
        value={q}
        onChange={(v) => { setQ(v); setPage(0) }}
        onSubmit={() => setPage(0)}
        placeholder="ค้นชื่อลูกค้า"
        advanced={<LinkText onClick={() => setPage(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">แสดง</span>
            <select
              value={days}
              onChange={(e) => load(Number(e.target.value))}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </>
        }
      />

      {error && <ErrorBox title="ดึงข้อมูลลูกค้าไม่ได้">{error}</ErrorBox>}
      {loading && people.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {truncated && (
            <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
              ⚠️ ช่วงนี้มีลูกค้ามากกว่า 500 ราย — ตารางแสดง <b>500 รายที่ยอดสูงสุด</b> เท่านั้น
              <b> ไม่ใช่ทั้งหมด</b> · ยอดของแต่ละรายที่แสดงถูกต้องครบถ้วน แต่รายที่ยอดน้อยกว่านั้นไม่ได้อยู่ในตาราง
            </div>
          )}

          {/* ── ผัง ZORT (ภาพ 75): การ์ดคู่ "จำนวนลูกค้า" (วงกลม) | "แนวโน้ม" (กราฟเส้น) ──
              ได้ภาพจอจริงครั้งแรก 6 ก.ย. 2569 (เดิม 404 เพราะ URL ต้องมี ? ต่อท้าย — ฝั่งท่อไขได้)
              ⚠️ นิยามของ ZORT: "ลูกค้าใหม่ vs ลูกค้าซื้อซ้ำ" — น่าจะดูจากประวัติทั้งหมด
                 ของเรามีข้อมูลแค่ในช่วงที่เลือก ⇒ ใช้ "ซื้อครั้งเดียว vs ซื้อซ้ำ **ในช่วง**" แทน
                 คนที่ซื้อครั้งแรกเมื่อปีก่อนแล้วกลับมาซื้อใบเดียวในช่วงนี้ ZORT นับซื้อซ้ำ เรานับครั้งเดียว
                 **ต้องเขียนนิยามบนจอ** ไม่งั้นคนเทียบสองจอแล้วงงว่าทำไมเลขไม่ตรง */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <p className="text-[15px] font-semibold text-gray-900 mb-3">👥 จำนวนลูกค้า</p>
              {named.length === 0
                ? <p className="text-[13px] text-gray-400">ยังไม่มีลูกค้าที่ระบุชื่อในช่วงนี้</p>
                : (() => {
                  /* ✅ นิยามแบบ ZORT ("ใหม่" = ซื้อครั้งแรกทั้งประวัติอยู่ในช่วง) ใช้ได้เมื่อ
                     ท่อส่ง newInRange มา (รอบ 21:00 6 ก.ย.) · ก่อนหน้านั้นถอยไปนิยามช่วงแบบเดิม
                     ⚠️ ตัดสินว่า "ท่อพร้อม" จากการ **มีฟิลด์จริงในข้อมูล** ไม่ใช่จากวันที่ —
                        จอนี้ต้องทำงานถูกทั้งก่อนและหลัง deploy ของอีกฝั่ง ไม่ว่าใครขึ้นก่อน */
                  const hasZortDef = named.some((p) => typeof p.newInRange === 'boolean')
                  const newC = hasZortDef ? named.filter((p) => p.newInRange === true) : once
                  const repC = hasZortDef ? named.filter((p) => p.newInRange === false) : repeat
                  /* ⚠️ **newInRange เป็นสามสถานะ: true/false/null — null คือ "ไม่รู้" ห้ามตีเป็น false**
                     (ฝั่งท่อกำชับ 6 ก.ย. — และสารภาพว่ารุ่นแรกของเขาเผลอให้ข้อมูลหายกลายเป็น false
                      คำถามเรื่องสัญญาข้อมูลจับได้ก่อน push) ⇒ คนที่ไม่รู้ต้อง**นับและโชว์แยก**
                     ไม่ใช่หายจากวงกลมเงียบ ๆ — คนหายจากกราฟคือคำตอบที่ผิดแบบมองไม่เห็น */
                  const unkC = hasZortDef ? named.filter((p) => typeof p.newInRange !== 'boolean') : []
                  const total = newC.length + repC.length || 1
                  const pctNew = Math.round((newC.length / total) * 1000) / 10
                  const pctRep = Math.round((repC.length / total) * 1000) / 10
                  const C = 2 * Math.PI * 42
                  return (
                    <div className="flex items-center gap-6 flex-wrap">
                      <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#8ea8f8" strokeWidth="16" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#f2938c" strokeWidth="16"
                          strokeDasharray={`${(repC.length / total) * C} ${C}`} />
                      </svg>
                      <div className="text-[13px] space-y-1.5">
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#8ea8f8' }} />
                          {hasZortDef ? 'ลูกค้าใหม่' : 'ซื้อครั้งเดียวในช่วง'}{' '}
                          <b>{newC.length.toLocaleString('th-TH')}</b> ราย ({pctNew}%)</p>
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#f2938c' }} />
                          {hasZortDef ? 'ลูกค้าซื้อซ้ำ' : 'ซื้อซ้ำในช่วง'}{' '}
                          <b>{repC.length.toLocaleString('th-TH')}</b> ราย ({pctRep}%)</p>
                        {unkC.length > 0 && (
                          <p className="text-[12px] text-gray-500">
                            <span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5 bg-gray-300" />
                            ไม่ทราบสถานะ <b>{unkC.length.toLocaleString('th-TH')}</b> ราย
                            <span className="text-gray-400"> (หา firstDay ไม่ได้ — ไม่ได้อยู่ในวงกลม)</span>
                          </p>
                        )}
                        {hasZortDef ? (
                          <p className="text-[11px] text-gray-400 leading-relaxed max-w-[300px] pt-1">
                            นิยามแบบ ZORT: &ldquo;ใหม่&rdquo; = ซื้อครั้งแรก(ทั้งประวัติ)อยู่ในช่วงที่เลือก
                            {/* ⚠️ ขอบประวัติ — กระจกเริ่มเก็บ ~มิ.ย. 2569 คนที่ซื้อก่อนหน้านั้น
                                จะดูเป็น "ใหม่" เกินจริง (ฝั่งท่อกำชับให้เขียนกำกับ 6 ก.ย.) */}
                            {historyFrom && (
                              <> · <b className="text-amber-700">ข้อมูลย้อนได้ถึง {thaiDate(historyFrom)}</b> —
                                คนที่เคยซื้อก่อนหน้านั้นจะถูกนับเป็น &ldquo;ใหม่&rdquo; เกินจริง</>
                            )}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400 leading-relaxed max-w-[300px] pt-1">
                            นับเฉพาะช่วงที่เลือก — ZORT นับ &ldquo;ใหม่/ซื้อซ้ำ&rdquo; จากประวัติทั้งหมด
                            จึงเทียบตัวเลขกันตรง ๆ ไม่ได้ (นิยามคนละช่วงเวลา)
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <p className="text-[15px] font-semibold text-gray-900 mb-3">📈 แนวโน้ม</p>
              {/* ⚠️ ZORT วาดเส้นรายเดือน ลูกค้าใหม่/ซื้อซ้ำ/ไม่ระบุ — ต้องมีข้อมูลรายเดือนถึงจะวาดได้
                  ท่อ bycustomer ตอบเป็นยอดรวมทั้งช่วง ไม่มีมิติเวลา ⇒ วาดไม่ได้โดยไม่เดา
                  **การ์ดต้องอยู่ตามผังพร้อมเหตุผล** ไม่ใช่หายไปเฉย ๆ (คนที่ชิน ZORT จะหา) */}
              {monthly.length > 0
                ? <TrendChart rows={monthly} />
                : (
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    ZORT วาดกราฟลูกค้าใหม่/ซื้อซ้ำรายเดือน — ท่อยังไม่ส่งข้อมูลรายเดือนมา
                    <span className="block text-[11.5px] text-gray-400 mt-1.5">
                      ฝั่งท่อเขียนเสร็จแล้ว ขึ้นพร้อมกันรอบ 21:00 — ขึ้นเมื่อไหร่กราฟวาดเอง ไม่ต้องแก้จอ
                    </span>
                  </p>
                )}
            </div>
          </div>

          {/* ── ผัง ZORT (ภาพ 75): ตารางจังหวัด × จำนวนลูกค้า ──
              คลังเงาไม่ได้เก็บที่อยู่/จังหวัดของใบขาย ⇒ ทำตารางจริงไม่ได้ ห้ามเดา
              (ZORT ใช้ที่อยู่จัดส่ง — ของเรามีในระบบออเดอร์เว็บเท่านั้น ไม่ครอบคลุมมาร์เก็ตเพลส) */}
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-4 text-[12.5px] text-gray-600">
            ผัง ZORT มีตาราง <b>จังหวัด × จำนวนลูกค้า</b> ตรงนี้ (ภาพ 75: ไม่ระบุ 190 · เลย 21 · สงขลา 21 …)
            — คลังเงายังไม่เก็บจังหวัดของใบขาย จึง<b>ยังทำไม่ได้ ไม่ใช่ลืม</b> ·
            ที่อยู่มีเฉพาะออเดอร์ที่สั่งผ่านเว็บ (ไม่ครอบคลุมมาร์เก็ตเพลส) ทำตารางจากส่วนเดียวจะเอียง
          </div>

          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: people.length },
              { id: 'repeat', label: 'ซื้อซ้ำ', count: repeat.length },
              { id: 'once', label: 'ซื้อครั้งเดียว', count: once.length },
            ]}
            active={tab}
            onChange={(id) => { setTab(id as 'all' | 'repeat' | 'once'); setPage(0) }}
          />

          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>ชื่อ</th>
                  <th className={TH}>ช่องทางที่ซื้อ</th>
                  <th className={THR}>จำนวนใบ</th>
                  <th className={THR}>ยอดรวม</th>
                  {/* ZORT (ภาพ 76) มีคอลัมน์ ยอดขาย (%) — สัดส่วนต่อยอดรวมของช่วง */}
                  <th className={THR}>ยอดขาย (%)</th>
                  <th className={THR}>ซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={7} icon="👥" title="ไม่พบลูกค้าในเงื่อนไขนี้"
                    detail="รายชื่อลูกค้ารวมจากใบขาย — ถ้าเพิ่งมีออเดอร์ใหม่ ต้องรอรอบซิงก์ถัดไป" />
                )}
                {shown.map((p, i) => (
                  <tr key={p.name} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{page * PER_PAGE + i + 1}</td>
                    <td className={TD}>
                      {/* มีหน้าปลายทางแล้วตั้งแต่ 8 ก.ย. 2569 (/core/customers/detail รับ ?name=)
                          ⚠️ "ไม่ระบุชื่อ" กดไม่ได้โดยตั้งใจ — มันคือ **หลายคนรวมกัน** ไม่ใช่ลูกค้าหนึ่งราย
                             ทำให้กดได้ = พาไปหน้าที่ค้นชื่อว่า "ไม่ระบุชื่อ" แล้วได้ผลที่ดูเหมือนจริงแต่ไม่ใช่ใคร
                          ⚠️ ชื่อที่มีดาว (มาร์เก็ตเพลสปิดมาเอง) ยังกดได้ แต่หน้าปลายทางเตือนเองว่าผลไม่น่าเชื่อถือ */}
                      {/* 🔴 ไม่มีชื่อเลย = ท่อส่งแถวที่ไม่มีช่อง name มา (เจอด้วยโหมด partialgood 9 ก.ย. 2569)
                          ของเดิมทำเป็นลิงก์ทั้งที่ข้อความว่าง ⇒ ได้ `?name=undefined` และ
                          **ลิงก์ที่มองไม่เห็น กดไม่โดน** ⇒ ต้องขึ้นขีดแทน ไม่ใช่ลิงก์เปล่า */}
                      {!p.name ? (
                        <span className="text-gray-300">—</span>
                      ) : p.name === NO_NAME ? (
                        <>
                          <span className="text-gray-900 font-medium">{p.name}</span>
                          <span className="ml-1.5 text-[11px] text-gray-400">(หลายคนรวมกัน — เปิดดูรายคนไม่ได้)</span>
                        </>
                      ) : (
                        <Link href={`/core/customers/detail?name=${encodeURIComponent(p.name)}`}
                          className="text-[#457ab2] hover:underline font-medium">{p.name}</Link>
                      )}
                    </td>
                    {/* ⚠️ โชว์จำนวนใบต่อช่องทางด้วย — "ซื้อ 4 ใบ" กับ "ซื้อทาง Shopee 4 ใบ"
                        ต่างกันตอนคนคนเดียวซื้อหลายช่องทาง · ไม่มีข้อมูล = ขีด ไม่ใช่เว้นว่าง */}
                    <td className={`${TD} text-gray-500 max-w-[240px]`}>
                      {p.channels && p.channels.length > 0
                        ? p.channels.map((c) => `${c.channel} (${c.orders})`).join(' · ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TDR}>{p.orders.toLocaleString('th-TH')}</td>
                    <td className={TDR}>{fmtMoney(p.amount)}</td>
                    {/* ⚠️ ตัวหารคือยอดรวมของช่วง (totalAmount) — ตอนถูกตัดที่ 500 ราย
                        มันคือยอดของรายที่แสดง ป้ายหัวจอบอกขอบเขตแล้ว · กันหารศูนย์ด้วย */}
                    <td className={`${TDR} text-gray-500`}>
                      {totalAmount > 0 ? `${(Math.round((p.amount / totalAmount) * 1000) / 10).toLocaleString('th-TH')}%` : '—'}
                    </td>
                    <td className={`${TDR} text-gray-500`}>{thaiDate(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* แถบล่างแบบ ZORT: ซ้ายบอกจำนวน ขวาเลื่อนหน้า */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {filtered.length === 0 ? 0 : (page * PER_PAGE + 1).toLocaleString('th-TH')}–
                {Math.min((page + 1) * PER_PAGE, filtered.length).toLocaleString('th-TH')} จาก{' '}
                {filtered.length.toLocaleString('th-TH')} ราย
              </span>
              <div className="flex items-center gap-2">
                <BtnGhost onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← ก่อนหน้า</BtnGhost>
                <span className="text-[12px] text-gray-500">หน้า {page + 1} / {pageCount}</span>
                <BtnGhost onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page + 1 >= pageCount}>ถัดไป →</BtnGhost>
              </div>
            </div>
          </TableWrap>

          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ ZORT มีคอลัมน์ <b>เลขประจำตัวผู้เสียภาษี · เบอร์โทรศัพท์ · อีเมล</b> แต่คลังเงาของเรา
            <b> ไม่ได้เก็บสามอย่างนี้ไว้</b> จึงไม่ใส่คอลัมน์เปล่าให้ดูเหมือนมีข้อมูล ·
            และจับลูกค้าด้วย<b>ชื่อที่บันทึกในออเดอร์</b> ไม่ใช่เบอร์โทร — ชื่อสะกดต่างกันจะนับเป็นคนละคน
            ใช้ดูภาพรวมได้ แต่ยังไม่ใช่ทะเบียนลูกค้าจริง
          </p>
        </>
      )}
    </div>
  )
}
