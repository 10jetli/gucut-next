#!/usr/bin/env node
/* ตาข่าย state ของ /catalog — ทุกข้อใช้ Map จำลอง ไม่แตะ Netlify Blobs หรือข้อมูลร้านจริง
 * ตรึงของที่ท่านประธานกลัวตรง ๆ:
 * ① เขียนทับต้องสำรองก่อน ② ก้อนหายเกิน 20% ต้องถูกปฏิเสธ
 * ③ สำรองล้มต้องไม่แตะ state ④ กู้คืนต้องสำรองก้อนปัจจุบันก่อน
 * ⑤ เก็บย้อนหลัง 30 รุ่น ⑥ เส้นดู/กู้ต้องมี x-admin-key */
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, ผ่าน, เหตุ = '') => {
  console.log(`  ${ผ่าน ? '✅' : '❌'} ${ชื่อ}${ผ่าน ? '' : ` — ${เหตุ}`}`)
  if (!ผ่าน) ตก++
}

const ไฟล์ = [
  'lib/catalogstate.ts',
  'app/api/catalog/state/route.ts',
  'app/api/catalog/backups/auth.ts',
  'app/api/catalog/backups/route.ts',
  'app/api/catalog/backups/restore/route.ts',
]
const ผล = คอมไพล์เพื่อทดสอบ({
  ไฟล์,
  ปลอม: {
    '@netlify/blobs': `export const getStore = () => globalThis.__catalogStore;`,
    'next/server': `
export class NextRequest {}
export const NextResponse = {
  json(body, init = {}) {
    const status = init.status ?? 200
    return { status, ok: status < 300, headers: init.headers ?? {}, async json() { return body } }
  },
}
`,
  },
})

const lib = await import(ผล.พาธของ('lib/catalogstate.ts'))
const stateRoute = await import(ผล.พาธของ('app/api/catalog/state/route.ts'))
const backupsRoute = await import(ผล.พาธของ('app/api/catalog/backups/route.ts'))
const restoreRoute = await import(ผล.พาธของ('app/api/catalog/backups/restore/route.ts'))

const clone = (x) => x == null ? x : structuredClone(x)
function fakeStore() {
  const data = new Map()
  const ops = []
  const fail = { getState: false, snapshotSet: false, stateSet: false, list: false, delete: false }
  return {
    data, ops, fail,
    async get(key) {
      ops.push(`get:${key}`)
      if (fail.getState && key === 'state') throw new Error('อ่านถังไม่ได้')
      return clone(data.get(key) ?? null)
    },
    async setJSON(key, value) {
      ops.push(`set:${key}`)
      if (fail.snapshotSet && key.startsWith('state-snapshots/')) throw new Error('เขียนสำรองไม่ได้')
      if (fail.stateSet && key === 'state') throw new Error('เขียน state ไม่ได้')
      data.set(key, clone(value))
    },
    async list({ prefix }) {
      ops.push(`list:${prefix}`)
      if (fail.list) throw new Error('อ่านทะเบียนสำรองไม่ได้')
      return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }
    },
    async delete(key) {
      ops.push(`delete:${key}`)
      if (fail.delete) throw new Error('ลบรุ่นเก่าไม่ได้')
      data.delete(key)
    },
  }
}
const state = (n, label = 'ค่า') => ({
  ovr: Object.fromEntries(Array.from({ length: n }, (_, i) => [`SKU-${i}`, { name: `${label}-${i}` }])),
  catMap: {}, catNew: [], facs: [], catDone: [], picked: [], added: [],
})
const req = (key, body = {}) => ({
  headers: { get: (name) => name.toLowerCase() === 'x-admin-key' ? key : null },
  async json() { return clone(body) },
})

console.log('① เขียนปกติ: สำรองของเดิมก่อน แล้วจึงเขียนของใหม่')
{
  const s = fakeStore(); s.data.set('state', { ...state(100, 'เดิม'), updatedAt: 'ก่อน' })
  const r = await lib.replaceCatalogState(s, state(90, 'ใหม่'), {
    now: () => new Date('2026-10-15T08:00:00.000Z'), makeId: () => 'normal',
  })
  const snapshotSet = s.ops.findIndex((x) => x.startsWith('set:state-snapshots/'))
  const stateSet = s.ops.lastIndexOf('set:state')
  ok('ลำดับสำรองมาก่อนเขียน state', snapshotSet >= 0 && snapshotSet < stateSet, s.ops.join(' → '))
  ok('สำรองจดเวลาและจำนวน 100 SKU', r.backup?.skuCount === 100 && !!r.backup.createdAt, JSON.stringify(r.backup))
  ok('ก้อนใหม่ถูกเขียนครบ 90 SKU', Object.keys(s.data.get('state').ovr).length === 90)
}

