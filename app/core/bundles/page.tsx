'use client'
// สินค้าเป็นชุด — **หน้าตาลอกจาก `zort-ui/29-zort-สินค้าเป็นชุด-360รายการ.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ" → ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มสินค้าเป็นชุดใหม่
//      → ช่องค้นหา → ตาราง # · รหัส · สินค้าเป็นชุด(รูป+ชื่อ) · ราคาสินค้ารวม ·
//        ราคาขาย · คงเหลือ · พร้อมขาย · วันหมดอายุรายการ · สถานะ · ⋮
// ⚠️ จำนวนมีหน่วย **SET** ต่อท้าย และเลขติดลบเป็นสีแดง (ของจริงมีติดลบอยู่หลายชุด)
//
// 🔴 **สองข้อที่ต้องเขียนบนจอ ห้ามข้าม**
//  1. **ดึงรายการสินค้าในชุดจาก ZORT ไม่ได้** — ⚠️ **เหตุผลไม่ใช่ "ไม่มีเส้น"** (แก้คำ 6 ก.ย. 2569)
//     `Bundle/GetBundleDetail` **มีอยู่จริง** แต่ยิงด้วยรหัสจริงแล้ว **ส่ง `list` ว่างกลับมา**
//     ⇒ **"เส้นมีอยู่" ไม่ได้แปลว่า "ได้ข้อมูล"** — สองอย่างนี้ต้องเขียนแยก
//     ไม่งั้นคนรอบหน้าเห็นว่าเส้นมี แล้วนึกว่าเราแค่ยังไม่ได้เขียนโค้ดเรียก
//     ⇒ เรารู้ว่ามีชุดอะไร ราคาเท่าไหร่ เหลือกี่ชุด **แต่ไม่รู้ว่าในชุดมีอะไรบ้าง**
//     ⇒ คอลัมน์ "ราคาสินค้ารวม" ของ ZORT คำนวณไม่ได้เลย เพราะมันคือผลรวมราคาส่วนประกอบ
//     ⚠️ **ห้ามเดาส่วนประกอบจากชื่อชุด** — เดาผิดคือตัดสต็อกผิดตัว
//  2. **เรื่องนี้กระทบสต็อกโดยตรง** ขายชุดหนึ่งชุดต้องตัดของหลายตัว
//     ตราบใดที่คลังเงายังไม่รู้จักส่วนประกอบ การตัดสต็อกจะไม่ตรงความจริงทุกครั้งที่ขายชุด
//     (แม้แต่ ZORT เองก็มีชุดคงเหลือติดลบ แปลว่ามันก็ตามไม่ทันเหมือนกัน)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import { recipeFreshness, thaiMoment, stockSyncFreshness, agoText, STOCK_STALE_MINUTES } from '@/lib/recipe-fresh'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { MarketStaleBar } from '@/components/zort/DataFreshness'
import { useSkuImages } from '@/lib/sku-images'
import {
  PageHead, SearchRow, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, MarketLogos, MarketCoverage, MarketUnreliableBanner,
} from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'

