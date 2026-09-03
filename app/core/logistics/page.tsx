'use client'
// รายการขาย → บริการส่งสินค้า — **ลอกจาก `zort-ui/52-zort-บริการส่งสินค้า.jpg`**
// ผัง ZORT: ชื่อจอ "บริการขนส่ง" → "จำนวน N รายการ" → ปุ่ม นำเข้ารายการไฟล์ Excel · ขนส่ง
//   → ช่องค้นหา + ค้นหาขั้นสูง
//   → ตาราง: รายการ (เลขพัสดุ + เลขพัสดุตัวเล็กใต้) · วันที่ · ชื่อผู้รับ · จำนวนรายการขาย ·
//            ชำระเงิน · สถานะ · หมายเลขออเดอร์
//
// 💡 **ZORT ไม่มี API ขนส่งแยกเลย** (Logistic · Shipping · Delivery ตอบ 404 หมด)
//    แต่ใบขายมีข้อมูลขนส่งครบอยู่ในตัว ⇒ จอนี้อ่านจากกระจกออเดอร์ ไม่ยิง ZORT เพิ่มสักครั้ง
//
// 🔴 **จำนวนของเราน้อยกว่า ZORT และห้ามปิดบัง**
//    เราเพิ่งเริ่มเก็บช่องขนส่ง 3 ก.ย. 2569 ⇒ ใบเก่าที่ไม่ขยับแล้วยังไม่มีเลขพัสดุ
//    ห้ามเขียนว่า "ทั้งหมด N ใบ" ⇒ ต้องเขียนว่า "เท่าที่เก็บได้" พร้อมบอกว่า ZORT มีเท่าไหร่
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  Pill, toneOfStatus, EmptyState, thaiDate, RowMenu,
} from '@/components/zort'

interface Row {
  id: string; number: string; trackingNo?: string; date?: string
  receiver?: string; carrier?: string; status?: string
  isCod?: boolean; lines?: number
}
interface Resp {
  total: number; shipped?: number; unshipped?: number; cod?: number
  limit: number; offset: number; only?: string | null
  coversFrom?: string; zortShows?: number; note?: string
  rows: Row[]
}

const PAGE = 50
const STATUS_TH: Record<string, string> = {
  Success: 'สำเร็จ', Voided: 'ยกเลิก', Pending: 'รอดำเนินการ', Waiting: 'รอ',
}
const statusTh = (s?: string) => STATUS_TH[String(s ?? '')] ?? (s || 'ไม่ระบุสถานะ')

