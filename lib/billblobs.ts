// ─── เก็บไฟล์บิล + แคชผลสแกน ที่ Netlify Blobs (แทน Google Drive) ────────────
// เจ้าของร้านสั่งเลิกเก็บ Google Drive ทุกกรณี (29 ส.ค. 2569)
// Gmail ยังเป็นแหล่งบิลต้นทางเหมือนเดิม — ย้ายเฉพาะ"ที่เก็บถาวร" จาก Drive มา Blobs
//
// key scheme (แทนโครงโฟลเดอร์ไทยของ Drive ที่ผูก URL ยาก):
//   f/<vendorId>/<filename>        ไฟล์บิล (binary) — ชื่อไฟล์คงรูปแบบเดิมเป๊ะ
//                                  (…_REAL_… marker ที่ vendor route ใช้ regex แยกต้องไม่เพี้ยน)
//   c/<vendorId>                   แคช index JSON ผลสแกน (แทน bills_<vendor>.json)
import { getStore } from '@netlify/blobs'

export interface BillEntry {
  month: string
  filename: string
  messageId: string
  attachmentId: string
  size: number
  subject: string
  /** เลขที่เอกสารที่อ่านมาจาก **เนื้อใน PDF** (เพิ่ม 16 ก.ย. 2569 · ใบ t_mu3g8tq5)
   *  🔴 เดิมตัวคัดซ้ำบนจออ่านเลขจาก **ชื่อไฟล์** ด้วย regex 4 แบบ (THTT · FBADS · IN- · INV)
   *     ⇒ เจ้าที่ตั้งชื่อไฟล์คนละแบบ (Adobe) **ไม่เคยถูกคัดซ้ำเลย** ⇒ จอโชว์ 3 ไฟล์ว่าเป็น 3 ใบ
   *  ⚠️ ของเก่าในแคชไม่มีช่องนี้ (undefined) ⇒ ตัวคัดซ้ำต้องถอยไปใช้ชื่อไฟล์เหมือนเดิม ห้ามพัง */
  invoiceNo?: string | null
  /** รอบบิลที่พิมพ์ในเอกสาร (YYYY-MM) — ใช้อธิบายว่าเดือนที่จัดมาจากไหน */
  period?: string | null
}
export interface BillIndex {
  lastScan: string          // สแกน Gmail ครั้งล่าสุด (เขียนทุกรอบ แม้ไม่เจอของใหม่)
  /** เจอบิลใหม่ครั้งล่าสุด — คนละความหมายกับ lastScan **ห้ามเอามาใช้แทนกัน**
   *  (15 ก.ย. 2569: เคยใช้ lastScan สื่อสองความหมาย แล้วจอขึ้นว่า "เงียบมา 44 วัน" ผิด) */
  lastNew?: string | null
  done: string[]
  entries: BillEntry[]
}

const STORE = 'gucut-bills'
const fkey = (vendorId: string, filename: string) => `f/${vendorId}/${filename}`
/** ทะเบียน "ตัวตนของใบ → ชื่อไฟล์ที่เก็บไว้แล้ว" (เพิ่ม 16 ก.ย. 2569 · ใบ t_mu3g8tq5)
 *  🔴 เหตุ: ท่านประธานจับได้เองว่าบิล Adobe ซ้ำ — ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน
 *     ต้นเหตุคือกันซ้ำด้วย **ชื่อไฟล์** ⇒ ใบเดิมที่มาในชื่อใหม่ผ่านด่านทุกครั้ง
 *  ⚠️ encode กันอักขระ `/` ในเลขที่เอกสาร (เช่น INV/2026/08) ไปตัดคีย์เป็นชั้น ๆ */
const idkey = (vendorId: string, identity: string) => `i/${vendorId}/${encodeURIComponent(identity)}`

export interface BlobBillFile {
  id: string // = key ในรูป BLOB:<key> ให้ file route เปิดได้
  name: string
  size: number
}

// ── ไฟล์บิล ──────────────────────────────────────────────────────────────
export async function blobFileExists(vendorId: string, filename: string): Promise<boolean> {
  const store = getStore(STORE)
  const meta = await store.getMetadata(fkey(vendorId, filename)).catch(() => null)
  return !!meta
}

