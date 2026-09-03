'use client'
// สินค้าเป็นชุด — **หน้าตาลอกจาก `zort-ui/29-zort-สินค้าเป็นชุด-360รายการ.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ" → ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มสินค้าเป็นชุดใหม่
//      → ช่องค้นหา → ตาราง # · รหัส · สินค้าเป็นชุด(รูป+ชื่อ) · ราคาสินค้ารวม ·
//        ราคาขาย · คงเหลือ · พร้อมขาย · วันหมดอายุรายการ · สถานะ · ⋮
// ⚠️ จำนวนมีหน่วย **SET** ต่อท้าย และเลขติดลบเป็นสีแดง (ของจริงมีติดลบอยู่หลายชุด)
//
// 🔴 **สองข้อที่ต้องเขียนบนจอ ห้ามข้าม**
//  1. **ZORT ไม่เปิด API ให้ดึงรายการสินค้าในชุด** (ลองครบ 3 ทาง คืน null ทุกตัว)
//     ⇒ เรารู้ว่ามีชุดอะไร ราคาเท่าไหร่ เหลือกี่ชุด **แต่ไม่รู้ว่าในชุดมีอะไรบ้าง**
//     ⇒ คอลัมน์ "ราคาสินค้ารวม" ของ ZORT คำนวณไม่ได้เลย เพราะมันคือผลรวมราคาส่วนประกอบ
//     ⚠️ **ห้ามเดาส่วนประกอบจากชื่อชุด** — เดาผิดคือตัดสต็อกผิดตัว
//  2. **เรื่องนี้กระทบสต็อกโดยตรง** ขายชุดหนึ่งชุดต้องตัดของหลายตัว
//     ตราบใดที่คลังเงายังไม่รู้จักส่วนประกอบ การตัดสต็อกจะไม่ตรงความจริงทุกครั้งที่ขายชุด
//     (แม้แต่ ZORT เองก็มีชุดคงเหลือติดลบ แปลว่ามันก็ตามไม่ทันเหมือนกัน)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import {
  PageHead, SearchRow, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate,
} from '@/components/zort'

interface Row {
  sku: string
  name: string
  sellprice?: number
  onhand?: number
  available?: number
  active?: boolean
  unit?: string
  /** ผลรวมราคาขายของส่วนประกอบ × จำนวน — **null = มีชิ้นส่วนที่ยังไม่มีราคา**
   *  ⚠️ null ไม่ใช่ 0 · ถ้าคิด 0 จะได้ราคารวมต่ำกว่าจริงแบบดูสมเหตุสมผล จับไม่ได้ด้วยตา */
  itemsValue?: number | null
  itemCount?: number
}
interface BundleItem { line?: number; sku: string; name: string; qty: number }
interface Resp {
  skip?: string
  total: number
  active?: number
  inactive?: number
  negative?: number
  note?: string
  /** เก็บรายการในชุดครั้งเดียวเมื่อไหร่ — ต้องโชว์เสมอ เพราะไม่มีการซิงก์อัตโนมัติ */
  collectedAt?: string
  bundlesWithItems?: number
  lines?: number
  limit?: number
  offset?: number
  rows: Row[]
}

const PAGE = 50

/** จำนวนพร้อมหน่วย เช่น "15 SET" — ติดลบเป็นสีแดงเหมือน ZORT */
function Qty({ n, unit }: { n?: number; unit?: string }) {
  if (typeof n !== 'number') return <span className="text-gray-300">—</span>
  const u = (unit || 'SET').trim()
  return (
    <span className={n < 0 ? 'text-red-500 font-semibold' : 'text-gray-800'}>
      {fmtNum(n)}{u ? ` ${u}` : ''}
    </span>
  )
}

