import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// เปิด /api/google/auth เพื่อเริ่มขั้นตอนขอ refresh token (ทำครั้งเดียวตอนตั้งค่า)
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID (ดู SETUP-BILLS.md)' }, { status: 500 })
  }
  const redirectUri = `${req.nextUrl.origin}/api/google/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return NextResponse.redirect(url.toString())
}
