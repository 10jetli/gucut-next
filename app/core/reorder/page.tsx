'use client'
// วางแผนธุรกิจ → วางแผนสั่งซื้อซ้ำ — **ลอกผังจาก `zort-ui/37-zort-วางแผนสั่งซื้อซ้ำ.jpg`**
//
// ⚠️ **จอ ZORT ของจริงว่างเปล่า** (ไม่มีข้อมูล) เพราะร้านไม่เคยตั้งกลุ่ม Lead Time
//    คอลัมน์ของเขา (กลุ่ม Lead Time · คู่ค้า · จำนวนรอโอนเข้า · วันที่ควรสั่งซื้อ) จึงไม่มีค่าให้เลย
//    ⇒ ทำผังหัวจอตามเขา แต่ **คอลัมน์ใช้ของที่เรารู้จริง** และติดป้าย +เรา ให้ดูออก
//    (เกณฑ์เดียวกับจอการเงินที่เจ้าของร้านเลือกเก็บของเราไว้เพราะ ZORT ว่าง)
//
// 🔴 **ศัพท์ต้องตรงกับที่ร้านใช้** (`~/claude-shared/โซ่-สิ่งที่ยังไม่รู้.md`)
//    Cutter = **ฟัน** ← หน่วยที่ใช้นับทุกที่ · Drive Link = **ข้อต่อตาม** · Tie Strap = **ข้อต่อ**
//    ⚠️ ห้ามเขียน "ม้วน" เป็นหน่วยหลัก — คลังนับเป็นฟัน · จำนวนม้วนเป็นค่าที่หารมาให้ดูเฉย ๆ
//    ⚠️ ฟันต่อม้วนไม่ใช่ 820 เสมอ (3860 = 740 · 325 = 920) ⇒ อ่านจากท่อ ห้ามฝังเลข
//
// 🔴 **ห้ามยุบช่วงเป็นเลขเดียว** — ร้านคีย์ขายโซ่ตัดด้วย "รหัสม้วน + จำนวนฟัน"
//    ใบขายจึงรู้แค่ว่าตัดฟันไปเท่าไหร่ **ไม่รู้ว่าแตกเป็นกี่เส้น**
//    5,060 ฟัน = 169 เส้นถ้า 30T หรือ 107 เส้นถ้า 47T ⇒ ต่างกัน 62 เส้น
//    ⇒ ท่อส่งมาเป็นช่วง (chainsEstMin–Max) และจอต้องแสดงเป็นช่วง
//    ⚠️ `chainsCountable: false` แปลว่า **นับไม่ได้** ไม่ใช่ "ไม่มีการตัด" — ต้องเขียนให้ต่างกัน
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, Pill, EmptyState } from '@/components/zort'
import LinkStock from '@/components/zort/LinkStock'

interface Row {
  sku: string
  name?: string
  /** คงเหลือหน่วย "ฟัน" — ไม่ใช่ม้วน */
  teeth?: number
  /** ฟันต่อม้วนของตระกูลนี้ (820 · 740 · 920) — null = ไม่ใช่ม้วนโซ่ */
  teethPerRoll?: number | null
  rolls?: number | null
  listings?: number
  teethUsed?: number
  teethPerDay?: number
  /** จำนวนเส้นที่ตัดไป — **นับได้ก็ต่อเมื่อใบขายบอกความยาว ซึ่งร้านไม่ได้คีย์** */
  chainsCountable?: boolean
  chainsEstMin?: number
  chainsEstMax?: number
  ladderTeethMin?: number
  ladderTeethMax?: number
  daysLeft?: number | null
}
interface Resp {
  skip?: string
  from?: string; to?: string; days?: number
  parents?: number; neverSold?: number
  scope?: string
  rows?: Row[]
}

const DAYS = [30, 90, 180]

/** สีตามความด่วน — เกณฑ์เดียวกับที่ใช้ทั้งระบบ: แดง = ต้องทำวันนี้ */
function DaysPill({ d }: { d?: number | null }) {
  if (d === null || d === undefined) return <span className="text-gray-300">—</span>
  if (d <= 0) return <Pill tone="red">หมดแล้ว</Pill>
  if (d <= 7) return <Pill tone="red">{d < 1 ? 'ไม่ถึง 1 วัน' : `${fmtNum(Math.round(d))} วัน`}</Pill>
  if (d <= 30) return <Pill tone="orange">{fmtNum(Math.round(d))} วัน</Pill>
  return <span className="text-gray-600">{fmtNum(Math.round(d))} วัน</span>
}

