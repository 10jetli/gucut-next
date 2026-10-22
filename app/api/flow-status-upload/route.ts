/* 🧭 รับสถานะรายขาจาก g1 (~/bin/flow_status_upload.py) — อยู่ใน PUBLIC_PATHS · ตรวจ x-admin-key เองในเส้น
 * 🔴 ไม่ตั้งกุญแจ = ปิด · ของผิดรูปไม่เก็บ (ตอบ 400 พร้อมเหตุ) */
import { NextRequest, NextResponse } from 'next/server'
import { ตรวจรูป, เก็บ } from '@/lib/flow-status'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const คีย์ = process.env.GUCUT_WEB_ADMIN_KEY
  if (!คีย์ || req.headers.get('x-admin-key') !== คีย์) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ร = ตรวจรูป(await req.json().catch(() => null))
  if (!ร.ok) return NextResponse.json({ ok: false, error: ร.เหตุ }, { status: 400 })
  try {
    const ก้อน = await เก็บ(ร.ขา)
    return NextResponse.json({ ok: true, ขา: Object.keys(ก้อน.ขา).length, อัปโหลดเมื่อ: ก้อน.อัปโหลดเมื่อ })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 })
  }
}