export default function CoreBundlesPage() {
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imgOf = useSkuImages()
  // ส่วนประกอบในชุด — โหลดตอนกดกางเท่านั้น (360 ชุดถ้าโหลดหมดตั้งแต่แรกคือเปล่าประโยชน์)
  const [hoverSku, setHoverSku] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, BundleItem[] | 'loading' | 'error'>>({})

  // ⚠️ ZORT โชว์รายการในชุดเป็น **ป๊อปอัพตอนเอาเมาส์ชี้ชื่อชุด** (ไม่ใช่กางแถว)
  //    และกดที่ชื่อจะไปหน้ารายละเอียดของชุด ⇒ ทำทั้งสองอย่างตามต้นแบบ
  const showItems = useCallback(async (sku: string) => {
    setHoverSku(sku)
    if (items[sku] && items[sku] !== 'error') return
    setItems((m) => ({ ...m, [sku]: 'loading' }))
    try {
      const res = await fetch(`/api/web/core?list=bundleitems&sku=${encodeURIComponent(sku)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setItems((m) => ({ ...m, [sku]: Array.isArray(d?.rows) ? d.rows : [] }))
    } catch {
      setItems((m) => ({ ...m, [sku]: 'error' }))
    }
  }, [items])

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'bundles', limit: String(PAGE), offset: String(off) })
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้าเป็นชุด"
        summary={data ? `จำนวน ${fmtNum(data.total)} รายการ` : 'กำลังโหลด…'}
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/bundle-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              เพิ่มสินค้าเป็นชุดใหม่
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="ค้นหา รหัสชุด หรือชื่อชุด"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงสินค้าเป็นชุดไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          {/* 🔴 ข้อความนี้ห้ามถอด — ตอนนี้เรารู้ส่วนประกอบแล้ว แต่เป็นภาพนิ่งครั้งเดียว
              ไม่ได้ซิงก์เอง (ZORT ไม่เปิด API ให้ดึง ต้องกดเข้าไปดูทีละชุด)
              ⇒ ร้านแก้สูตรชุดเมื่อไหร่ **ไม่มีอะไรเตือน** ⇒ ต้องโชว์วันที่เก็บเสมอ */}
          <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            ⚠️ <b>รายการสินค้าในชุดเป็นภาพนิ่งที่เก็บครั้งเดียว</b>
            {data.collectedAt ? <> เมื่อ <b>{thaiDate(String(data.collectedAt).slice(0, 10))}</b></> : ''}
            {' '}— ZORT ไม่เปิดช่องทางให้ดึงอัตโนมัติ ต้องกดเข้าไปดูทีละชุด
            ⇒ <b>ถ้าร้านแก้สูตรชุดที่ ZORT จะไม่มีอะไรเตือน</b> และตัวเลขที่นี่จะเก่าโดยไม่มีใครรู้
            {typeof data.negative === 'number' && data.negative > 0 && (
              <> · ตอนนี้มีชุดที่คงเหลือ<b>ติดลบ {fmtNum(data.negative)} ชุด</b> —
                ZORT เองก็มีติดลบเหมือนกัน แปลว่าแม้แต่ต้นทางก็ตามไม่ทัน</>
            )}
          </div>

          {/* ⚠️ **ZORT ไม่มีแท็บในจอนี้** — หลังแถวค้นหาคือหัวตารางเลย
              เคยใส่แท็บ เปิด/ปิดใช้งาน ไว้เพราะมีธง active ครบและกรองที่ฐานข้อมูลได้
              แต่กฎที่เจ้าของร้านสั่งคือ "เหมือน ZORT 100% ทุกจุด ไม่เหมือนให้แก้ใหม่"
              และตอนนี้ปิดใช้งาน = 0 อยู่แล้ว แท็บจึงไม่ได้ช่วยอะไรด้วยซ้ำ ⇒ ถอดออก
              (ตัวกรองยังอยู่ฝั่งเซิร์ฟเวอร์ `only=active|inactive` เอากลับมาได้ทันทีถ้าต้องการ) */}

          <TableWrap>
            <table className="w-full min-w-[940px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>สินค้าเป็นชุด</th>
                  <th className={THR}>ราคาสินค้ารวม</th>
                  <th className={THR}>ราคาขาย</th>
                  <th className={THR}>คงเหลือ</th>
                  <th className={THR}>พร้อมขาย</th>
                  <th className={TH}>วันหมดอายุรายการ</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>Marketplace</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={11} icon="🔍" title="ไม่พบชุดที่ค้นหา" detail="ลองพิมพ์รหัสชุดหรือชื่อชุดให้สั้นลง" />
                    : <EmptyState cols={11} icon="📦" title="ยังไม่มีสินค้าเป็นชุด"
                        detail="ชุดสินค้าดึงมาจาก ZORT — สร้างชุดที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700 font-medium`}>{r.sku}</td>
                    {/* รูปอยู่ในคอลัมน์ชื่อ แบบเดียวกับจอสินค้าของ ZORT */}
                    <td className={TD}>
                      <span className="flex items-start gap-2.5">
                        {imgOf(r.sku)
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgOf(r.sku) as string} alt="" loading="lazy"
                              className="w-10 h-10 rounded border border-gray-200 object-cover bg-white shrink-0" />
                          )
                          : <span className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0" />}
                        <span
                          className="relative min-w-0"
                          onMouseEnter={() => showItems(r.sku)}
                          onMouseLeave={() => setHoverSku(null)}
                        >
                          <Link href={`/core/bundles/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">
                            {r.name || '—'}
                          </Link>
                          {hoverSku === r.sku && (
                            <span className="absolute left-0 top-full z-20 mt-1 w-[420px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] p-3.5 block">
                              <span className="block text-[13.5px] font-semibold text-gray-900">{r.name}</span>
                              <span className="block text-[11.5px] text-gray-400 mt-0.5 mb-1.5">รายการ</span>
                              {items[r.sku] === 'loading' && <span className="block text-[12.5px] text-gray-400">กำลังโหลด…</span>}
                              {items[r.sku] === 'error' && <span className="block text-[12.5px] text-red-600">ดึงรายการในชุดไม่ได้</span>}
                              {Array.isArray(items[r.sku]) && (items[r.sku] as BundleItem[]).length === 0 && (
                                <span className="block text-[12.5px] text-gray-500">ชุดนี้ยังไม่มีรายการส่วนประกอบที่เก็บไว้</span>
                              )}
                              {Array.isArray(items[r.sku]) && (items[r.sku] as BundleItem[]).map((it, k) => (
                                <span key={`${it.sku}-${k}`} className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
                                  <span className="text-[12.5px] text-gray-400 w-4 shrink-0">{k + 1}.</span>
                                  <span className="text-[12.5px] text-gray-800 min-w-0 flex-1">{it.name || it.sku}</span>
                                  <span className="text-[12.5px] text-gray-700 shrink-0">{fmtNum(it.qty)}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    {/* ผลรวมราคาขายของส่วนประกอบ — ตรวจกับ ZORT แล้วตรงเป๊ะ (00073-30-KK = 7,632)
                        ⚠️ null = มีชิ้นส่วนที่ยังไม่มีราคา ⇒ แสดงขีด **ห้ามคิดเป็น 0**
                           เพราะจะได้ราคารวมต่ำกว่าจริงแบบดูสมเหตุสมผล ไม่มีใครจับได้ */}
                    <td className={TDR}>
                      {typeof r.itemsValue === 'number'
                        ? fmtMoney(r.itemsValue)
                        : <span className="text-gray-300" title="มีชิ้นส่วนที่ยังไม่ได้ตั้งราคา จึงรวมไม่ได้">—</span>}
                    </td>
                    <td className={TDR}>{typeof r.sellprice === 'number' ? fmtMoney(r.sellprice) : <span className="text-gray-300">—</span>}</td>
                    <td className={TDR}><Qty n={r.onhand} unit={r.unit} /></td>
                    <td className={TDR}><Qty n={r.available} unit={r.unit} /></td>
                    <td className={`${TD} text-gray-400`}>-</td>
                    <td className={TD}>
                      {/* ZORT เขียนเป็นตัวหนังสือเขียว ไม่ใช่ป้ายกลม */}
                      <span className={r.active === false ? 'text-gray-500' : 'text-emerald-600'}>
                        {r.active === false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                      </span>
                    </td>
                    {/* ⚠️ ZORT โชว์ไอคอนร้านมาร์เก็ตเพลสตรงนี้ แต่ **API ไม่ส่งข้อมูลนี้มาเลย**
                        (Bundle/GetBundles ไม่มีช่อง marketplace) ⇒ มีหัวคอลัมน์ให้ผังตรง
                        แต่ใส่ขีด และเขียนเหตุผลไว้ใต้ตาราง — เหมือนที่ทำกับมูลค่ารายคลัง */}
                    <td className={TD}><span className="text-gray-300">—</span></td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกรหัสชุด', onClick: () => { navigator.clipboard?.writeText(r.sku).catch(() => {}) } },
                          { label: 'ดูในจอสินค้า', onClick: () => { window.location.href = `/core/stock?q=${encodeURIComponent(r.sku)}` } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} รายการ
              </span>
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            คอลัมน์ <b>Marketplace</b> ยังว่างทุกแถว เพราะ ZORT ไม่ส่งข้อมูลการผูกชุดกับร้าน
            มาร์เก็ตเพลสออกมาทาง API — มีหัวคอลัมน์ไว้ให้ผังตรงกับ ZORT แต่ไม่เดาข้อมูลใส่
            {data.note ? ` · ${data.note}` : ''}
          </p>
        </>
      )}
    </div>
  )
}
