'use client'
// กระจกครบไหม (รายเดือน) — 9 ก.ย. 2569
// เกิดจากบทเรียนจริง: เทียบยอดรายวันเทียบแค่ "เมื่อวาน" ⇒ เดือนที่หายทั้งเดือนไม่มีอะไรฟ้องเลย
// (เจอ 21 เดือนหายจากกระจกโดยไม่มีตัวตรวจไหนเห็น — วันที่เขียนจอนี้เหลือ 2 เดือน)
//
// ⚠️ ข้อจำกัดที่ต้องเขียนบนจอ ไม่ใช่ซ่อนไว้ในคอมเมนต์:
//   จอนี้ตอบได้ข้อเดียว = "กระจกของเรามีใบของเดือนนั้นไหม"
//   ✅ **ขาที่สองมาแล้ว 9 ก.ย. 2569** (ท่อเปิด ?zortmonthly=) — กดปุ่ม "ถาม ZORT" ในแถวนั้น
//   แล้วจอตัดสินได้จริงว่าเดือนที่ว่างคือ "ZORT ไม่มีใบจริง" หรือ "เรายังไม่ได้กวาด"
//   กฎ three-states-not-two: ว่างเพราะไม่มีของ ≠ ว่างเพราะยังไม่เคยถาม ≠ ถามแล้วไม่ได้คำตอบ
// ⚠️ ตัวเลขฝั่ง ZORT **ยังไม่หักใบยกเลิก** ส่วนกระจกเราหักแล้ว ⇒ ไม่ต้องเท่ากันเป๊ะ
//    สิ่งที่ตัดสินได้จริงคือ 0 กับ ไม่ใช่ 0
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR } from '@/components/zort'

interface Month { ym: string; orders: number; sales: number }
interface Resp {
  ok?: boolean; store?: string; from?: string; to?: string
  months?: Month[]; totalOrders?: number; totalSales?: number
  error?: string; skip?: string
}

/* เพดานที่ **ขอ** จากท่อ — ท่อขยายเป็น 120 เดือนแล้ว (2d6bfea 9 ก.ย. 2569)
   ⚠️ ขอเกินที่ท่อรับได้ไม่พัง — ท่อ clamp ให้เอง และจอเขียนบนหน้าจอว่า "ขอ X · ท่อตอบ Y"
      ⇒ push จอก่อนท่อก็ยังปลอดภัย (ได้ 36 เดือนเหมือนเดิมพร้อมข้อความบอกตามจริง) */
