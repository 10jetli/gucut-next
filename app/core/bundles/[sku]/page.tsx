'use client'
// รายละเอียดสินค้าเป็นชุด — **ลอกจากจอจริงของ ZORT** (`/Bundle/Details?&id=…`)
//
// 🔴 **ใบ t_mu1dfe94 (14 ก.ย. 2569)** — ท่านประธานเทียบภาพเอง จอเราขาด 6 อย่าง:
//    (1) ปุ่มบนสุด 6 ปุ่ม  (2) การ์ด "ยอดขายเดือนนี้"  (3) QR + บาร์โค้ด
//    (4) กราฟยอดขายรายเดือน  (5) คงเหลือรายคลัง  (6) ตารางรายการขาย
//    ⇒ ทำครบทั้งหก **แต่บางอันของจริงยังไม่มีข้อมูลให้แสดง** ⇒ ตรงนั้นต้องเขียนว่า
//       "ยังไม่รู้" ไม่ใช่ "0" — ฝั่งท่อกำชับเรื่องนี้ตรง ๆ (ดูหัวข้อยอดขายข้างล่าง)
//
// 🔴 **ยอดขายรายชุด: 0 ที่ได้มา ยังแปลไม่ได้ว่า "ไม่ได้ขาย"** (ฝั่งท่อยิงจริงให้ 22:3x)
//    · `?list=topproducts&sku=<ชุด>` กวาดครบ 360/360 ชุด ⇒ **มียอดแค่ชุดเดียว** (03409-3)
//    · `?list=orders&q=<รหัสชุด>` = 0 ใบ (q ไม่ได้ค้นรหัสสินค้าในบรรทัด)
//    ⇒ ยังแยกไม่ได้ว่า "ชุดไม่ได้ขาย" หรือ "ใบขายเก็บเป็นรหัสชิ้นส่วน"
//    ⇒ **ห้ามขึ้น "0 บาท" หรือ "ไม่มียอดขาย"** — ต้องขึ้นว่ายังไม่รู้ พร้อมเหตุผล
//
// ⚠️ คงเหลือรายคลัง: `?zortbundle=<sku>&wh=<NEW|KLD|ANJ>` ถาม ZORT สดทุกครั้ง
//    ⇒ ยิง **ครั้งเดียวตอนเปิดหน้า** (มีปุ่มรีเฟรชให้กดเอง) ห้ามยิงวน
//    ⚠️ `null` = ZORT ไม่ส่งตัวเลขของคลังนั้นมา **ไม่ใช่ 0** ⇒ ขึ้น "—"
//    ⚠️ คลัง NEW คืนเลขเท่ากับตอนไม่ระบุคลังเป๊ะ ⇒ **ยังแยกไม่ได้** ว่าเป็นของคลัง NEW
//       เท่านั้น หรือเป็นยอดรวมทั้งร้าน — ต้องเขียนบนจอ ห้ามตั้งหัวข้อว่า "คลัง NEW" ลอย ๆ
//
// 🔴 **สองเวลาคนละเรื่อง**: สูตรเปลี่ยนล่าสุด (ค้างได้) ≠ ตรวจกับ ZORT ล่าสุด (คือความสด)
//    และ **นาฬิกาที่สาม**: stockSyncedAt = ตัวเลขคงเหลือ/พร้อมขายซิงก์ล่าสุด (ทุกครึ่งชั่วโมง)
//    ⇒ ตรรกะอยู่ที่ lib/recipe-fresh.ts ที่เดียว มีเทสคุมการสลับสามค่านี้
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fmtMoney, fmtNum } from '@/lib/format'
import {
  recipeFreshness, thaiMoment, stockSyncFreshness, agoText, STOCK_STALE_MINUTES,
} from '@/lib/recipe-fresh'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import { TableWrap, TH, THR, TD, TDR, BtnGhost, EmptyState } from '@/components/zort'
import SkuCodes from '@/components/zort/SkuCodes'

interface BundleRow {
  sku: string; name: string
  sellprice?: number; onhand?: number; available?: number
  active?: boolean; unit?: string
}
interface Item { line?: number; sku: string; name: string; qty: number }
interface Warehouse { code: string; name: string; isPos?: boolean }
/** ผลถาม ZORT รายคลัง · `stock`/`available` = null คือ **ไม่ส่งมา ไม่ใช่ศูนย์**
 *  🔴 **สามสถานะ ไม่ใช่สอง** (ท่อเปิดช่องให้แยกได้ 14 ก.ย. 2569 · gucut-web 3f0336c)
 *    ① มีตัวเลข                      ⇒ แสดงตัวเลข
 *    ② ไม่มีตัวเลข **แต่ ZORT บอกเหตุผล** ⇒ แสดงเหตุผลนั้นตรง ๆ (ของจริง: 'Access Denied.')
 *    ③ ไม่มีตัวเลข **และไม่บอกเหตุผล**   ⇒ "ยังไม่รู้" เท่านั้น ห้ามเดาว่าเป็นเรื่องสิทธิ์
 *  ⚠️ เดิมจอเขียนเหมารวมว่า "น่าจะติดสิทธิ์" โดยอ้างหลักฐานจากเส้น*สินค้า*
 *     ตอนนี้เส้น*ชุด*บอกเองได้แล้ว ⇒ เลิกเดา ใช้คำตอบของรอบนั้นจริง */
