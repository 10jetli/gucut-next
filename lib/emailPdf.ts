// แปลงอีเมลใบเสร็จเป็นไฟล์ PDF สไตล์เอกสารบัญชีมืออาชีพ
// - ถ้าเป็นใบเสร็จ Apple (โครงสร้าง HTML ตามแบบของ Apple) จะจัดหน้าแบบใบแจ้งหนี้ พร้อมโลโก้/ไอคอนสินค้า
// - ถ้าไม่ใช่ จะ fallback เป็นการแสดงเนื้อหาแบบข้อความในกรอบเดียวกัน
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { parse } from 'node-html-parser'

const THAI_FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf'
const THAI_FONT_BOLD_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf'

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null

async function loadFonts() {
  if (fontCache) return fontCache
  const [r1, r2] = await Promise.all([fetch(THAI_FONT_URL), fetch(THAI_FONT_BOLD_URL)])
  if (!r1.ok || !r2.ok) throw new Error('โหลดฟอนต์ไม่สำเร็จ')
  fontCache = { regular: await r1.arrayBuffer(), bold: await r2.arrayBuffer() }
  return fontCache
}

async function fetchImageBytes(url: string): Promise<{ bytes: ArrayBuffer; kind: 'png' | 'jpg' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    const bytes = await res.arrayBuffer()
    if (ct.includes('png') || /\.png(\?|$)/i.test(url)) return { bytes, kind: 'png' }
    if (ct.includes('jpeg') || ct.includes('jpg')) return { bytes, kind: 'jpg' }
    const head = new Uint8Array(bytes.slice(0, 4))
    if (head[0] === 0x89 && head[1] === 0x50) return { bytes, kind: 'png' }
    if (head[0] === 0xff && head[1] === 0xd8) return { bytes, kind: 'jpg' }
    return null
  } catch { return null }
}

