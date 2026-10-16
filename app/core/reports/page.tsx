'use client'
// รายงาน → สินค้า — **ลอกจาก `zort-ui/57-zort-รายงาน-สินค้า.jpg`**
// ผัง: ชื่อจอ "สินค้า" → สองการ์ดคู่ (สรุปมูลค่าสินค้าทั้งหมด | มูลค่าสินค้าคงเหลือรายคลัง) → สินค้าจม → สต็อกที่ต้องดู → ล็อตใกล้หมดอายุ (ลำดับตาม ZORT 16 ต.ค. 2569)
//      → การ์ด "สินค้าจม": รหัสสินค้า · สินค้า (หมวดหมู่ตัวเล็กใต้ชื่อ) · วันที่ขายล่าสุด ·
//        จำนวนคงเหลือ · มูลค่าสินค้าคงเหลือ (บาท)
//
// ⚠️ จอนี้เคยเป็นรายงาน "ยอดรายเดือน · ช่องทาง · สินค้าขายดี" ซึ่ง **ซ้ำกับจอยอดขาย**
//    และไม่ตรงกับชื่อเมนู (รายงาน → สินค้า) ⇒ จัดใหม่ตาม ZORT
//    ของเดิมไม่ได้หาย — การวิเคราะห์ยอดขายอยู่ที่ รายงาน → ยอดขาย (/sales) ครบอยู่แล้ว
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import ExportButton from '@/components/zort/ExportButton'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate,
} from '@/components/zort'

interface StockResp {
  skip?: string; day?: string; total?: number
  /** มูลค่าคิดจาก **ราคาขาย** */
  value?: number
  /** มูลค่าคิดจาก **ราคาทุนในทะเบียนสินค้า** */
  valueCost?: number
  /** จำนวนรหัสที่ยังไม่ได้กรอกราคาทุน — ทำให้ valueCost ต่ำกว่าความจริงเสมอ */
  noCostSkus?: number
}

// ⚠️ **ตัวเลขของ ZORT ที่เอาไว้เทียบ — วัดจากจอจริง ไม่ใช่คำนวณเอง**
//    ZORT ใช้ต้นทุนเฉลี่ยถ่วงน้ำหนัก (moving average) ซึ่ง API ไม่เปิดให้ดึง
//    ⇒ เราคิดให้ตรงไม่ได้ทั้งสองแบบ · ห้ามเลือกแบบที่ "ใกล้กว่า" แล้วเงียบ
const ZORT_STOCK_VALUE = 16424587.22
const ZORT_CHECKED_AT = '3 ก.ย. 2569'
interface DeadRow {
  sku: string; name?: string; category?: string
  lastSoldAt?: string | null; onhand?: number; value?: number
}
/** ค่าที่คัดมาจากจอหมวดหมู่ของ ZORT — ต้นทุนเฉลี่ยถ่วงน้ำหนักที่ API ไม่เปิดให้ดึง */
interface CatResp {
  zortTotalValue?: number; zortCollectedAt?: string; zortCategories?: number
  /** มูลค่าคงเหลือรายหมวด (ท่อส่งมาในคำตอบเดียวกัน) — ใช้กับมุมมอง "รายหมวดหมู่" ของการ์ดมูลค่า
   *  ⚠️ ฐานคนละอันกับมูลค่ารายคลัง (อันนั้นเป็นเลขที่ ZORT ตอบสด) ⇒ ผลรวมไม่เท่ากันได้ */
  rows?: { cat_name: string; skus?: number; onhand_value?: number }[]
}
interface DeadResp {
  skip?: string; days?: number; total?: number; rows?: DeadRow[]
  /** มูลค่ารวมของสินค้าจมทั้งชุด (คิดจากราคาขาย) */
  value?: number
  /** ประวัติใบขายที่คลังเงามีย้อนไปถึงวันไหน — **ตัวตัดสินว่าคำว่า "ไม่เคยขาย" แปลว่าอะไร** */
  historyFrom?: string
  enoughHistory?: boolean
  cut?: string
  /** ท่อบอกว่าเรียงแบบไหนจริง — ขอ lastsold (แบบ ZORT) · ไม่ตรง ⇒ จอต้องบอก */
  sortApplied?: string
  /** ไล่หน้า — ท่อตอบครั้งละ 50 (16 ต.ค. 2569: total 1,543 · rows 50) · **เดินหน้าด้วย nextOffset เท่านั้น** (pagingNote ของท่อ) */
  offset?: number; limit?: number; nextOffset?: number | null
}

/* ช่วง "สินค้าจม" — ให้ครบตามที่ ZORT มี (กดดูจอ ZORT เอง 16 ก.ย. 2569 · `tableoption` 5 ค่า)
   ⚠️ ท่อรับ `days` เป็นจำนวนเต็มอิสระอยู่แล้ว (ยิงตรวจ: days=7 ⇒ 1,981 · 30 ⇒ 1,789 · 90 ⇒ 1,568)
      ⇒ เพิ่มตัวเลือกได้เลย ไม่ต้องรอท่อ */
/* 🔄 **แก้ถ้อยคำให้ตรง ZORT เป๊ะ 4 ต.ค. 2569** — อ่าน DOM สด `/Dashboard/ProductReport`
   select `tableoption` ของเขาสะกดว่า **"สินค้าจมที่ขายไม่ได้มากกว่า N"** ทั้ง 5 ค่า
   เดิมของเราย่อเป็น "ขายไม่ได้เกิน N" ⇒ ความหมายเดียวกัน **แต่คนละคำ**
   ⚠️ กติกา zort-words: คำบนจอต้องเป็นคำเดียวกับ ZORT ห้ามแปลหรือย่อเอง
      เพราะคนที่ชิน ZORT ค้นหาจากคำ ไม่ใช่จากความหมาย */
/* 🗓 16 ต.ค. 2569: ZORT ตัด "N เดือน" แบบปฏิทิน (วันเดียวกันของ N เดือนก่อน) ไม่ใช่นับถอย 30/90 วัน
   ⇒ ท่อเพิ่ม `months=` ให้ (3841b6f7) · 7 วันยังเป็นจำนวนวันตามคำของ ZORT
   และ ZORT เรียง "วันที่ขายล่าสุด" ใหม่→เก่า ⇒ ส่ง `sort=lastsold` (ท่อตอบ sortApplied กลับมา) */
