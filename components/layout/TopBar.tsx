'use client'
// แถบบนเดสก์ท็อป — **ลอกผังจาก ZORT** (~/claude-shared/zort-ui/)
//
// ZORT วางแบบนี้: ซ้าย = โลโก้บริษัท + ชื่อบริษัท · ขวา = ข้อมูลผู้ใช้และเครื่องมือ
// ของเดิมเป็นแถบโปร่งเบลอเขียนว่า "ระบบหลังบ้าน GUCUT" ซึ่งไม่บอกว่ากำลังดูข้อมูลของบริษัทไหน
// ⚠️ ร้านมี **สองนิติบุคคล** (ศีตกาล เทรดดิ้ง = คนขาย · นิวเวฟ ซันไชน์ = ผู้ผลิต)
//    แถบนี้แสดงชื่อ "ผู้ขาย" ซึ่งเป็นเจ้าของข้อมูลในระบบหลังร้าน — ห้ามสลับกัน
import UserMenu from './UserMenu'

const COMPANY = 'บจก. ศีตกาล เทรดดิ้ง'

interface TopBarProps { mainMl: string; anim: string }

export default function TopBar({ mainMl, anim }: TopBarProps) {
  return (
    <header
      className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-5 z-20 ${anim}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 h-6 rounded bg-[#1b3b73] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white leading-none">ST</span>
        </span>
        <p className="text-[13.5px] font-bold text-gray-800 truncate">{COMPANY}</p>
      </div>
      <div className="flex items-center gap-4">
        <UserMenu />
        <div className="w-px h-4 bg-gray-200" />
        <p className="text-[11.5px] text-gray-400" suppressHydrationWarning>
          {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
      </div>
    </header>
  )
}
