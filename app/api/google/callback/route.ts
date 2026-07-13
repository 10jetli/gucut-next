import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Google redirect กลับมาที่นี่พร้อม code → แลกเป็น refresh token แล้วแสดงให้ copy
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'ไม่มี code' }, { status: 400 })

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET' }, { status: 500 })
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${req.nextUrl.origin}/api/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.refresh_token) {
    return NextResponse.json({ error: 'แลก token ไม่สำเร็จ', detail: data }, { status: 500 })
  }

  const html = `<!doctype html><html lang="th"><meta charset="utf-8">
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px">
<h2>✅ ได้ Refresh Token แล้ว</h2>
<p>คัดลอกค่าด้านล่าง ไปใส่ใน Vercel → Settings → Environment Variables ชื่อ <b>GOOGLE_REFRESH_TOKEN</b> แล้ว Redeploy</p>
<textarea style="width:100%;height:120px;font-size:13px" onclick="this.select()">${data.refresh_token}</textarea>
<p style="color:#888;font-size:13px">⚠️ เก็บเป็นความลับ — ใครมี token นี้จะอ่านอีเมลคุณได้ อย่าแชร์หรือ commit ลง git</p>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
