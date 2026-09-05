'use client'
// "ข้อต่อจะหมดก่อนโซ่ไหม" — อ่านจาก `/api/core?links=1`
//
// 🔴 **ทำไมถึงสำคัญ** — ม้วนเต็มแต่ไม่มีข้อต่อ = **ตัดขายไม่ได้เลย**
//    ของจริง 5 ก.ย. 2569: KINGKONG 3623 มีม้วนอยู่ 34 ม้วน แต่ข้อต่อ 3/8 ติดลบ 20
//    ⇒ ไม่มีจอไหนในระบบเดิม **รวมทั้ง ZORT** ที่มองเห็นความสัมพันธ์นี้
//
// 🔴 **ข้อห้ามจากความรู้เรื่องโซ่** (`~/claude-shared/โซ่-สิ่งที่ยังไม่รู้.md`)
//    ① ข้อต่อ 3/8 ใช้กับม้วน 3623 และ 3652 ได้ · **3/8p ใช้กับ 3636 เท่านั้น**
//       ห้ามรวมกอง 3/8 กับ 3/8p เพราะ "วัดข้าม 3 หมุดได้ 19.05 เท่ากัน" แต่ตัวข้อต่อคนละขนาด
//    ② **ยังไม่รู้ว่าข้อต่อ NEWWAVE กับ KINGKONG ใส่แทนกันได้ไหม** ⇒ แยกกองตามยี่ห้อไว้ก่อน
//       ยอดรวมข้ามยี่ห้อ (crossBrand) โชว์คู่กันได้ **แต่ห้ามเอาไปตัดสินแทน**
//    ③ จำนวนข้อต่อที่ใช้ = **จำนวนเส้นที่ตัด** ซึ่งรู้ได้แค่ช่วง (ใบขายเก็บเป็นฟัน)
//       ⇒ ห้ามยุบช่วงเป็นเลขเดียว
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import { Pill } from '@/components/zort'

interface LinkRow {
  pitch: string
  brand: string
  linkSku: string
  linkStock: number
  rollSkus?: string[]
  rollTeeth?: number
  teethSold?: number
  pairsNeedMin?: number
  pairsNeedMax?: number
  daysLeftMin?: number
  daysLeftMax?: number
  verdict: string
}
interface CrossRow { pitch: string; linkStockAllBrands: number; pairsNeedMin?: number; pairsNeedMax?: number }
interface Resp {
  skip?: string
  scope?: string
  compatNote?: string
  crossBrandNote?: string
  rows?: LinkRow[]
  crossBrand?: CrossRow[]
}

/** สีของคำตัดสิน — ท่อเป็นคนตัดสิน จอแค่ทำให้เห็น ห้ามจอคิดเกณฑ์เอง */
function verdictTone(v: string): 'red' | 'orange' | 'green' | 'gray' {
  if (v.startsWith('ติดลบ')) return 'red'
  if (v === 'ขาดแน่นอน') return 'red'
  if (v === 'อาจไม่พอ') return 'orange'
  if (v === 'พอ') return 'green'
  return 'gray'
}

