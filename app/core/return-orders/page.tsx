'use client'
// รายการขาย → รับคืนสินค้า — **ลอกผังจาก `zort-ui/77-zort-รับคืนสินค้า-Buy-list-sttype1.jpg`**
//
// ⚠️ **URL ของ ZORT หลอก แต่เมนูไม่หลอก** — ภาพนั้น URL เป็น `/Buy/list?&sttype=1`
//    แต่แถบข้างไฮไลต์ "รับคืนสินค้า" ใต้กลุ่ม **รายการขาย** ⇒ จอนี้คือของกลุ่มขาย
//    (บทเรียน 6 ก.ย. 2569: ห้ามจับคู่จอจาก URL ต้องดูจากเมนูที่ไฮไลต์)
//
// ผัง ZORT: หัวจอ "รับคืนสินค้า" + "จำนวน N รายการ, มูลค่าทั้งหมด X บาท | ตรวจสอบการนับสินค้าเข้า"
//   · ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง · ค้นหา + ค้นหาขั้นสูง
//   · คอลัมน์ # · วันที่ · รายการ (CN-…) · อ้างอิง · ลูกค้า · มูลค่า · สถานะ · ชำระเงิน · ⋮
//   · วันที่แสดงแบบ "เมื่อวานนี้"
//
// 🔴 **ชื่อลูกค้าโชว์เต็ม — เจ้าของร้านตัดสินเอง 6 ก.ย. 2569 ห้ามกลับไปปิดเองโดยไม่ถาม**
//    เดิมท่อปิดเป็นดาวให้ แต่ตรวจแล้วพบว่า **ที่เห็นเป็นดาวในจอรายการขายคือมาร์เก็ตเพลสปิดมาเอง**
//    ไม่ใช่กติกาของเรา ⇒ ที่ท่อปิดในใบคืนของคือ "ลอกหน้าตาที่บังเอิญเห็น มาเป็นกติกา"
//    ⚠️ และสองจอโชว์ลูกค้าคนเดียวกันคนละแบบ = คนใช้นึกว่าระบบพัง (แย่กว่าเลือกทางใดทางหนึ่ง)
//    ⇒ ตัดสินให้ตรงกับ ZORT · จอนี้อยู่หลังรหัสหลังร้าน และกดเข้าใบก็เห็นชื่อเต็มอยู่แล้ว
//    (คนละเรื่องกับ **เลขประจำตัวผู้เสียภาษี** ในจอผู้ติดต่อ ซึ่งยังปิดอยู่ตามเดิม —
//     เลขนั้นไม่ได้ใช้ทำงานประจำวัน แต่ชื่อผู้รับคือสิ่งที่คนแพ็กของต้องอ่านจากจอรายการ)
//
// 🔴 **คนละฐานกับจอ `/returns` เดิม — ห้ามเอาเลขสองจอมาเทียบหรือลบกัน**
//    จอนี้อ่าน **ใบคืนของ (CN-)** สดจาก ZORT · จอ `/returns` **คำนวณของคืนจากออเดอร์**
//    สองอย่างนี้คนละของ เลขไม่มีวันตรงกัน และไม่ได้แปลว่าฝั่งไหนผิด
//
// 🔴 **ห้ามรวมยอดจากแถวที่ดึงมาแล้วเรียกว่า "มูลค่าทั้งหมด"**
//    ท่อส่ง `total` (จำนวนใบทั้งหมดจาก ZORT) มาให้ แต่ **ไม่ได้ส่งยอดรวมทั้งหมด**
//    บวกเองจาก N แถวแรกแล้วเขียนว่า "ทั้งหมด" = เลขที่ต่ำกว่าความจริงเสมอ โดยไม่มีอะไรฟ้อง
//    (คลาสเดียวกับ "หน้าแรกไม่ใช่ตัวแทน" ที่เจอมาแล้วสามครั้ง) ⇒ เขียนกำกับว่าเป็นยอดของกี่ใบ
import { useCallback, useEffect, useState } from 'react'
import StoreScopeLine from '@/components/zort/StoreScopeLine'
import StorePicker, { storeLabel, type StoreId } from '@/components/zort/StorePicker'
import StoreEcho from '@/components/zort/StoreEcho'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import { RETURN_ORDER_STATUS, zortWord } from '@/lib/zort-words'
import { toThai, thaiMoment } from '@/lib/recipe-fresh'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, TableWrap, TH, THR, TD, TDR,
  EmptyState, Pill, relDay, thaiDate, EndpointMissing,
} from '@/components/zort'
import ExportButton from '@/components/zort/ExportButton'
import { coreJson } from '@/lib/api-shape'

