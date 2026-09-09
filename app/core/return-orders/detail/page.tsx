'use client'
// ใบคืนสินค้ารายใบ — เปิดจากเลขที่ใบในจอ "รับคืนสินค้า" (ปิดคู่สุดท้ายของงาน "ZORT กดได้เราไม่")
// เส้น: ?returnorder=<id ZORT ไม่ใช่เลขที่ใบ> — โครงจากซอร์สท่อจริง getReturnOrderDetail (2d6bfea)
//
// ⚠️ **ท่อจงใจไม่ตั้งชื่อช่องเงินให้เส้นนี้** (ต่างจากใบเสนอราคาที่ตั้งแล้ว)
//    เพราะยังไม่เคยเห็นของจริงว่าช่องไหนคือยอดใบ ⇒ จอก็ต้องไม่เดาเหมือนกัน
//    เดาผิด = ยอดคืนผิดทั้งร้าน · เห็นของจริงเมื่อไหร่ค่อยตั้งชื่อพร้อมกันสองฝั่ง
// ⚠️ ห้าม log/ส่งต่อเนื้อหาใบ — มีชื่อลูกค้าจริง
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill, TableWrap, TH, THR, TD, TDR, thaiDate, toneOfStatus } from '@/components/zort'

interface Line {
  sku?: string; name?: string; qty?: number; unit?: string
  'ทุกช่องในบรรทัด'?: Record<string, unknown>
}
interface Resp {
  live?: boolean; number?: string; status?: string; date?: string
  customer?: string; reference?: string
  'เงินที่ ZORT เก็บไว้'?: Record<string, unknown>
  lines?: Line[] | null
  fields?: string[]; error?: string; skip?: string
}

const fmtVal = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('th-TH') : String(v ?? '—')

function Inner() {
  const id = useSearchParams().get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรับคืนสินค้า)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?returnorder=${encodeURIComponent(id)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  /* ด่านเดียวกับใบเสนอราคา/ใบโอน — ท่อเคยหยิบบรรทัดสินค้ามาเป็นหัวใบมาแล้ว (แก้ที่ 6ab53c6)
     ตัวนี้ใช้ pickDocHeader ตัวเดียวกันจึงไม่ควรเกิดอีก แต่ด่านราคาถูกและจับได้ทันทีถ้ากลับมา */
  const LINE_ONLY = ['sku', 'productid', 'pricepernumber', 'bundleitemid']
  const wrongLevel = (d?.fields ?? []).some((f) => LINE_ONLY.includes(String(f).toLowerCase()))
  const money = d?.['เงินที่ ZORT เก็บไว้']

  return (
    <div className="p-4 md:p-6 max-w-[860px]">
      <p className="text-[12px] mb-2"><Link href="/core/return-orders" className="text-blue-600 hover:underline">‹ รับคืนสินค้า</Link></p>
      <PageHead title={`ใบคืนสินค้า ${wrongLevel ? '' : d?.number || ''}`}
        summary={<span className="text-gray-400">ดึงสดจาก ZORT รายใบ · ไม่ใช่กระจก</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบคืนไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && wrongLevel && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-4 text-[12.5px] text-red-800">
          <b>ท่อส่งข้อมูลผิดชั้น — ค่าในใบนี้เชื่อไม่ได้</b>
          <p className="mt-1 text-[11.5px] text-red-700">
            สิ่งที่ได้กลับมาเป็นบรรทัดสินค้า ไม่ใช่หัวใบ (เห็นจากช่อง sku · productid ที่ติดมากับหัวใบ)
            ⇒ เลขที่ใบและตัวเลขด้านล่างไม่ใช่ของใบนี้ · ให้ดูใบจริงที่ ZORT
          </p>
        </div>
      )}

      {!loading && !error && d && !wrongLevel && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
            <div><p className="text-gray-400 text-[11px]">สถานะ</p>
              {d.status ? <Pill tone={toneOfStatus(d.status)}>{d.status}</Pill> : <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11px]">วันที่คืน</p>
              {d.date ? thaiDate(d.date) : <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11px]">ลูกค้า</p>{d.customer || <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11px]">อ้างอิง (ใบขายเดิม)</p>
              {d.reference ? <span className="font-mono text-[12px]">{d.reference}</span> : <span className="text-gray-300">—</span>}</div>
          </div>

          {/* ⚠️ ยอดใบ: ท่อยังไม่ตั้งชื่อช่องให้ ⇒ แสดงทุกช่องที่มีค่าและเขียนบอกตรง ๆ ว่าจอไม่เดา */}
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
            <p className="text-[13px] font-semibold text-gray-800 mb-1">ช่องเงินที่ ZORT เก็บไว้ (ทุกช่องที่มีค่า)</p>
            <p className="text-[11.5px] text-gray-400 mb-2">
              เส้นนี้ยังไม่ได้ตั้งชื่อว่าช่องไหนคือ &ldquo;ยอดคืนของใบ&rdquo; — <b>จอจะไม่เดาให้</b>
              เพราะเดาผิดคือยอดคืนผิดทั้งร้าน
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

          {d.lines === null || d.lines === undefined ? (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⏳ ZORT ไม่ส่งช่องบรรทัดสินค้ามากับใบนี้ — ไม่ใช่ว่าใบว่าง
            </p>
          ) : d.lines.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">ใบนี้ไม่มีบรรทัดสินค้า</p>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-gray-800 mb-2">สินค้าที่คืน ({d.lines.length})</p>
              <TableWrap>
                <table className="w-full min-w-[480px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                      <th className={THR}>จำนวน</th><th className={TH}>หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.sku ?? ''}-${i}`} className="border-b border-[#e8ecf8] last:border-0">
                        {/* รหัสสินค้ากดเข้าหน้าสินค้าได้ — ปลายทางรับ sku ตรง ๆ (ไม่ต้องหา id) */}
                        <td className={`${TD} font-mono text-[12px]`}>
                          {l.sku
                            ? <Link href={`/core/stock/${encodeURIComponent(l.sku)}`}
                                className="text-blue-600 hover:underline">{l.sku}</Link>
                            : '—'}
                        </td>
                        <td className={TD}>{l.name || '—'}</td>
                        <td className={TDR}>{typeof l.qty === 'number' ? l.qty.toLocaleString('th-TH') : '—'}</td>
                        <td className={TD}>{l.unit || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>

              <details className="mt-3">
                <summary className="text-[12px] text-gray-500 cursor-pointer">ดูทุกช่องดิบที่ ZORT ส่งมา (ไว้ไล่ปัญหา)</summary>
                <div className="mt-2 space-y-2">
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

export default function ReturnOrderDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
