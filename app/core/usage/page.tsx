'use client'
// การใช้งาน Netlify — ดูว่าอะไรกินเครดิต แยกตามช่วงเวลาและรายไซต์
//
// เจ้าของร้านสั่งด่วน 3 ก.ย. 2569: "เครดิต Netlify กินหนัก ให้ทำแดชบอร์ดแยกส่วน"
//
// 🔴 **สามข้อที่ต้องเขียนบนจอ ห้ามตัด** (ฝั่งเซิร์ฟเวอร์ยืนยันจากการยิงจริง)
//  ① **Netlify ไม่เปิด API ให้ดูเครดิตแยกส่วน** (/usage · /billing · /credits ตอบ 404 หมด)
//     ⇒ ตัวเลขที่นี่คือ **"ตัวขับเคลื่อนเครดิต" ไม่ใช่ยอดเครดิตจริง**
//     ⚠️ **ห้ามเขียนว่า "ใช้ไปกี่เครดิต"** ให้เขียนเป็นนาที build กับแบนด์วิดท์
//        เดาอัตราแปลงเอง = เลขที่ดูแม่นแต่ไม่มีใครตรวจได้ ซึ่งเป็นชนิดที่อันตรายที่สุด
//  ② **จำนวนครั้งที่ฟังก์ชันถูกเรียกดูย้อนหลังไม่ได้เลย** — อยากรู้ต้องเริ่มนับตั้งแต่วันนี้
//  ③ **แบนด์วิดท์มีแค่รอบบิลปัจจุบัน** ไม่มีรายวันย้อนหลัง ⇒ กราฟช่วงยาวมีเฉพาะ build
//
// ⚠️ **จอนี้ต้องไม่กลายเป็นตัวกินเครดิตเสียเอง** — ไม่มีรีเฟรชอัตโนมัติ กดเองเท่านั้น
//    (ฝั่งเซิร์ฟเวอร์แคชไว้ 1 ชั่วโมงแล้วอีกชั้น)
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, thaiDate } from '@/components/zort'

interface SiteRow { site?: string; name?: string; builds?: number; minutes?: number }
interface Win { builds?: number; minutes?: number; bySite?: SiteRow[] }
interface DailyRow { day: string; builds?: number; minutes?: number }
interface Usage {
  skip?: string
  windows?: Record<string, Win>
  bySite?: SiteRow[]
  daily?: DailyRow[]
  bandwidth?: { used?: number; included?: number; period?: string } | number
  caveat?: string
}

const WINDOWS = [
  { d: '1', label: 'วันนี้' },
  { d: '3', label: '3 วัน' },
  { d: '7', label: '7 วัน' },
  { d: '15', label: '15 วัน' },
  { d: '30', label: '30 วัน' },
  { d: '90', label: '90 วัน' },
  { d: '365', label: '1 ปี' },
]

const siteName = (r: SiteRow) => r.name || r.site || 'ไม่ทราบไซต์'
const mins = (n?: number) => (typeof n === 'number' ? `${fmtNum(Math.round(n))} นาที` : '—')

/** กราฟแท่งนาที build รายวัน — SVG ล้วน ไม่พึ่งไลบรารี */
function DailyChart({ rows }: { rows: DailyRow[] }) {
  if (rows.length === 0) return null
  const W = 900, H = 180, PAD = 10
  const max = Math.max(...rows.map((r) => Number(r.minutes) || 0), 1)
  const bw = Math.max(1, ((W - PAD * 2) / rows.length) * 0.7)
  const x = (i: number) => PAD + ((W - PAD * 2) * (i + 0.5)) / rows.length
  // เน้นวันที่ใช้เกิน 60 นาที — เป็นวันที่ควรไปดูว่าเกิดอะไรขึ้น
  const hot = (m: number) => m >= 60
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="นาที build รายวัน">
      {rows.map((r, i) => {
        const m = Number(r.minutes) || 0
        const h = (m / max) * (H - 36)
        return (
          <rect key={r.day} x={x(i) - bw / 2} y={H - 20 - h} width={bw} height={Math.max(h, m > 0 ? 1 : 0)}
            rx={1.5} className={hot(m) ? 'fill-red-500/80' : 'fill-blue-500/70'}>
            <title>{`${r.day} · ${Math.round(m)} นาที · ${fmtNum(Number(r.builds) || 0)} ครั้ง`}</title>
          </rect>
        )
      })}
      <text x={PAD} y={H - 4} className="fill-gray-400 text-[10px]">{rows[0]?.day}</text>
      <text x={W - PAD} y={H - 4} textAnchor="end" className="fill-gray-400 text-[10px]">{rows[rows.length - 1]?.day}</text>
    </svg>
  )
}

