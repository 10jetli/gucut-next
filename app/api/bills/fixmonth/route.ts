import { NextRequest, NextResponse } from 'next/server'
import { loadBillIndexBlobs, saveBillIndexBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'

// POST /api/bills/fixmonth { secret, vendor, match, month }
// Move wrongly-classified cached bill entries to the correct month.
// Any entry whose filename contains `match` gets its month set to `month`.
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { secret, vendor, match, month } = body
    const required = process.env.DRIVESYNC_SECRET
    if (!required || secret !== required) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!vendor || !match || !/^\d{4}-\d{2}$/.test(month || '')) {
          return NextResponse.json({ error: 'need vendor, match, month (YYYY-MM)' }, { status: 400 })
    }
    const idx = await loadBillIndexBlobs(vendor)
    if (!idx) {
          return NextResponse.json({ error: 'no cache for this vendor' }, { status: 404 })
    }
    let changed = 0
    for (const e of idx.entries) {
          if (e.filename.includes(match) && e.month !== month) {
                  e.month = month
                  changed++
          }
    }
    if (changed > 0) {
          await saveBillIndexBlobs(vendor, idx)
    }
    return NextResponse.json({ ok: true, changed })
}
