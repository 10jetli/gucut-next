import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

/** เส้นกู้ข้อมูลต้องมีกุญแจเพิ่มจากเซสชันหน้าเว็บ เพราะผลของการกดผิดคือเขียนทับทั้งคลัง */
export function requireCatalogAdminKey(req: NextRequest): NextResponse | null {
  const expected = process.env.GUCUT_WEB_ADMIN_KEY || ''
  if (!expected) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY บนเซิร์ฟเวอร์' }, { status: 503 })
  }
  const got = req.headers.get('x-admin-key') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'ต้องมี x-admin-key ที่ถูกต้อง' }, { status: 401 })
  }
  return null
}
