import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/gmail'
import { loadCatalogState, saveCatalogState } from '@/lib/catalogstate'

export const dynamic = 'force-dynamic'

// GET /api/catalog/state — โหลดสถานะคลังอะไหล่ (โรงงาน/การแก้ไข/หมวดหมู่) ที่เก็บส่วนกลางใน Drive
// ให้หน้า /catalog ทุกเครื่อง/เบราว์เซอร์เห็นข้อมูลตรงกัน แทนที่จะต่างคนต่าง localStorage
export async function GET() {
  try {
    const token = await getAccessToken()
    const state = await loadCatalogState(token)
    if (!state) return NextResponse.json({ exists: false })
    return NextResponse.json({
      exists: true,
      ovr: state.ovr ?? {},
      catMap: state.catMap ?? {},
      catNew: state.catNew ?? [],
      facs: state.facs ?? [],
      updatedAt: state.updatedAt ?? null,
    })
  } catch (e: any) {
    // ถ้ายังไม่ได้ตั้งค่า Google OAuth หรือมีปัญหาชั่วคราว ให้ frontend fallback ไปใช้ localStorage เดิม
    return NextResponse.json({ exists: false, error: String(e?.message ?? e) })
  }
}

// POST /api/catalog/state — บันทึกสถานะทั้งก้อน (เขียนทับ) ทุกครั้งที่มีการแก้ไขในหน้า /catalog
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const state = {
      ovr: body?.ovr && typeof body.ovr === 'object' ? body.ovr : {},
      catMap: body?.catMap && typeof body.catMap === 'object' ? body.catMap : {},
      catNew: Array.isArray(body?.catNew) ? body.catNew : [],
      facs: Array.isArray(body?.facs) ? body.facs : [],
    }
    const token = await getAccessToken()
    await saveCatalogState(token, state)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}
