'use client'
// จอทะเบียนของ ZORT ที่ **ว่างเปล่าจริง ๆ ทุกจอ** — **ลอกจากภาพจริงทีละใบ**
//   รายได้อื่น            `zort-ui/53-zort-รายได้อื่น.jpg`
//   รายจ่ายอื่น           `zort-ui/28-zort-รายจ่ายอื่น-ว่าง-empty-state.jpg`
//   รายการโอนเงิน         `zort-ui/54-zort-รายการโอนเงิน.jpg`
//   สินค้าหลากคุณสมบัติ   `zort-ui/30-zort-สินค้าหลากคุณสมบัติ-ว่าง.jpg`
//   เซลเพจ (Sale pages)   `zort-ui/10-ร้านค้าออนไลน์-เซลเพจ-ว่าง.jpg`
//   เอกสารบัญชี           `zort-ui/18-เอกสารบัญชี-ว่าง.jpg`
//
// ทุกจอที่ ZORT **ว่างเปล่าจริง ๆ (0 รายการ)** เพราะร้านไม่ได้ใช้ / ลงบัญชีที่ PEAK
// ⇒ ทำผังให้เหมือนตามกฎ "เหมือน ZORT 100%" แต่ **ห้ามเขียนว่า "0 รายการ" ลอย ๆ**
//    เพราะเรายังไม่ได้ต่อท่อกับ ZORT เลย ⇒ ศูนย์ของเราแปลว่า "ยังไม่รู้" ไม่ใช่ "ไม่มี"
//    ⚠️ ตัวเลข 0 ที่ไม่มีที่มา คือคำกล่าวอ้างที่เราพิสูจน์ไม่ได้ — ตระกูลเดียวกับ
//       ตัวตรวจขึ้นเขียวทั้งที่ของจริงพัง
//
// ⚠️ ปุ่ม "สร้าง…" กับ "นำเข้าไฟล์" พาไปหน้าที่บอกตรง ๆ ว่ายังทำอะไรไม่ได้
//    ห้ามทำปุ่มที่กดแล้วไม่เกิดอะไร — คนใช้จะกดซ้ำแล้วนึกว่าระบบพัง
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { SOON } from '@/lib/zort-menu'
import { fmtMoney } from '@/lib/format'
import { PageHead, TableWrap, TH, THR, thaiDate } from './index'

export interface LedgerCol { label: string; right?: boolean }

/** วันที่ไปเปิดดูจอ ZORT ของจริงล่าสุด — **แก้ที่นี่ที่เดียวเมื่อไปตรวจใหม่**
 *  🔴 เดิมเขียนตายตัวว่า "ตรวจเมื่อ 3 ก.ย. 2569 มี 0 รายการ" ฝังในข้อความ
 *     ⇒ ไม่มีอะไรบังคับให้อัปเดต · อีกสามเดือนจอจะยังยืนยันเลขของวันนั้น
 *     ⇒ **เป็น stale-state บนหน้าจอ ซึ่งแย่กว่าในคอมเมนต์ เพราะคนใช้เห็นและเอาไปตัดสินใจ**
 *  ⇒ ตอนนี้จอ **บอกอายุตัวเอง** และ **ประกาศวันหมดอายุของตัวเอง** */
const CHECKED_AT = '2026-09-03'
/** เกินกี่วันถือว่าข้อมูลที่คัดมาเก่าเกินจะอ้างอิง */
const STALE_DAYS = 45

/* 🔵 **ตัวนี้หน้าตาเหมือนบั๊กวันหมดอายุที่แก้ไป แต่ถูกอยู่แล้ว — อย่า "แก้" ตาม**
   (เขียนกำกับ 6 ก.ย. 2569 หลังเจอบั๊กเทียบต้นวันที่จอบริษัท/ร้านค้า)

   ต่างกันที่ **ความหมายของเลข** ไม่ใช่รูปโค้ด:
   · จอบริษัท = **เส้นตาย** (ใบใช้ได้ถึงเมื่อไหร่) ⇒ เทียบต้นวัน = ประกาศว่าตายเร็วไป 1 วัน
     ผิดไปทาง **ตื่นตูม** ⇒ คนหยุดขายเปล่า ๆ ⇒ ต้องเทียบสิ้นวัน
   · ตัวนี้ = **อายุ** (ตรวจไปแล้วกี่วัน) ⇒ เทียบต้นวันได้เลขมากที่สุดเท่าที่เป็นไปได้
     ผิดไปทาง **เตือนเร็วกว่าจริง** ซึ่งเป็นทางที่ปลอดภัยสำหรับคำเตือนเรื่องข้อมูลเก่า

   ⇒ **โค้ดรูปเดียวกัน ความถูกต้องกลับด้าน** ตัดสินจากว่าผิดแล้วไปทางไหน ไม่ใช่จากรูปแบบ
   ⚠️ ทั้งสองที่ใช้ +07:00 เหมือนกัน — เซิร์ฟเวอร์รัน UTC ถ้าลืมโซนจะเลื่อน 7 ชม. */
function ageOf(iso: string) {
  const d = Math.floor((Date.now() - new Date(`${iso}T00:00:00+07:00`).getTime()) / 86400000)
  return Number.isFinite(d) && d >= 0 ? d : null
}

/* ── แปลงแถวดิบของ ZORT เป็นช่องบนตาราง ──────────────────────────────────
   🔴 **อยู่ในไฟล์นี้ ไม่ใช่รับเป็น prop** (แก้ 14 ก.ย. 2569)
      รุ่นแรกผมให้แต่ละจอส่งฟังก์ชัน `mapRow` เข้ามา ⇒ Next ปฏิเสธ:
      **"Functions cannot be passed directly to Client Components"**
      ⇒ ทั้งสี่จอขึ้นหน้าเปล่า 500 · เจอเพราะเปิดดูด้วยตา ไม่ใช่เพราะ tsc (tsc ผ่านสบาย)
      ⇒ ย้ายมาไว้ที่เดียวกับที่รู้สัญญาช่องอยู่แล้ว ดีกว่าเดิมด้วย

   ⚠️ **ยังไม่เคยเห็นรูปแถวจริง** — ร้านมี 0 รายการทุกชุด (ฝั่งท่อยืนยัน 14 ก.ย. 2569)
      ชื่อช่องมาจากเอกสารล้วน ⇒ อ่านแบบ **ทนฟิลด์หาย** และคืน null ให้จอแสดง "—" แทนการเดา */
const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k]
    if (v !== undefined && v !== null && v !== '') return typeof v === 'number' ? v : String(v)
  }
  return null
}
const day = (v: string | number | null) => (v === null ? null : String(v).slice(0, 10))

