'use client'
// สต็อกที่ดันขึ้นหน้าร้านไม่สำเร็จ — "รหัสที่ถูกข้ามจากการดันสต็อก และค้างมานานแค่ไหน"
//
// 🔴 **ที่มา 27 ก.ย. 2569** — ยิง `?pushstate=1` ของจริงแล้วพบว่า
//    สวิตช์ดันสต็อกเปิดอยู่ (`autoOn: true` ทั้งสามช่อง · shopee/tiktok `mode: live`)
//    และรอบที่ผมดูตอนนั้นได้ `pushed 0` ⇒ สต็อกบนหน้าร้านของรหัสที่ถูกข้ามค้างจริง 6–9 วัน
//    🔴 **แก้คำกล่าวอ้างนี้ 27 ก.ย. 2569 บ่าย (ผมเขียนเองตอนเช้าแล้วมันเท็จภายในวันเดียว)**
//       ตอนเช้าผมเขียนว่า "ทุกรอบได้ pushed 0" ⇒ **ไม่จริง** · รอบ 27 ก.ย. หลังท่อเปิดช่อง `fired`
//       ได้ `planned 64 · fired 2 · pushed 2 · rejected 0` ⇒ **มันดันได้จริง แค่ยิงได้ ~2 ตัวต่อรอบ**
//       ⇒ **แก้รอบที่สองภายในชั่วโมงเดียวกัน**: ผมเขียนต่อว่า "อาการคือปริมาณต่อรอบ" ⇒ **ก็ผิดอีก**
//          ฝั่งท่อไล่ซอร์สถึงตัวยิงจริง: เพดานต่อรอบคือ 40 · งบเวลา 18 วิ (ใช้ไป 9.3 วิ)
//          ⇒ **ไม่ใช่ทั้งเพดานและงบเวลา** · ของจริงคือ 62 ตัว **ถูกคัดออกก่อนยิงด้วยด่านรายตัว**
//          (แผนไม่สดแล้ว · รหัสอยู่หลายที่บนแพลตฟอร์มจนต้องให้คนดู · ด่านอื่น)
//          🔑 บทเรียนสองรอบติด: ผมรีบตั้งชื่ออาการจากเลขที่เห็น ทั้งที่ยังไม่รู้ว่าเลขนั้นเกิดจากกลไกไหน
//             ⇒ **ชื่ออาการคือข้อสรุป ไม่ใช่ข้อมูล** ⇒ จอนี้จึงเขียนแต่เลขที่วัดได้
//             และเรียกส่วนที่ยังไม่มีคอลัมน์ในสมุดว่า "ยังไม่รู้" ห้ามเป็น 0
//       🔑 คำว่า "ทุกรอบ" มาจากการดูรอบเดียว ⇒ **ห้ามเขียนคำที่ครอบทุกรอบจากตัวอย่างเดียว**
//    ข้อมูลรายรหัสมีอยู่แล้วที่ `?pushstuck=1` **แต่ไม่มีจอไหนโชว์** ⇒ เห็นได้ทางเดียวคือยิง API เอง
//
// 🔑 **สามช่องที่จอนี้ต้องมี (ฝั่งท่อกำหนดมาเอง และเหตุผลสำคัญกว่าตัวช่อง)**
//    ① ค้างกี่วัน + streak                     ← ความรุนแรง
//    ② รหัสนี้มีอยู่ในกระจกสต็อกไหม              ← **แยก "รหัสลูกที่เราไม่รู้จัก" ออกจาก "คลังติดลบ"**
//    ③ ค่าที่กระจกมี กับค่าที่เคยยิง/ยืนยัน       ← ตัวเลขสองฝั่งต้องไม่ถูกวางคู่กันโดยไม่บอกที่มา
//    ⚠️ ถ้าไม่มีช่อง ② คนอ่านจอจะสรุปว่า "คลังติดลบ 28 รหัส" ทั้งที่ 28 รหัสนั้น**ไม่มีในกระจกเลย**
//
// ⚠️ **กับดักที่จอนี้ต้องพูดออกมา ไม่ใช่ซ่อน**
//    · เลขในตารางมาจาก **สองแหล่ง**: สมุดข้าม (`push_state`) กับกระจกสต็อก (`list=stock`)
//      ⇒ เขียนกำกับทุกคอลัมน์ว่ามาจากไหน (กฎแท็บข้อ 4 ของ CLAUDE.md)
//    · **"ไม่มีในกระจก" ไม่เท่ากับ "สต็อกเป็น 0"** ⇒ ต้องขึ้นคำว่าไม่มี ห้ามขึ้นเลข 0
//    · สินค้า **บริการ** (`service: true`) ติดลบเป็นเรื่องปกติ (ไม่มีสต็อกให้ตัด)
//      ⇒ ต้องแยกออกจากกองก่อนนับ ไม่งั้นตัวเลข "ติดลบ" พองด้วยของที่ไม่ผิด
//    · ค่าที่ **แพลตฟอร์มถืออยู่จริง** เส้นนี้ไม่ได้ส่งมา ⇒ ช่องนั้นต้องขึ้น "ยังไม่รู้" ไม่ใช่ 0
//    · เวลาจากท่อเป็น UTC ⇒ ใช้ `ageInThaiDays(raw, true)` / `thaiDateUtc` ห้ามบวก 7 เอง
import { useCallback, useEffect, useState } from 'react'
import { ageInThaiDays, fmtNum, thaiDateUtc } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import PillButton from '@/components/ui/PillButton'

type แถวค้าง = {
  sku: string
  channel: string
  skip_reason: string
  skip_streak: number | null
  skip_first_at: string | null
  skip_last_at: string | null
  last_error: string | null
  planned_qty: number | null
  pushed_qty: number | null
  verified_qty: number | null
}
/** สภาพในกระจก — `null` = **ยังไม่ได้ตรวจ** (ต่างจาก `มี: false` ที่แปลว่าตรวจแล้วไม่มี) */
type สภาพกระจก = { มี: boolean; available: number | null; name: string; service: boolean; active: boolean }