interface Row {
  /** id ของ ZORT — ท่อเริ่มส่งมา 9 ก.ย. 2569 (8d22291) · ไม่มี = เปิดใบรายใบไม่ได้
   *  ⚠️ เลขที่ใบ (`number`) ใช้แทนไม่ได้ เส้น ?returnorder= ค้นด้วย id เท่านั้น */
  id?: string | number
  number?: string; reference?: string; customer?: string
  amount?: number; status?: string; warehouse?: string
  date?: string; paid?: string
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

  ok?: boolean; rows?: Row[]; total?: number | null; live?: boolean
  /** ยอดรวมจากกระจก (ท่อ b2890b4) — ใช้เป็น "มูลค่าทั้งหมด" ได้เฉพาะเมื่อ count = total ของ ZORT */
  mirrorTotals?: { count?: number; amount?: number; countExcludingVoided?: number; amountExcludingVoided?: number; syncedAtUtc?: string | null; syncComplete?: boolean | null } | null
  error?: string
  /** ค่าที่ท่อใช้จริง — ใช้เป็นด่านเทียบกับคำค้นที่จอส่ง (ท่อส่งมาให้เพื่อการนี้) */
  applied?: { q?: string | null; source?: 'mirror' | 'zort' }
  /** มี q ⇒ อ่านจากกระจก ⇒ ต้องบอกว่าซิงก์เมื่อไหร่ · null = ไม่รู้ **ห้ามแปลว่าสด** */
  syncedAtUtc?: string | null
  /** false = กระจกยังไม่ครบ ⇒ ผลค้นอาจขาดใบ · null = ไม่รู้ */
  syncComplete?: boolean | null
}

const LIMIT = 100
const DASH = <span className="text-gray-300">-</span>

/** ⚠️ ระบายสีจาก **ข้อความที่ตรงเป๊ะเท่านั้น** ห้ามใช้ตัวแปลสถานะของออเดอร์
 *  สถานะของคนละชนิดเอกสาร/คนละแพลตฟอร์ม ใช้คำซ้ำกันได้โดยมีความหมายคนละอย่าง
 *  (บทเรียน TikTok 6 ก.ย. — คำว่า COMPLETED ชนกับของ Shopee)
 *  ไม่รู้จัก = เทา แล้วโชว์ข้อความดิบ **ดีกว่าเดาสีผิด** */
function tone(s?: string): 'green' | 'orange' | 'red' | 'gray' {
  const t = (s ?? '').trim()
  if (t === 'สำเร็จ' || t === 'ชำระครบ') return 'green'
  if (t === 'ยกเลิก') return 'red'
  if (t === 'รอดำเนินการ' || t === 'ค้างชำระ') return 'orange'
  return 'gray'
}