console.log('② ป้อนของเสีย: SKU หายครึ่งก้อนต้องถูกปฏิเสธจริง')
{
  const s = fakeStore(); const เดิม = { ...state(100, 'เดิม'), updatedAt: 'ก่อน' }; s.data.set('state', clone(เดิม))
  let error
  try { await lib.replaceCatalogState(s, state(50)) } catch (e) { error = e }
  ok('ได้ TOO_FEW_SKUS พร้อมเลขเดิม 100 / ใหม่ 50',
    error?.code === 'TOO_FEW_SKUS' && error.details.oldSkuCount === 100 && error.details.newSkuCount === 50,
    String(error?.message))
  ok('ไม่มีการเขียนแม้แต่ snapshot/state', !s.ops.some((x) => x.startsWith('set:')), s.ops.join(' → '))
  ok('ของเดิม 100 SKU ยังอยู่ครบ', Object.keys(s.data.get('state').ovr).length === 100)
}

console.log('③ ขอบ 20%: ลดพอดีผ่าน · เกินนิดเดียวตก')
{
  const s = fakeStore(); s.data.set('state', { ...state(100), updatedAt: 'ก่อน' })
  await lib.replaceCatalogState(s, state(80), { makeId: () => 'exact-20' })
  ok('ลดพอดี 20% ผ่านตามคำว่า “เกิน 20%”', Object.keys(s.data.get('state').ovr).length === 80)
  s.data.set('state', { ...state(100), updatedAt: 'ก่อน' }); s.ops.length = 0
  let code
  try { await lib.replaceCatalogState(s, state(79)) } catch (e) { code = e.code }
  ok('ลด 21% ถูกปฏิเสธ', code === 'TOO_FEW_SKUS')
}

console.log('④ ป้อนของเสีย: ทำให้สำรองล้ม ⇒ ปฏิเสธการเขียนจริง')
{
  const s = fakeStore(); s.data.set('state', { ...state(100, 'เดิม'), updatedAt: 'ก่อน' }); s.fail.snapshotSet = true
  let error
  try { await lib.replaceCatalogState(s, state(90, 'ใหม่')) } catch (e) { error = e }
  ok('ตอบ BACKUP_FAILED ชัดเจน', error?.code === 'BACKUP_FAILED' && error.message.includes('ปฏิเสธการเขียน'), String(error?.message))
  ok('ไม่มี set:state หลังสำรองล้ม', !s.ops.includes('set:state'), s.ops.join(' → '))
  ok('ของเดิมยังอยู่ครบ', Object.keys(s.data.get('state').ovr).length === 100)
}

console.log('⑤ อ่านของเดิมล้ม ≠ ไม่มีของเดิม: ห้ามเขียนต่อ')
{
  const s = fakeStore(); s.data.set('state', { ...state(100), updatedAt: 'ก่อน' }); s.fail.getState = true
  let error
  try { await lib.replaceCatalogState(s, state(90)) } catch (e) { error = e }
  ok('ตอบ READ_FAILED', error?.code === 'READ_FAILED', String(error?.message))
  ok('ไม่เรียกเขียนใด ๆ', !s.ops.some((x) => x.startsWith('set:')), s.ops.join(' → '))
}

console.log('⑥ เก็บย้อนหลัง 30 รุ่น — รุ่นที่ 31 เก่าสุดถูกลบ')
{
  const s = fakeStore(); s.data.set('state', { ...state(10), updatedAt: 'ก่อน' })
  for (let i = 0; i < 30; i++) {
    const id = `2026-10-14T00-00-${String(i).padStart(2, '0')}-000Z-old-${i}`
    s.data.set(`state-snapshots/${id}`, { version: 1, id, createdAt: `2026-10-14T00:00:${String(i).padStart(2, '0')}.000Z`, skuCount: 10, reason: 'old', state: state(10) })
  }
  await lib.replaceCatalogState(s, state(10), {
    now: () => new Date('2026-10-15T00:00:00.000Z'), makeId: () => 'new',
  })
  const keys = [...s.data.keys()].filter((x) => x.startsWith('state-snapshots/'))
  ok('เหลือ 30 รุ่นพอดี', keys.length === 30, String(keys.length))
  ok('รุ่นใหม่ยังอยู่', keys.some((x) => x.endsWith('-new')))
  ok('รุ่นเก่าสุดถูกลบ', !keys.some((x) => x.endsWith('-old-0')))
}

