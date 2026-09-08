'use client'
// ดูภาพรวมหมวดหมู่ — คู่กับ /Product/CategoryDetail ของ ZORT (แบบแผนข้อ 6: มีหน้า "ดูภาพรวม"
// แยกจาก list · จาก parity-zort-clickability.md 8 ก.ย. 2569)
//
// 🔴 **ประกอบจากเส้นที่มีอยู่แล้ว ไม่มีเส้นใหม่**: list=categories (ตัวเลขระดับหมวด)
//    + list=stock&category=<ชื่อ> (สินค้าในหมวด) — ที่เปิดไว้ตอนทำลิงก์หมวดหมู่
//    ⇒ ไม่ต้องรอท่อ · ข้อดีแถม: ตัวเลขสองแหล่งต้องตรงกัน ถ้าไม่ตรง = จอบอกให้เห็น
//
// ⚠️ ค่า zortValue/zortAvailable/zortSkus เป็น **ค่าที่คัดมือจากจอ ZORT** (API ไม่เปิดให้ดึง)
//    ⇒ เก่าได้ · จอต้องเขียนกำกับ ห้ามโชว์ปนกับค่าที่คิดสดจากกระจกโดยไม่บอก
// ⚠️ หมวด "(ยังไม่ได้จัดหมวดใน ZORT)" = แถว category ว่างในกระจก ไม่ใช่หมวดจริงของ ZORT
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { fmtMoney, fmtNum } from '@/lib/format'
import { PageHead, BtnGhost, Pill, TableWrap, TH, TD } from '@/components/zort'

interface CatRow {
  name: string; skus?: number
  zortValue?: number | null; zortAvailable?: number | null; zortSkus?: number | null
  onhand_value?: number; available_value?: number
  onhand_value_sell?: number; available_value_sell?: number
  no_cost?: number; services?: number; zort?: boolean
}
interface StockRow {
  sku?: string; name?: string; onhand?: number; available?: number
  price?: number; cost?: number
}

