import { NextRequest, NextResponse } from 'next/server'
import { loadCatalogStateBlobs, saveCatalogStateBlobs } from '@/lib/catalogstate'

export const dynamic = 'force-dynamic'

// GET /api/catalog/state — โหลดสถานะคลังอะไหล่ (โรงงาน/การแก้ไข/หมวดหมู่) ที่เก็บส่วนกลางใน Drive
// ให้หน้า /catalog ทุกเครื่อง/เบราว์เซอร์เห็นข้อมูลตรงกัน แทนที่จะต่างคนต่าง localStorage
export async function GET() {
  try {
    const state = await loadCatalogStateBlobs()
    if (!state) return NextResponse.json({ exists: false })
    return NextResponse.json({
      exists: true,
      ovr: state.ovr ?? {},
      catMap: state.catMap ?? {},
      catNew: state.catNew ?? [],
      facs: state.facs ?? [],
      catDone: state.catDone ?? [],
      updatedAt: state.updatedAt ?? null,
    })
  } catch (e: any) {
    /* 🔴 **ห้ามตอบ `exists:false` ตอนอ่านไม่ได้** — นี่คือทางที่ข้อมูลส่วนกลางหายได้จริง
       ฝั่งหน้า /catalog ตีความ exists:false ว่า "ยังไม่เคยมีสถานะบนเซิร์ฟเวอร์"
       แล้ว **ดันของใน localStorage ของเครื่องนั้นทับขึ้นไป** (queueSync/pushNow)
       ⇒ เครื่องที่มีข้อมูลเก่า/ไม่ครบ เขียนทับของกลางที่จริง ๆ ยังอยู่ครบ
       ⇒ "อ่านไม่ได้" กลายเป็น "ไม่มีอะไร" แล้วลามไปเป็น "เขียนทับ" (เจอ 7 ก.ย. 2569)
       ⚠️ คลาสเดียวกับที่ฝั่งท่อเจอกับ D1 คืนเดียวกัน — ต่างกันแค่ของเราลบของคนอื่นได้ด้วย
       ⇒ ตอบ 502 ให้ชัด · ฝั่งหน้าเว็บถูกแก้ให้ "ไม่รู้ = ไม่ทำอะไร" แล้ว (public/catalog/sync.js) */
    return NextResponse.json(
      { error: 'อ่านสถานะคลังอะไหล่ไม่ได้ — ' + String(e?.message ?? e), readFailed: true },
      { status: 502 },
    )
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
      catDone: Array.isArray(body?.catDone) ? body.catDone.filter((x: unknown) => typeof x === 'string') : [],
    }
    await saveCatalogStateBlobs(state)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}
