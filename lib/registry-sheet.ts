/* 📥 ตัวดึงชีททะเบียนอัตโนมัติ — ท่านประธานสั่ง 22 ต.ค. 2569 ("ทำให้มันออโต้สิ" · ใบสั่ง-สต็อกออโต้.md)
 *
 * 🔴 ชีทนี้เป็นของภรรยาท่าน + เป็นบัญชีตามกฎหมาย ⇒ **อ่านอย่างเดียว** (ความจำ ห้ามแตะชีตภรรยาท่านประธาน)
 *    · ใช้แค่ `GET files/{id}` (เมตาดาต้า) และ `GET files/{id}?alt=media` (ไบต์ .xlsx) — ไม่มีเมธอดเขียนในไฟล์นี้เลย
 *    · **ไม่คัดลอก ไม่แปลงเป็น Google ชีท** (เคยเกิดแล้ว 9 ต.ค. — แปลงแล้วได้ไฟล์ซ้ำ บัญชีแยกสองใบเงียบ ๆ)
 *    · ขอสิทธิ์แค่ `drive.readonly` — เขียนไม่ได้ต่อให้โค้ดผิด
 *
 * 🔑 ทางเดินของตัวเลข: ชีท → (ไฟล์นี้ ทุก 15 นาที) → Blob `latest` → g1 ดึงไปเขียน เป้าสต็อกทะเบียน.json
 *    → ตัวซิงก์ทะเบียน→ZORT ทำต่อ (มีด่านของมันเอง) · ไฟล์นี้ **ไม่ยิง ZORT ไม่ยิงแพลตฟอร์ม**
 *
 * 🔴 ตาข่าย (ใบสั่ง ③) — ออโต้ที่ผิดจะผิดทุกช่องทางพร้อมกัน:
 *    1. อ่านชีทไม่ได้ ⇒ ไม่แตะ `latest` (เป้าเดิมจะเก่าเอง แล้วตัวซิงก์ปฏิเสธเขียนที่ 25 ชม.) + จดเหตุ + เตือน
 *    2. ยอดรหัสไหนลดเกินครึ่ง หรือเหลือ 0 ทั้งที่รอบก่อนมี ⇒ ไม่แตะ `latest` + เตือน (หน้าตาของ "อ่านพลาด")
 *    3. หัวคอลัมน์เปลี่ยนจากที่ล็อกไว้ ⇒ หยุด — กติกานับผูกกับตำแหน่งหัว
 *    4. ยังไม่มีกติกานับที่ยืนยันแล้ว ⇒ **โหมดสำรวจ**: จดแค่หัวคอลัมน์ + จำนวนแถว ไม่ผลิตเป้า
 *    5. ทุกรอบจด log (เวลา · ผล · เหตุ) ⇒ ย้อนดูได้
 */
import { getStore } from '@netlify/blobs'
import JSZip from 'jszip'

export const ไฟล์ชีท = '19DvrLMQNglTiopvH1x00Ql3G0G_TD8ul'
export const สิทธิ์ที่ขอ = 'https://www.googleapis.com/auth/drive.readonly'
const STORE = 'registry-sheet'
const เก็บรอบ = 200

/* ── อ่าน .xlsx ด้วย jszip (ไม่เพิ่มไลบรารี) ─────────────────────────────── */
export interface แท็บ { ชื่อ: string; แถว: string[][] }

