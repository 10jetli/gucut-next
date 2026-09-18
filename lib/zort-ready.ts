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
  /* 🔴 **เพิ่มบรรทัดนี้ 18 ก.ย. 2569 — เดิมไม่มี ⇒ ป้ายตกทอดมาจาก `/core/sales` (replace 🟢)**
     จอนี้เปิดปุ่มส่งจริงแล้ว (ท่านประธานอนุมัติ · ใบ t_mu6kxfbn) ⇒ มันเขียนใบขายเข้า ZORT จริง
     ⚠️ **ตั้งค่าเท่าที่จอแสดงอยู่แล้ววันนี้ ไม่เปลี่ยนสิ่งที่คนเห็น** — ตั้งใจให้เป็น "จดสิ่งที่เป็นอยู่"
        ไม่ใช่ตัดสินนโยบายเอง · คำถามว่าควรเป็น 🟢 หรือ 🟡 ส่งให้ CEO แล้ว 18 ก.ย. 2569
     🔴 และคำถามนั้นไม่ใช่เรื่องสวยงาม: ป้าย 🟡 เขียนว่า "งานเขียนยังทำที่ ZORT"
        ซึ่งบนจอที่ส่งจริงได้แล้ว **แปลว่าให้ไปทำซ้ำที่ ZORT อีกรอบ** ⇒ เสี่ยงได้เอกสารสองใบ
        (โรคเดียวกับที่จอ POS เตือนเรื่องเปิดใบซ้ำในแอป ZORT) */
  /* 🔴 **เปลี่ยนเป็น readonly 18 ก.ย. 2569 — CEO ตัดสินใหม่หลังผมทักกลับ**
     ตอนแรกผมจดเป็น 'replace' เพราะเป็นค่าที่จอแสดงอยู่แล้ว (จดสิ่งที่เป็นอยู่ ไม่แอบเปลี่ยนนโยบาย)
     แต่พอมันกลายเป็น **การเลือก** มันขัดกับเหตุผลที่ CEO ใช้ตัดสินเรื่องป้ายเอง
     และของจริงหนักกว่าอีกสามจอ ไม่ใช่เบากว่า:
       ① ใบขาย **ลดสต็อก** ⇒ ต้องดันกลับมาร์เก็ตเพลส · วันนี้สวิตช์ Shopee/TikTok **ยังปิดอยู่**
          ⇒ เปิดใบที่จอเราตอนนี้ สต็อกบนสองเจ้านั้นไม่ขยับเลย ⇒ **ขายเกินสต็อกได้จริง**
       ② ยอดขายต้องเข้า PEAK (บัญชี/ภาษี) ⇒ สะพานยังไม่มี ⇒ ใบที่เปิดที่นี่ยังไม่เข้าบัญชี
       ③ เอกสารซ้ำที่จอนี้แพงที่สุด เพราะตัดสต็อกสองรอบ
     ⇒ 🟢 ที่จอนี้ **ผิดที่สุดในทะเบียนทั้งแผง** ไม่ใช่ข้อยกเว้นที่ยอมรับได้ */
  '/core/sales/new': 'readonly',
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

