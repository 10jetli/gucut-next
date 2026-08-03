import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import type { TrackerOrder } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STORE = 'tracker'
const KEY = 'orders'

async function readOrders(): Promise<TrackerOrder[]> {
  const store = getStore(STORE)
  const raw = await store.get(KEY, { type: 'json' })
  return Array.isArray(raw) ? (raw as TrackerOrder[]) : []
}

async function writeOrders(orders: TrackerOrder[]) {
  const store = getStore(STORE)
  await store.setJSON(KEY, orders)
}

export async function GET() {
  try {
    const orders = await readOrders()
    // ใหม่สุดขึ้นก่อน
    orders.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
    return NextResponse.json({ ok: true, orders })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.product) {
      return NextResponse.json({ ok: false, error: 'ต้องมีชื่อสินค้า' }, { status: 400 })
    }
    const orders = await readOrders()
    const now = new Date().toISOString()
    const newOrder: TrackerOrder = {
      id: Date.now(),
      product: String(body.product),
      factory: String(body.factory ?? ''),
      qty: Number(body.qty) || 0,
      deposit: String(body.deposit ?? ''),
      total: String(body.total ?? ''),
      due: String(body.due ?? ''),
      status: body.status ?? 'pending',
      note: String(body.note ?? ''),
      updated: now,
      images: Array.isArray(body.images) ? body.images : [],
    }
    orders.push(newOrder)
    await writeOrders(orders)
    return NextResponse.json({ ok: true, order: newOrder })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ ok: false, error: 'ต้องมี id' }, { status: 400 })

    const orders = await readOrders()
    const idx = orders.findIndex(o => o.id === id)
    if (idx === -1) return NextResponse.json({ ok: false, error: 'ไม่พบรายการนี้' }, { status: 404 })

    const existing = orders[idx]
    const updated: TrackerOrder = {
      ...existing,
      product: body.product !== undefined ? String(body.product) : existing.product,
      factory: body.factory !== undefined ? String(body.factory) : existing.factory,
      qty: body.qty !== undefined ? Number(body.qty) || 0 : existing.qty,
      deposit: body.deposit !== undefined ? String(body.deposit) : existing.deposit,
      total: body.total !== undefined ? String(body.total) : existing.total,
      due: body.due !== undefined ? String(body.due) : existing.due,
      status: body.status !== undefined ? body.status : existing.status,
      note: body.note !== undefined ? String(body.note) : existing.note,
      images: body.images !== undefined ? body.images : existing.images,
      updated: new Date().toISOString(),
    }
    orders[idx] = updated
    await writeOrders(orders)
    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (!id) return NextResponse.json({ ok: false, error: 'ต้องมี id' }, { status: 400 })

    const orders = await readOrders()
    const next = orders.filter(o => o.id !== id)
    await writeOrders(next)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
