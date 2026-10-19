'use client'
/* แผง "ค้นหาขั้นสูง" ที่ใช้ร่วมทุกจอ — ZORT มี `advanceSearch()` ทุกหน้ารายการ
 * (CEO สรุปรูปแบบจาก 3 หน้าแรก 15 ก.ย. 2569 · อนุมัติให้ทำเป็น component กลาง)
 *
 * 🔴 **สิ่งที่ตัวนี้มีไว้บังคับ ไม่ใช่แค่ลดโค้ดซ้ำ**
 *    ทำมาแล้ว 3 จอ (ขาย · จอทะเบียน · ผู้ติดต่อ) และทุกครั้งต้องจำกฎเดิมสามข้อ:
 *      ① **ใส่เฉพาะช่องที่ท่อกรองให้จริง** — ช่องที่กรอกแล้วไม่มีผลแย่กว่าไม่มีช่อง
 *         เพราะคนกรอกแล้วเชื่อว่ากรองแล้ว แล้วเอาตัวเลขไปใช้ต่อ
 *      ② **บอกว่าอะไรกรองที่เซิร์ฟเวอร์** — ต่างกันมากระหว่าง "กรองทั้งชุด"
 *         กับ "กรองเฉพาะหน้าที่เห็น" และคนอ่านแยกเองไม่ได้
 *      ③ **บอกว่าอะไร *ไม่มี* ให้กรอง และเพราะอะไร** — ไม่งั้นคนไล่หาช่องที่ไม่มีอยู่
 *         หรือแย่กว่านั้น คิดว่าเราลืมทำ แล้วไปทำซ้ำ
 *    ⇒ ช่อง `serverFiltered` กับ `notAvailable` จึงอยู่ในสัญญาของ component
 *       ไม่ใช่ของแถมที่แต่ละจอจะเขียนเองหรือลืมก็ได้
 *
 * ⚠️ **ข้อความในไฟล์นี้ไปโผล่ทุกจอที่เรียกใช้** ⇒ อยู่ในขอบเขต scripts/check-inherited.mjs
 *    เพิ่มจอใหม่แล้วตาข่ายจะบังคับให้อ่านว่าข้อความพวกนี้จริงกับจอนั้นไหม
 */
import type { ReactNode } from 'react'
import { BtnGhost, LinkText } from './index'
import { pipeText } from '@/components/ui/PipeNote'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export interface AdvField {
  label: string
  /** `date` = ช่องวันที่ · `check` = ติ๊กถูก · `text`/`number` = ช่องกรอก · `select` = ตัวเลือก
   *  ⚠️ **เพิ่มชนิดใหม่ได้ แต่ห้ามเพิ่มช่องที่ท่อไม่ได้กรองจริง** (กฎข้อ ① ของแผงนี้) */
  kind: 'date' | 'check' | 'text' | 'number' | 'select'
  value: string | boolean
  onChange: (v: string & boolean) => void
  /** สำหรับ `text`/`number` — ข้อความจาง ๆ ในช่อง */
  placeholder?: string
  /** สำหรับ `select` — ค่ากับป้ายที่คนอ่าน (ป้ายต้องเป็นคำที่ร้านใช้ ไม่ใช่ค่าดิบของ API) */
  options?: { value: string; label: string }[]
  /** ความกว้างช่อง (px) — ช่องยาวอย่างชื่อสินค้าต้องกว้างกว่าช่องตัวเลข */
  width?: number
  /** ช่องที่ ZORT มีแต่ท่อยังกรองไม่ได้ — วาดไว้ในตำแหน่งเดียวกับ ZORT แต่ **ปิด** พร้อมเหตุ (ชี้ค้างอ่านได้)
   *  🔴 ไม่ใช่ปุ่มหลอก: กรอกไม่ได้ ไม่ส่งค่า · จอที่ใช้ต้องใส่เหตุเดียวกันใน `notAvailable` ด้วย (เหตุต้องเห็นบนจอ ไม่ใช่แค่ใน title) */
  ปิดไว้?: string
}