console.log('⑦ กู้คืน: สำรองก้อนปัจจุบันก่อน และกู้รุ่นเล็กกว่า 20% ได้')
{
  const s = fakeStore(); s.data.set('state', { ...state(100, 'ปัจจุบัน'), updatedAt: 'ตอนนี้' })
  s.data.set('state-snapshots/target', {
    version: 1, id: 'target', createdAt: '2026-10-14T00:00:00.000Z', skuCount: 40,
    reason: 'overwrite', state: { ...state(40, 'รุ่นเก่า'), updatedAt: 'เก่า' },
  })
  const r = await lib.restoreCatalogStateSnapshot('target', s, {
    now: () => new Date('2026-10-15T09:00:00.000Z'), makeId: () => 'before-restore',
  })
  ok('กู้รุ่น 40 SKU สำเร็จ (restore ข้าม guard โดยตั้งใจ)', Object.keys(s.data.get('state').ovr).length === 40)
  ok('สำรองก้อนปัจจุบัน 100 SKU ก่อนกู้', r.backup?.skuCount === 100 && r.backup.reason === 'restore:target', JSON.stringify(r.backup))
  const backupKey = [...s.data.keys()].find((x) => x.endsWith('-before-restore'))
  ok('รุ่นก่อนกู้เก็บ state 100 SKU จริง', Object.keys(s.data.get(backupKey).state.ovr).length === 100)
}

console.log('⑧ เส้น API: error มีตัวเลข และรายการ/กู้คืนต้องมี x-admin-key')
{
  const s = fakeStore(); globalThis.__catalogStore = s
  s.data.set('state', { ...state(100), updatedAt: 'ก่อน' })
  let r = await stateRoute.POST(req(null, state(50))); let j = await r.json()
  ok('POST ก้อนครึ่งเดียวตอบ 409 พร้อม 100/50', r.status === 409 && j.oldSkuCount === 100 && j.newSkuCount === 50, JSON.stringify(j))

  const เดิม = process.env.GUCUT_WEB_ADMIN_KEY
  try {
    delete process.env.GUCUT_WEB_ADMIN_KEY
    ok('เซิร์ฟเวอร์ไม่มี key ⇒ 503 fail closed', (await backupsRoute.GET(req(null))).status === 503)
    process.env.GUCUT_WEB_ADMIN_KEY = 'คีย์ทดสอบ'
    ok('ไม่มี key ⇒ 401', (await backupsRoute.GET(req(null))).status === 401)
    ok('key ผิด ⇒ 401', (await backupsRoute.GET(req('ผิด'))).status === 401)

    s.data.set('state-snapshots/target-api', {
      version: 1, id: 'target-api', createdAt: '2026-10-14T00:00:00.000Z', skuCount: 90,
      reason: 'overwrite', state: { ...state(90), updatedAt: 'เก่า' },
    })
    r = await backupsRoute.GET(req('คีย์ทดสอบ')); j = await r.json()
    ok('key ถูก ⇒ ดูทะเบียนได้ แต่ไม่คืน state ทั้งก้อน', r.status === 200 && j.backups.some((x) => x.id === 'target-api') && !('state' in j.backups[0]), JSON.stringify(j))
    r = await restoreRoute.POST(req('คีย์ทดสอบ', { id: 'target-api' })); j = await r.json()
    ok('เส้นกู้คืนทำงานและสำรองก่อน', r.status === 200 && j.ok === true && j.backup?.skuCount === 100, JSON.stringify(j))
  } finally {
    if (เดิม === undefined) delete process.env.GUCUT_WEB_ADMIN_KEY
    else process.env.GUCUT_WEB_ADMIN_KEY = เดิม
  }
}

console.log('⑨ กู้คืนเจอ snapshot เสีย หรือสำรองก้อนปัจจุบันไม่ได้ ⇒ ห้ามเขียน')
{
  const s = fakeStore(); s.data.set('state', { ...state(100, 'ปัจจุบัน'), updatedAt: 'ตอนนี้' })
  s.data.set('state-snapshots/broken', {
    version: 1, id: 'broken', createdAt: '2026-10-14T00:00:00.000Z', skuCount: 99,
    reason: 'overwrite', state: { ...state(40), updatedAt: 'เก่า' },
  })
  let error
  try { await lib.restoreCatalogStateSnapshot('broken', s) } catch (e) { error = e }
  ok('จำนวนที่จดไม่ตรงเนื้อ snapshot ⇒ INVALID_SNAPSHOT', error?.code === 'INVALID_SNAPSHOT', String(error?.message))
  ok('state ปัจจุบันยัง 100 SKU', Object.keys(s.data.get('state').ovr).length === 100)

  s.data.set('state-snapshots/good', {
    version: 1, id: 'good', createdAt: '2026-10-14T00:00:00.000Z', skuCount: 40,
    reason: 'overwrite', state: { ...state(40), updatedAt: 'เก่า' },
  })
  s.fail.snapshotSet = true; s.ops.length = 0; error = null
  try { await lib.restoreCatalogStateSnapshot('good', s) } catch (e) { error = e }
  ok('สำรองก่อน restore ล้ม ⇒ BACKUP_FAILED', error?.code === 'BACKUP_FAILED', String(error?.message))
  ok('ไม่มี set:state และของปัจจุบันยังอยู่', !s.ops.includes('set:state') && Object.keys(s.data.get('state').ovr).length === 100, s.ops.join(' → '))
}

console.log(ตก ? `\n🔴 ตก ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อด้วย store จำลอง — ไม่แตะข้อมูลจริง')
process.exit(ตก ? 1 : 0)
