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
}

/** ลิงก์เปิด/ปิดแผง — วางไว้ข้างช่องค้นหา (ตำแหน่งเดียวกับ ZORT) */
export function AdvancedSearchLink({ open, onToggle }: { open: boolean; onToggle: () => void }) {
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
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-3 flex flex-wrap items-end gap-3">
      {fields.map((f) => (f.kind === 'select' ? (
        <label key={f.label} className="text-[12.5px] text-gray-600">
          <span className="block mb-1">{f.label}</span>
          <select value={String(f.value)}
            onChange={(e) => f.onChange(e.target.value as string & boolean)}
            className="text-[13px] border border-gray-300 rounded px-2 py-1.5 bg-white"
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
            className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            style={{ width: f.width ?? 150 }}
          />
        </label>
      ) : f.kind === 'date' ? (
        <label key={f.label} className="text-[12.5px] text-gray-600">
          <span className="block mb-1">{f.label}</span>
          <input type="date" value={String(f.value)}
            onChange={(e) => f.onChange(e.target.value as string & boolean)}
            className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white" />
        </label>
      ) : (
        <label key={f.label} className="text-[13px] text-gray-700 flex items-center gap-2 cursor-pointer pb-1.5">
          <input type="checkbox" checked={!!f.value}
            onChange={(e) => f.onChange(e.target.checked as string & boolean)} />
          {f.label}
        </label>
      )))}

      <BtnGhost onClick={onApply}>{applyLabel}</BtnGhost>
      <BtnGhost onClick={onClear} disabled={!canClear}>ล้างเงื่อนไข</BtnGhost>

      <span className="text-[11.5px] text-gray-500 max-w-[440px] leading-snug">
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
            ⚠️ ไม่มีตัวกรอง <b>{n.what}</b> — {n.why}
          </span>
        ))}
        {extraNote && <span className="block mt-1">{extraNote}</span>}
      </span>
    </div>
  )
}
