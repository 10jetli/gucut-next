// ตั้งค่า → รายงานอัตโนมัติ (ปิดแถว 42)
//
// ⚠️ **ยังไม่มีภาพจอ ZORT** ⇒ ไม่ได้ลอกผัง เขียนจากคำถามที่จอควรตอบ
//
// ZORT เมนูนี้ = ตั้งให้ระบบส่งรายงานให้เองตามเวลา (รายวัน/รายเดือน)
// ของเราไม่มีรายงานส่งตามเวลา **แต่มีงานตามเวลาที่ทำงานจริงอยู่ 7 ตัว**
// ⇒ จอนี้ตอบคำถามที่มีค่ากว่า: **มีอะไรวิ่งเองอยู่บ้าง กี่โมง และถ้ามันตายเราจะรู้ได้ยังไง**
//
// 🔴 **ข้อมูลคัดจาก netlify.toml/ไฟล์ฟังก์ชันด้วยมือ — ต้องบอกอายุตัวเอง**
//    เพิ่ม/ลบงานตามเวลาแล้วต้องกลับมาแก้ที่นี่ · แต่ละแถวชี้ไฟล์ต้นทางให้ตรวจย้อนได้
//    (กติกาเลขคัดมือ: ตัวเลข/รายการที่คนพิมพ์ ต้องมีวันที่ ไม่งั้นกลายเป็นคำโกหกเงียบ ๆ)
//
// ⚠️ **เวลาที่เขียนเป็นเวลาไทย** — cron ที่ Netlify เป็น UTC ต้องบวก 7 เสมอ
//    เขียน UTC ดิบบนจอ = คนอ่านคิดว่างานวิ่งตอนบ่าย ทั้งที่วิ่งตอนตีสาม
import Link from 'next/link'
import { PageHead, Pill } from '@/components/zort'

const CHECKED_AT = '6 ก.ย. 2569'

interface Job {
  name: string
  cron: string
  /** เวลาไทยที่คนอ่านเข้าใจ — แปลจาก cron (UTC) แล้ว */
  when: string
  what: string
  src: string
  /** รู้ได้ยังไงว่ามันยังวิ่งอยู่ — **ข้อสำคัญที่สุดของจอนี้** */
  howToTell: string
  /** ถ้ามันตายเงียบจะเกิดอะไร */
  ifDead: string
  alert?: boolean
}

const JOBS: Job[] = [
  {
    name: 'ซิงก์กระจกออเดอร์',
    cron: '13,43 * * * *', when: 'ทุกครึ่งชั่วโมง (นาทีที่ 13 กับ 43)',
    what: 'ดึงออเดอร์จาก ZORT เข้าคลังเงา — เป็นเส้นเลือดของทุกจอในหลังร้านนี้',
    src: 'netlify/functions/core-sync.mjs',
    howToTell: 'ดูอายุข้อมูลในจอรายการขาย — ถ้าเกิน 45 นาทีแปลว่าไม่วิ่ง',
    ifDead: 'ทุกจอโชว์เลขเดิมสวยงามโดยไม่มีอะไรฟ้อง — เคยเกิดจริงคืนย้ายฐาน 5 ก.ย.',
    alert: true,
  },
  {
    name: 'กวาดออเดอร์ Beam ค้างจ่าย',
    cron: '*/30 * * * *', when: 'ทุกครึ่งชั่วโมง',
    what: 'ตรวจว่าลูกค้าจ่ายผ่าน Beam แล้วหรือยัง (ตาข่ายชั้นที่ 3) + ทวงตะกร้า/ยอดค้างจ่าย',
    src: 'netlify/functions/beam-sweep.mjs · netlify/lib/remind.mjs',
    howToTell: 'ออเดอร์ที่จ่ายแล้วต้องเปลี่ยนสถานะเองภายในครึ่งชั่วโมง',
    ifDead: 'ลูกค้าจ่ายเงินแล้วแต่ร้านไม่รู้ จนกว่าจะมีคนเปิดดูเอง',
  },
  {
    name: 'ต่ออายุ token มาร์เก็ตเพลส',
    cron: '30 20 * * *', when: 'ตี 3:30 ทุกคืน',
    what: 'ต่ออายุ token ของ Shopee/Lazada/TikTok ให้เอง',
    src: 'netlify/functions/token-refresh.mjs',
    howToTell: 'จอการเชื่อมต่อ — การ์ดต้องขึ้นว่าเชื่อมได้',
    ifDead: 'token หมดอายุแล้วดึงออเดอร์/สต็อกจากมาร์เก็ตเพลสไม่ได้',
  },
  {
    name: 'สำรองข้อมูล',
    cron: '40 * * * *', when: 'ทุกชั่วโมง (นาทีที่ 40)',
    what: 'สำรองข้อมูลคลังเงาอัตโนมัติ',
    src: 'netlify/functions/backup-run.mjs',
    howToTell: 'จอสำรองข้อมูล — เวลาสำรองล่าสุดต้องไม่เกิน 1 ชั่วโมง',
    ifDead: 'ยังใช้งานได้ปกติ แต่วันที่ต้องกู้ข้อมูลจะไม่มีของให้กู้',
  },
  {
    name: 'ดึงรีวิว Shopee',
    cron: '20 17 * * *', when: '00:20 ทุกคืน',
    what: 'ดึงรีวิวใหม่จาก Shopee เข้าคิว แล้วรวมเข้าเว็บตอน build',
    src: 'netlify/functions/shopee-reviews-pull.mjs',
    howToTell: 'ช่อง "รับรีวิวใหม่จากมาร์เก็ตเพลส" ในหน้าสถานะระบบ (เงียบเกิน 48 ชม. = เหลือง)',
    ifDead: 'รีวิวใหม่ไม่ขึ้นเว็บ — ของเก่าไม่หาย',
  },
  {
    name: 'ตามเตือนเรื่องขอทะเบียนเลื่อยยนต์',
    cron: '30 2 * * *', when: '09:30 ทุกเช้า',
    what: 'เตือนลูกค้าที่ค้างขั้นตอนขอใบ ลซ.๑/ลซ.๒',
    src: 'netlify/functions/permit-remind.mjs',
    howToTell: 'ดูที่จอใบ ลซ.๒ ที่ลูกค้าส่งมา',
    ifDead: 'ลูกค้าค้างขั้นตอนโดยไม่มีใครตาม — ของค้างที่ร้าน',
  },
  {
    name: 'เก็บกวาดข้อมูลคนเข้าเว็บ',
    cron: '0 19 * * *', when: 'ตี 2 ทุกคืน',
    what: 'ลบคีย์ที่หมดอายุของตัวนับคนเข้าเว็บ',
    src: 'netlify/functions/live-sweep.mjs',
    howToTell: 'จอคนเข้าเว็บยังเปิดได้เร็ว (เคยช้า 25 วิเพราะคีย์สะสม)',
    ifDead: 'คีย์สะสมจนจอคนเข้าเว็บช้าลงเรื่อย ๆ',
  },
]

