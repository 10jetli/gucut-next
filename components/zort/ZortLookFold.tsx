'use client'
/* ย่อกล่องคำอธิบายยาวในโหมดเหมือน ZORT — **ยังขึ้นบนจอ** เป็นบรรทัดสรุปบรรทัดเดียว กดแล้วกางเนื้อเดิมครบ
 *
 * 🔑 ใช้กับกล่องที่ "ห้ามถอด" (เช่นคำเตือนว่าตัวเลขนับคนละแบบกับ ZORT — กฎข้อ 4 ใน CLAUDE.md)
 *    ต่างจากการย้ายไป title: บรรทัดสรุปพูดเรื่องหลักออกมาบนจอเสมอ · เนื้อเต็มเป็น JSX เดิมทั้งก้อน ไม่ต้องเขียนซ้ำเป็นข้อความ
 * ⚠️ ปิดโหมด (NEXT_PUBLIC_ZORT_LOOK=0) = แสดงเนื้อเดิมตามปกติ ไม่มี <details> ครอบ
 */
import type { ReactNode } from 'react'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export default function ZortLookFold({ สรุป, children, tone = 'amber' }: {
  /** บรรทัดเดียวที่ต้องพูดเรื่องหลักของกล่องให้ครบ (ไม่ใช่แค่ "หมายเหตุ") */
  สรุป: ReactNode
  children: ReactNode
  tone?: 'amber' | 'gray'
}) {
  if (!เหมือนZORT) return <>{children}</>
  return (
    <details className="mb-2 text-[11.5px]">
      <summary className={`cursor-pointer select-none ${tone === 'amber' ? 'text-amber-800' : 'text-gray-500'}`}>
        {สรุป} <span className="text-gray-400">(กดเพื่ออ่าน)</span>
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  )
}
