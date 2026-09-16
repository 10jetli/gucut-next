'use client'
// ใบจัดเตรียมสินค้า (picking list) — พิมพ์ทีละหลายใบจากจอรายการขาย
//
// 🔬 ทำไมมีหน้านี้ (วัดจอ ZORT จริง 16 ก.ย. 2569 · `/Sell/list`):
//    ติ๊กเลือกใบแล้วเมนู "พิมพ์เอกสาร" ของ ZORT มี **8 แบบ** —
//    ใบวางบิล · ใบจ่าหน้าจดหมาย/กล่อง · ใบจัดเตรียมสินค้า · ฉลากจัดส่ง · ใบแจ้งยอดชำระ ·
//    ใบส่งสินค้า (PDF) · ใบส่งสินค้า+ใบสั่งซื้อ · ใบยืนยันการจัดส่ง
//    ของเรา **ไม่มีสักแบบ** ⇒ คนแพ็กของยังต้องเปิด ZORT ทุกวัน (เกณฑ์เดียวกับตาราง "เลิกจ่าย ZORT")
//    ⇒ เริ่มจากใบที่ใช้ถี่ที่สุดของคนหน้างานก่อน: **ใบจัดเตรียมสินค้า**
//
// 🔴 **ใบนี้ห้ามขาดแม้ใบเดียว** — ใบที่อ่านไม่สำเร็จแล้วหายเงียบ = ของไม่ถูกแพ็ก ลูกค้าไม่ได้ของ
//    ⇒ ใบที่อ่านไม่สำเร็จต้องขึ้น **แดง** พร้อมเหตุผล และมีคำเตือนบนหัวจอว่ายังไม่ครบ
//    ⇒ ใบที่ท่อตอบมาแต่ **ไม่มีบรรทัดสินค้า** ก็ห้ามพิมพ์เป็นใบเปล่า ต้องเขียนบนใบนั้นว่าห้ามใช้แพ็ก
//
// ⚠️ **ไม่พิมพ์ราคา** — ใบนี้มีไว้หยิบของ คนหยิบไม่ต้องรู้ราคา และใบที่หลุดออกนอกร้านจะไม่พาราคาไปด้วย
//    (ZORT แยกใบราคา/ใบวางบิลไว้ต่างหากอยู่แล้ว)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHead, BtnGhost, thaiDate } from '@/components/zort'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'

/** กันคนวางลิงก์ยาวเกินจนยิงท่อเป็นร้อยครั้ง — ZORT เองก็เลือกได้ทีละหน้า (สูงสุด 100 แถว) */
const MAX_IDS = 100

interface Item { line?: number; sku?: string | null; name?: string | null; qty?: number | null }
interface Order {
  id?: string; number?: string | null; customer?: string | null; channel?: string | null
  order_date?: string | null; ship_channel?: string | null; ship_name?: string | null
  tracking_no?: string | null; is_cod?: boolean | null; status?: string | null
}
interface Sheet { id: string; order?: Order; items?: Item[]; error?: string }

