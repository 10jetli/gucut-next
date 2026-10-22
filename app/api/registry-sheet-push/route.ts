/* 📥 รับชีททะเบียนจาก Apps Script ในบัญชีท่านประธาน — อยู่ใน PUBLIC_PATHS · ตรวจกุญแจเองในเส้น
 * (ท่าเดียวกับ ads-push ของร้าน: คนเรียกคือเซิร์ฟเวอร์ Google ไม่ใช่เบราว์เซอร์ที่ล็อกอิน)
 * 🔴 ไม่ตั้ง REGISTRY_PUSH_KEY = ปิด · เทียบกุญแจแบบเวลาคงที่ · ของผิดรูปตอบ 400 พร้อมเหตุ ไม่เข้า pipeline */
import { NextRequest, NextResponse } from 'next/server'
import { กุญแจตรง, ตรวจรูปแท็บ, รับชีท } from '@/lib/registry-sheet'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const กุญแจ = process.env.REGISTRY_PUSH_KEY
  const body = await req.json().catch(() => null)
  if (!กุญแจ || !กุญแจตรง(body?.key, กุญแจ)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const ร = ตรวจรูปแท็บ(body)
  if (!ร.ok) return NextResponse.json({ ok: false, error: ร.เหตุ }, { status: 400 })
  try {
    const ผล = await รับชีท(ร.แท็บ, ร.ชีทแก้ไขล่าสุด)
    // ตอบสถานะกลับให้สคริปต์ — ฝั่งสคริปต์เอาไปโชว์ใน execution log ได้ว่ารอบนี้เกิดอะไร
    return NextResponse.json({ ok: true, สถานะ: ผล.สถานะ, เหตุ: ผล.เหตุ ?? null })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 })
  }
}
