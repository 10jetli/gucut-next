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
  fetchAllPages, downloadCsv, coverageText, thaiTimeCell, type Cell, type Coverage,
} from '@/lib/csv-export'
import { BtnGhost } from './index'

export interface ExportSpec<T> {
  /** ชื่อไฟล์ (ไม่ต้องใส่ .csv) */
  filename: string
  /** ชื่อรายงานบรรทัดแรกของไฟล์ */
  title: string
  /** ตัวกรองที่ใช้ตอนส่งออก — **ต้องเป็นชุดเดียวกับที่จอกำลังกรองอยู่เป๊ะ**
   *  ไม่งั้นคนเทียบเลขในไฟล์กับเลขบนจอแล้วไม่ตรง โดยไม่มีใครรู้ว่าทำไม */
  filters?: [string, string][]
  /** ข้อความเตือนพิเศษของจอนั้น เช่น คอลัมน์ที่ไฟล์ไม่มี */
  note?: string
  /** ดึงหนึ่งหน้า · `total` = จำนวนที่ตรงตัวกรองทั้งชุด (null = ท่อไม่บอก) */
  fetchPage: (offset: number, limit: number) => Promise<{ rows: T[]; total: number | null }>
  header: string[]
  /** 🔴 ช่องที่ไม่รู้ให้คืน `null` **ห้ามคืน 0** — ตัวแปลงจะเว้นว่างให้เอง */
  toRow: (row: T) => Cell[]
  /** เพดานแถวต่อรอบ (ท่อส่วนใหญ่ 200) */
  limit?: number
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
      downloadCsv({
        filename: spec.filename,
        preamble: [
          [`${spec.title} (ส่งออกจาก admin.gucut.com)`],
          ['เวลาที่ส่งออก', thaiTimeCell(new Date().toISOString())],
          /* 🔴 ความครบถ้วนต้องอยู่ **ในไฟล์** — ไฟล์ออกนอกระบบไปแล้ว คนเปิดทีหลัง
             ไม่มีทางย้อนมาดูว่าจอเคยเตือนอะไรไว้ */
          ['ความครบถ้วน', coverageText(coverage)],
          ...(spec.note ? [['หมายเหตุ', spec.note]] : []),
          ...(spec.filters?.length ? [['ตัวกรองที่ใช้ตอนส่งออก', ''], ...spec.filters.map(([k, v]) => [`  ${k}`, v])] : []),
          [''],
        ],
        header: spec.header,
        rows: rows.map(spec.toRow),
      })
      onDone?.(coverage)
      if (coverage.stoppedBecause) setErr(coverageText(coverage))
    } catch (e) {
      setErr(`ส่งออกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <BtnGhost onClick={run} disabled={busy || disabled}>
        {busy ? `กำลังรวบรวม… ${got.toLocaleString('th-TH')} แถว` : label}
      </BtnGhost>
      {/* ⚠️ ได้ไม่ครบต้องขึ้นบนจอด้วย ไม่ใช่เขียนแต่ในไฟล์ — คนกดปุ่มอยู่ตรงนี้ */}
      {err && <span className="text-[11.5px] text-amber-800 mt-1 max-w-[320px] leading-snug">{err}</span>}
    </span>
  )
}
