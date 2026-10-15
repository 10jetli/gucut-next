import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { GET as สแกนเจ้าเดิม } from '../vendor/route'
import { BILL_VENDORS } from '@/lib/vendors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* POST /api/bills/scan?vendor=<id> — ให้ **เครื่อง g1** สั่งสแกนเมลของเจ้าทางเมลทีละเจ้า (15 ต.ค. 2569 · ใบ t_mv8utgnt)
 *
 * 🔴 ที่มา: งานเก็บบิลสิ้นเดือนบน g1 (~/bin/เก็บบิลสิ้นเดือน.sh) ครอบแค่ 6 เจ้าที่ใช้สคริปต์
 *    4 เจ้าทางเมล (Google Ads · Apple · Omise · Anthropic) สแกนได้ทางเดียวคือ /api/bills/vendor ซึ่งอยู่หลังล็อกอิน
 *    ⇒ ไม่มีอะไรบน g1 เรียกเลยตั้งแต่ 1 ต.ค. · และเจ้าที่พังจะไม่มีใครรู้ (ตัวเตือน Telegram อ่านแต่ไฟล์สถานะบน g1)
 *
 * 🔑 ทำไมเป็นเส้นแคบใหม่ ไม่เปิด /api/bills/vendor:
 *    เส้นเดิมคืน **รายการบิลทั้งก้อน** — เปิดให้เครื่องเรียกด้วย secret ก็ยังเป็นข้อมูลภาษีที่ไม่จำเป็นต้องออก
 *    ⇒ เส้นนี้สั่งสแกนด้วย **ฟังก์ชันเดิมตัวเดียวกัน** (ตรรกะสแกนมีที่เดียว) แล้วคืน **แค่สถานะ**
 *
 * 🔒 สิทธิ์: header `x-drivesync-secret` ต้องตรง DRIVESYNC_SECRET (ตัวเดียวกับที่ g1 ใช้อัปบิลอยู่แล้ว)
 *    ส่งใน header ไม่ใช่ query ⇒ ไม่ติดใน log ของใคร · เทียบแบบ timing-safe
 *    เส้นนี้อยู่ใน PUBLIC_PATHS ของ middleware ⇒ **ไม่มี secret = 401 เสมอ** (คนล็อกอินบนเว็บก็ใช้เส้นนี้ไม่ได้ — ไม่จำเป็น)
 * ⚠️ ล้ม ⇒ 503 ไม่ใช่ 502 (502 เป็นรหัสเดียวที่ขอบ Netlify แทน body ทิ้ง — วัด 4 ต.ค. 2569)
 */
const เจ้าทางเมล = () => BILL_VENDORS.filter((v) => v.collect?.วิธี === 'เมล' && !v.hiddenInGrid).map((v) => v.id)

function secretตรง(got: string | null): boolean {
  const need = process.env.DRIVESYNC_SECRET
  if (!need || !got) return false
  const a = Buffer.from(got), b = Buffer.from(need)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!secretตรง(req.headers.get('x-drivesync-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('vendor') ?? ''
  const ได้ = เจ้าทางเมล()
  if (!ได้.includes(id)) {
    return NextResponse.json({ error: `เส้นนี้รับเฉพาะเจ้าทางเมล: ${ได้.join(' · ')}` }, { status: 400 })
  }
  try {
    const r = await สแกนเจ้าเดิม(new NextRequest(new URL(`/api/bills/vendor?vendor=${encodeURIComponent(id)}`, req.url)))
    const j = await r.json().catch(() => ({}))
    /* 🔑 สามผล ห้ามยุบ: สแกนใหม่ได้ · ถอยไปใช้ของเก่า (ตอบ 200 แต่ไม่ได้สแกน = ไม่ใช่ OK) · พัง */
    if (!r.ok || j?.error) {
      return NextResponse.json({ vendor: id, status: 'ERROR', detail: String(j?.error ?? `HTTP ${r.status}`) }, { status: 503 })
    }
    if (j?.staleReason) {
      return NextResponse.json({ vendor: id, status: 'STALE', detail: `สแกนใหม่ไม่ได้ ใช้ของเก่าแทน: ${String(j.staleReason)}` }, { status: 503 })
    }
    /* 🔑 `เจอบิลใหม่` = ช่อง boolean ความหมายเดียว — ฝั่ง g1 ใช้ขยับ lastBill (ห้ามให้ g1 อ่านจากข้อความ detail)
       แยกจาก "ตัวเก็บถูกเรียก" ซึ่งเป็นเรื่องของ at (CEO ชี้ 15 ต.ค. 2569: บิลรายเดือน ⇒ ห้ามเอา lastBill ไปวัด 24 ชม.) */
    const เจอบิลใหม่ = j?.newMessages === true
    return NextResponse.json({ vendor: id, status: 'OK', เจอบิลใหม่, detail: เจอบิลใหม่ ? 'สแกนแล้ว เจอบิลใหม่' : 'สแกนแล้ว ไม่มีบิลใหม่' })
  } catch (e) {
    return NextResponse.json({ vendor: id, status: 'ERROR', detail: e instanceof Error ? e.message : String(e) }, { status: 503 })
  }
}
