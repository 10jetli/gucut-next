'use client'
// โค้ดส่วนลดเว็บ — ฉบับเนื้อเดียวในหลังร้านหลัก
// รายการโค้ดเรียงลงมา + ฟอร์มสร้าง/แก้ในแผงพับ — ท่อ /api/web/coupon
import { useCallback, useEffect, useState } from 'react'

interface Coupon {
  code: string; title: string; type: 'amount' | 'percent'
  value: number; max: number; min: number; until: string
  quota: number; perUser: number; visible: boolean; memberOnly: boolean; off: boolean
  used?: number; fromEnv?: boolean
}
const EMPTY: Coupon = { code: '', title: '', type: 'amount', value: 0, max: 0, min: 0, until: '', quota: 0, perUser: 1, visible: true, memberOnly: false, off: false }

function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const IC = {
  tag: 'M4 12.5V5a1 1 0 011-1h7.5L21 12.5 12.5 21 4 12.5zM8.5 8.5h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
}
const label = (c: Coupon) =>
  c.type === 'percent' ? `ลด ${c.value}%${c.max ? ` (สูงสุด ฿${c.max.toLocaleString('th-TH')})` : ''}` : `ลด ฿${c.value.toLocaleString('th-TH')}`

export default function WebCouponsPage() {
  const [list, setList] = useState<Coupon[] | null>(null)
  const [form, setForm] = useState<Coupon | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/web/coupon?all=1')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setList(Array.isArray(d.coupons) ? d.coupons : [])
    } catch { setMsg('โหลดรายการไม่สำเร็จ'); setList((l) => l ?? []) }
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!form?.code.trim()) { setMsg('ตั้งชื่อโค้ดก่อน'); return }
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/web/coupon', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'save', coupon: form }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error)
      setForm(null); load()
    } catch (e) { setMsg(String((e as Error).message || 'บันทึกไม่สำเร็จ')) }
    finally { setBusy(false) }
  }
  async function remove(code: string) {
    if (!confirm(`ลบโค้ด ${code}?`)) return
    await fetch('/api/web/coupon', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', code }),
    }).catch(() => {})
    load()
  }

  const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (
    <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">{l}</span>{children}</label>
  )
  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100'

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">โค้ดส่วนลด</h1>
        </div>
        <button onClick={() => setForm(form ? null : { ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] transition-all hover:bg-gray-800 active:scale-[0.98]">
          <I d={IC.plus} className="w-3.5 h-3.5" /> สร้างโค้ดใหม่
        </button>
      </div>
      {msg && <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">{msg}</p>}

      {form && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(37,99,235,0.25)] p-4 md:p-5 space-y-3">
          <p className="text-[13px] font-black text-gray-900">{form.code && list?.some((c) => c.code === form.code) ? `แก้โค้ด ${form.code}` : 'สร้างโค้ดใหม่'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field l="ชื่อโค้ด (ลูกค้าพิมพ์)"><input className={inputCls + ' uppercase'} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GUCUT50" /></Field>
            <Field l="คำโปรย (โชว์ลูกค้า)"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ลดต้อนรับ" /></Field>
            <Field l="ชนิด">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Coupon['type'] })}>
                <option value="amount">ลดเป็นบาท</option><option value="percent">ลดเป็น %</option>
              </select>
            </Field>
            <Field l={form.type === 'percent' ? 'ลดกี่ %' : 'ลดกี่บาท'}><input type="number" className={inputCls} value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
            {form.type === 'percent' && <Field l="ลดสูงสุด (บาท)"><input type="number" className={inputCls} value={form.max || ''} onChange={(e) => setForm({ ...form, max: Number(e.target.value) })} /></Field>}
            <Field l="ยอดซื้อขั้นต่ำ"><input type="number" className={inputCls} value={form.min || ''} onChange={(e) => setForm({ ...form, min: Number(e.target.value) })} /></Field>
            <Field l="โควตารวม (0=ไม่จำกัด)"><input type="number" className={inputCls} value={form.quota || ''} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} /></Field>
            <Field l="ใช้ได้คนละ (ครั้ง)"><input type="number" className={inputCls} value={form.perUser || ''} onChange={(e) => setForm({ ...form, perUser: Number(e.target.value) })} /></Field>
            <Field l="หมดอายุ"><input type="date" className={inputCls} value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-gray-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} className="w-4 h-4 accent-blue-600" /> โชว์ให้กดเก็บบนเว็บ</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.memberOnly} onChange={(e) => setForm({ ...form, memberOnly: e.target.checked })} className="w-4 h-4 accent-blue-600" /> เฉพาะสมาชิก</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.off} onChange={(e) => setForm({ ...form, off: e.target.checked })} className="w-4 h-4 accent-blue-600" /> ปิดใช้งานชั่วคราว</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="rounded-xl bg-blue-600 px-5 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(37,99,235,0.7)] hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'กำลังบันทึก…' : 'บันทึกโค้ด'}
            </button>
            <button onClick={() => setForm(null)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-50">ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
        {list === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-50" />)}</div>
        ) : list.length === 0 ? (
          <div className="py-14 text-center">
            <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3"><I d={IC.tag} className="w-6 h-6" /></span>
            <p className="text-[13px] text-gray-400">ยังไม่มีโค้ด — กด &ldquo;สร้างโค้ดใหม่&rdquo; ได้เลย</p>
          </div>
        ) : list.map((c) => {
          const expired = c.until && Date.parse(c.until) < Date.now()
          return (
            <div key={c.code} className="group flex items-center gap-3.5 px-4 md:px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
              <span className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.off || expired ? 'from-gray-300 to-gray-400' : 'from-amber-400 to-orange-500'} text-white flex items-center justify-center shrink-0 shadow-[0_8px_16px_-8px_rgba(15,23,42,0.4)] ring-2 ring-white`}>
                <I d={IC.tag} className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[14px] font-black text-gray-900 tracking-wide">{c.code}</span>
                  {c.fromEnv && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-bold text-gray-400">โค้ดลับ (env)</span>}
                  {c.off && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-bold text-gray-400">ปิดอยู่</span>}
                  {expired && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9.5px] font-bold text-red-400">หมดอายุ</span>}
                  {!c.visible && !c.fromEnv && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-bold text-gray-400">ไม่โชว์หน้าเว็บ</span>}
                </span>
                <span className="block text-[12px] text-gray-500 mt-0.5 truncate">
                  {label(c)}{c.min ? ` · ขั้นต่ำ ฿${c.min.toLocaleString('th-TH')}` : ''}
                  {c.quota ? ` · ใช้แล้ว ${c.used || 0}/${c.quota}` : c.used ? ` · ใช้แล้ว ${c.used}` : ''}
                  {c.until ? ` · ถึง ${new Date(c.until).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
                </span>
              </span>
              {!c.fromEnv && (
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setForm({ ...EMPTY, ...c })} className="p-1.5 text-gray-400 hover:text-blue-600" title="แก้ไข"><I d={IC.edit} /></button>
                  <button onClick={() => remove(c.code)} className="p-1.5 text-gray-400 hover:text-red-500" title="ลบ"><I d={IC.trash} /></button>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-center text-[11px] text-gray-300">ข้อมูลชุดเดียวกับ gucut.com/admin/coupons/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
