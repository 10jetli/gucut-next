/* 📐 ปุ่มหัวจอ (สร้าง · สร้างอย่างง่าย · เพิ่ม… · นำเข้า…) — เดิมคัดลอกคลาสเดียวกันไว้ 18+2 จุด
 *    (กฎข้อ 5: pattern ซ้ำต้องแยกเป็นตัวกลาง) · สีพื้นยังกำหนดที่จอผ่าน style เหมือนเดิม
 *
 * 📏 โหมดเหมือน ZORT — วัด DOM /Sell/list + /Contact/list 20 ต.ค. 2569 (ไม่คลิก):
 *    ปุ่มหลัก Kanit 16/400 สูง 42 ช่องใน 8/30 ขอบ 0.8px สีเดียวกับพื้น · ปุ่มรอง #868e96 บน #f1f3f5 ขอบ #adb5bd
 *    (ของเดิมช่องใน 9/16 ไม่มีขอบ ⇒ ปุ่มแคบกว่า ZORT ~30px · ขอบ transparent = เห็นสีพื้นของปุ่มเอง ใช้ได้ทุกสี) */
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export const HEAD_BTN = เหมือนZORT
  ? 'text-[16px] leading-6 font-normal text-white rounded-full border border-transparent px-[30px] py-[8px]'
  : 'text-[16px] leading-6 font-normal text-white rounded-full px-4 py-[9px]'

export const HEAD_BTN_GHOST = เหมือนZORT
  ? "font-['Kanit','Boon',sans-serif] text-[16px] leading-6 font-normal text-[#868e96] bg-[#f1f3f5] rounded-full border border-[#adb5bd] px-[30px] py-[8px] hover:bg-[#e9ecef]"
  : "font-['Kanit','Boon',sans-serif] text-[16px] leading-6 font-normal text-[#868e96] bg-[#f1f3f5] rounded-full px-4 py-[9px] hover:bg-[#e9ecef]"
