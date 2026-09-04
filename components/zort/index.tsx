'use client'
// ชิ้นส่วนหน้าจอแบบ ZORT — ลอกจากภาพจอจริง (~/claude-shared/zort-ui/ ถ่าย 2 ก.ย. 2569)
//
// เจ้าของร้านสั่ง "UI ก็ต้องเหมือน ZORT 100%" · คนที่ใช้ ZORT ทุกวันต้องย้ายมาแล้วใช้เป็นทันที
// ⚠️ ห้ามเดาหน้าตาจากความทรงจำ — ทุกอย่างในไฟล์นี้อ้างจากภาพจอที่ถ่ายไว้
// ⚠️ แก้ที่ไฟล์นี้ที่เดียว แล้วมีผลทุกจอ — อย่าไปเขียนคลาสซ้ำในหน้า
//
// โครงที่เห็นซ้ำทุกจอของ ZORT:
//   ชื่อจอตัวใหญ่หนา → บรรทัดสรุป "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" → ปุ่มขวาบน
//   → แถวค้นหา (ช่องกลม + ลิงก์ค้นหาขั้นสูง · ขวาเป็นตัวกรอง) → แท็บสถานะมีจำนวนในวงเล็บ
//   → ตารางหัวเทาตัวเล็ก คอลัมน์แรกเป็นเลขลำดับ ลิงก์สีน้ำเงิน สถานะเป็นป้ายกลม เลขลบสีแดง
import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export const ZORT_BLUE = '#1b3b73'

