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
import { SHARE_LINK_Z, DETAIL_BTN_OFF } from '@/components/zort/headBtn'
import { IconEdit, IconTrash, IconPrint, IconShare, IconPlusCircle } from '@/components/zort/ButtonIcons'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { fmtMoney, fmtNum, thaiDateUtc } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages, pickImage, noImageReason } from '@/lib/sku-images'
import { productMenuItems } from '@/lib/product-menu'
import SkuCodes from '@/components/zort/SkuCodes'
import StockCard from '@/components/zort/StockCard'
import StockSource from '@/components/ui/StockSource'
import ClampedNote from '@/components/ui/ClampedNote'
import type { คำตอบที่อาจถูกบีบ } from '@/lib/clamped'
import { type ที่มาเลขสต็อก, type แผนที่ป้ายที่มา } from '@/lib/stock-source'
import { findOrderId } from '@/lib/open-order'
import {
  PageHead, BtnGhost, TableWrap, TH, TD, TDR, EmptyState, thaiDate, MarketLogos, RowMenu, DETAIL_BTN, TH_KANIT, THR_KANIT, ZORT_BACK_LINK, ZORT_INFO_LABEL, ZORT_INFO_VALUE, ZORT_INFO_NAME
} from '@/components/zort'
import ZortLookFold from '@/components/zort/ZortLookFold'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'
import { สภาพแถวชุด } from '@/lib/bundleitems'
import ZortKpiCards from '@/components/zort/ZortKpiCards'

interface Row {
  /** หมวดหมู่ (ท่อ list=stock ส่งมาต่อแถว) — ZORT ต่อท้ายชื่อในกล่องข้อมูลเป็น "(โซ่ NEWWAVE)" · ไม่มี/ว่าง = ไม่ต่อ */
  category?: string | null
  sku: string; name: string; qty: number; price: number; sold: number
  buy?: number | null; available?: number | null; unit?: string | null
  service?: boolean; active?: boolean | null; marketplaces?: string[]
  /** จับคู่รหัสได้ยังไง (`exact` | `base`) + รหัสเต็มบนแพลตฟอร์มถ้าเป็นการเดา */
  marketplacesBy?: Record<string, string>
  marketplacesFrom?: Record<string, string[]>
  /** น้ำหนักหน่วยกรัม — **null = ยังไม่รู้ · 0 = ของไม่มีน้ำหนัก** คนละเรื่องกัน
   *  ทั้งคลังมีน้ำหนักจริงแค่ 669 จาก 2,898 ตัว (23%) ⇒ ส่วนใหญ่ต้องขึ้น "—" */
  weight?: number | null
  /** 🖼️ รูปจาก ZORT (ท่อ gucut-web fc52832 · 15 ก.ย. 2569) — **สามสถานะ ห้ามยุบ**
   *    `null`       = ยังไม่รู้ (ไม่อยู่ในทะเบียนสินค้า/ยังไม่ซิงก์)
   *    `""`         = ZORT ไม่มีรูปของรหัสนี้
   *    `"https://…"` = มีรูป **แต่เป็นไฟล์ดิบ** (บางใบเกือบ 2 MB · ส่วนใหญ่เป็นลิงก์ของ Lazada/Shopee ที่ตายได้)
   *  🔴 ลำดับที่ฝั่งท่อกำหนด: ใช้ **แผนที่รูปย่อของเราก่อนเสมอ** ไม่มีค่อยตกมาที่ช่องนี้
   *     และใช้ได้เฉพาะ **หน้ารายละเอียด/แถวน้อย ๆ** เท่านั้น (จอที่มีเป็นร้อยแถวห้ามใช้) */
  imagePath?: string | null
  /** ชื่อไฟล์รูปย่อในถังเรา (ย่อจากรูป ZORT แล้ว) — มาก่อนไฟล์ดิบเสมอ */
  imageFile?: string | null
  /** ที่มาของเลขพร้อมขาย (ท่อ f924185 · 28 ก.ย. 2569) — **เพิ่มช่องอย่างเดียว**
   *  ท่อรุ่นก่อนไม่ส่งสามช่องนี้ ⇒ ชิ้นส่วนที่แสดงต้องเขียนว่า "ท่อรุ่นนี้ยังไม่ส่ง" ไม่ใช่เงียบ */
  src?: ที่มาเลขสต็อก['src']
  srcNote?: ที่มาเลขสต็อก['srcNote']
  'ทะเบียนว่า'?: ที่มาเลขสต็อก['ทะเบียนว่า']
}
/** หนึ่งแถวในสต็อกการ์ด — มาจาก `list=stockcard` (ขาย · ซื้อ · ปรับด้วยมือของเรา)
 *  ⚠️ ไม่มี `จาก` / `ไป` / `คงเหลือ` เพราะกระจกใบโอนเก็บแค่หัวใบ ดูรายละเอียดที่ท้ายการ์ด */
interface CardRow {
  date?: string; kind?: string; status?: string; ref?: string; party?: string
  qty?: number; amount?: number | null
}
interface StockCardResp {
  applied?: { sku?: string; kind?: string; limit?: number }
  kinds?: { key: string; label: string }[]
  /** ตัวเลือกที่ ZORT มีแต่เราทำไม่ได้ — **ต้องโชว์เป็นตัวเลือกสีเทา ห้ามซ่อน** */
  missingKinds?: string[]
  warehouses?: { key: string; label: string }[] | null
  coverage?: string
  /** พารามิเตอร์ที่ท่อไม่รู้จักและถอยไปใช้ค่าเริ่มต้นแทน + คำอธิบาย (ท่อเพิ่มให้ 181c6e5) */
  ignored?: Record<string, string>
  note?: string
  /** จำนวนจริงทั้งหมด · ที่แสดง · แยกตามแหล่ง · มีของถูกตัดไหม (ท่อเพิ่มให้ 93bd13f)
   *  ⚠️ อาจไม่มีชั่วคราวตอน deploy เหลื่อม (จอใหม่ + ท่อเก่า) ⇒ ต้องมีทางถอย */
  total?: number
  shown?: number
  counts?: { sale?: number; buy?: number; adjust?: number }
  truncated?: boolean
  /** คีย์ใหม่ความหมายเดียว — rowsReturned = ที่ส่งกลับจริงในคำตอบนี้ · rowsMatched = เข้าเงื่อนไขทั้งหมด
   *  (แทน shown ที่ความหมายต่างกันข้ามเส้น · ทางถอย shown ยังอ่านอยู่ตอนท่อรุ่นเก่า) */
  rowsReturned?: number
  rowsMatched?: number
  rows?: CardRow[]
  error?: string
}
/** เพดานแถวที่ขอจากท่อ — **ต้องบอกบนจอเมื่อชนเพดาน** ห้ามตัดเงียบ */
/** ป้าย/ค่าในกล่องข้อมูล — โหมดเหมือน ZORT ใช้ค่ากลางที่วัดจาก DOM · โหมดปกติคงของเดิม */
const ป้าย = เหมือนZORT ? ZORT_INFO_LABEL : 'text-[12.5px] text-gray-500'
const ค่า = เหมือนZORT ? ZORT_INFO_VALUE : 'text-[15px] text-gray-900'
const CARD_LIMIT = 100
/** ชุดที่มีรหัสนี้เป็นส่วนประกอบ — ถามด้วย `bundleitems&member=<รหัส>` */
interface InBundle { bundleSku: string; bundleName?: string; qty?: number }
/** ⚠️ `collectedAt` เป็น **UTC** (MAX ของ `bundle_items.at` ที่เขียนด้วย `datetime('now')`) — ชื่อช่องไม่ได้บอกไว้
 *  `collectedDayTH` = วันไทยสำเร็จรูปจากท่อ **ถ้ามีต้องใช้ก่อน** (ท่อรู้เขตเวลาของค่าตัวเอง ไม่ใช่ให้จอเดา)
 *  เส้นนี้ยังไม่ส่งมา ⇒ จอแปลงเองไปพลางก่อน และจะสลับมาใช้ของท่อเองเมื่อท่อเริ่มส่ง */
