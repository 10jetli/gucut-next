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
 *   POST /api/parts-oem-sync                       ← ทุกรุ่นใน รุ่นที่รองรับ
 *   ต้องมีหัว `x-admin-key` ตรงกับ GUCUT_WEB_ADMIN_KEY ทั้ง GET และ POST
 */
import { NextRequest, NextResponse } from 'next/server'
import { loadCatalogStateBlobs } from '@/lib/catalogstate'

export const dynamic = 'force-dynamic'

/** รุ่นที่มีไฟล์อะไหล่บนหน้าร้าน — เพิ่มรุ่นใหม่ที่นี่ที่เดียว */
const รุ่นที่รองรับ = ['f250', 'f381', 'f440', 'f660', 'f070', 'f090']

const ฐานหน้าร้าน = process.env.GUCUT_WEB_BASE || 'https://gucut.com'

/** ล้างชื่อรุ่น — ต้องตรงกับ `ล้างรุ่น` ของฝั่งท่อ (`parts-map.mjs`) เป๊ะ
 *  ไม่ตรง = เขียนลงคีย์คนละใบ แล้วหน้าร้านอ่านไม่เจอ โดยไม่มีอะไรฟ้อง */
const ล้างรุ่น = (v: string | null) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)

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

  /* ③ จับคู่ */
  const เพิ่ม: Record<string, string> = {}
  let ข้าม = 0
  for (const r of แถว) {
    const รหัส = String(r?.รหัส ?? '')
    if (!รหัส) continue
    if (เดิม[รหัส]) { ข้าม++; continue }          // มีอยู่แล้ว — ของคนกรอก ห้ามแตะ
    const skus = ovrMap.get(เลขล้วน(รหัส))
    if (!skus?.length) continue
    /* เลข OEM เดียวชี้ได้หลาย SKU (เจอจริง: 0000 350 0525 → 2 รหัส)
       ⇒ เอาตัวแรกเรียงตามรหัส ให้ผลซ้ำได้ทุกรอบ · ตัวที่เหลือเป็นงานที่ท่านเลือกเอง */
    เพิ่ม[รหัส] = [...skus].sort()[0]
  }

  const ผล: ผลรุ่น = {
    รุ่น, อะไหล่: แถว.length,
    จับคู่ใหม่: Object.keys(เพิ่ม).length,
    มีอยู่เดิม: Object.keys(เดิม).length,
    ข้ามเพราะมีแล้ว: ข้าม,
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
  const รุ่นที่ทำ = ขอ ? [ขอ] : รุ่นที่รองรับ

  const state = await loadCatalogStateBlobs()
  /* 🔴 อ่านคลังไม่ได้ **ห้ามตีความว่า "คลังว่าง"** แล้วเดินต่อ
     ไม่งั้นจะได้ผล "จับคู่ใหม่ 0" ซึ่งหน้าตาเหมือนทำงานสำเร็จแต่ไม่มีอะไรให้จับ */
  if (!state) return NextResponse.json({ error: 'อ่านคลังอะไหล่ไม่ได้ — ยังไม่ได้เขียนอะไรเลย' }, { status: 503 })
  const ovrMap = เลขOEMจากคลัง(state.ovr ?? {})

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
    รวมจับคู่ใหม่: ผล.reduce((s, x) => s + x.จับคู่ใหม่, 0),
    รุ่น: ผล,
    'ℹ️ อ่านยังไง':
      'จับคู่ใหม่ = คู่ที่เพิ่งเติม · ข้ามเพราะมีแล้ว = ของที่คนกรอกไว้ ไม่ถูกแตะ · ' +
      'เลขOEMในคลัง = จำนวนเลขที่อ่านได้จริงจาก /catalog (0 แปลว่าอ่านผิดที่ ไม่ใช่คลังว่าง)',
  })
}

export async function GET(req: NextRequest) { return วิ่ง(req, false) }
export async function POST(req: NextRequest) { return วิ่ง(req, true) }
