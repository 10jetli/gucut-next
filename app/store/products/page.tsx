'use client'
import { useEffect, useState } from 'react'

type ShopifyImage = { url: string } | null
type ShopifyMoney = { amount: string; currencyCode: string }
type ShopifyProduct = {
  id: string
  title: string
  handle: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  totalInventory: number
  featuredMedia?: { preview?: { image?: ShopifyImage } } | null
  priceRangeV2: { minVariantPrice: ShopifyMoney; maxVariantPrice: ShopifyMoney }
}

function fmtBaht(amount: string) {
  const n = parseFloat(amount || '0')
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return { text: 'ใช้งานอยู่', cls: 'bg-green-50 text-green-700' }
  if (status === 'DRAFT') return { text: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-500' }
  return { text: 'เก็บถาวร', cls: 'bg-yellow-50 text-yellow-700' }
}

export default function StoreProductsPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [endCursor, setEndCursor] = useState<string | null>(null)

  function load(after?: string) {
    setLoading(true)
    const qs = after ? `?first=50&after=${encodeURIComponent(after)}` : '?first=50'
    fetch(`/api/store/products${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error === 'shopify graphql error' ? 'เชื่อมต่อ Shopify ไม่สำเร็จ (ตรวจ SHOPIFY_ADMIN_TOKEN)' : 'โหลดข้อมูลไม่สำเร็จ')
          return
        }
        const edges = d?.edges ?? []
        setProducts((prev) => (after ? [...prev, ...edges.map((e: any) => e.node)] : edges.map((e: any) => e.node)))
        setHasNextPage(!!d?.pageInfo?.hasNextPage)
        setEndCursor(d?.pageInfo?.endCursor ?? null)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">ผลิตภัณฑ์ (เว็บไซต์)</h1>
        <p className="text-xs text-gray-400 mt-0.5">สินค้าที่แสดงอยู่บนหน้าร้าน gucut-store — ดึงข้อมูลสดจาก Shopify</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        {loading && products.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</p>
        )}
        {products.map((p) => {
          const img = p.featuredMedia?.preview?.image?.url
          const st = statusLabel(p.status)
          const min = p.priceRangeV2?.minVariantPrice?.amount ?? '0'
          const max = p.priceRangeV2?.maxVariantPrice?.amount ?? '0'
          const priceText = min === max ? fmtBaht(min) : `${fmtBaht(min)} - ${fmtBaht(max)}`
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{p.title}</p>
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${st.cls}`}>
                  {st.text}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-bold text-gray-900">{priceText}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${p.totalInventory <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  คลัง: {p.totalInventory}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => endCursor && load(endCursor)}
            disabled={loading}
            className="text-[13px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
          </button>
        </div>
      )}
    </div>
  )
}
