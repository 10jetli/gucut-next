'use client'
// นำเข้าไฟล์ Excel/CSV 4 ทาง — สินค้า · ผู้ติดต่อ · รายการขาย · รายการซื้อ (งานกระดาน t_mu0wophn · 14 ก.ย. 2569)
// soon: product-import · contact-import · sale-import · buy-import
//
// ตัวแปลง: lib/excel-rows.ts (readImportFile) — ขาเข้าจากจอของท่อ · เทส scripts/tests/excel-rows.test.mjs
// ท่อ (gucut-web ขึ้นระบบแล้ว): POST /api/core?batch=<product|contact|sale|po>  ขาเข้าจากจอ: {rows ≤20, confirm?}
//   ⇒ ยิงทีละแถวผ่านตัวเขียนเดิมของชนิดนั้น · ตอบ {ok, complete, dryRun, total, done, notRun, nextRow, counts, results[]}
//
// 🔴 ปุ่มส่งจริงปิด (REAL_SEND_ENABLED) — เอกสารขาย/ซื้อที่สร้างแล้ว **ลบผ่าน API ไม่ได้** · สินค้าที่เพิ่มแล้วลบได้เฉพาะสต็อก 0
// 🔴 รายการขาย/ซื้อ **ปกติไม่ต้องนำเข้า** (ทะเบียนหน้า: ออเดอร์มาร์เก็ตเพลสไหลเข้าเอง · ใบสั่งซื้อดึงจาก ZORT อยู่แล้ว)
//    ⇒ นำเข้าซ้ำ = ใบซ้ำใน ZORT ⇒ เตือนแรงบนแท็บนั้น ใช้เฉพาะใบที่ไม่ได้มาจากมาร์เก็ตเพลส/ZORT
// ⚠️ แยกสามสถานะเสมอ: ยังไม่ส่ง · ส่งไม่สำเร็จ/ไม่รู้ผล · ผลจริงรายแถว — ห้ามยุบ "ไม่รู้" เป็น "ไม่ผ่าน"
import { Suspense, useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageHead, BtnGhost } from '@/components/zort'
import { readImportFile } from '@/lib/excel-rows'
import type { ImportKind, ParseResult } from '@/lib/excel-rows'

/** 🔴 ห้ามเปิดจนกว่าท่านประธานอนุมัติการนำเข้าจริงเข้า ZORT */
const REAL_SEND_ENABLED = false
const CHUNK = 20

const KINDS: { kind: ImportKind; label: string; soon: string; columns: string; note?: string }[] = [
  { kind: 'product', label: 'สินค้า', soon: 'product-import',
    columns: 'รหัสสินค้า · ชื่อสินค้า · ราคา · ต้นทุน · หน่วย · บาร์โค้ด · หมวดหมู่ (เลขอ้างอิง ไม่ใส่ก็ได้)' },
  { kind: 'contact', label: 'ผู้ติดต่อ', soon: 'contact-import',
    columns: 'รหัสผู้ติดต่อ · ชื่อ · โทรศัพท์ · อีเมล · เลขผู้เสียภาษี (เลขอ้างอิง ไม่ใส่ก็ได้)' },
  { kind: 'sale', label: 'รายการขาย', soon: 'sale-import',
    columns: 'เลขอ้างอิง หรือ เลขที่ใบ · ลูกค้า · รหัสสินค้า · ชื่อสินค้า · จำนวน · ราคา — ใบหลายสินค้าให้ใส่เลขเดียวกันหลายแถว',
    note: 'ออเดอร์จาก Shopee · Lazada · TikTok ไหลเข้าคลังเงาเองอยู่แล้ว **ไม่ต้องนำเข้า** — นำเข้าซ้ำ = ใบซ้ำใน ZORT ที่ลบไม่ได้ · ใช้เฉพาะใบขายที่ไม่ได้มาจากมาร์เก็ตเพลส' },
  /* 🔴 ทางที่ 5 (14 ก.ย. 2569 · ใบ t_mu0tx52v) — **บังคับราคาทุกบรรทัด ไม่เหมือนทางอื่น**
     ไม่ส่ง price ⇒ ท่อไม่ส่ง totalprice ⇒ ZORT สร้างใบ ฿0 จริง (เคยเกิดแล้ว QT-202609001)
     และใบเสนอราคาลบผ่าน API ไม่ได้ ⇒ ตัวแปลงตีกลับแถวไม่มีราคาเป็น error ตั้งแต่ก่อนส่ง */
  { kind: 'quotation', label: 'ใบเสนอราคา', soon: 'quotation',
    columns: 'เลขอ้างอิง หรือ เลขที่ใบ · ลูกค้า · รหัสสินค้า · ชื่อสินค้า · จำนวน · ราคา (บังคับ) — เพิ่มได้: โทรศัพท์ · เอกสารอ้างอิง · หมายเหตุ',
    note: '**ราคาบังคับทุกบรรทัด** — ใบเสนอราคาที่ราคาหายจะกลายเป็นใบ ฿0 ใน ZORT ซึ่ง **ลบผ่าน API ไม่ได้** · เส้นของ ZORT ไม่มีช่องเลขที่เอกสาร คอลัมน์ "เลขที่ใบ" ใช้รวมบรรทัดเท่านั้น ไม่ถูกส่ง' },
  { kind: 'po', label: 'รายการซื้อ', soon: 'buy-import',
    columns: 'เลขอ้างอิง หรือ เลขที่ใบ · ผู้ขาย · รหัสสินค้า · ชื่อสินค้า · จำนวน · ราคา — ใบหลายสินค้าให้ใส่เลขเดียวกันหลายแถว',
    note: 'ใบสั่งซื้อที่มีใน ZORT อยู่แล้วถูกดึงเข้ามาเอง **ไม่ต้องนำเข้า** — นำเข้าซ้ำ = ใบซ้ำใน ZORT ที่ลบไม่ได้ · ใช้เฉพาะใบที่ยังไม่มีใน ZORT' },
]