const ถอดXML = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
/** matchAll เป็นอาร์เรย์ — tsconfig ของรีโปไม่เปิด downlevelIteration */
const ทุก = (s: string, re: RegExp) => Array.from(s.matchAll(re))
/** ข้อความในเซลล์ — รวมทุก <t> (rich text แตกเป็นหลายท่อน) */
const ข้อความ = (xml: string) => ทุก(xml, /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g).map((m) => ถอดXML(m[1])).join('')
/** "AB12" → 27 (นับจาก 0) */
export function เลขคอลัมน์(ref: string): number {
  const ตัว = (ref.match(/^[A-Z]+/) ?? ['A'])[0]
  let n = 0
  for (const c of ตัว) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

export async function อ่านxlsx(ไบต์: ArrayBuffer | Uint8Array): Promise<แท็บ[]> {
  const zip = await JSZip.loadAsync(ไบต์)
  const อ่าน = async (p: string) => (await zip.file(p)?.async('string')) ?? null
  const wb = await อ่าน('xl/workbook.xml')
  const rels = await อ่าน('xl/_rels/workbook.xml.rels')
  if (!wb || !rels) throw new Error('ไม่ใช่ไฟล์ .xlsx (ไม่มี workbook.xml)')
  const ss = await อ่าน('xl/sharedStrings.xml')
  const คำร่วม = ss ? ทุก(ss, /<si>([\s\S]*?)<\/si>/g).map((m) => ข้อความ(m[1])) : []
  const ปลาย = new Map(ทุก(rels, /<Relationship\b[^>]*>/g).map((m) => {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1] ?? ''
    const t = m[0].match(/\bTarget="([^"]+)"/)?.[1] ?? ''
    return [id, t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '')]
  }))
  const ผล: แท็บ[] = []
  for (const m of ทุก(wb, /<sheet\b[^>]*\/?>/g)) {
    const ชื่อ = ถอดXML(m[0].match(/\bname="([^"]*)"/)?.[1] ?? '')
    const rid = m[0].match(/\br:id="([^"]+)"/)?.[1] ?? ''
    const xml = await อ่าน(ปลาย.get(rid) ?? '')
    if (xml === null) throw new Error(`แท็บ "${ชื่อ}" ชี้ไปไฟล์ที่ไม่มีในเล่ม`)
    const แถว: string[][] = []
    for (const r of ทุก(xml, /<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const เลขแถว = Number(r[1].match(/\br="(\d+)"/)?.[1] ?? แถว.length + 1) - 1
      const ช่อง: string[] = []
      for (const c of ทุก(r[2], /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1].match(/\br="([A-Z]+\d+)"/)?.[1]
        const t = c[1].match(/\bt="([^"]+)"/)?.[1]
        const ใน = c[2] ?? ''
        const v = ใน.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        const ค่า = t === 's' ? (คำร่วม[Number(v)] ?? '') : t === 'inlineStr' ? ข้อความ(ใน) : v != null ? ถอดXML(v) : ''
        ช่อง[ref ? เลขคอลัมน์(ref) : ช่อง.length] = ค่า.trim()
      }
      แถว[เลขแถว] = Array.from(ช่อง, (x) => x ?? '')
    }
    ผล.push({ ชื่อ, แถว: Array.from(แถว, (x) => x ?? []) })
  }
  return ผล
}

/* ── สำรวจหัวคอลัมน์ — 🔴 ห้ามเก็บแถวข้อมูล (มีชื่อลูกค้า/เลขใบอนุญาต) ───────── */
const คำหัว = /ซีเรียล|หมายเลข|ยี่ห้อ|ขนาด|รุ่น|จำหน่าย|วันที่|ลำดับ|ใบอนุญาต|ผู้ซื้อ|รับ/
export interface สำรวจแท็บ { ชื่อ: string; แถวหัว: number | null; หัว: string[]; แถวมีของหลังหัว: number }
/** หาแถวหัว = แถวใน 15 แถวแรกที่มีคำหัวมากที่สุด (อย่างน้อย 2 คำ) — เก็บเฉพาะแถวนั้น */
export function สำรวจ(แท็บทั้งหมด: แท็บ[]): สำรวจแท็บ[] {
  return แท็บทั้งหมด.map((t) => {
    let ดี = -1, คะแนนดี = 1
    t.แถว.slice(0, 15).forEach((r, i) => {
      const k = r.filter((x) => คำหัว.test(x)).length
      if (k > คะแนนดี) { ดี = i; คะแนนดี = k }
    })
    const หัว = ดี >= 0 ? t.แถว[ดี].map((x) => x.slice(0, 40)) : []
    const หลัง = ดี >= 0 ? t.แถว.slice(ดี + 1).filter((r) => r.some((x) => x !== '')).length : 0
    return { ชื่อ: t.ชื่อ, แถวหัว: ดี >= 0 ? ดี + 1 : null, หัว, แถวมีของหลังหัว: หลัง }
  })
}
/** ลายนิ้วมือของรูปแบบเล่ม — เปลี่ยนเมื่อแท็บ/หัวคอลัมน์เปลี่ยน */
export const ลายนิ้วมือ = (ส: สำรวจแท็บ[]) => JSON.stringify(ส.map((x) => [x.ชื่อ, x.แถวหัว, x.หัว]))

