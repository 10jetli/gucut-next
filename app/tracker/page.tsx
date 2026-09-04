'use client'
import { useEffect, useMemo, useState } from 'react'
import type { TrackerOrder, TrackerStatus, TrackerImage } from '@/lib/types'

type FilterStatus = 'all' | TrackerStatus

const STATUS_ORDER: TrackerStatus[] = ['pending', 'talking', 'deposit', 'production', 'shipping', 'warehouse', 'done']

const STATUS_LABEL: Record<TrackerStatus, string> = {
  pending: 'ยังไม่มัดจำ',
  talking: 'เริ่มคุยแล้ว',
  deposit: 'มัดจำแล้ว',
  production: 'กำลังผลิต',
  shipping: 'รอขนส่ง',
  warehouse: 'รอเข้าโกดัง',
  done: 'เสร็จสิ้น',
}

const STATUS_FORM_LABEL: Record<TrackerStatus, string> = {
  pending: 'ยังไม่มัดจำ',
  talking: 'เริ่มคุยแล้ว',
  deposit: 'มัดจำแล้ว — รอผลิต',
  production: 'กำลังผลิต',
  shipping: 'รอขนส่ง / อยู่ระหว่างส่ง',
  warehouse: 'รอเข้าโกดัง',
  done: 'เสร็จสิ้น',
}

