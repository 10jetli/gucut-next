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
// 🔴 **หาใบสองทาง และต้องบอกว่าได้มาจากทางไหน**
//    ① `?transfer=` ดึงสดจาก ZORT — ได้บรรทัดสินค้า + เลขพัสดุ ⇒ เติมรายการให้ล่วงหน้าได้
//    ② ถ้าดึงสดไม่ได้ ถอยไปหาในกระจก (`list=transfers`) — **มีแต่หัวใบ ไม่มีบรรทัดสินค้า**
//    ⚠️ **ต้องเขียนบนจอว่าใบนี้มาจากทางไหน** ไม่งั้นคนจะงงว่าทำไมบางใบมีรายการมาให้ บางใบไม่มี
//       แล้วสรุปว่าระบบพัง ทั้งที่เป็นคนละแหล่งข้อมูล
//
// ⚠️ **`lines: null` ≠ `lines: []`** — null คือ ZORT ไม่ได้ส่งช่องบรรทัดสินค้ามาเลย
//    ส่วน [] คือส่งช่องมาแต่ใบนี้ไม่มีของ ⇒ เขียนคนละคำ (ฝั่งท่อกำชับ)
//
// ⚠️ **ค้นด้วยเลขพัสดุยังไม่ยืนยัน** — ZORT จอจริงค้นได้ แต่เส้น `?transfer=` ส่ง id ไปตรง ๆ
//    ยังไม่มีใครยิงของจริงว่ามันรับเลขพัสดุด้วยไหม ⇒ **ห้ามเขียนบนจอว่าค้นได้**
//    ให้ลองแล้วถ้าไม่เจอค่อยบอกว่าเป็นไปได้สามอย่าง (พิมพ์ผิด/เป็นเลขพัสดุ/ใบยังไม่เข้ากระจก)
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, Pill, thaiDate } from '@/components/zort'

interface Doc {
  id?: string; number?: string; kind?: string; status?: string
  from_wh?: string; to_wh?: string; transfer_date?: string; reference?: string; note?: string
}
/** รายละเอียดใบโอนที่ดึงสดจาก ZORT (`?transfer=`) — มีบรรทัดสินค้ากับเลขพัสดุด้วย
 *  ⚠️ `lines: null` = **ZORT ไม่ได้ส่งช่องบรรทัดสินค้ามาเลย**
 *     `lines: []`   = ส่งช่องมาแต่ใบนี้ไม่มีของ
 *     สองอย่างนี้ต้องเขียนคนละคำ (ฝั่งท่อกำชับ · คลาสสามสถานะเดิม) */
interface Detail {
  live?: boolean; number?: string; status?: string; date?: string
  from?: string; to?: string; tracking?: string
  lines?: { sku?: string; name?: string; qty?: number }[] | null
  fields?: string[]
  error?: string
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
  /** ใบที่ดึงสดจาก ZORT — null = ไม่ได้/ยังไม่มี ⇒ ตกไปใช้ข้อมูลจากกระจกแทน */
  const [detail, setDetail] = useState<Detail | null>(null)
  /** ข้อมูลใบมาจากไหน — **ต้องบอกคนใช้** ของสดกับกระจกให้รายละเอียดไม่เท่ากัน */
  const [src, setSrc] = useState<'live' | 'mirror' | null>(null)
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /** ค้นแล้วไม่เจอ — **คนละสถานะกับค้นไม่สำเร็จ** (ต้องเขียนคนละคำ) */
  const [notFound, setNotFound] = useState(false)
  const [result, setResult] = useState<MoveResp | null>(null)

  const find = useCallback(async () => {
    const term = q.trim()
    if (!term) return
    setBusy(true); setErr(''); setNotFound(false); setDetail(null); setSrc(null)
    try {
      /* ① ลองดึงสดจาก ZORT ก่อน — ได้บรรทัดสินค้ากับเลขพัสดุมาด้วย
         ⚠️ ดึงสดสำคัญตรงนี้จริง ๆ เพราะคนกำลังยืนอยู่หน้าคลังกับของตรงหน้า
            กระจกซิงก์ทุกครึ่งชั่วโมง = ใบที่เพิ่งเปิดจะยังไม่มี */
      const d: Detail = await fetch(`/api/web/core?transfer=${encodeURIComponent(term)}`)
        .then((x) => x.json()).catch(() => ({ error: 'เรียกไม่สำเร็จ' }))
      if (d && !d.error && d.number) {
        setDetail(d); setSrc('live')
        setDoc({ number: d.number, status: d.status, from_wh: d.from, to_wh: d.to, transfer_date: d.date })
        /* ⚠️ เติมบรรทัดให้เฉพาะตอนมีของจริง — `[]` กับ `null` ห้ามเติมมั่ว
           และ **ยังแก้ได้ทุกช่อง** เพราะของที่มาจริงอาจไม่ตรงใบ (มาไม่ครบ/ของเสีย) */
        if (Array.isArray(d.lines) && d.lines.length) {
          setLines(d.lines.map((l) => ({ sku: String(l.sku ?? ''), qty: String(l.qty ?? '') })))
        } else {
          setLines([{ sku: '', qty: '' }])
        }
        setStep(1)
        return
      }
      /* ② ดึงสดไม่ได้ ⇒ ถอยไปหาในกระจก — **ต้องบอกว่านี่คือของจากกระจก**
         ไม่งั้นคนจะงงว่าทำไมบางใบมีรายการสินค้ามาให้ บางใบไม่มี */
      const r = await fetch(`/api/web/core?list=transfers&limit=5&q=${encodeURIComponent(term)}`)
        .then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      const rows: Doc[] = Array.isArray(r?.rows) ? r.rows : []
      if (!rows.length) { setNotFound(true); setDoc(null); return }
      /* ⚠️ เลขที่ใบใน ZORT **ซ้ำกันได้จริง** (ฝั่งท่อเจอ 546 เลขซ้ำ) ⇒ ค้นแล้วอาจได้หลายใบ
         เลือกใบล่าสุดให้ก่อน แต่ต้องโชว์ให้เห็นว่ามีหลายใบ ไม่ใช่เลือกเงียบ ๆ */
      setDoc(rows[0]); setSrc('mirror'); setLines([{ sku: '', qty: '' }])
      setStep(1)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setDoc(null)
    } finally { setBusy(false) }
  }, [q])

