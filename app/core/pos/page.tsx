'use client'
// ขายหน้าร้าน (POS) — 2 สาขา · เขียนเข้าคลังเงาโดยตรง ไม่ผ่าน ZORT
//
// **ไม่มีต้นแบบให้ลอก** — ZORT ขายหน้าร้านผ่านแอป Android ไม่มีจอเว็บ (ตรวจแล้วที่ pos.zortout.com)
// จอนี้จึงออกแบบเองโดยยึดอย่างเดียว: **ใช้ง่ายตอนยืนขายโดยมีลูกค้ารออยู่ตรงหน้า**
//   1. ช่องค้นหาโฟกัสตั้งแต่เปิดจอ — พิมพ์รหัสแล้ว Enter ได้เลย ไม่ต้องแตะเมาส์
//   2. เพิ่มลงบิลแล้วช่องค้นหาเคลียร์ + โฟกัสกลับทันที เพื่อยิงตัวถัดไป
//   3. ปุ่มเก็บเงินใหญ่และอยู่ที่เดิมเสมอ (ติดล่างจอ)
//   4. เลือกสาขาครั้งเดียวแล้วจำไว้ ไม่ต้องเลือกทุกบิล
//   5. ปุ่มเพิ่ม/ลดจำนวนกดด้วยนิ้วได้ ไม่ใช่เป้าเล็ก ๆ
//
// 🔴 **ห้ามเอาจำนวนคงเหลือไปบล็อกการขายเด็ดขาด** — เลขนั้นมาจากภาพถ่ายสต็อกตอนตี 1
//    ลูกค้ายืนอยู่ตรงหน้าแล้วกดขายไม่ได้เพราะเลขไม่ตรง **แย่กว่าขายเกินเยอะ**
//    ⇒ คงเหลือเป็น "ตัวช่วยดู" เท่านั้น สีเทา ไม่ใช่ปุ่มเทา
// ⚠️ **ยังเป็นช่วงเดินคู่ขนานกับ ZORT** — เปิดบิลที่นี่ซ้ำกับแอป ZORT ใบเดียวกัน
//    จะได้สองใบในคลังเงา (กระจก ZORT ดึงใบเดิมเข้ามาอีกรอบ)
//    ⇒ **คำเตือนบนหัวจอห้ามถอด** จนกว่าจะเลิกใช้ ZORT จริง
// ⚠️ **ยิง sale=1 ตอนกด "เก็บเงิน" ครั้งเดียวเท่านั้น** ห้ามยิงตอนพิมพ์หรือแก้ตะกร้า
//    (โควตาเขียนของ D1 มีจำกัด · และใบซ้ำแก้ทีหลังยาก)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtBaht } from '@/lib/format'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, Pill } from '@/components/zort'

interface Branch { code: string; name: string }
interface Found { sku: string; name: string; price: number; qty: number }
interface CartLine { sku: string; name: string; price: number; qty: number }
interface SaleRow {
  number: string; channel: string; status: string
  amount: number; customer: string; order_date: string
}

const BRANCH_KEY = 'gucut-pos-branch'
const thaiToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

