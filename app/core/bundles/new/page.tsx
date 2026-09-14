'use client'
// เพิ่มสินค้าเป็นชุดใหม่ — เขียนทะลุไป ZORT (Bundle/AddBundle)
//
// สัญญาช่องจากฝั่งท่อ (CEO ตอบ 14 ก.ย. 2569 — **ไม่ได้เดาชื่อช่อง** เพราะเดาผิดมาแล้ว 3 รอบ)
//   ขาเข้าจากจอ:  { ref*, sku*, name*, price* (ตัวเลข), vat? (จำนวนเต็ม),
//                   items*: [ { sku*, qty* (>0) } ], confirm? }
//   ขาออกไป ZORT (ท่อแปลงเอง จอไม่ต้องทำ): { name, sku, sellprice:String, sell_vat_status?,
//                                            list:[{ sku, quantity }] }
//   ⇒ **คีย์ที่จอต้องใช้คือ `items` / `qty` / `price`** ไม่ใช่ `list` / `quantity` / `sellprice`
//     (ชื่อฝั่ง ZORT อยู่ในคอมเมนต์ไว้อ่านตอนดีบัก ห้ามเอามาใช้บนจอ)
//
// 🔴 **ใส่ sku ของชุดตัวเองเป็นส่วนประกอบ = ZORT ตอบ 400** ⇒ กันที่จอ ไม่ปล่อยให้ท่อปฏิเสธแล้วคนงง
// 🔴 สร้างผิดแม้ลบผ่าน Bundle/DeleteBundle ได้ก็ยังเสี่ยง ⇒ บังคับซ้อมก่อนเสมอ
// ⚠️ GetBundleDetail อ่านส่วนประกอบได้แล้ว แต่กระจกซิงก์เป็นรอบ ⇒ สร้างเสร็จต้องรอซิงก์
//    แล้วเปิดหน้ารายละเอียดตรวจอีกครั้งก่อนนำชุดไปขาย
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ShortAddForm } from '@/components/zort/ShortAddForm'

/** 🔴 สวิตช์ปุ่มส่งจริง — ห้ามเปิดจนกว่าเจ้าของร้านจะอนุมัติ "การเพิ่มสินค้าชุด" โดยเฉพาะ */
const REAL_SEND_ENABLED = false

const inp = 'w-full rounded border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400'

interface Line { sku: string; qty: string }

