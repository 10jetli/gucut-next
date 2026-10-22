import { NextRequest, NextResponse } from 'next/server'
import { สิทธิ์ที่ขอ } from '@/lib/registry-sheet'

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
  /* 📥 ?for=registry — สิทธิ์อ่านชีททะเบียนของตัวดึงอัตโนมัติ (lib/registry-sheet.ts · 22 ต.ค. 2569)
     ขอ **drive.readonly อย่างเดียว** แยกจากชุดบิล — ไม่พ่วงสิทธิ์ที่ไม่ใช้ · state บอก callback ให้เก็บลง Blob แทนการโชว์ token */
  const ทะเบียน = req.nextUrl.searchParams.get('for') === 'registry'
  url.searchParams.set('scope', ทะเบียน ? สิทธิ์ที่ขอ : 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file')
  if (ทะเบียน) url.searchParams.set('state', 'registry')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return NextResponse.redirect(url.toString())
}
