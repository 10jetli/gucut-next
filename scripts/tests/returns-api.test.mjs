#!/usr/bin/env node
/* สัญญาข้อมูลจอรับคืนสินค้า (`lib/returns-api.ts`) — **ที่เดียวที่จอคุยกับท่อเรื่องใบคืน**
 * (ใบ t_mu8i1pu1 · 29 ก.ย. 2569) 236 บรรทัด · ตัววัดใหม่ยืนยันว่าอยู่ในกอง
 * "ไม่พบว่าถูกแตะในขอบเขตที่วัดได้" — ไม่ใช่จากการค้นชื่อ แต่จาก coverage ของการรันจริง
 *
 * 🔑 ทำไมไฟล์นี้พลาดแล้วแพง: ใบคืนสินค้าทำให้ **ของกลับเข้าคลังจริง** และเงินคืนลูกค้าจริง
 *    และทุกขั้นมีของอยู่ในมือพนักงานแล้วตอนกด ⇒ ข้อความที่ผิดทำให้คนกดซ้ำ = ของเข้าคลังสองรอบ
 *
 * 🔑 กฎที่ไฟล์ประกาศเอง และเทสนี้ตรึงไว้:
 *    ① **อ่านคำตอบไม่ออก ⇒ "ไม่รู้ผล ห้ามกดซ้ำ"** ไม่ใช่ "ล้มเหลว"
 *       🔴 สองอย่างนี้สั่งคนละอย่าง: "ล้มเหลว" ⇒ คนกดซ้ำ · "ไม่รู้ผล" ⇒ คนไปตรวจก่อน
 *    ② **ท่อตอบ 200 พร้อมช่อง error ⇒ ต้องถือว่าพัง** (`res.json()` ไม่ throw ให้)
 *       คลาสประจำโปรเจกต์: 200 พร้อมหน้า error ของอีกฝั่ง
 *    ③ **ตัวตนพนักงานส่งเป็นหัวข้อความ ห้ามส่งชื่อจาก body** — ใครก็อ้างเป็นใครก็ได้
 *    ④ **เวลาจากท่อเป็น UTC เสมอ แม้ไม่มีตัวบอกโซน**
 *       🐛 ของจริง 8 ก.ย. 2569: จอโชว์ 16:58 แทน 23:58 (ขาด 7 ชม.) และอายุใบพองเกินจริง 7 ชม.
 *    ⑤ **returnId ออกโดยเซิร์ฟเวอร์ จอห้ามตั้งเอง**
 *    ⑥ ป้ายสถานะต้องครบทุกสถานะ — ขาดตัวไหน จอโชว์ undefined ให้คนที่ถือของอยู่ในมือ
 *
 * ⚠️ ขอบเขต: ปลอม `fetch` — ตรรกะตัดสินคำตอบ · การประกอบ URL · หัวข้อความ · ตัวแปลงเวลา
 *    (`มิลลิวินาทีจากท่อ` ใน lib/format.ts) เป็นของจริงทั้งหมด
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), `returns-api-${process.pid}-`))
let ตก = 0
const ok = (ชื่อ, เงื่อนไข, เหตุ = '') => {
  console.log(`  ${เงื่อนไข ? '✅' : '❌'} ${ชื่อ}${เงื่อนไข ? '' : ` — ${เหตุ}`}`)
  if (!เงื่อนไข) ตก++
}

try {
  execFileSync('npx', ['tsc', 'lib/returns-api.ts', '--outDir', out,
    '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { stdio: 'pipe' })
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  for (const f of readdirSync(out).filter((x) => x.endsWith('.js'))) {
    const ที่ = join(out, f)
    writeFileSync(ที่, readFileSync(ที่, 'utf8').replace(/(from\s+['"]\.\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2'))
  }
  const { returnsApi, setStaffPin, serverTimeMs, STATE_LABEL, TAKEOVER_REASONS } =
    await import(join(out, 'returns-api.js'))

  /** บันทึกคำขอที่ถูกยิง แล้วตอบตามที่สั่ง — เพื่อตรวจทั้ง "ส่งอะไรไป" และ "ตีความคำตอบยังไง" */
  let คำขอ = []
  const ตั้งคำตอบ = (ตอบ) => {
    คำขอ = []
    globalThis.fetch = async (url, init) => {
      คำขอ.push({ url: String(url), init: init ?? {} })
      return ตอบ
    }
  }
  const ตอบJSON = (ก้อน, status = 200) => ({
    ok: status >= 200 && status < 300, status, json: async () => ก้อน,
  })
  const อ่านไม่ออก = (status = 500) => ({
    ok: status >= 200 && status < 300, status,
    json: async () => { throw new Error('Unexpected token < in JSON') },
  })
  const จับError = async (fn) => { try { await fn(); return null } catch (e) { return String(e?.message ?? e) } }

  console.log('① 🔴 อ่านคำตอบไม่ออก ⇒ ต้องบอกว่า **ไม่รู้ผล ห้ามกดซ้ำ** ไม่ใช่ "ล้มเหลว"')
  {
    ตั้งคำตอบ(อ่านไม่ออก(500))
    const ข้อความ = await จับError(() => returnsApi.inbox())
    ok('โยน error ออกมา (ไม่คืนก้อนว่างให้จอคิดว่าไม่มีใบ)', ข้อความ !== null, 'ไม่โยน ⇒ จอขึ้นว่าไม่มีใบคืนเลย')
    ok('ข้อความบอกว่า "ไม่รู้ผล"', /ไม่รู้ผล/.test(ข้อความ ?? ''), ข้อความ)
    ok('ข้อความห้ามกดซ้ำ', /ห้ามกดซ้ำ/.test(ข้อความ ?? ''),
      `${ข้อความ} ⇒ คนที่ถือของอยู่ในมือจะกดซ้ำ ของเข้าคลังสองรอบ`)
    ok('บอกรหัส HTTP ให้ตามต่อได้', /500/.test(ข้อความ ?? ''), ข้อความ)
  }

  console.log('② 🔴 ท่อตอบ 200 พร้อมช่อง error ⇒ ต้องถือว่าพัง (json() ไม่ throw ให้)')
  {
    ตั้งคำตอบ(ตอบJSON({ error: 'ใบนี้ถูกยกเลิกแล้ว' }, 200))
    ok('200 + error ⇒ โยน', (await จับError(() => returnsApi.inbox())) === 'ใบนี้ถูกยกเลิกแล้ว',
      'ไม่โยน ⇒ จอวาดตารางว่างแล้วบอกว่าสำเร็จ')
    ตั้งคำตอบ(ตอบJSON({ skip: 'ยังไม่เปิดใช้เส้นนี้' }, 200))
    ok('200 + skip ⇒ โยนข้อความของท่อ', (await จับError(() => returnsApi.inbox())) === 'ยังไม่เปิดใช้เส้นนี้')
    ตั้งคำตอบ(ตอบJSON({ rows: [] }, 503))
    ok('503 แม้ไม่มีช่อง error ⇒ โยนพร้อมรหัส', /503/.test(await จับError(() => returnsApi.inbox()) ?? ''))
    ตั้งคำตอบ(ตอบJSON({ rows: [], total: 0 }, 200))
    const r = await returnsApi.inbox()
    ok('200 ไม่มี error ⇒ คืนก้อนตามจริง (total 0 ไม่ใช่ undefined)', r.total === 0 && Array.isArray(r.rows))
  }

  console.log('③ 🔴 ตัวตนพนักงานส่งเป็นหัวข้อความ · ห้ามส่งชื่อจาก body')
  {
    setStaffPin('  1234  ')
    ตั้งคำตอบ(ตอบJSON({ returnId: 'R1', ref: 'RT-1', state: 'received' }))
    await returnsApi.receive({ orderId: 'SO-1', items: [{ sku: 'A', qty: 1 }] })
    const h = new Headers(คำขอ[0].init.headers)
    ok('ส่งหัว x-staff-pin', h.get('x-staff-pin') === '1234', String(h.get('x-staff-pin')))
    ok('ตัดช่องว่างหัวท้ายให้', h.get('x-staff-pin') === '1234', 'ไม่ตัด ⇒ เซิร์ฟเวอร์แปลง PIN เป็นชื่อไม่ได้')
    const body = JSON.parse(คำขอ[0].init.body)
    for (const ห้าม of ['staff', 'name', 'who', 'พนักงาน']) {
      /* เหตุเอ่ย **ชื่อช่องที่หลุด** ด้วย — ลูปนี้วน 4 ช่อง ถ้าเหตุเหมือนกันหมด
         สมอจะบอกได้แค่ว่า "กฎนี้พัง" ไม่ได้บอกว่าช่องไหน */
      ok(`ใน body ไม่มีช่อง "${ห้าม}"`, !(ห้าม in body),
        `มีช่อง "${ห้าม}" ⇒ ใครก็อ้างเป็นใครก็ได้ · ${JSON.stringify(body)}`)
    }
    /* 🔴 PIN ว่าง **ห้ามส่งหัวเปล่า** — หัวที่มีค่าว่างอ่านได้ว่า "ยืนยันตัวตนแล้วว่าเป็นคนไม่มีชื่อ" */
    setStaffPin('')
    ตั้งคำตอบ(ตอบJSON({ rows: [] }))
    await returnsApi.inbox()
    ok('ยังไม่ใส่ PIN ⇒ ไม่ส่งหัวเลย (ไม่ใช่หัวค่าว่าง)',
      !new Headers(คำขอ[0].init.headers).has('x-staff-pin'),
      'ส่งหัวค่าว่าง ⇒ เซิร์ฟเวอร์อ่านได้ว่ายืนยันตัวตนแล้ว')
  }

  console.log('④ 🔴 returnId ออกโดยเซิร์ฟเวอร์ — จอห้ามตั้งเอง')
  {
    ตั้งคำตอบ(ตอบJSON({ returnId: 'R9', ref: 'RT-9', state: 'received' }))
    const r = await returnsApi.receive({ orderId: 'SO-9', items: [{ sku: 'A', qty: 2 }] })
    ok('ใน body ที่ส่งไปไม่มี returnId', !('returnId' in JSON.parse(คำขอ[0].init.body)),
      คำขอ[0].init.body)
    ok('อ่าน returnId จากคำตอบของเซิร์ฟเวอร์', r.returnId === 'R9')
  }

  console.log('⑤ 🔴 เวลาจากท่อเป็น UTC เสมอ แม้ไม่มีตัวบอกโซน (บั๊กขาด 7 ชม. 8 ก.ย. 2569)')
  {
    const มี = serverTimeMs('2026-09-08T23:58:00Z')
    const ไม่มีโซน = serverTimeMs('2026-09-08 23:58:00')
    ok('รูปที่ไม่มีตัวบอกโซน ให้เวลาเท่ากับรูปที่มี Z', ไม่มีโซน === มี,
      `${ไม่มีโซน} vs ${มี} ⇒ ต่างกัน = จอโชว์เวลาเพี้ยน 7 ชม. และอายุใบพองเกินจริง`)
    ok('ตรงกับ epoch ของ UTC จริง', มี === Date.parse('2026-09-08T23:58:00Z'), String(มี))
    /* 🔴 ไม่รู้เวลา ⇒ null **ห้ามเป็น 0** — 0 คือ 1 ม.ค. 1970 ⇒ อายุใบกลายเป็น 56 ปี */
    for (const ว่าง of [null, undefined, '', '   ', 123, {}]) {
      ok(`ค่าที่ใช้ไม่ได้ (${JSON.stringify(ว่าง)}) ⇒ null ไม่ใช่ 0`, serverTimeMs(ว่าง) === null,
        String(serverTimeMs(ว่าง)))
    }
  }

  console.log('⑥ ป้ายสถานะต้องครบทุกสถานะ และต้องแยก "เข้าสต็อกแล้ว" จาก "เข้าไม่ครบ"')
  {
    for (const s of ['received', 'graded', 'move_failed', 'moved', 'cancelled']) {
      ok(`มีป้ายของ ${s}`, typeof STATE_LABEL[s]?.text === 'string' && STATE_LABEL[s].text.length > 0,
        'ขาดป้าย ⇒ จอโชว์ undefined ให้คนที่ถือของอยู่ในมือ')
    }
    ok('move_failed ไม่ใช้ป้ายเดียวกับ moved', STATE_LABEL.move_failed.text !== STATE_LABEL.moved.text,
      'ป้ายเดียวกัน ⇒ ยิง 5 สำเร็จ 3 แล้วจอบอกว่าเข้าสต็อกแล้ว')
    ok('move_failed บอกทางออก (ยิงซ้ำได้)', /ยิงซ้ำ/.test(STATE_LABEL.move_failed.text),
      STATE_LABEL.move_failed.text)
    ok('move_failed เป็นสีแดง ไม่ใช่เขียว', STATE_LABEL.move_failed.tone === 'red',
      STATE_LABEL.move_failed.tone)
    ok('moved เป็นสีเขียว', STATE_LABEL.moved.tone === 'green', STATE_LABEL.moved.tone)
  }

  console.log('⑦ รหัสเหตุผลรับช่วง ต้องตรงกับที่เส้น takeover รับ (ไม่งั้นส่งไปแล้วท่อปฏิเสธ)')
  {
    const รหัสที่ประกาศ = TAKEOVER_REASONS.map(([c]) => c)
    ok('มี 3 เหตุผล', รหัสที่ประกาศ.length === 3, JSON.stringify(รหัสที่ประกาศ))
    ok('ทุกรหัสอยู่ในชุดที่ท่อรับ',
      รหัสที่ประกาศ.every((c) => ['shift-change', 'unreachable', 'other'].includes(c)),
      JSON.stringify(รหัสที่ประกาศ))
    ok('ทุกเหตุผลมีข้อความให้คนอ่าน', TAKEOVER_REASONS.every(([, l]) => typeof l === 'string' && l.length > 3))
    /* ยิงจริงด้วยรหัสแรกจากทะเบียน — ถ้าวันหน้ามีคนแก้ทะเบียนเป็นรหัสที่ท่อไม่รับ ข้อนี้ยังเขียว
       จึงเขียนกำกับว่าข้อนี้ตรวจ **ความตรงกันของทะเบียนกับชุดที่ประกาศในซอร์ส** ไม่ใช่กับท่อจริง */
    ตั้งคำตอบ(ตอบJSON({ doc: { returnId: 'R1', state: 'received' } }))
    await returnsApi.takeover({ returnId: 'R1', reason: รหัสที่ประกาศ[0], note: 'กะดึก' })
    ok('ส่ง reason ไปใน body', JSON.parse(คำขอ[0].init.body).reason === รหัสที่ประกาศ[0])
  }

  console.log('⑧ ค่าที่ไปอยู่ใน URL ต้องถูก encode — returnId ที่มี & หรือ # ต้องไม่หักคำขอ')
  {
    ตั้งคำตอบ(ตอบJSON({ doc: { returnId: 'a&b', state: 'received' } }))
    await returnsApi.get('a&b=1#x')
    ok('returnId ถูก encode', คำขอ[0].url.includes('a%26b%3D1%23x'), คำขอ[0].url)
    ok('ไม่มี & ดิบหลุดเข้าไปสร้างพารามิเตอร์ใหม่', คำขอ[0].url.split('?')[1].split('&').length === 1,
      `${คำขอ[0].url} ⇒ & ดิบ = ท่ออ่านเป็นพารามิเตอร์อีกตัว`)
    ตั้งคำตอบ(ตอบJSON({ rows: [] }))
    await returnsApi.inbox('ลูกค้า&x=1')
    ok('คำค้นถูก encode', คำขอ[0].url.includes('q=') && !คำขอ[0].url.includes('&x=1'), คำขอ[0].url)
    ตั้งคำตอบ(ตอบJSON({ rows: [] }))
    await returnsApi.inbox()
    ok('ไม่ส่งคำค้น ⇒ ไม่มี q= ในเส้น (ไม่ใช่ q= ว่าง)', !คำขอ[0].url.includes('q='), คำขอ[0].url)
  }

  console.log('⑨ ขอคืนเกินโควตา — ต้องอ่านได้ว่า "ไม่ได้สร้างใบ" ไม่ใช่ error เฉย ๆ')
  {
    /* ⚠️ ของอยู่ในมือพนักงานแล้ว ปฏิเสธความจริงไม่ได้ ⇒ ท่อตอบ 200 พร้อม overQuota
       ถ้าตัวเรียกโยน error ทิ้ง จอจะไม่มีตัวเลขไปเสนอทางออก (รับเท่าที่คืนได้) */
    ตั้งคำตอบ(ตอบJSON({ overQuota: true, over: [{ sku: 'A', 'ขอคืน': 3, 'คืนได้': 1 }] }))
    const r = await returnsApi.receive({ orderId: 'SO-1', items: [{ sku: 'A', qty: 3 }] })
    ok('ไม่โยน error (200 ไม่มีช่อง error)', r.overQuota === true, JSON.stringify(r))
    ok('ตัวเลขถึงจอครบ ทั้งที่ขอและที่คืนได้',
      r.over[0]['ขอคืน'] === 3 && r.over[0]['คืนได้'] === 1, JSON.stringify(r.over))
    ok('ไม่มี returnId ⇒ จออ่านได้ว่าไม่ได้สร้างใบ', r.returnId === undefined, String(r.returnId))
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(ตก ? `\n❌ ไม่ผ่าน ${ตก} ข้อ` : '\n✅ ผ่านทุกข้อ')
console.log('⚠️ ขอบเขต: ปลอม fetch — ตรรกะตัดสินคำตอบ · การประกอบ URL · หัวข้อความ · ตัวแปลงเวลา เป็นของจริง')
process.exit(ตก ? 1 : 0)
