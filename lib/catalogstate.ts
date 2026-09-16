import { getStore } from '@netlify/blobs'

export interface CatalogState {
  ovr: Record<string, any>
  catMap: Record<string, string>
  catNew: string[]
  facs: { n: string; w?: string }[]
  /** หมวดที่ทำเสร็จแล้ว — โชว์เขียว+ติ๊กถูกในเมนูหมวด (1 ก.ย. 2569) */
  catDone?: string[]
  /** ➕ รหัสที่พิมพ์เพิ่มเองในหน้าคลังอะไหล่ (ท่านประธานสั่ง 16 ก.ย. 2569)
   *  แยกจาก ovr/catMap สนิท — ข้อมูลจาก Shopify ไม่ถูกแตะ
   *  ต้องอยู่ใน SHARED_KEYS ของ public/catalog/sync.js ด้วย ไม่งั้นเครื่องอื่นไม่เห็น */
  added?: { sku: string; name?: string; nameEn?: string; oem?: string; hh?: string;
            price?: number; category?: string; at?: string }[]
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
