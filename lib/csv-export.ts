/* ส่งออกตาราง — ที่เดียวของทั้งระบบ (ใบกระดาน t_mu1i74cu · 15 ก.ย. 2569)
 *
 * 🔴 **ทำไมต้องรวมมาไว้ที่เดียว**: ก่อนหน้านี้มีโค้ดส่งออก CSV กระจายอยู่ 3 จอ
 *    (ยอดซื้อ · รายงาน · ยอดขายฝั่งเว็บ) เขียนซ้ำกันทุกครั้ง
 *    ⇒ กฎของไฟล์ (ช่องว่างห้ามเป็น 0 · เวลาไทย · บอกว่าได้กี่แถวจากกี่แถว)
 *       ต้องถูกจำใหม่ทุกครั้งที่มีคนทำจอถัดไป ⇒ วันหนึ่งจะมีคนลืมสักข้อ
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 **กฎของไฟล์ที่ส่งออก — ฝั่งท่อกำชับ 15 ก.ย. 2569 · ห้ามถอด**
 *
 *  ① **ต้องครบทุกหน้าตามตัวกรอง ไม่ใช่แค่หน้าที่เห็นบนจอ**
 *     ⇒ `fetchAllPages()` วนหน้าให้เอง · เพดานของท่ออยู่ที่ 200 แถวต่อครั้ง
 *     ⚠️ ถ้าวนไม่ครบ (ชนเพดานกันวน / ท่อล่มกลางคัน) **ต้องเขียนลงไฟล์ว่าได้กี่แถวจากทั้งหมดกี่แถว**
 *        ไฟล์ที่ขาดแถวเงียบ ๆ อันตรายกว่าไฟล์ที่ไม่มี เพราะมันถูกเอาไปเทียบยอด
 *  ② **ช่องที่ท่อไม่ส่ง = เว้นว่าง ห้ามใส่ 0**
 *     ราคาทุนที่ยังไม่กรอก (281 ตัว) กับราคาทุน 0 บาท เป็นคนละเรื่องกันคนละโลก
 *     ⇒ ใส่ 0 ลงไฟล์ = คนเอาไปคิดกำไรแล้วได้กำไรเกินจริง โดยไม่มีอะไรฟ้อง
 *  ③ **เวลาเป็นเวลาไทย** (ท่อส่ง UTC) — บทเรียนเดิมจากกำหนดส่งในใบสั่งผลิต
 * ════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ไฟล์เป็น CSV (เปิดด้วย Excel ได้) ไม่ใช่ .xlsx จริง — โปรเจกต์ไม่มีไลบรารีเขียน xlsx
 *    และ CSV + BOM เปิดใน Excel ไทยได้ตรงทุกเครื่องที่ร้านใช้อยู่แล้ว (ของเดิม 3 จอก็ CSV)
 */

/** ค่าหนึ่งช่องในไฟล์ · `null`/`undefined` = ท่อไม่ส่งมา ⇒ เว้นว่าง */
export type Cell = string | number | null | undefined

/** 🔴 เว้นว่างเมื่อไม่รู้ — **ห้ามแปลงเป็น 0** (กฎข้อ ②) */
export function cellText(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  return v
}

/** เวลาจากท่อ (UTC) → "15/09/2569 00:30" เวลาไทย · ว่าง/อ่านไม่ออก ⇒ เว้นว่าง (กฎข้อ ③) */
export function thaiTimeCell(utc?: string | null): string {
  const s = String(utc ?? '').trim()
  if (!s) return ''
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  const th = new Date(t.getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(th.getUTCDate())}/${p(th.getUTCMonth() + 1)}/${th.getUTCFullYear() + 543} ${p(th.getUTCHours())}:${p(th.getUTCMinutes())}`
}

const esc = (v: Cell) => `"${cellText(v).replace(/"/g, '""')}"`

