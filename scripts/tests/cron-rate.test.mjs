/* ทดสอบตัวนับ "รอบต่อวัน" จาก cron — รัน: node scripts/tests/cron-rate.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: เลขนี้จะไปอยู่บนจอที่คนใช้ตัดสินว่า "ควรลดรอบงานไหน"
 *    นับผิดทางสูง ⇒ ไปลดงานที่ไม่ได้แพง · นับผิดทางต่ำ ⇒ ปล่อยตัวที่แพงจริงไว้
 *    และไม่มีอะไรบนจอจะฟ้อง เพราะเลขดูสมเหตุสมผลเสมอ
 *
 * 🔑 เทียบกับ cron จริงที่ท่อใช้อยู่ ณ 19 ก.ย. 2569 (ยิงจาก `?crontable=1`)
 *    ไม่ใช่ตัวอย่างที่แต่งขึ้น ⇒ วันไหนสูตรเพี้ยน เทสจะฟ้องด้วยเคสของจริง
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-cron-rate')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/cron-rate.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { รอบต่อวัน, ป้ายรอบต่อวัน } = await import(join(out, 'cron-rate.js'))

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }

  console.log('① cron จริงของท่อ (19 ก.ย. 2569) — ต้องได้เลขที่นับมือแล้วตรง')
  {
    const จริง = [
      ['*/15 * * * *', 96, 'stock-push-sweep'],
      ['5,20,35,50 * * * *', 96, 'stock-push-sweep-shopee'],
      ['10,25,40,55 * * * *', 96, 'stock-push-sweep-tiktok'],
      ['*/30 * * * *', 48, 'beam-sweep'],
      ['13 * * * *', 24, 'core-sync'],
      ['19 * * * *', 24, 'contacts-sync'],
      ['50 * * * *', 24, 'slips-sync'],
      ['7 */3 * * *', 8, 'returns-sync'],
      ['40 */6 * * *', 4, 'backup-run'],
      ['0 3 * * *', 1, 'bundle-recipe-sync'],
      ['30 20 * * *', 1, 'token-refresh'],
    ]
    for (const [c, n, ชื่อ] of จริง) {
      ok(`${ชื่อ} (${c}) ⇒ ${n}`, รอบต่อวัน(c) === n, `ได้ ${รอบต่อวัน(c)}`)
    }
    const รวม = จริง.reduce((a, [c]) => a + (รอบต่อวัน(c) ?? 0), 0)
    ok('รวม 11 งานนี้ = 422 รอบ/วัน', รวม === 422, `ได้ ${รวม}`)
  }

  console.log('② 🔴 อ่านไม่ออก ⇒ null ไม่ใช่ 0 (0 อ่านได้ว่า "ไม่วิ่งเลย")')
  {
    ok('ว่าง ⇒ null', รอบต่อวัน('') === null)
    ok('ไม่ใช่สตริง ⇒ null', รอบต่อวัน(undefined) === null && รอบต่อวัน(null) === null)
    ok('ช่องไม่ครบ 5 ⇒ null', รอบต่อวัน('* * * *') === null)
    ok('คำที่ไม่ใช่ตัวเลข ⇒ null', รอบต่อวัน('@hourly') === null)
    ok('นาทีเกินช่วง ⇒ null', รอบต่อวัน('60 * * * *') === null)
    ok('ชั่วโมงเกินช่วง ⇒ null', รอบต่อวัน('0 24 * * *') === null)
    ok('ช่วงกลับหัว ⇒ null', รอบต่อวัน('0 5-2 * * *') === null)
  }

  console.log('③ 🔴 งานที่ไม่ได้วิ่งทุกวัน ⇒ ตัดสินไม่ได้ ห้ามตอบเป็นเลขของวันที่มันวิ่ง')
  {
    ok('ระบุวันในสัปดาห์ ⇒ null', รอบต่อวัน('0 3 * * 1') === null)
    ok('ระบุวันที่ ⇒ null', รอบต่อวัน('0 3 1 * *') === null)
    ok('ระบุเดือน ⇒ null', รอบต่อวัน('0 3 * 1 *') === null)
  }

  console.log('④ ค่าซ้ำในรายการต้องไม่ถูกนับสองรอบ')
  {
    ok('5,5,5 ⇒ 24 ไม่ใช่ 72', รอบต่อวัน('5,5,5 * * * *') === 24, `ได้ ${รอบต่อวัน('5,5,5 * * * *')}`)
    ok('*/30 กับ 0,30 ได้เท่ากัน', รอบต่อวัน('*/30 * * * *') === รอบต่อวัน('0,30 * * * *'))
  }

  console.log('⑤ ป้ายบนจอ — ตัดสินไม่ได้ต้องขึ้นขีด ไม่ใช่ "0 รอบ/วัน"')
  {
    ok('อ่านไม่ออก ⇒ —', ป้ายรอบต่อวัน('@daily') === '—', ป้ายรอบต่อวัน('@daily'))
    ok('อ่านออก ⇒ มีหน่วย', ป้ายรอบต่อวัน('*/15 * * * *') === '96 รอบ/วัน', ป้ายรอบต่อวัน('*/15 * * * *'))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}
console.log(fail ? `\n🛑 ตก ${fail} ข้อ` : '\n✅ ตัวนับรอบต่อวันผ่านครบ')
process.exit(fail ? 1 : 0)
