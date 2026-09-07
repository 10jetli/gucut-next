'use client'
// ร้านค้าออนไลน์ → สินค้าบน Marketplace — ตัวแทนเมนู `/Marketplace/List` ของ ZORT
//
// ✅ **ได้ภาพจริงแล้ว 7 ก.ย. 2569** (`zort-ui/83-…-ว่างเปล่า.jpg`) — จัดผังตามภาพ:
//    breadcrumb "‹ Marketplace Dashboard" + หัวจอ "ร้าน" · แท็บ Shopee/Lazada/Tiktok Shop
//    คอลัมน์ # · รหัส · ชื่อสินค้า · ลิงก์ Marketplace · วางจำหน่ายสินค้าⓘ · Export มุมล่างซ้าย
//    ⚠️ จอ ZORT ของจริง **ว่างเปล่า 0 รายการ** (ร้านไม่เคยผูกสินค้าผ่านหน้านั้น)
//    ⇒ ข้อมูลของเราจึง "เกินผัง" โดยธรรมชาติ — เก็บไว้เพราะตอบคำถามที่ ZORT ตอบไม่ได้
//
// คำถามที่จอนี้ตอบ: **สินค้าตัวไหนลงขายอยู่บนช่องทางไหนบ้าง — และตัวไหนยังไม่ได้ลงเลย**
// ต่างจากคอลัมน์ Marketplace ในจอสินค้าตรงที่จอนั้นดูทีละแถว ส่วนจอนี้กรอง/นับได้ทั้งคลัง
//
// 🔴 **ข้อมูลชุดเดียวกับคอลัมน์ Marketplace ในจอสินค้า** (`list=stock&marketplaces=1`)
//    ⇒ เลขสองจอต้องตรงกันเสมอ · ถ้าวันไหนไม่ตรง แปลว่ามีจอหนึ่งนับเอง ซึ่งผิดกติกา
// ⚠️ ต้องไล่ทุกหน้า ไม่ใช่หน้าแรกหน้าเดียว — วัดจริง 5 ก.ย.: หน้าแรก 200 แถวให้ shopee 11
//    แต่ทั้ง 2,672 แถวได้ 76 ⇒ **หน้าแรกไม่ใช่ตัวแทน** (บทเรียนที่เจอมาแล้วสามครั้ง)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  EmptyState, MarketLogos, MarketCoverage, MarketUnreliableBanner,
} from '@/components/zort'

interface Row {
  sku: string; name: string; qty?: number; available?: number
  active?: boolean; service?: boolean
  marketplaces?: string[]
  marketplacesBy?: Record<string, string>
  marketplacesFrom?: Record<string, string[]>
}
interface Resp {
  rows?: Row[]; total?: number
  checkedMarketplaces?: string[] | null
  marketplacesFailed?: Record<string, string> | null
  marketplacesNotConnected?: Record<string, string> | null
  marketplacesUnreliable?: Record<string, string> | null
  marketplacesAt?: string | null
  error?: string
}

const PAGE = 200
/** เพดานรอบดึง — 2,672 รหัส ÷ 200 = 14 หน้า · เผื่อโต 50% */
const MAX_PAGES = 20

/* เรียงและสะกดตามแท็บในภาพ 83: Shopee · Lazada · Tiktok Shop
   "เว็บร้าน" เป็นของเกินผัง (ZORT ไม่มีช่องทางนี้) — เก็บไว้เพราะเว็บเราคือช่องทางขายจริง */
const PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'lazada', label: 'Lazada' },
  { id: 'tiktok', label: 'Tiktok Shop' },
  { id: 'gucut', label: 'เว็บร้าน' },
]

