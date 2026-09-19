'use client'
/* เวลาที่ **งานตามเวลาทุกตัว** ใช้จริง — คู่กับ `SweepTiming` ที่ดูเฉพาะตัวกวาดดันสต็อก
 * (19 ก.ย. 2569 · ใบ S1 — เขียนรอไว้ **ก่อน** ท่อปล่อยของ ตามสัญญาช่องที่ฝั่งท่อส่งมาล่วงหน้า)
 *
 * 🔑 ทำไมต้องมี: ผมรายงานไปว่า "ตัวกวาดใช้ 26.25 นาที/วัน" โดยไม่ได้เขียนขอบเขต
 *    ของจริงคือ **ครอบแค่ 288 จาก 497 รอบ/วัน = 58%** ⇒ อีก 42% ไม่มีสมุดเวลาเลย
 *    ⇒ ตัวเลขที่ถูก แต่ไม่มีขอบเขตกำกับ **ถูกอ่านเป็นยอดรวมเสมอ**
 *
 * ⚠️ สามข้อที่ฝั่งท่อกำชับ — เขียนไว้ตรงนี้เพราะถ้าลืมจะขึ้นแดงลวง:
 *  ① **`ผล.ไม่ได้ตัดสิน` เป็นเลขใหญ่โดยตั้งใจ** — ห้านตัวที่ครอบข้างนอกตอบ 200 ได้แม้ข้างในมี error
 *     ⇒ ท่อไม่เดาว่า 200 = สำเร็จ ⇒ **จอห้ามนับเป็นความล้ม และห้ามนับเป็นสำเร็จ**
 *  ② **`ครอบคลุม` หารด้วย `ชั่วโมงที่สมุดเปิดรับจริง` ไม่ใช่ `ชั่วโมงย้อนหลัง`**
 *     (สมุดที่เพิ่งเริ่มจด 25 นาทีจะขึ้น 0.04 = ดูเหมือนรอบหาย 96% — ฝั่งท่อเจอเองแล้วแก้)
 *     ⇒ `< 1` = มีรอบที่ไม่ได้จดเลย · `> 1` ได้ ถ้ามีคนสั่งมือเพิ่ม **ไม่ใช่ความผิด**
 *  ③ **`ms` ไม่รวม cold start** ⇒ ต่ำกว่าที่ถูกคิดเงินเสมอ ⇒ ห้ามเอาไปเทียบตรง ๆ กับบิล
 *
 * 🚫 **ท่อยังไม่ส่งช่องพวกนี้ (ยังไม่ push)** ⇒ การ์ดนี้ต้อง **ไม่แสดงอะไรเลย** ไม่ใช่ขึ้น 0
 *    เช็ค `'งานที่จดเวลาแล้ว' in d` ⇒ ไม่มีคีย์ = **ท่อรุ่นเก่า** (คนละเรื่องกับ "ไม่มีข้อมูล")
 *    และเช็ค `inconclusive` **ก่อน** `ok` เสมอ (ตอนอ่านสมุดไม่ได้ จะไม่มีคีย์ `ok` เลย)
 */
import { useCallback, useEffect, useState } from 'react'

type งาน = {
  id?: string
  'แถวที่มี'?: number
  'รอบที่ควรมีในช่วง'?: number | null
  'ครอบคลุม'?: number | null
  'ค่ากลาง_ms'?: number
  'ช้าสุด_ms'?: number
  'เกินเพดาน'?: number
  'เกือบชนเพดาน'?: number
  'นาทีต่อวัน(จากแถวจริง)'?: number | null
  'ผล'?: { ok?: number; failed?: number; 'ไม่ได้ตัดสิน'?: number }
  'ล่าสุด'?: { at?: string; ms?: number; outcome?: string; note?: string } | null
}
type Resp = {
  ok?: boolean
  inconclusive?: boolean
  'อ่านสมุดไม่ได้'?: string
  'ชั่วโมงย้อนหลัง'?: number
  'ชั่วโมงที่สมุดเปิดรับจริง'?: number
  'สมุดเพิ่งเริ่มจดกลางช่วงที่ถาม'?: boolean
  'เพดานเวลาฟังก์ชัน_ms'?: number
  'เกือบชนเพดานที่_ms'?: number
  'งานที่จดเวลาแล้ว'?: งาน[] | null
  '⚠️ ขอบเขต'?: string
}

