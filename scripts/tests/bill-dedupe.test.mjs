/* ทดสอบตัวคัดบิลซ้ำบนจอรายเจ้า — รัน: node scripts/tests/bill-dedupe.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส** (16 ก.ย. 2569 · ใบ t_mu3g8tq5)
 *    ท่านประธานเห็นบิล Adobe **3–4 ไฟล์ต่อเดือน** ทั้งที่เป็นใบเดียวกัน
 *    ต้นเหตุ: ตัวคัดซ้ำอ่านเลขที่ใบจาก **ชื่อไฟล์** ด้วย regex 4 แบบ (THTT · FBADS · IN- · INV)
 *             ⇒ Adobe ไม่เข้ารูปแบบไหน ⇒ คืน null ⇒ ตกกอง "ไม่มีเลข เก็บไว้ทั้งหมด" ⇒ ซ้ำหมด
 *    ⇒ ตอนนี้ใช้เลขที่อ่านจาก **เนื้อใน PDF** ก่อน (ช่อง invoiceNo)
 *
 * เทสนี้ตรึงสามข้อ: ① เลขจากเอกสารชนะชื่อไฟล์ ② ของเก่าที่ไม่มี invoiceNo ต้องไม่พัง
 *                   ③ ไม่มีเลขทั้งสองทาง ⇒ **ห้ามคัดทิ้ง** (บิลหาย = เอกสารภาษีขาด)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-bill-dedupe')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail++ }
}
const f = (filename, attachmentId = 'A1', invoiceNo = undefined) => ({ filename, attachmentId, invoiceNo })

try {
  execFileSync('npx', ['tsc', 'lib/bill-dedupe.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { คัดซ้ำ, เลขที่ใบ, คัดซ้ำพร้อมรายงาน } = await import(join(out, 'bill-dedupe.js'))

  console.log('① เคส Adobe ของจริง: 3 ไฟล์ชื่อคนละแบบ แต่เลขในเอกสารเดียวกัน ⇒ ต้องเหลือ 1')
  const adobe = [
    f('Adobe_Invoice.pdf', 'A1', 'IEB1234567890'),
    f('ใบแจ้งหนี้-อะโดบี-สิงหาคม.pdf', 'A2', 'IEB1234567890'),
    f('2026-08_xxx_Invoice (1).pdf', 'A3', 'IEB1234567890'),
  ]
  const r1 = คัดซ้ำ(adobe)
  ok(r1.length === 1, 'เหลือใบเดียว', `เหลือ ${r1.length}`)

  console.log('② ของเก่าในแคชไม่มี invoiceNo ⇒ ยังคัดด้วยชื่อไฟล์ได้เหมือนเดิม (ห้ามพัง)')
  const tiktok = [
    f('THTT202606634060-บริษัท-Invoice.pdf', 'A1'),
    f('TikTok-Invoice-THTT202606634060.pdf', 'A2'),
  ]
  ok(คัดซ้ำ(tiktok).length === 1, 'สองชื่อ เลขเดียวกัน ⇒ เหลือ 1', String(คัดซ้ำ(tiktok).length))
  ok(เลขที่ใบ(f('TikTok-Invoice-THTT202606634060.pdf')) === 'THTT202606634060', 'อ่านเลขจากชื่อไฟล์ได้')

  console.log('③ ไม่มีเลขทั้งสองทาง ⇒ ห้ามคัดทิ้ง')
  const unknown = [f('สลิปโอนเงิน-1.pdf'), f('สลิปโอนเงิน-2.pdf', 'A2')]
  ok(คัดซ้ำ(unknown).length === 2, 'เก็บไว้ทั้งสองใบ', String(คัดซ้ำ(unknown).length))
  ok(เลขที่ใบ(f('สลิปโอนเงิน-1.pdf')) === null, 'ไม่มีเลข ⇒ null ไม่เดา')

  console.log('④ เลขจากเอกสารชนะเลขที่เดาจากชื่อไฟล์')
  const mixed = เลขที่ใบ(f('TikTok-Invoice-THTT999999999999.pdf', 'A1', 'IEB-777'))
  ok(mixed === 'IEB-777', 'ใช้เลขจากเอกสาร', String(mixed))

  console.log('⑤ ใบต่างเลข ⇒ ห้ามยุบรวม')
  const two = [f('a.pdf', 'A1', 'INV-1'), f('b.pdf', 'A2', 'INV-2')]
  ok(คัดซ้ำ(two).length === 2, 'คนละเลข = คนละใบ', String(คัดซ้ำ(two).length))

  console.log('⑥ ลำดับความน่าเชื่อถือ: ไฟล์ตัวจริงที่อัปไว้ (BLOB:) ชนะไฟล์แนบ ชนะใบที่ระบบสร้าง (GEN)')
  const ranked = [
    f('gen.pdf', 'GEN', 'INV-9'),
    f('mail.pdf', 'ATT-1', 'INV-9'),
    f('real.pdf', 'BLOB:f/adobe/real.pdf', 'INV-9'),
  ]
  const r6 = คัดซ้ำ(ranked)
  ok(r6.length === 1 && r6[0].filename === 'real.pdf', 'เก็บไฟล์ตัวจริงไว้', JSON.stringify(r6.map((x) => x.filename)))
  console.log('⑦ ซ่อนไฟล์ซ้ำแล้ว **ต้องรายงานว่าซ่อนอะไรไว้** (ใบ t_mu3g8tq5)')
  /* 🔴 เหตุ: ท่านประธานจับบิล Adobe ซ้ำได้เอง เพราะระบบคัดซ้ำให้แล้วแต่ไม่เคยบอก
     ⇒ จำนวนที่ซ่อน + ชื่อไฟล์ที่ซ่อน + ชื่อไฟล์ที่เก็บไว้แทน ต้องมีครบ */
  const rep = คัดซ้ำพร้อมรายงาน(ranked)
  ok(rep.เก็บไว้.length === 1, 'เก็บไว้ใบเดียว', String(rep.เก็บไว้.length))
  ok(rep.ซ่อนไว้.length === 2, 'รายงานว่าซ่อน 2 ไฟล์', String(rep.ซ่อนไว้.length))
  ok(rep.ซ่อนไว้.every((d) => d.ซ้ำกับ === 'real.pdf'), 'บอกว่าซ้ำกับไฟล์ตัวจริง',
    JSON.stringify(rep.ซ่อนไว้.map((d) => d.ซ้ำกับ)))
  ok(rep.ซ่อนไว้.every((d) => d.เลขที่ใบ === 'INV-9'), 'ติดเลขที่ใบที่ใช้ตัดสินมาด้วย',
    JSON.stringify(rep.ซ่อนไว้.map((d) => d.เลขที่ใบ)))
  const ชื่อที่ซ่อน = rep.ซ่อนไว้.map((d) => d.ชื่อไฟล์).sort().join(',')
  ok(ชื่อที่ซ่อน === 'gen.pdf,mail.pdf', 'ชื่อไฟล์ที่ซ่อนถูกต้อง', ชื่อที่ซ่อน)

  console.log('⑧ ไม่มีไฟล์ซ้ำ ⇒ รายงานต้องว่าง (ห้ามฟ้องมั่ว)')
  const rep2 = คัดซ้ำพร้อมรายงาน(two)
  ok(rep2.ซ่อนไว้.length === 0, 'คนละใบ = ไม่ซ่อนอะไร', String(rep2.ซ่อนไว้.length))

  console.log('⑨ ไม่มีเลขที่ใบ ⇒ เก็บทั้งหมด และไม่นับว่าซ่อน')
  const ไม่มีเลข = [f('สลิป-1.pdf', 'A1'), f('สลิป-2.pdf', 'A2')]
  const rep3 = คัดซ้ำพร้อมรายงาน(ไม่มีเลข)
  ok(rep3.เก็บไว้.length === 2 && rep3.ซ่อนไว้.length === 0, 'เก็บครบ ไม่ซ่อน',
    `${rep3.เก็บไว้.length}/${rep3.ซ่อนไว้.length}`)
} catch (e) {
  console.log('❌ เทสพัง:', e?.message ?? e); fail++
} finally {
  rmSync(out, { recursive: true, force: true })
}
console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ไม่ผ่าน ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
