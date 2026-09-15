'use client'
// รายงาน → ยอดซื้อ — **ลอกจาก `zort-ui/56-zort-รายงาน-ยอดซื้อ.jpg`**
// ผัง: ชื่อจอ "ยอดซื้อ" → บรรทัดช่วงเวลา + ค้นหาขั้นสูง
//      → การ์ดคู่: "สรุปยอดซื้อ" (ตัวเลขใหญ่ / ไม่มียอดซื้อ + Download Excel) | "รายงาน" (กราฟ)
//      → การ์ด "ยอดซื้อ" รายสินค้า: รหัสสินค้า · สินค้า · จำนวน · ยอดซื้อ (บาท) · ยอดซื้อ (%)
//
// ✅ **ตารางรายสินค้าเติมได้แล้ว** (`list=purchaseitems` · 3 ก.ย. 2569) — 217 รหัส · 234 บรรทัด
//    ⚠️ **แต่ท่อนี้ยังไม่รับช่วงวันที่** ⇒ ตารางรายสินค้าเป็น "ทุกช่วงเวลา" ไม่ใช่ช่วงที่เลือกด้านบน
//       ต้องเขียนกำกับให้ชัด ไม่งั้นคนอ่านจะนึกว่ามันขยับตามตัวกรอง แล้วสรุปตัวเลขผิด
//
// ⚠️ **"ไม่มียอดซื้อในช่วงนี้" ≠ "ร้านไม่เคยซื้อของ"**
//    ZORT เองก็ขึ้น "ไม่มียอดซื้อ" ในช่วง 3 เดือนล่าสุด เพราะใบซื้อทั้ง 32 ใบเก่ากว่านั้น
//    ถ้าจอเงียบ ๆ ว่าง คนอ่านจะสรุปผิดทันที ⇒ ต้องบอกว่ามีกี่ใบและใบล่าสุดเมื่อไหร่
import Link from 'next/link'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import StorePicker, { type StoreId } from '@/components/zort/StorePicker'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate, thaiShort } from '@/components/zort'

interface Po { number: string; vendor?: string; po_date?: string; amount?: number; status?: string }
interface Resp { total?: number; amount?: number; rows?: Po[]
  /** ขอบเขตร้านของข้อมูลชุดนี้ — **ข้อความมาจากท่อ จอไม่แต่งเอง** (ใบ t_mu2kxy6u)
   *  🔴 มาจากคำตอบ `list=purchases` เท่านั้น — **`list=purchaseitems` ไม่ส่งช่องนี้มา** (ยิงตรวจแล้ว 15 ก.ย.)
   *     ⇒ ห้ามเอาของจากเส้นแรกไปติดป้ายให้ตารางรายสินค้าที่มาจากเส้นที่สอง เป็นคนละคำตอบ */
  storeScope?: string
  /** ⚠️ **สถานะที่สาม** — "ทำต่อไม่ได้" (คลังเงายังไม่พร้อม) ไม่ใช่ error และไม่ใช่ข้อมูลว่าง
   *  ท่อจะไม่ส่งช่องข้อมูลมาด้วยเมื่อมีค่านี้ ⇒ ต้องเช็คก่อนตัวกัน "ตอบมาไม่ครบ" เสมอ */
  skip?: string }
/** แถวของตารางรายสินค้า · เมื่อจัดกลุ่ม (by≠sku) ท่อส่ง `groupKey` มาแทน `sku`/`name` */
interface ItemRow {
  sku?: string; name?: string; qty?: number; amount?: number; orders?: number; lastDate?: string
  groupKey?: string; skus?: number
}
interface ItemsResp {
  skus?: number; lines?: number; amount?: number; rows?: ItemRow[]
  /** ขอบเขตร้านของ **เส้นนี้เอง** — ท่อเพิ่มให้ 15 ก.ย. 2569 (gucut-web ab69ec5)
   *  🚫 ห้ามยืมค่าจาก `list=purchases` มาใช้แทน แม้จะเป็นเรื่องซื้อเหมือนกัน (คนละคำตอบ) */
  storeScope?: string
  /** ⚠️ ท่อส่งธงบอกการตัดมาเองแล้ว (5 ก.ย. 2569) — จอไม่ต้องเดาจากการเทียบตัวเลขอีก
   *  `truncated` = ยังมีของเหลืออีกนอกเหนือจากที่ส่งมา (คนละเรื่องกับ `limitClamped`
   *  ซึ่งแปลว่า "ให้น้อยกว่าที่ขอเพราะชนเพดาน") */
  total?: number; shown?: number; truncated?: boolean
  /** 🗓️ ขอบเขตวันของ **เส้นนี้เอง** (ท่อ gucut-web e3071fb · 16 ก.ย. 2569)
   *  🔴 **ที่มาของบั๊กที่ฝั่งท่อจับได้**: ก่อนหน้านี้ตารางรายสินค้า **ไม่มีตัวกรองวันเลย**
   *     ⇒ กดเลือกช่วงไหนก็เป็นยอด "ตลอดกาล" ตลอด ในขณะที่กล่องสรุป/กราฟ/ตารางใบซื้อกรองตามช่วง
   *     ⇒ จอเดียวสองขอบเขตโดยไม่มีอะไรบอก · ตอนนี้ท่อรับ from/to แล้ว ⇒ ส่งทุกครั้ง + เช็ค applied */
  dateScope?: string
  applied?: { from?: string | null; to?: string | null; by?: string | null }
  /** 🔴 ท่อตัดใบซื้อที่ยกเลิกออกให้แล้วหรือยัง (gucut-web 5a8f55d · 15 ก.ย. 2569)
   *  `true` = ตารางรายสินค้า **ไม่นับใบยกเลิก** เหมือนรายงานยอดซื้อของ ZORT
   *  `undefined` = ท่อรุ่นก่อนหน้า ⇒ **ยังนับรวมอยู่** ⇒ จอต้องเขียนเตือนแบบเดิม
   *  ⚠️ ผูกข้อความไว้กับช่องนี้ ไม่ใช่กับวันที่ deploy — ช่วงคาบเกี่ยวจะได้ไม่พูดผิด */
  excludesCancelled?: boolean
  limitClamped?: boolean; limitNote?: string
}