function wrapLine(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// ── สีและสไตล์ร่วมของเอกสาร (โทนน้ำเงินเข้ม ดูเป็นทางการ) ────────────────────
const ACCENT = rgb(0.09, 0.22, 0.42)
const GRAY = rgb(0.43, 0.43, 0.46)
const BLACK = rgb(0.12, 0.12, 0.14)
const BORDER_GRAY = rgb(0.83, 0.85, 0.88)
const CARD_BG = rgb(0.985, 0.985, 0.99)
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 50

// ── โครงสร้างข้อมูลใบเสร็จ (ใช้เมื่อแกะจาก HTML ของ Apple สำเร็จ) ─────────────
export interface ReceiptItem {
  iconUrl?: string | null
  name: string
  descLines: string[]
  price: string
}

export interface ReceiptData {
  logoUrl?: string | null
  title: string
  fields: { label: string; value: string }[]
  billedToLines: string[]
  paymentMethod?: string
  items: ReceiptItem[]
  total?: string
}

// ── แกะโครงสร้างใบเสร็จ Apple จาก HTML จริง (คืนค่า null ถ้าไม่ใช่แบบฟอร์มนี้) ──
function parseAppleReceipt(html: string): ReceiptData | null {
  let root
  try { root = parse(html) } catch { return null }
  const billing = root.querySelector('.billing-information')
  if (!billing) return null

  const logoImg = root.querySelector('img[alt="Apple"]')
  const logoUrl = logoImg ? logoImg.getAttribute('src') : null
  const titleEl = root.querySelector('h1')
  const title = titleEl ? titleEl.text.trim() : 'ใบเสร็จรับเงิน'

  const billingPs = billing.querySelectorAll('p')
  const date = billingPs[0] ? billingPs[0].text.trim() : ''

  function labelValue(label: string): string {
    const labelP = billingPs.find((p: any) => p.text.trim() === label)
    if (!labelP) return ''
    const parentDiv = labelP.parentNode
    const ps = parentDiv ? parentDiv.querySelectorAll('p') : []
    const valueP = ps[1]
    return valueP ? valueP.text.trim() : ''
  }
  const orderId = labelValue('ID การสั่งซื้อ:')
  const docNumber = labelValue('เอกสาร:')
  const appleAccount = labelValue('บัญชี Apple:')

  const fields: { label: string; value: string }[] = []
  if (date) fields.push({ label: 'วันที่', value: date })
  if (orderId) fields.push({ label: 'เลขที่ใบสั่งซื้อ', value: orderId })
  if (docNumber) fields.push({ label: 'หมายเลขเอกสาร', value: docNumber })
  if (appleAccount) fields.push({ label: 'บัญชี Apple', value: appleAccount })

  const items: ReceiptItem[] = []
  const rows = root.querySelectorAll('tr.subscription-lockup')
  for (const row of rows) {
    const tds = row.querySelectorAll('td')
    const iconEl = tds[0] ? tds[0].querySelector('img') : null
    const iconUrl = iconEl ? iconEl.getAttribute('src') : null
    const contentPs = tds[1] ? tds[1].querySelectorAll('p') : []
    const name = contentPs[0] ? contentPs[0].text.trim() : ''
    const descLines = contentPs.slice(1).map((p: any) => p.text.trim()).filter(Boolean)
    const priceP = tds[2] ? tds[2].querySelector('p') : null
    const price = priceP ? priceP.text.trim() : ''
    if (name || price) items.push({ iconUrl, name, descLines, price })
  }

  let billedToLines: string[] = []
  let paymentMethod = ''
  let total = ''
  const paymentSection = root.querySelector('.payment-information')
  if (paymentSection) {
    const leftCol = paymentSection.querySelector('.payment-information__left')
    billedToLines = leftCol ? leftCol.querySelectorAll('p').map((p: any) => p.text.trim()).filter(Boolean) : []
    const cols = paymentSection.querySelectorAll('.payment-information__col')
    const rightCol = cols.find((c: any) => !/payment-information__left/.test(c.getAttribute('class') || ''))
    if (rightCol) {
      const rightPs = rightCol.querySelectorAll('p')
      paymentMethod = rightPs[0] ? rightPs[0].text.trim() : ''
      total = rightPs[1] ? rightPs[1].text.trim() : ''
    }
  }
  if (!total && items.length) total = items[items.length - 1].price

  return { logoUrl, title, fields, billedToLines, paymentMethod, items, total }
}

function footerNote(): string {
  return 'เอกสารนี้สร้างโดยระบบเก็บบิลอัตโนมัติของ GUCUT จากอีเมลต้นฉบับ • ' + new Date().toLocaleDateString('th-TH', { dateStyle: 'medium' })
}

function drawFooters(pages: any[], font: any) {
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN - 8 }, end: { x: PAGE_W - MARGIN, y: MARGIN - 8 }, thickness: 0.5, color: BORDER_GRAY })
    p.drawText(footerNote(), { x: MARGIN, y: MARGIN - 20, size: 7.5, font, color: GRAY })
    const pn = 'หน้า ' + (i + 1) + '/' + pages.length
    const pnW = font.widthOfTextAtSize(pn, 7.5)
    p.drawText(pn, { x: PAGE_W - MARGIN - pnW, y: MARGIN - 20, size: 7.5, font, color: GRAY })
  })
}

