'use client'
// นำเข้าจากจีน — ตัวช่วยตัดสินใจว่า "ของชิ้นนี้เอาเข้ามาขายแล้วคุ้มไหม"
//
// เจ้าของร้านเลือกร้านและเลือกสินค้าเองจาก Taobao/1688
// ระบบไม่ได้เข้าไปดูดข้อมูลจากที่นั่น (ทำไม่ได้จริง — Taobao กันบอตหนัก
// และ API ทางการต้องมีนิติบุคคลจีน) หน้านี้จึงรับข้อมูลที่กรอกเอง
// แล้วตอบคำถามที่ตัดสินใจยากแทน: ต้นทุนถึงหน้าร้านเท่าไหร่ · ควรตั้งขายเท่าไหร่ ·
// ของเดิมในคลังเหลือเท่าไหร่ · ขายได้วันละกี่ชิ้น
import { useCallback, useEffect, useState } from 'react'
import { costOf, DEFAULT_SETTINGS, type ImportItem, type ImportSettings } from '@/lib/import-cost'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'

interface Stock { stock: number; perDay: number; suggest: number; sold: number }

const baht = (n: number) => '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
const blank: Partial<ImportItem> = { name: '', yuan: 0, qty: 1, kg: 0, cbm: 0 }

export default function ImportPage() {
  const [items, setItems] = useState<ImportItem[]>([])
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS)
  const [stock, setStock] = useState<Record<string, Stock>>({})
  const [form, setForm] = useState<Partial<ImportItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/import')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setItems(d.items); setSettings(d.settings); setStock(d.stock || {})
      setErr('')
    } catch {
      setErr('โหลดข้อมูลไม่สำเร็จ')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function post(body: object) {
    const r = await fetch('/api/import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d.error || 'บันทึกไม่สำเร็จ'); return false }
    await load(); return true
  }

  if (loading) return <LoadingState text="กำลังโหลด..." />

  const inp = 'w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ดรอปชิปปิ้ง</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            เลือกของเองจาก Taobao / 1688 แล้วเอามากรอกที่นี่ — ระบบคิดต้นทุนถึงหน้าร้านให้
          </p>
        </div>
        <button
          onClick={() => setForm(form ? null : { ...blank })}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {form ? 'ปิดฟอร์ม' : '+ เพิ่มสินค้า'}
        </button>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}

      {/* ---------- ค่าตั้งค่าการคิดต้นทุน ---------- */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900">ค่าที่ใช้คิดต้นทุน</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([
            ['rate', 'เรท ฿/¥', '0.01'],
            ['perKg', 'ขนส่ง ฿/กก.', '1'],
            ['perCbm', 'ขนส่ง ฿/คิว', '100'],
            ['handling', 'ค่าดำเนินการ ฿/ชิ้น', '1'],
            ['minMargin', 'กำไรขั้นต่ำ %', '1'],
          ] as const).map(([k, label, step]) => (
            <label key={k}>
              <span className={lbl}>{label}</span>
              <input
                type="number" step={step} defaultValue={settings[k]} id={`s-${k}`}
                className={inp}
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => {
            const g = (k: string) => Number((document.getElementById(`s-${k}`) as HTMLInputElement).value)
            void post({ settings: {
              rate: g('rate'), perKg: g('perKg'), perCbm: g('perCbm'),
              handling: g('handling'), minMargin: g('minMargin'),
            } })
          }}
          className="mt-2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          บันทึกค่า
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          ⚠️ <b>ใช้เรทที่ชิปปิ้งคิดจริง ไม่ใช่เรทธนาคาร</b> — ชิปปิ้งมักคิดสูงกว่าเรทกลาง 0.1-0.3 บาท
          ใส่เรทธนาคารจะได้ตัวเลขสวยกว่าความจริงทุกครั้ง<br />
          ⚠️ ค่าขนส่งคิดแบบ <b>น้ำหนักหรือปริมาตร อันไหนแพงกว่าเอาอันนั้น</b> ไม่ใช่บวกกัน —
          ของเบาแต่กล่องใหญ่จะโดนคิดตามคิวเสมอ
        </p>
      </Card>

      {/* ---------- ฟอร์มเพิ่ม/แก้ ---------- */}
      {form && (
        <Card>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="col-span-2"><span className={lbl}>ชื่อสินค้า</span>
              <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></label>
            <label className="col-span-2"><span className={lbl}>ลิงก์ Taobao / 1688 (ไม่ใส่ก็ได้)</span>
              <input value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} className={inp} placeholder="https://..." /></label>
            <label><span className={lbl}>ราคา ¥ / ชิ้น</span>
              <input type="number" step="0.01" value={form.yuan ?? 0} onChange={e => setForm({ ...form, yuan: Number(e.target.value) })} className={inp} /></label>
            <label><span className={lbl}>จำนวนที่จะสั่ง</span>
              <input type="number" value={form.qty ?? 1} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} className={inp} /></label>
            <label><span className={lbl}>น้ำหนัก กก./ชิ้น</span>
              <input type="number" step="0.01" value={form.kg ?? 0} onChange={e => setForm({ ...form, kg: Number(e.target.value) })} className={inp} /></label>
            <label><span className={lbl}>ปริมาตร คิว/ชิ้น</span>
              <input type="number" step="0.0001" value={form.cbm ?? 0} onChange={e => setForm({ ...form, cbm: Number(e.target.value) })} className={inp} placeholder="ไม่รู้ใส่ 0" /></label>
            <label><span className={lbl}>SKU ของเดิม (ถ้ามี)</span>
              <input value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} className={inp} placeholder="เทียบกับของในคลัง" /></label>
            <label><span className={lbl}>ราคาที่จะขาย (เว้นว่าง = ให้แนะนำ)</span>
              <input type="number" value={form.sell ?? ''} onChange={e => setForm({ ...form, sell: Number(e.target.value) })} className={inp} /></label>
          </div>
          <button
            onClick={async () => { if (await post({ item: form })) setForm(null) }}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            บันทึก
          </button>
        </Card>
      )}

      {/* ---------- รายการ ---------- */}
      {items.length === 0 ? (
        <Card><p className="py-6 text-center text-sm text-gray-500">ยังไม่มีสินค้าในรายการ — กด &ldquo;+ เพิ่มสินค้า&rdquo;</p></Card>
      ) : (
        items.map(it => {
          const c = costOf(it, settings)
          const st = it.sku ? stock[it.sku.trim().toUpperCase()] : undefined
          return (
            <Card key={it.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{it.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    ¥{it.yuan} × {it.qty} ชิ้น · {it.kg} กก./ชิ้น{it.cbm ? ` · ${it.cbm} คิว/ชิ้น` : ''}
                    {it.sku && <> · SKU {it.sku}</>}
                  </p>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer"
                       className="mt-0.5 inline-block text-xs text-blue-600 underline">เปิดหน้าสินค้า ↗</a>
                  )}
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button onClick={() => setForm(it)} className="text-blue-600 underline">แก้</button>
                  <button onClick={() => post({ del: it.id })} className="text-red-600 underline">ลบ</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['ค่าสินค้า', baht(c.goods)],
                  [`ค่าขนส่ง (คิดตาม${c.charged})`, baht(c.freight)],
                  ['ต้นทุนถึงมือ/ชิ้น', baht(c.landed)],
                  ['ต้นทุนรวมทั้งล็อต', baht(c.total)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[11px] text-gray-500">{k}</p>
                    <p className="text-sm font-semibold text-gray-900">{v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-600">
                  ราคาแนะนำ <b className="text-gray-900">{baht(c.suggestSell)}</b>
                  <span className="text-xs text-gray-400"> (กำไร {settings.minMargin}%)</span>
                </span>
                {c.margin !== null && (
                  <span className={c.worth ? 'text-emerald-700' : 'text-red-600'}>
                    ตั้งขาย {baht(it.sell || 0)} → กำไร <b>{c.margin}%</b>
                    {c.worth ? ' ✓ คุ้ม' : ' ✗ ต่ำกว่าที่ตั้งไว้'}
                  </span>
                )}
              </div>

              {/* เทียบกับของเดิมในคลัง */}
              {st && (
                <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  ของเดิมในคลัง <b>{st.stock}</b> ชิ้น · ขายได้ <b>{st.sold}</b> ชิ้นในปีที่ผ่านมา
                  {st.perDay > 0 && <> (~{st.perDay.toFixed(2)}/วัน)</>}
                  {st.suggest > 0 && <> · ระบบคลังแนะนำให้สั่ง <b>{st.suggest}</b> ชิ้น</>}
                </div>
              )}
              {it.sku && !st && (
                <p className="mt-2 text-[11px] text-gray-400">
                  ยังไม่มีข้อมูลคลังของ SKU นี้ — เปิดหน้า &ldquo;คลังอะไหล่&rdquo; ให้คำนวณสักครั้งก่อน
                </p>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
