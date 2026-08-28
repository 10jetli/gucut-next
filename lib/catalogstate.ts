import { getStore } from '@netlify/blobs'

export interface CatalogState {
  ovr: Record<string, any>
  catMap: Record<string, string>
  catNew: string[]
  facs: { n: string; w?: string }[]
  updatedAt?: string
}

// เก็บสถานะหน้าคลังอะไหล่ที่ Netlify Blobs (เลิกใช้ Google Drive — เจ้าของร้านสั่ง 29 ส.ค. 2569)
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
