'use client'
// ตัวกลางร่วมของ "ฟอร์มเพิ่มของสั้น ๆ" ที่เขียนทะลุไป ZORT — ท่านประธานสั่งไว้ในใบ t_mu0tx4gd
// ว่า "ทั้งห้าเป็นฟอร์มสั้น รูปแบบเดียวกัน — ทำตัวกลางร่วมแล้วต่อ 5 ทาง"
//
// 🔴 **ที่ต่อได้จริงมีแค่ 2 ทาง ไม่ใช่ 5** (ตรวจ 14 ก.ย. 2569 · CEO ยืนยันกลับมาแล้ว)
//    ✅ สินค้าชุด (addbundle) · คลัง/สาขา (addwarehouse)
//    ❌ หมวดหมู่สินค้า — ZORT ไม่มี API หมวดหมู่ · หมวดใหม่เกิดได้ทางเดียวคือพิมพ์ชื่อหมวด
//       ตอนเพิ่ม/แก้สินค้า ⇒ อยู่ในจอสินค้าแล้ว ไม่ใช่ฟอร์มแยก
//    ❌ หมวดหมู่ผู้ติดต่อ — ยิงตรวจแล้วไม่พบเส้นเลย (ขึ้นทะเบียน ZORT_NO_API)
//    🟢 ผู้ใช้งาน — ทำเสร็จไปแล้วตั้งแต่ 8 ก.ย. ที่ /core/settings-users/add (คนละเรื่องกับผู้ใช้ใน ZORT)
//    ⇒ ตัวกลางนี้ยัง **คุ้มที่จะมี** เพราะเครื่องจักรรอบ ๆ ฟอร์ม (ซ้อม → ผูกลายเซ็น → ส่งจริง)
//       คือส่วนที่ยาวและพลาดง่ายที่สุด และมีฟอร์มรอใช้อีกแน่ (buy-return · ฟอร์มที่ยังไม่เปิดเส้น)
//
// ── สิ่งที่ตัวกลางนี้รับผิดชอบ (ห้ามให้แต่ละจอเขียนซ้ำ เพราะเคยพลาดมาแล้วทุกข้อ) ──
//  1. **เลขอ้างอิงสร้างฝั่งเบราว์เซอร์ใน useEffect** — สร้างตอน render จะ hydration mismatch
//     และปุ่มต้องปิดจนกว่าจะมี ref (`!ref`) ไม่งั้นส่งใบที่ไม่มีตัวกันซ้ำ
//  2. **ผลซ้อมผูกกับ "เนื้อหา" ไม่ใช่ "การกดปุ่ม"** — แก้ตัวเลขหลังซ้อมแล้วปุ่มส่งจริงต้องปิดเอง
//     (ไม่งั้นซ้อมราคา 100 แล้วแก้เป็น 100000 ก่อนกดส่งจริง = ส่งของที่ไม่เคยซ้อม)
//  3. **จับ "คำตอบหน้าแรก"** — ท่อที่ไม่รู้จักพารามิเตอร์ตอบหน้าแรกพร้อม HTTP 200
//     ถ้าไม่จับ จอจะกดแล้วเงียบสนิท คนเข้าใจว่ากรอกผิด (เจอจริงตอนทำจอสร้างรายการขาย)
//  4. **สวิตช์ส่งจริงเป็นค่าคงที่ในไฟล์ของแต่ละจอ** ไม่ใช่ prop ที่คำนวณ — เจ้าของร้านอนุมัติ
//     การเขียนจริงเป็นรายเส้น ไม่ได้อนุมัติทั้งกอง
//  5. **คำเตือน "ลบผ่าน API ไม่ได้" อยู่ใกล้ปุ่ม** ไม่ใช่บนหัวจอที่เลื่อนพ้นตาไปแล้ว
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageHead } from './index'
import { WriteResult, type WriteResp } from './WriteResult'
import { looksLikeFallThrough } from '@/lib/api-shape'

const inp = 'w-full rounded border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400'

export interface FieldSpec {
  /** ชื่อช่องที่จะส่งไปท่อ — **ต้องตรงกับสัญญาช่องที่ฝั่งท่อให้มา ห้ามเดา** */
  k: string
  label: string
  required?: boolean
  ph?: string
  /** ความยาวสูงสุดตามสัญญาช่อง — กันตั้งแต่จอ ดีกว่าปล่อยให้ ZORT ปฏิเสธแล้วคนงง */
  max?: number
  /** `int` = จำนวนเต็ม · `num` = ตัวเลขมีจุดได้ · ค่าเริ่มต้นเป็นข้อความ */
  kind?: 'int' | 'num'
  /** รูปแบบที่ยอมรับ + คำอธิบายเวลาผิด (ต้องมาคู่กัน ไม่งั้นคนไม่รู้ว่าต้องพิมพ์ยังไง) */
  pattern?: RegExp
  patternHint?: string
  /** กินความกว้างทั้งแถว */
  wide?: boolean
  help?: ReactNode
}

export type Vals = Record<string, string>