export default function CoreUsagePage() {
  const [d, setD] = useState<Usage | null>(null)
  const [win, setWin] = useState('30')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [at, setAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?usage=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
      setAt(new Date())
    } catch (e) {
      setD(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const w: Win = d?.windows?.[win] ?? {}
  const rowsBySite: SiteRow[] = Array.isArray(w.bySite) && w.bySite.length ? w.bySite
    : Array.isArray(d?.bySite) ? d!.bySite! : []
  const daily = Array.isArray(d?.daily) ? d!.daily! : []
  const days = Number(win)
  const dailyInWin = Number.isFinite(days) ? daily.slice(-days) : daily
  const avg = w.builds && w.minutes ? w.minutes / w.builds : null

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="การใช้งาน Netlify"
        summary="ดูว่าอะไรกินเครดิต — แยกตามช่วงเวลาและรายไซต์"
        actions={
          <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>
        }
      />

      {error && <ErrorBox title="อ่านข้อมูลการใช้งานไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {/* ⚠️ ยังไม่ได้ตั้งคีย์ = ต้องบอกวิธีตรง ๆ **ห้ามขึ้นจอว่าง** ให้เดาเอาเองว่าพังหรือไม่มีข้อมูล */}
      {d?.skip && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-[13px] text-amber-900 leading-relaxed">
          ⚠️ {d.skip}
        </div>
      )}

      {d && !d.skip && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {WINDOWS.map((x) => (
              <button
                key={x.d}
                onClick={() => setWin(x.d)}
                className={`text-[12.5px] rounded-full px-3 py-1.5 border transition-colors ${
                  win === x.d ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {x.label}
              </button>
            ))}
            {at && (
              <span className="text-[11.5px] text-gray-400 ml-2" suppressHydrationWarning>
                อ่านเมื่อ {at.toLocaleTimeString('th-TH')} · จอนี้ไม่รีเฟรชเอง
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Card>
              <p className="text-[12px] text-gray-500">จำนวน deploy</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-tight">{fmtNum(Number(w.builds) || 0)}</p>
              <p className="text-[11.5px] text-gray-400">ครั้ง ในช่วงที่เลือก</p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500">เวลา build รวม</p>
              <p className="text-[26px] font-semibold leading-tight" style={{ color: '#E03500' }}>
                {mins(w.minutes)}
              </p>
              <p className="text-[11.5px] text-gray-400">นี่คือตัวที่กินเครดิตหลัก</p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500">เฉลี่ยต่อครั้ง</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-tight">
                {avg !== null ? `${avg.toFixed(1)} นาที` : '—'}
              </p>
              {/* ข้อสรุปที่วัดได้จริง ไม่ใช่ความเห็น */}
              <p className="text-[11.5px] text-gray-400">ตัวกินคือ<b>จำนวนครั้ง</b> ไม่ใช่ขนาดงาน</p>
            </Card>
          </div>

          <Card padded={false} className="mb-4">
            <p className="text-[14.5px] font-semibold text-gray-900 px-4 md:px-5 pt-4">แยกตามไซต์</p>
            <TableWrap>
              <table className="w-full min-w-[520px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>ไซต์</th>
                    <th className={THR}>จำนวน deploy</th>
                    <th className={THR}>เวลา build</th>
                    <th className={THR}>เฉลี่ยต่อครั้ง</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsBySite.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-[13px] text-gray-400 text-center">
                      ไม่มี deploy ในช่วงที่เลือก
                    </td></tr>
                  )}
                  {rowsBySite.map((r) => {
                    const a = r.builds && r.minutes ? r.minutes / r.builds : null
                    return (
                      <tr key={siteName(r)} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                        <td className={`${TD} text-gray-800 font-medium`}>{siteName(r)}</td>
                        <td className={TDR}>{fmtNum(Number(r.builds) || 0)}</td>
                        <td className={TDR}>{mins(r.minutes)}</td>
                        <td className={TDR}>{a !== null ? `${a.toFixed(1)} นาที` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          {dailyInWin.length > 0 && (
            <Card className="mb-4">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <p className="text-[14.5px] font-semibold text-gray-900">เวลา build รายวัน</p>
                <p className="text-[11.5px] text-gray-400">แท่งแดง = วันที่ใช้เกิน 60 นาที · เอาเมาส์ชี้เพื่อดูตัวเลข</p>
              </div>
              <DailyChart rows={dailyInWin} />
            </Card>
          )}

          {/* 🔴 กล่องนี้ห้ามถอด — เป็นขอบเขตของสิ่งที่จอนี้บอกได้จริง */}
          <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-3 leading-relaxed">
            <p className="font-semibold mb-1">อ่านตัวเลขนี้ยังไง</p>
            ① ตัวเลขที่นี่คือ <b>&quot;ตัวขับเคลื่อนเครดิต&quot; ไม่ใช่ยอดเครดิตจริง</b> —
            Netlify ไม่เปิดช่องทางให้ดูเครดิตแยกส่วน จอนี้จึงบอกเป็น<b>นาที build</b> กับ<b>แบนด์วิดท์</b>
            ไม่ใช่ &quot;ใช้ไปกี่เครดิต&quot; (เดาอัตราแปลงเองจะได้เลขที่ดูแม่นแต่ไม่มีใครตรวจได้)
            <br />
            ② <b>จำนวนครั้งที่ฟังก์ชันถูกเรียกดูย้อนหลังไม่ได้</b> — อยากรู้ต้องเริ่มนับตั้งแต่วันนี้ไป
            <br />
            ③ <b>แบนด์วิดท์มีแค่รอบบิลปัจจุบัน</b> ไม่มีรายวันย้อนหลัง ⇒ กราฟช่วงยาวจึงมีเฉพาะเวลา build
            {d.caveat && <><br />{d.caveat}</>}
          </div>

          {typeof d.bandwidth === 'object' && d.bandwidth && (
            <Card className="mt-3">
              <p className="text-[14.5px] font-semibold text-gray-900 mb-1">แบนด์วิดท์ (รอบบิลปัจจุบัน)</p>
              <p className="text-[13px] text-gray-700">
                ใช้ไป {fmtNum(Number(d.bandwidth.used) || 0)}
                {typeof d.bandwidth.included === 'number' && <> จาก {fmtNum(d.bandwidth.included)}</>}
                {d.bandwidth.period && <span className="text-gray-400"> · รอบ {thaiDate(String(d.bandwidth.period).slice(0, 10))}</span>}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
