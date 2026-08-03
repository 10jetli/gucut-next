import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const store = getStore('tracker-images')
    const result = await store.getWithMetadata(params.key, { type: 'arrayBuffer' })
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const contentType = (result.metadata?.contentType as string) || 'image/jpeg'
    return new NextResponse(result.data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
