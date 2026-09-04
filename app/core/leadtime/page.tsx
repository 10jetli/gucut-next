'use client'
// วางแผนธุรกิจ → กลุ่ม Lead Time — **ลอกจาก `zort-ui/38-zort-กลุ่ม-LeadTime.jpg`**
//
// ผัง ZORT (อ่านจากภาพจริง ไม่ได้เดา):
//   ชื่อจอ "กลุ่ม Lead Time" + ลิงก์ "ⓘ Lead Time คืออะไร?" ต่อท้ายชื่อ
//   → บรรทัดรอง "จำนวน 0 รายการ" → ปุ่มขวาบน "เพิ่มกลุ่มใหม่" (น้ำเงินทึบ)
//   → ตาราง: ☐ · # · ชื่อกลุ่ม · คู่ค้า · ต้องการขายให้หมดภายใน (วัน) ·
//            Lead Time เฉลี่ย (วัน) · Lead Time สูงสุด (วัน) · จำนวนรายการสินค้า
//   → กล่องว่าง: ไอคอนโฟลเดอร์มีเครื่องหมายบวก + คำว่า "ไม่มีข้อมูล"
//   → มุมขวาล่างของตาราง: "จำนวน 0 รายการ" (ซ้ำอีกครั้ง)
//   ⚠️ จอนี้ **ไม่มีช่องค้นหา ไม่มีแท็บ ไม่มีปุ่มนำเข้าไฟล์** — ต่างจากจออื่นของ ZORT
//
// 🔴 **ZORT ของร้านนี้ว่างเปล่าจริง (0 รายการ) เพราะร้านไม่ได้ใช้ฟีเจอร์นี้**
//    ⇒ เข้าเกณฑ์ "จอที่ ZORT ว่างเพราะร้านไม่ได้ใช้" ⇒ ทำผังให้ตรง แล้วเขียนบอกว่าทำไมว่าง
//    **ห้ามแกล้งมีข้อมูล และห้ามไม่มีจอ** (เจ้าของร้านสั่งทำตามผัง ZORT · 4 ก.ย. 2569)
//
// 🔴 **แต่ "ว่าง" ของเรา ไม่เท่ากับ "ว่าง" ของ ZORT**
//    ZORT ว่าง = ร้านยังไม่ได้ตั้งกลุ่ม · ของเราว่าง = **ยังไม่ได้ต่อท่อ**
//    ⇒ ห้ามเขียน "0 รายการ" ลอย ๆ เพราะเราไม่ได้นับอะไรเลย ศูนย์ของเราแปลว่า "ยังไม่รู้"
import Link from 'next/link'
import { PageHead, TableWrap, TH, THR } from '@/components/zort'

/** วันที่ไปเปิดดูจอ ZORT ของจริงล่าสุด — แก้ที่นี่เมื่อไปตรวจใหม่
 *  (กติกาเดียวกับ LedgerScreen — เลขที่คัดมาด้วยมือต้องบอกอายุตัวเอง) */
const CHECKED_AT = '2026-09-04'
const STALE_DAYS = 45

/** ค่า Lead Time ที่ **ระบบเราใช้จริง** อยู่ตอนนี้ — อยู่ที่ `lib/reorder.ts`
 *  ⚠️ ไม่ใช่ข้อมูลจาก ZORT · เป็นค่าเดียวใช้ทั้งร้าน ไม่ได้แยกเป็นกลุ่ม
 *     เขียนบอกไว้เพราะคนเปิดจอนี้กำลังหาคำตอบว่า "ร้านใช้ค่าอะไรอยู่"
 *     ตารางว่างอย่างเดียวตอบคำถามนั้นไม่ได้ */
const OUR_LEAD_DAYS = 45
const OUR_COVER_DAYS = 120

