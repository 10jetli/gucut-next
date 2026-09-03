'use client'
// รายละเอียดสินค้า — **ลอกจาก `zort-ui/34-zort-รายละเอียดสินค้า.jpg`**
// ผัง ZORT: breadcrumb "‹ สินค้า" → หัวข้อ "รายละเอียดสินค้า <ชื่อเต็ม>" → Share Link มุมขวา
//   → ปุ่ม 7 ปุ่ม (แก้ไข · ลบ · คำสั่ง▾ · ปรับจำนวน · พิมพ์เอกสาร · อัพเดทช่องทางอื่น▾ · ดูกิจกรรม)
//   → การ์ด 3 ใบ (สินค้าคงเหลือ · สินค้าพร้อมขาย · ยอดขายเดือนนี้)
//   → กล่องข้อมูล: รูปซ้าย · ขวาสองคอลัมน์ (รหัสสินค้า · ต้นทุนคงเหลือเฉลี่ย · สินค้าในสินค้าเป็นชุด
//     | ราคาขาย · ราคาซื้อ)
//   → การ์ด "ยอดขาย" (กราฟ) · การ์ด "จำนวนสินค้าคงเหลือ รายคลัง" · การ์ด "รายงาน" (stock card)
//
// 🔴 **หน้านี้เกิดเพราะบั๊กที่เจ็บที่สุดของวัน: ชื่อสินค้าในตารางเป็นสีฟ้าแต่กดไม่ได้**
//    เจ้าของร้านกดจากมือถือ 5 จุดแล้วรายงานว่า "กดเข้าสินค้าไม่ได้เลย"
//    **สีฟ้าในตาราง = สัญญาว่ากดได้** — จอกำลังบอกว่ามีทั้งที่ไม่มี
//    ⇒ กลับด้านกับกรณี ZZFAKE999 ที่ซ่อนแล้วบอกว่าซ่อน · อันนี้โชว์ว่ากดได้ทั้งที่กดไม่ได้
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import { productMenuItems } from '@/lib/product-menu'
import {
  PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate, MarketLogos, RowMenu,
} from '@/components/zort'

interface Row {
  sku: string; name: string; qty: number; price: number; sold: number
  buy?: number | null; available?: number | null; unit?: string | null
  service?: boolean; active?: boolean | null; marketplaces?: string[]
}
interface Move {
  id?: number; sku: string; qty: number; reason: string; ref?: string; at?: string
}
interface MovesResp { rows?: Move[]; reasons?: Record<string, string>; total?: number }
/** ชุดที่มีรหัสนี้เป็นส่วนประกอบ — ถามด้วย `bundleitems&member=<รหัส>` */
interface InBundle { bundleSku: string; bundleName?: string; qty?: number }
interface MemberResp { applied?: { member?: string }; rows?: InBundle[]; collectedAt?: string }
/** ยอดขายรายเดือนของรหัสนี้ — ถามทีละเดือนด้วย `topproducts&sku=` */
interface MonthPoint { label: string; qty: number; amount: number }

/** เดือนไทยย่อ — ใช้เป็นป้ายแกนนอน */
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ⚠️ คลังเงามีประวัติใบขายย้อนถึงวันนี้เท่านั้น — กราฟจึงเริ่มจากตรงนี้ ไม่ใช่ "ตลอดกาล" */
const HISTORY_FROM = '2025-09-01'

