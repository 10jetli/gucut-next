'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
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
      const next = params.get('next')
      const dest = next || (json.role === 'staff' ? '/catalog/index.html#trf' : '/')
      // ปลายทางที่เป็นไฟล์ static (/catalog/...) ต้องโหลดหน้าจริง ไม่ใช่ client-router ของ Next
      if (dest.startsWith('/catalog/')) {
        window.location.href = dest
        return
      }
      router.replace(dest)
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-[340px] text-center bg-white rounded-3xl border border-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-24px_rgba(15,23,42,0.25)] px-7 py-9"
    >
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-[#17386b] flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(37,99,235,0.55)] mb-4">
        <span className="text-lg font-black text-white">G</span>
      </div>
      <div className="text-[24px] font-black tracking-tight text-gray-900 mb-1">GUCUT</div>
      <div className="text-[13px] text-gray-400 mb-6">ใส่รหัสผ่านเพื่อเข้าใช้งานระบบหลังบ้าน</div>

      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoFocus
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] mb-3 text-center transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        placeholder="รหัสผ่าน"
      />

      {err && <div className="text-[12px] text-red-500 mb-3 bg-red-50 rounded-lg py-2">⚠️ {err}</div>}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full bg-gray-900 disabled:bg-gray-300 text-white font-bold rounded-xl py-3 text-[15px] transition-colors hover:bg-gray-800 disabled:hover:bg-gray-300 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.4)]"
      >
        {loading ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-[13px] text-gray-400">กำลังโหลด…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