export async function uploadBillToBlobs(
  vendorId: string, filename: string, mimeType: string, bytes: Buffer | ArrayBuffer,
): Promise<void> {
  const store = getStore(STORE)
  const body = bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes).buffer.slice(
    (bytes as Buffer).byteOffset, (bytes as Buffer).byteOffset + (bytes as Buffer).byteLength,
  )
  const size = bytes instanceof ArrayBuffer ? bytes.byteLength : (bytes as Buffer).byteLength
  await store.set(fkey(vendorId, filename), body as ArrayBuffer, {
    metadata: { contentType: mimeType || 'application/pdf', size },
  })
}

// อัปโหลด 1 ไฟล์ (ข้ามถ้ามีชื่อนี้แล้ว) — คืน true ถ้าเขียนจริง, false ถ้าข้าม
// ⚠️ **ตัวนี้กันซ้ำได้แค่ชื่อไฟล์** ⇒ ใบเดียวกันที่มาในชื่อต่างกันจะเข้าถังซ้ำ (บั๊กที่ท่านประธานจับได้ 16 ก.ย. 2569)
//    ของใหม่ให้ใช้ `syncBillByIdentity()` แทน · ตัวนี้เก็บไว้ให้จออัปโหลดมือที่คนเลือกไฟล์เองใช้
export async function syncBillToBlobs(
  vendorId: string, filename: string, mimeType: string, bytes: Buffer,
): Promise<boolean> {
  if (await blobFileExists(vendorId, filename)) return false
  await uploadBillToBlobs(vendorId, filename, mimeType, bytes)
  return true
}

// ── ตัวตนของใบ (กันซ้ำแบบไม่พึ่งชื่อไฟล์) ───────────────────────────────
/** ใบนี้เคยเก็บไว้แล้วหรือยัง — คืน **ชื่อไฟล์เดิม** ถ้าเคย · null ถ้าไม่เคย */
export async function findBillByIdentity(vendorId: string, identity: string): Promise<string | null> {
  if (!identity) return null
  const store = getStore(STORE)
  const v = await store.get(idkey(vendorId, identity), { type: 'text' }).catch(() => null)
  const name = String(v ?? '').trim()
  return name || null
}

export async function rememberBillIdentity(vendorId: string, identity: string, filename: string): Promise<void> {
  if (!identity) return
  const store = getStore(STORE)
  await store.set(idkey(vendorId, identity), filename)
}

export type BillWriteResult = {
  written: boolean
  /** เหตุผลเป็นข้อความไทยที่เอาไปโชว์ได้ตรง ๆ — ห้ามคืนแค่ true/false เพราะสามเหตุผลนี้คนละเรื่อง */
  reason: 'เขียนใหม่' | 'มีไฟล์ชื่อนี้อยู่แล้ว' | 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น' | 'เขียนใหม่ (ยังตัดสินไม่ได้ว่าซ้ำ)'
  /** ไปซ้ำกับไฟล์ไหน (เฉพาะกรณีซ้ำด้วยตัวตน) */
  sameAs?: string
}

/** เขียนบิล 1 ใบ โดยกันซ้ำ **ด้วยตัวตนของใบ** ก่อน แล้วค่อยกันด้วยชื่อไฟล์
 *  @param identity กุญแจจาก `billIdentity()` · ส่ง null ได้ถ้าอ่านตัวตนไม่ได้
 *  🔴 identity = null **ห้ามแปลว่า "ไม่ซ้ำ"** ⇒ ยังเก็บไฟล์ (ทิ้งบิลจริงเสียหายกว่า)
 *     แต่คืนเหตุผลว่า "ยังตัดสินไม่ได้" เพื่อให้ตัวเรียกไปนับใส่ needsHumanCheck */
export async function syncBillByIdentity(
  vendorId: string, filename: string, mimeType: string, bytes: Buffer, identity: string | null,
): Promise<BillWriteResult> {
  if (identity) {
    const already = await findBillByIdentity(vendorId, identity)
    if (already) return { written: false, reason: 'ใบนี้มีอยู่แล้วในชื่อไฟล์อื่น', sameAs: already }
  }
  if (await blobFileExists(vendorId, filename)) {
    /* ชื่อซ้ำแต่ทะเบียนตัวตนยังไม่มี = ไฟล์เก่าที่เก็บก่อนมีทะเบียน ⇒ ลงทะเบียนย้อนหลังให้ */
    if (identity) await rememberBillIdentity(vendorId, identity, filename)
    return { written: false, reason: 'มีไฟล์ชื่อนี้อยู่แล้ว' }
  }
  await uploadBillToBlobs(vendorId, filename, mimeType, bytes)
  if (identity) {
    await rememberBillIdentity(vendorId, identity, filename)
    return { written: true, reason: 'เขียนใหม่' }
  }
  return { written: true, reason: 'เขียนใหม่ (ยังตัดสินไม่ได้ว่าซ้ำ)' }
}

