'use client'
// การ์ด "เคยขายได้บนช่องทางนั้น แล้วเงียบ ทั้งที่ยังมีของ" (18 ก.ย. 2569)
//
// 🔴 **ที่มา**: เส้น `list=channel-gaps` มีอยู่ในท่อ **แต่ไม่มีจอไหนเรียกเลยทั้ง repo**
//    เจอเพราะยิงชื่อ list ผิดโดยบังเอิญ แล้วท่อตีกลับ 400 พร้อมรายชื่อ `accepts` ทั้ง 23 ชนิด
//    ⇒ เอามาเทียบกับที่จอเรียกจริง เหลือตัวเดียวที่ไม่มีใครใช้
//
// 🔑 **CEO สั่งให้ทำ "แค่การ์ดสรุปหนึ่งใบ" ไม่ใช่จอเต็ม** — เหตุผลของเขาคือคำถามที่สำคัญกว่า:
//    **"ใครจะลงมือกับมัน"** · การลงมือคือเปิดหน้าร้าน Lazada ดูทีละรหัส = งานคน ไม่ใช่งานเรา
//    ถ้าไม่มีใครทำ เราจะได้จอที่ตัวเลขสวยและไม่มีใครเปิด
//    ⇒ ห้ามทำตาราง · กรอง · เรียง · แบ่งหน้า (ทำแล้วจะกลายเป็นจอที่ต้องดูแลโดยไม่มีคนใช้)
//
// 🔍 **ตัววัดว่ามีคนใช้จริงไหม — ไม่ได้สร้างระบบนับใหม่**
//    ตอนเปิดจอ ยิงแค่ `limit=1` (ได้ `total` มาโชว์) · **รายการเต็มโหลดตอนกดเปิดเท่านั้น**
//    ⇒ ในบันทึกของท่อ คำขอที่มี `limit=200` = **มีคนกดดูจริง** · ไม่มีเลย = ไม่มีใครเปิด
//    ⇒ ถ้าเดือนหน้าไม่มีคำขอแบบนั้นเลย **ถอดการ์ดนี้ทิ้งได้** (CEO ตั้งเป็นเงื่อนไขของงานนี้)
//    ⚠️ จงใจ**ไม่**เอาไปจดในสมุดส่งออกไฟล์ — สมุดนั้นมีความหมายเฉพาะของมัน
//       เอาสองเรื่องมาปนกันคือทำให้สมุดที่ใช้สืบได้กลายเป็นสมุดที่ตีความไม่ได้
//
// ⚠️ **เลขเกณฑ์ต้องมาจากท่อ ห้ามจอพิมพ์เอง** (45 วัน · ย้อน 365 วัน · เคยขาย 5 ชิ้น)
//    ฝั่งท่อแก้เกณฑ์เมื่อไหร่ จอต้องเปลี่ยนตามเอง
// ⚠️ **`caveat` ของท่อต้องขึ้นจอด้วย** — "ไม่ใช่ข้อสรุปว่าถูกซ่อน อาจหยุดขายเอง เปลี่ยนรุ่น หรือปรับราคา"
//    ไม่มี caveat = การ์ดนี้กลายเป็นรายการกล่าวหาแพลตฟอร์ม
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'

