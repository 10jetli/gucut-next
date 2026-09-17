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

/** ทำข้อความไทยให้ "หลวม" ก่อนเทียบป้าย — แก้ปัญหาที่ PDF แกะข้อความไทยออกมาไม่ตรงรูป
 *  🔴 เจอของจริง 16 ก.ย. 2569 (ใบ LINE กับใบเสร็จ Meta):
 *     · `ำ` ถูกแกะออกมาเป็น `ํา` (นิคหิต + สระอา) ⇒ `จำนวนเงิน` กลายเป็น `จํานวนเงิน` ⇒ regex ไม่ match
 *     · วรรณยุกต์หายทั้งใบ ⇒ `ข้อมูล` กลายเป็น `ขอมูล`
 *  ⇒ ถ้าไม่ทำให้หลวม ป้ายภาษาไทยทุกป้ายจะ "ไม่เจอ" แบบเงียบ ๆ ทั้งที่อยู่ในเอกสารตรง ๆ
 *  ⚠️ ใช้กับ **การหาป้ายเท่านั้น** ห้ามเอาข้อความที่ผ่านตัวนี้ไปเก็บหรือไปโชว์ (มันทำให้คำเพี้ยน) */
export function thaiLoose(s: string): string {
  return String(s ?? '')
    .replace(/\u0E4D\u0E32/g, '\u0E33')      // ํ + า → ำ
    .replace(/[\u0E47-\u0E4E]/g, '')         // ตัดวรรณยุกต์/ไม้ไต่คู้/ทัณฑฆาต
}
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
  /* 2026.07.31 หรือ 2026-07-31 — ปีขึ้นต้น = ไม่กำกวม (เจอในใบ LINE: `Payment date:2026.07.31`) */
  m = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${fixYear(+m[1])}-${pad(+m[2])}`
  /* 31/07/2026 — **กำกวม** ระหว่าง วัน/เดือน กับ เดือน/วัน
     ⇒ รับเฉพาะตอนที่ตัวเลขตัวใดตัวหนึ่ง > 12 (ตัวนั้นต้องเป็นวันแน่นอน)
     🔴 ถ้าทั้งคู่ ≤ 12 **คืน null ไม่เดา** — เดาผิดหนึ่งครั้งคือบิลไปอยู่ผิดเดือนแบบเงียบ ๆ
        (บทเรียนวันนี้: การจัดเดือนผิดคือสิ่งที่ท่านประธานจับได้เอง) */
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (m) {
    const a = +m[1], b = +m[2], y = fixYear(+m[3])
    if (a > 12 && b >= 1 && b <= 12) return `${y}-${pad(b)}`        // วัน/เดือน/ปี
    if (b > 12 && a >= 1 && a <= 12) return `${y}-${pad(a)}`        // เดือน/วัน/ปี
  }
  /* 16-SEP-2026 — รูปแบบของ Adobe (เจอจาก PDF จริง 16 ก.ย. 2569)
     ⚠️ ไม่มีรูปแบบนี้มาก่อน ⇒ บิล Adobe ทุกใบ "อ่านวันที่ไม่ออก" เงียบ ๆ ตั้งแต่ต้น */
  m = text.match(/(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-(\d{4})/i)
  if (m) return `${fixYear(+m[3])}-${pad(EN.indexOf(m[2].toLowerCase()) + 1)}`
  return null
}

/** ป้ายที่ผู้ให้บริการใช้เรียก "รอบบิล" — เก็บรวมไว้ที่เดียว เพิ่มเจ้าใหม่เติมที่นี่
 *  ⚠️ ห้ามใส่คำว่า "วันที่" เปล่า ๆ หรือ "Date" ลงในรายการนี้ — นั่นคือวันที่ออกใบ ไม่ใช่รอบบิล */
const PERIOD_LABELS = [
  'billing\\s*period', 'service\\s*period', 'subscription\\s*period', 'usage\\s*period',
  'period\\s*of\\s*service', 'billing\\s*cycle', 'for\\s*the\\s*period',
  /* 🔬 เจอจาก PDF จริงของ Adobe (16 ก.ย. 2569): เขียนว่า `Service Term: 16-SEP-2026 to 15-OCT-2026`
     ⇒ ไม่มีคำว่า period หรือ billing เลย ⇒ ตัวอ่านรุ่นแรกมองไม่เห็นรอบบิลของ Adobe ทั้งหมด */
  'service\\s*term', 'subscription\\s*term', 'term\\s*of\\s*service',
  'รอบบิล', 'รอบการใช้งาน', 'รอบใบแจ้งหนี้', 'ระยะเวลาการใช้งาน', 'ระยะเวลาให้บริการ', 'ประจำรอบ',
]

/** เดือนของ **รอบบิล** ที่พิมพ์อยู่ในเอกสาร (ไม่ใช่วันที่ออกใบ)
 *  คืน null ถ้าเอกสารไม่ได้เขียนรอบบิลไว้ — **ห้ามเดา** คนเรียกต้องรู้ว่าไม่รู้ */
export function billPeriodFromText(text: string): { month: string; label: string } | null {
  const t = thaiLoose(text)
  for (const label of PERIOD_LABELS) {
    /* ⚠️ ป้ายต้องผ่าน thaiLoose ด้วย — ไม่งั้นป้ายที่มีวรรณยุกต์ (เช่น "ชำระแล้ว") จะไม่ตรงกับ
       ข้อความที่เพิ่งถูกตัดวรรณยุกต์ออก (เจอตอนเทสแดงขึ้นทันที 16 ก.ย. 2569) */
    const re = new RegExp(`(${thaiLoose(label)})\\s*[:：]?\\s*([^\\n]{0,80})`, 'i')
    const m = t.match(re)
    if (!m) continue
    const month = monthFromText(m[2])
    if (month) return { month, label: m[1].trim() }
  }
  return null
}

/** ป้ายของ "เลขที่เอกสาร" ที่ใช้เป็นตัวตนของใบ — เลขนี้ต่างใบต่างเลข */
const NO_LABELS = [
  'invoice\\s*(?:no\\.?|number|id|#)', 'document\\s*(?:no\\.?|number|id)', 'receipt\\s*(?:no\\.?|number|id)',
  'credit\\s*memo\\s*(?:no\\.?|number)', 'bill\\s*(?:no\\.?|number)', 'statement\\s*(?:no\\.?|number)',
  'transaction\\s*(?:no\\.?|number|id)', 'reference\\s*(?:no\\.?|number)',
  'เลขที่ใบแจ้งหนี้', 'เลขที่ใบเสร็จ', 'เลขที่เอกสาร', 'หมายเลขใบแจ้งหนี้', 'เลขที่ใบกำกับภาษี',
  /* 🔬 เจอจากใบเสร็จ Meta ภาษาไทยของจริง (16 ก.ย. 2569): ใบไม่มีคำว่า "เลขที่ใบแจ้งหนี้" เลย
     มีแต่ `หมายเลขอ้างอิง: …` กับ `ID ธุรกรรม` ⇒ ตัวอ่านรุ่นแรกจึงตัดสินตัวตนของใบ Meta ไม่ได้เลย */
  'หมายเลขอ้างอิง', 'เลขที่อ้างอิง', 'ID\\s*ธุรกรรม', 'หมายเลขธุรกรรม',
]

/** เลขที่เอกสารตามที่พิมพ์ในบิล — คืน null ถ้าไม่เจอ (ห้ามสร้างเลขเอง)
 *  ⚠️ กันจับวันที่มาเป็นเลขที่ใบ: ต้องมีตัวอักษรหรือยาวพอ และไม่ใช่รูปแบบวันที่ */
export function invoiceNoFromText(text: string): string | null {
  /* 🔬 ของจริง Anthropic (18 ก.ย. 2569): ขีดในเลขที่ใบถูกแกะออกมาเป็นอักขระ NUL — `ZEBE#ZQP\u0000####`
     ⇒ ตัวอ่านหยุดที่ NUL ได้แค่ส่วนหน้าที่ทุกใบใช้ร่วมกัน ⇒ ทุกใบของเจ้านั้นได้กุญแจเดียวกัน (ใบซ้ำปลอม)
     ⇒ NUL ที่อยู่ระหว่างตัวอักษร/ตัวเลข ให้ถือเป็นขีด */
  const t = thaiLoose(text).replace(/([A-Za-z0-9])\u0000(?=[A-Za-z0-9])/g, '$1-')
  const ดูเหมือนวันที่ = (raw: string) =>
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(raw)                        // 11/06/2026
    || /^\d{4}-\d{2}-\d{2}$/.test(raw)                                  // 2026-06-11
    || /^\d{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(raw) // 16-SEP-2026
  /* 🔴 **ค่าต้องมีตัวเลขอย่างน้อยหนึ่งตัว** (แก้ 18 ก.ย. 2569 · ของจริง Cloudflare)
     ใบ Cloudflare 3 ใบคนละเลข ได้เลขที่ใบเป็นคำว่า `INVOICE` ทั้งหมด ⇒ กุญแจเดียวกัน ⇒ ถูกนับเป็น "ใบซ้ำ"
     (ป้าย `Invoice #` ตามด้วยคำ `INVOICE` · หรือ `INVOICEInvoice Number` ที่ ⓑ หยิบคำหน้าป้าย)
     ⇒ ลองทุกตำแหน่งที่ป้ายปรากฏ ไม่ใช่ตำแหน่งแรก และข้ามค่าที่ไม่มีตัวเลข */
  const ใช้ได้ = (raw: string) => !!raw && /\d/.test(raw) && !ดูเหมือนวันที่(raw)
  /* 🔴 **เลขที่ "อ้างถึง" เอกสารอื่น ไม่ใช่ตัวตนของใบนี้** (18 ก.ย. 2569 · ของจริง Lazada)
     เอกสาร Lazada ชนิดหนึ่งพิมพ์ `Refer to Tax Invoice Number THMPTI…` ⇒ ตัวอ่านหยิบเลขใบกำกับที่อ้างถึง
     ⇒ เอกสารคนละใบ (เลขในชื่อไฟล์คนละเลข) ได้กุญแจเดียวกับใบกำกับ ⇒ ถูกนับเป็นซ้ำ 4 กลุ่ม
     ⇒ ป้ายที่มีคำ refer/อ้างอิงถึง นำหน้าในระยะสั้น ๆ ให้ข้าม */
  const เป็นการอ้างถึง = (index: number) => /(refer(?:ence)?\s*to|อ้างอิงถึง|อ้างถึง)[^\n]{0,15}$/i.test(t.slice(Math.max(0, index - 30), index))
  /* 🔴 **ใบเสร็จต้องใช้เลขที่ใบเสร็จเป็นตัวตน ไม่ใช่เลขใบแจ้งหนี้ที่พิมพ์อ้างอิงไว้** (18 ก.ย. 2569)
     ใบเสร็จ Anthropic พิมพ์ทั้ง `Invoice number` (เท่ากับใบแจ้งหนี้คู่กัน) และ `Receipt number`
     ⇒ ถ้าใช้ป้ายตามลำดับเดิม ใบแจ้งหนี้กับใบเสร็จของรอบเดียวกันได้กุญแจเดียวกัน = ถูกนับเป็นใบซ้ำ ทั้งที่คนละเอกสาร */
  const labels = /receipt\s*(?:no\.?|number|id)|เลขที่ใบเสร็จ/i.test(t)
    ? [...NO_LABELS.filter((l) => /receipt|ใบเสร็จ/i.test(l)), ...NO_LABELS.filter((l) => !/receipt|ใบเสร็จ/i.test(l))]
    : NO_LABELS
  for (const label of labels) {
    const lab = thaiLoose(label)
    // ⓐ ป้ายอยู่หน้า ค่าอยู่หลัง (รูปแบบปกติ)
    for (const m of Array.from(t.matchAll(new RegExp(`${lab}\\s*[:：#]?\\s*([A-Za-z0-9][A-Za-z0-9\\-/_]{3,30})`, 'gi')))) {
      if (เป็นการอ้างถึง(m.index ?? 0)) continue
      const raw = m[1].replace(/[.,;]+$/, '')
      if (ใช้ได้(raw)) return raw.toUpperCase()
    }
    /* ⓑ **ค่าอยู่หน้า ป้ายอยู่หลัง** — เจอของจริงในใบ Adobe (16 ก.ย. 2569)
       ข้อความที่แกะจาก PDF ออกมาเป็น `1234567890Invoice Number` (คอลัมน์ขวาถูกอ่านก่อนหัวข้อ)
       ⇒ ถ้าไม่รองรับรูปนี้ จะไปหยิบค่าของป้ายอื่นมาผิดใบ (ตัวรุ่นแรกได้เลขจาก Invoice Date มา) */
    for (const m2 of Array.from(t.matchAll(new RegExp(`([A-Za-z0-9][A-Za-z0-9\\-/_]{3,30})\\s*${lab}`, 'gi')))) {
      const raw = m2[1].replace(/[.,;]+$/, '')
      if (ใช้ได้(raw)) return raw.toUpperCase()
    }
  }
  return null
}

