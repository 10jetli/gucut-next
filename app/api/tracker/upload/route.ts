import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function extFromName(name: string, type: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  if (m) return m[1].toLowerCase()
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, error: 'ไม่พบไฟล์' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = extFromName(file.name || '', file.type || '')
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const store = getStore('tracker-images')
    await store.set(key, buf, { metadata: { contentType: file.type || 'image/jpeg' } })

    const url = `/api/tracker/image/${key}`
    return NextResponse.json({ ok: true, url, thumb: url, name: file.name || key })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
