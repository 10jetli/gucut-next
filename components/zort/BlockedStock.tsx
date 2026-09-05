'use client'
// แถบ "สินค้าที่ลูกค้าซื้อไม่ได้เพราะสต็อกติดลบ" — อ่านจาก `/api/core?blocked=1`
//
// 🔴 **ทำไมต้องมี** (5 ก.ย. 2569) — เจอจากสองทางพร้อมกันในวันเดียว
//    ฝั่งจอ: สินค้าหายจากฟีด gucut.com ทั้งตัว (โซ่ 3652 ทั้ง 21 ความยาว)
//    ฝั่งท่อ: Shopee ขึ้นว่าของหมดทั้งที่คลังมีของ
//    ต้นเหตุเดียวกันคือ **สต็อกม้วนแม่ติดลบ** ⇒ floor(ติดลบ ÷ ฟัน) = 0 ทุกความยาว
//    ⇒ ของหายเงียบ ๆ จากหน้าร้านตัวเอง โดยไม่มีอะไรบนจอไหนบอกเลย
//
// 🔴 **เรียงตาม "ปลดล็อกได้กี่รหัส" ไม่ใช่เรียงตามจำนวนที่ติดลบ** (ฝั่งท่อออกแบบไว้ และถูก)
//    01209 ติดลบตัวเดียว ทำให้ 23 รหัสความยาวขายไม่ได้พร้อมกัน
//    ถ้าลิสต์ 23 บรรทัด คนอ่านจะคิดว่ามี 23 ปัญหาแล้วท้อ — ทั้งที่ **นับของครั้งเดียวจบ**
//
// ⚠️ ค่าบริการติดลบเป็นเรื่องปกติ (ตัดจากใบขายแต่ไม่มีสต็อกจริง)
//    ⇒ ไม่นับรวมในตัวเลขปัญหา **แต่ต้องไม่ซ่อน** — โชว์เป็นบรรทัดเล็กว่ามีกี่ตัวที่ไม่นับ
//    ท่อแยกด้วยชนิดสินค้า ไม่ได้ดูจากชื่อ (กติกา no-substring-classification)
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'

interface BlockedRow {
  sku: string
  name?: string
  available?: number
  /** parent = ม้วนแม่ที่ตัดขายเป็นความยาว · item = สินค้าเดี่ยว */
  kind?: 'parent' | 'item'
  /** นับตัวนี้ครั้งเดียว แล้วปลดล็อกได้กี่รหัส */
  unlocks?: number
  children?: string[]
}
interface Resp {
  skip?: string
  negativeRows?: number
  services?: number
  roots?: number
  blockedSkus?: number
  /** ตัวตรวจในตัวจากท่อ: services + roots ต้องเท่ากับ negativeRows */
  addsUp?: boolean
  scope?: string
  servicesNote?: string
  rows?: BlockedRow[]
}

