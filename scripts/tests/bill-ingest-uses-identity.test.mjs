/* เส้นรับบิลเข้าคลังต้องกันซ้ำด้วย **ตัวตนของใบ** — ทดสอบกับ PDF จริง ไม่ใช่แค่ดูซอร์ส
 * รัน: node scripts/tests/bill-ingest-uses-identity.test.mjs
 *
 * 🔴 ที่มา (18 ก.ย. 2569 · ใบ t_mu3g8tq5): `/api/bills/upload` ใช้ `syncBillToBlobs` (กันด้วยชื่อไฟล์)
 *    ⇒ บิลจากตัวเก็บสคริปต์ไม่เคยผ่านตัวกันซ้ำด้วยตัวตน ⇒ TikTok 92 · Apple 9 ไฟล์ซ้ำ
 * ⚠️ **ด่านที่อ่านแค่ซอร์สพิสูจน์ไม่พอ** — ลองปิดสาขาด้วย `if (false && identKey)` แล้วด่านซอร์สยังเขียว
 *    ⇒ ข้อ ② ด้านล่างเรียกฟังก์ชันจริงกับไฟล์ PDF จริงในเครื่อง
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`  ✅ ${name}`)
  else { console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); fail++ }
}

console.log('① เส้นรับบิลต้องเรียกตัวกันซ้ำด้วยตัวตน (อ่านซอร์ส — ด่านหยาบ)')
for (const f of ['app/api/bills/upload/route.ts', 'app/api/bills/drivesync/route.ts']) {
  const src = readFileSync(join(ROOT, f), 'utf8')
  ok(/syncBillByIdentity\s*\(/.test(src), `${f} เรียก syncBillByIdentity`)
}

console.log('② ฟังก์ชันอ่านตัวตนของไฟล์อัป ต้องได้กุญแจจริงจาก PDF จริง (ด่านที่ปิดสาขาแล้วจะแดง)')
const pdf = [join(homedir(), 'adobe-dl-test.pdf'), join(homedir(), 'fb-test.pdf')].find(existsSync)
if (!pdf) {
  console.log('  ⏭️ ข้าม — ไม่มีไฟล์ PDF จริงในเครื่องนี้ (ที่ ~/adobe-dl-test.pdf หรือ ~/fb-test.pdf)')
} else {
  const out = join(ROOT, 'scripts', 'tests', '.out-bill-ingest')
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
  try {
    execFileSync('npx', ['tsc', 'lib/bill-ingest.ts', 'lib/bill-identity.ts', 'lib/bill-text.ts', 'lib/billdate.ts',
      '--outDir', out, '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler',
      '--lib', 'es2020,dom', '--esModuleInterop', '--skipLibCheck'], { cwd: ROOT, stdio: 'inherit' })
    for (const f of ['bill-ingest.js', 'bill-identity.js', 'billdate.js']) {
      const p = join(out, f)
      if (existsSync(p)) {
        let t = readFileSync(p, 'utf8')
        t = t.replace(/from '\.\/(bill-identity|bill-text|billdate)'/g, "from './$1.js'")
        writeFileSync(p, t)
      }
    }
    const { ตัวตนของไฟล์อัป } = await import(join(out, 'bill-ingest.js'))
    const vendor = pdf.includes('adobe') ? 'adobe' : 'meta'
    const r = await ตัวตนของไฟล์อัป(readFileSync(pdf), vendor)
    ok(typeof r.key === 'string' && r.key.length > 5, `อ่านตัวตนจาก PDF จริงได้ (${vendor})`, JSON.stringify(r).slice(0, 120))
    const junk = await ตัวตนของไฟล์อัป(Buffer.from('ไม่ใช่ PDF'), vendor)
    ok(junk.key === null && !!junk.why, 'ไฟล์อ่านไม่ได้ ⇒ key เป็น null พร้อมเหตุผล (ผู้เรียกถอยไปกันด้วยชื่อไฟล์)', JSON.stringify(junk).slice(0, 100))
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}
console.log(fail === 0 ? '\n✅ ผ่านทุกข้อ' : `\n❌ ไม่ผ่าน ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
