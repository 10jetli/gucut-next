// รายการเมนูของระบบหลังบ้านทั้งหมด — แก้เมนูที่ไฟล์นี้ที่เดียว
import { BILL_VENDORS } from './vendors'

export interface NavChild { href: string; label: string }
import { WEB_TOOLS } from './web-tools'

export interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

export const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/sales', icon: '📊', label: 'ยอดขายทุกช่องทาง' },
  {
    icon: '🌳',
    label: 'โครงการแก่น',
    children: [
      { href: '/core', label: 'ภาพรวมคลังเงา' },
      { href: '/core/reports', label: 'รายงาน (คลังเรา)' },
      { href: '/core/sales', label: 'รายการขาย (คลังเรา)' },
      { href: '/core/stock', label: 'สินค้า / สต็อก (คลังเรา)' },
      { href: '/core/customers', label: 'ลูกค้า / คู่ค้า (คลังเรา)' },
      { href: '/core/purchases', label: 'รายการซื้อ' },
      { href: '/core/channels', label: 'ร้านค้าออนไลน์' },
      { href: '/core/finance', label: 'การเงิน' },
    ],
  },
  { href: '/tracker', icon: '📋', label: 'ติดตามออเดอร์' },
  { href: '/returns', icon: '↩️', label: 'สินค้าที่ลูกค้าคืน' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/catalog/index.html', icon: '🧰', label: 'ระบบสั่งของ' },
  { href: '/import', icon: '🇨🇳', label: 'นำเข้าจากจีน' },
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
    // เจ้าของร้านสั่ง "เอาออกมาไว้ข้างนอก" (28 ส.ค. 2569) — เมนูดึงจากทะเบียน
    // เครื่องมือทั้งหมดอัตโนมัติ เพิ่มหน้าใหม่ใน web-tools.ts แล้วเมนูขึ้นเอง
    children: [
      ...WEB_TOOLS.map((t) => ({
        href: t.native ? t.path : `/site/tool/${t.slug}`,
        label: t.title,
      })),
    ],
  },
]

// เมนูที่แสดงจริง — แอดมินเห็นทั้งหมด, พนักงาน (สิทธิ์โอนสินค้าเท่านั้น) เห็นแค่ "โอนสินค้า"
export function getNavItems(role: 'admin' | 'staff' | null): NavItem[] {
  if (role === 'staff') return NAV_ITEMS.filter(i => i.href === '/catalog/index.html#trf')
  return NAV_ITEMS
}