export default function ReturnOrdersPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  /* 🏬 **ร้านที่กำลังดู** (ท่อ gucut-web e546240 · 15 ก.ย. 2569)
     ยิงจริง 15 ก.ย.: ไม่ระบุ ⇒ z1 689 ใบ · z2 239 ใบ · `store=all` ⇒ **400**
     ⇒ เส้นนี้ตอบทีละร้าน ⇒ **ไม่มีตัวเลือก "ทุกร้าน"** */
  const [store, setStore] = useState<StoreId>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ⚠️ เส้นยังไม่ขึ้นเว็บ ≠ ดึงไม่สำเร็จ ≠ ไม่มีใบสักใบ — สามอย่างนี้ต้องเขียนคนละคำ
   *     เส้นที่ยังไม่มีจะ **ตอบ 200 พร้อมเนื้อหาอื่น** ⇒ ตรวจรูปร่าง ไม่ใช่ดูแค่รหัส 200 */
  const [notDeployed, setNotDeployed] = useState(false)
  /** ท่อรุ่นใหม่พอจะตัดสินได้ไหม (มีหัว x-core-build) — แยก 'ยังไม่ deploy' ออกจาก 'เส้นหาย' */
  const [known, setKnown] = useState(false)

  /* 🔍 **ค้นที่เซิร์ฟเวอร์แล้ว** (ท่อเปิดให้ 15 ก.ย. 2569 · gucut-web 8d4b031)
     เดิมจอกรองคำค้นในเบราว์เซอร์จาก 100 แถวแรก ⇒ **ค้นใบที่ 101 ขึ้นไปไม่เจอเลย**
     ทั้งที่ร้านมี 689 ใบ · และไฟล์ส่งออกก็กรองไม่ได้ตามไปด้วย
     ⚠️ มี q ⇒ ท่ออ่านจาก **กระจก** (source: mirror · live:false) ไม่ใช่ ZORT สด
        ⇒ ต้องเขียนบนจอว่าผลมาจากกระจกและซิงก์เมื่อไหร่ ไม่ใช่ปล่อยให้เข้าใจว่าสดเสมอ */
  const load = useCallback(async (term = q, storeId = store) => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const qs = new URLSearchParams({ list: 'returnorders', limit: String(LIMIT) })
      if (storeId) qs.set('store', storeId)
      if (term.trim()) qs.set('q', term.trim())
      const got = await coreJson<Resp>(`/api/web/core?${qs}`, ['rows', 'live'])
      setKnown(got.known)
      /* 🔴 อ่าน error จาก **คำตอบดิบ** ไม่ใช่จากตัวที่กรองรูปแล้ว
         คำตอบที่ล้มเหลวไม่มีคีย์ประจำตัวของเส้นนี้ (มีแต่ error) ⇒ ถ้าดูแต่ตัวกรอง
         จอจะขึ้นว่า "ยังไม่ขึ้นเว็บ" ทั้งที่ความจริงคือ "ขึ้นแล้วแต่ล้มเหลว"
         ⚠️ ฝั่งท่อเปลี่ยนสัญญา 6 ก.ย. 2569: เส้นที่ล้มเหลวคืน ok:false + error
            (เดิมคืน ok:true เสมอแม้ล้มเหลว) ⇒ ข้อความจริงมาถึงจอได้แล้ว ห้ามกลืนทิ้ง */
      const rawErr = (got.raw as { error?: string } | null)?.error
      if (rawErr) throw new Error(rawErr)
      const r = got.data
      /* 🔴 พิสูจน์ต้นทางก่อนตีความ — ใช้หัว x-core-build เป็นหลัก (ดู lib/api-shape.ts)
         แยก "ท่อยังไม่ deploy" ออกจาก "ท่อใหม่แล้วแต่เส้นหาย" ให้ขาด */
      if (!got.ok || !r) { setNotDeployed(true); setD(null); return }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [q, store])
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = Array.isArray(d?.rows) ? d!.rows! : []
  /* 🔴 **ไม่กรองซ้ำในเบราว์เซอร์แล้ว** — เซิร์ฟเวอร์กรองมาให้ทั้งชุดแล้ว
     กรองซ้ำที่นี่จะตัดแถวที่เซิร์ฟเวอร์จับคู่ได้แต่ตัวเราจับไม่ได้ (เช่นค้นจากช่องที่จอไม่ได้แสดง)
     ⇒ ตัวเลขบนจอกับตัวเลขที่เซิร์ฟเวอร์นับจะไม่ตรงกันโดยไม่มีใครรู้ว่าทำไม */
  const shown = rows
  const sumShown = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const total = typeof d?.total === 'number' ? d.total : null
  /** ดึงมาไม่ครบทั้งหมดหรือเปล่า — ใช้ตัดสินว่าจะเขียนยอดรวมแบบไหน */
  const partial = total !== null && rows.length < total
  /* 💰 ยอดทั้งหมดจากกระจก — **ใช้ได้เมื่อจำนวนใบของกระจกเท่ากับของ ZORT สดพอดีเท่านั้น** (B3 ในใบสำรวจ t_mu5bhh84)
     คนละแหล่งกัน ⇒ ถ้าจำนวนไม่เท่า ห้ามเอามาวางเป็น "ทั้งหมด" (กฎข้อ 4 ของ CLAUDE.md) · วัดจริง 17 ก.ย.: z1 692=692 · z2 239=239
     ⚠️ ยังไม่รู้ว่า "มูลค่าทั้งหมด" ของ ZORT รวมใบยกเลิกไหม (จอ ZORT ตอบ 500 ตอนวัด) ⇒ บอกทั้งสองแบบ */
  const mt = d?.mirrorTotals
  const ใช้ยอดกระจก = !q.trim() && total !== null && typeof mt?.count === 'number' && mt.count === total && typeof mt.amount === 'number'

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รับคืนสินค้า"
        summary={
          /* 🔴 **ล้มเหลวแล้วห้ามโชว์ "จำนวน 0 รายการ"** (เจอตอนเปิดจอจริงด้วยเบราว์เซอร์ 6 ก.ย. 2569)
             กล่องแดงบอกว่าดึงไม่ได้ แต่หัวจอยังเขียน "จำนวน 0 รายการ" อยู่ข้าง ๆ
             ⇒ คนกวาดตาผ่านหัวจอจะอ่านว่า **"ไม่มีใบคืนของ"** ซึ่งกลับหัวความจริง
             ⚠️ กล่อง error ที่ถูกต้อง ไม่ได้ช่วยอะไร ถ้าหัวจอยังพูดตัวเลขที่แต่งขึ้นเอง */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            /* 🔴 **notDeployed ก็ต้องห้ามโชว์จำนวนเหมือนกัน** (เจอด้วยโหมด partialgood 9 ก.ย. 2569)
               ด่านเดิมกันแค่ `error` ⇒ กรณี "เส้นยังไม่ขึ้นเว็บ" ตกช่องว่างระหว่าง error กับ ok
               แล้วหัวจอเขียน "จำนวน 0 รายการ" ข้าง ๆ กล่องเตือนที่บอกว่ายังอ่านไม่ได้
               ⇒ กล่องเตือนที่ถูกต้องไม่ช่วยอะไร ถ้าหัวจอยังพูดตัวเลขที่แต่งขึ้นเอง (บทเรียนเดิมของจอนี้เอง) */
            : notDeployed ? 'ยังอ่านใบคืนของไม่ได้ — ดูเหตุผลข้างล่าง'
            : loading ? 'กำลังโหลด…'
            : (
              <>
                จำนวน <b>{total !== null ? fmtNum(total) : fmtNum(rows.length)}</b> รายการ
                {/* 🔴 ยอดรวมต้องประกาศขอบเขตตัวเองเสมอ ห้ามเขียนคำว่า "ทั้งหมด" ถ้าดึงมาไม่ครบ */}
                {ใช้ยอดกระจก ? (
                  <>
                    {', '}มูลค่าทั้งหมด <b>{fmtMoney(mt!.amount!)}</b>
                    {typeof mt!.amountExcludingVoided === 'number' && mt!.countExcludingVoided !== mt!.count && (
                      <span className="text-gray-500"> (ไม่นับใบยกเลิก {fmtNum(mt!.count! - (mt!.countExcludingVoided ?? 0))} ใบ = {fmtMoney(mt!.amountExcludingVoided)})</span>
                    )}
                  </>
                ) : rows.length > 0 && (
                  <>
                    {', '}
                    มูลค่า{partial ? `เฉพาะ ${fmtNum(rows.length)} ใบล่าสุด` : 'ทั้งหมด'}{' '}
                    <b>{fmtMoney(sumShown)}</b>
                    {partial && typeof mt?.count === 'number' && mt.count !== total && (
                      <span className="text-gray-500"> (ยอดทั้งหมดจากกระจกใช้ไม่ได้ตอนนี้: กระจกมี {fmtNum(mt.count)} ใบ แต่ ZORT มี {fmtNum(total!)} ใบ)</span>
                    )}
                  </>
                )}
                {' | '}
                <span className="text-gray-400">
                  {/* 🔴 **"อ่านสดจาก ZORT" เป็นจริงเฉพาะตอนไม่ได้ค้น** (15 ก.ย. 2569)
                      พอค้น ท่ออ่านจากกระจกแทน (source: mirror · live:false)
                      ⇒ ปล่อยประโยคนี้ไว้ = จอยืนยันว่าสดทั้งที่ไม่ใช่ ⇒ ใบที่เพิ่งออกเมื่อครู่
                         จะหายไปจากผลค้นโดยไม่มีคำอธิบาย */}
                  ใบคืนของ (CN-) {d?.applied?.source === 'mirror'
                    ? <>ตอนค้นหาอ่านจาก<b>กระจกของเรา</b> (ไม่ได้ค้น = อ่านสดจาก ZORT)</>
                    : 'อ่านสดจาก ZORT'} — <b>คนละฐานกับหน้า &ldquo;สินค้าที่ถูกคืนบ่อย&rdquo;</b>
                </span>
              </>
            )
        }
        actions={
          <>
            <BtnGhost onClick={() => load()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* 📤 ส่งออกใบคืนจากลูกค้า ครบทุกหน้า
                🔴 **เส้นนี้แบ่งหน้าด้วย `page=` ไม่ใช่ `offset=`** — กับดักเดิมที่ CLAUDE.md
                   จดไว้เรื่อง GetOrders และผมเองก็เคยเกือบสรุปผิดว่าดึงได้แค่ 200 ใบจาก 689
                   ⇒ แปลง offset ที่ตัวช่วยส่งมา เป็นเลขหน้าตรงนี้ */}
            <ExportButton
              disabled={loading}
              spec={{
                filename: `ใบคืนจากลูกค้า-${new Date().toISOString().slice(0, 10)}`,
                title: 'ใบคืนสินค้าจากลูกค้า',
                note: 'ใบคืนที่ลูกค้าคืนเรา (CN-) — คนละชุดกับใบคืนที่เราส่งคืนผู้ขาย'
                  + ' · เลขที่ใบคืนซ้ำกันได้จริง (ยิงตรวจ 15 ก.ย. 2569: 689 ใบ เลขที่ไม่ซ้ำ 537) — ใช้คอลัมน์ id แยกใบ ห้ามลบแถวที่ดูซ้ำ',
                /* ✅ **ถอดคำเตือน "ไฟล์นี้ไม่ได้กรองด้วยคำค้นนี้" ออกแล้ว** (15 ก.ย. 2569)
                   ท่อรับ `q` จริงแล้ว (gucut-web 8d4b031) และผม **ยิงดู `applied.q` จากคำตอบจริง
                   ก่อนถอด** ไม่ได้ถอดตามคำบอกเล่าว่า deploy แล้ว (ฝั่งท่อกำชับข้อนี้เอง)
                   📏 ยิงจริง: เลขที่ใบเป๊ะ ⇒ applied.q ตรง · source mirror · total 1
                   ⚠️ มี q ⇒ ผลมาจากกระจก ไม่ใช่ ZORT สด ⇒ เขียนไว้ในหัวไฟล์ด้วย */
                /* 🔴 **ไฟล์ต้องเป็นของร้านเดียวกับที่จอโชว์** — ลืมส่ง `store` แล้วไฟล์จะกลายเป็นของ z1
                   ทั้งที่จอโชว์ z2 อยู่ · ผิดแบบไม่มีอะไรฟ้อง เพราะไฟล์หน้าตาปกติ */
                filters: [
                  ['ร้าน', storeLabel(store)],
                  q.trim()
                    ? ['คำค้นหา', `${q.trim()} — ค้นที่เซิร์ฟเวอร์ ครอบทุกใบ (ผลมาจากกระจกของเรา ไม่ใช่ ZORT สด)`]
                    : ['คำค้นหา', '(ไม่ได้ค้น)'],
                ],
                fetchPage: async (offsetAt, limit) => {
                  const page = Math.floor(offsetAt / limit) + 1
                  const qs = new URLSearchParams({ list: 'returnorders', limit: String(limit), page: String(page) })
                  if (store) qs.set('store', store)
                  if (q.trim()) qs.set('q', q.trim())
                  const r = await fetch(`/api/web/core?${qs}`)
                  const d = await r.json()
                  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                  return { rows: (Array.isArray(d.rows) ? d.rows : []) as Row[], total: typeof d.total === 'number' ? d.total : null }
                },
                /* 🔴 **ต้องมีคอลัมน์ id** — ยิงจริง 15 ก.ย. 2569: 689 ใบมี **เลขที่ซ้ำกัน 152 แถว**
                   แต่ `id` ไม่ซ้ำเลยสักใบ (กวาดทั้ง 4 หน้า คีย์ข้ามหน้าซ้ำ 0)
                   ⇒ ถ้าไฟล์ไม่มี id จะมีแถวหน้าตาเหมือนกันเป๊ะ 133 แถว แล้วคนเปิดไฟล์
                      จะนึกว่าส่งออกซ้ำ แล้วลบทิ้งเอง ⇒ ยอดหายโดยที่ข้อมูลไม่เคยผิด
                   (บทเรียนเดียวกับบัตรสต็อกที่มีแถวซ้ำจริง 106 แถว — ของซ้ำที่เป็นของจริง
                    ต้องมีอะไรให้แยกแยะ ไม่งั้นคนจะแก้ "ปัญหา" ที่ไม่มีอยู่) */
                header: ['id', 'เลขที่ใบคืน', 'วันที่', 'ลูกค้า', 'ใบขายอ้างอิง', 'คลัง', 'ยอด (บาท)', 'สถานะ', 'การชำระเงิน'],
                toRow: (r: Row) => [
                  r.id === undefined || r.id === null ? null : String(r.id),
                  r.number ?? null, r.date ?? null, r.customer ?? null, r.reference || null,
                  r.warehouse || null, typeof r.amount === 'number' ? r.amount : null,
                  r.status ?? null, r.paid ?? null,
                ],
              }}
            />
          </>
        }
      />

      {error && <ErrorBox title="ดึงใบคืนของไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {!loading && notDeployed && (
        <EndpointMissing known={known} what="อ่านใบคืนของ"
          effect="ไม่ได้แปลว่าไม่มีใบคืนของ — แปลว่ายังอ่านไม่ได้เท่านั้น" />
      )}

      {!loading && !error && d && (
        <>
          {partial && (
            <div className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2 mb-3 leading-relaxed">
              แสดง <b>{fmtNum(rows.length)}</b> ใบล่าสุด จากทั้งหมด <b>{fmtNum(total!)}</b> ใบ —
              ยอดเงินข้างบนเป็นของ<b>เฉพาะที่ดึงมา</b> ไม่ใช่ยอดสะสมทั้งหมด
              <br />
              ⚠️ และยอดนั้นบวกจากช่อง <b>amount</b> ของ ZORT ซึ่ง<b>ยังไม่ได้พิสูจน์ว่าคือยอดคืนของใบ</b>
              {' '}— กดเข้าใบแล้วดูช่องเงินทั้งหมดก่อนเอาไปคิดเงินจริง
            </div>
          )}

          <SearchRow
            value={q}
            onChange={setQ}
            onSubmit={() => load()}
            placeholder="ค้นเลขที่ใบคืน · เลขใบขายอ้างอิง · ชื่อลูกค้า"
            advanced={<LinkText onClick={() => { setQ(''); load('') }}>ล้างคำค้น</LinkText>}
          />

          {/* 🔴 **ผลค้นมาจากกระจก ไม่ใช่ ZORT สด — ต้องบอก** (ท่อกำชับ 15 ก.ย. 2569)
              ไม่บอก = คนอ่านว่าเป็นของสดเสมอ แล้วใบที่เพิ่งออกเมื่อครู่จะหายไปโดยไม่มีคำอธิบาย */}
          {d?.applied?.source === 'mirror' && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-3 leading-relaxed">
              🔍 ผลค้นนี้มาจาก<b>กระจกของเรา</b> ไม่ใช่การถาม ZORT สด
              {d.syncedAtUtc
                ? <> — ซิงก์ล่าสุด <b>{thaiMoment(toThai(d.syncedAtUtc))}</b></>
                : <> — <b>ยังไม่รู้ว่าซิงก์ล่าสุดเมื่อไหร่</b> (ท่อไม่ได้บอกมา)</>}
              {d.syncComplete === false && (
                <><br /><span className="text-amber-800">🔴 <b>กระจกยังซิงก์ไม่ครบ</b> — ผลค้นอาจขาดบางใบ</span></>
              )}
              {/* ✅ ด่านเทียบคำค้นที่จอส่ง กับที่ท่อใช้จริง */}
              {q.trim() && d.applied?.q !== q.trim() && (
                <><br /><span className="text-amber-800">
                  ⚠️ คำค้นที่จอส่ง (<b>{q.trim()}</b>) ไม่ตรงกับที่ท่อใช้จริง
                  (<b>{d.applied?.q ?? 'ไม่ได้ใช้คำค้นเลย'}</b>) — ผลที่เห็นอาจไม่ใช่สิ่งที่ค้น
                </span></>
              )}
            </p>
          )}

          {/* 🏬 ขอบเขตร้าน — อ่านจากคำตอบท่อ ไม่พิมพ์ z1 ตายตัว (ใบ t_mu2kxy6u) */}
          <StorePicker value={store} disabled={loading}
            onChange={(v) => { setStore(v); load(q, v) }} />

          <StoreScopeLine scope={d?.storeScope} />
          {/* 🔴 ตรวจว่าท่อใช้ร้านเดียวกับที่จอขอจริง — เดิมส่ง store= ไปแล้วไม่เคยอ่านคำตอบ */}
          <StoreEcho ขอ={store} ได้={d?.store} ท่อเลือกให้={d?.storeDefaulted} />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>อ้างอิง</th>
                  <th className={TH}>ลูกค้า</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>ชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={8} icon="↩️"
                    title={rows.length === 0 ? 'ยังไม่มีใบคืนของ' : 'ไม่พบใบในคำค้นนี้'}
                    detail={rows.length === 0
                      ? 'ZORT ตอบกลับมาว่าไม่มีใบคืนของสักใบ (ดึงสำเร็จ แต่ว่างจริง)'
                      : 'ค้นได้จาก เลขที่ใบ · เลขอ้างอิง · ชื่อลูกค้า'} />
                )}
                {shown.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`} title={thaiDate(r.date)}>
                      {r.date ? relDay(r.date) : DASH}
                    </td>
                    {/* เลขที่ใบกดเข้ารายละเอียดได้ตั้งแต่ 9 ก.ย. 2569 — ต้องมี id เท่านั้น
                        ไม่มี id (ท่อรุ่นก่อน) = แสดงเป็นข้อความ **ห้ามส่ง number ไปแทน**
                        เพราะจะได้หน้าที่เปิดไม่ได้ซึ่งดูเหมือนระบบพัง (บทเรียนจอแพ็คสินค้า) */}
                    <td className={`${TD} font-medium text-gray-800`}>
                      {r.id
                        ? <Link href={`/core/return-orders/detail?id=${encodeURIComponent(String(r.id))}`}
                            className="text-blue-600 hover:underline">{r.number || DASH}</Link>
                        : (r.number || DASH)}
                    </td>
                    <td className={`${TD} text-gray-600`}>{r.reference || DASH}</td>
                    <td className={TD}>
                      {/* ⚠️ แสดงตามที่ท่อส่งมาตรง ๆ — ชื่อที่ยังเป็นดาวคือ **มาร์เก็ตเพลสปิดมาเอง**
                          ไม่ใช่เราปิด และเราแกะคืนไม่ได้ ⇒ ห้ามเขียนบนจอว่า "ระบบปิดชื่อไว้" */}
                      {r.customer || DASH}
                    </td>
                    {/* ⚠️ ไม่มีมูลค่า ≠ มูลค่า 0 — ท่ออาจไม่ส่งช่องนี้มา ต้องขึ้นขีด ไม่ใช่ ฿0 */}
                    {/* ⚠️ คอลัมน์นี้ใช้ช่อง `amount` ของ ZORT — **ไม่ได้พิสูจน์ว่านั่นคือยอดคืนของใบ**
                        จอรายละเอียดของใบเดียวกันเขียนไว้ว่า "ท่อยังไม่ได้ตั้งชื่อช่องยอดคืน จอจะไม่เดา"
                        ⇒ สองจอต้องพูดให้เข้ากัน ไม่งั้นคนอ่านไม่รู้ว่าตกลงระบบรู้หรือไม่รู้ (14 ก.ย. 2569) */}
                    <td className={TDR}>{typeof r.amount === 'number' ? fmtMoney(r.amount) : DASH}</td>
                    <td className={TD}>
                      {/* 🔴 เดิมโชว์ค่าดิบ ("Success") — คำอังกฤษบนจอคือเรื่องที่ท่านประธานทักไว้
                          ⚠️ คำนี้ **ยืมจากใบ PO บนจอ `/Buy/list` ของ ZORT** เพราะยังไม่เคยเห็นแถว CN- บนจอเขา
                             (ดูที่มาใน lib/zort-words.ts — เจอแถว CN เมื่อไหร่ต้องกลับมาแก้) */}
                      {r.status ? <Pill tone={tone(r.status)}>{zortWord(RETURN_ORDER_STATUS, r.status).text}</Pill> : DASH}
                      {/* ZORT โชว์ชื่อโกดังเป็นบรรทัดย่อยใต้สถานะ */}
                      {r.warehouse && <div className="text-[11.5px] text-gray-400 mt-0.5">{r.warehouse}</div>}
                    </td>
                    <td className={TD}>{r.paid ? <Pill tone={tone(r.paid)}>{r.paid}</Pill> : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            {/* 🔴 เช่นเดียวกับบรรทัดหัวจอ — "สดทุกครั้ง" จริงเฉพาะตอนไม่ได้ค้น */}
            {d?.applied?.source === 'mirror'
              ? <>เปิดจอเฉย ๆ อ่านสดจาก ZORT · <b>ตอนค้นหาอ่านจากกระจกของเรา</b> (ท่อค้นในกระจก ไม่ได้ค้นที่ ZORT) ·{' '}</>
              : <>อ่านสดจาก ZORT ทุกครั้งที่เปิดจอ (ไม่ได้ผ่านคลังเงา) ·{' '}</>}
            ชื่อลูกค้าแสดงเต็มตามที่ ZORT ส่งมา (เจ้าของร้านตัดสิน 6 ก.ย. 2569) —
            ชื่อที่ขึ้นเป็นดาวคือ<b>มาร์เก็ตเพลสปิดมาเอง</b> ไม่ใช่ระบบเราปิด และแกะคืนไม่ได้ ·
            สถานะแสดง<b>ข้อความดิบจาก ZORT</b> ระบายสีเฉพาะคำที่ตรงเป๊ะ
            คำที่ไม่รู้จักขึ้นเทา (เดาสีผิดแย่กว่าไม่ระบายสี)
            <br />
            🔴 <b>คนละฐานกับหน้า</b>{' '}
            <Link href="/returns" className="text-blue-600 hover:underline">สินค้าที่ถูกคืนบ่อย</Link>{' '}
            ซึ่งคำนวณของคืนจากออเดอร์ — <b>เลขสองหน้าไม่มีวันตรงกัน และไม่ได้แปลว่าฝั่งไหนผิด</b>
            {' '}(หน้านั้นตอบคำถามที่จอนี้ตอบไม่ได้: ตัวไหนถูกคืนซ้ำ ๆ จนต้องไปแก้ที่ต้นทาง) ·
            ยังไม่มีปุ่ม &ldquo;สร้าง&rdquo; กับ &ldquo;นำเข้าไฟล์&rdquo; แบบ ZORT — เส้นสร้างใบคืนของมีอยู่จริง
            แต่<b>ยังไม่เคยยิงของจริง</b> (ดู{' '}
            <Link href="/core/zort-noapi" className="text-blue-600 hover:underline">ZORT เปิดให้ทำอะไรผ่าน API</Link>)
          </p>
        </>
      )}
    </div>
  )
}
