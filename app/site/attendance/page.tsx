'use client'
// ลงเวลาพนักงาน — หน้าจริงอยู่ที่เว็บหน้าร้าน (gucut.com/admin/attendance/)
// ฝังเป็นกรอบด้วยเหตุผลเดียวกับ /site (สอง Next.js ใช้เส้นทาง /_next/ ชนกัน — ดูคอมเมนต์ที่ app/site/page.tsx)
// กรอบนี้ถูกป้องกันด้วยรหัสหลังร้านตัวนี้ (middleware.ts) และข้างในมีรหัสของเว็บหน้าร้านอีกชั้น
const SRC = 'https://gucut.com/admin/attendance/'

export default function SiteAttendancePage() {
  return (
    <div className="h-[calc(100vh-2rem)] w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      <iframe
        src={SRC}
        title="ลงเวลาพนักงาน"
        className="h-full w-full border-0"
        allow="clipboard-write"
      />
    </div>
  )
}
