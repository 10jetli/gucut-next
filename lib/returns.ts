// สินค้าที่ลูกค้าคืน — รวมทุกช่องทางจาก ZORT
//
// ออเดอร์ทุกช่องทาง (Shopee · Lazada · TikTok · หน้าร้าน) วิ่งมารวมที่ ZORT อยู่แล้ว
// ใบคืนของก็เช่นกัน จึงดูที่เดียวเห็นครบ ไม่ต้องเปิดหลังร้านทีละเจ้า
//
// ⚠️ คำถามที่ต้องตอบให้ได้คือ "ของตัวไหนถูกคืนบ่อย" ไม่ใช่แค่ "คืนไปกี่ใบ"
//    ยอดคืนรวมบอกแค่ว่าเจ็บเท่าไหร่ แต่บอกไม่ได้ว่าต้องไปแก้อะไร
//    ตัวที่ถูกคืนซ้ำ ๆ มักมีสาเหตุจริง (รูปไม่ตรง · สเปกกำกวม · ของเสียบ่อย)
import { วันไทยจากMs, ช่วงวันย้อนหลัง } from './format'
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

/** สถานะการอ่านใบคืนจากเว็บหน้าร้าน — **ต้องเดินทางไปถึงจอ**
 *  🔴 ที่มา (ใบ B08): เดิม `siteReturns()` คืน `[]` ทั้งตอนอ่านไม่ได้และตอนไม่มีใบคืนจริง
 *     ⇒ ยอดรวมบนจอ "ดูปกติทุกประการ" แต่ **ขาดใบคืนจากเว็บไปทั้งก้อน**
 *     ⇒ ไม่รู้ต้องบอกว่าไม่รู้ ห้ามกลายเป็นศูนย์ */
export interface SiteStatus {
  /** อ่านได้จริงไหม — `false` แปลว่า **ยอดในผลนี้ยังไม่รวมใบคืนจากเว็บ** */
  ok: boolean
  /** ทำไมอ่านไม่ได้ (ภาษาที่คนอ่านรู้ว่าต้องไปแก้อะไร) · `null` เมื่ออ่านได้ */
  reason: string | null
  /** อ่านได้กี่ใบ (นับจากที่รวมเข้ายอดแล้วจริง) */
  orders: number
  /** ใบที่ฝั่งเว็บอ่านไม่ได้ (ท่อส่งตัวนับนี้มาเสมอ) — `null` = ท่อไม่ได้ส่งตัวนับมา */
  unreadable: number | null
  /** บรรทัดสินค้าที่อ่านจำนวน/ราคาไม่ได้ ⇒ ยอดเงินและจำนวนต่ำกว่าจริง */
  qtyUnreadableLines: number | null
  priceUnreadableLines: number | null
}

/** สัญญาของฟีดฝั่งเว็บ: **ตัวนับต้องมาเสมอ ต่อให้เป็น 0**
 *  (ท่อเขียนไว้เองในไฟล์ `netlify/functions/returns-feed.mjs`:
 *   "ตัวนับระดับฟีด — ส่งออกเสมอ (0 ได้) เพื่อให้จอแยก 'ท่อยังไม่ส่ง' ออกจาก 'ส่งแล้วและเป็นศูนย์'")
 *
 *  🔴 **บั๊ก B08 ตัวจริงอยู่ที่ทางออกฉุกเฉินของท่อ** (บรรทัด 33 ของไฟล์นั้น):
 *     `catch { return json({ list: [] }) }` ⇒ อ่านคลังใบคืนไม่ได้ ⇒ ตอบ **HTTP 200 + list ว่าง**
 *     ⇒ ฝั่งเราเห็นคำตอบที่ถูกต้องทุกประการ แล้วประกาศว่า "ไม่มีใบคืนจากเว็บ"
 *     ⇒ ยอดคืนทั้งหน้าต่ำกว่าจริงโดยไม่มีใครรู้
 *  🔑 **แยกออกได้จากฝั่งเราเอง**: ทางออกฉุกเฉินนั้นส่งมาแต่ช่อง `list` — **ไม่มีตัวนับ**
 *     ⇒ ไม่มี `unreadable` เป็นตัวเลข = ไม่ใช่คำตอบปกติ ⇒ **ห้ามนับเป็นศูนย์**
 *     (การแก้ที่ต้นทางต้องทำในรีโปท่อ — ฝั่งนี้ทำได้คือไม่เชื่อคำตอบที่ผิดสัญญา) */
