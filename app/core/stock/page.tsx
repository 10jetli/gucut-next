'use client'
// สินค้า — อ่านจากคลังเงาของเราเอง (D1) ไม่แตะ ZORT
//
// **หน้าตาลอกจากจอ "สินค้า" ของ ZORT ของจริง** (~/claude-shared/zort-ui/02-สินค้า.jpg)
// ผังที่ลอกมา: ชื่อจอ → "จำนวน N รายการ" → ปุ่มขวาบน → แถวค้นหา
//              → แท็บ ทั้งหมด/เปิดใช้งาน/ปิดใช้งาน → ตาราง # · รหัส · ชื่อสินค้า ·
//                ราคาซื้อ · ราคาขาย · คงเหลือ · พร้อมขาย
// ⚠️ **คงเหลือติดลบต้องเป็นสีแดง** — ZORT ทำแบบนี้ (เห็นในภาพ -2 -3) เป็นสัญญาณว่าขายเกิน
// ⚠️ ตัวเลขที่นี่คือ "ภาพถ่ายสต็อกตอนตี 1" ไม่ใช่ยอดสด — ต้องเขียนบอกบนจอเสมอ
//    ปล่อยให้เข้าใจว่าสดจะกลายเป็นจอที่โกหกเงียบ ๆ ตอนของขยับระหว่างวัน
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, THR, TD, TDR, Num, BtnGhost, LinkText, RowMenu, EmptyState, thaiDate,
} from '@/components/zort'

interface Row {
  sku: string; name: string; qty: number; price: number; sold: number
  /** ราคาซื้อ — **null = ยังไม่ได้กรอก ไม่ใช่ 0** ต้องแสดง "—" ห้ามแสดง ฿0 (281 ตัวเป็นแบบนี้) */
  buy?: number | null
  /** พร้อมขาย — **null = ยังไม่มีในทะเบียน ห้ามเดาว่าเท่ากับคงเหลือ** (ต่างจากคงเหลือจริง 155 ตัว) */
  available?: number | null
  unit?: string | null
  service?: boolean
  active?: boolean | null
  /** ช่องทางที่สินค้าตัวนี้ลงขายอยู่จริง เช่น ["shopee","tiktok"]
   *  ⚠️ มาจาก**รายการสินค้าจริงบนแพลตฟอร์ม** ไม่ใช่จากประวัติการขาย
   *     เคยขายได้ กับ กำลังลงขายอยู่ เป็นคนละเรื่อง */
  marketplaces?: string[]
}
interface Resp {
  skip?: string
  day: string; soldDays: number
  total: number; outOfStock: number; low: number; value: number
  /** จำนวนรายการ "บริการ" ทั้งคลัง (ค่าส่ง ค่าซ่อม ฯลฯ) — ของพวกนี้ไม่มีสต็อกจริง */
  services?: number
  /** จำนวนที่ปิดใช้งาน */
  inactive?: number
  /** รอบนี้เช็คแพลตฟอร์มไหนได้บ้าง — ⚠️ จำเป็นมาก
   *  ไม่มีโลโก้ Lazada อ่านได้สองแบบ: "ไม่ได้ลงขายที่ Lazada" กับ "เรายังเช็คไม่ได้"
   *  หน้าตาเหมือนกันเป๊ะแต่คนละความหมาย ⇒ ต้องบอกว่าเช็คอะไรไปบ้าง */
  checkedMarketplaces?: string[]
  /** จำนวนแถวของแท็บที่เลือกอยู่ — ใช้ทำเลขหน้า ห้ามใช้ total ตอนอยู่แท็บ out/low */
  shown?: number
  limit: number; offset: number; rows: Row[]
}

/** โลโก้ช่องทางขายเล็ก ๆ ท้ายแถว — ไฟล์เดียวกับที่ ChannelTag ใช้ */
const MARKET_LOGO: Record<string, { src: string; label: string }> = {
  shopee: { src: '/logos/shopee.png', label: 'Shopee' },
  lazada: { src: '/logos/lazada.png', label: 'Lazada' },
  tiktok: { src: '/logos/tiktok.png', label: 'TikTok' },
  gucut: { src: '/logos/gucut.png', label: 'gucut.com' },
}
function MarketLogo({ name }: { name: string }) {
  const hit = MARKET_LOGO[String(name).toLowerCase()]
  if (!hit) {
    // ⚠️ ช่องทางที่ยังไม่มีโลโก้ให้แสดงชื่อ **ห้ามซ่อน** ไม่งั้นสินค้าดูเหมือนลงขายน้อยกว่าจริง
    return <span className="text-[10.5px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">{name}</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={hit.src} alt={hit.label} title={hit.label} width={16} height={16}
      className="w-4 h-4 rounded-[3px] object-contain" />
  )
}

