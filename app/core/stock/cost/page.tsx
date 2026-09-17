'use client'
// สินค้า → ปรับต้นทุนสินค้าหลายรายการ (soon: product-cost) — งานกระดาน t_mu10s2ns
//
// ท่อที่ใช้ (gucut-web netlify/functions/core.mjs · ขึ้นระบบแล้ว 14 ก.ย. 2569):
//   GET  /api/core?zortproduct=<sku>   → {found, product:{id, sku, name, purchaseprice, ...}} · ถามไม่สำเร็จ = 502 + unknown
//   POST /api/core?updateproduct=1     ขาเข้าจากจอ: {ref, id, sku, cost, confirm?}
//        ⇒ ขาออกไป ZORT: Product/UpdateProduct?id=<id> {purchaseprice: String} (ท่อแปลงเอง)
//
// 🔴 ปุ่มส่งจริงปิด (REAL_SEND_ENABLED) — แก้ของจริงใน ZORT หลายรายการพร้อมกัน ต้องให้ท่านประธานอนุมัติจอนี้โดยเฉพาะ
// ⚠️ ZORT มีแค่ "ราคาซื้อที่ตั้งไว้" (purchaseprice) ไม่ใช่ต้นทุนเฉลี่ย — เขียนบอกบนจอ ห้ามเรียกว่า "ต้นทุนจริง"
// ⚠️ แก้ระบุด้วย id ของ ZORT ไม่ใช่ sku ⇒ ถาม ?zortproduct ก่อนทุกแถว · ตอนส่งจริงท่อยืนยัน id↔sku อีกรอบ
// ⚠️ สามสถานะแยกเสมอ: ถาม ZORT ไม่สำเร็จ (ไม่รู้) · ZORT ไม่มีรหัสนี้ · ทดลองไม่ผ่าน — ห้ามยุบรวมเป็น "ผิด"
// ⚠️ ผลทดลองผูกกับเนื้อหาที่วาง — แก้ข้อความแล้วต้องทดลองใหม่ (กันทดลองชุด A แล้วส่งจริงชุด B)
// ⚠️ เส้นทาง /core/stock/cost ชนะ /core/stock/[sku] เสมอ (Next.js ให้เส้นคงที่มาก่อน) — สินค้ารหัส "cost" จะเปิดหน้าสินค้าตรง ๆ ไม่ได้ (เหมือน "new")
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHead } from '@/components/zort'

/** 🔴 ห้ามเปิดจนกว่าท่านประธานอนุมัติจอนี้โดยเฉพาะ */
const REAL_SEND_ENABLED = false
const MAX_ROWS = 100
const CONCURRENCY = 3

type Line = { line: number; sku: string; cost: number }
type Problem = { line: number; text: string; error: string }
type State = 'wait' | 'running' | 'dry-ok' | 'same' | 'not-found' | 'unknown' | 'failed' | 'sent' | 'duplicate'
type Row = Line & { state: State; message: string; id?: number; name?: string; current?: number | null }

