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
        /* 📏 ZORT (วัด DOM แดชบอร์ด + จอรายละเอียด 17 ต.ค. 2569): การ์ดพื้นขาว มุม 6 ไม่มีขอบ ไม่มีเงา ช่องใน 20
           ⚠️ การ์ดที่กดได้ยังมีเงาบาง ๆ ตอนชี้ — ไม่งั้นมองไม่ออกว่ากดได้ (ZORT ไม่มีการ์ดกดได้บนจอที่วัด) */
        'bg-white rounded-md',
        hover ? 'transition-shadow duration-200 hover:shadow-[0_3px_6px_rgba(65,101,237,0.15)]' : '',
        padded ? 'p-4 md:p-5' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </As>
  )
}
