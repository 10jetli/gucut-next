/* 📐 หัวการ์ดแบบ ZORT (โหมดเหมือน ZORT) — วงไอคอน 34 + ชื่อ Kanit 24 w500 #3e3e3e
 *    วัดจากภาพ /Dashboard/ContactReport · /Product/CategoryDetail 19 ต.ค. 2569 (ที่ซูม 125%: วง 42 · ตัวอักษร 30)
 *    สัญลักษณ์ในวงเป็นของเราเอง (ไม่เอาไอคอนของ ZORT) · สีวงเดียวกับการ์ดสถานะ ZORT_ICON_BG / ZORT_BLUE
 */
import type { ReactNode } from 'react'
import { ZORT_ICON_BG, ZORT_BLUE } from './index'

export default function ZortCardTitle({ รูป, children }: { รูป: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span aria-hidden className="w-[34px] h-[34px] rounded-full grid place-items-center text-[16px] shrink-0" style={{ background: ZORT_ICON_BG, color: ZORT_BLUE }}>{รูป}</span>
      <span className="font-['Kanit',sans-serif] text-[24px] leading-[30px] font-medium text-[#3e3e3e] truncate">{children}</span>
    </span>
  )
}
