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
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
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
  /* 🔴 ต้อง realpath — บน macOS `tmpdir()` คืน /var/folders/... ซึ่งเป็น symlink
     (ตัวจริงคือ /private/var/...) tsc จะ realpath บางขาแต่ไม่ทุกขา ⇒ คำนวณพาธร่วมเพี้ยน
     แล้วพ่น TS5033 พาธซ้อนสองชั้น (/var/folders/9l/var/folders/9l/...)
     บน g1 ไม่เจอเพราะ /tmp ของ Linux ไม่ใช่ symlink — เจอจริง 5 ต.ค. 2569 เทสตก 11 ไฟล์ทั้งที่โค้ดถูก */
  const out = realpathSync(ที่ออก ?? mkdtempSync(join(tmpdir(), `ทดสอบ-${process.pid}-`)))
  const tsconfig = join(out, 'tsconfig.json')
  /* 🔴 **สืบจาก tsconfig ของรีโป ห้ามคิดค่าเอง** (แก้ 29 ก.ย. 2569 หลังเจอของจริง)
     รุ่นแรกผมตั้ง compilerOptions เองทั้งชุดและ **ลืม `strict: true`** ซึ่งรีโปตั้งไว้
     ⇒ union ที่แคบด้วยธง (`{ผ่าน:true;...} | {ผ่าน:false;เหตุ}`) แคบไม่ได้
     ⇒ tsc ตอบ TS2339 ว่าไม่มีช่อง `เหตุ` **ที่ซอร์สจริง** ทั้งที่ `npm run build` ผ่านสบาย
     🔑 อันตรายสองทิศพร้อมกัน: ได้ error ที่ build ไม่มี · และ **พลาด error ที่ build มี**
        ⇒ เทสที่คอมไพล์ด้วยกฎคนละชุดกับ build คือเทสที่วัดของคนละตัว
     ⇒ ใช้ `extends` แล้วทับเฉพาะที่จำเป็นต่อการรันในที่ชั่วคราว */
  writeFileSync(tsconfig, JSON.stringify({
    extends: join(process.cwd(), 'tsconfig.json'),
    compilerOptions: {
      /* ทับเท่าที่ต้อง: รันด้วย Node ⇒ ต้องเป็นโมดูลที่ Node เข้าใจ และไม่ต้องมี jsx/plugins ของ Next */
      module: 'es2022', moduleResolution: 'bundler', target: 'es2022',
      noEmit: false, jsx: 'react-jsx', plugins: [],
      baseUrl: process.cwd(), paths: { '@/*': ['./*'] },
      typeRoots: [join(process.cwd(), 'node_modules/@types')], types: ['node'],
      rootDir: process.cwd(), outDir: out,
      /* 🔴 ปิด incremental ที่สืบมาจาก tsconfig ของรีโป — เทสคอมไพล์ครั้งเดียวทิ้ง ไม่ต้องมี cache
         เปิดไว้ ⇒ tsc คำนวณที่เก็บ .tsbuildinfo เป็นพาธซ้อน (outDir + พาธเต็มของ config)
         บน g1 พาธซ้อน /tmp/x/tmp/x เขียน "ได้" เลยผ่านเงียบ ๆ · บน Mac ติดสิทธิ์
         mkdir /var/folders/9l/var ⇒ TS5033 ตก 11 ไฟล์ทั้งที่โค้ดถูก (เจอจริง 5 ต.ค. 2569) */
      incremental: false,
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
    /* 🔑 **พาธย่อที่ "ไม่ได้ปลอม" ต้องชี้ไปไฟล์ที่คอมไพเลอร์พ่นเอง** (เติม 29 ก.ย. 2569)
       ตัวช่วยรุ่นแรกแทนเฉพาะโมดูลที่สั่งปลอม ⇒ ของจริงที่ปล่อยให้เป็นของจริง
       ยังเขียนว่า `@/lib/x` ซึ่ง Node แก้ไม่ได้ ⇒ ERR_MODULE_NOT_FOUND
       🔑 และนี่คือสิ่งที่ทำให้ "ใช้ของจริง ปลอมเฉพาะที่จำเป็น" เป็นไปได้
          ซึ่งสำคัญ เพราะการปลอมทุกอย่างทำให้เทสกลายเป็นการทดสอบตัวปลอมของตัวเอง */
    s = s.replace(/(['"])@\/([^'"]+)\1/g, (_m, _q, พาธย่อ) =>
      JSON.stringify(join(out, พาธย่อ.endsWith('.js') ? พาธย่อ : `${พาธย่อ}.js`)))
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
