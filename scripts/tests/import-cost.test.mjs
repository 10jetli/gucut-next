#!/usr/bin/env node
/* ทดสอบตัวคิดต้นทุนของนำเข้า `lib/import-cost.ts` — รัน: node scripts/tests/import-cost.test.mjs
 *
 * 🔴 **ทำไมไฟล์นี้ต้องมีเทส** (28 ก.ย. 2569): วัดฝั่งจอแล้วพบว่า lib 68 ไฟล์
 *    มี 25 ไฟล์ที่ **ไม่มีเทสและไม่มีด่านเอ่ยถึงเลย** และไฟล์นี้อยู่ในกองนั้น
 *    ทั้งที่ `app/import/page.tsx` กับ `app/api/import/route.ts` ใช้ตัดสินว่า "เอาเข้ามาขายคุ้มไหม"
 *    ⇒ ผิดที่นี่ = ตั้งราคาขาดทุนโดยไม่มีอะไรฟ้อง (ไฟล์นั้นเตือนกับดักนี้ไว้เองในหัวไฟล์)
 *
 * 🔑 **ยึดกฎธุรกิจที่ไฟล์ประกาศไว้เอง + คุณสมบัติที่ต้องจริงเสมอ** ไม่ใช่ตัวเลขที่ผมคิดขึ้นเอง
 *    (บทเรียนจาก order-money: เทสที่สร้างจากความเข้าใจผิดเดียวกับโค้ด จะเขียวเสมอ)
 *    ข้อที่แรงที่สุดคือ **วนกลับ**: เอา `suggestSell` ที่มันแนะนำ ป้อนกลับเป็นราคาขาย
 *    แล้ว `worth` ต้องเป็น true — ถ้าไม่ใช่ แปลว่าจอแนะนำราคาที่ตัวมันเองตัดสินว่าไม่คุ้ม
 *
 * 🔑 เรียกฟังก์ชันตัวจริง (คอมไพล์ด้วย tsc ของโปรเจกต์) ไม่เลียนแบบตรรกะ
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/* โฟลเดอร์ใหม่ทุกรอบ (มี pid) — ห้ามล้างแล้วใช้ซ้ำ ของค้างให้ผลที่น่าเชื่อแต่ผิด */
const out = mkdtempSync(join(tmpdir(), `import-cost-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/import-cost.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  const { costOf, DEFAULT_SETTINGS, applySettings, SETTING_RANGE } = await import(join(out, 'import-cost.js'))
  const ของ = (x = {}) => ({ id: 'a', name: 'ทดสอบ', yuan: 10, qty: 1, kg: 1, cbm: 0, at: 0, ...x })

  console.log('① ค่าขนส่ง: เอาอันที่แพงกว่า ไม่ใช่บวกกัน (ของเบาแต่กล่องใหญ่ต้องโดนคิดตามคิว)')
  {
    const c = costOf(ของ({ kg: 0.5, cbm: 0.05 }), DEFAULT_SETTINGS)
    ok('คิดตามคิวเมื่อคิวแพงกว่า', c.freight === c.byVolume, `freight=${c.freight} byVolume=${c.byVolume}`)
    ok('ไม่ได้บวกสองทางเข้าด้วยกัน', c.freight !== c.byWeight + c.byVolume,
      `freight=${c.freight} = byWeight+byVolume ⇒ ต้นทุนพองเกินจริง`)
    ok('ป้ายบอกวิธีคิดตรงกับเลขที่ใช้จริง', c.charged === 'ปริมาตร', `ป้ายว่า ${c.charged}`)
  }

  console.log('② ไม่รู้ปริมาตร (cbm=0) ⇒ คิดตามน้ำหนักอย่างเดียว ตามที่ไฟล์ประกาศ')
  {
    const c = costOf(ของ({ kg: 2, cbm: 0 }), DEFAULT_SETTINGS)
    ok('คิดตามน้ำหนัก', c.freight === c.byWeight && c.charged === 'น้ำหนัก', `${c.charged} ${c.freight}`)
    ok('ต้นทุนถึงมือ = ของ + ขนส่ง + ค่าดำเนินการ (ไม่มีค่าหลงทาง)',
      Math.abs(c.landed - (c.goods + c.freight + c.handling)) < 0.005,
      `landed=${c.landed} แต่ผลบวก=${c.goods + c.freight + c.handling}`)
  }

  console.log('③ ราคาแนะนำคิดจาก "กำไรบนราคาขาย" ไม่ใช่ "บวกเปอร์เซ็นต์จากต้นทุน"')
  {
    const s = { ...DEFAULT_SETTINGS, minMargin: 35 }
    const c = costOf(ของ({ yuan: 100, kg: 1, cbm: 0 }), s)
    ok('สูงกว่าท่าบวกจากต้นทุน (ท่าที่พลาดกันบ่อย)', c.suggestSell > c.landed * 1.35,
      `แนะนำ ${c.suggestSell} · บวก 35% จากต้นทุนได้ ${c.landed * 1.35}`)
    /* วนกลับ: ขายตามที่แนะนำ ต้องได้กำไรถึงเกณฑ์ */
    const g = costOf(ของ({ yuan: 100, kg: 1, cbm: 0, sell: c.suggestSell }), s)
    ok('ขายตามราคาที่แนะนำ ⇒ คุ้มตามเกณฑ์', g.worth === true,
      `margin=${g.margin}% เกณฑ์=${s.minMargin}% ⇒ จอแนะนำราคาที่ตัวเองตัดสินว่าไม่คุ้ม`)
  }

  console.log('④ ยังไม่ได้ตั้งราคาขาย ⇒ กำไรและคำตัดสินต้องเป็น "ยังไม่รู้" ไม่ใช่ 0/ไม่คุ้ม')
  {
    const c = costOf(ของ({ sell: undefined }), DEFAULT_SETTINGS)
    ok('margin เป็น null', c.margin === null, `ได้ ${c.margin}`)
    ok('worth เป็น null ไม่ใช่ false', c.worth === null, `ได้ ${c.worth} ⇒ "ไม่รู้" กลายเป็น "ไม่คุ้ม"`)
  }

  console.log('⑤ จำนวนชิ้น: 0 หรือว่าง ⇒ ต้องคิดเป็น 1 ล็อต ไม่ใช่ต้นทุนรวม 0')
  {
    const c = costOf(ของ({ qty: 0 }), DEFAULT_SETTINGS)
    ok('total ไม่เป็น 0', c.total > 0, `total=${c.total}`)
    ok('total = landed × 1', Math.abs(c.total - c.landed) < 0.005, `total=${c.total} landed=${c.landed}`)
    const c3 = costOf(ของ({ qty: 3 }), DEFAULT_SETTINGS)
    ok('qty=3 ⇒ total = landed × 3', Math.abs(c3.total - c3.landed * 3) < 0.005,
      `total=${c3.total} landed×3=${c3.landed * 3}`)
  }

  console.log('⑥ กวาดทุกเกณฑ์กำไรที่ "เก็บลงระบบได้จริง" (0-90%) — ห้ามมีค่าไหนที่แนะนำราคาแล้วติดป้ายว่าไม่คุ้ม')
  {
    /* 🔑 ขอบเขตของเทสข้อนี้มาจากของจริง ไม่ใช่จากความรู้สึก:
       `app/api/import/route.ts` บีบ `minMargin` ไว้ที่ `num(inp.minMargin, settings.minMargin, 0, 90)`
       ⇒ ค่าที่ **เก็บได้จริง** คือ 0-90 ⇒ สัญญาที่ต้องจริงคือช่วงนั้นทั้งช่วง
       ⚠️ ถ้ามีคนขยายเพดานฝั่ง API เกิน 90 เทสข้อนี้จะยังเขียว **แต่สูตรราคาแนะนำมีเพดาน 90 ในตัว**
          (Math.min(90, ...)) ⇒ ค่าเกิน 90 จะแนะนำราคาแล้วติดป้าย "ไม่คุ้ม" พร้อมกัน
          ⇒ ข้อ ⑦ ด้านล่างตรึงความสอดคล้องของสองเพดานนี้ไว้ ไม่ให้ขยายข้างเดียวเงียบ ๆ */
    const พลาด = []
    for (let m = 0; m <= 90; m += 5) {
      const s = { ...DEFAULT_SETTINGS, minMargin: m }
      const c = costOf(ของ({ yuan: 100, kg: 1.2, cbm: 0.01 }), s)
      const g = costOf(ของ({ yuan: 100, kg: 1.2, cbm: 0.01, sell: c.suggestSell }), s)
      if (g.worth !== true) พลาด.push(`${m}% ⇒ แนะนำ ${c.suggestSell} ได้กำไร ${g.margin}%`)
    }
    ok('ทุกเกณฑ์ 0-90% ขายตามที่แนะนำแล้วคุ้มจริง', พลาด.length === 0, พลาด.join(' · '))
  }

  console.log('⑦ **สัญญาหลัก**: ทุกเกณฑ์ที่ตัวรับค่ายอมเก็บ ต้องแนะนำราคาที่ตัวเองตัดสินว่าคุ้ม')
  {
    /* 🔑 ก่อนหน้านี้เพดาน 90 ถูกพิมพ์ไว้สองที่ (API กับสูตรราคาแนะนำ) ⇒ ขยายข้างเดียวได้เงียบ ๆ
       ตอนนี้ทั้งคู่อ่านจาก `SETTING_RANGE` ที่เดียว ⇒ เทสข้อนี้ผูกกับ **พฤติกรรม** ไม่ใช่รูปร่างโค้ด:
       กวาด 0-100 ทุกหนึ่งหน่วย · ค่าที่ถูก "รับ" ต้องวนกลับแล้วคุ้ม · ค่าที่ "ไม่รับ" ต้องไม่ถูกเก็บ
       ⇒ ถ้ามีคนขยายเพดานฝั่งใดฝั่งหนึ่ง ข้อนี้แดงทันทีโดยไม่ต้องอ่านตัวอักษรในไฟล์ */
    const แย่ = []
    for (let m = 0; m <= 100; m += 1) {
      const { next, rejected } = applySettings({ minMargin: m }, DEFAULT_SETTINGS)
      const รับ = rejected.length === 0
      if (!รับ) {
        if (next.minMargin === m) แย่.push(`${m}% ปฏิเสธแล้วแต่ยังเก็บค่านั้น`)
        continue
      }
      const c = costOf(ของ({ yuan: 100, kg: 1.2, cbm: 0.01 }), next)
      const g = costOf(ของ({ yuan: 100, kg: 1.2, cbm: 0.01, sell: c.suggestSell }), next)
      if (g.worth !== true) แย่.push(`${m}% รับเข้ามาแล้ว แต่ราคาที่แนะนำ ${c.suggestSell} ได้กำไร ${g.margin}%`)
    }
    ok('ค่าที่รับได้ทุกค่าวนกลับแล้วคุ้ม · ค่าที่ปฏิเสธไม่ถูกเก็บ', แย่.length === 0, แย่.slice(0, 4).join(' · '))
  }

  console.log('⑧ กรอกค่าเกินช่วง ⇒ ต้อง **บอกว่าไม่รับ** ไม่ใช่กลับไปใช้ค่าเดิมเงียบ ๆ')
  {
    const { next, rejected } = applySettings({ rate: 12 }, DEFAULT_SETTINGS)
    ok('รายงานว่าไม่รับ 1 ช่อง', rejected.length === 1, `ได้ ${rejected.length} รายการ`)
    ok('บอกชื่อช่อง · ค่าที่พิมพ์ · ค่าที่ยังใช้อยู่',
      rejected[0]?.ช่อง === 'rate' && rejected[0]?.ที่กรอก === 12
      && rejected[0]?.ใช้ค่าเดิม === DEFAULT_SETTINGS.rate, JSON.stringify(rejected[0]))
    ok('ค่าที่เก็บยังเป็นของเดิม', next.rate === DEFAULT_SETTINGS.rate, `ได้ ${next.rate}`)
  }

  console.log('⑨ "ไม่ได้กรอกมา" ≠ "กรอกแล้วไม่ผ่าน" — ห้ามรายงานช่องที่ผู้ใช้ไม่ได้แตะ')
  {
    const { next, rejected } = applySettings({ perKg: 60 }, DEFAULT_SETTINGS)
    ok('ไม่มีรายการถูกปฏิเสธ', rejected.length === 0, JSON.stringify(rejected))
    ok('ช่องที่กรอกถูกเก็บ', next.perKg === 60, `ได้ ${next.perKg}`)
    ok('ช่องที่ไม่ได้กรอกคงค่าเดิม', next.rate === DEFAULT_SETTINGS.rate, `ได้ ${next.rate}`)
  }

  console.log('⑩ ตัวหนังสือที่ไม่ใช่ตัวเลข ⇒ ต้องถูกปฏิเสธ ไม่ใช่กลายเป็น 0 หรือ NaN')
  {
    const { next, rejected } = applySettings({ handling: 'ยี่สิบ' }, DEFAULT_SETTINGS)
    ok('ถูกปฏิเสธ', rejected.some((x) => x.ช่อง === 'handling'), JSON.stringify(rejected))
    ok('ไม่กลายเป็น NaN/0', next.handling === DEFAULT_SETTINGS.handling, `ได้ ${next.handling}`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
