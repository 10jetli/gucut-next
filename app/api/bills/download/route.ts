import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { VENDORS, getAccessToken, searchVendorBills, fetchAttachment, fetchMessageDetail, monthRange } from '@/lib/gmail'
import { pdfBillInfo, pdfHasAccountId } from '@/lib/billdate'
import { emailToPdf } from '@/lib/emailPdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)

// GET /api/bills/download?month=2026-06            -> ZIP รวมทุกเจ้า (หน้า /bills)
// GET /api/bills/download?month=2026-06&vendor=tiktok -> ZIP เฉพาะเจ้าเดียว (ปุ่มในการ์ดเดือน)
//
// 🔴 เพิ่ม vendor 15 ก.ย. 2569 — ท่านประธานสั่ง "เพิ่มปุ่มโหลดทั้งหมด"
//    TikTok เดือนหนึ่งมี 8-10 ใบ ต้องกดโหลดทีละใบ
//    ⚠️ ทำเป็น ZIP ก้อนเดียว **ห้ามให้จอยิงโหลดทีละใบรัว ๆ**
//       เบราว์เซอร์บล็อกการดาวน์โหลดอัตโนมัติหลายไฟล์ติดกัน (ยิงจริงแล้วโดนบล็อกมาแล้ว)
//       และยิงรัวยังกินโควตา Gmail ต่อนาทีจนชนเพดาน ซึ่งเป็นบั๊กที่เพิ่งแก้ไปวันเดียวกัน
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  const vendorId = req.nextUrl.searchParams.get('vendor')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'ต้องระบุ ?month=YYYY-MM' }, { status: 400 })
  }
  // ระบุเจ้าที่ไม่รู้จัก ⇒ ตีกลับ **ห้ามเงียบแล้วส่ง ZIP รวมทุกเจ้าไปแทน**
  // (คนกดขอของอย่างหนึ่ง แล้วได้อีกอย่างโดยไม่รู้ตัว = แย่กว่าขึ้น error)
  if (vendorId && !VENDORS.some(v => v.id === vendorId)) {
    return NextResponse.json({ error: `ไม่รู้จักผู้ให้บริการ: ${vendorId}` }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    const { after } = monthRange(month)
    const [y, mo] = month.split('-').map(Number)
    const end = new Date(Date.UTC(y, mo - 1 + 3, 1))
    const before = `${end.getUTCFullYear()}/${String(end.getUTCMonth() + 1).padStart(2, '0')}/01`
    const zip = new JSZip()

    const rows: string[][] = [['ผู้ให้บริการ', 'วันที่บิล', 'หัวข้ออีเมล', 'ยอดที่พบ', 'ไฟล์แนบ']]
    const missing: string[] = []

    const vendorList = vendorId ? VENDORS.filter(v => v.id === vendorId) : VENDORS
    for (const vendor of vendorList) {
      let bills
      try {
        bills = await searchVendorBills(token, vendor, after, before)
      } catch {
        missing.push(`${vendor.name} (ค้นหาไม่สำเร็จ)`)
        continue
      }
      let added = 0
      for (const b of bills) {
        const emailMonth = b.date.slice(0, 7)
        const attNames: string[] = []
        for (const att of b.attachments) {
          try {
            const buf = await fetchAttachment(token, b.messageId, att.attachmentId)
            let fileMonth: string | null = null
            if (/\.pdf$/i.test(att.filename)) {
              const { month: pm, text } = await pdfBillInfo(buf)
              if (vendor.accountId && !pdfHasAccountId(text, vendor.accountId)) continue
              fileMonth = pm
            }
            const belongs = fileMonth ? fileMonth === month : emailMonth === month
            if (!belongs) continue
            const name = `${fileMonth ?? emailMonth}_${sanitize(att.filename)}`
            zip.folder(sanitize(vendor.name))!.file(name, buf)
            attNames.push(name)
            added++
          } catch (e: any) {
            /* 🔴 **ไฟล์บิลที่ดึงไม่ได้ ห้ามหายเงียบ** — ซองนี้เอาไปให้บัญชียื่นภาษี
               บิลหายหนึ่งใบ = เอกสารภาษีขาดหนึ่งใบ และไม่มีใครรู้ว่าขาด
               (ก่อนหน้านี้ `catch` เปล่า ๆ พร้อมคอมเมนต์ว่า "ข้ามไฟล์ที่ดึงไม่ได้" — เจอ 7 ก.ย. 2569)
               ⇒ ใส่บันทึกลงซองแทน ให้คนเห็นว่ามีอะไรขาดและขาดเพราะอะไร */
            zip.folder(sanitize(vendor.name))!.file(
              `⚠️ดึงไฟล์ไม่ได้_${sanitize(att.filename || 'ไฟล์แนบ')}.txt`,
              `ดึงไฟล์แนบนี้จาก Gmail ไม่สำเร็จ\n`
              + `ผู้ให้บริการ: ${vendor.name}\nอีเมล: ${b.subject}\nวันที่: ${b.date}\n`
              + `ไฟล์: ${att.filename}\nสาเหตุ: ${String(e?.message ?? e)}\n\n`
              + `⚠️ ซองนี้จึง **ขาดบิลใบนี้** — เปิดดูฉบับเต็มใน Gmail แล้วดาวน์โหลดเอง`,
            )
            missing.push(`${vendor.name} — ไฟล์ ${att.filename} (ดึงไม่สำเร็จ)`)
          }
        }
        // อีเมลไม่มีไฟล์แนบ -> แปลงเนื้อหาอีเมลเป็น PDF จริง (เฉพาะอีเมลของเดือนนี้)
        if (!b.attachments.length && emailMonth === month) {
          try {
            const detail = await fetchMessageDetail(token, b.messageId)
            const pdfBuf = await emailToPdf({
              vendorName: vendor.name,
              subject: detail.subject,
              from: detail.from,
              date: detail.date,
              amounts: b.amounts,
              body: detail.text,
              html: detail.html,
            })
            const name = `${emailMonth}_${sanitize(b.subject || 'ใบเสร็จ')}.pdf`
            zip.folder(sanitize(vendor.name))!.file(name, pdfBuf)
            attNames.push(name)
            added++
          } catch {
            zip.folder(sanitize(vendor.name))!.file(
              `${b.date.slice(0, 10)}_${sanitize(b.subject || 'บิล')}.txt`,
              `From: ${b.from}\nSubject: ${b.subject}\nDate: ${b.date}\nยอดที่พบ: ${b.amounts.join(', ') || '-'}\n\n${b.snippet}\n(แปลงเป็น PDF ไม่สำเร็จ — เปิดดูฉบับเต็มใน Gmail)`,
            )
            attNames.push('(แปลง PDF ไม่สำเร็จ)')
            added++
          }
        }
        if (attNames.length) {
          rows.push([vendor.name, b.date.slice(0, 10), b.subject, b.amounts.join(' | '), attNames.join(' ; ')])
        }
      }
      if (!added) missing.push(vendor.name)
    }

    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    zip.file('summary.csv', csv)
    if (missing.length) {
      zip.file('ไม่พบบิล.txt', `เดือน ${month} ไม่พบบิลจาก:\n- ${missing.join('\n- ')}\n\n(บิลบางเจ้าอาจส่งเข้าอีเมลอื่น เช่น gucut@icloud.com / gucut1@gmail.com — ตั้ง forward มาที่ Gmail หลัก)`)
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          (vendorId ? `${VENDORS.find(v => v.id === vendorId)!.name} ` : 'Ads ') + month + '.zip')}`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