/* ── ตาข่ายข้อ 2 — แยกเป็นฟังก์ชันล้วนให้เทสเรียกตัวจริงได้ ──────────────── */
export function ลดฮวบ(เดิม: Record<string, number> | null, ใหม่: Record<string, number>): string[] {
  if (!เดิม) return []
  const ผิด: string[] = []
  for (const [k, ก่อน] of Object.entries(เดิม)) {
    const หลัง = ใหม่[k]
    if (ก่อน > 0 && หลัง === undefined) ผิด.push(`${k}: ${ก่อน} → หายจากผลนับ`)
    else if (ก่อน > 0 && หลัง === 0) ผิด.push(`${k}: ${ก่อน} → 0`)
    else if (ก่อน >= 2 && หลัง !== undefined && หลัง < ก่อน / 2) ผิด.push(`${k}: ${ก่อน} → ${หลัง} (ลดเกินครึ่ง)`)
  }
  return ผิด
}

/* ── รอบหนึ่งรอบ ─────────────────────────────────────────────────────── */
export type สถานะรอบ = 'พร้อม' | 'สำรวจ' | 'หยุด-ลดฮวบ' | 'หยุด-หัวเปลี่ยน' | 'อ่านไม่ได้' | 'ยังไม่ได้อนุญาต'
export interface ผลรอบ {
  เมื่อ: string
  สถานะ: สถานะรอบ
  เหตุ?: string
  ชีทแก้ไขล่าสุด?: string
  สำรวจ?: สำรวจแท็บ[]
  stocks?: Record<string, number>
  ลดฮวบ?: string[]
}
export interface ข้อมูลล่าสุด { stocks: Record<string, number>; เมื่อ: string; ชีทแก้ไขล่าสุด?: string }

/** กติกานับแถว → รหัส · ⏳ **ยังไม่มี** จนกว่าจะเห็นหัวคอลัมน์จริงและนับได้ตรงกับที่ CEO ยืนยัน 22 ต.ค.
 *  (185 ชิ้น · บาร์ 132 · เลื่อย 53 · ตรงรายรหัสทั้ง 24 ตัว) ⇒ ระหว่างนี้คืน null = โหมดสำรวจ
 *  🔴 ห้ามเดาหัวคอลัมน์แล้วผลิตเป้า — เป้าผิดไหลไป ZORT และทุกแพลตฟอร์มพร้อมกัน */
export function นับตามกติกา(_แท็บ: แท็บ[]): Record<string, number> | null {
  return null
}

const ร้าน = () => getStore(STORE)

async function โทเคนเข้าถึง(refresh: string): Promise<string> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10000),
  })
  const d = await r.json().catch(() => null)
  if (!r.ok || !d?.access_token) throw new Error(`ขอ access token ไม่ได้ (${r.status} ${d?.error ?? ''}) — อาจต้องให้ท่านกดอนุญาตใหม่`)
  return d.access_token
}

async function เมตา(access: string) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ไฟล์ชีท}?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(10000) })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`อ่านข้อมูลไฟล์ชีทไม่ได้ (${r.status} ${d?.error?.message ?? ''})`)
  return d as { id: string; name: string; mimeType: string; modifiedTime: string }
}

/** เก็บ refresh token — 🔴 เก็บเฉพาะเมื่อพิสูจน์แล้วว่าเปิดชีทนี้ได้จริง
 *  `/api/google/*` อยู่นอกกำแพงล็อกอิน ⇒ ใครก็กดอนุญาตด้วยบัญชีตัวเองได้ · บัญชีที่ไม่มีสิทธิ์ในชีทนี้จะไม่ทับของเดิม */
export async function เก็บโทเคน(refresh: string): Promise<{ ok: true; ชื่อไฟล์: string } | { ok: false; เหตุ: string }> {
  try {
    const m = await เมตา(await โทเคนเข้าถึง(refresh))
    await ร้าน().setJSON('token', { refresh, เมื่อ: new Date().toISOString() })
    return { ok: true, ชื่อไฟล์: m.name }
  } catch (e) {
    return { ok: false, เหตุ: String(e instanceof Error ? e.message : e) }
  }
}

async function จด(ผล: ผลรอบ) {
  const s = ร้าน()
  const เดิม = ((await s.get('log', { type: 'json' }).catch(() => null)) as ผลรอบ[] | null) ?? []
  await s.setJSON('log', [ผล, ...เดิม].slice(0, เก็บรอบ))
  return ผล
}

