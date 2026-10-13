/* ส่งเลข OEM จากคลังอะไหล่ (/catalog) ไปเติมตารางจับคู่ของหน้าร้าน — 12 ต.ค. 2569
 *
 * 🔴 **ปัญหาที่เส้นนี้แก้** (ท่านประธานชี้เองเช้านี้)
 *    หน้า `/catalog` มีช่อง **OEM** อยู่แล้ว คู่กับ SKU · ชื่อไทย · รูป · ราคา · สต็อก
 *    ส่วนหน้า `gucut.com/parts/<รุ่น>` มีเลข STIHL ของอะไหล่ทุกชิ้น
 *    ⇒ **เลขเดียวกัน จับคู่กันได้ทันที** ไม่ต้องให้ใครนั่งกรอกทีละตัว
 *
 * 🔑 **ทำไมต้องให้หลังร้าน "ส่งออก" ไม่ใช่ให้หน้าร้าน "เข้ามาดึง"** (วัดแล้ว 12 ต.ค.)
 *    `GET /api/catalog/state` ถูกกันด้วย **เซสชันคนล็อกอิน ไม่ใช่รหัส API**
 *    ยิงด้วย `x-admin-key` / `authorization` / `x-gucut-web-key` ⇒ **401 ทั้งสามแบบ**
 *    ⇒ ถ้าจะให้หน้าร้านดึงเอง ต้องเปิดช่องทางใหม่เข้าหลังร้าน = เพิ่มรูรั่วโดยไม่จำเป็น
 *    ⇒ ทางที่ปลอดภัยกว่าคือ **ไหลทางเดียวออกไป** ด้วยรหัสที่มีอยู่แล้ว (`GUCUT_WEB_ADMIN_KEY`)
 *
 * 🚫 **ห้ามแตะหน้า /catalog เด็ดขาด** — ท่านสั่งไว้ 7 ก.ย. 2569 (ห้ามแก้/ย้าย/ปรับปรุง ไม่ใช่แค่ห้ามลบ)
 *    เส้นนี้ **อ่านอย่างเดียว** ไม่เขียนกลับเข้า catalog state สักไบต์
 *
 * วิธีใช้
 *   GET  /api/parts-oem-sync?model=f440            ← ดูเฉย ๆ ไม่เขียน (รอบซ้อม)
 *   POST /api/parts-oem-sync?model=f440            ← เขียนจริง
 *   POST /api/parts-oem-sync                       ← ทุกรุ่น **ที่หน้าร้านประกาศ**
 *                                                     (`/parts/models.json` · ดู lib/parts-models.ts)
 *   ต้องมีหัว `x-admin-key` ตรงกับ GUCUT_WEB_ADMIN_KEY ทั้ง GET และ POST
 */
import { NextRequest, NextResponse } from 'next/server'
import { loadCatalogStateBlobs } from '@/lib/catalogstate'
import { รุ่นจากหน้าร้าน, ล้างรุ่น, จับคู่ที่ยังว่าง } from '@/lib/parts-models'

export const dynamic = 'force-dynamic'

const ฐานหน้าร้าน = process.env.GUCUT_WEB_BASE || 'https://gucut.com'

/** 🔑 เทียบเลขแบบ "ถอดทุกอย่างที่ไม่ใช่ตัวเลขออก"
 *  คู่มือเขียน `1128 029 0500` · คลังอาจเขียน `1128-029-0500` หรือ `11280290500`
 *  เทียบสตริงตรง ๆ = พลาดเกือบทั้งหมด และพลาดแบบเงียบ (ได้ 0 คู่ ซึ่งดูเหมือน "ยังไม่มีใครกรอก") */
const เลขล้วน = (v: unknown) => String(v ?? '').replace(/\D/g, '')

type ผลรุ่น = {
  รุ่น: string
  อะไหล่: number
  จับคู่ใหม่: number
  มีอยู่เดิม: number
  ข้ามเพราะมีแล้ว: number
  กำกวมไม่เขียน?: number
  รายการกำกวม?: { รหัส: string; sku: string[] }[]
  เขียนแล้ว: boolean
  เหตุ?: string
}

