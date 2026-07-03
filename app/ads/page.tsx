'use client'
import { useEffect, useState } from 'react'

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

function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtNum(n: number) {
  return n.toLocaleString('th-TH')
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
  const totalImpressions = data.campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = data.campaigns.reduce((s, c) => s + c.clicks, 0)
  const totalCost = data.campaigns.reduce((s, c) => s + c.cost, 0)
  const periodLabel = data.period === 'last_7_days' ? '7 วันหลัง' : '30 วันหลัง'

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
      {data.campaigns.map((c, i) => (
        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
          <p className="text-[12px] font-semibold text-gray-800 truncate">{c.name}</p>
          <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-gray-500">
            <span>{fmtBaht(c.cost)}</span>
            <span>{fmtNum(c.clicks)} คลิก</span>
            <span>CTR {ctr(c.clicks, c.impressions)}</span>
            <span>CPC {cpc(c.cost, c.clicks)}</span>
          </div>
        </div>
      ))}
    </div>
  )
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

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">กำลังโหลด...</div>
  if (error) return (
    <div className="p-4">
      <div className="bg-red-50 rounded-xl p-4 text-sm text-red-600">
        <p className="font-semibold">โหลดไม่ได้</p>
        <p className="text-[11px] mt-1">{error}</p>
      </div>
    </div>
  )
  if (!data) return null

  const totalCost = [...data.google.campaigns, ...data.facebook.campaigns].reduce((s, c) => s + c.cost, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
        <p className="text-[11px] opacity-80">ค่าโฆษณารวม (Google + Facebook)</p>
        <p className="text-3xl font-black mt-1">{fmtBaht(totalCost)}</p>
        <p className="text-[10px] opacity-60 mt-1">อัพเดต {data.updated}</p>
      </div>
      <PlatformCard title="Google Ads" logo="🔍" color="text-blue-700" bgColor="bg-blue-50" data={data.google} />
      <PlatformCard title="Facebook Ads" logo="📘" color="text-indigo-700" bgColor="bg-indigo-50" data={data.facebook} />
    </div>
  )
}
