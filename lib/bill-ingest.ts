/* ตัวตนของไฟล์บิลที่ "อัปเข้ามาเป็นไฟล์" (ตัวเก็บสคริปต์ของแต่ละเจ้า)
 *
 * 🔴 ที่มา 18 ก.ย. 2569 (ใบ t_mu3g8tq5): เส้น `/api/bills/upload` กันซ้ำด้วย **ชื่อไฟล์** อย่างเดียว
 *    ⇒ บิลจากสคริปต์ไม่เคยผ่านตัวกันซ้ำด้วยตัวตน ⇒ คู่ "สำเนาอีเมล + สำเนาสคริปต์" (TikTok 92 · Apple 9 ไฟล์)
 * 🔑 แยกมาเป็นฟังก์ชันของตัวเอง **เพื่อให้ทดสอบกับ PDF จริงได้** — ด่านที่อ่านแค่ซอร์ส
 *    พิสูจน์ไม่ได้ว่าโค้ดยัง "ทำงาน" อยู่ (ลองปิดสาขาด้วย `if (false &&` แล้วด่านซอร์สยังเขียว) */
import { billIdentity } from './bill-identity'
import { pdfBillInfo } from './billdate'

export interface ตัวตนไฟล์อัป {
  key: string | null
  /** null = อ่านได้ · มีข้อความ = อ่านไม่ได้เพราะอะไร (ผู้เรียกต้องถอยไปกันด้วยชื่อไฟล์ ห้ามทิ้งไฟล์) */
  why: string | null
}

export async function ตัวตนของไฟล์อัป(buf: Buffer, vendorId: string): Promise<ตัวตนไฟล์อัป> {
  try {
    const { text } = await pdfBillInfo(buf)
    const ident = billIdentity(text, vendorId)
    return { key: ident.key ?? null, why: ident.key ? null : (ident.why ?? 'อ่านตัวตนของใบไม่ได้') }
  } catch (e) {
    return { key: null, why: `อ่านเนื้อ PDF ไม่ได้: ${String((e as Error)?.message ?? e).slice(0, 120)}` }
  }
}
