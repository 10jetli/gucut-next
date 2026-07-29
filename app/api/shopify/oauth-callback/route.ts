import { NextRequest, NextResponse } from 'next/server'

// ขั้นตอน bootstrap ครั้งเดียว: แลก authorization code จาก Shopify OAuth เป็น Admin API access token
// เข้าทางนี้ได้ก็ต่อเมื่อผ่านหน้าติดตั้งแอปของ Shopify มาแล้วเท่านั้น (ต้องล็อกอิน Shopify admin ของร้านก่อน)
// ผลลัพธ์ที่ได้ (access_token) ให้คัดลอกไปตั้งเป็น env var SHOPIFY_ADMIN_TOKEN ใน Vercel ด้วยตัวเอง
// — ระบบนี้ไม่บันทึก token ไว้ที่ไหนทั้งสิ้น แสดงผลครั้งเดียวในหน้านี้เท่านั้น
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  if (!code || !shop) {
    return NextResponse.json({ error: 'missing code or shop in query' }, { status: 400 })
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET ใน Vercel' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const data = await res.json()
    return NextResponse.json({
      note: 'คัดลอก access_token ด้านล่างไปตั้งเป็น SHOPIFY_ADMIN_TOKEN ใน Vercel (Settings → Environment Variables) จากนั้นตั้ง SHOPIFY_STORE_DOMAIN เป็นค่า shop ด้านล่างด้วย',
      shop,
      ...data,
    })
  } catch (err) {
    return NextResponse.json({ error: 'token exchange failed', detail: String(err) }, { status: 500 })
  }
}
