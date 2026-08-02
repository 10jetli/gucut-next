// กล่องแสดงข้อผิดพลาดพื้นแดง — หัวข้อ + รายละเอียดตามแต่ละหน้า
export default function ErrorBox({
  title = 'โหลดไม่ได้',
  children,
}: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex gap-3">
      <span className="text-lg leading-none shrink-0">⚠️</span>
      <div>
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}
