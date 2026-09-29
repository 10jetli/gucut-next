/* คอมไพล์ .ts ของรีโปนี้เพื่อเอามาทดสอบ แล้วชี้ import ที่ระบุไปตัวปลอม
 * (29 ก.ย. 2569 · ยกออกมาเมื่อสำเนาที่ 4 — billreport · billzip · zort-ready-badge · bills-report-route)
 *
 * 🔑 ทำไมต้องรวม: กฎของทีมคือ **สำเนาที่สองคือจุดที่ต้องรวม ไม่ใช่สำเนาที่สิบ**
 *    และท่านี้มีกับดัก 5 ข้อที่ผมเหยียบมาแล้วทุกข้อ ⇒ ถ้าปล่อยให้กระจาย คนถัดไปจะเหยียบใหม่ทุกข้อ
 *
 * ⚠️ กับดักที่ตัวช่วยนี้ปิดให้แล้ว (ทุกข้อเจอจริงวันนี้)
 *   ① `paths` ใส่ทางธงบรรทัดเดียวไม่ได้ ⇒ ต้องเขียน tsconfig ชั่วคราว
 *      ไม่ทำ ⇒ tsc ตอบ TS2307 หา `@/lib/...` ไม่เจอ แล้วเราไปงงว่าโค้ดผิด
 *   ② tsconfig อยู่ใน /tmp ⇒ tsc หา `@types` เองไม่เจอ ⇒ TS2580 "Cannot find name Buffer"
 *   ③ `rootDir` ต้องเป็น **รากรีโป** เพราะ tsc พ่นไฟล์ที่ถูก import ต่อออกมาด้วย
 *      แคบกว่านั้น ⇒ TS6059 "file is not under rootDir"
 *   ④ **ลำดับการแทนที่มีผล** — เติม `.js` ให้พาธสัมพัทธ์ให้เสร็จก่อน แล้วค่อยแทนพาธย่อ
 *      สลับลำดับ ⇒ ได้ `ปลอม-x.js.js` แล้ว Node ตอบว่าหาไฟล์ไม่เจอ (พังด้วยเหตุที่ไม่เกี่ยวกับสิ่งที่ทดสอบ)
 *   ⑤ ต้องไล่แก้ไฟล์ **ทุกชั้น** ใต้ที่ออก ไม่ใช่แค่ชั้นบนสุด (ของที่ถูก import ต่ออยู่ในโฟลเดอร์ย่อย)
 *
 * 🔒 และมันยืนยันให้ว่า **ตัวปลอมถูกต่อจริง** ก่อนคืนผล
 *    ไม่ยืนยัน ⇒ วันหน้ารูป import เปลี่ยน เทสจะพังด้วยข้อความที่อ่านว่า "เทสพัง" ไม่ใช่ "โค้ดผิด"
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * @param {object} o
 * @param {string[]} o.ไฟล์        ไฟล์ .ts ที่จะคอมไพล์ (พาธจากรากรีโป)
 * @param {Record<string,string>} [o.ปลอม]  { 'ชื่อโมดูลที่จะแทน': 'เนื้อโค้ดของตัวปลอม' }
 *        คีย์เป็นชื่อที่เขียนใน import เช่น '@/lib/vendors' หรือ 'next/server'
 * @param {string} [o.ที่ออก]      โฟลเดอร์ที่ออก (ไม่ส่ง = สร้างที่ชั่วคราวให้)
 * @returns {{ ที่ออก: string, พาธของ: (tsRel: string) => string, ซอร์สของ: (tsRel: string) => string }}
 */
export function คอมไพล์เพื่อทดสอบ({ ไฟล์, ปลอม = {}, ที่ออก }) {
  const out = ที่ออก ?? mkdtempSync(join(tmpdir(), `ทดสอบ-${process.pid}-`))
  const tsconfig = join(out, 'tsconfig.json')
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      target: 'es2022', module: 'es2022', moduleResolution: 'bundler', skipLibCheck: true,
      esModuleInterop: true, baseUrl: process.cwd(), paths: { '@/*': ['./*'] },
      typeRoots: [join(process.cwd(), 'node_modules/@types')], types: ['node'],
      rootDir: process.cwd(), outDir: out,
    },
    files: ไฟล์.map((f) => join(process.cwd(), f)),
  }))
  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')

  const ชื่อปลอมของ = {}
  for (const [โมดูล, โค้ด] of Object.entries(ปลอม)) {
    const ชื่อ = `ปลอม-${โมดูล.replace(/[^A-Za-z0-9ก-๙_-]+/g, '-').replace(/^-|-$/g, '')}.js`
    writeFileSync(join(out, ชื่อ), โค้ด)
    ชื่อปลอมของ[โมดูล] = join(out, ชื่อ)
  }

  const ไล่ = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ไล่(join(d, e.name))
      : (e.name.endsWith('.js') && !e.name.startsWith('ปลอม-') ? [join(d, e.name)] : []))
  for (const ที่ of ไล่(out)) {
    let s = readFileSync(ที่, 'utf8')
      .replace(/(from\s+['"]\.[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2')   // ④ ต้องมาก่อน
    for (const [โมดูล, พาธ] of Object.entries(ชื่อปลอมของ)) {
      const หนี = โมดูล.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
      s = s.replace(new RegExp(`(['"])${หนี}\\1`, 'g'), JSON.stringify(พาธ))
    }
    writeFileSync(ที่, s)
  }

  const พาธของ = (tsRel) => join(out, tsRel.replace(/\.ts$/, '.js'))
  /* 🔒 ยืนยันว่าไม่มีชื่อโมดูลที่สั่งปลอมหลงเหลืออยู่ — ถ้าเหลือ แปลว่าการแทนที่ไม่โดน */
  for (const tsRel of ไฟล์) {
    const s = readFileSync(พาธของ(tsRel), 'utf8')
    for (const โมดูล of Object.keys(ปลอม)) {
      if (new RegExp(`['"]${โมดูล.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`).test(s)) {
        throw new Error(`คอมไพล์เพื่อทดสอบ: ต่อตัวปลอมของ "${โมดูล}" ไม่โดนใน ${tsRel}`
          + ' ⇒ รูป import เปลี่ยนไปแล้ว · แก้ที่ตัวช่วยนี้ ไม่ใช่ที่เทสทีละไฟล์')
      }
    }
  }
  return { ที่ออก: out, พาธของ, ซอร์สของ: (tsRel) => readFileSync(พาธของ(tsRel), 'utf8') }
}
