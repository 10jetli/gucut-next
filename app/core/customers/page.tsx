'use client'
// ลูกค้า/คู่ค้า → ผู้ติดต่อ — ทะเบียนรายชื่อจากกระจก ZORT
// ⚠️ **เลขนับได้ห้ามเขียนลอย ๆ ในคอมเมนต์** (กฎที่ตกลงกัน 6 ก.ย. 2569)
//    จำนวนจริงอ่านจาก `total` ของท่อเสมอ — จอไม่เคยนับเอง
//    (วัดไว้เป็นบันทึก: 28,250 ราย เมื่อ 6 ก.ย. 2569 · มีเบอร์ 28,126 · มีอีเมล 3,018)
//
// ⚠️ **ประวัติของภาพ `05-ลูกค้า-ผู้ติดต่อ.jpg` — อ่านก่อนจะเปิดมันอีก**
//    ตอนสร้างจอนี้ **ตั้งใจไม่เปิดภาพ** เพราะในภาพมีชื่อ/เบอร์/อีเมลลูกค้าจริง
//    ผังจึงได้มาเป็น "ข้อความบอกคอลัมน์" จากฝั่งเซิร์ฟเวอร์แทน
//    ต่อมา 6 ก.ย. 2569 มีการเปิดภาพเพื่อเทียบผังให้ปิดแถวในเช็คลิสต์ (ดูผังอย่างเดียว
//    ไม่ได้คัดข้อมูลใครออกมา) และแจ้งฝั่งเจ้าของร้านแล้ว
//    ⇒ **บันทึกไว้ให้ตรงความจริง ไม่ใช่ปล่อยคอมเมนต์เดิมที่บอกว่าไม่เคยเปิด**
//       (ข้อความที่เคยจริงแล้วกลายเป็นเท็จ = คลาสเดียวกับบั๊ก stale-state ที่ไล่กันอยู่)
//
// ผังจาก ZORT: หัวจอ "ผู้ติดต่อ" + "จำนวน N รายการ" · ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มผู้ติดต่อใหม่
//   · ค้นหา "พิมพ์คำค้นหา" + ค้นหาขั้นสูง · แท็บ ทั้งหมด · ลูกค้า · คู่ค้า · + เพิ่มหมวดหมู่
//   · คอลัมน์ # · รหัส · ชื่อ · เลขประจำตัวผู้เสียภาษี · เบอร์โทรศัพท์ · อีเมล · ⋮
//   · ช่องว่างแสดงเป็น "-" ทุกคอลัมน์
//
// 🔒 **จอนี้แสดงข้อมูลส่วนบุคคลของคนสองหมื่นแปดพันคน — กติกาที่ห้ามถอด**
//    ① เลขประจำตัวผู้เสียภาษีถูกปิดบางส่วนมาจากเซิร์ฟเวอร์แล้ว (เห็น 4 ตัวท้าย)
//       **ห้ามทำปุ่ม "แสดงเต็ม" ในจอรายการ** — จอรายการมีไว้ "หาให้เจอ" ไม่ใช่ "อ่านของทุกคน"
//    ② ~~ห้ามทำปุ่ม Export ทั้งก้อน~~ **จนกว่าเจ้าของร้านจะสั่งเอง — ท่านสั่งแล้ว 18 ก.ย. 2569**
//       คำของท่าน: *"ให้ส่งออก Excel ได้ทุกจอ รวมจอผู้ติดต่อและจอขนส่งที่มีข้อมูลลูกค้า"*
//       ⚠️ **ห้ามลบข้อห้ามเดิมทิ้งเฉย ๆ** — เขียนทับให้คนรอบหน้าเห็นว่าเคยห้ามเพราะอะไร
//          และอะไรเปลี่ยนไป (กติกาเดียวกับที่ใช้ตอนเปิดฟอร์มตั้งรหัสใน lib/staff-users.ts)
//       เงื่อนไขที่มาพร้อมคำสั่ง และยังบังคับอยู่ในโค้ดข้างล่าง:
//         · ไล่ไม่ครบ = **ไม่ให้ไฟล์ออก** (lib/csv-export.ts → exportBlocked)
//         · ชื่อไฟล์และหัวไฟล์ต้องบอกวันที่ดึงและขอบเขต
//         · ตัวสร้างไฟล์อยู่หลังด่านล็อกอิน ไม่ใช่ URL ตรง (สร้างในเบราว์เซอร์ ไม่มีเส้นให้ยิง)
//         · จดไว้ว่าใครกดส่งออกจอไหน เมื่อไหร่ กี่แถว (app/api/export-log)
//       🔒 **ที่ยังห้ามเหมือนเดิม**: เลขประจำตัวผู้เสียภาษีในไฟล์ก็ยังเป็นเลขที่ถูกปิดบางส่วน
//          เพราะเซิร์ฟเวอร์ปิดมาก่อนถึงจอ — ไฟล์จึงไม่มีทางมีเลขเต็ม **และห้ามทำทางให้มี**
//    ③ เดินลึกเกินแถวที่ 500 โดยไม่ค้นหา เซิร์ฟเวอร์จะตอบ needQuery — ต้องอธิบายให้คนใช้เข้าใจ
//       ไม่ใช่โชว์ตารางว่างเฉย ๆ (ตาข่ายกันไล่ดึงทั้งฐานทีละหน้า)
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, TD, BtnGhost, LinkText, EmptyState, RowMenu, PageNav,} from '@/components/zort'
import ImportButton from '@/components/zort/ImportButton'
import ExportButton from '@/components/zort/ExportButton'
import AdvancedSearch, { AdvancedSearchLink } from '@/components/zort/AdvancedSearch'
import DataFreshness, { parseUtc, thaiDayTime } from '@/components/zort/DataFreshness'

