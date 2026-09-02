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
const GROUPS_KEY = 'gucut-sidebar-groups'

interface AppShellProps { children: React.ReactNode; role: 'admin' | 'staff' | null }

export default function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navItems = getNavItems(role)

  // ⚠️ **ทุกกลุ่มต้องกางไว้เป็นค่าเริ่มต้น** — ของเดิมเป็นเมนูแบน เห็นทุกอันพร้อมกัน
  //    พอจัดเป็นกลุ่มแบบ ZORT แล้วตั้งค่าเริ่มต้นเป็นพับ เจ้าของร้านทักทันทีว่า
  //    "เมนูที่ผมเคยทำไว้หายไปไหน" ทั้งที่ลิงก์อยู่ครบทุกอัน (2 ก.ย. 2569)
  //    ของที่เคยกดได้ทันที (ระบบสั่งของ · นำเข้าจากจีน · โอนสินค้า · ดึงบิล) หายเข้าไปอยู่ข้างใน
  //    บทเรียน: จัดกลุ่มใหม่ = ของเดิมต้องยัง "เห็นได้ทันที" เหมือนเดิม ไม่ใช่แค่ "ยังเข้าถึงได้"
  const allOpen = () => Object.fromEntries(navItems.filter((i) => i.children).map((i) => [i.label, true]))
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(allOpen)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
      // จำสถานะพับ/กางที่เจ้าของร้านตั้งเอง — ไม่มีค่าที่จำไว้ = กางหมดตามค่าเริ่มต้น
      const saved = localStorage.getItem(GROUPS_KEY)
      if (saved) {
        const obj = JSON.parse(saved)
        if (obj && typeof obj === 'object') setOpenGroups((prev) => ({ ...prev, ...obj }))
      }
    } catch {}
    setReady(true)
    // อ่านค่าที่จำไว้ครั้งเดียวตอนเปิดหน้า — ใส่ deps จะทับค่าที่ผู้ใช้เพิ่งกด
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const saveGroups = (next: Record<string, boolean>) => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)) } catch {}
    return next
  }

  const toggleGroup = (label: string) => {
    if (collapsed) {
      setCollapsed(false)
      try { localStorage.setItem(STORAGE_KEY, '0') } catch {}
      setOpenGroups((prev) => saveGroups({ ...prev, [label]: true }))
      return
    }
    setOpenGroups((prev) => saveGroups({ ...prev, [label]: !prev[label] }))
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
      {/* ⚠️ เนื้อหาเต็มความกว้างเหมือน ZORT — ของเดิมจำกัด 1300px แล้วจัดกลาง
          ทำให้จอกว้างเหลือที่ว่างข้างขวาเป็นแถบใหญ่ ต่างจาก ZORT ที่ตารางกินเต็มจอ
          (เห็นชัดตอนเทียบภาพหลังร้านเรากับ ZORT — ตารางเยอะคอลัมน์ต้องการที่) */}
      <main className={`${mainMl} md:pt-14 ${anim}`}>{children}</main>

      <MobileBottomNav navItems={navItems} onMenu={() => setDrawerOpen(true)} />
      <MobileDrawer navItems={navItems} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
