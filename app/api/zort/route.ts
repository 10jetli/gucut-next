import { NextRequest, NextResponse } from 'next/server'
import { zortFetch } from '@/lib/zort'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const endpoint = searchParams.get('endpoint')
  const store = searchParams.get('store') ?? '1'
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const params: Record<string, string> = {}
  searchParams.forEach((v, k) => {
    if (k !== 'endpoint' && k !== 'store') params[k] = v
  })

  try {
    const data = await zortFetch(endpoint, params, store)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ZORT route error]', err)
    return NextResponse.json({ error: 'fetch failed', detail: String(err) }, { status: 500 })
  }
}
