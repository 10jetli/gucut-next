'use client'
// รายการซื้อ → รับสินค้า — **ลอกลำดับการทำงานจาก `zort-ui/80-zort-รับสินค้าเข้า-3ขั้นตอน.jpg`**
//
// ⚠️ จอ ZORT ตัวนี้ **ไม่มีตารางให้ลอกผัง** — สิ่งที่ลอกได้คือ "ลำดับ 3 ขั้น"
//    ขั้น 1 กรอกหมายเลขรายการ → ขั้น 2 จัดการรับสินค้า → ขั้น 3 รับสำเร็จ
//    (ของ ZORT เป็นหน้าเต็มจอไม่มีเมนูซ้าย — ของเราคงเมนูไว้ เพราะคนใช้ต้องกดกลับไปจออื่นได้
//     ไม่ใช่ทุกความต่างคือความผิด อันนี้ตั้งใจต่าง)
//
// 🔴 **ทำไมต้องเริ่มจากเลขใบ ไม่ใช่กรอก SKU ลอย ๆ**
//    ตาข่ายกันซ้ำของคลังเงาคือ UNIQUE(reason, ref, sku) ⇒ **ref คือหัวใจ**
//    กรอกลอย ๆ คนจะใส่ ref มั่ว/ว่าง แล้วกดสองครั้งของเข้าคลังสองรอบโดยไม่มีอะไรเตือน
//    เริ่มจากเลขใบ = ref ถูกล็อกให้เป็นเลขใบนั้นเสมอ คนพิมพ์ผิดไม่ได้
//
// ⚠️ **สองอย่างที่ ZORT ทำได้แต่เราทำไม่ได้ — ต้องเขียนบนจอ ห้ามเงียบ**
//    ① ค้นด้วย **Tracking No.** — คลังเงาไม่ได้เก็บเลขพัสดุของใบโอน (ตาราง transfers
//       มีแค่ number/reference) ⇒ ค้นด้วยเลขพัสดุจะไม่เจอ **ต้องบอก ไม่ใช่ขึ้นว่า "ไม่พบใบ"**
//    ② **รายการสินค้าในใบ** — เราเก็บแต่หัวใบ ไม่มีบรรทัดสินค้า ⇒ เติมให้ล่วงหน้าไม่ได้
//       คนต้องพิมพ์ SKU เอง (ขอเส้นอ่านบรรทัดสินค้าไว้กับฝั่งท่อแล้ว)
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, Pill, thaiDate } from '@/components/zort'

interface Doc {
  id?: string; number?: string; kind?: string; status?: string
  from_wh?: string; to_wh?: string; transfer_date?: string; reference?: string; note?: string
}
interface Line { sku: string; qty: string }

/** ผลจากท่อ — **เป็นยอดรวมของทั้งชุด ไม่ใช่รายบรรทัด** (applyMoves คืนแบบนั้น) */
interface MoveResp {
  ok?: boolean; sent?: number; added?: number; duplicate?: number
  bad?: { sku?: string; why?: string }[]; error?: string
}

const STEPS = ['กรอกหมายเลขใบโอน', 'จัดการรับสินค้า', 'รับสำเร็จ']

