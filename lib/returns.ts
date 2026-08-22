// สินค้าที่ลูกค้าคืน — รวมทุกช่องทางจาก ZORT
//
// ออเดอร์ทุกช่องทาง (Shopee · Lazada · TikTok · หน้าร้าน) วิ่งมารวมที่ ZORT อยู่แล้ว
// ใบคืนของก็เช่นกัน จึงดูที่เดียวเห็นครบ ไม่ต้องเปิดหลังร้านทีละเจ้า
//
// ⚠️ คำถามที่ต้องตอบให้ได้คือ "ของตัวไหนถูกคืนบ่อย" ไม่ใช่แค่ "คืนไปกี่ใบ"
//    ยอดคืนรวมบอกแค่ว่าเจ็บเท่าไหร่ แต่บอกไม่ได้ว่าต้องไปแก้อะไร
//    ตัวที่ถูกคืนซ้ำ ๆ มักมีสาเหตุจริง (รูปไม่ตรง · สเปกกำกวม · ของเสียบ่อย)
import { zortFetch } from './zort'

const PAGE_SIZE = 200
const CONCURRENCY = 6

export interface ReturnLine { sku: string; name: string; qty: number; total: number }
export interface ReturnOrder {
  number: string
  ref: string
  date: string
  channel: string
  status: string
  amount: number
  customer: string
  phone: string
  province: string
  tracking: string
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

export async function computeReturns(days = 365): Promise<ReturnsResult> {
  const today = new Date()
  const start = new Date(today.getTime() - days * 86400_000)
  const raw = await pagedList('ReturnOrder/GetReturnOrders', {
    returnorderdateafter: ymd(start),
    returnorderdatebefore: ymd(today),
  })

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

    list.push({
      number: str(r.number),
      ref: str(r.referencenumber) || str(r.reference),
      date,
      channel,
      status: str(r.status),
      amount,
      customer: str(r.customername),
      phone: str(r.customerphone),
      province: str(r.customerprovince),
      tracking: str(r.trackingno),
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
