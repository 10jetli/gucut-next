'use client'
import { useEffect, useState } from 'react'
import { fmtBaht, fmtNum, thaiDate } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'

interface Campaign {
  name: string
  impressions: number
  clicks: number
  cost: number
}

interface PlatformData {
  period: string
  account: string
  campaigns: Campaign[]
}

interface AdsData {
  google: PlatformData
  facebook: PlatformData
  updated: string
}

function ctr(clicks: number, impressions: number) {
  if (!impressions) return '0%'
  return (clicks / impressions * 100).toFixed(2) + '%'
}

function cpc(cost: number, clicks: number) {
  if (!clicks) return '-'
  return fmtBaht(cost / clicks)
}

function PlatformCard({ title, logo, color, bgColor, data }: {
  title: string; logo: string; color: string; bgColor: string; data: PlatformData
}) {
  /* ⚠️ ท่อตอบมาไม่ครบรูปแบบ = จอตายทั้งหน้า (จอกับ API deploy คนละรอบเสมอ)
     ⇒ กันด้วย Array.isArray ทุกจุดที่วนข้อมูลจากท่อ */
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : []
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const totalCost = campaigns.reduce((s, c) => s + c.cost, 0)
  const periodLabel = data.period === 'last_7_days' ? '7 วันหลัง' : '30 วันลวลวรง'

  return (
    <Card padded={false} className="overflow-hidden">
      <div className={`${bgColor} px-4 py-3 flex items-center gap-2`}>
        <span className="text-xl">{logo}</span>
        <div>
          <p className={`text-[13px] font-bold ${color}`}>{title}</p>
          <p className="text-[10px] text-gray-500">{data.account} · {periodLabel}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 border-b border-gray-50">
        <div className="p-3 text-center border-r border-gray-50">
          <p className="text-[17px] font-black text-gray-900">{fmtBaht(totalCost)}</p>
          <p className="text-[10px] text-gray-400">ค่าโฆษณา</p>
        </div>
        <div className="p-3 text-center border-r border-gray-50">
          <p className="text-[17px] font-black text-gray-900">{fmtNum(totalClicks)}</p>
          <p className="text-[10px] text-gray-400">คลิก</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[17px] font-black text-gray-900">{fmtNum(totalImpressions)}</p>
          <p className="text-[10px] text-gray-400">impression</p>
        </div>
      </div>
      {campaigns.map((c, i) => (
        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50/70">
          <p className="text-[12px] font-semibold text-gray-800 truncate">{c.name}</p>
          <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-gray-500">
            <span>{fmtBaht(c.cost)}</span>
            <span>{fmtNum(c.clicks)} คลิก</span>
            <span>CTR {ctr(c.clicks, c.impressions)}</span>
            <span>CPC {cpc(c.cost, c.clicks)}</span>
          </div>
        </div>
      ))}
    </Card>
  )
}

/** อายุของวันที่แบบ `YYYY-MM-DD` (วันไทย) เป็นจำนวนวัน · อ่านไม่ออก = null **ไม่ใช่ 0**
 *  (0 แปลว่า "ของวันนี้" ซึ่งตรงข้ามกับ "ไม่รู้ว่าเป็นของวันไหน") */
function ageInDays(day?: string | null): number | null {
  const s = String(day ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const t = Date.parse(`${s}T00:00:00+07:00`)
  if (Number.isNaN(t)) return null
  const วันนี้ไทย = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
  const วันนี้ = Date.parse(`${วันนี้ไทย}T00:00:00+07:00`)
  return Math.round((วันนี้ - t) / 86400000)
}

export default function AdsPage() {
  const [data, setData] = useState<AdsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.detail ?? d.error)
        setData(d)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400 text-sm" />
  if (error) return (
    <div className="p-4">
      <ErrorBox>
        <p className="text-[11px] mt-1">{error}</p>
      </ErrorBox>
    </div>
  )
  if (!data) return null

  const totalCost = [
    ...(Array.isArray(data.google?.campaigns) ? data.google.campaigns : []),
    ...(Array.isArray(data.facebook?.campaigns) ? data.facebook.campaigns : []),
  ].reduce((s, c) => s + c.cost, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl p-4 text-white shadow-[0_16px_32px_-16px_rgba(37,99,235,0.5)]">
        <p className="text-[11px] opacity-80">ค่าโฆษณารวม (Google + Facebook)</p>
        <p className="text-3xl font-black mt-1 tracking-tight">{fmtBaht(totalCost)}</p>
        {/* 🔴 **ของเดิมพิมพ์วันที่เป็นตัวเล็กสีจางที่สุดในกล่อง แล้วจบ** (แก้ 18 ก.ย. 2569)
            จอนี้อ่านจากไฟล์นิ่ง `data/ads.json` ซึ่งไม่มีอะไรมาอัปเดตเอง
            ⇒ ตอนเขียนบรรทัดนี้ ข้อมูลเป็นของ 3 ก.ค. 2569 = เก่ากว่าสองเดือนครึ่ง
              แต่หน้าตาของจอเหมือนข้อมูลสดทุกประการ (ยอดเงินตัวใหญ่ วันที่ตัวจิ๋ว)
            ⚠️ ค่าโฆษณาที่ต่ำกว่าจริงทำให้ตัวเลขคุ้มทุนดูสวยเกินจริง แล้วคนจะตัดสินใจเพิ่มงบจากเลขที่ผิด
            ⇒ อายุคิดตอนเรนเดอร์ ⇒ **วันที่ไฟล์ถูกอัปเดต แถบนี้จะหายไปเอง** ไม่ต้องมีใครมาลบ */}
        <p className="text-[10px] opacity-60 mt-1">อัพเดต {thaiDate(data.updated)}</p>
      </div>
      {(() => {
        const อายุ = ageInDays(data.updated)
        if (อายุ === null) {
          return (
            <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              ℹ️ <b>ไม่รู้ว่าตัวเลขนี้เป็นของวันไหน</b> — ไฟล์ข้อมูลไม่ได้บอกวันที่มา ⇒ อย่าเพิ่งเอาไปเทียบกับยอดขายเดือนนี้
            </div>
          )
        }
        if (อายุ < 14) return null
        return (
          <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5 leading-relaxed">
            ⚠️ <b>ตัวเลขชุดนี้เก่า {fmtNum(อายุ)} วันแล้ว</b> (เป็นของ {thaiDate(data.updated)}) —
            จอนี้อ่านจาก<b>ไฟล์ที่ต้องมีคนเอาเข้ามาเอง</b> ไม่ได้ต่อกับ Google/Facebook โดยตรง
            <span className="block mt-1">
              ⇒ <b>ห้ามเอาไปคิดคุ้มทุนกับยอดขายเดือนนี้</b> เพราะค่าโฆษณาจะต่ำกว่าจริง แล้วตัวเลขจะดูดีเกินจริง
            </span>
          </div>
        )
      })()}
      <PlatformCard title="Google Ads" logo="🔍" color="text-blue-700" bgColor="bg-blue-50" data={data.google} />
      <PlatformCard title="Facebook Ads" logo="📘" color="text-indigo-700" bgColor="bg-indigo-50" data={data.facebook} />
    </div>
  )
}
