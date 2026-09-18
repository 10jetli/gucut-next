'use client'
// Marketplace Dashboard — ลอกจาก ZORT `/Marketplace/Dashboard` (`zort-ui/32`)
//
// ผังของจริง: หัวข้อ "Marketplace Dashboard" · ปุ่มน้ำเงินขวาบน "จัดการการเชื่อมต่อ" ·
// การ์ด 3 ใบเรียงแนวนอน (Shopee · Lazada · TikTok) ใบละ: โลโก้ · ปุ่ม "จัดการร้าน" ·
// ชื่อร้าน · บรรทัด "จำนวนสินค้าที่เชื่อมต่อ" · เลขตัวใหญ่ชิดขวา
//
// ⚠️ **เลขบนจอนี้ตอบคนละคำถามกับของ ZORT — ห้ามลอกป้ายมาเฉย ๆ**
//    ZORT: "จำนวนสินค้าที่เชื่อมต่อ" = ของที่ผูกรหัสกันไว้ (ปิดการขายอยู่ก็นับ) → 1,926 / 1,988 / 54
//    เรา : รู้แต่ "กำลังลงขายอยู่จริง" (Shopee ถามเฉพาะสถานะ NORMAL)
//    วัดของจริง 5 ก.ย. 2569 ไล่ครบ 2,672 รหัส: shopee 76 · lazada 1,661 · เว็บร้าน 2,027
//    ต่างกัน 25 เท่าที่ Shopee **ไม่ใช่ของหาย** — ฝั่งท่อไล่นับแล้ว 4 ก.ย.
//    ลงขายจริง 37 สินค้า · 310 ตัวเลือก · กรอกรหัสครบทุกตัว
//    ⇒ จอนี้จึงเขียนป้ายว่า "ลงขายอยู่ตอนนี้" ไม่ใช่ "เชื่อมต่อ" และบอกเหตุที่ต่างไว้ในจอ
//
// ⚠️ **ห้ามเขียนเลขตายตัวลงจอนี้เด็ดขาด** ([[computed-now-goes-stale]])
//    ไม่มีค่าจากท่อ = ขึ้นขีดพร้อมเหตุผล · เลขที่วัดวันนี้อยู่ในคอมเมนต์เท่านั้น ไม่ได้อยู่ในหน้าจอ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum, thaiDate } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, thaiHm } from '@/components/zort'

/** ตัวเลขรายช่องทางที่ขอฝั่งท่อไว้ (`?marketplacecounts=1`) — ยังไม่มาก็ไม่เป็นไร
 *  ⚠️ ทุกช่องเป็น optional โดยตั้งใจ: วันที่ท่อส่งมาครึ่งเดียว จอต้องขึ้นขีดเฉพาะช่องนั้น
 *     ไม่ใช่พังทั้งใบ (บทเรียน fmtNum(null) 5 ก.ย. 2569) */
interface Counts {
  /** จำนวนรหัสที่กำลังลงขายอยู่บนเจ้านั้น — null = ดึงได้ไม่ครบ ห้ามเดา */
  listed?: number | null
  /** จำนวน "ตัวเลือก" (variant) — Shopee/Lazada ขายที่ระดับนี้ */
  variants?: number | null
  /** ชื่อร้านบนแพลตฟอร์ม ถ้าท่อรู้ */
  store?: string | null
}

/* 🧺 ของที่ Shopee **ถอดจากหน้าร้าน (UNLIST)** แต่คลังเรายังมีของ — ท่อ `?shopeeunlisted=1`
   ⚠️ สามข้อที่ฝั่งท่อกำชับ และจอนี้ต้องทำตาม:
     ① **หน่วยไม่เหมือนกัน** — `items` = "สินค้า" (หน่วยเดียวกับเลข UNLIST บนจอ Shopee) ·
        `skus` = "ตัวเลือก" ⇒ ต้องเขียนหน่วยกำกับทุกเลข ห้ามเอาสองหน่วยมาเทียบกัน
     ② `itemsUnknown`/`skusUnknown` = **ยังไม่รู้ว่ามีของไหม** ห้ามรวมเข้ากอง "ไม่มีของ"
     ③ `stockDay`/`recipeAt` = เวลาที่ข้อมูลถูกเก็บ **ไม่ใช่เวลาเปิดจอ** ⇒ ต้องโชว์อายุข้อมูล */
