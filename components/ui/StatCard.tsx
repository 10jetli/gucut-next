// การ์ดตัวเลขสรุป (KPI) มาตรฐานของระบบ — ไอคอนในวงกลมสี + ตัวเลขใหญ่ + label
// ใช้แทนการเขียน "bg-white rounded-xl shadow-sm ... text-2xl font-black" ซ้ำทีกหน้า dashboard/สรุปยอด
import type { ReactNode } from 'react'
import Card from './Card'

const TONE = {
  blue:   { chip: 'bg-blue-50 text-blue-600',     text: 'text-blue-600' },
  green:  { chip: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600' },
  orange: { chip: 'bg-orange-50 text-orange-600', text: 'text-orange-600' },
  red:    { chip: 'bg-red-50 text-red-600',       text: 'text-red-500' },
  purple: { chip: 'bg-purple-50 text-purple-600', text: 'text-purple-600' },
  gray:   { chip: 'bg-gray-100 text-gray-500',    text: 'text-gray-500' },
} as const

type Tone = keyof typeof TONE

export default function StatCard({
  icon,
  label,
  value,
  unit,
  note,
  noteTone = 'gray',
  tone = 'blue',
  className = '',
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  unit?: string
  note?: string
  noteTone?: Tone
  tone?: Tone
  className?: string
}) {
  return (
    <Card hover className={className}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-gray-400">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0 ${TONE[tone].chip}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
        {value} {unit && <span className="text-sm font-normal text-gray-500">{unit}</span>}
      </p>
      {note && <p className={`text-[12px] mt-1 font-medium ${TONE[noteTone].text}`}>{note}</p>}
    </Card>
  )
}
