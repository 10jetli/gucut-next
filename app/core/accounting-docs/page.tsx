'use client'
// เอกสาร → เอกสารบัญชี — ตารางรายใบจริง (ใบ t_mu2lv92k · 15 ก.ย. 2569)
//
// 🔴 **ก่อนหน้านี้จอนี้เป็นผังเปล่า** (ใช้ LedgerScreen · ไม่มีข้อมูล) เพราะท่อมีแต่ **เส้นสรุป**
//    `zortdocs=1` ที่คืน byHeader/byType ไม่มี `rows` ⇒ ทำตารางรายใบไม่ได้
//    ตอนนี้ท่อเปิดเส้นรายแถว `zortdocrows` แล้ว (codex) ⇒ ต่อข้อมูลจริงได้
//
// ════════ กับดักที่พิสูจน์แล้วก่อนเขียนจอนี้ (อย่าเหยียบซ้ำ) ════════
// 🔴 **`offset` ถูกเมินเงียบ ๆ — เส้นนี้แบ่งหน้าด้วย `page=` เท่านั้น**
//    ยิงจริง 15 ก.ย. 2569: `offset=0` · `offset=200` · `offset=400` คืน **200 แถวเดิมเป๊ะทุก id**
//    และ `applied` บอกตรง ๆ ว่า `{"page":1}` ทุกครั้ง · `skip=` กับ `start=` ก็ไม่มีผล
//    ⚠️ ถ้าเขียน export แบบไล่ `offset` จะได้ไฟล์ **694 แถวที่เป็นของซ้ำ** และ "จำนวนตรง count" พอดี
//       ⇒ ผ่านด่านนับแถวแบบสบาย ๆ โดยที่ข้อมูลผิดทั้งไฟล์ ⇒ **ต้องกันด้วยการนับ id ไม่ซ้ำ**
//    (ตระกูลเดียวกับที่ CLAUDE.md เตือนไว้แล้วเรื่อง `GetOrders` ใช้ `page=` ห้าม `offset=`)
//    ✅ ไล่ด้วย `page=1..4` ได้ **694 แถว · id ไม่ซ้ำ 694 · ตรง `count`** และนับชนิดตรงกับเส้นสรุปทุกช่อง
//
// 🔴 **ตัวกรองชนิดของท่อ (`type=1..5`) ครอบแค่ 63 ใบจาก 694**
//    วัดเอง: type=1 → 61 · type=2 → 2 · type=3,4,5 → 0 ⇒ รวม 63 · อีก **631 ใบไม่ตรงชนิดไหนเลย**
//    (เกือบทั้งหมดคือ "ใบส่งสินค้า" 629 ใบ + ใบสำคัญจ่าย 1 + ใบรับสินค้า 1)
//    ⚠️ และ **เส้นสรุปกับเส้นรายแถวพูดเรื่อง `type` ไม่ตรงกัน** — เส้นสรุป `byType` ว่า 1 มี 690 ใบ
//       แต่กรอง `type=1` ที่เส้นรายแถวได้ 61 ใบ ⇒ **ยังไม่รู้ว่าสองเส้นนับคนละอย่างตรงไหน**
//       ⇒ จอนี้จึง **เขียนบอกขอบเขตของตัวกรองไว้ตรง ๆ** ไม่ปล่อยให้คนเข้าใจว่ากรองได้ทั้ง 694 ใบ
//       (แจ้งฝั่งท่อแล้ว — ยังไม่ได้ข้อสรุป ห้ามเขียนสาเหตุที่ยังไม่พิสูจน์)
//
// ⚠️ **`linkurl` ไม่ทำปุ่มดาวน์โหลด** — พิสูจน์แล้ว 7 ก.ย. 2569 ว่าเปิดไม่ได้ทั้งด้วยรหัส API
//    และด้วยเบราว์เซอร์ที่ล็อกอิน ZORT (ได้ HTML 30KB ไม่ใช่ %PDF) ⇒ ปุ่มที่กดแล้วได้ไฟล์ใช้ไม่ได้
//    แย่กว่าไม่มีปุ่ม · เขียนบนจอว่าต้องโหลดจากหน้า ZORT เอง
// ⚠️ **ไม่โชว์ `detail`** ตามที่ฝั่งท่อกำชับ (เป็นก้อนข้อมูลอ้างอิงของเอกสาร ไม่ใช่ของที่จอนี้ต้องแสดง)
// ⚠️ **ท่อล่ม (502) = อ่านไม่ได้ ไม่ใช่ 0 ใบ** — สามสถานะเดิมของโปรเจกต์
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, TD, EmptyState, RowMenu } from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'

