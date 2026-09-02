'use client'
// ขายหน้าร้าน (POS) — 2 สาขา · เขียนเข้าคลังเงาโดยตรง ไม่ผ่าน ZORT
//
// ZORT ขายหน้าร้านผ่าน **แอป Android** ไม่มีจอเว็บให้ลอก (ตรวจที่ pos.zortout.com แล้ว)
// แต่เจ้าของร้านถ่ายเครื่องจริงบนแท็บเล็ตหน้าร้านมาให้ (2 ก.ย. 2569) ⇒ ได้ผังของจริงมาแล้ว:
//   · **สองแผงแนวนอน** ซ้าย = ตัวเลือกสินค้า · ขวา = ตะกร้า + บล็อกสรุป + ปุ่มใหญ่เต็มความกว้าง
//   · เลือกสินค้าจาก **หมวดหมู่** เป็นหลัก (ปุ่มใหญ่เรียงลง) ไม่ใช่ค้นหาอย่างเดียว
//     ⚠️ รอบแรกผมทำเป็นค้นหาล้วน ซึ่งใช้ได้เฉพาะคนที่จำรหัสได้ — คนขายจริงกดจากหมวดหมู่
//     (ยังไม่มีข้อมูลหมวดหมู่ในคลังเงา — ขอฝั่งท่อหลังบ้านแล้ว)
//   · ล่างซ้ายมีช่อง Barcode/SN แยกจากช่องค้นหา
//   · บล็อกสรุป: สินค้ารวม · ราคารวม · ส่วนลดโปรโมชั่น · ส่วนลดท้ายบิล · **ราคาสุทธิตัวใหญ่**
//   · มีปุ่ม **พักบิล** — พักใบนี้ไว้แล้วเปิดใบใหม่ได้ (แคชเชียร์ใช้ตอนลูกค้าไปหยิบของเพิ่ม)
//
// ยึดอย่างเดียว: **ใช้ง่ายตอนยืนขายโดยมีลูกค้ารออยู่ตรงหน้า**
//   1. ช่องค้นหาโฟกัสตั้งแต่เปิดจอ — พิมพ์รหัสแล้ว Enter ได้เลย ไม่ต้องแตะเมาส์
//   2. เพิ่มลงบิลแล้วช่องค้นหาเคลียร์ + โฟกัสกลับทันที เพื่อยิงตัวถัดไป
//   3. ปุ่มเก็บเงินใหญ่และอยู่ที่เดิมเสมอ (ติดล่างจอ)
//   4. เลือกสาขาครั้งเดียวแล้วจำไว้ ไม่ต้องเลือกทุกบิล
//   5. ปุ่มเพิ่ม/ลดจำนวนกดด้วยนิ้วได้ ไม่ใช่เป้าเล็ก ๆ
//
// 🔴 **ห้ามเอาจำนวนคงเหลือไปบล็อกการขายเด็ดขาด** — เลขนั้นมาจากภาพถ่ายสต็อกตอนตี 1
//    ลูกค้ายืนอยู่ตรงหน้าแล้วกดขายไม่ได้เพราะเลขไม่ตรง **แย่กว่าขายเกินเยอะ**
//    ⇒ คงเหลือเป็น "ตัวช่วยดู" เท่านั้น สีเทา ไม่ใช่ปุ่มเทา
// ⚠️ **ยังเป็นช่วงเดินคู่ขนานกับ ZORT** — เปิดบิลที่นี่ซ้ำกับแอป ZORT ใบเดียวกัน
//    จะได้สองใบในคลังเงา (กระจก ZORT ดึงใบเดิมเข้ามาอีกรอบ)
//    ⇒ **คำเตือนบนหัวจอห้ามถอด** จนกว่าจะเลิกใช้ ZORT จริง
// ⚠️ **ยิง sale=1 ตอนกด "เก็บเงิน" ครั้งเดียวเท่านั้น** ห้ามยิงตอนพิมพ์หรือแก้ตะกร้า
//    (โควตาเขียนของ D1 มีจำกัด · และใบซ้ำแก้ทีหลังยาก)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtBaht } from '@/lib/format'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, Pill } from '@/components/zort'
import { useSkuImages } from '@/lib/sku-images'

interface Branch { code: string; name: string }
interface Found {
  sku: string; name: string; price: number; qty: number
  permit?: Permit; permitModel?: string; permitWhy?: string
}
interface Cat { code: string; name: string; items: number }
interface CartLine { sku: string; name: string; price: number; qty: number; discount: number; permit?: Permit }
interface SaleRow {
  number: string; channel: string; status: string
  amount: number; customer: string; order_date: string
}