export default function NewBundlePage() {
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: '1' }, { sku: '', qty: '1' }])
  /* รหัสชุดที่พิมพ์อยู่ — ต้องรู้ที่นี่เพื่อกันไม่ให้ใส่ตัวเองเป็นส่วนประกอบ
     ⚠️ ShortAddForm เก็บค่าช่องไว้ข้างใน จอนี้จึงต้องเก็บซ้ำเฉพาะช่องที่ต้องตรวจข้ามกัน */
  const [ownSku, setOwnSku] = useState('')

  const filled = lines.filter((l) => l.sku.trim() !== '' || l.qty.trim() !== '')

  const extraError = useMemo(() => {
    const real = lines.filter((l) => l.sku.trim() !== '')
    if (!real.length) return 'ต้องมีสินค้าในชุดอย่างน้อย 1 รายการ'
    for (const l of real) {
      const n = Number(l.qty)
      if (l.qty.trim() === '' || !Number.isFinite(n)) return `รายการ ${l.sku}: ต้องกรอกจำนวนเป็นตัวเลข`
      if (n <= 0) return `รายการ ${l.sku}: จำนวนต้องมากกว่า 0 (ZORT ไม่รับ 0 หรือค่าลบ)`
    }
    /* 🔴 ZORT ตอบ 400 ถ้าชุดมีตัวเองอยู่ในชุด — บอกที่จอตรง ๆ ว่าทำไม */
    const own = ownSku.trim().toLowerCase()
    if (own && real.some((l) => l.sku.trim().toLowerCase() === own)) {
      return `ใส่รหัสชุดตัวเอง (${ownSku.trim()}) เป็นส่วนประกอบไม่ได้ — ZORT จะปฏิเสธ (400)`
    }
    const seen = new Set<string>()
    for (const l of real) {
      const k = l.sku.trim().toLowerCase()
      if (seen.has(k)) return `รหัส ${l.sku.trim()} ใส่ซ้ำสองแถว — รวมเป็นแถวเดียวแล้วเพิ่มจำนวน`
      seen.add(k)
    }
    return ''
  }, [lines, ownSku])

  /* ของที่จะเติมเข้า body · **ต้องเป็นค่าที่ผูกกับลายเซ็นซ้อมได้** ⇒ ใช้ useMemo
     ถ้าสร้างวัตถุใหม่ทุก render ลายเซ็นจะเปลี่ยนทุกครั้งแล้วปุ่มส่งจริงจะไม่เปิดเลย */
  const extraBody = useMemo(() => ({
    items: lines
      .filter((l) => l.sku.trim() !== '')
      .map((l) => ({ sku: l.sku.trim(), qty: Number(l.qty) })),
  }), [lines])

  const setLine = (i: number, k: keyof Line, val: string) =>
    setLines((o) => o.map((l, j) => (j === i ? { ...l, [k]: val } : l)))

  return (
    <ShortAddForm
      title="เพิ่มสินค้าเป็นชุดใหม่"
      subtitle="เขียนเข้า ZORT โดยตรง (Bundle/AddBundle)"
      param="addbundle"
      refPrefix="BD"
      realSendEnabled={REAL_SEND_ENABLED}
      extraBody={extraBody}
      extraError={extraError}
      warnTop={(
        <>
          ⚠️ ถ้าสร้างผิดต้องลบด้วยคำสั่งถาวรจากหน้ารายละเอียดชุด ⇒ ต้องทดลองส่งก่อนทุกครั้ง
          <br />
          ⚠️ หลังสร้างต้องรอรอบซิงก์ แล้วตรวจส่วนประกอบในหน้า{' '}
          <Link href="/core/bundles" className="underline">สินค้าเป็นชุด</Link> อีกครั้งก่อนนำไปขาย
        </>
      )}
      fields={[
        {
          k: 'sku',
          label: 'รหัสชุด',
          required: true,
          ph: 'เช่น SET-001',
          help: 'เป็นรหัสของชุด ไม่ใช่รหัสสินค้าที่อยู่ในชุด',
        },
        { k: 'name', label: 'ชื่อชุด', required: true, ph: 'เช่น ชุดเลื่อยยนต์พร้อมใช้' },
        { k: 'price', label: 'ราคาขายของชุด', required: true, kind: 'num', ph: 'เช่น 2500' },
        {
          k: 'vat',
          label: 'สถานะภาษีขายของชุด',
          kind: 'int',
          wide: true,
          /* ความหมายของเลขมาจากเอกสารทางการ ZORT V4 (ฝั่งท่ออ่านให้ 14 ก.ย. 2569)
             — ไม่ได้เดา · ค่า 4 มีเฉพาะ AddBundle/UpdateBundle ไม่มีในสินค้าเดี่ยว
             🔴 **ค่าเริ่มต้นต้องเป็น "ไม่ระบุ (ไม่ส่ง)" ไม่ใช่ 0**
                ส่ง 0 = สั่งให้ ZORT ตั้งเป็น Undefined · ไม่ส่ง = ไม่ยุ่งกับค่าเดิม คนละเรื่องกัน
             ⚠️ ท่อรับจำนวนเต็มใด ๆ ไม่ได้จำกัด 0–4 ⇒ จอเป็นด่านเดียวที่กันเลขนอกช่วง */
          options: [
            { v: '', label: 'ไม่ระบุ (ไม่ส่งค่านี้ไป ZORT)' },
            { v: '0', label: '0 — ไม่กำหนด (Undefined)' },
            { v: '1', label: '1 — ไม่มีภาษี (No Vat)' },
            { v: '2', label: '2 — มีภาษี (Have Vat)' },
            { v: '3', label: '3 — ภาษี 0% (Vat 0%)' },
            { v: '4', label: '4 — ใช้ภาษีตามสินค้าในชุด (Use Product Vat)' },
          ],
          help: 'ZORT ระบุไว้ว่าช่องนี้ใช้ได้เฉพาะร้านที่ซื้อส่วนเสริม “Advance Vat” '
            + '— เรายังไม่รู้ว่าร้านเรามีหรือเปล่า ⇒ ถ้าไม่มี ZORT อาจเมินค่านี้เงียบ ๆ '
            + 'ไม่แน่ใจให้ปล่อยเป็น “ไม่ระบุ” แล้วไปตั้งภาษีที่ ZORT จะแน่นอนกว่า',
        },
      ]}
      lockedNote={<>เจ้าของร้านอนุมัติการเขียนจริงไว้เฉพาะใบเสนอราคา
        {' '}การเพิ่มสินค้าชุดต้องขออนุมัติแยก · ระหว่างนี้ทดลองส่งได้เต็มที่ เห็นทุกช่องที่จะส่งจริง</>}
      extra={(
        <div className="mt-5">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-[13px] font-semibold text-gray-700">สินค้าในชุด <span className="text-red-500">*</span></p>
              <p className="text-[11.5px] text-gray-500">ใส่รหัสสินค้าที่มีอยู่แล้วใน ZORT · จำนวนต้องมากกว่า 0</p>
            </div>
            <button type="button" onClick={() => setLines((o) => [...o, { sku: '', qty: '1' }])}
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              + เพิ่มแถว
            </button>
          </div>

          <div className="border border-gray-200 rounded overflow-hidden">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-[12px] text-gray-400 w-5 shrink-0">{i + 1}</span>
                <input className={inp} value={l.sku} placeholder="รหัสสินค้า"
                  onChange={(e) => setLine(i, 'sku', e.target.value)} />
                <input className={`${inp} !w-24 shrink-0 text-right`} value={l.qty} inputMode="decimal"
                  onChange={(e) => setLine(i, 'qty', e.target.value)} />
                <button type="button" onClick={() => setLines((o) => (o.length > 1 ? o.filter((_, j) => j !== i) : o))}
                  disabled={lines.length <= 1}
                  className="text-[12px] text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0 px-1">
                  ลบ
                </button>
              </div>
            ))}
          </div>

          <label className="block mt-3">
            <span className="block text-[11px] font-semibold text-gray-400 mb-1">
              ยืนยันรหัสชุดอีกครั้ง (ไว้กันใส่ตัวเองเป็นส่วนประกอบ)
            </span>
            <input className={inp} value={ownSku} onChange={(e) => setOwnSku(e.target.value)}
              placeholder="พิมพ์รหัสชุดเดียวกับช่องบนสุด" />
          </label>
          <p className="text-[11.5px] text-gray-500 mt-1">
            ZORT ปฏิเสธ (400) ถ้าชุดมีตัวเองอยู่ในชุด · ช่องนี้ทำให้จอเตือนได้ก่อนส่ง
            {' '}— ใส่หรือไม่ใส่ก็ส่งได้ แต่ถ้าไม่ใส่ จอตรวจข้อนี้ให้ไม่ได้
          </p>

          {filled.length > 0 && (
            <p className="text-[12px] text-gray-500 mt-2">
              จะส่งไป {extraBody.items.length} รายการ
              {extraBody.items.length !== filled.length
                && ` (มี ${filled.length - extraBody.items.length} แถวที่ยังไม่ใส่รหัส จะไม่ถูกส่ง)`}
            </p>
          )}
        </div>
      )}
    />
  )
}