interface DocRow {
  id?: number | string
  documentnumber?: string
  documentdateString?: string
  createdatetimeString?: string
  header?: string
  referencenumber?: string
  referencetype?: string | number
  /** 🚫 ท่อส่งมาได้แต่ **จอไม่แสดง** (ฝั่งท่อกำชับ) — ประกาศไว้เพื่อให้เห็นว่ารู้ว่ามี ไม่ใช่ลืม */
  detail?: unknown
  /** 🚫 เปิดไม่ได้จริง ⇒ ไม่ทำปุ่ม (ดูหัวไฟล์) */
  linkurl?: string
}
interface Resp {
  skip?: string
  count?: number
  totalPages?: number
  hasMore?: boolean
  rows?: DocRow[]
  applied?: { page?: number; limit?: number; type?: number | null; typeLabel?: string }
  limitClamped?: boolean
}

const PAGE = 50
/** ชนิดที่ท่อรับ (1–5) + จำนวนที่ **วัดจากของจริง** 15 ก.ย. 2569 — ไม่ได้เดา
 *  ⚠️ ค่าเหล่านี้เป็น "ภาพ ณ วันวัด" ไม่ใช่ค่าสด ⇒ จอโชว์เป็นคำใบ้ ไม่ใช่ตัวเลขทางการ */
const TYPES: Array<{ v: string; label: string; seen: number | null }> = [
  { v: '', label: 'ทั้งหมด', seen: 694 },
  { v: '1', label: 'ชนิด 1', seen: 61 },
  { v: '2', label: 'ชนิด 2', seen: 2 },
  { v: '3', label: 'ชนิด 3', seen: 0 },
  { v: '4', label: 'ชนิด 4', seen: 0 },
  { v: '5', label: 'ชนิด 5', seen: 0 },
]