export default function SettingsJobsPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายงานอัตโนมัติ / งานตามเวลา"
        summary={
          <>
            มี <b>{JOBS.length}</b> งานที่วิ่งเองอยู่จริง
            {' | '}
            <span className="text-gray-400">คัดจากไฟล์ฟังก์ชันจริง · ตรวจล่าสุด {CHECKED_AT}</span>
          </>
        }
      />

      <div className="bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5 mb-4 text-[12.5px] text-blue-900 leading-relaxed">
        ℹ️ ZORT เมนูนี้คือ <b>ตั้งให้ระบบส่งรายงานให้เองตามเวลา</b> — ของเรา<b>ยังไม่มีรายงานส่งตามเวลา</b>
        {' '}(ดูรายงานได้ตลอดที่จอรายงาน ไม่ต้องรอให้ส่ง) · จอนี้จึงตอบคำถามที่มีค่ากว่าในตอนนี้:
        <b> มีอะไรวิ่งเองอยู่บ้าง กี่โมง และถ้ามันตายเราจะรู้ได้ยังไง</b>
      </div>

      <div className="space-y-3">
        {JOBS.map((j) => (
          <div key={j.src} className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
              <p className="text-[14.5px] font-semibold text-gray-900">{j.name}</p>
              <span className="flex items-center gap-2 shrink-0">
                {j.alert && <Pill tone="orange">มีแจ้งเตือนเมื่อล้ม</Pill>}
                <span className="text-[12.5px] text-gray-700 bg-gray-100 rounded px-2 py-0.5">{j.when}</span>
              </span>
            </div>
            <p className="text-[13px] text-gray-700 leading-relaxed">{j.what}</p>
            <dl className="text-[12px] mt-2.5 space-y-1.5">
              <div>
                <dt className="text-gray-400 text-[11px]">รู้ได้ยังไงว่ายังวิ่งอยู่</dt>
                <dd className="text-gray-700">{j.howToTell}</dd>
              </div>
              <div>
                {/* 🔴 ข้อนี้สำคัญที่สุด — งานตามเวลาที่ตายเงียบ คือของที่ไม่มีใครรู้ว่าตาย
                    (เกิดจริง 5 ก.ย.: ซิงก์ตายเพราะ await ไม่มี catch แล้วจอโชว์เลขเดิมสวยงาม) */}
                <dt className="text-gray-400 text-[11px]">ถ้ามันตายเงียบจะเกิดอะไร</dt>
                <dd className="text-amber-800">{j.ifDead}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-[11px]">ไฟล์ (ตรวจย้อนได้)</dt>
                <dd className="text-gray-500 font-mono text-[11.5px]">{j.src}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-[11px]">ตารางเวลา (UTC ที่ Netlify)</dt>
                <dd className="text-gray-500 font-mono text-[11.5px]">{j.cron}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        ⚠️ <b>เวลาที่แสดงเป็นเวลาไทยแล้ว</b> — cron ที่ Netlify เป็น UTC ต้องบวก 7 เสมอ
        (เขียน UTC ดิบบนจอ = คนอ่านคิดว่างานวิ่งตอนบ่าย ทั้งที่วิ่งตอนตีสาม) ·
        รายการนี้<b>คัดจากไฟล์ด้วยมือ</b> เพิ่ม/ลบงานแล้วต้องกลับมาแก้จอนี้ —
        แต่ละแถวชี้ไฟล์ต้นทางไว้ให้ตรวจย้อนได้ ·
        ดูสุขภาพระบบแบบยิงจริงได้ที่{' '}
        <Link href="/web/status" className="text-blue-600 hover:underline">สถานะระบบ</Link>
      </p>
    </div>
  )
}
