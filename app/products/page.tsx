'use client'
import { useEffect, useState } from 'react'
import type { Product } from '@/lib/types'

function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/zort?endpoint=Product/GetProducts&limit=100')
      .then(r => r.json())
      .then(d => setProducts(d?.list ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && <p className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</p>}
        {products.map(p => (
          <div key={p.sku} className="px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">SKU: {p.sku}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-bold text-gray-900">{fmtBaht(parseFloat(p.sellprice ?? '0'))}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${
                  parseFloat(p.stock ?? '0') <= 0 ? 'text-red-500' : 'text-green-600'
                }`}>
                  คลัง: {p.stock ?? '0'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
