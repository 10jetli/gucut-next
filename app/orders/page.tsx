'use client'
import { useEffect, useState } from 'react'
import type { Order } from '@/lib/types'
import OrderCard from '@/components/ui/OrderCard'
import LoadingState from '@/components/ui/LoadingState'
import PillButton from '@/components/ui/PillButton'
import Card from '@/components/ui/Card'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  /** 🔴 ดึงไม่สำเร็จ ≠ ไม่มีออเดอร์ — เดิม `.catch(console.error)` กลืนเงียบ
   *  แล้วจอเขียนว่า "ไม่มี orders" ซึ่งเป็นคำโกหกที่ไม่มีอะไรฟ้อง (เจอ 7 ก.ย. 2569)
   *  ⚠️ จอนี้ไม่มีลิงก์ในเมนูแล้ว แต่ยังเปิดด้วย URL ได้ ⇒ ยังต้องพูดความจริง */
  const [err, setErr] = useState('')
  const [store, setStore] = useState('1')

  useEffect(() => {
    setLoading(true)
    setErr('')
    fetch(`/api/zort?endpoint=Order/GetOrders&limit=50&store=${store}`)
      .then(async r => {
        const d = await r.json()
        /* ⚠️ แยกสองเหตุผลให้ขาด — "HTTP 200" ที่โผล่บนจอตอนรูปข้อมูลไม่ตรง อ่านแล้วงง
           (200 แปลว่าไม่มีอะไรผิด แต่จอบอกว่าดึงไม่สำเร็จ ⇒ ขัดกันเอง) */
        if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
        if (!d || !('list' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายการ)')
        return d
      })
      .then(d => setOrders(d?.list ?? []))
      .catch(e => { setErr(String(e?.message || e)); setOrders([]) })
      .finally(() => setLoading(false))
  }, [store])

  return (
    <div>
      {/* 🔴 **จอนี้ยิง ZORT ตรง ๆ — วันที่เลิกใช้ ZORT จอนี้จะว่างทันที**
          กฎของโปรเจกต์ (เขียนไว้ที่ app/sales/page.tsx): "จอที่ยัง fetch /api/zort อยู่ = ยังไม่เสร็จ"
          จอนี้ไม่มีลิงก์ในเมนูแล้ว แต่ **ยังเปิดด้วย URL ได้** (บุ๊กมาร์กเก่าบนแท็บเล็ตหน้าร้าน)
          ⇒ ห้ามลบของเดิม (กฎท่านประธาน) แต่ต้องบอกความจริงว่าของจริงอยู่ที่ไหน
          ⚠️ เขียนไว้ **บนสุดของจอ** — คำเตือนที่ต้องเลื่อนถึงเห็น คือคำเตือนที่วางผิดที่ */}
      <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
        ⚠️ จอนี้อ่านจาก <b>ZORT โดยตรง</b> (ไม่ใช่กระจกข้อมูลของเรา) — วันที่ร้านเลิกใช้ ZORT จอนี้จะว่าง
        {' '}· จอที่ใช้งานจริงคือ <a href="/core/sales" className="text-blue-600 hover:underline font-medium">รายการขาย</a>
      </p>
      <div className="sticky top-0 md:top-14 bg-white/90 backdrop-blur-md z-10 flex gap-2 px-4 py-2.5 border-b border-gray-100">
        {['1', '2'].map(s => (
          <PillButton key={s} active={store === s} onClick={() => setStore(s)}>
            {s === '1' ? 'Gucut' : 'Ceojet'}
          </PillButton>
        ))}
      </div>
      <div className="p-4">
        <Card padded={false} className="overflow-hidden">
          {loading && <LoadingState />}
          {!loading && err && (
            <p className="text-center py-8 text-red-600 text-sm">ดึงรายการไม่สำเร็จ — ยังไม่รู้ว่ามีออเดอร์ไหม<br /><span className="text-gray-400 text-[12px]">{err}</span></p>
          )}
          {!loading && !err && orders.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">ไม่มี orders</p>
          )}
          {orders.map(o => <OrderCard key={o.number} order={o} />)}
        </Card>
      </div>
    </div>
  )
}
