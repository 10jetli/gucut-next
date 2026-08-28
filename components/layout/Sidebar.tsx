'use client'
// Sidebar เดสก์ท็อป: เมนูหลัก + เมนูย่อยแบบพับ/กาง + ปุ่มย่อเมนู
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { NavItem } from '@/lib/nav-config'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

interface SidebarProps {
  navItems: NavItem[]
  collapsed: boolean
  openGroups: Record<string, boolean>
  anim: string
  sidebarW: string
  isActive: (href: string) => boolean
  pathname: string
  toggleGroup: (label: string) => void
  toggleCollapse: () => void
}

export default function Sidebar({ navItems, collapsed, openGroups, anim, sidebarW, isActive, pathname, toggleGroup, toggleCollapse }: SidebarProps) {
  // เครดิต Netlify คงเหลือ — เจ้าของร้านสั่งให้โชว์ข้างโลโก้ (28 ส.ค. 2569)
  const [credits, setCredits] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/netlify-credits')
      .then((r) => r.json())
      .then((j) => { if (typeof j?.left === 'number') setCredits(j.left) })
      .catch(() => {})
  }, [])
  return (
    <aside
      className={`hidden md:flex fixed inset-y-0 left-0 ${sidebarW} flex-col text-white z-30 ${anim}`}
      style={{ background: 'linear-gradient(180deg,#15346a 0%,#17386b 45%,#0f2a52 100%)' }}
    >
      <div className="h-14 px-3 border-b border-white/10 flex items-center justify-center shrink-0 gap-2">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(37,99,235,0.6)]">
            <p className="text-sm font-black tracking-tight">G</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 w-full">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(37,99,235,0.6)] shrink-0">
              <p className="text-sm font-black tracking-tight">G</p>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight leading-none">GUCUT</p>
              <p className="text-[9.5px] text-blue-200/60 mt-0.5 tracking-wide">BACK OFFICE</p>
            </div>
            {credits !== null && (
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${credits < 1000 ? 'bg-orange-400/25 text-orange-200' : 'bg-white/10 text-blue-100/80'}`}
                title={`เครดิต Netlify คงเหลือ (จาก 5,000/เดือน)`}
              >
                ⚡{credits.toLocaleString('th-TH')}
              </span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) =>
          item.children ? (
            <div key={item.label} className={openGroups[item.label] && !collapsed ? 'rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/5' : ''}>
              <button
                onClick={() => toggleGroup(item.label)}
                title={item.label}
                className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-[13px] transition-colors duration-150 ${collapsed ? 'justify-center px-0' : 'px-3'} ${openGroups[item.label] && !collapsed ? 'text-white font-semibold' : 'text-blue-100/85 hover:bg-white/10 hover:text-white'}`}
              >
                <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <span className={`text-[9px] text-blue-200/60 transition-transform duration-200 ${openGroups[item.label] ? 'rotate-180' : ''}`}>▾</span>
                  </>
                )}
              </button>
              {!collapsed && openGroups[item.label] && (
                <div className="pb-1">
                  {item.children.map((c) => {
                    const active = isActive(c.href) && !(c.href === '/bills' && pathname !== '/bills')
                    const cls = `flex items-center gap-2 py-2 pl-11 pr-3 text-[12.5px] transition-colors duration-150 border-l-2 ${active ? 'border-[#FF6A3C] bg-[#D63300] text-white font-semibold' : 'border-transparent text-blue-100/75 hover:bg-white/10 hover:text-white'}`
                    return isStaticLink(c.href) ? (
                      <a key={c.href} href={c.href} className={cls}>{c.label}</a>
                    ) : (
                      <Link key={c.href} href={c.href} className={cls}>{c.label}</Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            (() => {
              const active = isActive(item.href!)
              const cls = `flex items-center gap-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'px-3'} ${active ? 'bg-[#D63300] text-white font-semibold shadow-[0_4px_12px_-4px_rgba(214,51,0,0.7)]' : 'text-blue-100/85 hover:bg-white/10 hover:text-white'}`
              const inner = (
                <>
                  <span className="text-lg w-5 text-center shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )
              return isStaticLink(item.href!) ? (
                <a key={item.href} href={item.href} title={item.label} className={cls}>{inner}</a>
              ) : (
                <Link key={item.href} href={item.href!} title={item.label} className={cls}>{inner}</Link>
              )
            })()
          ),
        )}
      </nav>

      <button
        onClick={toggleCollapse}
        title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        className="mx-2 mb-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11.5px] text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors border border-white/10 shrink-0"
      >
        <span>{collapsed ? '»' : '«'}</span>
        {!collapsed && <span>ย่อเมนู</span>}
      </button>
    </aside>
  )
}
