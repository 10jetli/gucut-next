// ── ผู้ใช้งานที่เพิ่มจากหน้าเว็บ — ที่เก็บ + การตรวจรหัส ────────────────────────────
//
// ท่านประธานสั่ง 12 ก.ย. 2569: "ทำหน้านี้หน่อยจะใช้" (/core/settings-users/add)
// ของเดิมหน้านั้นเป็น **ใบสั่งงานให้คนอ่าน** — ไปตั้ง STAFF_NAME_n/STAFF_PASS_n ที่ Netlify
// แล้วรอ deploy 3 นาที ⇒ เพิ่มคนหนึ่งคนต้องออกจากระบบเราไปทำที่อื่น
//
// 🔴 **นโยบายเดิมในไฟล์หน้าเว็บเขียนห้ามทำฟอร์มตั้งรหัส — และนี่คือเหตุผลที่เปลี่ยนได้**
//    เหตุผลเดิมเต็มประโยคคือ "รหัสวิ่งผ่านเซิร์ฟเวอร์เรา **แล้วต้องเก็บไว้อ่านได้**"
//    วรรคท้ายคือหัวใจ: ที่ต้องเก็บอ่านได้ เพราะตอนล็อกอินเทียบ **ข้อความดิบ** กับ env
//    ⇒ ไฟล์นี้เก็บเป็น **ค่าที่ย้อนกลับไม่ได้ + ค่าสุ่มประจำคน** (PBKDF2-SHA256)
//       ⇒ เงื่อนไขที่ทำให้ข้อห้ามนั้นจำเป็น **ถูกเอาออกไปแล้ว** ไม่ใช่ฝืนข้อห้าม
//    (CEO อนุมัติ 12 ก.ย. 2569 พร้อมสั่งว่า **ห้ามลบข้อห้ามเฉย ๆ** ต้องเขียนทับให้คนอ่าน
//     รอบหน้าเห็นว่าเคยห้ามเพราะอะไร และอะไรเปลี่ยนไป)
//
// 🔴 กติกาของไฟล์นี้ — ห้ามถอดข้อไหนออก
//   ① **ห้ามเก็บรหัสเป็นข้อความดิบ ห้าม log ห้ามส่งกลับออกจาก API ทุกกรณี**
//      `publicView()` เป็นด่านเดียวที่ข้อมูลออกไปหาหน้าจอ — ถ้าจะเพิ่มช่อง ให้เพิ่มที่นั่น
//      และ **ต้องไม่มีทางที่ hash/salt หลุดออกไป** (ตรวจด้วยตาหลังบันทึกจริงแล้ว 12 ก.ย.)
//   ② เทียบแฮชแบบ **ใช้เวลาเท่ากันเสมอ** — ไม่ให้เวลาตอบบอกว่าเดาใกล้แล้วแค่ไหน
//   ③ **ปิดผู้ใช้ได้** (active:false) ไม่ใช่ลบทิ้งเท่านั้น — พนักงานลาออกต้องปิดได้
//      และ **เก็บบันทึกไว้** เพื่อรู้ว่าใครเคยมีสิทธิ์ (ลบจริงก็ทำได้ สำหรับบัญชีทดสอบ)
//   ④ จำนวนคนมีเพดาน เพราะตอนล็อกอินต้องไล่เทียบทุกคน (ดู MAX_USERS)
//
// ⚠️ ไฟล์นี้ใช้ได้เฉพาะฝั่ง **Node** (เส้น API) ห้าม import จาก middleware
//    — Blobs กับ edge runtime ยังไม่เคยพิสูจน์ว่าเข้ากันได้ และถ้าพลาดคือทั้งเว็บ 500
//    ฝั่ง middleware ใช้ lib/staff-token.ts ซึ่งตรวจลายเซ็นได้โดยไม่ต้องอ่านฐาน
import { getStore } from '@netlify/blobs'

const STORE = 'gucut-staff-users'
const KEY = (id: string) => `u/${id}`
export const MAX_USERS = 20
const ITER = 100_000          // PBKDF2 รอบ — ช้าพอให้เดายาก แต่ยังไล่เทียบ 20 คนจบใน ~1 วินาที
const HASH_BITS = 256

