'use client'
// รหัสที่ยังไม่มีรูป — ทำเพื่อปิดใบ t_mu2u6eg6 ("รูปต้องขึ้นทุกรหัส" · ท่านประธานสั่งเอง 15 ก.ย. 2569)
//
// 📏 **วัดของจริงทั้งคลัง 16 ก.ย. 2569 (2,672 รหัส)** — และตัวเลขแรกที่ทีมใช้นั้นผิด
//    ถ้านับจากช่อง `imageFile` ของท่ออย่างเดียว จะได้ "ยังไม่ย่อ 1,930 รหัส"
//    แต่จอไม่ได้ใช้ช่องนั้นช่องเดียว — มันอ่าน **แผนที่ `sku-images.json` (2,337 คู่)** ก่อนเสมอ
//    ⇒ ของจริง: ขึ้นรูปได้แล้ว **2,204** · ไม่มีรูปเลย **468** · "ZORT มีรูปแต่จอขึ้นไม่ได้" = **0**
//    ⇒ งานที่เหลือคือ **ถ่ายรูป/อัปโหลด 468 รหัส** ไม่ใช่งานย่อรูป
//
// 🔴 **จอนี้ต้องไล่ทุกหน้าจริง ๆ ห้ามตัดสินจากหน้าแรก**
//    ตัวนับที่คิดจาก 50-200 แถวแรกคือคำตอบที่ผิดแบบดูน่าเชื่อ (โรคประจำของโปรเจกต์)
//    ⇒ เดินทีละหน้า 200 แถว บอกความคืบหน้าระหว่างทาง และ **ยังไม่สรุปจนกว่าจะครบ total**
// ⚠️ อ่านอย่างเดียว — ไม่เขียนอะไรกลับไปที่ ZORT
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHead, BtnGhost, TableWrap, TH, TD, EmptyState } from '@/components/zort'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import { fmtNum } from '@/lib/format'

const PER = 200

/* ⚠️ ต้องเก็บ `qty` กับ `sold` มาด้วย — ใช้จัดลำดับว่า "ควรถ่ายรูปอันไหนก่อน"
   (ท่อส่งสองช่องนี้มากับ `list=stock` อยู่แล้ว ไม่ต้องยิงเพิ่ม) */
interface Row {
  sku: string; name?: string | null; imageFile?: string | null; imagePath?: string | null
  active?: boolean; qty?: number | null; sold?: number | null
}