/* ── หัวจอ ────────────────────────────────────────────────────────────── */
export function PageHead({
  title, summary, actions,
}: {
  title: string
  /** บรรทัดใต้ชื่อจอ เช่น "จำนวน 1,534 รายการ, มูลค่าทั้งหมด 1,804,130.3 บาท" */
  summary?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        {/* ⚠️ ZORT ใช้ฟอนต์ Prompt เหมือนเรา (ตรวจจาก zortout.com แล้ว) แต่หัวจอเขาน้ำหนัก 600
            ไม่ใช่ 700 และไม่บีบตัวอักษร — ของเดิมหนาและแน่นกว่าต้นแบบ */}
        <h1 className="text-[26px] leading-tight font-semibold text-gray-900">{title}</h1>
        {summary && <div className="text-[13px] text-gray-500 mt-1">{summary}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

/* ── ปุ่ม ──────────────────────────────────────────────────────────────
   ZORT ใช้ปุ่มทรงแคปซูล — ปุ่มรองพื้นขาวขอบเทา · ปุ่มหลักพื้นน้ำเงินเข้ม */
export function BtnPrimary({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="text-[13px] font-semibold text-white rounded-full px-5 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: ZORT_BLUE }}
    >
      {children}
    </button>
  )
}
export function BtnGhost({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-5 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/* ── แถวค้นหา ──────────────────────────────────────────────────────────── */
export function SearchRow({
  value, onChange, onSubmit, placeholder, right, advanced,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder?: string
  /** ฝั่งขวา — ZORT วางตัวเลือกช่วงเวลากับปุ่มตัวกรองไว้ตรงนี้ */
  right?: ReactNode
  /** ลิงก์ "ค้นหาขั้นสูง" ข้างช่องค้นหา */
  advanced?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">🔍</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
          placeholder={placeholder}
          className="w-[330px] max-w-full text-[13px] border border-gray-300 rounded-full pl-9 pr-3 py-2 focus:outline-none focus:border-gray-400"
        />
      </div>
      {advanced}
      {right && <div className="flex flex-wrap items-center gap-2 ml-auto">{right}</div>}
    </div>
  )
}

/** ลิงก์ข้อความสีน้ำเงินแบบที่ ZORT ใช้ ("ค้นหาขั้นสูง" · "แพ็คสินค้า") */
export function LinkText({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="text-[13px] text-blue-600 hover:underline">{children}</button>
  )
}

/* ── แท็บสถานะ (มีจำนวนในวงเล็บ + ขีดน้ำเงินใต้ตัวที่เลือก) ───────────────── */
export function Tabs({
  tabs, active, onChange, right,
}: {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
  right?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 mb-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`text-[13.5px] px-3.5 py-2.5 -mb-px border-b-2 transition-colors ${
            active === t.id
              ? 'border-blue-600 text-gray-900 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && <span className="text-gray-400"> ({t.count.toLocaleString('th-TH')})</span>}
        </button>
      ))}
      {right && <div className="ml-auto pb-1">{right}</div>}
    </div>
  )
}

/* ── ป้ายกลมบอกสถานะ ───────────────────────────────────────────────────
   ZORT: เขียว = สำเร็จ/ชำระครบ · ส้ม = รอโอน/รอชำระ · แดง = ยกเลิก · เทา = อื่น ๆ */
export type PillTone = 'green' | 'orange' | 'red' | 'gray' | 'blue'
const PILL: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-blue-700',
}
export function Pill({ tone = 'gray', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-block text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap ${PILL[tone]}`}>
      {children}
    </span>
  )
}

/** เดาโทนสีจากข้อความสถานะไทย/อังกฤษที่ระบบเรามีจริง
 *  ⚠️ ไม่รู้จัก = เทา ห้ามเดาเป็นเขียว — สถานะแปลก ๆ ที่ขึ้นเขียวคือจอโกหก */
export function toneOfStatus(s: string): PillTone {
  const t = String(s ?? '').toLowerCase()
  if (/ยกเลิก|cancel|void|คืน/.test(t)) return 'red'
  if (/สำเร็จ|complete|done|paid|ชำระครบ|approve/.test(t)) return 'green'
  if (/รอ|pending|wait|unpaid|ค้าง/.test(t)) return 'orange'
  return 'gray'
}

/* ── ตาราง ─────────────────────────────────────────────────────────────
   หัวตารางตัวเล็กสีเทา · เส้นคั่นบาง · แถวมี hover · ตัวเลขชิดขวา */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
export const TH = 'text-left font-normal text-[12px] text-gray-500 px-3 py-2.5 whitespace-nowrap'
export const THR = 'text-right font-normal text-[12px] text-gray-500 px-3 py-2.5 whitespace-nowrap'
export const TD = 'px-3 py-3 text-[12.5px] text-gray-700 align-top'
export const TDR = 'px-3 py-3 text-[12.5px] text-gray-800 align-top text-right whitespace-nowrap'

/** ตัวเลขในตาราง — **ติดลบต้องเป็นสีแดง** (ZORT ทำแบบนี้ในจอสินค้า คงเหลือ -2 -3) */
export function Num({ v, zeroRed = false }: { v: number; zeroRed?: boolean }) {
  const red = v < 0 || (zeroRed && v === 0)
  return (
    <span className={red ? 'text-red-500 font-semibold' : 'text-gray-800'}>
      {v.toLocaleString('th-TH')}
    </span>
  )
}

/* ── ป้ายช่องทางขาย ────────────────────────────────────────────────────
   ZORT วางโลโก้แพลตฟอร์มนำหน้าชื่อช่องทาง เพื่อให้กวาดตาแล้วรู้ทันทีว่าใบไหนมาจากไหน
   ⚠️ เรามีแต่โลโก้ TikTok ในโปรเจกต์ ไม่มี Shopee/Lazada — **ไม่ใช้โลโก้ปลอม**
      ใช้จุดสีประจำช่องทางแทน ได้ผลเดียวกันคือกวาดตาแล้วแยกออก และไม่อ้างของที่ไม่มี */
// เจ้าของร้านสั่งให้ใส่โลโก้จริง (2 ก.ย. 2569) — ก่อนหน้านี้ใช้จุดสีเพราะยังไม่มีไฟล์
// และเป็นเครื่องหมายการค้าของคนอื่น ซึ่งไม่ใช่เรื่องที่เราตัดสินใจแทนเจ้าของร้าน · ตอนนี้เขาสั่งแล้ว
// ไฟล์อยู่ public/logos/ · ช่องทางที่ไม่มีโลโก้ยังใช้จุดสีเหมือนเดิม (ไม่ทำโลโก้ปลอม)
// ⚠️ ต้องเป็น **ไอคอนสี่เหลี่ยม (app icon)** ไม่ใช่โลโก้ตัวอักษร
//    รอบแรกผมโหลดโลโก้แบบตัวอักษรมา (อัตราส่วน 3:1) ย่อลงกล่อง 16px แล้วอ่านไม่ออกเลย
//    เจ้าของร้านส่งภาพ ZORT มาให้ดูถึงเห็นว่าเขาใช้ไอคอนสี่เหลี่ยมเล็ก ๆ นำหน้าชื่อ
const CHANNEL_LOGO: [RegExp, string][] = [
  [/shopee/i, '/logos/shopee.png'],
  [/lazada/i, '/logos/lazada.png'],
  [/tiktok/i, '/logos/tiktok.png'],
  [/facebook|เฟ(ส|ซ)/i, '/logos/facebook.webp'],
  [/line|ไลน์/i, '/logos/line.png'],
  // เว็บร้านเองก็เป็นช่องทางขายหนึ่ง — เจ้าของร้านส่งโลโก้มาให้ 3 ก.ย. 2569
  // ⚠️ ต้องอยู่**ท้ายสุด** เพราะชื่อช่องทางอย่าง "Shopee-gucut" มีคำว่า gucut อยู่ด้วย
  //    ถ้าวางไว้บน จะกลายเป็นโลโก้ร้านเราทับโลโก้ Shopee ทุกแถว
  [/gucut|เว็บร้าน/i, '/logos/gucut.png'],
]
const CHANNEL_DOT: [RegExp, string][] = [
  [/gucut|เว็บ|web/i, 'bg-red-500'],
  [/pos|หน้าร้าน/i, 'bg-emerald-500'],
]
export function ChannelTag({ name }: { name: string }) {
  if (!name) return <span className="text-gray-400">—</span>
  const logo = CHANNEL_LOGO.find(([re]) => re.test(name))?.[1]
  const dot = CHANNEL_DOT.find(([re]) => re.test(name))?.[1] ?? 'bg-gray-400'
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {logo
        ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="w-[18px] h-[18px] rounded-[3px] object-contain shrink-0" />
        )
        : <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />}
      <span className="truncate">{name}</span>
    </span>
  )
}

/** วันที่แบบ ZORT: ใบล่าสุดเขียน "วันนี้ / เมื่อวานนี้" ไม่ใช่วันที่ดิบ
 *  ⚠️ เทียบด้วย "วันแบบไทย" เท่านั้น — ใช้วันของเครื่องผู้ใช้จะเพี้ยนถ้าเขาตั้งโซนเวลาอื่น */
export function relDay(day: string): string {
  if (!day) return '—'
  const thai = (back: number) =>
    new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)
  if (day === thai(0)) return 'วันนี้'
  if (day === thai(1)) return 'เมื่อวานนี้'
  return thaiDate(day)
}

const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** "2026-03-10" → "10 มี.ค. 2569" — รูปแบบเดียวกับที่ ZORT ใช้ทั้งระบบ
 *
 * ⚠️ **ทั้งร้านอ่านปี พ.ศ.** — โชว์ 2026 คู่กับ 2569 ต่างกัน 543 ปี
 *    คนที่กวาดตาเร็ว ๆ จะอ่านผิดปีทันที และไม่มีอะไรบนจอบอกว่ามันคนละระบบปี
 * ⚠️ **แปลงที่จอ ไม่ใช่ให้เซิร์ฟเวอร์ส่งวันที่ไทยมาเพิ่มอีกช่อง**
 *    ค่าดิบต้องใช้เรียงลำดับ/กรอง/ส่งต่อ PEAK ⇒ มีสองช่องเมื่อไหร่ วันหนึ่งจะไม่ตรงกัน
 *    หลักเดียวกับที่เราทำกับชื่อสถานะอยู่แล้ว: **เก็บดิบ แปลตอนแสดง**
 * ⚠️ อ่านไม่ออกให้คืนค่าเดิม ห้ามคืนค่าว่าง — วันที่หายทั้งคอลัมน์แย่กว่าวันที่รูปแบบแปลก */
/** วันแบบสั้นอย่าง ZORT: "2026-06-01" → "1/6/2569"
 *  ใช้ในบรรทัดสรุปช่วงเวลา ZORT เขียนแบบนี้ ไม่ใช่ ISO
 *  ⚠️ แปลงไม่ได้ให้คืนค่าเดิม ห้ามคืนค่าว่าง — ช่องว่างอ่านไม่ออกว่าคือวันไหน */
export function thaiShort(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return String(iso ?? '')
  return `${Number(m[3])}/${Number(m[2])}/${Number(m[1]) + 543}`
}

export function thaiDate(raw?: string | null): string {
  const s = String(raw ?? '').trim()
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const year = Number(m[1]), mon = Number(m[2]), day = Number(m[3])
  if (!year || mon < 1 || mon > 12 || !day) return s
  return `${day} ${TH_MONTH_SHORT[mon - 1]} ${year + 543}`
}

/* ── สถานะการชำระเงิน ─────────────────────────────────────────────────
   ⚠️ ค่าที่เซิร์ฟเวอร์ส่งมาเป็นค่าดิบจาก ZORT (Paid/Unpaid/PartialPaid)
      **เก็บดิบ แปลตอนแสดง** เหมือนชื่อสถานะ — ส่งค่าไทยกลับไปกรองจะกรองไม่ตรง
   ⚠️ ค่าที่ไม่รู้จักให้แสดงค่าดิบไปตรง ๆ **ห้ามเดาว่าเป็นชำระครบ**
      เดาผิดข้างนี้ = จอบอกว่าเก็บเงินแล้วทั้งที่ยังไม่ได้เงิน */
const PAY_TH: Record<string, { text: string; tone: PillTone }> = {
  Paid: { text: 'ชำระครบ', tone: 'green' },
  Unpaid: { text: 'ยังไม่ชำระ', tone: 'orange' },
  PartialPaid: { text: 'ชำระบางส่วน', tone: 'orange' },
  Partial: { text: 'ชำระบางส่วน', tone: 'orange' },
  Overpaid: { text: 'ชำระเกิน', tone: 'blue' },
  Voided: { text: 'ยกเลิก', tone: 'red' },
}
export function PaymentPill({ value }: { value?: string | null }) {
  const raw = String(value ?? '').trim()
  if (!raw) return <span className="text-gray-300">—</span>
  const hit = PAY_TH[raw]
  return <Pill tone={hit?.tone ?? 'gray'}>{hit?.text ?? raw}</Pill>
}

/* ── เมนูจุดสามจุดท้ายแถว ──────────────────────────────────────────────
   ⚠️ ใส่เฉพาะคำสั่งที่ทำได้จริง — ปุ่มที่กดแล้วไม่เกิดอะไรแย่กว่าไม่มีปุ่ม */
export interface RowMenuItem {
  label: string
  onClick?: () => void
  /** 🔴 ทำไม่ได้ตอนนี้ — ใส่ **เหตุผล** ไม่ใช่แค่ true
   *  ⚠️ เมนูที่ตัดรายการที่ทำไม่ได้ทิ้ง จะทำให้คนที่ชิน ZORT หาไม่เจอแล้วนึกว่าระบบเราทำไม่ได้
   *     ⇒ โชว์ให้ครบตามผัง แต่กดไม่ได้ **พร้อมบอกว่าทำไมและต้องไปทำที่ไหนแทน**
   *  ⚠️ ห้ามใส่แค่ "ยังไม่พร้อม" — คนอ่านต้องรู้ว่าต้องไปทำที่ไหนต่อ */
  disabled?: string
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="w-6 h-6 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 leading-none"
        title="เมนูลัด"
      >
        ⋮
      </button>
      {open && (
        <>
          {/* คลิกที่ไหนก็ได้เพื่อปิด — ไม่งั้นเมนูค้างจนกว่าจะกดปุ่มเดิมซ้ำ */}
          <span className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <span className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[150px] block">
            {items.map((it) => (
              it.disabled
                ? (
                  <span
                    key={it.label}
                    title={it.disabled}
                    className="block w-full text-left text-[12.5px] text-gray-300 px-3 py-1.5 cursor-not-allowed"
                  >
                    {it.label}
                  </span>
                )
                : (
                  <button
                    key={it.label}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick?.() }}
                    className="block w-full text-left text-[12.5px] text-gray-700 px-3 py-1.5 hover:bg-gray-50"
                  >
                    {it.label}
                  </button>
                )
            ))}
            {/* รายการสีเทาคือของที่ ZORT มีแต่เรายังทำไม่ได้ — ชี้ค้างเพื่อดูเหตุผล */}
            {items.some((it) => it.disabled) && (
              <span className="block text-[11px] text-gray-400 px-3 py-1.5 border-t border-gray-100">
                รายการสีเทายังทำไม่ได้ — ชี้ค้างเพื่อดูเหตุผล
              </span>
            )}
          </span>
        </>
      )}
    </span>
  )
}

