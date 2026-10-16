'use client'
/* 📈 กราฟเส้นรายหมวดตามช่วงเวลา — ตัวเดียวใช้ทั้ง "ยอดขายตามหมวดหมู่" และ "ยอดซื้อตามหมวดหมู่" (ใบงาน t_mvb7r7zc)
 *
 * ผัง ZORT (อ่านจอจริง 16 ต.ค. 2569 · /Dashboard/SalesReport typeoption=2 · /Dashboard/BuyReport typeoption=1):
 *   เส้นหนึ่งเส้นต่อหนึ่งหมวด · คำอธิบายเส้นแบ่งหน้า (◀ 1/13 ▶) · แกนนอนเป็นช่วงเวลา · ติดลบได้วันที่มีใบคืน
 *
 * 🔑 แหล่งข้อมูลสองชั้น — ประกาศบนจอเสมอว่าใช้ชั้นไหน
 *   ① เส้น `series=` ของท่อ (ขอไว้ ใบ t_mvb742yz) — ใช้เมื่อท่อสะท้อน `applied.series` กลับมาตรงกับที่ขอเท่านั้น
 *   ② ระหว่างรอ: ประกอบรายเดือนเองจาก `by=category` ทีละเดือน (เส้นที่มีอยู่แล้ว) — จำกัด 12 เดือน
 *      🔴 ห้ามประกอบรายวันเอง: 90 วัน = 90 คำขอ ⇒ ไม่ทำ · บอกบนจอว่ารายวันรอท่อ
 *   ⚠️ รูปข้อมูลของสองจอไม่เหมือนกัน (ขาย: items[].category · ซื้อ: rows[].groupKey) ⇒ แปลงที่ตัวโหลดที่เดียว
 *      เพื่อให้ตัววาดเห็นรูปเดียว — ท่อรับปากว่า series= จะคืนรูปเดียวกันทั้งสองเส้น (16 ต.ค. 2569)
 */
import { useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'

export interface SeriesRow { period: string; category: string; amount: number | null }
export type SeriesKind = 'sales' | 'buy'
export interface SeriesResult {
  rows: SeriesRow[]
  periods: string[]
  /** ชั้นข้อมูลที่ได้มาจริง — เขียนบนจอ */
  source: 'series' | 'monthly-assembled'
  /** ป้ายขอบเขตของท่อ (seriesScope) — ขึ้นจอตรง ๆ ไม่เขียนเอง */
  scope?: string
}

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const เดือนไทย = (ym: string) => `${TH_M[Number(ym.slice(5, 7)) - 1] ?? ym}/${Number(ym.slice(0, 4)) + 543}`
/** เพดานที่จอยอมประกอบเอง — เกินนี้ต้องรอเส้น series ของท่อ */
const เพดานเดือน = 12

/** รายชื่อเดือน YYYY-MM ที่ช่วง from..to แตะ */
function เดือนในช่วง(from: string, to: string): string[] {
  const out: string[] = []
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7))
  const yEnd = Number(to.slice(0, 4)), mEnd = Number(to.slice(5, 7))
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1; if (m > 12) { m = 1; y += 1 }
    if (out.length > 240) break
  }
  return out
}
const สิ้นเดือน = (ym: string) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function ฐานURL(kind: SeriesKind, store: string) {
  const st = store ? `&store=${encodeURIComponent(store)}` : ''
  return kind === 'sales' ? `/api/web/core?list=topproducts&by=category${st}` : `/api/web/core?list=purchaseitems&by=category${st}`
}
/** แปลงแถวของทั้งสองเส้นให้เป็นรูปเดียว — ที่เดียวในระบบที่รู้ว่าสองเส้นคืนชื่อช่องต่างกัน */
function แถวหมวด(kind: SeriesKind, r: Record<string, unknown>): { category: string; amount: number | null } | null {
  const cat = kind === 'sales' ? r.category : r.groupKey
  if (typeof cat !== 'string') return null
  return { category: cat.trim() || '(ยังไม่ได้จัดหมวดใน ZORT)', amount: typeof r.amount === 'number' ? r.amount : null }
}

