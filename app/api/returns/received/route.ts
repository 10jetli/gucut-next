// ตามของคืน — จดสถานะพัสดุคืนสองขั้น: ขนส่งส่งถึงร้านแล้ว → ร้านตรวจรับแล้ว (ใครรับ)
//
//   GET  /api/returns/received  → { map: { "CN-xxx": { delivered?, received?, by? } } }
//   POST /api/returns/received  { number, stage: 'delivered'|'received'|'clear', by? }
//
// ⚠️ Flash ไม่เปิดสถานะพัสดุให้ระบบภายนอก (ยิงทดสอบแล้วโดนบล็อก — บทเรียนหน้าติดตามพัสดุ)
//    สถานะจึงมาจากคนที่ร้านกดเอง ไม่ใช่ดึงอัตโนมัติ
// ⚠️ หนึ่งใบคืน = หนึ่งคีย์ (rc/<เลขใบคืน>) ห้ามรวมก้อนเดียวแล้วอ่าน-แก้-เขียนกลับ
import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export const dynamic = 'force-dynamic'

const PREFIX = 'rc/'

export interface RecvState { delivered?: number; received?: number; by?: string }

/* 🔴 **"อ่านไม่ได้" ห้ามตอบเป็น "ไม่มีอะไร"** — บทเรียนคืน 7 ก.ย. 2569
   ของเดิม: list() ล้ม → `catch {}` → ตอบ `{ map: {} }` พร้อม **HTTP 200**
   ⇒ จอเห็นคำตอบที่ถูกต้องทุกประการ แล้วประกาศว่า **ทุกใบยังไม่ได้รับของ**
   ⇒ คนไปตามของที่มาถึงแล้ว หรือกดรับซ้ำ
   ⚠️ และมันทำให้ตาข่ายฝั่งจอที่เพิ่งใส่ไป (เช็คว่ามีช่อง map ไหม) **ไร้ผลทันที**
      เพราะช่องมีจริง แค่ว่างเปล่า ⇒ ฝั่งเซิร์ฟเวอร์ต้องบอกความจริงเองด้วย
   (คลาสเดียวกับที่ฝั่งท่อเพิ่งเจอ: อ่าน DISTINCT ไม่ได้ = "ยังไม่เคยเขียนสักใบ" แล้วเขียนใหม่ทั้งระบบ) */
export async function GET() {
  const store = getStore('returns')
  const map: Record<string, RecvState> = {}
  let unreadable = 0
  try {
    const { blobs } = await store.list({ prefix: PREFIX })
    // ใบคืนมีไม่กี่สิบใบต่อปี อ่านทีละใบไหวสบาย
    await Promise.all(
      blobs.map(async (b) => {
        const v = (await store.get(b.key, { type: 'json' }).catch(() => {
          // อ่านใบนี้ไม่ได้ ≠ ใบนี้ไม่มีสถานะ ⇒ นับไว้แล้วบอกจอ
          unreadable++
          return null
        })) as RecvState | null
        if (v) map[b.key.slice(PREFIX.length)] = v
      }),
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'อ่านสถานะการรับของไม่ได้ — ' + String((e as Error)?.message || e) },
      { status: 502 },
    )
  }
  return NextResponse.json({ map, unreadable })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    number?: string; stage?: string; by?: string
  }
  const number = (body.number || '').trim()
  if (!number || number.length > 60) {
    return NextResponse.json({ error: 'ต้องระบุเลขใบคืน' }, { status: 400 })
  }
  const store = getStore('returns')
  const key = PREFIX + number
  const cur = ((await store.get(key, { type: 'json' }).catch(() => null)) as RecvState | null) || {}

  if (body.stage === 'delivered') {
    await store.setJSON(key, { ...cur, delivered: Date.now() })
  } else if (body.stage === 'received') {
    // ชื่อคนรับ — จดไว้ว่าใครเป็นคนแกะกล่อง เผื่อของขาด/สภาพมีปัญหาจะได้ถามถูกคน
    const by = (body.by || '').trim().slice(0, 40)
    await store.setJSON(key, { ...cur, delivered: cur.delivered || Date.now(), received: Date.now(), by })
  } else if (body.stage === 'clear') {
    await store.delete(key)
  } else {
    return NextResponse.json({ error: 'stage ไม่ถูกต้อง' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
