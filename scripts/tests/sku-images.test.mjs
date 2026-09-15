/* ทดสอบลำดับการเลือกรูปสินค้า — รัน: node scripts/tests/sku-images.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ลำดับนี้ไม่ได้มีไว้ให้สวย — มันคือกติกาเรื่อง **ขนาดไฟล์กับความถูกต้อง**
 *    · ถ้าไฟล์ดิบหลุดไปอยู่ในตารางร้อยแถว = เปิดหน้าเดียวโหลดหลายสิบ MB (บางใบเกือบ 2 MB)
 *      แท็บเล็ตหน้าร้านจะค้าง และไม่มีใครรู้ว่าเพราะอะไร
 *    · ถ้ารวบ "ZORT ไม่มีรูป" กับ "ยังไม่รู้" เป็นอันเดียว คนจะไม่รู้ว่าต้องไปถ่ายรูป หรือรอระบบ
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-sku-images')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  /* ไฟล์ต้นทางเป็น component ฝั่งเบราว์เซอร์ ('use client' + React hook)
     ⇒ คัดเฉพาะส่วนที่เป็นตรรกะล้วนมาทดสอบไม่ได้ ต้องแปลงทั้งไฟล์แล้ว import เฉพาะฟังก์ชันที่ต้องการ
     (React ไม่ถูกเรียกเพราะเราไม่แตะ useSkuImages) */
  execFileSync('npx', ['tsc', 'lib/sku-images.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck', '--jsx', 'react-jsx'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { pickImage, noImageReason } = await import(join(out, 'sku-images.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail += 1 }
  }

  const MAP = 'https://video.gucut.com/i/128/old-map.webp'
  const row = { imageFile: 'zort/abc.webp', imagePath: 'https://image.zort.co.th/big.png' }

  // ① แผนที่เราต้องมาก่อนเสมอ แม้จะมีทั้งสามแหล่ง
  ok('มีครบสามแหล่ง ⇒ ใช้แผนที่เรา', pickImage(MAP, row, 128, true) === MAP)

  // ② ไม่มีในแผนที่ ⇒ ใช้รูปย่อในถังเรา (ใช้ได้กับตารางยาว)
  ok('ไม่มีในแผนที่ ⇒ ใช้ imageFile ขั้น 128',
    pickImage(null, row, 128, false) === 'https://video.gucut.com/i/128/zort/abc.webp',
    String(pickImage(null, row, 128, false)))
  ok('ขั้นอื่นก็ประกอบ URL ถูก',
    pickImage(null, row, 640, false) === 'https://video.gucut.com/i/640/zort/abc.webp')

  // 🔴 ③ ไฟล์ดิบต้อง **ไม่หลุด** เข้าตารางยาว (allowRaw = false)
  const noFile = { imageFile: null, imagePath: 'https://image.zort.co.th/big.png' }
  ok('ตารางยาว (allowRaw=false) ⇒ ไม่ใช้ไฟล์ดิบ', pickImage(null, noFile, 128, false) === null,
    String(pickImage(null, noFile, 128, false)))
  ok('หน้ารายละเอียด (allowRaw=true) ⇒ ใช้ไฟล์ดิบได้',
    pickImage(null, noFile, 640, true) === 'https://image.zort.co.th/big.png')

  // ④ ไม่มีรูปเลย
  ok('ไม่มีอะไรเลย ⇒ null', pickImage(null, { imageFile: null, imagePath: '' }, 128, true) === null)
  ok('row เป็น null ⇒ null ไม่โยน error', pickImage(null, null, 128, true) === null)
  ok('imageFile เป็นช่องว่าง ⇒ ข้ามไป ไม่สร้าง URL พัง',
    pickImage(null, { imageFile: '   ', imagePath: '' }, 128, true) === null)

  // 🔴 สองเหตุผลที่ไม่มีรูป ต้องแยกออกจากกัน
  ok('imagePath = "" ⇒ ZORT ไม่มีรูป (ต้องถ่ายเพิ่ม)', noImageReason({ imagePath: '' }) === 'zort-none')
  ok('imagePath = null ⇒ ยังไม่รู้', noImageReason({ imagePath: null }) === 'unknown')
  ok('ไม่มีคีย์เลย (ท่อรุ่นเก่า) ⇒ ยังไม่รู้', noImageReason({}) === 'unknown')
  ok('row เป็น null ⇒ ยังไม่รู้', noImageReason(null) === 'unknown')
} finally {
  rmSync(out, { recursive: true, force: true })
}
if (fail) { console.error(`\n❌ ลำดับรูปสินค้า: ไม่ผ่าน ${fail} ข้อ`); process.exit(1) }
console.log('✅ ลำดับรูปสินค้า: ผ่านทุกข้อ')
