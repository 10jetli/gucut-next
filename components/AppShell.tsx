'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavChild { href: string; label: string }
interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders', icon: '📦', label: 'Orders' },
  { href: '/products', icon: '🛍', label: 'สินค้า' },
  { href: '/factory', icon: '🏭', label: 'โรงงาน' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/catalog/index.html', icon: '🧰', label: 'สั่งของ (แคตตาล็อก)' },
  {
    icon: '🧾',
    label: 'บิล',
    children: [
      { href: '/bills', label: 'รวมบิลทุกเจ้า' },
      { href: '/bills/tiktok', label: 'TikTok Ads' },
      { href: '/bills/meta', label: 'Facebook/Meta Ads' },
      { href: '/bills/google', label: 'Google Ads' },
      { href: '/bills/shopify', label: 'www (Shopify)' },
      { href: '/bills/line', label: 'LINE' },
      { href: '/bills/adobe', label: 'Adobe' },
      { href: '/bills/apple', label: 'Apple / iCloud' },
      { href: '/bills/omise', label: 'Omise' },
    ],
  },
  {
    icon: '⚙️',
    label: 'ตั้งค่า',
    children: [
      { href: '/settings/connections', label: 'เชื่อมต่อบริการอื่น' },
    ],
  },
]

const STORAGE_KEY = 'gucut-sidebar-collapsed'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {}
    setReady(true)
  }, [])

  // เปิดกลุ่มอัตโนมัติถ้าหน้าปัจจุบันอยู่ในเมนูย่อยของกลุ่มนั้น
  useEffect(() => {
    for (const item of navItems) {
      if (item.children && item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        setOpenGroups((prev) => ({ ...prev, [item.label]: true }))
      }
    }
  }, [pathname])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  const toggleGroup = (label: string) => {
    if (collapsed) {
      setCollapsed(false)
      try { localStorage.setItem(STORAGE_KEY, '0') } catch {}
      setOpenGroups((prev) => ({ ...prev, [label]: true }))
      return
    }
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  const sidebarW = collapsed ? 'md:w-16' : 'md:w-56'
  const mainMl = collapsed ? 'md:ml-16' : 'md:ml-56'
  const anim = ready ? 'transition-all duration-200' : ''

  return (
    <>
      {/* ── Sidebar (desktop) ── */}
      <aside className={`hidden md:flex fixed inset-y-0 left-0 ${sidebarW} flex-col bg-[#17386b] text-white z-30 ${anim}`}>
        <div className="h-14 px-3 border-b border-white/10 flex items-center justify-center shrink-0">
          {collapsed ? (
            <p className="text-lg font-black tracking-tight">G</p>
          ) : (
            <div>
              <p className="text-xl font-black tracking-tight leading-none">GUCUT</p>
              <p className="text-[9.5px] text-blue-200/70 mt-1">BACK OFFICE</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) =>
            item.children ? (
              <div key={item.label} className={openGroups[item.label] && !collapsed ? 'rounded-lg overflow-hidden bg-black/20' : ''}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-[13px] transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${openGroups[item.label] && !collapsed ? 'text-white font-semibold' : 'text-blue-100/90 hover:bg-white/10 hover:text-white'}`}
                >
                  <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <span className="text-[10px] text-blue-200/70">{openGroups[item.label] ? '▲' : '▼'}</span>
                    </>
                  )}
                </button>
                {!collapsed && openGroups[item.label] && (
                  <div className="pb-1">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`block py-2 pl-11 pr-3 text-[12.5px] transition-colors ${isActive(c.href) && !(c.href === '/bills' && pathname !== '/bills') ? 'bg-blue-600 text-white font-semibold' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'}`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                title={item.label}
                className={`flex items-center gap-3 py-2.5 rounded-lg text-[13px] transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${isActive(item.href!) ? 'bg-blue-600 text-white font-semibold' : 'text-blue-100/90 hover:bg-white/10 hover:text-white'}`}
              >
                <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            ),
          )}
        </nav>

        <button
          onClick={toggleCollapse}
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          className="mx-2 mb-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors border border-white/10 shrink-0"
        >
          <span>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>ย่อเมนู</span>}
        </button>
      </aside>

      {/* ── Top bar (desktop) ── */}
      <header className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-6 z-20 ${anim}`}>
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
      <main className={`${mainMl} md:pt-14 ${anim}`}>
        <div className="md:max-w-[1300px] md:mx-auto">{children}</div>
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
        {navItems.map((item) => (
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
    </>
  )
}
