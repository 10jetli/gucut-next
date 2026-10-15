'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* 🔄 ปุ่ม "ดึงบิลทั้งหมด" มุมบนขวาของ /bills — ท่านประธานสั่ง 15 ต.ค. 2569
   "ทำปุ่มกดมุมบนขวา … กดครั้งเดียวให้ดึงบิลทั้งหมด"

   กดแล้วทำสองทางพร้อมกัน:
   ① สั่ง g1 กวาด 6 เจ้าที่เก็บด้วยสคริปต์ (POST /api/bills/run-all) แล้วถามความคืบหน้าซ้ำ ๆ
   ② สแกนเมลของเจ้าที่เก็บทางเมล ทีละเจ้า (GET /api/bills/vendor?vendor=…)

   🔴 **ผลต้องแยกรายเจ้า ห้ามสรุปรวมว่า "เสร็จแล้ว"**
      LINE กับ Netlify ตอบ AUTH_REQUIRED เป็นประจำ ⇒ ถ้าปุ่มขึ้นเขียวรวม
      ท่านจะนึกว่าได้บิลครบ ทั้งที่สองเจ้านั้นไม่ได้อะไรเลย
   🔴 **ผลของรอบก่อนห้ามนับเป็นผลของรอบนี้** — ไฟล์สถานะบน g1 เก็บผลรอบล่าสุดไว้เสมอ
      ⇒ หลังกดใหม่ ๆ มันยังบอกว่า "เสร็จ" ของเมื่อคืน ⇒ ต้องเทียบเวลากับตอนที่กด
   ⚠️ สแกนเมลที่ "ถอยไปใช้ของเก่า" (`staleReason`) ตอบ 200 แต่ **ไม่ได้สแกนใหม่** ⇒ นับเป็นไม่สำเร็จ */

export interface เจ้าในปุ่ม {
  id: string
  name: string
  วิธี: string | null
  portal: string | null
}

type ผล =
  | { ชนิด: 'รอ' }
  | { ชนิด: 'กำลังทำ' }
  | { ชนิด: 'สำเร็จ'; ข้อความ: string }
  | { ชนิด: 'ต้องล็อกอิน'; ข้อความ: string }
  | { ชนิด: 'ไม่สำเร็จ'; ข้อความ: string }

interface รายงานg1 { status: string; at: string; detail?: string }
interface สถานะรอบ { สถานะ: string; กำลังทำ: string | null; ทำไปแล้ว: number; ทั้งหมด: number; เมื่อ?: number }

/* 🔑 "รายงานของรอบนี้" = ค่าที่ **ต่างจากตอนก่อนกด** — จับภาพสถานะ g1 ไว้ก่อนสั่ง แล้วเทียบ
      ไม่เทียบกับนาฬิกาเครื่องคนกด เพราะนาฬิกามือถือ/คอมคลาดจาก g1 ได้เป็นนาที
      ⇒ ผลเมื่อคืนจะถูกนับเป็นผลรอบนี้ หรือผลรอบนี้ถูกทิ้งเป็นของเก่า (ผิดได้ทั้งสองทิศ) */
interface ภาพก่อนกด { เมื่อ: number | null; at: Record<string, string> }

const เพดานเวลารอg1 = 15 * 60 * 1000   // กวาด 6 เจ้าทีละตัว ใช้เวลาเป็นนาที

