import { NextRequest, NextResponse } from 'next/server'
import { สร้างซองบิล } from '@/lib/billzip'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/zip?vendor=tiktok&month=2026-09 — สำหรับหน้าเว็บ (ต้องล็อกอิน · middleware กันให้)
// ตรรกะสร้างซองอยู่ที่ lib/billzip.ts ที่เดียว ใช้ร่วมกับ /api/bills/fetchzip ของ g1
export async function GET(req: NextRequest) {
  const r = await สร้างซองบิล(
    req.nextUrl.searchParams.get('vendor'),
    req.nextUrl.searchParams.get('month'),
  )
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return new NextResponse(r.buf as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.ชื่อไฟล์!)}`,
      'X-Bills-Added': String(r.ได้),
      'X-Bills-Missing': String(r.ขาด),
    },
  })
}
