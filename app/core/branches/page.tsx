'use client'
// คลังสินค้า/สาขา — **หน้าตาลอกจาก `zort-ui/25-zort-คลังสินค้า-สาขา.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ" → ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มคลังสินค้า/สาขา
//      → ช่องค้นหา → แถบเทาบอกวันที่อัพเดทมูลค่า
//      → ตาราง # · รหัส · ชื่อคลัง/สาขา · ประเภท · มูลค่าสินค้าคงเหลือ · เคลื่อนไหวล่าสุด · ⋮
//
// ⚠️ **"คลัง" กับ "สาขาที่เปิดบิลได้" ไม่ใช่สิ่งเดียวกัน — ห้ามรวมกัน**
//    ZORT มี 3 คลัง แต่ **โกดังไม่ใช่จุดขาย** ⇒ POS เปิดบิลได้แค่ 2 แห่ง
//    รวมกันเมื่อไหร่ จะมีคนเปิดบิลขายจากโกดังได้ ซึ่งไม่ตรงกับที่ร้านทำจริง
//    ⇒ อ่านธง `isPos` จากเซิร์ฟเวอร์ **ห้ามเดาจากรหัส** วันหนึ่งร้านเพิ่มคลัง
//      รหัสจะไม่ใช่ KLD/ANJ อีก แล้วการเดาจะพังเงียบ ๆ
import { HEAD_BTN } from '@/components/zort/headBtn'
import { useCallback, useEffect, useState } from 'react'
import SortHead, { type สถานะเรียง } from '@/components/zort/SortHead'
import { parseUtc, thaiDayTime } from '@/components/zort/DataFreshness'
import Link from 'next/link'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'
import { thaiDateTime } from '@/components/zort/PushStatusBoard'
import ExportButton from '@/components/zort/ExportButton'
import ZortFoldIf from '@/components/zort/ZortFoldIf'
import AdvancedSearch, { AdvancedSearchLink } from '@/components/zort/AdvancedSearch'
import { SearchRow } from '@/components/zort'
import { TH_NO, ROW_LINK, TD_NO,
  PageHead, TableWrap, TH, THR, TD, TDR, RowMenu, EmptyState, thaiDate,
} from '@/components/zort'

interface Warehouse {
  code: string; name: string; province?: string; isPos?: boolean
  /** มูลค่าสินค้าคงเหลือของคลังนั้น — ✅ ท่อส่งมาแล้ว 15 ก.ย. 2569 (gucut-web · ตัวคัดบน g1 ทุกชั่วโมง)
   *  🔴 `null`/ไม่ส่งมา = **ยังไม่เคยคัด** ⇒ ห้ามแสดง 0 (0 เป็นค่าจริงของคลังที่ไม่มีของ — ANJ เป็น 0 จริง) */
  stockValue?: number | null
  /** วันที่คลังนั้นเคลื่อนไหวล่าสุด — ISO พร้อมเขต +07:00 (เช่น 2026-09-15T11:48:00+07:00)
   *  ⇒ `slice(0,10)` ได้วันไทยถูกต้อง ไม่เพี้ยนตอนเช้ามืด (ฝั่งท่อยืนยันสัญญานี้ไว้) */
  movedAt?: string
  /** เวลาที่ตัวคัดไปอ่านจอ ZORT มาล่าสุด — **UTC ดิบ** 'YYYY-MM-DD HH:MM:SS'
   *  ⇒ ต้อง +7 แล้วเขียนกำกับว่าเป็นเวลาไทย และ **แสดงคู่กับตัวเลขเสมอ**
   *     เพราะมูลค่าขยับได้ทั้งวัน — เลขที่ไม่มีเวลากำกับจะถูกอ่านว่าเป็นของสด */
  valueCollectedAt?: string
}
interface WarehouseSales { code: string; orders: number; amount: number }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/** เหตุที่ช่อง ☐ แสดงคลังสินค้าที่ถูกลบ ปิดไว้ — GET list=warehouses 20 ต.ค. 2569 ได้ 3 คลัง ช่อง code/name/province/stockValue/movedAt/valueCollectedAt/collectedDayTH/isPos
 *  ⇒ ไม่มีช่องบอกว่าคลังไหนถูกลบ และไม่รู้ว่าท่อรวมคลังที่ลบแล้วมาด้วยไหม */
const คลังที่ถูกลบยังไม่รู้ = 'ท่อส่งรายชื่อคลังมาโดยไม่มีช่องบอกว่าคลังไหนถูกลบ — ยังแยกไม่ได้ (ไม่ใช่ว่าไม่มีคลังที่ถูกลบ)'

/** เกณฑ์ที่ถือว่ารอบคัดมูลค่าค้าง (ชม.) — ตัวคัดวิ่งทุกชั่วโมง ⇒ ข้ามไป 2 รอบติดยังไม่เตือน เกิน 3 ชม. เตือน · ที่เดียว ใช้ทั้งสองโหมด */
const เกณฑ์คัดค้างชม = 3

