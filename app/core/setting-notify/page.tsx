'use client'
// ตั้งค่า → การแจ้งเตือน — ผังจาก `zort-ui/55-zort-ตั้งค่า-การแจ้งเตือน.jpg`
//
// ผัง ZORT: ชื่อจอ → แท็บช่องทาง (โปรแกรม/อีเมล/มือถือ) → รายการชนิดแจ้งเตือนซ้าย →
//           แผงตั้งค่าขวา (radio สิทธิ์ + ปุ่มบันทึก)
//
// ⚠️ **จอเราเป็น "แผนที่ของจริง" ไม่ใช่ฟอร์มตั้งค่า — โดยตั้งใจ**
//    ระบบแจ้งเตือนของร้านตั้งค่าด้วย env/โค้ด ไม่มีปุ่มเปิด-ปิดรายตัว
//    ทำ radio + ปุ่มบันทึกแบบ ZORT ตอนนี้ = ฟอร์มหลอกที่กดแล้วไม่เกิดอะไร
//    ⇒ โชว์ผังเดียวกัน (แท็บช่องทาง · รายการซ้าย · รายละเอียดขวา) แต่แผงขวา
//      บอกความจริง: ยิงเมื่อไหร่ · ใครได้ · ตั้งค่าอยู่ที่ไหน
//    การทำปุ่มเปิด-ปิดจริงเป็น "ฟีเจอร์ใหม่ที่ยังไม่ได้สั่ง" (เช็คลิสต์แถว 41 บันทึกไว้)
//
// 🔴 **ข้อมูลในจอนี้คัดจากโค้ดจริงด้วยมือ — ต้องบอกอายุตัวเอง** (กติกาเดียวกับ LedgerScreen)
//    เพิ่ม/ลบตัวแจ้งเตือนเมื่อไหร่ต้องกลับมาแก้ที่นี่ · แต่ละรายการชี้ไฟล์ต้นทางให้ตรวจได้
import { useState } from 'react'
import { PageHead } from '@/components/zort'

/** วันที่ไล่ตรวจกับโค้ดจริงล่าสุด — แก้เมื่อกลับมาตรวจใหม่ */
const CHECKED_AT = '6 ก.ย. 2569'

interface Notice {
  id: string
  name: string
  when: string
  who: string
  src: string
  note?: string
}

/** ช่องทางจริงของร้าน — เทียบชั้นกับแท็บ โปรแกรม/อีเมล/มือถือ ของ ZORT
 *  ⚠️ ร้านไม่ใช้อีเมลแจ้งเตือนเลย — ไม่ทำแท็บอีเมลเปล่าให้ดูเหมือนมี */
const CHANNELS: { id: string; label: string; desc: string; items: Notice[] }[] = [
  {
    id: 'telegram',
    label: 'Telegram (กลุ่มร้าน)',
    desc: 'เด้งเข้ากลุ่ม Telegram เดิมของร้าน — ผู้รับคือทีมงานทุกคนในกลุ่ม',
    items: [
      { id: 'order', name: 'ออเดอร์ใหม่เข้า', when: 'ลูกค้ากดสั่งซื้อบนเว็บ (ทันที)', who: 'กลุ่มร้าน + push มือถือแอดมิน', src: 'netlify/functions/orders.mjs' },
      { id: 'comment', name: 'คอมเมนต์ใหม่ใต้คลิป', when: 'มีคอมเมนต์ใหม่ (ทันที)', who: 'กลุ่มร้าน', src: 'netlify/functions/social.mjs' },
      { id: 'chat', name: 'แชทเว็บข้อความใหม่', when: 'ลูกค้าทักแชทในเว็บ', who: 'กลุ่มร้าน', src: 'netlify/functions/chat.mjs' },
      { id: 'time', name: 'พนักงานเข้า/เลิกงาน', when: 'กดลงเวลาที่ /time/ (เตือน ⚠️ ถ้าสาย/อยู่ไกล เฉพาะตอนเข้างาน)', who: 'กลุ่มร้าน', src: 'netlify/functions/time.mjs' },
      { id: 'sync', name: 'ซิงก์กระจกออเดอร์ล้ม', when: 'งานครึ่งชั่วโมงดึง ZORT ไม่สำเร็จ', who: 'กลุ่มร้าน', src: 'ฝั่งท่อ เพิ่ม 6 ก.ย. 2569', note: 'เกิดจากบทเรียนคืนย้ายฐาน — ของที่ล้มเงียบคือของที่ไม่มีใครรู้ว่าล้ม' },
    ],
  },
  {
    id: 'webpush',
    label: 'Web Push',
    desc: 'เด้งบนเครื่องที่กดรับแจ้งเตือนไว้ — ไม่ต้องล็อกอิน',
    items: [
      { id: 'admin', name: 'ออเดอร์ใหม่ (แอดมิน)', when: 'พร้อมกับ Telegram', who: 'มือถือแอดมินที่ลงทะเบียนไว้', src: 'netlify/lib/push.mjs (store gucut-push)' },
      { id: 'cust-status', name: 'สถานะออเดอร์ (ลูกค้า)', when: 'ได้รับออเดอร์/จ่ายแล้ว · จัดส่งแล้ว (กวาดทุกครึ่งชม.)', who: 'ลูกค้าที่กดปุ่ม 🔔 (ผูกกับออเดอร์/เบอร์)', src: 'order-finalize.mjs · zort-order.mjs', note: 'iPhone ต้องเพิ่มลงหน้าจอโฮมก่อนถึงเด้งได้ — หน้าเว็บบอกวิธีแทนการซ่อน' },
    ],
  },
  {
    id: 'line',
    label: 'LINE (@gucut1)',
    desc: 'ส่งหาลูกค้าที่ล็อกอินเว็บด้วย LINE และเป็นเพื่อน @gucut1',
    items: [
      { id: 'status', name: 'สถานะออเดอร์ (ลูกค้า)', when: 'ได้รับออเดอร์/จ่ายแล้ว · จัดส่งแล้ว', who: 'ลูกค้าที่ผูก LINE', src: 'netlify/lib/notify-customer.mjs' },
      { id: 'remind', name: 'ทวงตะกร้าค้าง + ยอดค้างจ่าย', when: 'ค้างจ่าย 45 นาที–24 ชม. · ตะกร้าแตะล่าสุด 3–24 ชม. — ทวงครั้งเดียวต่อใบ/ชุด', who: 'ลูกค้าที่ผูก LINE (+Web Push)', src: 'netlify/lib/remind.mjs', note: 'ห้ามทวงซ้ำหลายรอบ — โดนบล็อก LINE = เสียช่องทางถาวร' },
    ],
  },
]

