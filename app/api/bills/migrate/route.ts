import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, VENDORS } from '@/lib/gmail'
import { listVendorDriveFiles, downloadDriveFile } from '@/lib/drive'
import { loadBillIndex } from '@/lib/billcache'
import { blobFileExists, uploadBillToBlobs, saveBillIndexBlobs, loadBillIndexBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/bills/migrate?secret=..&vendor=<id>  ย้ายไฟล์บิล+แคชของ vendor นั้นจาก Drive → Blobs
// ครั้งเดียว · Drive ไม่ถูกลบ (เป็นตาข่าย) · ข้ามไฟล์ที่ย้ายแล้ว · เรียกซ้ำได้
// ไม่ใส่ vendor = ย้ายทุกเจ้า
async function migrateVendor(token: string, vendorId: string) {
  let copied = 0, skipped = 0, failed = 0
  const errors: string[] = []
  // ไฟล์บิล
  let files: { id: string; name: string; size: number }[] = []
  try { files = await listVendorDriveFiles(token, vendorId) } catch (e: any) { errors.push('list: ' + (e?.message ?? e)) }
  for (const f of files) {
    try {
      if (await blobFileExists(vendorId, f.name)) { skipped++; continue }
      const buf = await downloadDriveFile(token, f.id)
      const mime = /\.zip$/i.test(f.name) ? 'application/zip' : 'application/pdf'
      await uploadBillToBlobs(vendorId, f.name, mime, buf)
      copied++
    } catch (e: any) { failed++; errors.push(`${f.name}: ${e?.message ?? e}`) }
  }
  // แคช index (ถ้ายังไม่มีใน Blobs)
  try {
    if (!(await loadBillIndexBlobs(vendorId))) {
      const idx = await loadBillIndex(token, vendorId)
      if (idx) await saveBillIndexBlobs(vendorId, idx)
    }
  } catch (e: any) { errors.push('cache: ' + (e?.message ?? e)) }
  return { vendor: vendorId, filesOnDrive: files.length, copied, skipped, failed, errors: errors.slice(0, 5) }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const required = process.env.DRIVESYNC_SECRET
  if (!required || secret !== required) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const token = await getAccessToken()
    const one = req.nextUrl.searchParams.get('vendor')
    const ids = one ? [one] : VENDORS.map(v => v.id)
    const results = []
    for (const id of ids) results.push(await migrateVendor(token, id))
    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
