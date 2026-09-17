'use client'
// ภาพรวมลูกค้ารายคน — ตาม /Contact/ContactDetail ของ ZORT
// (กวาดคลาส "ZORT กดได้เราไม่" 8 ก.ย. 2569 · เส้นท่อ ?customer= เปิดให้แล้ววันเดียวกัน)
//
// เส้น: /api/web/core?customer=<ชื่อเต็ม หรือ รหัส/id ผู้ติดต่อ>
// รูปคำตอบ (จากซอร์สท่อจริง getCustomerDetail — ไม่ได้เดา):
//   { contact: {...} | null, name, orders:{count,total,firstDay,lastDay,recent[]}, matchNote }
//
// 🔴 **สองอย่างที่ต้องเขียนบอกผู้ใช้ ห้ามซ่อน** (ท่อชี้มาเอง):
//   ① contact = null แปลว่า "ไม่อยู่ในทะเบียนผู้ติดต่อ" **ไม่ใช่ "ไม่มีตัวตน"**
//      ลูกค้ามาร์เก็ตเพลสส่วนใหญ่เป็นแบบนี้ — มีออเดอร์จริงแต่ไม่เคยถูกสร้างเป็นผู้ติดต่อ
//   ② **ชื่อที่แพลตฟอร์มปิดบัง (มี *) จับคู่ออเดอร์ไม่ได้เลย** — วัดจริง 8 ก.ย. 2569:
//      ออเดอร์ 200 ใบล่าสุด มีชื่อไม่ถูกปิดบังแค่ 61 ใบ (30%)
//      ⇒ อีก 70% จะได้ 0 ออเดอร์ ซึ่ง **ถูกตามข้อมูลแต่หลอกตา**
//      ⇒ ตรวจ '*' ก่อน แล้วขึ้นว่า "แพลตฟอร์มปิดบังชื่อ" แทนการโชว์ศูนย์เฉย ๆ
//      (three-states-not-two: ไม่มีประวัติ ≠ ดูประวัติไม่ได้)
// ⚠️ ห้าม log/ส่งต่อเนื้อหา — มีชื่อ/เบอร์/ที่อยู่ลูกค้าจริง
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SALE_STATUS, PAY_STATUS, PURCHASE_STATUS, CONTACT_TYPE, zortWord } from '@/lib/zort-words'
import { thaiDate } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'
import { ลิงก์ใบขาย, ลิงก์ใบของลูกค้า } from '@/lib/sale-link'

interface Order {
  id?: string; source?: string; number?: string; channel?: string; status?: string
  amount?: number; order_date?: string; tracking_no?: string; pay_status?: string
}
/* 💰 การ์ดเงินแบบเดียวกับ ZORT — ท่อคิดให้จาก SQL ทั้งกอง (ไม่ได้คิดจากตาราง 20 แถวข้างล่าง)
   ⚠️ ทั้งก้อนอาจเป็น undefined ได้ ถ้าจอขึ้นก่อนท่อรุ่นใหม่ ⇒ ต้องอ่านออกว่า "ท่อยังไม่ส่ง"
      ไม่ใช่ "ลูกค้าคนนี้ยอด 0" (เลขศูนย์ที่ไม่มีที่มา คือเลขที่หลอกคนอ่าน) */
interface Money {
  thisMonth?: number; thisYear?: number; month?: string | null; year?: string | null
  scope?: string; outstanding?: number | null; outstandingWhy?: string
}
/* 🧺 กล่อง "ยอดขาย · รายสินค้า" แบบ ZORT — ท่อตัดมา 20 อันดับ แต่ส่ง count/amount ของทั้งชุดมาด้วย
   ⇒ จอต้องเขียนว่า "มีทั้งหมด N แสดง M" ห้ามวางแถวที่ถูกตัดคู่กับยอดรวมเฉย ๆ */
