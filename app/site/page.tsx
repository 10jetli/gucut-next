'use client'
// เครื่องมือเว็บไซต์ gucut.com — ลิสต์แถวเรียงลงมาแบบ ZORT
//
// เจ้าของร้านให้ทิศทาง (28 ส.ค. 2569): "ชอบแบบ ZORT · ชอบแบบออเดอร์เว็บที่ทำอันแรก
// เรียงลงมาเรื่อย ๆ · ขอ UI ทันสมัย" ⇒ เลิกตารางการ์ด 3 คอลัมน์
// เป็นแถวเต็มความกว้างซ้อนลงมา จัดหมวดด้วยหัวข้อคั่น — ภาษาเดียวกับหน้าออเดอร์เว็บ
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WEB_TOOLS, CATS, type WebTool } from '@/lib/web-tools'

function I({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  )
}

function ToolRow({ t }: { t: WebTool }) {
  const href = t.native ? t.path : `/site/tool/${t.slug}`
  return (
    <Link href={href}
      className="group flex items-center gap-3.5 px-4 md:px-5 py-3.5 transition-colors hover:bg-gray-50/80">
      <span className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.grad} text-white flex items-center justify-center shrink-0 shadow-[0_8px_16px_-8px_rgba(15,23,42,0.4)] ring-2 ring-white transition-transform duration-200 group-hover:scale-105`}>
        <I d={t.icon} className="w-[20px] h-[20px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-bold text-gray-900 truncate">{t.title}</span>
          {t.isNew && (
            <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wide">ใหม่</span>
          )}
          {t.native && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-600">เนื้อเดียวแล้ว</span>
          )}
        </span>
        <span className="block text-[12px] text-gray-500 mt-0.5 truncate">{t.desc}</span>
      </span>
      <span className="shrink-0 text-gray-200 transition-all duration-200 group-hover:text-blue-500 group-hover:translate-x-0.5">
        <I d="M9 6l6 6-6 6" className="w-4 h-4" />
      </span>
    </Link>
  )
}

export default function SiteToolsPage() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('ทั้งหมด')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return WEB_TOOLS.filter((t) => {
      if (cat !== 'ทั้งหมด' && t.cat !== cat) return false
      if (!needle) return true
      return t.title.toLowerCase().includes(needle) || t.desc.toLowerCase().includes(needle)
    })
  }, [cat, q])

  // จัดกลุ่มตามหมวด — คงลำดับหมวดตาม CATS
  const groups = useMemo(() => {
    const g = new Map<string, WebTool[]>()
    for (const c of CATS.slice(1)) g.set(c, [])
    for (const t of shown) g.get(t.cat)?.push(t)
    return Array.from(g.entries()).filter(([, list]) => list.length > 0)
  }, [shown])

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">เครื่องมือเว็บไซต์</h1>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
            <I d="M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4.2-4.2" className="w-4 h-4" />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเครื่องมือ…"
            className="w-[200px] md:w-[240px] rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-[13px] shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
              cat === c ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {groups.map(([catName, list]) => (
        <div key={catName}>
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{catName}</p>
          <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
            {list.map((t) => <ToolRow key={t.slug} t={t} />)}
          </div>
        </div>
      ))}

      {shown.length === 0 && (
        <p className="py-14 text-center text-[13px] text-gray-400">ไม่พบเครื่องมือที่ตรงกับ &ldquo;{q}&rdquo;</p>
      )}
    </div>
  )
}