export default function SalesPrintPage() {
  const [ids, setIds] = useState<string[]>([])
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [reading, setReading] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  /* อ่านรายการเลขที่ใบจาก URL เอง (จอนี้ไม่ได้ห่อ Suspense จึงไม่ใช้ useSearchParams —
     กับดักเดิมที่เคยทำให้ build ล้มที่จอรายการขาย) */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('ids') ?? ''
    setIds(raw.split(',').map((x) => x.trim()).filter(Boolean).slice(0, MAX_IDS))
  }, [])

  const load = useCallback(async (list: string[]) => {
    setDone(false); setError(''); setSheets([])
    const out: Sheet[] = []
    for (let i = 0; i < list.length; i++) {
      setReading(i + 1)
      const id = list[i]
      try {
        // eslint-disable-next-line no-await-in-loop -- ท่อยิงรายใบ · ยิงพร้อมกันทีละสิบจะโดนจำกัด
        const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
        // eslint-disable-next-line no-await-in-loop
        const j = await res.json().catch(() => null)
        if (!j) { out.push({ id, error: `อ่านคำตอบไม่ออก (HTTP ${res.status})` }) }
        else if (typeof j.skip === 'string') { out.push({ id, error: SKIP + j.skip }) }
        else if (!res.ok || j.ok === false || j.error) { out.push({ id, error: String(j.error || `ท่อตอบ ${res.status}`) }) }
        else { out.push({ id, order: j.order ?? {}, items: Array.isArray(j.items) ? j.items : [] }) }
      } catch (e) {
        out.push({ id, error: String(e instanceof Error ? e.message : e) })
      }
      setSheets([...out])
    }
    setReading(0); setDone(true)
  }, [])

  useEffect(() => { if (ids.length) void load(ids) }, [ids, load])

  const failed = sheets.filter((s) => s.error)
  const empty = sheets.filter((s) => !s.error && (s.items?.length ?? 0) === 0)
  const ok = sheets.filter((s) => !s.error && (s.items?.length ?? 0) > 0)

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <style>{`
        @media print {
          /* ซ่อนทุกอย่างที่ไม่ใช่ตัวใบ — หัวจอ/ปุ่ม/แถบเมนูไม่ควรกินกระดาษ */
          .no-print { display: none !important; }
          .sheet { page-break-after: always; }
          .sheet:last-child { page-break-after: auto; }
          body { background: #fff; }
        }
      `}</style>

      <div className="no-print">
        <p className="text-[12px] mb-2">
          <Link href="/core/sales" className="text-blue-600 hover:underline">‹ รายการขาย</Link>
        </p>
        <PageHead
          title="ใบจัดเตรียมสินค้า"
          summary={<span className="text-gray-500">
            พิมพ์ทีละหลายใบ — ใช้หยิบของก่อนแพ็ก · <b>ไม่มีราคาบนใบ</b> (ใบราคา/ใบวางบิลยังต้องพิมพ์จาก ZORT)
          </span>}
          actions={
            <>
              <BtnGhost onClick={() => void load(ids)} disabled={reading > 0}>
                {reading > 0 ? `กำลังอ่านใบที่ ${reading} จาก ${ids.length}…` : 'อ่านใหม่'}
              </BtnGhost>
              <button type="button" onClick={() => window.print()}
                disabled={reading > 0 || ok.length === 0}
                className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5 disabled:opacity-40"
                style={{ background: '#4669e5' }}>
                🖨 พิมพ์ {ok.length.toLocaleString('th-TH')} ใบ
              </button>
            </>
          }
        />

        {ids.length === 0 && (
          <ErrorBox title="ยังไม่ได้เลือกใบ">
            เปิดหน้านี้จากจอ <b>รายการขาย</b> — ติ๊กเลือกใบที่จะแพ็ก แล้วกด “พิมพ์ใบจัดเตรียมสินค้า”
          </ErrorBox>
        )}
        {error && <ErrorBox title="อ่านใบไม่สำเร็จ">{error}</ErrorBox>}

        {/* 🔴 คำเตือนต้องอยู่ **เหนือปุ่มพิมพ์ในสายตา** — คนกดพิมพ์แล้วเดินไปหยิบของทันที */}
        {done && failed.length > 0 && (
          <div className="mb-3">
            <ErrorBox title={`อ่านไม่สำเร็จ ${failed.length.toLocaleString('th-TH')} ใบ — อย่าเพิ่งแพ็กจนกว่าจะครบ`}>
              {failed.map((f) => `${f.id}: ${isSkip(f.error) ? (f.error ?? '').slice(SKIP.length) : f.error}`).join(' · ')}
            </ErrorBox>
          </div>
        )}
        {done && empty.length > 0 && (
          <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            ⚠️ มี {empty.length.toLocaleString('th-TH')} ใบที่ท่อตอบมาแต่<b>ไม่มีบรรทัดสินค้า</b> —
            ใบพวกนี้พิมพ์ออกไปจะเป็นใบเปล่า จึงเขียนคำเตือนไว้บนใบนั้นแทน <b>ห้ามใช้แพ็ก</b>
          </p>
        )}
        {reading > 0 && (
          <p className="text-[12.5px] text-gray-600 mb-3">กำลังอ่านใบที่ {reading} จาก {ids.length} — ยังพิมพ์ไม่ได้จนกว่าจะอ่านครบ</p>
        )}
      </div>

      {sheets.filter((s) => !s.error).map((s) => (
        <div key={s.id} className="sheet bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <div className="flex justify-between items-start border-b border-gray-200 pb-3 mb-3">
            <div>
              <h2 className="text-[17px] font-semibold">ใบจัดเตรียมสินค้า</h2>
              <p className="text-[13px] text-gray-600">
                เลขที่ใบ <b>{s.order?.number || s.id}</b>
                {s.order?.order_date && <> · วันที่ {thaiDate(String(s.order.order_date).slice(0, 10))}</>}
              </p>
            </div>
            <div className="text-[12.5px] text-right text-gray-600">
              {s.order?.customer && <div>ลูกค้า: {s.order.customer}</div>}
              {s.order?.channel && <div>ช่องทาง: {s.order.channel}</div>}
              {s.order?.ship_channel && <div>ขนส่ง: {s.order.ship_channel}</div>}
              {s.order?.tracking_no && <div>เลขพัสดุ: {s.order.tracking_no}</div>}
              {s.order?.is_cod && <div className="font-semibold">เก็บเงินปลายทาง (COD)</div>}
            </div>
          </div>

          {(s.items?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded px-3 py-2">
              🔴 ท่อไม่ได้ส่งรายการสินค้าของใบนี้มา — <b>ห้ามใช้ใบนี้แพ็ก</b> ให้เปิดดูใบจริงก่อน
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1.5 w-8">#</th>
                  <th className="py-1.5 w-32">รหัสสินค้า</th>
                  <th className="py-1.5">ชื่อสินค้า</th>
                  <th className="py-1.5 text-right w-20">จำนวน</th>
                  <th className="py-1.5 w-16 text-center">หยิบแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {(s.items ?? []).map((it, i) => (
                  <tr key={`${s.id}-${it.sku ?? i}`} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-400">{i + 1}</td>
                    <td className="py-1.5 font-medium">{it.sku || <span className="text-gray-400">— ไม่มีรหัส</span>}</td>
                    <td className="py-1.5">{it.name || <span className="text-gray-400">— ท่อไม่ได้ส่งชื่อมา</span>}</td>
                    {/* 🔴 จำนวนเป็น null ได้ ⇒ **ห้ามพิมพ์ 0** คนจะข้ามไม่หยิบ */}
                    <td className="py-1.5 text-right font-semibold">
                      {typeof it.qty === 'number' ? it.qty.toLocaleString('th-TH') : <span className="text-red-700">ไม่รู้จำนวน</span>}
                    </td>
                    <td className="py-1.5 text-center text-gray-300">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            พิมพ์จากกระจกข้อมูลของร้าน — ตัวเลขอ่านจากท่อ ณ เวลาที่พิมพ์ · ใบนี้ไม่ใช่เอกสารทางบัญชี
          </p>
        </div>
      ))}
    </div>
  )
}
