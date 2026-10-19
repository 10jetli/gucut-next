'use client'
// รายงาน → ลูกค้า — **ใครซื้อเท่าไหร่** รวมยอดจากออเดอร์ในคลังเงา (D1)
//
// ✅ **ได้ภาพจอจริงแล้ว 6 ก.ย. 2569** (zort-ui/75·76 — เดิม 404 เพราะ URL ต้องมี ? ต่อท้าย)
//    ผัง: การ์ดคู่ จำนวนลูกค้า(วงกลม)|แนวโน้ม(เส้น) → ตารางจังหวัด → ตารางลูกค้า+ยอดขาย(%)
//    ลอกครบเท่าที่ข้อมูลมี · ที่ทำไม่ได้เขียนบนจอพร้อมเหตุผล (แนวโน้มรายเดือน · จังหวัด)
//    เดิมจออยู่ที่ /core/customers แล้วย้ายมาที่นี่ 3 ก.ย. 2569 เพราะ **ผู้ติดต่อ** ของ ZORT
//    คือ *ทะเบียนรายชื่อ* คนละเรื่องกับ *รายงานว่าใครซื้อเท่าไหร่* — เอาไปทับกันไม่ได้
//    ⇒ ทะเบียนผู้ติดต่อ (28,250 ราย เมื่อ 6 ก.ย. 2569 — เลขนับได้ ต้องมีวันที่กำกับ) อยู่ที่ /core/customers ตามเดิม
// ⚠️ รวมยอดในเบราว์เซอร์จาก /api/core?list=orders ทีละหน้า (ท่อหลังบ้านเป็นเขตอีกฝั่ง)
// ⚠️ จับลูกค้าด้วย "ชื่อ" ไม่ใช่เบอร์โทร — ชื่อซ้ำถูกนับรวมเป็นคนเดียว ต้องเขียนบอกบนจอ
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, ต้นเดือนย้อนหลังแบบZORT } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'
import ZortLookFold from '@/components/zort/ZortLookFold'
import ZortCardTitle from '@/components/zort/ZortCardTitle'
import ZortPie from '@/components/zort/ZortPie'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, TD, TDR, LinkText, summaryLine, EmptyState, thaiDate, PageNav, TH_KANIT, THR_KANIT,
} from '@/components/zort'

interface Row { id: string; channel: string; amount: number; customer: string; order_date: string }
/** ⚠️ channels เป็น **อาร์เรย์ของ object** ไม่ใช่ข้อความคั่นลูกน้ำ (ฝั่งท่อเลือกแบบนี้ และถูก)
 *  ชื่อช่องทางคนตั้งเอง วันไหนมีลูกน้ำในชื่อ จอจะแตกชื่อเดียวเป็นสองช่องทางเงียบ ๆ
 *  — คอลัมน์ขนส่งเคยมีของแบบนี้จริงมาแล้ว */
interface Person {
  name: string; orders: number; amount: number; last: string
  channels?: { channel: string; orders: number }[]
  /** วันซื้อครั้งแรก **ทั้งประวัติ** (ไม่ใช่แค่ในช่วง) — ฝั่งท่อเพิ่ม 6 ก.ย. ขึ้นรอบ 21:00
   *  ⚠️ ก่อน deploy ท่อ ช่องนี้ undefined ⇒ จอถอยไปใช้นิยามช่วงแบบเดิมเอง ห้ามพัง */
  firstDay?: string | null
  /** ท่อคิดให้เสร็จ: คนนี้เป็นลูกค้าใหม่ในช่วงที่เลือกไหม (firstDay อยู่ในช่วง) */
  newInRange?: boolean
  /** ชื่อผู้ใช้ฝั่งมาร์เก็ตเพลส (integrationCustomer) — ท่อเพิ่ม 16 ต.ค. 2569 · ไม่มี = ใบไม่ได้มาจากมาร์เก็ตเพลส/ท่อรุ่นเก่า */
  marketplaceNames?: string[]
}

/** แถวตารางจังหวัด — ท่อนับให้ (3841b6f7) · customers = ชื่อที่ไม่ว่างเท่านั้น · unnamedOrders นับเป็นใบ **ห้ามบวกเป็นคน** */
interface ProvinceRow { province: string; customers: number; orders: number; sales: number; unnamedOrders?: number }
/** ข้อมูลจังหวัดในกระจกย้อนได้ถึงวันนี้ (ท่อกวาดย้อนหลังถึง 1 ก.ค. 2569 · จดหมายท่อ 16 ต.ค.) — ใบก่อนนั้นจะตกไปอยู่แถว (ไม่ระบุ) */
const จังหวัดมีตั้งแต่ = '2026-07-01'
const PROV_PER_PAGE = 6

/** กราฟรายเดือนสามเส้น — ⚠️ **สองกองแรกนับเป็นคน กองไม่ระบุชื่อนับเป็นใบ ห้ามบวกรวมกัน**
 *  (ฝั่งท่อกำชับตอนออกแบบ 6 ก.ย. — หน่วยต่างกัน เส้นอยู่กราฟเดียวกันได้แต่ต้องมีป้ายหน่วย) */
interface MonthlyRow {
  month: string; newCustomers?: number; repeatCustomers?: number; unnamedOrders?: number
  /** ยอดขายรายกลุ่ม (บาท) — ท่อเพิ่ม 16 ต.ค. 2569 · newSales+repeatSales+unnamedSales+unknownSales = totalSales ของเดือนนั้น
   *  ท่อรุ่นเก่าไม่ส่ง ⇒ undefined ⇒ มุมมองยอดขายปิดไว้ ห้ามวาดเป็นศูนย์ */
  newSales?: number; repeatSales?: number; unnamedSales?: number; unknownSales?: number; unknownCustomers?: number; totalSales?: number
}
/** ท่อส่งยอดขายรายเดือนครบทุกแถวไหม — ขาดแถวเดียวก็ไม่วาด (เส้นที่ตกเป็นศูนย์กลางกราฟ = โกหก) */
const มียอดรายเดือน = (rows: MonthlyRow[]) =>
  rows.length > 0 && rows.every((r) => typeof r.newSales === 'number' && typeof r.repeatSales === 'number' && typeof r.unnamedSales === 'number')

/* 🔢 จำนวนต่อหน้า — ZORT ให้เลือก 10/20/50/100 ทุกจอรายการ
   จอนี้แบ่งหน้า **ในเบราว์เซอร์** (ดึงมาทั้งชุดแล้วตัดแสดง) ⇒ เปลี่ยนค่าไม่ต้องยิงท่อใหม่
   ⇒ ไม่มีปัญหา setState ตามไม่ทันแบบจอที่แบ่งหน้าฝั่งท่อ */
const PER_PAGE_เริ่มต้น = 50
const NO_NAME = 'ไม่ระบุชื่อ'

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/* ช่วงเวลา — เรียงตามผัง `dateperiod` ของ ZORT (กดอ่านจากจอจริง 16 ก.ย. 2569)
   🔴 **ZORT มี 10 ค่า เราใส่ได้ 4** เพราะท่อ `bycustomer` รับแต่ `days` (นับถอยจากวันนี้)
      ยิงตรวจแล้ว: ส่ง `from`/`to` ไป ท่อ **เมินเงียบ** แล้วตอบช่วงของ days=90 กลับมาเหมือนเดิม
      ⇒ ถ้าใส่ "เดือนที่แล้ว / เดือนนี้ / ปีนี้ / วันนี้ / กำหนดเอง" ตอนนี้ จอจะโชว์ช่วงหนึ่ง
        แต่เลขเป็นของอีกช่วง — โกหกแบบที่หาไม่เจอ ⇒ **ไม่ใส่จนกว่าท่อจะรับ from/to**
   ⚠️ และคำว่า "ย้อนหลัง 3 เดือน" ของสองระบบ **ไม่ใช่ช่วงเดียวกัน**
      ZORT = วันที่ 1 ของเดือนที่ถอยไป 3 เดือน ถึงวันนี้ (อ่านจากจอ: 1/6/2569 - 16/9/2569)
      ของเรา = 90 วันนับถอยหลังจากวันนี้ ⇒ จอต้องโชว์ช่วงจริงที่ท่อใช้เสมอ (ดูป้ายใต้ตัวเลือก) */
/* 🗓 16 ต.ค. 2569: ท่อรับ from/to แล้ว (ข้อ 13 ปิด) ⇒ 1/3 เดือนส่งช่วงแบบ ZORT (วันที่ 1 ของเดือนที่ถอยไป ถึงวันนี้)
   ด้วยตัวช่วยเดียวกับจอรายการขาย · 6 เดือน/1 ปียังไม่ได้วัดกับ ZORT ⇒ คงนับถอยเป็นวัน */
const RANGES: { days: number; label: string; เดือนแบบZORT?: number }[] = [
  { days: 30, label: 'ย้อนหลัง 1 เดือน', เดือนแบบZORT: 1 },
  { days: 90, label: 'ย้อนหลัง 3 เดือน', เดือนแบบZORT: 3 },
  { days: 180, label: 'ย้อนหลัง 6 เดือน' },
  { days: 365, label: 'ย้อนหลัง 1 ปี' },
]


/** รวมแถวรายเดือนเป็นไตรมาส/ปี — **รวมได้เฉพาะยอดเงิน** (บาทบวกกันข้ามเดือนได้)
 *  ⚠️ จำนวนคนรวมข้ามเดือนไม่ได้: คนเดียวซื้อสองเดือนจะถูกนับสองครั้ง ⇒ มุมมองจำนวนลูกค้าใช้ได้แค่รายเดือน
 *  ช่องเงินที่เดือนใดไม่ส่ง ⇒ ช่องรวมเป็น undefined (ไม่เดาเป็นศูนย์) */
function รวมยอดตามช่วง(rows: MonthlyRow[], by: 'quarter' | 'year'): MonthlyRow[] {
  const keys = ['newSales', 'repeatSales', 'unnamedSales', 'unknownSales', 'totalSales'] as const
  const out = new Map<string, MonthlyRow>()
  for (const r of rows) {
    const [yy, mm] = String(r.month).split('-').map(Number)
    const k = by === 'year' ? `${yy}` : `${yy}-Q${Math.ceil(mm / 3)}`
    const acc: MonthlyRow = out.get(k) ?? { month: k, newSales: 0, repeatSales: 0, unnamedSales: 0, unknownSales: 0, totalSales: 0 }
    for (const f of keys) {
      const v = r[f]
      acc[f] = typeof v === 'number' && typeof acc[f] === 'number' ? (acc[f] as number) + v : undefined
    }
    out.set(k, acc)
  }
  return Array.from(out.values())
}

