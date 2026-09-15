/* ทดสอบการแยกสาเหตุของ "ดึงเอกสารรายใบไม่สำเร็จ" — รัน: node scripts/tests/doc-error.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ข้อความสามแบบนี้พาคนไปทำคนละอย่าง
 *    เลขผิดรูป ⇒ แก้เลข · ติดต่อ ZORT ไม่ได้ ⇒ ลองใหม่ · ZORT ไม่ส่งใบ ⇒ อาจไม่มีใบ
 *    ถ้าเผลอรวมเป็นประโยคเดียว คนจะสรุปเองว่า "ไม่มีใบนี้" — ผิดได้ทั้งสองทาง
 *    และมีข้อห้ามชัดจากฝั่งท่อ: **ห้ามเขียนว่า "ไม่มีใบนี้" เพราะ ZORT ไม่ส่งใบมา**
 *
 * ⚠️ กับดักของจริง: คำตอบที่ล้มเหลว **มาเป็น HTTP 200 + ok:false** (ยิงเห็นเอง 15 ก.ย. 2569)
 *    ⇒ ตัวที่ดูแต่ res.ok จะคิดว่าสำเร็จ ⇒ เทสข้อ ① ดักไว้
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-doc-error')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/doc-error.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { docErrorView, isDocFail } = await import(join(out, 'doc-error.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail += 1 }
  }

  // ① ล้มเหลวทั้งที่ HTTP 200 — ของจริงเป็นแบบนี้ทุกเคสที่ยิงเจอ
  ok('ok:false ที่มากับ HTTP 200 ⇒ นับว่าล้มเหลว',
    isDocFail({ ok: false, error: 'x' }, true) === true)
  ok('คำตอบปกติ ⇒ ไม่ใช่ความล้มเหลว', isDocFail({ ok: true, number: 'TR-1' }, true) === false)
  ok('คำตอบเป็น null ⇒ ล้มเหลว', isDocFail(null, true) === true)
  ok('HTTP ไม่ ok แม้ก้อนดูปกติ ⇒ ล้มเหลว', isDocFail({ number: 'TR-1' }, false) === true)

  // ② เลขผิดรูป — ของจริง: {ok:false, badId:true} (ยิง ?transfer=abc 15 ก.ย. 2569)
  const bad = docErrorView({ ok: false, badId: true, error: 'id ของใบโอนต้องเป็นตัวเลขของ ZORT (ได้มา "abc")' })
  ok('badId ⇒ kind = badId', bad.kind === 'badId', bad.kind)
  ok('badId ⇒ บอกว่ายังไม่ได้ถาม ZORT', bad.text.includes('ยังไม่ได้ถาม ZORT'))
  ok('badId ⇒ ไม่พูดว่า ZORT ล่ม', !bad.text.includes('ล่ม') || bad.next.includes('ไม่ใช่เรื่องที่ ZORT ล่ม'))

  // ③ ติดต่อ ZORT ไม่ได้ ⇒ ต้องบอกว่า "ยังไม่รู้"
  const unk = docErrorView({ ok: false, unknown: true, error: 'อ่านคำตอบจาก ZORT ไม่ได้' })
  ok('unknown ⇒ kind = unknown', unk.kind === 'unknown', unk.kind)
  ok('unknown ⇒ บอกว่ายังไม่รู้ว่ามีใบไหม', unk.title.includes('ยังไม่รู้'))

  // ④ ZORT ตอบแต่ไม่ส่งใบ — ของจริง: error "ZORT ตอบมาแต่หาหัวใบไม่เจอ"
  const refused = docErrorView({ ok: false, error: 'ZORT ตอบมาแต่หาหัวใบไม่เจอ', fields: ['resCode'] })
  ok('ZORT ไม่ส่งใบ ⇒ kind = zortRefused', refused.kind === 'zortRefused', refused.kind)
  ok('ZORT ไม่ส่งใบ ⇒ เปิดไว้สองทาง (เลขผิด หรือ ไม่มีใบ)',
    refused.next.includes('อาจพิมพ์เลขผิด') && refused.next.includes('ไม่มีใบนี้'))

  // 🔴 ข้อห้ามหลัก: ทุกแบบต้องไม่มีประโยคฟันธงว่า "ไม่มีใบนี้"
  for (const [name, v] of [['badId', bad], ['unknown', unk], ['zortRefused', refused],
    ['other', docErrorView({ ok: false }, 500)]]) {
    const all = `${v.title} ${v.text} ${v.next}`
    const fined = /(^|[^า])ไม่มีใบนี้(?!\s*—|.*ยังสรุปไม่ได้|.*อาจ)/.test(all)
      && !all.includes('ยังสรุปไม่ได้') && !all.includes('อาจพิมพ์เลขผิด')
    ok(`${name} ⇒ ไม่ฟันธงว่า "ไม่มีใบนี้"`, !fined, all.slice(0, 80))
  }

  // ⑤ มีข้อมูลของ ZORT มาด้วย ⇒ ต้องเอาไปโชว์ให้เอาไปถามต่อได้
  const withCode = docErrorView({ ok: false, zortStatus: 400, zortCode: '100', zortDesc: 'Access Denied.' })
  ok('มี zortStatus ⇒ โชว์สถานะ', withCode.text.includes('400'), withCode.text)
  ok('มี zortCode/zortDesc ⇒ โชว์ทั้งคู่',
    withCode.text.includes('100') && withCode.text.includes('Access Denied.'), withCode.text)

  // ⑥ ไม่รู้สาเหตุ ⇒ ยังต้องบอกว่ายังไม่รู้ว่ามีใบหรือไม่ ห้ามเงียบ
  const other = docErrorView({ ok: false }, 502)
  ok('ไม่มีข้อมูลอะไรเลย ⇒ kind = other และบอก HTTP', other.kind === 'other' && other.text.includes('502'), other.text)
  ok('other ⇒ ยังบอกว่ายังไม่รู้ว่าใบมีอยู่ไหม', other.next.includes('ยังไม่รู้'))
} finally {
  rmSync(out, { recursive: true, force: true })
}
if (fail) { console.error(`\n❌ แยกสาเหตุเอกสารรายใบ: ไม่ผ่าน ${fail} ข้อ`); process.exit(1) }
console.log('✅ แยกสาเหตุเอกสารรายใบ: ผ่านทุกข้อ')
