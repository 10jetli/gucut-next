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
import { fmtBaht, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { PageHead, BtnGhost, thaiDate } from '@/components/zort'

interface CoreOrderRow {
  id: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
}
interface OrdersResp { skip?: string; total: number; totalAmount: number; rows: CoreOrderRow[] }
interface StockResp { skip?: string; total: number; outOfStock: number; low: number }

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

export default function DashboardPage() {
  const [today, setToday] = useState<OrdersResp | null>(null)
  const [week, setWeek] = useState<OrdersResp | null>(null)
  const [stock, setStock] = useState<StockResp | null>(null)
  const [recent, setRecent] = useState<CoreOrderRow[]>([])
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
    const [tRes, wRes, sRes, rRes, retRes, sheetRes] = await Promise.allSettled([
      getJson(`/api/web/core?list=orders&from=${d0}&to=${d0}&limit=1`),
      getJson(`/api/web/core?list=orders&from=${thaiDay(6)}&to=${d0}&limit=1`),
      getJson(`/api/web/core?list=stock&limit=1`),
      getJson(`/api/web/core?list=orders&from=${thaiDay(30)}&to=${d0}&limit=6`),
      getJson('/api/returns?days=30'),
      getJson('/api/sheets'),
    ])

    if (tRes.status === 'fulfilled') setToday(tRes.value)
    if (wRes.status === 'fulfilled') setWeek(wRes.value)
    if (sRes.status === 'fulfilled') setStock(sRes.value)
    if (rRes.status === 'fulfilled') setRecent(Array.isArray(rRes.value?.rows) ? rRes.value.rows : [])

    // ตัวเลขหลักดึงไม่ได้ = ต้องขึ้นแดง ห้ามปล่อยให้เห็นเลข 0 เฉย ๆ
    const coreFails = [tRes, wRes, sRes, rRes].filter((x) => x.status === 'rejected')
    if (coreFails.length) {
      const first = coreFails[0] as PromiseRejectedResult
      setCoreError(String(first.reason?.message ?? first.reason))
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
  }, [])

  useEffect(() => { load() }, [load])

  const skip = today?.skip || week?.skip || stock?.skip

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="ภาพรวมร้าน"
        summary={
          <span suppressHydrationWarning>
            ตัวเลขจากคลังของเราเอง (ไม่ได้ยิง ZORT) · อัพเดต {refreshed.toLocaleTimeString('th-TH')}
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

      {/* ── ส่วน "รายงาน" — ลอกจากแดชบอร์ดหน้าแรกของ ZORT ตรง ๆ ──
          ZORT วางไว้ 3 ใบเรียงกัน: ยอดขายวันนี้ · ค้างชำระเงิน · ค้างโอนสินค้า
          ⚠️ สองใบหลัง **เรายังไม่มีข้อมูล** — คลังเงาเก็บสถานะรวม (Success/Pending/…)
             ไม่ได้เก็บสถานะการชำระเงินกับสถานะการโอนสินค้าแยกกันแบบ ZORT
             ⇒ เขียนว่า "ยังไม่มีข้อมูล" **ห้ามเอาสถานะรวมมาเดาแทน** จะได้เลขที่ดูน่าเชื่อแต่ผิด
             (ฝั่งเซิร์ฟเวอร์ยืนยันแล้วว่าตาราง orders ไม่มีสองช่องนี้จริง ๆ) */}
      <div>
        <p className="text-[15px] font-semibold text-gray-800 mb-2.5">รายงาน</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ZortStat
            icon="🛒" bg="#E8F0FE" fg="#2563eb"
            label="ยอดขายวันนี้ (บาท)"
            value={coreError ? '—' : fmtBaht(today?.totalAmount ?? 0)}
            note={!coreError && today ? `${fmtNum(today.total)} ใบ` : undefined}
          />
          <ZortStat
            icon="💲" bg="#FDECEC" fg="#dc2626"
            label="รายการขาย ค้างชำระเงิน"
            value="ยังไม่มีข้อมูล"
            note="คลังเงายังไม่เก็บสถานะการชำระเงิน"
          />
          <ZortStat
            icon="🎒" bg="#E6F7EF" fg="#059669"
            label="รายการขาย ค้างโอนสินค้า"
            value="ยังไม่มีข้อมูล"
            note="คลังเงายังไม่เก็บสถานะการโอนสินค้า"
          />
        </div>
      </div>

      {/* ── ส่วน "ทางลัดของคุณ" — ชื่อและลำดับตาม ZORT ── */}
      <div>
        <p className="text-[15px] font-semibold text-gray-800 mb-2.5">ทางลัดของคุณ</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Shortcut href="/core/reports" icon="📊" label="ดูรายงาน" />
          <Shortcut href="/core/sales" icon="🧾" label="ดูรายการขาย" />
          <Shortcut href="/core/pos" icon="🖥️" label="สร้างรายการขาย" />
          <Shortcut href="/core/branches" icon="🏬" label="คลังสินค้า/สาขา" />
          <Shortcut href="/core/stock" icon="📦" label="ดูสินค้า" />
          {/* ZORT มีทางลัด "ดูบริการขนส่ง" — ของเรายังไม่ได้ทำ จึงจางและมีจุดกำกับ */}
          <Shortcut href="/core/soon/shipping" icon="🚚" label="ดูบริการขนส่ง" soon />
        </div>
      </div>

      {/* ── ตัวเลขเพิ่มเติมของเราเอง (ZORT ไม่มีในหน้านี้) ── */}
      <p className="text-[15px] font-semibold text-gray-800 pt-1">ตัวเลขเพิ่มเติม</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon="📦" tone="blue" label="ออเดอร์วันนี้"
          value={coreError ? '—' : fmtNum(today?.total ?? 0)} unit="ใบ"
        />
        <StatCard
          icon="💰" tone="green" label="ยอดขาย (7 วัน)"
          value={coreError ? '—' : fmtBaht(week?.totalAmount ?? 0)}
          note={!coreError && week ? `${fmtNum(week.total)} ใบ` : undefined}
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
          note={returns && returns.total > 0 ? `มูลค่า ${fmtBaht(returns.amount)}` : undefined}
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
                <span className="text-[13px] font-semibold text-blue-600 truncate">#{o.number}</span>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                  {o.channel || 'ไม่ระบุ'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[12px] text-gray-500 truncate">
                  {thaiDate(o.order_date)} · {o.customer || 'ไม่ระบุชื่อ'}
                </span>
                <span className="text-[13px] font-bold text-gray-900 shrink-0">{fmtBaht(o.amount)}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
