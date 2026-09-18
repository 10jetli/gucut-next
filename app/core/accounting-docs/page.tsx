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
//
// 🔬 **16 ก.ย. 2569 — รู้สาเหตุแล้ว (เดิมจดไว้ว่า "ยังไม่รู้")**
//    เปิดลิงก์เดียวกันจากเบราว์เซอร์ที่ล็อกอิน ZORT อยู่จริง ⇒ หน้าเรนเดอร์ข้อความของ ZORT เองว่า
//    **"ZORT มีปัญหาบางประการ, กรุณาคลิกที่นี่ เพื่อลองใหม่อีกครั้ง"** (หน้าเปล่าแบบเตรียมพิมพ์ ไม่มีเนื้อเอกสาร)
//    ⚖️ ทดสอบคุมสามแบบ: โทเคน `cs` ถูก · `cs` ผิด · **ไม่มี `cs` เลย**
//       ⇒ ได้ HTTP 200 + HTML **ยาว 30,298 ไบต์เท่ากันทั้งสามครั้ง** และมีข้อความผิดพลาดเดียวกัน
//       ⇒ **ไม่ใช่ลิงก์หมดอายุ ไม่ใช่สิทธิ์ ไม่ใช่คุกกี้** — เส้นนี้พังฝั่ง ZORT
//    ⇒ ทางแก้ไม่ได้อยู่ที่เรา: ต้องให้ ZORT แก้ หรือหาไฟล์จากทางอื่น (เช่นอีเมลที่ ZORT ส่งออกตอนออกเอกสาร)
// ⚠️ **ไม่โชว์ `detail`** ตามที่ฝั่งท่อกำชับ (เป็นก้อนข้อมูลอ้างอิงของเอกสาร ไม่ใช่ของที่จอนี้ต้องแสดง)
// ⚠️ **ท่อล่ม (502) = อ่านไม่ได้ ไม่ใช่ 0 ใบ** — สามสถานะเดิมของโปรเจกต์
import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, TD, EmptyState, RowMenu, PageNav} from '@/components/zort'
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
  /* 🔎 **ค้นหา + ช่วงวันที่ — ZORT มี เราไม่มี** (เทียบทีละชิ้น 18 ก.ย. 2569)
     จอเขา `/ZDocument/list` มี: ค้นหา · ประเภท · รายการ · ตั้งแต่วันที่ · ถึงวันที่ · จำนวนต่อหน้า
     ของเรามีแค่ปุ่มชนิดเอกสารกับเลขหน้า
     🔴 **ท่อกรองให้ไม่ได้** — `?zortdocrows` รับแค่ `page` · `limit` · `type`
        ⇒ ถ้ากรองเฉพาะหน้าที่เปิดอยู่ จะกลายเป็น "กรองแค่ 50 ใบจาก 694" ซึ่ง CLAUDE.md ห้ามไว้ตรง ๆ
        ⇒ ทางที่ซื่อสัตย์คือ **โหลดครบทุกหน้าก่อนกรอง** (694 ใบ = 4 คำขอ) แล้วเขียนบนจอว่ากรองจากทั้งหมด
     ⚠️ ระหว่างยังโหลดไม่ครบ **ห้ามโชว์ผลกรอง** เพราะจะอ่านได้ว่า "มีเท่านี้" ทั้งที่ยังอ่านไม่จบ */
  const [ค้น, setค้น] = useState('')
  const [ตั้งแต่, setตั้งแต่] = useState('')
  const [ถึง, setถึง] = useState('')
  const [ทั้งหมด, setทั้งหมด] = useState<DocRow[] | null>(null)
  const [กำลังโหลดครบ, setกำลังโหลดครบ] = useState(false)
  const [โหลดครบถึงหน้า, setโหลดครบถึงหน้า] = useState(0)
  const [ครบผิดพลาด, setครบผิดพลาด] = useState('')
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
      /* 🔴 **ต้องใส่ SKIP นำหน้า** ไม่งั้น isSkip() มองไม่เห็น ⇒ จอขึ้นกล่อง**แดง** + หัวจอว่า "ไม่สำเร็จ"
         ทั้งที่เป็นสถานะที่สาม (เจอด้วยท่อปลอมโหมด skip 16 ก.ย. 2569: จอนี้ขึ้นทั้งแดงและเหลืองพร้อมกัน)
         ⇒ สอนให้คนเลิกสนใจสีแดง ซึ่งเป็นสิ่งที่กฎในไฟล์ ErrorBox เตือนไว้ตรง ๆ */
      if (typeof j?.skip === 'string' && j.skip) throw new Error(SKIP + j.skip)
      if (!res.ok || j?.error) throw new Error(j?.error ?? `ท่อตอบ ${res.status}`)
      if (!Array.isArray(j?.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      setData(j); setPage(p); typeRef.current = t
    } catch (e) {
      /* 🔴 อ่านไม่ได้ ≠ ไม่มีเอกสาร — ล้างข้อมูลแล้วให้กล่องแดงพูด ห้ามโชว์ 0 ใบ */
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [])

  /* โหลดครบทุกหน้า — ใช้ตอนคนเริ่มกรอง · ไล่ด้วย `page=` เท่านั้น (offset ถูกเมินเงียบ ดูหัวไฟล์)
     ⚠️ เดินหน้าด้วย **จำนวนหน้าที่ท่อบอก** และหยุดเมื่อหน้าไหนไม่มีแถว
        (บทเรียน 18 ก.ย. 2569: ห้ามเดินหน้าด้วยเลขที่เราขอเอง) */
  const โหลดครบ = useCallback(async () => {
    if (ทั้งหมด || กำลังโหลดครบ) return
    setกำลังโหลดครบ(true); setครบผิดพลาด(''); setโหลดครบถึงหน้า(0)
    const กอง: DocRow[] = []
    try {
      for (let p = 1; p <= 40; p++) {
        const qs = new URLSearchParams({ zortdocrows: '1', limit: String(PAGE), page: String(p) })
        // eslint-disable-next-line no-await-in-loop -- ตั้งใจไล่ทีละหน้า ไม่ยิงพร้อมกัน
        const res = await fetch(`/api/web/core?${qs}`)
        // eslint-disable-next-line no-await-in-loop
        const j = await res.json().catch(() => null)
        if (!j || (!res.ok && !j.skip)) throw new Error(j?.error ?? `ท่อตอบ ${res.status}`)
        if (typeof j?.skip === 'string' && j.skip) throw new Error(j.skip)
        const หน้า: DocRow[] = Array.isArray(j.rows) ? j.rows : []
        กอง.push(...หน้า)
        setโหลดครบถึงหน้า(p)
        if (!หน้า.length) break
        if (typeof j.totalPages === 'number' && p >= j.totalPages) break
      }
      setทั้งหมด(กอง)
    } catch (e) {
      /* ⚠️ โหลดไม่ครบ = **ยังกรองไม่ได้** ห้ามเอาที่โหลดมาได้ไปกรองแล้วโชว์เป็นคำตอบ */
      setครบผิดพลาด(String(e instanceof Error ? e.message : e))
      setทั้งหมด(null)
    } finally { setกำลังโหลดครบ(false) }
  }, [ทั้งหมด, กำลังโหลดครบ])

  const มีตัวกรอง = Boolean(ค้น.trim() || ตั้งแต่ || ถึง)
  useEffect(() => { if (มีตัวกรอง) void โหลดครบ() }, [มีตัวกรอง, โหลดครบ])

  useEffect(() => { void load(1, '') }, [load])

  /* แถวที่เอาไปแสดง: ถ้าไม่ได้กรอง = หน้าปัจจุบันจากท่อ · ถ้ากรอง = ทั้ง 694 ใบที่โหลดครบแล้ว */
  const วัน = (r: DocRow) => String(r.documentdateString ?? '').slice(0, 10)
  const เข้าเงื่อนไข = (r: DocRow) => {
    const คำ = ค้น.trim().toLowerCase()
    if (คำ) {
      const กอง = [r.documentnumber, r.header, r.referencenumber, r.documentdateString]
        .map((x) => String(x ?? '').toLowerCase())
      if (!กอง.some((x) => x.includes(คำ))) return false
    }
    const d = วัน(r)
    if (ตั้งแต่ && (!d || d < ตั้งแต่)) return false
    if (ถึง && (!d || d > ถึง)) return false
    return true
  }
  const rows = มีตัวกรอง
    ? (ทั้งหมด ?? []).filter(เข้าเงื่อนไข)
    : (data?.rows ?? [])
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
          และ <b>ไฟล์เอกสารตัวจริงยังโหลดไม่ได้ — และตอนนี้รู้แล้วว่าเป็นที่ฝั่ง ZORT เอง</b>
          <span className="block mt-0.5">
            🔬 ยิงลิงก์ <code>Accounting/DownloadPDFFile</code> จาก<b>เบราว์เซอร์ที่ล็อกอิน ZORT อยู่</b> (16 ก.ย. 2569):
            ได้ HTTP 200 เป็น <b>หน้า HTML ขนาด 30,298 ไบต์เท่ากันทุกครั้ง</b> ซึ่งเปิดแล้วขึ้นข้อความของ ZORT ว่า
            “ZORT มีปัญหาบางประการ, กรุณาคลิกที่นี่ เพื่อลองใหม่อีกครั้ง” — <b>ไม่ใช่ไฟล์ PDF</b>
          </span>
          <span className="block mt-0.5">
            ⚖️ ทดสอบคุม: ใส่โทเคน <code>cs</code> ผิด และ<b>ตัดโทเคนออกทั้งตัว</b> ⇒ ได้คำตอบ
            <b>เหมือนกันเป๊ะทั้งขนาดและข้อความ</b> ⇒ <b>ไม่ใช่เรื่องลิงก์หมดอายุหรือสิทธิ์ของเรา</b>
            ⇒ ต้องให้ ZORT แก้ฝั่งเขา · ระหว่างนี้ไฟล์ต้องมาจากทางอื่น
          </span>
          <span className="block mt-0.5">จอนี้ใช้เป็นสารบัญเทียบว่าเก็บครบ 694 ใบหรือยัง</span>
        </span>
      </div>

      {/* 🔴 **จอชื่อเดียวกันของ ZORT ว่างเปล่า — ต้องเขียนไว้ ไม่งั้นคนเทียบสองจอแล้วสรุปว่าจอใดจอหนึ่งพัง**
          กดอ่านเอง 16 ก.ย. 2569: `/ZDocument/list` (ชื่อจอ "จัดการเอกสาร") ขึ้น **จำนวน 0 รายการ**
          และกดครบทั้ง 6 แท็บ (ทั้งหมด · ใบเสนอราคา · ใบแจ้งหนี้ · ใบกำกับภาษี · ใบเสร็จรับเงิน · ใบหัก ณ ที่จ่าย)
          ได้ **0 ทุกแท็บ** ส่วนของเราได้ 694 ใบจากเส้น API
          ✅ **18 ก.ย. 2569 ตอบได้แล้ว — ไม่ใช่เรื่องชนิดเอกสาร แต่เป็น "ช่วงวันเริ่มต้น"**
             จอเขาตั้งช่วงวันไว้ 3 เดือนล่าสุด (อ่านจากหัวจอ: 18/6/2569-18/9/2569)
             ส่วนเอกสาร 694 ใบของเราเป็นปี 2565 ถึง 689 ใบ (ใหม่สุด ก.พ. 2568) ⇒ ไม่มีใบไหนอยู่ในช่วงนั้นเลย
             ⚠️ สมมติฐานเดิมที่เขียนไว้ ("อาจนับเฉพาะเอกสารที่ออกในโมดูลนั้นเอง") **ตกไปแล้ว**
                เพราะในกองของเรามีใบเสร็จรับเงิน 61 ใบ + ใบกำกับภาษี 2 ใบ ซึ่งเป็นชนิดที่จอเขา "มีแท็บให้" อยู่แล้ว
             ✅ พิสูจน์ครบ 18 ก.ย. 2569: ตั้งช่วงวันเป็นปี 2565 ทั้งปีแล้วค้นหา จอเขาขึ้น **689 รายการ**
                = จำนวนใบปี 2565 ของเราพอดี และในแถวเขามีใบส่งสินค้าด้วย ⇒ ตรงกันทั้งสองฝั่ง
             📌 ข้อจำกัดของจอเขา: ค้นหาช่วงวันเกิน 1 ปีไม่ได้ (โค้ดเขาเตือนเอง "ช่วงวันที่ห้ามเกิน 1 ปี") */}
      <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        📊 <b>จอ &ldquo;จัดการเอกสาร&rdquo; ของ ZORT เองแสดง 0 รายการ</b> (อ่านสด 16 ก.ย. 2569 · กดครบทั้ง 6 แท็บได้ 0 ทุกแท็บ)
        {' '}ส่วนจอนี้แสดง <b>694 ใบ</b> จากเส้น API ที่คืน<b>ประวัติเอกสารที่ถูกออกให้ใบขาย</b> (ส่วนใหญ่เป็นใบส่งสินค้า)
        {' '}⇒ <b>คนละประชากร เทียบจำนวนกันตรง ๆ ไม่ได้</b>
        {/* ✅ **ตอบได้แล้ว 18 ก.ย. 2569 — เดิมเขียนว่า "ยังไม่รู้ว่าจอของ ZORT คัดใบด้วยเงื่อนไขอะไร"**
            เปิดจอ `/ZDocument/list` อ่านจริง: หัวจอเขียนช่วงวันไว้ **18/6/2569-18/9/2569** (ค่าเริ่มต้น 3 เดือนล่าสุด)
            แล้วไล่วันที่เอกสารของเราทั้ง 694 ใบ: **2565 (2022) 689 ใบ · 2567 3 ใบ · 2568 2 ใบ** ⇒ ใบใหม่สุดคือ ก.พ. 2568
            ⇒ **ไม่มีใบไหนตกอยู่ในช่วง 3 เดือนล่าสุดเลย จอเขาจึงขึ้น 0 อย่างถูกต้อง** ไม่ใช่คัดด้วยชนิดเอกสาร
            ⚠️ ที่ยังไม่ได้พิสูจน์: ถ้าขยายช่วงวันบนจอเขาแล้วจะเห็นใบปี 2565 ไหม
               (ช่องวันของเขาเป็นปฏิทิน readonly · ส่งค่าทาง URL ก็ถูกเมิน ⇒ ยังตั้งจากนอกไม่ได้) */}
        <div className="mt-1.5">
          🗓️ <b>ทำไมจอ ZORT ขึ้น 0 — ตอบได้แล้ว 18 ก.ย. 2569</b>: จอ <code>/ZDocument/list</code> ของเขา
          {' '}<b>ตั้งช่วงวันเริ่มต้นเป็น 3 เดือนล่าสุด</b> (ตอนอ่านคือ 18/6/2569-18/9/2569)
          {' '}ส่วนเอกสารทั้ง <b>694</b> ใบของเราเป็นของ <b>ปี 2565 ถึง 689 ใบ</b> · ปี 2567 3 ใบ · ปี 2568 2 ใบ
          {' '}⇒ <b>ไม่มีใบไหนอยู่ในช่วงเริ่มต้นของเขาเลย เลขศูนย์จึงถูกต้อง</b> — ไม่ได้คัดด้วยชนิดเอกสาร
          <div className="mt-1 text-emerald-800">
            ✅ <b>พิสูจน์ครบแล้ว 18 ก.ย. 2569</b> — ตั้งช่วงวันบนจอเขาเป็นปี 2565 ทั้งปี แล้วกดค้นหา
            {' '}จอ ZORT ขึ้น <b>689 รายการ</b> ซึ่ง<b>ตรงกับจำนวนใบปี 2565 ของเราพอดี</b>
            {' '}และในแถวของเขา<b>มีใบส่งสินค้าอยู่ด้วย</b> ⇒ <b>สองฝั่งตรงกันทั้งหมด ไม่มีใครข้อมูลหาย</b>
            {' '}(694 ของเรา = 689 ปี 2565 + 3 ปี 2567 + 2 ปี 2568)
            <div className="mt-1 text-gray-500">
              📌 ข้อจำกัดของจอเขาที่เจอระหว่างตรวจ: <b>ช่วงวันค้นหาเกิน 1 ปีไม่ได้</b> (จอเขาขึ้นเตือนเอง)
              {' '}⇒ ถ้าจะดูหลายปีต้องค้นทีละปี
            </div>
          </div>
        </div>
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

      {/* ⚠️ โน้ต "ลองรีเฟรช" ใช้ได้เฉพาะตอน **ผิดพลาดจริง** — สถานะที่สามรีเฟรชกี่ครั้งก็เหมือนเดิม
          (ต้องไปตั้งค่าปลายทางก่อน) ⇒ แนะนำผิดจะทำให้คนกดรีเฟรชวนอยู่อย่างนั้น */}
      {error && (isSkip(error) ? (
        <ErrorBox>{error}</ErrorBox>
      ) : (
        <ErrorBox title="อ่านเอกสารไม่สำเร็จ">{error}
          <span className="block mt-1 text-[12px]">⚠️ อ่านไม่ได้ <b>ไม่ได้แปลว่าไม่มีเอกสาร</b> — ลองรีเฟรชอีกครั้ง</span>
        </ErrorBox>
      ))}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {/* 🔎 แถวค้นหา + ช่วงวันที่ — ลอกผังจาก ZORT `/ZDocument/list`
              ⚠️ **ต้องบอกขอบเขตของการกรองเสมอ**: ท่อกรองให้ไม่ได้ ⇒ จอโหลดครบ 694 ใบก่อนแล้วกรองเอง
                 ถ้าปล่อยให้กรองเฉพาะหน้าที่เปิดอยู่ = "กรอง 50 ใบจาก 694" ซึ่ง CLAUDE.md ห้ามไว้ตรง ๆ */}
          <div className="flex flex-wrap items-end gap-2 mb-3 text-[12.5px]">
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500">ค้นหา</span>
              <input value={ค้น} onChange={(e) => setค้น(e.target.value)}
                placeholder="เลขที่เอกสาร · ประเภท · เลขที่อ้างอิง"
                className="border border-gray-300 rounded px-2 py-1 w-[240px]" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500">ตั้งแต่วันที่</span>
              <input type="date" value={ตั้งแต่} onChange={(e) => setตั้งแต่(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500">ถึงวันที่</span>
              <input type="date" value={ถึง} onChange={(e) => setถึง(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1" />
            </label>
            {มีตัวกรอง && (
              <button type="button" onClick={() => { setค้น(''); setตั้งแต่(''); setถึง('') }}
                className="text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                ล้างตัวกรอง
              </button>
            )}
            {มีตัวกรอง && (
              <span className="text-gray-600">
                {กำลังโหลดครบ
                  ? <>⏳ กำลังอ่านให้ครบทุกหน้า (อ่านแล้ว {fmtNum(โหลดครบถึงหน้า * PAGE)} ใบ) — <b>ยังไม่ใช่คำตอบสุดท้าย</b></>
                  : ครบผิดพลาด
                    ? <span className="text-amber-800">⚠️ อ่านไม่ครบ ({ครบผิดพลาด}) — <b>ยังกรองไม่ได้</b> ไม่ใช่ว่าไม่มีใบที่ตรง</span>
                    : ทั้งหมด
                      ? <>พบ <b>{fmtNum(rows.length)}</b> ใบ — กรองจาก<b>ทั้งหมด {fmtNum(ทั้งหมด.length)} ใบ</b> (โหลดครบแล้ว ไม่ใช่เฉพาะหน้านี้)</>
                      : null}
              </span>
            )}
          </div>

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
          {/* 🔴 **ซ่อนแถบเลขหน้าเมื่อกำลังกรอง** — เพราะตอนกรอง แถวมาจากกองที่โหลดครบ (694 ใบ)
              ส่วนเลขหน้ามาจากการแบ่งหน้าฝั่งท่อ ⇒ วางคู่กันเมื่อไหร่ = ตัวเลขกับแถวคนละกติกา
              ซึ่งเป็นโรคประจำที่ CLAUDE.md เตือนไว้ (ตัวนับกับตัวแถวมาคนละที่) */}
          {มีตัวกรอง ? (
            <p className="mt-3 text-[12.5px] text-gray-500">
              กำลังแสดง<b>ผลกรองทั้งหมดในหน้าเดียว</b> — เลขหน้าถูกซ่อนไว้เพราะตัวกรองทำงานกับทั้ง 694 ใบ
              {' '}· ล้างตัวกรองเพื่อกลับไปดูแบบแบ่งหน้า
            </p>
          ) : (
          <div className="flex flex-wrap items-center gap-2 mt-3 text-[12.5px] text-gray-600">
            {/* เลขหน้าแบบ ZORT — ใช้ชิ้นเดียวกับจอรายการอื่น
                ⚠️ **เส้นนี้แบ่งหน้าด้วย `page=` ไม่ใช่ `offset=`** (ท่อเมิน offset — กับดักที่จดไว้หัวไฟล์)
                   ⇒ แปลง offset ↔ page ตรงนี้จุดเดียว: page = offset/PAGE + 1 */}
            <PageNav
              offset={(page - 1) * PAGE}
              perPage={PAGE}
              rowsOnPage={rows.length}
              total={typeof count === 'number' ? count : null}
              disabled={loading}
              onGo={(off) => load(Math.max(1, Math.floor(off / PAGE) + 1))}
            />
            {/* 🔎 หน้าที่ **ท่อบอกว่ากำลังอยู่** — ถ้าไม่ตรงกับที่จอขอ แปลว่าท่อตีความหน้าไม่เหมือนกัน */}
            {typeof data.applied?.page === 'number' && data.applied.page !== page && (
              <span className="text-amber-800">
                ⚠️ ท่อบอกว่ากำลังอยู่หน้า <b>{data.applied.page}</b> แต่จอขอหน้า <b>{page}</b>
              </span>
            )}
            {data.limitClamped && (
              <span className="text-amber-700">⚠️ ท่อลดจำนวนต่อหน้าให้เองเพราะชนเพดาน</span>
            )}
          </div>
          )}
        </>
      )}
    </div>
  )
}
