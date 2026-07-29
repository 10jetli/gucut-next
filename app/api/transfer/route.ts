import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// บัญชี ZORT สำหรับระบบโอนสินค้า (3 บัญชี) — ตั้งใน Vercel env
// ลำดับตรงกับฟอร์มตั้งค่าเดิม: 1=ศีตกาล/โกดัง (คลัง NEW), 2=ZAMA/ANJ (คลัง ANJ), 3=ZAMA/KLD (คลัง KLD)
// env ที่ต้องตั้ง: ZORT_TRF_STORENAME_1..3, ZORT_TRF_APIKEY_1..3, ZORT_TRF_APISECRET_1..3
// ล้างค่าที่อาจติดมาตอนวางค่า: ช่องว่าง/ขึ้นบรรทัด/เครื่องหมายคำพูดหุ้มค่า
const cleanEnv = (v?: string) => (v ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']+|["']+$/g, '').trim()
const TRF_STORES = [1, 2, 3].map(i => ({
  s: cleanEnv(process.env[`ZORT_TRF_STORENAME_${i}`]),
  k: cleanEnv(process.env[`ZORT_TRF_APIKEY_${i}`]),
  x: cleanEnv(process.env[`ZORT_TRF_APISECRET_${i}`]),
}))

const BASE = 'https://open-api.zortout.com/v4'
const isConfigured = () => TRF_STORES.every(a => a.s && a.k && a.x)
const headOf = (a: { s: string; k: string; x: string }) => ({
  storename: a.s,
  apikey: a.k,
  apisecret: a.x,
  'Content-Type': 'application/json',
})

function pickStore(storeParam: string | null) {
  const idx = Number(storeParam ?? '0')
  if (!Number.isInteger(idx) || idx < 1 || idx > 3) return null
  return TRF_STORES[idx - 1]
}

// ---- แจ้งเตือน/ขออนุมัติผ่าน Telegram ก่อนสร้างใบโอนจริง ----
// ข้อมูลคำขอทั้งหมด (from,to,list,...) ถูกฝังไว้ในตัวข้อความ Telegram เอง (เข้ารหัส base64)
// ไม่ต้องเก็บลง DB — ตอนเจ้านายกดปุ่มอนุมัติ/ปฏิเสธ Telegram จะส่งข้อความเดิมกลับมาให้ /api/telegram/webhook อ่านข้อมูลออกมาใช้ได้เลย
const escHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function sendTelegramApproval(payload: any) {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN)
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID)
  if (!token || !chatId) return { ok: false, error: 'ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID บน Vercel' }
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const list: any[] = payload.list || []
  const lines = list.map((it) => `• <b>${escHtml(it.sku)}</b> ${escHtml(it.name || '')} × ${it.number}`).join('\n')
  const staffLine = payload.staffName ? `ผู้คีย์ข้อมูล: ${escHtml(payload.staffName)}\n` : ''
  // ซ่อน REF-DATA ไว้หลัง spoiler (แตะเพื่อดู) กันรกตา แต่ตัวอักษรยังอยู่ในข้อความให้ webhook อ่านได้เหมือนเดิม
  const text = `🔄 <b>คำขอโอนสินค้าใหม่</b>\nอ้างอิง: <b>${escHtml(payload.ref)}</b>\n\n${lines}\n\nจาก: ${escHtml(payload.fromLabel)}\nไป: ${escHtml(payload.toLabel)}\n${staffLine}\n<tg-spoiler>REF-DATA:${b64}</tg-spoiler>`

  // ส่งรูปสินค้า (ถ้ามี) เป็นรูปเดี่ยวทีละใบ (ใหญ่ชัด ไม่ใช่อัลบั้มย่อเล็ก) ก่อนส่งข้อความสรุป + ปุ่มอนุมัติ
  const withImg = list.filter((it) => it.img)
  for (const it of withImg) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: it.img, caption: `${it.sku} ${it.name || ''} × ${it.number}` }),
      })
    } catch { /* รูปส่งไม่สำเร็จก็ไม่เป็นไร ข้อความสรุปด้านล่างยังส่งต่อได้ */ }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ อนุมัติ', callback_data: 'approve' },
          { text: '❌ ปฏิเสธ', callback_data: 'reject' },
        ]],
      },
    }),
  }).then(r => r.json())
  if (!res.ok) return { ok: false, error: 'ส่งข้อความ Telegram ไม่สำเร็จ: ' + (res.description || '') }
  return { ok: true }
}

