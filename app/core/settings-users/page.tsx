// ตั้งค่า → ผู้ใช้งาน + สิทธิ์การใช้งาน (ปิดแถว 39 กับ 40 ในเช็คลิสต์)
//
// ⚠️ **ยังไม่มีภาพจอ ZORT ของสองเมนูนี้** ⇒ ไม่ได้ลอกผัง เขียนจากคำถามที่จอควรตอบ
//    ได้ภาพเมื่อไหร่ค่อยจัดผัง (กติกา: ไม่มีภาพ ห้ามเดาผัง)
//
// 🔴 **จอนี้เป็นเซิร์ฟเวอร์คอมโพเนนต์โดยตั้งใจ — ห้ามทำเป็นจอฝั่งเบราว์เซอร์**
//    เพราะมันอ่านชื่อพนักงานจาก env (STAFF_NAME_1..8) ซึ่งอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
//    ถ้าทำเป็น client component แล้วส่งผ่าน props ค่าจะไปติดใน HTML ที่ส่งให้เบราว์เซอร์
//    ⚠️ **และห้ามส่งค่ารหัสผ่านออกไปไม่ว่ากรณีใด** — จอนี้บอกแค่ "มีกี่คน ตั้งรหัสแล้วหรือยัง"
//       ไม่เคยแตะตัวรหัส (กติกาเดียวกับ token ของ CAPI ที่ห้ามหลุดหน้าเว็บ)
import Link from 'next/link'
import { PageHead } from '@/components/zort'

/** อ่าน env แบบตัดช่องว่าง — ค่าว่างถือว่าไม่ได้ตั้ง */
const env = (k: string) => (process.env[k] ?? '').trim()

/** ⚠️ คืนแค่ "ตั้งไว้ไหม" กับ "ยาวกี่ตัว" — **ห้ามคืนค่าจริง**
 *  ความยาวบอกความแข็งแรงคร่าว ๆ ได้โดยไม่เปิดเผยรหัส */
function passInfo(k: string) {
  const v = env(k)
  return { set: v.length > 0, len: v.length }
}

