'use client'
// Sidebar เดสก์ท็อป — **ลอกจาก ZORT ของจริง** (ภาพ ~/claude-shared/zort-ui/)
//
// สิ่งที่ต้องเหมือนและห้ามเปลี่ยนกลับ:
//   · พื้นแถบขาว เส้นแบ่งขวาสีเทาอ่อน กว้าง ~165px
//   · เมนูย่อย **กางลงมาในแถบเดียวกัน ไม่ใช่ flyout ลอยออกมา**
//   · **กลุ่มที่กางอยู่กลายเป็นบล็อกน้ำเงินเข้มทั้งก้อน** ตั้งแต่หัวข้อลงมาถึงลูกทุกตัว
//     หัวข้อกลุ่มมีเส้นน้ำเงินสว่างคาดใต้ · ลูกที่เลือกอยู่พื้นสว่างกว่าพื้นบล็อก
//   · ลูกศรชี้ขึ้นตอนกาง ชี้ลงตอนพับ · เมนูหลักมีไอคอนหน้าทุกอัน
//
// ⚠️ **รอบแรกผมสรุปผิดว่าเมนูย่อยเป็นพื้นขาว** เพราะอ่านจากภาพเต็มความละเอียดต่ำ
//    เจ้าของร้านส่งภาพครอปมาให้ถึงเห็นว่าเป็นบล็อกน้ำเงินเข้ม
//    ⇒ บทเรียน: สีกับพื้นหลังต้องดูจากภาพครอปที่ชัดพอ อย่าสรุปจากภาพย่อทั้งหน้า
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { NavItem } from '@/lib/nav-config'

// ลิงก์ไปไฟล์ static (เช่น /catalog/index.html#trf) ต้องเปิดแบบโหลดหน้าจริง
// ไม่ใช้ Next <Link> เพราะ client-router ของ Next จะตัด hash (#trf) ทิ้งระหว่างนำทาง
const isStaticLink = (href: string) => href.startsWith('/catalog/')

// สีจาก ZORT ของจริง (ภาพครอปที่เจ้าของร้านส่งมา 2 ก.ย. 2569 — ชัดกว่าภาพเต็มมาก)
// ⚠️ รอบแรกผมอ่านจากภาพเต็มความละเอียดต่ำแล้วสรุปผิดว่าเมนูย่อยเป็นพื้นขาว
//    ของจริงคือ **บล็อกน้ำเงินเข้มทั้งก้อน** ตั้งแต่หัวข้อลงมาถึงลูกทุกตัว
const GROUP_BG = '#1e2a52'      // พื้นบล็อกกลุ่มที่กางอยู่
const GROUP_LINE = '#2f6fe0'    // เส้นสว่างคาดใต้หัวข้อกลุ่ม
const CHILD_ACTIVE = '#2b4a8f'  // ลูกที่เลือกอยู่ — สว่างกว่าพื้นบล็อกให้เห็นชัด
const ITEM_ACTIVE = '#1b3b73'   // เมนูเดี่ยว (ไม่มีลูก) ที่เลือกอยู่

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
            (() => {
              const open = !!openGroups[item.label] && !collapsed
              return (
                <div key={item.label} style={open ? { background: GROUP_BG } : undefined}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    title={item.label}
                    className={`w-full flex items-center gap-2.5 py-2.5 text-[13px] transition-colors ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${open ? 'text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                    style={open ? { borderBottom: `2px solid ${GROUP_LINE}` } : undefined}
                  >
                    <span className="text-[15px] w-5 text-center shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {/* ZORT ใช้ลูกศรชี้ขึ้นตอนกาง ชี้ลงตอนพับ */}
                        <span className={`text-[9px] ${open ? 'text-white/70' : 'text-gray-400'}`}>{open ? '⌃' : '⌄'}</span>
                      </>
                    )}
                  </button>
                  {/* กางลงมาในแถบเดียวกัน — ZORT ไม่ใช้ flyout · ทั้งบล็อกเป็นพื้นน้ำเงินเข้ม */}
                  {open && (
                    <div className="py-1">
                      {item.children!.map((c) => {
                        const active = isActive(c.href) && !(c.href === '/bills' && pathname !== '/bills')
                        const cls = `block py-2 pl-11 pr-3 text-[12.5px] transition-colors ${
                          active ? 'text-white font-semibold' : 'text-white/80 hover:bg-white/10'
                        }`
                        const style = active ? { background: CHILD_ACTIVE } : undefined
                        return isStaticLink(c.href) ? (
                          <a key={c.href} href={c.href} className={cls} style={style}>{c.label}</a>
                        ) : (
                          <Link key={c.href} href={c.href} className={cls} style={style}>{c.label}</Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()
          ) : (
            (() => {
              const active = isActive(item.href!)
              const cls = `flex items-center gap-2.5 py-2.5 text-[13px] transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${active ? 'text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`
              const style = active ? { background: ITEM_ACTIVE } : undefined
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

      {/* การ์ดสถานะมุมล่างซ้าย — ZORT มีอันนี้ติดอยู่ทุกจอ (ภาพครอปจากเจ้าของร้าน)
          ⚠️ ของ ZORT เช็คเองอัตโนมัติ **แต่ของเราห้าม** — เจ้าของร้านสั่งไว้ว่า
             หน้าสถานะระบบต้องกดเช็คเอง (ประหยัดทรัพยากร · ตัวตรวจยิงของจริง 24 เรื่อง)
             การ์ดนี้จึงเป็นทางเข้าเฉย ๆ ไม่ยิงอะไรตอนโหลดหน้า และ **ห้ามเขียนว่า "ทุกระบบปกติ"**
             เพราะเราไม่ได้ตรวจ — เขียนแบบนั้นคือจอที่โกหก */}
      {!collapsed && (
        <div className="p-2 shrink-0">
          <Link
            href="/web/status"
            className="block rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <p className="text-[12px] font-semibold text-gray-700">สถานะระบบ</p>
            <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
              กดเพื่อตรวจของจริง 24 เรื่อง
            </p>
          </Link>
        </div>
      )}
    </aside>
  )
}
