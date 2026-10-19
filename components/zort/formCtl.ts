/* 🎛️ ตัวเลือก (select) กับช่องค้นหาในการ์ดรายงาน
 *
 * 📏 โหมดเหมือน ZORT — วัด DOM /Dashboard/ProductReport 20 ต.ค. 2569 ที่หน้าต่าง 1280 (ไม่คลิก):
 *    ตัวเลือกทุกตัว: Boon 14/400 #3e3e3e พื้นขาว สูง 40 · ขอบ 0.8px #adb5bd มุม 4 · ช่องใน 4/12
 *      (สินค้าจม · สินค้าใกล้หมด · คลัง กว้าง 200 · รายคลัง กว้างตามข้อความ 94)
 *    ช่องค้นหา: แบบเดียวกันแต่มุม 24 · เว้นซ้าย 42 (ไอคอนแว่นขยาย) · กว้าง 200
 *    แว่นขยายวาดเองเป็น SVG ไม่ได้เอาไอคอนของเขามา
 * โหมดเดิม: คืนคลาสที่จอส่งมา (`เดิม`) ⇒ ไม่เปลี่ยนอะไร */
import type { CSSProperties } from 'react'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

const ตัวเลือกZ = "font-['Boon',sans-serif] text-[14px] font-normal text-[#3e3e3e] bg-white h-10 border-[0.8px] border-[#adb5bd] rounded-[4px] px-3 py-1"

/** `กว้าง` = คลาสความกว้างในโหมด ZORT (เช่น w-[200px]) · ว่าง = กว้างตามข้อความ */
export function คลาสตัวเลือก(เดิม: string, กว้าง = '') {
  return เหมือนZORT ? `${ตัวเลือกZ} ${กว้าง}`.trim() : เดิม
}

export function คลาสช่องค้น(เดิม: string) {
  return เหมือนZORT
    ? "font-['Boon',sans-serif] text-[14px] text-[#3e3e3e] bg-white h-10 w-[200px] border-[0.8px] border-[#adb5bd] rounded-[24px] pl-[42px] pr-3 py-1 bg-no-repeat placeholder:text-[#adb5bd]"
    : เดิม
}

/** แว่นขยาย 16px ห่างซ้าย 16 (โหมดเดิมไม่มีไอคอน) */
export const แว่นช่องค้น: CSSProperties | undefined = เหมือนZORT
  ? {
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23868e96' stroke-width='1.4'%3E%3Ccircle cx='7' cy='7' r='5.5'/%3E%3Cpath d='M11 11l4 4' stroke-linecap='round'/%3E%3C/svg%3E\")",
      backgroundPosition: 'left 16px center',
      backgroundSize: '16px 16px',
    }
  : undefined
