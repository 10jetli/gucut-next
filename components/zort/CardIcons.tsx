/* ไอคอนเส้นในวงกลมของการ์ดตัวเลข (แดชบอร์ด) — ZORT ใช้ปฏิทิน 3 แบบ (วันนี้ · เดือนนี้ · ทั้งปี) และกล่องซ้อน (หมวดขายดี · YTD)
 * ภาพ /Dashboard/Main 20 ต.ค. 2569 · วาดเองทั้งหมด ไม่ใช้ไฟล์ภาพ/ฟอนต์ไอคอนของ ZORT · สีตามตัวอักษรของวง (currentColor)
 * ใช้ร่วมได้ทุกการ์ดตัวเลข — เพิ่มไอคอนใหม่ที่นี่ ไม่วาด SVG ซ้ำในเพจ (กฎข้อ 5) */
const เส้น = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round', 'aria-hidden': true } as const

/** ปฏิทินกรอบเดียว + ช่องเล็กหนึ่งช่อง = วันนี้ */
export function IconCalendarDay() {
  return <svg {...เส้น}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /><rect x="8" y="12" width="3.5" height="3.5" rx=".5" /></svg>
}

/** ปฏิทิน + แถบสองแถว = เดือนนี้ */
export function IconCalendarMonth() {
  return <svg {...เส้น}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4M7.5 13h9M7.5 16.5h9" /></svg>
}

/** ปฏิทิน + ตารางจุด = ทั้งปี */
export function IconCalendarGrid() {
  return <svg {...เส้น}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /><path d="M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth="2.4" /></svg>
}

/** กล่องซ้อนสามใบ = หมวดสินค้า */
export function IconCubes() {
  return <svg {...เส้น}><path d="M12 3l4 2.2v4.4L12 11.8 8 9.6V5.2z" /><path d="M8 11.5l4 2.2v4.4l-4 2.2-4-2.2v-4.4z" /><path d="M16 11.5l4 2.2v4.4l-4 2.2-4-2.2v-4.4z" /></svg>
}
