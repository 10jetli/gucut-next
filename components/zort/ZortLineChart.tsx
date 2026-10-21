/* 📈 กราฟเส้นแบบ ZORT — แกนตั้งเลขย่อ (0 · 20K · 40K …) มีเส้นตาราง · คำอธิบายเส้นด้านบน · ป้ายวันเอียง · "ช่วงเวลา" ใต้แกน
 * 📏 วัด DOM /Dashboard/SalesReport 21 ต.ค. 2569 (การ์ดกว้าง 489): svg 449×300 · พื้นที่เส้น x72–443 y59–243 (ในsvg)
 *    เลขแกน 11 #444 · ป้ายวัน 11 #222 เอียง −30° ทุก ~3 วัน (11 ป้าย / 31 วัน) · คำอธิบายเส้นที่ x101 y29 · เส้น #97adfd หนา 2 ไม่มีจุด
 * ⚠️ วาดจากเลขชุดเดียวกับกราฟเดิมของจอเท่านั้น — ไม่มีเลขใหม่ · ใช้ขั้นแกนตัวเดียวกับ ZortBarChart (ไม่คัดลอก) */
import { ขั้นแกน, ย่อเลข } from './ZortBarChart'

export interface LinePoint { label: string; value: number }

export default function ZortLineChart({ points, legend, xTitle = 'ช่วงเวลา', ป้ายกำกับ }: {
  points: LinePoint[]
  /** ชื่อเส้นเหนือกราฟ เช่น "ยอดขายรวม" */
  legend: string
  xTitle?: string
  /** aria-label ของกราฟ */
  ป้ายกำกับ: string
}) {
  const W = 449, H = 300, L = 72, R = 443, T = 59, B = 243
  const max = Math.max(1, ...points.map((p) => p.value))
  const ขั้น = ขั้นแกน(max, 4)
  const ยอด = Math.ceil(max / ขั้น) * ขั้น
  const ขีด = Array.from({ length: Math.round(ยอด / ขั้น) + 1 }, (_, i) => i * ขั้น)
  const n = points.length
  const x = (i: number) => n <= 1 ? (L + R) / 2 : L + 9 + ((R - L - 18) * i) / (n - 1)
  const y = (v: number) => B - (v / ยอด) * (B - T)
  const ทุก = Math.max(1, Math.ceil(n / 11))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-['Lato','Boon',sans-serif]" role="img" aria-label={ป้ายกำกับ}>
      <line x1={82} x2={112} y1={34} y2={34} stroke="#97adfd" strokeWidth={2} />
      <text x={116} y={38} fontSize={11} fill="#222">{legend}</text>
      {ขีด.map((v, i) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke={i === 0 ? '#333' : '#e6e6e6'} strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} fontSize={11} fill="#444" textAnchor="end">{ย่อเลข(v)}</text>
        </g>
      ))}
      <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
        fill="none" stroke="#97adfd" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => i % ทุก === 0 && (
        <text key={i} x={x(i)} y={B + 18} fontSize={11} fill="#222" textAnchor="end"
          transform={`rotate(-30 ${x(i)} ${B + 14})`}>{p.label}</text>
      ))}
      <text x={(L + R) / 2} y={H - 4} fontSize={11} fill="#222" textAnchor="middle" fontStyle="italic">{xTitle}</text>
    </svg>
  )
}
