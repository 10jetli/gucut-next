import { NextRequest, NextResponse } from 'next/server'
import { downloadBlobFile, listVendorBlobFiles } from '@/lib/billblobs'
import { pdfBillInfo } from '@/lib/billdate'
import { billFilingMonth, billIdentity } from '@/lib/bill-identity'
import { BILL_VENDORS } from '@/lib/vendors'

export const dynamic = 'force-dynamic'

/* GET /api/bills/dupcheck?secret=…&vendor=<id|all>&limit=60&skip=0
 *
 * 🔴 ที่มา (16 ก.ย. 2569 · ใบ t_mu3g8tq5): ท่านประธานจับได้เองว่าบิล Adobe ถูกเก็บซ้ำ
 *    ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน (+1 ใบของ มิ.ย. ที่จัดผิดเดือน)
 *    ⇒ ตัวกันซ้ำเดิมเทียบชื่อไฟล์ ⇒ มองไม่เห็นของซ้ำที่ชื่อต่างกัน
 *
 * เส้นนี้ทำหน้าที่ **ตรวจของที่อยู่ในถังแล้ว** — เปิดอ่านข้างใน PDF ทุกใบ แล้วจัดกลุ่มตามตัวตนของใบ
 * 🔒 **อ่านอย่างเดียว ไม่ลบ ไม่ย้าย ไม่เขียนอะไรทั้งนั้น** — การลบบิลต้องให้คนตัดสินทีละใบ
 *    (บิลคือเอกสารบัญชี · ลบแล้วไม่มีถังขยะให้กู้ — กฎในหัวไฟล์ lib/billblobs.ts)
 * ⚠️ ผลลัพธ์มีเลขที่เอกสารจริง ⇒ **ห้ามแปะผลนี้ลง repo หรือ claude-shared** (repo เป็นสาธารณะ)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const required = process.env.DRIVESYNC_SECRET
  if (!required || sp.get('secret') !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const want = (sp.get('vendor') || 'all').trim()
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 60) || 60))
  const skip = Math.max(0, Number(sp.get('skip') ?? 0) || 0)
  const vendors = want === 'all' ? BILL_VENDORS.map((v) => v.id) : [want]

  const out: any[] = []
  for (const vendorId of vendors) {
    const files = await listVendorBlobFiles(vendorId).catch(() => [])
    const slice = files.slice(skip, skip + limit)
    /** กุญแจตัวตน → ไฟล์ที่ถือกุญแจนั้น */
    const byKey = new Map<string, { file: string; invoiceNo: string | null; period: string | null }[]>()
    const undecidable: { file: string; why: string }[] = []
    const misfiled: { file: string; เดือนในชื่อไฟล์: string | null; รอบบิลในใบ: string }[] = []
    let read = 0

    for (const f of slice) {
      if (!/\.pdf$/i.test(f.name)) continue          // zip อ่านเนื้อไม่ได้ ⇒ ข้าม (ไม่เดา)
      const buf = await downloadBlobFile(f.id).catch(() => null)
      if (!buf) continue
      const { text } = await pdfBillInfo(buf)
      read++
      const ident = billIdentity(text, vendorId)
      if (!ident.key) { undecidable.push({ file: f.name, why: ident.why ?? 'ไม่ทราบเหตุ' }); continue }
      const list = byKey.get(ident.key) ?? []
      list.push({ file: f.name, invoiceNo: ident.invoiceNo, period: ident.period })
      byKey.set(ident.key, list)

      /* จัดผิดเดือนไหม — เทียบเดือนที่อยู่หน้าชื่อไฟล์ กับรอบบิลที่พิมพ์ในใบ */
      const filing = billFilingMonth(text)
      const inName = (f.name.match(/^(\d{4}-\d{2})_/) || [])[1] ?? null
      if (filing.source === 'รอบบิลที่พิมพ์ในใบ' && filing.month && inName && inName !== filing.month) {
        misfiled.push({ file: f.name, เดือนในชื่อไฟล์: inName, รอบบิลในใบ: filing.month })
      }
    }

    const dup = Array.from(byKey.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ กุญแจ: key, จำนวนไฟล์: list.length, ไฟล์: list }))

    out.push({
      vendor: vendorId,
      ไฟล์ในถัง: files.length,
      อ่านรอบนี้: read,
      ช่วงที่อ่าน: `${skip + 1}–${Math.min(skip + limit, files.length)}`,
      ยังไม่ได้อ่าน: Math.max(0, files.length - (skip + limit)),
      ใบซ้ำ: dup,
      จำนวนใบซ้ำ: dup.reduce((a, g) => a + (g.จำนวนไฟล์ - 1), 0),
      จัดผิดเดือน: misfiled,
      ตัดสินไม่ได้: undecidable,
    })
  }
  return NextResponse.json({
    ok: true,
    หมายเหตุ: 'อ่านอย่างเดียว ไม่ได้ลบหรือย้ายไฟล์ · ตัวเลข "จำนวนใบซ้ำ" = ไฟล์ที่เกินมาจากใบเดียวกัน',
    คำเตือน: 'ผลนี้มีเลขที่เอกสารจริง — ห้ามแปะลง repo หรือ claude-shared',
    ผล: out,
  })
}
