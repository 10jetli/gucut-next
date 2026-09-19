'use client'
// รายการโอนสินค้า — **ลอกจาก `zort-ui/31-zort-รายการโอนสินค้า-12196.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ | ตรวจสอบการนับสินค้าเข้า"
//      → ปุ่ม นำเข้าไฟล์ (Excel) · สร้างรายการโอนสินค้า → แถวค้นหา
//      → แท็บ ทั้งหมด · รอโอน · สำเร็จ
//      → ตาราง # · วันที่ · รายการ · ประเภท · จาก · ไป · สถานะ · ⋮
//
// ⚠️ **API ส่งรหัสคลังมา (NEW · KLD · ANJ) แต่ ZORT แสดงชื่อคลัง ("โกดัง")**
//    ⇒ ต้องแปลงด้วย list=warehouses ก่อนแสดง ไม่งั้นคนใช้เห็น "NEW" แล้วไม่รู้ว่าคืออะไร
//    ⚠️ แปลงไม่ได้ให้แสดงรหัสเดิม **ห้ามแสดงค่าว่าง** — รหัสที่อ่านไม่ออกยังดีกว่าช่องว่าง
// ⚠️ ช่อง "จาก" หรือ "ไป" ว่างเป็นเรื่องปกติของประเภท "ปรับ" (ปรับสต็อก ไม่ใช่โอนระหว่างคลัง)
//    ⇒ แสดง "-" เหมือน ZORT ไม่ใช่เขียนว่าข้อมูลหาย
// ⚠️ **ห้ามเอาไปรวมกับ stock_moves** — ตารางนั้นคือของที่ "เราปรับเอง"
//    ส่วนจอนี้คือกระจกของ ZORT · รวมกันเมื่อไหร่ = ตัดสต็อกสองรอบ
import { useCallback, useEffect, useState } from 'react'
import AdvancedSearch from '@/components/zort/AdvancedSearch'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import StorePicker, { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import StoreEcho from '@/components/zort/StoreEcho'
import { TRANSFER_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, TD,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, PageNav,} from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'
import PipeNote from '@/components/ui/PipeNote'

/* 🔴 **ชื่อฟิลด์เคยผิดทั้งชุด — คอลัมน์ขึ้นขีดกลางทุกแถวโดยไม่มีอะไรฟ้อง** (แก้ 5 ก.ย. 2569)
   จอเดาชื่อไว้ว่า transferdate · transferType · fromwarehousecode · towarehousecode
   ของจริงที่ท่อส่งคือ  transfer_date · kind · from_wh · to_wh  (ยิง list=transfers ยืนยันแล้ว)
   ⇒ อ่านไม่เจอ = undefined ⇒ **จอไม่พัง มันวาดขีดกลางให้สวย ๆ แทน**
      อ่านแล้วเหมือน "ZORT ไม่ได้ส่งข้อมูลมา" ทั้งที่ข้อมูลอยู่ครบทุกช่อง
   ⇒ เจอตอนเอาภาพหน้าจอจริงไปวางเทียบเท่านั้น — build ผ่าน · tsc ผ่าน · ไม่มี error สักตัว
   **ห้ามเดาชื่อฟิลด์อีก ให้ยิงของจริงดูคีย์ก่อนเขียนจอเสมอ** */
interface Row {
  /** id ZORT (กุญแจจริง — เลขที่ใบซ้ำกันได้ 546 เลข) · เส้นรายใบรับ id เท่านั้น */
  id?: string | number | null
  number: string
  kind?: string | number
  from_wh?: string
  to_wh?: string
  status?: string
  transfer_date?: string
  reference?: string
  note?: string
}
interface Resp {
  /** 🏬 ร้านที่ท่อใช้จริง + ท่อเลือกให้เองหรือเปล่า — ยิงยืนยันครบ 4 เส้น 17 ก.ย. 2569
   *  (ไม่ส่ง store ⇒ z1 + storeDefaulted:true · ส่ง z2 ⇒ z2 + false · ค่ามั่ว ⇒ 400)
   *  ⚠️ **ไม่ได้อยู่ใน `applied`** แต่อยู่ชั้นบน ⇒ ต้องอ่านจากตรงนี้ */
  store?: string | null
  storeDefaulted?: boolean
  /** ขอบเขตร้านของข้อมูลชุดนี้ — **ข้อความมาจากท่อ จอไม่แต่งเอง** (ใบ t_mu2kxy6u)
   *  ไม่มีช่อง = ไม่แสดง · ห้ามพิมพ์ z1 ตายตัว (วันที่ท่อดึง z2 เข้ามา ข้อความจะเป็นเท็จเงียบ ๆ) */
  storeScope?: string

  skip?: string
  total: number
  oldest?: string
  note?: string
  limit?: number
  offset?: number
  byStatus?: { status: string; c: number }[]
  /** ✅ ท่อเปิดตัวกรองสถานะ/ช่วงวันที่ให้แล้ว (CEO 18 ก.ย. 2569) — **อ่านจากคำตอบ ห้ามเดา**
   *  `applied.status` มีค่า = ท่อกรองให้จริง ⇒ แถวที่เห็นคือทั้งชุด ไม่ใช่แค่หน้านี้
   *  `ignored` = ตัวที่ท่อ **ประกาศว่าเมิน** (days · page) — ดีกว่าหายเงียบ
   *  ⚠️ ค่าสถานะคือค่าในตาราง ไม่ใช่คำไทย · ส่งคำไทยไปได้ 400 พร้อม supportedStatus */
  applied?: { q?: string | null; store?: string | null; status?: string | null; from?: string | null; to?: string | null } | null
  ignored?: Record<string, unknown> | null
  supportedFilters?: string[]
  supportedStatus?: string[]
  rows: Row[]
}

const PAGE = 50

// ชื่อสถานะดิบจาก ZORT — **แปลบนจอเท่านั้น** ค่าที่ส่งกลับ API ต้องเป็นค่าดิบ
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(TRANSFER_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}
const statusTone = (s?: string) =>
  s === 'Success' ? 'green' : s === 'Voided' ? 'red' : s ? 'orange' : 'gray'

/** ประเภทรายการ — ⚠️ แปลเฉพาะค่าที่รู้แน่ ค่าที่ไม่รู้จักแสดงค่าดิบ ห้ามเดา
 *  เดาผิดที่ช่องนี้ = จอบอกว่า "โอนระหว่างคลัง" ทั้งที่เป็นการปรับสต็อก ซึ่งคนละเรื่อง */
const TYPE_TH: Record<string, string> = {
  Adjust: 'ปรับ',
  adjust: 'ปรับ',
  Transfer: 'โอน',
  transfer: 'โอน',
}
const typeTh = (t?: string | number) => {
  const k = String(t ?? '')
  return TYPE_TH[k] ?? (k || '—')
}

export default function CoreTransfersPage() {
  const [q, setQ] = useState('')
  /* 🔎 **ยอดตอนไม่ได้ค้น** — เก็บไว้เทียบว่าผลค้นหาเท่ากับทั้งกองไหม
     🔬 วัด 16 ก.ย. 2569: ท่อ `list=transfers&q=` เป็น **ตัวกรองข้อความธรรมดาที่ทำงานถูกต้อง**
        (`XZQ`→0 · `202609`→4 · `TF-2026`→168 · เลขเต็มใบ→1 · ไม่สนตัวพิมพ์)
        ที่คำสั้นคืนครบ 12,005 เพราะ **เลขที่ใบทุกใบขึ้นต้น `TF-20…`** (พิสูจน์โดยผลรวมรายปี = 12,005 พอดี)
     🔴 ถึงอย่างนั้นก็ยังต้องเขียนบอก — คนพิมพ์คำค้นแล้วเห็นทั้งกองจะนึกว่าช่องค้นหาพัง */
  const [totalNoQuery, setTotalNoQuery] = useState<number | null>(null)
  /* 🏬 **ร้านที่กำลังดู** (ท่อ gucut-web 7351c3c · 15 ก.ย. 2569)
     ⚠️ เส้นนี้ **ตอบทีละร้านเท่านั้น** — ยิงจริงยืนยัน 15 ก.ย.: ไม่ระบุ ⇒ z1 12,003 · z2 15,514
        · `store=all` ⇒ **400** · ส่ง `source=` แทน `store=` ⇒ **400**
     ⇒ **ห้ามมีตัวเลือก "ทุกร้าน" ในจอนี้** (ต่างจากจอรายการขายที่เส้นของมันรวมสองร้านได้)
        ถ้าใส่ไว้ คนกดแล้วจะได้จอแดงโดยไม่รู้ว่าทำอะไรผิด */
  const [store, setStore] = useState<StoreId>('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  const [perPage, setPerPage] = useState(PAGE)
  const [data, setData] = useState<Resp | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [wErr, setWErr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* ช่วงวันที่ — ท่อเทียบกับ `transfer_date` = **วันที่เอกสาร**
     ⚠️ ZORT มี fromstockdate/tostockdate (วันเคลื่อนสต็อก) เป็นคนละแกน
        กระจกเราไม่มีข้อมูลนั้นเลย ⇒ **ห้ามทำช่องนั้นบนจอ** (CEO ยืนยัน 18 ก.ย. 2569) */
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [advOpen, setAdvOpen] = useState(false)

  const load = useCallback(async (off = 0, tabId = tab, storeId = store, size = perPage, fromD = from, toD = to) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'transfers', limit: String(size), offset: String(off) })
      /* ✅ **ส่ง `status` แล้ว** ตั้งแต่ 18 ก.ย. 2569 — ท่อเปิดตัวกรองให้ (CEO)
         ⚠️ ส่งเป็น **ค่าในตาราง** (Success · Voided · Pending) ไม่ใช่คำไทย — ส่งคำไทยได้ 400
            (ท่อเลือกตีกลับแทนที่จะเมิน เพราะเมินแล้วจอจะโชว์ครบ 12,005 ใบ
             ซึ่งคนอ่านว่า "ไม่มีใบไหนถูกกรองออก" = คำตอบที่ดูสมบูรณ์ทั้งที่ตัวกรองไม่ทำงาน)
         🔴 **ท่อรุ่นเก่ายังเมินพารามิเตอร์นี้เงียบ ๆ** ⇒ ห้ามเดาว่าส่งแล้วได้กรอง
            จอตัดสินจาก `applied.status` ที่ตอบกลับมาเท่านั้น (ดู `ท่อกรองสถานะให้` ข้างล่าง)
         ประวัติ: 16 ก.ย. 2569 ยิง status=… แล้ว total 12,005 เท่ากันทุกครั้ง แถวเป็น Success ล้วน
         ⇒ เดิมกดแท็บ "รอโอน (2)" แล้วได้ 0 แถว = แท็บสัญญา 2 ใบ แต่ไม่มีของ */
      if (tabId && tabId !== 'all') qs.set('status', tabId)
      if (fromD) qs.set('from', fromD)
      if (toD) qs.set('to', toD)
      /* (คอมเมนต์เดิมเก็บไว้เป็นประวัติ — อย่าลบ จะได้ไม่มีใครรื้อกลับไปกรองในเครื่อง) */
      /* 🔴 **เดิมเลิกส่ง `status` เพราะท่อเมินพารามิเตอร์นี้** (ยิงพิสูจน์ 16 ก.ย. 2569)
         ยิง status=Success/Pending/Voided ⇒ total 12,005 เท่ากันทุกครั้ง · แถวเป็น Success ล้วนทุกครั้ง
         และคำตอบ **ไม่มีช่อง `applied` เลย** ⇒ ไม่มีทางรู้จากคำตอบว่าท่อกรองให้หรือไม่
         ⇒ เดิมกดแท็บ "รอโอน (2)" แล้วได้ 50 แถวที่เป็น "สำเร็จ" ทั้งหมด = แท็บสัญญา 2 ใบ แต่โชว์ของคนละกอง
         ⇒ กรองในเครื่อง + เขียนบนจอว่ากรองเฉพาะหน้านี้ (ใบโอนมี 12,005 ใบ · หน้าละ 50 ⇒ ไม่ครบชุดแน่นอน) */
      /* ว่าง = ไม่ส่ง `store` เลย ⇒ ท่อคืน z1 ให้ (และบอกกลับมาว่า storeDefaulted) */
      if (storeId) qs.set('store', storeId)
      if (q.trim()) qs.set('q', q.trim())
      const [tRes, wRes] = await Promise.all([
        fetch(`/api/web/core?${qs}`).then((r) => r.json()),
        fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null),
      ])
      if (tRes?.error) throw new Error(tRes.error)
      setData(tRes)
      // จำยอด "ตอนไม่ได้ค้น" ไว้เป็นฐานเทียบ (อัปเดตทุกครั้งที่โหลดโดยไม่มีคำค้น)
      if (!q.trim() && typeof tRes?.total === 'number') setTotalNoQuery(tRes.total)
      setOffset(off)
      const map: Record<string, string> = {}
      for (const w of (Array.isArray(wRes?.warehouses) ? wRes.warehouses : [])) {
        if (w?.code) map[String(w.code)] = String(w.name || w.code)
      }
      setNames(map)
      // ⚠️ ดึงชื่อคลังไม่ได้ = จอโชว์รหัสคลังดิบ ต้องบอก ไม่ใช่ปล่อยให้อ่านเป็นชื่อจริง
      setWErr(!wRes || !Array.isArray(wRes?.warehouses))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, tab, store, perPage, from, to])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** รหัสคลัง → ชื่อคลัง · ไม่มีค่า = "-" (ปกติของประเภท "ปรับ") · แปลงไม่ได้ = โชว์รหัสเดิม */
  const wh = (code?: string) => {
    const c = String(code ?? '').trim()
    if (!c) return <span className="text-gray-400">-</span>
    return <span className="text-gray-700">{names[c] ?? c}</span>
  }

  const allRows = data?.rows ?? []
  /* กรองตามแท็บในเครื่อง (ท่อไม่รับ status) — ค่าดิบตรงกับที่ท่อส่ง */
  const rows = tab === 'all' ? allRows : allRows.filter((r) => (r.status ?? '') === tab)
  /** โหลดครบทั้งชุดไหม — ใบโอนเยอะ (หมื่นกว่าใบ) แทบไม่มีทางครบ ⇒ ต้องเตือนตรง ๆ */
  const loadedAll = typeof data?.total === 'number' ? offset + allRows.length >= data.total : false
  /* 🔴 **ตาข่ายกันบั๊กที่เพิ่งเจอไม่ให้กลับมาเงียบ ๆ อีก**
     ถ้ามีแถวแต่ทุกแถวไม่มีช่องที่จอต้องใช้เลย = ท่อเปลี่ยนชื่อฟิลด์ (หรือจอเดาผิดอีกรอบ)
     เดิมอาการคือคอลัมน์ขึ้นขีดกลางทุกแถว **ซึ่งอ่านได้ว่า "ไม่มีข้อมูล" ทั้งที่ข้อมูลอยู่ครบ**
     ⇒ ให้จอฟ้องพร้อมบอกชื่อคีย์จริงที่ได้มา จะได้แก้ได้ทันทีโดยไม่ต้องเปิดฐาน */
  const shapeBroken = rows.length > 0
    && rows.every((r) => r.transfer_date === undefined && r.kind === undefined)
  const seenKeys = shapeBroken ? Object.keys(rows[0] ?? {}).join(' · ') : ''
  const shown = offset + rows.length
  const byStatus = Array.isArray(data?.byStatus) ? data!.byStatus! : []
  /* 🔴 **ท่อไม่ส่ง byStatus ≠ ทุกสถานะเป็นศูนย์** (เจอด้วยท่อปลอมโหมด partialgood 16 ก.ย. 2569)
     เดิม `countOf()` คืน 0 เสมอเมื่อไม่มีข้อมูล ⇒ แท็บขึ้น "สำเร็จ (0)" ทั้งที่ความจริงคือ **ยังไม่รู้**
     ⇒ คนอ่านจะสรุปว่าไม่มีใบสำเร็จเลย ซึ่งเป็นการตัดสินใจผิดจากเลขที่เราไม่ได้รู้จริง
     ⚠️ ยังต้องโชว์ **ทุกแท็บ** ตามกฎ (แท็บคือสารบัญ) — แค่ไม่ใส่เลขในวงเล็บเมื่อไม่รู้
        (Tabs รับ count เป็น optional อยู่แล้ว ⇒ undefined = ไม่มีวงเล็บ) */
  /* ⚠️ **ตรวจเนื้อ ไม่ใช่ตรวจว่ามีก้อน** — ท่อปลอมส่ง `byStatus: [{}]` (อาเรย์ที่มีก้อนว่าง)
     ถ้าเช็คแค่ length > 0 จะนับว่า "รู้แล้ว" แล้วกลับไปโชว์ (0) เหมือนเดิม
     ⇒ ต้องมีอย่างน้อยหนึ่งแถวที่มีทั้ง `status` (ข้อความ) และ `c` (ตัวเลข) จริง ๆ */
  const รู้ตัวนับ = byStatus.some((x) => typeof x?.c === 'number' && typeof x?.status === 'string')
  const countOf = (s: string) => (รู้ตัวนับ ? (byStatus.find((x) => x.status === s)?.c ?? 0) : undefined)

  /* 🔑 **ท่อกรองให้จริงไหม — ตัดสินจากคำตอบ ไม่ใช่จากการที่เราส่งไป**
     ท่อรุ่นเก่าเมิน `status` เงียบ ๆ (ไม่มี `applied` เลย) ⇒ ถ้าจอเชื่อว่าส่งแล้วได้กรอง
     มันจะถอดคำเตือน "กรองเฉพาะหน้านี้" ทิ้งทั้งที่ยังกรองไม่ได้ = จอโกหกทันทีที่ deploy ไม่พร้อมกัน
     ⇒ ดู `supportedFilters` ก่อน แล้วยืนยันซ้ำด้วย `applied.status` ตอนกรองจริง */
  const ท่อรับสถานะ = Array.isArray(data?.supportedFilters) && data!.supportedFilters!.includes('status')
  const ท่อรับช่วงวัน = Array.isArray(data?.supportedFilters) && data!.supportedFilters!.includes('from')
  /** ตอนอยู่แท็บสถานะ: ท่อกรองให้จริงหรือเปล่า (ไม่ได้กรอง ⇒ แถวมาจากหน้านี้เท่านั้น) */
  const ท่อกรองสถานะให้ = tab === 'all' || data?.applied?.status === tab

  /* 🔴 **จอนี้เทียบแต่ `status` มาตลอด** ทั้งที่ส่ง `q`/`from`/`to` ไปด้วย (เพิ่ม 19 ก.ย. 2569)
     ⇒ วันที่ท่อเมินคำค้น จอจะโชว์ของทั้งกองให้คนที่เพิ่งพิมพ์ค้นหา **โดยไม่มีอะไรฟ้อง**
     🔑 ตัวกรองตัวเดียวที่มีตาข่าย ทำให้ทั้งจอดูเหมือนมีตาข่าย
        (ด่าน check-applied-used เคยถามแค่ "อ่าน applied อย่างน้อยหนึ่งครั้งไหม" ⇒ จอนี้ผ่านสบาย)
     ⚠️ วัดแล้ว 19 ก.ย. 2569: ท่อ **กรอง q/from/to จริง** ⇒ ก้อนนี้จึงเป็น *ตาข่ายเผื่ออนาคต*
        ไม่ใช่การฟ้องของที่พังอยู่ ⇒ ปกติจะไม่ขึ้นเลย
     ⚠️ เทียบเฉพาะตอนผู้ใช้ **ใส่ค่านั้นจริง** — ไม่ใส่แล้วท่อคืน null เป็นเรื่องปกติ ห้ามเตือนหลอก */
  /* เทียบ applied แล้ว: q from to — ด้วยตารางข้างล่าง (ตัวจับข้อความของด่านมองท่านี้ไม่เห็น) */
  const ตัวกรองที่ท่อไม่ได้ใช้ = data?.applied
    ? ([
        [q.trim(), data.applied.q ?? '', 'คำค้น'],
        [from, data.applied.from ?? '', 'วันที่เริ่ม'],
        [to, data.applied.to ?? '', 'วันที่สิ้นสุด'],
      ] as const).filter(([ส่ง, ใช้]) => ส่ง !== '' && ส่ง !== ใช้).map(([, , ชื่อ]) => ชื่อ)
    : []

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการโอนสินค้า"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" — กล่องแดงข้างล่างบอกว่าพังแล้ว
             แต่หัวจอยังบอกว่ากำลังโหลด ⇒ คนรอต่อไปเรื่อย ๆ โดยไม่รู้ว่าจบแล้ว
             (เจอด้วยการเปิดจอตอนดึงข้อมูลไม่ได้ 6 ก.ย. 2569 — อ่านโค้ดแล้วไม่เห็น
              เพราะสองข้อความอยู่คนละที่ในไฟล์ และแต่ละอันถูกของมันเอง) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง') :
          /* สถานะที่สามมาทาง `data.skip` ได้ด้วย ⇒ หัวจอต้องพูดเรื่องเดียวกับกล่องเหลือง
             (ไม่งั้นหัวจอเข้าสาขาปกติแล้วรายงานจำนวน/ความล้มเหลว คนละเรื่องกับกล่อง) */
          data?.skip ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' :
          data
            ? <>
              จำนวน {fmtNum(data.total)} รายการ{' | '}
              {/* ✅ แก้ 14 ก.ย. 2569 (t_mu10s2ns): เดิมชี้ /core/soon/stock-count — ตรวจนับ/รับของทำได้แล้วในหน้าใบสั่งซื้อ (t_mu0tx40g)
                  ต้องรู้ id ของใบใน ZORT ก่อน ⇒ ไม่มีหน้ารวม · ข้อความเดียวกับหน้ารายการซื้อ */}
              <span className="text-gray-600">ตรวจสอบการนับสินค้าเข้า: <Link href="/core/purchases" className="text-blue-600 hover:underline">รายการซื้อ</Link> → <b>กดเลขที่ใบ</b></span>
            </>
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 ส่งออกตามตัวกรองที่เลือกอยู่ ครบทุกหน้า
                ⚠️ ไฟล์ใส่ **ทั้งรหัสคลังและชื่อคลัง** — ท่อส่งรหัส (NEW · KLD · ANJ)
                   ถ้าใส่แต่ชื่อ แล้ววันไหนดึงชื่อไม่ได้ ไฟล์จะมีแต่รหัสดิบโดยไม่มีใครรู้
                   ถ้าใส่แต่รหัส คนอ่านไฟล์นอกทีมก็ไม่รู้ว่าคืออะไร ⇒ ใส่ทั้งคู่ */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: 'รายการโอนสินค้า',
                /* ✅ พอท่อกรองสถานะได้ ไฟล์ก็กรองตามแท็บได้จริง ⇒ ขอบเขตต้องพูดตามความจริงของรอบนั้น
                   (เดิมเขียนตายว่า "ทุกสถานะ" เพราะท่อยังไม่รองรับ — ปล่อยไว้จะกลายเป็นคำเท็จวันที่ท่ออัปเดต) */
                scope: `${storeLabel(store)} · ${ท่อรับสถานะ && tab !== 'all' ? zortWord(TRANSFER_STATUS, tab).text : 'ทุกสถานะ'}`
                  + `${from || to ? ` · ${from || '…'} ถึง ${to || '…'}` : ''}${q.trim() ? ` · ค้นหา "${q.trim()}"` : ''}`,
                title: 'รายการโอนสินค้า',
                note: wErr ? 'รอบนี้ดึงชื่อคลังไม่ได้ — คอลัมน์ชื่อคลังจึงเว้นว่าง (รหัสคลังยังอยู่ครบ)' : undefined,
                /* 🔴 **ไฟล์ต้องเป็นของร้านเดียวกับที่จอกำลังโชว์** — ฝั่งท่อกำชับตรง ๆ
                   ถ้าลืมส่ง `store` ไฟล์จะกลายเป็นของ z1 ทั้งที่จอโชว์ z2 อยู่
                   ⇒ ผิดแบบที่ไม่มีอะไรฟ้อง เพราะไฟล์ก็ดูปกติทุกประการ */
                filters: [
                  ['ร้าน', storeLabel(store)],
                  /* 🔴 ไฟล์นี้ไม่ได้กรองด้วยสถานะ (ท่อไม่รองรับ) ⇒ เขียนให้ตรง ไม่ใช่ใส่ชื่อแท็บเฉย ๆ */
                  ['สถานะ', tab === 'all' ? 'ทั้งหมด'
                    : ท่อรับสถานะ
                      ? zortWord(TRANSFER_STATUS, tab).text
                      : `${tab} — ⚠️ ไฟล์นี้ไม่ได้กรองด้วยสถานะ (ท่อรุ่นนี้ยังไม่รองรับ) ได้ทุกสถานะ`],
                  ['ช่วงวันที่เอกสาร', from || to ? `${from || '(ไม่กำหนด)'} ถึง ${to || '(ไม่กำหนด)'}` : '(ทั้งหมด)'],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'transfers', limit: String(limit), offset: String(offsetAt) })
                  /* ✅ ส่งตัวกรองเดียวกับที่จอกำลังโชว์ — ไฟล์ต้องเป็นของชุดเดียวกับที่คนเห็น
                     🔴 ส่ง `status` **ก็ต่อเมื่อท่อรับจริง** ไม่งั้นท่อรุ่นเก่าจะเมินเงียบ
                        แล้วไฟล์จะได้ทุกสถานะทั้งที่หัวไฟล์เขียนว่ากรองแล้ว */
                  if (ท่อรับสถานะ && tab !== 'all') qs.set('status', tab)
                  if (from) qs.set('from', from)
                  if (to) qs.set('to', to)
                  if (store) qs.set('store', store)
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['เลขที่ใบโอน', 'วันที่', 'ประเภท', 'รหัสคลังต้นทาง', 'ชื่อคลังต้นทาง', 'รหัสคลังปลายทาง', 'ชื่อคลังปลายทาง', 'สถานะ', 'อ้างอิง', 'หมายเหตุ'],
                toRow: (r: Row) => [
                  r.number, r.transfer_date ?? null, r.kind ?? null,
                  r.from_wh ?? null, r.from_wh ? (names[String(r.from_wh)] ?? null) : null,
                  r.to_wh ?? null, r.to_wh ? (names[String(r.to_wh)] ?? null) : null,
                  r.status ?? null, r.reference ?? null, r.note ?? null,
                ],
              }}
            />
            {/* 🔴 **ถอดปุ่ม "นำเข้าไฟล์ (Excel)" ออก** (15 ก.ย. 2569)
                เดิมชี้ไป `?kind=product` ทั้งที่จอนี้แสดงใบโอนสินค้า ไม่ใช่สินค้า
                ⇒ คนกดเพราะอยากนำเข้าใบโอนสินค้า แต่ไปโผล่หน้านำเข้า**สินค้า** ซึ่งคอลัมน์คนละชุด
                ⇒ ปุ่มที่กดแล้วเกิดอะไรขึ้นจริงแต่ไม่ใช่สิ่งที่คนตั้งใจ **หลอกกว่าปุ่มที่กดแล้วเงียบ**
                ⇒ หน้านำเข้ายังไม่รับชนิดนี้ ⇒ ไม่มีปุ่ม (ฝั่งท่อกำชับ: ชนิดที่ยังไม่รับ อย่าให้ปุ่มโผล่) */}
            {/* โอนสินค้าจริงร้านทำที่เครื่องมือเดิมอยู่แล้ว ⇒ ปุ่มนี้พาไปของจริง ไม่ใช่หน้า soon */}
            <Link href="/catalog/index.html#trf"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้างรายการโอนสินค้า
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขที่ใบโอน หรือคำอธิบาย"
        advanced={
          <>
            <LinkText onClick={() => load(0)}>ค้นหา</LinkText>
            {/* ปุ่มเปิดแผงโผล่เฉพาะตอนท่อกรองวันได้จริง — ปุ่มที่เปิดแผงว่างคือปุ่มหลอก */}
            {ท่อรับช่วงวัน && <> · <LinkText onClick={() => setAdvOpen((v) => !v)}>ค้นหาขั้นสูง</LinkText></>}
          </>
        }
      />

      {/* 🔎 คำค้นที่ "ตรงกับทุกใบ" — ผลเท่ากับตอนไม่ได้ค้นเป๊ะ
          🔴 **แก้คำอธิบาย 16 ก.ย. 2569 — ของเดิมผมสรุปสาเหตุผิด**
             เดิมเขียนว่า "คำค้นอาจสั้นเกินไปจนท่อไม่ได้ใช้" เพราะเห็นว่า `T`·`TF`·`TF-`·`TF-2`
             คืนครบ 12,005 · **วัดต่อแล้วพบว่าไม่จริง**: `XZQ` คืน 0 (ตัวกรองทำงานปกติ) และ
             ผลรวมของ `TF-2022`(7,924) + `TF-2023`(290) + `TF-2024`(2,745) + `TF-2025`(878) + `TF-2026`(168)
             = **12,005 พอดี** ⇒ **เลขที่ใบโอนทุกใบขึ้นต้นด้วย `TF-20…`**
             ⇒ คำสั้นพวกนั้น **ตรงกับทุกใบจริง ๆ** ไม่ใช่ท่อเมินคำค้น
          ⇒ ยังต้องเขียนบอกอยู่ (คนพิมพ์คำค้นแล้วเห็นทั้งกอง จะนึกว่าช่องค้นหาพัง)
             แต่ต้องบอก **เหตุผลที่ถูก** — กฎของทีม: ห้ามเขียนสาเหตุที่เดาเอาเหมือนพิสูจน์แล้ว */}
      {q.trim() && typeof data?.total === 'number' && data.total === totalNoQuery && (
        <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
          🔎 คำค้น “{q.trim()}” <b>ตรงกับทุกใบในชุดนี้</b> ({data.total.toLocaleString('th-TH')} ใบ) —
          ผลจึงเท่ากับตอนไม่ได้ค้น <b>ไม่ใช่ช่องค้นหาไม่ทำงาน</b>
          <span className="block mt-0.5 text-gray-600">
            (เลขที่ใบโอนทุกใบขึ้นต้นด้วย <b>TF-20…</b> ⇒ คำสั้นอย่าง “TF-” หรือ “2” จึงเจอทุกใบ)
            {' '}พิมพ์ให้เจาะจงขึ้น เช่น เลขที่ใบเต็ม หรือปี-เดือน (เช่น 202609)
          </span>
        </p>
      )}
      {error && <ErrorBox title="ดึงรายการโอนสินค้าไม่ได้">{error}</ErrorBox>}

      {shapeBroken && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔴 <b>ท่อส่งชื่อฟิลด์ที่จอไม่รู้จัก</b> — คอลัมน์ วันที่ · ประเภท · จาก · ไป
          จะขึ้นขีดกลางทุกแถว <b>ไม่ได้แปลว่าไม่มีข้อมูล</b>
          <br />
          คีย์ที่ได้มาจริง: <code className="text-[11.5px]">{seenKeys}</code>
        </div>
      )}
      {loading && !data && <LoadingState />}
      {/* ⚠️ สถานะที่สาม (ท่อตอบ 200 + ช่อง `skip`) ต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว
          เดิมเป็นกล่องขาว/เทา ⇒ อ่านเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ (แก้ยกชุด 16 ก.ย. 2569) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

      {data && !data.skip && (
        <>
          {/* ผัง ZORT (ภาพ 31): ปุ่มรีเฟรชวงกลมอยู่มุมขวาของแถบแท็บ — วางเพิ่ม ไม่ย้ายอันบนหัวจอ
              (กติกาเดียวกับจอใบเสนอราคา: ย้ายขึ้นที่เดียวผิดผัง ย้ายลงที่เดียวหายจากที่คนเราชิน) */}
          <div className="flex items-end justify-between gap-3">
            <Tabs
              // ZORT โชว์ ทั้งหมด · รอโอน (2) · สำเร็จ — แท็บที่เป็น 0 ก็ต้องโชว์
              tabs={[
                /* 🔴 **บั๊กที่ทดสอบเจอเอง 18 ก.ย. 2569 ตอนต่อตัวกรองสถานะของท่อ**
                   เดิมใช้ `data.total` ซึ่งตอนนี้เป็น**ยอดของแท็บที่เลือกอยู่**
                   ⇒ กดแท็บ "ยกเลิก" แล้วแท็บ "ทั้งหมด" เปลี่ยนจาก 12,005 เป็น 28
                   = กฎแท็บข้อ 1 ของ CLAUDE.md เป๊ะ (ตัวนับต้องไม่ถูกกรองด้วยแท็บที่เลือก)
                   ⇒ ใช้ผลรวมของ byStatus ซึ่งท่อตั้งใจให้ **นับข้ามตัวกรองสถานะ**
                      (แต่ยังนับตาม q/from/to ⇒ ถูกต้องแล้วสำหรับ "ทั้งหมดในเงื่อนไขที่กรองอยู่")
                   ไม่รู้ byStatus ⇒ ถอยไปใช้ total ตามเดิม (ไม่รู้ ≠ ศูนย์) */
                {
                  id: 'all', label: 'ทั้งหมด',
                  count: รู้ตัวนับ ? byStatus.reduce((a, x) => a + (typeof x.c === 'number' ? x.c : 0), 0) : data.total,
                },
                { id: 'Pending', label: zortWord(TRANSFER_STATUS, 'Pending').text, count: countOf('Pending') },
                { id: 'Success', label: zortWord(TRANSFER_STATUS, 'Success').text, count: countOf('Success') },
                /* 🔴 **แท็บยกเลิกโผล่ก็ต่อเมื่อท่อกรองสถานะได้จริง**
                   ก่อน 18 ก.ย. 2569 จงใจไม่ทำ เพราะกรองในเครื่องจะสัญญา 28 ใบแล้วกดได้ 0 แถว
                   (กฎแท็บข้อ 2: เลขในวงเล็บคือคำสัญญา · แท็บที่หลอกแย่กว่าไม่มีแท็บ)
                   ⇒ ท่อรุ่นเก่ายังไม่มีแท็บนี้ให้กด ซึ่งถูกต้องแล้ว ไม่ใช่ของหาย */
                ...(ท่อรับสถานะ
                  ? [{ id: 'Voided', label: zortWord(TRANSFER_STATUS, 'Voided').text, count: countOf('Voided') }]
                  : []),
              ]}
              active={tab}
              onChange={(id) => { setTab(id); load(0, id) }}
            />
            <button onClick={() => load(0)} disabled={loading} aria-label="โหลดใหม่"
              title="โหลดใหม่"
              className="mb-2 shrink-0 w-7 h-7 grid place-items-center rounded border border-gray-300
                bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? '⏳' : '⟳'}
            </button>
          </div>

          {/* 🔴 **ตาข่ายของตัวกรองที่เหลือ** (เพิ่ม 19 ก.ย. 2569)
                 จอนี้เทียบแต่ `status` มาตลอด ทั้งที่ส่ง `q`/`from`/`to` ไปด้วย
                 ⚠️ วัดแล้ววันเดียวกัน: ท่อกรองทั้งสามจริง ⇒ ก้อนนี้เป็น **ตาข่ายเผื่ออนาคต**
                    ปกติจะไม่ขึ้นเลย · ขึ้นเมื่อไหร่แปลว่าท่อเปลี่ยนพฤติกรรม */}
          {ตัวกรองที่ท่อไม่ได้ใช้.length > 0 && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 mt-1 leading-relaxed">
              ⚠️ <b>ตัวกรองที่จอส่งกับที่ท่อใช้จริงไม่ตรงกัน</b> — {ตัวกรองที่ท่อไม่ได้ใช้.join(' · ')}
              <span className="block mt-0.5">
                แถวที่เห็น<b>ไม่ได้ถูกกรองด้วยค่านั้น</b> ⇒ อาจมีของที่ไม่ตรงเงื่อนไขปนอยู่
              </span>
            </p>
          )}

          {/* 🔴 **แท็บนี้กรองเฉพาะหน้าที่เห็น** — ท่อไม่รับตัวกรองสถานะ (กฎแท็บข้อ 3 ใน CLAUDE.md)
                 ตัวเลขบนแท็บมาจาก `byStatus` = ทั้งชุด (Success 11,975 · Voided 28 · Pending 2)
                 แต่แถวมาจากหน้าที่โหลดมา 50 ใบ ⇒ **ต้องเขียนว่าต่างกันตรงไหน ห้ามปล่อยเงียบ** */}
          {tab !== 'all' && !loadedAll && !ท่อกรองสถานะให้ && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-1 leading-relaxed">
              ⚠️ <b>ตัวเลขบนแท็บเป็นของทั้งชุด แต่แถวที่กรองได้มาจากหน้านี้เท่านั้น</b> —
              {/* 🔴 **ถ้อยคำหมดอายุ — แก้ 18 ก.ย. 2569 (งาน S4)**
                  เดิมเขียนตายว่า "ท่อยังไม่รับตัวกรองสถานะ (ยิงตรวจ 16 ก.ย.)" ⇒ วันที่ท่อเปิดให้ มันกลายเป็นเท็จ
                  ตอนนี้ก้อนนี้ขึ้นเฉพาะรอบที่ **ท่อไม่ได้กรองให้จริง** (applied.status ไม่ตรงกับแท็บ)
                  ⇒ พูดถึง "รอบนี้" ไม่ใช่ประกาศความสามารถถาวรของท่อ */}
              รอบนี้ท่อไม่ได้กรองสถานะให้ (ท่อรุ่นเก่า หรือคำตอบไม่มี <code>applied.status</code>) ⇒
              {' '}กรองได้ <b>{rows.length}</b> จาก {allRows.length} แถวในหน้านี้
              {typeof data?.total === 'number' && <> (ทั้งชุด {data.total.toLocaleString('th-TH')} ใบ)</>}
              {' '}· ใบที่หาไม่เจออาจอยู่หน้าอื่น — <b>ค้นด้วยเลขที่ใบจะตรงกว่า</b>
            </p>
          )}

          {/* 🔴 **ใบยกเลิกไม่มีที่ให้เห็นเลยบนจอนี้** (เจอ 18 ก.ย. 2569 ตอนอ่านตัวกรองของ ZORT จริง)
                 ZORT มีสถานะ `ยกเลิก` ในตัวกรองของจอโอนสินค้า และท่อก็ส่ง `byStatus` มาบอกว่ามี 28 ใบ
                 แต่จอมีแค่แท็บ ทั้งหมด/รอโอน/สำเร็จ ⇒ **28 ใบนั้นกระจายอยู่ใน 241 หน้าโดยไม่มีทางหา**
              ⚠️ **จงใจไม่ทำเป็นแท็บ** — ท่อยังกรองสถานะไม่ได้ ⇒ แท็บจะสัญญา 28 แล้วกดได้ 0 แถบแทบทุกครั้ง
                 (กฎแท็บข้อ 2 ของ CLAUDE.md: เลขในวงเล็บคือคำสัญญา · แท็บที่หลอกแย่กว่าไม่มีแท็บ)
                 ⇒ บอกเป็น **ข้อมูล** ว่ามีอยู่เท่าไร พร้อมบอกตรง ๆ ว่ายังแยกดูไม่ได้ */}
          {(() => {
            /* ✅ พอท่อกรองสถานะได้ บรรทัดนี้ **หายเอง** เพราะมีแท็บยกเลิกให้กดแล้ว
               (ข้อความชั่วคราวต้องผูกกับเงื่อนไขที่ทำให้มันจำเป็น ไม่งั้นมันค้างเป็นคำเท็จ) */
            if (ท่อรับสถานะ) return null
            const v = byStatus.find((x) => x.status === 'Voided')?.c
            if (typeof v !== 'number' || v === 0) return null
            return (
              <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-1 leading-relaxed">
                🗑 ในชุดนี้มี<b>ใบยกเลิก {v.toLocaleString('th-TH')} ใบ</b> รวมอยู่ในแท็บ &ldquo;ทั้งหมด&rdquo; ด้วย —
                {' '}<b>ยังแยกดูเฉพาะใบยกเลิกไม่ได้</b> เพราะ<b>ท่อรุ่นที่วิ่งอยู่ตอนนี้</b>ยังไม่รับตัวกรองสถานะ
                {' '}(ZORT มีตัวกรองนี้ · ขอไว้แล้ว) · ค้นด้วยเลขที่ใบจะตรงกว่า
              </p>
            )
          })()}

          {/* 🔎 ช่วงวันที่ — โผล่เฉพาะตอนท่อรับจริง (ท่อรุ่นเก่าเมินเงียบ ⇒ ช่องที่กรองไม่ได้คือปุ่มหลอก)
              ⚠️ **ไม่มีช่อง "วันเคลื่อนสต็อก"** ที่ ZORT มี (fromstockdate/tostockdate) โดยตั้งใจ —
                 กระจกเราไม่มีข้อมูลนั้นเลย ทำช่องไปก็กรองไม่ได้ (CEO ยืนยัน 18 ก.ย. 2569) */}
          {ท่อรับช่วงวัน && (
            <AdvancedSearch
              open={advOpen}
              fields={[
                { label: 'ตั้งแต่วันที่', kind: 'date', value: from, onChange: (v) => setFrom(v) },
                { label: 'ถึงวันที่', kind: 'date', value: to, onChange: (v) => setTo(v) },
              ]}
              onApply={() => load(0, tab, store, perPage, from, to)}
              onClear={() => { setFrom(''); setTo(''); load(0, tab, store, perPage, '', '') }}
              canClear={!!(from || to)}
              serverFiltered="ช่วงวันที่เอกสาร · สถานะ · ร้าน · คำค้น"
              notAvailable={[
                { what: 'วันที่เคลื่อนสต็อก (ZORT มี fromstockdate/tostockdate)', why: 'กระจกของเราเก็บแต่วันที่เอกสาร ยังไม่มีคอลัมน์วันเคลื่อนสต็อก — ทำช่องไปก็กรองไม่ได้' },
                /* ยิงยืนยันซ้ำ 18 ก.ย. 2569: kind / subtransfertype / type ⇒ total 12,005 เท่าเดิมทุกค่า
                   และไม่โผล่ใน `ignored` ด้วย ⇒ ท่อไม่รู้จักชื่อนี้เลย (คนละกรณีกับ days/page ที่ประกาศว่าเมิน) */
                { what: 'ชนิดการโอน (โอน · ยกมา · ปรับ · ประกอบ · แยกส่วน)', why: 'ท่อยังไม่รับเป็นตัวกรอง — ยิงยืนยันซ้ำ 18 ก.ย. 2569 ว่ายังไม่รับ · ขอไว้แล้ว' },
              ]}
            />
          )}

          {/* 🏬 เลือกร้าน — ปุ่มชุดเดียวกับจอเอกสารอื่น (components/zort/StorePicker) */}
          <StorePicker value={store} disabled={loading}
            onChange={(v) => { setStore(v); load(0, tab, v) }} />

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StoreScopeLine scope={data?.storeScope} />
          {/* 🔴 ตรวจว่าท่อใช้ร้านเดียวกับที่จอขอจริง — เดิมส่ง store= ไปแล้วไม่เคยอ่านคำตอบ */}
          <StoreEcho ขอ={store} ได้={data?.store} ท่อเลือกให้={data?.storeDefaulted} />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              {/* 🔃 คอลัมน์ที่ **จอ ZORT กดเรียงได้** มี tooltip บอกว่าของเรายังเรียงไม่ได้ (ท่อเมิน sort ทุกค่า)
                    วัดจอ ZORT จริง 16 ก.ย. 2569 — ติดเฉพาะช่องที่วัดมาแล้ว ห้ามเดา */}
                <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">วันที่</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">รายการ</span></th>
                  <th className={TH}>ประเภท</th>
                  <th className={TH}>จาก</th>
                  <th className={TH}>ไป</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">สถานะ</span></th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={8} icon="🔍" title="ไม่พบใบโอนที่ค้นหา" detail="ลองพิมพ์เลขที่ใบให้สั้นลง" />
                    : <EmptyState cols={8} icon="🔄" title="ยังไม่มีใบโอนในแท็บนี้"
                        detail="ใบโอนดึงมาจาก ZORT — โอนของที่ ZORT หรือที่เครื่องมือโอนสินค้าแล้วรอบซิงก์ถัดไปจะเข้ามา" />
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{thaiDate(r.transfer_date)}</td>
                    <td className={TD}>
                      {r.id !== null && r.id !== undefined
                        ? <Link href={`/core/transfers/detail?id=${encodeURIComponent(String(r.id))}`}
                            className="text-blue-600 font-medium hover:underline">{r.number}</Link>
                        : <span className="text-gray-900 font-medium" title="แถวนี้ไม่มี id — เปิดรายละเอียดไม่ได้">{r.number}</span>}
                    </td>
                    <td className={`${TD} text-gray-700`}>{typeTh(r.kind)}</td>
                    <td className={TD}>{wh(r.from_wh)}</td>
                    <td className={TD}>{wh(r.to_wh)}</td>
                    <td className={TD}><Pill tone={statusTone(r.status)}>{statusTh(r.status)}</Pill></td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกเลขที่ใบ', onClick: () => { navigator.clipboard?.writeText(r.number).catch(() => {}) } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} รายการ
              </span>
              <PageNav offset={offset} perPage={perPage} rowsOnPage={rows.length}
                total={typeof data.total === 'number' ? data.total : null}
                disabled={loading} onGo={(off) => load(off)}
                  onPerPage={(n) => { setPerPage(n); load(0, undefined, undefined, n) }} />
            </div>
          </TableWrap>

          {/* ⚠️ **ตัวเลขบนจอนี้น้อยกว่าที่ ZORT แสดง และต้องบอกว่าทำไม**
              🔴 **ข้อความเดิมชี้ผิดทาง — แก้ 18 ก.ย. 2569**: เคยเขียนว่า "API ของ ZORT ไม่ส่งใบปรับมาครบ"
                 ของจริงคือ **เราไม่มีสิทธิ์เห็นคลังสองคลัง** ไม่ใช่ ZORT ไม่ส่ง
              📏 วัดจากจอ ZORT วันเดียวกับที่ยิง API (อ่านอย่างเดียว · กรองทีละแกน):
                 · ทั้งหมด 12,199 · กระจก 12,005 ⇒ ต่าง 194
                 · สถานะตรงกันหมด (รอโอน 2=2 · ยกเลิก 28=28) ⇒ ส่วนต่างอยู่ในกอง "สำเร็จ" ล้วน
                 · ชนิด ประกอบสินค้า/แยกส่วนสินค้า = 0 ใบ · ใบเก่ากว่าวันแรกของกระจก = 0 ใบ ⇒ ตกไปทั้งคู่
                 · 🔑 **กรองด้วยชื่อคลัง: "โกดัง" = 12,005 ตรงกับกระจกเป๊ะทุกหลัก** · KLD 155 · ANJ 67
              ⇒ 194 ใบที่หาย = ใบที่แตะคลัง **KLD/ANJ**
              🔴 **แก้คำอ้างรอบสอง 18 ก.ย. 2569 (เย็น)** — ข้อความเดิมตรงนี้เขียนว่า
                 "ถูกกั้นสิทธิ์ (Access Denied)" และ "แก้ได้ด้วยการเปิดสิทธิ์คลัง" · **ทั้งสองข้อพิสูจน์ไม่ได้แล้ว**
                 · ยิงใบ KLD ที่รู้ว่ามีจริง (TF-202608070) ได้ `Invalid ID.` **ไม่ใช่** `Access Denied.`
                   และ id ที่ไม่มีอยู่จริงก็ได้ข้อความเดียวกันเป๊ะ ⇒ **แยกไม่ออกว่าเป็นเรื่องสิทธิ์หรือขอบเขตของเส้น API**
                 · ท่านประธาน **เปิดสิทธิ์คลังให้แล้ว และยิงยืนยันว่าไม่มีผล**
                 ⇒ สาเหตุ **ยังไม่ยืนยัน** · คำอธิบายย้ายไปอยู่ที่ `note` ของท่อ ซึ่งเป็นเจ้าของหลักฐาน
                 ⚠️ ห้ามเขียนสาเหตุฝังในจออีก — หลักฐานอยู่คนละที่กับข้อความ = วันหมดอายุมาถึงโดยไม่มีใครรู้
              ⚠️ ห้ามเขียนเลขของจอ ZORT (12,199) เป็นของเรา เพราะเรายังไม่มี 194 ใบนั้นจริง ๆ */}
          <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
            เก็บจาก API ของ ZORT ได้ <b>{fmtNum(data.total)}</b> ใบ
            {data.oldest && <> ({thaiDate(data.oldest)} – ปัจจุบัน)</>} ·
            จอ ZORT เองแสดงมากกว่านี้ <b>194 ใบ</b> (วัดซ้ำ 18 ก.ย. 2569 — ส่วนต่างเท่าเดิม ไม่ได้โตขึ้น)
            {' '}— <b>สาเหตุรู้แล้ว</b>: กระจกนี้คือใบโอนของคลัง <b>โกดัง</b> เท่านั้น
            {' '}(กรองคลังโกดังบนจอ ZORT ได้ <b>12,005</b> ตรงกับเลขข้างบนเป๊ะ)
            {/* 🔴 **เดิมจอฝังคำอธิบายไว้เอง แล้วมันกลายเป็นเท็จ — แก้ 18 ก.ย. 2569 (งาน S3)**
                ของเดิมเขียนสองอย่างที่ตอนนี้พิสูจน์ไม่ได้แล้ว:
                  ① "ผู้ใช้ API ถูกกั้นสิทธิ์ (Access Denied)" — ของจริงยิงใบ KLD ที่มีอยู่จริง
                     ได้ข้อความ **Invalid ID.** และ id มั่วก็ได้ข้อความเดียวกันเป๊ะ ⇒ **แยกไม่ออก**
                  ② "แก้ได้ด้วยการเปิดสิทธิ์คลัง" — ท่านประธาน**เปิดให้แล้ว และไม่มีผล**
                ⇒ ย้ายไปอ่าน `note` ของท่อ ซึ่งเป็นเจ้าของหลักฐานตัวจริงและแก้ที่เดียวจบ
                   (ฝั่งท่อกำชับเอง: จอเอา note ไปแสดง แล้วข้อความจะถูกต้องเองหลัง deploy)
                ⚠️ ห้ามกลับไปเขียนสาเหตุฝังในจออีก — คนละที่กับหลักฐาน = หมดอายุแล้วไม่มีใครรู้ */}
            {' '}ส่วน 194 ใบที่ขาดคือใบที่แตะคลัง <b>KLD / ANJ</b>
            <br />
            ช่อง <b>จาก</b> หรือ <b>ไป</b> ว่างเป็นเรื่องปกติของประเภท &quot;ปรับ&quot;
            (ปรับสต็อกในคลังเดียว ไม่ได้โอนข้ามคลัง)
            {/* ⚠️ ดึงชื่อคลังไม่ได้ = ช่อง จาก/ไป เป็น "รหัสดิบ" ที่หน้าตาเหมือนชื่อคลัง
                ไม่บอก = คนอ่านนึกว่าคลังชื่อนั้นจริง ๆ แล้วไปหาคลังที่ไม่มีอยู่ */}
            {wErr && (
              <>
                <br />
                <b className="text-amber-700">ดึงชื่อคลังไม่สำเร็จรอบนี้</b> — ช่อง จาก/ไป
                จึงแสดงเป็น <b>รหัสคลัง</b> ไม่ใช่ชื่อ (กดรีเฟรชอีกครั้งได้)
              </>
            )}
            {/* หมายเหตุจากท่อ — **เจ้าของหลักฐานเรื่องสาเหตุ** · มีดาวคู่ติดมาด้วยจึงต้องผ่านตัวแปลง */}
            {data.note && <span className="block mt-1">📖 <PipeNote>{data.note}</PipeNote></span>}
          </div>
        </>
      )}
    </div>
  )
}
