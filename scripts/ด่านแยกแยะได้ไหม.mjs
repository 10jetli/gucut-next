#!/usr/bin/env node
/* ด่านไหน **ถูกพิสูจน์แล้วว่าแยกแยะได้** — 🚫 ไม่อยู่ใน prebuild (แก้ไฟล์ชั่วคราว · ช้า)
 * (19 ก.ย. 2569 · ใบ S2)
 *
 * 🔴 ปัญหา: วันนี้ผมพิสูจน์ด่านทีละตัวหลายตัว **แล้วทิ้งการพิสูจน์ไว้ในจดหมาย**
 *    ⇒ รอบหน้าไม่มีใครรู้ว่าตัวไหนเคยถูกพิสูจน์ ⇒ ต้องเริ่มนับหนึ่งใหม่ทุกครั้ง
 *    ⇒ และ "ด่านมี 37 ตัว" ถูกอ่านเป็นความมั่นใจ ทั้งที่ส่วนใหญ่ยังไม่เคยถูกทำให้แดง
 *
 * 🔑 ไฟล์นี้เปลี่ยนการพิสูจน์ครั้งเดียวทิ้ง ให้เป็น **ทะเบียนที่รันซ้ำได้**
 *    และ **พิมพ์ความครอบคลุมทุกครั้ง** (พิสูจน์แล้วกี่ตัว จากกี่ตัว)
 *    ⇒ เลขที่ไม่มีขอบเขตกำกับถูกอ่านเป็นยอดรวมเสมอ — กฎเดิมของเรา
 *
 * ✅ **ด่านที่รายงานอย่างเดียว (exit 0 เสมอ) พิสูจน์ได้แล้ว** ตั้งแต่ 19 ก.ย. 2569
 *    ฝั่งท่อเพิ่มผลลัพธ์ที่ห้าให้เครื่องมือร่วม: **`ด่านเห็นแต่ไม่ทำให้ตก`**
 *    (exit 0 แต่ผลเอ่ยถึงของที่ปลูก) ⇒ ใส่ `ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก'` ในสูตร
 *    🔑 **ความรุนแรงเป็นการตัดสินใจ แยกจากการตรวจจับ** — เดิมผมเขียนว่าพิสูจน์ไม่ได้ ซึ่งผิด
 *
 * วิธีใช้: node scripts/ด่านแยกแยะได้ไหม.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { ปลูกแล้ววัด } from './lib/ปลูกแล้ววัด.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
process.chdir(ROOT)

/** สูตรปลูกของแต่ละด่าน — **ต้องปลูกในรูปที่ของจริงเคยเป็น** ไม่ใช่รูปที่พิมพ์ง่าย
 *  (ฝั่งท่อ 19 ก.ย. 2569: ของปลูกที่ไม่เหมือนของจริง = การพิสูจน์ที่ไม่มีค่า) */
