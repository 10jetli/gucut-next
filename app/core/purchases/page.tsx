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
import StorePicker, { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import StoreEcho from '@/components/zort/StoreEcho'
import { PURCHASE_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, THR, TD, TDR,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, PaymentPill, summaryLine, PageNav, RowCheck, BulkBar,} from '@/components/zort'
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
  /** 🏬 ร้านที่ท่อใช้จริง + ท่อเลือกให้เองหรือเปล่า — ยิงยืนยันครบ 4 เส้น 17 ก.ย. 2569
   *  (ไม่ส่ง store ⇒ z1 + storeDefaulted:true · ส่ง z2 ⇒ z2 + false · ค่ามั่ว ⇒ 400)
   *  ⚠️ **ไม่ได้อยู่ใน `applied`** แต่อยู่ชั้นบน ⇒ ต้องอ่านจากตรงนี้ */
  store?: string | null
  storeDefaulted?: boolean
  /** ขอบเขตร้านของข้อมูลชุดนี้ — **ข้อความมาจากท่อ จอไม่แต่งเอง** (ใบ t_mu2kxy6u)
   *  ไม่มีช่อง = ไม่แสดง · ห้ามพิมพ์ z1 ตายตัว (วันที่ท่อดึง z2 เข้ามา ข้อความจะเป็นเท็จเงียบ ๆ) */
  storeScope?: string

  skip?: string
  total: number
  amount: number
  limit: number
  offset: number
  byStatus?: { status: string; c: number }[]
  /** เงื่อนไขที่ท่อ **ใช้จริง** — มีไว้ให้จอตรวจว่าที่ขอไปกับที่ได้มาตรงกันไหม
   *  🔴 กฎประจำโปรเจกต์: **ตอบ 200 ไม่ได้แปลว่าทำให้** ⇒ ถ้าท่อบอกมาแล้ว จอต้องเอามาเทียบ
   *  ⚠️ ท่อรุ่นก่อนไม่มีช่องนี้ (undefined) ⇒ ห้ามถือว่า "ไม่ตรง" ต้องข้ามการตรวจไปเฉย ๆ */
  applied?: { q?: string | null; limit?: number | null; offset?: number | null; from?: string | null; to?: string | null }
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
  /* 🏬 ร้านที่กำลังดู (ท่อ gucut-web 0932fac · 15 ก.ย. 2569) — ยิงจริง: z1 33 ใบ · z2 64 ใบ = ZORT ทั้งคู่ */
  const [store, setStore] = useState<StoreId>('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  /* ☑️ เลือกหลายใบ — ZORT `/Buy/list` ติ๊กแล้วมีเมนู "คำสั่ง" 7 อย่าง (วัดจอจริง 16 ก.ย. 2569):
       ปักหมุดบนสุด · ถอนหมุด · เพิ่ม Tag · โอนสินค้าทั้งหมด · ชำระเต็มจำนวน · ซ่อน · ลบรายการ · ยกเลิกรายการ
     และ "พิมพ์เอกสาร" มีแบบเดียว: ใบแปะจดหมาย/กล่อง (ต้องใช้ที่อยู่ ⇒ ท่อยังไม่ส่งมา)
     ⚠️ ทุกคำสั่งของ ZORT **เขียนกลับไปที่ ZORT** ⇒ เราทำได้แค่คัดลอกเลขที่ใบ
        ⇒ ใส่เท่าที่ทำได้จริง + เขียนบอกที่เหลือ **ห้ามทำปุ่มหลอก** */
  const [picked, setPicked] = useState<string[]>([])
  const [copyMsg, setCopyMsg] = useState('')
  const copyNumbers = async (list: string[]) => {
    try {
      await navigator.clipboard.writeText(list.join(','))
      setCopyMsg(`คัดลอกแล้ว ${list.length.toLocaleString('th-TH')} เลขที่ใบ`)
    } catch {
      setCopyMsg('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เขียนคลิปบอร์ด')
    }
    setTimeout(() => setCopyMsg(''), 6000)
  }
  const [perPage, setPerPage] = useState(PAGE)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, tabId = tab, storeId = store, size = perPage) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'purchases', limit: String(size), offset: String(off) })
      /* 🔴 **เลิกส่ง `status` ไปท่อ — ท่อเมินพารามิเตอร์นี้** (ยิงพิสูจน์ 16 ก.ย. 2569)
         ยิง `status=Voided` · `Success` · `Pending` ⇒ ได้ **33 แถวเท่ากันทุกครั้ง** และแถวมีสถานะปนกัน
         (`applied` ของท่อไม่มีช่อง status ด้วย) ⇒ เดิมกดแท็บ "สำเร็จ" แล้วยังเห็นใบยกเลิกปนอยู่
         และกดแท็บ "รอโอน (0)" ก็ยังเห็น 33 แถว ⇒ **ตัวนับกับตัวแถวคนละกติกา** (กฎแท็บใน CLAUDE.md)
         ⇒ กรองในเครื่องแทน (ใบซื้อทั้งร้าน 33 ใบ · หน้าละ 50 ⇒ โหลดครบในหน้าเดียว = กรองครบทั้งชุด)
            และถ้าวันไหนใบเกินหนึ่งหน้า จะมีข้อความบอกว่ากรองเฉพาะที่โหลดมา */
      if (storeId) qs.set('store', storeId)
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
      setPicked([])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, tab, store, perPage])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allRows = data?.rows ?? []
  /* กรองตามแท็บในเครื่อง — ค่าดิบตรงกับที่ท่อส่งมา (Success · Voided · Waiting · WaitingPayment) */
  const rows = tab === 'all' ? allRows : allRows.filter((r) => (r.status ?? '') === tab)
  /** โหลดมาครบทั้งชุดหรือยัง — ใช้ตัดสินว่าการกรองในเครื่องครอบทั้งชุดไหม */
  const loadedAll = typeof data?.total === 'number' ? offset + allRows.length >= data.total : false
  const shown = offset + rows.length
  const byStatus = Array.isArray(data?.byStatus) ? data!.byStatus! : []
  /* 🔴 **ท่อไม่ส่ง byStatus ≠ ทุกสถานะเป็นศูนย์** (เจอด้วยท่อปลอมโหมด partialgood 16 ก.ย. 2569)
     เดิม `countOf()` คืน 0 เสมอเมื่อไม่มีข้อมูล ⇒ แท็บขึ้น "สำเร็จ (0)" ทั้งที่ความจริงคือ **ยังไม่รู้**
     ⇒ คนอ่านจะสรุปว่าไม่มีใบสำเร็จเลย ซึ่งเป็นการตัดสินใจผิดจากเลขที่เราไม่ได้รู้จริง
     ⚠️ ยังต้องโชว์ **ทุกแท็บ** ตามกฎ (แท็บคือสารบัญ) — แค่ไม่ใส่เลขในวงเล็บเมื่อไม่รู้
        (Tabs รับ count เป็น optional อยู่แล้ว ⇒ undefined = ไม่มีวงเล็บ) */
  /* ⚠️ **ตรวจเนื้อ ไม่ใช่ตรวจว่ามีก้อน** — ท่อปลอมส่ง `byStatus: [{}]` (อาเรย์ที่มีก้อนว่าง)
     ถ้าเช็คแค่ length > 0 จะนับว่า "รู้แล้ว" แล้วกลับไปโชว์ (0) เหมือนเดิม
     ⇒ ต้องมีอย่างน้อยหนึ่งแถวที่มีทั้ง `status` (ข้อความ) และ `c` (ตัวเลข) จริง ๆ */
  const รู้ตัวนับ = byStatus.some((x) => typeof x?.c === 'number' && typeof x?.status === 'string')
  const countOf = (s: string) => (รู้ตัวนับ ? (byStatus.find((x) => x.status === s)?.c ?? 0) : undefined)

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
          /* สถานะที่สามมาทาง `data.skip` ได้ด้วย ⇒ หัวจอต้องพูดเรื่องเดียวกับกล่องเหลือง
             (ไม่งั้นหัวจอเข้าสาขาปกติแล้วรายงานจำนวน/ความล้มเหลว คนละเรื่องกับกล่อง) */
          data?.skip ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' :
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
                filename: 'รายการซื้อ',
                scope: storeLabel(store),
                title: 'รายการซื้อ',
                /* 🔴 ไฟล์ต้องเป็นของร้านเดียวกับที่จอโชว์ — ลืมส่ง store แล้วไฟล์กลายเป็นของ z1 เงียบ ๆ */
                filters: [
                  ['ร้าน', storeLabel(store)],
                  /* 🔴 **ไฟล์นี้ไม่ได้กรองตามแท็บ** — ท่อไม่รับตัวกรองสถานะ ⇒ เขียนให้ตรง
                     เดิมเขียนชื่อแท็บลงไฟล์เฉย ๆ ⇒ คนเปิดไฟล์จะเชื่อว่ากรองแล้ว (ไฟล์โกหกขอบเขตตัวเอง) */
                  ['แท็บสถานะบนจอ', tab === 'all' ? 'ทั้งหมด'
                    : `${tab} — ⚠️ ไฟล์นี้ไม่ได้กรองด้วยสถานะ (ท่อไม่รองรับ) ได้ทุกสถานะ`],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'purchases', limit: String(limit), offset: String(offsetAt) })
                  /* 🔴 ท่อเมิน `status` (ยิงพิสูจน์ 16 ก.ย. 2569) ⇒ ไม่ส่งไป และเขียนในไฟล์ว่าไฟล์นี้ได้ทุกสถานะ */
                  if (store) qs.set('store', store)
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
      {/* ⚠️ สถานะที่สาม (ท่อตอบ 200 + ช่อง `skip`) ต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว
          เดิมเป็นกล่องขาว/เทา ⇒ อ่านเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ (แก้ยกชุด 16 ก.ย. 2569) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

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

          {/* ✅ **ด่านเทียบ "ที่ขอไป" กับ "ที่ท่อใช้จริง"** — ท่อส่ง `applied` มาให้แล้ว
              🔴 เหตุ: ถ้าวันหนึ่งท่อเมินคำค้นหรือหั่น `limit` ลงเงียบ ๆ จอจะโชว์ของชุดอื่น
                 โดยไม่มีอะไรฟ้อง (คลาสเดียวกับที่เจอกับ `status` ของเส้นนี้เอง)
              ⚠️ ท่อรุ่นก่อนไม่ส่ง `applied` ⇒ ข้ามการตรวจ ไม่ใช่ฟ้องว่าไม่ตรง */}
          {data?.applied && (
            (q.trim() ? (data.applied.q ?? '') !== q.trim() : !!(data.applied.q ?? '')) ||
            (typeof data.applied.limit === 'number' && data.applied.limit !== perPage) ||
            (typeof data.applied.offset === 'number' && data.applied.offset !== offset)
          ) && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
              ⚠️ <b>ท่อใช้เงื่อนไขไม่ตรงกับที่จอส่งไป</b> — จอขอ: คำค้น “{q.trim() || '(ไม่ได้ค้น)'}” ·
              ครั้งละ {fmtNum(perPage)} · เริ่มที่แถว {fmtNum(offset)}
              {' '}· ท่อใช้จริง: คำค้น “{data.applied.q || '(ไม่ได้ค้น)'}” ·
              ครั้งละ {typeof data.applied.limit === 'number' ? fmtNum(data.applied.limit) : 'ไม่บอก'} ·
              เริ่มที่แถว {typeof data.applied.offset === 'number' ? fmtNum(data.applied.offset) : 'ไม่บอก'}
              <span className="block mt-0.5 text-gray-600">⇒ ตัวเลขและแถวที่เห็นเป็นของเงื่อนไขที่ท่อใช้ ไม่ใช่ของที่เพิ่งกด</span>
            </p>
          )}

          {/* 🔴 **แท็บนี้กรองในเครื่อง ไม่ใช่ที่เซิร์ฟเวอร์** — ต้องเขียนไว้ตามกฎแท็บใน CLAUDE.md
                 ท่อเมินพารามิเตอร์ `status` (ยิงพิสูจน์ 16 ก.ย. 2569: ส่ง Voided/Success/Pending
                 ได้ 33 แถวเท่ากันทุกครั้ง สถานะปนกัน) ⇒ เดิมกดแท็บแล้วแถวไม่เปลี่ยน
              ⚠️ ตัวเลขบนแท็บมาจาก `byStatus` ของท่อ = **ทั้งชุด** ส่วนแถวมาจากที่โหลดมา
                 ⇒ ถ้าวันไหนโหลดไม่ครบ ต้องบอกตรง ๆ ว่ากรองเฉพาะที่โหลดมา */}
          {tab !== 'all' && (
            <p className="text-[11.5px] text-gray-500 mb-1">
              {loadedAll
                /* สาขานี้เข้าได้เฉพาะตอน loadedAll = true ซึ่งบังคับว่า total เป็นตัวเลขแล้ว
                   ⇒ ไม่ต้องมี `?? 0` (และด่าน check-unknown-vs-zero จะได้ไม่ต้องยกเว้นจุดนี้) */
                ? <>กรองในเบราว์เซอร์ — โหลดใบซื้อมาครบทั้ง {fmtNum(Number(data?.total))} ใบแล้ว จึงเท่ากับกรองทั้งชุด
                  {' '}· เหลือ <b>{fmtNum(rows.length)}</b> ใบในแท็บนี้</>
                : <>⚠️ กรองในเบราว์เซอร์ <b>เฉพาะ {fmtNum(allRows.length)} ใบที่โหลดมา</b>
                  {' '}({typeof data?.total === 'number'
                    ? <>ทั้งหมด {fmtNum(Number(data.total))} ใบ</>
                    : <>ยังไม่รู้ว่าทั้งชุดมีกี่ใบ — ท่อไม่ได้บอกจำนวน</>}) — ตัวเลขบนแท็บเป็นของทั้งชุด</>}
              {' '}· <span className="text-gray-400">ท่อยังไม่รับตัวกรองสถานะ — ขอไว้แล้ว</span>
            </p>
          )}

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StorePicker value={store} disabled={loading}
            onChange={(v) => { setStore(v); load(0, tab, v) }} />
          <StoreScopeLine scope={data?.storeScope} />
          {/* 🔴 ตรวจว่าท่อใช้ร้านเดียวกับที่จอขอจริง — เดิมส่ง store= ไปแล้วไม่เคยอ่านคำตอบ */}
          <StoreEcho ขอ={store} ได้={data?.store} ท่อเลือกให้={data?.storeDefaulted} />

          

          <TableWrap>
            <table className="w-full min-w-[900px]">
              {/* 🔃 หัวคอลัมน์ที่ **จอ ZORT กดเรียงได้** มี tooltip บอกว่าของเรายังเรียงไม่ได้
                  (ยิงทดสอบ 16 ก.ย. 2569: ท่อเส้นนี้เมิน `sort=` ทุกค่า รวมค่ามั่ว ⇒ ทำปุ่มไว้ = ปุ่มหลอก)
                  ⚠️ ลอกไปใช้จออื่นได้เฉพาะคอลัมน์ที่ **ไปวัดจอ ZORT มาแล้วจริง ๆ** ห้ามเดา */}
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 34 }}>
                    <RowCheck label="เลือกทั้งหน้า"
                      checked={rows.length > 0 && picked.length === rows.length}
                      indeterminate={picked.length > 0 && picked.length < rows.length}
                      onChange={(v) => setPicked(v ? rows.map((r) => String(r.number)) : [])} />
                  </th>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">วันที่</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">รายการ</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">ผู้ติดต่อ</span></th>
                  <th className={THR}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">มูลค่า</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">สถานะ</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">ชำระเงิน</span></th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={9} icon="🔍" title="ไม่พบใบสั่งซื้อที่ค้นหา" detail="ลองพิมพ์เลขที่ใบหรือชื่อผู้ขายให้สั้นลง" />
                    : <EmptyState cols={9} icon="🧾" title="ยังไม่มีใบสั่งซื้อในแท็บนี้"
                        detail="ใบสั่งซื้อดึงมาจาก ZORT — เปิดใบใหม่ที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.number} className={`border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa] ${picked.includes(String(r.number)) ? 'bg-[#eef1fa]' : ''}`}>
                    <td className={TD}>
                      <RowCheck label={`เลือก ${r.number}`}
                        checked={picked.includes(String(r.number))}
                        onChange={(v) => setPicked((old) => (v ? [...old, String(r.number)] : old.filter((x) => x !== String(r.number))))} />
                    </td>
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-500`}>{thaiDate(r.po_date)}</td>
                    {/* ⚠️ ไม่ทำสีฟ้า เพราะยังไม่มีหน้าปลายทางให้กด — สีฟ้าในตารางคือสัญญาว่ากดได้ */}
                    <td className={TD}>
                      {/* เลขที่ใบ → รายละเอียดรายใบ (แบบแผนข้อ 1 ของ ZORT: เลขเอกสารกดได้เสมอ)
                          เส้น ?purchase= เปิดให้แล้ว 8 ก.ย. 2569 */}
                      {/* 🏬 พก store ไปด้วย — เลขที่ใบของสองร้านซ้ำกันได้ ⇒ ถ้าไม่บอกร้าน หน้ารายใบจะไปเปิดของ z1 เสมอ */}
                      <Link href={`/core/purchases/detail?no=${encodeURIComponent(r.number)}${store ? `&store=${store}` : ''}`}
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
              <PageNav offset={offset} perPage={perPage} rowsOnPage={rows.length}
                total={typeof data.total === 'number' ? data.total : null}
                disabled={loading} onGo={(off) => load(off)}
                  onPerPage={(n) => { setPerPage(n); load(0, undefined, undefined, n) }} />
            </div>
          </TableWrap>

          {picked.length > 0 && (
            <BulkBar>
              <b>เลือก {picked.length.toLocaleString('th-TH')} ใบ</b>
              <span className="text-gray-500">(เฉพาะหน้านี้)</span>
              <button type="button" onClick={() => { void copyNumbers(picked) }}
                className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
                คัดลอกเลขที่ใบที่เลือก
              </button>
              <button type="button" onClick={() => setPicked([])} className="text-blue-600 hover:underline">ล้างที่เลือก</button>
              {copyMsg && <span className="text-gray-600">{copyMsg}</span>}
              <span className="text-gray-500 basis-full">
                ⚠️ คำสั่งเป็นชุดของ ZORT (ปักหมุด · Tag · โอนสินค้าทั้งหมด · ชำระเต็มจำนวน · ซ่อน · ลบ · ยกเลิกรายการ)
                <b>เรายังทำไม่ได้</b> เพราะต้องเขียนกลับไปที่ ZORT · ส่วนใบแปะจดหมาย/กล่องต้องใช้<b>ที่อยู่ผู้รับ</b>
                ซึ่งท่อยังไม่ส่งมา (ขอไว้แล้ว)
              </span>
            </BulkBar>
          )}


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
