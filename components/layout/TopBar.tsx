'use client'
// แถบบนเดสก์ท็อป — **ลอกผังจาก ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
//
// ผังของ ZORT: ซ้าย = โลโก้ ST + ชื่อบริษัท · ขวา = กระดิ่ง · เครื่องหมายคำถาม ·
// ตารางจุด 9 ช่อง · เส้นคั่น · โลโก้ ST + ชื่อบัญชีที่ล็อกอิน
//
// ⚠️ ร้านมี **สองนิติบุคคล** (ศีตกาล เทรดดิ้ง = คนขาย · นิวเวฟ ซันไชน์ = ผู้ผลิต)
//    แถบนี้แสดงชื่อ "ผู้ขาย" ซึ่งเป็นเจ้าของข้อมูลในระบบหลังร้าน — ห้ามสลับกัน
//
// ที่ **ไม่ได้ลอกมา** ของ ZORT ตรงมุมขวา คือ "จำนวนรายการเดือนนี้ 36/2,000" กับปุ่ม
// "Shipping Point" — อันแรกคือมาตรวัดโควตาแพ็กเกจที่ร้านจ่ายให้ ZORT (ไม่มีความหมายกับเรา
// และการทำให้เหมือนเท่ากับวาดขีดจำกัดที่ไม่มีอยู่จริงขึ้นมาเอง) อันที่สองเป็นบริการเรียกขนส่ง
// ของ ZORT ที่ร้านไม่ได้ใช้ — ใบปะหน้าออกจากแอปของแพลตฟอร์มโดยตรง
import UserMenu from './UserMenu'
import TopBarActions, { StMark } from './TopBarActions'

const COMPANY = 'บจก. ศีตกาล เทรดดิ้ง'

interface TopBarProps { mainMl: string; anim: string }

export default function TopBar({ mainMl, anim }: TopBarProps) {
  return (
    <header
      className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-5 z-20 ${anim}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StMark size={17} />
        <p className="text-[13.5px] font-bold text-gray-800 truncate">{COMPANY}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <TopBarActions />
        <div className="w-px h-5 bg-gray-200 mx-1.5" />
        <UserMenu />
      </div>
    </header>
  )
}
