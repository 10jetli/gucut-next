'use client'
/* 🚨 แถบแจ้งเตือนการดันสต็อกไปแพลตฟอร์มหยุด — วางหน้าแรก (ที่ท่านประธานเปิดบ่อยสุด)
 *
 * ที่มา 16 ต.ค. 2569: สต็อก Lazada หยุดอัปเดต 10 วัน ความจริงอยู่ใน ?pushstate=1 ตลอด แต่อยู่ในหน้าที่ไม่มีใครเปิด
 * ⇒ คำเตือนต้องอยู่ในที่ที่คนเห็น · สามสถานะตาม lib/stock-push-state.ts (หยุด / ไม่รู้ / ปกติ — ไม่รู้ห้ามเขียว)
 *
 * ⚖️ **ข้อยกเว้นกฎ "หน้าสถานะห้ามเช็คอัตโนมัติ"** — CEO ตัดสิน 16 ต.ค. 2569 เพราะ ?pushstate=1 อ่านฐานของเราอย่างเดียว
 *    ไม่ยิงแพลตฟอร์ม ⇒ ดึงครั้งเดียวตอนเปิดหน้า **ห้าม poll ซ้ำ** และเขียนกำกับบนจอว่าอ่านจากฐานของเราเอง
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { อ่านสถานะดันสต็อก, ชื่อช่องทาง, type ผลดันสต็อก } from '@/lib/stock-push-state'
import { thaiDayTime } from '@/components/zort/DataFreshness'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export default function StockPushAlert() {
  const [r, setR] = useState<ผลดันสต็อก | null>(null)
  useEffect(() => {
    let ยัง = true
    fetch('/api/web/core?pushstate=1').then((x) => x.json())
      .then((j) => { if (ยัง) setR(อ่านสถานะดันสต็อก(j)) })
      .catch(() => { if (ยัง) setR(อ่านสถานะดันสต็อก(null)) })
    return () => { ยัง = false }
  }, [])
  if (!r) return null
  const กำกับ = <span className="text-[11.5px] text-gray-400"> · อ่านจากฐานของเราเอง ไม่ได้ยิงถามแพลตฟอร์ม</span>
  if (r.สถานะ === 'หยุด' && เหมือนZORT) {
    /* 📐 โหมดเหมือน ZORT: ถ้อยคำเตือนเหมือนเดิมทุกคำ แต่รวมเป็นบรรทัดเดียว (ลิงก์ต่อท้าย · ที่มาของข้อมูลอยู่ใน title)
       ⇒ ยังแดง ยังเห็นก่อนการ์ด แต่ไม่ดันทั้งหน้าลงสองบรรทัด */
    return (
      <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-[12.5px] text-red-800 leading-relaxed">
        {r.ราย.filter((x) => x.หยุด).map((x, i, a) => (
          <span key={x.ช่องทาง}>
            🔴 <b>สต็อกบน {ชื่อช่องทาง(x.ช่องทาง)} หยุดอัปเดตมา {Math.floor((x.ชม as number) / 24).toLocaleString('th-TH')} วัน</b>
            {x.at && <> (ตั้งแต่ {thaiDayTime(new Date(x.at))} เวลาไทย)</>} — <b>เสี่ยงขายเกินสต็อก</b>
            {i < a.length - 1 ? ' · ' : ''}
          </span>
        ))}
        {' · '}
        <Link href="/settings/connections" className="text-red-900 underline" title="อ่านจากฐานของเราเอง ไม่ได้ยิงถามแพลตฟอร์ม">ดูเหตุและวิธีแก้</Link>
      </div>
    )
  }
  if (r.สถานะ === 'หยุด') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-[12.5px] text-red-800 leading-relaxed">
        {r.ราย.filter((x) => x.หยุด).map((x) => (
          <p key={x.ช่องทาง}>
            🔴 <b>สต็อกบน {ชื่อช่องทาง(x.ช่องทาง)} หยุดอัปเดตมา {Math.floor((x.ชม as number) / 24).toLocaleString('th-TH')} วัน</b>
            {x.at && <> (ตั้งแต่ {thaiDayTime(new Date(x.at))} เวลาไทย)</>} — <b>เสี่ยงขายเกินสต็อก</b>
          </p>
        ))}
        <p className="mt-1">
          <Link href="/settings/connections" className="text-red-900 underline">ดูเหตุและวิธีแก้ที่หน้าเชื่อมต่อบริการอื่น</Link>
          {กำกับ}
        </p>
      </div>
    )
  }
  if (r.สถานะ === 'ไม่รู้') {
    return (
      <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[12.5px] text-gray-600">
        ⚪ <b>ยังไม่รู้</b>ว่าการดันสต็อกไปแพลตฟอร์มทำงานปกติไหม — {r.เหตุไม่รู้ ?? 'ตัดสินไม่ได้รอบนี้'}{กำกับ}
      </p>
    )
  }
  return (
    <p className="text-[11.5px] text-gray-500">
      ✓ ดันสต็อกไป {r.ราย.map((x) => ชื่อช่องทาง(x.ช่องทาง)).join(' · ')} ปกติ{กำกับ}
    </p>
  )
}
