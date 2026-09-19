'use client'
// ร้านค้าออนไลน์ → สินค้าบน Marketplace — ตัวแทนเมนู `/Marketplace/List` ของ ZORT
//
// ✅ **ได้ภาพจริงแล้ว 7 ก.ย. 2569** (`zort-ui/83-…-ว่างเปล่า.jpg`) — จัดผังตามภาพ:
//    breadcrumb "‹ Marketplace Dashboard" + หัวจอ "ร้าน" · แท็บ Shopee/Lazada/Tiktok Shop
//    คอลัมน์ # · รหัส · ชื่อสินค้า · ลิงก์ Marketplace · วางจำหน่ายสินค้าⓘ · Export มุมล่างซ้าย
//    ⚠️ จอ ZORT ของจริง **ว่างเปล่า 0 รายการ** (ร้านไม่เคยผูกสินค้าผ่านหน้านั้น)
//    ⇒ ข้อมูลของเราจึง "เกินผัง" โดยธรรมชาติ — เก็บไว้เพราะตอบคำถามที่ ZORT ตอบไม่ได้
//
// คำถามที่จอนี้ตอบ: **สินค้าตัวไหนลงขายอยู่บนช่องทางไหนบ้าง — และตัวไหนยังไม่ได้ลงเลย**
// ต่างจากคอลัมน์ Marketplace ในจอสินค้าตรงที่จอนั้นดูทีละแถว ส่วนจอนี้กรอง/นับได้ทั้งคลัง
//
// 🔴 **ข้อมูลชุดเดียวกับคอลัมน์ Marketplace ในจอสินค้า** (`list=stock&marketplaces=1`)
//    ⇒ เลขสองจอต้องตรงกันเสมอ · ถ้าวันไหนไม่ตรง แปลว่ามีจอหนึ่งนับเอง ซึ่งผิดกติกา
// ⚠️ ต้องไล่ทุกหน้า ไม่ใช่หน้าแรกหน้าเดียว — วัดจริง 5 ก.ย.: หน้าแรก 200 แถวให้ shopee 11
//    แต่ทั้ง 2,672 แถวได้ 76 ⇒ **หน้าแรกไม่ใช่ตัวแทน** (บทเรียนที่เจอมาแล้วสามครั้ง)
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  EmptyState, MarketLogos, MarketCoverage, MarketUnreliableBanner, PageNav,} from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'
import { skuScopeNote } from '@/lib/sku-scope'
import ChannelGapsCard from '@/components/zort/ChannelGapsCard'

interface Row {
  sku: string; name: string; qty?: number; available?: number
  active?: boolean; service?: boolean
  marketplaces?: string[]
  marketplacesBy?: Record<string, string>
  marketplacesFrom?: Record<string, string[]>
}
interface Resp {
  rows?: Row[]; total?: number
  /** จำนวนสินค้าใน ZORT ที่ยังไม่ได้ตั้งรหัส — ท่อส่งมาให้กับทุกคำขอ `list=stock`
   *  🔴 ใช้เขียนกำกับขอบเขตในหัวไฟล์ Excel · **ห้ามเขียนเลขนี้ตายตัวในโค้ด** (ร้านตั้งรหัสเพิ่มแล้วเลขลด)
   *  ⚠️ ไม่มีคีย์ = ไม่รู้ ⇒ ตัวเขียนป้ายจะไม่ใส่จำนวนให้เอง (ไม่รู้ ≠ ศูนย์) */
  noSkuInZort?: number
  /** ท่อสะท้อนกลับว่ารับตัวกรองช่องทางแล้ว — **ไม่มีคีย์นี้ = ท่อรุ่นเก่า** (ดู SERVER_FILTER) */
  channel?: string
  /** เลขของทุกแท็บจากท่อ นับจากชุดเดียวกับแถวที่ส่งมา (มีเฉพาะตอนกรองช่องทาง) */
  channelCounts?: Record<string, number>
  /** จำนวนแถวที่เข้าเงื่อนไขทั้งหมด (ของแท็บที่เปิดอยู่) — ใช้ทำเลขหน้า */
  rowsMatched?: number
  rowsReturned?: number
  checkedMarketplaces?: string[] | null
  marketplacesFailed?: Record<string, string> | null
  marketplacesNotConnected?: Record<string, string> | null
  marketplacesUnreliable?: Record<string, string> | null
  marketplacesAt?: string | null
  error?: string
}

/** ขนาดหน้าของตาราง — ใช้ทั้งตอนขอจากท่อและตอนเดินหน้า */
/* 🔢 จำนวนต่อหน้า — ZORT ให้เลือก 10/20/50/100 ทุกจอรายการ
   เส้นนี้ยิง `list=stock` ซึ่งรับได้สูงสุด 200 ⇒ ทั้งสี่ค่าปลอดภัย */
