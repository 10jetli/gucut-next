#!/usr/bin/env node
/* `lib/parts-models.ts` — รายชื่อรุ่นอะไหล่ต้อง **ถามหน้าร้าน** ไม่ใช่เก็บสำเนาไว้เอง
 * (13 ต.ค. 2569 · ตอนเพิ่ม MS180/361/038/360/880)
 *
 * 🔴 ราคาที่จ่ายเมื่อผิด: รุ่นที่เพิ่งเพิ่มจะ "ไม่มีอยู่จริง" สำหรับรอบจับคู่
 *    ⇒ หน้าอะไหล่เปิดได้ ของครบ แต่ทุกแถวขึ้น "สอบถามร้าน" ทั้งที่ของมีขาย
 *    ⇒ ไม่มี error ไม่มีอะไรแดง — ต้องจับด้วยเทสเท่านั้น
 *
 * 🔑 เคสควบคุมสองทิศ: "ถามได้ต้องใช้ของจริง" คู่กับ "ถามไม่ได้ต้องพูดออกมา"
 *    ด่านที่มีแต่ทิศแรกจะเขียวตลอดแม้ของสำรองถูกใช้เงียบ ๆ ทุกครั้ง
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `parts-models-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}

try {
  execFileSync('npx', ['tsc', 'lib/parts-models.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler'], { stdio: 'pipe' })
  const { รุ่นจากหน้าร้าน, รุ่นสำรอง } = await import(join(out, 'parts-models.js'))

  const ตอบ = (body, ok_ = true) => async () => ({ ok: ok_, status: ok_ ? 200 : 503, json: async () => body })

  const ดี = await รุ่นจากหน้าร้าน('https://x', ตอบ({ รุ่น: [{ slug: 'f180' }, { slug: 'f361' }, { slug: 'F 660' }] }))
  ok('ถามได้ ⇒ ใช้รายชื่อของหน้าร้าน', ดี.ถามได้ && ดี.รุ่น.join(',') === 'f180,f361,f660', JSON.stringify(ดี))
  ok('ถามได้ ⇒ ที่มาต้องไม่ติดคำเตือน', !ดี.ที่มา.includes('⚠️'), ดี.ที่มา)

  const ล่ม = await รุ่นจากหน้าร้าน('https://x', async () => { throw new Error('getaddrinfo ENOTFOUND') })
  ok('ถามไม่ได้ ⇒ ใช้ของสำรอง', ล่ม.รุ่น.join(',') === รุ่นสำรอง.join(','), JSON.stringify(ล่ม.รุ่น))
  ok('ถามไม่ได้ ⇒ **ต้องพูดออกมา** (ถามได้=false + มีคำเตือน + บอกเหตุ)',
     ล่ม.ถามได้ === false && ล่ม.ที่มา.includes('⚠️') && ล่ม.ที่มา.includes('ENOTFOUND'), ล่ม.ที่มา)

  const ว่าง = await รุ่นจากหน้าร้าน('https://x', ตอบ({ รุ่น: [] }))
  ok('200 ที่ไม่มีรุ่นเลย = ถามไม่ได้ ไม่ใช่ "ไม่มีรุ่น"',
     ว่าง.ถามได้ === false && ว่าง.รุ่น.length === รุ่นสำรอง.length, JSON.stringify(ว่าง))

  const พัง = await รุ่นจากหน้าร้าน('https://x', ตอบ(null, false))
  ok('HTTP ไม่ ok = ถามไม่ได้ และบอกรหัสสถานะ', พัง.ถามได้ === false && พัง.ที่มา.includes('503'), พัง.ที่มา)
} finally {
  rmSync(out, { recursive: true, force: true })
}
console.log(ตก ? `❌ ตก ${ตก} ข้อ` : '✅ ผ่านหมด')
process.exit(ตก ? 1 : 0)
