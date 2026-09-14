import JSZip from 'jszip'

/* ตัวแปลงไฟล์ Excel/CSV → rows **ขาเข้าจากจอ** ของท่อ POST /api/core?batch=<kind> (gucut-web)
 * ต้นแบบ: codex (cdb74f4) · แก้ตามรีวิว CEO 14 ก.ย. 2569 — งานกระดาน t_mu0qjely
 *
 * ขาเข้าจากจอ (ต้องตรงคอมเมนต์หัว route ใน gucut-web/netlify/functions/core.mjs):
 *   sale    → ?addsale=1     {ref, number?, customer?, items:[{sku, name, qty, price}]}
 *   po      → ?addpo=1       {ref, vendor?, items:[{sku, name, qty, price}]}
 *   product → ?addproduct=1  {ref, sku, name, price?, cost?, unit?, barcode?, category?}
 *   contact → ?addcontact=1  {ref, code, name, phone?, email?, taxId?}
 *   quotation → ?addquotation=1 {ref, customer, items:[{sku, name, qty, price}], phone?, note?, reference?}
 *     🔴 **quotation บังคับ customer และบังคับ price ทุกบรรทัด**
 *        ไม่ส่ง price ⇒ ท่อไม่ส่ง totalprice ⇒ **ZORT สร้างใบเสนอราคา ฿0 จริง** (พิสูจน์แล้ว QT-202609001)
 *        และใบเสนอราคาลบผ่าน API ไม่ได้ ⇒ แถวที่ไม่มีราคาต้องตีกลับเป็น error ห้ามปล่อยผ่าน
 *     ⚠️ เส้นของ ZORT **ไม่มีช่องเลขที่เอกสาร** ⇒ คอลัมน์ "เลขที่ใบ" ใช้รวมบรรทัดเท่านั้น ไม่ถูกส่ง
 *        (เตือนบนจอ ไม่ทิ้งเงียบ — คนใส่มาแล้วต้องรู้ว่ามันไม่ไปถึง ZORT)
 * ⚠️ ห้ามคิดยอดเงินในตัวแปลง — ส่งแค่ qty/price ต่อบรรทัด ท่อคิด totalprice/amount เอง
 *
 * 🔴 สามเรื่องที่รีวิวจับได้ในต้นแบบ — ห้ามถอยกลับ:
 *  1) **ใบขาย/ซื้อหลายบรรทัด** เดิม 1 แถว = 1 ใบ ⇒ ใบที่มี 3 สินค้ากลายเป็น 3 ใบใน ZORT
 *     ⇒ รวมแถวที่ "เลขอ้างอิง" หรือ "เลขที่ใบ" เดียวกันเป็นใบเดียว items[] หลายบรรทัด
 *  2) **ref อัตโนมัติห้ามมีเลขแถวปน** เดิม `IMPORT-kind-<เลขแถว>-hash` ⇒ แทรกแถวแล้วอัปไฟล์เดิมซ้ำ
 *     ref ของทุกแถวข้างล่างเลื่อนหมด ⇒ ตัวกันซ้ำของท่อไม่จับ = ZORT ได้ใบซ้ำ (ลบใบขาย/ซื้อผ่าน API ไม่ได้)
 *     ⇒ คิดจากเนื้อหาอย่างเดียว · แถวเนื้อหาเหมือนกันทุกช่องให้ต่อท้ายลำดับที่ซ้ำ (-2, -3)
 *  3) **xlsx ช่องหายเงียบ** เดิมไม่อ่าน inlineStr และจับ t="s" ไม่ได้ถ้า attribute อยู่ก่อน r=
 *     ⇒ อ่าน attribute ทุกลำดับ · inlineStr · str (สูตรที่ได้ข้อความ) · มีหลายชีต = เตือน (อ่านเฉพาะชีตแรก) */

export type ImportKind = 'sale' | 'po' | 'product' | 'contact' | 'quotation'
export type RowProblem = { row: number; field: string; error: string }
export type ParseResult = { rows: Record<string, unknown>[]; errors: RowProblem[]; warnings: string[] }

