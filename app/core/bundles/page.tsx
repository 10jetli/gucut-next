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
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState,
} from '@/components/zort'

interface Row {
  sku: string
  name: string
  sellprice?: number
  onhand?: number
  available?: number
  active?: boolean
  unit?: string
}
interface Resp {
  skip?: string
  total: number
  active?: number
  inactive?: number
  negative?: number
  note?: string
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
  const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imgOf = useSkuImages()

  const load = useCallback(async (off = 0, tabId = tab) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'bundles', limit: String(PAGE), offset: String(off) })
      if (tabId !== 'all') qs.set('only', tabId)
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
  }, [q, tab])

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
          {/* 🔴 ข้อความนี้ห้ามถอด — เป็นข้อจำกัดที่กระทบความถูกต้องของสต็อก ไม่ใช่แค่ช่องว่าง */}
          <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            ⚠️ <b>เรายังไม่รู้ว่าในแต่ละชุดมีสินค้าอะไรบ้าง</b> — ZORT ไม่เปิดช่องทางให้ดึง
            รายการส่วนประกอบของชุด (ลองครบทุกทางแล้ว)
            <br />
            ⇒ คอลัมน์ <b>ราคาสินค้ารวม</b> คำนวณไม่ได้ (มันคือผลรวมราคาส่วนประกอบ) ·
            และ<b>การตัดสต็อกตอนขายชุดจะยังไม่ตรงความจริง</b> เพราะขายชุดหนึ่งชุด
            ต้องตัดของหลายตัว แต่ระบบยังไม่รู้ว่าตัวไหนบ้าง
            {typeof data.negative === 'number' && data.negative > 0 && (
              <> · ตอนนี้มีชุดที่คงเหลือ<b>ติดลบ {fmtNum(data.negative)} ชุด</b> —
                ZORT เองก็มีติดลบเหมือนกัน แปลว่าแม้แต่ต้นทางก็ตามไม่ทัน</>
            )}
          </div>

          {/* ZORT ไม่มีแท็บในจอนี้ — เราเพิ่มเองเพราะมีธง active ครบและกรองที่ฐานข้อมูลได้ */}
          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: data.total },
              { id: 'active', label: 'เปิดใช้งาน', count: data.active },
              { id: 'inactive', label: 'ปิดใช้งาน', count: data.inactive },
            ]}
            active={tab}
            onChange={(id) => { const t = id as 'all' | 'active' | 'inactive'; setTab(t); load(0, t) }}
          />

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
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={10} icon="🔍" title="ไม่พบชุดที่ค้นหา" detail="ลองพิมพ์รหัสชุดหรือชื่อชุดให้สั้นลง" />
                    : <EmptyState cols={10} icon="📦" title="ยังไม่มีสินค้าเป็นชุดในแท็บนี้"
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
                        <span className="text-blue-600 min-w-0">{r.name || '—'}</span>
                      </span>
                    </td>
                    {/* ⚠️ คำนวณไม่ได้จนกว่าจะรู้ส่วนประกอบ — ห้ามเอาราคาขายมาใส่แทน */}
                    <td className={TDR}><span className="text-gray-300">—</span></td>
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

          {data.note && <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">{data.note}</p>}
        </>
      )}
    </div>
  )
}