export default function RunAllBills({ เจ้า, onDone }: { เจ้า: เจ้าในปุ่ม[]; onDone?: () => void }) {
  const [กำลังรัน, setกำลังรัน] = useState(false)
  const [ผลราย, setผลราย] = useState<Record<string, ผล>>({})
  const [รอบ, setรอบ] = useState<สถานะรอบ | null>(null)
  const [ข้อความบน, setข้อความบน] = useState<string | null>(null)
  const เวลากด = useRef(0)
  const ก่อนกด = useRef<ภาพก่อนกด>({ เมื่อ: null, at: {} })
  const ตัวจับเวลา = useRef<ReturnType<typeof setInterval> | null>(null)

  const เจ้าสคริปต์ = เจ้า.filter((v) => v.วิธี === 'สคริปต์บน g1')
  const เจ้าเมล = เจ้า.filter((v) => v.วิธี === 'เมล')

  const ตั้งผล = (id: string, r: ผล) => setผลราย((old) => ({ ...old, [id]: r }))

  const หยุดถาม = useCallback(() => {
    if (ตัวจับเวลา.current) { clearInterval(ตัวจับเวลา.current); ตัวจับเวลา.current = null }
  }, [])
  useEffect(() => หยุดถาม, [หยุดถาม])

  /* ── ② สแกนเมลทีละเจ้า ── */
  const สแกนเมล = useCallback(async () => {
    for (const v of เจ้าเมล) {
      ตั้งผล(v.id, { ชนิด: 'กำลังทำ' })
      try {
        const r = await fetch(`/api/bills/vendor?vendor=${encodeURIComponent(v.id)}`, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j?.error) ตั้งผล(v.id, { ชนิด: 'ไม่สำเร็จ', ข้อความ: String(j?.error ?? `HTTP ${r.status}`) })
        else if (j?.staleReason) ตั้งผล(v.id, { ชนิด: 'ไม่สำเร็จ', ข้อความ: `สแกนใหม่ไม่ได้ (โชว์ของเก่าแทน): ${j.staleReason}` })
        else ตั้งผล(v.id, { ชนิด: 'สำเร็จ', ข้อความ: j?.newMessages ? 'สแกนแล้ว · เจอบิลใหม่' : 'สแกนแล้ว · ไม่มีบิลใหม่' })
      } catch (e) {
        ตั้งผล(v.id, { ชนิด: 'ไม่สำเร็จ', ข้อความ: `เรียกไม่ได้: ${e instanceof Error ? e.message : String(e)}` })
      }
    }
  }, [เจ้าเมล])

  /* ── ① ถามความคืบหน้าจาก g1 ── */
  const ถามg1หนึ่งครั้ง = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/bills/run-all', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (j?.upstreamOk !== true) {
        setข้อความบน(`อ่านความคืบหน้าจาก g1 ไม่ได้ — ${j?.เหตุ ?? `HTTP ${r.status} ไม่มีคำอธิบาย`} (ไม่ได้แปลว่าการดึงบิลล้มเหลว)`)
        return false
      }
      const r0: สถานะรอบ | null = j.รอบกวาด ?? null
      setรอบ(r0)
      const จบรอบนี้ = r0?.สถานะ === 'เสร็จ' && r0.เมื่อ != null && r0.เมื่อ !== ก่อนกด.current.เมื่อ
      const ราย: Record<string, รายงานg1> = j.รายเจ้า ?? {}
      for (const v of เจ้าสคริปต์) {
        const x = ราย[v.id]
        /* 🔑 นับเฉพาะรายงานที่เกิด **หลังกดปุ่ม** — ของเก่าคือผลเมื่อคืน ไม่ใช่ผลรอบนี้ */
        if (!x || x.at === ก่อนกด.current.at[v.id]) {
          /* รอบจบแล้วแต่เจ้านี้ไม่มีรายงานใหม่ ⇒ บอกตรง ๆ ห้ามค้างเป็น "รอ" ตลอดไป และห้ามเดาว่าสำเร็จ */
          ตั้งผล(v.id, จบรอบนี้
            ? { ชนิด: 'ไม่สำเร็จ', ข้อความ: 'g1 กวาดจบแล้วแต่ไม่มีรายงานใหม่ของเจ้านี้' }
            : r0?.กำลังทำ === v.id ? { ชนิด: 'กำลังทำ' } : { ชนิด: 'รอ' })
          continue
        }
        if (x.status === 'OK') ตั้งผล(v.id, { ชนิด: 'สำเร็จ', ข้อความ: x.detail ?? 'OK' })
        else if (x.status === 'AUTH_REQUIRED') ตั้งผล(v.id, { ชนิด: 'ต้องล็อกอิน', ข้อความ: x.detail ?? 'เซสชันหมดอายุ' })
        else ตั้งผล(v.id, { ชนิด: 'ไม่สำเร็จ', ข้อความ: `${x.status}${x.detail ? `: ${x.detail}` : ''}` })
      }
      return จบรอบนี้
    } catch (e) {
      setข้อความบน(`อ่านความคืบหน้าจาก g1 ไม่ได้ — ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }, [เจ้าสคริปต์])

  const กด = async () => {
    if (กำลังรัน) return
    เวลากด.current = Date.now()
    setกำลังรัน(true); setข้อความบน(null); setรอบ(null)
    setผลราย(Object.fromEntries(เจ้า.map((v) => [v.id, { ชนิด: 'รอ' } as ผล])))

    /* จับภาพก่อนสั่ง — อ่านไม่ได้ก็สั่งต่อ (ภาพว่าง ⇒ ทุกรายงานที่มีถือเป็นของใหม่ ซึ่งเป็นทิศที่ g1 เขียนทับอยู่แล้วตอนกวาด) */
    ก่อนกด.current = { เมื่อ: null, at: {} }
    try {
      const r = await fetch('/api/bills/run-all', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (j?.ok) ก่อนกด.current = {
        เมื่อ: j.รอบกวาด?.เมื่อ ?? null,
        at: Object.fromEntries(Object.entries((j.รายเจ้า ?? {}) as Record<string, รายงานg1>).map(([k, x]) => [k, x.at])),
      }
    } catch { /* ไม่มีภาพก่อนกด — ดูหมายเหตุด้านบน */ }

    /* ① สั่ง g1 */
    let g1เริ่มได้ = false
    try {
      const r = await fetch('/api/bills/run-all', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      /* 🔑 ตัดสินจากช่อง upstreamOk/ชนิด ที่เส้นเราเขียน — ไม่มีช่อง = body ไม่ใช่ของเรา (ขอบแทนทิ้ง/middleware) */
      if (j?.upstreamOk === true) g1เริ่มได้ = true
      else if (j?.upstreamOk === false) {
        setข้อความบน(`สั่ง g1 ไม่สำเร็จ: ${j.ข้อความ ?? j.ชนิด}${j.retryable ? ' · ลองกดใหม่ได้' : ' · ต้องมีคนแก้ ลองใหม่ไม่หาย'} — เจ้าทางเมลยังสแกนต่อตามปกติ`)
      } else if (r.status === 403) {
        setข้อความบน('บัญชีนี้สั่งดึงบิลไม่ได้ (สิทธิ์อ่านอย่างเดียว) — ให้แอดมินเป็นคนกด')
      } else {
        setข้อความบน(`สั่ง g1 ไม่สำเร็จ และไม่รู้ว่าเพราะอะไร (HTTP ${r.status} ไม่มีคำอธิบายจากเส้นของเรา) — เจ้าทางเมลยังสแกนต่อตามปกติ`)
      }
    } catch (e) {
      setข้อความบน(`สั่ง g1 ไม่ได้: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!g1เริ่มได้) for (const v of เจ้าสคริปต์) ตั้งผล(v.id, { ชนิด: 'ไม่สำเร็จ', ข้อความ: 'ไม่ได้สั่ง g1 รอบนี้ (ดูข้อความด้านบน)' })

    /* ② สแกนเมลไปพร้อมกัน · ① ถามความคืบหน้าทุก 3 วินาที */
    const งานเมล = สแกนเมล()
    const งานg1 = g1เริ่มได้
      ? new Promise<void>((resolve) => {
          ตัวจับเวลา.current = setInterval(async () => {
            const จบ = await ถามg1หนึ่งครั้ง()
            if (จบ) { หยุดถาม(); resolve(); return }
            if (Date.now() - เวลากด.current > เพดานเวลารอg1) {
              หยุดถาม()
              setข้อความบน('g1 ยังกวาดไม่จบหลัง 15 นาที — ไม่ได้แปลว่าล้มเหลว เปิดหน้านี้ใหม่ภายหลังจะเห็นผลล่าสุด')
              resolve()
            }
          }, 3000)
        })
      : Promise.resolve()
    await Promise.all([งานเมล, งานg1])
    setกำลังรัน(false)
    onDone?.()
  }

  /* ── สรุปแยกกอง — **ไม่มีคำว่า "เสร็จแล้ว" รวม** ── */
  const ทั้งหมด = Object.values(ผลราย)
  const นับ = (ชนิด: ผล['ชนิด']) => ทั้งหมด.filter((x) => x.ชนิด === ชนิด).length
  const มีผล = ทั้งหมด.length > 0

  const ป้าย: Record<ผล['ชนิด'], string> = {
    'รอ': '⏳ รอคิว', 'กำลังทำ': '🔄 กำลังทำ', 'สำเร็จ': '✅ สำเร็จ',
    'ต้องล็อกอิน': '🔐 ต้องล็อกอิน', 'ไม่สำเร็จ': '⚠️ ไม่สำเร็จ',
  }
  const สี: Record<ผล['ชนิด'], string> = {
    'รอ': 'text-gray-400', 'กำลังทำ': 'text-blue-600', 'สำเร็จ': 'text-emerald-700',
    'ต้องล็อกอิน': 'text-violet-700', 'ไม่สำเร็จ': 'text-amber-800',
  }

  return (
    /* ปุ่มชิดขวาเสมอ — ทั้งก่อนกดและตอนแผงผลกางออก (แผงกว้างกว่าปุ่ม ⇒ ถ้าไม่ตรึง ปุ่มจะไหลไปซ้าย) */
    <div className="flex flex-col items-end w-full">
      <button
        type="button"
        onClick={กด}
        disabled={กำลังรัน}
        className="text-[12.5px] font-bold rounded-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait"
      >
        {กำลังรัน
          ? (รอบ?.กำลังทำ ? `กำลังทำ ${รอบ.กำลังทำ} (${รอบ.ทำไปแล้ว}/${รอบ.ทั้งหมด})` : 'กำลังดึงบิล…')
          : '🔄 ดึงบิลทั้งหมด'}
      </button>

      {(มีผล || ข้อความบน) && (
        <div className="mt-3 w-full bg-white border border-gray-200 rounded-xl p-3 text-left">
          {ข้อความบน && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-2">{ข้อความบน}</div>
          )}
          {มีผล && (
            <div className="text-[12.5px] text-gray-600 mb-2">
              {/* 🔑 นับแยกทุกกอง — คนอ่านต้องเห็นทันทีว่ามีเจ้าที่ **ไม่ได้อะไรเลย** */}
              สำเร็จ <b>{นับ('สำเร็จ')}</b> · ต้องล็อกอิน <b className="text-violet-700">{นับ('ต้องล็อกอิน')}</b>
              {' '}· ไม่สำเร็จ <b className="text-amber-800">{นับ('ไม่สำเร็จ')}</b>
              {' '}· ยังไม่จบ <b>{นับ('รอ') + นับ('กำลังทำ')}</b> · จากทั้งหมด {ทั้งหมด.length} เจ้า
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {เจ้า.map((v) => {
              const r = ผลราย[v.id]
              if (!r) return null
              return (
                <div key={v.id} className="py-1.5 text-[12.5px] flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-gray-800 w-[120px] shrink-0">{v.name}</span>
                  <span className="text-gray-400 text-[11.5px] w-[70px] shrink-0">{v.วิธี === 'สคริปต์บน g1' ? '🤖 สคริปต์' : '📧 เมล'}</span>
                  <span className={`font-medium ${สี[r.ชนิด]}`}>{ป้าย[r.ชนิด]}</span>
                  {'ข้อความ' in r && <span className="text-gray-500">{r.ข้อความ}</span>}
                  {r.ชนิด === 'ต้องล็อกอิน' && v.portal && (
                    <a href={v.portal} target="_blank" rel="noopener noreferrer"
                      className="text-violet-700 underline font-medium">เปิดหน้าล็อกอิน ↗</a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
