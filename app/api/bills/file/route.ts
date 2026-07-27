import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { emailToPdf } from '@/lib/emailPdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/file?messageId=...&attachmentId=...&name=... -> download tairil file
// attachmentId=GEN means no real attachment exists (HTML-only receipt email) -> convert email body to PDF
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get('messageId')
  const attachmentId = req.nextUrl.searchParams.get('attachmentId')
  const name = req.nextUrl.searchParams.get('name') || 'file'
  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: 'ต้องระบุ messageId และ attachmentId' }, { status: 400 })
  }
  try {
    const token = await getAccessToken()

    if (attachmentId === 'GEN') {
      const detail = await fetchMessageDetail(token, messageId)
      const buf = await emailToPdf({
        vendorName: 'ใบเสร็จจากอีเมล',
        subject: detail.subject,
        from: detail.from,
        date: detail.date,
        amounts: [],
        body: detail.text,
        html: detail.html,
      })
      const pdfName = name.replace(/\.[^.]+$/, '') + '.pdf'
      return new NextResponse(buf as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(pdfName)}`,
        },
      })
    }

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
