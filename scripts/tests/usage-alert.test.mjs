/* ทดสอบเกณฑ์เตือนแบนด์วิดท์ — รัน: node scripts/tests/usage-alert.test.mjs
 *
 * 🔴 **โจทย์จาก CEO 18 ก.ย. 2569** (หลังเว็บล่มเพราะเครดิตหมด):
 *    *"ตัวที่ทำหน้าที่เตือน ต้องพิสูจน์ว่ามันเคยเตือนได้จริง ไม่ใช่พิสูจน์ว่ามีตัวเตือนอยู่
 *      วิธีพิสูจน์: ป้อนค่าที่ควรทำให้มันร้อง แล้วดูว่ามันร้องไหม"*
 *    ⇒ เทสนี้คือการป้อนค่าปลอมให้มันร้อง ไม่ใช่การตรวจว่าโค้ดคอมไพล์ผ่าน
 *
 * 🔑 เรียกฟังก์ชันตัวจริงที่จอใช้ (แปลง lib/usage-alert.ts ด้วย tsc ของโปรเจกต์)
 *    ไม่เลียนแบบตรรกะ — โปรเจกต์นี้เจ็บมาแล้วจากเทสที่เขียวทั้งที่ของจริงพัง
 * 🔑 อ่านเลขเกณฑ์จาก `เกณฑ์` ที่ export มา **ไม่เขียนเลขซ้ำในเทส**
 *    (เขียนซ้ำ = แก้เกณฑ์แล้วเทสยังเขียว ซึ่งคือตาข่ายปลอมอีกแบบ)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(process.cwd(), 'scripts', 'tests', '.out-usage-alert')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
let fail = 0
try {
  execFileSync('npx', ['tsc', 'lib/usage-alert.ts', '--outDir', out,
    '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
    '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'],
    { cwd: process.cwd(), stdio: 'inherit' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  const { bandwidthAlert, creditAlert, เกณฑ์ } = await import(join(out, 'usage-alert.js'))

  const โควตา = 100 // GB — เลือกเลขกลม ๆ เพื่อให้ "GB ที่ใช้" = "เปอร์เซ็นต์" ตรง ๆ อ่านง่าย
  const ที่เกณฑ์ = (p) => ({ usedGB: (p / 100) * โควตา, includedGB: โควตา })

  const cases = [
    [ที่เกณฑ์(10), 'ok', 'ใช้น้อย — ต้องไม่ร้อง (ตัวเตือนที่ร้องตลอดเวลา คนจะเลิกฟัง)'],
    [ที่เกณฑ์(เกณฑ์.watch - 0.1), 'ok', 'ต่ำกว่าเกณฑ์จับตาเฉียดฉิว ⇒ ยังไม่ร้อง (ขอบล่าง)'],
    [ที่เกณฑ์(เกณฑ์.watch), 'watch', `แตะเกณฑ์จับตา ${เกณฑ์.watch}% พอดี ⇒ ต้องร้องแล้ว (ขอบบน)`],
    [ที่เกณฑ์(เกณฑ์.warn), 'warn', `แตะเกณฑ์เตือน ${เกณฑ์.warn}% ⇒ ต้องบอกให้ชะลอ deploy`],
    [ที่เกณฑ์(เกณฑ์.over), 'over', `เต็มโควตาพอดี ${เกณฑ์.over}% ⇒ ต้องเตือนขั้นสูงสุด`],
    [ที่เกณฑ์(140), 'over', 'เกินโควตาไปแล้ว — สถานการณ์จริงของวันที่ 18 ก.ย. 2569'],
    [{ usedGB: 92 }, 'unknown', '**ไม่รู้โควตา ⇒ ห้ามเขียว** — บอกไม่ได้ว่าใกล้เต็มหรือยัง'],
    [{ usedGB: 50, includedGB: 0 }, 'unknown', 'โควตาเป็น 0 = ค่าที่แปลไม่ได้ ⇒ ห้ามหารแล้วได้ Infinity'],
    [{ includedGB: 100 }, 'unknown', 'ท่อไม่ส่งยอดใช้มา ⇒ **ห้ามแปลว่าใช้ไป 0** (บั๊กเดิมของจอนี้เป๊ะ ๆ)'],
    [null, 'unknown', 'ไม่มีข้อมูลเลย'],
  ]

  console.log(`\nเกณฑ์ที่ใช้อยู่: จับตา ${เกณฑ์.watch}% · เตือน ${เกณฑ์.warn}% · เกินโควตา ${เกณฑ์.over}%\n`)
  for (const [input, want, why] of cases) {
    const got = bandwidthAlert(input)
    const ok = got.level === want
    if (!ok) fail++
    const ป้าย = JSON.stringify(input ?? null)
    console.log(`  ${ok ? '✅' : '❌'} ${ป้าย.padEnd(34)} ⇒ ${String(got.level).padEnd(8)} ${String(got.pct ?? '—').padEnd(6)} ${why}`)
    if (!ok) console.log(`     ต้องได้ ${want} · ได้ ${got.level} · ข้อความ: ${got.ข้อความ}`)
  }

  /* ข้อความต้องพาคนไปทำอะไรต่อได้ ไม่ใช่แค่บอกสี — ระดับที่ร้องแล้วต้องบอกว่าให้ทำอะไร */
  for (const lv of ['warn', 'over']) {
    const พบ = bandwidthAlert(ที่เกณฑ์(lv === 'over' ? 120 : เกณฑ์.warn))
    if (!/แจ้งท่านประธาน/.test(พบ.ข้อความ)) {
      fail++
      console.log(`  ❌ ระดับ ${lv} ต้องบอกให้ไปแจ้งคน ไม่ใช่แค่ขึ้นสี — ได้: ${พบ.ข้อความ}`)
    } else {
      console.log(`  ✅ ระดับ ${lv} มีคำสั่งว่าต้องทำอะไรต่อ: ${พบ.ข้อความ}`)
    }
  }

  /* ── เครดิต Netlify ──────────────────────────────────────────────────
     🔴 CEO สั่ง 18 ก.ย. 2569: "เอาเกณฑ์เตือนไปไว้ที่การ์ดเครดิตแทน เพราะเครดิตคือตัวที่ทำให้เว็บล่มจริง"
     ⚠️ สามกับดักของเส้นนี้ที่ต้องมีเทสคุม (ฝั่งท่อเขียนเตือนไว้เองใน netlify-credits.mjs):
        ไม่มีข้อมูล ≠ ใช้ไป 0 · `stale` ต้องเขียนกำกับ · `plan` มี default ที่ไม่มีใครยืนยัน */
  console.log('\n— creditAlert (เครดิต Netlify) —')
  const เครดิต = [
    [{ plan: 5000, used: 500, left: 4500 }, 'ok', 'ต้นรอบบิล ใช้ไปน้อย'],
    [{ plan: 5000, used: 5000 * (เกณฑ์.watch / 100) - 30 }, 'ok', 'ต่ำกว่าเกณฑ์จับตาชัดเจน (74.4%) ⇒ เงียบ (ขอบล่าง)'],
    /* 🔑 **ตั้งใจให้ตัดสินจากเลขที่ปัดแล้ว ไม่ใช่เลขดิบ** — 3,749 จาก 5,000 = 74.98% ซึ่งจอจะพิมพ์ว่า "75%"
       ถ้าเทียบจากเลขดิบ จอจะเขียนว่าใช้ไป 75% แล้วเงียบ ⇒ ตัวเลขกับการตัดสินใจมาคนละกติกา
       ซึ่งเป็นโรคประจำของบ้านนี้ (ดู CLAUDE.md ข้อ 4 เรื่องแท็บ) ⇒ เห็นเลขไหนบนจอ ต้องได้ผลตามเลขนั้น */
    [{ plan: 5000, used: 3749 }, 'watch', 'เลขดิบ 74.98% แต่จอพิมพ์ว่า 75% ⇒ **ต้องร้อง** ไม่งั้นเลขกับผลไม่ตรงกัน'],
    [{ plan: 5000, used: 5000 * (เกณฑ์.watch / 100) }, 'watch', `แตะ ${เกณฑ์.watch}% ⇒ ร้อง (ขอบบน)`],
    [{ plan: 5000, used: 5000 * (เกณฑ์.warn / 100) }, 'warn', `แตะ ${เกณฑ์.warn}% ⇒ ให้หยุดรวบ deploy`],
    [{ plan: 5000, used: 5000 }, 'over', 'เครดิตหมดพอดี — สถานการณ์จริง 18 ก.ย. 2569'],
    [{ plan: 5000, used: 6200 }, 'over', 'ใช้เกินเพดาน'],
    [{ unknown: true }, 'unknown', '🔴 ท่อบอกเองว่าอ่านไม่ได้ ⇒ **ห้ามแปลว่าใช้ไป 0** (ของจริง 5 ก.ย. เคยรายงาน "ใช้ไป 0 เหลือ 15,000")'],
    [{ off: true }, 'unknown', 'ยังไม่ได้ตั้งคีย์ ⇒ ต้องบอกว่ายังไม่ได้เฝ้าอะไรเลย ไม่ใช่เขียว'],
    [{ plan: 5000 }, 'unknown', 'มีเพดานแต่ไม่มียอดใช้ ⇒ คิดไม่ได้'],
    [{ used: 400 }, 'unknown', 'มียอดใช้แต่ไม่รู้เพดาน ⇒ คิด % ไม่ได้ ห้ามเดาเพดาน'],
    [null, 'unknown', 'ไม่มีอะไรเลย'],
  ]
  for (const [input, want, why] of เครดิต) {
    const got = creditAlert(input)
    const ok = got.level === want
    if (!ok) fail++
    console.log(`  ${ok ? '✅' : '❌'} ${JSON.stringify(input ?? null).padEnd(42)} ⇒ ${String(got.level).padEnd(8)} ${why}`)
    if (!ok) console.log(`     ต้องได้ ${want} · ข้อความ: ${got.ข้อความ}`)
  }

  /* `stale` = ค่าที่อ่านได้ครั้งล่าสุด ไม่ใช่ค่าสด ⇒ **ต้องมีคำกำกับในข้อความ** ไม่ใช่โชว์เหมือนของสด */
  const เก่า = creditAlert({ plan: 5000, used: 4800, left: 200, stale: true })
  if (!เก่า.stale || !/ไม่ใช่ของสด/.test(เก่า.ข้อความ)) {
    fail++
    console.log(`  ❌ ค่า stale ต้องเขียนกำกับว่าไม่ใช่ของสด — ได้: ${เก่า.ข้อความ}`)
  } else console.log(`  ✅ ค่า stale เขียนกำกับแล้ว: ${เก่า.ข้อความ}`)

  /* เพดานที่ไม่มีใครยืนยัน (ท่อ default 5000) ห้ามถูกนับว่ายืนยันแล้ว */
  const ยังไม่ยืนยัน = creditAlert({ plan: 5000, used: 100, left: 4900 })
  if (ยังไม่ยืนยัน.planConfirmed !== false) {
    fail++
    console.log('  ❌ ไม่มีธง planConfirmed ⇒ ต้องถือว่ายังไม่ยืนยัน')
  } else console.log('  ✅ ไม่มีธง planConfirmed ⇒ ถือว่ายังไม่ยืนยัน (จอเขียนกำกับใน title)')

  /* ระดับที่ร้องต้องบอกว่าให้ทำอะไรต่อ — ข้อเดียวกับฝั่งแบนด์วิดท์ */
  for (const [c, lv] of [[{ plan: 5000, used: 4500 }, 'warn'], [{ plan: 5000, used: 5200 }, 'over']]) {
    const พบ = creditAlert(c)
    if (!/แจ้งท่านประธาน/.test(พบ.ข้อความ)) {
      fail++
      console.log(`  ❌ ระดับ ${lv} ต้องบอกให้ไปแจ้งคน — ได้: ${พบ.ข้อความ}`)
    } else console.log(`  ✅ ระดับ ${lv} มีคำสั่งว่าต้องทำอะไรต่อ`)
  }
  console.log('⑤ 🔴 ความเร็วมาก่อนยอดคงเหลือ — ป้ายเคยเขียวตอนที่ตัวเฝ้าร้อง (19 ก.ย. 2569)')
  {
    const ตรวจ = (ชื่อ, เงื่อนไข, เพิ่ม = '') => {
      if (เงื่อนไข) console.log(`  ✅ ${ชื่อ}`)
      else { fail++; console.log(`  ❌ ${ชื่อ} ${เพิ่ม}`) }
    }
    /* ค่าจริงของวันนั้น: ใช้ไป 1,041 จาก 20,000 = 5.2% ⇒ เกณฑ์เปอร์เซ็นต์ตอบ "ok"
       แต่ตัวเฝ้าบอกว่าเผา 3,965/วัน ⇒ เหลือ ~4.8 วัน ⇒ ต้องไม่เขียว */
    const จริง = { plan: 20000, used: 1041, left: 18959, planConfirmed: true }
    ตรวจ('ยอดคงเหลืออย่างเดียว ⇒ ok (เกณฑ์เดิมยังทำงาน)', creditAlert(จริง).level === 'ok', creditAlert(จริง).level)
    const ด้วยวัน = { ...จริง, daysLeft: 4.8, burnPerDay: 3965, burnWindowHours: 1 }
    ตรวจ('มีจำนวนวัน 4.8 ⇒ ต้องเป็น warn ไม่ใช่ ok', creditAlert(ด้วยวัน).level === 'warn', creditAlert(ด้วยวัน).level)
    ตรวจ('ข้อความบอกอัตราและช่วงที่ใช้คิด',
      /เผา 3965\/วัน/.test(creditAlert(ด้วยวัน).ข้อความ) && /1 ชม/.test(creditAlert(ด้วยวัน).ข้อความ),
      creditAlert(ด้วยวัน).ข้อความ)
    ตรวจ('เหลือ 2 วัน ⇒ over (หนักเท่าเครดิตหมด)', creditAlert({ ...จริง, daysLeft: 2 }).level === 'over')
    ตรวจ('เหลือ 10 วัน ⇒ watch', creditAlert({ ...จริง, daysLeft: 10 }).level === 'watch')
    ตรวจ('เหลือ 45 วัน ⇒ กลับไป ok', creditAlert({ ...จริง, daysLeft: 45 }).level === 'ok')
    /* 🔴 ไม่มีค่ามา = ยังไม่รู้ ไม่ใช่ "เผาช้า" ⇒ ต้องไม่ทำให้เกณฑ์เดิมเพี้ยน */
    ตรวจ('daysLeft เป็น null ⇒ ใช้เกณฑ์เปอร์เซ็นต์ตามเดิม', creditAlert({ ...จริง, daysLeft: null }).level === 'ok')
    ตรวจ('ยอดสูง 95% แม้มีวันเหลือเยอะ ⇒ ยังต้อง warn',
      creditAlert({ plan: 20000, used: 19000, daysLeft: 99 }).level === 'warn',
      creditAlert({ plan: 20000, used: 19000, daysLeft: 99 }).level)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}


console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ — ตัวเตือนร้องจริงเมื่อป้อนค่าที่ควรทำให้ร้อง')
process.exit(fail ? 1 : 0)
