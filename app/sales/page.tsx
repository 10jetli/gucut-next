'use client'
// ยอดขายทุกช่องทาง — Shopee / Lazada / TikTok / GUCUT.com / POS ทั้ง 2 สาขา
//
// ⚠️ ย้ายมาอ่าน **คลังเงา (D1)** แล้ว 2 ก.ย. 2569 — เดิมยิง /api/sales-report ซึ่งดึงสดจาก ZORT
//    ตามกฎ "จอที่ยัง fetch /api/zort อยู่ = ยังไม่เสร็จ" จอนี้จึงต้องยืนได้เองวันที่เลิกใช้ ZORT
//    ตัวเลขชุดเดียวกับที่ /core/sales ใช้ จึงเทียบกันได้ตรง ๆ ไม่ใช่คนละแหล่ง
// รีเฟรชด้วยปุ่มเท่านั้น ไม่มี auto-refresh (กติกาเจ้าของร้าน)
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, Tabs, TableWrap, TH, THR, TD, TDR, EmptyState, ChannelTag,
} from '@/components/zort'

interface Report {
  range: { from: string; to: string; days: number }
  totals: { sales: number; orders: number; avg: number; prevSales: number; prevOrders: number }
  /** 🔴 **ใบคืนของใบขายในตัวกรองนี้** — ท่อคิดมาให้แล้ว (gucut-web bea658d · 15 ก.ย. 2569)
   *  `null` = อ่านตารางใบคืนไม่ได้ ⇒ "ยังไม่รู้" **ห้ามแสดง 0**
   *  ⚠️ เดิมจอนับเอง จาก "ใบคืนที่ออกในช่วงนี้" ซึ่ง **คนละคำถาม** กับ
   *     "ยอดขายในช่วงนี้ที่ถูกคืน" (ใบคืนที่ออกเดือนนี้อาจเป็นของที่ขายเดือนก่อน)
   *     ⇒ ตอนนี้ท่อจับคู่ reference = orders.number และผูกขอบเขตกับ **วันที่ขาย** แล้ว
   *        ⇒ หักตรง ๆ ได้ ไม่ต้องเขียนว่า "ราว" อีก */
  returns: { count: number; amount: number } | null
  /** ดึงใบคืนไม่สำเร็จเพราะอะไร — ต้องบอก ไม่ใช่เงียบแล้วปล่อยให้ยอดดูเหมือนสุทธิ */
  returnsError?: string
  /** ใบคืนที่ออกในช่วงแต่ **หาใบขายต้นทางไม่เจอ** ⇒ ไม่ได้ถูกหักออกจากยอด
   *  ⚠️ ไม่ผูกกับตัวกรองร้าน/ช่องทาง ⇒ ถ้ามี ต้องเขียนกำกับ ห้ามเงียบ */
  unmatchedReturns?: { count: number; amount: number } | null
  /** เวลาซิงก์ตารางใบคืนล่าสุด (UTC) · ซิงก์ทุกชั่วโมงนาทีที่ :07 ⇒ เก่าเกิน ~2 ชม. = หยุด */
  returnsSyncedAtUtc?: string | null
  /** false = ใบคืนยังไม่ครบ ⇒ **ห้ามเขียนว่าหักครบแล้ว** */
  returnsSyncComplete?: boolean | null
  /** คำอธิบายขอบเขตจากท่อ — เอาขึ้นจอตรง ๆ ไม่เขียนเอง */
  returnsScope?: string | null
  daily: { date: string; sales: number; orders: number }[]
  channels: { label: string; name: string; store: string; sales: number; orders: number; prevSales: number }[]
  // ยอดเงินรายสินค้ามาจาก /api/core?list=topproducts (รวมจาก order_items จริง)
  // ยังเป็น optional ไว้ เผื่อท่อนั้นล่ม — โชว์ขีดดีกว่าโชว์เลขที่เดาเอง
  /** ⑦ `category` มากับทุกแถวแล้ว (ท่อ gucut-web b0a4aa3 · 15 ก.ย. 2569)
   *  🔴 สามสถานะ: มีชื่อหมวด · `''` = ZORT ยังไม่จัดหมวด (หรือคลังไม่รู้จัก sku) · ไม่มีคีย์เลย = ท่อรุ่นเก่า
   *     ⇒ สองอันหลังเขียนไม่เหมือนกัน ห้ามรวบเป็น "ไม่มีหมวด" อันเดียว */
  topProducts: { name: string; sku: string; qty: number; amount?: number; category?: string }[] | null
  /** ⚠️ ท่อสินค้าขายดีล้มเหลว — ต้องแยกจาก "ไม่มียอดขาย" ให้ขาด
   *  ตารางว่างเพราะยิงไม่ผ่าน แล้วเขียนว่า "ยังไม่มียอดขายในช่วงนี้"
   *  = พูดแทนธุรกิจว่าขายไม่ได้ ทั้งที่เราแค่ถามไม่สำเร็จ */
  topError?: string
}

interface CoreRow { number: string; channel: string; amount: number; order_date: string }
interface CoreChan { channel: string; orders: number; amount: number }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/** ดึงยอดรวมของช่วง — **ไม่ดึงแถวออเดอร์แล้ว** (แก้ 5 ก.ย. 2569)
 *  🔴 เดิมวนดึงทีละ 200 ใบ สูงสุด 12 หน้า = 2,400 ใบ มาบวกเป็นกราฟรายวันเองในเบราว์เซอร์
 *     ⇒ ช้าโดยไม่จำเป็น และ **ถ้าช่วงไหนเกิน 2,400 ใบ กราฟจะขาดหายเงียบ ๆ**
 *     (โรคเดียวกับจอการเงินที่เพิ่งแก้ — ค่าที่ต้องเห็นข้อมูลทั้งชุด ต้องให้ฐานคิดให้) */
async function fetchRange(from: string, to: string) {
  const qs = new URLSearchParams({ list: 'orders', from, to, limit: '1' })
  const res = await fetch(`/api/web/core?${qs}`)
  const d = await res.json()
  if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
  if (d?.skip) throw new Error(d.skip)
  /* 🔴 ช่องใบคืนเป็น null ได้ = **อ่านตารางใบคืนไม่ได้** ⇒ ส่ง null ต่อไปให้จอเขียนว่า "ยังไม่รู้"
     ห้ามแปลงเป็น 0 ตรงนี้ — 0 แปลว่าไม่มีใครคืนของ ซึ่งคนละเรื่องกัน */
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  return {
    total: Number(d.total ?? 0),
    amount: Number(d.totalAmount ?? 0),
    channels: (Array.isArray(d.byChannel) ? d.byChannel : []) as CoreChan[],
    returnedCount: num(d.returnedCount),
    returnedAmount: num(d.returnedAmount),
    unmatchedReturns: d.unmatchedReturns && typeof d.unmatchedReturns === 'object'
      ? { count: Number(d.unmatchedReturns.count ?? 0), amount: Number(d.unmatchedReturns.amount ?? 0) }
      : null,
    returnsSyncedAtUtc: typeof d.returnsSyncedAtUtc === 'string' ? d.returnsSyncedAtUtc : null,
    returnsSyncComplete: typeof d.returnsSyncComplete === 'boolean' ? d.returnsSyncComplete : null,
    returnsScope: typeof d.returnsScope === 'string' ? d.returnsScope : null,
  }
}

/* ── ใบคืนสินค้า: ตอนนี้ท่อคิดมาให้แล้ว (15 ก.ย. 2569 · gucut-web bea658d) ──────
   🔴 **ยอดขายนับใบที่ลูกค้าคืนของแล้วด้วย** — ZORT ไม่พลิกสถานะใบเดิมเป็นยกเลิกเมื่อมีใบคืน
      ⇒ ใบยังเป็น Success ⇒ ถูกนับเป็นยอดขายต่อไป (งานกระดาน t_mu1bkqes)

   ⚠️ **ถอด `fetchReturns()` ที่เคยอยู่ตรงนี้ทิ้งแล้ว** — มันวนดึง `list=returnorders`
      ทุกหน้าแล้วจับคู่เองในเบราว์เซอร์ ซึ่งผิดสองชั้น:
        ① นับ "ใบคืนที่ออกในช่วงนี้" ซึ่งเป็น**คนละคำถาม**กับ "ยอดขายในช่วงนี้ที่ถูกคืน"
           ⇒ จอจึงต้องเขียนว่า "หักแล้วเหลือราว" มาตลอด
        ② 🔴 **ใส่ Map โดยใช้ `number` เป็นกุญแจ** ทั้งที่เลขที่ใบคืนของ ZORT **ซ้ำกันได้จริง**
           (689 ใบ มีเลขไม่ซ้ำแค่ 537 — ฝั่งท่อวัด 15 ก.ย. 2569 หลังผมเจอแถวซ้ำในไฟล์ส่งออก)
           ⇒ ใบที่เลขซ้ำถูกทับหาย ⇒ **เลขใบคืนบนจอนี้ต่ำกว่าจริงมาตลอดโดยไม่มีอะไรฟ้อง**
           ฝั่งท่อเจอบั๊กเดียวกันในกระจกของเขา แล้วย้ายไป `return_orders_v2` กุญแจ `id`

   ✅ ตอนนี้ `?list=orders` ส่ง returnedCount · returnedAmount · unmatchedReturns ·
      returnsSyncedAtUtc · returnsSyncComplete · returnsScope มาในคำขอเดียวกับยอดขาย
      โดยจับคู่ `reference = orders.number` และผูกขอบเขตกับ **วันที่ขาย** ตัวเดียวกับตัวกรอง
      ⇒ `totalAmount − returnedAmount` เป็นยอดสุทธิจริง ไม่ใช่ค่าประมาณ
   🔴 ทั้งสามช่องเป็น null = อ่านตารางใบคืนไม่ได้ ⇒ "ยังไม่รู้" **ห้ามเป็น 0** */

