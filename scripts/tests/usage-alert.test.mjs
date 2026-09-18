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
  const { bandwidthAlert, เกณฑ์ } = await import(join(out, 'usage-alert.js'))

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
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n✅ ผ่านทุกข้อ — ตัวเตือนร้องจริงเมื่อป้อนค่าที่ควรทำให้ร้อง')
process.exit(fail ? 1 : 0)
