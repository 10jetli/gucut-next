'use client'
// การ์ด "สถานะการจัดส่ง" — สรุปออเดอร์เป็นกองตามสถานะฝั่งมาร์เก็ตเพลส
//
// 🔴 **จอไม่รู้จักรหัสดิบเลยสักตัว** — ท่อ (`netlify/lib/order-status.mjs`) แปลมาให้แล้ว
//    ค่าดิบของ 3 เจ้าเขียนคนละแบบ: Shopee ตัวพิมพ์ใหญ่ · Lazada ตัวพิมพ์เล็ก · TikTok เป็นตัวเลข
//    และ `ready_to_ship` (Lazada) กับ `READY_TO_SHIP` (Shopee) **เป็นคนละเจ้า ไม่ใช่สะกดต่างกัน**
//    ⇒ ถ้าจอมาแปลเอง วันที่เจ้าหนึ่งออกค่าที่สะกดชนกับอีกเจ้า เราจะแปลผิดแบบเงียบ ๆ
//
// ⚠️ **ถัง "ไม่รู้จัก" ต้องเห็นเสมอ แม้เป็น 0** (ท่อกำชับ 4 ก.ย. 2569)
//    ถังนี้คือที่ที่ค่าใหม่ของแพลตฟอร์มจะไปตกตอนเขาเพิ่มโดยไม่บอกใคร
//    ซ่อนเมื่อไหร่ = ของใหม่หายเงียบแบบเดียวกับตาข่ายที่หมดอายุเอง
//
// ⚠️ **การ์ดตรวจขอบเขตตัวเอง** — ผลรวมทุกกองต้องเท่ากับจำนวนใบทั้งช่วงที่กรอง
//    ไม่เท่า = ท่อส่งมาแค่หน้าปัจจุบัน ⇒ การ์ดเปลี่ยนป้ายเป็น "เฉพาะหน้านี้" เอง
//    (ห้ามเขียนป้าย "ทั้งช่วง" ตายตัว — เลขที่ป้ายผิดขอบเขตคือเลขที่โกหกโดยไม่มีใครจับได้)
import { Pill } from '@/components/zort'

export interface ShipGroup {
  group: string
  th: string
  count: number
  /** ค่าดิบที่อยู่ในกองนี้ — ไว้ให้คนไล่ปัญหาเห็นของจริง (โผล่ตอนเอาเมาส์ชี้) */
  raws?: string[]
}

/** ลำดับการวางกอง — ไล่ตามเส้นทางจริงของออเดอร์ ไม่ใช่เรียงตามจำนวน
 *  (เรียงตามจำนวนแล้วกองจะสลับที่ทุกครั้งที่เปลี่ยนช่วงวัน อ่านยากกว่า) */
const ORDER = [
  'waiting_pay', 'waiting_confirm', 'waiting_ship', 'shipping',
  'done', 'returning', 'problem', 'cancelled', 'blank', 'unknown',
]

const TONE: Record<string, 'green' | 'orange' | 'red' | 'gray' | 'blue'> = {
  waiting_pay: 'orange',
  waiting_confirm: 'orange',
  waiting_ship: 'orange',
  shipping: 'blue',
  done: 'green',
  returning: 'red',
  problem: 'red',
  cancelled: 'red',
  blank: 'gray',
  unknown: 'gray',
}

/** ใช้เฉพาะตอนท่อไม่ได้ส่งชื่อไทยมา (ปล่อยให้ขึ้นคำอังกฤษบนจอไทยแย่กว่า)
 *  ⚠️ ไม่ใช่ที่เก็บคำแปล — คำแปลตัวจริงอยู่ที่ท่อ ที่นี่เป็นแค่ตาข่ายกันจอโล่ง */
const FALLBACK_TH: Record<string, string> = {
  blank: 'ไม่มีสถานะจากช่องทาง',
  unknown: 'ไม่รู้จัก',
}

