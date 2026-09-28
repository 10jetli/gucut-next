#!/usr/bin/env node
/* ตัวอ่านก้อน `clamped` ของท่อ — ทดสอบตรรกะจริง (คอมไพล์ lib/clamped.ts)
 * (28 ก.ย. 2569 · มาจากบั๊กจอ /import ของเราเอง ⇒ CEO ต่อ clamped ให้ 4 เส้น)
 *
 * 🔒 กติกาที่ฝั่งท่อกำกับมา และเทสนี้บังคับ
 *    ① ไม่มีการบีบ = **ไม่มีคีย์เลย** (ไม่ใช่คีย์ว่าง) ⇒ จอต้องไม่ขึ้นกล่อง
 *    ② **ไม่ได้ส่งมา ≠ ถูกบีบ** ⇒ ช่องที่จอไม่ได้ส่ง ห้ามโผล่ในรายการ
 *    ③ **บีบ ≠ ปฏิเสธ** ⇒ ห้ามมีคำว่าปฏิเสธในข้อความที่จอเขียนเอง (ปฏิเสธคือ 400)
 *    ④ ท่อรุ่นเก่าที่ยังไม่มี clamped ⇒ จอเทียบ applied กับค่าที่ขอเองได้
 *       **แต่ต้องบอกว่ายังไม่รู้เหตุ ห้ามแต่งเหตุ** (ไม่งั้นได้คำอธิบายสองชุดในระบบ)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `clamped-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/clamped.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  const { อ่านการบีบ, เทียบขอกับใช้ } = await import(join(out, 'clamped.js'))

  console.log('① ไม่มีการบีบ ⇒ ไม่มีบรรทัดเลย (คำตอบปกติต้องไม่มีกล่องขึ้นบนจอ)')
  {
    ok('ไม่มีคีย์ clamped', อ่านการบีบ({ applied: { limit: 200 }, rows: [] }).length === 0)
    ok('resp เป็น null', อ่านการบีบ(null).length === 0)
    ok('clamped เป็นก้อนว่าง (ท่อไม่ควรส่งรูปนี้ แต่ต้องไม่พัง)', อ่านการบีบ({ clamped: {} }).length === 0)
  }

  console.log('② ท่อรายงานการบีบ ⇒ ต้องได้ ที่ขอ · ที่ใช้ · เหตุ ครบสามอย่าง')
  {
    const ผล = อ่านการบีบ({ clamped: { limit: { asked: 99999, used: 200, why: 'เพดานของเส้นนี้คือ 200 แถว' } } })
    ok('ได้หนึ่งบรรทัด', ผล.length === 1, JSON.stringify(ผล))
    ok('ค่าที่ขอมาครบ', ผล[0]['ที่ขอ'] === '99999', ผล[0]['ที่ขอ'])
    ok('ค่าที่ใช้จริงมาครบ', ผล[0]['ที่ใช้'] === '200', ผล[0]['ที่ใช้'])
    ok('เหตุเป็นคำของท่อตรงตัวอักษร', ผล[0]['เหตุ'] === 'เพดานของเส้นนี้คือ 200 แถว', String(ผล[0]['เหตุ']))
  }

  console.log('③ ท่อบีบแต่ไม่บอกเหตุ ⇒ เหตุต้องเป็น null (จอไม่แต่งเหตุให้)')
  {
    const ผล = อ่านการบีบ({ clamped: { limit: { asked: 1.9, used: 1 }, offset: { asked: -5, used: 0, why: '   ' } } })
    ok('สองบรรทัด', ผล.length === 2, JSON.stringify(ผล))
    ok('เหตุที่ไม่มี = null', ผล.every((x) => x['เหตุ'] === null), JSON.stringify(ผล.map((x) => x['เหตุ'])))
  }

  console.log('④ ทางถอยสำหรับท่อรุ่นเก่า: เทียบค่าที่ขอกับ applied')
  {
    const ผล = เทียบขอกับใช้({ limit: 500, q: 'AB' }, { applied: { limit: 200, q: 'AB' } })
    ok('เจอช่องที่ต่างกันช่องเดียว', ผล.length === 1 && ผล[0]['ช่อง'] === 'limit', JSON.stringify(ผล))
    ok('เหตุเป็น null เพราะจอไม่รู้ว่าทำไม', ผล[0]['เหตุ'] === null, String(ผล[0]['เหตุ']))
    ok('ช่องที่ตรงกันไม่ถูกรายงาน', !ผล.some((x) => x['ช่อง'] === 'q'), JSON.stringify(ผล))
  }

  console.log('⑤ ไม่ได้ส่งมา ≠ ถูกบีบ · และท่อที่ไม่ประกาศช่องนั้น = ไม่รู้ ห้ามเดา')
  {
    ok('ช่องที่จอไม่ได้ส่ง (null/ว่าง) ไม่ถูกรายงาน',
      เทียบขอกับใช้({ limit: null, q: '' }, { applied: { limit: 200, q: null } }).length === 0)
    ok('ท่อไม่ประกาศช่องนั้นเลย ⇒ ไม่รายงาน',
      เทียบขอกับใช้({ only: 'out' }, { applied: { limit: 200 } }).length === 0)
    ok('ท่อบอกว่าไม่ได้กรองด้วยช่องนั้น (null) ⇒ ไม่นับเป็นการบีบ',
      เทียบขอกับใช้({ q: 'AB' }, { applied: { q: null } }).length === 0)
  }

  console.log('⑥ ท่อรายงานเองแล้ว ⇒ ทางถอยต้องเงียบ (กันรายงานซ้ำสองชุด)')
  {
    ok('มี clamped แล้ว ทางถอยคืนว่าง',
      เทียบขอกับใช้({ limit: 500 }, { clamped: { limit: { asked: 500, used: 200 } }, applied: { limit: 200 } }).length === 0)
  }

  console.log('⑦ ข้อความที่จอเขียนเอง ห้ามมีคำว่า "ปฏิเสธ" (บีบ ≠ ปฏิเสธ) และห้ามบอกว่าล้มเหลว')
  {
    const ซอร์ส = readFileSync('components/ui/ClampedNote.tsx', 'utf8')
    const เนื้อ = ซอร์ส.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    ok('ไม่มีคำว่าปฏิเสธในข้อความบนจอ', !/ถูกปฏิเสธ|ปฏิเสธค่า/.test(เนื้อ), 'บีบ ≠ ปฏิเสธ')
    ok('ไม่มีคำว่าล้มเหลว/ไม่สำเร็จ (คำขอสำเร็จ)', !/ล้มเหลว|ไม่สำเร็จ/.test(เนื้อ))
    ok('มีจออ่านกล่องนี้จริง',
      /<ClampedNote[\s/>]/.test(readFileSync('app/core/stock/[sku]/page.tsx', 'utf8')))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
