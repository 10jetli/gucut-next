'use client'
// Marketplace Dashboard — ลอกจาก ZORT `/Marketplace/Dashboard` (`zort-ui/32`)
//
// ผังของจริง: หัวข้อ "Marketplace Dashboard" · ปุ่มน้ำเงินขวาบน "จัดการการเชื่อมต่อ" ·
// การ์ด 3 ใบเรียงแนวนอน (Shopee · Lazada · TikTok) ใบละ: โลโก้ · ปุ่ม "จัดการร้าน" ·
// ชื่อร้าน · บรรทัด "จำนวนสินค้าที่เชื่อมต่อ" · เลขตัวใหญ่ชิดขวา
//
// ⚠️ **เลขบนจอนี้ตอบคนละคำถามกับของ ZORT — ห้ามลอกป้ายมาเฉย ๆ**
//    ZORT: "จำนวนสินค้าที่เชื่อมต่อ" = ของที่ผูกรหัสกันไว้ (ปิดการขายอยู่ก็นับ) → 1,926 / 1,988 / 54
//    เรา : รู้แต่ "กำลังลงขายอยู่จริง" (Shopee ถามเฉพาะสถานะ NORMAL)
//    วัดของจริง 5 ก.ย. 2569 ไล่ครบ 2,672 รหัส: shopee 76 · lazada 1,661 · เว็บร้าน 2,027
//    ต่างกัน 25 เท่าที่ Shopee **ไม่ใช่ของหาย** — ฝั่งท่อไล่นับแล้ว 4 ก.ย.
//    ลงขายจริง 37 สินค้า · 310 ตัวเลือก · กรอกรหัสครบทุกตัว
//    ⇒ จอนี้จึงเขียนป้ายว่า "ลงขายอยู่ตอนนี้" ไม่ใช่ "เชื่อมต่อ" และบอกเหตุที่ต่างไว้ในจอ
//
// ⚠️ **ห้ามเขียนเลขตายตัวลงจอนี้เด็ดขาด** ([[computed-now-goes-stale]])
//    ไม่มีค่าจากท่อ = ขึ้นขีดพร้อมเหตุผล · เลขที่วัดวันนี้อยู่ในคอมเมนต์เท่านั้น ไม่ได้อยู่ในหน้าจอ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, thaiHm } from '@/components/zort'

/** ตัวเลขรายช่องทางที่ขอฝั่งท่อไว้ (`?marketplacecounts=1`) — ยังไม่มาก็ไม่เป็นไร
 *  ⚠️ ทุกช่องเป็น optional โดยตั้งใจ: วันที่ท่อส่งมาครึ่งเดียว จอต้องขึ้นขีดเฉพาะช่องนั้น
 *     ไม่ใช่พังทั้งใบ (บทเรียน fmtNum(null) 5 ก.ย. 2569) */
interface Counts {
  /** จำนวนรหัสที่กำลังลงขายอยู่บนเจ้านั้น — null = ดึงได้ไม่ครบ ห้ามเดา */
  listed?: number | null
  /** จำนวน "ตัวเลือก" (variant) — Shopee/Lazada ขายที่ระดับนี้ */
  variants?: number | null
  /** ชื่อร้านบนแพลตฟอร์ม ถ้าท่อรู้ */
  store?: string | null
}

interface Data {
  checkedMarketplaces?: string[] | null
  marketplacesFailed?: Record<string, string> | null
  marketplacesNotConnected?: Record<string, string> | null
  marketplacesUnreliable?: Record<string, string> | null
  marketplacesAt?: string | null
  marketplaceCounts?: Record<string, Counts> | null
}

/** เรียงตามผัง ZORT เป๊ะ — Shopee · Lazada · TikTok
 *  ⚠️ ห้ามซ่อนเจ้าที่ยังไม่ได้เชื่อม คนที่ชิน ZORT จะหาแล้วไม่เจอ แล้วนึกว่าระบบเราทำไม่ได้ */
