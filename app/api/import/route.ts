// /api/import — รายการสินค้าจีนที่กำลังพิจารณานำเข้า + ค่าตั้งค่าการคิดต้นทุน
//
//   GET                    รายการทั้งหมด + ค่าตั้งค่า + ข้อมูลของเดิมในคลัง (ถ้าผูก SKU ไว้)
//   POST {settings}        บันทึกค่าตั้งค่า
//   POST {item}            เพิ่ม/แก้รายการ
//   POST {del}             ลบรายการ
import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import { DEFAULT_SETTINGS, type ImportItem, type ImportSettings } from '@/lib/import-cost'
import type { ReorderResult } from '@/lib/reorder'

export const dynamic = 'force-dynamic'

const STORE = 'import'
const ITEMS = 'items'
const SETTINGS = 'settings'

const store = () => getStore(STORE)

async function readAll() {
  const s = store()
  const [items, settings] = await Promise.all([
    s.get(ITEMS, { type: 'json' }).catch(() => null) as Promise<ImportItem[] | null>,
    s.get(SETTINGS, { type: 'json' }).catch(() => null) as Promise<ImportSettings | null>,
  ])
  return {
    items: Array.isArray(items) ? items : [],
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
  }
}

/**
 * ข้อมูลของเดิมในคลังสำหรับ SKU ที่ผูกไว้
 *
 * ⚠️ อ่านจาก "แคชของหน้าคลังอะไหล่" เท่านั้น ห้ามยิง ZORT ใหม่ที่นี่
 *    การคำนวณนั้นใช้เวลาหลายสิบวินาที (ออเดอร์ย้อนหลังปีนึง) ถ้าเรียกจากหน้านี้ด้วย
 *    หน้าจะค้างและ Netlify ตัดที่ 26 วินาที — ไม่มีแคชก็แค่ไม่โชว์ ไม่ใช่เรื่องคอขาดบาดตาย
 */
async function stockInfo(skus: string[]) {
  if (!skus.length) return {}
  try {
    const { blobs } = await getStore('reorder').list()
    if (!blobs.length) return {}
    const raw = (await getStore('reorder').get(blobs[0].key, { type: 'json' })) as
      | { data?: ReorderResult }
      | ReorderResult
      | null
    const result = (raw as { data?: ReorderResult })?.data ?? (raw as ReorderResult | null)
    if (!result?.skus) return {}
    const want = new Set(skus.map(s => s.trim().toUpperCase()))
    const out: Record<string, { stock: number; perDay: number; suggest: number; sold: number }> = {}
    for (const s of result.skus) {
      if (!want.has(s.sku.trim().toUpperCase())) continue
      out[s.sku.trim().toUpperCase()] = {
        stock: s.stock, perDay: s.perDay, suggest: s.suggest, sold: s.sold,
      }
    }
    return out
  } catch {
    return {}
  }
}

export async function GET() {
  const { items, settings } = await readAll()
  const stock = await stockInfo(items.map(i => i.sku || '').filter(Boolean))
  return NextResponse.json({ items, settings, stock })
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 }) }
  const s = store()
  const { items, settings } = await readAll()

  if (body.settings) {
    const inp = body.settings as Partial<ImportSettings>
    const num = (v: unknown, def: number, lo = 0, hi = 1e9) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= lo && n <= hi ? n : def
    }
    const next: ImportSettings = {
      // ⚠️ เรทต่ำกว่า 3 หรือสูงกว่า 8 คือกรอกผิดแน่ ๆ (เรทจริงแกว่งราว 4.8-5.4)
      rate: num(inp.rate, settings.rate, 3, 8),
      perKg: num(inp.perKg, settings.perKg, 0, 1000),
      perCbm: num(inp.perCbm, settings.perCbm, 0, 100000),
      handling: num(inp.handling, settings.handling, 0, 10000),
      minMargin: num(inp.minMargin, settings.minMargin, 0, 90),
    }
    await s.setJSON(SETTINGS, next)
    return NextResponse.json({ ok: true, settings: next })
  }

  if (body.del) {
    await s.setJSON(ITEMS, items.filter(i => i.id !== body.del))
    return NextResponse.json({ ok: true })
  }

  if (body.item) {
    const inp = body.item as Partial<ImportItem>
    const name = String(inp.name ?? '').trim().slice(0, 120)
    if (!name) return NextResponse.json({ error: 'ต้องใส่ชื่อสินค้า' }, { status: 400 })
    const n = (v: unknown) => Math.max(0, Number(v) || 0)
    const rec: ImportItem = {
      id: String(inp.id || `i${Date.now().toString(36)}`),
      name,
      url: String(inp.url ?? '').trim().slice(0, 500) || undefined,
      yuan: n(inp.yuan),
      qty: Math.max(1, Math.round(n(inp.qty)) || 1),
      kg: n(inp.kg),
      cbm: n(inp.cbm),
      sku: String(inp.sku ?? '').trim().slice(0, 60) || undefined,
      sell: n(inp.sell) || undefined,
      note: String(inp.note ?? '').trim().slice(0, 300) || undefined,
      at: Number(inp.at) || Date.now(),
    }
    const idx = items.findIndex(i => i.id === rec.id)
    if (idx >= 0) items[idx] = rec
    else items.unshift(rec)
    await s.setJSON(ITEMS, items)
    return NextResponse.json({ ok: true, item: rec })
  }

  return NextResponse.json({ error: 'ไม่รู้จักคำสั่งนี้' }, { status: 400 })
}