/** ยอดรายวันจากฐานข้อมูล — GROUP BY วัน ยิงครั้งเดียวได้ทั้งช่วง
 *  ⚠️ **วันที่ไม่มีออเดอร์จะไม่มีแถวคืนมา** (ท่อเขียนเตือนไว้ในคำตอบเอง)
 *     ฝั่งกราฟต้องเติมวันว่างเป็น 0 เสมอ ไม่งั้นเส้นลากข้ามวันที่ขายไม่ได้
 *     แล้วกราฟจะดูเหมือนร้านขายได้ทุกวัน */
async function fetchDaily(days: number) {
  const res = await fetch(`/api/web/core?daily=1&days=${days}`)
  const d = await res.json()
  if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
  return (Array.isArray(d.days) ? d.days : []) as { day: string; orders: number; sales: number }[]
}

// ⚠️ ZORT ตั้งต้นที่ "ย้อนหลัง 3 เดือน" — เราจึงต้องมีช่วงนั้นให้เลือกด้วย
/* ช่วงเวลา — ไล่ให้ครบตามที่ ZORT มี (กดดูเอง 15 ก.ย. 2569: 1/3/6 เดือน · 1 ปี · วันนี้ · เมื่อวาน · เดือนนี้ · เดือนที่แล้ว)
   ⚠️ **ของเรายังไม่มี "เมื่อวาน · เดือนนี้ · เดือนที่แล้ว"** เพราะจอนี้คิดช่วงจาก "ย้อนหลัง N วัน" อย่างเดียว
      ⇒ สามอันนั้นต้องเลือกช่วงวันเองได้ก่อน (งานคนละชิ้น) · เขียนไว้ในรายงานแล้ว ไม่แกล้งใส่ตัวเลือกที่ให้ช่วงผิด */
