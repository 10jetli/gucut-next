'use client'
// เฮดเดอร์ + แถบเมนูล่างสำหรับจอมือถือ
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav-config'
import UserMenu from './UserMenu'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-[#17386b] flex items-center justify-center shadow-[0_3px_8px_-2px_rgba(37,99,235,0.5)]">
          <span className="text-[12px] font-black text-white">G</span>
        </div>
        <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
      </div>
      <UserMenu />
    </header>
  )
}

export function MobileBottomNav({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.12)] flex justify-around py-1.5 z-20">
      {navItems.map((item) => {
        const href = item.href ?? item.children![0].href
        const active = isActive(href)
        const cls = `flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${active ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`
        const inner = (
          <>
            <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>{item.icon}</span>
            <span className={`text-[10px] ${active ? 'font-semibold' : ''}`}>{item.label}</span>
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
