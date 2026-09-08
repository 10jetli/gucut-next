'use client'
// แถบบนเดสก์ท็อป — **ลอกผังจาก ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
//
// ผังของ ZORT: ซ้าย = โลโก้ ST + ชื่อบริษัท · ขวา = กระดิ่ง · เครื่องหมายคำถาม ·
// ตารางจุด 9 ช่อง · เส้นคั่น · โลโก้ ST + ชื่อบัญชีที่ล็อกอิน
//
// ⚠️ ร้านมี **สองนิติบุคคล** (ศีตกาล เทรดดิ้ง = คนขาย · นิวเวฟ ซันไชน์ = ผู้ผลิต)
//    แถบนี้แสดงชื่อ "ผู้ขาย" ซึ่งเป็นเจ้าของข้อมูลในระบบหลังร้าน — ห้ามสลับกัน
//
// ที่ **ไม่ได้ลอกมา** ของ ZORT ตรงมุมขวา คือ "จำนวนรายการเดือนนี้ 36/2,000" กับปุ่ม
// "Shipping Point" — อันแรกคือมาตรวัดโควตาแพ็กเกจที่ร้านจ่ายให้ ZORT (ไม่มีความหมายกับเรา
// และการทำให้เหมือนเท่ากับวาดขีดจำกัดที่ไม่มีอยู่จริงขึ้นมาเอง) อันที่สองเป็นบริการเรียกขนส่ง
// ของ ZORT ที่ร้านไม่ได้ใช้ — ใบปะหน้าออกจากแอปของแพลตฟอร์มโดยตรง
import { useEffect, useState } from 'react'
import UserMenu from './UserMenu'
import TopBarActions, { StMark } from './TopBarActions'

/* 🔴 **ห้าม hardcode ชื่อบริษัทกลับมาในไฟล์นี้** (แก้ 8 ก.ย. 2569 — เจ้าของร้านจับได้)
   ค่าที่พิมพ์ตายตัวถูกอบเข้า bundle/HTML ตอน build ⇒ คนไม่ล็อกอิน curl หน้า /login
   ก็เห็นชื่อนิติบุคคล (คลาสเดียวกับกฎ "ห้ามใส่ address ใน shop.ts" ฝั่งหน้าร้าน)
   ⇒ ดึงสดจาก ?shopinfo=1 ซึ่งอยู่หลังด่านล็อกอิน — คนนอกยิงได้แค่ 401
   (และตรงกฎ single-source: ข้อมูลนิติบุคคลมีแหล่งเดียวที่ shop.ts ฝั่งหน้าร้าน)
   ระหว่างโหลด/โหลดไม่ได้ = ว่าง — ช่องว่างชั่วครู่ดีกว่าชื่อผิดหรือชื่อหลุด */
function useCompanyName(): string {
  const [name, setName] = useState('')
  useEffect(() => {
    let alive = true
    fetch('/api/web/core?shopinfo=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && typeof d?.seller?.name === 'string') setName(d.seller.name) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return name
}

interface TopBarProps { mainMl: string; anim: string }

export default function TopBar({ mainMl, anim }: TopBarProps) {
  const company = useCompanyName()
  return (
    <header
      className={`hidden md:flex fixed top-0 ${mainMl} right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-5 z-20 ${anim}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StMark size={17} />
        <p className="text-[13.5px] font-bold text-gray-800 truncate">{company}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <TopBarActions />
        <div className="w-px h-5 bg-gray-200 mx-1.5" />
        <UserMenu />
      </div>
    </header>
  )
}