// ── วาด PDF สไตล์ใบแจ้งหนี้ (แถบสีบน + สองคอลัมน์ + การ์ดรายการสินค้า + ยอดรวม) ──
async function drawReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const fonts = await loadFonts()
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit as any)
  const font = await doc.embedFont(fonts.regular, { subset: true })
  const bold = await doc.embedFont(fonts.bold, { subset: true })

  const contentW = PAGE_W - MARGIN * 2
  const pages: any[] = []
  function newPage() {
    const p = doc.addPage([PAGE_W, PAGE_H])
    p.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: ACCENT })
    pages.push(p)
    return p
  }
  let page = newPage()
  let y = PAGE_H - MARGIN - 14

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = newPage()
      y = PAGE_H - MARGIN - 14
    }
  }

  let logoImg: any = null
  if (data.logoUrl) {
    const img = await fetchImageBytes(data.logoUrl)
    if (img) { try { logoImg = img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes) } catch {} }
  }
  const topY = y
  if (logoImg) {
    const h = 34
    const w = (logoImg.width / logoImg.height) * h
    page.drawImage(logoImg, { x: MARGIN, y: topY - h, width: w, height: h })
  }
  const titleSize = 19
  const titleWidth = bold.widthOfTextAtSize(data.title, titleSize)
  page.drawText(data.title, { x: PAGE_W - MARGIN - titleWidth, y: topY - titleSize + 3, size: titleSize, font: bold, color: ACCENT })
  const subtitle = 'สำเนาอิเล็กทรอนิกส์ - ออกโดยระบบอัตโนมัติ'
  const subW = font.widthOfTextAtSize(subtitle, 8.5)
  page.drawText(subtitle, { x: PAGE_W - MARGIN - subW, y: topY - titleSize - 10, size: 8.5, font, color: GRAY })
  y = topY - 55
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: ACCENT })
  y -= 22

  const colGap = 24
  const colW = (contentW - colGap) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + colGap

  let leftY = y
  for (const f of data.fields) {
    ensureSpace(30)
    page.drawText(f.label.toUpperCase(), { x: leftX, y: leftY, size: 8.5, font: bold, color: GRAY })
    leftY -= 13
    for (const l of wrapLine(f.value, font, 11, colW)) {
      page.drawText(l, { x: leftX, y: leftY, size: 11, font, color: BLACK })
      leftY -= 15
    }
    leftY -= 5
  }

  let rightY = y
  if (data.billedToLines.length || data.paymentMethod) {
    page.drawText('เรียกเก็บเงินไปยัง'.toUpperCase(), { x: rightX, y: rightY, size: 8.5, font: bold, color: GRAY })
    rightY -= 16
    if (data.paymentMethod) {
      for (const l of wrapLine(data.paymentMethod, bold, 11, colW)) {
        page.drawText(l, { x: rightX, y: rightY, size: 11, font: bold, color: BLACK })
        rightY -= 15
      }
    }
    for (const line of data.billedToLines) {
      for (const l of wrapLine(line, font, 10.5, colW)) {
        page.drawText(l, { x: rightX, y: rightY, size: 10.5, font, color: BLACK })
        rightY -= 14
      }
    }
  }

  y = Math.min(leftY, rightY) - 20
  ensureSpace(20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: BORDER_GRAY })
  y -= 25

  for (const item of data.items) {
    const padding = 16
    const priceWidth = bold.widthOfTextAtSize(item.price, 12)
    const innerTextW = contentW - padding * 2 - priceWidth - 10

    const nameLines = wrapLine(item.name, bold, 12, innerTextW)
    let descLineCount = 0
    const descWrapped: string[][] = []
    for (const d of item.descLines) {
      const w = wrapLine(d, font, 10, innerTextW)
      descWrapped.push(w)
      descLineCount += w.length
    }
    const textBlockH = nameLines.length * 16 + descLineCount * 14
    const cardH = textBlockH + padding * 2

    ensureSpace(cardH + 10)
    const cardTop = y
    const cardBottom = y - cardH
    page.drawRectangle({ x: MARGIN, y: cardBottom, width: contentW, height: cardH, color: CARD_BG, borderColor: BORDER_GRAY, borderWidth: 1 })

    const textX = MARGIN + padding
    let itemY = cardTop - padding
    for (const l of nameLines) {
      page.drawText(l, { x: textX, y: itemY - 12, size: 12, font: bold, color: BLACK })
      itemY -= 16
    }
    for (const w of descWrapped) {
      for (const l of w) {
        page.drawText(l, { x: textX, y: itemY - 11, size: 10, font, color: GRAY })
        itemY -= 14
      }
    }
    page.drawText(item.price, { x: PAGE_W - MARGIN - padding - priceWidth, y: cardTop - padding - 12, size: 12, font: bold, color: BLACK })

    y = cardBottom - 18
  }

  if (data.total) {
    ensureSpace(40)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.4, color: ACCENT })
    y -= 24
    page.drawText('ยอดรวมทั้งสิ้น', { x: MARGIN, y, size: 12, font: bold, color: BLACK })
    const totalWidth = bold.widthOfTextAtSize(data.total, 16)
    page.drawText(data.total, { x: PAGE_W - MARGIN - totalWidth, y: y - 2, size: 16, font: bold, color: ACCENT })
    y -= 30
  }

  drawFooters(pages, font)

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

