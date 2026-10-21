// ตั้งค่า → สิทธิ์การใช้งาน (ปิดแถว 40) — **ลอกผังจาก `zort-ui/82-zort-สิทธิ์การใช้งาน-UserRolelist.jpg`**
//
// ผัง ZORT (ได้ภาพ 7 ก.ย. 2569): หัวจอ "สิทธิ์การใช้งาน" + "จำนวน N รายการ"
//   ปุ่มน้ำเงิน "เพิ่มสิทธิ์การใช้งานใหม่" · ตารางคอลัมน์เดียว "ชื่อสิทธิ์การใช้งาน"
//   ลิงก์ "แก้ไข" ท้ายแถว · แถบล่าง เลขหน้า + จำนวนต่อหน้า
//   ของจริงร้านมี 3 role: Admin · พนักงาน · บัญชี
//
// ⚠️ **เดิมสองเมนู (ผู้ใช้งาน·สิทธิ์) ชี้หน้าเดียวกัน** — ZORT เป็นสองจอ จึงแยกตาม (7 ก.ย. 2569)
// ⚠️ ของเรามีสิทธิ์ **3 ชั้นกำหนดในโค้ด** (middleware.ts) — ตารางโชว์ของจริงของเรา
//    เดิมมี 2 ชั้น และจอเขียนไว้ตรง ๆ ว่ายังไม่มี "บัญชี" (ไม่แกล้งโชว์ของที่ไม่มี)
//    เพิ่มชั้น "บัญชี" จริงแล้ว 14 ก.ย. 2569 (งานกระดาน t_mu1bkqy4) ⇒ แถวนี้จึงมีของจริงรองรับ
//    🔴 **แก้ middleware แล้วต้องมาแก้ตารางนี้ด้วยเสมอ** — ตารางที่ตกยุคคือจอที่โกหก
// ⚠️ ลิงก์ "แก้ไข" ของ ZORT เป็นหน้าแก้จริง — ของเราแก้ที่โค้ด ⇒ เขียนบอกตรง ๆ แทนลิงก์หลอก
import { HEAD_BTN } from '@/components/zort/headBtn'
import Link from 'next/link'
/* หัวตาราง/ช่อง: ZORT /User/list กับ /Setting/UserRolelist ใช้ Kanit 14 #3e3e3e / เซลล์ 14 #3e3e3e (วัด 17 ต.ค. 2569)
   ⇒ ใช้ชิ้นกลาง ไม่ประกาศสำเนาในไฟล์ */
import { PageHead, TH_KANIT as TH, TD, ZORT_TABLE_SHADOW } from '@/components/zort'
import { pipeText } from '@/components/ui/PipeNote'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'


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
    detail: 'เข้าได้เฉพาะโอนสินค้า (/catalog) · จอรับคืนหน้าร้าน และ API ที่เกี่ยวข้อง — เปิดหน้าอื่นถูกพากลับ',
    who: 'พนักงานรายคน (STAFF_PASS_1..8) · รหัสรวมรุ่นเก่า (STAFF_PASSWORD) · ผู้ใช้ที่เพิ่มจากหน้าเว็บแบบ "พนักงาน"',
  },
  {
    /* เพิ่ม 14 ก.ย. 2569 · งานกระดาน t_mu1bkqy4 — ให้ครบสามชั้นเท่า ZORT
       ⚠️ แถวนี้จะอยู่ที่นี่ได้ **ก็ต่อเมื่อ middleware รู้จักจริง** — ตารางนี้คือคำอธิบายของจริง
          ไม่ใช่ความตั้งใจ · เทส scripts/tests/roles.test.mjs อ่านรายชื่อเส้นทางจาก middleware.ts
          มาตรวจให้แล้วว่าตรงกัน */
    name: 'บัญชี',
    detail: 'เห็นเฉพาะหน้าการเงิน (ภาพรวมการเงิน · รายได้/รายจ่ายอื่น · โอนเงิน · กระเป๋าเงิน · '
      + 'เอกสารบัญชี · รวมบิลทุกเจ้า · สะพาน PEAK) และ **แก้หรือบันทึกอะไรไม่ได้เลย** '
      + '(กันด้วยเมธอด: คำสั่งที่ไม่ใช่ GET ถูกปฏิเสธทุกเส้น) — เปิดหน้าอื่นถูกพาไปหน้าการเงิน',
    who: 'ผู้ใช้ที่เพิ่มจากหน้าเว็บแล้วเลือกชั้น "บัญชี" — ยังไม่มีช่อง env สำหรับชั้นนี้',
  },
]