/** ผลเทียบสต็อกกับแพลตฟอร์ม (`?stockcompare=1`) — **มีแต่ Shopee** (ฝั่งท่อยืนยัน 26 ก.ย. 2569)
 *  ⚠️ `diff` ถูกตัดที่ 50 แถวขณะที่ `diffCount` เป็น 100 (`diffTruncated: true`)
 *     ⇒ รหัสที่ไม่อยู่ในอาเรย์ **ไม่ได้แปลว่าไม่ต่าง** ⇒ จอต้องเขียนว่า "ไม่อยู่ในผลที่ส่งมา"
 *  ⚠️ `core` กับ `directQty` เป็นสองเลขของรหัสเดียวกัน (เทียบด้วยสูตรชุด vs รหัสตรง)
 *     ของจริง: 03409-3 core 503 · directQty **−7** ⇒ ถ้าโชว์แต่ core จะไม่มีใครรู้ว่าอีกวิธีให้ค่าติดลบ */
type แถวเทียบ = { sku: string; shopee: number | null; core: number | null; directQty: number | null; gap: number | null; via: string | null }
type ผลเทียบ = {
  day?: string
  shopeeRows?: number
  same?: number
  matchedByRecipe?: number
  missing?: number
  negativeInCore?: number
  diffCount?: number
  diffTruncated?: boolean
  diff?: แถวเทียบ[]
}

const หน้าละ = 100
const เพดานหน้า = 6        // กันจอดึงทั้งกองในทีเดียว — ถ้าชนเพดานต้องเขียนบนจอว่าชน
const เพดานตรวจกระจก = 60  // ยิงกระจกรายรหัส ⇒ จำกัดไว้ แล้วบอกว่าเหลือกี่รหัสยังไม่ได้ตรวจ
const ยิงพร้อมกัน = 8
/** 🔴 **วัดของจริงบน production 27 ก.ย. 2569 (เปิดจอด้วยตา)**
 *    `pushstuck` 696 ms · `list=stock&q=` **2,789 ms ต่อรหัส** · `stockcompare` 4,981 ms
 *    ⇒ 60 รหัส ÷ พร้อมกัน 4 ≈ **42 วินาที** ⇒ จอค้างที่ "กำลังอ่าน..." นานเกินกว่าที่คนจะรอ
 *    ⇒ ⇒ คนใช้จะอ่านว่าจอพัง **แล้วกดรีโหลด ซึ่งทำให้ยิงซ้ำทั้งชุด**
 *    🔑 แก้สามอย่าง: โชว์ตารางทันทีที่ได้รายการค้าง · เติมช่องกระจกทีละรหัสพร้อมตัวนับความคืบหน้า
 *       · ใส่เวลาตัดต่อคำขอ (คำขอเดียวค้าง ห้ามทำให้ทั้งจอค้างตลอดกาล) */
const เวลาตัดมิลลิ = 15000

/** ชื่อไทยของเหตุที่ท่อส่งมา — **ชื่อที่ไม่รู้จักให้คืนค่าดิบ** ไม่ใช่ซ่อนหรือแปลเดา
 *  (กฎกวาดค่าดิบขึ้นจอ: `MAP[x] ?? x` ทำให้ค่าดิบหลุดออกจอได้ ⇒ ที่นี่ยอมให้หลุดโดยตั้งใจ
 *   เพราะเหตุใหม่ที่ท่อเพิ่ม **ต้องมองเห็น** ไม่ใช่กลายเป็นช่องว่าง) */
function ป้ายเหตุ(k: string): string {
  const แผนที่: Record<string, string> = {
    negative: 'ติดลบ',
    policy_hold: 'กันไว้ตามกติกา',
    policy_down: 'สวิตช์ปิด',
    cap_wait: 'เกินเพดานรอบนี้',
    conflict: 'ชนกัน',
    unknown: 'ไม่ระบุเหตุ',
    null: 'ไม่มีค่าเหตุ',
  }
  return แผนที่[k] ?? k
}

async function ยิงมีเวลาตัด(url: string): Promise<Response> {
  const ตัว = new AbortController()
  const นาฬิกา = setTimeout(() => ตัว.abort(), เวลาตัดมิลลิ)
  try { return await fetch(url, { signal: ตัว.signal }) } finally { clearTimeout(นาฬิกา) }
}

type ผลค้าง = {
  ok?: boolean
  error?: string
  rows?: แถวค้าง[]
  nextOffset?: number | null
  'ทั้งหมดที่ตรงเงื่อนไข'?: number
}

/** รอบกวาดล่าสุดจาก `?pushstate=1` — **ทุกช่องเป็น optional เพราะท่อรุ่นเก่าไม่ส่ง**
 *  🔑 `fired` เพิ่งถูกใส่ใน SELECT ของท่อ 27 ก.ย. 2569 (commit 60ab250)
 *     ⇒ ท่อรุ่นก่อนหน้านั้นส่งมาไม่ครบ ⇒ จอต้องเขียนว่า "ปิดบัญชีไม่ได้" ไม่ใช่โชว์ 0 */
type รอบกวาด = {
  at?: string | null
  channel?: string | null
  mode?: string | null
  planned?: number | null
  fired?: number | null
  pushed?: number | null
  rejected?: number | null
  skipped?: number | null
  ms?: number | null
  /* 🔑 **ชื่อช่องมาจากซอร์สของท่อ ไม่ใช่จากจดหมาย** (ยืนยันด้วยการยิงดูรูปร่างจริง 27 ก.ย. 2569)
     `not_sent` = คัดออกก่อนยิง · `not_fired` = ไม่ได้ยิงเพราะหมดงบเวลา (snake_case ตามคอลัมน์)
     ⚠️ **แถวเก่าเป็น null ตลอดไป** ไม่มีทางย้อนไปวัด · รอบ `fast-skip` ก็ null เพราะรอบนั้นไม่ทำอะไร
     ⇒ `null`/ไม่มีช่อง = **ยังไม่รู้** · `0` = **วัดแล้วได้ศูนย์** — จอต้องเขียนคนละคำ */
  not_sent?: number | null
  not_fired?: number | null
}

