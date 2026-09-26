import { NextRequest, NextResponse } from 'next/server'

/* 🔐 **ให้เซิร์ฟเวอร์ตั้ง webhook เอง — ไม่มีคนหรือ AI แตะโทเคนเลยสักขั้น**
 *
 * 🔴 **ที่มา (26 ก.ย. 2569)** — ต้องตั้ง `setWebhook` ให้บอทร้าน พร้อม `secret_token`
 *    ทางที่ผิดและเราไม่ทำ: เอาโทเคนบอทมาไว้บนเครื่อง g1 แล้วยิงเอง
 *    · โทเคนตัวเดียวที่มีบน g1 เป็นของ **บอท Hermes** (ยิง `getMe` ยืนยันแล้ว)
 *      ⇒ ยิงด้วยตัวนั้น = **ย้าย Hermes ไปเป็น webhook แล้ว Hermes หยุดรับข้อความ**
 *    · และกติกาทีม: **ทั้งคนและ AI ห้ามจับโทเคนบอทร้าน**
 *  ✅ ท่าที่ถูก (ฝั่งท่อเสนอ · ผมทำตาม): **เซิร์ฟเวอร์อ่าน env ของตัวเองแล้วยิงให้**
 *    ⇒ โทเคนไม่เคยออกจาก Netlify · ไม่เคยผ่านตาใคร · ไม่เคยอยู่ในไฟล์บนเครื่องเรา
 *
 * 🚫 **ไม่คืนค่าโทเคนหรือกุญแจกลับมาในคำตอบเด็ดขาด** — คืนแค่ผลและ `getWebhookInfo`
 * 🔑 คืน `getWebhookInfo` มาด้วยทุกครั้ง เพราะ **"setWebhook ตอบ ok" ไม่ได้พิสูจน์ว่าตั้งค่าไหน**
 *    (คลาสที่ทีมเจ็บมาแล้ว: ข้อความสำเร็จ ≠ สถานะที่ต้องการ) ⇒ ต้องอ่านสถานะจริงกลับมาเทียบ
 * 📌 **เรื่องพาธ — ตั้งใจวางใต้ `/api/telegram` ทั้งที่มันอยู่นอกกำแพงล็อกอิน**
 *    `PUBLIC_PATHS` ใน middleware มี `'/api/telegram'` เป็น **คำนำหน้า** ⇒ เส้นนี้จึงเปิดถึงจากนอกบ้าน
 *    · วางที่อื่น (เช่น `/api/admin/...`) จะอยู่หลังกำแพง **แต่เรียกจาก CLI ไม่ได้เลย** (เด้ง 307 ไปหน้าล็อกอิน)
 *      และเราไม่ถือรหัส SITE_PASSWORD ตามกติกา
 *    ⇒ ⇒ จึงยอมให้อยู่นอกกำแพง **แต่ต้องมี `x-admin-key` และ fail closed** เป็นชั้นเดียวที่กัน
 *    ⚠️ **ต้องรู้ว่านี่คือการเพิ่มพื้นที่สาธารณะหนึ่งเส้น** (ไม่ต้องเพิ่มรายการใน PUBLIC_PATHS เพราะคำนำหน้าครอบอยู่แล้ว)
 *       ⇒ ใครอ่านรายการ env/เส้นสาธารณะภายหลัง จะนับได้เท่าเดิม ⇒ **จึงต้องเขียนไว้ที่นี่ว่ามีเส้นนี้เพิ่ม**
 * ⚠️ Telegram **ไม่คืน `secret_token`** ใน `getWebhookInfo` ⇒ ช่องนั้นพิสูจน์ไม่ได้จากที่นี่
 *    ⇒ ตัวที่พิสูจน์ว่ากุญแจถูกคือ **ยิง callback เข้าเส้น webhook พร้อมหัวกุญแจ** (เคสบวก/เคสลบ)
 */

const cleanEnv = (v?: string) => (v ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']+|["']+$/g, '').trim()

/** ต้องมี `x-admin-key` ตรงกับ env — ไม่มี env ⇒ **ปฏิเสธ** (fail closed เหมือนเส้น webhook) */
function กุญแจแอดมินถูกไหม(req: NextRequest): boolean {
  const ต้องเป็น = cleanEnv(process.env.GUCUT_ADMIN_KEY)
  if (!ต้องเป็น) {
    console.error('[telegram/set-webhook] ปฏิเสธ: ยังไม่ได้ตั้ง GUCUT_ADMIN_KEY ⇒ fail closed')
    return false
  }
  return cleanEnv(req.headers.get('x-admin-key') || '') === ต้องเป็น
}

async function tg(token: string, method: string, body?: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => null)
  return { status: r.status, ok: r.ok, body: j as { ok?: boolean; description?: string; result?: unknown } | null }
}

