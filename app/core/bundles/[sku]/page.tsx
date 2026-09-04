'use client'
// รายละเอียดสินค้าเป็นชุด — **ลอกจากจอจริงของ ZORT** (`/Bundle/Details?&id=…`)
// ผัง: รูป | ชื่อชุด + ป้ายสถานะ · รหัสสินค้า · ราคาขาย · วันหมดอายุรายการ
//      → ตาราง "สินค้าใน สินค้าเป็นชุด": # · รหัส · ชื่อสินค้า · จำนวน
//
// ⚠️ ZORT มี QR + บาร์โค้ดมุมขวาบน และการ์ด "ยอดขาย" กับ "จำนวนสินค้าคงเหลือ รายคลัง"
//    ⇒ **ยังไม่ทำ** เพราะสองอย่างหลังต้องใช้สต็อกรายคลัง ซึ่ง ZORT ไม่เปิด API ให้ดึง
//      (ยิงมาแล้ว 404 ทุกทาง) · ทำเป็นการ์ดเปล่า = สัญญาของที่ไม่มี
// ⚠️ รายการในชุดเป็น **ภาพนิ่งเก็บครั้งเดียว ไม่ได้ซิงก์เอง** ⇒ ต้องบอกวันที่เก็บเสมอ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import { TableWrap, TH, THR, TD, TDR, BtnGhost, EmptyState, thaiDate } from '@/components/zort'

interface BundleRow {
  sku: string; name: string
  sellprice?: number; onhand?: number; available?: number
  active?: boolean; unit?: string
}
interface Item { line?: number; sku: string; name: string; qty: number }

export default function BundleDetailPage() {
  const params = useParams<{ sku: string }>()
  const sku = decodeURIComponent(String(params?.sku ?? ''))
  const [bundle, setBundle] = useState<BundleRow | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [collectedAt, setCollectedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imgOf = useSkuImages(640)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, iRes] = await Promise.all([
        fetch(`/api/web/core?list=bundles&q=${encodeURIComponent(sku)}&limit=5`).then((r) => r.json()),
        fetch(`/api/web/core?list=bundleitems&sku=${encodeURIComponent(sku)}`).then((r) => r.json()),
      ])
      if (bRes?.error) throw new Error(bRes.error)
      const rows: BundleRow[] = Array.isArray(bRes?.rows) ? bRes.rows : []
      // ⚠️ ค้นหาคืนหลายแถวได้ — ต้องหาแถวที่รหัสตรงเป๊ะ ไม่ใช่หยิบแถวแรก
      setBundle(rows.find((r) => r.sku === sku) ?? null)
      setItems(Array.isArray(iRes?.rows) ? iRes.rows : [])
      setCollectedAt(typeof iRes?.collectedAt === 'string' ? iRes.collectedAt : '')
    } catch (e) {
      setBundle(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])

  useEffect(() => { load() }, [load])

  const img = imgOf(sku)

  return (
    <div className="p-4 md:p-6">
      <Link href="/core/bundles" className="text-[12.5px] text-blue-600 hover:underline">← สินค้าเป็นชุด</Link>

      {error && <ErrorBox title="ดึงข้อมูลชุดไม่ได้">{error}</ErrorBox>}
      {loading && !bundle && <LoadingState />}

      {!loading && !bundle && !error && (
        <div className="bg-white border border-gray-200 rounded-md p-6 mt-3 text-[13px] text-gray-500">
          ไม่พบชุดรหัส <b>{sku}</b> ในคลังของเรา — อาจถูกลบที่ ZORT หรือรหัสพิมพ์ผิด
        </div>
      )}

      {bundle && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-5 mt-3 flex flex-wrap gap-6">
            {img
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="w-[180px] h-[130px] rounded border border-gray-200 object-cover bg-white" />
              )
              : <span className="block w-[180px] h-[130px] rounded border border-gray-200 bg-gray-100" />}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[20px] font-semibold text-gray-900">{bundle.name || sku}</h1>
                <span className={`text-[11.5px] font-semibold rounded px-2 py-0.5 ${
                  bundle.active === false ? 'text-gray-600 bg-gray-100' : 'text-emerald-800 bg-emerald-100'
                }`}>
                  {bundle.active === false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 mt-4 max-w-[560px]">
                <div>
                  <p className="text-[12px] text-gray-500">รหัสสินค้า</p>
                  <p className="text-[15px] text-gray-900">{bundle.sku}</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาขาย</p>
                  <p className="text-[15px] text-gray-900">
                    {typeof bundle.sellprice === 'number' ? `${fmtMoney(bundle.sellprice)} บาท` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">วันหมดอายุรายการ</p>
                  <p className="text-[15px] text-gray-400">-</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">คงเหลือ</p>
                  <p className={`text-[15px] ${Number(bundle.onhand) < 0 ? 'text-red-500 font-semibold' : 'text-gray-900'}`}>
                    {typeof bundle.onhand === 'number' ? `${fmtNum(bundle.onhand)} ${bundle.unit || 'SET'}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">พร้อมขาย</p>
                  <p className={`text-[15px] ${Number(bundle.available) < 0 ? 'text-red-500 font-semibold' : 'text-gray-900'}`}>
                    {typeof bundle.available === 'number' ? `${fmtNum(bundle.available)} ${bundle.unit || 'SET'}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
          </div>

          <p className="text-[15px] font-semibold text-gray-900 mt-5 mb-2">สินค้าใน สินค้าเป็นชุด</p>
          <TableWrap>
            <table className="w-full min-w-[620px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <EmptyState cols={4} icon="📦" title="ยังไม่มีรายการส่วนประกอบของชุดนี้"
                    detail="รายการในชุดเก็บมาจากหน้ารายละเอียดของ ZORT ทีละชุด — ชุดนี้อาจยังไม่ถูกเก็บ" />
                )}
                {items.map((it, i) => (
                  <tr key={`${it.sku}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{it.line ?? i + 1}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Link href={`/core/stock?q=${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                        {it.sku}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Link href={`/core/stock/${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                        {it.name || '—'}
                      </Link>
                    </td>
                    <td className={TDR}>{fmtNum(it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            {collectedAt
              ? <>รายการในชุดนี้เก็บไว้เมื่อ <b>{thaiDate(collectedAt.slice(0, 10))}</b> — เป็นภาพนิ่งครั้งเดียว
                <b> ไม่ได้ซิงก์เอง</b> ถ้าร้านแก้สูตรชุดที่ ZORT จะไม่มีอะไรเตือน</>
              : 'รายการในชุดเป็นภาพนิ่งที่เก็บครั้งเดียว ไม่ได้ซิงก์เอง'}
            <br />
            ⚠️ ZORT มีการ์ด <b>ยอดขาย</b> กับ <b>จำนวนสินค้าคงเหลือ รายคลัง</b> ในหน้านี้ด้วย —
            ยังไม่ทำเพราะสต็อกรายคลัง ZORT ไม่เปิดช่องทางให้ดึง (ยิงมาแล้วไม่ผ่านทุกทาง)
          </p>
        </>
      )}
    </div>
  )
}
