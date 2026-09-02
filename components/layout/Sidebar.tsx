'use client'
// Sidebar เดสก์ท็อป — **ลอกจาก ZORT ของจริง** (ภาพ ~/claude-shared/zort-ui/)
//
// สิ่งที่ต้องเหมือนและห้ามเปลี่ยนกลับ:
//   · พื้นขาว เส้นแบ่งขวาสีเทาอ่อน กว้าง ~165px (ของเดิมเป็นน้ำเงินเข้มไล่สี — เจ้าของร้าน
//     สั่งยึด ZORT เป็นแบบ ทับคำสั่งเก่าที่ให้ทำแนว Stripe/Shopify)
//   · เมนูย่อย **กางลงมาในแถบเดียวกัน ไม่ใช่ flyout ลอยออกมา**
//   · รายการที่เลือกอยู่ = พื้นน้ำเงินเข้มเต็มความกว้าง ตัวหนังสือขาว
//   · เมนูหลักมีไอคอนหน้าทุกอัน + ลูกศรพับ/กางด้านขวา
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { NavItem } from '@/lib/nav-config'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

// น้ำเงินเข้มของแถบที่เลือก — เทียบจากภาพจอ ZORT
const ACTIVE_BG = '#1b3b73'

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

export default function Sidebar({
  navItems, collapsed, openGroups, anim, sidebarW, isActive, pathname, toggleGroup, toggleCollapse,
}: SidebarProps) {
  // เครดิต Netlify คงเหลือ — เจ้าของร้านสั่งให้โชว์ข้างโลโก้ (28 ส.ค. 2569) ยังเก็บไว้
  const [credits, setCredits] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/netlify-credits')
      .then((r) => r.json())
      .then((j) => { if (typeof j?.left === 'number') setCredits(j.left) })
      .catch(() => {})
  }, [])

  return (
    <aside
      className={`hidden md:flex fixed inset-y-0 left-0 ${sidebarW} flex-col bg-white border-r border-gray-200 z-30 ${anim}`}
    >
      {/* โลโก้ + ปุ่มพับเมนู — ZORT วางโลโก้ซ้าย ปุ่มพับขวา */}
      <div className="h-14 px-3 flex items-center gap-2 shrink-0 border-b border-gray-100">
        <div className="w-7 h-7 rounded-md bg-[#1b3b73] flex items-center justify-center shrink-0">
          <span className="text-[13px] font-black text-white leading-none">G</span>
        </div>
        {!collapsed && (
          <>
            <span className="text-[17px] font-black tracking-tight text-gray-900">GUCUT</span>
            <button
              onClick={toggleCollapse}
              title="ย่อเมนู"
              className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              ☰
            </button>
          </>
        )}
        {collapsed && (
          <button
            onClick={toggleCollapse}
            title="ขยายเมนู"
            className="absolute left-1/2 -translate-x-1/2 top-11 w-6 h-6 rounded-md flex items-center justify-center text-[11px] text-gray-400 hover:bg-gray-100"
          >
            »
          </button>
        )}
      </div>

      {credits !== null && !collapsed && (
        <div className="px-3 pt-2 pb-1">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              credits < 1000 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'
            }`}
            title="เครดิต Netlify คงเหลือ (จาก 5,000/เดือน)"
          >
            ⚡{credits.toLocaleString('th-TH')}
          </span>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) =>
          item.children ? (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                title={item.label}
                className={`w-full flex items-center gap-2.5 py-2.5 text-[13px] transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${openGroups[item.label] ? 'text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="text-[15px] w-5 text-center shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <span className={`text-[9px] text-gray-400 transition-transform ${openGroups[item.label] ? 'rotate-180' : ''}`}>▾</span>
                  </>
                )}
              </button>
              {/* กางลงมาในแถบเดียวกัน — ZORT ไม่ใช้ flyout */}
              {!collapsed && openGroups[item.label] && (
                <div>
                  {item.children.map((c) => {
                    const active = isActive(c.href) && !(c.href === '/bills' && pathname !== '/bills')
                    const cls = `block py-2 pl-10 pr-3 text-[12.5px] transition-colors ${
                      active ? 'text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`
                    const style = active ? { background: ACTIVE_BG } : undefined
                    return isStaticLink(c.href) ? (
                      <a key={c.href} href={c.href} className={cls} style={style}>{c.label}</a>
                    ) : (
                      <Link key={c.href} href={c.href} className={cls} style={style}>{c.label}</Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            (() => {
              const active = isActive(item.href!)
              const cls = `flex items-center gap-2.5 py-2.5 text-[13px] transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${active ? 'text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`
              const style = active ? { background: ACTIVE_BG } : undefined
              const inner = (
                <>
                  <span className="text-[15px] w-5 text-center shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )
              return isStaticLink(item.href!) ? (
                <a key={item.href} href={item.href} title={item.label} className={cls} style={style}>{inner}</a>
              ) : (
                <Link key={item.href} href={item.href!} title={item.label} className={cls} style={style}>{inner}</Link>
              )
            })()
          ),
        )}
      </nav>
    </aside>
  )
}
