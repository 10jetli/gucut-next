// /api/returns-summary — สรุปใบคืนของ รวมทุกช่องทาง (จอ `/returns` "สินค้าที่ถูกคืนบ่อย")
//
//   GET /api/returns-summary            อ่านจากแคช (เร็ว)
//   GET /api/returns-summary?refresh=1  บังคับดึงใหม่จาก ZORT
//   GET /api/returns-summary?days=90    ย้อนหลังกี่วัน (ค่าเริ่มต้น 30)
//
// 🔴 **ทำไมไม่อยู่ที่ `/api/returns` เหมือนเดิม (28 ก.ย. 2569 · ใบ B08)**
//    เส้นนี้เคยอยู่ที่ `/api/returns` แต่คอมมิต 755a7f3 (7 ก.ย. 2569) เขียนท่อ whitelist
//    ของ **จอรับคืนสินค้า** (ซึ่งเปิดให้ staff) ทับ path เดียวกัน ⇒ ท่อสรุปหายไปทั้งตัว
//    ⇒ จอ `/returns` ยิงแล้วได้ **403 ทุกครั้งมา 21 วัน** และ `lib/returns.ts` ทั้งไฟล์
//      ก็ไม่มีใครเรียกอีกเลย (วัดจริง: grep computeReturns เจอแต่บรรทัดที่ประกาศตัวมันเอง)
//    ⚠️ **ห้ามย้ายกลับไปรวม path กับ `/api/returns`** — ท่อนั้นเปิดให้พนักงานหน้าร้าน
//      ส่วนเส้นนี้เป็นยอดขาย/ยอดคืนทั้งร้าน = ของแอดมินเท่านั้น (คนละสิทธิ์ ⇒ คนละ path)
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

/* แคชอ่าน/เขียนไม่ได้ **ไม่ใช่เหตุให้จอว่าง** — นอก Netlify (เช่น dev บน g1) getStore โยน error
   ⇒ ห่อไว้แล้วเดินต่อแบบไม่มีแคช พร้อมบอกจอว่ารอบนี้ไม่ได้ใช้แคช (ไม่ใช่เงียบ) */
function เปิดแคช(): { get: (k: string) => Promise<ReturnsResult | null>; set: (k: string, v: ReturnsResult) => Promise<void> } | null {
  try {
    const store = getStore(STORE)
    return {
      get: async (k) => (await store.get(k, { type: 'json' }).catch(() => null)) as ReturnsResult | null,
      set: async (k, v) => { await store.setJSON(k, v).catch(() => {}) },
    }
  } catch { return null }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  // ⚠️ ต่ำสุด 1 วัน ไม่ใช่ 7 — เจ้าของร้านต้องดูของที่เพิ่งคืนเมื่อวานได้
  //    ของคืนเป็นเรื่องที่ต้องรีบรู้ ไม่ใช่รอสรุปรายเดือน
  const days = Math.min(1095, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const refresh = url.searchParams.get('refresh') === '1'
  const key = `v2-${days}`

  const แคช = เปิดแคช()
  if (!refresh && แคช) {
    const cached = await แคช.get(key)
    if (cached?.at && Date.now() - cached.at < FRESH_MS) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  try {
    const data = await computeReturns(days)
    if (แคช) await แคช.set(key, data)
    return NextResponse.json({ ...data, cached: false, cacheUsable: Boolean(แคช) })
  } catch (e) {
    // ⚠️ ดึงใหม่ไม่สำเร็จต้องไม่ทำให้หน้าว่างเปล่า — คืนของเก่าไปก่อนแล้วบอกว่าเป็นของเก่า
    const cached = แคช ? await แคช.get(key) : null
    if (cached) return NextResponse.json({ ...cached, cached: true, stale: true })
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 502 })
  }
}
