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

interface Branch { code: string; name: string }
interface Found { sku: string; name: string; price: number; qty: number }
interface CartLine { sku: string; name: string; price: number; qty: number }
interface SaleRow {
  number: string; channel: string; status: string
  amount: number; customer: string; order_date: string
}

const BRANCH_KEY = 'gucut-pos-branch'
const HOLD_KEY = 'gucut-pos-held'   // บิลที่พักไว้ — เก็บในเครื่อง ไม่แตะเซิร์ฟเวอร์

interface HeldBill { id: string; at: string; customer: string; lines: CartLine[] }
const thaiToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

export default function CorePosPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branch, setBranch] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [looking, setLooking] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ number: string; duplicate?: boolean } | null>(null)
  const [error, setError] = useState('')
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
  const searchRef = useRef<HTMLInputElement>(null)

  // บิลที่พักไว้ — อ่านครั้งเดียวตอนเปิดจอ
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOLD_KEY)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHeld(arr)
    } catch { /* ของพังในเครื่องไม่ควรทำให้เปิดจอขายไม่ได้ */ }
  }, [])

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
    setCart(b.lines)
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
    if (!term) { setFound([]); return }
    let alive = true
    setLooking(true)
    const t = setTimeout(() => {
      fetch(`/api/web/core?poslookup=${encodeURIComponent(term)}&limit=20`)
        .then((r) => r.json())
        .then((d) => { if (alive) setFound(Array.isArray(d?.rows) ? d.rows : []) })
        .catch(() => { if (alive) setFound([]) })
        .finally(() => { if (alive) setLooking(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  function addToCart(it: Found) {
    setCart((prev) => {
      const at = prev.findIndex((c) => c.sku === it.sku)
      if (at >= 0) {
        const next = [...prev]
        next[at] = { ...next[at], qty: next[at].qty + 1 }
        return next
      }
      return [...prev, { sku: it.sku, name: it.name, price: Number(it.price) || 0, qty: 1 }]
    })
    // 🔴 **เตือนตรงนี้เลย ไม่ใช่ตอนกดเก็บเงิน** — ของจริงคือแคชเชียร์ยิงบาร์โค้ดรัว ๆ
    //    ถ้าไปเตือนตอนท้าย เขาจะไม่รู้ว่าตัวไหนราคา 0 และอาจกดยืนยันผ่านไปเลย
    //    (เจอจริงตอนทดสอบ: รหัส 03409-3 ราคา 0 ⇒ บิลออก ฿0 โดยไม่มีอะไรเตือน = ขายฟรีไม่รู้ตัว)
    if ((Number(it.price) || 0) <= 0) {
      setError(`⚠️ "${it.name || it.sku}" ราคา 0 บาท (ยังไม่ได้ตั้งราคาในคลัง) — `
        + 'ใส่ลงบิลแล้วแต่จะเก็บเงินไม่ได้จนกว่าจะยืนยันว่าตั้งใจแจกฟรี')
    } else {
      setError('')
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

  // สินค้าราคา 0 ในบิล — ต้องรู้ทั้งว่ามีไหมและตัวไหน เพื่อบอกคนขายได้ว่าตัวไหน
  const zeroLines = useMemo(() => cart.filter((c) => (Number(c.price) || 0) <= 0), [cart])
  const hasZero = zeroLines.length > 0
  const zeroNames = useMemo(
    () => zeroLines.map((c) => c.name || c.sku).join(' · '),
    [zeroLines]
  )
  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])
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
    setDone(null)
    try {
      const res = await fetch('/api/web/core?sale=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branch,
          customer: customer.trim() || undefined,
          // ส่งเฉพาะตอนคนขายติ๊กยืนยันเองว่าตั้งใจแจกฟรี
          ...(allowZero ? { allowZero: true } : {}),
          // ⚠️ ท่อยังไม่มีที่เก็บวิธีจ่าย (ขอไว้แล้ว) — ส่งไปก่อนได้ ฟิลด์เกินถูกมองข้าม
          //    วันที่ท่อรับ ข้อมูลจะครบตั้งแต่ใบแรกโดยไม่ต้องมาไล่เติมย้อนหลัง
          payMethod,
          items: cart.map((c) => ({ sku: c.sku, name: c.name, qty: c.qty, price: c.price })),
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
      setDone({
        number: String(d?.order?.number ?? d?.number ?? ''),
        duplicate: !!d?.duplicate,
      })
      setAllowZero(false)
      setStep('cart')
      setTendered('')
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
            ? <>⚠️ ใบเลขนี้ <b>บันทึกไปแล้วก่อนหน้านี้</b> ({done.number}) ระบบไม่บันทึกซ้ำให้ — ไม่ได้เปิดใบใหม่</>
            : <>✅ เปิดบิลแล้ว เลขที่ <b>{done.number}</b></>}
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
            {!q.trim() && (
              <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
                เครื่องจริงที่หน้าร้านเลือกจาก<b>หมวดหมู่</b>ได้ด้วย —
                ของเรายังไม่มีข้อมูลหมวดหมู่ในคลัง (ขอไว้แล้ว) ระหว่างนี้ใช้ค้นหาไปก่อน
              </p>
            )}
          </div>

          {/* ผลค้นหา — กดทั้งแถวเพื่อเพิ่ม เป้าใหญ่กดด้วยนิ้วได้ */}
          {found.map((f) => (
            <button
              key={f.sku}
              onClick={() => addToCart(f)}
              className="w-full flex items-center gap-3 px-3 py-3 border-t border-gray-100 text-left hover:bg-blue-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-gray-800 truncate">{f.name || f.sku}</p>
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
              {held.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-gray-800 truncate">
                      {h.customer || 'ไม่ระบุชื่อ'} · {h.lines.length} รายการ
                    </p>
                    <p className="text-[11.5px] text-gray-400">พักไว้ {h.at}</p>
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
              ))}
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
                <p className="text-[14px] font-medium text-gray-800 truncate">{c.name || c.sku}</p>
                <p className={`text-[12px] ${(Number(c.price) || 0) <= 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {c.sku} · {fmtBaht(c.price)}/ชิ้น
                  {(Number(c.price) || 0) <= 0 && ' — ยังไม่ได้ตั้งราคา'}
                </p>
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
                {fmtBaht(c.price * c.qty)}
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
              <span className="text-gray-800">{fmtBaht(total)}</span>
            </div>
            {/* เว้นที่ไว้ให้ส่วนลด — เครื่องจริงมีสองบรรทัดนี้ ยังไม่ทำรอบแรก
                เว้นไว้เลยจะได้ไม่ต้องรื้อผังตอนเพิ่มทีหลัง */}
            <div className="flex justify-between text-[13px] py-0.5 text-gray-400">
              <span>ส่วนลด</span>
              <span>ยังไม่รองรับ</span>
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