/** บรรทัดสรุปใต้ชื่อจอแบบ ZORT: "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" */
export function summaryLine(count: number, amount?: number) {
  const a = typeof amount === 'number'
    // ZORT เขียน "1,804,130.3 บาท" — ทศนิยมท้ายที่เป็นศูนย์ไม่ถูกเติม
    ? `, มูลค่าทั้งหมด ${amount.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`
    : ''
  return `จำนวน ${count.toLocaleString('th-TH')} รายการ${a}`
}

/* ── จอว่าง แบบ ZORT ───────────────────────────────────────────────────
   ⚠️ ZORT **ไม่โชว์ตารางเปล่า** ตอนไม่มีข้อมูล — หัวตารางยังอยู่ แต่ในตัวตาราง
      เป็นรูปประกอบ + ลิงก์ชวนทำ + คำอธิบายว่าจอนี้มีไว้ทำอะไร
      (ภาพจริง zort-ui/28-zort-รายจ่ายอื่น-ว่าง-empty-state.jpg)
   ตารางเปล่าอ่านได้สองแบบ — "ไม่มีข้อมูล" กับ "โหลดไม่สำเร็จ" — และคนใช้แยกไม่ออก
   ⇒ ต้องบอกให้ชัดว่าไม่มีข้อมูลจริง ๆ และทำอะไรต่อได้ */