export interface Coverage {
  /** ได้แถวมาจริงกี่แถว */
  got: number
  /** ท่อบอกว่าทั้งชุดมีกี่แถว · null = ท่อไม่ได้บอก ⇒ **ห้ามเดาว่าเท่ากับ got** */
  total: number | null
  /** หยุดกลางคันเพราะอะไร · ว่าง = ครบ */
  stoppedBecause?: string
  /** 🔴 **เรื่องที่ท่อแจ้งว่าข้อมูลรอบนี้ไม่สมบูรณ์** เช่น `failed` ของบัตรสต็อกไม่ว่าง
   *  ⇒ ถึงจะได้แถวครบตาม total ก็ **ห้ามเขียนว่า "ครบ"** เพราะ total เองก็นับจากแหล่งที่ล่ม
   *  (ฝั่งท่อกำชับตรง ๆ 15 ก.ย. 2569: "ถ้า failed ไม่ว่างในหน้าไหน ห้ามเขียนหัวไฟล์ว่าครบ") */
  problems?: string[]
}

/** สรุปความครบถ้วนเป็นภาษาคน — ขึ้นทั้งบนจอและบรรทัดแรกของไฟล์ */
export function coverageText(c: Coverage): string {
  const extra = c.problems?.length ? ` · ${c.problems.join(' · ')}` : ''
  /* 🔴 มีเรื่องที่ท่อแจ้งว่าไม่สมบูรณ์ ⇒ ตัดสินก่อนทุกกรณี ห้ามตกไปที่สาขา "ครบ" */
  if (c.problems?.length) {
    return `⚠️ ได้ ${c.got.toLocaleString('th-TH')} แถว`
      + (c.total === null ? '' : ` จากที่ท่อนับได้ ${c.total.toLocaleString('th-TH')} แถว`)
      + ` — ยังไม่ครบ${extra}`
      + (c.stoppedBecause ? ` · หยุดเพราะ ${c.stoppedBecause}` : '')
  }
  if (c.total === null) {
    return `ได้ ${c.got.toLocaleString('th-TH')} แถว — ท่อไม่ได้บอกว่าทั้งหมดมีกี่แถว จึงยังไม่รู้ว่าครบหรือไม่`
      + (c.stoppedBecause ? ` · หยุดเพราะ ${c.stoppedBecause}` : '')
  }
  if (c.got >= c.total && !c.stoppedBecause) return `ครบทุกแถวตามตัวกรอง (${c.got.toLocaleString('th-TH')} แถว)`
  /* ⚠️ ห้ามใส่ ** แบบมาร์กดาวน์ — ข้อความนี้ลงไปในไฟล์ CSV และขึ้นบนจอแบบข้อความล้วน
     เคยใส่แล้วไฟล์จริงออกมาเป็น "— **ไม่ครบ**" อ่านแล้วสะดุด (เจอตอนยิงจริง 15 ก.ย. 2569) */
  return `⚠️ ได้ ${c.got.toLocaleString('th-TH')} แถว จากทั้งหมด ${c.total.toLocaleString('th-TH')} แถว — ยังไม่ครบ`
    + (c.stoppedBecause ? ` · หยุดเพราะ ${c.stoppedBecause}` : '')
}

/**
 * วนดึงทุกหน้าตามตัวกรอง
 * @param page ฟังก์ชันดึงหนึ่งหน้า — คืน `{ rows, total }` · `total` = ทั้งชุด (null ถ้าท่อไม่บอก)
 *
 * ⚠️ **เพดานกันวนไม่รู้จบ** — ถ้าท่อคืนแถวซ้ำหรือไม่ลด offset จะวนตลอดกาล
 *    ⇒ หยุดเมื่อครบ total · ได้ 0 แถว · หรือชนเพดานรอบ แล้ว **รายงานว่าหยุดเพราะอะไร**
 */