export default function BlockedStock() {
  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/web/core?blocked=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
    } catch (e) {
      // ⚠️ ดึงไม่ได้ ≠ ไม่มีปัญหา — ต้องบอก ไม่ใช่เงียบแล้วดูเหมือนทุกอย่างปกติ
      setErr(String(e instanceof Error ? e.message : e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (err) {
    return (
      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2 mb-3">
        ⚠️ ตรวจสินค้าที่ขายไม่ได้เพราะสต็อกติดลบไม่สำเร็จ — <b>ไม่ได้แปลว่าไม่มีปัญหา</b> ({err})
      </p>
    )
  }
  if (!d || d.skip) return null

  const roots = Number(d.roots ?? 0)
  const blocked = Number(d.blockedSkus ?? 0)
  const rows = Array.isArray(d.rows) ? d.rows : []

  // ⚠️ ตัวตรวจของท่อไม่ผ่าน = อย่าเพิ่งเชื่อตัวเลข ต้องขึ้นเตือน ไม่ใช่โชว์เฉย ๆ
  if (d.addsUp === false) {
    return (
      <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        🔴 <b>ตัวเลขสินค้าติดลบยังไม่ลงตัว</b> — ท่อบอกว่าแถวที่ติดลบ {fmtNum(Number(d.negativeRows ?? 0))} แถว
        {' '}แต่แยกเป็นค่าบริการ {fmtNum(Number(d.services ?? 0))} + ต้นเหตุ {fmtNum(roots)} แล้วไม่เท่ากัน
        {' '}⇒ มีของหายระหว่างทาง <b>อย่าเพิ่งใช้ตัวเลขนี้ตัดสินใจ</b>
      </div>
    )
  }

  if (roots === 0) {
    return (
      <p className="text-[12px] text-gray-500 mb-3">
        ✅ ตรวจสินค้าที่ขายไม่ได้เพราะสต็อกติดลบ: <b>ไม่พบ</b>
        {Number(d.services ?? 0) > 0 && (
          <span className="text-gray-400"> · มีค่าบริการติดลบ {fmtNum(Number(d.services))} ตัว ซึ่งไม่นับเป็นปัญหา</span>
        )}
      </p>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-md px-3.5 py-3 mb-3">
      <p className="text-[13px] text-red-900 leading-relaxed">
        🔴 <b>ลูกค้าซื้อไม่ได้ {fmtNum(blocked)} รหัส</b> เพราะสต็อกติดลบที่ต้นทาง{' '}
        <b>{fmtNum(roots)} รายการ</b>
        {' '}— นับของจริง {fmtNum(roots)} รายการนี้ครั้งเดียว ก็ปลดล็อกได้ทั้งหมด
      </p>
      <p className="text-[11.5px] text-red-800/80 mt-1 leading-relaxed">
        ม้วนที่ติดลบทำให้ทุกความยาวคำนวณได้ 0 ⇒ <b>สินค้าหายจากหน้าร้านและมาร์เก็ตเพลสทั้งตัว</b>
        {' '}ไม่ใช่แค่ขึ้นว่าของหมด
      </p>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 text-[12px] font-medium text-red-800 underline underline-offset-2"
      >
        {open ? 'ซ่อนรายการ' : `ดูว่าต้องนับอะไรบ้าง (${fmtNum(rows.length)} รายการ)`}
      </button>

      {open && (
        <div className="mt-2 bg-white border border-red-200 rounded overflow-hidden">
          {rows.map((r) => (
            <div key={r.sku} className="flex items-start gap-3 px-3 py-2 border-b border-red-100 last:border-0">
              <span className="text-[12px] font-medium text-gray-900 w-[150px] shrink-0">{r.sku}</span>
              <span className="text-[12px] text-gray-600 flex-1 min-w-0 truncate">{r.name || '—'}</span>
              <span className="text-[12px] text-red-700 font-medium w-[80px] text-right shrink-0">
                {fmtNum(Number(r.available ?? 0))}
              </span>
              <span className="text-[11.5px] text-gray-500 w-[130px] text-right shrink-0">
                {/* ⚠️ บอกให้ชัดว่าตัวนี้ปลดล็อกอะไรได้บ้าง ไม่ใช่แค่บอกว่าติดลบเท่าไหร่ */}
                {r.kind === 'parent' && Number(r.unlocks ?? 0) > 1
                  ? <>ม้วนแม่ · ปลด {fmtNum(Number(r.unlocks))} รหัส</>
                  : <>ปลด {fmtNum(Number(r.unlocks ?? 1))} รหัส</>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ขอบเขตของตัวเลข + ของที่ตั้งใจไม่นับ — เห็นได้ ไม่ซ่อน */}
      {d.scope && <p className="text-[11px] text-red-800/70 mt-2 leading-relaxed">{d.scope}</p>}
      {Number(d.services ?? 0) > 0 && (
        <p className="text-[11px] text-red-800/70 mt-1 leading-relaxed">
          ไม่นับค่าบริการติดลบอีก {fmtNum(Number(d.services))} ตัว — {d.servicesNote}
        </p>
      )}
    </div>
  )
}
