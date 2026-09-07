// ตั้งค่า → บริษัท/ร้านค้า → **Tracking & Analytics** — ลอกผังจาก `zort-ui/100`
//
// 🟡 **จอผังเปล่าโดยตั้งใจ — เจ้าของร้านสั่งผ่าน CEO 7 ก.ย. 2569:
//    "สามจอที่ร้านไม่ได้ใช้ (Tracking/รายงานอัตโนมัติ/SMS) ลอกแค่ผังเปล่าพอ ไม่ต้องต่อระบบจริง"**
//    หลักฐานจากจอจริง (ภาพ 100): ZORT ของร้านก็ว่างทั้ง 3 ช่อง — ฟีเจอร์นี้เอาไว้ฝังโค้ด
//    วิเคราะห์ลงหน้า Share ของ ZORT ซึ่งร้านไม่ได้ใช้เลย ⇒ **ไม่มีอะไรต้องย้ายตอนเลิก ZORT**
// ⚠️ ช่องเป็น disabled ไม่ใช่ช่องกรอกจริง — ทำช่องกรอกที่บันทึกไม่ได้ = ฟอร์มหลอก
import { PageHead } from '@/components/zort'
import { SettingsNav } from '@/components/zort/SettingsNav'
import Link from 'next/link'

const FIELDS = ['หน้า Share รายการขาย', 'หน้า Share เอกสาร', 'หน้า Share สินค้า']

export default function SettingTrackingPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHead title="ข้อมูลบริษัท/ร้านค้า"
        summary={<span className="text-gray-400">ตั้งค่า Tracking &amp; Analytics — ผังตาม ZORT</span>} />
      <div className="flex gap-5 items-start">
        <SettingsNav active="tracking" />
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-md p-4 md:p-5">
            <p className="text-[13.5px] font-semibold text-gray-800 mb-3">📈 Tracking &amp; Analytics Code</p>
            {FIELDS.map((f) => (
              <div key={f} className="flex items-start gap-3 mb-2.5">
                <span className="w-[170px] shrink-0 text-[12px] text-gray-500 pt-1.5">{f}</span>
                <span className="flex-1 max-w-[420px] h-[52px] text-[12px] text-gray-300 bg-gray-50/60 border border-dashed border-gray-200 rounded px-3 py-1.5">
                  (ว่าง)
                </span>
              </div>
            ))}
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-4 leading-relaxed">
              🟡 <b>ZORT ของร้านก็ไม่ได้ใช้</b> — ตรวจจากจอจริง 7 ก.ย. 2569 ว่างทั้ง 3 ช่อง ·
              ฟีเจอร์นี้ฝังโค้ดวิเคราะห์ลงหน้า Share ของ ZORT ซึ่งร้านไม่ได้ใช้
              ⇒ ไม่มีอะไรต้องย้ายตอนเลิก ZORT · จอนี้ลอกผังไว้ให้ครบตามคำสั่ง ไม่ต่อระบบจริง
            </p>
            <p className="text-[11.5px] text-gray-400 mt-2">
              พิกเซล/โค้ดวิเคราะห์ของเว็บร้านจริงตั้งที่{' '}
              <Link href="/web/marketing" className="text-blue-600 hover:underline">เว็บไซต์ → พิกเซลการตลาด</Link>
              {' '}(Meta · TikTok · GA4 · Google Ads · LINE Tag)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
