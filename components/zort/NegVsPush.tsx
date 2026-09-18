'use client'
// สะพานระหว่าง "ติดลบในคลังเรา" กับ "ตัวขวางการดันขึ้นมาร์เก็ตเพลส" (18 ก.ย. 2569)
//
// 🔴 **ของจริงที่ทำให้ต้องมีก้อนนี้**
//    จอคลังหน้านี้บอกติดลบ 22 รหัส · จอดันสต็อกบอกมีตัวขวางเพราะติดลบ 29 รหัส · **ซ้อนกันแค่ 5**
//    ⇒ คนที่ถูกสั่งว่า "ไปแก้ของติดลบ" แก้ครบ 22 ตัวที่เห็นในจอนี้
//       จะยังเหลือตัวขวางการดันอีก 24 รหัส **โดยไม่มีอะไรบอกเลย**
//    สาเหตุ: 24 ตัวนั้นเป็น **รหัสแปรของมาร์เก็ตเพลส** (`01209-22.5T` …)
//    ซึ่งไม่มีแถวของตัวเองในคลังเงา ⇒ จอนี้ไม่มีวันแสดงมัน
//
// 🔑 **ทางแก้ที่เลือก (CEO ชี้ 18 ก.ย. 17:10 น.): ไม่ทำให้เลขเท่ากัน**
//    เพราะสองจอ**ตอบคนละคำถามโดยตั้งใจ** — จอนี้ตอบ "สต็อกในคลังเราติดลบ"
//    อีกจอตอบ "อะไรขวางการดันขึ้นมาร์เก็ตเพลส" · บังคับให้เท่ากันคือทำให้ทั้งคู่ตอบผิด
//    ⇒ เขียนกำกับว่าตัวเองนับอะไร แล้วชี้ทางไปอีกจอพร้อมตัวเลขจริง
//
// ⚠️ เงียบเมื่อไม่มีอะไรต้องบอก — ก้อนที่ขึ้นทุกวันจนคนเลิกอ่าน มีค่าเท่ากับไม่มี
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { จับคู่ต้นเหตุ, type NegMap } from '@/lib/neg-stuck'

interface StuckRow { sku?: string; channel?: string }

export default function NegVsPush() {
  const [ผล, setผล] = useState<{ ขวาง: number; ไม่โผล่: number; ต้นเหตุ: number; หาไม่เจอ: number } | null>(null)

  useEffect(() => {
    let ทิ้งแล้ว = false
    ;(async () => {
      try {
        const [a, b] = await Promise.all([
          fetch('/api/web/core?pushstuck=1&reason=negative&limit=200').then((r) => r.json()).catch(() => null),
          fetch('/api/web/core?list=stock&only=neg&limit=200').then((r) => r.json()).catch(() => null),
        ])
        if (ทิ้งแล้ว) return
        const stuck: StuckRow[] = Array.isArray(a?.rows) ? a.rows : []
        const negRows = Array.isArray(b?.rows) ? b.rows : []
        /* ทั้งสองเส้นต้องตอบมาจริง — ขาดเส้นไหนก็ยังบอกไม่ได้ ⇒ เงียบ ไม่ใช่เขียน 0 */
        if (!stuck.length || !negRows.length) return
        const neg: NegMap = new Map()
        for (const r of negRows) {
          if (!r?.sku) continue
          neg.set(r.sku, typeof r.qty === 'number' ? r.qty : typeof r.available === 'number' ? r.available : null)
        }
        const { ต้นเหตุ, หาไม่เจอ, ไม่โผล่ในจอคลัง } = จับคู่ต้นเหตุ(stuck, neg)
        const รหัสขวาง = new Set(stuck.map((r) => r.sku).filter(Boolean) as string[])
        setผล({ ขวาง: รหัสขวาง.size, ไม่โผล่: ไม่โผล่ในจอคลัง.length, ต้นเหตุ: ต้นเหตุ.length, หาไม่เจอ })
      } catch { /* เงียบโดยตั้งใจ — ถามไม่ได้ ≠ ไม่มีปัญหา แต่ก็ไม่ควรเดาให้ */ }
    })()
    return () => { ทิ้งแล้ว = true }
  }, [])

  if (!ผล || ผล.ไม่โผล่ === 0) return null

  return (
    <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
      ⚠️ <b>จอนี้กับจอดันสต็อกนับคนละอย่าง — ห้ามอ่านว่าเป็นชุดเดียวกัน</b>
      <br />
      จอนี้ตอบว่า <b>สต็อกในคลังเราติดลบตัวไหน</b> ·
      จอดันสต็อกตอบว่า <b>อะไรขวางการดันขึ้นมาร์เก็ตเพลส</b> — ตอนนี้ขวางอยู่ <b>{ผล.ขวาง}</b> รหัส
      {' '}และใน <b>{ผล.ไม่โผล่}</b> รหัสนั้น<b>ไม่มีแถวในจอนี้เลย</b> (เป็นรหัสแปรของมาร์เก็ตเพลส
      ที่ไม่มีสต็อกของตัวเอง — มันติดลบตามรหัสฐาน)
      <br />
      ⇒ <b>แก้ครบทุกตัวที่เห็นในจอนี้ ก็ยังอาจเหลือตัวขวางการดัน</b> ·
      {ผล.ต้นเหตุ > 0 && <> ต้นเหตุจริงมี <b>{ผล.ต้นเหตุ}</b> ตัว ·</>}
      {' '}
      <Link href="/core/stock-push" className="underline font-semibold">ดูรายการที่ขวางการดันและต้นเหตุ</Link>
      {ผล.หาไม่เจอ > 0 && (
        <span className="block mt-0.5">
          ⚠️ อีก <b>{ผล.หาไม่เจอ}</b> รหัสยัง<b>จับคู่ต้นเหตุไม่ได้</b> — ต้องตามด้วยมือ ไม่ใช่ไม่มีปัญหา
        </span>
      )}
    </div>
  )
}