export default function LogisticsPage() {
  const router = useRouter()
  const [data, setData] = useState<Resp | null>(null)
  const [only, setOnly] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, onlyId = only) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'logistics', limit: String(PAGE), offset: String(off) })
      if (onlyId) qs.set('only', onlyId)
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [only, q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  const tabs = [
    { id: '', label: 'ทั้งหมด', count: data?.total },
    { id: 'cod', label: 'เก็บเงินปลายทาง', count: data?.cod },
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="บริการขนส่ง"
        summary={
          data
            ? (
              <>
                {/* ⚠️ คำว่า "เท่าที่เก็บได้" ห้ามตัดทิ้ง — เลขนี้ไม่ใช่ยอดขนส่งทั้งหมดของร้าน */}
                เท่าที่เก็บได้ <b>{fmtNum(data.total)}</b> รายการ
                {typeof data.cod === 'number' && <> · เก็บเงินปลายทาง {fmtNum(data.cod)} ใบ</>}
                {' | '}
                <span className="text-gray-400">อ่านจากกระจกออเดอร์ ไม่ได้ยิง ZORT</span>
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <Link href="/core/soon/shipping"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้ารายการไฟล์ Excel
            </Link>
            <Link href="/core/soon/shipping"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              ขนส่ง
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขพัสดุ ชื่อผู้รับ เลขที่ใบขาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการขนส่งไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {/* 🔴 กล่องนี้คือหัวใจของจอนี้ — ห้ามถอด
              จอที่โชว์ 540 ใบเฉย ๆ จะถูกอ่านว่า "ร้านส่งของไป 540 ครั้ง" ซึ่งผิด
              ความจริงคือ "เราเก็บเลขพัสดุได้ 540 ใบ นับจากวันที่เริ่มเก็บ" */}
          <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            <b>ตัวเลขนี้ยังไม่เท่ากับของ ZORT และนั่นถูกต้อง</b> —
            {data.coversFrom && <> {data.coversFrom} ·</>}
            {typeof data.zortShows === 'number' && (
              <> จอเดียวกันของ ZORT แสดง <b>{fmtNum(data.zortShows)}</b> รายการ</>
            )}
            {' '}⇒ ส่วนที่ขาดคือ<b>ใบเก่าที่ไม่ขยับแล้ว</b> ซึ่งยังไม่เคยถูกเก็บเลขพัสดุเข้ามา
            {' '}<b>ไม่ใช่ใบที่หายไป</b> · จะเท่ากันเมื่อกวาดใบเก่าย้อนหลังครบ
            {data.note && <><br /><span className="text-amber-900/70">{data.note}</span></>}
          </div>

          <Tabs tabs={tabs} active={only} onChange={(id) => { setOnly(id); load(0, id) }} />

          <TableWrap>
            <table className="w-full min-w-[900px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>ชื่อผู้รับ</th>
                  <th className={THR}>จำนวนรายการขาย</th>
                  <th className={TH}>ชำระเงิน</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>หมายเลขออเดอร์</th>
                  <th className={TH} style={{ width: 56 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={8} icon="🚚" title="ไม่พบรายการขนส่ง"
                    detail={q ? 'ลองพิมพ์คำสั้นลง หรือค้นด้วยเลขพัสดุเต็ม' : 'ยังไม่มีใบที่มีเลขพัสดุในเงื่อนไขนี้'} />
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={TD}>
                      {/* ZORT โชว์เลขพัสดุสองบรรทัด (ลิงก์ + เลขเดิมซ้ำตัวเล็ก) และมีโลโก้ขนส่งข้างหน้า
                          ⇒ บรรทัดล่างของเราใส่ **ชื่อขนส่ง** แทนการซ้ำเลขเดิม
                             เพราะเรายังไม่มีโลโก้ ถ้าซ้ำเลขด้วยจะไม่เหลือที่บอกว่าส่งกับเจ้าไหนเลย */}
                      {/* กดแล้วไปใบขายของพัสดุนั้น — ปลายทางมีจริง */}
                      <Link href={`/core/sales/detail?id=${encodeURIComponent(r.id)}`} className="text-blue-600 hover:underline font-medium">
                        {r.trackingNo || r.number}
                      </Link>
                      <span className="block text-[11px] text-gray-400">
                        {r.carrier || 'ไม่ระบุขนส่ง'}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.date ? thaiDate(r.date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} max-w-[200px] truncate`}>{r.receiver || <span className="text-gray-300">—</span>}</td>
                    <td className={TDR}>{fmtNum(Number(r.lines ?? 0))}</td>
                    <td className={TD}>
                      {/* ⚠️ COD = เก็บเงินปลายทาง (ยังไม่ได้เงิน) ไม่ใช่ "จ่ายแล้ว" — ห้ามใช้สีเขียว */}
                      {r.isCod
                        ? <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">COD</span>
                        : <span className="text-gray-400 text-[12px]">โอน/ชำระก่อน</span>}
                    </td>
                    <td className={TD}><Pill tone={toneOfStatus(r.status ?? '')}>{statusTh(r.status)}</Pill></td>
                    <td className={`${TD} text-gray-600 whitespace-nowrap`}>{r.number}</td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          {
                            label: 'คัดลอกเลขพัสดุ',
                            onClick: () => { navigator.clipboard?.writeText(r.trackingNo ?? '').catch(() => {}) },
                          },
                          {
                            label: 'เปิดใบขายนี้',
                            onClick: () => router.push(`/core/sales/detail?id=${encodeURIComponent(r.id)}`),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white text-[12px] text-gray-600">
              <span>
                แสดง {fmtNum(offset + rows.length)} จาก {fmtNum(data.total)} รายการ
              </span>
              <span className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>ก่อนหน้า</BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || offset + rows.length >= data.total}>ถัดไป</BtnGhost>
              </span>
            </div>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ZORT มีคอลัมน์ <b>บริการขนส่ง</b> เป็นโลโก้ขนส่ง — ของเราเก็บเป็นชื่อที่ ZORT ส่งมา
            ซึ่งสะกดได้หลายแบบ (Flash express · Flash Express · FLASH) จึงยังไม่จับคู่โลโก้
            <b> ใส่โลโก้จากการเดาชื่อไม่ได้</b> เดี๋ยวจะติดโลโก้ผิดเจ้า
          </p>
        </>
      )}
    </div>
  )
}