const วิ = (ms?: number) => (typeof ms === 'number' ? (ms / 1000).toFixed(1) : '—')
const นาที = (n?: number | null) => (typeof n === 'number' ? n.toFixed(2) : '—')

export default function JobTiming() {
  const [d, setD] = useState<Resp | null>(null)
  const [ท่อรุ่นเก่า, setท่อรุ่นเก่า] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr(''); setท่อรุ่นเก่า(false)
    try {
      const r = await fetch('/api/web/core?jobtiming=1&hours=24')
      const j: Resp = await r.json()
      /* 🔴 ไม่มีคีย์เลย = ท่อรุ่นเก่า · คนละเรื่องกับ "มีคีย์แต่เป็น null" (= อ่านสมุดไม่ได้) */
      if (!('งานที่จดเวลาแล้ว' in (j ?? {}))) { setท่อรุ่นเก่า(true); setD(null); return }
      setD(j)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setD(null)
    }
  }, [])
  useEffect(() => { load() }, [load])

  /* 🚫 ท่อรุ่นเก่า ⇒ **ไม่แสดงอะไรเลย** — การ์ดว่างดีกว่าการ์ดที่ขึ้น 0 */
  if (ท่อรุ่นเก่า) return null
  if (err) {
    return (
      <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 mb-3">
        ⚠️ อ่านเวลางานตามเวลาไม่ได้ — <b>ยังไม่รู้</b> ไม่ใช่ว่าไม่มีปัญหา ({err})
      </p>
    )
  }
  if (!d) return null

  /* 🔴 `inconclusive` มาก่อน `ok` เสมอ — ตอนอ่านสมุดไม่ได้จะไม่มีคีย์ ok เลย */
  if (d.inconclusive) {
    return (
      <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 mb-3">
        ⚠️ <b>อ่านสมุดเวลางานไม่ได้รอบนี้</b> — {d['อ่านสมุดไม่ได้'] ?? 'ท่อไม่ได้บอกเหตุ'}
        <span className="block text-amber-800">⇒ ตัวเลขข้างล่างไม่มี ไม่ใช่เพราะทุกอย่างปกติ</span>
      </div>
    )
  }

  const งานทั้งหมด = d['งานที่จดเวลาแล้ว'] ?? []
  if (!งานทั้งหมด.length) return null

  const เพดาน = d['เพดานเวลาฟังก์ชัน_ms']
  /* เรียงด้วยเลขที่ใช้ตัดสินเรื่องต้นทุน = นาที/วัน (ไม่ใช่วินาทีต่อรอบ) */
  const เรียง = [...งานทั้งหมด].sort(
    (a, b) => (b['นาทีต่อวัน(จากแถวจริง)'] ?? 0) - (a['นาทีต่อวัน(จากแถวจริง)'] ?? 0),
  )
  const รวมนาที = เรียง.reduce((s, x) => s + (x['นาทีต่อวัน(จากแถวจริง)'] ?? 0), 0)
  const ใกล้เพดาน = เรียง.filter((x) => (x['เกินเพดาน'] ?? 0) > 0 || (x['เกือบชนเพดาน'] ?? 0) > 0)
  const รอบหาย = เรียง.filter((x) => typeof x['ครอบคลุม'] === 'number' && x['ครอบคลุม']! < 1)
  const ตัดสินไม่ได้ = เรียง.reduce((s, x) => s + (x['ผล']?.['ไม่ได้ตัดสิน'] ?? 0), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
      <p className="text-[14.5px] font-semibold text-gray-900 mb-1">
        เวลาที่งานตามเวลาใช้จริง
        <span className="font-normal text-gray-500 text-[12.5px]">
          {' · จากสมุดที่ท่อจด ย้อน '}{d['ชั่วโมงย้อนหลัง'] ?? 24}{' ชม. — ไม่ได้ยิงอะไรใหม่'}
        </span>
      </p>

      {/* 🔴 ของที่จะพังต้องอยู่บนสุด */}
      {ใกล้เพดาน.length > 0 && (
        <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 mb-2">
          ⚠️ <b>มีงานที่ชนหรือเกือบชนเพดานเวลาแล้ว</b> —{' '}
          {ใกล้เพดาน.map((x) => `${x.id} (ช้าสุด ${วิ(x['ช้าสุด_ms'])} วิ${(x['เกินเพดาน'] ?? 0) > 0 ? ` · เกินเพดาน ${x['เกินเพดาน']} รอบ` : ` · เกือบชน ${x['เกือบชนเพดาน']} รอบ`})`).join(' · ')}
          {typeof เพดาน === 'number' && (
            <span className="block">ฟังก์ชันถูกตัดกลางทางเมื่อเกิน <b>{(เพดาน / 1000).toFixed(0)} วินาที</b> ⇒ รอบนั้นไม่จบ และ<b>จะไม่นับเป็น error</b></span>
          )}
        </p>
      )}

      {/* 🔴 "รอบหาย" ต้องอ่านคู่กับตัวหารที่ถูก ไม่งั้นสมุดที่เพิ่งเริ่มจดจะดูเหมือนรอบหายเกือบหมด */}
      {รอบหาย.length > 0 && (
        <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
          ⚠️ <b>มีรอบที่ไม่ได้ถูกจดเลย</b> — {รอบหาย.map((x) => `${x.id} (${Math.round((x['ครอบคลุม'] ?? 0) * 100)}%)`).join(' · ')}
          <span className="block text-amber-800">
            อาจถูกตัดตายที่เพดาน หรือ deploy ทับกลางช่วง
            {d['สมุดเพิ่งเริ่มจดกลางช่วงที่ถาม'] && <> · <b>สมุดเพิ่งเริ่มจดกลางช่วงที่ถาม</b> ⇒ อ่านเลขนี้อย่างระวัง</>}
          </span>
        </p>
      )}

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-gray-500 text-left border-b border-gray-200">
            <th className="py-1">งาน</th>
            <th className="py-1 text-right">รอบที่จด</th>
            <th className="py-1 text-right">ค่ากลาง</th>
            <th className="py-1 text-right">ช้าสุด</th>
            <th className="py-1 text-right">นาที/วัน</th>
            <th className="py-1">ผลล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          {เรียง.map((x) => (
            <tr key={x.id} className="border-b border-gray-100">
              <td className="py-1">{x.id}</td>
              <td className="py-1 text-right">
                {x['แถวที่มี'] ?? '—'}
                {typeof x['รอบที่ควรมีในช่วง'] === 'number' && (
                  <span className="text-gray-400">/{x['รอบที่ควรมีในช่วง']}</span>
                )}
              </td>
              <td className="py-1 text-right">{วิ(x['ค่ากลาง_ms'])} วิ</td>
              <td className="py-1 text-right">{วิ(x['ช้าสุด_ms'])} วิ</td>
              <td className="py-1 text-right font-medium">{นาที(x['นาทีต่อวัน(จากแถวจริง)'])}</td>
              <td className="py-1 text-gray-600">{x['ล่าสุด']?.outcome ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
        รวม <b>{รวมนาที.toFixed(2)}</b> นาที/วัน จาก <b>{เรียง.length}</b> งานที่มีสมุดเวลา
        {typeof d['ชั่วโมงที่สมุดเปิดรับจริง'] === 'number' && (
          <> · สมุดเปิดรับจริง <b>{d['ชั่วโมงที่สมุดเปิดรับจริง']!.toFixed(2)}</b> ชม.</>
        )}
        {/* 🔴 ข้อที่ผมพลาดเองในรายงานเมื่อบ่าย — เลขรวมต้องมาคู่กับขอบเขตเสมอ */}
        <span className="block text-gray-500">
          ⚠️ นี่คือยอดของ<b>งานที่มีสมุดเวลาเท่านั้น</b> ไม่ใช่ยอดของงานตามเวลาทั้งหมด
        </span>
        {ตัดสินไม่ได้ > 0 && (
          <span className="block text-gray-500">
            📌 มี <b>{ตัดสินไม่ได้}</b> รอบที่ <b>ตัดสินผลไม่ได้</b> (ตัวครอบตอบ 200 ได้แม้ข้างในมี error)
            {' '}⇒ <b>ไม่นับเป็นสำเร็จ และไม่นับเป็นล้มเหลว</b>
          </span>
        )}
        <span className="block text-gray-500">
          📌 เวลาที่จดไม่รวม cold start ⇒ <b>ต่ำกว่าที่ถูกคิดเงินเล็กน้อยเสมอ</b> — ห้ามเอาไปเทียบตรง ๆ กับบิล
        </span>
        {d['⚠️ ขอบเขต'] && <span className="block text-gray-400">{d['⚠️ ขอบเขต']}</span>}
      </p>
    </div>
  )
}