interface Contact {
  id: string; type?: string; name?: string; code?: string
  phone?: string; email?: string; branchName?: string
  /** ปิดบางส่วนมาจากเซิร์ฟเวอร์แล้ว — ฝั่งจอไม่เคยเห็นเลขเต็ม */
  taxId?: string
  address?: string
}
interface Resp {
  skip?: string
  total: number | null
  withPhone?: number; withEmail?: number; withTax?: number
  limit: number; offset: number
  needQuery?: boolean
  /** ค่าที่ท่อใช้จริง — ใช้เป็นด่านเทียบกับที่จอเลือก (ท่อส่งมาให้เพื่อการนี้) */
  applied?: { q?: string | null; withPhone?: boolean; withEmail?: boolean }
  note?: string
  /* ⏱ **ชีพจรของกระจก** — ท่อเปิดให้ 15 ก.ย. 2569 (gucut-web 798f427)
     สองนาฬิกา คนละคำถาม **ห้ามเอามารวมเป็นอันเดียว**:
     · `recentAtUtc`    = ซิงก์หน้าแรก ๆ ล่าสุด ⇒ ตอบว่า **รายใหม่** มาถึงหรือยัง (ทุกชั่วโมง)
     · `fullSweepAtUtc` = กวาดครบทั้งฐานรอบล่าสุด ⇒ ตอบว่า **การแก้ของรายเก่า** ตามมาหรือยัง (รอบแรก ~24 ชม.)
     🔴 `sync` ทั้งก้อนเป็น null/ไม่มี = **ท่ออ่านชีพจรไม่ได้ = ไม่รู้** ≠ "ไม่เคยซิงก์"
        (สามสถานะเดิมที่ยึดทั้งจอ: ไม่รู้ ≠ ไม่มี ≠ มี) */
  sync?: {
    recentAtUtc?: string | null
    fullSweepAtUtc?: string | null
    cursor?: unknown
  } | null
  rows: Contact[]
}

const PAGE = 50
const DASH = <span className="text-gray-300">-</span>

