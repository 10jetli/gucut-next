// เมนูย่อยฝั่งซ้ายของกลุ่มจอ "ข้อมูลบริษัท/ร้านค้า" — ผังตามภาพ `zort-ui/84` (10 รายการ)
// ใช้ร่วมกันทุกจอย่อยในกลุ่มนี้ — เพิ่ม/แก้รายการที่นี่ที่เดียว ห้ามคัดลอกไปวางในจอ
// จอที่ยังไม่มีพาไปหน้า soon ที่บอกตรง ๆ (ห้ามลิงก์หลอก) · ภาพจอจริง 87-102 มีครบแล้ว
import Link from 'next/link'

const ITEMS: Array<[key: string, label: string, href: string]> = [
  ['company', 'บริษัท / ร้านค้า', '/core/settings-company'],
  ['program', 'ตั้งค่าโปรแกรม', '/core/soon/setting-program'],
  ['docs', 'ตั้งค่าเอกสาร', '/core/soon/setting-docs'],
  ['shipping', 'ตั้งค่าช่องทางจัดส่ง', '/core/soon/setting-shipping'],
  ['channels', 'ตั้งค่าช่องทางการขาย', '/core/soon/setting-channels'],
  ['sms', 'ตั้งค่า SMS', '/core/setting-sms'],
  ['payment', 'ตั้งค่าการชำระเงิน', '/core/soon/setting-payment'],
  ['slipcheck', 'ตั้งค่าการตรวจสอบสลิปอัตโนมัติ', '/core/soon/setting-slipcheck'],
  ['tracking', 'Tracking & Analytics', '/core/setting-tracking'],
  ['reset', 'รีเซ็ตข้อมูลทั้งหมด', '/core/soon/setting-reset'],
]

export function SettingsNav({ active }: { active: string }) {
  return (
    <nav className="hidden md:block w-[190px] shrink-0 bg-white border border-gray-200 rounded-md py-1.5 text-[12.5px]">
      {ITEMS.map(([key, label, href]) => (
        <Link key={key} href={href}
          className={`block px-3 py-1.5 ${key === active
            ? 'text-blue-700 font-semibold border-l-2 border-blue-600 bg-blue-50/50'
            : 'text-gray-600 hover:bg-gray-50'}`}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
