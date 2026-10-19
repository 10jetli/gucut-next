/* 📅 ตัวเลือกช่วงวันคู่ [วันที่][ย้อนหลัง 3 เดือน] ท้ายแถวค้นหา
 *
 * 📏 โหมดเหมือน ZORT — วัด DOM /Sell/list 20 ต.ค. 2569 ที่หน้าต่าง 1280 (ไม่คลิก):
 *    สองปุ่มติดกันเป็นก้อนเดียว กว้าง 120 สูง 30.6 · Kanit 12/400 #3e3e3e พื้นขาว · ช่องใน 4/8
 *    ขอบ 0.8px #adb5bd · มุม 4 เฉพาะด้านนอก (ตัวซ้ายมนซ้าย ตัวขวามนขวา) · ลูกศรสามเหลี่ยมทึบ 8×4 ห่างขวา 10
 *    ป้าย แสดง หน้าก้อน: Kanit 12 #495057 เว้นขวา 8
 *    ZORT ใช้ปุ่ม dropdown · ของเราคง select เดิม (ทำงานจริง) แค่แต่งให้หน้าตาเท่ากัน
 *    ลูกศรวาดเองเป็นสามเหลี่ยม SVG ไม่ได้เอาไฟล์ของเขามา
 * โหมดเดิม: คงคลาสเดิมทุกตัว */
import type { CSSProperties } from 'react'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

const เดิม = "font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2.5 py-1 bg-white"

const แบบZ = "appearance-none font-['Kanit',sans-serif] text-[12px] font-normal leading-[21px] text-[#3e3e3e] bg-white border-[0.8px] border-[#adb5bd] h-[30.6px] w-[120px] pl-2 pr-6 py-1 bg-no-repeat"

/** ตัวซ้ายของคู่ (มนซ้าย) · `max` = ความกว้างสูงสุดของโหมดเดิม */
export function คลาสวันซ้าย(max: string) {
  return เหมือนZORT ? `${แบบZ} rounded-l-[4px] rounded-r-none` : `${เดิม} ${max}`
}

/** ตัวขวาของคู่ (มนขวา) · `มีตัวซ้าย` = false เมื่อตัวซ้ายไม่ขึ้น (ท่อเก่า) ⇒ มนครบสี่มุม */
export function คลาสวันขวา(max: string, มีตัวซ้าย: boolean) {
  if (!เหมือนZORT) return `${เดิม} ${max}`
  return มีตัวซ้าย ? `${แบบZ} -ml-[0.8px] rounded-r-[4px] rounded-l-none` : `${แบบZ} rounded-[4px]`
}

/** ลูกศรสามเหลี่ยมทึบ 8×4 ห่างขวา 10 (โหมดเดิมใช้ลูกศรของเบราว์เซอร์ ⇒ ไม่ใส่) */
export const ลูกศรวัน: CSSProperties | undefined = เหมือนZORT
  ? {
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4'%3E%3Cpath d='M0 0h8L4 4z' fill='%233e3e3e'/%3E%3C/svg%3E\")",
      backgroundPosition: 'right 10px center',
      backgroundSize: '8px 4px',
    }
  : undefined

export const ป้ายแสดง = เหมือนZORT
  ? "font-['Kanit',sans-serif] text-[12px] text-[#495057] mr-2"
  : 'text-[12.5px] text-gray-500'
