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
}
export interface BillIndex {
  lastScan: string
  done: string[]
  entries: BillEntry[]
}

const STORE = 'gucut-bills'
const fkey = (vendorId: string, filename: string) => `f/${vendorId}/${filename}`

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
export async function syncBillToBlobs(
  vendorId: string, filename: string, mimeType: string, bytes: Buffer,
): Promise<boolean> {
  if (await blobFileExists(vendorId, filename)) return false
  await uploadBillToBlobs(vendorId, filename, mimeType, bytes)
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