/** ยอดรวมของใบ — ใช้เป็นตัวช่วยยืนยันตัวตนเมื่อไม่มีเลขที่ใบ */
export function totalFromText(text: string): number | null {
  const t = thaiLoose(text)
  const labels = ['grand\\s*total', 'invoice\\s*total', 'total\\s*due', 'amount\\s*due', 'total\\s*amount',
    'net\\s*amount', 'total',
    /* 🔬 เจอในใบ LINE ของจริง (16 ก.ย. 2569): เขียนว่า `จำนวนเงิน฿1,605.0` ติดกันไม่มีช่องว่าง */
    'จำนวนเงิน', 'ยอดชำระ', 'ราคารวม',
    'ยอดรวมทั้งสิ้น', 'รวมทั้งสิ้น', 'ยอดที่ต้องชำระ', 'ยอดรวม', 'ชำระแล้ว']
  /* 🔴 **ต้องมีคอมมาหรือจุดทศนิยม** (เจอของจริง 16 ก.ย. 2569)
     ใบ Adobe ทำให้ตัวรุ่นแรกอ่านยอดได้ `65182902` ซึ่งไม่ใช่ยอดเงิน — เป็นเลขที่ติดกันในบรรทัดเดียว
     (แถวรวมของตารางกับเลขภาษี 13 หลักอยู่ใกล้คำว่า total)
     ⇒ เลขล้วนยาว ๆ ที่ไม่มีตัวคั่น **ห้ามถือว่าเป็นเงิน** · และยอมให้ค่าอยู่บรรทัดถัดไปจากป้ายได้ */
  const เงิน = '(?:THB|บาท|฿|USD|\\$)?\\s*(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+\\.\\d{2})'
  for (const label of labels) {
    for (const re of [
      new RegExp(`${thaiLoose(label)}[^\\n]{0,30}?${เงิน}`, 'i'),        // ค่าอยู่บรรทัดเดียวกับป้าย
      new RegExp(`${thaiLoose(label)}[^\\n]{0,40}\\n\\s*${เงิน}`, 'i'), // ค่าอยู่บรรทัดถัดไป (Adobe)
    ]) {
      const m = t.match(re)
      if (!m) continue
      const n = Number(m[1].replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}