/** ป้ายแกนนอนแบบ ZORT เช่น 2026-10 → ต.ค./2569 · 2026-Q3 → ไตรมาส 3/2569 · 2026 → 2569 — ใช้ร่วมสองมุมมองของกราฟแนวโน้ม */
function mLabel(m: string) {
  const [yy, mm] = String(m).split('-').map(Number)
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  if (/^\d{4}-Q[1-4]$/.test(m)) return `ไตรมาส ${m.slice(-1)}/${yy + 543}`
  if (/^\d{4}$/.test(m)) return String(yy + 543)
  return mm >= 1 && mm <= 12 ? `${M[mm - 1]}/${yy + 543}` : String(m)
}

/** กราฟแนวโน้มรายเดือนแบบ ZORT (ภาพ 75) — สามเส้น
 *  ⚠️ **สองเส้นแรกหน่วยเป็น "คน" เส้นไม่ระบุชื่อหน่วยเป็น "ใบ" — ห้ามบวกรวมกัน**
 *     (ฝั่งท่อกำชับตอนออกแบบ) ⇒ เส้นใบใช้**แกนขวาแยก** + ป้ายหน่วยกำกับทั้งสองแกน
 *     สามเส้นบนกราฟเดียวที่หน่วยไม่เท่ากันโดยไม่มีป้าย = ชวนให้คนอ่านบวกรวมโดยไม่รู้ตัว */
