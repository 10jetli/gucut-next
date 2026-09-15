import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, fetchAttachment, fetchMessageDetail, extractAmounts } from '@/lib/gmail'
import { emailToPdf } from '@/lib/emailPdf'
import { downloadBlobFile } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills/file?messageId=...&attachmentId=...&name=... -> download tairil file
// attachmentId=GEN means no real attachment exists (HTML-only receipt email) -> convert email body to PDF
// attachmentId=DRIVE:<fileId> means a real uploaded bill stored in Google Drive -> stream it
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get('messageId')
  const attachmentId = req.nextUrl.searchParams.get('attachmentId')
  const name = req.nextUrl.searchParams.get('name') || 'file'
  if (!attachmentId || (!messageId && !attachmentId.startsWith('BLOB:'))) {
    return NextResponse.json({ error: 'ต้องระบุ messageId และ attachmentId' }, { status: 400 })
  }
  try {
    const token = await getAccessToken()

    if (attachmentId.startsWith('BLOB:')) {
      const buf = await downloadBlobFile(attachmentId.slice('BLOB:'.length))
      if (!buf) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })
      const pdfName = name.endsWith('.pdf') ? name : name + '.pdf'
      return new NextResponse(buf as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(pdfName)}`,
        },
      })
    }

    if (attachmentId === 'GEN') {
      const detail = await fetchMessageDetail(token, messageId!)
      /* 🔴 15 ก.ย. 2569 — เดิมส่ง amounts: [] ทิ้งไว้เฉย ๆ ทั้งที่ยอดเงินอยู่ในเนื้อเมล
         ผลคือใบที่ระบบสร้างมีแค่ "หัวข้อ / จาก / วันที่" **ไม่มีเลขที่ใบ ไม่มียอด**
         ⇒ เอาไปยื่นภาษีไม่ได้ (ท่านประธานเปิดดูแล้วทักว่า "บิลไม่สมบูรณ์")
         ⚠️ นี่เป็นทางสำรองเท่านั้น — เอกสารตัวจริงต้องมาจากผู้ให้บริการ
            Cloudflare เปิดให้แนบ PDF มากับเมลได้ (ตั้งค่า "email invoices") ควรเปิดอันนั้นแทน */
      const buf = await emailToPdf({
        vendorName: 'ใบเสร็จจากอีเมล',
        subject: detail.subject,
        from: detail.from,
        date: detail.date,
        amounts: extractAmounts(`${detail.subject} ${detail.text ?? ''}`),
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

    const buf = await fetchAttachment(token, messageId!, attachmentId)
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
