// รายการเมนูของระบบหลังบ้านทั้งหมด — แก้เมนูที่ไฟล์นี้ที่เดียว
import { BILL_VENDORS } from './vendors'

export interface NavChild { href: string; label: string }
export interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

export const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders', icon: '📦', label: 'Orders' },
  { href: '/products', icon: '🛍', label: 'สินค้า' },
  { href: '/factory', icon: '🏭', label: 'โรงงาน' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/catalog/index.html', icon: '🧰', label: 'ระบบสั่งของ' },
  { href: '/catalog/index.html#trf', icon: '🔄', label: 'โอนสินค้า' },
  {
    icon: '🧾',
    label: 'บิล',
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
]