export default function NoImagePage() {
  const imgOf = useSkuImages()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [อ่านแล้ว, setอ่านแล้ว] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(''); setRows([]); setอ่านแล้ว(0); setTotal(null)
    const all: Row[] = []
    let off = 0
    let cap: number | null = null
    try {
      for (;;) {
        const qs = new URLSearchParams({ list: 'stock', limit: String(PER), offset: String(off), sort: 'sku' })
        // eslint-disable-next-line no-await-in-loop -- ตั้งใจไล่ทีละหน้า ไม่ยิงพร้อมกันเป็นสิบคำขอ
        const res = await fetch(`/api/web/core?${qs}`)
        // eslint-disable-next-line no-await-in-loop
        const j = await res.json().catch(() => null)
        if (!j) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
        if (typeof j.skip === 'string') throw new Error(j.skip)
        if (!res.ok || j.error) throw new Error(String(j.error || `ท่อตอบ ${res.status}`))
        const page: Row[] = Array.isArray(j.rows) ? j.rows : []
        if (cap === null && typeof j.total === 'number') { cap = j.total; setTotal(j.total) }
        all.push(...page)
        off += page.length
        setอ่านแล้ว(off)
        if (!page.length) break
        if (cap !== null && off >= cap) break
        if (off > 20000) break // กันวนไม่รู้จบถ้าท่อเพี้ยน
      }
      setRows(all)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  /* แยกสามกอง **ด้วยกติกาเดียวกับที่ตารางสินค้าใช้จริง** (แผนที่รูปย่อ → imageFile → imagePath)
     ⚠️ ถ้าใช้กติกาคนละชุดกับตาราง ตัวเลขที่นี่จะไม่ตรงกับสิ่งที่คนเห็น = เลขที่เถียงกับจอ */
  const มีรูป = rows.filter((r) => imgOf(r.sku) || (r.imageFile && String(r.imageFile).trim() && String(r.imageFile) !== 'None'))
  const เหลือ = rows.filter((r) => !มีรูป.includes(r))
  const ZORTมีแต่ยังไม่ย่อ = เหลือ.filter((r) => {
    const p = String(r.imagePath ?? '').trim()
    return p && p !== 'None'
  })
  const ยังไม่จัดลำดับ = เหลือ.filter((r) => !ZORTมีแต่ยังไม่ย่อ.includes(r))
  /* 🎯 เรียงว่า "ควรถ่ายอันไหนก่อน" — ของที่มีของในคลัง**และ**เคยขายได้ ขึ้นก่อน
     เพราะเป็นของที่มีของอยู่จริงและมีคนซื้อจริง ⇒ ถ่ายแล้วได้ผลทันที
     ⚠️ ค่าที่ไม่มา (`null`/`undefined`) **ไม่ใช่ 0** ⇒ ให้ตกไปกลุ่มท้าย ไม่ใช่ถูกนับว่าไม่เคยขาย */
  const เลข = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const คะแนน = (r: Row) => {
    const q = เลข(r.qty), s2 = เลข(r.sold)
    if ((q ?? 0) > 0 && (s2 ?? 0) > 0) return 0      // มีของ + เคยขาย
    if ((q ?? 0) > 0) return 1                        // มีของ แต่ยังไม่เคยขาย
    if ((s2 ?? 0) > 0) return 2                       // เคยขาย แต่ตอนนี้ของหมด
    return 3
  }
  const ไม่มีรูปเลย = [...ยังไม่จัดลำดับ].sort((a, b) =>
    คะแนน(a) - คะแนน(b) || (เลข(b.sold) ?? 0) - (เลข(a.sold) ?? 0) || (เลข(b.qty) ?? 0) - (เลข(a.qty) ?? 0)
    || String(a.sku).localeCompare(String(b.sku)))
  const ควรถ่ายก่อน = ไม่มีรูปเลย.filter((r) => คะแนน(r) === 0).length
  const มีของเฉย = ไม่มีรูปเลย.filter((r) => คะแนน(r) === 1).length
  const ครบแล้ว = !loading && total !== null && อ่านแล้ว >= total

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ไม่มีรูปเลย.map((r) => r.sku).join('\n'))
      setCopyMsg(`คัดลอกแล้ว ${fmtNum(ไม่มีรูปเลย.length)} รหัส`)
    } catch { setCopyMsg('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เขียนคลิปบอร์ด') }
    setTimeout(() => setCopyMsg(''), 6000)
  }

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <p className="text-[12px] mb-2"><Link href="/core/stock" className="text-blue-600 hover:underline">‹ สินค้า</Link></p>
      <PageHead
        title="รหัสที่ยังไม่มีรูป"
        summary={<span className="text-gray-500">
          ไล่ดู<b>ทุกหน้า</b>ของทะเบียนสินค้า แล้วแยกว่ารหัสไหน<b>ยังต้องถ่ายรูป</b> — อ่านอย่างเดียว
        </span>}
        actions={<BtnGhost onClick={() => void load()} disabled={loading}>{loading ? 'กำลังอ่าน…' : 'อ่านใหม่'}</BtnGhost>}
      />

      {error && <ErrorBox title="อ่านทะเบียนสินค้าไม่สำเร็จ">{error}</ErrorBox>}

      {/* 🔴 ระหว่างยังไม่ครบ **ห้ามโชว์เลขสรุปเป็นคำตอบ** — เขียนว่ากำลังอ่านถึงไหน */}
      {!ครบแล้ว && !error && (
        <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
          ⏳ กำลังไล่อ่านทุกหน้า — อ่านแล้ว <b>{fmtNum(อ่านแล้ว)}</b>
          {total !== null ? <> จาก <b>{fmtNum(total)}</b> รหัส</> : <> รหัส (ท่อยังไม่บอกว่าทั้งหมดมีกี่รหัส)</>}
          {' '}· ตัวเลขข้างล่าง<b>ยังไม่ใช่คำตอบสุดท้าย</b>
        </p>
      )}

      {ครบแล้ว && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="text-[12px] text-gray-500">จอขึ้นรูปได้แล้ว</div>
            <div className="text-[20px] font-semibold text-emerald-700">{fmtNum(มีรูป.length)}</div>
            <div className="text-[11.5px] text-gray-400">รูปย่อในถังเรา (แผนที่รูป หรือไฟล์ที่ย่อแล้ว)</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="text-[12px] text-gray-500">ZORT มีรูป แต่ยังไม่ย่อ</div>
            <div className="text-[20px] font-semibold text-amber-700">{fmtNum(ZORTมีแต่ยังไม่ย่อ.length)}</div>
            <div className="text-[11.5px] text-gray-400">จอย่อให้เองตอนแสดง — ไม่ต้องถ่ายเพิ่ม</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="text-[12px] text-gray-500">ไม่มีรูปเลย — ต้องถ่าย</div>
            <div className="text-[20px] font-semibold text-red-700">{fmtNum(ไม่มีรูปเลย.length)}</div>
            <div className="text-[11.5px] text-gray-400">นี่คืองานที่เหลือจริงของใบนี้</div>
          </div>
        </div>
      )}

      {ครบแล้ว && ไม่มีรูปเลย.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] mb-3">
          <button type="button" onClick={() => { void copy() }}
            className="font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-50">
            คัดลอกรหัสทั้งหมด
          </button>
          {copyMsg && <span className="text-gray-600">{copyMsg}</span>}
          {/* ลิงก์ออกไปจอของ ZORT ที่อัปโหลดรูปหลายรหัสรวดเดียวได้ — **เราไม่กดแทนให้**
              (กติกาของทีม: ระบบของเราอ่าน ZORT อย่างเดียว การอัปโหลดรูปเป็นการเขียน) */}
          <a href="https://secure.zortout.com/Product/AddPicturelist" target="_blank" rel="noreferrer"
            className="text-blue-600 hover:underline">
            เปิดจัดการรูปภาพสินค้าใน ZORT ↗
          </a>
        </div>
      )}

      {/* 🎯 **จัดลำดับว่าควรถ่ายอันไหนก่อน** (เพิ่ม 18 ก.ย. 2569)
          ของเดิมเรียงตามรหัส ⇒ คนถ่ายเริ่มจากรหัสน้อยสุด ซึ่งอาจเป็นของที่ไม่มีใครซื้อ
          ⚠️ เกณฑ์นี้เป็นของเราเอง ไม่ใช่กติกาของ ZORT — เขียนกำกับบนจอไว้แล้ว
          ⚠️ `sold`/`qty` ที่ไม่มีค่า **ไม่ใช่ 0** ⇒ ตกไปอยู่กลุ่มท้าย ไม่ใช่ถูกนับว่าไม่เคยขาย */}
      {ครบแล้ว && ไม่มีรูปเลย.length > 0 && (
        <p className="text-[12.5px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🎯 <b>ควรถ่ายก่อน {fmtNum(ควรถ่ายก่อน)} รหัส</b> — ของที่<b>มีของในคลัง</b>และ<b>เคยขายได้</b>
          {' '}(เรียงจากขายมากไปน้อยให้แล้ว) · รองลงมาคือของที่มีของแต่ยังไม่เคยขาย {fmtNum(มีของเฉย)} รหัส
          <span className="block text-[11.5px] text-gray-500 mt-0.5">
            เกณฑ์นี้เราตั้งเอง ไม่ใช่ลำดับของ ZORT · ตัวเลขขายมาจากช่วงที่ทะเบียนสินค้าเก็บไว้
          </span>
        </p>
      )}

      {ครบแล้ว && (
        <TableWrap>
          <table className="w-full">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className={TH} style={{ width: 44 }}>#</th>
                <th className={TH}>รหัส</th>
                <th className={TH}>ชื่อสินค้า</th>
                {/* ⚠️ ต้องโชว์เหตุผลของลำดับ ไม่งั้นคนอ่านไม่รู้ว่าทำไมรหัสนี้อยู่บน
                    (ลำดับที่อธิบายตัวเองไม่ได้ = คนจะเรียงใหม่เองแล้วเสียประโยชน์ที่ตั้งใจให้) */}
                <th className={TH} style={{ width: 70, textAlign: 'right' }}>คงเหลือ</th>
                <th className={TH} style={{ width: 70, textAlign: 'right' }}>ขายไป</th>
                <th className={TH} style={{ width: 90 }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {ไม่มีรูปเลย.length === 0 && (
                <EmptyState cols={4} icon="🖼️" title="ทุกรหัสมีรูปแล้ว"
                  detail="ไม่มีรหัสไหนที่ยังต้องถ่ายรูป — ถ้าเพิ่งเพิ่มสินค้าใหม่ที่ ZORT ให้กดอ่านใหม่อีกครั้ง" />
              )}
              {ไม่มีรูปเลย.map((r, i) => (
                <tr key={r.sku} className="border-b border-[#e8ecf8] last:border-0">
                  <td className={`${TD} text-gray-400`}>{i + 1}</td>
                  <td className={`${TD} font-medium whitespace-nowrap`}>
                    <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="text-blue-600 hover:underline">{r.sku}</Link>
                  </td>
                  <td className={TD}>{r.name || <span className="text-gray-400">— ท่อไม่ส่งชื่อมา</span>}</td>
                  <td className={TD} style={{ textAlign: 'right' }}>{typeof r.qty === 'number' ? fmtNum(r.qty) : <span className="text-gray-300" title="ท่อไม่ได้ส่งจำนวนมา — ไม่ใช่ 0">—</span>}</td>
                  <td className={TD} style={{ textAlign: 'right' }}>{typeof r.sold === 'number' ? fmtNum(r.sold) : <span className="text-gray-300" title="ท่อไม่ได้ส่งยอดขายมา — ไม่ใช่ 0">—</span>}</td>
                  <td className={TD}>
                    {r.active === false
                      ? <span className="text-[11px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">ปิดใช้งาน</span>
                      : <span className="text-[11px] text-gray-400">ใช้งาน</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  )
}