export function EmptyState({
  icon = '📄', title, detail, action, href, cols,
}: {
  icon?: string
  /** บรรทัดสีน้ำเงิน — ชวนให้ทำอะไรต่อ ไม่ใช่แค่บอกว่าว่าง */
  title: string
  detail?: string
  action?: ReactNode
  href?: string
  /** จำนวนคอลัมน์ของตาราง — ต้องใส่ให้ตรง ไม่งั้นแถวจะกินไม่เต็มความกว้าง */
  cols: number
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-12 text-center">
        <span className="block text-[40px] leading-none mb-2 opacity-70">{icon}</span>
        {href
          ? <Link href={href} className="block text-[13.5px] text-blue-600 hover:underline">{title}</Link>
          : <span className="block text-[13.5px] text-blue-600">{title}</span>}
        {detail && <span className="block text-[12.5px] text-gray-500 mt-1 max-w-[520px] mx-auto leading-relaxed">{detail}</span>}
        {action && <span className="block mt-2.5">{action}</span>}
      </td>
    </tr>
  )
}

/* ── โลโก้ช่องทางที่สินค้าลงขายอยู่ (คอลัมน์ Marketplace ของ ZORT) ──────────
   ⚠️ ต้องมาจาก **รายการสินค้าจริงบนแพลตฟอร์ม ไม่ใช่ประวัติการขาย**
      "เคยขายได้" กับ "กำลังลงขายอยู่" คนละเรื่อง
   ⚠️ ช่องทางที่ยังไม่มีไฟล์โลโก้ให้แสดงชื่อเป็นตัวหนังสือ **ห้ามซ่อน**
      ซ่อน = สินค้าดูเหมือนลงขายน้อยช่องทางกว่าความจริง
   ⚠️ ไม่มีข้อมูลเลยให้แสดงขีด **ห้ามแสดงว่างเปล่า** — ช่องว่างอ่านได้ว่า "ไม่ได้ลงขาย"
      ซึ่งเป็นคำกล่าวอ้างที่เรายังพิสูจน์ไม่ได้ */
