// ─── Gmail API helper (REST, no googleapis dependency) ───────────────────────
// ใช้ refresh token แบบ single-user: ตั้งค่า env 3 ตัวบน Vercel
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// วิธีขอ refresh token ครั้งแรก: เปิด /api/google/auth (ดู SETUP-BILLS.md)

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

export interface BillVendor {
  id: string
  name: string
  emoji: string
  query: string // Gmail search query (ไม่รวมช่วงวันที่)
}

// ผู้ให้บริการที่ต้องเก็บบิลทุกเดือน
// หมายเหตุ: เงื่อนไขรองรับทั้งอีเมลที่ส่งตรงจากผู้ให้บริการ และอีเมลที่ถูก forward มา (ผู้ส่งเปลี่ยน)
export const VENDORS: BillVendor[] = [
  { id: 'tiktok',  name: 'TikTok Ads',        emoji: '🎵', query: 'from:tiktok.com (invoice OR "tax invoice" OR ใบแจ้งหนี้) -from:notification@service.tiktok.com -from:sellersupport@shop.tiktok.com' },
  { id: 'meta',    name: 'Facebook/Meta Ads', emoji: '📘', query: '"263190084598096" (ใบเสร็จ OR receipt OR invoice)' },
  { id: 'google',  name: 'Google Ads',        emoji: '🔍', query: 'from:payments-noreply@google.com OR (from:google.com subject:("payment receipt" OR ใบเสร็จ))' },
  { id: 'shopify', name: 'www (Shopify)',     emoji: '🛒', query: '(from:shopify.com OR "Shopify Billing") (invoice OR billing OR bill OR ใบเรียกเก็บเงิน OR receipt OR ลดหนี้)' },
  { id: 'line',    name: 'LINE',              emoji: '💚', query: '(from:line.me OR from:linecorp.com OR from:linebiz.com) (invoice OR receipt OR ใบเสร็จ OR "tax invoice")' },
  { id: 'adobe',   name: 'Adobe',             emoji: '🅰️', query: 'from:adobe.com (invoice OR receipt)' },
  { id: 'apple',   name: 'Apple / iCloud',    emoji: '🍎', query: '(from:apple.com OR "ใบเสร็จรับเงินจาก Apple" OR "Your receipt from Apple") (ใบเสร็จ OR receipt OR invoice)' },
  { id: 'omise',   name: 'Omise',             emoji: '💳', query: 'from:omise.co ใบเสร็จ' },
]

// ── OAuth ────────────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN (ดู SETUP-BILLS.md)')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`ขอ access token ไม่สำเร็จ: ${JSON.stringify(data)}`)
  return data.access_token as string
}

async function gmailGet(token: string, path: string) {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

// ── Search & fetch ───────────────────────────────────────────────────────────

export interface BillAttachment {
  filename: string
  attachmentId: string
  mimeType: string
  size: number
}

export interface BillMessage {
  vendorId: string
  vendorName: string
  emoji: string
  messageId: string
  date: string      // ISO
  subject: string
  from: string
  snippet: string
  amounts: string[] // ยอดเงินที่เดาได้จากเนื้อหา (best-effort)
  attachments: BillAttachment[]
}

function headerOf(payload: any, name: string): string {
  return payload?.headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function collectParts(payload: any, out: any[] = []): any[] {
  if (!payload) return out
  out.push(payload)
  for (const p of payload.parts ?? []) collectParts(p, out)
  return out
}

function decodeBody(data?: string): string {
  if (!data) return ''
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch { return '' }
}

// ดึงยอดเงินจากข้อความ (THB / ฿ / USD / $) แบบ best-effort
function extractAmounts(text: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /(?:THB|฿)\s?([\d,]+(?:\.\d{2})?)/g,
    /([\d,]+(?:\.\d{2})?)\s?(?:บาท|THB)/g,
    /(?:USD|\$)\s?([\d,]+(?:\.\d{2})?)/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) && found.size < 6) {
      const full = m[0].trim()
      if (parseFloat(m[1].replace(/,/g, '')) > 0) found.add(full)
    }
  }
  return Array.from(found)
}

export async function searchVendorBills(
  token: string, vendor: BillVendor, afterYmd: string, beforeYmd: string,
): Promise<BillMessage[]> {
  const q = `${vendor.query} after:${afterYmd} before:${beforeYmd}`
  const list = await gmailGet(token, `/messages?q=${encodeURIComponent(q)}&maxResults=25`)
  const out: BillMessage[] = []

  for (const m of list.messages ?? []) {
    const msg = await gmailGet(token, `/messages/${m.id}?format=full`)
    const parts = collectParts(msg.payload)
    const attachments: BillAttachment[] = parts
      .filter(p => p.filename && p.body?.attachmentId)
      .map(p => ({
        filename: p.filename,
        attachmentId: p.body.attachmentId,
        mimeType: p.mimeType ?? 'application/octet-stream',
        size: p.body.size ?? 0,
      }))
    const textBody = parts
      .filter(p => p.mimeType === 'text/plain' || p.mimeType === 'text/html')
      .map(p => decodeBody(p.body?.data))
      .join('\n')
      .replace(/<[^>]+>/g, ' ')

    out.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      emoji: vendor.emoji,
      messageId: m.id,
      date: new Date(Number(msg.internalDate)).toISOString(),
      subject: headerOf(msg.payload, 'Subject'),
      from: headerOf(msg.payload, 'From'),
      snippet: msg.snippet ?? '',
      amounts: extractAmounts(textBody + ' ' + (msg.snippet ?? '')),
      attachments,
    })
  }
  return out
}

export async function fetchAttachment(
  token: string, messageId: string, attachmentId: string,
): Promise<Buffer> {
  const data = await gmailGet(token, `/messages/${messageId}/attachments/${attachmentId}`)
  return Buffer.from(String(data.data).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// ช่วงวันที่ของเดือน YYYY-MM → { after, before } แบบ YYYY/MM/DD (เผื่อบิลออกช้า +5 วัน)
export function monthRange(month: string): { after: string; before: string } {
  const [y, mo] = month.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const next = new Date(Date.UTC(y, mo - 1 + 1, 6)) // วันที่ 6 ของเดือนถัดไป
  return {
    after: `${y}/${pad(mo)}/01`,
    before: `${next.getUTCFullYear()}/${pad(next.getUTCMonth() + 1)}/${pad(next.getUTCDate())}`,
  }
}