export default function CoreBranchesPage() {
  const [rows, setRows] = useState<Warehouse[]>([])
  const [note, setNote] = useState('')
  /** ยอดขาย 30 วันรายคลัง **จากคลังที่ผูกกับใบจริง** (`list=orderfacets&warehouses=1`)
   *  🔴 แทนการเดาจากชื่อช่องทางแล้ว (17 ก.ย. 2569 · A4 ในใบสำรวจ t_mu5bhh84) — ดูเหตุผลที่ statOf */
  const [byWarehouse, setByWarehouse] = useState<WarehouseSales[]>([])
  /** ยอดของใบที่ยังไม่รู้คลัง ("" จากท่อ) — ต้องบอกบนจอ ไม่งั้นผลรวมรายคลังดูน้อยกว่ายอดจริงโดยไม่มีเหตุผล */
  const [unknownWh, setUnknownWh] = useState<WarehouseSales | null>(null)
  /** ⚠️ **ต้องมีตัวนี้ ไม่ใช่ดูแค่ byChannel.length** — ระหว่างที่ยอดขายยังไม่มา
   *  `statOf` จะคืน 0 ทุกคลัง แล้วช่องขึ้น "0 ใบ · ฿0" ซึ่งอ่านว่า **"คลังนี้ 30 วันขายไม่ได้เลย"**
   *  นั่นคือการโกหกในช่วงโหลด — เป็นราคาที่ต้องจ่ายถ้าจะวาดจอก่อนข้อมูลครบ ⇒ ต้องเขียนว่า "กำลังโหลด" */
  const [salesLoading, setSalesLoading] = useState(true)
  /** ⚠️ **ยิงยอดขายพลาด ≠ ขายไม่ได้** — เจอตอนไล่อ่านโค้ดตัวเองซ้ำ 5 ก.ย. 2569
   *  เดิมพอยิงพลาด salesLoading เป็น false แล้ว byChannel ว่าง ⇒ ช่องขึ้น "0 ใบ · ฿0"
   *  ซึ่งอ่านว่า **คลังนี้ 30 วันขายไม่ได้เลย** = ตัวเลขผิดที่หน้าตาปกติทุกประการ
   *  (ผมกันเคส "กำลังโหลด" ไว้แล้ว แต่ลืมเคส "โหลดไม่สำเร็จ" ซึ่งจบลงที่หน้าตาเดียวกัน) */
  const [salesFailed, setSalesFailed] = useState(false)
  const [q, setQ] = useState('')
  const [เรียง, setเรียง] = useState<สถานะเรียง>(null)
  const [ต่อหน้า, setต่อหน้า] = useState(20)
  const [หน้า, setหน้า] = useState(0)
  /* 🔍 ค้นหาขั้นสูงแบบ ZORT (แผง searchAdvance ของ /Warehouse/list — อ่าน DOM ที่ซ่อนอยู่ 20 ต.ค. 2569):
     รหัสคลัง/สาขา · ชื่อคลัง/สาขา · ☐ แสดงคลังสินค้าที่ถูกลบ
     กรองในเบราว์เซอร์จาก **รายชื่อคลังทั้งหมด** (ท่อส่งครบทุกคลังในครั้งเดียว ไม่มีแบ่งหน้า) ⇒ ไม่ใช่กรองแค่หน้าที่เห็น */
  const [advOpen, setAdvOpen] = useState(false)
  const [advCode, setAdvCode] = useState('')
  const [advName, setAdvName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ท่อบอกว่ารอบคัดมูลค่าล่าสุดพลาด — **ต้องขึ้นจอ ไม่ใช่เงียบ**
   *  (อ่านมูลค่าไม่ได้ ≠ คลังไม่มีของ — ถ้าเงียบ คนจะอ่านตัวเลขเก่าว่าเป็นของวันนี้) */
  const [valuesError, setValuesError] = useState('')

  /** เวลาที่คัดมูลค่าล่าสุด → ข้อความเวลาไทย · ท่อส่งมาเป็น **UTC ดิบ** จึงต้อง +7 เอง
   *  ⚠️ ทุกคลังคัดรอบเดียวกัน ⇒ เอาค่าแรกที่มีก็พอ · ไม่มีเลย = ไม่รู้ (คืน '' แล้วจอเขียนว่าไม่รู้)
   *  🔴 ใช้ `parseUtc`/`thaiDayTime` ตัวกลาง ไม่เขียนสูตร +7 ใหม่ (Intl บางรุ่น throw — เคยทำหน้าคนเข้าเว็บพังมาแล้ว) */
  const valueCollectedAt = (() => {
    const raw = rows.find((w) => w.valueCollectedAt)?.valueCollectedAt
    const d = parseUtc(raw)
    return d ? thaiDayTime(d) : ''
  })()
  /** 🔴 อายุของรอบคัด (ชม.) — จอบอกว่า "ตัวคัดวิ่งทุกชั่วโมง เก่ากว่า ZORT เล็กน้อย" แต่ 21 ต.ค. 2569 13:30 เจอค่าคัด 19/10 17:51 (~44 ชม.)
   *  ⇒ ถ้อยคำ "เล็กน้อย" กลายเป็นคำยืนยันเท็จ ⇒ เกิน เกณฑ์คัดค้าง ต้องขึ้นคำเตือนบนจอ (ไม่ใช่ใน title) · null = ไม่รู้เวลาคัด (มีข้อความของมันเองแล้ว) */
  const อายุคัดชม = (() => {
    const d = parseUtc(rows.find((w) => w.valueCollectedAt)?.valueCollectedAt)
    return d ? Math.max(0, (Date.now() - d.getTime()) / 3600e3) : null
  })()
  const คัดค้าง = อายุคัดชม !== null && อายุคัดชม > เกณฑ์คัดค้างชม
  const คำเตือนคัดค้าง = คัดค้าง && (
    <span className="block text-[12.5px] text-amber-800 mt-0.5">
      ⚠️ ค่านี้คัดมาแล้ว {Math.floor(อายุคัดชม as number).toLocaleString('th-TH')} ชม. — นานกว่ารอบปกติ (ทุกชั่วโมง) ⇒ รอบคัดหลังจากนั้นไม่เข้ามา · มูลค่าอาจต่างจากจอ ZORT ตอนนี้มาก
    </span>
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      /* 🔴 **เดิมรอทั้งสองเส้นก่อนวาดอะไรเลย ⇒ จอช้าเท่าเส้นที่ช้าที่สุดเสมอ**
         วัดของจริง 5 ก.ย. 2569: `list=warehouses` 2.1 วิ · `list=orders` **4.2 วิ**
         ⇒ ตารางคลัง (เนื้อหาหลักของจอ) ถูกกักไว้อีก 2 วินาทีเพื่อรอ "คอลัมน์ยอดขาย" ซึ่งเป็นของประกอบ
         ตอนนี้แยกกัน: ตารางขึ้นทันทีที่คลังมา · คอลัมน์ยอดขายเติมทีหลังเอง
         ⚠️ ยังยิงพร้อมกันเหมือนเดิม (ไม่ได้เปลี่ยนเป็นเรียง) แค่ **ไม่รอกันก่อนวาด**
         ⚠️ `list=orders&limit=1` ช้าเท่า limit=200 เป๊ะ (วัดแล้ว 4.15 vs 4.21 วิ)
            ⇒ ขอแถวเดียวไม่ได้ช่วยอะไร ต้นทุนอยู่ที่รอบไปกลับ D1 ไม่ใช่ขนาดข้อมูล */
      setSalesLoading(true)
      setSalesFailed(false)
      const salesSoon = fetch(`/api/web/core?list=orderfacets&from=${thaiDay(30)}&to=${thaiDay(0)}&warehouses=1`)
        .then((r) => r.json())
        .then((cRes) => {
          /* ⚠️ ไม่มีช่อง byWarehouse = ท่อรุ่นเก่า/ตอบไม่ครบ ⇒ ถือว่าล้ม (ขึ้น ?) ห้ามตกเป็น 0 */
          if (!Array.isArray(cRes?.byWarehouse)) throw new Error('ไม่มี byWarehouse')
          const all = cRes.byWarehouse.map((w: { code?: string; orders?: number; amount?: number }) =>
            ({ code: String(w.code ?? ''), orders: Number(w.orders) || 0, amount: Number(w.amount) || 0 }))
          setByWarehouse(all.filter((w: WarehouseSales) => w.code))
          setUnknownWh(all.find((w: WarehouseSales) => !w.code && (w.orders > 0 || w.amount > 0)) ?? null)
        })
        .catch(() => { setSalesFailed(true) /* ล้มก็แค่คอลัมน์นี้ ไม่ล้มทั้งจอ — แต่ต้องบอกว่าล้ม */ })
        .finally(() => setSalesLoading(false))

      const wRes = await fetch('/api/web/core?list=warehouses').then((r) => r.json())
      if (wRes?.error) throw new Error(wRes.error)
      /* 🔴 ตอบ 200 แต่ไม่มีช่อง warehouses = ยังไม่รู้ ไม่ใช่ "ร้านไม่มีคลังสักแห่ง"
         ⚠️ `skip` มาก่อนเสมอ — เป็นสถานะ "ทำต่อไม่ได้" ไม่ใช่ error (สัญญาฝั่งท่อ 6 ก.ย. 2569) */
      if (typeof wRes?.skip === 'string' && wRes.skip) throw new Error(SKIP + wRes.skip)
      if (!wRes || !('warehouses' in wRes)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายชื่อคลัง)')
      setRows(Array.isArray(wRes?.warehouses) ? wRes.warehouses : [])
      setNote(typeof wRes?.note === 'string' ? wRes.note : '')
      /* ⚠️ เช็คด้วย "มีค่าไหม" ไม่ใช่ "มีคีย์ไหม" — ท่อส่ง `valuesError: null` มาตอนปกติ */
      setValuesError(wRes?.valuesError ? String(wRes.valuesError) : '')
      setLoading(false) // ← ตารางขึ้นได้แล้ว ไม่ต้องรอยอดขาย
      // ⚠️ ต้อง await ไว้ท้ายสุด ไม่งั้นเป็น promise ลอย (กติกาเหล็กของโปรเจกต์)
      await salesSoon
    } catch (e) {
      setRows([])
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** ยอดขาย 30 วันของคลังนั้น — **จากคลังที่ผูกกับใบจริง** (ท่อเก็บ warehouse_code ของใบ)
   *
   *  🔴 **เดิมเดาจากชื่อช่องทางที่มีรหัสคลัง (เช่น "POS KLD")** — วัดจริง 17 ก.ย. 2569:
   *     ชื่อช่องทาง 30 วันล่าสุด **ไม่มีสักชื่อที่มีรหัส NEW/KLD/ANJ** ⇒ จอขึ้น KLD "0 ใบ · ฿0" · ANJ "0 ใบ · ฿0"
   *     ทั้งที่ของจริง KLD 73 ใบ ฿51,738 · ANJ 218 ใบ ฿59,289 (NEW 595 ใบ ฿574,983 · รวม 886 = ยอดทั้งช่วงพอดี)
   *     = ตัวเลขผิดที่หน้าตาปกติทุกประการ ซึ่งคอมเมนต์เดิมเตือนไว้แล้วว่าวันที่ชื่อเปลี่ยนจะพังเงียบ
   *  คลังที่ไม่อยู่ในรายการ = ช่วงนี้ไม่มีใบจริง (ผลรวมทุกแถวของท่อ = ยอดทั้งช่วง) ⇒ 0 เป็นค่าจริง */
  const statOf = (code: string) => {
    const hit = byWarehouse.find((w) => w.code.toUpperCase() === String(code).toUpperCase())
    return { orders: hit?.orders ?? 0, amount: hit?.amount ?? 0 }
  }

  const มี = (ค่า: unknown, คำ: string) => String(ค่า ?? '').toLowerCase().includes(คำ.trim().toLowerCase())
  const กรองแล้ว = rows
    .filter((r) => !q.trim() || มี(`${r.code} ${r.name}`, q))
    .filter((r) => !advCode.trim() || มี(r.code, advCode))
    .filter((r) => !advName.trim() || มี(r.name, advName))
  /* ↕️ หัว รหัส · ชื่อคลัง/สาขา กดเรียงแบบ ZORT (DOM /Warehouse/list 21 ต.ค. 2569: สองหัวนี้เป็นลิงก์เรียง)
     ท่อส่งคลังมาครบในคำขอเดียว ⇒ เรียงในเครื่องคือเรียงทั้งชุดจริง · ยังไม่กด = ลำดับเดิมของท่อ */
  const list = !เรียง ? กรองแล้ว : [...กรองแล้ว].sort((a, b) => (เรียง.dir === 'asc' ? 1 : -1)
    * String(เรียง.sort === 'code' ? a.code : a.name ?? '').localeCompare(String(เรียง.sort === 'code' ? b.code : b.name ?? ''), 'th'))
  /* 📄 แถบหน้าแบบ ZORT (โหมดเหมือน ZORT) — จำนวนต่อหน้าตัดแถวจริง ไม่ใช่ตัวเลือกประดับ */
  const หน้าละ = เหมือนZORT ? ต่อหน้า : Math.max(1, list.length)
  const จำนวนหน้า = Math.max(1, Math.ceil(list.length / หน้าละ))
  const หน้าปัจจุบัน = Math.min(หน้า, จำนวนหน้า - 1)
  const แถวที่เห็น = list.slice(หน้าปัจจุบัน * หน้าละ, (หน้าปัจจุบัน + 1) * หน้าละ)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="คลังสินค้า/สาขา"
        /* 🔴 ดึงไม่ได้ **ห้ามเขียน "จำนวน 0 รายการ"** — หัวจอจะขัดกับกล่องแดงข้างล่างทันที
           และคนอ่านหัวจอก่อนเสมอ (เจอด้วยท่อปลอม 6 ก.ย. 2569) */
        summary={error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง') : `จำนวน ${fmtNum(rows.length)} รายการ`}
        actions={
          <>
            {/* 🔁 ปุ่ม "รีเฟรช" บนหัวจอเอาออก 16 ต.ค. 2569 — ZORT /Warehouse/list ไม่มี (ปุ่ม: นำเข้าไฟล์ · เพิ่มคลังสินค้า/สาขา · Export to Excel) */}
            {/* 🔴 **ถอดปุ่ม "นำเข้าไฟล์ (Excel)" ออก** (15 ก.ย. 2569)
                เดิมชี้ไป `?kind=product` ทั้งที่จอนี้แสดงคลัง/สาขา ไม่ใช่สินค้า
                ⇒ คนกดเพราะอยากนำเข้าคลัง/สาขา แต่ไปโผล่หน้านำเข้า**สินค้า** ซึ่งคอลัมน์คนละชุด
                ⇒ ปุ่มที่กดแล้วเกิดอะไรขึ้นจริงแต่ไม่ใช่สิ่งที่คนตั้งใจ **หลอกกว่าปุ่มที่กดแล้วเงียบ**
                ⇒ หน้านำเข้ายังไม่รับชนิดนี้ ⇒ ไม่มีปุ่ม (ฝั่งท่อกำชับ: ชนิดที่ยังไม่รับ อย่าให้ปุ่มโผล่) */}
            <Link href="/core/branches/new"
              className={HEAD_BTN}
              style={{ background: '#4165ed' }}>
              เพิ่มคลังสินค้า/สาขา
            </Link>
          </>
        }
      />

      {/* 📐 โหมดเหมือน ZORT: ระยะช่องค้นหาเดียวกับ SearchRow ร่วม (pt-1 mb-5) — ตารางเริ่มตำแหน่งเดียวกับ ZORT */}
      {เหมือนZORT ? (
        <>
          {/* 📐 โหมดเหมือน ZORT: แถวค้นหาตัวกลาง (แว่นขยาย · เว้นซ้าย 42) + ลิงก์ ค้นหาขั้นสูง แบบ /Warehouse/list */}
          <SearchRow value={q} onChange={setQ} onSubmit={() => {}} placeholder="พิมพ์คำค้นหา"
            advanced={<AdvancedSearchLink open={advOpen} onToggle={() => setAdvOpen((v) => !v)} />} />
          <AdvancedSearch
            open={advOpen}
            fields={[
              { label: 'รหัสคลัง/สาขา', kind: 'text', value: advCode, onChange: setAdvCode, placeholder: 'รหัสคลัง/สาขา', width: 160 },
              { label: 'ชื่อคลัง/สาขา', kind: 'text', value: advName, onChange: setAdvName, placeholder: 'ชื่อคลัง/สาขา', width: 200 },
              { label: 'แสดงคลังสินค้าที่ถูกลบ', kind: 'check', value: false, onChange: () => {}, ปิดไว้: คลังที่ถูกลบยังไม่รู้ },
            ]}
            onApply={() => {}}
            onClear={() => { setAdvCode(''); setAdvName('') }}
            canClear={!!(advCode || advName)}
            applyLabel="ค้นหา"
            clientFiltered="กรองในเบราว์เซอร์จากรายชื่อคลังทั้งหมดที่ท่อส่งมา (ครบทุกคลัง ไม่ได้กรองแค่หน้าที่เห็น) · พิมพ์แล้วตารางเปลี่ยนทันที"
            notAvailable={[{ what: 'แสดงคลังสินค้าที่ถูกลบ', why: คลังที่ถูกลบยังไม่รู้ }]}
          />
        </>
      ) : (
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา"
          className="w-full max-w-[400px] h-10 text-[14px] text-[#3e3e3e] border border-[#adb5bd] rounded-[24px] px-4 py-2 outline-none focus:border-[#868e96]"
        />
      </div>
      )}

      {error && <ErrorBox title="ดึงรายชื่อคลังไม่ได้">{error}</ErrorBox>}
      {loading && rows.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          {/* 📐 โหมดเหมือน ZORT — กล่องเดียวกับจอหมวดหมู่ (วัด DOM /Product/Categorylist · /Warehouse/list ผังเดียวกัน):
              กล่องขาว p-3 ขอบมน 6 มีเงา · Boon 16 #3e3e3e · บรรทัดเดียว "มูลค่าสินค้าคงเหลือ + เวลาคัด" คำอธิบายเข้า ⓘ
              ⚠️ ถ้าไม่รู้เวลาคัด หรือรอบคัดอ่านไม่สำเร็จ ยังขึ้นบนจอเหมือนเดิม (ห้ามซ่อน) */}
          {เหมือนZORT && valueCollectedAt && !valuesError ? (
            <div className="bg-white shadow rounded-[6px] px-4 py-[14px] mb-5 text-[16px] text-[#3e3e3e] flex items-center justify-between gap-3">
              <span>
              มูลค่าสินค้าคงเหลือ คัดล่าสุด: {valueCollectedAt}{' '}
              <span className="text-gray-400 cursor-help text-[14px]"
                title="มูลค่าสินค้าคงเหลือรายคลังคัดมาจากจอ ZORT ไม่ใช่คิดจากคลังเงา (เวลาไทย) · ตัวคัดวิ่งทุกชั่วโมง ⇒ ซื้อของเข้าหรือโอนของระหว่างรอบ เลขจะเก่ากว่าจอ ZORT เล็กน้อยเสมอ">ⓘ</span>
              {คำเตือนคัดค้าง}
              </span>
              {/* ZORT มีปุ่ม "อัพเดท" (สั่งให้ ZORT คำนวณมูลค่าใหม่) — ของเราสั่ง ZORT ไม่ได้ ⇒ สีเทาพร้อมเหตุ ไม่ใช่ปุ่มหลอก */}
              <span title="ยังทำไม่ได้ — สั่งให้ ZORT คำนวณมูลค่าใหม่ต้องกดที่ ZORT · ของเรารอรอบคัดถัดไป (ทุกชั่วโมง)"
                className="inline-flex items-center bg-white border border-[#ced4da] rounded-[3px] px-2 h-[27px] text-[13px] font-bold font-['Lato',sans-serif] text-gray-400 cursor-not-allowed shrink-0">⟳ อัพเดท</span>
            </div>
          ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 text-[12.5px] text-gray-700">
            {/* 🕰 **คำเดิมตรงนี้กลายเป็นเท็จแล้ว — แก้ 15 ก.ย. 2569**
                เคยเขียนว่า "ยังไม่ได้ดึงมา · คลังเงายังไม่ได้แยกตามคลัง"
                ตอนนี้ท่อส่ง `stockValue` · `movedAt` · `valueCollectedAt` ครบทั้ง 3 คลังแล้ว
                (ตัวคัดบน g1 อ่านจากจอ ZORT ทุกชั่วโมง — ไม่ใช่คิดจากคลังเงา)
                ⚠️ คำเตือนที่หมดอายุอันตรายกว่าไม่มีคำเตือน: คนอ่านจะเลี่ยงตัวเลขที่ใช้ได้จริง
                ⚠️ และเลขนี้ **ห้ามแสดงลอย ๆ ไม่มีเวลา** — มูลค่าขยับทั้งวัน
                   (วัดเอง 15 ก.ย.: 11:0x อ่านได้ 16,306,984.11 · 12:4x ท่อคัดได้ 16,305,522.84) */}
            มูลค่าสินค้าคงเหลือรายคลัง <b>คัดมาจากจอ ZORT</b> ไม่ใช่คิดจากคลังเงา
            {valueCollectedAt
              ? <> · <b>คัดล่าสุด {valueCollectedAt} (เวลาไทย)</b></>
              : <> · <b className="text-amber-700">ยังไม่รู้ว่าคัดเมื่อไหร่</b> — ท่อไม่ได้บอกเวลา</>}
            {' '}· ตัวคัดวิ่งทุกชั่วโมง ⇒ ซื้อของเข้าหรือโอนของระหว่างรอบ เลขจะเก่ากว่าจอ ZORT เล็กน้อยเสมอ
            {คำเตือนคัดค้าง}
            {valuesError && (
              <span className="block mt-1 text-amber-900">
                ⚠️ <b>รอบคัดล่าสุดอ่านมูลค่าไม่สำเร็จ</b> ({String(valuesError)})
                {' '}⇒ ตัวเลขที่เห็นอาจเป็นของรอบก่อน หรือไม่มีเลย — <b>ไม่ใช่ว่าคลังไม่มีของ</b>
              </span>
            )}
          </div>
          )}

          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH_NO} style={{ width: 44 }}>#</th>
                  <th className={TH}><SortHead label="รหัส" field="code" firstDir="asc" current={เรียง} supported={rows.length > 0} onSort={setเรียง} fallbackTitle="กำลังโหลดรายชื่อคลัง" /></th>
                  <th className={TH}><SortHead label="ชื่อคลัง/สาขา" field="name" firstDir="asc" current={เรียง} supported={rows.length > 0} onSort={setเรียง} fallbackTitle="กำลังโหลดรายชื่อคลัง" /></th>
                  <th className={TH}>ประเภท</th>
                  <th className={THR}>มูลค่าสินค้าคงเหลือ</th>
                  {/* ✅ ท่อส่งข้อมูลช่องนี้แล้ว 15 ก.ย. 2569 (`movedAt`)
                      🔴 **คำเดิมตรงนี้เดาสาเหตุของสี — แก้แล้ว**
                         เคยเขียนว่า "ZORT ขึ้นแดงเมื่อคลังนั้นไม่ขยับนาน"
                         อ่านสีจาก DOM จริงแล้วพบว่า **แยกสาเหตุไม่ออก**:
                         NEW (วันนี้) เทา rgb(62,62,62) · KLD (3 สัปดาห์) เทา · **ANJ แดง rgb(242,87,87)**
                         แต่ ANJ เป็นทั้งแถวที่เก่าสุด **และ** แถวที่มูลค่าเป็น 0 ⇒ มีแดงแถวเดียว
                         ⇒ เกณฑ์อาจเป็น "เก่าเกิน N วัน" หรือ "คลังไม่มีของ" ก็ได้
                      ⇒ **ยังไม่ทำสีคอลัมน์นี้** · ตั้งเกณฑ์วันเองแล้วจะเป็นการเดาที่ดูเหมือนลอกมา
                         ต้องรอเจอคลังที่สี่ (เก่านาน แต่มีของ) หรือถามฝั่ง ZORT ก่อน */}
                  <th className={TH}>เคลื่อนไหวล่าสุด</th>
                  {/* 🔵 **สองคอลัมน์นี้ ZORT ไม่มี — เราเพิ่มเอง** (ตกลงกับฝั่งท่อ 4 ก.ย. 2569)
                      เหตุผลที่เก็บไว้: กฎ "เหมือน ZORT 100%" มีไว้กันคนใช้ต้องเรียนใหม่
                      ⇒ อันตรายคือ**ย้ายของเดิม** ไม่ใช่**เพิ่มของใหม่ต่อท้ายแถว**
                      ⚠️ แต่ต้องติดป้ายว่าเป็นของที่เราเพิ่ม ไม่งั้นรอบหน้าคนไล่เทียบกับภาพ ZORT
                         จะนึกว่าตัวเองอ่านภาพผิด แล้วเสียเวลาไล่หาสิ่งที่ไม่มีอยู่ */}
                  {/* สองคอลัมน์นี้มาจากคลังที่ผูกกับใบจริงแล้ว (เดิมเดาจากชื่อช่องทาง ติดป้าย ≈ ไว้ — ถอดป้ายแล้ว) */}
                  <th className={THR}>
                    บิล 30 วัน
                    <span className="ml-1 text-[10px] font-normal text-blue-500" title="คอลัมน์นี้ ZORT ไม่มี — เราเพิ่มเอง">+เรา</span>
                  </th>
                  <th className={THR}>
                    ยอดขาย 30 วัน
                    <span className="ml-1 text-[10px] font-normal text-blue-500" title="คอลัมน์นี้ ZORT ไม่มี — เราเพิ่มเอง">+เรา</span>
                  </th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <EmptyState cols={9} icon="🏬" title={q ? 'ไม่พบคลังที่ค้นหา' : 'ยังไม่มีคลังสินค้า'}
                    detail="คลังสินค้าดึงมาจาก ZORT — เพิ่มคลังที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {แถวที่เห็น.map((w, i) => {
                  const s = statOf(w.code)
                  return (
                    <tr key={w.code} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={TD_NO}>{หน้าปัจจุบัน * หน้าละ + i + 1}</td>
                      <td className={`${TD} text-gray-700 font-medium whitespace-nowrap`}>{w.code}</td>
                      {/* 🔗 ทางเข้าจอรายละเอียด — ZORT มี `/Warehouse/Details?wid=` ของเราเพิ่งทำ 5 ต.ค. 2569
                             ก่อนหน้านี้แถวนี้เป็น **ทางตัน** กดแล้วไม่ไปไหน (ใบเทียบ ZORT ข้อ 13)
                          ⚠️ ของเราใช้ **รหัสคลัง** เป็นกุญแจ ไม่ใช่ `wid` ตัวเลขของ ZORT
                             เพราะท่อส่ง `code` มา ไม่ได้ส่ง id ของ ZORT (ช่อง `id` อยู่ใน zortFields แต่ท่อไม่ส่งต่อ) */}
                      <td className={TD}>
                        <Link href={`/core/branches/${encodeURIComponent(w.code)}`}
                          className={ROW_LINK}>{w.name || w.code}</Link>
                      </td>
                      <td className={TD}>
                        <span className="text-gray-600">ทั่วไป</span>
                        {/* ⚠️ ธงนี้มาจากเซิร์ฟเวอร์ ไม่ได้เดาจากรหัส — โกดังเปิดบิลขายไม่ได้ */}
                        <span className={`ml-1.5 text-[10px] rounded px-1.5 py-0.5 ${
                          w.isPos ? 'text-emerald-800 bg-emerald-100' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {w.isPos ? 'จุดขาย' : 'โกดัง — เปิดบิลไม่ได้'}
                        </span>
                      </td>
                      {/* 🔴 **แก้คำอธิบายที่เคยผิด (4 ก.ย. 2569)** — เคยเขียนว่า
                          "ZORT ไม่เปิดให้ดึงสต็อกแยกตามคลัง" ⇒ อ่านแล้วเข้าใจว่า **ทำไม่ได้**
                          แต่พอเปิดภาพจอจริง (`zort-ui/25-zort-คลังสินค้า-สาขา.jpg`)
                          **ZORT มีตัวเลขนี้อยู่ครบทั้ง 3 คลัง** (โกดัง 16,456,971.3 · KLD 1,562.32 · ANJ 0)
                          ⇒ ของจริงคือ **API ไม่ส่งมา** ไม่ใช่ **ZORT ไม่มี** — คนละเรื่องกัน
                             และแปลว่าคัดตัวเลขมาด้วยมือได้ (ท่าเดียวกับต้นทุนเฉลี่ย 42 หมวด)
                          ⇒ **นี่คือ ⏳ ยังไม่ได้ทำ ไม่ใช่ ❌ ทำไม่ได้** ห้ามเขียนสลับกันอีก */}
                      {/* 🎨 **สีอ่านมาจาก DOM ของ ZORT จริง 15 ก.ย. 2569 ไม่ได้เลือกเอง**
                          มูลค่า > 0 ⇒ เขียว rgb(19,175,130) · **มูลค่า = 0 ⇒ แดง rgb(242,87,87)**
                          (NEW 16.3 ล้าน เขียว · KLD 1,562.32 เขียว · ANJ 0 แดง)
                          ⇒ สีบอกว่า "คลังนี้ไม่มีของ" ไม่ใช่ของตกแต่ง
                          🔴 และ 0 ที่นี่ **เป็นค่าจริง** ไม่ใช่ "ไม่รู้" — ANJ ว่างจริง
                             ของที่ไม่รู้คือ `null` ซึ่งขึ้น "—" ต่างหาก (สามสถานะ) */}
                      <td className={TDR}>
                        {typeof w.stockValue === 'number'
                          /* 🔄 วัดซ้ำ 19 ต.ค. 2569: ZORT **เปลี่ยนแล้ว** — มูลค่า 0 ของ ANJ เป็น green-500 rgb(19,175,130) (เดิม 15 ก.ย. เป็นแดง)
                             ตอนนี้ ZORT ระบายแดง red-400 ที่ **รหัส/ชื่อ/วันเคลื่อนไหว** ของแถว ANJ แทน (ยังไม่รู้เกณฑ์ ⇒ ไม่เดา)
                             ⇒ โหมดเหมือน ZORT ใช้สีปัจจุบันของเขา · นอกโหมดคงแดงไว้ (บอกว่าคลังไม่มีของ) */
                          ? <span style={{ color: w.stockValue === 0 && !เหมือนZORT ? '#f25757' : '#13af82' }}>{fmtMoney(w.stockValue)}</span>
                          : <span className="text-gray-300" title="ท่อยังไม่เคยคัดมูลค่าของคลังนี้ — ไม่ใช่ว่าคลังไม่มีของ (คลังที่ไม่มีของจะขึ้นเลข 0 สีแดง)">—</span>}
                      </td>
                      <td className={TD}>
                        {w.movedAt
                          /* ⚠️ **ห้ามตัด 10 ตัวแรกก่อนส่งเข้า thaiDate** — ค่านี้มีโซน `+07:00` ติดมา
                             thaiDate อ่านโซนเองได้ถูกอยู่แล้ว · การตัดทิ้งไปก่อนแปลว่าถ้าท่อเปลี่ยนไปส่งแบบ UTC
                             วันบนจอจะเพี้ยนหนึ่งวันโดยไม่มีอะไรฟ้อง (18 ก.ย. 2569 — เจอท่านี้พังจริงแล้ว 3 จอ) */
                          /* 🕐 ZORT เขียนวันพร้อมเวลา `15 ต.ค. 2569 22:48` (อ่าน /Warehouse/list 16 ต.ค. 2569) ⇒ ใส่เวลาให้ตรง
                             ใช้ตัวแปลงกลาง (อ่านโซน +07:00 / UTC ได้ถูก) — ไม่ตัดสตริงเอง */
                          ? thaiDateTime(String(w.movedAt))
                          : <span className="text-gray-300" title="ท่อยังไม่ได้ส่งวันเคลื่อนไหวของคลังนี้มา">—</span>}
                      </td>
                      {/* ⚠️ ระหว่างรอ ห้ามโชว์ 0 — 0 แปลว่า "ขายไม่ได้เลย" ซึ่งคนละเรื่องกับ "ยังไม่รู้" */}
                      <td className={TDR}>{salesLoading ? <span className="text-gray-300" title="กำลังโหลดยอดขาย 30 วัน">…</span>
                        : salesFailed ? <span className="text-red-500" title="ดึงยอดขาย 30 วันไม่สำเร็จ — ไม่ใช่ว่าไม่มียอด">?</span>
                        : fmtNum(s.orders)}</td>
                      <td className={TDR}>{salesLoading ? <span className="text-gray-300" title="กำลังโหลดยอดขาย 30 วัน">…</span>
                        : salesFailed ? <span className="text-red-500" title="ดึงยอดขาย 30 วันไม่สำเร็จ — ไม่ใช่ว่าไม่มียอด">?</span>
                        : fmtMoney(s.amount)}</td>
                      <td className={`${TD} text-right`}>
                        <RowMenu
                          items={[
                            { label: 'คัดลอกรหัสคลัง', onClick: () => { navigator.clipboard?.writeText(w.code).catch(() => {}) } },
                            ...(w.isPos ? [{ label: 'เปิดจอขายหน้าร้าน', onClick: () => { window.location.href = '/core/pos' } }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          {/* 📤 ผัง ZORT /Warehouse/list: "Export to Excel" ใต้ตาราง (เดิมจอนี้ไม่มีปุ่มส่งออกเลย · เพิ่ม 16 ต.ค. 2569)
              ⚠️ ส่งออกจากแถวที่ดึงมาแล้วทั้งชุด (ท่อส่งคลังมาครบในคำขอเดียว) · มูลค่าที่ยังไม่เคยคัด = เว้นว่าง ห้ามเป็น 0 */}
          {/* 📐 โหมดเหมือน ZORT: แถบหน้า [1] ซ้าย · จำนวน N รายการ | จำนวนต่อหน้า ขวา — ก่อนปุ่ม Export (ภาพ /Warehouse/list 21 ต.ค. 2569) */}
          {เหมือนZORT && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: จำนวนหน้า }, (_, p) => (
                  <button key={p} type="button" onClick={() => setหน้า(p)} aria-current={p === หน้าปัจจุบัน ? 'page' : undefined}
                    className={`min-w-[30px] h-[34px] px-2 text-[14px] rounded border ${p === หน้าปัจจุบัน ? 'bg-[#e9ecef] border-[#adb5bd] text-[#3e3e3e]' : 'bg-white border-[#ccc] text-[#337ab7] hover:bg-gray-50'}`}>
                    {p + 1}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[14px] text-[#868e96]">
                จำนวน {list.length.toLocaleString('th-TH')} รายการ | จำนวนต่อหน้า
                <select value={ต่อหน้า} onChange={(e) => { setต่อหน้า(Number(e.target.value)); setหน้า(0) }}
                  aria-label="จำนวนต่อหน้า" className="h-[34px] border border-[#ccc] rounded px-2 text-[14px] text-[#3e3e3e] bg-white">
                  {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <ExportButton
              disabled={loading || rows.length === 0}
              label="📗 Export to Excel"
              spec={{
                filename: 'คลังสินค้า-สาขา',
                title: 'คลังสินค้า/สาขา',
                scope: 'ทุกคลัง',
                fetchPage: async (off) => ({ rows: off === 0 ? rows : [], total: rows.length }),
                header: ['รหัส', 'ชื่อคลัง/สาขา', 'จุดขาย', 'มูลค่าสินค้าคงเหลือ', 'เวลาที่คัดมูลค่า (เวลาไทย)', 'เคลื่อนไหวล่าสุด'],
                toRow: (w: Warehouse) => [
                  w.code, w.name || null,
                  w.isPos === undefined ? null : (w.isPos ? 'ใช่' : 'ไม่ใช่ (โกดัง)'),
                  typeof w.stockValue === 'number' ? w.stockValue : null,
                  (() => { const d = parseUtc(w.valueCollectedAt); return d ? thaiDayTime(d) : null })(),
                  w.movedAt ? thaiDateTime(w.movedAt) : null,
                ],
              }}
            />
          </div>

          {/* 📐 โหมดเหมือน ZORT: หมายเหตุใต้ตารางพับไว้ · ถ้ามีใบที่ยังไม่รู้คลัง บรรทัดสรุปบอกเลย (คำเตือนจริงห้ามซ่อน) */}
          <ZortFoldIf tone="gray" พับ={เหมือนZORT} สรุป={<>หมายเหตุคลัง · บิล/ยอดขาย 30 วันนับอย่างไร{unknownWh ? <> · <b className="text-amber-800">⚠️ มีใบที่ยังไม่รู้คลัง {fmtNum(unknownWh.orders)} ใบ</b></> : null}</>}>
          <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
            {note || 'คลังสินค้าดึงมาจาก ZORT ทั้งหมด'} ·
            {/* ⚠️ ข้อความของท่อ (note) บอกว่าโกดัง "ไม่มียอดขาย" — หมายถึงขายหน้าร้าน (POS) ไม่ได้
                แต่คอลัมน์นี้นับใบที่ **ตัดของจากคลังนั้น** รวมออนไลน์ ⇒ โกดังจึงมียอด · ต้องเขียนบอก ไม่งั้นสองประโยคขัดกัน */}
            {' '}บิล/ยอดขาย 30 วัน นับจากใบขายที่ตัดของจากคลังนั้นจริง (รวมทุกช่องทาง ทั้งสองร้าน — โกดังจึงมียอดจากออเดอร์ออนไลน์ แม้ขายหน้าร้านไม่ได้) ·
            {unknownWh && <> <b className="text-amber-800">มีใบที่ยังไม่รู้คลัง {fmtNum(unknownWh.orders)} ใบ {fmtMoney(unknownWh.amount)}</b> (ไม่ได้นับในคลังใด) ·</>}
            <b> โกดังไม่ใช่จุดขาย</b> จึงไม่มีให้เลือกในจอขายหน้าร้านและไม่มียอดขาย —
            เป็นความตั้งใจ ไม่ใช่ข้อมูลตกหล่น
          </p>
          </ZortFoldIf>
        </>
      )}
    </div>
  )
}