const สูตร = [
  {
    ด่าน: 'scripts/check-syntax.mjs',
    ไฟล์: 'netlify/functions/bills-watch.mjs',
    เล่า: 'ข้อความหลายบรรทัดต่อท้ายบรรทัด `//` — รูปเดียวกับบั๊กจริง 19 ก.ย. 2569',
    แก้: (s) => {
      const l = s.split('\n')
      const i = l.findIndex((x) => x.trim().startsWith('//'))
      l[i] = l[i] + 'export default async function zz(a) {\n  const x = ('
      return l.join('\n')
    },
    ยืนยันปลูกลง: (f) => ['node', '--check', f],
    ต้องเอ่ยถึง: 'bills-watch',
  },
  {
    ด่าน: 'scripts/check-sentinel-leftovers.mjs',
    ไฟล์: 'app/core/stock/page.tsx',
    เล่า: 'ของปลูกค้างในรูป **โค้ดที่ทำงาน** (ถ้าปลูกเป็นคอมเมนต์ ด่านต้องเงียบ — ถูกแล้ว)',
    แก้: (s) => s.replace("'use client'", "'use client'\nconst ZZPLANTZZ = 1", 1),
    ต้องเอ่ยถึง: 'stock/page.tsx',
  },
  {
    ด่าน: 'scripts/check-twin-tables.mjs',
    ไฟล์: 'scripts/หมุดที่ต้องยิงจริง.mjs',
    เล่า: 'เอารายการออกหนึ่งตัว ⇒ สองที่ไม่ตรงกัน',
    แก้: (s) => s.replace("'/api/rokid/v1/models', ", '', 1),
    ต้องเอ่ยถึง: 'rokid/v1/models',
  },
  {
    ด่าน: 'scripts/check-claims.mjs',
    ไฟล์: 'app/core/stock/page.tsx',
    เล่า: 'คำถามค้างที่ไม่บอกว่าอะไรจะปิดมันได้ ⇒ ชนเพดาน',
    แก้: (s) => '/* ยังไม่ได้พิสูจน์ ZZPLANTZZ */\n' + s,
    ต้องเอ่ยถึง: 'คำถามค้าง',
  },
  {
    ด่าน: 'scripts/check-floating.mjs',
    ไฟล์: 'app/api/build/route.ts',
    เล่า: '`fetch()` ไม่ await — หนึ่งในสี่ท่าที่ด่านประกาศว่าจับ',
    แก้: (s) => s.replace(/export async function GET\(([^)]*)\)\s*\{/, (m) => m + "\n  fetch('https://example.invalid/zz')"),
    ต้องเอ่ยถึง: 'build/route.ts',
  },
  {
    ด่าน: 'scripts/check-claude-md-numbers.mjs',
    ไฟล์: 'middleware.ts',
    เล่า: 'ด่านรายงานอย่างเดียว (exit 0 โดยเจตนา) — พิสูจน์ได้ด้วยผลลัพธ์ที่ห้า',
    แก้: (s) => s.replace("const PUBLIC_PATHS = [", "const PUBLIC_PATHS = [\n  '/zz-เส้นปลอม',"),
    ต้องมีในไฟล์: "'/zz-เส้นปลอม'",
    /* 🔑 ต้องเป็นรูปที่ **ด่านพิมพ์** ไม่ใช่รูปที่เราปลูก — ด่านพิมพ์จำนวน ไม่ได้พิมพ์ชื่อเส้น */
    ต้องเอ่ยถึง: 'เส้นที่อยู่นอกกำแพงล็อกอิน',
    ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก',
  },
  {
    ด่าน: 'scripts/check-thai-date.mjs',
    ไฟล์: 'components/ui/StatCard.tsx',
    เล่า: 'ตัดเวลาทิ้งก่อนส่งเข้าตัวแปลงวันที่ — รูปที่ไฟล์ด่านเขียนกำกับไว้เองว่าเป็นของจริง',
    แก้: (s) => s + '\nexport const ZZวัน = (x: { at: string }) => thaiDate(String(x.at).slice(0, 10))\n',
    ต้องมีในไฟล์: 'thaiDate(String(x.at).slice(0, 10))',
    ต้องเอ่ยถึง: 'components/ui/StatCard.tsx',
  },
  {
    ด่าน: 'scripts/check-unknown-vs-zero.mjs',
    ไฟล์: 'components/ui/StatCard.tsx',
    เล่า: '"ไม่รู้" ถูกยุบเป็น 0 ที่ชั้นจอ — ด่านนี้นับจุดเทียบเพดาน ปลูกหนึ่งจุดต้องชนเพดาน',
    แก้: (s) => s + '\nexport const ZZยอด = (d: { total?: number }) => Number(d.total) || 0\n',
    ต้องมีในไฟล์: 'Number(d.total) || 0',
    ต้องเอ่ยถึง: 'components/ui/StatCard.tsx',
  },
  {
    ด่าน: 'scripts/check-zort-words.mjs',
    ไฟล์: 'components/ui/OrderCard.tsx',
    เล่า: 'ค่าสถานะดิบของ ZORT ขึ้นจอตรง ๆ — รูปที่ท่านประธานจับได้เองบนจอจริง',
    แก้: (s) => s + '\nexport const ZZสถานะ = (r: { status: string }) => <span>{r.status}</span>\n',
    ต้องมีในไฟล์: '<span>{r.status}</span>',
    ต้องเอ่ยถึง: 'components/ui/OrderCard.tsx',
  },
  {
    ด่าน: 'scripts/check-zero-render.mjs',
    ไฟล์: 'components/ui/StatCard.tsx',
    เล่า: '`{ตัวเลข && <…>}` — ค่าเป็น 0 แล้ว React พิมพ์เลข 0 ลงบนจอ/บนกระดาษ',
    แก้: (s) => s + '\nexport const ZZศูนย์ = (d: { count: number }) => <div>{d.count && <span>ก</span>}</div>\n',
    ต้องมีในไฟล์: '{d.count && <span>ก</span>}',
    ต้องเอ่ยถึง: 'components/ui/StatCard.tsx',
  },
  {
    ด่าน: 'scripts/check-direct-zort.mjs',
    ไฟล์: 'app/core/stock/page.tsx',
    เล่า: 'จอที่ยิง /api/zort ตรง ๆ โดยไม่เขียนบอกคนใช้ว่าจอนี้จะว่างวันเลิกใช้ ZORT',
    แก้: (s) => s.replace("'use client'", "'use client'\nconst ZZเส้น = '/api/zort/zzทดสอบ'\nvoid ZZเส้น", 1),
    ต้องมีในไฟล์: "'/api/zort/zzทดสอบ'",
    ต้องเอ่ยถึง: 'app/core/stock/page.tsx',
  },
  {
    ด่าน: 'scripts/gen-arch.mjs',
    ไฟล์: 'scripts/gen-arch.mjs',
    เล่า: 'รูปแทนที่บรรทัดที่หยุดที่ `]` ตัวแรก ⇒ แทนได้ครึ่งบรรทัด · บั๊กจริง 19 ก.ย. 2569 (บรรทัดงอกถึง 21,427 ตัวอักษร)',
    แก้: (s) => s.replace('/^window\\.ROUTES_NOT_SWEPT = .*$/m', '/window\\.ROUTES_NOT_SWEPT = \\[[^\\]]*\\]/'),
    ต้องมีในไฟล์: 'window\\.ROUTES_NOT_SWEPT = \\[[^\\]]*\\]',
    ต้องเอ่ยถึง: 'อ่านกลับเป็นค่าไม่ได้',
  },
  {
    ด่าน: 'scripts/lib/ตัดคอมเมนต์.mjs',
    ไฟล์: 'scripts/lib/ตัดคอมเมนต์.mjs',
    เล่า: 'ตัวตัดคอมเมนต์เลิกตัดคอมเมนต์บล็อก ⇒ `--self-test` ของตัวเองต้องจับได้',
    แก้: (s) => s.replace('.replace(/\\/\\*[\\s\\S]*?\\*\\//g,', '.replace(/zzไม่มีทางตรง/g,'),
    ต้องมีในไฟล์: '.replace(/zzไม่มีทางตรง/g,',
    ด่านอาร์กิวเมนต์: ['--self-test'],
  },
  {
    ด่าน: 'scripts/check-dead-links.mjs',
    ไฟล์: 'components/ui/PillButton.tsx',
    เล่า: 'ลิงก์ไปหน้าที่ไม่มีอยู่จริง — ต้องเขียนในรูป `href=` ที่ด่านประกาศว่าจับ',
    แก้: (s) => s + '\nexport const ZZLINK = <a href="/zz-หน้าที่ไม่มีอยู่จริง">x</a>\n',
    ต้องมีในไฟล์: 'href="/zz-หน้าที่ไม่มีอยู่จริง"',
    ต้องเอ่ยถึง: 'zz-หน้าที่ไม่มีอยู่จริง',
  },
]

