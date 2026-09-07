// 📄 สัญญาข้อมูลจอรับคืนสินค้า — **ร่างเสนอจากฝั่งจอ รอฝั่งท่อยืนยัน (7 ก.ย. 2569 ดึก)**
//
// ⚠️ **ไฟล์นี้คือที่เดียวที่จอคุยกับท่อเรื่องใบคืน** — ชื่อคีย์/รูปคำตอบทั้งหมดอยู่ที่นี่
//    ฝั่งท่อยืนยันสัญญาเมื่อไหร่ ถ้าต่างจากนี้แก้ไฟล์เดียว จอทุกตัวเปลี่ยนตาม
//    (กันโรค "จอเดาชื่อคีย์" ที่เพิ่งเจอใน settings-company — คราวนี้ประกาศร่างก่อนเขียนจอ)
//
// ที่มาของทุกช่อง: ร่างสุดท้าย /returns v2 + ผลเวทีถก #2 (ล็อก) #3-#4 (ตัววัด)
//   ~/claude-shared/debate/returns-ร่างสุดท้าย.md · lock-returns-ข้อสรุป.md · outside-leg-ข้อสรุป.md
//
// 🔴 กติกาที่สัญญานี้ต้องรองรับ (จากสามเวที):
//   - state machine เดินหน้าอย่างเดียว: received → graded → moved (+ cancelled)
//   - returnId ออกโดยเซิร์ฟเวอร์ · ทุก POST ผูก idempotency กับ returnId+ขั้น
//   - ล็อกที่ orderId ฝั่งเซิร์ฟเวอร์ · คนมาทีหลังอ่านได้แต่กดไม่ได้ · takeover ต้องเลือกเหตุผล
//   - unmatched (หาใบไม่เจอ): รับได้ ค้างขั้นรับ ไม่เข้าสต็อกจนแอดมินผูก/อนุมัติ
//   - รูป: ยืนยันอัปโหลดสำเร็จก่อนเปลี่ยนสถานะ · upload_failed ≠ ไม่มีรูป
//   - ตัวเลขที่ใช้ตัดสินพก observed_at/source/scope/fresh_until · ไม่มีเรคคอร์ด = UNKNOWN

/* move_failed (รีวิวท่อ 7 ก.ย. ดึก): ประเมินครบ · ยิง move แล้ว · **ยังลงไม่ครบทุกชิ้น**
   ยิงซ้ำปลอดภัย (UNIQUE ref ทำให้ชิ้นที่ลงแล้วตอบ duplicate) · `moved` ออกได้ต่อเมื่อ
   ทุกชิ้นมี moveResult เท่านั้น — ไม่มีสถานะนี้ = moved โกหกตอนยิง 5 สำเร็จ 3 */
export type ReturnState = 'received' | 'graded' | 'move_failed' | 'moved' | 'cancelled'
export type Verdict = 'return_in' | 'damage'

export interface ReturnItem {
  sku: string
  name?: string
  qty: number
  /** คำตัดสินต่อชิ้น — มีเฉพาะเมื่อ graded แล้ว */
  verdict?: Verdict
  note?: string
  /** ผล move ต่อชิ้น (ขั้น moved) — added | duplicate · ไม่มี = ยังไม่ถึงขั้นนั้น */
  moveResult?: 'added' | 'duplicate'
}

