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
      coverageText(b.coverage).includes('ยังไม่ครบ') && coverageText(b.coverage).includes('10,000'), coverageText(b.coverage))
    ok('🔴 ไม่มี ** มาร์กดาวน์ในข้อความที่ลงไฟล์', !coverageText(b.coverage).includes('**'), coverageText(b.coverage))
    /* 📏 ของจริง 15 ก.ย. 2569: จอโอนสินค้า 12,003 แถว — เพดานเดิม 60 รอบทำให้ขาด 3 แถว */
    const real = await fetchAllPages(make(12003), { limit: 200 })
    ok('🔴 ชุดจริงขนาด 12,003 แถว ⇒ ต้องได้ครบด้วยเพดานเริ่มต้น',
      real.rows.length === 12003 && !real.coverage.stoppedBecause, JSON.stringify(real.coverage))

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
    ok('   แต่ก็ไม่ประกาศว่าไม่ครบเช่นกัน (ยังไม่รู้)', !coverageText(d.coverage).includes("ยังไม่ครบ"), coverageText(d.coverage))
  }

  console.log('④ 🔴 ท่อบอกเองว่าหมด (hasMore) และเรื่องที่ทำให้ไม่สมบูรณ์ (failed)')
  {
    /* บัตรสต็อก: เชื่อ hasMore ก่อนการเทียบ total — และ **ห้ามตัดแถวซ้ำ**
       ของจริง 15 ก.ย. 2569: รหัส 00313 มีแถวหน้าตาเหมือนกันเป๊ะ 106 แถว เป็นข้อมูลจริง */
    const pages = [
      { rows: [{ ref: 'A', qty: -1 }, { ref: 'A', qty: -1 }], total: 4, done: false },
      { rows: [{ ref: 'A', qty: -1 }, { ref: 'B', qty: 2 }], total: 4, done: true },
    ]
    let i = 0
    const r = await fetchAllPages(async () => pages[i++], { limit: 2 })
    ok('หยุดเมื่อท่อบอก done', r.rows.length === 4, String(r.rows.length))
    ok('🔴 แถวที่เหมือนกันเป๊ะต้องอยู่ครบ ห้าม dedupe',
      r.rows.filter((x) => x.ref === 'A').length === 3, JSON.stringify(r.rows))
    ok('   และประกาศว่าครบได้', coverageText(r.coverage).startsWith('ครบ'), coverageText(r.coverage))

    /* ⚠️ แหล่งข้อมูลบางแหล่งล่ม ⇒ ถึงจะได้ครบตาม total ก็ห้ามเขียนว่าครบ
       (total เองก็นับจากแหล่งที่ล่ม) */
    let j = 0
    const withFail = await fetchAllPages(async () => {
      j++
      return { rows: [{ n: j }], total: 2, done: j >= 2, problem: 'ดึงจากแหล่ง ขาย ไม่สำเร็จ' }
    }, { limit: 1 })
    ok('🔴 มีแหล่งล่ม ⇒ ได้ครบตาม total แต่ห้ามบอกว่าครบ',
      withFail.rows.length === 2 && !coverageText(withFail.coverage).startsWith('ครบ'),
      coverageText(withFail.coverage))
    ok('   และต้องบอกด้วยว่าติดอะไร',
      coverageText(withFail.coverage).includes('ดึงจากแหล่ง ขาย ไม่สำเร็จ'), coverageText(withFail.coverage))
    ok('   เรื่องเดิมซ้ำหลายหน้า เขียนครั้งเดียว',
      (coverageText(withFail.coverage).match(/ดึงจากแหล่ง ขาย/g) ?? []).length === 1)
  }

  console.log('⑤ 🔴 ด่านห้ามให้ไฟล์ออก — กติกาข้อ ② ของท่านประธาน (18 ก.ย. 2569)')
  {
    const { exportBlocked, exportFilename } = m
    /* ⚠️ เทสนี้ต้องยิง **ทั้งสองข้าง** — ของที่ห้ามต้องห้ามจริง และของที่ปล่อยได้ต้องไม่โดนห้าม
       ด่านที่ห้ามทุกอย่างก็ "ผ่านเทสข้างเดียว" ได้เหมือนกัน แล้วปุ่มส่งออกจะตายทั้งระบบ */
    const c = (x) => ({ got: 0, total: null, ...x })
    ok('🔴 ล่มกลางคัน ⇒ ห้ามให้ไฟล์ออก',
      !!exportBlocked(c({ got: 200, total: 5000, stoppedBecause: 'ดึงข้อมูลไม่สำเร็จกลางคัน (ท่อล่ม)' })))
    ok('🔴 ได้ไม่ครบตาม total ⇒ ห้ามให้ไฟล์ออก', !!exportBlocked(c({ got: 199, total: 200 })))
    ok('🔴 ท่อแจ้งว่าข้อมูลไม่สมบูรณ์ ⇒ ห้ามให้ไฟล์ออก แม้ยอดจะครบ',
      !!exportBlocked(c({ got: 2, total: 2, problems: ['ดึงจากแหล่ง ขาย ไม่สำเร็จ'] })))
    ok('   เหตุผลที่ขึ้นจอต้องบอกว่าต้องทำอะไรต่อ ไม่ใช่แค่ว่าไม่สำเร็จ',
      /ลองใหม่|กรองให้แคบลง|เทียบยอด/.test(exportBlocked(c({ got: 1, total: 9 })) ?? ''))
    ok('   และต้องมีเลขทั้งสองฝั่งให้คนเทียบ',
      (exportBlocked(c({ got: 1, total: 9 })) ?? '').includes('9'))

    ok('✅ ครบตาม total ⇒ ปล่อยไฟล์', exportBlocked(c({ got: 200, total: 200 })) === null)
    ok('✅ ได้เกิน total (ท่อนับต่ำไป) ⇒ ปล่อยไฟล์', exportBlocked(c({ got: 201, total: 200 })) === null)
    /* 🔴 สามสถานะ: "ท่อไม่บอกยอดรวม" = ยังไม่รู้ ไม่ใช่รู้ว่าไม่ครบ ⇒ ห้ามเอามารวมกัน */
    ok('✅ ท่อไม่บอกยอดรวม ⇒ ยังปล่อยไฟล์ได้ (แต่หัวไฟล์เขียนว่ายังไม่รู้)',
      exportBlocked(c({ got: 43, total: null })) === null)
    ok('✅ ชุดว่างจริง ๆ (0 จาก 0) ⇒ ปล่อยไฟล์เปล่าได้', exportBlocked(c({ got: 0, total: 0 })) === null)

    console.log('   ③ ชื่อไฟล์ต้องมีวันที่ที่ดึง และขอบเขต')
    const f = exportFilename('ผู้ติดต่อ', 'ลูกค้า', new Date('2026-09-18T17:30:00Z'))
    ok('🔴 วันในชื่อไฟล์เป็นวันไทย (17:30Z = วันถัดไปที่ไทย)', f === 'ผู้ติดต่อ-ลูกค้า-ดึง19-09-2569', f)
    ok('ไม่ใส่ขอบเขตก็ยังมีวันที่', exportFilename('คลังสินค้า', undefined, new Date('2026-09-18T03:00:00Z')) === 'คลังสินค้า-ดึง18-09-2569')
    ok('🔴 อักขระที่วินโดวส์ตั้งชื่อไฟล์ไม่ได้ต้องถูกตัด',
      !/[\\/:*?"<>|]/.test(exportFilename('รายการขาย', 'ช่วง 01/09–18/09 · สถานะ "ครบ"')),
      exportFilename('รายการขาย', 'ช่วง 01/09–18/09 · สถานะ "ครบ"'))
  }

  console.log('⑥ รูปแบบไฟล์')
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
