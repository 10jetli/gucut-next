'use client'
// รายละเอียดรายการขาย — ลอกผังจากจอจริงของ ZORT (~/claude-shared/zort-ui/04-รายละเอียดใบขาย.jpg)
//
// ผังที่ลอกมาตามลำดับบนลงล่าง:
//   ลิงก์ย้อนกลับ → ชื่อจอตัวใหญ่ → ขวาบนเลขหน้า N/ทั้งหมด + ลูกศรเลื่อนใบก่อน/ถัดไป
//   → การ์ดสถานะ 3 ใบเรียงกัน → การ์ดคู่ ข้อมูล/ลูกค้า
//   → การ์ดสินค้า (ตาราง + บล็อกยอดรวมชิดขวา แถวสุดท้ายพื้นเทาเน้น)
//   → การ์ดคู่ล่างสุด ที่อยู่ผู้รับ / การจัดส่ง
//
// ⚠️ **ลูกศรเลื่อนใบถัดไปคือรายละเอียดที่คนใช้ทุกวันจะรู้สึกทันทีถ้าไม่มี** (ฝั่งท่อหลังบ้านย้ำมา)
//    ทำได้โดยส่งลำดับใบ (i) กับตัวกรองเดิมมาทาง URL แล้วขอเพื่อนบ้านสามใบจากรายการเดียวกัน
// ⚠️ **ช่องที่คลังเงาไม่ได้เก็บ ต้องเขียนว่า "ไม่ได้เก็บไว้" ห้ามเว้นว่างเฉย ๆ**
//    เว้นว่าง = คนอ่านนึกว่าลูกค้าไม่ได้กรอก ซึ่งคนละเรื่องกับเราไม่ได้เก็บ (เจตนาเรื่องความเป็นส่วนตัว)
import { Suspense, useCallback, useEffect, useState } from 'react'
import { SALE_DETAIL_PAY_STATUS, SALE_DETAIL_TRANSFER_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import { reconcileOrder } from '@/lib/order-money'
import SlipBox from '@/components/zort/SlipBox'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { Pill, toneOfStatus, TH, THR, TD, TDR, ZORT_BLUE, thaiDate } from '@/components/zort'

interface Order {
  id: string; source: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
  updated_at?: string
  /** ส่วนลดท้ายบิล (บาท) · ค่าส่ง (บาท) — ฝั่งท่อกำลังเพิ่มให้ (แจ้ง 14 ก.ย. 2569)
   *  📏 ฝั่งท่อยิงของจริง 14 ก.ย. 2569 17:38 น. แล้วพิสูจน์สูตรที่ coredb.mjs ใช้:
   *       ยอดหัวใบ = ผลรวมบรรทัด − bill_discount + ship_amount
   *     และพบว่าทั้ง 5 ใบที่มีส่วนต่าง มี bill_discount = 0 ทุกใบ
   *     ⇒ **ส่วนต่างที่เหลือคือค่าส่ง** (เช่น SO-202609022 ควรได้ ship_amount = 70)
   *  ⚠️ **จอยังไม่เขียนว่า "ค่าส่ง" จนกว่าตัวเลขจะลงตัวจริง** — ตอนนี้เป็นสมมติฐานที่ฝั่งท่อพิสูจน์
   *     จากสูตรในโค้ด ยังไม่ได้เห็นค่าจริงวิ่งผ่านจอ ⇒ เขียนจากสิ่งที่จอเห็นเท่านั้น
   *  🔴 `null` = แถวนั้นซิงก์ก่อนมีคอลัมน์ ⇒ "ไม่รู้" ห้ามตีเป็น 0 */
  bill_discount?: number | null
  ship_amount?: number | null
  /** สถานะการชำระเงิน · ขนส่งที่ใช้ · เก็บเงินปลายทางไหม — ท่อ list=orders ส่งมาอยู่แล้ว */
  pay_status?: string | null
  ship_channel?: string | null
  ship_name?: string | null
  is_cod?: number | boolean | null
  /** 🔴 **สามช่องนี้ท่อส่งมาตลอด แต่จอเขียนว่า "คลังเงาไม่ได้เก็บไว้"** (เจอตอนกวาดของจริง 14 ก.ย. 2569)
   *  วัดจาก GET list=orders&limit=200&cancelled=1 เมื่อ 14 ก.ย. 2569 17:22 น. (เวลาไทย):
   *    tracking_no มีค่า 139/200 แถว · ship_name 151/200 · ship_date 146/200
   *  ⇒ จอบอกว่าไม่มีของที่มีอยู่จริง — คนตามพัสดุจะเชื่อว่าต้องไปหาที่ ZORT ทั้งที่อยู่ตรงหน้า
   *  ⚠️ วัดซ้ำได้ด้วยคำสั่งเดิม · เลขจะเปลี่ยนตามใบใหม่ที่ไหลเข้ามา ดูสัดส่วนไม่ใช่ตัวเลขเป๊ะ */
  tracking_no?: string | null
  ship_date?: string | null
}
interface Item {
  line: number; sku: string; name: string; qty: number; amount: number
  /** ส่วนลด **ต่อชิ้น** (บาท) — ฝั่งท่อกำลังเพิ่มให้ (แจ้ง 14 ก.ย. 2569)
   *  🔴 **ต่อชิ้น ไม่ใช่ต่อบรรทัด** ⇒ ต้องคูณ qty เองก่อนรวม (ฝั่งท่อกำชับ)
   *  🔴 `null` = แถวนั้นซิงก์มาก่อนมีคอลัมน์ ⇒ **"ไม่รู้" ห้ามตีเป็น 0**
   *     (0 คือคำกล่าวอ้างว่าไม่มีส่วนลด — ผิดคนละเรื่องกับยังไม่รู้)
   *  ⚠️ ไม่มีช่องนี้เลย = ท่อรุ่นก่อน ⇒ คนละเรื่องกับ null อีกที */
  discount?: number | null
}

const VAT_RATE = 0.07

/** สถานะการชำระเงิน — คำมาจาก `lib/zort-words.ts` ที่เดียว
 *  🔴 **แผนที่เดิมของไฟล์นี้หลุดรอบกวาดแรก** (ฝั่งท่อจับได้ 15 ก.ย. 2569 · ใบ t_mu23dljn)
 *     เดิมเขียนเอง `{ Paid, Partial, Unpaid }` + `?? s` ⇒ ค่าที่ท่อส่งจริง
 *     **`Pending` · `Voided` · `Partial Payment` โชว์อังกฤษดิบในหน้ารายละเอียด**
 *     (รวมใบเงินค้าง z1/SO-202503029 ที่กำลังส่งถึงท่านประธาน — จอที่คนจะเปิดดูใบนั้นพอดี)
 *     และคำที่มีก็ผิดฝา: `Partial`/`Unpaid` ไม่ใช่ค่าที่ท่อส่งเลย · `ยังไม่ชำระ` ไม่ใช่คำของ ZORT
 *  📌 บทเรียน: กวาดรอบแรกผมหาจาก `STATUS_TH` (ชื่อที่ใช้ซ้ำ 5 ไฟล์) จึงไม่เจอไฟล์ที่ตั้งชื่อ `PAY_TH`
 *     ⇒ **กวาดคลาสนี้ต้องหาที่ "รูปแบบ" (`MAP[x] ?? x`) ไม่ใช่ที่ "ชื่อตัวแปร"** */
/* 🔴 **จอนี้ต้องใช้ชุดคำของ "จอรายละเอียด" ไม่ใช่ของตาราง** (อ่านจอ ZORT จริง 16 ก.ย. 2569)
   ตาราง `/Sell/list` เขียน "ยกเลิก" · จอรายละเอียด `/Sell/Details` เขียน **"ยกเลิกการชำระเงิน"**
   (กติกาของ ZORT: จอรายละเอียด/ตัวกรองใช้คำเต็ม · ตารางใช้คำย่อ) */
const payTh = (s?: string | null) =>
  !s ? 'ยังไม่ได้เก็บช่องนี้' : zortWord(SALE_DETAIL_PAY_STATUS, s).text
/** สถานะการโอนสินค้าของใบ — ช่อง `status` ของท่อ (คนละเรื่องกับสถานะการจัดส่งของขนส่ง) */
const transferTh = (s?: string | null) =>
  !s ? 'ยังไม่ได้เก็บช่องนี้' : zortWord(SALE_DETAIL_TRANSFER_STATUS, s).text

function Card({ title, icon, children, className = '' }: {
  title?: string; icon?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          {icon && <span className="text-[14px]">{icon}</span>}
          <p className="text-[14px] font-bold text-gray-800">{title}</p>
        </div>
      )}
      {children}
    </div>
  )
}