type Grain = 'day' | 'month' | 'quarter' | 'year'
const GRAINS: { id: Grain; label: string }[] = [
  { id: 'day', label: 'วัน' },
  { id: 'month', label: 'เดือน' },
  { id: 'quarter', label: 'ไตรมาส' },
  { id: 'year', label: 'ปี' },
]

/* 🗓️ วันของร้าน (UTC+7) — ตัวช่วยชุดเดียวกับ isoAgo/todayIso
   ⚠️ ทั้งสามตัวต้องบวก 7 เหมือนกันหมด ไม่งั้นต้นช่วงกับปลายช่วงคิดคนละเขตเวลา (เคยพลาดมาแล้ว) */
function dayAgoIso(days: number) {
  const t = new Date(Date.now() + 7 * 3600e3)
  t.setDate(t.getDate() - days)
  return t.toISOString().slice(0, 10)
}
/** วันที่ 1 ของเดือนย้อนหลัง N เดือน (0 = เดือนนี้) */
function monthStartIso(backMonths: number) {
  const t = new Date(Date.now() + 7 * 3600e3)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - backMonths, 1)).toISOString().slice(0, 10)
}
/** วันสุดท้ายของเดือนย้อนหลัง N เดือน */
function monthEndIso(backMonths: number) {
  const t = new Date(Date.now() + 7 * 3600e3)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - backMonths + 1, 0)).toISOString().slice(0, 10)
}

function isoAgo(months: number) {
  // ⚠️ ต้องบวก 7 เหมือน todayIso ไม่งั้นต้นช่วงกับปลายช่วงคิดคนละเขตเวลา
  const t = new Date(Date.now() + 7 * 3600e3)
  t.setMonth(t.getMonth() - months)
  return t.toISOString().slice(0, 10)
}
/* 🔴 **วันแบบ UTC ไม่ใช่วันของร้าน** (แก้ 5 ก.ย. 2569 ตอนไล่ตรวจทั้งระบบ)
   ร้านอยู่ไทย UTC+7 · `new Date().toISOString()` ให้วันแบบ UTC
   ⇒ **ตี 1 ถึง 7 โมงเช้าเวลาไทย จะได้ "เมื่อวาน"** ⇒ ช่วงวันที่ตั้งต้นจบที่เมื่อวาน
      ใบซื้อที่ทำเช้านั้นหายจากรายงานเงียบ ๆ และไม่มีอะไรฟ้อง
   (ร้านนี้ทำงานตี 3 จริง — ชั่วโมงที่บั๊กนี้ทำงานพอดี) */
function todayIso() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) }

/** ป้ายแกนนอนตามความละเอียดที่เลือก — ต้องเรียงตามเวลาจริง ไม่ใช่เรียงตามตัวอักษร */
function bucketOf(iso: string, g: Grain) {
  const [y, m, d] = iso.split('-')
  if (g === 'year') return { key: y, label: `${Number(y) + 543}` }
  if (g === 'quarter') {
    const q = Math.floor((Number(m) - 1) / 3) + 1
    return { key: `${y}-Q${q}`, label: `Q${q}/${Number(y) + 543}` }
  }
  if (g === 'month') {
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return { key: `${y}-${m}`, label: `${TH[Number(m) - 1]}/${Number(y) + 543}` }
  }
  return { key: `${y}-${m}-${d}`, label: `${Number(d)}/${Number(m)}` }
}

