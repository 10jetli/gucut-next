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
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import { productMenuItems } from '@/lib/product-menu'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, Num, BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, MarketLogos, MarketCoverage, MarketUnreliableBanner,
} from '@/components/zort'

interface Row {
  sku: string; name: string; qty: number; price: number; sold: number
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
  /** จำนวนแถวของแท็บที่เลือกอยู่ — ใช้ทำเลขหน้า ห้ามใช้ total ตอนอยู่แท็บ out/low */
  shown?: number
  /** 🔴 สินค้าใน ZORT ที่ **ไม่มีรหัสสินค้า** จึงเก็บเข้าคลังเงาไม่ได้เลยโดยโครงสร้าง
   *  (คลังเงาใช้ SKU เป็นกุญแจหลัก) — 226 ตัวจาก 2,898 · **สต็อกเป็นศูนย์ทั้งหมด มูลค่า ฿0**
   *  ⚠️ ต้องเขียนบนจอเสมอ ไม่งั้นคนเปิดเทียบกับ ZORT จะเห็นเลขต่างกัน 226 โดยไม่มีคำอธิบาย
   *     กฎเดียวกับของทดสอบที่ซ่อน: **ซ่อนได้ แต่ต้องบอกว่าซ่อน** */
  noSkuInZort?: number
  /** จำนวนสินค้าทั้งหมดที่ ZORT มี (รวมตัวที่ไม่มีรหัส) */
  zortTotal?: number
  limit: number; offset: number; rows: Row[]
}

const PAGE = 50
const SORTS = [
  { id: 'qty', label: 'ของใกล้หมดก่อน' },
  { id: 'sold', label: 'ขายดีก่อน' },
  { id: 'sku', label: 'เรียงตามรหัส' },
]

