'use client'
// รายการขาย → ใบเสนอราคา — **ลอกจาก `zort-ui/51-zort-ใบเสนอราคา.jpg`**
// ผัง ZORT: ชื่อจอ + "จำนวน 3 รายการ, มูลค่าทั้งหมด 102,784 บาท" → ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง
//           → ค้นหา + ค้นหาขั้นสูง → แท็บ ทั้งหมด · อนุมัติแล้ว
//           → ตาราง: # · วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ
//
// 💡 **จอนี้ดึงสดจาก ZORT ไม่ทำกระจก** (ของ 3 แถวไม่ควรมีสำเนาให้ไม่ตรงกันได้)
//    ⇒ ต้องเขียนบนจอว่าเป็นข้อมูลสด เพราะจอพี่น้องข้าง ๆ อ่านจากคลังเงาทั้งหมด
//      คนใช้ต้องรู้ว่าจอไหนยิง ZORT จริง เวลา ZORT ล่มจะได้เข้าใจว่าทำไมจอนี้จอเดียวที่ว่าง
import { useCallback, useEffect, useState } from 'react'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import StorePicker, { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import StoreEcho from '@/components/zort/StoreEcho'
import { QUOTATION_STATUS, zortWord } from '@/lib/zort-words'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  Pill, toneOfStatus, EmptyState, thaiDate,
} from '@/components/zort'
import AdvancedSearch, { AdvancedSearchLink, type AdvField } from '@/components/zort/AdvancedSearch'
import ImportButton from '@/components/zort/ImportButton'
import ExportButton from '@/components/zort/ExportButton'

interface Row {
  /** id ในระบบ ZORT — เส้นรายใบรับ id เท่านั้น (ส่งเลขที่ใบ = ค่าว่างเงียบ ๆ · ท่อเตือนไว้เอง) */
  id?: string | number | null
  /** ช่องทาง — ท่อยังไม่ส่งมา แต่รับไว้ก่อนเพื่อไม่ต้องกลับมาแก้จอ */
  channel?: string
  number: string; customer?: string; phone?: string
  amount?: number; status?: string; date?: string; reference?: string
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
 total?: number; live?: boolean; rows?: Row[]; note?: string }

// ⚠️ ZORT เขียนป้ายว่า "รออนุมัติ" กับ "อนุมัติแล้ว" ในจอนี้ — คนละคำกับจอรายการขาย
//    ค่าดิบเป็น Pending/Success เหมือนกัน แต่ความหมายในบริบทใบเสนอราคาคือการอนุมัติ
//    ⇒ แปลตามจอต้นแบบ ไม่ใช่แปลตามค่าดิบ
/* คำสถานะมาจาก `lib/zort-words.ts` ที่เดียว — เดิมไฟล์นี้มีแผนที่คำของตัวเอง
   ⇒ ค่าเดียวกันแปลไม่เหมือนกันข้ามจอ และค่าที่ไม่อยู่ในแผนที่หลุดเป็นอังกฤษออกจอ
   (ใบ t_mu23dljn · ทุกคำในไฟล์นั้นอ่านมาจากจอ ZORT จริง ไม่มีคำไหนแปลเอง) */
const statusTh = (s?: string) => {
  const w = zortWord(QUOTATION_STATUS, s)
  return w.text || 'ไม่ระบุสถานะ'
}