const NUM = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function Inner() {
  const catName = useSearchParams().get('name') ?? ''
  const [cat, setCat] = useState<CatRow | null>(null)
  const [items, setItems] = useState<StockRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')

  const load = useCallback(async () => {
    if (!catName) { setError('ไม่ได้ระบุหมวด (ต้องเปิดจากจอหมวดหมู่)'); setLoading(false); return }
    setLoading(true); setError(''); setWarn('')
    try {
      /* ยิงสองเส้นพร้อมกัน — เส้นไหนล้มบอกเฉพาะเส้นนั้น ไม่ทำให้ทั้งจอว่าง */
      const [cRes, sRes] = await Promise.allSettled([
        fetch('/api/web/core?list=categories').then((r) => r.json()),
        fetch(`/api/web/core?list=stock&category=${encodeURIComponent(catName)}&limit=200&marketplaces=1`).then((r) => r.json()),
      ])

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value?.rows)) {
        const hit = (cRes.value.rows as CatRow[]).find((r) => r.name === catName) ?? null
        setCat(hit)
        if (!hit) setWarn(`ไม่พบหมวด "${catName}" ในรายการหมวดหมู่ — อาจถูกลบ/เปลี่ยนชื่อหลังคุณเปิดหน้ามา`)
      } else setWarn('ดึงตัวเลขระดับหมวดไม่ได้ — ตารางสินค้าข้างล่างยังใช้ได้')

      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value?.rows)) {
        setItems(sRes.value.rows as StockRow[])
        setTotal(NUM(sRes.value.total))
      } else {
        setItems(null)
        throw new Error('ดึงรายการสินค้าในหมวดนี้ไม่ได้')
      }
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [catName])
  useEffect(() => { load() }, [load])

  /* ตัวเลขสองแหล่งต้องตรงกัน — ไม่ตรง = บอกให้เห็น ไม่ใช่เลือกข้างเงียบ ๆ
     (จำนวน SKU จาก list=categories vs total จาก list=stock&category) */
  const catSkus = NUM(cat?.skus)
  const mismatch = catSkus !== null && total !== null && catSkus !== total

  return (
    <div className="p-4 md:p-6">
      <p className="text-[12px] mb-2"><Link href="/core/categories" className="text-blue-600 hover:underline">‹ หมวดหมู่</Link></p>
      <PageHead
        title={`หมวด: ${catName || '—'}`}
        summary={<span className="text-gray-400">ภาพรวมหมวด + สินค้าในหมวด (ประกอบจากเส้นที่มีอยู่ ไม่มีเส้นใหม่)</span>}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/core/stock?category=${encodeURIComponent(catName)}`}
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5" style={{ background: '#4669e5' }}>
              เปิดในจอสินค้า
            </Link>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
          </div>
        }
      />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'เปิดหมวดนี้ไม่ได้'}>{error}</ErrorBox>}
      {warn && !error && (
        <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">⚠️ {warn}</p>
      )}
      {loading && <LoadingState />}

      {!loading && !error && (
        <>
          {cat?.zort === false && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
              หมวดนี้<b>ไม่ได้มาจาก ZORT</b> — เป็นกลุ่มที่ระบบเราเดาจากชื่อสินค้า/รวมของที่ยังไม่ได้จัดหมวด
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              ['จำนวน SKU', catSkus === null ? null : catSkus, 'num'],
              ['มูลค่าคงเหลือ (ทุน)', NUM(cat?.onhand_value), 'money'],
              ['มูลค่าพร้อมขาย (ทุน)', NUM(cat?.available_value), 'money'],
              ['มูลค่าคงเหลือ (ราคาขาย)', NUM(cat?.onhand_value_sell), 'money'],
            ].map(([label, val, kind]) => (
              <div key={String(label)} className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[11px] text-gray-400">{String(label)}</p>
                <p className="text-[16px] font-semibold text-gray-900 tabular-nums">
                  {val === null ? <span className="text-[13px] text-gray-300">ไม่รู้ (ท่อไม่ได้ส่งมา)</span>
                    : kind === 'money' ? fmtMoney(val as number) : fmtNum(val as number)}
                </p>
              </div>
            ))}
          </div>

          {/* ค่าที่คัดมือจาก ZORT — แยกกล่องและเขียนกำกับ ห้ามปนกับค่าที่คิดสด */}
          {(NUM(cat?.zortSkus) !== null || NUM(cat?.zortValue) !== null) && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mb-4">
              <p className="text-[12px] font-semibold text-gray-700 mb-1">ค่าที่คัดมาจากจอ ZORT (ไม่ใช่ค่าที่คิดสด)</p>
              <div className="flex flex-wrap gap-4 text-[12.5px]">
                <span>SKU: <b>{NUM(cat?.zortSkus) === null ? '—' : fmtNum(cat!.zortSkus as number)}</b></span>
                <span>มูลค่าคงเหลือ: <b>{NUM(cat?.zortValue) === null ? '—' : fmtMoney(cat!.zortValue as number)}</b></span>
                <span>พร้อมขาย: <b>{NUM(cat?.zortAvailable) === null ? '—' : fmtMoney(cat!.zortAvailable as number)}</b></span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                ต้นทุนเฉลี่ยถ่วงน้ำหนักที่ API ไม่เปิดให้ดึง — <b>ค่าคัดมือจึงเก่าได้</b> ซื้อของเข้าใหม่แล้วต้องคัดใหม่
              </p>
            </div>
          )}

          {mismatch && (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              ⚠️ <b>ตัวเลขสองแหล่งไม่ตรงกัน</b>: หน้าหมวดหมู่นับ {fmtNum(catSkus!)} SKU ·
              ดึงรายการสินค้าในหมวดนี้ได้ {fmtNum(total!)} รายการ — อาจเป็นเพราะเพดานดึง 200
              หรือการนับคนละนิยาม (รวม/ไม่รวมรายการบริการ) · <b>ยังไม่สรุปว่าตัวไหนถูก</b>
            </p>
          )}

          <p className="text-[12.5px] font-semibold text-gray-700 mb-1.5">
            สินค้าในหมวดนี้ {items ? `(${fmtNum(items.length)}${total !== null && total > items.length ? ` จาก ${fmtNum(total)}` : ''})` : ''}
          </p>
          {!items ? null : items.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-6 text-center">
              ไม่มีสินค้าในหมวดนี้ (หมวดมีอยู่จริงแต่ยังไม่มีสินค้าผูกอยู่)
            </p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[620px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                    <th className={`${TH} text-right`}>คงเหลือ</th><th className={`${TH} text-right`}>พร้อมขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.sku ?? i} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} font-mono text-[12px]`}>
                        {it.sku
                          ? <Link href={`/core/stock?q=${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">{it.sku}</Link>
                          : '—'}
                      </td>
                      <td className={TD}>{it.name || '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{NUM(it.onhand) === null ? '—' : fmtNum(it.onhand!)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {NUM(it.available) === null ? '—'
                          : <span className={it.available! < 0 ? 'text-red-600 font-semibold' : ''}>{fmtNum(it.available!)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          {total !== null && items && total > items.length && (
            <p className="text-[11.5px] text-gray-400 mt-2">
              แสดง {fmtNum(items.length)} จาก {fmtNum(total)} รายการ (เพดานดึง 200 ต่อครั้ง) —
              ดูครบที่ <Link href={`/core/stock?category=${encodeURIComponent(catName)}`} className="text-blue-600 hover:underline">จอสินค้า</Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function CategoryDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
