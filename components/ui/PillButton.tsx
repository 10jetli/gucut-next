'use client'
// ปุ่มกรองทรงเม็ดยา (ใช้ในหน้า Orders สลับร้าน และหน้าโรงงานกรองสถานะ)
export default function PillButton({
  active,
  onClick,
  className = '',
  children,
}: { active: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`${className}px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}
