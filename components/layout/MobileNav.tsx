'use client'
// เฮดเดอร์ + แถบเมนูล่างสำหรับจอมือถือ
import Link from 'next/link'
import { NAV_ITEMS } from '@/lib/nav-config'

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 shadow-sm">
      <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
      <span className="text-[10px] text-gray-400 mt-0.5">WWW.GUCUT.COM</span>
    </header>
  )
}

export function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.label}
          href={item.href ?? item.children![0].href}
          className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-500 transition-colors"
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