interface RowResult { row?: number; ok?: boolean; dryRun?: boolean; duplicate?: boolean; unknown?: boolean; error?: string; ref?: string }
interface BatchResp {
  ok?: boolean; complete?: boolean; dryRun?: boolean; total?: number; done?: number; notRun?: number; nextRow?: number | null
  results?: RowResult[]; error?: string; accepts?: string[]; fallthrough?: boolean
}
type SendOutcome = { index: number; ref: string; state: 'ok' | 'failed' | 'duplicate' | 'unknown' | 'notSent'; message: string }

function ImportInner() {
  const sp = useSearchParams()
  const initial = (KINDS.find((k) => k.kind === sp.get('kind'))?.kind ?? 'product') as ImportKind
  const [kind, setKind] = useState<ImportKind>(initial)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [outcomes, setOutcomes] = useState<SendOutcome[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const meta = KINDS.find((k) => k.kind === kind)!

  const reset = () => { setParsed(null); setParseErr(''); setOutcomes(null); setSendErr(''); setFileName('') }

  const onFile = useCallback(async (file: File | undefined) => {
    setOutcomes(null); setSendErr(''); setParseErr(''); setParsed(null)
    if (!file) return
    setFileName(file.name)
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setParseErr('รับเฉพาะไฟล์ .csv หรือ .xlsx — ไฟล์ .xls รุ่นเก่าให้บันทึกเป็น .xlsx ก่อน'); return }
    setParsing(true)
    try { setParsed(await readImportFile(kind, file)) }
    catch (e) { setParseErr(`อ่านไฟล์ไม่สำเร็จ — ${String(e instanceof Error ? e.message : e)}`) }
    finally { setParsing(false) }
  }, [kind])

  /* ทดลองส่งทีละ ≤20 แถว · ท่อหยุดกลางทาง (complete:false) = ส่งแถวที่เหลือของชุดนั้นต่อ
     ⚠️ ถ้าท่อไม่ขยับเลย (done 0 ซ้ำ) ให้หยุด ไม่วนไม่รู้จบ */
  const send = useCallback(async (confirm: boolean) => {
    if (!parsed?.rows.length) return
    setSending(true); setSendErr(''); setOutcomes(null)
    const all: SendOutcome[] = parsed.rows.map((r, i) => ({ index: i, ref: String(r.ref ?? ''), state: 'notSent', message: 'ยังไม่ได้ส่ง' }))
    try {
      for (let start = 0; start < parsed.rows.length; start += CHUNK) {
        let offset = start
        const end = Math.min(start + CHUNK, parsed.rows.length)
        let guard = 0
        while (offset < end && guard++ < CHUNK) {
          const res = await fetch(`/api/web/core?batch=${kind}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ rows: parsed.rows.slice(offset, end), ...(confirm ? { confirm: true } : {}) }),
          })
          const j: BatchResp | null = await res.json().catch(() => null)
          if (!j) throw new Error(`ท่อตอบอ่านไม่ออก (HTTP ${res.status}) — ยังไม่รู้ผลแถว ${offset + 1}–${end}`)
          if (j.fallthrough) throw new Error('ท่อยังไม่มีเส้น ?batch (ท่อรุ่นเก่า) — รอขึ้นระบบ')
          if (!Array.isArray(j.results)) throw new Error(j.error || `ท่อตอบไม่มีผลรายแถว (HTTP ${res.status})`)
          for (const r of j.results) {
            const idx = offset + Number(r.row ?? 0)
            if (!all[idx]) continue
            all[idx] = {
              index: idx, ref: all[idx].ref,
              state: r.unknown ? 'unknown' : r.duplicate ? 'duplicate' : r.ok ? 'ok' : 'failed',
              message: r.unknown ? `ไม่รู้ผล — ${r.error ?? ''} ห้ามส่งซ้ำจนกว่าจะเช็คใน ZORT`
                : r.duplicate ? 'เคยบันทึกแล้ว — ไม่ได้ส่งซ้ำ'
                : r.ok ? (r.dryRun ? 'ผ่าน (ทดลอง — ยังไม่เข้า ZORT)' : 'บันทึกแล้ว')
                : (r.error ?? 'ไม่ผ่าน'),
            }
          }
          const done = Number(j.done ?? j.results.length)
          if (j.complete !== false || done <= 0) break
          offset += done
        }
      }
    } catch (e) {
      setSendErr(String(e instanceof Error ? e.message : e))
    } finally {
      setOutcomes(all); setSending(false)
    }
  }, [parsed, kind])

  const count = (s: SendOutcome['state']) => outcomes?.filter((o) => o.state === s).length ?? 0

  return (
    <div className="p-4 md:p-6 max-w-[1000px]">
      <PageHead
        title="นำเข้าไฟล์ Excel / CSV"
        summary={<>อ่านไฟล์ในเครื่อง → ตรวจแถว → ทดลองส่งทีละ {CHUNK} แถว{' | '}<span className="text-gray-400">ไฟล์ไม่ถูกอัปโหลดไปเก็บที่ไหน</span></>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => { setKind(k.kind); reset() }}
            className={`text-[13px] rounded-full px-4 py-1.5 border ${k.kind === kind ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {k.label}
          </button>
        ))}
      </div>

      {meta.note && (
        <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔴 {meta.note.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
        <p className="text-[13px] text-gray-700"><b>หัวคอลัมน์แถวแรก</b> ({meta.label}): {meta.columns}</p>
        <p className="text-[11.5px] text-gray-400 mt-1">ใช้หัวคอลัมน์ภาษาไทยหรืออังกฤษก็ได้ · ไม่ใส่เลขอ้างอิง ระบบสร้างจากเนื้อหาแถวให้ (อัปไฟล์เดิมซ้ำจะไม่ได้ของซ้ำ) · อ่านเฉพาะชีตแรก</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <BtnGhost onClick={() => fileRef.current?.click()} disabled={parsing || sending}>
            {parsing ? 'กำลังอ่านไฟล์…' : '📂 เลือกไฟล์ .xlsx หรือ .csv'}
          </BtnGhost>
          {fileName && <span className="text-[12.5px] text-gray-600">{fileName}</span>}
        </div>
      </div>

      {parseErr && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3">{parseErr}</div>}

      {parsed && (
        <>
          <div className="text-[13px] text-gray-700 mb-2">
            อ่านได้ <b>{parsed.rows.length}</b> {kind === 'sale' || kind === 'po' ? 'ใบ' : 'รายการ'}
            {' · '}แถวผิด <b className={parsed.errors.length ? 'text-red-700' : ''}>{parsed.errors.length}</b>
            {parsed.warnings.length > 0 && <> · คำเตือน <b className="text-amber-700">{parsed.warnings.length}</b></>}
          </div>
          {parsed.warnings.map((w, i) => (
            <p key={i} className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-1.5 mb-2">⚠️ {w}</p>
          ))}
          {parsed.errors.length > 0 && (
            <div className="bg-white border border-red-200 rounded-md mb-3 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-1.5 font-medium">แถวในไฟล์</th><th className="px-3 py-1.5 font-medium">ช่อง</th><th className="px-3 py-1.5 font-medium">ปัญหา</th>
                </tr></thead>
                <tbody>
                  {parsed.errors.slice(0, 100).map((e, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-1 tabular-nums">{e.row}</td><td className="px-3 py-1">{e.field}</td><td className="px-3 py-1 text-red-800">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.errors.length > 100 && <p className="text-[11.5px] text-gray-400 px-3 py-1.5">แสดง 100 จาก {parsed.errors.length} แถวที่ผิด — แก้ในไฟล์แล้วอัปใหม่</p>}
            </div>
          )}
          {parsed.errors.length > 0 && parsed.rows.length > 0 && (
            <p className="text-[12.5px] text-gray-600 mb-3">แถวที่ผิด<b>ไม่ถูกส่ง</b> · ส่งได้เฉพาะ {parsed.rows.length} รายการที่ผ่านการตรวจ — หรือแก้ไฟล์ให้ครบแล้วอัปใหม่</p>
          )}

          {parsed.rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <button onClick={() => send(false)} disabled={sending}
                  className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
                  {sending ? 'กำลังส่ง…' : `🧪 ทดลองส่ง ${parsed.rows.length} รายการ (ยังไม่เข้า ZORT)`}
                </button>
                <button disabled title={REAL_SEND_ENABLED ? '' : 'ยังไม่เปิด — รอท่านประธานอนุมัติ'}
                  className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40" style={{ background: '#9aa0a6' }}>
                  นำเข้าจริงเข้า ZORT
                </button>
                {!REAL_SEND_ENABLED && <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้นำเข้าจริง</b> — รอท่านประธานอนุมัติ</span>}
              </div>

              {sendErr && (
                <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3">
                  ส่งหยุดกลางทาง — {sendErr} · แถวที่ยังไม่ได้ส่งจะขึ้นว่า &ldquo;ยังไม่ได้ส่ง&rdquo; (ไม่ใช่ &ldquo;ไม่ผ่าน&rdquo;)
                </div>
              )}

              {outcomes && (
                <p className="text-[13px] text-gray-700 mb-2">
                  ผลทดลอง: ผ่าน <b className="text-emerald-700">{count('ok')}</b> · ไม่ผ่าน <b className="text-red-700">{count('failed')}</b>
                  {' · '}เคยบันทึกแล้ว <b>{count('duplicate')}</b> · ไม่รู้ผล <b className="text-amber-700">{count('unknown')}</b>
                  {' · '}ยังไม่ได้ส่ง <b>{count('notSent')}</b>
                </p>
              )}

              <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-1.5 font-medium">#</th>
                    <th className="px-3 py-1.5 font-medium">เลขอ้างอิง</th>
                    <th className="px-3 py-1.5 font-medium">{/* ⚠️ เพิ่มชนิดใหม่ต้องมาแก้บรรทัดนี้ด้วย — ไม่งั้นตกไปที่ค่าท้ายสุด
                        แล้วหัวคอลัมน์จะโกหก (ใบเสนอราคาเคยขึ้นว่า "ผู้ขาย" ทั้งที่ค่าคือลูกค้า) */}
                    {kind === 'contact' ? 'รหัส · ชื่อ'
                      : kind === 'product' ? 'รหัส · ชื่อสินค้า'
                        : kind === 'po' ? 'ผู้ขาย · บรรทัด' : 'ลูกค้า · บรรทัด'}</th>
                    <th className="px-3 py-1.5 font-medium">ผล</th>
                  </tr></thead>
                  <tbody>
                    {parsed.rows.slice(0, 200).map((r, i) => {
                      const o = outcomes?.[i]
                      const items = Array.isArray(r.items) ? (r.items as { sku: string }[]) : null
                      const label = items
                        ? `${String(r.customer ?? r.vendor ?? '—')} · ${items.length} บรรทัด (${items.map((x) => x.sku).join(', ')})`
                        : `${String(r.sku ?? r.code ?? '')} · ${String(r.name ?? '')}`
                      return (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-1 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-1 font-mono text-[11.5px]">{String(r.ref ?? '')}</td>
                          <td className="px-3 py-1">{label}</td>
                          <td className={`px-3 py-1 ${o?.state === 'ok' ? 'text-emerald-700' : o?.state === 'failed' ? 'text-red-700' : o?.state === 'unknown' ? 'text-amber-700' : 'text-gray-500'}`}>
                            {o ? o.message : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {parsed.rows.length > 200 && <p className="text-[11.5px] text-gray-400 px-3 py-1.5">แสดง 200 จาก {parsed.rows.length} รายการ — ผลรวมข้างบนนับครบทุกรายการ</p>}
              </div>
            </>
          )}
          {parsed.rows.length === 0 && parsed.errors.length === 0 && (
            <p className="text-[13px] text-gray-500">ไฟล์นี้ไม่มีแถวข้อมูล (มีแต่หัวคอลัมน์หรือว่างทั้งไฟล์)</p>
          )}
        </>
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 leading-relaxed">
        ไม่มีไฟล์ตัวอย่างให้โหลด — สร้างใน Excel โดยพิมพ์หัวคอลัมน์ตามข้างบนในแถวแรก ·
        {' '}<Link href={`/core/soon/${meta.soon}`} className="underline">คำอธิบายเดิมของหน้านี้</Link>
      </p>
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-gray-500">กำลังโหลด...</div>}>
      <ImportInner />
    </Suspense>
  )
}
