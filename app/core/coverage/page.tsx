'use client'
// กระจกครบไหม (รายเดือน) — 9 ก.ย. 2569
// เกิดจากบทเรียนจริง: เทียบยอดรายวันเทียบแค่ "เมื่อวาน" ⇒ เดือนที่หายทั้งเดือนไม่มีอะไรฟ้องเลย
// (เจอ 21 เดือนหายจากกระจกโดยไม่มีตัวตรวจไหนเห็น — วันที่เขียนจอนี้เหลือ 2 เดือน)
//
// ⚠️ ข้อจำกัดที่ต้องเขียนบนจอ ไม่ใช่ซ่อนไว้ในคอมเมนต์:
//   จอนี้ตอบได้ข้อเดียว = "กระจกของเรามีใบของเดือนนั้นไหม"
//   **ตอบไม่ได้ว่า ZORT มีใบในเดือนนั้นจริงไหม** — ต้องมีขาที่สอง (นับใบจาก ZORT รายเดือน)
//   ซึ่งท่อยังไม่มีเส้นให้ ⇒ เดือนที่ว่างจึงเป็น "ยังไม่รู้" (แดง) ไม่ใช่ "ยืนยันว่าไม่มีของ"
//   กฎ three-states-not-two: ว่างเพราะไม่มีของ ≠ ว่างเพราะยังไม่เคยถาม
// ⚠️ ท่อ ?monthly= จำกัด 36 เดือน — เดือนก่อนหน้านั้น **ไม่ได้แปลว่าไม่มีข้อมูล** แค่ยังไม่ได้ถาม
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

const MONTH_CAP = 36 // เพดานของท่อ — เขียนไว้ตรงนี้ที่เดียว
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

export default function CoveragePage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [store, setStore] = useState<'' | 'z1' | 'z2'>('')

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
                ยังไม่รู้ว่าเป็น &ldquo;ZORT ไม่มีใบในเดือนนั้นจริง&rdquo; หรือ &ldquo;เรายังไม่เคยกวาดเดือนนั้น&rdquo;
                — สองอย่างนี้แยกกันไม่ได้จากจอนี้ ต้องนับใบจาก ZORT รายเดือนมาเทียบ
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 mb-3 text-[12.5px] text-gray-700">
              {/* ⚠️ ต้องนับจากแถวที่ตรวจจริง ห้ามเขียน MONTH_CAP — นั่นคือจำนวนที่ "ขอ" ไม่ใช่ที่ "ได้"
                  (ท่อคืนช่วงสั้นกว่าที่ขอได้เสมอ แล้วข้อความจะโม้เกินจริงเงียบ ๆ) */}
              ทุกเดือนใน {rows.length} เดือนที่ตรวจ<b> มีใบอยู่ในกระจก</b> —
              <span className="text-gray-400"> ยังไม่ได้แปลว่าจำนวนใบในแต่ละเดือนตรงกับ ZORT (จอนี้ดูแค่ &ldquo;มี/ไม่มี&rdquo;)</span>
            </div>
          )}

          <TableWrap>
            <table className="w-full min-w-[420px]">
              <thead className="bg-white border-b border-gray-200">
                <tr><th className={TH}>เดือน</th><th className={THR}>จำนวนใบ</th><th className={THR}>ยอดขาย</th><th className={TH}>สถานะกระจก</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ym} className={`border-b border-[#e8ecf8] last:border-0 ${r.missing ? 'bg-red-50' : ''}`}>
                    <td className={`${TD} whitespace-nowrap`}>{thaiYm(r.ym)} <span className="text-gray-300 font-mono text-[11px]">{r.ym}</span></td>
                    <td className={TDR}>{r.missing ? <span className="text-gray-300">—</span> : r.orders.toLocaleString('th-TH')}</td>
                    <td className={TDR}>{r.missing ? <span className="text-gray-300">—</span> : `฿${Math.round(r.sales).toLocaleString('th-TH')}`}</td>
                    <td className={TD}>
                      {r.missing
                        ? <span className="text-red-700">ไม่มีใบเลย — ยังไม่รู้สาเหตุ</span>
                        : <span className="text-gray-500">มีข้อมูล</span>}
                    </td>
                  </tr>
                ))}
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
          </div>
        </>
      )}
    </div>
  )
}
