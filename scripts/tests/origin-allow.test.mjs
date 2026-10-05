/* เทสด่านข้ามเว็บ — **ยิงสองทิศทุกข้อ**
 * ของที่ด่านนี้คุมคือ "ใครสั่งเขียนข้อมูลได้" ⇒ ผิดทิศไหนก็เจ็บ:
 *   ปล่อยผ่านเกิน = เว็บแปลกหน้าสั่งงานแทนผู้ใช้ได้
 *   ปฏิเสธเกิน    = ทั้งเว็บเขียนอะไรไม่ได้ (ด่านนี้อยู่บนทางเข้าทุกเส้น)
 */
import { rmSync } from 'node:fs'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}
const ไฟล์ = 'lib/origin-allow.ts'
let งาน

try {
  const ผล = คอมไพล์เพื่อทดสอบ({ ไฟล์: [ไฟล์], ปลอม: {} })
  งาน = ผล.ที่ออก
  const { อนุญาตข้ามโดเมน, หัวCORS, ต้องปฏิเสธเพราะข้ามเว็บ, ออริจินที่อนุญาต } =
    await import(ผล.พาธของ(ไฟล์))

  console.log('① ใครเรียกข้ามโดเมนได้บ้าง')
  ok('เว็บโกดังของร้านผ่าน', อนุญาตข้ามโดเมน('https://3d.gucut.com') === true)
  ok('เว็บแปลกหน้าไม่ผ่าน', อนุญาตข้ามโดเมน('https://evil.example') === false)
  ok('http ธรรมดาไม่ผ่าน', อนุญาตข้ามโดเมน('http://3d.gucut.com') === false)
  ok('ชื่อที่ขึ้นต้นเหมือนกันไม่ผ่าน', อนุญาตข้ามโดเมน('https://3d.gucut.com.evil.example') === false)
  ok('ไม่มี origin ไม่ผ่าน', อนุญาตข้ามโดเมน(null) === false)

  console.log('② หัว CORS')
  {
    const h = หัวCORS('https://3d.gucut.com')
    ok('ออกให้ออริจินที่อนุญาต', h?.['access-control-allow-origin'] === 'https://3d.gucut.com')
    ok('ยอมให้ส่งคุกกี้', h?.['access-control-allow-credentials'] === 'true')
    ok('มี Vary: Origin (ไม่มี ⇒ แคชตัวกลางเสิร์ฟข้ามออริจินได้)', h?.vary === 'Origin')
    ok('ไม่ออกให้เว็บแปลกหน้า', หัวCORS('https://evil.example') === null)
  }

  console.log('③ ด่านกันสั่งงานข้ามเว็บ — ทิศ "ต้องปฏิเสธ"')
  ok('เว็บแปลกหน้าสั่ง POST', ต้องปฏิเสธเพราะข้ามเว็บ('POST', 'https://evil.example', '1.gucut.com') === true)
  ok('เว็บแปลกหน้าสั่ง DELETE', ต้องปฏิเสธเพราะข้ามเว็บ('DELETE', 'https://evil.example', '1.gucut.com') === true)
  ok('origin อ่านไม่ออก = ไม่ไว้ใจ', ต้องปฏิเสธเพราะข้ามเว็บ('POST', 'origin-ที่พัง', '1.gucut.com') === true)

  console.log('③ ด่านกันสั่งงานข้ามเว็บ — ทิศ "ต้องไม่ปฏิเสธ" (ผิดทิศนี้ = ทั้งเว็บเขียนไม่ได้)')
  ok('เว็บเดียวกัน', ต้องปฏิเสธเพราะข้ามเว็บ('POST', 'https://1.gucut.com', '1.gucut.com') === false)
  ok('เว็บของร้านที่อนุญาต', ต้องปฏิเสธเพราะข้ามเว็บ('POST', 'https://3d.gucut.com', '1.gucut.com') === false)
  ok('ไม่มี Origin (เครื่องมือหลังบ้าน ไม่พกคุกกี้)', ต้องปฏิเสธเพราะข้ามเว็บ('POST', null, '1.gucut.com') === false)
  ok('GET ไม่ใช่หน้าที่ด่านนี้ — CORS กันการอ่านอยู่แล้ว', ต้องปฏิเสธเพราะข้ามเว็บ('GET', 'https://evil.example', '1.gucut.com') === false)
  ok('OPTIONS (preflight) ต้องผ่าน', ต้องปฏิเสธเพราะข้ามเว็บ('OPTIONS', 'https://evil.example', '1.gucut.com') === false)

  console.log('④ รูปของรายชื่อ — กันพิมพ์ผิดที่ไม่มีใครเห็น')
  ok('รายชื่อไม่ว่าง (ว่าง = ฟีเจอร์ตายเงียบ)', ออริจินที่อนุญาต.length > 0)
  ok('ทุกชื่อเป็น https', ออริจินที่อนุญาต.every((o) => o.startsWith('https://')))
  ok('ไม่มี / ท้าย (เบราว์เซอร์ส่ง Origin โดยไม่มี /)', ออริจินที่อนุญาต.every((o) => !o.endsWith('/')))
} finally {
  if (งาน) rmSync(งาน, { recursive: true, force: true })
}

console.log(ตก === 0 ? '\n✅ ผ่านทุกข้อ' : `\n🔴 ตก ${ตก} ข้อ`)
process.exit(ตก === 0 ? 0 : 1)
