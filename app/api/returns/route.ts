// /api/returns — สินค้าที่ลูกค้าคืน รวมทุกช่องทาง
//
//   GET /api/returns              อ่านจากแคช (เร็ว)
//   GET /api/returns?refresh=1    บังคับดึงใหม่จาก ZORT
//   GET /api/returns?days=90      ย้อนหลังกี่วัน (ค่าเริ่มต้น 365)
//
// ⚠️ ต้องมีแคช — ใบคืนของหลายร้อยใบ ดึงใหม่ทุกครั้งที่เปิดหน้าจะช้าและยิง ZORT ถี่เกิน
//    ตัวเลขพวกนี้ไม่เปลี่ยนรายนาที เก็บ 6 ชั่วโมงพอดี · อยากได้สดกดปุ่มดึงใหม่ได้
import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import { computeReturns, type ReturnsResult } from '@/lib/returns'

export const dynamic = 'force-dynamic'
// ⚠️ Netlify ให้ฟังก์ชันแบบรอผลทำงานได้สูงสุด 26 วินาที ใส่มากกว่านี้ไม่มีผล
export const maxDuration = 26

const STORE = 'returns'
const FRESH_MS = 6 * 60 * 60 * 1000

export async function GET(request: Request) {
  const url = new URL(request.url)
  // ⚠️ ต่ำสุด 1 วัน ไม่ใช่ 7 — เจ้าของร้านต้องดูของที่เพิ่งคืนเมื่อวานได้
  //    ของคืนเป็นเรื่องที่ต้องรีบรู้ ไม่ใช่รอสรุปรายเดือน
  const days = Math.min(1095, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const refresh = url.searchParams.get('refresh') === '1'
  const key = `v1-${days}`

  const store = getStore(STORE)
  if (!refresh) {
    const cached = (await store.get(key, { type: 'json' }).catch(() => null)) as ReturnsResult | null
    if (cached?.at && Date.now() - cached.at < FRESH_MS) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  try {
    const data = await computeReturns(days)
    await store.setJSON(key, data).catch(() => {})
    return NextResponse.json({ ...data, cached: false })
  } catch (e) {
    // ⚠️ ดึงใหม่ไม่สำเร็จต้องไม่ทำให้หน้าว่างเปล่า — คืนของเก่าไปก่อนแล้วบอกว่าเป็นของเก่า
    const cached = (await store.get(key, { type: 'json' }).catch(() => null)) as ReturnsResult | null
    if (cached) return NextResponse.json({ ...cached, cached: true, stale: true })
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 502 })
  }
}
