'use client'
// รายงาน → สินค้า — **ลอกจาก `zort-ui/57-zort-รายงาน-สินค้า.jpg`**
// ผัง: ชื่อจอ "สินค้า" → สองการ์ดคู่ (สรุปมูลค่าสินค้าทั้งหมด | มูลค่าสินค้าคงเหลือรายคลัง)
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
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate,
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
}

/* ช่วง "สินค้าจม" — ให้ครบตามที่ ZORT มี (กดดูจอ ZORT เอง 16 ก.ย. 2569 · `tableoption` 5 ค่า)
   ⚠️ ท่อรับ `days` เป็นจำนวนเต็มอิสระอยู่แล้ว (ยิงตรวจ: days=7 ⇒ 1,981 · 30 ⇒ 1,789 · 90 ⇒ 1,568)
      ⇒ เพิ่มตัวเลือกได้เลย ไม่ต้องรอท่อ */
const DEAD_RANGES = [
  { days: 7, label: 'ขายไม่ได้เกิน 7 วัน' },
  { days: 30, label: 'ขายไม่ได้เกิน 1 เดือน' },
  { days: 90, label: 'ขายไม่ได้เกิน 3 เดือน' },
  { days: 180, label: 'ขายไม่ได้เกิน 6 เดือน' },
  { days: 365, label: 'ขายไม่ได้เกิน 1 ปี' },
]

