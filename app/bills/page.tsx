'use client'

import { useState } from 'react'
import Header from '@/components/Header'

interface Bill {
  vendorId: string
  vendorName: string
  emoji: string
  messageId: string
  date: string
  subject: string
  from: string
  snippet: string
  amounts: string[]
  attachments: { filename: string; size: number }[]
}
interface BillsResponse {
  month: string
  bills: Bill[]
  missing: { id: string; name: string; emoji: string }[]
  errors: string[]
}

// เดือนก่อนหน้าเป็นค่าเริ่มต้น (บิลเดือนที่เพิ่งจบ)
function prevMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function BillsPage() {
  const [month, setMonth] = useState(prevMonth())
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BillsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchBills() {
    setLoading(true); setError(null); setData(null)
    try {
      const res = await fetch(`/api/bills?month=${month}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const byVendor = new Map<string, Bill[]>()
  data?.bills.forEach(b => {
    byVendor.set(b.vendorName, [...(byVendor.get(b.vendorName) ?? []), b])
  })

  return (
    <>
      <Header />
      <div className="scroll-area">

        {/* เลือกเดือน + ปุ่มดึงบิล */}
        <div className="card p-4 mb-3">
          <div className="text-[13px] font-bold text-gray-800 mb-2">🧾 ดึงบิลค่าโฆษณา / บริการ (ส่งบัญชีทำภาษี)</div>
          <div className="flex gap-2">
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[14px]"
            />
            <button
              onClick={fetchBills}
              disabled={loading}
              className="bg-blue-500 disabled:bg-gray-300 text-white font-bold rounded-xl px-4 py-2 text-[14px]"
            >
              {loading ? 'กำลังค้นหา…' : 'ดึงบิล'}
            </button>
          </div>
          {data && data.bills.length > 0 && (
            <a
              href={`/api/bills/download?month=${data.month}`}
              className="block mt-3 bg-green-500 text-white font-bold rounded-xl px-4 py-2.5 text-[14px] text-center"
            >
              ⬇️ ดาวน์โหลดทั้งหมด (Ads {data.month}.zip)
            </a>
          )}
        </div>

        {loading && (
          <div className="card p-6 text-center text-gray-400 text-[13px]">
            กำลังค้นหาบิลจาก Gmail ทุกเจ้า… อาจใช้เวลา 10–30 วินาที
          </div>
        )}

        {error && (
          <div className="card p-4 mb-3 border border-red-200 bg-red-50 text-red-600 text-[13px]">
            ⚠️ {error}
          </div>
        )}

        {/* รายการบิลที่พบ แยกตามเจ้า */}
        {data && Array.from(byVendor.entries()).map(([vendorName, bills]) => (
          <div key={vendorName} className="card p-4 mb-3">
            <div className="text-[13px] font-bold text-gray-800 mb-2">
              {bills[0].emoji} {vendorName}
              <span className="ml-2 text-[11px] font-normal text-gray-400">{bills.length} ฉบับ</span>
            </div>
            {bills.map((b: Bill) => (
              <div key={b.messageId} className="border-t border-gray-100 py-2">
                <div className="flex justify-between gap-2">
                  <div className="text-[12px] text-gray-700 flex-1">{b.subject}</div>
                  <div className="text-[11px] text-gray-400 whitespace-nowrap">{b.date.slice(0, 10)}</div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {b.amounts.map((a: string) => (
                    <span key={a} className="text-[11px] bg-green-50 text-green-600 rounded-full px-2 py-0.5 font-bold">{a}</span>
                  ))}
                  {b.attachments.map((a: { filename: string; size: number }) => (
                    <span key={a.filename} className="text-[11px] bg-blue-50 text-blue-500 rounded-full px-2 py-0.5">📎 {a.filename}</span>
                  ))}
                  {!b.attachments.length && (
                    <span className="text-[11px] bg-yellow-50 text-yellow-600 rounded-full px-2 py-0.5">ไม่มีไฟล์แนบ</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* เจ้าที่ไม่พบบิล */}
        {data && data.missing.length > 0 && (
          <div className="card p-4 mb-3 border border-yellow-200 bg-yellow-50">
            <div className="text-[13px] font-bold text-yellow-700 mb-1">⚠️ ไม่พบบิลเดือนนี้</div>
            <div className="text-[12px] text-yellow-700">
              {data.missing.map(m => `${m.emoji} ${m.name}`).join(' · ')}
            </div>
            <div className="text-[11px] text-yellow-600 mt-1">
              บิลบางเจ้าอาจส่งเข้าอีเมลอื่น (เช่น gucut@icloud.com / gucut1@gmail.com) — ตั้ง forward มาที่ Gmail หลักเพื่อให้ดึงได้ครบ
            </div>
          </div>
        )}

        {data?.errors && data.errors.length > 0 && (
          <div className="card p-4 mb-3 text-[11px] text-gray-400">
            {data.errors.map(e => <div key={e}>• {e}</div>)}
          </div>
        )}
      </div>
    </>
  )
}