const DEAD_RANGES: { days: number; label: string; months?: number }[] = [
  { days: 7, label: 'สินค้าจมที่ขายไม่ได้มากกว่า 7 วัน' },
  { days: 30, label: 'สินค้าจมที่ขายไม่ได้มากกว่า 1 เดือน', months: 1 },
  { days: 90, label: 'สินค้าจมที่ขายไม่ได้มากกว่า 3 เดือน', months: 3 },
  { days: 180, label: 'สินค้าจมที่ขายไม่ได้มากกว่า 6 เดือน', months: 6 },
  { days: 365, label: 'สินค้าจมที่ขายไม่ได้มากกว่า 1 ปี', months: 12 },
]
/** พารามิเตอร์ช่วงของเส้น deadstock — ที่เดียว ใช้ทั้งโหลดแรก · เปลี่ยนหน้า · ส่งออก (สามที่ต้องตรงกันเสมอ) */
const deadQs = (days: number) => {
  const m = DEAD_RANGES.find((r) => r.days === days)?.months
  return `${m ? `months=${m}` : `days=${days}`}&sort=lastsold`
}

export default function CoreProductReportPage() {
  const [stock, setStock] = useState<StockResp | null>(null)
  const [dead, setDead] = useState<DeadResp | null>(null)
  const [cat, setCat] = useState<CatResp | null>(null)
  const [deadErr, setDeadErr] = useState('')
  const [catErr, setCatErr] = useState('')
  const [deadDays, setDeadDays] = useState(90)
  /** แถวแรกของหน้าที่เปิดอยู่ (ค่าที่ท่อตอบกลับ ไม่ใช่ค่าที่จอขอ) */
  const [deadBusy, setDeadBusy] = useState(false)
  /** 🏬 มูลค่าคงเหลือรายคลัง (ZORT มีการ์ดนี้) · `stockValue: null` = ยังไม่รู้ ห้ามนับเป็น 0 */
  const [whs, setWhs] = useState<{ code: string; name?: string; stockValue?: number | null; collectedDayTH?: string | null }[] | null>(null)
  /* 💰 **มูลค่าทั้งร้านที่ ZORT แสดง = ผลรวมมูลค่ารายคลังที่ ZORT ตอบ** (16 ต.ค. 2569: 16,179,086.88 + 1,562.32 + 0
     = 16,180,649.2 ตรงกับ "มูลค่าสินค้าทั้งหมด" บน /Dashboard/ProductReport เป๊ะ)
     🔴 เดิมใช้เลข ZORT_STOCK_VALUE ที่พิมพ์ค้างไว้ตั้งแต่ 3 ก.ย. แล้วจอเขียนว่า "เท่ากับที่ ZORT แสดงทั้งร้าน" ทุกวัน
        ทั้งที่ ZORT วันนี้ขึ้น 16,180,649.2 ไม่ใช่ 16,424,587.22 ⇒ คำกล่าวอ้างเน่าเงียบ (ใบ: เลขที่วัดได้ห้ามพิมพ์ค้างไว้)
     ⇒ ใช้ค่าสดเมื่อทุกคลังมีตัวเลข · คลังไหน null = ยังไม่รู้ ⇒ ไม่บวก ถอยไปใช้เลขเก่าพร้อมวันที่ */
  const ยอดZORTสด = Array.isArray(whs) && whs.length > 0 && whs.every((w) => typeof w.stockValue === 'number')
    ? Math.round(whs.reduce((a, w) => a + (w.stockValue as number), 0) * 100) / 100
    : null
  const ยอดZORT = ยอดZORTสด ?? ZORT_STOCK_VALUE
  const ยอดZORTเมื่อ = ยอดZORTสด !== null
    ? `ผลรวมรายคลังที่ ZORT ตอบ${whs?.[0]?.collectedDayTH ? ` (${thaiDate(whs[0].collectedDayTH)})` : ''}`
    : `ตรวจ ${ZORT_CHECKED_AT} — ดึงรายคลังรอบนี้ไม่ได้`
  const [whErr, setWhErr] = useState('')
  /** มุมมองการ์ดมูลค่าคงเหลือ — ผังเดียวกับ dropdown `typeoption` ของ ZORT */
  const [valueBy, setValueBy] = useState<'warehouse' | 'category'>('warehouse')
  /** 📉 ตัวนับสต็อกจากท่อ (`list=stock`) — ท่อส่งมาในคำตอบเดียว ไม่ต้องยิงแยก
   *  🔴 `outOfStock` ของท่อ = **คงเหลือ ≤ 0 (รวมติดลบ)** ส่วน "สินค้าหมด" ของ ZORT = 0 พอดี
   *     ⇒ จอต้องเขียนให้ตรงว่านับอะไร ห้ามตั้งชื่อว่า "สินค้าหมดแบบ ZORT"
   *  🔴 `low` = **เกณฑ์ของระบบเราเอง (คงเหลือ 1–3 ชิ้น)** ไม่ใช่จุดสั่งซื้อรายสินค้าแบบ ZORT
   *     ⇒ ต้องเขียนเกณฑ์ไว้ข้าง ๆ ทุกครั้ง (ฝั่งท่อกำชับ) */
  const [stockCounts, setStockCounts] = useState<{ outOfStock?: number; low?: number; negative?: number; total?: number } | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (days = deadDays) => {
    setLoading(true)
    setError('')
    try {
      const [sRes, dRes, cRes, wRes] = await Promise.all([
        fetch('/api/web/core?list=stock&limit=1').then((r) => r.json()),
        // ท่อนี้มีแล้ว · ล้มก็ไม่ทำให้ทั้งจอพัง แค่ตารางสินค้าจมว่าง
        // ⚠️ แต่ต้องจำไว้ว่า "ล้มเพราะอะไร" — ท่อพังกับไม่มีสินค้าจม เขียนเหมือนกันไม่ได้
        fetch(`/api/web/core?list=deadstock&${deadQs(days)}`).then((r) => r.json()).catch(() => null),
        // ค่าที่คัดจาก ZORT — ล้มก็แค่ไม่มีบรรทัดเทียบ ไม่ทำให้ทั้งจอพัง
        fetch('/api/web/core?list=categories').then((r) => r.json()).catch(() => null),
        /* 🏬 มูลค่าคงเหลือรายคลัง — ZORT มีการ์ดนี้ในจอเดียวกัน (typeoption: รายคลัง/รายหมวดหมู่)
           ⚠️ คลังที่ ZORT ไม่ส่งตัวเลขมา (`stockValue: null`) = **ยังไม่รู้ ไม่ใช่ 0** ⇒ แยกแถวไว้ */
        fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null),
      ])
      if (sRes?.error) throw new Error(sRes.error)
      setStock(sRes)
      /* 🔴 **ดึงไม่ได้ ≠ ไม่มีข้อมูล** (แก้ 5 ก.ย. 2569 ตอนไล่ตรวจทั้งระบบ)
         เดิมท่อหมวดหมู่ล้ม ⇒ cat = null ⇒ การ์ดมูลค่าตามต้นทุนเฉลี่ย **หายไปทั้งใบเงียบ ๆ**
         คนอ่านจะนึกว่าจอไม่มีข้อมูลนั้น ทั้งที่แค่ยิงไม่ผ่านรอบนี้ (โรคเดียวกับ deadstock ที่ข้าง ๆ กันมีตัวบอกแล้ว) */
      setCat(cRes && !cRes.error ? cRes : null)
      setCatErr(!cRes ? 'ยิงไปที่ท่อหมวดหมู่ไม่สำเร็จ' : (typeof cRes.error === 'string' ? cRes.error : ''))
      setStockCounts(sRes && typeof sRes.outOfStock === 'number'
        ? { outOfStock: sRes.outOfStock, low: sRes.low, negative: sRes.negative, total: sRes.total }
        : null)
      setWhs(wRes && Array.isArray(wRes.warehouses) ? wRes.warehouses : null)
      setWhErr(!wRes ? 'ยิงไปที่ท่อรายชื่อคลังไม่สำเร็จ'
        : (typeof wRes.error === 'string' ? wRes.error
          : (Array.isArray(wRes.warehouses) ? '' : 'ท่อตอบมาไม่ครบ (ไม่มีรายชื่อคลัง)')))
      setDead(dRes && !dRes.error ? dRes : null)
      setDeadErr(!dRes ? 'ยิงไปที่ท่อสินค้าจมไม่สำเร็จ' : (typeof dRes.error === 'string' ? dRes.error : ''))
    } catch (e) {
      setStock(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [deadDays])

  useEffect(() => { load() }, [load])

  /* 📄 ไล่หน้าสินค้าจม — ยิงเฉพาะเส้นนี้ ไม่โหลดทั้งจอใหม่ · offset มาจาก nextOffset ของท่อ (ห้ามบวก limit เอง) */
  const loadDeadPage = useCallback(async (offset: number) => {
    setDeadBusy(true)
    try {
      const r = await fetch(`/api/web/core?list=deadstock&${deadQs(deadDays)}&offset=${offset}`).then((x) => x.json()).catch(() => null)
      setDead(r && !r.error ? r : null)
      setDeadErr(!r ? 'ยิงไปที่ท่อสินค้าจมไม่สำเร็จ' : (typeof r.error === 'string' ? r.error : ''))
    } finally { setDeadBusy(false) }
  }, [deadDays])

  function downloadStockValue() {
    if (!stock) return
    const rows = [
      ['รายงานมูลค่าสินค้าทั้งหมด'],
      ['วันที่ภาพถ่ายสต็อก', stock.day ?? ''],
      ['จำนวนรายการ', String(stock.total ?? '')],
      // ⚠️ ไฟล์ที่โหลดออกไปก็ต้องกำกับวิธีคิด ไม่งั้นเลขหลุดออกไปลอย ๆ แล้วถูกเอาไปเทียบผิด
      ['มูลค่ารวม คิดจากราคาขาย (บาท)', String(stock.value ?? '')],
      ['มูลค่ารวม คิดจากราคาทุนในทะเบียนสินค้า (บาท)', String(stock.valueCost ?? '')],
      ['รหัสที่ยังไม่ได้กรอกราคาทุน', String(stock.noCostSkus ?? '')],
      ['ZORT แสดงเท่าไหร่ (ต้นทุนเฉลี่ยถ่วงน้ำหนัก)', String(ยอดZORT)],
      ['ที่มาของเลข ZORT', ยอดZORTเมื่อ],
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `มูลค่าสินค้าทั้งหมด-${stock.day ?? ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deadRows = (dead?.rows ?? []).filter((r) => {
    const s = q.trim().toLowerCase()
    return !s || String(r.sku ?? '').toLowerCase().includes(s) || (r.name ?? '').toLowerCase().includes(s)
  })

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้า"
        /* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — จอ ZORT /Dashboard/ProductReport ไม่มี (ภาพที่เก็บไว้) */
      />

      {error && <ErrorBox title="ดึงรายงานไม่ได้">{error}</ErrorBox>}
      {loading && !stock && <LoadingState />}

      {stock && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-[15px] font-semibold text-gray-900 mb-2">สรุปมูลค่าสินค้าทั้งหมด</p>
              <div className="flex flex-col items-center justify-center py-8">
                {/* ⚠️ **ต้องโชว์ทั้งสองแบบพร้อมป้ายกำกับ ห้ามโชว์ตัวเดียวลอย ๆ**
                    เลขนี้ต่างจาก ZORT หลายล้าน คนเปิดสองจอเทียบกันแล้วไม่มีคำอธิบาย
                    = แย่กว่าไม่มีการ์ดนี้เลย (เจ้าของร้านสั่งเอง 3 ก.ย. 2569) */}
                {/* 🟢 เลขที่ตรงกับ ZORT — ขึ้นก่อนเพราะเป็นตัวที่เอาไปใช้กับบัญชีจริง
                    ⚠️ เป็นค่า "คัดมา" ต้องมีวันที่คัดกำกับเสมอ */}
                {catErr && (
                  <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2 leading-relaxed">
                    ⚠️ ดึงมูลค่าตามต้นทุนเฉลี่ยไม่ได้รอบนี้ — <b>ไม่ได้แปลว่าไม่มีข้อมูล</b> ({catErr})
                  </p>
                )}
                {/* 🟢 หัวการ์ดแบบ ZORT: "มูลค่าสินค้าทั้งหมด" = ผลรวมมูลค่ารายคลังที่ ZORT ตอบ (16 ต.ค. 2569 จอ ZORT ขึ้น 16,177,397.29
                    · เดิมหัวการ์ดเราเป็นยอด 42 หมวดที่คัดมา ต่ำกว่า ZORT ราว 3.5 แสน ⇒ คนเทียบสองจอแล้วเห็นเลขคนละตัว)
                    ⇒ มีค่าสดครบทุกคลัง ⇒ ขึ้นเป็นเลขหลัก · ยอดรายหมวดลดเป็นบรรทัดรอง · ไม่มีค่าสด ⇒ ใช้ผังเดิม (ยอดหมวดเป็นหลัก) */}
                {ยอดZORTสด !== null && (
                  <div className="text-center mb-5">
                    <p className="text-[11.5px] text-gray-500">มูลค่าสินค้าทั้งหมด · {ยอดZORTเมื่อ}</p>
                    <p className="text-[30px] font-semibold leading-none mt-0.5" style={{ color: 'rgb(19,175,130)' }}>
                      {/* ทศนิยม 2 ตำแหน่งแบบจอ ZORT (16,177,397.29) — fmtMoney ปัดเหลือ 1 ตำแหน่ง ⇒ เลขดูไม่ตรงกันทั้งที่ค่าเดียวกัน */}
                      {ยอดZORTสด.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                    </p>
                    {typeof cat?.zortTotalValue === 'number' && (
                      <p className="text-[11.5px] text-gray-500 mt-1">
                        รวมเฉพาะ {cat.zortCategories ?? 0} หมวดที่คัดมาจากจอ ZORT <b>{fmtMoney(cat.zortTotalValue)}</b> บาท
                        {cat.zortCollectedAt && <> (คัดเมื่อ {thaiDate(cat.zortCollectedAt)})</>}
                        {' '}· ส่วนที่ไม่อยู่ในหมวด ≈ {fmtMoney(Math.round((ยอดZORTสด - cat.zortTotalValue) * 100) / 100)} บาท
                        <span className="block text-gray-400">หมวดกับรายคลังคัดมาคนละเวลา ⇒ ส่วนต่างเป็นค่าประมาณ</span>
                      </p>
                    )}
                  </div>
                )}
                {ยอดZORTสด === null && typeof cat?.zortTotalValue === 'number' && (
                  <div className="text-center mb-5">
                    <p className="text-[11.5px] text-gray-500">
                      ต้นทุนเฉลี่ยถ่วงน้ำหนัก · คัดมาจากจอ ZORT {cat.zortCategories ?? 0} หมวด
                    </p>
                    <p className="text-[30px] font-semibold leading-none mt-0.5" style={{ color: 'rgb(19,175,130)' }}>
                      {fmtMoney(cat.zortTotalValue)}
                      <span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                    </p>
                    <p className="text-[11.5px] text-gray-500 mt-1">
                      ZORT แสดงมูลค่าสินค้าทั้งหมด <b>{fmtMoney(ยอดZORT)}</b> บาท ({ยอดZORTเมื่อ})
                      {' '}· ส่วนที่ไม่อยู่ใน {cat.zortCategories ?? 0} หมวด ≈ {fmtMoney(Math.round((ยอดZORT - cat.zortTotalValue) * 100) / 100)} บาท
                      {/* ⚠️ สองเลขนี้คัดคนละเวลา (หมวด vs รายคลัง) ⇒ ส่วนต่างเป็น "ประมาณ" ไม่ใช่ยอดหมวดว่าง */}
                      <span className="block text-gray-400">หมวดกับรายคลังคัดมาคนละเวลา ⇒ ส่วนต่างเป็นค่าประมาณ</span>
                    </p>
                    {/* 🔴 เดิมโชว์ค่าดิบปี ค.ศ. + เวลา ⇒ แสดงวันที่แบบ พ.ศ. · ไม่แปลงเวลาเพราะไม่รู้โซน
                        (ชื่อฟิลด์ไม่ลงท้าย `Utc` — ขอฝั่งท่อแก้ชื่อไว้แล้ว) ค่าดิบอยู่ใน tooltip */}
                    {cat.zortCollectedAt && (
                      <p className="text-[11.5px] text-gray-400 mt-0.5"
                        title={`ค่าที่ท่อส่งมา: ${cat.zortCollectedAt} (ยังไม่ระบุโซนเวลา)`}>
                        คัดมาเมื่อ {thaiDate(cat.zortCollectedAt)}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[11.5px] text-gray-500">คิดจากราคาขาย</p>
                <p className="text-[30px] font-semibold text-blue-600 leading-none mt-0.5">
                  {typeof stock.value === 'number' ? fmtMoney(stock.value) : '—'}
                  <span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                </p>
                <p className="text-[11.5px] text-gray-500 mt-4">คิดจากราคาทุนในทะเบียนสินค้า</p>
                <p className="text-[22px] font-semibold text-gray-700 leading-none mt-0.5">
                  {typeof stock.valueCost === 'number' ? fmtMoney(stock.valueCost) : '—'}
                  <span className="text-[12.5px] text-gray-500 font-normal"> บาท</span>
                </p>
                {Number(stock.noCostSkus) > 0 && (
                  <p className="text-[11.5px] text-amber-800 mt-1">
                    ⚠️ ยังไม่ได้กรอกราคาทุน {fmtNum(Number(stock.noCostSkus))} รหัส — ตัวเลขทุนจึง<b>ต่ำกว่าความจริง</b>
                  </p>
                )}
                {stock.day && (
                  // ⚠️ ต้องบอกว่าเป็นภาพถ่ายวันไหน ไม่ใช่ยอดสดวินาทีนี้
                  <p className="text-[12.5px] text-gray-500 mt-3">
                    จากภาพถ่ายสต็อกวันที่ {thaiDate(stock.day)} · {fmtNum(stock.total ?? 0)} รายการ
                  </p>
                )}
                <button
                  onClick={downloadStockValue}
                  className="mt-5 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50"
                >
                  Download Excel
                </button>
              </div>

              {/* 🔴 กล่องนี้ห้ามถอด — ไม่มีมันคือปล่อยให้คนเชื่อว่าเลขเราควรเท่ากับ ZORT */}
              <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 leading-relaxed">
                {typeof cat?.zortTotalValue === 'number'
                  ? <><b>ตอนนี้เลขบนสุดตรงกับ ZORT แล้ว</b> — สองเลขล่างเป็นวิธีคิดของเราเอง
                      เก็บไว้ดูเทียบ · <b>ราคาซื้อในทะเบียนต่ำกว่าต้นทุนจริง 2-3 เท่า</b>
                      (พิสูจน์รายหมวดแล้ว) ⇒ <b>อย่าเอาไปใช้กับบัญชี</b> · </>
                  : null}
                <b>ทำไมสองเลขล่างไม่ตรงกับ ZORT</b> — ZORT แสดง <b>{fmtMoney(ยอดZORT)} บาท</b>
                {' '}({ยอดZORTเมื่อ}) เพราะ ZORT ใช้ <b>ต้นทุนเฉลี่ยถ่วงน้ำหนัก</b>
                {' '}ที่คิดใหม่ทุกครั้งที่ซื้อของเข้า ซึ่ง <b>API ไม่เปิดให้ดึง</b> ⇒ เราคิดแบบเดียวกันไม่ได้
                {' '}· ตัวเลขทั้งสองแบบข้างบนจึงคร่อมเลขของ ZORT อยู่ (ราคาขายสูงกว่า · ราคาทุนต่ำกว่า)
                {' '}<b>ห้ามเอาไปเทียบทีละบาท</b> ใช้ดูแนวโน้มและสัดส่วนได้
              </div>
            </Card>

            <Card>
              <p className="text-[15px] font-semibold text-gray-900 mb-2">มูลค่าสินค้าคงเหลือรายคลัง</p>
              {/* 🔴 **แก้ข้อความที่เคยผิดชั้น (4 ก.ย. 2569)** — เดิมเขียนว่า
                  "ZORT ไม่เปิดช่องทางให้ดึงสต็อกแยกตามคลัง … เป็นข้อจำกัดของต้นทาง
                   **ไม่ใช่ของที่ยังทำไม่เสร็จ**" ⇒ กลับด้านกับความจริง
                  ตรวจภาพจอ ZORT จริงแล้ว **เขามีข้อมูลนี้ครบ** ทั้งกราฟวงกลมในจอนี้
                  (`57-zort-รายงาน-สินค้า.jpg`) และเป็นตัวเลขในจอคลังสินค้า/สาขา
                  (`25` — โกดัง 16,456,971.3 · KLD 1,562.32 · ANJ 0)
                  ⇒ ที่จริงคือ **API ไม่ส่งมา** ไม่ใช่ **ZORT ไม่มี** ⇒ เป็น ⏳ ไม่ใช่ ❌
                  ⚠️ **ห้ามวาดวงกลม 100% ของคลังเดียว** ยังคงเดิม — วาดจากข้อมูลที่ไม่มีคือการเดา */}
              {/* 🔄 **แก้ของค้าง 16 ก.ย. 2569** — บล็อกเดิมเขียนว่า "API ไม่ส่งค่าแยกรายคลังมา"
                     ซึ่งจริงตอนเขียน แต่ตอนนี้ `list=warehouses` ส่ง `stockValue` รายคลังมาแล้ว
                     (ยิงจริง: NEW 16,296,871.16 · KLD 1,562.32 · ANJ 0)
                     ⇒ ปล่อยไว้คือคำโกหก และทำให้คนคิดว่าต้องไปคัดมือ
                  🔴 `stockValue` เป็น `null` = **ยังไม่รู้** (ZORT ไม่ให้สิทธิ์ดูคลังนั้น) ⇒ แยกแถว ห้ามนับเป็น 0 */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <select
                  value={valueBy}
                  onChange={(e) => setValueBy(e.target.value as 'warehouse' | 'category')}
                  className="text-[12.5px] border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
                >
                  <option value="warehouse">รายคลัง</option>
                  <option value="category">รายหมวดหมู่</option>
                </select>
                <span className="text-[11.5px] text-gray-400">
                  {valueBy === 'warehouse'
                    ? 'มูลค่าคงเหลือที่ ZORT ตอบรายคลัง (ถามสดตอนเปิดหน้า)'
                    : 'มูลค่าคงเหลือตามหมวด — ฐานเดียวกับการ์ดบนสุด (ต้นทุนเฉลี่ยที่คัดจาก ZORT)'}
                </span>
              </div>

              {valueBy === 'warehouse' && (
                whErr && !whs
                  ? <p className="text-[12.5px] text-red-700 py-6 text-center">⚠️ ดึงมูลค่ารายคลังไม่ได้: {whErr}</p>
                  : (
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-200">
                          <th className="text-left font-medium py-1.5">คลังสินค้า</th>
                          <th className="text-right font-medium">มูลค่าคงเหลือ (บาท)</th>
                          <th className="text-right font-medium">สัดส่วน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(whs ?? []).map((w) => {
                          const known = (whs ?? []).filter((x) => typeof x.stockValue === 'number')
                          const total = known.reduce((a, x) => a + (x.stockValue as number), 0)
                          return (
                            <tr key={w.code} className="border-b border-gray-100 last:border-0">
                              <td className="py-1.5 text-gray-700">{w.name || w.code} <span className="text-gray-400">({w.code})</span></td>
                              <td className="text-right text-gray-700">
                                {typeof w.stockValue === 'number'
                                  ? fmtMoney(w.stockValue)
                                  : <span className="text-amber-700">ยังไม่รู้</span>}
                              </td>
                              <td className="text-right text-gray-500">
                                {typeof w.stockValue === 'number' && total > 0
                                  ? `${((w.stockValue / total) * 100).toFixed(1)}%`
                                  : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                        {!whs && !whErr && (
                          <tr><td colSpan={3} className="py-4 text-gray-400">กำลังถามมูลค่ารายคลัง…</td></tr>
                        )}
                      </tbody>
                    </table>
                  )
              )}

              {valueBy === 'category' && (
                catErr && !cat
                  ? <p className="text-[12.5px] text-red-700 py-6 text-center">⚠️ ดึงมูลค่าตามหมวดไม่ได้: {catErr}</p>
                  : (
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-200">
                          <th className="text-left font-medium py-1.5">หมวดหมู่</th>
                          <th className="text-right font-medium">รหัสสินค้า</th>
                          <th className="text-right font-medium">มูลค่าคงเหลือ (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cat?.rows ?? []).slice(0, 12).map((r) => (
                          <tr key={r.cat_name} className="border-b border-gray-100 last:border-0">
                            <td className="py-1.5 text-gray-700">{r.cat_name}</td>
                            {/* 🔴 `null` = ยังไม่รู้ **ห้ามกลายเป็น 0** (ฝั่งท่อทัก 16 ก.ย. 2569) — เหมือนกับตารางรายคลัง */}
                            <td className="text-right text-gray-500">
                              {typeof r.skus === 'number' ? fmtNum(r.skus) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="text-right text-gray-700">
                              {typeof r.onhand_value === 'number'
                                ? fmtMoney(r.onhand_value)
                                : <span className="text-amber-700">ยังไม่รู้</span>}
                            </td>
                          </tr>
                        ))}
                        {(cat?.rows ?? []).length > 12 && (
                          <tr><td colSpan={3} className="py-2 text-[11.5px] text-gray-400">
                            แสดง 12 หมวดแรกจาก {fmtNum((cat?.rows ?? []).length)} หมวด — ดูครบที่จอหมวดหมู่
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  )
              )}

              <p className="text-[11.5px] text-gray-400 mt-2 leading-relaxed">
                ⚠️ สองมุมมองนี้ <b>คิดคนละฐาน</b> — รายคลังคือตัวเลขที่ ZORT ตอบสด · รายหมวดคิดจากต้นทุนเฉลี่ยที่คัดมา
                {' '}⇒ <b>ผลรวมไม่เท่ากันเป็นเรื่องปกติ</b>
              </p>
            </Card>
          </div>

          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">สินค้าจม</p>
              <select
                value={deadDays}
                onChange={(e) => { const d = Number(e.target.value); setDeadDays(d); load(d) }}
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                {DEAD_RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]"
              />
            </div>

            <TableWrap>
              <table className="w-full min-w-[760px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัสสินค้า</th>
                    <th className={TH}>สินค้า</th>
                    <th className={TH}>วันที่ขายล่าสุด</th>
                    <th className={THR}>จำนวนคงเหลือ</th>
                    <th className={THR}>มูลค่าสินค้าคงเหลือ (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {deadRows.length === 0 && (
                    <EmptyState
                      cols={5}
                      icon={deadErr ? '⚠️' : '📦'}
                      title={deadErr ? 'ดึงรายการสินค้าจมไม่ได้' : (dead ? 'ไม่มีสินค้าจมในช่วงนี้' : 'ยังไม่มีข้อมูลสินค้าจม')}
                      detail={deadErr
                        // ⚠️ ห้ามเขียนว่า "ไม่มีสินค้าจม" ตอนท่อพัง — สินค้าจมคือเงินที่ค้างอยู่ในสต็อก
                        //    บอกว่าไม่มีทั้งที่ยังไม่รู้ = ทำให้คนเลิกตามเรื่องที่ควรตาม
                        ? `ตารางนี้ว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่มีสินค้าจม — ${deadErr}`
                        : (dead
                          ? 'ทุกตัวที่มีของในคลังยังขายได้ในช่วงเวลาที่เลือก — ลองขยายช่วงเวลาด้านบน'
                          : 'ยังไม่ได้รับข้อมูลจากฝั่งเซิร์ฟเวอร์ — จอพร้อมแสดงทันทีที่ข้อมูลมา')}
                    />
                  )}
                  {deadRows.map((r) => (
                    <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} text-blue-600 whitespace-nowrap`}>{r.sku}</td>
                      <td className={TD}>
                        <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                          {r.name || '—'}
                        </Link>
                        {r.category && <span className="block text-[11.5px] text-gray-400">หมวดหมู่: {r.category}</span>}
                      </td>
                      {/* ⚠️ ไม่เคยขายเลย ≠ ขายล่าสุดนานแล้ว — ต้องเขียนต่างกัน
                          ⚠️ และคำว่า "ไม่เคยขาย" แรงเกินกว่าที่เรารู้จริง — เรารู้แค่ว่า
                             **ไม่มีใบขายในประวัติที่คลังเงาเก็บไว้** (ย้อนถึง historyFrom เท่านั้น)
                             ของที่ขายไปก่อนหน้านั้นเราไม่มีทางเห็น ⇒ ต้องเขียนขอบเขตกำกับเสมอ */}
                      <td className={`${TD} text-gray-600 whitespace-nowrap`}>
                        {r.lastSoldAt
                          ? thaiDate(r.lastSoldAt)
                          : (
                            <span className="text-gray-400">
                              ไม่มีใบขาย{dead?.historyFrom ? `ตั้งแต่ ${thaiDate(dead.historyFrom)}` : 'ในประวัติที่มี'}
                            </span>
                          )}
                      </td>
                      {/* 🔴 คงเหลือที่ "ไม่รู้" ห้ามโชว์ 0 — 0 แปลว่าของหมด ซึ่งพาไปสั่งของผิด
                          (ช่องนี้เป็น optional ในชนิดข้อมูล · ช่องมูลค่าข้าง ๆ ทำถูกอยู่แล้ว ⇒ ทำให้เหมือนกัน) */}
                      <td className={TDR}>{typeof r.onhand === 'number' ? fmtNum(r.onhand) : <span className="text-gray-300">—</span>}</td>
                      <td className={TDR}>{typeof r.value === 'number' ? fmtMoney(r.value) : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {/* 🔴 ตัวนับ (total) กับแถว (ครั้งละ 50) มาคนละขนาด ⇒ ต้องบอกว่าเห็นแถวไหนถึงแถวไหน (CLAUDE.md กฎแท็บข้อ 4)
                ZORT ก็แบ่งหน้าตารางนี้ (1 2 3 … 194) · เดิมจอเราแสดง 50 แถวแรกเฉย ๆ ไม่มีทางไปหน้าถัดไป */}
            {dead && typeof dead.total === 'number' && dead.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-5 py-2.5 border-t border-gray-200 text-[12.5px] text-gray-500">
                <span>
                  แสดง {fmtNum((dead.offset ?? 0) + 1)}–{fmtNum((dead.offset ?? 0) + (dead.rows?.length ?? 0))} จาก {fmtNum(dead.total)} รหัส
                  {dead.sortApplied !== 'lastsold' && <span className="text-amber-700"> · ⚠️ ลำดับไม่ใช่วันที่ขายล่าสุดแบบ ZORT (ท่อตอบว่าเรียงแบบ {dead.sortApplied || 'ไม่บอก'})</span>}
                  {q.trim() && <span className="text-amber-700"> · ค้นหากรองเฉพาะ {fmtNum(dead.rows?.length ?? 0)} แถวในหน้านี้ (ท่อยังไม่รับคำค้น)</span>}
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" disabled={deadBusy || (dead.offset ?? 0) <= 0}
                    onClick={() => loadDeadPage(Math.max(0, (dead.offset ?? 0) - (dead.limit ?? dead.rows?.length ?? 50)))}
                    className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">← ก่อนหน้า</button>
                  <button type="button" disabled={deadBusy || typeof dead.nextOffset !== 'number'}
                    onClick={() => { if (typeof dead.nextOffset === 'number') loadDeadPage(dead.nextOffset) }}
                    className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">ถัดไป →</button>
                </span>
              </div>
            )}
            {/* 📗 "Download Excel" ใต้ตารางสินค้าจม — ZORT มีปุ่มนี้ใต้ตัวแบ่งหน้า (อ่านจอจริง 16 ต.ค. 2569)
                ไล่ทุกหน้าด้วย offset ของท่อ · ไม่ส่ง limit เอง (ท่อให้หน้าละ 50) · จบเมื่อท่อไม่ส่ง nextOffset */}
            {dead && (dead.total ?? 0) > 0 && (
              <div className="flex justify-end px-4 md:px-5 py-2.5 border-t border-gray-200">
                <ExportButton
                  label="📗 Download Excel"
                  spec={{
                    filename: 'สินค้าจม',
                    title: 'สินค้าจม',
                    scope: DEAD_RANGES.find((r) => r.days === deadDays)?.label ?? `ไม่มีใบขาย ${deadDays} วัน`,
                    note: dead.historyFrom ? `นับจากใบขายที่คลังเงามีตั้งแต่ ${thaiDate(dead.historyFrom)} เท่านั้น · มูลค่าคิดจากราคาขาย ไม่ใช่ต้นทุน` : 'มูลค่าคิดจากราคาขาย ไม่ใช่ต้นทุน',
                    fetchPage: async (off) => {
                      const r = await fetch(`/api/web/core?list=deadstock&${deadQs(deadDays)}&offset=${off}`).then((x) => x.json())
                      if (!r || !Array.isArray(r.rows)) throw new Error(r?.error || 'ท่อไม่ส่งแถวมา')
                      return { rows: r.rows as DeadRow[], total: typeof r.total === 'number' ? r.total : null, done: typeof r.nextOffset !== 'number' }
                    },
                    header: ['รหัสสินค้า', 'สินค้า', 'หมวดหมู่', 'วันที่ขายล่าสุด', 'จำนวนคงเหลือ', 'มูลค่าสินค้าคงเหลือ (บาท)'],
                    toRow: (r: DeadRow) => [
                      r.sku, r.name || null, r.category || null,
                      r.lastSoldAt ? thaiDate(r.lastSoldAt) : null,
                      typeof r.onhand === 'number' ? r.onhand : null,
                      typeof r.value === 'number' ? r.value : null,
                    ],
                  }}
                />
              </div>
            )}
          </Card>

          {dead && (dead.total ?? 0) > 0 && (
            <div className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
              สินค้าจมในช่วงที่เลือก <b>{fmtNum(dead.total ?? 0)}</b> รหัส
              {typeof dead.value === 'number' && <> · มูลค่ารวม <b>{fmtMoney(dead.value)}</b> บาท</>}
              {' '}(คิดจาก<b>ราคาขาย</b> ไม่ใช่ต้นทุน)
              {dead.historyFrom && (
                <>
                  <br />
                  ⚠️ นับจากใบขายที่คลังเงามีตั้งแต่ <b>{thaiDate(dead.historyFrom)}</b> เท่านั้น —
                  ของที่ขายไปก่อนหน้านั้นระบบมองไม่เห็น จึงอาจมีบางรหัสที่จริง ๆ เคยขายแล้ว
                </>
              )}
            </div>
          )}

          {/* 📉 การ์ด "สินค้าหมด / คงเหลือน้อย" — ZORT มีสองการ์ดนี้ในจอเดียวกัน
                 🔴 **ไม่ลอกชื่อ ZORT มาทั้งดุ้น** เพราะนับคนละอย่าง:
                    · ของเรา `out` = คงเหลือ **≤ 0 (รวมติดลบ)** · ของ ZORT "สินค้าหมด" = 0 พอดี
                    · ของเรา `low` = **คงเหลือ 1–3 ชิ้น (เกณฑ์ของระบบเราเอง)**
                      ZORT คิด "ใกล้หมด" จาก **กลุ่ม Lead Time** (`/LeadTimeGroup`) ซึ่ง **ร้านยังไม่ได้ตั้งสักกลุ่ม**
                      ⇒ ตารางฝั่ง ZORT ว่างเพราะคำนวณไม่ได้ ไม่ใช่เพราะไม่มีของใกล้หมด (ฝั่งท่อไล่สเปกมาให้ 16 ก.ย. 2569)
                 ⇒ เขียนเกณฑ์ไว้ข้างตัวเลขทุกตัว ไม่ให้ใครอ่านว่าเท่ากับของ ZORT */}
          {stockCounts && (
            <Card className="mt-4">
              <p className="text-[15px] font-semibold text-gray-900 mb-2">สต็อกที่ต้องดู</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-gray-200 rounded-md px-3 py-2.5">
                  <p className="text-[12.5px] text-gray-500">คงเหลือ 0 หรือติดลบ</p>
                  <p className="text-[22px] font-semibold text-red-500 leading-tight">{fmtNum(stockCounts.outOfStock ?? 0)}</p>
                  <p className="text-[11.5px] text-gray-400 leading-relaxed">
                    รวมของที่<b>ติดลบ {fmtNum(stockCounts.negative ?? 0)} รหัส</b>ไว้ด้วย
                    {' '}· ZORT นับ &ldquo;สินค้าหมด&rdquo; เฉพาะ 0 พอดี ⇒ เลขนี้จะมากกว่าของ ZORT
                  </p>
                </div>
                <div className="border border-gray-200 rounded-md px-3 py-2.5">
                  <p className="text-[12.5px] text-gray-500">คงเหลือ 1–3 ชิ้น</p>
                  <p className="text-[22px] font-semibold text-amber-600 leading-tight">{fmtNum(stockCounts.low ?? 0)}</p>
                  <p className="text-[11.5px] text-gray-400 leading-relaxed">
                    <b>เกณฑ์ของระบบเราเอง</b> — ไม่ใช่ &ldquo;ใกล้หมด&rdquo; แบบ ZORT
                  </p>
                </div>
                <div className="border border-gray-200 rounded-md px-3 py-2.5">
                  <p className="text-[12.5px] text-gray-500">สินค้าทั้งหมดในทะเบียน</p>
                  <p className="text-[22px] font-semibold text-gray-900 leading-tight">{fmtNum(stockCounts.total ?? 0)}</p>
                  <p className="text-[11.5px] text-gray-400">ใช้เป็นตัวส่วนของสองช่องซ้าย</p>
                </div>
              </div>
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3 leading-relaxed">
                ⚠️ ZORT มีการ์ด &ldquo;สินค้าใกล้หมด&rdquo; ที่คิดจาก <b>กลุ่ม Lead Time</b> (ตั้งที่หน้า /LeadTimeGroup ของ ZORT)
                {' '}ซึ่ง<b>ร้านยังไม่ได้ตั้งสักกลุ่ม</b> ⇒ ตารางฝั่ง ZORT ว่างเพราะคำนวณไม่ได้
                {' '}· ของเรา<b>ยังไม่ทำแบบนั้น</b> และ<b>ไม่เดาเกณฑ์เอง</b>
              </p>
              {/* 🔴 ที่ ZORT มีแต่กล่องนี้ยังไม่มี — เขียนไว้ เพราะช่องที่เว้นว่างจะถูกอ่านว่า "ไม่มีอะไรขาด"
                  (กล่อง "ล็อตใกล้หมดอายุ" ย้ายไปเป็นการ์ดของตัวเองตามผัง ZORT แล้ว 16 ต.ค. 2569) */}
              <p className="text-[11.5px] text-gray-500 mt-2 leading-relaxed">
                ℹ️ <b>ที่กล่องนี้ยังไม่มีเทียบกับ ZORT</b> (วัด 4 ต.ค. 2569) —
                {' '}<b>ตัวกรองคลัง</b> ของกล่องสินค้าใกล้หมด (ZORT เลือก ทั้งหมด / โกดัง / KLD / ANJ ได้ · ของเรารวมทุกคลัง)
              </p>
            </Card>
          )}

          {/* 🧾 การ์ด "ล็อตใกล้หมดอายุ" — ผังเดียวกับ ZORT (/Dashboard/ProductReport อ่านจอจริง 16 ต.ค. 2569:
                 หัวการ์ด + ตัวเลือกคลัง `lowexpirylotwarehouseid` + ตาราง ล็อต/สินค้า/วันหมดอายุ/จำนวนคงเหลือ · ZORT ขึ้น 0 แถว)
                 ระบบเรายังไม่เก็บล็อต/วันหมดอายุ ⇒ แสดงผังพร้อมเหตุ ไม่เดาแถว · ตัวเลือกคลังปิดไว้เพราะไม่มีอะไรให้กรอง */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">ล็อตใกล้หมดอายุ</p>
              <select disabled className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-gray-50 text-gray-400 max-w-full">
                <option>ทั้งหมด</option>
                {(whs ?? []).map((w) => <option key={w.code}>{w.name || w.code}</option>)}
              </select>
            </div>
            <TableWrap>
              <table className="w-full min-w-[560px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>ล็อต</th>
                    <th className={TH}>สินค้า</th>
                    <th className={TH}>วันหมดอายุ</th>
                    <th className={THR}>จำนวนคงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  <EmptyState
                    cols={4}
                    icon="🧾"
                    title="ระบบเรายังไม่เก็บข้อมูลล็อต"
                    detail="ตารางนี้ว่างเพราะยังไม่มีข้อมูลล็อต/วันหมดอายุในระบบเรา ไม่ได้แปลว่าตรวจแล้วไม่มี · ฝั่ง ZORT ตารางนี้ก็ว่างเช่นกัน (อ่านจอ ZORT 16 ต.ค. 2569 · ทุกคลัง)"
                  />
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
            การวิเคราะห์ยอดขาย (ยอดรายเดือน · ช่องทางที่ทำเงิน · สินค้าขายดี) ย้ายไปอยู่ที่
            <b> รายงาน → ยอดขาย</b> ซึ่งตรงกับผังของ ZORT · จอนี้เป็นรายงาน<b>สินค้า</b> ตามชื่อเมนู
          </p>
        </>
      )}
    </div>
  )
}
