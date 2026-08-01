// ─── เก็บสถานะหน้าคลังอะไหล่ (โรงงาน / การแก้ไข / หมวดหมู่) ไว้ที่ Google Drive ───────────────
// เดิมเก็บแค่ localStorage ของเบราว์เซอร์แต่ละเครื่อง ทำให้แต่ละเครื่องเห็นข้อมูลไม่ตรงกัน
// ย้ายมาเก็บไฟล์ JSON เดียวใน Drive โฟลเดอร์ "GUCUT catalog" ให้ทุกเครื่องอ่าน/เขียนที่เดียวกัน
import { findOrCreateFolder } from './drive'

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
export async function loadCatalogState(token: string): Promise<CatalogState | null> {
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
export async function saveCatalogState(token: string, state: Omit<CatalogState, 'updatedAt'>): Promise<void> {
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
