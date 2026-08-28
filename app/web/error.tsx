'use client'
// กันหน้าขาวของกลุ่มหน้าเว็บไซต์ — พังแล้วต้องเห็นสาเหตุ+ปุ่มลองใหม่ ไม่ใช่ Application error
export default function WebError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-3">
      <p className="text-4xl">😵</p>
      <p className="text-[15px] font-black text-gray-900">หน้านี้มีปัญหา</p>
      <p className="text-[12px] text-gray-400 break-words rounded-xl bg-gray-50 px-3 py-2 font-mono">{String(error?.message || error)}</p>
      <button onClick={reset} className="rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white">ลองใหม่</button>
    </div>
  )
}
