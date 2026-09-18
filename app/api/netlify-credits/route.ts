// เครดิต Netlify คงเหลือ — proxy ไปถามระบบหลังร้านเว็บ (gucut.com)
//
// เจ้าของร้านสั่ง 28 ส.ค. 2569 "เอาเครดิตจาก Netlify มาใส่ตรงนี้ด้วย" (หัว Sidebar)
// ตัวเลขจริงคิดที่ gucut.com/api/netlify-credits (แคช 10 นาทีที่นั่นแล้ว)
// ที่นี่แค่ส่งต่อด้วยรหัสหลังร้านที่เก็บใน env — รหัสไม่หลุดมาเบราว์เซอร์
//
// 🔴 **ของเดิมส่งต่อแค่ `left` กับ `plan` แล้วทิ้งที่เหลือทั้งหมด** (แก้ 18 ก.ย. 2569)
//    ⇒ เกณฑ์เตือนเครดิตที่ทำไว้ (lib/usage-alert.ts) **ไม่มีทางทำงานบนจอจริง**
//      เพราะมันต้องใช้ `used` ในการคิดเปอร์เซ็นต์ · ไม่มี `used` ⇒ คืนสถานะ "ยังไม่รู้" ตลอดกาล
//    ⚠️ ผมตรวจตัวเตือนด้วยการป้อน**คำตอบดิบจากท่อ**เข้าฟังก์ชันตรง ๆ แล้วบอกว่าใช้ได้
//       ทั้งที่จอจริงไม่เคยได้ค่าชุดนั้น — **ตรวจถูกฟังก์ชัน แต่ผิดเส้นทาง**
//       ⇒ บทเรียน: ตัวเตือนต้องพิสูจน์ **ตามเส้นทางที่ของจริงเดิน** ไม่ใช่แค่ที่ปลายทาง
//
// ⚠️ ส่งต่อเฉพาะตัวเลขรวมและป้ายกำกับ — **ไม่มีข้อมูลบิล ไม่มี token**
//    `top` เป็นชื่อประเภท (production_deploys ฯลฯ) กับจำนวนเครดิต ไม่ใช่รายการธุรกรรม
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** ช่องที่จอใช้จริง — เพิ่มช่องใหม่ต้องเพิ่มที่นี่ด้วย ไม่งั้นมันจะหายระหว่างทางเงียบ ๆ */
type Credits = {
  plan?: number | null
  used?: number | null
  left?: number | null
  planConfirmed?: boolean
  planSource?: string | null
  stale?: boolean
  unknown?: boolean
  off?: boolean
  note?: string | null
  top?: [string, number][]
  at?: number | null
}

export async function GET() {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ off: true })
  try {
    const r = await fetch('https://gucut.com/api/netlify-credits', {
      headers: { 'x-admin-key': key },
      signal: AbortSignal.timeout(8000),
    })
    const j: Credits = await r.json()
    return NextResponse.json({
      plan: j?.plan ?? null,
      used: j?.used ?? null,
      left: j?.left ?? null,
      planConfirmed: j?.planConfirmed === true,
      planSource: j?.planSource ?? null,
      stale: j?.stale === true,
      unknown: j?.unknown === true,
      off: j?.off === true,
      note: j?.note ?? null,
      top: Array.isArray(j?.top) ? j.top : null,
      at: j?.at ?? null,
    })
  } catch {
    /* ⚠️ ล้มเหลว = **ยังไม่รู้** ไม่ใช่ "เหลือ 0" — คืน unknown ให้จอเขียนถูก */
    return NextResponse.json({ left: null, unknown: true })
  }
}
