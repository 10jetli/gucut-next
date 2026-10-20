/* ไอคอนเส้นบนปุ่มแถบหัวจอรายละเอียด (แก้ไข · ลบ · พิมพ์เอกสาร · แชร์) — ZORT มีไอคอนหน้าคำบนปุ่มพวกนี้
 * วาดเองทั้งหมด ไม่ใช้ฟอนต์ไอคอนของ ZORT · ขนาด 15 สีตามตัวอักษรของปุ่ม (currentColor)
 * ใช้ร่วมหลายจอ (คลัง · หมวด · ชุด) — เพิ่มไอคอนใหม่ที่นี่ ไม่วาด SVG ซ้ำในเพจ (กฎข้อ 5) */
const เส้น = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true } as const

export function IconEdit() {
  return <svg {...เส้น} strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></svg>
}

export function IconTrash() {
  return <svg {...เส้น} strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
}

export function IconPrint() {
  return <svg {...เส้น} strokeLinejoin="round"><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 14h10v6H7z" /></svg>
}

export function IconShare() {
  return <svg {...เส้น} strokeLinecap="round"><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M8 11l8-4M8 13l8 4" /></svg>
}
