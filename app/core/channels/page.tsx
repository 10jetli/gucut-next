'use client'
// ร้านค้าออนไลน์ — ตัวแทนเมนู "ร้านค้าออนไลน์" ของ ZORT
//
// สองเรื่องในจอเดียว:
//   1. แต่ละช่องทางขายได้เท่าไหร่ (จากคลังเงา)
//   2. ท่อดึงตรงจาก API ของแต่ละเจ้า เดินอยู่ไหม
//
// ⚠️ สถานะท่อต้อง **คิดจากข้อมูลจริงที่เห็นในฐาน** ห้ามเขียนตายตัวว่าเจ้าไหนอนุมัติแล้ว
//    สถานะพวกนั้นเปลี่ยนได้ทุกวันโดยไม่มีใครมาแก้จอ แล้วจอจะกลายเป็นตัวโกหก
//    (บทเรียนเดียวกับหน้าสถานะระบบฝั่งหน้าร้าน 19 ส.ค. 2569)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

interface ChannelRow { channel: string; orders: number; amount: number }
interface StoreRow { source: string; name?: string; orders?: number }
interface ShopeeRow {
  day: string; api_orders: number; api_amount: number
  zort_orders: number; zort_amount: number; match: boolean
}
interface Status {
  ready?: boolean
  channels?: ChannelRow[]
  shopee?: ShopeeRow[]
}

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/** เส้นที่ใช้ขอ "ยอด 30 วัน + รายชื่อร้าน" — **แยกออกมาเป็นค่าเดียว จะได้เปลี่ยนที่เดียว**
 *
 *  ⏳ ฝั่งท่อทำเส้นเบา `?list=orderfacets` ไว้แล้ว (ยิง D1 แค่ 2 รอบ ไม่ดึงแถวออเดอร์เลย)
 *     คืนฟิลด์ชื่อและรูปแบบเดียวกันเป๊ะ ⇒ สลับมาใช้ **แก้บรรทัดเดียว** ไม่ต้องแตะโค้ดอ่านข้อมูล
 *  ⚠️ **ยังไม่สลับ** เส้นนั้นยังไม่ขึ้นเว็บ (รอ push 21:00 พร้อมกัน)
 *     ตกลงกับฝั่งท่อแล้วว่าจะเปลี่ยนหลังเขายืนยันว่ายิงของจริงผ่าน
 *  ⚠️ **ห้ามสลับแล้วเชื่อว่าใช้ได้เพราะได้ 200** — วันนี้ยิงเส้นที่ยังไม่ deploy แล้วได้
 *     200 + ขนาด body สมเหตุสมผล แต่เป็นคำตอบสรุปหน้าแรกคนละชุด (`list=` ที่ไม่รู้จัก
 *     ตกไปที่คำตอบนั้นเงียบ ๆ) ⇒ ต้องเช็คว่า body **มีฟิลด์ที่สัญญาไว้** จริงด้วยทุกครั้ง */
const RECENT_QS = `/api/web/core?list=orders&from=${thaiDay(30)}&to=${thaiDay(0)}&limit=1`

// ท่อที่ "ควรจะมี" ตามแผน — มีไว้เพื่อบอกว่าอันไหนยังไม่เห็นข้อมูล
// ห้ามใส่คำว่าอนุมัติ/รออนุมัติ ตรงนี้ ให้ดูจากข้อมูลอย่างเดียว
const PIPES = [
  { id: 'shopee', name: 'Shopee', emoji: '🛒' },
  { id: 'lazada', name: 'Lazada', emoji: '🔵' },
  { id: 'tiktok', name: 'TikTok Shop', emoji: '🎵' },
]

