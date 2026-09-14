'use client'
// รายการซื้อ → **คืนสินค้าให้ผู้ขาย** (soon: buy-return) — เขียนทะลุไป ZORT
//
// 🔴 **คนละเรื่องกับ "ลูกค้าคืนของ" โดยสิ้นเชิง** — อันนั้นคือ ReturnOrder อยู่ที่ /core/return-orders
//    อันนี้คือของที่ **เราส่งคืนผู้ขาย** แล้วตัดออกจากคลังเรา
//    ⇒ หัวจอ ป้าย และทุกข้อความต้องเขียนว่า "ให้ผู้ขาย" เสมอ ห้ามเขียนแค่ "คืนสินค้า"
//       (สองจอนี้ชื่อคล้ายกันมาก · คนกดผิดจอแล้วตัดสต็อกผิดทาง = ของหายจากคลังโดยไม่มีใครรู้)
//
// สัญญาช่องจากฝั่งท่อ (CEO ตอบ 14 ก.ย. 2569 · ใบ t_mu0rliug — **ไม่ได้เดาชื่อช่อง**)
//   POST /api/web/core?addpurchasereturn=1
//   ขาเข้าจากจอ: { ref*, number? (≤60 ไม่ใส่ = ใช้ ref),
//                  items*: [ { sku*, name*, qty* (>0), price* (≥0) } ],
//                  discount? (≥0 ≤ยอดสินค้า), shipping? (≥0),
//                  status? "Pending"(ค่าเริ่มต้น) | "Success",
//                  day? "yyyy-MM-dd" (ไม่ใส่ = วันนี้เวลาไทย),
//                  warehouse? (รหัสคลัง A-Z0-9_-), vendor? (≤160), vendorCode?, note?,
//                  poId? (id ใบซื้อใน ZORT — หาได้จาก GET ?zortpo=<เลขที่ใบ>),
//                  paid? (>0 ≤ยอดใบ) + paymentMethod* (ต้องมาคู่กัน), confirm? }
//   ขาออกไป ZORT: ReturnPurchaseOrder/AddReturnPurchaseOrder (ท่อแปลงเอง)
//   ซ้อม ⇒ { ok, dryRun, ref, linesTotal, willSend } · ท่อคิด totalprice/amount เอง จอไม่คิดเงิน
//
// 🔴 **name กับ price บังคับทุกบรรทัด** (ZORT บังคับ · ไม่มี = 400) — **ห้ามเดาราคาเป็น 0**
//    เดา 0 = ใบคืนที่มูลค่าหาย แล้วบัญชีไม่ตรงโดยไม่มีอะไรฟ้อง (กฎ zort-sends-all-money-fields)
// 🔴 **เอกสารไม่บอกว่า status "Success" ตัดสต็อกออกทันทีไหม** ⇒ ค่าเริ่มต้นเป็น Pending เสมอ
//    และต้องเขียนหมายเหตุนี้ **ติดกับตัวเลือก** ไม่ใช่ไว้บนหัวจอที่เลื่อนพ้นตาไปแล้ว
// ⚠️ **ไม่มีเส้นยกเลิก/แก้ใบคืน** ⇒ ใบที่สร้างผิดต้องไปแก้ใน ZORT เอง ⇒ บังคับซ้อมก่อนทุกครั้ง
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { PageHead, TableWrap, TH, THR, TD, TDR, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'
import { LinesTotalCheck } from '@/components/zort/LinesTotalCheck'
import { looksLikeFallThrough } from '@/lib/api-shape'

/** 🔴 สวิตช์ปุ่มส่งจริง — ห้ามเปิดจนกว่าเจ้าของร้านจะอนุมัติ "ใบคืนของให้ผู้ขาย" โดยเฉพาะ
 *  เหตุผลที่ต้องแยกอนุมัติ: ใบนี้ **ตัดของออกจากคลังจริง** และไม่มีเส้นยกเลิก */
const REAL_SEND_ENABLED = false

interface Line { sku: string; name: string; qty: string; price: string }
const BLANK: Line = { sku: '', name: '', qty: '', price: '' }

const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-[14px]'
const cell = 'w-full border border-gray-200 rounded px-2 py-1.5 text-[13px]'

/** ผลซ้อมที่ท่อคืนมา — มี linesTotal ไว้ให้จอเทียบว่าคิดตรงกันไหม
 *  ⚠️ **ต้องเป็น `number | null` ไม่ใช่ `number`** — null คือค่าจริงที่ท่อส่งมาได้
 *     (แปลว่ามีบรรทัดไม่มีราคา จึงไม่คิดยอด) · ประกาศเป็น number เฉย ๆ = ชนิดโกหก
 *     แล้ววันหนึ่งจะมีคนเขียนโค้ดที่เชื่อว่าค่านี้ไม่มีวันเป็น null */
type Resp = WriteResp & { linesTotal?: number | null; willSend?: Record<string, unknown> }

export default function NewPurchaseReturnPage() {
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }])
  const [vendor, setVendor] = useState('')
  const [vendorCode, setVendorCode] = useState('')
  const [number, setNumber] = useState('')
  const [note, setNote] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [day, setDay] = useState('')
  const [poId, setPoId] = useState('')
  const [discount, setDiscount] = useState('')
  const [shipping, setShipping] = useState('')
  const [status, setStatus] = useState<'Pending' | 'Success'>('Pending')
  const [paid, setPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<Resp | null>(null)
  const [okDry, setOkDry] = useState('')

  /* เลขอ้างอิง — สร้างฝั่งเบราว์เซอร์ครั้งเดียว (กัน hydration mismatch + กันกดสองครั้งได้สองใบ) */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`RPO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  /* บรรทัดที่ "ครบพอจะส่ง" — ต้องครบทั้งสี่ช่อง เพราะ ZORT บังคับ name และ price ด้วย */
  const clean = useMemo(() => lines
    .map((l) => ({ sku: l.sku.trim(), name: l.name.trim(), qty: Number(l.qty), price: Number(l.price) }))
    .filter((l) => l.sku !== '' && l.name !== '' && Number.isFinite(l.qty) && l.qty > 0
      && l.price !== null && Number.isFinite(l.price) && l.price >= 0), [lines])

  /** บรรทัดที่กรอกค้าง — **ต้องนับแยก** ไม่ใช่เงียบ ๆ ตัดทิ้ง
   *  (ถ้าตัดเงียบ คนจะกรอก 5 บรรทัดแล้วได้ใบ 3 บรรทัดโดยไม่รู้ตัว) */
  const touched = lines.filter((l) => l.sku.trim() || l.name.trim() || l.qty.trim() || l.price.trim()).length
  const itemsTotal = clean.reduce((s, l) => s + l.price * l.qty, 0)

  const sig = useMemo(() => JSON.stringify({
    clean, vendor: vendor.trim(), vendorCode: vendorCode.trim(), number: number.trim(), note: note.trim(),
    warehouse: warehouse.trim(), day: day.trim(), poId: poId.trim(),
    discount: discount.trim(), shipping: shipping.trim(), status, paid: paid.trim(), paymentMethod: paymentMethod.trim(),
  }), [clean, vendor, vendorCode, number, note, warehouse, day, poId, discount, shipping, status, paid, paymentMethod])
  const dryOk = okDry !== '' && okDry === sig

  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((o) => o.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  /** ตรวจที่จอก่อนยิง — ท่อตีกลับได้อยู่แล้ว แต่จอบอกได้ว่า **บรรทัดไหน** ซึ่งท่อบอกไม่ได้ */
  const check = (): string => {
    if (!clean.length) {
      return touched
        ? 'ยังไม่มีบรรทัดที่กรอกครบ — ZORT บังคับ รหัส · ชื่อสินค้า · จำนวน(>0) · ราคา ครบทั้งสี่ช่องทุกบรรทัด'
        : 'ต้องมีรายการสินค้าอย่างน้อย 1 บรรทัด'
    }
    /* ⚠️ ใช้ forEach ไม่ใช่ for-of บน .entries() — tsc ของโปรเจกต์นี้ไม่ได้ตั้ง target (เป็น ES5)
       แต่ต้อง "คืนข้อความแรกที่เจอ" ⇒ เก็บใส่ตัวแปรแล้วออกทีเดียว ไม่ใช่ return ในลูป */
    let lineErr = ''
    lines.forEach((l, i) => {
      if (lineErr) return
      const any = l.sku.trim() || l.name.trim() || l.qty.trim() || l.price.trim()
      if (!any) return
      if (!l.sku.trim()) { lineErr = `บรรทัด ${i + 1}: ต้องมีรหัสสินค้า`; return }
      if (!l.name.trim()) { lineErr = `บรรทัด ${i + 1}: ZORT บังคับชื่อสินค้าในใบคืน (เว้นไม่ได้)`; return }
      if (!Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0) { lineErr = `บรรทัด ${i + 1}: จำนวนต้องเป็นตัวเลขมากกว่า 0`; return }
      /* 🔴 ห้ามปล่อยราคาว่างแล้วให้กลายเป็น 0 — ใบคืนมูลค่าหายคือความผิดที่ไม่มีอะไรฟ้อง */
      if (l.price.trim() === '' || !Number.isFinite(Number(l.price)) || Number(l.price) < 0) {
        lineErr = `บรรทัด ${i + 1}: ZORT บังคับราคาในใบคืน — ต้องเป็นตัวเลขไม่ติดลบ (เว้นว่างไม่ได้ และห้ามใส่ 0 ถ้าของมีมูลค่าจริง)`
      }
    })
    if (lineErr) return lineErr
    const dup = clean.map((l) => l.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) return `รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน`

    if (number.trim().length > 60) return `เลขที่ใบยาวเกิน 60 ตัวอักษร (${number.trim().length})`
    if (vendor.trim().length > 160) return `ชื่อผู้ขายยาวเกิน 160 ตัวอักษร (${vendor.trim().length})`
    if (warehouse.trim() && !/^[A-Za-z0-9_-]+$/.test(warehouse.trim())) {
      return 'รหัสคลังใช้ได้แค่ A-Z a-z 0-9 ขีดล่าง ขีดกลาง (ห้ามเว้นวรรค ห้ามภาษาไทย)'
    }
    if (day.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) return 'วันที่ต้องเป็นรูปแบบ ปี-เดือน-วัน เช่น 2026-09-14'

    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    const d = num(discount); const sh = num(shipping)
    if (d !== null && (!Number.isFinite(d) || d < 0)) return 'ส่วนลดต้องเป็นตัวเลขไม่ติดลบ'
    if (d !== null && d > Math.round(itemsTotal * 100) / 100) return `ส่วนลด ${d} มากกว่ายอดสินค้า ${Math.round(itemsTotal * 100) / 100}`
    if (sh !== null && (!Number.isFinite(sh) || sh < 0)) return 'ค่าส่งต้องเป็นตัวเลขไม่ติดลบ'

    /* จ่ายเงิน: ท่อบังคับให้มาคู่กัน ⇒ ตรวจทั้งสองทาง ไม่ใช่ทางเดียว */
    const p = num(paid)
    if (p !== null && (!Number.isFinite(p) || p <= 0)) return 'ยอดที่จ่ายต้องเป็นตัวเลขมากกว่า 0 (ไม่บันทึกการจ่ายให้เว้นว่าง)'
    if (p !== null && !paymentMethod.trim()) return 'ใส่ยอดที่จ่ายแล้วต้องระบุวิธีชำระด้วย (ชื่อที่มีใน ZORT)'
    if (p === null && paymentMethod.trim()) return 'ระบุวิธีชำระแล้วต้องใส่ยอดที่จ่ายด้วย'
    const docTotal = Math.round((itemsTotal - (d ?? 0) + (sh ?? 0)) * 100) / 100
    if (p !== null && p > docTotal) return `ยอดที่จ่าย ${p} มากกว่ายอดใบ ${docTotal}`
    return ''
  }

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    const bad = check()
    if (bad) { setErr(bad); return }
    setBusy(true)
    try {
      const t = (s: string) => (s.trim() === '' ? undefined : s.trim())
      const n = (s: string) => (s.trim() === '' ? undefined : Number(s))
      const r: Resp = await fetch('/api/web/core?addpurchasereturn=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          number: t(number), vendor: t(vendor), vendorCode: t(vendorCode), note: t(note),
          warehouse: t(warehouse), day: t(day), poId: t(poId),
          discount: n(discount), shipping: n(shipping),
          status,
          ...(paid.trim() !== '' ? { paid: Number(paid), paymentMethod: paymentMethod.trim() } : {}),
          items: clean,
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      if (looksLikeFallThrough(r)) {
        setErr('เส้น addpurchasereturn ยังไม่มีบนเซิร์ฟเวอร์ — ท่อตอบ "คำตอบหน้าแรก" กลับมาแทน (ยังไม่ deploy) '
          + '⇒ ยังทดลองส่งไม่ได้ · ไม่ใช่ว่าข้อมูลที่กรอกผิด')
        return
      }
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, ref, sig, number, vendor, vendorCode, note, warehouse, day, poId, discount, shipping, status, paid, paymentMethod])


  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="คืนสินค้าให้ผู้ขาย"
        summary={<>สร้างใบคืนใน ZORT โดยตรง (ReturnPurchaseOrder){' | '}
          <span className="text-gray-400">เลขอ้างอิง: <b>{ref || '…'}</b> (กันการส่งซ้ำ)</span></>}
        actions={<Link href="/core/purchases" className="text-[13px] text-blue-600 hover:underline">← กลับรายการซื้อ</Link>}
      />

      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        🔴 <b>จอนี้คือของที่ “เราส่งคืนผู้ขาย”</b> แล้วตัดออกจากคลังเรา —
        {' '}<b>ไม่ใช่</b>ของที่ลูกค้าคืนให้เรา อันนั้นอยู่ที่{' '}
        <Link href="/core/return-orders" className="underline">รับคืนสินค้า</Link>{' '}
        (สองจอนี้ชื่อคล้ายกันมาก กดผิดจอ = ตัดสต็อกผิดทาง)
        <br />
        ⚠️ <b>ZORT ไม่มีเส้นยกเลิกหรือแก้ใบคืน</b> — ใบที่ส่งผิดต้องเข้าไปจัดการใน ZORT เอง
        {' '}⇒ ต้องทดลองส่งก่อนทุกครั้ง
      </div>

      <TableWrap>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className={TH}>รหัสสินค้า *</th>
              <th className={TH}>ชื่อสินค้า *</th>
              <th className={THR}>จำนวน *</th>
              <th className={THR}>ราคาต่อหน่วย *</th>
              <th className={THR}>รวม</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const q = Number(l.qty); const p = Number(l.price)
              const sum = Number.isFinite(q) && Number.isFinite(p) && l.price.trim() !== '' ? q * p : null
              return (
                <tr key={i} className="border-b border-gray-50">
                  <td className={TD}><input className={cell} value={l.sku} onChange={(e) => setLine(i, 'sku', e.target.value)} /></td>
                  <td className={TD}><input className={cell} value={l.name} onChange={(e) => setLine(i, 'name', e.target.value)} placeholder="ZORT บังคับ" /></td>
                  <td className={TDR}><input className={`${cell} text-right`} value={l.qty} inputMode="decimal" onChange={(e) => setLine(i, 'qty', e.target.value)} /></td>
                  <td className={TDR}><input className={`${cell} text-right`} value={l.price} inputMode="decimal" onChange={(e) => setLine(i, 'price', e.target.value)} placeholder="ZORT บังคับ" /></td>
                  {/* ⚠️ ยังไม่ครบ = "—" ไม่ใช่ 0 · 0 แปลว่าของไม่มีมูลค่า คนละเรื่องกับยังไม่ได้กรอก */}
                  <td className={TDR}>{sum === null ? <span className="text-gray-300">—</span> : fmtMoney(sum)}</td>
                  <td className={TD}>
                    <button type="button" onClick={() => setLines((o) => (o.length > 1 ? o.filter((_, j) => j !== i) : o))}
                      disabled={lines.length <= 1} className="text-[12px] text-gray-400 hover:text-red-600 disabled:opacity-30">ลบ</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>

      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" onClick={() => setLines((o) => [...o, { ...BLANK }])}
          className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">+ เพิ่มบรรทัด</button>
        <span className="text-[12.5px] text-gray-500">
          ยอดสินค้า <b className="text-gray-800">{fmtMoney(itemsTotal)}</b> จาก {clean.length} บรรทัด
          {touched > clean.length && <span className="text-amber-700"> · อีก {touched - clean.length} บรรทัดกรอกไม่ครบ จะไม่ถูกส่ง</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <label className="block"><span className="text-[12.5px] text-gray-600">ผู้ขาย</span>
          <input className={`${inp} mt-1`} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="ไม่ใส่ก็ได้ (≤160 ตัวอักษร)" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">รหัสผู้ขาย</span>
          <input className={`${inp} mt-1`} value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} placeholder="ไม่ใส่ก็ได้" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">เลขที่ใบ</span>
          <input className={`${inp} mt-1`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ไม่ใส่ = ใช้เลขอ้างอิง" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">รหัสคลังที่ตัดของออก</span>
          <input className={`${inp} mt-1`} value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="ไม่ใส่ = คลังหลักของ ZORT" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">วันที่ใบคืน</span>
          <input className={`${inp} mt-1`} value={day} onChange={(e) => setDay(e.target.value)} placeholder="2026-09-14 (ไม่ใส่ = วันนี้)" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">id ใบซื้อที่คืน (poId)</span>
          <input className={`${inp} mt-1`} value={poId} onChange={(e) => setPoId(e.target.value)} placeholder="ไม่ใส่ก็ได้" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">ส่วนลด</span>
          <input className={`${inp} mt-1`} value={discount} inputMode="decimal" onChange={(e) => setDiscount(e.target.value)} placeholder="ไม่ใส่ = ไม่มี" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">ค่าส่ง</span>
          <input className={`${inp} mt-1`} value={shipping} inputMode="decimal" onChange={(e) => setShipping(e.target.value)} placeholder="ไม่ใส่ = ไม่มี" /></label>
        <div className="lg:col-span-1 sm:col-span-2">
          <span className="text-[12.5px] text-gray-600">หมายเหตุ</span>
          <input className={`${inp} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      {/* 🔴 หมายเหตุเรื่องสถานะต้องอยู่ "ติดกับตัวเลือก" ไม่ใช่บนหัวจอ — คนเลือกตรงนี้ ต้องอ่านตรงนี้ */}
      <div className="mt-4 bg-amber-50 border border-amber-300 rounded-md p-3.5">
        <span className="text-[12.5px] font-semibold text-amber-900">สถานะใบคืน</span>
        <div className="flex flex-wrap gap-4 mt-2">
          {(['Pending', 'Success'] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-[13px] text-gray-800">
              <input type="radio" checked={status === s} onChange={() => setStatus(s)} />
              {s === 'Pending' ? 'รอดำเนินการ (Pending)' : 'สำเร็จ (Success)'}
            </label>
          ))}
        </div>
        <p className="text-[12px] text-amber-900 mt-2 leading-relaxed">
          🔴 <b>เอกสารของ ZORT ไม่ได้บอกว่าสถานะ “สำเร็จ” ตัดของออกจากคลังทันทีหรือเปล่า</b> —
          {' '}เรายังไม่เคยยิงจริง ⇒ ค่าเริ่มต้นจึงเป็น <b>รอดำเนินการ</b> ไว้ก่อน
          {' '}ถ้าจะใช้ “สำเร็จ” ใบแรก ให้จดจำนวนในคลังก่อน–หลัง แล้วดูว่าขยับไหม
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <label className="block"><span className="text-[12.5px] text-gray-600">ยอดที่ได้รับคืนแล้ว</span>
          <input className={`${inp} mt-1`} value={paid} inputMode="decimal" onChange={(e) => setPaid(e.target.value)}
            placeholder="ไม่ใส่ = ยังไม่บันทึกการรับเงิน" /></label>
        <label className="block"><span className="text-[12.5px] text-gray-600">วิธีชำระ</span>
          <input className={`${inp} mt-1`} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="ต้องเป็นชื่อที่มีใน ZORT เช่น โอน" /></label>
      </div>
      <p className="text-[11.5px] text-gray-500 mt-1">ยอดกับวิธีชำระ <b>ต้องมาคู่กัน</b> — ใส่อย่างเดียวท่อจะตีกลับ</p>

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => send(false)} disabled={busy || !ref}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: '#4669e5' }}>
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !ref || !dryOk || !REAL_SEND_ENABLED}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
          ส่งเข้า ZORT จริง
        </button>
      </div>

      {!REAL_SEND_ENABLED ? (
        <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
          🔒 <b>ปุ่มส่งจริงปิดอยู่</b> — เจ้าของร้านอนุมัติการเขียนจริงไว้เฉพาะใบเสนอราคา
          {' '}ใบคืนของ<b>ตัดสต็อกจริงและยกเลิกไม่ได้</b> จึงต้องขออนุมัติแยก ·
          {' '}ระหว่างนี้ทดลองส่งได้เต็มที่ เห็นทุกช่องที่จะส่งจริง
        </p>
      ) : !dryOk && (
        <p className="text-[12.5px] text-gray-500 mt-2">ต้องทดลองส่งให้ผ่านก่อน · แก้อะไรหลังซ้อม ปุ่มส่งจริงจะปิดเองอีกครั้ง</p>
      )}

      

      

      

      {/* 🔴 จอนี้บังคับราคาทุกบรรทัด ⇒ ส่ง requiresPrice
          ⇒ ถ้าท่อคืน linesTotal:null แปลว่าราคาที่ส่งไปไม่ถึงท่อ ต้องขึ้นแดง ไม่ใช่ "เทียบไม่ได้" เฉย ๆ */}
      <LinesTotalCheck res={res} ourTotal={itemsTotal} requiresPrice />

      <div className="mt-3"><WriteResult r={res} /></div>

      {res?.dryRun && res.willSend != null && (
        <details className="mt-2 border border-gray-200 rounded">
          <summary className="text-[12.5px] text-gray-700 px-3 py-2 cursor-pointer">ดูของจริงที่จะถูกส่งเข้า ZORT</summary>
          <pre className="text-[11px] text-gray-700 px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(res.willSend, null, 1)}
          </pre>
        </details>
      )}
    </div>
  )
}
