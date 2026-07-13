import { NextRequest, NextResponse } from 'next/server'
import { VENDORS, getAccessToken, searchVendorBills, monthRange, BillMessage } from '@/lib/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/bills?month=2026-06 → รายการบิลทั้งหมดของเดือนนั้น
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'ต้องระบุ ?month=YYYY-MM' }, { status: 400 })
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