  const submit = useCallback(async () => {
    if (!doc?.number) return
    /* 🔴 **จำนวนต้องเป็นบวกเท่านั้นในจอนี้**
       ท่อรับเลขติดลบได้ (ใช้กับ transfer_out/damage) ⇒ ถ้าปล่อยผ่าน คนพิมพ์ "-5" ในจอ "รับเข้า"
       จะกลายเป็น **ตัดสต็อกออก** โดยบันทึกว่าเป็นการโอนเข้า ⇒ คลังเพี้ยนแบบมีหลักฐานสวยงาม
       และไม่มีอะไรฟ้อง เพราะทุกอย่าง "สำเร็จ" ตามปกติ
       ⚠️ ต้องบอกด้วยว่าบรรทัดไหนผิด ไม่ใช่เงียบแล้วข้ามทิ้ง (ข้ามเงียบ = ของเข้าไม่ครบโดยไม่มีใครรู้) */
    const bad = lines.filter((l) => l.sku.trim() && !(Number(l.qty) > 0))
    if (bad.length) {
      setErr(`จำนวนต้องเป็นตัวเลขมากกว่า 0 — ตรวจบรรทัดของ ${bad.map((b) => b.sku.trim()).join(', ')}`)
      return
    }
    const moves = lines
      .map((l) => ({ sku: l.sku.trim(), qty: Number(l.qty), reason: 'transfer_in', ref: doc.number!.trim() }))
      .filter((m) => m.sku && m.qty > 0)
    if (!moves.length) { setErr('ยังไม่ได้กรอกรายการที่รับเข้า'); return }
    /* ⚠️ SKU ซ้ำในชุดเดียวกัน = ตาข่าย UNIQUE(reason,ref,sku) จะกลืนใบที่สอง
       ⇒ ของเข้าน้อยกว่าที่กรอก **โดยจอขึ้นว่าสำเร็จ** ⇒ ต้องจับตั้งแต่ก่อนส่ง */
    const dup = moves.map((m) => m.sku).filter((v, i, a) => a.indexOf(v) !== i)
    if (dup.length) {
      // ⚠️ Array.from แทน spread ของ Set — target ของโปรเจกต์นี้ spread Set ไม่ได้ (TS2802)
      setErr(`รหัสสินค้าซ้ำกันในใบเดียว: ${Array.from(new Set(dup)).join(', ')} — รวมเป็นบรรทัดเดียวก่อน `
        + '(ระบบกันซ้ำที่ระดับ รหัส+เลขใบ ⇒ บรรทัดหลังจะถูกกลืน แล้วของเข้าน้อยกว่าที่กรอก)')
      return
    }
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
          <p className="text-[11.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 mt-2.5 inline-block leading-relaxed">
            หาให้สองทาง: <b>ถาม ZORT สดก่อน</b> (ได้รายการสินค้ากับเลขพัสดุมาด้วย)
            {' '}ไม่ได้ค่อยหาในคลังเงา ·
            {' '}<b>เลขพัสดุยังไม่ยืนยันว่าค้นได้</b> ZORT จอจริงค้นได้แต่เรายังไม่เคยยิงทดสอบ
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
              ค้นสองทางแล้วทั้งคู่: ดึงสดจาก ZORT และหาในคลังเงา
              <br />
              เป็นไปได้: พิมพ์ผิด · เป็นเลขพัสดุ (<b>ยังไม่ยืนยันว่าค้นด้วยเลขพัสดุได้ไหม</b>) ·
              ใบยังไม่ถูกดูดเข้าคลังเงาและ ZORT ก็ตอบไม่ได้
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
            {/* 🔴 บอกแหล่งข้อมูลเสมอ — ของสดกับกระจกให้รายละเอียดไม่เท่ากัน
                คนต้องรู้ว่าที่ไม่มีรายการสินค้ามาให้ เป็นเพราะอะไร */}
            <p className="text-[11.5px] mt-2">
              {src === 'live'
                ? <span className="text-emerald-700">● อ่านสดจาก ZORT เมื่อครู่</span>
                : <span className="text-amber-700">
                    ● อ่านจาก<b>คลังเงา</b> (ดึงสดจาก ZORT ไม่ได้) — มีแต่หัวใบ
                    {' '}ไม่มีรายการสินค้าและเลขพัสดุ · ข้อมูลอาจเก่าได้ถึงครึ่งชั่วโมง
                  </span>}
              {detail?.tracking && (
                <span className="text-gray-600"> · เลขพัสดุ <b>{detail.tracking}</b></span>
              )}
            </p>
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
            {/* 🔴 สามข้อความ สามสถานะจริง — ห้ามยุบรวม
                ① เติมมาให้แล้วจากใบ ② ใบนี้ไม่มีของ ③ ไม่มีช่องบรรทัดสินค้ามาให้เลย */}
            {src === 'live' && Array.isArray(detail?.lines) && detail!.lines!.length > 0 && (
              <p className="text-[11.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 mb-3 leading-relaxed">
                ✓ เติมรายการจากใบโอนให้แล้ว <b>{fmtNum(detail!.lines!.length)} บรรทัด</b> —
                {' '}<b>แก้ได้ทุกช่อง</b> ของที่มาถึงจริงอาจไม่ตรงใบ (มาไม่ครบ · ของเสีย · มาเกิน)
                {' '}<b>บันทึกตามของที่นับได้จริง ไม่ใช่ตามใบ</b>
              </p>
            )}
            {src === 'live' && Array.isArray(detail?.lines) && detail!.lines!.length === 0 && (
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3 leading-relaxed">
                ⚠️ <b>ใบนี้ไม่มีรายการสินค้าใน ZORT</b> (ไม่ใช่ระบบอ่านไม่ได้) — ถ้ามีของมาถึงจริง
                {' '}ให้พิมพ์เอง แล้วไปดูที่ ZORT ว่าใบถูกต้องไหม
              </p>
            )}
            {src === 'live' && detail?.lines === null && (
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3 leading-relaxed">
                ⚠️ <b>ZORT ไม่ได้ส่งรายการสินค้ามากับใบนี้</b> — คนละเรื่องกับ &ldquo;ใบนี้ไม่มีของ&rdquo;
                {' '}⇒ ต้องพิมพ์รหัสสินค้าเอง
                {Array.isArray(detail?.fields) && detail!.fields!.length > 0 && (
                  <> · ช่องที่ ZORT ส่งมาจริง: <span className="font-mono">{detail!.fields!.join(', ')}</span></>
                )}
              </p>
            )}
            {src === 'mirror' && (
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3 leading-relaxed">
                ⚠️ <b>เติมรายการให้ล่วงหน้าไม่ได้</b> — ใบนี้อ่านจากคลังเงาซึ่งเก็บแต่หัวใบ
                {' '}⇒ ต้องพิมพ์รหัสสินค้าเอง · <b>กรอกเท่าที่รับได้จริง</b>
              </p>
            )}

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
          {/* 🔴 **ท่อไม่บอกจำนวน ≠ บันทึกได้ศูนย์บรรทัด** — เดิมเขียน `?? 0`
              ⇒ ถ้าท่อตอบสำเร็จแต่ไม่ส่งเลขมา จอจะขึ้น "✓ บันทึกเรียบร้อย · บันทึกใหม่ 0"
              ซึ่งอ่านแล้วขัดกันเอง และคนจะไปกรอกซ้ำเพราะคิดว่าไม่เข้า
              ⇒ ไม่รู้ต้องเขียนว่าไม่รู้ พร้อมบอกว่าไปดูของจริงได้ที่ไหน */}
          {typeof result.added === 'number' ? (
            <p className="text-[13px] text-gray-700 leading-relaxed">
              ส่งไป <b>{fmtNum(result.sent ?? 0)}</b> บรรทัด ·
              บันทึกใหม่ <b>{fmtNum(result.added)}</b> ·
              {/* 🔴 ของซ้ำไม่ใช่ความผิดพลาด — ต้องอธิบาย ไม่ใช่โชว์เลขเฉย ๆ ให้คนตกใจ */}
              {' '}เป็นของที่เคยบันทึกไว้แล้ว <b>{fmtNum(result.duplicate ?? 0)}</b>
            </p>
          ) : (
            <p className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 leading-relaxed">
              ⚠️ ท่อรับเรื่องแล้วแต่ <b>ไม่ได้บอกจำนวนบรรทัดที่บันทึก</b> —
              {' '}<b>ยังไม่ต้องกรอกซ้ำ</b> ให้เปิด{' '}
              <Link href="/core/moves" className="text-blue-600 hover:underline">หน้าบันทึกของเข้า-ออก</Link>{' '}
              ดูว่าเข้าครบไหมก่อน{doc?.number ? <> (เลขใบ <b>{doc.number}</b>)</> : null}
            </p>
          )}
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