/** ดึง sku → เลข OEM จากคลัง (อ่านอย่างเดียว) */
function เลขOEMจากคลัง(ovr: Record<string, any>): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const [sku, v] of Object.entries(ovr || {})) {
    /* ⚠️ ช่อง oem อาจเป็นสตริง หรือเป็นอ็อบเจกต์ที่ sync.js เคยยัดผิดไว้ (คอมเมนต์เตือนไว้ในไฟล์นั้น)
       ⇒ รับเฉพาะที่ถอดเป็นตัวเลขได้จริง ที่เหลือข้าม **ไม่เดา** */
    const เลข = เลขล้วน(typeof v === 'object' && v ? (v as any).oem : v)
    if (!เลข || เลข.length < 8) continue
    const เดิม = m.get(เลข)
    if (เดิม) เดิม.push(sku)
    else m.set(เลข, [sku])
  }
  return m
}

async function ทำรุ่น(รุ่น: string, ovrMap: Map<string, string[]>, เขียนจริง: boolean): Promise<ผลรุ่น> {
  const คีย์ = process.env.GUCUT_WEB_ADMIN_KEY || ''
  const ว่าง: ผลรุ่น = { รุ่น, อะไหล่: 0, จับคู่ใหม่: 0, มีอยู่เดิม: 0, ข้ามเพราะมีแล้ว: 0, เขียนแล้ว: false }

  /* ① รายการอะไหล่ของรุ่นนี้ (ไฟล์สาธารณะ ไม่ต้องใช้รหัส) */
  let อะไหล่: any
  try {
    const r = await fetch(`${ฐานหน้าร้าน}/parts/${รุ่น}.json`, { cache: 'no-store' })
    if (!r.ok) return { ...ว่าง, เหตุ: `อ่านรายการอะไหล่ไม่ได้ (HTTP ${r.status})` }
    อะไหล่ = await r.json()
  } catch (e: any) {
    return { ...ว่าง, เหตุ: `อ่านรายการอะไหล่ไม่ได้: ${String(e?.message ?? e).slice(0, 80)}` }
  }
  const แถว: any[] = (อะไหล่?.กลุ่ม ?? []).flatMap((g: any) => g?.อะไหล่ ?? [])
  if (!แถว.length) return { ...ว่าง, เหตุ: 'ไฟล์อะไหล่อ่านได้แต่ไม่มีแถวเลย' }

  /* ② ตารางจับคู่ที่มีอยู่แล้ว — 🔴 ต้องอ่านก่อนเสมอ
        ของในนั้นอาจเป็นเลขที่ **ท่านประธานกรอกเอง** และไม่มีสำเนาที่อื่น
        ⇒ เส้นนี้ **เติมเฉพาะรหัสที่ยังว่าง ไม่ทับของเดิมแม้แต่คู่เดียว** */
  let เดิม: Record<string, string> = {}
  try {
    const r = await fetch(`${ฐานหน้าร้าน}/api/parts-map?model=${รุ่น}`, {
      headers: { 'x-admin-key': คีย์ }, cache: 'no-store',
    })
    if (!r.ok) return { ...ว่าง, เหตุ: `อ่านตารางจับคู่เดิมไม่ได้ (HTTP ${r.status}) — ไม่เขียนทับของที่มองไม่เห็น` }
    เดิม = ((await r.json())?.map ?? {}) as Record<string, string>
  } catch (e: any) {
    return { ...ว่าง, เหตุ: `อ่านตารางจับคู่เดิมไม่ได้: ${String(e?.message ?? e).slice(0, 80)}` }
  }

  /* ③ จับคู่ — ตรรกะอยู่ใน lib/parts-models.ts (เทสเรียกได้ตรง ๆ)
     🔴 คีย์ต้องล้างให้ตรงกับฝั่งร้านก่อนเทียบ ไม่งั้นตัวกันทับไม่ทำงานเลยสักใบ */
  const { เพิ่ม, ข้าม, กำกวม } = จับคู่ที่ยังว่าง(แถว, เดิม, ovrMap)

  const ผล: ผลรุ่น = {
    รุ่น, อะไหล่: แถว.length,
    จับคู่ใหม่: Object.keys(เพิ่ม).length,
    มีอยู่เดิม: Object.keys(เดิม).length,
    ข้ามเพราะมีแล้ว: ข้าม,
    /* 🔑 ต้องโผล่ในคำตอบเสมอ — ของที่ "ตั้งใจไม่เขียน" ถ้าไม่พูดออกมา
       จะแยกไม่ออกจาก "ไม่มีของให้จับคู่" และไม่มีใครได้รายชื่อไปเลือก */
    กำกวมไม่เขียน: กำกวม.length,
    รายการกำกวม: กำกวม,
    เขียนแล้ว: false,
  }
  if (!เขียนจริง || !ผล.จับคู่ใหม่) return ผล

  /* ④ เขียนกลับแบบ **รวมของเดิม** — ส่งทั้งก้อนเพราะฝั่งท่อเขียนทับทั้งรุ่น */
  try {
    const r = await fetch(`${ฐานหน้าร้าน}/api/parts-map?model=${รุ่น}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': คีย์ },
      body: JSON.stringify({ map: { ...เดิม, ...เพิ่ม } }),
    })
    if (!r.ok) return { ...ผล, เหตุ: `เขียนไม่สำเร็จ (HTTP ${r.status})` }
    ผล.เขียนแล้ว = true
  } catch (e: any) {
    return { ...ผล, เหตุ: `เขียนไม่สำเร็จ: ${String(e?.message ?? e).slice(0, 80)}` }
  }
  return ผล
}

async function วิ่ง(req: NextRequest, เขียนจริง: boolean) {
  const คีย์ = process.env.GUCUT_WEB_ADMIN_KEY || ''
  if (!คีย์) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY บนเซิร์ฟเวอร์' }, { status: 503 })
  if (req.headers.get('x-admin-key') !== คีย์)
    return NextResponse.json({ error: 'ต้องมี x-admin-key' }, { status: 401 })

  const ขอ = ล้างรุ่น(req.nextUrl.searchParams.get('model'))
  const แหล่ง = ขอ
    ? { รุ่น: [ขอ], ที่มา: 'พารามิเตอร์ ?model=', ถามได้: true }
    : await รุ่นจากหน้าร้าน(ฐานหน้าร้าน)
  const รุ่นที่ทำ = แหล่ง.รุ่น

  const state = await loadCatalogStateBlobs()
  /* 🔴 อ่านคลังไม่ได้ **ห้ามตีความว่า "คลังว่าง"** แล้วเดินต่อ
     ไม่งั้นจะได้ผล "จับคู่ใหม่ 0" ซึ่งหน้าตาเหมือนทำงานสำเร็จแต่ไม่มีอะไรให้จับ */
  if (!state) return NextResponse.json({ error: 'อ่านคลังอะไหล่ไม่ได้ — ยังไม่ได้เขียนอะไรเลย' }, { status: 503 })
  const ovrMap = เลขOEMจากคลัง(state.ovr ?? {})

  /* ➕ **แหล่งที่สอง: เลข OEM ที่ซ่อนอยู่ใน tags ของสินค้า** (แก้ 12 ต.ค. 2569)
     🔴 ของจริง: หน้า /catalog แสดง OEM จาก **สองแหล่ง** — `o.oem ?? p.pp.oem`
        ① ที่คนกรอกเอง (state.ovr) ② ที่แกะจาก tags ของสินค้าเอง
        ผมอ่านแต่แหล่งแรก ⇒ ได้ 122 เลข แล้วสรุปผิดว่า "ของที่ท่านกรอกหายไป"
        ทั้งที่ของอยู่ครบ — **ผมหาไม่เจอเอง** (ตัวอย่าง 05619 มี tag "A20- 1128 029 0500")
     ⇒ อ่านแหล่งที่สองด้วย ได้เพิ่มเป็น ~629 เลข (มากกว่าเดิม 5 เท่า)
     🔑 บทเรียน: จอแสดงค่าจากหลายแหล่งต่อกันด้วย `??` — อ่านแค่แหล่งแรกแล้วสรุป
        จะได้ผลที่ **ดูเหมือนข้อมูลหาย** ทั้งที่เราอ่านไม่ครบ */
  try {
    const r = await fetch('https://video.gucut.com/catalog/products.json', {
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    })
    if (r.ok) {
      const j = await r.json()
      /* ชุดเดียวกับ OEM_RE ในหน้า /catalog — คัดเฉพาะรูปที่เป็นเลขอะไหล่จริง
         (ตัดรูป [A-Z]{2,}\d{2,} ออกโดยตั้งใจ — มันจับชื่อรุ่นอย่าง MS440 ติดมาด้วย) */
      const รูปเลข = /(?:\d{4} \d{3} \d{4}|\d{3,4}-\d{2,5}|\d\.\d{3}\.\d{4}\.\d{2})/g
      for (const p2 of (j?.products ?? [])) {
        const sku = String(p2?.sku ?? '')
        if (!sku) continue
        for (const t of (p2?.tags ?? [])) {
          for (const o of String(t).match(รูปเลข) ?? []) {
            const เลข = เลขล้วน(o)
            if (เลข.length < 8) continue
            /* ⚠️ ของที่คนกรอกเองชนะเสมอ — ไม่ทับด้วยของที่แกะจาก tags */
            if (!ovrMap.has(เลข)) ovrMap.set(เลข, [sku])
          }
        }
      }
    }
  } catch { /* อ่านไม่ได้ = ใช้เฉพาะแหล่งแรก ไม่ล้มทั้งเส้น */ }

  /* 🔎 โหมดส่อง — `?โครง=<รหัสหรือ sku>` บอกว่าของชิ้นนั้นอยู่ในคลังรูปไหน
     🔑 มีเพราะของจริง 12 ต.ค. 2569: ท่านประธานกรอก 1128 029 0500 → 05619 ในหน้า /catalog
        แต่ตัวซิงก์หาไม่เจอ ⇒ ต้องดูโครงข้อมูลจริง ไม่ใช่เดาว่าเก็บยังไง
     ⚠️ อ่านอย่างเดียว · ต้องมีกุญแจเหมือนเส้นอื่น */
  const ส่อง = req.nextUrl.searchParams.get('โครง')
  if (ส่อง) {
    const ovr = (state.ovr ?? {}) as Record<string, any>
    const เลข = เลขล้วน(ส่อง)
    const ตรงsku = ovr[ส่อง] ?? null
    const ตรงเลข = Object.entries(ovr).filter(([, v]) =>
      JSON.stringify(v ?? '').replace(/\D/g, '').includes(เลข)).slice(0, 5)
    return NextResponse.json({
      หาอะไร: ส่อง, เลขล้วน: เลข,
      จำนวนรายการในคลัง: Object.keys(ovr).length,
      เลขOEMที่อ่านได้: ovrMap.size,
      เจอเป็นsku: ตรงsku,
      เจอเลขนี้ในรายการ: ตรงเลข.map(([k, v]) => ({ sku: k, ค่า: v })),
      ตัวอย่างโครง: Object.entries(ovr).slice(0, 3).map(([k, v]) => ({ sku: k, ช่อง: Object.keys(v ?? {}) })),
      คีย์อื่นในสถานะ: Object.keys(state),
    })
  }

  const ผล: ผลรุ่น[] = []
  for (const ร of รุ่นที่ทำ) ผล.push(await ทำรุ่น(ร, ovrMap, เขียนจริง))

  return NextResponse.json({
    ok: true,
    โหมด: เขียนจริง ? 'เขียนจริง' : 'รอบซ้อม (ไม่เขียน)',
    เลขOEMในคลัง: ovrMap.size,
    'รายชื่อรุ่นมาจาก': แหล่ง.ที่มา,
    รวมจับคู่ใหม่: ผล.reduce((s, x) => s + x.จับคู่ใหม่, 0),
    รุ่น: ผล,
    'ℹ️ อ่านยังไง':
      'จับคู่ใหม่ = คู่ที่เพิ่งเติม · ข้ามเพราะมีแล้ว = ของที่คนกรอกไว้ ไม่ถูกแตะ · ' +
      'เลขOEMในคลัง = จำนวนเลขที่อ่านได้จริงจาก /catalog (0 แปลว่าอ่านผิดที่ ไม่ใช่คลังว่าง)',
  })
}

export async function GET(req: NextRequest) { return วิ่ง(req, false) }
export async function POST(req: NextRequest) { return วิ่ง(req, true) }
