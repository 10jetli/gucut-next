'use client'
// เทียบ "ยอดรวมบรรทัดที่ท่อคิด" กับ "ยอดที่จอคิด" — ใช้ร่วมทุกจอที่ส่งใบมีเงินเข้า ZORT
//
// 🔴 **ที่มา: ZORT ไม่คำนวณเงินให้สักชั้น** (กฎ zort-sends-all-money-fields)
//    ถ้าจอกับท่อเข้าใจช่องเงินไม่ตรงกัน ใบที่ออกมาจะเป็น ฿0 หรือยอดผิด
//    **โดยได้เลขที่ใบจริงตามปกติ ไม่มีอะไรฟ้องสักคำ** ⇒ ตัวเทียบนี้คือด่านเดียวที่จับได้ก่อนส่ง
//
// 🔴 **สี่สถานะ ห้ามยุบ** (ฝั่งท่อยืนยันความหมายของ null 14 ก.ย. 2569 · gucut-web 994f84b)
//   ① ตัวเลข ตรงกัน      → บอกสั้น ๆ ว่าตรง (ให้คนเห็นว่ามีการตรวจจริง ไม่ใช่เงียบ)
//   ② ตัวเลข ไม่ตรง      → แดง · **อย่าส่งจริง** สองฝั่งคิดคนละกติกา
//   ③ null              → ท่อบอกเองว่า "มีบรรทัดไม่มีราคา จึงไม่คิดยอด"
//                         ⇒ **ห้ามอ่านเป็น 0 และห้ามขึ้นว่า "ไม่ตรง"** ต้องขึ้นว่า "เทียบไม่ได้"
//                         ⚠️ แต่ในจอที่ **บังคับราคาทุกบรรทัด** การได้ null แปลว่าราคาที่ส่งไป
//                            ไม่ถึงท่อ ⇒ อันนั้นต้องขึ้นแดง · ใช้ prop `requiresPrice` แยกสองกรณีนี้
//   ④ ไม่มีช่องนี้เลย     → ท่อรุ่นก่อน ⇒ เทียบไม่ได้เหมือน ③ แต่คนละสาเหตุ ห้ามเขียนรวมกัน
//
// ⚠️ **เงียบ = คนอ่านว่า "ตรวจแล้วตรงกัน"** — นี่คือเหตุผลที่ทุกสถานะต้องพูดออกมา
//    (จอขายกับจอคืนของเคยไม่แสดงอะไรเลยในสถานะ ③④ · แก้แล้ว 14 ก.ย. 2569)
import { fmtMoney } from '@/lib/format'

export interface LinesTotalLike {
  dryRun?: boolean
  /** ยอดรวมบรรทัดที่ท่อคิด · null = ท่อไม่คิดเพราะมีบรรทัดไม่มีราคา · ไม่มีช่อง = ท่อรุ่นก่อน */
  linesTotal?: number | null
}

export function LinesTotalCheck({ res, ourTotal, requiresPrice }: {
  res: LinesTotalLike | null
  /** ยอดที่จอคิดเอง (ผลรวม จำนวน×ราคา ของบรรทัดที่จะส่ง) */
  ourTotal: number
  /** จอนี้บังคับราคาทุกบรรทัดไหม — เปลี่ยนความหมายของ null จาก "ปกติ" เป็น "ผิดปกติ" */
  requiresPrice?: boolean
}) {
  if (!res?.dryRun) return null

  const has = typeof res.linesTotal === 'number'
  const isNull = res.linesTotal === null
  const missing = !('linesTotal' in (res as object))

  if (has) {
    const pipe = res.linesTotal as number
    /* 1 สตางค์ — ต่างกว่านี้ไม่ใช่เรื่องปัดเศษแล้ว */
    if (Math.abs(pipe - ourTotal) > 0.009) {
      return (
        <div className="text-[13px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
          🔴 <b>ยอดที่ท่อคิดไม่ตรงกับยอดบนจอ</b> — ท่อได้ <b>{fmtMoney(pipe)}</b> จอได้ <b>{fmtMoney(ourTotal)}</b>
          <br />
          ⇒ <b>ไม่ใช่เรื่องปัดเศษ</b> แต่แปลว่าสองฝั่งเข้าใจช่องเงินไม่ตรงกัน ·
          {' '}<b>อย่าส่งจริงจนกว่าจะรู้ว่าฝั่งไหนผิด</b> แล้วแจ้งฝั่งท่อ
        </div>
      )
    }
    return <p className="text-[12px] text-gray-500 mt-2">✓ ยอดสินค้าที่ท่อคิดตรงกับที่จอคิด ({fmtMoney(pipe)})</p>
  }

  if (isNull) {
    /* จอที่บังคับราคา: ได้ null = ราคาที่ส่งไปไม่ถึงท่อ ⇒ เรื่องใหญ่ ไม่ใช่เรื่องปกติ */
    if (requiresPrice) {
      return (
        <div className="text-[13px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
          🔴 <b>ท่อบอกว่ามีบรรทัดที่ไม่มีราคา จึงไม่คิดยอดให้</b> — แต่จอนี้บังคับราคาครบทุกบรรทัดอยู่แล้ว
          {' '}⇒ แปลว่า <b>ราคาที่ส่งไปไม่ถึงท่อ</b> · <b>อย่าส่งจริง</b> และแจ้งฝั่งท่อ
          <br />
          ยอดบนจอคือ {fmtMoney(ourTotal)} — <b>ห้ามอ่านค่าว่างเป็น ฿0</b>
        </div>
      )
    }
    return (
      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
        ⚠️ <b>เทียบยอดไม่ได้</b> — ท่อบอกว่ามีบรรทัดที่ไม่มีราคา จึงไม่คิดยอดรวมให้
        {' '}(<b>เทียบไม่ได้ ไม่ใช่ไม่ตรง</b> และ<b>ไม่ใช่ ฿0</b>)
        <br />
        ยอดของบรรทัดที่มีราคาบนจอคือ {fmtMoney(ourTotal)} ·
        {' '}อยากให้เทียบได้ ต้องใส่ราคาให้ครบทุกบรรทัด
      </div>
    )
  }

  if (missing) {
    return (
      <p className="text-[12px] text-amber-800 mt-2 leading-relaxed">
        ⚠️ ท่อไม่ได้ส่งยอดรวมกลับมาให้เทียบ (ท่อรุ่นก่อน) — <b>เทียบไม่ได้ ไม่ใช่ตรงกัน</b>
        {' '}· ยอดบนจอคือ {fmtMoney(ourTotal)}
      </p>
    )
  }
  return null
}