const ROW_MAPS: Record<string, (r: Record<string, unknown>) => (string | number | null)[]> = {
  incomes: (r) => [day(pick(r, 'incomedate', 'incomedateString', 'createdatetime')),
    pick(r, 'contactname', 'customername'), pick(r, 'amount'), pick(r, 'paymentstatus')],
  expenses: (r) => [day(pick(r, 'expensedate', 'expensedateString', 'createdatetime')),
    pick(r, 'contactname', 'vendorname'), pick(r, 'amount'), pick(r, 'paymentstatus')],
  moneytransfers: (r) => [day(pick(r, 'actiondate', 'createdatetime')),
    pick(r, 'reference', 'description'), pick(r, 'amount'), pick(r, 'status')],
  variations: (r) => [pick(r, 'sku'), pick(r, 'name'),
    Array.isArray(r.variants) ? `${(r.variants as unknown[]).length} ตัวเลือก` : null, null, null, null],
  /* ⚠️ **คนละตัวกับ "ลูกค้าคืนของ" (ReturnOrder)** — อันนี้คือของที่เราส่งคืน *ผู้ขาย*
     ชื่อสองอันนี้คล้ายกันมาก ⇒ ทุกข้อความบนจอต้องมีคำว่า "ให้ผู้ขาย" กำกับ
     สลับสองจอนี้ = ตัดสต็อกผิดทาง แล้วของหายจากคลังโดยไม่มีอะไรฟ้อง
     ⚠️ `customername` ของเส้นนี้ = **ผู้ขาย** ไม่ใช่ลูกค้า (ZORT ใช้ชื่อช่องเดิม) */
  returnpurchaseorders: (r) => [
    pick(r, 'number'),
    day(pick(r, 'returnpurchaseorderdateString', 'returnpurchaseorderdate', 'createdatetime')),
    pick(r, 'customername', 'contactname'),
    pick(r, 'referencenumber'),
    pick(r, 'warehousecode'),
    pick(r, 'amount'),
    pick(r, 'status'),
    pick(r, 'paymentstatus'),
  ],
}

