'use client'
// โครงหน้าหลักของระบบ: Sidebar + TopBar + MobileNav + พื้นที่เนื้อหา
// state การย่อ/ขยาย sidebar และการกางเมนูย่อยอยู่ที่นี่
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getNavItems } from '@/lib/nav-config'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { MobileHeader, MobileBottomNav, MobileDrawer } from './MobileNav'
import ZortReadyBar from '@/components/layout/ZortReadyBar'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

const STORAGE_KEY = 'gucut-sidebar-collapsed'
const GROUPS_KEY_DEFAULT = 'gucut-sidebar-groups'
/* 🎯 โหมดเหมือน ZORT ใช้คีย์จำแยก — ไม่งั้นค่า "กางหมด" ที่จำไว้จากยุคก่อนจะทับการพับตั้งต้นทันทีที่เปิดหน้า */
const GROUPS_KEY = เหมือนZORT ? 'gucut-sidebar-groups:zortlook' : GROUPS_KEY_DEFAULT

interface AppShellProps { children: React.ReactNode; role: 'admin' | 'staff' | null }

export default function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname()
  /* 🔴 ยังไม่ล็อกอิน = ไม่วาดเปลือกเลย (เจ้าของร้านจับได้ 8 ก.ย. 2569: หน้า /login
     โชว์แผงเมนูทั้งหมด + ชื่อบริษัทก่อนล็อกอิน) — ด่านเดิมกั้นแค่ "เนื้อหา" (middleware
     เด้งหน้า/401 API) แต่ "เปลือก" (Sidebar/TopBar/จุดสถานะ) วาดจากโค้ดฝั่งเบราว์เซอร์
     ⇒ คนนอกเห็นโครงระบบทั้งแผงและชื่อนิติบุคคลฟรี ๆ · role ตัดสินฝั่งเซิร์ฟเวอร์
     จากคุกกี้ (layout.tsx) จึงเชื่อได้ตั้งแต่ render แรก — ไม่มีเปลือกกะพริบ */
  if (!role) return <main>{children}</main>
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navItems = getNavItems(role)

  // ⚠️ **ทุกกลุ่มต้องกางไว้เป็นค่าเริ่มต้น** — ของเดิมเป็นเมนูแบน เห็นทุกอันพร้อมกัน
  //    พอจัดเป็นกลุ่มแบบ ZORT แล้วตั้งค่าเริ่มต้นเป็นพับ เจ้าของร้านทักทันทีว่า
  //    "เมนูที่ผมเคยทำไว้หายไปไหน" ทั้งที่ลิงก์อยู่ครบทุกอัน (2 ก.ย. 2569)
  //    ของที่เคยกดได้ทันที (ระบบสั่งของ · ดรอปชิปปิ้ง · โอนสินค้า · ดึงบิล) หายเข้าไปอยู่ข้างใน
  //    บทเรียน: จัดกลุ่มใหม่ = ของเดิมต้องยัง "เห็นได้ทันที" เหมือนเดิม ไม่ใช่แค่ "ยังเข้าถึงได้"
  const allOpen = () => Object.fromEntries(navItems.filter((i) => i.children).map((i) => [i.label, true]))
  /* 🎯 **โหมดเหมือน ZORT: พับทุกกลุ่มเป็นค่าตั้งต้น** — ท่านประธานสั่ง 18 ต.ค. 2569 "พับให้เหมือน ZORT"
     ทับกฎ 2 ก.ย. ข้างบนด้วยคำสั่งใหม่ของท่านเอง (หลังเห็นว่าเมนูกางคือก้อนต่างใหญ่สุดทุกจอ)
     🔴 พับ ≠ ลบ: ทุกเมนูยังอยู่ครบ กดกางเจอทุกตัว · กลุ่มของหน้าที่เปิดอยู่กางเองอัตโนมัติ (effect ข้างล่าง)
     · กลุ่มที่กดกาง/พับเองถูกจำไว้ (คีย์แยกของโหมดนี้) · ปิดโหมด = กางหมดตามกฎเดิม */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => (เหมือนZORT ? {} : allOpen()))

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
      /* 🔴 ใช้ isActive (เลือกลิงก์ที่เจาะจงที่สุด) ไม่ใช่จับคำนำหน้า — ของเดิมทำให้กลุ่ม JET (มี /core "โครงการแก่น")
         กางพร้อมกลุ่มจริงทุกจอใต้ /core · เห็นชัดตอนเปิดโหมดพับ (วัด preview 18 ต.ค. 2569: กาง 2 กลุ่มบน /core/sales) */
      if (item.children && item.children.some((c) => isActive(c.href))) {
        setOpenGroups((prev) => ({ ...prev, [item.label]: true }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* 🔴 เลือกตัวที่เจาะจงที่สุดเท่านั้น — ของเดิมจับด้วยคำนำหน้าอย่างเดียว ⇒ "โครงการแก่น" (/core)
     ติดสีน้ำเงินพร้อม "ดูรายการขาย" (/core/sales) ทุกจอใต้ /core (วัดเว็บจริง 17 ต.ค. 2569 เจอ 2 แถบพร้อมกัน)
     ⇒ ตรงคำนำหน้าได้ก็ต่อเมื่อไม่มีลิงก์อื่นในเมนูที่ยาวกว่าและตรงด้วย */
  const allHrefs = navItems.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]).filter((h): h is string => !!h)
  const ตรง = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'))
  const isActive = (href: string) =>
    ตรง(href) && (pathname === href || !allHrefs.some((h) => h.length > href.length && ตรง(h)))

  /* 📏 **แถบเมนู 200px — วัดจาก DOM ของ ZORT ตรง ๆ ไม่ใช่จากภาพ** (15 ต.ค. 2569)
     ของจริงที่วัดได้: รายการในเมนูของ ZORT `x=0 กว้าง=200` (ยืนยัน 2 จอ)
     และ **เนื้อหาเริ่มที่ x=230** ⇒ **แถบ 200 + ช่องว่างซ้ายของเนื้อหา 30 = 230**
     ⚠️ **อย่าตั้งแถบเป็น 230** — จะได้ช่องว่าง 260 แล้วเลื่อนไปทั้งหน้า (ความผิดที่เกือบเกิดจริงรอบนี้)
     🔴 ของเดิมเขียนว่า `165px ตามแถบข้างของ ZORT (วัดจากภาพจอจริง)` — **วัดถูก แต่ลืมหาร dpr**
        `165 × 1.25 = 206 ≈ 200` ⇒ ภาพกว้าง 1440 แต่ผัง CSS จริงกว้าง 1152
        ⇒ ⇒ และคำว่า "วัดจากภาพจอจริง" **ทำให้ไม่มีใครตรวจซ้ำ** (คำกำกับที่จริงปิดการสงสัย)
     📐 ยืนยันว่าแถบของ ZORT **ไม่ตอบสนองความกว้างจอ**: 1152 CSS ⇒ 230 · 1536 CSS ⇒ 230
        (819 CSS ⇒ 212 = แคบลงเล็กน้อย ไม่ยุบ) ⇒ ตั้งค่าคงที่ได้ปลอดภัย
     ⚠️ โหมดยุบ (`md:w-14`) ไม่แตะ — เป็นของเราเอง ZORT ไม่มี */
  const sidebarW = collapsed ? 'md:w-14' : 'md:w-[200px]'
  /* 🧮 **ทำไม margin เป็น 206 ไม่ใช่ 200**: เป้าคือ **เนื้อหาเริ่มที่ x=230 เท่า ZORT**
     ZORT = แถบ 200 + ช่องว่าง 30 · ของเรา = แถบ 200 + margin 6 + padding ของเพจ 24 (`md:p-6`) = 230
     ⇒ วัดแล้วได้ **224** ตอน margin 200 ⇒ ขาด 6 ⇒ เติมที่ margin ไม่ใช่ที่ความกว้างแถบ
     ⚠️ ถ้าวันหนึ่งเพจเปลี่ยน padding ตัวเลขนี้ต้องวัดใหม่ — **อย่าแก้ด้วยการขยายแถบเมนู** */
  const mainMl = collapsed ? 'md:ml-14' : 'md:ml-[206px]'
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
      {/* ป้าย "ใช้แทน ZORT ได้หรือยัง" — ทะเบียนเดียว จุดวาดเดียว (lib/zort-ready.ts) */}
      {/* 📏 **ระยะบน = 58 ไม่ใช่ 52** (วัด ZORT /Sell/list 17 ต.ค. 2569): แถบบน ZORT 51 + เส้น 1 ⇒ เนื้อหาเริ่ม y=52
          แล้วช่องว่างบน 30 ⇒ หัวจอ y=82 · ของเรา = แถบบน 52 + 6 ตรงนี้ + padding ของเพจ 24 = 82
          (ท่าเดียวกับ margin ซ้าย 206 ข้างบน) ⚠️ แถบป้ายใช้แทน ZORT ดันลงอีกเท่าความสูงของมัน — ZORT ไม่มีแถบนี้ */}
      <main className={`${mainMl} md:pt-[58px] ${anim}`}><ZortReadyBar />{children}</main>

      <MobileBottomNav navItems={navItems} onMenu={() => setDrawerOpen(true)} />
      <MobileDrawer navItems={navItems} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
