'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const navItems = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders', icon: '📦', label: 'Orders' },
  { href: '/products', icon: '🛍', label: 'สินค้า' },
  { href: '/factory', icon: '🏭', label: 'โรงงาน' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/bills', icon: '🧾', label: 'บิล' },
]

const STORAGE_KEY = 'gucut-sidebar-collapsed'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {}
    setReady(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  const sidebarW = collapsed ? 'md:w-16' : 'md:w-52'
  const mainMl = collapsed ? 'md:ml-16' : 'md:ml-52'

  return (
    <>
      {/* ── Sidebar (desktop) แบบย่อ/ขยายได้ ── */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 ${sidebarW} flex-col bg-[#17386b] text-white z-30 ${ready ? 'transition-all duration-200' : ''}`}
      >
        <div className="h-14 px-3 border-b border-white/10 flex items-center justify-center">
          {collapsed ? (
            <p className="text-lg font-black tracking-tight">G</p>
          ) : (
            <div>
              <p className="text-xl font-black tracking-tight leading-none">GUCUT</p>
              <p className="text-[9.5px] text-blue-200/70 mt-1">BACK OFFICE</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 py-2.5 rounded-lg text-[13px] text-blue-100/90 hover:bg-white/10 hover:text-white transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            >
              <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <button
          onClick={toggle}
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          className="mx-2 mb-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors border border-white/10"
        >
          <span>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>ย่อเมนู</span>}
        </button>
      </aside>

      {/* ── Top bar (desktop) ── */}
      <header
        className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-6 z-20 ${ready ? 'transition-all duration-200' : ''}`}
      >
        <p className="text-[13px] font-semibold text-gray-700">ระบบหลังบ้าน GUCUT</p>
        <p className="text-[11.5px] text-gray-400" suppressHydrationWarning>
          {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
      </header>

      {/* ── Header (mobile) ── */}
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 shadow-sm">
        <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
        <span className="text-[10px] text-gray-400 mt-0.5">WWW.GUCUT.COM</span>
      </header>

      {/* ── Main content ── */}
      <main className={`${mainMl} md:pt-14 ${ready ? 'transition-all duration-200' : ''}`}>
        <div className="md:max-w-[1300px] md:mx-auto">{children}</div>
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-500 transition-colors"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