/** วิ่งหนึ่งรอบ — เรียกจากฟังก์ชันตั้งเวลาทุก 15 นาที */
export async function วิ่งรอบ(): Promise<ผลรอบ> {
  const s = ร้าน()
  const เมื่อ = new Date().toISOString()
  const tok = (await s.get('token', { type: 'json' }).catch(() => null)) as { refresh?: string } | null
  if (!tok?.refresh) return จด({ เมื่อ, สถานะ: 'ยังไม่ได้อนุญาต', เหตุ: 'ยังไม่มีสิทธิ์อ่านชีท — รอท่านประธานกดอนุญาตครั้งเดียว' })
  let แท็บทั้งหมด: แท็บ[], ชีทแก้ไขล่าสุด: string
  try {
    const access = await โทเคนเข้าถึง(tok.refresh)
    const m = await เมตา(access)
    ชีทแก้ไขล่าสุด = m.modifiedTime
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ไฟล์ชีท}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error(`ดาวน์โหลดชีทไม่ได้ (${r.status})`)
    แท็บทั้งหมด = await อ่านxlsx(await r.arrayBuffer())
    if (แท็บทั้งหมด.length === 0) throw new Error('เล่มอ่านได้แต่ไม่มีแท็บเลย')
  } catch (e) {
    return จด({ เมื่อ, สถานะ: 'อ่านไม่ได้', เหตุ: String(e instanceof Error ? e.message : e).slice(0, 300) })
  }
  const ส = สำรวจ(แท็บทั้งหมด)
  const ลาย = ลายนิ้วมือ(ส)
  const ล็อก = (await s.get('layout', { type: 'text' }).catch(() => null)) as string | null
  if (ล็อก && ล็อก !== ลาย) return จด({ เมื่อ, สถานะ: 'หยุด-หัวเปลี่ยน', ชีทแก้ไขล่าสุด, สำรวจ: ส, เหตุ: 'แท็บหรือหัวคอลัมน์ต่างจากที่ล็อกไว้ — กติกานับอาจนับผิดช่อง ⇒ ไม่ผลิตเป้า รอคนดู' })
  const stocks = นับตามกติกา(แท็บทั้งหมด)
  if (!stocks) return จด({ เมื่อ, สถานะ: 'สำรวจ', ชีทแก้ไขล่าสุด, สำรวจ: ส, เหตุ: 'อ่านชีทได้แล้ว · ยังไม่มีกติกานับที่ยืนยันกับเลข 22 ต.ค. ⇒ จดแค่หัวคอลัมน์ ยังไม่ผลิตเป้า' })
  const ก่อน = (await s.get('latest', { type: 'json' }).catch(() => null)) as ข้อมูลล่าสุด | null
  const ฮวบ = ลดฮวบ(ก่อน?.stocks ?? null, stocks)
  if (ฮวบ.length) return จด({ เมื่อ, สถานะ: 'หยุด-ลดฮวบ', ชีทแก้ไขล่าสุด, stocks, ลดฮวบ: ฮวบ, เหตุ: 'ยอดลดผิดปกติ — หน้าตาของการอ่านพลาดมากกว่าขายหมดจริง ⇒ ไม่แทนเป้าเดิม รอคนยืนยัน' })
  if (!ล็อก) await s.set('layout', ลาย)
  await s.setJSON('latest', { stocks, เมื่อ, ชีทแก้ไขล่าสุด } satisfies ข้อมูลล่าสุด)
  return จด({ เมื่อ, สถานะ: 'พร้อม', ชีทแก้ไขล่าสุด, stocks })
}

export async function อ่านสถานะ() {
  const s = ร้าน()
  const [log, latest, tok] = await Promise.all([
    s.get('log', { type: 'json' }).catch(() => null),
    s.get('latest', { type: 'json' }).catch(() => null),
    s.get('token', { type: 'json' }).catch(() => null),
  ])
  return {
    อนุญาตแล้ว: !!(tok as { refresh?: string } | null)?.refresh,
    อนุญาตเมื่อ: (tok as { เมื่อ?: string } | null)?.เมื่อ ?? null,
    latest: (latest as ข้อมูลล่าสุด | null) ?? null,
    log: ((log as ผลรอบ[] | null) ?? []).slice(0, 20),
  }
}
