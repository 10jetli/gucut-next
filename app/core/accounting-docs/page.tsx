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
//    ✅ **สาเหตุพิสูจน์แล้ว 15 ก.ย. 2569 (ฝั่งท่อไล่จากโค้ด + ข้อมูลจริงครบ 694 ใบ)**
//       เส้นสรุปกับเส้นรายแถว **นับคนละช่องกัน**:
//       · `?zortdocs=1` นับ `byType` จากช่อง **`referencetype`** = ชนิดของ *เอกสารที่ถูกอ้างถึง*
//         **ไม่ใช่ชนิดของตัวเอกสาร** ⇒ ได้ 1=690 · 2=4
//       · `?zortdocrows` ส่ง `type=` เป็น **`documenttype`** ให้ ZORT กรอง = ชนิดของตัวเอกสารจริง
//         ⇒ ตรงกับช่อง `header` เป๊ะ: type1 = 61 (ใบเสร็จรับเงิน 58 + ต้นฉบับ 3) · type2 = 2 · type3–5 = 0
//       · อีก 631 ใบ (ใบส่งสินค้า 629 · ใบสำคัญจ่าย 1 · ใบรับสินค้า 1) **ไม่มี `documenttype` ในช่วง 1–5**
//         ⇒ **กรองด้วย type ไม่ได้ ไม่ใช่ข้อมูลหาย**
//       🚫 **ห้ามใช้ `byType` ของเส้นสรุปในความหมาย "ชนิดเอกสาร"** — ถ้าจะโชว์สรุปตามชนิดให้ใช้ `byHeader`
//          (ครบ 694 ใบ) · ชื่อช่อง `byType` ชวนเข้าใจผิดโดยธรรมชาติ ⇒ ฝั่งท่อกำลังเพิ่มช่องบอกความหมาย
//
// ⚠️ **`linkurl` ไม่ทำปุ่มดาวน์โหลด** — พิสูจน์แล้ว 7 ก.ย. 2569 ว่าเปิดไม่ได้ทั้งด้วยรหัส API
//    และด้วยเบราว์เซอร์ที่ล็อกอิน ZORT (ได้ HTML 30KB ไม่ใช่ %PDF) ⇒ ปุ่มที่กดแล้วได้ไฟล์ใช้ไม่ได้
//    แย่กว่าไม่มีปุ่ม · เขียนบนจอว่าต้องโหลดจากหน้า ZORT เอง
// ⚠️ **ไม่โชว์ `detail`** ตามที่ฝั่งท่อกำชับ (เป็นก้อนข้อมูลอ้างอิงของเอกสาร ไม่ใช่ของที่จอนี้ต้องแสดง)
// ⚠️ **ท่อล่ม (502) = อ่านไม่ได้ ไม่ใช่ 0 ใบ** — สามสถานะเดิมของโปรเจกต์
import { useCallback, useEffect, useRef, useState } from 'react'
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
  /* ชื่อชนิดมาจากช่อง `header` ของ ZORT เอง ไม่ได้ตั้งเอง (ไล่ครบ 694 ใบแล้วนับ):
     type=1 → ใบเสร็จรับเงิน 58 + ใบเสร็จรับเงิน (ต้นฉบับ) 3 = 61
     type=2 → ใบกำกับภาษี (ต้นฉบับ) 1 + ใบส่งสินค้า/ใบกำกับภาษี (ต้นฉบับ) 1 = 2
     ⇒ ใส่ชื่อจริงดีกว่าเลขเปล่า เพราะคนที่ชิน ZORT จำจากชื่อเอกสาร ไม่ใช่จำเลขชนิด
     ⚠️ type 3–5 ยังไม่เคยเห็นเอกสารเลย ⇒ **ไม่ตั้งชื่อให้** (จะเป็นการเดา) คงเลขไว้ */
  { v: '1', label: 'ใบเสร็จรับเงิน', seen: 61 },
  { v: '2', label: 'ใบกำกับภาษี', seen: 2 },
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

  /* 🔴 **บั๊กที่เจอด้วยการกดจริง 16 ก.ย. 2569 (งานยืน t_mu2u9mym)**
     เดิม `load` ผูก deps ไว้กับ `type` และมี `useEffect(() => load(1, ''), [load])`
     ⇒ ทุกครั้งที่กดปุ่มชนิดเอกสาร `type` เปลี่ยน ⇒ `load` ถูกสร้างใหม่ ⇒ **effect รันซ้ำแล้วโหลด type=''**
     ผลบนจอ: กด "ใบหัก ณ ที่จ่าย (0)" แล้วเห็น 0 รายการจริงอยู่ ~4 วินาที
             แล้วจอ **เด้งกลับเป็น "ทั้งหมด 694"** เอง โดยไม่มีใครกดอะไร
     ⇒ คนใช้จะสรุปว่า "ปุ่มกรองชนิดกดแล้วไม่มีผล" ซึ่งเป็นคลาสปุ่มหลอกที่ห้ามมีในระบบนี้
     ⇒ แก้โดยให้ `load` **ไม่ผูกกับ type** (อ่านค่าปัจจุบันจาก ref) ⇒ effect จึงรันครั้งเดียวจริง
        และปุ่มรีเฟรช/เลขหน้า ยังคงชนิดที่เลือกอยู่ไว้ได้เหมือนเดิม */
  const typeRef = useRef(type)
  const load = useCallback(async (p = 1, t = typeRef.current) => {
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
      setData(j); setPage(p); typeRef.current = t
    } catch (e) {
      /* 🔴 อ่านไม่ได้ ≠ ไม่มีเอกสาร — ล้างข้อมูลแล้วให้กล่องแดงพูด ห้ามโชว์ 0 ใบ */
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(1, '') }, [load])

  const rows = data?.rows ?? []
  const count = data?.count
  const totalPages = data?.totalPages ?? 1

  return (
    <div>
      <PageHead
        title="จัดการเอกสาร"
        summary={
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
        ⚠️ <b>ตัวกรองชนิดของ ZORT ครอบไม่ครบทั้งกอง — และรู้สาเหตุแล้ว</b>
        ตัวกรองนี้ส่งค่า <b>ชนิดของตัวเอกสาร</b> ให้ ZORT · แต่เอกสาร <b>631 ใบจาก 694</b> ไม่มีชนิดอยู่ในช่วง 1–5
        (ใบส่งสินค้า 629 · ใบสำคัญจ่าย 1 · ใบรับสินค้า 1) ⇒ <b>กรองด้วยชนิดไม่ได้ ไม่ใช่ข้อมูลหาย</b>
        ที่กรองได้มี <b>63 ใบ</b>: ใบเสร็จรับเงิน 61 (รวมต้นฉบับ 3) · ใบกำกับภาษี 2
        ⇒ <b>กดชนิดแล้วไม่เจอเอกสารที่หา ไม่ได้แปลว่าไม่มี — กด &quot;ทั้งหมด&quot; แล้วหาจากเลขที่เอกสาร</b>
        <span className="block mt-1 text-amber-800">
          และ <b>ไฟล์เอกสารตัวจริงยังโหลดจากที่นี่ไม่ได้</b> — ลิงก์ที่ ZORT ให้มาเปิดไม่ออกทั้งด้วยรหัสและด้วยเบราว์เซอร์ที่ล็อกอิน
          (ทดสอบแล้ว 7 ก.ย. 2569) ⇒ ต้องโหลดจากหน้า ZORT เอง · จอนี้ใช้เทียบว่าเก็บครบ 694 ใบหรือยัง
        </span>
      </div>

      {/* 🔴 **จอชื่อเดียวกันของ ZORT ว่างเปล่า — ต้องเขียนไว้ ไม่งั้นคนเทียบสองจอแล้วสรุปว่าจอใดจอหนึ่งพัง**
          กดอ่านเอง 16 ก.ย. 2569: `/ZDocument/list` (ชื่อจอ "จัดการเอกสาร") ขึ้น **จำนวน 0 รายการ**
          และกดครบทั้ง 6 แท็บ (ทั้งหมด · ใบเสนอราคา · ใบแจ้งหนี้ · ใบกำกับภาษี · ใบเสร็จรับเงิน · ใบหัก ณ ที่จ่าย)
          ได้ **0 ทุกแท็บ** ส่วนของเราได้ 694 ใบจากเส้น API
          ⚠️ **ยังไม่รู้ว่าจอของ ZORT คัดด้วยเงื่อนไขอะไร** (อาจนับเฉพาะเอกสารที่ออกในโมดูลนั้นเอง)
             ⇒ เขียนว่า "ยังไม่รู้" ห้ามเดาแทนเขา และห้ามสรุปว่าเลขฝั่งใดผิด */}
      <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        📊 <b>จอ &ldquo;จัดการเอกสาร&rdquo; ของ ZORT เองแสดง 0 รายการ</b> (อ่านสด 16 ก.ย. 2569 · กดครบทั้ง 6 แท็บได้ 0 ทุกแท็บ)
        {' '}ส่วนจอนี้แสดง <b>694 ใบ</b> จากเส้น API ที่คืน<b>ประวัติเอกสารที่ถูกออกให้ใบขาย</b> (ส่วนใหญ่เป็นใบส่งสินค้า)
        {' '}⇒ <b>คนละประชากร เทียบจำนวนกันตรง ๆ ไม่ได้</b> ·
        {' '}<b>ยังไม่รู้ว่าจอของ ZORT คัดใบด้วยเงื่อนไขอะไร</b> (ยังไม่พิสูจน์ ⇒ ไม่เดาแทนเขา)
        <div className="mt-1.5">
          🆕 <b>เจอจอที่สามของ ZORT ที่พูดเรื่องเอกสารบัญชี</b> (กวาดลิงก์ในเมนู ZORT เอง 16 ก.ย. 2569):
          {' '}<b>Accounting Log</b> (<code>/Log/accountinglog</code>) — <b>1,195 รายการ</b> ·
          {' '}คอลัมน์: รายการ · เอกสารของรายการ · วัน-เวลาส่งข้อมูล · การเชื่อมต่อ · ประเภท · การส่งรายการ ·
          {' '}อ่านตัวอย่าง 320 แถวแรก: <b>การเชื่อมต่อ = PEAK ทั้งหมด</b> ·
          {' '}ประเภทที่เจอคือ Create/Receive <b>Receipt</b> และ Create/Receive <b>Invoice</b>
          <br />
          ⇒ ตอนนี้มี <b>สามตัวเลข สามประชากร</b>: จอ ZORT &ldquo;จัดการเอกสาร&rdquo; 0 · จอนี้ 694 · Accounting Log 1,195
          {' '}<b>ยังไม่รู้ว่าอันไหนเป็นต้นทางของอันไหน</b> — ห้ามวางคู่กันแล้วให้คนอ่านสรุปเอง ⇒ เขียนไว้ทั้งสามพร้อมนิยาม
          {' '}(ขั้นต่อไป: ถามฝั่งท่อว่า 694 ใบมาจากเส้นไหนของ ZORT แล้วเทียบกับ log ของ PEAK เป็นรายชนิด/รายวัน)
        </div>
      </div>

      {/* ตัวกรองชนิด — ตัวเลขข้างปุ่มคือ "เคยวัดได้" ไม่ใช่ค่าสด จึงเขียนกำกับ */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {TYPES.map((t) => (
          <button key={t.v || 'all'} onClick={() => { setType(t.v); typeRef.current = t.v; void load(1, t.v) }}
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
                      ? 'ชนิดของ ZORT ครอบแค่ 63 ใบจาก 694 — เอกสาร 631 ใบ (ใบส่งสินค้า·ใบสำคัญจ่าย·ใบรับสินค้า) ไม่มีชนิดในช่วง 1–5 จึงกรองไม่ได้ ลองกด "ทั้งหมด"'
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
