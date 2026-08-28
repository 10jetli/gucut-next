// สินค้าที่ลูกค้าคืน — รวมทุกช่องทางจาก ZORT
//
// ออเดอร์ทุกช่องทาง (Shopee · Lazada · TikTok · หน้าร้าน) วิ่งมารวมที่ ZORT อยู่แล้ว
// ใบคืนของก็เช่นกัน จึงดูที่เดียวเห็นครบ ไม่ต้องเปิดหลังร้านทีละเจ้า
//
// ⚠️ คำถามที่ต้องตอบให้ได้คือ "ของตัวไหนถูกคืนบ่อย" ไม่ใช่แค่ "คืนไปกี่ใบ"
//    ยอดคืนรวมบอกแค่ว่าเจ็บเท่าไหร่ แต่บอกไม่ได้ว่าต้องไปแก้อะไร
//    ตัวที่ถูกคืนซ้ำ ๆ มักมีสาเหตุจริง (รูปไม่ตรง · สเปกกำกวม · ของเสียบ่อย)
import { zortFetch } from './zort'

// ⚠️ ใบคืนของจากเว็บหน้าร้าน (gucut.com) ไม่มีใน ZORT
//    ออเดอร์ถูกส่งเข้า ZORT ตอนสั่งก็จริง แต่การคืนของบนเว็บไม่ได้ส่งไป
//    ZORT จึงไม่มีวันรู้ ต้องไปดึงจากเว็บโดยตรงแล้วเอามารวมเอง
const SITE = (process.env.GUCUT_SITE_URL || 'https://gucut.com').replace(/\/$/, '')

const PAGE_SIZE = 200
const CONCURRENCY = 6

export interface ReturnLine { sku: string; name: string; qty: number; total: number }
export interface ReturnTracking { no: string; carrier: string; date: string }
export interface ReturnOrder {
  number: string
  ref: string
  date: string
  channel: string
  status: string
  paymentStatus: string
  amount: number
  shipping: number
  platformDiscount: number
  customer: string
  phone: string
  address: string
  province: string
  tracking: string
  // หนึ่งเลขแทร็ก = หนึ่งกล่อง — ZORT ไม่มีน้ำหนัก/ขนาดกล่อง จึงนับจากตรงนี้
  trackings: ReturnTracking[]
  carrier: string
  shipDate: string
  warehouse: string
  qty: number
  note: string
  lines: ReturnLine[]
}

export interface SkuReturn {
  sku: string
  name: string
  qty: number
  amount: number
  orders: number
  byChannel: Record<string, number>
}