function ageOf(iso: string) {
  const d = Math.floor((Date.now() - new Date(`${iso}T00:00:00+07:00`).getTime()) / 86400000)
  return Number.isFinite(d) && d >= 0 ? d : null
}
const thai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d} ${M[m - 1]} ${y + 543}`
}

export default function LeadTimeGroupPage() {
  const age = ageOf(CHECKED_AT)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="กลุ่ม Lead Time"
        summary={
          <>
            {/* ⚠️ ZORT เขียน "จำนวน 0 รายการ" — ของเราเขียนแบบนั้นไม่ได้ เพราะยังไม่ได้นับอะไร */}
            ยังไม่ได้ต่อกับ ZORT — ที่ ZORT เมื่อ <b>{thai(CHECKED_AT)}</b>
            {age != null && <> ({age === 0 ? 'วันนี้' : `${age} วันที่แล้ว`})</>} มี 0 รายการ
          </>
        }
        actions={
          // ปุ่มนี้ ZORT มี — ของเราพาไปหน้าที่บอกตรง ๆ ว่ายังทำอะไรไม่ได้
          // ห้ามทำปุ่มที่กดแล้วไม่เกิดอะไร
          <Link
            href="/core/soon/leadtime"
            className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
            style={{ background: '#4669e5' }}
          >
            เพิ่มกลุ่มใหม่
          </Link>
        }
      />

      {/* ลิงก์ "ⓘ Lead Time คืออะไร?" ที่ ZORT วางต่อท้ายชื่อจอ
          ⚠️ ของเราวางเป็นบรรทัดของตัวเองเพราะ PageHead ไม่รับของต่อท้ายชื่อ
             — ผังต่างตรงนี้จุดเดียว และเป็นการวางที่อ่านง่ายกว่าบนจอแคบ */}
      <div className="text-[12.5px] text-gray-600 mb-3">
        <span className="text-gray-400">ⓘ</span>{' '}
        <b>Lead Time คืออะไร?</b> — จำนวนวันตั้งแต่สั่งของกับผู้ผลิต จนของมาถึงคลัง ·
        ใช้คำนวณว่า <b>ต้องสั่งของก่อนหมดกี่วัน</b> จึงจะไม่ขาดสต็อก
      </div>

      <TableWrap>
        <table className="w-full min-w-[900px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              {/* ⚠️ ZORT มีช่องติ๊กหน้าแถว — ของเราไม่ทำ เพราะยังไม่มีคำสั่งหมู่ที่ทำงานจริง
                  ช่องติ๊กที่ติ๊กแล้วทำอะไรไม่ได้คือของหลอก (กติกาเดิมของโปรเจกต์) */}
              <th className={TH} style={{ width: 44 }}>#</th>
              <th className={TH}>ชื่อกลุ่ม</th>
              <th className={TH}>คู่ค้า</th>
              <th className={THR}>ต้องการขายให้หมดภายใน (วัน)</th>
              <th className={THR}>Lead Time เฉลี่ย (วัน)</th>
              <th className={THR}>Lead Time สูงสุด (วัน)</th>
              <th className={THR}>จำนวนรายการสินค้า</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="py-14 text-center">
                <span className="text-[34px] block opacity-60">🗂️</span>
                <p className="text-[14px] text-gray-800 mt-2">ยังไม่ได้ต่อท่อกับ ZORT</p>
                <p className="text-[12.5px] text-gray-500 mt-1 max-w-[560px] mx-auto leading-relaxed">
                  จอนี้ใช้จัดกลุ่มสินค้าตามระยะเวลารอของ เพื่อให้ระบบคำนวณได้ว่าต้องสั่งซื้อเมื่อไหร่
                  <br />
                  {/* 🔴 ประโยคนี้คือหัวใจ — ตารางว่างที่ไม่บอกเหตุผล จะถูกอ่านว่า "ร้านไม่มีข้อมูลนี้" */}
                  ตารางว่างเพราะ<b>ยังไม่ได้ดึงข้อมูล</b> ไม่ใช่เพราะร้านไม่มีกลุ่ม ·
                  ตอนไปเปิดดูจอ ZORT ของจริง <b>ร้านก็ยังไม่ได้ตั้งกลุ่มไว้เหมือนกัน (0 รายการ)</b>
                </p>

                {/* 🔵 ของที่ ZORT ไม่มี แต่คนเปิดจอนี้กำลังหาคำตอบอยู่:
                    "แล้วตอนนี้ร้านใช้ค่าอะไรคำนวณ" — ตารางว่างอย่างเดียวตอบไม่ได้ */}
                <div className="text-[12.5px] text-gray-700 bg-[#edf6fe] border border-[#cfe3f7] rounded-md px-4 py-3 mt-4 max-w-[560px] mx-auto text-left leading-relaxed">
                  <b>ระบบสั่งของอัตโนมัติของเราใช้ค่าอะไรอยู่ตอนนี้</b>
                  <span className="ml-1 text-[10.5px] text-blue-600">+เรา</span>
                  <br />
                  · Lead Time <b>{OUR_LEAD_DAYS} วัน</b> — เจ้าของร้านยืนยันเองว่ารอของจากโรงงาน 45 วัน
                  <br />
                  · อยากมีของพอขาย <b>{OUR_COVER_DAYS} วัน</b>
                  <br />
                  <span className="text-gray-500">
                    ⚠️ เป็น<b>ค่าเดียวใช้ทั้งร้าน</b> ยังไม่ได้แยกเป็นกลุ่มแบบ ZORT ·
                    ตั้งไว้ในโค้ดที่ <code>lib/reorder.ts</code> ยังแก้จากหน้าจอไม่ได้
                  </span>
                </div>

                {/* ตาข่ายที่ประกาศวันหมดอายุของตัวเอง — กฎ nets-expire-silently */}
                {age != null && age > STALE_DAYS && (
                  <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3 max-w-[560px] mx-auto leading-relaxed">
                    ⚠️ ข้อมูลที่คัดมาด้วยมือเมื่อ <b>{age} วันที่แล้ว</b> — เก่าเกินจะเชื่อแล้ว
                    ไปเปิดจอ ZORT ดูอีกครั้งแล้วแก้ <code>CHECKED_AT</code> ในไฟล์นี้
                  </p>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      {/* มุมขวาล่างของตาราง ZORT เขียน "จำนวน 0 รายการ" ซ้ำอีกครั้ง
          ⚠️ ของเราเขียนเป็น "ยังไม่ได้ดึงข้อมูล" ด้วยเหตุผลเดียวกับหัวจอ */}
      <div className="flex justify-end mt-3">
        <span className="text-[12.5px] text-gray-400">ยังไม่ได้ดึงข้อมูล</span>
      </div>

      <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
        ผังลอกจาก ZORT ของจริง · ปุ่ม <b>เพิ่มกลุ่มใหม่</b> ยังทำงานไม่ได้ กดแล้วจะบอกว่าติดอะไรอยู่ ·
        ZORT มี<b>ช่องติ๊กหน้าแถว</b> ของเราไม่ทำ เพราะยังไม่มีคำสั่งหมู่ที่ทำงานจริง —
        ช่องติ๊กที่ติ๊กแล้วทำอะไรไม่ได้คือของหลอก
      </p>
    </div>
  )
}