export default function SettingsRolesPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สิทธิ์การใช้งาน"
        summary={เหมือนZORT
          /* 📐 โหมดเหมือน ZORT: หัวจอ ZORT มีแค่ "จำนวน N รายการ" ⇒ คำอธิบายเข้า ⓘ */
          ? <>จำนวน {ROLES.length} รายการ{' '}<span className="text-gray-400 cursor-help" title="ครบสามชั้นเท่า ZORT แล้ว (14 ก.ย. 2569) — Admin · พนักงาน · บัญชี">ⓘ</span></>
          : <>จำนวน {ROLES.length} รายการ{' | '}
          <span className="text-gray-400">
            ครบสามชั้นเท่า ZORT แล้ว (14 ก.ย. 2569) — Admin · พนักงาน · บัญชี
          </span></>}
        actions={
          /* ผัง ZORT: ปุ่ม "เพิ่มสิทธิ์การใช้งานใหม่" — ของเราพาไปหน้าที่บอกตรง ๆ ว่าต้องแก้โค้ด */
          <Link href="/core/soon/role-add"
            className={HEAD_BTN}
            style={{ background: '#4165ed' }}>
            เพิ่มสิทธิ์การใช้งานใหม่
          </Link>
        }
      />

      {/* 📐 โหมดเหมือน ZORT: กล่องตารางค่าเดียวกับ TableWrap ร่วม (หัวเทา #e8ecef · ไม่มีขอบ · เงาน้ำเงินจาง · แถวสูง 41.3) */}
      {/* 📏 21 ต.ค. 2569 ภาพ ZORT /Setting/UserRolelist (1600 = 1280×1.25): กล่องเริ่ม y165 · แถวสูง 36 (ไม่ใช่ 41.3 ของจอรายการทั่วไป) · ของเรา 160 / 41
          ⇒ จอนี้ใช้แถว 36 (= TD ช่องใน 8+8 + บรรทัด 20 พอดี) และเลื่อนลง 5 */}
      <div className={เหมือนZORT ? 'zort-table bg-white overflow-hidden [&_tbody_tr]:h-[36px] mt-[5px]' : 'border rounded-md overflow-hidden'}
        style={เหมือนZORT ? { boxShadow: ZORT_TABLE_SHADOW } : { background: '#f8f9fa', borderColor: '#e3e8f4' }}>
        <table className="w-full min-w-[640px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>ชื่อสิทธิ์การใช้งาน</th>
              {/* 📐 โหมดเหมือน ZORT (ภาพ /Setting/UserRolelist 20 ต.ค. 2569): ตารางคอลัมน์เดียว · สองคอลัมน์ของเราย้ายไปพับใต้ตาราง + title ของชื่อ (ไม่ลบ) */}
              {!เหมือนZORT && <th className={TH}>เข้าอะไรได้บ้าง</th>}
              {!เหมือนZORT && <th className={TH}>ใครอยู่ในสิทธิ์นี้</th>}
              <th className={TH}> </th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.name} className="border-b border-[#e8ecf8] last:border-0">
                <td className={TD}><span title={เหมือนZORT ? `${r.detail.replace(/\*\*/g, '')} · ใคร: ${r.who}` : undefined}>{r.name}</span></td>
                {/* ข้อความนี้มี **ตัวหนา** แบบ markdown ⇒ ผ่าน pipeText ไม่งั้นดอกจันขึ้นจอดิบ ๆ (เจอบนจอสิทธิ์การใช้งาน 18 ต.ค. 2569) */}
                {/* ⚠️ จอนี้เป็น server component — ค่าคลาสที่ import จาก @/components/zort (ไฟล์ 'use client') ห้ามต่อสตริง ⇒ ได้ [object Object] (เจอ 20 ต.ค. 2569) · สีใส่ที่ span ข้างใน */}
                {!เหมือนZORT && <td className={TD}><span className="text-gray-700">{pipeText(r.detail)}</span></td>}
                {!เหมือนZORT && <td className={TD}><span className="text-gray-500">{r.who}</span></td>}
                <td className={TD} style={{ textAlign: 'right' }}>
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

      {/* 📏 ZORT: แถบเลขหน้าห่างตาราง 21 · ปุ่มเลขหน้าพื้นเทาขอบเทา (ภาพเดียวกัน) */}
      <div className={`flex items-center justify-between ${เหมือนZORT ? 'mt-5' : 'mt-2'} text-[12.5px] text-gray-500`}>
        <span className={เหมือนZORT
          ? 'inline-block border border-[#ced4da] rounded px-2.5 py-1 bg-[#e9ecef] text-[#3e3e3e] text-[14px]'
          : 'inline-block border border-gray-300 rounded px-2 py-0.5 bg-white'}>1</span>
        <span>จำนวน {ROLES.length} รายการ | จำนวนต่อหน้า 20</span>
      </div>

      {/* โหมดเหมือน ZORT: รายละเอียดสิทธิ์ (เดิมเป็นสองคอลัมน์) พับไว้ตรงนี้ — <details> ใช้ได้โดยไม่ต้องมี JS (จอนี้เป็น server component) */}
      {เหมือนZORT && (
        <details className="mt-3 text-[11.5px]">
          <summary className="cursor-pointer select-none text-gray-500">แต่ละสิทธิ์เข้าอะไรได้บ้าง · ใครอยู่ในสิทธิ์นี้ <span className="text-gray-400">(กดเพื่ออ่าน)</span></summary>
          <dl className="mt-1 space-y-1.5 text-gray-600">
            {ROLES.map((r) => (
              <div key={r.name}><dt className="inline font-semibold text-gray-800">{r.name}</dt>{' — '}<dd className="inline">{pipeText(r.detail)} · <span className="text-gray-500">{r.who}</span></dd></div>
            ))}
          </dl>
        </details>
      )}

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        รายชื่อคนดูที่{' '}
        <Link href="/core/settings-users" className="text-[#337ab7] hover:underline">ผู้ใช้งาน</Link> ·
        อยากได้สิทธิ์ชั้นที่สาม (เช่น &ldquo;บัญชี&rdquo; เห็นเฉพาะการเงิน) ต้องแก้ middleware —
        เป็นของที่<b>ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้</b>
      </p>
    </div>
  )
}
