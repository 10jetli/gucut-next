#!/usr/bin/env node
/* หา IP ของคนที่ยิงเข้ามา (`lib/client-ip.ts`) — กุญแจของ **ตัวกันเดารหัสรัว ๆ**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) 47 บรรทัด ไม่มีเทสแตะเลย · ผู้ใช้คือเส้นล็อกอินและ /api/ipcheck
 *
 * 🔴 สองกฎที่ไฟล์ประกาศเอง และพลาดแล้วกลับหัวทั้งคู่:
 *   ① **ไม่รู้ IP ⇒ null แล้วต้องไม่นับ** — ห้ามคืน 'unknown' แล้วใช้เป็นกุญแจ
 *      ยัดทุกคนลงกุญแจก้อนเดียว = ใครก็ได้ยิงผิด 5 ครั้งแล้ว **ทั้งร้านล็อกอินไม่ได้ 15 นาที**
 *      ⇒ ตัวกันเดารหัสกลายเป็นปุ่มปิดร้านที่ใครก็กดได้ (แย่กว่าไม่มีตัวกัน)
 *   ② **x-forwarded-for ต้องอ่านตัวท้าย ไม่ใช่ตัวหน้า** — ลูกค้าส่งหัวนี้มาเองได้
 *      ตัวหน้าคือค่าที่ลูกค้าพิมพ์เอง ⇒ เปลี่ยนทุกครั้งที่ยิง ⇒ **ตัวนับไร้ความหมาย**
 *
 * ⚠️ ของจริงที่เพิ่งเจอวันนี้ (29 ก.ย. 2569): ผมโดนด่านกันเดารหัสของฝั่งท่อล็อก IP ไป 15 นาที
 *    เพราะยิงด้วยคีย์ผิดซ้ำ ⇒ กลไกนี้ทำงานจริงและมีผลกับคนทำงานจริง
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `client-ip-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}
const คำขอ = (หัว = {}, ip) => ({ headers: new Headers(หัว), ...(ip === undefined ? {} : { ip }) })

try {
  execFileSync('npx', ['tsc', 'lib/client-ip.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  const { clientIp, ipSources } = await import(join(out, 'client-ip.js'))

  console.log('① 🔴 ไม่มีทางรู้ IP ⇒ null (ห้ามคืนคำว่า unknown มาเป็นกุญแจร่วม)')
  {
    const ผล = clientIp(คำขอ())
    ok('คืน null', ผล === null, JSON.stringify(ผล))
    ok('ไม่ใช่สตริงใด ๆ', typeof ผล !== 'string',
      'คืนสตริง ⇒ ทุกคนใช้กุญแจเดียวกัน ⇒ ใครยิงผิด 5 ครั้ง ทั้งร้านล็อกอินไม่ได้')
    ok('หัวที่มีแต่ค่าว่างก็ยังเป็น null',
      clientIp(คำขอ({ 'x-forwarded-for': '   ', 'x-real-ip': '' })) === null)
  }

  console.log('② ลำดับความน่าเชื่อ — ของที่ปลอมไม่ได้ต้องมาก่อน')
  {
    ok('req.ip มาก่อนทุกหัว', clientIp(คำขอ({
      'x-nf-client-connection-ip': '2.2.2.2', 'x-forwarded-for': '9.9.9.9',
    }, '1.1.1.1')) === '1.1.1.1')
    ok('หัวของ Netlify มาก่อน x-real-ip และ x-forwarded-for', clientIp(คำขอ({
      'x-nf-client-connection-ip': '2.2.2.2', 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '9.9.9.9',
    })) === '2.2.2.2')
    ok('x-real-ip มาก่อน x-forwarded-for', clientIp(คำขอ({
      'x-real-ip': '3.3.3.3', 'x-forwarded-for': '9.9.9.9',
    })) === '3.3.3.3')
  }

  console.log('③ 🔴 x-forwarded-for ต้องอ่าน **ตัวท้าย** — ตัวหน้าคือค่าที่ลูกค้าพิมพ์เองได้')
  {
    ok('สามตัว ⇒ เอาตัวท้าย', clientIp(คำขอ({
      'x-forwarded-for': '1.1.1.1, 2.2.2.2, 8.8.8.8',
    })) === '8.8.8.8', 'เอาตัวหน้า ⇒ ผู้ยิงเปลี่ยนค่าได้ทุกครั้ง ⇒ ตัวนับไม่เคยถึงเกณฑ์')
    ok('ตัวเดียว ⇒ ตัวนั้น', clientIp(คำขอ({ 'x-forwarded-for': '5.5.5.5' })) === '5.5.5.5')
    ok('มีช่องว่างเกิน ⇒ ตัดช่องว่างให้', clientIp(คำขอ({
      'x-forwarded-for': ' 1.1.1.1 ,  7.7.7.7 ',
    })) === '7.7.7.7')
    ok('มีคอมมาแต่ไม่มีค่า ⇒ null (ไม่ใช่สตริงว่างมาเป็นกุญแจ)',
      clientIp(คำขอ({ 'x-forwarded-for': ' , , ' })) === null)
  }

  console.log('④ ตัวบอกว่า "มีทางรู้ IP ไหม" — ต้องบอกแค่มี/ไม่มี ห้ามคืนตัวเลข IP')
  {
    const s = ipSources(คำขอ({ 'x-real-ip': '3.3.3.3', 'x-forwarded-for': '9.9.9.9' }))
    ok('ทุกช่องเป็น boolean', Object.values(s).every((v) => typeof v === 'boolean'), JSON.stringify(s))
    ok('ไม่มีเลข IP หลุดออกมา', !JSON.stringify(s).includes('3.3.3.3'), JSON.stringify(s))
    ok('บอกถูกว่ามีหัวไหน', s.xRealIp === true && s.xff === true && s.nfHeader === false)
    const ว่าง = ipSources(คำขอ())
    ok('ไม่มีสักทาง ⇒ false ทั้งหมด (จอจะได้เขียนว่ายังไม่มีตัวกัน)',
      Object.values(ว่าง).every((v) => v === false), JSON.stringify(ว่าง))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
