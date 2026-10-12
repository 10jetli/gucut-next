#!/usr/bin/env node
/* แคชคำตอบ API ในจอ (`lib/api-cache.ts`) — ไฟล์ที่ **ไม่มีเทสและไม่มีด่านแตะเลย**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) ทั้งที่จอสต็อกและจอรายการขายใช้มัน
 *
 * 🔴 ทำไมไฟล์นี้ต้องมีเทสมากกว่าไฟล์ทั่วไป: ราคาที่จ่ายเมื่อมันผิดคือ **ตัวเลขเก่าบนจอ**
 *    ซึ่งหน้าตาปกติทุกประการ — ไม่มี error ไม่มีอะไรแดง คนอ่านตัดสินใจจากเลขที่ไม่จริง
 *    (หัวไฟล์นั้นเขียนเองว่า "ตัวเลขเก่าอันตรายกว่าช้า")
 *
 * 🔑 ทุกข้อในเทสนี้มาจาก **กติกาที่ไฟล์ประกาศไว้เอง** พร้อมเหตุการณ์จริงที่ทำให้กติกานั้นเกิด
 *    ไม่ใช่เกณฑ์ที่ผมคิดขึ้นเอง
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `api-cache-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  /* 🔑 บรรทัดนี้พิมพ์ **เฉพาะตอนตก** ⇒ ใช้เป็นสมอของสูตรปลูกได้ */
  if (!เงื่อนไข) { ตก++; console.log(`     🔴 ตกที่ ${ชื่อ}`) }
}