export function ตัดสินคำตอบฟีด(j: unknown): { list: ReturnOrder[]; status: SiteStatus } {
  const ว่าง = (reason: string): { list: ReturnOrder[]; status: SiteStatus } => ({
    list: [],
    status: { ok: false, reason, orders: 0, unreadable: null, qtyUnreadableLines: null, priceUnreadableLines: null },
  })
  const o = (j ?? {}) as Record<string, unknown>
  if (!Array.isArray(o.list)) return ว่าง('เว็บหน้าร้านตอบ 200 แต่ไม่มีรายการ (ช่อง list ไม่ใช่อาร์เรย์)')
  if (typeof o.unreadable !== 'number') {
    return ว่าง('เว็บหน้าร้านตอบ 200 แต่ไม่ส่งตัวนับ (unreadable) มา ⇒ เป็นทางออกฉุกเฉินของท่อ'
      + ' (อ่านคลังใบคืนของเว็บไม่ได้) ไม่ใช่ว่าไม่มีใบคืน')
  }
  const เลข = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : null)
  return {
    list: o.list as ReturnOrder[],
    status: {
      ok: true,
      reason: null,
      orders: (o.list as ReturnOrder[]).length,
      unreadable: o.unreadable,
      qtyUnreadableLines: เลข('qtyUnreadableLines'),
      priceUnreadableLines: เลข('priceUnreadableLines'),
    },
  }
}

/** สถานะการอ่านใบคืนจาก ZORT — เหตุผลเดียวกับ SiteStatus: **ถามไม่ได้ ≠ ไม่มีใบคืน**
 *  🔴 เจอตอนเปิดจอดูด้วยตา 28 ก.ย. 2569: เครื่องที่ไม่มีคีย์ ZORT ⇒ ZORT ตอบ JSON ที่ไม่มีช่อง
 *     `list` ⇒ `pagedList()` คืนอาร์เรย์ว่าง ⇒ จอขึ้น **"ใบคืนของ 0 ใบ · มูลค่า ฿0"**
 *     ทั้งที่ยังไม่ได้ถามสำเร็จเลยแม้แต่หน้าเดียว (รูปเดียวกับบั๊ก B08 แค่คนละขา) */
export interface ZortStatus { ok: boolean; reason: string | null; orders: number }

export interface ReturnsResult {
  at: number
  days: number
  total: number
  amount: number
  byChannel: Record<string, { orders: number; amount: number }>
  byMonth: Record<string, number>
  skus: SkuReturn[]
  list: ReturnOrder[]
  /** ⚠️ ผลชุดเก่าในแคช (ก่อน 28 ก.ย. 2569) ไม่มีช่องนี้ ⇒ จอต้องอ่าน `undefined`
   *     ว่า **"ยังไม่รู้"** ไม่ใช่ "รวมครบแล้ว" */
  site: SiteStatus
  /** ⚠️ ผลชุดเก่าในแคชไม่มีช่องนี้ ⇒ จออ่าน `undefined` ว่า "ยังไม่รู้" */
  zort: ZortStatus
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
/* 🔴 **แก้ 20 ก.ย. 2569** — เหตุผลเดียวกับ `lib/reorder.ts`: ค่านี้ส่งเป็น
   `returnorderdateafter/before` เข้า ZORT ซึ่งเก็บเวลาไทย ⇒ วัน UTC ทำให้หน้าต่างจบที่เมื่อวาน
   ในช่วง 00:00–06:59 เวลาไทย ⇒ **ใบคืนของวันนี้หลุดจากการนับ** */
const ymd = (d: Date) => วันไทยจากMs(d.getTime())

/** ZORT ตอบหน้าแรกมาแบบนี้ ⇒ ถามสำเร็จหรือยัง (แยก "ไม่มีใบคืน" ออกจาก "ถามไม่ได้")
 *  ZORT ตอบ JSON เสมอแม้ตอนปฏิเสธ (คีย์ผิด/ไม่มีคีย์) ⇒ ดูที่ **ช่อง `list`** เท่านั้น */
export function ตัดสินคำตอบZORT(first: unknown): { ok: boolean; reason: string | null } {
  const o = (first ?? {}) as Record<string, unknown>
  if (Array.isArray(o.list)) return { ok: true, reason: null }
  const เล่า = [o.description, o.message, o.error, o.status]
    .map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : ''))
    .filter(Boolean).join(' · ').slice(0, 160)
  return {
    ok: false,
    reason: `ถาม ZORT ไม่สำเร็จ — ตอบมาแต่ไม่มีรายการ (ช่อง list ไม่ใช่อาร์เรย์)${เล่า ? `: ${เล่า}` : ''}`,
  }
}

