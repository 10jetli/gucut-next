/* 📐 การ์ดตัวเลขแบบ ZORT (โหมดเหมือน ZORT) — ใช้ร่วมกันหลายจอรายละเอียด
 *    วัด DOM /Product/Details 19 ต.ค. 2569: กล่องขาว มุม 6 ช่องใน 20 · ซ้ายวงไอคอน 48 · ขวาป้าย 14 w500 #3e3e3e
 *    · ค่า Lato 30 w600 สีประจำการ์ด · สัญลักษณ์ในวงเป็นของเราเอง (ไม่เอาไอคอนของ ZORT มาใช้)
 *    สีที่ใช้: คงเหลือ #ebf6ff/#2f8dde · พร้อมขาย #cefff1/#13af82 · ยอดขาย #d0daff/#4165ed · ค้าง/ยอดเดือนนี้ #ffebeb/#f25757
 *
 * 🔴 ค่าว่าง (`ว่าง: true`) = **ไม่รู้** ไม่ใช่ศูนย์ ⇒ ขึ้นสีเทาจาง และควรใส่ `เหตุ` ให้ชี้เมาส์อ่านได้
 */
import type { ReactNode } from 'react'
import ไอคอนZ from './ZortIcon'

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
  /** การ์ดที่ค่าเป็นข้อความ (วันที่) — ZORT ใช้ Kanit น้ำหนักปกติ ไม่ใช่ Lato หนา (วัด DOM /Warehouse/Details 19 ต.ค. 2569: Kanit 24/400) */
  ค่าเป็นข้อความ?: boolean
  /** บรรทัดเล็กใต้ตัวเลข — ใช้เมื่อเลขของเรา **คนละนิยาม** กับเลขป้ายเดียวกันของ ZORT (กฎแท็บข้อ 4: ต้องบอกบนจอ · title อ่านบนมือถือไม่ได้)
   *  ZORT ไม่มีบรรทัดนี้ ⇒ ใส่เฉพาะการ์ดที่ต่างจริง */
  ใต้?: string
}

/* 🎨 ไอคอนเส้นในวงมาจาก ZortIcon ตัวร่วม (ชุดเดียวกับจอรายละเอียดใบขาย/ซื้อ/โอน/เสนอราคา/รับคืน) */
const COLS: Record<number, string> = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

/** `ขนาดเลข` — ZORT ใช้ไม่เท่ากันต่อจอ: รายละเอียดสินค้า/คลัง 30 · รายละเอียดหมวด 20 (วัด DOM 19 ต.ค. 2569) */
export default function ZortKpiCards({ items, ขนาดเลข = 30 }: { items: ZortKpi[]; ขนาดเลข?: 20 | 24 | 30 }) {
  const เลข = ขนาดเลข === 20 ? 'text-[20px] leading-[20px]' : ขนาดเลข === 24 ? 'text-[24px] leading-[24px]' : 'text-[30px] leading-[30px]'
  return (
    <div className={`grid grid-cols-1 ${COLS[items.length] ?? 'sm:grid-cols-3'} gap-[30px]`}>
      {items.map(({ ป้าย, วง, สี, รูป, ค่า, ว่าง, เหตุ, ค่าเป็นข้อความ, ใต้ }) => (
        <div key={ป้าย} className="relative bg-white rounded-[6px] p-5 flex items-center justify-between gap-3" title={เหตุ || undefined}>
          <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold shrink-0" style={{ background: วง, color: สี }}><ไอคอนZ k={รูป} /></span>
          <div className="text-right min-w-0">
            {/* ป้าย Boon 14/500 — วัด DOM 19 ต.ค. 2569 ทั้ง /Product/Details กับ /Warehouse/Details (เดิม h2 รับ Kanit มาจากหัวเรื่อง) */}
            <h2 className="font-['Boon',sans-serif] text-[14px] font-medium text-[#3e3e3e] m-0">{ป้าย}</h2>
            <p className={`${ค่าเป็นข้อความ ? "font-['Kanit',sans-serif] font-normal" : "font-['Lato',sans-serif] font-semibold"} ${เลข} mt-1 m-0 break-words`} style={{ color: ว่าง ? '#ced4da' : สี }}>{ค่า}</p>
            {/* วางในช่องในล่าง 20 ของการ์ด (absolute) — การ์ดสามใบอยู่แถวเดียวกัน ถ้าดันความสูงใบหนึ่ง ทั้งแถวสูงตาม
                (preview fba4a278: ป้ายสามบรรทัดดันจอลง ~60 · พิกเซล 22.7 → 32.9) ⇒ ต้องสั้นบรรทัดเดียว */}
            {ใต้ && <p className="absolute right-5 bottom-[3px] text-[11.5px] leading-[15px] text-[#868e96] m-0 whitespace-nowrap">{ใต้}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
