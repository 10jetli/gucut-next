/* 🎨 ไอคอนเส้นในวงแบบ ZORT — **วาดเองทั้งหมด** (ห้ามเอาไอคอนของ ZORT มาใช้)
 *    ZORT ใช้ไอคอนเส้นในวงกลม: เหรียญ · กล่อง · รถส่งของ · เอกสาร · คน · กล่องซ้อน · ถูก (ดู DOM จอรายละเอียด 21 ต.ค. 2569)
 *    รับ "กุญแจ" เป็นสัญลักษณ์เดิมที่จอต่าง ๆ ใช้อยู่แล้ว (฿ ▤ ➤ 📄 👤 📦 💳 🚚 ▦ ✓) ⇒ ผู้เรียกแทบไม่ต้องเปลี่ยน
 *    กุญแจที่ไม่รู้จัก ⇒ แสดงตัวอักษรเดิม (ไม่หายไปเงียบ ๆ) */
import type { ReactNode } from 'react'

const เส้น = (d: ReactNode, กว้าง = 1.7) => (size: number, color?: string) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'}
    strokeWidth={กว้าง} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

const เหรียญ = เส้น(<><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.2c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 1.9 0 2.6 5.4 1.4 5.4 4.2 0 1.1-1.2 2-2.8 2-1.2 0-2.2-.5-2.7-1.3M12 6.5v11" /></>)
const กล่อง = เส้น(<><path d="M4 8.5l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8.5l8 4 8-4M12 12.5v8" /></>)
const รถ = เส้น(<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>)
const เอกสาร = เส้น(<><path d="M8 4h8l1 2v14H7V6z" /><path d="M9.5 3h5v3h-5zM10 11h4M10 14.5h4" /></>)
const คน = เส้น(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>)
const กล่องซ้อน = เส้น(<><path d="M12 3l4 2v4l-4 2-4-2V5z" /><path d="M8 11l4 2v4l-4 2-4-2v-4z" /><path d="M16 11l4 2v4l-4 2-4-2v-4z" /></>, 1.6)
const ถูก = เส้น(<path d="M5 12.5l4.5 4.5L19 7.5" />, 2.4)

const หมุด = เส้น(<><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>)
const ใบเสร็จ = เส้น(<><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path d="M9 8h6M9 11.5h6M9 15h4" /></>)
const สลับ = เส้น(<><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></>)

const ไอคอน: Record<string, (size: number, color?: string) => ReactNode> = {
  '📍': หมุด, '🧾': ใบเสร็จ, '⇄': สลับ,
  '฿': เหรียญ, '💳': เหรียญ,
  '▤': กล่อง, '📦': กล่อง,
  '➤': รถ, '🚚': รถ,
  '📄': เอกสาร,
  '👤': คน,
  '▦': กล่องซ้อน,
  '✓': ถูก,
}

/** `k` = สัญลักษณ์เดิม · `size` ขนาดไอคอน (วง 48 ใช้ ~24 · วง 32 ใช้ ~17) · `color` ไม่ใส่ = สีของตัวแม่ */
export default function ไอคอนZ({ k, size = 24, color }: { k: string; size?: number; color?: string }) {
  const วาด = ไอคอน[k]
  return <>{วาด ? วาด(size, color) : k}</>
}
