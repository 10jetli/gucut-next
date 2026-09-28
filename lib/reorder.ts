// รวมข้อมูลจาก ZORT แล้วส่งเข้าเครื่องพยากรณ์ (lib/forecast.ts)
//
// ยอดขายมาจาก ZORT ซึ่งรวมออเดอร์ Shopee · Lazada · TikTok · หน้าร้าน ไว้ที่เดียวแล้ว
// ดึงที่นี่ที่เดียวจึงได้ครบทุกช่องทางตามที่เจ้าของร้านต้องการ
import { วันไทยจากMs, ช่วงวันย้อนหลัง, เลขจากท่อ } from './format'
import { zortFetch } from './zort'
import { abcClass, forecast, seasonalIndex } from './forecast'

/** เวลารอของจากโรงงาน — เจ้าของร้านยืนยัน 18 ส.ค. 2569 ว่ารอ 45 วัน */
export const DEFAULT_LEAD_DAYS = 45

/** อยากมีของพอขายกี่วัน — 120 วัน (สั่งทีนึงพอราว 4 เดือน) เหมาะกับของที่รอ 45 วัน */
export const DEFAULT_COVER_DAYS = 120

/** ดูย้อนหลัง 1 ปีเต็ม — ต้องครบปีถึงจะเห็นรูปฤดูกาล */
const LOOKBACK_DAYS = 365
const WEEKS = 52

/** ออเดอร์ที่ไม่ใช่ยอดขายจริง — นับด้วยจะทำให้สั่งของเกิน */
const DEAD_STATUS = /cancel|void|reject|ยกเลิก/i

export interface SkuStat {
  sku: string
  name: string
  stock: number
  sold: number
  perDay: number
  daysLeft: number | null
  level: 0 | 1 | 2
  suggest: number
  safety: number
  rop: number
  trend: number
  abc: 'A' | 'B' | 'C'
  intermittent: boolean
  dead: boolean
  overstock: boolean
  /** เชื่อตัวเลขได้แค่ไหน — ของที่ขายนาน ๆ ที ทำนายไม่ได้จริง ต้องบอกตรง ๆ */
  confidence: 'สูง' | 'กลาง' | 'ต่ำ'
  byChannel: Record<string, number>
}

export interface ReorderResult {
  /** 🔴 ดึงรายการ "ของที่ลูกค้าคืน" ไม่สำเร็จรอบนี้ — **ยอดขายสุทธิจึงสูงเกินจริง**
   *  (ของคืนถูกหักออกจากยอดขาย ถ้าดึงไม่ได้ = เหมือนไม่มีใครคืนเลย)
   *  ⇒ แผนสั่งซื้อจะ **สั่งเกิน** และไม่มีอะไรฟ้อง — เดิม `.catch(() => [])` เงียบสนิท
   *  ⚠️ ใครแสดงผลตัวนี้ ต้องเขียนบอกบนจอ ห้ามซ่อน (เจอ 7 ก.ย. 2569) */
  returnsUnavailable?: boolean
  at: number
  leadDays: number
  coverDays: number
  lookbackDays: number
  /** หน่วยของหน้าต่างที่ใช้นับ — **ผู้เรียกต้องเอาไปเขียนบนจอ** (20 ก.ย. 2569)
   *  🔴 ที่มา: หน้าต่างนี้เคยคิดจาก **วัน UTC** ⇒ ช่วง 00:00–06:59 เวลาไทย ออเดอร์ของวันนั้นหลุด
   *     แก้เป็นวันไทยแล้ว ⇒ **เลขที่คนเคยเห็นเมื่อคืนจะขยับ**
   *  ⚠️ ผู้เรียกจริงคือหน้าแคตตาล็อก (`public/catalog/index.html`) ซึ่ง **ห้ามแตะตามคำสั่ง**
   *     ⇒ จึงส่งหมายเหตุมาในคำตอบ ให้ฝั่งที่เรนเดอร์เลือกแสดง — **ไม่ปล่อยให้เลขขยับแบบไม่มีคำอธิบาย** */
  หน่วยหน้าต่าง: string
  orders: number
  season: number[]
  skus: SkuStat[]
}

