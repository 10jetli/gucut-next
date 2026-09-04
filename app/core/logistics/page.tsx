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
  Pill, toneOfStatus, EmptyState, thaiDate, RowMenu, CarrierMark,
} from '@/components/zort'

interface Row {
  id: string; number: string; trackingNo?: string; date?: string
  receiver?: string; carrier?: string; status?: string
  isCod?: boolean; lines?: number
}
interface Resp {
  /** ขอบเขตทั้งหมด (ใช้ทำป้ายบนแท็บ) · `shown` = จำนวนของแท็บที่เลือก (ใช้กับเลขหน้า) */
  total: number; shown?: number; shipped?: number; unshipped?: number; cod?: number
  /** ขนส่งที่รวมชื่อสะกดต่าง ๆ เข้าเป็นเจ้าเดียวแล้ว — `names` คือชื่อดิบที่ถูกรวมเข้ามา
   *  ⚠️ **ต้องกดดูชื่อดิบได้เสมอ** วันไหนต้องไล่ว่าใบไหนมาจากชื่อไหน ต้องยังไล่ได้
   *  ⚠️ `carrierUngrouped` = ตาข่ายกันเจ้าใหม่โผล่แล้วถูกกลืนหายเงียบ ๆ */
  carrierGroups?: { carrier: string; c: number; known?: boolean; names?: { name: string; c: number }[] }[]
  carrierUngrouped?: number
  carrierUngroupedNames?: number
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
    // 🔴 **แท็บ "ยังไม่มีเลขพัสดุ" คือของที่ต้องลงมือจริง** — ท่อส่ง unshipped มาตั้งแต่แรก
    //    แต่จอไม่เคยเอามาใช้ ⇒ ใบที่ยังไม่ได้ส่งจมอยู่ในกอง 558 ใบโดยไม่มีใครเห็น
    { id: 'unshipped', label: 'ยังไม่มีเลขพัสดุ', count: data?.unshipped },
    { id: 'shipped', label: 'ส่งแล้ว', count: data?.shipped },
    { id: 'cod', label: 'เก็บเงินปลายทาง', count: data?.cod },
  ]

  /** จำนวนจริงของแท็บที่เลือกอยู่ — **ห้ามใช้ `data.total` ตอนกรอง**
   *  กติกาที่ตกลงกับฝั่งท่อ (4 ก.ย. 2569):
   *  · `total` = ขอบเขตทั้งหมด ใช้ทำป้ายบนแท็บ
   *  · `shown` = จำนวนของแท็บที่เลือก ใช้กับเลขหน้าและปุ่มถัดไป
   *  ใช้ `total` ตรง ๆ จะได้ "แสดง 7 จาก 559" และปุ่มถัดไปกดได้ทั้งที่ไม่มีหน้าถัดไป
   *  ⚠️ ทางถอยยังต้องมี — จอใหม่อาจเจอท่อเก่าที่ยังไม่ส่ง `shown` ตอน deploy เหลื่อม */
  const tabTotal = Number(
    data?.shown
    ?? (only === 'unshipped' ? data?.unshipped
      : only === 'shipped' ? data?.shipped
        : only === 'cod' ? data?.cod
          : data?.total)
    ?? data?.total ?? 0
  )

  /** 🔴 **ด่านชั้นสอง: ตรวจ "เนื้อข้อมูล" ไม่ใช่แค่คำสะท้อนกลับ**
   *  ด่าน `applied`/`only` เช็คได้แค่ว่าเซิร์ฟเวอร์ **บอกว่า** อ่านตัวกรองแล้ว
   *  ไม่ได้เช็คว่า **ทำจริงไหม** — ของจริง 4 ก.ย. 2569: `only=cod` สะท้อน `cod` กลับมา
   *  แต่คืนแถวชุดเดียวกับตอนไม่กรองทุกประการ (มีใบที่ไม่ใช่ COD ปนมา)
   *  ⇒ แท็บ COD โชว์ของผิดโดยที่ทุกด่านผ่านหมด */
  const mismatch = (() => {
    if (!data || rows.length === 0) return ''
    if (only === 'cod' && rows.some((r) => !r.isCod)) return 'เก็บเงินปลายทาง'
    if (only === 'unshipped' && rows.some((r) => r.trackingNo)) return 'ยังไม่มีเลขพัสดุ'
    if (only === 'shipped' && rows.some((r) => !r.trackingNo)) return 'ส่งแล้ว'
    return ''
  })()

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
              style={{ background: '#4669e5' }}>
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

          {/* สรุปขนส่งรายเจ้า — ZORT มีคอลัมน์นี้เป็นโลโก้ ของเราเป็นชื่อที่ ZORT ส่งมา
              ซึ่งสะกดได้หลายแบบ ⇒ ฝั่งท่อรวมให้แล้ว (a03c019) จอโชว์ชื่อกลุ่มเป็นหลัก
              🔴 **แต่ต้องกดดูชื่อดิบได้เสมอ** — รวมกลุ่มคือการตีความ ไม่ใช่ความจริงดิบ
                 วันไหนต้องไล่ว่าใบไหนมาจากชื่อไหน ต้องยังไล่ได้ ไม่งั้นเราทับข้อมูลต้นทางทิ้ง */}
          {Array.isArray(data.carrierGroups) && data.carrierGroups.length > 0 && (
            <div className="text-[12.5px] text-gray-700 bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3">
              <span className="text-gray-500">ขนส่งที่ใช้:</span>{' '}
              {data.carrierGroups.map((g) => (
                <details key={g.carrier} className="inline-block align-top mr-3">
                  <summary className="cursor-pointer list-none inline">
                    <CarrierMark name={g.carrier} /> <b>{g.carrier}</b> {fmtNum(g.c)} ใบ
                    {Array.isArray(g.names) && g.names.length > 1 && (
                      <span className="text-gray-400"> (รวมจาก {g.names.length} ชื่อ ▾)</span>
                    )}
                  </summary>
                  <span className="block text-[11.5px] text-gray-500 mt-1 ml-3">
                    {(g.names ?? []).map((n) => (
                      <span key={n.name} className="block">· {n.name} — {fmtNum(n.c)} ใบ</span>
                    ))}
                  </span>
                </details>
              ))}
              {/* ⚠️ ตาข่ายกันเจ้าใหม่โผล่แล้วถูกกลืนหาย — 0 คือค่าที่ถูก ไม่ใช่ค่าที่ไม่มีความหมาย */}
              {Number(data.carrierUngrouped) > 0 && (
                <span className="block text-amber-800 mt-1">
                  ⚠️ มีอีก <b>{fmtNum(Number(data.carrierUngrouped))}</b> ใบจาก{' '}
                  <b>{fmtNum(Number(data.carrierUngroupedNames ?? 0))}</b> ชื่อที่<b>ยังไม่ได้จัดกลุ่ม</b>
                  {' '}— อาจเป็นขนส่งเจ้าใหม่ที่ยังไม่มีในรายชื่อ
                </span>
              )}
            </div>
          )}

          <Tabs tabs={tabs} active={only} onChange={(id) => { setOnly(id); load(0, id) }} />

          {/* ⚠️ เตือนตรง ๆ ว่าตารางข้างล่างไม่ตรงกับแท็บที่กด — **ห้ามเงียบ**
              ตารางที่กรองไม่จริงแต่ดูเหมือนกรองแล้ว คือของที่คนเอาไปตัดสินใจผิดได้ทันที */}
          {mismatch && (
            <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>ตารางข้างล่างยังไม่ได้ถูกกรองจริง</b> — กดแท็บ &quot;{mismatch}&quot; แล้ว
              แต่ยังมีแถวที่ไม่เข้าเงื่อนไขปนอยู่ · เซิร์ฟเวอร์ตอบกลับมาว่ารับตัวกรองแล้ว
              แต่ข้อมูลที่ส่งมาไม่ตรง ⇒ <b>อย่าเพิ่งใช้ตัวเลขจากแท็บนี้ตัดสินใจ</b> (แจ้งฝั่งท่อแล้ว)
            </div>
          )}

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
                  <tr key={r.id} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={TD}>
                      {/* ZORT โชว์เลขพัสดุสองบรรทัด (ลิงก์ + เลขเดิมซ้ำตัวเล็ก) และมีโลโก้ขนส่งข้างหน้า
                          ⇒ บรรทัดล่างของเราใส่ **ชื่อขนส่ง** แทนการซ้ำเลขเดิม
                             เพราะเรายังไม่มีโลโก้ ถ้าซ้ำเลขด้วยจะไม่เหลือที่บอกว่าส่งกับเจ้าไหนเลย */}
                      {/* กดแล้วไปใบขายของพัสดุนั้น — ปลายทางมีจริง */}
                      {/* ⚠️ เดิมเขียน `r.trackingNo || r.number` ⇒ ใบที่ยังไม่มีเลขพัสดุ
                          จะโชว์เลขที่ใบขาย**ซ้ำกับคอลัมน์ "หมายเลขออเดอร์" ในแถวเดียวกัน**
                          อ่านแล้วนึกว่าเลขนั้นคือเลขพัสดุ ⇒ ยังไม่มีก็ต้องบอกว่ายังไม่มี */}
                      <Link href={`/core/sales/detail?id=${encodeURIComponent(r.id)}`}
                        className={r.trackingNo ? 'text-blue-600 hover:underline font-medium' : 'text-gray-400 hover:underline'}>
                        {r.trackingNo || 'ยังไม่มีเลขพัสดุ'}
                      </Link>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                        <CarrierMark name={r.carrier} />
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
                          // ⚠️ ไม่มีเลขพัสดุแล้วยังให้กดคัดลอกได้ = คัดลอกค่าว่างแบบเงียบ ๆ
                          //    คนกดจะไปวางแล้วได้ช่องว่าง โดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น
                          {
                            label: 'คัดลอกเลขพัสดุ',
                            // `disabled` เป็น **ข้อความเหตุผล** ไม่ใช่ boolean — และต้องบอกว่าไปทำที่ไหนต่อ
                            disabled: r.trackingNo
                              ? undefined
                              : 'ใบนี้ยังไม่มีเลขพัสดุ — เลขจะขึ้นเองเมื่อขนส่งรับของแล้ว ดูสถานะได้ที่ใบขาย',
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
                แสดง {fmtNum(offset + rows.length)} จาก {fmtNum(tabTotal)} รายการ
                {only && <span className="text-gray-400"> (เฉพาะแท็บที่เลือก)</span>}
              </span>
              <span className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>ก่อนหน้า</BtnGhost>
                {/* ⚠️ เทียบกับจำนวนของแท็บ ไม่ใช่ยอดรวมทั้งหมด — ไม่งั้นปุ่มนี้กดได้ทั้งที่ไม่มีหน้าถัดไป
                    แล้วคนกดจะเจอหน้าว่าง ซึ่งอ่านเหมือน "ข้อมูลหาย" มากกว่า "หมดแล้ว" */}
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || offset + rows.length >= tabTotal}>ถัดไป</BtnGhost>
              </span>
            </div>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            {/* 🔴 ข้อความเดิมตรงนี้เขียนว่า "สะกดหลายแบบ จึงยังจับคู่โลโก้ไม่ได้"
                ซึ่งค้างข้ามวันที่ฝั่งท่อรวมชื่อให้แล้ว (4 ก.ย. 2569) — เขียนใหม่ตามสภาพจริง
                กฎ stale-state-comments แต่เป็นข้อความบนจอ ไม่ใช่คอมเมนต์ */}
            ZORT มีคอลัมน์ <b>บริการขนส่ง</b> เป็น<b>โลโก้</b>ขนส่ง — ของเราขึ้นเป็นชื่อ ·
            ชื่อดิบที่ ZORT ส่งมาสะกดได้หลายแบบ ตอนนี้<b>รวมกลุ่มให้แล้วด้วยการเทียบชื่อตรงตัว</b>
            (ไม่ใช่เดาจากคำที่มีอยู่ในชื่อ) กดที่ชื่อกลุ่มด้านบนเพื่อดูชื่อดิบทั้งหมดได้ ·
            <b> ยังไม่ใส่โลโก้เพราะยังไม่มีไฟล์โลโก้ของขนส่ง</b> — เป็นเรื่องของที่ยังไม่ได้ทำ
            ไม่ใช่ทำไม่ได้
          </p>
        </>
      )}
    </div>
  )
}
