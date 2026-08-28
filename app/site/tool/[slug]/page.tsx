'use client'
// เปิดเครื่องมือเว็บไซต์รายตัวเต็มจอ — /site/tool/<slug>
//
// เครื่องมือที่ยังไม่ได้ย้ายเป็นเนื้อเดียว เปิดหน้าเดิมของ gucut.com/admin/<path>
// ในกรอบเต็มพื้นที่ พร้อมหัวเนทีฟ (ปุ่มกลับ + ชื่อ) ให้ความรู้สึกอยู่ระบบเดียวกัน
// ⚠️ เหตุผลที่ยังเป็นกรอบอยู่ใน app/site/page.tsx (สอง Next.js ใช้ /_next/ ชนกัน)
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { WEB_TOOLS } from '@/lib/web-tools'

export default function SiteToolPage() {
  const { slug } = useParams<{ slug: string }>()
  const tool = WEB_TOOLS.find((t) => t.slug === slug && (!t.native || t.ext))
  if (!tool) {
    return (
      <div className="py-14 text-center text-sm text-gray-400">
        ไม่พบเครื่องมือนี้ · <Link href="/site" className="text-blue-600 font-semibold">กลับหน้ารวม</Link>
      </div>
    )
  }
  const src = tool.ext ? tool.path : `https://gucut.com/admin/${tool.path}/`
  // ระบบที่ฝังกรอบไม่ได้ (ทดสอบแล้วค้าง Loading) — หน้าปล่อยตัวเปิดแท็บใหม่แทน
  if (tool.newTab) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white text-2xl shadow-lg">💬</span>
        <p className="text-[16px] font-black text-gray-900">{tool.title}</p>
        <p className="text-[12.5px] text-gray-400 leading-relaxed">
          ระบบนี้ไม่ยอมทำงานในกรอบ (ทดสอบแล้วค้างที่ Loading) — เปิดเป็นแท็บใหม่แทน
          ล็อกอินครั้งแรกครั้งเดียว เบราว์เซอร์จะจำไว้ให้
        </p>
        <a href={src} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-[14px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]">
          เปิด {tool.title} ↗
        </a>
        <p><Link href="/site" className="text-[12px] text-gray-400 hover:text-blue-600">‹ กลับหน้าเครื่องมือ</Link></p>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-3 pb-3">
        <Link href="/site"
          className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 shadow-sm hover:bg-gray-50">
          ‹ เครื่องมือ
        </Link>
        <h1 className="text-[16px] font-black tracking-tight text-gray-900">{tool.title}</h1>
        <a href={src} target="_blank" rel="noreferrer"
          className="ml-auto text-[12px] font-semibold text-gray-400 hover:text-blue-600">
          เปิดหน้าเต็ม ↗
        </a>
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
        <iframe src={src} title={tool.title} className="h-full w-full border-0" allow="clipboard-write" />
      </div>
    </div>
  )
}
