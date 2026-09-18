#!/usr/bin/env node
/* ด่านก่อน build: **ห้าม build ขณะที่ `next dev` ยังรันอยู่**
 *
 * 🔴 **ที่มา — พลาดซ้ำ 18 ก.ย. 2569** (เคยเจอครั้งแรก 13 ก.ย. และจดไว้ในความจำแล้วด้วย)
 *    `npm run build` กับ `next dev` ใช้โฟลเดอร์ `.next/` ร่วมกัน ⇒ build ไปทับของที่ dev กำลังใช้
 *    ⇒ dev กลายเป็น 500 `Cannot find module './1633.js'` · จอที่กำลังตรวจด้วยตา **ว่างเปล่า**
 *    ⇒ เสียเวลาไล่หาว่าจอพังเพราะโค้ดหรือเพราะเครื่องมือ ซึ่งคือเวลาที่เสียฟรีทั้งก้อน
 *
 * 🔑 **CEO ตั้งกฎจากเคสนี้: "กติกาที่พลาดซ้ำต้องกลายเป็นกลไก ไม่ใช่บันทึก"**
 *    บันทึกกันการพลาดของคนที่อ่านบันทึก · ด่านกันการพลาดของคนที่กำลังรีบ ซึ่งเป็นคนเดียวกัน
 *
 * ⚠️ ตอน Netlify build ไม่มี dev รันอยู่ ⇒ ด่านนี้ผ่านเสมอ ไม่กระทบ deploy
 * ⚠️ เครื่องที่ไม่มีคำสั่ง `ss` ⇒ **ข้ามแบบมีเสียง** (พิมพ์ว่าไม่ได้ตรวจ) ไม่ใช่เงียบแล้วผ่าน
 */
import { execFileSync } from 'node:child_process'

const พอร์ต = ['3000', '3001', '3111']

let out = ''
try {
  out = execFileSync('ss', ['-ltnp'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  console.log('⏭️  ข้ามด่าน dev: เครื่องนี้ไม่มีคำสั่ง ss ⇒ **ยังไม่ได้ตรวจ** (ไม่ใช่ตรวจแล้วผ่าน)')
  process.exit(0)
}

const พบ = []
for (const บรรทัด of out.split('\n')) {
  if (!/next-server|next dev/.test(บรรทัด)) continue
  for (const p of พอร์ต) {
    if (new RegExp(`[:.]${p}\\s`).test(บรรทัด)) {
      const pid = (บรรทัด.match(/pid=(\d+)/) || [])[1] ?? '?'
      พบ.push({ port: p, pid })
    }
  }
}

if (พบ.length) {
  console.error('\n🔴 มี `next dev` รันอยู่ — build ตอนนี้จะไปทับ .next/ ที่ dev ใช้อยู่')
  for (const x of พบ) console.error(`   พอร์ต ${x.port} · pid ${x.pid}`)
  console.error('\n   ทำตามนี้ก่อน:')
  console.error(`     kill ${พบ.map((x) => x.pid).join(' ')}      # หา pid จากพอร์ต ห้ามใช้ pkill -f "next dev"`)
  console.error('     (pkill -f "next dev" จะฆ่าเชลล์ของตัวเองด้วย เพราะบรรทัดคำสั่งของเชลล์มีข้อความนั้นอยู่)')
  console.error('     rm -rf .next    # ถ้า dev เคยพังไปแล้ว ต้องล้างก่อน')
  console.error('\n   ⚠️ อาการที่จะเจอถ้าไม่ทำ: dev ตอบ 500 "Cannot find module" และ**จอที่กำลังตรวจด้วยตาจะว่างเปล่า**')
  console.error('      แล้วจะแยกไม่ออกว่าจอพังเพราะโค้ดที่เพิ่งแก้ หรือเพราะเครื่องมือพัง')
  process.exit(1)
}
console.log('✅ ไม่มี next dev รันอยู่ — build ได้ปลอดภัย')
