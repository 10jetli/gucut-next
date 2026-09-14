'use client'
// ใบสั่งซื้อรายใบ — เปิดจากเลขที่ใบในจอรายการซื้อ (ตาม /Buy/Details ของ ZORT)
// gucut ทำแทน gucut2 (โควตาชน 89% · เจ้าของร้านสั่งให้หยุดที่ 80%)
//
// เส้น: /api/web/core?purchase=<เลขที่ใบ> — โครงจากซอร์สท่อจริง getPurchaseDetail:
//   { number, vendor, poDate, status, paymentStatus, warehouse, note,
//     amount, lineTotal, lines:[{line,sku,name,qty,price}], updatedAt, source }
//
// 🔴 **ต้องโชว์สองยอดคู่กันเสมอ ห้ามเลือกให้ค่าเดียว** (ท่อสั่งมาเอง):
//    amount    = ยอดหัวใบตามที่ ZORT ให้มา (รวมส่วนลด/ค่าส่ง/ภาษี)
//    lineTotal = ผลรวมบรรทัดที่เราคิดเอง (qty × price)
//    ⚠️ **ต่างกันได้เป็นปกติ ไม่ใช่ข้อมูลผิด** — กระจกไม่ได้เก็บส่วนลด/ค่าส่ง
//       ถ้าจอเลือกโชว์ค่าเดียว คนอ่านจะไม่มีวันรู้ว่ามีส่วนต่าง แล้วไล่บัญชีไม่ได้
//       (คลาสเดียวกับใบเสนอราคาที่ท่อจงใจส่งช่องเงินทุกช่อง)
// ⚠️ อ่านจาก **กระจก** ไม่ใช่ ZORT สด — ต้องเขียนบอกผู้ใช้ ไม่ปล่อยให้เข้าใจว่าสด
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, WriteResult, thaiDate } from '@/components/zort'
import type { WriteResp } from '@/components/zort'

/* ── รับของ / ตรวจนับสินค้าเข้า (soon: stock-count · งานกระดาน t_mu0tx40g · 14 ก.ย. 2569) ──
   ท่อ (gucut-web): GET ?zortpo=<เลขที่ใบ> → id ของ ZORT (กระจกไม่มี id · เลขที่ใบซ้ำได้ ท่อไม่เดา)
                    POST ?poreceive=1 ขาเข้าจากจอ: {ref, id, warehouse?, date?, items?:[{sku, qty}]}
                      มี items = รับบางส่วนตามที่นับได้ · ไม่มี = รับครบทั้งใบ
   🔴 ยิงจริงแล้วสต็อกขยับทันที ถอยผ่าน API ไม่ได้ · 🔴 ยังไม่รู้ว่าจำนวนเป็น "ยอดรอบนี้" หรือ "ยอดสะสม"
   🔴 ปุ่มรับจริงปิดอยู่ (REAL_SEND_ENABLED) รอท่านประธานอนุมัติ — แบบเดียวกับจอเขียนอื่น */
const REAL_SEND_ENABLED = false

interface ZortPo { id: number; number: string; status: string | null; warehousecode: string | null }
interface ZortPoResp { ok?: boolean; found?: boolean; purchaseOrder?: ZortPo; error?: string; unknown?: boolean; duplicate?: boolean; ids?: number[]; fallthrough?: boolean }