interface Unlisted {
  declaredByShopee?: number | null
  sawAll?: boolean | null
  items?: number | null; itemsWithStock?: number | null; itemsNoStock?: number | null; itemsUnknown?: number | null
  skus?: number | null; skusWithStock?: number | null; skusNoStock?: number | null; skusUnknown?: number | null
  stockDay?: string | null; recipeAt?: string | null; recipeCheckedAt?: string | null
  withStock?: { itemId?: number; name?: string }[] | null
  unknown?: { itemId?: number; name?: string; why?: string[] }[] | null
  note?: string | null
}

interface Data {
  checkedMarketplaces?: string[] | null
  unlisted?: Unlisted | null
  marketplacesFailed?: Record<string, string> | null
  marketplacesNotConnected?: Record<string, string> | null
  marketplacesUnreliable?: Record<string, string> | null
  marketplacesAt?: string | null
  marketplaceCounts?: Record<string, Counts> | null
}

/** อายุของข้อมูลเป็น "จำนวนวัน" นับตามวันไทย — คืน null เมื่ออ่านวันไม่ออก (ห้ามเดาเป็น 0)
 *  🔴 เลขที่คัดมาจากรอบเก็บข้อมูล **ต้องบอกอายุตัวเอง** ไม่งั้นอีกสองสัปดาห์จอยังยืนยันเลขของวันนี้
 *     (กติกาเดียวกับจอกระเป๋าเงินที่ใช้ CHECKED_AT + STALE_DAYS) */
