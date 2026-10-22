import { NextRequest, NextResponse } from 'next/server'
import { เก็บโทเคน } from '@/lib/registry-sheet'

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

  /* 📥 สิทธิ์อ่านชีททะเบียน (state=registry) — **ไม่โชว์ token บนจอ** เก็บลง Blob เลย
     🔴 เก็บเฉพาะเมื่อ token นี้เปิดชีททะเบียนได้จริง (เส้นนี้อยู่นอกกำแพงล็อกอิน ⇒ บัญชีอื่นกดได้แต่ทับของเดิมไม่ได้) */
  if (req.nextUrl.searchParams.get('state') === 'registry') {
    const ผล = await เก็บโทเคน(data.refresh_token)
    const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px">
${ผล.ok
  ? `<h2>✅ อนุญาตแล้ว</h2><p>ระบบอ่านชีททะเบียนได้แล้ว (อ่านอย่างเดียว) จะดึงเองทุก 15 นาที</p><p style="color:#888;font-size:13px">ไม่ต้องทำอะไรต่อ ปิดหน้านี้ได้เลย</p>`
  : `<h2>⚠️ ยังไม่สำเร็จ</h2><p>บัญชีที่กดอนุญาตเปิดชีททะเบียนไม่ได้ — ต้องกดด้วยบัญชีที่ได้รับแชร์ชีทนั้น</p><p style="color:#888;font-size:13px">${ผล.เหตุ.replace(/[<>&]/g, '')}</p>`}
</body></html>`
    return new NextResponse(html, { status: ผล.ok ? 200 : 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const html = `<!doctype html><html lang="th"><meta charset="utf-8">
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px">
<h2>✅ ได้ Refresh Token แล้ว</h2>
<p>คัดลอกค่าด้านล่าง ไปใส่ใน Netlify → Environment variables ชื่อ <b>GOOGLE_REFRESH_TOKEN</b> แล้ว deploy ใหม่</p>
<textarea style="width:100%;height:120px;font-size:13px" onclick="this.select()">${data.refresh_token}</textarea>
<p style="color:#888;font-size:13px">⚠️ เก็บเป็นความลับ — ใครมี token นี้จะอ่านอีเมลคุณได้ อย่าแชร์หรือ commit ลง git</p>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
