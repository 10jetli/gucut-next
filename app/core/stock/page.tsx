'use client'
// สินค้า — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT
//
// **หน้าตาลอกจากจอ "สินค้า" ของ ZORT ของจริง** (~/claude-shared/zort-ui/02-สินค้า.jpg)
// ผังที่ลอกมา: ชื่อจอ → "จำนวน N รายการ" → ปุ่มขวาบน → แถวค้นหา
//              → แท็บ ทั้งหมด/เปิดใช้งาน/ปิดใช้งาน → ตาราง # · รหัส · ชื่อสินค้า ·
//                ราคาซื้อ · ราคาขาย · คงเหลือ · พร้อมขาย
// ⚠️ **คงเหลือติดลบต้องเป็นสีแดง** — ZORT ทำแบบนี้ (เห็นในภาพ -2 -3) เป็นสัญญาณว่าขายเกิน
// ⚠️ ตัวเลขที่นี่คือ "ภาพถ่ายสต็อกตอนตี 1" ไม่ใช่ยอดสด — ต้องเขียนบอกบนจอเสมอ
//    ปล่อยให้เข้าใจว่าสดจะกลายเป็นจอที่โกหกเงียบ ๆ ตอนของขยับระหว่างวัน
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { coverageText } from '@/lib/csv-export'
import ExportButton from '@/components/zort/ExportButton'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { MarketStaleBar } from '@/components/zort/DataFreshness'
import { useSkuImages, pickImage, noImageReason } from '@/lib/sku-images'
import { peekApiCache, putApiCache, ageText } from '@/lib/api-cache'
import { productMenuItems } from '@/lib/product-menu'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, Num, BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, MarketLogos, MarketCoverage, MarketUnreliableBanner, StaleBar, PageNav,
} from '@/components/zort'
import ImportButton from '@/components/zort/ImportButton'
import BlockedStock from '@/components/zort/BlockedStock'

interface Row {
  sku: string; name: string; qty: number; price: number; sold: number
  /** 🖼️ รูปจาก ZORT (ท่อ fc52832 + e2e9634) — `imageFile` คือรูป**ย่อในถังเรา** ใช้กับตารางยาวได้
   *  `imagePath` เป็นไฟล์ดิบ **ห้ามใช้ในตารางนี้** · `''` = ZORT ไม่มีรูป · `null` = ยังไม่รู้
   *  ลำดับทั้งหมดอยู่ที่ `lib/sku-images.ts` ที่เดียว (มีเทสคุม) */
  imageFile?: string | null
  imagePath?: string | null
  /** ราคาซื้อ — **null = ยังไม่ได้กรอก ไม่ใช่ 0** ต้องแสดง "—" ห้ามแสดง ฿0 (281 ตัวเป็นแบบนี้) */
  buy?: number | null
  /** พร้อมขาย — **null = ยังไม่มีในทะเบียน ห้ามเดาว่าเท่ากับคงเหลือ** (ต่างจากคงเหลือจริง 155 ตัว) */
  available?: number | null
  unit?: string | null
  service?: boolean
  active?: boolean | null
  /** ช่องทางที่สินค้าตัวนี้ลงขายอยู่จริง เช่น ["shopee","tiktok"]
   *  ⚠️ มาจาก**รายการสินค้าจริงบนแพลตฟอร์ม** ไม่ใช่จากประวัติการขาย
   *     เคยขายได้ กับ กำลังลงขายอยู่ เป็นคนละเรื่อง */
  marketplaces?: string[]
  /** จับคู่รหัสได้ยังไง (`exact` | `base`) + รหัสเต็มบนแพลตฟอร์มถ้าเป็นการเดา
   *  ⚠️ ต้องโชว์ให้เห็นว่าแถวไหนมาจากการเดา — 98% ตรงตัว แต่ ~1% เดา */
  marketplacesBy?: Record<string, string>
  marketplacesFrom?: Record<string, string[]>
}
interface Resp {
  skip?: string
  day: string; soldDays: number
  total: number; outOfStock: number; low: number; value: number
  /** จำนวนรายการ "บริการ" ทั้งคลัง (ค่าส่ง ค่าซ่อม ฯลฯ) — ของพวกนี้ไม่มีสต็อกจริง */
  services?: number
  /** จำนวนที่ปิดใช้งาน */
  inactive?: number
  /** รอบนี้เช็คแพลตฟอร์มไหนได้บ้าง — ⚠️ จำเป็นมาก
   *  ไม่มีโลโก้ Lazada อ่านได้สองแบบ: "ไม่ได้ลงขายที่ Lazada" กับ "เรายังเช็คไม่ได้"
   *  หน้าตาเหมือนกันเป๊ะแต่คนละความหมาย ⇒ ต้องบอกว่าเช็คอะไรไปบ้าง */
  checkedMarketplaces?: string[]
  /** เจ้าที่ยิงแล้วล่ม + เหตุผล · เจ้าที่ยังไม่ได้เชื่อมร้าน + เหตุผล · เวลาที่ถามล่าสุด (UTC)
   *  ⚠️ "ล่ม" กับ "ยังไม่ได้เชื่อม" คนละเรื่อง — อันหลังเจ้าของร้านกดเองได้เลย */
  marketplacesFailed?: Record<string, string>
  marketplacesNotConnected?: Record<string, string>
  /** ช่องทางที่ตอบมาแล้วแต่เชื่อไม่ได้ — ข้อมูลขึ้นจอไปแล้วและหน้าตาเหมือนของจริง */
  marketplacesUnreliable?: Record<string, string>
  marketplacesAt?: string
  /** เฉพาะตอนได้ของเก่าระหว่างรีเฟรชเบื้องหลัง — **ไม่มีฟิลด์ = ของสด** (สัญญาท่อ 7 ก.ย. 2569)
   *  จอต้องขึ้น MarketStaleBar เสมอเมื่อ true — ห้ามแสดงเหมือนของสด (ฝั่งท่อขอไว้ตรง ๆ) */
  marketplacesStale?: boolean
  marketplacesStaleMs?: number
  /** จำนวนแถวของแท็บที่เลือกอยู่ — ใช้ทำเลขหน้า ห้ามใช้ total ตอนอยู่แท็บ out/low */
  shown?: number
  /** 🔴 สินค้าใน ZORT ที่ **ไม่มีรหัสสินค้า** จึงเก็บเข้าคลังเงาไม่ได้เลยโดยโครงสร้าง
   *  (คลังเงาใช้ SKU เป็นกุญแจหลัก) — 226 ตัวจาก 2,898 · **สต็อกเป็นศูนย์ทั้งหมด มูลค่า ฿0**
   *  ⚠️ ต้องเขียนบนจอเสมอ ไม่งั้นคนเปิดเทียบกับ ZORT จะเห็นเลขต่างกัน 226 โดยไม่มีคำอธิบาย
   *     กฎเดียวกับของทดสอบที่ซ่อน: **ซ่อนได้ แต่ต้องบอกว่าซ่อน** */
  noSkuInZort?: number
  /** ในบรรดาสินค้าที่ไม่มีรหัส **มีกี่ตัวที่ยังมีของเหลืออยู่**
   *  🔴 ท่อส่งมาให้ตั้งนานแล้ว แต่จอไม่เคยอ่าน (เจอ 6 ก.ย. 2569 ตอนไล่เทียบคีย์ที่ท่อส่ง vs ที่จออ่าน)
   *     ⇒ จอเขียนตายตัวว่า "สต็อกเป็นศูนย์ทั้งหมด" ซึ่ง **เป็นคำกล่าวอ้างที่ไม่มีใครตรวจ**
   *     วันที่มีสินค้าไม่มีรหัสแต่มีของ ประโยคนั้นกลายเป็นเท็จเงียบ ๆ
   *     และของพวกนั้นคือ **สต็อกที่ระบบเราตามไม่ได้เลย** (คลังเงาใช้ SKU เป็นกุญแจ) */
  noSkuWithStock?: number
  /** จำนวนสินค้าทั้งหมดที่ ZORT มี (รวมตัวที่ไม่มีรหัส) */
  zortTotal?: number
  limit: number; offset: number; rows: Row[]
  /** คีย์ใหม่ความหมายเดียว — แถวที่เข้าเงื่อนไขทั้งหมด (แทน shown ที่กำกวม) */
  rowsMatched?: number
  rowsReturned?: number
}

