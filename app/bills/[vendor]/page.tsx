'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

const VENDOR_INFO: Record<string, { name: string; emoji: string; note?: string }> = {
  tiktok:  { name: 'TikTok Ads',        emoji: '🎵' },
  meta:    { name: 'Facebook/Meta Ads', emoji: '📘', note: 'เฉพาะบัญชี GUCUTใหม่ (263190084598096)' },
  google:  { name: 'Google Ads',        emoji: '🔍' },
  shopify: { name: 'www (Shopify)',     emoji: '🛒', note: 'ปกติเดือนละ 2 ใบ (ค่าแพ็คเกจ + ค่าแอป)' },
  line:    { name: 'LINE',              emoji: '💚' },
  adobe:   { name: 'Adobe',             emoji: '🅰️' },
  apple:   { name: 'Apple / iCloud',    emoji: '🍎' },
  omise:   { name: 'Omise',             emoji: '💳' },
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return `${TH_MONTHS[mo - 1]} ${y + 543}`
}

interface BillFile {
  filename: string
  messageId: string
  attachmentId: string
  size: number
  subject: string
}

export default function VendorPage({ params }: { params: { vendor: string } }) {
  const info = VENDOR_INFO[params.vendor] ?? { name: params.vendor, emoji: '🧾' }
  const [data, setData] = useState<{ months: Record<string, BillFile[]> } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/bills/vendor?vendor=${params.vendor}`)
      .then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setData(j) })
      .catch(e => setErr(String(e)))
  }, [params.vendor])

  const months = data ? Object.keys(data.months).sort().reverse() : []

  return (
    <div className="max-w-[430px] mx-auto px-4 py-4">
      <Link href="/bills" className="text-[13px] text-blue-500">← กลับหน้าบิล</Link>
      <div className="text-[17px] font-bold text-gray-800 mt-2 mb-1">{info.emoji} {info.name}</div>
      {info.note && <div className="text-[11px] text-gray-400 mb-3">{info.note}</div>}

      {!data && !err && (
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-400 text-[13px]">
          กำลังสแกนบิลย้อนหลัง 1 ปี และอ่านวันที่บนหัวบิลทุกใบ…<br />อาจใช้เวลา 20–40 วินาที
        </div>
      )}

      {err && (
        <div className="rounded-2xl p-4 border border-red-200 bg-red-50 text-red-600 text-[13px]">⚠️ {err}</div>
      )}

      {data && !months.length && (
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-400 text-[13px]">
          ยังไม่พบบิลของเจ้านี้ในเมล 10jetli@gmail.com<br />
          <span className="text-[11px]">(ถ้าบิลอยู่อีเมลอื่น ให้ forward มาที่เมลหลักก่อน)</span>
        </div>
      )}

      {months.map(m => (
        <div key={m} className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="text-[14px] font-bold text-gray-800 mb-1">
            📅 {monthLabel(m)}
            <span className="ml-2 text-[11px] font-normal text-gray-400">{data!.months[m].length} ใบ</span>
          </div>
          {data!.months[m].map((f, i) => (
            <div key={i} className="flex items-center justify-between border-t border-gray-100 py-2 gap-2">
              <div className="text-[12px] text-gray-700 break-all flex-1">
                📎 {f.filename}
                {f.size > 0 && <span className="text-[10px] text-gray-400 ml-1">({Math.max(1, Math.round(f.size / 1024))} KB)</span>}
              </div>
              {f.attachmentId && (
                <a
                  href={`/api/bills/file?messageId=${f.messageId}&attachmentId=${encodeURIComponent(f.attachmentId)}&name=${encodeURIComponent(m + '_' + f.filename)}`}
                  className="text-[12px] bg-green-50 text-green-600 rounded-full px-3 py-1 font-bold whitespace-nowrap"
                >
                  ⬇️ โหลด
                </a>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