export default function MarketplaceProductsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [meta, setMeta] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ดึงไม่ครบทุกหน้า — ต้องบอก ไม่ใช่เงียบ (ตัวเลขที่ไม่ครบต้องประกาศขอบเขตตัวเอง) */
  const [partial, setPartial] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setPartial(false)
    try {
      const all: Row[] = []
      let first: Resp | null = null
      let p = 0
      for (; p < MAX_PAGES; p++) {
        const url = `/api/web/core?list=stock&marketplaces=1&limit=${PAGE}&offset=${p * PAGE}`
        const d: Resp = await fetch(url).then((r) => r.json())
        if (d?.error) throw new Error(d.error)
        if (!first) first = d
        const got = Array.isArray(d.rows) ? d.rows : []
        all.push(...got)
        if (got.length < PAGE) break
      }
      // ⚠️ ชนเพดานแล้วยังไม่หมด = ตัวเลขข้างล่างไม่ใช่ทั้งคลัง ต้องประกาศ
      if (p >= MAX_PAGES) setPartial(true)
      setRows(all)
      setMeta(first)
      setPage(0)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setRows([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** ⚠️ นับจาก rows ที่ดึงมาครบทุกหน้าแล้วเท่านั้น — ถ้า partial ต้องเขียนกำกับ */
  const countOn = (id: string) => rows.filter((r) => (r.marketplaces ?? []).includes(id)).length
  const none = rows.filter((r) => (r.marketplaces ?? []).length === 0)

  const inTab = tab === 'all' ? rows
    : tab === 'none' ? none
      : rows.filter((r) => (r.marketplaces ?? []).includes(tab))

  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? inTab.filter((r) => String(r.sku ?? '').toLowerCase().includes(needle)
      || String(r.name ?? '').toLowerCase().includes(needle))
    : inTab
  const shown = filtered.slice(page * 50, page * 50 + 50)
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50))

  return (
    <div className="p-4 md:p-6">
      {/* ผังภาพ 83: breadcrumb กลับไป Marketplace Dashboard อยู่เหนือหัวจอ */}
      <Link href="/core/marketplace" className="text-[12.5px] text-blue-600 hover:underline">‹ Marketplace Dashboard</Link>
      <PageHead
        title="สินค้าบน Marketplace"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามโชว์จำนวนรหัส — จะอ่านเป็น "คลังว่าง" ทั้งที่แค่ดึงไม่ได้ */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            : loading
            ? 'กำลังไล่ทุกหน้า…'
            : (
              <>
                จำนวน {fmtNum(rows.length)} รหัสในคลัง
                {' | '}
                <span className="text-gray-400">
                  ลงขายอยู่จริงบนแต่ละเจ้า — ไม่ใช่ &ldquo;เชื่อมต่อไว้&rdquo; แบบที่ ZORT นับ
                </span>
              </>
            )
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงรายการสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && rows.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          <MarketUnreliableBanner unreliable={meta?.marketplacesUnreliable} />

          {/* ⚠️ ชนเพดานแล้วต้องประกาศ — เลขที่ไม่ครบต้องบอกขอบเขตตัวเอง
              (คลาสเดียวกับ truncated ของจอรายงานลูกค้า) */}
          {partial && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>ดึงมาไม่ครบทั้งคลัง</b> — หยุดที่ {fmtNum(MAX_PAGES * PAGE)} รหัสตามเพดานที่ตั้งไว้
              <b> ตัวเลขทุกตัวข้างล่างเป็นของเท่าที่ดึงมา ไม่ใช่ทั้งร้าน</b>
            </div>
          )}

          <SearchRow
            value={q}
            onChange={(v) => { setQ(v); setPage(0) }}
            onSubmit={() => setPage(0)}
            placeholder="รหัสสินค้า หรือชื่อสินค้า"
            advanced={<LinkText onClick={() => { setQ(''); setPage(0) }}>ล้างคำค้น</LinkText>}
          />

          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: rows.length },
              ...PLATFORMS.map((p) => ({ id: p.id, label: p.label, count: countOn(p.id) })),
              // 🔴 แท็บนี้คือของที่มีค่าที่สุดในจอ — ของที่ยังไม่ได้ลงขายที่ไหนเลย
              { id: 'none', label: 'ยังไม่ได้ลงที่ไหนเลย', count: none.length },
            ]}
            active={tab}
            onChange={(id) => { setTab(id); setPage(0) }}
          />

          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  {/* ผังภาพ 83: "ลิงก์ Marketplace" — เราไม่มี URL รายตัว (API ไม่ส่ง)
                      ใช้โลโก้บอกว่าลงที่ไหนแทน ซึ่งตอบคำถามเดียวกัน · คอลัมน์คงเหลือเป็นของเกินผัง เก็บไว้ */}
                  <th className={TH}>ลิงก์ Marketplace</th>
                  <th className={TH} title="ZORT มีสวิตช์เปิด/ปิดวางจำหน่าย — ของเราอ่านได้อย่างเดียว สั่งเปิดปิดต้องทำใน ZORT">วางจำหน่ายสินค้า ⓘ</th>
                  <th className={THR}>คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={6} icon="🛍" title="ไม่พบสินค้าในเงื่อนไขนี้"
                    detail={needle ? 'ลองพิมพ์คำสั้นลง' : 'ลองเปลี่ยนแท็บช่องทาง'} />
                )}
                {shown.map((r, i) => (
                  <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{page * 50 + i + 1}</td>
                    <td className={TD}>
                      <Link href={`/core/stock/${encodeURIComponent(r.sku)}`}
                        className="text-blue-600 hover:underline font-medium">{r.sku}</Link>
                    </td>
                    <td className={`${TD} max-w-[380px] truncate`} title={r.name}>{r.name}</td>
                    <td className={TD}>
                      {(r.marketplaces ?? []).length > 0
                        ? <MarketLogos list={r.marketplaces} by={r.marketplacesBy} from={r.marketplacesFrom} />
                        : <span className="text-gray-300">ยังไม่ได้ลง</span>}
                    </td>
                    <td className={TD}>
                      {/* "วางจำหน่าย" ตามข้อมูลจริงที่มี: active จากทะเบียนสินค้า —
                          อ่านอย่างเดียว (สวิตช์จริงอยู่ใน ZORT) · ไม่รู้ = ขีด ไม่เดา */}
                      {typeof r.active === 'boolean'
                        ? (r.active
                          ? <span className="inline-block text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">วางจำหน่าย</span>
                          : <span className="inline-block text-[11.5px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">ปิดการขาย</span>)
                        : <span className="text-gray-300" title="ทะเบียนสินค้าไม่ได้บอกสถานะตัวนี้มา">—</span>}
                    </td>
                    <td className={TDR}>{fmtNum(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {filtered.length === 0 ? 0 : fmtNum(page * 50 + 1)}–{fmtNum(Math.min((page + 1) * 50, filtered.length))}
                {' '}จาก {fmtNum(filtered.length)} รหัส
                {' '}· <MarketCoverage checked={meta?.checkedMarketplaces}
                  failed={meta?.marketplacesFailed} notConnected={meta?.marketplacesNotConnected}
                  at={meta?.marketplacesAt} />
              </span>
              <div className="flex items-center gap-2">
                <BtnGhost onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← ก่อนหน้า</BtnGhost>
                <span className="text-[12px] text-gray-500">หน้า {page + 1} / {pageCount}</span>
                <BtnGhost onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page + 1 >= pageCount}>ถัดไป →</BtnGhost>
              </div>
            </div>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ จอนี้ไล่ดึง<b>ทุกหน้า</b>ก่อนนับ ไม่ใช่หน้าแรกหน้าเดียว — วัดจริง 5 ก.ย. 2569
            หน้าแรก 200 แถวให้ Shopee 11 รหัส แต่ทั้งคลังได้ 76 ⇒ <b>หน้าแรกไม่ใช่ตัวแทน</b> ·
            ตัวเลขชุดเดียวกับคอลัมน์ Marketplace ในจอสินค้า <b>สองจอต้องตรงกันเสมอ</b> ·
            ผังตามภาพจริง 83 (7 ก.ย. 2569) — จอ ZORT ของจริง<b>ว่างเปล่า 0 รายการ</b>
            ข้อมูลของเราจึงเกินผังโดยธรรมชาติ · &ldquo;ลิงก์ Marketplace&rdquo; ของ ZORT เป็น URL รายตัว
            ซึ่ง API ไม่ส่งมา — เราใช้โลโก้บอกว่าลงที่ไหนแทน
          </p>
        </>
      )}
    </div>
  )
}
