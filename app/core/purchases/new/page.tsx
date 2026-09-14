'use client'
// รายการซื้อ → สร้างใบสั่งซื้อ (เขียนทะลุไป ZORT) — ปิดแถว 12
//
// ✅ **ส่งจริงได้แล้วเฉพาะใบปกติ** (ท่านประธานสั่งผ่านใบ t_mu1bh3s7 · เปิด 14 ก.ย. 2569 · 7c0902b)
//    โหมดอย่างง่าย (?quick=1 · สถานะ Success รับของเข้าคลังทันที) ยังปิด
//    ⚠️ ข้อความบนจอเคยค้างว่า "ยังกดส่งจริงไม่ได้" + "ZORT ไม่มีเส้นลบใบ" หลังเปิดปุ่มแล้ว (codex จับได้ 14 ก.ย. ในใบ t_mu1dfgj7)
//       ⇒ ต้นเหตุ: เปิดสวิตช์แล้วแก้แค่ข้อความข้างปุ่ม ไม่ได้ค้นทั้งไฟล์ · แก้ 15 ก.ย. 2569
//
// 🔴 **ZORT ไม่มีเส้นแก้ใบสั่งซื้อ** (ยิงตรวจ 6 ก.ย. 2569 — UpdatePurchaseOrder = 404 · EditPurchaseOrder มีชื่อแต่ยังไม่เคยยิงจริง)
// ✅ **ยกเลิกใบได้** — VoidPurchaseOrder ผ่านท่อ gucut-web POST ?voidpo (ยิงจริง 14 ก.ย. 2569: PO-202609001 → อ่านกลับ Voided)
//    ⚠️ จอนี้ยังไม่มีปุ่มยกเลิก ⇒ ใบที่ส่งผิดต้องให้คนมีสิทธิ์ยกเลิกผ่านท่อ หรือเข้าจัดการใน ZORT
//    ⇒ จอนี้จึงบังคับซ้อมก่อนเหมือนจอใบเสนอราคา และผูกสถานะซ้อมกับ "เนื้อหา" ไม่ใช่ "การกดปุ่ม"
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, WriteResult } from '@/components/zort'
import { LinesTotalCheck } from '@/components/zort/LinesTotalCheck'
import type { WriteResp } from '@/components/zort'

interface Line { sku: string; name: string; qty: string; price: string }
const BLANK: Line = { sku: '', name: '', qty: '', price: '' }

/** 🟢 สวิตช์ปุ่มส่งจริง — **เปิดแล้ว 14 ก.ย. 2569 ท่านประธานสั่งผ่านใบกระดาน t_mu1bh3s7**
 *  ("เปิดปุ่มส่งจริง: สร้างรายการซื้อ · ทดสอบด้วยใบจริงมูลค่าน้อย แล้วยกเลิกใน ZORT ทันที")
 *  เหตุผลเดิมที่เคยปิด: ใบสั่งซื้อผูกกับคู่ค้าและของที่จะเข้าคลังจริง ⇒ ใบผิดที่ค้างอยู่ อาจทำให้มีคนสั่งของตามใบนั้น
 *  ⇒ ท่อมีทางยกเลิกใบแล้ว (gucut-web POST ?voidpo · อ่านกลับยืนยัน Voided) ใบผิดจึงไม่ค้าง
 *  ⚠️ เปิดเฉพาะใบปกติ (Pending) · โหมดอย่างง่าย ?quick=1 ส่ง Success (รับของเข้าคลังทันที) **ยังปิด** ดูเงื่อนไขที่ปุ่ม */
const REAL_SEND_ENABLED = true

