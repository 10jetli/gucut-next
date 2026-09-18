'use client'
// รายการขาย — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT เลยสักคำสั่ง
//
// **หน้าตาลอกจากจอ "รายการขาย" ของ ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
// เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" — คนใช้ ZORT ทุกวันต้องย้ายมาแล้วใช้เป็นทันที
// ผังที่ลอกมา: ชื่อจอ → บรรทัด "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" → ปุ่มขวาบน
//              → แถวค้นหา + ตัวเลือกช่วงเวลา → แท็บสถานะมีจำนวนในวงเล็บ
//              → ตาราง: # · วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ
import { useCallback, useEffect, useState } from 'react'
import { SALE_STATUS, PAY_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, toneOfStatus, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, summaryLine, ChannelTag, relDay, RowMenu, EmptyState, DataUnreliableBanner,
  thaiDate, thaiShort, PaymentPill, StaleBar, PageNav, RowCheck, BulkBar,} from '@/components/zort'
import ImportButton from '@/components/zort/ImportButton'
import AdvancedSearch, { AdvancedSearchLink } from '@/components/zort/AdvancedSearch'
import { loadFilter, saveFilter, clearFilter, describeFilter } from '@/lib/remembered-filter'
import { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import StoreEcho from '@/components/zort/StoreEcho'
import ExportButton from '@/components/zort/ExportButton'
import { peekApiCache, putApiCache, ageText } from '@/lib/api-cache'
import ShipStatusCard, { type ShipGroup } from '@/components/zort/ShipStatusCard'
import DataFreshness, { type Freshness } from '@/components/zort/DataFreshness'
import DormantInShipPile from '@/components/zort/DormantInShipPile'

interface Row {
  id: string; source: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
  // ── สามช่องที่ ZORT มีแต่จอเรายังไม่มี (ภาพ 01-รายการขาย.jpg) ──
  // ⚠️ ค่าพวกนี้ **มีอยู่ในคลังเงาแล้ว** (ตาราง orders มีคอลัมน์ ship_channel · ship_date ·
  //    tracking_no · is_cod และตัว sync เขียนลงจริง) แต่ `listOrders` ไม่ได้ SELECT ออกมา
  //    ⇒ ข้อมูลมีแต่มองไม่เห็น · จอจึงเตรียมช่องไว้ พอฝั่งเซิร์ฟเวอร์ส่งมาก็ขึ้นเอง
  ship_channel?: string
  ship_name?: string
  ship_date?: string
  tracking_no?: string
  is_cod?: number | boolean
  /** ⚠️ ชื่อจริงจากท่อคือ `pay_status` (Paid · Pending) — คนละอย่างกับ status ของใบ
   *  เคยเดาชื่อไว้ว่า payment_status ถ้าไม่ได้ยิงของจริงเทียบ คอลัมน์จะเป็นขีดตลอดกาลแบบเงียบ ๆ */
  pay_status?: string
  // ── สถานะฝั่งมาร์เก็ตเพลส (คนละเรื่องกับ status ของใบ) ──
  /** ค่าดิบจากแพลตฟอร์ม — ส่งมาคู่กับคำแปลเสมอ ไว้ให้คนไล่ปัญหาเห็นของจริง */
  integrationStatus?: string | null
  /** คำแปลไทยจากท่อ · **จอห้ามแปลเอง** ค่าดิบของ 3 เจ้าสะกดชนกันได้ */
  shipStatus?: string | null
  shipStatusGroup?: string | null
  shipStatusKnown?: boolean
  shipStatusFrom?: string
  /** true = คำแปลนี้ยังไม่ได้ยืนยันกับเอกสารทางการ (รหัสตัวเลขของ TikTok) */
  shipStatusUnverified?: boolean
  /** เหตุผลที่ช่องสถานะว่าง — none_expected = ช่องทางนี้ไม่มีใครบอกสถานะ (ปกติ)
   *  source_empty = ช่องทางนี้ควรมีค่า แต่ใบนี้ต้นทางไม่ส่งมา */
  blankReason?: 'none_expected' | 'source_empty'
}
interface ChannelRow { channel: string; orders: number; amount: number }
interface StatusRow { status: string; orders: number; amount: number }
interface ListResp {
  /** 🏬 ร้านที่ท่อใช้จริง — เส้นนี้ `null` = **รวมทุกร้าน** (ไม่ใช่ z1) ยิงยืนยัน 17 ก.ย. 2569 */
  store?: string | null
  skip?: string
  from: string; to: string
  total: number; totalAmount: number
  /* ── เงินสามตัวที่ต้องแยกให้ขาด (ฝั่งท่อเพิ่มให้ 6 ก.ย. 2569) ──────────────
     🔴 `totalAmount` **รวมใบที่ยังไม่จ่าย** — วัดจริง 1 ม.ค.–6 ก.ย.:
        บวมเกินจริง 11.2% (฿640,345 เป็นใบยังไม่จ่าย เกือบทั้งหมดคือซากช่องทางที่ปิดไปแล้ว)
        ⇒ ใครอ่านหัวจอแล้วคิดว่านั่นคือ "เงินที่ได้" จะเกินจริงเกือบเจ็ดแสน
     ⚠️ ที่มาของบั๊กน่าจำ: ในคำตอบเดียวกันมี storeScope · shipStatusScope · freshnessNote
        ประกาศขอบเขตครบทุกอย่าง **แต่ตัวเลขเงินซึ่งสำคัญที่สุดกลับไม่มีอะไรกำกับ**
     ⚠️ ไม่มีคีย์พวกนี้ = ท่อรุ่นเก่า ⇒ ต้องยังอ่านรู้เรื่อง ห้ามพังและห้ามเงียบ */
  totalPaidAmount?: number
  totalUnpaidAmount?: number
  /** 🔍 ตัวกรองขั้นสูงที่ **ท่อใช้กรองจริง** (null = ไม่ได้กรองช่องนั้น · ท่อรุ่นเก่าจะไม่มีคีย์นี้เลย)
   *  🔴 จอต้องอ่านตัวนี้ก่อนจะเขียนว่า "กรองแล้ว" — ไม่ใช่เชื่อว่าส่งไปแล้วต้องถูกใช้
   *     (ฝั่งท่อออกแบบช่องนี้มาเพื่อการนี้โดยตรง · สัญญา eb79ccc) */
  advancedFilters?: Record<string, string | null>
  totalScope?: string
  /** ข้อความบอกว่าตัวเลขสถานะเชื่อไม่ได้ตอนนี้ + เหตุผล — null/ว่าง = เชื่อได้
   *  ⚠️ จอไม่ตัดสินเอง อ่านจากท่อล้วน ๆ (กลไกเดียวกับ marketplacesUnreliable) */
  statusUnreliable?: string | null
  limit: number; offset: number
  rows: Row[]; byChannel: ChannelRow[]; byStatus: StatusRow[]; channels: string[]
  /** สรุปสถานะจัดส่งเป็นกอง — ท่อแปลรหัสของ 3 แพลตฟอร์มมาให้แล้ว จอไม่ต้องรู้จักรหัสดิบ */
  shipStatusGroups?: ShipGroup[]
  /** ข้อความบอกขอบเขตของตัวเลขในกอง — จอเอาไปแสดง **และตรวจซ้ำกับ total เสมอ** */
  shipStatusScope?: string | null
  /** อายุข้อมูล — ทุกตัวเลขบนจอนี้มาจากกระจก ไม่ได้ยิง ZORT สด ⇒ ต้องบอกว่าเก่าแค่ไหน */
  freshness?: Freshness | null
}
interface Detail {
  error?: string
  order?: Row
  items?: { line: number; sku: string; name: string; qty: number; amount: number }[]
}

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

// ⚠️ ชื่อสถานะในคลังเงาเป็นภาษาอังกฤษดิบจาก ZORT — **แปลบนจอเท่านั้น**
//    ค่าที่ส่งกลับ API ต้องเป็นค่าดิบเสมอ ไม่งั้นกรองไม่ตรง (เซิร์ฟเวอร์เทียบตรงตัว ไม่ใช่ LIKE)
//    ชื่อที่ไม่รู้จักให้แสดงค่าดิบไปเลย ดีกว่าเดาคำแปลผิด
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(SALE_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}

/* ── ใบที่ปิดแล้วแต่ยังไม่มีเลขพัสดุ ──────────────────────────────────
   **ป้ายนี้ไม่แก้ตัวเลขไหนทั้งนั้น หน้าที่เดียวคือทำให้เห็น**

   🔴 **ประวัติของเกณฑ์นี้ เก็บไว้เพราะเปลี่ยนมาแล้ว 3 รอบในคืนเดียว (4 ก.ย. 2569)**
   รอบ 1 "ใบสำเร็จ + แพลตฟอร์มว่ารอจัดส่ง/กำลังจัดส่ง" → ติด 124/600 = 21% ของทุกหน้า
        81 ใบเป็นของอยู่บนรถตามปกติ (56 ใบถึงมือลูกค้าแล้วด้วยซ้ำ) = เสียงหอน
   รอบ 2 ตัดเหลือ "แพลตฟอร์มว่ายังไม่ออกจากร้าน" → 43 ใบ 7% · 42 ใบเป็น Lazada `confirmed`
   รอบ 3 **ฝั่งท่อยิง ZORT ดูใบพวกนั้นทีละใบ แล้วพบว่าทุกใบมีเลขพัสดุ + วันส่งครบ**
        ⇒ ของออกจากร้านไปนานแล้ว Lazada แค่ไม่ขยับ `confirmed` ให้ตลอดกาล
        ⇒ ป้ายรอบ 2 **โกหก 42 ใบจาก 43** ทั้งที่ดูสมเหตุสมผลมาก

   บทเรียน: `integration_status` ตอบคำถาม "แพลตฟอร์มว่าออเดอร์อยู่ขั้นไหน"
   ไม่ได้ตอบ "ของออกจากร้านหรือยัง" — คำตอบจริงอยู่ที่ `tracking_no` กับ `ship_date`
   (`marketplaceshippingstatus` ของ ZORT ก็ไม่ใช่คำตอบ — ยิงแล้ว null ทุกใบทุกช่องทาง)

   ⚠️ ต้องกรองเฉพาะใบที่ "มีการจัดส่ง" ด้วย ไม่งั้นขายหน้าร้านติดป้ายทั้งหมด
      วัดแล้ว: เกณฑ์เปล่า ๆ ติด 273/800 ใบ **เป็น POS ทั้ง 273 ใบ** (ขายหน้าร้านไม่มีพัสดุ)
      ⇒ ใช้ "แพลตฟอร์มรายงานสถานะใบนี้ไหม" เป็นตัวกรอง — ตัดสินจากข้อมูล ไม่ใช่จากชื่อช่องทาง
      (กติกาเดียวกับ no-substring-classification — ห้ามเช็คว่าชื่อช่องทางมีคำว่า POS)

   ⚠️ เทียบ `status` แบบตรงตัว — คลังมีสถานะแค่ 3 แบบ (Success · Voided · Pending)
      สถานะใหม่ที่ยังไม่รู้จักจะไม่ถูกติดป้าย เงียบไว้ดีกว่าเตือนผิด

   📌 **ตอนเขียนเกณฑ์นี้ ไม่มีใบไหนเข้าเงื่อนไขเลย** (สุ่ม 2,000 ใบทั้งปี = 0)
      ไม่ใช่ป้ายเสีย — แปลว่าร้านไม่เคยปิดใบก่อนได้เลขพัสดุ
      ใบที่ยังไม่มีเลขพัสดุจริง ๆ มีอยู่ 12 ใบ แต่ทุกใบสถานะยัง Pending (ยังไม่ปิด)
      ⇒ ป้ายจะโผล่วันที่มีคนปิดใบก่อนแปะพัสดุ ซึ่งคือสิ่งที่อยากจับพอดี */
const shipped = (r: Row) =>
  !!String(r.tracking_no ?? '').trim() || !!String(r.ship_date ?? '').trim()
/** ใบนี้ผ่านการจัดส่งไหม — ดูจาก "แพลตฟอร์มรายงานสถานะให้ไหม" ไม่ได้ดูชื่อช่องทาง */
const viaPlatform = (r: Row) =>
  !!r.shipStatusGroup
  && !r.shipStatusGroup.startsWith('blank')
  && r.shipStatusGroup !== 'unknown'
const isMismatch = (r: Row) => r.status === 'Success' && viaPlatform(r) && !shipped(r)

/** อายุใบเป็นวัน — ใส่ในคำอธิบายป้าย เพราะ "ยังไม่ออก 3 วัน" กับ "ยังไม่ออก 20 วัน" คนละเรื่อง */
function ageDays(day?: string): number | null {
  if (!day) return null
  const t = Date.parse(`${day}T00:00:00+07:00`)
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 864e5)
}