export default function CoreChannelsPage() {
  const [st, setSt] = useState<Status | null>(null)
  const [recent, setRecent] = useState<ChannelRow[]>([])
  const [recentStores, setRecentStores] = useState<StoreRow[]>([])
  /** ⚠️ **ต้องแยกจาก `loading` ไม่งั้นได้เร็วแลกกับตัวเลขปลอม**
   *  ระหว่างที่ยอด 30 วันยังไม่มา `recent` เป็น [] ⇒ การ์ดขึ้น "0 ช่องทาง · ฿0"
   *  และแถบล่างขึ้น "ยังไม่มียอดใน 30 วันล่าสุด" — ทั้งคู่อ่านว่า **ร้านไม่มียอดเลย**
   *  ซึ่งคนละเรื่องกับ "ยังโหลดไม่เสร็จ" (ตาข่ายเดียวกับ salesLoading ในจอคลังสินค้า/สาขา) */
  const [recentLoading, setRecentLoading] = useState(true)
  /** ⚠️ **ยิงพลาด ≠ ไม่มียอด** — โรคเดียวกับจอคลังสินค้า/สาขา (เจอตอนไล่อ่านซ้ำ 5 ก.ย. 2569)
   *  พอยิงพลาด recent ว่าง แล้วจอเขียนว่า "ยังไม่มียอดใน 30 วันล่าสุด" ซึ่งเป็นคำยืนยันที่ผิด */
  const [recentFailed, setRecentFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setRecentLoading(true) // ⚠️ กดรีเฟรชแล้วต้องกลับไป "ยังไม่รู้" ไม่ใช่ค้างเลขรอบก่อน
    setRecentFailed(false)
    setError('')
    try {
      /* 🔴 **เดิม Promise.all กักไม่ให้วาดอะไรเลยจนกว่าจะครบทั้งสองเส้น**
         วัดของจริง 5 ก.ย. 2569: `/api/web/core` เปล่า ~2.9 วิ · เส้นยอด 30 วัน **~4.2 วิ**
         ⇒ การ์ดท่อ + ยอดสะสม (ใช้แค่เส้นแรก) ถูกกักไว้อีก 1.3 วิเพื่อรอของประกอบ
         ตอนนี้เส้นแรกมาแล้ววาดเลย · ยอด 30 วันเติมทีหลัง (ท่าเดียวกับจอคลังสินค้า/สาขา) */
      const recentSoon = fetch(RECENT_QS)
        .then((r) => r.json())
        .then((rRes) => {
          setRecent(Array.isArray(rRes?.byChannel) ? rRes.byChannel : [])
          setRecentStores(Array.isArray(rRes?.stores) ? rRes.stores : [])
        })
        .catch(() => { setRecentFailed(true) /* ล้มก็แค่การ์ดนั้น ไม่ล้มทั้งจอ — แต่ต้องบอกว่าล้ม */ })
        .finally(() => setRecentLoading(false))

      const sRes = await fetch('/api/web/core').then((r) => r.json())
      if (sRes?.error) throw new Error(sRes.error)
      setSt(sRes)
      setLoading(false) // ← การ์ดท่อ + ยอดสะสมขึ้นได้แล้ว
      // ⚠️ ต้อง await ไว้ท้ายสุด ไม่งั้นเป็น promise ลอย (กติกาเหล็กของโปรเจกต์)
      await recentSoon
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setSt(null)
      setRecent([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const all = st?.channels ?? []
  /** ร้านที่มีบิลจริงในช่วงที่ดึงมา — มาจากท่อ (`stores`) ไม่ใช่จอนับเอง */
  const storeList: StoreRow[] = Array.isArray(recentStores) ? recentStores : []
  /* ⚠️ ระหว่างรอ ห้ามเขียน "ทุกร้าน" — เป็นคำยืนยันขอบเขตของตัวเลขที่ยังไม่รู้ */
  const storeLabel = recentLoading && storeList.length === 0
    ? 'กำลังดูว่านับรวมกี่ร้าน…'
    : recentFailed && storeList.length === 0
      ? 'ยังไม่รู้ว่านับรวมกี่ร้าน (ดึงไม่สำเร็จ)'
      : storeList.length
      ? `${storeList.length} ร้าน (${storeList.map((s2) => s2.name || s2.source).join(' · ')})`
      : 'ทุกร้าน'
  const shopee = st?.shopee ?? []
  const maxRecent = Math.max(...recent.map((c) => c.amount), 1)
  const recentTotal = recent.reduce((s, c) => s + c.amount, 0)

  // ท่อ Shopee เดินอยู่จริงไหม — ดูว่ามีวันไหนที่ API ส่งใบเข้ามาบ้าง
  const shopeeLive = shopee.some((r) => Number(r.api_orders) > 0)
  const shopeeMatchDays = shopee.filter((r) => r.match).length

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="ร้านค้าออนไลน์"
        summary={
          <>
            ช่องทางที่ขายได้ · และท่อดึงตรงจาก API ของแต่ละเจ้า
            {' | '}
            {/* 🔴 **ชื่อช่องทางซ้ำกันข้ามร้านได้** — TIKTOK มีทั้งใน z1 (ยังขาย) และ z2 (เลิกขาย 22 ก.พ. 69)
                ตัวเลขบรรทัดนี้จึงเป็นของสองร้านรวมกัน ⇒ ต้องเขียนบอก ไม่งั้นคนอ่านสรุปผิดเรื่องร้าน
                (ฝั่งท่อเกือบรายงานผิดด้วยเหตุนี้จริง 5 ก.ย. 2569) */}
            {/* 🔴 อ่านรายชื่อร้านจากท่อ ห้ามเขียนจำนวนตายตัว — วันที่มีร้านที่สามป้ายเปลี่ยนเอง */}
            <b>ตัวเลขรวม {storeLabel}</b>
            <span className="text-gray-400"> — ชื่อช่องทางเดียวกันอาจมีอยู่มากกว่าหนึ่งร้าน</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงข้อมูลช่องทางไม่ได้">{error}</ErrorBox>}
      {loading && !st && <LoadingState />}

      {st && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* ⚠️ ระหว่างรอ ห้ามโชว์ 0 / ฿0 — อ่านว่า "30 วันนี้ขายไม่ได้เลย" ซึ่งคนละเรื่องกับ "ยังไม่รู้" */}
            <StatCard icon="🏪" tone="blue" label="ช่องทางที่มียอด (30 วัน)"
              value={recentLoading ? '…' : recentFailed ? '?' : fmtNum(recent.length)} unit="ช่องทาง" />
            <StatCard icon="💰" tone="green" label="ยอดรวม 30 วัน"
              value={recentLoading ? '…' : recentFailed ? '?' : fmtMoney(recentTotal)} />
            <StatCard icon="🔌" tone="purple" label="ท่อดึงตรงที่เดินอยู่"
              value={fmtNum(shopeeLive ? 1 : 0)} unit={`จาก ${PIPES.length} เจ้า`} />
          </div>

          {/* ยอดรายช่องทาง 30 วัน */}
          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-3">ยอดขายรายช่องทาง (30 วันล่าสุด)</p>
            {recentLoading
              ? <p className="text-[13px] text-gray-400">กำลังโหลดยอด 30 วัน…</p>
              : recentFailed
                ? <p className="text-[13px] text-red-600">ดึงยอด 30 วันไม่สำเร็จ — <b>ไม่ได้แปลว่าไม่มียอด</b> กดรีเฟรชอีกครั้ง</p>
                : recent.length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มียอดใน 30 วันล่าสุด</p>}
            <div className="space-y-2.5">
              {recent.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12.5px] font-medium text-gray-800 truncate">{c.channel}</span>
                    <span className="text-[12.5px] text-gray-500 shrink-0">
                      {fmtNum(c.orders)} ใบ · <b className="text-gray-900">{fmtMoney(c.amount)}</b>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max((c.amount / maxRecent) * 100, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ท่อดึงตรงจาก API */}
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b border-gray-100">
              <p className="text-[13px] font-semibold text-gray-700">🔌 ท่อดึงออเดอร์ตรงจาก API ของแพลตฟอร์ม</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                นี่คือทางที่ทำให้เราเลิกพึ่ง ZORT ได้ — สถานะข้างล่างคิดจากข้อมูลที่เห็นในฐานจริง
              </p>
            </div>
            {PIPES.map((p) => {
              const live = p.id === 'shopee' && shopeeLive
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-[18px] shrink-0">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[12px] text-gray-500">
                      {live
                        ? `เห็นออเดอร์จาก API แล้ว · เทียบกับ ZORT ตรงกัน ${shopeeMatchDays} จาก ${shopee.length} วันล่าสุด`
                        : 'ยังไม่เห็นออเดอร์จากท่อนี้ในฐานของเรา'}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    live ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {live ? 'เดินอยู่' : 'ยังไม่เดิน'}
                  </span>
                </div>
              )
            })}
            <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-50 leading-relaxed">
              &quot;ยังไม่เดิน&quot; หมายถึงยังไม่เห็นข้อมูลจากท่อนั้นในฐานของเรา
              ไม่ได้แปลว่าถูกปฏิเสธ — สถานะการอนุมัติ API ต้องไปดูที่คอนโซลของเจ้านั้นหรืออีเมล
              จอนี้จงใจไม่จำสถานะพวกนั้นไว้ เพราะมันเปลี่ยนได้โดยไม่มีใครมาแก้จอ
            </p>
          </Card>

          {/* ยอดสะสมทุกช่องทาง */}
          <Card>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[13px] font-semibold text-gray-700">ยอดสะสมทั้งหมดในคลังเงา (ทุกช่วงเวลา)</p>
              <Link href="/core/reports" className="text-[11px] text-blue-600 font-medium hover:text-blue-700">
                ดูรายงานเต็ม →
              </Link>
            </div>
            {all.length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มีข้อมูล</p>}
            <div className="flex flex-wrap gap-2">
              {all.map((c) => (
                <span key={c.channel} className="text-[12px] border border-gray-200 rounded-xl px-3 py-1.5">
                  <b className="text-gray-800">{c.channel}</b>
                  <span className="text-gray-500"> · {fmtNum(c.orders)} ใบ · {fmtMoney(c.amount)}</span>
                </span>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
