import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'

export interface CatalogState {
  ovr: Record<string, any>
  catMap: Record<string, string>
  catNew: string[]
  facs: { n: string; w?: string }[]
  /** หมวดที่ทำเสร็จแล้ว — โชว์เขียว+ติ๊กถูกในเมนูหมวด (1 ก.ย. 2569) */
  catDone?: string[]
  /** ➕ รายการรหัสที่ผู้ใช้เลือกไว้ดูพร้อมกัน (ท่านประธานสั่ง 16 ก.ย. 2569)
   *  ต้องอยู่ใน SHARED_KEYS ของ public/catalog/sync.js ด้วย — ไม่งั้นเลือกบน iPad
   *  แล้วเครื่องอื่นไม่เห็น ทั้งที่ท้ายหน้าเขียนว่า "เห็นตรงกันทุกเครื่อง" */
  picked?: string[]
  /** ➕ รหัสที่ร้านมีจริงแต่ไม่มีใน Shopify (ท่านประธานสั่ง 16 ก.ย. 2569 กรณี 00531)
   *  แยกจาก ovr/catMap สนิท — ข้อมูล Shopify ไม่ถูกแตะ
   *  ต้องอยู่ใน SHARED_KEYS ของ public/catalog/sync.js ด้วย */
  added?: { sku: string; name?: string; nameEn?: string; oem?: string; hh?: string;
            cn?: string; model?: string; price?: number; at?: string }[]
  updatedAt?: string
}

export type CatalogStateInput = Omit<CatalogState, 'updatedAt'>

export interface CatalogSnapshot {
  version: 1
  id: string
  createdAt: string
  skuCount: number
  reason: string
  state: CatalogState
}

export interface CatalogSnapshotSummary {
  id: string
  createdAt: string
  skuCount: number
  reason: string
}

