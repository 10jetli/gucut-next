import { NextRequest, NextResponse } from 'next/server'
import { สร้างซองบิล } from '@/lib/billzip'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/fetchzip?secret=<DRIVESYNC_SECRET>&vendor=&month=
//
// 🔑 สำหรับ **g1 เท่านั้น** — ท่านประธานสั่ง 15 ก.ย. 2569 "ต้องใช้เครื่อง g1 โหลดเท่านั้น"
//    เบราว์เซอร์ที่ Claude ควบคุมบันทึกไฟล์ลงดิสก์ไม่ได้ (ทดสอบครบทุกทางแล้ว)
//    ⇒ ให้ g1 ดึงซองด้วยรหัส แล้วส่งต่อให้ท่านทาง Telegram
//
// ⚠️ **แยกเส้นออกมาโดยตั้งใจ ห้ามเอาไปรวมกับ /api/bills/zip**
//    เส้นนั้นอยู่หลังด่านล็อกอินที่ตรวจโทเคนเซ็นชื่อ + หลายบทบาท
//    ถ้าเอามารวมแล้วใส่ใน PUBLIC_PATHS ด่านนั้นจะถูกข้าม ⇒ ซองบิลเปิดสาธารณะทันที
//    (บิลมีชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี)
// ⚠️ รหัสตัวเดียวกับ /api/bills/upload ที่เขียนไฟล์เข้าคลังได้อยู่แล้ว — ไม่ได้เปิดช่องใหม่
//    แต่เส้นนี้คืน **เนื้อไฟล์จริง** ⇒ รหัสต้องอยู่ในไฟล์สิทธิ์ 600 บน g1 เท่านั้น
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? ''
  const required = process.env.DRIVESYNC_SECRET
  if (!required || secret !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