export interface ReturnDoc {
  returnId: string
  /** ref ที่ใช้กับ move API: RT-<เลขใบขาย> · RT-U<เลขใบรับ> (unmatched) · RT-<ใบขาย>-2 (รอบสอง) */
  ref: string
  state: ReturnState
  unmatched: boolean
  /** เลขกักติดของจริงของกอง unmatched — จากเวที #4 (เลขเรียงลำดับ ช่องว่างประกาศตัวเอง) */
  quarantineNo?: string
  orderId?: string
  orderNumber?: string
  customer?: string
  /** ใครถือใบอยู่ (ล็อก) — ไม่มี = ไม่มีใครถือ */
  lockedBy?: string
  lockSince?: string
  /** ใครรับ/สร้างใบ · เวลาเซิร์ฟเวอร์ (UTC — จอแปลงไทยตอนวาด) */
  staff?: string
  createdAt?: string
  lastActivityAt?: string
  items: ReturnItem[]
  /** ประวัติการรับช่วง — ข้อสังเคราะห์เวที #2: "ทุกการรับช่วงโผล่บนจอแอดมินเป็นรายการแยก"
   *  (ส่วนเสริมหลังรีวิวท่อรอบแรก — แจ้งท่อแล้ว 7 ก.ย. ดึก) */
  takeovers?: Array<{ at: string; from?: string; to?: string; reason: string; note?: string }>
  photoCount?: number
  /** เหตุผลตอนถ่ายรูปไม่ได้ — มี = ใบนี้ไม่มีรูปโดยแจ้งเหตุ ไม่ใช่รูปหาย */
  noPhotoReason?: string
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

/** ใบถูกคนอื่นถือ — grade/photo/cancel ตอบก้อนนี้แทนผลงาน (e6c9087: lockBlock ทั้งคลาส)
 *  🔴 `blocked` คือฟิลด์ตัดสินใจ — ไม่ใช้ error เพราะ error โดน throw แล้ว lockedBy หายไปกับ Error
 *  ไม่มี state/items ติดกลับมาโดยตั้งใจ (กันจอเผลออ่านว่าสำเร็จ) */
export interface LockBlock {
  blocked?: boolean
  lockedBy?: string
  lockSince?: string
}

/* ── คำตอบมาตรฐาน — ทุก endpoint ตอบ error/skip แบบเดียวกับ /api/core เส้นอื่น ── */
interface BaseResp { error?: string; skip?: string }

export interface InboxResp extends BaseResp {
  /** ช่องที่ q ค้นจริง — มาจากรายการเดียวกับ WHERE ฝั่งท่อ ใครแก้ช่องค้น จอรู้ทันที */
  qFields?: string[]
  rows?: ReturnDoc[]
  total?: number
  /** heartbeat ของ job recon ใบคืน (เวที #4) — ไม่มี/เก่าเกิน = จอต้องบอกว่าตัววัดตาบอดอยู่ */
  reconHeartbeatAt?: string
}

export interface ReceiveResp extends BaseResp {
  /** เซิร์ฟเวอร์เป็นคนออก returnId — จอห้ามตั้งเอง */
  returnId?: string
  ref?: string
  state?: ReturnState
  /** ใบนี้มีอยู่แล้ว (idempotent replay หรือใบค้างของใบขายเดียวกัน) — จอพาไป resume */
  existing?: boolean
  /** ใบขายถูกล็อกโดยคนอื่น */
  lockedBy?: string
  lockSince?: string
  /** คงเหลือคืนได้ต่อ SKU หลังหักทุกใบที่ยืนยันแล้ว (กันคืนสะสมเกิน — รู Codex #1) */
  remaining?: Record<string, number>
  /** ขอคืนเกินโควตาสะสม — **ไม่สร้างใบเลย** (กันใบทางตัน — เจอตอนประกบ 7 ก.ย. ดึก)
   *  ไม่เป็น error เพราะของอยู่ในมือพนักงานแล้ว ปฏิเสธความจริงไม่ได้ — จอต้องเสนอทางออก
   *  (รับเท่าที่คืนได้ · ส่วนเกินเปิดใบกักให้แอดมินสาง) · คีย์ใน over เป็นไทยตามท่อจริง */
  overQuota?: boolean
  over?: Array<{ sku: string; 'ขอคืน': number; 'คืนได้': number }>
  orderNumber?: string
}

export interface GradeResp extends BaseResp, LockBlock {
  returnId?: string
  /** moved = ทุกชิ้นมี moveResult · move_failed = ลงไม่ครบ จอชี้ชิ้นค้าง+ปุ่มยิงซ้ำ */
  state?: ReturnState
  items?: ReturnItem[]
  /** คงเหลือคืนได้ ณ เวลา grade — เซิร์ฟเวอร์คิดใหม่เสมอ ไม่ใช้ค่าตอน receive
   *  (ระหว่างใบค้าง คนอื่นอาจคืนใบขายเดียวกันจนหมด — ช่องที่ท่อจับได้ตอนรีวิว) */
  remaining?: Record<string, number>
}

/** ดึงใบเดียวตาม returnId — ใช้ resume หลังเน็ตหลุด/timeout (รู Codex #2) */
export interface GetReturnResp extends BaseResp {
  doc?: ReturnDoc
}

/* ═══ ตัวเรียก — ทุกตัวกันสามสถานะครบ: HTTP พัง · error/skip · รูปคำตอบไม่ครบ ═══ */

/* ── ตัวตนพนักงาน — PIN จากระบบลงเวลา ส่งเป็น header ให้เซิร์ฟเวอร์แปลงเป็นชื่อเอง
   🔴 **ห้ามส่ง "ชื่อ" จาก body เด็ดขาด** — ใครก็อ้างเป็นใครก็ได้
   (คลาสเดียวกับห้ามรับเบอร์จาก body ใน /api/push — ช่องที่ท่อจับได้ตอนรีวิว) ── */
let staffPin = ''
export function setStaffPin(pin: string) { staffPin = pin.trim() }

async function call<T extends BaseResp>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (staffPin) headers.set('x-staff-pin', staffPin)
  const res = await fetch(path, { ...init, headers })
  const d = (await res.json().catch(() => null)) as T | null
  /* ท่อตอบ 500 พร้อม JSON ⇒ .json() ไม่ throw — ต้องเช็คเอง (กฎเหล็กจอ ข้อ 3) */
  if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status}) — ไม่รู้ผล ห้ามกดซ้ำ`)
  if (typeof d.skip === 'string') throw new Error(d.skip)
  if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
  return d
}

export const returnsApi = {
  /** กล่องใบคืนทั้งหมด (จอแอดมิน + เช็คใบค้างของใบขายก่อนเปิดใหม่) */
  inbox: (q = '') =>
    call<InboxResp>(`/api/returns?list=returns-inbox${q ? `&q=${encodeURIComponent(q)}` : ''}`),

  /** ใบเดียวตาม returnId — resume */
  get: (returnId: string) =>
    call<GetReturnResp>(`/api/returns?return=${encodeURIComponent(returnId)}`),

  /** ขั้นรับ: สร้าง/ทวนใบ + ล็อกใบขาย · เซิร์ฟเวอร์ออก returnId
   *  unmatched: ส่ง orderId เป็น null + เหตุผล */
  receive: (body: {
    orderId?: string | null
    unmatched?: boolean
    unmatchedNote?: string
    /** unmatched อนุญาต sku ว่าง (ของที่ระบุรหัสไม่ได้หน้าเคาน์เตอร์) — แอดมินเติมตอนผูกใบ */
    items: Array<{ sku?: string; name?: string; qty: number }>
    noPhotoReason?: string
  }) => call<ReceiveResp>('/api/returns?return-receive=1', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }),

  /** ขั้นประเมิน+ยืนยัน (ปุ่มเดียวของขั้น ④): เซิร์ฟเวอร์บันทึกคำตัดสิน **และยิง move ในธุรกรรมเดียว**
   *  ตอบกลับพร้อม moveResult ต่อชิ้น (added/duplicate) — idempotent ต่อ returnId
   *  (ผัง v2: "กด 1 ครั้ง → ระบบยิง move อัตโนมัติ" — แยกสอง POST = เปิดหน้าต่างเน็ตหลุดคาอีกขั้น)
   *  กติกาฝั่งเซิร์ฟเวอร์ (ตกลงกับท่อ 7 ก.ย. ดึก):
   *  - เช็ค remaining ใหม่ ณ เวลานี้เสมอ — เกิน = ปฏิเสธพร้อมเลข ไม่ยิง move แล้วค่อยรู้
   *  - ใบที่ moved/move_failed แล้ว **ปฏิเสธคำตัดสินชุดใหม่** (แก้ = ทางแอดมิน adjust RT-…-fix)
   *    แต่ยิงซ้ำ "ชุดเดิม" ได้ = ทางยิงชิ้นค้างของ move_failed
   *  - ปฏิเสธถ้า photoCount === 0 && !noPhotoReason — จอบังคับไม่พอ POST ตรงข้ามจอได้ */
  grade: (body: {
    returnId: string
    items: Array<{ sku: string; verdict: Verdict; note?: string }>
  }) => call<GradeResp>('/api/returns?return-grade=1', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }),

  /** อัปรูปทีละใบ (base64 ย่อแล้ว ≤1400px) — ต้องได้ ok ก่อนนับว่ารูปมีจริง
   *  ล้มเหลว = สถานะ upload_failed ฝั่งจอ retry ได้ (ล้มเหลว ≠ ไม่มีรูป — เวที #4) */
  photo: (body: { returnId: string; index: number; dataUrl: string }) =>
    call<BaseResp & LockBlock & { ok?: boolean; stored?: number }>('/api/returns?return-photo=1', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),

  /** ดูรูปใบคืนทีละใบ — GET ?returnphoto=<returnId>&i=<n> → {ok, dataUrl}
   *  🔴 ต้องดึงผ่านท่อ (รหัสอยู่ในหัวข้อความ) เปิด URL ตรง ๆ ไม่ได้ — กติกาเดียวกับรูปสลิป/ลงเวลา */
  photoGet: (returnId: string, i: number) =>
    call<BaseResp & { ok?: boolean; dataUrl?: string }>(
      `/api/returns?returnphoto=${encodeURIComponent(returnId)}&i=${i}`),

  /** ยกเลิกใบ — เฉพาะ **คนถือใบ** (คนอื่นต้อง takeover ก่อน = ได้บันทึกใครแย่งเพราะอะไรฟรี)
   *  🔴 ใบที่ลงบัญชีสต็อกแล้วแม้ชิ้นเดียว ยกเลิกไม่ได้ — ยกเลิกไม่ถอนของออกจากคลัง
   *  ทางแก้ของใบที่ moved คือแอดมิน adjust ด้วย ref <ref>-fix · ยกเลิกแล้วปลดล็อกใบขายทันที */
  cancel: (body: { returnId: string; reason: string }) =>
    call<GetReturnResp & LockBlock>('/api/returns?return-cancel=1', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),

  /** ขอรับช่วงใบที่คนก่อนถือค้าง — ต้องเลือกเหตุผล (ข้อสังเคราะห์เวที #2) */
  takeover: (body: { returnId: string; reason: 'shift-change' | 'unreachable' | 'other'; note?: string }) =>
    call<GetReturnResp>('/api/returns?return-takeover=1', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
}

/* 📌 **ของชำรุดลงบัญชีสองแถวต่อชิ้น — ตกลงกับท่อ 7 ก.ย. ดึก (อ่านก่อนทำจอประวัติ move)**
   verdict=damage ⇒ ledger ได้ return_in +qty (ของกลับมาจริง) แล้ว damage −qty (ตัดทิ้ง)
   สุทธิ = 0 บนสต็อกขายได้ ซึ่งถูก เพราะของถูกตัดไปตั้งแต่ตอนขายแล้ว
   ลง damage −qty แถวเดียว = ตัดซ้ำสองรอบจากการขายครั้งเดียว สต็อกขาดเงียบ ๆ
   ⇒ จอที่โชว์ move ตาม ref RT-* ต้องเตรียมรับ 2 แถวต่อชิ้นชำรุด ห้ามทักว่าซ้ำ */

/** แปลงเวลาจากท่อ → epoch ms — **เวลาท่อเป็น UTC เสมอ แม้ไม่มีตัวบอกโซน**
 *  🐛 เจอตอนยิงประกบ (8 ก.ย. 00:00): ท่อส่ง 'YYYY-MM-DD HH:MM:SS' (UTC ไม่มี Z)
 *  new Date() ตีความเป็นเวลาท้องถิ่น ⇒ บนเครื่องไทยจอโชว์ 16:58 แทน 23:58 (ขาด 7 ชม.)
 *  และอายุใบพองเกินจริง 7 ชม. — จอทุกตัวต้องแปลงผ่านตัวนี้ ห้าม new Date ตรง ๆ */
export function serverTimeMs(iso?: string | null): number | null {
  if (!iso || typeof iso !== 'string') return null
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)
  const t = new Date(withZone ? iso : iso.replace(' ', 'T') + 'Z').getTime()
  return Number.isFinite(t) ? t : null
}

/* ── ป้ายสถานะกลาง — จอทุกตัวใช้ชุดเดียวกัน ห้ามพิมพ์ซ้ำ ── */
export const STATE_LABEL: Record<ReturnState, { text: string; tone: 'blue' | 'orange' | 'green' | 'red' | 'gray' }> = {
  received: { text: 'รับแล้ว · รอประเมิน', tone: 'blue' },
  graded: { text: 'ประเมินแล้ว · รอเข้าสต็อก', tone: 'orange' },
  move_failed: { text: 'เข้าสต็อกไม่ครบ — ยิงซ้ำได้', tone: 'red' },
  moved: { text: 'เข้าสต็อกแล้ว', tone: 'green' },
  cancelled: { text: 'ยกเลิก', tone: 'gray' },
}

export const TAKEOVER_REASONS: Array<[code: 'shift-change' | 'unreachable' | 'other', label: string]> = [
  ['shift-change', 'กะเปลี่ยน — คนเดิมกลับแล้ว'],
  ['unreachable', 'ติดต่อคนเดิมไม่ได้'],
  ['other', 'อื่น ๆ (พิมพ์เหตุผล)'],
]
