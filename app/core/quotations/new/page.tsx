'use client'
// ใบเสนอราคา → สร้างใบใหม่ (เขียนทะลุไป ZORT)
//
// 🔴 **จอแรกของหลังร้านนี้ที่เขียนข้อมูลเข้า ZORT จริง**
//    เจ้าของร้านอนุมัติ 6 ก.ย. 2569 — **จำกัดขอบเขตไว้ที่ใบเสนอราคาใบเดียว**
//    ⚠️ **ห้ามขยายไปเพิ่มสินค้า/ใบสั่งซื้อ โดยไม่ได้รับอนุมัติใหม่**
//       เหตุผลที่ฝั่งท่อให้ไว้ และควรจำ: เพิ่มสินค้าเสี่ยงสุด เพราะยังไม่รู้ว่า ZORT ของร้าน
//       ตั้งค่า "ดันสินค้าใหม่ขึ้นมาร์เก็ตเพลสอัตโนมัติ" ไว้หรือเปล่า
//       ⇒ ถ้าตั้งไว้ สินค้าชื่อ "ทดสอบระบบ" จะโผล่หน้าร้านลูกค้าจริง
//    ส่วนใบเสนอราคา: ไม่แตะสต็อก ไม่แตะเงิน ไม่ออกนอก ZORT ⇒ เสียหายจำกัดที่สุด
//
// ① **โหมดซ้อมเป็นค่าเริ่มต้น และบังคับให้ซ้อมผ่านก่อนถึงจะส่งจริงได้**
//    ไม่ใช่แค่ "มีปุ่มซ้อมให้เลือก" — ปุ่มส่งจริงกดไม่ได้จนกว่าจะซ้อม **เนื้อหาชุดเดียวกัน** ผ่านแล้ว
//    แก้อะไรหลังซ้อม = ต้องซ้อมใหม่ (สถานะซ้อมผูกกับเนื้อหา ไม่ใช่ผูกกับการกดปุ่ม)
//    ⇒ เหตุผล: **ZORT ไม่เปิด API ให้ลบใบ** (ยิงตรวจ 6 ก.ย. 2569) ยิงพลาดแล้วแก้คืนไม่ได้
//
// ② **ref บังคับ และคงที่ต่อหนึ่งใบ** — ฝั่งท่อกันยิงซ้ำด้วย ref
//    ⚠️ ห้ามสร้าง ref ใหม่ทุกครั้งที่กด ไม่งั้นกดสองครั้ง = ได้ใบสองใบ (ตาข่ายพังทันที)
//
// ③ **`unknown` ห้ามแสดงว่า "ไม่สำเร็จ"** — ดูเหตุผลเต็มใน components/zort/WriteResult.tsx
//
// ⚠️ **ห้ามเขียนบนจอว่าใบเสนอราคา "แก้ทีหลังได้"** — ZORT มีเส้นชื่อ EditQuotation อยู่จริง
//    **แต่ยังไม่มีใครยิงของจริง** ⇒ เขียนได้แค่ "ยังไม่ได้ทดสอบ"
import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'

interface Line { sku: string; qty: string; price: string }

const BLANK: Line = { sku: '', qty: '', price: '' }