export default function LinkStock({ days = 90 }: { days?: number }) {
  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState('')
  const [showCross, setShowCross] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/web/core?links=1&days=${days}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    }
  }, [days])
  useEffect(() => { load() }, [load])

  if (err) {
    return (
      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2 mb-3">
        ⚠️ ตรวจข้อต่อไม่สำเร็จ — <b>ไม่ได้แปลว่าข้อต่อพอ</b> ({err})
      </p>
    )
  }
  if (!d || d.skip) return null
  const rows = Array.isArray(d.rows) ? d.rows : []
  if (rows.length === 0) return null
  const bad = rows.filter((r) => verdictTone(r.verdict) === 'red').length

  return (
    <div className="bg-white border border-gray-200 rounded-md mb-3 overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-gray-200">
        <p className="text-[13px] font-semibold text-gray-800">
          ข้อต่อจะหมดก่อนโซ่ไหม
          {bad > 0 && <span className="ml-2 text-red-700">— ตัดขายไม่ได้แล้ว {fmtNum(bad)} กอง</span>}
        </p>
        <p className="text-[11.5px] text-gray-500 mt-0.5 leading-relaxed">
          ม้วนเต็มแต่ไม่มีข้อต่อ = <b>ตัดขายไม่ได้เลย</b> · ข้อต่อ 1 คู่ต่อโซ่ 1 เส้น (ต่อหัวชนท้ายให้เป็นวง)
        </p>
      </div>

      <table className="w-full min-w-[860px]">
        <thead className="bg-white border-b border-gray-200">
          <tr>
            <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2">เบอร์ · ยี่ห้อ</th>
            <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2">รหัสข้อต่อ</th>
            <th className="text-right font-normal text-[12px] text-gray-500 px-3 py-2">ข้อต่อคงเหลือ</th>
            <th className="text-right font-normal text-[12px] text-gray-500 px-3 py-2">ต้องใช้ (คู่)</th>
            <th className="text-right font-normal text-[12px] text-gray-500 px-3 py-2">พอขายอีก</th>
            <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2">สรุป</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.pitch}-${r.brand}`} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2.5 text-[12.5px] text-gray-800">
                {r.pitch} · {r.brand}
                <span className="block text-[11px] text-gray-400">
                  ม้วนที่ใช้ข้อต่อนี้ {fmtNum((r.rollSkus ?? []).length)} รหัส · {fmtNum(Number(r.rollTeeth ?? 0))} ฟัน
                </span>
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-gray-600">{r.linkSku}</td>
              <td className={`px-3 py-2.5 text-[12.5px] text-right ${r.linkStock < 0 ? 'text-red-600 font-semibold' : 'text-gray-800'}`}>
                {fmtNum(r.linkStock)}
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-right text-gray-600">
                {/* ⚠️ ช่วง ห้ามยุบเป็นเลขเดียว — ใบขายเก็บเป็นฟัน ไม่รู้ว่าแตกเป็นกี่เส้น */}
                {typeof r.pairsNeedMin === 'number'
                  ? <span title="ต้องใช้กี่คู่ในช่วงที่คิด — เป็นช่วงเพราะใบขายไม่ได้บอกความยาวของแต่ละเส้น">
                      {fmtNum(r.pairsNeedMin)}–{fmtNum(Number(r.pairsNeedMax))}
                    </span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2.5 text-[12.5px] text-right text-gray-600">
                {typeof r.daysLeftMin === 'number'
                  ? (r.daysLeftMax !== undefined && Math.round(r.daysLeftMin) !== Math.round(r.daysLeftMax)
                    ? <>{fmtNum(Math.round(r.daysLeftMin))}–{fmtNum(Math.round(Number(r.daysLeftMax)))} วัน</>
                    : <>{fmtNum(Math.round(r.daysLeftMin))} วัน</>)
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2.5"><Pill tone={verdictTone(r.verdict)}>{r.verdict}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-3.5 py-2.5 border-t border-gray-200 bg-gray-50 space-y-1">
        {d.compatNote && <p className="text-[11px] text-gray-600 leading-relaxed">{d.compatNote}</p>}
        {d.scope && <p className="text-[11px] text-gray-500 leading-relaxed">{d.scope}</p>}
        {Array.isArray(d.crossBrand) && d.crossBrand.length > 0 && (
          <>
            <button onClick={() => setShowCross((v) => !v)} className="text-[11.5px] text-blue-600 underline underline-offset-2">
              {showCross ? 'ซ่อนยอดรวมข้ามยี่ห้อ' : 'ดูยอดรวมข้ามยี่ห้อ (ยังใช้ตัดสินไม่ได้)'}
            </button>
            {showCross && (
              <div className="mt-1">
                {/* 🔴 ห้ามเอาไปตัดสินแทนยอดรายยี่ห้อ — ยังไม่รู้ว่าใส่แทนกันได้ไหม */}
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-1 leading-relaxed">
                  ⚠️ {d.crossBrandNote}
                </p>
                {d.crossBrand.map((c) => (
                  <p key={c.pitch} className="text-[11.5px] text-gray-600">
                    เบอร์ {c.pitch} — รวมทุกยี่ห้อเหลือ <b className={c.linkStockAllBrands < 0 ? 'text-red-600' : ''}>{fmtNum(c.linkStockAllBrands)}</b>
                    {' '}· ต้องใช้ {fmtNum(Number(c.pairsNeedMin ?? 0))}–{fmtNum(Number(c.pairsNeedMax ?? 0))} คู่
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
