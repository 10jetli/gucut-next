'use client'

import Link from 'next/link'
import { BILL_VENDORS } from '@/lib/vendors'
import { TH_MONTHS } from '@/lib/format'

// 7 เจ้าหลัก + Omise — กดช่องไหนเข้าไปดูบิลของเจ้านั้นเรียงเป็นเดือนๆ (ข้อมูลรวมอยู่ที่ lib/vendors.ts)
const VENDOR_LIST = [...BILL_VENDORS]
  .sort((a, b) => a.gridOrder - b.gridOrder)
  .map(v => ({ id: v.id, name: v.gridName, emoji: v.emoji, logo: v.logo }))

// รายการย้อนหลัง 12 เดือน สำหรับโหลด ZIP รวมทุกเจ้า
function lastMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear(), m = d.getMonth()
    out.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${TH_MONTHS[m]} ${y + 543}` })
    d.setMonth(m - 1)
  }
  return out
}

export default function BillsPage() {
  return (
    <div className="max-w-[430px] mx-auto px-4 py-4">

      <div className="text-[15px] font-bold text-gray-800 mb-3">🧾 บิลค่าโฆษณา / บริการ (ส่งบัญชีทำภาษี)</div>

      {/* ช่องรายเจ้า — กดเข้าไปดูบิลเรียงเป็นเดือนๆ ของเจ้านั้น */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {VENDOR_LIST.map(v => (
          <Link
            key={v.id}
            href={`/bills/${v.id}`}
            className="bg-white rounded-2xl shadow-sm p-4 text-center active:bg-gray-50 flex flex-col items-center justify-center"
          >
            {v.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logo} alt={v.name} className="h-8 mb-1.5 object-contain" />
            ) : (
              <div className="text-[30px] leading-none mb-1">{v.emoji}</div>
            )}
            <div className="text-[13px] font-bold text-gray-800">{v.name}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">ดูบิลรายเดือน →</div>
          </Link>
        ))}
      </div>

      {/* ZIP รวมทุกเจ้า แยกตามเดือน (จัดตามวันที่บนหัวบิล) */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-[13px] font-bold text-gray-800 mb-1">📦 ดาวน์โหลด ZIP รวมทุกเจ้า (รายเดือน)</div>
        <div className="text-[10px] text-gray-400 mb-2">จัดไฟล์ตามวันที่บนหัวบิล · ใช้เวลาสร้าง ~30 วินาที</div>
        {lastMonths(12).map(mo => (
          <div key={mo.value} className="flex items-center justify-between border-t border-gray-100 py-2">
            <div className="text-[13px] text-gray-700">{mo.label}</div>
            <a
              href={`/api/bills/download?month=${mo.value}`}
              className="text-[12px] bg-green-50 text-green-600 rounded-full px-3 py-1 font-bold"
            >
              ⬇️ ZIP
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
