'use client'
// สินค้า → แก้ไขสินค้า → อัปรูปสินค้า (soon: product-image) — งานกระดาน t_mu108yr3 · รับจาก gucut2 (t_mu0tx52v)
//
// ท่อ (gucut-web netlify/functions/core.mjs · ขึ้นระบบแล้ว 14 ก.ย. 2569):
//   POST /api/core?productimage=1  ขาเข้าจากจอ: {ref, id (ของ ZORT), sku, image: base64 หรือ data URL ≤4MB, confirm?}
//   ⇒ ขาออกไป ZORT: Product/UpdateProductImage?id=<id> แบบ multipart (ท่อแปลงเอง)
//
// 🔴 ปุ่มส่งจริงปิด (realSendEnabled จากจอแม่) — รอท่านประธานอนุมัติจอนี้
// ⚠️ **ยังไม่รู้ว่า ZORT แทนรูปเดิมหรือต่อท้าย** (ยังไม่เคยยิงจริง — ตรวจ 14 ก.ย. 2569 ปุ่มส่งจริงยังปิด)
//    ⇒ เขียนบอกบนจอ ห้ามเขียนว่า "เปลี่ยนรูป"
// ⚠️ ท่อตรวจชนิดจาก**เนื้อไฟล์** (JPEG/PNG/WebP) ไม่เชื่อนามสกุล — จอตรวจก่อนแค่ให้คนรู้เร็ว ไม่ใช่ด่านจริง
// ⚠️ ผลทดลองผูกกับไฟล์ที่เลือก — เปลี่ยนไฟล์แล้วต้องทดลองใหม่ (กันทดลองไฟล์ A แล้วส่งจริงไฟล์ B)
import { useCallback, useEffect, useRef, useState } from 'react'
import { WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'

const MAX_BYTES = 4 * 1024 * 1024
const MIN_BYTES = 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ProductImageBox({ id, sku, imagepath, realSendEnabled }: {
  id: number; sku: string; imagepath: string | null; realSendEnabled: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`PIMG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])
  const [data, setData] = useState('')          // data URL ของไฟล์ที่เลือก
  const [info, setInfo] = useState<{ name: string; bytes: number } | null>(null)
  const [pickErr, setPickErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<WriteResp | null>(null)
  const [dryFor, setDryFor] = useState('')      // ทดลองผ่านกับไฟล์ไหน (data URL) — เปลี่ยนไฟล์ = ต้องทดลองใหม่
  const dryOk = dryFor !== '' && dryFor === data

  const pick = useCallback((file: File | undefined) => {
    setPickErr(''); setRes(null); setDryFor(''); setData(''); setInfo(null)
    if (!file) return
    if (!TYPES.includes(file.type)) { setPickErr('รับเฉพาะรูป JPEG · PNG · WebP'); return }
    if (file.size > MAX_BYTES) { setPickErr(`รูปใหญ่เกิน 4MB (${(file.size / 1024 / 1024).toFixed(1)}MB) — ย่อก่อนส่ง`); return }
    if (file.size < MIN_BYTES) { setPickErr('ไฟล์เล็กผิดปกติ (<1KB) — ไม่น่าใช่รูปสินค้าจริง'); return }
    const reader = new FileReader()
    reader.onload = () => { setData(String(reader.result ?? '')); setInfo({ name: file.name, bytes: file.size }) }
    reader.onerror = () => setPickErr('อ่านไฟล์ไม่สำเร็จ')
    reader.readAsDataURL(file)
  }, [])

  const send = useCallback(async (confirm: boolean) => {
    if (!data || !ref) return
    setBusy(true); setRes(null)
    try {
      const r = await fetch('/api/web/core?productimage=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref, id, sku, image: data, ...(confirm ? { confirm: true } : {}) }),
      })
      const j = await r.json().catch(() => null)
      /* สามสถานะ: ท่อตอบอ่านไม่ออก ≠ ไม่ผ่าน — บอกตรง ๆ ว่าไม่รู้ผล */
      const out: WriteResp = j ?? ({ ok: false, error: `ท่อตอบอ่านไม่ออก (HTTP ${r.status}${r.status === 413 ? ' — รูปใหญ่เกินที่ท่อรับได้ ลองย่อรูป' : ''}) — ยังไม่รู้ผล` } as WriteResp)
      setRes(out)
      if (!confirm && j?.dryRun && j?.ok !== false) setDryFor(data)
      if (confirm && j?.ok) setDryFor('')
    } catch (e) {
      setRes({ ok: false, error: `ส่งไม่สำเร็จ — ${String(e instanceof Error ? e.message : e)} (ยังไม่รู้ผล)` } as WriteResp)
    } finally { setBusy(false) }
  }, [data, ref, id, sku])

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-md p-4">
      <div className="text-[14px] font-semibold text-gray-900">🖼️ รูปสินค้า</div>
      <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 mt-2 leading-relaxed">
        ⚠️ <b>ยังไม่รู้ว่า ZORT จะแทนรูปเดิมหรือเพิ่มต่อท้าย</b> (ยังไม่เคยส่งจริง) · รับ JPEG/PNG/WebP ไม่เกิน 4MB
      </p>
      <div className="flex flex-wrap gap-4 mt-3">
        <div>
          <div className="text-[11.5px] text-gray-500 mb-1">รูปใน ZORT ตอนนี้</div>
          {imagepath
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imagepath} alt={`รูปปัจจุบัน ${sku}`} className="w-32 h-32 object-contain border border-gray-200 rounded bg-gray-50" />
            : <div className="w-32 h-32 flex items-center justify-center text-[11.5px] text-gray-400 border border-dashed border-gray-300 rounded text-center px-2">ZORT ไม่ได้ส่งที่อยู่รูปมา</div>}
        </div>
        <div>
          <div className="text-[11.5px] text-gray-500 mb-1">รูปที่จะส่ง</div>
          {data
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={data} alt="รูปที่เลือก" className="w-32 h-32 object-contain border border-gray-200 rounded bg-gray-50" />
            : <div className="w-32 h-32 flex items-center justify-center text-[11.5px] text-gray-400 border border-dashed border-gray-300 rounded">ยังไม่ได้เลือก</div>}
          {info && <div className="text-[11.5px] text-gray-500 mt-1 max-w-[160px] truncate">{info.name} · {(info.bytes / 1024).toFixed(0)}KB</div>}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {pickErr && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2 mt-3">{pickErr}</div>}
      <WriteResult r={res} />

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="text-[13px] text-gray-700 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 disabled:opacity-50">
          📂 เลือกรูป
        </button>
        <button onClick={() => send(false)} disabled={busy || !data || !ref}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่งรูป (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !dryOk || !realSendEnabled}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: dryOk && realSendEnabled ? '#c0392b' : '#9aa0a6' }}>
          ส่งรูปเข้า ZORT
        </button>
        {!realSendEnabled
          ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้ส่งจริง</b> — รอท่านประธานอนุมัติจอนี้</span>
          : data && !dryOk && <span className="text-[12.5px] text-gray-500">ต้องกดทดลองส่งรูปนี้ให้ผ่านก่อน</span>}
      </div>
    </div>
  )
}
