'use client'
// หมวดหมู่สินค้า — ตัวแทนหน้า "สินค้า → หมวดหมู่" ของ ZORT
//
// ใช้ข้อมูลชุดเดียวกับแผงหมวดใน POS (/api/core?list=poscats) จึงเป็นของจริง ไม่ใช่หน้าเปล่า
// ⚠️ หมวดพวกนี้ **ไม่ใช่หมวดที่ตั้งไว้ใน ZORT** — เป็นการจัดกลุ่มจากชื่อสินค้าจริงทั้งคลัง
//    ที่ฝั่งท่อหลังบ้านทำขึ้น ต้องเขียนบอกไว้ ไม่งั้นเข้าใจว่าแก้ที่นี่แล้วมีผลกับ ZORT
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR } from '@/components/zort'

interface Cat { code: string; name: string; items: number }

export default function CoreCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [unnamed, setUnnamed] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?list=poscats')
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setCats(Array.isArray(d?.cats) ? d.cats : [])
      setUnnamed(typeof d?.unnamed === 'number' ? d.unnamed : null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setCats([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const total = cats.reduce((s, c) => s + (Number(c.items) || 0), 0)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="หมวดหมู่"
        summary={`จำนวน ${cats.length.toLocaleString('th-TH')} หมวด · ครอบสินค้า ${total.toLocaleString('th-TH')} รายการ`}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      <div className="text-[12.5px] text-blue-800 bg-blue-50 border border-blue-100 rounded px-3 py-2 mb-3 leading-relaxed">
        ℹ️ หมวดพวกนี้ <b>จัดกลุ่มจากชื่อสินค้าจริงทั้งคลัง</b> ไม่ใช่หมวดที่ตั้งไว้ใน ZORT —
        แก้ที่นี่ไม่มีผลกับ ZORT และแก้ที่ ZORT ก็ไม่มีผลกับที่นี่
        · ใช้ชุดเดียวกับแผงเลือกสินค้าในจอขายหน้าร้าน
      </div>

      {error && <ErrorBox title="ดึงหมวดหมู่ไม่ได้">{error}</ErrorBox>}
      {loading && cats.length === 0 && <LoadingState />}

      {!loading && !error && (
        <TableWrap>
          <table className="w-full min-w-[520px]">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className={TH} style={{ width: 44 }}>#</th>
                <th className={TH}>หมวดหมู่</th>
                <th className={TH}>รหัสหมวด</th>
                <th className={THR}>จำนวนสินค้า</th>
                <th className={TH} style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-[13px] text-gray-400 text-center">ยังไม่มีหมวดหมู่</td></tr>
              )}
              {cats.map((c, i) => (
                <tr key={c.code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className={`${TD} text-gray-400`}>{i + 1}</td>
                  <td className={`${TD} text-gray-800 font-medium`}>{c.name}</td>
                  <td className={`${TD} text-gray-400`}>{c.code}</td>
                  <td className={TDR}>{fmtNum(c.items)}</td>
                  <td className={`${TD} text-right`}>
                    {/* เปิดจอขายหน้าร้านแล้วเลือกหมวดนี้ได้เลย — ทางลัดที่คนขายใช้จริง */}
                    <Link href="/core/pos" className="text-[12px] text-blue-600 hover:underline">
                      เปิดใน POS
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {unnamed !== null && unnamed > 0 && (
            <p className="text-[12px] text-gray-500 px-3 py-3 border-t border-gray-200">
              มีสินค้าอีก <b>{fmtNum(unnamed)}</b> รายการที่จัดหมวดไม่ได้ (ส่วนใหญ่ชื่อเป็นภาษาอังกฤษ
              ไม่มีรหัสรุ่น) — อยู่ในหมวด &quot;อื่น ๆ&quot; · คนขายใช้ช่องค้นหาหรือยิงบาร์โค้ดหาแทนได้
            </p>
          )}
        </TableWrap>
      )}
    </div>
  )
}