export default function SettingsUsersPage() {
  const admin = passInfo('SITE_PASSWORD')
  const legacyStaff = passInfo('STAFF_PASSWORD')
  const named = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return { n, name: env(`STAFF_NAME_${n}`), pass: passInfo(`STAFF_PASS_${n}`) }
  }).filter((x) => x.name || x.pass.set)

  /* ⚠️ ชื่อมีแต่รหัสไม่มี = **คนนั้นล็อกอินไม่ได้เลย** และไม่มีอะไรฟ้อง
     ตรงข้ามกัน รหัสมีแต่ชื่อไม่มี = ล็อกอินได้แต่ไม่รู้ว่าใคร ⇒ ต้องชี้ทั้งสองแบบ */
  const broken = named.filter((x) => !x.name || !x.pass.set)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผู้ใช้งาน และสิทธิ์การใช้งาน"
        summary={
          <>
            ใครเข้าหลังร้านนี้ได้บ้าง และเข้าได้ถึงไหน
            {' | '}
            <span className="text-gray-400">อ่านจากการตั้งค่าจริงที่ Netlify ไม่ใช่ตารางที่พิมพ์ไว้</span>
          </>
        }
      />

      <div className="bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5 mb-4 text-[12.5px] text-blue-900 leading-relaxed">
        ℹ️ จอนี้<b>อ่านอย่างเดียว</b> — เพิ่ม/ลบผู้ใช้ทำที่ Netlify → Environment variables
        <b> ไม่มีปุ่มแก้บนจอโดยตั้งใจ</b> เพราะรหัสผ่านที่แก้ผ่านหน้าเว็บได้ ต้องส่งรหัสผ่านหน้าเว็บ ·
        จอนี้<b>ไม่เคยแตะตัวรหัส</b> บอกแค่ว่าตั้งไว้แล้วหรือยัง และยาวกี่ตัว
      </div>

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

      {/* ── ชั้นสิทธิ์จริงของระบบ (อ่านจาก middleware.ts) ── */}
      <p className="text-[15px] font-semibold text-gray-800 mb-2.5">สิทธิ์การใช้งาน — มี 2 ชั้น</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <p className="text-[14px] font-semibold text-gray-900 mb-1">👑 แอดมิน</p>
          <p className="text-[12.5px] text-gray-600 leading-relaxed">
            เข้าได้<b>ทุกหน้า</b>ในหลังร้าน รวมยอดขาย ต้นทุน คูปอง และการตั้งค่า
          </p>
          <p className="text-[12px] mt-2">
            {admin.set
              ? <span className="text-emerald-700">✅ ตั้งรหัสแล้ว ({admin.len} ตัวอักษร)</span>
              : <span className="text-red-700 font-medium">🔴 ยังไม่ได้ตั้ง SITE_PASSWORD — <b>ตอนนี้หลังร้านเปิดโล่ง ใครก็เข้าได้</b></span>}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <p className="text-[14px] font-semibold text-gray-900 mb-1">🧑‍🔧 พนักงาน</p>
          <p className="text-[12.5px] text-gray-600 leading-relaxed">
            เข้าได้เฉพาะ <b>โอนสินค้า</b> (<code className="text-[11.5px]">/catalog</code>) และ API ที่เกี่ยวข้อง ·
            เปิดหน้าอื่นจะถูกพากลับมาที่หน้าโอนสินค้า
          </p>
          <p className="text-[12px] mt-2 text-gray-600">
            มีคนที่ตั้งรหัสแยกรายคน <b>{named.filter((x) => x.pass.set).length}</b> คน
            {legacyStaff.set && <> · และยังมี<b>รหัสรวมรุ่นเก่า</b> (STAFF_PASSWORD) เปิดอยู่</>}
          </p>
          {legacyStaff.set && (
            /* ⚠️ รหัสรวมคือรหัสที่ไล่ออกใครไม่ได้ — เปลี่ยนทีเดียวกระทบทุกคน
               ไม่ใช่ของเสีย แต่คนดูแลควรรู้ว่ามันยังเปิดอยู่ */
            <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2 leading-relaxed">
              ⚠️ รหัสรวมรุ่นเก่ายังใช้ได้ — <b>ใครรู้รหัสนี้ก็เข้าได้ และแยกไม่ออกว่าเป็นใคร</b>
              {' '}ถ้าตั้งรหัสรายคนครบแล้ว ควรถอด STAFF_PASSWORD ออก
            </p>
          )}
        </div>
      </div>

      {/* ── รายชื่อผู้ใช้ ── */}
      <p className="text-[15px] font-semibold text-gray-800 mb-2.5">ผู้ใช้งาน</p>
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <table className="w-full min-w-[520px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5" style={{ width: 44 }}>#</th>
              <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">ชื่อ</th>
              <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">สิทธิ์</th>
              <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">รหัสผ่าน</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#e8ecf8]">
              <td className="px-3 py-3 text-[12.5px] text-gray-400">1</td>
              <td className="px-3 py-3 text-[12.5px] text-gray-900 font-medium">เจ้าของร้าน</td>
              <td className="px-3 py-3 text-[12.5px] text-gray-700">แอดมิน — ทุกหน้า</td>
              <td className="px-3 py-3 text-[12.5px]">
                {admin.set ? <span className="text-gray-500">ตั้งแล้ว · {admin.len} ตัว</span>
                  : <span className="text-red-600 font-medium">ยังไม่ได้ตั้ง</span>}
              </td>
            </tr>
            {named.map((x, i) => (
              <tr key={x.n} className="border-b border-[#e8ecf8] last:border-0">
                <td className="px-3 py-3 text-[12.5px] text-gray-400">{i + 2}</td>
                <td className="px-3 py-3 text-[12.5px] text-gray-900">
                  {x.name || <span className="text-gray-300">ไม่ได้ตั้งชื่อ</span>}
                </td>
                <td className="px-3 py-3 text-[12.5px] text-gray-700">พนักงาน — เฉพาะโอนสินค้า</td>
                <td className="px-3 py-3 text-[12.5px]">
                  {x.pass.set ? <span className="text-gray-500">ตั้งแล้ว · {x.pass.len} ตัว</span>
                    : <span className="text-red-600 font-medium">ยังไม่ได้ตั้ง</span>}
                </td>
              </tr>
            ))}
            {named.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-[13px] text-gray-400">
                ยังไม่ได้ตั้งพนักงานรายคน (STAFF_NAME_1..8)
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        ⚠️ <b>คนละระบบกับ &ldquo;ลงเวลาพนักงาน&rdquo;</b> — จอนี้คือสิทธิ์เข้าหลังร้าน
        ส่วนการลงเวลาใช้ PIN คนละชุด เก็บคนละที่ (ดู{' '}
        <Link href="/site/attendance" className="text-blue-600 hover:underline">ลงเวลาพนักงาน</Link>) ·
        เอามารวมกันไม่ได้เพราะพนักงานลงเวลาได้โดยไม่ต้องมีสิทธิ์เข้าหลังร้าน ·
        ZORT มีจอผู้ใช้งาน/สิทธิ์ที่ตั้งค่าได้ละเอียดกว่านี้มาก — ของเรามีสองชั้นเท่านั้น
        <b> ยังไม่มีภาพจอ ZORT ให้เทียบ จึงยังไม่ได้จัดผังตาม</b>
      </p>
    </div>
  )
}