interface Row {
  sku: string
  name: string
  sellprice?: number
  onhand?: number
  available?: number
  active?: boolean
  unit?: string
  /** ผลรวมราคาขายของส่วนประกอบ × จำนวน — **null = มีชิ้นส่วนที่ยังไม่มีราคา**
   *  ⚠️ null ไม่ใช่ 0 · ถ้าคิด 0 จะได้ราคารวมต่ำกว่าจริงแบบดูสมเหตุสมผล จับไม่ได้ด้วยตา */
  itemsValue?: number | null
  itemCount?: number
  /** ช่องทางที่ชุดนี้ลงขายอยู่จริง — ZORT โชว์โลโก้ตรงคอลัมน์ Marketplace */
  marketplaces?: string[]
  /** จับคู่รหัสได้ยังไง (`exact` | `base`) + รหัสเต็มบนแพลตฟอร์มถ้าเป็นการเดา
   *  ⚠️ ต้องโชว์ให้เห็นว่าแถวไหนมาจากการเดา — 98% ตรงตัว แต่ ~1% เดา */
  marketplacesBy?: Record<string, string>
  marketplacesFrom?: Record<string, string[]>
}
interface BundleItem { line?: number; sku: string; name: string; qty: number }
interface Resp {
  skip?: string
  total: number
  active?: number
  inactive?: number
  negative?: number
  note?: string
  /** 🔴 **สูตรเปลี่ยนล่าสุดเมื่อไหร่** ไม่ใช่ "ตรวจล่าสุด" — สูตรที่ไม่เคยเปลี่ยนจะค้างตลอดไป */
  collectedAt?: string
  recipeAt?: string | null
  /** ไปถาม ZORT ล่าสุดเมื่อไหร่ (UTC) · null = ไม่รู้ ⇒ **ห้ามเขียนว่าซิงก์หยุด** */
  recipeCheckedAt?: string | null
  /** 🔴 **ซิงก์ตัวเลขสต็อกชุด (คงเหลือ/พร้อมขาย) ครบรอบล่าสุด (UTC)** · null = ไม่รู้
   *  ⚠️ **คนละนาฬิกากับ recipeCheckedAt** — อันนั้นคือสูตร (ทุกชั่วโมง) อันนี้คือตัวเลข (ทุกครึ่งชั่วโมง)
   *     เอามาปนกันคือสิ่งที่ฝั่งท่อกำชับห้าม (ดู lib/recipe-fresh.ts) */
  stockSyncedAt?: string | null
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
  bundlesWithItems?: number
  lines?: number
  limit?: number
  offset?: number
  rows: Row[]
}

const PAGE = 50

/** จำนวนพร้อมหน่วย เช่น "15 SET" — ติดลบเป็นสีแดงเหมือน ZORT
 *
 *  🔴 `maybeNegative` = คอลัมน์ที่ **ศูนย์อาจไม่ใช่ศูนย์จริง** (ใช้กับ "พร้อมขาย" เท่านั้น)
 *     ฝั่งท่อยิงค่าดิบเทียบเมื่อ 22:10 (14 ก.ย. 2569): ชุด 00073-11.8-NW
 *     ZORT API ส่ง `availablestock = '0'` ขณะที่ **จอ ZORT เองโชว์ -10** (ทั้งรายการสรุปและรายละเอียด)
 *     สาเหตุยังไม่รู้ ⇒ ระหว่างนี้ **ห้ามปล่อยให้ 0 อ่านว่า "ยังมีของพอดี ๆ ไม่ติดลบ"**
 *     เพราะคนจะรับออเดอร์ต่อทั้งที่ของขาดอยู่ — ตระกูลเดียวกับ "ไม่รู้ถูกแสดงเป็น 0"
 *     ⚠️ ทำเป็นคำกำกับ **ไม่ใช่เดาค่าเป็น -10** — เราไม่รู้ว่าติดลบเท่าไหร่หรือติดลบจริงไหม */
function Qty({ n, unit, maybeNegative }: { n?: number; unit?: string; maybeNegative?: boolean }) {
  if (typeof n !== 'number') return <span className="text-gray-300">—</span>
  const u = (unit || 'SET').trim()
  const suspect = maybeNegative && n === 0
  return (
    <span className={n < 0 ? 'text-red-500 font-semibold' : 'text-gray-800'}>
      {fmtNum(n)}{u ? ` ${u}` : ''}
      {suspect && (
        <span className="text-amber-600 font-semibold cursor-help ml-0.5"
          title="0 อาจหมายถึงติดลบ — ZORT API ไม่ส่งค่าติดลบของพร้อมขาย (ยิงค่าดิบเทียบแล้ว 14 ก.ย. 2569: API ส่ง 0 ขณะที่จอ ZORT โชว์ -10) ⇒ ห้ามอ่านว่าของยังไม่ขาด">
          ⚠
        </span>
      )}
    </span>
  )
}

