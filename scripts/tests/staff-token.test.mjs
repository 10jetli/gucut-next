/* ทดสอบโทเคนพนักงานที่เพิ่มจากหน้าเว็บ — รัน: node scripts/tests/staff-token.test.mjs
 *
 * 🔴 ทำไมต้องมีตัวทดสอบนี้ ทั้งที่ยิงผ่านเบราว์เซอร์/curl ไปแล้ว:
 *    เคสที่ยิงผ่าน HTTP ไม่ได้คือ **โทเคนหมดอายุ** (ต้องแต่งเวลา) และ **กุญแจคนละตัว**
 *    ซึ่งสองข้อนี้คือสิ่งที่กันคนนอกเข้าระบบ ⇒ ต้องมีตัวเฝ้าถาวร ไม่ใช่ทดสอบมือครั้งเดียว
 *
 * ⚠️ ไฟล์ต้นฉบับเป็น .ts (middleware ต้องใช้) node จึง import ตรง ๆ ไม่ได้
 *    ⇒ แปลงด้วย tsc ของโปรเจกต์เองตอนรัน **แล้วทดสอบไฟล์ที่แปลงจากของจริง**
 *       ไม่ใช่เขียนอัลกอริทึมซ้ำในเทส (ถ้าเขียนซ้ำ เทสจะผ่านแม้ของจริงพัง)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'staff-token-'))
execFileSync('npx', ['tsc', 'lib/staff-token.ts', '--outDir', out,
  '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'es2020,dom'],
  { cwd: process.cwd(), stdio: 'inherit' })
/* ไฟล์ที่ tsc แปลงออกมาเป็น ESM — ต้องบอก node ว่าโฟลเดอร์นี้เป็น module
   ไม่งั้นมันอ่าน .js เป็น CommonJS แล้วพังที่คำว่า export (เจอจริงตอนรันครั้งแรก) */
writeFileSync(join(out, 'package.json'), '{"type":"module"}')
const mod = await import(join(out, 'staff-token.js'))
const { signStaffToken, verifyStaffToken, isStaffToken, STAFF_TOKEN_TTL_SEC } = mod

let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

const SECRET = 'รหัสแอดมินสมมุติ-1234'
const NOW = 1_780_000_000
const claims = { u: 'abc123', n: 'สมชาย (คลัง)' }

console.log('① ของดี: เซ็นแล้วตรวจผ่าน และได้ข้อมูลเดิมกลับมา')
const good = await signStaffToken(claims, SECRET, NOW)
{
  const v = await verifyStaffToken(good, SECRET, NOW + 60)
  ok('ตรวจผ่าน', !!v)
  ok('ได้รหัสผู้ใช้กลับมาถูก', v?.u === 'abc123')
  ok('ได้ชื่อกลับมาถูก (ภาษาไทยไม่เพี้ยน)', v?.n === 'สมชาย (คลัง)', v?.n)
  ok('อายุตรงกับที่ตั้งไว้', v?.exp === NOW + STAFF_TOKEN_TTL_SEC)
}

console.log('② แยกจากคุกกี้ท่าเดิมได้ขาด (ของเดิมต้องไม่ถูกแตะ)')
{
  const oldStyle = 'f9fa9dabd915' + 'a'.repeat(52)   // เลขฐานสิบหก 64 ตัว ไม่มีจุด
  ok('คุกกี้ท่าเดิมไม่ถูกนับเป็นโทเคนใหม่', !isStaffToken(oldStyle))
  ok('โทเคนใหม่ถูกนับว่าเป็นของใหม่', isStaffToken(good))
  ok('ตรวจคุกกี้ท่าเดิมด้วยตัวนี้ต้องได้ null (ไม่ใช่ throw)', (await verifyStaffToken(oldStyle, SECRET, NOW)) === null)
}

console.log('③ หมดอายุ ⇒ ไม่ผ่าน (เคสที่ยิงผ่าน HTTP ไม่ได้)')
{
  ok('หลังหมดอายุ 1 วินาที ⇒ ไม่ผ่าน', (await verifyStaffToken(good, SECRET, NOW + STAFF_TOKEN_TTL_SEC + 1)) === null)
  ok('ตรงวินาทีที่หมดอายุ ⇒ ไม่ผ่าน (ขอบเขตต้องปิด)', (await verifyStaffToken(good, SECRET, NOW + STAFF_TOKEN_TTL_SEC)) === null)
  ok('ก่อนหมดอายุ 1 วินาที ⇒ ยังผ่าน', !!(await verifyStaffToken(good, SECRET, NOW + STAFF_TOKEN_TTL_SEC - 1)))
}

console.log('④ กุญแจคนละตัว ⇒ ไม่ผ่าน (เปลี่ยน SITE_PASSWORD = ทุกใบใช้ไม่ได้)')
{
  ok('กุญแจผิด ⇒ ไม่ผ่าน', (await verifyStaffToken(good, SECRET + 'x', NOW + 60)) === null)
  ok('กุญแจว่าง ⇒ ไม่ผ่าน', (await verifyStaffToken(good, '', NOW + 60)) === null)
}

console.log('⑤ แก้โทเคน ⇒ ไม่ผ่าน')
{
  const [head, body, sig] = [good.slice(0, 4), good.slice(4).split('.')[0], good.slice(4).split('.')[1]]
  ok('แก้ลายเซ็นตัวท้าย ⇒ ไม่ผ่าน', (await verifyStaffToken(`${head}${body}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`, SECRET, NOW + 60)) === null)
  /* เคสที่อันตรายที่สุด: เปลี่ยนตัวตนในเนื้อโทเคน (ยกตัวเองเป็นคนอื่น) โดยเก็บลายเซ็นเดิมไว้ */
  const forged = Buffer.from(JSON.stringify({ u: 'ใครก็ไม่รู้', n: 'ปลอม', exp: NOW + 99999 })).toString('base64url')
  ok('เปลี่ยนตัวตนในเนื้อ แต่ใช้ลายเซ็นเดิม ⇒ ไม่ผ่าน', (await verifyStaffToken(`gs1.${forged}.${sig}`, SECRET, NOW + 60)) === null)
  ok('ไม่มีลายเซ็นเลย ⇒ ไม่ผ่าน', (await verifyStaffToken(`gs1.${body}`, SECRET, NOW + 60)) === null)
  ok('ขยะล้วน ⇒ ไม่ผ่าน (ต้องไม่ throw)', (await verifyStaffToken('gs1.!!!.???', SECRET, NOW + 60)) === null)
  ok('ค่าว่าง ⇒ ไม่ผ่าน', (await verifyStaffToken(undefined, SECRET, NOW + 60)) === null)
}

rmSync(out, { recursive: true, force: true })
console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ตก ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