/** กราฟเส้นแบบ ZORT — เส้นเดียว จุดกลม เส้นแนวนอนจาง ๆ · SVG ล้วน ไม่พึ่งไลบรารี */
function BuyChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 640, H = 210, L = 54, R = 10, T = 12, B = 34
  const max = Math.max(...points.map((p) => p.value), 0)
  // ⚠️ ทุกจุดเป็นศูนย์ต้องยังวาดเส้นฐานให้เห็น — กราฟเปล่าดูเหมือนกราฟพัง
  const top = max > 0 ? max : 40
  const ticks = 4
  const x = (i: number) => points.length <= 1 ? L : L + ((W - L - R) * i) / (points.length - 1)
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="กราฟยอดซื้อ">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (top / ticks) * i
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-gray-200" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {v >= 1000 ? `${Math.round(v / 1000)}K` : Math.round(v)}
            </text>
          </g>
        )
      })}
      <path d={line} fill="none" strokeWidth={2} className="stroke-[#7c9cf0]" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={p.label} cx={x(i)} cy={y(p.value)} r={3.5} className="fill-[#5b7fe0]" />)}
      {points.map((p, i) => (
        <text key={`t-${p.label}`} x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-500 text-[10px]">{p.label}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle" className="fill-gray-400 text-[10px]">ช่วงเวลา</text>
    </svg>
  )
}

export default function BuyReportPage() {
  const [rows, setRows] = useState<Po[] | null>(null)
  const [all, setAll] = useState<Resp | null>(null)
  const [from, setFrom] = useState(isoAgo(3))
  const [to, setTo] = useState(todayIso())
  const [adv, setAdv] = useState(false)
  const [grain, setGrain] = useState<Grain>('month')
  const [q, setQ] = useState('')
  /* 🏬 ร้านที่กำลังดู — **ส่งให้ทั้งสองเส้น** (`list=purchases` และ `list=purchaseitems`)
     ไม่งั้นตารางรายใบกับตารางรายสินค้าจะเป็นคนละร้านโดยที่จอดูปกติทุกประการ
     (คลาสเดียวกับ "อย่าเอาตัวเลขจากแหล่งหนึ่งไปโชว์คู่กับของจากอีกแหล่ง" ใน CLAUDE.md) */
  const [store, setStore] = useState<StoreId>('')
  /** 📦 จัดกลุ่มตารางรายสินค้า — ผังเดียวกับ dropdown `tableoption` ของ ZORT
   *  ⚠️ `user` (ผู้ใช้งาน) ท่อตอบ ok:false เพราะกระจกใบซื้อไม่มีผู้สร้างใบ ⇒ ปิดตัวเลือกไว้พร้อมเหตุผล */
  const [by, setBy] = useState<'sku' | 'category' | 'vendor' | 'warehouse'>('sku')
  const [items, setItems] = useState<ItemsResp | null>(null)
  const [itemsErr, setItemsErr] = useState('')
  const [itemQ, setItemQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (storeId = store, byId: 'sku' | 'category' | 'vendor' | 'warehouse' = by, fromDay = from, toDay = to) => {
    setLoading(true)
    setError('')
    try {
      const st = storeId ? `&store=${storeId}` : ''
      // ใบซื้อมีหลักสิบใบ ดึงมาทั้งหมดครั้งเดียวแล้วกรองช่วงเวลาในเครื่อง
      /* 🗓️ **ตารางรายสินค้าต้องกรองช่วงเดียวกับที่จอเลือก** (ท่อรับ from/to แล้ว · e3071fb)
         ก่อนหน้านี้เส้นนี้ไม่มีตัวกรองวัน ⇒ เป็นยอดตลอดกาลเสมอ ในขณะที่กล่องสรุป/กราฟกรองตามช่วง
         ⇒ จอเดียวสองขอบเขต **โดยไม่มีอะไรบอก** (ฝั่งท่อจับได้ 16 ก.ย. 2569) */
      const range = `&from=${fromDay}&to=${toDay}`
      const [res, iRes] = await Promise.all([
        fetch(`/api/web/core?list=purchases&limit=200${st}`),
        // ⚠️ ล้มก็ไม่ทำให้ทั้งจอพัง แต่ต้องจำไว้ว่าล้มเพราะอะไร (ท่อพัง ≠ ไม่มีของ)
        fetch(`/api/web/core?list=purchaseitems&limit=200${st}${range}&by=${byId}`).then((r) => r.json()).catch(() => null),
      ])
      /* 🔴 **เส้นนี้ตอบ error เป็น HTTP 200 + ok:false** (ธรรมเนียม okJson ของท่อ)
         ⇒ ดู `ok` ไม่ใช่ status · และ **ต้องเช็คว่าท่อใช้ช่วงวัน/การจัดกลุ่มที่เราส่งไปจริง**
            ถ้าไม่ตรง แปลว่าตัวเลขที่เห็นเป็นของขอบเขตอื่น ⇒ ห้ามเอามาโชว์เฉย ๆ */
      const iOk = iRes && iRes.ok !== false && typeof iRes.error !== 'string'
      const usedFrom = iRes?.applied?.from ?? null
      const usedTo = iRes?.applied?.to ?? null
      const usedBy = iRes?.applied?.by ?? null
      const mismatch = iOk && (usedFrom !== fromDay || usedTo !== toDay || (usedBy ?? 'sku') !== byId)
      setItems(iOk && !mismatch ? iRes : null)
      setItemsErr(!iRes
        ? 'ยิงไปที่ท่อรายการสินค้าในใบซื้อไม่สำเร็จ'
        : (typeof iRes.error === 'string' && iRes.error) ? iRes.error
          : mismatch
            ? `ท่อไม่ได้ใช้เงื่อนไขที่จอส่งไป (ขอ ${fromDay}–${toDay} แบบ ${byId} · ท่อใช้ ${usedFrom ?? 'ทั้งหมด'}–${usedTo ?? 'ทั้งหมด'} แบบ ${usedBy ?? 'sku'}) ⇒ ไม่แสดงตัวเลขที่ขอบเขตไม่ตรง`
            : '')
      const j: Resp = await res.json()
      if (!res.ok || (j as { error?: string })?.error) {
        throw new Error((j as { error?: string })?.error ?? `HTTP ${res.status}`)
      }
      /* 🔴 ตอบ 200 แต่ไม่มีช่อง rows = ยังไม่รู้ ไม่ใช่ "ไม่มียอดซื้อในช่วงนี้"
         (เจอด้วยท่อปลอมโหมดตอบ {} 6 ก.ย. 2569 — จอขึ้น "ไม่มียอดซื้อ 0 ใบ" โดยไม่มีกล่องแดง) */
      /* ลำดับสำคัญ: skip (ทำต่อไม่ได้) ต้องมาก่อน "ตอบมาไม่ครบ" ไม่งั้นจอขึ้นแดงทุกครั้งที่คลังเงายังไม่พร้อม */
      if (j?.skip) throw new Error(SKIP + j.skip)
      if (!j || !('rows' in j)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายการใบซื้อ) — ยังสรุปยอดซื้อไม่ได้')
      setAll(j)
      setRows(Array.isArray(j.rows) ? j.rows : [])
    } catch (e) {
      setRows(null)
      setAll(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [store, by, from, to])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const inRange = useMemo(
    () => (rows ?? []).filter((r) => r.po_date && r.po_date >= from && r.po_date <= to),
    [rows, from, to],
  )
  const sum = inRange.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  /* 🔴 **ใบซื้อที่ยกเลิกถูกนับรวมอยู่ในยอดนี้** — และ **ZORT ไม่นับ**
     📏 อ่านจอ ZORT เอง 15 ก.ย. 2569 (`/Dashboard/BuyReport` ช่วงตั้งต้น "ย้อนหลัง 3 เดือน"):
        จอขึ้นว่า **"ไม่มียอดซื้อ"** ทั้งที่ช่วงนั้นมีใบซื้ออยู่ 1 ใบในกระจกของเรา
        คือ PO ทดสอบสถานะ Voided ยอด ฿1 ⇒ ถ้า ZORT นับใบยกเลิก จอต้องขึ้น ฿1 ไม่ใช่ "ไม่มียอดซื้อ"
     ⚠️ ที่ยังไม่ได้พิสูจน์: ช่วงที่มีทั้งใบยกเลิกและใบสำเร็จปนกัน (เปลี่ยนช่วงบนจอ ZORT ต้องกด ซึ่งห้ามกด)
     ⇒ จอเราจึง **ไม่แอบหักออกเอง** แต่ต้องเขียนกำกับว่ารวมไว้เท่าไหร่
        (กติกาเดียวกับใบยกเลิกในจอยอดขาย — ดู CLAUDE.md ข้อแท็บ) */
  const voided = inRange.filter((r) => String(r.status ?? '') === 'Voided')
  const voidedSum = voided.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  /* 🔴 **ยอดนี้บวกจากแถวที่ดึงมาได้เท่านั้น** — จอขอ limit=200
     วันนี้ใบซื้อทั้งหมด 32 ใบ จึงยังครบ แต่วันที่เกิน 200 ยอดจะน้อยกว่าจริงแบบเงียบ ๆ
     ⇒ เทียบจำนวนแถวกับตัวนับของท่อ แล้วเตือนทันทีที่ชนเพดาน ไม่ต้องรอให้มีคนสังเกต */
  const cutRows = Boolean(all && typeof all.total === 'number' && (rows?.length ?? 0) < all.total)

  const points = useMemo(() => {
    const m = new Map<string, { label: string; value: number }>()
    // เติมช่องว่างของช่วงเวลาให้ครบก่อน ไม่งั้นเดือนที่ไม่มีใบซื้อจะหายไปจากกราฟ
    const cur = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    let guard = 0
    while (cur <= end && guard++ < 400) {
      const iso = cur.toISOString().slice(0, 10)
      const b = bucketOf(iso, grain)
      if (!m.has(b.key)) m.set(b.key, { label: b.label, value: 0 })
      if (grain === 'day') cur.setDate(cur.getDate() + 1)
      else if (grain === 'month') cur.setMonth(cur.getMonth() + 1)
      else if (grain === 'quarter') cur.setMonth(cur.getMonth() + 3)
      else cur.setFullYear(cur.getFullYear() + 1)
    }
    for (const r of inRange) {
      if (!r.po_date) continue
      const b = bucketOf(r.po_date, grain)
      const slot = m.get(b.key) ?? { label: b.label, value: 0 }
      slot.value += Number(r.amount) || 0
      m.set(b.key, slot)
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v)
  }, [inRange, from, to, grain])

  const itemAll = Array.isArray(items?.rows) ? items!.rows! : []
  const itemRows = itemAll.filter((r) => {
    const s2 = itemQ.trim().toLowerCase()
    return !s2 || String(r.sku ?? '').toLowerCase().includes(s2) || (r.name ?? '').toLowerCase().includes(s2)
  })
  /** 🔴 **ท่อตัดที่ 200 แถวเสมอ ไม่ว่าจะขอเท่าไหร่** — จอนี้เคยขอ `limit=500` แล้วเชื่อว่าได้ครบ
   *  ของจริง: สรุปบอก 217 รหัส แต่ตารางมี 200 แถว **ไม่มีอะไรฟ้อง** (เจอตอนยิงจริง 4 ก.ย. 2569)
   *  ✅ **5 ก.ย. 2569 ท่อส่ง `truncated` + `total`/`shown` มาแล้ว** ⇒ อ่านจากท่อเป็นหลัก
   *     เก็บวิธีเทียบกับ `skus` ไว้เป็นทางถอยกลับ เผื่อ endpoint เก่าที่ยังไม่มีธง
   *     ⚠️ ห้ามทิ้งทางถอยกลับ — จอกับท่อ deploy คนละรอบเสมอ */
  const itemsCut = items?.truncated === true && Number(items?.total) > 0
    ? Math.max(0, Number(items.total) - Number(items.shown ?? itemAll.length))
    : Math.max(0, Number(items?.skus ?? 0) - itemAll.length)
  /** ⚠️ ฐานของคอลัมน์ % คือ **ผลรวมของแถวที่แสดงจริง** ไม่ใช่ยอดรวมในบรรทัดสรุป
   *  สองค่านี้ต่างกันเมื่อมีแถวถูกตัด ⇒ ต้องเขียนกำกับ ไม่งั้น % รวมกันไม่ครบ 100 แบบไร้คำอธิบาย */
  const itemsTotal = itemAll.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  const listed = inRange.filter((r) => {
    const s = q.trim().toLowerCase()
    return !s || String(r.number ?? '').toLowerCase().includes(s) || (r.vendor ?? '').toLowerCase().includes(s)
  })

  function downloadExcel() {
    const head = ['เลขที่ใบซื้อ', 'วันที่', 'ผู้ขาย', 'ยอดซื้อ (บาท)']
    const body = listed.map((r) => [r.number, r.po_date ?? '', r.vendor ?? '', String(r.amount ?? 0)])
    const csv = [head, ...body, ['รวม', '', '', String(sum)]]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ยอดซื้อ-${from}-ถึง-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const newest = (rows ?? []).reduce((a: string, r) => (r.po_date && r.po_date > a ? r.po_date : a), '')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ยอดซื้อ"
        actions={<BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* 🏬 เลือกร้าน — ส่งให้ทั้งตารางรายใบและตารางรายสินค้า (ยิงทั้งสองเส้นด้วย store เดียวกัน) */}
      <StorePicker value={store} disabled={loading}
        onChange={(v) => { setStore(v); load(v) }}
        note="ยอดซื้อทั้งหน้านี้เป็นของร้านที่เลือกเท่านั้น — เส้นใบซื้อตอบทีละร้าน" />

      <div className="flex flex-wrap items-center gap-3 -mt-1 mb-4">
        <p className="text-[17px] font-semibold text-gray-800">
          {thaiShort(from)} – {thaiShort(to)}
        </p>
        <button onClick={() => setAdv((v) => !v)} className="text-[13px] text-blue-600 hover:underline">
          ค้นหาขั้นสูง
        </button>
      </div>

      {adv && (
        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 mb-4 flex flex-wrap items-end gap-4">
          <label className="text-[12px] text-gray-600">
            ตั้งแต่
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); void load(store, by, e.target.value, to) }}
              className="block mt-1 text-[13px] border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          <label className="text-[12px] text-gray-600">
            ถึง
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); void load(store, by, from, e.target.value) }}
              className="block mt-1 text-[13px] border border-gray-300 rounded px-2.5 py-1.5" />
          </label>
          {/* 🗓️ ช่วงสำเร็จรูปให้ครบตามที่ ZORT มี (กดดูจอ ZORT เอง 16 ก.ย. 2569:
                 1/3/6 เดือน · 1 ปี · วันนี้ · เมื่อวานนี้ · เดือนนี้ · เดือนที่แล้ว)
                 ⚠️ ทุกปุ่มตั้งทั้ง `from` และ `to` เอง ⇒ ไม่มีปุ่มไหนที่กดแล้วได้ช่วงครึ่ง ๆ */}
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ['วันนี้', () => [todayIso(), todayIso()]],
              ['เมื่อวานนี้', () => [dayAgoIso(1), dayAgoIso(1)]],
              ['เดือนนี้', () => [monthStartIso(0), todayIso()]],
              ['เดือนที่แล้ว', () => [monthStartIso(1), monthEndIso(1)]],
              ['ย้อนหลัง 1 เดือน', () => [isoAgo(1), todayIso()]],
              ['ย้อนหลัง 3 เดือน', () => [isoAgo(3), todayIso()]],
              ['ย้อนหลัง 6 เดือน', () => [isoAgo(6), todayIso()]],
              ['ย้อนหลัง 1 ปี', () => [isoAgo(12), todayIso()]],
            ] as [string, () => [string, string]][]).map(([label, range]) => {
              const [f, t] = range()
              const on = from === f && to === t
              return (
                <button
                  key={label}
                  type="button"
                  /* 🔴 เปลี่ยนช่วงวันแล้ว **ต้องยิงใหม่** เพราะตารางรายสินค้ากรองที่เซิร์ฟเวอร์แล้ว
                     (ของเดิมกรองในเครื่องอย่างเดียวจึงไม่ต้องยิง — ลืมข้อนี้จะได้ตารางของช่วงก่อน) */
                  onClick={() => { setFrom(f); setTo(t); void load(store, by, f, t) }}
                  className={`text-[12px] rounded-full px-2.5 py-1 border ${
                    on ? 'bg-[#eef1fa] border-[#4669e5] text-[#2b3f9e] font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {cutRows && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔴 <b>ใบซื้อถูกตัด</b> — ท่อบอกว่ามี {fmtNum(Number(all?.total) || 0)} ใบ แต่จอดึงมาได้ {fmtNum(rows?.length ?? 0)} ใบ
          {' '}⇒ <b>ยอดรวมและกราฟด้านล่างยังไม่ครบ</b> อย่าเพิ่งเอาไปตัดสินใจ
        </div>
      )}

      {error && <ErrorBox title="ดึงยอดซื้อไม่ได้">{error}</ErrorBox>}
      {loading && !rows && <LoadingState />}

      {rows && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[15px]">🛒</span>
                <p className="text-[15px] font-semibold text-gray-900">สรุปยอดซื้อ</p>
              </div>
              <div className="flex flex-col items-center justify-center py-12">
                {sum > 0
                  ? (
                    <p className="text-[32px] font-semibold text-blue-600 leading-none">
                      {fmtMoney(sum)}<span className="text-[15px] text-gray-500 font-normal"> บาท</span>
                    </p>
                  )
                  : <p className="text-[30px] font-bold text-blue-600 leading-none">ไม่มียอดซื้อ</p>}
                <p className="text-[12px] text-gray-500 mt-2">
                  {fmtNum(inRange.length)} ใบ ในช่วงที่เลือก
                </p>
                <button onClick={downloadExcel}
                  className="mt-5 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-300 rounded px-3.5 py-1.5 hover:bg-gray-50">
                  Download Excel
                </button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-[15px]">📈</span>
                  <p className="text-[15px] font-semibold text-gray-900">รายงาน</p>
                </div>
                {/* ZORT มีตัวเลือกชนิดรายงานตรงนี้ — ของเรามีข้อมูลชนิดเดียวจริง ๆ จึงมีตัวเดียว
                    ⚠️ ใส่ตัวเลือกที่เลือกแล้วไม่เปลี่ยนอะไร = ปุ่มหลอก */}
                <span className="text-[12.5px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5">ยอดซื้อรวม</span>
              </div>
              <BuyChart points={points} />
              <div className="flex items-center justify-end gap-1 mt-2">
                {GRAINS.map((g) => (
                  <button key={g.id} onClick={() => setGrain(g.id)}
                    className={`text-[12px] px-2.5 py-1 rounded border ${
                      grain === g.id ? 'border-gray-400 text-gray-900 font-semibold underline' : 'border-gray-200 text-gray-500'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* ⚠️ กล่องนี้คือส่วนที่กัน "ว่าง = ไม่เคยซื้อของ" — ห้ามถอด */}
          {sum === 0 && (all?.total ?? 0) > 0 && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
              ช่วงที่เลือกไม่มีใบซื้อ <b>แต่ไม่ได้แปลว่าร้านไม่เคยซื้อของ</b> — ในคลังเงามีใบซื้อทั้งหมด
              <b> {fmtNum(all?.total ?? 0)} ใบ</b>
              {/* 🔴 **ยอดรวมที่ท่อไม่ได้ส่งมา ห้ามเขียนว่า "รวม 0 บาท"** (เจอตอนกวาดจริง 14 ก.ย. 2569)
                  กล่องนี้มีไว้บอกว่า "ร้านเคยซื้อของนะ" ⇒ ถ้าเติม 0 ลงไปด้วย มันจะกลายเป็น
                  "เคยซื้อ 2 ใบ มูลค่ารวมศูนย์บาท" ซึ่งเป็นคนละเรื่องและไม่มีอะไรฟ้อง
                  ⚠️ โรคเดียวกับจอการเงินที่บวกแถวว่างแล้วบอกว่ารายรับศูนย์บาท */}
              {typeof all?.amount === 'number'
                ? <> รวม <b>{fmtMoney(all.amount)} บาท</b></>
                : <> (<b>ยังไม่รู้ยอดรวม</b> — ท่อไม่ได้ส่งมา ไม่ใช่ว่าเป็นศูนย์)</>}
              {newest && <> · ใบล่าสุด <b>{thaiDate(newest)}</b></>} ⇒ กด <b>ค้นหาขั้นสูง</b> แล้วขยายช่วงเวลา
            </div>
          )}

          {/* ── ตารางยอดซื้อรายสินค้าแบบ ZORT ── */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 mr-auto">
                <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-[15px]">📊</span>
                <p className="text-[15px] font-semibold text-gray-900">ยอดซื้อ รายสินค้า</p>
              </div>
              {/* 📦 dropdown จัดกลุ่ม — ผังเดียวกับ `tableoption` ของ ZORT
                     (สินค้า · หมวดหมู่ · ผู้ติดต่อ · ผู้ใช้งาน · คลัง/สาขา)
                     🔴 "ผู้ใช้งาน" ปิดไว้พร้อมเหตุผล — ท่อตอบ ok:false ว่ากระจกใบซื้อไม่ได้เก็บผู้สร้างใบ
                        (เปิดให้เลือกแล้วขึ้นแดงทีหลัง = ปุ่มหลอก) */}
              <select
                value={by}
                onChange={(e) => {
                  const v = e.target.value as 'sku' | 'category' | 'vendor' | 'warehouse'
                  setBy(v); void load(store, v)
                }}
                className="text-[12.5px] border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
              >
                <option value="sku">สินค้า</option>
                <option value="category">หมวดหมู่</option>
                <option value="vendor">ผู้ติดต่อ</option>
                <option value="warehouse">คลัง/สาขา</option>
                <option value="user" disabled>ผู้ใช้งาน (กระจกใบซื้อไม่เก็บผู้สร้างใบ)</option>
              </select>
              <input value={itemQ} onChange={(e) => setItemQ(e.target.value)} placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]" />
            </div>

            {/* 🔴 **ป้ายบอกขอบเขตของตารางทั้งใบ ต้องอยู่เหนือตาราง** (ย้ายขึ้นมา 12 ก.ย. 2569)
                เดิมอยู่ใต้ตาราง (ซึ่งยาวได้ถึง 200 แถว) ⇒ คนเลือกช่วงวันที่ไว้ข้างบน
                แล้วอ่านตารางนี้ว่าเป็นของช่วงนั้น — ผิดทั้งใบ โดยไม่มีอะไรดูขัดตา
                กฎที่ CEO ยกขึ้นเป็นกติกา 12 ก.ย.: ป้ายขอบเขตมาก่อนตัวเลข ·
                รายละเอียดวิธีคิด (เช่น "ที่ขาดคือรหัสยอดน้อยสุด") ปล่อยไว้ท้ายตารางได้ */}
            {items && (
              <p className="text-[12.5px] text-amber-900 bg-amber-50 border-y border-amber-300 px-4 py-2.5 leading-relaxed">
                {/* 🔄 **ข้อความนี้เคยเขียนว่า "ตารางนี้เป็นยอดทุกช่วงเวลา ไม่ได้ขยับตามช่วงวันที่"**
                       ซึ่งจริงตอนนั้น (ท่อไม่รับ from/to) แต่ **16 ก.ย. 2569 ท่อรับแล้ว** (gucut-web e3071fb)
                       ⇒ ถ้าปล่อยไว้จะกลายเป็นคำโกหกทันที · ตอนนี้ตารางนี้กรองช่วงเดียวกับหัวจอแล้ว
                       (ป้ายวันจริงมาจาก `dateScope` ของท่อ อยู่ใต้บรรทัดนี้) */}
                📦 ในช่วงที่เลือก: รวม <b>{fmtNum(items.skus ?? 0)}</b> {by === 'sku' ? 'รหัส' : 'กลุ่ม'}
                จาก <b>{fmtNum(items.lines ?? 0)}</b> บรรทัด เป็นเงิน <b>{fmtMoney(items.amount ?? 0)}</b> บาท
                {typeof all?.amount === 'number' && Math.abs((items.amount ?? 0) - all.amount) > 1 && (
                  <>
                    {' '}· ต่างจากยอดรวมใบซื้อในหัวจอ <b>{fmtMoney(Math.abs(all.amount - (items.amount ?? 0)))}</b> บาท
                    {/* 🔴 สองยอดนี้คิดคนละชั้น — เขียนไว้ ไม่ใช่ปล่อยให้คนคิดว่าตัวใดตัวหนึ่งผิด */}
                    <br /><span className="text-gray-500">
                      ยอดตารางนี้คิดจาก<b>บรรทัดสินค้า</b> · ยอดในหัวจอคิดจาก<b>หัวใบ</b>
                      {' '}⇒ ต่างกันได้เมื่อบางใบไม่มีรายการสินค้าแนบมา หรือหัวใบมีค่าใช้จ่ายอื่นรวมอยู่
                    </span>
                  </>
                )}
              </p>
            )}

            {/* 🏬 ขอบเขตร้านของ **ตารางรายสินค้า** — อ่านจากคำตอบ `list=purchaseitems` (`items`) เท่านั้น
                🔴 **แก้ความผิดพลาดของผมเอง 15 ก.ย. 2569 (ใบ t_mu2lhpff)**
                   รอบก่อน (c092304) ผมวาง `all?.storeScope` (มาจาก `list=purchases`) ไว้ตรงนี้
                   ทั้งที่ตารางข้างล่างนี้เป็น **ตารางรายสินค้า** ที่มาจากอีกเส้นหนึ่ง
                   ⇒ เป็นการ **ยืมป้ายข้ามคำตอบ** ซึ่งเป็นสิ่งที่ตัวเองเขียนห้ามไว้ในคอมเมนต์เดียวกัน
                   ⇒ ตอนนั้น `purchaseitems` ยังไม่ส่งช่องนี้ ป้ายจึง "ดูถูก" เพราะสองเส้นเป็น z1 พอดี
                      **นั่นคืออาการที่อันตรายที่สุด — ถูกด้วยความบังเอิญ**
                   ⇒ ตอนนี้ท่อส่งแล้ว (gucut-web ab69ec5) จึงอ่านของตัวเองได้ตรง ๆ
                ⚠️ ไม่มีช่อง = ไม่แสดง · ห้ามยืมจากเส้นอื่นแม้จะเป็นเรื่องซื้อเหมือนกัน */}
            <StoreScopeLine scope={items?.storeScope} />
            {/* 🗓️ **ขอบเขตวันของตารางนี้ มาจากท่อ (`dateScope`) ไม่ใช่จอเขียนเอง**
                   เพราะบั๊กที่เพิ่งแก้คือ "ตารางนี้เป็นยอดตลอดกาลทั้งที่จอเลือกช่วงไว้"
                   ⇒ ให้ท่อเป็นคนบอกว่ากรองด้วยวันอะไร จะได้ไม่มีวันหลุดอีก */}
            {items?.dateScope && (
              <p className="text-[11.5px] text-gray-500 px-4 md:px-5 pb-1">🗓️ {items.dateScope}</p>
            )}

            <TableWrap>
              <table className="w-full min-w-[760px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    {/* หัวคอลัมน์เปลี่ยนตามการจัดกลุ่ม — ไม่งั้นคนอ่านว่า "รหัสสินค้า" แต่เห็นชื่อหมวด */}
                    <th className={TH}>{
                      by === 'sku' ? 'รหัสสินค้า'
                        : by === 'category' ? 'หมวดหมู่'
                          : by === 'vendor' ? 'ผู้ติดต่อ (ผู้ขาย)' : 'คลัง / สาขา'
                    }</th>
                    <th className={TH}>{by === 'sku' ? 'สินค้า' : 'จำนวนรหัสในกลุ่ม'}</th>
                    <th className={THR}>จำนวน</th>
                    <th className={THR}>ยอดซื้อ (บาท)</th>
                    <th className={THR}>ยอดซื้อ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length === 0 && (
                    <EmptyState
                      cols={5}
                      icon={itemsErr ? '⚠️' : '📦'}
                      title={itemsErr ? 'ดึงรายการสินค้าในใบซื้อไม่ได้' : 'ไม่มีข้อมูล'}
                      detail={itemsErr
                        ? `ตารางนี้ว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่เคยซื้อสินค้า — ${itemsErr}`
                        : (itemQ ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีรายการสินค้าในใบซื้อ')} />
                  )}
                  {itemRows.map((r) => (
                    /* 🔴 โหมดจัดกลุ่ม (by≠sku) ท่อส่ง `groupKey` มาแทนรหัส/ชื่อ
                       ⇒ คอลัมน์แรกต้องเปลี่ยนความหมายด้วย ไม่ใช่โชว์ช่องว่างเพราะไม่มี `sku` */
                    <tr key={r.sku ?? r.groupKey} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} ${by === 'sku' ? 'text-blue-600' : 'text-gray-700'} whitespace-nowrap`}>
                        {by === 'sku' ? r.sku : (r.groupKey || '—')}
                      </td>
                      <td className={TD}>
                        {by === 'sku' && r.sku
                          ? (
                            <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                              {r.name || '—'}
                            </Link>
                          )
                          : (
                            <span className="text-gray-500">
                              {typeof r.skus === 'number' ? `${fmtNum(r.skus)} รหัสสินค้าในกลุ่มนี้` : '—'}
                            </span>
                          )}
                        {r.lastDate && (
                          <span className="block text-[11px] text-gray-400">
                            ซื้อล่าสุด {thaiDate(r.lastDate)}{r.orders ? ` · ${fmtNum(r.orders)} ใบ` : ''}
                          </span>
                        )}
                      </td>
                      <td className={TDR}>{fmtNum(Number(r.qty ?? 0))}</td>
                      <td className={TDR}>{fmtMoney(Number(r.amount ?? 0))}</td>
                      <td className={TDR}>
                        {itemsTotal > 0 ? `${((Number(r.amount ?? 0) / itemsTotal) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            {/* 🔴 **ห้ามตัดแถวเงียบ** — บรรทัดสรุปข้างบนบอก 217 รหัส แต่ตารางมี 200 แถว
                บรรทัดสรุปที่ถูก + ตารางที่ไม่ครบ = อ่านแล้วเข้าใจผิดว่าเห็นครบทุกรหัสแล้ว
                ซึ่งอันตรายกว่าตัวเลขผิดตรง ๆ เพราะไม่มีอะไรดูขัดตา
                ✅ ตอนนี้ท่อส่ง `truncated` มาเองแล้ว ⇒ อ่านจากท่อก่อน แล้วค่อยถอยไปเทียบ `skus` */}
            {itemsCut > 0 && (
              <p className="text-[12px] text-gray-600 bg-gray-50 border-t border-gray-200 px-4 py-2.5 leading-relaxed">
                ตารางนี้แสดง <b>{fmtNum(itemAll.length)}</b> จาก <b>{fmtNum(Number(items?.skus ?? 0))}</b> รหัส
                — ขาดอีก <b>{fmtNum(itemsCut)}</b> รหัส เป็นเงิน{' '}
                <b>{fmtMoney(Math.max(0, Number(items?.amount ?? 0) - itemsTotal))}</b> บาท
                (ท่อคืนได้สูงสุด 200 แถวต่อครั้ง · ที่ขาดคือรหัสที่ยอดเงินน้อยที่สุด) ·
                คอลัมน์ <b>%</b> คิดจากผลรวมของ <b>แถวที่แสดงจริง</b> ไม่ใช่ยอดรวมในบรรทัดข้างบน
              </p>
            )}
          </Card>

          {/* ── ตารางรายใบซื้อ (ของเราเอง ZORT ไม่มีจอนี้) ── */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 mr-auto">
                <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-[15px]">🧾</span>
                <p className="text-[15px] font-semibold text-gray-900">ยอดซื้อ รายใบ</p>
              </div>
              {/* ZORT ให้เลือกดูรายสินค้า/รายผู้ขาย — เรามีแค่รายใบซื้อจริง ๆ จึงเขียนตามที่มี */}
              <span className="text-[12.5px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5">รายใบซื้อ</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์คำค้นหา"
                className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[200px]" />
            </div>

            {/* 🏬 ขอบเขตร้านของ **ตารางรายใบซื้อ** — อ่านจากคำตอบ `list=purchases` (`all`)
                คนละคำตอบกับตารางรายสินค้าข้างบน ⇒ แต่ละตารางถือป้ายของตัวเอง */}
            <StoreScopeLine scope={all?.storeScope} />

            {/* 🔴 **สองตารางในหน้านี้นับใบยกเลิกไม่เหมือนกัน — ต้องเขียน ห้ามวางคู่กันเฉย ๆ**
                   · ตารางรายสินค้า (`list=purchaseitems`) ตัดใบยกเลิกออกแล้ว ถ้าท่อส่ง `excludesCancelled: true`
                   · ตารางรายใบ (`list=purchases`) **ยังรวมใบยกเลิก** ตามแท็บของ ZORT (ฝั่งท่อตั้งใจ)
                   ⇒ ผลต่างระหว่างสองตาราง = ยอดของใบยกเลิกพอดี · ไม่เขียนไว้ คนจะนึกว่าตัวใดตัวหนึ่งผิด
                   (กติกาข้อ 4 เรื่องแท็บใน CLAUDE.md: เลขจากคนละแหล่งห้ามวางคู่กันโดยไม่บอกว่าต่างตรงไหน) */}
            {voided.length > 0 && (
              <p className="mx-4 md:mx-5 mb-2 text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 leading-relaxed">
                ⚠️ ตารางนี้ <b>รวมใบซื้อที่ยกเลิกไว้ {fmtNum(voided.length)} ใบ</b> (รวม {fmtMoney(voidedSum)} บาท)
                {' '}— ตามแท็บของ ZORT ที่รวมใบยกเลิกไว้เหมือนกัน
                {items?.excludesCancelled
                  ? <><br />⇒ แต่ <b>ตารางรายสินค้าข้างบนไม่นับใบยกเลิก</b> (เหมือนรายงานยอดซื้อของ ZORT)
                    {' '}⇒ <b>สองตารางจะต่างกันเท่ากับยอดนี้พอดี</b> ไม่ใช่ตัวใดตัวหนึ่งผิด</>
                  : <><br />⇒ และ<b>ตารางรายสินค้าข้างบนก็ยังนับรวมอยู่</b> ⇒ ยอดของเรา<b>สูงกว่ารายงานยอดซื้อของ ZORT</b>
                    {' '}ซึ่งไม่นับใบยกเลิก (อ่านจอ ZORT เทียบเองแล้ว 15 ก.ย. 2569)</>}
              </p>
            )}

            <TableWrap>
              <table className="w-full min-w-[720px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>เลขที่ใบซื้อ</th>
                    <th className={TH}>ผู้ขาย</th>
                    <th className={TH}>วันที่</th>
                    <th className={THR}>ยอดซื้อ (บาท)</th>
                    <th className={THR}>ยอดซื้อ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.length === 0 && (
                    <EmptyState cols={5} icon="🧾" title="ไม่มีข้อมูล"
                      detail={q ? 'ไม่พบใบซื้อที่ค้นหาในช่วงเวลานี้' : 'ช่วงเวลาที่เลือกไม่มีใบซื้อ — ลองขยายช่วงที่ค้นหาขั้นสูง'} />
                  )}
                  {listed.map((r) => (
                    <tr key={r.number} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} text-blue-600 whitespace-nowrap`}>{r.number}</td>
                      <td className={TD}>{r.vendor || <span className="text-gray-400">-</span>}</td>
                      <td className={`${TD} text-gray-600 whitespace-nowrap`}>{r.po_date ? thaiDate(r.po_date) : '-'}</td>
                      <td className={TDR}>{fmtMoney(Number(r.amount) || 0)}</td>
                      <td className={TDR}>{sum > 0 ? `${(((Number(r.amount) || 0) / sum) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ZORT มีเฉพาะตาราง<b>รายสินค้า</b> · ตาราง<b>รายใบ</b> เป็นของเพิ่มของเราเอง
            เพราะช่วงเวลาที่เลือกด้านบนมีผลกับตารางนั้นจริง (ตารางรายสินค้ายังไม่ขยับตามช่วงเวลา)
          </p>
        </>
      )}
    </div>
  )
}