export default function LedgerScreen({
  title, cols, createLabel, soonKey, withImport, withTabs, tabs, dateLine, noCreate, sumLabel, purpose, meanwhile,
  emptyProof, zortList, createHref, totals, hadHandCheck,
}: {
  title: string
  cols: LedgerCol[]
  createLabel: string
  /** คีย์ใน lib/zort-menu.ts — หน้าที่บอกว่ายังทำอะไรไม่ได้ */
  soonKey: string
  withImport?: boolean
  /** ZORT มีแท็บ ทั้งหมด · รอชำระ (0) · สำเร็จ เฉพาะจอรายได้/รายจ่าย */
  withTabs?: boolean
  /** แท็บชุดอื่น (เช่น จอเอกสารบัญชีมี 6 แท็บตามชนิดเอกสาร) — ใส่มาแล้วทับ withTabs */
  tabs?: string[]
  /** ✅ **หลักฐานว่า "ว่างจริง" ไม่ใช่ "ยังไม่รู้"** — ข้อความสั้น ๆ ที่บอก **ช่วงวันที่ใช้ตรวจ**
   *  🔴 ใส่ได้เฉพาะจอที่ **เปิดช่วงวันกว้างแล้วยังไม่มีรายการ** เท่านั้น
   *     บทเรียน 6 ก.ย. 2569: จอ ZORT ตั้งช่วงเริ่มต้นแคบ (/Sell/list 7 วัน = 122 · 10 ปี = 26,030)
   *     ⇒ "0 รายการ" ที่อ่านด้วยค่าเริ่มต้น แปลว่า "0 ในช่วงสั้น ๆ" ไม่ใช่ "ไม่มีเลย"
   *  ⚠️ ไม่มี prop นี้ = จอยังพูดเหมือนเดิมว่า "ยังไม่ได้ดึงข้อมูล" ซึ่งถูกต้องแล้ว */
  emptyProof?: string
  /** บรรทัดช่วงวันที่ใต้ช่องค้นหาแบบ ZORT เช่น "วันที่:2/6/2569-2/9/2569" */
  dateLine?: string
  /** ไม่มีปุ่มสร้างในจอนั้น (เช่น ZORT จอเอกสารบัญชีไม่มี) */
  noCreate?: boolean
  /** ข้อความสรุปใต้ชื่อจอแบบ ZORT — ต่างกันคำว่า "มูลค่า" กับ "จำนวนเงิน" */
  /** 🔴 **ไม่ใส่ก็ได้ — และจอที่ต่อท่อแล้ว "ต้องไม่ใส่"** (แก้ 15 ก.ย. 2569)
   *  เดิมบังคับให้ส่งเสมอ ⇒ ห้าจอที่ต่อท่อแล้วยังถือสตริง "มี 0 รายการ" ค้างไว้
   *  ซึ่งอยู่ในกิ่ง `!zortList` ที่ไม่ทำงานอีกแล้ว ⇒ **มองไม่เห็น แต่ไม่ได้หายไป**
   *  ⇒ วันไหนมีคนถอด `zortList` ออก คำเท็จจะกลับขึ้นจอเองเงียบ ๆ โดยไม่มีใครตั้งใจ
   *  ⇒ ทำให้เป็นช่องที่ **ไม่ใส่ได้** แล้วลบออกจากจอที่ต่อท่อ — กับดักหายไปทั้งอัน
   *     ไม่ใช่แค่ถูกกลบไว้ (ต่างกันตรงที่อันหลังรอวันกลับมา)
   *  ⚠️ ใส่ได้เฉพาะจอที่ **ยังไม่ต่อท่อ** และต้องเขียนที่มาของเลขไว้ในตัวข้อความเอง
   *     เช่น "จอ ZORT โชว์ 0 หน้า (เปิดดูด้วยตา)" ไม่ใช่ "มี 0 หน้า" ลอย ๆ */
  sumLabel?: string
  /** ZORT เขียนอะไรไว้ในกล่องว่าง — เอาไว้บอกว่าจอนี้มีไว้ทำอะไร */
  purpose: string
  /** ตอนนี้ร้านทำเรื่องนี้ที่ไหน */
  meanwhile: string
  /** 🔴 **จอนี้เคยโชว์ตัวเลขที่คัดมาด้วยมือเมื่อ 3 ก.ย. 2569 หรือเปล่า**
   *  ใส่ `true` เฉพาะสี่จอทะเบียนเดิม (รายได้อื่น · รายจ่ายอื่น · โอนเงิน · หลากคุณสมบัติ)
   *  ⇒ พอต่อท่อแล้ว จอจะบอกได้ว่า "เลขนี้ ZORT ตอบเอง ไม่ใช่คำบอกเล่าเดิมอีกแล้ว" ซึ่งมีความหมาย
   *
   *  🔴 **จอใหม่ห้ามใส่** — ไม่เคยมีคำบอกเล่าเมื่อ 3 ก.ย. ให้เทียบ
   *     เขียนไปจะกลายเป็นอ้างถึงเหตุการณ์ที่ไม่เคยเกิด (เจอ 14 ก.ย. 2569 ตอนทำจอคืนสินค้าให้ผู้ขาย)
   *     ⚠️ ตระกูลเดียวกับบั๊ก "ต้อง Export Excel" ที่ผูกตายตัวไว้กับธง impossible:
   *        **ผลลัพธ์ที่ผูกตายตัวไว้กับตัวประกอบร่วม แล้วจอใหม่ได้รับมรดกไปโดยไม่มีใครสั่ง** */
  hadHandCheck?: boolean
  /** 🔴 **ต่อท่อจริงแล้ว** — ชื่อชุดข้อมูลของเส้น `?zortlist=` (ขึ้น production 14 ก.ย. 2569)
   *  ไม่ส่ง = จอยังไม่ต่อท่อ พฤติกรรมเดิมทุกอย่าง (จอที่ยังไม่มีเส้นจะไม่ถูกแตะเลย)
   *  ⚠️ `variations` **ห้ามส่ง from/to** (ท่อตอบ 400) */
  zortList?: 'incomes' | 'expenses' | 'moneytransfers' | 'variations' | 'returnpurchaseorders'
  /** ✅ **จอ "สร้าง" ทำเสร็จแล้ว ⇒ ปุ่มพาไปของจริง ไม่ใช่หน้า soon**
   *  ไม่ส่ง = พาไป `/core/soon/<soonKey>` ตามเดิม (ยังไม่ได้ทำ) */
  createHref?: string
  /** 🔴 **ยอดรวมต้องมาจากท่อ ห้ามบวกจากแถวเอง** — เราดึงมาแค่หน้าละไม่กี่แถว
   *  บวกเองจะได้ยอดของ "หน้านี้" แล้วโชว์เหมือนเป็นยอดทั้งชุด (CLAUDE.md กฎตัวเลขคนละแหล่ง)
   *  ชื่อช่องใน JSON ที่ให้เอามาโชว์ + ป้ายกำกับ · null จากท่อ = ไม่ส่งมา ⇒ "ยังไม่รู้" */
  totals?: { key: string; label: string }[]
}) {
  const age = ageOf(CHECKED_AT)

  /* ── ถาม ZORT จริงผ่านท่อ (เส้น ?zortlist= ขึ้น production 14 ก.ย. 2569) ──────
     🔴 **สามสถานะ ห้ามยุบ** (ฝั่งท่อกำชับ · ท่อตั้งใจไม่แนบ rows มาตอน 502)
       ① ตอบแล้วมี 0 รายการ ⇒ "ZORT ตอบเองว่าไม่มี" — ต่างจากของเดิมที่เป็นคำบอกเล่าจากคนเปิดจอดู
       ② ตอบแล้วมีแถว       ⇒ แสดงแถว
       ③ 502 unknown        ⇒ **"ยังไม่รู้" ห้ามเขียนว่า "ไม่มีรายการ"**
          ของจริงตอนนี้: moneytransfers ตอบ 502 เพราะ ZORT ตอบ resCode 500
          **ไม่ใช่ว่าเส้นไม่มี** ⇒ ห้ามติดป้าย impossible ให้คีย์นั้น */
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [zCount, setZCount] = useState<number | null>(null)
  const [zErr, setZErr] = useState('')
  const [zUnknown, setZUnknown] = useState(false)
  /* 🔴 **สาเหตุฝั่ง ZORT แยกจาก "ยังไม่รู้"** (ฝั่งท่อส่งมาให้ 14 ก.ย. 2569 · gucut-web 3b2b147)
     `zortCode === '500'` + `zortDesc` = ZORT ขัดข้องภายในตัวเอง ไม่ใช่พารามิเตอร์เราผิด
     ⚠️ **ห้ามเขียนสาเหตุเกินกว่านี้** — ยังไม่รู้ว่าพังเพราะร้านไม่มีรายการ หรือพังทุกร้าน
        (ฝั่งท่อกำชับตรง ๆ · และยังห้ามขึ้น "0 รายการ" เหมือนเดิม) */
  const [zCode, setZCode] = useState('')
  const [zDesc, setZDesc] = useState('')
  /** ยอดรวมที่ **ท่อคิดให้** · undefined = ท่อไม่ได้ส่งช่องนั้นมา ⇒ จอต้องไม่โชว์เลข */
  const [zTotals, setZTotals] = useState<Record<string, number | null>>({})
  /* 🔍 **ค้นหา + ค้นหาขั้นสูง — เฉพาะจอที่ต่อท่อแล้ว** (ใบ t_mu1i74cu · 15 ก.ย. 2569)
     เส้น `?zortlist=` รับ `keyword` · `from` · `to` อยู่แล้ว แต่จอไม่เคยเปิดให้ใช้
     ⇒ ช่องค้นหาเป็นช่องเทาที่พิมพ์ไม่ได้ และลิงก์ "ค้นหาขั้นสูง" เป็นตัวหนังสือเฉย ๆ
     ⚠️ **`variations` ห้ามส่ง from/to** (ท่อตอบ 400) ⇒ จอนั้นไม่มีช่องวันที่ให้กรอก
        ห้ามโชว์ช่องแล้วเงียบ ๆ ไม่ส่ง — คนกรอกแล้วจะเชื่อว่ากรองแล้ว */
  const [kw, setKw] = useState('')
  const [advOpen, setAdvOpen] = useState(false)
  const [advFrom, setAdvFrom] = useState('')
  const [advTo, setAdvTo] = useState('')
  const canDateFilter = !!zortList && zortList !== 'variations'
  const [zLoading, setZLoading] = useState(!!zortList)
  const [rowKeys, setRowKeys] = useState<string[]>([])

  const loadZort = useCallback(async () => {
    if (!zortList) return
    setZLoading(true); setZErr(''); setZUnknown(false); setZCode(''); setZDesc('')
    try {
      /* ⚠️ variations ห้ามส่ง from/to (ท่อตอบ 400) · เส้นอื่นไม่ส่งก็ได้ = เอาทั้งหมด */
      const qs = new URLSearchParams({ zortlist: zortList, limit: '200' })
      if (kw.trim()) qs.set('keyword', kw.trim())
      /* ⚠️ variations ห้ามส่ง from/to — ท่อตอบ 400 (ดูคำเตือนข้างบน) */
      if (zortList !== 'variations') {
        if (advFrom) qs.set('from', advFrom)
        if (advTo) qs.set('to', advTo)
      }
      const r = await fetch(`/api/web/core?${qs}`)
      const d = await r.json().catch(() => null)
      if (d?.unknown || r.status === 502) {
        setZUnknown(true)
        setZErr(String(d?.error ?? 'ถาม ZORT ไม่สำเร็จ'))
        setZCode(typeof d?.zortCode === 'string' ? d.zortCode : '')
        setZDesc(typeof d?.zortDesc === 'string' ? d.zortDesc : '')
        return
      }
      if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
      setRows(Array.isArray(d.rows) ? d.rows : [])
      setZCount(typeof d.count === 'number' ? d.count : null)
      setRowKeys(Array.isArray(d.rowKeys) ? d.rowKeys.map(String) : [])
      /* ⚠️ เก็บเฉพาะที่เป็นตัวเลขจริง — ช่องที่ท่อไม่ส่งมาต้องไม่กลายเป็น 0 */
      const t: Record<string, number | null> = {}
      for (const spec of totals ?? []) {
        const v = (d as Record<string, unknown>)[spec.key]
        t[spec.key] = typeof v === 'number' ? v : null
      }
      setZTotals(t)
    } catch (e) {
      setZErr(String(e instanceof Error ? e.message : e))
    } finally { setZLoading(false) }
  }, [zortList, totals, kw, advFrom, advTo])
  useEffect(() => { void loadZort() }, [loadZort])

  /** ต่อท่อแล้วและตอบมาเรียบร้อย (มีแถวหรือไม่มีก็ตาม) */
  const zortAnswered = !!zortList && !zLoading && !zUnknown && !zErr && rows !== null
  /* 🔴 **จอชุดนี้เคยพูดขัดกับทะเบียนหน้า** (เจอตอนกวาดจริง 14 ก.ย. 2569 · ใบ t_mu11ncpo)
     จอเขียนว่า "ยังไม่ได้ต่อท่อกับ ZORT" และ "ตารางว่างเพราะยังไม่ได้ดึงข้อมูล"
     ⇒ อ่านได้ว่า **เดี๋ยวก็ต่อ** · แต่ทะเบียนของสองคีย์ (product-variant · leadtime)
        บอกว่า **ยิงตรวจแล้วไม่พบเส้น 404 ครบ** = ไม่มีวันต่อได้ จนกว่า ZORT จะเปิดเส้นใหม่
     ⇒ คนที่อ่านจอจะรอของที่ไม่มีวันมา และคนทำงานรอบหน้าจะเสียเวลาไปลองต่อซ้ำ
     ⇒ ให้จอ **อ่านทะเบียนเอง** แทนที่จะให้แต่ละหน้าจำมาเขียนซ้ำ
        (ถ้าให้แต่ละหน้าเขียนเอง วันหนึ่งทะเบียนเปลี่ยนแล้วจอจะค้างอยู่กับคำเก่าอีก) */
  const reg = SOON[soonKey]
  const impossible = reg?.impossible
  /* 🔴 **"ทำไม่ได้" ไม่ได้แปลว่า "อ่านไม่ได้" เสมอไป** (14 ก.ย. 2569)
     บางคีย์อ่านได้แต่สร้าง/แก้ไม่ได้ (เช่น สินค้าหลากคุณสมบัติ) ⇒ ตารางที่ว่าง
     **ยังว่างเพราะเรายังไม่ได้ต่อท่อ** ไม่ใช่เพราะ ZORT ห้ามอ่าน
     ⇒ ถ้าเขียนรวมกัน จอจะขัดกับหลักฐานที่แสดงอยู่ข้างล่างในจอเดียวกัน */
  const cantRead = Boolean(impossible) && reg?.impossibleScope !== 'write'
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title={title}
        // ⚠️ ZORT เขียน "จำนวน 0 รายการ, …0 บาท" — ของเราเขียนแบบนั้นไม่ได้
        //    เพราะเราไม่ได้นับอะไรเลย ต้องบอกว่ายังไม่ได้ต่อ
        /* 🔴 **บรรทัดนี้ต้องเปลี่ยนตามสถานะจริงของรอบนี้** (แก้ 14 ก.ย. 2569 ตอนต่อท่อ)
             เดิมเขียนตายตัวว่า "ยังไม่ได้ต่อกับ ZORT — ที่ ZORT เมื่อ 3 ก.ย. มี 0 รายการ"
             ⇒ พอต่อท่อแล้วมันกลายเป็น **เท็จสองชั้น**: ต่อแล้ว และเลข 0 นั้นเป็นคำบอกเล่าเก่า
             ⇒ จอโอนเงินหนักสุด: หัวจอยืนยัน "0 รายการ" ทั้งที่ข้างล่างบอก "ยังไม่รู้"
                (โรคประจำของโปรเจกต์: ระบบทำงานถูก แต่สื่อสารผิด) */
        summary={cantRead
          /* หลักฐาน+วันที่ยิงตรวจแสดงในกล่อง "หลักฐาน:" ในตารางว่างข้างล่าง (ทะเบียน · 14 ก.ย. 2569) */
          /* ไม่มี sumLabel = ไม่มีเลขที่คัดมาด้วยมือให้อ้าง ⇒ พูดแค่สถานะ ห้ามเดาจำนวน */
          ? <span>ZORT ไม่เปิดเส้นให้ดึงเรื่องนี้{sumLabel ? <> — ที่ ZORT เมื่อ {thaiDate(CHECKED_AT)} {sumLabel}</> : null}</span>
          : !zortList
            ? <span>ยังไม่ได้ต่อกับ ZORT{sumLabel ? <> — ที่ ZORT เมื่อ {thaiDate(CHECKED_AT)} {sumLabel}</> : null}</span>
            : zLoading
              ? <span className="text-gray-500">กำลังถาม ZORT…</span>
              : (zUnknown || zErr)
                ? <span className="text-amber-800">ถาม ZORT ไม่สำเร็จรอบนี้ — <b>ยังไม่รู้ว่ามีกี่รายการ</b> (ไม่ใช่ 0)</span>
                : <span>ถาม ZORT สดรอบนี้ — <b>{zCount ?? rows?.length ?? 0} รายการ</b></span>}
        actions={
          <>
            {withImport && (
              <Link href={`/core/soon/${soonKey}`}
                className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
                นำเข้าไฟล์ (Excel)
              </Link>
            )}
            {!noCreate && (
              /* ✅ มีจอจริงแล้วต้องพาไปของจริง — ปล่อยให้ชี้หน้า soon ทั้งที่ของเสร็จแล้ว
                 คือโรคที่เคยเจอกับ /core/purchases/new (คนอ่านว่า "ยังไม่ได้ทำ" ทั้งที่มีมา 8 วัน) */
              <Link href={createHref ?? `/core/soon/${soonKey}`}
                className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
                style={{ background: '#4669e5' }}>
                {createLabel}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* 🔴 ช่องค้นหาเคยเป็นช่องเทาที่พิมพ์ไม่ได้ทุกจอ — ตอนนี้จอที่ต่อท่อแล้วใช้ได้จริง
            (เส้น ?zortlist= รับ keyword มาตั้งแต่แรก แค่จอไม่เคยเปิดให้ใช้)
            ⚠️ จอที่ยังไม่ต่อท่อยังเทาเหมือนเดิม และบอกเหตุผลตอนชี้ค้าง — ไม่ใช่เทาเฉย ๆ */}
        <input
          placeholder="พิมพ์คำค้นหา"
          disabled={!zortList}
          value={zortList ? kw : ''}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void loadZort() }}
          title={zortList ? 'พิมพ์แล้วกด Enter — ค้นที่เซิร์ฟเวอร์ ครอบทุกรายการ ไม่ใช่แค่หน้าที่เห็น'
            : 'จอนี้ยังไม่ได้ต่อท่อกับ ZORT จึงยังไม่มีอะไรให้ค้น'}
          className={`w-full max-w-[400px] text-[13px] border border-gray-300 rounded-full px-4 py-2 ${
            zortList ? 'bg-white text-gray-800' : 'bg-gray-50 text-gray-400'}`}
        />
        {zortList
          ? (
            <>
              <button type="button" onClick={() => void loadZort()}
                className="text-[13px] text-blue-600 hover:underline">ค้นหา</button>
              {canDateFilter && (
                <button type="button" onClick={() => setAdvOpen((v) => !v)}
                  className="text-[13px] text-blue-600 hover:underline">
                  {advOpen ? 'ปิดค้นหาขั้นสูง' : 'ค้นหาขั้นสูง'}
                </button>
              )}
              {/* 🔴 `variations` ท่อไม่รับช่วงวันที่ ⇒ **ไม่โชว์ปุ่มเลย ดีกว่าโชว์แล้วเงียบ ๆ ไม่ส่ง**
                  และบอกด้วยว่าทำไมไม่มี ไม่ใช่หายไปเฉย ๆ */}
              {!canDateFilter && (
                <span className="text-[13px] text-gray-300 cursor-help"
                  title="ชุดข้อมูลนี้ของ ZORT ไม่มีวันที่ให้กรอง (ท่อตอบ 400 ถ้าส่งช่วงวันไป) — ค้นด้วยคำค้นได้อย่างเดียว">
                  ค้นหาขั้นสูง (ไม่มีวันที่ให้กรอง)
                </span>
              )}
            </>
          )
          : (
            /* ⚠️ เทาอ่อน = กดไม่ได้ แต่ **เทาเฉย ๆ ไม่ได้บอกว่าทำไม** ⇒ ใส่คำอธิบายตอนชี้ค้าง */
            <span className="text-[13px] text-gray-300 cursor-help"
              title="จอนี้ยังไม่ได้ต่อท่อกับ ZORT จึงยังไม่มีข้อมูลให้ค้นหา">
              ค้นหาขั้นสูง
            </span>
          )}
      </div>

      {/* 🔍 แผงค้นหาขั้นสูง — มีเฉพาะช่องที่ท่อกรองให้จริง (คำค้น + ช่วงวันที่) */}
      {advOpen && canDateFilter && (
        <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-3 flex flex-wrap items-end gap-3">
          <label className="text-[12.5px] text-gray-600">
            <span className="block mb-1">ตั้งแต่วันที่</span>
            <input type="date" value={advFrom} onChange={(e) => setAdvFrom(e.target.value)}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white" />
          </label>
          <label className="text-[12.5px] text-gray-600">
            <span className="block mb-1">ถึงวันที่</span>
            <input type="date" value={advTo} onChange={(e) => setAdvTo(e.target.value)}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white" />
          </label>
          <button type="button" onClick={() => void loadZort()}
            className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
            ค้นหาตามช่วงนี้
          </button>
          <button type="button"
            onClick={() => { setAdvFrom(''); setAdvTo('') }}
            className="text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
            ล้างช่วงวันที่
          </button>
          <span className="text-[11.5px] text-gray-500 max-w-[420px] leading-snug">
            ใส่ช่องเดียวก็ได้ · คำค้นและช่วงวันที่ <b>กรองที่เซิร์ฟเวอร์</b> (ครอบทุกรายการ ไม่ใช่แค่หน้าที่เห็น)
          </span>
        </div>
      )}

      {dateLine && <p className="text-[12.5px] text-gray-600 mb-2">{dateLine}</p>}

      {(withTabs || tabs) && (
        <div className="flex flex-wrap items-center gap-6 border-b border-gray-200 mb-0 px-1">
          {/* ⚠️ ป้าย "รอชำระ (0)" มีวงเล็บศูนย์ตามจอจริง (zort-ui/53) — ZORT ใส่ตัวเลขเฉพาะแท็บนี้
              และศูนย์ตรงนี้เป็นความจริง (ร้านไม่ใช้จอนี้ ตัวจริงลงที่ PEAK) ไม่ใช่เลขแต่ง */}
          {(tabs ?? ['ทั้งหมด', 'รอชำระ (0)', 'สำเร็จ']).map((t, i) => (
            <span key={t}
              className={`text-[13.5px] pb-2 ${i === 0 ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-400'}`}>
              {t}
            </span>
          ))}
          {/* ผัง ZORT มีปุ่มรีเฟรช (วงกลมลูกศร) มุมขวาของแถบแท็บ — จอชุดนี้ไม่มีข้อมูลให้โหลดใหม่
              ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก ⇒ โชว์ตามผังแต่ล็อกพร้อมเหตุผล
              ⚠️ **เฉพาะแท็บชุดรายได้/รายจ่าย (withTabs) เท่านั้น** — เทียบภาพจริงทีละจอแล้ว:
                 ภาพ 53/28 (รายได้อื่น/รายจ่ายอื่น) **มี** ปุ่มนี้ · ภาพ 18 (เอกสารบัญชี แท็บ custom)
                 **ไม่มี** ⇒ ถ้าโชว์ทุกจอ tooltip ที่เขียนว่า "ZORT มีปุ่มตรงนี้" จะโกหกในจอ 18 */}
          {withTabs && !tabs && (
            <span title="ZORT มีปุ่มโหลดใหม่ตรงนี้ — จอนี้ยังไม่ได้ต่อข้อมูล ไม่มีอะไรให้โหลด"
              className="ml-auto mb-1 w-7 h-7 grid place-items-center rounded border border-gray-200
                bg-gray-50 text-gray-300 cursor-not-allowed select-none">⟳</span>
          )}
        </div>
      )}

      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH} style={{ width: 44 }}>#</th>
              {cols.map((c) => <th key={c.label} className={c.right ? THR : TH}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* ── ต่อท่อแล้วและมีแถวจริง ⇒ แสดงแถว (สภาพที่ยังไม่เคยเกิดกับร้านนี้ เพราะทุกชุดมี 0 รายการ
                   ⇒ ทดสอบด้วยท่อปลอมแทน — ถ้าไม่ทดสอบ ทางนี้จะไม่เคยถูกเดินเลยสักครั้ง) ── */}
            {zortAnswered && rows!.length > 0 && rows!.map((r, i) => {
              const cells = (zortList && ROW_MAPS[zortList]) ? ROW_MAPS[zortList](r) : []
              return (
                <tr key={i} className="border-b border-[#e8ecf8] last:border-0 bg-white">
                  <td className="px-3 py-2.5 text-[12.5px] text-gray-400">{i + 1}</td>
                  {cols.map((c, j) => (
                    <td key={c.label} className={`px-3 py-2.5 text-[12.5px] text-gray-700 ${c.right ? 'text-right' : ''}`}>
                      {/* ⚠️ ฟิลด์หาย = "—" **ห้ามเดาค่า** (ยังไม่เคยเห็นรูปแถวจริงของ ZORT) */}
                      {cells[j] === null || cells[j] === undefined || cells[j] === '' ? '—' : String(cells[j])}
                    </td>
                  ))}
                </tr>
              )
            })}
            {zortAnswered && rows!.length > 0 && !(zortList && ROW_MAPS[zortList]) && (
              <tr><td colSpan={cols.length + 1} className="px-3 py-2 text-[12px] text-amber-800 bg-amber-50">
                ⚠️ ได้ข้อมูลมาแล้วแต่จอยังไม่รู้ว่าช่องไหนคืออะไร — ช่องที่ท่อส่งมา: {rowKeys.join(' · ') || '(ไม่ได้บอก)'}
              </td></tr>
            )}
            {/* 🔴 **ตัวนับกับตัวแถวต้องมาที่เดียวกัน หรือไม่ก็บอกว่าต่างกัน** (CLAUDE.md กฎแท็บข้อ 4)
                   เราขอท่อมาได้ครั้งละ 200 แถว แต่ `count` เป็นของทั้งชุด
                   ⇒ ถ้าไม่เขียนกำกับ คนจะอ่านว่าแถวที่เห็น = ทั้งหมด แล้วสรุปยอดผิด
                   (เคยพลาดมาแล้วสามเคสในวันเดียว: แท็บยกเลิก 44 · หมวดโซ่ · แท็บของหมด) */}
            {zortAnswered && rows!.length > 0 && zCount !== null && zCount > rows!.length && (
              <tr><td colSpan={cols.length + 1} className="px-3 py-2 text-[12px] text-amber-800 bg-amber-50">
                ⚠️ ZORT บอกว่ามีทั้งหมด <b>{zCount} รายการ</b> แต่จอนี้ดึงมาได้ <b>{rows!.length} แถว</b> (ครั้งละ 200)
                — แถวที่เห็นยังไม่ใช่ทั้งหมด
              </td></tr>
            )}
            {!(zortAnswered && rows!.length > 0) && (
            <tr>
              <td colSpan={cols.length + 1} className="py-14 text-center">
                <span className="text-[34px] block opacity-60">🗂️</span>
                <p className="text-[14px] text-gray-800 mt-2">
                  {/* หลักฐาน+วันที่ยิงตรวจของคีย์นี้อยู่ในกล่อง "หลักฐาน:" ข้างบน (ทะเบียน 14 ก.ย. 2569) */}
                  {zLoading ? 'กำลังถาม ZORT…'
                    /* 🔴 resCode 500 = **ขัดข้องฝั่ง ZORT เอง** (ฝั่งท่อยิงตรวจ 23:00 14 ก.ย. 2569
                       ใส่ช่วงวันสองช่วงและใส่คำค้นก็ได้ 500 เหมือนกันหมด ⇒ ไม่ใช่พารามิเตอร์เราผิด)
                       ⚠️ ห้ามเขียนสาเหตุเกินนี้ — ยังไม่รู้ว่าพังเพราะร้านไม่มีรายการ หรือพังทุกร้าน */
                    : zUnknown && zCode === '500' ? 'ZORT ขัดข้องฝั่งเขา (ข้อผิดพลาดภายในของ ZORT) — ยังไม่รู้ว่ามีรายการโอนเงินไหม'
                      : zUnknown ? 'ถาม ZORT ไม่สำเร็จ — ยังไม่รู้ว่ามีกี่รายการ'
                        : zortAnswered ? 'ZORT ตอบแล้วว่าไม่มีรายการ'
                          : cantRead ? 'ZORT ไม่เปิดเส้นให้ทำเรื่องนี้ — ไม่ใช่ยังไม่ได้ทำ'
                            : impossible ? 'ยังไม่ได้ต่อท่อกับ ZORT (และสร้าง/แก้ผ่าน ZORT ไม่ได้ — ดูหลักฐานข้างล่าง)'
                              : 'ยังไม่ได้ต่อท่อกับ ZORT'}
                </p>
                <p className="text-[12.5px] text-gray-500 mt-1 max-w-[520px] mx-auto leading-relaxed">
                  {purpose}
                  <br />
                  {/* 🔴 ประโยคนี้คือหัวใจของจอนี้ — ห้ามถอด
                      ตารางว่างที่ไม่บอกเหตุผล จะถูกอ่านว่า "ร้านไม่มีรายการพวกนี้เลย" */}
                  {/* ⚠️ ประโยคนี้ต้องเปลี่ยนตามหลักฐาน ไม่งั้นจะขัดกับกล่องเขียวข้างล่างที่บอกว่า
                      "ตรวจแล้วว่างจริง" — สองข้อความบนจอเดียวกันห้ามพูดคนละเรื่อง */}
{/* 🔴 (14 ก.ย. 2569) คำว่า "ZORT ไม่เปิดเส้น" คือ **คำกล่าวอ้าง** ⇒ ต้องมีหลักฐานติดตัว
                      หลักฐาน (พร้อมวันที่ยิงตรวจ) อยู่ในทะเบียน lib/zort-menu.ts ช่อง impossible
                      ของคีย์นั้น ๆ และ **แสดงให้คนอ่านเห็นในกล่องข้างล่าง** ไม่ได้ซ่อนไว้ในโค้ด
                      (ทะเบียนเป็นที่เดียวที่วันที่จะถูกอัปเดตเมื่อยิงตรวจใหม่ · ตัวประกอบร่วมนี้
                       เขียนวันที่ตายตัวไม่ได้ เพราะใช้กับหลายคีย์ที่ยิงตรวจคนละวัน — 14 ก.ย. 2569) */}
                  {/* 🔴 **ต่อท่อแล้ว ⇒ คำอธิบายต้องเป็นผลจริงจาก ZORT ไม่ใช่คำบอกเล่าเมื่อ 3 ก.ย.** */}
                  {zUnknown
                    ? <><b>ถาม ZORT ไม่สำเร็จ</b> ({zErr}) — <b>ยังไม่รู้ว่ามีรายการไหม</b>
                      {' '}⚠️ <b>ไม่ได้แปลว่าไม่มีรายการ</b> และ<b>ไม่ได้แปลว่า ZORT ไม่มีเส้นนี้</b> —
                      {' '}เส้นมีจริงแต่ ZORT ตอบผิดพลาดกลับมา ⇒ ลองรีเฟรชอีกครั้ง
                      {/* 🔴 ข้อความดิบของ ZORT — โชว์ตัวเล็กไว้ให้คนไล่ต่อได้ ไม่ต้องเปิด DevTools
                          (ฝั่งท่อส่งช่อง zortDesc มาให้ใช้ได้กับทุก kind ของ ?zortlist=) */}
                      {zDesc && (
                        <><br /><span className="text-[11.5px] text-gray-400">
                          ข้อความจาก ZORT{zCode ? ` (resCode ${zCode})` : ''}: <span className="font-mono">{zDesc}</span>
                        </span></>
                      )} · </>
                    : zErr
                      ? <><b>ดึงข้อมูลไม่สำเร็จ</b> ({zErr}) — ยังไม่รู้ว่ามีรายการไหม · </>
                      : zortAnswered
                        ? <>ถาม ZORT สดตอนเปิดหน้านี้ — <b>ZORT ตอบเองว่ามี {zCount ?? rows!.length} รายการ</b>
                          {hadHandCheck && <>{' '}(ไม่ใช่คำบอกเล่าจากการเปิดจอดูเมื่อ {thaiDate(CHECKED_AT)} อีกแล้ว)</>} · </>
                        : cantRead
                          ? <>ตารางว่างเพราะ<b>ZORT ไม่เปิดเส้นให้ดึงเรื่องนี้</b> — ไม่ใช่เพราะเรายังไม่ได้ทำ
                            {' '}และไม่ใช่เพราะร้านไม่มีรายการ · </>
                          : emptyProof
                            ? <>ตารางว่างเพราะ<b>เรายังไม่ได้ต่อท่อ</b> — และ<b>ตรวจแล้วว่าใน ZORT ก็ไม่มีรายการจริง</b> · </>
                            : <>ตารางว่างเพราะ<b>ยังไม่ได้ดึงข้อมูล</b> ไม่ใช่เพราะร้านไม่มีรายการ · </>}
                  {/* 🔴 **อย่าเติมคำว่า "มี" หน้า sumLabel** — ทุกจอที่เรียกใช้ส่งค่ามาว่า
                      "มี 0 รายการ" อยู่แล้ว ⇒ เดิมจอขึ้นว่า "มี มี 0 รายการ" (เจอตอนกวาดจริง 14 ก.ย. 2569)
                      บรรทัด summary ข้างบน (ที่ไม่เติม "มี") คือรูปแบบที่ถูก ⇒ ยึดอันนั้น
                      ⚠️ คำซ้ำแบบนี้ tsc ไม่จับ และอ่านโค้ดเฉย ๆ ก็ไม่เห็น เพราะสองท่อนอยู่คนละไฟล์ */}
                  {/* 🔴 **ถามสดได้แล้ว ⇒ เลิกอ้างคำบอกเล่าเมื่อ 3 ก.ย.** (14 ก.ย. 2569)
                      ปล่อยไว้คู่กันจะอ่านเหมือนมีสองตัวเลขจากสองแหล่ง ซึ่งเป็นสิ่งที่กฎข้อ 4 ห้าม
                      ⇒ จอที่ยังไม่ต่อท่อเท่านั้นที่ยังต้องใช้คำบอกเล่า
                      🔴 **และตอนถาม ZORT ไม่สำเร็จก็ห้ามอ้างเลขเก่า** (แก้ 14 ก.ย. 2569 23:xx)
                         จอโอนเงินเคยขึ้นสองประโยคติดกัน: "ยังไม่รู้ว่ามีรายการไหม" แล้วต่อด้วย
                         "เมื่อ 3 ก.ย. มี 0 รายการ จำนวนเงินรวม 0 บาท" ⇒ คนอ่านเก็บเลข 0 ไปใช้
                         ซึ่งเป็นสิ่งที่ประโยคแรกเพิ่งบอกว่ายังไม่รู้ ⇒ กั้นด้วย !zortList */}
                  {!zortList && !zortAnswered && sumLabel && (
                    <>ตอนไปเปิดดูจอ ZORT ของจริงเมื่อ <b>{thaiDate(CHECKED_AT)}</b>
                      {age != null && <> ({age === 0 ? 'วันนี้' : `${age} วันที่แล้ว`})</>}{' '}
                      <b>{sumLabel}</b> · </>
                  )}
                  {meanwhile}
                </p>
                {/* 🔴 (14 ก.ย. 2569) **หลักฐานต้องอยู่บนจอ ไม่ใช่แค่ในทะเบียน** — ถ้าจอบอกแค่ว่า "ZORT ไม่เปิดเส้น"
                    คนอ่านไม่มีทางรู้ว่าใครตรวจ ตรวจเมื่อไหร่ ลองชื่อไหนบ้าง แล้วจะเชื่อหรือไม่เชื่อก็ได้ทั้งคู่
                    ⇒ ดึงข้อความจากทะเบียน (ซึ่งมีวันที่และชื่อเส้นที่ลองยิง) มาแสดงตรงนี้ */}
                {impossible && (
                  <p className="text-[12px] text-red-900 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3 max-w-[520px] mx-auto leading-relaxed text-left">
                    <b>หลักฐาน:</b> {impossible}
                    {reg?.meanwhile && <><br /><span className="text-red-800">ระหว่างนี้: {reg.meanwhile}</span></>}
                  </p>
                )}
                {/* ✅ ถ้ามีหลักฐานว่าว่างจริง ให้พูดให้ต่างจาก "ยังไม่ได้ดึง" อย่างชัดเจน
                    — และชี้ไปที่ของที่เก็บไว้ ไม่งั้นคนหาไม่เจอว่ามีคนตรวจให้แล้ว
                    🔴 **แต่ซ่อนตอนถาม ZORT ไม่สำเร็จ** — หัวกล่องเพิ่งบอกว่า "ยังไม่รู้ว่ามีกี่รายการ"
                       แล้วมีป้ายเขียว "ตรวจแล้วว่างจริง" ต่อท้าย = พูดสองอย่างขัดกันในกล่องเดียว
                       และป้ายนี้เป็นของที่คัดด้วยมือเมื่อ 6 ก.ย. ไม่ใช่คำตอบของรอบนี้ */}
                {emptyProof && !zUnknown && !zErr && (
                  <p className="text-[12.5px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mt-3 max-w-[520px] mx-auto leading-relaxed">
                    ✅ <b>ตรวจแล้วว่างจริง</b> — {emptyProof}
                    <br />
                    <span className="text-emerald-800">ต่างจาก &ldquo;0 รายการ&rdquo; ที่อ่านมาด้วยช่วงวันเริ่มต้นของ ZORT ซึ่งแคบมาก</span>
                    {' · '}
                    <Link href="/core/zort-archive" className="underline">ดูของที่คัดเก็บไว้</Link>
                  </p>
                )}

                {/* 🔴 **ตาข่ายที่ประกาศวันหมดอายุของตัวเอง** — กฎ nets-expire-silently
                    ตัวเลขที่คัดมาด้วยมือจะเก่าลงทุกวันโดยไม่มีอะไรฟ้อง
                    ⇒ ให้จอบอกเองว่ามันเก่าเกินจะอ้างอิงแล้ว ดีกว่ารอให้มีคนสังเกต
                    🔴 **เฉพาะจอที่ยังไม่ต่อท่อ** — จอที่ต่อแล้วไม่มี "ตัวเลขที่คัดมาด้วยมือ" ให้เก่า
                       ถ้าไม่กั้น อีก 34 วันจอที่ต่อท่อแล้วจะสั่งให้คนไปแก้ CHECKED_AT เปล่า ๆ */}
                {!zortList && age != null && age > STALE_DAYS && (
                  <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3 max-w-[520px] mx-auto leading-relaxed">
                    ⚠️ ตัวเลขข้างบนคัดมาด้วยมือเมื่อ <b>{age} วันที่แล้ว</b> —
                    เก่าเกินจะเชื่อแล้ว <b>ไปเปิดจอ ZORT ดูอีกครั้ง</b> แล้วแก้ค่า
                    <code className="mx-1">CHECKED_AT</code> ใน <code>LedgerScreen.tsx</code>
                  </p>
                )}
              </td>
            </tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      {/* แถบท้ายตารางตามผัง ZORT — ขวามือ "จำนวน N รายการ | จำนวนต่อหน้า [20]"
          ⚠️ ล็อกไว้ทั้งคู่ เพราะยังไม่มีข้อมูลให้แบ่งหน้า · โชว์ตามผังแต่ไม่แกล้งใช้ได้
             และ **ห้ามเขียนจำนวนเป็นเลข** เพราะเรายังไม่ได้นับอะไรเลย ศูนย์ของเรา = "ยังไม่รู้" */}
      <div className="flex flex-wrap items-center justify-end gap-3 mt-3">
        <span className="text-[12.5px] text-gray-400">
                  {/* หลักฐาน+วันที่ยิงตรวจของคีย์นี้อยู่ในกล่อง "หลักฐาน:" ข้างบน (ทะเบียน 14 ก.ย. 2569) */}
          {/* 🔴 ต่อท่อแล้วต้องบอกจำนวนจริง — ปล่อยเป็น "ยังไม่ได้ดึงข้อมูล" ทั้งที่ดึงมาแล้ว
              คือข้อความที่ขัดกับตารางข้างบนในจอเดียวกัน (14 ก.ย. 2569) */}
          {/* 🔴 ยอดรวมจากท่อ — วางไว้ข้างจำนวน เพราะคนอ่านสองอันนี้คู่กันเสมอ
              ⚠️ null = ท่อไม่ได้ส่งช่องนั้นมา ⇒ "ยังไม่รู้" **ห้ามเป็น 0** */}
          {zortAnswered && (totals ?? []).map((spec) => (
            <span key={spec.key} className="text-[12.5px] text-gray-500 mr-3">
              {spec.label}{' '}
              {zTotals[spec.key] === null || zTotals[spec.key] === undefined
                ? <span className="text-amber-700" title="ท่อไม่ได้ส่งยอดรวมช่องนี้มา — ไม่ใช่ศูนย์">ยังไม่รู้</span>
                : <b className="text-gray-700">{fmtMoney(zTotals[spec.key] as number)} บาท</b>}
            </span>
          ))}
          {zortAnswered
            ? (zCount !== null && zCount > rows!.length
              ? `จำนวน ${zCount} รายการ (แสดง ${rows!.length})`
              : `จำนวน ${zCount ?? rows!.length} รายการ`)
            : zUnknown ? 'ยังไม่รู้จำนวน (ถาม ZORT ไม่สำเร็จ)'
              : cantRead ? 'ไม่มีข้อมูลให้ดึง (ZORT ไม่เปิดเส้น)' : 'ยังไม่ได้ดึงข้อมูล'} | จำนวนต่อหน้า
        </span>
        <select
          disabled
          /* หลักฐาน+วันที่ยิงตรวจอยู่ในกล่อง "หลักฐาน:" บนจอ (มาจากทะเบียน · 14 ก.ย. 2569) */
          title={cantRead
            ? 'ZORT ไม่เปิดเส้นให้ดึงเรื่องนี้ จึงไม่มีข้อมูลให้แบ่งหน้า'
            : 'ยังไม่ได้ต่อท่อกับ ZORT จึงยังไม่มีข้อมูลให้แบ่งหน้า'}
          className="text-[12.5px] border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          <option>20</option>
        </select>
      </div>

      <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
        {/* 🔴 **ประโยค "ปุ่มยังทำงานไม่ได้" กลายเป็นเท็จทันทีที่จอสร้างเสร็จ** (14 ก.ย. 2569)
            จอคืนสินค้าให้ผู้ขายมีจอสร้างจริงแล้ว แต่ท้ายจอยังบอกว่ากดแล้วจะเจอหน้าบอกว่าติดอะไร
            ⇒ คนอ่านแล้วไม่กด · โรคเดิม: ของถูก แต่จอบอกผิด แล้วคนเลิกหา
            ⇒ ผูกกับ createHref (มี = ปุ่มพาไปของจริง) แทนการเขียนตายตัว */}
        ผังจอลอกจาก ZORT ของจริง
        {!noCreate && createHref && <> · ปุ่ม <b>{createLabel}</b> ใช้งานได้จริง</>}
        {!noCreate && !createHref && <> · ปุ่ม <b>{createLabel}</b></>}
        {withImport && <> และ <b>นำเข้าไฟล์ (Excel)</b></>}
        {!noCreate && !createHref && ' ยังทำงานไม่ได้ กดแล้วจะบอกว่าติดอะไรอยู่'}
        {!noCreate && createHref && withImport && <> · ส่วน <b>นำเข้าไฟล์</b> ยังทำงานไม่ได้</>}
        {!noCreate && ' · '}
        {/* ⚠️ เหตุผล "ไม่มีข้อมูลให้ส่งออก" ใช้ได้เฉพาะตอนไม่มีแถวจริง ๆ
            พอต่อท่อแล้วมีแถว เหตุผลนี้กลายเป็นเท็จทันที ⇒ ต้องเปลี่ยนตามของจริง */}
        {zortAnswered && rows!.length > 0
          ? <><b> ยังไม่มีปุ่ม Export to Excel</b> แบบ ZORT — <b>ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้</b>
            {' '}(ตอนนี้มีข้อมูลให้ส่งออกแล้ว)</>
          : <><b> ไม่มีปุ่ม Export to Excel</b> แบบ ZORT เพราะไม่มีข้อมูลให้ส่งออก —
            {' '}ปุ่มที่กดแล้วได้ไฟล์เปล่าแย่กว่าไม่มีปุ่ม</>}
      </p>
    </div>
  )
}