/** ด่านทั้งหมดใน prebuild — ใช้เป็นตัวหารของความครอบคลุม */
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const ทั้งหมด = [...new Set([...(pkg.scripts?.prebuild ?? '').matchAll(/scripts\/[^\s&|]+\.mjs/g)].map((m) => m[0]))]
  .filter((p) => !p.includes('/tests/'))

if (สูตร.length === 0) {
  console.error('🔴 ทะเบียนสูตรว่าง — ไม่ได้พิสูจน์อะไรเลย ⇒ ไม่ผ่าน')
  process.exit(1)
}

let ผ่าน = 0
const ไม่ผ่าน = []
console.log(`พิสูจน์ว่าด่านแยกแยะได้: ${สูตร.length} ด่านในทะเบียน · ด่านใน prebuild ทั้งหมด ${ทั้งหมด.length}`)
for (const x of สูตร) {
  const r = ปลูกแล้ววัด({
    ไฟล์: x.ไฟล์,
    แก้: x.แก้,
    ยืนยันปลูกลง: x.ยืนยันปลูกลง ? x.ยืนยันปลูกลง(x.ไฟล์) : undefined,
    ต้องมีในไฟล์: x.ต้องมีในไฟล์,
    ด่าน: ['node', x.ด่าน, ...(x.ด่านอาร์กิวเมนต์ ?? [])],
    ต้องเอ่ยถึง: x.ต้องเอ่ยถึง,
  })
  const ที่ยอมรับ = x.ยอมรับผล ?? 'ด่านจับได้'
  if (r.ผล === ที่ยอมรับ) { ผ่าน++; console.log(`   ✅ ${x.ด่าน} — ${x.เล่า}${x.ยอมรับผล ? ` (${r.ผล})` : ''}`) }
  else { ไม่ผ่าน.push(`${x.ด่าน}: ${r.ผล} — ${r.รายละเอียด}`); console.error(`   🔴 ${x.ด่าน}: **${r.ผล}** — ${r.รายละเอียด}`) }
}

/* 🔑 ความครอบคลุมต้องพิมพ์ทุกครั้ง ไม่ใช่เฉพาะตอนมีปัญหา */
console.log(`\n📏 พิสูจน์แล้วว่าแยกแยะได้ **${ผ่าน} ด่าน** · ด่านใน prebuild ทั้งหมด **${ทั้งหมด.length}**`)
console.log(`   ⚠️ อีก ${ทั้งหมด.length - ผ่าน} ด่าน **ยังไม่เคยถูกทำให้แดง** ⇒ เขียวของมันแปลว่า "ยังไม่เจอ" ไม่ใช่ "ไม่มี"`)
console.log('   ✅ ด่านที่รายงานอย่างเดียวก็พิสูจน์ได้แล้ว (ผลลัพธ์ "ด่านเห็นแต่ไม่ทำให้ตก")')
if (ไม่ผ่าน.length) process.exit(1)
