'use client'
// ดูภาพรวมหมวดหมู่ — คู่กับ /Product/CategoryDetail ของ ZORT (แบบแผนข้อ 6: มีหน้า "ดูภาพรวม"
// แยกจาก list · จาก parity-zort-clickability.md 8 ก.ย. 2569)
//
// 🔴 **ประกอบจากเส้นที่มีอยู่แล้ว ไม่มีเส้นใหม่**: list=categories (ตัวเลขระดับหมวด)
//    + list=stock&category=<ชื่อ> (สินค้าในหมวด) — ที่เปิดไว้ตอนทำลิงก์หมวดหมู่
//    ⇒ ไม่ต้องรอท่อ · ข้อดีแถม: ตัวเลขสองแหล่งต้องตรงกัน ถ้าไม่ตรง = จอบอกให้เห็น
//
// ⚠️ ค่า zortValue/zortAvailable/zortSkus เป็น **ค่าที่คัดมือจากจอ ZORT** (API ไม่เปิดให้ดึง)
//    ⇒ เก่าได้ · จอต้องเขียนกำกับ ห้ามโชว์ปนกับค่าที่คิดสดจากกระจกโดยไม่บอก
// ⚠️ หมวด "(ยังไม่ได้จัดหมวดใน ZORT)" = แถว category ว่างในกระจก ไม่ใช่หมวดจริงของ ZORT
import { IconEdit, IconTrash } from '@/components/zort/ButtonIcons'
import { HEAD_BTN } from '@/components/zort/headBtn'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ExportButton from '@/components/zort/ExportButton'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { fmtMoney, fmtNum, ต้นเดือนย้อนหลังแบบZORT, วันนี้วันไทย } from '@/lib/format'
import { PageHead, BtnGhost, Pill, TableWrap, TH, TD, DETAIL_BTN } from '@/components/zort'
import ZortKpiCards from '@/components/zort/ZortKpiCards'
import { DETAIL_BTN_OFF } from '@/components/zort/headBtn'
import { คลาสตัวเลือก } from '@/components/zort/formCtl'
import ZortCardTitle from '@/components/zort/ZortCardTitle'
import ZortBarChart from '@/components/zort/ZortBarChart'
import ZortLookFold from '@/components/zort/ZortLookFold'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'
/** ที่มาของยอดในกราฟรายเดือน — ใช้ทั้งสองโหมด (ข้อความเดียว ที่เดียว) */
const ที่มายอดรายเดือน = 'ร้าน z1 · ยอดบรรทัดสินค้า รวมใบค้างจ่าย ยังไม่หักใบคืน ⇒ สูงกว่าจอ ZORT ได้ · เดือนนี้นับถึงวันนี้'

interface CatRow {
  name: string; skus?: number
  zortValue?: number | null; zortAvailable?: number | null; zortSkus?: number | null
  onhand_value?: number; available_value?: number
  onhand_value_sell?: number; available_value_sell?: number
  no_cost?: number; services?: number; zort?: boolean
}
interface StockRow {
  sku?: string; name?: string; onhand?: number; available?: number
  /** 🔴 ท่อส่งคงเหลือมาในชื่อ `qty` (ไม่ใช่ onhand) — เดิมจออ่าน onhand อย่างเดียว ⇒ คอลัมน์คงเหลือขีดทุกแถว (เจอ 16 ต.ค. 2569) */
  qty?: number
  price?: number; cost?: number
}

const NUM = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** เพดานของท่อคือ 200 ต่อคำขอ (core-stock.mjs) — ขอมากกว่านี้ไม่ได้ จึงใช้เป็นขนาดหน้าเลย */
const PAGE = 200