export interface StaffUser {
  id: string
  name: string
  active: boolean
  createdAt: string
  /** ค่าที่ย้อนกลับไม่ได้ + ค่าสุ่มประจำคน — 🔴 ห้ามส่งออกจากเซิร์ฟเวอร์ */
  salt: string
  hash: string
  iter: number
}
/** สิ่งเดียวที่หน้าจอได้เห็น — ไม่มี salt/hash และไม่มีเงาของรหัสเลย */
export interface StaffUserPublic { id: string; name: string; active: boolean; createdAt: string }
export const publicView = (u: StaffUser): StaffUserPublic =>
  ({ id: u.id, name: u.name, active: u.active, createdAt: u.createdAt })

/* ⚠️ ห้าม spread Uint8Array — TS2802 ของ target โปรเจกต์นี้ */
const b64 = (b: Uint8Array) => btoa(Array.from(b).map((x) => String.fromCharCode(x)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

/** PBKDF2-SHA256 — Web Crypto (ใช้ได้ทั้ง Node 18+ และ edge ถ้าวันหนึ่งต้องย้าย) */
async function derive(password: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  /* `as BufferSource` เพราะชนิดของ Uint8Array ในโปรเจกต์นี้เป็น ArrayBufferLike (ไม่ใช่ ArrayBuffer เป๊ะ)
     ค่าที่ส่งเป็นไบต์ชุดเดียวกันทุกตัว ไม่ได้แปลงอะไร */
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' }, key, HASH_BITS)
  return b64(new Uint8Array(bits))
}

/** เทียบแบบใช้เวลาเท่ากัน — ห้าม return กลางทาง (return เร็ว = บอกว่าตรงไปกี่ตัว) */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ── ที่เก็บ ──────────────────────────────────────────────────────────────
   ⚠️ **ทางเก็บในเครื่องมีไว้ทดสอบบนเครื่องตัวเองเท่านั้น** (Blobs ใช้ในเครื่องไม่ได้
      ถ้าไม่มีคีย์ Netlify) และ **ต้องใช้บน Netlify ไม่ได้เด็ดขาด** — ถ้าเผลอไปทำงานบนของจริง
      ผู้ใช้จะหายทุกครั้งที่ฟังก์ชันถูกปั้นใหม่ แล้วคนที่เพิ่งเพิ่มจะเข้าไม่ได้แบบอธิบายไม่ถูก
      ⇒ มีด่านกันซ้อนสองชั้น: ต้องตั้ง env เอง **และ** ต้องไม่ได้รันบน Netlify */
const localDir = () => {
  const dir = (process.env.STAFF_USERS_LOCAL_DIR ?? '').trim()
  if (!dir) return null
  if (process.env.NETLIFY === 'true' || process.env.NETLIFY === '1') {
    throw new Error('STAFF_USERS_LOCAL_DIR ใช้บน Netlify ไม่ได้ — ที่เก็บในเครื่องมีไว้ทดสอบเท่านั้น')
  }
  return dir
}

async function readAll(): Promise<StaffUser[]> {
  const dir = localDir()
  if (dir) {
    const { readdir, readFile } = await import('node:fs/promises')
    /* 🔴 **อ่านที่เก็บไม่ได้ ≠ ไม่มีผู้ใช้** — ต้องโยนออกไปให้เส้นล็อกอินประกาศว่าใช้ทางถอย
       ยกเว้นกรณีเดียว: โฟลเดอร์ยังไม่ถูกสร้าง (ยังไม่เคยเพิ่มใครเลย) = ว่างจริง
       เดิมเขียน .catch(() => []) ซึ่งกลืนทุกความผิดพลาด ⇒ ที่เก็บล่มจะหน้าตาเหมือน
       "ยังไม่มีใคร" แล้วทางถอยจะถูกใช้เงียบ ๆ โดยไม่มีใครรู้ ([[fallbacks-must-announce]]) */
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (e: any) {
      if (e?.code === 'ENOENT') return []
      throw e
    }
    const out: StaffUser[] = []
    for (const f of names.filter((n) => n.endsWith('.json'))) {
      /* ไฟล์เสียก็โยนออกไปเหมือนกัน — บันทึกที่อ่านไม่ออกหนึ่งใบ แปลว่าเรายังไม่รู้ว่า
         รายชื่อครบหรือไม่ครบ ⇒ ห้ามข้ามเงียบแล้วตอบเหมือนรายชื่อสมบูรณ์ */
      out.push(JSON.parse(await readFile(`${dir}/${f}`, 'utf8')))
    }
    return out
  }
  const store = getStore({ name: STORE, consistency: 'strong' })
  const { blobs } = await store.list({ prefix: 'u/' })
  const out: StaffUser[] = []
  for (const b of blobs ?? []) {
    const v = (await store.get(b.key, { type: 'json' })) as StaffUser | null
    if (v?.id) out.push(v)
  }
  return out
}

async function writeOne(u: StaffUser): Promise<void> {
  const dir = localDir()
  if (dir) {
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
    await writeFile(`${dir}/${u.id}.json`, JSON.stringify(u), 'utf8')
    return
  }
  await getStore({ name: STORE, consistency: 'strong' }).setJSON(KEY(u.id), u)
}

async function deleteOne(id: string): Promise<void> {
  const dir = localDir()
  if (dir) {
    const { unlink } = await import('node:fs/promises')
    await unlink(`${dir}/${id}.json`).catch(() => {})
    return
  }
  await getStore({ name: STORE, consistency: 'strong' }).delete(KEY(id))
}

/* ── งานที่เส้น API เรียกใช้ ──────────────────────────────────────────── */

export async function listStaffUsers(): Promise<StaffUserPublic[]> {
  const all = await readAll()
  return all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(publicView)
}

export async function addStaffUser(name: string, password: string, now = new Date()): Promise<{ ok: true; user: StaffUserPublic } | { ok: false; error: string }> {
  const n = String(name ?? '').trim()
  const p = String(password ?? '')
  if (n.length < 2 || n.length > 40) return { ok: false, error: 'ชื่อต้องยาว 2–40 ตัวอักษร' }
  if (p.length < 6) return { ok: false, error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร' }
  const all = await readAll()
  if (all.length >= MAX_USERS) return { ok: false, error: `เพิ่มได้ไม่เกิน ${MAX_USERS} คน (ตอนล็อกอินต้องไล่เทียบทุกคน)` }
  if (all.some((u) => u.name.trim().toLowerCase() === n.toLowerCase())) return { ok: false, error: 'มีชื่อนี้อยู่แล้ว' }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const id = b64(crypto.getRandomValues(new Uint8Array(8)))
  const user: StaffUser = {
    id, name: n, active: true, createdAt: now.toISOString(),
    salt: b64(salt), hash: await derive(p, salt, ITER), iter: ITER,
  }
  await writeOne(user)
  // 🔴 คืนแค่ publicView — ห้ามคืน hash/salt และห้าม log รหัสที่รับมา
  return { ok: true, user: publicView(user) }
}

export async function setStaffUserActive(id: string, active: boolean): Promise<boolean> {
  const all = await readAll()
  const u = all.find((x) => x.id === id)
  if (!u) return false
  u.active = !!active
  await writeOne(u)
  return true
}

export async function removeStaffUser(id: string): Promise<boolean> {
  const all = await readAll()
  if (!all.some((x) => x.id === id)) return false
  await deleteOne(id)
  return true
}

/** หาคนที่รหัสตรง — **เฉพาะคนที่ยังเปิดใช้งาน**
 *  ⚠️ ไล่เทียบทุกคนแบบไม่ลัดวงจร เพื่อไม่ให้เวลาตอบบอกว่ามีชื่อนี้อยู่จริงไหม
 *  ⚠️ คนที่ถูกปิด **ไม่ผ่าน** และต้องไม่มีข้อความต่างจากรหัสผิด (ด่านอยู่ที่เส้นล็อกอิน) */
export async function findStaffUserByPassword(password: string): Promise<StaffUserPublic | null> {
  const p = String(password ?? '')
  if (!p) return null
  const all = await readAll()
  let found: StaffUser | null = null
  for (const u of all) {
    let ok = false
    try {
      ok = sameHash(await derive(p, unb64(u.salt), Number(u.iter) || ITER), u.hash)
    } catch { ok = false }
    if (ok && u.active && !found) found = u
  }
  return found ? publicView(found) : null
}
