// รายงานการขายทุกช่องทาง — รวมออเดอร์จาก ZORT ทั้ง 2 ร้าน (สาขา 1 + สาขา 2)
// ช่องทางอ่านจาก saleschannel ของออเดอร์จริง (Shopee/Lazada/TikTok/🔮GUCUT.COM/POS)
// ไม่เดาชื่อช่องทางตายตัว — ร้านเพิ่มช่องทางใหม่ใน ZORT แล้วรายงานเห็นเองทันที
import { NextRequest, NextResponse } from 'next/server'
import { zortFetch } from '@/lib/zort'

export const dynamic = 'force-dynamic'

interface ZortOrderItem {
  sku?: string
  name?: string
  productname?: string
  number?: number
  quantity?: number
  totalprice?: number
  pricepernumber?: number
}
interface ZortOrder {
  number: string
  status: string | number
  amount: number
  saleschannel?: string
  orderdateString?: string
  createdatetimeString?: string
  list?: ZortOrderItem[]
}

// วันแบบไทย (UTC+7) — เซิร์ฟเวอร์รัน UTC ห้ามใช้ toISOString ตรง ๆ (กติกาเดียวกับระบบลงเวลา)
function thaiToday(): Date {
  return new Date(Date.now() + 7 * 3600e3)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ZORT ส่งวันที่มาได้หลายทรง (dd/mm/yyyy · ISO · บางทีปี พ.ศ.) — แกะแบบกันเหนียว
function parseZortDate(o: ZortOrder): string | null {
  const s = o.orderdateString || o.createdatetimeString || ''
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    let y = parseInt(m[3], 10)
    if (y > 2400) y -= 543
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    let y = parseInt(iso[1], 10)
    if (y > 2400) y -= 543
    return `${y}-${iso[2]}-${iso[3]}`
  }
  return null
}

const CANCELLED = /void|cancel|ยกเลิก/i

async function fetchOrders(storeId: string, after: string, before: string): Promise<ZortOrder[]> {
  const out: ZortOrder[] = []
  // กับดักที่รู้แล้ว: GetOrders ใช้ page= เท่านั้น (ห้าม offset=) และกรองวันที่ฝั่งเราซ้ำเสมอ
  for (let page = 1; page <= 6; page++) {
    const res = (await zortFetch(
      'Order/GetOrders',
      { orderdateafter: after, orderdatebefore: before, limit: '200', page: String(page) },
      storeId
    )) as { list?: ZortOrder[] } | null
    const list = Array.isArray(res?.list) ? res.list : []
    out.push(...list)
    if (list.length < 200) break
  }
  return out
}

export async function GET(request: NextRequest) {
  const days = Math.min(30, Math.max(1, parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10) || 7))

  const today = thaiToday()
  const to = ymd(today)
  const from = ymd(new Date(today.getTime() - (days - 1) * 864e5))
  // ดึงเผื่อช่วงก่อนหน้าไว้เทียบ % การเปลี่ยนแปลง
  const prevFrom = ymd(new Date(today.getTime() - (days * 2 - 1) * 864e5))

  try {
    const [s1, s2] = await Promise.all([
      fetchOrders('1', prevFrom, to).catch(() => [] as ZortOrder[]),
      fetchOrders('2', prevFrom, to).catch(() => [] as ZortOrder[]),
    ])

    const daily = new Map<string, { sales: number; orders: number }>()
    for (let i = 0; i < days; i++) {
      daily.set(ymd(new Date(today.getTime() - i * 864e5)), { sales: 0, orders: 0 })
    }

    interface Chan { name: string; store: string; sales: number; orders: number; prevSales: number }
    const channels = new Map<string, Chan>()
    const products = new Map<string, { name: string; sku: string; qty: number; amount: number }>()
    let cur = { sales: 0, orders: 0 }
    let prev = { sales: 0, orders: 0 }
    let hasItems = false

    const seen = new Set<string>() // กันออเดอร์ซ้ำข้ามหน้า (ZORT เคยส่งซ้ำตอนข้อมูลขยับระหว่างดึง)

    for (const [storeId, orders] of [['1', s1], ['2', s2]] as const) {
      for (const o of orders) {
        const key = `${storeId}/${o.number}`
        if (seen.has(key)) continue
        seen.add(key)
        if (CANCELLED.test(String(o.status))) continue
        const d = parseZortDate(o)
        if (!d || d < prevFrom || d > to) continue
        const amt = typeof o.amount === 'number' ? o.amount : 0
        const inCurrent = d >= from

        const rawChan = (o.saleschannel || '').trim()
        const chanName = rawChan || `POS หน้าร้าน`
        const ckey = `${chanName}|${storeId}`
        const c = channels.get(ckey) ?? { name: chanName, store: storeId, sales: 0, orders: 0, prevSales: 0 }
        if (inCurrent) { c.sales += amt; c.orders += 1 } else { c.prevSales += amt }
        channels.set(ckey, c)

        if (inCurrent) {
          cur.sales += amt
          cur.orders += 1
          const bucket = daily.get(d)
          if (bucket) { bucket.sales += amt; bucket.orders += 1 }
          if (Array.isArray(o.list)) {
            for (const it of o.list) {
              const qty = it.number ?? it.quantity ?? 0
              const amount = it.totalprice ?? (it.pricepernumber ?? 0) * qty
              const name = it.name || it.productname || it.sku || '?'
              if (!qty && !amount) continue
              hasItems = true
              const p = products.get(name) ?? { name, sku: it.sku ?? '', qty: 0, amount: 0 }
              p.qty += qty
              p.amount += amount
              products.set(name, p)
            }
          }
        } else {
          prev.sales += amt
          prev.orders += 1
        }
      }
    }

    // ชื่อช่องทางซ้ำกันสองสาขา (เช่น POS ทั้งคู่) → ติดป้ายสาขาให้แยกออก
    const nameCount = new Map<string, number>()
    Array.from(channels.values()).forEach((c) => nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1))
    const channelRows = Array.from(channels.values())
      .map((c) => ({
        ...c,
        label: (nameCount.get(c.name) ?? 0) > 1 ? `${c.name} (สาขา ${c.store})` : c.name,
      }))
      .filter((c) => c.sales > 0 || c.orders > 0 || c.prevSales > 0)
      .sort((a, b) => b.sales - a.sales)

    return NextResponse.json({
      range: { from, to, days },
      totals: {
        sales: cur.sales,
        orders: cur.orders,
        avg: cur.orders ? cur.sales / cur.orders : 0,
        prevSales: prev.sales,
        prevOrders: prev.orders,
      },
      daily: Array.from(daily.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      channels: channelRows,
      topProducts: hasItems
        ? Array.from(products.values()).sort((a, b) => b.amount - a.amount).slice(0, 10)
        : null,
    })
  } catch (err) {
    console.error('[sales-report]', err)
    return NextResponse.json({ error: 'ดึงข้อมูลจาก ZORT ไม่สำเร็จ', detail: String(err) }, { status: 500 })
  }
}