export interface ReturnsResult {
  at: number
  days: number
  total: number
  amount: number
  byChannel: Record<string, { orders: number; amount: number }>
  byMonth: Record<string, number>
  skus: SkuReturn[]
  list: ReturnOrder[]
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const ymd = (d: Date) => d.toISOString().slice(0, 10)

/**
 * ดึงทีละหน้าแต่ยิงพร้อมกันหลายหน้า
 * ⚠️ ห้ามยิงเรียงทีละหน้า — ใบคืนของมีหลายร้อยใบ Netlify ตัดที่ 26 วินาที
 *    (บทเรียนเดียวกับ lib/reorder.ts ที่เคยโดนตัดกลางคันมาแล้ว)
 */
async function pagedList(endpoint: string, params: Record<string, string>, maxPages = 40) {
  const get = (page: number) =>
    zortFetch(endpoint, { ...params, page: String(page), limit: String(PAGE_SIZE) }) as Promise<{
      list?: Record<string, unknown>[]
      count?: number
    }>

  const first = await get(1)
  const out: Record<string, unknown>[] = Array.isArray(first?.list) ? [...first.list] : []
  if (out.length < PAGE_SIZE) return out

  const total = Number(first?.count) || 0
  const pages = Math.min(maxPages, total ? Math.ceil(total / PAGE_SIZE) : maxPages)
  for (let p = 2; p <= pages; p += CONCURRENCY) {
    const batch = []
    for (let k = p; k < p + CONCURRENCY && k <= pages; k++) batch.push(get(k))
    const res = await Promise.all(batch.map((x) => x.catch(() => ({ list: [] }))))
    let short = false
    for (const r of res) {
      const list = Array.isArray(r?.list) ? r.list : []
      out.push(...list)
      if (list.length < PAGE_SIZE) short = true
    }
    if (short) break
  }
  return out
}

/**
 * ชื่อช่องทางใน ZORT เป็น "Shopee-gucut" / "Lazada-gucut"
 * ⚠️ ตัดหางชื่อร้านออกให้เหลือชื่อแพลตฟอร์ม ไม่งั้นร้านเดียวกันคนละชื่อจะนับแยกกัน
 *    และร้านที่เปิดหลายบัญชีในแพลตฟอร์มเดียวจะกลายเป็นคนละช่องทาง
 */
export function channelOf(raw: string): string {
  const s = raw.trim()
  if (!s) return 'ไม่ระบุ'
  const m = /^(shopee|lazada|tiktok|shopify|line|facebook)/i.exec(s)
  if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  return s.split('-')[0] || s
}

/**
 * ใบคืนของจากเว็บหน้าร้าน
 * ⚠️ ต้องมี GUCUT_ADMIN_KEY ใน env ถึงจะดึงได้ — ไม่มีก็แค่ไม่รวมเว็บเข้ามา
 *    ห้ามให้ทั้งหน้าพังเพราะเว็บล่มหรือยังไม่ได้ตั้งคีย์ ใบคืนจาก ZORT ยังต้องดูได้
 */
async function siteReturns(days: number): Promise<ReturnOrder[]> {
  const key = (process.env.GUCUT_ADMIN_KEY || '').trim()
  if (!key) return []
  try {
    const r = await fetch(`${SITE}/api/returns-feed?days=${days}`, {
      headers: { 'x-admin-key': key },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return []
    const j = (await r.json()) as { list?: ReturnOrder[] }
    return Array.isArray(j.list) ? j.list : []
  } catch {
    return []
  }
}

export async function computeReturns(days = 30): Promise<ReturnsResult> {
  const today = new Date()
  const start = new Date(today.getTime() - days * 86400_000)
  const [raw, fromSite] = await Promise.all([
    pagedList('ReturnOrder/GetReturnOrders', {
      returnorderdateafter: ymd(start),
      returnorderdatebefore: ymd(today),
    }),
    siteReturns(days),
  ])

  const list: ReturnOrder[] = []
  const byChannel: Record<string, { orders: number; amount: number }> = {}
  const byMonth: Record<string, number> = {}
  const skuMap = new Map<string, SkuReturn>()

  for (const r of raw) {
    const channel = channelOf(str(r.saleschannel))
    const date = str(r.returnorderdateString) || str(r.createdatetimeString).slice(0, 10)
    // ⚠️ ใช้ paymentamount ไม่ใช่ amount — paymentamount คือเงินที่คืนให้ลูกค้าจริง
    const amount = num(r.paymentamount) || num(r.amount)

    const lines: ReturnLine[] = (Array.isArray(r.list) ? r.list : []).map((x) => {
      const it = x as Record<string, unknown>
      return { sku: str(it.sku), name: str(it.name), qty: num(it.number), total: num(it.totalprice) }
    })

    // ที่อยู่ต้นทางที่ลูกค้าส่งคืนมา — Shopee เซ็นเซอร์บ้านเลขที่ให้เอง เหลือระดับตำบลขึ้นไป
    const address = [str(r.customersubdistrict) && `ต.${str(r.customersubdistrict)}`,
      str(r.customerdistrict) && `อ.${str(r.customerdistrict)}`,
      str(r.customerprovince), str(r.customerpostcode)].filter(Boolean).join(' ')
    const trackings: ReturnTracking[] = (Array.isArray(r.trackingList) ? r.trackingList : []).map((t) => {
      const x = t as Record<string, unknown>
      return { no: str(x.trackingno), carrier: str(x.shippingchannel), date: str(x.shippingdate).slice(0, 10) }
    }).filter((t) => t.no)

    list.push({
      number: str(r.number),
      ref: str(r.referencenumber) || str(r.reference),
      date,
      channel,
      status: str(r.status),
      paymentStatus: str(r.paymentstatus),
      amount,
      shipping: num(r.shippingamount),
      platformDiscount: num(r.platformdiscount),
      customer: str(r.customername),
      phone: str(r.customerphone),
      address,
      province: str(r.customerprovince),
      tracking: str(r.trackingno),
      trackings,
      carrier: trackings[0]?.carrier || '',
      shipDate: trackings[0]?.date || '',
      warehouse: str(r.warehousecode),
      qty: lines.reduce((n, l) => n + l.qty, 0),
      note: str(r.description),
      lines,
    })

    const c = (byChannel[channel] ||= { orders: 0, amount: 0 })
    c.orders += 1
    c.amount += amount
    if (date) byMonth[date.slice(0, 7)] = (byMonth[date.slice(0, 7)] || 0) + 1

    for (const l of lines) {
      if (!l.sku) continue
      const cur = skuMap.get(l.sku) || {
        sku: l.sku, name: l.name, qty: 0, amount: 0, orders: 0, byChannel: {},
      }
      cur.qty += l.qty
      cur.amount += l.total
      cur.orders += 1
      cur.byChannel[channel] = (cur.byChannel[channel] || 0) + l.qty
      if (!cur.name) cur.name = l.name
      skuMap.set(l.sku, cur)
    }
  }

  // รวมใบคืนจากเว็บหน้าร้านเข้าไปด้วย — นับเข้าช่องทาง/เดือน/SKU ชุดเดียวกัน
  for (const o of fromSite) {
    // ใบคืนจากเว็บอาจส่ง field ใหม่มาไม่ครบ — เติมค่าว่างเฉพาะช่องที่ขาด
    const defaults = {
      paymentStatus: '', shipping: 0, platformDiscount: 0, address: '', trackings: [],
      carrier: '', shipDate: '', warehouse: '', note: '',
      qty: (o.lines || []).reduce((n, l) => n + l.qty, 0),
    }
    list.push({ ...defaults, ...(o as Partial<ReturnOrder>) } as ReturnOrder)
    const c = (byChannel[o.channel] ||= { orders: 0, amount: 0 })
    c.orders += 1
    c.amount += o.amount
    if (o.date) byMonth[o.date.slice(0, 7)] = (byMonth[o.date.slice(0, 7)] || 0) + 1
    for (const l of o.lines) {
      if (!l.sku) continue
      const cur = skuMap.get(l.sku) || {
        sku: l.sku, name: l.name, qty: 0, amount: 0, orders: 0, byChannel: {},
      }
      cur.qty += l.qty
      cur.amount += l.total
      cur.orders += 1
      cur.byChannel[o.channel] = (cur.byChannel[o.channel] || 0) + l.qty
      if (!cur.name) cur.name = l.name
      skuMap.set(l.sku, cur)
    }
  }

  list.sort((a, b) => (a.date < b.date ? 1 : -1))
  const skus = Array.from(skuMap.values()).sort((a, b) => b.qty - a.qty)

  return {
    at: Date.now(),
    days,
    total: list.length,
    amount: Math.round(list.reduce((s, x) => s + x.amount, 0)),
    byChannel,
    byMonth,
    skus,
    list,
  }
}
