'use client'
/* ☑️ ช่องติ๊กของแถวแบบ ZORT — ตัวร่วมของจอรายการ (ผู้ติดต่อ · ใบเสนอราคา · ใบโอน)
 *    🔴 ช่องติ๊กต้องมาคู่กับคำสั่งที่ทำได้จริงใน BulkBar เสมอ — ติ๊กแล้วไม่มีอะไรให้ทำ = ปุ่มหลอก
 *    เลือกได้เฉพาะแถวในหน้านี้ (ZORT ก็เลือกได้แค่หน้าที่เห็น) · ข้อมูลเปลี่ยน (`resetOn`) ⇒ ล้างที่เลือก
 *    ไม่งั้นนับแถวที่มองไม่เห็นแล้ว */
import { useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'

export function useRowPick<T>(rows: T[], key: (r: T) => string, resetOn: unknown) {
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => { setPicked([]) }, [resetOn])
  const ที่เลือก = rows.filter((r) => picked.includes(key(r)))
  return {
    ที่เลือก,
    เลือกอยู่: (r: T) => picked.includes(key(r)),
    สลับ: (r: T, v: boolean) => setPicked((old) => (v ? [...old, key(r)] : old.filter((x) => x !== key(r)))),
    ทั้งหน้า: (v: boolean) => setPicked(v ? rows.map(key) : []),
    ติ๊กทั้งหน้า: rows.length > 0 && ที่เลือก.length === rows.length,
    ติ๊กบางส่วน: ที่เลือก.length > 0 && ที่เลือก.length < rows.length,
    ล้าง: () => setPicked([]),
  }
}

/** คัดลอกค่าลงคลิปบอร์ด (หนึ่งค่าต่อบรรทัด) พร้อมข้อความบอกผล 6 วินาที — คลิปบอร์ดถูกปิดต้องบอก ไม่เงียบ */
export function useCopyList() {
  const [msg, setMsg] = useState('')
  const copy = async (ค่า: string[], หน่วย: string) => {
    const ไม่ซ้ำ = ค่า.filter((x, i) => ค่า.indexOf(x) === i)
    try {
      await navigator.clipboard.writeText(ไม่ซ้ำ.join('\n'))
      setMsg(`คัดลอกแล้ว ${fmtNum(ไม่ซ้ำ.length)} ${หน่วย}`)
    } catch {
      setMsg('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เขียนคลิปบอร์ด (ลองเลือกข้อความแล้วคัดลอกเอง)')
    }
    setTimeout(() => setMsg(''), 6000)
  }
  return { msg, copy }
}

/** ปุ่มคัดลอกในแถบคำสั่ง — ไม่มีค่าเลย ⇒ ปิดพร้อมเหตุ (ไม่ใช่กดแล้วได้คลิปบอร์ดว่าง) */
export function CopyBtn({ label, values, onCopy, emptyWhy }: {
  label: string; values: string[]; onCopy: (v: string[]) => void; emptyWhy: string
}) {
  return (
    <button type="button" disabled={values.length === 0} onClick={() => onCopy(values)}
      title={values.length === 0 ? emptyWhy : undefined}
      className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50 disabled:opacity-50">
      {label} ({fmtNum(values.length)})
    </button>
  )
}