interface MemberResp { applied?: { member?: string }; rows?: InBundle[]; collectedAt?: string; collectedDayTH?: string | null }
/** ยอดขายรายเดือนของรหัสนี้ — ถามทีละเดือนด้วย `topproducts&sku=` */
/** จุดหนึ่งเดือนบนกราฟ
 *  🔴 `amount` ที่ท่อส่งมา **รวมใบที่ยังไม่จ่าย** (ฝั่งท่อวัดจริง 6 ก.ย. 2569: ทั้งระบบ ~฿564,000)
 *     ⇒ กราฟรายได้รายเดือนสูงเกินจริงมาตลอด · ท่อเพิ่ม unpaidAmount ให้แล้ว
 *  ⚠️ ไม่มีคีย์ = ท่อรุ่นเก่า ⇒ วาดเหมือนเดิมได้ **แต่ต้องเขียนกำกับว่ารวมใบที่ยังไม่จ่าย** */
interface MonthPoint { label: string; qty: number; amount: number; unpaid: number }

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
        /* 🔴 แยกส่วนที่ **ยังไม่จ่าย** ออกให้เห็น แทนที่จะรวมเป็นแท่งเดียว
           แท่งทึบ = เงินที่ได้จริง · แท่งจาง = ยังไม่จ่าย
           ⇒ กราฟรายได้ที่รวมเงินที่ยังไม่ได้รับ อ่านแล้วเข้าใจผิดว่าเดือนนั้นขายดี
           ⚠️ ท่อรุ่นเก่าไม่ส่ง unpaid ⇒ เป็น 0 ⇒ กราฟหน้าตาเหมือนเดิมทุกประการ */
        const unpaid = mode === 'amount' ? Math.max(0, Math.min(p.unpaid, p.amount)) : 0
        const hUnpaid = (unpaid / max) * (H - BOTTOM - 22)
        const hPaid = Math.max(h - hUnpaid, 0)
        return (
          <g key={p.label}>
            <rect x={x(i) - bw / 2} y={H - BOTTOM - hPaid} width={bw} height={Math.max(hPaid, v > 0 ? 1 : 0)} rx={3}
              className="fill-[#7c9cf0]" />
            {hUnpaid > 0 && (
              <rect x={x(i) - bw / 2} y={H - BOTTOM - h} width={bw} height={hUnpaid} rx={3}
                className="fill-[#f0c987]">
                <title>ยังไม่จ่าย {Math.round(unpaid).toLocaleString('th-TH')} บาท</title>
              </rect>
            )}
            {v > 0 && (
              <text x={x(i)} y={H - BOTTOM - h - 5} textAnchor="middle" className="fill-gray-500 text-[10px]">
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
  /* 🔴 **decodeURIComponent โยน error ได้ถ้าเจอ % ที่ไม่ใช่รหัส** — และมันอยู่ตอนวาดหน้า
     ⇒ ลิงก์เสียหนึ่งลิงก์ = **ทั้งหน้าตายเป็นจอขาว** ไม่ใช่แค่ช่องนั้นว่าง
     รหัสสินค้าของร้านมีทั้งไทยและอักขระพิเศษ (เช่น 01209-22.5T · โซ่-…) ⇒ เกิดได้จริง
     (จอคนเข้าเว็บเคยตายด้วยเหตุนี้มาแล้ว — ที่นั่นมี safeDecode ตั้งแต่ตอนนั้น) */
  const sku = (() => {
    const raw = String(params?.sku ?? '')
    try { return decodeURIComponent(raw) } catch { return raw }
  })()
  const [row, setRow] = useState<Row | null>(null)
  const [card, setCard] = useState<StockCardResp | null>(null)
  const [cardErr, setCardErr] = useState('')
  const [cardKind, setCardKind] = useState('all')
  const [cardLoading, setCardLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // ⚠️ กราฟต้องยิงเดือนละครั้ง (12 ครั้ง) ⇒ **ไม่โหลดเองตอนเปิดหน้า ต้องกดเอง**
  //    กติกาเจ้าของร้าน: จอที่ยิงหนักต้องกดเอง · และเปิดหน้าสินค้าบ่อยกว่าดูกราฟมาก
  const [chart, setChart] = useState<MonthPoint[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartErr, setChartErr] = useState('')
  const [chartMode, setChartMode] = useState<'amount' | 'qty'>('amount')
  const [inBundles, setInBundles] = useState<MemberResp | null>(null)
  /* แผนที่ป้ายของช่อง src — ท่อส่งมาที่เดียวในคำตอบ (ไม่ติดไปทุกแถว) ⇒ เก็บไว้ส่งให้ชิ้นส่วน
     ⚠️ ท่อรุ่นก่อนไม่ส่ง ⇒ null แล้วชิ้นส่วนจะตกไปใช้ srcNote ของแถว หรือขึ้นค่าดิบ */
  const [ป้ายที่มา, setป้ายที่มา] = useState<แผนที่ป้ายที่มา | null>(null)
  /* คำตอบของ list=stock ทั้งก้อน — ใช้อ่านว่าท่อบีบค่าที่เราขอไหม (clamped/applied)
     ⚠️ จอนี้ขอ limit=20 ซึ่งไม่ควรถูกบีบ ⇒ กล่องจะไม่ขึ้นในกรณีปกติ
        แต่ถ้าวันหนึ่งท่อลดเพดานลงต่ำกว่านี้ จอจะบอกทันที ไม่ใช่โชว์แถวน้อยลงเงียบ ๆ */
  const [คำตอบสต็อก, setคำตอบสต็อก] = useState<คำตอบที่อาจถูกบีบ | null>(null)
  const [showAllBundles, setShowAllBundles] = useState(false)
  const imgOf = useSkuImages(640)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sRes, bRes] = await Promise.all([
        fetch(`/api/web/core?list=stock&q=${encodeURIComponent(sku)}&limit=20&marketplaces=1`).then((r) => r.json()),
        // "รหัสนี้อยู่ในชุดไหนบ้าง" — ถามกลับทางกับ list=bundleitems&sku=
        fetch(`/api/web/core?list=bundleitems&member=${encodeURIComponent(sku)}`).then((r) => r.json()).catch(() => null),
      ])
      if (sRes?.error) throw new Error(sRes.error)
      const rows: Row[] = Array.isArray(sRes?.rows) ? sRes.rows : []
      // ⚠️ ค้นหาคืนหลายแถว — ต้องหาแถวที่รหัสตรงเป๊ะ ไม่ใช่หยิบแถวแรก
      setRow(rows.find((r) => r.sku === sku) ?? null)
      setป้ายที่มา(sRes?.srcLabels && typeof sRes.srcLabels === 'object' ? sRes.srcLabels : null)
      setคำตอบสต็อก(sRes ?? null)
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

  /** สต็อกการ์ด — ท่อ `list=stockcard` (ฝั่งเซิร์ฟเวอร์ทำเสร็จ 3 ก.ย. 2569)
   *
   *  🔴 **ตัวกรองย้ายไปอยู่ฝั่งเซิร์ฟเวอร์แล้ว ห้ามกรองซ้ำในจอ**
   *     ของเดิมดึงมาทั้งก้อนแล้วกรองในเบราว์เซอร์ ⇒ เลือก "รายการขายเท่านั้น"
   *     จะได้แค่ขายที่ติดมาใน 50 แถวแรก ไม่ใช่ 50 แถวขายจริง
   *  🔴 **คำตอบที่มาช้าห้ามทับของใหม่** — กดสลับตัวกรองรัว ๆ คำขอเก่าอาจถึงทีหลัง
   *     `seq` กันเรื่องลำดับ · `applied` กันเรื่องเนื้อหา — **คนละหน้าที่ ต้องมีทั้งคู่** */
  const cardSeq = useRef(0)

  /* เปิดใบขายจากช่องอ้างอิงในสต็อกการ์ด — สามสถานะแยกกันชัด (ดู lib/open-order.ts) */
  const [openingRef, setOpeningRef] = useState('')
  const [refErr, setRefErr] = useState<{ ref: string; msg: string } | null>(null)
  /* ตรวจกับ ZORT สด ๆ ว่าตัวกรองรายคลังใช้ได้หรือยัง — ท่อเปิดเส้น ?zortwarehouse= ให้แล้ว
     (ยิงเฉพาะตอนกด ตามกติกาห้ามเช็คอัตโนมัติ) · สามสถานะ: ยังไม่ถาม · ถามไม่ได้ · ได้คำตัดสิน */
  const [whProbe, setWhProbe] = useState<{ verdict?: string; error?: string } | null>(null)
  const [whAsking, setWhAsking] = useState(false)
  const probeWarehouse = useCallback(async () => {
    setWhAsking(true)
    try {
      const res = await fetch(`/api/web/core?zortwarehouse=1&sku=${encodeURIComponent(sku)}`)
      const j = await res.json().catch(() => null)
      if (!res.ok || !j || j.error || j.skip) {
        setWhProbe({ error: String(j?.error || j?.skip || `ท่อตอบ ${res.status}`) })
      } else if (typeof j.verdict !== 'string') {
        setWhProbe({ error: 'ท่อตอบมาไม่มีคำตัดสิน (verdict)' })
      } else {
        setWhProbe({ verdict: j.verdict })
      }
    } catch (e) {
      setWhProbe({ error: String(e instanceof Error ? e.message : e) })
    } finally { setWhAsking(false) }
  }, [sku])

  const openRef = useCallback(async (ref: string) => {
    setOpeningRef(ref); setRefErr(null)
    const r = await findOrderId(ref)
    if (r.ok) router.push(`/core/sales/detail?id=${encodeURIComponent(r.id)}`)
    else setRefErr({ ref, msg: r.msg })
    setOpeningRef('')
  }, [router])

  const loadCard = useCallback(async (kind: string) => {
    const my = ++cardSeq.current
    setCardLoading(true)
    try {
      const qs = new URLSearchParams({ list: 'stockcard', sku, kind, limit: String(CARD_LIMIT) })
      const j: StockCardResp | null = await fetch(`/api/web/core?${qs}`)
        .then((r) => r.json()).catch(() => null)
      if (my !== cardSeq.current) return // มีคำขอใหม่แซงไปแล้ว — ทิ้งของเก่า
      if (!j || j.error) {
        setCard(null)
        setCardErr(j?.error || 'ยิงไปที่ท่อสต็อกการ์ดไม่สำเร็จ')
        return
      }
      // ⚠️ ด่านจริง: เซิร์ฟเวอร์ต้องยืนยันว่าอ่านทั้งรหัสและตัวกรองที่เราส่งไป
      //    ไม่ตรง = **ทิ้งทั้งชุด** ดีกว่าโชว์ความเคลื่อนไหวของสินค้าตัวอื่น/ตัวกรองอื่น
      if (j.applied?.sku !== sku || j.applied?.kind !== kind) {
        setCard(null)
        // ท่อบอกเหตุผลมาเองได้ (note/ignored) — ใช้ของเขาดีกว่าเดาแทน
        setCardErr(j.note || 'เซิร์ฟเวอร์ไม่ได้ตอบตามรหัส/ตัวกรองที่ขอ — ไม่แสดงตารางดีกว่าแสดงผิด')
        return
      }
      setCardErr('')
      setCard(j)
    } finally {
      if (my === cardSeq.current) setCardLoading(false)
    }
  }, [sku])

  useEffect(() => { loadCard(cardKind) }, [loadCard, cardKind])

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
        slots.push({ label: `${TH_MON[d.getMonth()]}/${String(d.getFullYear() + 543).slice(2)}`, qty: 0, amount: 0, unpaid: 0 })
      }
      const qs = new URLSearchParams({
        list: 'topproducts', sku, by: 'month',
        // ⚠️ วันแบบไทย (UTC+7) — ใช้ UTC ตรง ๆ จะได้ "เมื่อวาน" ในช่วงตี 1 ถึง 7 โมงเช้า
        //    ⇒ ความเคลื่อนไหวของเช้าวันนั้นหายจากประวัติสต็อกเงียบ ๆ
        from: HISTORY_FROM, to: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
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
          // ⚠️ ท่อรุ่นเก่าไม่ส่งช่องนี้ ⇒ เป็น 0 แล้วจอจะไม่พูดถึงเรื่องยังไม่จ่ายเลย (ไม่ใช่พูดผิด)
          slots[i].unpaid = Number(it.unpaidAmount) || 0
        }
      }
      setChart(slots)
    } finally {
      setChartLoading(false)
    }
  }, [sku])

  /* 📐 โหมดเหมือน ZORT: การ์ด "ยอดขายเดือนนี้" ขึ้นเลขทันทีแบบ ZORT ⇒ ยิงคำขอรายเดือนครั้งเดียวตอนเปิดจอ (เดิมรอกดแสดงกราฟ) */
  useEffect(() => { if (เหมือนZORT) void loadChart() }, [loadChart])
  /* 🔴 **ZORT นับร้านเดียว (z1) — กราฟของเรารวมสองร้าน** (วัด 00817 20 ต.ค. 2569: ZORT 1,551.58 · z1 1,470 · z2 1,274 · รวม 2,744)
     ⇒ การ์ดที่ใช้ป้ายเดียวกับ ZORT ต้องเป็นเลขร้านเดียวกับ ZORT · เลขรวมสองร้านอยู่ใน title ของการ์ด (กฎแท็บข้อ 4: คนละแหล่งห้ามวางเฉย ๆ)
     null = ยังไม่รู้/ท่อไม่ยืนยันร้าน ⇒ การ์ดขึ้นขีด ไม่ถอยไปใช้เลขรวม */
  const [เดือนนี้z1, setเดือนนี้z1] = useState<number | null>(null)
  useEffect(() => {
    if (!เหมือนZORT) return
    let ยกเลิก = false
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
    const qs = new URLSearchParams({ list: 'topproducts', sku, by: 'month', from: `${today.slice(0, 8)}01`, to: today, store: 'z1' })
    fetch(`/api/web/core?${qs}`).then((r) => r.json()).then((j) => {
      if (ยกเลิก) return
      if (j?.applied?.sku !== sku || j?.applied?.store !== 'z1') { setเดือนนี้z1(null); return }
      const it = (Array.isArray(j.items) ? j.items : []).find((x: { month?: string }) => String(x.month) === today.slice(0, 7))
      setเดือนนี้z1(it ? Number(it.amount) || 0 : 0)
    }).catch(() => { if (!ยกเลิก) setเดือนนี้z1(null) })
    return () => { ยกเลิก = true }
  }, [sku])

  const img = imgOf(sku)
  const cardRows = Array.isArray(card?.rows) ? card!.rows! : []
  /** ยอดขายเดือนนี้ — ช่องสุดท้ายของกราฟคือเดือนปัจจุบันเสมอ (loop สร้างถึง i=0)
   *  null = ยังไม่ได้กดดูกราฟ ⇒ **ยังไม่รู้** ไม่ใช่ "ขายไม่ได้เลย" — ห้ามแสดงเป็น 0 */
  const thisMonth = chart && chart.length > 0 ? chart[chart.length - 1].amount : null

  return (
    <div className="p-4 md:p-6">
      <Link href="/core/stock" className={ZORT_BACK_LINK}>‹ สินค้า</Link>

      {error && <ErrorBox title="ดึงข้อมูลสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !row && <LoadingState />}

      {!loading && !row && !error && (
        <div className="bg-white border border-gray-200 rounded-md p-6 mt-3 text-[12.5px] text-gray-500">
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
                {/* 📏 วัดซ้ำ 20 ต.ค. 2569: Share Link ของ ZORT เป็นปุ่มแบบลิงก์ Kanit 12 #868e96 (ไม่ใช่ปุ่มกรอบ 39 อย่างที่จด 17 ต.ค.) ⇒ SHARE_LINK_Z ในโหมด ZORT */}
                <button type="button" className={เหมือนZORT ? SHARE_LINK_Z : DETAIL_BTN} onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => {}) }}>
                  {/* 📐 โหมดเหมือน ZORT: คำบนปุ่ม "Share Link" ตาม ZORT · คำของเราอยู่ใน title (สิ่งที่ปุ่มทำจริง) */}
                  {เหมือนZORT ? <span title="คัดลอกลิงก์หน้านี้" className="inline-flex items-center gap-1"><IconShare />Share Link</span> : 'คัดลอกลิงก์หน้านี้'}
                </button>
                {/* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — ZORT /Product/Details ไม่มี */}
              </>
            }
          />

          {/* ⚠️ ZORT มีปุ่ม 7 ปุ่มแถวนี้ — ของเราทำได้จริงเฉพาะที่มีท่อรองรับ
              ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก ⇒ ที่ยังไม่ได้ทำพาไปหน้าที่บอกตรง ๆ
              ✅ แก้ไข/ลบ มีจอจริงแล้ว (14 ก.ย. 2569 · งานกระดาน t_mu0tx2wj) — ปุ่มส่งจริงยังปิดรอท่านประธานอนุมัติ
                 ลบกับแก้อยู่หน้าเดียวกัน เพราะต้องถาม id ของ ZORT ก่อนเหมือนกัน */}
          {/* 📐 โหมดเหมือน ZORT: ระยะหัวจอ→แถบปุ่ม 27 (วัด DOM /Product/Details 19 ต.ค. 2569: หัวจอจบ 166 ปุ่มเริ่ม 193 · ของเราเดิม 178) · ⚠️ margin ยุบรวมกับ mb ของหัวจอ (16) ⇒ ต้องใส่ 27 เต็ม ไม่ใช่ส่วนต่าง */}
          <div className={`flex flex-wrap items-center gap-2 ${เหมือนZORT ? 'mt-[27px]' : '-mt-1'} mb-4`}>
            {/* โหมดเหมือน ZORT: ไอคอนหน้าคำแบบ ZORT (ดินสอ · ถังขยะ · บวกในวง · เครื่องพิมพ์) */}
            <Link href={`/core/stock/${encodeURIComponent(sku)}/edit`}
              className={`${DETAIL_BTN} inline-flex items-center gap-1`}>
              {เหมือนZORT && <IconEdit />}แก้ไข
            </Link>
            <Link href={`/core/stock/${encodeURIComponent(sku)}/edit#delete`}
              className={`${DETAIL_BTN} inline-flex items-center gap-1`}>
              {เหมือนZORT && <IconTrash />}ลบ
            </Link>
            {/* คำสั่ง ▾ — ZORT /Product/Details มีแค่ ซื้อสินค้า · ขายสินค้า · โอนสินค้า (อ่านเมนูจาก HTML 16 ต.ค. 2569)
                ⇒ หยิบสามข้อนี้จากเมนูชุดเดียวกับ ⋮ ในตาราง (ทางไปจริงอยู่ที่เดียว) · ตำแหน่งต่อจาก "ลบ" ตาม ZORT */}
            <RowMenu label="คำสั่ง" items={productMenuItems(sku, (href) => router.push(href))
              .filter((it) => ['ซื้อสินค้า', 'ขายสินค้า', 'โอนสินค้า'].includes(it.label))} />
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
              className={เหมือนZORT ? `${DETAIL_BTN_OFF} inline-flex items-center gap-1` : 'text-[12.5px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-not-allowed'}
            >
              {เหมือนZORT && <IconPlusCircle />}ปรับจำนวน
            </span>
            <Link href={`/core/stock/print?sku=${encodeURIComponent(sku)}`}
              className={`${DETAIL_BTN} inline-flex items-center gap-1`}>
              {เหมือนZORT && <IconPrint />}พิมพ์เอกสาร
            </Link>
            {/* อัพเดทช่องทางอื่น ▾ — ZORT เป็นเมนู 3 ข้อ (อัพเดทจำนวน/ข้อมูลสินค้า · เพิ่มสินค้าไปช่องทางการขายอื่น) · ใช้ชุดเดียวกับเมนูตาราง */}
            <RowMenu label="อัพเดทช่องทางอื่น" items={productMenuItems(sku, (href) => router.push(href))
              .filter((it) => it.label.endsWith('ไปช่องทางการขายอื่น'))} />
            {/* ZORT มีปุ่มนี้ — ประวัติว่าใครแก้อะไรเมื่อไหร่ · คลังเงาไม่ได้เก็บเลย */}
            <span
              title="คลังเงาไม่ได้เก็บประวัติว่าใครแก้อะไรเมื่อไหร่ — ดูได้ที่ ZORT เท่านั้น"
              className={เหมือนZORT ? DETAIL_BTN_OFF : 'text-[12.5px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-not-allowed'}
            >
              ดูกิจกรรมของรายการ
            </span>
          </div>

          {/* 📐 โหมดเหมือน ZORT — วัด DOM /Product/Details 19 ต.ค. 2569 (สินค้า 00817 อ่านอย่างเดียว):
              กล่องขาว ช่องใน 20 · ซ้ายวงไอคอน 48 · ขวาป้าย Boon 14 w500 #3e3e3e พร้อมหน่วย · ค่า Lato 30 w600 สีประจำการ์ด
              คงเหลือ วง #ebf6ff สี #2f8dde · พร้อมขาย วง #cefff1 สี #13af82 · ยอดขาย วง #d0daff สี #4165ed (สัญลักษณ์ในวงเป็นของเรา)
              · กล่องที่มาของเลขพร้อมขาย (สำคัญ: อธิบายว่าทำไมต่างจาก ZORT) ย้ายไปพับใต้การ์ด ไม่ถอด */}
          {เหมือนZORT && (() => {
            const หน่วย = row.unit ? ` (${row.unit})` : ''
            return (
              <>
                <ZortKpiCards items={[
                  { ป้าย: 'สินค้าคงเหลือ' + หน่วย, วง: '#ebf6ff', สี: '#2f8dde', รูป: '▦', ค่า: fmtNum(Number(row.qty ?? 0)) },
                  { ป้าย: 'สินค้าพร้อมขาย' + หน่วย, วง: '#cefff1', สี: '#13af82', รูป: '✓', ค่า: row.available == null ? '-' : fmtNum(Number(row.available)), ว่าง: row.available == null },
                  { ป้าย: 'ยอดขายเดือนนี้ (บาท)', วง: '#d0daff', สี: '#4165ed', รูป: '฿', ค่า: เดือนนี้z1 == null ? '-' : fmtMoney(เดือนนี้z1), ว่าง: เดือนนี้z1 == null,
                    เหตุ: `ร้านออนไลน์ z1 (ร้านเดียวกับ ZORT)${thisMonth != null ? ` · รวมสองร้าน ${fmtMoney(thisMonth)} บาท` : ''} · ยอดบรรทัดสินค้า ตัดใบยกเลิก ยังรวมใบค้างจ่าย` },
                ]} />
                {/* กล่องพับที่มาของเลข ย้ายไปท้ายจอ (21 ต.ค. 2569) — ใต้การ์ดดันกล่องรายละเอียดลง ~16 จาก ZORT · ยังเห็นบนจอ ไม่ถอด */}
                <ClampedNote resp={คำตอบสต็อก} ขอ={{ limit: 20, q: sku }} />
              </>
            )
          })()}
          {/* การ์ด 3 ใบแบบ ZORT — ค่าว่างแสดงเป็น "-" ตามจอเขา */}
          {!เหมือนZORT && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-[12.5px] text-gray-500 text-right">สินค้าคงเหลือ</p>
              <p className={`text-[28px] font-semibold text-right leading-none mt-1 ${
                Number(row.qty) < 0 ? 'text-red-500' : 'text-gray-900'
              }`}>
                {fmtNum(Number(row.qty ?? 0))}
              </p>
            </Card>
            <Card>
              <p className="text-[12.5px] text-gray-500 text-right">สินค้าพร้อมขาย</p>
              <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-900">
                {/* ⚠️ null = ยังไม่มีในทะเบียน **ห้ามเดาว่าเท่ากับคงเหลือ** */}
                {row.available == null ? <span className="text-gray-300">-</span> : fmtNum(Number(row.available))}
              </p>
              {/* 🔑 ที่มาของเลขนี้ — เลขพร้อมขายมาจากภาพถ่ายคลังเงา และบางรหัสทะเบียนทับ ZORT โดยตั้งใจ
                  ⇒ ไม่มีบรรทัดนี้ คนจะเทียบกับ ZORT แล้วสรุปว่าระบบเพี้ยน (ใบ t_mul363qv) */}
              <div className="mt-2 text-left"><StockSource row={row} ป้าย={ป้ายที่มา} /></div>
              <ClampedNote resp={คำตอบสต็อก} ขอ={{ limit: 20, q: sku }} />
            </Card>
            <Card>
              <p className="text-[12.5px] text-gray-500 text-right">ยอดขายเดือนนี้ (บาท)</p>
              {/* ⚠️ ห้ามเอา sold (จำนวนที่ขายได้ 30 วัน) มาคูณราคาขายแล้วบอกว่าเป็นยอดเงิน
                  ราคาที่ขายจริงต่างจากราคาป้ายได้ (ส่วนลด · โปรมาร์เก็ตเพลส)
                  🔴 บรรทัดล่างเคยเขียนว่า "ยังไม่มีท่อยอดขายรายสินค้าเป็นเดือน" แล้วค้าง
                     หลังท่อ topproducts&sku=&by=month เสร็จ (3 ก.ย. 2569) — กราฟข้างล่าง
                     ใช้ท่อนั้นอยู่ทั้งที่การ์ดนี้ยังบอกว่าไม่มี ⇒ ข้อความค้างจุดที่ 3 ของหน้าเดียวกัน
                  ⚠️ ไม่ยิงเองตอนเปิดหน้าโดยตั้งใจ — ค่านี้มากับกราฟในคำขอเดียวกันอยู่แล้ว
                     ยิงซ้ำ = เพิ่มการเรียกฟังก์ชันทุกครั้งที่เปิดหน้าสินค้า เพื่อเลขที่กดดูได้อยู่แล้ว */}
              {thisMonth == null ? (
                <>
                  <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-300">-</p>
                  <p className="text-[11.5px] text-gray-400 text-right mt-1">
                    กด &quot;ดูกราฟยอดขาย&quot; ด้านล่าง แล้วเลขนี้จะขึ้นเอง
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-900">
                    {fmtMoney(thisMonth)}
                  </p>
                  <p className="text-[11.5px] text-gray-400 text-right mt-1">จากใบขายจริงในคลังเงา</p>
                </>
              )}
            </Card>
          </div>}

          {/* กล่องข้อมูล — รูปซ้าย ขวาสองคอลัมน์ ตามผัง ZORT */}
          {/* 📏 DOM /Product/Details 21 ต.ค. 2569: การ์ด KPI → กล่องรายละเอียด ZORT ห่าง 31 ของเรา 24 ⇒ mt 31 (รอบแรกใส่ 51 ผิด: ตัววัดฝั่ง ZORT หยิบกล่องในที่เยื้องช่องใน 20 ไม่ใช่ขอบการ์ด — ภาพยืนยัน 31) */}
          <div className={`bg-white p-5 flex flex-wrap gap-6 ${เหมือนZORT ? 'rounded-[6px] mt-[31px]' : 'border border-gray-200 rounded-md mt-4'}`}>
            {/* 🖼️ ลำดับรูปตามที่ฝั่งท่อกำหนด (fc52832):
                   ① แผนที่รูปย่อของเรา (128px · เบา) ② ไม่มีค่อยใช้ `imagePath` ของ ZORT (ไฟล์ดิบ)
                   ③ ไม่มีทั้งคู่ ⇒ **แยกให้ออกว่า "ZORT ไม่มีรูป" กับ "ยังไม่รู้"**
                      กล่องเทาเฉย ๆ บอกไม่ได้ว่าต้องไปถ่ายรูปเพิ่ม หรือรอระบบซิงก์
                ⚠️ ไฟล์ดิบใหญ่ ⇒ ใส่ `loading="lazy"` + กรอบขนาดตายตัวกันจอกระตุก */}
            {pickImage(img, row, 640, true)
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pickImage(img, row, 640, true) as string}
                  alt=""
                  loading="lazy"
                  className={เหมือนZORT ? 'w-[220px] h-[220px] object-cover bg-white' /* ZORT: กล่องจัตุรัส (รูปของ ZORT เป็นจัตุรัส) · รูปของเราบางตัวเป็นแนวตั้ง ⇒ ปล่อยสัดส่วนจริงแล้วสูงเกิน (วัด 29.1 · เห็นในภาพ 19 ต.ค.) */ : 'w-[220px] h-[160px] rounded border border-gray-200 object-cover bg-white'}
                />
              )
              : (
                <span className="w-[220px] h-[160px] rounded border border-gray-200 bg-gray-100 flex flex-col items-center justify-center gap-1 text-center px-3">
                  <span className="text-[28px] text-gray-300">🖼️</span>
                  <span className="text-[11.5px] text-gray-500">
                    {noImageReason(row) === 'zort-none'
                      ? 'ZORT ไม่มีรูปของรหัสนี้ — ต้องถ่ายรูปเพิ่ม'
                      : 'ยังไม่รู้ว่ามีรูปไหม (รหัสนี้ไม่อยู่ในทะเบียนสินค้า หรือยังไม่ซิงก์)'}
                  </span>
                </span>
              )}

            {/* 📱 จอเล็กกว่า md: คอลัมน์รายละเอียดขึ้นบรรทัดใหม่เต็มกว้างใต้รูป — เดิมถูกบีบเหลือ 59 ข้างรูป ⇒ QR ล้นจอ (หน้า 438 · 21 ต.ค. 2569) */}
            <div className="min-w-0 flex-1 basis-full md:basis-0">
              <p className={เหมือนZORT ? `${ZORT_INFO_NAME} mb-2` : 'text-[15px] font-semibold text-gray-900'}>{row.name || sku}{เหมือนZORT && typeof row.category === 'string' && row.category.trim() ? ` (${row.category.trim()})` : ''}</p>
              {/* โหมดเหมือน ZORT: ชื่อเต็มบรรทัดอยู่เหนือ [ข้อมูล | QR] — แบบ ZORT (QR เริ่มใต้ชื่อ ชื่อไม่ถูกบีบจนตกสองบรรทัด) */}
              <div className={เหมือนZORT ? 'flex flex-wrap md:flex-nowrap items-start gap-6' : ''}>
              {/* 🧭 โหมดเหมือน ZORT: ลำดับช่องตาม /Product/Details (รหัส · ราคาขาย · น้ำหนัก · ราคาซื้อ · ต้นทุนเฉลี่ย · ชุด) ด้วย order
                     ไม่ย้ายโค้ด ⇒ โหมดปกติเรียงเดิม · คอลัมน์ละ 250 ตาม ZORT · ป้าย/ค่าใช้ค่ากลาง ZORT_INFO_* */}
              <div className={เหมือนZORT ? 'grid grid-cols-2 gap-y-[18px] mt-4 max-w-[500px]' : 'grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 mt-4 max-w-[640px]'}>
                <div className={`${เหมือนZORT ? 'order-1' : ''}`}>
                  <p className={ป้าย}>รหัสสินค้า</p>
                  <p className={ค่า}>{row.sku}</p>
                </div>
                <div className={`${เหมือนZORT ? 'order-2' : ''}`}>
                  <p className={ป้าย}>ราคาขาย</p>
                  <p className={ค่า}>
                    {typeof row.price === 'number' ? `${fmtMoney(row.price)} บาท` : '-'}
                  </p>
                </div>
                <div className={`${เหมือนZORT ? 'order-5' : ''}`}>
                  <p className={ป้าย}>ต้นทุนคงเหลือเฉลี่ย</p>
                  {/* 🔴 ต้นทุนเฉลี่ยเรามีแค่ **ระดับหมวด** (คัดจากจอ ZORT) ไม่มีระดับสินค้า
                      ⇒ ขึ้นขีด + บอกว่าไปดูที่ไหนได้ · ห้ามเอาราคาซื้อในทะเบียนมาแสดงแทน
                      เพราะพิสูจน์แล้วว่ามันต่ำกว่าต้นทุนจริง 2-3 เท่า */}
                  <p className={เหมือนZORT ? ค่า : 'text-[15px] text-gray-300'}>-</p>
                  <p className="text-[11.5px] text-gray-400">
                    มีเฉพาะระดับหมวด · ดูที่ <Link href="/core/categories" className="text-[#337ab7] hover:underline">หมวดหมู่</Link>
                  </p>
                </div>
                <div className={`${เหมือนZORT ? 'order-4' : ''}`}>
                  <p className={ป้าย}>ราคาซื้อ</p>
                  <p className={ค่า}>
                    {/* ⚠️ null = ยังไม่ได้กรอก ไม่ใช่ 0 */}
                    {row.buy == null ? <span className="text-gray-300">-</span> : `${fmtMoney(row.buy)} บาท`}
                  </p>
                </div>
                <div className={`sm:col-span-2 ${เหมือนZORT ? 'order-6' : ''}`}>
                  <p className={ป้าย}>สินค้าในสินค้าเป็นชุด</p>
                  {(() => {
                    const list = inBundles?.rows ?? []
                    // ⚠️ ไม่มีคำตอบจากท่อ ≠ ไม่อยู่ในชุดไหน — ต้องเขียนต่างกัน
                    if (!inBundles) return <p className="text-[12.5px] text-gray-400">ยังดูย้อนไม่ได้รอบนี้</p>
                    /* 🔴 ไม่ตัดสินจาก list.length อย่างเดียว (ใบ CEO 17:56): ท่อบอกว่าไม่รู้จักรหัส ⇒ เขียนตรง ๆ
                       · ท่อรุ่นเก่าที่ยังไม่ส่ง asked: รหัสนี้ยืนยันแล้วจาก list=stock ในจอเดียวกัน (row ไม่ว่าง) ⇒ 0 แถว = ว่างจริง */
                    if (list.length === 0) {
                      const สภาพ = สภาพแถวชุด(inBundles)
                      if (สภาพ.ชนิด === 'ไม่รู้จักรหัส') return <p className="text-[12.5px] text-amber-800">ทะเบียนสินค้าไม่รู้จักรหัส {สภาพ.รหัส || sku} — บอกไม่ได้ว่าอยู่ในชุดไหน</p>
                      return <p className="text-[15px] text-gray-500">ไม่มีข้อมูล</p>
                    }
                    const show = showAllBundles ? list : list.slice(0, 5)
                    return (
                      <>
                        <p className="text-[12.5px] leading-relaxed">
                          {show.map((b, i) => (
                            <span key={b.bundleSku}>
                              {i > 0 && ', '}
                              <Link href={`/core/bundles/${encodeURIComponent(b.bundleSku)}`}
                                className="text-[#337ab7] hover:underline" title={b.bundleName || ''}>
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
                        {/* 🔴 **ข้อความเดิม "(ไม่ได้ซิงก์เอง)" กลายเป็นเท็จ 14 ก.ย. 2569**
                            ฝั่งท่อทำให้ซิงก์สูตรทุกชั่วโมงแล้ว (gucut-web a17692b)
                            ⚠️ และ collectedAt คือ "สูตรเปลี่ยนล่าสุด" ไม่ใช่ "ตรวจล่าสุด"
                               ⇒ ชุดที่ไม่มีใครแก้จะค้างที่ 3 ก.ย. ตลอดไป ห้ามเอาไปสื่อว่าข้อมูลเก่า */}
                        {(inBundles.collectedDayTH || inBundles.collectedAt) && (
                          <p className="text-[11.5px] text-gray-400 mt-0.5">
                            {/* 🔴 เดิมโชว์ `collectedAt.slice(0, 10)` ⇒ **เป็นวัน UTC และเป็นปี ค.ศ. ดิบ** สองเรื่องในจุดเดียว
                                (`collectedAt` = MAX ของ `bundle_items.at` ซึ่งเขียนด้วย `datetime('now')` = UTC · แก้ 18 ก.ย. 2569) */}
                            อยู่ใน {list.length} ชุด · สูตรชุด<b>เปลี่ยนล่าสุด</b> {inBundles.collectedDayTH ? thaiDate(inBundles.collectedDayTH) : thaiDateUtc(inBundles.collectedAt)}
                            {' '}(ซิงก์จาก ZORT ทุกชั่วโมง — ชุดที่ไม่มีใครแก้ วันที่นี้จะไม่ขยับ)
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div className={`${เหมือนZORT ? 'order-3' : ''}`}>
                  <p className={ป้าย}>{เหมือนZORT ? 'น้ำหนัก' : 'น้ำหนัก (กรัม)'}</p>
                  {/* ⚠️ null = ยังไม่ได้กรอกใน ZORT · 0 = ของไม่มีน้ำหนักจริง ๆ — ห้ามยุบรวมกัน
                      ทั้งคลังมีน้ำหนักจริงแค่ 23% ⇒ ช่องนี้ขึ้นขีดเป็นเรื่องปกติ ไม่ใช่ท่อพัง */}
                  <p className={ค่า}>
                    {row.weight == null
                      ? <span className="text-gray-300">-</span>
                      : `${fmtNum(Number(row.weight))} กรัม`}
                  </p>
                  {row.weight == null && (
                    <p className="text-[11.5px] text-gray-400">ยังไม่ได้กรอกน้ำหนักที่ ZORT</p>
                  )}
                </div>
                <div className={`${เหมือนZORT ? 'order-7' : ''}`}>
                  <p className={ป้าย}>ลงขายที่</p>
                  <div className="text-[15px]"><MarketLogos list={row.marketplaces} by={row.marketplacesBy} from={row.marketplacesFrom} /></div>
                </div>
              </div>
                {/* โหมดเหมือน ZORT: QR + บาร์โค้ดมุมขวาในกล่องข้อมูล (ZORT วางที่นี่ ไม่ใช่ท้ายจอ)
                    · ห่างขอบขวาการ์ด ~90px (ภาพสองฝั่ง 19 ต.ค. 2569: ZORT 90 · เราเดิม 28) */}
                {เหมือนZORT && <div className="md:ml-auto md:mr-[62px] mt-4 shrink-0"><SkuCodes sku={sku} แบบZORT บาร์โค้ด={{ w: 158, h: 50 }} /></div>}
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
                className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-white max-w-full"
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
              ? (
                <>
                  <SalesBars points={chart} mode={chartMode} />
                  {/* 🔴 มีคำอธิบายสีเฉพาะตอนมีของจริง — ไม่มีเงินค้างก็ไม่ต้องรกจอ */}
                  {chartMode === 'amount' && chart.some((p) => p.unpaid > 0) && (
                    <p className="text-[11.5px] text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-[#7c9cf0]" /> เงินที่ได้จริง
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-[#f0c987]" /> ยังไม่จ่าย
                      </span>
                      <span className="text-gray-400">
                        — รวมกันคือยอดขายตามใบ · <b>ส่วนจางยังไม่ใช่เงินที่ได้รับ</b>
                      </span>
                    </p>
                  )}
                </>
              )
              : (
                <div className="py-10 text-center">
                  <p className="text-[12.5px] text-gray-600">กดปุ่ม <b>แสดงกราฟ</b> เพื่อคิดยอดขายรายเดือน</p>
                  {/* ⚠️ บอกด้วยว่าทำไมไม่โหลดเอง — ไม่งั้นดูเหมือนจอโหลดไม่ขึ้น */}
                  <p className="text-[11.5px] text-gray-400 mt-1">
                    ยิงครั้งเดียวได้ครบ 12 เดือน — แต่ไม่โหลดเองตอนเปิดหน้า
                    เพราะคนเปิดหน้าสินค้าบ่อยกว่าดูกราฟมาก
                  </p>
                  {chartErr && <p className="text-[12.5px] text-amber-800 mt-2">⚠️ {chartErr}</p>}
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
              <p className="text-[12.5px] text-gray-700 mt-2">ยังไม่มีข้อมูลแยกรายคลัง</p>
              <p className="text-[12.5px] text-gray-500 mt-1 max-w-[440px] leading-relaxed">
                {/* เดิมเขียนว่า "ยังไม่ได้ลองระดับพารามิเตอร์" — ค้างแล้ว: ท่อลองให้แล้ว (?zortwarehouse=)
                    ผลยิงจริง 10 ก.ย. 2569: ใส่ warehouseid แล้ว **เลขไม่เปลี่ยน** = ZORT เมินพารามิเตอร์ */}
                ตรวจระดับพารามิเตอร์แล้ว (10 ก.ย. 2569): ส่ง warehouseid ให้ ZORT
                แล้ว<b>ตัวเลขไม่เปลี่ยน</b> — ZORT เมินตัวกรองคลัง ·
                คลังเงาจึงเก็บได้แค่สต็อกรวมทั้งร้าน เป็น<b>ข้อจำกัดของต้นทาง ไม่ใช่ของที่ยังทำไม่เสร็จ</b>
              </p>
              {/* ปุ่มตรวจซ้ำ — วันที่ ZORT เริ่มรองรับจริง คำตัดสินบนจอจะเปลี่ยนเอง
                  (กติกา nets-expire-silently: ข้อจำกัดของต้นทางก็หมดอายุได้ ต้องมีทางตรวจใหม่) */}
              <div className="mt-3">
                <button type="button" onClick={probeWarehouse} disabled={whAsking}
                  className="text-[12.5px] text-blue-600 hover:underline disabled:opacity-50">
                  {whAsking ? 'กำลังถาม ZORT…' : 'ตรวจกับ ZORT อีกครั้ง (รหัสนี้)'}
                </button>
                {whProbe?.verdict && (
                  <p className="text-[12.5px] text-gray-700 mt-1 max-w-[440px]">ผลสด: {whProbe.verdict}</p>
                )}
                {whProbe?.error && (
                  <p className="text-[12.5px] text-amber-700 mt-1">⏳ ถามไม่ได้: {whProbe.error}</p>
                )}
              </div>
            </div>
          </Card>

          {/* การ์ด "รายงาน" — สต็อกการ์ด ลอกผังจาก `zort-ui/21-รายละเอียดสินค้า.jpg`
              หัวการ์ด "รายงาน" ซ้าย · ขวามีสองตัวกรอง (การแสดงผล · คลังสินค้า/สาขา)
              คอลัมน์ ZORT 8 ช่อง: วันที่ · ประเภท · สถานะ · รายการ · จำนวน · จาก · ไป · คงเหลือ */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">รายงาน</p>

              <label className="text-[12.5px] text-gray-500">การแสดงผล</label>
              {/* ⚠️ ZORT มี 8 ตัวเลือก เราทำได้ 4 (+ ปรับในระบบเราต่อท้าย) — **ที่เหลือขึ้นเป็นตัวเลือกสีเทาพร้อมเหตุ**
                  ซ่อนทิ้ง = ไม่มีอะไรบอกว่าขาดอะไร · ใส่ให้กดได้ = ตัวเลือกหลอก
                  (ท่าเดียวกับปุ่ม "ปรับจำนวน" ที่เป็นสีเทาพร้อมเหตุผล) */}
              <select
                value={cardKind}
                onChange={(e) => setCardKind(e.target.value)}
                className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-white max-w-full"
              >
                {/* 🗂 ชื่อและลำดับตาม `typetransactionoption` ของ ZORT 8 ค่า (อ่านจอจริง 16 ต.ค. 2569)
                    แต่ละค่าผูกกับคีย์ของท่อ · เปิดได้เฉพาะเมื่อท่อประกาศคีย์นั้นใน kinds (ไม่ใช่เดาจากชื่อ)
                    ⚠️ คีย์ adjust ของท่อ = ปรับด้วยมือในระบบเรา ≠ "ปรับและยกมา" ของ ZORT (ใบ TF- ของ ZORT) ⇒ แยกเป็นตัวเลือกท้ายของเราเอง */}
                {(() => {
                  const kinds = card?.kinds ?? [{ key: 'all', label: '' }]
                  const มีคีย์ = new Set(kinds.map((k) => k.key))
                  /* วันที่ท่อเพิ่มชนิดใหม่โดยใช้คำเดียวกับ ZORT ตัวเลือกต้องเปิดเอง ไม่ค้างเป็นสีเทาโกหก ⇒ จับคู่ด้วยชื่อด้วย */
                  const คีย์จากชื่อ = (label: string) => kinds.find((k) => k.label === label)?.key
                  const ZORT8: { label: string; key?: string; เหตุ: string }[] = [
                    { label: 'การเคลื่อนไหว', key: 'all', เหตุ: '' },
                    { label: 'การเคลื่อนไหวที่รอโอนเท่านั้น', เหตุ: 'ยังไม่มีใบรอโอนรายสินค้า' },
                    { label: 'รายการปรับและยกมาเท่านั้น', เหตุ: 'ยังไม่มีใบปรับ/ยกมาของ ZORT รายสินค้า' },
                    { label: 'รายการซื้อขายทั้งหมด', key: 'trade', เหตุ: '' },
                    { label: 'รายการขายเท่านั้น', key: 'sale', เหตุ: '' },
                    { label: 'รายการซื้อเท่านั้น', key: 'buy', เหตุ: '' },
                    { label: 'รายการซื้อขายที่สำเร็จเท่านั้น', เหตุ: 'ท่อยังไม่กรองตามสถานะ' },
                    { label: 'รายการซื้อขายที่รอโอนเท่านั้น', เหตุ: 'ท่อยังไม่กรองตามสถานะ' },
                  ]
                  return (
                    <>
                      {ZORT8.map((o) => { const k = (o.key && มีคีย์.has(o.key)) ? o.key : คีย์จากชื่อ(o.label); return k
                        ? <option key={o.label} value={k}>{o.label}</option>
                        : <option key={o.label} value="" disabled>{o.label} — เรายังทำไม่ได้{o.เหตุ ? ` (${o.เหตุ})` : ''}</option> })}
                      {มีคีย์.has('adjust') && <option value="adjust">รายการปรับในระบบเรา (ZORT ไม่มี)</option>}
                    </>
                  )
                })()}
              </select>

              <label className="text-[12.5px] text-gray-500">คลังสินค้า/สาขา</label>
              {/* ⚠️ ท่อส่ง warehouses: null มา = **ไม่มีข้อมูลรายคลังเลย** ไม่ใช่ "มีแต่ยังไม่ได้ต่อ"
                  ทำ dropdown ที่เลือกได้แล้วไม่มีอะไรเปลี่ยน คือของหลอก ⇒ ล็อกไว้พร้อมเหตุผล */}
              <select
                disabled
                title="คลังเงาเก็บสต็อกรวมทั้งร้าน (3 คลัง: โกดัง + จุดขาย 2) — ตรวจระดับพารามิเตอร์แล้ว 10 ก.ย. 2569: ZORT เมินตัวกรองคลัง (ใส่ warehouseid แล้วเลขไม่เปลี่ยน)"
                className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-gray-50 text-gray-400 cursor-not-allowed max-w-full"
              >
                <option>ทั้งหมด</option>
              </select>
            </div>

            <TableWrap>
              <table className="w-full min-w-[860px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH_KANIT}>วันที่</th>
                    <th className={TH_KANIT}>ประเภท</th>
                    <th className={TH_KANIT}>สถานะ</th>
                    <th className={TH_KANIT}>รายการ</th>
                    <th className={THR_KANIT}>จำนวน</th>
                    <th className={TH_KANIT}>จาก</th>
                    <th className={TH_KANIT}>ไป</th>
                    <th className={THR_KANIT}>คงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {cardLoading && cardRows.length === 0 && (
                    <EmptyState cols={8} icon="⏳" title="กำลังดึงความเคลื่อนไหว…" detail="" />
                  )}
                  {!cardLoading && cardRows.length === 0 && (
                    <EmptyState
                      cols={8}
                      icon={cardErr ? '⚠️' : '📋'}
                      title={cardErr ? 'ดึงความเคลื่อนไหวไม่ได้' : 'ไม่มีความเคลื่อนไหวของรหัสนี้ในตัวกรองที่เลือก'}
                      detail={cardErr
                        ? `ตารางว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่มีการเคลื่อนไหว — ${cardErr}`
                        : 'ลองเปลี่ยนตัวกรอง "การแสดงผล" เป็น "การเคลื่อนไหว" เพื่อดูทุกประเภทรวมกัน'}
                    />
                  )}
                  {cardRows.map((m, i) => (
                    <tr key={`${m.ref ?? ''}-${m.date ?? ''}-${i}`}
                      className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>
                        {/* วันของแถวความเคลื่อนไหวมาเป็นวันไทยล้วนจากท่อ — ห้ามตัดก่อนส่งเข้า thaiDate (ดู lib/format.ts) */}
                        {m.date ? thaiDate(m.date) : '-'}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{m.kind || '-'}</td>
                      <td className={`${TD} text-gray-500 whitespace-nowrap`}>{m.status || '-'}</td>
                      <td className={TD}>
                        {/* แถวชนิด "ขาย" กดเข้าใบขายได้ — ต้องหา id จริงก่อน เพราะ ref คือ **เลขที่ใบ**
                            ส่วน id ในกระจกคือ `<ร้าน>/<เลขที่ใบ>` (ดูเหตุผลเต็มใน lib/open-order.ts)
                            ✅ แถว "ซื้อ" กดได้แล้ว (ยืนยันจากปลายทางจริง 11 ก.ย. 2569:
                               ref ของแถวซื้อ = เลขที่ใบสั่งซื้อ และ ?purchase=<ref> เปิดได้ตรงใบ
                               — เทียบเลขใบ·SKU·วันที่ตรงกันทั้งสามช่อง) ไม่ต้องค้น id แบบใบขาย
                            ⚠️ ชนิดที่เหลือ (ปรับ · โอน) ยังเป็นข้อความโดยตั้งใจ —
                               ยังไม่ได้ยืนยันว่า ref ผูกกลับใบไหนได้จริง
                               เดาแล้วทำให้กดได้ = พาคนไปผิดใบ ซึ่งแย่กว่ากดไม่ได้ */}
                        {m.kind === 'ขาย' && m.ref ? (
                          <button type="button" onClick={() => openRef(String(m.ref))}
                            disabled={openingRef === m.ref}
                            className="text-blue-600 hover:underline disabled:opacity-50">
                            {m.ref}{openingRef === m.ref && ' …'}
                          </button>
                        ) : m.kind === 'ซื้อ' && m.ref ? (
                          <Link href={`/core/purchases/detail?no=${encodeURIComponent(String(m.ref))}`}
                            className="text-[#337ab7] hover:underline">
                            {m.ref}
                          </Link>
                        ) : (
                          <span className="text-gray-700">{m.ref || '-'}</span>
                        )}
                        {m.party ? <span className="text-gray-400"> · {m.party}</span> : null}
                        {/* คลาสเดียวกับที่ทำให้จอแพ็คสินค้าจอขาว (9 ก.ย. 2569):
                            `refErr?.ref === m.ref` กลายเป็น undefined === undefined = true
                            เมื่อแถวไม่มี ref ⇒ ต้องเช็คว่ามี refErr จริงก่อนเสมอ */}
                        {refErr && refErr.ref === m.ref && (
                          <span className="ml-2 text-[11.5px] text-red-700">{refErr.msg}</span>
                        )}
                      </td>
                      <td className={`${TDR} ${Number(m.qty) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {Number(m.qty) > 0 ? '+' : ''}{fmtNum(Number(m.qty ?? 0))}
                      </td>
                      {/* จาก · ไป · คงเหลือ — ขีดไว้ทุกแถวโดยตั้งใจ เหตุผลอยู่ใต้ตาราง */}
                      <td className={`${TD} text-gray-300`}>–</td>
                      <td className={`${TD} text-gray-300`}>–</td>
                      <td className={`${TDR} text-gray-300`}>–</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            {/* 🔴 ข้อความนี้ **อ่านจากท่อ ไม่ใช่พิมพ์ไว้ในจอ**
                ของเดิมพิมพ์ไว้ว่า "รอต่อท่อรวม" แล้วค้างอยู่อย่างนั้นหลังท่อเสร็จแล้ว
                = จอบอกว่าทำไม่ได้ทั้งที่ทำได้ ซึ่งไม่มีใครไปตรวจเพราะไม่มีอะไรพัง */}
            {/* 🔴 **ห้ามตัดแถวเงียบ** — ตารางที่ถูกตัดอ่านเหมือนตารางที่ครบ
                ของจริงที่เจอตอนยิงเอง: 00073 ตัวกรอง "รายการซื้อขายทั้งหมด"
                ได้ 100 แถวเป็นใบขายล้วน **ใบซื้อ 4 ใบถูกดันตกเพราะเก่ากว่า**
                ⇒ อ่านแล้วเหมือนรหัสนี้ไม่เคยซื้อเข้าเลย ทั้งที่ซื้อ 4 ครั้ง
                ตอนนี้ท่อส่งเลขจริงมาแล้ว (93bd13f) — **เลิกเดาจากการชนเพดาน**
                ⚠️ แต่ยังต้องมีทางถอย เผื่อจอใหม่เจอท่อเก่าตอน deploy เหลื่อม */}
            {typeof card?.total === 'number' ? (
              (card.truncated || card.total !== (card.rowsReturned ?? card.shown ?? cardRows.length)) && (
                <p className="text-[12.5px] text-gray-600 bg-gray-50 border-t border-gray-200 px-4 py-2.5 leading-relaxed">
                  แสดง <b>{fmtNum(card.rowsReturned ?? card.shown ?? cardRows.length)}</b> จาก{' '}
                  <b>{fmtNum(card.total)}</b> รายการ
                  {card.counts && (
                    <> — ขาย {fmtNum(Number(card.counts.sale ?? 0))} ·
                      ซื้อ {fmtNum(Number(card.counts.buy ?? 0))} ·
                      ปรับ {fmtNum(Number(card.counts.adjust ?? 0))}</>
                  )}
                  {' '}· ที่ถูกตัดคือ<b>รายการเก่ากว่านี้</b> ซึ่งรวม<b>ประเภทอื่นที่เก่ากว่า</b>ด้วย
                  ⇒ อยากเห็นใบซื้อให้ครบ ให้เลือกตัวกรอง <b>รายการซื้อเท่านั้น</b>
                </p>
              )
            ) : cardRows.length >= CARD_LIMIT && (
              <p className="text-[12.5px] text-gray-600 bg-gray-50 border-t border-gray-200 px-4 py-2.5 leading-relaxed">
                แสดง <b>{CARD_LIMIT} รายการล่าสุด</b> เท่านั้น — ของจริงอาจมีมากกว่านี้
                (ท่อรุ่นนี้ยังไม่ส่งจำนวนจริงมา) · รายการที่เก่ากว่านี้ถูกตัดออก
                <b> รวมถึงประเภทอื่นที่เก่ากว่า</b> ⇒ ถ้าจะดูใบซื้อ ให้เลือกตัวกรอง
                <b> รายการซื้อเท่านั้น</b>
              </p>
            )}
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border-t border-amber-200 px-4 py-2.5 leading-relaxed">
              ⚠️ {card?.coverage ?? 'ยังไม่ได้รับคำอธิบายความครอบคลุมจากเซิร์ฟเวอร์'}
            </p>
            <p className="text-[12.5px] text-gray-500 border-t border-gray-100 px-4 py-2.5 leading-relaxed">
              คอลัมน์ <b>จาก · ไป · คงเหลือ</b> ขีดไว้ทุกแถว — <b>จาก/ไป</b> ต้องใช้ข้อมูลรายคลัง
              ซึ่งไม่มี · <b>คงเหลือ</b> เป็นยอดสะสมที่ต้องนับจากความเคลื่อนไหว<b>ทุกใบ</b>
              ตารางนี้ยังขาดใบ &quot;ปรับ&quot; และ &quot;ยกมา&quot; ของ ZORT ⇒ <b>ใส่ตัวเลขไปก็ผิด</b> ·
              และจะขาดใบ &quot;ปรับ&quot; 194 ใบเสมอ เพราะ API ของ ZORT เองไม่ส่งออกมา
            </p>
          </Card>

          {/* 🔴 **ข้อความเดิมกลายเป็นเท็จแล้ว** (แก้ 15 ก.ย. 2569)
              เดิมเขียนว่า "ZORT มี QR code กับบาร์โค้ด — ยังไม่ทำเพราะปุ่มพิมพ์เอกสารเองก็ยังทำไม่ได้"
              ⇒ ทั้งสองอย่างทำไปแล้ว: QR + บาร์โค้ดอยู่ที่ components/zort/SkuCodes.tsx (ใบ t_mu1dfe94)
                 และจอพิมพ์ฉลากอยู่ที่ /core/stock/print?sku= ⇒ ปล่อยไว้คือจอบอกว่าไม่มีของที่มีอยู่
              📌 ตรงกับคำเตือนที่เขียนไว้ในย่อหน้าเดียวกันนี้เองเมื่อ 3 ก.ย. ว่า
                 "ข้อความทำไม่ได้ที่ค้าง อันตรายกว่าตัวตรวจที่เขียวทั้งที่พัง" — แล้วก็ค้างจนได้ */}
          {!เหมือนZORT && <div className="mt-5">
            <p className="text-[15px] font-semibold text-gray-900 mb-2">QR code และบาร์โค้ด</p>
            <SkuCodes sku={sku} />
          </div>}

          {/* 📇 บัตรสต็อก — ZORT มี ExportStockCard() ในจอรายการสินค้า ของเราไม่เคยมี (ใบ t_mu1i74cu) */}
          <StockCard sku={sku} />

          {/* 📐 โหมดเหมือน ZORT: กล่องพับที่มาของเลขพร้อมขาย/ยอดขายเดือนนี้ (เดิมอยู่ใต้การ์ด KPI) — อธิบายว่าทำไมเลขต่างจาก ZORT */}
          {เหมือนZORT && (
            <div className="mt-4">
              <ZortLookFold tone="gray" สรุป={<>ที่มาของเลขพร้อมขาย · ยอดขายเดือนนี้{thisMonth == null ? ' (กด "ดูกราฟยอดขาย" ด้านบนแล้วเลขจะขึ้นเอง)' : ''}</>}>
                <div className="mt-2 text-left"><StockSource row={row} ป้าย={ป้ายที่มา} /></div>
              </ZortLookFold>
            </div>
          )}

          <p className="text-[12.5px] text-gray-500 mt-4 leading-relaxed">
            {/* 🔴 บรรทัดนี้เคยเขียนว่า "น้ำหนักคลังเงายังไม่ได้เก็บช่องนี้มา" แล้วค้างอยู่
                หลังท่อเก็บน้ำหนักเสร็จ (3 ก.ย. 2569) — ช่องน้ำหนักโชว์อยู่ข้างบนนี้แล้ว
                ⇒ ข้อความ "ทำไม่ได้" ที่ค้าง อันตรายกว่าตัวตรวจที่เขียวทั้งที่พัง
                   เพราะไม่มีอะไรให้ใครไปตรวจ คนอ่านแล้วเชื่อแล้วเลิกตาม */}
          </p>
        </>
      )}
    </div>
  )
}