const aliases: Record<string, string> = {
  'เลขอ้างอิง': 'ref', ref: 'ref', reference: 'ref',
  'เลขที่ใบ': 'number', 'เลขที่เอกสาร': 'number', number: 'number',
  'รหัสสินค้า': 'sku', sku: 'sku',
  'ชื่อสินค้า': 'name', 'ชื่อ': 'name', name: 'name',
  'จำนวน': 'qty', qty: 'qty', quantity: 'qty',
  'ราคา': 'price', 'ราคาต่อหน่วย': 'price', price: 'price',
  'ลูกค้า': 'customer', customer: 'customer',
  'ผู้ขาย': 'vendor', vendor: 'vendor',
  'รหัสผู้ติดต่อ': 'code', code: 'code',
  'โทรศัพท์': 'phone', phone: 'phone', email: 'email', 'อีเมล': 'email',
  'เลขผู้เสียภาษี': 'taxId', taxid: 'taxId',
  'ต้นทุน': 'cost', cost: 'cost', 'หน่วย': 'unit', unit: 'unit',
  'บาร์โค้ด': 'barcode', barcode: 'barcode', 'หมวดหมู่': 'category', category: 'category',
  /* ใบเสนอราคา — ⚠️ 'เลขอ้างอิง' และคำอังกฤษ `reference` ถูกจองเป็น ref (ตัวกันซ้ำ) ไปแล้ว
     ⇒ ช่อง reference ของ ZORT ต้องใช้ชื่อหัวคอลัมน์อื่น ห้ามแย่งของเดิม
        (แย่งเมื่อไหร่ ตัวกันซ้ำของไฟล์เก่าจะเปลี่ยนความหมายเงียบ ๆ = เสี่ยงใบซ้ำที่ลบไม่ได้) */
  'เอกสารอ้างอิง': 'reference', docref: 'reference',
  'หมายเหตุ': 'note', note: 'note', 'รายละเอียด': 'note',
}
const text = (v: unknown) => String(v ?? '').trim()
const number = (v: unknown, row: number, field: string, errors: RowProblem[]) => {
  const s = text(v).replace(/,/g, '')
  if (!s) return undefined
  const n = Number(s)
  if (!Number.isFinite(n)) errors.push({ row, field, error: `${field} ต้องเป็นตัวเลข` })
  return Number.isFinite(n) ? n : undefined
}

