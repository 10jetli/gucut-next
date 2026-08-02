// สถานะกำลังโหลด — ใช้ร่วมทุกหน้า (override ข้อความ/ระยะห่างได้ผ่าน props)
export default function LoadingState({
  text = 'กำลังโหลด...',
  className = 'flex flex-col items-center justify-center gap-2 py-10 text-gray-400 text-sm',
}: { text?: string; className?: string }) {
  return (
    <div className={className}>
      <span className="spinner inline-block w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-500" />
      <span>{text}</span>
    </div>
  )
}
