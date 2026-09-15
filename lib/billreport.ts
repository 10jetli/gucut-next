import { BILL_VENDORS, type BillVendorInfo } from '@/lib/vendors'
import { loadBillIndexBlobs, listVendorBlobNames } from '@/lib/billblobs'

// สรุปสถานะบิลรายเจ้า — **ที่เดียว** ใช้ทั้ง /api/bills/report (ทีม AI ใช้รหัส)
// และ /api/bills/status (หน้าเว็บใช้เซสชัน)
//
// 🔑 เขียนไว้ที่เดียวโดยตั้งใจ — รอบแรกเขียนตรรกะคัดซ้ำซ้ำกันสองที่
//    แล้วตัวเลขไม่ตรงกับที่จอโชว์ทันที (TikTok ส.ค. ได้ 9 ทั้งที่จอโชว์ 4)

export interface VendorBillStatus {
  id: string
  ชื่อ: string
  ลิงก์ต้นทาง: string | null
  ต้องมีทุกเดือน: boolean
  รวมทุกเดือน: number
  เดือน: Record<string, { จำนวน: number; ใบจริงที่อัปไว้: number; ไฟล์: string[] }>
  สแกนล่าสุด: string | null
  เจอบิลใหม่ล่าสุด: string | null
  อ่านไม่ได้?: string
}

/** หาเลขที่ใบจากชื่อไฟล์ — ใช้ตัดสินว่าสองไฟล์คือใบเดียวกัน */
const เลขที่ใบ = (n: string) =>
  (n.match(/(THTT\d{6,}|FBADS-[\d-]{6,}|IN-\d{6,}|INV[-_]?\d{6,})/i)?.[1] ?? '').toUpperCase()

export async function สรุปบิลรายเจ้า(vendor: BillVendorInfo): Promise<VendorBillStatus> {
  const ฐาน = {
    id: vendor.id,
    ชื่อ: vendor.name,
    ลิงก์ต้นทาง: vendor.portal ?? null,
    ต้องมีทุกเดือน: !!vendor.everyMonth,
  }
  try {
    const idx = await loadBillIndexBlobs(vendor.id)
    // ⚠️ ใช้ตัวอ่านแบบเบา — หน้านี้ไม่ต้องใช้ขนาดไฟล์
    //    ของเดิมขอ metadata ทีละไฟล์ ทำให้หน้า /bills รอ 8.9 วินาที
    const real = (await listVendorBlobNames(vendor.id).catch(() => []))
      .map(n => n.match(/^(\d{4}-\d{2})_REAL_(.+)$/))
      .filter(Boolean) as RegExpMatchArray[]

    const เดือน: VendorBillStatus['เดือน'] = {}
    const เห็นแล้ว = new Set<string>()

    /* 🔴 15 ก.ย. 2569 — ตัวคัดซ้ำรอบแรกเทียบแค่ "ใบจริง vs บิลจากเมล"
       **ไม่เคยเทียบใบจริงด้วยกันเอง** ⇒ TikTok ส.ค. ยังได้ 8 ใบทั้งที่มี 4
       เหตุ: ใบเดียวกันถูกอัปเป็น "ใบจริง" สองครั้งคนละชื่อ
             THTT202606634060-บริษัท ศีตกาล เทรดดิ้ง จำกัด-Invoice.pdf   (ตัวเก็บบน g1)
             TikTok-Invoice-THTT202606634060.pdf                        (ไฟล์แนบในเมล)
       🔑 จับได้เพราะยิงของจริงแล้วเลขไม่ตรงกับที่ควรเป็น — ไม่ใช่จากการอ่านโค้ด
       ⚠️ เก็บไฟล์ในถังไว้ทั้งคู่ **ไม่ลบ** (ของภาษี) — คัดที่ชั้นแสดงผลเท่านั้น */
    const เก็บใบจริง = new Map<string, RegExpMatchArray>()
    const ใบจริงไม่มีเลข: RegExpMatchArray[] = []
    for (const m of [...real].sort((a, b) => a[2].localeCompare(b[2]))) {
      const no = เลขที่ใบ(m[2])
      if (!no) { ใบจริงไม่มีเลข.push(m); continue }
      const k = m[1] + '|' + no
      if (!เก็บใบจริง.has(k)) เก็บใบจริง.set(k, m)
    }
    for (const m of [...Array.from(เก็บใบจริง.values()), ...ใบจริงไม่มีเลข]) {
      const b = (เดือน[m[1]] ??= { จำนวน: 0, ใบจริงที่อัปไว้: 0, ไฟล์: [] })
      b.ไฟล์.push(m[2]); b.จำนวน++; b.ใบจริงที่อัปไว้++
      const no = เลขที่ใบ(m[2]); if (no) เห็นแล้ว.add(no)
    }

    // ⚠️ ใบที่ระบบสร้างเอง (GEN) ไม่มีเลขที่ใบในชื่อ ⇒ ตัวคัดซ้ำจับไม่ได้
    //    ต้องใช้กติกาเดียวกับจอ: เดือนไหนมีใบจริง ให้ตัด GEN ในเดือนนั้นทิ้งทั้งหมด
    const เดือนที่มีใบจริง = new Set(real.map(m => m[1]))
    for (const e of idx?.entries ?? []) {
      if (e.attachmentId === 'GEN' && เดือนที่มีใบจริง.has(e.month)) continue
      const no = เลขที่ใบ(e.filename)
      if (no && เห็นแล้ว.has(no)) continue
      if (no) เห็นแล้ว.add(no)
      const b = (เดือน[e.month] ??= { จำนวน: 0, ใบจริงที่อัปไว้: 0, ไฟล์: [] })
      b.ไฟล์.push(e.filename); b.จำนวน++
    }

    return {
      ...ฐาน,
      รวมทุกเดือน: Object.values(เดือน).reduce((a, b) => a + b.จำนวน, 0),
      เดือน: Object.fromEntries(Object.entries(เดือน).sort(([a], [b]) => b.localeCompare(a))),
      สแกนล่าสุด: idx?.lastScan ?? null,
      เจอบิลใหม่ล่าสุด: (idx as any)?.lastNew ?? null,
    }
  } catch (e: any) {
    // 🔑 แยก "อ่านไม่ได้" ออกจาก "ไม่มีบิล" — ห้ามยุบเป็น 0
    return { ...ฐาน, รวมทุกเดือน: 0, เดือน: {}, สแกนล่าสุด: null, เจอบิลใหม่ล่าสุด: null,
             อ่านไม่ได้: String(e?.message ?? e).slice(0, 120) }
  }
}

export async function สรุปทุกเจ้า(only?: string | null): Promise<VendorBillStatus[]> {
  const list = only ? BILL_VENDORS.filter(v => v.id === only) : BILL_VENDORS
  return Promise.all(list.map(สรุปบิลรายเจ้า))
}