export default function NewQuotationPage() {
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<WriteResp | null>(null)
  /** เนื้อหาที่ "ซ้อมผ่านแล้ว" — เก็บเป็นลายเซ็นข้อความ เพื่อรู้ว่าหลังซ้อมมีการแก้อะไรอีกไหม */
  const [okDry, setOkDry] = useState('')
  /** 🔴 เลขอ้างอิงของใบนี้ — **สร้างครั้งเดียวตอนเปิดหน้า ห้ามสร้างใหม่ตอนกด** */
  const [ref] = useState(() => `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)

  const clean = useMemo(() => lines
    .map((l) => ({ sku: l.sku.trim(), qty: Number(l.qty), price: l.price.trim() === '' ? null : Number(l.price) }))
    .filter((l) => l.sku && Number.isFinite(l.qty) && l.qty > 0), [lines])

  /** ลายเซ็นของเนื้อหา — ใช้ตัดสินว่า "ซ้อมผ่านแล้ว" ยังใช้กับของที่เห็นตรงหน้าอยู่ไหม */
  const sig = useMemo(
    () => JSON.stringify({ customer: customer.trim(), phone: phone.trim(), note: note.trim(), reference: reference.trim(), clean }),
    [customer, phone, note, reference, clean],
  )
  const dryOk = okDry !== '' && okDry === sig

  const total = clean.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0)
  const priced = clean.filter((l) => l.price !== null).length

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!customer.trim()) { setErr('ต้องมีชื่อลูกค้า'); return }
    if (!clean.length) { setErr('ต้องมีรายการสินค้าอย่างน้อย 1 บรรทัด (จำนวนต้องมากกว่า 0)'); return }
    /* ⚠️ รหัสซ้ำในใบเดียว — เราไม่รู้ว่า ZORT รวมให้หรือทิ้งบรรทัดหลัง ⇒ กันไว้ก่อน ให้คนรวมเอง
       (บทเรียนจากจอรับสินค้า: ตาข่ายกันซ้ำที่ปลายทางกลืนบรรทัดที่สองแบบเงียบ ๆ) */
    const dup = clean.map((l) => l.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) { setErr(`รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน`); return }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?addquotation=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          customer: customer.trim(),
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
          reference: reference.trim() || undefined,
          items: clean.map((l) => ({ sku: l.sku, qty: l.qty, ...(l.price === null ? {} : { price: l.price }) })),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      setRes(r)
      // ซ้อมผ่าน = จำลายเซ็นของเนื้อหาไว้ · แก้อะไรหลังจากนี้ ปุ่มส่งจริงจะปิดเอง
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [customer, phone, note, reference, clean, ref, sig])

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="สร้างใบเสนอราคา"
        summary={
          <>
            สร้างใบใน ZORT โดยตรง
            {' | '}
            <span className="text-gray-400">เลขอ้างอิงใบนี้: <b>{ref}</b> (กันการส่งซ้ำ)</span>
          </>
        }
        actions={<Link href="/core/quotations" className="text-[13px] text-blue-600 hover:underline">← กลับรายการใบเสนอราคา</Link>}
      />

      {/* 🔴 คำเตือนอยู่เหนือฟอร์ม ไม่ใช่ใต้ปุ่ม — คนอ่านก่อนกรอก ไม่ใช่หลังกด */}
      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        🔴 <b>ZORT ไม่เปิดช่องทางให้ลบใบเสนอราคา</b> (ยิงตรวจ 6 ก.ย. 2569) —
        ส่งพลาดแล้วต้องเข้าไปจัดการในหน้าจอ ZORT เอง
        <br />
        จอนี้จึงบังคับให้ <b>ทดลองส่งผ่านก่อน</b> แล้วปุ่มส่งจริงถึงจะกดได้ ·
        แก้อะไรหลังทดลองส่ง <b>ต้องทดลองใหม่</b>
        <br />
        ⚠️ <b>ยังไม่มีใครยิงของจริงผ่านเส้นนี้เลยสักใบ</b> — ใบแรกที่ส่งจริงคือการทดสอบตัวมันเอง
        {' '}⇒ ใบแรกควรเป็นใบเล็ก ๆ ที่ยอมให้ผิดได้
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12.5px] text-gray-600">ชื่อลูกค้า <span className="text-red-600">*</span></span>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ชื่อ-นามสกุล หรือชื่อบริษัท" />
          </label>
          <label className="block">
            <span className="text-[12.5px] text-gray-600">เบอร์โทร</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ไม่ใส่ก็ได้" />
          </label>
          <label className="block">
            <span className="text-[12.5px] text-gray-600">เลขอ้างอิงของร้าน</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="เช่น เลขใบเสนอราคาเดิม" />
          </label>
          <label className="block">
            <span className="text-[12.5px] text-gray-600">หมายเหตุในใบ</span>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ไม่ใส่ก็ได้" />
          </label>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[560px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>รหัสสินค้า (SKU)</th>
              <th className={THR} style={{ width: 120 }}>จำนวน</th>
              <th className={THR} style={{ width: 160 }}>ราคา/หน่วย</th>
              <th className={TH} style={{ width: 56 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                <td className={TD}>
                  <input value={l.sku} onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px]" placeholder="รหัสสินค้า" />
                </td>
                <td className={TDR}>
                  <input value={l.qty} inputMode="numeric"
                    onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px] text-right" placeholder="0" />
                </td>
                <td className={TDR}>
                  <input value={l.price} inputMode="decimal"
                    onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px] text-right" placeholder="ไม่ใส่ = ให้ ZORT คิดเอง" />
                </td>
                <td className={TD}>
                  {lines.length > 1 && (
                    <button onClick={() => setLines((v) => v.filter((_, j) => j !== i))}
                      className="text-[12px] text-gray-400 hover:text-red-600">ลบ</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <BtnGhost onClick={() => setLines((v) => [...v, { ...BLANK }])}>+ เพิ่มบรรทัด</BtnGhost>
        {/* ⚠️ ยอดรวมต้องประกาศขอบเขตตัวเอง — บรรทัดที่ไม่ใส่ราคาไม่ได้ถูกนับ
            ถ้าเขียนแค่ "รวม ฿X" คนจะนึกว่านั่นคือยอดทั้งใบ */}
        <span className="text-[13px] text-gray-600">
          {clean.length === 0
            ? <span className="text-gray-400">ยังไม่มีบรรทัดที่ใช้ได้</span>
            : priced === clean.length
              ? <>รวม <b>{fmtMoney(total)}</b> ({clean.length} บรรทัด)</>
              : <>รวมเฉพาะ <b>{priced}</b> บรรทัดที่ใส่ราคา = <b>{fmtMoney(total)}</b>
                {' '}<span className="text-amber-700">· อีก {clean.length - priced} บรรทัดปล่อยให้ ZORT คิดราคาเอง</span></>}
        </span>
      </div>

      {err && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>
      )}

      <WriteResult r={res} />

      {/* 🔴 ปุ่มส่งจริงปิดอยู่จนกว่าจะซ้อม "เนื้อหาชุดเดียวกัน" ผ่าน — ไม่ใช่แค่ "เคยกดซ้อม" */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => send(false)} disabled={busy}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !dryOk}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: dryOk ? '#c0392b' : '#9aa0a6' }}>
          ส่งจริงเข้า ZORT
        </button>
        {!dryOk && (
          <span className="text-[12.5px] text-gray-500">
            {okDry === '' ? 'ต้องกดทดลองส่งให้ผ่านก่อน' : 'เนื้อหาเปลี่ยนหลังทดลองส่ง — ต้องทดลองใหม่'}
          </span>
        )}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        เลขอ้างอิง <b>{ref}</b> สร้างครั้งเดียวตอนเปิดหน้า และใช้เป็นตัวกันการส่งซ้ำ —
        กดส่งจริงสองครั้งจะไม่ได้ใบสองใบ · <b>อยากสร้างใบใหม่ให้เปิดหน้านี้ใหม่</b>
        <br />
        ⚠️ ZORT มีเส้นสำหรับแก้ใบเสนอราคาอยู่จริง แต่ <b>ยังไม่มีใครทดสอบ</b> ⇒
        ระหว่างนี้ถือว่า <b>ทำใบให้ถูกตั้งแต่แรก</b> ปลอดภัยกว่า ·
        <b> จอนี้สร้างได้เฉพาะใบเสนอราคา</b> (เจ้าของร้านจำกัดขอบเขตไว้) — เพิ่มสินค้ากับใบสั่งซื้อยังไม่เปิด ·
        ดูสิ่งที่ ZORT เปิดให้ทำได้ที่{' '}
        <Link href="/core/zort-noapi" className="text-blue-600 hover:underline">ZORT เปิดให้ทำอะไรผ่าน API</Link>
      </p>
    </div>
  )
}
