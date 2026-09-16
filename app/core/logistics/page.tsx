'use client'
// รายการขาย → บริการส่งสินค้า — **ลอกจาก `zort-ui/52-zort-บริการส่งสินค้า.jpg`**
// ผัง ZORT: ชื่อจอ "บริการขนส่ง" → "จำนวน N รายการ" → ปุ่ม นำเข้ารายการไฟล์ Excel · ขนส่ง
//   → ช่องค้นหา + ค้นหาขั้นสูง
//   → ตาราง: รายการ (เลขพัสดุ + เลขพัสดุตัวเล็กใต้) · วันที่ · ชื่อผู้รับ · จำนวนรายการขาย ·
//            ชำระเงิน · สถานะ · หมายเลขออเดอร์
//
// 💡 **ไม่พบเส้นอ่านข้อมูลขนส่งของ ZORT** (Logistic · Shipping · Delivery · Logistics → 404 · กวาดซ้ำ 6 ก.ย. 2569)
//    ⚠️ **แต่โมดูล `Shipment` มีตัวตน** — `Shipment/AddShipment` ตอบ 405 (เส้นเขียนมีจริง)
//       ⇒ เขียนว่า "ZORT ไม่มี API ขนส่งเลย" **ไม่ถูก** · ที่ไม่มีคือ **ฝั่งอ่าน**
//       และยังไม่ได้ลองระดับพารามิเตอร์ ⇒ พูดได้แค่ "ยังไม่พบทางอ่าน"
//    แต่ใบขายมีข้อมูลขนส่งครบอยู่ในตัว ⇒ จอนี้อ่านจากกระจกออเดอร์ ไม่ยิง ZORT เพิ่มสักครั้ง
//
// 🔴 **จำนวนของเราน้อยกว่า ZORT และห้ามปิดบัง**
//    เราเพิ่งเริ่มเก็บช่องขนส่ง 3 ก.ย. 2569 ⇒ ใบเก่าที่ไม่ขยับแล้วยังไม่มีเลขพัสดุ
//    ห้ามเขียนว่า "ทั้งหมด N ใบ" ⇒ ต้องเขียนว่า "เท่าที่เก็บได้" พร้อมบอกว่า ZORT มีเท่าไหร่
import { useCallback, useEffect, useState } from 'react'
import { SALE_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  Pill, toneOfStatus, EmptyState, thaiDate, RowMenu, CarrierMark, PageNav,} from '@/components/zort'

interface Row {
  id: string; number: string; trackingNo?: string; date?: string
  receiver?: string; carrier?: string; status?: string
  isCod?: boolean; lines?: number
}
interface Resp {
  /** ขอบเขตทั้งหมด (ใช้ทำป้ายบนแท็บ) · `shown` = จำนวนของแท็บที่เลือก (ใช้กับเลขหน้า) */
  total: number; shown?: number; shipped?: number; unshipped?: number; cod?: number
  /** คีย์ใหม่ความหมายเดียว — แถวที่เข้าเงื่อนไขทั้งหมด (แทน shown ที่กำกวมข้ามเส้น) */
  rowsMatched?: number; rowsReturned?: number
  /** ขนส่งที่รวมชื่อสะกดต่าง ๆ เข้าเป็นเจ้าเดียวแล้ว — `names` คือชื่อดิบที่ถูกรวมเข้ามา
   *  ⚠️ **ต้องกดดูชื่อดิบได้เสมอ** วันไหนต้องไล่ว่าใบไหนมาจากชื่อไหน ต้องยังไล่ได้
   *  ⚠️ `carrierUngrouped` = ตาข่ายกันเจ้าใหม่โผล่แล้วถูกกลืนหายเงียบ ๆ */
  carrierGroups?: { carrier: string; c: number; known?: boolean; names?: { name: string; c: number }[] }[]
  carrierUngrouped?: number
  carrierUngroupedNames?: number
  limit: number; offset: number; only?: string | null
  coversFrom?: string; zortShows?: number; note?: string
  rows: Row[]
}

