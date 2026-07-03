import { NextResponse } from 'next/server'
import https from 'https'

const SHEET_ID = '1REirvPuMH-OwTMOKx2aDSoAsldiGuwV5cN0ChZOVBy0'
const SHEET_NAME = 'orders'

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
  })
}

// Convert gviz Date(year,month,day) format → YYYY-MM-DD string
// gviz month is 0-indexed (Jan=0, Dec=11)
function parseGvizDate(v: unknown): unknown {
  if (typeof v === 'string') {
    const m = v.match(/^Date\((\d+),(\d+),(\d+)\)$/)
    if (m) {
      const [, y, mo, d] = m.map(Number)
      return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return v
}

export async function GET() {
  try {
    // Use Google Sheets gviz/tq public endpoint (works if sheet is shared publicly)
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`
    const raw = await httpsGet(url)

    // Strip the JSONP wrapper: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    const jsonStr = raw.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '')
    const parsed = JSON.parse(jsonStr)

    // Parse the table into row objects
    const cols: string[] = parsed.table.cols.map((c: { label: string }) => c.label || '')
    const rows = parsed.table.rows.map((row: { c: Array<{ v: unknown } | null> }) => {
      const obj: Record<string, unknown> = {}
      row.c.forEach((cell, i) => {
        obj[cols[i]] = parseGvizDate(cell?.v ?? '')
      })
      return obj
    })

    // Filter: only real factory orders (skip Merchbees Low Stock Alert rows)
    const orders = rows.filter((r: Record<string, unknown>) =>
      r.factory && !String(r.factory).includes('Merchbees') && r.product
    )

    return NextResponse.json({ orders, total: orders.length })
  } catch (err) {
    console.error('[Sheets route error]', err)
    return NextResponse.json({ error: 'fetch failed', detail: String(err) }, { status: 500 })
  }
}
