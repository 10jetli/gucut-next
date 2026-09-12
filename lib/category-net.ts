// ── ตาข่ายข้ามแหล่งของจอหมวดสินค้า — **ตัวหารมาจาก ZORT ไม่ใช่จากกองของเราเอง** ──────
//
// 🔴 ของเดิมในจอเป็น tautology: เทียบ "ผลบวก skus ที่จอบวกเอง" กับ `total` ของท่อ
//    ซึ่ง `total` ของท่อ **คือผลบวกของแถวชุดเดียวกันนั้นเอง** (netlify/lib/pos.mjs)
//    ⇒ เขียวตลอดกาล · และคอมเมนต์เรียกตัวเองว่า "ตาข่ายข้ามแหล่ง" ⇒ คนอ่านรอบหน้า
//      เห็นว่ามีตาข่ายแล้วจึงไม่สร้างของจริง — อันตรายกว่าไม่มีตาข่ายเลย
//
// ⚠️ **วัดก่อนตั้งเกณฑ์** (12 ก.ย. 2569): ผลบวกหมวด 2,672 · ZORT มี 2,898 · ไม่มีรหัส 226
//    ⇒ 2,672 + 226 = 2,898 **ลงตัวพอดี** ⇒ เกณฑ์จึงไม่ใช่ "ต้องเท่ากันเฉย ๆ"
//      แต่เป็น "ผลบวกหมวด + ตัวที่ ZORT บอกว่าไม่มีรหัส = จำนวนที่ ZORT มี"
//    🚫 ไม่ตั้งค่าเผื่อลอย ๆ — ยอมรับส่วนต่าง **เฉพาะจำนวนที่ ZORT ยืนยันเองว่าไม่มีรหัส**
//      (สินค้าไม่มีรหัส = จับคู่เข้าคลังเงาไม่ได้ · เหตุผลเต็มอยู่ที่ netlify/lib/core-products.mjs)
//    ⚠️ ถ้าบังคับให้เท่ากันเฉย ๆ จะได้ตาข่ายที่ **แดงตลอดกาล** ซึ่งแย่พอกับเขียวตลอดกาล
//      เพราะสุดท้ายคนจะปิดมันทิ้ง (CEO เตือนข้อนี้ก่อนลงมือ)
//
// 🔑 สินค้าหนึ่งตัวอยู่ได้หมวดเดียว (คอลัมน์ category เดียว) และตัวที่ยังไม่จัดหมวด
//    ถูกนับในถัง "(ยังไม่ได้จัดหมวดใน ZORT)" ⇒ ผลบวกหมวดครอบสินค้าในคลังเงาทุกตัวจริง

export interface CategoryCoverage {
  /** 'ok' ครบ · 'gap' ไม่ครบ · 'unknown' **ยังตรวจไม่ได้** (ห้ามตีเป็นผ่าน) */
  state: 'ok' | 'gap' | 'unknown'
  /** ขาดไปกี่รหัส (บวก = คลังเงาขาด · ลบ = เรามีเกินกว่าที่ ZORT บอก) */
  gap: number | null
  sumSkus: number
  zortTotal: number | null
  noSkuInZort: number | null
}

export function categoryCoverage(input: {
  sumSkus: number
  zortTotal?: number | null
  noSkuInZort?: number | null
}): CategoryCoverage {
  const sum = Number(input.sumSkus)
  const zortTotal = typeof input.zortTotal === 'number' && Number.isFinite(input.zortTotal) ? input.zortTotal : null
  /* ⚠️ ZORT ต้องบอกทั้งสองตัว — รู้ยอดรวมแต่ไม่รู้จำนวนที่ไม่มีรหัส ยังเทียบไม่ได้
     (เติม 0 แทนก็เท่ากับเดาว่าไม่มีสินค้าไร้รหัสเลย ซึ่งของจริงมี 226 ตัว) */
  const noSku = typeof input.noSkuInZort === 'number' && Number.isFinite(input.noSkuInZort) ? input.noSkuInZort : null
  if (!Number.isFinite(sum) || zortTotal === null || noSku === null) {
    return { state: 'unknown', gap: null, sumSkus: sum, zortTotal, noSkuInZort: noSku }
  }
  const gap = zortTotal - (sum + noSku)
  return { state: gap === 0 ? 'ok' : 'gap', gap, sumSkus: sum, zortTotal, noSkuInZort: noSku }
}
