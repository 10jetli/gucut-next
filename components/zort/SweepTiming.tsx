'use client'
// เวลาที่ตัวกวาดดันสต็อกใช้จริง — อ่านจากสมุดที่ท่อจดไว้อยู่แล้ว (19 ก.ย. 2569 · ใบ S1)
//
// 🔑 **ที่มา: ค้านวิธีวัดแล้วได้ทางที่ถูกกว่า**
//    ใบสั่งให้ "ยิงงานตามเวลาแล้วจับเวลา 3 รอบ" ⇒ เป็นการ **เขียนข้อมูลจริง** และ
//    **สร้างค่าใช้จ่ายที่กำลังจะวัด** แล้วได้แค่ 3 ตัวอย่างที่เราสร้างเอง
//    ⇒ ฝั่งท่อจด `ms` ลง `push_sweep_log` ทุกรอบอยู่แล้ว · เปิดเส้นอ่านอย่างเดียวให้ (`efeec6a`)
//    ⇒ ได้การกระจายจริง 24 ชม. โดยไม่ยิงเพิ่มสักรอบ
//    **เกณฑ์ที่ทีมรับไปใช้: ก่อนยิงวัด ให้ถามก่อนว่าระบบจดค่านั้นไว้แล้วหรือยัง**
//
// ⚠️ **สองข้อที่ฝั่งท่อขอให้จอเคารพ — ห้ามแก้ให้ "ดูสะอาดขึ้น"**
//  ① **ห้ามยุบ `mode` เข้าด้วยกัน** — `fast-skip` เร็วกว่ารอบเต็มราว 27 เท่า (518 ms ต่อ 14,307 ms)
//     ยุบแล้วค่ากลางจะต่ำกว่าความจริงของรอบเต็ม ⇒ **ประเมินต้นทุนต่ำเกิน**
//  ② **เลขที่ใช้ตัดสินเรื่องเครดิตคือ `นาทีต่อวันประมาณ` ไม่ใช่ วินาที/รอบ**
//     Netlify คิดตามเวลาที่ฟังก์ชันทำงาน ⇒ รอบถี่ที่เร็ว อาจแพงกว่ารอบช้าที่นานทีครั้ง
//
// 🔴 **ช้าสุดสำคัญกว่าค่ากลาง** — ค่ากลาง 14 วิดูสบาย แต่ช้าสุด 28.5 วิคือตัวที่จะพัง
//    เพดานฟังก์ชันตามเวลาอยู่ราว 30 วิ ⇒ เหลือที่ว่างไม่ถึง 2 วิ
//    ⇒ จอนี้ขึ้น **ช้าสุดคู่กับค่ากลางเสมอ** ไม่ใช่ซ่อนไว้หลังปุ่ม
import { useCallback, useEffect, useState } from 'react'
import PipeNote from '@/components/ui/PipeNote'

interface แถว {
  channel?: string; mode?: string
  'รอบ'?: number
  'msค่ากลาง'?: number; 'msเร็วสุด'?: number; 'msช้าสุด'?: number
  'วินาทีต่อรอบเฉลี่ย'?: number
  'นาทีต่อวันประมาณ'?: number
}
interface Resp {
  ok?: boolean
  'ชั่วโมงย้อนหลัง'?: number
  'แถว'?: แถว[]
  'รวมนาทีต่อวันประมาณ'?: number
  '⚠️ ขอบเขต'?: string
  error?: string
  fallthrough?: boolean
}

/** 🔴 **เพดานเวลาของฟังก์ชันตามเวลา — ค่าสำรองที่ประกาศตัวเอง**
 *  ท่อยังไม่ส่งเพดานมาในคำตอบ ⇒ จอใช้ค่านี้ **และเขียนบนจอว่ากำลังใช้ค่าสำรอง**
 *  (ท่าเดียวกับ `RECIPE_STALE_HOURS_ทางถอย` ที่ `lib/recipe-fresh.ts`)
 *  ⚠️ วันไหนท่อประกาศ `เพดานวินาที` มา ให้เลิกใช้ตัวนี้ทันที ห้ามมีเลขเกณฑ์สองที่ */
const เพดานวินาที_ทางถอย = 30

const MODE_TH: Record<string, string> = {
  live: 'ยิงจริง',
  dry: 'ซ้อม (ไม่เขียนอะไรกลับแพลตฟอร์ม)',
  'fast-skip': 'ทางออกเร็ว (ไม่มีอะไรต้องทำ)',
}

const วิ = (ms?: number) => (typeof ms === 'number' ? (ms / 1000).toFixed(1) : '—')

