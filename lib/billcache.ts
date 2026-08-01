// ─── Cache ผลสแกนบิลของแต่ละเจ้า เก็บเป็นไฟล์ JSON ใน Google Drive ─────────────
// เก็บในโฟลเดอร์ "บิล GUCUT/_cache" เป็นไฟล์ bills_<vendor>.json
// ทำให้หน้า /bills/<vendor> ไม่ต้องสแกน Gmail + อ่าน PDF ใหม่ทั้งหมดทุกครั้ง
// เปิดครั้งถัดไปอ่าน cache แล้วสแกนเพิ่มเฉพาะอีเมลใหม่ไม่กี่วันล่าสุด → เร็วขึ้นมาก
import { findOrCreateFolder } from './drive'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export interface BillEntry {
  month: string
  filename: string
  messageId: string
  attachmentId: string
  size: number
  subject: string
}

export interface BillIndex {
  lastScan: string   // ISO เวลาที่สแกนล่าสุด
  done: string[]     // messageId ที่ประมวลผลแล้ว (กันทำซ้ำ)
  entries: BillEntry[]
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let cacheFolderId: string | null = null
async function getCacheFolder(token: string): Promise<string> {
  if (cacheFolderId) return cacheFolderId
  const rootId = await findOrCreateFolder(token, 'บิล GUCUT')
  cacheFolderId = await findOrCreateFolder(token, '_cache', rootId)
  return cacheFolderId
}

async function findFile(token: string, folderId: string, name: string): Promise<string | null> {
  const q = `'${folderId}' in parents and name = '${esc(name)}' and trashed = false`
  const res = await fetch(`${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) return null
  return data.files?.[0]?.id ?? null
}

export async function loadBillIndex(token: string, vendorId: string): Promise<BillIndex | null> {
  try {
    const folder = await getCacheFolder(token)
    const id = await findFile(token, folder, `bills_${vendorId}.json`)
    if (!id) return null
    const res = await fetch(`${DRIVE}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const idx = await res.json()
    if (!idx || !Array.isArray(idx.entries) || !idx.lastScan) return null
    return idx as BillIndex
  } catch {
    return null
  }
}

export async function saveBillIndex(token: string, vendorId: string, idx: BillIndex): Promise<void> {
  const folder = await getCacheFolder(token)
  const name = `bills_${vendorId}.json`
  const id = await findFile(token, folder, name)
  const body = JSON.stringify(idx)
  if (id) {
    await fetch(`${DRIVE_UPLOAD}/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  } else {
    const boundary = 'gucutcache' + Date.now()
    const metadata = JSON.stringify({ name, parents: [folder] })
    const mp =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
    await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: mp,
    })
  }
}
