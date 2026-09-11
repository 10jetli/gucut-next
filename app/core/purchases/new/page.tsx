'use client'
// รายการซื้อ → สร้างใบสั่งซื้อ (เขียนทะลุไป ZORT) — ปิดแถว 12
//
// 🔴 **ปุ่มส่งจริงปิดอยู่** จนกว่าเจ้าของร้านจะอนุมัติแยกต่างหาก
//    เจ้าของร้านอนุมัติการเขียนจริงไว้ **เฉพาะใบเสนอราคา** (6 ก.ย. 2569) ไม่รวมใบสั่งซื้อ
//    ⇒ จอนี้ใช้ "ทดลองส่ง" ได้เต็มที่ (ตรวจข้อมูล เห็นสิ่งที่จะส่งจริง) แต่ยังส่งเข้า ZORT ไม่ได้
//
// 🔴 **ZORT ไม่มีเส้นแก้ใบสั่งซื้อ และไม่มีเส้นลบ** (ยิงตรวจ 6 ก.ย. 2569 —
//    UpdatePurchaseOrder = 404 · EditPurchaseOrder มีเส้นแต่ยังไม่เคยยิงจริง)
//    ⇒ ใบที่ส่งผิดจะค้างใน ZORT จนกว่าจะเข้าไปจัดการเอง
//    ⇒ จอนี้จึงบังคับซ้อมก่อนเหมือนจอใบเสนอราคา และผูกสถานะซ้อมกับ "เนื้อหา" ไม่ใช่ "การกดปุ่ม"
import { Suspense, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'

interface Line { sku: string; name: string; qty: string; price: string }
const BLANK: Line = { sku: '', name: '', qty: '', price: '' }

/** 🔴 สวิตช์ปุ่มส่งจริง — **ห้ามเปิดจนกว่าเจ้าของร้านจะอนุมัติใบสั่งซื้อโดยเฉพาะ**
 *  เหตุผลที่แยกจากใบเสนอราคา: ใบสั่งซื้อผูกกับคู่ค้าและของที่จะเข้าคลังจริง
 *  ⇒ ใบผิดที่ค้างอยู่ อาจทำให้มีคนสั่งของตามใบนั้น */
const REAL_SEND_ENABLED = false

function NewPurchaseOrderInner() {
  // รับรหัสสินค้ามาจากเมนู ⋮ ของจอสินค้า/ลูกค้าได้ ("ซื้อสินค้า" → เปิดใบพร้อมบรรทัดแรก)
  // เติมตั้งแต่ตอนสร้าง state ไม่ใช่ใน effect — กติกาเดียวกับจอ moves (กันช่องกระพริบว่าง)
  const sp = useSearchParams()
  // ?vendor= มาจากเมนู ⋮ "ซื้อเข้า" ของจอผู้ติดต่อ (คนนั้นคือคู่ค้าของใบนี้)
  const [vendor, setVendor] = useState(() => (sp.get('vendor') ?? '').trim())
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>(() => {
    const sku = (sp.get('sku') ?? '').trim()
    return [sku ? { ...BLANK, sku } : { ...BLANK }]
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<WriteResp | null>(null)
  const [okDry, setOkDry] = useState('')
  /** ⚠️ สร้างครั้งเดียวตอนเปิดหน้า — สร้างใหม่ตอนกด = กดสองครั้งได้ใบสองใบ */
  const [ref] = useState(() => `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)

  const clean = useMemo(() => lines
    .map((l) => ({ sku: l.sku.trim(), name: l.name.trim(), qty: Number(l.qty), price: l.price.trim() === '' ? null : Number(l.price) }))
    .filter((l) => l.sku && Number.isFinite(l.qty) && l.qty > 0), [lines])
  const sig = useMemo(() => JSON.stringify({ vendor: vendor.trim(), note: note.trim(), clean }), [vendor, note, clean])
  const dryOk = okDry !== '' && okDry === sig
  const priced = clean.filter((l) => l.price !== null).length
  const total = clean.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0)

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!clean.length) { setErr('ต้องมีรายการสินค้าอย่างน้อย 1 บรรทัด (จำนวนต้องมากกว่า 0)'); return }
    const dup = clean.map((l) => l.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) { setErr(`รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน`); return }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?addpo=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          vendor: vendor.trim() || undefined,
          note: note.trim() || undefined,
          items: clean.map((l) => ({ sku: l.sku, ...(l.name ? { name: l.name } : {}), qty: l.qty, ...(l.price === null ? {} : { price: l.price }) })),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [vendor, note, clean, ref, sig])

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="สร้างใบสั่งซื้อ"
        summary={<>สร้างใบใน ZORT โดยตรง{' | '}<span className="text-gray-400">เลขอ้างอิงใบนี้: <b>{ref}</b> (กันการส่งซ้ำ)</span></>}
        actions={<Link href="/core/purchases" className="text-[13px] text-blue-600 hover:underline">← กลับรายการซื้อ</Link>}
      />

      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        🔴 <b>ZORT ไม่เปิดช่องทางให้ลบใบสั่งซื้อ</b> (ยิงตรวจ 6 ก.ย. 2569) — ส่งพลาดแล้วต้องเข้าไปจัดการในหน้าจอ ZORT เอง
        <br />
        ⚠️ <b>&ldquo;ยิงผ่าน&rdquo; ไม่พอ</b> — ฝั่งท่อยิงจริงแล้วพบว่า ZORT
        <b>ไม่คำนวณยอดเงินให้เลยสักชั้น</b> ⇒ ใบที่ออกมาเป็น <b>฿0</b> ทั้งที่ส่งราคาไป
        และมันได้เลขที่ใบจริงตามปกติ <b>ไม่มีอะไรฟ้องสักคำ</b> (แก้ที่ท่อแล้ว)
        ⇒ หลังส่งจริงใบแรก <b>ต้องดึงใบกลับมาดูว่ายอดเข้าถูกช่อง</b> ก่อนใช้กับงานจริง
        ⚠️ <b>ตอนนี้ยังกดส่งจริงไม่ได้</b> — เจ้าของร้านอนุมัติการเขียนจริงไว้เฉพาะ
        {' '}<Link href="/core/quotations/new" className="underline">ใบเสนอราคา</Link>{' '}
        ยังไม่รวมใบสั่งซื้อ · <b>ทดลองส่งใช้ได้ตามปกติ</b> (ตรวจข้อมูลได้ครบ ไม่มีอะไรเข้า ZORT)
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12.5px] text-gray-600">คู่ค้า / ผู้ขาย</span>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ไม่ใส่ก็ได้" />
        </label>
        <label className="block">
          <span className="text-[12.5px] text-gray-600">หมายเหตุในใบ</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ไม่ใส่ก็ได้" />
        </label>
      </div>

      <TableWrap>
        <table className="w-full min-w-[640px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>รหัสสินค้า (SKU)</th>
              <th className={TH}>ชื่อสินค้า</th>
              <th className={THR} style={{ width: 110 }}>จำนวน</th>
              <th className={THR} style={{ width: 150 }}>ราคาต่อหน่วย</th>
              <th className={TH} style={{ width: 52 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                <td className={TD}>
                  <input value={l.sku} onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px]" placeholder="รหัสสินค้า" />
                </td>
                <td className={TD}>
                  <input value={l.name} onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px]" placeholder="ไม่ใส่ = ใช้ชื่อใน ZORT" />
                </td>
                <td className={TDR}>
                  <input value={l.qty} inputMode="numeric" onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px] text-right" placeholder="0" />
                </td>
                <td className={TDR}>
                  <input value={l.price} inputMode="decimal" onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px] text-right" placeholder="ไม่ใส่ = ZORT คิดเอง" />
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
        {/* ⚠️ ยอดรวมประกาศขอบเขต — บรรทัดที่ไม่ใส่ราคาไม่ถูกนับ */}
        <span className="text-[13px] text-gray-600">
          {clean.length === 0 ? <span className="text-gray-400">ยังไม่มีบรรทัดที่ใช้ได้</span>
            : priced === clean.length ? <>รวม <b>{fmtMoney(total)}</b> ({clean.length} บรรทัด)</>
              : <>รวมเฉพาะ <b>{priced}</b> บรรทัดที่ใส่ราคา = <b>{fmtMoney(total)}</b>
                {' '}<span className="text-amber-700">· อีก {clean.length - priced} บรรทัดปล่อยให้ ZORT คิดเอง</span></>}
        </span>
      </div>

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}
      <WriteResult r={res} />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => send(false)} disabled={busy}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !dryOk || !REAL_SEND_ENABLED}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
          ส่งจริงเข้า ZORT
        </button>
        {!REAL_SEND_ENABLED
          ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้ส่งจริง</b> — รอเจ้าของร้านอนุมัติใบสั่งซื้อโดยเฉพาะ</span>
          : !dryOk && <span className="text-[12.5px] text-gray-500">{okDry === '' ? 'ต้องกดทดลองส่งให้ผ่านก่อน' : 'เนื้อหาเปลี่ยนหลังทดลองส่ง — ต้องทดลองใหม่'}</span>}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        เลขอ้างอิง <b>{ref}</b> สร้างครั้งเดียวตอนเปิดหน้า ใช้เป็นตัวกันส่งซ้ำ — อยากสร้างใบใหม่ให้เปิดหน้านี้ใหม่ ·
        ⚠️ ZORT <b>ไม่มีเส้นแก้ใบสั่งซื้อที่ยืนยันแล้ว</b> (พบชื่อ EditPurchaseOrder แต่ยังไม่มีใครยิงจริง) ⇒
        ระหว่างนี้ถือว่า <b>ทำใบให้ถูกตั้งแต่แรก</b>
      </p>
    </div>
  )
}

export default function NewPurchaseOrderPage() {
  // useSearchParams ต้องอยู่ใน Suspense ไม่งั้น build ของ Next ตก (กติกาเดียวกับจอ moves)
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-gray-500">กำลังโหลด...</div>}>
      <NewPurchaseOrderInner />
    </Suspense>
  )
}
