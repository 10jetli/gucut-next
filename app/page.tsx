'use client'
// ภาพรวมร้าน — ตัวเลขหลักอ่านจาก "คลังเงา" (D1) แล้ว ไม่ได้ยิง ZORT อีก
//
// ของเดิมยิง /api/zort 5 เส้นแล้ว catch เงียบ — ZORT ล่ม/ช้า = การ์ดขึ้น 0 ทุกใบ
// โดยไม่มีอะไรบอกว่าพัง (เจอจริง 2 ก.ย. 2569 หน้าค้างที่ "กำลังโหลด" และเลข 0 ค้าง)
// ⚠️ ห้ามกลับไป catch เงียบอีก — ดึงไม่ได้ต้อง**บอกว่าดึงไม่ได้** ไม่ใช่โชว์เลข 0
//    เลข 0 ที่แปลว่า "พัง" กับ 0 ที่แปลว่า "วันนี้ยังไม่มีออเดอร์" หน้าตาเหมือนกันเป๊ะ
//
// ยังเหลือสองใบที่ยังพึ่ง ZORT อยู่ (ไม่มีในคลังเงา) — ติดป้ายบอกไว้บนจอแล้ว:
//   · สินค้าตีกลับ → /api/returns (มีแคช 6 ชม.)
//   · การสั่งของกับโรงงาน → /api/sheets (ไม่ใช่ ZORT อยู่แล้ว)
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { PageHead, BtnGhost, thaiDate } from '@/components/zort'

interface CoreOrderRow {
  id: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
}
interface StoreRow { source: string; name?: string; orders?: number; amount?: number }
interface OrdersResp {
  skip?: string; total: number; totalAmount: number; rows: CoreOrderRow[]
  /* 🔴 `totalAmount` **รวมใบที่ยังไม่จ่าย** — วัดจริง 6 ก.ย. 2569 บวมเกินจริง 11.2%
     ⇒ การ์ด "ยอดขาย" บนหน้าแรกคือเลขที่คนดูบ่อยที่สุดในระบบ **ห้ามให้มันเกินจริง**
     ⚠️ ไม่มีคีย์ = ท่อรุ่นเก่า ⇒ ตกกลับไปใช้ totalAmount แต่ต้องเขียนกำกับว่ารวมใบยังไม่จ่าย */
  totalPaidAmount?: number
  totalUnpaidAmount?: number
  /** ร้านที่มีบิลจริง **ในช่วงที่กรองอยู่** — ห้ามเขียนจำนวนร้านตายตัว
   *  ช่วงที่ร้านไหนไม่มีบิลเลย จะไม่โผล่ในรายการนี้ ⇒ นับจากตรงนี้เท่านั้น */
  stores?: StoreRow[]
}
interface StockResp { skip?: string; total: number; outOfStock: number; low: number }
/** ใบค้างแยกเป็นกอง — คีย์เป็นภาษาไทยตามที่ท่อส่งมาจริง (`/api/core?pending=1`) */
interface PendingResp {
  skip?: string
  counts?: Record<string, number>
  amounts?: Record<string, number>
  /** จำนวนวันที่ถือว่าช่องทาง "เงียบ" — เอาไว้เขียนกำกับ ไม่ให้ตัวเลขลอยไร้เกณฑ์ */
  dormantDays?: number
}

// วันแบบไทย (UTC+7) — ต้องตรงกับฝั่งเซิร์ฟเวอร์ ไม่งั้น "วันนี้" ของสองฝั่งคนละวัน
// ของเดิมใช้ toISOString() ตรง ๆ = ก่อนเจ็ดโมงเช้าจะไปถามยอดของ "เมื่อวาน"
const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

async function getJson(url: string) {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
  return d
}

/** การ์ดตัวเลขแบบแดชบอร์ด ZORT — ไอคอนกลมพื้นพาสเทลซ้าย · ป้ายเล็กกับเลขใหญ่ชิดขวา
 *  (ลอกจาก zort-ui/23-zort-หน้าแรก-แดชบอร์ด.jpg) */
function ZortStat({
  icon, bg, fg, label, value, big, note,
}: {
  icon: string; bg: string; fg: string
  label: string
  value: string
  big?: 'red' | 'plain'
  note?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] shrink-0"
        style={{ background: bg, color: fg }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className="block text-[12px] text-gray-500 truncate">{label}</span>
        <span className={`block text-[24px] leading-tight font-semibold ${big === 'red' ? 'text-red-500' : 'text-gray-800'}`}>
          {value}
        </span>
        {note && <span className="block text-[11px] text-gray-400 mt-0.5">{note}</span>}
      </span>
    </div>
  )
}

