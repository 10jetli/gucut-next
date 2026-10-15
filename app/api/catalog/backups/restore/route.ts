import { NextRequest, NextResponse } from 'next/server'
import { CatalogStateError, restoreCatalogStateSnapshot } from '@/lib/catalogstate'
import { requireCatalogAdminKey } from '../auth'

export const dynamic = 'force-dynamic'

// POST /api/catalog/backups/restore { id } — สำรองก้อนปัจจุบันก่อนกู้ทุกครั้ง
export async function POST(req: NextRequest) {
  const denied = requireCatalogAdminKey(req)
  if (denied) return denied

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON อ่านไม่ได้ — ยังไม่ได้กู้คืน' }, { status: 400 })
  }
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'ต้องส่ง id ของรุ่นสำรอง' }, { status: 400 })

  try {
    const result = await restoreCatalogStateSnapshot(id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof CatalogStateError) {
      const status = error.code === 'SNAPSHOT_NOT_FOUND' ? 404
        : error.code === 'INVALID_SNAPSHOT_ID' ? 400
          : 503
      return NextResponse.json({ ok: false, code: error.code, error: error.message, ...error.details }, { status })
    }
    return NextResponse.json(
      { ok: false, error: `กู้คืนไม่สำเร็จ — ยังไม่ได้เขียนอะไร: ${error instanceof Error ? error.message : String(error)}` },
      { status: 503 },
    )
  }
}
