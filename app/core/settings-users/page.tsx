// ตั้งค่า → ผู้ใช้งาน (ปิดแถว 39) — **ลอกผังจาก `zort-ui/81-zort-ผู้ใช้งาน-User-list.jpg`**
//
// ผัง ZORT (ได้ภาพ 7 ก.ย. 2569 — ก่อนหน้านี้เขียนจากคำถามที่จอควรตอบเพราะไม่มีภาพ):
//   หัวจอ "ผู้ใช้งาน" + "จำนวน N รายการ" · ปุ่มน้ำเงิน "เพิ่มผู้ใช้งาน" มุมขวา
//   ช่องค้นหา + ลิงก์ค้นหาขั้นสูง
//   คอลัมน์: ชื่อผู้ใช้งาน · วันที่สมัคร · เข้าใช้งานล่าสุด · สิทธิ์การใช้งาน · สถานะ (ป้ายเขียว "ใช้งานได้")
//   แถบล่าง: เลขหน้า + "จำนวน N รายการ | จำนวนต่อหน้า 20"
//
// ⚠️ **สองคอลัมน์ที่ ZORT มีแต่เราไม่มีข้อมูล** (วันที่สมัคร · เข้าใช้งานล่าสุด) — ขีดไว้ ไม่ใช่ลบทิ้ง
//    ระบบเราเก็บผู้ใช้ใน env ไม่มีฐานข้อมูลผู้ใช้ จึงไม่มีใครบันทึกเวลาพวกนี้
//    (กติกาเดียวกับจอวางแผนสั่งซื้อ: คอลัมน์ตามผัง แต่บอกตรง ๆ ว่าไม่มีค่า เพราะอะไร)
//
// 🔴 **จอนี้เป็นเซิร์ฟเวอร์คอมโพเนนต์โดยตั้งใจ — ห้ามทำเป็นจอฝั่งเบราว์เซอร์**
//    เพราะอ่านชื่อพนักงานจาก env (STAFF_NAME_1..8) ซึ่งอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
//    ช่องค้นหาจึงเป็นฟอร์ม GET (?q=) ให้เซิร์ฟเวอร์กรอง — ค้นได้จริง ไม่ใช่ช่องหลอก
//    ⚠️ **ห้ามส่งค่ารหัสผ่านออกไปไม่ว่ากรณีใด** — บอกแค่ "ตั้งแล้วหรือยัง ยาวกี่ตัว"
import Link from 'next/link'
import { PageHead } from '@/components/zort'

const env = (k: string) => (process.env[k] ?? '').trim()

/** ⚠️ คืนแค่ "ตั้งไว้ไหม" กับ "ยาวกี่ตัว" — **ห้ามคืนค่าจริง** */
function passInfo(k: string) {
  const v = env(k)
  return { set: v.length > 0, len: v.length }
}

const TH = 'text-left font-normal text-[12px] text-gray-500 px-3 py-2.5 whitespace-nowrap'
const TD = 'px-3 py-3 text-[12.5px] align-top'

export default function SettingsUsersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q ?? '').trim().toLowerCase()
  const admin = passInfo('SITE_PASSWORD')
  const legacyStaff = passInfo('STAFF_PASSWORD')
  const named = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return { n, name: env(`STAFF_NAME_${n}`), pass: passInfo(`STAFF_PASS_${n}`) }
  }).filter((x) => x.name || x.pass.set)

  /* ⚠️ ชื่อมีแต่รหัสไม่มี = คนนั้นล็อกอินไม่ได้เลย · รหัสมีแต่ชื่อไม่มี = เข้าได้แต่ไม่รู้ว่าใคร */
  const broken = named.filter((x) => !x.name || !x.pass.set)

  /** แถวตามผัง ZORT — เจ้าของร้าน (แอดมิน) + พนักงานรายคน */
  const rows = [
    { name: 'เจ้าของร้าน', role: 'Admin', ok: admin.set, passNote: admin.set ? `ตั้งแล้ว · ${admin.len} ตัว` : 'ยังไม่ได้ตั้ง' },
    ...named.map((x) => ({
      name: x.name || '(ไม่ได้ตั้งชื่อ)',
      role: 'พนักงาน — เฉพาะโอนสินค้า',
      ok: x.pass.set,
      passNote: x.pass.set ? `ตั้งแล้ว · ${x.pass.len} ตัว` : 'ยังไม่ได้ตั้ง',
    })),
  ].filter((r) => !q || r.name.toLowerCase().includes(q))

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผู้ใช้งาน"
        summary={<>จำนวน {rows.length} รายการ{' | '}
          <span className="text-gray-400">อ่านจากการตั้งค่าจริงที่ Netlify ไม่ใช่ตารางที่พิมพ์ไว้</span></>}
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
                {/* ⚠️ สองคอลัมน์นี้ ZORT มีข้อมูล เราไม่มี — ระบบเก็บผู้ใช้ใน env ไม่มีใครบันทึกเวลา */}
                <th className={TH} title="ระบบเราเก็บผู้ใช้ใน env — ไม่มีการบันทึกวันสมัคร">วันที่สมัคร</th>
                <th className={TH} title="ระบบเรายังไม่บันทึกเวลาล็อกอิน">เข้าใช้งานล่าสุด</th>
                <th className={TH}>สิทธิ์การใช้งาน</th>
                <th className={TH}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#e8ecf8] last:border-0">
                  <td className={`${TD} text-gray-900 font-medium`}>{r.name}</td>
                  <td className={`${TD} text-gray-300`} title="ระบบเราไม่ได้บันทึก — ผู้ใช้ตั้งใน env">—</td>
                  <td className={`${TD} text-gray-300`} title="ระบบเรายังไม่บันทึกเวลาล็อกอิน">—</td>
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
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[13px] text-gray-400">
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