interface ProdRow { sku?: string | null; name?: string | null; qty?: number; amount?: number }
interface CatRow { category?: string | null; amount?: number; skus?: number }
interface Products {
  rows?: ProdRow[]; count?: number; amount?: number; scope?: string
  byCategory?: CatRow[]
  /* ยอดรวมหัวใบของชุดเดียวกัน — ต่างจากผลรวมรายสินค้าได้ (ส่วนลดท้ายบิลที่ ZORT เกลี่ยลงบรรทัดแล้ว) */
  ordersAmount?: number; diffNote?: string
}
/* 🧾 ใบซื้อ — ZORT เอาใบซื้อเข้า/ขายออกไว้ตารางเดียวกันแล้วแยกด้วยคอลัมน์ "ประเภท"
   ⚠️ `purchases: null` = **อ่านตารางใบซื้อไม่ได้ (ยังไม่รู้)** ต่างจาก `count: 0` = ไม่มีใบซื้อ */
interface BuyRow {
  id?: string | null; source?: string | null; number?: string | null
  date?: string | null; status?: string | null; amount?: number; payStatus?: string | null
}
interface Purchases { rows?: BuyRow[]; count?: number; amount?: number; scope?: string }
interface Resp {
  contact?: Record<string, unknown> | null
  purchases?: Purchases | null
  name?: string
  orders?: { count?: number; total?: number; firstDay?: string; lastDay?: string; recent?: Order[] }
  money?: Money
  products?: Products
  matchNote?: string
  error?: string; skip?: string
}

