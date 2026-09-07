// ตั้งค่า → สิทธิ์การใช้งาน (ปิดแถว 40) — **ลอกผังจาก `zort-ui/82-zort-สิทธิ์การใช้งาน-UserRolelist.jpg`**
//
// ผัง ZORT (ได้ภาพ 7 ก.ย. 2569): หัวจอ "สิทธิ์การใช้งาน" + "จำนวน N รายการ"
//   ปุ่มน้ำเงิน "เพิ่มสิทธิ์การใช้งานใหม่" · ตารางคอลัมน์เดียว "ชื่อสิทธิ์การใช้งาน"
//   ลิงก์ "แก้ไข" ท้ายแถว · แถบล่าง เลขหน้า + จำนวนต่อหน้า
//   ของจริงร้านมี 3 role: Admin · พนักงาน · บัญชี
//
// ⚠️ **เดิมสองเมนู (ผู้ใช้งาน·สิทธิ์) ชี้หน้าเดียวกัน** — ZORT เป็นสองจอ จึงแยกตาม (7 ก.ย. 2569)
// ⚠️ ของเรามีสิทธิ์ **2 ชั้นกำหนดในโค้ด** (middleware.ts) — ตารางโชว์ของจริงของเรา
//    ไม่แกล้งโชว์ 3 role ตาม ZORT เพราะ "บัญชี" ไม่มีในระบบเรา (แสดงของที่ไม่มี = จอโกหก)
// ⚠️ ลิงก์ "แก้ไข" ของ ZORT เป็นหน้าแก้จริง — ของเราแก้ที่โค้ด ⇒ เขียนบอกตรง ๆ แทนลิงก์หลอก
import Link from 'next/link'
import { PageHead } from '@/components/zort'

const TH = 'text-left font-normal text-[12px] text-gray-500 px-3 py-2.5 whitespace-nowrap'
const TD = 'px-3 py-3 text-[12.5px] align-top'

/** สิทธิ์จริงของระบบ — ต้องตรงกับ middleware.ts เสมอ (แก้ที่โน่นต้องมาแก้ที่นี่)
 *  ⚠️ ห้ามเพิ่มแถวที่ middleware ไม่รู้จัก — ตารางนี้คือคำอธิบายของจริง ไม่ใช่ความตั้งใจ */
const ROLES = [
  {
    name: 'Admin',
    detail: 'เข้าได้ทุกหน้าในหลังร้าน รวมยอดขาย ต้นทุน คูปอง และการตั้งค่า',
    who: 'เจ้าของร้าน (SITE_PASSWORD)',
  },
  {
    name: 'พนักงาน',
    detail: 'เข้าได้เฉพาะโอนสินค้า (/catalog) และ API ที่เกี่ยวข้อง — เปิดหน้าอื่นถูกพากลับ',
    who: 'พนักงานรายคน (STAFF_PASS_1..8) และรหัสรวมรุ่นเก่า (STAFF_PASSWORD)',
  },
]

export default function SettingsRolesPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สิทธิ์การใช้งาน"
        summary={<>จำนวน {ROLES.length} รายการ{' | '}
          <span className="text-gray-400">
            ZORT มี 3 สิทธิ์ (Admin · พนักงาน · บัญชี) — ของเรามี 2 ชั้น ยังไม่มี &ldquo;บัญชี&rdquo;
          </span></>}
        actions={
          /* ผัง ZORT: ปุ่ม "เพิ่มสิทธิ์การใช้งานใหม่" — ของเราพาไปหน้าที่บอกตรง ๆ ว่าต้องแก้โค้ด */
          <Link href="/core/soon/role-add"
            className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
            style={{ background: '#4669e5' }}>
            เพิ่มสิทธิ์การใช้งานใหม่
          </Link>
        }
      />

      <div className="border rounded-md overflow-hidden" style={{ background: '#f8f9fa', borderColor: '#e3e8f4' }}>
        <table className="w-full min-w-[640px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>ชื่อสิทธิ์การใช้งาน</th>
              <th className={TH}>เข้าอะไรได้บ้าง</th>
              <th className={TH}>ใครอยู่ในสิทธิ์นี้</th>
              <th className={`${TH} text-right`}> </th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.name} className="border-b border-[#e8ecf8] last:border-0">
                <td className={`${TD} text-gray-900 font-medium`}>{r.name}</td>
                <td className={`${TD} text-gray-700`}>{r.detail}</td>
                <td className={`${TD} text-gray-500`}>{r.who}</td>
                <td className={`${TD} text-right`}>
                  {/* ZORT ตรงนี้เป็นลิงก์ "แก้ไข" — ของเราแก้ที่โค้ด บอกตรง ๆ ดีกว่าลิงก์ที่กดแล้วไปไหนไม่ได้ */}
                  <span className="text-[11.5px] text-gray-400" title="สิทธิ์กำหนดใน middleware.ts — แก้ต้องแก้โค้ดแล้ว deploy">
                    กำหนดในโค้ด
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-2 text-[12px] text-gray-500">
        <span className="inline-block border border-gray-300 rounded px-2 py-0.5 bg-white">1</span>
        <span>จำนวน {ROLES.length} รายการ | จำนวนต่อหน้า 20</span>
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        รายชื่อคนดูที่{' '}
        <Link href="/core/settings-users" className="text-blue-600 hover:underline">ผู้ใช้งาน</Link> ·
        อยากได้สิทธิ์ชั้นที่สาม (เช่น &ldquo;บัญชี&rdquo; เห็นเฉพาะการเงิน) ต้องแก้ middleware —
        เป็นของที่<b>ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้</b>
      </p>
    </div>
  )
}
