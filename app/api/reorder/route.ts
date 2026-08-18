// /api/reorder — บอกว่าควรสั่งอะไร เท่าไหร่ ด่วนแค่ไหน (รวมทุกแพลตฟอร์มจาก ZORT)
//
//   GET /api/reorder                      อ่านจากแคช (เร็ว)
//   GET /api/reorder?refresh=1            บังคับดึงใหม่จาก ZORT
//   GET /api/reorder?lead=45&cover=120    ปรับเวลารอของ / จำนวนวันที่อยากมีของ
//
// ⚠️ ทำไมต้องมีแคช
//    ต้องดึงออเดอร์ย้อนหลัง 1 ปี (หลายพันใบ) + สินค้าทั้งหมด ใช้เวลาหลายสิบวินาที
//    ถ้าดึงใหม่ทุกครั้งที่เปิดหน้า จะช้าจนใช้งานไม่ได้ และยิง ZORT ถี่เกินจำเป็น
//    ตัวเลขพวกนี้ไม่ได้เปลี่ยนรายนาที เก็บไว้ 6 ชั่วโมงกำลังพอดี
//    ต้องการเลขสดจริง ๆ ก็กดปุ่มดึงใหม่ในหน้าเว็บได้
import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import { computeReorder, DEFAULT_COVER_DAYS, DEFAULT_LEAD_DAYS } from '@/lib/reorder'
import type { ReorderResult } from '@/lib/reorder'

export const dynamic = 'force-dynamic'
// ดึง 1 ปีใช้เวลานาน — ขอเวลาทำงานให้พอ ไม่งั้นโดนตัดกลางคัน
export const maxDuration = 120

const STORE = 'reorder'
const FRESH_MS = 6 * 60 * 60 * 1000   // แคชสด 6 ชั่วโมง

const keyOf = (lead: number, cover: number) => `v1-${lead}-${cover}`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lead = Math.max(1, Number(url.searchParams.get('lead')) || DEFAULT_LEAD_DAYS)
  const cover = Math.max(1, Number(url.searchParams.get('cover')) || DEFAULT_COVER_DAYS)
  const force = url.searchParams.get('refresh') === '1'

  const store = getStore(STORE)
  const key = keyOf(lead, cover)

  if (!force) {
    try {
      const cached = (await store.get(key, { type: 'json' })) as ReorderResult | null
      if (cached && Date.now() - cached.at < FRESH_MS) {
        return NextResponse.json({ ...cached, cached: true })
      }
    } catch { /* แคชอ่านไม่ได้ก็คำนวณใหม่ ไม่ใช่เรื่องใหญ่ */ }
  }

  try {
    const result = await computeReorder(lead, cover)
    // เขียนแคชแบบไม่รอ — ผู้ใช้ไม่ควรต้องรอขั้นตอนนี้
    store.setJSON(key, result).catch(() => {})
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    // ดึงไม่สำเร็จ — ถ้ามีของเก่าในแคชก็ยังดีกว่าไม่มีอะไรเลย บอกให้รู้ว่าเป็นของเก่า
    try {
      const stale = (await store.get(key, { type: 'json' })) as ReorderResult | null
      if (stale) return NextResponse.json({ ...stale, cached: true, stale: true })
    } catch { /* ไม่มีก็แล้วไป */ }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ดึงข้อมูลจาก ZORT ไม่สำเร็จ' },
      { status: 502 },
    )
  }
}
