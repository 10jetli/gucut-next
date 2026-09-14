import JSZip from 'jszip'

export type ImportKind = 'sale' | 'po' | 'product' | 'contact'
export type RowProblem = { row: number; field: string; error: string }
export type ParseResult = { rows: Record<string, unknown>[]; errors: RowProblem[] }

const aliases: Record<string, string> = {
  'เลขอ้างอิง': 'ref', ref: 'ref', reference: 'ref',
  'รหัสสินค้า': 'sku', sku: 'sku',
  'ชื่อสินค้า': 'name', name: 'name',
  'จำนวน': 'qty', qty: 'qty', quantity: 'qty',
  'ราคา': 'price', price: 'price',
  'ลูกค้า': 'customer', customer: 'customer',
  'ผู้ขาย': 'vendor', vendor: 'vendor',
  'รหัสผู้ติดต่อ': 'code', code: 'code',
  'โทรศัพท์': 'phone', phone: 'phone', email: 'email', 'อีเมล': 'email',
  'เลขผู้เสียภาษี': 'taxId', taxid: 'taxId',
  'ต้นทุน': 'cost', cost: 'cost', 'หน่วย': 'unit', unit: 'unit',
  'บาร์โค้ด': 'barcode', barcode: 'barcode', 'หมวดหมู่': 'category', category: 'category',
}
const text = (v: unknown) => String(v ?? '').trim()
const number = (v: unknown, row: number, field: string, errors: RowProblem[]) => {
  const s = text(v).replace(/,/g, '')
  if (!s) return undefined
  const n = Number(s)
  if (!Number.isFinite(n)) errors.push({ row, field, error: `${field} ต้องเป็นตัวเลข` })
  return Number.isFinite(n) ? n : undefined
}

/** CSV parser ที่รองรับ quote และ newline ใน quote โดยไม่แยกคอลัมน์ผิด */
export function parseCsv(textValue: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < textValue.length; i++) {
    const c = textValue[i]
    if (c === '"') { if (quoted && textValue[i + 1] === '"') { cell += c; i++ } else quoted = !quoted }
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && textValue[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function decodeXml(s: string) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') }
function columnNumber(ref: string) { let n = 0; for (const c of ref.replace(/\d/g, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1 }
async function parseXlsx(file: File): Promise<string[][]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string') ?? ''
  const shared = Array.from(sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) => decodeXml(Array.from(m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((x) => x[1]).join('')))
  const sheet = zip.file('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('ไม่พบชีตแรกในไฟล์ Excel')
  const xml = await sheet.async('string'); const out: string[][] = []
  for (const r of Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g))) {
    const cells: string[] = []
    for (const c of Array.from(r[1].matchAll(/<c[^>]*r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g))) {
      const i = columnNumber(c[1]); const v = /<v>([\s\S]*?)<\/v>/.exec(c[3])?.[1] ?? ''
      cells[i] = /t="s"/.test(c[2]) ? (shared[Number(v)] ?? '') : decodeXml(v)
    }
    out.push(cells)
  }
  return out
}

export function mapImportRows(kind: ImportKind, table: string[][]): ParseResult {
  const errors: RowProblem[] = []; const rows: Record<string, unknown>[] = []
  const headers = (table[0] ?? []).map((h) => aliases[text(h).toLowerCase()] ?? text(h))
  for (let index = 1; index < table.length; index++) {
    const rowNo = index + 1; const values = table[index]; const get = (k: string) => values[headers.indexOf(k)]
    if (!values.some((v) => text(v))) continue
    const suppliedRef = text(get('ref')); const sku = text(get('sku')); const name = text(get('name'))
    const stable = values.join('\u001f').split('').reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7).toString(36)
    const ref = suppliedRef || `IMPORT-${kind}-${rowNo}-${stable}`
    const qty = number(get('qty'), rowNo, 'จำนวน', errors); const price = number(get('price'), rowNo, 'ราคา', errors)
    if (kind === 'contact') {
      const code = text(get('code')); if (!code) errors.push({ row: rowNo, field: 'code', error: 'ผู้ติดต่อต้องมี code' }); if (!name) errors.push({ row: rowNo, field: 'name', error: 'ผู้ติดต่อต้องมี name' })
      if (code && name) rows.push({ ref, code, name, phone: text(get('phone')) || undefined, email: text(get('email')) || undefined, taxId: text(get('taxId')) || undefined })
    } else if (kind === 'product') {
      if (!sku) errors.push({ row: rowNo, field: 'sku', error: 'สินค้าต้องมี sku' }); if (!name) errors.push({ row: rowNo, field: 'name', error: 'สินค้าต้องมี name' })
      if (sku && name) rows.push({ ref, sku, name, price, cost: number(get('cost'), rowNo, 'ต้นทุน', errors), unit: text(get('unit')) || undefined, barcode: text(get('barcode')) || undefined, category: text(get('category')) || undefined })
    } else {
      if (!sku) errors.push({ row: rowNo, field: 'sku', error: 'ต้องมี sku' }); if (!name) errors.push({ row: rowNo, field: 'name', error: 'ต้องมี name' }); if (!qty || qty <= 0) errors.push({ row: rowNo, field: 'qty', error: 'จำนวนต้องมากกว่า 0' }); if (price === undefined || price < 0) errors.push({ row: rowNo, field: 'price', error: 'ต้องมีราคาไม่ติดลบ' })
      if (sku && name && qty && qty > 0 && price !== undefined && price >= 0) rows.push(kind === 'sale' ? { ref, customer: text(get('customer')) || undefined, items: [{ sku, name, qty, price }] } : { ref, vendor: text(get('vendor')) || undefined, items: [{ sku, name, qty, price }] })
    }
  }
  return { rows, errors }
}

/** อ่าน CSV หรือ xlsx แล้วคืน body ที่ส่งเข้า /api/core?batch= ได้โดยตรง */
export async function readImportFile(kind: ImportKind, file: File): Promise<ParseResult> {
  const table = /\.xlsx$/i.test(file.name) ? await parseXlsx(file) : parseCsv(await file.text())
  return mapImportRows(kind, table)
}
