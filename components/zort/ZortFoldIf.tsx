/* 🗂 พับเนื้อหาเดิมทั้งก้อนไว้ใต้บรรทัดสรุป **เฉพาะโหมดเหมือน ZORT** — ไม่ถอดอะไร · นอกโหมดแสดงตามเดิม
 *    ใช้กับหมายเหตุ/ตัวเลขวิธีคิดของเราที่ ZORT ไม่มีบนจอ
 *    🔴 ถ้าข้างในมีคำเตือนจริง ต้องใส่คำเตือนนั้นใน `สรุป` ด้วย (บรรทัดสรุปคือส่วนที่ยังเห็นบนจอ)
 *    ใช้ร่วม: รายงานสินค้า · คลังสินค้า/สาขา
 */
import type { ReactNode } from 'react'
import ZortLookFold from './ZortLookFold'

export default function ZortFoldIf({ พับ, สรุป, tone = 'gray', children }: {
  พับ: boolean
  สรุป: ReactNode
  tone?: 'amber' | 'gray'
  children: ReactNode
}) {
  return พับ ? <div className="mt-2"><ZortLookFold tone={tone} สรุป={สรุป}>{children}</ZortLookFold></div> : <>{children}</>
}