/**
 * ดึงทีละหน้าแต่ยิงพร้อมกันหลายหน้า
 * ⚠️ ห้ามยิงเรียงทีละหน้า — ใบคืนของมีหลายร้อยใบ Netlify ตัดที่ 26 วินาที
 *    (บทเรียนเดียวกับ lib/reorder.ts ที่เคยโดนตัดกลางคันมาแล้ว)
 */
async function pagedList(
  endpoint: string, params: Record<string, string>, maxPages = 40,
): Promise<{ rows: Record<string, unknown>[]; ok: boolean; reason: string | null }> {
  const get = (page: number) =>
    zortFetch(endpoint, { ...params, page: String(page), limit: String(PAGE_SIZE) }) as Promise<{
      list?: Record<string, unknown>[]
      count?: number
    }>

  const first = await get(1)
  const สถานะ = ตัดสินคำตอบZORT(first)
  const out: Record<string, unknown>[] = Array.isArray(first?.list) ? [...first.list] : []
  if (out.length < PAGE_SIZE) return { rows: out, ...สถานะ }

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
  return { rows: out, ...สถานะ }
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
async function siteReturns(days: number): Promise<{ list: ReturnOrder[]; status: SiteStatus }> {
  const ว่าง = (reason: string): { list: ReturnOrder[]; status: SiteStatus } => ({
    list: [],
    status: { ok: false, reason, orders: 0, unreadable: null, qtyUnreadableLines: null, priceUnreadableLines: null },
  })
  const key = (process.env.GUCUT_ADMIN_KEY || '').trim()
  if (!key) return ว่าง('ยังไม่ได้ตั้ง GUCUT_ADMIN_KEY ที่เซิร์ฟเวอร์ ⇒ ดึงใบคืนจากเว็บไม่ได้')
  try {
    const r = await fetch(`${SITE}/api/returns-feed?days=${days}`, {
      headers: { 'x-admin-key': key },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return ว่าง(`เว็บหน้าร้านตอบ HTTP ${r.status} ที่ /api/returns-feed`)
    /* ตัวตัดสินอยู่ใน `ตัดสินคำตอบฟีด()` ข้างบน — แยกออกมาเพื่อให้เทสยิงได้ทุกรูปคำตอบ
       (รูปที่แพงที่สุดคือ 200 + list ว่าง ซึ่งเป็นทางออกฉุกเฉินของท่อ ไม่ใช่ "ไม่มีใบคืน") */
    return ตัดสินคำตอบฟีด(await r.json())
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return ว่าง(`ต่อเว็บหน้าร้านไม่ได้: ${m}`)
  }
}

export async function computeReturns(days = 30): Promise<ReturnsResult> {
  const today = new Date()
  const start = new Date(today.getTime() - days * 86400_000)
  /* 🔴 `days` มาจากผู้เรียก ⇒ อาจเป็น null/'' ได้ · `Number(null)` = 0 ⇒ **"ไม่รู้" จะกลายเป็น "วันนี้วันเดียว"**
     (ฝั่งท่อเจอรูปนี้ในตัวช่วยเดียวกันวันนี้) ⇒ แหล่งกลางคืน `null` เมื่อไม่รู้ ⇒ ตกกลับไปใช้ 30 วันอย่างชัดเจน */
  const ช่วง = ช่วงวันย้อนหลัง(days, today.getTime()) ?? ช่วงวันย้อนหลัง(30, today.getTime())!
  const [ผลZORT, เว็บ] = await Promise.all([
    pagedList('ReturnOrder/GetReturnOrders', {
      /* 🔑 ใช้แหล่งกลาง `ช่วงวันย้อนหลัง` (lib/format.ts) — มีเทสคุมตั้งแต่ 20 ก.ย. 2569
         เหตุ: ย้อน diff ของคอมมิตที่แก้บั๊กนี้กลับ ⇒ **สาย 75 ขั้นเงียบสนิท** ⇒ เดิมไม่มีตาข่ายเลย
         ⚠️ ถอยไปคิดวันเองตรงนี้เมื่อไหร่ = ถอดตาข่ายนั้นออกโดยไม่มีใครเห็น */
      returnorderdateafter: ช่วง.ตั้งแต่,
      returnorderdatebefore: ช่วง.ถึง,
    }),
    siteReturns(days),
  ])
  const raw = ผลZORT.rows
  const fromSite = เว็บ.list

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
    site: เว็บ.status,
    zort: { ok: ผลZORT.ok, reason: ผลZORT.reason, orders: raw.length },
  }
}