function Stepper({ at }: { at: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3 mb-4">
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold
                ${i < at ? 'bg-emerald-500 text-white' : i === at ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                style={i === at ? { background: '#4669e5' } : undefined}>
                {i < at ? '✓' : i + 1}
              </div>
              <p className={`text-[11.5px] mt-1 whitespace-nowrap ${i === at ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                ขั้นตอนที่ {i + 1}
              </p>
              <p className={`text-[11px] whitespace-nowrap ${i === at ? 'text-gray-600' : 'text-gray-300'}`}>{s}</p>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < at ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReceivePage() {
  const [step, setStep] = useState(0)
  const [q, setQ] = useState('')
  const [doc, setDoc] = useState<Doc | null>(null)
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /** ค้นแล้วไม่เจอ — **คนละสถานะกับค้นไม่สำเร็จ** (ต้องเขียนคนละคำ) */
  const [notFound, setNotFound] = useState(false)
  const [result, setResult] = useState<MoveResp | null>(null)

  const find = useCallback(async () => {
    const term = q.trim()
    if (!term) return
    setBusy(true); setErr(''); setNotFound(false)
    try {
      const r = await fetch(`/api/web/core?list=transfers&limit=5&q=${encodeURIComponent(term)}`)
        .then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      const rows: Doc[] = Array.isArray(r?.rows) ? r.rows : []
      if (!rows.length) { setNotFound(true); setDoc(null); return }
      /* ⚠️ เลขที่ใบใน ZORT **ซ้ำกันได้จริง** (ฝั่งท่อเจอ 546 เลขซ้ำ) ⇒ ค้นแล้วอาจได้หลายใบ
         เลือกใบล่าสุดให้ก่อน แต่ต้องโชว์ให้เห็นว่ามีหลายใบ ไม่ใช่เลือกเงียบ ๆ */
      setDoc(rows[0])
      setStep(1)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setDoc(null)
    } finally { setBusy(false) }
  }, [q])

  const submit = useCallback(async () => {
    if (!doc?.number) return
    const moves = lines
      .map((l) => ({ sku: l.sku.trim(), qty: Number(l.qty), reason: 'transfer_in', ref: doc.number!.trim() }))
      .filter((m) => m.sku && Number.isFinite(m.qty) && m.qty !== 0)
    if (!moves.length) { setErr('ยังไม่ได้กรอกรายการที่รับเข้า'); return }
    setBusy(true); setErr('')
    try {
      const r: MoveResp = await fetch('/api/web/core?move=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ moves }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      setResult(r)
      setStep(2)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [doc, lines])

  return (
    <div className="p-4 md:p-6 max-w-[880px]">
      <PageHead
        title="รับสินค้าเข้า"
        summary={
          <>
            รับของเข้าคลังโดยอ้างใบโอนที่มีอยู่จริง
            {' | '}
            <span className="text-gray-400">เลขใบกลายเป็นตัวกันบันทึกซ้ำให้เอง</span>
          </>
        }
        actions={step > 0 ? (
          <BtnGhost onClick={() => { setStep(0); setDoc(null); setResult(null); setErr('') }}>
            เริ่มใบใหม่
          </BtnGhost>
        ) : undefined}
      />

      <Stepper at={step} />

      {err && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3">
          {err}
        </div>
      )}

      {/* ── ขั้นที่ 1 ─────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-6 text-center">
          <p className="text-[17px] font-semibold text-gray-900 mb-1">เริ่มต้นการรับสินค้าเข้า</p>
          <p className="text-[13px] text-gray-600">กรอกหมายเลขใบโอน หรือเลขอ้างอิง</p>
          {/* 🔴 ต้องบอกตั้งแต่ก่อนกรอก ว่าเลขพัสดุใช้ไม่ได้ — ไม่ใช่ปล่อยให้ค้นแล้วขึ้น "ไม่พบ"
              ซึ่งจะทำให้คนสรุปผิดว่า "ไม่มีใบนี้ในระบบ" ทั้งที่ระบบแค่ค้นด้วยเลขนั้นไม่เป็น */}
          <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-2.5 inline-block leading-relaxed">
            ⚠️ ค้นด้วย <b>เลขพัสดุ (Tracking No.)</b> ยังไม่ได้ — คลังเงายังไม่ได้เก็บเลขพัสดุของใบโอน
            {' '}(ZORT ค้นได้) ⇒ ใช้เลขใบโอนหรือเลขอ้างอิงแทน
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') find() }}
              placeholder="เช่น TF-2026xxxxxx"
              className="w-full max-w-[320px] border border-gray-300 rounded px-3 py-2 text-[14px]"
            />
            <button
              onClick={find}
              disabled={busy || !q.trim()}
              className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-50"
              style={{ background: '#4669e5' }}
            >
              {busy ? 'กำลังค้น…' : 'รับสินค้าเข้า'}
            </button>
          </div>

          {notFound && (
            /* ⚠️ สามสถานะ: ไม่พบใบ / ค้นไม่สำเร็จ (ขึ้นกล่องแดงข้างบน) / ยังไม่ได้ค้น */
            <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-4 text-left leading-relaxed">
              <b>ไม่พบใบโอนที่ตรงกับ &ldquo;{q.trim()}&rdquo;</b> — ค้นจากเลขใบและเลขอ้างอิงในคลังเงา
              <br />
              เป็นไปได้สามอย่าง: พิมพ์ผิด · เป็นเลขพัสดุ (ยังค้นไม่ได้) · ใบยังไม่ถูกดูดเข้าคลังเงา
              (ซิงก์ทุกครึ่งชั่วโมง)
              <br />
              ถ้าของมาถึงแล้วจริงและต้องบันทึกเดี๋ยวนี้ ใช้{' '}
              <Link href="/core/moves" className="text-blue-600 hover:underline">หน้าบันทึกของเข้า-ออก</Link>{' '}
              ได้ — แต่ต้องกรอกเลขอ้างอิงเองให้ถูก
            </div>
          )}
        </div>
      )}

      {/* ── ขั้นที่ 2 ─────────────────────────────────────── */}
      {step === 1 && doc && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold text-gray-900">{doc.number}</p>
                <p className="text-[12.5px] text-gray-600 mt-0.5">
                  {doc.from_wh || '—'} → {doc.to_wh || '—'}
                  {doc.transfer_date && <> · {thaiDate(doc.transfer_date)}</>}
                  {doc.reference && <> · อ้างอิง {doc.reference}</>}
                </p>
              </div>
              {/* ⚠️ โชว์สถานะดิบ ไม่แปล ไม่ระบายสีตามใจ — คำสถานะของใบโอนเป็นคนละชุดกับออเดอร์ */}
              {doc.status && <Pill tone="gray">{doc.status}</Pill>}
            </div>
            {doc.note && <p className="text-[12px] text-gray-500 mt-2">{doc.note}</p>}
            {/* 🔴 ZORT บังคับว่าใบต้องเป็น "รอโอน/รอบางส่วน" — เราไม่รู้ชุดคำสถานะทั้งหมด
                ⇒ **เตือน ไม่บล็อก** บล็อกด้วยคำที่เราเดาเอง = ของมาถึงแล้วบันทึกไม่ได้ */}
            <p className="text-[11.5px] text-gray-500 mt-2 leading-relaxed">
              ⚠️ ZORT ยอมให้รับเฉพาะใบที่สถานะเป็น <b>รอโอน</b> หรือ <b>รอบางส่วน</b> —
              ของเรา<b>ไม่บล็อกตามสถานะ</b> เพราะยังไม่รู้ชุดคำสถานะทั้งหมดของใบโอน
              บล็อกด้วยคำที่เดาเอง = ของมาถึงแล้วบันทึกไม่ได้ · <b>ดูสถานะข้างบนก่อนกดยืนยัน</b>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4">
            <p className="text-[14px] font-semibold text-gray-900 mb-1">รายการที่รับเข้าจริง</p>
            {/* 🔴 บอกตรง ๆ ว่าทำไมไม่มีรายการมาให้ล่วงหน้า */}
            <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3 leading-relaxed">
              ⚠️ <b>เติมรายการสินค้าให้ล่วงหน้าไม่ได้</b> — คลังเงาเก็บแต่หัวใบโอน ยังไม่มีบรรทัดสินค้า
              {' '}(ZORT มี) ⇒ ต้องพิมพ์รหัสสินค้าเอง · <b>กรอกเท่าที่รับได้จริง</b>
              ไม่ต้องกรอกให้ครบตามใบ ของมาไม่ครบก็บันทึกเท่าที่มา
            </p>

            <TableWrap>
              <table className="w-full">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>รหัสสินค้า (SKU)</th>
                    <th className={THR} style={{ width: 140 }}>จำนวนที่รับ</th>
                    <th className={TH} style={{ width: 56 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                      <td className={TD}>
                        <input
                          value={l.sku}
                          onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                          placeholder="รหัสสินค้า"
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px]"
                        />
                      </td>
                      <td className={TDR}>
                        <input
                          value={l.qty}
                          onChange={(e) => setLines((v) => v.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                          inputMode="numeric"
                          placeholder="0"
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[13px] text-right"
                        />
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
              <BtnGhost onClick={() => setLines((v) => [...v, { sku: '', qty: '' }])}>+ เพิ่มบรรทัด</BtnGhost>
              <button
                onClick={submit}
                disabled={busy}
                className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-50"
                style={{ background: '#4669e5' }}
              >
                {busy ? 'กำลังบันทึก…' : 'ยืนยันรับเข้าคลัง'}
              </button>
            </div>

            <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
              บันทึกเป็นชนิด <b>โอนเข้า</b> โดยใช้เลขใบ <b>{doc.number}</b> เป็นเลขอ้างอิงอัตโนมัติ ⇒
              กดซ้ำหรือคนอื่นบันทึกใบเดียวกันซ้ำ <b>ของจะไม่เข้าสองรอบ</b>
              (ตาข่ายที่ฐานข้อมูล ไม่ใช่การเช็คก่อนเขียน)
            </p>
          </div>
        </>
      )}

      {/* ── ขั้นที่ 3 ─────────────────────────────────────── */}
      {step === 2 && result && (
        <div className="bg-white border border-gray-200 rounded-md p-6">
          <p className="text-[17px] font-semibold text-emerald-700 mb-1">✓ บันทึกเรียบร้อย</p>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            ส่งไป <b>{fmtNum(result.sent ?? 0)}</b> บรรทัด ·
            บันทึกใหม่ <b>{fmtNum(result.added ?? 0)}</b> ·
            {/* 🔴 ของซ้ำไม่ใช่ความผิดพลาด — ต้องอธิบาย ไม่ใช่โชว์เลขเฉย ๆ ให้คนตกใจ */}
            {' '}เป็นของที่เคยบันทึกไว้แล้ว <b>{fmtNum(result.duplicate ?? 0)}</b>
          </p>
          {!!result.duplicate && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-2.5 leading-relaxed">
              บรรทัดที่ซ้ำ <b>ไม่ได้ทำให้ของเข้าคลังสองรอบ</b> — ระบบกันไว้ให้แล้วจากเลขใบเดียวกัน
              {' '}(ถ้าตั้งใจรับเพิ่มจากใบเดิม เช่นของทยอยมา ต้องบันทึกที่{' '}
              <Link href="/core/moves" className="text-blue-600 hover:underline">หน้าบันทึกของเข้า-ออก</Link>{' '}
              ด้วยเลขอ้างอิงที่ต่างออกไป เช่น เติม -2 ต่อท้าย)
            </p>
          )}
          {Array.isArray(result.bad) && result.bad.length > 0 && (
            <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2.5">
              <b>ไม่ได้บันทึก {result.bad.length} บรรทัด</b>
              {result.bad.map((b, i) => <div key={i}>· {b.sku || '(ไม่มีรหัส)'} — {b.why}</div>)}
            </div>
          )}
          {/* ⚠️ ท่อคืนผลเป็น "ยอดรวมของทั้งชุด" ไม่ใช่รายบรรทัด ⇒ จอห้ามแกล้งโชว์ทีละบรรทัดว่าอันไหนซ้ำ */}
          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ ระบบบอกได้แค่<b>ยอดรวมของทั้งชุด</b> ว่าใหม่กี่บรรทัด ซ้ำกี่บรรทัด —
            บอกไม่ได้ว่าบรรทัดไหนซ้ำ · ดูของจริงได้ที่{' '}
            <Link href="/core/moves" className="text-blue-600 hover:underline">ประวัติของเข้า-ออก</Link>
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { setStep(0); setQ(''); setDoc(null); setLines([{ sku: '', qty: '' }]); setResult(null) }}
              className="text-[13.5px] font-semibold text-white rounded-full px-5 py-2"
              style={{ background: '#4669e5' }}
            >
              รับใบถัดไป
            </button>
            <Link href="/core/moves"
              className="text-[13.5px] font-medium text-gray-700 bg-white border border-gray-300 rounded-full px-5 py-2 hover:bg-gray-50">
              ดูประวัติทั้งหมด
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