/** ดูสถานะปัจจุบันโดยไม่เปลี่ยนอะไร — ใช้ตรวจก่อน/หลังได้ */
export async function GET(req: NextRequest) {
  if (!กุญแจแอดมินถูกไหม(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  /* 🔴 **แก้ 26 ก.ย. 2569 — รุ่นแรกของเส้นนี้ตอบ 503 เรื่องโทเคนแล้ว *ตัดจบ***
   *    ⇒ ไม่ได้ตอบคำถามหลักที่สร้างเส้นนี้ขึ้นมา คือ **กุญแจ webhook ถูกตั้งแล้วหรือยัง**
   *    ⇒ เจอตอนใช้งานจริงครั้งแรก: `TELEGRAM_BOT_TOKEN` ไม่มีค่าใน env ของโปรเจกต์นี้
   *       (โทเคนอยู่ที่โปรเจกต์ท่อ) ⇒ เส้นนี้ตอบ 503 แล้วเงียบเรื่องกุญแจ
   *    🔑 บทเรียน: **เส้นที่ถูกสร้างเพื่อตอบคำถามหนึ่ง ต้องตอบคำถามนั้นให้ได้ก่อนเสมอ**
   *       ไม่ใช่ตัดจบเพราะเงื่อนไขอื่นที่ไม่เกี่ยวกับคำถาม
   * ⇒ ตอนนี้รายงาน **ทุกช่องที่ตรวจได้** ทุกครั้ง แล้วค่อยบอกว่าอะไรที่ยังตอบไม่ได้และเพราะอะไร */
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN)
  const secret = cleanEnv(process.env.TELEGRAM_WEBHOOK_SECRET)
  const สภาพ = {
    'ตั้งโทเคนแล้วไหม': !!token,
    'ตั้งกุญแจแล้วไหม': !!secret,
    _หมายเหตุ: 'true แปลว่า env **มีค่า** ไม่ได้แปลว่า **ค่าถูก** — ตัวที่พิสูจน์ว่าถูกคือ callback จริงที่ผ่านด่าน',
  }
  if (!token) {
    return NextResponse.json({
      ok: false,
      ...สภาพ,
      'อ่าน getWebhookInfo ไม่ได้เพราะ': 'ไม่มี TELEGRAM_BOT_TOKEN ในโปรเจกต์นี้ ⇒ คุยกับ Telegram จากที่นี่ไม่ได้',
      'สิ่งที่ยังตอบได้': 'ช่อง ตั้งกุญแจแล้วไหม ข้างบน — ตรวจจาก env ของโปรเจกต์นี้โดยตรง',
    }, { status: 503 })
  }
  const info = await tg(token, 'getWebhookInfo')
  return NextResponse.json({ ok: true, ...สภาพ, getWebhookInfo: info.body?.result ?? null })
}

/** ตั้ง webhook จริง — ต้องส่ง `x-admin-key` และต้องมีทั้งสอง env */
export async function POST(req: NextRequest) {
  if (!กุญแจแอดมินถูกไหม(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN)
  const secret = cleanEnv(process.env.TELEGRAM_WEBHOOK_SECRET)
  /* ⚠️ แยก "ไม่มี" ออกจาก "มีแต่ว่าง" ให้ชัด — ของที่ Ctrl+V ไม่ติดจะได้ค่าว่าง
     ซึ่งหน้าตาเหมือน "ตั้งแล้ว" ในรายการ env ทุกประการ (เหตุที่ต้องมีเส้นนี้) */
  const ขาด: string[] = []
  if (!token) ขาด.push('TELEGRAM_BOT_TOKEN')
  if (!secret) ขาด.push('TELEGRAM_WEBHOOK_SECRET')
  if (ขาด.length) {
    console.error(`[telegram/set-webhook] ทำไม่ได้: env ที่ยังว่าง = ${ขาด.join(' · ')}`)
    return NextResponse.json({ ok: false, 'env ที่ยังว่าง': ขาด, หมายเหตุ: 'มีชื่อในรายการ env ไม่ได้แปลว่ามีค่า' }, { status: 503 })
  }

  const url = new URL(req.url)
  const เส้นปลายทาง = `${url.protocol}//${url.host}/api/telegram/webhook`

  const ตั้ง = await tg(token, 'setWebhook', {
    url: เส้นปลายทาง,
    secret_token: secret,
    allowed_updates: ['callback_query', 'message'],
    drop_pending_updates: false,
  })
  const info = await tg(token, 'getWebhookInfo')
  const r = (info.body?.result ?? {}) as { url?: string; has_custom_certificate?: boolean; pending_update_count?: number; last_error_message?: string }

  /* 🔑 ตรวจกลับเองว่า url ที่ Telegram จำไว้ **ตรงกับที่เราสั่ง** ไม่ใช่เชื่อคำว่า ok */
  const ตรงกันไหม = r.url === เส้นปลายทาง
  return NextResponse.json({
    ok: ตั้ง.body?.ok === true && ตรงกันไหม,
    setWebhook: { status: ตั้ง.status, ok: ตั้ง.body?.ok ?? null, description: ตั้ง.body?.description ?? null },
    getWebhookInfo: {
      url: r.url ?? null,
      has_custom_certificate: r.has_custom_certificate ?? null,
      pending_update_count: r.pending_update_count ?? null,
      last_error_message: r.last_error_message ?? null,
    },
    'url ที่สั่งไป': เส้นปลายทาง,
    'url ตรงกันไหม': ตรงกันไหม,
    '⚠️ พิสูจน์ได้เท่านี้': 'Telegram ไม่คืน secret_token ⇒ เส้นนี้ยืนยันได้แค่ว่า url ถูกตั้ง · ความถูกของกุญแจต้องพิสูจน์ด้วยการยิง callback พร้อมหัว',
  })
}