/* ตัวแปลงเลขอยู่ที่เดียวใน lib/format.ts แล้ว (28 ก.ย. 2569 — เดิมมี 3 สำเนา ซึ่งรูป `|| 0`
   ปล่อย Infinity ออกไปบวกในยอดเงิน ต่างจากสำเนาที่เช็ค isFinite) */
const num = เลขจากท่อ
const str = (v: unknown) => (typeof v === 'string' ? v : '')
/* 🔴 **แก้ 20 ก.ย. 2569** — ของเดิม `d.toISOString().slice(0, 10)` ให้ **วัน UTC**
   แต่ค่านี้ถูกส่งเป็น `orderdateafter/orderdatebefore` เข้า ZORT ซึ่งเก็บ **เวลาไทย**
   ⇒ ช่วง 00:00–06:59 เวลาไทย หน้าต่างจบที่ "เมื่อวาน" ⇒ **ออเดอร์ของวันนี้หลุดจากการคำนวณ**
   ⚠️ ร้านทำงานตี 3 จริง ⇒ ชั่วโมงที่บั๊กทำงาน = ชั่วโมงที่คนใช้จอนี้จริง
   (คลาสเดียวกับบั๊ก `orderdate` ที่ฝั่งท่อเจอวันเดียวกัน · ฝั่งท่อเป็นคนชี้ว่า **แก้เลย ไม่ต้องรอ**
    เพราะจอนี้เป็นเครื่องช่วยตัดสินใจสด ⇒ เลขที่ตกวันนี้ออกไป **ไม่ใช่เลขที่ถูกกว่า มันคือเลขที่ผิด**) */
const ymd = (d: Date) => วันไทยจากMs(d.getTime())

/**
 * ดึงข้อมูลทีละหน้า — แต่ยิงพร้อมกันหลายหน้า
 *
 * ⚠️ ห้ามกลับไปยิงเรียงทีละหน้าเด็ดขาด
 *    ออเดอร์ 12 เดือนของร้านนี้มีหลายพันใบ = 30-40 หน้า
 *    ยิงเรียงกันใช้เวลา 20-40 วินาที ซึ่งเกินเวลาที่ Netlify ให้ฟังก์ชันทำงาน
 *    ผลคือถูกตัดกลางคัน แล้วส่งข้อความ error เป็นตัวหนังสือธรรมดากลับมา
 *    (หน้าเว็บจะฟ้องว่า "Unexpected token 'h', the edge fu... is not valid JSON")
 *    เจอของจริง 18 ส.ค. 2569
 *
 * วิธีทำ: ยิงหน้าแรกก่อนเพื่ออ่าน count → คำนวณจำนวนหน้า → ยิงที่เหลือพร้อมกันทีละชุด
 * ⚠️ ยิงพร้อมกันมากเกินไปจะโดน ZORT จำกัดอัตรา จึงล็อกไว้ที่ 6 หน้าต่อชุด
 */
const PAGE_SIZE = 200
const CONCURRENCY = 6

async function pagedList(
  endpoint: string,
  params: Record<string, string>,
  maxPages = 60,
): Promise<Record<string, unknown>[]> {
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
    if (short) break     // เจอหน้าสุดท้ายแล้ว
  }
  return out
}

