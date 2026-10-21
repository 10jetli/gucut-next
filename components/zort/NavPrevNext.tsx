'use client'
/* ‹ › เลื่อนใบแบบ ZORT — มุมขวาบนจอรายละเอียด "N จาก T ‹ ›" (ภาพ /Buy/Details · /Quotation/Details 21 ต.ค. 2569)
 *  ลำดับ = ลำดับที่ท่อคืนให้จอรายการ (ลำดับตั้งต้นของจอนั้น) ⇒ เลขตรงกับ ZORT
 *  ⚠️ วาดเฉพาะเมื่อดึงมาครบทั้งชุด (total = จำนวนแถว) — ไม่ครบ = ไม่รู้ตำแหน่งจริง ⇒ ไม่วาด ดีกว่าโชว์เลขผิด
 *     (จอที่มีหลายพันใบ เช่น ใบขาย ใช้ตัวนี้ไม่ได้ — ต้องให้ท่อบอกใบก่อน/ถัดไปเอง) */
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function NavPrevNext({ ลิสต์URL, คีย์, ปัจจุบัน, ลิงก์ }: {
  /** URL ของเส้นรายการ เช่น `/api/web/core?list=purchases&limit=200` */
  ลิสต์URL: string
  /** ช่องในแถวที่ใช้ระบุใบ (ต้องตรงกับที่จอรายละเอียดรับ) */
  คีย์: 'number' | 'id'
  ปัจจุบัน: string
  ลิงก์: (k: string) => string
}) {
  const [ลิสต์, setลิสต์] = useState<string[] | null>(null)
  useEffect(() => {
    let ยกเลิก = false
    fetch(ลิสต์URL).then((r) => r.json()).then((j) => {
      const rows: Record<string, unknown>[] = Array.isArray(j?.rows) ? j.rows : []
      if (!ยกเลิก && typeof j?.total === 'number' && j.total === rows.length) setลิสต์(rows.map((r) => String(r[คีย์] ?? '')))
    }).catch(() => {})
    return () => { ยกเลิก = true }
  }, [ลิสต์URL, คีย์])
  const i = ลิสต์ ? ลิสต์.indexOf(ปัจจุบัน) : -1
  if (!ลิสต์ || i < 0) return null
  const ลูกศร = (d: string) => <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  const ปุ่ม = (k: string | undefined, ป้าย: string, d: string) => k
    ? <Link href={ลิงก์(k)} aria-label={ป้าย} title={ป้าย} className="w-7 h-7 grid place-items-center rounded hover:bg-gray-100 text-[#3e3e3e]">{ลูกศร(d)}</Link>
    : <span aria-hidden className="w-7 h-7 grid place-items-center text-[#ced4da]">{ลูกศร(d)}</span>
  return (
    <span className="flex items-center gap-1 text-[13px] text-[#868e96]">
      {(i + 1).toLocaleString('th-TH')} จาก {ลิสต์.length.toLocaleString('th-TH')}
      {ปุ่ม(ลิสต์[i - 1], 'ใบก่อนหน้า', 'M15 6l-6 6 6 6')}
      {ปุ่ม(ลิสต์[i + 1], 'ใบถัดไป', 'M9 6l6 6-6 6')}
    </span>
  )
}