export default function CoreBundlesPage() {
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imgOf = useSkuImages()
  // ส่วนประกอบในชุด — โหลดตอนกดกางเท่านั้น (360 ชุดถ้าโหลดหมดตั้งแต่แรกคือเปล่าประโยชน์)
  const [hoverSku, setHoverSku] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, BundleItem[] | 'loading' | 'error'>>({})

  // ⚠️ ZORT โชว์รายการในชุดเป็น **ป๊อปอัพตอนเอาเมาส์ชี้ชื่อชุด** (ไม่ใช่กางแถว)
  //    และกดที่ชื่อจะไปหน้ารายละเอียดของชุด ⇒ ทำทั้งสองอย่างตามต้นแบบ
  const showItems = useCallback(async (sku: string) => {
    setHoverSku(sku)
    if (items[sku] && items[sku] !== 'error') return
    setItems((m) => ({ ...m, [sku]: 'loading' }))
    try {
      const res = await fetch(`/api/web/core?list=bundleitems&sku=${encodeURIComponent(sku)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setItems((m) => ({ ...m, [sku]: Array.isArray(d?.rows) ? d.rows : [] }))
    } catch {
      setItems((m) => ({ ...m, [sku]: 'error' }))
    }
  }, [items])

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError('')
    try {
      // ⚠️ จอนี้ต้องส่ง marketplaces=1 ถึงจะได้โลโก้ช่องทาง (ต่างจาก list=stock ที่ส่งมาให้เลย)
      const qs = new URLSearchParams({ list: 'bundles', limit: String(PAGE), offset: String(off), marketplaces: '1' })
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
  }, [q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ความสดของการซิงก์สูตรชุด — ตรรกะอยู่ที่ lib/recipe-fresh.ts ที่เดียว (มีเทสคุม)
     ⚠️ ส่ง checkedAt ก่อน changedAt **ห้ามสลับ** — สลับแล้วจอจะขึ้นว่าซิงก์หยุดทั้งที่ปกติ */
  const fresh = recipeFreshness(data?.recipeCheckedAt, data?.recipeAt ?? data?.collectedAt)
  /* 🔴 **นาฬิกาที่สอง** — ความสดของ *ตัวเลข* คงเหลือ/พร้อมขาย (คนละอันกับความสดของ *สูตร*)
     ⚠️ ห้ามส่ง recipeCheckedAt/recipeAt เข้าตัวนี้ (ฝั่งท่อกำชับ · เทสข้อ ⑤ ดักไว้) */
  const stock = stockSyncFreshness(data?.stockSyncedAt)

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้าเป็นชุด"
        /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" (แก้ 6 ก.ย. 2569) */
        summary={error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
          : data ? `จำนวน ${fmtNum(data.total)} รายการ` : 'กำลังโหลด…'}
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 ส่งออกสินค้าเป็นชุด ครบทุกหน้า
                ⚠️ **ไม่ส่ง marketplaces=1 ตอนส่งออก** — คอลัมน์ช่องทางต้องยิงถามรายตัวและช้ามาก
                   ⇒ ไฟล์ไม่มีคอลัมน์นั้น และ **เขียนบอกไว้ในหัวไฟล์** ไม่ใช่หายไปเงียบ ๆ
                ⚠️ ราคาสินค้ารวม (itemsValue) เป็น null ได้ = มีชิ้นส่วนที่ยังไม่ได้ตั้งราคา
                   ⇒ ปล่อยให้เว้นว่าง **ห้ามคิดเป็น 0** ไม่งั้นราคารวมต่ำกว่าจริงแบบดูสมเหตุสมผล */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: `สินค้าเป็นชุด-${new Date().toISOString().slice(0, 10)}`,
                title: 'สินค้าเป็นชุด',
                note: 'ไฟล์นี้ไม่มีคอลัมน์ช่องทางขาย (Marketplace) เพราะต้องยิงถามรายตัว — ดูได้บนจอ'
                  + ' · คงเหลือ/พร้อมขาย ซิงก์จาก ZORT ทุกครึ่งชั่วโมง · พร้อมขายที่เป็น 0 อาจหมายถึงติดลบ'
                  + ' (ZORT API ไม่ส่งค่าติดลบของช่องนี้)',
                filters: [['คำค้นหา', q.trim() || '(ไม่ได้ค้น)']],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'bundles', limit: String(limit), offset: String(offsetAt) })
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['รหัสชุด', 'ชื่อชุด', 'ราคาสินค้ารวม (บาท)', 'ราคาขาย (บาท)', 'คงเหลือ', 'พร้อมขาย', 'หน่วย', 'จำนวนชิ้นส่วน', 'สถานะ'],
                toRow: (r: Row) => [
                  r.sku, r.name ?? null,
                  typeof r.itemsValue === 'number' ? r.itemsValue : null,
                  typeof r.sellprice === 'number' ? r.sellprice : null,
                  typeof r.onhand === 'number' ? r.onhand : null,
                  typeof r.available === 'number' ? r.available : null,
                  r.unit || null,
                  typeof r.itemCount === 'number' ? r.itemCount : null,
                  r.active === false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน',
                ],
              }}
            />
            {/* 🔴 **ถอดปุ่ม "นำเข้าไฟล์ (Excel)" ออก** (15 ก.ย. 2569)
                เดิมชี้ไป `?kind=product` ทั้งที่จอนี้แสดงสินค้าเป็นชุด ไม่ใช่สินค้า
                ⇒ คนกดเพราะอยากนำเข้าสินค้าเป็นชุด แต่ไปโผล่หน้านำเข้า**สินค้า** ซึ่งคอลัมน์คนละชุด
                ⇒ ปุ่มที่กดแล้วเกิดอะไรขึ้นจริงแต่ไม่ใช่สิ่งที่คนตั้งใจ **หลอกกว่าปุ่มที่กดแล้วเงียบ**
                ⇒ หน้านำเข้ายังไม่รับชนิดนี้ ⇒ ไม่มีปุ่ม (ฝั่งท่อกำชับ: ชนิดที่ยังไม่รับ อย่าให้ปุ่มโผล่) */}
            <Link href="/core/bundles/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เพิ่มสินค้าเป็นชุดใหม่
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="ค้นหา รหัสชุด หรือชื่อชุด"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {/* 🔴 คำเตือนว่าข้อมูลเชื่อไม่ได้ — **ต้องอยู่หัวจอ เหนือตาราง**
          เคยวางท้ายตารางแล้วไม่มีใครเห็น แม้แต่คนที่ตั้งใจหา (4 ก.ย. 2569) */}
      <MarketUnreliableBanner unreliable={data?.marketplacesUnreliable} />

      {error && <ErrorBox title="ดึงสินค้าเป็นชุดไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          {/* 🔴 **ข้อความเดิมกลายเป็นเท็จแล้ว** — เดิมเขียนว่า "ภาพนิ่งเก็บครั้งเดียว ไม่ได้ซิงก์เอง"
              ฝั่งท่อทำให้ซิงก์สูตรทุกชั่วโมงแล้ว (gucut-web a17692b · ตรวจ 360/360 · แจ้ง 14 ก.ย. 2569)
              ⇒ ปล่อยไว้ = จอเตือนเรื่องที่ไม่มีอยู่แล้ว และคนจะไม่เชื่อคำเตือนอันอื่นด้วย
              🔴 **สองเวลาคนละเรื่อง ห้ามสลับ**: สูตรเปลี่ยนล่าสุด (ค้างได้ถ้าไม่มีใครแก้)
                 กับ ตรวจกับ ZORT ล่าสุด (อันนี้คือความสด) — ดู lib/recipe-fresh.ts */}
          <div className={`text-[12.5px] rounded-md px-3.5 py-2.5 mb-3 leading-relaxed border ${
            fresh.state === 'stale' ? 'text-amber-900 bg-amber-50 border-amber-300'
              : fresh.state === 'unknown' ? 'text-gray-700 bg-gray-50 border-gray-300'
                : 'text-emerald-900 bg-emerald-50 border-emerald-200'}`}>
            {fresh.state === 'ok' && (
              <>✅ <b>สูตรชุดซิงก์จาก ZORT อัตโนมัติทุกชั่วโมง</b> — ตรวจกับ ZORT ล่าสุด
                {' '}<b>{thaiMoment(fresh.checkedThai)}</b>{fresh.ageHours !== null && <> ({fresh.ageHours} ชม.ที่แล้ว)</>}</>
            )}
            {fresh.state === 'stale' && (
              <>🔴 <b>สูตรชุดควรซิงก์ทุกชั่วโมง แต่ตรวจล่าสุดเมื่อ {thaiMoment(fresh.checkedThai)}</b>
                {fresh.ageHours !== null && <> ({fresh.ageHours} ชม.ที่แล้ว)</>}
                {' '}⇒ <b>ตัวซิงก์น่าจะหยุด</b> · ตัวเลขที่นี่อาจเก่ากว่าของจริงใน ZORT</>
            )}
            {fresh.state === 'unknown' && (
              <>⚠️ <b>ยังไม่รู้ว่าตรวจกับ ZORT ล่าสุดเมื่อไหร่</b> (ท่อไม่ได้ส่งเวลามา)
                {' '}— <b>ไม่ได้แปลว่าซิงก์หยุด</b> แค่บอกความสดไม่ได้</>
            )}
            {fresh.changedThai && (
              <span className="block mt-1">
                สูตรในชุด<b>เปลี่ยนล่าสุด</b> {thaiMoment(fresh.changedThai)}
                {' '}<span className="opacity-70">(ชุดที่ไม่มีใครแก้ เวลานี้จะไม่ขยับ — คนละอันกับเวลาตรวจ)</span>
              </span>
            )}
            {/* ⚠️ เลขนี้นับจาก **คงเหลือ** เท่านั้น — ต้องเขียนให้ชัด ไม่งั้นคนอ่านว่าครอบพร้อมขายด้วย
                   แล้วเชื่อว่า "พร้อมขายไม่ติดลบเลย" ทั้งที่ ZORT API ไม่ส่งค่าติดลบของพร้อมขายมาให้เรานับ */}
            {typeof data.negative === 'number' && data.negative > 0 && (
              <span className="block mt-1">
                ตอนนี้มีชุดที่<b>คงเหลือ</b>ติดลบ <b>{fmtNum(data.negative)} ชุด</b> —
                ZORT เองก็มีติดลบเหมือนกัน แปลว่าแม้แต่ต้นทางก็ตามไม่ทัน
                {' '}<span className="opacity-70">(นับจากคอลัมน์คงเหลือเท่านั้น —
                  <b> พร้อมขายติดลบกี่ชุด เรานับไม่ได้</b> เพราะ ZORT API ส่งมาเป็น 0)</span>
              </span>
            )}
          </div>

          {/* ⚠️ **ZORT ไม่มีแท็บในจอนี้** — หลังแถวค้นหาคือหัวตารางเลย
              เคยใส่แท็บ เปิด/ปิดใช้งาน ไว้เพราะมีธง active ครบและกรองที่ฐานข้อมูลได้
              แต่กฎที่เจ้าของร้านสั่งคือ "เหมือน ZORT 100% ทุกจุด ไม่เหมือนให้แก้ใหม่"
              และตอนนี้ปิดใช้งาน = 0 อยู่แล้ว แท็บจึงไม่ได้ช่วยอะไรด้วยซ้ำ ⇒ ถอดออก
              (ตัวกรองยังอยู่ฝั่งเซิร์ฟเวอร์ `only=active|inactive` เอากลับมาได้ทันทีถ้าต้องการ) */}

          {/* 🕰 คอลัมน์ Marketplace มาจากแคชเซิร์ฟเวอร์ที่ "คืนของเก่าก่อน" ได้ — แถบนี้ห้ามถอด */}
          <MarketStaleBar stale={data.marketplacesStale} staleMs={data.marketplacesStaleMs} at={data.marketplacesAt} />

          {/* 🔴 **อายุของตัวเลขคงเหลือ/พร้อมขาย ต้องอยู่ติดหัวคอลัมน์ ไม่ใช่ท้ายตาราง**
              (เจ้าของร้านสั่งตรง 14 ก.ย. 2569 · ท้ายตารางไม่มีใครเห็น — บทเรียนเดิมของแถบ Marketplace)
              ที่มา: จอเคยยืนยันคงเหลือ 41 พร้อมขาย 23 ขณะที่ ZORT เป็น 18 / -10
                     เพราะตาราง bundles ไม่มีอะไรซิงก์ให้เลย (ค้าง 187/360)
              ⇒ ตัวเลขที่ไม่บอกอายุ = คำยืนยันที่พิสูจน์ไม่ได้ · จัดชิดขวาให้อยู่แนวคอลัมน์สองอันนั้น */}
          <div className={`flex justify-end text-[12px] leading-relaxed rounded-t-md px-3 py-1.5 border border-b-0 ${
            stock.state === 'stale' ? 'text-amber-900 bg-amber-50 border-amber-300'
              : stock.state === 'unknown' ? 'text-gray-600 bg-gray-50 border-gray-300'
                : 'text-gray-600 bg-white border-gray-200'}`}>
            <span>
              {stock.state === 'ok' && (
                <>🕰 <b>คงเหลือ / พร้อมขาย</b> ซิงก์จาก ZORT ล่าสุด <b>{thaiMoment(stock.syncedThai)}</b>
                  {' '}({agoText(stock.ageMinutes)}) · ซิงก์ทุกครึ่งชั่วโมง</>
              )}
              {stock.state === 'stale' && (
                <>🔴 <b>ตัวเลขคงเหลือ / พร้อมขาย อาจเก่ากว่าของจริง</b> — ซิงก์ล่าสุด
                  {' '}<b>{thaiMoment(stock.syncedThai)}</b> ({agoText(stock.ageMinutes)})
                  {' '}ทั้งที่ควรซิงก์ทุกครึ่งชั่วโมง ⇒ <b>เกิน {STOCK_STALE_MINUTES} นาทีแล้ว ตัวซิงก์น่าจะหยุด</b></>
              )}
              {stock.state === 'unknown' && (
                <>⚠️ <b>ยังไม่รู้ว่าตัวเลขคงเหลือ / พร้อมขาย ซิงก์ล่าสุดเมื่อไหร่</b> (ท่อไม่ได้ส่งเวลามา)
                  {' '}— ไม่ได้แปลว่าซิงก์หยุด แค่บอกอายุของตัวเลขไม่ได้</>
              )}
            </span>
          </div>
          <TableWrap>
            <table className="w-full min-w-[940px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>สินค้าเป็นชุด</th>
                  <th className={THR}>ราคาสินค้ารวม</th>
                  <th className={THR}>ราคาขาย</th>
                  {/* 🕰 สองคอลัมน์นี้คือของที่แถบอายุข้างบนกำกับอยู่ — ใส่นาฬิกาให้ชี้ตรงกัน
                      ไม่งั้นแถบลอยอยู่ข้างบนแล้วคนเดาไม่ออกว่ามันพูดถึงคอลัมน์ไหน */}
                  <th className={THR} title={`ตัวเลขนี้ซิงก์จาก ZORT ทุกครึ่งชั่วโมง — ดูอายุที่แถบเหนือตาราง (เกิน ${STOCK_STALE_MINUTES} นาทีถือว่าซิงก์หยุด)`}>
                    คงเหลือ <span className="opacity-50 font-normal">🕰</span>
                  </th>
                  <th className={THR} title={`ตัวเลขนี้ซิงก์จาก ZORT ทุกครึ่งชั่วโมง — ดูอายุที่แถบเหนือตาราง · และ 0 อาจหมายถึงติดลบ เพราะ ZORT API ไม่ส่งค่าติดลบของพร้อมขาย`}>
                    พร้อมขาย <span className="opacity-50 font-normal">🕰</span>
                  </th>
                  <th className={TH}>วันหมดอายุรายการ</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>Marketplace</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={11} icon="🔍" title="ไม่พบชุดที่ค้นหา" detail="ลองพิมพ์รหัสชุดหรือชื่อชุดให้สั้นลง" />
                    : <EmptyState cols={11} icon="📦" title="ยังไม่มีสินค้าเป็นชุด"
                        detail="ชุดสินค้าดึงมาจาก ZORT — สร้างชุดที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700 font-medium`}>{r.sku}</td>
                    {/* รูปอยู่ในคอลัมน์ชื่อ แบบเดียวกับจอสินค้าของ ZORT */}
                    <td className={TD}>
                      <span className="flex items-start gap-2.5">
                        {imgOf(r.sku)
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgOf(r.sku) as string} alt="" loading="lazy"
                              className="w-10 h-10 rounded border border-gray-200 object-cover bg-white shrink-0" />
                          )
                          : <span className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0" />}
                        <span
                          className="relative min-w-0"
                          onMouseEnter={() => showItems(r.sku)}
                          onMouseLeave={() => setHoverSku(null)}
                        >
                          <Link href={`/core/bundles/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                            {r.name || '—'}
                          </Link>
                          {hoverSku === r.sku && (
                            <span className="absolute left-0 top-full z-20 mt-1 w-[420px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] p-3.5 block">
                              <span className="block text-[13.5px] font-semibold text-gray-900">{r.name}</span>
                              <span className="block text-[11.5px] text-gray-400 mt-0.5 mb-1.5">รายการ</span>
                              {items[r.sku] === 'loading' && <span className="block text-[12.5px] text-gray-400">กำลังโหลด…</span>}
                              {items[r.sku] === 'error' && <span className="block text-[12.5px] text-red-600">ดึงรายการในชุดไม่ได้</span>}
                              {Array.isArray(items[r.sku]) && (items[r.sku] as BundleItem[]).length === 0 && (
                                <span className="block text-[12.5px] text-gray-500">ชุดนี้ยังไม่มีรายการส่วนประกอบที่เก็บไว้</span>
                              )}
                              {Array.isArray(items[r.sku]) && (items[r.sku] as BundleItem[]).map((it, k) => (
                                <span key={`${it.sku}-${k}`} className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
                                  <span className="text-[12.5px] text-gray-400 w-4 shrink-0">{k + 1}.</span>
                                  <span className="text-[12.5px] text-gray-800 min-w-0 flex-1">{it.name || it.sku}</span>
                                  <span className="text-[12.5px] text-gray-700 shrink-0">{fmtNum(it.qty)}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    {/* ผลรวมราคาขายของส่วนประกอบ — ตรวจกับ ZORT แล้วตรงเป๊ะ (00073-30-KK = 7,632)
                        ⚠️ null = มีชิ้นส่วนที่ยังไม่มีราคา ⇒ แสดงขีด **ห้ามคิดเป็น 0**
                           เพราะจะได้ราคารวมต่ำกว่าจริงแบบดูสมเหตุสมผล ไม่มีใครจับได้ */}
                    <td className={TDR}>
                      {typeof r.itemsValue === 'number'
                        ? fmtMoney(r.itemsValue)
                        : <span className="text-gray-300" title="มีชิ้นส่วนที่ยังไม่ได้ตั้งราคา จึงรวมไม่ได้">—</span>}
                    </td>
                    <td className={TDR}>{typeof r.sellprice === 'number' ? fmtMoney(r.sellprice) : <span className="text-gray-300">—</span>}</td>
                    <td className={TDR}><Qty n={r.onhand} unit={r.unit} /></td>
                    <td className={TDR}><Qty n={r.available} unit={r.unit} maybeNegative /></td>
                    <td className={`${TD} text-gray-400`}>-</td>
                    <td className={TD}>
                      {/* ZORT เขียนเป็นตัวหนังสือเขียว ไม่ใช่ป้ายกลม */}
                      <span className={r.active === false ? 'text-gray-500' : 'text-emerald-600'}>
                        {r.active === false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                      </span>
                    </td>
                    {/* ⚠️ ZORT โชว์ไอคอนร้านมาร์เก็ตเพลสตรงนี้ แต่ **API ไม่ส่งข้อมูลนี้มาเลย**
                        (Bundle/GetBundles ไม่มีช่อง marketplace) ⇒ มีหัวคอลัมน์ให้ผังตรง
                        แต่ใส่ขีด และเขียนเหตุผลไว้ใต้ตาราง — เหมือนที่ทำกับมูลค่ารายคลัง */}
                    <td className={TD}><MarketLogos list={r.marketplaces} by={r.marketplacesBy} from={r.marketplacesFrom} /></td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกรหัสชุด', onClick: () => { navigator.clipboard?.writeText(r.sku).catch(() => {}) } },
                          { label: 'ดูในจอสินค้า', onClick: () => { window.location.href = `/core/stock?q=${encodeURIComponent(r.sku)}` } },
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
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            <MarketCoverage checked={data.checkedMarketplaces}
              failed={data.marketplacesFailed} notConnected={data.marketplacesNotConnected}
              at={data.marketplacesAt} />
            {data.note ? ` · ${data.note}` : ''}
          </p>
        </>
      )}
    </div>
  )
}
