/* 🧭 สถานะรายขาของผังสต็อก — จอ /core/registry อ่าน (หลังกำแพงล็อกอินตามปกติ) · ดู lib/flow-status.ts */
import { NextResponse } from 'next/server'
import { อ่าน } from '@/lib/flow-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ก้อน: await อ่าน() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `อ่านสถานะรายขาไม่ได้: ${String(e instanceof Error ? e.message : e)}` }, { status: 500 })
  }
}