/** แยกบรรทัดที่วางมาจาก Excel (แท็บ) หรือพิมพ์เอง (จุลภาค/ช่องว่าง) — คอลัมน์แรก = รหัส · คอลัมน์สุดท้าย = ต้นทุน */
function parse(text: string): { lines: Line[]; problems: Problem[] } {
  const lines: Line[] = []
  const problems: Problem[] = []
  const seen = new Map<string, number>()
  text.split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim()
    if (!t) return
    const n = i + 1
    /* 🔴 มีแท็บ (วางจาก Excel) = แยกด้วยแท็บอย่างเดียว — ห้ามแยกด้วยจุลภาค
          ไม่งั้น "1,290.50" ถูกหั่นเป็น 1 กับ 290.50 แล้วต้นทุนผิดเงียบ ๆ (เจอก่อน commit 14 ก.ย. 2569)
       ไม่มีแท็บ = รหัส + (จุลภาคหรือช่องว่าง) + ตัวเลขท้ายบรรทัด (ตัวเลขมีจุลภาคหลักพันได้) */
    let sku = ''
    let costRaw = ''
    if (t.includes('\t')) {
      const cols = t.split('\t').map((s) => s.trim()).filter(Boolean)
      if (cols.length >= 2) { sku = cols[0]; costRaw = cols[cols.length - 1] }
    } else {
      const m = t.match(/^(\S.*?)(?:\s*,\s*|\s+)(-?[\d,]*\.?\d+)$/)
      if (m) { sku = m[1].trim(); costRaw = m[2] }
    }
    if (!sku || !costRaw) {
      /* หัวตารางที่ติดมาจาก Excel — ข้ามเงียบ ๆ ได้เฉพาะบรรทัดแรก */
      if (n === 1 && t.includes('\t')) return
      problems.push({ line: n, text: t, error: 'ต้องมีรหัสสินค้าและต้นทุนในบรรทัดเดียวกัน' }); return
    }
    const costText = costRaw.replace(/,/g, '')
    /* หัวตารางที่ติดมาจาก Excel — ข้ามเงียบ ๆ ได้เฉพาะบรรทัดแรก */
    if (n === 1 && !/^[\d.]+$/.test(costText)) return
    if (!/^\d+(\.\d+)?$/.test(costText)) { problems.push({ line: n, text: t, error: 'ต้นทุนต้องเป็นตัวเลขไม่ติดลบ' }); return }
    if (seen.has(sku)) { problems.push({ line: n, text: t, error: `รหัส ${sku} ซ้ำกับบรรทัด ${seen.get(sku)} — ไม่รู้ว่าจะใช้ค่าไหน` }); return }
    seen.set(sku, n)
    lines.push({ line: n, sku, cost: Number(costText) })
  })
  return { lines, problems }
}

const STATE_TEXT: Record<State, [string, string]> = {
  wait: ['ยังไม่ได้ตรวจ', 'text-gray-400'],
  running: ['กำลังตรวจ…', 'text-gray-500'],
  'dry-ok': ['ผ่าน (ทดลอง — ยังไม่เข้า ZORT)', 'text-emerald-700'],
  same: ['เท่าเดิม — ไม่ส่ง', 'text-gray-500'],
  'not-found': ['ZORT ไม่มีรหัสนี้', 'text-amber-700'],
  unknown: ['ไม่รู้ผล — ถาม ZORT ไม่สำเร็จ', 'text-amber-700'],
  failed: ['ไม่ผ่าน', 'text-red-700'],
  sent: ['บันทึกแล้ว', 'text-emerald-700'],
  duplicate: ['เคยบันทึกแล้ว — ไม่ได้ส่งซ้ำ', 'text-gray-600'],
}

