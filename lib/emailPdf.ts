// สร้างไฟล์ PDF จากเนื้อหาอีเมล (ใช้กับอีเมลใบเสร็จที่ไม่มีไฟล์ PDF แนบมา เช่น Apple/iCloud)
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

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

export interface EmailPdfInfo {
  vendorName: string
  subject: string
  from: string
  date: string // ISO
  amounts: string[]
  body: string
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

export async function emailToPdf(info: EmailPdfInfo): Promise<Buffer> {
  const fonts = await loadFonts()
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit as any)
  const font = await doc.embedFont(fonts.regular, { subset: true })
  const bold = await doc.embedFont(fonts.bold, { subset: true })

  const pageW = 595.28, pageH = 841.89 // A4
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