const STATUS_COLOR: Record<TrackerStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  talking: 'bg-yellow-100 text-yellow-700',
  deposit: 'bg-purple-100 text-purple-700',
  production: 'bg-blue-100 text-blue-700',
  shipping: 'bg-indigo-100 text-indigo-700',
  warehouse: 'bg-teal-100 text-teal-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const EMPTY_FORM = {
  id: undefined as number | undefined,
  product: '',
  factory: '',
  qty: '',
  due: '',
  deposit: '',
  total: '',
  status: 'pending' as TrackerStatus,
  note: '',
  images: [] as TrackerImage[],
}

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TrackerPage() {
  const [orders, setOrders] = useState<TrackerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    fetch('/api/tracker')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error ?? 'โหลดไม่สำเร็จ')
        setOrders(d.orders ?? [])
      })
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const stats = useMemo(() => {
    const ongoing = orders.filter(o => o.status !== 'done').length
    const overdue = orders.filter(o => o.status !== 'done' && o.due && new Date(o.due) < today).length
    const factories = new Set(orders.map(o => o.factory).filter(Boolean)).size
    return { total: orders.length, ongoing, overdue, factories }
  }, [orders])

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    STATUS_ORDER.forEach(s => { c[s] = orders.filter(o => o.status === s).length })
    return c
  }, [orders])

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setShowForm(true) }
  const openEdit = (o: TrackerOrder) => {
    setForm({
      id: o.id,
      product: o.product,
      factory: o.factory,
      qty: String(o.qty || ''),
      due: o.due ? o.due.slice(0, 10) : '',
      deposit: o.deposit,
      total: o.total,
      status: o.status,
      note: o.note,
      images: o.images || [],
    })
    setShowForm(true)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: TrackerImage[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch('/api/tracker/upload', { method: 'POST', body: fd })
        const j = await r.json()
        if (j.ok) uploaded.push({ url: j.url, thumb: j.thumb, name: j.name })
      }
      setForm(f => ({ ...f, images: [...f.images, ...uploaded] }))
    } catch (e) {
      alert('อัพโหลดรูปไม่สำเร็จ: ' + e)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (idx: number) => {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))
  }

  const save = async () => {
    if (!form.product.trim()) { alert('กรอกชื่อสินค้าก่อน'); return }
    setSaving(true)
    try {
      const payload = {
        id: form.id,
        product: form.product,
        factory: form.factory,
        qty: Number(form.qty) || 0,
        due: form.due,
        deposit: form.deposit,
        total: form.total,
        status: form.status,
        note: form.note,
        images: form.images,
      }
      const r = await fetch('/api/tracker', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error ?? 'บันทึกไม่สำเร็จ')
      setShowForm(false)
      load()
    } catch (e: any) {
      alert('บันทึกไม่สำเร็จ: ' + (e.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (o: TrackerOrder) => {
    if (!confirm(`ลบ "${o.product}" ใช่ไหม?`)) return
    const r = await fetch('/api/tracker?id=' + o.id, { method: 'DELETE' })
    const j = await r.json()
    if (j.ok) load()
    else alert('ลบไม่สำเร็จ: ' + (j.error ?? ''))
  }

  const advance = async (o: TrackerOrder) => {
    const idx = STATUS_ORDER.indexOf(o.status)
    /* 🔴 **ปุ่มที่กดแล้วเงียบ = ปุ่มที่คนกดซ้ำแล้วนึกว่าจอพัง** (แก้ 5 ก.ย. 2569)
       เดิม `return` เฉย ๆ ทั้งสองกรณี ⇒ คนกดแล้วไม่มีอะไรเกิดขึ้น และไม่รู้ว่าทำไม
       สองกรณีนี้ยังเป็นคนละเรื่องกันด้วย: ขั้นสุดท้ายแล้ว (ปกติ) กับ สถานะที่จอไม่รู้จัก (ผิดปกติ) */
    if (idx === -1) {
      alert(`เลื่อนขั้นไม่ได้ — จอไม่รู้จักสถานะ "${o.status}"\nน่าจะมีสถานะใหม่ในระบบที่จอยังไม่ได้อัปเดต`)
      return
    }
    if (idx === STATUS_ORDER.length - 1) {
      alert('ใบนี้อยู่ขั้นสุดท้ายแล้ว')
      return
    }
    const next = STATUS_ORDER[idx + 1]
    const r = await fetch('/api/tracker', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, status: next }),
    })
    const j = await r.json()
    if (j.ok) load()
    else alert('อัพเดตไม่สำเร็จ: ' + (j.error ?? ''))
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">ติดตามออเดอร์</h1>
          <p className="text-[11.5px] text-gray-400 mt-0.5">ระบบติดตามบิลสั่งผลิต — เก็บข้อมูลบนเซิร์ฟเวอร์เว็บนี้โดยตรง</p>
        </div>
        <button
          onClick={openAdd}
          className="text-[13px] font-semibold text-white bg-[#17386b] rounded-xl px-4 py-2 hover:opacity-90 transition-opacity shadow-[0_6px_16px_-6px_rgba(23,56,107,0.5)]"
        >
          + เพิ่มบิล
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-4">
          <p className="text-2xl font-black text-gray-900">{stats.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">บิลทั้งหมด</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-2xl font-black text-blue-600">{stats.ongoing}</p>
          <p className="text-[11px] text-blue-500 mt-0.5">กำลังดำเนินการ</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="text-2xl font-black text-red-600">{stats.overdue}</p>
          <p className="text-[11px] text-red-500 mt-0.5">เกินกำหนด</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4">
          <p className="text-2xl font-black text-amber-600">{stats.factories}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">โรงงาน</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          ทั้งหมด ({tabCounts.all})
        </button>
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {STATUS_LABEL[s]} ({tabCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {loading && <p className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</p>}

      {error && (
        <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-600">
          <p className="font-semibold">โหลดไม่ได้</p>
          <p className="text-[11px] mt-1 break-all">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 p-8 text-center text-gray-400 text-sm">ไม่มีรายการ</div>
          )}
          {filtered.map(o => {
            const overdue = o.status !== 'done' && o.due && new Date(o.due) < today
            const idx = STATUS_ORDER.indexOf(o.status)
            const nextLabel = idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_LABEL[STATUS_ORDER[idx + 1]] : null
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 leading-tight">{o.product}</p>
                    {o.factory && <p className="text-[12px] text-gray-500 mt-0.5">🏭 {o.factory}</p>}
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-gray-600">
                  {o.qty ? <span>จำนวน: <strong>{o.qty}</strong></span> : null}
                  {o.deposit ? <span>มัดจำ: <strong className="text-orange-600">{o.deposit}</strong></span> : null}
                  {o.total ? <span>รวม: <strong className="text-gray-900">{o.total}</strong></span> : null}
                </div>

                {o.due && (
                  <p className={`text-[11px] mt-1 ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    📅 กำหนด: {fmtDate(o.due)}{overdue ? ' (เกินกำหนด)' : ''}
                  </p>
                )}

                {o.note && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{o.note}</p>}

                {o.images?.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {o.images.map((img, i) => (
                      <a key={i} href={img.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.thumb} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      </a>
                    ))}
                  </div>
                )}

                {o.updated && <p className="text-[10px] text-gray-300 mt-2">อัพเดต: {fmtDate(o.updated)}</p>}

                <div className="flex gap-2 mt-3 flex-wrap">
                  {nextLabel && (
                    <button onClick={() => advance(o)} className="text-[12.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 hover:bg-emerald-100 transition-colors">
                      → {nextLabel}
                    </button>
                  )}
                  <button onClick={() => openEdit(o)} className="text-[12.5px] font-medium text-blue-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition-colors">
                    แก้ไข
                  </button>
                  <button onClick={() => remove(o)} className="text-[12.5px] font-medium text-red-600 bg-white border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition-colors">
                    ลบ
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-gray-900">{form.id ? 'แก้ไขบิล' : 'เพิ่มบิลใหม่'}</h2>

            <div>
              <label className="text-[12px] font-medium text-gray-600">ชื่อสินค้า *</label>
              <input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="เช่น Gasoline Chainsaw ZMC5803" className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-600">โรงงาน / ซัพพลายเออร์</label>
              <input value={form.factory} onChange={e => setForm(f => ({ ...f, factory: e.target.value }))} placeholder="เช่น Zomax Garden Machinery" className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-gray-600">จำนวน (ชิ้น)</label>
                <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="200" className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600">วันครบกำหนดผลิต</label>
                <input type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-gray-600">มัดจำ</label>
                <input value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} placeholder="41,460" className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600">ยอดรวม</label>
                <input value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} placeholder="138,200" className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-600">สถานะ</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TrackerStatus }))} className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_FORM_LABEL[s]}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-600">หมายเหตุ</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="เลข Invoice, Tracking, รายละเอียดเพิ่มเติม" rows={2} className="w-full mt-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-600">รูปภาพ (Invoice / WeChat)</label>
              <label className="mt-1 flex flex-col items-center justify-center gap-1 border border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-xl">📷</span>
                <span className="text-[12px] text-gray-500">{uploading ? 'กำลังอัพโหลด...' : 'กดเพื่อเลือกรูป (เลือกได้หลายรูป)'}</span>
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={e => handleFiles(e.target.files)} />
              </label>
              {form.images.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumb} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
                      <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center pt-2">
              <button onClick={save} disabled={saving || uploading} className="text-[13px] font-semibold text-white bg-[#17386b] rounded-xl px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_6px_16px_-6px_rgba(23,56,107,0.5)]">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-[13px] text-gray-500 px-3 py-2 hover:text-gray-700 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
