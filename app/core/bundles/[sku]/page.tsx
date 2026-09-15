'use client'
// รายละเอียดสินค้าเป็นชุด — **ลอกจากจอจริงของ ZORT** (`/Bundle/Details?&id=…`)
//
// 🔴 **ใบ t_mu1dfe94 (14 ก.ย. 2569)** — ท่านประธานเทียบภาพเอง จอเราขาด 6 อย่าง:
//    (1) ปุ่มบนสุด 6 ปุ่ม  (2) การ์ด "ยอดขายเดือนนี้"  (3) QR + บาร์โค้ด
//    (4) กราฟยอดขายรายเดือน  (5) คงเหลือรายคลัง  (6) ตารางรายการขาย
//    ⇒ ทำครบทั้งหก **แต่บางอันของจริงยังไม่มีข้อมูลให้แสดง** ⇒ ตรงนั้นต้องเขียนว่า
//       "ยังไม่รู้" ไม่ใช่ "0" — ฝั่งท่อกำชับเรื่องนี้ตรง ๆ (ดูหัวข้อยอดขายข้างล่าง)
//
// ✅ **ยอดขายรายชุด — ปลดล็อกแล้ว 15 ก.ย. 2569 (ใบ t_mu2p83ql)**
//    เดิมถามจาก `?list=topproducts` **เดือนละหนึ่งครั้ง** (การ์ด 1 + กราฟ 6 = 7 ครั้งต่อการเปิดหนึ่งหน้า)
//    และเกือบทุกชุดได้ค่าว่าง ⇒ จอขึ้น "ยังไม่รู้" ตลอด
//    ตอนนี้คิดจาก **บัตรสต็อกของชุดเอง** (`?list=stockcard&kind=sale`) ที่หน้านี้ยิงอยู่แล้ว
//    ⇒ ได้ทั้งการ์ดและกราฟจากการยิง **ครั้งเดียว** และได้ประวัติทั้งหมด ไม่ใช่แค่ 6 เดือน
//    📏 **พิสูจน์ว่าสองแหล่งให้เลขเดียวกันก่อนเปลี่ยน** (ยิงจริง 15 ก.ย.): 03409-3 ก.ย. 2569
//       บัตรสต็อก 2 ชิ้น/338.40 = topproducts 2/338.4 · ไล่ครบ 14 ชุดที่เคยขาย ตรงกันทุกตัวที่อยู่ในช่วงเดียวกัน
//       (ตรรกะ + หลักฐานอยู่ที่ `lib/bundle-sales.ts` · เทส `scripts/tests/bundle-sales.test.mjs`)
//    ⚠️ **ยังห้ามขึ้น 0 เมื่อข้อมูลไม่ครบ** — `truncated`/`hasMore`/`failed` ⇒ ต้องเป็น "ยังไม่รู้"
//       เพราะแถวที่หายไปคือยอดที่หายไป (เทสข้อ ③ ดักไว้)
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
import { SALE_STATUS, zortWord } from '@/lib/zort-words'
import { monthlySeries, sumMonth, salesComplete, monthLabel, lastSaleDate } from '@/lib/bundle-sales'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fmtMoney, fmtNum, thaiDate } from '@/lib/format'
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
/** แถวขายของชุด — ช่องตามที่ `list=stockcard` ส่งมาจริง (ยิงดูแล้ว ไม่ได้เดา)
 *  🚫 **ไม่มีช่องคลัง/สาขา และช่องการชำระเงิน** ⇒ สองคอลัมน์นั้นต้องขึ้น "—" ห้ามเดา */
