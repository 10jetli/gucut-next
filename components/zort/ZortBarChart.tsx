'use client'
/* 📊 กราฟแท่งแบบ ZORT — แกนตั้งมีเส้นตาราง · คำอธิบายสีด้านบน · ชื่อแกนนอนด้านล่าง
 * ผังจากจอ /Category/Detail ของ ZORT (ดูภาพ 19 ต.ค. 2569): แกนตั้ง 0 · 50K · 100K · 150K + เส้นจางครึ่งช่อง ·
 * แท่งกว้างราว 60% ของช่อง สี #97aefc · ชื่อเดือนใต้แท่ง · คำว่า "เดือน" เอียงใต้แกน
 *
 * 🔴 ค่า `null` = **ยังไม่รู้** — วาดแท่งลายทางเต็มความสูง ไม่ใช่แท่ง 0 (0 คือรู้แล้วว่าไม่มีขาย)
 */
import type { ReactNode } from 'react'

export interface BarPoint { label: string; value: number | null }

/** ขั้นแกนที่อ่านง่าย (1 · 2 · 2.5 · 5 × 10^n) ให้ได้ราว ๆ `n` ช่อง */
function ขั้นแกน(max: number, n = 3): number {
  const raw = max / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  for (const f of [1, 2, 2.5, 5, 10]) if (f * mag >= raw) return f * mag
  return 10 * mag
}
const ย่อเลข = (v: number) => v >= 1e6 ? `${+(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : String(v)

export default function ZortBarChart({ points, legend, xTitle = 'เดือน', สูง = 240 }: {
  points: BarPoint[]
  /** คำอธิบายสีเหนือกราฟ (เช่น ชื่อหมวด) */
  legend?: ReactNode
  xTitle?: string
  /** ความสูงพื้นที่แท่ง (px) */
  สูง?: number
}) {
  const รู้ = points.map((p) => p.value ?? 0)
  const max = Math.max(1, ...รู้)
  const ขั้น = ขั้นแกน(max)
  const ยอด = Math.ceil(max / ขั้น) * ขั้น
  const เส้น = Array.from({ length: Math.round(ยอด / ขั้น) * 2 + 1 }, (_, i) => (i * ขั้น) / 2)
  return (
    <div className="font-['Lato','Boon',sans-serif] text-[#3e3e3e]">
      {legend && (
        <p className="flex items-center gap-2 text-[14px] mb-2 pl-[70px]">
          <span className="inline-block w-[32px] h-[13px] bg-[#97aefc]" />{legend}
        </p>
      )}
      <div className="flex">
        {/* แกนตั้ง — เลขเฉพาะขั้นเต็ม · เส้นจางครึ่งขั้นไม่มีเลข (แบบ ZORT) */}
        <div className="relative w-[60px] shrink-0" style={{ height: สูง }}>
          {เส้น.filter((_, i) => i % 2 === 0).map((v) => (
            <span key={v} className="absolute right-3 text-[13px] -translate-y-1/2" style={{ top: สูง - (v / ยอด) * สูง }}>{ย่อเลข(v)}</span>
          ))}
        </div>
        <div className="relative flex-1 min-w-0" style={{ height: สูง }}>
          {เส้น.map((v, i) => (
            <span key={v} className={`absolute left-0 right-0 border-t ${i === 0 ? 'border-[#666]' : i % 2 === 0 ? 'border-[#d4d4d4]' : 'border-[#ececec]'}`}
              style={{ top: สูง - (v / ยอด) * สูง }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {points.map((p) => (
              <div key={p.label} className="flex-1 h-full flex items-end justify-center min-w-0"
                title={p.value === null ? 'ยังไม่รู้ยอด ไม่ใช่ 0' : ย่อเลข(p.value)}>
                {p.value === null
                  ? <div className="w-[62%] h-full bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#fff_4px,#fff_8px)]" />
                  : <div className="w-[62%] bg-[#97aefc]" style={{ height: `${(p.value / ยอด) * 100}%` }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex pl-[60px] mt-1">
        {points.map((p) => <span key={p.label} className="flex-1 text-center text-[14px] min-w-0 truncate">{p.label}</span>)}
      </div>
      <p className="text-center text-[13px] italic mt-1 pl-[60px]">{xTitle}</p>
    </div>
  )
}
