'use client'
// การเงิน → กระเป๋าเงิน — **ลอกผังจาก `zort-ui/09-การเงิน-กระเป๋าเงิน.jpg`**
//
// 🔴 **จอนี้ต่างจากจอว่างอื่น ๆ ตรงที่ ZORT "มีข้อมูลจริง" แต่เราดึงออกไม่ได้**
//    ZORT มี 46 ใบ ยอดรวมหลักสิบล้าน · ยิง API แล้วตอบ 404 ทุกเส้น
//    (Wallet · Payment · Receipt — ฝั่งท่อยิงจริงยืนยัน 3 ก.ย. 2569)
//    ⇒ **ห้ามใช้ LedgerScreen** ซึ่งเขียนว่า "ZORT ว่างเปล่าอยู่แล้ว" — จอนี้ไม่ใช่แบบนั้น
//       สองอย่างนี้ต้องแยกให้ขาด: "ไม่มีของ" กับ "มีของแต่เอาออกไม่ได้"
//
// เกณฑ์ "เหมือน ZORT 100%" ของจอกลุ่มนี้ (ตกลงกันไว้ใน zort-menu-ครบทั้งแผง.md):
//   จอมีอยู่ · ผังเหมือน · **เขียนบอกตรง ๆ ว่าทำไมว่าง** — ไม่ใช่แกล้งมีข้อมูล และไม่ใช่ไม่มีจอ
//
// ⚠️ **ห้ามวาดแถวตัวอย่าง ห้ามใส่ตัวเลขสมมติ** แม้จะทำให้จอดูเหมือนของจริงกว่านี้
//    ตัวเลขบนจอการเงินที่ไม่มีที่มา = ของอันตรายที่สุดเท่าที่จอจะมีได้
import Link from 'next/link'
import { PageHead } from '@/components/zort'

/** วันที่ไปเปิดดูจอ ZORT ของจริงล่าสุด — **แก้ที่นี่เมื่อไปตรวจใหม่**
 *  🔴 เลขที่คัดมาด้วยมือต้องบอกอายุตัวเอง ไม่งั้นอีกสามเดือนจอจะยังยืนยันเลขของวันนี้
 *     (กติกาเดียวกับ LedgerScreen — stale-state บนหน้าจอแย่กว่าในคอมเมนต์ เพราะคนเอาไปตัดสินใจ) */
const CHECKED_AT = '2026-09-03'
const STALE_DAYS = 45
/** ที่เห็นบนจอ ZORT วันนั้น — **เป็นภาพนิ่ง ไม่ใช่ค่าที่อัปเดตเอง** */
const SEEN = { rows: 46, total: '11,532,894.2992' }

function ageDays(iso: string): number | null {
  const d = Math.floor((Date.now() - new Date(`${iso}T00:00:00+07:00`).getTime()) / 86400000)
  return Number.isFinite(d) && d >= 0 ? d : null
}

const COLS = [
  { label: '#' },
  { label: 'วันที่ปิดยอดล่าสุด' },
  { label: 'ชื่อกระเป๋าเงิน' },
  { label: 'ธนาคาร' },
  { label: 'ชื่อบัญชีธนาคาร' },
  { label: 'เลขบัญชีธนาคาร' },
  { label: 'จำนวนเงินคงเหลือ', right: true },
]