/** ทางลัดแบบ ZORT — การ์ดใหญ่ ภาพกลาง ชื่ออยู่ใต้ภาพ */
function Shortcut({ href, icon, label, soon }: { href: string; icon: string; label: string; soon?: boolean }) {
  return (
    <Link href={href}
      className="bg-white border border-gray-200 rounded-md py-7 flex flex-col items-center gap-3 hover:border-gray-300 hover:shadow-sm transition-all">
      <span className={`text-[38px] leading-none ${soon ? 'opacity-40 grayscale' : ''}`}>{icon}</span>
      <span className={`text-[13px] ${soon ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}{soon ? ' ◦' : ''}
      </span>
    </Link>
  )
}

/* ── ชิ้นส่วนของผัง "ภาพรวม" แบบ ZORT (สเปกเมนู 1 · 15 ก.ย. 2569) ─────────────
   🔴 กติกาที่คุมทุกชิ้นข้างล่าง: **ไม่รู้ ≠ ศูนย์**
      ดึงไม่ได้ ⇒ วาดโครงไว้ + เขียนว่ายังดึงไม่ได้ · **ห้ามซ่อนทั้งการ์ด**
      (ซ่อน = เอาไปเทียบผังกับ ZORT ไม่ได้ ซึ่งเป็นงานของรอบนี้พอดี) */

/** การ์ดตัวเลขแบบ ZORT: ไอคอนวงกลมชิดซ้าย · ป้ายกับตัวเลขชิดขวา */
function ZortBigCard({ icon, label, value, unknown, tone }: {
  icon: string; label: string; value?: string; unknown?: string; tone?: 'red' | 'green'
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-full bg-violet-50 flex items-center justify-center text-[16px]">{icon}</span>
        <div className="ml-auto text-right">
          <p className="text-[12px] text-gray-500">{label}</p>
          {unknown
            ? <p className="text-[12.5px] text-amber-800 mt-1 leading-snug max-w-[260px]">⚠️ {unknown}</p>
            : <p className={`text-[26px] font-semibold leading-tight ${
              tone === 'red' ? 'text-red-500' : tone === 'green' ? 'text-emerald-600' : 'text-blue-600'}`}>{value}</p>}
        </div>
      </div>
    </Card>
  )
}

/** กราฟเส้น/แท่งยอดขายรายเดือน — SVG ล้วน (ชุดเดียวกับที่จอยอดขายใช้ แต่หน่วยเป็นเดือน) */
function MonthTrend({ data, kind }: { data: { ym: string; sales: number }[]; kind: 'line' | 'bar' }) {
  const W = 560, H = 170, PAD = 10
  const max = Math.max(...data.map((d) => d.sales), 1)
  const n = Math.max(data.length, 1)
  const x = (i: number) => PAD + ((W - PAD * 2) * (i + 0.5)) / n
  const y = (v: number) => H - 28 - (v / max) * (H - 56)
  const thai = (ym: string) => {
    const m = Number(String(ym).slice(5, 7))
    return ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m] ?? ym
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="กราฟยอดขายรายเดือน">
      {kind === 'line' && (
        <path d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.sales).toFixed(1)}`).join(' ')}
          fill="none" strokeWidth={2} className="stroke-violet-500" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data.map((d, i) => (
        <g key={d.ym}>
          {kind === 'bar' && (
            <rect x={x(i) - 14} y={y(d.sales)} width={28} height={Math.max(H - 28 - y(d.sales), 1)} rx={4}
              className="fill-violet-400" />
          )}
          {kind === 'line' && <circle cx={x(i)} cy={y(d.sales)} r={3} className="fill-violet-500" />}
          <text x={x(i)} y={y(d.sales) - 6} textAnchor="middle" className="fill-gray-500 text-[9px]">
            {d.sales >= 1000 ? `${Math.round(d.sales / 1000)}K` : Math.round(d.sales)}
          </text>
          <text x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-400 text-[10px]">{thai(d.ym)}</text>
        </g>
      ))}
      <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-gray-400 text-[9px]">ช่วงเวลา</text>
    </svg>
  )
}

/** กราฟวงกลมมูลค่าคงเหลือรายคลัง + legend
 *  🔴 คลังที่ท่อไม่ส่งตัวเลขมา (`null`) **ไม่ใช่ 0** ⇒ ไม่เอาเข้ากราฟ และต้องเขียนแยกว่าไม่รู้
 *     (ของจริง: KLD/ANJ ติดสิทธิ์ผู้ใช้ API — ยิงเห็นเอง 15 ก.ย. 2569) */
