// กล่องแสดงข้อผิดพลาดพื้นแดง — หัวข้อ + รายละเอียดตามแต่ละหน้า
export default function ErrorBox({
  title = 'โหลดไม่ได้',
  children,
}: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-red-50 rounded-xl p-4 text-sm text-red-600">
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  )
}
