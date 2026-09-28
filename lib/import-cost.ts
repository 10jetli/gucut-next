// คิดต้นทุนสินค้านำเข้าจากจีนถึงหน้าร้าน
//
// เจ้าของร้านเลือกร้านและเลือกสินค้าเองจาก Taobao/1688 (ไม่ได้ให้ระบบไปดูดข้อมูล)
// หน้าที่ของไฟล์นี้คือตอบคำถามเดียว: "ของชิ้นนี้เอาเข้ามาขายแล้วคุ้มไหม"
//
// ⚠️ ค่าขนส่งจีน→ไทย คิดแบบ "น้ำหนัก หรือ ปริมาตร อันไหนแพงกว่าเอาอันนั้น"
//    ไม่ใช่บวกกัน และไม่ใช่คิดแต่น้ำหนักอย่างเดียว
//    ของเบาแต่กล่องใหญ่ (เช่น กรองอากาศ ฝาครอบ) จะโดนคิดตามคิวเสมอ
//    คนที่คิดแต่กิโลจะประเมินต้นทุนต่ำกว่าจริงมาก แล้วตั้งราคาขาดทุนโดยไม่รู้ตัว
//
// ⚠️ เรทเงินหยวนต้องกรอกเอง ห้ามดึงเรทธนาคารมาใช้
//    ชิปปิ้งแต่ละเจ้าใช้เรทของตัวเอง (มักสูงกว่าเรทกลาง 0.1-0.3 บาท)
//    ดึงเรทกลางมาใส่ = ตัวเลขสวยกว่าความจริงทุกครั้ง

export interface ImportSettings {
  /** บาทต่อ 1 หยวน — ใช้เรทที่ชิปปิ้งคิดจริง ไม่ใช่เรทธนาคาร */
  rate: number
  /** ค่าขนส่งตามน้ำหนัก บาท/กก. */
  perKg: number
  /** ค่าขนส่งตามปริมาตร บาท/คิว (คิว = ลูกบาศก์เมตร) */
  perCbm: number
  /** ค่าดำเนินการต่อชิ้น เช่น ค่าแพ็ค ค่าตรวจ ค่าโอน */
  handling: number
  /** กำไรขั้นต่ำที่ยอมรับได้ (%) — ต่ำกว่านี้ถือว่าไม่คุ้ม */
  minMargin: number
}

/* 🔑 **ช่วงที่รับได้ของแต่ละค่า — ประกาศที่เดียว** (28 ก.ย. 2569)
   เดิมเลขเหล่านี้อยู่ใน `app/api/import/route.ts` อย่างเดียว และเพดานกำไร (90) ถูกพิมพ์ไว้
   สองที่: ที่ API และที่สูตรราคาแนะนำในไฟล์นี้ ⇒ ขยายข้างเดียวได้เงียบ ๆ แล้วจอจะแนะนำราคา
   พร้อมติดป้ายว่า "ไม่คุ้ม" ในเวลาเดียวกัน ⇒ ย้ายมาที่เดียวและให้สูตรอ่านจากตารางนี้
   ⚠️ เหตุผลของแต่ละช่วงเขียนกำกับไว้ เพราะเลขเปล่า ๆ จะถูกแก้โดยไม่มีใครรู้ว่ามันกันอะไร */
export const SETTING_RANGE: Record<keyof ImportSettings, { lo: number; hi: number; เหตุ: string }> = {
  /* เรทจริงแกว่งราว 4.8-5.4 ⇒ ต่ำกว่า 3 หรือสูงกว่า 8 คือกรอกผิดแน่ ๆ */
  rate: { lo: 3, hi: 8, เหตุ: 'เรทชิปปิ้งจริงแกว่งราว 4.8-5.4 บาท/หยวน' },
  perKg: { lo: 0, hi: 1000, เหตุ: 'ค่าขนส่งต่อกิโล' },
  perCbm: { lo: 0, hi: 100000, เหตุ: 'ค่าขนส่งต่อคิว' },
  handling: { lo: 0, hi: 10000, เหตุ: 'ค่าดำเนินการต่อชิ้น' },
  /* 🔴 เพดาน 90 ไม่ใช่ตัวเลขสวย ๆ — กำไร 100% ของราคาขายหมายถึงต้นทุนเป็นศูนย์
     สูตรราคาแนะนำหารด้วย (1 − กำไร) ⇒ ที่ 100% จะหารศูนย์ · ที่ 95% ราคาจะพุ่งจนไร้ความหมาย */
  minMargin: { lo: 0, hi: 90, เหตุ: 'สูตรราคาแนะนำหารด้วย (1 − กำไร) ⇒ เกิน 90% ราคาพุ่งจนใช้ไม่ได้' },
}

export const DEFAULT_SETTINGS: ImportSettings = {
  rate: 5.05,
  perKg: 45,
  perCbm: 7500,
  handling: 20,
  minMargin: 35,
}

export interface ImportItem {
  id: string
  name: string
  /** ลิงก์ Taobao/1688 — เก็บไว้เฉย ๆ ให้กดกลับไปดูได้ ระบบไม่ได้เข้าไปอ่าน */
  url?: string
  /** ราคาต่อชิ้นเป็นหยวน */
  yuan: number
  qty: number
  /** น้ำหนักต่อชิ้น กก. */
  kg: number
  /** ปริมาตรต่อชิ้น คิว — ไม่รู้ก็ใส่ 0 แล้วจะคิดตามน้ำหนักอย่างเดียว */
  cbm: number
  /** SKU ของเดิมในคลัง ถ้าเป็นของที่เคยขายอยู่แล้ว */
  sku?: string
  /** ราคาที่ตั้งใจจะขาย — เว้นว่างให้ระบบแนะนำให้ */
  sell?: number
  note?: string
  at: number
}