export default function WalletPage() {
  const age = ageDays(CHECKED_AT)
  const stale = age !== null && age > STALE_DAYS

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="กระเป๋าเงิน"
        summary={
          <>
            ทะเบียนบัญชีและช่องทางรับเงินพร้อมยอดคงเหลือ
            {' | '}
            <span className="text-gray-400">ยังดึงจาก ZORT ไม่ได้ — อ่านกล่องแดงด้านล่าง</span>
          </>
        }
      />

      {/* 🔴 "ทำไม่ได้" กับ "ยังไม่ได้ทำ" ต้องแยกป้ายให้ขาด
          ป้ายเดียวกัน = คนรอของที่ไม่มีวันมา และคนทำงานรอบหน้าไปลองซ้ำที่พิสูจน์แล้วว่าไม่มีทาง */}
      <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-3">
        <span className="inline-block text-[11.5px] font-semibold rounded px-2 py-0.5 text-red-800 bg-red-100">
          ทำไม่ได้ — ไม่ใช่ยังไม่ได้ทำ
        </span>
        <p className="text-[13px] text-red-900 mt-2 leading-relaxed">
          <b>ZORT ไม่เปิด API กระเป๋าเงิน</b> — ยิงจริงแล้วตอบ 404 ทุกเส้น (Wallet · Payment · Receipt)
          ⇒ ข้อมูลชุดนี้ <b>เอาออกมาแสดงที่นี่ไม่ได้เลย</b> ไม่ว่าจะเขียนโค้ดยังไง
        </p>
        <p className="text-[13px] text-red-900 mt-2 leading-relaxed">
          ⚠️ <b>ต้องกด Export Excel ด้วยมือก่อนวันปิดบัญชี ZORT</b> — กดหลังปิดไม่ได้อีก
          เพราะเข้าหน้าจอนั้นไม่ได้แล้ว · ดูรายการที่ต้องกดทั้งหมดใน{' '}
          <Link href="/core/arch" className="underline">หน้าสถาปัตยกรรม</Link>
        </p>
      </div>

      {/* ⚠️ เลขที่คัดมาด้วยตาต้องบอกอายุตัวเอง และประกาศวันหมดอายุของตัวเอง */}
      <p className={`text-[12.5px] rounded-md px-3.5 py-2.5 mb-3 leading-relaxed ${
        stale
          ? 'text-amber-900 bg-amber-50 border border-amber-200'
          : 'text-gray-600 bg-gray-50 border border-gray-200'
      }`}>
        ที่เห็นบนจอ ZORT เมื่อ <b>3 ก.ย. 2569</b>{age !== null && ` (${age.toLocaleString('th-TH')} วันที่แล้ว)`}:
        {' '}<b>{SEEN.rows} รายการ</b> · ยอดคงเหลือรวม <b>{SEEN.total} บาท</b>
        {stale
          ? <> — <b>เกิน {STALE_DAYS} วันแล้ว อย่าเพิ่งเชื่อตัวเลขนี้</b> ต้องเปิดจอ ZORT ดูใหม่</>
          : <span className="text-gray-400"> · เป็นภาพนิ่งจากวันนั้น ไม่ได้อัปเดตเอง</span>}
      </p>

      {/* 🔴 **ตารางเปล่าถูกถอดออกแล้ว — เจ้าของร้านฝั่งท่อเลือกเอง 5 ก.ย. 2569** ให้เหตุผล 3 ข้อ
          ① ตารางเปล่าที่มีหัวคอลัมน์จริง **หน้าตาเหมือนจอที่โหลดไม่ขึ้น** คนจะแจ้งว่าจอพัง
             (เขาเพิ่งเจอกับตัว — ถ่ายจอตอนโหลดไม่เสร็จ แล้วเกือบส่งมาเป็นหลักฐาน)
          ② หัวคอลัมน์ = คำสัญญาว่าเรารู้แล้วว่าข้อมูลหน้าตายังไง **แต่เราไม่รู้** เพราะ API 404
             คอลัมน์พวกนั้นเดามาจากภาพหน้าจอ ⇒ เท่ากับแต่งสัญญาขึ้นมาเอง
          ③ ของมีค่าที่สุดในจอนี้คือ "ทำไมถึงทำไม่ได้ + ต้อง Export ก่อนปิดบัญชี"
             มีตารางมาคั่น = คำเตือนถูกดันลงล่าง ผิดกฎ warning-placement
          ⇒ เก็บผังไว้แบบพับ ให้คนทำต่อในอนาคตเปิดดูได้ แต่ไม่เห็นตอนเปิดหน้า */}
      <details className="bg-white border border-gray-200 rounded-md">
        <summary className="text-[13px] text-gray-600 px-4 py-3 cursor-pointer select-none">
          ผังที่ตั้งใจไว้ (ยังทำไม่ได้) — ลำดับคอลัมน์ที่ลอกมาจากจอ ZORT
        </summary>
        <div className="px-4 pb-4">
          <p className="text-[12px] text-gray-500 mb-2 leading-relaxed">
            คัดจากภาพจอจริงเมื่อ 3 ก.ย. 2569 · <b>เป็นการอ่านจากภาพ ไม่ใช่จาก API</b>
            {' '}⇒ ถือเป็นบันทึกไว้ให้คนทำต่อ ไม่ใช่ข้อตกลงเรื่องรูปแบบข้อมูล
          </p>
          <ol className="text-[12.5px] text-gray-700 list-decimal pl-5 space-y-0.5">
            {COLS.filter((c) => c.label !== '#').map((c) => <li key={c.label}>{c.label}</li>)}
          </ol>
        </div>
      </details>
    </div>
  )
}
