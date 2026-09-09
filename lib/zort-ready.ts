// 🏷️ ทะเบียนป้าย "ใช้แทน ZORT ได้หรือยัง" — **แหล่งความจริงเดียวของป้ายทุกจอ/ทุกเมนู**
//
// เจ้าของร้านประกาศ 7 ก.ย. 2569: "อยากจะใช้แล้ว" — จะใช้ admin.gucut.com เป็นจอหลักแทน ZORT
// ⇒ ทุกจอที่เป็นงานเดียวกับ ZORT ต้องบอกชัดว่าวันนี้พึ่งมันได้แค่ไหน (CEO สั่งทำทะเบียนเดียว)
//
// สองสถานะตามที่ CEO กำหนด:
//   'replace'  = 🟢 ใช้แทน ZORT ได้เลย — จอดู/ตรวจ ตัวเลขพิสูจน์กับ ZORT แล้ว
//                (สต็อกตรง 2,672/2,672 · ออเดอร์ตรง 7/7 วัน — ตรวจ 7 ก.ย. 2569)
//   'readonly' = 🟡 ดูได้ · งานเขียนยังทำที่ ZORT — จอที่งานจริงคือการสร้าง/บันทึกเอกสาร
//                จนกว่าด่าน "ดันสต็อกกลับ 3 แพลตฟอร์ม + สะพาน PEAK" จะผ่าน
//
// ⚠️ จอที่ **ไม่อยู่ในทะเบียน = ไม่มีป้าย** โดยตั้งใจ — เป็นเครื่องมือของเราเองที่ ZORT
//    ไม่เคยมี (บิล/เว็บไซต์/โอนสินค้า/ดรอปชิปปิ้ง ฯลฯ) ป้าย ZORT บนจอพวกนั้นคือ noise
// ⚠️ จอ soon/ทำไม่ได้ มีป้ายของตัวเองอยู่แล้ว (จาง + หน้า soon) — ไม่ใส่ซ้ำ
// ⚠️ **ห้ามพิมพ์ข้อความป้ายกระจายรายจอ** — จอ/เมนูอ่านจากไฟล์นี้เท่านั้น
//    วันสับสวิตช์ (เขียนที่เราเป็นหลัก) แก้สถานะที่นี่ไฟล์เดียว ทุกจอเปลี่ยนพร้อมกัน

export type ZortReady = 'replace' | 'readonly'

export const READY_BADGE: Record<ZortReady, { dot: string; text: string; tone: 'green' | 'amber' }> = {
  replace: { dot: '🟢', text: 'ใช้แทน ZORT ได้เลย', tone: 'green' },
  readonly: { dot: '🟡', text: 'ดูได้ · งานเขียนยังทำที่ ZORT', tone: 'amber' },
}