/* ── 🔴 ป้ายที่ตอบคำถามจริงของคนหน้าจอ: "ฉันต้องไปทำซ้ำที่ ZORT ไหม" (18 ก.ย. 2569) ──
 *
 * **ที่มา**: เปิดจอจริงแล้วพบว่าจอที่เปิดปุ่มส่งจริงแล้วสามจอยังติดป้าย
 * "งานเขียนยังทำที่ ZORT" ⇒ อ่านได้ว่า **ให้ไปทำซ้ำที่ ZORT อีกรอบ**
 * ⇒ เสี่ยงได้เอกสารสองใบสำหรับงานครั้งเดียว (โรคเดียวกับที่จอ POS เตือนไว้เอง)
 *
 * CEO ตัดสิน 18 ก.ย. 2569: **แก้ข้อความ ไม่เปลี่ยนป้าย ไม่เพิ่มป้ายที่เจ็ด**
 *   🚫 ไม่เปลี่ยนเป็น 🟢 เพราะทิศความผิดแพงกว่า: 🟡 ผิด = ทำงานซ้ำ · 🟢 ผิด = **งานหาย**
 *      (คนเลิกเปิด ZORT ทั้งที่ยังต้องเปิด เพราะดันสต็อก + สะพาน PEAK ยังไม่ผ่าน)
 *   🚫 ไม่เพิ่มป้ายที่เจ็ด เพราะปัญหาไม่ได้เกิดจาก "ป้ายไม่พอ"
 *      แต่เกิดจาก **ข้อความในป้ายสั่งให้ลงมือผิด** ⇒ แก้ที่ข้อความคือแก้ตรงต้นเหตุ
 *
 * สามส่วนที่ห้ามขาด (CEO กำหนด):
 *   ① เปิดได้จริง — ตัดความลังเล ("ไม่ชวนทำซ้ำ" ต่างจาก "ห้ามทำซ้ำ"
 *      คนที่ไม่แน่ใจจะเลือกทางที่รู้สึกปลอดภัยกว่าเสมอ = ไปเปิดที่ ZORT ด้วย)
 *   ② ห้ามเปิดซ้ำ **พร้อมบอกผลถ้าทำ** — ใช้ถ้อยคำเดียวกับจอ POS ⇒ คนเจอคำเดียวกันทั้งระบบ
 *   ③ ยังไม่ครบกระบวนการ **พร้อมบอกว่าขาดอะไร** — ให้รู้ว่าทำไมยังไม่ 🟢
 *
 * ⚠️ **คิดจากข้อมูล ไม่พิมพ์รายจอ** — "จอนี้ส่งจริงได้ไหม" อ่านจากผลสแกน `REAL_SEND_ENABLED`
 *    ที่ scripts/gen-arch.mjs เขียนไว้ตอน build ⇒ วันที่ท่านประธานเปิด/ปิดปุ่มจอไหน
 *    ข้อความเปลี่ยนเอง · และวันที่ดันสต็อก+PEAK ผ่าน แก้ป้ายที่ทะเบียนที่เดียวแล้วหายทุกจอ
 *    (ไม่งั้นจะได้คำเตือนหมดอายุกระจายสามจอ ซึ่งเป็นโรคที่ไล่กันมาทั้งวัน) */
import { ARCH_ADMIN } from './arch-admin'

/** จอที่เอกสารของมัน **ทำให้สต็อกขยับ** ⇒ ต้องเตือนเพิ่มว่าสวิตช์ดันสต็อกเจ้าไหนยังปิด
 *  ⚠️ เตือนเฉพาะจอพวกนี้ ไม่ใช่ทุกจอ — จอที่ไม่ขยับสต็อก (ใบเสนอราคา) เตือนไปก็เป็นเสียงรบกวน
 *  🔑 ข้อความส่วนนั้นคิดจาก `autoOn` ที่ท่อส่งมา ⇒ วันที่ท่านประธานสั่งเปิดสวิตช์ **มันหายเอง** */
export const กระทบสต็อก = new Set(['/core/sales/new'])

/** จอนี้ **เปิดปุ่มส่งจริงอยู่ไหม** ตามผลสแกนซอร์สตอน build — ไม่รู้ = false (ไม่ไปสัญญาแทน) */
export function ส่งจริงได้(pathname: string): boolean {
  const list = (ARCH_ADMIN as unknown as { realSend?: { screens?: { path: string; open: boolean }[] } }).realSend?.screens
  if (!Array.isArray(list)) return false
  const p = pathname.replace(/\/+$/, '') || '/'
  return list.some((r) => {
    if (!r.open) return false
    if (r.path === p) return true
    /* เส้นทางพลวัต (`/core/stock/[sku]/edit`) — เทียบเป็นแบบแผน ไม่ใช่สตริงตรง ๆ */
    if (!r.path.includes('[')) return false
    const re = new RegExp('^' + r.path.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '$')
    return re.test(p)
  })
}

/** ข้อความป้ายของเส้นทางนี้ — **จุดเดียวที่ประกอบถ้อยคำ** ทุกที่ที่แสดงป้ายต้องเรียกตัวนี้ */
export function ป้ายของเส้นทาง(pathname: string): { dot: string; tone: 'green' | 'amber'; หัว: string; ท้าย: string } | null {
  const status = zortReadyOf(pathname)
  if (!status) return null
  const b = READY_BADGE[status]
  if (status === 'readonly' && ส่งจริงได้(pathname)) {
    return {
      dot: b.dot, tone: b.tone,
      หัว: 'เปิดเอกสารที่จอนี้ได้จริง — ห้ามเปิดใบเดิมซ้ำในแอป ZORT จะได้เอกสารสองใบ',
      ท้าย: 'ยังไม่ครบกระบวนการ: รอดันสต็อกกลับมาร์เก็ตเพลส + สะพาน PEAK',
    }
  }
  return {
    dot: b.dot, tone: b.tone, หัว: b.text,
    ท้าย: status === 'readonly' ? 'จนกว่าด่านดันสต็อก 3 แพลตฟอร์ม + สะพาน PEAK จะผ่าน' : '',
  }
}
