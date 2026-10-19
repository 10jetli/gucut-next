/* 📐 การ์ดตัวเลขแบบ ZORT (โหมดเหมือน ZORT) — ใช้ร่วมกันหลายจอรายละเอียด
 *    วัด DOM /Product/Details 19 ต.ค. 2569: กล่องขาว มุม 6 ช่องใน 20 · ซ้ายวงไอคอน 48 · ขวาป้าย 14 w500 #3e3e3e
 *    · ค่า Lato 30 w600 สีประจำการ์ด · สัญลักษณ์ในวงเป็นของเราเอง (ไม่เอาไอคอนของ ZORT มาใช้)
 *    สีที่ใช้: คงเหลือ #ebf6ff/#2f8dde · พร้อมขาย #cefff1/#13af82 · ยอดขาย #d0daff/#4165ed · ค้าง/ยอดเดือนนี้ #ffebeb/#f25757
 *
 * 🔴 ค่าว่าง (`ว่าง: true`) = **ไม่รู้** ไม่ใช่ศูนย์ ⇒ ขึ้นสีเทาจาง และควรใส่ `เหตุ` ให้ชี้เมาส์อ่านได้
 */
import type { ReactNode } from 'react'

export interface ZortKpi {
  ป้าย: string
  /** สีพื้นวงไอคอน */
  วง: string
  /** สีไอคอน + ตัวเลข */
  สี: string
  รูป: string
  ค่า: ReactNode
  /** true = ยังไม่รู้ค่า ⇒ ตัวเลขสีเทาจาง */
  ว่าง?: boolean
  /** ข้อความเมื่อชี้เมาส์ (ที่มาของเลข / เหตุที่ว่าง) */
  เหตุ?: string
}

const COLS: Record<number, string> = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

/** `ขนาดเลข` — ZORT ใช้ไม่เท่ากันต่อจอ: รายละเอียดสินค้า/คลัง 30 · รายละเอียดหมวด 20 (วัด DOM 19 ต.ค. 2569) */
export default function ZortKpiCards({ items, ขนาดเลข = 30 }: { items: ZortKpi[]; ขนาดเลข?: 20 | 24 | 30 }) {
  const เลข = ขนาดเลข === 20 ? 'text-[20px] leading-[20px]' : ขนาดเลข === 24 ? 'text-[24px] leading-[24px]' : 'text-[30px] leading-[30px]'
  return (
    <div className={`grid grid-cols-1 ${COLS[items.length] ?? 'sm:grid-cols-3'} gap-[30px]`}>
      {items.map(({ ป้าย, วง, สี, รูป, ค่า, ว่าง, เหตุ }) => (
        <div key={ป้าย} className="bg-white rounded-[6px] p-5 flex items-center justify-between gap-3" title={เหตุ || undefined}>
          <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold shrink-0" style={{ background: วง, color: สี }}>{รูป}</span>
          <div className="text-right min-w-0">
            <h2 className="text-[14px] font-medium text-[#3e3e3e] m-0">{ป้าย}</h2>
            <p className={`font-['Lato',sans-serif] ${เลข} font-semibold mt-1 m-0 break-words`} style={{ color: ว่าง ? '#ced4da' : สี }}>{ค่า}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