export default function ProductCostPage() {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [ranFor, setRanFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [runErr, setRunErr] = useState('')
  /* เลขอ้างอิงฐานสร้างฝั่งเบราว์เซอร์ครั้งเดียวต่อการเปิดหน้า (กันส่งซ้ำ · กัน hydration ไม่ตรง — ดูเหตุผลใน stock/new) */
  const [baseRef, setBaseRef] = useState('')
  useEffect(() => {
    setBaseRef(`PC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  const parsed = useMemo(() => parse(text), [text])
  const tooMany = parsed.lines.length > MAX_ROWS
  const fresh = ranFor !== '' && ranFor === text

  const runRow = useCallback(async (l: Line, confirm: boolean): Promise<Row> => {
    try {
      const f = await fetch(`/api/web/core?zortproduct=${encodeURIComponent(l.sku)}`)
      const j = await f.json().catch(() => null)
      if (!j || j.fallthrough) return { ...l, state: 'unknown', message: j?.fallthrough ? 'ท่อยังไม่มีเส้น zortproduct (ท่อรุ่นเก่า)' : `ท่อตอบอ่านไม่ออก (HTTP ${f.status})` }
      if (!f.ok || j.ok === false) return { ...l, state: 'unknown', message: j.error || `HTTP ${f.status}` }
      if (!j.found || !j.product) return { ...l, state: 'not-found', message: 'ไม่มีสินค้ารหัสนี้ตรงตัวใน ZORT' }
      const p = j.product
      const current = p.purchaseprice === null || p.purchaseprice === undefined ? null : Number(p.purchaseprice)
      const base = { ...l, id: Number(p.id), name: String(p.name ?? ''), current }
      if (current !== null && current === l.cost) return { ...base, state: 'same', message: '' }
      const u = await fetch('/api/web/core?updateproduct=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: `${baseRef}-${l.sku}`, id: base.id, sku: l.sku, cost: l.cost, ...(confirm ? { confirm: true } : {}) }),
      })
      const r = await u.json().catch(() => null)
      if (!r) return { ...base, state: 'unknown', message: `ท่อตอบอ่านไม่ออก (HTTP ${u.status}) — ห้ามส่งซ้ำจนกว่าจะเช็คใน ZORT` }
      if (r.unknown) return { ...base, state: 'unknown', message: `${r.error ?? ''} — ห้ามส่งซ้ำจนกว่าจะเช็คใน ZORT` }
      if (r.duplicate) return { ...base, state: 'duplicate', message: '' }
      if (r.ok && r.dryRun) return { ...base, state: 'dry-ok', message: '' }
      if (r.ok) return { ...base, state: 'sent', message: r.message ?? '' }
      return { ...base, state: 'failed', message: r.error ?? 'ไม่ผ่าน' }
    } catch (e) {
      return { ...l, state: 'unknown', message: `ส่งไม่สำเร็จ — ${String(e instanceof Error ? e.message : e)}` }
    }
  }, [baseRef])

  const run = useCallback(async (confirm: boolean) => {
    if (!parsed.lines.length || tooMany || !baseRef) return
    setBusy(true); setRunErr('')
    const snapshot = text
    const out: Row[] = parsed.lines.map((l) => ({ ...l, state: 'wait', message: '' }))
    setRows([...out])
    try {
      let next = 0
      const worker = async () => {
        while (next < out.length) {
          const i = next++
          out[i] = { ...out[i], state: 'running' }
          setRows([...out])
          out[i] = await runRow(parsed.lines[i], confirm)
          setRows([...out])
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, out.length) }, worker))
      if (!confirm) setRanFor(snapshot)
      else setRanFor('')
    } catch (e) {
      setRunErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [parsed, tooMany, baseRef, text, runRow])

  const count = (s: State) => rows.filter((r) => r.state === s).length
  const blocking = count('failed') + count('unknown') + count('not-found')
  const canSend = fresh && count('dry-ok') > 0 && blocking === 0 && parsed.problems.length === 0

  return (
    <div className="p-4 md:p-6 max-w-[1000px]">
      <PageHead
        title="ปรับต้นทุนสินค้า"
        summary={<>แก้ราคาซื้อที่ตั้งไว้ใน ZORT หลายรายการพร้อมกัน{' | '}<span className="text-gray-400">ครั้งละไม่เกิน {MAX_ROWS} รายการ</span></>}
        actions={<Link href="/core/stock" className="text-[13px] text-blue-600 hover:underline">← กลับหน้าคลังสินค้า</Link>}
      />

      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        ⚠️ ZORT มีแค่ <b>ราคาซื้อที่ตั้งไว้</b> ไม่ใช่ต้นทุนเฉลี่ยจากการรับของจริง · แก้แล้วมีผลกับกำไรที่คำนวณจากราคาซื้อนี้
        · ส่งเฉพาะรายการที่ต้นทุนเปลี่ยน · ตอนส่งจริงท่อจะถาม ZORT อีกรอบว่า id ยังเป็นรหัสเดิม ไม่ตรงจะไม่แก้
      </div>

      {/* 🔬 **เทียบกับจอ ZORT ตัวจริง** — ใบงานยืน t_mu2u9mym · อ่านอย่างเดียว 16 ก.ย. 2569
          `/Product/GetEditCostProduct` (เข้าจากลิงก์ "ปรับต้นทุนสินค้า" ในจอรายการสินค้าของ ZORT)
          วัดมาได้: ตาราง 100 แถว · ทุกแถวมีช่องแก้ราคา 1 ช่อง (`TxtPurchasePrice`) · มีช่องค้นหาเร็ว
          หัวคอลัมน์: รายการ · รหัสสินค้า · ชื่อสินค้า · **จำนวน** · **ราคา/หน่วย**
          ✅ **18 ก.ย. 2569 พิสูจน์แล้วว่า "คนละการกระทำ" จริง** (อ่านโค้ดจอเขา ไม่ได้กดปุ่มใด ๆ)
             · แต่ละแถวของ ZORT คือ **บรรทัดการเคลื่อนไหวสต็อก ไม่ใช่ตัวสินค้า** — แถวแรกที่เห็นคือใบ `TF-2022…`
               จำนวน 5 และช่องราคามี `data-id` เป็น **stockmovementid** (`data-pid` แยกเป็นรหัสสินค้าอีกช่อง)
             · ปุ่มบันทึกของเขาเรียก `SavePurchasePrice()` ⇒ POST `/Product/EditCostProduct`
               ส่งเป็น `{ id, totalprice }` = **ราคารวมของบรรทัดนั้น** ไม่ใช่ราคาต่อหน่วยของสินค้า
             · ปุ่ม "คัดลอกราคาเฉลี่ย" เรียก `/Product/dogetCalculateProductCostByStockMovements`
               พร้อม `stockmovementids` ⇒ **ต้นทุนเฉลี่ยของเขาคำนวณจากการเคลื่อนไหวสต็อก**
             ⇒ ท่อของเราเขียน `purchaseprice` ของตัวสินค้า ⇒ **คนละการกระทำกับจอ ZORT แน่นอนแล้ว**
                ไม่ใช่ "ยังไม่รู้" อีกต่อไป · เหตุผลที่ยังปิดปุ่มส่งจริงจึงหนักแน่นขึ้น ต้องให้ท่านประธานตัดสินว่าต้องการอันไหน */}
      <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        <b>จอนี้ทำงานไม่เหมือนจอ ZORT — ตั้งใจให้ต่าง</b> (เทียบของจริง 16 ก.ย. 2569)
        <ul className="list-disc ml-5 mt-1 space-y-0.5">
          <li>ZORT: ตาราง <b>100 แถว</b> แก้ราคาทีละช่องในแถว + ช่องค้นหาเร็ว — <b>วางจาก Excel ไม่ได้</b></li>
          <li>ของเรา: วางรายการทีเดียวได้ถึง {MAX_ROWS} รายการ · <b>ต้องทดลองก่อนทุกครั้ง</b> · ตอนส่งจริงยืนยันรหัสกับ ZORT อีกรอบ</li>
          <li>
            🔴 <b>สองจอนี้ทำคนละอย่างกัน — พิสูจน์แล้ว 18 ก.ย. 2569</b> (อ่านโค้ดจอ ZORT ไม่ได้กดปุ่ม):
            {' '}แต่ละแถวของ ZORT คือ<b>บรรทัดการเคลื่อนไหวสต็อก</b> (เช่นใบโอน TF-…) และสิ่งที่เขาบันทึกคือ
            {' '}<b>ราคารวมของบรรทัดนั้น</b> ส่วนปุ่มคัดลอกราคาเฉลี่ยของเขาคิดจาก<b>การเคลื่อนไหวสต็อก</b>
            {' '}· จอนี้แก้ <b>ราคาซื้อของตัวสินค้า</b> ⇒ ผลลัพธ์ไม่เหมือนกัน
            {' '}<b>ปุ่มส่งจริงจึงยังปิดอยู่ จนกว่าท่านประธานจะบอกว่าต้องการแบบไหน</b>
          </li>
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
        <label className="block">
          <span className="text-[13px] text-gray-700">วางจาก Excel ได้เลย — <b>คอลัมน์แรกรหัสสินค้า · คอลัมน์สุดท้ายต้นทุน</b> บรรทัดละ 1 รายการ</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={'00313\t450\n00627\t1290.50\n02779, 85'}
            className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] font-mono mt-2" />
        </label>
        <p className="text-[12.5px] text-gray-600 mt-1">
          อ่านได้ <b>{parsed.lines.length}</b> รายการ
          {parsed.problems.length > 0 && <> · บรรทัดผิด <b className="text-red-700">{parsed.problems.length}</b></>}
          {tooMany && <b className="text-red-700"> · เกิน {MAX_ROWS} รายการ — แบ่งวางหลายรอบ</b>}
        </p>
        {parsed.problems.length > 0 && (
          <ul className="text-[12.5px] text-red-800 mt-2 space-y-0.5">
            {parsed.problems.slice(0, 30).map((p) => <li key={p.line}>บรรทัด {p.line}: {p.error} <span className="text-gray-400 font-mono">({p.text.slice(0, 40)})</span></li>)}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button onClick={() => run(false)} disabled={busy || !parsed.lines.length || tooMany || !baseRef}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังตรวจกับ ZORT…' : `🧪 ตรวจ + ทดลองแก้ ${parsed.lines.length} รายการ (ยังไม่เข้า ZORT)`}
        </button>
        <button onClick={() => run(true)} disabled={busy || !canSend || !REAL_SEND_ENABLED}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: canSend && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
          บันทึกต้นทุนเข้า ZORT
        </button>
        {!REAL_SEND_ENABLED
          ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้แก้จริง</b> — รอท่านประธานอนุมัติจอนี้</span>
          : !canSend && rows.length > 0 && <span className="text-[12.5px] text-gray-500">
            {!fresh ? 'ข้อความเปลี่ยนหลังทดลอง — ต้องทดลองใหม่' : 'ต้องไม่มีรายการที่ไม่ผ่าน/ไม่รู้ผล/ไม่มีใน ZORT และไม่มีบรรทัดผิด'}
          </span>}
      </div>

      {runErr && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3">หยุดกลางทาง — {runErr} · รายการที่ขึ้นว่า &ldquo;ยังไม่ได้ตรวจ&rdquo; ยังไม่ถูกส่ง</div>}

      {rows.length > 0 && (
        <>
          <p className="text-[13px] text-gray-700 mb-2">
            ผ่าน <b className="text-emerald-700">{count('dry-ok') + count('sent')}</b> · เท่าเดิม <b>{count('same')}</b>
            {' · '}ไม่มีใน ZORT <b className="text-amber-700">{count('not-found')}</b> · ไม่รู้ผล <b className="text-amber-700">{count('unknown')}</b>
            {' · '}ไม่ผ่าน <b className="text-red-700">{count('failed')}</b>{count('duplicate') > 0 && <> · เคยบันทึกแล้ว <b>{count('duplicate')}</b></>}
          </p>
          <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-3 py-1.5 font-medium">บรรทัด</th>
                <th className="px-3 py-1.5 font-medium">รหัส · ชื่อ</th>
                <th className="px-3 py-1.5 font-medium text-right">ราคาซื้อเดิม</th>
                <th className="px-3 py-1.5 font-medium text-right">ใหม่</th>
                <th className="px-3 py-1.5 font-medium">ผล</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const [label, cls] = STATE_TEXT[r.state]
                  return (
                    <tr key={r.line} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-1 text-gray-400 tabular-nums">{r.line}</td>
                      <td className="px-3 py-1">
                        <Link href={`/core/stock/${encodeURIComponent(r.sku)}`} className="font-mono text-blue-600 hover:underline">{r.sku}</Link>
                        {r.name && <span className="text-gray-600"> · {r.name}</span>}
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums">{r.current === undefined ? '—' : r.current === null ? <span className="text-gray-400">ไม่ได้ตั้ง</span> : r.current.toLocaleString('th-TH')}</td>
                      <td className="px-3 py-1 text-right tabular-nums font-semibold">{r.cost.toLocaleString('th-TH')}</td>
                      <td className={`px-3 py-1 ${cls}`}>{label}{r.message && <span className="text-gray-500"> — {r.message}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