function WarehousePie({ rows }: { rows: { code: string; name: string; stockValue: number | null }[] }) {
  const COLORS = ['#7c6cf0', '#4669e5', '#34c3a4', '#f0a23c', '#e2607a']
  const known = rows.filter((r) => typeof r.stockValue === 'number' && (r.stockValue as number) > 0)
  const unknown = rows.filter((r) => typeof r.stockValue !== 'number')
  const zero = rows.filter((r) => r.stockValue === 0)
  const total = known.reduce((a, r) => a + (r.stockValue as number), 0)
  const R = 54, C = 70
  let acc = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="w-[140px] h-[140px]" role="img" aria-label="สัดส่วนมูลค่าคงเหลือรายคลัง">
        {total > 0 ? known.map((r, i) => {
          const frac = (r.stockValue as number) / total
          const a0 = acc * 2 * Math.PI - Math.PI / 2
          acc += frac
          const a1 = acc * 2 * Math.PI - Math.PI / 2
          const large = frac > 0.5 ? 1 : 0
          const p = (a: number) => `${(C + R * Math.cos(a)).toFixed(2)},${(C + R * Math.sin(a)).toFixed(2)}`
          /* วงเดียวเต็ม 100% วาดเป็น arc ไม่ได้ ⇒ ใช้วงกลมเต็มแทน */
          return frac >= 0.999
            ? <circle key={r.code} cx={C} cy={C} r={R} fill={COLORS[i % COLORS.length]} />
            : <path key={r.code} d={`M${C},${C} L${p(a0)} A${R},${R} 0 ${large} 1 ${p(a1)} Z`} fill={COLORS[i % COLORS.length]} />
        }) : <circle cx={C} cy={C} r={R} className="fill-gray-100" />}
      </svg>
      <div className="text-[12.5px] space-y-1">
        {known.map((r, i) => (
          <p key={r.code} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-gray-700">{r.name} ({r.code})</span>
            <span className="text-gray-500">{fmtMoney(r.stockValue as number)}</span>
            <span className="text-gray-400">{total ? `${(((r.stockValue as number) / total) * 100).toFixed(1)}%` : ''}</span>
          </p>
        ))}
        {zero.map((r) => (
          <p key={r.code} className="text-gray-400">▫️ {r.name} ({r.code}) — 0 บาท (ท่อส่งเลขมาจริงว่าเป็นศูนย์)</p>
        ))}
        {unknown.map((r) => (
          <p key={r.code} className="text-amber-800">⚠️ {r.name} ({r.code}) — <b>ยังไม่รู้มูลค่า</b> (ท่อไม่ส่งตัวเลขของคลังนี้มา) </p>
        ))}
        {known.length === 0 && (
          <p className="text-amber-800">⚠️ ยังไม่มีคลังไหนที่รู้มูลค่า ⇒ วงกลมว่างไว้ <b>ไม่ใช่ว่าไม่มีของ</b></p>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [today, setToday] = useState<OrdersResp | null>(null)
  const [week, setWeek] = useState<OrdersResp | null>(null)
  const [stock, setStock] = useState<StockResp | null>(null)
  const [recent, setRecent] = useState<CoreOrderRow[]>([])
  /* ⚠️ **สองการ์ดของ ZORT ที่เคยเขียนว่า "ยังไม่มีข้อมูล" — ตอนนี้มีแล้ว** (4 ก.ย. 2569)
     ท่อเปิด `/api/core?pending=1` แยกใบค้างเป็น 3 กอง โดยตัดสินจากข้อมูล
     (ช่องทางมีใบใหม่ล่าสุดเมื่อไหร่) ไม่ใช่จากชื่อช่องทาง
     ⚠️ **กอง "ใบผี" ยังเชื่อไม่ได้ ฝั่งท่อประกาศเอง** — เกณฑ์ "เงียบ 30 วัน" ตัดสิน
        "ร้านปิดถาวร" ไม่ได้จริง (ช่องทางที่แค่ขายไม่ดี 2 เดือนจะถูกเหมารวม)
        ⇒ **จอไม่โชว์กองนั้น** จนกว่าเจ้าของร้านจะประกาศรายชื่อช่องทางที่ปิดแล้วเอง */
  const [pending, setPending] = useState<PendingResp | null>(null)
  /* 📊 ของใหม่สำหรับผังเมนู 1 ให้เหมือน ZORT (สเปก ~/claude-shared/สเปก-เมนู1-ภาพรวม.md · 15 ก.ย. 2569)
     🔴 กติกาของใบนี้: **UI ก่อน · ตัวเลขดึงไม่ได้ต้องคงสามสถานะ ห้ามใส่ 0 หรือเลขปลอมให้จอดูเต็ม**
        ⇒ ทุกก้อนข้างล่างเป็น `null` เมื่อ "ยังไม่รู้" และจอต้องเขียนว่ายังดึงไม่ได้ */
  const [months, setMonths] = useState<{ ym: string; orders: number; sales: number }[] | null>(null)
  const [monthsErr, setMonthsErr] = useState('')
  const [whs, setWhs] = useState<{ code: string; name: string; stockValue: number | null }[] | null>(null)
  const [whErr, setWhErr] = useState('')
  const [movers, setMovers] = useState<{ sku: string; name: string; qty: number; amount: number }[] | null>(null)
  /* 🏆 หมวดหมู่ขายดีปีนี้ — ท่อรวมให้ฝั่งเซิร์ฟเวอร์ (gucut-web b0a4aa3 · `by=category`)
     🔴 **ห้ามรวมเองจากรายการรายสินค้า** เพราะรายการนั้นถูกตัดที่ limit ⇒ หางหายแล้วอันดับเพี้ยน
        (ฝั่งท่อกำชับข้อนี้ตรง ๆ) ⇒ จอต้องยิง `by=category` เท่านั้น และเช็ค `applied.by` ก่อนใช้ */
  const [cats, setCats] = useState<{ category: string; qty: number; amount: number; skus: number; orders: number }[] | null>(null)
  const [catsErr, setCatsErr] = useState('')
  const [moversErr, setMoversErr] = useState('')
  /** จำนวนวันของการ์ด "สินค้าเคลื่อนไหว" — ZORT มี dropdown ตรงนี้ */
  const [moverDays, setMoverDays] = useState(7)
  /** กราฟยอดขายรวม: ชนิด + หน้าต่าง 4 เดือนที่กำลังดู (0 = ล่าสุด · เพิ่มขึ้น = ถอยหลัง) */
  const [trendKind, setTrendKind] = useState<'line' | 'bar'>('line')
  const [trendBack, setTrendBack] = useState(0)
  const [returns, setReturns] = useState<{ total: number; amount: number } | null>(null)
  const [factory, setFactory] = useState({ production: 0, pending: 0 })
  const [coreError, setCoreError] = useState('')
  const [sideNote, setSideNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshed, setRefreshed] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setCoreError('')
    setSideNote('')

    const d0 = thaiDay(0)
    const [tRes, wRes, sRes, rRes, retRes, sheetRes, pendRes, mRes, whRes, movRes, catRes] = await Promise.allSettled([
      getJson(`/api/web/core?list=orders&from=${d0}&to=${d0}&limit=1`),
      getJson(`/api/web/core?list=orders&from=${thaiDay(6)}&to=${d0}&limit=1`),
      getJson(`/api/web/core?list=stock&limit=1`),
      getJson(`/api/web/core?list=orders&from=${thaiDay(30)}&to=${d0}&limit=6`),
      getJson('/api/returns?days=30'),
      getJson('/api/sheets'),
      getJson('/api/web/core?pending=1'),
      /* 24 เดือน — พอสำหรับทั้ง "ยอดปีนี้" และ "เทียบกับปีที่แล้วช่วงเดียวกัน (YTD)" */
      getJson('/api/web/core?monthly=1&months=24'),
      getJson('/api/web/core?list=warehouses'),
      getJson(`/api/web/core?list=topproducts&from=${thaiDay(moverDays - 1)}&to=${d0}&limit=10`),
      /* ยอดตามหมวดของ **ปีนี้** (1 ม.ค. → วันนี้) — ใช้กับการ์ด "หมวดหมู่ขายดีปีนี้" */
      getJson(`/api/web/core?list=topproducts&from=${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 4)}-01-01&to=${d0}&by=category&limit=100`),
    ])

    if (tRes.status === 'fulfilled') setToday(tRes.value)
    if (wRes.status === 'fulfilled') setWeek(wRes.value)
    if (sRes.status === 'fulfilled') setStock(sRes.value)
    if (rRes.status === 'fulfilled') setRecent(Array.isArray(rRes.value?.rows) ? rRes.value.rows : [])
    // พังไม่ควรทำให้ทั้งหน้าแดง — สองการ์ดนั้นกลับไปเขียนว่า "ยังไม่มีข้อมูล" ตามเดิม
    setPending(pendRes.status === 'fulfilled' ? (pendRes.value as PendingResp) : null)

    // ตัวเลขหลักดึงไม่ได้ = ต้องขึ้นแดง ห้ามปล่อยให้เห็นเลข 0 เฉย ๆ
    const coreFails = [tRes, wRes, sRes, rRes].filter((x) => x.status === 'rejected')
    if (coreFails.length) {
      const first = coreFails[0] as PromiseRejectedResult
      setCoreError(String(first.reason?.message ?? first.reason))
    }

    /* 🔴 แต่ละก้อนล้มแยกกันได้ ⇒ เก็บเหตุผลของตัวเอง **ห้ามให้ก้อนหนึ่งล้มแล้วอีกก้อนเขียนว่า 0** */
    if (mRes.status === 'fulfilled' && Array.isArray(mRes.value?.months)) {
      setMonths(mRes.value.months as { ym: string; orders: number; sales: number }[]); setMonthsErr('')
    } else {
      setMonths(null)
      setMonthsErr(mRes.status === 'rejected' ? String((mRes.reason as Error)?.message ?? mRes.reason) : 'ท่อตอบมาไม่ครบ (ไม่มีรายเดือน)')
    }
    if (whRes.status === 'fulfilled' && Array.isArray(whRes.value?.warehouses)) {
      setWhs(whRes.value.warehouses as { code: string; name: string; stockValue: number | null }[]); setWhErr('')
    } else {
      setWhs(null)
      setWhErr(whRes.status === 'rejected' ? String((whRes.reason as Error)?.message ?? whRes.reason) : 'ท่อตอบมาไม่ครบ (ไม่มีรายชื่อคลัง)')
    }
    if (movRes.status === 'fulfilled' && Array.isArray(movRes.value?.items)) {
      setMovers(movRes.value.items as { sku: string; name: string; qty: number; amount: number }[]); setMoversErr('')
    } else {
      setMovers(null)
      setMoversErr(movRes.status === 'rejected' ? String((movRes.reason as Error)?.message ?? movRes.reason) : 'ท่อตอบมาไม่ครบ (ไม่มีรายการสินค้า)')
    }

    /* 🔴 **ด่าน `applied.by`** — ถ้าท่อไม่ได้รวมตามหมวดให้จริง (รุ่นเก่า/พารามิเตอร์ตก)
       ต้องถือว่า "ยังไม่รู้" ไม่ใช่เอา items ที่เป็นรายสินค้ามาโชว์เป็นหมวด */
    if (catRes.status === 'fulfilled' && catRes.value?.applied?.by === 'category' && Array.isArray(catRes.value?.items)) {
      setCats(catRes.value.items as { category: string; qty: number; amount: number; skus: number; orders: number }[])
      setCatsErr('')
    } else {
      setCats(null)
      setCatsErr(catRes.status === 'rejected'
        ? String((catRes.reason as Error)?.message ?? catRes.reason)
        : 'ท่อไม่ได้รวมตามหมวดให้ (applied.by ไม่ใช่ category)')
    }

    if (retRes.status === 'fulfilled') {
      setReturns({ total: Number(retRes.value?.total ?? 0), amount: Number(retRes.value?.amount ?? 0) })
    } else {
      setReturns(null)
    }
    if (sheetRes.status === 'fulfilled' && Array.isArray(sheetRes.value?.orders)) {
      const orders = sheetRes.value.orders as Array<{ status: string }>
      setFactory({
        production: orders.filter((o) => o.status === 'production').length,
        pending: orders.filter((o) => o.status === 'pending' || o.status === 'deposit').length,
      })
    }
    // สองใบนี้พังไม่ควรทำให้ทั้งหน้าแดง แต่ต้องบอกว่าใบไหนไม่มีข้อมูล
    const side = [
      retRes.status === 'rejected' ? 'สินค้าตีกลับ' : '',
      sheetRes.status === 'rejected' ? 'การสั่งของกับโรงงาน' : '',
    ].filter(Boolean)
    if (side.length) setSideNote(`ดึงไม่ได้ตอนนี้: ${side.join(' · ')}`)

    setLoading(false)
    setRefreshed(new Date())
  }, [moverDays])

  useEffect(() => { load() }, [load])

  /* ── ค่าที่คิดจากยอดรายเดือน — **ไม่รู้ต้องเป็น null ไม่ใช่ 0** ──────────────
     🔴 ทั้งสามค่านี้คิดจากก้อนเดียว (`monthly=1`) ⇒ ถ้าก้อนนั้นดึงไม่ได้ ทุกค่าต้องเป็น "ยังไม่รู้" พร้อมกัน
        ห้ามให้ค่าใดค่าหนึ่งกลายเป็น 0 เพราะ 0 แปลว่า "ขายไม่ได้เลย" ซึ่งคนละเรื่องกับ "ยังไม่รู้" */
  const nowTh = new Date(Date.now() + 7 * 3600e3)
  const thisYm = `${nowTh.getUTCFullYear()}-${String(nowTh.getUTCMonth() + 1).padStart(2, '0')}`
  const TH_M = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  /* ป้ายเดือนแบบ ZORT: "(ก.ย./2569)" — ปีเป็น พ.ศ. */
  const thisMonthLabel = `(${TH_M[nowTh.getUTCMonth() + 1]}/${nowTh.getUTCFullYear() + 543})`
  const monthSales = months ? (months.find((m) => m.ym === thisYm)?.sales ?? 0) : null
  const thisYear = String(nowTh.getUTCFullYear())
  const yearSales = months
    ? months.filter((m) => m.ym.startsWith(thisYear)).reduce((a, m) => a + (Number(m.sales) || 0), 0)
    : null
  /* YTD: ปีนี้ตั้งแต่ ม.ค. ถึงเดือนนี้ เทียบกับ **ช่วงเดือนเดียวกันของปีที่แล้ว**
     ⚠️ ถ้ากระจกยังไม่มีเดือนของปีที่แล้วครบช่วงนั้น ⇒ คืน null ("ยังเทียบไม่ได้") ไม่ใช่ 0% */
  const ytd = (() => {
    if (!months) return null
    const lastYear = String(nowTh.getUTCFullYear() - 1)
    const upto = nowTh.getUTCMonth() + 1
    const inRange = (ym: string, y: string) => ym.startsWith(y) && Number(ym.slice(5, 7)) <= upto
    const prevMonths = months.filter((m) => inRange(m.ym, lastYear))
    if (prevMonths.length < upto) return null
    const prev = prevMonths.reduce((a, m) => a + (Number(m.sales) || 0), 0)
    if (!prev) return null
    const cur = months.filter((m) => inRange(m.ym, thisYear)).reduce((a, m) => a + (Number(m.sales) || 0), 0)
    return ((cur - prev) / prev) * 100
  })()
  /** หมวดที่ขายดีที่สุดปีนี้ — ท่อเรียงตาม amount มาให้แล้ว แต่ **ไม่พึ่งลำดับของท่อ** หาเองอีกชั้น
   *  (ถ้าวันหนึ่งท่อเปลี่ยนการเรียง การ์ดนี้จะยังถูก) */
  const topCat = cats && cats.length
    ? cats.reduce((a, b) => ((Number(b.amount) || 0) > (Number(a.amount) || 0) ? b : a))
    : null

  /* หน้าต่างกราฟ 4 เดือนแบบ ZORT · เรียงเก่า→ใหม่ · `trendBack` = ถอยไปกี่ชุด */
  const trendWindow = (() => {
    if (!months || months.length === 0) return [] as { ym: string; sales: number }[]
    const asc = [...months].sort((a, b) => a.ym.localeCompare(b.ym))
    const end = Math.max(4, asc.length - trendBack * 4)
    return asc.slice(Math.max(0, end - 4), end)
  })()

  const skip = today?.skip || week?.skip || stock?.skip
  /** ชื่อร้านที่มีบิลในช่วงที่ดึงมา — อ่านจากท่อ ไม่นับเอง ไม่เขียนตายตัว */
  const storeNames = (() => {
    const list = week?.stores ?? today?.stores ?? []
    if (!Array.isArray(list) || list.length === 0) return ''
    return `${list.length} ร้าน (${list.map((s2) => s2.name || s2.source).join(' · ')})`
  })()

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="ภาพรวมร้าน"
        summary={
          <span suppressHydrationWarning>
            {/* 🔴 **ห้ามเขียนจำนวนร้านตายตัว** — ท่อส่งรายชื่อร้านที่มีบิลจริงในช่วงนั้นมาให้
                วันที่มีร้านที่สาม ป้ายนี้เปลี่ยนตามเอง · และช่วงที่ร้านไหนไม่มีบิล ก็จะไม่ถูกนับ
                (เดิมเขียนว่า "รวมทั้ง 2 ร้าน" ซึ่งถูกวันนี้ แต่เป็นข้อความที่จะโกหกวันหนึ่ง) */}
            ตัวเลขจากคลังของเราเอง (ไม่ได้ยิง ZORT)
            {storeNames && <> · <b>รวม {storeNames}</b></>}
            {' · '}อัพเดต {refreshed.toLocaleTimeString('th-TH')}
          </span>
        }
        actions={
          <BtnGhost onClick={load} disabled={loading}>
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </BtnGhost>
        }
      />

      {loading && <LoadingState />}

      {coreError && (
        <ErrorBox title="ดึงตัวเลขจากคลังของเราไม่ได้">
          {coreError}
          <span className="block mt-1 text-[12px]">
            ตัวเลขด้านล่างจึงยังไม่ใช่ของจริง — อย่าเพิ่งเอาไปตัดสินใจ
          </span>
        </ErrorBox>
      )}
      {!coreError && skip && (
        <Card><p className="text-[13px] text-gray-500">⏳ {skip}</p></Card>
      )}
      {sideNote && (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          ⚠️ {sideNote}
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ผังเมนู 1 "ภาพรวม" — **เรียงตาม ZORT ทุกแถว** (สเปก ~/claude-shared/สเปก-เมนู1-ภาพรวม.md)
            แถว 1: ยอดขายวันนี้ · ยอดขายเดือนนี้ · ยอดขายรวมทั้งปี
            แถว 2: หมวดหมู่ขายดีปีนี้ · เปรียบเทียบยอดขาย YTD
            แถว 3: กราฟยอดขายรวม · กราฟวงกลมมูลค่าคงเหลือรายคลัง
            แถว 4: สินค้าเคลื่อนไหวย้อนหลัง N วัน
          ⚠️ ของเดิมที่ ZORT ไม่มี **ไม่ได้ลบ** — ย้ายลงใต้ผังนี้ทั้งหมด (กฎในใบ)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ZortBigCard
          icon="🛒" label="ยอดขายวันนี้ (บาท)"
          value={coreError ? undefined : fmtMoney(today?.totalPaidAmount ?? today?.totalAmount)}
          unknown={coreError ? 'ดึงยอดวันนี้ไม่ได้ — ยังไม่รู้ว่าวันนี้ขายได้เท่าไหร่' : undefined}
        />
        <ZortBigCard
          icon="📅" label={`ยอดขายเดือนนี้ ${thisMonthLabel} (บาท)`}
          value={monthSales !== null ? fmtMoney(monthSales) : undefined}
          unknown={monthSales === null ? `ยังดึงยอดรายเดือนไม่ได้${monthsErr ? ` (${monthsErr})` : ''}` : undefined}
        />
        <ZortBigCard
          icon="📈" label="ยอดขายรวมทั้งปี (บาท)"
          value={yearSales !== null ? fmtMoney(yearSales) : undefined}
          unknown={yearSales === null ? `ยังดึงยอดรายเดือนไม่ได้${monthsErr ? ` (${monthsErr})` : ''}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 🔴 หมวดหมู่ขายดี — **ยังทำไม่ได้จริง** ไม่ใช่แค่ยังไม่ได้ทำจอ
            ยิงตรวจเอง 15 ก.ย. 2569: `list=topproducts` ส่งมาแค่ sku · name · qty · amount
            และ `list=stock` ก็ไม่ส่งหมวดหมู่รายตัว (กรองด้วย `category=` ได้ แต่ไม่คืนค่ามา)
            ⇒ เขียนว่ารออะไรอยู่ **ห้ามเดาหมวดจากชื่อสินค้า** (เดาแล้วจะดูน่าเชื่อและผิดเงียบ ๆ) */}
        {/* 🏆 หมวดหมู่ขายดีปีนี้ — ท่อรวมมาให้แล้ว (b0a4aa3) ⇒ การ์ดนี้ขึ้นของจริงแล้ว
               ⚠️ กองที่ยังไม่จัดหมวดของ ZORT ก็เป็นหมวดหนึ่งเหมือนกัน **โชว์ตามจริง ห้ามซ่อน**
                  (ฝั่งท่อกำชับ · ของจริงมันติดอันดับ 4 ด้วยซ้ำ) */}
        <ZortBigCard
          icon="🏆" label="หมวดหมู่ขายดีปีนี้"
          value={topCat ? topCat.category : undefined}
          unknown={topCat ? undefined : (cats ? 'ปีนี้ยังไม่มียอดขายให้จัดอันดับ' : `ยังดึงยอดตามหมวดไม่ได้${catsErr ? ` (${catsErr})` : ''}`)}
        />
        <ZortBigCard
          icon="🔁" label="เปรียบเทียบยอดขาย ตั้งแต่ต้นปี (YTD)"
          value={ytd !== null ? `${ytd > 0 ? '+' : ''}${ytd.toFixed(2)}%` : undefined}
          tone={ytd !== null ? (ytd < 0 ? 'red' : 'green') : undefined}
          unknown={ytd === null
            ? (months ? 'ยังเทียบไม่ได้ — กระจกยังไม่มีเดือนเดียวกันของปีที่แล้วครบ' : 'ยังดึงยอดรายเดือนไม่ได้')
            : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">📈</span>
              ยอดขายรวม
            </p>
            <select className="text-[12.5px] border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
              value="total" onChange={() => { /* มีชนิดเดียวที่ทำได้จริง */ }}
              title="ZORT เลือกชุดข้อมูลได้หลายแบบ ของเรามีแบบเดียว">
              <option value="total">ยอดขายรวม</option>
              {/* ท่อรวมตามหมวดได้แล้ว (b0a4aa3) — ที่ขาดคือกราฟรายหมวดบนจอ ⇒ เขียนตามจริง */}
              <option value="cat" disabled>ตามหมวดหมู่ (ท่อพร้อมแล้ว · จอยังไม่ได้ทำ)</option>
            </select>
          </div>
          {/* 🔴 ไม่มีข้อมูล ⇒ **วาดกรอบไว้** พร้อมข้อความ ห้ามซ่อนกราฟ (กติกาในใบ) */}
          {trendWindow.length > 0
            ? <MonthTrend data={trendWindow} kind={trendKind} />
            : (
              <div className="h-[170px] border border-dashed border-gray-300 rounded-md flex items-center justify-center text-center px-4">
                <p className="text-[12.5px] text-amber-800">
                  ⚠️ <b>ยังดึงข้อมูลกราฟไม่ได้</b>{monthsErr ? ` — ${monthsErr}` : ''}
                  <br /><span className="text-gray-500">กรอบนี้ค้างไว้ให้เห็นว่ากราฟอยู่ตรงนี้ ไม่ได้หายไป</span>
                </p>
              </div>
            )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-1">
              {([['line', '📈'], ['bar', '📊']] as const).map(([k, icon]) => (
                <button key={k} type="button" onClick={() => setTrendKind(k)} aria-pressed={trendKind === k}
                  className={`text-[13px] w-7 h-7 rounded border ${
                    trendKind === k ? 'bg-violet-50 border-violet-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                  {icon}
                </button>
              ))}
            </div>
            {/* ปุ่ม ‹ › เลื่อนช่วง 4 เดือน — ปิดปุ่มเมื่อเลื่อนต่อไม่ได้ ไม่ใช่กดแล้วเงียบ */}
            <div className="flex items-center gap-1 text-[12.5px] text-gray-600">
              <button type="button" onClick={() => setTrendBack((v) => v + 1)}
                disabled={!months || (trendBack + 1) * 4 >= months.length}
                className="w-7 h-7 rounded border border-gray-300 bg-white disabled:opacity-40">‹</button>
              <span>{trendWindow.length ? `${trendWindow[0].ym} – ${trendWindow[trendWindow.length - 1].ym}` : '—'}</span>
              <button type="button" onClick={() => setTrendBack((v) => Math.max(0, v - 1))}
                disabled={trendBack === 0}
                className="w-7 h-7 rounded border border-gray-300 bg-white disabled:opacity-40">›</button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">📦</span>
              มูลค่าสินค้าคงเหลือรายคลัง
            </p>
            <select className="text-[12.5px] border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
              value="wh" onChange={() => { /* มีแบบเดียวที่ทำได้จริง */ }}
              title="ZORT เลือกได้หลายแบบ ของเรามีรายคลังแบบเดียว">
              <option value="wh">รายคลัง</option>
              <option value="cat" disabled>รายหมวดหมู่ (ยังไม่มี)</option>
            </select>
          </div>
          {whs
            ? <WarehousePie rows={whs} />
            : (
              <div className="h-[140px] border border-dashed border-gray-300 rounded-md flex items-center justify-center text-center px-4">
                <p className="text-[12.5px] text-amber-800">
                  ⚠️ <b>ยังดึงมูลค่าคงเหลือรายคลังไม่ได้</b>{whErr ? ` — ${whErr}` : ''}
                </p>
              </div>
            )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 pt-4">
          <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2 mr-auto">
            <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">📊</span>
            สินค้าเคลื่อนไหวย้อนหลัง {moverDays} วัน
          </p>
          <select
            value={moverDays}
            onChange={(e) => setMoverDays(Number(e.target.value))}
            className="text-[12.5px] border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
          >
            {[7, 15, 30].map((d) => <option key={d} value={d}>{d} วัน</option>)}
          </select>
        </div>
        {/* ⚠️ "เคลื่อนไหว" ของจอนี้ = **ขายออก** เท่านั้น (มาจากยอดขายรายสินค้า)
               ยังไม่รวมรับเข้า/ปรับ ⇒ เขียนไว้ ไม่ให้คนอ่านเหมาว่าเป็นทุกความเคลื่อนไหว */}
        <p className="text-[11.5px] text-gray-400 px-4 md:px-5 pt-1">
          นับจาก<b>ยอดขายรายสินค้า</b>ในช่วงที่เลือก — ยังไม่รวมรับเข้า/ปรับยอด
        </p>
        <div className="px-4 md:px-5 pb-4 pt-2">
          {moversErr && !movers && (
            <p className="text-[12.5px] text-amber-800">⚠️ <b>ยังดึงข้อมูลไม่ได้</b> — {moversErr}</p>
          )}
          {movers && movers.length === 0 && (
            <p className="text-[12.5px] text-gray-500">ช่วง {moverDays} วันนี้ยังไม่มีสินค้าที่ขายออก</p>
          )}
          {movers && movers.length > 0 && (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left font-medium py-1.5">รหัสสินค้า</th>
                  <th className="text-left font-medium">สินค้า</th>
                  <th className="text-right font-medium">จำนวน</th>
                  <th className="text-right font-medium">ยอดขาย (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {movers.map((m) => (
                  <tr key={m.sku} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-blue-600 whitespace-nowrap">{m.sku}</td>
                    <td className="text-gray-700">{m.name}</td>
                    <td className="text-right text-gray-700">{fmtNum(m.qty)}</td>
                    <td className="text-right text-gray-700">{fmtMoney(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ══ ใต้เส้นนี้คือของที่ **เรามีเกิน ZORT** — ย้ายลงมาทั้งก้อน ไม่ได้ลบ (กฎในใบ) ══ */}
      <p className="text-[12.5px] text-gray-400 border-t border-gray-200 pt-3">
        ⬇️ ส่วนล่างนี้เป็นของที่ <b>ZORT ไม่มีในหน้านี้</b> — ของเราเพิ่มเอง เก็บไว้ท้ายหน้าเพื่อให้ผังข้างบนเทียบกับ ZORT ได้ตรง ๆ
      </p>

      {/* ── ส่วน "ทางลัดของคุณ" — ชื่อและลำดับตาม ZORT ── */}
      <div>
        <p className="text-[15px] font-semibold text-gray-800 mb-2.5">ทางลัดของคุณ</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Shortcut href="/core/reports" icon="📊" label="ดูรายงาน" />
          <Shortcut href="/core/sales" icon="🧾" label="ดูรายการขาย" />
          <Shortcut href="/core/pos" icon="🖥️" label="สร้างรายการขาย" />
          <Shortcut href="/core/branches" icon="🏬" label="คลังสินค้า/สาขา" />
          <Shortcut href="/core/stock" icon="📦" label="ดูสินค้า" />
          {/* ✅ จอขนส่งมีจริงแล้ว (/core/logistics · เทียบภาพ 52 ผ่าน 6 ก.ย.) — เลิกชี้ไปหน้า soon
              ⚠️ ทางลัดที่ชี้หน้า "ยังไม่ได้ทำ" ทั้งที่ของจริงมีแล้ว แย่พอ ๆ กับปุ่มหลอก:
                 คนกดเจอป้ายว่ายังไม่มี แล้วเลิกหา ทั้งที่จอจริงอยู่ในเมนูมาตลอด */}
          <Shortcut href="/core/logistics" icon="🚚" label="ดูบริการขนส่ง" />
        </div>
      </div>

      {/* ── ตัวเลขเพิ่มเติมของเราเอง (ZORT ไม่มีในหน้านี้) ── */}
      <p className="text-[15px] font-semibold text-gray-800 pt-1">ตัวเลขเพิ่มเติม</p>
      {/* 🔴 ย้ายมาจากแถวบน 15 ก.ย. 2569 — **ZORT ไม่มีสองใบนี้ในหน้าภาพรวม**
             เก็บไว้เพราะร้านใช้จริง (ตามจ่าย/ตามส่ง) แต่ไม่ให้ไปปนกับผังของ ZORT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ZortStat
            icon="💲" bg="#FDECEC" fg="#dc2626"
            label="รายการขาย ค้างชำระเงิน"
            value={pending?.counts?.['รอจ่ายอยู่'] === undefined
              ? 'ยังไม่มีข้อมูล'
              : `${fmtNum(pending.counts['รอจ่ายอยู่'])} ใบ`}
            note={pending?.amounts?.['รอจ่ายอยู่'] === undefined
              ? 'ดึงจากคลังเงาไม่ได้รอบนี้'
              : `${fmtMoney(pending.amounts['รอจ่ายอยู่'])} · นิยามของเรา ยังไม่ได้เทียบใบต่อใบกับการ์ด ZORT`}
          />
          <ZortStat
            icon="🎒" bg="#E6F7EF" fg="#059669"
            label="รายการขาย ค้างโอนสินค้า"
            value={pending?.counts?.['ต้องส่งของ'] === undefined
              ? 'ยังไม่มีข้อมูล'
              : `${fmtNum(pending.counts['ต้องส่งของ'])} ใบ`}
            note={pending?.amounts?.['ต้องส่งของ'] === undefined
              ? 'ดึงจากคลังเงาไม่ได้รอบนี้'
              : `${fmtMoney(pending.amounts['ต้องส่งของ'])} · จ่ายแล้วรอเราส่ง`}
          />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon="📦" tone="blue" label="ออเดอร์วันนี้"
          value={coreError ? '—' : fmtNum(today?.total)} unit="ใบ"
        />
        <StatCard
          icon="💰" tone="green" label="ยอดขาย (7 วัน)"
          value={coreError ? '—' : fmtMoney(week?.totalPaidAmount ?? week?.totalAmount)}
          note={!coreError && week
            ? typeof week.totalPaidAmount === 'number'
              ? `${fmtNum(week.total)} ใบ · เฉพาะที่จ่ายแล้ว`
                + (week.totalUnpaidAmount ? ` · ยังไม่จ่าย ${fmtMoney(week.totalUnpaidAmount)}` : '')
              : `${fmtNum(week.total)} ใบ · รวมใบที่ยังไม่จ่าย`
            : undefined}
        />
        <StatCard
          icon="🛍" tone="purple" label="SKU ในคลัง"
          value={coreError ? '—' : fmtNum(stock?.total ?? 0)} unit="ตัว"
          note={!coreError && stock ? `ของหมด ${fmtNum(stock.outOfStock)} · เหลือน้อย ${fmtNum(stock.low)}` : undefined}
          noteTone={stock && stock.outOfStock > 0 ? 'red' : 'gray'}
        />
        <StatCard
          icon="↩️" tone="orange" label="สินค้าตีกลับ (30 วัน)"
          value={returns ? fmtNum(returns.total) : '—'} unit="รายการ"
          note={returns && returns.total > 0 ? `มูลค่า ${fmtMoney(returns.amount)}` : undefined}
          noteTone="red"
        />
      </div>

      {/* ── แถวล่าง: โรงงาน + ออเดอร์ล่าสุด ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] md:text-[13px] font-semibold text-gray-600">🏭 การสั่งของกับโรงงาน</p>
            <Link href="/factory" className="text-[11px] text-blue-600 font-medium hover:text-blue-700">ดูทั้งหมด →</Link>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-black text-orange-500 tracking-tight">{factory.pending}</p>
              <p className="text-[11px] text-gray-400">ยังไม่มัดจำ</p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-600 tracking-tight">{factory.production}</p>
              <p className="text-[11px] text-gray-400">กำลังผลิต</p>
            </div>
          </div>
        </Card>

        <Card padded={false} className="xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-gray-100">
            <p className="text-[13px] font-semibold text-gray-700">📋 ออเดอร์ล่าสุด</p>
            <Link href="/core/sales" className="text-[11px] text-blue-600 font-medium hover:text-blue-700">ดูทั้งหมด →</Link>
          </div>
          {!loading && recent.length === 0 && (
            <p className="text-[13px] text-gray-400 px-4 py-4">
              {coreError ? 'ดึงข้อมูลไม่ได้' : 'ยังไม่มีออเดอร์ใน 30 วันล่าสุด'}
            </p>
          )}
          {recent.map((o) => (
            <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
              <div className="flex items-start justify-between gap-2">
                {/* สีฟ้า = สัญญาว่ากดได้ (กวาดคลาส 8 ก.ย. 2569) — เข้าใบจริงได้เลย */}
                <Link href={`/core/sales/detail?id=${encodeURIComponent(o.id)}`}
                  className="text-[13px] font-semibold text-blue-600 truncate hover:underline">#{o.number}</Link>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                  {o.channel || 'ไม่ระบุ'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[12px] text-gray-500 truncate">
                  {thaiDate(o.order_date)} · {o.customer || 'ไม่ระบุชื่อ'}
                </span>
                <span className="text-[13px] font-bold text-gray-900 shrink-0">{fmtMoney(o.amount)}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
