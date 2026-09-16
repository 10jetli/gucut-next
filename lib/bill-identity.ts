// ตัวตนของบิล 1 ใบ — ใช้กันบิลซ้ำ **โดยไม่พึ่งชื่อไฟล์**
//
// 🔴 ที่มา (16 ก.ย. 2569 · ใบ t_mu3g8tq5): ท่านประธานจับได้เองว่าบิล Adobe ถูกเก็บซ้ำ
//    ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน (+1 ใบเป็นของ มิ.ย. ที่จัดผิดเดือน)
//    ⇒ ชนกฎเหล็ก "บิลห้ามโหลดซ้ำ" โดยตรง
//
// 🔴 **ต้นเหตุ**: ตัวกันซ้ำเดิมเทียบ **ชื่อไฟล์** (`f/<vendorId>/<filename>` ใน lib/billblobs.ts)
//    ⇒ ใบเดียวกันที่มาในชื่อไฟล์ต่างกัน (Adobe ตั้งชื่อไม่คงรูป) ผ่านด่านทุกครั้ง
//    ⇒ "ไม่มีไฟล์ชื่อนี้" ไม่ได้แปลว่า "ยังไม่มีใบนี้" — สองอย่างนี้คนละคำถาม
//
// ✅ **กติกาใหม่**: ตัวตนของใบมาจากเนื้อในเอกสารเท่านั้น
//    ① เลขที่เอกสารที่พิมพ์ในใบ (แข็งที่สุด — ต่างใบต่างเลข)
//    ② ถ้าไม่มีเลข ⇒ รอบบิล + ยอดรวม (สองอย่างพร้อมกัน)
//    ③ ถ้าอ่านอะไรไม่ได้เลย ⇒ **คืน null = ตัดสินไม่ได้ ห้ามเดา** และห้ามถือว่า "ไม่ซ้ำ"
//       (คนเรียกต้องเก็บไว้ให้คนตรวจ ไม่ใช่เขียนทับหรือทิ้งเงียบ)
import { billPeriodFromText, invoiceNoFromText, monthFromText, totalFromText } from './bill-text'

export interface BillIdentity {
  /** เลขที่เอกสารตามที่พิมพ์ในใบ · null = ในใบไม่มี/อ่านไม่ออก */
  invoiceNo: string | null
  /** เดือนของ **รอบบิล** (YYYY-MM) */
  period: string | null
  /** รอบบิลมาจากไหน — ต้องโชว์ให้คนเห็นได้ว่าเชื่อได้แค่ไหน */
  periodSource: 'รอบบิลที่พิมพ์ในใบ' | 'วันที่แรกในใบ' | null
  /** ยอดรวมของใบ (ถ้าอ่านได้) */
  total: number | null
  /** กุญแจกันซ้ำ · null = ตัดสินไม่ได้ */
  key: string | null
  /** เหตุผลที่ตัดสินไม่ได้ — เอาไปโชว์ตรง ๆ ได้ */
  why: string | null
}

export function billIdentity(text: string, vendorId: string): BillIdentity {
  const clean = String(text ?? '')
  const invoiceNo = invoiceNoFromText(clean)
  const p = billPeriodFromText(clean)
  const period = p?.month ?? monthFromText(clean)
  const periodSource: BillIdentity['periodSource'] = p ? 'รอบบิลที่พิมพ์ในใบ' : (period ? 'วันที่แรกในใบ' : null)
  const total = totalFromText(clean)
  const v = String(vendorId || '').trim() || 'ไม่ระบุเจ้า'

  if (invoiceNo) return { invoiceNo, period, periodSource, total, key: `${v}|inv:${invoiceNo}`, why: null }
  if (period && total !== null) {
    return { invoiceNo, period, periodSource, total, key: `${v}|p:${period}|amt:${total}`, why: null }
  }
  return {
    invoiceNo, period, periodSource, total, key: null,
    why: !clean.trim()
      ? 'อ่านเนื้อในไฟล์ไม่ได้ (ไฟล์อาจเป็นรูปสแกน) ⇒ ตัดสินไม่ได้ว่าซ้ำหรือไม่'
      : !period
        ? 'ในใบไม่มีทั้งเลขที่เอกสารและวันที่ที่อ่านได้ ⇒ ตัดสินไม่ได้ว่าซ้ำหรือไม่'
        : 'ในใบไม่มีเลขที่เอกสาร และอ่านยอดรวมไม่ได้ ⇒ ตัดสินไม่ได้ว่าซ้ำหรือไม่',
  }
}

/** เดือนที่ควรใช้ "จัดแฟ้ม" — รอบบิลชนะวันที่ออกใบเสมอ
 *  🔴 นี่คือจุดที่ทำให้บิล Adobe ของ มิ.ย. ไปโผล่ในแฟ้ม ก.ค. (ใบออกต้นเดือนถัดไป) */
export function billFilingMonth(text: string): { month: string | null; source: BillIdentity['periodSource'] } {
  const p = billPeriodFromText(String(text ?? ''))
  if (p) return { month: p.month, source: 'รอบบิลที่พิมพ์ในใบ' }
  const m = monthFromText(String(text ?? ''))
  return { month: m, source: m ? 'วันที่แรกในใบ' : null }
}
