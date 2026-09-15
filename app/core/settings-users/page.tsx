// ตั้งค่า → ผู้ใช้งาน (ปิดแถว 39) — **ลอกผังจาก `zort-ui/81-zort-ผู้ใช้งาน-User-list.jpg`**
//
// ผัง ZORT (ได้ภาพ 7 ก.ย. 2569 — ก่อนหน้านี้เขียนจากคำถามที่จอควรตอบเพราะไม่มีภาพ):
//   หัวจอ "ผู้ใช้งาน" + "จำนวน N รายการ" · ปุ่มน้ำเงิน "เพิ่มผู้ใช้งาน" มุมขวา
//   ช่องค้นหา + ลิงก์ค้นหาขั้นสูง
//   คอลัมน์: ชื่อผู้ใช้งาน · วันที่สมัคร · เข้าใช้งานล่าสุด · สิทธิ์การใช้งาน · สถานะ (ป้ายเขียว "ใช้งานได้")
//   แถบล่าง: เลขหน้า + "จำนวน N รายการ | จำนวนต่อหน้า 20"
//
// ⚠️ **สองคอลัมน์ที่ ZORT มีแต่เราไม่มีข้อมูล** (วันที่สมัคร · เข้าใช้งานล่าสุด) — ขีดไว้ ไม่ใช่ลบทิ้ง
//    (กติกาเดียวกับจอวางแผนสั่งซื้อ: คอลัมน์ตามผัง แต่บอกตรง ๆ ว่าไม่มีค่า เพราะอะไร)
//
// ✅ **ตารางรวมผู้ใช้สองแหล่งแล้ว** (ใบ t_mu1ybgb1 · 15 ก.ย. 2569)
//    ① Netlify env (STAFF_NAME_1..8 · SITE_PASSWORD) — แก้ต้องไปตั้งที่ Netlify แล้ว deploy ใหม่
//    ② ทะเบียนผู้ใช้ `lib/staff-users.ts` ที่ฟอร์ม `/core/settings-users/add` บันทึกไว้ — แก้ได้จากจอ
//    🔴 **ที่มาของใบนี้**: เดิมจอนี้อ่าน env อย่างเดียว ⇒ เพิ่มผู้ใช้จากหน้าเว็บแล้วกลับมาไม่เห็นชื่อ
//       ⇒ นึกว่าไม่สำเร็จ แล้วเพิ่มซ้ำ · และ "จำนวน N รายการ" นับไม่ครบ
//
// 🔴 **สี่ข้อที่ห้ามถอด** (ข้อระวังในใบ — ทุกข้อมีเหตุผลที่แลกมาด้วยของจริง)
//    ① **ชื่อซ้ำห้ามยุบเป็นแถวเดียว** — คนละบัญชี รหัสคนละตัว ปิดคนละทาง
//       ยุบเมื่อไหร่ = มีบัญชีที่ไม่มีใครเห็นและไม่มีใครปิด
//    ② **ห้ามตัดแหล่งไหนออก** แม้จะดูซ้ำซ้อน — ทั้งสองแหล่งล็อกอินได้จริงทั้งคู่
//    ③ **อ่านแหล่งไหนไม่ได้ ต้องประกาศ** ไม่ใช่แสดงตารางที่ขาดคนไปเงียบ ๆ
//       (`readAll()` ตั้งใจโยน error ⇒ ห้าม catch เป็น [] · ไม่รู้ ≠ ไม่มี)
//    ④ **ห้ามโชว์รหัส** — ฝั่ง env บอกได้แค่ "ตั้งแล้ว/ยาวกี่ตัว" · ฝั่งเว็บเก็บแบบย้อนกลับไม่ได้
//       ⇒ บอกได้แค่ "ตั้งรหัสแล้ว" **ห้ามบอกความยาว** เพราะเราไม่รู้และไม่ควรรู้
//
// 🔴 **จอนี้เป็นเซิร์ฟเวอร์คอมโพเนนต์โดยตั้งใจ — ห้ามทำเป็นจอฝั่งเบราว์เซอร์**
//    เพราะอ่านชื่อพนักงานจาก env (STAFF_NAME_1..8) ซึ่งอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
//    ช่องค้นหาจึงเป็นฟอร์ม GET (?q=) ให้เซิร์ฟเวอร์กรอง — ค้นได้จริง ไม่ใช่ช่องหลอก
//    ⚠️ **ห้ามส่งค่ารหัสผ่านออกไปไม่ว่ากรณีใด** — บอกแค่ "ตั้งแล้วหรือยัง ยาวกี่ตัว"
import Link from 'next/link'
import { PageHead } from '@/components/zort'
import { listStaffUsers } from '@/lib/staff-users'

