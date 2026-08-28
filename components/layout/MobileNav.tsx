'use client'
// UI มือถือทั้งชุด: เฮดเดอร์ + ลิ้นชักเมนูเต็มรายการ + แถบเมนูล่าง 5 ปุ่ม
// เดิมแถบล่างยัดเมนูหลักทุกตัวจนล้นจอ และเข้าเมนูย่อย (เช่นเครื่องมือเว็บไซต์ 16 ตัว)
// ไม่ได้เลย — แก้เป็นลิ้นชักแบบแอปทั่วไป (เจ้าของร้านสั่ง 28 ส.ค. 2569)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav-config'
import UserMenu from './UserMenu'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

function NavAnchor({ href, className, onClick, children }: {
  href: string; className: string; onClick?: () => void; children: React.ReactNode
}) {
  return isStaticLink(href) ? (
    <a href={href} className={className} onClick={onClick}>{children}</a>
  ) : (
    <Link href={href} className={className} onClick={onClick}>{children}</Link>
  )
}

export function MobileHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-3 py-2.5 flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <button onClick={onMenu} aria-label="เปิดเมนู"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-[#17386b] flex items-center justify-center shadow-[0_3px_8px_-2px_rgba(37,99,235,0.5)]">
          <span className="text-[12px] font-black text-white">G</span>
        </div>
        <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
      </div>
      <UserMenu />
    </header>
  )
}

// ลิ้นชักเมนูเต็มรายการ — โทนเดียวกับ sidebar เดสก์ท็อป เข้าถึงทุกเมนูรวมเมนูย่อย
export function MobileDrawer({ navItems, open, onClose }: {
  navItems: NavItem[]; open: boolean; onClose: () => void
}) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // เปิดกลุ่มของหน้าปัจจุบันให้เอง + ปิดลิ้นชักเมื่อเปลี่ยนหน้า
  useEffect(() => {
    for (const item of navItems) {
      if (item.children && item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        setOpenGroups((prev) => ({ ...prev, [item.label]: true }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ล็อกสกรอลพื้นหลังตอนลิ้นชักเปิด
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className={`md:hidden fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute top-0 left-0 h-full w-[82%] max-w-[320px] bg-gradient-to-b from-[#132a52] to-[#0d1f3c] shadow-2xl overflow-y-auto transition-transform duration-250 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="sticky top-0 bg-[#132a52]/95 backdrop-blur px-4 py-3.5 flex items-center justify-between border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <span className="text-[13px] font-black text-white">G</span>
            </div>
            <div>
              <p className="text-white font-black leading-none tracking-tight">GUCUT</p>
              <p className="text-blue-200/60 text-[9.5px] font-semibold tracking-widest uppercase mt-0.5">Back Office</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิดเมนู"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-100/70 hover:bg-white/10 active:scale-95">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4.5 h-4.5 w-[18px] h-[18px]">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="py-2 pb-8">
          {navItems.map((item) =>
            item.children ? (
              <div key={item.label}>
                <button onClick={() => setOpenGroups((p) => ({ ...p, [item.label]: !p[item.label] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-blue-100/90 active:bg-white/10">
                  <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
                  <span className="flex-1 text-left font-semibold">{item.label}</span>
                  <span className={`text-[10px] text-blue-200/60 transition-transform duration-200 ${openGroups[item.label] ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {openGroups[item.label] && (
                  <div className={`pb-1 ${item.label === 'เว็บไซต์' ? 'bg-[#4B5563]' : 'bg-black/20'}`}>
                    {item.children.map((c) => (
                      <NavAnchor key={c.href} href={c.href} onClick={onClose}
                        className={`block py-2.5 pl-[52px] pr-4 text-[13.5px] border-l-2 ${isActive(c.href) ? 'border-white bg-black/25 text-white font-semibold' : 'border-transparent text-white/85 active:bg-black/15'}`}>
                        {c.label}
                      </NavAnchor>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavAnchor key={item.label} href={item.href!} onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 text-[14px] ${isActive(item.href!) ? 'bg-[#D63300] text-white font-semibold' : 'text-blue-100/90 active:bg-white/10'}`}>
                <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
                <span className="font-semibold">{item.label}</span>
              </NavAnchor>
            )
          )}
        </nav>
      </aside>
    </div>
  )
}

// แถบล่าง 5 ปุ่ม: งานที่ใช้บ่อยสุด + ปุ่มเมนูเปิดลิ้นชัก (ของเดิมยัดทุกเมนูจนล้น)
const QUICK = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders', icon: '📋', label: 'ออเดอร์' },
  { href: '/web/orders', icon: '🛒', label: 'เว็บ' },
  { href: '/web/chat', icon: '💬', label: 'แชท' },
]

export function MobileBottomNav({ navItems, onMenu }: { navItems: NavItem[]; onMenu: () => void }) {
  const pathname = usePathname()
  // role staff มีเมนูเดียว (ลงเวลา/โอนสินค้า) — โชว์เมนูจริงของเขา ไม่ใช่ปุ่มลัดของแอดมิน
  const isStaff = navItems.length <= 2
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  const quick = isStaff
    ? navItems.map((n) => ({ href: n.href ?? n.children![0].href, icon: n.icon, label: n.label }))
    : QUICK
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.12)] flex justify-around py-1.5 z-30 pb-[max(6px,env(safe-area-inset-bottom))]">
      {quick.map((q) => {
        // /orders ต้องไม่ติดไฟตอนอยู่ /web/orders (prefix ซ้อนกัน)
        const active = q.href === '/orders' ? pathname.startsWith('/orders') : isActive(q.href)
        return (
          <NavAnchor key={q.href} href={q.href}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>{q.icon}</span>
            <span className={`text-[10px] ${active ? 'font-semibold' : ''}`}>{q.label}</span>
          </NavAnchor>
        )
      })}
      <button onClick={onMenu}
        className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-gray-400 active:text-blue-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-[22px] h-[22px]">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="text-[10px]">เมนู</span>
      </button>
    </nav>
  )
}
