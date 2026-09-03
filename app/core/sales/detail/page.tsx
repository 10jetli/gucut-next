'use client'
// รายละเอียดรายการขาย — ลอกผังจากจอจริงของ ZORT (~/claude-shared/zort-ui/04-รายละเอียดใบขาย.jpg)
//
// ผังที่ลอกมาตามลำดับบนลงล่าง:
//   ลิงก์ย้อนกลับ → ชื่อจอตัวใหญ่ → ขวาบนเลขหน้า N/ทั้งหมด + ลูกศรเลื่อนใบก่อน/ถัดไป
//   → การ์ดสถานะ 3 ใบเรียงกัน → การ์ดคู่ ข้อมูล/ลูกค้า
//   → การ์ดสินค้า (ตาราง + บล็อกยอดรวมชิดขวา แถวสุดท้ายพื้นเทาเน้น)
//   → การ์ดคู่ล่างสุด ที่อยู่ผู้รับ / การจัดส่ง
//
// ⚠️ **ลูกศรเลื่อนใบถัดไปคือรายละเอียดที่คนใช้ทุกวันจะรู้สึกทันทีถ้าไม่มี** (ฝั่งท่อหลังบ้านย้ำมา)
//    ทำได้โดยส่งลำดับใบ (i) กับตัวกรองเดิมมาทาง URL แล้วขอเพื่อนบ้านสามใบจากรายการเดียวกัน
// ⚠️ **ช่องที่คลังเงาไม่ได้เก็บ ต้องเขียนว่า "ไม่ได้เก็บไว้" ห้ามเว้นว่างเฉย ๆ**
//    เว้นว่าง = คนอ่านนึกว่าลูกค้าไม่ได้กรอก ซึ่งคนละเรื่องกับเราไม่ได้เก็บ (เจตนาเรื่องความเป็นส่วนตัว)
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { Pill, toneOfStatus, TH, THR, TD, TDR, ZORT_BLUE } from '@/components/zort'

interface Order {
  id: string; source: string; number: string; channel: string
  status: string; amount: number; customer: string; order_date: string
  updated_at?: string
}
interface Item { line: number; sku: string; name: string; qty: number; amount: number }

const VAT_RATE = 0.07

function Card({ title, icon, children, className = '' }: {
  title?: string; icon?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          {icon && <span className="text-[14px]">{icon}</span>}
          <p className="text-[14px] font-bold text-gray-800">{title}</p>
        </div>
      )}
      {children}
    </div>
  )
}

/** แถวป้ายชื่อฟิลด์ซ้าย–ค่าขวา แบบการ์ด "ข้อมูล"/"ลูกค้า" ของ ZORT */
function Field({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex gap-4 py-1.5">
      <span className="text-[12.5px] text-gray-500 w-[130px] shrink-0">{label}</span>
      <span className={`text-[12.5px] ${muted ? 'text-gray-400 italic' : 'text-gray-800'} break-words min-w-0`}>
        {value}
      </span>
    </div>
  )
}

