'use client'
// ใบเสนอราคารายใบ — เปิดจากเลขที่ใบในจอใบเสนอราคา (กวาดคลาส "ZORT กดได้เราไม่" 8 ก.ย. 2569)
// เส้น: ?quotation=<id ZORT ไม่ใช่เลขที่ใบ> — โครงจากซอร์สท่อจริง getQuotationDetail:
//   {live, number, 'เงินที่ ZORT เก็บไว้':{ช่องเงินทุกช่องที่มีค่า}, lines:[{'ทุกช่องในบรรทัด':{...}}]|null, fields}
// ⚠️ ท่อจงใจ**ไม่เลือกช่องเงินให้** (ส่งทุกช่องที่มีค่า) — จอก็แสดงตามนั้น ไม่ตีความแทน
//   (บทเรียนใบราคา ฿0: การตีความให้เรียบร้อยเคยปิดบังโครงสร้างจริงจนไล่ปัญหาไม่ได้)
// ⚠️ ห้าม log/ส่งต่อเนื้อหาใบ — มีชื่อ/เบอร์ลูกค้าจริง
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, thaiDate } from '@/components/zort'

interface Line {
  sku?: string; name?: string; qty?: number; unit?: string
  pricePerUnit?: number; total?: number
  'ทุกช่องในบรรทัด'?: Record<string, unknown>
}
interface Resp {
  live?: boolean; number?: string
  /* ── ช่องที่ท่อตั้งชื่อให้แล้ว (ท่อรุ่น 9 ก.ย. 2569 ขึ้นไป) ──
     ⚠️ ท่อรุ่นก่อนหน้าไม่มีช่องพวกนี้เลย และ **deploy สองฝั่งเหลื่อมกันเสมอ**
        ⇒ จอต้องอ่านได้ทั้งสองรุ่น · แยกรุ่นด้วย "มีคีย์ไหม" ไม่ใช่ "ค่าจริงไหม"
        เพราะ amount = 0 เป็นค่าที่ถูกต้องได้ (ใบราคา ฿0 มีจริง) */
  status?: string; date?: string; customer?: string
  amount?: number; vatAmount?: number; discountAmount?: number; shippingAmount?: number
  'เงินที่ ZORT เก็บไว้'?: Record<string, unknown>
  lines?: Line[] | null
  fields?: string[]; error?: string; skip?: string
}

const fmtVal = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('th-TH') : String(v ?? '—')
const baht = (v?: number) =>
  typeof v === 'number' ? `฿${v.toLocaleString('th-TH', { maximumFractionDigits: 2 })}` : '—'