const MARKET_LOGO: Record<string, { src: string; label: string }> = {
  shopee: { src: '/logos/shopee.png', label: 'Shopee' },
  lazada: { src: '/logos/lazada.png', label: 'Lazada' },
  tiktok: { src: '/logos/tiktok.png', label: 'TikTok' },
  gucut: { src: '/logos/gucut.png', label: 'gucut.com' },
}
/** ตราย่อของขนส่ง — **ไม่ใช่โลโก้ของเจ้านั้น และตั้งใจไม่ให้เหมือน**
 *
 * ZORT โชว์โลโก้จริงในคอลัมน์บริการขนส่ง แต่การเอาโลโก้ของขนส่งมาใช้
 * ต้องดูเงื่อนไขเครื่องหมายการค้าของเขาก่อน (ข้อสังเกตจากฝั่งท่อ 4 ก.ย. 2569)
 * ⇒ ใช้ **ตัวอักษรย่อบนพื้นสีกลาง** แทน — สื่อสารได้เท่ากันในตาราง
 *   ไม่ต้องโหลดไฟล์เพิ่ม และ **ไม่มีทางถูกเข้าใจว่าเป็นตราของเจ้านั้น**
 * ⚠️ ห้ามเปลี่ยนไปใช้สีประจำแบรนด์ของขนส่ง — สีประจำแบรนด์ก็เป็นส่วนหนึ่งของตราเหมือนกัน
 */