const PAGE_เริ่มต้น = 50
/** เพดานรอบดึงของ **ทางถอย** (ท่อรุ่นเก่าที่ยังไม่รับ channel) · 2,672 ÷ 200 = 14 หน้า เผื่อโต 50% */
const SWEEP_PAGE = 200
const MAX_PAGES = 20

/* เรียงและสะกดตามแท็บในภาพ 83: Shopee · Lazada · Tiktok Shop
   "เว็บร้าน" เป็นของเกินผัง (ZORT ไม่มีช่องทางนี้) — เก็บไว้เพราะเว็บเราคือช่องทางขายจริง */
const PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'lazada', label: 'Lazada' },
  { id: 'tiktok', label: 'Tiktok Shop' },
  { id: 'gucut', label: 'เว็บร้าน' },
]

export default function MarketplaceProductsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [meta, setMeta] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(0)
  const [PAGE, setPAGE] = useState(PAGE_เริ่มต้น)
  /** จำนวนต่อหน้าที่ยิงไปจริงล่าสุด (เหตุผลเดียวกับจอขนส่ง/เอกสารบัญชี) */
  const perRef = useRef(PAGE_เริ่มต้น)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ดึงไม่ครบทุกหน้า — ต้องบอก ไม่ใช่เงียบ (ตัวเลขที่ไม่ครบต้องประกาศขอบเขตตัวเอง) */
  const [partial, setPartial] = useState(false)
  /** 🔴 **ทางถอย: ท่อรุ่นเก่ายังไม่รับ channel ⇒ จอกวาดทั้งคลังมานับเองเหมือนเดิม**
   *  ต้องประกาศตัวบนจอเสมอ ไม่ใช่ถอยเงียบ ๆ — ทางถอยที่เงียบจะกลายเป็นทางหลัก
   *  โดยไม่มีใครตัดสินใจ (กฎ fallbacks-must-announce) · วันที่ท่อขึ้นของใหม่ ป้ายนี้หายเอง */
  const [serverFilter, setServerFilter] = useState<boolean | null>(null)
  /** เลขแท็บจากท่อ (นับจากชุดเดียวกับแถว) — null = ยังไม่รู้ ⇒ ใช้ของที่นับเองแทน */
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  /** จำนวนแถวของแท็บที่เปิดอยู่ตามที่ท่อบอก — ใช้ทำเลขหน้าในโหมดท่อ */
  const [matched, setMatched] = useState<number | null>(null)

  /* โหลดหน้าที่คนเปิดดูจริงเท่านั้น (โหมดท่อ) — ไม่กวาดทั้งคลังมานับในเบราว์เซอร์อีก
     ⚠️ ส่ง q ให้ท่อด้วย ไม่กรองในจอ ไม่งั้น "หน้า 1 จาก N" จะนับจากของที่ยังไม่ได้กรอง */
  /* ⚠️ รับจำนวนต่อหน้าเป็นพารามิเตอร์ ไม่อ่านจาก state (setState ยังไม่มีผลในรอบเดียวกัน) */
  const load = useCallback(async (tabNow = tab, pageNow = 0, qNow = q, ขนาด?: number) => {
    setLoading(true)
    setError('')
    setPartial(false)
    const ต่อหน้า = ขนาด ?? perRef.current
    const qs = new URLSearchParams({ list: 'stock', marketplaces: '1', limit: String(ต่อหน้า), offset: String(pageNow * ต่อหน้า) })
    if (qNow.trim()) qs.set('q', qNow.trim())
    if (tabNow !== 'all') qs.set('channel', tabNow)
    try {
      const d: Resp = await fetch(`/api/web/core?${qs}`).then((r) => r.json())
      if (d?.error) throw new Error(d.error)
      /* 🔑 **ด่านแยกว่าท่อกรองให้จริงไหม** — ถาม "ท่อสะท้อนคีย์ channel กลับมาไหม"
         ห้ามเดาจาก 200 เพราะท่อรุ่นเก่าก็ตอบ 200 แต่ส่งของทั้งคลังมาให้
         (ถ้าเชื่อ 200 = จอจะโชว์ของทั้งคลังใต้หัวแท็บ Shopee โดยดูปกติทุกประการ) */
      const ok = tabNow === 'all' ? typeof d.rowsMatched === 'number' : d.channel === tabNow
      if (!ok) { await sweep(); return }
      setServerFilter(true)
      setRows(Array.isArray(d.rows) ? d.rows : [])
      setMeta(d)
      setMatched(typeof d.rowsMatched === 'number' ? d.rowsMatched : null)
      if (d.channelCounts) setCounts(d.channelCounts)
      setPage(pageNow)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setRows([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [tab, q]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── ทางถอย: กวาดทั้งคลังแล้วนับเองในเบราว์เซอร์ (วิธีเดิมก่อน 11 ก.ย. 2569) ──
     เก็บไว้เพราะจอกับท่อ deploy คนละรอบเสมอ — แต่ **ต้องขึ้นป้ายบนจอว่ากำลังถอย** */
  const sweep = useCallback(async () => {
    setServerFilter(false)
    setCounts(null)
    setMatched(null)
    const all: Row[] = []
    let first: Resp | null = null
    let p = 0
    for (; p < MAX_PAGES; p++) {
      const url = `/api/web/core?list=stock&marketplaces=1&limit=${SWEEP_PAGE}&offset=${p * SWEEP_PAGE}`
      const d: Resp = await fetch(url).then((r) => r.json())
      if (d?.error) throw new Error(d.error)
      if (!first) first = d
      const got = Array.isArray(d.rows) ? d.rows : []
      all.push(...got)
      if (got.length < SWEEP_PAGE) break
    }
    if (p >= MAX_PAGES) setPartial(true)
    setRows(all)
    setMeta(first)
    setPage(0)
  }, [])

  /* ท่อคืน channelCounts (เลขครบทุกแท็บ) **เฉพาะตอนที่ถูกถามแบบมีตัวกรองช่องทาง**
     เพราะตอนนั้นเท่านั้นที่มันถือชุดเต็มอยู่ในมือ ⇒ จอต้องถามให้ครั้งหนึ่ง
     ⚠️ ขอ limit=1 เพราะเราต้องการแค่ตัวนับ ไม่ได้ต้องการแถว (แถวมาจากคำขอหลัก)
     ⚠️ ล้มเหลว = ปล่อยให้เป็น undefined ⇒ แท็บไม่มีตัวเลข **ห้ามเดาเลขมาเติม** */
  const loadCounts = useCallback(async () => {
    try {
      const d: Resp = await fetch('/api/web/core?list=stock&marketplaces=1&limit=1&channel=none').then((r) => r.json())
      if (d?.channelCounts) setCounts(d.channelCounts)
    } catch { /* ไม่มีเลขดีกว่าเลขผิด */ }
  }, [])

  useEffect(() => { load('all', 0, ''); loadCounts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* 🔴 **เลขบนแท็บ: ไม่รู้ = ไม่โชว์เลข ห้ามนับจากแถวที่โหลดมาหน้าเดียว**
     บั๊กที่เจอบน production 12 ก.ย. 2569 (CEO เปิดจอจริงแล้วจับได้):
     โหมดท่อโหลดมาแค่หน้าละ 50 แถว แต่โค้ดเดิมตกไปนับจาก `rows` เมื่อยังไม่มี channelCounts
     ⇒ ได้ Shopee 9 · Lazada 8 · Tiktok 7 ทั้งที่ของจริง 76 · 1,657 · 62
     **ผิดแบบดูสมเหตุสมผล** ซึ่งอันตรายกว่าจอช้า เพราะคนอ่านแล้วเชื่อ
     (ของเดิมนับถูกเพราะกวาดทั้งคลัง ⇒ รอบนี้เร็วขึ้นแต่เลขผิด = แย่กว่าเดิม)
     ⇒ กติกา: นับเองได้เฉพาะตอนที่ `rows` คือทั้งคลังจริง ๆ (โหมดทางถอย) เท่านั้น
        โหมดท่อยังไม่ได้เลขจากท่อ = คืน undefined ⇒ แท็บไม่โชว์ตัวเลข (ดีกว่าโชว์เลขผิด) */
  const countOn = (id: string): number | undefined => {
    if (counts && typeof counts[id] === 'number') return counts[id]
    if (serverFilter === false) return rows.filter((r) => (r.marketplaces ?? []).includes(id)).length
    return undefined
  }
  const noneCount = counts && typeof counts.none === 'number' ? counts.none
    : serverFilter === false ? rows.filter((r) => (r.marketplaces ?? []).length === 0).length
      : undefined

  /* โหมดท่อ: ท่อกรอง+แบ่งหน้ามาแล้ว จอแสดงตามนั้นตรง ๆ ห้ามกรองซ้ำ
     โหมดทางถอย: กรองในจอเหมือนเดิม */
  const needle = q.trim().toLowerCase()
  const inTab = serverFilter ? rows
    : tab === 'all' ? rows
      : tab === 'none' ? rows.filter((r) => (r.marketplaces ?? []).length === 0)
        : rows.filter((r) => (r.marketplaces ?? []).includes(tab))
  const filtered = serverFilter || !needle
    ? inTab
    : inTab.filter((r) => String(r.sku ?? '').toLowerCase().includes(needle)
      || String(r.name ?? '').toLowerCase().includes(needle))
  const shown = serverFilter ? filtered : filtered.slice(page * PAGE, page * PAGE + PAGE)
  /** จำนวนทั้งหมดของแท็บที่เปิดอยู่ — โหมดท่อเอาจาก rowsMatched · ทางถอยนับจากชุดที่กวาด */
  const totalInTab = serverFilter ? (matched ?? shown.length) : filtered.length
  const pageCount = Math.max(1, Math.ceil(totalInTab / PAGE))
  const goTab = (id: string) => { setTab(id); setPage(0); if (serverFilter !== false) load(id, 0, q); }
  const goPage = (next: number) => { setPage(next); if (serverFilter) load(tab, next, q) }
  /* 🔴 **เคยยิงท่อทุกตัวอักษรที่พิมพ์ ⇒ พิมพ์ได้ตัวเดียวแล้วโฟกัสหลุด** (แก้ 18 ก.ย. 2569)
     เดิม `onChange` เรียก `load()` ทุกครั้ง ⇒ `loading` เป็น true ⇒ บล็อก `{!loading && …}`
     ที่ครอบทั้งจอ (รวม **ช่องค้นหาเอง**) ถูกถอดทิ้ง ⇒ ช่องหาย ⇒ ตัวอักษรที่สองไม่เข้า
     🔬 วัดจริง: พิมพ์ "ทดสอบABC123" ได้ `'ท'` · `document.activeElement` = `BODY`
     🔑 เจอด้วย `scripts/ทดสอบพิมพ์ลงช่อง.py` โหมด `ทุกจอ` — **ด่านสแกนโครงสร้างไม่มีทางเจอ**
        เพราะไม่มีคอมโพเนนต์ซ้อนในเลย ต้นเหตุคือ **ตัวจอเองถอดลูกทิ้งตอนโหลด**
     ⇒ แก้ให้ `onChange` แค่จำคำที่พิมพ์ · **ยิงท่อตอนกด Enter / กดค้นหา** เท่านั้น
        (ท่าเดียวกับจอรายการขาย และตรงกับ ZORT ที่มีปุ่มค้นหา)
     ผลพลอยได้: เลิกยิงท่อ 1 คำขอต่อ 1 ตัวอักษร */
  const goSearch = (v: string) => { setQ(v); setPage(0) }
  /** ยิงจริง — ใช้ตอนกด Enter หรือกดล้างคำค้น */
  const doSearch = (v: string) => { setQ(v); setPage(0); if (serverFilter) load(tab, 0, v) }

  return (
    <div className="p-4 md:p-6">
      {/* ผังภาพ 83: breadcrumb กลับไป Marketplace Dashboard อยู่เหนือหัวจอ */}
      <Link href="/core/marketplace" className="text-[12.5px] text-blue-600 hover:underline">‹ Marketplace Dashboard</Link>
      <PageHead
        title="สินค้าบน Marketplace"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามโชว์จำนวนรหัส — จะอ่านเป็น "คลังว่าง" ทั้งที่แค่ดึงไม่ได้ */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            : loading
            ? 'กำลังไล่ทุกหน้า…'
            : (
              <>
                {/* 🔴 **ไม่มีเลขจากท่อ = ไม่โชว์เลข** ห้ามถอยไปนับจาก rows
                    ในโหมดท่อ rows คือหน้าเดียว (50 แถว) ⇒ จะได้ "จำนวน 50 รหัสในคลัง"
                    ซึ่งผิดแบบดูสมเหตุสมผล — คลาสเดียวกับเลขแท็บที่เพิ่งแก้ไปเมื่อเช้า
                    ⚠️ total ของท่อ **ไม่ถูกกรองด้วยช่องทาง** (ยืนยันจากโค้ดท่อ 12 ก.ย. 2569)
                       ⇒ กดแท็บ Shopee แล้วหัวจอยังเป็นยอดทั้งคลังตามเดิม ถูกต้องแล้ว */}
                {typeof meta?.total === 'number'
                  ? <>จำนวน {fmtNum(meta.total)} รหัสในคลัง</>
                  : <span className="text-gray-400">ยังไม่รู้จำนวนรหัสในคลัง (ท่อไม่ได้ส่งยอดรวมมา)</span>}
                {' | '}
                <span className="text-gray-400">
                  ลงขายอยู่จริงบนแต่ละเจ้า — ไม่ใช่ &ldquo;เชื่อมต่อไว้&rdquo; แบบที่ ZORT นับ
                </span>
              </>
            )
        }
        actions={
          <>
            <BtnGhost onClick={() => { load(tab, page, q); loadCounts() }} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* 📤 **ZORT มีปุ่มนี้จริงที่จอเดียวกัน** — เปิดดู `/Marketplace/list` ของเขา 18 ก.ย. 2569
                เห็นปุ่ม "Export to Excel" ⇒ อันนี้คือการทำตามผังเขาจริง
                (ต่างจากจอวางแผนสั่งซื้อที่เขาไม่มีปุ่มนี้ — ตรวจแล้วเหมือนกัน)
                ⚠️ ไฟล์ต้องกรองด้วย **แท็บช่องทางเดียวกับที่จอกำลังโชว์** ไม่งั้นไฟล์กับจอคนละชุด
                ⚠️ ตารางนี้ไม่มีข้อมูลส่วนบุคคล (รหัส/ชื่อสินค้า/จำนวน/ช่องทาง) ⇒ ส่งออกได้ */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: 'สินค้าบนมาร์เก็ตเพลส',
                /* 🔴 **ไฟล์เดินไปไกลกว่าจอ** — คนเปิดไฟล์ไม่เห็นแถบเตือนบนจอ
                   ⇒ ถ้าแท็บ "ยังไม่ได้ลงขาย" ถูกดึงตอนที่ยังไม่รู้สถานะครบทุกช่องทาง
                      ชื่อขอบเขตต้องบอกเองว่าเชื่อไม่ได้ ไม่ใช่เขียนว่า "ยังไม่ได้ลงขายที่ไหนเลย" เฉย ๆ
                   (กติกาข้อ 2 ของท่านประธาน: ข้อมูลไม่สมบูรณ์ห้ามออกเป็นไฟล์ที่อ้างว่าสมบูรณ์) */
                scope: tab === 'all' ? 'ทุกช่องทาง'
                  : tab === 'none'
                    ? (Object.keys(meta?.marketplacesFailed ?? {}).length
                        || Object.keys(meta?.marketplacesNotConnected ?? {}).length
                        ? `ยังไม่ได้ลงขายที่ไหนเลย — ⚠️ รอบนี้ยังไม่รู้สถานะครบทุกช่องทาง (${[
                            ...Object.keys(meta?.marketplacesFailed ?? {}).map((x) => `${x} ดึงไม่สำเร็จ`),
                            ...Object.keys(meta?.marketplacesNotConnected ?? {}).map((x) => `${x} ยังไม่เชื่อมร้าน`),
                          ].join(' · ')}) ⇒ รายการนี้รวมรหัสที่ยังไม่รู้สถานะไว้ด้วย`
                        : 'ยังไม่ได้ลงขายที่ไหนเลย')
                    : `ช่องทาง ${tab}`,
                title: 'สินค้าบนมาร์เก็ตเพลส',
                /* 🔴 ขอบเขตต้องอยู่ในหัวไฟล์ (CTO กำชับข้อ 5 · 18 ก.ย. 2569) — จอนี้อ่านจาก
                   ทะเบียนสินค้าเหมือนจอคลัง ⇒ สินค้าที่ยังไม่ได้ตั้งรหัสไม่อยู่ในไฟล์นี้ */
                note: skuScopeNote(meta?.noSkuInZort),
                filters: [
                  ['แท็บช่องทาง', tab === 'all' ? 'ทั้งหมด' : tab === 'none' ? 'ยังไม่ได้ลงขายที่ไหนเลย' : tab],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({
                    list: 'stock', marketplaces: '1', limit: String(limit), offset: String(offsetAt),
                  })
                  if (tab !== 'all') qs.set('channel', tab)
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return {
                    rows: (Array.isArray(d.rows) ? d.rows : []) as Row[],
                    total: typeof d.total === 'number' ? d.total : null,
                  }
                },
                header: ['รหัสสินค้า', 'ชื่อสินค้า', 'คงเหลือ', 'พร้อมขาย', 'ลงขายที่ช่องทาง', 'สถานะ'],
                /* ⚠️ ช่องที่ท่อไม่ส่ง = เว้นว่าง ห้ามแทนด้วยขีดหรือ 0 */
                toRow: (r: Row) => [
                  r.sku, r.name ?? null,
                  typeof r.qty === 'number' ? r.qty : null,
                  typeof r.available === 'number' ? r.available : null,
                  (r.marketplaces ?? []).join(' · ') || null,
                  r.active === false ? 'ปิดใช้งาน' : 'ใช้งาน',
                ],
              }}
            />
          </>
        }
      />

      {error && <ErrorBox title="ดึงรายการสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && rows.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          <MarketUnreliableBanner unreliable={meta?.marketplacesUnreliable} />

          {/* 🔴 **แท็บ "ยังไม่ได้ลงที่ไหนเลย" เป็นคำกล่าวอ้างเรื่องสินค้า ไม่ใช่เรื่องการโหลด**
              (ใบ t_mu7sk8r9 · 19 ก.ย. 2569 — กวาดคลาส `?? []` บนข้อมูลนอกบ้าน)
              แท็บนี้คัดด้วย `(r.marketplaces ?? []).length === 0`
              ⇒ **รหัสที่ยังไม่รู้ว่าลงขายไหม** (เพราะเจ้านั้นดึงไม่สำเร็จ หรือยังไม่ได้เชื่อมร้าน)
                 จะตกลงมาอยู่กองเดียวกับ **รหัสที่รู้แน่ว่าไม่ได้ลงขาย**
              ⇒ ยิ่งช่องทางล่มเยอะ ตัวเลขแท็บนี้ยิ่งพอง และมันพองเป็น **งานที่ไม่มีอยู่จริง**
                 (ของจริงวันนี้: กอง "ไม่ได้ลงขายเลย" มี 613 รหัส — ถ้าอ่านผิดคือส่งคนไปไล่ลงขาย 613 ตัว)
              ⚠️ คำเตือนเรื่องช่องทางที่ดึงไม่สำเร็จ **มีอยู่แล้ว** แต่อยู่ใต้ตารางด้วยสีเทาเล็ก
                 ⇒ ของที่ทำให้ตัวเลขเชื่อไม่ได้ ต้องอยู่**เหนือ**ตัวเลข ไม่ใช่ใต้ตาราง
                 (บทเรียนเดียวกับติ๊กเขียวที่จอดันสต็อกเมื่อเช้า) */}
          {tab === 'none' && (() => {
            const ล้ม = Object.keys(meta?.marketplacesFailed ?? {})
            const ยังไม่เชื่อม = Object.keys(meta?.marketplacesNotConnected ?? {})
            /* 🔴 **ไม่มีคีย์เลย = ท่อรุ่นเก่า ≠ ทุกช่องทางปกติ** (ฝั่งท่อแก้ให้ 19 ก.ย. 2569)
               สาเหตุเดิมที่คีย์หาย: ค่าเป็น `undefined` แล้ว `JSON.stringify` **ทิ้งคีย์ทั้งคีย์**
               ⇒ ฝั่งท่อนึกว่าส่งอยู่ตลอดมา · ตอนนี้ส่งเป็น `{}` เมื่อว่าง
               ⇒ จอจึงแยกได้: มีคีย์+ว่าง = ตรวจครบทุกช่องทางแล้วไม่มีปัญหา
                  · ไม่มีคีย์ = **ท่อรุ่นเก่า ยังไม่รู้** ⇒ ต้องบอก ไม่ใช่เงียบ */
            const ท่อบอกสถานะได้ = meta != null
              && ('marketplacesFailed' in meta || 'marketplacesNotConnected' in meta)
            if (!ท่อบอกสถานะได้) {
              return (
                <div className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-2 leading-relaxed">
                  ⚠️ ท่อรุ่นที่เสิร์ฟอยู่<b>ยังไม่บอกสถานะช่องทาง</b> ⇒ แท็บนี้อาจรวมรหัสที่ยังไม่รู้ไว้ด้วย
                  {' '}— <b>ไม่ได้แปลว่าทุกช่องทางปกติ</b>
                </div>
              )
            }
            if (!ล้ม.length && !ยังไม่เชื่อม.length) return null
            return (
              <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-2 leading-relaxed">
                ⚠️ <b>รอบนี้ยังไม่รู้สถานะครบทุกช่องทาง ⇒ แท็บนี้อ่านว่า “ไม่ได้ลงขาย” ไม่ได้</b>
                {ล้ม.length > 0 && <span className="block">· ดึงไม่สำเร็จ: <b>{ล้ม.join(' · ')}</b></span>}
                {ยังไม่เชื่อม.length > 0 && <span className="block">· ยังไม่ได้เชื่อมร้าน: <b>{ยังไม่เชื่อม.join(' · ')}</b></span>}
                <span className="block">
                  ⇒ รหัสที่ <b>ยังไม่รู้</b> จะมาอยู่ในแท็บนี้ปนกับรหัสที่ <b>รู้แน่ว่าไม่ได้ลงขาย</b>
                  {' '}— ตัวเลขจึงสูงกว่าความจริงได้ · <b>อย่าเพิ่งใช้เป็นรายการงาน</b>
                </span>
              </div>
            )
          })()}

          {/* 💤 "เคยขายได้บนช่องทางนั้นแล้วเงียบ" — ท่อมีข้อมูลนี้มาตลอด ไม่มีจอไหนเคยแสดง
              CEO สั่งให้ทำ **แค่การ์ดสรุป** ไม่ใช่จอเต็ม เพราะการลงมือคืองานคน (เปิดหน้าร้านดูทีละรหัส)
              ⇒ รายละเอียดทั้งหมดและเงื่อนไขการถอดทิ้ง อยู่ในหัวไฟล์ของคอมโพเนนต์ */}
          <ChannelGapsCard />

          {/* 🔴 กำลังใช้ทางถอย = ต้องเห็น ไม่ใช่ถอยเงียบ ๆ (กฎ fallbacks-must-announce) */}
          {serverFilter === false && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>กำลังใช้วิธีเดิม: กวาดทั้งคลังมานับในเบราว์เซอร์</b> — ท่อรุ่นที่รันอยู่ยังไม่รับตัวกรองช่องทาง
              (จอถามแล้วท่อไม่ได้สะท้อนกลับมา) · ตัวเลขยังถูกต้อง แต่ช้ากว่าและกินเน็ตมากกว่า ·
              ป้ายนี้จะหายเองเมื่อท่อรุ่นใหม่ขึ้น <b>ไม่ต้องมาแก้จอ</b>
            </div>
          )}

          {/* ⚠️ ชนเพดานแล้วต้องประกาศ — เลขที่ไม่ครบต้องบอกขอบเขตตัวเอง
              (คลาสเดียวกับ truncated ของจอรายงานลูกค้า) */}
          {partial && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>ดึงมาไม่ครบทั้งคลัง</b> — หยุดที่ {fmtNum(MAX_PAGES * PAGE)} รหัสตามเพดานที่ตั้งไว้
              <b> ตัวเลขทุกตัวข้างล่างเป็นของเท่าที่ดึงมา ไม่ใช่ทั้งร้าน</b>
            </div>
          )}

          <SearchRow
            value={q}
            onChange={goSearch}
            onSubmit={() => doSearch(q)}
            placeholder="รหัสสินค้า หรือชื่อสินค้า"
            advanced={<LinkText onClick={() => doSearch('')}>ล้างคำค้น</LinkText>}
          />

          {/* ⚠️ ไม่มีตัวเลขบนแท็บ = ยังไม่ได้เลขจากท่อ **ต้องเขียนบอก** ไม่ใช่ปล่อยให้เดาเอง */}
          {serverFilter && !counts && (
            <p className="text-[11.5px] text-gray-500 mb-1">
              กำลังขอจำนวนรายช่องทางจากเซิร์ฟเวอร์… — แท็บจะยังไม่มีตัวเลขจนกว่าจะได้ของจริง
              (ไม่โชว์ตัวเลขดีกว่าโชว์เลขที่นับจากหน้าเดียว)
            </p>
          )}
          <Tabs
            tabs={[
              // ไม่มีเลขจากท่อ = ไม่ใส่ count ⇒ แท็บไม่โชว์ตัวเลข (ดีกว่าโชว์เลขของหน้าเดียว)
              { id: 'all', label: 'ทั้งหมด', count: typeof meta?.total === 'number' ? meta.total : undefined },
              ...PLATFORMS.map((p) => ({ id: p.id, label: p.label, count: countOn(p.id) })),
              // 🔴 แท็บนี้คือของที่มีค่าที่สุดในจอ — ของที่ยังไม่ได้ลงขายที่ไหนเลย
              { id: 'none', label: 'ยังไม่ได้ลงที่ไหนเลย', count: noneCount },
            ]}
            active={tab}
            onChange={goTab}
          />

          {/* 🔴 **แท็บช่องทางซ้อนกันได้ อย่าเอาไปบวก** (วัดของจริง 18 ก.ย. 2569 ด้วยการกดทีละแท็บ)
              ทั้งหมด 2,674 · Shopee 52 + Lazada 1,629 + TikTok 43 + เว็บร้าน 2,010 + ยังไม่ได้ลง 580 = 4,314
              ⇒ ต่างกัน 1,640 ซึ่ง **ถูกต้องแล้ว** เพราะสินค้าตัวเดียวลงได้หลายช่องทาง
              ⚠️ แต่แท็บที่วางเรียงกันในแถบเดียว **สื่อว่าแยกกันคนละกอง** ⇒ คนบวกแล้วคิดว่าตัวเลขเพี้ยน
                 หรือแย่กว่านั้นคือเชื่อว่าเรามีสินค้า 4,314 รายการ
              🔑 กติกาเดียวกับ "อย่าเอาเลขคนละแหล่งมาวางคู่กัน" — ที่นี่แหล่งเดียวกัน แต่ **คนละแกน** */}
          <p className="text-[11.5px] text-gray-500 mt-1">
            ℹ️ แท็บช่องทาง<b>ซ้อนกันได้</b> — สินค้าตัวเดียวลงหลายช่องทางพร้อมกันได้
            ⇒ <b>อย่าเอาตัวเลขของแต่ละช่องทางมาบวกกัน</b> (จะเกินจำนวนสินค้าจริง)
          </p>

          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  {/* ผังภาพ 83: "ลิงก์ Marketplace" — เราไม่มี URL รายตัว (API ไม่ส่ง)
                      ใช้โลโก้บอกว่าลงที่ไหนแทน ซึ่งตอบคำถามเดียวกัน · คอลัมน์คงเหลือเป็นของเกินผัง เก็บไว้ */}
                  <th className={TH}>ลิงก์ Marketplace</th>
                  <th className={TH} title="ZORT มีสวิตช์เปิด/ปิดวางจำหน่าย — ของเราอ่านได้อย่างเดียว สั่งเปิดปิดต้องทำใน ZORT">วางจำหน่ายสินค้า ⓘ</th>
                  <th className={THR}>คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={6} icon="🛍" title="ไม่พบสินค้าในเงื่อนไขนี้"
                    detail={needle ? 'ลองพิมพ์คำสั้นลง' : 'ลองเปลี่ยนแท็บช่องทาง'} />
                )}
                {shown.map((r, i) => (
                  <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{page * 50 + i + 1}</td>
                    <td className={TD}>
                      <Link href={`/core/stock/${encodeURIComponent(r.sku)}`}
                        className="text-blue-600 hover:underline font-medium">{r.sku}</Link>
                    </td>
                    <td className={`${TD} max-w-[380px] truncate`} title={r.name}>{r.name}</td>
                    <td className={TD}>
                      {(r.marketplaces ?? []).length > 0
                        ? <MarketLogos list={r.marketplaces} by={r.marketplacesBy} from={r.marketplacesFrom} />
                        : <span className="text-gray-300">ยังไม่ได้ลง</span>}
                    </td>
                    <td className={TD}>
                      {/* "วางจำหน่าย" ตามข้อมูลจริงที่มี: active จากทะเบียนสินค้า —
                          อ่านอย่างเดียว (สวิตช์จริงอยู่ใน ZORT) · ไม่รู้ = ขีด ไม่เดา */}
                      {typeof r.active === 'boolean'
                        ? (r.active
                          ? <span className="inline-block text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">วางจำหน่าย</span>
                          : <span className="inline-block text-[11.5px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">ปิดการขาย</span>)
                        : <span className="text-gray-300" title="ทะเบียนสินค้าไม่ได้บอกสถานะตัวนี้มา">—</span>}
                    </td>
                    <td className={TDR}>{fmtNum(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {totalInTab === 0 ? 0 : fmtNum(page * PAGE + 1)}–{fmtNum(Math.min(page * PAGE + shown.length, totalInTab))}
                {' '}จาก {fmtNum(totalInTab)} รหัส
                {' '}· <MarketCoverage checked={meta?.checkedMarketplaces}
                  failed={meta?.marketplacesFailed} notConnected={meta?.marketplacesNotConnected}
                  at={meta?.marketplacesAt} />
              </span>
              {/* เลขหน้าแบบ ZORT — จอนี้นับหน้าเป็น index (0 = หน้าแรก) ⇒ แปลง offset ↔ index ที่จุดเดียว */}
              <PageNav offset={page * PAGE} perPage={PAGE} rowsOnPage={shown.length}
                /* เปลี่ยนจำนวนต่อหน้า ⇒ กลับหน้าแรก + ส่งค่าใหม่เข้าไปในคำสั่งโหลด */
                onPerPage={(n) => { setPAGE(n); setPage(0); void load(tab, 0, q, n) }}
                total={totalInTab} disabled={loading}
                onGo={(off) => goPage(Math.max(0, Math.floor(off / PAGE)))} />
            </div>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            {serverFilter
              ? <>✅ <b>ท่อกรองและนับให้ที่เดียว</b> (11 ก.ย. 2569) — จอโหลดเฉพาะหน้าที่เปิดดูจริง
                เลขบนแท็บกับแถวในตารางมาจาก<b>ชุดเดียวกัน</b> จึงไม่มีทางไม่ตรงกัน ·</>
              : <>⚠️ โหมดนี้จอไล่ดึง<b>ทุกหน้า</b>ก่อนนับ ไม่ใช่หน้าแรกหน้าเดียว — วัดจริง 5 ก.ย. 2569
                หน้าแรก 200 แถวให้ Shopee 11 รหัส แต่ทั้งคลังได้ 76 ⇒ <b>หน้าแรกไม่ใช่ตัวแทน</b> ·</>}
            ตัวเลขชุดเดียวกับคอลัมน์ Marketplace ในจอสินค้า <b>สองจอต้องตรงกันเสมอ</b> ·
            ผังตามภาพจริง 83 (7 ก.ย. 2569) — จอ ZORT ของจริง<b>ว่างเปล่า 0 รายการ</b>
            ข้อมูลของเราจึงเกินผังโดยธรรมชาติ · &ldquo;ลิงก์ Marketplace&rdquo; ของ ZORT เป็น URL รายตัว
            ซึ่ง API ไม่ส่งมา — เราใช้โลโก้บอกว่าลงที่ไหนแทน
          </p>
        </>
      )}
    </div>
  )
}
