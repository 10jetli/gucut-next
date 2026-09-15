'use client'
// รายการซื้อ — **ใบสั่งซื้อ (PO) จาก ZORT** อ่านจากกระจกในคลังเงา ไม่ได้ยิง ZORT สด
//
// **หน้าตาลอกจาก `zort-ui/27-zort-รายการซื้อ.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ, มูลค่าทั้งหมด X บาท | ตรวจสอบการรับสินค้าเข้า"
//      → ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง · สร้างอย่างง่าย
//      → แถวค้นหา → แท็บ ทั้งหมด · รอโอน · รอชำระ · สำเร็จ
//      → ตาราง # · วันที่ · รายการ · ผู้ติดต่อ · มูลค่า · สถานะ · ชำระเงิน · ⋮
//
// ⚠️ **จอนี้คนละอย่างกับ "สั่งของกับโรงงาน" ที่ร้านใช้อยู่** (ย้ายไป /core/factory-orders)
//    ของเดิมอ่าน /api/sheets = ระบบสั่งของกับโรงงาน (สินค้า · มัดจำ · กำหนดส่ง)
//    ส่วนจอนี้คือใบสั่งซื้อของ ZORT ⇒ **คนละข้อมูล คนละความหมาย**
//    เคยคิดจะดัดจอเดิมให้หัวคอลัมน์ตรงภาพแล้วจบ ซึ่งง่ายกว่าและดูเหมือนเสร็จทันที
//    แต่จะได้จอที่ **หน้าตาผ่านแต่ข้อมูลผิดความหมาย** — "เหมือน ZORT 100%"
//    หมายถึงเหมือนทั้งหน้าตาและความหมายของข้อมูล ไม่ใช่เหมือนแค่หน้าตา
import { useCallback, useEffect, useState } from 'react'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import { PURCHASE_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, PaymentPill, summaryLine,
} from '@/components/zort'
import ImportButton from '@/components/zort/ImportButton'
import ExportButton from '@/components/zort/ExportButton'

interface Row {
  number: string
  vendor: string
  po_date: string
  status: string
  amount: number
  payment_status?: string
  warehouse?: string
  /** โน้ตของใบซื้อ — ฝั่งท่อเพิ่ม 6 ก.ย. 2569 (มาจาก description ของ ZORT)
   *  ⚠️ ขึ้นเว็บพร้อมกันรอบ 21:00 — ก่อน deploy ฝั่งท่อ ช่องนี้จะ undefined ซึ่งจอกันไว้แล้ว */
  note?: string | null
}
interface Resp {
  /** ขอบเขตร้านของข้อมูลชุดนี้ — **ข้อความมาจากท่อ จอไม่แต่งเอง** (ใบ t_mu2kxy6u)
   *  ไม่มีช่อง = ไม่แสดง · ห้ามพิมพ์ z1 ตายตัว (วันที่ท่อดึง z2 เข้ามา ข้อความจะเป็นเท็จเงียบ ๆ) */
  storeScope?: string

  skip?: string
  total: number
  amount: number
  limit: number
  offset: number
  byStatus?: { status: string; c: number }[]
  rows: Row[]
}

const PAGE = 50

// ชื่อสถานะในคลังเงาเป็นภาษาอังกฤษดิบจาก ZORT — **แปลบนจอเท่านั้น**
// ค่าที่ส่งกลับ API ต้องเป็นค่าดิบ ไม่งั้นกรองไม่ตรง (กติกาเดียวกับจอรายการขาย)
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(PURCHASE_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}
const statusTone = (s: string) =>
  s === 'Success' ? 'green' : s === 'Voided' ? 'red' : s ? 'orange' : 'gray'

