import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { emailToPdf } from '@/lib/emailPdf'
import { syncBillToBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const pad = (n: number) => String(n).padStart(2, '0')
const isBillFile = (name: string) => /\.pdf$/i.test(name) || /\.zip$/i.test(name)
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_')

async function syncVendor(vendor: (typeof VENDORS)[number]) {
  const token = await getAccessToken()
  const now = new Date()
  const after = `${now.getFullYear() - 1}/${pad(now.getMonth() + 1)}/01`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const before = `${tomorrow.getFullYear()}/${pad(tomorrow.getMonth() + 1)}/${pad(tomorrow.getDate())}`
  const bills = await searchVendorBills(token, vendor, after, before)

  let uploaded = 0, skipped = 0, failed = 0
  const errors: string[] = []

  for (const b of bills) {
    const emailMonth = b.date.slice(0, 7)
    const billFiles = b.attachments.filter(a => isBillFile(a.filename))

    if (billFiles.length) {
      for (const att of billFiles) {
        try {
          const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
          if (vendor.accountId && /\.pdf$/i.test(att.filename)) {
            const { text } = await pdfBillInfo(buf)
            if (!pdfHasAccountId(text, vendor.accountId)) { skipped++; continue }
          }
          const mimeType = /\.zip$/i.test(att.filename) ? 'application/zip' : 'application/pdf'
          const filename = `${emailMonth}_${b.messageId}_${safeName(att.filename)}`
          const didUpload = await syncBillToBlobs(vendor.id, filename, mimeType, buf)
          didUpload ? uploaded++ : skipped++
        } catch (e: any) {
          failed++
          errors.push(`${b.messageId}: ${e.message ?? e}`)
        }
      }
    } else {
      try {
        const detail = await fetchMessageDetail(token, b.messageId)
        const buf = await emailToPdf({
          vendorName: vendor.name, subject: detail.subject, from: detail.from,
          date: detail.date, amounts: [], body: detail.text, html: detail.html,
        })
        const filename = `${emailMonth}_${b.messageId}_ใบเสร็จ.pdf`
        const didUpload = await syncBillToBlobs(vendor.id, filename, 'application/pdf', buf)
        didUpload ? uploaded++ : skipped++
      } catch (e: any) {
        failed++
        errors.push(`${b.messageId}: ${e.message ?? e}`)
      }
    }
  }

  return { vendor: vendor.id, name: vendor.name, total: bills.length, uploaded, skipped, failed, errors: errors.slice(0, 5) }
}

async function handle(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendor')
  const key = req.nextUrl.searchParams.get('secret')
  const required = process.env.DRIVESYNC_SECRET
  if (required && key !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const vendor = VENDORS.find(v => v.id === vendorId)
  if (!vendor) return NextResponse.json({ error: 'ไม่รู้จัก vendor นี้ (ใส่ ?vendor=<id>)' }, { status: 400 })
  try {
    const result = await syncVendor(vendor)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