export function CarrierMark({ name }: { name?: string | null }) {
  const n = String(name ?? '').trim()
  if (!n) return null
  // เอาตัวแรกของคำแรกที่เป็นตัวอักษร — ชื่อไทย/อังกฤษใช้ได้เหมือนกัน
  const ch = (n.match(/[A-Za-zก-ฮ]/)?.[0] ?? '?').toUpperCase()
  return (
    <span
      title={n}
      aria-label={n}
      className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-slate-200 text-slate-600 text-[9px] font-bold leading-none shrink-0"
    >
      {ch}
    </span>
  )
}

export function MarketLogos(
  { list, by, from }: {
    list?: string[] | null
    /** จับคู่รหัสได้ยังไง — `exact` = รหัสตรงตัว · `base` = **เดารหัสฐานจากรหัสตัวเลือก** */
    by?: Record<string, string> | null
    /** ถ้าเดา: รหัสเต็มบนแพลตฟอร์มที่ตัดมา — ไล่กลับได้ในคลิกเดียว */
    from?: Record<string, string[]> | null
  },
) {
  if (!Array.isArray(list) || list.length === 0) return <span className="text-gray-300">—</span>
  return (
    <span className="flex items-center gap-1">
      {list.map((name) => {
        const k = String(name).toLowerCase()
        const hit = MARKET_LOGO[k]
        /* 🔴 **โลโก้ที่มาจากการเดาต้องดูออกว่าเดา**
           98% จับคู่ด้วยรหัสตรงตัว · อีก ~1% เดารหัสฐานจากรหัสตัวเลือก (00073-11.8-KK → 00073)
           วัดแล้วเดาถูกทุกตัวเท่าที่ตรวจ **แต่ "ถูกตอนนี้" ไม่เท่ากับ "ตรวจไม่ได้"**
           ⇒ ติดจุดส้มมุมบน แล้วชี้ค้างเห็นรหัสเต็มที่ตัดมา
           เกณฑ์ที่ตกลงกัน: การตีความทำได้ แต่ **ต้องพาไปดูของดิบได้จากจอที่คนใช้จริง** */
        const guessed = by?.[k] === 'base'
        const raw = from?.[k]
        const tip = guessed
          ? `${hit?.label ?? name} — จับคู่จากการเดารหัสฐาน\nรหัสบนแพลตฟอร์ม: ${(raw ?? []).join(' · ') || 'ไม่ทราบ'}`
          : (hit?.label ?? name)
        return (
          <span key={name} className="relative inline-flex shrink-0" title={tip}>
            {hit
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={hit.src} alt={hit.label} width={16} height={16}
                  className="w-4 h-4 rounded-[3px] object-contain" />
              : <span className="text-[10.5px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">{name}</span>}
            {guessed && (
              <span aria-label="จับคู่จากการเดารหัสฐาน"
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white" />
            )}
          </span>
        )
      })}
    </span>
  )
}