export default function SweepTiming() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [ยังไม่มีเส้น, setยังไม่มีเส้น] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(''); setยังไม่มีเส้น(false)
    try {
      const r = await fetch('/api/web/core?sweeptiming=1&hours=24')
      const j: Resp = await r.json()
      /* 🔴 ท่อรุ่นเก่าตอบ 200 พร้อม `fallthrough` ⇒ เช็คแค่ res.ok จะอ่านว่า
         "สำเร็จแต่ไม่มีข้อมูล" ซึ่งกลับหัวความจริง (เจอคลาสนี้มาแล้วหลายรอบ) */
      if (j?.fallthrough || !Array.isArray(j?.['แถว'])) { setยังไม่มีเส้น(true); setD(null); return }
      if (j.error) throw new Error(j.error)
      setD(j)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const แถวทั้งหมด = d?.['แถว'] ?? []
  /* เรียงตามเลขที่ใช้ตัดสินจริง (นาที/วัน) ไม่ใช่ตามวินาทีต่อรอบ */
  const เรียง = [...แถวทั้งหมด].sort((a, b) => (b['นาทีต่อวันประมาณ'] ?? 0) - (a['นาทีต่อวันประมาณ'] ?? 0))
  const ใกล้เพดาน = เรียง.filter((r) => (r['msช้าสุด'] ?? 0) / 1000 >= เพดานวินาที_ทางถอย * 0.8)

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-[14.5px] font-semibold text-gray-900">
          เวลาที่ตัวกวาดดันสต็อกใช้จริง
          <span className="font-normal text-gray-500 text-[12.5px]">
            {' · วัดจากสมุดที่ท่อจดไว้ ย้อน '}{d?.['ชั่วโมงย้อนหลัง'] ?? 24}{' ชม. — ไม่ได้ยิงอะไรใหม่'}
          </span>
        </p>
        {typeof d?.['รวมนาทีต่อวันประมาณ'] === 'number' && (
          <span className="text-[12.5px] text-gray-700 bg-gray-100 rounded px-2 py-0.5">
            รวม <b>{d['รวมนาทีต่อวันประมาณ']!.toFixed(1)}</b> นาที/วัน
          </span>
        )}
      </div>

      {loading && <p className="text-[12.5px] text-gray-400">กำลังอ่านสมุดรอบกวาด…</p>}
      {err && <p className="text-[12.5px] text-red-700">อ่านไม่ได้: {err} <b>(อ่านไม่ได้ ≠ ไม่มีรอบ)</b></p>}
      {ยังไม่มีเส้น && (
        <p className="text-[12.5px] text-gray-500">
          ท่อรุ่นที่เสิร์ฟอยู่ยังไม่มีเส้นนี้ — <b>ไม่ได้แปลว่าตัวกวาดไม่ทำงาน</b>
        </p>
      )}

      {!loading && !err && !ยังไม่มีเส้น && (
        <>
          {/* 🔴 ของที่จะพังต้องอยู่บนสุด ไม่ใช่ต่อท้ายตาราง */}
          {ใกล้เพดาน.length > 0 && (
            <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2 leading-relaxed">
              ⚠️ <b>มีรอบที่เข้าใกล้เพดานเวลาแล้ว</b> —{' '}
              {ใกล้เพดาน.map((r) => `${r.channel} (${MODE_TH[r.mode ?? ''] ?? r.mode}) ช้าสุด ${วิ(r['msช้าสุด'])} วิ`).join(' · ')}
              <span className="block">
                ฟังก์ชันตามเวลาถูกตัดกลางทางเมื่อเกินราว <b>{เพดานวินาที_ทางถอย} วินาที</b>
                {' '}⇒ วันที่ของเยอะกว่านี้หน่อย รอบนั้นจะไม่จบ และ<b>จะไม่นับเป็น error</b>
              </span>
              <span className="block text-amber-800">
                📌 เลข {เพดานวินาที_ทางถอย} วินาทีนี้ <b>จอเดาเอง (ค่าสำรอง)</b> —
                ท่อยังไม่ประกาศเพดานมาในคำตอบ ⇒ ถือเป็นสัญญาณให้ไปดู ไม่ใช่เส้นตัดสิน
              </span>
            </div>
          )}

          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50">
                <tr>
                  {['ช่องทาง', 'โหมด', 'รอบ (24 ชม.)', 'ค่ากลาง', 'ช้าสุด', 'นาที/วัน'].map((h, i) => (
                    <th key={h} className={`px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {เรียง.map((r, i) => {
                  const ช้า = (r['msช้าสุด'] ?? 0) / 1000
                  return (
                    <tr key={`${r.channel}-${r.mode}-${i}`} className="border-t border-gray-100">
                      <td className="px-2 py-1 whitespace-nowrap">{r.channel ?? '—'}</td>
                      {/* ⚠️ โหมดห้ามยุบ — fast-skip เร็วกว่ารอบเต็มหลายเท่าโดยตั้งใจ */}
                      <td className="px-2 py-1 text-gray-600">{MODE_TH[r.mode ?? ''] ?? r.mode ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r['รอบ'] ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{วิ(r['msค่ากลาง'])} วิ</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${ช้า >= เพดานวินาที_ทางถอย * 0.8 ? 'text-amber-800 font-semibold' : ''}`}>
                        {วิ(r['msช้าสุด'])} วิ
                      </td>
                      {/* 🔑 คอลัมน์นี้คือเลขที่ใช้ตัดสินเรื่องเครดิต ⇒ เน้นกว่าวินาที/รอบ */}
                      <td className="px-2 py-1 text-right tabular-nums font-semibold">
                        {typeof r['นาทีต่อวันประมาณ'] === 'number' ? r['นาทีต่อวันประมาณ']!.toFixed(2) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11.5px] text-gray-500 mt-1.5 leading-relaxed">
            🔑 <b>นาที/วัน คือเลขที่ใช้ตัดสินเรื่องค่าใช้จ่าย</b> ไม่ใช่วินาทีต่อรอบ —
            Netlify คิดตามเวลาที่ฟังก์ชันทำงาน ⇒ รอบถี่ที่เร็ว อาจแพงกว่ารอบช้าที่นานทีครั้ง
          </p>
          {d?.['⚠️ ขอบเขต'] && (
            <p className="text-[11.5px] text-gray-500 mt-1 leading-relaxed">
              📖 <PipeNote>{d['⚠️ ขอบเขต']}</PipeNote>
            </p>
          )}
        </>
      )}
    </div>
  )
}
