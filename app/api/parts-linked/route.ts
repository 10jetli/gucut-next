/* รายชื่อเลข OEM ที่ "เชื่อมกับหน้าอะไหล่แล้ว" — ให้หน้า /catalog เอาไปขึ้นเม็ดเขียว
 *
 * ท่านประธานสั่ง 12 ต.ค. 2569: "อันไหนเชื่อมแล้ว ให้มีเม็ดเขียว ๆ"
 *
 * 🔑 ทำไมต้องมีเส้นนี้ ไม่ให้หน้า /catalog ยิง gucut.com ตรง ๆ
 *    ยิงข้ามโดเมนโดนบล็อกด้วย CORS (ของจริง 12 ต.ค. — จอว่างทั้งหน้า
 *    และ **tsc ผ่าน · ด่านผ่านหมด** ไม่มีด่านไหนเห็นได้ เจอเพราะเปิดดูด้วยตา)
 *    ⇒ ให้ฝั่งเซิร์ฟเวอร์ยิงแทน แล้วจอเรียกที่โดเมนตัวเอง
 *
 * ⚠️ อ่านอย่างเดียว · ไม่ต้องมีกุญแจ (รายการเลขอะไหล่ที่ร้านขาย ไม่ใช่ความลับ
 *    และหน้า /catalog อยู่หลังล็อกอินอยู่แล้ว)
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const รุ่นทั้งหมด = ['f250', 'f381', 'f440', 'f660', 'f070', 'f090']
const ฐานหน้าร้าน = process.env.GUCUT_WEB_BASE || 'https://gucut.com'

export async function GET() {
  const คีย์ = process.env.GUCUT_WEB_ADMIN_KEY || ''
  const เลข = new Set<string>()
  let อ่านได้ = 0

  await Promise.all(รุ่นทั้งหมด.map(async (รุ่น) => {
    try {
      const r = await fetch(`${ฐานหน้าร้าน}/api/parts-map?model=${รุ่น}`, {
        headers: { 'x-admin-key': คีย์ }, cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) return
      const m = (await r.json())?.map ?? {}
      for (const k of Object.keys(m)) if (m[k]) เลข.add(k)
      อ่านได้++
    } catch { /* รุ่นไหนอ่านไม่ได้ ข้ามรุ่นนั้น ไม่ล้มทั้งเส้น */ }
  }))

  /* 🔴 อ่านไม่ได้สักรุ่น = **บอกตรง ๆ ว่าไม่รู้** ห้ามคืนรายการว่าง
     ไม่งั้นจอจะดับเม็ดเขียวทั้งกระดาน แล้วคนอ่านว่า "ยังไม่ได้เชื่อมสักชิ้น"
     ทั้งที่ของเชื่อมอยู่ครบ (คลาสเดียวกับ "ไม่รู้" ถูกพูดออกไปเป็นคำยืนยัน) */
  if (อ่านได้ === 0) {
    return NextResponse.json(
      { อ่านไม่ได้: true, เหตุ: 'อ่านตารางจับคู่ไม่ได้สักรุ่น — ยังบอกไม่ได้ว่าอะไรเชื่อมแล้ว' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    เลข: Array.from(เลข),
    จำนวน: เลข.size,
    รุ่นที่อ่านได้: อ่านได้,
    ครบทุกรุ่น: อ่านได้ === รุ่นทั้งหมด.length,
  }, { headers: { 'cache-control': 'public, max-age=60' } })
}
