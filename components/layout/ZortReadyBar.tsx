'use client'
// แถบป้าย "ใช้แทน ZORT ได้หรือยัง" — ขึ้นบนหัวทุกจอที่อยู่ในทะเบียน lib/zort-ready.ts
//
// เจ้าของร้านเริ่มใช้ admin.gucut.com เป็นจอหลักแทน ZORT (7 ก.ย. 2569) — ป้ายนี้คือคำตอบ
// ของคำถามเดียวที่เขาถามทุกครั้งที่เปิดจอ: "จอนี้วันนี้พึ่งได้แค่ไหน"
//
// ⚠️ วางไว้ใน layout กลางที่เดียว — **ห้ามไปแปะรายจอ** (ทะเบียนเดียว จุดวาดเดียว)
// ⚠️ จอที่ไม่อยู่ในทะเบียน = ไม่วาดอะไรเลย (เครื่องมือของเราเองที่ ZORT ไม่เคยมี)
import { usePathname } from 'next/navigation'
import { READY_BADGE, zortReadyOf } from '@/lib/zort-ready'

export default function ZortReadyBar() {
  const pathname = usePathname()
  const status = zortReadyOf(pathname ?? '')
  if (!status) return null
  const b = READY_BADGE[status]
  return (
    <div
      className={`px-4 md:px-6 py-1.5 text-[12px] border-b ${
        b.tone === 'green'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
          : 'bg-amber-50 text-amber-800 border-amber-100'
      }`}
    >
      {b.dot} <b>{b.text}</b>
      {status === 'readonly' && (
        <span className="text-amber-700/80"> — จนกว่าด่านดันสต็อก 3 แพลตฟอร์ม + สะพาน PEAK จะผ่าน</span>
      )}
    </div>
  )
}
