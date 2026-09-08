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

  /** เจ้านี้ต้องมีบิล **ทุกเดือน** แน่นอน (ค่าบริการรายเดือนตายตัว)
   *  ⇒ ตัวเฝ้า `bills-watch.mjs` จะเตือนเมื่อเดือนที่แล้วไม่มีบิลของเจ้านี้
   *
   *  🔴 **ตั้ง true เฉพาะเจ้าที่เก็บทุกเดือนจริง ๆ** — ค่าโฆษณา (Meta/Google/TikTok)
   *     เดือนที่ไม่ยิงโฆษณาก็ไม่มีบิล ตั้ง true = เตือนผิดทุกเดือนจนคนเลิกอ่าน
   *     แล้วเดือนที่หายจริงจะไม่มีใครเห็น (ดู [[metrics-need-outside-leg]])
   *  ⚠️ ฟิลด์นี้มีความหมายเดียว: "ต้องมีทุกเดือนไหม" ห้ามเอาไปใช้ตัดสินเรื่องอื่น
   *     (ดู [[explain-fields-cant-decide]]) */
  everyMonth?: boolean
}

// เงื่อนไข query รองรับทั้งอีเมลที่ส่งตรงจากผู้ให้บริการ และอีเมลที่ถูก forward มา (ผู้ส่งเปลี่ยน)
export const BILL_VENDORS: BillVendorInfo[] = [
  { id: 'tiktok',  name: 'TikTok Ads',        emoji: '🎵', gridName: 'TikTok Ads',    gridOrder: 2, logo: '/logos/tiktok.png', query: '(from:tiktok.com (invoice OR "tax invoice" OR ใบแจ้งหนี้ OR receipt OR ใบเสร็จ) -from:notification@service.tiktok.com -from:sellersupport@shop.tiktok.com) OR (from:gucut@icloud.com tiktok has:attachment)' },
  { id: 'meta',    name: 'Facebook/Meta Ads', emoji: '📘', gridName: 'Facebook Ads',  gridOrder: 1, logo: '/logos/facebook.webp', note: 'เฉพาะบัญชี GUCUTใหม่ (263190084598096)', query: 'from:facebookmail.com (subject:"Meta Invoice" OR subject:"Payments Remittance" OR "self accounted document" OR "remittance advice")', accountId: '263190084598096' },
  { id: 'google',  name: 'Google Ads',        emoji: '🔍', gridName: 'Google Ads',    gridOrder: 3, logo: '/logos/google.webp', query: 'from:payments-noreply@google.com OR (from:google.com subject:("payment receipt" OR ใบเสร็จ))' },
  { id: 'shopify', name: 'www (Shopify)',     emoji: '🛒', gridName: 'www (Shopify)', gridOrder: 0, logo: 'https://www.gucut.com/cdn/shop/files/7c6eb86bd569d120fbcb7ab8372b6803_8e3d89af-4a8d-419a-98c6-14b009abbfc3.svg', note: 'ปกติเดือนละ 2 ใบ (ค่าแพ็คเกจ + ค่าแอป)', query: '(from:shopify.com OR "Shopify Billing") (invoice OR billing OR bill OR ใบเรียกเก็บเงิน OR receipt OR ลดหนี้)' },
  { id: 'line',    name: 'LINE',              emoji: '💚', gridName: 'LINE',       gridOrder: 4, logo: '/logos/line.png', everyMonth: true, /* ฿1,369.60/เดือน แพ็กเกจเบสิค — คงที่ · มี 07/08/09 ไม่ขาด */ query: '((from:line.me OR from:linecorp.com OR from:linebiz.com) (invoice OR receipt OR ใบเสร็จ OR "tax invoice")) OR (from:10jetli@gmail.com subject:"ใบกำกับภาษี LINE OA")' },  { id: 'adobe',   name: 'Adobe',             emoji: '🅰️', gridName: 'Adobe',         gridOrder: 5, logo: '/logos/adobe.png', everyMonth: true, /* สมาชิกรายเดือน — มี 07/08/09 ไม่ขาด */ query: 'from:adobe.com (invoice OR receipt)' },
  { id: 'apple',   name: 'Apple / iCloud',    emoji: '🍎', gridName: 'Apple / iCloud', gridOrder: 6, logo: '/logos/apple.webp', everyMonth: true, /* iCloud + LINE Premium ID — มีครบ 14/14 เดือนไม่ขาดเลย */ query: '(from:apple.com OR "ใบเสร็จรับเงินจาก Apple" OR "Your receipt from Apple") (ใบเสร็จ OR receipt OR invoice)', accountId: 'gucut@icloud.com' },
  /* Netlify — เจ้าของร้านสั่งเพิ่ม 8 ก.ย. 2569 (ค่าโฮสต์เว็บ gucut.com + admin)
     🔴 **ยิงของจริงแล้ว 8 ก.ย. 2569: Netlify ไม่ส่งใบเสร็จเข้าเมลเลยสักใบ**
        ค้น Gmail ทั้งกล่อง `from:netlify.com` เจอ 21 ฉบับ — เป็นเตือนโควตา
        ("used 50%/75% of your credits") · "Action needed" · "upgraded to Pro" ล้วน ๆ
        และค้นนอก netlify.com (Stripe ฯลฯ) ได้ 0 ฉบับ ⇒ บิลอยู่บนแดชบอร์ดที่เดียว
        app.netlify.com/teams/10jetli/billing/general → Billing history → โหลด PDF เอง
     ⚠️ **ห้ามตั้ง query กว้างอีก** — รอบแรกตั้งกว้าง (invoice OR receipt OR billing OR
        payment) แล้วมันจับเมลเตือนโควตา 14 ฉบับไปทำเป็น "ใบเสร็จ.pdf" ปลอม (ตัว GEN
        ที่สร้างจากเนื้อเมลตอนไม่มีไฟล์แนบ) ⇒ คลังบิลมีใบเสร็จที่ไม่ใช่ใบเสร็จ
        ซึ่งแย่กว่าไม่มีบิลเลย เพราะดูเหมือนเก็บครบแล้ว
     ⇒ query ด้านล่างบังคับให้คำว่า receipt/invoice อยู่ใน **subject** เท่านั้น
        (subject ของเมลเตือนไม่มีคำพวกนี้สักฉบับ) ⇒ ตอนนี้จับได้ 0 ใบ **โดยตั้งใจ**
        วันไหน Netlify เริ่มส่งใบเสร็จเข้าเมล มันจะเข้าเองโดยไม่ต้องแก้อะไร
        ระหว่างนี้เอาใบจริงเข้าระบบด้วยการอัปโหลด (ไฟล์ `YYYY-MM_REAL_*.pdf`) */
  { id: 'netlify', name: 'Netlify',           emoji: '🌐', gridName: 'Netlify',      gridOrder: 8, logo: '/logos/netlify.webp', note: 'ค่าโฮสต์เว็บ — Netlify ไม่ส่งใบเสร็จเข้าเมล ต้องโหลดจากแดชบอร์ดแล้วอัปเอง', everyMonth: true, /* Pro plan รายเดือน (เริ่ม ส.ค. 2569) */ query: 'from:netlify.com subject:(receipt OR invoice OR "payment received" OR ใบเสร็จ)' },
  { id: 'omise',   name: 'Omise',             emoji: '💳', gridName: 'Omise',         gridOrder: 7, query: 'from:omise.co ใบเสร็จ' },
]