const PAGE = 50
/** 💾 กุญแจของที่จำไว้ในเครื่องผู้ใช้ · ขึ้นต้นด้วยชื่อจอเสมอ กันชนกับจออื่น */
/** ป้ายไทยของตัวกรองขั้นสูง (ใช้ตอนเขียนว่าท่อกรองอะไรให้จริง) */
const ADV_TH: Record<string, string> = {
  payStatus: 'สถานะชำระเงิน', cod: 'เก็บเงินปลายทาง', product: 'สินค้า', shipChannel: 'ช่องทางจัดส่ง',
  shipFrom: 'ส่งตั้งแต่', shipTo: 'ส่งถึง', amountMin: 'มูลค่าตั้งแต่', amountMax: 'มูลค่าถึง',
  number: 'หมายเลขรายการ', customer: 'ชื่อลูกค้า', tag: 'Tag', createUser: 'ผู้สร้าง', warehouse: 'คลัง',
}
/** ชื่อพารามิเตอร์ที่จอส่ง → ชื่อคีย์ที่ท่อสะท้อนกลับ (คนละสะกด ⇒ ต้องมีตารางแปลง ไม่ใช่เดา) */
const ADV_KEY: Record<string, string> = {
  paystatus: 'payStatus', cod: 'cod', product: 'product', shipchannel: 'shipChannel',
  shipfrom: 'shipFrom', shipto: 'shipTo', amountmin: 'amountMin', amountmax: 'amountMax', number: 'number',
  tag: 'tag', createuser: 'createUser', warehouse: 'warehouse', customer: 'customer',
}

const MEMO_KEY = 'gucut:core-sales:filter'
const DEFAULT_DAYS = 90

const RANGES = [
  { days: 7, label: 'ย้อนหลัง 7 วัน' },
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]

