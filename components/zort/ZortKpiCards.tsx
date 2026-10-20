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
  /** การ์ดที่ค่าเป็นข้อความ (วันที่) — ZORT ใช้ Kanit น้ำหนักปกติ ไม่ใช่ Lato หนา (วัด DOM /Warehouse/Details 19 ต.ค. 2569: Kanit 24/400) */
  ค่าเป็นข้อความ?: boolean
}

/* 🎨 ไอคอนเส้นในวง — **วาดเอง** (ZORT ใช้ไอคอนเส้น กล่องซ้อน · เครื่องหมายถูก · เหรียญ · DOM 21 ต.ค. 2569 — ห้ามเอาไอคอนของเขามาใช้)
   รับสัญลักษณ์เดิม ▦ ✓ ฿ จากทุกจอที่เรียกอยู่ ⇒ ไม่ต้องแก้ผู้เรียก · สัญลักษณ์อื่นแสดงตามเดิม */
const ไอคอน: Record<string, ReactNode> = {
  '▦': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l4 2v4l-4 2-4-2V5z" /><path d="M8 11l4 2v4l-4 2-4-2v-4z" /><path d="M16 11l4 2v4l-4 2-4-2v-4z" /></svg>,
  '✓': <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  '฿': <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.2c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 1.9 0 2.6 5.4 1.4 5.4 4.2 0 1.1-1.2 2-2.8 2-1.2 0-2.2-.5-2.7-1.3M12 6.5v11" /></svg>,
}

const COLS: Record<number, string> = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

/** `ขนาดเลข` — ZORT ใช้ไม่เท่ากันต่อจอ: รายละเอียดสินค้า/คลัง 30 · รายละเอียดหมวด 20 (วัด DOM 19 ต.ค. 2569) */
export default function ZortKpiCards({ items, ขนาดเลข = 30 }: { items: ZortKpi[]; ขนาดเลข?: 20 | 24 | 30 }) {
  const เลข = ขนาดเลข === 20 ? 'text-[20px] leading-[20px]' : ขนาดเลข === 24 ? 'text-[24px] leading-[24px]' : 'text-[30px] leading-[30px]'
  return (
    <div className={`grid grid-cols-1 ${COLS[items.length] ?? 'sm:grid-cols-3'} gap-[30px]`}>
      {items.map(({ ป้าย, วง, สี, รูป, ค่า, ว่าง, เหตุ, ค่าเป็นข้อความ }) => (
        <div key={ป้าย} className="bg-white rounded-[6px] p-5 flex items-center justify-between gap-3" title={เหตุ || undefined}>
          <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold shrink-0" style={{ background: วง, color: สี }}>{ไอคอน[รูป] ?? รูป}</span>
          <div className="text-right min-w-0">
            {/* ป้าย Boon 14/500 — วัด DOM 19 ต.ค. 2569 ทั้ง /Product/Details กับ /Warehouse/Details (เดิม h2 รับ Kanit มาจากหัวเรื่อง) */}
            <h2 className="font-['Boon',sans-serif] text-[14px] font-medium text-[#3e3e3e] m-0">{ป้าย}</h2>
            <p className={`${ค่าเป็นข้อความ ? "font-['Kanit',sans-serif] font-normal" : "font-['Lato',sans-serif] font-semibold"} ${เลข} mt-1 m-0 break-words`} style={{ color: ว่าง ? '#ced4da' : สี }}>{ค่า}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