export interface CostBreakdown {
  goods: number      // ค่าสินค้า/ชิ้น (บาท)
  freight: number    // ค่าขนส่ง/ชิ้น (บาท)
  byWeight: number   // ถ้าคิดตามน้ำหนักจะเป็นเท่านี้
  byVolume: number   // ถ้าคิดตามคิวจะเป็นเท่านี้
  charged: 'น้ำหนัก' | 'ปริมาตร'
  handling: number
  landed: number     // ต้นทุนถึงมือ/ชิ้น
  total: number      // ต้นทุนรวมทั้งล็อต
  suggestSell: number
  margin: number | null    // % กำไรถ้าขายตามราคาที่ตั้งไว้
  worth: boolean | null    // คุ้มไหมเทียบกับกำไรขั้นต่ำ
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function costOf(item: ImportItem, s: ImportSettings): CostBreakdown {
  const qty = Math.max(1, item.qty || 1)
  const goods = r2((item.yuan || 0) * (s.rate || 0))

  // ⚠️ เอาอันที่แพงกว่า ไม่ใช่บวกกัน — เป็นวิธีที่ชิปปิ้งคิดจริง
  const byWeight = r2((item.kg || 0) * (s.perKg || 0))
  const byVolume = r2((item.cbm || 0) * (s.perCbm || 0))
  const freight = Math.max(byWeight, byVolume)

  const handling = s.handling || 0
  const landed = r2(goods + freight + handling)

  // ราคาแนะนำ = ต้นทุน ÷ (1 − กำไรที่ต้องการ) — คิดจาก "ราคาขาย" ไม่ใช่บวกจากต้นทุน
  // ⚠️ บวก 35% จากต้นทุนได้กำไรแค่ 26% ของราคาขาย คนละเลขกัน พลาดกันบ่อยมาก
  const m = Math.min(SETTING_RANGE.minMargin.hi, Math.max(SETTING_RANGE.minMargin.lo, s.minMargin || 0)) / 100
  const suggestSell = Math.ceil(landed / (1 - m) / 10) * 10

  const sell = Number(item.sell) || 0
  const margin = sell > 0 ? r2(((sell - landed) / sell) * 100) : null

  return {
    goods,
    freight,
    byWeight,
    byVolume,
    charged: byVolume > byWeight ? 'ปริมาตร' : 'น้ำหนัก',
    handling,
    landed,
    total: r2(landed * qty),
    suggestSell,
    margin,
    worth: margin === null ? null : margin >= (s.minMargin || 0),
  }
}

/** ค่าที่ผู้ใช้กรอกแล้วระบบไม่รับ — ต้องบอกบนจอ ไม่ใช่กลับไปใช้ค่าเดิมเงียบ ๆ */
export interface SettingReject {
  ช่อง: keyof ImportSettings
  ที่กรอก: unknown
  ต่ำสุด: number
  สูงสุด: number
  เหตุ: string
  ใช้ค่าเดิม: number
}

/* 🔴 **ที่มา (28 ก.ย. 2569)**: ตัวรับค่าเดิมเขียนว่า `num(v, def, lo, hi)` — เกินช่วง ⇒ คืนค่าเดิม
   ⇒ พิมพ์กำไรขั้นต่ำ 95% แล้วกด "บันทึกค่า" จะ **ไม่มีอะไรเกิดขึ้นและไม่มีอะไรบอก**
     ช่องกรอกยังโชว์ 95 (เพราะเป็น defaultValue) แต่ค่าที่เก็บจริงยังเป็นของเดิม
   ⇒ คนใช้เชื่อว่าตั้งค่าแล้ว แล้วตัดสินใจราคาจากเกณฑ์ที่ไม่มีอยู่จริง
   = คลาส "ระบบทำงานถูก แต่สื่อสารผิด" ตรงตามที่ CLAUDE.md เรียกว่าโรคประจำวัน
   🔑 ฟังก์ชันนี้จึงคืน **ทั้งค่าที่จะเก็บ และรายการที่ถูกปฏิเสธ** ให้ผู้เรียกเอาไปบอกบนจอ
   ⚠️ "ไม่ได้กรอกมา" ≠ "กรอกแล้วไม่ผ่าน" — อย่างแรกไม่ใช่การปฏิเสธ ห้ามรายงาน */
export function applySettings(
  inp: Partial<Record<keyof ImportSettings, unknown>> | null | undefined,
  cur: ImportSettings,
): { next: ImportSettings; rejected: SettingReject[] } {
  const next = { ...cur }
  const rejected: SettingReject[] = []
  for (const ช่อง of Object.keys(SETTING_RANGE) as (keyof ImportSettings)[]) {
    const ดิบ = inp?.[ช่อง]
    if (ดิบ === undefined || ดิบ === null || ดิบ === '') continue   // ไม่ได้กรอกมา ⇒ คงของเดิม เงียบได้
    const { lo, hi, เหตุ } = SETTING_RANGE[ช่อง]
    const n = Number(ดิบ)
    if (Number.isFinite(n) && n >= lo && n <= hi) { next[ช่อง] = n; continue }
    rejected.push({ ช่อง, ที่กรอก: ดิบ, ต่ำสุด: lo, สูงสุด: hi, เหตุ, ใช้ค่าเดิม: cur[ช่อง] })
  }
  return { next, rejected }
}