/** ลิงก์เปิด/ปิดแผง — วางไว้ข้างช่องค้นหา (ตำแหน่งเดียวกับ ZORT) */
export function AdvancedSearchLink({ open, onToggle, แบบ = 'ลิงก์' }: {
  open: boolean
  onToggle: () => void
  /** 'ปุ่มตัวกรอง' = ปุ่มกรอบมีรูปกรวยแบบจอรายการขายของ ZORT (คำว่า "ตัวกรอง") · ค่าตั้งต้นคือลิงก์ "ค้นหาขั้นสูง" แบบจออื่น */
  แบบ?: 'ลิงก์' | 'ปุ่มตัวกรอง'
}) {
  if (แบบ === 'ปุ่มตัวกรอง') {
    return (
      <button type="button" onClick={onToggle} aria-expanded={open}
        className={`text-[12.5px] border rounded px-3 py-1.5 bg-white hover:bg-gray-50 ${open ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-700'}`}>
        {/* โหมดเหมือน ZORT: ไอคอนกรวยเส้นแบบปุ่ม ตัวกรอง ของ ZORT /Sell/list (วาดเอง ไม่ใช้ไอคอนของ ZORT) */}
        {เหมือนZORT
          ? <span className="inline-flex items-center gap-1.5"><svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" /></svg>ตัวกรอง</span>
          : '⏷ ตัวกรอง'}
      </button>
    )
  }
  return <LinkText onClick={onToggle}>{open ? 'ปิดค้นหาขั้นสูง' : 'ค้นหาขั้นสูง'}</LinkText>
}

