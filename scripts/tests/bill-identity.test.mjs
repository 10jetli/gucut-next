/* ทดสอบตัวตนของบิล (กันบิลซ้ำโดยไม่พึ่งชื่อไฟล์) — รัน: node scripts/tests/bill-identity.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส** (16 ก.ย. 2569 · ใบ t_mu3g8tq5)
 *    ท่านประธานจับได้เองว่าบิล Adobe ถูกเก็บซ้ำ: ส.ค. 3 ไฟล์ = ใบเดียวกัน · ก.ค. 4 ไฟล์ = ใบเดียวกัน
 *    และมี 1 ใบของ มิ.ย. ไปโผล่ในแฟ้ม ก.ค. ⇒ ชนกฎเหล็ก "บิลห้ามโหลดซ้ำ"
 *    ต้นเหตุ: ตัวกันซ้ำเดิมเทียบ **ชื่อไฟล์** ⇒ ใบเดียวกันชื่อต่างกันผ่านด่านทุกครั้ง
 *
 * เทสนี้คุมสามเรื่องที่พลาดมาแล้ว:
 *    ① ใบเดียวกัน ชื่อไฟล์ต่างกัน ⇒ **กุญแจต้องเท่ากัน**
 *    ② ใบที่ออกต้นเดือนถัดไป ⇒ ต้องจัดแฟ้มตาม **รอบบิล** ไม่ใช่วันที่ออกใบ
 *    ③ อ่านอะไรไม่ได้ ⇒ **คืน null (ตัดสินไม่ได้)** ห้ามเดาว่าไม่ซ้ำ
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-bill-identity')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail++ }
}

try {
  execFileSync('npx', ['tsc', 'lib/bill-identity.ts', 'lib/bill-text.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  /* ⚠️ tsc คง import เป็น './bill-text' (ไม่มีนามสกุล) ตามสไตล์ที่ Next ต้องใช้
     แต่ Node ESM ต้องมี .js ⇒ เติมให้ตอนรันเทส **ไม่แก้ที่ไฟล์จริง**
     (แก้ที่ไฟล์จริงให้ถูกใจ Node จะทำให้ build ของ Next เพี้ยนแทน) */
  const compiled = join(out, 'bill-identity.js')
  writeFileSync(compiled, readFileSync(compiled, 'utf8').replace(/from '\.\/bill-text'/g, "from './bill-text.js'"))
  const { billIdentity, billFilingMonth } = await import(compiled)

  console.log('① ใบเดียวกันที่มาในชื่อไฟล์ต่างกัน ต้องได้กุญแจเดียวกัน')
  const adobeAug = `Adobe Systems Software Ireland Ltd
Invoice Number: IEB1234567890
Billing period: Aug 1, 2026 - Aug 31, 2026
Invoice date: Sep 1, 2026
Total THB 1,070.00`
  const a1 = billIdentity(adobeAug, 'adobe')
  const a2 = billIdentity(adobeAug.replace('Adobe Systems', 'ADOBE SYSTEMS'), 'adobe')
  ok(a1.key && a1.key === a2.key, 'กุญแจเท่ากันแม้เนื้อหาต่างเล็กน้อย', `${a1.key} vs ${a2.key}`)
  ok(a1.invoiceNo === 'IEB1234567890', 'อ่านเลขที่ใบแจ้งหนี้ได้', String(a1.invoiceNo))
  ok(a1.key.includes('inv:'), 'ใช้เลขที่ใบเป็นตัวตนเมื่อมีเลข', String(a1.key))

  console.log('② ใบที่ออกเดือนถัดไป ต้องจัดแฟ้มตามรอบบิล ไม่ใช่วันที่ออกใบ')
  const f = billFilingMonth(adobeAug)
  ok(f.month === '2026-08', 'จัดเข้าแฟ้มเดือน 2026-08 (รอบบิล)', String(f.month))
  ok(f.source === 'รอบบิลที่พิมพ์ในใบ', 'บอกที่มาของเดือนว่ามาจากรอบบิล', String(f.source))
  const thaiPeriod = `ใบแจ้งหนี้
เลขที่ใบแจ้งหนี้ TH-2026-0009
รอบบิล 1 มิ.ย. 2569 - 30 มิ.ย. 2569
วันที่ออกใบ 2 ก.ค. 2569
ยอดรวมทั้งสิ้น 535.00 บาท`
  const f2 = billFilingMonth(thaiPeriod)
  ok(f2.month === '2026-06', 'ภาษาไทย: รอบบิล มิ.ย. ชนะวันที่ออกใบ ก.ค.', String(f2.month))

  console.log('③ ไม่มีรอบบิลในเอกสาร ⇒ ถอยมาใช้วันที่แรก แต่ต้องบอกที่มา')
  const noPeriod = `Receipt
Invoice No. AB-77
Date: Jul 5, 2026
Total 100.00`
  const f3 = billFilingMonth(noPeriod)
  ok(f3.month === '2026-07' && f3.source === 'วันที่แรกในใบ', 'ถอยมาใช้วันที่แรกและติดป้ายที่มา', JSON.stringify(f3))

  console.log('④ ไม่มีเลขที่ใบ ⇒ ใช้รอบบิล + ยอดรวมเป็นตัวตน')
  const noNo = `Statement
Billing period: Jul 1, 2026 - Jul 31, 2026
Amount due: 2,140.50`
  const b = billIdentity(noNo, 'adobe')
  ok(b.invoiceNo === null, 'ยอมรับว่าไม่มีเลขที่ใบ')
  ok(b.key === 'adobe|p:2026-07|amt:2140.5', 'กุญแจเป็นรอบบิล+ยอด', String(b.key))

  console.log('⑤ อ่านอะไรไม่ได้ ⇒ ตัดสินไม่ได้ (null) และต้องมีเหตุผลติดมา')
  const blank = billIdentity('', 'adobe')
  ok(blank.key === null, 'คืน null ไม่เดาว่าไม่ซ้ำ')
  ok(typeof blank.why === 'string' && blank.why.includes('ตัดสินไม่ได้'), 'มีเหตุผลเป็นข้อความ', String(blank.why))
  const onlyDate = billIdentity('Some scan\nJul 5, 2026\n', 'adobe')
  ok(onlyDate.key === null, 'มีแต่วันที่ ไม่มีเลข/ยอด ⇒ ยังตัดสินไม่ได้', String(onlyDate.key))

  console.log('⑥ ห้ามจับวันที่มาเป็นเลขที่ใบ')
  const dateish = billIdentity('Invoice No: 11/06/2026\nBilling period: Jun 1, 2026 - Jun 30, 2026\nTotal 500.00', 'x')
  ok(dateish.invoiceNo === null, 'ข้ามค่าที่หน้าตาเป็นวันที่', String(dateish.invoiceNo))
  ok(dateish.key === 'x|p:2026-06|amt:500', 'ถอยไปใช้รอบบิล+ยอดแทน', String(dateish.key))

  console.log('⑦ ใบต่างเดือนของเจ้าเดียวกัน ต้องได้กุญแจต่างกัน (กันลบใบจริงทิ้ง)')
  const k1 = billIdentity('Billing period: Aug 1, 2026 - Aug 31, 2026\nTotal 100.00', 'adobe').key
  const k2 = billIdentity('Billing period: Sep 1, 2026 - Sep 30, 2026\nTotal 100.00', 'adobe').key
  ok(k1 !== k2, 'คนละรอบบิล = คนละกุญแจ', `${k1} vs ${k2}`)

  console.log('⑧ รูปร่างจริงของใบ Adobe (เลขอยู่หน้าป้าย · Service Term · GRAND TOTAL คนละบรรทัด)')
  /* 🔬 คัดรูปแบบมาจาก PDF จริงในเครื่อง 16 ก.ย. 2569 (เปลี่ยนตัวเลขแล้ว ไม่ใช่ใบจริง)
     ⚠️ สามอย่างนี้ทำให้ตัวอ่านรุ่นแรกพลาดทั้งใบ:
        ① ค่าอยู่ **หน้า** ป้าย (`1234567890Invoice Number`) เพราะ PDF อ่านคอลัมน์ขวาก่อนหัวข้อ
        ② รอบบิลใช้คำว่า **Service Term** ไม่มีคำ period/billing
        ③ วันที่เป็น `16-SEP-2026` ซึ่งไม่เคยรองรับ · และยอดอยู่บรรทัดถัดไปจากป้าย */
  const adobeReal = `Bill To
INVOICE
Item Details
Service Term: 16-SEP-2026 to 15-OCT-2026
Invoice Information
9999999999Invoice Number
16-SEP-2026Invoice Date
Credit CardPayment Terms
8888888888Order Number
7777777Customer Number
USDCurrency
Federal Tax ID: 77-1234567
PRODUCT NUMBERPRODUCT DESCRIPTIONQUANTITYUNITUNIT PRICENET AMOUNTTAX RATETAXESTOTAL
12345678Creative Cloud Pro1EA69.5669.567.00%4.8774.43
Invoice Total
NET AMOUNT (USD)
69.56
TAXES (SEE DETAILS FOR RATES)
4.87
GRAND TOTAL (USD)
74.43`
  const ar = billIdentity(adobeReal, 'adobe')
  ok(ar.invoiceNo === '9999999999', 'อ่านเลขที่ใบที่วางอยู่หน้าป้ายได้', String(ar.invoiceNo))
  ok(ar.period === '2026-09', 'รอบบิลมาจาก Service Term (16-SEP-2026)', String(ar.period))
  ok(ar.periodSource === 'รอบบิลที่พิมพ์ในใบ', 'ติดป้ายว่ามาจากรอบบิล', String(ar.periodSource))
  ok(ar.total === 74.43, 'อ่าน GRAND TOTAL ที่อยู่บรรทัดถัดไปได้', String(ar.total))
  ok(billFilingMonth(adobeReal).month === '2026-09', 'จัดแฟ้มเดือน 2026-09 ไม่ใช่เดือนที่อีเมลมาถึง')

  console.log('⑨ ใบเสร็จ Meta ภาษาไทย (ไม่มีคำว่าเลขที่ใบแจ้งหนี้เลย)')
  const metaReal = `ใบเสร็จสำหรับ บัญชีผู้ใช้โฆษณา
ID บัญชี: 123456789012345
วันที่เรียกเก็บเงิน/ชำระเงิน
31 ก.ค. 2569 12:00
หมายเลขอ้างอิง: 9X9ABCDEF9
ID ธุรกรรม
111111111111111-222222222222222
ชำระแล้ว
฿16,625.98`
  const mr = billIdentity(metaReal, 'meta')
  ok(mr.invoiceNo !== null, 'ได้ตัวตนจากหมายเลขอ้างอิง/ID ธุรกรรม', String(mr.invoiceNo))
  ok(mr.key !== null, 'มีกุญแจกันซ้ำ (ก่อนแก้: ตัดสินไม่ได้)', String(mr.key))
  ok(mr.total === 16625.98, 'อ่านยอดที่มีเครื่องหมาย ฿ และคอมมาได้', String(mr.total))

  console.log('⑩ เลขล้วนยาว ๆ ที่ไม่มีตัวคั่น ห้ามถือว่าเป็นยอดเงิน (กันเลขภาษีปนมา)')
  const taxish = billIdentity('Total\n65182902\nFederal Tax ID: 77-1234567', 'x')
  ok(taxish.total === null, 'ไม่รับเลข 65182902 เป็นยอดเงิน', String(taxish.total))


  console.log('⑪ PDF ไทยที่แกะข้อความออกมาเพี้ยน (ำ กลายเป็น ํา · วรรณยุกต์หาย) ต้องยังหาป้ายเจอ')
  /* 🔬 ของจริงจากใบ LINE และใบเสร็จ Meta (16 ก.ย. 2569): ข้อความที่แกะได้เขียนว่า
     `จํานวนเงิน฿1,605.0` (ใช้ ํ + า แทน ำ) และ `ชําระแลว` (วรรณยุกต์หาย)
     ⇒ ป้ายภาษาไทยทุกป้ายจะ "ไม่เจอ" เงียบ ๆ ถ้าไม่ทำข้อความให้หลวมก่อนเทียบ */
  const thaiBroken = 'รายละเอียดใบกํากับภาษี\nวันชําระเงิน31/07/2026 12:00\nจํานวนเงิน฿1,605.0'
  const tb = billIdentity(thaiBroken, 'line')
  ok(tb.total === 1605.0, 'อ่านยอดจากป้าย "จํานวนเงิน" (รูปเพี้ยน) ได้', String(tb.total))
  ok(tb.period === '2026-07', 'อ่านเดือนจาก 31/07/2026 ได้ (วันที่ > 12 ⇒ ไม่กำกวม)', String(tb.period))
  ok(tb.key === 'line|p:2026-07|amt:1605', 'ได้กุญแจจากรอบบิล+ยอด', String(tb.key))

  console.log('⑫ วันที่ตัวเลขที่กำกวม (ทั้งวันและเดือน ≤ 12) ⇒ ห้ามเดา')
  const ambiguous = billIdentity('วันชําระเงิน07/08/2026\nจํานวนเงิน฿100.00', 'line')
  ok(ambiguous.period === null, 'ไม่เดาเดือนจาก 07/08/2026', String(ambiguous.period))
  ok(ambiguous.key === null, 'ไม่มีรอบบิล ⇒ ตัดสินไม่ได้ (ไม่เดาว่าไม่ซ้ำ)', String(ambiguous.key))

} catch (e) {
  console.log('❌ เทสพัง:', e?.message ?? e); fail++
} finally {
  rmSync(out, { recursive: true, force: true })
}
console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ไม่ผ่าน ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
