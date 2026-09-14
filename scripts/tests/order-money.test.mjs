/* ทดสอบสูตรเงินใบขาย — รัน: node scripts/tests/order-money.test.mjs
 *
 * 🔴 **ที่มา (14 ก.ย. 2569)**: ผมเขียนสูตรผิด — **ลบส่วนลดรายบรรทัดซ้ำสองรอบ**
 *    จอฟ้องว่า "ยังเหลือที่อธิบายไม่ได้ 10.80" ทั้งที่ใบถูกต้องทุกบาท
 *    ⚠️ **บั๊กมองไม่เห็นเลยในใบที่ส่วนลดเป็น 0 — ซึ่งคือใบเกือบทั้งหมด**
 *    ⚠️ และ **ท่อปลอมที่ผมเขียนเองก็ตอกย้ำความเข้าใจผิด** เพราะผมแต่งตัวเลขให้เข้ากับสูตรที่ผมเชื่อ
 *       ⇒ **เทสที่สร้างจากความเข้าใจผิดเดียวกับโค้ด จะเขียวเสมอ**
 *    ⇒ เทสนี้จึงยึด **ตัวเลขจากใบจริงบน production** เป็นหลัก ไม่ใช่ตัวเลขที่ผมคิดเอง
 *
 * 🔑 เรียกฟังก์ชันตัวจริงที่จอใช้ (แปลง lib/order-money.ts ด้วย tsc ของโปรเจกต์)
 *    ไม่ได้เลียนแบบตรรกะ — บทเรียนจาก lib/category-net.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-order-money')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/order-money.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { reconcileOrder } = await import(join(out, 'order-money.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }
  const J = (v) => JSON.stringify(v)

  console.log('① 🔴 ใบจริงที่ทุกตัวแปรไม่เป็นศูนย์ — ใบเดียวที่จับบั๊กลบซ้ำได้')
  {
    /* ใบ 1118734271446942 บน production (วัด 14 ก.ย. 2569 18:06 น. เวลาไทย · GET ?order=)
       วัดซ้ำ: เปิด /core/sales แล้วยิง /api/web/core?order=z1/1118734271446942
       ⚠️ ถ้าใบนี้หายไปจากระบบ ให้หาใบใหม่ที่ discount ไม่เป็นศูนย์มาแทน **อย่าลบเคสนี้ทิ้ง** */
    const r = reconcileOrder({
      lines: [{ amount: 169.2, qty: 3, discount: 3.6 }],
      amount: 169.2, billDiscount: 12, shipAmount: 12,
    })
    ok('ลงตัว (169.2 − 12 + 12 = 169.2)', r.state === 'ok', J(r))
    ok('🔴 ไม่ลบส่วนลดรายบรรทัดซ้ำ — expected ต้องเป็น 169.2 ไม่ใช่ 158.4',
      r.expected === 169.2, `expected=${r.expected}`)
    ok('ส่วนลดรายบรรทัดคูณ qty แล้ว (3.6 × 3 = 10.8) และเป็นข้อมูลประกอบ',
      r.lineDiscount === 10.8, `lineDiscount=${r.lineDiscount}`)
  }

  console.log('② ใบจริงที่มีแต่ค่าส่ง (ส่วนลดเป็น 0) — พิสูจน์ได้แค่ว่า "ไม่พัง"')
  {
    // SO-202609021 (วัด 14 ก.ย. 2569 17:46 น.)
    const r = reconcileOrder({ lines: [{ amount: 1092, qty: 52, discount: null }], amount: 1244, billDiscount: 0, shipAmount: 152 })
    ok('ลงตัว (1,092 − 0 + 152 = 1,244)', r.state === 'ok', J(r))
    ok('discount เป็น null ⇒ ยังเทียบยอดได้ (ส่วนลดไม่เข้าสมการ)', r.expected === 1244, J(r))
    ok('รายงานว่าส่วนลดรายบรรทัด "ไม่รู้" ไม่ใช่ 0', r.lineDiscount === null && r.lineDiscountUnknown, J(r))
  }

  console.log('③ สี่สถานะ ห้ามยุบ')
  {
    const noFields = reconcileOrder({ lines: [{ amount: 1000, qty: 1 }], amount: 1070 })
    ok('ท่อไม่ส่งช่องมาเลย ⇒ no-fields (ไม่ใช่ mismatch)', noFields.state === 'no-fields', J(noFields))
    ok('   และบอกส่วนต่างดิบไว้ให้คนดู', noFields.gap === 70, J(noFields))

    const unknown = reconcileOrder({ lines: [{ amount: 1000, qty: 1, discount: null }], amount: 1070, billDiscount: null, shipAmount: null })
    ok('มีช่องแต่ใบนี้เป็น null ⇒ unknown (คนละสาเหตุกับ no-fields)', unknown.state === 'unknown', J(unknown))

    const mismatch = reconcileOrder({ lines: [{ amount: 1000, qty: 1, discount: 0 }], amount: 1125, billDiscount: 50, shipAmount: 70 })
    ok('รู้ครบแต่ไม่ลงตัว ⇒ mismatch + บอกว่าเหลือเท่าไหร่', mismatch.state === 'mismatch' && mismatch.leftover === 105, J(mismatch))

    const good = reconcileOrder({ lines: [{ amount: 1000, qty: 1, discount: 0 }], amount: 1020, billDiscount: 50, shipAmount: 70 })
    ok('รู้ครบและลงตัว ⇒ ok', good.state === 'ok', J(good))
  }

  console.log('④ 🔴 ศูนย์ไม่ใช่ไม่รู้ · ไม่รู้ไม่ใช่ศูนย์')
  {
    const zero = reconcileOrder({ lines: [{ amount: 100, qty: 1, discount: 0 }], amount: 100, billDiscount: 0, shipAmount: 0 })
    ok('ส่วนลด 0 จริง ⇒ lineDiscount = 0 (ไม่ใช่ null)', zero.lineDiscount === 0 && !zero.lineDiscountUnknown, J(zero))
    const mixed = reconcileOrder({ lines: [{ amount: 100, qty: 1, discount: 0 }, { amount: 50, qty: 1, discount: null }], amount: 150, billDiscount: 0, shipAmount: 0 })
    ok('บางบรรทัดไม่รู้ ⇒ ทั้งใบถือว่าไม่รู้ (ห้ามรวมเฉพาะบรรทัดที่รู้แล้วบอกว่าครบ)',
      mixed.lineDiscount === null && mixed.lineDiscountUnknown, J(mixed))
    ok('   แต่ยอดยังเทียบได้ตามปกติ', mixed.state === 'ok', J(mixed))
  }

  console.log('⑤ ปัดเศษสตางค์ — ต่างไม่เกิน 1 สตางค์ถือว่าลงตัว')
  {
    const r = reconcileOrder({ lines: [{ amount: 33.33, qty: 1 }, { amount: 33.33, qty: 1 }, { amount: 33.34, qty: 1 }], amount: 100, billDiscount: 0, shipAmount: 0 })
    ok('100.00 พอดี ⇒ ok', r.state === 'ok', J(r))
    const off = reconcileOrder({ lines: [{ amount: 100, qty: 1 }], amount: 100.5, billDiscount: 0, shipAmount: 0 })
    ok('ต่าง 50 สตางค์ ⇒ mismatch (ไม่ใช่ปัดเศษ)', off.state === 'mismatch', J(off))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