export default function QuotationsPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [tab, setTab] = useState('')
  /* ค้นหาขั้นสูง — ลอกช่องจากแผงจริงของ ZORT (กดเปิดอ่านเอง 16 ก.ย. 2569)
     ZORT มี 13 ช่อง: หมายเลขรายการ · มูลค่าเริ่มต้น/จนถึง · อ้างอิง · ช่องทางการขาย · Tag ·
     สินค้า · ชื่อลูกค้า · เบอร์โทรศัพท์ · อีเมลลูกค้า · ผู้ใช้งาน · สถานะ (ติ๊ก 3 ค่า) ·
     แสดงรายการที่ถูกซ่อน · ช่วงวันที่
     ⇒ ใส่ได้ 7 ช่องที่ **มีข้อมูลจริงในคำตอบของท่อ** ที่เหลือบอกไว้ว่าไม่มีและเพราะอะไร
     ⚠️ ทั้งหมดกรอง **ในเบราว์เซอร์** (ท่อรับแต่ `store`/`page`/`limit`)
        ตอนนี้จอดึงมาทั้งชุด (ท่อบอก total 6) ⇒ กรองในเครื่องคือกรองของจริงทั้งหมด
        แต่วันที่ใบเกิน 200 จะกลายเป็น "กรองเฉพาะที่โหลดมา" ⇒ ข้อความใต้แผงเปลี่ยนตาม `cut` เอง */
  const [adv, setAdv] = useState(false)
  const EMPTY_F = { number: '', amtFrom: '', amtTo: '', ref: '', cust: '', phone: '', status: '', from: '', to: '' }
  type Filt = typeof EMPTY_F
  /** ค่าที่กำลังกรอก (ยังไม่กรอง) — ZORT ก็ต้องกดปุ่มค้นหาก่อนเหมือนกัน */
  const [draft, setDraft] = useState<Filt>(EMPTY_F)
  /** ค่าที่กดค้นหาแล้ว = ค่าที่ตารางใช้จริง */
  const [filt, setFilt] = useState<Filt>(EMPTY_F)
  const [q, setQ] = useState('')
  /* 🏬 ร้านที่กำลังดู (ท่อ gucut-web 0932fac · 15 ก.ย. 2569) — ยิงจริง: z1 6 ใบ · z2 4 ใบ = ZORT */
  const [store, setStore] = useState<StoreId>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (storeId = store) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/web/core?list=quotations${storeId ? `&store=${storeId}` : ''}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
    } catch (e) {
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const all = Array.isArray(data?.rows) ? data!.rows! : []
  const rows = all.filter((r) => {
    if (tab === 'approved' && r.status !== 'Success') return false
    /* ค้นหาขั้นสูง: กรองจากแถวที่โหลดมา — จอนี้ดึงสดทั้งชุด (ท่อบอก total 6)
       ⇒ กรองฝั่งจอคือกรองของจริงทั้งหมด · วันไหนโดนตัด 200 แถว ตาข่าย `cut` ข้างล่างฟ้องเอง */
    if (filt.from && (!r.date || r.date.slice(0, 10) < filt.from)) return false
    if (filt.to && (!r.date || r.date.slice(0, 10) > filt.to)) return false
    const has = (hay: string | undefined, needle: string) =>
      !needle.trim() || (hay ?? '').toLowerCase().includes(needle.trim().toLowerCase())
    if (!has(String(r.number ?? ''), filt.number)) return false
    if (!has(r.reference, filt.ref)) return false
    if (!has(r.customer, filt.cust)) return false
    /* เบอร์โทร: เทียบแบบตัดอักขระที่ไม่ใช่เลขออก — คนพิมพ์ 081-234 กับ 081234 ต้องเจอใบเดียวกัน */
    if (filt.phone.trim()) {
      const digits = (x: string) => x.replace(/\D/g, '')
      if (!digits(r.phone ?? '').includes(digits(filt.phone))) return false
    }
    /* 🔴 มูลค่า: ช่องว่าง = ไม่กรอง · ตัวเลขพิมพ์ผิด (NaN) ก็ต้อง **ไม่กรอง** ไม่ใช่กรองจนเหลือ 0 แถว */
    const amt = Number(r.amount) || 0
    const lo = Number(filt.amtFrom)
    const hi = Number(filt.amtTo)
    if (filt.amtFrom.trim() && Number.isFinite(lo) && amt < lo) return false
    if (filt.amtTo.trim() && Number.isFinite(hi) && amt > hi) return false
    if (filt.status && (r.status ?? '') !== filt.status) return false
    const s = q.trim().toLowerCase()
    return !s || String(r.number ?? '').toLowerCase().includes(s) || (r.customer ?? '').toLowerCase().includes(s)
  })
  const advOn = Object.values(filt).some((v) => String(v).trim() !== '')
  const sum = all.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  /** ⚠️ **ตาข่ายกันวันข้างหน้า ไม่ใช่กันวันนี้** — ตอนนี้ร้านมีใบเสนอราคา 3 ใบ ยังไม่ชนอะไร
   *  แต่ท่อ `list` ทุกตัวตัดที่ 200 แถว และจอนี้ดึงครั้งเดียวไม่มีการแบ่งหน้า
   *  ⇒ วันไหนใบเสนอราคาเกิน 200 **ยอดรวมข้างบนจะเงียบ ๆ ต่ำกว่าจริง**
   *  บทเรียนจากจอรายงานยอดซื้อ: บรรทัดสรุปที่ถูก + ตารางที่ไม่ครบ อันตรายกว่าตัวเลขผิดตรง ๆ
   *  เพราะไม่มีอะไรดูขัดตา — ตาข่ายจึงต้องใส่**ก่อน**ถึงวันนั้น ไม่ใช่รอให้มีคนเจอ */
  /* 🔴 **ท่อไม่บอกจำนวนทั้งชุด ≠ โหลดครบแล้ว** (แก้ 16 ก.ย. 2569 · เจอด้วยท่อปลอม partialgood)
     เดิม `Number(data?.total ?? 0) - all.length` ⇒ ไม่มี total ⇒ cut = 0
     ⇒ จอสรุปว่า "โหลดมาครบทั้งชุด จึงเท่ากับกรองทั้งชุด" ซึ่งเป็น **คำรับประกันที่เราไม่ได้รู้** */
  const รู้ทั้งชุด = typeof data?.total === 'number' && Number.isFinite(data.total)
  const cut = รู้ทั้งชุด ? Math.max(0, Number(data!.total) - all.length) : 0

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ใบเสนอราคา"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามค้างที่ "กำลังโหลด…" — กล่องแดงข้างล่างบอกว่าพังแล้ว
             แต่หัวจอยังบอกว่ากำลังโหลด ⇒ คนรอต่อไปเรื่อย ๆ โดยไม่รู้ว่าจบแล้ว
             (เจอด้วยการเปิดจอตอนดึงข้อมูลไม่ได้ 6 ก.ย. 2569 — อ่านโค้ดแล้วไม่เห็น
              เพราะสองข้อความอยู่คนละที่ในไฟล์ และแต่ละอันถูกของมันเอง) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง') :
          data
            ? (
              <>
                {/* ⚠️ จำนวนต้องใช้ `total` จากเซิร์ฟเวอร์ ไม่ใช่ `all.length`
                    ZORT โชว์จำนวนจริงทั้งหมด ไม่ใช่จำนวนแถวที่เห็นบนจอ */}
                จำนวน {fmtNum(Number(data.total ?? all.length))} รายการ,
                {/* 🔴 **ยอดเงินต้องประกาศขอบเขตของตัวเองติดไปกับตัวเลข** (แก้ 12 ก.ย. 2569)
                    ของเดิมเขียนคำว่า "มูลค่าทั้งหมด" ตายตัว ทั้งที่ `sum` บวกจากแถวที่ดึงมาได้
                    (ท่อคืนได้สูงสุด 200 แถว) ⇒ วันที่เกิน 200 **หัวจอโชว์เลขที่ต่ำกว่าจริง**
                    แล้วคำอธิบายไปอยู่ใต้ตาราง 200 แถว = คนอ่านเลขผิดไปตัดสินใจก่อนเห็นป้าย
                    ⇒ ป้ายต้องย้ายหนีตัวเลขไม่ได้ (ท่าเดียวกับจอรับคืนสินค้า ซึ่งทำถูกอยู่แล้ว)
                    กติกาทั่วไปที่ CEO ยกขึ้นเป็นกฎ 12 ก.ย.: **ป้ายบอกขอบเขตต้องมาถึงตาก่อนตัวเลข** */}
                {/* 🔴 **สามสถานะ ห้ามยุบเหลือสอง** (แก้ 18 ก.ย. 2569)
                    เดิมเขียน `cut > 0 ? "เฉพาะที่ดึงมา" : "ทั้งหมด"` ⇒ ท่อไม่บอกจำนวนทั้งชุด
                    (cut = 0 เพราะไม่รู้) จะตกไปพูดว่า **"ทั้งหมด"** ซึ่งเป็นคำรับประกันที่เราไม่ได้รู้ */}
                มูลค่า{!รู้ทั้งชุด ? `เฉพาะ ${fmtNum(all.length)} ใบที่ดึงมา (ยังไม่รู้ว่าทั้งชุดมีกี่ใบ)`
                  : cut > 0 ? `เฉพาะ ${fmtNum(all.length)} ใบที่ดึงมา` : 'ทั้งหมด'} {fmtMoney(sum)} บาท
                {' | '}
                {/* ⚠️ ต้องบอกว่าจอนี้ยิง ZORT สด ต่างจากจออื่นที่อ่านคลังเงา */}
                <span className="text-gray-400">
                  {data.live ? 'ดึงสดจาก ZORT ทุกครั้งที่เปิดจอ (ไม่ได้ทำสำเนา)' : 'อ่านจากคลังของเราเอง'}
                </span>
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* 📤 ชุดเล็ก (ท่อบอก total 6) แต่ยังวนหน้าให้ครบเหมือนจอใหญ่
                เพราะวันหนึ่งใบเยอะขึ้น แล้วจะไม่มีใครกลับมาแก้ปุ่มนี้ */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: 'ใบเสนอราคา',
                /* ขอบเขตต้องพูดความจริงข้อเดียวกับ filters ข้างล่าง: ท่อไม่รับคำค้น ⇒ ไฟล์ได้ทุกใบ
     ✅ ยิงยืนยันซ้ำ 18 ก.ย. 2569: ส่ง q= แล้ว total ค้าง 6 เท่าเดิม **และท่อประกาศกลับมาว่า `ignored: {q}`**
        ⇒ ตอนนี้ท่อบอกเองแล้วว่าเมิน ไม่ใช่เมินเงียบ (ฝั่งท่อแก้ให้ตามที่เราขอ) */
                scope: `${storeLabel(store)} · ทุกใบ (ไฟล์ไม่ได้กรองตามคำค้นบนจอ)`,
                title: 'ใบเสนอราคา',
                /* 🔴 **จอนี้กรองคำค้นหาในเบราว์เซอร์ ไม่ใช่ที่เซิร์ฟเวอร์** (ท่อไม่รับ `q`)
                   ⇒ ไฟล์ที่ส่งออกได้ **ทุกแถว ไม่ได้กรองตามคำค้น** ⇒ ต้องเขียนให้ตรง
                   เดิมผมเขียนว่า "คำค้นหา: xyz" ทั้งที่ไม่ได้ส่งไปกรองเลย = ไฟล์โกหกขอบเขตตัวเอง
                   (เจอตอนไล่ตรวจคู่ของ check-inherited 15 ก.ย. 2569) */
                filters: [
                  ['ร้าน', storeLabel(store)],
                  q.trim()
                    ? ['คำค้นหาบนจอ', `${q.trim()} — ⚠️ ไฟล์นี้ไม่ได้กรองด้วยคำค้นนี้ (ท่อไม่รองรับ) ได้ทุกแถว`]
                    : ['คำค้นหา', '(ไม่ได้ค้น)'],
                ],
                /* 🔴 **เส้นนี้แบ่งหน้าด้วย `page=` ไม่ใช่ `offset=`** (แก้ 15 ก.ย. 2569 · ใบ t_mu2mc4jj)
                   เดิมส่ง `offset` ซึ่งท่อ **เมินเงียบ ๆ** ⇒ ขอหน้าถัดไปได้ก้อนเดิม
                   วันนั้นยังไม่ออกอาการเพราะใบเสนอราคามีแค่ 6 ใบ (จบในหน้าเดียว)
                   ⚠️ **ยิงยืนยันเองก่อนเปลี่ยน ไม่ได้เปลี่ยนตามคำบอกเล่าว่า deploy แล้ว**
                      (ฝั่งท่อกำชับข้อนี้เอง · ท่อ gucut-web 4951ad3)
                      ผล 15 ก.ย. 2569: `limit=2` หน้า 1/2/3 ได้ id คนละชุด รวม 6 ไม่ซ้ำ = `total` เป๊ะ
                      · หน้า 4 ว่าง · และ `offset` **ยังถูกเมินอยู่** (ยิงเทียบแล้วได้ก้อนเดิม)
                   📌 เพดานของท่อ: page 1–50 · limit สูงสุด 200 */
                fetchPage: async (offsetAt, limit) => {
                  const page = Math.floor(offsetAt / limit) + 1
                  /* 🔴 ไฟล์ต้องเป็นของร้านเดียวกับที่จอโชว์ (ลืมส่ง store ⇒ ได้ไฟล์ของ z1 เงียบ ๆ) */
                  const r = await fetch(`/api/web/core?list=quotations&limit=${limit}&page=${page}${store ? `&store=${store}` : ''}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                header: ['เลขที่ใบเสนอราคา', 'วันที่', 'ลูกค้า', 'เบอร์โทร', 'ยอด (บาท)', 'สถานะ', 'อ้างอิง'],
                toRow: (r: Row) => [
                  r.number, r.date ?? null, r.customer ?? null, r.phone || null,
                  typeof r.amount === 'number' ? r.amount : null, r.status ?? null, r.reference || null,
                ],
              }}
            />
            <ImportButton kind="quotation" />
            {/* ✅ ต่อของจริงแล้ว 6 ก.ย. 2569 — เจ้าของร้านอนุมัติ **เฉพาะใบเสนอราคา**
                (ไม่รวมเพิ่มสินค้า/ใบสั่งซื้อ) · จอปลายทางบังคับซ้อมก่อนส่งจริง */}
            <Link href="/core/quotations/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้าง
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => {}}
        placeholder="เลขรายการขาย ชื่อลูกค้า ช่องทางการขาย และอื่นๆ"
        /* ผัง ZORT มีลิงก์ "ค้นหาขั้นสูง" ตรงนี้ (ภาพ 51) — เดิมของเราเป็น "ล้างคำค้น"
           ตอนนี้เป็นของจริง: เปิดแผงกรองช่วงวันที่ (ปิดแถวที่ค้างในเช็คลิสต์ 7 ก.ย. 2569) */
        advanced={<AdvancedSearchLink open={adv} onToggle={() => setAdv((v) => !v)} />}
      />

      {/* ⚠️ ป้ายสถานะในแผงค้นหาของ ZORT เขียน **"สำเร็จ"** แต่ตารางเขียน **"อนุมัติแล้ว"**
          (ค่าดิบตัวเดียวกัน — ZORT เองใช้คำไม่ตรงกันระหว่างแผงกับตาราง)
          ⇒ ลอกคำจาก "ที่ที่มันอยู่" ทั้งสองที่ **ห้ามจัดให้ตรงกันเอง** เพราะลูกน้องจำคำจากจอที่เห็น */}
      <AdvancedSearch
        open={adv}
        fields={[
          { label: 'หมายเลขรายการ', kind: 'text', value: draft.number, onChange: (v) => setDraft({ ...draft, number: v }), placeholder: 'หมายเลขรายการ', width: 170 },
          { label: 'มูลค่าเริ่มต้น', kind: 'number', value: draft.amtFrom, onChange: (v) => setDraft({ ...draft, amtFrom: v }), placeholder: '0', width: 130 },
          { label: 'จนถึงมูลค่า', kind: 'number', value: draft.amtTo, onChange: (v) => setDraft({ ...draft, amtTo: v }), placeholder: '999,999', width: 130 },
          { label: 'อ้างอิง', kind: 'text', value: draft.ref, onChange: (v) => setDraft({ ...draft, ref: v }), placeholder: 'อ้างอิง', width: 150 },
          { label: 'ชื่อลูกค้า', kind: 'text', value: draft.cust, onChange: (v) => setDraft({ ...draft, cust: v }), placeholder: 'ชื่อลูกค้า', width: 170 },
          { label: 'เบอร์โทรศัพท์', kind: 'text', value: draft.phone, onChange: (v) => setDraft({ ...draft, phone: v }), placeholder: 'เบอร์โทรศัพท์', width: 150 },
          {
            label: 'สถานะ',
            kind: 'select',
            value: draft.status,
            onChange: (v) => setDraft({ ...draft, status: v }),
            options: [
              { value: '', label: 'ทั้งหมด' },
              { value: 'Pending', label: 'รออนุมัติ' },
              { value: 'Success', label: 'สำเร็จ' },
              { value: 'Voided', label: 'ยกเลิก' },
            ],
            width: 140,
          },
          { label: 'วันที่ ตั้งแต่', kind: 'date', value: draft.from, onChange: (v) => setDraft({ ...draft, from: v }) },
          { label: 'ถึง', kind: 'date', value: draft.to, onChange: (v) => setDraft({ ...draft, to: v }) },
        ] as AdvField[]}
        onApply={() => setFilt(draft)}
        onClear={() => { setDraft(EMPTY_F); setFilt(EMPTY_F); setQ('') }}
        canClear={advOn || Object.values(draft).some((v) => String(v).trim() !== '') || q.trim() !== ''}
        /* 🔴 **จอนี้ไม่มีตัวกรองฝั่งเซิร์ฟเวอร์เลย** (ท่อรับแต่ `store`/`page`/`limit`)
           ⇒ ห้ามใช้ช่อง serverFiltered เพราะประโยคของมันคือ "กรองที่เซิร์ฟเวอร์ ครอบทั้งชุด" = เท็จกับจอนี้ */
        /* ไม่รู้จำนวนทั้งชุด ⇒ ห้ามพูดว่า "เท่ากับกรองทั้งชุด" */
        clientFiltered={!รู้ทั้งชุด
          /* ⚠️ ช่องนี้รับ **ข้อความล้วน** ⇒ ใส่ ** แล้วมันโชว์ดอกจันจริง ๆ บนจอ (เห็นตอนตรวจด้วยท่อปลอม) */
          ? `กรองในเบราว์เซอร์จาก ${fmtNum(all.length)} ใบที่โหลดมา · ยังไม่รู้ว่าทั้งชุดมีกี่ใบ (ท่อไม่ได้บอกจำนวน) ⇒ ยังยืนยันไม่ได้ว่ากรองครบทั้งชุด`
          : cut > 0
          ? `กรองในเบราว์เซอร์จาก ${fmtNum(all.length)} ใบที่โหลดมา (ยังขาดอีก ${fmtNum(cut)} ใบ) · ท่อกรองให้เฉพาะร้าน (${storeLabel(store)})`
          : `กรองในเบราว์เซอร์ — โหลดมาครบทั้ง ${fmtNum(all.length)} ใบแล้ว จึงเท่ากับกรองทั้งชุด · ท่อกรองให้เฉพาะร้าน (${storeLabel(store)})`}
        notAvailable={[
          { what: 'Tag', why: 'ท่อยังไม่ส่งช่อง tag ของใบเสนอราคามา' },
          { what: 'สินค้า (รหัส/ชื่อ)', why: 'ท่อส่งแต่หัวใบ ยังไม่มีบรรทัดสินค้าในรายการนี้' },
          { what: 'ช่องทางการขาย', why: 'ท่อยังไม่ส่งช่องทางของใบเสนอราคามา (คอลัมน์บนตารางจึงเป็นขีด)' },
          { what: 'อีเมลลูกค้า', why: 'ท่อส่งแต่เบอร์โทร ไม่ส่งอีเมล' },
          { what: 'ผู้ใช้งาน (คนสร้างใบ)', why: 'ท่อยังไม่ส่งชื่อผู้สร้างของใบเสนอราคา' },
          /* 🔬 วัดเอง 18 ก.ย. 2569: จอ ZORT มีช่องติ๊ก "แสดงรายการที่ถูกซ่อน" (id=checkshowarchive ตัวเดียวกับจอผู้ติดต่อ)
             ติ๊กแล้วสั่งค้นหาใหม่ ⇒ ยังได้ **6 ใบเท่าเดิม** ⇒ ร้านนี้ไม่มีใบเสนอราคาที่ถูกซ่อนเลย
             ✅ วิธีเดียวกันนี้ใช้ได้จริง — ทดสอบคุมที่จอผู้ติดต่อ: ติ๊กแล้วจำนวนขยับ 28,344 → 31,514
                ⇒ เลข 6 ที่ไม่ขยับ **ไม่ใช่เพราะกดไม่ติด** แต่เพราะไม่มีใบที่ถูกซ่อนจริง ๆ
             ⚠️ ยังไม่รู้ว่า "อะไรทำให้ใบถูกซ่อน" (กติกาฝั่ง ZORT) — แต่วันนี้ยังไม่มีใบแบบนั้น จึงยังไม่กระทบใคร */
          { what: 'แสดงรายการที่ถูกซ่อน',
            why: 'ท่อไม่ได้ส่งสถานะ "ถูกซ่อน" มา · วัดจากจอ ZORT 18 ก.ย. 2569: ติ๊กช่องนั้นแล้วยังได้ 6 ใบเท่าเดิม '
              + '⇒ ร้านนี้ยังไม่มีใบที่ถูกซ่อน (ยังไม่รู้กติกาว่าใบแบบไหนถูกซ่อน แต่ตอนนี้ยังไม่มีผลกับใคร)' },
        ]}
        extraNote={advOn ? <>กรองแล้วเหลือ <b>{fmtNum(rows.length)}</b> ใบ จาก {fmtNum(all.length)} ใบที่โหลดมา</> : null}
      />

      {error && <ErrorBox title="ดึงใบเสนอราคาไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {/* ⚠️ ZORT มีปุ่มรีเฟรช (วงกลมลูกศร) อยู่ **มุมขวาของแถบแท็บ** ระดับเดียวกับ ทั้งหมด/อนุมัติแล้ว
              (ฝั่งท่อเปิดภาพ zort-ui/51 เจอ 5 ก.ย. 2569 — ผมเทียบรอบแรกแล้วมองข้าม)
              ของเรามีปุ่มรีเฟรชอยู่แล้วแต่ไปอยู่บนหัวจอ ⇒ **มีของครบแต่วางคนละที่**
              คนที่ชิน ZORT จะกวาดตาหาตรงนี้ ⇒ วางไว้ทั้งสองที่ ไม่ใช่ย้าย
              (ย้ายขึ้นไปที่เดียวก็ผิดผัง · ย้ายลงมาที่เดียวก็หายจากที่คนของเราชินอยู่) */}
          <div className="flex items-end justify-between gap-3">
            <Tabs
              tabs={[
                { id: '', label: 'ทั้งหมด', count: all.length },
                { id: 'approved', label: 'อนุมัติแล้ว', count: all.filter((r) => r.status === 'Success').length },
              ]}
              active={tab}
              onChange={setTab}
            />
            <button
              onClick={() => load()}
              disabled={loading}
              aria-label="โหลดใหม่"
              title="โหลดใหม่ — จอนี้ดึงสดจาก ZORT ทุกครั้ง"
              className="mb-2 shrink-0 w-7 h-7 grid place-items-center rounded border border-gray-300
                bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '⏳' : '⟳'}
            </button>
          </div>

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StorePicker value={store} disabled={loading}
            onChange={(v) => { setStore(v); load(v) }} />
          <StoreScopeLine scope={data?.storeScope} />
          {/* 🔴 ตรวจว่าท่อใช้ร้านเดียวกับที่จอขอจริง — เดิมส่ง store= ไปแล้วไม่เคยอ่านคำตอบ */}
          <StoreEcho ขอ={store} ได้={data?.store} ท่อเลือกให้={data?.storeDefaulted} />

          <TableWrap>
            <table className="w-full min-w-[780px]">
              {/* 🔃 ZORT `/Quotation/list` กดเรียงได้ 6 ช่อง (วัดจอจริง 16 ก.ย. 2569):
                  วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ — ของเรายังเรียงไม่ได้ (ท่อไม่รับ sort)
                  ⇒ ติด tooltip บอก ไม่ทำปุ่มหลอก */}
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">วันที่</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">รายการ</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">ลูกค้า</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">ช่องทาง</span></th>
                  <th className={THR}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">มูลค่า</span></th>
                  <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569) · ขอฝั่งท่อไว้แล้ว">สถานะ</span></th>
                  {/* ช่องว่างสำหรับเมนู ⋮ — ต้องมีหัวคอลัมน์ด้วย ไม่งั้นตารางเหลื่อมหนึ่งช่อง */}
                  <th className={TH} style={{ width: 36 }} aria-label="คำสั่ง" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={8} icon="📄" title="ไม่มีใบเสนอราคาในเงื่อนไขนี้"
                    detail={q || tab ? 'ลองล้างคำค้นหรือกลับไปแท็บทั้งหมด' : 'ยังไม่มีใบเสนอราคาใน ZORT'} />
                )}
                {rows.map((r, i) => (
                  <tr key={r.number} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.date ? thaiDate(r.date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TD}>
                      {/* กดเลขเข้ารายละเอียด (ZORT กดได้ — กวาดคลาส 8 ก.ย.) · ใบไร้ id = บอกตรง ๆ */}
                      {r.id !== null && r.id !== undefined
                        ? <Link href={`/core/quotations/detail?id=${encodeURIComponent(String(r.id))}`}
                            className="text-blue-600 font-medium hover:underline">{r.number}</Link>
                        : <span className="text-gray-900 font-medium" title="ใบนี้ ZORT ไม่ส่ง id มา — เปิดรายละเอียดไม่ได้">{r.number}</span>}
                    </td>
                    <td className={`${TD} max-w-[220px] truncate`} title={r.phone || ''}>
                      {/* ลิงก์ข้ามจอตาม ZORT: ชื่อลูกค้าในใบเสนอราคา → ContactDetail (8 ก.ย. 2569)
                          ⚠️ ชื่อที่แพลตฟอร์มปิดบัง (มี *) กดได้เหมือนกัน — จอปลายทางจะขึ้นกล่องเหลือง
                             อธิบายว่าจับคู่ประวัติไม่ได้ ดีกว่าปิดปุ่มเงียบ ๆ แล้วคนสงสัยว่าทำไมกดไม่ได้ */}
                      {r.customer ? (
                        <Link href={`/core/customers/detail?name=${encodeURIComponent(r.customer)}`}
                          className="text-blue-600 hover:underline">{r.customer}</Link>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    {/* ZORT มีคอลัมน์ช่องทาง แต่ทั้ง 3 ใบใน ZORT เองก็เป็นขีด และท่อก็ไม่ส่งช่องนี้มา
                        ⚠️ **อ่านจากข้อมูลไว้ก่อน อย่าเขียนขีดตาย** — วันไหนท่อส่ง `channel` มา
                           จอจะขึ้นเอง ไม่ต้องมีใครจำได้ว่าต้องกลับมาแก้ตรงนี้
                           (บทเรียน 4 ก.ย. 2569: คอลัมน์ Marketplace เขียนขีดตายไว้ข้ามวัน
                            ทั้งที่ท่อส่งข้อมูลมาแล้ว และไม่มีใครเห็นเพราะขีดหน้าตาเหมือนกันหมด) */}
                    <td className={TD}>
                      {r.channel || (
                        <span className="text-gray-300" title="ท่อยังไม่ส่งช่องทางของใบเสนอราคามา — ที่ ZORT เองก็เป็นขีดทุกใบ">-</span>
                      )}
                    </td>
                    <td className={TDR}>{fmtMoney(Number(r.amount) || 0)}</td>
                    <td className={TD}><Pill tone={toneOfStatus(r.status ?? '')}>{statusTh(r.status)}</Pill></td>
                    {/* ⚠️ ZORT มีเมนู ⋮ ท้ายแถว (ยืนยันจากภาพจอจริง zort-ui/51 · ตรวจสองคนแล้ว 5 ก.ย. 2569)
                        ของเราไม่มีคำสั่งอะไรให้ทำกับใบเสนอราคาเลย — จอนี้ดึงสดจาก ZORT อ่านอย่างเดียว
                        แก้/ลบ/อนุมัติ ต้องทำใน ZORT ⇒ เมนูที่กดแล้วว่างเปล่าคือเมนูหลอก
                        **แต่ซ่อนทิ้งก็ไม่ได้** คนที่ชิน ZORT จะกวาดตาหาช่องขวาสุดแล้วไม่เจอ
                        แล้วนึกว่าจอเราโหลดไม่ครบ ⇒ โชว์ตามผังแต่ล็อกไว้พร้อมเหตุผล
                        (ท่าเดียวกับไอคอนสลับมุมมองในจอสินค้า และปุ่ม "จัดการร้าน" ในจอ Marketplace) */}
                    <td className={`${TD} text-right`}>
                      <span title="ZORT มีเมนูคำสั่งท้ายแถว — จอนี้อ่านอย่างเดียว ดึงสดจาก ZORT ทุกครั้ง แก้ไขต้องทำใน ZORT"
                        className="text-gray-300 cursor-not-allowed select-none">⋮</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {/* 🔴 **ต้องขึ้นตอน "ยังไม่รู้จำนวนทั้งชุด" ด้วย ไม่ใช่เฉพาะตอนรู้ว่าขาด** (แก้ 18 ก.ย. 2569)
              เดิมกรณี "ท่อไม่บอก total" มีคำเตือนอยู่ที่ **แผงค้นหาขั้นสูง** อย่างเดียว
              ซึ่ง `AdvancedSearch` คืน null เมื่อแผงพับปิด — และมันพับปิดเป็นค่าเริ่มต้น
              ⇒ คำเตือนที่ตั้งใจเขียนไว้ **ไม่มีใครเห็นเลย** จนกว่าจะกดเปิดแผง
              (โรคเดิมที่ CLAUDE.md จดไว้: "เมนูที่ผมทำไว้หายไปไหน" — ของอยู่ครบ แค่พับปิด) */}
          {(cut > 0 || !รู้ทั้งชุด) && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border-t border-gray-200 px-4 py-2.5 leading-relaxed">
              {รู้ทั้งชุด ? (
                <>
                  ตารางนี้แสดง <b>{all.length}</b> จาก <b>{Number(data!.total)}</b> ใบ
                  — ขาดอีก <b>{cut}</b> ใบ (ท่อคืนได้สูงสุด 200 แถวต่อครั้ง และจอนี้ยังไม่มีการแบ่งหน้า)
                  ⇒ <b>ยอดรวมด้านบนจึงต่ำกว่าความจริง</b>
                </>
              ) : (
                <>
                  ตารางนี้แสดง <b>{all.length}</b> ใบที่โหลดมาได้ — <b>ท่อไม่ได้บอกว่าทั้งชุดมีกี่ใบ</b>
                  {' '}⇒ <b>ยังยืนยันไม่ได้ว่าครบ</b> และยอดรวมด้านบนอาจต่ำกว่าความจริง
                  {' '}(ไม่ใช่ว่าโหลดครบแล้ว — คนละเรื่องกัน)
                </>
              )}
            </p>
          )}

          {/* แถบท้ายตารางตามผัง ZORT (`zort-ui/51-zort-ใบเสนอราคา.jpg`)
              ซ้าย: ปุ่มหน้า · ขวา: "จำนวน N รายการ | จำนวนต่อหน้า [20]"
              ⚠️ **ปุ่มหน้ากับจำนวนต่อหน้าเป็นสีเทา** — จอนี้ดึงครั้งเดียวไม่มีการแบ่งหน้า
                 ทำให้กดได้ทั้งที่ไม่มีหน้าที่ 2 = ปุ่มหลอก · ซ่อนทิ้ง = ผังไม่ตรง
                 ⇒ โชว์ตามผังแต่ล็อกไว้ พร้อมเหตุผลตอนชี้ค้าง (ท่าเดียวกับ dropdown คลังสินค้า) */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span
              title="จอนี้ดึงใบเสนอราคาครั้งเดียวทั้งหมด จึงมีหน้าเดียวเสมอ"
              className="text-[13px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-2.5 py-1 cursor-not-allowed"
            >
              1
            </span>
            <span className="ml-auto text-[12.5px] text-gray-500">
              จำนวน {fmtNum(Number(data.total ?? all.length))} รายการ
            </span>
            <span className="text-[12.5px] text-gray-400">| จำนวนต่อหน้า</span>
            <select
              disabled
              title="จอนี้ดึงครั้งเดียวทั้งหมด ยังไม่มีการแบ่งหน้า — เลือกได้ก็ไม่มีอะไรเปลี่ยน"
              className="text-[12.5px] border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-400 cursor-not-allowed"
            >
              <option>ทั้งหมด</option>
            </select>
          </div>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            {/* 🔴 **ประโยคนี้กลายเป็นเท็จตั้งแต่ 733055e** (เจอ 15 ก.ย. 2569 · ใบ t_mu1wvgcw)
                เขียนว่า "ZORT มีปุ่ม Export to Excel — ยังไม่ได้ทำ" ทั้งที่ปุ่มส่งออกของจอนี้
                อยู่บนหัวจอเดียวกันนี้แล้ว และใช้งานได้จริง (ยิงจริงได้ไฟล์ 6 แถว)
                ⇒ คนอ่านย่อหน้าท้ายจอแล้วเชื่อว่ายังไม่มี ทั้งที่ปุ่มอยู่ห่างไปสองนิ้วข้างบน */}
            ป้ายสถานะจอนี้เขียนว่า <b>รออนุมัติ / อนุมัติแล้ว</b> ตามจอ ZORT —
            ค่าดิบเป็น Pending/Success ชุดเดียวกับใบขาย แต่ในบริบทใบเสนอราคาแปลว่า<b>การอนุมัติ</b>
            ไม่ใช่การส่งของ · <b>เบอร์ลูกค้าดูได้จากการชี้ค้างที่ชื่อ</b> ไม่แสดงตรง ๆ บนตาราง
          </p>
        </>
      )}
    </div>
  )
}