export default function SettingNotifyPage() {
  const [chan, setChan] = useState(CHANNELS[0].id)
  const [sel, setSel] = useState(CHANNELS[0].items[0].id)
  const active = CHANNELS.find((c) => c.id === chan) ?? CHANNELS[0]
  const item = active.items.find((i) => i.id === sel) ?? active.items[0]

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ตั้งค่าการแจ้งเตือน"
        summary={
          <>
            การแจ้งเตือนที่ระบบส่งอยู่จริง แยกตามช่องทาง
            {' | '}
            <span className="text-gray-400">คัดจากโค้ดจริง · ตรวจล่าสุด {CHECKED_AT}</span>
          </>
        }
      />

      {/* ⚠️ ป้ายต้องมาก่อนเนื้อหา — จอ ZORT เป็นฟอร์มตั้งค่า ของเราเป็นแผนที่ของจริง
          ไม่บอก = คนหาปุ่มเปิด-ปิดแล้วนึกว่าจอพัง */}
      <div className="bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5 mb-4 text-[12.5px] text-blue-900 leading-relaxed">
        ℹ️ จอนี้<b>อ่านอย่างเดียว</b> — บอกว่าระบบแจ้งเตือนอะไร ให้ใคร เมื่อไหร่ และตั้งค่าอยู่ที่ไฟล์ไหน ·
        ZORT รุ่นเต็มมีปุ่มเปิด-ปิดรายตัว ของเรา<b>ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้</b>
        (ตอนนี้เปิด-ปิดที่ env/โค้ด — สั่งเมื่อไหร่ค่อยทำปุ่มจริง ไม่ทำปุ่มหลอก)
      </div>

      {/* แท็บช่องทาง — ชั้นเดียวกับแท็บ โปรแกรม/อีเมล/มือถือ ของ ZORT
          ⚠️ ร้านไม่ใช้อีเมลแจ้งเตือน — ไม่ทำแท็บเปล่า */}
      <div className="flex flex-wrap items-center gap-6 border-b border-gray-200 mb-4 px-1">
        {CHANNELS.map((c) => (
          <button key={c.id}
            onClick={() => { setChan(c.id); setSel(c.items[0].id) }}
            className={`text-[13.5px] pb-2 -mb-px ${c.id === chan
              ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] text-gray-500 mb-3">{active.desc}</p>

      {/* ผัง ZORT: รายการซ้าย · รายละเอียดขวา */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-0 border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="border-b md:border-b-0 md:border-r border-gray-200">
          {active.items.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)}
              className={`block w-full text-left px-4 py-3 text-[13px] border-b border-gray-100 last:border-0 ${
                i.id === item.id ? 'bg-blue-50 text-blue-700 font-medium border-l-2 border-l-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
              {i.name}
            </button>
          ))}
        </div>
        <div className="p-5">
          <p className="text-[15px] font-semibold text-gray-900 mb-3">{item.name}</p>
          <dl className="text-[13px] space-y-2.5">
            <div><dt className="text-gray-400 text-[11.5px]">ยิงเมื่อ</dt><dd className="text-gray-800">{item.when}</dd></div>
            <div><dt className="text-gray-400 text-[11.5px]">ใครได้รับ</dt><dd className="text-gray-800">{item.who}</dd></div>
            <div><dt className="text-gray-400 text-[11.5px]">โค้ดที่ยิง (ตรวจได้)</dt>
              <dd className="text-gray-600 font-mono text-[12px]">{item.src}</dd></div>
            {item.note && (
              <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 leading-relaxed">
                ⚠️ {item.note}
              </div>
            )}
          </dl>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
        ⚠️ รายการนี้คัดจากโค้ดด้วยมือ (ตรวจล่าสุด {CHECKED_AT}) — เพิ่ม/ลบตัวแจ้งเตือนแล้วต้องกลับมาแก้จอนี้ ·
        แต่ละรายการชี้ไฟล์ต้นทางไว้ให้ตรวจย้อนได้ · ZORT มีแจ้งเตือนอีกชุด (ยอดขายประจำวัน/เดือน ·
        สินค้าใกล้หมด ฯลฯ ส่งทางอีเมล/แอป) — ของเราตอบโจทย์เดียวกันด้วยจอรายงานที่เปิดดูได้ตลอด
        ไม่ได้ส่งสรุปตามเวลา (ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้)
      </p>
    </div>
  )
}