// ── fallback: แสดงเนื้อหาอีเมลในกรอบเดียวกัน (ใช้เมื่อไม่ใช่โครงสร้าง Apple) ───
export interface EmailPdfInfo {
  vendorName: string
  subject: string
  from: string
  date: string
  amounts: string[]
  body: string
}

async function drawGenericPdf(info: EmailPdfInfo): Promise<Buffer> {
  const fonts = await loadFonts()
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit as any)
  const font = await doc.embedFont(fonts.regular, { subset: true })
  const bold = await doc.embedFont(fonts.bold, { subset: true })

  const contentW = PAGE_W - MARGIN * 2
  const pages: any[] = []
  function newPage() {
    const p = doc.addPage([PAGE_W, PAGE_H])
    p.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: ACCENT })
    pages.push(p)
    return p
  }
  let page = newPage()
  let y = PAGE_H - MARGIN - 14

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = newPage()
      y = PAGE_H - MARGIN - 14
    }
  }

  const titleSize = 19
  page.drawText('ใบเสร็จ / บิล', { x: MARGIN, y, size: titleSize, font: bold, color: ACCENT })
  page.drawText(info.vendorName, { x: MARGIN, y: y - 22, size: 11, font, color: GRAY })
  y -= 45
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: ACCENT })
  y -= 22

  const fields: { label: string; value: string }[] = [
    { label: 'หัวข้อ', value: info.subject },
    { label: 'จาก', value: info.from },
    { label: 'วันที่', value: new Date(info.date).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) },
  ]
  if (info.amounts.length) fields.push({ label: 'ยอดที่พบ', value: info.amounts.join(', ') })

  for (const f of fields) {
    ensureSpace(30)
    page.drawText(f.label.toUpperCase(), { x: MARGIN, y, size: 8.5, font: bold, color: GRAY })
    y -= 13
    for (const l of wrapLine(f.value, font, 11, contentW)) {
      page.drawText(l, { x: MARGIN, y, size: 11, font, color: BLACK })
      y -= 15
    }
    y -= 5
  }

  y -= 10
  ensureSpace(20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: BORDER_GRAY })
  y -= 25

  const bodyLines: string[] = []
  for (const raw of info.body.split('\n')) {
    const trimmed = raw.trim()
    if (!trimmed) { bodyLines.push(''); continue }
    for (const l of wrapLine(trimmed, font, 10, contentW - 32)) bodyLines.push(l)
  }
  const cardH = Math.min(bodyLines.length, 34) * 14 + 32
  ensureSpace(cardH + 10)
  const cardTop = y
  page.drawRectangle({ x: MARGIN, y: cardTop - cardH, width: contentW, height: cardH, color: CARD_BG, borderColor: BORDER_GRAY, borderWidth: 1 })
  let by = cardTop - 16
  let count = 0
  for (const l of bodyLines) {
    if (count >= 34) break
    if (!l) { by -= 14; count++; continue }
    page.drawText(l, { x: MARGIN + 16, y: by, size: 10, font, color: BLACK })
    by -= 14
    count++
  }
  y = cardTop - cardH - 18

  drawFooters(pages, font)

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

// ── ฟังก์ชันหลัก: เลือก renderer ที่เหมาะสม ──────────────────────────────────
export async function emailToPdf(info: EmailPdfInfo & { html?: string }): Promise<Buffer> {
  if (info.html) {
    const receipt = parseAppleReceipt(info.html)
    if (receipt && (receipt.items.length || receipt.fields.length)) {
      try {
        return await drawReceiptPdf(receipt)
      } catch {
        // ถ้าวาดแบบใบแจ้งหนี้ไม่สำเร็จ (เช่น โหลดรูปไม่ได้) ให้ fallback เป็นแบบข้อความ
      }
    }
  }
  return drawGenericPdf(info)
}
