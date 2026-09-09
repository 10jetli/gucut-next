#!/usr/bin/env node
/* ยิงของจริง: จอ "รายการ → รายละเอียด" ทุกคู่ ยังพากันไปถูกใบไหม (9 ก.ย. 2569)
 *
 * ทำไมต้องมี — สองบั๊กที่เจอวันนี้ **ผ่านทุกด่านที่มีอยู่**:
 *   ① จอแพ็คสินค้าส่งเลขที่ใบไปเป็น id ⇒ เปิดใบไม่ได้ทุกใบ (tsc ผ่าน · ท่อปลอมผ่าน)
 *   ② ท่อคืนบรรทัดสินค้ามาเป็นหัวใบ ⇒ เลขที่ใบและยอดเงินบนจอผิด (จอทำถูกทุกบรรทัด)
 * ทั้งคู่เห็นได้ทางเดียวคือ **เอาค่าที่จอส่งจริง ไปยิงเส้นจริง แล้วดูว่าได้ใบเดียวกันกลับมาไหม**
 *
 * ใช้: GUCUT_ADMIN_KEY=... node scripts/check-detail-live.mjs
 *      (ไม่ตั้ง env จะอ่านจาก ~/.gucut-admin-key)
 * อ่านอย่างเดียว ไม่เขียนอะไรทั้งสิ้น · ออกโค้ด 1 ถ้ามีคู่ไหนพัง
 *
 * ⚠️ "ผ่าน" ที่นี่แปลว่า **ยังพาไปถูกใบ** เท่านั้น ไม่ได้แปลว่าทุกช่องบนจอถูก
 * ⚠️ ตัวตรวจนี้ตรวจ "แถวแรก" ของแต่ละรายการ — ไม่ใช่การกวาดครบทุกใบ
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.GUCUT_WEB_BASE || 'https://gucut.com'
const KEY = process.env.GUCUT_ADMIN_KEY
  || (() => { try { return readFileSync(join(homedir(), '.gucut-admin-key'), 'utf8').trim() } catch { return '' } })()
if (!KEY) { console.error('ไม่มีรหัสหลังร้าน — ตั้ง GUCUT_ADMIN_KEY หรือวางไว้ที่ ~/.gucut-admin-key'); process.exit(2) }

/** ช่องที่มีได้เฉพาะใน "บรรทัดสินค้า" — โผล่ในรายชื่อช่องหัวใบเมื่อไหร่ = ท่ออ่านผิดชั้น */
const LINE_ONLY = ['sku', 'productid', 'pricepernumber', 'bundleitemid']

