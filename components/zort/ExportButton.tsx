'use client'
/* ปุ่ม "ส่งออก Excel" ที่ใช้ร่วมทุกจอ — ใบกระดาน t_mu1i74cu (15 ก.ย. 2569)
 *
 * 🔴 **ทำไมต้องเป็นตัวประกอบร่วม ไม่ใช่ก๊อปโค้ดไปทีละจอ**
 *    กฎของไฟล์ที่ส่งออก (ครบทุกหน้า · ช่องว่างห้ามเป็น 0 · เวลาไทย · บอกความครบถ้วนในไฟล์)
 *    มีสี่ข้อและทุกข้อลืมได้ ⇒ ถ้าให้แต่ละจอเขียนเอง จอที่หกจะลืมสักข้อแน่นอน
 *    (โปรเจกต์นี้เพิ่งเจอ 3 ครั้งใน 2 วันว่า "บทเรียนที่แก้ไว้ทางหนึ่ง ไม่เดินไปหาพี่น้องของมันเอง")
 *
 * ⚠️ **แต่ของที่ใช้ร่วมกันก็มีหนี้ของมัน** — ข้อความในนี้ขึ้นจอของทุกจอที่เรียกใช้
 *    เพิ่มจอใหม่แล้วอย่าลืมอ่านว่าข้อความพวกนี้จริงกับจอนั้นไหม
 *    (ตัวประกอบร่วมสองตัวที่ scripts/check-inherited.mjs เฝ้าอยู่ เกิดมาจากบั๊กแบบนี้)
 */
import { useState } from 'react'
import {
  fetchAllPages, downloadCsv, coverageText, exportBlocked, exportFilename, thaiTimeCell,
  type Cell, type Coverage,
} from '@/lib/csv-export'
import { BtnGhost } from './index'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export interface ExportSpec<T> {
  /** ชื่อไฟล์ (ไม่ต้องใส่ .csv · ตัวปุ่มเติม "-ดึง<วันไทย>" ให้เองตามกติกาข้อ ③) */
  filename: string
  /** ชื่อรายงานบรรทัดแรกของไฟล์ */
  title: string
  /** ขอบเขตข้อมูลเป็นประโยคเดียว เช่น "ทั้งคลัง" / "ช่วง 01/09–18/09" / "ช่องทาง Shopee"
   *  🔴 กติกาข้อ ③+④ ของท่านประธาน — ต้องโผล่**ทั้งในชื่อไฟล์และหัวไฟล์**
   *  ไม่ใส่ = หัวไฟล์จะเขียนว่า "ทั้งชุดตามตัวกรองที่จอใช้อยู่" ซึ่งอ่อนกว่าการบอกตรง ๆ */
  scope?: string
  /** ตัวกรองที่ใช้ตอนส่งออก — **ต้องเป็นชุดเดียวกับที่จอกำลังกรองอยู่เป๊ะ**
   *  ไม่งั้นคนเทียบเลขในไฟล์กับเลขบนจอแล้วไม่ตรง โดยไม่มีใครรู้ว่าทำไม */
  filters?: [string, string][]
  /** ข้อความเตือนพิเศษของจอนั้น เช่น คอลัมน์ที่ไฟล์ไม่มี */
  note?: string
  /** ดึงหนึ่งหน้า · `total` = จำนวนที่ตรงตัวกรองทั้งชุด (null = ท่อไม่บอก) */
  fetchPage: (offset: number, limit: number) => Promise<{
    rows: T[]; total: number | null
    /** ท่อบอกเองว่าหมดแล้ว (เช่นไม่ส่ง nextOffset) — ใช้กับเส้นที่หน้าละไม่ถึง limit ที่ขอ */
    done?: boolean
  }>
  header: string[]
  /** 🔴 ช่องที่ไม่รู้ให้คืน `null` **ห้ามคืน 0** — ตัวแปลงจะเว้นว่างให้เอง */
  toRow: (row: T) => Cell[]
  /** เพดานแถวต่อรอบ (ท่อส่วนใหญ่ 200) */
  limit?: number
}