export default function CorePosPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branch, setBranch] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [looking, setLooking] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ number: string; duplicate?: boolean } | null>(null)
  const [error, setError] = useState('')
  const [sales, setSales] = useState<SaleRow[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  // ── สาขา: ดึงจากเซิร์ฟเวอร์ ห้ามฮาร์ดโค้ด (ร้านเพิ่มสาขาได้ด้วย env) ──
  useEffect(() => {
    fetch('/api/web/core?list=branches')
      .then((r) => r.json())
      .then((d) => {
        const list: Branch[] = Array.isArray(d?.branches) ? d.branches : []
        setBranches(list)
        let saved = ''
        try { saved = localStorage.getItem(BRANCH_KEY) ?? '' } catch {}
        // เลือกสาขาครั้งเดียวแล้วจำไว้ · ค่าที่จำไว้ต้องยังมีอยู่จริง ไม่งั้นถอยไปตัวแรก
        setBranch(list.some((b) => b.code === saved) ? saved : (list[0]?.code ?? ''))
      })
      .catch(() => setError('ดึงรายชื่อสาขาไม่ได้ — เปิดบิลไม่ได้จนกว่าจะรู้ว่าขายที่สาขาไหน'))
  }, [])

  const pickBranch = (code: string) => {
    setBranch(code)
    try { localStorage.setItem(BRANCH_KEY, code) } catch {}
    searchRef.current?.focus()
  }

  const loadSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/web/core?list=sales&day=${thaiToday()}&limit=50`)
      const d = await res.json()
      setSales(Array.isArray(d?.rows) ? d.rows : [])
    } catch { /* ประวัติดึงไม่ได้ไม่ควรขวางการขาย */ }
  }, [])

  useEffect(() => { loadSales() }, [loadSales])
  useEffect(() => { searchRef.current?.focus() }, [])

  // ── ค้นหาสินค้า: หน่วง 300ms พอ (เป็นการอ่าน ยิงถี่ได้แต่ไม่ต้องยิงทุกตัวอักษร) ──
  useEffect(() => {
    const term = q.trim()
    if (!term) { setFound([]); return }
    let alive = true
    setLooking(true)
    const t = setTimeout(() => {
      fetch(`/api/web/core?poslookup=${encodeURIComponent(term)}&limit=20`)
        .then((r) => r.json())
        .then((d) => { if (alive) setFound(Array.isArray(d?.rows) ? d.rows : []) })
        .catch(() => { if (alive) setFound([]) })
        .finally(() => { if (alive) setLooking(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  function addToCart(it: Found) {
    setCart((prev) => {
      const at = prev.findIndex((c) => c.sku === it.sku)
      if (at >= 0) {
        const next = [...prev]
        next[at] = { ...next[at], qty: next[at].qty + 1 }
        return next
      }
      return [...prev, { sku: it.sku, name: it.name, price: Number(it.price) || 0, qty: 1 }]
    })
    // เคลียร์ + โฟกัสกลับทันที เพื่อยิงตัวถัดไป
    setQ('')
    setFound([])
    setDone(null)
    searchRef.current?.focus()
  }

  const setQty = (sku: string, qty: number) =>
    setCart((prev) => prev.map((c) => (c.sku === sku ? { ...c, qty: Math.max(1, qty) } : c)))
  const removeLine = (sku: string) => setCart((prev) => prev.filter((c) => c.sku !== sku))

  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])
  const count = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart])

  async function checkout() {
    if (!branch) { setError('ยังไม่ได้เลือกสาขา'); return }
    if (!cart.length) return
    setSaving(true)
    setError('')
    setDone(null)
    try {
      const res = await fetch('/api/web/core?sale=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branch,
          customer: customer.trim() || undefined,
          items: cart.map((c) => ({ sku: c.sku, name: c.name, qty: c.qty, price: c.price })),
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) {
        // รายการที่ผิดคืนมาใน bad[] พร้อมเลขบรรทัด — ชี้ให้คนขายเห็นว่าแถวไหนพัง
        const bad = Array.isArray(d?.bad) && d.bad.length
          ? ` (มีปัญหาที่ ${d.bad.length} รายการ: ${d.bad.map((b: { sku?: string; why?: string }) => `${b.sku ?? '?'} ${b.why ?? ''}`).join(' · ')})`
          : ''
        throw new Error(`${d?.error ?? `HTTP ${res.status}`}${bad}`)
      }
      // ⚠️ ใบซ้ำ **ห้ามแกล้งขึ้นเขียวว่าเป็นใบใหม่** — ต้องบอกตรง ๆ ว่าบันทึกไปแล้ว
      setDone({ number: String(d?.number ?? ''), duplicate: !!d?.duplicate })
      setCart([])
      setCustomer('')
      await loadSales()
      searchRef.current?.focus()
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setSaving(false)
    }
  }

  async function voidSale(number: string) {
    setError('')
    try {
      const res = await fetch(`/api/web/core?salevoid=${encodeURIComponent(number)}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      await loadSales()
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  const isVoid = (s: string) => /void|ยกเลิก|cancel/i.test(String(s ?? ''))

  return (
    <div className="p-4 md:p-6 pb-28">
      <PageHead
        title="ขายหน้าร้าน"
        summary={`บันทึกการขายเข้าคลังของเราเองโดยตรง · วันที่ ${thaiToday()}`}
      />

      {/* ⚠️ คำเตือนถาวร ห้ามถอดจนกว่าจะเลิกใช้ ZORT จริง */}
      <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2.5 mb-4 leading-relaxed">
        ⚠️ <b>ยังเป็นช่วงเดินคู่ขนานกับ ZORT</b> — ใบที่เปิดที่นี่<b>ห้ามเปิดซ้ำในแอป ZORT POS</b>
        ไม่งั้นคลังเงาจะได้สองใบสำหรับการขายครั้งเดียว แล้วยอดเบิ้ลโดยไม่มีใครรู้
        · ตกลงกันให้ชัดก่อนว่าบิลไหนเปิดที่ไหน
      </div>

      {error && <ErrorBox title="ทำรายการไม่สำเร็จ">{error}</ErrorBox>}

      {/* เลือกสาขา — จำไว้ ไม่ต้องเลือกทุกบิล */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[13px] text-gray-500">สาขา</span>
        {branches.length === 0 && <span className="text-[13px] text-gray-400">กำลังโหลด…</span>}
        {branches.map((b) => (
          <button
            key={b.code}
            onClick={() => pickBranch(b.code)}
            className={`text-[14px] font-semibold rounded-lg px-5 py-2.5 border transition-colors ${
              branch === b.code
                ? 'bg-[#1b3b73] text-white border-[#1b3b73]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {b.name || b.code}
          </button>
        ))}
      </div>

      {/* ผลเปิดบิลล่าสุด */}
      {done && (
        <div
          className={`rounded px-3 py-2.5 mb-4 text-[13px] border ${
            done.duplicate
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {done.duplicate
            ? <>⚠️ ใบเลขนี้ <b>บันทึกไปแล้วก่อนหน้านี้</b> ({done.number}) ระบบไม่บันทึกซ้ำให้ — ไม่ได้เปิดใบใหม่</>
            : <>✅ เปิดบิลแล้ว เลขที่ <b>{done.number}</b></>}
        </div>
      )}

      {/* ค้นหาสินค้า */}
      <div className="mb-3">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // พิมพ์รหัสแล้ว Enter ได้เลย — ถ้าเจอตัวเดียวใส่ตัวนั้น ไม่ต้องแตะเมาส์
            if (e.key === 'Enter' && found.length > 0) addToCart(found[0])
          }}
          placeholder="สแกนหรือพิมพ์รหัสสินค้า / ชื่อสินค้า แล้วกด Enter"
          className="w-full text-[16px] border-2 border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1b3b73]"
        />
        {looking && <p className="text-[12px] text-gray-400 mt-1">กำลังค้น…</p>}
      </div>

      {/* ผลค้นหา — กดทั้งแถวเพื่อเพิ่ม (เป้าใหญ่ กดด้วยนิ้วได้) */}
      {found.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-4">
          {found.map((f) => (
            <button
              key={f.sku}
              onClick={() => addToCart(f)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-left hover:bg-blue-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-gray-800 truncate">{f.name || f.sku}</p>
                <p className="text-[12px] text-gray-400">
                  {f.sku}
                  {/* 🔴 คงเหลือเป็นตัวช่วยดูเท่านั้น ห้ามเอาไปบล็อกการขาย */}
                  {' · '}คงเหลือ (ณ ตี 1) {Number(f.qty).toLocaleString('th-TH')}
                </p>
              </div>
              <span className="text-[15px] font-bold text-gray-900 shrink-0">{fmtBaht(f.price)}</span>
              <span className="text-[13px] font-bold text-white bg-[#1b3b73] rounded-lg px-3 py-2 shrink-0">เพิ่ม</span>
            </button>
          ))}
        </div>
      )}

      {/* ตะกร้า */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[14px] font-bold text-gray-800">บิลปัจจุบัน</p>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-[12.5px] text-red-500 hover:underline">
              ล้างบิล
            </button>
          )}
        </div>
        {cart.length === 0 && (
          <p className="text-[13px] text-gray-400 px-4 py-8 text-center">
            ยังไม่มีสินค้าในบิล — พิมพ์รหัสหรือชื่อสินค้าในช่องด้านบน
          </p>
        )}
        {cart.map((c) => (
          <div key={c.sku} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-gray-800 truncate">{c.name || c.sku}</p>
              <p className="text-[12px] text-gray-400">{c.sku} · {fmtBaht(c.price)}/ชิ้น</p>
            </div>
            {/* ปุ่มเพิ่ม/ลดต้องกดด้วยนิ้วได้ — เป้า 44px ขึ้นไป */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setQty(c.sku, c.qty - 1)}
                className="w-11 h-11 rounded-lg border border-gray-300 text-[20px] text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <input
                value={c.qty}
                onChange={(e) => setQty(c.sku, Number(e.target.value.replace(/[^0-9]/g, '')) || 1)}
                inputMode="numeric"
                className="w-14 h-11 text-center text-[15px] font-semibold border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => setQty(c.sku, c.qty + 1)}
                className="w-11 h-11 rounded-lg border border-gray-300 text-[20px] text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
            <span className="text-[15px] font-bold text-gray-900 w-24 text-right shrink-0">
              {fmtBaht(c.price * c.qty)}
            </span>
            <button
              onClick={() => removeLine(c.sku)}
              className="w-11 h-11 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0"
              title="เอาออกจากบิล"
            >
              ✕
            </button>
          </div>
        ))}
        {cart.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="ชื่อลูกค้า (ไม่บังคับ)"
              className="w-full text-[13px] border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        )}
      </div>

      {/* ประวัติวันนี้ */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[14px] font-bold text-gray-800">บิลของวันนี้</p>
          <button onClick={loadSales} className="text-[12.5px] text-blue-600 hover:underline">รีเฟรช</button>
        </div>
        {sales.length === 0 && <p className="text-[13px] text-gray-400 px-4 py-5">ยังไม่มีบิลวันนี้</p>}
        {sales.map((s) => {
          const voided = isVoid(s.status)
          return (
            <div
              key={s.number}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${voided ? 'opacity-50' : ''}`}
            >
              <span className="text-[13px] font-medium text-gray-800 w-[170px] shrink-0 truncate">{s.number}</span>
              <span className="text-[12.5px] text-gray-500 flex-1 truncate">{s.channel} · {s.customer || 'ไม่ระบุชื่อ'}</span>
              {voided && <Pill tone="red">ยกเลิกแล้ว</Pill>}
              <span className="text-[14px] font-bold text-gray-900 shrink-0">{fmtBaht(s.amount)}</span>
              {!voided && (
                <button
                  onClick={() => voidSale(s.number)}
                  className="text-[12px] font-semibold text-red-500 hover:underline shrink-0"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* แถบเก็บเงินติดล่างจอ — อยู่ที่เดิมเสมอ */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[165px] bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-4 z-20">
          <div className="min-w-0">
            <p className="text-[12px] text-gray-500">{count.toLocaleString('th-TH')} ชิ้น · สาขา {branch || '—'}</p>
            <p className="text-[22px] font-black text-gray-900 leading-tight">{fmtBaht(total)}</p>
          </div>
          <button
            onClick={checkout}
            disabled={saving || !branch}
            className="ml-auto text-[17px] font-bold text-white rounded-xl px-8 py-4 disabled:opacity-50"
            style={{ background: '#1b3b73' }}
          >
            {saving ? 'กำลังบันทึก…' : 'เก็บเงิน'}
          </button>
        </div>
      )}
    </div>
  )
}
