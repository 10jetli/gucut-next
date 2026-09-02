'use client'
// โครงหน้าหลักของระบบ: Sidebar + TopBar + MobileNav + พื้นที่เนื้อหา
// state การย่อ/ขยาย sidebar และการกางเมนูย่อยอยู่ที่นี่
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getNavItems } from '@/lib/nav-config'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { MobileHeader, MobileBottomNav, MobileDrawer } from './MobileNav'

const STORAGE_KEY = 'gucut-sidebar-collapsed'

interface AppShellProps { children: React.ReactNode; role: 'admin' | 'staff' | null }

export default function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navItems = getNavItems(role)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {}
    setReady(true)
  }, [])

  // เปิดกลุ่มอัตโนมัติถ้าหน้าปัจจุบันอยู่ในเมนูย่อยของกลุ่มนั้น
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    for (const item of navItems) {
      if (item.children && item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        setOpenGroups((prev) => ({ ...prev, [item.label]: true }))
      }
    }
  }, [pathname, navItems])

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

  // ⚠️ กว้าง 165px ตามแถบข้างของ ZORT (วัดจากภาพจอจริง) — ของเดิม 224px (w-56)
  const sidebarW = collapsed ? 'md:w-14' : 'md:w-[165px]'
  const mainMl = collapsed ? 'md:ml-14' : 'md:ml-[165px]'
  const anim = ready ? 'transition-all duration-200' : ''

  return (
    <>
      <Sidebar
        navItems={navItems}
        collapsed={collapsed}
        openGroups={openGroups}
        anim={anim}
        sidebarW={sidebarW}
        isActive={isActive}
        pathname={pathname}
        toggleGroup={toggleGroup}
        toggleCollapse={toggleCollapse}
      />
      <TopBar mainMl={mainMl} anim={anim} />
      <MobileHeader onMenu={() => setDrawerOpen(true)} />

      {/* ── Main content ── */}
      <main className={`${mainMl} md:pt-14 ${anim}`}>
        <div className="md:max-w-[1300px] md:mx-auto">{children}</div>
      </main>

      <MobileBottomNav navItems={navItems} onMenu={() => setDrawerOpen(true)} />
      <MobileDrawer navItems={navItems} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