const PAGE = 50
const SORTS = [
  { id: 'qty', label: 'ของใกล้หมดก่อน' },
  { id: 'sold', label: 'ขายดีก่อน' },
  { id: 'sku', label: 'เรียงตามรหัส' },
]

export default function CoreStockPage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('qty')
  const [tab, setTab] = useState<'all' | 'out' | 'low' | 'active' | 'inactive'>('all')
  // ⚠️ ค่าตั้งต้นซ่อน "บริการ" (ค่าส่ง · ค่าซ่อม · ค่าน้ำมัน ฯลฯ) ออกจากจอสินค้า
  //    เพราะของพวกนี้ไม่มีสต็อกจริง แต่ติดลบหนัก (-712 · -200) เลยยึดสองแถวบนสุด
  //    ของแท็บ "ของหมด" ⇒ จอที่คนเปิดดูว่า "ต้องสั่งอะไร" ขึ้นของที่สั่งไม่ได้ก่อน
  // ⚠️ **แต่ต้องไม่ซ่อนเงียบ** — เขียนบนจอว่าซ่อนอะไรไว้กี่รายการ + กดกลับได้
  //    ไม่งั้นวันหนึ่งจะมีคนหา "ค่าบริการซ่อม" แล้วไม่เจอ นึกว่าข้อมูลหาย
  const [kind, setKind] = useState<'goods' | 'all'>('goods')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // รูปสินค้า — โหลดแผนที่ SKU→ไฟล์ครั้งเดียวต่อการเปิดเว็บ
  const imgOf = useSkuImages()

  const load = useCallback(async (off = 0, sortId = sort, tabId = tab, kindId = kind) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        list: 'stock', sort: sortId, limit: String(PAGE), offset: String(off),
      })
      // กรองฝั่งเซิร์ฟเวอร์แล้ว — แท็บจึงกรองทั้งคลังจริง ไม่ใช่แค่หน้าที่กำลังดู
      if (tabId !== 'all') qs.set('only', tabId)
      if (kindId === 'goods') qs.set('kind', 'goods')
      if (q.trim()) qs.set('q', q.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setData(d)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, sort, tab, kind])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // เซิร์ฟเวอร์กรองให้แล้ว (only=out/low) — แถวที่ได้คือของทั้งคลังในแท็บนั้น
  // ⚠️ เลขหน้าต้องใช้ shown (จำนวนแถวของแท็บที่เลือก) ไม่ใช่ total
  //    ใช้ total ตอนอยู่แท็บ out/low = โชว์ 54 หน้าทั้งที่มีของจริง 12 หน้า
  const rows = data?.rows ?? []
  const inTab = data?.shown ?? data?.total ?? 0
  const shown = offset + rows.length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สินค้า"
        summary={
          data ? (
            <>
              {/* ⚠️ **รูปประโยคนี้ลอกจาก ZORT เป๊ะ** — "จำนวน N รายการ | ลิงก์ | ลิงก์"
                  เจ้าของร้านสั่ง 3 ก.ย. 2569 ให้ถอดของที่เราเพิ่มเองออกทั้งหมด
                  (ของหมด · เหลือน้อย · มูลค่าสต็อก) ⇒ ย้ายคำอธิบายส่วนต่างไปใต้ตาราง */}
              จำนวน {data.total.toLocaleString('th-TH')} รายการ{' | '}
              <Link href="/core/soon/product-image" className="text-blue-600 hover:underline">จัดการรูปภาพสินค้า</Link>
              {' | '}
              <Link href="/core/soon/product-cost" className="text-blue-600 hover:underline">ปรับต้นทุนสินค้า</Link>
            </>
          ) : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            {/* ⚠️ ปุ่มสองอันนี้มีใน ZORT — ทำให้ผังเหมือน แต่ **กดแล้วต้องไม่โกหก**
                จึงพาไปหน้าที่บอกตรง ๆ ว่ายังไม่ได้ทำ และตอนนี้ให้ไปทำที่ไหน */}
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/product-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              เพิ่มสินค้าใหม่
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="ค้นหา รหัสสินค้า หรือชื่อสินค้า"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
        right={
          <>
            <span className="text-[13px] text-gray-500">เรียง</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); load(0, e.target.value) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        }
      />

      {error && <ErrorBox title="ดึงสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <div className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3">
            ⚠️ ตัวเลขนี้คือ <b>ภาพถ่ายสต็อกของวันที่ {thaiDate(data.day)}</b> (ถ่ายตอนตี 1) ไม่ใช่ยอดสดวินาทีนี้
          </div>

          {/* ⚠️ ซ่อนได้ แต่ต้องบอกว่าซ่อนอะไรไว้กี่รายการและกดกลับได้ตรงนี้เลย
              การซ่อนเงียบ ๆ ทำให้คนหาของไม่เจอแล้วสรุปว่าข้อมูลหาย */}
          <p className="text-[12.5px] text-gray-500 mb-2">
            {kind === 'goods' ? (
              <>
                ซ่อนรายการ<b>บริการ</b>
                {typeof data.services === 'number' ? ` ${data.services.toLocaleString('th-TH')} รายการ` : ''}
                {' '}(ค่าส่ง · ค่าซ่อม · ค่าน้ำมัน — ไม่มีสต็อกจริง จึงติดลบตลอด) ·{' '}
                <button
                  onClick={() => { setKind('all'); load(0, sort, tab, 'all') }}
                  className="text-blue-600 hover:underline"
                >
                  แสดงทั้งหมด
                </button>
              </>
            ) : (
              <>
                กำลังแสดง<b>รายการบริการด้วย</b> — แถวที่มีป้าย &quot;บริการ&quot; ไม่ใช่ของที่สั่งซื้อได้ ·{' '}
                <button
                  onClick={() => { setKind('goods'); load(0, sort, tab, 'goods') }}
                  className="text-blue-600 hover:underline"
                >
                  ซ่อนบริการ
                </button>
              </>
            )}
          </p>

          <Tabs
            // ⚠️ **ลอกจาก ZORT ทั้งชุด** (ภาพ 02-สินค้า.jpg) — สามแท็บ **ไม่มีเลขในวงเล็บ**
            //    เจ้าของร้านสั่ง 3 ก.ย. 2569: "ถอดของที่เราเพิ่มเองออกให้เหมือน ZORT เป๊ะ"
            //    ⇒ ถอดแท็บ "ของหมด" กับ "เหลือน้อย" ที่ ZORT ไม่มี และถอดเลขในวงเล็บ
            //    ⚠️ **ถอดแค่การแสดงผล ไม่ได้ถอดความสามารถ** — ตัวกรอง only=out|low
            //       ยังอยู่ฝั่งเซิร์ฟเวอร์ · ตัวเลือกเรียง "ของใกล้หมดก่อน" ยังใช้ดูของที่จะหมดได้
            tabs={[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'active', label: 'เปิดใช้งาน' },
              { id: 'inactive', label: 'ปิดใช้งาน' },
            ]}
            active={tab}
            onChange={(id) => {
              const t = id as 'all' | 'out' | 'low' | 'active' | 'inactive'
              setTab(t)
              load(0, sort, t)
            }}
          />

          <TableWrap>
            <table className="w-full min-w-[920px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อสินค้า</th>
                  <th className={THR}>ราคาซื้อ</th>
                  <th className={THR}>ราคาขาย</th>
                  <th className={THR}>คงเหลือ</th>
                  <th className={THR}>พร้อมขาย</th>
                  {/* ⚠️ ZORT มีคอลัมน์นี้ระหว่าง พร้อมขาย กับ ⋮ — แต่ API ไม่ส่งข้อมูลผูก
                      สินค้ากับร้านมาร์เก็ตเพลสมาเลย ⇒ มีหัวคอลัมน์ให้ผังตรง ใส่ขีด ไม่เดาข้อมูล */}
                  <th className={TH}>Marketplace</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {/* ⚠️ จอว่างใช้ผังแบบ ZORT — รูป + ลิงก์ชวนทำ + คำอธิบาย ไม่ใช่ตารางเปล่า
                    ตารางเปล่าอ่านได้ทั้ง "ไม่มีข้อมูล" และ "โหลดไม่สำเร็จ" คนใช้แยกไม่ออก */}
                {rows.length === 0 && (
                  tab === 'inactive'
                    ? <EmptyState cols={9} icon="📦" title="ยังไม่มีสินค้าที่ปิดใช้งาน"
                        detail="สินค้าทุกตัวในคลังเปิดขายอยู่ — ถ้าปิดใช้งานสินค้าที่ ZORT รายการจะมาโผล่ที่นี่" />
                    : <EmptyState cols={9} icon="🔍" title="ไม่พบสินค้าในเงื่อนไขนี้"
                        detail="ลองล้างคำค้น หรือเปลี่ยนแท็บ · ถ้าเพิ่งเพิ่มสินค้าที่ ZORT ต้องรอรอบซิงก์ถัดไป" />
                )}
                {rows.map((r, i) => (
                  <tr key={r.sku} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-700 font-medium`}>{r.sku}</td>
                    {/* ⚠️ ZORT วางรูปไว้**ในคอลัมน์ชื่อสินค้า** ไม่ใช่คอลัมน์แยก (ภาพ 02-สินค้า.jpg)
                        ไม่มีรูป = กล่องเทา ห้ามปล่อยช่องว่าง แถวจะเบี้ยวและดูเหมือนโหลดไม่เสร็จ */}
                    <td className={TD}>
                      <span className="flex items-start gap-2.5">
                        {imgOf(r.sku)
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgOf(r.sku) as string}
                              alt=""
                              loading="lazy"
                              className="w-10 h-10 rounded border border-gray-200 object-cover bg-white shrink-0"
                            />
                          )
                          : <span className="block w-10 h-10 rounded border border-gray-200 bg-gray-100 shrink-0" />}
                        <span className="min-w-0">
                      <span className="text-blue-600">{r.name || '—'}</span>
                      {r.service && (
                        // ติดป้ายเฉพาะตอนแสดงบริการด้วย จะได้รู้ทันทีว่าทำไมแถวนี้ติดลบ
                        <span className="ml-1.5 text-[10.5px] font-semibold text-gray-600 bg-gray-100 rounded px-1 py-0.5">
                          บริการ
                        </span>
                      )}
                      {r.active === false && (
                        <span className="ml-1.5 text-[10.5px] font-semibold text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                          ปิดใช้งาน
                        </span>
                      )}
                        </span>
                      </span>
                    </td>
                    {/* ⚠️ ราคาซื้อ null = ยังไม่ได้กรอก ≠ ฿0 · เขียน ฿0 = บอกว่าของฟรี */}
                    <td className={TDR}>
                      {typeof r.buy === 'number' && r.buy > 0
                        ? fmtMoney(r.buy)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TDR}>{r.price ? fmtMoney(r.price) : '0'}</td>
                    <td className={TDR}>
                      <Num v={r.qty} zeroRed />
                      {r.unit && <span className="ml-1 text-[11px] text-gray-400">{r.unit}</span>}
                      {r.qty < 0 && (
                        <span className="ml-1.5 text-[10.5px] font-semibold text-red-600 bg-red-50 rounded px-1 py-0.5">
                          ติดลบ
                        </span>
                      )}
                    </td>
                    {/* ⚠️ พร้อมขาย null = ไม่มีในทะเบียน **ห้ามเอาคงเหลือมาแทน** */}
                    <td className={TDR}>
                      {typeof r.available === 'number'
                        ? <Num v={r.available} />
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TD}><span className="text-gray-300">—</span></td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกรหัสสินค้า', onClick: () => { navigator.clipboard?.writeText(r.sku).catch(() => {}) } },
                          { label: 'ปรับสต็อกของรหัสนี้', onClick: () => { window.location.href = `/core/moves?sku=${encodeURIComponent(r.sku)}` } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {(offset + 1).toLocaleString('th-TH')}–{shown.toLocaleString('th-TH')} จาก {inTab.toLocaleString('th-TH')} รายการ
                {' '}· คอลัมน์ <b>Marketplace</b>{' '}
                {Array.isArray(data.checkedMarketplaces) && data.checkedMarketplaces.length > 0
                  ? <>ตรวจจากรายการสินค้าจริงบน <b>{data.checkedMarketplaces.join(' · ')}</b> ·
                    ช่องทางอื่นที่ยังต่อ API ไม่ได้จะไม่ขึ้นโลโก้ — <b>ไม่ได้แปลว่าไม่ได้ลงขาย</b> แปลว่าเรายังเช็คไม่ได้</>
                  : <>ยังไม่มีข้อมูล เพราะ ZORT ไม่ส่งการผูกสินค้ากับร้านมาร์เก็ตเพลสมาทาง API
                    (กำลังต่อจากรายการสินค้าจริงบน Shopee แทน)</>}
                {' '}· ZORT แสดง <b>2,898</b> รายการ ต่างจากที่นี่ <b>226</b> รายการ —
                เป็นรายการที่<b>ไม่มีรหัสสินค้า ไม่มีของในสต็อก และมูลค่ารวม 0 บาท</b>
                (ตรวจแล้ว) จึงไม่ถูกดึงเข้ามา ไม่ใช่ข้อมูลตกหล่น
                {tab === 'out' && (
                  <span className="text-gray-400">
                    {' '}· &quot;ของหมด&quot; รวมของที่<b>ติดลบ</b>ด้วย
                    {kind === 'goods'
                      ? ' — ติดลบตรงนี้คือขายออกไปมากกว่าที่ระบบรู้ว่ามี ไม่ใช่รายการบริการ (ซ่อนไว้แล้ว)'
                      : ' ซึ่งส่วนใหญ่คือรายการบริการที่ไม่มีสต็อกจริง'}
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= inTab}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          </TableWrap>
        </>
      )}
    </div>
  )
}
