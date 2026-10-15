#!/usr/bin/env node
/* ตัวแปลงรหัสคลัง → ชื่อคลัง (`lib/warehouse-names.ts`) — ใช้ร่วม 3 จอ (โอนสินค้า · ใบโอน · ขาย)
 * 🔑 สามสถานะ: ได้ชื่อ · คลังไม่มีชื่อ (ใช้รหัส) · อ่านคำตอบไม่ได้ (ต้องบอกบนจอ ห้ามอ่านรหัสเป็นชื่อ)
 * รูปคำตอบจริงวัด 15 ต.ค. 2569: {warehouses:[{code:'NEW',name:'โกดัง'},{code:'KLD',name:'KLD'},{code:'ANJ',name:'ANJ'}]} */
import { ชื่อคลังจากคำตอบ } from '../../lib/warehouse-names.ts'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}
const จริง = { warehouses: [{ code: 'NEW', name: 'โกดัง' }, { code: 'KLD', name: 'KLD' }, { code: 'ANJ', name: 'ANJ' }] }
const ก = ชื่อคลังจากคำตอบ(จริง)
ok('NEW ⇒ โกดัง', ก.names.NEW === 'โกดัง', JSON.stringify(ก.names))
ok('ได้ครบ 3 คลัง', Object.keys(ก.names).length === 3)
ok('อ่านได้ ⇒ อ่านไม่ได้ = false', ก.อ่านไม่ได้ === false)
ok('คลังไม่มีชื่อ ⇒ ใช้รหัส', ชื่อคลังจากคำตอบ({ warehouses: [{ code: 'X1' }] }).names.X1 === 'X1')
for (const [ป้าย, ค่า] of [['null', null], ['ก้อนเปล่า', {}], ['error', { error: 'boom' }], ['warehouses ไม่ใช่อาร์เรย์', { warehouses: 'x' }]]) {
  const ผ = ชื่อคลังจากคำตอบ(ค่า)
  ok(`${ป้าย} ⇒ อ่านไม่ได้ (ไม่ใช่ "ไม่มีคลัง")`, ผ.อ่านไม่ได้ === true && Object.keys(ผ.names).length === 0)
}
ok('อาร์เรย์ว่าง ⇒ อ่านได้ แต่ไม่มีคลัง (คนละเรื่องกับอ่านไม่ได้)', ชื่อคลังจากคำตอบ({ warehouses: [] }).อ่านไม่ได้ === false)
console.log(ตก ? `\n🔴 ตก ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
