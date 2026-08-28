// เครดิต Netlify คงเหลือ — proxy ไปถามระบบหลังร้านเว็บ (gucut.com)
//
// เจ้าของร้านสั่ง 28 ส.ค. 2569 "เอาเครดิตจาก Netlify มาใส่ตรงนี้ด้วย" (หัว Sidebar)
// ตัวเลขจริงคิดที่ gucut.com/api/netlify-credits (แคช 10 นาทีที่นั่นแล้ว)
// ที่นี่แค่ส่งต่อด้วยรหัสหลังร้านที่เก็บใน env — รหัสไม่หลุดมาเบราว์เซอร์
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.GUCUT_WEB_ADMIN_KEY
  if (!key) return NextResponse.json({ off: true })
  try {
    const r = await fetch('https://gucut.com/api/netlify-credits', {
      headers: { 'x-admin-key': key },
      signal: AbortSignal.timeout(8000),
    })
    const j = await r.json()
    // ส่งออกเฉพาะตัวเลขที่ต้องโชว์
    return NextResponse.json({ left: j?.left ?? null, plan: j?.plan ?? null })
  } catch {
    return NextResponse.json({ left: null })
  }
}
