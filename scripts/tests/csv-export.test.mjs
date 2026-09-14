/* ทดสอบตัวส่งออกตาราง — รัน: node scripts/tests/csv-export.test.mjs
 *
 * 🔴 **ทำไมต้องมีเทส**: ไฟล์ที่ส่งออกไปแล้ว **ออกนอกระบบทันที**
 *    คนเอาไปเปิดใน Excel เอาไปเทียบยอด เอาไปส่งบัญชี — ไม่มีใครกลับมาดูว่าจอบอกอะไร
 *    ⇒ ความผิดในไฟล์จะไม่ถูกจับได้เลย ต่างจากบนจอที่ยังมีคนทัก
 *
 * กฎสามข้อที่ฝั่งท่อกำชับ และเทสนี้คุมไว้ทีละข้อ:
 *   ① ครบทุกหน้าตามตัวกรอง · ไม่ครบต้องเขียนลงไฟล์ว่าได้กี่แถวจากกี่แถว
 *   ② ช่องที่ท่อไม่ส่ง = เว้นว่าง **ห้ามเป็น 0**
 *   ③ เวลาเป็นเวลาไทย (ท่อส่ง UTC)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-csv')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/csv-export.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const m = await import(join(out, 'csv-export.js'))
  const { cellText, thaiTimeCell, buildCsv, fetchAllPages, coverageText } = m

  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  ✅ ${name}`)
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }

  console.log('① 🔴 ช่องที่ท่อไม่ส่ง = เว้นว่าง ห้ามเป็น 0')
  {
    ok('null ⇒ ว่าง', cellText(null) === '', JSON.stringify(cellText(null)))
    ok('undefined ⇒ ว่าง', cellText(undefined) === '')
    ok('🔴 0 จริง ⇒ "0" (ศูนย์จริงต้องไม่หายไป)', cellText(0) === '0')
    ok('NaN ⇒ ว่าง (ไม่ใช่ "NaN" ในไฟล์)', cellText(NaN) === '')
    ok('ข้อความว่าง ⇒ ว่าง', cellText('') === '')
    /* ราคาทุนที่ยังไม่กรอก 281 ตัว — ถ้ากลายเป็น 0 คนคิดกำไรเกินจริงทั้งไฟล์ */
    const csv = buildCsv({ filename: 'x', header: ['รหัส', 'ราคาทุน'], rows: [['A', null], ['B', 0]] })
    ok('🔴 แถวที่ไม่รู้ราคาทุน กับแถวที่ทุน 0 ต้องต่างกันในไฟล์',
      csv.includes('"A",""') && csv.includes('"B","0"'), csv)
  }

  console.log('② 🔴 เวลาไทย (ท่อส่ง UTC)')
  {
    ok('มี Z', thaiTimeCell('2026-09-14T12:00:00Z') === '14/09/2569 19:00', thaiTimeCell('2026-09-14T12:00:00Z'))
    ok('ไม่มีโซน (รูปที่ท่อส่งจริง) ⇒ ถือเป็น UTC',
      thaiTimeCell('2026-09-14 12:00:00') === '14/09/2569 19:00', thaiTimeCell('2026-09-14 12:00:00'))
    ok('🔴 ข้ามวันเมื่อ +7 แล้วเลยเที่ยงคืน',
      thaiTimeCell('2026-09-14T17:30:00Z') === '15/09/2569 00:30', thaiTimeCell('2026-09-14T17:30:00Z'))
    ok('ค่าว่าง/อ่านไม่ออก ⇒ เว้นว่าง (ไม่ใช่วันที่มั่ว)',
      thaiTimeCell('') === '' && thaiTimeCell('ไม่ใช่เวลา') === '' && thaiTimeCell(null) === '')
  }

  console.log('③ 🔴 ต้องครบทุกหน้า — และถ้าไม่ครบต้องบอก')
  {
    const make = (total) => async (offset, limit) => ({
      rows: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => offset + i),
      total,
    })
    const a = await fetchAllPages(make(450), { limit: 200 })
    ok('450 แถว เพดานหน้าละ 200 ⇒ ได้ครบ 450', a.rows.length === 450 && a.coverage.got === 450, JSON.stringify(a.coverage))
    ok('   และบอกว่าครบ', coverageText(a.coverage).startsWith('ครบทุกแถว'), coverageText(a.coverage))

    const b = await fetchAllPages(make(10000), { limit: 200, maxRequests: 3 })
    ok('🔴 ชนเพดานกันวน ⇒ ได้ไม่ครบ', b.rows.length === 600 && !!b.coverage.stoppedBecause, JSON.stringify(b.coverage))
    ok('   และไฟล์ต้องประกาศว่าไม่ครบ พร้อมเลขทั้งสองฝั่ง',
      coverageText(b.coverage).includes('ไม่ครบ') && coverageText(b.coverage).includes('10,000'), coverageText(b.coverage))

    /* ล่มกลางคัน: ของที่ได้มาแล้วต้องไม่หาย แต่ต้องติดป้ายว่าไม่ครบ */
    let n = 0
    const flaky = async (offset, limit) => {
      n++
      if (n > 2) throw new Error('ท่อล่ม')
      return { rows: Array.from({ length: limit }, (_, i) => offset + i), total: 5000 }
    }
    const c = await fetchAllPages(flaky, { limit: 100 })
    ok('🔴 ล่มกลางคัน ⇒ เก็บของที่ได้ไว้ ไม่โยนทิ้ง', c.rows.length === 200, String(c.rows.length))
    ok('   และบอกว่าหยุดเพราะอะไร', /ไม่สำเร็จกลางคัน/.test(c.coverage.stoppedBecause ?? ''), JSON.stringify(c.coverage))

    /* ท่อไม่บอกยอดรวม ⇒ ห้ามสรุปว่าครบ */
    const d = await fetchAllPages(async (offset, limit) => ({
      rows: offset === 0 ? Array.from({ length: limit }, (_, i) => i) : [], total: null,
    }), { limit: 50 })
    ok('🔴 ท่อไม่บอกยอดรวม ⇒ ไม่ประกาศว่าครบ', !coverageText(d.coverage).startsWith('ครบ'), coverageText(d.coverage))
    ok('   แต่ก็ไม่ประกาศว่าไม่ครบเช่นกัน (ยังไม่รู้)', !coverageText(d.coverage).includes('ไม่ครบ'), coverageText(d.coverage))
  }

  console.log('④ รูปแบบไฟล์')
  {
    const csv = buildCsv({
      filename: 'x',
      preamble: [['รายงานทดสอบ'], ['ความครบถ้วน', 'ครบ']],
      header: ['ก', 'ข'],
      rows: [['มี "คำพูด" ข้างใน', 'บรรทัด, มีคอมมา']],
    })
    ok('หัวเรื่องอยู่เหนือหัวตาราง', csv.split('\n')[0] === '"รายงานทดสอบ"', csv.split('\n')[0])
    ok('🔴 คำพูดข้างในถูก escape', csv.includes('"มี ""คำพูด"" ข้างใน"'), csv)
    ok('คอมมาไม่ทำให้คอลัมน์เลื่อน', csv.includes('"บรรทัด, มีคอมมา"'))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(fail ? 1 : 0)