export async function computeReorder(
  leadDays = DEFAULT_LEAD_DAYS,
  coverDays = DEFAULT_COVER_DAYS,
): Promise<ReorderResult> {
  const today = new Date()
  const start = new Date(today.getTime() - LOOKBACK_DAYS * 86400_000)
  /* 🔑 ใช้แหล่งกลาง `ช่วงวันย้อนหลัง` (lib/format.ts) — มีเทสคุมตั้งแต่ 20 ก.ย. 2569
     เหตุ: ย้อน diff ของคอมมิตที่แก้บั๊กวันนี้กลับ ⇒ **สาย 75 ขั้น exit 0 · tsc เขียว**
     ⇒ ⇒ เดิม **ไม่มีอะไรจับเลย** ทั้งที่เส้นนี้ตัดสินว่าจะสั่งซื้อของเท่าไหร่
     ⚠️ ถอยไปคิดวันเองตรงนี้เมื่อไหร่ = ถอดตาข่ายนั้นออกโดยไม่มีใครเห็น */
  const ช่วง = ช่วงวันย้อนหลัง(LOOKBACK_DAYS, today.getTime())!
  const range = { orderdateafter: ช่วง.ตั้งแต่, orderdatebefore: ช่วง.ถึง }

  let returnsUnavailable = false
  const [orders, returns, products] = await Promise.all([
    pagedList('Order/GetOrders', range),
    // ⚠️ ดึงของคืนไม่ได้ ≠ ไม่มีใครคืน — จำไว้แล้วส่งออกไปให้คนที่แสดงผลรู้
    pagedList('ReturnOrder/GetReturnOrders', range, 20).catch(() => { returnsUnavailable = true; return [] }),
    pagedList('Product/GetProducts', {}),
  ])

  // ---- แปลงออเดอร์เป็นยอดขายรายสัปดาห์ต่อ SKU ----
  const weekly = new Map<string, number[]>()
  const byChannel = new Map<string, Record<string, number>>()
  const monthTotal = Array(12).fill(0) as number[]
  let counted = 0

  const feed = (list: Record<string, unknown>[], sign: 1 | -1) => {
    for (const o of list) {
      if (DEAD_STATUS.test(str(o.status))) continue
      const ds = str(o.orderdateString) || str(o.orderdate).slice(0, 10)
      const t = Date.parse(ds)
      if (!t) continue
      // ช่อง 0 = เก่าสุด · ช่องท้าย = ล่าสุด
      const wk = Math.min(WEEKS - 1, Math.max(0, Math.floor((t - start.getTime()) / (7 * 86400_000))))
      const month = new Date(t).getMonth()
      if (sign === 1) counted++
      const channel = str(o.saleschannel) || 'อื่น ๆ'
      const items = Array.isArray(o.list) ? (o.list as Record<string, unknown>[]) : []
      for (const it of items) {
        const sku = str(it.sku).trim()
        if (!sku) continue
        const q = num(it.number) * sign
        const arr = weekly.get(sku) ?? Array(WEEKS).fill(0)
        arr[wk] += q
        weekly.set(sku, arr)
        monthTotal[month] += q
        const per = byChannel.get(sku) ?? {}
        per[channel] = (per[channel] ?? 0) + q
        byChannel.set(sku, per)
      }
    }
  }
  feed(orders, 1)
  feed(returns, -1)     // ตีกลับ = หักออก

  const season = seasonalIndex(monthTotal)

  // เดือนที่ของจะมาถึง — ต้องเตรียมของให้พอกับความต้องการ "ตอนของถึง" ไม่ใช่ตอนนี้
  const arriveMonth = new Date(today.getTime() + leadDays * 86400_000).getMonth()

  // ---- จัดกลุ่ม ABC ตามมูลค่าขาย ----
  const values = products.map((p) => {
    const sku = str(p.sku).trim()
    const w = weekly.get(sku) ?? []
    const sold = w.reduce((a, b) => a + b, 0)
    return { sku, value: Math.max(0, sold) * num(p.sellprice ?? p.price) }
  })
  const abc = abcClass(values)

  const skus: SkuStat[] = products.map((p) => {
    const sku = str(p.sku).trim()
    const stock = num(p.availablestock ?? p.stock ?? p.quantity)
    const w = weekly.get(sku) ?? Array(WEEKS).fill(0)
    const sold = Math.max(0, w.reduce((a, b) => a + b, 0))

    const f = forecast({
      weekly: w,
      stock,
      price: num(p.sellprice ?? p.price),
      leadDays,
      coverDays,
      arriveMonth,
      seasonIndex: season,
    })

    // ---- ความด่วน ----
    // ของจะหมดก่อนของใหม่มาถึง = ด่วน · ใกล้ถึงจุดสั่ง = ควรสั่ง
    let level: 0 | 1 | 2 = 0
    if (f.daysLeft !== null) {
      if (f.daysLeft <= leadDays) level = 2
      else if (stock <= f.rop) level = 1
    } else if (stock <= 0 && sold > 0) {
      /* 🔴 **กิ่งนี้เดินไม่ถึงด้วยเครื่องพยากรณ์รุ่นปัจจุบัน** (วัดจริง 28 ก.ย. 2569 ไม่ได้อนุมาน)
         `daysLeft` เป็น null เฉพาะเมื่อ `perDay === 0` และ croston/mean คืน 0 เฉพาะเมื่อ
         **ไม่มียอดขายเลย** ⇒ `sold > 0` จึงเป็นเท็จพร้อมกันเสมอ
         (ของที่ขายครั้งเดียวเมื่อ 50 สัปดาห์ก่อน ยังได้ perDay 0.226 ⇒ daysLeft = 0 ⇒ กิ่งบนจับไปแล้ว)
         ⇒ เก็บไว้เป็น **ตาข่ายเผื่อเครื่องพยากรณ์เปลี่ยน** ไม่ใช่เส้นทางที่ใช้อยู่จริง
         ⇒ วิธีวัดซ้ำ: node scripts/tests/reorder-engine.test.mjs (ข้อ ⑥ ตรึงความสัมพันธ์นี้ไว้
            ถ้า forecast เริ่มคืน daysLeft = null พร้อมกับมียอดขาย ข้อนั้นจะแดง = กิ่งนี้มีชีวิตแล้ว) */
      level = 2                       // เคยขายแต่ของหมดเกลี้ยง
    }

    // ---- เชื่อได้แค่ไหน ----
    // ⚠️ ต้องบอกตรง ๆ ว่าตัวไหนข้อมูลน้อยเกินกว่าจะทำนาย
    //    ระบบพยากรณ์พังเพราะคนไปเชื่อเลขที่ระบบไม่ควรมั่นใจ ไม่ใช่เพราะสูตรไม่ดี
    const weeksWithSales = w.filter((v) => v > 0).length
    const confidence: SkuStat['confidence'] =
      weeksWithSales >= 20 ? 'สูง' : weeksWithSales >= 6 ? 'กลาง' : 'ต่ำ'

    return {
      sku,
      name: str(p.name),
      stock,
      sold,
      perDay: f.perDay,
      daysLeft: f.daysLeft,
      level,
      suggest: level === 0 ? 0 : f.suggest,
      safety: f.safety,
      rop: f.rop,
      trend: f.trend,
      abc: abc[sku] ?? 'C',
      intermittent: f.intermittent,
      dead: f.dead,
      overstock: f.overstock,
      confidence,
      byChannel: byChannel.get(sku) ?? {},
    }
  })

  return {
    at: Date.now(),
    leadDays,
    coverDays,
    lookbackDays: LOOKBACK_DAYS,
    หน่วยหน้าต่าง: `นับยอดขายย้อนหลัง ${LOOKBACK_DAYS} วัน ตามวันปฏิทินไทย`
      + ' (แก้ 20 ก.ย. 2569 — เดิมคิดเป็นวัน UTC ทำให้ช่วงตี 1–7 โมงเช้าไม่นับออเดอร์ของวันนั้น)',
    orders: counted,
    season,
    skus,
    ...(returnsUnavailable ? { returnsUnavailable: true } : {}),
  }
}
