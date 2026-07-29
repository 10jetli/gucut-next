'use client'
// แถบบนเดสก์ท็อป: ชื่อระบบ + ผู้ใช้ปัจจุบัน/ออกจากระบบ + วันที่
import UserMenu from './UserMenu'

interface TopBarProps { mainMl: string; anim: string }

export default function TopBar({ mainMl, anim }: TopBarProps) {
  return (
    <header className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-6 z-20 ${anim}`}>
      <p className="text-[13px] font-semibold text-gray-700">ระบบหลังบ้าน GUCUT</p>
      <div className="flex items-center gap-4">
        <UserMenu />
        <p className="text-[11.5px] text-gray-400" suppressHydrationWarning>
          {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
      </div>
    </header>
  )
}