// ลบไฟล์บิล 1 ใบ — **ต้องระบุชื่อเต็มเป๊ะ ไม่มี wildcard ไม่มีลบเป็นชุด**
// 🔴 มีไว้แก้ใบที่ถูกอัปเข้ามาผิด (เช่น ชื่อไฟล์คนละแบบจนกลายเป็นใบซ้ำ) เท่านั้น
//    บิลคือเอกสารบัญชี — ลบแล้วไม่มีถังขยะให้กู้ ⇒ คืน false ถ้าไม่มีไฟล์ชื่อนั้น
//    เพื่อให้คนเรียกแยก "ลบแล้ว" ออกจาก "ไม่เคยมี" ได้ ห้ามคืน true ลอย ๆ
export async function deleteBillBlob(vendorId: string, filename: string): Promise<boolean> {
  const store = getStore(STORE)
  if (!(await blobFileExists(vendorId, filename))) return false
  await store.delete(fkey(vendorId, filename))
  return true
}

// list ไฟล์ทั้งหมดของ vendor — คืน size จาก metadata (ต่อเจ้ามีไม่กี่สิบไฟล์ getMetadata ไหว)
export async function listVendorBlobFiles(vendorId: string): Promise<BlobBillFile[]> {
  const store = getStore(STORE)
  const prefix = `f/${vendorId}/`
  const { blobs } = await store.list({ prefix }).catch(() => ({ blobs: [] as { key: string }[] }))
  const out = await Promise.all(
    (blobs || []).map(async (b) => {
      const meta = await store.getMetadata(b.key).catch(() => null)
      const name = b.key.slice(prefix.length)
      return { id: `BLOB:${b.key}`, name, size: Number((meta?.metadata as any)?.size ?? 0) }
    }),
  )
  return out
}

/** รายชื่อไฟล์อย่างเดียว — **ไม่ขอ metadata ทีละไฟล์**
 *  🔴 15 ก.ย. 2569: หน้า /bills ใช้เวลา 8.9 วินาทีกว่าจะขึ้นสถานะ
 *     เพราะ listVendorBlobFiles ยิง getMetadata ทีละไฟล์เพื่อเอา "ขนาด"
 *     TikTok มี 118 ไฟล์ × 12 เจ้า = คำขอเป็นร้อย ไปที่ Blobs ซึ่งอยู่ us-east-1
 *     ⇒ จอที่ไม่ได้ใช้ขนาดไฟล์ ไม่ควรจ่ายค่านั้น
 *  ⚠️ ต้องการขนาดไฟล์ด้วย ให้ใช้ listVendorBlobFiles ตามเดิม */
export async function listVendorBlobNames(vendorId: string): Promise<string[]> {
  const store = getStore(STORE)
  const prefix = `f/${vendorId}/`
  const { blobs } = await store.list({ prefix }).catch(() => ({ blobs: [] as { key: string }[] }))
  return (blobs || []).map(b => b.key.slice(prefix.length))
}

export async function downloadBlobFile(key: string): Promise<Buffer | null> {
  const store = getStore(STORE)
  const ab = (await store.get(key, { type: 'arrayBuffer' }).catch(() => null)) as ArrayBuffer | null
  return ab ? Buffer.from(ab) : null
}

// ── แคช index JSON (แทน billcache.ts) ────────────────────────────────────
export async function loadBillIndexBlobs(vendorId: string): Promise<BillIndex | null> {
  try {
    const store = getStore(STORE)
    const idx = (await store.get(`c/${vendorId}`, { type: 'json' })) as BillIndex | null
    if (!idx || !Array.isArray(idx.entries) || !idx.lastScan) return null
    return idx
  } catch {
    return null
  }
}

export async function saveBillIndexBlobs(vendorId: string, idx: BillIndex): Promise<void> {
  const store = getStore(STORE)
  await store.setJSON(`c/${vendorId}`, idx)
}