export default function AdvancedSearch({
  open, fields, onApply, onClear, canClear, serverFiltered, clientFiltered, notAvailable, extraNote, applyLabel = 'ค้นหาตามเงื่อนไขนี้',
}: {
  open: boolean
  fields: AdvField[]
  onApply: () => void
  onClear: () => void
  /** ปุ่มล้างควรกดได้เมื่อมีอะไรให้ล้างเท่านั้น */
  canClear: boolean
  /** 🔴 ตัวกรองที่ **กรองที่เซิร์ฟเวอร์** ของจอนี้ — เขียนให้ครบ คนอ่านจะได้รู้ว่าครอบทั้งชุด
   *  ⚠️ **ไม่มีก็ได้** สำหรับจอที่ท่อยังไม่รับตัวกรองเลย — แต่ต้องใส่ `clientFiltered` แทน
   *     (เดิมช่องนี้บังคับ ⇒ จอที่กรองในเบราว์เซอร์ล้วนจะพูดประโยค "กรองที่เซิร์ฟเวอร์" ที่เป็นเท็จ
   *      เจอตอนต่อจอใบเสนอราคา 16 ก.ย. 2569 — ตาข่าย check-inherited จับได้ก่อนขึ้นจอ) */
  serverFiltered?: string
  /** 🔴 จอที่กรอง **ในเบราว์เซอร์** ต้องบอกให้ชัดว่ากรองจากอะไร (ทั้งชุด หรือเฉพาะที่โหลดมา)
   *  ข้อความนี้แทนบรรทัด "กรองที่เซิร์ฟเวอร์" ไม่ใช่มาเพิ่มข้าง ๆ กัน */
  clientFiltered?: string
  /** 🔴 สิ่งที่ **ไม่มีให้กรอง พร้อมเหตุผล** — ห้ามเว้นว่างเพราะขี้เกียจเขียน
   *  เว้นว่างได้เฉพาะจอที่ท่อรองรับครบทุกช่องที่ ZORT มีจริง ๆ */
  notAvailable?: { what: string; why: string }[]
  extraNote?: ReactNode
  applyLabel?: string
}) {
  if (!open) return null
  /* ช่องที่ปิดไว้: กล่องเทากรอกไม่ได้ · ป้ายจาง · เหตุใน title — ครอบทุกชนิดด้วยตัววาดเดียว */
  const ปิด = (f: AdvField) => (
    <label key={f.label} className="text-[12.5px] text-gray-400 cursor-not-allowed" title={`ยังกรองไม่ได้ — ${f.ปิดไว้}`}>
      {f.kind === 'check'
        ? <span className="flex items-center gap-2 pb-1.5"><input type="checkbox" disabled />{f.label}</span>
        : <>
          <span className="block mb-1">{f.label}</span>
          <input disabled type={f.kind === 'date' ? 'date' : 'text'} placeholder="ยังกรองไม่ได้"
            className="text-[12.5px] border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-400 cursor-not-allowed"
            style={{ width: f.kind === 'date' ? undefined : (f.width ?? 150) }} />
        </>}
    </label>
  )
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-3 flex flex-wrap items-end gap-3">
      {fields.map((f) => (f.ปิดไว้ ? ปิด(f) : f.kind === 'select' ? (
        <label key={f.label} className="text-[12.5px] text-gray-600">
          <span className="block mb-1">{f.label}</span>
          <select value={String(f.value)}
            onChange={(e) => f.onChange(e.target.value as string & boolean)}
            className="font-['Lato','Boon',sans-serif] text-[12px] text-[#555] h-7 border border-[#ccc] rounded px-2 py-1 bg-white"
            style={f.width ? { width: f.width } : undefined}>
            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ) : f.kind === 'text' || f.kind === 'number' ? (
        <label key={f.label} className="text-[12.5px] text-gray-600">
          <span className="block mb-1">{f.label}</span>
          <input
            type={f.kind === 'number' ? 'number' : 'text'}
            value={String(f.value)}
            placeholder={f.placeholder}
            onChange={(e) => f.onChange(e.target.value as string & boolean)}
            className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            style={{ width: f.width ?? 150 }}
          />
        </label>
      ) : f.kind === 'date' ? (
        <label key={f.label} className="text-[12.5px] text-gray-600">
          <span className="block mb-1">{f.label}</span>
          <input type="date" value={String(f.value)}
            onChange={(e) => f.onChange(e.target.value as string & boolean)}
            className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 bg-white" />
        </label>
      ) : (
        <label key={f.label} className="text-[12.5px] text-gray-700 flex items-center gap-2 cursor-pointer pb-1.5">
          <input type="checkbox" checked={!!f.value}
            onChange={(e) => f.onChange(e.target.checked as string & boolean)} />
          {f.label}
        </label>
      )))}

      <BtnGhost onClick={onApply}>{applyLabel}</BtnGhost>
      <BtnGhost onClick={onClear} disabled={!canClear}>ล้างเงื่อนไข</BtnGhost>

      {/* บรรทัดของตัวเองเสมอ — เดิมเป็นกล่องแคบ 440px ที่แทรกกลางแถวช่อง ⇒ แผงที่มีช่องเยอะ (รายการขาย 40+ ช่อง)
          ได้ช่องโหว่สูงเท่ากล่องเหตุผลคั่นกลางแถว (เห็นบน preview 19 ต.ค. 2569) */}
      <span className="basis-full text-[11.5px] text-gray-500 max-w-[900px] leading-snug">
        {/* ② อะไรกรองที่เซิร์ฟเวอร์ — "ครอบทั้งชุด" กับ "เฉพาะหน้าที่เห็น" คนละเรื่องกันมาก */}
        {serverFiltered && (
          <>✅ <b>{serverFiltered}</b> กรองที่เซิร์ฟเวอร์ — ครอบทุกรายการตามเงื่อนไข ไม่ใช่แค่หน้าที่เห็น</>
        )}
        {clientFiltered && (
          <span className="block">🖥️ <b>{clientFiltered}</b></span>
        )}
        {/* ③ อะไรไม่มีให้กรอง และเพราะอะไร */}
        {notAvailable?.map((n) => (
          <span key={n.what} className="block mt-1">
            ⚠️ ไม่มีตัวกรอง <b>{n.what}</b> — {pipeText(n.why)}
          </span>
        ))}
        {extraNote && <span className="block mt-1">{extraNote}</span>}
      </span>
    </div>
  )
}
