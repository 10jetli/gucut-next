import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, fetchAttachment } from '@/lib/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/file?messageId=...&attachmentId=...&name=... → ดาวน์โหลดไฟล์แนบทีละใบ
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get('messageId')
  const attachmentId = req.nextUrl.searchParams.get('attachmentId')
  const name = req.nextUrl.searchParams.get('name') || 'file'
  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: 'ต้องระบุ messageId และ attachmentId' }, { status: 400 })
  }
  try {
    const token = await getAccessToken()
    const buf = await fetchAttachment(token, messageId, attachmentId)
    const ext = name.split('.').pop()?.toLowerCase()
    const type =
      ext === 'pdf' ? 'application/pdf' :
      ext === 'csv' ? 'text/csv' :
      ext === 'zip' ? 'application/zip' : 'application/octet-stream'
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