/** บอกว่ารอบนี้เช็คช่องทางไหนได้บ้าง — **จำเป็น ไม่ใช่รายละเอียดปลีกย่อย**
 *
 * ⚠️ **ห้ามเขียนสถานะของแพลตฟอร์มลงคอมเมนต์นี้ ให้เขียนเป็นเหตุการณ์+วันที่เท่านั้น**
 *    รายชื่อที่เช็คได้จริงมาจาก `checked` ตอนรัน ⇒ ข้อความบนจออัปเดตตัวเองอยู่แล้ว
 *    (กฎ stale-state-comments — 4 ก.ย. 2569 · คอมเมนต์เดิมตรงนี้เคยเขียนว่า
 *     "ยังเช็ค Lazada ไม่ได้ (รอ review)" แล้วค้างข้ามวันที่ Lazada ต่อสำเร็จ)
 *
 * **เหตุการณ์ 3 ก.ย. 2569** — เช็คได้เฉพาะ Shopee · ZORT บอกว่า Lazada เชื่อมไว้
 *    1,988 ตัว มากกว่า Shopee อีก ⇒ จอขาดโลโก้ Lazada เกือบสองพันตัว
 *    จึงต้องมีข้อความ "ยังเช็ค … ไม่ได้" ไม่งั้นคนอ่านจะสรุปว่าร้านแทบไม่ได้ขายบน Lazada
 *    ซึ่งตรงข้ามกับความจริงโดยสิ้นเชิง
 * **เหตุการณ์ 4 ก.ย. 2569** — Lazada ต่อสำเร็จ (1,870 รหัส) และเสียบเว็บร้านเองเข้ามาด้วย
 *    ⇒ ยิงของจริงได้ `checked: [gucut, shopee, lazada]` · เหลือ TikTok ที่ยังเช็คไม่ได้
 *    (ลิงก์อนุญาตขึ้นว่า "ไม่มีจำหน่ายในภูมิภาคของร้านค้าของคุณ")
 * ⚠️ Shopify จะไม่มีวันขึ้นเพราะร้านปิดไปแล้ว — เราถามแพลตฟอร์มเอง ไม่ได้ลอกจาก ZORT
 *    (ZORT ยังโชว์โลโก้ Shopify ค้างอยู่ที่ระดับสินค้า แต่ไม่มีในหน้าเชื่อมต่อแล้ว) */
/** 🔴 แถบเตือน "ช่องทางนี้เชื่อไม่ได้" — **ต้องวางบนหัวจอ เหนือตาราง**
 *
 *  ⚠️ **เคยวางไว้ท้ายตาราง แล้วไม่มีใครเห็น** (4 ก.ย. 2569)
 *     ฝั่งท่อเปิดจอ *เพื่อหาแถบนี้โดยเฉพาะ* รู้ว่าต้องมี รู้ว่าเขียนว่าอะไร
 *     แล้วยังรายงานว่า "ไม่ขึ้น" — ตรวจทีหลังด้วย innerText พบว่ามันวาดถูกทุกชั้น
 *     ⇒ **การทดสอบที่ดีที่สุดเท่าที่เป็นไปได้ว่ามองเห็นไหม และมันสอบตก**
 *  ⇒ กฎ: **ความรุนแรงของข้อความกำหนดตำแหน่ง** — "อย่าใช้ตัดสินใจ" ต้องอยู่**เหนือ**
 *     สิ่งที่ห้ามใช้ตัดสินใจ ไม่ใช่ใต้มัน 50 แถว
 *  🔎 เกณฑ์: **ถ้าต้องเลื่อนจอเพื่อเห็นคำเตือน = วางผิดที่แล้ว**
 */
