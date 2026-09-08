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
import { PageHead, BtnGhost } from '@/components/zort'

interface Resp {
  live?: boolean; number?: string
  'เงินที่ ZORT เก็บไว้'?: Record<string, unknown>
  lines?: Array<{ 'ทุกช่องในบรรทัด'?: Record<string, unknown> }> | null
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
  return (
    <div className="p-4 md:p-6 max-w-[860px]">
      <p className="text-[12px] mb-2"><Link href="/core/quotations" className="text-blue-600 hover:underline">‹ ใบเสนอราคา</Link></p>
      <PageHead title={`ใบเสนอราคา ${d?.number || ''}`}
        summary={<span className="text-gray-400">ดึงสดจาก ZORT รายใบ · จอแสดงช่องตามที่ ZORT ส่งจริง ไม่ตีความแทน</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบเสนอราคาไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
            <p className="text-[13px] font-semibold text-gray-800 mb-2">ช่องเงินที่ ZORT เก็บไว้ (ทุกช่องที่มีค่า)</p>
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
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-gray-800">บรรทัดสินค้า ({d.lines.length})</p>
              {d.lines.map((l, i) => {
                const cells = l['ทุกช่องในบรรทัด'] ?? {}
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-md p-3">
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                      {Object.entries(cells).map(([k, v]) => (
                        <div key={k}><dt className="inline text-gray-400 font-mono text-[10.5px]">{k}:</dt>{' '}
                          <dd className="inline text-gray-800">{fmtVal(v)}</dd></div>
                      ))}
                      {Object.keys(cells).length === 0 && <span className="text-gray-300">บรรทัดว่าง</span>}
                    </dl>
                  </div>
                )
              })}
            </div>
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
