import { NextResponse } from 'next/server'
import { bridgeModel } from '@/lib/rokid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// บางแพลตฟอร์มเรียก /v1/models ตอนกดปุ่ม "ทดสอบการเชื่อมต่อ" — ตอบรายชื่อโมเดลที่สะพานนี้ใช้
export async function GET() {
  const model = bridgeModel()
  return NextResponse.json({
    object: 'list',
    data: [{ id: model, object: 'model', created: 0, owned_by: 'anthropic' }],
  })
}