const env = (k: string) => (process.env[k] ?? '').trim()

/** วันที่แบบไทยสั้น ๆ จาก ISO (UTC) — +7 ก่อนแสดง เหมือนทุกจอในโปรเจกต์ */
function thaiDay(iso: string) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  const th = new Date(t.getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(th.getUTCDate())}/${p(th.getUTCMonth() + 1)}/${th.getUTCFullYear() + 543}`
}

/** ⚠️ คืนแค่ "ตั้งไว้ไหม" กับ "ยาวกี่ตัว" — **ห้ามคืนค่าจริง** */
function passInfo(k: string) {
  const v = env(k)
  return { set: v.length > 0, len: v.length }
}

const TH = 'text-left font-normal text-[12px] text-gray-500 px-3 py-2.5 whitespace-nowrap'
const TD = 'px-3 py-3 text-[12.5px] align-top'

/** แถวในตาราง — มาจากสองแหล่ง และ **ต้องรู้ว่าแถวไหนมาจากไหน** */
interface UserRow {
  name: string
  role: string
  ok: boolean
  passNote: string
  /** 🔴 ป้ายแหล่งที่มา — ห้ามตัดทิ้ง ผู้ใช้สองแหล่งแก้คนละที่คนละวิธี
   *  env = ต้องแก้ที่ Netlify แล้ว deploy ใหม่ · เว็บ = แก้ได้จากจอนี้ทันที */
  source: 'env' | 'web'
  createdAt?: string
  active?: boolean
}

export default async function SettingsUsersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q ?? '').trim().toLowerCase()
  const admin = passInfo('SITE_PASSWORD')
  const legacyStaff = passInfo('STAFF_PASSWORD')
  const named = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return { n, name: env(`STAFF_NAME_${n}`), pass: passInfo(`STAFF_PASS_${n}`) }
  }).filter((x) => x.name || x.pass.set)

  /* ⚠️ ชื่อมีแต่รหัสไม่มี = คนนั้นล็อกอินไม่ได้เลย · รหัสมีแต่ชื่อไม่มี = เข้าได้แต่ไม่รู้ว่าใคร */
  const broken = named.filter((x) => !x.name || !x.pass.set)

  /** แถวตามผัง ZORT — เจ้าของร้าน (แอดมิน) + พนักงานรายคน (จาก env) */
  const envRows = [
    { name: 'เจ้าของร้าน', role: 'Admin', ok: admin.set, passNote: admin.set ? `ตั้งแล้ว · ${admin.len} ตัว` : 'ยังไม่ได้ตั้ง' },
    ...named.map((x) => ({
      name: x.name || '(ไม่ได้ตั้งชื่อ)',
      role: 'พนักงาน — เฉพาะโอนสินค้า',
      ok: x.pass.set,
      passNote: x.pass.set ? `ตั้งแล้ว · ${x.pass.len} ตัว` : 'ยังไม่ได้ตั้ง',
    })),
  ] as UserRow[]
  for (const r of envRows) r.source = 'env'

  /* ── ผู้ใช้ที่เพิ่มจากหน้าเว็บ (lib/staff-users.ts) ─────────────────────────
     🔴 **อ่านไม่ได้ ≠ ไม่มีผู้ใช้** — `readAll()` ตั้งใจโยน error ออกมาเมื่ออ่านที่เก็บไม่ได้
        ⇒ ถ้าเรา catch แล้วใส่ [] เงียบ ๆ จอจะขึ้นเหมือน "ยังไม่มีใครเพิ่มจากเว็บ"
           ทั้งที่ความจริงคือ **เราไม่รู้** ⇒ คนอาจเพิ่มซ้ำ หรือคิดว่าคนที่ปิดไปแล้วยังเข้าได้
        ⇒ เก็บเป็นสถานะ error แล้วประกาศบนจอ (กฎเดียวกับทั้งโปรเจกต์: ไม่รู้ ≠ ไม่มี) */
  let webRows: UserRow[] = []
  let webErr = ''
  try {
    const list = await listStaffUsers()
    webRows = list.map((u) => ({
      name: u.name,
      role: u.role === 'account' ? 'บัญชี — เห็นเฉพาะการเงิน (ดูอย่างเดียว)' : 'พนักงาน — เฉพาะโอนสินค้า',
      ok: u.active,
      /* ⚠️ ผู้ใช้จากเว็บเก็บรหัสเป็นค่าที่ย้อนกลับไม่ได้ ⇒ บอกได้แค่ว่า "ตั้งแล้ว"
         **ห้ามบอกความยาว** เหมือนฝั่ง env เพราะเราไม่รู้ และไม่ควรรู้ */
      /* ⚠️ ป้ายสถานะข้างนอกเติมคำว่า "เข้าไม่ได้ — " ให้อยู่แล้ว ⇒ ตรงนี้เขียนสั้น
         ไม่งั้นได้ "เข้าไม่ได้ — ถูกปิดใช้งาน — เข้าระบบไม่ได้" (เจอตอนเปิดดูด้วยตา) */
      passNote: u.active ? 'ตั้งรหัสแล้ว (เก็บแบบย้อนกลับไม่ได้)' : 'ถูกปิดใช้งาน',
      source: 'web' as const,
      createdAt: u.createdAt,
      active: u.active,
    }))
  } catch (e) {
    webErr = e instanceof Error ? e.message : String(e)
  }

  /* 🔴 **ชื่อซ้ำกันสองแหล่ง ห้ามยุบเป็นแถวเดียว** — เป็นคนละบัญชีจริง ๆ
     รหัสคนละตัว แก้คนละที่ ปิดคนละทาง ⇒ ยุบแล้วจะมีบัญชีหนึ่งที่ไม่มีใครเห็นและไม่มีใครปิด
     ⇒ แสดงครบทุกแถว แล้ว **ติดป้ายเตือนว่าชื่อนี้ซ้ำ** ให้คนไปดูว่าตั้งใจหรือพลาด */
  const allRows = [...envRows, ...webRows]
  const nameCount = new Map<string, number>()
  for (const r of allRows) nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1)
  const dupNames = Array.from(nameCount.entries()).filter(([, n]) => n > 1).map(([k]) => k)

  const rows = allRows.filter((r) => !q || r.name.toLowerCase().includes(q))

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผู้ใช้งาน"
        /* 🔴 ตัวนับต้องบอกด้วยว่า **นับจากกี่แหล่ง และครบไหม**
           อ่านแหล่งเว็บไม่ได้ ⇒ เลขนี้ไม่ใช่จำนวนผู้ใช้ทั้งหมด ⇒ ห้ามปล่อยให้อ่านเหมือนครบ */
        summary={<>จำนวน {rows.length} รายการ{' | '}
          {webErr
            ? <span className="text-red-700">⚠️ <b>ยังไม่ครบ</b> — อ่านผู้ใช้ที่เพิ่มจากหน้าเว็บไม่ได้รอบนี้</span>
            : <span className="text-gray-400">รวมทั้งผู้ใช้จาก Netlify env และผู้ใช้ที่เพิ่มจากหน้าเว็บ</span>}</>}
        actions={
          /* ผัง ZORT: ปุ่มน้ำเงิน "เพิ่มผู้ใช้งาน" — ของเราพาไปหน้าที่บอกวิธีเพิ่มจริง (Netlify env)
             ไม่ทำฟอร์มบนเว็บ เพราะฟอร์มที่ตั้งรหัสได้ต้องส่งรหัสผ่านหน้าเว็บ
             8 ก.ย. 2569: เลิกพาไป /core/soon/user-add (หน้า "ยังไม่ได้ทำ" กลาง ๆ)
             ไปหน้าจริงที่บอกช่องว่างถัดไป + ลิงก์ตรง + ข้อ "ต้อง deploy ใหม่" ที่พิสูจน์แล้ว */
          <Link href="/core/settings-users/add"
            className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
            style={{ background: '#4669e5' }}>
            เพิ่มผู้ใช้งาน
          </Link>
        }
      />

      {/* ช่องค้นหาตามผัง — ฟอร์ม GET ให้เซิร์ฟเวอร์กรอง (จอนี้เป็น server component) */}
      <form method="get" className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-full px-3.5 py-1.5 w-[280px]">
          <span className="text-gray-400 text-[13px]">🔍</span>
          <input name="q" defaultValue={searchParams?.q ?? ''} placeholder="ค้นหาผู้ใช้งาน"
            className="flex-1 text-[13px] outline-none bg-transparent" />
        </div>
        <button type="submit" className="text-[13px] text-blue-600 hover:underline">ค้นหา</button>
        {q && <Link href="/core/settings-users" className="text-[13px] text-gray-500 hover:underline">ล้างคำค้น</Link>}
      </form>

      {/* 🔴 อ่านแหล่งใดแหล่งหนึ่งไม่ได้ **ต้องประกาศ** ไม่ใช่แสดงตารางที่ขาดคนไปเงียบ ๆ */}
      {webErr && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
          🔴 <b>อ่านรายชื่อผู้ใช้ที่เพิ่มจากหน้าเว็บไม่ได้รอบนี้</b> ({webErr})
          <br />
          ⇒ ตารางข้างล่าง<b>มีเฉพาะผู้ใช้จาก Netlify env</b> · <b>อย่าเพิ่งสรุปว่าไม่มีใครถูกเพิ่มจากเว็บ</b>
          {' '}และอย่าเพิ่งเพิ่มซ้ำ — ลองโหลดใหม่อีกครั้ง
        </div>
      )}

      {/* 🔴 ชื่อซ้ำข้ามแหล่ง — บอกให้เห็น ไม่ยุบแถว (ดูเหตุผลตรงที่คำนวณ dupNames) */}
      {dupNames.length > 0 && (
        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
          ⚠️ <b>มีชื่อซ้ำกัน {dupNames.length} ชื่อ</b> ({dupNames.join(' · ')}) —
          {' '}เป็น<b>คนละบัญชี</b> รหัสคนละตัว แก้คนละที่ · จอนี้แสดงครบทุกแถวโดยตั้งใจ
          {' '}⇒ ถ้าไม่ได้ตั้งใจให้ซ้ำ ควรปิดอันใดอันหนึ่ง ไม่งั้นจะมีบัญชีที่ไม่มีใครดูแล
        </div>
      )}

      {broken.length > 0 && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
          🔴 <b>ตั้งค่าไม่ครบ {broken.length} คน</b> —{' '}
          {broken.map((x) => (
            <span key={x.n} className="block">
              · ช่อง {x.n}: {x.name ? `มีชื่อ "${x.name}" แต่ยังไม่ได้ตั้งรหัส ⇒ คนนี้เข้าระบบไม่ได้เลย`
                : 'มีรหัสแต่ไม่มีชื่อ ⇒ ล็อกอินได้แต่ไม่รู้ว่าใคร'}
            </span>
          ))}
        </div>
      )}

      {!admin.set && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4">
          🔴 <b>ยังไม่ได้ตั้ง SITE_PASSWORD — ตอนนี้หลังร้านเปิดโล่ง ใครก็เข้าได้</b>
        </div>
      )}

      {/* ── ตารางตามผังภาพ 81: 5 คอลัมน์ ── */}
      <div className="border rounded-md overflow-hidden" style={{ background: '#f8f9fa', borderColor: '#e3e8f4' }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className={TH}>ชื่อผู้ใช้งาน</th>
                {/* 🔴 คอลัมน์แหล่งที่มา — ไม่ใช่ของประดับ: แก้/ปิดผู้ใช้สองแหล่งทำคนละวิธี */}
                <th className={TH}>เพิ่มจากไหน</th>
                {/* ⚠️ สองคอลัมน์นี้ ZORT มีข้อมูล เราไม่มี — ระบบเก็บผู้ใช้ใน env ไม่มีใครบันทึกเวลา */}
                <th className={TH} title="ผู้ใช้ที่ตั้งใน env ไม่มีการบันทึกวันสมัคร (ผู้ใช้ที่เพิ่มจากหน้าเว็บมี createdAt แต่ตารางนี้ยังไม่ได้อ่านมาแสดง)">วันที่สมัคร</th>
                <th className={TH} title="ระบบเรายังไม่บันทึกเวลาล็อกอิน">เข้าใช้งานล่าสุด</th>
                <th className={TH}>สิทธิ์การใช้งาน</th>
                <th className={TH}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                  <td className={`${TD} text-gray-900 font-medium`}>
                    {r.name}
                    {dupNames.includes(r.name) && (
                      <span className="ml-1.5 text-[11px] text-amber-700" title="ชื่อนี้มีมากกว่าหนึ่งบัญชี — คนละบัญชีจริง ๆ">⚠️ ชื่อซ้ำ</span>
                    )}
                  </td>
                  <td className={TD}>
                    {r.source === 'web'
                      ? <span className="text-[11.5px] text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-0.5" title="เพิ่มจากจอนี้ — ปิด/ลบได้จากหน้าเพิ่มผู้ใช้งาน">หน้าเว็บ</span>
                      : <span className="text-[11.5px] text-gray-700 bg-gray-100 border border-gray-200 rounded px-2 py-0.5" title="ตั้งที่ Netlify env — แก้แล้วต้อง deploy ใหม่">Netlify env</span>}
                  </td>
                  {/* ✅ ผู้ใช้จากเว็บมี createdAt จริง ⇒ เลิกขีดทั้งคอลัมน์
                      (คอลัมน์นี้เคยขีดทุกแถวพร้อมคำอธิบายว่า "ไม่มีฐานข้อมูลผู้ใช้" ซึ่งเลิกจริงไปแล้ว) */}
                  <td className={`${TD} ${r.createdAt ? 'text-gray-700' : 'text-gray-300'}`}
                    title={r.createdAt ? '' : 'ผู้ใช้แถวนี้ตั้งใน env จึงไม่มีวันสมัครบันทึกไว้'}>
                    {r.createdAt ? thaiDay(r.createdAt) : '—'}
                  </td>
                  <td className={`${TD} text-gray-300`} title="ระบบเรายังไม่บันทึกเวลาล็อกอิน — ทั้งสองแหล่ง">—</td>
                  <td className={`${TD} text-gray-700`}>{r.role}</td>
                  <td className={TD}>
                    {/* ป้ายสถานะแบบ ZORT — ของเรา "ใช้งานได้" = ตั้งรหัสครบ · ไม่ครบ = เข้าไม่ได้จริง */}
                    {r.ok
                      ? <span className="inline-block text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">ใช้งานได้</span>
                      : <span className="inline-block text-[11.5px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5" title={r.passNote}>เข้าไม่ได้ — {r.passNote}</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[13px] text-gray-400">
                  {q ? `ไม่พบผู้ใช้ที่ชื่อตรงกับ "${searchParams?.q}"` : 'ยังไม่ได้ตั้งผู้ใช้'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* แถบล่างตามผัง — เลขหน้าล็อกไว้เพราะผู้ใช้มีไม่ถึงหน้าเดียว (โชว์ตามผัง ไม่แกล้งกดได้) */}
      <div className="flex items-center justify-between mt-2 text-[12px] text-gray-500">
        <span className="inline-block border border-gray-300 rounded px-2 py-0.5 bg-white">1</span>
        <span>จำนวน {rows.length} รายการ | จำนวนต่อหน้า 20</span>
      </div>

      {legacyStaff.set && (
        <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-3 leading-relaxed">
          ⚠️ <b>รหัสรวมรุ่นเก่า (STAFF_PASSWORD) ยังเปิดอยู่</b> — ใครรู้รหัสนี้ก็เข้าได้
          และแยกไม่ออกว่าเป็นใคร · ตั้งรหัสรายคนครบแล้วควรถอดออก
        </p>
      )}

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        สิทธิ์ของแต่ละคนดูที่{' '}
        <Link href="/core/settings-roles" className="text-blue-600 hover:underline">สิทธิ์การใช้งาน</Link> ·
        <b> คนละระบบกับ &ldquo;ลงเวลาพนักงาน&rdquo;</b> — จอนี้คือสิทธิ์เข้าหลังร้าน
        การลงเวลาใช้ PIN คนละชุด (<Link href="/site/attendance" className="text-blue-600 hover:underline">ลงเวลาพนักงาน</Link>)
      </p>
    </div>
  )
}
