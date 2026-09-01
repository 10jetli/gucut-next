import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// GET /api/mailcheck — เช็คเมลแจ้งอนุมัติจาก Shopee / Lazada / TikTok / Google Play
//
// ใช้ token Gmail (อ่านอย่างเดียว) ชุดเดียวกับระบบดึงบิล — กล่องเมล 10jetli@gmail.com
// เปิดจากเบราว์เซอร์ที่ล็อกอิน admin.gucut.com ค้างอยู่ได้เลย (middleware คุมให้)
//
// ⚠️ อ่านแค่หัวเมล (จาก/เรื่อง/วันที่) กับ snippet ที่ Gmail ให้มา — ไม่ดึงเนื้อเต็ม
// ⚠️ อย่าเพิ่มเส้นทางนี้ใน PUBLIC_PATHS เด็ดขาด — เนื้อหาเมลต้องอยู่หลังล็อกอินเสมอ

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

const CHECKS: { key: string; label: string; q: string }[] = [
  { key: 'shopee', label: '🟠 Shopee Open Platform', q: 'from:shopee.com newer_than:10d' },
  { key: 'lazada', label: '🔵 Lazada Open Platform', q: 'from:(lazada.com OR alibaba.com) newer_than:10d' },
  { key: 'tiktok', label: '⬛ TikTok Shop Partner', q: 'from:(tiktok.com OR tiktokshop.com OR bytedance.com) newer_than:10d' },
  { key: 'googleplay', label: '🟢 Google Play Console', q: 'from:google.com subject:(Play OR Console OR verification OR ยืนยัน OR identity) newer_than:10d' },
]

async function gget(token: string, path: string) {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${JSON.stringify(data).slice(0, 200)}`)
  return data
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  let token: string
  try {
    token = await getAccessToken()
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 503 })
  }

  const sections: string[] = []
  for (const c of CHECKS) {
    let rows = ''
    try {
      const list = await gget(token, `/messages?q=${encodeURIComponent(c.q)}&maxResults=10`)
      const msgs = list.messages ?? []
      if (!msgs.length) rows = '<p class="none">— ไม่มีเมลใหม่ใน 10 วัน —</p>'
      for (const m of msgs) {
        const d = await gget(token, `/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
        const h = (n: string) => d.payload?.headers?.find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value ?? ''
        const when = h('Date') ? new Date(h('Date')).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : ''
        rows += `<div class="mail"><div class="meta">${esc(when)} · ${esc(h('From'))}</div>` +
                `<div class="subj">${esc(h('Subject'))}</div>` +
                `<div class="snip">${esc(d.snippet ?? '')}</div></div>`
      }
    } catch (e: any) {
      rows = `<p class="err">อ่านไม่ได้: ${esc(String(e?.message ?? e))}</p>`
    }
    sections.push(`<section><h2>${c.label}</h2>${rows}</section>`)
  }

  const html = `<!doctype html><html lang="th"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>เช็คเมลอนุมัติ API</title>
<style>
 body{font-family:system-ui;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#202124;line-height:1.55}
 h1{font-size:20px} h2{font-size:15px;margin:1.6em 0 .5em;border-bottom:2px solid #eee;padding-bottom:4px}
 .mail{border:1px solid #e3e3e3;border-radius:10px;padding:10px 12px;margin:8px 0;background:#fff}
 .meta{font-size:11.5px;color:#5f6368} .subj{font-weight:600;margin:2px 0}
 .snip{font-size:13px;color:#444} .none{color:#5f6368;font-size:13px} .err{color:#d93025;font-size:13px}
 .note{font-size:12px;color:#5f6368;margin-top:2rem}
</style>
<h1>📬 เมลจาก 4 เจ้าใน 10 วันล่าสุด</h1>
${sections.join('\n')}
<p class="note">อ่านจากกล่องเมลเดียวกับระบบดึงบิล · แสดงแค่หัวเมลกับตัวอย่างข้อความ · รีเฟรชเพื่อเช็คใหม่</p>
</html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
