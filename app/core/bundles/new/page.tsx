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
// 🔴 **ZORT ลบสินค้าชุดผ่าน API ไม่ได้** ⇒ บังคับซ้อมก่อนเสมอ
// ⚠️ รายการส่วนประกอบในชุด ZORT **ไม่เปิดให้ดึงกลับมาอ่าน** ⇒ สร้างแล้วจอเราจะเห็นแค่
//    ชื่อชุด ราคา และจำนวนคงเหลือ ตรวจว่าใส่อะไรไว้ต้องไปดูที่ ZORT ⇒ ต้องเขียนเตือนบนจอ
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
          ⚠️ ZORT <b>ลบสินค้าชุดผ่าน API ไม่ได้</b> — ที่สร้างผิดจะค้างในทะเบียน ⇒ ต้องทดลองส่งก่อนทุกครั้ง
          <br />
          ⚠️ <b>สร้างแล้วจอเราอ่านส่วนประกอบกลับมาไม่ได้</b> — ZORT ไม่เปิดให้ดึงรายการในชุด
          {' '}จอ <Link href="/core/bundles" className="underline">สินค้าเป็นชุด</Link> จะเห็นแค่ชื่อชุด ราคา และจำนวนคงเหลือ
          {' '}⇒ ถ้าใส่ส่วนประกอบผิด <b>ต้องไปดู/แก้ที่ ZORT</b> ตรวจจากจอเราไม่ได้
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
          label: 'รหัสสถานะภาษี (ไม่ใส่ก็ได้)',
          kind: 'int',
          wide: true,
          /* ⚠️ ยังไม่รู้ว่าเลขไหนหมายถึงอะไร ⇒ **ห้ามทำเป็นตัวเลือก "รวม/ไม่รวม VAT"**
             เพราะถ้าเดาเลขผิด ชุดจะถูกตั้งภาษีผิดโดยไม่มีใครรู้ · ถามฝั่งท่อไว้แล้ว */
          help: 'ZORT รับเป็นตัวเลขสถานะภาษี (sell_vat_status) — เรายังไม่รู้ว่าเลขไหนหมายถึงอะไร '
            + 'ไม่แน่ใจให้เว้นว่าง แล้วไปตั้งภาษีที่ ZORT (ถามฝั่งท่อไว้แล้ว จะเปลี่ยนเป็นตัวเลือกเมื่อรู้ความหมายครบ)',
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
