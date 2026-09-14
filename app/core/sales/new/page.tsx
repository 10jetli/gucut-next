'use client'
// รายการขาย → สร้างรายการขาย (เขียนทะลุไป ZORT Order/AddOrder)
//
// 🔴 **ปุ่มส่งจริงปิดอยู่ และยังไม่เคยมีใบไหนถูกยิงจริงเลยสักใบ**
//    ฝั่งท่อเปิดเส้น `?addsale=1` ให้ 14 ก.ย. 2569 แต่ยังไม่เคยยิงจริง
//    เจ้าของร้านอนุมัติการเขียนจริงไว้ **เฉพาะใบเสนอราคา** (6 ก.ย. 2569) ⇒ ใบขายต้องขออนุมัติแยก
//    ⇒ จอนี้ "ทดลองส่ง" ได้เต็มที่ (เห็นของที่จะส่งจริงทุกช่อง) แต่ยังส่งเข้า ZORT ไม่ได้
//
// 🔴 **ZORT ลบเอกสารผ่าน API ไม่ได้** — ใบที่ส่งผิดจะค้างถาวรจนกว่าจะเข้าไปจัดการเอง
//    ⇒ บังคับซ้อมก่อนเสมอ และผูกผลซ้อมกับ "เนื้อหา" ไม่ใช่ "การกดปุ่ม"
//       แก้อะไรหลังซ้อม ปุ่มส่งจริงปิดเองทันที (ท่าเดียวกับใบเสนอราคา/ใบสั่งซื้อ)
//
// ⚠️ **คนละเส้นกับ POS** — จอ POS ใช้ `?sale=1` ซึ่งบันทึกลง **คลังเงา D1 อย่างเดียว ไม่เคยถึง ZORT**
//    (ฝั่งท่อยืนยัน 14 ก.ย. 2569) ⇒ สองจอนี้เขียนคนละที่ อย่าสับสน
//
// 💰 [[zort-sends-all-money-fields]] — ZORT ไม่คิดเงินให้สักชั้น ต้องส่งครบ
//    pricepernumber → totalprice → amount · **แต่เส้นนี้ท่อคิดให้ทุกชั้นเอง ไม่รับ amount จากจอ**
//    ⇒ จอห้ามส่งยอดรวมไปเอง และต้องเอา `linesTotal` ที่ท่อคิด มาเทียบกับยอดที่จอคิด
//       ต่างเมื่อไหร่ = คนละกติกา ต้องฟ้อง ไม่ใช่เลือกเชื่อข้างใดข้างหนึ่งเงียบ ๆ
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, WriteResult } from '@/components/zort'
import { LinesTotalCheck } from '@/components/zort/LinesTotalCheck'
import type { WriteResp } from '@/components/zort'
import { looksLikeFallThrough } from '@/lib/api-shape'

interface Line { sku: string; name: string; qty: string; price: string }
const BLANK: Line = { sku: '', name: '', qty: '', price: '' }

/** คำตอบของเส้นนี้มีช่องเพิ่มจากของกลาง — ยอดที่ท่อคิดได้เอง (ใช้เทียบกับยอดที่จอคิด) */
type SaleResp = WriteResp & { linesTotal?: number | null; willSend?: Record<string, unknown> }

/** 🔴 สวิตช์ปุ่มส่งจริง — **ห้ามเปิดจนกว่าเจ้าของร้านจะอนุมัติใบขายโดยเฉพาะ**
 *  ใบขายผูกกับเงินที่รับจริงและสต็อกที่ตัดจริง ⇒ ใบผิดกระทบทั้งบัญชีและคลัง */
const REAL_SEND_ENABLED = false

const inp = 'w-full rounded border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400'
const PAY = ['เงินสด', 'โอนเงิน', 'บัตรเครดิต', 'เก็บปลายทาง']

