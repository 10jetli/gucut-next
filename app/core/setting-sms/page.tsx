// ตั้งค่า → บริษัท/ร้านค้า → **ตั้งค่า SMS** — ลอกผังจาก `zort-ui/91`
//
// 🟡 **จอผังเปล่าโดยตั้งใจ — เจ้าของร้านสั่งผ่าน CEO 7 ก.ย. 2569:
//    "สามจอที่ร้านไม่ได้ใช้ (Tracking/รายงานอัตโนมัติ/SMS) ลอกแค่ผังเปล่าพอ ไม่ต้องต่อระบบจริง"**
//    หลักฐานจากจอจริง (ภาพ 91): SMS Credit = 0 ข้อความ · ประเภทข้อความไม่ติ๊กสักช่อง
//    ⇒ ร้านไม่เคยส่ง SMS ผ่าน ZORT เลย — แจ้งลูกค้าทาง LINE + Web Push (ฟรี) แทน
//    ⇒ **ไม่มีอะไรต้องย้ายตอนเลิก ZORT**
// ⚠️ ช่องทุกช่อง disabled — ทำช่องกรอกที่บันทึกไม่ได้ = ฟอร์มหลอก
// ⚠️ ตัวเลขเครดิต/ข้อความตัวอย่างเป็นภาพถ่าย ณ 7 ก.ย. 2569 กำกับวันที่ไว้แล้ว
import { PageHead } from '@/components/zort'
import { SettingsNav } from '@/components/zort/SettingsNav'
import Link from 'next/link'

/* ประเภทข้อความทั้ง 4 ตามผังภาพ 91 — เก็บข้อความตัวอย่างของ ZORT ไว้ให้เห็นว่าฟีเจอร์ทำอะไร */
const KINDS: Array<[title: string, template: string]> = [
  ['ยืนยันการสั่งซื้อ', 'ยืนยันการสั่งซื้อรายการ [ordernumber] จำนวนเงิน [amount] บาท'],
  ['ยืนยันการชำระเงิน', 'ยืนยันการชำระเงินรายการ [ordernumber] จำนวนเงิน [paymentamount] บาท'],
  ['ยืนยันการส่งสินค้า', 'หมายเลข Tracking สำหรับการรับสินค้าของคุณ คือ [trackingno]'],
  ['แจ้งเตือนการชำระเงิน', 'คุณ [customername] มียอดค้างชำระการสั่งซื้อรายการ [ordernumber] จำนวนเงิน [amount] บาท'],
]

export default function SettingSmsPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHead title="ข้อมูลบริษัท/ร้านค้า"
        summary={<span className="text-gray-400">ตั้งค่า SMS — ผังตาม ZORT</span>} />
      <div className="flex gap-5 items-start">
        <SettingsNav active="sms" />
        <div className="flex-1 min-w-0">
          {/* แถบเครดิตตามผัง — ค่า ณ วันถ่ายภาพ กำกับวันที่เสมอ */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-4 py-2.5 mb-4">
            <span className="text-[13px] text-blue-900 font-semibold">
              SMS Credit : 0 ข้อความ <span className="font-normal text-blue-700/70 text-[11.5px]">(ณ 7 ก.ย. 2569 — ไม่เคยเติมเลย)</span>
            </span>
            <span className="text-[11.5px] text-gray-400" title="ปุ่มเติมเครดิตของ ZORT — ของเราไม่มีระบบ SMS จึงไม่มีปุ่มจริง">
              (ZORT มีปุ่ม &ldquo;เติม SMS Credit&rdquo; ตรงนี้)
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 md:p-5">
            <p className="text-[13.5px] font-semibold text-gray-800 mb-3">💬 ข้อความ SMS</p>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-[150px] shrink-0 text-[12px] text-gray-500 pt-1.5">ชื่อผู้ส่ง</span>
              <span className="text-[12.5px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">ZORT</span>
            </div>

            <p className="text-[12px] text-gray-500 mb-2">ประเภทข้อความ — ของจริงไม่ติ๊กสักช่อง</p>
            {KINDS.map(([title, template]) => (
              <div key={title} className="mb-3 pl-1">
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
                  <input type="checkbox" disabled checked={false} className="w-3.5 h-3.5" />
                  {title}
                </label>
                <p className="text-[11.5px] text-gray-400 bg-gray-50/60 border border-dashed border-gray-200 rounded px-3 py-1.5 mt-1 ml-6 max-w-[440px] font-mono">
                  {template}
                </p>
              </div>
            ))}

            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-4 leading-relaxed">
              🟡 <b>ZORT ของร้านก็ไม่ได้ใช้</b> — เครดิต 0 · ไม่เปิดสักประเภท (ตรวจจากจอจริง 7 ก.ย. 2569)
              ⇒ ไม่มีอะไรต้องย้ายตอนเลิก ZORT · จอนี้ลอกผังไว้ให้ครบตามคำสั่ง ไม่ต่อระบบจริง
            </p>
            <p className="text-[11.5px] text-gray-400 mt-2">
              ร้านแจ้งลูกค้าทาง <b>LINE + Web Push</b> ซึ่งฟรีและเปิดใช้อยู่แล้ว — ดูรายการแจ้งเตือนที่{' '}
              <Link href="/core/setting-notify" className="text-blue-600 hover:underline">ตั้งค่า → การแจ้งเตือน</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
