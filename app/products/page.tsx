'use client'
import { useEffect, useState } from 'react'
import type { Product } from '@/lib/types'
import { fmtMoney } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import Card from '@/components/ui/Card'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  /** 🔴 เดิม `.catch(console.error)` กลืนเงียบ ⇒ ดึงไม่สำเร็จแล้ว **จอว่างเปล่าไม่มีข้อความอะไรเลย**
   *  อ่านได้ว่า "คลังไม่มีสินค้า" ซึ่งกลับหัวความจริง (เจอ 7 ก.ย. 2569) */
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/zort?endpoint=Product/GetProducts&limit=100')
      .then(async r => {
        const d = await r.json()
        /* ⚠️ แยกสองเหตุผลให้ขาด — "HTTP 200" ที่โผล่บนจอตอนรูปข้อมูลไม่ตรง อ่านแล้วงง
           (200 แปลว่าไม่มีอะไรผิด แต่จอบอกว่าดึงไม่สำเร็จ ⇒ ขัดกันเอง) */
        if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
        if (!d || !('list' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายการ)')
        return d
      })
      .then(d => setProducts(d?.list ?? []))
      .catch(e => { setErr(String(e?.message || e)); setProducts([]) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4">
      <Card padded={false} className="overflow-hidden">
        {loading && <LoadingState />}
        {!loading && err && (
          <p className="text-center py-8 text-red-600 text-sm">ดึงรายการสินค้าไม่สำเร็จ — ยังไม่รู้ว่ามีสินค้าอะไรบ้าง<br /><span className="text-gray-400 text-[12px]">{err}</span></p>
        )}
        {!loading && !err && products.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">ไม่มีสินค้าในรายการ</p>
        )}
        {products.map(p => (
          <div key={p.sku} className="px-4 py-3 border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50/70">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">SKU: {p.sku}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-bold text-gray-900">{fmtMoney(parseFloat(p.sellprice ?? '0'))}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${
                  parseFloat(p.stock ?? '0') <= 0 ? 'text-red-500' : 'text-emerald-600'
                }`}>
                  คลัง: {p.stock ?? '0'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
