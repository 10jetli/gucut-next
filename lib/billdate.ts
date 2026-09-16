// อ่าน "เดือนบนหัวบิล" จากไฟล์ PDF (รองรับวันที่ไทยย่อ/เต็ม พ.ศ./ค.ศ. และอังกฤษ)
// @ts-ignore - pdf-parse ไม่มี type definitions
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

// 🔁 ตรรกะอ่านข้อความย้ายไป `lib/bill-text.ts` แล้ว (16 ก.ย. 2569) — ไฟล์นี้เหลือหน้าที่ "แกะ PDF"
//    เหตุ: ตัวกันบิลซ้ำกับเทสต้อง compile ตรรกะข้อความเดี่ยว ๆ โดยไม่ลาก pdf-parse มาด้วย
//    ⚠️ re-export ของเดิมไว้ครบ — ของที่ import monthFromText จากไฟล์นี้ยังใช้ได้เหมือนเดิม
export { monthFromText, billPeriodFromText, invoiceNoFromText, totalFromText } from './bill-text'
import { monthFromText } from './bill-text'

// อ่าน 2 หน้าแรกของ PDF แล้วคืนทั้งข้อความและเดือนบนหัวบิล (ใช้ครั้งเดียว ไม่ parse ซ้ำ)
export async function pdfBillInfo(buf: Buffer): Promise<{ month: string | null; text: string }> {
    try {
          const data = await pdfParse(buf, { max: 2 })
                const text = String(data.text ?? '').slice(0, 4000)
                      return { month: monthFromText(text), text }
    } catch {
          return { month: null, text: '' }
    }
}

// เผื่อโค้ดที่อื่นเรียก pdfBillMonth(buf) ตรงๆ อยู่
export async function pdfBillMonth(buf: Buffer): Promise<string | null> {
    return (await pdfBillInfo(buf)).month
}

// ตรวจว่าเนื้อหา PDF มีเลขบัญชี/รหัสนี้อยู่หรือไม่ (ทนช่องว่างคั่นระหว่างตัวเลข)
export function pdfHasAccountId(text: string, accountId: string): boolean {
    if (!accountId) return true
        /* ⚠️ สร้าง RegExp จากค่าที่คนกรอก ⇒ ตัวอักษรพิเศษ (+ ( ) . *) ทำให้โยน error
           ⇒ หนีอักขระทีละตัวก่อนต่อ (ไล่ตรวจทั้งระบบ 5 ก.ย. 2569) */
        const re = new RegExp(
            accountId.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'),
        )
            return re.test(text)
}

