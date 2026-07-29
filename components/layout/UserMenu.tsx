'use client'
// แสดงว่าใครล็อกอินอยู่ตอนนี้ (แอดมิน/ชื่อพนักงาน) + ปุ่มออกจากระบบ
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const router = useRouter()
  const [info, setInfo] = useState<{ role: 'admin' | 'staff' | null; name: string } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetch('/api/auth/whoami')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {})
  }, [])

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/login', { method: 'DELETE' })
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

  if (!info || !info.role) return null

  const label = info.role === 'admin' ? 'แอดมิน' : info.name || 'พนักงาน'

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-gray-600 whitespace-nowrap">
        👤 <span className="font-semibold">{label}</span>
      </span>
      <button
        onClick={logout}
        disabled={loggingOut}
        className="text-[11.5px] text-gray-400 hover:text-red-500 border border-gray-200 rounded-md px-2 py-1 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {loggingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
      </button>
    </div>
  )
}
