'use client'
// แถบป้าย "ใช้แทน ZORT ได้หรือยัง" — ขึ้นบนหัวทุกจอที่อยู่ในทะเบียน lib/zort-ready.ts
//
// เจ้าของร้านเริ่มใช้ admin.gucut.com เป็นจอหลักแทน ZORT (7 ก.ย. 2569) — ป้ายนี้คือคำตอบ
// ของคำถามเดียวที่เขาถามทุกครั้งที่เปิดจอ: "จอนี้วันนี้พึ่งได้แค่ไหน"
//
// ⚠️ วางไว้ใน layout กลางที่เดียว — **ห้ามไปแปะรายจอ** (ทะเบียนเดียว จุดวาดเดียว)
// ⚠️ จอที่ไม่อยู่ในทะเบียน = ไม่วาดอะไรเลย (เครื่องมือของเราเองที่ ZORT ไม่เคยมี)
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ป้ายของเส้นทาง, กระทบสต็อก, ส่งจริงได้ } from '@/lib/zort-ready'
import PushSwitchNote from '@/components/layout/PushSwitchNote'
import { จำนวนกล่องแดง, ฟังกล่องแดง } from '@/lib/จอพังอยู่'

export default function ZortReadyBar() {
  const pathname = usePathname()
  /* 🔑 **ถ้อยคำทั้งหมดประกอบที่ lib/zort-ready.ts ที่เดียว** — จอนี้แค่วาด
     (ห้ามเติมประโยคตรงนี้อีก ไม่งั้นวันที่ความจริงเปลี่ยน จะต้องไล่แก้สองที่) */
  const b = ป้ายของเส้นทาง(pathname ?? '')
  /* 🔴 **จอกำลังอ่านข้อมูลไม่ได้อยู่หรือเปล่า** — ทะเบียนกลางบอกมาจาก `ErrorBox` ที่เพจวาด
     (เหตุผลเต็มอยู่ใน `lib/จอพังอยู่.ts` · คำตัดสินของ CEO 19 ก.ย. 2569) */
  const [พัง, setพัง] = useState(0)
  useEffect(() => {
    const อ่าน = () => setพัง(จำนวนกล่องแดง())
    อ่าน()
    return ฟังกล่องแดง(อ่าน)
  }, [pathname])

  if (!b) return null
  return (
    <>
    {/* ② **แถบนี้ต้องอยู่เหนือป้ายเสมอ** — คนอ่านจากบนลงล่าง ต้องเจอ "ตอนนี้อ่านข้อมูลไม่ได้"
        ก่อนเจอ "ใช้แทน ZORT ได้เลย" · ลำดับที่กลับกันคือเหตุที่สองบรรทัดอ่านขัดกัน
        ③ และต้องเด่นกว่าป้าย ⇒ พื้นแดงเข้ม ไม่ใช่เขียวอ่อน */}
    {พัง > 0 && (
      <div className="px-4 md:px-6 py-1.5 text-[12px] bg-red-600 text-white border-b border-red-700">
        ⛔ <b>ตอนนี้จอนี้อ่านข้อมูลไม่ได้</b> — ดูกล่องแดงข้างล่าง
        <span className="text-red-100"> · ป้ายข้างล่างบอก<b>ความสามารถของจอ</b> ไม่ได้บอกว่าข้อมูลรอบนี้มาครบ</span>
      </div>
    )}
    <div
      className={`px-4 md:px-6 py-1.5 text-[12px] border-b ${
        b.tone === 'green'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
          : 'bg-amber-50 text-amber-800 border-amber-100'
      }`}
    >
      {b.dot} <b>{b.หัว}</b>
      {b.ท้าย && <span className="text-amber-700/80"> — {b.ท้าย}</span>}
      {/* เฉพาะจอที่เอกสารทำให้สต็อกขยับ **และ** ส่งของจริงได้แล้ว — ที่เหลือเตือนไปก็เป็นเสียงรบกวน */}
      {กระทบสต็อก.has((pathname ?? '').replace(/\/+$/, '')) && ส่งจริงได้(pathname ?? '') && <PushSwitchNote />}
    </div>
    </>
  )
}
