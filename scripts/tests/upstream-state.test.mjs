#!/usr/bin/env node
/* ตัวตัดสิน "ติดฝั่งไหน" ของสัญญา `?zortlist=` (`lib/upstream-state.ts`)
 * สัญญาร่วมกับฝั่งท่อ ใบ `t_mu1bkrdw` · 4 ต.ค. 2569
 *
 * ⚠️ เทสนี้ยิง **ตัวจริง** ผ่าน `คอมไพล์เพื่อทดสอบ` ไม่ลอกตรรกะมาเขียนใหม่
 *    (ลอกมาเขียนใหม่ = วัดตัวตัดสินอีกตัวที่ไม่มีใครใช้)
 *
 * 🔒 สิ่งที่ตรึงไว้ — **สี่สถานะต้องแยกออกจากกันครบสี่ทาง**
 *    ค่าที่ท่อส่งจริง (วัด 4 ต.ค. 2569):
 *      HTTP 200 ⇒ upstreamOk true  · retryable false
 *      HTTP 503 ⇒ upstreamOk false · retryable true   (ZORT ล้ม · มี zortCode 500)
 *      HTTP 400 ⇒ upstreamOk null  · retryable false  (ยังไม่ได้ถาม ZORT)
 *      ท่อรุ่นเก่า ⇒ ไม่มีช่องเลย
 *    🔑 ข้อที่สำคัญที่สุดคือ **null ต้องไม่ถูกจัดเป็น 'ปลายทางล้ม'**
 *       เพราะนั่นทำให้จอเขียนว่า ZORT ตอบผิดพลาด ทั้งที่ ZORT ไม่เคยถูกถาม
 *       ⇒ คนจะไปรอ/แจ้ง ZORT แทนที่จะแก้คำขอของเราเอง
 */
import { rmSync } from 'node:fs'
import { คอมไพล์เพื่อทดสอบ } from '../lib/คอมไพล์เพื่อทดสอบ.mjs'

let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}

const ไฟล์ = 'lib/upstream-state.ts'
let ฝั่งที่ติดจาก, ควรลองใหม่, ที่ออก
try {
  const ผล = คอมไพล์เพื่อทดสอบ({ ไฟล์: [ไฟล์], ปลอม: {} })
  ที่ออก = ผล.ที่ออก
  ;({ ฝั่งที่ติดจาก, ควรลองใหม่ } = await import(ผล.พาธของ(ไฟล์)))
} catch (e) {
  console.log('🔴 โหลดตัวจริงไม่ได้:', String(e?.message ?? e).slice(0, 200))
  process.exit(1)
}

console.log('① ค่าจริงจากท่อ — ต้องแยกครบสี่ทาง')
ok('200 upstreamOk=true ⇒ สำเร็จ', ฝั่งที่ติดจาก({ upstreamOk: true, retryable: false }) === 'สำเร็จ')
ok('503 upstreamOk=false ⇒ ปลายทางล้ม', ฝั่งที่ติดจาก({ upstreamOk: false, retryable: true }) === 'ปลายทางล้ม')
ok('400 upstreamOk=null ⇒ คำขอเราผิด (ห้ามโทษ ZORT)',
  ฝั่งที่ติดจาก({ upstreamOk: null, retryable: false }) === 'คำขอเราผิด')
ok('ท่อรุ่นเก่า (ไม่มีช่อง) ⇒ ยังไม่รู้ฝั่ง', ฝั่งที่ติดจาก({}) === 'ยังไม่รู้ฝั่ง')

console.log('② 🔑 null ต้องไม่ถูกกลืนเป็น "ปลายทางล้ม" — ข้อที่ truthiness จะทำพลาด')
ok('null ≠ ปลายทางล้ม', ฝั่งที่ติดจาก({ upstreamOk: null }) !== 'ปลายทางล้ม')
ok('undefined ≠ ปลายทางล้ม', ฝั่งที่ติดจาก({ upstreamOk: undefined }) !== 'ปลายทางล้ม')
ok('null ≠ undefined (สองสถานะนี้ต้องให้คำตอบต่างกัน)',
  ฝั่งที่ติดจาก({ upstreamOk: null }) !== ฝั่งที่ติดจาก({ upstreamOk: undefined }))

console.log('③ ท่อรุ่นเก่าที่ส่ง unknown:true — รู้ว่าไม่รู้ แต่ไม่รู้ว่าฝั่งไหน')
ok('unknown:true แต่ไม่มี upstreamOk ⇒ ยังไม่รู้ฝั่ง (ห้ามเดาว่า ZORT ล้ม)',
  ฝั่งที่ติดจาก({ unknown: true }) === 'ยังไม่รู้ฝั่ง')

console.log('④ คำแนะนำลองใหม่ — ท่อไม่บอก ห้ามแนะนำ')
ok('retryable=true ⇒ true', ควรลองใหม่({ retryable: true }) === true)
ok('retryable=false ⇒ false', ควรลองใหม่({ retryable: false }) === false)
ok('ไม่มีช่อง retryable ⇒ null (ไม่ใช่ false)', ควรลองใหม่({}) === null)
ok('null ไม่เท่ากับ false', ควรลองใหม่({}) !== false)

console.log('⑤ ตัวควบคุมลบ — ของที่ไม่มีคำตอบ')
ok('null/undefined ทั้งก้อน ⇒ ยังไม่รู้ฝั่ง', ฝั่งที่ติดจาก(null) === 'ยังไม่รู้ฝั่ง' && ฝั่งที่ติดจาก(undefined) === 'ยังไม่รู้ฝั่ง')
ok('ก้อนว่าง ⇒ ควรลองใหม่เป็น null', ควรลองใหม่(null) === null)

try { if (ที่ออก) rmSync(ที่ออก, { recursive: true, force: true }) } catch {}
console.log(ตก ? `\n🔴 ตก ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