export default function CorePurchasesPage() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, tabId = tab) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'purchases', limit: String(PAGE), offset: String(off) })
      if (tabId !== 'all') qs.set('status', tabId)
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
  const byStatus = Array.isArray(data?.byStatus) ? data!.byStatus! : []
  const countOf = (s: string) => byStatus.find((x) => x.status === s)?.c ?? 0

  // ⚠️ **แท็บที่เป็น 0 ก็ต้องโชว์** — ZORT โชว์ "รอโอน (0) · รอชำระ (0)" ไว้เสมอ
  //    ถ้าโชว์เฉพาะแท็บที่มีของ วันที่มีใบรอชำระเข้ามาแท็บจะโผล่มาเองแบบไม่มีใครคาด
  //    และคนใช้จะไม่รู้ว่าเคยมีตัวกรองนี้อยู่ตลอด
  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: data?.total },
    { id: 'Waiting', label: 'รอโอน', count: countOf('Waiting') },
    { id: 'WaitingPayment', label: 'รอชำระ', count: countOf('WaitingPayment') },
    { id: 'Success', label: 'สำเร็จ', count: countOf('Success') },
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการซื้อ"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" — กล่องแดงข้างล่างบอกว่าพังแล้ว
             แต่หัวจอยังบอกว่ากำลังโหลด ⇒ คนรอต่อไปเรื่อย ๆ โดยไม่รู้ว่าจบแล้ว
             (เจอด้วยการเปิดจอตอนดึงข้อมูลไม่ได้ 6 ก.ย. 2569 — อ่านโค้ดแล้วไม่เห็น
              เพราะสองข้อความอยู่คนละที่ในไฟล์ และแต่ละอันถูกของมันเอง) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง') :
          data
            ? <>
              {/* ⚠️ ลอกคำต่อคำจากภาพ — ซูมอ่านทีละคำแล้ว ไม่ได้อ่านรวมแล้วพิมพ์ตาม
                  ZORT เขียน "ตรวจสอบการ**นับ**สินค้าเข้า" ไม่ใช่ "รับ"
                  นับ = ตรวจนับสต็อกจริง · รับ = รับของเข้าคลัง คนละงานกัน
                  ครั้งแรกอ่านเป็น "รับ" เพราะสมองเติมคำที่คุ้นให้เอง */}
              {summaryLine(data.total, data.amount)}
              {' | '}
              {/* ✅ แก้ 14 ก.ย. 2569 (t_mu0tx40g): เดิมชี้ /core/soon/stock-count — ตอนนี้ตรวจนับ/รับของทำได้ในหน้าใบสั่งซื้อรายใบ
                  (ต้องรู้ id ของใบใน ZORT ก่อน จึงไม่มีหน้ารวมแยก) ⇒ บอกทางตรง ๆ แทนการพาไปหน้า "ยังไม่ได้ทำ" */}
              <span className="text-gray-600">ตรวจสอบการนับสินค้าเข้า: <b>กดเลขที่ใบ</b> แล้วใช้ช่อง &ldquo;รับของ / ตรวจนับ&rdquo;</span>
            </>
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 ZORT มีปุ่มนี้ทุกหน้ารายการ — ส่งออก **ตามตัวกรองที่เลือกอยู่ ครบทุกหน้า** */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: `รายการซื้อ-${new Date().toISOString().slice(0, 10)}`,
                title: 'รายการซื้อ',
                filters: [
                  ['แท็บสถานะ', tab === 'all' ? 'ทั้งหมด' : tab],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'purchases', limit: String(limit), offset: String(offsetAt) })
                  if (tab !== 'all') qs.set('status', tab)
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['เลขที่ใบซื้อ', 'วันที่', 'ผู้ขาย', 'คลัง', 'ยอดซื้อ (บาท)', 'สถานะ', 'การชำระเงิน', 'หมายเหตุ'],
                /* 🔴 ช่องที่ท่อไม่ส่ง คืน null ให้เว้นว่าง **ห้ามแทนด้วย 0 หรือ "-"**
                   ในไฟล์ Excel ขีดกลางจะกลายเป็นข้อความ ทำให้คอลัมน์ตัวเลขคำนวณไม่ได้ทั้งคอลัมน์ */
                toRow: (r: Row) => [
                  r.number, r.po_date ?? null, r.vendor ?? null, r.warehouse ?? null,
                  typeof r.amount === 'number' ? r.amount : null,
                  r.status ?? null, r.payment_status ?? null, r.note ?? null,
                ],
              }}
            />
            {/* ปุ่มตามภาพ ZORT — พาไปหน้าที่บอกว่ายังไม่ได้ทำ ไม่ทำปุ่มหลอก */}
            <ImportButton kind="po" />
            {/* 🔴 เคยชี้ไป /core/soon/buy-create ทั้งที่หน้าจริงมีตั้งแต่ 6 ก.ย. 2569 (แก้ 14 ก.ย.)
                ⇒ คนกดปุ่ม "สร้าง" แล้วอ่านว่า "ยังไม่ได้ทำ" มา 8 วัน
                ⚠️ ปุ่มส่งจริงในหน้านั้นยังปิดอยู่โดยตั้งใจ (เจ้าของร้านอนุมัติการเขียนจริงเฉพาะใบเสนอราคา)
                   แต่ "ซ้อมได้เต็มที่" ต่างจาก "ยังไม่ได้ทำ" คนละเรื่องกันคนละขั้ว */}
            <Link href="/core/purchases/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้าง
            </Link>
            {/* ✅ แก้ 14 ก.ย. 2569 (t_mu0tx40g): เดิมชี้ /core/soon/buy-create-quick
                ZORT ไม่มีเส้นแยกสำหรับแบบง่าย ⇒ ใช้หน้าเดียวกับ "สร้าง" โหมด ?quick=1 (สถานะสำเร็จ + จ่ายเงินในใบเดียว) */}
            <Link href="/core/purchases/new?quick=1"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้างอย่างง่าย
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขที่ใบสั่งซื้อ หรือชื่อผู้ขาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการซื้อไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          {/* ผัง ZORT (ภาพ 27): ปุ่มรีเฟรชวงกลมมุมขวาแถบแท็บ — ชั้นแถบแท็บ จุดบอดประจำ (จอที่ 4 แล้ว) */}
          <div className="flex items-end justify-between gap-3">
            <Tabs
              tabs={tabs}
              active={tab}
              onChange={(id) => { setTab(id); load(0, id) }}
            />
            <button onClick={() => load(0, tab)} disabled={loading} aria-label="โหลดใหม่" title="โหลดใหม่"
              className="mb-2 shrink-0 w-7 h-7 grid place-items-center rounded border border-gray-300
                bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? '⏳' : '⟳'}
            </button>
          </div>

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StoreScopeLine scope={data?.storeScope} />

          <TableWrap>
            <table className="w-full min-w-[900px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ผู้ติดต่อ</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>ชำระเงิน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={8} icon="🔍" title="ไม่พบใบสั่งซื้อที่ค้นหา" detail="ลองพิมพ์เลขที่ใบหรือชื่อผู้ขายให้สั้นลง" />
                    : <EmptyState cols={8} icon="🧾" title="ยังไม่มีใบสั่งซื้อในแท็บนี้"
                        detail="ใบสั่งซื้อดึงมาจาก ZORT — เปิดใบใหม่ที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.number} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-500`}>{thaiDate(r.po_date)}</td>
                    {/* ⚠️ ไม่ทำสีฟ้า เพราะยังไม่มีหน้าปลายทางให้กด — สีฟ้าในตารางคือสัญญาว่ากดได้ */}
                    <td className={TD}>
                      {/* เลขที่ใบ → รายละเอียดรายใบ (แบบแผนข้อ 1 ของ ZORT: เลขเอกสารกดได้เสมอ)
                          เส้น ?purchase= เปิดให้แล้ว 8 ก.ย. 2569 */}
                      <Link href={`/core/purchases/detail?no=${encodeURIComponent(r.number)}`}
                        className="text-blue-600 hover:underline font-medium">{r.number}</Link>
                    </td>
                    <td className={TD}><span className="text-gray-800">{r.vendor || '—'}</span></td>
                    <td className={TDR}>{fmtMoney(r.amount)}</td>
                    <td className={TD}>
                      <Pill tone={statusTone(r.status)}>{statusTh(r.status)}</Pill>
                      {/* ZORT เขียนชื่อคลังตัวเล็กใต้ป้ายสถานะ */}
                      {r.warehouse && <span className="block text-[11px] text-gray-400 mt-0.5">{r.warehouse}</span>}
                      {/* ZORT มีลิงก์ "โน้ต" ใต้สถานะทุกแถว (ภาพ 27) — ของเราขึ้นเฉพาะใบที่มีโน้ตจริง
                          ⚠️ ใบที่ไม่มีโน้ตไม่ขึ้นคำว่าโน้ต — ลิงก์ที่กดแล้วว่างเปล่าคือลิงก์หลอก
                             (ZORT ขึ้นทุกแถวเพราะกดแล้วพิมพ์เพิ่มได้ แต่ของเราอ่านอย่างเดียว) */}
                      {typeof r.note === 'string' && r.note.trim() && (
                        <span className="block text-[11px] text-gray-500 mt-0.5 max-w-[260px] truncate"
                          title={r.note}>📝 {r.note}</span>
                      )}
                    </td>
                    <td className={TD}>
                      <PaymentPill value={r.payment_status} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกเลขที่ใบ', onClick: () => { navigator.clipboard?.writeText(r.number).catch(() => {}) } },
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
            ยอดรวมตรงกับ ZORT ทุกบาท (ตรวจแล้ว {fmtNum(data.total)} ใบ · {fmtMoney(data.amount)}) ·
            จอนี้เป็น<b>ใบสั่งซื้อของ ZORT</b> คนละอย่างกับ{' '}
            <Link href="/core/factory-orders" className="text-blue-600 hover:underline">สั่งของกับโรงงาน</Link>
            {' '}ที่ร้านใช้ติดตามมัดจำและกำหนดส่ง
          </p>
        </>
      )}
    </div>
  )
}