interface SaleRow { date?: string; kind?: string; status?: string; ref?: string; party?: string; qty?: number; amount?: number }


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

  /* 🔴 ยอดขายเดือนนี้ + กราฟ **ไม่ใช่ state แล้ว** — คิดจากแถวขายที่หน้านี้โหลดอยู่แล้ว
     (เดิมเป็น state เพราะต้องยิง topproducts เดือนละครั้ง · ดูหัวไฟล์) */
  const [wh, setWh] = useState<WhStock[] | null>(null)
  const [whErr, setWhErr] = useState('')
  /* 🔓 **ปลดล็อกตารางรายการขายของชุด** (ใบ t_mu2ndt8a · 15 ก.ย. 2569)
     พิสูจน์แล้วว่า **ZORT บันทึกการขายชุดไว้ที่รหัสชุด ไม่ใช่รหัสลูก**:
     · กวาดบัตรสต็อกของชุดทั้ง 360 ตัว ⇒ **14 ตัวมีแถวขาย รวม 23 แถว** ที่เหลือ 346 ตัวไม่มีเลย
     · และของชุดกับของลูก **ไม่ซ้ำใบกันเลย** (03409-3 · 03413-3 · 03496-3 ⇒ ใบซ้ำ 0/6 · 0/4 · 0/2)
     📌 **หลักฐานข้อนี้มาจากบัตรสต็อกของกระจกเรา ไม่ใช่จากจอ ZORT** — แน่นพอให้ตัดสินใจ แต่ต้องรู้ที่มา
       ⇒ ขายชุดตัดที่รหัสชุดเท่านั้น **ไม่นับซ้ำกับลูก**
     · ที่ตัวอย่าง 5 ชุดแรกได้ 0 เพราะ **ชุดพวกนั้นยังไม่เคยขาย** ไม่ใช่เพราะเก็บเป็นรหัสลูก
     ⚠️ ว่างจึงแปลว่า "ชุดนี้ยังไม่เคยขาย" ได้จริง — แต่ **เฉพาะกับการขาย**
        เพราะบัตรสต็อกของชุดไม่มีการเคลื่อนไหวชนิดอื่นเลย (293 ชุดมีของในคลังแต่ไม่มีประวัติ)
        ⇒ ห้ามอ่านตารางว่างว่า "ชุดนี้ไม่มีของ/ไม่มีความเคลื่อนไหว" */
  const [sales, setSales] = useState<SaleRow[] | null>(null)
  const [salesErr, setSalesErr] = useState('')
  /** ช่องความครบที่ท่อส่งมาด้วย — **จอต้องอ่าน ไม่ใช่ดูแค่ rows**
   *  (ฝั่งท่อชี้ 15 ก.ย. 2569: ถ้าไม่อ่าน ชุดที่ขายเกิน 200 แถวจะถูกตัดเงียบ
   *   และถ้าท่อล้มบางส่วน `failed` ไม่ว่าง ตารางจะดู "ครบ" ทั้งที่ไม่ครบ) */
  const [salesMeta, setSalesMeta] = useState<{ total: number | null; shown: number; hasMore: boolean; truncated: boolean; failed: string[] } | null>(null)
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
      /* 🧾 รายการขายของชุด — ยิงแยกและ **ไม่ให้ล้มทั้งหน้า** ถ้าเส้นนี้พลาด
         (ของหลักคือสูตรชุดกับสต็อก · ตารางขายเป็นส่วนเสริม)
         ⚠️ ล้มเหลว = เขียนว่าอ่านไม่ได้ **ห้ามขึ้นว่าไม่มีการขาย** */
      fetch(`/api/web/core?list=stockcard&sku=${encodeURIComponent(sku)}&kind=sale&limit=200`)
        .then((r) => r.json())
        .then((sc) => {
          if (sc?.error) { setSales(null); setSalesErr(String(sc.error)); return }
          if (!Array.isArray(sc?.rows)) { setSales(null); setSalesErr('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)'); return }
          setSales(sc.rows as SaleRow[]); setSalesErr('')
          setSalesMeta({
            total: typeof sc.total === 'number' ? sc.total : null,
            shown: Array.isArray(sc.rows) ? sc.rows.length : 0,
            hasMore: sc.hasMore === true,
            truncated: sc.truncated === true,
            /* ⚠️ `failed` เป็น array ของแหล่งที่อ่านไม่สำเร็จ (ยิงดูแล้ว = []) */
            failed: Array.isArray(sc.failed) ? sc.failed.map(String) : [],
          })
        })
        .catch((e) => { setSales(null); setSalesErr(String(e instanceof Error ? e.message : e)) })
    } catch (e) {
      setBundle(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])


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
    setWh(null)
    void loadWarehouses()
  }, [sku, loadWarehouses])

  const img = imgOf(sku)
  /* ⚠️ ลำดับ argument สำคัญ: checkedAt ก่อน changedAt (เทส recipe-fresh คุมการสลับไว้) */
  const fresh = recipeFreshness(checkedAt, collectedAt || null)
  const stock = stockSyncFreshness(stockSyncedAt)
  const unit = bundle?.unit || 'SET'

  /* 📊 ยอดขายเดือนนี้ + กราฟ 6 เดือน — **คิดจากแถวขายที่โหลดมาแล้ว ไม่ยิงเพิ่มสักครั้ง**
     ตรรกะอยู่ที่ lib/bundle-sales.ts ที่เดียว (มีเทสคุมเรื่อง "0 กับ ยังไม่รู้") */
  const now = new Date()
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthSum = sumMonth(sales, salesMeta, thisKey)
  const chart = monthlySeries(sales, salesMeta, now, 6)
  /* ค่าสูงสุดของกราฟ — คิดจากเดือนที่ **มีตัวเลขจริง** เท่านั้น (null ไม่ใช่ 0) */
  const chartMax = Math.max(1, ...chart.map((s) => s.amount ?? 0))
  const chartKnown = chart.filter((s) => s.amount !== null).length
  const salesReady = salesComplete(salesMeta)
  const lastSold = lastSaleDate(sales)
  /* เหตุผลที่ยังบอกยอดไม่ได้ — **ต้องแยกให้ออกว่าอ่านไม่ได้ กับ อ่านได้แต่ไม่ครบ** */
  const salesUnknownWhy = salesErr
    ? `อ่านรายการขายของชุดนี้ไม่ได้: ${salesErr}`
    : !sales
      ? 'กำลังอ่านรายการขายของชุดนี้…'
      : !salesReady
        ? 'รายการขายที่ได้มายังไม่ครบ (ท่อตัดแถวหรืออ่านบางแหล่งไม่สำเร็จ) ⇒ ยังรวมยอดไม่ได้'
        : ''

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
            <Link href="/core/soon/bundle-edit" className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">แก้ไข</Link>
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
              /* 🔴 **แก้ข้อความเดิม 15 ก.ย. 2569 (ใบ t_mu2p83ql)** — เดิมเขียนว่า
                     "ZORT API ไม่ส่งค่าติดลบของช่องนี้" ⇒ **ไม่จริงทั้งหมด**
                     เทียบทั้ง 360 ชุดกับจอ ZORT แล้วพบว่า API ส่งค่าติดลบมาก็มี
                     และค่าที่ส่งมาก็ **ไม่ตรงกับจอ ZORT** ในหลายชุด (จอต่ำกว่าเสมอเมื่อต่าง)
                  ⚠️ ห้ามฝังจำนวนชุดลงข้อความ — เลขจะเก่าเงียบ ๆ (เคยโดนทักมาแล้ว) ⇒ อ้างเหตุการณ์ + วันที่ */
              note={bundle.available === 0
                ? '⚠️ 0 อาจหมายถึงติดลบ — เทียบทั้ง 360 ชุดกับจอ ZORT แล้ว (15 ก.ย. 2569) ส่วนใหญ่ของชุดที่ขึ้น 0 ตรงนี้ จอ ZORT แสดงค่าติดลบ'
                : '⚠️ ตัวเลขนี้มาจาก ZORT API — เทียบกับจอ ZORT แล้ว (15 ก.ย. 2569) บางชุดจอ ZORT ต่ำกว่านี้'}
            />
            {/* 🔴 ยอดขายเดือนนี้ — จากบัตรสต็อกของชุด · **ข้อมูลไม่ครบ ⇒ "ยังไม่รู้" ห้ามเขียน 0 บาท** */}
            <Card
              label={`ยอดขายเดือนนี้ (บาท) · ${monthLabel(now.getFullYear(), now.getMonth(), false)}`}
              value={monthSum.amount !== null ? fmtMoney(monthSum.amount) : undefined}
              unknown={salesUnknownWhy || undefined}
              note={monthSum.amount !== null
                ? `${monthSum.qty ? `ขายได้ ${fmtNum(monthSum.qty)} ${unit} · ` : ''}จากบัตรสต็อกของรหัสชุด`
                  + (monthSum.voided ? ` · ไม่นับใบยกเลิก ${fmtNum(monthSum.voided)} ใบ` : '')
                : undefined}
            />
          </div>

          {/* 🔴 ยอดขายเดือนนี้เป็น 0 แล้วชุดนี้ไม่เคยขายเลย — ต้องบอกว่า "ตรวจแล้ว" ไม่ใช่ปล่อยให้เดา
                 (ต่างจากกรณีอ่านไม่ได้ ซึ่งการ์ดจะขึ้นเหตุผลแทนตัวเลขอยู่แล้ว) */}
          {monthSum.amount === 0 && sales && sales.length === 0 && (
            <div className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
              ℹ️ <b>ชุดนี้ยังไม่เคยขายเลยสักใบ</b> — ไม่ใช่ &ldquo;อ่านข้อมูลไม่ได้&rdquo;
              {' '}บัตรสต็อกของรหัสชุดนี้ไม่มีแถวขายเลย ({unit}ที่มีในคลังยังอยู่ครบ)<br />
              ⚠️ อ่านได้แค่เรื่อง<b>การขาย</b>เท่านั้น — บัตรสต็อกของชุดไม่มีการเคลื่อนไหวชนิดอื่นเลย
              {' '}⇒ <b>ห้ามอ่านว่า &ldquo;ชุดนี้ไม่มีของ&rdquo;</b>
            </div>
          )}
          {monthSum.amount === 0 && sales && sales.length > 0 && lastSold && (
            <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
              เดือนนี้ยังไม่มีการขาย — ขายล่าสุดเมื่อ <b>{thaiDate(lastSold)}</b> (มีประวัติขายรวม {fmtNum(sales.length)} แถว)
            </p>
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
                        {/* 🔴 **แก้ถ้อยคำ 15 ก.ย. 2569 (ใบ t_mu2p83ql)** — เดิมเขียนว่า "ZORT ไม่ให้สิทธิ์ดูคลังนี้"
                               ทดสอบแล้วพบว่า **ZORT ตอบ 'Access Denied.' เหมือนกันเป๊ะให้กับรหัสคลังที่ไม่มีอยู่จริง**
                               (ยิง `?zortbundle=<sku>&wh=ZZZ` 15 ก.ย. ได้ resCode 100 · 'Access Denied.' เท่ากัน)
                               ⇒ ข้อความนี้ **แยกไม่ได้** ว่า "ไม่มีสิทธิ์" หรือ "ไม่มีคลังนี้"
                               ที่ยังพูดได้คือ: รหัสคลังนี้มาจาก `?list=warehouses` ของร้านเอง และเราดูตัวเลขของมันไม่ได้ */}
                        {denied && (
                          <span className="block text-[11.5px] text-amber-800 mt-0.5 leading-relaxed">
                            🔐 ดูตัวเลขของคลังนี้ไม่ได้ — ZORT ตอบว่า
                            {' '}<span className="font-mono">&ldquo;{w.zortDesc}&rdquo;</span>
                            {w.zortCode && <span className="text-gray-400"> (resCode {w.zortCode})</span>}
                            <br /><span className="text-amber-700">⇒ ไม่ใช่ว่าคลังนี้ไม่มีของ — เรายังดูไม่ได้</span>
                            <br /><span className="text-gray-500">
                              ⚠️ ข้อความเดียวกันนี้ ZORT ตอบให้กับ<b>รหัสคลังที่ไม่มีอยู่จริง</b>ด้วย (ทดสอบ 15 ก.ย. 2569)
                              {' '}⇒ อ่านได้แค่ว่า <b>ผู้ใช้ API รายนี้เข้าถึงคลังนี้ไม่ได้</b> ห้ามอ่านเลยไปกว่านี้
                            </span>
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
            {' '}(จะแยกได้เมื่อได้สิทธิ์ดู KLD/ANJ)<br />
            📏 <b>ตรวจซ้ำ 15 ก.ย. 2569</b>: ยิงชุดที่มีของในคลังหลายสิบตัว — NEW เท่ากับยอดไม่ระบุคลัง<b>ทุกตัว</b>
            {' '}⇒ <b>ยังไม่มีตัวอย่างไหนที่แยกสองอย่างนี้ออกจากกันได้</b> จึงยังสรุปไม่ได้ (ไม่ใช่ว่าเลิกตรวจ)
          </p>

          {/* ── (4) กราฟยอดขายรายเดือน ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-5 mb-2">
            <p className="text-[15px] font-semibold text-gray-900">ยอดขายรายเดือน (ย้อนหลัง 6 เดือน)</p>
            {/* 🔴 **ไม่มีปุ่ม "ดูกราฟ" อีกแล้ว** — เดิมต้องกดเพราะยิงเดือนละครั้ง 6 ครั้ง
                   ตอนนี้คิดจากแถวขายที่หน้านี้โหลดมาอยู่แล้ว ⇒ ขึ้นเองทันที ไม่มีการยิงเพิ่ม */}
            <span className="text-[11.5px] text-gray-400">จากบัตรสต็อกของรหัสชุด — ไม่ต้องกดโหลด</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4">
            {!sales && !salesErr && <p className="text-[12.5px] text-gray-400">กำลังอ่านรายการขายของชุดนี้…</p>}
            {(sales || salesErr) && (
              <>
                {/* 🔴 เดือนที่ไม่รู้ **ห้ามวาดเป็นแท่งศูนย์** — แท่งเตี้ยอ่านได้ว่า "ขายได้น้อย"
                       ⇒ ใช้แถบลายเทา + ขีด แทน เพื่อให้ต่างจาก "ขายได้ 0 จริง" ชัดเจน */}
                <div className="flex items-end gap-3 h-[150px]">
                  {chart.map((s) => (
                    <div key={s.key} className="flex-1 flex flex-col items-center justify-end h-full">
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
                    ? <>⚠️ <b>ทั้ง 6 เดือนยังไม่รู้ยอด</b> — แถบลายเทาคือ &ldquo;ยังไม่รู้&rdquo; <b>ไม่ใช่ 0 บาท</b>{salesUnknownWhy ? ` (${salesUnknownWhy})` : ''}</>
                    : <>แท่งเตี้ยสุด = เดือนนั้น<b>ไม่มีการขายจริง</b> · แถบลายเทา = <b>ยังไม่รู้ยอด ไม่ใช่ 0 บาท</b></>}
                  <br />
                  {/* 🔑 ที่มาของตัวเลข — คนอ่านต้องรู้ว่านับจากอะไร ไม่ใช่เชื่อแท่งกราฟลอย ๆ */}
                  นับจาก<b>แถวขายในบัตรสต็อกของรหัสชุด</b> (ZORT บันทึกการขายชุดไว้ที่รหัสชุด ไม่ใช่รหัสลูก)
                  {' '}⇒ <b>ไม่นับซ้ำกับชิ้นส่วน</b> · ตรวจแล้วให้เลขเดียวกับรายงานของ ZORT เอง (15 ก.ย. 2569)
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
                {/* 🔓 **เติมของจริงได้แล้ว** (ใบ t_mu2ndt8a) — อ่านจากบัตรสต็อกของ **รหัสชุด** ตรง ๆ
                       เดิมเขียนว่า "ท่อยังไม่มีเส้นดึงใบขายรายสินค้า" ซึ่งจริงเฉพาะเส้นค้นใบ (`q`)
                       แต่ `list=stockcard&kind=sale` ดึงได้อยู่แล้ว · ที่เคยได้ 0 เพราะชุดตัวอย่างไม่เคยขาย */}
                {salesErr && (
                  <EmptyState cols={9} icon="⚠️" title="อ่านรายการขายของชุดนี้ไม่สำเร็จ — ไม่ได้แปลว่าไม่มีการขาย"
                    detail={salesErr} />
                )}
                {!salesErr && sales === null && (
                  <EmptyState cols={9} icon="⏳" title="กำลังอ่านรายการขายของชุดนี้" detail="" />
                )}
                {!salesErr && sales !== null && sales.length === 0 && (
                  (salesMeta?.failed.length ?? 0) > 0
                    /* 🔴 **ท่ออ่านบางแหล่งไม่สำเร็จ ⇒ ห้ามพูดว่ายังไม่เคยขาย** (ฝั่งท่อกำชับ)
                       ว่างเพราะอ่านไม่ได้ กับ ว่างเพราะไม่มี เป็นคนละเรื่อง
                       ⚠️ **ทางนี้วันนี้วิ่งไม่ถึง — เก็บไว้โดยตั้งใจ ไม่ใช่โค้ดตาย**
                          ฝั่งท่อไล่โค้ดให้ 15 ก.ย. 2569: `failed` ใส่ได้ค่าเดียวคือ `adjust`
                          และคำสั่งดึงยอดปรับ **รันเฉพาะเมื่อขอ kind ที่รวม adjust**
                          ⇒ จอนี้ขอ `kind=sale` จึงไม่มีทางได้ `failed` ⇒ กล่องนี้จะไม่ขึ้นลวง
                          (ถ้าคำสั่งดึงยอดขายล้มเอง ท่อล้มทั้งคำขอเป็น error ⇒ ไปทาง `salesErr`)
                          🔑 ที่เก็บไว้เพราะ **วันที่ใครเปลี่ยน kind ของจอนี้ ทางนี้จะกลายเป็นทางจริงทันที**
                             และเพราะ "ยังไม่เคยขาย" เป็นคำที่แพงถ้าพูดผิด */
                    ? <EmptyState cols={9} icon="⚠️" title="ยังสรุปไม่ได้ว่าชุดนี้เคยขายหรือไม่ — ท่ออ่านข้อมูลบางส่วนไม่สำเร็จ"
                        detail={`อ่านไม่สำเร็จ: ${salesMeta?.failed.join(' · ')} ⇒ ตารางว่างเพราะอ่านไม่ได้ ไม่ใช่เพราะไม่มีการขาย`} />
                    /* ✅ ว่างแบบนี้ **ตรวจแล้วจริง** — พูดได้ว่ายังไม่เคยขาย
                       ⚠️ ไม่ฝังตัวเลข "กี่ชุดจากกี่ชุด" ลงจอ เพราะจะเก่าเงียบทันทีที่ชุดขายเพิ่ม
                          (ฝั่งท่อชี้ 15 ก.ย. 2569) ⇒ เขียนเป็นเหตุการณ์+วันที่แทน */
                    : <EmptyState cols={9} icon="🧾" title="ชุดนี้ยังไม่เคยขาย"
                        detail="อ่านบัตรสต็อกของรหัสชุดแล้วไม่มีรายการขายเลย · ชุดส่วนใหญ่ของร้านยังไม่เคยขาย (สำรวจทั้ง 360 ชุด 15 ก.ย. 2569) ⇒ ว่างเป็นเรื่องปกติ · หมายเหตุ: บัตรสต็อกของชุดไม่มีการเคลื่อนไหวชนิดอื่น ⇒ ว่างที่นี่ไม่ได้แปลว่าชุดนี้ไม่มีของในคลัง" />
                )}
                {!salesErr && (sales ?? []).map((r, i) => (
                  <tr key={`${r.ref ?? i}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={TD}>{r.kind || <span className="text-gray-300">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap`}>{r.ref || <span className="text-gray-300">—</span>}</td>
                    <td className={`${TD} max-w-[190px] truncate`}>{r.party || <span className="text-gray-300">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{r.date || <span className="text-gray-300">—</span>}</td>
                    <td className={TDR}>{typeof r.qty === 'number' ? fmtNum(r.qty) : <span className="text-gray-300">—</span>}</td>
                    {/* 🔴 บัตรสต็อกไม่ส่งคลังรายแถวมา ⇒ ขีด ห้ามเดาว่าเป็นคลังหลัก */}
                    <td className={TD}><span className="text-gray-300" title="บัตรสต็อกของ ZORT ไม่ได้ส่งคลัง/สาขามาในแถว">—</span></td>
                    <td className={TDR}>{typeof r.amount === 'number' ? fmtMoney(r.amount) : <span className="text-gray-300">—</span>}</td>
                    {/* 🔤 **ต้องผ่านตารางคำ** — บัตรสต็อกส่งค่าดิบมา (ยิงดูแล้วได้ "Success")
                        ถ้าโชว์ตรง ๆ จะเป็นคำอังกฤษบนจอ = บั๊กเดียวกับที่ท่านประธานทักเรื่อง "Pending"
                        (ใบ t_mu23dljn) · ไม่รู้จัก = คืนค่าดิบ ไม่เดา */}
                    <td className={TD}>
                      {r.status ? zortWord(SALE_STATUS, r.status).text : <span className="text-gray-300">—</span>}
                    </td>
                    {/* 🔴 ไม่มีช่องการชำระเงินในบัตรสต็อก ⇒ ขีด */}
                    <td className={TD}><span className="text-gray-300" title="บัตรสต็อกของ ZORT ไม่ได้ส่งสถานะการชำระเงินมา">—</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {/* 🔢 **ป้ายความครบของตารางขาย — อ่านจากช่องที่ท่อส่งมา ไม่ใช่เดาจากจำนวนแถว**
              ฝั่งท่อชี้ 15 ก.ย. 2569: ถ้าจอดูแค่ `rows` ชุดที่ขายเกินเพดานจะถูกตัดเงียบ
              และถ้าท่อล้มบางแหล่ง (`failed` ไม่ว่าง) ตารางจะดูครบทั้งที่ไม่ครบ
              ⚠️ วันนี้ยังไม่ออกอาการ (มากสุด 6 แถว) — ใส่ไว้ก่อนที่จะออกอาการ */}
          {salesMeta && (salesMeta.hasMore || salesMeta.truncated) && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-2">
              ⚠️ <b>ตารางนี้ยังไม่ครบ</b> — แสดง <b>{fmtNum(salesMeta.shown)}</b>
              {salesMeta.total !== null ? <> จากทั้งหมด <b>{fmtNum(salesMeta.total)}</b> รายการ</> : <> รายการ (ท่อไม่ได้บอกยอดรวม)</>}
              {' '}· ท่อตัดมาให้เพราะชนเพดานต่อคำขอ
            </p>
          )}
          {salesMeta && salesMeta.failed.length > 0 && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-2">
              ⚠️ <b>ท่ออ่านข้อมูลบางแหล่งไม่สำเร็จ</b> ({salesMeta.failed.join(' · ')})
              {' '}⇒ รายการที่เห็น <b>อาจไม่ใช่ทั้งหมด</b> — ไม่ใช่ว่าไม่มีรายการอื่น
            </p>
          )}

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