/** ดึงยอดรายหมวดของหนึ่งช่วง ไล่ nextOffset จนจบ (ไม่ส่ง limit เอง) · ตรวจว่าท่อใช้ช่วงที่ขอจริง */
async function ดึงช่วง(kind: SeriesKind, store: string, from: string, to: string) {
  const out: { category: string; amount: number | null }[] = []
  let off = 0
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${ฐานURL(kind, store)}&from=${from}&to=${to}&offset=${off}`).then((x) => x.json())
    const list = kind === 'sales' ? r?.items : r?.rows
    if (!r || r.ok === false || !Array.isArray(list)) throw new Error('ระบบหลังบ้านตอบผิดพลาดรอบนี้')
    /* ช่วงที่ท่อใช้จริง: ยอดซื้อสะท้อนใน applied.from/to · ยอดขาย (topproducts) สะท้อนที่ระดับบน from/to ⇒ อ่านได้ทั้งสองที่ */
    const ใช้from = r.applied?.from ?? r.from, ใช้to = r.applied?.to ?? r.to
    if (ใช้from !== from || ใช้to !== to) throw new Error('ระบบหลังบ้านไม่ได้ใช้ช่วงวันที่ขอ — ไม่วาดเพื่อไม่ให้ผิดช่วง')
    for (const x of list) { const y = แถวหมวด(kind, x); if (y) out.push(y) }
    if (typeof r.nextOffset !== 'number') return out
    off = r.nextOffset
  }
  throw new Error('ไล่หน้าเกิน 20 รอบยังไม่จบ — ไม่วาดเพื่อไม่ให้ขาดหมวด')
}

/** ตัวโหลด — ลองเส้น series ก่อน ไม่ได้ค่อยประกอบรายเดือนเอง */
export function useCategorySeries(kind: SeriesKind, from: string, to: string, store: string, enabled: boolean) {
  const [data, setData] = useState<SeriesResult | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!enabled || !from || !to) return
    let ยกเลิก = false
    setData(null); setErr('')
    ;(async () => {
      /* ① เส้น series ของท่อ — เชื่อเมื่อ applied.series === 'month' เท่านั้น (ท่อรุ่นที่ยังไม่รู้จักจะเมินพารามิเตอร์เงียบ) */
      try {
        /* 📜 สัญญาที่ท่อประกาศ (17 ต.ค. 2569 00:02): คืน `series: [{period, category, amount, qty}]` รูปเดียวกันทั้งขาย/ซื้อ
           period = "YYYY-MM" เมื่อ series=month · ช่วงที่ไม่มียอดไม่มีแถว ⇒ จอเติมช่องเอง (periods มาจากช่วงที่ขอ ไม่ใช่จากแถว)
           ยังไม่หักใบคืนรายบรรทัด ⇒ เส้นไม่ติดลบแบบ ZORT (ท่อประกาศใน seriesScope · จอเขียนบอก) */
        const r = await fetch(`${ฐานURL(kind, store)}&series=month&from=${from}&to=${to}`).then((x) => x.json())
        if (r?.applied?.series === 'month' && Array.isArray(r.series)) {
          const ใช้from = r.applied.from ?? r.from, ใช้to = r.applied.to ?? r.to
          if (ใช้from !== from || ใช้to !== to) throw new Error('ระบบหลังบ้านไม่ได้ใช้ช่วงวันที่ขอ — ไม่วาดเพื่อไม่ให้ผิดช่วง')
          const rows: SeriesRow[] = r.series
            .filter((x: { period?: unknown; category?: unknown }) => typeof x?.period === 'string' && typeof x?.category === 'string')
            .map((x: { period: string; category: string; amount?: unknown }) => ({
              period: x.period.slice(0, 7),
              category: x.category.trim() || '(ยังไม่ได้จัดหมวดใน ZORT)',
              amount: typeof x.amount === 'number' ? x.amount : null,
            }))
          if (!ยกเลิก) setData({ rows, periods: เดือนในช่วง(from, to), source: 'series', scope: typeof r.seriesScope === 'string' ? r.seriesScope : '' })
          return
        }
      } catch { /* ถอยไปประกอบเอง */ }
      /* ② ประกอบรายเดือนเอง */
      const เดือน = เดือนในช่วง(from, to)
      if (เดือน.length > เพดานเดือน) throw new Error(`ช่วงที่เลือกยาว ${เดือน.length} เดือน — จอประกอบเองได้ไม่เกิน ${เพดานเดือน} เดือน ต้องรอระบบหลังบ้านส่งข้อมูลตามช่วงเวลา`)
      const ผล = await Promise.all(เดือน.map((m) => {
        const f = `${m}-01` < from ? from : `${m}-01`
        const t = สิ้นเดือน(m) > to ? to : สิ้นเดือน(m)
        return ดึงช่วง(kind, store, f, t).then((rs) => rs.map((x) => ({ period: m, ...x })))
      }))
      if (!ยกเลิก) setData({ rows: ผล.flat(), periods: เดือน, source: 'monthly-assembled' })
    })().catch((e) => { if (!ยกเลิก) setErr(String(e instanceof Error ? e.message : e)) })
    return () => { ยกเลิก = true }
  }, [kind, from, to, store, enabled])
  return { data, err }
}

const สี = ['#8ea8f8', '#f2938c', '#5cc8a8', '#f5b84d', '#b48cf2', '#6bc5e8', '#e88cc6', '#9ca3af']
/** จำนวนหมวดต่อหน้าของคำอธิบายเส้น — ZORT แสดงสามชื่อต่อหน้า (ภาพจอ: 1/13 · 1/12) */
const ต่อหน้า = 3

export default function CategorySeriesChart({ data, err, unit = 'บาท' }: { data: SeriesResult | null; err: string; unit?: string }) {
  const [หน้า, setหน้า] = useState(0)
  if (err) return <p className="text-[12.5px] text-gray-500 py-6">ยังแสดงไม่ได้ — {err}</p>
  if (!data) return <p className="text-[12.5px] text-gray-400 py-6">กำลังรวมยอดตามหมวด…</p>
  /* เรียงหมวดตามยอดรวมทั้งช่วงมาก→น้อย ⇒ หน้าแรกของคำอธิบายเส้นคือหมวดใหญ่สุด */
  const รวม = new Map<string, number>()
  for (const r of data.rows) รวม.set(r.category, (รวม.get(r.category) ?? 0) + (r.amount ?? 0))
  const หมวด = Array.from(รวม.keys()).sort((a, b) => (รวม.get(b) ?? 0) - (รวม.get(a) ?? 0))
  const หน้าทั้งหมด = Math.max(1, Math.ceil(หมวด.length / ต่อหน้า))
  const pg = Math.min(หน้า, หน้าทั้งหมด - 1)
  const บนหน้า = หมวด.slice(pg * ต่อหน้า, (pg + 1) * ต่อหน้า)
  const ค่า = (cat: string, p: string) => {
    const xs = data.rows.filter((r) => r.category === cat && r.period === p)
    if (xs.some((x) => x.amount === null)) return null
    return xs.reduce((a, x) => a + (x.amount ?? 0), 0)
  }
  const ทุกค่า = บนหน้า.flatMap((c) => data.periods.map((p) => ค่า(c, p) ?? 0))
  const สูง = Math.max(1, ...ทุกค่า), ต่ำ = Math.min(0, ...ทุกค่า)
  const W = 460, H = 180, padL = 46, padR = 30, padY = 18
  const n = data.periods.length
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1))
  const y = (v: number) => H - padY - ((v - ต่ำ) / (สูง - ต่ำ || 1)) * (H - padY * 2)
  const ย่อ = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} ล.` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)))
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] mb-1">
        {บนหน้า.map((c, i) => (
          <span key={c} className="min-w-0 truncate max-w-[200px]" title={c}>
            <span className="inline-block w-3 h-0.5 align-middle mr-1" style={{ background: สี[(pg * ต่อหน้า + i) % สี.length] }} />{c}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-gray-500">
          <button type="button" disabled={pg <= 0} onClick={() => setหน้า(pg - 1)} className="px-1 disabled:opacity-30" aria-label="หมวดก่อนหน้า">◀</button>
          {pg + 1}/{หน้าทั้งหมด}
          <button type="button" disabled={pg >= หน้าทั้งหมด - 1} onClick={() => setหน้า(pg + 1)} className="px-1 disabled:opacity-30" aria-label="หมวดถัดไป">▶</button>
        </span>
      </div>
      {หมวด.length === 0 ? (
        <p className="text-[12.5px] text-gray-400 py-6">ช่วงนี้ไม่มียอดในหมวดใดเลย</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`กราฟรายหมวด หน้า ${pg + 1}`}>
          <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#e5e7eb" />
          {บนหน้า.map((c, i) => {
            const pts = data.periods.map((p, k) => { const v = ค่า(c, p); return v === null ? null : `${x(k).toFixed(1)},${y(v).toFixed(1)}` })
            /* เดือนที่ไม่รู้ยอด (null) ⇒ ตัดเส้นตรงนั้น ไม่ลากผ่านเป็น 0 */
            const segs: string[][] = [[]]
            for (const pt of pts) { if (pt === null) segs.push([]); else segs[segs.length - 1].push(pt) }
            return segs.filter((s) => s.length).map((s, j) => (
              <polyline key={`${c}-${j}`} points={s.join(' ')} fill="none" stroke={สี[(pg * ต่อหน้า + i) % สี.length]} strokeWidth="2" />
            ))
          })}
          {data.periods.map((p, k) => (
            <text key={p} x={x(k)} y={H - 4} textAnchor="middle" className="fill-gray-400 text-[10px]">{เดือนไทย(p)}</text>
          ))}
          <text x={2} y={y(สูง) + 4} className="fill-gray-400 text-[10px]">{ย่อ(สูง)}</text>
          {ต่ำ < 0 && <text x={2} y={y(ต่ำ) + 4} className="fill-gray-400 text-[10px]">{ย่อ(ต่ำ)}</text>}
        </svg>
      )}
      <p className="text-center text-[11px] text-gray-400">ช่วงเวลา</p>
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        {data.source === 'series'
          ? `ข้อมูลรายหมวดตามช่วงเวลาจากระบบหลังบ้าน${data.scope ? ` · ${data.scope.replace(/\*\*/g, '')}` : ''}`
          : `จอประกอบรายเดือนเองจากยอดรายหมวดทีละเดือน (${data.periods.length} เดือน) · รายวัน/ไตรมาส/ปี รอระบบหลังบ้าน`}
        {' '}· ยังไม่หักใบคืน ⇒ เส้นไม่ติดลบแบบ ZORT (ไม่ได้แปลว่าไม่มีใบคืน)
        {' '}· แสดงทีละ {ต่อหน้า} หมวด เรียงยอดรวมมาก→น้อย · หน่วย{unit}
        {' '}· รวมหน้านี้ {fmtMoney(บนหน้า.reduce((a, c) => a + (รวม.get(c) ?? 0), 0))}
      </p>
    </div>
  )
}