/** แถวป้ายชื่อฟิลด์ซ้าย–ค่าขวา แบบการ์ด "ข้อมูล"/"ลูกค้า" ของ ZORT */
function Field({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex gap-4 py-1.5">
      <span className="text-[12.5px] text-gray-500 w-[130px] shrink-0">{label}</span>
      <span className={`text-[12.5px] ${muted ? 'text-gray-400 italic' : 'text-gray-800'} break-words min-w-0`}>
        {value}
      </span>
    </div>
  )
}

function StatusCard({ icon, label, value, tone }: {
  icon: string; label: string; value: React.ReactNode; tone?: 'green' | 'orange' | 'gray'
}) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'orange' ? 'text-orange-500' : 'text-gray-800'
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[16px] shrink-0">{icon}</span>
      <div className="ml-auto text-right min-w-0">
        <p className="text-[11.5px] text-gray-400">{label}</p>
        <p className={`text-[14px] font-bold truncate ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function DetailInner() {
  const sp = useSearchParams()
  const id = sp.get('id') ?? ''
  const idx = Number(sp.get('i') ?? '-1')

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [nav, setNav] = useState<{ prev?: Order; next?: Order; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ตัวกรองเดิมของรายการที่กดเข้ามา — ต้องส่งต่อ ไม่งั้นใบถัดไปจะเป็นคนละชุด
  const listQs = useCallback((extra: Record<string, string>) => {
    const qs = new URLSearchParams({ list: 'orders' })
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    for (const [k, v] of Object.entries(extra)) qs.set(k, v)
    return qs
  }, [sp])

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุเลขใบ'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setOrder(d.order ?? null)
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [id])

  // เพื่อนบ้านสามใบ (ก่อนหน้า/ปัจจุบัน/ถัดไป) จากรายการชุดเดียวกัน
  const loadNav = useCallback(async () => {
    if (idx < 0) return
    try {
      const off = Math.max(0, idx - 1)
      const res = await fetch(`/api/web/core?${listQs({ limit: '3', offset: String(off) })}`)
      const d = await res.json()
      const rows: Order[] = Array.isArray(d?.rows) ? d.rows : []
      const at = rows.findIndex((r) => r.id === id)
      setNav({
        prev: at > 0 ? rows[at - 1] : undefined,
        next: at >= 0 && at + 1 < rows.length ? rows[at + 1] : undefined,
        total: Number(d?.total ?? 0),
      })
    } catch {
      setNav(null) // เลื่อนใบไม่ได้ไม่ควรทำให้ทั้งหน้าพัง
    }
  }, [idx, id, listQs])

  useEffect(() => { load(); loadNav() }, [load, loadNav])

  const backHref = (() => {
    const qs = new URLSearchParams()
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    const s = qs.toString()
    return s ? `/core/sales?${s}` : '/core/sales'
  })()

  const hrefFor = (o: Order, i: number) => {
    const qs = new URLSearchParams({ id: o.id, i: String(i) })
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    return `/core/sales/detail?${qs}`
  }

  const qty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const total = Number(order?.amount) || 0
  /* 🔴 **ยอดบรรทัดสินค้ากับยอดใบมาคนละช่อง และบางใบไม่เท่ากัน** (เจอกับของจริง 14 ก.ย. 2569)
     ⚠️ **รอบแรกผมเขียนว่า "แทบทุกใบ" ซึ่งผิด** — เพราะสุ่มดูแค่ 4 ใบที่บังเอิญเป็นช่องทางเดียวกัน
        พอวัดจริงทั้งชุดถึงรู้ว่าเป็นส่วนน้อย · **ตัวอย่างไม่กี่ใบไม่ใช่การวัด**
     📏 วัดจริง **14 ก.ย. 2569 17:32 น. (เวลาไทย)**: ยอดบรรทัด ≠ ยอดใบ **5 จาก 60 ใบ (8%)**
        วิธีวัดซ้ำ: GET `list=orders&limit=60&cancelled=1` แล้วยิง `?order=<id>` ทีละใบ
        เทียบ `amount` กับผลรวม `items[].amount`
        (เลขนี้ตายเร็ว — ใบใหม่ไหลเข้าตลอด ดูสัดส่วนไม่ใช่ตัวเลขเป๊ะ)
       SO-202609022 บรรทัด 80 · ยอดใบ 150 (ต่าง 70)
       SO-202609021 บรรทัด 1,092 · ยอดใบ 1,244 (ต่าง 152)
       SO-202609020 บรรทัด 30 · ยอดใบ 107 (ต่าง 77)
       SO-202609019 บรรทัด 240 · ยอดใบ 332 (ต่าง 92)
       SO-202609018 บรรทัด 620 · ยอดใบ 739 (ต่าง 119)
     ⚠️ ในห้าใบนั้นเป็น COD 4 ใบ **ไม่ใช่ COD 1 ใบ** ⇒ ส่วนต่างไม่ได้เกิดเฉพาะใบ COD
        ⇒ ยิ่งเดาว่าเป็น "ค่าส่ง" ไม่ได้
     ⚠️ **ก้อนที่ท่อส่งมาไม่มีช่องค่าส่งหรือส่วนลดท้ายบิลเลย** (ยิง GET ?order=z1/SO-202609021
        ดูช่องทั้งหมดแล้ว: id source number channel status amount customer order_date
        tracking_no ship_channel ship_name ship_date is_cod pay_status updated_at)
     ⇒ เราจึง **บอกไม่ได้ว่าส่วนต่างคืออะไร** — แต่ต้องบอกว่ามีส่วนต่างอยู่
        เดิมจอวางตารางสินค้าที่รวมได้ 1,092 ไว้เหนือยอดใบ 1,244 เฉย ๆ พร้อมแถว "ส่วนลด —"
        ⇒ คนอ่านเชื่อว่าตารางอธิบายยอดใบครบแล้ว ซึ่งเป็นกฎข้อ 4 ของโปรเจกต์ที่ห้ามทำ
     📌 ZORT **มีช่องพวกนี้อยู่จริง** ในเอกสารชนิดอื่น (ใบเสนอราคา/ใบคืน ส่ง discountamount กับ
        shippingamount มาครบ) ⇒ ถ้าคลังเงาเก็บสองช่องนี้เพิ่ม ส่วนต่างจะอธิบายได้ทันที
        — แจ้งฝั่งท่อไว้แล้ว 14 ก.ย. 2569 */
  /* 🔑 **ตรรกะเรื่องเงินอยู่ที่ lib/order-money.ts ที่เดียว** — จอแค่เอามาแสดง
     ย้ายออกจากไฟล์นี้ 14 ก.ย. 2569 หลังจากเขียนสูตรผิด (ลบส่วนลดรายบรรทัดซ้ำ) แล้วขึ้น production
     เพราะฟังก์ชันใน .tsx **เรียกจากเทสไม่ได้** ⇒ ไม่มีอะไรคุมสูตรเงินเลย
     เทส: scripts/tests/order-money.test.mjs (ยึดตัวเลขจากใบจริง · พิสูจน์แล้วว่าจับบั๊กเดิมได้) */
  const money = reconcileOrder({
    lines: items,
    amount: total,
    billDiscount: order?.bill_discount,
    shipAmount: order?.ship_amount,
  })
  const { linesTotal, gap, lineDiscount, hasDiscountField, lineDiscountUnknown, leftover } = money
  const hasGap = items.length > 0 && Math.abs(gap) > 0.009
  const billDiscount = order?.bill_discount
  const shipAmount = order?.ship_amount
  const canExplain = money.state === 'ok' || money.state === 'mismatch'
  const explained = money.state === 'ok'
  // ⚠️ ยอดก่อนภาษีกับภาษีเป็น **ค่าคำนวณ** จากยอดรวม ไม่ใช่ค่าที่เก็บไว้
  //    ใช้กติกา "ราคารวมภาษีแล้ว" ตามที่ ZORT แสดงให้ร้านนี้ · เขียนกำกับใต้บล็อกเสมอ
  const net = total / (1 + VAT_RATE)
  const vat = total - net

  return (
    <div className="p-4 md:p-6">
      {/* หัวจอ */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <Link href={backHref} className="text-[12px] text-blue-600 hover:underline">‹ รายการขาย</Link>
          <h1 className="text-[26px] leading-tight font-bold text-gray-900 tracking-tight mt-0.5">
            รายละเอียดรายการขาย
          </h1>
          {order && (
            <span className="inline-block mt-1 text-[11px] text-gray-500 border border-gray-300 rounded px-1.5 py-0.5">
              {order.source === 'z2' ? 'สาขา 2' : 'สาขา 1'}
            </span>
          )}
        </div>
        {nav && idx >= 0 && (
          <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
            <span>{(idx + 1).toLocaleString('th-TH')}/{nav.total.toLocaleString('th-TH')}</span>
            {nav.prev
              ? <Link href={hrefFor(nav.prev, idx - 1)} className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50">‹</Link>
              : <span className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300">‹</span>}
            {nav.next
              ? <Link href={hrefFor(nav.next, idx + 1)} className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50">›</Link>
              : <span className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300">›</span>}
          </div>
        )}
      </div>

      {error && <ErrorBox title="เปิดใบนี้ไม่ได้">{error}</ErrorBox>}
      {loading && !order && <LoadingState />}

      {order && (
        <div className="space-y-4">
          {/* การ์ดสถานะ 3 ใบ — **ลอกจาก `zort-ui/04-รายละเอียดใบขาย.jpg`**
              ZORT ใช้สามใบนี้ตอบคำถามที่คนเปิดใบขายอยากรู้จริง ๆ:
                **เงินมาหรือยัง · ของออกหรือยัง · ส่งกับใคร**
              🔴 ของเดิมเป็น สถานะรายการ · ช่องทางการขาย · ที่มาของข้อมูล
                 ⇒ สองใบหลังซ้ำกับกล่อง "ข้อมูล" ที่อยู่ใต้ลงมาไม่ถึงจอ
                    และไม่มีใบไหนตอบว่า "เงินมาหรือยัง" ซึ่งเป็นคำถามแรกของคนเปิดใบขาย */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard
              icon="💳" label="สถานะการชำระเงิน"
              value={payTh(order.pay_status)}
              tone={order.pay_status === 'Paid' ? 'green' : order.pay_status ? 'orange' : 'gray'}
            />
            {/* 🔴 **แก้ทั้งป้ายและค่า 16 ก.ย. 2569 — เดิมทั้งสองอย่างไม่ตรงกับ ZORT**
                ① ป้าย: ไปกดอ่านจอ ZORT จริงแล้ว การ์ดใบกลางของเขาชื่อ **"สถานะการโอนสินค้า"**
                   (ไม่ใช่ "สถานะการจัดส่ง") และค่าที่เห็นจริงคือ **"รอโอนสินค้า" · "ถูกยกเลิก"**
                   ⇒ นี่คือช่อง `status` ของใบ **ซึ่งท่อส่งมาให้อยู่แล้ว** ⇒ โชว์ได้เลย
                ② เดิมการ์ดนี้เขียน "ยังไม่ได้เก็บช่องนี้" ตายตัว ทั้งที่
                   · ของที่ ZORT โชว์ตรงนี้ = สถานะการโอน ซึ่งเรามี
                   · และสถานะการจัดส่งของขนส่ง (`shipStatus`) **กระจกเก็บแล้ว** — เห็นในเส้น `list=orders`
                     (ยิงตรวจ 16 ก.ย. 2569: `shipStatus: "รอยืนยัน"` · `shipStatusGroup` · `shipStatusKnown`)
                     แต่ **เส้นรายใบ `?order=` ยังไม่ส่งมา** ⇒ ขอฝั่งท่อไว้แล้ว
                ⇒ คำเดิม "ยังไม่ได้เก็บช่องนี้" เป็นเท็จสองชั้น (ทั้งของที่ ZORT โชว์ และของที่เรามี) */}
            <StatusCard
              icon="📦" label="สถานะการโอนสินค้า"
              value={transferTh(order.status)}
              tone={order.status === 'Success' ? 'green' : order.status ? 'orange' : 'gray'}
            />
            <StatusCard
              icon="🚚" label="การจัดส่งสินค้า"
              /* 🔴 **ห้าม fallback ไป `ship_name`** — ช่องนั้นคือ **ชื่อผู้รับ** ไม่ใช่ชื่อขนส่ง
                 (พิสูจน์ 16 ก.ย. 2569: ยิง `list=orders` 8 ใบ — `ship_channel` ว่างทั้ง 8
                  และ `ship_name` ตรงกับชื่อลูกค้า · จอนี้บรรทัดล่างก็ใช้ ship_name เป็น "ชื่อผู้รับ")
                 ⇒ เดิมการ์ด "การจัดส่งสินค้า" โชว์ **ชื่อคน** ในช่องที่ควรเป็นชื่อขนส่ง
                    ZORT โชว์ "Flash Express(COD)" ⇒ ของเราต้องขึ้นชื่อขนส่งหรือบอกว่ายังไม่ระบุ
                 ⚠️ และเอาชื่อลูกค้าไปวางในช่องขนส่ง = ข้อมูลส่วนตัวไปโผล่ผิดที่ด้วย */
              value={[order.ship_channel || 'ยังไม่ระบุขนส่ง',
                (order.is_cod === 1 || order.is_cod === true) ? '(COD)' : ''].filter(Boolean).join(' ')}
            />
          </div>

          {/* การ์ดคู่: ข้อมูล / ลูกค้า */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="ข้อมูล" icon="📄">
              <div className="px-4 py-3">
                <Field label="รายการ" value={<span className="text-blue-600 font-medium">{order.number}</span>} />
                <Field label="ประเภทรายการ" value="รายการขาย" />
                <Field label="วันที่" value={order.order_date || '—'} />
                <Field label="ช่องทางการขาย" value={order.channel || '—'} />
                {/* 🔵 ZORT ไม่มีช่องนี้ — เราเพิ่มเอง เพราะร้านมี ZORT สองบัญชี ต้องรู้ว่าใบนี้มาจากร้านไหน
                    ย้ายลงมาจากการ์ดบนสุด เพื่อเอาที่ว่างให้การ์ดที่ ZORT ใช้จริง */}
                <Field label="ที่มาของข้อมูล +เรา"
                  value={order.source === 'z2' ? 'ZORT สาขา 2' : 'ZORT สาขา 1'} />
              </div>
            </Card>
            <Card title="ลูกค้า" icon="👤">
              <div className="px-4 py-3">
                <Field label="ชื่อลูกค้า" value={order.customer || '—'} />
                <Field label="เบอร์โทรศัพท์" value="คลังเงาไม่ได้เก็บไว้" muted />
                <Field label="ที่อยู่ลูกค้า" value="คลังเงาไม่ได้เก็บไว้" muted />
              </div>
            </Card>
          </div>

          {/* การ์ดสินค้า */}
          <Card title="สินค้า" icon="📦">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className={TH} style={{ width: 44 }}>#</th>
                    <th className={TH}>รหัส</th>
                    <th className={TH}>ชื่อสินค้า</th>
                    <th className={THR}>จำนวน</th>
                    <th className={THR}>มูลค่าต่อหน่วย</th>
                    <th className={THR}>ส่วนลดต่อหน่วย</th>
                    <th className={THR}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-[13px] text-gray-400 text-center">
                      ใบนี้ไม่มีรายการสินค้าในคลังเงา
                    </td></tr>
                  )}
                  {items.map((it, i) => (
                    <tr key={it.line} className="border-b border-gray-100 last:border-0">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={`${TD} whitespace-nowrap`}>{it.sku || '—'}</td>
                      <td className={TD}>
                        {/* รายการในใบขายกดไปดูสินค้าได้ — ปลายทางมีจริงแล้ว */}
                        {it.sku
                          ? (
                            <Link href={`/core/stock/${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                              {it.name || '—'}
                            </Link>
                          )
                          : <span className="text-gray-700">{it.name || '—'}</span>}
                      </td>
                      <td className={TDR}>{Number(it.qty).toLocaleString('th-TH')}</td>
                      <td className={TDR}>{it.qty ? fmtMoney(it.amount / it.qty) : '—'}</td>
                      {/* ⚠️ **ห้ามเขียน 0** เพราะ 0 คือคำกล่าวอ้างว่าไม่มีส่วนลด ส่วนขีดคือ "ไม่รู้"
                          — ต่างกันตอนมีใบที่ลดจริง
                          🔴 สามสถานะ (ฝั่งท่อกำลังเพิ่มช่องนี้ให้ · 14 ก.ย. 2569):
                             ไม่มีช่อง = ท่อยังไม่ส่ง · null = แถวนี้ซิงก์ก่อนมีช่อง · เลข = ใช้ได้
                          ⚠️ ค่านี้เป็น **ต่อชิ้น** ⇒ คอลัมน์นี้ชื่อ "ส่วนลดต่อหน่วย" อยู่แล้ว แสดงตรง ๆ ได้
                             แต่ตอนเอาไปรวมท้ายใบต้องคูณ qty ก่อน */}
                      <td className={TDR}>
                        {!('discount' in it)
                          ? <span className="text-gray-300" title="ท่อยังไม่ส่งช่องนี้มา">—</span>
                          : it.discount === null
                            ? <span className="text-gray-400" title="แถวนี้ซิงก์มาก่อนมีช่องนี้">ไม่รู้</span>
                            : <span className="text-gray-800">{fmtMoney(Number(it.discount))}</span>}
                      </td>
                      <td className={TDR}>{fmtMoney(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* บล็อกยอดรวมชิดขวา — แถวสุดท้ายพื้นเทาเน้น เหมือน ZORT */}
            <div className="flex flex-wrap gap-6 px-4 py-4">
              <div className="min-w-[200px] flex-1">
                <p className="text-[12.5px] text-gray-500">หมายเหตุ</p>
                <p className="text-[12.5px] text-gray-400">—</p>
              </div>
              <div className="w-full md:w-[380px] ml-auto">
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">จำนวนทั้งหมด</span>
                  <span className="text-gray-800">{qty.toLocaleString('th-TH')}</span>
                </div>
                {/* 🔴 เดิมเป็นขีดกลางตายตัว ⇒ อ่านว่า "ไม่มีส่วนลด" ทั้งที่แปลว่า "ไม่ได้เก็บช่องนี้" */}
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">รวมบรรทัดสินค้า</span>
                  <span className="text-gray-800">{fmtMoney(linesTotal)}</span>
                </div>
                {/* ── ส่วนลดรายบรรทัด ── */}
                {/* ⚠️ **แถวนี้เป็นข้อมูลประกอบ ไม่ได้เข้าสมการเทียบยอด**
                    ยอดในบรรทัดสินค้าหักส่วนลดนี้มาแล้ว ⇒ เอามาลบอีกคือลบซ้ำ (เคยพลาดมาแล้ว)
                    ⇒ เขียนกำกับให้ชัด ไม่งั้นคนอ่านจะบวกลบตามเองแล้วได้เลขไม่ตรง */}
                {hasDiscountField && (
                  <div className="flex justify-between py-1.5 text-[12.5px]">
                    <span className="text-gray-500">
                      ส่วนลดรายบรรทัด
                      <span className="text-gray-400"> (รวมในยอดบรรทัดแล้ว)</span>
                    </span>
                    {lineDiscountUnknown
                      ? <span className="text-gray-400">ไม่รู้ (บางบรรทัดซิงก์ก่อนมีช่องนี้)</span>
                      : <span className="text-gray-800">{fmtMoney(lineDiscount ?? 0)}</span>}
                  </div>
                )}
                {/* ── ส่วนลดท้ายบิล ── */}
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">ส่วนลดท้ายบิล</span>
                  {billDiscount === undefined
                    ? <span className="text-gray-300">คลังเงายังไม่ส่งช่องนี้มา</span>
                    : billDiscount === null
                      ? <span className="text-gray-400">ไม่รู้ (ใบนี้ซิงก์ก่อนมีช่องนี้)</span>
                      : <span className="text-gray-800">{billDiscount === 0 ? fmtMoney(0) : `−${fmtMoney(billDiscount)}`}</span>}
                </div>
                {/* ── ค่าส่ง ── */}
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">ค่าส่ง</span>
                  {shipAmount === undefined
                    ? <span className="text-gray-300">คลังเงายังไม่ส่งช่องนี้มา</span>
                    : shipAmount === null
                      ? <span className="text-gray-400">ไม่รู้ (ใบนี้ซิงก์ก่อนมีช่องนี้)</span>
                      : <span className="text-gray-800">{shipAmount === 0 ? fmtMoney(0) : `+${fmtMoney(shipAmount)}`}</span>}
                </div>
                {/* 🔴 ส่วนที่ยัง**อธิบายไม่ได้** — ขึ้นเฉพาะตอนที่รู้ครบแล้วยังไม่ลงตัว
                    หรือตอนที่ยังไม่มีช่องให้อธิบายเลย · **ลงตัวแล้วต้องเงียบ** ไม่งั้นกลายเป็นเสียงเตือนปลอม */}
                {!canExplain && hasGap && (
                  <div className="flex justify-between py-1.5 text-[12.5px] text-amber-800">
                    <span>ส่วนต่างที่อธิบายไม่ได้</span>
                    <span className="font-semibold">{gap > 0 ? '+' : ''}{fmtMoney(gap)}</span>
                  </div>
                )}
                {canExplain && !explained && (
                  <div className="flex justify-between py-1.5 text-[12.5px] text-red-700">
                    <span>ยังเหลือที่อธิบายไม่ได้</span>
                    <span className="font-semibold">{(leftover ?? 0) > 0 ? '+' : ''}{fmtMoney(leftover ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">มูลค่าสุทธิก่อนภาษี</span>
                  <span className="text-gray-800">{fmtMoney(net)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">ภาษีมูลค่าเพิ่ม (7%)</span>
                  <span className="text-gray-800">{fmtMoney(vat)}</span>
                </div>
                <div className="flex justify-between py-2.5 px-3 mt-1 bg-gray-100 rounded">
                  <span className="text-[13px] font-bold text-gray-800">มูลค่ารวมสุทธิ</span>
                  <span className="text-[13px] font-bold text-gray-900">{fmtMoney(total)}</span>
                </div>
                {!canExplain && hasGap && (
                  <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-2 mt-2 leading-relaxed">
                    ⚠️ <b>บรรทัดสินค้ารวมได้ {fmtMoney(linesTotal)} แต่ยอดใบคือ {fmtMoney(total)}</b>
                    {' '}— ต่างกัน {fmtMoney(Math.abs(gap))}
                    <br />
                    {billDiscount === undefined || shipAmount === undefined
                      ? <>คลังเงา<b>ยังไม่ส่งช่องส่วนลดท้ายบิลกับค่าส่งมาให้จอ</b> จึงบอกไม่ได้ว่าส่วนต่างนี้คืออะไร</>
                      : <><b>ใบนี้ซิงก์มาก่อนมีช่องพวกนั้น</b> ⇒ ยังบอกไม่ได้ว่าส่วนต่างคืออะไร</>}
                    {' '}⇒ <b>อย่าอ่านตารางสินค้าว่าอธิบายยอดใบครบแล้ว</b> · ต้องดูใบจริงที่ ZORT
                  </p>
                )}
                {canExplain && !explained && (
                  <p className="text-[11px] text-red-900 bg-red-50 border border-red-300 rounded px-2.5 py-2 mt-2 leading-relaxed">
                    🔴 <b>รู้ค่าส่งกับส่วนลดครบแล้ว แต่ยอดยังไม่ลงตัว</b> — เหลือ {fmtMoney(Math.abs(leftover ?? 0))}
                    <br />
                    สูตรที่ฝั่งท่อใช้คือ ผลรวมบรรทัด − ส่วนลด + ค่าส่ง ⇒ <b>ถ้ายังไม่ลงตัวแปลว่ามีช่องที่เรายังไม่รู้จัก</b>
                    {' '}· แจ้งฝั่งท่อ อย่าเดาเอง
                  </p>
                )}
                <p className="text-[10.5px] text-gray-400 mt-2 leading-relaxed">
                  ⚠️ ยอดก่อนภาษีกับภาษีเป็น<b>ค่าที่คำนวณจากยอดรวม</b> โดยถือว่าราคารวมภาษีแล้ว
                  ไม่ใช่ตัวเลขที่เก็บไว้ในระบบ — ใบกำกับภาษีตัวจริงออกจาก PEAK
                </p>
              </div>
            </div>
          </Card>

          {/* การ์ดคู่ล่างสุด */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="ข้อมูลที่อยู่ผู้รับ" icon="📍">
              <div className="px-4 py-3">
                {/* 🔴 เดิมเขียนว่า "ไม่ได้เก็บชื่อ ที่อยู่ และเบอร์ผู้รับ" — **ชื่อผู้รับเก็บไว้จริง**
                    (ท่อส่ง ship_name มา 151/200 แถว · วัด 14 ก.ย. 2569 17:22 น.)
                    ⇒ พูดเกินไปหนึ่งช่อง แล้วช่องที่มีอยู่จริงก็เลยไม่ถูกแสดง */}
                {order.ship_name
                  ? <Field label="ชื่อผู้รับ" value={order.ship_name} />
                  : <Field label="ชื่อผู้รับ" value="ใบนี้ไม่มีชื่อผู้รับในคลังเงา" muted />}
                <p className="text-[12.5px] text-gray-400 italic mt-2">
                  ⚠️ <b>ที่อยู่และเบอร์ผู้รับ</b> คลังเงาไม่ได้เก็บไว้โดยตั้งใจ —
                  เก็บเท่าที่จำเป็นต่อการเทียบยอดเท่านั้น ดูที่อยู่เต็มได้ที่ระบบต้นทาง
                </p>
              </div>
            </Card>
            <Card title="ข้อมูลการจัดส่งสินค้า" icon="🚚">
              <div className="px-4 py-3">
                <Field label="ช่องทางการขาย" value={order.channel || '—'} />
                {/* 🔴 เดิมเขียนตายตัวว่า "คลังเงาไม่ได้เก็บไว้" ทั้งที่ท่อส่ง tracking_no มา 139/200 แถว
                    ⇒ คนตามพัสดุจะเชื่อว่าต้องไปหาที่ ZORT ทั้งที่เลขอยู่ตรงหน้า
                    ⚠️ **ใบที่ไม่มีเลขจริง ๆ ก็มี** ⇒ ต้องแยก "ใบนี้ยังไม่มีเลข" ออกจาก
                       "ระบบไม่เก็บเลข" — สองอันนี้พาไปคนละการกระทำ */}
                <Field label="ขนส่ง" value={order.ship_channel || 'ยังไม่ได้เก็บช่องนี้'} muted={!order.ship_channel} />
                <Field
                  label="เลขพัสดุ"
                  value={order.tracking_no || 'ใบนี้ยังไม่มีเลขพัสดุ (ไม่ใช่ว่าระบบไม่เก็บ)'}
                  muted={!order.tracking_no}
                />
                <Field label="วันส่งสินค้า"
                  value={order.ship_date ? thaiDate(order.ship_date) : 'ใบนี้ยังไม่มีวันส่ง'}
                  muted={!order.ship_date} />
              </div>
            </Card>
          </div>

          {/* ── การชำระเงิน · สลิป ────────────────────────────────────────────
              📍 **ตำแหน่งลอกจากจอจริงของ ZORT** — ใน `/Sell/Details` ลิงก์ "ดูสลิป" อยู่ใน
                 ตารางใต้หัวข้อ **การชำระเงิน** ซึ่งอยู่**ถัดจากที่อยู่ผู้รับ/การจัดส่ง**
                 ⇒ วางไว้ที่เดียวกัน คนที่ใช้ ZORT อยู่จะหาเจอโดยไม่ต้องเรียนใหม่
              ⚠️ จอนี้แสดง**เฉพาะสลิปที่เราเก็บไว้แล้ว** ไม่อัปโหลดและไม่แก้ของใน ZORT */}
          {/* ⚠️ การ์ดนี้มี **เฉพาะสลิป** — สถานะการชำระเงินอยู่ที่การ์ดสถานะด้านบนแล้ว
                 ห้ามเอามาแสดงซ้ำสองที่ (เลขเดียวกันสองทางคือที่มาของความสับสนในจอนี้มาก่อน) */}
          <Card title="การชำระเงิน — สลิปที่เก็บไว้" icon="🧾">
            <SlipBox docno={order.number} />
          </Card>

          <div className="pt-1">
            <Link
              href={backHref}
              className="inline-block text-[13px] font-semibold text-white rounded-full px-5 py-2"
              style={{ background: ZORT_BLUE }}
            >
              ‹ กลับไปรายการขาย
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SaleDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense ไม่งั้น build ของ Next ตก
  return (
    <Suspense fallback={<div className="p-6"><LoadingState /></div>}>
      <DetailInner />
    </Suspense>
  )
}
