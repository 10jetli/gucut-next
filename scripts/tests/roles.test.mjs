/* ทดสอบชั้นสิทธิ์ 3 ชั้น — รัน: node scripts/tests/roles.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทสนี้**: การเพิ่มชั้นสิทธิ์คือการแตะด่านเข้าเว็บทั้งเว็บ
 *    พลาดข้างหนึ่ง = คนนอกเข้าได้ · พลาดอีกข้าง = พนักงานเข้าไม่ได้เลยทั้งกะ
 *    และ **ทั้งสองแบบ tsc กับ build จับไม่ได้เลย** เพราะไม่มีอะไรผิดทางไวยากรณ์
 *
 * ⚠️ เทสนี้เรียก `roleOf` + `signStaffToken` + `verifyStaffToken` **ตัวจริง**
 *    ส่วนกติกาเส้นทางคัดลอกมาจาก middleware.ts (เป็น .ts ที่ import next/server ⇒ เรียกตรงไม่ได้)
 *    🔴 **แก้รายชื่อเส้นทางใน middleware แล้วต้องมาแก้ที่นี่ด้วย** — เขียนไว้เตือนตรงนี้เลย
 *       เพราะโปรเจกต์นี้เจ็บมาแล้วกับเทสที่เลียนแบบตรรกะแล้วเขียวทั้งที่ของจริงพัง
 *       (ที่ยอมคัดลอกเฉพาะ "รายชื่อเส้นทาง" เพราะมันคือข้อมูล ไม่ใช่ตรรกะ — ตรรกะเรียกตัวจริง)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-roles')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/staff-token.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { signStaffToken, verifyStaffToken, roleOf, isStaffToken } = await import(join(out, 'staff-token.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }

  /* ── รายชื่อเส้นทาง: อ่านจาก middleware.ts ของจริง ไม่พิมพ์ซ้ำ ───────────────
     ถ้ามีคนแก้รายชื่อในนั้น เทสนี้จะใช้ของใหม่ทันที (และถ้าอ่านไม่เจอ = แดง ไม่ใช่ผ่าน) */
  const mw = readFileSync('middleware.ts', 'utf8')
  const listOf = (name) => {
    const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`).exec(mw)
    if (!m) throw new Error(`อ่าน ${name} จาก middleware.ts ไม่ได้ — รายชื่อเส้นทางเปลี่ยนรูปแบบ?`)
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  const STAFF = listOf('STAFF_ALLOWED_PREFIXES')
  const ACCOUNT = listOf('ACCOUNT_ALLOWED_PREFIXES')
  const allowedBy = (list, p) => list.some((x) => p === x || p.startsWith(x))

  const SECRET = 'ทดสอบ-รหัสแอดมิน-1234'

  console.log('① โทเคนเก่าที่ไม่มีช่องบทบาท = พนักงาน (เข้ากันได้ย้อนหลัง)')
  {
    const t = await signStaffToken({ u: 'u1', n: 'พนักงานเก่า' }, SECRET)
    const c = await verifyStaffToken(t, SECRET)
    ok('ตรวจลายเซ็นผ่าน', !!c, String(c))
    ok('🔴 ไม่มี r ⇒ staff **ห้ามเป็น account**', roleOf(c) === 'staff', roleOf(c))
    ok('คุกกี้ถูกจัดว่าเป็นโทเคนแบบใหม่', isStaffToken(t))
  }

  console.log('② โทเคนที่ระบุบัญชี')
  {
    const t = await signStaffToken({ u: 'u2', n: 'ฝ่ายบัญชี', r: 'account' }, SECRET)
    ok('อ่านชั้นสิทธิ์ได้ถูก', roleOf(await verifyStaffToken(t, SECRET)) === 'account')
  }

  console.log('③ 🔴 ค่าบทบาทที่ไม่รู้จัก ต้องตกเป็นพนักงาน ไม่ใช่ยกระดับ')
  {
    for (const bad of ['admin', 'ADMIN', 'Account', '', 'boss', 1, true, null]) {
      const t = await signStaffToken({ u: 'u3', n: 'ทดสอบ', r: bad }, SECRET)
      const got = roleOf(await verifyStaffToken(t, SECRET))
      ok(`r=${JSON.stringify(bad)} ⇒ staff`, got === 'staff', got)
    }
  }

  console.log('④ 🔴 โทเคนที่ถูกแก้/เซ็นด้วยกุญแจอื่น ต้องใช้ไม่ได้เลย')
  {
    const t = await signStaffToken({ u: 'u4', n: 'ปลอม', r: 'account' }, 'กุญแจอื่น')
    ok('เซ็นด้วยกุญแจอื่น ⇒ ไม่ผ่าน', (await verifyStaffToken(t, SECRET)) === null)
    const real = await signStaffToken({ u: 'u5', n: 'จริง' }, SECRET)
    const tampered = real.replace(/\.[^.]+$/, '.AAAA')
    ok('แก้ลายเซ็น ⇒ ไม่ผ่าน', (await verifyStaffToken(tampered, SECRET)) === null)
    ok('🔴 ตรวจไม่ผ่าน ⇒ roleOf(null) = staff (ไม่ใช่ account)', roleOf(null) === 'staff')
    const expired = await signStaffToken({ u: 'u6', n: 'หมดอายุ', r: 'account' }, SECRET, 1)
    ok('หมดอายุ ⇒ ไม่ผ่าน', (await verifyStaffToken(expired, SECRET)) === null)
  }

  console.log('⑤ เส้นทางของชั้นบัญชี — เห็นการเงิน ไม่เห็นของคนอื่น')
  {
    const yes = ['/core/finance', '/core/wallet', '/core/other-income', '/bills', '/core/settings-profile']
    const no = ['/core/sales', '/core/stock', '/core/settings-users', '/core/settings-roles', '/core/pos', '/catalog']
    for (const p of yes) ok(`เข้าได้: ${p}`, allowedBy(ACCOUNT, p))
    for (const p of no) ok(`🔴 เข้าไม่ได้: ${p}`, !allowedBy(ACCOUNT, p))
  }

  console.log('⑥ 🔴 ชั้นบัญชีต้องไม่ได้สิทธิ์ของพนักงาน และกลับกัน')
  {
    ok('บัญชีเข้าหน้าโอนสินค้าไม่ได้', !allowedBy(ACCOUNT, '/catalog/index.html'))
    ok('พนักงานเข้าหน้าการเงินไม่ได้', !allowedBy(STAFF, '/core/finance'))
    ok('พนักงานยังเข้าหน้าโอนสินค้าได้เหมือนเดิม', allowedBy(STAFF, '/catalog/index.html'))
    ok('พนักงานยังเข้าจอรับคืนได้เหมือนเดิม', allowedBy(STAFF, '/returns/receive'))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
