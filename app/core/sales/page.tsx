'use client'
// รายการขาย — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT เลยสักคำสั่ง
//
// **หน้าตาลอกจากจอ "รายการขาย" ของ ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
// เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" — คนใช้ ZORT ทุกวันต้องย้ายมาแล้วใช้เป็นทันที
// ผังที่ลอกมา: ชื่อจอ → บรรทัด "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" → ปุ่มขวาบน
//              → แถวค้นหา + ตัวเลือกช่วงเวลา → แท็บสถานะมีจำนวนในวงเล็บ
//              → ตาราง: # · วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, toneOfStatus, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, summaryLine, ChannelTag, relDay, RowMenu, EmptyState, DataUnreliableBanner,
  thaiDate, thaiShort, PaymentPill,
} from '@/components/zort'
import ShipStatusCard, { type ShipGroup } from '@/components/zort/ShipStatusCard'
import DataFreshness, { type Freshness } from '@/components/zort/DataFreshness'

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
  skip?: string
  from: string; to: string
  total: number; totalAmount: number
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
const STATUS_TH: Record<string, string> = {
  Success: 'สำเร็จ',
  Voided: 'ยกเลิก',
  Pending: 'รอดำเนินการ',
  Waiting: 'รอ',
}
const statusTh = (s: string) => STATUS_TH[s] ?? (s || 'ไม่ระบุสถานะ')

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
const RANGES = [
  { days: 7, label: 'ย้อนหลัง 7 วัน' },
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]

