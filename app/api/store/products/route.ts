import { NextRequest, NextResponse } from 'next/server'
import { fetchShopifyProducts } from '@/lib/shopify'

// API สำหรับหน้า "ผลิตภัณฑ์" ในเมนูเว็บไซต์ — ดึงรายการสินค้าจริงจากร้าน Shopify (gucut-store)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const first = Number(searchParams.get('first') ?? '50')
  const after = searchParams.get('after') ?? undefined

  try {
    const data: any = await fetchShopifyProducts(first, after)
    if (data.errors) {
      console.error('[shopify products] graphql errors', data.errors)
      return NextResponse.json({ error: 'shopify graphql error', detail: data.errors }, { status: 500 })
    }
    return NextResponse.json(data.data.products)
  } catch (err) {
    console.error('[shopify products route error]', err)
    return NextResponse.json({ error: 'fetch failed', detail: String(err) }, { status: 500 })
  }
}