/** อีโมจิ/สัญลักษณ์นำหน้าป้าย (เช่น 📗) — โหมดเหมือน ZORT ตัดออก เพราะ ZORT ใช้ไอคอนไฟล์แทน */
const อีโมจินำหน้า = new RegExp('^\\P{L}+\\s*', 'u')

/** 📐 ปุ่มส่งออกแบบ ZORT (วัด DOM /Quotation/list 19 ต.ค. 2569: Kanit 12/400 ขอบ #adb5bd มุม 4 สูง 28 ช่องใน 8)
 *  export ไว้ให้ปุ่มดาวน์โหลดที่ไม่ได้ผ่าน ExportButton ใช้ค่าเดียวกัน — ไม่เดาสไตล์ใหม่ทีละจอ */
export const ZORT_EXPORT_BTN = "inline-flex items-center gap-1.5 bg-white border border-[#adb5bd] rounded-[4px] px-2 h-[28px] text-[12px] font-normal font-['Kanit',sans-serif] text-[#3e3e3e] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
/** ไอคอนไฟล์ที่วาดเอง (ไม่เอาไอคอนของ ZORT) */
export function ไอคอนไฟล์() {
  return <svg aria-hidden width="11" height="13" viewBox="0 0 11 13" fill="none" stroke="#3e3e3e" strokeWidth="1"><path d="M1 .5h6l3.5 3.5v8.5h-9.5z" /><path d="M3 6l4 4M7 6l-4 4" /></svg>
}

