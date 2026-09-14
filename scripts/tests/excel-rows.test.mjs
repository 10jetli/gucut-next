/* ทดสอบตัวแปลงไฟล์ Excel/CSV → rows ขาเข้าท่อ ?batch= — รัน: node scripts/tests/excel-rows.test.mjs
 * งานกระดาน t_mu0qjely · ต้นแบบ codex (cdb74f4) · รีวิว+แก้โดย CEO 14 ก.ย. 2569
 *
 * ⚠️ ไฟล์ต้นฉบับเป็น .ts ⇒ แปลงด้วย tsc ของโปรเจกต์ แล้วทดสอบไฟล์ที่แปลงจากของจริง (แบบเดียวกับ staff-token.test.mjs)
 * ⚠️ ต่างจาก staff-token: ต้องแปลง**ลงโฟลเดอร์ในโปรเจกต์** ไม่ใช่ /tmp
 *    เพราะ excel-rows.ts import 'jszip' — ไฟล์ที่แปลงไปอยู่ /tmp จะหา node_modules ไม่เจอแล้วพังตอน import
 *    ⇒ ลบโฟลเดอร์ทิ้งท้ายเทสเสมอ (อยู่ใน finally)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'

const out = join(process.cwd(), 'scripts', 'tests', '.out-excel-rows')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/excel-rows.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'es2020,dom',
    '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { parseCsv, mapImportRows, parseXlsxBuffer } = await import(join(out, 'excel-rows.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }
  const J = (v) => JSON.stringify(v)

  console.log('① CSV: quote · ขึ้นบรรทัดใน quote · BOM')
  {
    const t = parseCsv('﻿รหัสสินค้า,ชื่อสินค้า\n"A,1","ชื่อ ""มี"" คำพูด\nสองบรรทัด"\n')
    ok('ตัด BOM ออกจากหัวคอลัมน์แรก', t[0][0] === 'รหัสสินค้า', J(t[0][0]))
    ok('คอมมาใน quote ไม่แยกคอลัมน์', t[1][0] === 'A,1', J(t[1]))
    ok('"" ใน quote = " ตัวเดียว และขึ้นบรรทัดได้', t[1][1] === 'ชื่อ "มี" คำพูด\nสองบรรทัด', J(t[1][1]))
  }

  console.log('② สินค้า/ผู้ติดต่อ: รูปขาเข้าจากจอ · error บอกเลขแถวจริงของไฟล์')
  {
    const r = mapImportRows('product', parseCsv('sku,name,price,cost,หน่วย\nP1,สินค้าหนึ่ง,"1,500",980,ชิ้น\n,ไม่มีรหัส,10,,\nP3,สาม,abc,,\n'))
    ok('แถวดีได้รูปตามท่อ ?addproduct', r.rows[0].sku === 'P1' && r.rows[0].price === 1500 && r.rows[0].cost === 980 && r.rows[0].unit === 'ชิ้น', J(r.rows[0]))
    ok('ไม่มี sku ⇒ error แถว 3 (นับหัวตาราง = แถว 1)', r.errors.some((e) => e.row === 3 && e.field === 'sku'), J(r.errors))
    ok('ราคาไม่ใช่ตัวเลข ⇒ error แถว 4', r.errors.some((e) => e.row === 4 && e.field === 'ราคา'), J(r.errors))
    const c = mapImportRows('contact', parseCsv('รหัสผู้ติดต่อ,ชื่อ,โทรศัพท์\nC1,ร้านเอ,0812345678\n'))
    ok('ผู้ติดต่อได้รูปตามท่อ ?addcontact', c.rows[0].code === 'C1' && c.rows[0].name === 'ร้านเอ' && c.rows[0].phone === '0812345678', J(c.rows[0]))
  }

  console.log('③ 🔴 ใบขายหลายบรรทัด: แถวที่เลขอ้างอิงเดียวกันต้องรวมเป็นใบเดียว')
  {
    const csv = 'เลขอ้างอิง,ลูกค้า,sku,name,qty,price\nS-1,ร้านเอ,A,หนึ่ง,1,10\nS-1,,B,สอง,2,20\nS-2,ร้านบี,C,สาม,3,30\nS-1,ร้านเอ,D,สี่,4,40\n'
    const r = mapImportRows('sale', parseCsv(csv))
    ok('ได้ 2 ใบ ไม่ใช่ 4 ใบ', r.rows.length === 2, J(r.rows.map((x) => x.ref)))
    const s1 = r.rows.find((x) => x.ref === 'S-1')
    ok('ใบ S-1 มี 3 บรรทัดครบตามลำดับ (แม้แถวไม่ติดกัน)', J(s1?.items.map((i) => i.sku)) === J(['A', 'B', 'D']), J(s1?.items))
    ok('ลูกค้าของใบมาจากแถวที่มีค่า', s1?.customer === 'ร้านเอ', J(s1))
    ok('ไม่คิดยอดเงินในตัวแปลง (ไม่มี amount/totalprice)', !('amount' in (s1 ?? {})) && !s1?.items.some((i) => 'totalprice' in i), J(s1))
    const bad = mapImportRows('sale', parseCsv('เลขอ้างอิง,ลูกค้า,sku,name,qty,price\nS-9,ร้านเอ,A,หนึ่ง,1,10\nS-9,ร้านบี,B,สอง,1,10\n'))
    ok('ลูกค้าในใบเดียวกันไม่ตรงกัน ⇒ error และไม่ส่งใบนั้น', bad.errors.some((e) => e.field === 'customer') && bad.rows.length === 0, J(bad))
    const po = mapImportRows('po', parseCsv('เลขที่ใบ,ผู้ขาย,sku,name,qty,price\nPO-7,โรงงาน,A,หนึ่ง,5,1\nPO-7,,B,สอง,5,2\n'))
    ok('ใบซื้อรวมด้วยเลขที่ใบได้ และรูปตาม ?addpo (vendor)', po.rows.length === 1 && po.rows[0].vendor === 'โรงงาน' && po.rows[0].items.length === 2, J(po.rows))
  }

  console.log('④ 🔴 ref อัตโนมัติไม่มีเลขแถว: แทรกแถวแล้วอัปไฟล์เดิมซ้ำ ref ของแถวเดิมต้องไม่เปลี่ยน')
  {
    const head = 'sku,name,qty,price\n'
    const a = mapImportRows('sale', parseCsv(`${head}A,หนึ่ง,1,10\nB,สอง,2,20\n`))
    const b = mapImportRows('sale', parseCsv(`${head}Z,แทรกใหม่,9,99\nA,หนึ่ง,1,10\nB,สอง,2,20\n`))
    const refOf = (r, sku) => r.rows.find((x) => x.items[0].sku === sku)?.ref
    ok('ref ของ A เท่าเดิม', refOf(a, 'A') && refOf(a, 'A') === refOf(b, 'A'), `${refOf(a, 'A')} vs ${refOf(b, 'A')}`)
    ok('ref ของ B เท่าเดิม', refOf(a, 'B') && refOf(a, 'B') === refOf(b, 'B'), `${refOf(a, 'B')} vs ${refOf(b, 'B')}`)
    ok('ref ไม่มีเลขแถวติดอยู่', !/-[23]-/.test(String(refOf(a, 'A'))), refOf(a, 'A'))
    const dup = mapImportRows('contact', parseCsv('code,name\nC1,ซ้ำ\nC1,ซ้ำ\n'))
    ok('แถวเหมือนกันทุกช่องได้ ref ต่างกัน (ไม่ถูกกันซ้ำทิ้งเงียบ ๆ)', dup.rows.length === 2 && dup.rows[0].ref !== dup.rows[1].ref, J(dup.rows.map((x) => x.ref)))
    const kinds = mapImportRows('product', parseCsv('sku,name\nX,เอ็กซ์\n')).rows[0].ref !== mapImportRows('contact', parseCsv('code,name\nX,เอ็กซ์\n')).rows[0].ref
    ok('เนื้อหาเดียวกันคนละชนิดได้ ref ต่างกัน', kinds)
  }

  console.log('⑤ 🔴 ใบเสนอราคา: ราคาบังคับ · ลูกค้าบังคับ · เลขที่ใบไม่ถูกส่ง')
  {
    const csv = 'เลขที่ใบ,ลูกค้า,sku,name,qty,price,โทรศัพท์,เอกสารอ้างอิง,หมายเหตุ\n'
      + 'Q-1,ร้านเอ,A,หนึ่ง,1,10,0812345678,PO-99,ส่งด่วน\n'
      + 'Q-1,,B,สอง,2,20,,,\n'
    const r = mapImportRows('quotation', parseCsv(csv))
    ok('รวมเป็นใบเดียว 2 บรรทัด', r.rows.length === 1 && r.rows[0].items.length === 2, J(r.rows))
    ok('ได้รูปตามท่อ ?addquotation (customer + items)', r.rows[0].customer === 'ร้านเอ', J(r.rows[0]))
    ok('ช่องเสริมมาจากแถวแรกที่มีค่า ไม่ต้องกรอกซ้ำทุกบรรทัด',
      r.rows[0].phone === '0812345678' && r.rows[0].reference === 'PO-99' && r.rows[0].note === 'ส่งด่วน', J(r.rows[0]))
    ok('🔴 ไม่ส่ง number ไป ZORT (เส้นใบเสนอราคาไม่มีช่องนี้)', !('number' in r.rows[0]), J(r.rows[0]))
    ok('มีคำเตือนว่าเลขที่ใบไม่ถูกส่ง (ไม่ทิ้งเงียบ)', r.warnings.some((w) => /เลขที่ใบ/.test(w)), J(r.warnings))

    /* 🔴 เคสที่ใบนี้เกิดมาเพื่อกัน: ราคาหาย ⇒ ZORT สร้างใบ ฿0 ที่ลบไม่ได้ */
    const noPrice = mapImportRows('quotation', parseCsv('ลูกค้า,sku,name,qty,price\nร้านบี,A,หนึ่ง,1,\n'))
    ok('🔴 ไม่มีราคา ⇒ error และไม่ส่งแถวนั้น (กันใบ ฿0)',
      noPrice.rows.length === 0 && noPrice.errors.some((e) => e.field === 'price'), J(noPrice))
    const zero = mapImportRows('quotation', parseCsv('ลูกค้า,sku,name,qty,price\nร้านบี,A,หนึ่ง,1,0\n'))
    ok('ราคา 0 ที่ "ตั้งใจใส่" ยังส่งได้ (ต่างจากราคาหาย)', zero.rows.length === 1 && zero.rows[0].items[0].price === 0, J(zero))

    const noCust = mapImportRows('quotation', parseCsv('เลขอ้างอิง,sku,name,qty,price\nQ-2,A,หนึ่ง,1,10\n'))
    ok('ไม่มีลูกค้า ⇒ error บอกเลขแถว และไม่ส่งใบนั้น',
      noCust.rows.length === 0 && noCust.errors.some((e) => e.field === 'customer'), J(noCust))
    const longC = mapImportRows('quotation', parseCsv(`ลูกค้า,sku,name,qty,price\n${'ก'.repeat(161)},A,หนึ่ง,1,10\n`))
    ok('ชื่อลูกค้ายาวเกิน 160 ⇒ ตีกลับที่จอ ไม่ปล่อยให้ท่อปฏิเสธแล้วคนงง',
      longC.rows.length === 0 && longC.errors.some((e) => e.field === 'customer'), J(longC.errors))
  }

  console.log('⑥ xlsx จริง (สร้างด้วย jszip): ลำดับ attribute · inlineStr · entity · หลายชีตต้องเตือน')
  {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="ขาย" sheetId="1"/><sheet name="อื่น" sheetId="2"/></sheets></workbook>')
    zip.file('xl/sharedStrings.xml',
      '<sst><si><t>รหัสสินค้า</t></si><si><t>ชื่อสินค้า</t></si><si><r><t>ราคา</t></r></si><si><t>ชื่อ &amp; &apos;พิเศษ&apos; &#3585;</t></si>' +
      /* 🔴 ตัวแยกแยะลำดับการถอด: ในไฟล์เขียนว่า &amp;lt; = คนพิมพ์ตัวอักษร "&lt;" จริง ๆ
         ถอด &amp; ก่อน = ได้ "<" (ถอดสองชั้น ผิด) · ถอดท้ายสุด = ได้ "&lt;" (ถูก)
         (mutation รอบแรกไม่แดงเพราะไม่มีเคสนี้ — "&amp;" เดี่ยว ๆ ถอดลำดับไหนก็ได้ผลเท่ากัน) */
      '<si><t>ขนาด &amp;lt;10cm</t></si></sst>')
    zip.file('xl/worksheets/sheet1.xml',
      '<worksheet><sheetData>' +
      '<row r="1"><c t="s" r="A1"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>P9</t></is></c><c t="s" r="B2"><v>3</v></c><c r="C2"><v>125.5</v></c><c r="D2" t="s"><v>4</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>P10</t></is></c><c r="B3"/><c r="C3"><v>7</v></c></row>' +
      '</sheetData></worksheet>')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const { table, warnings } = await parseXlsxBuffer(bytes)
    ok('t="s" ที่อยู่ก่อน r= ยังอ่านได้ (หัวคอลัมน์ครบ)', J(table[0]) === J(['รหัสสินค้า', 'ชื่อสินค้า', 'ราคา']), J(table[0]))
    ok('inlineStr อ่านได้ ไม่ว่างเงียบ', table[1][0] === 'P9', J(table[1]))
    ok("ถอด &amp; &apos; และ &#3585; (ก) ครบ", table[1][1] === "ชื่อ & 'พิเศษ' ก", J(table[1][1]))
    ok('🔴 ไม่ถอดสองชั้น: &amp;lt; ต้องได้ตัวอักษร "&lt;" ไม่ใช่ "<"', table[1][3] === 'ขนาด &lt;10cm', J(table[1][3]))
    ok('ช่องปิดตัวเอง <c/> = ว่าง ไม่ทำคอลัมน์เลื่อน', table[2][1] === '' && table[2][2] === '7', J(table[2]))
    ok('ไฟล์มี 2 ชีต ⇒ มีคำเตือน', warnings.some((w) => /2 ชีต/.test(w)), J(warnings))
    const r = mapImportRows('product', table)
    ok('ต่อจาก xlsx เป็น rows สินค้าได้ · ราคาเป็นตัวเลข', r.rows[0]?.sku === 'P9' && r.rows[0]?.price === 125.5, J(r.rows))
    ok('แถวที่ไม่มีชื่อ ⇒ error แถว 3', r.errors.some((e) => e.row === 3 && e.field === 'name'), J(r.errors))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
