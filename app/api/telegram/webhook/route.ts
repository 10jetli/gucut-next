import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Webhook รับปุ่มกด อนุมัติ/ปฏิเสธ จาก Telegram
// ข้อมูลคำขอโอน (from,to,list,...) ถูกฝังไว้ในข้อความเดิม (REF-DATA: base64) ไม่ได้เก็บฐานข้อมูลแยก
// ป้องกันด้วย secret token ที่ตั้งไว้ตอน setWebhook (เทียบ header X-Telegram-Bot-Api-Secret-Token)
const cleanEnv = (v?: string) => (v ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']+|["']+$/g, '').trim()
const BOT_TOKEN = cleanEnv(process.env.TELEGRAM_BOT_TOKEN)
const WEBHOOK_SECRET = cleanEnv(process.env.TELEGRAM_WEBHOOK_SECRET)

const TRF_STORES = [1, 2, 3].map(i => ({
  s: cleanEnv(process.env[`ZORT_TRF_STORENAME_${i}`]),
  k: cleanEnv(process.env[`ZORT_TRF_APIKEY_${i}`]),
  x: cleanEnv(process.env[`ZORT_TRF_APISECRET_${i}`]),
}))
const BASE = 'https://open-api.zortout.com/v4'
const headOf = (a: { s: string; k: string; x: string }) => ({
  storename: a.s,
  apikey: a.k,
  apisecret: a.x,
  'Content-Type': 'application/json',
})

async function tg(method: string, params: Record<string, any>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return r.json()
}

// ตัดส่วน REF-DATA ท้ายข้อความออก เหลือแต่ข้อความที่คนอ่านได้
function stripData(text: string) {
  return text.replace(/\n*REF-DATA:[\s\S]*/, '').trim()
}

export async function POST(req: NextRequest) {
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('x-telegram-bot-api-secret-token')
    if (got !== WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 })
  }
  let update: any
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const cq = update.callback_query
  if (!cq) return NextResponse.json({ ok: true }) // ไม่ใช่การกดปุ่ม ไม่ต้องทำอะไร

  const chatId = cq.message?.chat?.id
  const messageId = cq.message?.message_id
  const rawText = cq.message?.text || ''
  const action = cq.data

  // ตอบ callback ทันทีกันปุ่มหมุนค้าง แล้วรีบเอาปุ่มออกกันกดซ้ำ
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text: action === 'approve' ? 'กำลังดำเนินการ…' : 'ยกเลิกคำขอแล้ว' })
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })

  const clean = stripData(rawText)
  const m = rawText.match(/REF-DATA:([A-Za-z0-9+/=]+)/)
  if (!m) {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + '\n\n⚠️ ไม่พบข้อมูลคำขอ (ระบบผิดพลาด)' })
    return NextResponse.json({ ok: true })
  }
  let data: any
  try { data = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) } catch {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + '\n\n⚠️ ข้อมูลคำขอเสียหาย' })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + '\n\n❌ ปฏิเสธคำขอนี้แล้ว' })
    return NextResponse.json({ ok: true })
  }

  if (action !== 'approve') return NextResponse.json({ ok: true })

  const src = TRF_STORES[Number(data.from) - 1]
  const dst = TRF_STORES[Number(data.to) - 1]
  if (!src || !dst) {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + '\n\n⚠️ ตั้งค่าบัญชี ZORT ไม่ถูกต้อง' })
    return NextResponse.json({ ok: true })
  }

  try {
    const outRes = await fetch(`${BASE}/Transfer/AddTransfer`, {
      method: 'POST', headers: headOf(src),
      body: JSON.stringify({ fromwarehousecode: data.fromWh, transferdate: data.date, reference: data.ref, description: 'โอนไป ' + data.toLabel, list: data.list }),
    }).then(r => r.json())
    if (outRes.resCode !== '200') throw new Error('ขาออกล้มเหลว: ' + outRes.resDesc)

    const innRes = await fetch(`${BASE}/Transfer/AddTransfer`, {
      method: 'POST', headers: headOf(dst),
      body: JSON.stringify({ towarehousecode: data.toWh, transferdate: data.date, reference: data.ref, description: 'รับจาก ' + data.fromLabel, list: data.list }),
    }).then(r => r.json())
    if (innRes.resCode !== '200') {
      await fetch(`${BASE}/Transfer/VoidTransfer?id=${encodeURIComponent(outRes.resDesc)}`, { method: 'POST', headers: headOf(src), body: '{}' })
      throw new Error('ขารับเข้าล้มเหลว: ' + innRes.resDesc + ' (ยกเลิกขาออกให้แล้ว ไม่มีอะไรเปลี่ยน)')
    }

    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + `\n\n✅ อนุมัติแล้ว โอนสำเร็จ\nขาออก: ${outRes.resDesc2}\nขารับเข้า: ${innRes.resDesc2}` })
  } catch (e: any) {
    await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: clean + '\n\n❌ อนุมัติแล้วแต่โอนไม่สำเร็จ: ' + e.message })
  }
  return NextResponse.json({ ok: true })
}