function TrendChart({ rows, by = 'people' }: { rows: MonthlyRow[]; by?: 'people' | 'sales' }) {
  const W = 460; const H = 180; const padL = 34; const padR = 38; const padY = 22
  const n = rows.length
  if (n === 0) return null
  if (by === 'sales') return <TrendSalesChart rows={rows} />
  const maxP = Math.max(...rows.map((r) => Math.max(Number(r.newCustomers) || 0, Number(r.repeatCustomers) || 0)), 1)
  const maxU = Math.max(...rows.map((r) => Number(r.unnamedOrders) || 0), 1)
  const x = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1))
  const yP = (v: number) => H - padY - (v / maxP) * (H - padY * 2)
  const yU = (v: number) => H - padY - (v / maxU) * (H - padY * 2)
  const line = (get: (r: MonthlyRow) => number, y: (v: number) => number) =>
    rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(r)).toFixed(1)}`).join(' ')
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] mb-1">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#8ea8f8' }} />ลูกค้าใหม่ (คน)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#f2938c' }} />ซื้อซ้ำ (คน)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1 bg-gray-400" />ไม่ระบุชื่อ (<b>ใบ</b> — แกนขวา)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="แนวโน้มลูกค้ารายเดือน">
        {[0.5, 1].map((f2) => (
          <line key={f2} x1={padL} x2={W - padR} y1={yP(maxP * f2)} y2={yP(maxP * f2)} stroke="#eef1f7" />
        ))}
        <path d={line((r) => Number(r.unnamedOrders) || 0, yU)} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={line((r) => Number(r.newCustomers) || 0, yP)} fill="none" stroke="#8ea8f8" strokeWidth="2" />
        <path d={line((r) => Number(r.repeatCustomers) || 0, yP)} fill="none" stroke="#f2938c" strokeWidth="2" />
        {rows.map((r, i) => (
          <text key={r.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[10px]">{mLabel(r.month)}</text>
        ))}
        <text x={2} y={yP(maxP) + 4} className="fill-gray-400 text-[10px]">{maxP} คน</text>
        <text x={W - 2} y={yU(maxU) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">{maxU} ใบ</text>
      </svg>
      <p className="text-center text-[11px] text-gray-400 -mt-1">ช่วงเวลา</p>
    </div>
  )
}

/** มุมมอง "ยอดขาย" ของกราฟแนวโน้ม — ผังเดียวกับ dropdown `salestypeoption` ของ ZORT
 *  ทุกเส้นหน่วยเป็นบาทเหมือนกัน ⇒ แกนเดียวได้ (ต่างจากมุมมองจำนวนที่คนกับใบปนกัน)
 *  เส้น "ไม่รู้วันซื้อครั้งแรก" โผล่เฉพาะเดือนที่ท่อส่งเกินศูนย์ — ท่อกำชับว่าถ้ามีแปลว่า JOIN เพี้ยน **อย่าซ่อน** */
function TrendSalesChart({ rows }: { rows: MonthlyRow[] }) {
  const W = 460; const H = 180; const padL = 44; const padR = 14; const padY = 22
  const n = rows.length
  const มีไม่รู้ = rows.some((r) => typeof r.unknownSales === 'number' && r.unknownSales > 0)
  const เส้น: { key: keyof MonthlyRow; label: string; color: string; dash?: string }[] = [
    { key: 'newSales', label: 'ลูกค้าใหม่', color: '#8ea8f8' },
    { key: 'repeatSales', label: 'ซื้อซ้ำ', color: '#f2938c' },
    { key: 'unnamedSales', label: 'ไม่ระบุชื่อ', color: '#9ca3af', dash: '4 3' },
    ...(มีไม่รู้ ? [{ key: 'unknownSales' as const, label: 'ไม่รู้วันซื้อครั้งแรก', color: '#d97706', dash: '2 2' }] : []),
  ]
  /* ไม่รู้ยอด = null (ไม่แปลงเป็น 0) ⇒ ตัดเส้นตรงเดือนนั้น ไม่ลากลงแกน */
  const val = (r: MonthlyRow, k: keyof MonthlyRow): number | null => (typeof r[k] === 'number' ? (r[k] as number) : null)
  const max = Math.max(...rows.flatMap((r) => เส้น.map((l) => val(r, l.key) ?? -Infinity)), 1)
  const x = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1))
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2)
  const ย่อ = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} ล.` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)))
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] mb-1">
        {เส้น.map((l) => (
          <span key={l.key}><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: l.color }} />{l.label} (บาท)</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="แนวโน้มยอดขายรายเดือนแยกกลุ่มลูกค้า">
        {[0.5, 1].map((f2) => (
          <line key={f2} x1={padL} x2={W - padR} y1={y(max * f2)} y2={y(max * f2)} stroke="#eef1f7" />
        ))}
        {เส้น.map((l) => (
          <path key={l.key} d={rows.map((r, i) => { const v = val(r, l.key); if (v === null) return ''; const ก่อนว่าง = i === 0 || val(rows[i - 1], l.key) === null; return `${ก่อนว่าง ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}` }).join(' ')}
            fill="none" stroke={l.color} strokeWidth={l.dash ? 1.5 : 2} strokeDasharray={l.dash} />
        ))}
        {rows.map((r, i) => (
          <text key={r.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[10px]">{mLabel(r.month)}</text>
        ))}
        <text x={2} y={y(max) + 4} className="fill-gray-400 text-[10px]">{ย่อ(max)} ฿</text>
      </svg>
      <p className="text-center text-[11px] text-gray-400 -mt-1">ช่วงเวลา</p>
      {/* ตารางตัวเลขใต้กราฟ — เส้นบอกทิศ ตัวเลขบอกขนาด · คอลัมน์รวมมาจาก totalSales ของท่อ ไม่ได้บวกเอง */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-[11.5px] tabular-nums">
          <thead><tr className="text-gray-500">
            <th className="text-left font-normal py-0.5">ช่วงเวลา</th>
            {เส้น.map((l) => <th key={l.key} className="text-right font-normal py-0.5 px-1">{l.label}</th>)}
            <th className="text-right font-normal py-0.5">รวม</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-t border-gray-100">
                <td className="py-0.5">{mLabel(r.month)}</td>
                {เส้น.map((l) => <td key={l.key} className="text-right py-0.5 px-1">{fmtMoney(r[l.key] as number | undefined)}</td>)}
                <td className="text-right py-0.5">{fmtMoney(r.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">ตัดใบยกเลิกออกแล้ว แต่ยังรวมใบที่ยังไม่จ่าย</p>
    </div>
  )
}

export default function CoreCustomersPage() {
  const [days, setDays] = useState(90)
  const [q, setQ] = useState('')
  /* แท็บตั้งต้น = ลูกค้าใหม่ แบบ ZORT (`tableoption` ของ /Dashboard/ContactReport ตั้งต้นที่ "ลูกค้าใหม่" · ZORT ไม่มีแท็บ "ทั้งหมด"
     — ของเราเก็บไว้เป็นตัวเลือกเพิ่ม · อ่านจอจริง 16 ต.ค. 2569) */
  const [tab, setTab] = useState<'all' | 'a' | 'b' | 'mk'>('a')
  const [page, setPage] = useState(0)
  const [PER_PAGE, setPerPage] = useState(PER_PAGE_เริ่มต้น)

  const [people, setPeople] = useState<Person[]>([])
  const [scanned, setScanned] = useState(0)
  /** ท่อบอกเองว่านับรวมกี่ร้าน — ห้ามจอเดา */
  const [scope, setScope] = useState('')
  const [truncated, setTruncated] = useState(false)
  /** ยอดรวมรายกลุ่มของ **ทั้งช่วง** (ไม่ถูกตัดที่ limit) — ท่อเพิ่ม 16 ต.ค. 2569 · null = ท่อไม่ส่ง/ข้ามรอบนี้ ⇒ ไม่โชว์ % ในกลุ่ม */
  type กลุ่ม = { customers: number | null; orders: number; sales: number }
  const [groupTotals, setGroupTotals] = useState<{ new: กลุ่ม; repeat: กลุ่ม; unknownFirstDay: กลุ่ม; unnamed: กลุ่ม } | null>(null)
  /** จำนวน "ชื่อลูกค้าที่แตกต่างกัน" ทั้งช่วง — ท่อส่งมาให้แล้ว (distinctNames)
   *  ⚠️ หน่วยคือ **ชื่อ** และนับเฉพาะใบที่มีชื่อ · กอง unnamed (ส่วนใหญ่คือ POS) แยกต่างหาก
   *     ⇒ ห้ามเอาสองกองมาบวกกัน และถ้าจะเขียนคำว่า "ลูกค้าทั้งหมด" ต้องบอกว่านับเฉพาะที่มีชื่อ
   *  null = ท่อรุ่นเก่าไม่ส่งมา ⇒ ไม่เขียนเลขนั้นเลย ห้ามเดาจากจำนวนที่โหลดมา */
  const [distinctNames, setDistinctNames] = useState<number | null>(null)
  /** ตารางจังหวัด — null + provSkip = ท่อบอกว่ายังไม่มีข้อมูล (ห้ามโชว์ตารางว่าง) */
  const [provinces, setProvinces] = useState<ProvinceRow[] | null>(null)
  const [provSkip, setProvSkip] = useState('')
  const [provSource, setProvSource] = useState<Record<string, number> | null>(null)
  /** ตัวเลือกแบบ ZORT `contactperprovincetype`: จำนวนลูกค้า · จำนวนรายการ · มูลค่ารายการ */
  const [provBy, setProvBy] = useState<'customers' | 'orders' | 'sales'>('customers')
  const [provPage, setProvPage] = useState(0)
  /** วันแรกสุดที่กระจกมีข้อมูล — '' = ท่อยังไม่ส่ง (ก่อน deploy รอบ 21:00) */
  const [historyFrom, setHistoryFrom] = useState('')
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  /** ช่วงจริงที่ท่อใช้ (ท่อ echo กลับมา) — **ห้ามคำนวณเองในจอ** เพราะเราไม่ได้เป็นคนตัดวัน
   *  ⚠️ เอาไว้ให้คนเทียบกับ ZORT ได้ว่าคำว่า "3 เดือน" ของสองฝั่งไม่ใช่ช่วงเดียวกัน */
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  /** ท่อบอกว่าช่วงมาจาก from/to ที่เราส่ง (เทียบ ZORT ได้) หรือ days — null = ท่อรุ่นเก่าไม่บอก */
  const [ช่วงมาจาก, setช่วงมาจาก] = useState<string | null>(null)
  /** ยอดทั้งช่วงที่ท่อนับให้ (ไม่ได้ถูกตัดที่ 500 ราย) — ใช้เป็นตัวหารและตัวปิดช่องว่าง
   *  null = ท่อไม่ได้ส่งมา ⇒ **ห้ามเดาจากแถวที่โหลดมา** */
  const [totalSales, setTotalSales] = useState<number | null>(null)
  /** จำนวนใบทั้งช่วงที่ท่อนับให้ (ไม่ถูกตัดที่ 500 ราย) — null = ท่อไม่ส่ง ⇒ ถอยไปบวกจากแถวพร้อมบอกว่าเป็นของรายที่แสดง */
  const [totalOrders, setTotalOrders] = useState<number | null>(null)
  /** มุมมองการ์ดจำนวนลูกค้า — ผังเดียวกับ dropdown `typeoption` ของ ZORT (จำนวนลูกค้า/ยอดขาย) */
  // ตั้งต้น = ยอดขาย ตามที่จอ ZORT ขึ้น (#typeoption selected = ยอดขาย · อ่านจอ 16 ต.ค. 2569)
  // ⚠️ ZORT จำตัวกรองที่ใช้ครั้งก่อนได้ (จอยอดขายของเขาค้างช่วง ส.ค. ที่มีคนตั้งไว้) ⇒ ค่านี้อาจเป็นค่าที่ ZORT จำไว้ ไม่ใช่ค่าตั้งต้นจริง
  //    ยืนยันได้ด้วยบัญชี ZORT ที่ไม่เคยเปิดจอนี้ — ยังไม่ได้ทำ
  const [cardBy, setCardBy] = useState<'people' | 'sales'>('sales')
  const หัววงกลม = cardBy === 'sales' ? 'ยอดขาย' : 'จำนวนลูกค้า'
  /** มุมมองกราฟแนวโน้ม — ZORT `salestypeoption` (จำนวนลูกค้า | ยอดขาย) · แยกจากการ์ดวงกลม เพราะ ZORT ก็แยกสองตัว */
  const [trendBy, setTrendBy] = useState<'people' | 'sales'>('people')
  /** คนเลือกเองแล้วหรือยัง — ใช้กันไม่ให้การสลับค่าตั้งต้นข้างล่างทับสิ่งที่คนเลือก */
  const เลือกแนวโน้มเอง = useRef(false)
  /* โหมดเหมือน ZORT: ZORT เปิดกราฟแนวโน้มที่ ยอดขาย — สลับให้ **เฉพาะเมื่อท่อส่งยอดรายเดือนมาจริง**
     (ตั้งค่าตั้งต้นเป็น sales ตรง ๆ ไม่ได้: ท่อรุ่นที่ไม่ส่งยอด ตัวเลือกจะขึ้น ยอดขาย แต่กราฟวาดจำนวนคน = ป้ายผิดของ)
     และไม่ทับสิ่งที่คนเลือกเองแล้ว */
  useEffect(() => {
    if (เหมือนZORT && !เลือกแนวโน้มเอง.current && มียอดรายเดือน(monthly)) setTrendBy('sales')
  }, [monthly])
  /** ความละเอียดแกนเวลา — ปุ่ม วัน/เดือน/ไตรมาส/ปี ใต้กราฟของ ZORT (อ่านจอจริง 16 ต.ค. 2569) */
  const [trendGran, setTrendGran] = useState<'month' | 'quarter' | 'year'>('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (range = days) => {
    setLoading(true)
    setError('')
    setTruncated(false)
    try {
      /* 🔴 **เดิมดึงออเดอร์ทั้งช่วงมาจัดกลุ่มเองในเบราว์เซอร์** (แก้ 5 ก.ย. 2569)
         สูงสุด 12 หน้า × 200 = 2,400 ใบ · เกินกว่านั้น **อันดับลูกค้าจะผิดเงียบ ๆ**
         เพราะคนที่ซื้อในใบที่ไม่ได้ดึงมาจะหายไปจากตารางทั้งคน
         ⇒ ให้ฐาน GROUP BY ชื่อลูกค้าให้ ยิงครั้งเดียวได้ทั้งช่วง

         ⚠️ **ใบที่ไม่มีชื่อลูกค้า ท่อแยกมาให้ต่างหาก ไม่ปนในตารางอันดับ**
            ของจริง 90 วัน = 819 ใบ · 325,980 บาท (เกือบทั้งหมดเป็น POS หน้าร้าน)
            ถ้าปล่อยให้รวมเป็นแถวเดียว มันจะขึ้นเป็น "ลูกค้าอันดับ 1 ซื้อ 819 ใบ"
            ซึ่งไม่ใช่คน แต่เป็นกองของคนที่ไม่ได้ระบุชื่อ */
      const ต้นเดือน = ต้นเดือนย้อนหลังแบบZORT(RANGES.find((r) => r.days === range)?.เดือนแบบZORT)
      const ช่วงqs = ต้นเดือน ? `from=${ต้นเดือน}&to=${thaiDay(0)}` : `days=${range}`
      const res = await fetch(`/api/web/core?bycustomer=1&${ช่วงqs}&limit=500`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      if (d?.skip) throw new Error(SKIP + d.skip)
      /* 🔴 ตอบ 200 แต่ไม่มีช่อง customers = ยังไม่รู้ ไม่ใช่ "ช่วงนี้ไม่มีลูกค้า"
         หัวจอเป็นตัวเลขเงินด้วย ⇒ ต้องไม่เขียนเลขเลยเมื่อไม่รู้ */
      if (!('customers' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายชื่อลูกค้า) — ยังสรุปยอดไม่ได้')
      // ตัดที่ limit เมื่อไหร่ต้องบอก — ท่อส่งธงมาเอง จอไม่ต้องเดา
      setTruncated(d?.truncated === true)
      /* อ่านแบบทนรูป: ต้องมี new/repeat ที่ sales เป็นตัวเลข ไม่งั้นถือว่าไม่มี (ห้ามเดาเป็น 0) */
      const gt = d?.groupTotals
      setGroupTotals(gt && typeof gt?.new?.sales === 'number' && typeof gt?.repeat?.sales === 'number' ? gt : null)
      setDistinctNames(typeof d?.distinctNames === 'number' ? d.distinctNames : null)
      setProvinces(Array.isArray(d.provinces) ? d.provinces : null)
      setProvSkip(typeof d.provinceSkipped === 'string' ? d.provinceSkipped : (Array.isArray(d.provinces) ? '' : 'ท่อรุ่นนี้ยังไม่ส่งตารางจังหวัด'))
      setProvSource(d.provinceSource && typeof d.provinceSource === 'object' ? d.provinceSource : null)
      setProvPage(0)
      setScope(typeof d.store === 'string' ? d.store : '')

      const list: Person[] = (Array.isArray(d.customers) ? d.customers : []).map(
        (c: { name: string; orders: number; sales: number; lastDay: string; channels?: { channel: string; orders: number }[]
              firstDay?: string | null; newInRange?: boolean; marketplaceNames?: unknown }) => ({
          name: c.name, orders: Number(c.orders) || 0,
          amount: Number(c.sales) || 0, last: c.lastDay || '',
          channels: Array.isArray(c.channels) ? c.channels : [],
          firstDay: typeof c.firstDay === 'string' ? c.firstDay : null,
          // รับได้ทั้งไม่มีฟิลด์ (ท่อยังไม่ deploy) และมีเป็น boolean — ชนิดอื่นถือว่าไม่รู้
          newInRange: typeof c.newInRange === 'boolean' ? c.newInRange : undefined,
          marketplaceNames: Array.isArray(c.marketplaceNames) ? c.marketplaceNames.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : undefined,
        }),
      )
      // ขอบประวัติของกระจก — ตัวกันนิยาม "ใหม่" เพี้ยนตรงขอบ (กระจกเริ่ม ~มิ.ย. 2569)
      setHistoryFrom(typeof d.historyFrom === 'string' ? d.historyFrom : '')
      setRange({ from: typeof d.from === 'string' ? d.from : '', to: typeof d.to === 'string' ? d.to : '' })
      setช่วงมาจาก(typeof d['ช่วงมาจาก'] === 'string' ? d['ช่วงมาจาก'] : null)
      setTotalSales(typeof d.totalSales === 'number' ? d.totalSales : null)
      setTotalOrders(typeof d.totalOrders === 'number' ? d.totalOrders : null)
      setMonthly(Array.isArray(d.monthly) ? d.monthly : [])
      const un = d?.unnamed
      if (un && Number(un.orders) > 0) {
        list.push({
          name: NO_NAME, orders: Number(un.orders) || 0,
          amount: Number(un.sales) || 0, last: un.lastDay || '',
        })
      }
      setPeople(list)
      setScanned(list.reduce((n, x) => n + x.orders, 0))
      setDays(range)
      setPage(0)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setPeople([])
      setScanned(0)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load(90) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const named = people.filter((p) => p.name !== NO_NAME)
  /** แท็บ Marketplace Username — เฉพาะรายที่ท่อส่งชื่อผู้ใช้มาร์เก็ตเพลสมา (จากรายที่โหลดมาเท่านั้น) */
  const mkC = useMemo(() => people.filter((p) => (p.marketplaceNames ?? []).length > 0), [people])
  const repeat = named.filter((p) => p.orders >= 2)
  const once = named.filter((p) => p.orders === 1)

  /* ✅ นิยามแบบ ZORT ("ใหม่" = ซื้อครั้งแรกทั้งประวัติอยู่ในช่วง) ใช้ได้เมื่อท่อส่ง newInRange มา
     ⚠️ ตัดสินว่า "ท่อพร้อม" จาก **การมีฟิลด์จริงในข้อมูล** ไม่ใช่จากวันที่ deploy
     ⚠️ newInRange เป็นสามสถานะ true/false/null — **null คือไม่รู้ ห้ามตีเป็น false**
        คนกลุ่มนี้ต้องนับแยกและโชว์ ไม่ใช่หายไปเงียบ ๆ */
  const hasZortDef = named.some((p) => typeof p.newInRange === 'boolean')
  const newC = hasZortDef ? named.filter((p) => p.newInRange === true) : once
  const repC = hasZortDef ? named.filter((p) => p.newInRange === false) : repeat
  const unkC = hasZortDef ? named.filter((p) => typeof p.newInRange !== 'boolean') : []
  /* คำที่ใช้บนจอ — ลอกจาก ZORT เมื่อเรามีนิยามเดียวกันเท่านั้น
     ถ้ายังไม่มี newInRange ต้องใช้คำของเราเอง ห้ามแปะคำ ZORT ทับนิยามที่ไม่ตรง */
  const LAB_A = hasZortDef ? 'ลูกค้าใหม่' : 'ซื้อครั้งเดียวในช่วง'
  const LAB_B = hasZortDef ? 'ลูกค้าซื้อซ้ำ' : 'ซื้อซ้ำในช่วง'

  const filtered = useMemo(() => {
    const base = tab === 'b' ? repC : tab === 'a' ? newC : tab === 'mk' ? mkC : people
    const needle = q.trim().toLowerCase()
    const list = needle ? base.filter((p) => p.name.toLowerCase().includes(needle)
      || (p.marketplaceNames ?? []).some((m) => m.toLowerCase().includes(needle))) : base
    return [...list].sort((a, b) => b.amount - a.amount)
  }, [people, newC, repC, mkC, tab, q])

  const totalAmount = people.reduce((s, p) => s + p.amount, 0)
  /* 🔴 **ตัวหารของ % ต้องเป็นยอดทั้งช่วง ไม่ใช่ยอดของรายที่โหลดมา** (แก้ 17 ก.ย. 2569 · A1 ในใบสำรวจ t_mu5bhh84)
     ช่วง 365 วัน ท่อส่งมา 500 จาก 4,281 ราย ⇒ ของเดิมหารด้วย 6.81 ล้าน (500 ราย + ไม่มีชื่อ) แทน 9.15 ล้าน
     ⇒ % ทุกแถวสูงเกินจริงราว 34% · ท่อส่ง totalSales มาให้ตั้งแต่แรก แต่ตารางไม่ได้ใช้
     ท่อไม่ส่ง (รุ่นเก่า) ⇒ ถอยไปใช้ยอดของรายที่แสดง และหัวคอลัมน์บอกขอบเขต */
  /* 📐 ZORT คิด "ยอดขาย (%)" **ในกลุ่มของแท็บ** (อ่านจอ 16 ต.ค. 2569: แท็บลูกค้าใหม่ 54,000 = 7.34% ของยอดลูกค้าใหม่ 736,135.40)
     ⇒ แท็บลูกค้าใหม่/ซื้อซ้ำ หารด้วยยอดของกลุ่มนั้น — **เฉพาะตอนรายชื่อครบ** (ท่อไม่ได้ตัด) ไม่งั้นยอดกลุ่มขาด % จะพองเงียบ ๆ
       รายชื่อถูกตัด ⇒ ถอยไปหารด้วยยอดทั้งช่วงเหมือนเดิม และหัวคอลัมน์บอกว่าหารด้วยอะไร */
  /* 🔑 ยอดกลุ่มมาจาก `groupTotals` ของท่อ (ทั้งช่วง ไม่ถูกตัด) ก่อนเสมอ · ไม่มี ⇒ ใช้ผลรวมรายที่โหลดมา **เฉพาะตอนไม่ถูกตัด** */
  const ยอดกลุ่ม = tab === 'a'
    ? (groupTotals ? groupTotals.new.sales : (!truncated ? newC.reduce((x, p) => x + p.amount, 0) : null))
    : tab === 'b'
      ? (groupTotals ? groupTotals.repeat.sales : (!truncated ? repC.reduce((x, p) => x + p.amount, 0) : null))
      : null
  const ร้อยละในกลุ่ม = ยอดกลุ่ม !== null && ยอดกลุ่ม > 0
  const ตัวหารร้อยละ = ร้อยละในกลุ่ม ? (ยอดกลุ่ม as number) : totalSales !== null && totalSales > 0 ? totalSales : totalAmount
  const ร้อยละของทั้งช่วง = !ร้อยละในกลุ่ม && totalSales !== null && totalSales > 0
  const shown = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))

  /** กล่องพับ "ช่วงที่ใช้จริง" และ "ตารางแสดง 500" — ตัวเดียว วางได้สองที่ตามโหมด (ไม่เขียนซ้ำ) */
  const กล่องช่วง = (
        <ZortLookFold tone="gray" สรุป={<>ช่วงที่ใช้จริง {thaiDate(range.from)} – {thaiDate(range.to)}</>}>
        <p className="text-[11.5px] text-gray-500 -mt-1 mb-3">
          ช่วงที่ใช้จริง <b>{thaiDate(range.from)} – {thaiDate(range.to)}</b>
          <span className="text-gray-400">
            {/* ⚠️ 18 ก.ย. 2569 พยายามพิสูจน์ข้อความ "ZORT นับจากวันที่ 1 ของเดือน" แล้ว **ยังวัดไม่ได้**
                ดรอปดาวน์ `#dateperiod` ของเขาซ่อนอยู่หลังวิดเจ็ต · ฟังก์ชัน `changedateperiod()` แค่ซ่อน/โชว์ช่องวันเอง
                (การคิดช่วงจริงอยู่ฝั่งเซิร์ฟเวอร์) และจอเขาไม่แสดงช่วงวันที่ถูก resolve ออกมา
                ⇒ คงข้อความ "เทียบตรง ๆ ไม่ได้" ไว้ (ยังจริงแน่นอน) แต่ **ไม่ยืนยันกติกาวันที่ 1** จนกว่าจะวัดได้ */}
            {/* 16 ต.ค. 2569: จอ ZORT แสดงช่วงจริงแล้ว ("ย้อนหลัง 3 เดือน (1/7/2569 - 16/10/2569)") และท่อรับ from/to แล้ว
                ⇒ 1/3 เดือนส่งช่วงเดียวกับ ZORT · ข้อความตัดสินจาก `ช่วงมาจาก` ที่ท่อตอบ ไม่ใช่จากที่จอขอ */}
            {ช่วงมาจาก && ช่วงมาจาก.startsWith('from/to')
              ? <>{' '}· <b>ช่วงวันเดียวกับ ZORT</b> (วันที่ 1 ของเดือนที่ถอยไป ถึงวันนี้)
                  {' '}— <span className="text-amber-700">แต่การแบ่ง ลูกค้าใหม่/ซื้อซ้ำ/ไม่ระบุ ยังไม่ตรงกับ ZORT (เทียบ 16 ต.ค. 2569 ยอดกลุ่มต่างกัน กำลังไล่เหตุ)</span></>
              : <>{' '}· ช่วงนี้<b>นับถอยเป็นวัน</b> ซึ่ง ZORT ไม่ได้นับแบบนี้ ⇒ <b>เทียบยอดตรง ๆ ไม่ได้</b></>}
            {' '}· ZORT ยังมี วันนี้ · เมื่อวานนี้ · เดือนนี้ · เดือนที่แล้ว · ปีนี้ · กำหนดเอง ซึ่งจอนี้<b>ยังไม่ได้ทำ</b> (ท่อรับ from/to แล้ว — ทำได้ ไม่ใช่ทำไม่ได้)
          </span>
        </p>
        </ZortLookFold>
  )
  const กล่องตัด500 = (
            <ZortLookFold สรุป={<>⚠️ ตารางแสดง 500 รายที่ยอดสูงสุด ไม่ใช่ทั้งหมด</>}>
            <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
              ⚠️ ช่วงนี้มีลูกค้ามากกว่า 500 ราย — ตารางแสดง <b>500 รายที่ยอดสูงสุด</b> เท่านั้น
              <b> ไม่ใช่ทั้งหมด</b> · ยอดของแต่ละรายที่แสดงถูกต้องครบถ้วน แต่รายที่ยอดน้อยกว่านั้นไม่ได้อยู่ในตาราง
            </div>
            </ZortLookFold>
  )

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ลูกค้า"
        summary={
          /* 🔴 ดึงไม่ได้ **ห้ามเขียนเลขใด ๆ** — เดิมขึ้น "จำนวน 0 ราย · 0 บาท · รวมจากออเดอร์ 0 ใบ"
             อยู่เหนือกล่องแดง ⇒ อ่านได้ว่า "ช่วงนี้ไม่มีลูกค้าเลย" ซึ่งเป็นคนละเรื่องกับ "ดึงไม่ได้"
             และเป็นตัวเลขเงินด้วย (เจอด้วยท่อปลอม 6 ก.ย. 2569) */
          error ? (isSkip(error)
            ? <span className="text-amber-800">ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง</span>
            : <span className="text-red-600">ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง</span>) : (
          <>
            {/* 🔴 **ยอดรวมนี้บวกจากแถวที่แสดงเท่านั้น** — ตอนถูกตัดที่ 500 ราย มันคือยอดของ 500 รายแรก
                ไม่ใช่ยอดทั้งช่วง ⇒ ต้องเขียนกำกับ ไม่ใช่ปล่อยให้อ่านเป็นยอดรวมจริง
                (คลาสเดียวกับที่จับได้ทั้งวัน — ตัวเลขถูกในขอบเขตของตัวเอง แต่ป้ายไม่บอกขอบเขต) */}
            {truncated
              ? (
                <>
                  แสดง {people.length.toLocaleString('th-TH')} ราย
                  {distinctNames !== null && <> จากลูกค้าที่มีชื่อทั้งช่วง <b>{distinctNames.toLocaleString('th-TH')}</b> ราย</>}
                  {' · '}ยอดรวมของรายที่แสดง {fmtMoney(totalAmount)} บาท
                </>
              )
              : summaryLine(people.length, totalAmount)}
            {/* 🎯 โหมดเหมือน ZORT: ที่มาของยอดย้ายเป็น ⓘ — "แสดง N จาก M" ข้างหน้ายังอยู่ (กฎข้อ 4) */}
            {เหมือนZORT && <span className="text-gray-400 cursor-help" title={`รวมจากออเดอร์ ${(totalOrders ?? scanned).toLocaleString('th-TH')} ใบในคลังของเราเอง${totalOrders === null && truncated ? ' (นับเฉพาะรายที่แสดง)' : ''}${scope ? ` · ${scope}` : ''}`}> ⓘ</span>}
            {!เหมือนZORT && <>{' | '}
            <span className="text-gray-400">
              {/* 🔴 เดิมบวกจากแถวที่โหลดมา ⇒ ช่วง 365 วันขึ้น 6,229 ใบ ทั้งที่ท่อนับได้ 11,484 */}
              รวมจากออเดอร์ {(totalOrders ?? scanned).toLocaleString('th-TH')} ใบในคลังของเราเอง
              {totalOrders === null && truncated ? ' (นับเฉพาะรายที่แสดง)' : ''}{scope ? ` · ${scope}` : ''}
            </span></>}
          </>
        )}
        /* 🔁 ปุ่ม "ดึงใหม่" เอาออก 16 ต.ค. 2569 — ZORT /Dashboard/ContactReport ไม่มี (อ่านปุ่มทั้งหน้า: วัน เดือน ไตรมาส ปี) */
      />

      {/* 📐 โหมดเหมือน ZORT (ภาพ /Dashboard/ContactReport 19 ต.ค. 2569): ใต้หัวจอเป็นบรรทัดช่วงวันตัวใหญ่ ไม่มีช่องค้นหา
           ⇒ ช่วงวันจริง (จากที่ท่อ echo) + ตัวเลือกช่วงอยู่บรรทัดนี้ · กล่องพับรายละเอียดช่วงต่อท้ายแบบ inline
           · ช่องค้นชื่อลูกค้า (กรองแค่ตารางลูกค้าข้างล่าง) ย้ายไปอยู่เหนือตารางนั้น */}
      {เหมือนZORT && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-0 mb-6">
          <p className="font-['Kanit',sans-serif] text-[20px] leading-[30px] font-normal text-[#3e3e3e]">
            {RANGES.find((r) => r.days === days)?.label ?? `ย้อนหลัง ${days} วัน`}
            {(range.from || range.to) && <> ({thaiDate(range.from)} – {thaiDate(range.to)})</>}
          </p>
          <select
            value={days}
            onChange={(e) => load(Number(e.target.value))}
            className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-white"
          >
            {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
          </select>
          {(range.from || range.to) && <span className="inline-block">{กล่องช่วง}</span>}
        </div>
      )}
      {!เหมือนZORT && <SearchRow
        value={q}
        onChange={(v) => { setQ(v); setPage(0) }}
        onSubmit={() => setPage(0)}
        placeholder="ค้นชื่อลูกค้า"
        advanced={<LinkText onClick={() => setPage(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[12.5px] text-gray-500">แสดง</span>
            <select
              value={days}
              onChange={(e) => load(Number(e.target.value))}
              className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </>
        }
      />}

      {/* 🔴 **ช่วงจริงต้องขึ้นจอเสมอ** — คำว่า "ย้อนหลัง 3 เดือน" ของเรากับของ ZORT คนละช่วง
             (ZORT = ตั้งแต่วันที่ 1 ของเดือนที่ถอยไป 3 เดือน · ของเรา = นับถอย 90 วัน)
             ถ้าไม่เขียนไว้ คนจะเอาสองจอมาเทียบแล้วสรุปว่า "ตัวเลขผิด" ทั้งที่ช่วงไม่เท่ากัน
             วันที่ที่โชว์คือวันที่ **ท่อ echo กลับมา** ไม่ใช่วันที่จอคำนวณเอง */}
      {!เหมือนZORT && (range.from || range.to) && กล่องช่วง}

      {error && <ErrorBox title="ดึงข้อมูลลูกค้าไม่ได้">{error}</ErrorBox>}
      {loading && people.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {/* โหมดเหมือน ZORT: คำเตือนนี้พูดถึงตารางลูกค้า ⇒ ย้ายไปอยู่เหนือตารางนั้น (ไม่ดันการ์ดคู่ลง) */}
          {!เหมือนZORT && truncated && กล่องตัด500}

          {/* ── ผัง ZORT (ภาพ 75): การ์ดคู่ "จำนวนลูกค้า" (วงกลม) | "แนวโน้ม" (กราฟเส้น) ──
              ได้ภาพจอจริงครั้งแรก 6 ก.ย. 2569 (เดิม 404 เพราะ URL ต้องมี ? ต่อท้าย — ฝั่งท่อไขได้)
              ⚠️ นิยามของ ZORT: "ลูกค้าใหม่ vs ลูกค้าซื้อซ้ำ" — น่าจะดูจากประวัติทั้งหมด
                 ของเรามีข้อมูลแค่ในช่วงที่เลือก ⇒ ใช้ "ซื้อครั้งเดียว vs ซื้อซ้ำ **ในช่วง**" แทน
                 คนที่ซื้อครั้งแรกเมื่อปีก่อนแล้วกลับมาซื้อใบเดียวในช่วงนี้ ZORT นับซื้อซ้ำ เรานับครั้งเดียว
                 **ต้องเขียนนิยามบนจอ** ไม่งั้นคนเทียบสองจอแล้วงงว่าทำไมเลขไม่ตรง */}
          <div className={เหมือนZORT ? 'grid grid-cols-1 lg:grid-cols-2 gap-[30px] mb-[30px]' : 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4'}>
            <div className={เหมือนZORT ? 'bg-white rounded-[6px] p-6' : 'bg-white border border-gray-200 rounded-md p-4'}>
              {/* หัวการ์ด + ตัวสลับมุมมอง — ผังเดียวกับ dropdown `typeoption` ของ ZORT
                  (กดอ่านจากจอจริง 16 ก.ย. 2569: จำนวนลูกค้า ⇒ 2 แถว · ยอดขาย ⇒ 3 แถว มี "ไม่ระบุ" เพิ่ม) */}
              <div className="flex items-center justify-between gap-3 mb-3">
                {/* 🔴 หัวการ์ดต้องตามตัวเลือก (ZORT: เลือก ยอดขาย ⇒ หัว ยอดขาย) — เดิมเขียนตาย "จำนวนลูกค้า" ทั้งที่วงกลมเป็นยอดเงิน (ค่าตั้งต้น sales) = หัวบอกคนละอย่างกับของในการ์ด */}
                {เหมือนZORT ? <ZortCardTitle รูป="◔">{หัววงกลม}</ZortCardTitle> : <p className="text-[15px] font-semibold text-gray-900">👥 {หัววงกลม}</p>}
                <select
                  value={cardBy}
                  onChange={(e) => setCardBy(e.target.value as 'people' | 'sales')}
                  className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white"
                >
                  <option value="people">จำนวนลูกค้า</option>
                  <option value="sales">ยอดขาย</option>
                </select>
              </div>
              {/* 🔴 **มีคนแต่จำแนกไม่ได้ ≠ ทุกกลุ่มเป็นศูนย์** (เจอด้วยท่อปลอมโหมด partialgood 16 ก.ย. 2569)
                  ถ้าท่อส่งรายชื่อมาแต่ **ไม่ส่งจำนวนใบต่อคน** (orders) ⇒ ไม่มีใครเข้าเกณฑ์ทั้งสองกลุ่ม
                  จอเดิมเขียนว่า "ซื้อครั้งเดียวในช่วง 0 ราย (0%)" กับ "ซื้อซ้ำ 0 ราย (0%)"
                  = ยืนยันเลข 0 กับ 0% เป็นข้อเท็จจริงทั้งที่แค่ **ยังไม่รู้**
                  ⇒ แยกสถานะนี้ออกมาพูดตรง ๆ ก่อนถึงกราฟ */}
              {named.length > 0 && newC.length + repC.length + unkC.length === 0 && (
                <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 mb-2 leading-relaxed">
                  ⚠️ มีลูกค้าที่ระบุชื่อ <b>{named.length.toLocaleString('th-TH')}</b> ราย
                  {' '}แต่<b>ท่อไม่ได้ส่งจำนวนใบต่อคนมา</b> ⇒ <b>ยังแยกกลุ่มลูกค้าใหม่/ซื้อซ้ำไม่ได้</b>
                  {' '}— เลขในกราฟข้างล่างจึงยัง<b>ไม่ใช่ 0 จริง ๆ</b> แต่คือ &ldquo;ยังไม่รู้&rdquo;
                </p>
              )}
              {named.length === 0
                ? <p className="text-[12.5px] text-gray-400">ยังไม่มีลูกค้าที่ระบุชื่อในช่วงนี้</p>
                : (() => {
                  /* 🔑 มี `groupTotals` (ทั้งช่วง ไม่ถูกตัด · ท่อเพิ่ม 16 ต.ค. 2569) ⇒ ใช้เลขนี้ทั้งการ์ด · ไม่มี ⇒ ผลรวมรายที่โหลดมา + ก้อนส่วนที่เหลือแบบเดิม */
                  const gt = groupTotals
                  const nNew = gt?.new.customers ?? newC.length
                  const nRep = gt?.repeat.customers ?? repC.length
                  const nUnk = gt ? (gt.unknownFirstDay.customers ?? 0) : unkC.length
                  const total = nNew + nRep || 1
                  const pctNew = Math.round((nNew / total) * 1000) / 10
                  const pctRep = Math.round((nRep / total) * 1000) / 10
                  const C = 2 * Math.PI * 42

                  /* ── มุมมอง "ยอดขาย" (typeoption ของ ZORT) ─────────────────────────
                     🔴 **ยอดของสองกลุ่มนี้บวกได้เฉพาะรายที่โหลดมา** (ตัดที่ 500 รายที่ยอดสูงสุด)
                        ถ้าโชว์แค่สองก้อนแล้วเงียบ คนจะอ่านว่านี่คือยอดทั้งช่วง ⇒ ผิด
                        ⇒ ปิดช่องว่างด้วยสองก้อนที่เหลือ ให้บวกแล้วเท่ากับยอดที่ท่อนับให้จริง:
                           · ไม่ระบุชื่อ (POS) — ท่อส่งมาแยกอยู่แล้ว (ZORT ก็มีแถว "ไม่ระบุ" ในมุมมองนี้)
                           · ส่วนที่อยู่นอก 500 รายแรก — **ยังไม่รู้ว่าเป็นใหม่หรือซื้อซ้ำ** ห้ามยัดเข้ากลุ่มใดกลุ่มหนึ่ง */
                  const sumOf = (list: Person[]) => list.reduce((n, x) => n + x.amount, 0)
                  const salesNew = gt ? gt.new.sales : sumOf(newC)
                  const salesRep = gt ? gt.repeat.sales : sumOf(repC)
                  const salesUnk = gt ? gt.unknownFirstDay.sales : sumOf(unkC)
                  const unnamedRow = people.find((x) => x.name === NO_NAME)
                  const salesNoName = gt ? gt.unnamed.sales : (unnamedRow ? unnamedRow.amount : 0)
                  /* ยอดที่ท่อนับทั้งช่วง (ไม่ได้ถูกตัด) — ไม่มีก็ไม่เดา */
                  const rest = gt ? 0 : totalSales === null
                    ? null
                    : Math.max(0, Math.round((totalSales - salesNew - salesRep - salesUnk - salesNoName) * 100) / 100)

                  if (cardBy === 'sales') {
                    const bar = (v: number, color: string) => (
                      <span className="inline-block h-2 rounded-sm align-middle"
                        style={{ background: color, width: `${totalSales ? Math.max(2, (v / totalSales) * 160) : 2}px` }} />
                    )
                    /* 📐 โหมดเหมือน ZORT: วงกลมแบ่งสัดส่วนทางซ้าย + บรรทัดคำอธิบายเดิม (มียอดเงิน) ทางขวา · "ไม่ระบุชื่อ" ใช้สีน้ำเงินแบบชิ้น "ไม่ระบุ" ของ ZORT */
                    const สีไม่ระบุ = เหมือนZORT ? '#2f8dde' : '#9ca3af'
                    return (
                      <div className={เหมือนZORT ? 'flex items-center gap-8 flex-wrap' : ''}>
                      {เหมือนZORT && <ZortPie ป้าย="สัดส่วนยอดขายตามกลุ่มลูกค้า" ชิ้น={[
                        { ค่า: salesNew, สี: '#8ea8f8' },
                        { ค่า: salesRep, สี: '#f2938c' },
                        { ค่า: salesUnk, สี: '#d1d5db' },
                        { ค่า: salesNoName, สี: สีไม่ระบุ },
                        { ค่า: rest ?? 0, สี: '#fcd34d' },
                      ]} />}
                      <div className="text-[12.5px] space-y-2 min-w-0">
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#8ea8f8' }} />
                          {LAB_A} <b>{fmtMoney(salesNew)}</b> บาท {!เหมือนZORT && bar(salesNew, '#8ea8f8')}</p>
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#f2938c' }} />
                          {LAB_B} <b>{fmtMoney(salesRep)}</b> บาท {!เหมือนZORT && bar(salesRep, '#f2938c')}</p>
                        {/* กอง "ไม่รู้วันซื้อครั้งแรก" — ท่อกำชับห้ามตัดทิ้ง (0 วันนี้ ไม่ใช่ 0 ตลอดไป) ⇒ มี groupTotals ให้โชว์เสมอ */}
                        {(salesUnk > 0 || gt) && (
                          <p className="text-gray-600"><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5 bg-gray-300" />
                            ไม่รู้วันซื้อครั้งแรก <b>{fmtMoney(salesUnk)}</b> บาท</p>
                        )}
                        <p className="text-gray-600"><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: สีไม่ระบุ }} />
                          ไม่ระบุชื่อ (ส่วนใหญ่เป็นหน้าร้าน) <b>{fmtMoney(salesNoName)}</b> บาท {!เหมือนZORT && bar(salesNoName, '#9ca3af')}</p>
                        {/* 🔴 ก้อนที่ปิดช่องว่าง — มีเมื่อถูกตัดที่ 500 รายเท่านั้น */}
                        {rest !== null && rest > 0 && (
                          <p className="text-amber-800"><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5 bg-amber-300" />
                            อยู่นอก 500 รายแรก <b>{fmtMoney(rest)}</b> บาท
                            <span className="text-[11.5px] text-amber-700"> — ยังไม่รู้ว่าเป็น{LAB_A}หรือ{LAB_B}</span>
                          </p>
                        )}
                        {/* ⚠️ ก้อน "อยู่นอก 500 รายแรก" คือ **ส่วนที่เหลือ** (ยอดทั้งช่วง ลบก้อนที่รู้)
                            ⇒ มันบวกครบเพราะวิธีคิด ไม่ใช่เพราะเราไปตรวจมา — เขียนให้ตรงตามนั้น */}
                        <p className="text-[11.5px] text-gray-400 leading-relaxed max-w-[330px] pt-1">
                          {gt
                            ? <>ยอดของทุกกลุ่มเป็นของ<b>ทั้งช่วง</b> (ท่อแยกกลุ่มให้ทั้งช่วง ไม่ได้นับจากเฉพาะรายที่โหลดมา){totalSales !== null && <> · ยอดทั้งช่วง {fmtMoney(totalSales)} บาท</>}</>
                            : totalSales !== null
                            ? <>ยอดทั้งช่วงที่ท่อนับให้ <b>{fmtMoney(totalSales)}</b> บาท ·
                              ก้อนสุดท้ายคือ<b>ส่วนที่เหลือ</b>จากยอดนั้น (ไม่ใช่เลขที่แยกกลุ่มมาแล้ว)</>
                            : <>ท่อไม่ได้ส่งยอดรวมทั้งช่วงมารอบนี้ ⇒ บอกไม่ได้ว่าสองกลุ่มนี้ครบหรือยัง</>}
                          {' '}· ZORT มีมุมมองนี้เหมือนกัน (ลูกค้าใหม่ · ลูกค้าซื้อซ้ำ · ไม่ระบุ)
                        </p>
                      </div>
                      </div>
                    )
                  }

                  return (
                    <div className="flex items-center gap-6 flex-wrap">
                      <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#8ea8f8" strokeWidth="16" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#f2938c" strokeWidth="16"
                          strokeDasharray={`${(nRep / total) * C} ${C}`} />
                      </svg>
                      <div className="text-[12.5px] space-y-1.5">
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#8ea8f8' }} />
                          {LAB_A}{' '}
                          <b>{nNew.toLocaleString('th-TH')}</b> ราย ({pctNew}%)</p>
                        <p><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#f2938c' }} />
                          {LAB_B}{' '}
                          <b>{nRep.toLocaleString('th-TH')}</b> ราย ({pctRep}%)</p>
                        {(nUnk > 0 || gt) && (
                          <p className="text-[12.5px] text-gray-500">
                            <span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5 bg-gray-300" />
                            ไม่รู้วันซื้อครั้งแรก <b>{nUnk.toLocaleString('th-TH')}</b> ราย
                            <span className="text-gray-400"> (หา firstDay ไม่ได้ — ไม่ได้อยู่ในวงกลม)</span>
                          </p>
                        )}
                        {/* 🔴 ถูกตัดที่ 500 ราย ⇒ **วงกลมนี้ไม่ใช่ทั้งช่วง** ต้องเขียนไว้ตรงนี้
                            ไม่ใช่ปล่อยให้คนอ่านไปเทียบกับเลข 547/255 ของ ZORT ซึ่งเป็นทั้งชุด */}
                        {truncated && !groupTotals && (
                          <p className="text-[11.5px] text-amber-700">
                            นับจาก {named.length.toLocaleString('th-TH')} รายที่โหลดมาเท่านั้น
                            {distinctNames !== null && <> (ทั้งช่วงมี {distinctNames.toLocaleString('th-TH')} ราย)</>}
                            {' '}— ZORT โชว์ตัวเลขของทั้งชุด เทียบกันตรง ๆ ไม่ได้
                          </p>
                        )}
                        {hasZortDef ? (
                          <p className="text-[11.5px] text-gray-400 leading-relaxed max-w-[300px] pt-1">
                            นิยามแบบ ZORT: &ldquo;ใหม่&rdquo; = ซื้อครั้งแรก(ทั้งประวัติ)อยู่ในช่วงที่เลือก
                            {historyFrom && (
                              <> · <b className="text-amber-700">ข้อมูลย้อนได้ถึง {thaiDate(historyFrom)}</b> —
                                คนที่เคยซื้อก่อนหน้านั้นจะถูกนับเป็น &ldquo;ใหม่&rdquo; เกินจริง</>
                            )}
                          </p>
                        ) : (
                          <p className="text-[11.5px] text-gray-400 leading-relaxed max-w-[300px] pt-1">
                            นับเฉพาะช่วงที่เลือก — ZORT นับ &ldquo;ใหม่/ซื้อซ้ำ&rdquo; จากประวัติทั้งหมด
                            จึงเทียบตัวเลขกันตรง ๆ ไม่ได้ (นิยามคนละช่วงเวลา)
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
            </div>
            <div className={เหมือนZORT ? 'bg-white rounded-[6px] p-6' : 'bg-white border border-gray-200 rounded-md p-4'}>
              <div className="flex items-center justify-between gap-3 mb-3">
                {เหมือนZORT ? <ZortCardTitle รูป="↗">แนวโน้ม</ZortCardTitle> : <p className="text-[15px] font-semibold text-gray-900">📈 แนวโน้ม</p>}
                <select
                  value={trendBy}
                  onChange={(e) => { เลือกแนวโน้มเอง.current = true; setTrendBy(e.target.value as 'people' | 'sales') }}
                  className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white"
                >
                  <option value="people">จำนวนลูกค้า</option>
                  {/* ท่อรุ่นที่ไม่ส่งยอดรายเดือน ⇒ ปิดตัวเลือกพร้อมเหตุ ไม่วาดเส้นศูนย์ */}
                  <option value="sales" disabled={!มียอดรายเดือน(monthly)}>
                    {มียอดรายเดือน(monthly) ? 'ยอดขาย' : 'ยอดขาย (ท่อยังไม่ส่งยอดรายเดือน)'}
                  </option>
                </select>
              </div>
              {/* ⚠️ ZORT วาดเส้นรายเดือน ลูกค้าใหม่/ซื้อซ้ำ/ไม่ระบุ — ต้องมีข้อมูลรายเดือนถึงจะวาดได้
                  ท่อ bycustomer ตอบเป็นยอดรวมทั้งช่วง ไม่มีมิติเวลา ⇒ วาดไม่ได้โดยไม่เดา
                  **การ์ดต้องอยู่ตามผังพร้อมเหตุผล** ไม่ใช่หายไปเฉย ๆ (คนที่ชิน ZORT จะหา) */}
              {monthly.length > 0
                ? (() => {
                  const ยอด = trendBy === 'sales' && มียอดรายเดือน(monthly)
                  const gran = ยอด ? trendGran : 'month'
                  const rows = gran === 'month' ? monthly : รวมยอดตามช่วง(monthly, gran)
                  const ปุ่ม: { k: 'day' | 'month' | 'quarter' | 'year'; label: string; ใช้ได้: boolean }[] = [
                    { k: 'day', label: 'วัน', ใช้ได้: false },
                    { k: 'month', label: 'เดือน', ใช้ได้: true },
                    { k: 'quarter', label: 'ไตรมาส', ใช้ได้: ยอด },
                    { k: 'year', label: 'ปี', ใช้ได้: ยอด },
                  ]
                  return (
                    <>
                      <TrendChart rows={rows} by={ยอด ? 'sales' : 'people'} />
                      <div className="flex justify-end mt-2">
                        <div className="inline-flex border border-gray-300 rounded overflow-hidden text-[12px]">
                          {ปุ่ม.map((b) => (
                            <button key={b.k} type="button" disabled={!b.ใช้ได้}
                              aria-pressed={gran === b.k}
                              onClick={() => b.k !== 'day' && setTrendGran(b.k)}
                              className={`px-2.5 py-1 border-l first:border-l-0 border-gray-300 ${gran === b.k ? 'bg-gray-100 font-semibold underline' : 'bg-white'} disabled:text-gray-300 disabled:cursor-not-allowed`}>
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* ปุ่มที่ปิดต้องบอกเหตุบนจอ — title อย่างเดียวอ่านข้ามได้ */}
                      <p className="text-[11px] text-gray-400 mt-1 text-right">
                        วัน: ท่อส่งข้อมูลเป็นรายเดือนเท่านั้น
                        {!ยอด && ' · ไตรมาส/ปี: ใช้ได้ในมุมมองยอดขาย (จำนวนคนรวมข้ามเดือนไม่ได้ คนเดียวจะถูกนับซ้ำ)'}
                      </p>
                    </>
                  )
                })()
                : (
                  <p className="text-[12.5px] text-gray-500 leading-relaxed">
                    ZORT วาดกราฟลูกค้าใหม่/ซื้อซ้ำรายเดือน — ท่อยังไม่ส่งข้อมูลรายเดือนมา
                    {/* 🔴 ข้อความเดิมบอกให้ "รอ deploy รอบ 21:00" ซึ่งเป็นกฎที่ยกเลิกไปแล้ว (14 ก.ย. 2569)
                        ⚠️ **และรอบแรกผมแก้ผิดทาง** — เขียนว่า "ท่อยังไม่ส่ง ต้องไปถามฝั่งท่อ"
                           ทั้งที่ยิงของจริงแล้วพบว่า **ท่อส่งครบมาตลอด** · ที่ไม่ส่งคือท่อปลอมในเครื่อง
                           ⇒ เกือบทำให้คนไปไล่บี้ฝั่งที่ไม่ได้ผิด
                        📌 กติกา: ข้อความสำรองแบบนี้ต้องเขียนจาก **สิ่งที่จอรู้ตอนนั้น** เท่านั้น
                           คือ "รอบนี้ไม่มีข้อมูลมา" — ห้ามเดาต่อว่าใครเป็นคนผิด */}
                    <span className="block text-[11.5px] text-gray-400 mt-1.5">
                      ปกติท่อส่งข้อมูลรายเดือนมาให้ — เห็นข้อความนี้แปลว่า<b>รอบนี้ไม่ได้มา</b>
                      {' '}ลองโหลดหน้านี้ใหม่ก่อน · ถ้ายังไม่มาอีกค่อยแจ้ง
                    </span>
                  </p>
                )}
            </div>
          </div>

          {/* ── ผัง ZORT: การ์ดตาราง จังหวัด / จำนวนลูกค้า + ตัวเลือก `contactperprovincetype` (หน้าละ 6 แถวแบบ ZORT) ──
              ท่อนับให้ฝั่งเซิร์ฟเวอร์ (3841b6f7): ที่อยู่ส่งของก่อน ถอยไปที่อยู่ลูกค้า · ไม่มีทั้งคู่ = แถว (ไม่ระบุ) แยกไว้
              🔴 provinces = null ⇒ เขียนเหตุจากท่อ "ยังไม่มีข้อมูล" ห้ามโชว์ตารางว่าง (ร้าน z2 ยังไม่มีจังหวัดเลย)
              ⚠️ เลข (ไม่ระบุ) ของ ZORT กับของเรานับคนละแบบ (อ่านจอ 16 ต.ค.: ZORT 215 ราย · ของเรานับเฉพาะชื่อ) ⇒ ไม่อ้างว่าตรง */}
          <div className="bg-white border border-gray-200 rounded-md mb-4">
            <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">📍 จังหวัด</p>
              <select value={provBy} onChange={(e) => { setProvBy(e.target.value as 'customers' | 'orders' | 'sales'); setProvPage(0) }}
                disabled={!provinces}
                className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white max-w-full min-w-0 disabled:text-gray-400">
                <option value="customers">จำนวนลูกค้า</option>
                <option value="orders">จำนวนรายการ</option>
                <option value="sales">มูลค่ารายการ</option>
              </select>
            </div>
            {!provinces ? (
              <p className="px-4 pb-4 text-[12.5px] text-gray-500 leading-relaxed">
                <b>ยังไม่มีข้อมูลจังหวัด</b>{provSkip ? <> — {provSkip.replace(/\*\*/g, '')}</> : null}
              </p>
            ) : (() => {
              /* ค่าไม่ใช่ตัวเลข = ไม่รู้ ⇒ เรียงไว้ท้าย และแสดงขีด (ไม่ใช่ 0) */
              const คีย์ = (r: ProvinceRow) => (typeof r[provBy] === 'number' ? (r[provBy] as number) : -Infinity)
              const rows = [...provinces].sort((x, y) => คีย์(y) - คีย์(x))
              const pages = Math.max(1, Math.ceil(rows.length / PROV_PER_PAGE))
              const pg = Math.min(provPage, pages - 1)
              const หัว = provBy === 'customers' ? 'จำนวนลูกค้า' : provBy === 'orders' ? 'จำนวนรายการ' : 'มูลค่ารายการ'
              return (
                <>
                  <TableWrap>
                    <table className="w-full">
                      <thead className="bg-white border-b border-gray-200">
                        <tr><th className={TH_KANIT}>จังหวัด</th><th className={THR_KANIT}>{หัว}</th></tr>
                      </thead>
                      <tbody>
                        {rows.slice(pg * PROV_PER_PAGE, (pg + 1) * PROV_PER_PAGE).map((r) => (
                          <tr key={r.province} className="border-b border-[#e8ecf8] last:border-0">
                            <td className={TD}>{r.province === '(ไม่ระบุ)' ? 'ไม่ระบุ' : r.province}</td>
                            <td className={TDR}>
                              {provBy === 'sales' ? fmtMoney(r.sales) : (typeof r[provBy] === 'number' ? (r[provBy] as number).toLocaleString('th-TH') : '—')}
                              {provBy === 'customers' && (r.unnamedOrders ?? 0) > 0 && (
                                <span className="block text-[11px] text-gray-400">+ ใบไม่ระบุชื่อ {(r.unnamedOrders ?? 0).toLocaleString('th-TH')} ใบ (นับเป็นคนไม่ได้)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-gray-100 text-[12px] text-gray-500">
                    <span>{rows.length.toLocaleString('th-TH')} จังหวัด · หน้า {pg + 1}/{pages}</span>
                    <span className="flex gap-2">
                      <button type="button" disabled={pg <= 0} onClick={() => setProvPage(pg - 1)} className="px-2 py-0.5 rounded border border-gray-300 disabled:opacity-40">← ก่อนหน้า</button>
                      <button type="button" disabled={pg >= pages - 1} onClick={() => setProvPage(pg + 1)} className="px-2 py-0.5 rounded border border-gray-300 disabled:opacity-40">ถัดไป →</button>
                    </span>
                  </div>
                  <p className="px-4 pb-3 text-[11.5px] text-gray-400 leading-relaxed">
                    {provSource && <>ที่มาของจังหวัด: {Object.entries(provSource).map(([k, v]) => `${k} ${Number(v).toLocaleString('th-TH')} ใบ`).join(' · ')} · </>}
                    นับเฉพาะใบที่มีชื่อเป็นลูกค้า ใบไม่ระบุชื่อแยกไว้
                    {range.from && range.from < จังหวัดมีตั้งแต่ && (
                      <span className="text-amber-700"> · ⚠️ ข้อมูลจังหวัดมีตั้งแต่ {thaiDate(จังหวัดมีตั้งแต่)} ⇒ ใบก่อนนั้นอยู่แถว ไม่ระบุ</span>
                    )}
                  </p>
                </>
              )
            })()}
          </div>

          {/* 🔴 **เลขบนแท็บนับจากรายที่โหลดมาเท่านั้น** — ตอนถูกตัด มันไม่ใช่ยอดของทั้งช่วง
              ไม่เปลี่ยนเลขบนแท็บเป็น distinctNames เพราะ "ซื้อซ้ำ/ซื้อครั้งเดียว" คิดได้เฉพาะ
              รายที่มีข้อมูลมาจริง ⇒ ถ้าเอาเลขทั้งช่วงไปใส่แท็บเดียว สามแท็บจะคนละฐานกัน
              ⇒ เขียนขอบเขตกำกับไว้ข้างบนแทน ให้คนอ่านรู้ว่าเลขพวกนี้คิดจากกี่ราย */}
          {truncated && (
            <p className="text-[11.5px] text-gray-500 mb-1">
              เลขบนแท็บนับจาก {people.length.toLocaleString('th-TH')} รายที่โหลดมา
              {distinctNames !== null && <> — ลูกค้าที่มีชื่อทั้งช่วงมี {distinctNames.toLocaleString('th-TH')} ราย</>}
              {' '}(ยอดเงินของแต่ละรายที่แสดงถูกต้องครบ ไม่ได้ถูกตัด)
            </p>
          )}
          {/* แท็บ — ผัง `tableoption` ของ ZORT (ลูกค้าใหม่ · ลูกค้าซื้อซ้ำ · Marketplace Username)
              🔑 **ใช้คำของ ZORT ได้ต่อเมื่อเรานับด้วยนิยามเดียวกัน** (ท่อส่ง newInRange มา)
                 ถ้าไม่มี ต้องใช้คำของเราเอง ไม่ใช่แปะคำ ZORT ทับนิยามที่ไม่ตรง
              ⚠️ คนที่ "ไม่ทราบสถานะ" อยู่ในแท็บทั้งหมดเท่านั้น ⇒ สองแท็บล่างบวกกันไม่เท่าแท็บแรก
                 (บอกไว้ใต้แท็บ ไม่ใช่ปล่อยให้คนบวกเอง) */}
          {เหมือนZORT && truncated && กล่องตัด500}
          {เหมือนZORT && <SearchRow
            value={q}
            onChange={(v) => { setQ(v); setPage(0) }}
            onSubmit={() => setPage(0)}
            placeholder="ค้นชื่อลูกค้า"
            advanced={<LinkText onClick={() => setPage(0)}>ค้นหา</LinkText>}
          />}
          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: people.length },
              { id: 'a', label: LAB_A, count: newC.length },
              { id: 'b', label: LAB_B, count: repC.length },
              { id: 'mk', label: 'Marketplace Username', count: mkC.length },
            ]}
            active={tab}
            onChange={(id) => { setTab(id as 'all' | 'a' | 'b' | 'mk'); setPage(0) }}
          />
          <p className="text-[11.5px] text-gray-400 mt-1">
            แท็บ &ldquo;ทั้งหมด&rdquo; รวมใบที่ไม่ระบุชื่อ
            {unkC.length > 0 && <> และคนที่ยังไม่ทราบสถานะอีก {unkC.length.toLocaleString('th-TH')} ราย</>}
            {' '}⇒ สองแท็บขวาบวกกันไม่เท่าแท็บแรก ·
            {tab === 'mk' && <> แท็บ <b>Marketplace Username</b> แสดงชื่อผู้ใช้มาร์เก็ตเพลสของรายที่โหลดมา{truncated ? ' (ไม่ใช่ทุกรายในช่วง — ดูบรรทัดบน)' : ''} · ZORT แยกแถวต่อชื่อผู้ใช้ ของเราแยกต่อชื่อลูกค้า ⇒ คนที่มีหลายชื่อผู้ใช้อยู่แถวเดียว</>}
          </p>

          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH_KANIT} style={{ width: 44 }}>#</th>
                  <th className={TH_KANIT}>ชื่อ</th>
                  <th className={TH_KANIT}>ช่องทางที่ซื้อ</th>
                  <th className={THR_KANIT}>จำนวนใบ</th>
                  <th className={THR_KANIT}>ยอดรวม</th>
                  {/* ZORT (ภาพ 76) มีคอลัมน์ ยอดขาย (%) — สัดส่วนต่อยอดรวมของช่วง */}
                  <th className={THR_KANIT} title={ร้อยละในกลุ่ม ? `ร้อยละของยอดขายกลุ่ม${tab === 'a' ? 'ลูกค้าใหม่' : 'ลูกค้าซื้อซ้ำ'}ในช่วงนี้ (แบบ ZORT)` : ร้อยละของทั้งช่วง ? 'ร้อยละของยอดขายทั้งช่วง (ท่อนับทุกใบ ไม่ใช่เฉพาะรายที่แสดง)' : 'ร้อยละของยอดรวมเฉพาะรายที่แสดง — ท่อไม่ได้ส่งยอดทั้งช่วงมา'}>
                    ยอดขาย (%{ร้อยละในกลุ่ม ? '' : ร้อยละของทั้งช่วง ? ' ของทั้งช่วง' : ' ของรายที่แสดง'})
                  </th>
                  <th className={THR_KANIT}>ซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={7} icon="👥" title="ไม่พบลูกค้าในเงื่อนไขนี้"
                    detail="รายชื่อลูกค้ารวมจากใบขาย — ถ้าเพิ่งมีออเดอร์ใหม่ ต้องรอรอบซิงก์ถัดไป" />
                )}
                {shown.map((p, i) => (
                  <tr key={p.name} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{page * PER_PAGE + i + 1}</td>
                    <td className={TD}>
                      {/* มีหน้าปลายทางแล้วตั้งแต่ 8 ก.ย. 2569 (/core/customers/detail รับ ?name=)
                          ⚠️ "ไม่ระบุชื่อ" กดไม่ได้โดยตั้งใจ — มันคือ **หลายคนรวมกัน** ไม่ใช่ลูกค้าหนึ่งราย
                             ทำให้กดได้ = พาไปหน้าที่ค้นชื่อว่า "ไม่ระบุชื่อ" แล้วได้ผลที่ดูเหมือนจริงแต่ไม่ใช่ใคร
                          ⚠️ ชื่อที่มีดาว (มาร์เก็ตเพลสปิดมาเอง) ยังกดได้ แต่หน้าปลายทางเตือนเองว่าผลไม่น่าเชื่อถือ */}
                      {/* 🔴 ไม่มีชื่อเลย = ท่อส่งแถวที่ไม่มีช่อง name มา (เจอด้วยโหมด partialgood 9 ก.ย. 2569)
                          ของเดิมทำเป็นลิงก์ทั้งที่ข้อความว่าง ⇒ ได้ `?name=undefined` และ
                          **ลิงก์ที่มองไม่เห็น กดไม่โดน** ⇒ ต้องขึ้นขีดแทน ไม่ใช่ลิงก์เปล่า */}
                      {!p.name ? (
                        <span className="text-gray-300">—</span>
                      ) : p.name === NO_NAME ? (
                        <>
                          <span className="text-gray-900 font-medium">{p.name}</span>
                          <span className="ml-1.5 text-[11.5px] text-gray-400">(หลายคนรวมกัน — เปิดดูรายคนไม่ได้)</span>
                        </>
                      ) : (
                        <>
                          <Link href={`/core/customers/detail?name=${encodeURIComponent(p.name)}`}
                            className="text-[#457ab2] hover:underline font-medium">{tab === 'mk' ? (p.marketplaceNames ?? []).join(' · ') : p.name}</Link>
                          {tab === 'mk' && <span className="block text-[11.5px] text-gray-400">ชื่อลูกค้า: {p.name}</span>}
                        </>
                      )}
                    </td>
                    {/* ⚠️ โชว์จำนวนใบต่อช่องทางด้วย — "ซื้อ 4 ใบ" กับ "ซื้อทาง Shopee 4 ใบ"
                        ต่างกันตอนคนคนเดียวซื้อหลายช่องทาง · ไม่มีข้อมูล = ขีด ไม่ใช่เว้นว่าง */}
                    <td className={`${TD} text-gray-500 max-w-[240px]`}>
                      {p.channels && p.channels.length > 0
                        ? p.channels.map((c) => `${c.channel} (${c.orders})`).join(' · ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TDR}>{p.orders.toLocaleString('th-TH')}</td>
                    <td className={TDR}>{fmtMoney(p.amount)}</td>
                    {/* ตัวหาร = ยอดทั้งช่วงจากท่อ (ดู ตัวหารร้อยละ) · กันหารศูนย์ด้วย */}
                    <td className={`${TDR} text-gray-500`}>
                      {ตัวหารร้อยละ > 0 ? `${(Math.round((p.amount / ตัวหารร้อยละ) * 1000) / 10).toLocaleString('th-TH')}%` : '—'}
                    </td>
                    <td className={`${TDR} text-gray-500`}>{thaiDate(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* แถบล่างแบบ ZORT: ซ้ายบอกจำนวน ขวาเลื่อนหน้า */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12.5px] text-gray-500">
                แสดง {filtered.length === 0 ? 0 : (page * PER_PAGE + 1).toLocaleString('th-TH')}–
                {Math.min((page + 1) * PER_PAGE, filtered.length).toLocaleString('th-TH')} จาก{' '}
                {filtered.length.toLocaleString('th-TH')} ราย
                {/* ท่อกำชับ: % ในกลุ่มต้องมีป้าย historyFrom คู่กันเสมอ — คนที่ซื้อก่อนวันนั้นจะดูเป็นลูกค้าใหม่เกินจริง */}
                {ร้อยละในกลุ่ม && (
                  <span className="block text-[11.5px] text-gray-400">
                    ยอดขาย (%) = สัดส่วนในยอดของกลุ่ม{tab === 'a' ? 'ลูกค้าใหม่' : 'ลูกค้าซื้อซ้ำ'}ทั้งช่วง {fmtMoney(ยอดกลุ่ม as number)} บาท (แบบ ZORT)
                    {historyFrom && <> · <span className="text-amber-700">ประวัติย้อนได้ถึง {thaiDate(historyFrom)} — คนที่ซื้อก่อนนั้นจะนับเป็นลูกค้าใหม่เกินจริง</span></>}
                  </span>
                )}
              </span>
              {/* เลขหน้าแบบ ZORT (ชิ้นเดียวกับจอรายการอื่น) — จอนี้แบ่งหน้าจากอาเรย์ที่กรองแล้วในเบราว์เซอร์
                  ⇒ จำนวนทั้งชุดคือ `filtered.length` ซึ่งรู้แน่นอน จึงบอกจำนวนหน้าได้ */}
              <PageNav offset={page * PER_PAGE} perPage={PER_PAGE} rowsOnPage={shown.length}
                total={filtered.length}
                onGo={(off) => setPage(Math.max(0, Math.floor(off / PER_PAGE)))}
                /* เปลี่ยนจำนวนต่อหน้า ⇒ กลับไปหน้าแรก (หน้า 7 ของชุดเก่าอาจไม่มีอยู่ในชุดใหม่) */
                onPerPage={(n) => { setPerPage(n); setPage(0) }} />
            </div>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ ZORT มีคอลัมน์ <b>เลขประจำตัวผู้เสียภาษี · เบอร์โทรศัพท์ · อีเมล</b> แต่คลังเงาของเรา
            <b> ไม่ได้เก็บสามอย่างนี้ไว้</b> จึงไม่ใส่คอลัมน์เปล่าให้ดูเหมือนมีข้อมูล ·
            และจับลูกค้าด้วย<b>ชื่อที่บันทึกในออเดอร์</b> ไม่ใช่เบอร์โทร — ชื่อสะกดต่างกันจะนับเป็นคนละคน
            ใช้ดูภาพรวมได้ แต่ยังไม่ใช่ทะเบียนลูกค้าจริง
          </p>
        </>
      )}
    </div>
  )
}