export default function AccountingDocsPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (p = 1, t = type) => {
    setLoading(true); setError('')
    try {
      /* 🔴 ใช้ `page=` เท่านั้น — `offset` ถูกเมินเงียบ (ดูหัวไฟล์) */
      const qs = new URLSearchParams({ zortdocrows: '1', limit: String(PAGE), page: String(p) })
      if (t) qs.set('type', t)
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      /* ⚠️ `skip` มาก่อน error เสมอ (สัญญาของท่อ) — "ทำต่อไม่ได้" ไม่ใช่ error */
      if (typeof j?.skip === 'string' && j.skip) throw new Error(j.skip)
      if (!res.ok || j?.error) throw new Error(j?.error ?? `ท่อตอบ ${res.status}`)
      if (!Array.isArray(j?.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      setData(j); setPage(p)
    } catch (e) {
      /* 🔴 อ่านไม่ได้ ≠ ไม่มีเอกสาร — ล้างข้อมูลแล้วให้กล่องแดงพูด ห้ามโชว์ 0 ใบ */
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [type])

  useEffect(() => { load(1, '') }, [load])

  const rows = data?.rows ?? []
  const count = data?.count
  const totalPages = data?.totalPages ?? 1

  return (
    <div>
      <PageHead
        title="จัดการเอกสาร"
        subtitle={
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'อ่านเอกสารไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            : data
              ? <>
                  {typeof count === 'number' ? <>มี {fmtNum(count)} รายการ</> : 'ยังไม่รู้จำนวน (ท่อไม่ได้บอก)'}
                  {data.applied?.typeLabel && <span className="text-gray-400"> · ชนิด: {data.applied.typeLabel}</span>}
                  <span className="text-gray-400"> · หน้า {data.applied?.page ?? page}/{totalPages}</span>
                </>
              : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(page)} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* 📤 Export — ไล่ **ทุกหน้าด้วย `page=`** แล้วกันของซ้ำด้วย id
                🔴 ถ้าไล่ด้วย offset จะได้ของซ้ำเต็มไฟล์แต่จำนวนตรง count พอดี ⇒ ต้องนับ id ไม่ซ้ำ */}
            <ExportButton
              disabled={loading || !data}
              spec={{
                filename: `เอกสารบัญชี${type ? `-ชนิด${type}` : ''}`,
                title: 'เอกสารบัญชีจาก ZORT (จัดการเอกสาร)',
                filters: [
                  ['ชนิดเอกสาร', data?.applied?.typeLabel || (type ? `ชนิด ${type}` : 'ทั้งหมด')],
                  ['จำนวนที่ท่อบอกว่ามีทั้งชุด', typeof count === 'number' ? String(count) : 'ท่อไม่ได้บอก'],
                ],
                note: 'ไฟล์นี้ไม่มีลิงก์ไฟล์เอกสาร เพราะ linkurl ของ ZORT เปิดไม่ได้ทั้งด้วยรหัส API และด้วยเบราว์เซอร์ที่ล็อกอิน (ทดสอบ 7 ก.ย. 2569 ได้ HTML ไม่ใช่ PDF) ⇒ ตัวไฟล์ยังต้องโหลดจากหน้า ZORT เอง · ตัวกรองชนิด 1–5 ของท่อครอบเพียง 63 ใบจาก 694 (วัด 15 ก.ย. 2569) ⇒ ไฟล์ที่กรองชนิดจะไม่ใช่ทั้งกอง',
                header: ['ประเภทเอกสาร', 'เลขที่เอกสาร', 'วันที่เอกสาร', 'สร้างเมื่อ', 'เลขที่อ้างอิง', 'ชนิดอ้างอิง'],
                toRow: (r: DocRow) => [
                  r.header ?? null, r.documentnumber ?? null, r.documentdateString ?? null,
                  r.createdatetimeString ?? null, r.referencenumber ?? null,
                  r.referencetype === undefined || r.referencetype === null ? null : String(r.referencetype),
                ],
                limit: 200,
                fetchPage: async (offset, limit) => {
                  /* แปลง offset ของตัวส่งออกกลาง → `page` ของท่อ (ท่อไม่รับ offset) */
                  const p = Math.floor(offset / limit) + 1
                  const qs = new URLSearchParams({ zortdocrows: '1', limit: String(limit), page: String(p) })
                  if (type) qs.set('type', type)
                  const res = await fetch(`/api/web/core?${qs}`)
                  const j = await res.json()
                  if (!res.ok || j?.error) throw new Error(j?.error ?? `ท่อตอบ ${res.status}`)
                  return { rows: Array.isArray(j?.rows) ? j.rows : [], total: typeof j?.count === 'number' ? j.count : null }
                },
              }}
            />
          </>
        }
      />

      {/* 🔴 ขอบเขตของตัวกรอง — เขียนบนจอ ไม่ซ่อนในคอมเมนต์
          ตัวกรองที่ครอบแค่ 9% ของกอง ถ้าไม่บอก คนจะเชื่อว่ากรองได้ทั้งหมด */}
      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        ⚠️ <b>ตัวกรองชนิดของ ZORT ครอบไม่ครบทั้งกอง</b> — วัดเอง 15 ก.ย. 2569: ชนิด 1 มี 61 ใบ · ชนิด 2 มี 2 ใบ ·
        ชนิด 3–5 ไม่มีเลย ⇒ รวม <b>63 ใบจาก 694 ใบ</b> · อีก <b>631 ใบไม่ตรงชนิดไหนเลย</b>
        (เกือบทั้งหมดคือ &quot;ใบส่งสินค้า&quot;) ⇒ <b>กดชนิดแล้วไม่เจอเอกสารที่หา ไม่ได้แปลว่าไม่มี</b>
        <span className="block mt-1 text-amber-800">
          และ <b>ไฟล์เอกสารตัวจริงยังโหลดจากที่นี่ไม่ได้</b> — ลิงก์ที่ ZORT ให้มาเปิดไม่ออกทั้งด้วยรหัสและด้วยเบราว์เซอร์ที่ล็อกอิน
          (ทดสอบแล้ว 7 ก.ย. 2569) ⇒ ต้องโหลดจากหน้า ZORT เอง · จอนี้ใช้เทียบว่าเก็บครบ 694 ใบหรือยัง
        </span>
      </div>

      {/* ตัวกรองชนิด — ตัวเลขข้างปุ่มคือ "เคยวัดได้" ไม่ใช่ค่าสด จึงเขียนกำกับ */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {TYPES.map((t) => (
          <button key={t.v || 'all'} onClick={() => { setType(t.v); load(1, t.v) }}
            className={`text-[12.5px] rounded-full px-3 py-1 border ${
              type === t.v ? 'bg-white border-gray-400 text-gray-800 font-semibold' : 'border-transparent text-gray-500'
            }`}>
            {t.label}
            {t.seen !== null && <span className="ml-1 text-[11px] text-gray-400">({fmtNum(t.seen)})</span>}
          </button>
        ))}
        <span className="text-[11.5px] text-gray-400 ml-1">ตัวเลขในวงเล็บวัดไว้ 15 ก.ย. 2569 — ไม่ใช่ค่าสด</span>
      </div>

      {error && <ErrorBox title={isSkip(error) ? 'ยังอ่านเอกสารไม่ได้' : 'อ่านเอกสารไม่สำเร็จ'}>{error}
        <span className="block mt-1 text-[12px]">⚠️ อ่านไม่ได้ <b>ไม่ได้แปลว่าไม่มีเอกสาร</b> — ลองรีเฟรชอีกครั้ง</span>
      </ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>ประเภท</th>
                  <th className={TH}>เลขที่เอกสาร</th>
                  <th className={TH}>วันที่เอกสาร</th>
                  <th className={TH}>สร้างเมื่อ</th>
                  <th className={TH}>เลขที่อ้างอิง</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={7} icon="📄"
                    title={type ? `ไม่พบเอกสารชนิด ${type}` : 'ไม่พบเอกสาร'}
                    detail={type
                      ? 'ชนิด 1–5 ของ ZORT ครอบแค่ 63 ใบจาก 694 — เอกสารที่หาอาจอยู่ใน 631 ใบที่ไม่ตรงชนิดไหนเลย ลองกด "ทั้งหมด"'
                      : 'ท่ออ่านได้แต่ไม่มีแถวในหน้านี้'} />
                )}
                {rows.map((r, i) => (
                  <tr key={String(r.id ?? i)} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{(page - 1) * PAGE + i + 1}</td>
                    <td className={TD}>{r.header || <span className="text-gray-300">—</span>}</td>
                    <td className={`${TD} font-medium text-gray-800 whitespace-nowrap`}>
                      {r.documentnumber || <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.documentdateString || <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-500`}>
                      {r.createdatetimeString || <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TD}>
                      {r.referencenumber || <span className="text-gray-300">—</span>}
                      {r.referencetype !== undefined && r.referencetype !== null && (
                        <span className="ml-1 text-[11px] text-gray-400">(ชนิด {String(r.referencetype)})</span>
                      )}
                    </td>
                    <td className={TD}>
                      <RowMenu items={[
                        /* 🚫 ไม่ทำปุ่มดาวน์โหลด — ลิงก์ของ ZORT เปิดไม่ได้จริง (พิสูจน์แล้ว)
                           แต่โชว์รายการไว้พร้อมเหตุผล ดีกว่าตัดทิ้งให้คนที่ชิน ZORT หาไม่เจอ */
                        { label: 'ดาวน์โหลดไฟล์เอกสาร',
                          disabled: 'ลิงก์ที่ ZORT ให้มาเปิดไม่ได้ทั้งด้วยรหัส API และด้วยเบราว์เซอร์ที่ล็อกอิน (ได้ HTML ไม่ใช่ PDF) ⇒ ต้องโหลดจากหน้า ZORT เอง' },
                        { label: 'คัดลอกเลขที่เอกสาร',
                          onClick: () => { navigator.clipboard?.writeText(String(r.documentnumber ?? '')).catch(() => {}) } },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {/* แบ่งหน้า — ใช้ `page` ของท่อตรง ๆ และโชว์ว่ากำลังอยู่หน้าไหนจาก applied ไม่ใช่จากตัวแปรจอ
              (ถ้าท่อตีความหน้าไม่เหมือนที่จอส่งไป จะเห็นได้ทันที) */}
          <div className="flex items-center gap-2 mt-3 text-[12.5px] text-gray-600">
            <BtnGhost onClick={() => load(Math.max(1, page - 1))} disabled={loading || page <= 1}>‹ ก่อนหน้า</BtnGhost>
            <span>
              หน้า <b>{data.applied?.page ?? page}</b> จาก {totalPages}
              {typeof count === 'number' && <> · ทั้งชุด {fmtNum(count)} ใบ</>}
            </span>
            <BtnGhost onClick={() => load(page + 1)} disabled={loading || !data.hasMore}>ถัดไป ›</BtnGhost>
            {data.limitClamped && (
              <span className="text-amber-700">⚠️ ท่อลดจำนวนต่อหน้าให้เองเพราะชนเพดาน</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
