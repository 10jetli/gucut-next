// รายการเมนูของระบบหลังบ้านทั้งหมด — แก้เมนูที่ไฟล์นี้ที่เดียว
//
// ⚠️ **โครงเมนูลอกจาก ZORT ของจริง** (ภาพจอ ~/claude-shared/zort-ui/ ถ่าย 2 ก.ย. 2569)
//    เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" แล้วย้ำอีกครั้งว่า
//    **"ทำเมนูแบบนี้ให้ครบ · รายละเอียดจะใส่ทีหลัง"**
//    ⇒ เมนูย่อยจึงครบเท่า ZORT ทุกกลุ่ม แม้บางหน้ายังไม่ได้ทำเนื้อหา
//    ลำดับกลุ่มของ ZORT: รายงาน · รายการขาย · รายการซื้อ · สินค้า · ลูกค้า/คู่ค้า ·
//    ร้านค้าออนไลน์ · การเงิน · เอกสาร · วางแผนธุรกิจ · ตั้งค่า · แพ็คเกจ
//    **ไม่มี "แพ็คเกจ"** เพราะนั่นคือหน้าจ่ายค่าบริการของ ZORT เอง ไม่เกี่ยวกับร้าน
//
// ⚠️ **หน้าที่ยังไม่ทำต้องติดธง soon** — แถบเมนูแสดงจาง ๆ ให้แยกออกจากของที่ใช้ได้จริง
//    และกดแล้วไปหน้าที่บอกตรง ๆ ว่ายังไม่มีเนื้อหา จะทำอะไร ตอนนี้ไปทำที่ไหน (ดู lib/zort-menu.ts)
//    เมนูครบแต่ดูไม่ออกว่าอันไหนพร้อม = คนใช้เสียเวลากดหาทีละอัน
// ⚠️ **ห้ามลบลิงก์เดิมทิ้งตอนจัดกลุ่มใหม่** เครื่องมือที่ร้านใช้ทุกวันต้องเข้าถึงได้เหมือนเดิม
//    (ระบบสั่งของ · ดรอปชิปปิ้ง · โอนสินค้า · ดึงบิล · ติดตามออเดอร์ · สินค้าที่ลูกค้าคืน)
import { BILL_VENDORS } from './vendors'
import { WEB_TOOLS } from './web-tools'

export interface NavChild {
  href: string
  label: string
  /** true = เมนูมีแล้วแต่ยังไม่ได้ทำเนื้อหา — แถบเมนูแสดงจาง */
  soon?: boolean
}
export interface NavItem { href?: string; icon: string; label: string; children?: NavChild[] }

/** ทางลัดสร้างเมนูที่ยังไม่ได้ทำ — คีย์ต้องตรงกับ SOON ใน lib/zort-menu.ts */
const soon = (key: string, label: string): NavChild =>
  ({ href: `/core/soon/${key}`, label, soon: true })

// เมนู "โอนสินค้า" ของพนักงาน — ต้องคงลิงก์เดิมเป๊ะ (มี #trf) ไม่งั้นหน้าเปิดผิดแท็บ
const TRANSFER: NavItem = { href: '/catalog/index.html#trf', icon: '🔄', label: 'โอนสินค้า' }