export default function ExportButton<T>({ spec, disabled, label = '📤 ส่งออก Excel', onDone }: {
  spec: ExportSpec<T>
  disabled?: boolean
  label?: string
  /** แจ้งจอเมื่อได้ไม่ครบ — จอควรขึ้นให้เห็นด้วย ไม่ใช่ซ่อนไว้ในไฟล์อย่างเดียว */
  onDone?: (c: Coverage) => void
}) {
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState(0)
  const [err, setErr] = useState('')

  async function run() {
    setBusy(true); setGot(0); setErr('')
    try {
      const { rows, coverage } = await fetchAllPages<T>(spec.fetchPage, {
        limit: spec.limit ?? 200,
        onProgress: (n) => setGot(n),
      })
      onDone?.(coverage)
      /* 🔴 **กติกาข้อ ② ของท่านประธาน (18 ก.ย. 2569): ไล่ไม่ครบ = ไม่ให้ไฟล์ออก**
         ต้องตัดสินใจ **ก่อน** downloadCsv เสมอ — ไม่ใช่ดาวน์โหลดไปก่อนแล้วค่อยเตือน */
      const ห้าม = exportBlocked(coverage)
      if (ห้าม) { setErr(ห้าม); return }

      const เวลาที่ดึง = new Date()
      downloadCsv({
        filename: exportFilename(spec.filename, spec.scope, เวลาที่ดึง),
        preamble: [
          [`${spec.title} (ส่งออกจาก admin.gucut.com)`],
          /* กติกาข้อ ④ — หัวไฟล์ต้องบอก **ดึงเมื่อไหร่** และ **ขอบเขตแค่ไหน** */
          ['เวลาที่ดึงข้อมูล', thaiTimeCell(เวลาที่ดึง.toISOString())],
          ['ขอบเขตข้อมูล', spec.scope || 'ทั้งชุดตามตัวกรองที่จอใช้อยู่ตอนกดส่งออก'],
          /* 🔴 ความครบถ้วนต้องอยู่ **ในไฟล์** — ไฟล์ออกนอกระบบไปแล้ว คนเปิดทีหลัง
             ไม่มีทางย้อนมาดูว่าจอเคยเตือนอะไรไว้
             (ตอนนี้ไฟล์ที่ไม่ครบไม่ออกแล้ว แต่ยังมีกรณี "ท่อไม่บอกจำนวนทั้งหมด"
              ซึ่งออกได้และต้องเขียนกำกับว่ายังไม่รู้ว่าครบไหม) */
          ['ความครบถ้วน', coverageText(coverage)],
          ...(spec.note ? [['หมายเหตุ', spec.note]] : []),
          ...(spec.filters?.length ? [['ตัวกรองที่ใช้ตอนส่งออก', ''], ...spec.filters.map(([k, v]) => [`  ${k}`, v])] : []),
          [''],
        ],
        header: spec.header,
        rows: rows.map(spec.toRow),
      })
      /* กติกาข้อ ⑥ (ท่านประธานขอไว้เป็นข้อเสริม): จดว่าใคร-จอไหน-เมื่อไหร่-กี่แถว
         ⚠️ **ห้ามส่งเนื้อข้อมูลไปที่บันทึก** — ส่งแค่ชื่อจอกับจำนวนแถว
         ⚠️ บันทึกล้มเหลว **ห้ามทำให้ไฟล์ที่ผู้ใช้ได้ไปแล้วดูเหมือนล้มเหลว** ⇒ เงียบ */
      void fetch('/api/export-log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ screen: spec.title, scope: spec.scope ?? null, rows: rows.length }),
      // ตรวจแล้ว: การกลืนนี้ตั้งใจ — ไฟล์ถึงมือผู้ใช้แล้วก่อนบรรทัดนี้ · บันทึกการส่งออกล้ม
      //   ต้องไม่ทำให้จอเขียนว่าส่งออกไม่สำเร็จ (ตรงกับโรค "ทำงานถูก แต่สื่อสารผิด")
      //   ⚠️ ราคาที่จ่าย: บันทึกอาจขาดเป็นช่วง ๆ โดยไม่มีใครรู้ ⇒ ถ้าวันหนึ่งบันทึกกลายเป็น
      //   หลักฐานที่ต้องครบ ต้องเปลี่ยนเป็นคิวที่ลองใหม่ ไม่ใช่ปล่อยเงียบแบบนี้ (19 ก.ย. 2569)
      }).catch(() => {})
    } catch (e) {
      setErr(`ส่งออกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      {/* 📐 โหมดเหมือน ZORT (ภาพ /Quotation/list · /Marketplace/List 19 ต.ค. 2569): ปุ่มเล็กพื้นขาวขอบเทา — วัด DOM /Quotation/list: Kanit 12/400 ขอบ #adb5bd มุม 4 สูง 28 ช่องใน 8 (เดิมเดาจากภาพ Lato 13 หนา ผิด)
           ไอคอนไฟล์วาดเอง (ไม่เอาไอคอนของ ZORT) · ตัดอีโมจินำหน้าป้ายออก · การทำงานเหมือนเดิมทุกอย่าง */}
      {เหมือนZORT ? (
        <button type="button" onClick={run} disabled={busy || disabled}
          className={ZORT_EXPORT_BTN}>
          <ไอคอนไฟล์ />
          {busy ? `กำลังรวบรวม… ${got.toLocaleString('th-TH')} แถว` : label.replace(อีโมจินำหน้า, '')}
        </button>
      ) : (
      <BtnGhost onClick={run} disabled={busy || disabled}>
        {busy ? `กำลังรวบรวม… ${got.toLocaleString('th-TH')} แถว` : label}
      </BtnGhost>
      )}
      {/* 🔴 ข้อความนี้คือ **ผลลัพธ์เดียวที่ผู้ใช้ได้** เมื่อไฟล์ไม่ออก — ไม่ใช่คำเตือนประกอบ
          ⇒ ใช้สีแดงเหมือนงานที่ไม่สำเร็จจริง ๆ (ของเดิมเป็นสีเหลือง เพราะตอนนั้นไฟล์ยังออกคู่กัน)
          กฎ CLAUDE.md: หัวข้อความต้องตรงกับสิ่งที่เกิดขึ้นจริง ไม่ใช่เรื่องถ้อยคำ */}
      {err && <span className="text-[11.5px] text-red-700 mt-1 max-w-[340px] leading-snug">{err}</span>}
    </span>
  )
}