export default function ShipStatusCard(
  { groups, total, unverified }: {
    groups?: ShipGroup[] | null
    /** จำนวนใบทั้งหมดของช่วงที่กรองอยู่ — ใช้ตรวจว่าการ์ดครอบคลุมแค่ไหน */
    total?: number
    /** true = ในกองมีรหัสที่ท่อติดธงว่า "ยังไม่ได้ยืนยันกับเอกสารทางการ" (รหัส TikTok) */
    unverified?: boolean
  },
) {
  const list = Array.isArray(groups) ? groups.filter((g) => g && g.group) : []
  if (list.length === 0) return null

  // ถัง "ไม่รู้จัก" ต้องมีเสมอ — ไม่มีในผลลัพธ์แปลว่า 0 ใบ ไม่ได้แปลว่าไม่มีถัง
  const shown: ShipGroup[] = list.some((g) => g.group === 'unknown')
    ? [...list]
    : [...list, { group: 'unknown', th: 'ไม่รู้จัก', count: 0, raws: [] }]

  shown.sort((a, b) => {
    const ia = ORDER.indexOf(a.group)
    const ib = ORDER.indexOf(b.group)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

  const sum = shown.reduce((n, g) => n + Number(g.count || 0), 0)
  const all = Number(total ?? 0)
  // เท่ากันเมื่อไหร่ = ท่อนับมาทั้งช่วงแล้ว · ไม่เท่า = ได้มาแค่หน้าที่เปิดอยู่
  const wholeRange = all > 0 && sum === all

  return (
    <div className="bg-white border border-gray-200 rounded-md px-3.5 py-3 mb-3">
      <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
        <h2 className="text-[13.5px] font-semibold text-gray-800">สถานะการจัดส่ง</h2>
        <span className="text-[12px] text-gray-500">
          {wholeRange
            ? `ทั้งช่วงที่กรอง ${all.toLocaleString('th-TH')} ใบ`
            : `เฉพาะหน้านี้ ${sum.toLocaleString('th-TH')} ใบ${all ? ` จากทั้งหมด ${all.toLocaleString('th-TH')} ใบ` : ''}`}
        </span>
        <span className="text-[12px] text-gray-400">· มาจากแพลตฟอร์ม ไม่ใช่สถานะใบของ ZORT</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {shown.map((g) => {
          const label = g.th && g.th !== g.group ? g.th : (FALLBACK_TH[g.group] ?? g.group)
          const raws = Array.isArray(g.raws) ? g.raws : []
          return (
            <span
              key={g.group}
              className="inline-flex items-center gap-1.5"
              title={raws.length ? `ค่าดิบในกองนี้: ${raws.join(' · ')}` : 'ไม่มีค่าดิบในกองนี้'}
            >
              <Pill tone={TONE[g.group] ?? 'gray'}>
                {label} {Number(g.count || 0).toLocaleString('th-TH')}
              </Pill>
            </span>
          )
        })}
      </div>

      {/* ⚠️ ป้ายผิดขอบเขตคือของอันตราย — บอกตรง ๆ ว่าเลขนี้นับจากไหน */}
      {!wholeRange && (
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2.5 leading-relaxed">
          เลขในการ์ดนี้นับจาก<b>หน้าที่เปิดอยู่เท่านั้น</b> ({sum.toLocaleString('th-TH')} ใบ)
          {all ? <> ไม่ใช่ทั้งช่วง {all.toLocaleString('th-TH')} ใบ</> : null} —
          {' '}กดไปหน้าถัดไปแล้วตัวเลขจะเปลี่ยน · ขอให้ฝั่งท่อนับที่ฐานข้อมูลแล้วไว้แล้ว
          {' '}พอส่งมาครบ การ์ดจะเปลี่ยนป้ายเป็น &quot;ทั้งช่วงที่กรอง&quot; เอง
        </p>
      )}

      {/* รหัส TikTok มาจากความจำ ยังไม่ได้ยืนยันกับเอกสารทางการ — ต้องเขียนบอก ไม่ใช่ปล่อยให้ดูเท่ากับของที่ยืนยันแล้ว */}
      {unverified && (
        <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
          ⚠️ คำแปลรหัสของ <b>TikTok</b> ยังไม่ได้ยืนยันกับเอกสารทางการ (ตรงกับค่าที่พบจริงในข้อมูล
          แต่ยังไม่ได้เทียบกับคู่มือของเขา) — ใบที่มาจาก Shopee กับ Lazada ยืนยันแล้ว
        </p>
      )}
    </div>
  )
}
