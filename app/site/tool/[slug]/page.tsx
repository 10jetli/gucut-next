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
