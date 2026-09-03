'use client'
// SKU ที่ Shopee ขายอยู่ แต่คลังของเราไม่รู้จัก
//
// เรื่องนี้ใหญ่กว่าที่เห็น: ถ้าคลังไม่รู้จัก SKU ตัวไหน แปลว่า **ไม่มีใครคุมสต็อกตัวนั้น**
// ขายเกินได้โดยไม่มีอะไรเตือน · และวันที่เราดันสต็อกเอง ตัวพวกนี้จะถูกดันข้ามไปเงียบ ๆ
//
// แยกสองกอง เพราะแก้คนละแบบ:
//   · จับคู่รหัสฐานได้  → แค่ Shopee ใช้รหัสตัวเลือกละเอียดกว่า ไม่ใช่ของหาย ต้องทำตารางจับคู่
//   · ไม่รู้จักเลย      → ต้องตามหาว่ามันคือสินค้าอะไร แล้วเอาเข้าคลัง
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnPrimary, thaiDate } from '@/components/zort'

interface Row {
  sku: string; name: string; shopee: number
  baseSku: string | null; baseQty: number | null; baseName: string | null
}
interface Resp {
  skip?: string; note?: string
  day?: string; total?: number; mappedToBase?: number; unknown?: number
  rows?: Row[]
}

export default function CoreMissingSkuPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [view, setView] = useState<'unknown' | 'mapped'>('unknown')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ยิงตรงไป Shopee API ช้าได้ จึงให้กดเอง ไม่ดึงตอนเปิดหน้า (กติกาเจ้าของร้าน)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?list=missing-sku')
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { /* ไม่ดึงเอง — รอกดปุ่ม */ }, [])

  const all = data?.rows ?? []
  const needle = q.trim().toLowerCase()
  const shown = all
    .filter((r) => (view === 'mapped' ? !!r.baseSku : !r.baseSku))
    .filter((r) => !needle || r.sku.toLowerCase().includes(needle) || (r.name ?? '').toLowerCase().includes(needle))

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="SKU ที่คลังเราไม่รู้จัก"
        summary="รหัสที่ Shopee ขายอยู่จริง แต่ไม่มีในภาพถ่ายสต็อกของเรา"
        actions={<BtnPrimary onClick={load} disabled={loading}>{loading ? 'กำลังตรวจ…' : 'ตรวจเดี๋ยวนี้'}</BtnPrimary>}
      />

      <p className="text-[12px] text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-relaxed">
        ⚠️ SKU ที่คลังไม่รู้จัก = <b>ไม่มีใครคุมสต็อกตัวนั้น</b> ขายเกินได้โดยไม่มีอะไรเตือน
        และวันที่เราดันสต็อกเอง ตัวพวกนี้จะถูกข้ามไปเงียบ ๆ
      </p>

      {error && <ErrorBox title="ตรวจไม่สำเร็จ">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {!data && !loading && !error && (
        <Card>
          <p className="text-[13px] text-gray-500">
            กดปุ่ม &quot;ตรวจเดี๋ยวนี้&quot; เพื่อเทียบรหัสสินค้าบน Shopee กับภาพถ่ายสต็อกล่าสุดของเรา —
            ต้องยิงไป Shopee จริงจึงใช้เวลาสักครู่ และไม่ดึงเองตอนเปิดหน้า
          </p>
        </Card>
      )}

      {data?.skip && <Card><p className="text-[13px] text-gray-500">⏳ {data.skip}</p></Card>}
      {data?.note && <Card><p className="text-[13px] text-gray-500">{data.note}</p></Card>}

      {data && !data.skip && !data.note && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon="🔢" tone="blue" label="รหัสที่คลังไม่รู้จัก" value={fmtNum(data.total ?? 0)} unit="ตัว"
              note={data.day ? `เทียบกับภาพถ่าย ${thaiDate(data.day)}` : undefined} />
            <StatCard icon="🔗" tone="orange" label="พอเดารหัสฐานได้" value={fmtNum(data.mappedToBase ?? 0)} unit="ตัว"
              note="แค่ชื่อคนละระดับ ไม่ใช่ของหาย" />
            <StatCard icon="❓" tone="red" label="ไม่รู้จักเลย" value={fmtNum(data.unknown ?? 0)} unit="ตัว"
              note="ต้องตามหาว่าคือสินค้าอะไร" />
          </div>

          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setView('unknown')}
                className={`text-[12.5px] font-semibold rounded-xl px-3 py-1.5 border transition-colors ${
                  view === 'unknown' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                ไม่รู้จักเลย ({fmtNum(data.unknown ?? 0)})
              </button>
              <button onClick={() => setView('mapped')}
                className={`text-[12.5px] font-semibold rounded-xl px-3 py-1.5 border transition-colors ${
                  view === 'mapped' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                พอเดารหัสฐานได้ ({fmtNum(data.mappedToBase ?? 0)})
              </button>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นรหัสหรือชื่อสินค้า"
                className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px]" />
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden">
            {shown.length === 0 && (
              <p className="text-[13px] text-gray-400 p-4">
                {view === 'unknown' ? 'ไม่มีรหัสที่หาต้นตอไม่ได้ — ดีมาก' : 'ไม่มีรหัสในกองนี้'}
              </p>
            )}
            {shown.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[680px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">รหัสบน Shopee</th>
                      <th className="text-left font-medium px-3 py-2.5">ชื่อบน Shopee</th>
                      <th className="text-right font-medium px-3 py-2.5">Shopee เหลือ</th>
                      {view === 'mapped' && (
                        <>
                          <th className="text-left font-medium px-3 py-2.5">น่าจะตรงกับรหัสฐาน</th>
                          <th className="text-right font-medium px-4 py-2.5">คลังเราเหลือ</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 300).map((r) => (
                      <tr key={r.sku} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{r.sku}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[260px] truncate">{r.name || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmtNum(r.shopee)}</td>
                        {view === 'mapped' && (
                          <>
                            <td className="px-3 py-2.5 text-gray-600">
                              <div className="font-medium">{r.baseSku}</div>
                              {r.baseName && <div className="text-[11px] text-gray-400 truncate max-w-[200px]">{r.baseName}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              {r.baseQty === null ? '—' : fmtNum(r.baseQty)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shown.length > 300 && (
                  <p className="text-[12px] text-gray-400 px-4 py-3 border-t border-gray-50">
                    แสดง 300 แถวแรกจาก {fmtNum(shown.length)} — ใช้ช่องค้นหาเพื่อหาตัวที่ต้องการ
                  </p>
                )}
              </div>
            )}
            <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-50 leading-relaxed">
              &quot;พอเดารหัสฐานได้&quot; เป็นการ<b>เดา</b>จากรูปแบบรหัส ไม่ใช่การจับคู่ที่ยืนยันแล้ว —
              ก่อนเอาไปใช้ดันสต็อกจริงต้องมีตารางจับคู่ที่คนยืนยันแล้วเท่านั้น
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