export default function CoreStockPage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('qty')
  const [tab, setTab] = useState<'all' | 'out' | 'low' | 'active' | 'inactive'>('all')
  // ⚠️ ค่าตั้งต้นซ่อน "บริการ" (ค่าส่ง · ค่าซ่อม · ค่าน้ำมัน ฯลฯ) ออกจากจอสินค้า
  //    เพราะของพวกนี้ไม่มีสต็อกจริง แต่ติดลบหนัก (-712 · -200) เลยยึดสองแถวบนสุด
  //    ของแท็บ "ของหมด" ⇒ จอที่คนเปิดดูว่า "ต้องสั่งอะไร" ขึ้นของที่สั่งไม่ได้ก่อน
  // ⚠️ **แต่ต้องไม่ซ่อนเงียบ** — เขียนบนจอว่าซ่อนอะไรไว้กี่รายการ + กดกลับได้
  //    ไม่งั้นวันหนึ่งจะมีคนหา "ค่าบริการซ่อม" แล้วไม่เจอ นึกว่าข้อมูลหาย
  const [kind, setKind] = useState<'goods' | 'all'>('goods')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // ⚠️ ค่าเริ่มต้นคือซ่อน — แต่ต้องกดดูได้เสมอ ของที่ซ่อนแล้วเปิดดูไม่ได้คือของที่หายไป
  const [showTest, setShowTest] = useState(false)
  // รูปสินค้า — โหลดแผนที่ SKU→ไฟล์ครั้งเดียวต่อการเปิดเว็บ
  const imgOf = useSkuImages()

  const load = useCallback(async (off = 0, sortId = sort, tabId = tab, kindId = kind) => {
    setLoading(true)
    setError('')
    try {
      // ⚠️ `marketplaces=1` ต้องส่งเสมอ ไม่งั้นคอลัมน์ Marketplace ว่างทุกแถวแบบเงียบ ๆ
      //    (ยิงของจริงเทียบแล้ว: ไม่ส่ง → marketplaces:null · ส่ง → ['shopee'] · 3 ก.ย. 2569)
      const qs = new URLSearchParams({
        list: 'stock', sort: sortId, limit: String(PAGE), offset: String(off), marketplaces: '1',
      })
      // กรองฝั่งเซิร์ฟเวอร์แล้ว — แท็บจึงกรองทั้งคลังจริง ไม่ใช่แค่หน้าที่กำลังดู
      if (tabId !== 'all') qs.set('only', tabId)
      if (kindId === 'goods') qs.set('kind', 'goods')
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, sort, tab, kind])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  const inTab = data?.shown ?? data?.total ?? 0
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้า"
        summary={
          data ? (
            <>
              {/* ⚠️ **รูปประโยคนี้ลอกจาก ZORT เป๊ะ** — "จำนวน N รายการ | ลิงก์ | ลิงก์"
                  เจ้าของร้านสั่ง 3 ก.ย. 2569 ให้ถอดของที่เราเพิ่มเองออกทั้งหมด
                  (ของหมด · เหลือน้อย · มูลค่าสต็อก) ⇒ ย้ายคำอธิบายส่วนต่างไปใต้ตาราง */}
              จำนวน {data.total.toLocaleString('th-TH')} รายการ
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
                  ไม่ใช่ให้คนไปสงสัยเอาเองว่าข้อมูลหาย */}
              {Number(data.noSkuInZort) > 0 && (
                <span className="text-gray-400">
                  {' '}(ZORT มี {(data.zortTotal ?? 0).toLocaleString('th-TH')} — ที่ขาดคือสินค้า
                  {' '}<b>ไม่มีรหัส {Number(data.noSkuInZort).toLocaleString('th-TH')} ตัว</b> สต็อกเป็นศูนย์ทั้งหมด)
                </span>
              )}
              {' | '}
              <Link href="/core/soon/product-image" className="text-blue-600 hover:underline">จัดการรูปภาพสินค้า</Link>
              {' | '}
              <Link href="/core/soon/product-cost" className="text-blue-600 hover:underline">ปรับต้นทุนสินค้า</Link>
            </>
          ) : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* ⚠️ ปุ่มสองอันนี้มีใน ZORT — ทำให้ผังเหมือน แต่ **กดแล้วต้องไม่โกหก**
                จึงพาไปหน้าที่บอกตรง ๆ ว่ายังไม่ได้ทำ และตอนนี้ให้ไปทำที่ไหน */}
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/product-add"
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

      {/* 🔴 คำเตือนว่าข้อมูลเชื่อไม่ได้ — **ต้องอยู่หัวจอ เหนือตาราง**
          เคยวางท้ายตารางแล้วไม่มีใครเห็น แม้แต่คนที่ตั้งใจหา (4 ก.ย. 2569) */}
      <MarketUnreliableBanner unreliable={data?.marketplacesUnreliable} />

      {error && <ErrorBox title="ดึงสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

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

          <TableWrap>
            <table className="w-full min-w-[920px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>ราคาซื้อ</th>
                  <th className={THR}>ราคาขาย</th>
                  <th className={THR}>คงเหลือ</th>
                  <th className={THR}>พร้อมขาย</th>
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
                        {imgOf(r.sku)
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgOf(r.sku) as string}
                              alt=""
                              loading="lazy"
                              className="w-10 h-10 rounded border border-gray-200 object-cover bg-white shrink-0"
                            />
                          )
                          : <span className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0" />}
                        <span className="min-w-0">
                      {/* 🔴 เคยเป็น span สีฟ้าที่กดไม่ได้ — เจ้าของร้านกดจากมือถือ 5 จุดแล้วแจ้งว่า
                          "กดเข้าสินค้าไม่ได้เลย" · **สีฟ้าในตาราง = สัญญาว่ากดได้**
                          แก้โดยทำหน้าจริงขึ้นมา ไม่ใช่ถอดสีฟ้าออก (3 ก.ย. 2569) */}
                      <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                        {r.name || '—'}
                      </Link>
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
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= inTab}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          </TableWrap>
        </>
      )}
    </div>
  )
}