function Inner() {
  const catName = useSearchParams().get('name') ?? ''
  const [cat, setCat] = useState<CatRow | null>(null)
  const [items, setItems] = useState<StockRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  /** ยอดขายเดือนที่แล้ว/เดือนนี้ของหมวด — topproducts&by=category ร้าน z1 (บัญชีเดียวกับจอ ZORT) · null = ยังไม่รู้ */
  const [เดือน, setเดือน] = useState<{ ก่อน: number | null; นี้: number | null; ผิด?: string } | null>(null)
  /** 🏆 สินค้าขายดีย้อนหลังของหมวด — ZORT `bestsalestype` วันนี้/7 วัน/1 เดือน/3 เดือน (ค่าตั้งต้น 7 วันตามหัวการ์ด ZORT) */
  const [ขายดีวัน, setขายดีวัน] = useState(7)
  const [ขายดี, setขายดี] = useState<{ rows: { sku: string; name?: string; qty?: number; amount?: number | null }[]; from: string; to: string; more: boolean } | null>(null)
  const [ขายดีผิด, setขายดีผิด] = useState('')
  const [ขายดีรายละเอียด, setขายดีรายละเอียด] = useState('')
  /** 📈 กราฟยอดขายรายเดือนของหมวด — topproducts&by=month&category= (ท่อแก้ 16 ต.ค. 2569 ให้ by=month กรองหมวดได้) */
  const [รายเดือน, setรายเดือน] = useState<{ month: string; amount: number | null }[] | null>(null)
  const [รายเดือนผิด, setรายเดือนผิด] = useState('')

  /* 🔴 **หนึ่งคำขอต่อการกดหนึ่งครั้ง — ห้ามวนกวาดทุกหน้ามานับเอง**
     ท่อ cap limit ไว้ 200 ตายตัว และส่ง total ของหมวดมาให้แล้ว ⇒ ใช้ total ปิดปุ่ม
     ท่าเดียวกับจอสินค้า/รายการขาย (ดู stock/page.tsx: shown = offset + rows.length) */
  /* 📅 การ์ดยอดขายสองเดือนแบบ ZORT — ไล่ nextOffset ของท่อจนเจอหมวดนี้ (ไม่ส่ง limit เอง)
     ⚠️ ยอดเราตัดใบค้างจ่ายแล้ว (unpaidAmount ต่อแถว) แต่ **ยังไม่หักใบคืน** (ท่อทำรายแถวไม่ได้) ⇒ ZORT ต่ำกว่าได้ · เขียนบนการ์ด
     📏 วัด 16 ต.ค. 2569 โซ่ NEWWAVE: ก.ย. เรา 112,878.15 vs ZORT 108,935.33 · ต.ค. 52,751.38 vs 50,764.10 */
  useEffect(() => {
    if (!catName) return
    let ยกเลิก = false
    const หา = async (from: string, to: string): Promise<number | null> => {
      let off = 0
      for (let i = 0; i < 20; i++) {
        const r = await fetch(`/api/web/core?list=topproducts&by=category&store=z1&from=${from}&to=${to}&offset=${off}`).then((x) => x.json())
        if (!r || !Array.isArray(r.items)) throw new Error(r?.error || 'ท่อไม่ส่งแถวมา')
        const row = r.items.find((x: { category?: string }) => x.category === catName)
        if (row) return typeof row.amount === 'number' ? row.amount - (typeof row.unpaidAmount === 'number' ? row.unpaidAmount : 0) : null
        if (typeof r.nextOffset !== 'number') return 0 /* ไล่ครบทุกหมวดแล้วไม่เจอ = ช่วงนั้นหมวดนี้ไม่มียอดจริง */
        off = r.nextOffset
      }
      return null
    }
    const วันนี้ = วันนี้วันไทย()
    const ต้นเดือนนี้ = ต้นเดือนย้อนหลังแบบZORT(0) ?? `${วันนี้.slice(0, 7)}-01`
    const ต้นเดือนก่อน = ต้นเดือนย้อนหลังแบบZORT(1) ?? ''
    const สิ้นเดือนก่อน = new Date(Date.parse(ต้นเดือนนี้) - 864e5).toISOString().slice(0, 10)
    Promise.all([หา(ต้นเดือนก่อน, สิ้นเดือนก่อน), หา(ต้นเดือนนี้, วันนี้)])
      .then(([ก่อน, นี้]) => { if (!ยกเลิก) setเดือน({ ก่อน, นี้ }) })
      .catch((e) => { if (!ยกเลิก) setเดือน({ ก่อน: null, นี้: null, ผิด: String(e instanceof Error ? e.message : e) }) })
    return () => { ยกเลิก = true }
  }, [catName])

  /* 🏆 ขายดีของหมวด — topproducts&category= (ท่อ 4d82279c) · 🔴 แสดงแถวเฉพาะเมื่อท่อสะท้อน applied.category ตรงชื่อหมวด
     ท่อรุ่นที่ยังไม่รับ category จะคืนสินค้าทุกหมวดปนกัน ⇒ ถ้าไม่ตรวจ จอจะโชว์โซ่ KINGKONG ในหมวดโซ่ NEWWAVE เงียบ ๆ
     ช่วงเป็นจำนวนวันนับถอย (ยังไม่ได้วัดว่า 1/3 เดือนของ ZORT การ์ดนี้นับแบบปฏิทินหรือไม่) ⇒ เขียนช่วงจริงใต้ตาราง */
  useEffect(() => {
    if (!catName) return
    let ยกเลิก = false
    setขายดี(null); setขายดีผิด(''); setขายดีรายละเอียด('')
    const to = วันนี้วันไทย()
    /* 📏 ช่วงของ ZORT "7 วัน" วัดแล้ว (16 ต.ค. 2569 โซ่ NEWWAVE): วันนี้−7 ถึงวันนี้ (8 วันปฏิทิน) ตรงเป๊ะ 2/4 แถว
       อีก 2 แถวของเราสูงกว่าในทิศที่ใบคืนอธิบายได้ (ZORT หักใบคืน เรายังหักรายแถวไม่ได้) · ช่วง 7 วันนับรวมวันนี้ ตรง 1/4
       ⇒ ใช้ วันนี้−N · วันนี้ = วันเดียว · 1/3 เดือนยังไม่ได้วัด (ZORT คิดฝั่งเซิร์ฟเวอร์ ไม่เห็นสูตร) ⇒ จอเขียนช่วงจริงใต้ตาราง */
    const from = new Date(Date.parse(to) - (ขายดีวัน === 1 ? 0 : ขายดีวัน) * 864e5).toISOString().slice(0, 10)
    fetch(`/api/web/core?list=topproducts&category=${encodeURIComponent(catName)}&store=z1&sort=qty&from=${from}&to=${to}`)
      .then((x) => x.json())
      .then((r) => {
        if (ยกเลิก) return
        /* ข้อความผิดพลาดดิบของท่อเป็นอังกฤษ/SQL — จอแสดงเหตุเป็นไทยสั้น ๆ ส่วนรายละเอียดเก็บไว้ใน title ให้คนตามบั๊กอ่าน */
        if (!r || !Array.isArray(r.items)) { setขายดีรายละเอียด(String(r?.error ?? '')); throw new Error('ระบบหลังบ้านตอบผิดพลาดรอบนี้ (ชี้ที่ข้อความนี้เพื่อดูรายละเอียด)') }
        if (r.applied?.category !== catName) throw new Error('ท่อรุ่นนี้ยังไม่กรองตามหมวด (applied.category ไม่ตรง) — ไม่แสดงเพื่อไม่ให้สินค้าหมวดอื่นปนเข้ามา')
        setขายดี({ rows: r.items, from, to, more: typeof r.nextOffset === 'number' })
      })
      .catch((e) => { if (!ยกเลิก) setขายดีผิด(String(e instanceof Error ? e.message : e)) })
    return () => { ยกเลิก = true }
  }, [catName, ขายดีวัน])

  /* 📈 ยอดขายรายเดือน 4 เดือนล่าสุดแบบ ZORT (ภาพจอ ZORT: ก.ค.–ต.ค.) · 🔴 แสดงเฉพาะเมื่อ applied.category ตรงหมวด
     ⚠️ ใช้ amount (ยอดบรรทัด รวมใบค้างจ่าย ยังไม่หักใบคืน) · ไม่ลบ unpaidAmount ของเส้นนี้ เพราะเส้น by=month คิดค้างจ่ายจากสถานะเอกสาร
        ซึ่งต่างนิยามกับ unpaidAmount ฐานการชำระเงิน (ท่อวัด 16 ต.ค.: 34,149.20 vs 6,240.00) ⇒ ห้ามปน */
  useEffect(() => {
    if (!catName) return
    let ยกเลิก = false
    setรายเดือน(null); setรายเดือนผิด('')
    const from = ต้นเดือนย้อนหลังแบบZORT(3) ?? ''
    const to = วันนี้วันไทย()
    fetch(`/api/web/core?list=topproducts&by=month&category=${encodeURIComponent(catName)}&store=z1&from=${from}&to=${to}`)
      .then((x) => x.json())
      .then((r) => {
        if (ยกเลิก) return
        if (!r || !Array.isArray(r.items)) throw new Error('ระบบหลังบ้านตอบผิดพลาดรอบนี้')
        if (r.applied?.category !== catName) throw new Error('ท่อรุ่นนี้ยังไม่กรองตามหมวด — ไม่วาดเพื่อไม่ให้ยอดทั้งร้านปนเข้ามา')
        /* สร้างช่องเดือนให้ครบ 4 เดือนก่อน แล้วเติม — ท่อส่งเฉพาะเดือนที่มียอด ไม่งั้นแกนเวลาจะข้ามเดือนที่ขายไม่ได้ */
        const มี = new Map<string, number>(r.items.map((x: { month: string; amount?: number }) => [x.month, typeof x.amount === 'number' ? x.amount : NaN]))
        const เดือนทั้งหมด: string[] = []
        for (let k = 3; k >= 0; k--) { const d = k === 0 ? `${to.slice(0, 7)}-01` : (ต้นเดือนย้อนหลังแบบZORT(k) ?? ''); เดือนทั้งหมด.push(d.slice(0, 7)) }
        setรายเดือน(เดือนทั้งหมด.map((m) => {
          const v = มี.has(m) ? มี.get(m)! : 0
          return { month: m, amount: Number.isFinite(v) ? v : null }
        }))
      })
      .catch((e) => { if (!ยกเลิก) setรายเดือนผิด(String(e instanceof Error ? e.message : e)) })
    return () => { ยกเลิก = true }
  }, [catName])

  const load = useCallback(async (off = 0) => {
    if (!catName) { setError('ไม่ได้ระบุหมวด (ต้องเปิดจากจอหมวดหมู่)'); setLoading(false); return }
    setLoading(true); setError(''); setWarn('')
    try {
      /* ยิงสองเส้นพร้อมกัน — เส้นไหนล้มบอกเฉพาะเส้นนั้น ไม่ทำให้ทั้งจอว่าง */
      const [cRes, sRes] = await Promise.allSettled([
        fetch('/api/web/core?list=categories').then((r) => r.json()),
        fetch(`/api/web/core?list=stock&category=${encodeURIComponent(catName)}`
          + `&limit=${PAGE}&offset=${off}&marketplaces=1`).then((r) => r.json()),
      ])

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value?.rows)) {
        const hit = (cRes.value.rows as CatRow[]).find((r) => r.name === catName) ?? null
        setCat(hit)
        if (!hit) setWarn(`ไม่พบหมวด "${catName}" ในรายการหมวดหมู่ — อาจถูกลบ/เปลี่ยนชื่อหลังคุณเปิดหน้ามา`)
      } else setWarn('ดึงตัวเลขระดับหมวดไม่ได้ — ตารางสินค้าข้างล่างยังใช้ได้')

      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value?.rows)) {
        setItems(sRes.value.rows as StockRow[])
        setTotal(NUM(sRes.value.total))
        // ขยับตัวชี้หน้า **หลังคำขอสำเร็จเท่านั้น** — ล้มแล้วขยับ = ปุ่มกับของบนจอไม่ตรงกัน
        setOffset(off)
      } else {
        setItems(null)
        throw new Error('ดึงรายการสินค้าในหมวดนี้ไม่ได้')
      }
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [catName])
  // เปลี่ยนหมวด = กลับไปหน้าแรกเสมอ (หมวดใหม่ไม่มีเหตุผลให้เริ่มที่หน้า 2 ของหมวดเก่า)
  useEffect(() => { load(0) }, [load])

  /* ตัวเลขสองแหล่งต้องตรงกัน — ไม่ตรง = บอกให้เห็น ไม่ใช่เลือกข้างเงียบ ๆ
     (จำนวน SKU จาก list=categories vs total จาก list=stock&category) */
  const catSkus = NUM(cat?.skus)
  const mismatch = catSkus !== null && total !== null && catSkus !== total
  /** ดูไปแล้วถึงแถวที่เท่าไหร่ (นับจากหน้าแรก) — ตัวเดียวกับที่จอสินค้าใช้ปิดปุ่ม "ถัดไป" */
  const seen = offset + (items?.length ?? 0)

  return (
    <div className="p-4 md:p-6">
      <p className={เหมือนZORT ? "font-['Kanit',sans-serif] text-[14px] mb-1" : 'text-[12.5px] mb-2'}><Link href="/core/categories" className="text-[#337ab7] hover:underline">‹ หมวดหมู่</Link></p>
      <PageHead
        title={เหมือนZORT ? <span className="text-[#337ab7]">{catName || '—'}</span> : (catName || '—')} /* 📐 ZORT: ชื่อหมวดเป็นลิงก์สีน้ำเงิน 30/500 #337ab7 (วัด DOM 19 ต.ค. 2569) */
        summary={<span className="text-gray-500">รายละเอียดหมวดหมู่</span>}
        actions={เหมือนZORT ? undefined :
          <div className="flex items-center gap-2">
            <Link href={`/core/stock?category=${encodeURIComponent(catName)}`}
              className={HEAD_BTN} style={{ background: '#4165ed' }}>
              เปิดในจอสินค้า
            </Link>
            {/* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — ZORT ไม่มีปุ่มรีเฟรชในจอไหนเลยที่อ่านมา */}
          </div>
        }
      />

      {/* 📐 โหมดเหมือน ZORT (ภาพ /Product/CategoryDetail 19 ต.ค. 2569): ปุ่มกรอบเหลี่ยมใต้หัวจอ (ZORT มี แก้ไข · ลบ — ของเราไม่มี เพราะเขียนกลับ ZORT)
             ⇒ วางปุ่มของเราที่ตำแหน่งเดียวกันแทนปุ่มกลมมุมขวา */}
      {เหมือนZORT && (
        <div className="flex items-center gap-2 mb-6">
          {/* 📏 ZORT มี แก้ไข · ลบ ตรงนี้ (DOM 20 ต.ค. 2569: ปุ่มกรอบ สูง 39 Kanit 14 มีไอคอน) — ของเราแก้/ลบหมวดต้องเขียนกลับ ZORT ⇒ วาดไว้แต่กดไม่ได้ เหตุใน title
              ไอคอนวาดเอง · ปุ่ม เปิดในจอสินค้า ของเราต่อท้าย */}
          <span title="ยังทำไม่ได้ — แก้หมวดต้องเขียนกลับ ZORT" className={`${DETAIL_BTN_OFF} inline-flex items-center gap-1`}>
            <IconEdit />แก้ไข
          </span>
          <span title="ยังทำไม่ได้ — ลบหมวดต้องทำใน ZORT" className={`${DETAIL_BTN_OFF} inline-flex items-center gap-1`}>
            <IconTrash />ลบ
          </span>
          <Link href={`/core/stock?category=${encodeURIComponent(catName)}`} className={`${DETAIL_BTN} font-['Kanit',sans-serif]`}>เปิดในจอสินค้า</Link>
        </div>
      )}
      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'เปิดหมวดนี้ไม่ได้'}>{error}</ErrorBox>}
      {warn && !error && (
        <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">⚠️ {warn}</p>
      )}
      {loading && <LoadingState />}

      {!loading && !error && (
        <>
          {cat?.zort === false && (
            <p className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
              หมวดนี้<b>ไม่ได้มาจาก ZORT</b> — เป็นกลุ่มที่ระบบเราเดาจากชื่อสินค้า/รวมของที่ยังไม่ได้จัดหมวด
            </p>
          )}

          {/* 🗂 การ์ด 4 ใบตามผัง ZORT /Product/CategoryDetail (อ่านจอจริง 16 ต.ค. 2569):
              สินค้าคงเหลือ (บาท) · สินค้าพร้อมขาย (บาท) · ยอดขายเดือนที่แล้ว (บาท) · ยอดขายเดือนนี้ (บาท)
              สองใบแรก = ค่าที่คัดจากจอ ZORT (ต้นทุนเฉลี่ยที่ API ไม่เปิด) — บอกที่มาบนการ์ด · ค่าที่เราคิดเองย้ายไปบรรทัดรอง */}
          {/* 📐 โหมดเหมือน ZORT: การ์ดผังเดียวกับจอรายละเอียดสินค้า (วงไอคอนซ้าย ตัวเลขสีขวา) · สีตามภาพ ZORT:
                 คงเหลือ ฟ้า · พร้อมขาย เขียว · เดือนที่แล้ว ฟ้า · เดือนนี้ แดง · ที่มาของเลขย้ายไปบรรทัดพับ (หัวพับบอกเรื่องยอดสูงกว่า ZORT ไว้แล้ว) */}
          {เหมือนZORT && (() => {
            const ค่า = (v: number | null | undefined) => v === undefined ? 'กำลังถาม…' : v === null ? '—' : fmtMoney(v)
            const เดือนผิด = เดือน?.ผิด ? `ยังไม่รู้ — ${เดือน.ผิด}` : 'ยังไม่รู้'
            const ก่อน = เดือน ? เดือน.ก่อน : undefined, นี้ = เดือน ? เดือน.นี้ : undefined
            return (
              <div className="mb-4">
                <ZortKpiCards ขนาดเลข={20} items={[
                  { ป้าย: 'สินค้าคงเหลือ (บาท)', วง: '#ebf6ff', สี: '#2f8dde', รูป: '▦', ค่า: ค่า(NUM(cat?.zortValue)), ว่าง: NUM(cat?.zortValue) == null, เหตุ: 'คัดจากจอ ZORT (เก่าได้ ซื้อของเข้าแล้วต้องคัดใหม่)' },
                  { ป้าย: 'สินค้าพร้อมขาย (บาท)', วง: '#cefff1', สี: '#13af82', รูป: '✓', ค่า: ค่า(NUM(cat?.zortAvailable)), ว่าง: NUM(cat?.zortAvailable) == null, เหตุ: 'คัดจากจอ ZORT (เก่าได้)' },
                  { ป้าย: 'ยอดขายเดือนที่แล้ว (บาท)', วง: '#ebf6ff', สี: '#2f8dde', รูป: '฿', ค่า: ค่า(ก่อน), ว่าง: ก่อน == null, เหตุ: ก่อน === null ? เดือนผิด : 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้' },
                  { ป้าย: 'ยอดขายเดือนนี้ (บาท)', วง: '#ffebeb', สี: '#f25757', รูป: '฿', ค่า: ค่า(นี้), ว่าง: นี้ == null, เหตุ: นี้ === null ? เดือนผิด : 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้' },
                ]} />
                {/* กล่องพับที่มาของเลข ย้ายไปท้ายจอ (21 ต.ค. 2569) — ใต้การ์ดดันกราฟลง ~20 จาก ZORT · ยังเห็นบนจอ ไม่ถอด */}
              </div>
            )
          })()}
          {!เหมือนZORT && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {([
              ['สินค้าคงเหลือ (บาท)', NUM(cat?.zortValue), 'คัดจากจอ ZORT (เก่าได้ ซื้อของเข้าแล้วต้องคัดใหม่)'],
              ['สินค้าพร้อมขาย (บาท)', NUM(cat?.zortAvailable), 'คัดจากจอ ZORT (เก่าได้)'],
              ['ยอดขายเดือนที่แล้ว (บาท)', เดือน ? เดือน.ก่อน : undefined, 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้'],
              ['ยอดขายเดือนนี้ (บาท)', เดือน ? เดือน.นี้ : undefined, 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้'],
            ] as [string, number | null | undefined, string][]).map(([label, val, note]) => (
              <div key={label} className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[11.5px] text-gray-500">{label}</p>
                <p className="text-[18px] font-semibold text-gray-900 tabular-nums">
                  {val === undefined ? <span className="text-[12.5px] text-gray-300">กำลังถาม…</span>
                    : val === null ? <span className="text-[12.5px] text-gray-400">ยังไม่รู้{เดือน?.ผิด && label.startsWith('ยอดขาย') ? ` — ${เดือน.ผิด}` : ''}</span>
                    : fmtMoney(val)}
                </p>
                <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{note}</p>
              </div>
            ))}
          </div>}
          {/* ค่าที่เราคิดเองจากต้นทุนในกระจก — ไม่ใช่เลขของ ZORT (ต้นทุนคนละแบบ) ⇒ บรรทัดรอง พร้อมป้าย */}
          {!เหมือนZORT && <p className="text-[11.5px] text-gray-500 mb-4 leading-relaxed">
            ระบบเราคิดเอง (ไม่ใช่เลข ZORT): {catSkus === null ? '' : <>SKU <b>{fmtNum(catSkus)}</b> · </>}
            มูลค่าคงเหลือตามทุนในกระจก <b>{NUM(cat?.onhand_value) === null ? '—' : fmtMoney(cat!.onhand_value as number)}</b> ·
            {' '}พร้อมขาย <b>{NUM(cat?.available_value) === null ? '—' : fmtMoney(cat!.available_value as number)}</b> ·
            {' '}ตามราคาขาย <b>{NUM(cat?.onhand_value_sell) === null ? '—' : fmtMoney(cat!.onhand_value_sell as number)}</b>
            {NUM(cat?.zortSkus) !== null && <> · ZORT นับ SKU <b>{fmtNum(cat!.zortSkus as number)}</b></>}
          </p>}

          {/* 📈 ยอดขาย — การ์ดกราฟรายเดือนตามผัง ZORT (ตัวเลือก salesoption: ยอดขาย · กำไรจากการขาย) */}
          <div className={เหมือนZORT ? 'bg-white rounded-[6px] mb-4' : 'bg-white border border-gray-200 rounded-md mb-4'}>
            <div className={เหมือนZORT ? 'flex flex-wrap items-center gap-3 px-5 pt-5 pb-2' : 'flex flex-wrap items-center gap-3 px-4 pt-3 pb-2'}>
              {เหมือนZORT ? <div className="mr-auto"><ZortCardTitle รูป="▥">ยอดขาย</ZortCardTitle></div> : <p className="text-[14px] font-semibold text-gray-900 mr-auto">ยอดขาย</p>}
              {/* 📏 ZORT ตัวเลือกนี้ Boon 14 สูง 40 กว้าง 130 (DOM 20 ต.ค. 2569) */}
              <select value="sales" onChange={() => { /* มีค่าเดียวที่ทำได้จริง */ }}
                className={คลาสตัวเลือก("font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white max-w-full min-w-0", 'w-[130px] max-w-full')}>
                <option value="sales">ยอดขาย</option>
                <option value="profit" disabled>กำไรจากการขาย — ยังทำไม่ได้ (ต้องใช้ต้นทุนคงเหลือเฉลี่ยรายตัว)</option>
              </select>
            </div>
            {รายเดือนผิด ? (
              <p className="px-4 pb-3 text-[12.5px] text-gray-500">ยังแสดงไม่ได้ — {รายเดือนผิด}</p>
            ) : !รายเดือน ? (
              <p className="px-4 pb-3 text-[12.5px] text-gray-400">กำลังถาม…</p>
            ) : (() => {
              const สูงสุด = Math.max(1, ...รายเดือน.map((m) => m.amount ?? 0))
              const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
              /* โหมดเหมือน ZORT: กราฟมีแกนตั้ง + เส้นตาราง + คำอธิบายสี + ชื่อแกน "เดือน" (ZortBarChart)
                 · หมายเหตุที่มาของยอดยังอยู่ใต้กราฟ — ยอดของเราต่างจาก ZORT ได้ ต้องบอก */
              if (เหมือนZORT) return (
                <div className="px-5 pb-4">
                  {/* 📏 DOM ZORT /Product/CategoryDetail 20 ต.ค. 2569 (จอ 1280 CSS): กราฟ svg 777×265 เว้นข้างการ์ด ~96 · พื้นที่แท่งสูง ~165
                      (ลูกศร ‹ เลื่อนเดือนของ ZORT ไม่ทำ — ของเรายังไม่มีชุดเดือนก่อนหน้าให้เลื่อน = ปุ่มหลอก) */}
                  <div className={เหมือนZORT ? 'px-[96px]' : ''}>
                  <ZortBarChart legend={catName || '—'} สูง={เหมือนZORT ? 165 : 240}
                    points={รายเดือน.map((m) => ({ label: `${TH_M[Number(m.month.slice(5, 7)) - 1]}/${Number(m.month.slice(0, 4)) + 543}`, value: m.amount }))} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">{ที่มายอดรายเดือน}</p>
                </div>
              )
              return (
                <div className="px-4 pb-3">
                  <div className="flex items-end gap-3 h-[140px]">
                    {รายเดือน.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                        <span className="text-[10.5px] text-gray-500 tabular-nums mb-0.5">{m.amount === null ? '?' : fmtMoney(m.amount)}</span>
                        {m.amount === null
                          ? <div className="w-full max-w-[56px] h-full rounded-t bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#fff_4px,#fff_8px)]" title="ยังไม่รู้ยอด ไม่ใช่ 0" />
                          : <div className="w-full max-w-[56px] rounded-t bg-[#8ea8f8]" style={{ height: `${Math.max(2, (m.amount / สูงสุด) * 100)}%` }} />}
                        <span className="text-[11px] text-gray-500 mt-1">{TH_M[Number(m.month.slice(5, 7)) - 1]}/{Number(m.month.slice(0, 4)) + 543}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">{ที่มายอดรายเดือน}</p>
                </div>
              )
            })()}
          </div>

          {/* 🏆 สินค้าขายดีย้อนหลัง — ผังเดียวกับ ZORT (ชื่อสินค้า · จำนวนที่ขายได้ · ยอดขาย · เรียงจำนวนที่ขายได้) */}
          <div className="bg-white border border-gray-200 rounded-md mb-4">
            <div className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2">
              <p className="text-[14px] font-semibold text-gray-900 mr-auto">สินค้าขายดีย้อนหลัง {ขายดีวัน === 1 ? 'วันนี้' : ขายดีวัน === 7 ? '7 วัน' : ขายดีวัน === 30 ? '1 เดือน' : '3 เดือน'}</p>
              <select value={ขายดีวัน} onChange={(e) => setขายดีวัน(Number(e.target.value))}
                className={คลาสตัวเลือก("font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white max-w-full min-w-0", 'max-w-full')}>
                <option value={1}>วันนี้</option>
                <option value={7}>7 วัน</option>
                <option value={30}>1 เดือน</option>
                <option value={90}>3 เดือน</option>
              </select>
            </div>
            {ขายดีผิด ? (
              <p className="px-4 pb-3 text-[12.5px] text-gray-500" title={ขายดีรายละเอียด || undefined}>ยังแสดงไม่ได้ — {ขายดีผิด}</p>
            ) : !ขายดี ? (
              <p className="px-4 pb-3 text-[12.5px] text-gray-400">กำลังถาม…</p>
            ) : (
              <>
                <TableWrap>
                  <table className="w-full">
                    <thead className="bg-white border-b border-gray-200">
                      <tr><th className={TH}>ชื่อสินค้า</th><th className={`${TH} text-right`}>จำนวนที่ขายได้</th><th className={`${TH} text-right`}>ยอดขาย</th></tr>
                    </thead>
                    <tbody>
                      {ขายดี.rows.length === 0 && (
                        <tr><td colSpan={3} className="py-5 text-center text-[12.5px] text-gray-400">ช่วงนี้หมวดนี้ยังไม่มียอดขาย</td></tr>
                      )}
                      {ขายดี.rows.map((r) => (
                        <tr key={r.sku} className="border-b border-gray-100 last:border-0">
                          <td className={TD}><Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-[#337ab7] hover:underline">{r.name || r.sku}</Link></td>
                          <td className={`${TD} text-right tabular-nums`}>{NUM(r.qty) === null ? '—' : fmtNum(r.qty!)}</td>
                          <td className={`${TD} text-right tabular-nums`}>{NUM(r.amount) === null ? '—' : fmtMoney(r.amount!)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
                <p className="px-4 py-2 text-[11px] text-gray-400">
                  ช่วง {ขายดี.from} ถึง {ขายดี.to} · ร้าน z1 · ยอดบรรทัดสินค้า ยังไม่หักใบคืน
                  {ขายดี.more && ' · แสดงกลุ่มแรกที่ท่อส่งมา ยังมีรายการถัดไป'}
                </p>
                {/* 📤 Download Excel ใต้ตารางสินค้าขายดีแบบ ZORT (REA อ่าน /Product/CategoryDetail 20 ต.ค. 2569)
                    ยิงคำขอเองครบทุกหน้า (offset ต่อจาก nextOffset) ด้วยหมวด/ช่วง/ร้านเดียวกับตาราง — ไม่ใช่เอาแค่กลุ่มแรกบนจอ */}
                <div className="px-4 pb-3">
                  <ExportButton
                    label="Download Excel"
                    spec={{
                      filename: `สินค้าขายดี-${catName}`,
                      title: `สินค้าขายดี หมวด ${catName}`,
                      scope: `ช่วง ${ขายดี.from} ถึง ${ขายดี.to} · ร้าน z1`,
                      note: 'ยอดบรรทัดสินค้า ยังไม่หักใบคืน · เรียงตามจำนวนที่ขายได้',
                      header: ['รหัสสินค้า', 'ชื่อสินค้า', 'จำนวนที่ขายได้', 'ยอดขาย'],
                      fetchPage: async (offset, limit) => {
                        const r = await fetch(`/api/web/core?list=topproducts&category=${encodeURIComponent(catName)}&store=z1&sort=qty&from=${ขายดี.from}&to=${ขายดี.to}&offset=${offset}&limit=${limit}`).then((x) => x.json())
                        if (!r || !Array.isArray(r.items)) throw new Error(String(r?.error ?? 'ท่อตอบผิดรูป'))
                        if (r.applied?.category !== catName) throw new Error('ท่อรุ่นนี้ยังไม่กรองตามหมวด — ไม่ส่งออกเพื่อไม่ให้สินค้าหมวดอื่นปน')
                        return { rows: r.items as { sku: string; name?: string; qty?: number; amount?: number }[],
                          total: typeof r.totalSkus === 'number' ? r.totalSkus : null, done: typeof r.nextOffset !== 'number' }
                      },
                      toRow: (x) => [x.sku, x.name ?? null, NUM(x.qty), NUM(x.amount)],
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* 🏬 มูลค่าสินค้าคงเหลือ รายคลัง — ZORT แยก โกดัง/KLD/ANJ · กระจกเรามีแต่ยอดรวมทั้งร้าน
              ฝั่งท่อขอ (16 ต.ค. 2569): **ห้ามเอายอดรวมใส่ช่องโกดัง** — ตรงวันนี้เพราะของอยู่โกดังเกือบหมด แล้วจะผิดเงียบวันย้ายของ */}
          <div className="bg-white border border-gray-200 rounded-md px-4 py-3 mb-4">
            <p className="text-[14px] font-semibold text-gray-900">มูลค่าสินค้าคงเหลือ รายคลัง</p>
            <p className="text-[12.5px] text-gray-600 mt-1">
              รวมทุกคลัง <b>{NUM(cat?.zortValue) === null ? '—' : fmtMoney(cat!.zortValue as number)}</b> บาท (ค่าคัดจากจอ ZORT)
              {' '}· <span className="text-gray-500">ยังแยกรายคลังไม่ได้ — ระบบเราเก็บสต็อกเป็นยอดรวมทั้งร้าน</span>
            </p>
          </div>

          {mismatch && (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              ⚠️ <b>ตัวเลขสองแหล่งไม่ตรงกัน</b>: หน้าหมวดหมู่นับ {fmtNum(catSkus!)} SKU ·
              เส้นรายการสินค้าบอกว่าหมวดนี้มี {fmtNum(total!)} รายการ — น่าจะเป็นการนับคนละนิยาม
              (รวม/ไม่รวมรายการบริการ) · <b>ยังไม่สรุปว่าตัวไหนถูก</b>
              {/* เดิมเขียนว่า "อาจเป็นเพราะเพดานดึง 200" — ใช้ไม่ได้แล้วตั้งแต่จอนี้แบ่งหน้า
                  เพราะ total เป็นยอดของหมวดทั้งหมด ไม่ได้ถูกเพดานตัด (11 ก.ย. 2569) */}
            </p>
          )}

          {/* หัวตาราง: บอก "ช่วงที่กำลังดู จากทั้งหมด" ไม่ใช่แค่จำนวนแถวในหน้านี้
              (แถวที่ 1–200 จาก 218 อ่านรู้เรื่องกว่า "200 จาก 218" เมื่อมีหลายหน้า) */}
          <p className="text-[12.5px] font-semibold text-gray-700 mb-1.5">
            สินค้าในหมวดนี้{' '}
            {!items ? '' : total !== null && total > items.length
              ? `(แถวที่ ${fmtNum(offset + 1)}–${fmtNum(seen)} จาก ${fmtNum(total)})`
              : `(${fmtNum(items.length)})`}
          </p>
          {!items ? null : items.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-6 text-center">
              ไม่มีสินค้าในหมวดนี้ (หมวดมีอยู่จริงแต่ยังไม่มีสินค้าผูกอยู่)
            </p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[620px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                    <th className={`${TH} text-right`}>คงเหลือ</th><th className={`${TH} text-right`}>พร้อมขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.sku ?? i} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} font-mono text-[12.5px]`}>
                        {it.sku
                          ? <Link href={`/core/stock?q=${encodeURIComponent(it.sku)}`} className="text-[#337ab7] hover:underline">{it.sku}</Link>
                          : '—'}
                      </td>
                      <td className={TD}>{it.name || '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{(NUM(it.onhand) ?? NUM(it.qty)) === null ? '—' : fmtNum((NUM(it.onhand) ?? NUM(it.qty))!)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {NUM(it.available) === null ? '—'
                          : <span className={it.available! < 0 ? 'text-red-600 font-semibold' : ''}>{fmtNum(it.available!)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          {/* ปุ่มหน้า — โชว์เมื่อมีของเกินหนึ่งหน้าเท่านั้น (หมวดเล็กไม่ต้องมีปุ่มให้รำคาญ)
              ⚠️ ปิด "ถัดไป" ด้วย total ของท่อ ไม่ใช่ "หน้านี้ได้ครบ 200 ไหม" —
                 หน้าสุดท้ายที่ได้ครบ 200 พอดีจะทำให้ปุ่มเปิดค้างแล้วกดไปเจอหน้าว่าง */}
          {items !== null && total !== null && (total > PAGE || offset > 0) && (
            <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
              <p className="text-[11.5px] text-gray-400">
                ดึงได้ {fmtNum(PAGE)} รายการต่อครั้ง (เพดานของท่อ) · ดูทั้งหมดพร้อมตัวกรองได้ที่{' '}
                <Link href={`/core/stock?category=${encodeURIComponent(catName)}`} className="text-[#337ab7] hover:underline">จอสินค้า</Link>
              </p>
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || seen >= total}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          )}
          {/* 📐 โหมดเหมือน ZORT: กล่องพับที่มาของเลขบนการ์ด (เดิมอยู่ใต้การ์ด) */}
          {เหมือนZORT && (
                <div className="mt-4">
                  <ZortLookFold tone="gray" สรุป="ที่มาของเลข · ยอดขายของเราสูงกว่า ZORT ได้ (ยังไม่หักใบคืน)">
                    <p className="mt-1">สองใบแรกคัดจากจอ ZORT (เก่าได้ ซื้อของเข้าแล้วต้องคัดใหม่) · ยอดขาย: ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้</p>
                    <p className="mt-1">
                      ระบบเราคิดเอง (ไม่ใช่เลข ZORT): {catSkus === null ? '' : <>SKU <b>{fmtNum(catSkus)}</b> · </>}
                      มูลค่าคงเหลือตามทุนในกระจก <b>{NUM(cat?.onhand_value) === null ? '—' : fmtMoney(cat!.onhand_value as number)}</b> ·
                      {' '}พร้อมขาย <b>{NUM(cat?.available_value) === null ? '—' : fmtMoney(cat!.available_value as number)}</b> ·
                      {' '}ตามราคาขาย <b>{NUM(cat?.onhand_value_sell) === null ? '—' : fmtMoney(cat!.onhand_value_sell as number)}</b>
                      {NUM(cat?.zortSkus) !== null && <> · ZORT นับ SKU <b>{fmtNum(cat!.zortSkus as number)}</b></>}
                    </p>
                  </ZortLookFold>
                </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CategoryDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
