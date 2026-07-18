// อ่าน "เดือนบนหัวบิล" จากไฟล์ PDF (รองรับวันที่ไทยย่อ/เต็ม พ.ศ./ค.ศ. และอังกฤษ)
// @ts-ignore - pdf-parse ไม่มี type definitions
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const TH_ABBR: Record<string, number> = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
}
const TH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

const fixYear = (y: number) => (y > 2200 ? y - 543 : y) // พ.ศ. → ค.ศ.
const pad = (n: number) => String(n).padStart(2, '0')

// หา "วันที่แรก" ในข้อความ → คืนค่าเดือนแบบ YYYY-MM (หัวบิลมักมีวันที่เรียกเก็บเงินอยู่บนสุด)
export function monthFromText(text: string): string | null {
  // 11 มิ.ย. 2026 / 13 มิ.ย. 2569
  let m = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(\d{4})/)
  if (m) return `${fixYear(+m[3])}-${pad(TH_ABBR[m[2]])}`
  // 11 มิถุนายน 2569
  m = text.match(new RegExp(`(\\d{1,2})\\s*(${TH_FULL.join('|')})\\s*(\\d{4})`))
  if (m) return `${fixYear(+m[3])}-${pad(TH_FULL.indexOf(m[2]) + 1)}`
  // Jun 11, 2026
  m = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m) return `${fixYear(+m[3])}-${pad(EN.indexOf(m[1].toLowerCase()) + 1)}`
  // 11 June 2026
  m = text.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i)
  if (m) return `${fixYear(+m[3])}-${pad(EN.indexOf(m[2].toLowerCase()) + 1)}`
  return null
}

// อ่าน 2 หน้าแรกของ PDF แล้วหาเดือนบนหัวบิล
export async function pdfBillMonth(buf: Buffer): Promise<string | null> {
  try {
    const data = await pdfParse(buf, { max: 2 })
    return monthFromText(String(data.text ?? '').slice(0, 4000))
  } catch {
    return null
  }
}
