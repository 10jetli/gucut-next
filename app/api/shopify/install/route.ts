import { NextRequest, NextResponse } from 'next/server'

// ลิงก์สะดวกสำหรับเริ่ม (หรือรีเฟรช) การเชื่อมต่อ Shopify Admin API
// เปิด /api/shopify/install แล้วจะพาไปหน้ายืนยันสิทธิ์ของ Shopify เอง จากนั้นเด้งกลับมาที่ oauth-callback
export async function GET(request: NextRequest) {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const shop = process.env.SHOPIFY_STORE_DOMAIN
  if (!clientId || !shop) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า SHOPIFY_CLIENT_ID / SHOPIFY_STORE_DOMAIN ใน Vercel' },
      { status: 500 }
    )
  }
  const redirectUri = `${request.nextUrl.origin}/api/shopify/oauth-callback`
  const scope = 'read_products,read_inventory'
  const state = Math.random().toString(36).slice(2)
  const authorizeUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  return NextResponse.redirect(authorizeUrl)
}
