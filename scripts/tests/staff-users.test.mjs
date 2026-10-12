#!/usr/bin/env node
/* บัญชีพนักงาน (`lib/staff-users.ts`) — **ไฟล์ที่ตัดสินว่าใครเข้าระบบได้และเห็นอะไร**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) วัดแล้วว่าไม่มีเทสและไม่มีด่านแตะเลย
 * ผู้ใช้จริง: จอตั้งค่าผู้ใช้ · จอโปรไฟล์ · จอลูกค้า · และ **เส้นล็อกอิน** (app/api/auth/login)
 *
 * 🔴 ไฟล์นี้ต่างจากไฟล์เงิน: พลาดแล้วไม่ได้เห็นเลขผิด แต่ **คนที่ไม่ควรเข้าได้เข้า**
 *    หรือ **ค่าที่ห้ามออกจากเซิร์ฟเวอร์หลุดขึ้นจอ** ⇒ ตรวจสามข้อที่ไฟล์ประกาศเอง:
 *      ① publicView ต้องไม่มีเงาของรหัสเลย (salt/hash ห้ามหลุด)
 *      ② ไม่มีช่อง role / role แปลก ⇒ ต้องเป็น 'staff' **ห้ามสูงกว่าของจริง**
 *      ③ คนที่ถูกปิดใช้งาน ต้องไม่ผ่าน และต้องไม่ต่างจากรหัสผิด
 *
 * 🔑 ใช้ของจริงทั้งหมด (PBKDF2 ตัวจริง) — ปลอมเฉพาะ @netlify/blobs ซึ่งเป็นที่เก็บ
 *    โดยวาง node_modules ปลอมไว้ในโฟลเดอร์ชั่วคราวที่คอมไพล์ลง ⇒ ไม่แตะของในรีโป
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `staff-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/staff-users.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')

  /* ── ที่เก็บปลอม: ของจริงคือ Netlify Blobs ซึ่งไม่มีในเครื่องนี้ ──
     🔑 ปลอม **ที่เก็บ** อย่างเดียว · การแฮช การเทียบ การตัดสินสิทธิ์ เป็นของจริงทุกบรรทัด */
  const bl = join(out, 'node_modules', '@netlify', 'blobs')
  mkdirSync(bl, { recursive: true })
  writeFileSync(join(bl, 'package.json'), '{"name":"@netlify/blobs","type":"module","main":"index.js"}')
  writeFileSync(join(bl, 'index.js'), `
const ถัง = new Map();
export function getStore() {
  return {
    async list({ prefix } = {}) {
      const keys = [...ถัง.keys()].filter((k) => !prefix || k.startsWith(prefix));
      return { blobs: keys.map((key) => ({ key })) };
    },
    async get(key) { return ถัง.has(key) ? ถัง.get(key) : null; },
    async setJSON(key, v) { ถัง.set(key, v); },
    async delete(key) { ถัง.delete(key); },
  };
}
`)
  const m = await import(join(out, 'staff-users.js'))
  const { publicView, addStaffUser, findStaffUserByPassword, setStaffUserActive, listStaffUsers, MAX_USERS } = m

  console.log('① publicView — สิ่งเดียวที่จอได้เห็น ต้องไม่มีเงาของรหัสเลย')
  {
    const เต็ม = {
      id: 'u1', name: 'สมชาย', active: true, createdAt: '2026-09-29',
      role: 'account', salt: 'SALTSALT', hash: 'HASHHASH', iter: 100000,
    }
    const ออก = publicView(เต็ม)
    const คีย์ = Object.keys(ออก).sort().join(',')
    ok('ไม่มี salt/hash/iter ติดออกไป', !('salt' in ออก) && !('hash' in ออก) && !('iter' in ออก),
      JSON.stringify(ออก))
    ok('มีเฉพาะช่องที่ตกลงไว้', คีย์ === 'active,createdAt,id,name,role', คีย์)
    ok('ไม่มีค่าไหนในผลที่เท่ากับรหัสที่เก็บไว้',
      !JSON.stringify(ออก).includes('HASHHASH') && !JSON.stringify(ออก).includes('SALTSALT'))
  }

  console.log('② ชั้นสิทธิ์ — ไม่รู้ต้องกลายเป็น "พนักงาน" ห้ามสูงกว่าของจริง')
  {
    const ฐาน = { id: 'u', name: 'x', active: true, createdAt: '', salt: '', hash: '', iter: 1 }
    ok('ไม่มีช่อง role (ผู้ใช้เก่าก่อน 14 ก.ย.) ⇒ staff', publicView({ ...ฐาน }).role === 'staff')
    ok('role เป็นค่าแปลก ⇒ staff **ไม่ใช่ค่านั้น**',
      publicView({ ...ฐาน, role: 'admin' }).role === 'staff',
      'ถ้าปล่อยผ่าน ข้อมูลเก่า/ข้อมูลเสียจะยกระดับสิทธิ์บนจอได้')
    ok('role = account ⇒ คงไว้', publicView({ ...ฐาน, role: 'account' }).role === 'account')
  }

  console.log('③ เข้าระบบด้วยรหัส — รหัสถูกต้องผ่าน · รหัสผิดไม่ผ่าน')
  {
    const เพิ่ม = await addStaffUser('สมหญิง', 'รหัสลับ-1234', new Date(), 'account')
    ok('เพิ่มผู้ใช้ได้', เพิ่ม.ok === true, JSON.stringify(เพิ่ม).slice(0, 120))
    const เจอ = await findStaffUserByPassword('รหัสลับ-1234')
    ok('รหัสถูก ⇒ เจอคนนั้น', เจอ?.name === 'สมหญิง', JSON.stringify(เจอ))
    ok('และสิ่งที่คืนออกมาไม่มีเงาของรหัส', เจอ && !('hash' in เจอ) && !('salt' in เจอ))
    ok('รหัสผิด ⇒ null', (await findStaffUserByPassword('รหัสมั่ว')) === null)
    ok('รหัสว่าง ⇒ null (ไม่ใช่เจอคนแรก)', (await findStaffUserByPassword('')) === null)
  }

  console.log('④ 🔴 คนที่ถูกปิดใช้งาน ต้องไม่ผ่าน — แม้รหัสจะถูก')
  {
    const ผู้ใช้ = (await listStaffUsers()).find((u) => u.name === 'สมหญิง')
    ok('ปิดใช้งานสำเร็จ', await setStaffUserActive(ผู้ใช้.id, false))
    const ผล = await findStaffUserByPassword('รหัสลับ-1234')
    ok('รหัสถูกแต่ถูกปิด ⇒ null เหมือนรหัสผิดทุกประการ', ผล === null,
      `ได้ ${JSON.stringify(ผล)} ⇒ คนที่ถูกปิดยังเข้าระบบได้`)
    ok('เปิดกลับแล้วเข้าได้อีก', await setStaffUserActive(ผู้ใช้.id, true)
      && (await findStaffUserByPassword('รหัสลับ-1234'))?.id === ผู้ใช้.id)
  }

  console.log('⑤ รหัสเดียวกันของคนละคน ต้องได้ค่าเก็บที่ต่างกัน (มีเกลือประจำคน)')
  {
    /* ถ้าไม่มีเกลือประจำคน คนที่ใช้รหัสเหมือนกันจะมีค่าเก็บเหมือนกัน
       ⇒ ใครที่อ่านฐานได้จะรู้ทันทีว่าสองคนนี้ใช้รหัสเดียวกัน */
    const a = await addStaffUser('ฝาแฝดหนึ่ง', 'รหัสเหมือนกันเป๊ะ')
    const b = await addStaffUser('ฝาแฝดสอง', 'รหัสเหมือนกันเป๊ะ')
    /* ⚠️ ข้อนี้เคยถูก "ข้าม" เพราะรันหลังข้อเพดาน แล้วเพิ่มผู้ใช้ไม่ได้
       ⇒ ข้อที่ถูกข้ามคือข้อที่ไม่ได้ทดสอบอะไร แต่ยังนับว่าผ่าน ⇒ ย้ายมาก่อนข้อเพดาน */
    ok('เพิ่มคนที่ใช้รหัสเดียวกันได้ทั้งสองคน', a.ok === true && b.ok === true,
      JSON.stringify([a, b]).slice(0, 140))
    const เจอ = await findStaffUserByPassword('รหัสเหมือนกันเป๊ะ')
    ok('รหัสซ้ำกันยังเข้าได้ (เจอคนใดคนหนึ่ง)', !!เจอ, JSON.stringify(เจอ))
  }
  console.log('⑥ เพดานจำนวนผู้ใช้ — ต้องกันจริง ไม่ใช่เขียนไว้เฉย ๆ')
  {
    let เพิ่มไม่ได้ = null
    for (let i = 0; i < MAX_USERS + 2; i++) {
      const r = await addStaffUser(`คนที่${i}`, `รหัสของคนที่-${i}`, new Date(), 'staff')
      if (!r.ok && !เพิ่มไม่ได้) เพิ่มไม่ได้ = r
    }
    ok(`เกิน ${MAX_USERS} คนแล้วเพิ่มไม่ได้`, !!เพิ่มไม่ได้, 'เพิ่มได้ไม่จำกัด = เพดานเป็นแค่ตัวเลขประดับ')
    ok('และบอกเหตุผลออกมา ไม่ใช่เงียบ ๆ', !!เพิ่มไม่ได้?.error, JSON.stringify(เพิ่มไม่ได้))
    const ทั้งหมด = await listStaffUsers()
    ok(`รายชื่อไม่เกินเพดาน (ได้ ${ทั้งหมด.length})`, ทั้งหมด.length <= MAX_USERS, String(ทั้งหมด.length))
    ok('รายชื่อที่ส่งให้จอ ไม่มีเงาของรหัสสักคน',
      ทั้งหมด.every((u) => !('hash' in u) && !('salt' in u)))
  }

} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอมเฉพาะที่เก็บ (Netlify Blobs) — การแฮชและการตัดสินสิทธิ์เป็นของจริง')
process.exit(ตก ? 1 : 0)