const baht = (n?: number) => (typeof n === 'number' ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—')
const LABEL: Record<string, string> = {
  code: 'รหัส', type: 'ประเภท', tax_id: 'เลขผู้เสียภาษี', phone: 'เบอร์โทร',
  email: 'อีเมล', address: 'ที่อยู่', branch_name: 'สาขา', branch_no: 'เลขที่สาขา',
  updated_at: 'อัปเดตล่าสุด',
}

function Inner() {
  const sp = useSearchParams()
  const key = sp.get('name') ?? sp.get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'สินค้า' | 'หมวดหมู่'>('สินค้า')
  const [error, setError] = useState('')

  const masked = key.includes('*')

  const load = useCallback(async () => {
    if (!key) { setError('ไม่ได้ระบุลูกค้า (ต้องเปิดจากจอผู้ติดต่อหรือรายการขาย)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?customer=${encodeURIComponent(key)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(SKIP + j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [key])
  useEffect(() => { load() }, [load])

  const o = d?.orders
  const c = d?.contact
  /* ใบซื้อของผู้ติดต่อรายนี้ · purchases === null = อ่านตารางใบซื้อไม่ได้ (ยังไม่รู้) ⇒ ไม่โชว์คอลัมน์ ประเภท
     แต่ต้องเขียนบอกใต้ตารางว่าอ่านไม่ได้ ไม่ใช่เงียบ */
  const buys = d?.purchases?.rows ?? []

  return (
    <div className="p-4 md:p-6 max-w-[980px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/customers" className="text-blue-600 hover:underline">‹ ผู้ติดต่อ</Link>
      </p>
      <PageHead title={d?.name || key || 'ลูกค้า'}
        summary={<span className="text-gray-400">ภาพรวมรายคน · ข้อมูลติดต่อ + ประวัติการซื้อจากคลังเงา</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {/* 🔴 **ข้อจำกัดการจับคู่ต้องอยู่ใต้ชื่อลูกค้า ไม่ใช่ท้ายจอ** (ย้ายขึ้นมา 12 ก.ย. 2569)
          มันตอบคำถามว่า "ใบพวกนี้เป็นของคนนี้จริงไหม" ⇒ กำกับ**ทุกอย่างที่อยู่ใต้มัน**
          เดิมอยู่บรรทัดสุดท้ายของจอด้วยสี gray-400 (อ่อนที่สุดในโปรเจกต์)
          = คนอ่านประวัติการซื้อจบแล้วจึงเจอว่าอาจไม่ใช่คนเดียวกัน */}
      {d?.matchNote && (
        <p className="mb-3 text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 leading-relaxed">
          ⚠️ <b>ข้อจำกัดการจับคู่ลูกค้า</b> — {d.matchNote}
        </p>
      )}

      {/* 🔴 ชื่อถูกปิดบัง — ต้องบอกก่อนที่ผู้ใช้จะเห็นเลข 0 แล้วเข้าใจผิด */}
      {masked && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
          <b>แพลตฟอร์มปิดบังชื่อลูกค้ารายนี้</b> (มีเครื่องหมาย <code>*</code>) —
          ระบบจับคู่ประวัติการซื้อ<b>ไม่ได้</b> เพราะออเดอร์เก็บชื่อที่ถูกปิดบังมาแล้ว
          <div className="mt-1 text-amber-800">
            เลขข้างล่างที่เป็น 0 จึงแปลว่า <b>“ดูไม่ได้”</b> ไม่ใช่ “ไม่เคยซื้อ” ·
            ดูรายละเอียดจริงได้ในหลังบ้านของแพลตฟอร์มนั้น
          </div>
        </div>
      )}

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงข้อมูลลูกค้าไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* ── ข้อมูลติดต่อ ── */}
          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">ข้อมูลติดต่อ</h2>
            {c ? (
              <table className="w-full text-[13px]">
                <tbody>
                  {Object.entries(LABEL).map(([k, label]) =>
                    c[k] ? (
                      <tr key={k} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-2 align-top text-gray-500 whitespace-nowrap">{label}</td>
                        {/* 🗓️ ช่องที่เป็นวันเวลา (อัปเดตล่าสุด) ต้องผ่านตัวจัดรูปแบบ ไม่งั้นปี ค.ศ. หลุดจอ
                            เจอ 16 ก.ย. 2569 ตอนตรวจด้วยตา: ตารางนี้วนพิมพ์ค่าทุกช่องด้วย String(c[k])
                            ⇒ ด่านที่ค้นจากรูปแบบ `{x.field}` จับไม่ได้ (คีย์เป็นตัวแปร) — ต้องแก้ที่นี่เอง */}
                        {/* 🔤 ช่อง "ประเภท" เคยขึ้นค่าดิบ "Undefined" บนจอไทย (เจอด้วยตา 18 ก.ย. 2569)
                            ⇒ ผ่านแผนที่คำเหมือนคอลัมน์สถานะ · ค่าดิบเก็บไว้ใน title ให้ตรวจย้อนได้ */}
                        <td className="py-1 break-words"
                          title={k === 'updated_at' || k === 'type' ? `ค่าที่ท่อส่งมา: ${String(c[k])}` : undefined}>
                          {k === 'updated_at' ? thaiDate(String(c[k]))
                            : k === 'type' ? zortWord(CONTACT_TYPE, String(c[k])).text
                            : String(c[k])}</td>
                      </tr>
                    ) : null
                  )}
                </tbody>
              </table>
            ) : (
              /* ⚠️ ไม่ใช่ error — ต้องอ่านออกว่าเป็นสภาพปกติของลูกค้ามาร์เก็ตเพลส */
              <p className="text-[13px] text-gray-500">
                <b>ไม่อยู่ในทะเบียนผู้ติดต่อ</b> — เป็นเรื่องปกติของลูกค้าที่ซื้อผ่านมาร์เก็ตเพลส
                (มีออเดอร์จริง แต่ไม่เคยถูกสร้างเป็นผู้ติดต่อในระบบ)
              </p>
            )}
          </section>

          {/* ── ประวัติการซื้อ ── */}
          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">ประวัติการซื้อ</h2>
            <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
              <div><span className="text-gray-500">จำนวนใบ </span><b>{o?.count ?? 0}</b></div>
              <div><span className="text-gray-500">ยอดรวม </span><b>{baht(o?.total)}</b> บาท</div>
              {/* 🗓️ ช่องชื่อ `firstDay`/`lastDay` ก็เป็นวันที่ — เดิมโชว์ปี ค.ศ. ดิบ (เจอด้วยตา 16 ก.ย. 2569)
                  ⇒ ด่านตรวจวันที่ต้องรู้จักคำลงท้าย `Day` ด้วย ไม่ใช่แค่ `Date`/`At` (แก้ที่ด่านแล้ว) */}
              {o?.firstDay && <div><span className="text-gray-500">ซื้อครั้งแรก </span>
                <span title={`ค่าที่ท่อส่งมา: ${o.firstDay}`}>{thaiDate(o.firstDay)}</span></div>}
              {o?.lastDay && <div><span className="text-gray-500">ล่าสุด </span>
                <span title={`ค่าที่ท่อส่งมา: ${o.lastDay}`}>{thaiDate(o.lastDay)}</span></div>}
            </div>

            {/* 💰 **การ์ดเงิน 3 ใบแบบเดียวกับ ZORT** (เติม 18 ก.ย. 2569)
                🔬 กติกาการนับ **วัดจากจอ ZORT จริง 3 ราย ไม่ได้เดา** — ZORT นับที่ "การชำระเงิน = ชำระครบ"
                   ไม่ใช่สถานะเอกสาร (ใบ "รอโอนสินค้า" ที่ชำระครบแล้ว ZORT ก็นับ)
                ⚠️ ใบที่สามของ ZORT (ยอดค้างชำระ) **จงใจไม่ใส่เลข** — วัดแล้วพบว่า ZORT ไม่ได้เอา
                   ผลรวมใบที่ยังไม่ชำระมาใส่ ⇒ ถ้าเราคิดเองจะได้เลขที่ดูดีแต่ตอบคนละคำถามกับจอที่คนเชื่ออยู่ */}
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { t: 'ยอดขายเดือนนี้ (บาท)', v: d?.money?.thisMonth, sub: d?.money?.month },
                { t: 'ยอดขายปีนี้ (บาท)', v: d?.money?.thisYear, sub: d?.money?.year },
              ].map((c) => (
                <div key={c.t} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-[12px] text-gray-500">{c.t}</div>
                  {typeof c.v === 'number' ? (
                    <div className="text-[17px] font-semibold tabular-nums">{baht(c.v)}</div>
                  ) : (
                    /* ท่อยังไม่ส่งช่องนี้มา = ยังไม่รู้ ⇒ ขีด ไม่ใช่ 0 */
                    <div className="text-[17px] font-semibold text-gray-400" title="ท่อรุ่นนี้ยังไม่ส่งช่องนี้มา">—</div>
                  )}
                  <div className="text-[11px] text-gray-400">{c.sub ? `ช่วง ${c.sub}` : 'ยังไม่รู้ช่วงที่ตัด'}</div>
                </div>
              ))}
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-[12px] text-amber-900">ยอดค้างชำระ (บาท)</div>
                <div className="text-[17px] font-semibold text-amber-700">ยังคิดไม่ได้</div>
                <div className="text-[11px] text-amber-800 leading-snug">
                  {d?.money?.outstandingWhy ?? 'ยังไม่รู้ว่า ZORT เอาเลขนี้มาจากไหน — ไม่ใช่ผลรวมใบที่ยังไม่ชำระ'}
                </div>
              </div>
            </div>
            {d?.money?.scope && (
              <p className="mb-3 text-[11.5px] text-gray-500">
                กติกาของสองการ์ดแรก: {d.money.scope}
                {' · '}จอ ZORT เขียน “-” เมื่อไม่มียอด ส่วนจอนี้เขียนเลข 0 (ขีดของเราแปลว่า “ยังไม่รู้”)
              </p>
            )}

            {/* 🧺 ยอดขายรายสินค้า — กล่องเดียวกับ "ยอดขาย · รายสินค้า" ของ ZORT
                ⚠️ ท่อส่งมา 20 อันดับแรก ⇒ ต้องเขียนกำกับว่าทั้งหมดมีกี่รายการ ไม่งั้นคนอ่านนึกว่าเท่านี้ */}
            {d?.products && (d.products.rows?.length ?? 0) > 0 && (
              <div className="mb-3 rounded border border-gray-200 bg-white p-2.5">
                <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                  {/* แท็บเดียวกับ ZORT (รายสินค้า · รายหมวดหมู่) — ทั้งสองแท็บมาจากชุดข้อมูลเดียวกัน
                      ⇒ ตัวเลขสองแท็บบวกได้เท่ากัน ไม่ใช่คนละกติกา (กฎเรื่องแท็บข้อ 4) */}
                  <h3 className="text-[13px] font-semibold">ยอดขาย ·</h3>
                  {(['สินค้า', 'หมวดหมู่'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={`rounded-full px-2.5 py-0.5 text-[12px] ${tab === t
                        ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      ราย{t}
                    </button>
                  ))}
                  {/* ⚠️ คำกำกับต้องเปลี่ยนตามแท็บ — เดิมเขียน "มีทั้งหมด N รายการ" ค้างไว้ทั้งสองแท็บ
                      ทั้งที่แท็บหมวดหมู่กำลังนับ "หมวด" ไม่ใช่ "รายการสินค้า" (เจอด้วยตา 18 ก.ย. 2569) */}
                  <span className="text-[11.5px] text-gray-500">
                    {tab === 'สินค้า' ? (
                      <>มีทั้งหมด {d.products.count ?? '—'} รายการ · รวม {baht(d.products.amount)} บาท ·
                        {' '}แสดง {d.products.rows?.length} อันดับแรกตามมูลค่า</>
                    ) : (
                      <>แยกได้ {d.products.byCategory?.length ?? '—'} หมวด · รวม {baht(d.products.amount)} บาท
                        {' '}(ยอดรวมเท่ากับแท็บรายสินค้า — ชุดข้อมูลเดียวกัน)</>
                    )}
                  </span>
                </div>
                {/* 🔴 สองเลขนี้ต่างกันได้จริง (วัดแล้ว 7,570 กับ 6,570) — ต้องเขียนบอก ห้ามวางเลขเดียวเงียบ ๆ
                    ไม่งั้นคนเปิดเทียบกับ ZORT จะเห็นของเราสูงกว่าแล้วไม่รู้ว่าใครผิด */}
                {typeof d.products.ordersAmount === 'number'
                  && Math.round(d.products.ordersAmount) !== Math.round(d.products.amount ?? 0) && (
                  <p className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-900 leading-relaxed">
                    ⚠️ ผลรวมรายสินค้า <b>{baht(d.products.amount)}</b> ไม่เท่ากับยอดรวมใบที่ชำระครบ{' '}
                    <b>{baht(d.products.ordersAmount)}</b> (ต่าง {baht(Math.round(((d.products.amount ?? 0) - d.products.ordersAmount) * 100) / 100)} บาท)
                    {d.products.diffNote ? ` — ${d.products.diffNote}` : ''}
                  </p>
                )}
                {tab === 'สินค้า' ? (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-1 pr-2 font-medium">สินค้า</th>
                        <th className="py-1 pr-2 font-medium text-right">จำนวน</th>
                        <th className="py-1 font-medium text-right">มูลค่า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.products.rows?.map((r, i) => (
                        <tr key={`${r.sku ?? i}`} className="border-b border-gray-100 last:border-0">
                          <td className="py-1 pr-2">
                            {r.name ?? '—'}
                            {r.sku && <span className="ml-1 text-[11px] text-gray-400">{r.sku}</span>}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">{baht(r.qty)}</td>
                          <td className="py-1 text-right tabular-nums">{baht(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : !d.products.byCategory?.length ? (
                  /* ท่อรุ่นเก่ายังไม่ส่งแท็บนี้มา = ยังไม่รู้ ไม่ใช่ "ไม่มีหมวด" */
                  <p className="text-[12.5px] text-gray-500">ท่อยังไม่ส่งยอดรายหมวดหมู่มา</p>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-1 pr-2 font-medium">หมวดหมู่</th>
                        <th className="py-1 pr-2 font-medium text-right">จำนวน SKU</th>
                        <th className="py-1 font-medium text-right">มูลค่า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.products.byCategory.map((r, i) => (
                        <tr key={`${r.category ?? 'ไม่รู้'}-${i}`} className="border-b border-gray-100 last:border-0">
                          {/* 🔴 หมวดว่าง = SKU ไม่อยู่ในคลังสินค้าของเรา ⇒ เขียนว่า "ยังไม่รู้หมวด"
                              ห้ามเขียนว่า "อื่น ๆ" ซึ่งฟังเหมือนหมวดจริงที่ตั้งใจจัดไว้ */}
                          <td className="py-1 pr-2">
                            {r.category ?? <span className="text-gray-500">ยังไม่รู้หมวด <span className="text-[11px] text-gray-400">(SKU ไม่อยู่ในคลังสินค้า)</span></span>}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">{r.skus ?? '—'}</td>
                          <td className="py-1 text-right tabular-nums">{baht(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {d.products.scope && <p className="mt-1.5 text-[11px] text-gray-400">{d.products.scope}</p>}
              </div>
            )}

            {/* 🔬 **เทียบกับจอ ZORT ตัวจริง** — `/Contact/ContactDetail` (อ่านอย่างเดียว 16 ก.ย. 2569)
                ZORT มีการ์ดเงิน 3 ใบ (ยอดขายเดือนนี้ · ยอดขายปีนี้ · **ยอดค้างชำระ**) + กล่อง "ยอดขาย รายสินค้า"
                + ตารางที่มีคอลัมน์ **ประเภท** (รวมเอกสารหลายชนิด ไม่ใช่แค่ใบขาย) + Export ตามช่วงวันที่
                🔴 **ทำเองจากข้อมูลที่มีไม่ได้** — ยิงวัดของจริง 16 ก.ย. 2569: ท่อคืน `recent` **สูงสุด 20 แถว**
                   (เจอลูกค้าที่มี 54 ใบ แต่ได้มา 20) ⇒ ถ้าคำนวณยอดเดือนนี้/ปีนี้/ค้างชำระจากตารางนี้
                   จะได้เลขที่ **ดูสมเหตุสมผลแต่ผิด** สำหรับคนที่ซื้อเกิน 20 ใบ ⇒ ขอท่อเพิ่มช่อง ไม่คำนวณเอง
                   (คลาสเดียวกับบทเรียน "เลขจากลิสต์ที่ถูก cap ห้ามเอาไปใช้") */}
            <div className="mb-3 text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 leading-relaxed">
              <b>ที่จอ ZORT มีแต่จอนี้ยังไม่มี</b> — ยอดขาย<b>รายหมวดหมู่</b> · ตัวกรองช่วงวันของกล่องยอดขาย
              {' '}· <b>Download Excel</b> · ตารางของ ZORT มีคอลัมน์ <b>ประเภท</b> (รวมใบซื้อเข้า/ขายออกในตารางเดียว)
              {' '}ส่วนตารางนี้เป็นใบขายอย่างเดียว
              <br />
              ✅ <b>การ์ดยอดขายเดือนนี้/ปีนี้ทำได้แล้ว 18 ก.ย. 2569</b> — ท่อคิดจากใบทั้งกองด้วยคำสั่งของตัวเอง
              {' '}(ไม่ได้คิดจากตาราง 20 แถวข้างล่าง ซึ่งจะผิดสำหรับลูกค้าที่ซื้อเกิน 20 ใบ)
            </div>

            {/* 🔴 **เงื่อนไขนี้เคยซ่อนใบซื้อทั้งหมด** (เจอด้วยตา 18 ก.ย. 2569)
                ผู้ติดต่อที่เป็นคู่ค้าอย่างเดียว (ใบขาย 0 ใบ · ใบซื้อ 1 ใบ) จอขึ้นว่า
                "ยังไม่มีออเดอร์ที่จับคู่กับชื่อนี้" ทั้งที่จอ ZORT โชว์ใบซื้อใบนั้นอยู่
                ⇒ ตารางต้องขึ้นเมื่อ **มีใบชนิดใดชนิดหนึ่ง** ไม่ใช่เฉพาะตอนมีใบขาย */}
            {!o?.recent?.length && !buys.length ? (
              <p className="text-[13px] text-gray-500">
                {masked ? 'ดูประวัติไม่ได้เพราะชื่อถูกปิดบัง' : 'ยังไม่มีออเดอร์ที่จับคู่กับชื่อนี้'}
                {d?.purchases === null && ' · และอ่านตารางใบซื้อไม่ได้ ⇒ ยังไม่รู้ว่ามีใบซื้อหรือไม่'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      {/* คอลัมน์ ประเภท แบบ ZORT — ตารางเดียวมีทั้งขายออกและซื้อเข้า
                          ขึ้นเฉพาะเมื่อผู้ติดต่อรายนี้มีใบซื้อจริง ไม่งั้นเป็นคอลัมน์ที่มีค่าเดียวทั้งตาราง */}
                      {!!buys.length && <th className="py-1 pr-2 font-medium">ประเภท</th>}
                      <th className="py-1 pr-2 font-medium">วันที่</th>
                      <th className="py-1 pr-2 font-medium">เลขที่</th>
                      <th className="py-1 pr-2 font-medium">ช่องทาง</th>
                      <th className="py-1 pr-2 font-medium text-right">มูลค่า</th>
                      <th className="py-1 pr-2 font-medium">สถานะ</th>
                      <th className="py-1 font-medium">ชำระเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(o?.recent ?? []).map((r, i) => (
                      <tr key={`${r.id ?? r.number ?? i}`} className="border-b border-gray-100 last:border-0">
                        {!!buys.length && <td className="py-1 pr-2 whitespace-nowrap">ขายออก</td>}
                        {/* 🗓️ เดิมโชว์ปี ค.ศ. ดิบ — เก็บค่าดิบไว้ใน title ให้คนตรวจย้อนได้ */}
                        <td className="py-1 pr-2 whitespace-nowrap" title={r.order_date ? `ค่าที่ท่อส่งมา: ${r.order_date}` : undefined}>
                          {r.order_date ? thaiDate(r.order_date) : '—'}</td>
                        <td className="py-1 pr-2">
                          {/* ลิงก์ข้ามจอ — เลขที่ใบต้องกดเข้ารายละเอียดได้เสมอ (แบบแผนข้อ 1 ของ ZORT) */}
                          {r.number
                            ? <Link href={ลิงก์ใบขาย(r.number, r.order_date)} className="text-blue-600 hover:underline">{r.number}</Link>
                            : '—'}
                        </td>
                        <td className="py-1 pr-2">{r.channel ?? '—'}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(r.amount)}</td>
                        {/* 🔤 เดิมโชว์ค่าดิบ ("Success"/"Paid") — กวาดรอบก่อนไม่เจอเพราะเขียนเป็น `{r.status ?? '—'}`
                            (แพตเทิร์นค้นหาเดิมบังคับให้ปิดปีกกาติดชื่อช่อง) ⇒ รอบนี้ค้นแบบเผื่อ `??` ด้วย
                            ตารางนี้เป็นแถวใบขาย ⇒ ใช้ชุดคำของ "ตาราง" ไม่ใช่ของแผงตัวกรอง */}
                        <td className="py-1 pr-2">{r.status ? zortWord(SALE_STATUS, r.status).text : '—'}</td>
                        <td className="py-1">{r.pay_status ? zortWord(PAY_STATUS, r.pay_status).text : '—'}</td>
                      </tr>
                    ))}
                    {/* 🧾 แถวใบซื้อ — ต่อท้ายเป็นกองของตัวเอง **ไม่เรียงปนกับใบขาย**
                        เพราะสองกองถูกตัดคนละ 20 ใบ ⇒ ถ้าเรียงรวมตามวันแล้วบอกว่า "ล่าสุด"
                        ใบเก่าของกองหนึ่งจะเบียดใบใหม่ของอีกกองหายไปโดยไม่มีอะไรฟ้อง */}
                    {buys.map((r, i) => (
                      <tr key={`buy-${r.id ?? r.number ?? i}`} className="border-b border-gray-100 last:border-0 bg-slate-50/60">
                        <td className="py-1 pr-2 whitespace-nowrap">ซื้อเข้า</td>
                        <td className="py-1 pr-2 whitespace-nowrap" title={r.date ? `ค่าที่ท่อส่งมา: ${r.date}` : undefined}>
                          {r.date ? thaiDate(r.date) : '—'}</td>
                        <td className="py-1 pr-2">{r.number ?? '—'}</td>
                        <td className="py-1 pr-2 text-gray-400">—</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(r.amount)}</td>
                        {/* ใบซื้อใช้ชุดคำของหน้าใบซื้อ ไม่ใช่ของใบขาย (ZORT แยกคำระหว่างหน้าจริง) */}
                        <td className="py-1 pr-2">{r.status ? zortWord(PURCHASE_STATUS, r.status).text : '—'}</td>
                        <td className="py-1">{r.payStatus ? zortWord(PAY_STATUS, r.payStatus).text : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 🧾 ใบซื้อ: บอกให้ชัดว่าเป็นคนละกองที่ถูกตัดคนละ 20 ใบ · null = อ่านไม่ได้ ต้องพูด ไม่ใช่เงียบ */}
                {d?.purchases === null ? (
                  <p className="mt-2 text-[12px] text-amber-800">
                    ⚠️ <b>อ่านตารางใบซื้อไม่ได้</b> — ตารางนี้จึงมีแต่ใบขาย ไม่ได้แปลว่าผู้ติดต่อรายนี้ไม่มีใบซื้อ
                  </p>
                ) : buys.length > 0 && (
                  <p className="mt-2 text-[12px] text-gray-500">
                    รวมใบซื้อเข้า <b>{buys.length}</b> ใบ
                    {typeof d?.purchases?.count === 'number' && d.purchases.count > buys.length
                      ? ` จากทั้งหมด ${d.purchases.count} ใบ` : ''}
                    {' '}— <b>สองกองนี้ถูกตัดคนละ 20 ใบ</b> จึงแยกกองไว้ ไม่ได้เรียงปนกันตามวัน
                    {d?.purchases?.scope ? ` · ${d.purchases.scope}` : ''}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-gray-400">
                  {(o?.recent?.length ?? 0) === 0
                    ? 'ไม่มีใบขายที่จับคู่กับชื่อนี้ (ตารางนี้จึงมีแต่ใบซื้อ)'
                    : `แสดงใบขาย ${o?.recent?.length ?? 0} ใบล่าสุด`}{typeof o?.count === 'number' && o.count > (o.recent?.length ?? 0) ? ` จากทั้งหมด ${o.count} ใบ` : ''}
                  {/* ✅ ดูครบทุกใบ — ท่อ list=orders รับ customer ได้แล้ว (17 ก.ย. 2569) · ต้องบอกว่านับคนละกติกา */}
                  {typeof o?.count === 'number' && o.count > (o.recent?.length ?? 0) && (
                    <>
                      {' · '}
                      <Link href={ลิงก์ใบของลูกค้า(d?.name ?? '', o.firstDay, o.lastDay)} className="text-blue-600 hover:underline">
                        ดูครบทุกใบในรายการขาย
                      </Link>
                      <span className="block text-[11.5px] text-gray-400">
                        จอรายการขายค้นชื่อแบบ &ldquo;มีคำนี้อยู่&rdquo; และนับใบยกเลิกด้วย ⇒ จำนวนอาจมากกว่า {o.count} ใบที่นี่
                        (ที่นี่จับชื่อตรงตัว ไม่นับใบยกเลิก)
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

          </section>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>
}