try {
  execFileSync('npx', ['tsc', 'lib/api-cache.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })

  /* 🔑 โมดูลนี้ **ห่อ window.fetch ตอน import** ⇒ ต้องปลอม window ให้มีก่อน
     ไม่งั้นกิ่งที่สำคัญที่สุด (ตัวล้างแคชอัตโนมัติ) จะไม่ถูกเดินเลยสักครั้ง
     ⚠️ เก็บ fetch ตัวจริงไว้ เพื่อดูว่าโมดูล "เรียกของเดิมต่อ" จริงไหม — ห้ามกลืนคำขอ */
  const เรียกจริง = []
  globalThis.window = {
    /* ⚠️ ตัวปลอมต้อง **ทนทานกว่าของจริง** — รุ่นแรกผมให้มัน String(input) ตรง ๆ
       พอทดสอบเคส "คำขอที่อ่านไม่ออก" ตัวปลอมเองพัง แล้วเทสรายงานว่าโมดูลพัง
       ⇒ ของปลอมที่พังง่ายกว่าของจริง ทำให้เราไล่บั๊กผิดตัว */
    fetch: async (input, init) => {
      let ชื่อ = '(อ่านไม่ออก)'
      try { ชื่อ = String(input?.url ?? input) } catch { /* ตั้งใจ: เคสทดสอบส่งของที่แปลงไม่ได้ */ }
      เรียกจริง.push(ชื่อ)
      return { headers: { has: () => false } }
    },
  }
  const m = await import(join(out, 'api-cache.js'))
  const { peekApiCache, putApiCache, clearApiCache, ageText, CACHE_MAX_AGE } = m
  const fetchห่อ = globalThis.window.fetch

  console.log('① คีย์คือ URL เต็ม — ตัดพารามิเตอร์ทิ้งเมื่อไหร่ สลับตัวกรองแล้วเห็นของตัวกรองก่อน')
  {
    clearApiCache()
    putApiCache('/api/web/core?list=stock&only=out', { rows: ['ของหมด'] })
    putApiCache('/api/web/core?list=stock&only=neg', { rows: ['ติดลบ'] })
    ok('สองตัวกรองเก็บแยกกัน',
      peekApiCache('/api/web/core?list=stock&only=out')?.data.rows[0] === 'ของหมด'
      && peekApiCache('/api/web/core?list=stock&only=neg')?.data.rows[0] === 'ติดลบ')
    ok('URL ที่ไม่เคยเก็บ ⇒ null (ไม่ใช่ของตัวอื่น)', peekApiCache('/api/web/core?list=stock') === null)
  }

  console.log('② ห้ามเก็บคำตอบที่ผิดพลาด — ไม่งั้นความผิดพลาดชั่วคราวค้างบนจอ 60 วินาที')
  {
    clearApiCache()
    for (const [ชื่อ, ก้อน] of [
      ['มี error', { error: 'พัง' }],
      ['ok:false', { ok: false, rows: [] }],
      ['skip', { skip: 'ยังไม่ได้ตั้งค่า' }],
      ['ไม่ใช่ object', 'ข้อความเปล่า'],
      ['null', null],
    ]) {
      putApiCache(`/api/x-${ชื่อ}`, ก้อน)
      ok(`ไม่เก็บ: ${ชื่อ}`, peekApiCache(`/api/x-${ชื่อ}`) === null)
    }
    putApiCache('/api/x-ดี', { ok: true, rows: [1] })
    ok('ของดีเก็บได้', peekApiCache('/api/x-ดี')?.data.rows[0] === 1)
  }

  console.log('③ อายุ: เกินเพดานถือว่าไม่มีแคช · และต้องบอกอายุกลับมาด้วย')
  {
    clearApiCache()
    putApiCache('/api/อายุ', { rows: [] })
    const ได้ = peekApiCache('/api/อายุ')
    ok('คืนอายุมาด้วย (จอต้องเอาไปเขียนว่าเลขเก่าแค่ไหน)', typeof ได้?.ageMs === 'number', JSON.stringify(ได้))
    ok('เพดานปริยาย 60 วินาที', CACHE_MAX_AGE === 60_000, String(CACHE_MAX_AGE))
    /* ⚠️ เกณฑ์ในโค้ดคือ `ageMs > maxAgeMs` (**เกิน** ไม่ใช่ **ถึง**)
       ⇒ ขอด้วยเพดาน 0 ในมิลลิวินาทีเดียวกันยังได้ของเดิม — เป็นพฤติกรรมขอบ ไม่ใช่บั๊ก
         (ไม่มีจอไหนขอเพดาน 0 · และ "ไม่อยากได้ของเก่า" ท่าที่ถูกคือไม่เรียก peek)
       ⇒ เทสจึงวัดด้วย **เวลาที่ผ่านไปจริง** แทนการงัดเคสขอบ */
    await new Promise((r) => setTimeout(r, 25))
    ok('ของที่เกินอายุ ⇒ ถือว่าไม่มีแคช', peekApiCache('/api/อายุ', 10) === null)
    ok('และถูกทิ้งออกจากหน่วยความจำเลย ไม่ค้างไว้',
      peekApiCache('/api/อายุ', 60_000) === null,
      'ของที่เกินอายุต้องถูกลบตอนตรวจพบ ไม่ใช่แค่ไม่คืนค่า')
  }

  console.log('④ ตัวล้างอัตโนมัติ — **กติกากลับด้าน**: ล้างเว้นแต่เป็นการอ่านที่รู้จัก')
  {
    clearApiCache()
    /* 🔴 ของจริงที่ทำให้กติกา "ไม่ใช่ GET ค่อยล้าง" ใช้ไม่ได้:
       ท่อมี 10 เส้นที่ **เขียนข้อมูลแต่สั่งด้วย GET ได้** (sync · snapshot · backup · restore …)
       ⇒ กติกาเดิมไม่จับสักตัว และแย่กว่าไม่มีระบบล้าง เพราะมันดูเหมือนมีระบบทำงานอยู่ */
    putApiCache('/api/web/core?list=stock', { rows: [1] })
    await fetchห่อ('/api/core?sync=1')          // GET ที่ไม่เคยประกาศว่าเป็นการอ่าน
    ok('🔑 GET ที่ไม่รู้จัก ⇒ ล้างแคชทั้งกอง', peekApiCache('/api/web/core?list=stock') === null,
      'เส้นซิงก์ที่สั่งด้วย GET จะทำให้จอโชว์เลขก่อนซิงก์อีกหนึ่งนาที')

    putApiCache('/api/web/core?list=stock', { rows: [2] })
    await fetchห่อ('/api/web/core?list=stock')  // เส้นที่ขึ้นทะเบียนแล้ว (ผ่าน peek/put)
    ok('การอ่านที่รู้จัก ⇒ **ไม่ล้าง**', peekApiCache('/api/web/core?list=stock')?.data.rows[0] === 2,
      'ถ้าล้าง แคชจะไม่มีวันรอดข้ามการกดเมนู')

    putApiCache('/api/web/core?list=stock', { rows: [3] })
    await fetchห่อ('/api/web/core?list=stock', { method: 'POST' })
    ok('เส้นเดียวกันแต่เป็น POST ⇒ ล้าง', peekApiCache('/api/web/core?list=stock') === null)

    /* 🔴 **ทะเบียน "เส้นไหนเป็นการอ่าน" ต้องไม่ถูกล้างพร้อมแคช** (ไฟล์นั้นเขียนกฎนี้ไว้เอง)
       ⚠️ **ข้อนี้ทดสอบด้วยพฤติกรรมไม่ได้ และผมพิสูจน์แล้วว่าทำไม** (29 ก.ย. 2569):
         ปลูก `knownReads.clear()` เข้าไปใน clearApiCache แล้ว **เทสยังเขียว**
         เพราะทั้ง `peekApiCache` และ `putApiCache` **ขึ้นทะเบียนใหม่ทุกครั้งที่ถูกเรียก**
         ⇒ ลำดับใด ๆ ที่เอาของเข้าแคชได้ ย่อมขึ้นทะเบียนไปแล้วเสมอ ⇒ ผลลัพธ์เหมือนกันทั้งสองแบบ
       ⇒ แปลว่ากฎนี้เป็น **ตาข่ายเผื่อรูปแบบการเรียกเปลี่ยน** (เช่นวันที่มีจอ fetch โดยไม่ peek ก่อน)
         ไม่ใช่กติกาที่แบกน้ำหนักอยู่ตอนนี้ ⇒ ตรวจที่ **รูปของโค้ด** และเขียนกำกับว่าทำไมวัดไม่ได้
       (ตรงกับกฎของเรา: ด่านที่ตรึงรูปร่างโค้ดแทนพฤติกรรม ต้องเขียนเหตุผลว่าทำไมวัดพฤติกรรมไม่ได้) */
    const ซอร์ส = readFileSync('lib/api-cache.ts', 'utf8')
    const ตัวล้าง = ซอร์ส.slice(ซอร์ส.indexOf('export function clearApiCache'),
      ซอร์ส.indexOf('export function clearApiCache') + 220)
    ok('clearApiCache ล้างเฉพาะแคช ไม่แตะทะเบียนเส้นอ่าน',
      !/knownReads\s*\.\s*clear\s*\(/.test(ตัวล้าง),
      'ล้างทะเบียนด้วย ⇒ วันที่มีจอ fetch โดยไม่ peek ก่อน แคชจะล้างกันเองไม่รู้จบ')
  }

  console.log('⑤ ธง x-wrote จากเซิร์ฟเวอร์ ⇒ ล้าง **แม้เป็นเส้นที่เรานับว่าอ่านอย่างเดียว**')
  {
    /* 🔴 รุ่นแรกของข้อนี้ไม่ได้ทดสอบอะไรเลย — ตัวปลอมไม่เคยติดธง x-wrote
       มันแค่ยืนยันเคสตรงข้าม แล้วดูเหมือนว่าครอบคลุม (ข้ออ้างว่าตรวจแล้ว)
       ⇒ ทำให้เดินเส้นทางจริง: โหลดโมดูล **สำเนาที่สอง** ด้วยตัวปลอมที่ติดธง
         (โมดูลห่อ fetch ครั้งเดียวตอน import ⇒ ต้อง import ใหม่ถึงจะห่อตัวปลอมตัวใหม่)
       🔑 ชั้นนี้มีไว้จับ "เส้นที่เรานับว่าอ่าน ดันไปเขียนข้อมูล" ซึ่งชั้นแรก (ดู URL ก่อนยิง) มองไม่เห็น */
    const เตือน = []
    const warnเดิม = console.warn
    console.warn = (...a) => เตือน.push(a.join(' '))
    globalThis.window.fetch = async () => ({ headers: { has: (h) => h === 'x-wrote' } })
    globalThis.window.__gucutCacheHooked = false
    const m2 = await import(join(out, 'api-cache.js') + '?v=2')
    const fetch2 = globalThis.window.fetch
    m2.putApiCache('/api/web/core?list=bundles', { rows: [1] })
    /* เส้นนี้ขึ้นทะเบียนว่า "อ่านอย่างเดียว" แล้ว (ผ่าน put) แต่เซิร์ฟเวอร์บอกว่ามันเขียน */
    await fetch2('/api/web/core?list=bundles')
    console.warn = warnเดิม
    ok('เซิร์ฟเวอร์ติดธง x-wrote ⇒ แคชถูกล้าง',
      m2.peekApiCache('/api/web/core?list=bundles') === null,
      'ชั้นที่สองไม่ทำงาน ⇒ เส้นอ่านที่แอบเขียนจะทำให้จอโชว์เลขก่อนเขียน')
    ok('และต้อง **ร้องออกมา** ไม่ใช่ล้างเงียบ ๆ (ล้างเงียบ = อาการหายแต่สาเหตุอยู่ต่อ)',
      เตือน.some((x) => x.includes('อ่านอย่างเดียว')), JSON.stringify(เตือน).slice(0, 120))
  }

  console.log('⑥ ห้ามทำให้ fetch ของจอพัง และต้องคืนคำตอบตัวเดิม')
  {
    const ก่อน = เรียกจริง.length
    const r = await fetchห่อ('/api/ทดสอบ')
    ok('เรียก fetch ตัวจริงต่อจริง', เรียกจริง.length === ก่อน + 1)
    ok('คืนคำตอบกลับมา (ไม่กลืน)', !!r && typeof r.headers?.has === 'function')
    /* อ่านคำขอไม่ออกก็ต้องไม่โยน — เรื่องแคชห้ามทำให้คำขอของจอพัง */
    let พัง = false
    try { await fetchห่อ({ toString() { throw new Error('อ่านไม่ได้') } }) } catch { พัง = true }
    ok('คำขอที่อ่านไม่ออก ⇒ ไม่โยน error ออกมา', !พัง, 'เรื่องแคชต้องไม่ทำให้ทั้งเว็บพัง')
  }

  console.log('⑦ คำอ่านอายุ — ต้องบอก "เก่าแค่ไหน" ไม่ใช่เวลานาฬิกา')
  {
    ok('ต่ำกว่า 5 วิ ⇒ เมื่อครู่', ageText(2000) === 'เมื่อครู่', ageText(2000))
    ok('30 วิ', ageText(30_000) === '30 วินาทีที่แล้ว', ageText(30_000))
    ok('2 นาที', ageText(120_000) === '2 นาทีที่แล้ว', ageText(120_000))
    ok('ค่าติดลบไม่ทำให้ข้อความเพี้ยน', ageText(-5000) === 'เมื่อครู่', ageText(-5000))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
process.exit(ตก ? 1 : 0)
