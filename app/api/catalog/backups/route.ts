import { NextRequest, NextResponse } from 'next/server'
import { listCatalogStateSnapshots } from '@/lib/catalogstate'
import { requireCatalogAdminKey } from './auth'

export const dynamic = 'force-dynamic'

// GET /api/catalog/backups — คืนเฉพาะทะเบียนรุ่น ไม่คืนข้อมูลคลังทั้งก้อน
export async function GET(req: NextRequest) {
  const denied = requireCatalogAdminKey(req)
  if (denied) return denied
  try {
    const backups = await listCatalogStateSnapshots()
    return NextResponse.json({ backups }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: `อ่านรายการสำรองไม่ได้: ${error instanceof Error ? error.message : String(error)}` },
      { status: 503 },
    )
  }
}
