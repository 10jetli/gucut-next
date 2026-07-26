'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
      router.replace(params.get('next') || '/')
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-[340px] text-center">
        <div className="text-[26px] font-black tracking-tight text-gray-900 mb-1">GUCUT</div>
        <div className="text-[13px] text-gray-400 mb-5">ใส่รหัสผ่านเพื่อเข้าใช้งาน</div>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] mb-3 text-center"
          placeholder="รหัสผ่าน"
        />

        {err && <div className="text-[12px] text-red-500 mb-3">⚠️ {err}</div>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-gray-900 disabled:bg-gray-300 text-white font-bold rounded-xl py-3 text-[15px]"
        >
          {loading ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
