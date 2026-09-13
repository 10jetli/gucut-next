'use client'
// แสดงว่าใครล็อกอินอยู่ตอนนี้ (แอดมิน/ชื่อพนักงาน) + เมนูดรอปดาวน์ (ข้อมูลส่วนตัว/เปลี่ยนรหัสผ่าน/ออกจากระบบ)
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StMark } from './TopBarActions'

export default function UserMenu() {
  const router = useRouter()
  const [info, setInfo] = useState<{ role: 'admin' | 'staff' | null; name: string } | null>(null)
  /* 🔴 **สามสถานะ ห้ามยุบเหลือหนึ่ง** (กฎจอข้อ 4) — ของเดิม `catch(() => {})` แล้ว `return null`
     ทำให้ "กำลังโหลด" · "โหลดไม่ได้" · "ล็อกอินแล้วแต่ไม่มีสิทธิ์" หน้าตาเหมือนกันเป๊ะ
     ผลจริงที่แย่ที่สุด: ตอนอ่านไม่ได้ **ปุ่มออกจากระบบหายไปด้วย** โดยไม่มีอะไรบอก
     คนที่อยากออกจะออกไม่ได้ และไม่รู้ด้วยว่าทำไม (แก้ 13 ก.ย. 2569) */
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loggingOut, setLoggingOut] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/whoami')
      .then(async (r) => {
        /* ⚠️ ท่อตอบ error เป็น JSON ได้ ⇒ `.json()` ไม่ throw
           เอาคำตอบดิบไปตั้ง state ตรง ๆ = ก้อน error กลายเป็น "ข้อมูลผู้ใช้" */
        const d = await r.json().catch(() => null)
        if (!r.ok || d?.error || typeof d !== 'object' || d === null) throw new Error(d?.error ?? `HTTP ${r.status}`)
        return d as { role: 'admin' | 'staff' | null; name: string }
      })
      .then((d) => { if (alive) { setInfo(d); setState('ok') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
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

  /* ยังโหลดอยู่ = ซ่อนได้ (ชั่วครู่) · ตอบมาแล้วแต่ไม่มีสิทธิ์ = ซ่อนถูกแล้ว
     🔴 แต่ "อ่านไม่ได้" **ห้ามซ่อน** — ต้องเหลือทางออกจากระบบไว้เสมอ แล้วบอกตรง ๆ ว่าอ่านไม่ได้ */
  if (state === 'loading') return null
  if (state === 'ok' && (!info || !info.role)) return null

  const อ่านไม่ได้ = state === 'error'
  const label = อ่านไม่ได้
    ? 'ไม่ทราบผู้ใช้'
    : info!.role === 'admin' ? 'แอดมิน' : info!.name || 'พนักงาน'

  return (
    <div className="relative" ref={menuRef}>
      {/* หน้าตาแบบ ZORT: โลโก้ ST + ชื่อบัญชีสีเทา ไม่มีวงกลมตัวอักษรย่อ
          ⚠️ ZORT โชว์ชื่อบัญชีของเขา ("SITAKAN") — ของเราโชว์ **คนที่ล็อกอินอยู่จริง**
             เพราะระบบนี้มีทั้งแอดมินและพนักงาน ใครกำลังใช้อยู่สำคัญกว่าชื่อบัญชี */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap px-1.5 py-1 rounded hover:bg-gray-100 transition-colors"
      >
        <StMark size={15} />
        <span className={`text-[12.5px] font-medium ${อ่านไม่ได้ ? 'text-amber-600' : 'text-gray-400'}`}>{label}</span>
        <span className={`text-[9px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)] py-1 z-30 overflow-hidden">
          {/* บอกว่า "อ่านไม่ได้" ไม่ใช่ "ไม่มีใครล็อกอิน" — สองอย่างนี้ต้องอ่านคนละแบบ
              และปุ่มออกจากระบบด้านล่างยังใช้ได้ตามปกติ (มันไม่ได้พึ่ง whoami เลย) */}
          {อ่านไม่ได้ && (
            <p className="px-3 py-2 text-[11.5px] text-amber-700 bg-amber-50 leading-snug">
              อ่านไม่ได้ว่าใครล็อกอินอยู่ — <b>ไม่ได้แปลว่าหลุดจากระบบ</b>
              {' '}ลองรีเฟรชหน้า · ปุ่มออกจากระบบยังใช้ได้
            </p>
          )}
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
