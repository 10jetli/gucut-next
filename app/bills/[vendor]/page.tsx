'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BILL_VENDORS } from '@/lib/vendors'
import { TH_MONTHS, EN_MONTHS } from '@/lib/format'
import Card from '@/components/ui/Card'

// ข้อมูล vendor รวมอยู่ที่ lib/vendors.ts
const VENDOR_INFO: Record<string, { name: string; emoji: string; note?: string; portal?: string }> =
  Object.fromEntries(BILL_VENDORS.map(v => [v.id, { name: v.name, emoji: v.emoji, note: v.note, portal: v.portal }]))

interface BillFile {
  filename: string
  messageId: string
  attachmentId: string
  size: number
  subject: string
}

export default function VendorPage({ params }: { params: { vendor: string } }) {
  const info = VENDOR_INFO[params.vendor] ?? { name: params.vendor, emoji: '🧾' }
  const [data, setData] = useState<{ months: Record<string, BillFile[]>; staleReason?: string; lastScan?: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [zipping, setZipping] = useState<string | null>(null)   // เดือนที่กำลังรวมไฟล์อยู่

  /* 🔴 15 ก.ย. 2569 — ท่านประธานสั่งเพิ่มปุ่ม "โหลดทั้งหมด" ต่อเดือน (TikTok เดือนละ 8-10 ใบ)
     ⚠️ ต้องมีสถานะ "กำลังรวมไฟล์" ให้เห็น — ฝั่งเซิร์ฟเวอร์ต้องดึงไฟล์จาก Gmail ทีละใบ
        ใช้เวลาหลายสิบวินาที ถ้าไม่บอกอะไรเลย คนจะนึกว่าปุ่มเสียแล้วกดซ้ำ ๆ จนยิงซ้อนกัน
     ⚠️ ห้ามยิงโหลดทีละใบรัว ๆ — เบราว์เซอร์บล็อก และกินโควตา Gmail จนชนเพดาน */
  async function โหลดทั้งเดือน(m: string) {
    if (zipping) return                       // กันกดซ้อน
    setZipping(m)
    try {
      const r = await fetch(`/api/bills/zip?month=${m}&vendor=${params.vendor}`)
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `ดึงไม่สำเร็จ (${r.status})`)
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${info.name} ${m}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e: any) {
      setErr(`โหลดทั้งเดือน ${m} ไม่สำเร็จ: ${String(e?.message ?? e)}`)
    } finally {
      setZipping(null)
    }
  }

  useEffect(() => {
    fetch(`/api/bills/vendor?vendor=${params.vendor}`)
      .then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setData(j) })
      .catch(e => setErr(String(e)))
  }, [params.vendor])

  const months = data ? Object.keys(data.months).sort().reverse() : []

  return (
    <div className="max-w-[430px] lg:max-w-[1000px] mx-auto px-4 py-4">
      <Link href="/bills" className="text-[13px] text-blue-600 font-medium hover:text-blue-700">← กลับหน้าบิล</Link>
      {/* 🔗 ลิงก์ต้นทาง — ท่านประธานสั่ง 15 ก.ย. 2569 "ใส่ลิงก์ไว้ด้วย"
          🔴 รอบแรกทำเป็นตัวหนังสือเล็กสีจาง ⇒ ท่านเปิดหน้าแล้วบอก "ยังไม่เจอลิ้งค์เลย"
             ทั้งที่มันอยู่บนจอจริง ⇒ **ของที่มองไม่เห็น เท่ากับไม่มี**
             ⇒ ทำเป็นปุ่มสีชัด อยู่แถวเดียวกับชื่อเจ้า มุมที่ตามองก่อน
          ⚠️ แสดงเฉพาะเจ้าที่มีลิงก์ยืนยันแล้ว — ลิงก์มั่วพาไปผิดบัญชี
             แล้วคนจะสรุปว่า "ไม่มีบิล" ทั้งที่ดูผิดที่ */}
      <div className="flex items-center justify-between gap-2 mt-2 mb-1">
        <div className="text-[17px] font-bold text-gray-800">{info.emoji} {info.name}</div>
        {info.portal && (
          <a href={info.portal} target="_blank" rel="noreferrer"
             title={`เปิดหน้าบิลของ ${info.name} ที่ต้นทาง — ใช้เทียบว่าคลังเราครบไหม`}
             className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium
                        bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm">
            🔗 เปิดหน้าบิลต้นทาง ↗
          </a>
        )}
      </div>
      {info.note && <div className="text-[11px] text-gray-400 mb-3">{info.note}</div>}

      {!data && !err && (
        <Card className="p-6 text-center text-gray-400 text-[13px]">
          กำลังสแกนบิลย้อนหลัง 1 ปี และอ่านวันที่บนหัวบิลทุกใบ…<br />อาจใช้เวลา 20–40 วินาที
        </Card>
      )}

      {err && (
        <div className="rounded-2xl p-4 border border-red-200 bg-red-50 text-red-600 text-[13px]">⚠️ {err}</div>
      )}

      {/* 🔴 15 ก.ย. 2569 — ก่อนหน้านี้ Gmail โควตาเต็มแล้วจอขึ้น error แดงเต็มหน้า ไม่โชว์บิลเลย
          ทั้งที่ของเก่าเก็บไว้ครบ ⇒ เอา "ดึงไม่สำเร็จ" ไปแสดงเป็น "ไม่มีข้อมูล"
          ตอนนี้โชว์บิลเก่าตามปกติ + ป้ายเหลืองบอกตรง ๆ ว่ายังไม่ได้สแกนใหม่เพราะอะไร
          ⚠️ ป้ายต้องอยู่ **เหนือรายการ** — ถ้าต้องเลื่อนจอถึงเห็น เท่ากับไม่มี */}
      {data?.staleReason && (
        <div className="rounded-2xl p-3 border border-amber-200 bg-amber-50 text-amber-800 text-[12px] mb-3">
          <div className="font-medium">⚠️ กำลังแสดงรายการที่เก็บไว้ล่าสุด — ยังไม่ได้สแกนอีเมลรอบใหม่</div>
          {data.lastScan && (
            <div className="mt-1 opacity-80">
              สแกนล่าสุด {new Date(data.lastScan).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} น. (เวลาไทย)
            </div>
          )}
          <div className="mt-1 opacity-70">
            {/^.*(quota|429|403).*$/i.test(data.staleReason)
              ? 'สาเหตุ: โควตา Gmail ต่อนาทีเต็ม (เปิดหน้าบิลหลายเจ้าติดกัน) — รอสักครู่แล้วรีเฟรช บิลไม่ได้หายไปไหน'
              : `สาเหตุ: ${data.staleReason.slice(0, 160)}`}
          </div>
        </div>
      )}

      {data && !months.length && (
        <Card className="p-6 text-center text-gray-400 text-[13px]">
          ยังไม่พบบิลของเจ้านี้ในเมล 10jetli@gmail.com<br />
          <span className="text-[11px]">(ถ้าบิลอยู่อีเม෥อื่น ให้ forward มาที่เมลหลักก่อน)</span>
        </Card>
      )}

      {months.map(m => {
        const [y, mo] = m.split('-').map(Number)
        return (
          <Card key={m} className="mb-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-[14px] font-bold text-gray-800">
                📅 <span className="text-red-600">{mo} ({EN_MONTHS[mo - 1]}) {y}</span>
                <span className="mx-1 text-gray-300">·</span>
                {TH_MONTHS[mo - 1]} {y + 543}
                <span className="ml-2 text-[11px] font-normal text-gray-400">{data!.months[m].length} ใบ</span>
              </div>
              <button
                onClick={() => โหลดทั้งเดือน(m)}
                disabled={!!zipping}
                title={`รวมบิลทั้ง ${data!.months[m].length} ใบของเดือนนี้เป็นไฟล์ ZIP ไฟล์เดียว`}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition ${
                  zipping === m
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : zipping
                      ? 'bg-gray-50 border-gray-200 text-gray-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}>
                {zipping === m ? '⏳ กำลังรวมไฟล์…' : '⬇️ โหลดทั้งเดือน'}
              </button>
            </div>
            {zipping === m && (
              <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mb-1">
                กำลังดึงบิลทีละใบจากอีเมล อาจใช้เวลา 20–40 วินาที — ยังไม่ต้องกดซ้ำ
              </div>
            )}
            {data!.months[m].map((f, i) => (
              <div key={i} className="flex items-center justify-between border-t border-gray-100 py-2 gap-2">
                <div className="text-[12px] lg:text-[13px] text-gray-700 break-all flex-1">
                  📎 {f.filename}
                  {f.size > 0 && <span className="text-[10px] text-gray-400 ml-1">({Math.max(1, Math.round(f.size / 1024))} KB)</span>}
                </div>
                {f.attachmentId && (
                  <a
                    href={`/api/bills/file?messageId=${f.messageId}&attachmentId=${encodeURIComponent(f.attachmentId)}&name=${encodeURIComponent(m + '_' + f.filename)}`}
                    className="text-[12px] bg-emerald-50 text-emerald-600 rounded-full px-3 py-1 font-bold whitespace-nowrap transition-colors hover:bg-emerald-100"
                  >
                    ⬇️ โหลด
                  </a>
                )}
              </div>
            ))}
          </Card>
        )
      })}
    </div>
  )
}
