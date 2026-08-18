// รายการเมนูของระบบหลังบ้านทั้งหมด — แก้เมนูที่ไฟล์นี้ที่เดียว
import { BILL_VENDORS } from './vendors'

export interface NavChild { href: string; label: string }
export interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

export const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/tracker', icon: '📋', label: 'ติดตามออเดอร์' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/catalog/index.html', icon: '🧰', label: 'ระบบสั่งของ' },
  { href: '/catalog/index.html#trf', icon: '🔄', label: 'โอนสินค้า' },
  {
    icon: '🧾',
    label: 'ดึงบิล',
    children: [
      { href: '/bills', label: 'รวมบิลทุกเจ้า' },
      ...BILL_VENDORS.map(v => ({ href: `/bills/${v.id}`, label: v.name })),
    ],
  },
  {
    icon: '⚙️',
    label: 'ตั้งค่า',
    children: [
      { href: '/settings/connections', label: 'เชื่อมต่อบริการอื่น' },
    ],
  },
  {
    icon: '🌐',
    label: 'เว็บไซต์',
    children: [
      // เจ้าของร้านสั่งเอา "ผลิตภัณฑ์" (/store/products) กับ "AI Visibility"
      // (/ai-visibility) ออกจากเมนู 18 ส.ค. 2569
      // ⚠️ เอาออกจาก "เมนู" เท่านั้น ตัวหน้ากับ API ยังอยู่ครบ พิมพ์ที่อยู่เข้าตรง ๆ ได้
      //    ถ้าจะลบทิ้งจริงต้องสั่งอีกที เพราะต้องลบทั้งหน้า API และข้อมูลที่ผูกอยู่
      { href: '/site', label: 'ระบบหลังร้านเว็บ' },
    ],
  },
]

// เมนูที่แสดงจริง — แอดมินเห็นทั้งหมด, พนักงาน (สิทธิ์โอนสินค้าเท่านั้น) เห็นแค่ "โอนสินค้า"
export function getNavItems(role: 'admin' | 'staff' | null): NavItem[] {
  if (role === 'staff') return NAV_ITEMS.filter(i => i.href === '/catalog/index.html#trf')
  return NAV_ITEMS
}