export default function CoreProductReportPage() {
  const [stock, setStock] = useState<StockResp | null>(null)
  const [dead, setDead] = useState<DeadResp | null>(null)
  const [cat, setCat] = useState<CatResp | null>(null)
  const [deadErr, setDeadErr] = useState('')
  const [catErr, setCatErr] = useState('')
  const [deadDays, setDeadDays] = useState(90)
  /** 🏬 มูลค่าคงเหลือรายคลัง (ZORT มีการ์ดนี้) · `stockValue: null` = ยังไม่รู้ ห้ามนับเป็น 0 */
  const [whs, setWhs] = useState<{ code: string; name?: string; stockValue?: number | null }[] | null>(null)
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
        fetch(`/api/web/core?list=deadstock&days=${days}`).then((r) => r.json()).catch(() => null),
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
      ['ZORT แสดงเท่าไหร่ (ต้นทุนเฉลี่ยถ่วงน้ำหนัก · API ไม่เปิดให้ดึง)', String(ZORT_STOCK_VALUE)],
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
        actions={<BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
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
                  <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2 leading-relaxed">
                    ⚠️ ดึงมูลค่าตามต้นทุนเฉลี่ยไม่ได้รอบนี้ — <b>ไม่ได้แปลว่าไม่มีข้อมูล</b> ({catErr})
                  </p>
                )}
                {typeof cat?.zortTotalValue === 'number' && (
                  <div className="text-center mb-5">
                    <p className="text-[11.5px] text-gray-500">
                      ต้นทุนเฉลี่ยถ่วงน้ำหนัก · คัดมาจากจอ ZORT {cat.zortCategories ?? 0} หมวด
                    </p>
                    <p className="text-[30px] font-semibold leading-none mt-0.5" style={{ color: 'rgb(19,175,130)' }}>
                      {fmtMoney(cat.zortTotalValue)}
                      <span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                    </p>
                    <p className="text-[11.5px] text-gray-500 mt-1">
                      + สินค้าที่ยังไม่ได้จัดหมวด {fmtMoney(ZORT_STOCK_VALUE - cat.zortTotalValue)} บาท
                      {' '}= <b>{fmtMoney(ZORT_STOCK_VALUE)}</b> เท่ากับที่ ZORT แสดงทั้งร้าน
                    </p>
                    {/* 🔴 เดิมโชว์ค่าดิบปี ค.ศ. + เวลา ⇒ แสดงวันที่แบบ พ.ศ. · ไม่แปลงเวลาเพราะไม่รู้โซน
                        (ชื่อฟิลด์ไม่ลงท้าย `Utc` — ขอฝั่งท่อแก้ชื่อไว้แล้ว) ค่าดิบอยู่ใน tooltip */}
                    {cat.zortCollectedAt && (
                      <p className="text-[11px] text-gray-400 mt-0.5"
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
                  <span className="text-[13px] text-gray-500 font-normal"> บาท</span>
                </p>
                {Number(stock.noCostSkus) > 0 && (
                  <p className="text-[11.5px] text-amber-800 mt-1">
                    ⚠️ ยังไม่ได้กรอกราคาทุน {fmtNum(Number(stock.noCostSkus))} รหัส — ตัวเลขทุนจึง<b>ต่ำกว่าความจริง</b>
                  </p>
                )}
                {stock.day && (
                  // ⚠️ ต้องบอกว่าเป็นภาพถ่ายวันไหน ไม่ใช่ยอดสดวินาทีนี้
                  <p className="text-[12px] text-gray-500 mt-3">
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
              <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 leading-relaxed">
                {typeof cat?.zortTotalValue === 'number'
                  ? <><b>ตอนนี้เลขบนสุดตรงกับ ZORT แล้ว</b> — สองเลขล่างเป็นวิธีคิดของเราเอง
                      เก็บไว้ดูเทียบ · <b>ราคาซื้อในทะเบียนต่ำกว่าต้นทุนจริง 2-3 เท่า</b>
                      (พิสูจน์รายหมวดแล้ว) ⇒ <b>อย่าเอาไปใช้กับบัญชี</b> · </>
                  : null}
                <b>ทำไมสองเลขล่างไม่ตรงกับ ZORT</b> — จอเดียวกันของ ZORT แสดง <b>{fmtMoney(ZORT_STOCK_VALUE)} บาท</b>
                {' '}(ตรวจ {ZORT_CHECKED_AT}) เพราะ ZORT ใช้ <b>ต้นทุนเฉลี่ยถ่วงน้ำหนัก</b>
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
                  <p className="text-[12px] text-gray-500">คงเหลือ 0 หรือติดลบ</p>
                  <p className="text-[22px] font-semibold text-red-500 leading-tight">{fmtNum(stockCounts.outOfStock ?? 0)}</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    รวมของที่<b>ติดลบ {fmtNum(stockCounts.negative ?? 0)} รหัส</b>ไว้ด้วย
                    {' '}· ZORT นับ &ldquo;สินค้าหมด&rdquo; เฉพาะ 0 พอดี ⇒ เลขนี้จะมากกว่าของ ZORT
                  </p>
                </div>
                <div className="border border-gray-200 rounded-md px-3 py-2.5">
                  <p className="text-[12px] text-gray-500">คงเหลือ 1–3 ชิ้น</p>
                  <p className="text-[22px] font-semibold text-amber-600 leading-tight">{fmtNum(stockCounts.low ?? 0)}</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    <b>เกณฑ์ของระบบเราเอง</b> — ไม่ใช่ &ldquo;ใกล้หมด&rdquo; แบบ ZORT
                  </p>
                </div>
                <div className="border border-gray-200 rounded-md px-3 py-2.5">
                  <p className="text-[12px] text-gray-500">สินค้าทั้งหมดในทะเบียน</p>
                  <p className="text-[22px] font-semibold text-gray-900 leading-tight">{fmtNum(stockCounts.total ?? 0)}</p>
                  <p className="text-[11px] text-gray-400">ใช้เป็นตัวส่วนของสองช่องซ้าย</p>
                </div>
              </div>
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3 leading-relaxed">
                ⚠️ ZORT มีการ์ด &ldquo;สินค้าใกล้หมด&rdquo; ที่คิดจาก <b>กลุ่ม Lead Time</b> (ตั้งที่หน้า /LeadTimeGroup ของ ZORT)
                {' '}ซึ่ง<b>ร้านยังไม่ได้ตั้งสักกลุ่ม</b> ⇒ ตารางฝั่ง ZORT ว่างเพราะคำนวณไม่ได้
                {' '}· ของเรา<b>ยังไม่ทำแบบนั้น</b> และ<b>ไม่เดาเกณฑ์เอง</b>
              </p>
            </Card>
          )}

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
                        {r.category && <span className="block text-[11px] text-gray-400">หมวดหมู่: {r.category}</span>}
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
                      <td className={TDR}>{fmtNum(Number(r.onhand ?? 0))}</td>
                      <td className={TDR}>{typeof r.value === 'number' ? fmtMoney(r.value) : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          {dead && (dead.total ?? 0) > 0 && (
            <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
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

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            การวิเคราะห์ยอดขาย (ยอดรายเดือน · ช่องทางที่ทำเงิน · สินค้าขายดี) ย้ายไปอยู่ที่
            <b> รายงาน → ยอดขาย</b> ซึ่งตรงกับผังของ ZORT · จอนี้เป็นรายงาน<b>สินค้า</b> ตามชื่อเมนู
          </p>
        </>
      )}
    </div>
  )
}
