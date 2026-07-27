// แปลงอีเมลใบเสร็จเป็นไฟล์ PDF
// - ถ้าเป็นใบเสร็จ Apple (โครงสร้าง HTML ตามแบบของ Apple) จะจัดหน้าให้ใกล้เคียงต้นฉบับ พร้อมโลโก้/ไอคอนสินค้า
// - ถ้าไม่ใช่ จะ fallback เป็นการแสดงเนื้อหาแบบข้อความล้วน
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

// ── วาด PDF สไตล์ใบเสร็จ (โลโก้ + สองคอลัมน์ + รายการสินค้าพร้อมไอคอน + ยอดรวม) ──
async function drawReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const fonts = await loadFonts()
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit as any)
  const font = await doc.embedFont(fonts.regular, { subset: true })
  const bold = await doc.embedFont(fonts.bold, { subset: true })

  const pageW = 595.28, pageH = 841.89
  const margin = 50
  const contentW = pageW - margin * 2
  let page = doc.addPage([pageW, pageH])
  let y = pageH - margin

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageW, pageH])
      y = pageH - margin
    }
  }

  const gray = rgb(0.4, 0.4, 0.4)
  const black = rgb(0.15, 0.15, 0.15)

  let logoImg: any = null
  if (data.logoUrl) {
    const img = await fetchImageBytes(data.logoUrl)
    if (img) {
      try { logoImg = img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes) } catch {}
    }
  }
  const topY = y
  if (logoImg) {
    const h = 26
    const w = (logoImg.width / logoImg.height) * h
    page.drawImage(logoImg, { x: margin, y: topY - h, width: w, height: h })
  }
  const titleSize = 20
  const titleWidth = bold.widthOfTextAtSize(data.title, titleSize)
  page.drawText(data.title, { x: pageW - margin - titleWidth, y: topY - titleSize, size: titleSize, font: bold, color: black })
  y = topY - 50

  const colGap = 20
  const colW = (contentW - colGap) / 2
  const leftX = margin
  const rightX = margin + colW + colGap

  let leftY = y
  for (const f of data.fields) {
    ensureSpace(30)
    page.drawText(f.label, { x: leftX, y: leftY, size: 10, font, color: gray })
    leftY -= 13
    for (const l of wrapLine(f.value, font, 11, colW)) {
      page.drawText(l, { x: leftX, y: leftY, size: 11, font, color: black })
      leftY -= 15
    }
    leftY -= 4
  }

  let rightY = y
  if (data.billedToLines.length || data.paymentMethod) {
    page.drawText('เรียกเก็บเงินไปยัง', { x: rightX, y: rightY, size: 10, font, color: gray })
    rightY -= 15
    if (data.paymentMethod) {
      for (const l of wrapLine(data.paymentMethod, bold, 11, colW)) {
        page.drawText(l, { x: rightX, y: rightY, size: 11, font: bold, color: black })
        rightY -= 15
      }
    }
    for (const line of data.billedToLines) {
      for (const l of wrapLine(line, font, 10.5, colW)) {
        page.drawText(l, { x: rightX, y: rightY, size: 10.5, font, color: black })
        rightY -= 14
      }
    }
  }

  y = Math.min(leftY, rightY) - 15
  ensureSpace(20)
  page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
  y -= 25

  for (const item of data.items) {
    let iconImg: any = null
    if (item.iconUrl) {
      const img = await fetchImageBytes(item.iconUrl)
      if (img) {
        try { iconImg = img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes) } catch {}
      }
    }
    const iconSize = 44
    const textX = margin + (iconImg ? iconSize + 15 : 0)
    const priceWidth = bold.widthOfTextAtSize(item.price, 12)

    ensureSpace(iconSize + 10)
    const rowTopY = y
    if (iconImg) {
      page.drawImage(iconImg, { x: margin, y: rowTopY - iconSize, width: iconSize, height: iconSize })
    }
    let itemY = rowTopY
    for (const l of wrapLine(item.name, bold, 12, contentW - (iconImg ? iconSize + 15 : 0) - priceWidth - 10)) {
      page.drawText(l, { x: textX, y: itemY - 12, size: 12, font: bold, color: black })
      itemY -= 16
    }
    for (const d of item.descLines) {
      for (const l of wrapLine(d, font, 10, contentW - (iconImg ? iconSize + 15 : 0) - priceWidth - 10)) {
        page.drawText(l, { x: textX, y: itemY - 11, size: 10, font, color: gray })
        itemY -= 14
      }
    }
    page.drawText(item.price, { x: pageW - margin - priceWidth, y: rowTopY - 12, size: 12, font: bold, color: black })
    y = Math.min(itemY, rowTopY - iconSize) - 15
    ensureSpace(10)
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
    y -= 20
  }

  if (data.total) {
    ensureSpace(30)
    page.drawText('รวม', { x: margin, y, size: 13, font: bold, color: black })
    const totalWidth = bold.widthOfTextAtSize(data.total, 14)
    page.drawText(data.total, { x: pageW - margin - totalWidth, y, size: 14, font: bold, color: black })
    y -= 30
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

// ── fallback: dump ข้อความล้วน (ใช้เมื่อไม่ใช่โครงสร้าง Apple) ────────────────
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

  const pageW = 595.28, pageH = 841.89
  const margin = 50
  const maxWidth = pageW - margin * 2

  let page = doc.addPage([pageW, pageH])
  let y = pageH - margin

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageW, pageH])
      y = pageH - margin
    }
  }
  const drawLine = (text: string, size: number, f: any, gap: number) => {
    ensureSpace(gap)
    page.drawText(text, { x: margin, y, size, font: f, color: rgb(0, 0, 0) })
    y -= gap
  }

  drawLine('ใบเสร็จ / บิล — ' + info.vendorName, 16, bold, 26)
  for (const l of wrapLine('หัวข้อ: ' + info.subject, font, 11, maxWidth)) drawLine(l, 11, font, 15)
  for (const l of wrapLine('จาก: ' + info.from, font, 11, maxWidth)) drawLine(l, 11, font, 15)
  const dateStr = new Date(info.date).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })
  drawLine('วันที่: ' + dateStr, 11, font, 15)
  if (info.amounts.length) drawLine('ยอดที่พบ: ' + info.amounts.join(', '), 11, font, 15)
  y -= 8
  drawLine('เนื้อหาอีเมล:', 12, bold, 18)

  for (const raw of info.body.split('\n')) {
    const trimmed = raw.trim()
    if (!trimmed) { ensureSpace(10); y -= 10; continue }
    for (const w of wrapLine(trimmed, font, 10, maxWidth)) drawLine(w, 10, font, 14)
  }

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
        // ถ้าวาดแบบสวยไม่สำเร็จ (เช่น โหลดรูปไม่ได้) ให้ fallback เป็นแบบข้อความ
      }
    }
  }
  return drawGenericPdf(info)
}