type CatalogStore = {
  get(key: string, options: { type: 'json' }): Promise<any>
  setJSON(key: string, value: unknown): Promise<void>
  list(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>
  delete(key: string): Promise<void>
}

type CatalogStateErrorCode =
  | 'READ_FAILED'
  | 'TOO_FEW_SKUS'
  | 'BACKUP_FAILED'
  | 'WRITE_FAILED'
  | 'SNAPSHOT_NOT_FOUND'
  | 'INVALID_SNAPSHOT'
  | 'INVALID_SNAPSHOT_ID'

export class CatalogStateError extends Error {
  constructor(
    public readonly code: CatalogStateErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'CatalogStateError'
  }
}

// เก็บสถานะหน้า /catalog ที่ Netlify Blobs (เลิกใช้ Google Drive — เจ้าของร้านสั่ง 29 ส.ค. 2569)
const STORE = 'gucut-catalog'
const KEY = 'state'
const SNAPSHOT_PREFIX = 'state-snapshots/'
const KEEP_SNAPSHOTS = 30

/** ใช้ strong consistency กับเส้นเขียน/กู้คืน — อ่านค่าก่อนหน้าเก่าแล้วสำรองผิดรุ่น = ตาข่ายปลอม */
const store = (): CatalogStore => getStore({ name: STORE, consistency: 'strong' }) as unknown as CatalogStore

export const countCatalogStateSkus = (state: Pick<CatalogState, 'ovr'> | null): number =>
  state?.ovr && typeof state.ovr === 'object' && !Array.isArray(state.ovr)
    ? Object.keys(state.ovr).length
    : 0

const stateWithoutUpdatedAt = (state: CatalogState): CatalogStateInput => {
  const { updatedAt: _updatedAt, ...rest } = state
  return rest
}

const snapshotKey = (id: string): string => `${SNAPSHOT_PREFIX}${id}`

const validSnapshotId = (id: string): boolean => /^[A-Za-z0-9._-]+$/.test(id)

/** อ่านแบบ strict สำหรับทุกทางที่กำลังจะเขียน: อ่านล้ม ≠ ยังไม่มีข้อมูล */
async function loadStrict(s: CatalogStore): Promise<CatalogState | null> {
  try {
    const value = (await s.get(KEY, { type: 'json' })) as CatalogState | null
    if (value !== null && (!value.ovr || typeof value.ovr !== 'object' || Array.isArray(value.ovr))) {
      throw new Error('state เดิมไม่มี ovr object ที่อ่านได้')
    }
    return value
  } catch (error) {
    throw new CatalogStateError(
      'READ_FAILED',
      `อ่านสถานะเดิมไม่ได้ — ยังไม่ได้เขียนอะไร: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export async function loadCatalogStateBlobsStrict(): Promise<CatalogState | null> {
  return loadStrict(store())
}

/** ทางอ่านเดิมยังคืน null เพื่อไม่เปลี่ยนสัญญาของผู้เรียกเก่า; ทางเขียนห้ามใช้ฟังก์ชันนี้ */
export async function loadCatalogStateBlobs(): Promise<CatalogState | null> {
  try {
    return await loadStrict(store())
  } catch {
    return null
  }
}

function assertNotDangerouslySmaller(current: CatalogState | null, next: CatalogStateInput): void {
  const oldCount = countCatalogStateSkus(current)
  const nextCount = countCatalogStateSkus(next)
  // "เกิน 20%" = ต่ำกว่า 80% อย่างเคร่งครัด; ลดพอดี 20% ยังผ่านตามถ้อยคำของใบงาน
  if (oldCount > 0 && nextCount * 100 < oldCount * 80) {
    throw new CatalogStateError(
      'TOO_FEW_SKUS',
      `ปฏิเสธการเขียน: ของเดิม ${oldCount} SKU แต่ก้อนใหม่มี ${nextCount} SKU (ลดลงเกิน 20%)`,
      { oldSkuCount: oldCount, newSkuCount: nextCount },
    )
  }
}

async function trimSnapshots(s: CatalogStore): Promise<void> {
  const { blobs } = await s.list({ prefix: SNAPSHOT_PREFIX })
  const oldKeys = blobs.map((b) => b.key).sort().reverse().slice(KEEP_SNAPSHOTS)
  await Promise.all(oldKeys.map((key) => s.delete(key)))
}

/**
 * เปลี่ยน state แบบย้อนกลับได้ ใช้ store จำลองในเทสได้โดยไม่แตะข้อมูลจริง
 * ลำดับจงใจตายตัว: อ่านเดิม → กันก้อนขาด → สำรอง → ตัดของเก่า → เขียนก้อนใหม่
 */
export async function replaceCatalogState(
  s: CatalogStore,
  next: CatalogStateInput,
  options: {
    reason?: string
    enforceShrinkGuard?: boolean
    now?: () => Date
    makeId?: () => string
  } = {},
): Promise<{ updatedAt: string; skuCount: number; backup: CatalogSnapshotSummary | null }> {
  const current = await loadStrict(s)
  if (options.enforceShrinkGuard !== false) assertNotDangerouslySmaller(current, next)

  const now = options.now ?? (() => new Date())
  let backup: CatalogSnapshotSummary | null = null
  if (current) {
    const createdAt = now().toISOString()
    const id = `${createdAt.replace(/[:.]/g, '-')}-${(options.makeId ?? randomUUID)()}`
    const snapshot: CatalogSnapshot = {
      version: 1,
      id,
      createdAt,
      skuCount: countCatalogStateSkus(current),
      reason: options.reason ?? 'overwrite',
      state: current,
    }
    try {
      await s.setJSON(snapshotKey(id), snapshot)
      await trimSnapshots(s)
    } catch (error) {
      throw new CatalogStateError(
        'BACKUP_FAILED',
        `สำรองสถานะเดิมไม่สำเร็จ — ปฏิเสธการเขียน: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    backup = { id, createdAt, skuCount: snapshot.skuCount, reason: snapshot.reason }
  }

  const updatedAt = now().toISOString()
  try {
    await s.setJSON(KEY, { ...next, updatedAt })
  } catch (error) {
    throw new CatalogStateError(
      'WRITE_FAILED',
      `เขียนสถานะใหม่ไม่สำเร็จ (สำรองเดิมไว้แล้ว): ${error instanceof Error ? error.message : String(error)}`,
      { backupId: backup?.id ?? null },
    )
  }
  return { updatedAt, skuCount: countCatalogStateSkus(next), backup }
}

export async function saveCatalogStateBlobs(state: CatalogStateInput) {
  return replaceCatalogState(store(), state)
}

async function readSnapshot(s: CatalogStore, id: string): Promise<CatalogSnapshot> {
  if (!validSnapshotId(id)) {
    throw new CatalogStateError('INVALID_SNAPSHOT_ID', 'รหัสรุ่นสำรองไม่ถูกต้อง')
  }
  let snapshot: CatalogSnapshot | null
  try {
    snapshot = (await s.get(snapshotKey(id), { type: 'json' })) as CatalogSnapshot | null
  } catch (error) {
    throw new CatalogStateError(
      'READ_FAILED',
      `อ่านรุ่นสำรองไม่ได้: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!snapshot) {
    throw new CatalogStateError('SNAPSHOT_NOT_FOUND', `ไม่พบรุ่นสำรอง ${id}`)
  }
  const actualCount = countCatalogStateSkus(snapshot.state ?? null)
  if (snapshot.version !== 1 || snapshot.id !== id || !snapshot.createdAt || !snapshot.reason
    || !snapshot.state?.ovr || Array.isArray(snapshot.state.ovr)
    || !Number.isInteger(snapshot.skuCount) || snapshot.skuCount !== actualCount) {
    throw new CatalogStateError(
      'INVALID_SNAPSHOT',
      `รุ่นสำรอง ${id} มีโครงสร้างหรือจำนวน SKU ไม่ตรง — ปฏิเสธการกู้คืน`,
      { recordedSkuCount: snapshot.skuCount, actualSkuCount: actualCount },
    )
  }
  return snapshot
}

export async function listCatalogStateSnapshots(s: CatalogStore = store()): Promise<CatalogSnapshotSummary[]> {
  const { blobs } = await s.list({ prefix: SNAPSHOT_PREFIX })
  const snapshots = await Promise.all(blobs.map(async ({ key }) => {
    const id = key.slice(SNAPSHOT_PREFIX.length)
    const checked = await readSnapshot(s, id)
    return { id: checked.id, createdAt: checked.createdAt, skuCount: checked.skuCount, reason: checked.reason }
  }))
  return snapshots
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function restoreCatalogStateSnapshot(
  id: string,
  s: CatalogStore = store(),
  options: { now?: () => Date; makeId?: () => string } = {},
) {
  const snapshot = await readSnapshot(s, id)
  // กู้คืนจงใจข้ามด่าน 20% เพราะรุ่นเก่าอาจเล็กกว่า แต่ยังสำรองก้อนปัจจุบันก่อนเสมอ
  const result = await replaceCatalogState(s, stateWithoutUpdatedAt(snapshot.state), {
    reason: `restore:${id}`,
    enforceShrinkGuard: false,
    ...options,
  })
  return { restored: { id: snapshot.id, createdAt: snapshot.createdAt, skuCount: snapshot.skuCount }, ...result }
}