function NewPurchaseOrderInner() {
  // รับรหัสสินค้ามาจากเมนู ⋮ ของจอสินค้า/ลูกค้าได้ ("ซื้อสินค้า" → เปิดใบพร้อมบรรทัดแรก)
  // เติมตั้งแต่ตอนสร้าง state ไม่ใช่ใน effect — กติกาเดียวกับจอ moves (กันช่องกระพริบว่าง)
  const sp = useSearchParams()
  /* ── "สร้างอย่างง่าย" (soon: buy-create-quick · งานกระดาน t_mu0tx40g · 14 ก.ย. 2569) ──
     ZORT **ไม่มีเส้นแยก** สำหรับแบบง่าย (เอกสาร V4) ⇒ ใบเดิม + สถานะ "Success" + จ่ายเงินในคำขอเดียว
     ขาเข้าจากจอ → ท่อ ?addpo=1 เพิ่ม: status "Pending"|"Success" · paid (ตัวเลข) · paymentMethod (ชื่อวิธีชำระที่มีใน ZORT)
     🔴 **"Success" น่าจะรับของเข้าคลังทันที** — ยังไม่เคยยิง ⇒ ต้องเขียนเตือนบนจอ
     ⚠️ จ่ายเงินพร้อมกันได้เฉพาะเมื่อ**ทุกบรรทัดมีราคา** (ท่อตีกลับถ้าไม่ครบ — ตรวจที่จอก่อนให้ชัด) */
  const quick = sp.get('quick') === '1'
  const [paid, setPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  // ?vendor= มาจากเมนู ⋮ "ซื้อเข้า" ของจอผู้ติดต่อ (คนนั้นคือคู่ค้าของใบนี้)
  const [vendor, setVendor] = useState(() => (sp.get('vendor') ?? '').trim())
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>(() => {
    const sku = (sp.get('sku') ?? '').trim()
    return [sku ? { ...BLANK, sku } : { ...BLANK }]
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /* ⚠️ ท่อคืน linesTotal มาในโหมดซ้อม (gucut-web 994f84b) — ต้องรับไว้ในชนิดด้วย
     ไม่งั้นตัวเทียบยอดจะไม่เห็นค่า แล้วขึ้นว่า "ท่อรุ่นก่อน" ทั้งที่ท่อส่งมาให้แล้ว */
  const [res, setRes] = useState<(WriteResp & { linesTotal?: number | null }) | null>(null)
  const [okDry, setOkDry] = useState('')
  /** เลขอ้างอิงของใบนี้ — ตัวกันยิงซ้ำที่ฝั่งเซิร์ฟเวอร์ใช้ (UNIQUE กับ ref)
   *  ⚠️ **สร้างครั้งเดียวตอนเปิดหน้า** — สร้างใหม่ตอนกด = กดสองครั้งได้ใบสองใบ
   *  🔴 **ต้องสร้างใน effect ไม่ใช่ใน lazy initializer** (แก้ 12 ก.ย. 2569)
   *     หน้านี้ถูกวาดล่วงหน้าฝั่งเซิร์ฟเวอร์ด้วย ⇒ Math.random ทำให้สองฝั่งได้คนละเลข
   *     React เตือน hydration mismatch ทุกครั้งที่เปิดหน้า · ของจริงไม่พังเพราะสุดท้าย
   *     ยึดค่าฝั่งเบราว์เซอร์ **แต่คำเตือนที่ไม่กระทบอะไรคือของอันตราย**:
   *     สะสมไว้นาน ๆ คนจะเลิกอ่าน console แล้ววันที่มีของจริงโผล่มาจะไม่มีใครเห็น
   *     (คลาสเดียวกับตาข่ายที่เขียวตลอดกาล — เสียงเตือนที่ไม่มีความหมายทำให้เสียงจริงถูกกลบ)
   *  ⚠️ ว่างระหว่างเฟรมแรก = ปุ่มส่งยังกดไม่ได้อยู่แล้ว (ต้องกดทดลองส่งก่อน) จึงไม่มีช่องโหว่ */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  const clean = useMemo(() => lines
    .map((l) => ({ sku: l.sku.trim(), name: l.name.trim(), qty: Number(l.qty), price: l.price.trim() === '' ? null : Number(l.price) }))
    .filter((l) => l.sku && Number.isFinite(l.qty) && l.qty > 0), [lines])
  const sig = useMemo(
    () => JSON.stringify({ vendor: vendor.trim(), note: note.trim(), clean, quick, paid: paid.trim(), paymentMethod: paymentMethod.trim() }),
    [vendor, note, clean, quick, paid, paymentMethod])
  const dryOk = okDry !== '' && okDry === sig
  const priced = clean.filter((l) => l.price !== null).length
  const total = clean.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0)

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!clean.length) { setErr('ต้องมีรายการสินค้าอย่างน้อย 1 บรรทัด (จำนวนต้องมากกว่า 0)'); return }
    const dup = clean.map((l) => l.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) { setErr(`รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน`); return }
    /* แบบง่าย: ตรวจที่จอก่อนให้ข้อความชัด (ท่อตีกลับอยู่แล้วถ้าผิด) */
    let quickFields: Record<string, string | number> = {}
    if (quick) {
      if (priced < clean.length) { setErr('แบบง่ายต้องใส่ราคาครบทุกบรรทัด — ZORT ไม่คิดราคาให้ และจ่ายเงินพร้อมกันต้องรู้ยอดใบ'); return }
      quickFields = { status: 'Success' }
      if (paid.trim() !== '') {
        const n = Number(paid)
        if (!Number.isFinite(n) || n <= 0) { setErr('ยอดที่จ่ายต้องเป็นตัวเลขมากกว่า 0'); return }
        if (n > Math.round(total * 100) / 100) { setErr(`ยอดที่จ่าย ${n} มากกว่ายอดใบ ${Math.round(total * 100) / 100}`); return }
        if (!paymentMethod.trim()) { setErr('ใส่ยอดจ่ายแล้วต้องระบุวิธีชำระ (ชื่อที่มีใน ZORT)'); return }
        quickFields = { ...quickFields, paid: n, paymentMethod: paymentMethod.trim() }
      }
    }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?addpo=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          vendor: vendor.trim() || undefined,
          note: note.trim() || undefined,
          items: clean.map((l) => ({ sku: l.sku, ...(l.name ? { name: l.name } : {}), qty: l.qty, ...(l.price === null ? {} : { price: l.price }) })),
          ...quickFields,
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [vendor, note, clean, ref, sig, quick, priced, total, paid, paymentMethod])

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title={quick ? 'สร้างใบสั่งซื้ออย่างง่าย' : 'สร้างใบสั่งซื้อ'}
        summary={<>สร้างใบใน ZORT โดยตรง{' | '}<span className="text-gray-400">เลขอ้างอิงใบนี้: <b>{ref}</b> (กันการส่งซ้ำ)</span></>}
        actions={<Link href="/core/purchases" className="text-[13px] text-blue-600 hover:underline">← กลับรายการซื้อ</Link>}
      />

      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        🔴 <b>ZORT ไม่มีเส้นแก้ใบสั่งซื้อที่ส่งแล้ว</b> — ส่งพลาดแก้ไม่ได้ ต้อง<b>ยกเลิกทั้งใบ</b>แล้วทำใหม่
        {' '}(ยกเลิกผ่านท่อได้จริง ทดสอบแล้ว 14 ก.ย. 2569 · <b>จอนี้ยังไม่มีปุ่มยกเลิก</b> ต้องแจ้งคนที่มีสิทธิ์ หรือยกเลิกในหน้าจอ ZORT)
        <br />
        ⚠️ <b>&ldquo;ยิงผ่าน&rdquo; ไม่พอ</b> — ฝั่งท่อยิงจริงแล้วพบว่า ZORT
        <b>ไม่คำนวณยอดเงินให้เลยสักชั้น</b> ⇒ ใบที่ออกมาเป็น <b>฿0</b> ทั้งที่ส่งราคาไป
        และมันได้เลขที่ใบจริงตามปกติ <b>ไม่มีอะไรฟ้องสักคำ</b> (แก้ที่ท่อแล้ว)
        ⇒ ใบทดสอบจริงใบแรก (14 ก.ย. 2569 · ฿1) ดึงกลับมาแล้ว ยอดเข้าถูกช่อง
        <br />
        ✅ <b>ใบปกติส่งจริงเข้า ZORT ได้แล้ว</b> — ต้องกดทดลองส่งให้ผ่านก่อนทุกครั้ง ·
        {' '}<b>โหมดอย่างง่ายยังปิด</b> (บันทึกเป็นสำเร็จ รับของเข้าคลังทันที)
      </div>

      {quick ? (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-4 mb-3">
          <div className="text-[12.5px] text-amber-900 leading-relaxed mb-3">
            ⚡ <b>แบบง่าย = ใบสำเร็จทันที + จ่ายเงินในใบเดียว</b> (ZORT ไม่มีเส้นแยก ใช้ใบสั่งซื้อเดิมตั้งสถานะ &ldquo;สำเร็จ&rdquo;)
            <br />
            🔴 <b>สถานะสำเร็จน่าจะรับของเข้าคลังทันที</b> — ยังไม่เคยยิงจริง ใบแรกต้องดูสต็อกก่อน/หลัง ·
            ต้องใส่<b>ราคาครบทุกบรรทัด</b> · ไม่อยากให้ของเข้าคลังตอนนี้ ใช้{' '}
            <Link href="/core/purchases/new" className="underline">สร้างแบบปกติ</Link> แล้วรับของทีหลัง
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12.5px] text-gray-600">ยอดที่จ่ายแล้ว</span>
              <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal"
                className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ไม่ใส่ = ยังไม่บันทึกการจ่าย" />
            </label>
            <label className="block">
              <span className="text-[12.5px] text-gray-600">วิธีชำระ</span>
              <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" placeholder="ต้องเป็นชื่อที่มีใน ZORT เช่น โอน" />
            </label>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-gray-500 mb-3">
          อยากบันทึกว่าได้ของและจ่ายเงินแล้วในใบเดียว ใช้{' '}
          <Link href="/core/purchases/new?quick=1" className="text-blue-600 hover:underline">สร้างอย่างง่าย</Link>
        </p>
      )}

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
              : <>รวมเฉพาะ <b>{priced}</b> บรรทัดที่ใส่ราคา = <b>{fmtMoney(total)}</b></>}
        </span>
      </div>

      {/* 🔴 ข้อความเดิมตรงนี้เขียนว่า "ปล่อยให้ ZORT คิดเอง" — **ไม่จริง** (แก้ 14 ก.ย. 2569)
          กฎที่พิสูจน์แล้ว [[zort-sends-all-money-fields]]: ZORT ไม่คิดเงินให้สักชั้น
          ต้องส่งครบ pricepernumber → totalprice → amount · ขาดชั้นไหนใบเป็น 0 บาทเงียบ ๆ
          (ยิงโหมดซ้อมของจริงดูแล้ว 14 ก.ย. — บรรทัดที่ไม่ใส่ราคาถูกส่งไปโดยไม่มีช่องราคาเลย
           และทั้งใบไม่มี amount หัวใบ · ท่อจงใจไม่ส่ง ดีกว่าส่งศูนย์)
          ⚠️ ปุ่มส่งจริงเปิดแล้ว (14 ก.ย. 2569) ⇒ คำเตือนนี้คือด่านสุดท้ายก่อนส่งใบ 0 บาทเข้า ZORT
             ใบที่ส่งแล้วแก้ไม่ได้ ต้องยกเลิกทั้งใบ */}
      {clean.length > 0 && priced < clean.length && (
        <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
          ⚠️ <b>มี {clean.length - priced} บรรทัดที่ยังไม่ใส่ราคา</b> — <b>ZORT ไม่คิดราคาให้เอง</b>
          {' '}ถ้าส่งจริง บรรทัดพวกนั้นจะกลายเป็น <b>0 บาท</b> และใบนี้จะ<b>ไม่มียอดรวมหัวใบ</b>
          {' '}· ZORT <b>ไม่มีเส้นแก้ใบสั่งซื้อ</b> ใบที่ผิดต้องยกเลิกทั้งใบแล้วทำใหม่
        </div>
      )}

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}
      {/* 🔴 เทียบยอดที่ท่อคิดกับยอดที่จอคิด — ZORT ไม่คิดเงินให้สักชั้น
          จอนี้ปล่อยให้บรรทัดไม่มีราคาได้ ⇒ linesTotal:null เป็นเรื่องปกติ **ไม่ใช่ความผิด**
          จึงไม่ส่ง requiresPrice (ต่างจากจอขาย/จอคืนของที่บังคับราคาทุกบรรทัด) */}
      <LinesTotalCheck res={res} ourTotal={total} />

      <WriteResult r={res} />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => send(false)} disabled={busy}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        {/* 🔴 ส่งจริงได้เฉพาะใบปกติ (Pending) — โหมดอย่างง่าย (?quick=1) ส่ง status Success = รับของเข้าคลังทันที
            ยังไม่เคยยิงจริงและยกเลิกใบที่รับของแล้วผ่านท่อไม่ได้ ⇒ ปิดไว้แยก (งานกระดาน t_mu1bh3s7 · 14 ก.ย. 2569) */}
        <button onClick={() => send(true)} disabled={busy || !dryOk || !(REAL_SEND_ENABLED && !quick)}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: dryOk && REAL_SEND_ENABLED && !quick ? '#c0392b' : '#9aa0a6' }}>
          ส่งจริงเข้า ZORT
        </button>
        {!REAL_SEND_ENABLED
          ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้ส่งจริง</b> — รอเจ้าของร้านอนุมัติใบสั่งซื้อโดยเฉพาะ</span>
          : quick
            ? <span className="text-[12.5px] text-amber-800"><b>แบบอย่างง่ายยังไม่เปิดส่งจริง</b> — ใบนี้บันทึกเป็น &ldquo;สำเร็จ&rdquo; ซึ่งรับของเข้าคลังทันทีและยกเลิกจากที่นี่ไม่ได้ · ใช้ <a href="/core/purchases/new" className="underline">สร้างใบสั่งซื้อแบบปกติ</a> แทน</span>
            : !dryOk && <span className="text-[12.5px] text-gray-500">{okDry === '' ? 'ต้องกดทดลองส่งให้ผ่านก่อน' : 'เนื้อหาเปลี่ยนหลังทดลองส่ง — ต้องทดลองใหม่'}</span>}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        เลขอ้างอิง <b>{ref}</b> สร้างครั้งเดียวตอนเปิดหน้า ใช้เป็นตัวกันส่งซ้ำ — อยากสร้างใบใหม่ให้เปิดหน้านี้ใหม่ ·
        ⚠️ ZORT <b>ไม่มีเส้นแก้ใบสั่งซื้อที่ยืนยันแล้ว</b> (ยิงตรวจ 6 ก.ย. 2569: UpdatePurchaseOrder ตอบ 404
        {' '}· พบชื่อ EditPurchaseOrder อยู่จริงแต่ยังไม่มีใครยิงจริง) ⇒
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