interface GapRow {
  sku?: string; name?: string; channel?: string
  soldBefore?: number | null; onhand?: number | null; lastSoldOnChannel?: string | null
}
interface Resp {
  ok?: boolean; error?: string
  total?: number | null
  quietDays?: number | null; lookbackDays?: number | null; minSold?: number | null
  note?: string; caveat?: string
  rows?: GapRow[]
  pagingDone?: boolean
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export default function ChannelGapsCard() {
  const [หัว, setหัว] = useState<Resp | null>(null)
  const [เต็ม, setเต็ม] = useState<Resp | null>(null)
  const [กำลังโหลด, setกำลังโหลด] = useState(false)

  /* ตอนเปิดจอ: ขอแค่ `limit=1` — ได้ total มาโชว์โดยไม่ลากรายการทั้งชุดมาฟรี ๆ */
  useEffect(() => {
    let ทิ้งแล้ว = false
    ;(async () => {
      try {
        const r = await fetch('/api/web/core?list=channel-gaps&limit=1')
        const j = (await r.json()) as Resp
        if (!ทิ้งแล้ว && r.ok && !j?.error) setหัว(j)
      } catch { /* เงียบ — การ์ดนี้เป็นของเสริม ห้ามทำให้จอหลักดูพัง */ }
    })()
    return () => { ทิ้งแล้ว = true }
  }, [])

  /** โหลดรายการเต็ม — **เรียกตอนกดเปิดเท่านั้น** (ดูหมายเหตุตัววัดที่หัวไฟล์) */
  const โหลดเต็ม = useCallback(async () => {
    if (เต็ม || กำลังโหลด) return
    setกำลังโหลด(true)
    try {
      const r = await fetch('/api/web/core?list=channel-gaps&limit=200')
      const j = (await r.json()) as Resp
      if (r.ok && !j?.error) setเต็ม(j)
    } catch { /* เงียบ */ } finally { setกำลังโหลด(false) }
  }, [เต็ม, กำลังโหลด])

  const total = n(หัว?.total)
  if (total === null || total === 0) return null

  const rows = เต็ม?.rows ?? []
  /* 🔑 **เรียงตาม "ของในคลัง × เคยขายได้" ไม่ใช่ตามจำนวนวันที่เงียบ** (CEO กำหนด)
     เพราะคนมีเวลาดูไม่กี่รหัส ⇒ ต้องเอารหัสที่**เสียโอกาสมากที่สุด**ขึ้นก่อน
     ของที่เงียบนานแต่มีของ 2 ชิ้น ไม่คุ้มเวลาเท่าของที่เงียบ 2 เดือนแต่มีของ 2,800 ชิ้น */
  const เรียง = [...rows].sort((a, b) => ((n(b.onhand) ?? 0) * (n(b.soldBefore) ?? 0)) - ((n(a.onhand) ?? 0) * (n(a.soldBefore) ?? 0)))
  const นับช่องทาง = new Map<string, number>()
  let ของรวม = 0
  for (const r of rows) {
    if (r.channel) นับช่องทาง.set(r.channel, (นับช่องทาง.get(r.channel) ?? 0) + 1)
    ของรวม += n(r.onhand) ?? 0
  }

  return (
    <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) โหลดเต็ม() }}
      className="bg-white border border-amber-200 rounded-md mb-3">
      <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] text-amber-900">
        💤 <b>{fmtNum(total)} รหัส</b> เคยขายได้บนช่องทางนั้น <b>แล้วเงียบ</b> ทั้งที่ยังมีของในคลัง
        <span className="text-amber-700/80"> — กดเพื่อดูรายการ</span>
      </summary>
      <div className="px-3.5 pb-3 text-[12px] text-gray-700 leading-relaxed">
        {กำลังโหลด && <p className="text-gray-400">กำลังโหลดรายการ…</p>}
        {เต็ม && (
          <>
            <p className="text-gray-600">
              แยกตามช่องทาง:{' '}
              {Array.from(นับช่องทาง.entries()).sort((a, b) => b[1] - a[1])
                .map(([c, k]) => `${c} ${fmtNum(k)}`).join(' · ') || '—'}
              {' '}· ของในคลังรวม <b>{fmtNum(Math.round(ของรวม))}</b> ชิ้น
            </p>
            {/* เกณฑ์มาจากท่อ — ไม่มีค่าก็ไม่แสดง ดีกว่าพิมพ์เลขที่อาจไม่ตรงกับที่ท่อใช้จริง
                🔴 **เดิมคอมเมนต์บรรทัดบนพูดตรงข้ามกับสิ่งที่โค้ดทำ** (แก้ 19 ก.ย. 2569)
                   ด่านเป็น `||` ⇒ มีค่าเดียวก็เรนเดอร์ทั้งบรรทัด แล้วตัวที่ขาดตกไปที่ `?? 0`
                   ⇒ จอเขียนว่า "เงียบเกิน **0** วัน" ซึ่งเป็นเกณฑ์ที่ท่อไม่เคยส่งมา
                   และ 0 เป็นเลขที่อ่านแล้วเชื่อได้สนิท (แปลว่า "เงียบวันเดียวก็นับ") ⇒ อันตรายกว่าเว้นว่าง
                🔑 เกณฑ์ที่เดาเองแล้ววางคู่กับผลลัพธ์จริง = คนอ่านจะเชื่อว่าผลนั้นมาจากเกณฑ์นี้
                   ⇒ ตัดสินใจสั่งของผิดได้ · ให้แต่ละชิ้นตัดสินตัวเอง ขาดชิ้นไหนก็ไม่พูดถึงชิ้นนั้น */}
            {(() => {
              const ชิ้น = [
                n(หัว?.quietDays) !== null && <>เงียบเกิน <b>{fmtNum(n(หัว?.quietDays) as number)}</b> วัน</>,
                n(หัว?.lookbackDays) !== null && <>ย้อนดู <b>{fmtNum(n(หัว?.lookbackDays) as number)}</b> วัน</>,
                n(หัว?.minSold) !== null && <>เคยขายอย่างน้อย <b>{fmtNum(n(หัว?.minSold) as number)}</b> ชิ้น</>,
              ].filter(Boolean)
              if (!ชิ้น.length) return null
              return (
                <p className="text-gray-500 mt-0.5">
                  เกณฑ์ของท่อ: {ชิ้น.map((c, i) => <span key={i}>{i ? ' · ' : ''}{c}</span>)}
                  {ชิ้น.length < 3 && <span className="text-amber-800"> · ⚠️ ท่อไม่ได้ส่งเกณฑ์มาครบ ({ชิ้น.length}/3)</span>}
                </p>
              )
            })()}
            {หัว?.caveat && <p className="text-amber-800 mt-1">⚠️ {หัว.caveat}</p>}
            <p className="text-gray-500 mt-1.5">เรียงจาก<b>ของในคลัง × เคยขายได้</b> — รหัสที่เสียโอกาสมากที่สุดอยู่บน</p>
            <div className="mt-1 space-y-0.5">
              {เรียง.map((r, i) => (
                <div key={`${r.sku}-${r.channel}-${i}`} className="flex flex-wrap gap-x-2 text-[11.5px]">
                  <span className="font-mono text-gray-800">{r.sku || '—'}</span>
                  <span className="text-gray-500">{r.channel || '—'}</span>
                  <span className="text-gray-600">คงเหลือ {fmtNum(Math.round(n(r.onhand) ?? 0))}</span>
                  <span className="text-gray-400">ขายล่าสุดบนช่องทางนี้ {r.lastSoldOnChannel || 'ไม่ทราบ'}</span>
                  <span className="text-gray-500 truncate max-w-[280px]">{r.name || ''}</span>
                </div>
              ))}
            </div>
            {เต็ม.pagingDone === false && (
              <p className="text-amber-800 mt-1">⚠️ ท่อบอกว่ายังมีต่อ — รายการนี้ยังไม่ครบทั้งชุด</p>
            )}
          </>
        )}
      </div>
    </details>
  )
}
