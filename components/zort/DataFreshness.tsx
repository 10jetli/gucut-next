'use client'
// บรรทัด "ข้อมูล ณ เวลา…" — บอกอายุของตัวเลขบนจอ
//
// 🔴 **ทำไมต้องมี** (4 ก.ย. 2569) — ทุกตัวเลขในจอคลังเงานับจากกระจก ไม่ได้ยิง ZORT สด
//    ถ้าตัวซิงก์ตายเงียบไปหนึ่งวัน จอจะยังโชว์เลขเดิมสวยงามโดยไม่มีอะไรฟ้อง
//    พิสูจน์แล้วคืนนั้นว่ากระจกตามหลังได้จริง (เจอ 3 ใบที่ ZORT เปลี่ยนแล้วแต่กระจกยังไม่รู้)
//
// 🔴 **ต้องดู `syncedAt` ไม่ใช่ `changedAt`** — ฝั่งท่อชี้ไว้ และถูก
//    "ครั้งสุดท้ายที่ข้อมูลเปลี่ยน" กับ "ครั้งสุดท้ายที่เราไปดู ZORT" เป็นคนละคำถาม
//    คืนไหนไม่มีออเดอร์ขยับเลย changedAt จะเก่าเป็นชั่วโมงทั้งที่ซิงก์วิ่งปกติทุก 30 นาที
//    ⇒ ดู changedAt แล้วเตือน = เตือนผิดทุกคืนที่ร้านเงียบ แล้วคนจะเลิกเชื่อคำเตือน
//    ตัวที่ตอบว่า "ซิงก์ตายหรือยัง" คือ syncedAt เท่านั้น
//
// ⚠️ ค่าที่ท่อส่งมาเป็น **UTC** (ชื่อลงท้าย Utc) · จอบวก 7 เอง แล้วเขียนกำกับว่าเป็นเวลาไทย
//    ห้ามโชว์ค่าดิบ — คนกรอกตอนเช้าจะเห็นเวลาย้อนไปเมื่อวานแล้วนึกว่าระบบพัง

export interface Freshness {
  /** ครั้งสุดท้ายที่ตัวซิงก์วิ่งจบ — **รวมรอบที่เขียน 0 แถว** ⇒ ใช้ตัวนี้ตัดสินว่าซิงก์ยังวิ่งอยู่ไหม */
  syncedAtUtc?: string | null
  /** ครั้งสุดท้ายที่ข้อมูลเปลี่ยนจริง (ทั้งตาราง) */
  changedAtUtc?: string | null
  /** ครั้งสุดท้ายที่ข้อมูล "ในช่วงที่กรองอยู่" เปลี่ยน */
  rangeChangedAtUtc?: string | null
}

/** "2026-09-04 16:19:38" (UTC) → Date · คืน null ถ้าอ่านไม่ออก (ห้ามโยน error ใส่จอ) */
function parseUtc(s?: string | null): Date | null {
  const raw = String(s ?? '').trim()
  if (!raw) return null
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** เวลาไทยแบบ "23:19 น." · บวก 7 เองจากค่า UTC ไม่พึ่ง Intl
 *  (Intl บางรุ่นสร้างแล้ว throw — เคยทำหน้าคนเข้าเว็บพังมาแล้ว) */
function thaiClock(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600e3)
  const hh = String(t.getUTCHours()).padStart(2, '0')
  const mm = String(t.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} น.`
}

function thaiDayTime(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600e3)
  const dd = String(t.getUTCDate()).padStart(2, '0')
  const mo = String(t.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mo} ${thaiClock(d)}`
}

export default function DataFreshness(
  { freshness, everyMinutes = 30 }: {
    freshness?: Freshness | null
    /** ตัวซิงก์วิ่งทุกกี่นาที — **เกณฑ์เตือนผูกกับค่านี้ ไม่ใช่ตัวเลขลอย ๆ**
     *  เปลี่ยนรอบซิงก์เมื่อไหร่ ต้องแก้ที่นี่ด้วย ไม่งั้นจอจะเตือนผิดจังหวะแบบเงียบ ๆ */
    everyMinutes?: number
  },
) {
  const synced = parseUtc(freshness?.syncedAtUtc)
  const changed = parseUtc(freshness?.changedAtUtc)
  const rangeChanged = parseUtc(freshness?.rangeChangedAtUtc)

  // ⚠️ ไม่รู้เวลา ≠ ข้อมูลสด — ต้องเขียนบอก ไม่ใช่เงียบไปเฉย ๆ
  if (!synced) {
    return (
      <p className="text-[12px] text-gray-400 mb-2">
        ⏱ ไม่รู้ว่าซิงก์ล่าสุดเมื่อไหร่ — ตัวเลขบนจอนี้อาจเก่าโดยไม่มีอะไรฟ้อง
      </p>
    )
  }

  const mins = Math.max(0, Math.round((Date.now() - synced.getTime()) / 60000))
  /* เตือนเมื่อขาดไป 3 รอบติด — รอบเดียวที่หลุดเป็นเรื่องปกติ (deploy · ZORT ช้า)
     เตือนตั้งแต่รอบแรกที่หลุด = เตือนบ่อยจนคนเลิกอ่าน แล้ววันที่ตายจริงก็ไม่มีใครดู */
  const stale = mins > everyMinutes * 3

  const tip = [
    `ซิงก์ล่าสุด ${thaiDayTime(synced)} (เวลาไทย)`,
    changed ? `ข้อมูลเปลี่ยนล่าสุด ${thaiDayTime(changed)}` : '',
    rangeChanged ? `ในช่วงที่กรองอยู่ เปลี่ยนล่าสุด ${thaiDayTime(rangeChanged)}` : '',
    `ตัวซิงก์วิ่งทุก ${everyMinutes} นาที · เตือนเมื่อเงียบเกิน ${everyMinutes * 3} นาที`,
    'นับจากครั้งที่ไปดู ZORT ไม่ใช่ครั้งที่ข้อมูลเปลี่ยน — คืนที่ร้านเงียบ ข้อมูลไม่เปลี่ยนก็ไม่ได้แปลว่าซิงก์ตาย',
  ].filter(Boolean).join('\n')

  return (
    <p
      className={`text-[12px] mb-2 ${stale ? 'text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2' : 'text-gray-500'}`}
      title={tip}
    >
      ⏱ ข้อมูล ณ <b>{thaiClock(synced)}</b> (เวลาไทย)
      {stale
        ? <> — <b>เงียบมาแล้ว {mins.toLocaleString('th-TH')} นาที</b> ทั้งที่ปกติซิงก์ทุก {everyMinutes} นาที
          {' '}⇒ ตัวเลขบนจอนี้อาจไม่ใช่ของล่าสุด</>
        : <span className="text-gray-400"> · {mins <= 1 ? 'เมื่อครู่นี้' : `${mins.toLocaleString('th-TH')} นาทีที่แล้ว`}</span>}
    </p>
  )
}