interface WhStock {
  code: string; name: string; isPos?: boolean
  stock: number | null; available: number | null
  /** รหัส/ข้อความที่ ZORT ตอบสำหรับคลังนี้ · null = ZORT ไม่ได้บอกเหตุผลมา */
  zortCode?: string | null
  zortDesc?: string | null
  error?: string
}
/** ยอดขายหนึ่งช่วง · `amount` = null คือ **ท่อไม่มีข้อมูลให้ ไม่ใช่ขายได้ 0 บาท** */
interface Span { label: string; from: string; to: string; qty: number | null; amount: number | null; error?: string }

const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** การ์ดบนสุดแบบ ZORT — 3 ใบ · รับ `unknown` ได้เพื่อไม่ต้องโชว์ 0 เมื่อยังไม่รู้ */
function Card({ label, value, unknown, note, tone }: {
  label: string; value?: string; unknown?: string; note?: string; tone?: 'red' | 'amber'
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3 min-w-[190px] flex-1">
      <p className="text-[12px] text-gray-500">{label}</p>
      {unknown
        ? <p className="text-[13px] text-amber-800 mt-1 leading-snug">⚠️ {unknown}</p>
        : (
          <p className={`text-[22px] font-semibold mt-0.5 ${
            tone === 'red' ? 'text-red-500' : tone === 'amber' ? 'text-amber-600' : 'text-gray-900'}`}>
            {value}
          </p>
        )}
      {note && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{note}</p>}
    </div>
  )
}

