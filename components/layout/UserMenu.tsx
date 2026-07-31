'use client'
// แสดงว่าใครล็อกอินอยู่ตอนนี้ (แอดมิน/ชื่อพนักงาน) + เมนูดรอปดาวน์ (ข้อมูลส่วนตัว/เปลี่ยนรหัสผ่าน/ออกจากระบบ)
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const router = useRouter()
  const [info, setInfo] = useState<{ role: 'admin' | 'staff' | null; name: string } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/whoami')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
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

  function comingSoon() {
    setOpen(false)
    alert('เร็วๆ นี้')
  }

  if (!info || !info.role) return null

  const label = info.role === 'admin' ? 'แอดมิน' : info.name || 'พนักงาน'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[12px] text-gray-600 whitespace-nowrap hover:text-gray-800 transition-colors"
      >
        👤 <span className="font-semibold">{label}</span>
        <span className={`text-[9px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-30">
          <button
            onClick={comingSoon}
            className="w-full text-left px-3 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ข้อมูลส่วนตัว
          </button>
          <button
            onClick={comingSoon}
            className="w-full text-left px-3 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            เปลี่ยนรหัสผ่าน
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={logout}
            disabled={loggingOut}
            className="w-full text-left px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {loggingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
          </button>
        </div>
      )}
    </div>
  )
}
