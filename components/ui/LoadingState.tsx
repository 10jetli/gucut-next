// ข้อความสถานะกำลังโหลด — ใช้ร่วมทุกหน้า (override ข้อความ/ระยะห่างได้ผ่าน props)
export default function LoadingState({
  text = 'กำลังโหลด...',
  className = 'text-center py-8 text-gray-400 text-sm',
}: { text?: string; className?: string }) {
  return <p className={className}>{text}</p>
}
