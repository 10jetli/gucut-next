'use client'
// พิมพ์ฉลาก/บาร์โค้ดสินค้า — ปิดคีย์ `product-print` ในทะเบียนหน้า
//
// อ่านจากเส้นที่ฝั่งท่อทำไว้ให้จอนี้โดยเฉพาะ (CEO ยืนยันสัญญาช่อง 14 ก.ย. 2569):
//   GET /api/web/core?productlabels=<sku,sku,...>     (ไม่เกิน 20 รหัสต่อครั้ง)
//   ⇒ { ok, complete, rows:[{ sku, name, barcode, sellprice, unittext, noBarcode }],
//       missing:[sku], failed:[{sku,error}], note }
//
// 🔴 **สี่กองนี้ห้ามยุบเป็น "ไม่มีบาร์โค้ด" อันเดียว** — คนละเรื่องกันทั้งสี่ และตัดสินใจต่างกัน
//    ① rows + barcode        ⇒ พิมพ์ได้เลย ฉลากตรงกับที่ตั้งใน ZORT
//    ② rows + noBarcode      ⇒ **มีสินค้า แต่ไม่ได้ตั้งบาร์โค้ด** ⇒ พิมพ์ได้แต่เป็น "รหัสสินค้า" ไม่ใช่บาร์โค้ด
//    ③ missing[]             ⇒ **ZORT ไม่มีสินค้ารหัสนี้** ⇒ พิมพ์ไปก็สแกนไม่เจออะไร ⇒ ไม่พิมพ์
//    ④ failed[]              ⇒ **ไม่รู้** (ถาม ZORT ไม่สำเร็จ) ⇒ ไม่ใช่ "ไม่มี" ⇒ ไม่พิมพ์ ให้ลองใหม่
//    ⚠️ `ok:true` เกิดขึ้นได้ทั้งที่ `failed` ไม่ว่าง ⇒ **ต้องดู `complete` ก่อนบอกว่าครบ**
//
// 🔴 **ความผิดที่หน้านี้ต้องไม่ทำ: พิมพ์ SKU แล้วเรียกมันว่า "บาร์โค้ดสินค้า"**
//    ฉลากนั้นสแกนออกแน่ ๆ (Code 128 ของ SKU) แต่ถ้าเครื่องอ่านฝั่ง ZORT ค้นจากช่องบาร์โค้ด
//    มันจะหาไม่เจอ ⇒ ได้ฉลากที่ "ดูใช้งานได้แต่ใช้จริงไม่ได้" ซึ่งเป็นโรคประจำของโปรเจกต์นี้
//    ⇒ ฉลากกอง ② จึงพิมพ์คำว่า "รหัสสินค้า" กำกับบนตัวฉลากเอง ไม่ใช่บอกแค่บนจอ
//       (บนจอคนเห็นครั้งเดียว · บนฉลากอยู่กับของไปตลอด)
//
// ⚠️ **กับดักเครื่องพิมพ์: เบราว์เซอร์ย่อ-ขยายหน้าเวลาพิมพ์**
//    ถ้าไม่ตั้งมาตราส่วน 100% ความกว้างแท่งจะเพี้ยน เครื่องอ่านอ่านไม่ออกในฉลากเล็ก
//    ⇒ เขียนเตือนบนจอ (และให้ขอบขาวมาจาก lib ไม่ใช่จาก CSS ที่อาจถูกย่อ)
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageHead, BtnGhost, EndpointMissing } from '@/components/zort'
import LoadingState from '@/components/ui/LoadingState'
import { code128b, code128Svg } from '@/lib/barcode128'
import { looksLikeFallThrough } from '@/lib/api-shape'
import { fmtMoney } from '@/lib/format'

/** ท่อรับได้ 20 รหัสต่อครั้ง ⇒ จอต้องแบ่งยิงเอง ไม่ใช่ตัดรายการทิ้งเงียบ ๆ */
const PER_CALL = 20

interface LabelRow {
  sku: string
  name?: string | null
  barcode?: string | null
  sellprice?: number | null
  unittext?: string | null
  noBarcode?: boolean
}
interface Failed { sku: string; error?: string }
interface Resp {
  ok?: boolean
  complete?: boolean
  rows?: LabelRow[]
  missing?: string[]
  failed?: Failed[]
  note?: string
  error?: string
}