const PAGE = 50
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(SALE_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}

export default function LogisticsPage() {
  const router = useRouter()
  const [data, setData] = useState<Resp | null>(null)
  const [only, setOnly] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, onlyId = only) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'logistics', limit: String(PAGE), offset: String(off) })
      if (onlyId) qs.set('only', onlyId)
      if (q.trim()) qs.set('q', q.trim())
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
  }, [only, q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  const tabs = [
    { id: '', label: 'ทั้งหมด', count: data?.total },
    // 🔴 **แท็บ "ยังไม่มีเลขพัสดุ" คือของที่ต้องลงมือจริง** — ท่อส่ง unshipped มาตั้งแต่แรก
    //    แต่จอไม่เคยเอามาใช้ ⇒ ใบที่ยังไม่ได้ส่งจมอยู่ในกอง 558 ใบโดยไม่มีใครเห็น
    { id: 'unshipped', label: 'ยังไม่มีเลขพัสดุ', count: data?.unshipped },
    { id: 'shipped', label: 'ส่งแล้ว', count: data?.shipped },
    { id: 'cod', label: 'เก็บเงินปลายทาง', count: data?.cod },
  ]

  /** จำนวนจริงของแท็บที่เลือกอยู่ — **ห้ามใช้ `data.total` ตอนกรอง**
   *  กติกาที่ตกลงกับฝั่งท่อ (4 ก.ย. 2569):
   *  · `total` = ขอบเขตทั้งหมด ใช้ทำป้ายบนแท็บ
   *  · `shown` = จำนวนของแท็บที่เลือก ใช้กับเลขหน้าและปุ่มถัดไป
   *  ใช้ `total` ตรง ๆ จะได้ "แสดง 7 จาก 559" และปุ่มถัดไปกดได้ทั้งที่ไม่มีหน้าถัดไป
   *  ⚠️ ทางถอยยังต้องมี — จอใหม่อาจเจอท่อเก่าที่ยังไม่ส่ง `shown` ตอน deploy เหลื่อม */
  const tabTotal = Number(
    data?.rowsMatched   // คีย์ใหม่ความหมายเดียว — มาก่อน shown ที่ความหมายกำกวมข้ามเส้น
    ?? data?.shown
    ?? (only === 'unshipped' ? data?.unshipped
      : only === 'shipped' ? data?.shipped
        : only === 'cod' ? data?.cod
          : data?.total)
    ?? data?.total ?? 0
  )
  /* 🔴 **ท่อไม่บอกจำนวน ≠ จำนวนเป็นศูนย์** (เจอด้วยท่อปลอมโหมด partialgood 16 ก.ย. 2569)
     ถ้าทุกคีย์หายไปหมด `tabTotal` จะตกมาเป็น 0 แล้วจอเขียนว่า **"แสดง 1 จาก 0 รายการ"**
     ซึ่งขัดกันในตัวเอง (มีแถวให้เห็น 1 แถว แต่บอกว่าทั้งชุดมี 0)
     ⇒ แยกสถานะ "ไม่รู้จำนวน" ออกมา แล้วให้จอพูดว่าไม่รู้ ไม่ใช่พูดเลข 0 */
  const รู้จำนวน = [data?.rowsMatched, data?.shown, data?.unshipped, data?.shipped, data?.cod, data?.total]
    .some((v) => typeof v === 'number' && Number.isFinite(v))

  /** 🔴 **ด่านชั้นสอง: ตรวจ "เนื้อข้อมูล" ไม่ใช่แค่คำสะท้อนกลับ**
   *  ด่าน `applied`/`only` เช็คได้แค่ว่าเซิร์ฟเวอร์ **บอกว่า** อ่านตัวกรองแล้ว
   *  ไม่ได้เช็คว่า **ทำจริงไหม** — ของจริง 4 ก.ย. 2569: `only=cod` สะท้อน `cod` กลับมา
   *  แต่คืนแถวชุดเดียวกับตอนไม่กรองทุกประการ (มีใบที่ไม่ใช่ COD ปนมา)
   *  ⇒ แท็บ COD โชว์ของผิดโดยที่ทุกด่านผ่านหมด */
  const mismatch = (() => {
    if (!data || rows.length === 0) return ''
    if (only === 'cod' && rows.some((r) => !r.isCod)) return 'เก็บเงินปลายทาง'
    if (only === 'unshipped' && rows.some((r) => r.trackingNo)) return 'ยังไม่มีเลขพัสดุ'
    if (only === 'shipped' && rows.some((r) => !r.trackingNo)) return 'ส่งแล้ว'
    return ''
  })()

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="บริการขนส่ง"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" — กล่องแดงข้างล่างบอกว่าพังแล้ว
             แต่หัวจอยังบอกว่ากำลังโหลด ⇒ คนรอต่อไปเรื่อย ๆ โดยไม่รู้ว่าจบแล้ว
             (เจอด้วยการเปิดจอตอนดึงข้อมูลไม่ได้ 6 ก.ย. 2569 — อ่านโค้ดแล้วไม่เห็น
              เพราะสองข้อความอยู่คนละที่ในไฟล์ และแต่ละอันถูกของมันเอง) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง') :
          data
            ? (
              <>
                {/* ⚠️ คำว่า "เท่าที่เก็บได้" ห้ามตัดทิ้ง — เลขนี้ไม่ใช่ยอดขนส่งทั้งหมดของร้าน
                    🔴 **แต่คำนี้ชี้ผิดทาง** (เทียบจอจริง 17 ก.ย. 2569 · ใบ t_mu2u9mym)
                       "เท่าที่เก็บได้" อ่านได้ว่าเลขนี้ **น้อยกว่าความจริง**
                       ของจริงคือมัน **มากกว่าเลขบนจอชื่อเดียวกันของ ZORT หลายสิบเท่า**
                       เพราะนับคนละหน่วย: ที่นี่ 1 แถว = **ใบขาย 1 ใบที่มีข้อมูลขนส่ง**
                       ที่ ZORT 1 แถว = **การจองขนส่ง 1 ครั้งผ่านระบบของเขา** (จอเขามีปุ่มจอง/พิมพ์ฉลาก)
                       ⇒ เขียนหน่วยกำกับ ไม่งั้นคนเปิดสองจอเทียบกันแล้วคิดว่าฝั่งหนึ่งข้อมูลหาย */}
                นับจาก<b>ใบขายที่มีข้อมูลขนส่ง</b> <b>{fmtNum(data.total)}</b> ใบ
                {typeof data.cod === 'number' && <> · เก็บเงินปลายทาง {fmtNum(data.cod)} ใบ</>}
                {' | '}
                <span className="text-gray-400">อ่านจากกระจกออเดอร์ ไม่ได้ยิง ZORT</span>
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <Link href="/core/soon/shipping"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้ารายการไฟล์ Excel
            </Link>
            <Link href="/core/soon/shipping"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              ขนส่ง
            </Link>
          </>
        }
      />

      {/* 🚚 **การจองขนส่ง/ตัดพอยท์ยังอยู่ที่ ZORT — จอนี้อ่านอย่างเดียว**
          🔬 เจอ 16 ก.ย. 2569 ตอนเปิดเมนู "9 จุด" ของ ZORT (ของที่ยังไม่เคยมีใครเก็บผัง):
             เมนูนั้นมี 3 อย่าง — **L Shipping Point** (`/LogisticPoint/HistoryV2`) · โซเชี่ยลคอมเมิร์ซ · คู่มือ
             จอ L Shipping Point คือระบบ **พอยท์จองขนส่ง**: ประวัติ 2,024 แถว ·
             สถานะมีสามแบบ หักพอยท์ / คืนพอยท์ / เติมพอยท์ · ผูกกับเลขที่ใบขายตรง ๆ
             แถวล่าสุด **15 ก.ย. 2569** (หัก 24 พอยท์ต่อใบในแถวที่เห็น) ⇒ **ร้านใช้อยู่จริงทุกวัน**
          🔴 แปลว่า ถ้าเลิก ZORT **ช่องทางจองขนส่ง/ตัดพอยท์หายไปด้วย** ไม่ใช่แค่จอข้อมูลหาย
             ⇒ เขียนบอกบนจอ เพราะจอนี้คือที่ที่คนจะมาหาเรื่องขนส่ง (เงียบไว้ = เข้าใจว่าเราทำได้แล้ว) */}
      <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
        🚚 จอนี้<b>อ่านข้อมูลขนส่งจากใบขาย</b>เท่านั้น — การ<b>จองขนส่ง/พิมพ์ฉลาก</b>ยังทำที่ ZORT
        <br />
        <span className="text-[12.5px]">
          ⚠️ <b>เลขบนหัวจอนี้เทียบกับจอ “บริการขนส่ง” ของ ZORT ตรง ๆ ไม่ได้</b> — นับคนละหน่วย:
          ที่นี่ 1 แถว = <b>ใบขาย 1 ใบที่มีข้อมูลขนส่ง</b> · ที่ ZORT 1 แถว = <b>การจองขนส่ง 1 ครั้งผ่านระบบเขา</b>
          ⇒ ของเราจึง<b>มากกว่า</b>ของเขามาก ไม่ใช่ฝั่งไหนข้อมูลหาย
          <br />
          ⚠️ <b>จอนี้ยังกรองตามช่วงวัน / เจ้าขนส่ง / สถานะการส่งไม่ได้</b> (ZORT มี “ค้นหาขั้นสูง”)
          — ยิงตรวจ 17 ก.ย. 2569: ท่อ<b>เมินพารามิเตอร์ทั้งสามเงียบ ๆ</b> (ยอดรวมไม่ขยับเลยสักท่า)
          ⇒ <b>ยังไม่ทำปุ่มไว้ เพราะกดแล้วจะไม่เกิดอะไรขึ้น</b> · ขอฝั่งท่อไว้แล้ว
        </span>
        (เมนู 9 จุด → <b>L Shipping Point</b> ซึ่งตัด “พอยท์” ต่อการจองหนึ่งครั้ง · ร้านใช้อยู่จริง
        โดยรายการล่าสุดที่เห็นคือ 15 ก.ย. 2569)
      </p>

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขพัสดุ ชื่อผู้รับ เลขที่ใบขาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการขนส่งไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {/* 🔴 กล่องนี้คือหัวใจของจอนี้ — ห้ามถอด
              จอที่โชว์ตัวเลขเฉย ๆ จะถูกอ่านว่า "ร้านส่งของไปเท่านี้ครั้ง" ซึ่งผิด

              🔴 **ข้อความเดิมกลายเป็นเท็จแล้ว — แก้ 16 ก.ย. 2569 (งานยืน t_mu2u9mym)**
                 เดิมเขียนว่า "ตัวเลขนี้ยังไม่เท่ากับของ ZORT · ส่วนที่ขาดคือใบเก่าที่ไม่ขยับ
                 · จะเท่ากันเมื่อกวาดใบเก่าย้อนหลังครบ" ซึ่งเขียนไว้ตอนเรามีน้อยกว่า
                 วันนี้ยิงเทียบของจริง: **ของเรา 35,722 · จอเดียวกันของ ZORT 1,665** (อ่านจากจอ ZORT สด)
                 ⇒ เราไม่ได้ "ขาด" แต่**นับคนละประชากร** และข้อความเดิมจะพาคนไปตามหาของที่ไม่หาย
              ⚠️ **ยังไม่รู้กติกาของ ZORT ว่าจอนั้นเอาใบไหนมาแสดง** (น่าจะเฉพาะที่จองขนส่งผ่าน ZORT
                 แต่ยังไม่ได้พิสูจน์) ⇒ เขียนว่า "ยังไม่รู้" ห้ามเดาแทน ZORT */}
          <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            <b>ตัวเลขจอนี้กับของ ZORT นับคนละประชากร — เทียบตรง ๆ ไม่ได้</b>
            <br />
            · <b>ของเรา</b> = ใบขายในคลังของเราที่<b>มีร่องรอยการส่ง</b> (มีเลขพัสดุ หรือระบุขนส่ง)
            {data.coversFrom && <> · {data.coversFrom}</>}
            {typeof data.zortShows === 'number' && (
              <>
                <br />
                · <b>ของ ZORT</b> จอ &ldquo;บริการขนส่ง&rdquo; แสดง <b>{fmtNum(data.zortShows)}</b> รายการ
                {' '}— <b>น้อยกว่าของเรามาก</b> และ<b>ยังไม่รู้ว่า ZORT คัดด้วยเงื่อนไขอะไร</b>
                {' '}(ยังไม่พิสูจน์ ⇒ ไม่เดาแทนเขา)
              </>
            )}
            <br />
            ⇒ ใช้จอนี้ดู<b>ว่าใบไหนส่งด้วยเจ้าไหน</b>ได้ แต่<b>ห้ามเอาจำนวนไปเทียบกับ ZORT</b> ตรง ๆ
            {/* ⚠️ ข้อความ `note` มาจากฝั่งท่อ และ**ท่อนท้ายของมันยังเป็นของเก่า**
                ("ยังน้อยกว่าที่ ZORT แสดง…") ซึ่งขัดกับตัวเลขที่ยิงเทียบวันนี้
                ⇒ ไม่แอบตัดข้อความของอีกฝั่ง แต่**ติดป้ายว่าเป็นของท่อและยังไม่ได้แก้**
                   (แจ้ง CEO ให้แก้ที่ต้นทางแล้ว — แก้ที่จอจะกลายเป็นสองความจริง) */}
            {data.note && (
              <>
                <br />
                <span className="text-amber-900/70">
                  <b>ข้อความจากท่อ (ท่อนท้ายยังไม่ได้แก้ — แจ้งต้นทางแล้ว):</b> {data.note}
                </span>
              </>
            )}
          </div>

          {/* สรุปขนส่งรายเจ้า — ZORT มีคอลัมน์นี้เป็นโลโก้ ของเราเป็นชื่อที่ ZORT ส่งมา
              ซึ่งสะกดได้หลายแบบ ⇒ ฝั่งท่อรวมให้แล้ว (a03c019) จอโชว์ชื่อกลุ่มเป็นหลัก
              🔴 **แต่ต้องกดดูชื่อดิบได้เสมอ** — รวมกลุ่มคือการตีความ ไม่ใช่ความจริงดิบ
                 วันไหนต้องไล่ว่าใบไหนมาจากชื่อไหน ต้องยังไล่ได้ ไม่งั้นเราทับข้อมูลต้นทางทิ้ง */}
          {Array.isArray(data.carrierGroups) && data.carrierGroups.length > 0 && (
            <div className="text-[12.5px] text-gray-700 bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3">
              <span className="text-gray-500">ขนส่งที่ใช้:</span>{' '}
              {data.carrierGroups.map((g) => (
                <details key={g.carrier} className="inline-block align-top mr-3">
                  <summary className="cursor-pointer list-none inline">
                    <CarrierMark name={g.carrier} /> <b>{g.carrier}</b> {fmtNum(g.c)} ใบ
                    {Array.isArray(g.names) && g.names.length > 1 && (
                      <span className="text-gray-400"> (รวมจาก {g.names.length} ชื่อ ▾)</span>
                    )}
                  </summary>
                  <span className="block text-[11.5px] text-gray-500 mt-1 ml-3">
                    {(g.names ?? []).map((n) => (
                      <span key={n.name} className="block">· {n.name} — {fmtNum(n.c)} ใบ</span>
                    ))}
                  </span>
                </details>
              ))}
              {/* ⚠️ ตาข่ายกันเจ้าใหม่โผล่แล้วถูกกลืนหาย — 0 คือค่าที่ถูก ไม่ใช่ค่าที่ไม่มีความหมาย */}
              {Number(data.carrierUngrouped) > 0 && (
                <span className="block text-amber-800 mt-1">
                  ⚠️ มีอีก <b>{fmtNum(Number(data.carrierUngrouped))}</b> ใบจาก{' '}
                  <b>{fmtNum(Number(data.carrierUngroupedNames ?? 0))}</b> ชื่อที่<b>ยังไม่ได้จัดกลุ่ม</b>
                  {' '}— อาจเป็นขนส่งเจ้าใหม่ที่ยังไม่มีในรายชื่อ
                </span>
              )}
            </div>
          )}

          <Tabs tabs={tabs} active={only} onChange={(id) => { setOnly(id); load(0, id) }} />

          {/* ⚠️ เตือนตรง ๆ ว่าตารางข้างล่างไม่ตรงกับแท็บที่กด — **ห้ามเงียบ**
              ตารางที่กรองไม่จริงแต่ดูเหมือนกรองแล้ว คือของที่คนเอาไปตัดสินใจผิดได้ทันที */}
          {mismatch && (
            <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>ตารางข้างล่างยังไม่ได้ถูกกรองจริง</b> — กดแท็บ &quot;{mismatch}&quot; แล้ว
              แต่ยังมีแถวที่ไม่เข้าเงื่อนไขปนอยู่ · เซิร์ฟเวอร์ตอบกลับมาว่ารับตัวกรองแล้ว
              แต่ข้อมูลที่ส่งมาไม่ตรง ⇒ <b>อย่าเพิ่งใช้ตัวเลขจากแท็บนี้ตัดสินใจ</b> (แจ้งฝั่งท่อแล้ว)
            </div>
          )}

          <TableWrap>
            <table className="w-full min-w-[900px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>ชื่อผู้รับ</th>
                  <th className={THR}>จำนวนรายการขาย</th>
                  <th className={TH}>ชำระเงิน</th>
                  {/* 🔴 **คำว่า "สถานะ" ของสองจอไม่ใช่เรื่องเดียวกัน** (กดอ่านจอ ZORT 16 ก.ย. 2569)
                      ZORT คอลัมน์นี้คือ **สถานะการส่ง** — ตารางเห็นจริง "กำลังส่ง" · "สำเร็จ"
                      (แผงค้นหาของเขามี สำเร็จ · รอชำระ · รอส่ง · กำลังส่ง · ถูกยกเลิก)
                      ของเราได้มาจากท่อเป็น **สถานะใบขาย** (Success/Pending/Voided) ⇒ ไม่มี "กำลังส่ง" เลย
                      ⇒ ตั้งชื่อคอลัมน์ให้ตรงกับของที่มีจริง **ห้ามแปะคำ ZORT ทับของที่ไม่ใช่เรื่องเดียวกัน**
                         (กติกาในสกิล zort-words: เจอสถานะที่เราไม่มี = งานแก้ระบบ ต้องแจ้ง ไม่ใช่แปะคำ) */}
                  <th className={TH} title="สถานะของใบขาย — ไม่ใช่สถานะการส่งของบริษัทขนส่ง">สถานะใบขาย</th>
                  <th className={TH}>หมายเลขออเดอร์</th>
                  <th className={TH} style={{ width: 56 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={8} icon="🚚" title="ไม่พบรายการขนส่ง"
                    detail={q ? 'ลองพิมพ์คำสั้นลง หรือค้นด้วยเลขพัสดุเต็ม' : 'ยังไม่มีใบที่มีเลขพัสดุในเงื่อนไขนี้'} />
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={TD}>
                      {/* ZORT โชว์เลขพัสดุสองบรรทัด (ลิงก์ + เลขเดิมซ้ำตัวเล็ก) และมีโลโก้ขนส่งข้างหน้า
                          ⇒ บรรทัดล่างของเราใส่ **ชื่อขนส่ง** แทนการซ้ำเลขเดิม
                             เพราะเรายังไม่มีโลโก้ ถ้าซ้ำเลขด้วยจะไม่เหลือที่บอกว่าส่งกับเจ้าไหนเลย */}
                      {/* กดแล้วไปใบขายของพัสดุนั้น — ปลายทางมีจริง */}
                      {/* ⚠️ เดิมเขียน `r.trackingNo || r.number` ⇒ ใบที่ยังไม่มีเลขพัสดุ
                          จะโชว์เลขที่ใบขาย**ซ้ำกับคอลัมน์ "หมายเลขออเดอร์" ในแถวเดียวกัน**
                          อ่านแล้วนึกว่าเลขนั้นคือเลขพัสดุ ⇒ ยังไม่มีก็ต้องบอกว่ายังไม่มี */}
                      <Link href={`/core/sales/detail?id=${encodeURIComponent(r.id)}`}
                        className={r.trackingNo ? 'text-blue-600 hover:underline font-medium' : 'text-gray-400 hover:underline'}>
                        {r.trackingNo || 'ยังไม่มีเลขพัสดุ'}
                      </Link>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                        <CarrierMark name={r.carrier} />
                        {r.carrier || 'ไม่ระบุขนส่ง'}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.date ? thaiDate(r.date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} max-w-[200px] truncate`}>{r.receiver || <span className="text-gray-300">—</span>}</td>
                    {/* ไม่รู้จำนวนรายการในใบ ⇒ ขีด (0 แปลว่าใบนี้ไม่มีสินค้าเลย ซึ่งคนละเรื่อง) */}
                    <td className={TDR}>{typeof r.lines === 'number' ? fmtNum(r.lines) : <span className="text-gray-300">—</span>}</td>
                    <td className={TD}>
                      {/* ⚠️ COD = เก็บเงินปลายทาง (ยังไม่ได้เงิน) ไม่ใช่ "จ่ายแล้ว" — ห้ามใช้สีเขียว */}
                      {r.isCod
                        ? <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">COD</span>
                        : <span className="text-gray-400 text-[12px]">โอน/ชำระก่อน</span>}
                    </td>
                    <td className={TD}><Pill tone={toneOfStatus(r.status ?? '')}>{statusTh(r.status)}</Pill></td>
                    <td className={`${TD} text-gray-600 whitespace-nowrap`}>{r.number}</td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          // ⚠️ ไม่มีเลขพัสดุแล้วยังให้กดคัดลอกได้ = คัดลอกค่าว่างแบบเงียบ ๆ
                          //    คนกดจะไปวางแล้วได้ช่องว่าง โดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น
                          {
                            label: 'คัดลอกเลขพัสดุ',
                            // `disabled` เป็น **ข้อความเหตุผล** ไม่ใช่ boolean — และต้องบอกว่าไปทำที่ไหนต่อ
                            disabled: r.trackingNo
                              ? undefined
                              : 'ใบนี้ยังไม่มีเลขพัสดุ — เลขจะขึ้นเองเมื่อขนส่งรับของแล้ว ดูสถานะได้ที่ใบขาย',
                            onClick: () => { navigator.clipboard?.writeText(r.trackingNo ?? '').catch(() => {}) },
                          },
                          {
                            label: 'เปิดใบขายนี้',
                            onClick: () => router.push(`/core/sales/detail?id=${encodeURIComponent(r.id)}`),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white text-[12px] text-gray-600">
              <span>
                แสดง {fmtNum(offset + rows.length)} จาก{' '}
                {รู้จำนวน ? <>{fmtNum(tabTotal)} รายการ</> : <span className="text-amber-700">ยังไม่รู้ว่าทั้งชุดมีกี่รายการ (ท่อไม่ได้บอกจำนวนมา)</span>}
                {only && <span className="text-gray-400"> (เฉพาะแท็บที่เลือก)</span>}
              </span>
              {/* เลขหน้าแบบ ZORT (ชิ้นเดียวกับจอรายการอื่น) — ZORT ไล่หน้าด้วยเลขหน้าเสมอ
                  🔴 **ไม่รู้จำนวนทั้งชุด ⇒ ส่ง total = null** ⇒ PageNav จะไม่คิดเลขหน้าสุดท้ายเอง
                     และเขียนบนจอว่า "ยังไม่รู้ว่าทั้งชุดมีกี่หน้า" แทนการเดา (กฎสามสถานะ)
                  ⚠️ ใช้ยอด **ของแท็บที่เลือก** ไม่ใช่ยอดรวมทุกแท็บ ไม่งั้นปุ่มถัดไปกดได้ทั้งที่ไม่มีของ */}
              <PageNav offset={offset} perPage={PAGE} rowsOnPage={rows.length}
                total={รู้จำนวน ? tabTotal : null}
                disabled={loading} onGo={(off) => load(off)} />
            </div>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            {/* 🔴 ข้อความเดิมตรงนี้เขียนว่า "สะกดหลายแบบ จึงยังจับคู่โลโก้ไม่ได้"
                ซึ่งค้างข้ามวันที่ฝั่งท่อรวมชื่อให้แล้ว (4 ก.ย. 2569) — เขียนใหม่ตามสภาพจริง
                กฎ stale-state-comments แต่เป็นข้อความบนจอ ไม่ใช่คอมเมนต์ */}
            ZORT มีคอลัมน์ <b>บริการขนส่ง</b> เป็น<b>โลโก้</b>ขนส่ง — ของเราขึ้นเป็นชื่อ ·
            ชื่อดิบที่ ZORT ส่งมาสะกดได้หลายแบบ ตอนนี้<b>รวมกลุ่มให้แล้วด้วยการเทียบชื่อตรงตัว</b>
            (ไม่ใช่เดาจากคำที่มีอยู่ในชื่อ) กดที่ชื่อกลุ่มด้านบนเพื่อดูชื่อดิบทั้งหมดได้ ·
            <b> ยังไม่ใส่โลโก้เพราะยังไม่มีไฟล์โลโก้ของขนส่ง</b> — เป็นเรื่องของที่ยังไม่ได้ทำ
            ไม่ใช่ทำไม่ได้
          </p>

          {/* 🔎 ของที่ ZORT มีในจอนี้แต่เรายังไม่มี — กดอ่านแผงจริงของเขา 16 ก.ย. 2569
              เขียนไว้บนจอเพราะคนที่ชิน ZORT จะไล่หา แล้วถ้าไม่บอกจะคิดว่าเราลืม */}
          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            <b>ค้นหาขั้นสูงของ ZORT ในจอนี้มี</b> รายการ · ชื่อผู้รับ · ช่วงวันที่ ·
            ติ๊กเลือก<b>ขนส่ง 9 เจ้า</b> · ติ๊กเลือก<b>สถานะการส่ง 5 ค่า</b>
            (สำเร็จ · รอชำระ · รอส่ง · กำลังส่ง · ถูกยกเลิก) —
            ของเรายัง<b>มีแต่ช่องค้นหาเดียว</b> เพราะท่อของจอนี้รับแค่คำค้นหา
            (<b>ยิงตรวจซ้ำ 16 ก.ย. 2569</b>: ส่ง <code>from</code> · <code>to</code> · <code>carrier</code> ·
            {' '}<code>status</code> · <code>shipStatus</code> ⇒ จำนวนคงที่ <b>35,724 ทุกครั้ง</b> ·
            {' '}ส่ง <code>q</code> ⇒ เปลี่ยนเป็น 32,566 ⇒ ท่อรู้จักแต่คำค้นหา ·
            {' '}และช่อง <code>applied</code> ที่ท่อตอบมีแค่ 4 คีย์ <code>only · limit · offset · q</code>
            {' '}⇒ <b>คีย์ที่ไม่อยู่ในนั้นคือคีย์ที่ท่อไม่รู้จัก</b>) ⇒ ถ้าใส่ช่องพวกนั้นตอนนี้
            จะเป็นช่องที่กรอกแล้วไม่มีผล ซึ่งแย่กว่าไม่มีช่อง · <b>ขอฝั่งท่อไว้แล้ว</b>
          </p>
        </>
      )}
    </div>
  )
}