export default function CoreSalesPage() {
  const router = useRouter()
  const [days, setDays] = useState(90)
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
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)

  const [data, setData] = useState<ListResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (
    off = 0,
    opt?: { days?: number; channel?: string; status?: string; store?: string },
  ) => {
    const d = opt?.days ?? days
    const ch = opt?.channel ?? channel
    const st = opt?.status ?? status
    const sr = opt?.store ?? store
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'orders', from: thaiDay(d - 1), to: thaiDay(0),
        limit: String(PAGE), offset: String(off),
      })
      if (ch) qs.set('channel', ch)
      if (st) qs.set('status', st)
      if (sr) qs.set('store', sr)
      if (q.trim()) qs.set('q', q.trim())
      // ⚠️ **ส่ง cancelled=1 เสมอ** — ค่าเริ่มต้นของ API ตัดใบยกเลิกทิ้ง
      //    ถ้าไม่ส่ง byStatus จะไม่มี "Voided" เลย ⇒ ไม่มีแท็บยกเลิกให้กด
      //    และถ้าเผลอมีแท็บ กดแล้วจะได้ 0 ใบทั้งที่มี 44 ใบ (ฝั่งท่อหลังบ้านเตือนไว้)
      //    ZORT เองก็โชว์ใบยกเลิกในแท็บ "ทั้งหมด" เหมือนกัน — เราจึงตรงกับต้นแบบด้วย
      qs.set('cancelled', '1')
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [days, channel, status, q, store])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ZORT กดแถวแล้วไป "หน้ารายละเอียดรายการขาย" เต็มหน้า ไม่ใช่กางในตาราง
  // ส่งลำดับใบ (i) กับตัวกรองเดิมไปด้วย เพื่อให้หน้านั้นมีลูกศรเลื่อนใบก่อน/ถัดไปได้
  function openDetail(id: string, i: number) {
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
    router.push(`/core/sales/detail?${qs}`)
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
      <PageHead
        title="รายการขาย"
        summary={
          <>
            {data ? summaryLine(data.total, data.totalAmount) : 'กำลังโหลด…'}
            {/* ⚠️ ซ่อนวงเล็บตอนอยู่แท็บ "ยกเลิก" — แท็บนั้นเป็นใบยกเลิกทั้งหมดอยู่แล้ว
                วงเล็บจะซ้ำกับตัวเลขหลักเป๊ะ ๆ แล้วคนอ่านสะดุดว่าทำไมบอกสองรอบ */}
            {voided && toneOfStatus(status) !== 'red' && (
              <span className="text-gray-400">
                {' '}(รวมใบยกเลิก {voided.orders.toLocaleString('th-TH')} ใบ {fmtMoney(voided.amount)})
              </span>
            )}
            {' | '}
            {/* ZORT มีลิงก์ "แพ็คสินค้า" ตรงนี้ (ภาพ 01-รายการขาย.jpg) */}
            <Link href="/core/soon/packing" className="text-blue-600 hover:underline">แพ็คสินค้า</Link>
            {' | '}
            <span className="text-gray-400">อ่านจากคลังของเราเอง ไม่ได้ยิง ZORT</span>
          </>
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* ⚠️ สามปุ่มนี้ลอกจาก ZORT — "สร้างอย่างง่าย" ของเขาคือเปิดบิลเร็ว
                ซึ่งตรงกับจอขายหน้าร้านของเราพอดี จึงพาไปที่นั่นจริง ๆ
                ส่วนอีกสองปุ่มพาไปหน้าที่บอกว่ายังไม่ได้ทำ — เหมือนในผัง แต่กดแล้วไม่โกหก */}
            <Link href="/core/soon/sale-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/sale-create"
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
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
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
              <option value="z1">ศีตกาล เทรดดิ้ง</option>
              <option value="z2">ceojet (หน้าร้าน)</option>
            </select>
            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value); load(0, { channel: e.target.value }) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              <option value="">ทุกช่องทาง</option>
              {(data?.channels ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
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

      {data && (
        <div className="text-[12.5px] text-gray-500 mb-3">
          {/* ZORT เขียนวันแบบ 1/6/2569–2/9/2569 ไม่ใช่ ISO — ตรงนี้คือบรรทัดเดียวกันของเขา */}
          🔍 ค้นหา: วันที่ {thaiShort(data.from)} – {thaiShort(data.to)}
          {/* ⚠️ เลขทุกตัวบนจอนี้ต้องบอกว่ามาจากกี่ร้าน — ชื่อช่องทางซ้ำกันข้ามร้านได้ */}
          {' '}· ร้าน {store === 'z1' ? 'ศีตกาล เทรดดิ้ง' : store === 'z2' ? 'ceojet (หน้าร้าน)' : <b>รวมทั้ง 2 ร้าน</b>}
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
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

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

          <Tabs
            tabs={tabs}
            active={status}
            onChange={(id) => { setStatus(id); load(0, { status: id }) }}
          />

          <TableWrap>
            <table className="w-full min-w-[1080px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ลูกค้า</th>
                  <th className={TH}>ช่องทาง</th>
                  <th className={TH}>บริการขนส่ง</th>
                  <th className={TH}>วันส่งสินค้า</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>ชำระเงิน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={11} icon="🧾" title="ไม่พบใบขายในเงื่อนไขนี้"
                    detail="ลองเปลี่ยนแท็บ ช่วงเวลา หรือช่องทาง · ออเดอร์ใหม่จากมาร์เก็ตเพลสจะเข้ามาในรอบซิงก์ถัดไป" />
                )}
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id, i)}
                    className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                  >
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    {/* ZORT เขียน "วันนี้/เมื่อวานนี้" ไม่ใช่วันที่ดิบ — อ่านเร็วกว่าตอนกวาดตา */}
                    <td className={`${TD} whitespace-nowrap text-gray-500`} title={r.order_date}>
                      {relDay(r.order_date)}
                    </td>
                    <td className={TD}>
                      <span className="text-blue-600 font-medium">{r.number}</span>
                    </td>
                    <td className={`${TD} max-w-[190px] truncate`}>{r.customer || '—'}</td>
                    <td className={`${TD} max-w-[170px]`}><ChannelTag name={r.channel} /></td>
                    {/* ⚠️ ไม่มีข้อมูลให้ขีด ห้ามเว้นว่าง — ช่องว่างอ่านได้ว่า "ไม่มีขนส่ง" */}
                    <td className={`${TD} max-w-[150px] truncate`} title={r.tracking_no || ''}>
                      {r.ship_channel || r.ship_name || <span className="text-gray-300">—</span>}
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
                            label: 'คัดลอกเลขที่ใบ',
                            onClick: () => { navigator.clipboard?.writeText(r.number).catch(() => {}) },
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
                <div className="flex gap-2">
                  <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                    ← ก่อนหน้า
                  </BtnGhost>
                  <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}>
                    ถัดไป →
                  </BtnGhost>
                </div>
              </div>
            )}
          </TableWrap>

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