function Inner() {
  const id = useSearchParams().get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอใบเสนอราคา)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?quotation=${encodeURIComponent(id)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const money = d?.['เงินที่ ZORT เก็บไว้']
  /* 🔴 ด่านกัน "ท่อส่งของผิดชั้น" (เจอของจริง 9 ก.ย. 2569)
     ท่อหยิบ **บรรทัดสินค้า** มาเป็นหัวใบ ⇒ number = จำนวนสินค้า (3/2/1) ไม่ใช่เลขที่ใบ
     และกล่องเงินกลายเป็น pricepernumber ของบรรทัดแรก ซึ่ง**หน้าตาเหมือนยอดใบทุกประการ**
     ⇒ จอต้องจับได้เองแล้วหยุดแสดงตัวเลข ดีกว่าโชว์เงินผิดเงียบ ๆ รอท่อแก้
     เกณฑ์: ช่องที่มีได้เฉพาะในบรรทัดสินค้า (sku/productid/pricepernumber) โผล่ในรายชื่อช่องหัวใบ
     🗑️ ท่อแก้แล้วให้ลบด่านนี้ทิ้ง — ตรวจด้วยการเปิดใบจริงแล้วดูว่าเลขที่ใบตรงกับที่กดเข้ามาไหม */
  const LINE_ONLY = ['sku', 'productid', 'pricepernumber', 'bundleitemid']
  const wrongLevel = (d?.fields ?? []).some((f) => LINE_ONLY.includes(String(f).toLowerCase()))
  /** ท่อรุ่นที่ตั้งชื่อช่องให้แล้วหรือยัง — ดูจาก **การมีคีย์** ไม่ใช่ค่า (amount = 0 ถูกต้องได้) */
  const named = !!d && 'amount' in d
  return (
    <div className="p-4 md:p-6 max-w-[860px]">
      <p className="text-[12px] mb-2"><Link href="/core/quotations" className="text-blue-600 hover:underline">‹ ใบเสนอราคา</Link></p>
      {/* ⚠️ ห้ามเอา number ขึ้นหัวเรื่องตอนท่อส่งผิดชั้น — มันคือจำนวนสินค้า ไม่ใช่เลขที่ใบ */}
      <PageHead title={`ใบเสนอราคา ${wrongLevel ? '' : d?.number || ''}`}
        summary={<span className="text-gray-400">ดึงสดจาก ZORT รายใบ · จอแสดงช่องตามที่ ZORT ส่งจริง ไม่ตีความแทน</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบเสนอราคาไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && wrongLevel && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-4 text-[12.5px] text-red-800">
          <b>ท่อส่งข้อมูลผิดชั้น — ตัวเลขในใบนี้เชื่อไม่ได้</b>
          <p className="mt-1 text-[11.5px] text-red-700">
            สิ่งที่ได้กลับมาเป็น<b>บรรทัดสินค้าบรรทัดเดียว</b> ไม่ใช่หัวใบ (เห็นจากช่อง sku · productid ·
            pricepernumber ที่ติดมากับหัวใบ) ⇒ เลขที่ใบด้านบนคือ<b>จำนวนสินค้าในบรรทัด</b> ไม่ใช่เลขที่ใบ
            และช่องเงินคือราคาต่อหน่วย ไม่ใช่ยอดของใบ · แจ้งฝั่งท่อแล้ว 9 ก.ย. 2569 — ระหว่างนี้ให้ดูใบจริงที่ ZORT
          </p>
        </div>
      )}

      {!loading && !error && d && !wrongLevel && (
        <>
          {/* หัวใบแบบ ZORT — ขึ้นเมื่อท่อรุ่นใหม่ส่งช่องที่ตั้งชื่อแล้วมาให้
              ⚠️ เช็ค "มีคีย์ไหม" ไม่ใช่ค่า truthy — ใบยอด ฿0 มีจริง (ของแถม/ลดเต็มจำนวน) */}
          {named ? (
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
              <div><p className="text-gray-400 text-[11px]">สถานะ</p>{d.status || <span className="text-gray-300">—</span>}</div>
              <div><p className="text-gray-400 text-[11px]">วันที่</p>{d.date ? thaiDate(d.date) : <span className="text-gray-300">—</span>}</div>
              <div className="col-span-2"><p className="text-gray-400 text-[11px]">ลูกค้า</p>{d.customer || <span className="text-gray-300">—</span>}</div>
              <div><p className="text-gray-400 text-[11px]">ยอดใบ</p><span className="tabular-nums font-medium">{baht(d.amount)}</span></div>
              <div><p className="text-gray-400 text-[11px]">ภาษี</p><span className="tabular-nums">{baht(d.vatAmount)}</span></div>
              <div><p className="text-gray-400 text-[11px]">ส่วนลด</p><span className="tabular-nums">{baht(d.discountAmount)}</span></div>
              <div><p className="text-gray-400 text-[11px]">ค่าส่ง</p><span className="tabular-nums">{baht(d.shippingAmount)}</span></div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <p className="text-[13px] font-semibold text-gray-800 mb-2">ช่องเงินที่ ZORT เก็บไว้ (ทุกช่องที่มีค่า)</p>
              <p className="text-[11.5px] text-gray-400 mb-2">
                ท่อรุ่นนี้ยังไม่ได้ตั้งชื่อช่องให้ — จอจึงยังไม่รู้ว่าช่องไหนคือยอดใบ และ<b>จะไม่เดาให้</b>
              </p>
              {money && Object.keys(money).length > 0 ? (
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12.5px]">
                  {Object.entries(money).map(([k, v]) => (
                    <div key={k}><dt className="text-gray-400 text-[11px] font-mono">{k}</dt>
                      <dd className="tabular-nums">{fmtVal(v)}</dd></div>
                  ))}
                </dl>
              ) : (
                <p className="text-[12px] text-gray-400">ไม่มีช่องเงินที่มีค่าติดมากับใบนี้</p>
              )}
            </div>
          )}

          {d.lines === null || d.lines === undefined ? (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⏳ ZORT ไม่ส่งช่องบรรทัดสินค้ามากับใบนี้ — ไม่ใช่ว่าใบว่าง
            </p>
          ) : d.lines.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">ใบนี้ไม่มีบรรทัดสินค้า</p>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-gray-800 mb-2">บรรทัดสินค้า ({d.lines.length})</p>
              <TableWrap>
                <table className="w-full min-w-[560px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                      <th className={THR}>จำนวน</th><th className={TH}>หน่วย</th>
                      <th className={THR}>ราคา/หน่วย</th><th className={THR}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.sku ?? ''}-${i}`} className="border-b border-[#e8ecf8] last:border-0">
                        <td className={`${TD} font-mono text-[12px]`}>{l.sku || '—'}</td>
                        <td className={TD}>{l.name || '—'}</td>
                        <td className={TDR}>{typeof l.qty === 'number' ? l.qty.toLocaleString('th-TH') : '—'}</td>
                        <td className={TD}>{l.unit || <span className="text-gray-300">—</span>}</td>
                        <td className={TDR}>{baht(l.pricePerUnit)}</td>
                        <td className={TDR}>{baht(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>

              {/* ก้อนดิบเก็บไว้ในส่วนพับ — ฝั่งท่อสั่งห้ามลบ เพราะเป็นตัวจับวัน ZORT เปลี่ยนชื่อช่อง
                  (ถ้าเหลือแต่ช่องที่ตั้งชื่อแล้ว วันนั้นยอดจะกลายเป็น 0 เงียบ ๆ โดยไม่มีใครเห็นว่ามีช่องใหม่โผล่มา) */}
              <details className="mt-3">
                <summary className="text-[12px] text-gray-500 cursor-pointer">ดูทุกช่องดิบที่ ZORT ส่งมา (ไว้ไล่ปัญหา)</summary>
                <div className="mt-2 space-y-2">
                  {named && money && Object.keys(money).length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <p className="text-[11px] text-gray-400 mb-1">ช่องเงินทั้งหมดของหัวใบ</p>
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                        {Object.entries(money).map(([k, v]) => (
                          <div key={k}><dt className="inline text-gray-400 font-mono text-[10.5px]">{k}:</dt>{' '}
                            <dd className="inline text-gray-800 tabular-nums">{fmtVal(v)}</dd></div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {d.lines.map((l, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-md p-3">
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                        {Object.entries(l['ทุกช่องในบรรทัด'] ?? {}).map(([k, v]) => (
                          <div key={k}><dt className="inline text-gray-400 font-mono text-[10.5px]">{k}:</dt>{' '}
                            <dd className="inline text-gray-800">{fmtVal(v)}</dd></div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            ช่องทั้งหมดที่ ZORT ส่งมากับหัวใบ: <span className="font-mono">{(d.fields ?? []).join(', ') || 'ไม่ทราบ'}</span>
          </p>
        </>
      )}
    </div>
  )
}

export default function QuotationDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