function ReceiveBox({ number, lines }: { number: string; lines: Line[] }) {
  const [po, setPo] = useState<ZortPo | null>(null)
  const [poErr, setPoErr] = useState('')
  const [poLoading, setPoLoading] = useState(true)
  const [mode, setMode] = useState<'partial' | 'all'>('partial')
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.filter((l) => l.sku).map((l) => [String(l.sku), ''])))
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<WriteResp | null>(null)
  const [okDry, setOkDry] = useState('')
  const [ref, setRef] = useState('')
  useEffect(() => { setRef(`RCV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`) }, [])

  const findPo = useCallback(async () => {
    setPoLoading(true); setPoErr(''); setPo(null)
    try {
      const r = await fetch(`/api/web/core?zortpo=${encodeURIComponent(number)}`)
      const j: ZortPoResp = await r.json().catch(() => ({}))
      if (j.fallthrough) { setPoErr('ท่อยังไม่มีเส้น zortpo (ท่อรุ่นเก่า) — รอขึ้นระบบ'); return }
      if (j.duplicate) { setPoErr(`เลขที่ใบนี้ซ้ำกัน ${j.ids?.length ?? '?'} ใบใน ZORT (id ${j.ids?.join(', ')}) — รับของจากจอนี้ไม่ได้ ต้องไปทำใน ZORT`); return }
      if (!r.ok || j.ok === false) { setPoErr(`ถาม ZORT ไม่สำเร็จ — ยังไม่รู้ว่ามีใบนี้ไหม · ${j.error ?? `HTTP ${r.status}`}`); return }
      if (!j.found || !j.purchaseOrder) { setPoErr(`ZORT ตอบว่าไม่มีใบสั่งซื้อเลขที่ ${number} ตรงตัว`); return }
      setPo(j.purchaseOrder)
    } catch (e) { setPoErr(String(e instanceof Error ? e.message : e)) } finally { setPoLoading(false) }
  }, [number])
  useEffect(() => { findPo() }, [findPo])

  const items = useMemo(() => Object.entries(counts)
    .map(([sku, v]) => ({ sku, qty: Number(v.trim()) }))
    .filter((x) => x.qty > 0 && Number.isFinite(x.qty)), [counts])
  const sig = useMemo(() => JSON.stringify({ mode, items, date }), [mode, items, date])
  const dryOk = okDry !== '' && okDry === sig

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!po) return
    if (mode === 'partial' && !items.length) { setErr('ใส่จำนวนที่นับได้อย่างน้อย 1 รหัส (หรือเลือกรับครบทั้งใบ)'); return }
    const bad = Object.entries(counts).filter(([, v]) => v.trim() !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0))
    if (bad.length) { setErr(`จำนวนไม่ถูกต้อง: ${bad.map(([s]) => s).join(', ')}`); return }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('วันที่รับของต้องเป็นรูป ปปปป-ดด-วว'); return }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?poreceive=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref, id: po.id,
          ...(po.warehousecode ? { warehouse: po.warehousecode } : {}),
          ...(date ? { date } : {}),
          ...(mode === 'partial' ? { items } : {}),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [po, mode, items, counts, date, ref, sig])

  return (
    <section className="mt-4 rounded border-2 border-amber-200 bg-amber-50/40 p-3">
      <h2 className="mb-1 text-[14px] font-semibold">📦 รับของ / ตรวจนับสินค้าเข้า (ส่งเข้า ZORT)</h2>
      <p className="text-[12.5px] text-amber-900 leading-relaxed">
        {/* 🔴 ถ้อยคำเดิมอ่านได้สองทาง: "ยิงจริงแล้ว(เคยทดลอง)" กับ "ถ้ายิงจริง"
            ⇒ ทางแรกคือการอ้างหลักฐานที่ไม่มีอยู่ · ปุ่มส่งจริงของจอนี้ยังปิดอยู่
               แปลว่ายังไม่เคยมีใครยิงจากจอนี้เลยสักครั้ง (ตรวจจากโค้ด 14 ก.ย. 2569)
            ⚠️ คำเตือนที่อ้างหลักฐานเกินจริงอันตรายพอ ๆ กับคำเตือนที่อ่อนเกินไป
               เพราะพอวันหนึ่งมีคนพบว่าไม่เคยทดสอบ เขาจะเลิกเชื่อคำเตือนอันอื่นด้วย */}
        🔴 <b>นี่คือการเขียนจริง — ยิงแล้วสต็อกใน ZORT ขยับ และถอยผ่านระบบเราไม่ได้</b>
        {' '}· 🔴 <b>ยังไม่เคยยิงจริงจากจอนี้สักครั้ง</b> (ปุ่มส่งจริงยังปิด · ตรวจจากโค้ด 14 ก.ย. 2569)
        {' '}⇒ <b>ยังไม่รู้</b>ว่า ZORT นับจำนวนที่ส่งเป็น
        &ldquo;ยอดรอบนี้&rdquo; หรือ &ldquo;ยอดสะสม&rdquo; — ใบแรกต้องดูสต็อกก่อน/หลังด้วยตา
        {!REAL_SEND_ENABLED && <> · <b>ตอนนี้ยังรับจริงไม่ได้</b> รอท่านประธานอนุมัติ (ทดลองใช้ได้)</>}
      </p>

      {poLoading && <p className="mt-2 text-[13px] text-gray-500">กำลังถาม ZORT ว่าใบนี้คือ id ไหน…</p>}
      {poErr && (
        <p className="mt-2 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {poErr} <button onClick={findPo} className="underline">ลองใหม่</button>
        </p>
      )}
      {po && (
        <>
          <p className="mt-2 text-[12.5px] text-gray-600">
            ใบนี้ใน ZORT: id <b>{po.id}</b> · สถานะ <b>{po.status ?? '—'}</b> · คลัง <b>{po.warehousecode ?? 'ค่าเริ่มต้นของร้าน'}</b>
            {' '}<span className="text-gray-400">(ถามสดจาก ZORT · ไม่ใช่กระจก)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'partial'} onChange={() => setMode('partial')} /> รับตามจำนวนที่นับได้
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> รับครบทั้งใบ
            </label>
            <label className="flex items-center gap-1.5">
              วันที่รับ <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="ปปปป-ดด-วว (ไม่ใส่ = วันนี้)"
                className="border border-gray-300 rounded px-2 py-1 text-[13px] w-[190px]" />
            </label>
          </div>
          {mode === 'partial' && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 pr-2 font-medium">รหัส</th>
                    <th className="py-1 pr-2 font-medium">ชื่อสินค้า</th>
                    <th className="py-1 pr-2 font-medium text-right">สั่งไว้ (กระจก)</th>
                    <th className="py-1 font-medium text-right" style={{ width: 130 }}>นับได้</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.filter((l) => l.sku).map((l) => (
                    <tr key={String(l.sku)} className="border-b border-gray-100 last:border-0">
                      <td className="py-1 pr-2 font-mono text-[12px]">{l.sku}</td>
                      <td className="py-1 pr-2">{l.name || '—'}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{baht(l.qty)}</td>
                      <td className="py-1 text-right">
                        <input value={counts[String(l.sku)] ?? ''} inputMode="decimal"
                          onChange={(e) => setCounts((c) => ({ ...c, [String(l.sku)]: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-[13px] text-right" placeholder="0" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {err && <p className="mt-2 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
          <WriteResult r={res} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => send(false)} disabled={busy || !ref}
              className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50">
              {busy ? 'กำลังส่ง…' : '🧪 ทดลองรับของ (ยังไม่เข้า ZORT)'}
            </button>
            <button onClick={() => send(true)} disabled={busy || !ref || !dryOk || !REAL_SEND_ENABLED}
              className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
              style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
              รับของเข้า ZORT จริง
            </button>
            {REAL_SEND_ENABLED && !dryOk && <span className="text-[12.5px] text-gray-500">{okDry === '' ? 'ต้องกดทดลองให้ผ่านก่อน' : 'จำนวนเปลี่ยนหลังทดลอง — ต้องทดลองใหม่'}</span>}
          </div>
        </>
      )}
    </section>
  )
}

/** "2026-09-03 00:40:08" → "3 ก.ย. 2569 00:40:08" — แปลงเฉพาะส่วนวัน คงเวลาไว้ทั้งหมด
 *  ⚠️ ค่านี้ท่อส่งมาแบบไม่มีโซนเวลาติด ⇒ **ห้ามเอาไปคิดโซน** จะเลื่อนวันโดยไม่รู้ตัว
 *     (ต่างจากกำหนดส่งของจอใบสั่งผลิตที่มี Z ติดมา ⇒ อันนั้นต้องแปลง) */
function mirrorAt(v?: string | null): string | null | undefined {
  const s = String(v ?? '').trim()
  const m = /^(\d{4}-\d{2}-\d{2})[ T](.+)$/.exec(s)
  return m ? `${thaiDate(m[1])} ${m[2]}` : v
}

interface Line { line?: number; sku?: string; name?: string; qty?: number; price?: number }
interface Resp {
  number?: string; vendor?: string | null; poDate?: string | null
  status?: string | null; paymentStatus?: string | null; warehouse?: string | null
  note?: string | null; amount?: number; lineTotal?: number
  lines?: Line[]; updatedAt?: string | null; source?: string
  error?: string; skip?: string
}

const baht = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—'

function Inner() {
  const no = useSearchParams().get('no') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!no) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรายการซื้อ)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?purchase=${encodeURIComponent(no)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [no])
  useEffect(() => { load() }, [load])

  // ส่วนต่างหัวใบ vs บรรทัด — คำนวณเพื่อ "ชี้ให้ดู" ไม่ใช่เพื่อตัดสินว่าใครผิด
  const diff =
    typeof d?.amount === 'number' && typeof d?.lineTotal === 'number'
      ? Math.round((d.amount - d.lineTotal) * 100) / 100
      : null

  const Field = ({ k, v }: { k: string; v?: string | null }) =>
    v ? (
      <div className="flex gap-2 text-[13px]">
        <span className="min-w-[92px] text-gray-500">{k}</span>
        <span className="break-words">{v}</span>
      </div>
    ) : null

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/purchases" className="text-blue-600 hover:underline">‹ รายการซื้อ</Link>
      </p>
      <PageHead title={`ใบสั่งซื้อ ${d?.number || no}`}
        summary={<span className="text-gray-400">{d?.source || 'อ่านจากคลังเงา'}</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบสั่งซื้อไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <section className="rounded border border-gray-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold">หัวใบ</h2>
              <div className="grid gap-1">
                <Field k="ผู้ขาย" v={d.vendor} />
                {/* 🔴 เดิมโชว์ค่าดิบ "2026-03-10" — ทั้งร้านอ่านปี พ.ศ. และจออื่นแปลงหมดแล้ว
                    จอเดียวที่ไม่แปลง = คนเทียบข้ามจอแล้วสะดุด และเสี่ยงอ่านปีผิดไป 543 ปี
                    (เจอกับของจริงตอนเปิดใบ PO-202603001 · 14 ก.ย. 2569) */}
                <Field k="วันที่" v={d.poDate ? thaiDate(d.poDate) : d.poDate} />
                <Field k="สถานะ" v={d.status} />
                <Field k="การชำระเงิน" v={d.paymentStatus} />
                <Field k="คลังปลายทาง" v={d.warehouse} />
                <Field k="โน้ต" v={d.note} />
                {/* ⚠️ ค่านี้เป็น "เวลา" ไม่ใช่ "วันที่" ⇒ แปลงเฉพาะส่วนวัน แล้วคงเวลาไว้
                    ห้ามตัดเวลาทิ้ง — คนใช้ดูว่ากระจกอัปเดตล่าสุดกี่โมงเพื่อตัดสินว่าข้อมูลเก่าไหม */}
                <Field k="อัปเดตกระจก" v={mirrorAt(d.updatedAt)} />
              </div>
            </section>

            <section className="rounded border border-gray-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold">ยอดเงิน</h2>
              {/* 🔴 สองยอดคู่กันเสมอ — ท่อส่งมาทั้งคู่โดยตั้งใจ */}
              <div className="grid gap-1 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">ยอดหัวใบ (ตาม ZORT)</span>
                  <b className="tabular-nums">{baht(d.amount)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ผลรวมบรรทัด (คิดเอง)</span>
                  <b className="tabular-nums">{baht(d.lineTotal)}</b>
                </div>
              </div>
              {diff !== null && diff !== 0 && (
                /* ⚠️ ไม่ใช่กล่องแดง — ส่วนต่างเป็นเรื่องปกติ ไม่ใช่ข้อผิดพลาด */
                <p className="mt-2 rounded bg-gray-50 p-2 text-[12px] text-gray-600">
                  ต่างกัน <b className="tabular-nums">{baht(diff)}</b> บาท{' — '}
                  {/* 🔴 **คำอธิบายเดิมครอบไม่ถึงส่วนต่างที่เป็นลบ** (เจอกับใบจริง 14 ก.ย. 2569)
                      ส่วนลดทำให้หัวใบ**น้อยกว่า** · ค่าส่งกับภาษีทำให้**มากกว่า**
                      ⇒ ไม่มีอันไหนอธิบายกรณี "ผลรวมบรรทัดมากกว่าหัวใบ" ได้ตรง ๆ
                      ของจริง PO-202301001: หัวใบ 300,000 · บรรทัด 300,058.5 (ต่าง −58.5)
                        = 69,700 ฟัน × 4.305 บาท ทั้งที่ 300,000 ÷ 69,700 = 4.30416…
                        ⇒ **ราคาต่อหน่วยถูกปัดเศษที่ต้นทาง** แล้วคูณจำนวนมาก ๆ ส่วนต่างเลยโผล่
                      ⚠️ เขียนเป็น "สาเหตุที่เป็นไปได้" ไม่ใช่ชี้ว่าใบนี้เกิดจากอะไร
                         เพราะจอไม่มีทางรู้ — มีแค่สองตัวเลขเท่านั้น */}
                  สาเหตุที่เป็นไปได้: <b>ส่วนลด / ค่าส่ง / ภาษี</b> ที่กระจกไม่ได้เก็บแยกไว้
                  {diff < 0 && <>, หรือ<b>การปัดเศษราคาต่อหน่วย</b>ที่ต้นทาง (ส่วนต่างติดลบเกิดจากส่วนลดหรือค่าส่งไม่ได้)</>}
                  {diff > 0 && <> หรือการปัดเศษราคาต่อหน่วย</>}
                  <b> ไม่ใช่ข้อมูลผิด</b> · ถ้าต้องใช้ตัวเลขทางบัญชี ให้ยึดยอดหัวใบ
                </p>
              )}
            </section>
          </div>

          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">
              รายการสินค้า {d.lines?.length ? `(${d.lines.length} บรรทัด)` : ''}
            </h2>
            {!d.lines?.length ? (
              /* สามสถานะ: ใบนี้ไม่มีบรรทัดจริง ≠ ดึงไม่สำเร็จ (ถ้าดึงพลาดจะไปที่ ErrorBox แล้ว) */
              <p className="text-[13px] text-gray-500">
                ใบนี้ไม่มีบรรทัดสินค้าในกระจก — ใบเก่าบางใบ ZORT ไม่ได้ส่งบรรทัดมาให้
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 pr-2 font-medium">#</th>
                      <th className="py-1 pr-2 font-medium">รหัส</th>
                      <th className="py-1 pr-2 font-medium">ชื่อสินค้า</th>
                      <th className="py-1 pr-2 font-medium text-right">จำนวน</th>
                      <th className="py-1 pr-2 font-medium text-right">ราคา/หน่วย</th>
                      <th className="py-1 font-medium text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.sku ?? i}-${l.line ?? i}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-2 text-gray-400">{l.line ?? i + 1}</td>
                        <td className="py-1 pr-2 font-mono text-[12px]">
                          {/* เลขรหัสสินค้าเข้าจอสินค้าได้ — แบบแผน "ทุกตัวระบุตัวตนต้องกดได้" */}
                          {l.sku
                            ? <Link href={`/core/stock?q=${encodeURIComponent(l.sku)}`} className="text-blue-600 hover:underline">{l.sku}</Link>
                            : '—'}
                        </td>
                        <td className="py-1 pr-2">{l.name || '—'}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(l.qty)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(l.price)}</td>
                        <td className="py-1 text-right tabular-nums">
                          {baht((Number(l.qty) || 0) * (Number(l.price) || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* รับของ/ตรวจนับ — เปิดได้เฉพาะใบที่มีเลขที่ใบ (ท่อหา id ของ ZORT จากเลขนี้) */}
          {(d.number || no) && <ReceiveBox number={d.number || no} lines={d.lines ?? []} />}
        </>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>
}
