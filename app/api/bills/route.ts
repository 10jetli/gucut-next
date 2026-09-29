import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, monthRange, BillMessage } from '@/lib/gmail'
import { เดือนบิลถูกต้อง, เกณฑ์เดือนบิล } from '@/lib/billmonth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills?month=2026-06 → รายการบิลทั้งหมดของเดือนนั้น
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  /* 🔑 เกณฑ์เดือนอยู่ที่ `lib/billmonth.ts` **แหล่งเดียว** (CEO ตัดสิน 30 ก.ย. 2569)
     เหตุผลไม่ได้อิงว่าเส้นนี้อ่านหรือเขียน — อิงว่า **ไม่มีผู้เรียกที่ถูกต้องคนไหนส่งค่านั้น**
     📏 กวาดผู้เรียกก่อนรัด: เส้นนี้มีผู้เรียกเดียว และส่งเดือนที่อยู่ในช่วงเสมอ
     ⚠️ **สองสถานะ ไม่ใช่สาม** ที่เส้นนี้ — เพราะ `month` เป็นของที่ต้องมี
        (ไม่ส่งมา ⇒ 400 อยู่แล้วตั้งแต่เดิม) ⇒ ไม่มีสถานะ "ไม่ส่ง = ถอยไปค่าเริ่มต้น"
        เขียนกำกับไว้เพราะเส้น `bills/watch` มีสามสถานะ ⇒ คนอ่านจะคาดว่าที่นี่ก็สาม */
  if (!เดือนบิลถูกต้อง(month)) {
    return NextResponse.json({ error: `ต้องระบุ ?month=YYYY-MM · ${เกณฑ์เดือนบิล}` }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    const { after, before } = monthRange(month)

    const results = await Promise.allSettled(
      VENDORS.map(v => searchVendorBills(token, v, after, before)),
    )

    const bills: BillMessage[] = []
    const errors: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') bills.push(...r.value)
      else errors.push(`${VENDORS[i].name}: ${r.reason?.message ?? r.reason}`)
    })

    // เรียงตามวันที่ และสรุปว่าเจ้าไหนไม่พบบิล
    bills.sort((a, b) => a.date.localeCompare(b.date))
    const foundVendorIds = new Set(bills.map(b => b.vendorId))
    const missing = VENDORS.filter(v => !foundVendorIds.has(v.id))
      .map(v => ({ id: v.id, name: v.name, emoji: v.emoji }))

    return NextResponse.json({ month, bills, missing, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
