// ── คุกกี้ของพนักงานที่เพิ่มจากหน้าเว็บ — โทเคนเซ็นชื่อ ตรวจได้โดยไม่ต้องอ่านฐาน ───────
//
// ทำไมต้องมีของใหม่ แทนที่จะใช้ท่าเดิม (lib/auth-token.ts):
//   ท่าเดิมคุกกี้ = **ลายนิ้วมือของรหัสผ่าน** แล้ว middleware เอารหัสทุกตัวใน env มาแฮชเทียบ
//   ⇒ ใช้ได้เฉพาะกับรหัสที่ **middleware อ่านค่าดิบได้** คือใน env เท่านั้น
//   แต่รหัสของผู้ใช้ที่เพิ่มจากหน้าเว็บ **เก็บเป็นค่าที่ย้อนกลับไม่ได้** (ตามคำสั่งข้อ 2)
//   ⇒ middleware จึงไม่มีทางแฮชเทียบได้เลย ต้องเปลี่ยนชนิดของคุกกี้สำหรับคนกลุ่มนี้
//
// 🔴 **ทำไมไม่ให้ middleware อ่าน Blobs แทน** — middleware รันบน edge runtime
//    การ import ของที่ edge ใช้ไม่ได้ = **ทั้งเว็บ 500 ทุกหน้าตั้งแต่คำขอแรก**
//    (บทเรียนจริงจาก edge function ตัวจับบอต: ห้าม import ไว้หัวไฟล์) และเรา
//    **ยืนยันบนของจริงไม่ได้จนถึงรอบ deploy คืนนี้** ⇒ ไม่เอาความเสี่ยงนั้นมาแลกกับงานนี้
//    ⇒ โทเคนเซ็นชื่อ: middleware ตรวจลายเซ็นด้วย Web Crypto เฉย ๆ ไม่ต้องอ่านอะไรเลย
//
// ⚠️ **กุญแจมาจาก SITE_PASSWORD ที่มีอยู่แล้ว ไม่เพิ่ม env ใหม่** — เพราะการเพิ่ม env
//    ต้องไปตั้งที่ Netlify แล้ว deploy ซึ่งคือสิ่งที่งานนี้มีไว้กำจัด (ข้อ 1 ของเกณฑ์ผ่าน)
//    ⇒ ผลข้างเคียงที่ต้องรู้: **เปลี่ยน SITE_PASSWORD = โทเคนพนักงานทุกใบใช้ไม่ได้ทันที**
//       (ต้องล็อกอินใหม่ครั้งเดียว) — ยอมรับได้ และดีกว่าผูกกับความลับที่ยังไม่มี
//
// ⚠️ **ห้าม import node:crypto ในไฟล์นี้** — middleware เรียกไฟล์นี้ (edge runtime)
//    ใช้ Web Crypto เท่านั้น (กติกาเดียวกับ lib/auth-token.ts)
//
// ⏳ **ข้อจำกัดที่ต้องรู้ และยังไม่แก้ในงานนี้**: ปิดผู้ใช้แล้ว **คนที่ล็อกอินค้างอยู่**
//    จะยังเข้าได้จนโทเคนหมดอายุ (ดู TTL ข้างล่าง) เพราะ middleware ไม่ได้อ่านฐาน
//    การล็อกอิน**ครั้งใหม่**ถูกปิดทันที · ทางแก้ให้ "ทันที" จริงมีสองทาง เขียนไว้ที่
//    app/api/staff-users/route.ts — ต้องให้ CEO เลือกก่อน ไม่ตัดสินเอง
const PREFIX = 'gs1.'
const KEY_INFO = 'gucut-staff-token-v1:'
/** อายุโทเคน — สั้นลง = ปิดผู้ใช้มีผลเร็วขึ้น แต่พนักงานต้องพิมพ์รหัสใหม่บ่อยขึ้น */
export const STAFF_TOKEN_TTL_SEC = 8 * 60 * 60

/* ⚠️ ห้าม spread Uint8Array — target ของโปรเจกต์นี้ทำไม่ได้ (TS2802) ใช้ Array.from เหมือน lib/auth-token.ts */
const b64url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes).map((b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
}

async function hmacKey(secret: string) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY_INFO + secret))
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export interface StaffClaims {
  /** รหัสผู้ใช้ในฐาน (ไม่ใช่ชื่อ — ชื่อเปลี่ยนได้) */
  u: string
  /** ชื่อที่โชว์ (ใส่ไว้เพื่อไม่ต้องอ่านฐานตอนแสดงผล) */
  n: string
  /** หมดอายุเมื่อไหร่ (วินาที epoch) */
  exp: number
}

/** ออกโทเคน — เรียกได้จากเส้นล็อกอินเท่านั้น (ฝั่ง Node) */
export async function signStaffToken(claims: Omit<StaffClaims, 'exp'>, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const payload: StaffClaims = { ...claims, exp: nowSec + STAFF_TOKEN_TTL_SEC }
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(body))
  return `${PREFIX}${body}.${b64url(new Uint8Array(sig))}`
}

/** คุกกี้นี้เป็นโทเคนแบบใหม่หรือเปล่า — ใช้แยกจากคุกกี้ท่าเดิม (เลขฐานสิบหก 64 ตัว ไม่มีจุด)
 *  🔴 **ต้องแยกให้ขาด** เพราะของเดิมต้องทำงานเหมือนเดิมทุกคน (คำสั่งข้อ 1) */
export const isStaffToken = (v: string | undefined) => !!v && v.startsWith(PREFIX)

/** ตรวจลายเซ็น + วันหมดอายุ — คืน claims ถ้าผ่าน, null ถ้าไม่ผ่าน
 *  ⚠️ ไม่แยกสาเหตุกลับไป (ลายเซ็นผิด / หมดอายุ / รูปแบบเพี้ยน) — ผู้เรียกไม่ต้องรู้
 *     และห้ามเอาไปเขียนบนจอให้คนเดาว่าใกล้ถูกแล้วหรือยัง */
export async function verifyStaffToken(token: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<StaffClaims | null> {
  if (!isStaffToken(token) || !secret) return null
  const parts = token!.slice(PREFIX.length).split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  try {
    const okSig = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), new TextEncoder().encode(body))
    if (!okSig) return null
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as StaffClaims
    if (!claims?.u || typeof claims.exp !== 'number' || claims.exp <= nowSec) return null
    return claims
  } catch {
    return null
  }
}
