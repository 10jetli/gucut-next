'use client'
// ใบโอนรายใบ — เปิดจากเลขที่ใบในจอรายการโอน (กวาดคลาส "ZORT กดได้เราไม่" 8 ก.ย. 2569)
// เส้น: ?transfer=<id ZORT ไม่ใช่เลขที่ใบ> → {live, number, status, date, from, to, tracking,
//   lines:[{sku,name,qty}]|null, fields} — โครงจากซอร์สท่อจริง getTransferDetail
// ⚠️ สามสถานะบรรทัดสินค้า: null = ZORT ไม่ส่งช่องบรรทัดมา · [] = ใบนี้ไม่มีของ — คนละคำ
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill, TableWrap, TH, TD, thaiDate } from '@/components/zort'

interface Line { sku?: string; name?: string; qty?: number }
interface Resp {
  live?: boolean; number?: string; status?: string; date?: string
  from?: string; to?: string; tracking?: string
  lines?: Line[] | null; fields?: string[]; error?: string; skip?: string
}

function Inner() {
  const id = useSearchParams().get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรายการโอน)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?transfer=${encodeURIComponent(id)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 md:p-6 max-w-[860px]">
      <p className="text-[12px] mb-2"><Link href="/core/transfers" className="text-blue-600 hover:underline">‹ รายการโอนสินค้า</Link></p>
      <PageHead title={`ใบโอน ${d?.number || ''}`}
        summary={<span className="text-gray-400">ดึงสดจาก ZORT รายใบ — ไม่ใช่กระจก</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบโอนไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
            <div><p className="text-gray-400 text-[11px]">สถานะ</p><Pill tone={d.status === 'Success' ? 'green' : 'orange'}>{d.status || '—'}</Pill></div>
            <div><p className="text-gray-400 text-[11px]">วันที่โอน</p>{thaiDate(d.date)}</div>
            <div><p className="text-gray-400 text-[11px]">จากคลัง → ไปคลัง</p>{d.from || '—'} → {d.to || '—'}</div>
            <div><p className="text-gray-400 text-[11px]">เลขพัสดุ</p>
              {d.tracking ? <span className="font-mono">{d.tracking}</span> : <span className="text-gray-300">ไม่มี</span>}</div>
          </div>

          {d.lines === null || d.lines === undefined ? (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⏳ ZORT ไม่ส่งช่องบรรทัดสินค้ามากับใบนี้ — ไม่ใช่ว่าใบว่าง (ช่องที่ส่งมาจริง: {(d.fields ?? []).join(', ') || 'ไม่ทราบ'})
            </p>
          ) : d.lines.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">ใบนี้ไม่มีบรรทัดสินค้า</p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[480px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr><th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th><th className={`${TH} text-right`}>จำนวน</th></tr>
                </thead>
                <tbody>
                  {d.lines.map((l, i) => (
                    <tr key={`${l.sku}-${i}`} className="border-b border-[#e8ecf8] last:border-0">
                      <td className={`${TD} font-mono text-[12px]`}>{l.sku || '—'}</td>
                      <td className={TD}>{l.name || '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{typeof l.qty === 'number' ? l.qty.toLocaleString('th-TH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </>
      )}
    </div>
  )
}

export default function TransferDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
