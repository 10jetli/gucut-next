'use client'
// เฮดเดอร์ + แถบเมนูล่างสำหรับจอมือถือ
import Link from 'next/link'
import type { NavItem } from '@/lib/nav-config'
import UserMenu from './UserMenu'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
        <span className="text-[10px] text-gray-400 mt-0.5">WWW.GUCUT.COM</span>
      </div>
      <UserMenu />
    </header>
  )
}

export function MobileBottomNav({ navItems }: { navItems: NavItem[] }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
      {navItems.map((item) => {
        const href = item.href ?? item.children![0].href
        const cls = 'flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-500 transition-colors'
        const inner = (
          <>
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </>
        )
        return isStaticLink(href) ? (
          <a key={item.label} href={href} className={cls}>{inner}</a>
        ) : (
          <Link key={item.label} href={href} className={cls}>{inner}</Link>
        )
      })}
    </nav>
  )
}
