#!/usr/bin/env node
/* **ของที่เสิร์ฟอยู่จริงเปลี่ยนไปหรือยัง** — เทียบเว็บกับตัวมันเองเมื่อวาน ไม่ใช่เทียบกับเครื่องเรา
 *
 * 🔴 **ที่มา 20 ก.ย. 2569 22:2x** — คำถามง่าย ๆ ที่ **เราสองคนตอบไม่ได้ทั้งคู่**:
 *    *"วันนี้มี build เกิดที่ `admin.gucut.com` หรือเปล่า"*
 *    · หน้าแรกตอบ **307** (กำแพงล็อกอิน) ⇒ ไม่มี HTML ให้ดึง `buildId`
 *    · ไม่มี `NETLIFY_API_TOKEN` บนเครื่องนี้ ⇒ ถาม Deploy API ไม่ได้
 *    · และ **ห้ามเทียบ hash ของ chunk กับของที่ build ในเครื่อง** — `CLAUDE.md` เขียนห้ามไว้เอง
 *      (hash ของ Next **ไม่ reproducible ข้ามเครื่อง** ⇒ ต่างกันได้ทั้งที่โค้ดชุดเดียวกัน)
 *      📏 ยืนยันวันนี้: `buildId` ที่ผม build ในเครื่อง ยิงบนเว็บได้ **404** ⇒ **ไม่ได้แปลว่าอะไรเลย**
 *
 * 🔑 **ทางที่เหลือและใช้ได้จริง: เทียบเว็บกับ "ตัวมันเองเมื่อครั้งก่อน"**
 *    หน้า `/login` เปิดได้โดยไม่ต้องล็อกอิน (middleware ยกเว้นไว้) ⇒ ดึงชื่อไฟล์ chunk ที่มันอ้างถึงได้
 *    ⇒ เก็บเป็นลายนิ้วมือพร้อมวันที่ ⇒ **วันหน้าถ้าลายนิ้วมือเปลี่ยน = มี build ใหม่แน่นอน**
 *
 * ⚠️ **ขอบเขต — อ่านก่อนใช้ตัดสินใจ** (ไม่เขียนไว้ จะถูกอ่านเกินจริงแน่นอน)
 *    · เปลี่ยน ⇒ **มี build ใหม่** (ยืนยันทิศบวกได้)
 *    · ไม่เปลี่ยน ⇒ **"ยังไม่รู้"** ไม่ใช่ "ไม่มี build" — build ที่ไม่แตะหน้า `/login`
 *      อาจให้ชื่อ chunk เดิม ⇒ ⇒ **ห้ามอ่านว่าไม่มี build**
 *    · ตัวจริงที่ตอบได้ครบคือ **Netlify Deploy API** ⇒ ยังต้องขอ token จากท่านประธานอยู่ดี
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const แฟ้ม = ROOT + 'scripts/ลายนิ้วมือเว็บที่เสิร์ฟ.json'
const URL_ที่เปิดได้ = process.env.GUCUT_FINGERPRINT_URL || 'https://admin.gucut.com/login'

/* ── ตัวควบคุมฝังใน: ตัวสกัดต้องเห็น chunk ในหน้าที่มีจริง และต้องไม่เห็นในหน้าที่ไม่มี ── */
const สกัด = (html) => [...new Set([...String(html ?? '').matchAll(/\/_next\/static\/([^"'\s]+\.js)/g)].map((m) => m[1]))].sort()
{
  const เคส = [
    ['<script src="/_next/static/chunks/app/login/page-abc123.js"></script>', 1],
    ['<html><body>ไม่มี chunk เลย</body></html>', 0],
  ]
  let ตก = 0
  for (const [html, ควรได้] of เคส) if (สกัด(html).length !== ควรได้) { ตก++; console.error(`   🔴 ตัวควบคุมไม่ผ่าน: ควรได้ ${ควรได้}`) }
  if (ตก) { console.error('🔴 ตัวสกัดของสคริปต์นี้ตัดสินตัวควบคุมผิด ⇒ **ผลอ่านไม่ได้**'); process.exit(1) }
}

const res = await fetch(URL_ที่เปิดได้, { redirect: 'manual' })
const html = await res.text()
if (res.status !== 200) {
  console.log(`⏭️  ${URL_ที่เปิดได้} ตอบ ${res.status} ⇒ **ยังไม่ได้วัด** (ไม่ใช่ "ไม่มี build")`)
  process.exit(0)
}
const ชิ้น = สกัด(html)
if (!ชิ้น.length) {
  console.log('⏭️  หน้านั้นไม่อ้าง chunk เลย ⇒ **ยังไม่ได้วัด** (ไม่ใช่ "ไม่มี build")')
  process.exit(0)
}

const เดิม = existsSync(แฟ้ม) ? JSON.parse(readFileSync(แฟ้ม, 'utf8')) : null
const ใหม่ = { url: URL_ที่เปิดได้, 'วัดเมื่อ_iso': new Date().toISOString(), 'จำนวนชิ้น': ชิ้น.length, ชิ้น }

console.log(`ลายนิ้วมือของที่เสิร์ฟอยู่: ${ชิ้น.length} ชิ้น จาก ${URL_ที่เปิดได้}`)
if (!เดิม) {
  console.log('   📌 ยังไม่มีใบเทียบ ⇒ บันทึกเป็น **ใบตั้งต้น** (รอบหน้าถึงจะเทียบได้)')
} else {
  const หาย = เดิม.ชิ้น.filter((x) => !ชิ้น.includes(x))
  const เพิ่ม = ชิ้น.filter((x) => !เดิม.ชิ้น.includes(x))
  if (!หาย.length && !เพิ่ม.length) {
    console.log(`   ⏸️  **เหมือนใบเมื่อ ${เดิม['วัดเมื่อ_iso']}** ⇒ **"ยังไม่รู้ว่ามี build ไหม"** — ไม่ใช่ "ไม่มี build"`)
  } else {
    console.log(`   🟢 **เปลี่ยนไปแล้ว ⇒ มี build ใหม่แน่นอน** (เทียบกับใบเมื่อ ${เดิม['วัดเมื่อ_iso']})`)
    console.log(`      หายไป ${หาย.length} · เพิ่มมา ${เพิ่ม.length}`)
    for (const x of เพิ่ม.slice(0, 5)) console.log('      + ' + x)
  }
}
writeFileSync(แฟ้ม, JSON.stringify(ใหม่, null, 2) + '\n')
console.log(`   เขียนใบใหม่แล้ว: scripts/${แฟ้ม.split('/').pop()}`)
