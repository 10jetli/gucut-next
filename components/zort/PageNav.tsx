/* ไล่หน้าด้วย **เลขหน้า** — ของเดิมมีแค่ ← ก่อนหน้า / ถัดไป →
 *
 * 🔬 ทำไมต้องมี (วัดจอ ZORT จริง 16 ก.ย. 2569 · จอ `/Product/list`):
 *    ZORT ไล่หน้าด้วยเลขหน้าเสมอ (`1 2 3 … 73 74 … 143 144 145`) ⇒ คนที่ใช้ ZORT อยู่
 *    **กดข้ามไปหน้าที่ต้องการได้ในคลิกเดียว** และรู้ทันทีว่าทั้งชุดมีกี่หน้า
 *    ของเรามีแต่ปุ่มถัดไป ⇒ อยากดูหน้า 40 ต้องกด 39 ครั้ง = บังคับให้ลูกน้องปรับตัว (ผิดคำสั่งท่านประธาน)
 *
 * ⚠️ **ผังเลขหน้าของ ZORT ไม่ได้ลอกมาทั้งดุ้น** — ที่เห็นคือหน้าแรก (1-10 · กลาง 2 หน้า · ท้าย 3 หน้า)
 *    ยังไม่ได้ไปยืนยันว่าหน้าอื่นเรียงยังไง ⇒ **ห้ามเดาแล้วเขียนเหมือนพิสูจน์แล้ว**
 *    ตัวนี้ใช้ผังมาตรฐาน (หน้าแรก · หน้ารอบตัวเอง ±2 · หน้าสุดท้าย) ซึ่งกดข้ามได้เหมือนกัน
 *
 * 🔴 **สามสถานะของ "ทั้งชุดมีกี่ใบ"** — `total` เป็น `null`/`undefined` ได้ (ท่อบางเส้นไม่บอก)
 *    ⇒ ตอนนั้น **ห้ามคิดเลขหน้าสุดท้ายเอง** และห้ามเขียนว่า "หน้า 3 จาก 3"
 *       เหลือแค่ปุ่มก่อนหน้า/ถัดไป + เขียนตรง ๆ ว่ายังไม่รู้ว่ามีกี่หน้า
 */
'use client'

type Props = {
  /** แถวแรกของหน้านี้ (0 = หน้าแรก) */
  offset: number
  /** จำนวนแถวต่อหน้า — ต้องเป็นค่าที่ส่งไปที่ท่อจริง ๆ ไม่ใช่จำนวนแถวที่ได้กลับมา */
  perPage: number
  /** จำนวนทั้งชุดตามที่ท่อบอก · `null`/`undefined` = **ยังไม่รู้** (ห้ามแทนด้วย 0) */
  total?: number | null
  /** จำนวนแถวที่ได้จริงในหน้านี้ — ใช้ตัดสินว่ายังมีหน้าถัดไปไหมตอนไม่รู้ total */
  rowsOnPage: number
  onGo: (offset: number) => void
  /** มีตัวเลือก "จำนวนต่อหน้า" ด้วยไหม — ส่งมาเมื่อจอรองรับการเปลี่ยนจำนวนจริง ๆ เท่านั้น
   *  ⚠️ **เปลี่ยนแล้วต้องกลับหน้าแรกเสมอ** ไม่งั้น offset เดิมชี้กลางชุด แล้วคนงงว่าแถวหายไปไหน
   *     (จอที่เรียก onPerPage ต้องยิงใหม่ด้วย offset 0 พร้อมค่าใหม่ในรอบเดียวกัน —
   *      setState ไม่ทันในรอบเดียว จึงส่งค่าใหม่ไปกับคำสั่งโหลดตรง ๆ) */
  onPerPage?: (size: number) => void
  disabled?: boolean
}

/** ชุดจำนวนต่อหน้า — **ชุดเดียวกับ ZORT เป๊ะ** (อ่านจากจอจริง 16 ก.ย. 2569) */
export const PAGE_CHOICES = [10, 20, 50, 100]

const BTN = 'px-2.5 py-1.5 rounded border text-[13px] leading-none disabled:opacity-40 disabled:cursor-not-allowed'
const PLAIN = `${BTN} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`
const HERE = `${BTN} bg-[#4669e5] border-[#4669e5] text-white font-semibold`

/** หน้าที่จะโชว์: หน้าแรก · รอบตัวเอง ±2 · หน้าสุดท้าย (ที่เหลือเป็น …) */
function pagesToShow(cur: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const near = [cur - 2, cur - 1, cur, cur + 1, cur + 2].filter((p) => p > 1 && p < last)
  const out: (number | '…')[] = [1]
  if (near[0] > 2) out.push('…')
  out.push(...near)
  if (near[near.length - 1] < last - 1) out.push('…')
  out.push(last)
  return out
}

export default function PageNav({ offset, perPage, total, rowsOnPage, onGo, onPerPage, disabled }: Props) {
  const cur = Math.floor(offset / perPage) + 1
  const รู้จำนวนทั้งชุด = typeof total === 'number'
  const last = รู้จำนวนทั้งชุด ? Math.max(1, Math.ceil((total as number) / perPage)) : null
  /* ไม่รู้ total ⇒ เดาไม่ได้ว่าหน้านี้เป็นหน้าสุดท้ายไหม
     ใช้หลักฐานที่มี: ได้แถวเต็มหน้า = น่าจะยังมีต่อ · ไม่เต็ม = จบแล้ว */
  const มีหน้าถัดไป = รู้จำนวนทั้งชุด ? cur < (last as number) : rowsOnPage >= perPage

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] text-gray-500 mr-1">
        {รู้จำนวนทั้งชุด
          ? <>หน้า {cur.toLocaleString('th-TH')} จาก {(last as number).toLocaleString('th-TH')}</>
          : <span className="text-amber-800">หน้า {cur.toLocaleString('th-TH')} · ยังไม่รู้ว่าทั้งชุดมีกี่หน้า (ท่อไม่ได้บอกจำนวนทั้งหมด)</span>}
      </span>

      <button type="button" className={PLAIN} disabled={disabled || cur === 1}
        onClick={() => onGo(Math.max(0, offset - perPage))}>← ก่อนหน้า</button>

      {last !== null && pagesToShow(cur, last).map((p, i) => (
        p === '…'
          ? <span key={`gap${i}`} className="px-1 text-gray-400 select-none">…</span>
          : (
            <button key={p} type="button" className={p === cur ? HERE : PLAIN}
              disabled={disabled || p === cur} onClick={() => onGo((p - 1) * perPage)}>
              {p.toLocaleString('th-TH')}
            </button>
          )
      ))}

      <button type="button" className={PLAIN} disabled={disabled || !มีหน้าถัดไป}
        onClick={() => onGo(offset + perPage)}>ถัดไป →</button>

      {onPerPage && (
        <>
          <span className="text-[12px] text-gray-500 ml-1">จำนวนต่อหน้า</span>
          <select value={perPage} disabled={disabled}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="text-[13px] border border-gray-300 rounded px-2 py-1.5 bg-white">
            {PAGE_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </>
      )}
    </div>
  )
}
