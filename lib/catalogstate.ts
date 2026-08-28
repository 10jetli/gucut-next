// ─── เก็บสถานะหน้าคลังอะไหล่ (โรงงาน / การแก้ไข / หมวดหมู่) ไว้ที่ Google Drive ───────────────
// เดิมเก็บแค่ localStorage ของเบราว์เซอร์แต่ละเครื่อง ทำให้แต่ละเครื่องเห็นข้อมูลไม่ตรงกัน
// ย้ายมาเก็บไฟล์ JSON เดียวใน Drive โฟลเดอร์ "GUCUT catalog" ให้ทุกเครื่องอ่าน/เขียนที่เดียวกัน
import { findOrCreateFolder } from './drive'
import { getStore } from '@netlify/blobs'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'GUCUT catalog'
const FILE_NAME = 'catalog_state.json'

export interface CatalogState {
  ovr: Record<string, any>
  catMap: Record<string, string>
  catNew: string[]
  facs: { n: string; w?: string }[]
  updatedAt?: string
}

let folderId: string | null = null
async function getFolder(token: string): Promise<string> {
  if (folderId) return folderId
  folderId = await findOrCreateFolder(token, FOLDER_NAME)
  return folderId
}

async function findFile(token: string, folder: string): Promise<string | null> {
  const q = `'${folder}' in parents and name = '${FILE_NAME}' and trashed = false`
  const res = await fetch(`${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) return null
  return data.files?.[0]?.id ?? null
}

// อ่านสถานะปัจจุบัน คืน null ถ้ายังไม่เคยมีการบันทึก (เครื่องแรกที่เปิดหลังอัปเดต)
async function loadFromDrive(token: string): Promise<CatalogState | null> {
  try {
    const folder = await getFolder(token)
    const id = await findFile(token, folder)
    if (!id) return null
    const res = await fetch(`${DRIVE}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = await res.json()
    if (!j || typeof j !== 'object') return null
    return j as CatalogState
  } catch {
    return null
  }
}

// เขียนทับสถานะทั้งก้อน (ฝั่งหน้าเว็บส่งข้อมูลทั้งชุดมาเสมอ ไม่ patch บางส่วน)
async function saveToDrive(token: string, state: Omit<CatalogState, 'updatedAt'>): Promise<void> {
  const folder = await getFolder(token)
  const id = await findFile(token, folder)
  const body = JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  if (id) {
    await fetch(`${DRIVE_UPLOAD}/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  } else {
    const boundary = 'gucutcatalog' + Date.now()
    const metadata = JSON.stringify({ name: FILE_NAME, parents: [folder] })
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


// ─── เก็บที่ Netlify Blobs (ที่จริงแล้วเป็น primary — เจ้าของร้านสั่งเลิกเก็บ Google Drive 28 ส.ค. 2569) ───
// Drive functions ด้านบนเหลือไว้เพื่อ "ย้ายข้อมูลเดิมครั้งเดียว" เท่านั้น ไม่ใช่ที่เก็บหลักอีกต่อไป
const STORE = 'gucut-catalog'
const KEY = 'state'

export async function loadCatalogStateBlobs(): Promise<CatalogState | null> {
  try {
    const store = getStore(STORE)
    const j = (await store.get(KEY, { type: 'json' })) as CatalogState | null
    return j ?? null
  } catch {
    return null
  }
}

export async function saveCatalogStateBlobs(state: Omit<CatalogState, 'updatedAt'>): Promise<void> {
  const store = getStore(STORE)
  await store.setJSON(KEY, { ...state, updatedAt: new Date().toISOString() })
}

// อ่านสถานะ — Blobs ก่อน · ถ้ายังว่างลองย้ายจาก Drive มาครั้งเดียว (ข้อมูลเก่า 1,021 รายการไม่หาย)
export async function loadCatalogStateAny(): Promise<CatalogState | null> {
  const fromBlobs = await loadCatalogStateBlobs()
  if (fromBlobs) return fromBlobs
  // migrate จาก Drive ครั้งเดียว — ถ้า OAuth ยังตั้งอยู่
  try {
    const { getAccessToken } = await import('./gmail')
    const token = await getAccessToken()
    const fromDrive = await loadFromDrive(token)
    if (fromDrive) {
      await saveCatalogStateBlobs(fromDrive)
      return fromDrive
    }
  } catch {}
  return null
}
