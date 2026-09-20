#!/usr/bin/env node
/* เทสของ `scripts/check-secret-routes.mjs` — **อยู่คนละไฟล์กับด่านโดยตั้งใจ**
 *
 * 🔴 เหตุผล (วัดได้วันนี้ 20 ก.ย. 2569):
 *    ด่านนี้มี `--self-test` อยู่ **ในไฟล์เดียวกับตัวมันเอง**
 *    ⇒ ถ้าใครย้อนไฟล์กลับเป็นรุ่นก่อนแก้ **self-test ก็ย้อนตามไปด้วย** ⇒ ผ่านฉลุย
 *    ⇒ ⇒ มันเป็น **ตัวตรวจความสอดคล้องภายใน ไม่ใช่ตัวเฝ้าเจตนา** (คำของฝั่งท่อ)
 *       และทั้งสองอย่าง **ให้ผลเขียวเหมือนกันเป๊ะ** ⇒ แยกได้จาก **ที่อยู่ของไฟล์** เท่านั้น
 *
 * 🔑 ทำไมด่านตัวนี้ขึ้นคิวแรกจาก 9 ตัวที่ยังเปิดอยู่:
 *    เกณฑ์ **"ถ้าตัวนี้พังเงียบ จะมีงานอะไรที่ไม่ได้ทำ"** ⇒ ตัวนี้เฝ้า **เส้นที่ข้ามกำแพงล็อกอิน**
 *    · พังทิศหนึ่ง ⇒ เส้นที่ต้องอยู่ใน `PUBLIC_PATHS` หลุด ⇒ **คนมี secret ยิงแล้วได้ 401**
 *      (เกิดจริงสองครั้ง: 8 ก.ย. · 17 ก.ย. 2569)
 *    · พังอีกทิศ ⇒ **นับคอมเมนต์เป็นโค้ด** ⇒ ด่านสั่งให้เอาเส้นที่ไม่ได้ตรวจ secret
 *      ไปใส่ `PUBLIC_PATHS` ⇒ ⇒ **เปิดเส้นออกจากกำแพงล็อกอินเพราะคอมเมนต์**
 *      ⇒ ทิศนี้อันตรายกว่า เพราะผลคือ "เปิดประตู" ไม่ใช่ "ประตูไม่เปิด"
 */
import { ตรวจ, เส้นที่ใช้secret } from '../check-secret-routes.mjs'

let ตก = 0
const ต้อง = (ชื่อ, เงื่อนไข, รายละเอียด = '') => {
  if (เงื่อนไข) console.log(`✅ ${ชื่อ}`)
  else { ตก++; console.error(`🔴 ${ชื่อ}${รายละเอียด ? ' — ' + รายละเอียด : ''}`) }
}

const mw = "const PUBLIC_PATHS = ['/login', '/api/bills/drivesync']"

console.log('── สี่ทิศหลักของด่านนี้ ──')
{
  const ok = ตรวจ(mw, [['app/api/bills/drivesync/route.ts', 'if (s !== process.env.DRIVESYNC_SECRET) x']])
  ต้อง('อยู่ใน PUBLIC_PATHS แล้ว ⇒ ไม่ร้อง', ok.ผิด.length === 0, JSON.stringify(ok.ผิด))
}
{
  const bad = ตรวจ(mw, [['app/api/bills/dupcheck/route.ts', 'const required = process.env.DRIVESYNC_SECRET']])
  ต้อง('ลืมใส่ PUBLIC_PATHS ⇒ ต้องร้อง 1 ข้อ', bad.ผิด.length === 1, JSON.stringify(bad.ผิด))
  ต้อง('ข้อความต้องเอ่ยชื่อเส้นที่ผิด', String(bad.ผิด[0] ?? '').includes('/api/bills/dupcheck'))
}
{
  /* 🔴 ทิศที่อันตรายที่สุด: แค่ "พูดถึง" secret ในคอมเมนต์ ห้ามนับเป็นการตรวจ secret */
  const cmt = ตรวจ(mw, [['app/api/bills/status/route.ts', '// ต่างจาก report ที่ใช้ process.env.DRIVESYNC_SECRET']])
  ต้อง('คอมเมนต์ล้วน ⇒ ไม่นับเป็นเส้นที่ตรวจ secret', cmt.จำนวน === 0, `จำนวน=${cmt.จำนวน}`)
  ต้อง('คอมเมนต์ล้วน ⇒ ไม่ร้อง', cmt.ผิด.length === 0)
}
{
  const intent = ตรวจ(mw, [['app/api/bills/fixmonth/route.ts', '// ไม่เปิดสาธารณะโดยตั้งใจ: เขียนข้อมูล\nconst r = process.env.DRIVESYNC_SECRET']])
  ต้อง('มีป้าย "ไม่เปิดสาธารณะโดยตั้งใจ:" ⇒ ไม่ร้อง', intent.ผิด.length === 0, JSON.stringify(intent.ผิด))
}

console.log('\n── คอมเมนต์ท้ายบรรทัด (รูปที่เคยหลุดจริง 19 ก.ย. 2569) ──')
{
  const ท้ายบรรทัด = เส้นที่ใช้secret([['app/api/x/route.ts', 'const a = 1 // ใช้ process.env.DRIVESYNC_SECRET ที่อื่น']])
  ต้อง('คอมเมนต์ท้ายบรรทัดไม่ถูกนับเป็นโค้ด', ท้ายบรรทัด.length === 0, JSON.stringify(ท้ายบรรทัด))
}

console.log('\n── middleware อ่านไม่ออก ⇒ ต้องบอกว่าตัวตรวจเองพัง ไม่ใช่เงียบ ──')
{
  const พัง = ตรวจ('ไม่มี PUBLIC_PATHS ในนี้', [['app/api/y/route.ts', 'process.env.DRIVESYNC_SECRET']])
  ต้อง('คืนข้อความว่าตัวตรวจเองพัง', (พัง.ผิด ?? []).some((x) => String(x).includes('ตัวตรวจเองพัง')), JSON.stringify(พัง))
}

console.log('\n── ตัวควบคุม: รุ่นที่ไม่ตัดคอมเมนต์ (รูปก่อนแก้ 19 ก.ย.) ต้องให้ผลต่าง ──')
{
  /* รุ่นเก่าแบบย่อ: ดูจากซอร์สดิบ ⇒ คอมเมนต์ถูกนับเป็นโค้ด */
  const รุ่นเก่า = (files) => files.filter(([, src]) => /process\.env\.DRIVESYNC_SECRET/.test(src)).length
  const ไฟล์ = [['app/api/bills/status/route.ts', '// ต่างจาก report ที่ใช้ process.env.DRIVESYNC_SECRET']]
  ต้อง('รุ่นเก่านับคอมเมนต์เป็นโค้ด (ยืนยันว่าเคสนี้แยกแยะได้)', รุ่นเก่า(ไฟล์) === 1)
  ต้อง('รุ่นวันนี้ไม่นับ', เส้นที่ใช้secret(ไฟล์).length === 0)
}

console.log(`\n${ตก ? `🔴 ตก ${ตก} ข้อ` : '✅ ผ่านทุกข้อ'}`)
process.exit(ตก ? 1 : 0)
