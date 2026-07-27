import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// บัญชี ZORT สำหรับระบบโอนสินค้า (3 บัญชี) — ตั้งใน Vercel env
// ลำดับตรงกับฟอร์มตั้งค่าเดิม: 1=ศีตกาล/โกดัง (คลัง NEW), 2=ZAMA/ANJ (คลัง ANJ), 3=ZAMA/KLD (คลัง KLD)
// env ที่ต้องตั้ง: ZORT_TRF_STORENAME_1..3, ZORT_TRF_APIKEY_1..3, ZORT_TRF_APISECRET_1..3
// ล้างค่าที่อาจติดมาตอนวางค่า: ช่องว่าง/ขึ้นบรรทัด/เครื่องหมายคำพูดหุ้มค่า
const cleanEnv = (v?: string) => (v ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']+|["']+$/g, '').trim()
const TRF_STORES = [1, 2, 3].map(i => ({
  s: cleanEnv(process.env[`ZORT_TRF_STORENAME_${i}`]),
  k: cleanEnv(process.env[`ZORT_TRF_APIKEY_${i}`]),
  x: cleanEnv(process.env[`ZORT_TRF_APISECRET_${i}`]),
}))

const BASE = 'https://open-api.zortout.com/v4'
const isConfigured = () => TRF_STORES.every(a => a.s && a.k && a.x)
const headOf = (a: { s: string; k: string; x: string }) => ({
  storename: a.s,
  apikey: a.k,
  apisecret: a.x,
  'Content-Type': 'application/json',
})

function pickStore(storeParam: string | null) {
  const idx = Number(storeParam ?? '0')
  if (!Number.isInteger(idx) || idx < 1 || idx > 3) return null
  return TRF_STORES[idx - 1]
}

// GET /api/transfer?op=status                    → เช็คว่าตั้งค่า env ครบไหม (ไม่เปิดเผยกุญแจ)
// GET /api/transfer?op=recent&store=N            → ใบโอนล่าสุดของบัญชี N
// GET /api/transfer?op=warehouses&store=N        → รายชื่อคลังของบัญชี N (ใช้ทดสอบการเชื่อมต่อ)
export async function GET(req: NextRequest) {
  const op = req.nextUrl.searchParams.get('op')
  if (op === 'status') return NextResponse.json({ configured: isConfigured() })
  if (op === 'diag') {
    // ตรวจค่า env แบบไม่เปิดเผยกุญแจ: ส่งเฉพาะความยาว + hash ย่อ ไว้เทียบกับค่าที่ถูกต้อง
    const h8 = async (v: string) => {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))
      return Array.from(new Uint8Array(b)).slice(0, 4).map(n => n.toString(16).padStart(2, '0')).join('')
    }
    const stores = [] as any[]
    for (const a of TRF_STORES) {
      stores.push({ sLen: a.s.length, kLen: a.k.length, xLen: a.x.length, sH: await h8(a.s), kH: await h8(a.k), xH: await h8(a.x) })
    }
    return NextResponse.json({ stores })
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ZORT_TRF_* บน Vercel' }, { status: 400 })
  }
  const acc = pickStore(req.nextUrl.searchParams.get('store'))
  if (!acc) return NextResponse.json({ error: 'store ต้องเป็น 1-3' }, { status: 400 })
  try {
    if (op === 'recent') {
      const r = await fetch(`${BASE}/Transfer/GetTransfers?page=1&limit=8`, { headers: headOf(acc), cache: 'no-store' })
      return NextResponse.json(await r.json())
    }
    if (op === 'warehouses') {
      const r = await fetch(`${BASE}/Warehouse/GetWarehouses`, { headers: headOf(acc), cache: 'no-store' })
      return NextResponse.json(await r.json())
    }
    return NextResponse.json({ error: 'op ไม่ถูกต้อง' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/transfer  { op: 'add', store: N, payload: {...} }  → สร้างใบโอน
// POST /api/transfer  { op: 'void', store: N, id: '...' }      → ยกเลิกใบโอน
export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ZORT_TRF_* บน Vercel' }, { status: 400 })
  }
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'body ต้องเป็น JSON' }, { status: 400 })
  }
  const acc = pickStore(String(body?.store ?? ''))
  if (!acc) return NextResponse.json({ error: 'store ต้องเป็น 1-3' }, { status: 400 })
  try {
    if (body.op === 'add') {
      const r = await fetch(`${BASE}/Transfer/AddTransfer`, {
        method: 'POST',
        headers: headOf(acc),
        body: JSON.stringify(body.payload ?? {}),
      })
      return NextResponse.json(await r.json())
    }
    if (body.op === 'void') {
      const r = await fetch(`${BASE}/Transfer/VoidTransfer?id=${encodeURIComponent(String(body.id ?? ''))}`, {
        method: 'POST',
        headers: headOf(acc),
        body: '{}',
      })
      return NextResponse.json(await r.json())
    }
    return NextResponse.json({ error: 'op ไม่ถูกต้อง' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