const get = async (qs) => {
  const res = await fetch(`${BASE}/api/core?${qs}`, { headers: { 'x-admin-key': KEY } })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

/** คู่ที่ต้องตรวจ — key คือ "จอไหนส่งค่าอะไรไปที่เส้นไหน" (ต้องตรงกับซอร์สจอจริง)
 *  เพิ่มจอใหม่ที่มีหน้า detail แล้วต้องมาเพิ่มที่นี่ด้วย ไม่งั้นตัวตรวจจะเงียบเรื่องจอนั้นตลอดไป */
const PAIRS = [
  {
    name: 'ใบเสนอราคา', list: 'list=quotations&limit=1', param: 'quotation', from: 'id',
    screen: '/core/quotations → /core/quotations/detail?id=',
    identity: (row, d) => d?.number === row.number,
    identityNote: 'เลขที่ใบที่คืนมาต้องตรงกับแถวที่กด',
  },
  {
    name: 'ใบโอน', list: 'list=transfers&limit=1', param: 'transfer', from: 'id',
    screen: '/core/transfers → /core/transfers/detail?id=',
    identity: (row, d) => d?.number === row.number,
    identityNote: 'เลขที่ใบที่คืนมาต้องตรงกับแถวที่กด',
  },
  {
    name: 'ใบสั่งซื้อ', list: 'list=purchases&limit=1', param: 'purchase', from: 'number',
    screen: '/core/purchases → /core/purchases/detail?no=',
    identity: (row, d) => d?.number === row.number,
    identityNote: 'เลขที่ใบที่คืนมาต้องตรงกับแถวที่กด',
  },
  {
    name: 'ผู้ติดต่อ', list: 'list=contacts&limit=1', param: 'customer', from: 'name',
    screen: '/core/customers → /core/customers/detail?name=',
    identity: (row, d) => (d?.contact?.name ?? d?.name) === row.name,
    identityNote: 'ชื่อที่คืนมาต้องตรงกับแถวที่กด',
  },
  {
    name: 'ใบคืนสินค้า', list: 'list=returnorders&limit=1', param: 'returnorder', from: 'id',
    screen: '/core/return-orders → /core/return-orders/detail?id=',
    identity: (row, d) => d?.number === row.number,
    identityNote: 'เลขที่ใบที่คืนมาต้องตรงกับแถวที่กด',
  },
  {
    name: 'ใบขาย', list: 'list=orders&limit=1', param: 'order', from: 'id',
    screen: '/core/sales · หน้าแรก · บริการส่งสินค้า → /core/sales/detail?id=',
    identity: (row, d) => d?.order?.id === row.id,
    identityNote: 'id ของใบที่คืนมาต้องตรงกับแถวที่กด',
  },
]

let bad = 0
for (const p of PAIRS) {
  const { body: lb } = await get(p.list)
  const row = (lb?.rows ?? lb?.items ?? [])[0]
  if (!row) { console.log(`⚪ ${p.name}: ไม่มีแถวให้ทดสอบ — ยังไม่รู้ว่าเสียหรือไม่เสีย`); continue }
  const sent = row[p.from]
  if (sent === undefined || sent === null || sent === '') {
    console.log(`🔴 ${p.name}: จอส่งช่อง "${p.from}" แต่รายการไม่มีช่องนั้น (${p.screen})`); bad++; continue
  }
  const { status, body: d } = await get(`${p.param}=${encodeURIComponent(String(sent))}`)
  if (status !== 200 || d?.error || d?.skip) {
    console.log(`🔴 ${p.name}: ส่ง ${p.from}="${sent}" แล้วเปิดไม่ได้ — ${d?.error || d?.skip || `HTTP ${status}`}`)
    console.log(`   ${p.screen}`); bad++; continue
  }
  const wrongLevel = (d?.fields ?? []).some((f) => LINE_ONLY.includes(String(f).toLowerCase()))
  if (wrongLevel) {
    console.log(`🔴 ${p.name}: ท่อคืน **บรรทัดสินค้า** มาเป็นหัวใบ (fields มี ${LINE_ONLY.filter((k) => (d.fields ?? []).map((x) => String(x).toLowerCase()).includes(k)).join(', ')})`)
    console.log(`   ⇒ เลขที่ใบและยอดเงินบนจอไม่ใช่ของใบนี้ · ${p.screen}`); bad++; continue
  }
  if (!p.identity(row, d)) {
    console.log(`🔴 ${p.name}: เปิดได้แต่**ได้คนละใบ** — ${p.identityNote}`)
    console.log(`   ส่งไป ${p.from}="${sent}" (number=${row.number ?? '—'}) แต่ได้ number=${d?.number ?? d?.order?.number ?? '—'}`)
    bad++; continue
  }
  console.log(`✅ ${p.name}: ส่ง ${p.from}="${sent}" แล้วได้ใบเดียวกันกลับมา`)
}

/* ── ของชั่วคราวที่ต้องรู้ว่า "ถึงเวลาลบแล้ว" ──
   จอแพ็คสินค้าต้องยิงหา id เองตอนกด เพราะ pending=1 ไม่ส่ง id มา (บั๊ก 9 ก.ย. 2569)
   วันที่ท่อเพิ่ม id ให้ ถ้าไม่มีอะไรบอก โค้ดชั่วคราวจะอยู่ยาวโดยไม่มีใครรู้ว่าไม่จำเป็นแล้ว */
{
  const { body } = await get('pending=1')
  const row = (body?.['ต้องส่งของ'] ?? [])[0]
  if (!row) console.log('\n⚪ จอแพ็คสินค้า: ไม่มีใบค้างส่งให้ทดสอบ — ยังไม่รู้ว่าท่อเพิ่ม id หรือยัง')
  else if (row.id || row.source) {
    console.log('\n✅ จอแพ็คสินค้า: ท่อส่ง ' + (row.id ? 'id' : 'source') + ' มาแล้ว'
      + ' ⇒ จอใช้ลิงก์ตรงอยู่ (ตัวหา id เหลือไว้เป็นทางถอยเผื่อ rollback ท่อ)')
  } else {
    console.log('\n⏳ จอแพ็คสินค้า: pending=1 ยังไม่ส่ง id/source ⇒ ตัวหา id ตอนกดยังจำเป็นอยู่')
  }
}

console.log(bad === 0
  ? `\nครบ ${PAIRS.length} คู่ — ทุกคู่ยังพาไปถูกใบ (ตรวจแถวแรกของแต่ละรายการ ไม่ใช่ทุกใบ)`
  : `\n🔴 พัง ${bad} คู่จาก ${PAIRS.length}`)
process.exit(bad === 0 ? 0 : 1)