/** เส้นทาง → สถานะ (เทียบตรงตัวก่อน แล้วค่อยลองตัดท้าย /xxx ทีละชั้น — ดู zortReadyOf) */
export const ZORT_READY: Record<string, ZortReady> = {
  // ── รายงาน — ดู/ตรวจล้วน ──
  '/': 'replace',
  '/sales': 'replace',
  '/core/buy-report': 'replace',
  '/core/reports': 'replace',
  '/core/customer-report': 'replace',

  // ── รายการขาย ──
  '/core/pos': 'readonly', // สร้างใบขายมือ — เอกสารจริงยังต้องเกิดที่ ZORT
  '/core/sales': 'replace',
  '/core/sales/detail': 'replace',
  '/core/quotations': 'replace', // ดูรายการ
  /* คืนเป็น 'replace' แล้ว 9 ก.ย. 2569 บ่าย — ท่อแก้ที่ 6ab53c6 และ
     `node scripts/check-detail-live.mjs` ยืนยันของจริงว่าทั้ง 6 คู่พาไปถูกใบ
     (เคยลดเป็น readonly ครึ่งวันตอนท่อหยิบบรรทัดสินค้ามาเป็นหัวใบ) */
  '/core/quotations/detail': 'replace',
  '/core/transfers/detail': 'replace',
  '/core/return-orders/detail': 'replace',
  '/core/quotations/new': 'readonly', // ออกใบเสนอราคา = งานเอกสาร
  '/core/logistics': 'replace',
  '/core/return-orders': 'replace',
  '/returns': 'replace',
  /* จอรับคืนหน้าร้าน (ร่าง v2): เขียนเข้าระบบเรา แต่ใบคืนใน ZORT ยังทำมือตามเดิมช่วงเงา
     ⇒ 🟡 — ถ้าปล่อยให้ไหลตามป้ายแม่ (/returns เขียว) จะโกหกว่างานคืนจบที่นี่แล้ว */
  '/returns/receive': 'readonly',
  '/returns/inbox': 'readonly', // รายการใบคืนฝั่งเรา — ใบคืนใน ZORT ยังทำมือ ห้ามอ่านจอนี้ว่าครบ
  '/core/packing': 'replace',
  '/core/packing/pack': 'replace', // เช็คของก่อนปิดกล่อง — ไม่เขียนอะไร ใช้แทนได้เลย

  // ── รายการซื้อ ──
  '/core/purchases': 'replace',
  '/core/purchases/new': 'readonly',
  '/core/receive': 'readonly', // รับสินค้า — สต็อกจริงยังอยู่ ZORT ต้องบันทึกที่โน่นด้วย
  '/core/moves': 'readonly', // บันทึกของเข้า-ออกฝั่งเรา — ZORT ไม่รู้เรื่องด้วยจนกว่าสับสวิตช์

  // ── สินค้า — ดู/ตรวจ (สต็อกพิสูจน์ 2,672/2,672) ──
  '/core/stock': 'replace',
  '/core/stock/new': 'readonly', // เพิ่มสินค้า = งานเขียน
  '/core/bundles': 'replace',
  '/core/variants': 'replace',
  '/core/categories': 'replace',
  '/core/branches': 'replace',
  '/core/transfers': 'replace',
  '/core/missing-sku': 'replace',

  // ── ลูกค้า/คู่ค้า · ร้านค้าออนไลน์ ──
  '/core/customers': 'replace',
  '/core/marketplace': 'replace',
  '/core/marketplace-products': 'replace',
  '/core/channels': 'replace',

  // ── การเงิน — จอลิสต์อ่านอย่างเดียวทั้งชุด (ตรวจแล้วไม่มีปุ่มเขียน) ──
  '/core/finance': 'replace',
  '/core/other-income': 'replace',
  '/core/other-expense': 'replace',
  '/core/money-transfers': 'replace',
  '/core/peak': 'readonly', // ยอดขาย→PEAK ยังวิ่งผ่าน integration ของ ZORT รายวัน

  // ── เอกสาร · วางแผนธุรกิจ ──
  '/core/accounting-docs': 'replace',
  '/core/reorder': 'replace',
  '/core/leadtime': 'replace',

  // ── ตั้งค่า — จออ่านอย่างเดียวทั้งชุด ──
  '/core/settings-company': 'replace',
  '/core/settings-users': 'replace',
  '/core/settings-roles': 'replace',
  '/core/setting-notify': 'replace',
  '/core/settings-jobs': 'replace',
  '/core/settings-profile': 'replace',
  '/core/setting-sms': 'replace',
  '/core/setting-tracking': 'replace',
}

/** หา status ของ pathname — ตรงตัวก่อน แล้วตัดท้ายทีละชั้น (ให้ /core/sales/detail?x เจอด้วย) */
export function zortReadyOf(pathname: string): ZortReady | null {
  let p = pathname.replace(/\/+$/, '') || '/'
  while (p) {
    const hit = ZORT_READY[p]
    if (hit) return hit
    /* ⚠️ ตัดท้ายทีละชั้นแต่ **ห้ามไหลไปชน '/'** — ไม่งั้นทุกหน้านอกทะเบียน
       จะได้ป้ายของหน้าแรกไปเงียบ ๆ ('/' จับได้เฉพาะเทียบตรงตัวรอบแรกเท่านั้น) */
    const i = p.lastIndexOf('/')
    if (i <= 0) return null
    p = p.slice(0, i)
  }
  return null
}