const PERIODS = [
  { days: 1, label: 'วันนี้' },
  { days: 7, label: 'ย้อนหลัง 7 วัน' },
  { days: 30, label: 'ย้อนหลัง 1 เดือน' },
  { days: 90, label: 'ย้อนหลัง 3 เดือน' },
  { days: 180, label: 'ย้อนหลัง 6 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]

/** รวมยอดรายวันเป็นถัง วัน/เดือน/ไตรมาส/ปี — ZORT มีปุ่มสี่อันนี้ที่มุมขวาล่างของกราฟ */
type Bucket = 'day' | 'month' | 'quarter' | 'year'
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'day', label: 'วัน' },
  { id: 'month', label: 'เดือน' },
  { id: 'quarter', label: 'ไตรมาส' },
  { id: 'year', label: 'ปี' },
]
function bucketKey(date: string, b: Bucket): string {
  const [y, m] = date.split('-')
  if (b === 'year') return y
  if (b === 'quarter') return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`
  if (b === 'month') return `${y}-${m}`
  return date
}
function groupDaily(daily: Report['daily'], b: Bucket): Report['daily'] {
  if (b === 'day') return daily
  const map = new Map<string, { sales: number; orders: number }>()
  for (const d of daily) {
    const k = bucketKey(d.date, b)
    const cur = map.get(k) ?? { sales: 0, orders: 0 }
    cur.sales += d.sales
    cur.orders += d.orders
    map.set(k, cur)
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }))
}

/** ดาวน์โหลดสรุปยอดขายเป็นไฟล์ Excel เปิดได้ (CSV + BOM ให้ Excel อ่านภาษาไทยออก)
 *  ⚠️ ZORT มีปุ่มนี้จริง ⇒ ของเราต้องทำงานจริงด้วย ไม่ใช่ปุ่มประดับ */
function downloadSummary(report: Report) {
  const lines = [
    ['ช่วงวันที่', `${report.range.from} ถึง ${report.range.to}`],
    ['ยอดขายรวม (บาท)', String(report.totals.sales)],
    ['จำนวนใบขาย', String(report.totals.orders)],
    ['เฉลี่ยต่อใบ (บาท)', String(Math.round(report.totals.avg))],
    /* 🔴 **ไฟล์ที่โหลดออกไปต้องมีคำกำกับเหมือนบนจอ** — ไม่งั้นยอดที่ยังไม่หักใบคืน
       หลุดออกไปอยู่ในไฟล์ที่คนเอาไปทำบัญชีต่อ โดยไม่มีอะไรบอกว่ามันเกินจริง
       ⚠️ ดึงไม่สำเร็จก็ต้องเขียนว่า "ยังไม่รู้" ห้ามเว้นว่างหรือใส่ 0 */
    report.returns === null
      ? ['ใบขายในช่วงนี้ที่ถูกคืน', 'ยังไม่รู้ — ท่ออ่านตารางใบคืนไม่ได้ (ยอดขายข้างบนยังไม่ได้หักใบคืน)']
      : ['ใบขายในช่วงนี้ที่ถูกคืน (ใบ)', String(report.returns.count)],
    ...(report.returns === null ? [] : [
      ['มูลค่าที่ถูกคืน (บาท)', String(report.returns.amount)],
      /* ✅ ไม่ใช่ "โดยประมาณ" อีกแล้ว — ท่อจับคู่ใบคืนกับใบขายในขอบเขตเดียวกับตัวกรองนี้ */
      ['ยอดขายสุทธิหลังหักใบคืน (บาท)', String(Math.round((report.totals.sales - report.returns.amount) * 100) / 100)],
      /* 🔴 ขอบเขตต้องมาจากท่อ ไม่ใช่เขียนเอง — ท่อรู้ว่าตัวเองจับคู่ด้วยอะไร */
      ...(report.returnsScope ? [['ขอบเขตการหักใบคืน', report.returnsScope]] : []),
      /* 🔴 ใบคืนที่หาใบขายต้นทางไม่เจอ = ไม่ได้ถูกหัก ⇒ ต้องอยู่ในไฟล์ด้วย
         ไฟล์ออกนอกระบบไปแล้ว คนที่เอาไปทำบัญชีไม่มีทางย้อนมาอ่านคำเตือนบนจอ */
      ...(report.unmatchedReturns && report.unmatchedReturns.count > 0
        ? [['⚠️ ใบคืนที่หาใบขายต้นทางไม่เจอ (ยังไม่ได้หัก)',
            `${report.unmatchedReturns.count} ใบ · ${report.unmatchedReturns.amount} บาท · นับรวมทุกร้าน/ทุกช่องทาง ไม่ผูกกับตัวกรองนี้`]]
        : []),
      ...(report.returnsSyncComplete === false
        ? [['🔴 คำเตือน', 'ตารางใบคืนยังซิงก์ไม่ครบ — ยอดสุทธิข้างบนหักไม่ครบ']]
        : []),
      ['หมายเหตุ', 'ยอดขายรวมด้านบนยังไม่ได้หักใบคืน — ใช้บรรทัด "ยอดขายสุทธิหลังหักใบคืน" แทน'],
    ]),
    [],
    ['วันที่', 'ยอดขาย (บาท)', 'จำนวนใบ'],
    ...report.daily.map((d) => [d.date, String(d.sales), String(d.orders)]),
    [],
    ['ช่องทาง', 'ยอดขาย (บาท)', 'จำนวนใบ'],
    ...report.channels.map((c) => [c.name, String(c.sales), String(c.orders)]),
  ]
  const csv = lines.map((r) => (r ?? []).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `สรุปยอดขาย-${report.range.from}-ถึง-${report.range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* 📤 ปุ่ม Excel เพิ่มตามที่ ZORT มี (ZORT มี 7 ปุ่มในหน้านี้ · ของเราเดิมมี 1)
   🔴 **ทำเฉพาะที่ข้อมูลอยู่บนจอแล้ว** — ตามสินค้า กับ รายวัน
      ที่ยังไม่ทำ: กำไรจากการขาย/กำไรรวม (ยังไม่มีนิยามต้นทุน · CEO รับไล่) · รายเดือน (จอนี้ไม่ได้ดึงรายเดือน)
   ⚠️ ทุกไฟล์ต้องมีบรรทัดช่วงวันที่กำกับ ไม่งั้นเปิดทีหลังไม่รู้ว่าเป็นของช่วงไหน */
/* 🔴 **กันช่องที่ขึ้นต้นด้วย `=` `+` `-` `@` ถูก Excel อ่านเป็นสูตร** (ฝั่งท่อเตือน 16 ก.ย. 2569)
   ชื่อสินค้าของร้านขึ้นต้นด้วย `-` ได้จริง ⇒ เปิดไฟล์แล้ว Excel จะพยายามคำนวณ
   ⇒ เติม `'` ข้างหน้า (Excel แสดงเป็นข้อความ ไม่ติดเครื่องหมายในเซลล์) */
function csvCell(v: unknown): string {
  const t = String(v ?? '')
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t
  return `"${safe.replace(/"/g, '""')}"`
}

function saveCsv(name: string, lines: (string[] | null)[]) {
  const csv = lines.map((r) => (r ?? []).map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* 📤 ไฟล์ "ยอดขายตามสินค้า"
   🔴 **ยิงคำขอของตัวเองตอนกด ห้ามใช้รายการที่แสดงบนจอ** (ฝั่งท่อจับได้ 16 ก.ย. 2569)
      บนจอขอมาแค่ `limit=10` เพื่อแสดง 10 อันดับ ⇒ ถ้าเอาไปทำไฟล์ คนเปิดไฟล์จะนึกว่า
      ร้านขายแค่ 10 อย่าง **โดยไม่มีอะไรบอกว่าไม่ครบ** (คลาสเดียวกับ "เลขเพื่อแสดงผล ห้ามใช้ตัดสินใจ")
   🔴 **ไม่ครบต้องเขียนบนหัวไฟล์** — ท่อรุ่นเก่ายังตัดที่ 100 รหัส (ยิงดูแล้ว 16 ก.ย.: limitApplied 100 · clamped)
      ⇒ เช็ค `complete === true` + `totalSkus` ก่อน ถ้าไม่ครบให้ขึ้นบรรทัดเตือนเป็นบรรทัดแรกของไฟล์ */
async function downloadByProduct(report: Report): Promise<string> {
  const { from, to } = report.range
  const r = await fetch(`/api/web/core?list=topproducts&from=${from}&to=${to}&limit=5000`)
  const d = await r.json().catch(() => null)
  if (!r.ok || !d || d.error || !Array.isArray(d.items)) {
    return `ดึงยอดขายรายสินค้าไม่สำเร็จ — ไม่ได้สร้างไฟล์ (${d?.error ?? `HTTP ${r.status}`})`
  }
  const items = d.items as { sku: string; name: string; qty: number; amount?: number | null }[]
  const complete = d.complete === true
  const totalSkus = typeof d.totalSkus === 'number' ? d.totalSkus : null
  const warn = complete
    ? null
    : ['⚠️ ไฟล์นี้ไม่ครบ',
      totalSkus !== null
        ? `ได้ ${items.length} จาก ${totalSkus} รหัส — เซิร์ฟเวอร์ตัดจำนวนรายการที่ส่งได้`
        : `ได้ ${items.length} รหัส · เซิร์ฟเวอร์ยังไม่บอกจำนวนรหัสทั้งหมด ⇒ **ยังไม่รู้ว่าครบหรือไม่**`]
  saveCsv(`ยอดขายตามสินค้า-${from}-ถึง-${to}`, [
    ...(warn ? [warn, null] : []),
    ['ช่วงวันที่', `${from} ถึง ${to}`],
    /* 🔴 ต้องบอกว่ายอดนี้คิดจากบรรทัดสินค้า ไม่ใช่หัวใบ — คนเอาไปเทียบกับยอดรวมแล้วจะงง */
    ['ที่มา', 'คิดจากบรรทัดสินค้าในใบขาย (ไม่รวมส่วนลดท้ายบิล/ค่าส่ง) ⇒ ผลรวมไม่เท่ากับยอดขายรวมของช่วง'],
    ['จำนวนรหัสในไฟล์', String(items.length)],
    ['จำนวนรหัสทั้งหมดในเงื่อนไขนี้', totalSkus !== null ? String(totalSkus) : 'ยังไม่รู้ (เซิร์ฟเวอร์ไม่ได้บอก)'],
    null,
    ['รหัสสินค้า', 'สินค้า', 'จำนวน', 'ยอดขาย (บาท)'],
    ...items.map((p) => [p.sku, p.name, String(p.qty), p.amount == null ? '' : String(p.amount)]),
  ])
  return complete
    ? ''
    : (totalSkus !== null
      ? `ไฟล์ไม่ครบ — ได้ ${items.length} จาก ${totalSkus} รหัส (เขียนเตือนไว้บรรทัดแรกของไฟล์แล้ว)`
      : `ยังไม่รู้ว่าไฟล์ครบหรือไม่ — ได้ ${items.length} รหัส (เขียนเตือนไว้ในไฟล์แล้ว)`)
}

function downloadDaily(report: Report) {
  saveCsv(`ยอดขายรายวัน-${report.range.from}-ถึง-${report.range.to}`, [
    ['ช่วงวันที่', `${report.range.from} ถึง ${report.range.to}`],
    ['หมายเหตุ', 'ยอดรายวันยังไม่ได้หักใบคืน — ดูยอดสุทธิที่ไฟล์สรุปยอดขาย'],
    null,
    ['วันที่', 'ยอดขาย (บาท)', 'จำนวนใบ'],
    ...report.daily.map((d) => [d.date, String(d.sales), String(d.orders)]),
  ])
}

// สีประจำช่องทาง — เทียบจากชื่อจริงใน ZORT ไม่ตรงกับใครใช้สีเทา
function chanColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('shopee')) return 'bg-orange-500'
  if (n.includes('lazada')) return 'bg-indigo-500'
  if (n.includes('tiktok')) return 'bg-gray-900'
  if (n.includes('gucut')) return 'bg-red-500'
  if (n.includes('pos') || n.includes('หน้าร้าน')) return 'bg-emerald-500'
  return 'bg-gray-400'
}

function pct(cur: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (!prev) return cur ? { text: 'ใหม่', tone: 'up' } : { text: '—', tone: 'flat' }
  const p = ((cur - prev) / prev) * 100
  if (Math.abs(p) < 0.05) return { text: '0%', tone: 'flat' }
  return { text: `${p > 0 ? '+' : ''}${p.toFixed(1)}%`, tone: p > 0 ? 'up' : 'down' }
}

function PctBadge({ cur, prev }: { cur: number; prev: number }) {
  const { text, tone } = pct(cur, prev)
  const cls =
    tone === 'up' ? 'text-emerald-600 bg-emerald-50' : tone === 'down' ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50'
  return <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{text}</span>
}

/* กราฟยอดขาย — SVG ล้วน ไม่พึ่งไลบรารี
   🔴 **ค่าเริ่มต้นเป็น "เส้นล้วน" ให้เหมือน ZORT** (สเปกเมนู 2 ข้อ 9 · ท่านประธานสั่ง 15 ก.ย. 2569)
      ของเดิม (แท่งยอดขาย + เส้นจำนวนใบทับ) **ไม่ได้ทิ้ง** — ย้ายไปอยู่ในปุ่มสลับชนิดกราฟ (ข้อ 5)
   ⚠️ สองชนิดนี้ตอบคนละคำถาม: เส้น = ยอดขายอย่างเดียว · แท่ง = ยอดขาย + จำนวนใบ
      ⇒ ปุ่มสลับต้องบอกด้วยว่าอันไหนกำลังดูอยู่ ไม่ใช่สลับแล้วเงียบ */
function TrendChart({ daily, kind }: { daily: Report['daily']; kind: 'line' | 'bar' }) {
  const W = 720, H = 200, PAD = 8
  const maxSales = Math.max(...daily.map((d) => d.sales), 1)
  const maxOrders = Math.max(...daily.map((d) => d.orders), 1)
  const n = daily.length
  const bw = Math.min(40, ((W - PAD * 2) / n) * 0.55)
  const x = (i: number) => PAD + ((W - PAD * 2) * (i + 0.5)) / n
  const line = daily
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - 24 - (d.orders / maxOrders) * (H - 48)).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={kind === 'line' ? 'กราฟเส้นยอดขายรายวัน' : 'กราฟแท่งยอดขายรายวัน พร้อมเส้นจำนวนใบ'}>
      {/* ── ชนิด "เส้นล้วน" (ค่าเริ่มต้น · เหมือน ZORT) — เส้นเดียวคือ **ยอดขาย** ไม่ใช่จำนวนใบ ── */}
      {kind === 'line' && (
        <>
          <path
            d={daily
              .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - 24 - (d.sales / maxSales) * (H - 48)).toFixed(1)}`)
              .join(' ')}
            fill="none" strokeWidth={2} className="stroke-violet-500" strokeLinejoin="round" strokeLinecap="round"
          />
          {daily.map((d, i) => (
            <g key={d.date}>
              <circle cx={x(i)} cy={H - 24 - (d.sales / maxSales) * (H - 48)} r={2.5} className="fill-violet-500" />
              <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
                {parseInt(String(d.date ?? '').slice(8), 10) || ''}
              </text>
            </g>
          ))}
        </>
      )}
      {kind === 'bar' && daily.map((d, i) => {
        const h = (d.sales / maxSales) * (H - 48)
        return (
          <g key={d.date}>
            <rect x={x(i) - bw / 2} y={H - 24 - h} width={bw} height={Math.max(h, 1)} rx={4} className="fill-blue-500/80" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {parseInt(String(d.date ?? '').slice(8), 10) || ''}
            </text>
            {d.sales > 0 && (
              <text x={x(i)} y={H - 30 - h} textAnchor="middle" className="fill-gray-500 text-[9px] font-medium">
                {d.sales >= 1000 ? `${(d.sales / 1000).toFixed(d.sales >= 10000 ? 0 : 1)}K` : Math.round(d.sales)}
              </text>
            )}
          </g>
        )
      })}
      {kind === 'bar' && (
        <>
          <path d={line} fill="none" strokeWidth={2} className="stroke-emerald-500" strokeLinejoin="round" strokeLinecap="round" />
          {daily.map((d, i) => (
            <circle key={d.date} cx={x(i)} cy={H - 24 - (d.orders / maxOrders) * (H - 48)} r={3} className="fill-emerald-500" />
          ))}
        </>
      )}
      {/* ⑩ ป้ายแกน x — ZORT มี ของเราไม่มี (สเปกข้อ 10) */}
      <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-gray-400 text-[9px]">ช่วงเวลา</text>
    </svg>
  )
}

/* ③④ dropdown "ยอดขายรวม ▾" มุมขวาบนของกล่อง — ZORT มีทั้งสองกล่อง (สเปกข้อ 3–4)
   🔴 **ของเรามีชนิดเดียวจริง ๆ** ⇒ ตัวเลือกอื่นต้องปิดไว้และบอกว่ายังไม่มี
      ห้ามใส่ตัวเลือกที่เลือกแล้วไม่มีอะไรเกิดขึ้น (กติกาในใบ: ห้ามปุ่มหลอก)
   📌 ตัวเลือกของ ZORT ที่เห็นในจอเดียวกัน: ยอดขายรวม · ยอดขายตามหมวดหมู่
      (ตามหมวดหมู่ยังทำไม่ได้ เพราะยอดขายรายสินค้าที่ท่อส่งมา **ไม่มีหมวดหมู่ติดมาด้วย**) */
function ReportKindSelect() {
  return (
    <select
      value="total"
      onChange={() => { /* มีค่าเดียวที่เลือกได้จริง */ }}
      className="text-[12.5px] border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
      /* 🔄 **แก้ป้าย 15 ก.ย. 2569** — เดิมเขียนว่า "ยังไม่มี" เพราะท่อไม่ส่งหมวดมา
         ตอนนี้ท่อส่งแล้ว (b0a4aa3 · `by=category` รวมให้ฝั่งเซิร์ฟเวอร์ 36 หมวด)
         ⇒ ที่ยังขาดคือ **จอยังไม่ได้ทำ** ไม่ใช่ข้อมูลไม่มี · เขียนให้ตรงกับความจริงปัจจุบัน
         (ข้อความที่เคยถูกแล้วไม่มีใครกลับมาแก้ = โกหกเงียบ ๆ — บทเรียนเดิมของโปรเจกต์นี้) */
      title="ท่อรวมยอดตามหมวดให้ได้แล้ว แต่จอนี้ยังไม่ได้ทำมุมมองรายหมวด"
    >
      <option value="total">ยอดขายรวม</option>
      <option value="cat" disabled>ยอดขายตามหมวดหมู่ (ท่อพร้อมแล้ว · จอยังไม่ได้ทำ)</option>
      {/* 🔴 ZORT มีสองตัวนี้ในจอเดียวกัน — ของเรา **ยังคำนวณไม่ได้** เพราะยังไม่รู้ว่า ZORT คิดต้นทุนจากอะไร
             (ราคาทุน ณ วันขาย / ปัจจุบัน / เฉลี่ยจากใบซื้อ) ⇒ คงช่องไว้ให้ผังตรง **แต่ห้ามโชว์ 0** */}
      <option value="profit-sale" disabled>กำไรจากการขาย (ยังคำนวณไม่ได้ — รอนิยามต้นทุน)</option>
      <option value="profit-all" disabled>กำไรรวม (ยังคำนวณไม่ได้ — รอนิยามต้นทุน)</option>
    </select>
  )
}

/** 🕰 บอกอายุของตารางใบคืน — ท่อซิงก์ทุกชั่วโมงนาทีที่ :07
 *  🔴 **null = ไม่รู้ ห้ามเขียนว่าซิงก์หยุด** (ท่อรุ่นเก่าอาจไม่ส่งช่องนี้)
 *  ⚠️ เวลาจากท่อเป็น UTC ⇒ +7 ก่อนแสดง (บทเรียนเดิมทั้งโปรเจกต์) */
function ReturnsFreshness({ utc }: { utc: string | null }) {
  if (!utc) return null
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(utc) ? utc : `${utc.replace(' ', 'T')}Z`
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  const ageMin = Math.round((Date.now() - t.getTime()) / 60000)
  const th = new Date(t.getTime() + 7 * 3600e3)
  const p = (n: number) => String(n).padStart(2, '0')
  const at = `${p(th.getUTCDate())}/${p(th.getUTCMonth() + 1)} ${p(th.getUTCHours())}:${p(th.getUTCMinutes())} น.`
  const stale = ageMin > 120
  return (
    <p className={`text-[11px] mt-2 text-center ${stale ? 'text-amber-800' : 'text-gray-400'}`}>
      {stale ? '🔴 ' : '🕰 '}ตารางใบคืนซิงก์ล่าสุด <b>{at}</b> ({ageMin < 60 ? `${ageMin} นาที` : `${Math.floor(ageMin / 60)} ชม.`}ที่แล้ว)
      {stale && <> — ควรซิงก์ทุกชั่วโมง <b>ตัวซิงก์น่าจะหยุด</b> ยอดที่หักอาจไม่ครบ</>}
    </p>
  )
}

export default function SalesReportPage() {
  /* ① ค่าเริ่มต้นเป็น "ย้อนหลัง 3 เดือน" ให้เหมือน ZORT (สเปกเมนู 2 ข้อ 1)
     ⚠️ เปลี่ยนค่านี้แล้วตัวเลขบนจอจะกระโดดขึ้นทันที **ไม่ใช่บั๊ก** — คนละช่วงเวลากับของเดิม */
  const [days, setDays] = useState(90)
  /* ⑤ ชนิดกราฟ — เริ่มที่เส้นล้วนเหมือน ZORT · ของเดิม (แท่ง+เส้นจำนวนใบ) ยังเลือกได้ */
  const [chartKind, setChartKind] = useState<'line' | 'bar'>('line')
  /* ②–④/⑥ ตัวเลือกที่ ZORT มีแต่ของเรายังทำไม่ได้จริง — **ต้องบอกตรง ๆ ห้ามเป็นปุ่มหลอก** */
  const [advOpen, setAdvOpen] = useState(false)
  /** ⑥ ช่องค้นหาเหนือตาราง — กรอง **เฉพาะแถวที่โหลดมาแล้ว** ⇒ ต้องเขียนขอบเขตไว้ข้าง ๆ */
  const [tableQ, setTableQ] = useState('')
  /** ผลการส่งออกไฟล์ล่าสุด — ไม่ครบ/ล้มเหลวต้อง **ขึ้นบนจอด้วย** ไม่ใช่ซ่อนไว้ในไฟล์อย่างเดียว */
  const [exportNote, setExportNote] = useState('')
  /* 🏬 **ยอดขายตามคลัง/สาขา** — แท็บนี้เดิมกรอง "ช่องทางที่ชื่อมีคำว่า POS/หน้าร้าน"
     ซึ่งเป็น **คนละแกนกับ ZORT** (ZORT แบ่งตาม *คลัง* โกดัง/KLD/ANJ ไม่ใช่ช่องทางขาย)
     ตอนนี้ท่อมี `warehouse_code` แล้ว (gucut-web 270f04e) ⇒ แบ่งตามคลังจริงได้
     🔴 **ข้อมูลคลังเต็มเฉพาะใบ 1–15 ก.ย. 2569** ใบก่อนหน้าเป็น null จนกว่าจะกวาดย้อนหลังเสร็จ
        ⇒ ใบที่ยังไม่รู้คลัง **ต้องเป็นกองของตัวเอง** ห้ามยัดเข้าคลังไหน ห้ามตัดทิ้ง (ฝั่งท่อกำชับ) */
  const [whSales, setWhSales] = useState<{
    code: string; name: string; orders: number; sales: number
    /** 🔴 ใบคืนรายคลัง (ท่อ gucut-web 26cbd2e) — `null` = **อ่านใบคืนไม่ได้ ⇒ ยังไม่รู้** · `0` = อ่านได้และไม่มีใบคืนจริง
     *  ไม่มีคีย์เลย = ท่อรุ่นเก่า ⇒ คงขีดไว้เหมือนเดิม (สามอย่างนี้คนละความหมาย) */
    returns?: number | null; returnsAmount?: number | null
  }[] | null>(null)
  const [whSalesErr, setWhSalesErr] = useState('')
  const [whLoading, setWhLoading] = useState(false)
  /** ข้อความขอบเขตของยอดรายคลัง — **มาจากท่อ ไม่ใช่จอเขียนเอง** (วันที่เริ่มเก็บคลังจะได้ไม่ค้าง) */
  const [whScope, setWhScope] = useState('')
  /** 🏬 คลังที่เลือกในแท็บคลัง (ว่าง = ทั้งหมด) — ZORT มี dropdown ตัวนี้กรองตารางสินค้าข้างล่าง */
  const [whPick, setWhPick] = useState('')
  const [whItems, setWhItems] = useState<{ sku: string; name: string; qty: number; amount: number }[] | null>(null)
  const [whItemsErr, setWhItemsErr] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshed, setRefreshed] = useState(new Date())
  const [tab, setTab] = useState<'all' | 'branch' | 'chan' | 'mkt'>('all')
  const [bucket, setBucket] = useState<Bucket>('day')

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError('')
    try {
      const to = thaiDay(0)
      const from = thaiDay(d - 1)
      const prevTo = thaiDay(d)
      const prevFrom = thaiDay(d * 2 - 1)

      const [cur, prev, best, daily] = await Promise.all([
        fetchRange(from, to),
        fetchRange(prevFrom, prevTo),
        // ยอดขายรายสินค้าพร้อม "ยอดเงินจริง" จาก order_items (ไม่ใช่ qty คูณราคาขาย ซึ่งเป็นการเดา)
        fetch(`/api/web/core?list=topproducts&from=${from}&to=${to}&limit=10`)
          .then((r) => r.json())
          .catch(() => null),
        fetchDaily(d),
      ])
      /* 🔴 **เลิกนับใบคืนเองแล้ว** — ท่อคิดมาให้ในคำขอเดียวกับยอดขาย (15 ก.ย. 2569)
         ของเดิมวนดึง `list=returnorders` ทุกหน้าแล้วจับคู่เองในเบราว์เซอร์ ซึ่งมีปัญหาสองชั้น:
           ① นับ "ใบคืนที่ออกในช่วงนี้" ซึ่งเป็นคนละคำถามกับ "ยอดขายในช่วงนี้ที่ถูกคืน"
           ② 🔴 **เก็บใส่ Map โดยใช้ `number` เป็นกุญแจ** — แต่เลขที่ใบคืนของ ZORT **ซ้ำกันได้จริง**
              (ฝั่งท่อวัด 15 ก.ย. 2569: 689 ใบ มีเลขที่ไม่ซ้ำแค่ 537) ⇒ ใบที่เลขซ้ำถูกทับหาย
              ⇒ เลขใบคืนบนจอนี้ **ต่ำกว่าจริงมาตลอด** โดยไม่มีอะไรฟ้อง
              (ฝั่งท่อเจอบั๊กเดียวกันในกระจกของเขา แล้วย้ายไป return_orders_v2 กุญแจ id)
         ⇒ ตอนนี้ใช้เลขจากท่อ ซึ่งจับคู่ด้วย id และผูกขอบเขตกับวันที่ขาย */
      const ret = cur.returnedCount === null || cur.returnedAmount === null
        ? null
        : { count: cur.returnedCount, amount: cur.returnedAmount }
      const retErr = ret === null ? 'ท่ออ่านตารางใบคืนไม่ได้รอบนี้' : undefined

      // ยอดรายวัน — ฐานรวมมาให้แล้ว จอแค่**เติมวันที่ไม่มีออเดอร์ให้เป็นศูนย์**
      // ⚠️ ท่อไม่คืนแถวของวันที่ขายไม่ได้ ถ้าไม่เติมเอง เส้นกราฟจะลากข้ามวันนั้น
      //    แล้วดูเหมือนร้านขายได้ทุกวัน — ซึ่งเป็นการโกหกด้วยการละเว้น
      const byDay = new Map<string, { sales: number; orders: number }>()
      for (let i = d - 1; i >= 0; i--) byDay.set(thaiDay(i), { sales: 0, orders: 0 })
      for (const row of daily) {
        const slot = byDay.get(row.day)
        if (!slot) continue
        slot.sales = Number(row.sales) || 0
        slot.orders = Number(row.orders) || 0
      }

      const prevByChan = new Map(prev.channels.map((c) => [c.channel, c.amount]))
      /* `category` = ช่องใหม่จากท่อ (b0a4aa3) · ไม่มีคีย์ = ท่อรุ่นเก่า ⇒ จอต้องเงียบ ไม่ใช่เขียนว่าไม่มีหมวด */
      const bestRows: { sku: string; name: string; qty: number; amount: number; category?: string }[] =
        Array.isArray(best?.items) ? best.items.filter((r: { qty: number }) => r.qty > 0) : []
      const topError = !best ? 'ยิงไปที่ท่อสินค้าขายดีไม่สำเร็จ'
        : (typeof best.error === 'string' ? best.error
          : (Array.isArray(best.items) ? '' : 'ท่อสินค้าขายดีตอบมาในรูปแบบที่อ่านไม่ได้'))

      setReport({
        range: { from, to, days: d },
        totals: {
          sales: cur.amount,
          orders: cur.total,
          avg: cur.total ? cur.amount / cur.total : 0,
          prevSales: prev.amount,
          prevOrders: prev.total,
        },
        daily: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
        channels: cur.channels.map((c) => ({
          label: c.channel,
          name: c.channel,
          store: '',
          sales: c.amount,
          orders: c.orders,
          prevSales: prevByChan.get(c.channel) ?? 0,
        })),
        topError,
        returns: ret,
        returnsError: retErr,
        unmatchedReturns: cur.unmatchedReturns,
        returnsSyncedAtUtc: cur.returnsSyncedAtUtc,
        returnsSyncComplete: cur.returnsSyncComplete,
        returnsScope: cur.returnsScope,
        topProducts: bestRows.map((r) => ({
          name: r.name || r.sku, sku: r.sku, qty: r.qty, amount: r.amount, category: r.category,
        })),
      })
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
      setRefreshed(new Date())
    }
  }, [])

  useEffect(() => { load(days) }, [load, days])

  /* 🏬 ยอดตามคลัง — **คำขอเดียว** `list=orderfacets&warehouses=1` (ท่อ gucut-web 01fbeb1)
     🔴 **เลิกยิงทีละคลังแล้ว และเลิกคิดกอง "ยังไม่รู้คลัง" ด้วยการลบ** (แก้ 15 ก.ย. 2569 · ฝั่งท่อจับได้)
        ของเดิม: ยิงทีละคลังแล้วเอา "ยอดรวม − ผลรวมคลัง" เป็นกองไม่รู้คลัง
        พัง 2 ทางโดยไม่มีอะไรฟ้อง:
          ① สองฝั่งนับคนละขอบเขต (รายคลังรวมใบยกเลิก · ยอดรวมของจออีกแบบ) ⇒ กองที่ลบได้เพี้ยน
             ของจริง: จอได้ NEW 339 ใบ แต่ท่อนับ 321 เมื่อตัดใบยกเลิก
          ② **ถ้ามีคลังที่ 4 เพิ่มมา มันจะถูกยัดเข้ากองไม่รู้คลังเงียบ ๆ** (เพราะไม่อยู่ในรายชื่อที่จอวน)
        ⇒ ตอนนี้ท่อส่ง `byWarehouse` มาให้ครบทุกแถวรวมแถว `code: ""` (ยังไม่รู้คลัง) และผลรวมเท่ากับ stores เป๊ะ
     ⚠️ ไม่มีคีย์ `byWarehouse` = ท่อรุ่นเก่า ⇒ **ยังไม่รู้** ห้ามโชว์ 0 */
  useEffect(() => {
    if (tab !== 'branch' || !report) return
    let dead = false
    setWhLoading(true); setWhSalesErr('')
    const { from, to } = report.range
    Promise.all([
      fetch(`/api/web/core?list=orderfacets&from=${from}&to=${to}&warehouses=1`).then((r) => r.json()),
      /* ชื่อคลังที่คนอ่านรู้เรื่อง ("โกดัง" ไม่ใช่ "NEW") — **ถามท่ออีกเส้น ไม่ใช่รายชื่อตายตัวในจอ**
         คลังที่ไม่อยู่ในรายชื่อ (เช่นคลังใหม่ที่เพิ่งเปิด) จะโชว์ด้วยรหัสไปก่อน ไม่หายไปไหน */
      fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null),
    ])
      .then(([d, w]) => {
        if (dead) return
        if (d?.error) throw new Error(String(d.error))
        if (!Array.isArray(d?.byWarehouse)) {
          throw new Error('ท่อรุ่นนี้ยังไม่ส่งยอดแยกตามคลังมา (ไม่มี byWarehouse)')
        }
        const nameOf = new Map<string, string>(
          (Array.isArray(w?.warehouses) ? w.warehouses : [])
            .map((x: { code?: string; name?: string }) => [String(x.code ?? ''), String(x.name ?? '')]),
        )
        setWhSales((d.byWarehouse as {
          code: string; orders: number; amount: number; returns?: number | null; returnsAmount?: number | null
        }[]).map((x) => ({
          code: x.code, name: x.code ? (nameOf.get(x.code) || x.code) : 'ยังไม่รู้คลัง',
          orders: Number(x.orders) || 0, sales: Number(x.amount) || 0,
          /* ⚠️ แปลงเลขแบบไม่กลืน null — `Number(null)` เป็น 0 ซึ่งจะกลายเป็นคำโกหกว่า "ไม่มีใบคืน" */
          returns: 'returns' in x ? (typeof x.returns === 'number' ? x.returns : null) : undefined,
          returnsAmount: 'returnsAmount' in x ? (typeof x.returnsAmount === 'number' ? x.returnsAmount : null) : undefined,
        })))
        setWhScope(typeof d.warehouseScope === 'string' ? d.warehouseScope : '')
        setWhSalesErr('')
      })
      .catch((e) => { if (!dead) { setWhSales(null); setWhSalesErr(String(e instanceof Error ? e.message : e)) } })
      .finally(() => { if (!dead) setWhLoading(false) })
    return () => { dead = true }
  }, [tab, report])

  /* 🏬 ตารางสินค้าในแท็บคลัง — ZORT มี และกรองตามคลังที่เลือก (ท่อเปิด `topproducts&warehouse=` ให้แล้ว 01fbeb1)
     ⚠️ **ยอดตรงนี้คิดจากบรรทัดสินค้า** ส่วนยอดในตารางคลังคิดจากหัวใบ (รวมส่วนลดท้ายบิล/ค่าส่ง)
        ⇒ สองตัวไม่เท่ากันเป็นเรื่องปกติ **ห้ามเอามาเทียบกันเป็นด่าน** (ฝั่งท่อกำชับ) */
  useEffect(() => {
    if (tab !== 'branch' || !report) return
    let dead = false
    setWhItemsErr('')
    const { from, to } = report.range
    const q = `/api/web/core?list=topproducts&from=${from}&to=${to}&limit=20${whPick ? `&warehouse=${encodeURIComponent(whPick)}` : ''}`
    fetch(q).then((r) => r.json()).then((d) => {
      if (dead) return
      if (d?.error) throw new Error(String(d.error))
      /* ด่าน: ถ้าเลือกคลังแล้วท่อไม่ได้ใช้ ต้องไม่โชว์เป็นของคลังนั้น */
      if (whPick && d?.applied?.warehouse !== whPick) {
        throw new Error('ท่อไม่ได้กรองตามคลังที่เลือก (applied.warehouse ไม่ตรง)')
      }
      setWhItems(Array.isArray(d?.items) ? d.items : [])
    }).catch((e) => { if (!dead) { setWhItems(null); setWhItemsErr(String(e instanceof Error ? e.message : e)) } })
    return () => { dead = true }
  }, [tab, report, whPick])


  const grouped = report ? groupDaily(report.daily, bucket) : []
  // ⚠️ แยก "ช่องทางมาร์เก็ตเพลส" กับ "คลัง/สาขา" ด้วยชื่อช่องทางจริง ไม่ใช่เดาจากลำดับ
  const MKT = /shopee|lazada|tiktok/i
  const chans = report?.channels ?? []
  const shown =
    /* 🔄 **แท็บ branch ไม่ได้ใช้ตัวนี้แล้ว** (15 ก.ย. 2569) — เดิมกรองช่องทางที่ชื่อมีคำว่า POS/หน้าร้าน
       ซึ่งเป็นคนละแกนกับ ZORT (ZORT แบ่งตาม *คลัง*) ⇒ แท็บนั้นมีตารางของตัวเองแล้ว */
    tab === 'mkt' ? chans.filter((c) => MKT.test(c.name)) : chans
  const maxShown = Math.max(...shown.map((c) => c.sales), 1)

  return (
    <div className="p-4 md:p-6">
      {/* หัวจอแบบ ZORT: ชื่อจอ → บรรทัดช่วงเวลา → แท็บ (ภาพ 03-รายงานยอดขาย.jpg) */}
      <PageHead
        title="ยอดขาย"
        actions={
          <BtnGhost onClick={() => load(days)} disabled={loading}>
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </BtnGhost>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-[14px] font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer"
        >
          {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
        <span className="text-[12.5px] text-gray-400" suppressHydrationWarning>
          {report ? `${report.range.from} – ${report.range.to}` : ''} · อัพเดต {refreshed.toLocaleTimeString('th-TH')}
        </span>
        {/* ② ลิงก์ "ค้นหาขั้นสูง" — ZORT มีตรงนี้ (สเปกข้อ 2)
            🔴 **ห้ามเป็นลิงก์หลอก** ⇒ กดแล้วต้องได้คำตอบว่าตอนนี้กรองอะไรได้จริงบ้าง */}
        <button
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
          className="text-[12.5px] text-blue-600 hover:underline"
        >
          ค้นหาขั้นสูง
        </button>
      </div>

      {advOpen && (
        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          ⚠️ <b>ค้นหาขั้นสูงของจอนี้ยังทำไม่ได้</b> — จอนี้กรองได้แค่ <b>ช่วงเวลา</b> ที่เลือกข้างบน
          <br />เพราะเส้นที่จอนี้ใช้ (ยอดรายวัน · ยอดขายรายสินค้า) <b>รับแค่ช่วงวันที่</b> ยังไม่มีตัวกรองอื่น
          <br />⇒ ถ้าต้องกรองตามร้าน/ช่องทาง/สถานะ ให้ใช้จอ{' '}
          <Link href="/core/sales" className="text-blue-600 hover:underline">รายการขาย</Link>{' '}ซึ่งกรองได้จริงที่เซิร์ฟเวอร์
          <br /><span className="text-gray-500">(เขียนไว้ตรง ๆ ดีกว่าใส่ช่องที่กรอกแล้วไม่มีผล — ช่องหลอกทำให้คนเชื่อว่ากรองแล้ว)</span>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'all', label: 'ทั้งหมด' },
          { id: 'branch', label: 'ตามคลัง/สาขา' },
          { id: 'chan', label: 'ตามช่องทางการขาย' },
          { id: 'mkt', label: 'ตาม Marketplace' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {error && <ErrorBox title="ดึงข้อมูลจากคลังของเราไม่สำเร็จ">{error}</ErrorBox>}
      {loading && !report && <LoadingState />}

      {report && (
        <div className="space-y-4 mt-4">
          {tab === 'all' && (
            <>
              {/* สองการ์ดคู่กันแบบ ZORT: สรุปยอดขายรวม | รายงาน (กราฟ) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  {/* ⑧ ไอคอนวงกลมหน้าหัวข้อ + ③ dropdown มุมขวาบนของกล่อง (สเปกข้อ 3 กับ 8) */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">💰</span>
                      สรุปยอดขายรวม
                    </p>
                    <ReportKindSelect />
                  </div>
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-[34px] font-semibold text-blue-600 leading-none">
                      {fmtMoney(report.totals.sales)}
                    </p>
                    <p className="text-[12.5px] text-gray-500 mt-2">
                      {fmtNum(report.totals.orders)} ใบ · เฉลี่ยใบละ {fmtMoney(report.totals.avg)} บาท
                    </p>

                    {/* 🔴 **ยอดข้างบนยังไม่ได้หักของที่ลูกค้าคืน** — ZORT ไม่พลิกสถานะใบเดิม
                        เมื่อมีใบคืน ⇒ ใบยังเป็น Success ⇒ ถูกนับเป็นยอดขายต่อไป
                        (งานกระดาน t_mu1bkqes · วัดกับ production 14 ก.ย. 2569: 2.2–3.2% แล้วแต่ช่วง)
                        ⚠️ ตัวเลขนี้คือ **ใบคืนที่ออกในช่วงนี้** ไม่ใช่ "ยอดขายในช่วงนี้ที่ถูกคืน"
                           ใบคืนที่ออกเดือนนี้อาจเป็นของที่ขายเดือนก่อน ⇒ เขียนให้ตรงตามนั้น
                        ⚠️ ดึงไม่สำเร็จ = "ยังไม่รู้" **ห้ามแสดง 0** เพราะ 0 แปลว่าไม่มีใครคืนของ */}
                    {report.returns === null ? (
                      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-3 max-w-[320px] text-center leading-relaxed">
                        ⚠️ <b>ยังไม่รู้ว่ามีใบคืนเท่าไหร่</b> — ดึงรายการใบคืนไม่สำเร็จ
                        {report.returnsError ? ` (${report.returnsError})` : ''}
                        <br />ยอดข้างบน<b>ยังไม่ได้หักของที่ลูกค้าคืน</b> และตอนนี้บอกไม่ได้ว่าเท่าไหร่
                      </p>
                    ) : report.returns.count === 0 ? (
                      <p className="text-[12px] text-gray-400 mt-3 text-center">
                        ไม่มีใบขายในช่วงนี้ที่ถูกคืน · ยอดข้างบนจึงเท่ากับยอดสุทธิ
                      </p>
                    ) : (
                      /* ✅ **เลิกเขียนว่า "ราว" แล้ว** (15 ก.ย. 2569) — ท่อจับคู่ใบคืนกับใบขาย
                         ด้วย reference = orders.number และผูกขอบเขตกับ **วันที่ขาย** ตัวเดียวกับตัวกรองนี้
                         ⇒ totalAmount − returnedAmount เป็นยอดสุทธิจริง ไม่ใช่ค่าประมาณอีกต่อไป */
                      <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3 max-w-[360px] leading-relaxed">
                        🔴 <b>ยอดข้างบนยังไม่ได้หักของที่ลูกค้าคืน</b>
                        <br />
                        ใบขายในช่วงนี้ที่ถูกคืน <b>{fmtNum(report.returns.count)} ใบ</b>
                        {' '}รวม <b>{fmtMoney(report.returns.amount)}</b> บาท
                        <br />
                        ⇒ <b>ยอดสุทธิ {fmtMoney(report.totals.sales - report.returns.amount)} บาท</b>
                        {/* 🔴 ใบคืนที่หาใบขายต้นทางไม่เจอ = **ไม่ได้ถูกหักออก** ⇒ ต้องบอก ห้ามเงียบ
                            และมันไม่ผูกกับตัวกรองร้าน/ช่องทาง ⇒ เอาไปรวมเองไม่ได้ */}
                        {report.unmatchedReturns && report.unmatchedReturns.count > 0 && (
                          <span className="block text-[11px] text-amber-800 mt-1">
                            ⚠️ และมีใบคืนอีก <b>{fmtNum(report.unmatchedReturns.count)} ใบ</b>
                            {' '}({fmtMoney(report.unmatchedReturns.amount)} บาท) ที่<b>หาใบขายต้นทางไม่เจอ</b>
                            {' '}⇒ <b>ยังไม่ได้ถูกหักออก</b> และนับรวมทุกร้าน/ทุกช่องทาง ไม่ผูกกับตัวกรองนี้
                          </span>
                        )}
                        {/* 🔴 ใบคืนซิงก์ยังไม่ครบ ⇒ ห้ามเขียนว่าหักครบแล้ว */}
                        {report.returnsSyncComplete === false && (
                          <span className="block text-[11px] text-red-800 mt-1">
                            🔴 <b>ตารางใบคืนยังซิงก์ไม่ครบ</b> — ยอดสุทธิข้างบนจึงยัง<b>หักไม่ครบ</b>
                          </span>
                        )}
                        <span className="block text-[11px] text-amber-800 mt-1">
                          <Link href="/core/return-orders" className="underline">ดูใบคืนทั้งหมด</Link>
                        </span>
                      </div>
                    )}
                    {/* 🕰 ความสดของตารางใบคืน — ท่อซิงก์ทุกชั่วโมงนาทีที่ :07
                        ⇒ เก่าเกิน ~2 ชม. แปลว่าตัวซิงก์น่าจะหยุด · null = ไม่รู้ ห้ามเขียนว่าหยุด */}
                    {report.returns !== null && (
                      <ReturnsFreshness utc={report.returnsSyncedAtUtc ?? null} />
                    )}
                    <div className="mt-5 flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => downloadSummary(report)}
                        className="text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50"
                      >
                        Download Excel – สรุปยอดขาย
                      </button>
                      {/* 📤 สองปุ่มนี้ทำจากข้อมูลที่อยู่บนจอแล้ว ⇒ กดได้จริงทันที ไม่ใช่ปุ่มหลอก */}
                      <button
                        onClick={async () => {
                          setExportNote('กำลังขอข้อมูลครบทุกรหัส…')
                          setExportNote(await downloadByProduct(report))
                        }}
                        className="text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Export ยอดขายตามสินค้า
                      </button>
                      <button
                        onClick={() => downloadDaily(report)}
                        disabled={report.daily.length === 0}
                        className="text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Export ยอดขายรายวัน
                      </button>
                    </div>
                    {exportNote && (
                      <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2 leading-relaxed max-w-[360px] text-center">
                        ⚠️ {exportNote}
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">📈</span>
                      รายงาน
                    </p>
                    <ReportKindSelect />
                  </div>
                  <TrendChart daily={grouped} kind={chartKind} />
                  {/* ⑤ ปุ่มสลับชนิดกราฟ (ซ้ายล่าง) + ปุ่มช่วงเวลา (ขวาล่าง) — ตำแหน่งเดียวกับ ZORT */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      {([['line', '📈', 'กราฟเส้น (ยอดขายอย่างเดียว)'], ['bar', '📊', 'กราฟแท่ง (ยอดขาย + เส้นจำนวนใบ)']] as const)
                        .map(([k, icon, title]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setChartKind(k)}
                            title={title}
                            aria-pressed={chartKind === k}
                            className={`text-[13px] w-7 h-7 rounded border ${
                              chartKind === k ? 'bg-violet-50 border-violet-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                          >
                            {icon}
                          </button>
                        ))}
                      {/* 🔴 สลับแล้วต้องรู้ว่ากำลังดูอะไร — สองชนิดนี้ตอบคนละคำถาม */}
                      <span className="text-[11.5px] text-gray-400 ml-1">
                        {chartKind === 'line' ? 'เส้น = ยอดขาย' : 'แท่ง = ยอดขาย · เส้นเขียว = จำนวนใบ'}
                      </span>
                    </div>
                    <div className="flex justify-end gap-1">
                    {BUCKETS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setBucket(b.id)}
                        className={`text-[12px] px-2.5 py-1 rounded ${
                          bucket === b.id ? 'text-blue-600 font-semibold underline' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* การ์ดยอดขายรายสินค้า — คอลัมน์ตามภาพ ZORT */}
              <Card padded={false}>
                {/* ⑧ ไอคอนวงกลม + ⑥ แถบเครื่องมือเหนือตาราง ([สินค้า ▾] + ช่องค้นหา) — สเปกข้อ 6 กับ 8 */}
                <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 pt-4">
                  <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2 mr-auto">
                    <span className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center text-[14px]">🧾</span>
                    ยอดขาย
                  </p>
                  {/* 🔴 ZORT มีตัวเลือกจัดกลุ่ม 5 แบบ (สินค้า · หมวดหมู่ · ผู้ติดต่อ · ผู้ใช้งาน · คลัง/สาขา)
                         ของเรามีจริงแบบเดียว ⇒ ที่เหลือ **ปิดไว้และเขียนว่ายังไม่มี** ห้ามเลือกได้แล้วเงียบ */}
                  <select
                    value="sku"
                    onChange={() => { /* มีแบบเดียวที่ทำได้จริง */ }}
                    className="text-[12.5px] border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
                    title="ZORT จัดกลุ่มได้ 5 แบบ · ของเราทำได้แบบเดียวบนจอนี้ (รายสินค้า) — หมวดหมู่ท่อพร้อมแล้วแต่จอยังไม่ได้ทำ"
                  >
                    <option value="sku">สินค้า</option>
                    <option value="cat" disabled>หมวดหมู่ (ท่อพร้อมแล้ว · จอยังไม่ได้ทำ)</option>
                    <option value="contact" disabled>ผู้ติดต่อ (ยังไม่มี)</option>
                    <option value="user" disabled>ผู้ใช้งาน (ยังไม่มี)</option>
                    <option value="wh" disabled>คลัง/สาขา (ยังไม่มี)</option>
                  </select>
                  <input
                    value={tableQ}
                    onChange={(e) => setTableQ(e.target.value)}
                    placeholder="พิมพ์คำค้นหา"
                    className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]"
                  />
                </div>
                {/* 🔴 **ขอบเขตของช่องค้นหานี้ต้องเขียนไว้** — มันกรองเฉพาะแถวที่โหลดมาแล้ว
                       ไม่ใช่ค้นทั้งช่วงเวลาที่เซิร์ฟเวอร์ ⇒ ไม่เขียน คนจะเชื่อว่าค้นครบทุกใบ
                       (คลาสเดียวกับ "ตัวนับกับตัวแถวมาคนละกติกา" ใน CLAUDE.md) */}
                <p className="text-[11.5px] text-gray-400 px-4 md:px-5 pt-1">
                  ช่องค้นหานี้กรอง<b>เฉพาะรายการที่โหลดมาแล้ว</b> ({fmtNum((report.topProducts ?? []).length)} รายการ)
                  {' '}ไม่ใช่ค้นทั้งช่วงเวลาที่เซิร์ฟเวอร์
                  {/* ⑦ หมวดหมู่ใต้ชื่อสินค้า — ท่อส่งมาแล้ว (b0a4aa3) ⇒ ขึ้นจริงในตารางข้างล่าง */}
                </p>
                <TableWrap>
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-white border-b border-gray-200">
                      <tr>
                        <th className={TH}>รหัสสินค้า</th>
                        <th className={TH}>สินค้า</th>
                        <th className={THR}>จำนวน</th>
                        <th className={THR}>ยอดขาย(บาท)</th>
                        <th className={THR}>ยอดขาย (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!report.topProducts || report.topProducts.length === 0) && (
                        <EmptyState
                          cols={5}
                          icon={report.topError ? '⚠️' : '📊'}
                          title={report.topError ? 'ดึงยอดขายรายสินค้าไม่ได้' : 'ยังไม่มียอดขายรายสินค้าในช่วงนี้'}
                          detail={report.topError
                            ? `ตารางนี้ว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะขายไม่ได้ — ${report.topError}`
                            : 'ลองขยายช่วงเวลาด้านบน · ตัวเลขนับจากรายการสินค้าในใบขายจริง'} />
                      )}
                      {(report.topProducts ?? [])
                        .filter((p) => {
                          const t = tableQ.trim().toLowerCase()
                          return !t || String(p.sku ?? '').toLowerCase().includes(t)
                            || String(p.name ?? '').toLowerCase().includes(t)
                        })
                        .map((p) => {
                        const amount = typeof p.amount === 'number' ? p.amount : null
                        const share = amount !== null && report.totals.sales
                          ? (amount / report.totals.sales) * 100 : null
                        return (
                          <tr key={p.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className={`${TD} text-blue-600 whitespace-nowrap`}>{p.sku}</td>
                            <td className={TD}>
                              <Link href={`/core/stock/${encodeURIComponent(p.sku)}`} className="text-blue-600 hover:underline">
                                {p.name}
                              </Link>
                              {/* ⑦ บรรทัดหมวดหมู่ใต้ชื่อ — ตำแหน่งเดียวกับ ZORT
                                     🔴 สามสถานะ: มีหมวด · ZORT ยังไม่จัดหมวด · ท่อรุ่นเก่าไม่ส่งช่องมา (เงียบ) */}
                              {typeof p.category === 'string' && (
                                <span className="block text-[11px] text-gray-400">
                                  หมวดหมู่: {p.category || '(ยังไม่ได้จัดหมวดใน ZORT)'}
                                </span>
                              )}
                            </td>
                            <td className={TDR}>{fmtNum(p.qty)}</td>
                            {/* ⚠️ ไม่มียอดเงินจริงให้แสดงขีด ห้ามคูณ qty × ราคาขาย ซึ่งเป็นการเดา */}
                            <td className={TDR}>{amount !== null ? fmtMoney(amount) : <span className="text-gray-300">—</span>}</td>
                            <td className={TDR}>
                              {share !== null
                                ? <span className="text-[11.5px] font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">{share.toFixed(2)}%</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </Card>
            </>
          )}

          {/* 🏬 **แท็บตามคลัง/สาขา — แบ่งตามคลังจริงแบบ ZORT**
                 ผัง ZORT ที่กดดูเอง 15 ก.ย. 2569 (`/Dashboard/SalesReport` → แท็บนี้):
                 คอลัมน์ คลัง/สาขา · จำนวนรายการ · จำนวนรายการขาย · จำนวนรายการรายรับคืน · ยอดขาย(บาท)
                 ⇒ ของเราทำได้ 3 คอลัมน์ (คลัง · จำนวนใบขาย · ยอดขาย) · ใบรับคืนรายคลัง **ท่อยังไม่มี** ⇒ ขีด ไม่เดา */}
          {tab === 'branch' && (
            <Card padded={false}>
              <p className="text-[15px] font-semibold text-gray-900 px-4 md:px-5 pt-4">ยอดขายตามคลัง/สาขา</p>
              {/* 🔴 **ข้อความขอบเขตมาจากท่อ (`warehouseScope`) ไม่ใช่จอเขียนวันที่เอง**
                     วันที่ "เริ่มเก็บคลัง" จะขยับเมื่อกวาดย้อนหลังเสร็จ ⇒ เขียนตายตัวในจอ = คำค้างรอบหน้า */}
              {whScope && (
                <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded mx-4 md:mx-5 mt-2 px-3 py-2 leading-relaxed">
                  ⚠️ {whScope}
                  <br />⇒ แถว &ldquo;ยังไม่รู้คลัง&rdquo; คือใบที่ยังไม่รู้ว่าอยู่คลังไหน —
                  {' '}<b>ไม่ได้แปลว่าไม่มีคลัง</b> และ<b>ไม่ได้ถูกยัดเข้าคลังไหน</b>
                </p>
              )}
              <TableWrap>
                <table className="w-full min-w-[620px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className={TH}>คลัง / สาขา</th>
                      <th className={THR}>จำนวนใบขาย</th>
                      <th className={THR}>ยอดขาย(บาท)</th>
                      <th className={THR}>ใบรับคืน</th>
                      <th className={TH} style={{ width: 160 }}>สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whLoading && !whSales && (
                      <tr><td colSpan={5} className="px-3 py-4 text-[12.5px] text-gray-400">กำลังถามยอดทีละคลัง…</td></tr>
                    )}
                    {whSalesErr && (
                      <tr><td colSpan={5} className="px-3 py-4 text-[12.5px] text-red-700">
                        ⚠️ ดึงยอดตามคลังไม่สำเร็จ: {whSalesErr} — <b>ไม่ได้แปลว่าไม่มียอด</b>
                      </td></tr>
                    )}
                    {whSales?.map((w) => {
                      const unknown = !w.code
                      const total = whSales.reduce((a, x) => a + x.sales, 0)
                      return (
                        <tr key={w.code || '(ไม่รู้คลัง)'}
                          className={`border-b border-gray-100 last:border-0 ${unknown ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
                          <td className={TD}>
                            {unknown
                              ? (<>
                                <b>ยังไม่รู้คลัง</b>
                                <span className="block text-[11px] text-gray-500">ใบที่ยังกวาดย้อนหลังไม่ถึง — ท่อส่งมาเป็นแถวของตัวเอง</span>
                              </>)
                              : <>{w.name} <span className="text-gray-400">({w.code})</span></>}
                          </td>
                          <td className={TDR}>{fmtNum(w.orders)}</td>
                          <td className={TDR}>{fmtMoney(w.sales)}</td>
                          {/* 🔴 สามสถานะของใบคืน: มีเลข · `null` = อ่านใบคืนไม่ได้ (ยังไม่รู้) · ไม่มีคีย์ = ท่อรุ่นเก่า
                                 **0 ใส่ได้เฉพาะตอนท่อบอกว่า 0 จริง** — เดาเองไม่ได้ เพราะ 0 แปลว่าไม่มีใครคืนของ */}
                          {w.returns === undefined ? (
                            <td className={`${TDR} text-gray-300`} title="ท่อรุ่นนี้ยังไม่ส่งใบคืนรายคลังมา">—</td>
                          ) : w.returns === null ? (
                            <td className={`${TDR} text-amber-700`} title="อ่านตารางใบคืนไม่สำเร็จรอบนี้">ยังไม่รู้</td>
                          ) : (
                            <td className={TDR}>
                              {fmtNum(w.returns)}
                              {typeof w.returnsAmount === 'number' && w.returns > 0 && (
                                <span className="block text-[11px] text-gray-400">{fmtMoney(w.returnsAmount)}</span>
                              )}
                            </td>
                          )}
                          <td className={TD}>
                            <span className="block h-2 rounded-full bg-gray-100 overflow-hidden">
                              <span className={`block h-full rounded-full ${unknown
                                ? 'bg-[repeating-linear-gradient(45deg,#d1d5db,#d1d5db_4px,#f3f4f6_4px,#f3f4f6_8px)]'
                                : 'bg-violet-400'}`}
                                style={{ width: `${Math.max(2, (w.sales / Math.max(1, total)) * 100)}%` }} />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableWrap>
              {/* 🏬 dropdown เลือกคลัง + ตารางสินค้า — ผังเดียวกับ ZORT (tableoption: ทั้งหมด/โกดัง/KLD/ANJ) */}
              <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 pt-4">
                <p className="text-[14px] font-semibold text-gray-900 mr-auto">ยอดขายรายสินค้าของคลังที่เลือก</p>
                <select
                  value={whPick}
                  onChange={(e) => setWhPick(e.target.value)}
                  className="text-[12.5px] border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
                >
                  <option value="">ทั้งหมด</option>
                  {/* รายชื่อคลังมาจากที่ท่อส่ง ไม่ใช่รายชื่อตายตัว · แถว "ยังไม่รู้คลัง" (code ว่าง) เลือกไม่ได้ */}
                  {whSales?.filter((w) => w.code).map((w) => (
                    <option key={w.code} value={w.code}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              {whItemsErr && (
                <p className="text-[12px] text-red-700 px-4 md:px-5 pt-2">⚠️ ดึงยอดรายสินค้าไม่สำเร็จ: {whItemsErr}</p>
              )}
              {whItems && whItems.length === 0 && !whItemsErr && (
                <p className="text-[12.5px] text-gray-500 px-4 md:px-5 pt-2">
                  ช่วงนี้ยังไม่มียอดขายรายสินค้า{whPick ? ' ของคลังที่เลือก' : ''}
                </p>
              )}
              {/* 🔴 ตารางนี้ขอมา `limit=20` เพื่อแสดงอันดับ ⇒ **ต้องเขียนว่าไม่ใช่ทั้งหมด**
                     ไม่งั้นคนอ่านนึกว่าคลังนี้ขายแค่ 20 รหัส (เหตุผลเดียวกับที่ห้ามเอารายการบนจอไปทำไฟล์) */}
              {whItems && whItems.length > 0 && (
                <p className="text-[11.5px] text-gray-400 px-4 md:px-5 pt-2">
                  แสดง <b>{fmtNum(whItems.length)} อันดับแรก</b> เรียงตามยอดขาย — <b>ไม่ใช่ทุกรหัสของคลังนี้</b>
                  {whPick ? '' : ' (ยังไม่ได้เลือกคลัง = รวมทุกคลังและใบที่ยังไม่รู้คลัง)'}
                </p>
              )}
              {whItems && whItems.length > 0 && (
                <TableWrap>
                  <table className="w-full min-w-[620px]">
                    <thead className="bg-white border-b border-gray-200">
                      <tr>
                        <th className={TH}>รหัสสินค้า</th>
                        <th className={TH}>สินค้า</th>
                        <th className={THR}>จำนวน</th>
                        <th className={THR}>ยอดขาย(บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whItems.map((it) => (
                        <tr key={it.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className={`${TD} text-blue-600 whitespace-nowrap`}>{it.sku}</td>
                          <td className={TD}>{it.name}</td>
                          <td className={TDR}>{fmtNum(it.qty)}</td>
                          <td className={TDR}>{fmtMoney(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
              {/* 🔴 สองยอดในแท็บนี้คิดจากคนละชั้น ⇒ ต้องเขียน ไม่ใช่วางคู่กันเฉย ๆ (กติกาข้อ 4 ใน CLAUDE.md) */}
              <p className="text-[11.5px] text-amber-800 px-4 md:px-5 pt-2 leading-relaxed">
                ⚠️ ยอดใน<b>ตารางสินค้า</b>คิดจาก<b>บรรทัดสินค้า</b> ส่วนยอดใน<b>ตารางคลัง</b>คิดจาก<b>หัวใบ</b>
                {' '}(หัวใบรวมส่วนลดท้ายบิลกับค่าส่ง) ⇒ <b>สองตัวไม่เท่ากันเป็นเรื่องปกติ</b> ไม่ใช่เลขผิด
                <br />⚠️ ใบที่ยังไม่รู้คลัง<b>ไม่เข้าคลังไหนเลย</b> ⇒ เลือกคลังแล้วยอดจะน้อยกว่ายอดรวมของช่วงนั้น
              </p>

              <p className="text-[11.5px] text-gray-400 px-4 md:px-5 py-3 leading-relaxed">
                ยอดรายคลังมาจาก<b>คำขอเดียว</b>ที่เซิร์ฟเวอร์รวมมาให้ (`orderfacets&warehouses=1`)
                {' '}— ผลรวมทุกแถวเท่ากับยอดของทั้งสองร้านในคำขอเดียวกัน ⇒ <b>ไม่มีใบไหนตกหล่นหรือถูกนับซ้ำ</b>
                <br />🧾 <b>ใบรับคืน</b> = ใบคืนของใบขายในช่วงนี้ จัดกองตาม<b>คลังของใบขาย</b> (ไม่นับใบคืนที่ถูกยกเลิก)
                {' '}· ใบคืนที่หาใบขายไม่เจอหรืออยู่นอกช่วง <b>ไม่ถูกนับในคอลัมน์นี้</b>
                <br />⚠️ ZORT ยังมีคอลัมน์ <b>จำนวนรายการ</b> (นับรวมทุกชนิดเอกสาร) ที่ของเรายังไม่มี
              </p>
            </Card>
          )}

          {tab !== 'all' && tab !== 'branch' && (
            <Card padded={false}>
              <p className="text-[15px] font-semibold text-gray-900 px-4 md:px-5 pt-4">
                {tab === 'mkt' ? 'ยอดขายตาม Marketplace' : 'ยอดขายตามช่องทางการขาย'}
              </p>
              {/* 🔴 **แท็บ Marketplace ของ ZORT เป็นคนละเรื่องกับของเรา** (กดดูเอง 15 ก.ย. 2569)
                     ZORT ทำเป็นการ **กระทบยอดเงินที่มาร์เก็ตเพลสโอนเข้า**: รอบบัญชี · หมายเลขธุรกรรม ·
                     ค่าส่งเก็บจากลูกค้า vs ค่าส่งออกโดย Marketplace vs ค่าจัดส่งตามจริง · ส่วนต่าง ·
                     คอมมิชชั่น · ค่าธรรมเนียมการชำระเงิน
                     ⇒ **ต้องเขียนไว้** ไม่งั้นคนเห็นชื่อแท็บเหมือนกันแล้วคิดว่าทำเหมือนแล้ว */}
              {tab === 'mkt' && (
                <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded mx-4 md:mx-5 mt-2 px-3 py-2 leading-relaxed">
                  ⚠️ แท็บนี้คือ <b>ยอดขายแยกตามช่องทางมาร์เก็ตเพลส</b> —
                  {' '}<b>ยังไม่ใช่การกระทบยอดเงินโอนแบบ ZORT</b>
                  <br />ของ ZORT แท็บนี้เทียบ <b>เงินที่มาร์เก็ตเพลสโอนเข้าจริง</b> กับค่าส่ง/คอมมิชชั่น/ค่าธรรมเนียม
                  {' '}เป็นรอบบัญชี ⇒ ข้อมูลนั้นอยู่ที่ฝั่ง Shopee/Lazada/TikTok <b>ไม่ใช่ใน ZORT</b> (กำลังไล่แหล่งข้อมูลอยู่)
                </p>
              )}
              <TableWrap>
                <table className="w-full min-w-[620px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className={TH}>ช่องทาง</th>
                      <th className={THR}>จำนวนใบ</th>
                      <th className={THR}>ยอดขาย(บาท)</th>
                      <th className={THR}>เทียบช่วงก่อน</th>
                      <th className={TH} style={{ width: 160 }}>สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <EmptyState cols={5} icon="🏪" title="ยังไม่มียอดขายในกลุ่มนี้"
                        detail={tab === 'mkt'
                          ? 'ออเดอร์จากมาร์เก็ตเพลสจะเข้ามาในรอบซิงก์ถัดไป'
                          : 'ยังไม่มีใบขายของช่องทางไหนในช่วงนี้'} />
                    )}
                    {shown.map((c) => (
                      <tr key={c.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className={TD}><ChannelTag name={c.name} /></td>
                        <td className={TDR}>{fmtNum(c.orders)}</td>
                        <td className={TDR}>{fmtMoney(c.sales)}</td>
                        <td className={TDR}><PctBadge cur={c.sales} prev={c.prevSales} /></td>
                        <td className={TD}>
                          <span className="block h-2 rounded-full bg-gray-100 overflow-hidden">
                            <span className={`block h-full rounded-full ${chanColor(c.name)}`}
                              style={{ width: `${Math.max(2, (c.sales / maxShown) * 100)}%` }} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
