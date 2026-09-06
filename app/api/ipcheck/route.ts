import { NextRequest, NextResponse } from 'next/server'
import { clientIp, ipSources } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

// GET /api/ipcheck → "ตัวกันเดารหัสรัว ๆ ทำงานได้จริงไหมบนรันไทม์นี้"
//
// มีไว้เพราะยืนยันแทนกันไม่ได้: ฝั่งท่อเป็น Netlify Functions v2 (มี context.ip)
// ฝั่งนี้เป็น Next route/middleware ซึ่งเป็นคนละรันไทม์ ⇒ **ต้องยิงของจริงหลัง deploy ถึงจะรู้**
//
// 🔴 **คืนแค่ "มี/ไม่มี" ห้ามคืนตัวเลข IP หรือค่าในหัวข้อมูลออกไปเด็ดขาด**
//    (เส้นนี้อยู่หลังด่านล็อกอินอยู่แล้ว แต่ข้อมูลที่ไม่จำเป็นต้องออก ก็ไม่ต้องออก)
export async function GET(req: NextRequest) {
  const sources = ipSources(req)
  const ok = !!clientIp(req)
  return NextResponse.json({
    ok,
    sources,
    guard: ok ? 'on' : 'off',
    note: ok
      ? 'รู้ IP ได้ ⇒ ตัวกันเดารหัสที่หน้าล็อกอินทำงาน (นับในหน่วยความจำอินสแตนซ์ ทำให้แพงขึ้น ไม่ใช่ปิดสนิท)'
      : 'ไม่รู้ IP เลย ⇒ **ตัวกันเดารหัสไม่ทำงาน** — ประตูที่เหลือคือคุกกี้ลายนิ้วมือ 256 บิต',
  })
}
