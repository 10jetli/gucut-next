'use client'
// รายการโอนสินค้า — **ลอกจาก `zort-ui/31-zort-รายการโอนสินค้า-12196.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ | ตรวจสอบการนับสินค้าเข้า"
//      → ปุ่ม นำเข้าไฟล์ (Excel) · สร้างรายการโอนสินค้า → แถวค้นหา
//      → แท็บ ทั้งหมด · รอโอน · สำเร็จ
//      → ตาราง # · วันที่ · รายการ · ประเภท · จาก · ไป · สถานะ · ⋮
//
// ⚠️ **API ส่งรหัสคลังมา (NEW · KLD · ANJ) แต่ ZORT แสดงชื่อคลัง ("โกดัง")**
//    ⇒ ต้องแปลงด้วย list=warehouses ก่อนแสดง ไม่งั้นคนใช้เห็น "NEW" แล้วไม่รู้ว่าคืออะไร
//    ⚠️ แปลงไม่ได้ให้แสดงรหัสเดิม **ห้ามแสดงค่าว่าง** — รหัสที่อ่านไม่ออกยังดีกว่าช่องว่าง
// ⚠️ ช่อง "จาก" หรือ "ไป" ว่างเป็นเรื่องปกติของประเภท "ปรับ" (ปรับสต็อก ไม่ใช่โอนระหว่างคลัง)
//    ⇒ แสดง "-" เหมือน ZORT ไม่ใช่เขียนว่าข้อมูลหาย
// ⚠️ **ห้ามเอาไปรวมกับ stock_moves** — ตารางนั้นคือของที่ "เราปรับเอง"
//    ส่วนจอนี้คือกระจกของ ZORT · รวมกันเมื่อไหร่ = ตัดสต็อกสองรอบ
import { useCallback, useEffect, useState } from 'react'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import StorePicker, { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import { TRANSFER_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, TD,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate, PageNav,} from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'

/* 🔴 **ชื่อฟิลด์เคยผิดทั้งชุด — คอลัมน์ขึ้นขีดกลางทุกแถวโดยไม่มีอะไรฟ้อง** (แก้ 5 ก.ย. 2569)
   จอเดาชื่อไว้ว่า transferdate · transferType · fromwarehousecode · towarehousecode
   ของจริงที่ท่อส่งคือ  transfer_date · kind · from_wh · to_wh  (ยิง list=transfers ยืนยันแล้ว)
   ⇒ อ่านไม่เจอ = undefined ⇒ **จอไม่พัง มันวาดขีดกลางให้สวย ๆ แทน**
      อ่านแล้วเหมือน "ZORT ไม่ได้ส่งข้อมูลมา" ทั้งที่ข้อมูลอยู่ครบทุกช่อง
   ⇒ เจอตอนเอาภาพหน้าจอจริงไปวางเทียบเท่านั้น — build ผ่าน · tsc ผ่าน · ไม่มี error สักตัว
   **ห้ามเดาชื่อฟิลด์อีก ให้ยิงของจริงดูคีย์ก่อนเขียนจอเสมอ** */
interface Row {
  /** id ZORT (กุญแจจริง — เลขที่ใบซ้ำกันได้ 546 เลข) · เส้นรายใบรับ id เท่านั้น */
  id?: string | number | null
  number: string
  kind?: string | number
  from_wh?: string
  to_wh?: string
  status?: string
  transfer_date?: string
  reference?: string
  note?: string
}
interface Resp {
  /** ขอบเขตร้านของข้อมูลชุดนี้ — **ข้อความมาจากท่อ จอไม่แต่งเอง** (ใบ t_mu2kxy6u)
   *  ไม่มีช่อง = ไม่แสดง · ห้ามพิมพ์ z1 ตายตัว (วันที่ท่อดึง z2 เข้ามา ข้อความจะเป็นเท็จเงียบ ๆ) */
  storeScope?: string

  skip?: string
  total: number
  oldest?: string
  note?: string
  limit?: number
  offset?: number
  byStatus?: { status: string; c: number }[]
  rows: Row[]
}

const PAGE = 50

// ชื่อสถานะดิบจาก ZORT — **แปลบนจอเท่านั้น** ค่าที่ส่งกลับ API ต้องเป็นค่าดิบ
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(TRANSFER_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}
const statusTone = (s?: string) =>
  s === 'Success' ? 'green' : s === 'Voided' ? 'red' : s ? 'orange' : 'gray'

/** ประเภทรายการ — ⚠️ แปลเฉพาะค่าที่รู้แน่ ค่าที่ไม่รู้จักแสดงค่าดิบ ห้ามเดา
 *  เดาผิดที่ช่องนี้ = จอบอกว่า "โอนระหว่างคลัง" ทั้งที่เป็นการปรับสต็อก ซึ่งคนละเรื่อง */
const TYPE_TH: Record<string, string> = {
  Adjust: 'ปรับ',
  adjust: 'ปรับ',
  Transfer: 'โอน',
  transfer: 'โอน',
}
const typeTh = (t?: string | number) => {
  const k = String(t ?? '')
  return TYPE_TH[k] ?? (k || '—')
}

export default function CoreTransfersPage() {
  const [q, setQ] = useState('')
  /* 🏬 **ร้านที่กำลังดู** (ท่อ gucut-web 7351c3c · 15 ก.ย. 2569)
     ⚠️ เส้นนี้ **ตอบทีละร้านเท่านั้น** — ยิงจริงยืนยัน 15 ก.ย.: ไม่ระบุ ⇒ z1 12,003 · z2 15,514
        · `store=all` ⇒ **400** · ส่ง `source=` แทน `store=` ⇒ **400**
     ⇒ **ห้ามมีตัวเลือก "ทุกร้าน" ในจอนี้** (ต่างจากจอรายการขายที่เส้นของมันรวมสองร้านได้)
        ถ้าใส่ไว้ คนกดแล้วจะได้จอแดงโดยไม่รู้ว่าทำอะไรผิด */
  const [store, setStore] = useState<StoreId>('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [wErr, setWErr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, tabId = tab, storeId = store) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'transfers', limit: String(PAGE), offset: String(off) })
      /* 🔴 **เลิกส่ง `status` — ท่อเมินพารามิเตอร์นี้** (ยิงพิสูจน์ 16 ก.ย. 2569)
         ยิง status=Success/Pending/Voided ⇒ total 12,005 เท่ากันทุกครั้ง · แถวเป็น Success ล้วนทุกครั้ง
         และคำตอบ **ไม่มีช่อง `applied` เลย** ⇒ ไม่มีทางรู้จากคำตอบว่าท่อกรองให้หรือไม่
         ⇒ เดิมกดแท็บ "รอโอน (2)" แล้วได้ 50 แถวที่เป็น "สำเร็จ" ทั้งหมด = แท็บสัญญา 2 ใบ แต่โชว์ของคนละกอง
         ⇒ กรองในเครื่อง + เขียนบนจอว่ากรองเฉพาะหน้านี้ (ใบโอนมี 12,005 ใบ · หน้าละ 50 ⇒ ไม่ครบชุดแน่นอน) */
      /* ว่าง = ไม่ส่ง `store` เลย ⇒ ท่อคืน z1 ให้ (และบอกกลับมาว่า storeDefaulted) */
      if (storeId) qs.set('store', storeId)
      if (q.trim()) qs.set('q', q.trim())
      const [tRes, wRes] = await Promise.all([
        fetch(`/api/web/core?${qs}`).then((r) => r.json()),
        fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null),
      ])
      if (tRes?.error) throw new Error(tRes.error)
      setData(tRes)
      setOffset(off)
      const map: Record<string, string> = {}
      for (const w of (Array.isArray(wRes?.warehouses) ? wRes.warehouses : [])) {
        if (w?.code) map[String(w.code)] = String(w.name || w.code)
      }
      setNames(map)
      // ⚠️ ดึงชื่อคลังไม่ได้ = จอโชว์รหัสคลังดิบ ต้องบอก ไม่ใช่ปล่อยให้อ่านเป็นชื่อจริง
      setWErr(!wRes || !Array.isArray(wRes?.warehouses))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, tab, store])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** รหัสคลัง → ชื่อคลัง · ไม่มีค่า = "-" (ปกติของประเภท "ปรับ") · แปลงไม่ได้ = โชว์รหัสเดิม */
  const wh = (code?: string) => {
    const c = String(code ?? '').trim()
    if (!c) return <span className="text-gray-400">-</span>
    return <span className="text-gray-700">{names[c] ?? c}</span>
  }

  const allRows = data?.rows ?? []
  /* กรองตามแท็บในเครื่อง (ท่อไม่รับ status) — ค่าดิบตรงกับที่ท่อส่ง */
  const rows = tab === 'all' ? allRows : allRows.filter((r) => (r.status ?? '') === tab)
  /** โหลดครบทั้งชุดไหม — ใบโอนเยอะ (หมื่นกว่าใบ) แทบไม่มีทางครบ ⇒ ต้องเตือนตรง ๆ */
  const loadedAll = typeof data?.total === 'number' ? offset + allRows.length >= data.total : false
  /* 🔴 **ตาข่ายกันบั๊กที่เพิ่งเจอไม่ให้กลับมาเงียบ ๆ อีก**
     ถ้ามีแถวแต่ทุกแถวไม่มีช่องที่จอต้องใช้เลย = ท่อเปลี่ยนชื่อฟิลด์ (หรือจอเดาผิดอีกรอบ)
     เดิมอาการคือคอลัมน์ขึ้นขีดกลางทุกแถว **ซึ่งอ่านได้ว่า "ไม่มีข้อมูล" ทั้งที่ข้อมูลอยู่ครบ**
     ⇒ ให้จอฟ้องพร้อมบอกชื่อคีย์จริงที่ได้มา จะได้แก้ได้ทันทีโดยไม่ต้องเปิดฐาน */
  const shapeBroken = rows.length > 0
    && rows.every((r) => r.transfer_date === undefined && r.kind === undefined)
  const seenKeys = shapeBroken ? Object.keys(rows[0] ?? {}).join(' · ') : ''
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

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการโอนสินค้า"
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
              จำนวน {fmtNum(data.total)} รายการ{' | '}
              {/* ✅ แก้ 14 ก.ย. 2569 (t_mu10s2ns): เดิมชี้ /core/soon/stock-count — ตรวจนับ/รับของทำได้แล้วในหน้าใบสั่งซื้อ (t_mu0tx40g)
                  ต้องรู้ id ของใบใน ZORT ก่อน ⇒ ไม่มีหน้ารวม · ข้อความเดียวกับหน้ารายการซื้อ */}
              <span className="text-gray-600">ตรวจสอบการนับสินค้าเข้า: <Link href="/core/purchases" className="text-blue-600 hover:underline">รายการซื้อ</Link> → <b>กดเลขที่ใบ</b></span>
            </>
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* 📤 ส่งออกตามตัวกรองที่เลือกอยู่ ครบทุกหน้า
                ⚠️ ไฟล์ใส่ **ทั้งรหัสคลังและชื่อคลัง** — ท่อส่งรหัส (NEW · KLD · ANJ)
                   ถ้าใส่แต่ชื่อ แล้ววันไหนดึงชื่อไม่ได้ ไฟล์จะมีแต่รหัสดิบโดยไม่มีใครรู้
                   ถ้าใส่แต่รหัส คนอ่านไฟล์นอกทีมก็ไม่รู้ว่าคืออะไร ⇒ ใส่ทั้งคู่ */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: `รายการโอนสินค้า-${new Date().toISOString().slice(0, 10)}`,
                title: 'รายการโอนสินค้า',
                note: wErr ? 'รอบนี้ดึงชื่อคลังไม่ได้ — คอลัมน์ชื่อคลังจึงเว้นว่าง (รหัสคลังยังอยู่ครบ)' : undefined,
                /* 🔴 **ไฟล์ต้องเป็นของร้านเดียวกับที่จอกำลังโชว์** — ฝั่งท่อกำชับตรง ๆ
                   ถ้าลืมส่ง `store` ไฟล์จะกลายเป็นของ z1 ทั้งที่จอโชว์ z2 อยู่
                   ⇒ ผิดแบบที่ไม่มีอะไรฟ้อง เพราะไฟล์ก็ดูปกติทุกประการ */
                filters: [
                  ['ร้าน', storeLabel(store)],
                  /* 🔴 ไฟล์นี้ไม่ได้กรองด้วยสถานะ (ท่อไม่รองรับ) ⇒ เขียนให้ตรง ไม่ใช่ใส่ชื่อแท็บเฉย ๆ */
                  ['แท็บสถานะบนจอ', tab === 'all' ? 'ทั้งหมด'
                    : `${tab} — ⚠️ ไฟล์นี้ไม่ได้กรองด้วยสถานะ (ท่อไม่รองรับ) ได้ทุกสถานะ`],
                  ['คำค้นหา', q.trim() || '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const qs = new URLSearchParams({ list: 'transfers', limit: String(limit), offset: String(offsetAt) })
                  /* 🔴 ท่อเมิน `status` ⇒ ไม่ส่งไป และต้องเขียนในไฟล์ว่าไฟล์นี้ได้ทุกสถานะ */
                  if (store) qs.set('store', store)
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['เลขที่ใบโอน', 'วันที่', 'ประเภท', 'รหัสคลังต้นทาง', 'ชื่อคลังต้นทาง', 'รหัสคลังปลายทาง', 'ชื่อคลังปลายทาง', 'สถานะ', 'อ้างอิง', 'หมายเหตุ'],
                toRow: (r: Row) => [
                  r.number, r.transfer_date ?? null, r.kind ?? null,
                  r.from_wh ?? null, r.from_wh ? (names[String(r.from_wh)] ?? null) : null,
                  r.to_wh ?? null, r.to_wh ? (names[String(r.to_wh)] ?? null) : null,
                  r.status ?? null, r.reference ?? null, r.note ?? null,
                ],
              }}
            />
            {/* 🔴 **ถอดปุ่ม "นำเข้าไฟล์ (Excel)" ออก** (15 ก.ย. 2569)
                เดิมชี้ไป `?kind=product` ทั้งที่จอนี้แสดงใบโอนสินค้า ไม่ใช่สินค้า
                ⇒ คนกดเพราะอยากนำเข้าใบโอนสินค้า แต่ไปโผล่หน้านำเข้า**สินค้า** ซึ่งคอลัมน์คนละชุด
                ⇒ ปุ่มที่กดแล้วเกิดอะไรขึ้นจริงแต่ไม่ใช่สิ่งที่คนตั้งใจ **หลอกกว่าปุ่มที่กดแล้วเงียบ**
                ⇒ หน้านำเข้ายังไม่รับชนิดนี้ ⇒ ไม่มีปุ่ม (ฝั่งท่อกำชับ: ชนิดที่ยังไม่รับ อย่าให้ปุ่มโผล่) */}
            {/* โอนสินค้าจริงร้านทำที่เครื่องมือเดิมอยู่แล้ว ⇒ ปุ่มนี้พาไปของจริง ไม่ใช่หน้า soon */}
            <Link href="/catalog/index.html#trf"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้างรายการโอนสินค้า
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขที่ใบโอน หรือคำอธิบาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการโอนสินค้าไม่ได้">{error}</ErrorBox>}

      {shapeBroken && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔴 <b>ท่อส่งชื่อฟิลด์ที่จอไม่รู้จัก</b> — คอลัมน์ วันที่ · ประเภท · จาก · ไป
          จะขึ้นขีดกลางทุกแถว <b>ไม่ได้แปลว่าไม่มีข้อมูล</b>
          <br />
          คีย์ที่ได้มาจริง: <code className="text-[11.5px]">{seenKeys}</code>
        </div>
      )}
      {loading && !data && <LoadingState />}
      {/* ⚠️ สถานะที่สาม (ท่อตอบ 200 + ช่อง `skip`) ต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว
          เดิมเป็นกล่องขาว/เทา ⇒ อ่านเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ (แก้ยกชุด 16 ก.ย. 2569) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

      {data && !data.skip && (
        <>
          {/* ผัง ZORT (ภาพ 31): ปุ่มรีเฟรชวงกลมอยู่มุมขวาของแถบแท็บ — วางเพิ่ม ไม่ย้ายอันบนหัวจอ
              (กติกาเดียวกับจอใบเสนอราคา: ย้ายขึ้นที่เดียวผิดผัง ย้ายลงที่เดียวหายจากที่คนเราชิน) */}
          <div className="flex items-end justify-between gap-3">
            <Tabs
              // ZORT โชว์ ทั้งหมด · รอโอน (2) · สำเร็จ — แท็บที่เป็น 0 ก็ต้องโชว์
              tabs={[
                { id: 'all', label: 'ทั้งหมด', count: data.total },
                { id: 'Pending', label: zortWord(TRANSFER_STATUS, 'Pending').text, count: countOf('Pending') },
                { id: 'Success', label: zortWord(TRANSFER_STATUS, 'Success').text, count: countOf('Success') },
              ]}
              active={tab}
              onChange={(id) => { setTab(id); load(0, id) }}
            />
            <button onClick={() => load(0)} disabled={loading} aria-label="โหลดใหม่"
              title="โหลดใหม่"
              className="mb-2 shrink-0 w-7 h-7 grid place-items-center rounded border border-gray-300
                bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? '⏳' : '⟳'}
            </button>
          </div>

          {/* 🔴 **แท็บนี้กรองเฉพาะหน้าที่เห็น** — ท่อไม่รับตัวกรองสถานะ (กฎแท็บข้อ 3 ใน CLAUDE.md)
                 ตัวเลขบนแท็บมาจาก `byStatus` = ทั้งชุด (Success 11,975 · Voided 28 · Pending 2)
                 แต่แถวมาจากหน้าที่โหลดมา 50 ใบ ⇒ **ต้องเขียนว่าต่างกันตรงไหน ห้ามปล่อยเงียบ** */}
          {tab !== 'all' && !loadedAll && (
            <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-1 leading-relaxed">
              ⚠️ <b>ตัวเลขบนแท็บเป็นของทั้งชุด แต่แถวที่กรองได้มาจากหน้านี้เท่านั้น</b> —
              ท่อยังไม่รับตัวกรองสถานะ (ยิงตรวจแล้ว 16 ก.ย. 2569 · ขอไว้แล้ว) ⇒
              {' '}กรองได้ <b>{rows.length}</b> จาก {allRows.length} แถวในหน้านี้
              {typeof data?.total === 'number' && <> (ทั้งชุด {data.total.toLocaleString('th-TH')} ใบ)</>}
              {' '}· ใบที่หาไม่เจออาจอยู่หน้าอื่น — <b>ค้นด้วยเลขที่ใบจะตรงกว่า</b>
            </p>
          )}

          {/* 🏬 เลือกร้าน — ปุ่มชุดเดียวกับจอเอกสารอื่น (components/zort/StorePicker) */}
          <StorePicker value={store} disabled={loading}
            onChange={(v) => { setStore(v); load(0, tab, v) }} />

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StoreScopeLine scope={data?.storeScope} />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ประเภท</th>
                  <th className={TH}>จาก</th>
                  <th className={TH}>ไป</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={8} icon="🔍" title="ไม่พบใบโอนที่ค้นหา" detail="ลองพิมพ์เลขที่ใบให้สั้นลง" />
                    : <EmptyState cols={8} icon="🔄" title="ยังไม่มีใบโอนในแท็บนี้"
                        detail="ใบโอนดึงมาจาก ZORT — โอนของที่ ZORT หรือที่เครื่องมือโอนสินค้าแล้วรอบซิงก์ถัดไปจะเข้ามา" />
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{thaiDate(r.transfer_date)}</td>
                    <td className={TD}>
                      {r.id !== null && r.id !== undefined
                        ? <Link href={`/core/transfers/detail?id=${encodeURIComponent(String(r.id))}`}
                            className="text-blue-600 font-medium hover:underline">{r.number}</Link>
                        : <span className="text-gray-900 font-medium" title="แถวนี้ไม่มี id — เปิดรายละเอียดไม่ได้">{r.number}</span>}
                    </td>
                    <td className={`${TD} text-gray-700`}>{typeTh(r.kind)}</td>
                    <td className={TD}>{wh(r.from_wh)}</td>
                    <td className={TD}>{wh(r.to_wh)}</td>
                    <td className={TD}><Pill tone={statusTone(r.status)}>{statusTh(r.status)}</Pill></td>
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
              <PageNav offset={offset} perPage={PAGE} rowsOnPage={rows.length}
                total={typeof data.total === 'number' ? data.total : null}
                disabled={loading} onGo={(off) => load(off)} />
            </div>
          </TableWrap>

          {/* ⚠️ **ตัวเลขบนจอนี้น้อยกว่าที่ ZORT แสดง และต้องบอกว่าทำไม**
              ตรวจทีละประเภทแล้ว (3 ก.ย. 2569): โอน 28=28 · ยกมา 6,851=6,851 ·
              ประกอบ/แยกส่วน 0=0 · **ปรับ 5,317 แต่ API ส่งมา 5,123** ⇒ ขาด 194 ใบ
              ⇒ **API ของ ZORT เองไม่ส่งใบ "ปรับ" มาครบ ไม่ใช่ท่อเราพลาด**
              ⚠️ ห้ามเขียนเลข 12,196 ตามจอ ZORT เพราะเราไม่มี 194 ใบนั้นจริง ๆ —
                 เลขสวยแต่กดเข้าไปหาไม่เจอ แย่กว่าเลขน้อยกว่าที่บอกเหตุผลไว้ */}
          <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
            เก็บจาก API ของ ZORT ได้ <b>{fmtNum(data.total)}</b> ใบ
            {data.oldest && <> ({thaiDate(data.oldest)} – ปัจจุบัน)</>} ·
            จอ ZORT เองแสดงมากกว่านี้ <b>194 ใบ</b> (ตรวจเมื่อ 3 ก.ย. 2569) —
            เป็นใบประเภท <b>ปรับ</b> ที่ API ของ ZORT ไม่ส่งออกมา <b>ไม่ใช่ข้อมูลตกหล่นฝั่งเรา</b>
            <br />
            ช่อง <b>จาก</b> หรือ <b>ไป</b> ว่างเป็นเรื่องปกติของประเภท &quot;ปรับ&quot;
            (ปรับสต็อกในคลังเดียว ไม่ได้โอนข้ามคลัง)
            {/* ⚠️ ดึงชื่อคลังไม่ได้ = ช่อง จาก/ไป เป็น "รหัสดิบ" ที่หน้าตาเหมือนชื่อคลัง
                ไม่บอก = คนอ่านนึกว่าคลังชื่อนั้นจริง ๆ แล้วไปหาคลังที่ไม่มีอยู่ */}
            {wErr && (
              <>
                <br />
                <b className="text-amber-700">ดึงชื่อคลังไม่สำเร็จรอบนี้</b> — ช่อง จาก/ไป
                จึงแสดงเป็น <b>รหัสคลัง</b> ไม่ใช่ชื่อ (กดรีเฟรชอีกครั้งได้)
              </>
            )}
            {data.note ? ` · ${data.note}` : ''}
          </div>
        </>
      )}
    </div>
  )
}