/** FNV-1a 32 บิต — ลายนิ้วมือเนื้อหา (ไม่ใช่ความลับ ใช้กันซ้ำเท่านั้น) */
function fingerprint(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** CSV parser ที่รองรับ quote และ newline ใน quote โดยไม่แยกคอลัมน์ผิด */
export function parseCsv(textValue: string): string[][] {
  const src = textValue.charCodeAt(0) === 0xfeff ? textValue.slice(1) : textValue // ตัด BOM ที่ Excel ใส่มาตอนบันทึก CSV
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '"') { if (quoted && src[i + 1] === '"') { cell += c; i++ } else quoted = !quoted }
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function decodeXml(s: string) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&') // ต้องทำท้ายสุด ไม่งั้น &amp;lt; จะกลายเป็น < (ถอดสองชั้น)
}
function columnNumber(ref: string) { let n = 0; for (const c of ref.replace(/\d/g, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1 }
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
const joinText = (xml: string) => Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((x) => decodeXml(x[1])).join('')

/** อ่าน xlsx จากไบต์ — แยกจาก File เพื่อให้ทดสอบบน Node ได้ */
export async function parseXlsxBuffer(data: ArrayBuffer | Uint8Array): Promise<{ table: string[][]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(data)
  const warnings: string[] = []
  const workbook = await zip.file('xl/workbook.xml')?.async('string') ?? ''
  const sheetCount = Array.from(workbook.matchAll(/<sheet\b/g)).length
  if (sheetCount > 1) warnings.push(`ไฟล์นี้มี ${sheetCount} ชีต — อ่านเฉพาะชีตแรกเท่านั้น ชีตอื่นไม่ถูกนำเข้า`)
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string') ?? ''
  const shared = Array.from(sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) => joinText(m[1]))
  const sheet = zip.file('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('ไม่พบชีตแรกในไฟล์ Excel')
  const xml = await sheet.async('string'); const out: string[][] = []
  for (const r of Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g))) {
    const cells: string[] = []
    // attribute ของ <c> มาได้ทุกลำดับ (t ก่อน r ก็มี) · ช่องแบบปิดตัวเอง <c .../> = ว่าง
    for (const c of Array.from(r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
      const ref = attr(c[1], 'r'); if (!ref) continue
      const type = attr(c[1], 't'); const body = c[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
      cells[columnNumber(ref)] = type === 's' ? (shared[Number(v)] ?? '')
        : type === 'inlineStr' ? joinText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '')
        : decodeXml(v)
    }
    out.push(Array.from(cells, (x) => x ?? ''))
  }
  return { table: out, warnings }
}

type Line = { sku: string; name: string; qty: number; price: number }
type DocGroup = {
  key: string; firstRow: number; party: string; number?: string; items: Line[]; parts: string[]
  /** เฉพาะใบเสนอราคา — เก็บค่าจากแถวแรกที่มีค่า (แถวต่อ ๆ มาของใบเดียวกันไม่ต้องกรอกซ้ำ) */
  phone?: string; reference?: string; note?: string
}

export function mapImportRows(kind: ImportKind, table: string[][]): ParseResult {
  const errors: RowProblem[] = []; const rows: Record<string, unknown>[] = []; const warnings: string[] = []
  const headers = (table[0] ?? []).map((h) => aliases[text(h).toLowerCase()] ?? aliases[text(h)] ?? text(h))
  const seen = new Map<string, number>()
  /* ref อัตโนมัติจากเนื้อหา — ไม่มีเลขแถว · เนื้อหาซ้ำเป๊ะให้ต่อลำดับ */
  const autoRef = (content: string) => {
    const base = `IMPORT-${kind}-${fingerprint(`${kind}${content}`)}`
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
  const groups = new Map<string, DocGroup>()
  const order: DocGroup[] = []
  const partyField = kind === 'po' ? 'vendor' : 'customer'
  /* เลขที่ใบของ quotation ใช้รวมบรรทัดได้ แต่ส่งไป ZORT ไม่ได้ (ไม่มีช่อง) ⇒ เตือนครั้งเดียว */
  let warnedNumber = false

  for (let index = 1; index < table.length; index++) {
    const rowNo = index + 1; const values = table[index] ?? []
    const get = (k: string) => { const i = headers.indexOf(k); return i < 0 ? undefined : values[i] }
    if (!values.some((v) => text(v))) continue
    const suppliedRef = text(get('ref')); const sku = text(get('sku')); const name = text(get('name'))
    const content = values.map(text).join('')

    if (kind === 'contact') {
      const code = text(get('code'))
      if (!code) errors.push({ row: rowNo, field: 'code', error: 'ผู้ติดต่อต้องมี code' })
      if (!name) errors.push({ row: rowNo, field: 'name', error: 'ผู้ติดต่อต้องมี name' })
      if (code && name) rows.push({ ref: suppliedRef || autoRef(content), code, name,
        phone: text(get('phone')) || undefined, email: text(get('email')) || undefined, taxId: text(get('taxId')) || undefined })
      continue
    }
    if (kind === 'product') {
      if (!sku) errors.push({ row: rowNo, field: 'sku', error: 'สินค้าต้องมี sku' })
      if (!name) errors.push({ row: rowNo, field: 'name', error: 'สินค้าต้องมี name' })
      const price = number(get('price'), rowNo, 'ราคา', errors); const cost = number(get('cost'), rowNo, 'ต้นทุน', errors)
      if (sku && name) rows.push({ ref: suppliedRef || autoRef(content), sku, name, price, cost,
        unit: text(get('unit')) || undefined, barcode: text(get('barcode')) || undefined, category: text(get('category')) || undefined })
      continue
    }

    // ใบขาย/ใบซื้อ — แถวคือ "บรรทัด" รวมเป็นใบด้วยเลขอ้างอิงหรือเลขที่ใบ
    const qty = number(get('qty'), rowNo, 'จำนวน', errors); const price = number(get('price'), rowNo, 'ราคา', errors)
    let bad = false
    if (!sku) { errors.push({ row: rowNo, field: 'sku', error: 'ต้องมี sku' }); bad = true }
    if (!name) { errors.push({ row: rowNo, field: 'name', error: 'ต้องมี name' }); bad = true }
    if (!qty || qty <= 0) { errors.push({ row: rowNo, field: 'qty', error: 'จำนวนต้องมากกว่า 0' }); bad = true }
    if (price === undefined || price < 0) { errors.push({ row: rowNo, field: 'price', error: 'ต้องมีราคาไม่ติดลบ' }); bad = true }
    const docNumber = text(get('number'))
    if (kind === 'quotation' && docNumber && !warnedNumber) {
      warnedNumber = true
      warnings.push('คอลัมน์ "เลขที่ใบ" ใช้รวมบรรทัดที่เป็นใบเดียวกันเท่านั้น — '
        + 'เส้นใบเสนอราคาของ ZORT ไม่มีช่องเลขที่เอกสาร เลขนี้จะไม่ถูกส่งไป '
        + '(ถ้าอยากให้มีเลขอ้างอิงติดใบ ใส่คอลัมน์ "เอกสารอ้างอิง")')
    }
    const key = suppliedRef || docNumber
    const party = text(get(partyField))
    const line: Line | null = bad ? null : { sku, name, qty: qty as number, price: price as number }

    const extra = kind === 'quotation'
      ? { phone: text(get('phone')) || undefined, reference: text(get('reference')) || undefined, note: text(get('note')) || undefined }
      : {}

    if (!key) {
      // ไม่มีเลขอ้างอิง/เลขที่ใบ ⇒ ใบละแถว · ref จากเนื้อหาแถว
      if (line) order.push({ key: autoRef(content), firstRow: rowNo, party, items: [line], parts: [content], ...extra })
      continue
    }
    let g = groups.get(key)
    if (!g) { g = { key, firstRow: rowNo, party, number: docNumber || undefined, items: [], parts: [], ...extra }; groups.set(key, g); order.push(g) }
    else if (party && g.party && party !== g.party) {
      errors.push({ row: rowNo, field: partyField,
        error: `ใบ ${key} มี${kind === 'sale' ? 'ลูกค้า' : 'ผู้ขาย'}ไม่ตรงกัน ("${g.party}" แถว ${g.firstRow} กับ "${party}") — แก้ให้ตรงก่อน` })
      g.party = ' conflict'
    } else if (party && !g.party) g.party = party
    /* ช่องเสริมของใบเสนอราคา: แถวแรกที่มีค่าเป็นเจ้าของ — ไม่บังคับให้กรอกซ้ำทุกบรรทัด */
    if (kind === 'quotation') {
      const e = extra as { phone?: string; reference?: string; note?: string }
      if (!g.phone && e.phone) g.phone = e.phone
      if (!g.reference && e.reference) g.reference = e.reference
      if (!g.note && e.note) g.note = e.note
    }
    if (line) g.items.push(line)
  }

  for (const g of order) {
    if (!g.items.length) continue
    if (g.party === ' conflict') continue // ใบที่ลูกค้า/ผู้ขายชนกัน ไม่ส่ง (มี error แล้ว)
    const party = g.party || undefined
    if (kind === 'quotation') {
      /* 🔴 customer บังคับ — ท่อจะปฏิเสธอยู่แล้ว แต่ตีกลับที่นี่ได้บอก "แถวไหน" ซึ่งท่อบอกไม่ได้ */
      if (!party) {
        errors.push({ row: g.firstRow, field: 'customer', error: 'ใบเสนอราคาต้องมีชื่อลูกค้า' })
        continue
      }
      if (party.length > 160) {
        errors.push({ row: g.firstRow, field: 'customer', error: `ชื่อลูกค้ายาวเกิน 160 ตัวอักษร (${party.length})` })
        continue
      }
      const ref80 = g.reference ?? ''
      if (ref80.length > 80) {
        errors.push({ row: g.firstRow, field: 'reference', error: `เอกสารอ้างอิงยาวเกิน 80 ตัวอักษร (${ref80.length})` })
        continue
      }
      const ph = g.phone ?? ''
      if (ph.length > 40) {
        errors.push({ row: g.firstRow, field: 'phone', error: `เบอร์โทรยาวเกิน 40 ตัวอักษร (${ph.length})` })
        continue
      }
      rows.push({
        ref: g.key, customer: party, items: g.items,
        ...(ph ? { phone: ph } : {}),
        ...(ref80 ? { reference: ref80 } : {}),
        ...(g.note ? { note: g.note } : {}),
      })
      continue
    }
    rows.push(kind === 'sale'
      ? { ref: g.key, ...(g.number ? { number: g.number } : {}), customer: party, items: g.items }
      : { ref: g.key, vendor: party, items: g.items })
  }
  return { rows, errors, warnings }
}

/** อ่าน CSV หรือ xlsx แล้วคืน rows ที่ส่งเข้า POST /api/core?batch=<kind> ได้โดยตรง (แบ่งทีละ ≤20 แถวก่อนส่ง) */
export async function readImportFile(kind: ImportKind, file: File): Promise<ParseResult> {
  if (/\.xlsx$/i.test(file.name)) {
    const { table, warnings } = await parseXlsxBuffer(await file.arrayBuffer())
    const r = mapImportRows(kind, table)
    return { ...r, warnings: [...warnings, ...r.warnings] }
  }
  return mapImportRows(kind, parseCsv(await file.text()))
}
