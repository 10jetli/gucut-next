// อ่านข้อมูลจาก "ข้อความในบิล" — โมดูลบริสุทธิ์ ไม่แตะไฟล์ ไม่มี dependency
// แยกออกมาจาก lib/billdate.ts (16 ก.ย. 2569) เพราะ billdate ต้อง import pdf-parse
// ⇒ เทสและตัวกันบิลซ้ำจะ compile ไฟล์นี้เดี่ยว ๆ ได้ ไม่ต้องลาก pdf-parse มาด้วย
// (พฤติกรรมของ monthFromText ยกมาทั้งดุ้น ไม่แก้ตรรกะ — billdate re-export ต่อให้ของเดิมใช้ได้เหมือนเดิม)

const TH_ABBR: Record<string, number> = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
}
const TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export const fixYear = (y: number) => (y > 2200 ? y - 543 : y) // พ.ศ. → ค.ศ.
const pad = (n: number) => String(n).padStart(2, '0')

/** หา "วันที่แรก" ในข้อความ → คืนเดือนแบบ YYYY-MM
 *  ⚠️ วันที่แรกในเอกสาร **ไม่ใช่รอบบิลเสมอไป** — ใบที่ออกต้นเดือนถัดไปจะได้เดือนผิด
 *     (เจอของจริง 16 ก.ย. 2569: บิล Adobe ของ มิ.ย. ถูกจัดเข้าเดือน ก.ค.)
 *     ⇒ งานจัดเดือนให้ใช้ `billPeriodFromText()` ก่อน แล้วค่อยถอยมาใช้ตัวนี้ */
export function monthFromText(text: string): string | null {
  let m = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(\d{4})/)
  if (m) return `${fixYear(+m[3])}-${pad(TH_ABBR[m[2]])}`
  m = text.match(new RegExp(`(\\d{1,2})\\s*(${TH_FULL.join('|')})\\s*(\\d{4})`))
  if (m) return `${fixYear(+m[3])}-${pad(TH_FULL.indexOf(m[2]) + 1)}`
  m = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m) return `${fixYear(+m[3])}-${pad(EN.indexOf(m[1].toLowerCase()) + 1)}`
  m = text.match(/(\d{1,2}),?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})/i)
  if (m) return `${fixYear(+m[3])}-${pad(EN.indexOf(m[2].toLowerCase()) + 1)}`
  return null
}

/** ป้ายที่ผู้ให้บริการใช้เรียก "รอบบิล" — เก็บรวมไว้ที่เดียว เพิ่มเจ้าใหม่เติมที่นี่
 *  ⚠️ ห้ามใส่คำว่า "วันที่" เปล่า ๆ หรือ "Date" ลงในรายการนี้ — นั่นคือวันที่ออกใบ ไม่ใช่รอบบิล */
const PERIOD_LABELS = [
  'billing\\s*period', 'service\\s*period', 'subscription\\s*period', 'usage\\s*period',
  'period\\s*of\\s*service', 'billing\\s*cycle', 'for\\s*the\\s*period',
  'รอบบิล', 'รอบการใช้งาน', 'รอบใบแจ้งหนี้', 'ระยะเวลาการใช้งาน', 'ระยะเวลาให้บริการ', 'ประจำรอบ',
]

/** เดือนของ **รอบบิล** ที่พิมพ์อยู่ในเอกสาร (ไม่ใช่วันที่ออกใบ)
 *  คืน null ถ้าเอกสารไม่ได้เขียนรอบบิลไว้ — **ห้ามเดา** คนเรียกต้องรู้ว่าไม่รู้ */
export function billPeriodFromText(text: string): { month: string; label: string } | null {
  for (const label of PERIOD_LABELS) {
    const re = new RegExp(`(${label})\\s*[:：]?\\s*([^\\n]{0,80})`, 'i')
    const m = text.match(re)
    if (!m) continue
    const month = monthFromText(m[2])
    if (month) return { month, label: m[1].trim() }
  }
  return null
}

/** ป้ายของ "เลขที่เอกสาร" ที่ใช้เป็นตัวตนของใบ — เลขนี้ต่างใบต่างเลข */
const NO_LABELS = [
  'invoice\\s*(?:no\\.?|number|#)', 'document\\s*(?:no\\.?|number)', 'receipt\\s*(?:no\\.?|number)',
  'credit\\s*memo\\s*(?:no\\.?|number)', 'bill\\s*(?:no\\.?|number)', 'statement\\s*(?:no\\.?|number)',
  'เลขที่ใบแจ้งหนี้', 'เลขที่ใบเสร็จ', 'เลขที่เอกสาร', 'หมายเลขใบแจ้งหนี้', 'เลขที่ใบกำกับภาษี',
]

/** เลขที่เอกสารตามที่พิมพ์ในบิล — คืน null ถ้าไม่เจอ (ห้ามสร้างเลขเอง)
 *  ⚠️ กันจับวันที่มาเป็นเลขที่ใบ: ต้องมีตัวอักษรหรือยาวพอ และไม่ใช่รูปแบบวันที่ */
export function invoiceNoFromText(text: string): string | null {
  for (const label of NO_LABELS) {
    const m = text.match(new RegExp(`${label}\\s*[:：#]?\\s*([A-Za-z0-9][A-Za-z0-9\\-/_]{3,30})`, 'i'))
    if (!m) continue
    const raw = m[1].replace(/[.,;]+$/, '')
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(raw)) continue   // 11/06/2026 = วันที่ ไม่ใช่เลขที่ใบ
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue               // 2026-06-11 = วันที่
    return raw.toUpperCase()
  }
  return null
}

/** ยอดรวมของใบ — ใช้เป็นตัวช่วยยืนยันตัวตนเมื่อไม่มีเลขที่ใบ */
export function totalFromText(text: string): number | null {
  const labels = ['total\\s*due', 'amount\\s*due', 'grand\\s*total', 'total\\s*amount', 'total',
    'ยอดรวมทั้งสิ้น', 'รวมทั้งสิ้น', 'ยอดที่ต้องชำระ', 'ยอดรวม']
  for (const label of labels) {
    const m = text.match(new RegExp(`${label}\\s*[:：]?\\s*(?:THB|บาท|฿|USD|\\$)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i'))
    if (!m) continue
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}
