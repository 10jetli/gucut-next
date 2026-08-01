import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/gmail'
import { syncBillToDrive } from '@/lib/drive'
import { BILL_VENDORS } from '@/lib/vendors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/bills/upload — รับไฟล์บิล PDF "ตัวจริง" จากงานดึงบิลอัตโนมัติรายวัน
// (เช่น ดึงจาก manager.line.biz / Adobe แล้วส่งเข้ามาตรงๆ ไม่ต้องผ่านอีเมล)
// ฟอร์ม multipart: secret (=DRIVESYNC_SECRET), vendor (line/adobe/...), month (YYYY-MM),
//                  filename (ชื่อไฟล์แสดงผล), file (ตัวไฟล์ PDF)
// เก็บลง Google Drive โฟลเดอร์บิลของเจ้านั้น ชื่อไฟล์ YYYY-MM_REAL_<filename>
// แล้วหน้า /bills/<vendor> จะแสดงไฟล์จริงนี้แทน PDF ที่สร้างจากอีเมล

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (body: any, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS })

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 150)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const secret = String(form.get('secret') ?? '')
    const required = process.env.DRIVESYNC_SECRET
    if (!required || secret !== required) return json({ error: 'Unauthorized' }, 401)

    const vendorId = String(form.get('vendor') ?? '')
    if (!BILL_VENDORS.some(v => v.id === vendorId)) {
      return json({ error: 'ไม่รู้จัก vendor นี้' }, 400)
    }

    const month = String(form.get('month') ?? '')
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'month ต้องเป็นรูปแบบ YYYY-MM' }, 400)

    const filename = safeName(String(form.get('filename') ?? 'invoice.pdf'))
    const file = form.get('file')
    if (!(file instanceof Blob)) return json({ error: 'ต้องแนบไฟล์ในฟิลด์ file' }, 400)

    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length < 1000 || buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return json({ error: 'ไฟล์ไม่ใช่ PDF ที่ถูกต้อง' }, 400)
    }

    const token = await getAccessToken()
    const driveName = `${month}_REAL_${filename.endsWith('.pdf') ? filename : filename + '.pdf'}`
    const uploaded = await syncBillToDrive(token, vendorId, driveName, 'application/pdf', buf)

    return json({ ok: true, uploaded, skipped: !uploaded, name: driveName, size: buf.length })
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500)
  }
}