/** ชนิดของ "คัดออกก่อนยิง" — **ชุดปิดที่ท่อส่งรายชื่อมาให้เอง**
 *  🚫 ห้ามพิมพ์คำแปลไว้ที่จอ — วันที่ท่อเพิ่มชนิดที่ 7 จอจะได้ `คำอธิบาย` มาเอง
 *     และชนิดที่ไม่อยู่ในรายชื่อ = ท่อรุ่นเก่ากว่าข้อมูล ⇒ จอขึ้นว่า "ยังไม่รู้จัก"
 *  📌 ใช้ `นโยบายเรา` ตัดสินสี **ไม่ใช่ชื่อชนิด** ⇒ ท่อเพิ่มชนิดใหม่ได้โดยจอไม่ต้องแก้ */
type ชนิดไม่ได้ส่ง = { 'นโยบายเรา'?: boolean; 'คำอธิบาย'?: string }

/** เลขที่เชื่อได้เท่านั้น — ค่าที่ไม่ใช่ตัวเลขคืน null ห้ามแปลงเป็น 0 */
const เลข = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** ดึงสมุดข้ามหนึ่งหน้า — แยกออกมาเป็นฟังก์ชันมีชนิดชัด (ในลูปทำให้ TS อ่านชนิดวนตัวเอง) */
async function ดึงหน้าค้าง(offset: number, ช่อง: string, เหตุ: string): Promise<ผลค้าง> {
  const qs = new URLSearchParams({ pushstuck: '1', limit: String(หน้าละ), offset: String(offset) })
  if (ช่อง) qs.set('channel', ช่อง)
  if (เหตุ) qs.set('reason', เหตุ)
  const res = await ยิงมีเวลาตัด(`/api/web/core?${qs}`)
  const j = (await res.json()) as ผลค้าง
  if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`)
  return j
}

export default function จอสต็อกค้าง() {
  const [แถว, setแถว] = useState<แถวค้าง[]>([])
  const [ทั้งหมด, setทั้งหมด] = useState<number | null>(null)
  const [กระจก, setกระจก] = useState<Record<string, สภาพกระจก>>({})
  const [ชนเพดานหน้า, setชนเพดานหน้า] = useState(false)
  const [กำลังโหลด, setกำลังโหลด] = useState(true)
  const [พัง, setพัง] = useState<string | null>(null)
  const [เทียบ, setเทียบ] = useState<ผลเทียบ | null>(null)
  const [กำลังตรวจกระจก, setกำลังตรวจกระจก] = useState(0)
  const [ช่อง, setช่อง] = useState<string>('')
  const [เหตุ, setเหตุ] = useState<string>('')
  const [รอบรายเจ้า, setรอบรายเจ้า] = useState<Record<string, รอบกวาด> | null>(null)
  const [ทะเบียนชนิด, setทะเบียนชนิด] = useState<Record<string, ชนิดไม่ได้ส่ง> | null>(null)
  const [รอบอ่านไม่ได้, setรอบอ่านไม่ได้] = useState<string | null>(null)

  const โหลด = useCallback(async () => {
    setกำลังโหลด(true); setพัง(null); setกระจก({})
    try {
      const เก็บ: แถวค้าง[] = []
      let offset: number | null = 0
      let หน้า = 0
      let รวม: number | null = null
      while (offset !== null && หน้า < เพดานหน้า) {
        const j = await ดึงหน้าค้าง(offset, ช่อง, เหตุ)
        เก็บ.push(...(Array.isArray(j.rows) ? j.rows : []))
        if (typeof j['ทั้งหมดที่ตรงเงื่อนไข'] === 'number') รวม = j['ทั้งหมดที่ตรงเงื่อนไข']
        /* 🔑 เดินหน้าด้วย `nextOffset` ของท่อเท่านั้น — เส้นนี้บีบเพดานเองได้
           ⇒ บวก limit ที่ขอไปเองจะข้ามแถว (ท่อเขียนเตือนไว้ใน `pagingNote`) */
        offset = typeof j.nextOffset === 'number' ? j.nextOffset : null
        หน้า += 1
      }
      setชนเพดานหน้า(offset !== null)
      setแถว(เก็บ); setทั้งหมด(รวม)
      /* 🔑 ปล่อยตารางขึ้นจอก่อน — ช่องกระจก/ผลเทียบค่อยเติมทีละรหัส (ทุกช่องมีสถานะ "ยังไม่ได้ตรวจ" อยู่แล้ว) */
      setกำลังโหลด(false)

      /* ── ② รอบกวาดล่าสุด **รายเจ้า** — ยิงก่อนของช้า (ย้ายขึ้นมาจากท้ายสุด 27 ก.ย. 2569)
         🔴 **เจอด้วยการเปิดจอดูด้วยตาหลัง deploy เท่านั้น**: เดิมก้อนนี้เป็นขั้นสุดท้าย
            ⇒ กล่องขึ้นคำว่า "กำลังอ่านรอบกวาดล่าสุด…" **ค้างนานถึง ~75 วินาที**
            เพราะต้องรอขั้นตรวจกระจกรายรหัส (ยิงทีละรหัส ~2.8 วิ/รหัส) ให้จบก่อน
         ⇒ ของที่สรุปภาพรวมได้ในคำขอเดียว **ต้องมาก่อน** ของที่ละเอียดแต่ช้า
            (หลักเดียวกับที่จอนี้ปล่อยตารางขึ้นก่อนแล้วเติมช่องกระจกทีหลัง)
         🔑 build ผ่านและ typecheck ผ่านไม่จับข้อนี้ได้เลย — มันเป็นเรื่อง **ลำดับเวลา** */
      /* ── เดิมคือขั้น ⑧ รอบกวาดล่าสุด **รายเจ้า** — เพื่อปิดบัญชีรอบนั้น (ท่อเปิดช่องให้ 27 ก.ย. 2569) ──
         🔑 อ่านจาก `byChannel.<เจ้า>.lastSweep` **ไม่ใช่** `lastSweep` บนสุด
            ยิงดูรูปร่างจริงแล้วพบว่า `lastSweep` บนสุด **ไม่มีช่อง `fired`** ⇒ ถ้าอ่านที่นั่น
            จอจะขึ้น "ยังไม่รู้" ตลอดกาลทั้งที่ท่อส่งค่ามาแล้วในอีกที่ */
      try {
        const r = await ยิงมีเวลาตัด('/api/web/core?pushstate=1')
        const j = (await r.json()) as {
          byChannel?: Record<string, { lastSweep?: รอบกวาด }>
          'ชนิดที่ไม่ได้ส่ง'?: Record<string, ชนิดไม่ได้ส่ง>
        }
        const เก็บ: Record<string, รอบกวาด> = {}
        for (const [เจ้า, v] of Object.entries(j?.byChannel ?? {})) {
          if (v?.lastSweep) เก็บ[เจ้า] = v.lastSweep
        }
        setรอบรายเจ้า(Object.keys(เก็บ).length ? เก็บ : null)
        setทะเบียนชนิด(j?.['ชนิดที่ไม่ได้ส่ง'] ?? null)
        setรอบอ่านไม่ได้(Object.keys(เก็บ).length ? null : 'ท่อตอบแต่ไม่มี byChannel.<เจ้า>.lastSweep')
      } catch (e) {
        setรอบรายเจ้า(null)
        setรอบอ่านไม่ได้(e instanceof Error ? e.message : String(e))
      }

      // ── ③ ตรวจว่ารหัสมีในกระจกไหม (ยิงรายรหัส · จำกัดจำนวน แล้วบอกบนจอ) ──
      const รหัส = Array.from(new Set(เก็บ.map((x) => x.sku))).slice(0, เพดานตรวจกระจก)
      const ผล: Record<string, สภาพกระจก> = {}
      const คิว = [...รหัส]
      const ตัวยิง = async () => {
        for (;;) {
          const sku = คิว.shift()
          if (!sku) return
          try {
            const r = await ยิงมีเวลาตัด(`/api/web/core?list=stock&q=${encodeURIComponent(sku)}&limit=1`)
            const j = await r.json()
            const row = Array.isArray(j?.rows) ? j.rows.find((x: { sku?: string }) => x?.sku === sku) : null
            const สภาพ: สภาพกระจก = row
              ? { มี: true, available: typeof row.available === 'number' ? row.available : null,
                  name: String(row.name ?? ''), service: !!row.service, active: !!row.active }
              : { มี: false, available: null, name: '', service: false, active: false }
            ผล[sku] = สภาพ
            setกระจก((เดิม) => ({ ...เดิม, [sku]: สภาพ }))   // เติมทีละรหัส ⇒ เห็นความคืบหน้าจริง
          } catch { /* ยิงไม่ได้ ⇒ ไม่ใส่คีย์ ⇒ จอขึ้น "ยังไม่ได้ตรวจ" ตามสามสถานะ */ }
        }
      }
      setกำลังตรวจกระจก(รหัส.length)
      await Promise.all(Array.from({ length: ยิงพร้อมกัน }, () => ตัวยิง()))
      setกำลังตรวจกระจก(0)

      // ── ⑦ ค่าที่แพลตฟอร์มถืออยู่ (ฝั่งท่อให้เส้นมา 26 ก.ย. 2569) — **มีแต่ Shopee** ──
      try {
        const r = await ยิงมีเวลาตัด('/api/web/core?stockcompare=1')
        const j = (await r.json()) as { stock?: ผลเทียบ }
        setเทียบ(j?.stock ?? null)
      } catch { setเทียบ(null) /* ⇒ จอขึ้น "อ่านผลเทียบไม่ได้" ไม่ใช่ 0 */ }

    } catch (e) {
      setพัง(e instanceof Error ? e.message : String(e))
    } finally {
      setกำลังโหลด(false)
    }
  }, [ช่อง, เหตุ])

  useEffect(() => { void โหลด() }, [โหลด])

  const นับเหตุ = แถว.reduce<Record<string, number>>((a, x) => {
    a[x.skip_reason] = (a[x.skip_reason] ?? 0) + 1; return a
  }, {})
  const ตรวจแล้ว = Object.keys(กระจก).length
  const ไม่มีในกระจก = Object.values(กระจก).filter((x) => !x.มี).length
  const เป็นบริการ = Object.values(กระจก).filter((x) => x.มี && x.service).length
  const ติดลบจริง = Object.values(กระจก).filter((x) => x.มี && !x.service && (x.available ?? 0) < 0).length
  const แผนที่เทียบ: Record<string, แถวเทียบ> = {}
  for (const x of เทียบ?.diff ?? []) แผนที่เทียบ[x.sku] = x
  const ติดลบจากท่อ = typeof เทียบ?.negativeInCore === 'number' ? เทียบ.negativeInCore : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">สต็อกที่ดันขึ้นหน้าร้านไม่สำเร็จ</h1>
        <p className="text-sm text-gray-500">
          รหัสที่ถูกข้ามจากการดันสต็อก — ตัวเลขบนหน้าร้านของรหัสพวกนี้ค้างอยู่กับค่าเก่า
        </p>
      </div>

      {/* ── รอบกวาดล่าสุด: ปิดบัญชีให้ครบ **และบอกว่าก้อนไหนบวกกับก้อนไหนได้** ──
          🔴 ผมเองพลาดข้อนี้ 27 ก.ย. 2569: เอา `planned` ไปบวกกับ `skipped` แล้วสรุปว่า "หายไป 1 รายการ"
             ทั้งที่สองก้อนนั้นไม่ใช่ส่วนของกันและกันเลย ⇒ ผมสร้างคำถามที่ไม่มีอยู่แล้วส่งให้คนอื่นไปไล่
          ⇒ จอนี้จึงต้องเขียน **โซ่ที่ปิดบัญชีได้** ออกมาตรง ๆ ไม่ให้ใครบวกผิดซ้ำ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px] space-y-1">
        <div className="font-semibold">รอบกวาดล่าสุดของแต่ละเจ้า — ปิดบัญชีได้ครบไหม</div>
        {รอบรายเจ้า === null ? (
          <div className="text-gray-500">
            {รอบอ่านไม่ได้
              ? <>🛑 <b>อ่านรอบกวาดล่าสุดไม่ได้</b> ({รอบอ่านไม่ได้}) ⇒ <b>ยังไม่รู้</b> ไม่ใช่ว่าไม่มีรอบ</>
              : 'กำลังอ่านรอบกวาดล่าสุด…'}
          </div>
        ) : (() => {
          /* 🔑 **แยก "ท่อไม่ส่งช่องนี้เลย" ออกจาก "ช่องนี้เป็น null ในรอบนี้"** (27 ก.ย. 2569 · ยิงจริงแล้วเจอ)
             ของจริง: shopee ได้ `not_sent: 62` แต่ lazada/tiktok ได้ `null` เพราะเป็น**แถวเก่า**
             (ท่อเพิ่มคอลัมน์วันนี้ · แถวก่อนหน้านั้นเป็น null ตลอดไป · รอบ `fast-skip` ก็ null)
             ⇒ ถ้าจอเขียนว่า "ท่อยังไม่ส่งช่องนี้" มันจะ**พูดผิด**ทันทีที่มีเจ้าใดเจ้าหนึ่งได้เลขมา
             ⇒ ดูจากทั้งชุด: มีเจ้าไหนได้ตัวเลขไหม ⇒ แปล null ให้ตรงเหตุ */
          const ท่อส่งช่องนี้แล้ว = Object.values(รอบรายเจ้า)
            .some((ร) => เลข(ร.not_sent) !== null || เลข(ร.not_fired) !== null)
          return Object.entries(รอบรายเจ้า)
            .filter(([เจ้า]) => !ช่อง || เจ้า === ช่อง)
            .map(([เจ้า, ร]) => {
          const planned = เลข(ร.planned)
          const fired = เลข(ร.fired)
          const pushed = เลข(ร.pushed)
          const rejected = เลข(ร.rejected)
          const skipped = เลข(ร.skipped)
          const notSent = เลข(ร.not_sent)
          const notFired = เลข(ร.not_fired)
          /* โซ่ที่ฝั่งท่อยืนยันจากซอร์ส (27 ก.ย. 2569):
               planned = fired + not_sent + not_fired      ← ชั้นนอก
               fired   = pushed + rejected  **เป๊ะเสมอ**   ← ชั้นใน
             ⚠️ `skipped` เป็นอีกก้อน ห้ามบวกเข้าโซ่ (ผมเคยบวกแล้วได้ "เลขที่หายไป" ที่ไม่มีจริง)
             🔑 **รับคำยืนยันของอีกฝ่ายมาเป็นด่าน ไม่ใช่มาเป็นความเชื่อ** ⇒ ถ้าวันหนึ่งไม่เป๊ะ จอฟ้องเอง */
          const ชั้นในลงตัว = fired !== null && pushed !== null && rejected !== null
            ? fired === pushed + rejected : null
          const ชั้นนอกลงตัว = planned !== null && fired !== null && notSent !== null && notFired !== null
            ? planned === fired + notSent + notFired : null
          const ยังไม่ได้ยิง = planned !== null && fired !== null ? planned - fired : null
          return (
            <div key={เจ้า} className="border-t pt-2 first:border-t-0 first:pt-0 space-y-1">
              <div className="text-gray-600">
                <b className="text-gray-900">{เจ้า}</b>
                {' · '}{ร.at ? new Date(ร.at).toLocaleString('th-TH') : 'ไม่รู้เวลา'}
                {ร.mode ? ` · โหมด ${ร.mode}` : ''}
                {เลข(ร.ms) !== null ? ` · ${fmtNum(เลข(ร.ms))} ms` : ''}
              </div>
              <div className="text-[15px]">
                ดันขึ้นสำเร็จ <b className="text-green-700">{pushed === null ? 'ยังไม่รู้' : fmtNum(pushed)}</b>
                {' '}จาก <b>{planned === null ? 'ยังไม่รู้' : fmtNum(planned)}</b> ที่วางแผนไว้
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
                <span>ยิงออกไป <b>{fired === null ? 'ยังไม่รู้' : fmtNum(fired)}</b></span>
                <span>ปลายทางตีกลับ <b>{rejected === null ? 'ยังไม่รู้' : fmtNum(rejected)}</b></span>
                <span>คัดออกก่อนยิง <b>{notSent === null ? 'ยังไม่รู้' : fmtNum(notSent)}</b></span>
                <span>หมดงบเวลา <b>{notFired === null ? 'ยังไม่รู้' : fmtNum(notFired)}</b></span>
              </div>
              {(notSent === null || notFired === null) && ยังไม่ได้ยิง !== null && ยังไม่ได้ยิง > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900">
                  🛑 <b>{fmtNum(ยังไม่ได้ยิง)} ตัวที่ไม่ได้ยิงรอบนี้ — ยังแยกไม่ได้ว่าเพราะอะไร</b>
                  {' '}{ท่อส่งช่องนี้แล้ว
                    ? <><b>รอบนี้เป็นแถวเก่า</b> (บันทึกไว้ก่อนที่ท่อจะมีคอลัมน์ <code>not_sent</code>/<code>not_fired</code>
                        {' '}หรือเป็นรอบที่ข้ามเร็ว) ⇒ <b>ไม่มีทางย้อนไปวัด</b> — รอรอบใหม่ของเจ้านี้</>
                    : <>ท่อรุ่นที่เสิร์ฟอยู่<b>ยังไม่ส่ง</b> <code>not_sent</code>/<code>not_fired</code> เลยแม้เจ้าเดียว</>}
                  {' '}⇒ ช่องสองช่องบนเขียนว่า <b>“ยังไม่รู้” ไม่ใช่ 0</b>
                </div>
              )}
              {ชั้นนอกลงตัว === false && (
                <div className="text-red-700">
                  🔴 <b>วางแผน ≠ ยิงออกไป + คัดออกก่อนยิง + หมดงบเวลา</b>
                  {' '}({fmtNum(planned)} ≠ {fmtNum(fired)} + {fmtNum(notSent)} + {fmtNum(notFired)})
                  {' '}⇒ มีทางออกที่ยังไม่ถูกนับ — แจ้งฝั่งท่อ
                </div>
              )}
              {ชั้นนอกลงตัว === true && (
                <div className="text-green-700">✅ ปิดบัญชีรอบนี้ได้ครบทุกตัว</div>
              )}
              {ชั้นในลงตัว === false && (
                <div className="text-red-700">
                  🔴 <b>ยิงออกไป ≠ ดันสำเร็จ + ตีกลับ</b> — ฝั่งท่อยืนยันว่าต้องเป๊ะเสมอ ⇒ แจ้งฝั่งท่อ
                </div>
              )}
              <div className="text-gray-500">
                ถูกข้าม (ไม่เคยเข้าแผนรอบนี้) <b>{skipped === null ? 'ยังไม่รู้' : fmtNum(skipped)}</b>
                {' '}— <b>เป็นอีกก้อน ห้ามเอาไปบวกเข้าโซ่</b>
              </div>
            </div>
          )
        })
        })()}
        <div className="text-gray-500 border-t pt-2">
          🔑 <b>โซ่ที่ปิดบัญชีได้</b>: <code>วางแผน = ยิงออกไป + คัดออกก่อนยิง + หมดงบเวลา</code>
          {' '}· <code>ยิงออกไป = ดันสำเร็จ + ตีกลับ</code>
        </div>
        {ทะเบียนชนิด && (
          <div className="border-t pt-2 space-y-1">
            <div className="font-semibold">เหตุที่ถูกคัดออกก่อนยิง — คำอธิบายมาจากท่อ ไม่ใช่จอแปลเอง</div>
            {Object.entries(ทะเบียนชนิด).map(([ชนิด, x]) => (
              <div key={ชนิด} className="flex gap-2">
                <span className={x['นโยบายเรา'] === true ? 'text-gray-600'
                  : x['นโยบายเรา'] === false ? 'text-amber-800' : 'text-gray-400'}>
                  {x['นโยบายเรา'] === true ? '⚙️' : x['นโยบายเรา'] === false ? '🙋' : '❔'}
                </span>
                <span>
                  <code>{ชนิด}</code> — {x['คำอธิบาย'] || <i>ท่อไม่ได้ส่งคำอธิบายมา ⇒ ยังไม่รู้จัก</i>}
                  {x['นโยบายเรา'] === false && <b> · ต้องมีคนมาดู</b>}
                  {x['นโยบายเรา'] === undefined && <b> · ยังไม่รู้ว่าเป็นนโยบายเราหรือของเสีย</b>}
                </span>
              </div>
            ))}
            <div className="text-gray-500">
              สีตัดสินจากช่อง <code>นโยบายเรา</code> <b>ไม่ใช่ชื่อชนิด</b> ⇒ ท่อเพิ่มชนิดใหม่ได้โดยจอไม่ต้องแก้
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 space-y-1">
        <div className="font-semibold">อ่านจอนี้อย่างไร — ตัวเลขมาจากสองแหล่ง</div>
        <div>· <b>ช่อง เหตุ/ค้างกี่วัน/streak</b> มาจากสมุดข้ามของท่อ (<code>push_state</code>)</div>
        <div>· <b>ช่อง มีในกระจก/สต็อกในกระจก</b> มาจากกระจกสต็อกของเรา (<code>list=stock</code>) — คนละแหล่ง</div>
        <div>· <b>ค่าที่แพลตฟอร์มถืออยู่</b> มาจากผลเทียบ (<code>stockcompare</code>) — <b>มีแต่ Shopee</b>
          {' '}⇒ TikTok/Lazada ขึ้น “ยังไม่มีเส้นอ่าน” ไม่ใช่ 0</div>
        <div>· <b>“ไม่มีในกระจก” ไม่เท่ากับ “สต็อกเป็น 0”</b> — รหัสที่แพลตฟอร์มใช้อาจเป็นรหัสลูกที่คลังเราไม่มี</div>
        <div>· สินค้า <b>บริการ</b> ติดลบเป็นเรื่องปกติ (ไม่มีสต็อกให้ตัด) ⇒ แยกออกจากกองก่อนนับ</div>
      </div>

      {/* ── สามกอง: แยก "ระบบกันไว้โดยตั้งใจ" ออกจาก "ต้องมีคนลงมือ" ──
          📌 ฝั่งท่อแนะนำ 27 ก.ย. 2569: กองแรกไม่ต้องทำอะไร กองที่สองต้องมีคนลงมือ
             ⇒ ให้ตัดสินจากช่อง `นโยบายเรา` ในทะเบียนที่ท่อส่งมา **ไม่ใช่จากชื่อชนิด**
          🔴 **แต่ทำสองกองตรง ๆ ไม่ได้ — ยิงตรวจแล้วพบว่าคำศัพท์สองชุดไม่ทับกัน**
             เหตุในแถวจริงมี `negative` · `unknown` · `conflict` · `policy_hold`
             แต่ทะเบียน "ชนิดที่ไม่ได้ส่ง" มี 6 ชนิดที่ทับกันแค่ `policy_hold`
             ⇒ สามตัวแรกเป็น **เหตุของการข้าม** (ไม่เคยเข้าแผน) คนละตระกูลกับ
                **เหตุของการคัดออกก่อนยิง** ที่ทะเบียนอธิบาย
             ⇒ ถ้าเอา `skip_reason` ไปค้นในทะเบียนตรง ๆ แล้วอะไรที่ไม่เจอขึ้นว่า "ยังไม่รู้จัก"
                จอจะ **พูดผิดกับแถวส่วนใหญ่** ⇒ จึงแยกเป็นกองที่สาม และเขียนกำกับว่าทำไม */}
      {Object.keys(นับเหตุ).length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3 text-[13px]">
          {(() => {
            const กอง = { ตั้งใจ: [] as string[], คนลงมือ: [] as string[], นอกทะเบียน: [] as string[] }
            for (const k of Object.keys(นับเหตุ)) {
              const x = ทะเบียนชนิด?.[k]
              if (!x) กอง.นอกทะเบียน.push(k)
              else if (x['นโยบายเรา'] === true) กอง.ตั้งใจ.push(k)
              else กอง.คนลงมือ.push(k)
            }
            const รวม = (ks: string[]) => ks.reduce((a, k) => a + (นับเหตุ[k] ?? 0), 0)
            const กล่อง = (สี: string, หัว: string, ks: string[], อธิบาย: React.ReactNode) => (
              <div className={`rounded-xl border p-3 ${สี}`}>
                <div className="font-semibold">{หัว} <b>{fmtNum(รวม(ks))}</b> รหัส</div>
                <div className="text-[12px] mt-1">
                  {ks.length ? ks.map((k) => `${ป้ายเหตุ(k)} ${นับเหตุ[k]}`).join(' · ') : '— ไม่มีในหน้านี้ —'}
                </div>
                <div className="text-[11px] mt-1 opacity-80">{อธิบาย}</div>
              </div>
            )
            return (
              <>
                {กล่อง('border-slate-200 bg-slate-50 text-slate-800', '⚙️ ระบบกันไว้โดยตั้งใจ', กอง.ตั้งใจ,
                  <>ท่อบอกว่าเป็น<b>นโยบายของเราเอง</b> ⇒ <b>ไม่ต้องทำอะไร</b> · หายเองเมื่อเงื่อนไขหมดไป</>)}
                {กล่อง('border-amber-300 bg-amber-50 text-amber-900', '🙋 ต้องมีคนลงมือ', กอง.คนลงมือ,
                  <>ท่อบอกว่า<b>ไม่ใช่นโยบายเรา</b> ⇒ ค้างอยู่จนมีคนแก้</>)}
                {กล่อง('border-gray-300 bg-white text-gray-700', '❔ อยู่นอกทะเบียนของท่อ', กอง.นอกทะเบียน,
                  <>เหตุพวกนี้เป็น<b>เหตุของการข้าม</b> (ไม่เคยเข้าแผน) ซึ่ง<b>คนละตระกูล</b>กับเหตุ
                    ที่ทะเบียนอธิบาย ⇒ <b>จอไม่ตัดสินนโยบายให้</b> · ดูรายละเอียดในตารางข้างล่าง</>)}
              </>
            )
          })()}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[['', 'ทุกช่อง'], ['shopee', 'Shopee'], ['lazada', 'Lazada'], ['tiktok', 'TikTok']].map(([v, ป้าย]) => (
          <PillButton key={v} active={ช่อง === v} onClick={() => setช่อง(v)}>{ป้าย}</PillButton>
        ))}
        <span className="w-2" />
        {/* 🔴 **ปุ่มกรองเหตุสร้างจากเหตุที่มีจริงในข้อมูล** (แก้ 27 ก.ย. 2569 หลังเปิดดูด้วยตา)
            รุ่นแรกผมพิมพ์รายการเองแค่ negative · policy_hold ⇒ ของจริงมี unknown 31 · conflict 2 · null 2
            ⇒ เหตุที่เราไม่ได้พิมพ์จะ **กรองไม่ได้เลย** ทั้งที่ตัวนับข้างล่างนับมันอยู่
            (คลาส: นับตามรายการที่เราเขียนเอง = นับได้แต่ของที่เรานึกออก) */}
        {[['', 'ทุกเหตุ'] as const, ...Object.keys(นับเหตุ).sort().map((k) => [k, ป้ายเหตุ(k)] as const)].map(([v, ป้าย]) => (
          <PillButton key={v || 'ทุก'} active={เหตุ === v} onClick={() => setเหตุ(v)}>{ป้าย}</PillButton>
        ))}
      </div>

      {พัง && <ErrorBox title="อ่านรายการรหัสค้างไม่ได้">{พัง}</ErrorBox>}
      {กำลังโหลด && <LoadingState text="กำลังอ่านสมุดข้ามของท่อ..." />}
      {!กำลังโหลด && กำลังตรวจกระจก > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[13px] text-blue-900">
          กำลังตรวจกระจกทีละรหัส {fmtNum(Object.keys(กระจก).length)} / {fmtNum(กำลังตรวจกระจก)}
          {' — '}ช่องที่ยังไม่ขึ้นค่าคือ <b>ยังไม่ได้ตรวจ</b> ไม่ใช่ไม่มี
          {' · '}เส้นกระจกตอบช้า ~2.8 วินาทีต่อรหัส (วัดเมื่อ 27 ก.ย. 2569)
        </div>
      )}

      {!กำลังโหลด && !พัง && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-[13px] space-y-1">
            <div>
              ทั้งหมดที่ตรงเงื่อนไข <b>{ทั้งหมด === null ? 'ยังไม่รู้' : fmtNum(ทั้งหมด)}</b> รหัส
              {' · '}โหลดมาแสดง <b>{fmtNum(แถว.length)}</b>
              {ชนเพดานหน้า && <span className="text-amber-700"> ⚠️ ชนเพดานการดึง {เพดานหน้า} หน้า — ที่เหลือยังไม่ได้โหลด</span>}
            </div>
            <div>
              แยกตามเหตุ (จาก <b>แถวที่โหลดมา</b> ไม่ใช่ทั้งชุด):{' '}
              {Object.entries(นับเหตุ).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}
            </div>
            <div>
              ตรวจกระจกแล้ว <b>{fmtNum(ตรวจแล้ว)}</b> รหัส
              {แถว.length > ตรวจแล้ว && <span className="text-gray-500"> (อีก {fmtNum(แถว.length - ตรวจแล้ว)} รหัสยังไม่ได้ตรวจ — ไม่ใช่ว่าไม่มี)</span>}
              {' ⇒ '}ไม่มีในกระจก <b>{fmtNum(ไม่มีในกระจก)}</b>
              {' · '}เป็นสินค้าบริการ <b>{fmtNum(เป็นบริการ)}</b>
              {' · '}<b>สินค้าจริงที่สต็อกติดลบ {fmtNum(ติดลบจริง)}</b>
            </div>
            <div>
              คลังติดลบตามที่ท่อนับเอง (<code>negativeInCore</code>):{' '}
              <b>{ติดลบจากท่อ === null ? 'อ่านไม่ได้' : fmtNum(ติดลบจากท่อ)}</b>
              {ติดลบจากท่อ !== null && ติดลบจริง !== ติดลบจากท่อ && (
                <span className="text-amber-700">
                  {' '}⚠️ ไม่ตรงกับเลขที่จอนี้คิดเอง ({fmtNum(ติดลบจริง)}) — <b>สองขาจากสองที่</b>{' '}
                  ⇒ นี่คือสัญญาณ ไม่ใช่ให้เลือกข้าง (จอนี้นับจากรหัสค้างที่ตรวจกระจกแล้วเท่านั้น · ท่อนับทั้งคลัง)
                </span>
              )}
            </div>
            <div className="text-gray-500">
              ผลเทียบกับแพลตฟอร์ม: {เทียบ ? <>วันที่ {เทียบ.day} · Shopee {fmtNum(เทียบ.shopeeRows)} รหัส · ตรงกัน {fmtNum(เทียบ.same)}
                {' · '}เทียบด้วยสูตรชุด {fmtNum(เทียบ.matchedByRecipe)} · เทียบไม่ได้ {fmtNum(เทียบ.missing)}
                {' · '}ต่างกัน <b>{fmtNum(เทียบ.diffCount)}</b>
                {เทียบ.diffTruncated && <> (ส่งมาแค่ {fmtNum(เทียบ.diff?.length ?? 0)} แถว ⇒ <b>รหัสที่ไม่อยู่ในนั้นไม่ได้แปลว่าไม่ต่าง</b>)</>}
              </> : 'อ่านไม่ได้รอบนี้'}
              {' · '}<b>มีแต่ Shopee</b> — TikTok/Lazada ยังไม่มีเส้นอ่าน ⇒ ช่องว่างของสองเจ้านั้น <b>ไม่ได้แปลว่าแพลตฟอร์มถือ 0</b>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="min-w-full text-[13px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">รหัส</th>
                  <th className="px-3 py-2 text-left">ช่อง</th>
                  <th className="px-3 py-2 text-left">เหตุที่ถูกข้าม</th>
                  <th className="px-3 py-2 text-right">ค้างกี่วัน · streak</th>
                  <th className="px-3 py-2 text-left">มีในกระจกไหม</th>
                  <th className="px-3 py-2 text-right">สต็อกในกระจก</th>
                  <th className="px-3 py-2 text-right">เคยยิง / ยืนยัน</th>
                  <th className="px-3 py-2 text-right">แพลตฟอร์มถือ · ส่วนต่าง · เทียบด้วยวิธีไหน</th>
                </tr>
              </thead>
              <tbody>
                {แถว.map((x) => {
                  const ก = กระจก[x.sku]
                  const วัน = ageInThaiDays(x.skip_first_at, true)
                  return (
                    <tr key={`${x.channel}:${x.sku}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono">{x.sku}</td>
                      <td className="px-3 py-2">{x.channel}</td>
                      <td className="px-3 py-2">{x.skip_reason}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {วัน === null ? <span className="text-gray-400">ยังไม่รู้</span> : <b>{fmtNum(วัน)} วัน</b>}
                        <span className="text-gray-400"> · {fmtNum(x.skip_streak)}</span>
                        <div className="text-[11px] text-gray-400">ตั้งแต่ {thaiDateUtc(x.skip_first_at) || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        {!ก ? <span className="text-gray-400">⚪ ยังไม่ได้ตรวจ</span>
                          : ก.มี ? <span className="text-green-700">✅ มี{ก.service && <b> (บริการ)</b>}{!ก.active && ' · ปิดขาย'}</span>
                            : <span className="text-red-700">🔴 ไม่มีในกระจก</span>}
                        {ก?.มี && ก.name && <div className="text-[11px] text-gray-400 max-w-[22rem] truncate">{ก.name}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!ก ? <span className="text-gray-400">—</span>
                          : !ก.มี ? <span className="text-gray-400">ไม่มีในกระจก</span>
                            : <b className={(ก.available ?? 0) < 0 ? 'text-red-700' : ''}>{fmtNum(ก.available)}</b>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {x.planned_qty === null && x.pushed_qty === null && x.verified_qty === null
                          ? <span className="text-gray-400">ยังไม่รู้</span>
                          : `${fmtNum(x.pushed_qty)} / ${fmtNum(x.verified_qty)}`}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {x.channel !== 'shopee'
                          ? <span className="text-gray-400">🈯 ยังไม่มีเส้นอ่านของ {x.channel}</span>
                          : !เทียบ
                            ? <span className="text-gray-400">อ่านผลเทียบไม่ได้</span>
                            : แผนที่เทียบ[x.sku]
                              ? (() => {
                                  const ท = แผนที่เทียบ[x.sku]
                                  return (
                                    <div>
                                      <div>แพลตฟอร์ม <b>{fmtNum(ท.shopee)}</b> · คลัง <b>{fmtNum(ท.core)}</b></div>
                                      <div>
                                        {/* 🔑 บอก **ทิศ** ของส่วนต่าง ไม่ใช่โชว์เลขลบเปล่า ๆ
                                            (เห็นตอนเปิดจอด้วยตา 27 ก.ย. 2569: "ต่าง -6" อ่านไม่ออกว่าใครมากกว่าใคร) */}
                                        {typeof ท.gap === 'number' && ท.gap !== 0
                                          ? <b className="text-red-700">{ท.gap > 0 ? 'คลังสูงกว่าแพลตฟอร์ม ' : 'คลังต่ำกว่าแพลตฟอร์ม '}{fmtNum(Math.abs(ท.gap))}</b>
                                          : <span className="text-gray-400">ไม่ต่าง</span>}{' '}
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                          {ท.via || 'ไม่บอกวิธี'}
                                        </span>
                                      </div>
                                      {/* 🔴 **แถวเดียวกันเคยพูดขัดกันเอง** (เห็นตอนเปิดดูด้วยตา 27 ก.ย. 2569)
                                          คอลัมน์ "มีในกระจกไหม" ขึ้น 🔴 ไม่มีในกระจก · แต่ช่องนี้ขึ้น "คลัง -6"
                                          ⇒ ทั้งคู่จริงตามแหล่งของมัน: `core` ในผลเทียบ **คิดจากสูตรชุด**
                                             ไม่ใช่แถวในกระจก ⇒ ถ้าไม่เขียนกำกับ คนอ่านต้องเดาเอง */}
                                      {ก && !ก.มี && ท.via === 'สูตรชุด' && (
                                        <div className="text-[11px] text-blue-700">
                                          ℹ️ เลข “คลัง” นี้คิดจาก<b>สูตรชุด</b> ไม่ใช่แถวในกระจก ⇒ ไม่ขัดกับช่อง “ไม่มีในกระจก”
                                        </div>
                                      )}
                                      {ท.directQty !== null && ท.directQty !== ท.core && (
                                        <div className="text-[11px] text-amber-700">
                                          ⚠️ รหัสตรงบอก {fmtNum(ท.directQty)} — คนละเลขกับสูตรชุด
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()
                              : <span className="text-gray-400">⚪ ไม่อยู่ในผลเทียบที่ส่งมา</span>}
                      </td>
                    </tr>
                  )
                })}
                {!แถว.length && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">ไม่มีรหัสค้างตามเงื่อนไขที่เลือก</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