export default function CoreSalesPage() {
  const router = useRouter()
  const [days, setDays] = useState(DEFAULT_DAYS)
  /* 🔴 **ตัวกรองร้าน — ต้องมีคู่กับตัวกรองช่องทางเสมอ** (เพิ่ม 4 ก.ย. 2569)
     ชื่อช่องทางซ้ำกันข้ามร้านจริง: TIKTOK มีทั้งใน z1 (753 ใบ ยังขายอยู่)
     และ z2 (58 ใบ เลิกขาย 22 ก.พ. 69) ⇒ กรองแค่ช่องทางแล้วอ่านวันล่าสุด
     จะได้ "วันนี้" แล้วสรุปว่าร้านที่เลิกไปแล้วยังขายอยู่
     **ตัวกรองที่ไม่ครอบคลุมมิติที่ข้อมูลมีจริง จะให้คำตอบที่ดูสมเหตุสมผลเสมอ
     และไม่มีอะไรฟ้องว่าคำตอบมาจากของสองกองปนกัน** (ฝั่งท่อเกือบสรุปผิดมาแล้ว) */
  const [store, setStore] = useState('')
  const [channel, setChannel] = useState('')
  // ⚠️ แท็บของ ZORT เป็น "สถานะ" ไม่ใช่ช่องทาง — คนที่ชิน ZORT จะมองหาแท็บ "รอโอน"
  //    ช่องทางของ ZORT อยู่เป็นคอลัมน์ + ตัวกรอง เราจึงย้ายมาเป็น dropdown ให้ตรงกัน
  const [status, setStatus] = useState('')
  /* 🔴 **รับ `?q=` จาก URL** (แก้ 16 ก.ย. 2569 · เจอตอนไล่ตามลิงก์ข้ามจอ)
     จอรายละเอียดลูกค้าลิงก์เลขที่ใบเข้ามาที่ `/core/sales?q=<เลขที่ใบ>` เพื่อให้กดดูใบนั้นได้
     แต่จอนี้ไม่เคยอ่านค่าจาก URL ⇒ กดแล้วได้รายการทั้งช่วงวัน ต้องพิมพ์เลขค้นเองอีกรอบ
     ⚠️ อ่านจาก `window.location.search` ตรง ๆ ไม่ใช้ useSearchParams
        เพราะจอนี้ไม่ได้ห่อ <Suspense> ไว้ — ใช้ hook นั้นแล้ว build ของ Next จะตก
        (จอสินค้าห่อไว้จึงใช้ hook ได้ · ที่นี่เลือกวิธีที่ไม่ต้องรื้อโครงจอ) */
  const [q, setQ] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') ?? ''
  })
  /* 🔍 **ค้นหาขั้นสูง** — ZORT มี advanceSearch() ทุกจอรายการ ของเรามีแต่ลิงก์ที่ไม่ทำอะไร
     ⇒ ทำของจริงเท่าที่ **ท่อรองรับจริง**: ช่วงวันที่กำหนดเอง (เส้น list=orders รับ from/to)
     ⚠️ ตัวเลือก "แสดง N วัน" เดิมทำได้แค่ค่าสำเร็จรูป ⇒ ย้อนดูเดือนใดเดือนหนึ่งไม่ได้เลย
     ⚠️ **ห้ามใส่ช่องกรองที่ท่อไม่รองรับ** ลงในแผงนี้ — ช่องที่กรอกแล้วไม่มีผล
        แย่กว่าไม่มีช่อง เพราะคนกรอกแล้วเชื่อว่ากรองแล้ว */
  const [advOpen, setAdvOpen] = useState(false)
  /* 🔴 **รับ `?from=` `?to=` จาก URL ด้วย** (แก้ 17 ก.ย. 2569 · ใบ t_mu2u9mym)
     ลิงก์ `?q=<เลขที่ใบ>` อย่างเดียวค้นได้แค่ในช่วง 90 วันของจอ
     วัดจริง: สุ่มใบที่มีสลิป 12 ใบ ⇒ ค้นในช่วง 90 วันเจอ **1 ใบ** · เปิดช่วงกว้างเจอ **12 ใบ**
     ⇒ คนกดลิงก์จากจอลูกค้า/จอไฟล์แล้วเห็น "ไม่พบ" ทั้งที่ใบมีอยู่จริง = ลิงก์ที่หลอกว่าไม่มีของ
     ⇒ จอที่ลิงก์เข้ามาต้องส่งช่วงวันของใบนั้นมาด้วย */
  const [advFrom, setAdvFrom] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('from') ?? '')
  const [advTo, setAdvTo] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('to') ?? '')
  /* 🔍 **ตัวกรองขั้นสูงชุดใหม่** (ท่อ gucut-web eb79ccc · 15 ก.ย. 2569)
     ยิงยืนยันเองแล้วทุกตัวก่อนต่อจอ (z1 1–14 ก.ย. ฐาน 319 ใบ):
       cod=1 ⇒ 240 · cod=0 ⇒ 79 (รวม 319 พอดี) · paystatus=Paid ⇒ 300 · Pending ⇒ 2
       product=00313 ⇒ 44 · ช่วงวันส่ง 5–8 ก.ย. ⇒ 75 · amountmin=1000 ⇒ 59 · number=SO ⇒ 22
       shipchannel=Flash ⇒ 315 · ค่าพัง (cod=2 · amountmin=abc · min>max · วันส่งกลับด้าน) ⇒ 400 ทุกตัว
     ✅ **ช่อง "ชื่อลูกค้า" ต่อแล้ว 17 ก.ย. 2569** — เดิม `?customer=` ชนกับเส้น "ลูกค้ารายคน" ของท่อ
        (router จับ `customer` ก่อนถึง `list=orders` ⇒ ได้ก้อนคนละรูป ไม่มี `total`) · ท่อแก้แล้ว 701aa59
        ⚠️ ด่านรูปคำตอบใน load() ยังอยู่ — ถ้าชนแบบนี้อีกจะขึ้น error ไม่ใช่ตารางว่าง */
  const [fPay, setFPay] = useState('')
  const [fCod, setFCod] = useState('')
  const [fProduct, setFProduct] = useState('')
  const [fShipCh, setFShipCh] = useState('')
  const [fShipFrom, setFShipFrom] = useState('')
  const [fShipTo, setFShipTo] = useState('')
  const [fMin, setFMin] = useState('')
  const [fMax, setFMax] = useState('')
  const [fNumber, setFNumber] = useState('')
  /* 🏷 Tag · ผู้สร้าง · คลัง — ท่อเปิดแล้ว (gucut-web orders-tag-creator-warehouse) · ยิงยืนยันของจริง 17 ก.ย. 2569
     z1+z2 1 ส.ค.–16 ก.ย. ฐาน 1,337 ใบ: warehouse=NEW ⇒ 900 · KLD ⇒ 98 · W0001 ⇒ 0 (รหัสคลังเป็นตัวย่อ ไม่ใช่ W000x)
     tag / createuser ⇒ ค้นแบบ "มีคำนี้อยู่" · warehouse ⇒ **ต้องตรงตัว** ⇒ ทำเป็นตัวเลือก ไม่ใช่ช่องพิมพ์
     ⚠️ ใบก่อน 1 ก.ย. 2569 ส่วนหนึ่งยังไม่รู้คลัง (ท่อยังไม่กวาดย้อนหลัง) ⇒ เลือกคลังแล้วใบพวกนั้นไม่ขึ้น */
  const [fTag, setFTag] = useState('')
  const [fCreator, setFCreator] = useState('')
  const [fWh, setFWh] = useState('')
  /* 👤 ชื่อลูกค้า — ท่อแก้เส้นชนแล้ว (gucut-web 701aa59 · ขึ้น 17 ก.ย. 2569 23:0x)
     ยิงยืนยันของจริง: customer=a ⇒ 46 จาก 1,337 ใบ + สะท้อน advancedFilters.customer · ค้นแบบ "มีคำนี้อยู่" */
  const [fCustomer, setFCustomer] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('customer') ?? '')
  /* 💾 **จำตัวกรองไว้** — ลอกติ๊ก `remember_filter` ของ ZORT (แผง "ตัวกรอง" ใน /Sell/list)
     🔴 ของที่จำไว้ถูกใส่กลับให้เอง ⇒ **ต้องประกาศทุกครั้งที่ใช้** ไม่งั้นคนเห็นรายการน้อยกว่าจริง
        แล้วสรุปยอดผิดทั้งวันโดยไม่มีอะไรบอกว่ากำลังกรองอยู่
     🔑 **ไม่จำคำค้นหา** — คำที่ค้างจากเมื่อวานคือของที่หลอกที่สุด (ตรรกะ+เทสอยู่ที่ lib/remembered-filter.ts) */
  const [remember, setRemember] = useState(false)
  /** รายการที่ถูกใส่กลับให้รอบนี้ · ว่าง = ไม่ได้ใช้ของที่จำไว้ */
  const [restored, setRestored] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  /* ☑️ เลือกหลายใบแล้วสั่งงาน — ZORT ทำแบบนี้ (ติ๊กแล้วมี "คำสั่ง" กับ "พิมพ์เอกสาร" โผล่)
     วัดจอ ZORT จริง 16 ก.ย. 2569 `/Sell/list`:
       คำสั่ง (8): ปักหมุดบนสุด · ถอนหมุด · เพิ่ม Tag · แก้ไขข้อมูลขนส่ง · โอนสินค้าทั้งหมด ·
                   ชำระเต็มจำนวน · รวมรายการ · ซ่อน   (+ ปุ่ม "พร้อมส่ง (Marketplace)")
       พิมพ์เอกสาร (8): ใบวางบิล · ใบจ่าหน้าจดหมาย/กล่อง · ใบจัดเตรียมสินค้า · ฉลากจัดส่ง ·
                   ใบแจ้งยอดชำระ · ใบส่งสินค้า (PDF) · ใบส่งสินค้า+ใบสั่งซื้อ · ใบยืนยันการจัดส่ง
     ⚠️ เราทำได้จริงตอนนี้แค่ **ใบจัดเตรียมสินค้า** (อ่านอย่างเดียว) กับ **คัดลอกเลขที่ใบ**
        คำสั่งที่เหลือทุกอันต้องเขียนกลับไปที่ ZORT ⇒ ไม่ทำปุ่มหลอก เขียนบอกบนแถบแทน
     🔴 ล้างที่เลือกทุกครั้งที่โหลดใหม่ — ไม่งั้นใบที่มองไม่เห็นบนจอค้างอยู่ในคำสั่ง */
  const [picked, setPicked] = useState<string[]>([])
  const [copyMsg, setCopyMsg] = useState('')
  const copyNumbers = async (list: string[]) => {
    const nums = list.map((id) => rows.find((r) => r.id === id)?.number ?? id)
    try {
      await navigator.clipboard.writeText(nums.join(','))
      setCopyMsg(`คัดลอกแล้ว ${nums.length.toLocaleString('th-TH')} เลขที่ใบ`)
    } catch {
      setCopyMsg('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เขียนคลิปบอร์ด')
    }
    setTimeout(() => setCopyMsg(''), 6000)
  }
  const [perPage, setPerPage] = useState(PAGE)

  const [data, setData] = useState<ListResp | null>(null)
  const [loading, setLoading] = useState(true)
  /** อายุของข้อมูลที่กำลังโชว์ — ไม่ null = โชว์ของเก่าอยู่ และยังดึงของใหม่ไม่เสร็จ */
  const [staleAge, setStaleAge] = useState<number | null>(null)
  /** ⚠️ ยิงของใหม่พลาด **แต่ยังโชว์ของเก่าอยู่** — ต้องเปลี่ยนข้อความบนแถบ ไม่ใช่เอาแถบออก
   *  เอาแถบออก = จอโชว์ตัวเลขอายุ 60 วิ โดยไม่มีอะไรบอกว่ามันเก่า */
  const [staleFailed, setStaleFailed] = useState(false)
  const [error, setError] = useState('')

  /** คู่ค่าของตัวกรองขั้นสูงที่ "กรอกแล้วจริง ๆ" — ที่เดียว ใช้ทั้งตอนโหลดและตอนส่งออก
   *  🔴 **ถ้าลืมส่งชุดนี้ไปกับปุ่มส่งออก ไฟล์จะไม่ตรงกับตารางบนจอ** (ฝั่งท่อกำชับ) */
  const advParams = useCallback((): [string, string][] => {
    const out: [string, string][] = []
    if (fPay) out.push(['paystatus', fPay])
    if (fCod) out.push(['cod', fCod])
    if (fProduct.trim()) out.push(['product', fProduct.trim()])
    if (fShipCh.trim()) out.push(['shipchannel', fShipCh.trim()])
    if (fShipFrom) out.push(['shipfrom', fShipFrom])
    if (fShipTo) out.push(['shipto', fShipTo])
    if (fMin.trim()) out.push(['amountmin', fMin.trim()])
    if (fMax.trim()) out.push(['amountmax', fMax.trim()])
    if (fNumber.trim()) out.push(['number', fNumber.trim()])
    if (fTag.trim()) out.push(['tag', fTag.trim()])
    if (fCreator.trim()) out.push(['createuser', fCreator.trim()])
    if (fWh) out.push(['warehouse', fWh])
    if (fCustomer.trim()) out.push(['customer', fCustomer.trim()])
    return out
  }, [fPay, fCod, fProduct, fShipCh, fShipFrom, fShipTo, fMin, fMax, fNumber, fTag, fCreator, fWh, fCustomer])

  const load = useCallback(async (
    off = 0,
    opt?: { days?: number; channel?: string; status?: string; store?: string; from?: string; to?: string; size?: number; q?: string; customer?: string },
  ) => {
    const d = opt?.days ?? days
    const ch = opt?.channel ?? channel
    const st = opt?.status ?? status
    const sr = opt?.store ?? store
    setLoading(true)
    setError('')
    try {
      /* ช่วงวันที่กำหนดเองชนะค่าสำเร็จรูปเสมอ — และ `url` ที่ใช้เป็นคีย์แคชรวม from/to อยู่แล้ว */
      const fromDay = (opt?.from ?? advFrom) || thaiDay(d - 1)
      const toDay = (opt?.to ?? advTo) || thaiDay(0)
      const qs = new URLSearchParams({
        list: 'orders', from: fromDay, to: toDay,
        limit: String(opt?.size ?? perPage), offset: String(off),
      })
      if (ch) qs.set('channel', ch)
      if (st) qs.set('status', st)
      if (sr) qs.set('store', sr)
      const qq = opt?.q ?? q
      if (qq.trim()) qs.set('q', qq.trim())
      /* 🔍 ตัวกรองขั้นสูง — ส่งเฉพาะช่องที่กรอก · ว่าง = ไม่ส่ง (ท่อถือว่าไม่กรอง) */
      for (const [k, v] of advParams()) qs.set(k, v)
      if (opt?.customer !== undefined) { if (opt.customer.trim()) qs.set('customer', opt.customer.trim()); else qs.delete('customer') }
      // ⚠️ **ส่ง cancelled=1 เสมอ** — ค่าเริ่มต้นของ API ตัดใบยกเลิกทิ้ง
      //    ถ้าไม่ส่ง byStatus จะไม่มี "Voided" เลย ⇒ ไม่มีแท็บยกเลิกให้กด
      //    และถ้าเผลอมีแท็บ กดแล้วจะได้ 0 ใบทั้งที่มี 44 ใบ (ฝั่งท่อหลังบ้านเตือนไว้)
      //    ZORT เองก็โชว์ใบยกเลิกในแท็บ "ทั้งหมด" เหมือนกัน — เราจึงตรงกับต้นแบบด้วย
      qs.set('cancelled', '1')
      /* ⚡ เห็นของเดิมทันทีตอนกดเมนูกลับมา แล้วอัปเดตเบื้องหลัง (ดูเหตุผลเต็มที่ lib/api-cache.ts)
         ⚠️ คีย์คือ url เต็ม ซึ่งรวม from/to/channel/status/store/q/limit/offset ครบแล้ว
            **ห้ามตัดตัวไหนออก** ไม่งั้นสลับร้าน/สลับสถานะแล้วเห็นตัวเลขของตัวกรองก่อนหน้า */
      const url = `/api/web/core?${qs}`
      setStaleFailed(false)
      const cached = peekApiCache<ListResp>(url)
      if (cached) {
        setData(cached.data)
        setOffset(off)
        setPicked([])
        setStaleAge(cached.ageMs)
        setLoading(false)
      }

      const res = await fetch(url)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      /* 🔴 **ตอบ 200 แต่คนละรูป ต้องเป็น error ไม่ใช่ "ไม่มีรายการ"** (17 ก.ย. 2569)
         ยิงจริง `list=orders&customer=…` ⇒ ท่อส่งก้อน "ลูกค้ารายคน" กลับมา (ไม่มี total · ไม่มี rows)
         ⇒ จอเดิมขึ้นตารางว่างเงียบ ๆ · กันไว้ทุกพารามิเตอร์ ไม่ใช่เฉพาะ customer */
      if (!j?.skip && (!Array.isArray(j?.rows) || typeof j?.total !== 'number'))
        throw new Error('ท่อตอบกลับมาคนละรูป (ไม่มีรายการใบ/ยอดรวม) — ไม่ใช่ "ไม่มีใบ" · อาจมีตัวกรองที่ชนกับเส้นอื่นของท่อ')
      putApiCache(url, j)
      setData(j)
      setOffset(off)
      setPicked([])
      setStaleAge(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      // ⚠️ **ห้ามล้าง staleAge ตรงนี้** ของเก่ายังอยู่บนจอ ⇒ แถบต้องอยู่ต่อ แค่เปลี่ยนข้อความ
      setStaleFailed(true)
    } finally {
      setLoading(false)
    }
  }, [days, channel, status, q, store, advFrom, advTo, advParams, perPage])

  /* 💾 เปิดจอมา: ถ้ามีของที่จำไว้ ให้ใส่กลับ **แล้วประกาศ** · ไม่มีก็โหลดตามปกติ
     ⚠️ อ่าน localStorage ใน effect เท่านั้น (อ่านตอนวาดครั้งแรก = จอฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์ไม่ตรงกัน) */
  useEffect(() => {
    const memo = loadFilter(MEMO_KEY)
    /* 🔴 **ลิงก์เจาะจงใบต้องชนะตัวกรองที่จำไว้** (แก้ 17 ก.ย. 2569)
       ถ้าคนเคยติ๊กจำตัวกรอง (ร้าน · สถานะ · ช่วงวัน) แล้วกดลิงก์ `?q=<เลขที่ใบ>` มา
       ตัวกรองที่จำไว้จะมาทับ ⇒ ใบที่ลิงก์ชี้อาจโดนกรองหายไปเงียบ ๆ
       ⇒ มีคำค้นจาก URL = ไม่เอาตัวกรองที่จำไว้มาใช้รอบนี้ (ค่าที่จำไว้ยังอยู่ ไม่ได้ลบ) */
    /* ลิงก์จากจอลูกค้ารายคน (`?customer=`) ก็เป็นลิงก์เจาะจง — ตัวกรองที่จำไว้ห้ามมาทับเหมือนกัน */
    const sp0 = new URLSearchParams(window.location.search)
    const deepLink = sp0.has('q') || sp0.has('customer')
    if (!memo || deepLink) {
      if (deepLink) {
        /* 🔴 **อ่าน URL ซ้ำตรงนี้ ห้ามเชื่อค่าตั้งต้นของ useState** (แก้ 17 ก.ย. 2569 23:3x · เจอจากการกดจริง)
           กดลิงก์ `<Link>` จากจออื่น (นำทางฝั่งเบราว์เซอร์) ⇒ ตอนจอนี้วาดครั้งแรก window.location ยังเป็น URL ของจอเดิม
           ⇒ q/from/to/customer ตั้งต้นเป็นค่าว่าง ⇒ ลิงก์เลขที่ใบจากจอลูกค้าเปิดมาได้รายการ 90 วันทั้งกอง ไม่มีคำค้น
           ทดสอบรุ่นแรกด้วยการเปิด URL ตรง ๆ จึงผ่าน — ต้องทดสอบด้วยการกดลิงก์ · ตอน effect วิ่ง URL ถูกแล้ว */
        const urlQ = sp0.get('q') ?? ''
        const urlFrom = sp0.get('from') ?? ''
        const urlTo = sp0.get('to') ?? ''
        const urlCustomer = sp0.get('customer') ?? ''
        setQ(urlQ); setAdvFrom(urlFrom); setAdvTo(urlTo); setFCustomer(urlCustomer)
        if (urlFrom || urlTo || urlCustomer) setAdvOpen(true)
        load(0, { q: urlQ, from: urlFrom, to: urlTo, customer: urlCustomer }); return
      }
      load(0); return
    }
    setRemember(true)
    setRestored(describeFilter(memo, { days: DEFAULT_DAYS }, {
      /* ใช้คำจากเจ้าของคำ ไม่เขียนใหม่ที่นี่ */
      store: (v) => storeLabel(v === 'z2' ? 'z2' : 'z1'),
      status: (v) => statusTh(v),
    }))
    if (typeof memo.days === 'number') setDays(memo.days)
    if (memo.store !== undefined) setStore(memo.store)
    if (memo.channel !== undefined) setChannel(memo.channel)
    if (memo.status !== undefined) setStatus(memo.status)
    if (memo.from !== undefined) setAdvFrom(memo.from)
    if (memo.to !== undefined) setAdvTo(memo.to)
    if (memo.from || memo.to) setAdvOpen(true)
    load(0, {
      days: memo.days, store: memo.store, channel: memo.channel,
      status: memo.status, from: memo.from, to: memo.to,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* จำทุกครั้งที่ตัวกรองเปลี่ยน — เฉพาะตอนติ๊กไว้เท่านั้น */
  useEffect(() => {
    if (!remember) return
    saveFilter(MEMO_KEY, { days, store, channel, status, from: advFrom, to: advTo })
  }, [remember, days, store, channel, status, advFrom, advTo])

  // ZORT กดแถวแล้วไป "หน้ารายละเอียดรายการขาย" เต็มหน้า ไม่ใช่กางในตาราง
  // ส่งลำดับใบ (i) กับตัวกรองเดิมไปด้วย เพื่อให้หน้านั้นมีลูกศรเลื่อนใบก่อน/ถัดไปได้
  /** ที่อยู่ของหน้ารายละเอียดใบนั้น — **ตัวเดียวใช้ทั้งกดแถวและลิงก์**
   *  ⚠️ ห้ามมีสองที่สร้าง URL นี้ ไม่งั้นวันหนึ่งกดแถวกับกดเลขที่ใบจะพาไปคนละที่ */
  function detailHref(id: string, i: number) {
    const qs = new URLSearchParams({
      id, i: String(offset + i),
      from: thaiDay(days - 1), to: thaiDay(0),
    })
    if (channel) qs.set('channel', channel)
    if (status) qs.set('status', status)
    if (q.trim()) qs.set('q', q.trim())
    // ⚠️ ต้องส่งร้านไปด้วย ไม่งั้นลูกศรเลื่อนใบก่อน/ถัดไปจะข้ามไปคนละชุดที่รวมสองร้าน
    if (store) qs.set('store', store)
    // ต้องตรงกับตัวกรองที่ใช้ดึงรายการเป๊ะ ไม่งั้นลูกศรเลื่อนใบข้ามไปคนละชุด
    qs.set('cancelled', '1')
    return `/core/sales/detail?${qs}`
  }
  function openDetail(id: string, i: number) {
    router.push(detailHref(id, i))
  }

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  // แท็บสถานะพร้อมจำนวนในวงเล็บ — ลอกจาก ZORT (ทั้งหมด · รอโอน (21) · รอชำระ (12) · สำเร็จ)
  // byStatus จากเซิร์ฟเวอร์ไม่ถูกกรองด้วยสถานะที่เลือกอยู่ แท็บอื่นจึงยังบอกจำนวนได้เสมอ
  const allCount = (data?.byStatus ?? []).reduce((s2, r) => s2 + Number(r.orders || 0), 0)
  // ยอดในบรรทัดสรุปรวมใบยกเลิกไว้ด้วย (เพราะเราส่ง cancelled=1 เสมอ)
  // ⚠️ ต้องบอกให้เห็นว่ารวมไว้เท่าไหร่ ไม่งั้นยอดขายดูพองโดยไม่มีใครรู้ว่าทำไม
  const voidedRows = (data?.byStatus ?? []).filter((r) => toneOfStatus(r.status) === 'red')
  const voided = voidedRows.length
    ? {
      orders: voidedRows.reduce((n, r) => n + Number(r.orders || 0), 0),
      amount: voidedRows.reduce((n, r) => n + Number(r.amount || 0), 0),
    }
    : null
  const tabs = [
    { id: '', label: 'ทั้งหมด', count: allCount || data?.total },
    ...(data?.byStatus ?? []).map((r) => ({
      id: r.status, label: statusTh(r.status), count: r.orders,
    })),
  ]

  return (
    <div className="p-4 md:p-6">
      {/* ⚠️ ชิ้นแรกสุด เหนือหัวจอ — คำเตือนที่ต้องเลื่อนถึงเห็น คือคำเตือนที่วางผิดที่ */}
      <StaleBar ageMs={staleAge} ageText={ageText} failed={staleFailed} />
      <PageHead
        title="รายการขาย"
        summary={
          <>
            {/* 🔴 หัวจอต้องบอกว่าเลขเงินคือ "เงินที่ได้" หรือ "ยอดรวมทุกใบ"
                ท่อรุ่นใหม่ส่งแยกให้แล้ว ⇒ โชว์ยอดที่จ่ายแล้วเป็นตัวหลัก
                และบอกส่วนที่ยังไม่จ่ายต่อท้าย **ไม่ใช่ซ่อน** (มันคืองานตามเก็บเงิน) */}
            {/* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" — กล่องแดงข้างล่างบอกว่าพัง
                แต่หัวจอยังบอกว่ากำลังโหลด ⇒ คนรอต่อไปเรื่อย ๆ โดยไม่รู้ว่าจบแล้ว
                (คลาสเดียวกับ "จำนวน 0 รายการ" ที่เจอในจอใบคืนของเมื่อเช้า) */}
            {error ? 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง'
              : !data ? 'กำลังโหลด…'
              : typeof data.totalPaidAmount === 'number'
                ? (
                  <>
                    {summaryLine(data.total, data.totalPaidAmount).replace('มูลค่าทั้งหมด', 'จ่ายแล้ว')}
                    {typeof data.totalUnpaidAmount === 'number' && data.totalUnpaidAmount > 0 && (
                      <span className="text-amber-700">
                        {' '}· ยังไม่จ่ายอีก {data.totalUnpaidAmount.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท
                      </span>
                    )}
                  </>
                )
                : summaryLine(data.total, data.totalAmount)}
            {/* ⚠️ ซ่อนวงเล็บตอนอยู่แท็บ "ยกเลิก" — แท็บนั้นเป็นใบยกเลิกทั้งหมดอยู่แล้ว
                วงเล็บจะซ้ำกับตัวเลขหลักเป๊ะ ๆ แล้วคนอ่านสะดุดว่าทำไมบอกสองรอบ */}
            {voided && toneOfStatus(status) !== 'red' && (
              <span className="text-gray-400">
                {' '}(รวมใบยกเลิก {voided.orders.toLocaleString('th-TH')} ใบ {fmtMoney(voided.amount)})
              </span>
            )}
            {' | '}
            {/* ZORT มีลิงก์ "แพ็คสินค้า" ตรงนี้ (ภาพ 01-รายการขาย.jpg) */}
            {/* ✅ ชี้ไปจอจริงแล้ว 6 ก.ย. 2569 — เดิมชี้ไปหน้า "ยังไม่ได้ทำ" ทั้งที่จอมีแล้ว
                ⚠️ เจอตอนเปิดจอด้วยเบราว์เซอร์ ไม่ใช่จากการอ่านโค้ด
                   ลิงก์ที่ชี้ไปหน้า "ยังไม่ได้ทำ" ทั้งที่ของมีแล้ว = คนเชื่อว่าเรายังทำไม่เสร็จ */}
            <Link href="/core/packing" className="text-blue-600 hover:underline">แพ็คสินค้า</Link>
            {' | '}
            <span className="text-gray-400">อ่านจากคลังของเราเอง ไม่ได้ยิง ZORT</span>
          </>
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 ส่งออกตามตัวกรองที่เลือกอยู่ ครบทุกหน้า (ใบ t_mu1i74cu)
                🔴 **ต้องส่ง cancelled=1 เหมือนที่จอส่ง** ไม่งั้นไฟล์จะไม่มีใบยกเลิก
                   แล้วยอดรวมในไฟล์กับยอดบนจอจะต่างกัน โดยคนอ่านไฟล์ไม่มีทางรู้ว่าทำไม
                   (CLAUDE.md กฎแท็บข้อ 4 — ตัวเลขคนละกติกาห้ามวางคู่กันเฉย ๆ)
                ⚠️ ไฟล์มีคอลัมน์ "ยกเลิกหรือไม่" เพื่อให้คนกรองออกเองได้ในภายหลัง */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: 'รายการขาย',
                scope: `${advFrom || thaiDay(days - 1)} ถึง ${advTo || thaiDay(0)}`,
                title: 'รายการขาย',
                note: 'ไฟล์นี้รวมใบยกเลิกไว้ด้วย (เหมือนที่จอแสดง) — ดูคอลัมน์ "สถานะ" เพื่อคัดออกเอง',
                filters: [
                  /* 🔴 ต้องเป็นช่วงเดียวกับที่จอกำลังกรองอยู่ — รวมช่วงที่ตั้งเองในค้นหาขั้นสูง
                     ไม่งั้นไฟล์กับจอคนละช่วง แล้วคนเทียบยอดไม่ตรงโดยไม่รู้ว่าทำไม */
                  ['ช่วงวันที่', `${advFrom || thaiDay(days - 1)} ถึง ${advTo || thaiDay(0)}`
                    + (advFrom || advTo ? ' (ตั้งเองในค้นหาขั้นสูง)' : ` (${days} วัน)`)],
                  ['ร้าน', store || '(ทุกร้าน)'],
                  ['ช่องทาง', channel || '(ทุกช่องทาง)'],
                  ['สถานะ', status || '(ทุกสถานะ)'],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                  /* 🔴 หัวไฟล์ต้องบอกด้วยว่ากรองขั้นสูงอะไรไว้ ไม่งั้นคนเปิดไฟล์ทีหลังไม่รู้ว่าทำไมแถวน้อย */
                  ...(advParams().length
                    ? [['ค้นหาขั้นสูง', advParams().map(([k, v]) => `${k}=${v}`).join(' · ')] as [string, string]]
                    : [['ค้นหาขั้นสูง', '(ไม่ได้ใช้)'] as [string, string]]),
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({
                    list: 'orders', from: advFrom || thaiDay(days - 1), to: advTo || thaiDay(0),
                    limit: String(limit), offset: String(offsetAt), cancelled: '1',
                  })
                  if (channel) qs.set('channel', channel)
                  if (status) qs.set('status', status)
                  if (store) qs.set('store', store)
                  if (q.trim()) qs.set('q', q.trim())
                  /* 🔴 **ตัวกรองขั้นสูงต้องไปกับไฟล์ด้วย** — ลืมส่งแล้วไฟล์จะเป็นของทั้งช่วง
                     ทั้งที่ตารางบนจอกรองอยู่ ⇒ ผิดแบบไม่มีอะไรฟ้อง (ฝั่งท่อกำชับข้อนี้) */
                  for (const [k, v] of advParams()) qs.set(k, v)
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['เลขที่', 'วันที่', 'ลูกค้า', 'ช่องทาง', 'ที่มา', 'ยอด (บาท)', 'สถานะ', 'การชำระเงิน', 'ขนส่ง', 'เลขพัสดุ', 'วันที่ส่ง', 'เก็บปลายทาง'],
                toRow: (r: Row) => [
                  r.number, r.order_date ?? null, r.customer ?? null, r.channel ?? null, r.source ?? null,
                  typeof r.amount === 'number' ? r.amount : null,
                  r.status ?? null, r.pay_status ?? null,
                  /* 🔴 **ห้ามใส่ `ship_name` ลงคอลัมน์ "ขนส่ง"** — ช่องนั้นคือชื่อผู้รับ (พิสูจน์ 16 ก.ย. 2569)
                     ไฟล์ที่ส่งออกไปจะมีชื่อลูกค้าอยู่ในคอลัมน์ขนส่ง ⇒ ทั้งผิดความหมายและเป็นข้อมูลส่วนตัวผิดที่ */
                  r.ship_channel ?? null, r.tracking_no ?? null, r.ship_date ?? null,
                  /* 🔴 is_cod เป็น 0/1 หรือ boolean · **ไม่ส่งมา = ไม่รู้ ⇒ เว้นว่าง ห้ามเขียน "ไม่ใช่"** */
                  r.is_cod === undefined || r.is_cod === null ? null : (r.is_cod ? 'ใช่' : 'ไม่ใช่'),
                ],
              }}
            />
            {/* ⚠️ สามปุ่มนี้ลอกจาก ZORT — "สร้างอย่างง่าย" ของเขาคือเปิดบิลเร็ว
                ซึ่งตรงกับจอขายหน้าร้านของเราพอดี จึงพาไปที่นั่นจริง ๆ
                ส่วนอีกสองปุ่มพาไปหน้าที่บอกว่ายังไม่ได้ทำ — เหมือนในผัง แต่กดแล้วไม่โกหก */}
            <ImportButton kind="sale" />
            {/* ชี้หน้าจริงตั้งแต่ 14 ก.ย. 2569 — ปุ่มส่งจริงในหน้านั้นยังปิดอยู่ แต่ซ้อมได้เต็มที่
                ซึ่งต่างจาก "ยังไม่ได้ทำ" คนละเรื่อง */}
            <Link href="/core/sales/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้าง
            </Link>
            <Link href="/core/pos"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้างอย่างง่าย
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขรายการขาย ชื่อลูกค้า ช่องทางการขาย และอื่นๆ"
        /* 🔴 เดิมลิงก์ตรงนี้เขียนว่า "ค้นหา" และกดแล้วแค่โหลดซ้ำ — ผัง ZORT ตรงนี้คือ "ค้นหาขั้นสูง"
           ⇒ ตอนนี้กดแล้วกางแผงช่วงวันที่จริง (ท่อรับ from/to) ไม่ใช่ลิงก์ประดับ */
        advanced={<AdvancedSearchLink open={advOpen} onToggle={() => setAdvOpen((v) => !v)} />}
        right={
          <>
            {/* ⚠️ ชื่อร้านมาจากบัญชี ZORT สองบัญชีของร้าน — z1 คือบริษัทที่ขายบนเว็บ
                z2 คือบัญชีที่สอง ซึ่งตอนนี้เป็นเครื่องคิดเงินหน้าร้านล้วน
                (เลิกขายออนไลน์ 22 ก.พ. 2569 — ฝั่งท่อไล่วันจริงยืนยันแล้ว) */}
            <select
              value={store}
              onChange={(e) => { setStore(e.target.value); load(0, { store: e.target.value }) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              <option value="">ทุกร้าน (2 ร้าน)</option>
              {/* 🔴 ห้ามพิมพ์ชื่อนิติบุคคลในไฟล์จอ — ถูกอบเข้า chunk สาธารณะ /_next/static
                  (เจ้าของร้านจับได้ 8 ก.ย. 2569 ที่หน้า /login · ไล่ทั้งคลาสแล้วเจอที่นี่ด้วย)
                  ใช้ชื่อหน้าที่ของร้านแทน — คนใช้แยกออกอยู่แล้วว่า z1=ออนไลน์ z2=หน้าร้าน */}
              <option value="z1">ร้านออนไลน์ (z1)</option>
              <option value="z2">หน้าร้าน (z2)</option>
            </select>
            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value); load(0, { channel: e.target.value }) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              <option value="">ทุกช่องทาง</option>
              {/* ⚠️ กรองให้เหลือเฉพาะ "ข้อความ" ก่อนวาด — ถ้าท่อเปลี่ยนช่องนี้เป็นก้อน object
                  React จะโยน "Objects are not valid as a React child" แล้ว **ทิ้งทั้งหน้าเป็นจอขาว**
                  (เจอจริงตอนป้อนข้อมูลปลอมที่ชนิดไม่ตรง 6 ก.ย. 2569 — ชนิดผิดช่องเดียว ล้มทั้งจอ)
                  ⇒ ชนิดไม่ตรงก็แค่ตัวเลือกนั้นหาย ดีกว่าทั้งจอหาย */}
              {(data?.channels ?? []).filter((c) => typeof c === 'string')
                .map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-[13px] text-gray-500">แสดง</span>
            <select
              value={days}
              onChange={(e) => { const d = Number(e.target.value); setDays(d); load(0, { days: d }) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </>
        }
      />

      {/* 🔍 แผงค้นหาขั้นสูง — ใช้ตัวประกอบร่วม
          ⚠️ ท่อ list=orders รับ from/to จริง ⇒ ช่วงวันที่กำหนดเองกรองที่เซิร์ฟเวอร์ */}
      <AdvancedSearch
        open={advOpen}
        /* 🔍 ช่องทั้งหมดนี้ **ท่อกรองที่เซิร์ฟเวอร์จริง** — ยิงยืนยันเองแล้วทุกช่องก่อนใส่
           (กฎข้อ ① ของแผงนี้: ห้ามใส่ช่องที่กรอกแล้วไม่มีผล) */
        fields={[
          { label: 'ตั้งแต่วันที่', kind: 'date', value: advFrom, onChange: (v) => setAdvFrom(String(v)) },
          { label: 'ถึงวันที่', kind: 'date', value: advTo, onChange: (v) => setAdvTo(String(v)) },
          {
            label: 'สถานะชำระเงิน',
            kind: 'select',
            value: fPay,
            onChange: (v) => setFPay(String(v)),
            width: 150,
            /* 🔑 ค่าที่ส่งเป็นค่าดิบของกระจก (Paid/Pending/Voided) แต่ **คำบนจอมาจาก lib/zort-words**
               ⇒ คนใช้เห็นคำเดียวกับ ZORT · ห้ามพิมพ์คำไทยตายตัวที่นี่ */
            options: [
              { value: '', label: 'ทั้งหมด' },
              { value: 'Paid', label: zortWord(PAY_STATUS, 'Paid').text },
              { value: 'Pending', label: zortWord(PAY_STATUS, 'Pending').text },
              { value: 'Voided', label: zortWord(PAY_STATUS, 'Voided').text },
            ],
          },
          {
            label: 'เก็บเงินปลายทาง',
            kind: 'select',
            value: fCod,
            onChange: (v) => setFCod(String(v)),
            width: 130,
            options: [
              { value: '', label: 'ทั้งหมด' },
              { value: '1', label: 'เฉพาะ COD' },
              { value: '0', label: 'ไม่ใช่ COD' },
            ],
          },
          { label: 'สินค้า (รหัส/ชื่อ)', kind: 'text', value: fProduct, onChange: (v) => setFProduct(String(v)), placeholder: 'เช่น 00313', width: 170 },
          { label: 'ช่องทางจัดส่ง', kind: 'text', value: fShipCh, onChange: (v) => setFShipCh(String(v)), placeholder: 'เช่น Flash', width: 150 },
          { label: 'วันส่งสินค้า ตั้งแต่', kind: 'date', value: fShipFrom, onChange: (v) => setFShipFrom(String(v)) },
          { label: 'ถึง', kind: 'date', value: fShipTo, onChange: (v) => setFShipTo(String(v)) },
          { label: 'มูลค่าตั้งแต่', kind: 'number', value: fMin, onChange: (v) => setFMin(String(v)), placeholder: '0', width: 110 },
          { label: 'จนถึงมูลค่า', kind: 'number', value: fMax, onChange: (v) => setFMax(String(v)), placeholder: '999999', width: 110 },
          { label: 'หมายเลขรายการ', kind: 'text', value: fNumber, onChange: (v) => setFNumber(String(v)), placeholder: 'เช่น SO-2026', width: 150 },
          { label: 'ชื่อลูกค้า', kind: 'text', value: fCustomer, onChange: (v) => setFCustomer(String(v)), placeholder: 'มีคำนี้ในชื่อ', width: 150 },
          { label: 'Tag', kind: 'text', value: fTag, onChange: (v) => setFTag(String(v)), placeholder: 'มีคำนี้ใน Tag', width: 130 },
          { label: 'ผู้สร้าง', kind: 'text', value: fCreator, onChange: (v) => setFCreator(String(v)), placeholder: 'ชื่อผู้สร้างใบ', width: 130 },
          {
            label: 'คลัง',
            kind: 'select',
            value: fWh,
            onChange: (v) => setFWh(String(v)),
            width: 170,
            options: [
              { value: '', label: 'ทั้งหมด' },
              { value: 'NEW', label: 'NEW' },
              { value: 'KLD', label: 'KLD' },
              { value: 'ANJ', label: 'ANJ' },
            ],
          },
        ]}
        notAvailable={[
          {
            what: 'ใบที่ยังไม่รู้คลัง',
            why: 'ใบก่อน 1 ก.ย. 2569 ส่วนหนึ่งท่อยังไม่ได้เก็บรหัสคลัง ⇒ เลือกคลังไหนก็ไม่ขึ้น (วัด 17 ก.ย. 2569: ช่วง 1 ส.ค.–16 ก.ย. มี 40 ใบ) · ยังเลือก "ไม่รู้คลัง" ไม่ได้',
          },
          {
            what: 'Serial no · ชื่อตัวแทน',
            why: 'ZORT มีช่องให้ แต่ร้านไม่ได้ใช้เลย (ยิง ZORT จริง z1 30 วัน: serial ว่างทั้ง 940 บรรทัด · ตัวแทน 0 ใบ) ⇒ ทำช่องไปก็ไม่มีวันเจอของ',
          },
          {
            what: 'สถานะรายการ 10 ค่าแบบ ZORT',
            why: 'กระจกมีสถานะจริงแค่ 5 ค่า และยังไม่มีใครพิสูจน์การจับคู่กับ 10 ค่าของ ZORT ⇒ ทำเป็น 10 ตัวเลือกจะได้ตัวเลือกที่กดแล้วไม่มีวันเจอของ',
          },
        ]}
        onApply={() => load(0)}
        onClear={() => {
          setAdvFrom(''); setAdvTo('')
          setFPay(''); setFCod(''); setFProduct(''); setFShipCh('')
          setFShipFrom(''); setFShipTo(''); setFMin(''); setFMax(''); setFNumber('')
          setFTag(''); setFCreator(''); setFWh(''); setFCustomer('')
          /* ⚠️ ล้างแล้วต้องยิงใหม่ทันที ไม่งั้นตารางยังเป็นผลของเงื่อนไขเดิมทั้งที่ช่องว่างหมดแล้ว
             (setState ยังไม่ทันมีผลในรอบนี้ ⇒ ส่ง from/to ว่างตรง ๆ และ advParams รอบถัดไปจะว่างเอง) */
          setTimeout(() => load(0, { from: '', to: '' }), 0)
        }}
        canClear={!!advFrom || !!advTo || advParams().length > 0}
        applyLabel="ค้นหาตามช่วงนี้"
        serverFiltered="ช่วงวันที่ · ร้าน · ช่องทาง · สถานะ · คำค้นหา · สถานะชำระเงิน · COD · สินค้า · ช่องทางจัดส่ง · วันส่งสินค้า · ช่วงมูลค่า · หมายเลขรายการ · ชื่อลูกค้า · Tag · ผู้สร้าง · คลัง"
        extraNote={<>
          ใส่ช่องเดียวก็ได้ — อีกข้างจะใช้ค่าจากตัวเลือก &ldquo;แสดง N วัน&rdquo;
          {/* 💾 ติ๊กจำตัวกรอง — ลอกจาก ZORT (remember_filter) · ไฟเขียวจาก CEO 15 ก.ย. 2569 */}
          <br />
          <label className="inline-flex items-center gap-1.5 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                const on = e.target.checked
                setRemember(on)
                if (on) saveFilter(MEMO_KEY, { days, store, channel, status, from: advFrom, to: advTo })
                else { clearFilter(MEMO_KEY); setRestored([]) }
              }}
            />
            <span>จำตัวกรองไว้ในเครื่องนี้</span>
          </label>
          {' '}<span className="text-gray-400">
            — จำเฉพาะ<b>ตัวเลือก</b> (ช่วงวัน · ร้าน · ช่องทาง · สถานะ)
            {' '}<b>ไม่จำคำค้นหา</b> เพราะคำที่ค้างจากคราวก่อนจะทำให้เห็นรายการน้อยกว่าจริง
            {' '}· เก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้ส่งขึ้นเซิร์ฟเวอร์
          </span>
        </>}
      />

      {/* 🔴 **ใช้ของที่จำไว้ต้องประกาศ** — ไม่งั้นคนเปิดจอมาเห็นรายการน้อยกว่าจริงแล้วไม่รู้ว่าทำไม */}
      {restored.length > 0 && (
        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2 mb-3 leading-relaxed">
          💾 <b>กำลังใช้ตัวกรองที่จำไว้จากครั้งก่อน</b> — {restored.join(' · ')}
          {' · '}
          <button
            type="button"
            onClick={() => {
              clearFilter(MEMO_KEY); setRemember(false); setRestored([])
              setDays(DEFAULT_DAYS); setStore(''); setChannel(''); setStatus('')
              setAdvFrom(''); setAdvTo('')
              load(0, { days: DEFAULT_DAYS, store: '', channel: '', status: '', from: '', to: '' })
            }}
            className="ml-2 underline text-amber-900 hover:text-amber-700"
          >
            ล้างตัวกรองที่จำไว้
          </button>
        </div>
      )}

      {data && (
        <div className="text-[12.5px] text-gray-500 mb-3">
          {/* ZORT เขียนวันแบบ 1/6/2569–2/9/2569 ไม่ใช่ ISO — ตรงนี้คือบรรทัดเดียวกันของเขา */}
          🔍 ค้นหา: วันที่ {thaiShort(data.from)} – {thaiShort(data.to)}
          {/* 🔴 **เขียนจากสิ่งที่ท่อบอกว่าใช้จริง ไม่ใช่จากสิ่งที่จอส่งไป**
                 ถ้าวันหนึ่งท่อเลิกรองรับช่องไหน จอจะเงียบทันทีแทนที่จะโกหกว่ากรองให้แล้ว */}
          {data.advancedFilters && Object.entries(data.advancedFilters).some(([, v]) => v) && (
            <span className="text-violet-700">
              {' · '}🔍 ขั้นสูงที่ใช้จริง:{' '}
              {Object.entries(data.advancedFilters)
                .filter(([, v]) => v)
                .map(([k, v]) => `${ADV_TH[k] ?? k} ${v}`)
                .join(' · ')}
            </span>
          )}
          {/* ส่งไปแล้วแต่ท่อไม่ได้ใช้ = ต้องฟ้อง ไม่ใช่ปล่อยให้คนเชื่อว่ากรองแล้ว */}
          {data.advancedFilters && advParams().some(([k]) => !data.advancedFilters?.[ADV_KEY[k] ?? k]) && (
            <span className="block text-amber-800 mt-0.5">
              ⚠️ มีเงื่อนไขขั้นสูงที่ส่งไปแล้ว <b>ท่อไม่ได้ใช้กรอง</b> — ตัวเลขที่เห็นจึงกว้างกว่าที่ตั้งไว้
            </span>
          )}
          {/* ⚠️ เลขทุกตัวบนจอนี้ต้องบอกว่ามาจากกี่ร้าน — ชื่อช่องทางซ้ำกันข้ามร้านได้ */}
          {' '}· ร้าน {store === 'z1' ? 'ร้านออนไลน์ (z1)' : store === 'z2' ? 'หน้าร้าน (z2)' : <b>รวมทั้ง 2 ร้าน</b>}
          {/* 🔴 ประโยคข้างบนพูดจาก **ตัวแปรของจอ** ไม่ใช่จากคำตอบของท่อ
              ⇒ วันที่ท่อเมิน `store` ประโยคนี้จะยังเขียนว่า "หน้าร้าน" อย่างมั่นใจ
              ยิงยืนยัน 17 ก.ย. 2569: เส้นนี้ echo `store` กลับมา และ **ไม่ส่ง/ส่ง all ⇒ `null` = ทุกร้าน**
              (ต่างจากเส้นเอกสารอื่นที่ค่าว่างแปลว่า z1) ⇒ ต้องบอก `ว่างคือ` ให้ถูก ไม่งั้นเตือนหลอก */}
          <StoreEcho ขอ={store as StoreId} ได้={data.store} ว่างคือ="ทุกร้าน" />
          {channel && ` · ช่องทาง ${channel}`}
          {/* 🔴 **เลขบนแท็บนับเฉพาะช่วงนี้ ไม่ใช่ทั้งคลัง — ต้องเขียนบอก**
              ของจริง 4 ก.ย. 2569: แท็บ "รอดำเนินการ" ขึ้น 17 (ในกรอบ 3 เดือน)
              ส่วนแถบเตือนข้างล่างพูดถึง 187 (ทั้งกระจก) ⇒ **สองเลขอยู่บนจอเดียวกัน
              คนละขอบเขต และไม่มีอะไรบอก** คนอ่านจะนึกว่าตัวเลขขัดกันเอง
              (กับดักเดียวกับ 1,926 vs 319 ของ Shopee เมื่อบ่าย — เลขคนละคำถามเอามาเทียบกัน) */}
          {' '}· <b>เลขบนแท็บนับเฉพาะช่วงวันที่นี้</b> ไม่ใช่ทั้งคลัง
        </div>
      )}

      {/* 🔴 เลขบนแท็บมาจากกระจก ซึ่งอาจค้างสถานะเก่า — ฝั่งท่อกำลังตรวจ (4 ก.ย. 2569)
          จอไม่รู้จักเนื้อหาปัญหา อ่านข้อความจากท่อล้วน ๆ ⇒ ยืนยันเสร็จเมื่อไหร่ จอหยุดเตือนเอง */}
      {/* วางไว้เหนือแถบเตือน เพราะ "ข้อมูลเก่า" ต้องรู้ก่อนอ่านเลขทุกตัวบนจอ */}
      <DataFreshness freshness={data?.freshness} />

      <DataUnreliableBanner reason={data?.statusUnreliable} what="ตัวเลขบนแท็บสถานะ" />

      {error && <ErrorBox title="ดึงรายการขายไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {/* ⚠️ สถานะที่สาม (ท่อตอบ 200 + ช่อง `skip`) ต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว
          เดิมเป็นกล่องขาว/เทา ⇒ อ่านเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ (แก้ยกชุด 16 ก.ย. 2569) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

      {data && !data.skip && (
        <>
          {/* การ์ดสถานะจัดส่ง — วางเหนือแท็บ เพราะเป็นภาพรวมของชุดที่กรองอยู่
              ⚠️ คนละเรื่องกับแท็บด้านล่าง: แท็บคือ "สถานะใบ" ที่ ZORT ใช้ (สำเร็จ · รอ · ยกเลิก)
                 การ์ดนี้คือ "สถานะจัดส่ง" ที่มาจากแพลตฟอร์ม ⇒ ใบเดียวมีได้ทั้งสองอย่างพร้อมกัน */}
          <ShipStatusCard
            groups={data.shipStatusGroups}
            total={data.total}
            scope={data.shipStatusScope}
          />

          {/* ใบของร้านที่ปิดแล้วยังพองอยู่ในกอง "รอจัดส่ง" — แยกให้เห็น ห้ามกรองทิ้งเงียบ
              (ท่านประธานสั่ง 13 ก.ย. 2569 · งานกระดาน t_mtxss3pf)
              ⚠️ ส่งช่วงวันชุดเดียวกับที่จอกำลังกรองอยู่ ไม่งั้นเลขในกล่องนี้จะพูดคนละช่วง
                 กับการ์ดสถานะจัดส่งที่อยู่ข้างบน แล้วคนอ่านจะเทียบกันเองโดยไม่รู้ว่าคนละขอบเขต */}
          <DormantInShipPile from={thaiDay(days - 1)} to={thaiDay(0)} />

          {/* ⚠️ ตัวตรวจที่ไม่เจออะไรเลย ต้องบอกว่า "ตรวจแล้วไม่เจอ" ไม่ใช่เงียบหาย
              ไม่งั้นไม่มีใครรู้ว่ามีตัวตรวจนี้อยู่ แล้ววันที่มันเงียบเพราะพัง ก็ดูเหมือนเดิมเป๊ะ
              (กติกาเดียวกับถัง "ไม่รู้จัก" ในการ์ด — ต้องเห็นแม้เป็น 0) */}
          {rows.length > 0 && (
            <p className="text-[12px] text-gray-500 mb-3">
              ตรวจใบที่ <b>ปิดแล้วแต่ยังไม่มีเลขพัสดุ</b>:{' '}
              {rows.filter(isMismatch).length === 0
                ? <span>ไม่พบในหน้านี้ ({rows.length.toLocaleString('th-TH')} ใบ)</span>
                : <span className="text-amber-800 font-medium">
                    พบ {rows.filter(isMismatch).length.toLocaleString('th-TH')} ใบในหน้านี้ — ดูป้ายสีส้มในคอลัมน์สถานะ
                  </span>}
              <span className="text-gray-400"> · นับเฉพาะหน้าที่เปิดอยู่ ไม่ใช่ทั้งช่วง</span>
            </p>
          )}

          {/* ผัง ZORT (ภาพ 01): ปุ่มรีเฟรชวงกลมมุมขวาแถบแท็บ — ชั้นแถบแท็บ จุดบอดประจำ (จอที่ 5) */}
          <div className="flex items-end justify-between gap-3">
            <Tabs
              tabs={tabs}
              active={status}
              onChange={(id) => { setStatus(id); load(0, { status: id }) }}
            />
            <button onClick={() => load(0)} disabled={loading} aria-label="โหลดใหม่" title="โหลดใหม่"
              className="mb-2 shrink-0 w-7 h-7 grid place-items-center rounded border border-gray-300
                bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? '⏳' : '⟳'}
            </button>
          </div>

          {/* ☑️ แถบคำสั่งของใบที่เลือก — โผล่เมื่อเลือกแล้วเท่านั้น (เหมือน ZORT)
              🔴 มีเฉพาะคำสั่งที่ **ทำได้จริง** · ที่เหลือเขียนบอกตรง ๆ ว่ายังทำไม่ได้และเพราะอะไร */}
          

          <TableWrap>
            <table className="w-full min-w-[1080px]">
              {/* 🔃 หัวคอลัมน์ที่ **จอ ZORT กดเรียงได้** มี tooltip บอกว่าของเรายังเรียงไม่ได้
                  (ยิงทดสอบ 16 ก.ย. 2569: ท่อเส้นนี้เมิน `sort=` ทุกค่า รวมค่ามั่ว ⇒ ทำปุ่มไว้ = ปุ่มหลอก)
                  ⚠️ ลอกไปใช้จออื่นได้เฉพาะคอลัมน์ที่ **ไปวัดจอ ZORT มาแล้วจริง ๆ** ห้ามเดา */}
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 34 }}>
                    <RowCheck label="เลือกทั้งหน้า"
                      checked={rows.length > 0 && picked.length === rows.length}
                      indeterminate={picked.length > 0 && picked.length < rows.length}
                      onChange={(v) => setPicked(v ? rows.map((r) => r.id) : [])} />
                  </th>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">วันที่</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">รายการ</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">ลูกค้า</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">ช่องทาง</span></th>
                  <th className={TH}>บริการขนส่ง</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">วันส่งสินค้า</span></th>
                  <th className={THR}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">มูลค่า</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">สถานะ</span></th>
                  <th className={TH}>ชำระเงิน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={12} icon="🧾" title="ไม่พบใบขายในเงื่อนไขนี้"
                    detail="ลองเปลี่ยนแท็บ ช่วงเวลา หรือช่องทาง · ออเดอร์ใหม่จากมาร์เก็ตเพลสจะเข้ามาในรอบซิงก์ถัดไป" />
                )}
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id, i)}
                    className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                  >
                    {/* ⚠️ ทั้งแถวกดแล้วเปิดรายละเอียด ⇒ ช่องติ๊กต้อง stopPropagation
                        ไม่งั้นติ๊กทีเดียวได้ทั้งติ๊กและเด้งเข้าใบ (ผู้ใช้จะงงว่าทำไมจอเปลี่ยน) */}
                    <td className={TD} onClick={(e) => e.stopPropagation()}>
                      <RowCheck label={`เลือก ${r.number}`}
                        checked={picked.includes(r.id)}
                        onChange={(v) => setPicked((old) => (v ? [...old, r.id] : old.filter((x) => x !== r.id)))} />
                    </td>
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    {/* ZORT เขียน "วันนี้/เมื่อวานนี้" ไม่ใช่วันที่ดิบ — อ่านเร็วกว่าตอนกวาดตา */}
                    <td className={`${TD} whitespace-nowrap text-gray-500`} title={r.order_date}>
                      {relDay(r.order_date)}
                    </td>
                    <td className={TD}>
                      {/* เลขที่ใบต้องกดได้ — ZORT กดเลขเข้ารายละเอียดตรง ๆ (เดิมเป็น span สีฟ้า
                          ที่กดไม่ได้ = ผิดสัญญาสีฟ้าที่จอหมวดหมู่จดไว้เอง · กวาดคลาส 8 ก.ย. 2569) */}
                      {/* 🔗 **ทำเป็นลิงก์จริง ไม่ใช่ปุ่ม** (18 ก.ย. 2569 · งานยืน "กดเข้าไปลึก ๆ")
                          ของเดิมเป็น `<button>` ⇒ กดได้แต่ **เปิดแท็บใหม่ไม่ได้**
                          ส่วน ZORT เป็นลิงก์ ⇒ คนแพ็กของเปิดหลายใบพร้อมกันได้
                          ⚠️ ต้อง `stopPropagation` ไม่งั้นลิงก์กับ onClick ของแถวจะทำงานซ้อนกัน */}
                      <Link href={detailHref(r.id, i)} onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 font-medium hover:underline">{r.number}</Link>
                      {/* 🔴 **เลขที่ใบซ้ำกันข้ามร้านจริง** (ฝั่งท่อจับได้ 15 ก.ย. 2569)
                          z1 และ z2 เดินเลขคนละชุด ⇒ `SO-202503029` มีทั้งสองร้าน **คนละใบ คนละยอด**
                          (z1 ฿7,757 ค้างชำระ · z2 ฿450 จ่ายแล้ว) · ตัวกรองร้านตั้งต้นคือ "ทุกร้าน"
                          ⇒ ตารางนี้วางใบจากสองร้านปนกันโดยโชว์แต่เลข = คนอ่านเชื่อว่าเป็นชุดเดียวกัน
                             (โรคเดียวกับกฎข้อ 4 ใน CLAUDE.md: ของจากสองแหล่งห้ามวางคู่กันเฉย ๆ)
                          ⇒ ติดป้ายสาขาเมื่อ **ยังไม่ได้เลือกร้าน** เท่านั้น — เลือกแล้วป้ายจะซ้ำกับตัวกรอง
                          ⚠️ สามสถานะ: ไม่ใช่ z1/z2 ⇒ **ไม่ติดป้าย** ห้ามเดาว่าเป็นสาขา 1 */}
                      {!store && (r.source === 'z1' || r.source === 'z2') && (
                        <span className="ml-1.5 align-middle text-[10.5px] text-gray-500
                          border border-gray-200 bg-gray-50 rounded px-1 py-[1px]">
                          {r.source === 'z1' ? 'สาขา 1' : 'สาขา 2'}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} max-w-[190px] truncate`}>{r.customer || '—'}</td>
                    <td className={`${TD} max-w-[170px]`}><ChannelTag name={r.channel} /></td>
                    {/* ⚠️ ไม่มีข้อมูลให้ขีด ห้ามเว้นว่าง — ช่องว่างอ่านได้ว่า "ไม่มีขนส่ง" */}
                    <td className={`${TD} max-w-[150px] truncate`} title={r.tracking_no || ''}>
                      {/* 🔴 ไม่ fallback ไป ship_name (ชื่อผู้รับ) — ดูเหตุผลในไฟล์ส่งออกข้างบน */}
                      {r.ship_channel || <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.ship_date ? thaiDate(r.ship_date) : <span className="text-gray-300">—</span>}
                      {(r.is_cod === 1 || r.is_cod === true) && (
                        <span className="block text-[10.5px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 mt-0.5 w-fit">COD</span>
                      )}
                    </td>
                    <td className={TDR}>{fmtMoney(r.amount)}</td>
                    <td className={TD}>
                      <Pill tone={toneOfStatus(r.status)}>{statusTh(r.status)}</Pill>
                      {/* ⚠️ **สองสถานะนี้คนละเรื่องกัน ห้ามเอามาแทนกัน**
                          ป้ายบน = สถานะใบในระบบเรา/ZORT (สำเร็จ · รอ · ยกเลิก)
                          บรรทัดล่าง = สถานะฝั่งแพลตฟอร์ม (รอจัดส่ง · กำลังส่ง · ส่งถึงแล้ว)
                          ใบเดียวเป็น "สำเร็จ" ในระบบเรา แต่ยัง "กำลังส่ง" ที่ Shopee ได้พร้อมกัน
                          ⇒ วางซ้อนกันโดยไม่บอกที่มา = คนอ่านนึกว่าจอขัดกันเอง
                          คำแปลมาจากท่อล้วน ๆ จอไม่รู้จักรหัสดิบเลย */}
                      {r.shipStatus && r.shipStatus !== '—' && (
                        <span
                          className="block text-[11px] text-gray-500 mt-1"
                          title={[
                            `สถานะฝั่งแพลตฟอร์ม${r.shipStatusFrom ? ` (${r.shipStatusFrom})` : ''}`,
                            r.integrationStatus ? `ค่าดิบ: ${r.integrationStatus}` : '',
                            r.shipStatusUnverified ? 'คำแปลนี้ยังไม่ได้ยืนยันกับเอกสารทางการ' : '',
                          ].filter(Boolean).join('\n')}
                        >
                          🚚 {r.shipStatus}
                          {/* จุดส้ม = คำแปลยังไม่ยืนยัน (รหัสตัวเลขของ TikTok)
                              ต้องมีอะไรบอกสายตา ไม่งั้นคนเชื่อคำแปล TikTok เท่ากับ Shopee */}
                          {r.shipStatusUnverified && <span className="text-amber-600"> •</span>}
                        </span>
                      )}
                      {/* ⚠️ ป้ายอ่อนกว่าเมื่อคำแปลยังไม่ยืนยัน — เตือนแรงบนของที่เราเองยังไม่มั่นใจ
                          จะกลายเป็นเสียงหอนที่คนเลิกฟัง แล้ววันที่มันจริงก็ไม่มีใครดู */}
                      {isMismatch(r) && (
                        <span
                          className="block w-fit text-[10.5px] rounded px-1.5 py-0.5 mt-1 bg-amber-100 text-amber-800 font-medium"
                          title={[
                            `ใบนี้ปิดแล้ว (${statusTh(r.status)}) แต่ยังไม่มีทั้งเลขพัสดุและวันส่งสินค้า`,
                            `สถานะฝั่งแพลตฟอร์ม${r.shipStatusFrom ? ` (${r.shipStatusFrom})` : ''}: ${r.shipStatus ?? '—'}`,
                            (() => {
                              const d = ageDays(r.order_date)
                              return d === null ? '' : `ใบนี้อายุ ${d.toLocaleString('th-TH')} วันแล้ว`
                            })(),
                            'เกณฑ์นี้ดูจากเลขพัสดุ/วันส่งเท่านั้น ไม่ได้ดูสถานะของแพลตฟอร์ม',
                          ].filter(Boolean).join('\n')}
                        >
                          ⚠ ปิดใบแล้วแต่ยังไม่มีเลขพัสดุ
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {r.pay_status
                        ? <PaymentPill value={r.pay_status} />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        items={[
                          { label: 'เปิดรายละเอียด', onClick: () => openDetail(r.id, i) },
                          {
                            /* คัดลอกพร้อมร้าน — เลขที่ใบเปล่า ๆ ออกจากจอนี้ไปแล้ว **ไม่มีใครรู้ว่าร้านไหน**
                               (z1/z2 เดินเลขซ้ำกันได้) · รูป `z1/SO-…` เป็นรูปเดียวกับที่ไฟล์ทีมใช้
                               ⚠️ ไม่รู้ร้าน ⇒ คัดลอกเลขเปล่า ไม่เติมคำเดา */
                            label: 'คัดลอกเลขที่ใบ',
                            onClick: () => {
                              const withStore = r.source === 'z1' || r.source === 'z2'
                                ? `${r.source}/${r.number}` : r.number
                              navigator.clipboard?.writeText(withStore).catch(() => {})
                            },
                          },
                          {
                            label: `ดูเฉพาะ ${r.channel || 'ช่องทางนี้'}`,
                            onClick: () => { setChannel(r.channel); load(0, { channel: r.channel }) },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.total > PAGE && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
                <span className="text-[12px] text-gray-500">
                  แสดง {(offset + 1).toLocaleString('th-TH')}–{shown.toLocaleString('th-TH')} จาก {data.total.toLocaleString('th-TH')} รายการ
                </span>
                <PageNav offset={offset} perPage={perPage} rowsOnPage={rows.length}
                  total={typeof data.total === 'number' ? data.total : null}
                  disabled={loading} onGo={(off) => load(off)}
                  onPerPage={(n) => { setPerPage(n); load(0, { size: n }) }} />
              </div>
            )}
          </TableWrap>

          {picked.length > 0 && (
            <BulkBar>
              <b>เลือก {picked.length.toLocaleString('th-TH')} ใบ</b>
              <span className="text-gray-500">(เฉพาะหน้านี้)</span>
              <Link href={`/core/sales/print?ids=${encodeURIComponent(picked.join(','))}`}
                className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                🖨 พิมพ์ใบจัดเตรียมสินค้า
              </Link>
              <Link href={`/core/sales/print?doc=delivery&ids=${encodeURIComponent(picked.join(','))}`}
                className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                🖨 พิมพ์ใบส่งสินค้า
              </Link>
              <Link href={`/core/sales/print?doc=shipconfirm&ids=${encodeURIComponent(picked.join(','))}`}
                className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                🖨 พิมพ์ใบยืนยันการจัดส่ง
              </Link>
              <button type="button" onClick={() => { void copyNumbers(picked) }}
                className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                คัดลอกเลขที่ใบที่เลือก
              </button>
              <button type="button" onClick={() => setPicked([])} className="text-blue-600 hover:underline">ล้างที่เลือก</button>
              {copyMsg && <span className="text-gray-600">{copyMsg}</span>}
              <span className="text-gray-500 basis-full">
                ⚠️ ZORT พิมพ์จากจอนี้ได้ <b>8 แบบ</b> (ใบวางบิล · ใบจ่าหน้ากล่อง · ใบจัดเตรียมสินค้า · ฉลากจัดส่ง ·
                ใบแจ้งยอดชำระ · ใบส่งสินค้า · ใบส่งสินค้า+ใบสั่งซื้อ · ใบยืนยันการจัดส่ง) —
                <b>ของเรามี 3 แบบ</b> (ใบจัดเตรียมสินค้า · ใบส่งสินค้า · ใบยืนยันการจัดส่ง) —
                ที่เหลือรอ<b>ที่อยู่ผู้รับ</b>จากท่อ ·
                และคำสั่งอีก 8 อย่าง (ปักหมุด · Tag · แก้ข้อมูลขนส่ง ·
                โอนสินค้าทั้งหมด · ชำระเต็มจำนวน · รวมรายการ · ซ่อน) ยังทำไม่ได้เพราะต้อง<b>เขียนกลับไปที่ ZORT</b>
              </span>
            </BulkBar>
          )}


          {/* ⚠️ สามคอลัมน์ที่เพิ่งเพิ่มยังไม่มีค่ามา — ต้องบอกว่า "ยังไม่ส่งมา" ไม่ใช่ปล่อยให้
              เห็นขีดยาวทั้งคอลัมน์แล้วเข้าใจว่าออเดอร์พวกนี้ไม่มีขนส่ง/ยังไม่จ่ายเงิน */}
          {rows.length > 0 && rows.every((r) => !r.ship_channel && !r.ship_date && !r.pay_status) && (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
              คอลัมน์ <b>บริการขนส่ง · วันส่งสินค้า · ชำระเงิน</b> ยังขึ้นเป็นขีดทุกแถว —
              <b> ไม่ได้แปลว่าออเดอร์ไม่มีขนส่งหรือยังไม่จ่ายเงิน</b> · ค่าพวกนี้<b>มีอยู่ในคลังเงาแล้ว</b>
              {' '}(ตาราง orders เก็บ ship_channel · ship_date · tracking_no · is_cod ครบ)
              {' '}แต่ท่อ <code>list=orders</code> ยังไม่ได้ส่งออกมา ⇒ ขอไว้แล้ว พอส่งมาคอลัมน์จะขึ้นเอง
            </p>
          )}

        </>
      )}
    </div>
  )
}