export default function NewSalePage() {
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [status, setStatus] = useState<'Pending' | 'Success'>('Pending')
  const [discount, setDiscount] = useState('')
  const [shipping, setShipping] = useState('')
  const [paid, setPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<SaleResp | null>(null)
  const [okDry, setOkDry] = useState('')

  /* 🔴 เลขอ้างอิง — สร้างฝั่งเบราว์เซอร์เท่านั้น (กัน hydration ไม่ตรง) และ **ครั้งเดียวต่อการเปิดหน้า**
     ห้ามสร้างใหม่ตอนกด ไม่งั้นกดสองครั้ง = ได้ใบสองใบใน ZORT ที่ลบไม่ได้ */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`SO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  /* ⚠️ เส้นนี้ท่อ **บังคับครบทั้งสี่ช่องต่อบรรทัด** (sku · name · qty · price)
     ⇒ จอต้องกันตั้งแต่ต้น ไม่ใช่ปล่อยไปให้ท่อปฏิเสธ หรือแย่กว่านั้นคือผ่านแล้วได้ใบ 0 บาท */
  const clean = useMemo(() => lines
    .map((l) => ({ sku: l.sku.trim(), name: l.name.trim(), qty: Number(l.qty), price: Number(l.price) }))
    .filter((l) => l.sku || l.name || l.qty || l.price), [lines])
  const ready = useMemo(() => clean.filter((l) =>
    l.sku && l.name && Number.isFinite(l.qty) && l.qty > 0 && Number.isFinite(l.price) && l.price >= 0), [clean])
  const incomplete = clean.length - ready.length

  const sig = useMemo(() => JSON.stringify({
    customer: customer.trim(), phone: phone.trim(), address: address.trim(), channel: channel.trim(),
    warehouse: warehouse.trim(), status, discount, shipping, paid, paymentMethod, note: note.trim(), ready,
  }), [customer, phone, address, channel, warehouse, status, discount, shipping, paid, paymentMethod, note, ready])
  const dryOk = okDry !== '' && okDry === sig

  /** ยอดที่ **จอ** คิด — ใช้เทียบกับยอดที่ท่อคิด ไม่ใช่ใช้ส่ง */
  const ourLinesTotal = ready.reduce((s, l) => s + l.price * l.qty, 0)
  /* ท่อคิดยอดเอง ⇒ ต่างกันเมื่อไหร่แปลว่าเราสองฝั่งคิดคนละกติกา ต้องฟ้อง */

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!customer.trim()) { setErr('ต้องมีชื่อลูกค้า'); return }
    if (!ready.length) { setErr('ต้องมีบรรทัดที่กรอกครบอย่างน้อย 1 บรรทัด (รหัส · ชื่อ · จำนวน · ราคา)'); return }
    if (incomplete > 0) { setErr(`มี ${incomplete} บรรทัดที่กรอกไม่ครบ — ลบทิ้งหรือกรอกให้ครบก่อน (ท่อบังคับครบทั้งสี่ช่อง)`); return }
    const dup = ready.map((l) => l.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) { setErr(`รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน`); return }
    /* ⚠️ ท่อกำหนดว่า paid กับ paymentMethod ต้องมาคู่กัน — ขาดข้างเดียวคือข้อมูลเงินไม่ครบ */
    const hasPaid = paid.trim() !== ''
    const hasMethod = paymentMethod.trim() !== ''
    if (hasPaid !== hasMethod) { setErr('ยอดที่รับชำระกับวิธีชำระเงิน ต้องกรอกคู่กัน (กรอกอย่างเดียวไม่ได้)'); return }
    setBusy(true)
    try {
      const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
      const r: SaleResp = await fetch('/api/web/core?addsale=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          status,
          customer: customer.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          channel: channel.trim() || undefined,
          warehouse: warehouse.trim() || undefined,
          note: note.trim() || undefined,
          discount: num(discount),
          shipping: num(shipping),
          ...(hasPaid ? { paid: num(paid), paymentMethod: paymentMethod.trim() } : {}),
          items: ready.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, price: l.price })),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      /* 🔴 **ท่อที่ไม่รู้จักพารามิเตอร์ ไม่ตอบ 404 แต่ตกไปที่ "คำตอบหน้าแรก" พร้อม HTTP 200**
         เจอกับตัว 14 ก.ย. 2569: ตอนเขียนจอนี้ ฝั่งท่อยัง commit ไม่ push ⇒ `addsale=1` ยังไม่มี
         ท่อตอบ {fallthrough:true, endpoint:"default", counts:…} ซึ่ง WriteResult ไม่รู้จัก
         ⇒ **กดปุ่มแล้วเงียบสนิท ไม่มีอะไรขึ้นเลย** คนกดไม่รู้ว่าเกิดอะไรขึ้น
         ⇒ ต้องจับให้ได้แล้วบอกตรง ๆ ว่าเส้นนี้ยังไม่มีบนเซิร์ฟเวอร์ ไม่ใช่ปล่อยเงียบ */
      if (looksLikeFallThrough(r)) {
        setErr('เส้น addsale ยังไม่มีบนเซิร์ฟเวอร์ — ท่อตอบ "คำตอบหน้าแรก" กลับมาแทน (ยังไม่ deploy) '
          + '⇒ ยังทดลองส่งไม่ได้ · ไม่ใช่ว่าข้อมูลที่กรอกผิด')
        return
      }
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [customer, phone, address, channel, warehouse, status, discount, shipping, paid, paymentMethod, note, ready, incomplete, ref, sig])

  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((cur) => cur.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  return (
    <div className="p-4 md:p-6 max-w-[980px]">
      <PageHead
        title="สร้างรายการขาย"
        summary={
          <>
            เขียนเข้า ZORT โดยตรง (Order/AddOrder){' | '}
            <span className="text-gray-400">เลขอ้างอิง: <b>{ref || '…'}</b> (กันการส่งซ้ำ)</span>
          </>
        }
      />

      {/* 🔴 บอกตั้งแต่บนสุดว่าคนละเส้นกับ POS — ไม่งั้นคนนึกว่าขายหน้าร้านก็เข้า ZORT อยู่แล้ว */}
      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
        ⚠️ จอนี้เขียนเข้า <b>ZORT</b> โดยตรง — <b>คนละเส้นกับ POS</b>
        {' '}(<Link href="/core/pos" className="underline">จอ POS</Link> บันทึกลงคลังเงาของเราเอง ยังไม่ถึง ZORT)
        {' '}· ZORT <b>ลบใบผ่าน API ไม่ได้</b> ใบที่ส่งผิดจะค้างถาวร ⇒ ต้องทดลองส่งก่อนทุกครั้ง
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">ชื่อลูกค้า *</span>
          <input className={inp} value={customer} onChange={(e) => setCustomer(e.target.value)} /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">เบอร์โทร</span>
          <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">ช่องทางขาย</span>
          <input className={inp} value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="เช่น หน้าร้าน" /></label>
        <label className="block md:col-span-2"><span className="block text-[11px] font-semibold text-gray-400 mb-1">ที่อยู่จัดส่ง</span>
          <input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">คลัง</span>
          <input className={inp} value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="เช่น KLD" /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">สถานะใบ</span>
          <select className={inp} value={status} onChange={(e) => setStatus(e.target.value as 'Pending' | 'Success')}>
            <option value="Pending">Pending — ยังไม่จบ</option>
            <option value="Success">Success — จบแล้ว</option>
          </select></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">ส่วนลด (บาท)</span>
          <input className={inp} value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">ค่าส่ง (บาท)</span>
          <input className={inp} value={shipping} onChange={(e) => setShipping(e.target.value)} inputMode="decimal" /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">รับชำระแล้ว (บาท)</span>
          <input className={inp} value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" /></label>
        <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">วิธีชำระเงิน</span>
          <select className={inp} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">— ยังไม่ระบุ —</option>
            {PAY.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="block md:col-span-3"><span className="block text-[11px] font-semibold text-gray-400 mb-1">หมายเหตุ</span>
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>

      {/* ⚠️ ท่อบังคับครบทั้งสี่ช่อง ⇒ หัวตารางต้องบอกว่าบังคับ ไม่ใช่ให้คนรู้เอาเองตอนโดนปฏิเสธ */}
      <p className="text-[12px] text-gray-500 mt-4 mb-1">รายการสินค้า — <b>ต้องกรอกครบทั้งสี่ช่องทุกบรรทัด</b> (ท่อบังคับ)</p>
      <TableWrap>
        <table className="w-full min-w-[620px]">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr><th className={TH}>รหัส *</th><th className={TH}>ชื่อสินค้า *</th>
              <th className={THR}>จำนวน *</th><th className={THR}>ราคา/หน่วย *</th><th className={THR}>รวม</th><th className={TH} /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const q = Number(l.qty), p = Number(l.price)
              const lineTotal = Number.isFinite(q) && Number.isFinite(p) && l.qty !== '' && l.price !== '' ? q * p : null
              return (
                <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                  <td className={TD}><input className={inp} value={l.sku} onChange={(e) => setLine(i, 'sku', e.target.value)} /></td>
                  <td className={TD}><input className={inp} value={l.name} onChange={(e) => setLine(i, 'name', e.target.value)} /></td>
                  <td className={TDR}><input className={`${inp} text-right`} value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} inputMode="decimal" /></td>
                  <td className={TDR}><input className={`${inp} text-right`} value={l.price} onChange={(e) => setLine(i, 'price', e.target.value)} inputMode="decimal" /></td>
                  <td className={`${TDR} tabular-nums`}>{lineTotal === null ? <span className="text-gray-300">—</span> : fmtMoney(lineTotal)}</td>
                  <td className={TD}>
                    {lines.length > 1 && (
                      <button onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}
                        className="text-[12px] text-red-500 hover:underline">ลบ</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <BtnGhost onClick={() => setLines((v) => [...v, { ...BLANK }])}>+ เพิ่มบรรทัด</BtnGhost>
        <span className="text-[13px] text-gray-600">
          {ready.length === 0
            ? <span className="text-gray-400">ยังไม่มีบรรทัดที่กรอกครบ</span>
            : <>ยอดสินค้าที่จอคิด <b>{fmtMoney(ourLinesTotal)}</b> ({ready.length} บรรทัด)
              <span className="text-gray-400"> · ยังไม่รวมส่วนลด/ค่าส่ง</span></>}
        </span>
      </div>

      {/* บรรทัดที่กรอกไม่ครบ — ท่อปฏิเสธทั้งใบ ไม่ใช่ข้ามเฉพาะบรรทัดนั้น ⇒ ต้องบอกก่อนกด */}
      {incomplete > 0 && (
        <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3">
          ⚠️ มี <b>{incomplete} บรรทัด</b>ที่กรอกไม่ครบทั้งสี่ช่อง — เส้นนี้<b>บังคับครบทุกช่อง</b>
          {' '}ลบบรรทัดนั้นทิ้งหรือกรอกให้ครบก่อน
        </div>
      )}

      {/* 🔴 ยอดที่จอคิด vs ยอดที่ท่อคิด — ต่างกันคือคนละกติกา ห้ามเลือกเชื่อข้างเดียวเงียบ ๆ */}
      
      
      
      

      {/* 🔴 เทียบยอดที่ท่อคิดกับยอดที่จอคิด — ย้ายมาใช้ชิ้นส่วนร่วม 14 ก.ย. 2569
          เดิมจอนี้เขียนตรรกะเอง แล้วจอคืนของก็เขียนซ้ำอีกชุด ⇒ สองสำเนาที่จะเพี้ยนกันวันหนึ่ง
          จอนี้บังคับราคาครบทุกบรรทัด ⇒ ส่ง requiresPrice (null = ราคาไม่ถึงท่อ ต้องขึ้นแดง) */}
      <LinesTotalCheck res={res} ourTotal={ourLinesTotal} requiresPrice />

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

      {/* สามสถานะของปุ่มส่งจริง ห้ามยุบ: ปิดทั้งระบบ / ยังไม่ได้ซ้อม / พร้อมส่ง */}
      {!REAL_SEND_ENABLED ? (
        <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
          🔒 <b>ปุ่มส่งจริงปิดอยู่</b> — เจ้าของร้านอนุมัติการเขียนจริงไว้เฉพาะใบเสนอราคา
          {' '}ใบขายต้องขออนุมัติแยก · <b>ยังไม่เคยมีใบไหนถูกยิงจริงผ่านเส้นนี้เลย</b>
          {' '}ระหว่างนี้ทดลองส่งได้เต็มที่ เห็นทุกช่องที่จะส่งจริง
        </p>
      ) : !dryOk && (
        <p className="text-[12.5px] text-gray-500 mt-2">ต้องทดลองส่งให้ผ่านก่อน · แก้อะไรหลังซ้อม ปุ่มส่งจริงจะปิดเองอีกครั้ง</p>
      )}

      <div className="mt-3"><WriteResult r={res} /></div>

      {/* โหมดซ้อมส่ง willSend มาให้ — โชว์ของจริงที่จะถูกส่ง ดีกว่าให้คนเดาจากฟอร์ม */}
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
