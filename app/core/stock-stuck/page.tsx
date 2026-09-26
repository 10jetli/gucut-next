'use client'
// สต็อกที่ดันขึ้นหน้าร้านไม่สำเร็จ — "รหัสที่ถูกข้ามจากการดันสต็อก และค้างมานานแค่ไหน"
//
// 🔴 **ที่มา 27 ก.ย. 2569** — ยิง `?pushstate=1` ของจริงแล้วพบว่า
//    สวิตช์ดันสต็อกเปิดอยู่ (`autoOn: true` ทั้งสามช่อง · shopee/tiktok `mode: live`)
//    แต่ทุกรอบได้ `pushed 0` เพราะของถูกข้ามหมด ⇒ **สต็อกบนหน้าร้านค้างจริง 6–9 วัน**
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

type ผลค้าง = {
  ok?: boolean
  error?: string
  rows?: แถวค้าง[]
  nextOffset?: number | null
  'ทั้งหมดที่ตรงเงื่อนไข'?: number
}

/** ดึงสมุดข้ามหนึ่งหน้า — แยกออกมาเป็นฟังก์ชันมีชนิดชัด (ในลูปทำให้ TS อ่านชนิดวนตัวเอง) */
async function ดึงหน้าค้าง(offset: number, ช่อง: string, เหตุ: string): Promise<ผลค้าง> {
  const qs = new URLSearchParams({ pushstuck: '1', limit: String(หน้าละ), offset: String(offset) })
  if (ช่อง) qs.set('channel', ช่อง)
  if (เหตุ) qs.set('reason', เหตุ)
  const res = await fetch(`/api/web/core?${qs}`)
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
  const [ช่อง, setช่อง] = useState<string>('')
  const [เหตุ, setเหตุ] = useState<string>('')

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

      // ── ② ตรวจว่ารหัสมีในกระจกไหม (ยิงรายรหัส · จำกัดจำนวน แล้วบอกบนจอ) ──
      const รหัส = Array.from(new Set(เก็บ.map((x) => x.sku))).slice(0, เพดานตรวจกระจก)
      const ผล: Record<string, สภาพกระจก> = {}
      const คิว = [...รหัส]
      const ตัวยิง = async () => {
        for (;;) {
          const sku = คิว.shift()
          if (!sku) return
          try {
            const r = await fetch(`/api/web/core?list=stock&q=${encodeURIComponent(sku)}&limit=1`)
            const j = await r.json()
            const row = Array.isArray(j?.rows) ? j.rows.find((x: { sku?: string }) => x?.sku === sku) : null
            ผล[sku] = row
              ? { มี: true, available: typeof row.available === 'number' ? row.available : null,
                  name: String(row.name ?? ''), service: !!row.service, active: !!row.active }
              : { มี: false, available: null, name: '', service: false, active: false }
          } catch { /* ยิงไม่ได้ ⇒ ไม่ใส่คีย์ ⇒ จอขึ้น "ยังไม่ได้ตรวจ" ตามสามสถานะ */ }
        }
      }
      await Promise.all([ตัวยิง(), ตัวยิง(), ตัวยิง(), ตัวยิง()])
      setกระจก(ผล)

      // ── ⑦ ค่าที่แพลตฟอร์มถืออยู่ (ฝั่งท่อให้เส้นมา 26 ก.ย. 2569) — **มีแต่ Shopee** ──
      try {
        const r = await fetch('/api/web/core?stockcompare=1')
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 space-y-1">
        <div className="font-semibold">อ่านจอนี้อย่างไร — ตัวเลขมาจากสองแหล่ง</div>
        <div>· <b>ช่อง เหตุ/ค้างกี่วัน/streak</b> มาจากสมุดข้ามของท่อ (<code>push_state</code>)</div>
        <div>· <b>ช่อง มีในกระจก/สต็อกในกระจก</b> มาจากกระจกสต็อกของเรา (<code>list=stock</code>) — คนละแหล่ง</div>
        <div>· <b>ค่าที่แพลตฟอร์มถืออยู่จริง เส้นนี้ไม่ได้ส่งมา</b> ⇒ ช่องนั้นจึงขึ้นว่า “ยังไม่รู้” ไม่ใช่ 0</div>
        <div>· <b>“ไม่มีในกระจก” ไม่เท่ากับ “สต็อกเป็น 0”</b> — รหัสที่แพลตฟอร์มใช้อาจเป็นรหัสลูกที่คลังเราไม่มี</div>
        <div>· สินค้า <b>บริการ</b> ติดลบเป็นเรื่องปกติ (ไม่มีสต็อกให้ตัด) ⇒ แยกออกจากกองก่อนนับ</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['', 'ทุกช่อง'], ['shopee', 'Shopee'], ['lazada', 'Lazada'], ['tiktok', 'TikTok']].map(([v, ป้าย]) => (
          <PillButton key={v} active={ช่อง === v} onClick={() => setช่อง(v)}>{ป้าย}</PillButton>
        ))}
        <span className="w-2" />
        {[['', 'ทุกเหตุ'], ['negative', 'ติดลบ'], ['policy_hold', 'กันไว้ตามกติกา']].map(([v, ป้าย]) => (
          <PillButton key={v} active={เหตุ === v} onClick={() => setเหตุ(v)}>{ป้าย}</PillButton>
        ))}
      </div>

      {พัง && <ErrorBox title="อ่านรายการรหัสค้างไม่ได้">{พัง}</ErrorBox>}
      {กำลังโหลด && <LoadingState text="กำลังอ่านสมุดข้ามและกระจกสต็อก..." />}

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
                                        ต่าง <b className="text-red-700">{fmtNum(ท.gap)}</b>{' '}
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                          {ท.via || 'ไม่บอกวิธี'}
                                        </span>
                                      </div>
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
