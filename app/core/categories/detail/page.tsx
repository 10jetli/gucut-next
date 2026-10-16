'use client'
// ดูภาพรวมหมวดหมู่ — คู่กับ /Product/CategoryDetail ของ ZORT (แบบแผนข้อ 6: มีหน้า "ดูภาพรวม"
// แยกจาก list · จาก parity-zort-clickability.md 8 ก.ย. 2569)
//
// 🔴 **ประกอบจากเส้นที่มีอยู่แล้ว ไม่มีเส้นใหม่**: list=categories (ตัวเลขระดับหมวด)
//    + list=stock&category=<ชื่อ> (สินค้าในหมวด) — ที่เปิดไว้ตอนทำลิงก์หมวดหมู่
//    ⇒ ไม่ต้องรอท่อ · ข้อดีแถม: ตัวเลขสองแหล่งต้องตรงกัน ถ้าไม่ตรง = จอบอกให้เห็น
//
// ⚠️ ค่า zortValue/zortAvailable/zortSkus เป็น **ค่าที่คัดมือจากจอ ZORT** (API ไม่เปิดให้ดึง)
//    ⇒ เก่าได้ · จอต้องเขียนกำกับ ห้ามโชว์ปนกับค่าที่คิดสดจากกระจกโดยไม่บอก
// ⚠️ หมวด "(ยังไม่ได้จัดหมวดใน ZORT)" = แถว category ว่างในกระจก ไม่ใช่หมวดจริงของ ZORT
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { fmtMoney, fmtNum, ต้นเดือนย้อนหลังแบบZORT, วันนี้วันไทย } from '@/lib/format'
import { PageHead, BtnGhost, Pill, TableWrap, TH, TD } from '@/components/zort'

interface CatRow {
  name: string; skus?: number
  zortValue?: number | null; zortAvailable?: number | null; zortSkus?: number | null
  onhand_value?: number; available_value?: number
  onhand_value_sell?: number; available_value_sell?: number
  no_cost?: number; services?: number; zort?: boolean
}
interface StockRow {
  sku?: string; name?: string; onhand?: number; available?: number
  /** 🔴 ท่อส่งคงเหลือมาในชื่อ `qty` (ไม่ใช่ onhand) — เดิมจออ่าน onhand อย่างเดียว ⇒ คอลัมน์คงเหลือขีดทุกแถว (เจอ 16 ต.ค. 2569) */
  qty?: number
  price?: number; cost?: number
}

const NUM = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** เพดานของท่อคือ 200 ต่อคำขอ (core-stock.mjs) — ขอมากกว่านี้ไม่ได้ จึงใช้เป็นขนาดหน้าเลย */
const PAGE = 200

