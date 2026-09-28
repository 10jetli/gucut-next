// ด่านพารามิเตอร์ของท่อ /api/returns — แยกออกจาก route.ts เพื่อให้ "เทสยิงตัวตัดสินตัวจริงได้"
//
// 🔴 **ที่มา 28 ก.ย. 2569 (ใบ B08)** — จอ `/returns` ("สินค้าที่ถูกคืนบ่อย") ยิง
//    `/api/returns?days=30` แล้วได้ **403 ทุกครั้งมา 21 วัน** · วัดจริงบนเครื่อง:
//    `HTTP 403 {"error":"ท่อนี้เปิดเฉพาะเส้นจอรับคืนสินค้า…"}`
//    เหตุ: คอมมิต 755a7f3 (7 ก.ย. 2569) เขียนท่อ whitelist ของ **จอรับคืนสินค้า**
//    ทับ path เดิมที่เคยเป็น **ท่อสรุปใบคืน** (เรียก computeReturns + แคช 6 ชม.)
//    ⇒ สองจอใช้ path เดียวกัน พอใส่ default-deny จอแรกตายเงียบ โดยไม่มีอะไรแดง
//    ⚠️ และตัวตัดสินอยู่ใน route.ts ⇒ **เทสเรียกมันไม่ได้** ⇒ ไม่มีด่านไหนฟ้องได้เลย
//
// 🔑 ย้ายมาที่นี่แล้ว `scripts/tests/returns-gate.test.mjs` กวาดทุกจุดในรีโปที่ยิง
//    `/api/returns?…` มาผ่านด่านตัวจริง — จอไหนถูกด่านของตัวเองปฏิเสธ ⇒ build ตก
//    (ไม่ใช่ตะแกรงคำ: มันเรียกฟังก์ชันเดียวกับที่ท่อใช้ตอนรับคำขอจริง)
//
// ⚠️ กติกา whitelist: เช็ค "พารามิเตอร์หลักหนึ่งตัวต่อคำขอ" ไม่ใช่เช็คว่าคำต้องห้ามไม่อยู่
//    (default-deny — พารามิเตอร์ที่ไม่รู้จัก = ปฏิเสธ ไม่ใช่ปล่อยผ่าน)

/** พารามิเตอร์หลักที่จอรับคืนใช้ — อย่างอื่นปฏิเสธทั้งหมด */
export const PRIMARY_GET = ['return', 'order', 'returnphoto'] as const
export const PRIMARY_POST = ['return-receive', 'return-grade', 'return-photo', 'return-takeover', 'return-cancel'] as const
/** พารามิเตอร์ประกอบที่ยอมให้ติดมา (ต่อเมื่อมีพารามิเตอร์หลักถูกต้องแล้ว) */
export const EXTRA_OK = new Set(['q', 'from', 'to', 'limit', 'list', 'i'])

/** ข้อความปฏิเสธ — **ที่เดียว** ทั้งท่อจริงและเทสอ้างอิงตัวนี้ */
export const เหตุไม่มีพารามิเตอร์หลัก =
  'ท่อนี้เปิดเฉพาะเส้นจอรับคืนสินค้า (และค้นใบขายต้องมีคำค้นอย่างน้อย 3 ตัว)'
export const เหตุพารามิเตอร์แปลกปลอม = (k: string) => `พารามิเตอร์ไม่รู้จัก: ${k}`

export function pickPrimary(u: URL, method: string): string | null {
  if (u.searchParams.get('list') === 'returns-inbox') return 'list=returns-inbox'
  if (method === 'GET' && u.searchParams.get('list') === 'orders') {
    const q = (u.searchParams.get('q') ?? '').trim()
    /* ค้นเท่านั้น ห้าม browse — คำค้นสั้น/ว่าง = เจอครึ่งร้าน */
    return q.length >= 3 ? 'list=orders' : null
  }
  const pool = method === 'POST' ? PRIMARY_POST : PRIMARY_GET
  for (const k of pool) if (u.searchParams.get(k)) return k
  return null
}

export type ผลด่าน = { ผ่าน: true; primary: string } | { ผ่าน: false; เหตุ: string }

/** ตัวตัดสินตัวจริงของท่อ — route.ts แค่แปลงผลนี้เป็น HTTP */
export function ตัดสินคำขอ(u: URL, method: string): ผลด่าน {
  const primary = pickPrimary(u, method)
  if (!primary) return { ผ่าน: false, เหตุ: เหตุไม่มีพารามิเตอร์หลัก }
  /* พารามิเตอร์แปลกปลอม = ปฏิเสธทั้งคำขอ — กันคนพ่วงเส้นอื่นมากับคำขอที่หน้าตาถูก */
  for (const k of Array.from(u.searchParams.keys())) {
    const known = (PRIMARY_GET as readonly string[]).includes(k)
      || (PRIMARY_POST as readonly string[]).includes(k) || EXTRA_OK.has(k)
    if (!known) return { ผ่าน: false, เหตุ: เหตุพารามิเตอร์แปลกปลอม(k) }
  }
  return { ผ่าน: true, primary }
}
