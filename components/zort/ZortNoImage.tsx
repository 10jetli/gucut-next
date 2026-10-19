/* 🖼 กล่อง "ไม่มีรูป" ในตารางสินค้า/สินค้าเป็นชุด
 *    โหมดเหมือน ZORT: กล่องเทา 50×50 มีสัญลักษณ์รูปภาพตรงกลาง (วัดจากภาพ /Bundle/list 19 ต.ค. 2569: 62px ที่ซูม 125%)
 *    · สัญลักษณ์วาดเองด้วย SVG เส้นง่าย ๆ — ไม่เอาไอคอนของ ZORT มาใช้
 *    นอกโหมด: กล่องเทา 40×40 เหมือนเดิม
 *    `title` = เหตุที่ไม่มีรูป (ใส่เมื่อรู้ — ตารางไม่มีที่ให้เขียนเต็ม)
 */
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export default function ZortNoImage({ title }: { title?: string }) {
  if (!เหมือนZORT) return <span className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0" title={title} />
  return (
    <span className="grid place-items-center w-[50px] h-[50px] rounded-[3px] bg-[#e9ecef] shrink-0" title={title}>
      <svg aria-hidden width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="#adb5bd" strokeWidth="1.6">
        <rect x="1" y="1" width="20" height="16" rx="2" />
        <circle cx="7" cy="6.5" r="1.8" />
        <path d="M2 15l6-6 4 4 3-3 5 5" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