export default function ReorderPage() {
  const [days, setDays] = useState(90)
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onlyChain, setOnlyChain] = useState(true)

  const load = useCallback(async (n = days) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/web/core?reorder=1&days=${n}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
      setDays(n)
    } catch (e) {
      setD(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [days])
  useEffect(() => { load(90) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const all = d?.rows ?? []
  // ⚠️ กรองด้วย "มีฟันต่อม้วนไหม" ซึ่งเป็นข้อมูล ไม่ใช่ดูจากชื่อว่ามีคำว่าโซ่
  const rows = onlyChain ? all.filter((r) => r.teethPerRoll) : all
  const urgent = rows.filter((r) => typeof r.daysLeft === 'number' && (r.daysLeft as number) <= 7).length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="วางแผนสั่งซื้อซ้ำ"
        summary={
          <>
            {d ? <>เฝ้าดู {fmtNum(rows.length)} รายการ · ต้องสั่งภายใน 7 วัน <b className="text-red-600">{fmtNum(urgent)}</b></> : 'กำลังโหลด…'}
            {' | '}
            {/* ⚠️ ZORT จอนี้ว่างเปล่าจริง ต้องเขียนบอก ไม่งั้นคนนึกว่าเราลอกไม่ครบ */}
            <span className="text-gray-400">จอนี้ของเราเอง — ของ ZORT ว่างเปล่าเพราะร้านไม่เคยตั้งกลุ่ม Lead Time</span>
          </>
        }
        actions={
          <>
            <select
              value={days}
              onChange={(e) => load(Number(e.target.value))}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {DAYS.map((n) => <option key={n} value={n}>คิดยอดใช้จาก {n} วันล่าสุด</option>)}
            </select>
            <BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
          </>
        }
      />

      {error && <ErrorBox title="ดึงข้อมูลวางแผนสั่งซื้อไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}
      {d?.skip && <p className="text-[13px] text-gray-500">⏳ {d.skip}</p>}

      {d && !d.skip && (
        <>
          {/* 🔴 ขอบเขตของตัวเลขต้องอยู่บนจอ ไม่ใช่ในคอมเมนต์ */}
          {d.scope && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              {d.scope}
            </p>
          )}

          {/* 🔴 ข้อจำกัดถาวรของระบบ — ต้องเขียนบอก ไม่ใช่ปล่อยให้คนเข้าใจว่าตัวเลขนับได้ครบ */}
          <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            ⚠️ <b>ช่อง “ตัดไปกี่เส้น” เป็นช่วง ไม่ใช่เลขเดียว และจะเป็นแบบนี้ตลอดไป</b> —
            ร้านคีย์ขายโซ่ตัดด้วย<b>รหัสม้วนกับจำนวนฟัน</b> ไม่ได้คีย์รหัสความยาว
            {' '}⇒ ใบขายรู้แค่ว่า<b>ตัดฟันไปเท่าไหร่</b> ไม่รู้ว่าแตกเป็นกี่เส้น
            {' '}(5,060 ฟัน เป็นได้ทั้ง 169 เส้นถ้าเป็น 30 ฟัน และ 107 เส้นถ้าเป็น 47 ฟัน)
            {' '}<b>นับไม่ได้ ไม่ได้แปลว่าไม่มีการตัด</b>
          </p>

          {/* 🔴 ข้อต่อมาก่อนม้วน — ม้วนเต็มแต่ไม่มีข้อต่อก็ตัดขายไม่ได้อยู่ดี
              ถ้าวางไว้ล่างตาราง คนจะเห็นแต่ "ม้วนยังเหลือเยอะ" แล้วนึกว่าไม่ต้องสั่งอะไร */}
          <LinkStock days={days} />

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setOnlyChain(true)}
              className={`text-[12.5px] rounded-full px-3 py-1.5 border ${onlyChain ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white text-gray-600 border-gray-300'}`}
            >
              เฉพาะม้วนโซ่ ({fmtNum(all.filter((r) => r.teethPerRoll).length)})
            </button>
            <button
              onClick={() => setOnlyChain(false)}
              className={`text-[12.5px] rounded-full px-3 py-1.5 border ${!onlyChain ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white text-gray-600 border-gray-300'}`}
            >
              ทุกสินค้าที่ขายใน {days} วัน ({fmtNum(all.length)})
            </button>
          </div>

          <TableWrap>
            <table className="w-full min-w-[1040px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>คงเหลือ (ฟัน)</th>
                  <th className={THR}>≈ ม้วน</th>
                  <th className={THR}>ใช้ต่อวัน (ฟัน)</th>
                  <th className={THR}>
                    ตัดไปกี่เส้น
                    <span className="ml-1 text-[10px] font-normal text-amber-600" title="ช่วง — ใบขายไม่ได้บอกความยาว จึงคำนวณเป็นช่วงจากความยาวที่ร้านลงขายจริง">≈</span>
                  </th>
                  <th className={THR}>
                    พอขายอีก
                    <span className="ml-1 text-[10px] font-normal text-blue-500" title="คอลัมน์นี้ ZORT ไม่มี — เราเพิ่มเอง">+เรา</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={7} icon="📦" title="ไม่มีรายการในเงื่อนไขนี้"
                    detail="ลองสลับไปดูทุกสินค้า หรือขยายช่วงวันที่ใช้คิดยอดขาย" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={TD}>
                      {/* ⚠️ ห้ามตัดชื่อสั้นจนส่วนที่ต่างกันหาย — "(แบบตัด)" กับ "(แบบซอย)" อยู่ท้ายชื่อ
                          และเป็นคนละสินค้ากันคนละกองฟัน (ฝั่งท่อเกือบสรุปผิดเพราะเรื่องนี้) */}
                      <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-[13px] text-[#457ab2] hover:underline">
                        {r.name || r.sku}
                      </Link>
                      <span className="block text-[11px] text-gray-400">
                        {r.sku}
                        {typeof r.listings === 'number' && r.listings > 0 && <> · ลงขาย {fmtNum(r.listings)} ความยาว</>}
                        {r.ladderTeethMin && r.ladderTeethMax && <> ({fmtNum(r.ladderTeethMin)}–{fmtNum(r.ladderTeethMax)} ฟัน)</>}
                      </span>
                    </td>
                    <td className={`${TDR} ${Number(r.teeth) < 0 ? 'text-red-600 font-semibold' : ''}`}>
                      {fmtNum(Number(r.teeth ?? 0))}
                    </td>
                    <td className={`${TDR} text-gray-500`}>
                      {r.teethPerRoll
                        ? <span title={`ตระกูลนี้ ${fmtNum(r.teethPerRoll)} ฟันต่อม้วน`}>{Number(r.rolls ?? 0).toFixed(2)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TDR}>{Number(r.teethPerDay ?? 0).toFixed(2)}</td>
                    <td className={`${TDR} text-gray-600`}>
                      {/* นับไม่ได้ ≠ ไม่มีการตัด — เขียนให้ต่างกันชัด ๆ */}
                      {r.chainsCountable === false
                        ? (typeof r.chainsEstMin === 'number' && typeof r.chainsEstMax === 'number'
                          ? <span title="นับตรง ๆ ไม่ได้ เพราะใบขายไม่ได้บอกความยาว — ช่วงนี้คำนวณจากความยาวที่ร้านลงขายจริง">
                              {fmtNum(r.chainsEstMin)}–{fmtNum(r.chainsEstMax)}
                            </span>
                          : <span className="text-gray-300" title="ยังไม่มีข้อมูลพอจะประมาณ">—</span>)
                        : fmtNum(Number(r.chainsEstMin ?? 0))}
                    </td>
                    <td className={TDR}><DaysPill d={r.daysLeft} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {typeof d.neverSold === 'number' && d.neverSold > 0 && (
            <p className="text-[12px] text-gray-500 mt-2">
              มีอีก {fmtNum(d.neverSold)} รายการที่ไม่มีการขายเลยในช่วงนี้ — คำนวณ “พอขายอีกกี่วัน” ไม่ได้
              {' '}<b>ไม่ได้แปลว่าของหมดหรือขายไม่ออก</b> แปลว่ายังไม่มียอดให้คิด
            </p>
          )}
        </>
      )}
    </div>
  )
}