function อายุวัน(iso?: string | null): number | null {
  const d = String(iso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const เก็บเมื่อ = Date.parse(`${d}T00:00:00+07:00`)
  if (Number.isNaN(เก็บเมื่อ)) return null
  const วันนี้ไทย = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const วันนี้ = Date.parse(`${วันนี้ไทย}T00:00:00+07:00`)
  return Math.round((วันนี้ - เก็บเมื่อ) / 86400000)
}

/** เรียงตามผัง ZORT เป๊ะ — Shopee · Lazada · TikTok
 *  ⚠️ ห้ามซ่อนเจ้าที่ยังไม่ได้เชื่อม คนที่ชิน ZORT จะหาแล้วไม่เจอ แล้วนึกว่าระบบเราทำไม่ได้ */
const PLATFORMS = [
  { id: 'shopee', name: 'Shopee', emoji: '🛒', tone: 'text-orange-600' },
  { id: 'lazada', name: 'Lazada', emoji: '🔵', tone: 'text-blue-600' },
  { id: 'tiktok', name: 'TikTok Shop', emoji: '🎵', tone: 'text-gray-900' },
]

export default function MarketplaceDashboardPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      /* ⚠️ `marketplaces=1` ต้องส่ง ไม่งั้นท่อไม่ไปถามแพลตฟอร์มเลย แล้วทุกช่องว่างแบบเงียบ ๆ
         `limit=1` เพราะจอนี้ไม่ได้ใช้ตัวแถว ใช้แต่ค่าสรุปหัวก้อน — ไม่ต้องลากมา 200 แถวฟรี ๆ */
      const r = await fetch('/api/web/core?list=stock&marketplaces=1&limit=1').then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      /* ยิงแยกก้อน: ถ้าเส้นนี้ยังไม่มีหรือช้า **ห้ามทำให้จอหลักพัง** ⇒ catch แล้วปล่อยเป็น null (= ยังไม่รู้) */
      const u = await fetch('/api/web/core?shopeeunlisted=1')
        .then((x) => x.json()).catch(() => null)
      setData({ ...r, unlisted: (u && !u.error && u.unlisted) ? u.unlisted : null })
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const checked = Array.isArray(data?.checkedMarketplaces) ? data!.checkedMarketplaces! : []
  const isChecked = (id: string) => checked.some((c) => String(c).toLowerCase() === id)
  const why = (id: string) =>
    (data?.marketplacesFailed?.[id] ?? data?.marketplacesNotConnected?.[id] ?? '').trim()
  const d_unlisted = data?.unlisted ?? null
  const countOf = (id: string): Counts | null => {
    const c = data?.marketplaceCounts
    if (!c || typeof c !== 'object') return null
    const v = c[id]
    return v && typeof v === 'object' ? v : null
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="Marketplace Dashboard"
        summary={
          <>
            ร้านที่ผูกไว้กับแต่ละแพลตฟอร์ม และจำนวนสินค้าที่เรามองเห็นบนเจ้านั้น
            {thaiHm(data?.marketplacesAt) && (
              <> {' | '} ถามแพลตฟอร์มล่าสุด <b>{thaiHm(data?.marketplacesAt)} น.</b>
                <span className="text-gray-400"> (เวลาไทย)</span></>
            )}
          </>
        }
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* ผัง ZORT มีปุ่มน้ำเงิน "จัดการการเชื่อมต่อ" มุมขวาบน — ของเราชี้ไปจอช่องทางขาย */}
            <Link href="/core/channels"
              className="text-[12.5px] font-semibold text-white bg-blue-600 rounded-md px-3.5 py-1.5 hover:bg-blue-700">
              จัดการการเชื่อมต่อ
            </Link>
          </>
        }
      />

      {error && <ErrorBox title="ดึงข้อมูลแพลตฟอร์มไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && !error && (
        <>
          {/* 🔴 เจ้าที่ "ตอบมาแล้วแต่เลขยังผิด" อันตรายที่สุด เพราะการ์ดวาดตัวเลขตามปกติทุกประการ */}
          {Object.entries(data.marketplacesUnreliable ?? {}).map(([k, reason]) => (
            <div key={k} className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 leading-relaxed">
              🔴 <b>เลขของ {k} เชื่อไม่ได้ตอนนี้</b> — {reason}{' '}
              <b>อย่าใช้ตัวเลขในการ์ด {k} ตัดสินใจจนกว่าจะแก้เสร็จ</b>
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => {
              const ok = isChecked(p.id)
              const c = countOf(p.id)
              const listed = c?.listed
              const hasNumber = typeof listed === 'number'
              return (
                <Card key={p.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-[15px] font-bold ${p.tone}`}>{p.emoji} {p.name}</span>
                    {/* ZORT มีปุ่ม "จัดการร้าน" ต่อแพลตฟอร์ม — ของเราไม่มีจอจัดการรายร้าน
                        ⇒ โชว์ตามผังแต่ล็อกไว้พร้อมเหตุผล ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก */}
                    <span title="ZORT มีจอจัดการรายร้าน — ของเรายังไม่มี (ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้)"
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-gray-100 text-gray-500 shrink-0">
                      จัดการร้าน
                    </span>
                  </div>

                  <p className="text-[12.5px] text-gray-500">
                    {c?.store || <span className="text-gray-400">ท่อยังไม่ส่งชื่อร้านมา</span>}
                  </p>

                  <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-[12.5px] text-gray-600 leading-snug">
                      ลงขายอยู่ตอนนี้
                      <span className="block text-[11px] text-gray-400">
                        นับเฉพาะที่เปิดขายจริง — ZORT นับ &ldquo;ที่เชื่อมต่อไว้&rdquo; จึงมากกว่า
                      </span>
                    </span>
                    <span className="text-[26px] font-bold text-gray-900 leading-none shrink-0">
                      {hasNumber ? fmtNum(listed) : '—'}
                    </span>
                  </div>

                  {typeof c?.variants === 'number' && (
                    <p className="text-[11.5px] text-gray-500 mt-1.5">
                      คิดเป็น <b>{fmtNum(c.variants)}</b> ตัวเลือก (แพลตฟอร์มขายที่ระดับตัวเลือก)
                    </p>
                  )}

                  {/* ⚠️ ไม่มีเลข ต้องแยกให้ชัดว่า "ยังไม่ได้เชื่อม" กับ "เชื่อมแล้วแต่ท่อยังไม่ส่งเลข"
                      สองอย่างนี้คนละงานคนละคน — เขียนรวมกันว่า "ไม่มีข้อมูล" คนอ่านเลิกตามทั้งคู่ */}
                  {!hasNumber && (
                    <p className="text-[11.5px] mt-2 leading-relaxed">
                      {ok
                        ? <span className="text-amber-700">
                            เชื่อมแล้วและถามได้ แต่ <b>ท่อยังไม่ส่งตัวเลขรวมของเจ้านี้มา</b> —
                            ตอนนี้ดูรายตัวได้ที่คอลัมน์ Marketplace ในจอสินค้า
                          </span>
                        : <span className="text-gray-500">
                            <b className="text-amber-700">ยังเช็คเจ้านี้ไม่ได้</b>
                            {why(p.id) ? <> — {why(p.id)}</> : null}
                          </span>}
                    </p>
                  )}
                </Card>
              )
            })}
          </div>

          {/* 🔴 **เลิกเทียบกับเลขของ ZORT บนจอนี้ — 18 ก.ย. 2569**
              เดิมการ์ดนี้ชื่อ "ทำไมเลขไม่เท่าจอเดียวกันของ ZORT" แล้วอธิบายว่า
              "ZORT นับสินค้าที่เชื่อมต่อ · เรานับที่ลงขายจริง" ⇒ **นั่นเป็นคำอธิบายที่เราเดาเอง ยังพิสูจน์ไม่ได้**
              ไล่หาตัวนับของ ZORT วันนี้แล้วไม่มีให้วัด: `/Integration/Main` มีแต่รายชื่อช่องทาง+สัดส่วนกระจายสินค้า ·
              `/Integration/Detail` รายช่องทางมีแต่รายการงานซิงก์กับวันที่ · `/Product/list` ไม่มีตัวกรองตามช่องทาง
              ⇒ **เทียบกับเลขที่เราไม่รู้ขอบเขต = สร้างส่วนต่างที่ไม่มีใครอธิบายได้** (เพิ่งโดนมาแล้วกับใบโอน 194 ใบ
                 ที่คำอธิบายเดาไว้ว่า "API ไม่ส่ง" แล้วค้างเป็นปริศนา 15 วัน)
              ⇒ จอนี้จึงบอก **ที่มาของเลขตัวเอง** แทนการเทียบ · ถ้าวันหนึ่งวัดเลข "ที่เชื่อมต่อ" ของ ZORT ได้จริง ค่อยเอากลับมาเทียบ */}
          {/* 🧺 **ของที่ถูกถอดจากหน้าร้าน Shopee แต่คลังยังมีของ** — เงินจมที่มองไม่เห็นจากจอไหนเลย
              เขียนตามกติกาสามข้อของฝั่งท่อ: หน่วยกำกับทุกเลข · "ยังไม่รู้" แยกกอง · โชว์อายุข้อมูล */}
          {d_unlisted && (
            <Card>
              <p className="text-[13px] font-semibold text-gray-700 mb-1">
                Shopee · ถอดจากหน้าร้านแล้ว แต่คลังเรายังมีของ
              </p>
              {/* 🔴 **ประตูต้องถามทีละกอง ไม่ใช่กองแรกกองเดียว** — ของเดิมคุมทั้งใบด้วย `itemsWithStock`
                  ⇒ วันที่ท่อส่งเลข "ตัวเลือก" มาแต่ไม่ส่งเลข "สินค้า" การ์ดจะซ่อนของที่มีอยู่จริงทั้งหมด
                  เป็นบั๊กคลาสเดียวกับที่เพิ่งแก้ให้จอลูกค้ารายคนคืนนี้ (`92e77be`) และรอดมาในโค้ดของตัวเอง
                  [[empty-state-must-ask-every-group-in-the-table]] */}
              {typeof d_unlisted.itemsWithStock === 'number' && (
                <>
                  <p className="text-[12.5px] text-gray-700 leading-relaxed">
                    <b className="text-[19px] text-amber-700">{fmtNum(d_unlisted.itemsWithStock)}</b>
                    {' '}<b>สินค้า</b> ที่ Shopee ถอดจากหน้าร้านแล้ว แต่<b>คลังเรายังมีของ</b>
                    {typeof d_unlisted.items === 'number' && <> · จากที่ถูกถอดทั้งหมด <b>{fmtNum(d_unlisted.items)}</b> สินค้า</>}
                  </p>
                  <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
                    ไม่มีของในคลัง <b>{fmtNum(d_unlisted.itemsNoStock)}</b> สินค้า ·
                    {' '}<b className="text-amber-700">ยังไม่รู้ว่ามีของไหม {fmtNum(d_unlisted.itemsUnknown)}</b> สินค้า
                    {' '}<span className="text-gray-400">(ส่วนใหญ่เพราะไม่ได้กรอกรหัสสินค้าไว้บน Shopee — “ยังไม่รู้” ไม่ใช่ “ไม่มี”)</span>
                  </p>
                </>
              )}

              {/* หน่วยที่สองต้องเขียนแยกให้ชัด ห้ามเอาไปปนกับเลขสินค้า · และมีประตูของตัวเอง */}
              {typeof d_unlisted.skus === 'number' && (
                    <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
                      นับเป็น<b>ตัวเลือก</b> (คนละหน่วยกับ “สินค้า” ข้างบน): ทั้งหมด {fmtNum(d_unlisted.skus)} ·
                      {' '}มีของ {fmtNum(d_unlisted.skusWithStock)} · ไม่มีของ {fmtNum(d_unlisted.skusNoStock)} ·
                      {' '}ยังไม่รู้ {fmtNum(d_unlisted.skusUnknown)}
                    </p>
              )}

              <p className="text-[11.5px] text-gray-400 mt-1.5 leading-relaxed">
                    เลข UNLIST ที่ Shopee ประกาศเอง {fmtNum(d_unlisted.declaredByShopee)} สินค้า
                    {d_unlisted.sawAll === false && <b className="text-amber-700"> · ⚠️ ดึงมาได้ไม่ครบ</b>}
                    {/* 🗓️ ค่าดิบเก็บไว้ใน title ให้ตรวจย้อนได้ — จอโชว์วันไทยเสมอ (ด่าน check-thai-date จับได้ตอน build) */}
                    {d_unlisted.stockDay && (
                      <> · ยอดคงเหลือ ณ วันที่ <span title={`ค่าที่ท่อส่งมา: ${d_unlisted.stockDay}`}>{thaiDate(d_unlisted.stockDay)}</span></>
                    )}
                    {d_unlisted.recipeAt && (
                      <> · สูตรสินค้าชุดเก็บเมื่อ <span title={`ค่าที่ท่อส่งมา: ${d_unlisted.recipeAt}`}>{thaiDate(String(d_unlisted.recipeAt).slice(0, 10))}</span></>
                    )}
                    {' '}— <b>ไม่ใช่เวลาที่เปิดจอนี้</b>
                  </p>
                  {/* ⏳ เตือนเมื่อข้อมูลเริ่มเก่า — คิดตอนเรนเดอร์ ⇒ **หายเองเมื่อข้อมูลสด**
                      (คำเตือนที่ผูกกับข้อมูลจริงไม่เน่า ต่างจากคำเตือนที่ฝังไว้ตายตัว) */}
                  {(() => {
                    const อายุสต็อก = อายุวัน(d_unlisted.stockDay)
                    const อายุสูตร = อายุวัน(d_unlisted.recipeAt)
                    const เตือน: string[] = []
                    if (อายุสต็อก !== null && อายุสต็อก >= 1) เตือน.push(`ยอดคงเหลือเก่า ${อายุสต็อก} วัน`)
                    if (อายุสูตร !== null && อายุสูตร >= 14) เตือน.push(`สูตรสินค้าชุดเก็บมา ${อายุสูตร} วันแล้ว`)
                    if (!เตือน.length) return null
                    return (
                      <p className="text-[11.5px] text-amber-800 mt-1">
                        ⏳ <b>{เตือน.join(' · ')}</b> — ของอาจขายออกหรือรับเข้าไปแล้วหลังจากนั้น
                        {' '}⇒ ใช้เป็นรายการตั้งต้นให้ไปเช็คของจริง ไม่ใช่ยอดสด
                      </p>
                    )
                  })()}
                  {Array.isArray(d_unlisted.withStock) && d_unlisted.withStock.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[12px] text-blue-600 cursor-pointer">ดูรายชื่อสินค้าที่ยังมีของ</summary>
                      <ul className="mt-1 text-[12px] text-gray-600 list-disc pl-5 space-y-0.5">
                        {d_unlisted.withStock.slice(0, 12).map((x, i) => (
                          <li key={`${x.itemId ?? i}`}>{x.name ?? '—'}</li>
                        ))}
                      </ul>
                      {/* 🔴 **ห้ามใช้ความยาวของรายการเป็น "ทั้งหมด"** — รายการอาจถูกท่อตัดมา
                          ตัวเลขที่เชื่อได้คือ `itemsWithStock` ซึ่งท่อนับจากทั้งชุด
                          (คลาสเดียวกับที่เจอทั้งคืน: เลขจากลิสต์ที่ถูก cap ห้ามเอาไปใช้เป็นยอดรวม) */}
                      {(() => {
                        const แสดง = Math.min(12, d_unlisted.withStock!.length)
                        const ทั้งหมด = typeof d_unlisted.itemsWithStock === 'number' ? d_unlisted.itemsWithStock : null
                        const ส่งมา = d_unlisted.withStock!.length
                        if (ทั้งหมด === null) {
                          return ส่งมา > แสดง
                            ? <p className="text-[11.5px] text-gray-400 mt-1">แสดง {แสดง} จาก {fmtNum(ส่งมา)} ที่ท่อส่งมา (ยังไม่รู้ยอดทั้งชุด)</p>
                            : null
                        }
                        return (
                          <p className="text-[11.5px] text-gray-400 mt-1">
                            แสดง {แสดง} จากทั้งหมด {fmtNum(ทั้งหมด)} สินค้า
                            {ส่งมา < ทั้งหมด && (
                              <b className="text-amber-700"> · ท่อส่งรายชื่อมาแค่ {fmtNum(ส่งมา)} ⇒ รายชื่อนี้ยังไม่ครบ</b>
                            )}
                          </p>
                        )
                      })()}
                    </details>
                  )}
              {/* ข้อความ "ยังไม่รู้" ขึ้นเฉพาะตอน **ไม่มีสักกองเลย** ไม่ใช่ตอนกองใดกองหนึ่งหาย */}
              {typeof d_unlisted.itemsWithStock !== 'number' && typeof d_unlisted.skus !== 'number' && (
                <p className="text-[12.5px] text-gray-500">ท่อยังไม่ส่งตัวเลขกลุ่มนี้มา — <b>ยังไม่รู้</b> ไม่ใช่ว่าไม่มี</p>
              )}
              <p className="text-[11.5px] text-gray-400 mt-2">
                🚫 ตอนนี้มีเฉพาะ <b>Shopee</b> — Lazada/TikTok ยังไม่มีเส้นแบบนี้ ⇒ <b>ห้ามอ่านว่าเป็นภาพรวมทุกเจ้า</b>
              </p>
            </Card>
          )}

          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-2">เลขบนจอนี้มาจากไหน</p>
            <ul className="text-[12.5px] text-gray-600 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>
                ถามจาก <b>API ของแต่ละแพลตฟอร์มโดยตรง</b> (ด้วยรหัสของร้านเราเอง) ⇒ คือ
                {' '}<b>สินค้าที่ลงขายอยู่จริง ณ เวลาที่เปิดจอ</b> ไม่ใช่ทะเบียนที่ผูกรหัสไว้
              </li>
              <li>
                ไม่ได้ผ่าน ZORT ⇒ วันที่ ZORT มีปัญหา เลขนี้ยังใช้ได้ (ไล่นับของจริง 4 ก.ย. 2569 — ครบทุกรหัส ไม่ตกหล่น)
              </li>
              <li className="text-gray-500">
                🚫 <b>จอนี้ไม่เทียบกับเลขในจอ ZORT โดยตั้งใจ</b> — ยังวัดไม่ได้ว่าเลขของเขานับอะไรบ้าง
                {' '}(ตรวจ 18 ก.ย. 2569: จอเชื่อมต่อของเขาไม่มีตัวนับสินค้า) ·
                {' '}เทียบกับเลขที่ไม่รู้ขอบเขตจะได้ส่วนต่างที่อธิบายไม่ได้
              </li>
            </ul>
          </Card>

          <p className="text-[11.5px] text-gray-400 leading-relaxed">
            จอนี้อ่านค่าจากท่อล้วน ๆ ไม่มีตัวเลขไหนเขียนตายตัวไว้ในหน้าจอ —
            วันที่แพลตฟอร์มตอบไม่ได้ การ์ดจะขึ้นขีดพร้อมเหตุผล ไม่ใช่เลขเก่าค้างจอ
          </p>
        </>
      )}
    </div>
  )
}