function Inner() {
  const catName = useSearchParams().get('name') ?? ''
  const [cat, setCat] = useState<CatRow | null>(null)
  const [items, setItems] = useState<StockRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  /** ยอดขายเดือนที่แล้ว/เดือนนี้ของหมวด — topproducts&by=category ร้าน z1 (บัญชีเดียวกับจอ ZORT) · null = ยังไม่รู้ */
  const [เดือน, setเดือน] = useState<{ ก่อน: number | null; นี้: number | null; ผิด?: string } | null>(null)

  /* 🔴 **หนึ่งคำขอต่อการกดหนึ่งครั้ง — ห้ามวนกวาดทุกหน้ามานับเอง**
     ท่อ cap limit ไว้ 200 ตายตัว และส่ง total ของหมวดมาให้แล้ว ⇒ ใช้ total ปิดปุ่ม
     ท่าเดียวกับจอสินค้า/รายการขาย (ดู stock/page.tsx: shown = offset + rows.length) */
  /* 📅 การ์ดยอดขายสองเดือนแบบ ZORT — ไล่ nextOffset ของท่อจนเจอหมวดนี้ (ไม่ส่ง limit เอง)
     ⚠️ ยอดเราตัดใบค้างจ่ายแล้ว (unpaidAmount ต่อแถว) แต่ **ยังไม่หักใบคืน** (ท่อทำรายแถวไม่ได้) ⇒ ZORT ต่ำกว่าได้ · เขียนบนการ์ด
     📏 วัด 16 ต.ค. 2569 โซ่ NEWWAVE: ก.ย. เรา 112,878.15 vs ZORT 108,935.33 · ต.ค. 52,751.38 vs 50,764.10 */
  useEffect(() => {
    if (!catName) return
    let ยกเลิก = false
    const หา = async (from: string, to: string): Promise<number | null> => {
      let off = 0
      for (let i = 0; i < 20; i++) {
        const r = await fetch(`/api/web/core?list=topproducts&by=category&store=z1&from=${from}&to=${to}&offset=${off}`).then((x) => x.json())
        if (!r || !Array.isArray(r.items)) throw new Error(r?.error || 'ท่อไม่ส่งแถวมา')
        const row = r.items.find((x: { category?: string }) => x.category === catName)
        if (row) return typeof row.amount === 'number' ? row.amount - (typeof row.unpaidAmount === 'number' ? row.unpaidAmount : 0) : null
        if (typeof r.nextOffset !== 'number') return 0 /* ไล่ครบทุกหมวดแล้วไม่เจอ = ช่วงนั้นหมวดนี้ไม่มียอดจริง */
        off = r.nextOffset
      }
      return null
    }
    const วันนี้ = วันนี้วันไทย()
    const ต้นเดือนนี้ = ต้นเดือนย้อนหลังแบบZORT(0) ?? `${วันนี้.slice(0, 7)}-01`
    const ต้นเดือนก่อน = ต้นเดือนย้อนหลังแบบZORT(1) ?? ''
    const สิ้นเดือนก่อน = new Date(Date.parse(ต้นเดือนนี้) - 864e5).toISOString().slice(0, 10)
    Promise.all([หา(ต้นเดือนก่อน, สิ้นเดือนก่อน), หา(ต้นเดือนนี้, วันนี้)])
      .then(([ก่อน, นี้]) => { if (!ยกเลิก) setเดือน({ ก่อน, นี้ }) })
      .catch((e) => { if (!ยกเลิก) setเดือน({ ก่อน: null, นี้: null, ผิด: String(e instanceof Error ? e.message : e) }) })
    return () => { ยกเลิก = true }
  }, [catName])

  const load = useCallback(async (off = 0) => {
    if (!catName) { setError('ไม่ได้ระบุหมวด (ต้องเปิดจากจอหมวดหมู่)'); setLoading(false); return }
    setLoading(true); setError(''); setWarn('')
    try {
      /* ยิงสองเส้นพร้อมกัน — เส้นไหนล้มบอกเฉพาะเส้นนั้น ไม่ทำให้ทั้งจอว่าง */
      const [cRes, sRes] = await Promise.allSettled([
        fetch('/api/web/core?list=categories').then((r) => r.json()),
        fetch(`/api/web/core?list=stock&category=${encodeURIComponent(catName)}`
          + `&limit=${PAGE}&offset=${off}&marketplaces=1`).then((r) => r.json()),
      ])

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value?.rows)) {
        const hit = (cRes.value.rows as CatRow[]).find((r) => r.name === catName) ?? null
        setCat(hit)
        if (!hit) setWarn(`ไม่พบหมวด "${catName}" ในรายการหมวดหมู่ — อาจถูกลบ/เปลี่ยนชื่อหลังคุณเปิดหน้ามา`)
      } else setWarn('ดึงตัวเลขระดับหมวดไม่ได้ — ตารางสินค้าข้างล่างยังใช้ได้')

      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value?.rows)) {
        setItems(sRes.value.rows as StockRow[])
        setTotal(NUM(sRes.value.total))
        // ขยับตัวชี้หน้า **หลังคำขอสำเร็จเท่านั้น** — ล้มแล้วขยับ = ปุ่มกับของบนจอไม่ตรงกัน
        setOffset(off)
      } else {
        setItems(null)
        throw new Error('ดึงรายการสินค้าในหมวดนี้ไม่ได้')
      }
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [catName])
  // เปลี่ยนหมวด = กลับไปหน้าแรกเสมอ (หมวดใหม่ไม่มีเหตุผลให้เริ่มที่หน้า 2 ของหมวดเก่า)
  useEffect(() => { load(0) }, [load])

  /* ตัวเลขสองแหล่งต้องตรงกัน — ไม่ตรง = บอกให้เห็น ไม่ใช่เลือกข้างเงียบ ๆ
     (จำนวน SKU จาก list=categories vs total จาก list=stock&category) */
  const catSkus = NUM(cat?.skus)
  const mismatch = catSkus !== null && total !== null && catSkus !== total
  /** ดูไปแล้วถึงแถวที่เท่าไหร่ (นับจากหน้าแรก) — ตัวเดียวกับที่จอสินค้าใช้ปิดปุ่ม "ถัดไป" */
  const seen = offset + (items?.length ?? 0)

  return (
    <div className="p-4 md:p-6">
      <p className="text-[12.5px] mb-2"><Link href="/core/categories" className="text-blue-600 hover:underline">‹ หมวดหมู่</Link></p>
      <PageHead
        title={catName || '—'}
        summary={<span className="text-gray-500">รายละเอียดหมวดหมู่</span>}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/core/stock?category=${encodeURIComponent(catName)}`}
              className="text-[12.5px] font-semibold text-white rounded-full px-4 py-1.5" style={{ background: '#4669e5' }}>
              เปิดในจอสินค้า
            </Link>
            {/* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — ZORT ไม่มีปุ่มรีเฟรชในจอไหนเลยที่อ่านมา */}
          </div>
        }
      />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'เปิดหมวดนี้ไม่ได้'}>{error}</ErrorBox>}
      {warn && !error && (
        <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">⚠️ {warn}</p>
      )}
      {loading && <LoadingState />}

      {!loading && !error && (
        <>
          {cat?.zort === false && (
            <p className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
              หมวดนี้<b>ไม่ได้มาจาก ZORT</b> — เป็นกลุ่มที่ระบบเราเดาจากชื่อสินค้า/รวมของที่ยังไม่ได้จัดหมวด
            </p>
          )}

          {/* 🗂 การ์ด 4 ใบตามผัง ZORT /Product/CategoryDetail (อ่านจอจริง 16 ต.ค. 2569):
              สินค้าคงเหลือ (บาท) · สินค้าพร้อมขาย (บาท) · ยอดขายเดือนที่แล้ว (บาท) · ยอดขายเดือนนี้ (บาท)
              สองใบแรก = ค่าที่คัดจากจอ ZORT (ต้นทุนเฉลี่ยที่ API ไม่เปิด) — บอกที่มาบนการ์ด · ค่าที่เราคิดเองย้ายไปบรรทัดรอง */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {([
              ['สินค้าคงเหลือ (บาท)', NUM(cat?.zortValue), 'คัดจากจอ ZORT (เก่าได้ ซื้อของเข้าแล้วต้องคัดใหม่)'],
              ['สินค้าพร้อมขาย (บาท)', NUM(cat?.zortAvailable), 'คัดจากจอ ZORT (เก่าได้)'],
              ['ยอดขายเดือนที่แล้ว (บาท)', เดือน ? เดือน.ก่อน : undefined, 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้'],
              ['ยอดขายเดือนนี้ (บาท)', เดือน ? เดือน.นี้ : undefined, 'ร้าน z1 · ตัดใบค้างจ่ายแล้ว · ยังไม่หักใบคืน ⇒ ZORT ต่ำกว่าได้'],
            ] as [string, number | null | undefined, string][]).map(([label, val, note]) => (
              <div key={label} className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[11.5px] text-gray-500">{label}</p>
                <p className="text-[18px] font-semibold text-gray-900 tabular-nums">
                  {val === undefined ? <span className="text-[12.5px] text-gray-300">กำลังถาม…</span>
                    : val === null ? <span className="text-[12.5px] text-gray-400">ยังไม่รู้{เดือน?.ผิด && label.startsWith('ยอดขาย') ? ` — ${เดือน.ผิด}` : ''}</span>
                    : fmtMoney(val)}
                </p>
                <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{note}</p>
              </div>
            ))}
          </div>
          {/* ค่าที่เราคิดเองจากต้นทุนในกระจก — ไม่ใช่เลขของ ZORT (ต้นทุนคนละแบบ) ⇒ บรรทัดรอง พร้อมป้าย */}
          <p className="text-[11.5px] text-gray-500 mb-4 leading-relaxed">
            ระบบเราคิดเอง (ไม่ใช่เลข ZORT): {catSkus === null ? '' : <>SKU <b>{fmtNum(catSkus)}</b> · </>}
            มูลค่าคงเหลือตามทุนในกระจก <b>{NUM(cat?.onhand_value) === null ? '—' : fmtMoney(cat!.onhand_value as number)}</b> ·
            {' '}พร้อมขาย <b>{NUM(cat?.available_value) === null ? '—' : fmtMoney(cat!.available_value as number)}</b> ·
            {' '}ตามราคาขาย <b>{NUM(cat?.onhand_value_sell) === null ? '—' : fmtMoney(cat!.onhand_value_sell as number)}</b>
            {NUM(cat?.zortSkus) !== null && <> · ZORT นับ SKU <b>{fmtNum(cat!.zortSkus as number)}</b></>}
          </p>

          {mismatch && (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              ⚠️ <b>ตัวเลขสองแหล่งไม่ตรงกัน</b>: หน้าหมวดหมู่นับ {fmtNum(catSkus!)} SKU ·
              เส้นรายการสินค้าบอกว่าหมวดนี้มี {fmtNum(total!)} รายการ — น่าจะเป็นการนับคนละนิยาม
              (รวม/ไม่รวมรายการบริการ) · <b>ยังไม่สรุปว่าตัวไหนถูก</b>
              {/* เดิมเขียนว่า "อาจเป็นเพราะเพดานดึง 200" — ใช้ไม่ได้แล้วตั้งแต่จอนี้แบ่งหน้า
                  เพราะ total เป็นยอดของหมวดทั้งหมด ไม่ได้ถูกเพดานตัด (11 ก.ย. 2569) */}
            </p>
          )}

          {/* หัวตาราง: บอก "ช่วงที่กำลังดู จากทั้งหมด" ไม่ใช่แค่จำนวนแถวในหน้านี้
              (แถวที่ 1–200 จาก 218 อ่านรู้เรื่องกว่า "200 จาก 218" เมื่อมีหลายหน้า) */}
          <p className="text-[12.5px] font-semibold text-gray-700 mb-1.5">
            สินค้าในหมวดนี้{' '}
            {!items ? '' : total !== null && total > items.length
              ? `(แถวที่ ${fmtNum(offset + 1)}–${fmtNum(seen)} จาก ${fmtNum(total)})`
              : `(${fmtNum(items.length)})`}
          </p>
          {!items ? null : items.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-6 text-center">
              ไม่มีสินค้าในหมวดนี้ (หมวดมีอยู่จริงแต่ยังไม่มีสินค้าผูกอยู่)
            </p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[620px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                    <th className={`${TH} text-right`}>คงเหลือ</th><th className={`${TH} text-right`}>พร้อมขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.sku ?? i} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} font-mono text-[12.5px]`}>
                        {it.sku
                          ? <Link href={`/core/stock?q=${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">{it.sku}</Link>
                          : '—'}
                      </td>
                      <td className={TD}>{it.name || '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{(NUM(it.onhand) ?? NUM(it.qty)) === null ? '—' : fmtNum((NUM(it.onhand) ?? NUM(it.qty))!)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {NUM(it.available) === null ? '—'
                          : <span className={it.available! < 0 ? 'text-red-600 font-semibold' : ''}>{fmtNum(it.available!)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          {/* ปุ่มหน้า — โชว์เมื่อมีของเกินหนึ่งหน้าเท่านั้น (หมวดเล็กไม่ต้องมีปุ่มให้รำคาญ)
              ⚠️ ปิด "ถัดไป" ด้วย total ของท่อ ไม่ใช่ "หน้านี้ได้ครบ 200 ไหม" —
                 หน้าสุดท้ายที่ได้ครบ 200 พอดีจะทำให้ปุ่มเปิดค้างแล้วกดไปเจอหน้าว่าง */}
          {items !== null && total !== null && (total > PAGE || offset > 0) && (
            <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
              <p className="text-[11.5px] text-gray-400">
                ดึงได้ {fmtNum(PAGE)} รายการต่อครั้ง (เพดานของท่อ) · ดูทั้งหมดพร้อมตัวกรองได้ที่{' '}
                <Link href={`/core/stock?category=${encodeURIComponent(catName)}`} className="text-blue-600 hover:underline">จอสินค้า</Link>
              </p>
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || seen >= total}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CategoryDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