export default function CoreContactsPage() {
  const router = useRouter()
  const [data, setData] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('')
  const [offset, setOffset] = useState(0)
  const [perPage, setPerPage] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* 🔍 **ค้นหาขั้นสูง — ท่อเปิดให้แล้ว 15 ก.ย. 2569** (gucut-web bea658d)
     รับ `withphone=1` · `withemail=1` (ใส่พร้อมกันได้) และสะท้อนค่าที่ใช้จริงกลับมาใน `applied`
     🚫 **ไม่ทำช่องกรอง "ชนิดผู้ติดต่อ"** — ท่อไม่มีตัวกรองนั้น และ byType ของทั้งฐานคือ
        Undefined 28,249 · Individual 1 ⇒ ช่องที่กรองแล้วผลไม่ต่างเลย = ช่องหลอก
        (กติกาเดียวกับที่ยึดมาทั้งใบ: ใส่เฉพาะช่องที่ท่อกรองให้จริง) */
  const [advOpen, setAdvOpen] = useState(false)
  const [withPhone, setWithPhone] = useState(false)
  const [withEmail, setWithEmail] = useState(false)

  /* ⚠️ **ตัวกรองต้องส่งเข้ามาเป็นอาร์กิวเมนต์ ไม่ใช่อ่านจาก state ใน closure**
     เจอจริง 15 ก.ย. 2569: เรียก `load(0)` ใน onChange ของ checkbox ทันที
     ⇒ ตอนนั้น state ยังไม่อัปเดต ⇒ closure เดิมส่งคำขอโดย **ไม่มีตัวกรองติดไปเลย**
     ⇒ จอดูเหมือนกรองแล้วแต่ผลไม่เปลี่ยน = อาการเดียวกับ "ช่องหลอก" ที่ตั้งใจเลี่ยงมาตลอด
     (จอขาย/คลังสินค้าใช้รูป `opt` แบบนี้อยู่แล้ว — ที่นี่พลาดเพราะลอกไม่ครบ) */
  const load = useCallback(async (
    off = 0,
    term = q,
    opt?: { withPhone?: boolean; withEmail?: boolean; size?: number },
  ) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'contacts', limit: String(opt?.size ?? perPage), offset: String(off) })
      if (term.trim()) qs.set('q', term.trim())
      if (opt?.withPhone ?? withPhone) qs.set('withphone', '1')
      if (opt?.withEmail ?? withEmail) qs.set('withemail', '1')
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
  }, [q, withPhone, withEmail, perPage])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  // ⚠️ แท็บ ลูกค้า/คู่ค้า ของ ZORT กรองจากชนิดผู้ติดต่อ — ข้อมูลที่เรามี `type` เป็น
  //    "Undefined" ทุกแถวเท่าที่สุ่มดู 600 ราย ⇒ **กดแล้วจะได้ศูนย์ทุกครั้ง**
  //    ปุ่มที่กดแล้วได้ศูนย์เสมอคือปุ่มหลอก ⇒ โชว์ไว้ให้ผังตรง แต่กดไม่ได้ + บอกเหตุผล
  const hasType = rows.some((r) => r.type && r.type !== 'Undefined')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผู้ติดต่อ"
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
            ? (
              <>
                {typeof data.total === 'number'
                  ? <>จำนวน {fmtNum(data.total)} รายการ</>
                  : <>ต้องพิมพ์คำค้นก่อนถึงจะดูส่วนนี้ได้</>}
                {/* ⚠️ **ท่อไม่ส่งเลขมา ≠ ไม่มีใครมีอีเมล** — เดิมเขียน `?? 0`
                    ถ้าท่อรุ่นเก่าไม่มีคีย์นั้น จอจะประกาศว่า "มีอีเมล 0" เป็นข้อเท็จจริง
                    ทั้งที่แปลว่า "ไม่รู้" ⇒ คนอ่านอาจสั่งงานจากเลขนั้น (เช่น เลิกทำเรื่องอีเมล)
                    ⇒ ไม่รู้ต้องเขียนว่าไม่รู้ · เขียนเลขได้เฉพาะตอนมีเลขจริง */}
                {(typeof data.withPhone === 'number' || typeof data.withEmail === 'number'
                  || typeof data.withTax === 'number') && (
                  <span className="text-gray-400">
                    {' '}· มีเบอร์ {typeof data.withPhone === 'number' ? fmtNum(data.withPhone) : 'ไม่รู้'}
                    {' '}· มีอีเมล {typeof data.withEmail === 'number' ? fmtNum(data.withEmail) : 'ไม่รู้'}
                    {' '}· มีเลขผู้เสียภาษี {typeof data.withTax === 'number' ? fmtNum(data.withTax) : 'ไม่รู้'}
                  </span>
                )}
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <ImportButton kind="contact" />
            {/* 📤 **ส่งออกได้เมื่อไหร่ — และทำไมบางทีกดไม่ได้**
                ท่อมีตาข่ายกันไล่ดึงทั้งฐาน: เดินลึกเกินแถวที่ 500 โดยไม่ค้นหา ⇒ ตอบ `needQuery`
                ⇒ ชุดที่ใหญ่กว่า 500 แถวและไม่ได้ค้นอะไรเลย **ไล่ให้ครบไม่ได้จริง ๆ**
                🔴 ถ้าปล่อยให้กดได้ จะได้ 500 แถวแล้วด่าน exportBlocked ปัดไฟล์ทิ้งทุกครั้ง
                   = ปุ่มที่กดแล้วไม่เคยได้อะไร ซึ่งคือ "ปุ่มหลอก" ที่ทั้งโปรเจกต์เลี่ยงมาตลอด
                ⇒ ปิดปุ่มไว้ **พร้อมบอกเหตุผลและบอกว่าต้องทำอะไรถึงจะกดได้** */}
            {(() => {
              const เกิน500 = typeof data?.total === 'number' && data.total > 500
              const พร้อม = !!q.trim() || !เกิน500
              return (
                <span className="inline-flex flex-col items-start">
                  <ExportButton
                    disabled={loading || !data || !!data?.skip || !พร้อม}
                    spec={{
                      filename: 'ผู้ติดต่อ',
                      scope: [q.trim() ? `ค้นหา "${q.trim()}"` : 'ทุกราย',
                        withPhone ? 'เฉพาะที่มีเบอร์' : '', withEmail ? 'เฉพาะที่มีอีเมล' : '']
                        .filter(Boolean).join(' · '),
                      title: 'ผู้ติดต่อ (ลูกค้า/คู่ค้า)',
                      /* 🔒 ต้องเขียนในไฟล์ว่าเลขภาษีถูกปิดมาแล้ว — ไม่งั้นฝ่ายบัญชีจะคิดว่า
                         ข้อมูลในฐานมีแค่ 4 ตัวท้าย แล้วไปตามแก้กับลูกค้าทั้งที่ ZORT มีเลขเต็มอยู่ */
                      note: 'เลขประจำตัวผู้เสียภาษีถูกปิดบางส่วนมาจากเซิร์ฟเวอร์ (เห็น 4 ตัวท้าย) — เลขเต็มดูได้ที่ ZORT เท่านั้น'
                        + ' · ไฟล์นี้มีข้อมูลส่วนบุคคลของลูกค้า โปรดเก็บเท่าที่จำเป็นและอย่าส่งต่อโดยไม่จำเป็น'
                        + ' · ไม่รวมผู้ติดต่อที่ถูกลบ (ZORT เรียกว่า archive) เพราะกระจกไม่ได้เก็บไว้',
                      filters: [
                        ['คำค้นหา', q.trim() || '(ไม่ได้ค้น — ทุกราย)'],
                        ['เฉพาะที่มีเบอร์โทร', withPhone ? 'ใช่' : 'ไม่'],
                        ['เฉพาะที่มีอีเมล', withEmail ? 'ใช่' : 'ไม่'],
                      ],
                      fetchPage: async (off, limit) => {
                        const qs = new URLSearchParams({ list: 'contacts', limit: String(limit), offset: String(off) })
                        if (q.trim()) qs.set('q', q.trim())
                        if (withPhone) qs.set('withphone', '1')
                        if (withEmail) qs.set('withemail', '1')
                        const res = await fetch(`/api/web/core?${qs}`)
                        const j: Resp = await res.json()
                        if (!res.ok) throw new Error(`HTTP ${res.status}`)
                        /* 🔴 ชนตาข่ายกลางทาง ⇒ **โยนออกไปให้ด่านปัดไฟล์ทิ้ง** ห้ามคืนแถวว่างเฉย ๆ
                           คืนว่างเงียบ ๆ = ไฟล์จะจบลงตรงแถวที่ 500 โดยดูเหมือนหมดพอดี */
                        if (j?.needQuery) {
                          throw new Error('ท่อไม่ยอมให้ไล่ลึกเกิน 500 แถวถ้าไม่ได้ค้นหา (ตาข่ายกันดึงทั้งฐาน) — พิมพ์คำค้นแล้วส่งออกทีละชุด')
                        }
                        return { rows: j?.rows ?? [], total: typeof j?.total === 'number' ? j.total : null }
                      },
                      header: ['รหัส', 'ชื่อ', 'เลขประจำตัวผู้เสียภาษี (ปิดบางส่วน)', 'เบอร์โทรศัพท์', 'อีเมล', 'สาขา', 'ที่อยู่'],
                      /* 🔴 ช่องที่ท่อไม่ส่ง ⇒ null (เว้นว่าง) ห้ามใส่ '-' ที่เห็นบนจอ
                         ขีดบนจอคือการตกแต่ง แต่ขีดในไฟล์จะกลายเป็นข้อมูลที่ Excel เอาไปนับ */
                      toRow: (r: Contact) => [r.code ?? null, r.name ?? null, r.taxId ?? null,
                        r.phone ?? null, r.email ?? null, r.branchName ?? null, r.address ?? null],
                    }}
                  />
                  {!พร้อม && (
                    <span className="text-[11.5px] text-gray-500 mt-1 max-w-[300px] leading-snug">
                      {/* 🔴 เดิมเขียน `?? 0` ⇒ ตอนท่อยังไม่ส่ง total จอจะอ่านว่า
                          "ส่งออกทั้ง 0 รายไม่ได้" ซึ่งอ่านแล้วงงกว่าไม่บอกเลย
                          ⇒ ไม่รู้จำนวน ให้พูดโดยไม่มีตัวเลข ไม่ใช่เดาเป็นศูนย์ (19 ก.ย. 2569) */}
                      ส่งออก{data?.total == null ? 'ทั้งหมด' : `ทั้ง ${fmtNum(data.total)} ราย`}ไม่ได้ — เซิร์ฟเวอร์กันไม่ให้ไล่ดึงทั้งฐาน
                      (ลึกเกิน 500 แถวต้องมีคำค้น) · พิมพ์คำค้นก่อนแล้วส่งออกทีละชุด
                    </span>
                  )}
                </span>
              )
            })()}
            {/* ชี้หน้าจริง 14 ก.ย. 2569 — ปุ่มส่งจริงในหน้านั้นยังปิด แต่ซ้อมได้เต็มที่
                ซึ่งต่างจาก "ยังไม่ได้ทำ" คนละเรื่อง */}
            <Link href="/core/customers/new"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เพิ่มผู้ติดต่อใหม่
            </Link>
          </>
        }
      />

      {/* 🔒 ข้อความจากเซิร์ฟเวอร์ที่บอกว่านี่คือข้อมูลส่วนบุคคล — ต้องขึ้นบนจอเสมอ */}
      {data?.note && (
        <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔒 {data.note}
        </div>
      )}

      {/* ⏱ **อายุของตัวเลขบนจอนี้** — จอนี้อ่านจากกระจก ไม่ได้ยิง ZORT สด
          🔴 เรื่องที่พิสูจน์กันมาเมื่อเช้า (15 ก.ย. 2569): กระจกค้างอยู่ที่ 28,250 ขณะที่ ZORT เดินไป
             28,334 **เพราะไม่มีอะไรสั่งซิงก์ตามเวลาเลย** · ฝั่งท่อแก้แล้ว (798f427) ซิงก์ทุกชั่วโมง
             ⇒ ที่ต้องขึ้นจอไม่ใช่ "ตัวเลขตรงแล้ว" แต่คือ **เวลาที่ไปดู ZORT ครั้งล่าสุด**
                เพราะเลขที่ไม่มีเวลากำกับ คนอ่านจะเชื่อว่าเป็นของสดเสมอ (กฎข้อ 4 ใน CLAUDE.md)
          ⚠️ ส่ง scheduleNote เอง — ค่าตั้งต้นของตัวประกอบร่วมคือตารางของ *ตัวซิงก์คลัง*
             (นาทีที่ 13/43) ซึ่งไม่ใช่ของจอนี้ ⇒ ไม่ส่ง = รับมรดกคำที่เป็นเท็จมาแสดง */}
      {data && (
        <>
          <DataFreshness
            freshness={{ syncedAtUtc: data.sync?.recentAtUtc }}
            everyMinutes={60}
            scheduleNote="รอบรายใหม่ ทุกชั่วโมง"
          />
          {/* 🔴 **นาฬิกาเรือนที่สองต้องแยกบรรทัด ห้ามรวมกับเรือนแรก**
              "รายใหม่มาแล้ว" ไม่ได้แปลว่า "การแก้ของรายเก่ามาแล้ว" — รอบกวาดครบทั้งฐาน
              รอบแรกใช้ ~24 ชม. และตอนนี้ยังไม่จบ ⇒ ถ้าโชว์แค่เรือนแรก จอจะบอกว่า
              "ข้อมูล ณ 08:50" แล้วคนจะเชื่อว่าทุกอย่างสด **รวมถึงชื่อ/เบอร์ที่เพิ่งแก้ในรายเก่า**
              ซึ่งยังไม่ขึ้นมาเลย · สามสถานะ: ไม่รู้ / ยังไม่เสร็จ / เสร็จเมื่อไหร่ */}
          {(() => {
            const sweep = parseUtc(data.sync?.fullSweepAtUtc)
            if (sweep) {
              return (
                <p className="text-[12px] text-gray-500 mb-2">
                  🧹 กวาดครบทั้งฐานล่าสุด <b>{thaiDayTime(sweep)}</b> (เวลาไทย) — การแก้ชื่อ/เบอร์ของรายเก่าตามมาถึงรอบนั้น
                </p>
              )
            }
            // ไม่มี sync ทั้งก้อน = ท่ออ่านชีพจรไม่ได้ ⇒ บอกว่าไม่รู้ · ห้ามเขียนว่ายังไม่เสร็จ
            if (!data.sync) {
              return (
                <p className="text-[12px] text-gray-400 mb-2">
                  🧹 ไม่รู้ว่ากวาดครบทั้งฐานล่าสุดเมื่อไหร่ — เซิร์ฟเวอร์ไม่ได้บอก
                </p>
              )
            }
            return (
              <p className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2 leading-relaxed">
                🧹 <b>รอบกวาดครบทั้งฐานยังไม่เสร็จ</b> (รอบแรกใช้เวลาราววัน)
                {' '}⇒ <b>รายใหม่ขึ้นแล้ว แต่รายเก่าที่ถูกแก้ทีหลังอาจยังเป็นของเดิม</b>
                {' '}— ถ้าจะยืนยันชื่อ/เบอร์ของลูกค้าเก่า ให้ดูที่ ZORT อีกรอบ
              </p>
            )
          })()}
        </>
      )}

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        /* 🔴 **ค้นได้จริงแค่ ชื่อ · เบอร์โทร · รหัส** (ยิงพิสูจน์ 16 ก.ย. 2569:
              ชื่อ ⇒ เจอ · เบอร์ ⇒ เจอ · รหัสเต็ม ⇒ เจอ 1 ราย · **อีเมลเต็ม ⇒ 0 ราย**)
           ZORT เขียนแค่ "พิมพ์คำค้นหา" เหมือนกัน แต่ของเขามีช่องอีเมลแยกให้
           ⇒ ถ้าเราเขียนตามเขาเฉย ๆ คนจะพิมพ์อีเมลแล้วได้ 0 แถว แล้วสรุปว่า "ไม่มีคนนี้ในระบบ" */
        placeholder="ชื่อ · เบอร์โทร · รหัสผู้ติดต่อ"
        /* 🔴 ลิงก์นี้เคยเป็นของประดับ (กดแล้วแค่ `load(0)` = ค้นซ้ำเงื่อนไขเดิม)
           ⇒ 15 ก.ย. เช้า: ยิงตรวจแล้วท่อรับแต่ `q` จึงเขียนว่า "ยังไม่มี" พร้อมเหตุผล
           ⇒ 15 ก.ย. บ่าย: **ฝั่งท่อเปิด withphone/withemail ให้** ⇒ เปลี่ยนเป็นแผงจริงตามที่จดไว้ */
        advanced={<AdvancedSearchLink open={advOpen} onToggle={() => setAdvOpen((v) => !v)} />}
      />

      {/* 🔍 แผงค้นหาขั้นสูง — ใช้ตัวประกอบร่วม · มีเฉพาะตัวกรองที่ท่อกรองให้จริง
          📏 ยิงตรวจ 15 ก.ย. 2569: ทั้งหมด 28,250 · มีเบอร์ 28,126 · มีอีเมล 3,018 · ทั้งสอง 3,017
          📏 **ยิงตรวจซ้ำ 16 ก.ย. 2569: ทั้งหมด 28,335 · มีเบอร์ 28,200 · มีอีเมล 3,068 · มีเลขภาษี 6,950**
             และ **เปิดจอ ZORT อ่านตัวนับสดวันเดียวกันได้ 28,335 เท่ากันเป๊ะ** ⇒ กระจกไม่ค้างแล้วในรอบนี้
             (รอบกวาดครบทั้งฐานล่าสุด `sync.fullSweepAtUtc` = 15 ก.ย. 2569 21:19 UTC)
          🟢 **เคยต่างกัน 83 ราย — รู้สาเหตุแล้ว: กระจกค้าง ไม่ใช่ท่อทิ้งข้อมูล** (ฝั่งท่อพิสูจน์ 15 ก.ย. 2569)
             จอนี้อ่านจาก **กระจก** (สำเนาในฐานของเรา) ไม่ได้อ่าน ZORT สด · และ **ไม่มีอะไรสั่งซิงก์ตามเวลา**
             มีแต่เส้นให้กดซิงก์เอง ⇒ กระจกค้างอยู่ที่ 28,250 ขณะที่ ZORT เดินไป 28,334
             ซิงก์แล้วกระจกตรงเป๊ะ 28,334 · **ท่อไม่ได้ตัดชนิดผู้ติดต่อไหนทิ้ง**
             ⚠️ ที่ยังไม่จบ: **รายเก่าที่ถูกแก้ทีหลัง กระจกยังไม่ตาม** (รอบกวาดครบทั้งฐานรอบแรกยังไม่เสร็จ)
             ✅ ท่อส่งชีพจรมาแล้ว (`sync.recentAtUtc` · `sync.fullSweepAtUtc` — gucut-web 798f427)
                ⇒ **เวลาซิงก์ขึ้นจอแล้วสองบรรทัด** ดูกล่อง ⏱/🧹 ใต้ข้อความข้อมูลส่วนบุคคล
                (เลขที่ไม่มีเวลากำกับ คนอ่านจะเชื่อว่าเป็นของสด — กฎข้อ 4 ใน CLAUDE.md) */}
      <AdvancedSearch
        open={advOpen}
        fields={[
          { label: 'เฉพาะที่มีเบอร์โทร', kind: 'check', value: withPhone,
            onChange: (v) => { setWithPhone(!!v); load(0, q, { withPhone: !!v }) } },
          { label: 'เฉพาะที่มีอีเมล', kind: 'check', value: withEmail,
            onChange: (v) => { setWithEmail(!!v); load(0, q, { withEmail: !!v }) } },
        ]}
        onApply={() => load(0)}
        onClear={() => { setWithPhone(false); setWithEmail(false); load(0, q, { withPhone: false, withEmail: false }) }}
        canClear={withPhone || withEmail}
        serverFiltered="มีเบอร์โทร · มีอีเมล · คำค้นหา"
        /* 🔎 รายการนี้ลอกจาก **แผงค้นหาขั้นสูงจริงของ ZORT** (กดเปิดอ่านเอง 16 ก.ย. 2569)
           ZORT มี: รหัสผู้ติดต่อ · เบอร์โทรศัพท์ · ชื่อผู้ติดต่อ · อีเมลผู้ติดต่อ · Tag ·
                   กลุ่มลูกค้า (dropdown) · แสดงผู้ติดต่อที่ถูกลบ
           ⇒ ช่องไหนท่อค้นให้ได้ เราเอาไปรวมในช่องค้นหาเดียว (ยิงพิสูจน์แล้วว่าค้นอะไรได้)
             ช่องไหนไม่ได้ ต้องบอกตรง ๆ ว่าไม่มี — ไม่ใช่เงียบ */
        notAvailable={[
          {
            what: 'ชนิดผู้ติดต่อ',
            why: 'ท่อไม่เปิดให้กรอง และทั้งฐานเป็นชนิดเดียวกันเกือบหมด (Undefined 28,249 · Individual 1) ⇒ ใส่ช่องไปก็กรองแล้วไม่ต่าง',
          },
          {
            what: 'ค้นด้วยอีเมล',
            why: 'ยิงพิสูจน์ 16 ก.ย. 2569 — ใส่อีเมลเต็มของรายที่มีอีเมลจริงลงช่องค้นหา ได้ 0 ราย ⇒ ท่อไม่ได้ค้นในช่องอีเมล (ZORT มีช่องนี้แยก) ขอฝั่งท่อไว้แล้ว',
          },
          {
            what: 'Tag · กลุ่มลูกค้า',
            why: 'คลังเงายังไม่เก็บ Tag ของผู้ติดต่อ · กลุ่มลูกค้าไม่มีเส้นใน API (ของ ZORT เองก็มีแต่ตัวเลือก "ทั้งหมด" เพราะร้านยังไม่ได้ตั้งกลุ่ม)',
          },
          {
            what: 'แสดงผู้ติดต่อที่ถูกลบ',
            /* ✅ 18 ก.ย. 2569 — เดิมเขียนว่า "ยังไม่รู้ว่า ZORT ทำเครื่องหมายถูกลบไว้ที่ช่องไหน"
               เปิดจอ ZORT แล้วติ๊กช่องนั้นจริง (สวิตช์มุมมอง ไม่ใช่การเขียนข้อมูล · ติ๊กออกคืนสภาพแล้ว):
                 ไม่ติ๊ก 28,344 ราย · ติ๊ก 31,514 ราย ⇒ **ผู้ติดต่อที่ถูกลบ 3,170 ราย**
               ฝั่ง ZORT เรียกของพวกนี้ว่า archive (id ของช่องคือ `checkshowarchive`)
               🔑 และที่สำคัญกว่า: กระจกเรามี 28,344 = **ตรงกับจอเขาแบบไม่รวมที่ถูกลบพอดี**
                  ⇒ ตัวนับที่เราเทียบกันทุกวันคือประชากร "ไม่รวมผู้ติดต่อที่ถูกลบ" */
            why: 'ท่อไม่ได้ส่งสถานะนี้มา ⇒ ทำไม่ได้ · วัดแล้ว 18 ก.ย. 2569: ZORT เรียกว่า archive และมี 3,170 ราย '
              + '(จอเขา 28,344 ไม่รวมที่ลบ · 31,514 เมื่อรวม) — กระจกเราเก็บเฉพาะที่ยังไม่ถูกลบ ตรงกับ 28,344',
          },
        ]}
        extraNote={<>🔒 ตัวกรองพวกนี้<b>ไม่นับเป็นคำค้น</b> — เดินลึกเกิน 500 แถวยังต้องพิมพ์คำค้นหาเหมือนเดิม</>}
      />

      {/* ✅ ด่านสะท้อนค่าที่ท่อใช้จริง — ถ้าสิ่งที่จอส่งกับสิ่งที่ท่อใช้ไม่ตรงกัน ต้องเห็น
          (ท่อส่ง `applied` มาให้ใช้เป็นด่านโดยเฉพาะ) */}
      {/* ⚠️ **ตรวจคำค้นด้วย ไม่ใช่แค่สองสวิตช์** (เพิ่ม 17 ก.ย. 2569)
          ของเดิมเทียบแต่ `withPhone`/`withEmail` ⇒ วันไหนท่อเมิน `q` หรือใช้คำอื่น
          จอจะโชว์รายชื่อทั้งกองโดยที่คนเพิ่งพิมพ์คำค้น **แล้วไม่มีอะไรฟ้อง**
          (จอรายการซื้อเพิ่งได้ด่านแบบเดียวกันไปเมื่อคืน — ทำให้เหมือนกันทั้งสองจอ) */}
      {data?.applied && (
        withPhone !== !!data.applied.withPhone ||
        withEmail !== !!data.applied.withEmail ||
        (q.trim() ? (data.applied.q ?? '') !== q.trim() : !!(data.applied.q ?? ''))
      ) && (
        <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 mb-3">
          ⚠️ <b>ตัวกรองที่จอเลือกกับที่ท่อใช้จริงไม่ตรงกัน</b>
          <span className="block mt-0.5">
            จอขอ: คำค้น “{q.trim() || '(ไม่ได้ค้น)'}” · มีเบอร์ {withPhone ? 'ใช่' : 'ไม่'} · มีอีเมล {withEmail ? 'ใช่' : 'ไม่'}
          </span>
          <span className="block">
            ท่อใช้จริง: คำค้น “{data.applied.q || '(ไม่ได้ค้น)'}” · มีเบอร์ {data.applied.withPhone ? 'ใช่' : 'ไม่'} ·
            มีอีเมล {data.applied.withEmail ? 'ใช่' : 'ไม่'}
          </span>
          <span className="block mt-0.5 text-gray-600">⇒ รายชื่อที่เห็นเป็นของเงื่อนไขที่ท่อใช้ ไม่ใช่ของที่เพิ่งกด</span>
        </div>
      )}

      {error && <ErrorBox title="ดึงรายชื่อผู้ติดต่อไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {/* ⚠️ สถานะที่สาม (ท่อตอบ 200 + ช่อง `skip`) ต้องเป็น **เหลือง** และคุมสไตล์จาก ErrorBox ที่เดียว
          เดิมเป็นกล่องขาว/เทา ⇒ อ่านเหมือนข้อความประกอบ ไม่ใช่สถานะของจอ (แก้ยกชุด 16 ก.ย. 2569) */}
      {data?.skip && <ErrorBox>{SKIP + data.skip}</ErrorBox>}

      {data && !data.skip && (
        <>
          <Tabs
            tabs={[
              { id: '', label: 'ทั้งหมด', count: typeof data.total === 'number' ? data.total : undefined },
              { id: 'customer', label: 'ลูกค้า' },
              { id: 'vendor', label: 'คู่ค้า' },
            ]}
            active={tab}
            onChange={(id) => {
              // ยังกรองจริงไม่ได้ — บอกตรง ๆ ดีกว่าพาไปแท็บที่ว่างเปล่า
              if (id && !hasType) return
              setTab(id)
            }}
            right={
              <Link href="/core/soon/contact-group" className="text-[12.5px] text-blue-600 hover:underline">
                + เพิ่มหมวดหมู่
              </Link>
            }
          />

          {!hasType && (
            <p className="text-[12px] text-amber-800 bg-amber-50 border-x border-b border-amber-200 px-3.5 py-2 leading-relaxed">
              แท็บ <b>ลูกค้า</b> กับ <b>คู่ค้า</b> ยังกดไม่ได้ — ชนิดผู้ติดต่อที่ ZORT ส่งมาเป็น
              <b> Undefined เกือบทั้งฐาน</b>: เดิมสุ่มตรวจ 1,000 ราย (5 ช่วงคนละหน้า · 3 ก.ย. 2569)
              {' '}<b>ตอนนี้ท่อนับให้ทั้งฐานแล้ว — Undefined 28,334 ราย · มีชนิดจริงแค่ 1 ราย (Individual)
              {' '}จาก 28,335</b> (16 ก.ย. 2569 · เลิกอ้างตัวเลขสุ่มแล้ว)
              และในข้อมูลดิบ
              <b>ไม่มีฟิลด์แยกลูกค้า/คู่ค้าอยู่เลย</b> ⇒ กรองแล้วได้ศูนย์เสมอ
              <b> ปุ่มที่กดแล้วได้ศูนย์ทุกครั้งคือปุ่มหลอก</b> จึงเปิดไว้ให้ผังตรงแต่ยังกดไม่ได้
              <br />
              💡 <b>นี่ไม่ใช่ช่องว่างของระบบเรา แต่เป็นช่องว่างของข้อมูลร้าน</b> — แท็บเดียวกันในจอ ZORT
              ก็กรองไม่ได้เหมือนกัน เพราะร้านไม่เคยแยกประเภทผู้ติดต่อไว้ตั้งแต่ต้น
              ถ้าอยากแยกจริงต้องไปตั้งที่ ZORT ก่อน แล้วรอบซิงก์ถัดไปจะเห็นเอง
            </p>
          )}

          {/* 🔴 ตาข่ายกันไล่ดึงทั้งฐานทีละหน้า — ต้องอธิบาย ไม่ใช่โชว์ตารางว่าง */}
          {data.needQuery && (
            <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-3 leading-relaxed">
              <b>ดูลึกกว่านี้ต้องพิมพ์คำค้นก่อน</b> — {data.note}
              <br />
              เป็นตาข่ายที่ตั้งใจใส่ไว้ กันการไล่เปิดทีละหน้าจนได้รายชื่อลูกค้าครบทั้งฐาน
              <br />
              <button
                onClick={() => { setOffset(0); load(0) }}
                className="mt-2 text-[12.5px] font-medium text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
              >
                กลับไปหน้าแรก
              </button>
            </div>
          )}

          {!data.needQuery && (
            <TableWrap>
              <table className="w-full min-w-[860px]">
                {/* 🔃 คอลัมน์ที่ **จอ ZORT กดเรียงได้** มี tooltip บอกว่าของเรายังเรียงไม่ได้ (ท่อเมิน sort ทุกค่า)
                    วัดจอ ZORT จริง 16 ก.ย. 2569 — ติดเฉพาะช่องที่วัดมาแล้ว ห้ามเดา */}
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH} style={{ width: 44 }}>#</th>
                    <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">รหัส</span></th>
                    <th className={TH}><span title="จอ ZORT กดหัวคอลัมน์นี้เพื่อเรียงได้ — ของเรายังเรียงไม่ได้ เพราะท่อเส้นนี้ไม่รับ sort (ยิงทดสอบ 16 ก.ย. 2569: ส่งค่าอะไรไปก็ได้ลำดับเดิมทุกครั้ง) · ขอฝั่งท่อไว้แล้ว · ระหว่างนี้ใช้ตัวกรอง/ช่องค้นหาแทน">ชื่อ</span></th>
                    <th className={TH}>เลขประจำตัวผู้เสียภาษี</th>
                    <th className={TH}>เบอร์โทรศัพท์</th>
                    <th className={TH}>อีเมล</th>
                    <th className={TH} style={{ width: 56 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyState cols={7} icon="👥" title="ไม่พบผู้ติดต่อ"
                      detail={q ? 'ค้นได้จาก ชื่อ · เบอร์โทร · รหัสผู้ติดต่อ' : 'ยังไม่มีรายชื่อในคลังเงา — ต้องสั่งซิงก์ก่อน'} />
                  )}
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.code || DASH}</td>
                      <td className={TD}>
                        {/* ✅ 8 ก.ย. 2569: มีหน้าปลายทางแล้ว (/core/customers/detail + เส้น ?customer=)
                            ⇒ ทำเป็นลิงก์ตาม ZORT (ชื่อ → ContactDetail) · สีฟ้า = สัญญาว่ากดได้ ตอนนี้จริงแล้ว */}
                        {r.name ? (
                          <Link href={`/core/customers/detail?name=${encodeURIComponent(r.name)}`}
                            className="text-blue-600 hover:underline">{r.name}</Link>
                        ) : <span className="text-gray-800">{DASH}</span>}
                        {/* ZORT ต่อท้ายชื่อสาขาในวงเล็บ — ค่าที่ได้มาบางแถวเป็นรหัสดิบ ("1")
                            แสดงตามที่ต้นทางให้มา ไม่แต่งเอง แล้วอธิบายไว้ท้ายตาราง */}
                        {r.branchName && <span className="text-gray-400"> ({r.branchName})</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap font-mono text-[12px]`}>{r.taxId || DASH}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.phone || DASH}</td>
                      <td className={`${TD} max-w-[220px] truncate`}>{r.email || DASH}</td>
                      <td className={`${TD} text-right`}>
                        <RowMenu
                          items={[
                            /* ลำดับตาม ZORT (⋮ ผู้ติดต่อ: ปักหมุด · ดูภาพรวม · ซื้อเข้า · ขายออก ·
                               แก้ไข · Tag · ลบ) — ของเราใส่เฉพาะที่กดแล้วได้ผลจริง
                               ที่เหลือเป็น disabled พร้อมเหตุผล ไม่ตัดทิ้ง (คนใช้ ZORT จะได้ไม่หาไม่เจอ) */
                            {
                              label: 'ดูภาพรวม',
                              onClick: () => router.push(`/core/customers/detail?name=${encodeURIComponent(r.name ?? '')}`),
                            },
                            {
                              label: 'ขายออก (เปิดบิลที่ POS)',
                              // ส่งชื่อไปเติมช่องลูกค้าให้เลย — ถ้า POS มีบิลค้างอยู่ บิลค้างชนะ
                              // และ POS จะเขียนบอกบนจอเองว่าชื่อจากลิงก์ยังไม่ถูกใส่
                              onClick: () => router.push(`/core/pos?customer=${encodeURIComponent(r.name ?? '')}`),
                            },
                            /* เดิม disabled "ยังไม่มีท่อเปิดใบซื้อ" — ค้างตั้งแต่มี ?addpo=1
                               และจอ /core/purchases/new (กวาดคลาส stale-state 11 ก.ย. 2569) */
                            {
                              label: 'ซื้อเข้า',
                              onClick: () => router.push(`/core/purchases/new?vendor=${encodeURIComponent(r.name ?? '')}`),
                            },
                            /* ⚠️ **แก้ไม่ได้ แต่ *เพิ่ม* ได้** — ท่อมี `?addcontact=1` (จอ /core/customers/new ใช้อยู่)
                               แต่ไม่มีเส้น updatecontact (ยิงตรวจ 15 ก.ย. 2569 ⇒ ตกลงบรรทัดท้ายสุด = ไม่รู้จัก)
                               ⇒ เขียนว่า "แก้ที่ ZORT เท่านั้น" ลอย ๆ อ่านได้ว่าเขียนอะไรไม่ได้เลย ซึ่งไม่จริง */
                            { label: 'แก้ไข', disabled: 'ยังไม่มีเส้นแก้ผู้ติดต่อในท่อ — แก้ที่ ZORT (เพิ่มผู้ติดต่อใหม่ทำที่จอเราได้)' },
                            { label: 'เพิ่ม Tag', disabled: 'คลังเงายังไม่ได้เก็บ Tag ของผู้ติดต่อ' },
                            {
                              label: 'คัดลอกเบอร์โทร',
                              onClick: () => { navigator.clipboard?.writeText(r.phone ?? '').catch(() => {}) },
                            },
                            {
                              label: 'ค้นออเดอร์ของคนนี้',
                              onClick: () => { setQ(r.name ?? ''); load(0, r.name ?? '') },
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
                  แสดงแถวที่ {fmtNum(offset + 1)}–{fmtNum(offset + rows.length)}
                  {typeof data.total === 'number' && <> จาก {fmtNum(data.total)}</>}
                </span>
                <span className="flex gap-2">
                  <PageNav offset={offset} perPage={perPage} rowsOnPage={rows.length}
                    total={typeof data.total === 'number' ? data.total : null}
                    disabled={loading} onGo={(off) => load(off)}
                    onPerPage={(n) => { setPerPage(n); load(0, undefined, { size: n }) }} />
                </span>
              </div>
            </TableWrap>
          )}

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            เลขประจำตัวผู้เสียภาษี<b>ถูกปิดบางส่วนมาจากเซิร์ฟเวอร์</b> (เห็น 4 ตัวท้าย) —
            จอนี้เห็นเลขเต็มไม่ได้เลยแม้แต่ในหน่วยความจำของเบราว์เซอร์ ·
            ชื่อในวงเล็บคือ<b>ชื่อสาขา</b>ตามที่ ZORT ส่งมา บางรายเป็นรหัสดิบอย่าง (1)
            เพราะต้นทางกรอกไว้แบบนั้น <b>ไม่ได้แต่งเพิ่ม</b>
            <br />
            ⚠️ ZORT มีคอลัมน์ให้ตั้งค่าเพิ่ม/ลด และแสดงป้าย Facebook ใต้ชื่อบางราย —
            ของเราไม่มีเพราะ<b>ตั้งใจไม่เก็บ 15 ฟิลด์นั้น</b> (facebook · line · ig · เพศ · วันเกิด · รูป)
            ซึ่งว่างแทบทั้งหมดและไม่มีจอไหนใช้ — <b>ฟิลด์ที่เก็บไว้เฉย ๆ คือความเสี่ยงเปล่า ๆ</b>
          </p>
        </>
      )}
    </div>
  )
}