const BRANCH_KEY = 'gucut-pos-branch'
const HOLD_KEY = 'gucut-pos-held'   // บิลที่พักไว้ — เก็บในเครื่อง ไม่แตะเซิร์ฟเวอร์
// บิลที่กำลังคิดอยู่ — เก็บไว้กันรีโหลด/แท็บปิด/เบราว์เซอร์เด้ง
// ⚠️ ของที่ยิงเข้าบิลไปสิบกว่าตัวแล้วหายเพราะเผลอรีเฟรช คือเรื่องใหญ่ตอนลูกค้ายืนรอ
// ⚠️ แต่ **ห้ามกู้บิลข้ามวัน** — บิลค้างจากเมื่อวานโผล่ขึ้นมาแล้วคนขายไม่ทันสังเกต
//    จะกลายเป็นขายซ้ำหรือคิดเงินผิด ⇒ กู้เฉพาะที่ยังไม่เกิน 8 ชั่วโมง และต้องบอกให้เห็นชัด
/** รหัสสุ่มประจำบิล — ใช้ crypto ถ้ามี ไม่มีก็ถอยไปเวลา+สุ่ม (แท็บเก่า/บริบทไม่ปลอดภัย) */
function newRef() {
  try {
    const c = globalThis.crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch { /* บางเบราว์เซอร์ throw ตอนแตะ crypto ในบริบทที่ไม่ใช่ https */ }
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** "45 วินาทีที่แล้ว" / "4 นาทีที่แล้ว" — เกินนาทีครึ่งแล้วนับเป็นวินาทีอ่านยาก
 *  (หน้าต่างเตือนบิลซ้ำขยายเป็น 5 นาที ⇒ ตัวเลขวินาทีขึ้นไปถึง 300 ได้) */
function agoText(secs: number) {
  const s = Math.max(0, Math.round(Number(secs) || 0))
  if (s < 90) return `${s} วินาทีที่แล้ว`
  return `${Math.round(s / 60)} นาทีที่แล้ว`
}

const DRAFT_KEY = 'gucut-pos-draft'
const DRAFT_MAX_AGE = 8 * 3600e3

interface HeldBill { id: string; at: string; customer: string; lines: CartLine[]; ts?: number }

/** บิลพักไว้ตั้งแต่เมื่อไหร่ — ใบเก่าไม่มีช่อง ts แต่ id เป็น "H<เวลา>" จึงถอดออกมาได้
 *  ⚠️ **ตาข่ายนี้จะหยุดทำงานเมื่อไหร่: ถ้าวันหนึ่งเปลี่ยนรูปแบบ id**
 *     เปลี่ยนเมื่อไหร่ต้องอ่าน ts อย่างเดียว ไม่ใช่เดาจาก id */
function heldTime(h: HeldBill): number {
  if (typeof h.ts === 'number' && h.ts > 0) return h.ts
  const guess = Number(String(h.id ?? '').replace(/^H/, ''))
  return Number.isFinite(guess) && guess > 0 ? guess : 0
}

/** "เมื่อวาน 14:30" / "2 ก.ย. 14:30" — บิลข้ามวันต้องอ่านออกทันทีว่าไม่ใช่ของวันนี้ */
function heldWhen(h: HeldBill): { text: string; stale: boolean } {
  const ts = heldTime(h)
  if (!ts) return { text: h.at || '—', stale: false }
  const d = new Date(ts)
  const now = new Date()
  const clock = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return { text: clock, stale: Date.now() - ts > 8 * 3600e3 }
  const yesterday = new Date(now.getTime() - 864e5).toDateString() === d.toDateString()
  return {
    text: yesterday
      ? `เมื่อวาน ${clock}`
      : `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${clock}`,
    stale: true,
  }
}
// 🪚 ใบอนุญาตเลื่อยโซ่ยนต์ — **ใช้ธง permit จากเซิร์ฟเวอร์เท่านั้น ห้ามเดาจากชื่อสินค้า**
//    เดาจากชื่อพังทันทีที่ร้านตั้งชื่อแบบอื่น และไม่มีอะไรฟ้อง (ผมเคยทำแบบนั้นไว้ ตอนนี้เลิกแล้ว)
//    · required = ต้องขอทะเบียน · exempt = ไม่ต้องขอ · unknown = เป็นตัวเครื่องแต่จับรุ่นไม่ได้
//    · null/ไม่มีค่า = ไม่ใช่ตัวเครื่อง (โซ่ บาร์ อะไหล่) ⇒ **ไม่ต้องขึ้นอะไรเลย**
// ⚠️ null แปลได้สองอย่างที่ต้องแสดงคนละแบบสุดขั้ว — ห้ามรวบเป็นกรณีเดียว
// ⚠️ **exempt เป็นจุดขาย ไม่ใช่แค่ "ไม่ต้องเตือน"** ลูกค้าเยอะมากอยากได้เลื่อยแต่กลัวเรื่องเอกสาร
//    ขึ้นป้ายเขียวบอกไปเลยว่าไม่ต้องขอใบอนุญาต จะช่วยปิดการขาย
// ⚠️ **ห้ามเขียนว่า "ไม่ผิดกฎหมาย" ลอย ๆ** เขียนได้แค่ "ไม่ต้องขอใบอนุญาตให้มี"
//    ผู้ใช้ยังมีหน้าที่อื่นตามกฎหมายอยู่ (กติกาในความจำร้าน)
type Permit = 'required' | 'exempt' | 'unknown' | null | undefined
const PERMIT_BADGE: Record<string, { text: string; cls: string }> = {
  required: { text: 'ต้องขอ ลซ.๒', cls: 'text-amber-800 bg-amber-100' },
  exempt: { text: 'ไม่ต้องขอใบอนุญาต', cls: 'text-emerald-800 bg-emerald-100' },
  unknown: { text: 'ต้องตรวจสอบก่อน', cls: 'text-red-800 bg-red-100' },
}
function PermitBadge({ permit }: { permit: Permit }) {
  const b = permit ? PERMIT_BADGE[permit] : undefined
  if (!b) return null
  return (
    <span className={`ml-1.5 text-[10.5px] font-semibold rounded px-1.5 py-0.5 ${b.cls}`}>{b.text}</span>
  )
}

const thaiToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

export default function CorePosPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branch, setBranch] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [looking, setLooking] = useState(false)
  const [cats, setCats] = useState<Cat[]>([])
  const [cat, setCat] = useState('')          // หมวดที่เปิดอยู่ ('' = ยังไม่ได้เลือก)
  const [catTotal, setCatTotal] = useState(0) // มีทั้งหมดกี่ตัวในหมวดนั้น (ไม่ใช่แค่ที่โหลดมา)
  // ⚠️ ผลค้นหาก็ต้องบอกจำนวนที่เจอจริงเหมือนกัน — ไม่งั้นคนขายค้นแล้วเห็น 20 ตัว
  //    นึกว่าร้านมีแค่นั้น ทั้งที่มี 124 ตัว (โรคเดิม: ตัวเลขกับรายการมาคนละที่)
  const [searchTotal, setSearchTotal] = useState(0)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{
    number: string
    duplicate?: boolean
    /** เซิร์ฟเวอร์เตือนว่าอาจซ้ำกับใบก่อนหน้า — **ออกใบให้แล้ว** แค่ให้คนตัดสินว่าใช่ซ้ำไหม */
    maybe?: { number: string; amount: number; secondsAgo: number }
  } | null>(null)
  // 🔴 **รหัสประจำบิลใบนี้ (clientRef) — ตัวกันเปิดบิลซ้ำที่ระดับเซิร์ฟเวอร์**
  //    ยิงของจริงแล้วเจอ: กดเปิดบิลสองครั้งได้บิลสองใบ (KLD-…-001 กับ -002)
  //    จากตะกร้าใบเดียวกัน ⇒ ยอดขายเบิ้ล · สต็อกตัดสองรอบ · เข้า PEAK สองใบ
  //    ตัวกันเดิมเทียบจาก "เลขที่ใบ" ซึ่ง **ยังไม่มีตอนกดครั้งแรก** (เซิร์ฟเวอร์เป็นคนตั้งเลข)
  //    ⇒ กันได้เฉพาะตอนที่จอรู้เลขอยู่แล้ว ซึ่งไม่ใช่สถานการณ์ที่คนกดซ้ำจริง
  //    (เน็ตสะดุด → จอไม่ได้คำตอบ → แคชเชียร์กดใหม่ → ในมือยังไม่มีเลขสักตัว)
  // ⚠️ ต้องเกิดพร้อมบิล **ไม่ใช่ตอนกดเก็บเงิน** และต้องอยู่รอดข้ามการโหลดหน้าใหม่
  //    (เก็บไปกับร่างใน localStorage) ไม่งั้นรีเฟรชแล้วกดใหม่ = ได้ ref ใหม่ = ซ้ำอีก
  const [billRef, setBillRef] = useState('')
  const [error, setError] = useState('')
  // ⚠️ **ข้อมูลที่ต้องรู้ ไม่ใช่ความผิดพลาด** — ต้องแยกกล่องกัน
  //    เจ้าของร้านเปิดจอจริงแล้วเจอว่าข้อความเรื่อง ลซ.๒ ไปโผล่ในกล่อง "ทำรายการไม่สำเร็จ"
  //    ทั้งที่สินค้าถูกเพิ่มลงบิลสำเร็จแล้ว ⇒ คนขายเห็นคำว่าไม่สำเร็จจะนึกว่าระบบพังแล้วกดซ้ำ
  //    หรือคิดว่าขายไม่ได้ · ระบบทำงานถูกแต่สื่อสารผิด แล้วคนใช้ตัดสินใจผิดตาม
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn' | 'good'; text: string } | null>(null)
  const [sales, setSales] = useState<SaleRow[]>([])
  // สรุปแยกตามวิธีจ่ายของวันนั้น — เอาไว้ปิดยอดสิ้นวัน
  // (เงินสดต้องนับในลิ้นชัก · โอนต้องเช็คสลิป · บัตรต้องกระทบยอดกับเครื่องรูด)
  const [byPay, setByPay] = useState<{ method: string; orders: number; amount: number }[]>([])
  // ชื่อไทยของวิธีจ่ายมาจากเซิร์ฟเวอร์ — ห้ามฮาร์ดโค้ด ร้านเพิ่มวิธีจ่ายได้
  const [payNames, setPayNames] = useState<Record<string, string>>({})
  const [dayTotal, setDayTotal] = useState({ orders: 0, amount: 0 })
  const [held, setHeld] = useState<HeldBill[]>([])
  // 🔴 ยืนยัน "ตั้งใจแจกฟรี" — ต้องติ๊กเองเท่านั้น ห้ามติ๊กให้อัตโนมัติ
  const [allowZero, setAllowZero] = useState(false)
  // เครื่องจริงแยกเป็นขั้น ๆ (หัวจอเขียน "1.ตะกร้าสินค้า" → "3.ชำระเงิน")
  const [step, setStep] = useState<'cart' | 'pay'>('cart')
  const [payMethod, setPayMethod] = useState<'cash' | 'credit' | 'transfer'>('cash')
  const [tendered, setTendered] = useState('')   // เงินที่รับมา (กดจากแป้นตัวเลข)
  const [billDiscount, setBillDiscount] = useState('')   // ส่วนลดท้ายบิล (บาท)
  const searchRef = useRef<HTMLInputElement>(null)
  // รูปสินค้าในการ์ดผลค้นหา — เครื่องจริงก็มีรูปในการ์ด ช่วยให้คนขายกดถูกตัวเร็วขึ้น
  const imgOf = useSkuImages()

  // บิลที่พักไว้ + บิลที่กำลังคิดค้างอยู่ — อ่านครั้งเดียวตอนเปิดจอ
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOLD_KEY)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHeld(arr)
    } catch { /* ของพังในเครื่องไม่ควรทำให้เปิดจอขายไม่ได้ */ }
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      const age = Date.now() - Number(d?.at || 0)
      if (!Array.isArray(d?.lines) || d.lines.length === 0) return
      if (age > DRAFT_MAX_AGE) { localStorage.removeItem(DRAFT_KEY); return }
      setCart(d.lines.map((l: CartLine) => ({ ...l, discount: Number(l.discount) || 0 })))
      setCustomer(String(d.customer ?? ''))
      // กู้รหัสประจำบิลมาด้วย — บิลเดิมต้องใช้ ref เดิม ไม่งั้นกดเปิดบิลหลังรีเฟรช
      // จะกลายเป็นบิลใหม่ในสายตาเซิร์ฟเวอร์ แล้วได้สองใบ (ร่างเก่าที่ไม่มี ref จะได้ตัวใหม่)
      if (typeof d.ref === 'string' && d.ref) setBillRef(d.ref)
      const when = new Date(Number(d.at)).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      setNotice({
        tone: 'info',
        text: `กู้บิลที่ค้างไว้ตั้งแต่ ${when} มาให้ (${d.lines.length} รายการ) — `
          + 'ถ้าไม่ใช่บิลที่กำลังคิดอยู่ กด "ล้างบิล" ได้เลย',
      })
    } catch { /* ร่างพังไม่ควรขวางการขาย */ }
  }, [])

  // รหัสประจำบิลเกิดพร้อมบิล และตายพร้อมบิล — บิลว่าง = ไม่มี ref
  // (พักบิล · ล้างบิล · เปิดบิลสำเร็จ ล้วนทำให้ตะกร้าว่าง ⇒ ใบถัดไปได้ ref ใหม่เองทุกทาง)
  useEffect(() => {
    if (cart.length === 0) { if (billRef) setBillRef(''); return }
    if (!billRef) setBillRef(newRef())
  }, [cart, billRef])

  // เก็บบิลที่กำลังคิดทุกครั้งที่เปลี่ยน — เขียนแค่ localStorage ไม่แตะเซิร์ฟเวอร์
  useEffect(() => {
    try {
      if (cart.length === 0) localStorage.removeItem(DRAFT_KEY)
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), customer, lines: cart, ref: billRef }))
    } catch {}
  }, [cart, customer, billRef])

  const saveHeld = (list: HeldBill[]) => {
    setHeld(list)
    try { localStorage.setItem(HOLD_KEY, JSON.stringify(list)) } catch {}
  }

  // ⚠️ พักบิลเก็บใน **เครื่องนี้เท่านั้น** ไม่ได้ส่งขึ้นเซิร์ฟเวอร์
  //    เปลี่ยนเครื่องแล้วบิลที่พักไว้จะไม่ตามไป — ต้องเขียนบอกบนจอ
  function holdBill() {
    if (!cart.length) return
    const bill: HeldBill = {
      id: `H${Date.now()}`,
      ts: Date.now(),
      at: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      customer,
      lines: cart,
    }
    saveHeld([bill, ...held])
    setCart([])
    setCustomer('')
    setDone(null)
    searchRef.current?.focus()
  }

  function resumeBill(id: string) {
    const b = held.find((h) => h.id === id)
    if (!b) return
    // ของในตะกร้าตอนนี้ต้องไม่หาย — พักอันเดิมไว้ก่อนแล้วค่อยดึงอันใหม่มา
    const rest = held.filter((h) => h.id !== id)
    if (cart.length) {
      rest.unshift({
        id: `H${Date.now()}`,
        at: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        customer,
        lines: cart,
      })
    }
    saveHeld(rest)
    // ⚠️ บิลที่พักไว้ก่อนมีฟีเจอร์ส่วนลดจะไม่มีฟิลด์ discount — เติมให้เป็น 0
    //    ไม่งั้นช่องส่วนลดของบรรทัดเก่าเป็น undefined แล้วคำนวณเพี้ยนแบบเงียบ ๆ
    setCart(b.lines.map((l) => ({ ...l, discount: Number(l.discount) || 0, permit: l.permit })))
    setCustomer(b.customer)
    searchRef.current?.focus()
  }

  // ── สาขา: ดึงจากเซิร์ฟเวอร์ ห้ามฮาร์ดโค้ด (ร้านเพิ่มสาขาได้ด้วย env) ──
  useEffect(() => {
    fetch('/api/web/core?list=branches')
      .then((r) => r.json())
      .then((d) => {
        const list: Branch[] = Array.isArray(d?.branches) ? d.branches : []
        setBranches(list)
        let saved = ''
        try { saved = localStorage.getItem(BRANCH_KEY) ?? '' } catch {}
        // เลือกสาขาครั้งเดียวแล้วจำไว้ · ค่าที่จำไว้ต้องยังมีอยู่จริง ไม่งั้นถอยไปตัวแรก
        setBranch(list.some((b) => b.code === saved) ? saved : (list[0]?.code ?? ''))
      })
      .catch(() => setError('ดึงรายชื่อสาขาไม่ได้ — เปิดบิลไม่ได้จนกว่าจะรู้ว่าขายที่สาขาไหน'))
  }, [])

  // รายชื่อหมวด — เรียงมาให้แล้วจากเซิร์ฟเวอร์ ห้ามจัดลำดับเอง
  useEffect(() => {
    fetch('/api/web/core?list=poscats')
      .then((r) => r.json())
      .then((d) => setCats(Array.isArray(d?.cats) ? d.cats : []))
      .catch(() => setCats([]))
  }, [])

  // เปิดหมวด — ดึงได้ถึง 200 ตัว และต้องบอกด้วยว่าทั้งหมวดมีกี่ตัว
  // ⚠️ หมวดใหญ่สุดมี 462 ตัว ถ้าไม่บอก total คนขายจะนึกว่าเห็นครบแล้ว
  const openCat = useCallback(async (code: string) => {
    setCat(code)
    setQ('')
    setLooking(true)
    try {
      const res = await fetch(`/api/web/core?poslookup=&cat=${encodeURIComponent(code)}&limit=200`)
      const d = await res.json()
      setFound(Array.isArray(d?.rows) ? d.rows : [])
      setCatTotal(Number(d?.total) || 0)
    } catch {
      setFound([])
      setCatTotal(0)
    } finally {
      setLooking(false)
    }
  }, [])

  const pickBranch = (code: string) => {
    setBranch(code)
    try { localStorage.setItem(BRANCH_KEY, code) } catch {}
    searchRef.current?.focus()
  }

  const loadSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/web/core?list=sales&day=${thaiToday()}&limit=50`)
      const d = await res.json()
      setSales(Array.isArray(d?.rows) ? d.rows : [])
      // รับได้ทั้งรูป array และ object เผื่อรูปข้อมูลต่างจากที่คิด — จอต้องไม่พังเพราะรูปไม่ตรง
      const bp = d?.byPay
      setByPay(
        Array.isArray(bp)
          ? bp.map((r: { method?: string; orders?: number; amount?: number }) => ({
            method: String(r?.method ?? ''), orders: Number(r?.orders) || 0, amount: Number(r?.amount) || 0,
          }))
          : bp && typeof bp === 'object'
            ? Object.entries(bp).map(([method, v]) => {
              const o = v as { orders?: number; amount?: number }
              return { method, orders: Number(o?.orders) || 0, amount: Number(o?.amount) || 0 }
            })
            : []
      )
      setPayNames(d?.methods && typeof d.methods === 'object' ? d.methods : {})
      setDayTotal({ orders: Number(d?.total) || 0, amount: Number(d?.totalAmount) || 0 })
    } catch { /* ประวัติดึงไม่ได้ไม่ควรขวางการขาย */ }
  }, [])

  useEffect(() => { loadSales() }, [loadSales])
  useEffect(() => { searchRef.current?.focus() }, [])

  // ── ค้นหาสินค้า: หน่วง 300ms พอ (เป็นการอ่าน ยิงถี่ได้แต่ไม่ต้องยิงทุกตัวอักษร) ──
  useEffect(() => {
    const term = q.trim()
    // พิมพ์ค้นหา = ออกจากโหมดดูหมวด (แต่ปุ่มหมวดยังอยู่ให้กดกลับได้)
    if (!term) { if (!cat) setFound([]); return }
    setCat('')
    let alive = true
    setLooking(true)
    const t = setTimeout(() => {
      fetch(`/api/web/core?poslookup=${encodeURIComponent(term)}&limit=20`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          setFound(Array.isArray(d?.rows) ? d.rows : [])
          setSearchTotal(Number(d?.total) || 0)
        })
        .catch(() => { if (alive) { setFound([]); setSearchTotal(0) } })
        .finally(() => { if (alive) setLooking(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q, cat])

  function addToCart(it: Found) {
    setCart((prev) => {
      const at = prev.findIndex((c) => c.sku === it.sku)
      if (at >= 0) {
        const next = [...prev]
        next[at] = { ...next[at], qty: next[at].qty + 1 }
        return next
      }
      return [...prev, { sku: it.sku, name: it.name, price: Number(it.price) || 0, qty: 1, discount: 0, permit: it.permit }]
    })
    // 🔴 **เตือนตรงนี้เลย ไม่ใช่ตอนกดเก็บเงิน** — ของจริงคือแคชเชียร์ยิงบาร์โค้ดรัว ๆ
    //    ถ้าไปเตือนตอนท้าย เขาจะไม่รู้ว่าตัวไหนราคา 0 และอาจกดยืนยันผ่านไปเลย
    //    (เจอจริงตอนทดสอบ: รหัส 03409-3 ราคา 0 ⇒ บิลออก ฿0 โดยไม่มีอะไรเตือน = ขายฟรีไม่รู้ตัว)
    // 🪚 บอกเรื่องใบอนุญาตตั้งแต่ตอนหยิบลงบิล — คนขายจะได้พูดกับลูกค้าทันที
    //    ไม่ใช่มารู้ตอนเก็บเงินแล้วลูกค้าเดินออกไปแล้ว
    if (it.permit === 'required') {
      setNotice({
        tone: 'warn',
        text: `🪚 "${it.name}" ต้องขอใบอนุญาตให้มีเลื่อยโซ่ยนต์ — `
          + 'ขายแล้วต้องทำเรื่อง ลซ.๒ ให้ลูกค้า (ขั้นตอนที่ gucut.com/permit)',
      })
    } else if (it.permit === 'unknown') {
      setNotice({
        tone: 'warn',
        text: `⚠️ "${it.name}" เป็นตัวเครื่องแต่ระบบจับรุ่นไม่ได้ — `
          + 'ต้องตรวจสอบเองก่อนขายว่ารุ่นนี้ต้องขอใบอนุญาตหรือไม่',
      })
    } else if (it.permit === 'exempt') {
      setNotice({ tone: 'good', text: `✅ "${it.name}" รุ่นนี้ไม่ต้องขอใบอนุญาตให้มี — บอกลูกค้าได้เลย` })
    } else if ((Number(it.price) || 0) <= 0) {
      setNotice({
        tone: 'warn',
        text: `⚠️ "${it.name || it.sku}" ราคา 0 บาท (ยังไม่ได้ตั้งราคาในคลัง) — `
          + 'ใส่ลงบิลแล้ว แต่จะเก็บเงินไม่ได้จนกว่าจะยืนยันว่าตั้งใจแจกฟรี',
      })
    } else {
      setNotice(null)
    }
    // เคลียร์ + โฟกัสกลับทันที เพื่อยิงตัวถัดไป
    setQ('')
    setFound([])
    setDone(null)
    searchRef.current?.focus()
  }

  const setQty = (sku: string, qty: number) =>
    setCart((prev) => prev.map((c) => (c.sku === sku ? { ...c, qty: Math.max(1, qty) } : c)))
  const removeLine = (sku: string) => setCart((prev) => prev.filter((c) => c.sku !== sku))
  // ส่วนลดต่อชิ้น — กันกรอกเกินราคาตั้งแต่ที่จอ (เซิร์ฟเวอร์ก็กันอีกชั้น)
  const setDiscount = (sku: string, v: number) =>
    setCart((prev) => prev.map((c) => (c.sku === sku
      ? { ...c, discount: Math.max(0, Math.min(Number.isFinite(v) ? v : 0, c.price)) }
      : c)))

  // สินค้าราคา 0 ในบิล — ต้องรู้ทั้งว่ามีไหมและตัวไหน เพื่อบอกคนขายได้ว่าตัวไหน
  const zeroLines = useMemo(() => cart.filter((c) => (Number(c.price) || 0) <= 0), [cart])
  const hasZero = zeroLines.length > 0
  const zeroNames = useMemo(
    () => zeroLines.map((c) => c.name || c.sku).join(' · '),
    [zeroLines]
  )
  // ⚠️ ตัวเลขพวกนี้ใช้ **แสดงผลอย่างเดียว** — เซิร์ฟเวอร์คิดยอดใหม่เองทั้งหมดและไม่เชื่อยอดจากจอ
  //    (กติกาเดิมของร้าน ใช้กับหน้าเช็คเอาต์อยู่แล้ว) จอจึงส่งแค่ ราคา/จำนวน/ส่วนลด ไม่ส่ง amount
  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + Math.max(0, c.price - (c.discount || 0)) * c.qty, 0),
    [cart]
  )
  const lineDiscount = useMemo(
    () => cart.reduce((s, c) => s + (c.discount || 0) * c.qty, 0),
    [cart]
  )
  // ส่วนลดท้ายบิลเกินยอดก่อนลดไม่ได้ — เซิร์ฟเวอร์ตีกลับอยู่แล้ว แต่กันที่จอด้วยจะได้ไม่ต้องยิงไปเสียเที่ยว
  const billOff = Math.max(0, Math.min(Number(billDiscount) || 0, subtotal))
  const total = Math.max(0, subtotal - billOff)
  // เงินทอน — ติดลบแปลว่ารับเงินมาไม่พอ ต้องบอกว่าขาดอีกเท่าไหร่ ไม่ใช่โชว์เลขติดลบเฉย ๆ
  const change = (Number(tendered) || 0) - total

  function tapKey(k: string) {
    if (k === 'AC') { setTendered(''); return }
    // กันจุดทศนิยมซ้ำ — กดรัว ๆ ตอนรีบแล้วได้ "12..5" ซึ่งกลายเป็น NaN
    if (k === '.' && tendered.includes('.')) return
    setTendered((prev) => (prev === '0' && k !== '.' ? k : prev + k))
  }
  const count = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart])

  async function checkout() {
    if (!branch) { setError('ยังไม่ได้เลือกสาขา'); return }
    if (!cart.length) return
    setSaving(true)
    setError('')
    setNotice(null)
    setDone(null)
    try {
      const res = await fetch('/api/web/core?sale=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branch,
          // 🔴 ตัวกันเปิดบิลซ้ำ — เจอ ref เดิม เซิร์ฟเวอร์คืนใบเดิม ไม่สร้างใบใหม่
          ...(billRef ? { clientRef: billRef } : {}),
          customer: customer.trim() || undefined,
          // ส่งเฉพาะตอนคนขายติ๊กยืนยันเองว่าตั้งใจแจกฟรี
          ...(allowZero ? { allowZero: true } : {}),
          // ⚠️ ท่อยังไม่มีที่เก็บวิธีจ่าย (ขอไว้แล้ว) — ส่งไปก่อนได้ ฟิลด์เกินถูกมองข้าม
          //    วันที่ท่อรับ ข้อมูลจะครบตั้งแต่ใบแรกโดยไม่ต้องมาไล่เติมย้อนหลัง
          payMethod,
          // ⚠️ ส่งแค่ ราคา/จำนวน/ส่วนลด — **ไม่ส่งยอดรวม** เซิร์ฟเวอร์คิดใหม่เองและไม่เชื่อยอดจากจอ
          items: cart.map((c) => ({
            sku: c.sku, name: c.name, qty: c.qty, price: c.price,
            ...(c.discount > 0 ? { discount: c.discount } : {}),
          })),
          ...(billOff > 0 ? { billDiscount: billOff } : {}),
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) {
        // รายการที่ผิดคืนมาใน bad[] พร้อมเลขบรรทัด — ชี้ให้คนขายเห็นว่าแถวไหนพัง
        const bad = Array.isArray(d?.bad) && d.bad.length
          ? ` (มีปัญหาที่ ${d.bad.length} รายการ: ${d.bad.map((b: { sku?: string; why?: string }) => `${b.sku ?? '?'} ${b.why ?? ''}`).join(' · ')})`
          : ''
        throw new Error(`${d?.error ?? `HTTP ${res.status}`}${bad}`)
      }
      // ⚠️ ใบซ้ำ **ห้ามแกล้งขึ้นเขียวว่าเป็นใบใหม่** — ต้องบอกตรง ๆ ว่าบันทึกไปแล้ว
      // ⚠️ เลขที่บิลอยู่ที่ order.number — เดิมอ่าน d.number แล้วได้ค่าว่าง
      //    จอเลยขึ้น "เปิดบิลแล้ว เลขที่" ห้วน ๆ ไม่มีเลข (เจอตอนทดสอบจริง)
      // ⚠️ **เกณฑ์ล้างตะกร้า/ร่าง: มี order กลับมา = บิลมีอยู่จริงแล้ว = ล้างเสมอ**
      //    ห้ามแยกว่า duplicate หรือไม่ — ทั้งสองรูปแปลว่า "ขายเสร็จแล้ว" เหมือนกัน
      //    ต่างกันแค่ใบนั้นเพิ่งเกิด หรือเกิดไปแล้วจากการกดครั้งก่อน
      //    ถ้าเผลอล้างเฉพาะตอนไม่ duplicate → ร่างค้าง → เปิดจอครั้งหน้ากล่องฟ้า
      //    ยื่นตะกร้าของบิลที่ขายไปแล้วคืนมา → คนขายกดต่อ = ขายซ้ำใบที่สอง
      //    (อันตรายกว่าร่างหาย เพราะของโผล่มาโดยคนใช้ไม่รู้ว่ามาจากไหน)
      const mb = d?.maybeDuplicate
      setDone({
        number: String(d?.order?.number ?? d?.number ?? ''),
        duplicate: !!d?.duplicate,
        maybe: mb && mb.number
          ? {
            number: String(mb.number),
            amount: Number(mb.amount) || 0,
            secondsAgo: Number(mb.secondsAgo) || 0,
          }
          : undefined,
      })
      setAllowZero(false)
      setStep('cart')
      setTendered('')
      setBillDiscount('')
      setCart([])
      setCustomer('')
      await loadSales()
      searchRef.current?.focus()
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setSaving(false)
    }
  }

  async function voidSale(number: string) {
    setError('')
    try {
      const res = await fetch(`/api/web/core?salevoid=${encodeURIComponent(number)}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      await loadSales()
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  const isVoid = (s: string) => /void|ยกเลิก|cancel/i.test(String(s ?? ''))

  return (
    <div className="p-3 md:p-4">
      <PageHead
        title="ขายหน้าร้าน"
        summary={`บันทึกการขายเข้าคลังของเราเองโดยตรง · วันที่ ${thaiToday()}`}
        actions={
          <div className="flex items-center gap-2">
            {branches.map((b) => (
              <button
                key={b.code}
                onClick={() => pickBranch(b.code)}
                className={`text-[14px] font-semibold rounded-lg px-4 py-2.5 border transition-colors ${
                  branch === b.code
                    ? 'bg-[#1b3b73] text-white border-[#1b3b73]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {b.name || b.code}
              </button>
            ))}
          </div>
        }
      />

      {/* ⚠️ คำเตือนถาวร ห้ามถอดจนกว่าจะเลิกใช้ ZORT จริง */}
      <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3 leading-relaxed">
        ⚠️ <b>ยังเป็นช่วงเดินคู่ขนานกับ ZORT</b> — ใบที่เปิดที่นี่<b>ห้ามเปิดซ้ำในแอป ZORT POS</b>
        ไม่งั้นคลังเงาจะได้สองใบสำหรับการขายครั้งเดียว แล้วยอดเบิ้ลโดยไม่มีใครรู้
      </div>

      {/* กล่องแจ้งข้อมูล — **ไม่ใช่ความผิดพลาด** สินค้าเข้าบิลเรียบร้อยแล้ว */}
      {notice && (
        <div
          className={`rounded px-3 py-2.5 mb-3 text-[13px] border leading-relaxed ${
            notice.tone === 'good'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notice.tone === 'warn'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <b>
            {notice.tone === 'good' ? 'บอกลูกค้าได้เลย' : notice.tone === 'warn' ? 'ต้องทำเรื่องทะเบียนให้ลูกค้า' : 'แจ้งให้ทราบ'}
          </b>
          <span className="block mt-0.5">{notice.text}</span>
        </div>
      )}

      {error && <ErrorBox title="ทำรายการไม่สำเร็จ">{error}</ErrorBox>}

      {done && (
        <div
          className={`rounded px-3 py-2.5 mb-3 text-[13px] border ${
            done.duplicate
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {done.duplicate
            ? <>⚠️ ใบนี้ <b>เปิดไปแล้วก่อนหน้านี้</b> (เลขที่ {done.number}) — ระบบคืนใบเดิมให้ <b>ไม่ได้เปิดใบใหม่</b> เก็บเงินได้ตามปกติ</>
            : <>✅ เปิดบิลแล้ว เลขที่ <b>{done.number}</b></>}
        </div>
      )}

      {/* ⚠️ เซิร์ฟเวอร์เจอใบยอดเท่ากัน สาขาเดียวกัน รายการเหมือนกันเมื่อกี้ — **แต่ออกใบให้แล้ว**
          ตั้งใจไม่บล็อก: ลูกค้าซื้อของชิ้นเดิมสองบิลติดกันเป็นเรื่องปกติหน้าร้าน
          บล็อก = ขายของไม่ได้ ซึ่งแย่กว่าบิลซ้ำที่ยกเลิกได้ ⇒ ให้คนตัดสิน ไม่ใช่ระบบเดา
          แต่ก็ต้องไม่เงียบ — ถามตรง ๆ พร้อมปุ่มยกเลิกใบที่เพิ่งออก */}
      {done?.maybe && (
        <div className="rounded px-3 py-2.5 mb-3 text-[13px] border bg-amber-50 border-amber-200 text-amber-900">
          <p className="leading-relaxed">
            ⚠️ ใบ <b>{done.maybe.number}</b> ยอด {fmtBaht(done.maybe.amount)} เพิ่งออกไปเมื่อ{' '}
            <b>{agoText(done.maybe.secondsAgo)}</b> รายการเหมือนกันเป๊ะ —
            ถ้าเป็นใบเดียวกันที่กดซ้ำ ให้ยกเลิกใบที่เพิ่งออก ({done.number})
            <br />
            <span className="text-amber-700">
              ถ้าลูกค้าซื้อของชิ้นเดิมจริงสองบิล ไม่ต้องทำอะไร — ทั้งสองใบถูกต้องแล้ว
            </span>
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { voidSale(done.number); setDone(null) }}
              className="rounded-full bg-white border border-amber-300 px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              ยกเลิกใบ {done.number}
            </button>
            <button
              onClick={() => setDone((v) => (v ? { ...v, maybe: undefined } : v))}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] text-amber-800 hover:bg-amber-100"
            >
              ไม่ซ้ำ ทั้งสองใบถูกต้อง
            </button>
          </div>
        </div>
      )}

      {/* ── สองแผงแบบเครื่องจริง: ซ้าย = เลือกสินค้า · ขวา = ตะกร้า + สรุป ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr] gap-3 items-start">

        {/* แผงซ้าย — สลับตามขั้นตอน เหมือนเครื่องจริงที่หัวจอเขียน 1.ตะกร้าสินค้า / 3.ชำระเงิน */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
            {step === 'pay' && (
              <button onClick={() => setStep('cart')} className="text-[15px] text-gray-500 hover:text-gray-800" title="กลับไปแก้บิล">←</button>
            )}
            <p className="text-[13.5px] font-bold text-gray-800">
              {step === 'cart' ? '1. เลือกสินค้า' : '2. ชำระเงิน'}
            </p>
          </div>

          {/* ── ขั้นชำระเงิน: เลือกวิธีจ่าย + แป้นตัวเลข + เงินทอน ── */}
          {step === 'pay' && (
            <div className="p-3">
              <div className="flex">
                {([['cash', 'เงินสด'], ['credit', 'บัตรเครดิต'], ['transfer', 'โอนเงิน']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPayMethod(id)}
                    className={`flex-1 text-[13px] font-semibold py-2.5 border transition-colors ${
                      payMethod === id
                        ? 'bg-[#1b3b73] text-white border-[#1b3b73]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 border border-gray-300 rounded-lg px-4 py-3 text-right">
                <p className="text-[11.5px] text-gray-400">รับเงินมา</p>
                <p className="text-[30px] font-black text-gray-900 leading-tight">
                  {tendered === '' ? '0' : tendered}
                </p>
              </div>

              {/* เงินทอน — คำนวณให้เลย แคชเชียร์จะได้ไม่ต้องคิดในหัวตอนลูกค้ารอ */}
              <div className="mt-2 flex items-baseline justify-between px-1">
                <span className="text-[13px] text-gray-600">เงินทอน</span>
                <span className={`text-[20px] font-bold ${change < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {change < 0 ? `ขาดอีก ${fmtBaht(-change)}` : fmtBaht(change)}
                </span>
              </div>

              {/* แป้นตัวเลขแบบเครื่องจริง — ปุ่มใหญ่ กดด้วยนิ้วได้ */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'AC', '0', '.'].map((k) => (
                  <button
                    key={k}
                    onClick={() => tapKey(k)}
                    className={`h-14 rounded-lg border text-[18px] font-semibold transition-colors ${
                      k === 'AC'
                        ? 'border-gray-300 text-red-500 hover:bg-red-50'
                        : 'border-gray-300 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* ปุ่มลัดเงินที่รับบ่อย — เครื่องจริงไม่มี แต่ช่วยให้เร็วขึ้นมากตอนรับแบงก์ */}
              <div className="flex gap-2 mt-2">
                {[total, 100, 500, 1000].map((v, i) => (
                  <button
                    key={`${v}-${i}`}
                    onClick={() => setTendered(String(Math.round(v)))}
                    className="flex-1 h-11 rounded-lg border border-gray-300 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {i === 0 ? 'พอดี' : v.toLocaleString('th-TH')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'cart' && (
          <>

          <div className="p-3">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // พิมพ์รหัส/ยิงบาร์โค้ดแล้ว Enter — เจอตัวแรกใส่เลย ไม่ต้องแตะเมาส์
                if (e.key === 'Enter' && found.length > 0) addToCart(found[0])
              }}
              placeholder="สแกนบาร์โค้ด / พิมพ์รหัสหรือชื่อสินค้า แล้วกด Enter"
              className="w-full text-[16px] border-2 border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1b3b73]"
            />
            {looking && <p className="text-[12px] text-gray-400 mt-1">กำลังค้น…</p>}
            {!looking && q.trim() !== '' && (
              <p className="text-[12px] mt-1">
                {found.length === 0
                  ? <span className="text-gray-500">ไม่พบสินค้าที่ตรงกับ &quot;{q.trim()}&quot;</span>
                  : searchTotal > found.length
                    ? (
                      <span className="text-amber-700">
                        พบ <b>{searchTotal.toLocaleString('th-TH')}</b> รายการ แสดง {found.length} รายการแรก
                        — พิมพ์ให้เจาะจงขึ้นถ้ายังไม่เจอตัวที่ต้องการ
                      </span>
                    )
                    : <span className="text-gray-400">พบ {found.length.toLocaleString('th-TH')} รายการ</span>}
              </p>
            )}
          </div>

          {/* ── ปุ่มหมวดหมู่ — เครื่องจริงเลือกจากตรงนี้เป็นหลัก ── */}
          {!q.trim() && (
            <div className="px-3 pb-3">
              {cat && (
                <button
                  onClick={() => { setCat(''); setFound([]); setCatTotal(0) }}
                  className="text-[12.5px] text-blue-600 hover:underline mb-2"
                >
                  ‹ กลับไปเลือกหมวด
                </button>
              )}
              {!cat && (
                <div className="grid grid-cols-1 gap-1.5 max-h-[420px] overflow-y-auto">
                  {cats.length === 0 && <p className="text-[12.5px] text-gray-400">กำลังโหลดหมวด…</p>}
                  {cats.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => openCat(c.code)}
                      className="w-full flex items-center justify-between gap-2 text-left border border-gray-300 rounded-lg px-3 py-3 hover:bg-blue-50 transition-colors"
                    >
                      <span className="text-[13.5px] text-gray-800 truncate">{c.name}</span>
                      <span className="text-[12px] text-gray-400 shrink-0">{c.items.toLocaleString('th-TH')}</span>
                    </button>
                  ))}
                </div>
              )}
              {cat && catTotal > found.length && (
                <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
                  หมวดนี้มีทั้งหมด <b>{catTotal.toLocaleString('th-TH')}</b> ตัว
                  แสดง {found.length.toLocaleString('th-TH')} ตัวแรก — ใช้ช่องค้นหาด้านบนหาตัวที่ต้องการ
                </p>
              )}
            </div>
          )}

          {/* ผลค้นหา — กดทั้งแถวเพื่อเพิ่ม เป้าใหญ่กดด้วยนิ้วได้ */}
          {found.map((f) => (
            <button
              key={f.sku}
              onClick={() => addToCart(f)}
              className="w-full flex items-center gap-3 px-3 py-3 border-t border-gray-100 text-left hover:bg-blue-50 transition-colors"
            >
              {imgOf(f.sku)
                ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgOf(f.sku) as string} alt="" loading="lazy"
                    className="w-11 h-11 rounded border border-gray-200 object-cover bg-white shrink-0" />
                )
                : <span className="w-11 h-11 rounded border border-gray-200 bg-gray-100 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-gray-800 truncate">
                  {f.name || f.sku}
                  <PermitBadge permit={f.permit} />
                </p>
                <p className="text-[12px] text-gray-400">
                  {f.sku}
                  {/* 🔴 คงเหลือเป็นตัวช่วยดูเท่านั้น ห้ามเอาไปบล็อกการขาย */}
                  {' · '}คงเหลือ (ณ ตี 1) {Number(f.qty).toLocaleString('th-TH')}
                </p>
              </div>
              <span className="text-[15px] font-bold text-gray-900 shrink-0">{fmtBaht(f.price)}</span>
            </button>
          ))}

          {/* บิลที่พักไว้ */}
          {held.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="text-[12.5px] font-semibold text-gray-600 px-3 pt-3">
                บิลที่พักไว้ ({held.length})
              </p>
              {held.map((h) => {
                const w = heldWhen(h)
                return (
                <div key={h.id} className={`flex items-center gap-2 px-3 py-2.5 ${w.stale ? 'bg-amber-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-gray-800 truncate">
                      {h.customer || 'ไม่ระบุชื่อ'} · {h.lines.length} รายการ
                    </p>
                    {/* ⚠️ บิลพักข้ามวันต้องเห็นทันทีว่าไม่ใช่ของวันนี้
                        ของเดิมเก็บแค่ "14:30" ⇒ บิลเมื่อวานหน้าตาเหมือนบิลเมื่อกี้เป๊ะ
                        เรียกคืนผิดใบ = คิดเงินตะกร้าของลูกค้าคนอื่น
                        **ไม่ลบให้อัตโนมัติ** — ตะกร้าที่หายเองอันตรายกว่าตะกร้าที่ค้าง ให้คนตัดสิน */}
                    <p className={`text-[11.5px] ${w.stale ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
                      พักไว้ {w.text}{w.stale ? ' · ไม่ใช่บิลของช่วงนี้แล้ว' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => resumeBill(h.id)}
                    className="text-[12.5px] font-semibold text-white bg-[#1b3b73] rounded-lg px-3 py-2 shrink-0"
                  >
                    เรียกคืน
                  </button>
                  <button
                    onClick={() => saveHeld(held.filter((x) => x.id !== h.id))}
                    className="text-[12px] text-red-500 hover:underline shrink-0"
                  >
                    ทิ้ง
                  </button>
                </div>
                )
              })}
              <p className="text-[11px] text-gray-400 px-3 pb-3">
                ⚠️ บิลที่พักไว้เก็บใน<b>เครื่องนี้เท่านั้น</b> เปลี่ยนเครื่องแล้วจะไม่ตามไป
              </p>
            </div>
          )}
          </>
          )}
        </div>

        {/* แผงขวา */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-bold text-gray-800">บิลปัจจุบัน</p>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <>
                  <button
                    onClick={holdBill}
                    className="text-[12.5px] font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    พักบิล
                  </button>
                  <button onClick={() => setCart([])} className="text-[12.5px] text-red-500 hover:underline">
                    ล้างบิล
                  </button>
                </>
              )}
            </div>
          </div>

          {cart.length === 0 && (
            <p className="text-[13px] text-gray-400 px-4 py-10 text-center">กรุณาเลือกสินค้า</p>
          )}

          {cart.map((c) => (
            <div key={c.sku} className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-gray-800 truncate">
                  {c.name || c.sku}
                  <PermitBadge permit={c.permit} />
                </p>
                <p className={`text-[12px] ${(Number(c.price) || 0) <= 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {c.sku} · {fmtBaht(c.price)}/ชิ้น
                  {(Number(c.price) || 0) <= 0 && ' — ยังไม่ได้ตั้งราคา'}
                </p>
                {/* ส่วนลดต่อชิ้น — เครื่องจริงโชว์บรรทัด "ส่วนลด/หน่วย" ใต้ชื่อสินค้า */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11.5px] text-gray-500">ลด/ชิ้น</span>
                  <input
                    value={c.discount || ''}
                    onChange={(e) => setDiscount(c.sku, Number(e.target.value.replace(/[^0-9.]/g, '')))}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-20 h-8 text-[12.5px] text-right border border-gray-300 rounded px-2"
                  />
                  <span className="text-[11.5px] text-gray-400">บาท</span>
                </div>
              </div>
              {/* ปุ่มเพิ่ม/ลดเป้า 44px กดด้วยนิ้วได้ */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setQty(c.sku, c.qty - 1)}
                  className="w-11 h-11 rounded-lg border border-gray-300 text-[20px] text-gray-600 hover:bg-gray-50">−</button>
                <input
                  value={c.qty}
                  onChange={(e) => setQty(c.sku, Number(e.target.value.replace(/[^0-9]/g, '')) || 1)}
                  inputMode="numeric"
                  className="w-14 h-11 text-center text-[15px] font-semibold border border-gray-300 rounded-lg"
                />
                <button onClick={() => setQty(c.sku, c.qty + 1)}
                  className="w-11 h-11 rounded-lg border border-gray-300 text-[20px] text-gray-600 hover:bg-gray-50">+</button>
              </div>
              <span className="text-[15px] font-bold text-gray-900 w-24 text-right shrink-0">
                {fmtBaht(Math.max(0, c.price - (c.discount || 0)) * c.qty)}
              </span>
              <button onClick={() => removeLine(c.sku)}
                className="w-11 h-11 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0" title="เอาออกจากบิล">✕</button>
            </div>
          ))}

          {/* บล็อกสรุปแบบเครื่องจริง */}
          <div className="bg-blue-50/60 border-t border-gray-200 px-4 py-3">
            <div className="flex justify-between text-[13px] py-0.5">
              <span className="text-gray-600">สินค้ารวม</span>
              <span className="text-gray-800">{count.toLocaleString('th-TH')} ชิ้น</span>
            </div>
            <div className="flex justify-between text-[13px] py-0.5">
              <span className="text-gray-600">ราคารวม</span>
              <span className="text-gray-800">{fmtBaht(subtotal + lineDiscount)}</span>
            </div>
            <div className="flex justify-between text-[13px] py-0.5">
              <span className="text-gray-600">ส่วนลดรายชิ้น</span>
              <span className={lineDiscount > 0 ? 'text-red-600' : 'text-gray-400'}>
                {lineDiscount > 0 ? `− ${fmtBaht(lineDiscount)}` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px] py-0.5">
              <span className="text-gray-600">ส่วนลดท้ายบิล</span>
              <span className="flex items-center gap-1.5">
                <span className="text-red-600">−</span>
                <input
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-24 h-8 text-[12.5px] text-right border border-gray-300 rounded px-2 bg-white"
                />
                <span className="text-[11.5px] text-gray-400">บาท</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-blue-200">
              <span className="text-[15px] font-bold text-gray-800">ราคาสุทธิ</span>
              <span className="text-[26px] font-black text-gray-900 leading-none">{fmtBaht(total)}</span>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="px-3 py-2.5 border-t border-gray-100">
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="ชื่อลูกค้า (ไม่บังคับ)"
                className="w-full text-[13px] border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          {/* 🔴 ราคา 0 = ขายฟรี ต้องให้คนขายยืนยันเองเสมอ ห้ามปล่อยผ่านเงียบ ๆ */}
          {hasZero && (
            <label className="flex items-start gap-2.5 px-3 py-3 bg-red-50 border-t border-red-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allowZero}
                onChange={(e) => setAllowZero(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0"
              />
              <span className="text-[12.5px] text-red-800 leading-relaxed">
                <b>บิลนี้มีสินค้าราคา 0 บาท</b> ({zeroNames}) — ปกติแปลว่ายังไม่ได้ตั้งราคาในคลัง
                ติ๊กช่องนี้ก็ต่อเมื่อ<b>ตั้งใจแจกฟรีจริง ๆ</b>
              </span>
            </label>
          )}

          {/* ปุ่มใหญ่เต็มความกว้างแบบเครื่องจริง */}
          <button
            onClick={() => (step === 'cart' ? setStep('pay') : checkout())}
            disabled={saving || !branch || cart.length === 0 || (hasZero && !allowZero)}
            className="w-full text-[18px] font-bold text-white py-4 disabled:opacity-40"
            style={{ background: '#1b3b73' }}
          >
            {saving
              ? 'กำลังบันทึก…'
              : step === 'cart'
                ? `ต่อไป ${cart.length ? fmtBaht(total) : ''}`
                : 'ชำระเงิน'}
          </button>
        </div>
      </div>

      {/* ปิดยอดสิ้นวัน — แยกตามวิธีจ่าย เพราะแต่ละทางกระทบยอดคนละแบบ */}
      {byPay.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden mt-3">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[14px] font-bold text-gray-800">ปิดยอดวันนี้</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">
              ไม่นับใบที่ยกเลิกแล้ว · เงินสดนับในลิ้นชัก · โอนเช็คสลิป · บัตรกระทบยอดกับเครื่องรูด
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100">
            {byPay.map((r) => (
              <div key={r.method} className="bg-white px-4 py-3">
                <p className="text-[12px] text-gray-500">{payNames[r.method] || r.method}</p>
                <p className="text-[20px] font-black text-gray-900 leading-tight">{fmtBaht(r.amount)}</p>
                <p className="text-[11.5px] text-gray-400">{r.orders.toLocaleString('th-TH')} ใบ</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between px-4 py-3 border-t border-gray-200 bg-blue-50/60">
            <span className="text-[14px] font-bold text-gray-800">
              รวมทั้งวัน ({dayTotal.orders.toLocaleString('th-TH')} ใบ)
            </span>
            <span className="text-[22px] font-black text-gray-900">{fmtBaht(dayTotal.amount)}</span>
          </div>
        </div>
      )}

      {/* ประวัติวันนี้ */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mt-3">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[14px] font-bold text-gray-800">บิลของวันนี้</p>
          <button onClick={loadSales} className="text-[12.5px] text-blue-600 hover:underline">รีเฟรช</button>
        </div>
        {sales.length === 0 && <p className="text-[13px] text-gray-400 px-4 py-5">ยังไม่มีบิลวันนี้</p>}
        {sales.map((s) => {
          const voided = isVoid(s.status)
          return (
            <div key={s.number}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${voided ? 'opacity-50' : ''}`}>
              <span className="text-[13px] font-medium text-gray-800 w-[170px] shrink-0 truncate">{s.number}</span>
              <span className="text-[12.5px] text-gray-500 flex-1 truncate">{s.channel} · {s.customer || 'ไม่ระบุชื่อ'}</span>
              {voided && <Pill tone="red">ยกเลิกแล้ว</Pill>}
              <span className="text-[14px] font-bold text-gray-900 shrink-0">{fmtBaht(s.amount)}</span>
              {!voided && (
                <button onClick={() => voidSale(s.number)}
                  className="text-[12px] font-semibold text-red-500 hover:underline shrink-0">ยกเลิก</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
