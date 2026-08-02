// การ์ดพื้นฐานของระบบ — ใช้แทน markup ซ้ำ "bg-white rounded-xl shadow-sm border" ที่เคย copy วางทุกหน้า
// เพิ่ม prop hover สำหรับการ์ดที่กดได้ (ยกเงาตอน hover), padded=false เมื่ออยากคุมระยะขอบเอง (เช่น การ์ดที่มีรายการซ้อนใน)
import type { ReactNode } from 'react'

export default function Card({
  children,
  className = '',
  padded = true,
  hover = false,
  as: As = 'div',
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  hover?: boolean
  as?: 'div' | 'section'
}) {
  return (
    <As
      className={[
        'bg-white rounded-2xl border border-gray-100/80',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]',
        hover ? 'transition-all duration-200 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_18px_32px_-16px_rgba(15,23,42,0.2)] hover:-translate-y-0.5' : '',
        padded ? 'p-4 md:p-5' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </As>
  )
}
