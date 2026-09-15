'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BILL_VENDORS } from '@/lib/vendors'
import { TH_MONTHS } from '@/lib/format'
import Card from '@/components/ui/Card'

// 7 เจ้าหลัก + Omise — กดช่องไหนเข้าไปดูบิลของเจ้านั้นเรียงเป็นเดือนๆ (ข้อมูลรวมอยู่ที่ lib/vendors.ts)
// 🔴 15 ก.ย. 2569 — ท่านประธานกากบาท www (Shopify) กับ Lazada ออกจากหน้ารวม
//    ซ่อนจากหน้านี้เท่านั้น **บิลเก่าไม่ได้ถูกลบ** และ /bills/<id> ยังเปิดได้
const VENDOR_LIST = [...BILL_VENDORS]
  .filter(v => !v.hiddenInGrid)
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

interface VendorStatus {
  id: string
  สถานะ: 'ปกติ' | 'ควรมาดู' | 'อัปมือ' | 'ไม่รู้'
  เหตุ: string
  เก็บโดย: { วิธี: string; รายละเอียด: string; รอบ: string } | null
  สแกนล่าสุด: string | null
  เจอบิลใหม่ล่าสุด: string | null
  ชั่วโมงที่แล้ว: number | null
  รวมทุกเดือน: number
  เดือนล่าสุดที่มีบิล: string | null
  จำนวนเดือนล่าสุด: number
}

/* 🔴 15 ก.ย. 2569 — ท่านประธานสั่ง: "ไปดึงบิลวันไหนล่าสุด อับเดตด้วย บอกสเตตัส"
   และ "ไปเก็บด้วยบอทตัวไหน เช่น g1 ด้วยการเขียนสคริปต์หรือ api หรือดึงเมล ต้องบอกด้วย"
   🔑 ทำให้ของที่ทำงานเงียบ ๆ อยู่เบื้องหลังมองเห็นได้ — ไม่งั้นไม่มีใครรู้ว่า
      เจ้าไหนเก็บเอง เจ้าไหนต้องคนทำ จนกว่าจะขาดแล้วรู้ตอนยื่นภาษี
   ⚠️ แยกสามสถานะเสมอ: ยังไม่โหลด / โหลดไม่สำเร็จ / ไม่มีข้อมูลจริง — ห้ามยุบเป็นเดียวกัน */
function เวลาไทย(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }) + ' น.'
  } catch { return '—' }
}

const สีสถานะ: Record<string, string> = {
  'ปกติ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'ควรมาดู': 'bg-amber-50 text-amber-800 border-amber-200',
  'อัปมือ': 'bg-orange-50 text-orange-700 border-orange-200',
  'ไม่รู้': 'bg-gray-100 text-gray-500 border-gray-200',
}
const ไอคอนวิธี: Record<string, string> = {
  'เมล': '📧', 'สคริปต์บน g1': '🤖', 'อัปมือ': '✋',
}

