/* 📚 **ทะเบียนสูตรปลูก — ข้อมูลล้วน ไม่มีผลข้างเคียง**
 * (แยกออกมา 20 ก.ย. 2569 · ฝั่งท่อเตือนข้อนี้ตรง ๆ: อย่าให้ตัวรันทะเบียน `process.exit()`
 *  ตอนถูก import เพราะมัน **ฆ่าโปรเซสของผู้ที่ import ทั้งตัว**
 *  ⇒ ท่าที่ถูกคือ **แยกข้อมูลออกจากผลข้างเคียง** แล้วให้ผู้ใช้เป็นคนตัดสินใจเอง)
 *
 * 🔑 ใครใช้ไฟล์นี้บ้าง (ตามกติกา "เปลี่ยนของร่วมต้องบอกว่าใครอ่านอยู่"):
 *   · `scripts/ด่านแยกแยะได้ไหม.mjs` — ปลูกจริงแล้ววัดด่าน (ช้า · แก้ไฟล์ชั่วคราว · ไม่อยู่ใน prebuild)
 *   · `scripts/check-plant-formulas.mjs` — ตรวจว่าสูตรยัง "ปลูกลง" ไหม (เร็ว · ไม่แก้ไฟล์ · อยู่ใน prebuild)
 */
export const สูตร = [
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
    /* ⚠️ **สูตรนี้หมดอายุไปหนึ่งรอบ** (20 ก.ย. 2569) — ผมเขียน lib ใหม่เป็นตัวเดินอักษร
       ⇒ ข้อความ `.replace(/…/g,` ที่สูตรเดิมจะแทน **ไม่มีในไฟล์อีกแล้ว** ⇒ ทะเบียนตอบ "ปลูกไม่ลง"
       ⇒ 🔑 **ทะเบียนจับสูตรที่หมดอายุได้เอง** เพราะมันยืนยันว่าปลูกลงก่อนตัดสินด่าน
          (ถ้ามันเชื่อว่า replace สำเร็จ ผลจะกลายเป็น "ด่านเขียว" แล้วผมจะโทษด่านผิด) */
    เล่า: 'ตัวเดินอักษรเลิกรู้จักสตริง ⇒ `--self-test` ของตัวเองต้องจับได้ (2 กรณีที่เพิ่งเพิ่ม)',
    แก้: (s) => s.replace("if (c === '\"' || c === \"'\" || c === '`') {", "if (false) {"),
    ต้องมีในไฟล์: 'if (false) {',
    ด่านอาร์กิวเมนต์: ['--self-test'],
  },
  {
    ด่าน: 'scripts/check-stale-state-load.mjs',
    ไฟล์: 'app/core/stock/page.tsx',
    เล่า: '`setQ(w)` แล้ว `load(0)` ในจังหวะเดียวกัน ⇒ ยิงด้วยคำค้นเดิม — บั๊กที่กัดโปรเจกต์นี้ 3 ครั้ง',
    แก้: (s) => s.replace("'use client'", "'use client'\nconst zzยิง = (w) => { setQ(w); load(0) }\nvoid zzยิง", 1),
    ต้องมีในไฟล์: 'setQ(w); load(0)',
    ต้องเอ่ยถึง: 'app/core/stock/page.tsx',
  },
  {
    ด่าน: 'scripts/check-nested-input-component.mjs',
    ไฟล์: 'components/ui/OrderCard.tsx',
    เล่า: 'ประกาศคอมโพเนนต์ไว้ในตัวคอมโพเนนต์อื่น ⇒ React สร้างชนิดใหม่ทุกครั้งที่เรนเดอร์ ⇒ ช่องกรอกเด้ง',
    แก้: (s) => s + '\nexport function ZZNok() {\n  const ZZBox = () => (<input />)\n  return <div><ZZBox /></div>\n}\n',
    ต้องมีในไฟล์: '  const ZZBox = () => (<input />)',
    ต้องเอ่ยถึง: 'ZZBox',
  },
  {
    ด่าน: 'scripts/check-nested-input-component.mjs',
    ไฟล์: 'components/ui/OrderCard.tsx',
    เล่า: 'ชื่อผสม ASCII+ไทย (`ZZใน`) — รูปที่ด่านนี้เคยมองไม่เห็นทั้งหมด อุดแล้ว 20 ก.ย. 2569',
    แก้: (s) => s + '\nexport function ZZนอก2() {\n  const ZZใน = () => (<input />)\n  return <div><ZZใน /></div>\n}\n',
    ต้องมีในไฟล์: '  const ZZใน = () => (<input />)',
    ต้องเอ่ยถึง: 'ZZใน',
  },
  {
    ด่าน: 'scripts/check-store-echo.mjs',
    ไฟล์: 'app/core/return-orders/page.tsx',
    เล่า: 'ถอด props ของ <StoreEcho> ทิ้ง = จอเลิกเทียบว่าท่อใช้ร้านไหนจริง — ทางปลอมชั้น ② ที่ด่านประกาศว่าปิดแล้ว',
    แก้: (s) => s.replace(/<StoreEcho[^>]*>/, '<StoreEcho />'),
    ต้องมีในไฟล์: '<StoreEcho />',
    ต้องเอ่ยถึง: 'app/core/return-orders/page.tsx',
  },
  {
    ด่าน: 'scripts/check-secret-routes.mjs',
    ไฟล์: 'app/api/ads/route.ts',
    /* ⚠️ เป้าต้องเป็นเส้นที่ **ไม่มีป้าย `ไม่เปิดสาธารณะโดยตั้งใจ:`** — รอบแรกผมปลูกใส่ `bills/fixmonth`
       ซึ่งมีป้ายนั้นอยู่แล้ว ⇒ ด่านข้ามโดยชอบธรรม ⇒ เครื่องมือตอบ "ด่านจับไม่ได้" ซึ่ง **ด่านถูก ผมผิด** */
    เล่า: 'เส้นตรวจ DRIVESYNC_SECRET เอง แต่ไม่อยู่ใน PUBLIC_PATHS ⇒ คนมี secret ได้ 401 จากด่านล็อกอิน (เกิดจริง 2 ครั้ง)',
    แก้: (s) => s + '\nexport const zzลับ = process.env.DRIVESYNC_SECRET\n',
    ต้องมีในไฟล์: 'process.env.DRIVESYNC_SECRET',
    ต้องเอ่ยถึง: '/api/ads',
  },
  {
    ด่าน: 'scripts/check-applied-used.mjs',
    ไฟล์: 'app/core/categories/page.tsx',
    เล่า: 'จอประกาศรู้จักช่อง `applied` แต่ไม่เคยเอามาเทียบ ⇒ ท่อเมินเงื่อนไขแล้วจอไม่รู้',
    แก้: (s) => s + '\ntype ZZตอบ = { applied?: { q?: string } }\nexport const zzชนิด: ZZตอบ | null = null\n',
    ต้องมีในไฟล์: 'applied?: { q?: string }',
    ต้องเอ่ยถึง: 'app/core/categories/page.tsx',
  },
  {
    ด่าน: 'scripts/check-honesty.mjs',
    ไฟล์: 'app/core/categories/page.tsx',
    เล่า: 'กลืน error เงียบ ๆ ⇒ จอโชว์ว่างเปล่าแทนที่จะบอกว่าดึงไม่ได้ · ด่านนี้ **รายงานอย่างเดียว** (ไม่มี process.exit)',
    แก้: (s) => s + '\nexport const zzกลืน = () => fetch(\'/api/zzทดสอบ\').catch(() => {})\n',
    ต้องมีในไฟล์: ".catch(() => {})",
    ต้องเอ่ยถึง: 'app/core/categories/page.tsx',
    ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก',
  },
  {
    ด่าน: 'scripts/check-gate-source.mjs',
    ไฟล์: 'components/ui/OrderCard.tsx',
    เล่า: 'การ์ดที่ใช้ค่าชุดหนึ่ง แต่ถูกประตูชั้นนอกของอีกชุดคุมชีวิต ⇒ ของหายจากจอโดยไม่มีสาเหตุ',
    /* ⚠️ ตัวนี้ **ไม่อยู่ในลูกโซ่ prebuild โดยเจตนา** (มันร้องใส่ของปกติ 13 จุด)
       และ **exit 0 เสมอ** ⇒ พิสูจน์ได้ด้วยผลลัพธ์ที่ห้าเท่านั้น
       🔑 **ประตูชั้นนอกต้องอ่านช่องของก้อน (`x.y`) ไม่ใช่ชื่อเปล่า** — ด่านตั้งเงื่อนไขนี้ไว้เอง
          เพื่อไม่ให้ร้องใส่ธงจอ (`truncated` · `showForm`) ⇒ รอบแรกผมปลูก `{zzOut && (`
          ซึ่งเป็นชื่อเปล่า ⇒ **ปลูกนอกขอบเขต ด่านถูก ผมผิด** (ครั้งที่ 4 ของคลาสนี้คืนนี้) */
    แก้: (s) => s + [
      '',
      'export function ZZGate({ zzData, zzIn }: any) {',
      '  return (',
      '    <div>',
      '      {zzData.ok && (',
      '        <div>',
      '          <span>บรรทัดหนึ่ง</span>',
      '          <span>บรรทัดสอง</span>',
      '          <span>บรรทัดสาม</span>',
      '          {zzIn && (',
      '            <div>',
      '              <span>ก หนึ่ง</span>',
      '              <span>ก สอง</span>',
      '              <span>ก สาม</span>',
      '              <span>ก สี่</span>',
      '            </div>',
      '          )}',
      '        </div>',
      '      )}',
      '    </div>',
      '  )',
      '}',
      '',
    ].join('\n'),
    ต้องมีในไฟล์: '{zzIn && (',
    ต้องเอ่ยถึง: 'zzIn',
    ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก',
  },
  {
    ด่าน: 'scripts/check-nav.mjs',
    ไฟล์: 'lib/nav-config.ts',
    เล่า: 'เมนูชี้ไปหน้าที่ไม่มีอยู่จริง ⇒ คนกดแล้วเจอ 404 — เมนูอยู่ที่นี่ที่เดียวตามกติกาโปรเจกต์',
    แก้: (s) => s.replace("const TRANSFER: NavItem = {", "const ZZเมนู: NavItem = { href: '/core/zz-ไม่มีหน้านี้จริง', icon: '🧪', label: 'ทดสอบ' }\nvoid ZZเมนู\nconst TRANSFER: NavItem = {", 1),
    ต้องมีในไฟล์: "href: '/core/zz-ไม่มีหน้านี้จริง'",
    ต้องเอ่ยถึง: 'zz-ไม่มีหน้านี้จริง',
  },
  {
    ด่าน: 'scripts/check-ready-badge.mjs',
    ไฟล์: 'lib/zort-ready.ts',
    เล่า: 'บรรทัดทะเบียนถูกคอมเมนต์ทิ้ง — รูปที่ด่านนี้เคยปล่อยผ่าน จนต้องเพิ่มการตัดคอมเมนต์ก่อนอ่าน',
    /* ⚠️ เป้าต้องเป็นคีย์ที่ **`เปิด: true` ใน lib/real-send.ts** — ด่านนี้วนเฉพาะจอที่ส่งของจริงอยู่
       รอบแรกผมปลูกที่ `/core/reports` ซึ่งไม่ใช่จอส่งจริง ⇒ ด่านเงียบโดยชอบธรรม
       ⇒ **ปลูกนอกขอบเขต ด่านถูก ผมผิด** (ครั้งที่ 5 ของคลาสนี้คืนนี้) */
    แก้: (s) => s.replace(/^(\s*)('\/core\/quotations\/new':)/m, '$1// $2'),
    ต้องมีในไฟล์: "// '/core/quotations/new':",
    ต้องเอ่ยถึง: 'quotations/new',
  },
  {
    ด่าน: 'scripts/check-link-params.mjs',
    /* ⚠️ ด่านนี้กวาดเฉพาะ `app/` — รอบแรกผมปลูกที่ `components/` ⇒ นอกขอบเขต (ครั้งที่ 6) */
    ไฟล์: 'app/core/categories/page.tsx',
    เล่า: 'ลิงก์ส่งพารามิเตอร์ที่ปลายทางไม่เคยอ่าน ⇒ คนกดแล้วจอปลายทางไม่กรองอะไรเลย · ใช้รูป `href="…"` ธรรมดา ซึ่งเป็นรูปที่ตะแกรงเดิมมองไม่เห็น',
    แก้: (s) => s + '\nexport const ZZลิงก์ = <a href="/core/stock?zzkey=1">x</a>\n',
    ต้องมีในไฟล์: 'href="/core/stock?zzkey=1"',
    ต้องเอ่ยถึง: 'zzkey',
  },
  {
    ด่าน: 'scripts/check-bill-collector-claims.mjs',
    ไฟล์: 'lib/vendors.ts',
    เล่า: 'ทะเบียนอ้างว่ามีปัญหา แต่ของจริงในล็อกคือ OK ⇒ คำกล่าวอ้างที่พิมพ์มือกับของจริงคนละเรื่อง',
    /* ⚠️ ด่านนี้ **รายงานอย่างเดียว** (exit 0 โดยเจตนา — คนที่ build อยู่แก้ล็อกของ g1 ไม่ได้)
       และมันร้องอยู่แล้ว 2 เจ้า (meta · line ที่ AUTH_REQUIRED จริง)
       ⇒ จึงต้องปลูกที่เจ้าที่ **ตอนนี้ตรงกัน** (adobe) แล้วใช้ชื่อเจ้านั้นเป็นตัวแยก */
    แก้: (s) => s.replace(
      "{ id: 'adobe', collect: { วิธี: 'สคริปต์บน g1', รายละเอียด: 'adobe-bills.py · ยืมเซสชันเบราว์เซอร์'",
      "{ id: 'adobe', collect: { ปัญหา: 'zz อ้างว่าพัง', วิธี: 'สคริปต์บน g1', รายละเอียด: 'adobe-bills.py · ยืมเซสชันเบราว์เซอร์'"),
    ต้องมีในไฟล์: "ปัญหา: 'zz อ้างว่าพัง'",
    ต้องเอ่ยถึง: 'adobe',
    ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก',
  },
  {
    ด่าน: 'scripts/เส้นที่ไม่มีใครเรียก.mjs',
    ไฟล์: 'app/ai-visibility/page.tsx',
    เล่า: 'ตัดผู้เรียกทั้งหมดของเส้นหนึ่งออก ⇒ เส้นนั้นต้องโผล่ในรายการ "ต้องไล่ดู"',
    /* ⚠️ ด่านนี้ **รายงานอย่างเดียว** (ไม่มี exit 1) ⇒ ใช้ผลลัพธ์ที่ห้า
       และมันตัดคอมเมนต์ก่อนกวาด ⇒ **เปลี่ยนการเรียกให้เป็นเส้นอื่น** แทนการคอมเมนต์ทิ้ง
       (คอมเมนต์ทิ้งก็ได้ผลเหมือนกัน แต่การเปลี่ยนพาธพิสูจน์ได้ว่ามันดูที่ "ข้อความของเส้น" จริง) */
    แก้: (s) => s.split("'/api/ai-visibility'").join("'/api/zz-เส้นปลอมสำหรับทดสอบ'"),
    ต้องมีในไฟล์: "'/api/zz-เส้นปลอมสำหรับทดสอบ'",
    ต้องเอ่ยถึง: '/api/ai-visibility',
    ยอมรับผล: 'ด่านเห็นแต่ไม่ทำให้ตก',
  },
  {
    ด่าน: 'scripts/check-plant-formulas.mjs',
    ไฟล์: 'scripts/lib/ทะเบียนด่าน.mjs',
    เล่า: 'สูตรในทะเบียนหมดอายุ (ข้อความเป้าหมายไม่มีในไฟล์แล้ว) ⇒ ด่านต้องจับได้ก่อน build',
    /* ⚠️ สูตรนี้ปลูกลง **ไฟล์ทะเบียนเอง** — ทำได้เพราะโมดูลถูกโหลดเข้าหน่วยความจำไปแล้ว
       ตอนที่ตัวรันเริ่ม ⇒ การแก้ไฟล์ระหว่างทางไม่กระทบสูตรที่กำลังใช้อยู่
       และ `ปลูกแล้ววัด` คืนไฟล์ให้ใน finally พร้อมบังคับว่าไฟล์ต้องสะอาดใน git ก่อน */
    แก้: (s) => s.replace(
      "s.replace(\"'use client'\", \"'use client'\\nconst ZZPLANTZZ = 1\", 1)",
      "s.replace('zzข้อความที่ไม่มีอยู่จริงในไฟล์', 'x', 1)"),
    ต้องมีในไฟล์: "'zzข้อความที่ไม่มีอยู่จริงในไฟล์'",
    ต้องเอ่ยถึง: 'ปลูกไม่ลง',
  },
  {
    ด่าน: 'scripts/check-pipe-keys.mjs',
    ไฟล์: 'app/core/branches/page.tsx',
    เล่า: 'จอประกาศชื่อช่องที่ท่อไม่เคยส่ง ⇒ จออ่านได้ undefined ตลอดกาลโดยไม่มีอะไรฟ้อง',
    /* ⚠️ เป้าต้องเป็นจอที่ **คุยกับท่อจริง** (มี `/api/web/core` หรือ `coreJson`)
       และชื่อช่องต้อง **ยาวอย่างน้อย 4 ตัวอักษร** ตามที่ด่านกำหนดเอง (ชื่อสั้นเสี่ยงชนคำอื่น) */
    แก้: (s) => s.replace('interface ', 'interface ZZPipe { zzFieldNotInPipe?: string }\ninterface ', 1),
    ต้องมีในไฟล์: 'zzFieldNotInPipe?: string',
    ต้องเอ่ยถึง: 'zzFieldNotInPipe',
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
