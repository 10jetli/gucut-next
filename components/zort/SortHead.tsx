'use client'
/* หัวคอลัมน์กดเรียงแบบ ZORT — ใช้ร่วมหลายจอรายการ (ใบซื้อ · ชุด · ผู้ติดต่อ)
 *
 * 📐 ผัง ZORT (อ่าน DOM /Buy/list 20 ต.ค. 2569): หัวที่เรียงได้เป็นลิงก์สี #337ab7 14px น้ำหนักปกติ ไม่มีไอคอน
 *    หัวที่เรียงไม่ได้ (# · ช่องติ๊ก) เป็นตัวหนังสือธรรมดา
 *
 * 🔴 **กดได้เฉพาะเมื่อท่อประกาศว่ารับการเรียง** (`supported`) — จอส่งค่ามาจาก `applied.sortDefaulted` ที่มีอยู่ในคำตอบ
 *    (คีย์ใหม่ = ลายน้ำของท่อรุ่นที่เรียงได้จริง) · ท่อรุ่นเก่าเมิน sort= ทุกค่า ⇒ ทำเป็นลิงก์ตอนนั้น = ปุ่มหลอก
 *    ⇒ ไม่รองรับ: ตัวหนังสือธรรมดา + title บอกเหตุ (ข้อความเดิมของจอ)
 * 🔑 ทิศที่กำลังใช้บอกด้วยลูกศรเล็กเฉพาะคอลัมน์ที่เลือก + aria-sort — ZORT ไม่มีไอคอนเลย แต่ถ้าเราไม่บอกทิศ
 *    คนกดแล้วไม่รู้ว่าเรียงขึ้นหรือลง (ข้อความบนจอเป็นส่วนหนึ่งของความถูกต้อง)
 */
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export type ทิศเรียง = 'asc' | 'desc'
export type สถานะเรียง = { sort: string; dir: ทิศเรียง } | null

export default function SortHead({ label, field, current, supported, onSort, fallbackTitle, firstDir = 'asc' }: {
  label: string
  /** ชื่อช่องที่ส่งไปท่อ (`sort=`) */
  field: string
  current: สถานะเรียง
  supported: boolean
  /** กดแล้วได้ค่าใหม่ — คอลัมน์เดิมสลับทิศ · คอลัมน์ใหม่เริ่มที่ firstDir */
  onSort: (next: { sort: string; dir: ทิศเรียง }) => void
  /** ข้อความเมื่อท่อยังเรียงไม่ได้ */
  fallbackTitle: string
  firstDir?: ทิศเรียง
}) {
  if (!supported) return <span title={fallbackTitle}>{label}</span>
  const active = current?.sort === field
  const dir: ทิศเรียง = active ? current!.dir : firstDir
  return (
    <button
      type="button"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      title={active ? `เรียงตาม${label} ${dir === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'} — กดอีกครั้งเพื่อกลับทิศ` : `กดเพื่อเรียงตาม${label}`}
      onClick={() => onSort({ sort: field, dir: active ? (dir === 'asc' ? 'desc' : 'asc') : firstDir })}
      className={เหมือนZORT
        ? "font-['Kanit',sans-serif] text-[14px] font-normal text-[#337ab7] hover:underline"
        : 'hover:underline'}
    >
      {label}{active && <span aria-hidden className="ml-0.5 text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}