export default function BillsPage() {
  const [st, setSt] = useState<Record<string, VendorStatus> | null>(null)
  const [stErr, setStErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bills/status')
      .then(r => r.json())
      .then(j => {
        if (j.error) { setStErr(String(j.error)); return }
        setSt(Object.fromEntries((j.เจ้า ?? []).map((v: VendorStatus) => [v.id, v])))
      })
      .catch(e => setStErr(String(e)))
  }, [])

  return (
    <div className="max-w-[430px] mx-auto px-4 py-4">

      <div className="text-[15px] font-bold text-gray-800 mb-3">🧾 บิลค่าโฆษณา / บริการ (ส่งบัญชีทำภาษี)</div>

      {/* ช่องรายเจ้า — กดเข้าไปดูบิลเรียงเป็นเดือนๆ ของเจ้านั้น */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {VENDOR_LIST.map(v => (
          <Link
            key={v.id}
            href={`/bills/${v.id}`}
            className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 text-center active:bg-gray-50 flex flex-col items-center justify-center transition-all duration-200 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_28px_-14px_rgba(15,23,42,0.2)] hover:-translate-y-0.5"
          >
            {v.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logo} alt={v.name} className="h-8 mb-1.5 object-contain" />
            ) : (
              <div className="text-[30px] leading-none mb-1">{v.emoji}</div>
            )}
            <div className="text-[13px] font-bold text-gray-800">{v.name}</div>

            {/* สถานะการเก็บ — ใครเก็บ เก็บยังไง ล่าสุดเมื่อไหร่ */}
            {!st && !stErr && <div className="text-[9px] text-gray-300 mt-1">กำลังอ่านสถานะ…</div>}
            {stErr && <div className="text-[9px] text-gray-400 mt-1">อ่านสถานะไม่ได้</div>}
            {st && !st[v.id] && <div className="text-[9px] text-gray-400 mt-1">ไม่มีข้อมูลสถานะ</div>}
            {st?.[v.id] && (
              <div className="mt-1.5 w-full">
                <div className={`inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${สีสถานะ[st[v.id].สถานะ] ?? ''}`}>
                  {st[v.id].สถานะ}
                </div>
                {/* ⚠️ เหตุผลต้องอ่านออกครบ ห้ามบีบลงป้ายเล็กจนตัดหาย
                    คนอ่านต้องรู้ว่าติดเพราะอะไร ไม่ใช่แค่ว่า "ไม่ได้" */}
                {st[v.id].เหตุ && (
                  <div className="text-[9px] text-amber-800 bg-amber-50 rounded px-1.5 py-1 mt-1 leading-snug text-left">
                    {st[v.id].เหตุ}
                  </div>
                )}
                {st[v.id].เก็บโดย && (
                  <div className="text-[9px] text-gray-500 mt-1 leading-snug" title={st[v.id].เก็บโดย!.รายละเอียด}>
                    {ไอคอนวิธี[st[v.id].เก็บโดย!.วิธี] ?? '•'} {st[v.id].เก็บโดย!.วิธี}
                    <div className="text-[8px] text-gray-400">{st[v.id].เก็บโดย!.รอบ}</div>
                  </div>
                )}
                <div className="text-[9px] text-gray-400 leading-snug">
                  สแกนล่าสุด {เวลาไทย(st[v.id].สแกนล่าสุด)}
                </div>
                {/* ⚠️ "เจอบิลใหม่" คนละเรื่องกับ "สแกน" — เจ้าที่ไม่มีบิลใหม่ไม่ได้แปลว่าระบบพัง */}
                <div className="text-[9px] text-gray-400 leading-snug">
                  เจอบิลใหม่ {เวลาไทย(st[v.id].เจอบิลใหม่ล่าสุด)}
                </div>
                <div className="text-[9px] text-gray-400 leading-snug">
                  มีทั้งหมด {st[v.id].รวมทุกเดือน} ใบ
                </div>
              </div>
            )}

            <div className="text-[10px] text-blue-500 mt-1">ดูบิลรายเดือน →</div>
          </Link>
        ))}
      </div>

      {/* ZIP รวมทุกเจ้า แยกตามเดือน (จัดตามวันที่บนหัวบิล) */}
      <Card className="mb-3">
        <div className="text-[13px] font-bold text-gray-800 mb-1">📦 ดาวน์โหลด ZIP รวมทุกเจ้า (รายเดือน)</div>
        <div className="text-[10px] text-gray-400 mb-2">จัดไฟล์ตามวันที่บนหัวบิล · ใช้เวลาสร้าง ~30 วินาที</div>
        {lastMonths(12).map(mo => (
          <div key={mo.value} className="flex items-center justify-between border-t border-gray-100 py-2">
            <div className="text-[13px] text-gray-700">{mo.label}</div>
            <a
              href={`/api/bills/download?month=${mo.value}`}
              className="text-[12px] bg-emerald-50 text-emerald-600 rounded-full px-3 py-1 font-bold transition-colors hover:bg-emerald-100"
            >
              ⬇️ ZIP
            </a>
          </div>
        ))}
      </Card>
    </div>
  )
}