export interface ShortAddFormProps {
  title: string
  /** บรรทัดใต้ชื่อจอ — เขียนชื่อเส้น ZORT ตรง ๆ ให้คนตามได้ */
  subtitle: ReactNode
  /** พารามิเตอร์ของท่อ เช่น `addbundle` */
  param: string
  /** คำนำหน้าเลขอ้างอิง เช่น `BD` `WH` */
  refPrefix: string
  fields: FieldSpec[]
  /** 🔴 อนุมัติส่งจริงแล้วหรือยัง — ค่าคงที่ในไฟล์ของจอ ไม่ใช่ค่าที่คำนวณ */
  realSendEnabled: boolean
  /** กล่องเตือนใต้หัวจอ (เช่น ลบผ่าน API ไม่ได้ · ช่องที่ ZORT ไม่มี) */
  warnTop?: ReactNode
  /** ส่วนเพิ่มใต้ช่องปกติ เช่นตารางรายการในชุด */
  extra?: ReactNode
  /** ของที่ `extra` จะเติมเข้า body — รวมเข้าลายเซ็นซ้อมด้วยเสมอ */
  extraBody?: Record<string, unknown>
  /** ❗ `extra` ยังกรอกไม่ครบเพราะอะไร — คืนข้อความแล้วปุ่มซ้อมจะไม่ยิง */
  extraError?: string
  /** ข้อความเพิ่มใต้ปุ่ม ตอนที่ปุ่มส่งจริงยังปิด */
  lockedNote?: ReactNode
}

export function ShortAddForm({
  title, subtitle, param, refPrefix, fields, realSendEnabled,
  warnTop, extra, extraBody, extraError, lockedNote,
}: ShortAddFormProps) {
  const [v, setV] = useState<Vals>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<(WriteResp & { willSend?: Record<string, unknown> }) | null>(null)
  const [okDry, setOkDry] = useState('')

  /* ข้อ 1 — เลขอ้างอิงต้องเกิดฝั่งเบราว์เซอร์ ครั้งเดียวต่อการเปิดหน้า */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`${refPrefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [refPrefix])

  const get = (k: string) => (v[k] ?? '').trim()

  /* ข้อ 2 — ลายเซ็นของเนื้อหา · **ต้องรวม extraBody ด้วย**
     ถ้าลืมรวม ตารางรายการในชุดจะแก้ได้หลังซ้อมโดยปุ่มส่งจริงยังเปิดอยู่ */
  const sig = useMemo(
    () => JSON.stringify([fields.map((f) => get(f.k)), extraBody ?? null]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, fields, extraBody],
  )
  const dryOk = okDry !== '' && okDry === sig

  const check = (): string => {
    for (const f of fields) {
      const s = get(f.k)
      if (f.required && s === '') return `ต้องกรอก "${f.label}" (ZORT บังคับ)`
      if (s === '') continue
      if (f.max && s.length > f.max) return `"${f.label}" ยาวเกิน ${f.max} ตัวอักษร (ตอนนี้ ${s.length})`
      if (f.kind && !Number.isFinite(Number(s))) return `"${f.label}" ต้องเป็นตัวเลข`
      if (f.kind === 'int' && !Number.isInteger(Number(s))) return `"${f.label}" ต้องเป็นจำนวนเต็ม`
      if (f.pattern && !f.pattern.test(s)) return `"${f.label}" ${f.patternHint ?? 'รูปแบบไม่ถูกต้อง'}`
    }
    return extraError ?? ''
  }

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    const bad = check()
    if (bad) { setErr(bad); return }
    setBusy(true)
    try {
      const body: Record<string, unknown> = { ref, ...extraBody }
      for (const f of fields) {
        const s = get(f.k)
        if (s === '') continue
        body[f.k] = f.kind ? Number(s) : s
      }
      if (confirm) body.confirm = true
      const r = await fetch(`/api/web/core?${param}=1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((x) => x.json())

      /* ข้อ 3 — คำตอบหน้าแรกพร้อม 200 */
      if (looksLikeFallThrough(r)) {
        setErr(`เส้น ${param} ยังไม่มีบนเซิร์ฟเวอร์ — ท่อตอบ "คำตอบหน้าแรก" กลับมาแทน (ยังไม่ deploy) `
          + '⇒ ยังทดลองส่งไม่ได้ · ไม่ใช่ว่าข้อมูลที่กรอกผิด')
        return
      }
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, ref, sig, extraBody, extraError, fields, param])

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title={title}
        summary={<>{subtitle}{' | '}
          <span className="text-gray-400">เลขอ้างอิง: <b>{ref || '…'}</b> (กันการส่งซ้ำ)</span></>}
      />

      {warnTop && (
        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
          {warnTop}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        {fields.map((f) => (
          <div key={f.k} className={f.wide ? 'md:col-span-3' : ''}>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-400 mb-1">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </span>
              <input
                className={inp}
                value={v[f.k] ?? ''}
                placeholder={f.ph}
                inputMode={f.kind ? 'decimal' : undefined}
                onChange={(e) => setV((o) => ({ ...o, [f.k]: e.target.value }))}
              />
            </label>
            {f.help && <p className="text-[11.5px] text-gray-500 mt-1 leading-snug">{f.help}</p>}
          </div>
        ))}
      </div>

      {extra}

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => send(false)} disabled={busy || !ref}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: '#4669e5' }}>
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !ref || !dryOk || !realSendEnabled}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ background: dryOk && realSendEnabled ? '#c0392b' : '#9aa0a6' }}>
          ส่งเข้า ZORT จริง
        </button>
      </div>

      {!realSendEnabled ? (
        <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
          🔒 <b>ปุ่มส่งจริงปิดอยู่</b> — {lockedNote ?? <>ต้องขออนุมัติการเขียนจริงของเส้นนี้ก่อน
            {' '}ระหว่างนี้ทดลองส่งได้เต็มที่ เห็นทุกช่องที่จะส่งจริง</>}
        </p>
      ) : !dryOk && (
        <p className="text-[12.5px] text-gray-500 mt-2">ต้องทดลองส่งให้ผ่านก่อน · แก้อะไรหลังซ้อม ปุ่มส่งจริงจะปิดเองอีกครั้ง</p>
      )}

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
