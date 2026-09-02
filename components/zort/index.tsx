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
const CHANNEL_DOT: [RegExp, string][] = [
  [/shopee/i, 'bg-orange-500'],
  [/lazada/i, 'bg-indigo-500'],
  [/tiktok/i, 'bg-gray-900'],
  [/gucut|เว็บ|web/i, 'bg-red-500'],
  [/pos|หน้าร้าน/i, 'bg-emerald-500'],
]
export function ChannelTag({ name }: { name: string }) {
  if (!name) return <span className="text-gray-400">—</span>
  const dot = CHANNEL_DOT.find(([re]) => re.test(name))?.[1] ?? 'bg-gray-400'
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
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
  return day
}

/* ── เมนูจุดสามจุดท้ายแถว ──────────────────────────────────────────────
   ⚠️ ใส่เฉพาะคำสั่งที่ทำได้จริง — ปุ่มที่กดแล้วไม่เกิดอะไรแย่กว่าไม่มีปุ่ม */
export function RowMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
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
              <button
                key={it.label}
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick() }}
                className="block w-full text-left text-[12.5px] text-gray-700 px-3 py-1.5 hover:bg-gray-50"
              >
                {it.label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  )
}

/** บรรทัดสรุปใต้ชื่อจอแบบ ZORT: "จำนวน N รายการ, มูลค่าทั้งหมด X บาท" */
export function summaryLine(count: number, amount?: number) {
  const a = typeof amount === 'number'
    ? `, มูลค่าทั้งหมด ${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
    : ''
  return `จำนวน ${count.toLocaleString('th-TH')} รายการ${a}`
}
