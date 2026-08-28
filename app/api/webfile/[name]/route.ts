// ท่อไฟล์สาธารณะของ gucut.com — /api/webfile/<ชื่อ>
// หน้า /web/clip-shop ต้องใช้ feed.json + search-index.json ซึ่งดึงข้ามโดเมน
// ตรง ๆ ไม่ได้ (เบราว์เซอร์บล็อก CORS) จึงให้เซิร์ฟเวอร์ดึงแทน
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const ALLOW = new Set(['feed.json', 'search-index.json'])

export async function GET(_req: NextRequest, ctx: { params: { name: string } }) {
  const name = ctx.params.name
  if (!ALLOW.has(name)) return NextResponse.json({ error: 'not allowed' }, { status: 403 })
  const r = await fetch(`https://gucut.com/${name}`, { signal: AbortSignal.timeout(15000) })
  const body = await r.arrayBuffer()
  return new NextResponse(body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'application/json',
      'cache-control': 'private, max-age=300',
    },
  })
}
