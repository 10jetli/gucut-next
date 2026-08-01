// ข้อมูลผู้ให้บริการบิลทั้งหมด — แก้ที่ไฟล์นี้ที่เดียว แล้วมีผลทั้ง Gmail query,
// เมนูย่อยบิลใน sidebar, หน้ารวมบิล และหน้าบิลรายเจ้า
export interface BillVendorInfo {
  id: string
  name: string        // ชื่อมาตรฐาน (ใช้ในเมนู, หน้าบิลรายเจ้า, ฝั่ง server)
  emoji: string
  gridName: string    // ชื่อที่แสดงในช่องหน้ารวมบิล (บางเจ้าใช้ชื่อสั้นกว่า)
  gridOrder: number   // ลำดับช่องในหน้ารวมบิล
  logo?: string       // โลโก้ในหน้ารวมบิล (ถ้ามี ใช้แทน emoji)
  note?: string       // หมายเหตุใต้ชื่อในหน้าบิลรายเจ้า
  query: string       // Gmail search query (ไม่รวมช่วงวันที่)
  accountId?: string  // (ถ้ามี) เลขบัญชีที่ต้องเจอในเนื้อหา PDF ถึงจะนับเป็นบิลของเจ้านี้
}

// เงื่อนไข query รองรับทั้งอีเมลที่ส่งตรงจากผู้ให้บริการ และอีเมลที่ถูก forward มา (ผู้ส่งเปลี่ยน)
export const BILL_VENDORS: BillVendorInfo[] = [
  { id: 'tiktok',  name: 'TikTok Ads',        emoji: '🎵', gridName: 'TikTok Ads',    gridOrder: 2, logo: '/logos/tiktok.png', query: '(from:tiktok.com (invoice OR "tax invoice" OR ใบแจ้งหนี้ OR receipt OR ใบเสร็จ) -from:notification@service.tiktok.com -from:sellersupport@shop.tiktok.com) OR (from:gucut@icloud.com tiktok has:attachment)' },
  { id: 'meta',    name: 'Facebook/Meta Ads', emoji: '📘', gridName: 'Facebook Ads',  gridOrder: 1, logo: '/logos/facebook.webp', note: 'เฉพาะบัญชี GUCUTใหม่ (263190084598096)', query: 'from:facebookmail.com (subject:"Meta Invoice" OR subject:"Payments Remittance" OR "self accounted document" OR "remittance advice")', accountId: '263190084598096' },
  { id: 'google',  name: 'Google Ads',        emoji: '🔍', gridName: 'Google Ads',    gridOrder: 3, logo: '/logos/google.webp', query: 'from:payments-noreply@google.com OR (from:google.com subject:("payment receipt" OR ใบเสร็จ))' },
  { id: 'shopify', name: 'www (Shopify)',     emoji: '🛒', gridName: 'www (Shopify)', gridOrder: 0, logo: 'https://www.gucut.com/cdn/shop/files/7c6eb86bd569d120fbcb7ab8372b6803_8e3d89af-4a8d-419a-98c6-14b009abbfc3.svg', note: 'ปกติเดือนละ 2 ใบ (ค่าแพ็คเกจ + ค่าแอป)', query: '(from:shopify.com OR "Shopify Billing") (invoice OR billing OR bill OR ใบเรียกเก็บเงิน OR receipt OR ลดหนี้)' },
  { id: 'line',    name: 'LINE',              emoji: '💚', gridName: 'LINE',       gridOrder: 4, logo: '/logos/line.png', query: '((from:line.me OR from:linecorp.com OR from:linebiz.com) (invoice OR receipt OR ใบเสร็จ OR "tax invoice")) OR (from:10jetli@gmail.com subject:"ใบกำกับภาษี LINE OA")' },  { id: 'adobe',   name: 'Adobe',             emoji: '🅰️', gridName: 'Adobe',         gridOrder: 5, logo: '/logos/adobe.png', query: 'from:adobe.com (invoice OR receipt)' },
  { id: 'apple',   name: 'Apple / iCloud',    emoji: '🍎', gridName: 'Apple / iCloud', gridOrder: 6, logo: '/logos/apple.webp', query: '(from:apple.com OR "ใบเสร็จรับเงินจาก Apple" OR "Your receipt from Apple") (ใบเสร็จ OR receipt OR invoice)' },
  { id: 'omise',   name: 'Omise',             emoji: '💳', gridName: 'Omise',         gridOrder: 7, query: 'from:omise.co ใบเสร็จ' },
]