export async function fetchAllPages<T>(
  page: (offset: number, limit: number) => Promise<{
    rows: T[]
    total: number | null
    /** ท่อบอกเองว่าหมดแล้ว (เช่น `hasMore === false`) — เชื่อช่องนี้ก่อนการเทียบ total */
    done?: boolean
    /** เรื่องที่ทำให้รอบนี้ไม่สมบูรณ์ เช่น แหล่งข้อมูลบางแหล่งล่ม หรือชนเพดานความลึก */
    problem?: string
  }>,
  opts: { limit?: number; maxRequests?: number; onProgress?: (got: number, total: number | null) => void } = {},
): Promise<{ rows: T[]; coverage: Coverage }> {
  const limit = opts.limit ?? 200
  /* 🔴 **เพดานรอบต้องสูงพอให้ชุดจริงจบ** — ยิงจริง 15 ก.ย. 2569 จอโอนสินค้ามี 12,003 แถว
     เพดานเดิม 60 รอบ × 200 = 12,000 ⇒ **ขาดไป 3 แถว** แล้วไฟล์ประกาศว่าไม่ครบ
     ⇒ เพดานที่พอดีเป๊ะกับของจริงวันนี้ จะกลายเป็นน้อยไปพรุ่งนี้เสมอ ⇒ เผื่อให้เยอะ
     ⚠️ แต่ **ยังต้องมีเพดาน** — ถ้าท่อคืนแถวซ้ำหรือ offset ไม่ขยับ จะวนตลอดกาล
        และผู้ใช้จะเห็นแค่ปุ่มค้างอยู่โดยไม่รู้ว่าเกิดอะไรขึ้น */
  const maxRequests = opts.maxRequests ?? 250
  const rows: T[] = []
  let total: number | null = null
  let stoppedBecause = ''
  const problems: string[] = []
  for (let i = 0; i < maxRequests; i++) {
    let got
    try {
      // eslint-disable-next-line no-await-in-loop
      got = await page(rows.length, limit)
    } catch (e) {
      /* 🔴 ล่มกลางคัน ⇒ **คืนของที่ได้มาแล้วพร้อมป้ายว่าไม่ครบ** ไม่ใช่โยนทิ้งทั้งก้อน
         แต่ก็ห้ามเงียบ — ไฟล์ที่ขาดแถวโดยไม่บอกคือของอันตราย */
      stoppedBecause = `ดึงข้อมูลไม่สำเร็จกลางคัน (${e instanceof Error ? e.message : String(e)})`
      break
    }
    if (got.total !== null) total = got.total
    rows.push(...got.rows)
    if (got.problem && !problems.includes(got.problem)) problems.push(got.problem)
    opts.onProgress?.(rows.length, total)
    /* 🔴 **ห้าม dedupe แถวที่หน้าตาเหมือนกัน** — ฝั่งท่อยืนยัน 15 ก.ย. 2569 ว่าบัตรสต็อก
       รหัส 00313 มีแถวเหมือนกันเป๊ะ 106 แถว และ **เป็นข้อมูลจริง** (ใบเดียวมีหลายบรรทัด
       ที่เป็นรหัสเดียวกัน เช่นใบ 1011785606261766 มี 00313 ×1 อยู่ 5 บรรทัด)
       ⇒ ตัดซ้ำเมื่อไหร่ = ยอดในไฟล์หายไปเงียบ ๆ โดยดูเหมือนสะอาดขึ้น */
    if (got.done === true) break
    if (got.rows.length === 0) break
    /* เทียบ total เป็นตัวสำรองเมื่อท่อไม่ได้บอก done มา */
    if (got.done === undefined && total !== null && rows.length >= total) break
    if (i === maxRequests - 1) stoppedBecause = `ขอข้อมูลครบ ${maxRequests} รอบแล้วยังไม่หมด (กันวนไม่รู้จบ)`
  }
  return {
    rows,
    coverage: {
      got: rows.length, total,
      stoppedBecause: stoppedBecause || undefined,
      problems: problems.length ? problems : undefined,
    },
  }
}

export interface CsvFile {
  filename: string
  /** บรรทัดหัวเรื่องเหนือตาราง — ที่มาของไฟล์ ตัวกรองที่ใช้ ความครบถ้วน */
  preamble?: string[][]
  header: string[]
  rows: Cell[][]
}

/** สร้างเนื้อไฟล์ CSV (ไม่ดาวน์โหลด) — แยกออกมาเพื่อให้เทสเรียกได้ */
export function buildCsv(file: CsvFile): string {
  const lines = [...(file.preamble ?? []), file.header, ...file.rows]
  return lines.map((r) => r.map(esc).join(',')).join('\n')
}

/** สร้างไฟล์แล้วให้เบราว์เซอร์บันทึก · BOM ข้างหน้าเพื่อให้ Excel อ่านภาษาไทยถูก */
export function downloadCsv(file: CsvFile) {
  const url = URL.createObjectURL(new Blob(['﻿' + buildCsv(file)], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename.endsWith('.csv') ? file.filename : `${file.filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
