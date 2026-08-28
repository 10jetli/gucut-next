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

export async function GET() {
  const store = getStore('returns')
  const map: Record<string, RecvState> = {}
  try {
    const { blobs } = await store.list({ prefix: PREFIX })
    // ใบคืนมีไม่กี่สิบใบต่อปี อ่านทีละใบไหวสบาย
    await Promise.all(
      blobs.map(async (b) => {
        const v = (await store.get(b.key, { type: 'json' }).catch(() => null)) as RecvState | null
        if (v) map[b.key.slice(PREFIX.length)] = v
      }),
    )
  } catch {}
  return NextResponse.json({ map })
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
