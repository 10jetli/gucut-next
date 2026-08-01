// ─── สำรองไฟล์บิลขึ้น Google Drive ──────────────────────────────────────────
// ใช้ token เดียวกับ Gmail (ต้องมี scope https://www.googleapis.com/auth/drive.file เพิ่ม
// นอกเหนือจาก gmail.readonly — ดู /api/google/auth) scope นี้ให้แอปเห็น/แก้ไขได้เฉพาะไฟล์
// ที่แอปสร้างเอง ไม่แตะไฟล์อื่นในไดรฟ์ผู้ใช้ทั้งหมด
// โครงสร้างที่สร้าง: "บิล GUCUT" (โฟลเดอร์หลัก) > <ชื่อเจ้า> (โฟลเดอร์ย่อย) > ไฟล์บิล
const DRIVE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

export const DRIVE_ROOT_FOLDER_NAME = 'บิล GUCUT'

// ชื่อโฟลเดอร์ย่อยต่อเจ้า (ให้ตรงกับที่ตั้งไว้ตอนสร้างครั้งแรก)
export const VENDOR_FOLDER_NAME: Record<string, string> = {
  tiktok: 'TikTok Ads',
  meta: 'Facebook-Meta Ads',
  google: 'Google Ads',
  shopify: 'www (Shopify)',
  line: 'LINE',
  adobe: 'Adobe',
  apple: 'Apple-iCloud',
  omise: 'Omise',
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function driveGet(token: string, path: string) {
  const res = await fetch(`${DRIVE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

// หาโฟลเดอร์ตามชื่อใต้ parent (เฉพาะที่แอปนี้สร้างเอง — ตาม scope drive.file) ถ้าไม่เจอให้สร้างใหม่
export async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : ''
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${esc(name)}' and trashed = false${parentClause}`
  const found = await driveGet(token, `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`)
  if (found.files?.length) return found.files[0].id

  const res = await fetch(`${DRIVE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`สร้างโฟลเดอร์ Drive ไม่สำเร็จ: ${JSON.stringify(data).slice(0, 300)}`)
  return data.id
}

// cache กันเรียกซ้ำหลายครั้งในการสแกนรอบเดียวกัน (อยู่แค่ระดับ process เดียว ไม่ persist ข้ามคำขอ)
const folderCache = new Map<string, string>()

export async function getVendorDriveFolder(token: string, vendorId: string): Promise<string> {
  const cacheKey = `v:${vendorId}`
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!

  let rootId = folderCache.get('root')
  if (!rootId) {
    rootId = await findOrCreateFolder(token, DRIVE_ROOT_FOLDER_NAME)
    folderCache.set('root', rootId)
  }
  const vendorFolderName = VENDOR_FOLDER_NAME[vendorId] ?? vendorId
  const folderId = await findOrCreateFolder(token, vendorFolderName, rootId)
  folderCache.set(cacheKey, folderId)
  return folderId
}

// เช็คว่ามีไฟล์ชื่อนี้ในโฟลเดอร์แล้วหรือยัง (กันอัปโหลดซ้ำตอนสแกนซ้ำเดือนเดิม)
export async function driveFileExists(token: string, folderId: string, filename: string): Promise<boolean> {
  const q = `'${folderId}' in parents and name = '${esc(filename)}' and trashed = false`
  const found = await driveGet(token, `/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`)
  return !!found.files?.length
}

export async function uploadToDrive(token: string, folderId: string, filename: string, mimeType: string, bytes: Buffer) {
  const boundary = 'gucutdrive' + Date.now()
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf-8'),
    bytes,
    Buffer.from(`\r\n--${boundary}--`, 'utf-8'),
  ])
  const res = await fetch(DRIVE_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: body as any,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`อัปโหลด Drive ไม่สำเร็จ ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

// อัปโหลดไฟล์บิล 1 ไฟล์ขึ้น Drive โฟลเดอร์ของเจ้านั้น (ข้ามถ้ามีไฟล์ชื่อนี้อยู่แล้ว)
// คืนค่า true ถ้าอัปโหลดจริง, false ถ้าข้าม (มีอยู่แล้ว)
export async function syncBillToDrive(
  token: string, vendorId: string, filename: string, mimeType: string, bytes: Buffer,
): Promise<boolean> {
  const folderId = await getVendorDriveFolder(token, vendorId)
  const exists = await driveFileExists(token, folderId, filename)
  if (exists) return false
  await uploadToDrive(token, folderId, filename, mimeType, bytes)
  return true
}

// ── ไฟล์บิล "ตัวจริง" ที่อัปโหลดผ่าน /api/bills/upload ─────────────────────────
// ตั้งชื่อไฟล์ตามแบบ YYYY-MM_REAL_<ชื่อไฟล์>.pdf เพื่อให้หน้าบิลรายเจ้าแยกออกจากไฟล์สำรองอีเมล

export interface DriveBillFile {
  id: string
  name: string
  size: number
}

// ดูรายชื่อไฟล์ทั้งหมดในโฟลเดอร์บิลของเจ้านั้น
export async function listVendorDriveFiles(token: string, vendorId: string): Promise<DriveBillFile[]> {
  const folderId = await getVendorDriveFolder(token, vendorId)
  const q = `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`
  const found = await driveGet(token, `/files?q=${encodeURIComponent(q)}&fields=files(id,name,size)&pageSize=200&spaces=drive`)
  return (found.files ?? []).map((f: any) => ({ id: f.id, name: f.name, size: Number(f.size ?? 0) }))
}

// ดาวน์โหลดเนื้อไฟล์จาก Drive ตาม fileId
export async function downloadDriveFile(token: string, fileId: string): Promise<Buffer> {
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`โหลดไฟล์ Drive ไม่สำเร็จ ${res.status}: ${t.slice(0, 300)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
