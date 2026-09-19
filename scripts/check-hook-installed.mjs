/* ด่านก่อน push ที่ **ติดตั้งอยู่จริง** ต้องเป็นตัวเดียวกับในรีโป (19 ก.ย. 2569 · งาน S2)
 *
 * 🔴 **ที่มา — เจ็บจริงวันนี้ ไม่ใช่เรื่องสมมติ**
 *   รีโปมีด่านความถี่ที่ **ห้าม** push ถี่ (exit 1) · แต่ `.git/hooks/pre-push` บนเครื่อง
 *   ยังเป็นรุ่นเก่าที่ **ไม่มีบล็อกนั้นเลยสักบรรทัด** ⇒ push ตอน 44 นาทีผ่านฉลุย
 *   และผมรายงานฝั่งท่อไปแล้วว่า "ด่านความถี่ห้ามแล้ว ไม่ใช่เตือน"
 *   ⇒ **จริงกับไฟล์ ไม่จริงกับเครื่อง** — คลาส `committed-is-not-shipped-to-the-runtime`
 *
 * 🔑 ทำไมด่านนี้ต้องมี ทั้งที่มีตัวติดตั้งอยู่แล้ว:
 *   `scripts/install-pre-push.sh` เขียนเตือนไว้เองว่า
 *   "ด่านนี้ไม่ได้อยู่ใน prebuild ⇒ build ผ่านไม่ได้แปลว่าด่านติดตั้งอยู่"
 *   ⇒ **คนเขียนรู้ช่องโหว่ แล้วเขียนกำกับไว้เฉย ๆ** ซึ่งไม่ได้กันอะไรเลย
 *   ⇒ คำเตือนที่ไม่มีกลไกรองรับ = คำบรรยาย ไม่ใช่กลไก (เกณฑ์เดียวกับ lib/ตัดคอมเมนต์)
 *
 * ⚠️ **ตรวจไม่ได้ ห้ามกลายเป็นผ่าน** — แต่ต้องแยกจาก "ตรวจแล้วไม่ตรง":
 *   บนเครื่อง build ของ Netlify ไม่มี `.git/hooks` และด่านก่อน push **ไม่มีความหมาย**
 *   (มันกันตอนคนกด push จากเครื่องตัวเอง ไม่ใช่ตอนเซิร์ฟเวอร์ build)
 *   ⇒ ที่นั่นจึงข้ามได้ **แต่ต้องพิมพ์ออกมาว่าข้ามอะไร** ไม่ใช่เงียบแล้วขึ้นเขียว
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const ROOT = process.cwd()
const ในรีโป = join(ROOT, 'scripts/hooks/pre-push')
const ติดตั้ง = join(ROOT, '.git/hooks/pre-push')

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 12)

if (!existsSync(ในรีโป)) {
  console.error('🔴 ไม่มี scripts/hooks/pre-push ในรีโป — ด่านนี้ไม่มีอะไรให้เทียบ')
  console.error('   ⇒ ถือว่าไม่ผ่าน: "ไม่มีของให้ตรวจ" ไม่ใช่ "ตรวจแล้วเรียบร้อย"')
  process.exit(1)
}

/* บนเซิร์ฟเวอร์ build: ด่านก่อน push ไม่มีความหมาย ⇒ ข้ามได้ แต่ต้องบอกว่าข้าม */
if (process.env.NETLIFY === 'true' || process.env.CI === 'true' || !existsSync(join(ROOT, '.git'))) {
  console.log('⏭️  ข้ามการตรวจ hook: ที่นี่ไม่ใช่เครื่องนักพัฒนา (ไม่มี .git/hooks หรือเป็นเซิร์ฟเวอร์ build)')
  console.log('   ⚠️ รอบนี้ **ไม่ได้ตรวจ**ว่าด่านก่อน push ติดตั้งอยู่หรือเปล่า — ไม่ได้แปลว่าติดตั้งแล้ว')
  process.exit(0)
}

if (!existsSync(ติดตั้ง)) {
  console.error('🔴 ยังไม่ได้ติดตั้งด่านก่อน push บนเครื่องนี้ (.git/hooks/pre-push ไม่มี)')
  console.error('   ⇒ push ถี่/ข้ามวันหยุด deploy จะไม่มีอะไรกัน · แก้: bash scripts/install-pre-push.sh')
  process.exit(1)
}

const ก = md5(ในรีโป), ข = md5(ติดตั้ง)
if (ก !== ข) {
  console.error('🔴 ด่านก่อน push ที่ติดตั้งอยู่ **ไม่ใช่ตัวเดียวกับในรีโป**')
  console.error(`   ในรีโป md5 ${ก} · ที่ติดตั้ง md5 ${ข}`)
  console.error('   ⇒ กฎที่เขียนไว้ในรีโป อาจไม่ได้ทำงานจริงบนเครื่องนี้')
  console.error('      (19 ก.ย. 2569 เกิดจริง: รีโปห้าม push ถี่ แต่ตัวที่ติดตั้งแค่เตือน ⇒ push ผ่านที่ 44 นาที)')
  console.error('   แก้: bash scripts/install-pre-push.sh   (ของเดิมจะถูกสำรองเป็น .bak ให้)')
  process.exit(1)
}
console.log(`✅ ด่านก่อน push ที่ติดตั้งอยู่ ตรงกับในรีโป (md5 ${ก})`)