/** กราฟแท่งยอดขายรายเดือน — SVG ล้วน ไม่พึ่งไลบรารี */
function SalesBars({ points, mode }: { points: MonthPoint[]; mode: 'amount' | 'qty' }) {
  const W = 720, H = 200, PAD = 10, BOTTOM = 26
  const vals = points.map((p) => (mode === 'amount' ? p.amount : p.qty))
  const max = Math.max(...vals, 1)
  const n = Math.max(points.length, 1)
  const bw = Math.min(46, ((W - PAD * 2) / n) * 0.6)
  const x = (i: number) => PAD + ((W - PAD * 2) * (i + 0.5)) / n
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="กราฟยอดขายรายเดือน">
      {points.map((p, i) => {
        const v = mode === 'amount' ? p.amount : p.qty
        const h = (v / max) * (H - BOTTOM - 22)
        return (
          <g key={p.label}>
            <rect x={x(i) - bw / 2} y={H - BOTTOM - h} width={bw} height={Math.max(h, 1)} rx={3}
              className="fill-[#7c9cf0]" />
            {v > 0 && (
              <text x={x(i)} y={H - BOTTOM - h - 5} textAnchor="middle" className="fill-gray-500 text-[9px]">
                {mode === 'amount'
                  ? (v >= 1000 ? `${Math.round(v / 1000)}K` : Math.round(v))
                  : Math.round(v)}
              </text>
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">{p.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams<{ sku: string }>()
  const sku = decodeURIComponent(String(params?.sku ?? ''))
  const [row, setRow] = useState<Row | null>(null)
  const [moves, setMoves] = useState<MovesResp | null>(null)
  const [movesErr, setMovesErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // ⚠️ กราฟต้องยิงเดือนละครั้ง (12 ครั้ง) ⇒ **ไม่โหลดเองตอนเปิดหน้า ต้องกดเอง**
  //    กติกาเจ้าของร้าน: จอที่ยิงหนักต้องกดเอง · และเปิดหน้าสินค้าบ่อยกว่าดูกราฟมาก
  const [chart, setChart] = useState<MonthPoint[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartErr, setChartErr] = useState('')
  const [chartMode, setChartMode] = useState<'amount' | 'qty'>('amount')
  const [moveFilter, setMoveFilter] = useState('')
  const [inBundles, setInBundles] = useState<MemberResp | null>(null)
  const [showAllBundles, setShowAllBundles] = useState(false)
  const imgOf = useSkuImages()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sRes, mRes, bRes] = await Promise.all([
        fetch(`/api/web/core?list=stock&q=${encodeURIComponent(sku)}&limit=20&marketplaces=1`).then((r) => r.json()),
        fetch(`/api/web/core?list=moves&sku=${encodeURIComponent(sku)}&limit=100`).then((r) => r.json()).catch(() => null),
        // "รหัสนี้อยู่ในชุดไหนบ้าง" — ถามกลับทางกับ list=bundleitems&sku=
        fetch(`/api/web/core?list=bundleitems&member=${encodeURIComponent(sku)}`).then((r) => r.json()).catch(() => null),
      ])
      if (sRes?.error) throw new Error(sRes.error)
      const rows: Row[] = Array.isArray(sRes?.rows) ? sRes.rows : []
      // ⚠️ ค้นหาคืนหลายแถว — ต้องหาแถวที่รหัสตรงเป๊ะ ไม่ใช่หยิบแถวแรก
      setRow(rows.find((r) => r.sku === sku) ?? null)
      setMoves(mRes && !mRes.error ? mRes : null)
      setMovesErr(!mRes ? 'ยิงไปที่ท่อความเคลื่อนไหวไม่สำเร็จ' : (typeof mRes.error === 'string' ? mRes.error : ''))
      // ⚠️ ด่านเดิม — เซิร์ฟเวอร์ต้องยืนยันว่าอ่าน member ที่เราส่งไปจริง
      //    ไม่ยืนยัน = ถือว่าไม่รู้ ห้ามแปลว่า "ไม่อยู่ในชุดไหนเลย"
      setInBundles(bRes?.applied?.member === sku ? bRes : null)
    } catch (e) {
      setRow(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])

  useEffect(() => { load() }, [load])

  /** ถามยอดขายรายเดือนของรหัสนี้ — **ยิงครั้งเดียว** ด้วย `by=month`
   *  (เดิมยิงเดือนละครั้ง 12 ครั้ง · ฝั่งเซิร์ฟเวอร์ทำโหมดนี้ให้ ⇒ ลดการเรียก 92%)
   *
   *  🔴 **ท่อส่งมาเฉพาะเดือนที่มียอดขาย — เดือนที่ขายไม่ได้เลย "หายไปทั้งแถว"**
   *     ของจริง: 00073 ไม่มีแถวเดือน 2026-05 เลย (ขายไม่ได้เลยเดือนนั้น)
   *     ⇒ ถ้าเอา items มาวาดเรียงกันตรง ๆ **แกนเวลาจะข้ามเดือนนั้นไปเงียบ ๆ**
   *       กราฟจะดูเหมือนขายต่อเนื่อง ทั้งที่มีเดือนที่ขายไม่ได้เลยคั่นอยู่
   *     ⇒ **สร้างช่องเดือนให้ครบก่อน แล้วค่อยเติมค่าที่ได้มา** ห้ามวาดจาก items ตรง ๆ */
  const loadChart = useCallback(async () => {
    setChartLoading(true)
    try {
      const now = new Date()
      const slots: MonthPoint[] = []
      const key: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (`${ym}-28` < HISTORY_FROM) continue
        key.push(ym)
        slots.push({ label: `${TH_MON[d.getMonth()]}/${String(d.getFullYear() + 543).slice(2)}`, qty: 0, amount: 0 })
      }
      const qs = new URLSearchParams({
        list: 'topproducts', sku, by: 'month',
        from: HISTORY_FROM, to: new Date().toISOString().slice(0, 10),
      })
      const j = await fetch(`/api/web/core?${qs}`).then((r) => r.json()).catch(() => null)
      // ⚠️ ด่านเดิม: เซิร์ฟเวอร์ต้องยืนยันว่ารับทั้ง sku และโหมด month ที่เราส่งไปจริง
      //    ไม่ตรง = ไม่วาดอะไรเลย ดีกว่าวาดยอดของสินค้าตัวอื่น/ช่วงเวลาอื่น
      if (j?.applied?.sku !== sku || j?.applied?.by !== 'month') {
        setChart(null)
        setChartErr('เซิร์ฟเวอร์ไม่ได้ตอบตามรหัส/โหมดที่ขอ — ไม่วาดกราฟดีกว่าวาดผิด')
        return
      }
      setChartErr('')
      for (const it of (Array.isArray(j.items) ? j.items : [])) {
        const i = key.indexOf(String(it.month))
        if (i >= 0) {
          slots[i].qty = Number(it.qty) || 0
          slots[i].amount = Number(it.amount) || 0
        }
      }
      setChart(slots)
    } finally {
      setChartLoading(false)
    }
  }, [sku])

  const img = imgOf(sku)
  const moveRows = (moves?.rows ?? []).filter((m) => !moveFilter || m.reason === moveFilter)

  return (
    <div className="p-4 md:p-6">
      <Link href="/core/stock" className="text-[12.5px] text-blue-600 hover:underline">‹ สินค้า</Link>

      {error && <ErrorBox title="ดึงข้อมูลสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !row && <LoadingState />}

      {!loading && !row && !error && (
        <div className="bg-white border border-gray-200 rounded-md p-6 mt-3 text-[13px] text-gray-500">
          ไม่พบรหัส <b>{sku}</b> ในคลังเงา — อาจเป็นสินค้าที่ <b>ไม่มีรหัสใน ZORT</b> (มี 226 ตัว
          ซึ่งเก็บเข้ากระจกไม่ได้เลย) หรือรหัสพิมพ์ผิด
        </div>
      )}

      {row && (
        <>
          <PageHead
            title={`รายละเอียดสินค้า ${row.name || sku}`}
            actions={
              <>
                {/* ZORT มี "Share Link" มุมขวาบน — ของเราคัดลอกลิงก์หน้านี้จริง ๆ
                    (ทำได้จริงเลยทำ · ต่างจากปุ่มอื่นที่ต้องรอท่อ) */}
                <BtnGhost onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => {}) }}>
                  คัดลอกลิงก์หน้านี้
                </BtnGhost>
                <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
              </>
            }
          />

          {/* ⚠️ ZORT มีปุ่ม 7 ปุ่มแถวนี้ — ของเราทำได้จริงเฉพาะที่มีท่อรองรับ
              ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก ⇒ ที่ยังไม่ได้ทำพาไปหน้าที่บอกตรง ๆ */}
          <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4">
            <Link href="/core/soon/product-edit"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              แก้ไข
            </Link>
            <Link href="/core/soon/product-delete"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              ลบ
            </Link>
            {/* 🔴 **ห้ามชี้ปุ่มนี้ไป /core/moves** — จอนี้เป็นกระจกของ ZORT
                สูตรเทียบสต็อกคือ (สต็อกเมื่อวาน − ที่ขายไป + stock_moves) − สต็อกวันนี้จาก ZORT
                ⇒ เขียนลง stock_moves โดยไม่ยิงกลับ ZORT = สูตรคิดว่ามีของเข้ามาเพิ่ม
                  แต่ ZORT ไม่รู้เรื่อง ⇒ **ตัวเทียบยอดจะขึ้นส่วนต่างทุกวันตลอดไป**
                  แล้วคนที่มาดูจะนึกว่ากระจกเพี้ยน ทั้งที่เป็นเพราะเรากดปุ่มเอง
                ⚠️ **เสียงเตือนปลอมทำให้คนเลิกเชื่อตัวเตือนทั้งระบบ** ซึ่งแพงกว่าปุ่มที่ใช้ไม่ได้มาก
                (stock_moves ไม่ได้ผิด — มันมีไว้สำหรับของที่เราเป็นเจ้าของเอง เช่น POS หน้าร้าน
                 หน้า /core/moves จึงยังใช้ได้ตามปกติ แค่ห้ามให้จอกระจกชี้ไปที่นั่น) */}
            <span
              title="ต้องปรับที่ ZORT ก่อน · ปรับที่นี่อย่างเดียวจะทำให้สองระบบไม่ตรงกัน และตัวเทียบยอดจะขึ้นส่วนต่างทุกวัน"
              className="text-[12.5px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-not-allowed"
            >
              ปรับจำนวน
            </span>
            <Link href="/core/soon/product-print"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              พิมพ์เอกสาร
            </Link>
            <Link href="/core/channels"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              อัพเดทช่องทางอื่น
            </Link>
            {/* ZORT มีปุ่มนี้ — ประวัติว่าใครแก้อะไรเมื่อไหร่ · คลังเงาไม่ได้เก็บเลย */}
            <span
              title="คลังเงาไม่ได้เก็บประวัติว่าใครแก้อะไรเมื่อไหร่ — ดูได้ที่ ZORT เท่านั้น"
              className="text-[12.5px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-not-allowed"
            >
              ดูกิจกรรมของรายการ
            </span>
            {/* ZORT มีปุ่ม "คำสั่ง ▾" รวมคำสั่งทั้งหมด — ใช้เมนูชุดเดียวกับ ⋮ ในตาราง */}
            <span className="inline-flex items-center gap-1 text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-2 py-1">
              คำสั่ง
              <RowMenu items={productMenuItems(sku, (href) => router.push(href))} />
            </span>
          </div>

          {/* การ์ด 3 ใบแบบ ZORT — ค่าว่างแสดงเป็น "-" ตามจอเขา */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-[12px] text-gray-500 text-right">สินค้าคงเหลือ</p>
              <p className={`text-[28px] font-semibold text-right leading-none mt-1 ${
                Number(row.qty) < 0 ? 'text-red-500' : 'text-gray-900'
              }`}>
                {fmtNum(Number(row.qty ?? 0))}
              </p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500 text-right">สินค้าพร้อมขาย</p>
              <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-900">
                {/* ⚠️ null = ยังไม่มีในทะเบียน **ห้ามเดาว่าเท่ากับคงเหลือ** */}
                {row.available == null ? <span className="text-gray-300">-</span> : fmtNum(Number(row.available))}
              </p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500 text-right">ยอดขายเดือนนี้ (บาท)</p>
              <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-300">-</p>
              {/* ⚠️ ยังไม่มีท่อถามยอดขายรายสินค้าเป็นเดือน — ขอไว้แล้ว
                  ห้ามเอา sold (จำนวนที่ขายได้ 30 วัน) มาคูณราคาขายแล้วบอกว่าเป็นยอดเงิน
                  เพราะราคาที่ขายจริงต่างจากราคาป้ายได้ (ส่วนลด · โปรมาร์เก็ตเพลส) */}
              <p className="text-[11px] text-gray-400 text-right mt-1">ยังไม่มีท่อยอดขายรายสินค้าเป็นเดือน</p>
            </Card>
          </div>

          {/* กล่องข้อมูล — รูปซ้าย ขวาสองคอลัมน์ ตามผัง ZORT */}
          <div className="bg-white border border-gray-200 rounded-md p-5 mt-4 flex flex-wrap gap-6">
            {img
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="w-[220px] h-[160px] rounded border border-gray-200 object-cover bg-white" />
              )
              : (
                <span className="w-[220px] h-[160px] rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[28px] text-gray-300">
                  🖼️
                </span>
              )}

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-gray-900">{row.name || sku}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 mt-4 max-w-[640px]">
                <div>
                  <p className="text-[12px] text-gray-500">รหัสสินค้า</p>
                  <p className="text-[15px] text-gray-900">{row.sku}</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาขาย</p>
                  <p className="text-[15px] text-gray-900">
                    {typeof row.price === 'number' ? `${fmtMoney(row.price)} บาท` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ต้นทุนคงเหลือเฉลี่ย</p>
                  {/* 🔴 ต้นทุนเฉลี่ยเรามีแค่ **ระดับหมวด** (คัดจากจอ ZORT) ไม่มีระดับสินค้า
                      ⇒ ขึ้นขีด + บอกว่าไปดูที่ไหนได้ · ห้ามเอาราคาซื้อในทะเบียนมาแสดงแทน
                      เพราะพิสูจน์แล้วว่ามันต่ำกว่าต้นทุนจริง 2-3 เท่า */}
                  <p className="text-[15px] text-gray-300">-</p>
                  <p className="text-[11px] text-gray-400">
                    มีเฉพาะระดับหมวด · ดูที่ <Link href="/core/categories" className="text-blue-600 hover:underline">หมวดหมู่</Link>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาซื้อ</p>
                  <p className="text-[15px] text-gray-900">
                    {/* ⚠️ null = ยังไม่ได้กรอก ไม่ใช่ 0 */}
                    {row.buy == null ? <span className="text-gray-300">-</span> : `${fmtMoney(row.buy)} บาท`}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[12px] text-gray-500">สินค้าในสินค้าเป็นชุด</p>
                  {(() => {
                    const list = inBundles?.rows ?? []
                    // ⚠️ ไม่มีคำตอบจากท่อ ≠ ไม่อยู่ในชุดไหน — ต้องเขียนต่างกัน
                    if (!inBundles) return <p className="text-[13px] text-gray-400">ยังดูย้อนไม่ได้รอบนี้</p>
                    if (list.length === 0) return <p className="text-[15px] text-gray-500">ไม่มีข้อมูล</p>
                    const show = showAllBundles ? list : list.slice(0, 5)
                    return (
                      <>
                        <p className="text-[13.5px] leading-relaxed">
                          {show.map((b, i) => (
                            <span key={b.bundleSku}>
                              {i > 0 && ', '}
                              <Link href={`/core/bundles/${encodeURIComponent(b.bundleSku)}`}
                                className="text-blue-600 hover:underline" title={b.bundleName || ''}>
                                {b.bundleSku}
                              </Link>
                            </span>
                          ))}
                          {!showAllBundles && list.length > 5 && (
                            <>
                              {' '}
                              <button onClick={() => setShowAllBundles(true)} className="text-blue-600 hover:underline">
                                ดูข้อมูล (อีก {list.length - 5} ชุด)
                              </button>
                            </>
                          )}
                        </p>
                        {/* ⚠️ สูตรชุดเป็นภาพนิ่ง เก็บครั้งเดียว — ต้องบอกวันที่เก็บเสมอ */}
                        {inBundles.collectedAt && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            อยู่ใน {list.length} ชุด · สูตรชุดเก็บเมื่อ {inBundles.collectedAt.slice(0, 10)} (ไม่ได้ซิงก์เอง)
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div>
                  <p className="text-[12px] text-gray-500">น้ำหนัก (กรัม)</p>
                  {/* ZORT มีช่องนี้ — คลังเงายังไม่ได้เก็บ ⇒ ขีดไว้ ห้ามใส่ 0 (0 กรัมคือของไม่มีน้ำหนัก) */}
                  <p className="text-[15px] text-gray-300">-</p>
                  <p className="text-[11px] text-gray-400">คลังเงายังไม่ได้เก็บช่องนี้จาก ZORT</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ลงขายที่</p>
                  <div className="text-[15px]"><MarketLogos list={row.marketplaces} /></div>
                </div>
              </div>
            </div>
          </div>

          <Card className="mt-4">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">ยอดขาย</p>
              {/* ZORT มี 3 แบบ: ยอดขาย · จำนวนที่ขายได้ · **กำไรจากการขาย**
                  ⇒ กำไรทำไม่ได้ เพราะต้องใช้ต้นทุนเฉลี่ย**รายตัว** ซึ่งเรามีแค่ระดับหมวด */}
              <select
                value={chartMode}
                onChange={(e) => setChartMode(e.target.value as 'amount' | 'qty')}
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="amount">ยอดขาย (บาท)</option>
                <option value="qty">จำนวนที่ขายได้</option>
                <option value="profit" disabled>กำไรจากการขาย — ยังทำไม่ได้</option>
              </select>
              <BtnGhost onClick={loadChart} disabled={chartLoading}>
                {chartLoading ? 'กำลังคิด…' : chart ? 'คิดใหม่' : 'แสดงกราฟ'}
              </BtnGhost>
            </div>

            {chart
              ? <SalesBars points={chart} mode={chartMode} />
              : (
                <div className="py-10 text-center">
                  <p className="text-[13px] text-gray-600">กดปุ่ม <b>แสดงกราฟ</b> เพื่อคิดยอดขายรายเดือน</p>
                  {/* ⚠️ บอกด้วยว่าทำไมไม่โหลดเอง — ไม่งั้นดูเหมือนจอโหลดไม่ขึ้น */}
                  <p className="text-[11.5px] text-gray-400 mt-1">
                    ยิงครั้งเดียวได้ครบ 12 เดือน — แต่ไม่โหลดเองตอนเปิดหน้า
                    เพราะคนเปิดหน้าสินค้าบ่อยกว่าดูกราฟมาก
                  </p>
                  {chartErr && <p className="text-[12px] text-amber-800 mt-2">⚠️ {chartErr}</p>}
                </div>
              )}

            <p className="text-[11.5px] text-gray-500 mt-2 leading-relaxed">
              ⚠️ เดือนที่แท่งเป็นศูนย์คือ<b>ขายไม่ได้เลยเดือนนั้นจริง ๆ</b> — ท่อส่งมาเฉพาะเดือนที่มียอด
              จอจึงสร้างช่องเดือนให้ครบก่อนแล้วค่อยเติม <b>ไม่ใช่วาดจากที่ท่อส่งมาตรง ๆ</b>
              (ไม่งั้นแกนเวลาจะข้ามเดือนที่ขายไม่ได้ไปเงียบ ๆ) ·
              ⚠️ ย้อนได้ถึง <b>1 ก.ย. 2568</b> เท่านั้น (ประวัติใบขายที่คลังเงามี) — เดือนที่เป็นศูนย์
              ก่อนหน้านั้นแปลว่า<b>เราไม่มีข้อมูล</b> ไม่ใช่ขายไม่ได้ ·
              <b> กำไรจากการขาย</b>ที่ ZORT มี ทำไม่ได้เพราะต้องใช้ต้นทุนเฉลี่ยรายตัว
              ซึ่งเรามีแค่<b>ระดับหมวด</b>
            </p>
          </Card>

          {/* ⚠️ **มีการ์ดไว้พร้อมเหตุผล ดีกว่าไม่มีการ์ด** — กติกาเดียวกับ 4 จอที่ตกลงกันไว้
              (จอมีอยู่ · ผังเหมือน · เขียนบอกตรง ๆ ว่าทำไมว่าง)
              ⚠️ ต่างจาก "การ์ดเปล่า" ตรงที่ **มีเหตุผลกำกับ** — การ์ดเปล่าเฉย ๆ คือสัญญาของที่ไม่มี
                 แต่การ์ดที่บอกว่าทำไมว่าง คือการรายงานความจริง */}
          <Card className="mt-4">
            <p className="text-[15px] font-semibold text-gray-900 mb-2">จำนวนสินค้าคงเหลือ รายคลัง</p>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-[30px] opacity-60">🏬</span>
              <p className="text-[13px] text-gray-700 mt-2">ยังไม่มีข้อมูลแยกรายคลัง</p>
              <p className="text-[12px] text-gray-500 mt-1 max-w-[420px] leading-relaxed">
                ZORT <b>ไม่เปิดช่องทางให้ดึงสต็อกแยกตามคลัง</b> (ยิงมาแล้วไม่ผ่านทุกทาง) ·
                คลังเงาเก็บสต็อกรวมทั้งร้าน จึงแยกรายคลังไม่ได้ —
                เป็น<b>ข้อจำกัดของต้นทาง ไม่ใช่ของที่ยังทำไม่เสร็จ</b>
              </p>
            </div>
          </Card>

          {/* การ์ด "รายงาน" — stock card เท่าที่คลังเงามี */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">รายงานการเคลื่อนไหว</p>
              {/* ⚠️ ZORT มีตัวกรอง 8 แบบ + ตัวกรองคลัง — ของเรามีเท่าที่ข้อมูลรองรับจริง (6 เหตุผล)
                  ใส่ให้ครบ 8 แบบตามเขา = ตัวเลือกที่เลือกแล้วไม่มีอะไรเปลี่ยน ซึ่งเป็นของหลอก */}
              <select
                value={moveFilter}
                onChange={(e) => setMoveFilter(e.target.value)}
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="">ทุกประเภท</option>
                {Object.entries(moves?.reasons ?? {}).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <TableWrap>
              <table className="w-full min-w-[680px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>วันที่</th>
                    <th className={TH}>ประเภท</th>
                    <th className={TH}>อ้างอิง</th>
                    <th className={THR}>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {moveRows.length === 0 && (
                    <EmptyState
                      cols={4}
                      icon={movesErr ? '⚠️' : '📋'}
                      title={movesErr ? 'ดึงความเคลื่อนไหวไม่ได้' : 'ยังไม่มีรายการปรับสต็อกของรหัสนี้'}
                      detail={movesErr
                        ? `ตารางว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่มีการเคลื่อนไหว — ${movesErr}`
                        : 'ตารางนี้แสดงเฉพาะการปรับสต็อกด้วยมือ (รับของ · โอน · ปรับยอด · ของเสีย · รับคืน)'}
                    />
                  )}
                  {moveRows.map((m, i) => (
                    <tr key={m.id ?? `${m.ref}-${i}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>
                        {m.at ? thaiDate(String(m.at).slice(0, 10)) : '-'}
                      </td>
                      <td className={TD}>{moves?.reasons?.[m.reason] ?? m.reason}</td>
                      <td className={`${TD} text-gray-500`}>{m.ref || '-'}</td>
                      <td className={`${TDR} ${Number(m.qty) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {Number(m.qty) > 0 ? '+' : ''}{fmtNum(Number(m.qty ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            {/* 🔴 ต้องบอกให้ชัดว่าตารางนี้ครอบคลุมแค่ไหน — ZORT รวมทุกทาง ของเรายังไม่ครบ */}
            <p className="text-[12px] text-amber-800 bg-amber-50 border-t border-amber-200 px-4 py-2.5 leading-relaxed">
              ⚠️ ตารางนี้<b>ยังไม่ใช่ Stock Card เต็มแบบ ZORT</b> — ตอนนี้แสดงเฉพาะ
              <b> การปรับสต็อกด้วยมือ</b> ในระบบเรา · ยังไม่ได้รวม ขาย · ซื้อ · โอน เข้าด้วยกัน
              (ข้อมูลมีครบในคลังเงาแล้ว รอต่อท่อรวม) · และจะขาดใบ &quot;ปรับ&quot; 194 ใบเสมอ
              เพราะ API ของ ZORT เองไม่ส่งออกมา
            </p>
          </Card>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ⚠️ ZORT มี <b>QR code กับบาร์โค้ด</b> มุมขวาของกล่องข้อมูล (ใช้คู่กับปุ่มพิมพ์เอกสาร) —
            ยังไม่ทำเพราะปุ่มพิมพ์เอกสารเองก็ยังทำไม่ได้ · ทำบาร์โค้ดไว้เฉย ๆ โดยพิมพ์ไม่ได้
            ก็ไม่ได้ช่วยอะไร · <b>น้ำหนัก</b> ZORT มีแต่คลังเงายังไม่ได้เก็บช่องนี้มา
          </p>
        </>
      )}
    </div>
  )
}