export default function BundleDetailPage() {
  const params = useParams<{ sku: string }>()
  /* 🔴 **decodeURIComponent โยน error ได้ถ้าเจอ % ที่ไม่ใช่รหัส** — และมันอยู่ตอนวาดหน้า
     ⇒ ลิงก์เสียหนึ่งลิงก์ = **ทั้งหน้าตายเป็นจอขาว** ไม่ใช่แค่ช่องนั้นว่าง
     รหัสสินค้าของร้านมีทั้งไทยและอักขระพิเศษ (เช่น 01209-22.5T · โซ่-…) ⇒ เกิดได้จริง */
  const sku = (() => {
    const raw = String(params?.sku ?? '')
    try { return decodeURIComponent(raw) } catch { return raw }
  })()

  const [bundle, setBundle] = useState<BundleRow | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [collectedAt, setCollectedAt] = useState('')
  /* ⚠️ สามเวลานี้ตอบคนละคำถาม — เก็บแยกกันเด็ดขาด (ดูหัวไฟล์) */
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [stockSyncedAt, setStockSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /** ยอดขายเดือนนี้ · null ที่ตัวแปรนี้ = ยังไม่ได้ถาม */
  const [month, setMonth] = useState<Span | null>(null)
  const [amountScope, setAmountScope] = useState('')
  /** กราฟย้อนหลัง — โหลดตามสั่ง เพราะต้องยิงเดือนละครั้ง (ไม่ยิงเองตอนเปิดหน้า) */
  const [chart, setChart] = useState<Span[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [wh, setWh] = useState<WhStock[] | null>(null)
  const [whErr, setWhErr] = useState('')
  const imgOf = useSkuImages(640)
  const [menu, setMenu] = useState<'' | 'cmd' | 'print' | 'push'>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, iRes] = await Promise.all([
        fetch(`/api/web/core?list=bundles&q=${encodeURIComponent(sku)}&limit=5`).then((r) => r.json()),
        fetch(`/api/web/core?list=bundleitems&sku=${encodeURIComponent(sku)}`).then((r) => r.json()),
      ])
      if (bRes?.error) throw new Error(bRes.error)
      const rows: BundleRow[] = Array.isArray(bRes?.rows) ? bRes.rows : []
      // ⚠️ ค้นหาคืนหลายแถวได้ — ต้องหาแถวที่รหัสตรงเป๊ะ ไม่ใช่หยิบแถวแรก
      setBundle(rows.find((r) => r.sku === sku) ?? null)
      setStockSyncedAt(typeof bRes?.stockSyncedAt === 'string' ? bRes.stockSyncedAt : null)
      setItems(Array.isArray(iRes?.rows) ? iRes.rows : [])
      setCollectedAt(typeof iRes?.collectedAt === 'string' ? iRes.collectedAt : '')
      setCheckedAt(typeof iRes?.recipeCheckedAt === 'string' ? iRes.recipeCheckedAt : null)
    } catch (e) {
      setBundle(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])

  /** ถามยอดขายหนึ่งช่วงจากเส้น topproducts — คืน null ทั้งคู่เมื่อท่อไม่มีบรรทัดของชุดนี้ */
  const askSpan = useCallback(async (label: string, from: string, to: string): Promise<Span> => {
    try {
      const r = await fetch(`/api/web/core?list=topproducts&sku=${encodeURIComponent(sku)}&from=${from}&to=${to}`)
      const d = await r.json()
      if (!r.ok || d?.error) return { label, from, to, qty: null, amount: null, error: String(d?.error ?? `HTTP ${r.status}`) }
      if (typeof d?.amountScope === 'string') setAmountScope(d.amountScope)
      const hit = Array.isArray(d?.items) ? d.items.find((x: { sku?: string }) => x?.sku === sku) : null
      /* 🔴 ไม่มีบรรทัด ≠ ขายได้ 0 บาท ⇒ คืน null ให้จอเขียนว่า "ยังไม่รู้" */
      if (!hit) return { label, from, to, qty: null, amount: null }
      return { label, from, to, qty: Number(hit.qty) || 0, amount: Number(hit.amount) || 0 }
    } catch (e) {
      return { label, from, to, qty: null, amount: null, error: String(e instanceof Error ? e.message : e) }
    }
  }, [sku])

  const loadMonth = useCallback(async () => {
    const now = new Date()
    const from = iso(new Date(now.getFullYear(), now.getMonth(), 1))
    setMonth(await askSpan(`${THAI_MONTH[now.getMonth()]} ${now.getFullYear() + 543}`, from, iso(now)))
  }, [askSpan])

  const loadChart = useCallback(async () => {
    setChartLoading(true)
    try {
      const now = new Date()
      const spans: Span[] = []
      /* ⚠️ ท่อไม่มีเส้นแยกยอดรายเดือน ⇒ ต้องยิงเดือนละครั้ง · 6 ครั้งต่อการกดหนึ่งที
         (เหตุผลที่ทำเป็น "กดแล้วโหลด" ไม่ใช่โหลดเองตอนเปิดหน้า) */
      for (let back = 5; back >= 0; back--) {
        const first = new Date(now.getFullYear(), now.getMonth() - back, 1)
        const last = new Date(now.getFullYear(), now.getMonth() - back + 1, 0)
        const to = back === 0 ? iso(now) : iso(last)
        // eslint-disable-next-line no-await-in-loop
        spans.push(await askSpan(`${THAI_MONTH[first.getMonth()]} ${String(first.getFullYear() + 543).slice(2)}`, iso(first), to))
      }
      setChart(spans)
    } finally { setChartLoading(false) }
  }, [askSpan])

  const loadWarehouses = useCallback(async () => {
    setWhErr('')
    try {
      const wr = await fetch('/api/web/core?list=warehouses').then((r) => r.json())
      const list: Warehouse[] = Array.isArray(wr?.warehouses) ? wr.warehouses : []
      if (!list.length) { setWhErr('ท่อไม่ได้ส่งรายชื่อคลังมา — ยังไม่รู้ว่ามีคลังอะไร'); return }
      const out: WhStock[] = []
      for (const w of list) {
        // eslint-disable-next-line no-await-in-loop
        const d = await fetch(`/api/web/core?zortbundle=${encodeURIComponent(sku)}&wh=${encodeURIComponent(w.code)}`)
          .then((r) => r.json()).catch(() => null)
        const ds = d?.detailStock
        const det = d?.detail
        const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
        const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
        out.push({
          code: w.code, name: w.name || w.code, isPos: w.isPos,
          stock: ds ? num(ds.stock) : null,
          available: ds ? num(ds.availablestock) : null,
          /* ⚠️ เป็นข้อความของ ZORT ล้วน ๆ (อังกฤษ) — แสดงดิบไปเลย ห้ามแปลเอาเอง
             เพราะถ้าแปลผิด คนจะไล่ผิดทาง และข้อความนี้คือสิ่งที่เอาไปถาม ZORT ได้ */
          zortCode: det ? str(det.resCode) : null,
          zortDesc: det ? str(det.resDesc) : null,
          error: d?.error ? String(d.error) : undefined,
        })
      }
      setWh(out)
    } catch (e) {
      setWhErr(String(e instanceof Error ? e.message : e))
    }
  }, [sku])

  useEffect(() => { load() }, [load])
  /* 🔴 ยิงครั้งเดียวต่อรหัสชุด — ฝั่งท่อกำชับว่าเส้นรายคลังถาม ZORT สดทุกครั้ง "อย่ายิงวน"
     useRef กันไว้เพราะ effect ใน React 18 dev ทำงานสองรอบ */
  const askedFor = useRef('')
  useEffect(() => {
    if (askedFor.current === sku) return
    askedFor.current = sku
    setWh(null); setMonth(null); setChart(null)
    void loadMonth()
    void loadWarehouses()
  }, [sku, loadMonth, loadWarehouses])

  const img = imgOf(sku)
  /* ⚠️ ลำดับ argument สำคัญ: checkedAt ก่อน changedAt (เทส recipe-fresh คุมการสลับไว้) */
  const fresh = recipeFreshness(checkedAt, collectedAt || null)
  const stock = stockSyncFreshness(stockSyncedAt)
  const unit = bundle?.unit || 'SET'

  /* ค่าสูงสุดของกราฟ — คิดจากเดือนที่ **มีตัวเลขจริง** เท่านั้น (null ไม่ใช่ 0) */
  const chartMax = chart ? Math.max(1, ...chart.map((s) => s.amount ?? 0)) : 1
  const chartKnown = chart ? chart.filter((s) => s.amount !== null).length : 0

  return (
    <div className="p-4 md:p-6">
      <Link href="/core/bundles" className="text-[12.5px] text-blue-600 hover:underline">← สินค้าเป็นชุด</Link>

      {error && <ErrorBox title="ดึงข้อมูลชุดไม่ได้">{error}</ErrorBox>}
      {loading && !bundle && <LoadingState />}

      {!loading && !bundle && !error && (
        <div className="bg-white border border-gray-200 rounded-md p-6 mt-3 text-[13px] text-gray-500">
          ไม่พบชุดรหัส <b>{sku}</b> ในคลังของเรา — อาจถูกลบที่ ZORT หรือรหัสพิมพ์ผิด
        </div>
      )}

      {bundle && (
        <>
          {/* ── (1) ปุ่มบนสุด 6 ปุ่มเหมือน ZORT ────────────────────────────────
              🔴 ทุกปุ่มต้อง "ทำอะไรจริง" หรือ "พาไปหน้าที่บอกว่าติดอะไร"
                 ห้ามมีปุ่มที่กดแล้วไม่เกิดอะไร — คนใช้จะกดซ้ำแล้วนึกว่าระบบพัง */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link href={`/core/bundles/${encodeURIComponent(sku)}/edit`} className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">แก้ไข</Link>
            <Link href="/core/soon/bundle-delete" className="text-[13px] font-medium text-red-700 bg-white border border-red-200 rounded-full px-4 py-1.5 hover:bg-red-50">ลบ</Link>

            <span className="relative">
              <button type="button" onClick={() => setMenu(menu === 'cmd' ? '' : 'cmd')}
                className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
                คำสั่ง ▾
              </button>
              {menu === 'cmd' && (
                <span className="absolute left-0 top-full mt-1 z-20 w-[230px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] py-1 block">
                  {/* ✅ ZORT มี doSell() เปิดบิลขายจากหน้านี้ — ของเราพาไปเครื่องคิดเงินพร้อมเติมรหัสให้ */}
                  <Link href={`/core/pos?sku=${encodeURIComponent(sku)}`} className="block px-3.5 py-2 text-[13px] text-gray-800 hover:bg-gray-50">ขายสินค้า (เปิดบิล)</Link>
                  <Link href={`/core/stock?q=${encodeURIComponent(sku)}`} className="block px-3.5 py-2 text-[13px] text-gray-800 hover:bg-gray-50">ดูในจอคลังสินค้า</Link>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(sku).catch(() => {}); setMenu('') }}
                    className="block w-full text-left px-3.5 py-2 text-[13px] text-gray-800 hover:bg-gray-50">คัดลอกรหัสชุด</button>
                </span>
              )}
            </span>

            <span className="relative">
              <button type="button" onClick={() => setMenu(menu === 'print' ? '' : 'print')}
                className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
                พิมพ์เอกสาร ▾
              </button>
              {menu === 'print' && (
                <span className="absolute left-0 top-full mt-1 z-20 w-[230px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] py-1 block">
                  <Link href={`/core/stock/print?sku=${encodeURIComponent(sku)}`} className="block px-3.5 py-2 text-[13px] text-gray-800 hover:bg-gray-50">พิมพ์ฉลากบาร์โค้ด</Link>
                </span>
              )}
            </span>

            <Link href="/core/soon/bundle-push-marketplace" className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">อัพเดทช่องทางอื่น ▾</Link>
            <Link href="/core/soon/bundle-activity" className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">ดูกิจกรรมของรายการ</Link>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-5 mt-3 flex flex-wrap gap-6">
            {img
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="w-[180px] h-[130px] rounded border border-gray-200 object-cover bg-white" />
              )
              : <span className="block w-[180px] h-[130px] rounded border border-gray-200 bg-gray-100" />}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[20px] font-semibold text-gray-900">{bundle.name || sku}</h1>
                <span className={`text-[11.5px] font-semibold rounded px-2 py-0.5 ${
                  bundle.active === false ? 'text-gray-600 bg-gray-100' : 'text-emerald-800 bg-emerald-100'
                }`}>
                  {bundle.active === false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 mt-4 max-w-[560px]">
                <div>
                  <p className="text-[12px] text-gray-500">รหัสสินค้า</p>
                  <p className="text-[15px] text-gray-900">{bundle.sku}</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาขาย</p>
                  <p className="text-[15px] text-gray-900">
                    {typeof bundle.sellprice === 'number' ? `${fmtMoney(bundle.sellprice)} บาท` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">วันหมดอายุรายการ</p>
                  <p className="text-[15px] text-gray-400">-</p>
                </div>
              </div>
            </div>

            {/* ── (3) QR + บาร์โค้ด มุมขวาบนเหมือน ZORT ── */}
            <SkuCodes sku={sku} />
          </div>

          {/* ── (2) การ์ดบนสุด 3 ใบ ────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 mt-3">
            <Card
              label="สินค้าคงเหลือ"
              value={typeof bundle.onhand === 'number' ? `${fmtNum(bundle.onhand)} ${unit}` : '—'}
              tone={Number(bundle.onhand) < 0 ? 'red' : undefined}
              note={stock.state === 'ok' ? `ซิงก์จาก ZORT ${agoText(stock.ageMinutes)}` : undefined}
            />
            <Card
              label="สินค้าพร้อมขาย"
              value={typeof bundle.available === 'number' ? `${fmtNum(bundle.available)} ${unit}` : '—'}
              tone={Number(bundle.available) < 0 ? 'red' : bundle.available === 0 ? 'amber' : undefined}
              /* 🔴 0 ของพร้อมขายอาจติดลบจริง — ZORT API ไม่ส่งค่าติดลบของช่องนี้ (ยิงค่าดิบเทียบแล้ว) */
              note={bundle.available === 0
                ? '⚠️ 0 อาจหมายถึงติดลบ — ZORT API ไม่ส่งค่าติดลบของพร้อมขาย (จอ ZORT เองเคยโชว์ -10 ขณะที่ API ส่ง 0)'
                : undefined}
            />
            {/* 🔴 ยอดขายเดือนนี้: ไม่มีข้อมูล ⇒ "ยังไม่รู้" **ห้ามเขียน 0 บาท** */}
            <Card
              label={`ยอดขายเดือนนี้ (บาท)${month ? ` · ${month.label}` : ''}`}
              value={month && month.amount !== null ? fmtMoney(month.amount) : undefined}
              unknown={!month
                ? 'กำลังถาม…'
                : month.error
                  ? `ถามยอดขายไม่สำเร็จ: ${month.error}`
                  : month.amount === null
                    ? 'ยังไม่รู้ยอดขายของชุดนี้ — ท่อยังแยกยอดรายชุดไม่ได้ (ดูคำอธิบายข้างล่าง)'
                    : undefined}
              note={month && month.amount !== null && month.qty !== null ? `ขายได้ ${fmtNum(month.qty)} ${unit}` : undefined}
            />
          </div>

          {/* 🔴 คำอธิบายว่าทำไมยอดขายอาจว่าง — อยู่ใกล้การ์ด ไม่ใช่ท้ายหน้า */}
          {month && month.amount === null && !month.error && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
              ⚠️ <b>ยังไม่รู้ว่าชุดนี้ขายได้เท่าไหร่ — ไม่ได้แปลว่าขายไม่ได้</b><br />
              ฝั่งท่อกวาดครบ 360/360 ชุดแล้ว (14 ก.ย. 2569) พบยอดแค่ชุดเดียวทั้งร้าน
              และค้นใบขายด้วยรหัสชุดก็ได้ 0 ใบ ⇒ <b>ยังแยกไม่ได้</b>ว่าชุดไม่ได้ขายจริง
              หรือใบขายเก็บเป็น<b>รหัสชิ้นส่วน</b> (ขายชุดแล้วบันทึกเป็นของแต่ละชิ้น)
              ⇒ จอนี้จึงไม่เขียน &ldquo;0 บาท&rdquo; เพราะจะทำให้เข้าใจผิดว่าตรวจแล้วไม่มียอด
            </div>
          )}

          {/* ── (5) คงเหลือรายคลัง ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-5 mb-2">
            <p className="text-[15px] font-semibold text-gray-900">จำนวนคงเหลือ รายคลัง</p>
            <BtnGhost onClick={loadWarehouses} disabled={wh === null && !whErr}>ถาม ZORT อีกครั้ง</BtnGhost>
          </div>
          {whErr && <ErrorBox title="ถามคงเหลือรายคลังไม่ได้">{whErr}</ErrorBox>}
          <TableWrap>
            <table className="w-full min-w-[520px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>คลัง / สาขา</th>
                  <th className={THR}>คงเหลือ</th>
                  <th className={THR}>พร้อมขาย</th>
                </tr>
              </thead>
              <tbody>
                {wh === null && !whErr && (
                  <tr><td colSpan={3} className="px-3 py-4 text-[12.5px] text-gray-400">กำลังถาม ZORT รายคลัง…</td></tr>
                )}
                {wh?.map((w) => {
                  /* 🔴 **เหตุผลต้องอยู่ติดแถวของคลังนั้น ไม่ใช่รวมไว้ย่อหน้าเดียวใต้ตาราง**
                     ขีดเปล่า ๆ สามแถวเหมือนกันหมด อ่านไม่ออกว่าคลังไหนถูกปฏิเสธ
                     คลังไหน ZORT เงียบไปเลย — สองอย่างนี้ต้องไล่ต่อคนละทาง */
                  const denied = w.stock === null && w.available === null && w.zortDesc
                  const silent = w.stock === null && w.available === null && !w.zortDesc
                  return (
                    <tr key={w.code} className="border-b border-[#e8ecf8] last:border-0 align-top">
                      <td className={TD}>
                        {w.name} <span className="text-gray-400">({w.code})</span>
                        {w.isPos === false && <span className="text-gray-400"> · โกดัง</span>}
                        {/* ข้อความของ ZORT เองสำหรับคลังนี้ — จากคำตอบรอบนี้ ไม่ใช่คำบอกเล่า */}
                        {denied && (
                          <span className="block text-[11.5px] text-amber-800 mt-0.5 leading-relaxed">
                            🔐 ZORT ไม่ให้สิทธิ์ดูคลังนี้ — ตอบว่า
                            {' '}<span className="font-mono">&ldquo;{w.zortDesc}&rdquo;</span>
                            {w.zortCode && <span className="text-gray-400"> (resCode {w.zortCode})</span>}
                            <br /><span className="text-amber-700">⇒ ไม่ใช่ว่าคลังนี้ไม่มีของ — เรายังดูไม่ได้</span>
                          </span>
                        )}
                        {silent && (
                          <span className="block text-[11.5px] text-gray-500 mt-0.5 leading-relaxed">
                            ⚠️ ZORT ไม่ส่งตัวเลขของคลังนี้มา <b>และไม่ได้บอกเหตุผล</b> — ยังไม่รู้ว่าเพราะอะไร
                          </span>
                        )}
                        {w.error && (
                          <span className="block text-[11.5px] text-red-700 mt-0.5">ถามคลังนี้ไม่สำเร็จ: {w.error}</span>
                        )}
                      </td>
                      {/* 🔴 null = ZORT ไม่ส่งมา ⇒ "—" **ห้ามเขียน 0** */}
                      <td className={TDR}>{w.stock === null ? <span className="text-gray-300">—</span> : `${fmtNum(w.stock)} ${unit}`}</td>
                      <td className={TDR}>{w.available === null ? <span className="text-gray-300">—</span> : `${fmtNum(w.available)} ${unit}`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
          {/* 🔴 **ย่อหน้านี้เคยเดาสาเหตุ ตอนนี้เลิกเดาแล้ว** (14 ก.ย. 2569 · gucut-web 3f0336c)
                 รุ่นแรก: เดาสองทาง "สาขาไม่เก็บชุด / ZORT ไม่คำนวณชุดรายคลัง"
                 รุ่นสอง: เขียนว่า "น่าจะติดสิทธิ์" โดยอ้างหลักฐานจากเส้น *สินค้า* (คนละเส้นกับที่จอใช้)
                 รุ่นนี้: ท่อส่ง `detail.resCode` / `detail.resDesc` มาแล้ว
                         ⇒ **เส้นชุดเองบอกเหตุผลของรอบนั้น** ⇒ เอาข้อความจริงไปติดข้างแถวคลังนั้น
                 ⚠️ บทเรียน: คำว่า "น่าจะ" ที่เขียนไว้เพราะหลักฐานมาจากเส้นข้างเคียง
                    **ต้องถอดทิ้งทันทีที่เส้นตรงตอบได้** ไม่งั้นจอจะค้างอยู่กับคำคาดเดาตลอดไป */}
          <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2 leading-relaxed">
            ⚠️ <b>ขีด (—) = ZORT ไม่ส่งตัวเลขของคลังนั้นมา ไม่ใช่ &ldquo;คลังนั้นมี 0&rdquo;</b>
            {' '}เหตุผลของแต่ละคลัง<b>อยู่ข้างชื่อคลังในตาราง</b> — เป็นข้อความที่ ZORT ตอบในรอบนี้เอง<br />
            ⚠️ และคลัง <b>NEW</b> คืนเลข<b>เท่ากับตอนไม่ระบุคลังเป๊ะ</b> ⇒ ยังแยกไม่ได้ว่าเป็นของคลัง NEW
            เท่านั้น หรือเป็น<b>ยอดรวมทั้งร้าน</b> — <b>อย่าเอาไปบวกกันเป็นยอดรวม</b>
            {' '}(จะแยกได้เมื่อได้สิทธิ์ดู KLD/ANJ)
          </p>

          {/* ── (4) กราฟยอดขายรายเดือน ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-5 mb-2">
            <p className="text-[15px] font-semibold text-gray-900">ยอดขายรายเดือน (ย้อนหลัง 6 เดือน)</p>
            <BtnGhost onClick={loadChart} disabled={chartLoading}>
              {chartLoading ? 'กำลังถาม…' : chart ? 'ถามอีกครั้ง' : 'ดูกราฟ'}
            </BtnGhost>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4">
            {!chart && !chartLoading && (
              <p className="text-[12.5px] text-gray-500 leading-relaxed">
                ท่อยังไม่มีเส้นแยกยอดขายรายเดือน ⇒ ต้องถามเดือนละครั้ง (6 ครั้ง)
                {' '}จึง<b>ไม่ยิงเองตอนเปิดหน้า</b> — กด &ldquo;ดูกราฟ&rdquo; เมื่อต้องการ
              </p>
            )}
            {chartLoading && <p className="text-[12.5px] text-gray-400">กำลังถามยอดเดือนละครั้ง…</p>}
            {chart && (
              <>
                {/* 🔴 เดือนที่ไม่รู้ **ห้ามวาดเป็นแท่งศูนย์** — แท่งเตี้ยอ่านได้ว่า "ขายได้น้อย"
                       ⇒ ใช้แถบลายเทา + ขีด แทน เพื่อให้ต่างจาก "ขายได้ 0 จริง" ชัดเจน */}
                <div className="flex items-end gap-3 h-[150px]">
                  {chart.map((s) => (
                    <div key={s.from} className="flex-1 flex flex-col items-center justify-end h-full">
                      {s.amount === null
                        ? (
                          <span className="w-full rounded-t bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#f3f4f6_4px,#f3f4f6_8px)] border border-gray-300"
                            style={{ height: '18px' }} title="ยังไม่รู้ยอดของเดือนนี้ — ไม่ใช่ 0 บาท" />
                        )
                        : (
                          <>
                            <span className="text-[10.5px] text-gray-500 mb-0.5">{fmtMoney(s.amount)}</span>
                            <span className="w-full rounded-t bg-[#4669e5]"
                              style={{ height: `${Math.max(3, (s.amount / chartMax) * 110)}px` }} />
                          </>
                        )}
                      <span className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">{s.label}</span>
                      {s.amount === null && <span className="text-[10.5px] text-gray-400">ยังไม่รู้</span>}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
                  {chartKnown === 0
                    ? <>⚠️ <b>ทั้ง 6 เดือนยังไม่รู้ยอด</b> — แถบลายเทาคือ &ldquo;ยังไม่รู้&rdquo; <b>ไม่ใช่ 0 บาท</b> (ดูเหตุผลที่กล่องเหลืองข้างบน)</>
                    : <>แถบลายเทา = <b>ยังไม่รู้ยอดของเดือนนั้น ไม่ใช่ 0 บาท</b></>}
                  {amountScope && <><br />{amountScope}</>}
                </p>
              </>
            )}
          </div>

          <p className="text-[15px] font-semibold text-gray-900 mt-5 mb-2">สินค้าใน สินค้าเป็นชุด</p>
          <TableWrap>
            <table className="w-full min-w-[620px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <EmptyState cols={4} icon="📦" title="ยังไม่มีรายการส่วนประกอบของชุดนี้"
                    detail="รายการในชุดเก็บมาจากหน้ารายละเอียดของ ZORT ทีละชุด — ชุดนี้อาจยังไม่ถูกเก็บ" />
                )}
                {items.map((it, i) => (
                  <tr key={`${it.sku}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{it.line ?? i + 1}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Link href={`/core/stock?q=${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                        {it.sku}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Link href={`/core/stock/${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                        {it.name || '—'}
                      </Link>
                    </td>
                    <td className={TDR}>{fmtNum(it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {/* ── (6) ตารางรายการขายของชุดนี้ ────────────────────────────────── */}
          <p className="text-[15px] font-semibold text-gray-900 mt-5 mb-2">รายการขายของชุดนี้</p>
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>ประเภท</th>
                  <th className={TH}>เลขที่</th>
                  <th className={TH}>ชื่อลูกค้า</th>
                  <th className={TH}>วันที่</th>
                  <th className={THR}>จำนวน</th>
                  <th className={TH}>คลัง/สาขา</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>การชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {/* 🔴 หัวคอลัมน์ครบตามผัง ZORT แต่ **ท่อยังไม่มีเส้นดึงใบขายรายสินค้า**
                       ⇒ เขียนเหตุผลตรง ๆ **ห้ามขึ้น "ไม่มีรายการขาย"** เพราะเราไม่ได้ตรวจแล้วพบว่าไม่มี */}
                <EmptyState cols={9} icon="🧾" title="ยังดึงรายการขายรายชุดไม่ได้ — ไม่ได้แปลว่าไม่มีการขาย"
                  detail="ZORT มีตารางนี้ในหน้าเดียวกัน แต่ท่อยังไม่มีเส้นที่ค้นใบขายด้วยรหัสสินค้าในบรรทัด (ยิงจริง 14 ก.ย. 2569: ค้นด้วยรหัสชุดได้ 0 ใบ เพราะคำค้นไม่ได้ไล่ถึงบรรทัดสินค้า) · ฝั่งท่อกำลังไล่ต่อ" />
              </tbody>
            </table>
          </TableWrap>

          {/* ── ความสดของข้อมูลสองชุด (สูตร vs ตัวเลขสต็อก) ───────────────── */}
          <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
            {fresh.state === 'ok' && (
              <>✅ สูตรชุดนี้<b>ซิงก์จาก ZORT อัตโนมัติทุกชั่วโมง</b> — ตรวจล่าสุด <b>{thaiMoment(fresh.checkedThai)}</b>
                {fresh.ageHours !== null && <> ({fresh.ageHours} ชม.ที่แล้ว)</>}</>
            )}
            {fresh.state === 'stale' && (
              <span className="text-amber-800">🔴 ควรตรวจทุกชั่วโมง แต่ตรวจล่าสุด <b>{thaiMoment(fresh.checkedThai)}</b>
                {fresh.ageHours !== null && <> ({fresh.ageHours} ชม.ที่แล้ว)</>} ⇒ <b>ตัวซิงก์น่าจะหยุด</b></span>
            )}
            {fresh.state === 'unknown' && (
              <>⚠️ ยังไม่รู้ว่าตรวจกับ ZORT ล่าสุดเมื่อไหร่ (ท่อไม่ได้ส่งเวลามา) — <b>ไม่ได้แปลว่าซิงก์หยุด</b></>
            )}
            {fresh.changedThai && (
              <> · สูตร<b>เปลี่ยนล่าสุด</b> {thaiMoment(fresh.changedThai)}
                <span className="opacity-70"> (ชุดที่ไม่มีใครแก้ เวลานี้จะไม่ขยับ)</span></>
            )}
            <br />
            {/* 🔴 นาฬิกาที่สอง — ตัวเลขคงเหลือ/พร้อมขาย คนละอันกับความสดของสูตร */}
            {stock.state === 'ok' && (
              <>🕰 ตัวเลข<b>คงเหลือ / พร้อมขาย</b> ซิงก์ล่าสุด <b>{thaiMoment(stock.syncedThai)}</b> ({agoText(stock.ageMinutes)}) · ทุกครึ่งชั่วโมง</>
            )}
            {stock.state === 'stale' && (
              <span className="text-amber-800">🔴 ตัวเลข<b>คงเหลือ / พร้อมขาย</b> ซิงก์ล่าสุด <b>{thaiMoment(stock.syncedThai)}</b>
                {' '}({agoText(stock.ageMinutes)}) ⇒ เกิน {STOCK_STALE_MINUTES} นาที <b>ตัวซิงก์น่าจะหยุด</b> — ตัวเลขอาจเก่ากว่าของจริง</span>
            )}
            {stock.state === 'unknown' && (
              <>⚠️ ยังไม่รู้ว่าตัวเลข<b>คงเหลือ / พร้อมขาย</b> ซิงก์ล่าสุดเมื่อไหร่ (ท่อไม่ได้ส่งเวลามา) — ไม่ได้แปลว่าซิงก์หยุด</>
            )}
          </p>
        </>
      )}
    </div>
  )
}
