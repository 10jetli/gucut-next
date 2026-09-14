'use client'
/* QR + บาร์โค้ด ของรหัสสินค้า/รหัสชุด — ZORT มีคู่นี้มุมขวาบนของหน้ารายละเอียด
 *
 * 🔴 **สามสถานะของบาร์โค้ด ห้ามยุบเหลือสอง** (กฎเดิมของจอพิมพ์ฉลาก /core/stock/print)
 *   ① ZORT มีบาร์โค้ดของรายการนี้      ⇒ พิมพ์ "ค่าบาร์โค้ดจริง"
 *   ② ZORT บอกว่าไม่มีบาร์โค้ด (noBarcode) ⇒ วาดจาก **รหัสสินค้า** แต่ต้องเขียนกำกับให้เห็น
 *      ⚠️ **ห้ามเอารหัสไปพิมพ์แทนเงียบ ๆ** — ฉลากที่ติดของไปแล้วสแกนได้เลขที่ไม่มีในระบบ
 *   ③ ยังไม่รู้ (ท่อหาไม่เจอรายการนี้)   ⇒ เขียนว่า "ยังไม่รู้" **ไม่ใช่ "ไม่มี"**
 *      ของจริง: ชุด 00073-11.8-NW ท่อตอบ missing ขณะที่ 03409-3 ตอบ noBarcode (ยิงจริง 14 ก.ย. 2569)
 *
 * ⚠️ QR เข้ารหัส **รหัสสินค้า** ไม่ใช่ลิงก์ — เพราะยังไม่รู้ว่า ZORT ใส่อะไรไว้ใน QR ของเขา
 *    ⇒ เขียนบนจอว่า QR นี้คือรหัสอะไร ไม่ปล่อยให้คนเดา
 */
import { useEffect, useState } from 'react'
import { code128b, code128Svg } from '@/lib/barcode128'
import { qrEncode } from '@/lib/qr'

type State = 'loading' | 'have' | 'none' | 'unknown' | 'error'

export default function SkuCodes({ sku }: { sku: string }) {
  const [barcode, setBarcode] = useState<string | null>(null)
  const [state, setState] = useState<State>('loading')
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setState('loading'); setErr('')
    fetch(`/api/web/core?productlabels=${encodeURIComponent(sku)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) { setState('error'); setErr(String(d.error)); return }
        const row = Array.isArray(d?.rows) ? d.rows.find((x: { sku?: string }) => x?.sku === sku) : null
        /* ⚠️ failed = ยิงแล้วล่ม · missing = ท่อไม่รู้จักรหัสนี้ — ทั้งคู่คือ "ยังไม่รู้" ไม่ใช่ "ไม่มี" */
        if (!row) { setState('unknown'); return }
        if (typeof row.barcode === 'string' && row.barcode.trim()) { setBarcode(row.barcode.trim()); setState('have'); return }
        setState(row.noBarcode ? 'none' : 'unknown')
      })
      .catch((e) => { if (alive) { setState('error'); setErr(String(e)) } })
    return () => { alive = false }
  }, [sku])

  /* ค่าที่เอาไปวาดบาร์โค้ด: ค่าจริงถ้ามี · ไม่มีก็ใช้รหัสสินค้า **แล้วบอกว่าใช้รหัส** */
  const value = state === 'have' && barcode ? barcode : sku
  const bc = code128b(value)
  const qr = qrEncode(sku)

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div>
        <p className="text-[11.5px] text-gray-500 mb-1">QR ของรหัสสินค้า</p>
        {qr
          ? (
            <svg viewBox={`0 0 ${qr.size + 4} ${qr.size + 4}`} width={104} height={104}
              shapeRendering="crispEdges" className="border border-gray-200 rounded bg-white">
              {/* ขอบขาว 2 โมดูลรอบนอก — ไม่มีขอบ เครื่องอ่านหาไม่เจอ (เหมือน quiet zone ของบาร์โค้ด) */}
              <rect x="0" y="0" width={qr.size + 4} height={qr.size + 4} fill="#fff" />
              {qr.modules.map((row, r) => row.map((v, c) => (v
                ? <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width="1" height="1" fill="#000" />
                : null)))}
            </svg>
          )
          : (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 max-w-[180px] leading-relaxed">
              รหัสนี้ยาวเกินกว่าจะทำ QR ได้ (เกิน 62 ไบต์) — ไม่วาดรูปหลอก
            </p>
          )}
        <p className="text-[11px] text-gray-400 mt-1 max-w-[110px] break-all">{sku}</p>
      </div>

      <div className="min-w-[240px]">
        <p className="text-[11.5px] text-gray-500 mb-1">บาร์โค้ด (Code 128)</p>
        {bc.error
          ? (
            <p className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5 leading-relaxed">
              วาดบาร์โค้ดไม่ได้: {bc.error} — <b>ห้ามพิมพ์ฉลากใบนี้</b>
            </p>
          )
          : (
            <>
              <div className="w-[240px] h-[52px] bg-white border border-gray-200 rounded px-1"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: code128Svg(bc, 30) }} />
              <p className="text-[12px] text-gray-700 mt-1 font-mono break-all">{value}</p>
            </>
          )}

        {/* 🔴 ที่มาของเลขที่พิมพ์ — ส่วนที่ห้ามเงียบ */}
        {state === 'loading' && <p className="text-[11.5px] text-gray-400 mt-1">กำลังถามว่า ZORT มีบาร์โค้ดของรายการนี้ไหม…</p>}
        {state === 'have' && <p className="text-[11.5px] text-emerald-700 mt-1">✅ เลขนี้คือบาร์โค้ดที่ตั้งไว้ใน ZORT</p>}
        {state === 'none' && (
          <p className="text-[11.5px] text-amber-800 mt-1 leading-relaxed">
            ⚠️ <b>ZORT ไม่มีบาร์โค้ดของรายการนี้</b> — รูปข้างบนวาดจาก<b>รหัสสินค้า</b>
            {' '}สแกนแล้วจะได้ <span className="font-mono">{sku}</span> ไม่ใช่เลขบาร์โค้ด
          </p>
        )}
        {state === 'unknown' && (
          <p className="text-[11.5px] text-gray-600 mt-1 leading-relaxed">
            ⚠️ <b>ยังไม่รู้ว่า ZORT มีบาร์โค้ดของรายการนี้หรือไม่</b> (ท่อไม่พบรายการนี้ในชุดฉลาก)
            {' '}— <b>ไม่ได้แปลว่าไม่มี</b> · รูปข้างบนวาดจากรหัสสินค้า
          </p>
        )}
        {state === 'error' && <p className="text-[11.5px] text-red-700 mt-1">ถามเรื่องบาร์โค้ดไม่สำเร็จ: {err}</p>}
      </div>
    </div>
  )
}