const MONTH_CAP = 120
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const thaiYm = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${TH_MONTH[m - 1] ?? m} ${(y + 543) % 100}`
}

/** ไล่เดือนตามปฏิทินจาก from → to แล้วเติมเดือนที่ท่อไม่ส่งแถวมาให้เห็นเป็นช่องว่าง
 *  (SQL GROUP BY ไม่คืนแถวของเดือนที่ไม่มีข้อมูล — เดือนหายจึงหายไปจากจอเงียบ ๆ ถ้าไม่เติมเอง) */
function fill(from: string, to: string, rows: Month[]): Array<Month & { missing: boolean }> {
  const have = new Map(rows.map((r) => [r.ym, r]))
  const out: Array<Month & { missing: boolean }> = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [ey, em] = to.slice(0, 7).split('-').map(Number)
  let guard = 0
  while ((y < ey || (y === ey && m <= em)) && guard++ < 600) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const hit = have.get(ym)
    out.push(hit ? { ...hit, missing: false } : { ym, orders: 0, sales: 0, missing: true })
    if (++m > 12) { m = 1; y++ }
  }
  return out.reverse() // ใหม่สุดอยู่บน แบบเดียวกับจอรายการขาย
}

/** เดือนที่ "มีใบ แต่น้อยผิดปกติ" — ตาข่ายรูที่สองซึ่งจอรุ่นแรกมองไม่เห็น
 *
 *  🔑 เจอของจริง 9 ก.ย. 2569: ธ.ค. 2566 = 1,517 ใบ · **ม.ค. 2567 = 250 ใบ** · ก.พ. 2567 = 1,586 ใบ
 *     เดือนแบบนี้ผ่านด่าน "ไม่มีแถวเลย" ไปสบาย ๆ แล้วขึ้นว่า "มีข้อมูล" เหมือนเดือนที่ครบทุกประการ
 *
 *  ⚠️ นี่คือ **ข้อสงสัย ไม่ใช่คำตัดสิน** — เดือนที่ขายน้อยจริงก็มี (ปิดร้าน · ช่วงต้นกิจการ)
 *     จอต้องเขียนว่า "ควรตรวจ" ห้ามเขียนว่า "หาย"
 *  ⚠️ ใช้ **มัธยฐาน** ไม่ใช่ค่าเฉลี่ย — เดือนที่หายเป็น 0 จะดึงค่าเฉลี่ยลงจนไม่มีอะไรผิดปกติอีกเลย
 *  ⚠️ ต้องมีฐานขั้นต่ำ (≥6 เดือนที่มีของ) ไม่งั้นตัวหารเล็กจะชี้มั่ว (กฎ ratios-need-a-floor)
 *  ⚠️ **เดือนปัจจุบันต้องยกเว้นเสมอ** — มันยังไม่จบเดือน ทุกวันที่ 1-10 จะเข้าเกณฑ์นี้หมด
 *     ถ้าไม่ยกเว้น จอจะร้องทุกต้นเดือนจนคนเลิกเชื่อ (คลาสเดียวกับ heartbeat ที่เตือนเกิน)
 */
const LOW_RATIO = 0.3
function lowMonths(rows: Array<{ ym: string; orders: number; missing: boolean }>, currentYm: string) {
  const have = rows.filter((r) => !r.missing && r.ym !== currentYm)
  if (have.length < 6) return { median: null as number | null, low: [] as string[] }
  const sorted = have.map((r) => r.orders).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  if (!median) return { median: null, low: [] }
  return { median, low: have.filter((r) => r.orders < median * LOW_RATIO).map((r) => r.ym) }
}

/** ผลถาม ZORT รายเดือน — **สามสถานะ ห้ามยุบ**
 *  count = ตัวเลขจริง · error = ถามไม่ได้ (ห้ามแปลว่า 0) · ยังไม่มีคีย์ = ยังไม่เคยถาม */
interface ZortMonth {
  count?: number; error?: string; stores?: number
  /** ได้ผลมาทางไหน — `all` = ท่อบวกให้ · `perStore` = จอถอยไปถามทีละร้านเอง
   *  ⚠️ ต้องเก็บและ **แสดงบนจอ** เพราะทางถอยให้เลขถูกเหมือนกัน แค่ช้ากว่า
   *     ⇒ ถ้าจอถอยตลอดกาลจะไม่มีอะไรฟ้องเลย (ตระกูล nets-expire-silently)
   *     ฝั่งท่อชี้ประเด็นนี้เอง 9 ก.ย. 2569 ตอนเขียนกำกับว่าห้ามถอด `stores` */
  via?: 'all' | 'perStore'
}

/** แปลผลเทียบ "กระจกเรา" กับ "ZORT" — คำตัดสินที่จอนี้ตั้งใจให้ได้มาตั้งแต่แรก
 *  ⚠️ ZORT **ยังไม่หักใบยกเลิก** ส่วนกระจกเราหักแล้ว ⇒ เลขสองฝั่งไม่ต้องเท่ากันเป๊ะ
 *     สิ่งที่ตัดสินได้จริงคือ **0 กับ ไม่ใช่ 0** (ท่อเขียนกำกับไว้เอง) */
function verdict(r: { orders: number; missing: boolean }, zortCount: number) {
  const ours = r.missing ? 0 : r.orders
  if (zortCount === 0 && ours === 0) return { text: '✅ ZORT ก็ไม่มีใบ — เดือนนี้ว่างจริง', tone: 'text-emerald-700' }
  // (ข้อความข้างล่างเติมคำว่า "รวม N ร้าน" ที่ตัวเรียก — เลขต้องมีขอบเขตกำกับเสมอ)
  if (zortCount > 0 && ours === 0) return { text: `🔴 ZORT มี ${zortCount.toLocaleString('th-TH')} ใบ — เรายังไม่ได้กวาด`, tone: 'text-red-700' }
  if (zortCount === 0 && ours > 0) return { text: 'ZORT ตอบ 0 แต่เรามีใบ — ต้องดูด้วยตา', tone: 'text-amber-800' }
  const gap = Math.abs(zortCount - ours) / Math.max(zortCount, ours)
  return gap > 0.2
    ? { text: `🟡 ZORT ${zortCount.toLocaleString('th-TH')} ใบ vs เรา ${ours.toLocaleString('th-TH')} — ต่างกันมาก`, tone: 'text-amber-800' }
    : { text: `ZORT ${zortCount.toLocaleString('th-TH')} ใบ — ใกล้เคียงกัน`, tone: 'text-gray-500' }
}

export default function CoveragePage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [store, setStore] = useState<'' | 'z1' | 'z2'>('')
  const [zort, setZort] = useState<Record<string, ZortMonth>>({})
  const [asking, setAsking] = useState('')

  /** ถาม ZORT ทีละเดือน — ท่อสั่งห้ามวนทั้งช่วงในคำขอเดียว (Netlify รอผลได้ ~26 วิ)
   *  ⚠️ ถามไม่ได้ต้องเก็บเป็น error **ห้ามเก็บเป็น 0** — 0 แปลว่า "ไม่มีใบจริง" ซึ่งคนละเรื่องกัน */
  const askZort = useCallback(async (ym: string) => {
    setAsking(ym)
    try {
      /* 🔴 **ขอบเขตต้องตรงกันสองฝั่ง ไม่งั้นเทียบกันไม่ได้เลย** (เจอของจริง 9 ก.ย. 2569)
         ตัวเลขฝั่งกระจกเมื่อเลือก "ทั้ง 2 ร้าน" = รวมสองร้าน
         แต่ `zortmonthly` **default เป็น z1 ร้านเดียว** ⇒ ยิงเฉย ๆ จะได้ ZORT 367 vs เรา 1,103
         แล้วจอจะขึ้น "ต่างกันมาก" ทุกเดือนทั้งที่ไม่มีอะไรผิด (วัดจริง: z1 367 + z2 761 = 1,128
         เทียบกับกระจก 1,103 ⇒ ต่างแค่ใบยกเลิกที่ ZORT ยังนับ ซึ่งท่อเขียนกำกับไว้แล้ว)
         ⚠️ ถ้าร้านใดร้านหนึ่งถามไม่ได้ **ห้ามบวกเฉพาะร้านที่ได้** — ผลรวมที่ขาดไปหนึ่งร้าน
            หน้าตาเหมือน "ZORT มีน้อยกว่าเรา" ซึ่งชี้ไปผิดทางทั้งหมด ⇒ ถือเป็น error ทั้งเดือน */
      /* ทางหลัก: `store=all` — ท่อบวกให้ในคำขอเดียว (ee196c1) และคืน `stores` มาด้วย
         ⇒ **จอไม่ต้องรู้ว่าร้านมีกี่ร้าน** วันเพิ่มร้านที่สามจอไม่ต้องแก้อะไรเลย
         และท่อรับประกันเองว่าร้านใดร้านหนึ่งล้ม = error ทั้งก้อน ไม่คืนผลรวมบางส่วน */
      const ask = async (st: string) => {
        const q = new URLSearchParams({ zortmonthly: '1', ym, store: st })
        const res = await fetch(`/api/web/core?${q}`)
        const j = await res.json().catch(() => null)
        return { res, j }
      }

      if (store) {
        const { res, j } = await ask(store)
        if (!res.ok || !j || j.error || j.skip) throw new Error(String(j?.error || j?.skip || `ท่อตอบ ${res.status}`))
        if (typeof j.zortCount !== 'number') throw new Error('ท่อตอบมาไม่มีช่อง zortCount')
        setZort((s) => ({ ...s, [ym]: { count: j.zortCount, stores: 1, via: 'all' } }))
        return
      }

      const all = await ask('all')
      /* ⚠️ **ท่อรุ่นก่อน ee196c1 ไม่รู้จัก `all` แล้วตกกลับ z1 เงียบ ๆ** — ตอบ 200 หน้าตาปกติทุกอย่าง
         ⇒ ห้ามเชื่อแค่ 200 · ต้องเห็นหลักฐานว่าท่อรู้จักจริง (`store === 'all'` + มี `stores`)
            ไม่งั้นได้เลขร้านเดียวมาเทียบกับกระจกสองร้าน ซึ่งคือบั๊กเดิมที่เพิ่งแก้ไป */
      const knowsAll = all.res.ok && all.j && all.j.store === 'all' && Array.isArray(all.j.stores)
      if (knowsAll && typeof all.j.zortCount === 'number') {
        setZort((s) => ({ ...s, [ym]: { count: all.j.zortCount, stores: all.j.stores.length, via: 'all' } }))
        return
      }
      if (all.res.ok && all.j?.error && Array.isArray(all.j.failedParts)) {
        const which = all.j.failedParts.filter((p: { error?: string }) => p?.error)
          .map((p: { store?: string; error?: string }) => `${p.store}: ${p.error}`).join(' · ')
        throw new Error(`${all.j.error}${which ? ` (${which})` : ''}`)
      }

      // ทางถอย: ท่อรุ่นเก่า — ถามทีละร้านแล้วบวกเอง (โค้ดเดิมก่อน ee196c1)
      const stores: Array<'z1' | 'z2'> = ['z1', 'z2']
      let total = 0
      for (const st of stores) {
        // eslint-disable-next-line no-await-in-loop -- ท่อสั่งให้ถามทีละคำขอ ห้ามยิงพร้อมกัน
        const { res, j } = await ask(st)
        if (!res.ok || !j || j.error || j.skip) {
          throw new Error(`ร้าน ${st}: ${String(j?.error || j?.skip || `ท่อตอบ ${res.status}`)}`)
        }
        if (typeof j.zortCount !== 'number') throw new Error(`ร้าน ${st}: ท่อตอบมาไม่มีช่อง zortCount`)
        total += j.zortCount
      }
      setZort((s) => ({ ...s, [ym]: { count: total, stores: stores.length, via: 'perStore' } }))
    } catch (e) {
      setZort((s) => ({ ...s, [ym]: { error: String(e instanceof Error ? e.message : e) } }))
    } finally { setAsking('') }
  }, [store])

  /** ถามเฉพาะเดือนที่น่าสงสัย ทีละเดือนเรียงกัน — ไม่ยิงพร้อมกันเพราะแต่ละครั้งไปถึง ZORT จริง */
  const askSuspects = useCallback(async (yms: string[]) => {
    for (const ym of yms) {
      if (zort[ym]) continue
      // eslint-disable-next-line no-await-in-loop -- ตั้งใจให้เรียงทีละเดือน (ท่อสั่ง)
      await askZort(ym)
    }
  }, [askZort, zort])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const q = new URLSearchParams({ monthly: '1', months: String(MONTH_CAP) })
      if (store) q.set('store', store)
      const res = await fetch(`/api/web/core?${q}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(j.months)) throw new Error('ท่อตอบมาไม่ครบ — ไม่มีช่อง months (อย่าถือว่าไม่มีข้อมูล)')
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [store])
  useEffect(() => { load() }, [load])

  const rows = d?.from && d?.to && d.months ? fill(d.from, d.to, d.months) : []
  const gaps = rows.filter((r) => r.missing)
  /* เดือนปัจจุบันคิดจาก `to` ที่ท่อส่งมา (เวลาไทยฝั่งเซิร์ฟเวอร์) ไม่ใช่นาฬิกาเครื่องคนดู */
  const currentYm = (d?.to ?? '').slice(0, 7)
  const { median, low } = lowMonths(rows, currentYm)
  const lowSet = new Set(low)

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="กระจกครบไหม — รายเดือน"
        summary={
          <span className="text-gray-400">
            เทียบยอดรายวันดูแค่เมื่อวาน · จอนี้มีไว้จับ<b className="text-gray-600">เดือนที่หายไปทั้งเดือน</b>
          </span>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'ตรวจอีกครั้ง'}</BtnGhost>}
      />

      <div className="flex gap-2 mb-3 text-[12.5px]">
        {([['', 'ทั้ง 2 ร้าน'], ['z1', 'ร้านที่ 1'], ['z2', 'ร้านที่ 2']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setStore(v)}
            className={`px-3 py-1.5 rounded border ${store === v ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white border-gray-200 text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorBox title={isSkip(error) ? 'ยังตรวจส่วนนี้ต่อไม่ได้' : 'ตรวจกระจกไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <>
          {gaps.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-3 text-[12.5px] text-red-800">
              <b>พบ {gaps.length} เดือนที่กระจกไม่มีใบเลย</b> — {gaps.map((g) => thaiYm(g.ym)).join(' · ')}
              <p className="text-[11.5px] text-red-700 mt-1">
                แยกไม่ออกจากตัวเลขฝั่งเราว่าเป็น &ldquo;ZORT ไม่มีใบจริง&rdquo; หรือ &ldquo;เรายังไม่เคยกวาด&rdquo;
                — กด <b>ถาม ZORT</b> ในแถวนั้น (หรือปุ่มด้านล่าง) เพื่อให้ตัดสินได้
              </p>
              <button type="button" onClick={() => askSuspects(gaps.map((g) => g.ym))}
                disabled={!!asking}
                className="mt-2 px-3 py-1.5 rounded bg-[#4669e5] text-white text-[12px] disabled:opacity-50">
                {asking ? `กำลังถาม ${thaiYm(asking)}…` : `ถาม ZORT ให้ครบทั้ง ${gaps.length} เดือน (ทีละเดือน)`}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 mb-3 text-[12.5px] text-gray-700">
              {/* ⚠️ ต้องนับจากแถวที่ตรวจจริง ห้ามเขียน MONTH_CAP — นั่นคือจำนวนที่ "ขอ" ไม่ใช่ที่ "ได้"
                  (ท่อคืนช่วงสั้นกว่าที่ขอได้เสมอ แล้วข้อความจะโม้เกินจริงเงียบ ๆ) */}
              ทุกเดือนใน {rows.length} เดือนที่ตรวจ<b> มีใบอยู่ในกระจก</b> —
              <span className="text-gray-400"> ยังไม่ได้แปลว่าจำนวนใบในแต่ละเดือนตรงกับ ZORT (จอนี้ดูแค่ &ldquo;มี/ไม่มี&rdquo;)</span>
            </div>
          )}

          {/* รูที่สอง: เดือนที่ **มีใบแต่น้อยผิดปกติ** ผ่านด่านแรกไปได้สบาย ๆ
              (เจอจริง: ม.ค. 2567 = 250 ใบ ขณะที่เดือนข้าง ๆ 1,517 และ 1,586) */}
          {low.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-3 text-[12.5px] text-amber-900">
              <b>{low.length} เดือนมีใบน้อยผิดปกติ — ควรตรวจว่ากวาดครบไหม</b>{' '}
              {low.map((ym) => thaiYm(ym)).join(' · ')}
              <p className="text-[11.5px] text-amber-800 mt-1">
                เกณฑ์: น้อยกว่า {Math.round(LOW_RATIO * 100)}% ของค่ากลาง ({median?.toLocaleString('th-TH')} ใบ/เดือน)
                · <b>เป็นข้อสงสัย ไม่ใช่คำตัดสิน</b> — เดือนที่ขายน้อยจริงก็มี ต้องนับใบจาก ZORT มาเทียบถึงจะรู้
                · ไม่นับเดือนปัจจุบันเพราะยังไม่จบเดือน
              </p>
            </div>
          )}

          <TableWrap>
            <table className="w-full min-w-[420px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>เดือน</th><th className={THR}>จำนวนใบ</th><th className={THR}>ยอดขาย</th>
                  <th className={TH}>สถานะกระจก</th><th className={TH}>ถาม ZORT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const z = zort[r.ym]
                  return (
                  <tr key={r.ym} className={`border-b border-[#e8ecf8] last:border-0 ${r.missing ? 'bg-red-50' : lowSet.has(r.ym) ? 'bg-amber-50' : ''}`}>
                    <td className={`${TD} whitespace-nowrap`}>{thaiYm(r.ym)} <span className="text-gray-300 font-mono text-[11px]">{r.ym}</span></td>
                    <td className={TDR}>{r.missing ? <span className="text-gray-300">—</span> : r.orders.toLocaleString('th-TH')}</td>
                    <td className={TDR}>{r.missing ? <span className="text-gray-300">—</span> : `฿${Math.round(r.sales).toLocaleString('th-TH')}`}</td>
                    <td className={TD}>
                      {r.missing
                        ? <span className="text-red-700">ไม่มีใบเลย — ยังไม่รู้สาเหตุ</span>
                        : lowSet.has(r.ym)
                          ? <span className="text-amber-800">น้อยผิดปกติ — ควรตรวจ</span>
                          : <span className="text-gray-500">มีข้อมูล</span>}
                    </td>
                    {/* ขาที่สอง: นับใบจาก ZORT ตรง ๆ — ตัวเดียวที่ตัดสินได้ว่าเดือนว่างเพราะอะไร
                        ⚠️ กดเองทีละเดือน ไม่ยิงอัตโนมัติ (กติกาเจ้าของร้าน + ท่อขอให้จอวนเอง) */}
                    <td className={TD}>
                      {!z ? (
                        <button type="button" onClick={() => askZort(r.ym)} disabled={asking === r.ym}
                          className="text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline">
                          {asking === r.ym ? 'กำลังถาม…' : 'ถาม ZORT'}
                        </button>
                      ) : z.error ? (
                        <span className="text-amber-800">⏳ {z.error}</span>
                      ) : (
                        <span className={verdict(r, z.count!).tone}>
                          {verdict(r, z.count!).text}
                          {(z.stores ?? 1) > 1 && <span className="text-gray-400"> (รวม {z.stores} ร้าน)</span>}
                          {z.via === 'perStore' && (
                            <span className="text-amber-700" title="ท่อไม่รู้จัก store=all ⇒ จอถามทีละร้านแล้วบวกเอง — เลขถูกแต่ช้ากว่า">
                              {' '}· ทางถอย
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </TableWrap>

          <div className="text-[11.5px] text-gray-500 mt-3 space-y-1">
            <p>ช่วงที่ตรวจ: {d.from} → {d.to} · {d.store || 'ทั้ง 2 ร้าน'} · รวม {(d.totalOrders ?? 0).toLocaleString('th-TH')} ใบ</p>
            <p className="text-amber-700">
              ⚠️ ขอย้อนหลัง {MONTH_CAP} เดือน (เพดานของท่อ) · ท่อตอบมา {rows.length} เดือน —
              ก่อน {d.from} <b>ไม่ได้แปลว่าไม่มีข้อมูล</b> แค่จอนี้ยังไม่ได้ถาม
            </p>
            <p>ตัดใบยกเลิกออกแล้ว ให้ตรงกับจอรายการขาย</p>
            <p>
              ⚠️ ช่อง &ldquo;ถาม ZORT&rdquo; ยิงไปที่ ZORT สดทีละเดือน (ไม่ผ่านกระจก) และ
              <b> ZORT ยังไม่หักใบยกเลิก</b> ส่วนตัวเลขฝั่งเราหักแล้ว ⇒ สองฝั่งไม่ต้องเท่ากันเป๊ะ
              สิ่งที่ตัดสินได้จริงคือ <b>0 กับ ไม่ใช่ 0</b>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