/** ขนาดฉลากที่มีขายจริงเป็นแผ่น — หน่วยมิลลิเมตร (กว้าง × สูง) */
const SIZES = [
  { key: 'l50x25', label: '50 × 25 มม. (ม้วน)', w: 50, h: 25, perSheet: 0 },
  { key: 'l32x19', label: '32 × 19 มม. (ม้วน เล็ก)', w: 32, h: 19, perSheet: 0 },
  { key: 'l38x21', label: '38.1 × 21.2 มม. (A4 แผ่น 65 ดวง)', w: 38.1, h: 21.2, perSheet: 65 },
  { key: 'l70x37', label: '70 × 37 มม. (A4 แผ่น 24 ดวง)', w: 70, h: 37, perSheet: 24 },
] as const

export default function PrintLabelsPage() {
  const qs = useSearchParams()
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<LabelRow[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [failed, setFailed] = useState<Failed[]>([])
  const [complete, setComplete] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [endpointMissing, setEndpointMissing] = useState(false)
  const [asked, setAsked] = useState(false)

  const [size, setSize] = useState<string>('l50x25')
  const [copies, setCopies] = useState('1')
  const [showName, setShowName] = useState(true)
  /* 🔴 **ตำแหน่งเริ่มพิมพ์ในแผ่น** — ZORT มี (`showstartbarcode` · `setbarcodetable`) ของเราไม่มี
     ปัญหาจริงของร้าน: แผ่นฉลาก A4 ที่ใช้ไปบางส่วนแล้ว ถ้าเริ่มพิมพ์ที่ดวงแรกเสมอ
     จะทับช่องที่ลอกไปแล้ว ⇒ **ต้องทิ้งทั้งแผ่น** (65 ดวงต่อแผ่น)
     ⚠️ ฉลากแบบ **ม้วน** ไม่มีเรื่องนี้ (พิมพ์ต่อกันไปเรื่อย ๆ) ⇒ ซ่อนช่องนี้ พร้อมบอกเหตุผล
        โชว์ช่องที่ตั้งแล้วไม่มีผล = ช่องหลอก (กติกาเดิมของโปรเจกต์) */
  const [startAt, setStartAt] = useState(1)
  const [showPrice, setShowPrice] = useState(false)

  const skus = useMemo(
    () => Array.from(new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))),
    [raw],
  )

  const load = useCallback(async (list: string[]) => {
    if (!list.length) return
    setLoading(true); setErr(''); setEndpointMissing(false)
    const accRows: LabelRow[] = []; const accMissing: string[] = []; const accFailed: Failed[] = []
    let allComplete = true; const notes = new Set<string>()
    try {
      /* แบ่งยิงทีละ 20 · ถ้าก้อนไหนล่ม **ต้องนับรหัสในก้อนนั้นเป็น "ไม่รู้" ไม่ใช่ "ไม่มี"** */
      for (let i = 0; i < list.length; i += PER_CALL) {
        const chunk = list.slice(i, i + PER_CALL)
        let r: Resp
        try {
          r = await fetch(`/api/web/core?productlabels=${encodeURIComponent(chunk.join(','))}`)
            .then((x) => x.json())
        } catch (e) {
          allComplete = false
          for (const s of chunk) accFailed.push({ sku: s, error: String(e instanceof Error ? e.message : e) })
          continue
        }
        if (looksLikeFallThrough(r)) { setEndpointMissing(true); return }
        if (r.ok === false && !r.rows?.length) {
          allComplete = false
          for (const s of chunk) accFailed.push({ sku: s, error: r.error ?? 'ท่อตอบว่าไม่สำเร็จ' })
          continue
        }
        accRows.push(...(r.rows ?? []))
        accMissing.push(...(r.missing ?? []))
        accFailed.push(...(r.failed ?? []))
        if (r.complete === false) allComplete = false
        if (r.note) notes.add(r.note)
        /* 🔴 รหัสที่ไม่โผล่ในกองใดเลย = ท่อไม่ได้บอกอะไรเกี่ยวกับมัน ⇒ **ต้องนับเป็น "ไม่รู้"**
           ถ้าปล่อยหาย จอจะแสดง 18 ดวงจาก 20 รหัสโดยไม่มีใครรู้ว่าอีก 2 ไปไหน
           (กฎของโปรเจกต์: ตัวเลขกับรายการต้องมาจากกติกาเดียวกัน) */
        const named = new Set([
          ...(r.rows ?? []).map((x) => x.sku),
          ...(r.missing ?? []),
          ...(r.failed ?? []).map((x) => x.sku),
        ])
        for (const s of chunk) {
          if (!named.has(s)) {
            allComplete = false
            accFailed.push({ sku: s, error: 'ท่อไม่ได้บอกผลของรหัสนี้เลย (ไม่อยู่ในกองไหน)' })
          }
        }
      }
      setRows(accRows); setMissing(accMissing); setFailed(accFailed)
      setComplete(allComplete); setNote(Array.from(notes).join(' · ')); setAsked(true)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [])

  /* มาจากปุ่ม "พิมพ์เอกสาร" ในจอรายละเอียดสินค้า ⇒ ?sku=<รหัส> แล้วโหลดให้เลย */
  useEffect(() => {
    const s = qs.get('sku')
    if (s) { setRaw(s); void load(s.split(/[\s,]+/).filter(Boolean)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sz = SIZES.find((s) => s.key === size) ?? SIZES[0]
  const nCopies = Math.max(1, Math.min(50, Math.floor(Number(copies) || 1)))

  /** ฉลากที่พิมพ์ได้จริง — กอง ① และ ② เท่านั้น · แต่ละใบรู้ว่าตัวเองพิมพ์อะไร */
  const labels = useMemo(() => {
    const out: { row: LabelRow; value: string; isRealBarcode: boolean; error?: string }[] = []
    for (const r of rows) {
      const value = (r.barcode ?? '').trim() !== '' ? String(r.barcode).trim() : r.sku
      const isRealBarcode = (r.barcode ?? '').trim() !== ''
      const enc = code128b(value)
      for (let i = 0; i < nCopies; i++) out.push({ row: r, value, isRealBarcode, error: enc.error })
    }
    return out
  }, [rows, nCopies])

  const unprintable = labels.filter((l) => l.error)
  /* 🔴 **ตัวนับต้องนับจากของที่พิมพ์ได้จริง ไม่ใช่จากจำนวนแถวที่ได้มา** (เจอกับตาเอง 14 ก.ย. 2569)
     รุ่นแรกนับ "พร้อมพิมพ์ 2 รหัส" โดยรวมรหัสที่มีบาร์โค้ดเป็นภาษาไทยซึ่งเข้ารหัสไม่ได้
     ⇒ ตัวเลขข้างบนสัญญามากกว่าฉลากที่ออกมาข้างล่าง — โรคเดียวกับแท็บ "ยกเลิก (44)" กดแล้วได้ 0 แถว
     (กฎของโปรเจกต์: ตัวนับกับรายการต้องมาจากกติกาเดียวกัน) */
  const badValue = (r: LabelRow) => Boolean(code128b(((r.barcode ?? '').trim() || r.sku)).error)
  const withBarcode = rows.filter((r) => (r.barcode ?? '').trim() !== '')
  const noBarcodeCount = rows.length - withBarcode.length
  const readyCount = withBarcode.filter((r) => !badValue(r)).length
  const noBarcodeReady = rows.filter((r) => (r.barcode ?? '').trim() === '' && !badValue(r)).length

  return (
    <div className="p-4 md:p-6">
      {/* ⚠️ CSS พิมพ์: ซ่อนทุกอย่างที่ไม่ใช่แผ่นฉลาก · ขนาดเป็น มม. เพื่อให้ตรงกับกระดาษจริง */}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          .no-print, header, nav, aside { display: none !important; }
          .sheet { display: block !important; }
          @page { margin: 6mm; }
          /* 🔴 ช่องข้ามต้องกินที่แต่ไม่พิมพ์อะไร — ถ้าโชว์ขอบประจะมีเส้นทับฉลากที่ลอกไปแล้ว */
          .skip { border: none !important; background: none !important; }
        }
      `}</style>

      <div className="no-print max-w-[1000px]">
        <PageHead
          title="พิมพ์ฉลาก / บาร์โค้ดสินค้า"
          summary={<>ถามบาร์โค้ดจาก ZORT สด ๆ (productlabels){' | '}
            <span className="text-gray-400">ยิงได้ {PER_CALL} รหัสต่อครั้ง จอแบ่งยิงให้เอง</span></>}
          actions={<BtnGhost onClick={() => window.print()} disabled={!labels.length || labels.length === unprintable.length}>
            🖨️ พิมพ์
          </BtnGhost>}
        />

        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
          ⚠️ <b>ตอนสั่งพิมพ์ ให้ตั้งมาตราส่วนเป็น 100% และปิด “ปรับให้พอดีหน้า”</b> —
          ถ้าเบราว์เซอร์ย่อหน้า ความกว้างแท่งบาร์โค้ดจะเพี้ยนและเครื่องอ่านอ่านไม่ออก
          {' '}ฉลากนี้กำหนดขนาดเป็นมิลลิเมตรไว้แล้ว ไม่ต้องให้เบราว์เซอร์ปรับอีก
        </div>

        <div className="mt-4 bg-white border border-gray-200 rounded-md p-4">
          <label className="block">
            <span className="block text-[11px] font-semibold text-gray-400 mb-1">รหัสสินค้า (คั่นด้วยเว้นวรรคหรือลูกน้ำ)</span>
            <textarea
              className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400 h-20"
              value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder="เช่น 00414 00747 NW-01"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-400 mb-1">ขนาดฉลาก</span>
              <select className="rounded border border-gray-200 px-2 py-1.5 text-[13px]" value={size} onChange={(e) => setSize(e.target.value)}>
                {SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-400 mb-1">กี่ดวงต่อรหัส</span>
              <input className="w-20 rounded border border-gray-200 px-2 py-1.5 text-[13px] text-right"
                value={copies} inputMode="numeric" onChange={(e) => setCopies(e.target.value)} />
            </label>
            {/* 🔴 ตำแหน่งเริ่มพิมพ์ — มีเฉพาะฉลากแบบแผ่น A4 · ม้วนไม่มีเรื่องนี้ */}
            {sz.perSheet > 0 ? (
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-400 mb-1">
                  เริ่มที่ดวงที่ (1–{sz.perSheet})
                </span>
                <input className="w-20 rounded border border-gray-200 px-2 py-1.5 text-[13px] text-right"
                  value={startAt} inputMode="numeric"
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, '')) || 1
                    setStartAt(Math.min(Math.max(1, n), sz.perSheet))
                  }} />
              </label>
            ) : (
              <span className="text-[11.5px] text-gray-400 pb-1.5 max-w-[190px] leading-snug cursor-help"
                title="ฉลากแบบม้วนพิมพ์ต่อกันไปเรื่อย ๆ ไม่มีแผ่นให้ข้ามช่อง — ตั้งไปก็ไม่มีผล จึงไม่มีช่องให้ตั้ง">
                ฉลากม้วนไม่มีตำแหน่งเริ่มพิมพ์
              </span>
            )}
            <label className="flex items-center gap-1.5 text-[12.5px] text-gray-700 pb-1.5">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> ใส่ชื่อสินค้า
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-gray-700 pb-1.5">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> ใส่ราคา
            </label>
            <button onClick={() => void load(skus)} disabled={loading || !skus.length}
              className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: '#4669e5' }}>
              {loading ? 'กำลังถาม ZORT…' : `ถามบาร์โค้ด ${skus.length} รหัส`}
            </button>
          </div>
          {Number(copies) !== nCopies && (
            <p className="text-[12px] text-amber-800 mt-2">ใช้ค่า {nCopies} ดวงต่อรหัส (รับได้ 1–50 เป็นจำนวนเต็ม)</p>
          )}
        </div>

        {endpointMissing && (
          <div className="mt-3">
            <EndpointMissing known={false} what="productlabels"
              effect="ยังพิมพ์ฉลากไม่ได้ — ไม่ใช่ว่ารหัสที่กรอกผิด" />
          </div>
        )}
        {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}
        {loading && <div className="mt-3"><LoadingState /></div>}

        {asked && (
          <div className="mt-4 grid gap-2">
            {/* 🔴 ต้องบอกก่อนทุกอย่างว่า "ที่เห็นนี่ครบหรือไม่ครบ" — ok:true ไม่ได้แปลว่าครบ */}
            {complete === false ? (
              <div className="text-[13px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 leading-relaxed">
                🔴 <b>รายการนี้ยังไม่ครบ</b> — ถาม ZORT ไม่สำเร็จบางรหัส ({failed.length} รหัส)
                {' '}⇒ รหัสในกองนั้นคือ <b>“ยังไม่รู้”</b> ไม่ใช่ “ไม่มีบาร์โค้ด” · <b>อย่าพิมพ์แล้วเชื่อว่าครบ</b> ให้กดถามใหม่
              </div>
            ) : (
              <div className="text-[13px] text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-md px-3.5 py-2.5">
                ✅ ถามครบทุกรหัสที่กรอก ({skus.length} รหัส)
              </div>
            )}

            <div className="text-[12.5px] text-gray-700 bg-white border border-gray-200 rounded-md px-3.5 py-2.5 leading-relaxed">
              พร้อมพิมพ์ <b>{readyCount}</b> รหัส (มีบาร์โค้ดใน ZORT)
              {withBarcode.length !== readyCount
                && <> (อีก {withBarcode.length - readyCount} รหัสมีบาร์โค้ดแต่เข้ารหัสไม่ได้ — ดูข้างล่าง)</>}
              {' '}· <b>{noBarcodeReady}</b> รหัสยังไม่ได้ตั้งบาร์โค้ด (จะพิมพ์เป็นรหัสสินค้าแทน)
              {noBarcodeCount !== noBarcodeReady && <> (อีก {noBarcodeCount - noBarcodeReady} รหัสเข้ารหัสไม่ได้)</>}
              {' '}· <b>{missing.length}</b> รหัสไม่มีใน ZORT
              {' '}· <b>{failed.length}</b> รหัสยังไม่รู้
              {' '}⇒ ได้ฉลากทั้งหมด <b>{labels.length - unprintable.length}</b> ดวง
              {note && <><br /><span className="text-gray-500">หมายเหตุจากท่อ: {note}</span></>}
            </div>

            {noBarcodeCount > 0 && (
              <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 leading-relaxed">
                ⚠️ <b>{noBarcodeCount} รหัสยังไม่ได้ตั้งบาร์โค้ดใน ZORT</b> — ฉลากของรหัสพวกนี้จะเข้ารหัส
                {' '}<b>รหัสสินค้า (SKU)</b> ไม่ใช่บาร์โค้ดสินค้า และบนตัวฉลากจะพิมพ์คำว่า “รหัสสินค้า” กำกับไว้
                <br />
                ⇒ สแกนออกแน่ แต่ <b>ถ้าเครื่องที่ปลายทางค้นจากช่องบาร์โค้ด มันจะหาไม่เจอ</b>
                {' '}อยากให้ใช้ได้ทุกที่ ต้องไปตั้งบาร์โค้ดใน ZORT ก่อน
              </div>
            )}

            {missing.length > 0 && (
              <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 leading-relaxed">
                🔴 <b>ZORT ไม่มีสินค้ารหัสนี้ {missing.length} รหัส</b> — ไม่พิมพ์ให้ เพราะฉลากที่ได้จะสแกนไปเจอความว่าง
                <br /><span className="font-mono text-[11.5px] break-all">{missing.join(' · ')}</span>
              </div>
            )}

            {failed.length > 0 && (
              <div className="text-[12.5px] text-gray-800 bg-gray-50 border border-gray-300 rounded-md px-3.5 py-2.5 leading-relaxed">
                ❔ <b>ยังไม่รู้ {failed.length} รหัส</b> (ถาม ZORT ไม่สำเร็จ) — <b>ไม่ใช่ว่าไม่มี</b> ให้กดถามใหม่
                <br />
                {failed.map((f) => (
                  <span key={f.sku} className="inline-block mr-3">
                    <span className="font-mono text-[11.5px]">{f.sku}</span>
                    <span className="text-gray-500"> — {f.error ?? 'ไม่ได้บอกสาเหตุ'}</span>
                  </span>
                ))}
              </div>
            )}

            {unprintable.length > 0 && (
              <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 leading-relaxed">
                🔴 <b>เข้ารหัสไม่ได้ {unprintable.length} ดวง</b> — ข้ามให้แล้ว ไม่ได้พิมพ์แบบตัดอักษรทิ้ง
                {' '}(ถ้าตัดทิ้งเงียบ ๆ ฉลากจะสแกนได้ค่าที่ไม่มีในระบบ)
                <br />
                {Array.from(new Set(unprintable.map((l) => `${l.value}: ${l.error}`))).map((m) => (
                  <span key={m} className="block text-[11.5px]">{m}</span>
                ))}
              </div>
            )}

            <p className="text-[12px] text-gray-400 leading-relaxed">
              ฉลากสร้างในเครื่องด้วยตัวเข้ารหัส Code 128 ของโปรเจกต์เอง (ไม่ส่งข้อมูลออกไปที่ไหน)
              {' '}· ตารางลายมีตัวตรวจอยู่ใน prebuild กันพิมพ์ผิด เพราะพิมพ์ผิดหลักเดียวจะได้ฉลากที่สแกนออกแต่ได้ค่าผิด
            </p>
          </div>
        )}

        {!asked && !loading && (
          <p className="text-[13px] text-gray-500 mt-4">
            ใส่รหัสสินค้าแล้วกดถามบาร์โค้ด · มาจากจอสินค้าได้เลยด้วยปุ่ม “พิมพ์เอกสาร”
            {' '}(<Link href="/core/stock" className="underline">ไปหน้าสินค้า</Link>)
          </p>
        )}
      </div>

      {/* ── แผ่นฉลาก — โชว์บนจอด้วย เพื่อให้เห็นก่อนพิมพ์ว่าจะได้อะไร ── */}
      {labels.length > unprintable.length && (
        <div className="sheet mt-5" style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
          {/* 🔴 ช่องว่างสำหรับดวงที่ลอกไปแล้ว — ทำให้ฉลากดวงแรกไปเริ่มตรงช่องที่ยังว่างจริง
              ⚠️ ขอบประเห็นเฉพาะบนจอ (คลาส `skip`) ตอนพิมพ์ต้องไม่มีอะไรออกมาเลย
                 ไม่งั้นได้หมึกทับช่องที่ใช้ไปแล้ว */}
          {sz.perSheet > 0 && Array.from({ length: startAt - 1 }, (_, i) => (
            <div key={`skip-${i}`} className="skip" style={{
              width: `${sz.w}mm`, height: `${sz.h}mm`, boxSizing: 'border-box',
              border: '1px dashed #e5e7eb', background: '#fafafa',
            }} />
          ))}
          {labels.filter((l) => !l.error).map((l, i) => {
            const enc = code128b(l.value)
            return (
              <div key={i} style={{
                width: `${sz.w}mm`, height: `${sz.h}mm`,
                border: '1px solid #ddd', boxSizing: 'border-box',
                padding: '1.2mm', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', overflow: 'hidden', background: '#fff',
                breakInside: 'avoid', pageBreakInside: 'avoid',
              }}>
                {showName && (
                  <div style={{ fontSize: '1.9mm', lineHeight: 1.15, maxHeight: '4.4mm', overflow: 'hidden' }}>
                    {l.row.name ?? l.row.sku}
                  </div>
                )}
                <div style={{ flex: 1, minHeight: 0, marginTop: '0.5mm' }}
                  dangerouslySetInnerHTML={{ __html: code128Svg(enc) }} />
                <div style={{ fontSize: '2mm', display: 'flex', justifyContent: 'space-between', gap: '1mm' }}>
                  <span style={{ fontFamily: 'monospace' }}>
                    {/* 🔴 คำกำกับอยู่บน "ตัวฉลาก" ไม่ใช่แค่บนจอ — ฉลากอยู่กับของไปตลอด */}
                    {l.isRealBarcode ? l.value : `รหัสสินค้า ${l.value}`}
                  </span>
                  {showPrice && l.row.sellprice != null && (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {fmtMoney(l.row.sellprice)}{l.row.unittext ? `/${l.row.unittext}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
