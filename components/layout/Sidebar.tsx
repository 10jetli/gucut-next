'use client'
// Sidebar เดสก์ท็อป: เมนูหลัก + เมนูย่อยแบบพับ/กาง + ปุ่มย่อเมนู
import Link from 'next/link'
import { NAV_ITEMS } from '@/lib/nav-config'

interface SidebarProps {
  collapsed: boolean
  openGroups: Record<string, boolean>
  anim: string
  sidebarW: string
  isActive: (href: string) => boolean
  pathname: string
  toggleGroup: (label: string) => void
  toggleCollapse: () => void
}

export default function Sidebar({ collapsed, openGroups, anim, sidebarW, isActive, pathname, toggleGroup, toggleCollapse }: SidebarProps) {
  return (
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
        {NAV_ITEMS.map((item) =>
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
  )
}