const PAGE = 50
/* 📏 จำนวนต่อหน้า: ชุดตัวเลือก (10/20/50/100 แบบ ZORT) อยู่ใน `components/zort/PageNav.tsx`
   ZORT ตั้งต้นที่ 20 · จอนี้ตั้งต้นที่ 50 มาแต่เดิม **คงไว้** เพราะเปลี่ยนแล้วคนที่ใช้อยู่ต้องกดไล่หน้าถี่ขึ้น */

const SORTS = [
  { id: 'qty', label: 'ของใกล้หมดก่อน' },
  { id: 'sold', label: 'ขายดีก่อน' },
  { id: 'sku', label: 'เรียงตามรหัส' },
]

function CoreStockInner() {
  /* กรองตามหมวด — มาจากลิงก์ชื่อหมวดในจอหมวดหมู่ (เจ้าของร้านจับได้ 8 ก.ย. ว่า ZORT กดได้แต่เราไม่)
     ค่าพิเศษ '(ยังไม่ได้จัดหมวดใน ZORT)' = แถว category ว่าง (สัญญากับท่อ 66d2c0f · จับคู่ตรงตัวไม่ใช่ LIKE) */
  const sp = useSearchParams()
  const [category, setCategory] = useState(() => sp.get('category') ?? '')
  /* 🔴 **รับ `?q=` จาก URL ด้วย** (แก้ 16 ก.ย. 2569 · เจอตอนไล่ตามลิงก์ข้ามจอ)
     จออื่นลิงก์เข้ามาด้วย `?q=<รหัสสินค้า>` อยู่ **4 จุด**: จอสินค้าเป็นชุด (2 จุด) ·
     จอรายละเอียดใบซื้อ · จอรายละเอียดหมวดหมู่ ("ดูในจอคลังสินค้า")
     เดิมจอนี้อ่านแต่ `category` ⇒ กดลิงก์แล้วได้ **รายการทั้งคลัง 2,666 ตัว** ช่องค้นหาว่างเปล่า
     ⇒ คนกดต้องพิมพ์รหัสค้นเองอีกรอบ = ลิงก์ที่สัญญาว่าจะพาไปหาของ แต่ไม่พาไปถึง */
  const [q, setQ] = useState(() => sp.get('q') ?? '')
  const [sort, setSort] = useState('qty')
  const [tab, setTab] = useState<'all' | 'out' | 'low' | 'active' | 'inactive'>('all')
  // ⚠️ ค่าตั้งต้นซ่อน "บริการ" (ค่าส่ง · ค่าซ่อม · ค่าน้ำมัน ฯลฯ) ออกจากจอสินค้า
  //    เพราะของพวกนี้ไม่มีสต็อกจริง แต่ติดลบหนัก (-712 · -200) เลยยึดสองแถวบนสุด
  //    ของแท็บ "ของหมด" ⇒ จอที่คนเปิดดูว่า "ต้องสั่งอะไร" ขึ้นของที่สั่งไม่ได้ก่อน
  // ⚠️ **แต่ต้องไม่ซ่อนเงียบ** — เขียนบนจอว่าซ่อนอะไรไว้กี่รายการ + กดกลับได้
  //    ไม่งั้นวันหนึ่งจะมีคนหา "ค่าบริการซ่อม" แล้วไม่เจอ นึกว่าข้อมูลหาย
  const [kind, setKind] = useState<'goods' | 'all'>('goods')
  const [offset, setOffset] = useState(0)
  const [perPage, setPerPage] = useState(PAGE)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // ⚠️ ค่าเริ่มต้นคือซ่อน — แต่ต้องกดดูได้เสมอ ของที่ซ่อนแล้วเปิดดูไม่ได้คือของที่หายไป
  const [showTest, setShowTest] = useState(false)
  // รูปสินค้า — โหลดแผนที่ SKU→ไฟล์ครั้งเดียวต่อการเปิดเว็บ
  const imgOf = useSkuImages()

  /** อายุของข้อมูลที่กำลังโชว์ — ไม่ null = กำลังโชว์ของเก่าและยังดึงของใหม่ไม่เสร็จ */
  const [staleAge, setStaleAge] = useState<number | null>(null)
  /** ⚠️ ยิงของใหม่พลาด **แต่ยังโชว์ของเก่าอยู่** — ต้องเปลี่ยนข้อความบนแถบ ไม่ใช่เอาแถบออก
   *  เอาแถบออก = จอโชว์ตัวเลขอายุ 60 วิ โดยไม่มีอะไรบอกว่ามันเก่า */
  const [staleFailed, setStaleFailed] = useState(false)

  /* ⚠️ `qText` ต้องรับเป็นพารามิเตอร์ได้ — `setQ()` ยังไม่มีผลในรอบเดียวกัน
     ⇒ ปุ่ม "ค้นทีละคำ" ที่ setQ แล้วเรียก load() เฉย ๆ จะยิงด้วยคำเดิม (เจอคลาสนี้มาแล้วที่จอเอกสารบัญชี) */
  const load = useCallback(async (off = 0, sortId = sort, tabId = tab, kindId = kind, qText = q, size = perPage) => {
    setLoading(true)
    setError('')
    try {
      // ⚠️ `marketplaces=1` ต้องส่งเสมอ ไม่งั้นคอลัมน์ Marketplace ว่างทุกแถวแบบเงียบ ๆ
      //    (ยิงของจริงเทียบแล้ว: ไม่ส่ง → marketplaces:null · ส่ง → ['shopee'] · 3 ก.ย. 2569)
      const qs = new URLSearchParams({
        list: 'stock', sort: sortId, limit: String(size), offset: String(off), marketplaces: '1',
      })
      // กรองฝั่งเซิร์ฟเวอร์แล้ว — แท็บจึงกรองทั้งคลังจริง ไม่ใช่แค่หน้าที่กำลังดู
      if (tabId !== 'all') qs.set('only', tabId)
      if (kindId === 'goods') qs.set('kind', 'goods')
      if (qText.trim()) qs.set('q', qText.trim())
      if (category) qs.set('category', category)
      /* ⚡ **กดเมนูกลับมาแล้วเห็นของเดิมทันที แล้วค่อยอัปเดตเบื้องหลัง**
         ฝั่งท่อวัดแล้ว: เวลา = 1.1 วิคงที่ + 0.27 วิต่อการยิงฐาน 1 รอบ
         1.1 วินาทีนั้นลบไม่ได้ถ้ายังยิงอยู่ ⇒ ทางเดียวที่เร็วกว่านั้นคือ **ไม่ยิง**
         ⚠️ `url` เป็นคีย์แคช และมันรวมพารามิเตอร์ทุกตัวแล้ว (sort/only/kind/q/limit/offset)
            **ห้ามตัดตัวไหนออกจากคีย์** ไม่งั้นสลับแท็บ/ค้นหาแล้วเห็นข้อมูลของตัวกรองก่อนหน้า */
      const url = `/api/web/core?${qs}`
      setStaleFailed(false)
      const cached = peekApiCache<Resp>(url)
      if (cached) {
        setData(cached.data)
        setOffset(off)
        setStaleAge(cached.ageMs)
        setLoading(false) // ← มีของให้ดูแล้ว ไม่ต้องขึ้นจอโหลด
      }

      const res = await fetch(url)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      putApiCache(url, d)
      setData(d)
      setOffset(off)
      setStaleAge(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      // ⚠️ **ห้ามล้าง staleAge ตรงนี้** ของเก่ายังอยู่บนจอ ⇒ แถบต้องอยู่ต่อ แค่เปลี่ยนข้อความ
      setStaleFailed(true)
    } finally {
      setLoading(false)
    }
  }, [q, sort, tab, kind, perPage])

  /* โหลดครั้งแรก + เมื่อหมวดเปลี่ยน — `q` ตั้งต้นจาก URL ถูกส่งไปด้วยเพราะ `load` อ่านค่าจาก state ปัจจุบัน
     ⚠️ ห้ามใส่ `q` ใน deps — ไม่งั้นจอจะยิงท่อทุกตัวอักษรที่พิมพ์ (ช่องค้นหาต้องกด Enter เท่านั้น) */
  useEffect(() => { load(0) }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 📤 ส่งออก Excel ตามตัวกรองที่เลือกอยู่ ───────────────────────────────
     🔴 **ย้ายมาใช้ปุ่มร่วม `<ExportButton>` แล้ว** (15 ก.ย. 2569)
        เดิมจอนี้เขียนตัวส่งออกของตัวเองไว้ในไฟล์ ⇒ เป็นสำเนาที่สองของกฎชุดเดียวกัน
        (ครบทุกหน้า · ช่องว่างห้ามเป็น 0 · เวลาไทย · บอกความครบถ้วนในไฟล์)
        ⇒ สำเนาที่สองคือที่ที่กฎจะเพี้ยนก่อนเพื่อน และเป็นจอเดียวที่หลุดจากสายตา
           ของ `scripts/check-inherited.mjs` ด้วย
     ⚠️ ตัวกรองต้องเป็นชุดเดียวกับที่จอใช้เป๊ะ — ไฟล์กรองไม่เหมือนจอ คนเทียบเลขแล้วไม่ตรง
        โดยไม่มีใครรู้ว่าทำไม (CLAUDE.md กฎข้อ 4) */

  // เซิร์ฟเวอร์กรองให้แล้ว (only=out/low) — แถวที่ได้คือของทั้งคลังในแท็บนั้น
  // ⚠️ เลขหน้าต้องใช้ shown (จำนวนแถวของแท็บที่เลือก) ไม่ใช่ total
  //    ใช้ total ตอนอยู่แท็บ out/low = โชว์ 54 หน้าทั้งที่มีของจริง 12 หน้า
  /** 🧪 ของทดสอบที่ค้างอยู่ในทะเบียนสินค้าจริงของ ZORT
   *  เจ้าของร้านสั่ง 3 ก.ย. 2569: **"ปล่อยไว้ก่อน แค่ซ่อนออกจากจอ"** — ไม่ลบที่ ZORT
   *  ⚠️ ซ่อนแบบเงียบ ๆ ไม่ได้ เพราะหัวจอนับจากเซิร์ฟเวอร์ (รวมของทดสอบ)
   *     ซ่อนแล้วไม่บอก = เลขบนหัวไม่ตรงกับจำนวนแถว แล้วคนนับจะงง (โรคเดิม)
   *     ⇒ ซ่อนแล้ว **เขียนบอกว่าซ่อนกี่รายการ พร้อมปุ่มกดดูได้** */
  const TEST_SKUS = ['ZZFAKE999']
  const allRows = data?.rows ?? []
  const hiddenRows = allRows.filter((r) => TEST_SKUS.includes(r.sku))
  const rows = showTest ? allRows : allRows.filter((r) => !TEST_SKUS.includes(r.sku))
  /* จำนวนของแท็บที่เลือก — อ่านคีย์ใหม่ก่อนเสมอ
     ท่อเพิ่ม rowsMatched (= แถวที่เข้าเงื่อนไขทั้งหมด) แทน shown ที่ความหมายกำกวม
     (shown ของ list=stock = แถวของแท็บ · ของ list=stockcard = แถวที่ส่งกลับ ⇒ ชื่อเดียวสองความหมาย)
     ⚠️ ทางถอย shown ยังต้องมี เพราะจอกับท่อ deploy คนละรอบเสมอ — หายได้เมื่อเลิกส่ง shown แล้ว */
  const inTab = data?.rowsMatched ?? data?.shown ?? data?.total ?? 0

  /* 🔎 **แถวที่คนดูมองไม่เห็นว่าทำไมถึงติดคำค้น** (วัดของจริง 16 ก.ย. 2569 · ใบ t_mu2u9mym)
     ยิงคำเดียวกันสองฝั่งวันเดียวกัน: `โซ่` ⇒ ZORT 90 รายการ · ของเรา 156
     ในของเรา **89 แถวมีคำค้นอยู่ในรหัส/ชื่อ** (≈ เท่ากับที่ ZORT เจอ) อีก **67 แถวไม่มีเลย**
     (`NEWWAVE` ⇒ ZORT 245 · เรา 291 · `KINGKONG` ⇒ 148 ตรงทุกแถว ⇒ ไม่ได้เกิดทุกคำ)
     ⇒ ท่อค้นในช่องที่ตารางนี้ไม่ได้แสดงด้วย **ยังไม่รู้ว่าช่องไหน** (ลองตัดหมวดหมู่ออกแล้ว ไม่ใช่หมวดหมู่)
     🔴 เงียบไว้ = คนแพ็กของเห็น "ตะไบ" โผล่ตอนค้น "โซ่" แล้วสรุปว่าช่องค้นหาพัง
        ⇒ ติดป้ายรายแถว + เขียนสรุปใต้ช่องค้น **ห้ามแอบกรองทิ้ง** (ของอาจตรงจริงในช่องที่เราไม่เห็น) */
  const คำค้น = q.trim().toLowerCase()
  const ตรงที่เห็นบนจอ = (r: { sku?: string; name?: string | null }) =>
    !คำค้น || `${r.sku ?? ''} ${r.name ?? ''}`.toLowerCase().includes(คำค้น)
  const แถวไม่เห็นเหตุ = คำค้น ? rows.filter((r) => !ตรงที่เห็นบนจอ(r)).length : 0

  /* 🔴 **พิมพ์หลายคำ = คนละกติกากับ ZORT** (วัดสองฝั่งวันเดียวกัน 16 ก.ย. 2569)
     `โซ่ NEWWAVE` ⇒ ZORT 28 · เรา 31 · แต่ **สลับคำเป็น `NEWWAVE โซ่` ⇒ ZORT 28 · เรา 0**
     เพราะท่อเราค้นแบบ **ข้อความติดกันตามลำดับที่พิมพ์** ส่วน ZORT **แยกคำแล้วหาให้ครบทุกคำ**
     🔴 ผลกับคนหน้างาน: พิมพ์สลับคำแล้วจอขึ้น "ไม่พบสินค้า" ⇒ เชื่อว่าร้านไม่มีของ ทั้งที่มี 28 ตัว
        (ตรงกับคำสั่งท่านประธานว่าลูกน้องต้องไม่ต้องปรับตัว — ตอนนี้ต้องปรับ จึงต้องบอกบนจอไปก่อน)
     ⇒ แก้ถาวรต้องทำที่ท่อ (แยกคำแล้ว AND) — ขอไปแล้ว · ระหว่างนี้จอบอกตรง ๆ + กดค้นทีละคำได้เลย */
  const หลายคำ = คำค้น ? q.trim().split(/\s+/).filter(Boolean) : []
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6">
      {/* ⚠️ ต้องเป็นชิ้นแรกสุด เหนือหัวจอ — คำเตือนที่ต้องเลื่อนถึงเห็น คือคำเตือนที่วางผิดที่ */}
      <StaleBar ageMs={staleAge} ageText={ageText} failed={staleFailed} />
      <PageHead
        title="สินค้า"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" (แก้ 6 ก.ย. 2569 — เจอตอนเปิดจอจริงตอนของพัง) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
          /* 🔴 **สถานะที่สามมาได้สองทาง** (แก้ 16 ก.ย. 2569 · เจอด้วยท่อปลอมโหมด skip)
             ทาง ① error ที่ขึ้นต้นด้วย SKIP · ทาง ② ท่อตอบ 200 พร้อมช่อง `skip` ⇒ `data.skip`
             เดิมจอเช็คแค่ทาง ① ⇒ ทาง ② ทำให้หัวจอไปเข้าสาขาปกติแล้วเขียนว่า
             "จำนวน — รายการ (เซิร์ฟเวอร์ไม่ได้ส่งจำนวนมา)" ซึ่งอ่านเหมือนข้อมูลมีปัญหา
             ขณะที่กล่องข้างล่างบอกว่า "ยังทำส่วนนี้ต่อไม่ได้" ⇒ **หัวจอกับกล่องพูดคนละเรื่อง**
             (กฎเดิมของโปรเจกต์: หัวจอกับกล่องต้องพูดเรื่องเดียวกัน) */
          : data?.skip ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง'
          : data ? (
            <>
              {/* ⚠️ **รูปประโยคนี้ลอกจาก ZORT เป๊ะ** — "จำนวน N รายการ | ลิงก์ | ลิงก์"
                  เจ้าของร้านสั่ง 3 ก.ย. 2569 ให้ถอดของที่เราเพิ่มเองออกทั้งหมด
                  (ของหมด · เหลือน้อย · มูลค่าสต็อก) ⇒ ย้ายคำอธิบายส่วนต่างไปใต้ตาราง */}
              {/* 🔴 ท่อไม่ส่ง total มา = undefined ⇒ .toLocaleString โยน error ⇒ **จอขาวทั้งหน้า**
                  (เจอจริงด้วยท่อปลอมโหมดตอบ {} เปล่า ๆ 6 ก.ย. 2569 — 200 ทุกคำขอ ไม่มีกล่องแดงให้เห็นด้วย) */}
              {typeof data.total === 'number'
                ? <>จำนวน {data.total.toLocaleString('th-TH')} รายการ</>
                : <>จำนวน — รายการ (เซิร์ฟเวอร์ไม่ได้ส่งจำนวนมา)</>}
              {hiddenRows.length > 0 && !showTest && (
                <span className="text-gray-400">
                  {' '}(ซ่อนของทดสอบ {hiddenRows.length} รายการ{' '}
                  <button onClick={() => setShowTest(true)} className="text-blue-600 hover:underline">กดดู</button>)
                </span>
              )}
              {showTest && hiddenRows.length > 0 && (
                <span className="text-gray-400">
                  {' '}(กำลังแสดงของทดสอบด้วย{' '}
                  <button onClick={() => setShowTest(false)} className="text-blue-600 hover:underline">ซ่อน</button>)
                </span>
              )}
              {/* ⚠️ ZORT แสดง 2,898 · เราแสดง 2,672 — ต่างกัน 226 ต้องมีคำอธิบายติดอยู่ตรงนี้
                  ไม่ใช่ให้คนไปสงสัยเอาเองว่าข้อมูลหาย
                  🔴 **แต่ต้องโชว์เฉพาะตอนไม่ได้กรองอะไร** (แก้ 16 ก.ย. 2569 · เจอตอนกดจากจอหมวดหมู่)
                     เพราะพอกรองหมวดแล้วเลขหน้าประโยคกลายเป็น 218 ⇒ อ่านได้ว่า "218 จาก 2,898"
                     ซึ่งเป็นการ **วางเลขสองประชากรคู่กัน** (กฎข้อ 4 ใน CLAUDE.md ห้ามไว้ตรง ๆ)
                     ⇒ ตอนกรองอยู่ให้เงียบเรื่อง ZORT แล้วให้ป้าย "กรองอยู่: หมวด …" พูดแทน */}
              {Number(data.noSkuInZort) > 0 && !category && !q.trim() && tab === 'all' && (
                <span className="text-gray-400">
                  {' '}(ZORT มี {(data.zortTotal ?? 0).toLocaleString('th-TH')} — ที่ขาดคือสินค้า
                  {' '}<b>ไม่มีรหัส {Number(data.noSkuInZort).toLocaleString('th-TH')} ตัว</b>
                  {/* 🔴 อ่านจากค่าจริง ไม่เขียนตายตัวว่า "สต็อกเป็นศูนย์ทั้งหมด" อีกแล้ว
                      ไม่มีคีย์นี้ = ท่อรุ่นเก่า ⇒ ไม่พูดเรื่องสต็อกเลย ดีกว่าพูดสิ่งที่ตรวจไม่ได้ */}
                  {typeof data.noSkuWithStock === 'number' && (
                    data.noSkuWithStock === 0
                      ? <> สต็อกเป็นศูนย์ทั้งหมด)</>
                      : <>)</>
                  )}
                  {typeof data.noSkuWithStock !== 'number' && <>)</>}
                </span>
              )}
              {/* 🔴 มีของแต่ไม่มีรหัส = **สต็อกที่ระบบเราตามไม่ได้เลย** ต้องเห็นชัด ไม่ใช่ในวงเล็บสีเทา */}
              {Number(data.noSkuWithStock) > 0 && (
                <span className="block mt-1 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
                  🔴 <b>มีสินค้าไม่มีรหัสที่ยังมีของเหลืออยู่ {Number(data.noSkuWithStock).toLocaleString('th-TH')} ตัว</b> —
                  คลังเงาใช้รหัสสินค้าเป็นกุญแจ ⇒ <b>ของพวกนี้ระบบเราตามไม่ได้เลย</b>
                  {' '}ต้องไปใส่รหัสให้มันที่ ZORT ก่อน
                </span>
              )}
              {' | '}
              {/* ✅ แก้ 14 ก.ย. 2569 (t_mu10s2ns): เดิมชี้ /core/soon/product-image ทั้งที่อัปรูปทำได้แล้ว (t_mu108yr3)
                  — อัปรูปทีละตัวในจอแก้สินค้า (ต้องรู้ id ของ ZORT ก่อน จึงไม่มีหน้ารวม) ⇒ บอกทางตรง ๆ ไม่ลิงก์ไปหน้า "ยังไม่ได้ทำ" */}
              {/* 🖼️ เพิ่ม 16 ก.ย. 2569: ZORT มีจอ **จัดการรูปภาพสินค้า** (`/Product/AddPicturelist`)
                  อัปโหลดรูปหลายรหัสรวดเดียว กรองด้วยรหัส/ชื่อ/ช่วงราคา/หมวดหมู่/คลัง/Tag ได้ (อ่านจอจริงแล้ว)
                  ของเรายังอัปได้ทีละรหัส ⇒ บอกทางที่เร็วกว่าไว้ตรงนี้ เพราะตอนนี้ยังขาดรูป 2,499 รหัส
                  (ZORT มีรูปแต่ยังไม่ได้ย่อลงถังเรา 1,930 · ZORT เองก็ไม่มีรูป 569 — วัด 16 ก.ย. 2569) */}
              <span className="text-gray-600">จัดการรูปภาพสินค้า: <b>กดรหัสสินค้า</b> แล้วกด &ldquo;แก้ไข&rdquo;
                {' '}· ใส่รูปหลายรหัสทีเดียวได้ที่จอ <b>&ldquo;จัดการรูปภาพสินค้า&rdquo; ของ ZORT</b> (เมนูสินค้า)</span>
              {' | '}
              <Link href="/core/stock/cost" className="text-blue-600 hover:underline">ปรับต้นทุนสินค้า</Link>
            </>
          ) : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 Export to Excel — ZORT มีทุกหน้ารายการ ของเราเพิ่งมี (ใบ t_mu1i74cu · 15 ก.ย. 2569)
                🔴 **ส่งออกตามตัวกรองที่เลือกอยู่ ครบทุกหน้า ไม่ใช่แค่ 200 แถวที่เห็น**
                   ท่อให้ครั้งละ 200 ⇒ ตัวช่วยวนหน้าให้เอง แล้วเขียนลงไฟล์ว่าได้กี่แถวจากกี่แถว */}
            <ExportButton
              disabled={loading}
              onDone={(c) => { if (c.stoppedBecause) setError(`ส่งออกแล้วแต่ได้ไม่ครบ — ${coverageText(c)} (เขียนไว้ในไฟล์แล้ว)`) }}
              spec={{
                filename: `คลังสินค้า-${data?.day ?? ''}`,
                title: 'คลังสินค้า',
                note: 'ไฟล์นี้ไม่มีคอลัมน์ช่องทางขาย (Marketplace) เพราะต้องยิงถามรายตัว — ดูได้บนจอ',
                filters: [
                  ['วันที่ของภาพถ่ายสต็อก', data?.day ?? '(ไม่รู้)'],
                  ['แท็บ', tab === 'all' ? 'ทั้งหมด' : tab],
                  ['ชนิด', kind === 'goods' ? 'เฉพาะสินค้า (ไม่รวมบริการ)' : 'ทั้งหมด'],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                  ['หมวดหมู่', category || '(ทุกหมวด)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'stock', sort, limit: String(limit), offset: String(offsetAt) })
                  if (tab !== 'all') qs.set('only', tab)
                  if (kind === 'goods') qs.set('kind', 'goods')
                  if (q.trim()) qs.set('q', q.trim())
                  if (category) qs.set('category', category)
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return {
                    rows: (Array.isArray(d.rows) ? d.rows : []) as Row[],
                    /* `rowsMatched` = จำนวนที่ตรงตัวกรองทั้งชุด (ไม่ใช่ total ทั้งคลัง) */
                    total: typeof d.rowsMatched === 'number' ? d.rowsMatched
                      : typeof d.total === 'number' ? d.total : null,
                  }
                },
                header: ['รหัสสินค้า', 'ชื่อสินค้า', 'คงเหลือ', 'พร้อมขาย', 'หน่วย', 'ราคาขาย', 'ราคาทุน', `ขายได้ ${data?.soldDays ?? ''} วัน`, 'สถานะ'],
                /* 🔴 ราคาทุน/พร้อมขาย เป็น null ได้ ⇒ เว้นว่าง **ห้ามใส่ 0**
                   (281 ตัวยังไม่กรอกราคาทุน · 155 ตัวไม่มีพร้อมขายในทะเบียน) */
                toRow: (r: Row) => [
                  r.sku, r.name, r.qty, r.available ?? null, r.unit ?? null,
                  r.price, r.buy ?? null, r.sold,
                  r.service ? 'บริการ' : r.active === false ? 'ปิดใช้งาน' : 'ใช้งาน',
                ],
              }}
            />
            {/* ⚠️ ปุ่มสองอันนี้มีใน ZORT — ทำให้ผังเหมือน แต่ **กดแล้วต้องไม่โกหก**
                จึงพาไปหน้าที่บอกตรง ๆ ว่ายังไม่ได้ทำ และตอนนี้ให้ไปทำที่ไหน
                ✅ แก้ 14 ก.ย. 2569 (t_mu0tx2wj): "เพิ่มสินค้าใหม่" เดิมพาไปหน้า "ยังไม่ได้ทำ" ทั้งที่จอจริง /core/stock/new มีแล้ว
                   (บั๊กคลาสเดียวกับปุ่มสร้างรายการซื้อที่ลิงก์ผิดมา 8 วัน) · นำเข้า Excel ยังพาไปหน้า soon เพราะจอยังไม่มี */}
            <ImportButton kind="product" />
            {/* 🖨 พิมพ์ฉลากของ **รหัสที่แสดงอยู่บนหน้านี้** — ZORT มีปุ่มพิมพ์เอกสารในจอรายการ
                🔴 **ต้องติดรหัสไปด้วย** (ฝั่งท่อกำชับ) ไม่งั้นไปถึงจอพิมพ์แล้วต้องพิมพ์รหัสใหม่เอง
                   = ปุ่มที่กดแล้วเหมือนไม่เกิดอะไร
                ⚠️ ส่งเฉพาะ **หน้านี้** ไม่ใช่ทั้งคลัง — ป้ายบนปุ่มจึงบอกจำนวนตรง ๆ
                   ถ้าเขียนแค่ "พิมพ์ฉลาก" คนจะนึกว่าได้ทั้งคลัง 2,672 รหัส */}
            {rows.length > 0 && (
              <Link href={`/core/stock/print?sku=${encodeURIComponent(rows.map((r) => r.sku).join(','))}`}
                className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
                🖨 พิมพ์ฉลาก {rows.length} รหัสในหน้านี้
              </Link>
            )}
            <Link href="/core/stock/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เพิ่มสินค้าใหม่
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="ค้นหา รหัสสินค้า หรือชื่อสินค้า"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">เรียง</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); load(0, e.target.value) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        }
      />

      {/* 🔎 พิมพ์หลายคำแล้วผลไม่เหมือน ZORT — เขียนบอกพร้อมทางออกที่กดได้ทันที
          (เหตุผลและตัวเลขที่วัดได้ อยู่ในคอมเมนต์ตรงที่คำนวณ `หลายคำ`) */}
      {หลายคำ.length > 1 && (
        <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
          🔎 พิมพ์หลายคำ — ช่องค้นหานี้หาแบบ <b>ข้อความติดกันตามลำดับที่พิมพ์</b> ส่วนจอ ZORT <b>แยกคำแล้วหาให้ครบทุกคำ</b>
          {' '}(สลับลำดับคำก็เจอ) ⇒ <b>จำนวนที่เจอจะไม่เท่ากัน และสลับคำแล้วอาจได้ 0</b>
          <span className="block mt-1">
            ลองค้นทีละคำ:{' '}
            {หลายคำ.map((w) => (
              <button key={w} onClick={() => { setQ(w); load(0, sort, tab, kind, w) }}
                className="text-blue-600 hover:underline mr-2">“{w}”</button>
            ))}
          </span>
        </p>
      )}

      {/* 🔎 คำค้นเจอแถวที่ "มองไม่เห็นเหตุผล" — บอกตรงนี้ ไม่ใช่ปล่อยให้คนนั่งเดา
          (เหตุผลและตัวเลขที่วัดได้ อยู่ในคอมเมนต์ตรงที่คำนวณ `แถวไม่เห็นเหตุ`) */}
      {แถวไม่เห็นเหตุ > 0 && (
        <p className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
          🔎 ในหน้านี้มี <b>{แถวไม่เห็นเหตุ.toLocaleString('th-TH')} รายการ</b> ที่ <b>รหัสและชื่อไม่มีคำค้น</b> —
          ท่อค้นในช่องอื่นที่ตารางนี้ไม่ได้แสดงด้วย <b>ยังไม่รู้ว่าช่องไหน</b> (ติดป้าย “ตรงที่ช่องอื่น” ไว้ให้ทีละแถว)
          <span className="block mt-0.5 text-gray-500">
            ⇒ จำนวนที่เจอจะ<b>มากกว่าจอ ZORT</b> ซึ่งค้นเฉพาะรหัส/ชื่อ (วัดคำว่า “โซ่” วันเดียวกัน 16 ก.ย. 2569: ZORT 90 · ของเรา 156)
          </span>
        </p>
      )}

      {/* 🔴 คำเตือนว่าข้อมูลเชื่อไม่ได้ — **ต้องอยู่หัวจอ เหนือตาราง**
          เคยวางท้ายตารางแล้วไม่มีใครเห็น แม้แต่คนที่ตั้งใจหา (4 ก.ย. 2569) */}
      <MarketUnreliableBanner unreliable={data?.marketplacesUnreliable} />

      {error && <ErrorBox title="ดึงสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {/* ⚠️ เดิมเป็นกล่องขาว/เทา ⇒ ดูเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ
          สถานะที่สามต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว (ส่ง SKIP นำหน้า) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

      {data && !data.skip && (
        <>
          <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
            ⚠️ ตัวเลขนี้คือ <b>ภาพถ่ายสต็อกของวันที่ {thaiDate(data.day)}</b> (ถ่ายตอนตี 1) ไม่ใช่ยอดสดวินาทีนี้
          </div>

          {/* ⚠️ ซ่อนได้ แต่ต้องบอกว่าซ่อนอะไรไว้กี่รายการและกดกลับได้ตรงนี้เลย
              การซ่อนเงียบ ๆ ทำให้คนหาของไม่เจอแล้วสรุปว่าข้อมูลหาย */}
          <p className="text-[12.5px] text-gray-500 mb-2">
            {kind === 'goods' ? (
              <>
                ซ่อนรายการ<b>บริการ</b>
                {typeof data.services === 'number' ? ` ${data.services.toLocaleString('th-TH')} รายการ` : ''}
                {' '}(ค่าส่ง · ค่าซ่อม · ค่าน้ำมัน — ไม่มีสต็อกจริง จึงติดลบตลอด) ·{' '}
                <button
                  onClick={() => { setKind('all'); load(0, sort, tab, 'all') }}
                  className="text-blue-600 hover:underline"
                >
                  แสดงทั้งหมด
                </button>
              </>
            ) : (
              <>
                กำลังแสดง<b>รายการบริการด้วย</b> — แถวที่มีป้าย &quot;บริการ&quot; ไม่ใช่ของที่สั่งซื้อได้ ·{' '}
                <button
                  onClick={() => { setKind('goods'); load(0, sort, tab, 'goods') }}
                  className="text-blue-600 hover:underline"
                >
                  ซ่อนบริการ
                </button>
              </>
            )}
          </p>

          {/* แถบเหนือแท็บตามผัง ZORT (`zort-ui/35-zort-สินค้า-รายการ.jpg`)
              ขวามือมี ปุ่ม "Marketplace Dashboard" + ไอคอนสลับมุมมอง (รายการ / ตาราง) */}
          <div className="flex flex-wrap items-center justify-end gap-2 mb-1">
            {/* ✅ ปุ่มนี้มีปลายทางจริง — จอช่องทางขายของเราคือจอเดียวกับ Marketplace Dashboard ของ ZORT */}
            <Link href="/core/channels"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-2.5 py-1 hover:bg-gray-50">
              Marketplace Dashboard
            </Link>
            {/* ⚠️ ZORT มีไอคอนสลับ "มุมมองรายการ / มุมมองตาราง" — เรามีแต่มุมมองรายการ
                ⇒ โชว์ตามผังแต่ล็อกไว้พร้อมเหตุผล · ทำปุ่มที่กดแล้วไม่เปลี่ยนอะไรคือปุ่มหลอก
                   และซ่อนทิ้งก็ไม่ได้ เพราะคนที่ชิน ZORT จะหาแล้วไม่เจอ แล้วนึกว่าระบบเราทำไม่ได้ */}
            <span title="มุมมองรายการ — จอนี้มีมุมมองเดียว"
              className="text-[13px] leading-none px-2 py-1 rounded border border-gray-300 bg-gray-100 text-gray-600">☰</span>
            <span title="มุมมองตารางรูป — ยังไม่ได้ทำ (ไม่ใช่ทำไม่ได้) · ตอนนี้ดูรูปได้ในหน้ารายละเอียดสินค้า"
              className="text-[13px] leading-none px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed">▦</span>
          </div>

          {/* 🔴 วางไว้เหนือแท็บ — ของที่ลูกค้าซื้อไม่ได้ ต้องเห็นก่อนตัวเลขอื่นทั้งหมด */}
          <BlockedStock />

          <Tabs
            // ⚠️ **ลอกจาก ZORT ทั้งชุด** (ภาพ 02-สินค้า.jpg) — สามแท็บ **ไม่มีเลขในวงเล็บ**
            //    เจ้าของร้านสั่ง 3 ก.ย. 2569: "ถอดของที่เราเพิ่มเองออกให้เหมือน ZORT เป๊ะ"
            //    ⇒ ถอดแท็บ "ของหมด" กับ "เหลือน้อย" ที่ ZORT ไม่มี และถอดเลขในวงเล็บ
            //    ⚠️ **ถอดแค่การแสดงผล ไม่ได้ถอดความสามารถ** — ตัวกรอง only=out|low
            //       ยังอยู่ฝั่งเซิร์ฟเวอร์ · ตัวเลือกเรียง "ของใกล้หมดก่อน" ยังใช้ดูของที่จะหมดได้
            tabs={[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'active', label: 'เปิดใช้งาน' },
              { id: 'inactive', label: 'ปิดใช้งาน' },
            ]}
            active={tab}
            onChange={(id) => {
              const t = id as 'all' | 'out' | 'low' | 'active' | 'inactive'
              setTab(t)
              load(0, sort, t)
            }}
          />

          {/* 🕰 คอลัมน์ Marketplace มาจากแคชเซิร์ฟเวอร์ที่ "คืนของเก่าก่อน" ได้ — แถบนี้ห้ามถอด */}
          {category && (
            <p className="text-[12.5px] mb-3">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-1">
                🗂️ กรองหมวด: <b>{category}</b>
                <button onClick={() => setCategory('')} title="ถอดตัวกรองหมวด"
                  className="text-blue-500 hover:text-blue-800 font-bold ml-0.5">✕</button>
              </span>
            </p>
          )}
          <MarketStaleBar stale={data.marketplacesStale} staleMs={data.marketplacesStaleMs} at={data.marketplacesAt} />
          <TableWrap>
            <table className="w-full min-w-[920px]">
              <thead className="bg-white border-b border-gray-200">
                {/* 🔃 **กดหัวคอลัมน์เพื่อเรียง — ทำเท่าที่ท่อเรียงได้จริงเท่านั้น**
                    จอ ZORT `/Product/list` กดเรียงได้ 6 คอลัมน์: รหัส · ชื่อสินค้า · ราคาซื้อ · ราคาขาย · คงเหลือ · พร้อมขาย
                    ยิงท่อทดสอบแล้ว 16 ก.ย. 2569: `?list=stock&sort=` รับจริงแค่ **qty · sold · sku**
                    ค่าที่ไม่รู้จัก (price · name · buy · available) **ตกกลับเป็น qty เงียบ ๆ ตอบ 200 เหมือนเดิม**
                    ⇒ ทำหัวคอลัมน์ให้กดได้ทั้ง 6 = **ปุ่มหลอก** 4 อัน (กดแล้วลำดับไม่เปลี่ยน ไม่มีอะไรบอก)
                       จึงกดได้เฉพาะสองอันที่เรียงได้จริง ที่เหลือเขียนเหตุผลไว้ใน tooltip + ขอไปที่ท่อแล้ว */}
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>
                    <button type="button" onClick={() => { setSort('sku'); load(0, 'sku') }}
                      className="hover:underline" title="เรียงตามรหัสสินค้า (ท่อเรียงให้ทั้งชุด ไม่ใช่แค่หน้านี้)">
                      รหัส{sort === 'sku' && ' ↑'}
                    </button>
                  </th>
                  <th className={TH}>
                    <span title="จอ ZORT กดเรียงช่องนี้ได้ แต่ท่อของเรายังเรียงตามชื่อไม่ได้ (ส่ง sort=name ไปแล้วมันตกกลับเป็นเรียงตามของใกล้หมด) — ขอฝั่งท่อไว้แล้ว ยังไม่ทำปุ่มที่กดแล้วไม่เกิดอะไร">
                      ชื่อสินค้า
                    </span>
                  </th>
                  <th className={THR}>
                    <span title="จอ ZORT กดเรียงช่องนี้ได้ แต่ท่อของเรายังเรียงตามราคาซื้อไม่ได้ — ขอฝั่งท่อไว้แล้ว">ราคาซื้อ</span>
                  </th>
                  <th className={THR}>
                    <span title="จอ ZORT กดเรียงช่องนี้ได้ แต่ท่อของเรายังเรียงตามราคาขายไม่ได้ — ขอฝั่งท่อไว้แล้ว">ราคาขาย</span>
                  </th>
                  <th className={THR}>
                    <button type="button" onClick={() => { setSort('qty'); load(0, 'qty') }}
                      className="hover:underline" title="เรียงจากของใกล้หมดก่อน (ท่อเรียงให้ทั้งชุด ไม่ใช่แค่หน้านี้)">
                      คงเหลือ{sort === 'qty' && ' ↑'}
                    </button>
                  </th>
                  <th className={THR}>
                    <span title="จอ ZORT กดเรียงช่องนี้ได้ แต่ท่อของเรายังเรียงตามจำนวนพร้อมขายไม่ได้ — ขอฝั่งท่อไว้แล้ว">พร้อมขาย</span>
                  </th>
                  {/* 🔴 **เคยเขียนไว้ว่า "API ไม่ส่งข้อมูลผูกสินค้ากับร้านมาร์เก็ตเพลสมาเลย
                      ⇒ ใส่ขีด" แล้วค้าง** — ท่อส่ง `marketplaces` มาตั้งแต่ 3 ก.ย. 2569
                      จอรายละเอียดสินค้ากับจอสินค้าชุดวาดโลโก้ได้มาตลอด **แต่จอนี้ยังขีดตายอยู่**
                      ⇒ เจ้าของร้านเปิดจอนี้แล้วเห็นขีด เลยถามว่า "เชื่อมต่อยัง"
                         ทั้งที่ต่อแล้วและข้อมูลมาถึงหน้าจอแล้ว (4 ก.ย. 2569)
                      ⚠️ **บทเรียน: ข้อความค้างที่แย่ที่สุดคือข้อความที่กลายเป็นโค้ดไปแล้ว**
                         คอมเมนต์ผิดคนอ่านโค้ดเข้าใจผิด · แต่อันนี้กลายเป็น `—` ตายตัวบนจอ
                         ไม่มีใครเห็นว่ามันไม่ได้อ่านข้อมูลเลย เพราะขีดกับ "ไม่ได้ลงขาย" หน้าตาเหมือนกัน */}
                  <th className={TH}>Marketplace</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {/* ⚠️ จอว่างใช้ผังแบบ ZORT — รูป + ลิงก์ชวนทำ + คำอธิบาย ไม่ใช่ตารางเปล่า
                    ตารางเปล่าอ่านได้ทั้ง "ไม่มีข้อมูล" และ "โหลดไม่สำเร็จ" คนใช้แยกไม่ออก */}
                {rows.length === 0 && (
                  tab === 'inactive'
                    ? <EmptyState cols={9} icon="📦" title="ยังไม่มีสินค้าที่ปิดใช้งาน"
                        detail="สินค้าทุกตัวในคลังเปิดขายอยู่ — ถ้าปิดใช้งานสินค้าที่ ZORT รายการจะมาโผล่ที่นี่" />
                    : <EmptyState cols={9} icon="🔍" title="ไม่พบสินค้าในเงื่อนไขนี้"
                        detail="ลองล้างคำค้น หรือเปลี่ยนแท็บ · ถ้าเพิ่งเพิ่มสินค้าที่ ZORT ต้องรอรอบซิงก์ถัดไป" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700 font-medium`}>{r.sku}</td>
                    {/* ⚠️ ZORT วางรูปไว้**ในคอลัมน์ชื่อสินค้า** ไม่ใช่คอลัมน์แยก (ภาพ 02-สินค้า.jpg)
                        ไม่มีรูป = กล่องเทา ห้ามปล่อยช่องว่าง แถวจะเบี้ยวและดูเหมือนโหลดไม่เสร็จ */}
                    <td className={TD}>
                      <span className="flex items-start gap-2.5">
                        {/* 🖼️ ลำดับ: แผนที่เรา → รูปย่อของ ZORT ในถังเรา → (ไฟล์ดิบ **ห้าม** ในตารางนี้)
                               ⇒ ส่ง allowRaw = false ตรง ๆ กันไฟล์ 2 MB หลุดเข้ามาหลายสิบแถว */}
                        {pickImage(imgOf(r.sku), r, 128, false)
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pickImage(imgOf(r.sku), r, 128, false) as string}
                              alt=""
                              loading="lazy"
                              className="w-10 h-10 rounded border border-gray-200 object-cover bg-white shrink-0"
                            />
                          )
                          : (
                            /* ไม่มีรูป — กล่องเทาเหมือนเดิม แต่ **บอกเหตุผลผ่าน title** ให้ต่างกันสองแบบ
                               (ใส่ข้อความในตารางทุกแถวจะรก ⇒ ใช้ tooltip · หน้ารายละเอียดเขียนเต็ม) */
                            <span
                              className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0"
                              title={noImageReason(r) === 'zort-none'
                                ? 'ZORT ไม่มีรูปของรหัสนี้ — ต้องถ่ายรูปเพิ่ม'
                                : noImageReason(r) === 'not-thumbed'
                                  ? 'ZORT มีรูปของรหัสนี้แล้ว แต่ยังไม่ได้ย่อลงถังเรา — กดที่รหัสเพื่อดูรูป'
                                  : 'ยังไม่รู้ว่ามีรูปไหม (ยังไม่ซิงก์ หรือไม่อยู่ในทะเบียนสินค้า)'}
                            />
                          )}
                        <span className="min-w-0">
                      {/* 🔴 เคยเป็น span สีฟ้าที่กดไม่ได้ — เจ้าของร้านกดจากมือถือ 5 จุดแล้วแจ้งว่า
                          "กดเข้าสินค้าไม่ได้เลย" · **สีฟ้าในตาราง = สัญญาว่ากดได้**
                          แก้โดยทำหน้าจริงขึ้นมา ไม่ใช่ถอดสีฟ้าออก (3 ก.ย. 2569) */}
                      <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                        {r.name || <span className="text-gray-400">— ท่อไม่ส่งชื่อมา</span>}
                      </Link>
                      {รหัสผิดรูป(r.sku) && (
                        <span
                          className="ml-1.5 text-[10.5px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded px-1 py-0.5"
                          title="รหัสนี้ไม่ใช่รหัสสินค้า — หน้าตาเป็นสตริงตัวเลือกของมาร์เก็ตเพลสต่อกัน (วัดเจอ 1 แถวจาก 2,672 เมื่อ 16 ก.ย. 2569) · จำนวนของแถวนี้ยังไม่ควรนับรวมคลัง และกดเข้าไปจะไม่มีข้อมูลสินค้า · แจ้งฝั่งท่อแล้ว"
                        >
                          รหัสผิดรูป
                        </span>
                      )}
                      {!ตรงที่เห็นบนจอ(r) && (
                        <span
                          className="ml-1.5 text-[10.5px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded px-1 py-0.5"
                          title="แถวนี้ไม่มีคำค้นอยู่ในรหัสหรือชื่อ — ท่อค้นในช่องอื่นที่ตารางนี้ไม่ได้แสดงด้วย และยังไม่รู้ว่าช่องไหน (จอ ZORT ค้นคำเดียวกันจะไม่เจอแถวนี้) · ไม่ได้แปลว่าผิด แต่ต้องกดเข้าไปดูเองว่าตรงตรงไหน"
                        >
                          ตรงที่ช่องอื่น
                        </span>
                      )}
                      {r.service && (
                        // ติดป้ายเฉพาะตอนแสดงบริการด้วย จะได้รู้ทันทีว่าทำไมแถวนี้ติดลบ
                        <span className="ml-1.5 text-[10.5px] font-semibold text-gray-600 bg-gray-100 rounded px-1 py-0.5">
                          บริการ
                        </span>
                      )}
                      {r.active === false && (
                        <span className="ml-1.5 text-[10.5px] font-semibold text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                          ปิดใช้งาน
                        </span>
                      )}
                        </span>
                      </span>
                    </td>
                    {/* ⚠️ ราคาซื้อ null = ยังไม่ได้กรอก ≠ ฿0 · เขียน ฿0 = บอกว่าของฟรี */}
                    <td className={TDR}>
                      {typeof r.buy === 'number' && r.buy > 0
                        ? fmtMoney(r.buy)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TDR}>{r.price ? fmtMoney(r.price) : '0'}</td>
                    <td className={TDR}>
                      <Num v={r.qty} zeroRed />
                      {r.unit && <span className="ml-1 text-[11px] text-gray-400">{r.unit}</span>}
                      {r.qty < 0 && (
                        <span className="ml-1.5 text-[10.5px] font-semibold text-red-600 bg-red-50 rounded px-1 py-0.5">
                          ติดลบ
                        </span>
                      )}
                    </td>
                    {/* ⚠️ พร้อมขาย null = ไม่มีในทะเบียน **ห้ามเอาคงเหลือมาแทน** */}
                    <td className={TDR}>
                      {typeof r.available === 'number'
                        ? <Num v={r.available} />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TD}>
                      <MarketLogos list={r.marketplaces} by={r.marketplacesBy} from={r.marketplacesFrom} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {/* เมนูชุดเดียวกับปุ่ม "คำสั่ง ▾" ในหน้ารายละเอียด — อยู่ที่ lib/product-menu.ts */}
                      <RowMenu items={productMenuItems(r.sku, (href) => { window.location.href = href })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {(offset + 1).toLocaleString('th-TH')}–{shown.toLocaleString('th-TH')} จาก {inTab.toLocaleString('th-TH')} รายการ
                {' '}· <MarketCoverage checked={data.checkedMarketplaces}
              failed={data.marketplacesFailed} notConnected={data.marketplacesNotConnected}
              at={data.marketplacesAt} />
                {/* 🔴 เดิมเขียนเลข 2,898 กับ 226 **ตายตัวในข้อความ** ทั้งที่ท่อส่ง
                    `zortTotal` / `noSkuInZort` มาให้อยู่แล้ว ⇒ ร้านเพิ่มสินค้าเมื่อไหร่
                    บรรทัดนี้กลายเป็นคำโกหกทันที โดยไม่มีอะไรฟ้อง (โรคเดียวกับคอลัมน์ Marketplace)
                    ⚠️ ไม่มีค่ามาก็ไม่ต้องเขียนบรรทัดนี้ — ดีกว่าเขียนเลขที่เดาเอง */}
                {typeof data.zortTotal === 'number' && typeof data.noSkuInZort === 'number' && (
                  <>
                    {' '}· ZORT แสดง <b>{data.zortTotal.toLocaleString('th-TH')}</b> รายการ
                    ต่างจากที่นี่ <b>{data.noSkuInZort.toLocaleString('th-TH')}</b> รายการ —
                    เป็นรายการที่<b>ไม่มีรหัสสินค้า ไม่มีของในสต็อก และมูลค่ารวม 0 บาท</b>
                    (ตรวจแล้ว) จึงไม่ถูกดึงเข้ามา ไม่ใช่ข้อมูลตกหล่น
                  </>
                )}
                {/* ⚠️ ZORT มีปุ่ม "Connect" ในทุกแถวของคอลัมน์ Marketplace (ผูกสินค้ากับร้านบนแพลตฟอร์ม)
                    เราไม่ทำ เพราะเป็นการ **เขียนกลับ**ไปที่แพลตฟอร์ม ซึ่งยังไม่มีสิทธิ์
                    ⇒ ปุ่มสีเทาทุกแถว 2,672 แถวไม่ได้ช่วยใคร แต่ **ห้ามเงียบ** จึงเขียนบอกตรงนี้แทน */}
                {' '}· ZORT มีปุ่ม <b>Connect</b> ในคอลัมน์ Marketplace ทุกแถว (ผูกสินค้ากับร้าน
                บนแพลตฟอร์ม) — <b>เรายังทำไม่ได้</b> เพราะต้องเขียนกลับไปที่แพลตฟอร์ม
                ซึ่งยังไม่มีสิทธิ์ · ตอนนี้ต้องไปผูกที่หน้าร้านของแต่ละเจ้าเอง
                {tab === 'out' && (
                  <span className="text-gray-400">
                    {' '}· &quot;ของหมด&quot; รวมของที่<b>ติดลบ</b>ด้วย
                    {kind === 'goods'
                      ? ' — ติดลบตรงนี้คือขายออกไปมากกว่าที่ระบบรู้ว่ามี ไม่ใช่รายการบริการ (ซ่อนไว้แล้ว)'
                      : ' ซึ่งส่วนใหญ่คือรายการบริการที่ไม่มีสต็อกจริง'}
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                {/* เลขหน้า + จำนวนต่อหน้า แบบ ZORT — คุมจากชิ้นเดียว (components/zort/PageNav.tsx) */}
                <PageNav offset={offset} perPage={perPage} total={inTab} rowsOnPage={rows.length}
                  disabled={loading} onGo={(off) => load(off)}
                  onPerPage={(n) => { setPerPage(n); load(0, sort, tab, kind, q, n) }} />
              </div>
            </div>
          </TableWrap>
        </>
      )}
    </div>
  )
}

/* 🔴 **แถวที่รหัสไม่ใช่รหัสสินค้า** — ยิงนับทั้งทะเบียน 16 ก.ย. 2569 เจอ 1 แถวจาก 2,672:
      รหัสเป็นสตริงตัวเลือกของมาร์เก็ตเพลสต่อกัน (`400014402:-1#General;191288010:-1#White…`)
      ไม่มีชื่อสินค้า · ไม่มี available/buy/active · แต่มี **qty 100** และราคาติดมา
   ⇒ ถ้าปล่อยให้ดูเหมือนสินค้าปกติ คนจะนับของ 100 ชิ้นนี้รวมเข้าคลัง และกดเข้าไปเจอจอเปล่า
   ⇒ ติดป้ายบอกตรง ๆ ว่าแถวนี้เชื่อไม่ได้ (แจ้งฝั่งท่อแล้ว — ต้นทางอยู่ที่การซิงก์มาร์เก็ตเพลส) */
function รหัสผิดรูป(sku?: string | null): boolean {
  const s = String(sku ?? '')
  return s.includes(';') || s.includes('#') || s.length > 40
}

export default function CoreStockPage() {
  // useSearchParams ต้องอยู่ใน Suspense ไม่งั้น build ของ Next ตก (แพตเทิร์นเดียวกับ sales/detail)
  return (
    <Suspense fallback={<div className="p-6"><LoadingState /></div>}>
      <CoreStockInner />
    </Suspense>
  )
}
