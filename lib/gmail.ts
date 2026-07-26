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
    accountId?: string // (ถ้ามี) เลขบัญชี/รหัสที่ต้องเจอในเนื้อหา PDF ถึงจะนับเป็นบิลของ vendor นี้
}


// ผู้ให้บริการที่ต้องเก็บบิลทุกเดือน
// หมายเหตุ: เงื่อนไขรองรับทั้งอีเมลที่ส่งตรงจากผู้ให้บริการ และอีเมลที่ถูก forward มา (ผู้ส่งเปลี่ยน)
export const VENDORS: BillVendor[] = [
  { id: 'tiktok',  name: 'TikTok Ads',        emoji: '🎵', query: '(from:tiktok.com (invoice OR "tax invoice" OR ใบแจ้งหนี้ OR receipt OR ใบเสร็จ) -from:notification@service.tiktok.com -from:sellersupport@shop.tiktok.com) OR (from:gucut@icloud.com tiktok has:attachment)' },
  { id: 'meta',    name: 'Facebook/Meta Ads', emoji: '📘', query: 'from:facebookmail.com (subject:"Meta Invoice" OR subject:"Payments Remittance" OR "self accounted document" OR "remittance advice")', accountId: '263190084598096' },
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
