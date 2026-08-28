'use client'
// ขอทะเบียนเลื่อยยนต์ (ใบ ลซ.๒) — ฉบับเนื้อเดียว · ท่อ /api/web/permit-doc
import { useCallback, useEffect, useState } from 'react'

interface Doc {
  phone: string; name: string; at: string; stage: string
  saw?: string; province?: string; images: number; updatedAt?: string
}
// ⚠️ ต้องตรงกับ CASE_STAGES ของ gucut-web (src/lib/permit.ts) — ลำดับคือเส้นเรื่อง
const STAGES: { key: string; label: string; by: string }[] = [
  { key: 'printed',   label: 'พิมพ์แบบ ลซ.๑ แล้ว', by: 'ลูกค้า' },
  { key: 'submitted', label: 'ยื่นที่สำนักงานแล้ว', by: 'ลูกค้า' },
  { key: 'gotlz2',    label: 'ได้ใบ ลซ.๒ มาแล้ว', by: 'ลูกค้า' },
  { key: 'lz2',       label: 'ส่งใบ ลซ.๒ ให้ร้านแล้ว', by: 'ลูกค้า' },
  { key: 'got',       label: 'ร้านได้ใบตัวจริงแล้ว', by: 'ร้าน' },
  { key: 'shipped',   label: 'ร้านส่งเลื่อยแล้ว', by: 'ร้าน' },
  { key: 'done',      label: 'ได้ใบ ลซ.๓ ครบแล้ว', by: 'ลูกค้า' },
]
const labelOf = (k: string) => STAGES.find((s) => s.key === k)?.label || 'ยังไม่เริ่ม'
const idxOf = (k: string) => STAGES.findIndex((s) => s.key === k)

export default function WebPermitsPage() {
  const [items, setItems] = useState<Doc[] | null>(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState('')
  const [imgs, setImgs] = useState<string[]>([])
  const [loadingImg, setLoadingImg] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/web/permit-doc')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { setErr('โหลดรายการไม่สำเร็จ'); setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function open(phone: string) {
    if (openId === phone) { setOpenId(''); setImgs([]); return }
    setOpenId(phone); setImgs([]); setLoadingImg(true)
    try {
      const r = await fetch(`/api/web/permit-doc?phone=${encodeURIComponent(phone)}`)
      const d = await r.json().catch(() => null)
      setImgs(Array.isArray(d?.imageData) ? d.imageData : [])
    } catch { setErr('เปิดรูปไม่สำเร็จ') }
    finally { setLoadingImg(false) }
  }

  async function setStage(phone: string, stage: string) {
    setErr('')
    const r = await fetch('/api/web/permit-doc', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, stage }),
    }).catch(() => null)
    if (!r?.ok) { setErr('เปลี่ยนขั้นไม่สำเร็จ'); return }
    setItems((cur) => (cur ?? []).map((x) => (x.phone === phone ? { ...x, stage } : x)))
  }

  const waiting = (items ?? []).filter((x) => x.stage === 'lz2').length

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">
          ขอทะเบียนเลื่อยยนต์
          {waiting > 0 && <span className="ml-2 align-middle rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-black text-white">{waiting} รอร้านรับใบ</span>}
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">รูปใช้แทนตัวจริงไม่ได้ — ต้องได้ ลซ.๒ ตอนกลางตัวจริงมาเก็บเป็นหลักฐานการจำหน่าย</p>
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
        {items === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-50" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-gray-400">ยังไม่มีลูกค้าทำเรื่องเข้ามา</p>
        ) : items.map((d) => {
          const open_ = openId === d.phone
          const idx = idxOf(d.stage)
          return (
            <div key={d.phone} className={open_ ? 'bg-blue-50/30' : ''}>
              <button onClick={() => open(d.phone)} className="w-full flex items-center gap-3.5 px-4 md:px-5 py-3.5 text-left hover:bg-gray-50/70 transition-colors">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-[13px] font-black flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
                  {(d.name || '?').charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-gray-900">{d.name || d.phone}</span>
                  <span className="block text-[11.5px] text-gray-400 truncate">
                    {d.phone}{d.saw ? ` · ${d.saw}` : ''}{d.province ? ` · ยื่นที่ ${d.province}` : ''}{d.images ? ` · รูป ${d.images} ใบ` : ''}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${d.stage === 'lz2' ? 'bg-orange-50 text-orange-600' : d.stage === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {labelOf(d.stage)}
                </span>
              </button>
              {open_ && (
                <div className="px-4 md:px-5 pb-5 space-y-3">
                  {/* เส้นเรื่อง */}
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s, i) => (
                      <span key={s.key} className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${i <= idx ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-300'}`}>
                        {i + 1}. {s.label}
                      </span>
                    ))}
                  </div>
                  {/* รูปใบ ลซ.๒ */}
                  {d.images > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {loadingImg ? (
                        <div className="h-40 w-28 rounded-xl bg-gray-100 animate-pulse" />
                      ) : imgs.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt={`ใบ ลซ.๒ (${i + 1})`} className="max-h-56 rounded-xl border border-gray-200 shadow-sm" />
                      ))}
                    </div>
                  )}
                  {/* ปุ่มขั้นของร้าน */}
                  <div className="flex flex-wrap gap-2">
                    {d.stage === 'lz2' && (
                      <button onClick={() => setStage(d.phone, 'got')}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]">
                        ✓ ร้านได้ใบตัวจริงแล้ว
                      </button>
                    )}
                    {d.stage === 'got' && (
                      <button onClick={() => setStage(d.phone, 'shipped')}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]">
                        🚚 ร้านส่งเลื่อยแล้ว
                      </button>
                    )}
                    <a href={`tel:${d.phone}`} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50">โทรหาลูกค้า</a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/permits/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