// GET /api/transfer?op=status                    → เช็คว่าตั้งค่า env ครบไหม (ไม่เปิดเผยกุญแจ)
// GET /api/transfer?op=recent&store=N            → ใบโอนล่าสุดของบัญชี N
// GET /api/transfer?op=warehouses&store=N        → รายชื่อคลังของบัญชี N (ใช้ทดสอบการเชื่อมต่อ)
export async function GET(req: NextRequest) {
  const op = req.nextUrl.searchParams.get('op')
  if (op === 'status') return NextResponse.json({ configured: isConfigured() })
  if (op === 'diag') {
    // ตรวจค่า env แบบไม่เปิดเผยกุญแจ: ส่งเฉพาะความยาว + hash ย่อ ไว้เทียบกับค่าที่ถูกต้อง
    const h8 = async (v: string) => {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))
      return Array.from(new Uint8Array(b)).slice(0, 4).map(n => n.toString(16).padStart(2, '0')).join('')
    }
    const stores = [] as any[]
    for (const a of TRF_STORES) {
      stores.push({ sLen: a.s.length, kLen: a.k.length, xLen: a.x.length, sH: await h8(a.s), kH: await h8(a.k), xH: await h8(a.x) })
    }
    return NextResponse.json({ stores })
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ZORT_TRF_* บน Vercel' }, { status: 400 })
  }
  const acc = pickStore(req.nextUrl.searchParams.get('store'))
  if (!acc) return NextResponse.json({ error: 'store ต้องเป็น 1-3' }, { status: 400 })
  try {
    if (op === 'recent') {
      const r = await fetch(`${BASE}/Transfer/GetTransfers?page=1&limit=8`, { headers: headOf(acc), cache: 'no-store' })
      return NextResponse.json(await r.json())
    }
    if (op === 'warehouses') {
      const r = await fetch(`${BASE}/Warehouse/GetWarehouses`, { headers: headOf(acc), cache: 'no-store' })
      return NextResponse.json(await r.json())
    }
    return NextResponse.json({ error: 'op ไม่ถูกต้อง' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/transfer  { op: 'request', from: N, to: N, fromWh, toWh, fromLabel, toLabel, ref, date, list, staffName }
//                                                                → ส่งคำขอไปให้เจ้านายอนุมัติผ่าน Telegram (ยังไม่สร้างใบโอนจริง)
// POST /api/transfer  { op: 'add', store: N, payload: {...} }  → สร้างใบโอน (ใช้ภายในหลังอนุมัติแล้วเท่านั้น)
// POST /api/transfer  { op: 'void', store: N, id: '...' }      → ยกเลิกใบโอน
export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ZORT_TRF_* บน Vercel' }, { status: 400 })
  }
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'body ต้องเป็น JSON' }, { status: 400 })
  }

  if (body.op === 'request') {
    const fromAcc = pickStore(String(body?.from ?? ''))
    const toAcc = pickStore(String(body?.to ?? ''))
    if (!fromAcc || !toAcc) return NextResponse.json({ error: 'from/to ต้องเป็น 1-3' }, { status: 400 })
    if (!Array.isArray(body.list) || !body.list.length) return NextResponse.json({ error: 'ยังไม่มีรายการสินค้า' }, { status: 400 })
    const payload = {
      from: body.from, to: body.to, fromWh: body.fromWh, toWh: body.toWh,
      fromLabel: body.fromLabel, toLabel: body.toLabel, ref: body.ref, date: body.date, list: body.list,
      staffName: String(body.staffName ?? ''),
    }
    const sent = await sendTelegramApproval(payload)
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 500 })
    return NextResponse.json({ ok: true, ref: body.ref })
  }

  const acc = pickStore(String(body?.store ?? ''))
  if (!acc) return NextResponse.json({ error: 'store ต้องเป็น 1-3' }, { status: 400 })
  try {
    if (body.op === 'add') {
      const r = await fetch(`${BASE}/Transfer/AddTransfer`, {
        method: 'POST',
        headers: headOf(acc),
        body: JSON.stringify(body.payload ?? {}),
      })
      return NextResponse.json(await r.json())
    }
    if (body.op === 'void') {
      const r = await fetch(`${BASE}/Transfer/VoidTransfer?id=${encodeURIComponent(String(body.id ?? ''))}`, {
        method: 'POST',
        headers: headOf(acc),
        body: '{}',
      })
      return NextResponse.json(await r.json())
    }
    return NextResponse.json({ error: 'op ไม่ถูกต้อง' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
