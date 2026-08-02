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
      className={`${className} px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 ${
        active
          ? 'bg-blue-600 text-white shadow-[0_4px_10px_-4px_rgba(37,99,235,0.6)]'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