export function MarketUnreliableBanner({ unreliable }: { unreliable?: Record<string, string> | null }) {
  const bad: [string, string][] = Object.entries(unreliable ?? {})
  if (bad.length === 0) return null
  return (
    <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
      {bad.map(([k, reason]) => (
        <p key={k}>
          🔴 <b>คอลัมน์ Marketplace: ข้อมูลของ {k} เชื่อไม่ได้ตอนนี้</b> — {reason}
          {' '}<b>อย่าใช้คอลัมน์นี้ตัดสินใจกับ {k} จนกว่าจะแก้เสร็จ</b>
        </p>
      ))}
    </div>
  )
}

export function MarketCoverage(
  { checked, failed, notConnected, at }: {
    checked?: string[] | null
    /** เจ้าที่ยิงแล้วพัง + **เหตุผล** (ท่อส่งมาตั้งแต่ 4 ก.ย. 2569) */
    failed?: Record<string, string> | null
    /** เจ้าที่ยังไม่ได้เชื่อมร้าน + เหตุผล */
    notConnected?: Record<string, string> | null
    /** เวลาที่ถามแพลตฟอร์มล่าสุด — เป็น UTC ต้องบวก 7 ก่อนโชว์ */
    at?: string | null
  },
) {
  const list = Array.isArray(checked) ? checked : []
  /** ⚠️ **"ยังเช็คไม่ได้" เฉย ๆ ไม่พอ ต้องบอกว่าเพราะอะไร**
   *  ของจริง: TikTok ไม่ได้พัง — มันยังไม่เคยถูกกดอนุญาต ซึ่งเป็นงานที่เจ้าของร้านทำได้เลย
   *  เขียนแค่ "เช็คไม่ได้" คนอ่านจะนึกว่าเป็นข้อจำกัดของระบบแล้วเลิกตาม (กฎ ❌ vs ⏳) */
  const why = (k: string) => (failed?.[k] ?? notConnected?.[k] ?? '').trim()
  if (list.length === 0) {
    return (
      <>คอลัมน์ <b>Marketplace</b> ยังไม่มีข้อมูล — กำลังต่อจากรายการสินค้าจริงบนแพลตฟอร์ม</>
    )
  }
  /** ⚠️ ใส่ `gucut` (เว็บร้านเอง) ไว้ในรายการที่ "ควรเช็คได้" ด้วย
   *  ปกติมันจะอยู่ใน `checked` เสมอเพราะอ่านจากไฟล์ในเครื่อง ไม่ได้ยิงออกไปข้างนอก
   *  ⇒ วันไหนมันหลุดหายไป **จอจะขึ้นว่า "ยังเช็ค gucut ไม่ได้" ให้เห็นทันที**
   *     ไม่ใช่เงียบ ๆ แล้วสินค้าที่ลงเว็บอย่างเดียวกลายเป็นขีดทั้งกอง */
  const ALL = ['gucut', 'shopee', 'lazada', 'tiktok']
  const missing = ALL.filter((x) => !list.some((c) => String(c).toLowerCase() === x))
  return (
    <>
      คอลัมน์ <b>Marketplace</b> ตรวจจากรายการสินค้าจริงบน <b>{list.join(' · ')}</b>
      {at && (
        // ⚠️ ค่าที่ท่อส่งมาเป็น UTC — ต้องบวก 7 แล้วเขียนกำกับว่าเป็นเวลาไทย
        <> · ถามล่าสุด{' '}
          <span title={String(at)}>
            {new Date(new Date(at).getTime() + 7 * 3600 * 1000)
              .toISOString().slice(11, 16)} น. (เวลาไทย)
          </span>
        </>
      )}
      {missing.length > 0 && (
        <> · <b className="text-amber-700">ยังเช็ค {missing.join(' · ')} ไม่ได้</b> —
          สินค้าที่ไม่มีโลโก้ของเจ้านั้น <b>ไม่ได้แปลว่าไม่ได้ลงขาย</b> แปลว่าเรายังมองไม่เห็น
          {/* บอกเหตุผลรายเจ้า — ต่างกันคนละเรื่อง: ยังไม่กดอนุญาต vs ยิงแล้วล่ม */}
          {missing.filter((k) => why(k)).map((k) => (
            <span key={k} className="block text-gray-500">· {k}: {why(k)}</span>
          ))}
        </>
      )}
    </>
  )
}