function StatusCard({ icon, label, value, tone }: {
  icon: string; label: string; value: React.ReactNode; tone?: 'green' | 'orange' | 'gray'
}) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'orange' ? 'text-orange-500' : 'text-gray-800'
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[16px] shrink-0">{icon}</span>
      <div className="ml-auto text-right min-w-0">
        <p className="text-[11.5px] text-gray-400">{label}</p>
        <p className={`text-[14px] font-bold truncate ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function DetailInner() {
  const sp = useSearchParams()
  const id = sp.get('id') ?? ''
  const idx = Number(sp.get('i') ?? '-1')

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [nav, setNav] = useState<{ prev?: Order; next?: Order; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ตัวกรองเดิมของรายการที่กดเข้ามา — ต้องส่งต่อ ไม่งั้นใบถัดไปจะเป็นคนละชุด
  const listQs = useCallback((extra: Record<string, string>) => {
    const qs = new URLSearchParams({ list: 'orders' })
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    for (const [k, v] of Object.entries(extra)) qs.set(k, v)
    return qs
  }, [sp])

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุเลขใบ'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/web/core?order=${encodeURIComponent(id)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setOrder(d.order ?? null)
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [id])

  // เพื่อนบ้านสามใบ (ก่อนหน้า/ปัจจุบัน/ถัดไป) จากรายการชุดเดียวกัน
  const loadNav = useCallback(async () => {
    if (idx < 0) return
    try {
      const off = Math.max(0, idx - 1)
      const res = await fetch(`/api/web/core?${listQs({ limit: '3', offset: String(off) })}`)
      const d = await res.json()
      const rows: Order[] = Array.isArray(d?.rows) ? d.rows : []
      const at = rows.findIndex((r) => r.id === id)
      setNav({
        prev: at > 0 ? rows[at - 1] : undefined,
        next: at >= 0 && at + 1 < rows.length ? rows[at + 1] : undefined,
        total: Number(d?.total ?? 0),
      })
    } catch {
      setNav(null) // เลื่อนใบไม่ได้ไม่ควรทำให้ทั้งหน้าพัง
    }
  }, [idx, id, listQs])

  useEffect(() => { load(); loadNav() }, [load, loadNav])

  const backHref = (() => {
    const qs = new URLSearchParams()
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    const s = qs.toString()
    return s ? `/core/sales?${s}` : '/core/sales'
  })()

  const hrefFor = (o: Order, i: number) => {
    const qs = new URLSearchParams({ id: o.id, i: String(i) })
    for (const k of ['from', 'to', 'channel', 'status', 'q', 'cancelled']) {
      const v = sp.get(k)
      if (v) qs.set(k, v)
    }
    return `/core/sales/detail?${qs}`
  }

  const qty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const total = Number(order?.amount) || 0
  // ⚠️ ยอดก่อนภาษีกับภาษีเป็น **ค่าคำนวณ** จากยอดรวม ไม่ใช่ค่าที่เก็บไว้
  //    ใช้กติกา "ราคารวมภาษีแล้ว" ตามที่ ZORT แสดงให้ร้านนี้ · เขียนกำกับใต้บล็อกเสมอ
  const net = total / (1 + VAT_RATE)
  const vat = total - net

  return (
    <div className="p-4 md:p-6">
      {/* หัวจอ */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <Link href={backHref} className="text-[12px] text-blue-600 hover:underline">‹ รายการขาย</Link>
          <h1 className="text-[26px] leading-tight font-bold text-gray-900 tracking-tight mt-0.5">
            รายละเอียดรายการขาย
          </h1>
          {order && (
            <span className="inline-block mt-1 text-[11px] text-gray-500 border border-gray-300 rounded px-1.5 py-0.5">
              {order.source === 'z2' ? 'สาขา 2' : 'สาขา 1'}
            </span>
          )}
        </div>
        {nav && idx >= 0 && (
          <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
            <span>{(idx + 1).toLocaleString('th-TH')}/{nav.total.toLocaleString('th-TH')}</span>
            {nav.prev
              ? <Link href={hrefFor(nav.prev, idx - 1)} className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50">‹</Link>
              : <span className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300">‹</span>}
            {nav.next
              ? <Link href={hrefFor(nav.next, idx + 1)} className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50">›</Link>
              : <span className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-300">›</span>}
          </div>
        )}
      </div>

      {error && <ErrorBox title="เปิดใบนี้ไม่ได้">{error}</ErrorBox>}
      {loading && !order && <LoadingState />}

      {order && (
        <div className="space-y-4">
          {/* การ์ดสถานะ 3 ใบ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard
              icon="💳" label="สถานะรายการ" value={order.status || '—'}
              tone={toneOfStatus(order.status) === 'green' ? 'green' : toneOfStatus(order.status) === 'orange' ? 'orange' : 'gray'}
            />
            <StatusCard icon="🏪" label="ช่องทางการขาย" value={order.channel || '—'} />
            <StatusCard icon="🗄" label="ที่มาของข้อมูล" value={order.source === 'z2' ? 'ZORT สาขา 2' : 'ZORT สาขา 1'} />
          </div>

          {/* การ์ดคู่: ข้อมูล / ลูกค้า */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="ข้อมูล" icon="📄">
              <div className="px-4 py-3">
                <Field label="รายการ" value={<span className="text-blue-600 font-medium">{order.number}</span>} />
                <Field label="ประเภทรายการ" value="รายการขาย" />
                <Field label="วันที่" value={order.order_date || '—'} />
                <Field label="ช่องทางการขาย" value={order.channel || '—'} />
              </div>
            </Card>
            <Card title="ลูกค้า" icon="👤">
              <div className="px-4 py-3">
                <Field label="ชื่อลูกค้า" value={order.customer || '—'} />
                <Field label="เบอร์โทรศัพท์" value="คลังเงาไม่ได้เก็บไว้" muted />
                <Field label="ที่อยู่ลูกค้า" value="คลังเงาไม่ได้เก็บไว้" muted />
              </div>
            </Card>
          </div>

          {/* การ์ดสินค้า */}
          <Card title="สินค้า" icon="📦">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className={TH} style={{ width: 44 }}>#</th>
                    <th className={TH}>รหัส</th>
                    <th className={TH}>ชื่อสินค้า</th>
                    <th className={THR}>จำนวน</th>
                    <th className={THR}>มูลค่าต่อหน่วย</th>
                    <th className={THR}>ส่วนลดต่อหน่วย</th>
                    <th className={THR}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-[13px] text-gray-400 text-center">
                      ใบนี้ไม่มีรายการสินค้าในคลังเงา
                    </td></tr>
                  )}
                  {items.map((it, i) => (
                    <tr key={it.line} className="border-b border-gray-100 last:border-0">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={`${TD} whitespace-nowrap`}>{it.sku || '—'}</td>
                      <td className={TD}>
                        {/* รายการในใบขายกดไปดูสินค้าได้ — ปลายทางมีจริงแล้ว */}
                        {it.sku
                          ? (
                            <Link href={`/core/stock/${encodeURIComponent(it.sku)}`} className="text-blue-600 hover:underline">
                              {it.name || '—'}
                            </Link>
                          )
                          : <span className="text-gray-700">{it.name || '—'}</span>}
                      </td>
                      <td className={TDR}>{Number(it.qty).toLocaleString('th-TH')}</td>
                      <td className={TDR}>{it.qty ? fmtMoney(it.amount / it.qty) : '—'}</td>
                      {/* ⚠️ ZORT มีคอลัมน์นี้ (โชว์ 0) แต่คลังเงาไม่ได้เก็บส่วนลดรายบรรทัด
                          ⇒ แสดงขีด **ห้ามเขียน 0** เพราะ 0 คือคำกล่าวอ้างว่าไม่มีส่วนลด
                             ส่วนขีดคือ "ไม่รู้" — ต่างกันตอนมีใบที่ลดจริง */}
                      <td className={TDR}><span className="text-gray-300">—</span></td>
                      <td className={TDR}>{fmtMoney(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* บล็อกยอดรวมชิดขวา — แถวสุดท้ายพื้นเทาเน้น เหมือน ZORT */}
            <div className="flex flex-wrap gap-6 px-4 py-4">
              <div className="min-w-[200px] flex-1">
                <p className="text-[12.5px] text-gray-500">หมายเหตุ</p>
                <p className="text-[12.5px] text-gray-400">—</p>
              </div>
              <div className="w-full md:w-[380px] ml-auto">
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">จำนวนทั้งหมด</span>
                  <span className="text-gray-800">{qty.toLocaleString('th-TH')}</span>
                </div>
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">ส่วนลด</span>
                  <span className="text-gray-300">—</span>
                </div>
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">มูลค่าสุทธิก่อนภาษี</span>
                  <span className="text-gray-800">{fmtMoney(net)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span className="text-gray-500">ภาษีมูลค่าเพิ่ม (7%)</span>
                  <span className="text-gray-800">{fmtMoney(vat)}</span>
                </div>
                <div className="flex justify-between py-2.5 px-3 mt-1 bg-gray-100 rounded">
                  <span className="text-[13px] font-bold text-gray-800">มูลค่ารวมสุทธิ</span>
                  <span className="text-[13px] font-bold text-gray-900">{fmtMoney(total)}</span>
                </div>
                <p className="text-[10.5px] text-gray-400 mt-2 leading-relaxed">
                  ⚠️ ยอดก่อนภาษีกับภาษีเป็น<b>ค่าที่คำนวณจากยอดรวม</b> โดยถือว่าราคารวมภาษีแล้ว
                  ไม่ใช่ตัวเลขที่เก็บไว้ในระบบ — ใบกำกับภาษีตัวจริงออกจาก PEAK
                </p>
              </div>
            </div>
          </Card>

          {/* การ์ดคู่ล่างสุด */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="ข้อมูลที่อยู่ผู้รับ" icon="📍">
              <div className="px-4 py-3">
                <p className="text-[12.5px] text-gray-400 italic">
                  คลังเงาไม่ได้เก็บชื่อ ที่อยู่ และเบอร์ผู้รับไว้โดยตั้งใจ —
                  เก็บเท่าที่จำเป็นต่อการเทียบยอดเท่านั้น ดูข้อมูลผู้รับได้ที่ระบบต้นทาง
                </p>
              </div>
            </Card>
            <Card title="ข้อมูลการจัดส่งสินค้า" icon="🚚">
              <div className="px-4 py-3">
                <Field label="ช่องทางการขาย" value={order.channel || '—'} />
                <Field label="ขนส่ง / เลขพัสดุ" value="คลังเงาไม่ได้เก็บไว้" muted />
              </div>
            </Card>
          </div>

          <div className="pt-1">
            <Link
              href={backHref}
              className="inline-block text-[13px] font-semibold text-white rounded-full px-5 py-2"
              style={{ background: ZORT_BLUE }}
            >
              ‹ กลับไปรายการขาย
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SaleDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense ไม่งั้น build ของ Next ตก
  return (
    <Suspense fallback={<div className="p-6"><LoadingState /></div>}>
      <DetailInner />
    </Suspense>
  )
}
