// รายการเมนูของระบบหลังบ้านทั้งหมด — แก้เมนูที่ไฟล์นี้ที่เดียว
//
// ⚠️ **โครงเมนูลอกจาก ZORT ของจริง** (ภาพจอ ~/claude-shared/zort-ui/ ถ่าย 2 ก.ย. 2569)
//    เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" — คนที่ใช้ ZORT ทุกวันต้องย้ายมาแล้วใช้เป็นทันที
//    ลำดับเมนูของ ZORT: รายงาน · รายการขาย · รายการซื้อ · สินค้า · ลูกค้า/คู่ค้า ·
//    ร้านค้าออนไลน์ · การเงิน · เอกสาร · วางแผนธุรกิจ · ตั้งค่า · แพ็คเกจ
//    เราลอกลำดับนี้ แต่ **ไม่มี "แพ็คเกจ"** เพราะนั่นคือหน้าจ่ายค่าบริการของ ZORT เอง
//    และ "วางแผนธุรกิจ" ยังไม่มีเนื้อหา — ใส่เมื่อมีของจริงเท่านั้น ไม่ใส่เมนูเปล่า
// ⚠️ **ห้ามลบลิงก์เดิมทิ้งตอนจัดกลุ่มใหม่** เครื่องมือที่ร้านใช้ทุกวันต้องเข้าถึงได้เหมือนเดิม
//    (ระบบสั่งของ · ดรอปชิปปิ้ง · โอนสินค้า · ดึงบิล · ติดตามออเดอร์ · สินค้าที่ลูกค้าคืน)
import { BILL_VENDORS } from './vendors'
import { WEB_TOOLS } from './web-tools'

export interface NavChild { href: string; label: string }
export interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

// เมนู "โอนสินค้า" ของพนักงาน — ต้องคงลิงก์เดิมเป๊ะ (มี #trf) ไม่งั้นหน้าเปิดผิดแท็บ
const TRANSFER: NavItem = { href: '/catalog/index.html#trf', icon: '🔄', label: 'โอนสินค้า' }

export const NAV_ITEMS: NavItem[] = [
  {
    icon: '📊',
    label: 'รายงาน',
    children: [
      { href: '/', label: 'ภาพรวม' },
      { href: '/sales', label: 'ยอดขาย' },
      { href: '/core/reports', label: 'รายงานคลังเรา' },
      { href: '/ads', label: 'โฆษณา' },
    ],
  },
  {
    icon: '🧾',
    label: 'รายการขาย',
    children: [
      { href: '/core/pos', label: '🧮 ขายหน้าร้าน (POS)' },
      { href: '/core/sales', label: 'ดูรายการขาย' },
      { href: '/tracker', label: 'ติดตามออเดอร์' },
      { href: '/returns', label: 'สินค้าที่ลูกค้าคืน' },
    ],
  },
  {
    icon: '🛒',
    label: 'รายการซื้อ',
    children: [
      { href: '/core/purchases', label: 'ดูรายการซื้อ' },
      { href: '/catalog/index.html', label: 'ระบบสั่งของ' },
      { href: '/import', label: 'ดรอปชิปปิ้ง' },
    ],
  },
  {
    icon: '📦',
    label: 'สินค้า',
    children: [
      { href: '/core/stock', label: 'สินค้า / สต็อก' },
      { href: '/core/moves', label: 'ปรับสต็อกมือ' },
      { href: TRANSFER.href!, label: 'โอนสินค้า' },
      { href: '/core/missing-sku', label: 'SKU ที่คลังไม่รู้จัก' },
    ],
  },
  { href: '/core/customers', icon: '👥', label: 'ลูกค้า/คู่ค้า' },
  { href: '/core/channels', icon: '🏪', label: 'ร้านค้าออนไลน์' },
  {
    icon: '💵',
    label: 'การเงิน',
    // ZORT มีเมนูย่อย: ภาพรวม · กระเป๋าเงิน · รายได้อื่น · รายจ่ายอื่น · รายการโอนเงิน · รายการรับเงิน COD
    // ⚠️ **ยังไม่ใส่ "กระเป๋าเงิน"** เพราะระบบเราไม่มีข้อมูลนั้นเลย (ZORT มี 46 ใบ ยอดรวม 11.5 ล้าน
    //    ซึ่งเป็นทะเบียนที่ร้านดูแลเองใน ZORT ไม่ได้มาจากออเดอร์) — ใส่เมนูที่เปิดไปเจอจอเปล่า
    //    คือหลอกคนใช้ · รอเจ้าของร้านตัดสินใจก่อนว่าจะย้ายมาที่นี่หรือให้ PEAK ถือ
    // ⚠️ จอ "ภาพรวมการเงิน" ของ ZORT ว่างเปล่าสำหรับร้านนี้ (ไม่ได้ใช้โมดูลนั้น)
    //    ของเราจึงโชว์รายรับจากการขายจริงแทน ซึ่งมีประโยชน์กว่าลอกจอเปล่ามา
    children: [
      { href: '/core/finance', label: 'ภาพรวม' },
      { href: '/core/peak', label: 'สะพานส่งเข้า PEAK' },
      { href: '/bills', label: 'รวมบิลทุกเจ้า' },
      ...BILL_VENDORS.map((v) => ({ href: `/bills/${v.id}`, label: v.name })),
    ],
  },
  {
    icon: '📄',
    label: 'เอกสาร',
    children: [
      { href: '/web/permits', label: 'ใบ ลซ.๒ ที่ลูกค้าส่งมา' },
    ],
  },
  { href: '/core', icon: '🌳', label: 'โครงการแก่น' },
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
    children: WEB_TOOLS.map((t) => ({
      href: t.native ? t.path : `/site/tool/${t.slug}`,
      label: t.title,
    })),
  },
]

// เมนูที่แสดงจริง — แอดมินเห็นทั้งหมด, พนักงาน (สิทธิ์โอนสินค้าเท่านั้น) เห็นแค่ "โอนสินค้า"
// ⚠️ หลังจัดกลุ่มแบบ ZORT แล้ว "โอนสินค้า" ไปเป็นเมนูย่อยของ "สินค้า"
//    จึงกรองจาก NAV_ITEMS ตรง ๆ ไม่ได้อีก — ต้องคืนรายการเดี่ยวให้พนักงานแทน
//    (ถ้าลืมจุดนี้ พนักงานจะเห็นเมนูว่างเปล่าแล้วลงเวลา/โอนของไม่ได้)
export function getNavItems(role: 'admin' | 'staff' | null): NavItem[] {
  if (role === 'staff') return [TRANSFER]
  return NAV_ITEMS
}
