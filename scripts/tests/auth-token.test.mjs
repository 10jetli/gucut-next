#!/usr/bin/env node
/* คุกกี้ล็อกอิน (`lib/auth-token.ts`) — **ไฟล์เล็กที่สุดที่พลาดแล้วเสียหายมากที่สุด**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) 48 บรรทัด ไม่มีเทสและไม่มีด่านแตะเลย
 * ถูกเรียกจาก **middleware** ⇒ ทุกคำขอของทั้งเว็บเดินผ่านมันหมด
 *
 * 🔴 ที่มาของไฟล์นี้: ของเดิมเก็บ **ตัวรหัสผ่านเอง** ลงคุกกี้ และ middleware เทียบ
 *    "คุกกี้ == รหัสผ่าน" ทุกคำขอ ⇒ คนยิงเดาไม่ต้องผ่านหน้าล็อกอินเลย ตั้งคุกกี้แล้วขอหน้าไหนก็ได้
 *    ⇒ ตัวกันเดารหัสที่อยู่เฉพาะหน้าล็อกอิน **กันได้แค่ประตูเดียวจากสองประตู**
 *
 * 🔑 สองสิ่งที่ต้องจริงเสมอ และเทสนี้ตรึงไว้:
 *    ① คุกกี้ต้อง **ไม่มีเงาของรหัสอยู่ข้างใน** (ไม่ใช่รหัส · ไม่มีรหัสเป็นส่วนย่อย)
 *    ② การเทียบต้องใช้เวลาเท่ากันเสมอ — ห้าม return กลางทาง (return เร็ว = บอกว่าเดาถูกไปกี่ตัว)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `auth-token-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/auth-token.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  const { authToken, sameToken } = await import(join(out, 'auth-token.js'))

  console.log('① คุกกี้ต้องไม่มีเงาของรหัสผ่านอยู่ข้างใน')
  {
    const รหัส = 'รหัสจริงของร้าน-2569'
    const t = await authToken(รหัส)
    ok('ไม่ใช่ตัวรหัสเอง', t !== รหัส, t.slice(0, 40))
    ok('ไม่มีรหัสเป็นส่วนย่อยของคุกกี้', !t.includes(รหัส))
    ok('เป็นเลขฐานสิบหก 64 ตัว (SHA-256)', /^[0-9a-f]{64}$/.test(t), t.slice(0, 70))
  }

  console.log('② รหัสต่างกันต้องได้คุกกี้ต่างกัน · รหัสเดียวกันต้องได้เท่าเดิมทุกครั้ง')
  {
    const a = await authToken('abc')
    const b = await authToken('abd')
    const a2 = await authToken('abc')
    ok('ต่างกันแม้ต่างตัวอักษรเดียว', a !== b)
    ok('เรียกซ้ำได้ค่าเดิม (ไม่งั้นคุกกี้ใช้ไม่ได้ข้ามคำขอ)', a === a2)
    ok('รหัสว่างก็ยังได้ค่า (ไม่พัง)', /^[0-9a-f]{64}$/.test(await authToken('')))
  }

  console.log('③ 🔴 ตัวคั่นประจำระบบต้องมีผลจริง — ไม่ใช่ SHA-256 ของรหัสเปล่า ๆ')
  {
    /* ถ้าไม่มีตัวคั่น คุกกี้จะเท่ากับ SHA-256(รหัส) ซึ่งเป็นค่าที่ไปหาในตารางสำเร็จรูปได้
       ⇒ คำนวณ SHA-256 ของรหัสเปล่าเองแล้วยืนยันว่า **ไม่ตรงกัน** */
    const รหัส = 'ทดสอบตัวคั่น'
    const เปล่า = Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(รหัส)),
    )).map((b) => b.toString(16).padStart(2, '0')).join('')
    ok('คุกกี้ ≠ SHA-256 ของรหัสเปล่า', (await authToken(รหัส)) !== เปล่า,
      'ไม่มีตัวคั่น ⇒ ค่าเดียวกับตารางสำเร็จรูปที่หาได้ทั่วไป')
  }

  console.log('④ การเทียบ — ต้องปฏิเสธทุกกรณีที่ไม่ตรงเป๊ะ')
  {
    const t = await authToken('รหัส')
    ok('ตรงกันเป๊ะ ⇒ true', sameToken(t, t))
    /* ⚠️ รุ่นแรกผมเขียน `ok('...', sameToken(...))` = ยืนยันว่าผลเป็น **จริง**
       ซึ่งกลับด้านกับสิ่งที่ตั้งใจตรวจ ⇒ เทสแดงทั้งที่โค้ดถูก (คำยืนยันกลับหัว) */
    ok('ต่างกัน ⇒ false', sameToken(t, await authToken('รหัสอื่น')) === false)
    ok('undefined ทั้งคู่ ⇒ false (ไม่ใช่ "ว่างเท่ากับว่าง")', sameToken(undefined, undefined) === false)
    ok('ฝั่งเดียวว่าง ⇒ false', sameToken(t, undefined) === false && sameToken(undefined, t) === false)
    ok('สตริงว่างสองอัน ⇒ false', sameToken('', '') === false)
    ok('ความยาวต่างกัน ⇒ false', sameToken(t, t.slice(0, 63)) === false)
    ok('ต่างแค่ตัวสุดท้าย ⇒ false', sameToken(t, t.slice(0, 63) + (t.endsWith('a') ? 'b' : 'a')) === false)
  }

  console.log('⑤ ⚠️ "เวลาเท่ากันเสมอ" วัดด้วยนาฬิกาไม่ได้ — ตรวจที่รูปของโค้ดแทน พร้อมเหตุผล')
  {
    /* จับเวลาในเครื่องนี้ให้ผลกวัดแกว่งกว่าความต่างที่ต้องการวัดหลายเท่า (GC · ตัวแปลโค้ด · โหลดเครื่อง)
       ⇒ เขียนเทสจับเวลา = ได้ด่านที่แดงสุ่ม ๆ แล้วคนจะปิดมันทิ้ง
       ⇒ ตรวจสิ่งที่ตรวจได้แน่นอน: **ไม่มี return กลางลูป** (return เร็ว = บอกว่าเดาถูกไปกี่ตัว) */
    const ซอร์ส = readFileSync('lib/auth-token.ts', 'utf8')
    const ตัวเทียบ = ซอร์ส.slice(ซอร์ส.indexOf('export function sameToken'))
    /* ⚠️ ต้องตัดเฉพาะ **บรรทัดของลูป** — รุ่นแรกผมเอาบรรทัดถัดไปมาด้วย
       แล้วไปเจอ `return diff === 0` ซึ่งเป็น return ที่ถูกต้องของฟังก์ชัน ⇒ แดงลวง */
    const บรรทัดลูป = ตัวเทียบ.slice(ตัวเทียบ.indexOf('for (')).split('\n')[0]
    ok('ในลูปเทียบไม่มี return/break (ไม่ลัดวงจร)', !/\breturn\b|\bbreak\b/.test(บรรทัดลูป),
      `ลัดวงจรเมื่อเจอตัวแรกที่ต่าง ⇒ เวลาตอบบอกว่าเดาถูกไปกี่ตัว · บรรทัด: ${บรรทัดลูป.trim().slice(0, 80)}`)
    ok('สะสมความต่างด้วยตัวดำเนินการระดับบิต', /diff \|= /.test(ตัวเทียบ), 'ต้องสะสมทุกตัว ไม่ใช่เทียบทีละตัวแล้วออก')
  }

  console.log('⑥ ห้าม import node:crypto — ไฟล์นี้รันบน edge (เผลอ import = ทั้งเว็บ 500)')
  {
    const ซอร์ส = readFileSync('lib/auth-token.ts', 'utf8')
    const โค้ด = ซอร์ส.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    ok('ไม่มี import node:crypto/crypto ในโค้ดจริง', !/from ['"](node:)?crypto['"]/.test(โค้ด),
      'เจอแล้ว = ทั้งเว็บ 500 ตั้งแต่คำขอแรก (middleware รันบน edge runtime)')
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
