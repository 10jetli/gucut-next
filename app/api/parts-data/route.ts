// รายการอะไหล่ต่อรุ่น — ยิงฝั่งเซิร์ฟเวอร์แทนให้จอ เพื่อเลี่ยง CORS
//
// 🔴 **ทำไมต้องมีเส้นนี้ ไม่ให้จอยิงตรง** — ของจริงที่วัดได้ 12 ต.ค. 2569:
//    เบราว์เซอร์ยิง `https://gucut.com/parts/f440.json` จาก `test2.gucut.com` ⇒ **ถูก CORS บล็อก**
//    `No 'Access-Control-Allow-Origin' header is present` ⇒ จอว่างเปล่าทั้งหน้า
//    ⚠️ และ **tsc ผ่าน · ด่าน 8 ตัวผ่านหมด** — ไม่มีด่านไหนเห็นข้อนี้ได้
//       ⇒ เจอเพราะเปิดดูด้วยตาเท่านั้น (กฎร้าน: build ผ่าน ≠ จอถูก)
//
// ℹ️ ใช้พร็อกซี `/api/web/[...path]` ไม่ได้ เพราะตัวนั้นฝัง `/api/` ไว้ในพาธปลายทาง
//    (`${base}/api/${path}`) แต่ไฟล์อะไหล่อยู่ที่ `/parts/<รุ่น>.json` ไม่ได้อยู่ใต้ `/api`
import { NextRequest, NextResponse } from 'next/server'

/** ล้างชื่อรุ่น — ตรงกับ `ล้างรุ่น` ของฝั่งท่อ (`parts-map.mjs`): ตัวเล็ก · a-z0-9 · ≤12
 *  🔑 กันคนยิงพาธแปลก ๆ เข้ามา (`../`) และกันชื่อรุ่นที่ไม่มีวันมีไฟล์ */
const ล้างรุ่น = (v: string | null) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)

export async function GET(req: NextRequest) {
  const รุ่น = ล้างรุ่น(req.nextUrl.searchParams.get('model'))
  if (!รุ่น) return NextResponse.json({ error: 'ต้องระบุ model' }, { status: 400 })
  try {
    const r = await fetch(`https://gucut.com/parts/${รุ่น}.json`, { cache: 'no-store' })
    if (!r.ok) {
      /* 🔑 อ่านไม่ได้ ≠ ไม่มีอะไหล่ — ต้องตอบเป็นข้อผิดพลาด ไม่ใช่ก้อนว่าง
         ไม่งั้นจอจะขึ้นว่า "รุ่นนี้ยังไม่มีรายการอะไหล่" ทั้งที่ของมีอยู่ */
      return NextResponse.json(
        { error: `อ่านรายการอะไหล่ของรุ่น ${รุ่น} ไม่ได้ (HTTP ${r.status})` },
        { status: 502 })
    }
    return NextResponse.json(await r.json(), {
      headers: { 'cache-control': 'public, max-age=300' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `อ่านรายการอะไหล่ไม่ได้: ${e instanceof Error ? e.message : 'เรียกไม่สำเร็จ'}` },
      { status: 502 })
  }
}