const PLATFORMS = [
  { id: 'shopee', name: 'Shopee', emoji: '🛒', tone: 'text-orange-600' },
  { id: 'lazada', name: 'Lazada', emoji: '🔵', tone: 'text-blue-600' },
  { id: 'tiktok', name: 'TikTok Shop', emoji: '🎵', tone: 'text-gray-900' },
]

export default function MarketplaceDashboardPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      /* ⚠️ `marketplaces=1` ต้องส่ง ไม่งั้นท่อไม่ไปถามแพลตฟอร์มเลย แล้วทุกช่องว่างแบบเงียบ ๆ
         `limit=1` เพราะจอนี้ไม่ได้ใช้ตัวแถว ใช้แต่ค่าสรุปหัวก้อน — ไม่ต้องลากมา 200 แถวฟรี ๆ */
      const r = await fetch('/api/web/core?list=stock&marketplaces=1&limit=1').then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      setData(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const checked = Array.isArray(data?.checkedMarketplaces) ? data!.checkedMarketplaces! : []
  const isChecked = (id: string) => checked.some((c) => String(c).toLowerCase() === id)
  const why = (id: string) =>
    (data?.marketplacesFailed?.[id] ?? data?.marketplacesNotConnected?.[id] ?? '').trim()
  const countOf = (id: string): Counts | null => {
    const c = data?.marketplaceCounts
    if (!c || typeof c !== 'object') return null
    const v = c[id]
    return v && typeof v === 'object' ? v : null
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <PageHead
        title="Marketplace Dashboard"
        summary={
          <>
            ร้านที่ผูกไว้กับแต่ละแพลตฟอร์ม และจำนวนสินค้าที่เรามองเห็นบนเจ้านั้น
            {thaiHm(data?.marketplacesAt) && (
              <> {' | '} ถามแพลตฟอร์มล่าสุด <b>{thaiHm(data?.marketplacesAt)} น.</b>
                <span className="text-gray-400"> (เวลาไทย)</span></>
            )}
          </>
        }
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* ผัง ZORT มีปุ่มน้ำเงิน "จัดการการเชื่อมต่อ" มุมขวาบน — ของเราชี้ไปจอช่องทางขาย */}
            <Link href="/core/channels"
              className="text-[12.5px] font-semibold text-white bg-blue-600 rounded-md px-3.5 py-1.5 hover:bg-blue-700">
              จัดการการเชื่อมต่อ
            </Link>
          </>
        }
      />

      {error && <ErrorBox title="ดึงข้อมูลแพลตฟอร์มไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && !error && (
        <>
          {/* 🔴 เจ้าที่ "ตอบมาแล้วแต่เลขยังผิด" อันตรายที่สุด เพราะการ์ดวาดตัวเลขตามปกติทุกประการ */}
          {Object.entries(data.marketplacesUnreliable ?? {}).map(([k, reason]) => (
            <div key={k} className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 leading-relaxed">
              🔴 <b>เลขของ {k} เชื่อไม่ได้ตอนนี้</b> — {reason}{' '}
              <b>อย่าใช้ตัวเลขในการ์ด {k} ตัดสินใจจนกว่าจะแก้เสร็จ</b>
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => {
              const ok = isChecked(p.id)
              const c = countOf(p.id)
              const listed = c?.listed
              const hasNumber = typeof listed === 'number'
              return (
                <Card key={p.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-[15px] font-bold ${p.tone}`}>{p.emoji} {p.name}</span>
                    {/* ZORT มีปุ่ม "จัดการร้าน" ต่อแพลตฟอร์ม — ของเราไม่มีจอจัดการรายร้าน
                        ⇒ โชว์ตามผังแต่ล็อกไว้พร้อมเหตุผล ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก */}
                    <span title="ZORT มีจอจัดการรายร้าน — ของเรายังไม่มี (ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้)"
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-gray-100 text-gray-500 shrink-0">
                      จัดการร้าน
                    </span>
                  </div>

                  <p className="text-[12.5px] text-gray-500">
                    {c?.store || <span className="text-gray-400">ท่อยังไม่ส่งชื่อร้านมา</span>}
                  </p>

                  <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-[12.5px] text-gray-600 leading-snug">
                      ลงขายอยู่ตอนนี้
                      <span className="block text-[11px] text-gray-400">
                        นับเฉพาะที่เปิดขายจริง — ZORT นับ &ldquo;ที่เชื่อมต่อไว้&rdquo; จึงมากกว่า
                      </span>
                    </span>
                    <span className="text-[26px] font-bold text-gray-900 leading-none shrink-0">
                      {hasNumber ? fmtNum(listed) : '—'}
                    </span>
                  </div>

                  {typeof c?.variants === 'number' && (
                    <p className="text-[11.5px] text-gray-500 mt-1.5">
                      คิดเป็น <b>{fmtNum(c.variants)}</b> ตัวเลือก (แพลตฟอร์มขายที่ระดับตัวเลือก)
                    </p>
                  )}

                  {/* ⚠️ ไม่มีเลข ต้องแยกให้ชัดว่า "ยังไม่ได้เชื่อม" กับ "เชื่อมแล้วแต่ท่อยังไม่ส่งเลข"
                      สองอย่างนี้คนละงานคนละคน — เขียนรวมกันว่า "ไม่มีข้อมูล" คนอ่านเลิกตามทั้งคู่ */}
                  {!hasNumber && (
                    <p className="text-[11.5px] mt-2 leading-relaxed">
                      {ok
                        ? <span className="text-amber-700">
                            เชื่อมแล้วและถามได้ แต่ <b>ท่อยังไม่ส่งตัวเลขรวมของเจ้านี้มา</b> —
                            ตอนนี้ดูรายตัวได้ที่คอลัมน์ Marketplace ในจอสินค้า
                          </span>
                        : <span className="text-gray-500">
                            <b className="text-amber-700">ยังเช็คเจ้านี้ไม่ได้</b>
                            {why(p.id) ? <> — {why(p.id)}</> : null}
                          </span>}
                    </p>
                  )}
                </Card>
              )
            })}
          </div>

          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-2">ทำไมเลขไม่เท่าจอเดียวกันของ ZORT</p>
            <ul className="text-[12.5px] text-gray-600 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>
                ZORT นับ <b>&ldquo;สินค้าที่เชื่อมต่อ&rdquo;</b> — ผูกรหัสกันไว้แล้วนับ ถึงจะปิดการขายอยู่ก็นับ
              </li>
              <li>
                ของเรานับ <b>&ldquo;ที่กำลังลงขายอยู่จริง&rdquo;</b> — ถามรายการสินค้าสถานะปกติจากแพลตฟอร์มสด ๆ
              </li>
              <li>
                ⇒ ของเรา<b>น้อยกว่าเป็นเรื่องปกติ</b> ไม่ได้แปลว่าสินค้าหาย
                {' '}(ไล่นับของจริงแล้ว 4 ก.ย. 2569 — รหัสที่ลงขายอยู่กรอกครบทุกตัว ไม่มีตกหล่น)
              </li>
              <li className="text-gray-500">
                เลขที่ต้องเทียบกันตรง ๆ จะได้ก็ต่อเมื่อเรานับ &ldquo;ที่เชื่อมต่อ&rdquo; ได้เองด้วย — ขอฝั่งท่อไว้แล้ว
              </li>
            </ul>
          </Card>

          <p className="text-[11.5px] text-gray-400 leading-relaxed">
            จอนี้อ่านค่าจากท่อล้วน ๆ ไม่มีตัวเลขไหนเขียนตายตัวไว้ในหน้าจอ —
            วันที่แพลตฟอร์มตอบไม่ได้ การ์ดจะขึ้นขีดพร้อมเหตุผล ไม่ใช่เลขเก่าค้างจอ
          </p>
        </>
      )}
    </div>
  )
}