export const NAV_ITEMS: NavItem[] = [
  {
    icon: '📊',
    label: 'รายงาน',
    children: [
      { href: '/', label: 'ภาพรวม' },
      { href: '/sales', label: 'ยอดขาย' },
      soon('buy-report', 'ยอดซื้อ'),
      { href: '/core/reports', label: 'สินค้า' },
      soon('customer-report', 'ลูกค้า'),
      { href: '/ads', label: 'โฆษณา' },
    ],
  },
  {
    icon: '🧾',
    label: 'รายการขาย',
    children: [
      // "สร้างรายการขาย" ของ ZORT = เปิดบิลใหม่ ⇒ ตรงกับจอขายหน้าร้านของเราพอดี
      { href: '/core/pos', label: 'สร้างรายการขาย (POS)' },
      { href: '/core/sales', label: 'ดูรายการขาย' },
      soon('quotation', 'ใบเสนอราคา'),
      soon('shipping', 'บริการส่งสินค้า'),
      { href: '/returns', label: 'รับคืนสินค้า' },
      soon('packing', 'แพ็คสินค้า'),
      { href: '/tracker', label: 'ติดตามออเดอร์' },
    ],
  },
  {
    icon: '🛒',
    label: 'รายการซื้อ',
    children: [
      soon('buy-create', 'สร้างรายการซื้อ'),
      { href: '/core/purchases', label: 'ดูรายการซื้อ' },
      soon('buy-return', 'คืนสินค้า'),
      // "รับสินค้า" ของ ZORT = รับของเข้าคลัง ⇒ ตรงกับหน้าปรับสต็อกมือของเรา
      { href: '/core/moves', label: 'รับสินค้า / ปรับสต็อก' },
      { href: '/catalog/index.html', label: 'ระบบสั่งของ' },
      { href: '/import', label: 'ดรอปชิปปิ้ง' },
    ],
  },
  {
    icon: '📦',
    label: 'สินค้า',
    children: [
      { href: '/core/stock', label: 'สินค้า' },
      soon('product-add', 'เพิ่มสินค้า'),
      soon('product-bundle', 'สินค้าเป็นชุด'),
      soon('product-variant', 'สินค้าหลากคุณสมบัติ'),
      { href: '/core/categories', label: 'หมวดหมู่' },
      { href: '/core/branches', label: 'คลังสินค้า/สาขา' },
      { href: TRANSFER.href!, label: 'รายการโอนสินค้า' },
      { href: '/core/missing-sku', label: 'SKU ที่คลังไม่รู้จัก' },
    ],
  },
  {
    icon: '👥',
    label: 'ลูกค้า/คู่ค้า',
    children: [
      { href: '/core/customers', label: 'ผู้ติดต่อ' },
      soon('customer-group', 'กลุ่มลูกค้า'),
      soon('dealer', 'ตัวแทนจำหน่าย'),
      soon('order-page', 'หน้าสั่งซื้อ'),
    ],
  },
  {
    icon: '🏪',
    label: 'ร้านค้าออนไลน์',
    children: [
      { href: '/core/channels', label: 'ช่องทางขาย' },
      soon('salepage', 'เซลเพจ'),
    ],
  },
  {
    icon: '💵',
    label: 'การเงิน',
    children: [
      { href: '/core/finance', label: 'ดูภาพรวม' },
      soon('wallet', 'กระเป๋าเงิน'),
      soon('income-other', 'รายได้อื่น'),
      soon('expense-other', 'รายจ่ายอื่น'),
      soon('money-transfer', 'รายการโอนเงิน'),
      soon('cod-receive', 'รายการรับเงิน COD'),
      { href: '/core/peak', label: 'สะพานส่งเข้า PEAK' },
      { href: '/bills', label: 'รวมบิลทุกเจ้า' },
      ...BILL_VENDORS.map((v) => ({ href: `/bills/${v.id}`, label: v.name })),
    ],
  },
  {
    icon: '📄',
    label: 'เอกสาร',
    children: [
      soon('files', 'ไฟล์'),
      soon('accounting-doc', 'เอกสารบัญชี'),
      { href: '/web/permits', label: 'ใบ ลซ.๒ ที่ลูกค้าส่งมา' },
    ],
  },
  {
    icon: '📈',
    label: 'วางแผนธุรกิจ',
    children: [
      // "วางแผนสั่งซื้อซ้ำ" ของ ZORT = ดูว่าอะไรใกล้หมดต้องสั่งเพิ่ม ⇒ ตรงกับระบบสั่งของ
      { href: '/catalog/index.html', label: 'วางแผนสั่งซื้อซ้ำ' },
      soon('leadtime', 'กลุ่ม Lead Time'),
    ],
  },
  { href: '/core', icon: '🌳', label: 'โครงการแก่น' },
  {
    icon: '⚙️',
    label: 'ตั้งค่า',
    children: [
      soon('setting-profile', 'ข้อมูลส่วนตัว'),
      soon('setting-company', 'บริษัท/ร้านค้า'),
      soon('setting-users', 'ผู้ใช้งาน'),
      soon('setting-roles', 'สิทธิ์การใช้งาน'),
      soon('setting-notify', 'การแจ้งเตือน'),
      soon('setting-autoreport', 'รายงานอัตโนมัติ'),
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
