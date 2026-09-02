'use client'
// ปุ่มมุมขวาบนของแถบหัว — **ลอกจาก ZORT ของจริง** (~/claude-shared/zort-ui/01-รายการขาย.jpg)
// เรียงซ้าย→ขวา: กระดิ่ง · เครื่องหมายคำถาม · ตารางจุด 9 ช่อง · เส้นคั่น · โลโก้+ชื่อบัญชี
//
// ⚠️ **ห้ามเป็นปุ่มหลอก** — ของ ZORT ปุ่มพวกนี้ทำงานจริงทุกอัน ถ้าเราทำแค่ให้เหมือนแล้วกดไม่ได้
//    คนใช้จะกดแล้วนึกว่าระบบพัง (โรคประจำโปรเจกต์นี้: ระบบถูก แต่สื่อสารผิด)
//    ⇒ กระดิ่ง = เรื่องที่ควรมาดูจากคลังเงาจริง · ? = อธิบายว่าข้อมูลมาจากไหน · 9 จุด = ทางลัดจริง
//
// ⚠️ **จุดแดงบนกระดิ่งต้องมีของจริงเท่านั้น** จุดแดงแปลว่า "มีเรื่องรอคุณอยู่"
//    ติดไว้ตลอดเพื่อความสวย = สอนให้คนใช้เลิกเชื่อจุดแดง แล้ววันที่มีเรื่องจริงเขาจะไม่มอง
//
// ⚠️ **ห้ามยิงตรวจเองตอนเปิดหน้า** — กฎเจ้าของร้าน "ห้ามเช็คอัตโนมัติ ต้องกดเอง"
//    แถบนี้อยู่ทุกหน้า ถ้ายิงเองทุกครั้งที่เปลี่ยนหน้า = ยิงคลังทั้งวันโดยไม่มีใครขอ
//    ⇒ ตรวจตอนกดกระดิ่งเท่านั้น แล้วจำผลไว้ใน sessionStorage ให้หน้าอื่นใช้ต่อ (ปิดแท็บก็หาย)
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const CACHE_KEY = 'gucut-bell'
const NAVY = '#1b3b73'

interface Alert {
  tone: 'warn' | 'bad'
  text: string
  href?: string
}
interface Checked {
  at: string
  alerts: Alert[]
}

/** ปิดกล่องเมื่อคลิกที่อื่น — ใช้ร่วมกันทั้งสามปุ่ม */
function useCloseOnOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])
  return ref
}

/** อ่านผลตรวจที่จำไว้ — ต้องกัน JSON เสียเสมอ ไม่งั้นแถบหัวพังทั้งระบบ */
function readCache(): Checked | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || !Array.isArray(d.alerts) || typeof d.at !== 'string') return null
    return d as Checked
  } catch {
    return null
  }
}

/** แปลข้อมูลคลังเงาเป็น "เรื่องที่ควรมาดู" — เงียบไว้ถ้าทุกอย่างตรง */
function toAlerts(d: unknown): Alert[] {
  const out: Alert[] = []
  const data = (d ?? {}) as Record<string, unknown>

  if (data.ready === false) {
    out.push({ tone: 'bad', text: String(data.note ?? 'คลังเงายังไม่พร้อมใช้งาน'), href: '/core' })
    return out
  }

  const recon = Array.isArray(data.recon) ? (data.recon as Record<string, unknown>[]) : []
  const last = recon[0]
  if (last) {
    const zo = Number(last.zort_orders) || 0
    const co = Number(last.core_orders) || 0
    const za = Number(last.zort_amount) || 0
    const ca = Number(last.core_amount) || 0
    // เทียบยอดเงินแบบปัดสตางค์ทิ้ง — ต่างกันไม่ถึงบาทไม่ใช่ปัญหาที่คนต้องมาดู
    if (zo !== co || Math.round(za) !== Math.round(ca)) {
      out.push({
        tone: 'warn',
        text: `ยอดวันที่ ${last.day} ยังไม่ตรงกับ ZORT (${co}/${zo} ใบ)`,
        href: '/core',
      })
    }
  }

  const stock = Array.isArray(data.stock) ? (data.stock as Record<string, unknown>[]) : []
  const st = stock[0]
  if (st && Number(st.mismatched) > 0) {
    out.push({
      tone: 'warn',
      text: `สต็อกไม่ตรง ${Number(st.mismatched).toLocaleString('th-TH')} รายการ (ตรวจ ${st.day})`,
      href: '/core',
    })
  }

  const shopee = Array.isArray(data.shopee) ? (data.shopee as Record<string, unknown>[]) : []
  const bad = shopee.filter((s) => s.match === false).length
  if (bad > 0) {
    out.push({ tone: 'warn', text: `ยอด Shopee ไม่ตรง ${bad} วัน`, href: '/core' })
  }

  return out
}

/* ───────────────────────── กระดิ่ง ───────────────────────── */

function BellButton() {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useCloseOnOutside(useCallback(() => setOpen(false), []))

  // อ่านผลที่จำไว้อย่างเดียว **ไม่ยิงเอง** — จุดแดงจึงขึ้นได้เฉพาะเรื่องที่ตรวจเจอจริงแล้ว
  useEffect(() => { setChecked(readCache()) }, [])

  const check = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core')
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      const next: Checked = { at: new Date().toISOString(), alerts: toAlerts(d) }
      setChecked(next)
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* โหมดส่วนตัวเขียนไม่ได้ — ไม่เป็นไร */ }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !checked && !loading) check() // เปิดครั้งแรก = คนกดเอง จึงตรวจให้ทันที
  }

  const count = checked?.alerts.length ?? 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="เรื่องที่ควรมาดู"
        aria-label="เรื่องที่ควรมาดู"
        className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.9"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 w-[9px] h-[9px] rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] z-30 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-gray-800">เรื่องที่ควรมาดู</p>
            <button
              onClick={check}
              disabled={loading}
              className="text-[11.5px] text-blue-600 hover:underline disabled:opacity-50"
            >
              {loading ? 'กำลังตรวจ…' : 'ตรวจใหม่'}
            </button>
          </div>

          <div className="max-h-[280px] overflow-y-auto">
            {error && (
              <p className="px-3.5 py-3 text-[12.5px] text-red-600 leading-relaxed">
                ตรวจไม่สำเร็จ: {error}
              </p>
            )}
            {!error && loading && !checked && (
              <p className="px-3.5 py-4 text-[12.5px] text-gray-400">กำลังตรวจจากคลังเงา…</p>
            )}
            {!error && checked && checked.alerts.length === 0 && (
              <p className="px-3.5 py-4 text-[12.5px] text-gray-500 leading-relaxed">
                ไม่มีเรื่องต้องมาดู — ยอดขายและสต็อกตรงกับ ZORT
              </p>
            )}
            {!error && checked?.alerts.map((a, i) => (
              <Link
                key={i}
                href={a.href ?? '/core'}
                onClick={() => setOpen(false)}
                className="flex gap-2.5 px-3.5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.tone === 'bad' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="text-[12.5px] text-gray-700 leading-relaxed">{a.text}</span>
              </Link>
            ))}
          </div>

          {/* บอกเวลาที่ตรวจเสมอ — ไม่งั้นคนใช้เข้าใจว่าตัวเลขสดตลอดเวลา */}
          <p className="px-3.5 py-2 text-[11px] text-gray-400 border-t border-gray-100 leading-relaxed">
            {checked
              ? `ตรวจเมื่อ ${new Date(checked.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. · ระบบไม่ตรวจเอง ต้องกดปุ่มตรวจใหม่`
              : 'ระบบไม่ตรวจเอง — กด "ตรวจใหม่" เพื่อดูสถานะล่าสุด'}
          </p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── เครื่องหมายคำถาม ─────────────────────── */

function HelpButton() {
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutside(useCallback(() => setOpen(false), []))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="ช่วยเหลือ"
        aria-label="ช่วยเหลือ"
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
      >
        <span className="w-[19px] h-[19px] rounded-full bg-gray-400 text-white text-[12px] font-bold flex items-center justify-center leading-none">
          ?
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[300px] bg-white border border-gray-200 rounded-lg shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)] z-30 p-3.5">
          <p className="text-[13px] font-semibold text-gray-800 mb-2">ข้อมูลในหน้าจอมาจากไหน</p>
          <p className="text-[12.5px] text-gray-600 leading-relaxed">
            ตัวเลขทั้งหมดอ่านจาก <b>คลังของเราเอง</b> ไม่ได้ดึงสดจาก ZORT
            — คลังเราเก็บออเดอร์และภาพถ่ายสต็อกไว้เอง แล้วเทียบกับ ZORT ทุกวันเพื่อพิสูจน์ว่าตรงกัน
          </p>
          <p className="text-[12.5px] text-gray-600 leading-relaxed mt-2">
            เมนูที่แสดง<b>จางและมีจุดเล็ก</b>คือหน้าที่ยังไม่ได้ทำเนื้อหา กดเข้าไปจะบอกว่าจะทำอะไร
            และตอนนี้ให้ไปทำที่ไหนก่อน
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1.5">
            <Link href="/core" onClick={() => setOpen(false)} className="text-[12.5px] text-blue-600 hover:underline">
              ดูความคืบหน้าโครงการแก่น →
            </Link>
            <Link href="/web/status" onClick={() => setOpen(false)} className="text-[12.5px] text-blue-600 hover:underline">
              ตรวจสถานะระบบเว็บร้าน →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────── ตารางจุด 9 ช่อง (แอปในเครือ) ───────────────────── */
//
// ⚠️ ของ ZORT ปุ่มนี้ **ไม่ใช่ทางลัดไปหน้าในระบบ** — เป็นแผงสลับไป "แอปคนละตัว"
//    3 แผ่น: โซเชียลคอมเมิร์ซ · POS · คู่มือการใช้งาน (เจ้าของร้านส่งภาพจริงมา 2 ก.ย. 2569)
//    ครั้งแรกเราทำเป็นทางลัด 9 หน้าซึ่งซ้ำกับแถบเมนูซ้ายอยู่แล้ว — ผิดทั้งหน้าตาและความหมาย
//    ⇒ เปลี่ยนเป็น 3 แผ่นให้ตรงของจริง โดยจับคู่กับของที่ **เรามีจริง**

/** ไอคอนวาดเอง — ห้ามลอกไฟล์ภาพของ ZORT มาใช้ (เป็นงานออกแบบของเขา) */
function IconChat() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect x="4" y="8" width="30" height="23" rx="6" fill="#4f6ef7" />
      <rect x="10" y="15" width="14" height="3" rx="1.5" fill="#fff" opacity=".95" />
      <rect x="10" y="21" width="9" height="3" rx="1.5" fill="#fff" opacity=".7" />
      <path d="M12 31h8l-4 6z" fill="#4f6ef7" />
      <rect x="21" y="22" width="27" height="21" rx="6" fill="#8fb4fb" />
      <rect x="27" y="29" width="13" height="3" rx="1.5" fill="#fff" opacity=".95" />
      <rect x="27" y="35" width="8" height="3" rx="1.5" fill="#fff" opacity=".75" />
    </svg>
  )
}
function IconPos() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect x="5" y="13" width="42" height="27" rx="5" fill="#4f6ef7" />
      <rect x="9" y="17" width="26" height="14" rx="2.5" fill="#e8eefc" />
      <rect x="12" y="20" width="14" height="2.5" rx="1.25" fill="#8fb4fb" />
      <rect x="12" y="25" width="9" height="2.5" rx="1.25" fill="#8fb4fb" />
      <rect x="9" y="34" width="34" height="3" rx="1.5" fill="#ffb020" />
      <rect x="38" y="17" width="6" height="6" rx="1.5" fill="#fff" opacity=".9" />
    </svg>
  )
}
function IconBook() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="21" fill="#3f8ef7" />
      <path d="M16 17h8a3 3 0 0 1 3 3v16a3 3 0 0 0-3-2.5h-8z" fill="#fff" />
      <path d="M36 17h-8a3 3 0 0 0-3 3v16a3 3 0 0 1 3-2.5h8z" fill="#fff" opacity=".82" />
    </svg>
  )
}

interface AppTile {
  href: string
  label: string
  icon: () => React.ReactElement
  /** เปิดแท็บใหม่ไหม — ของที่อยู่คนละระบบควรเปิดแท็บใหม่ ไม่งั้นคนใช้หลุดจากงานที่ค้างอยู่ */
  blank?: boolean
}

const APPS: AppTile[] = [
  // ของ ZORT แผ่นนี้เปิดแอป ZORT Chat Commerce (รวมแชท Facebook + LINE)
  // ของเรา = /core/chat จอรวมแชทที่รับ **หน้าเว็บร้าน** ได้จริงแล้ว 1 ช่องทาง
  // Facebook/LINE เข้าไปดูได้ว่าติดอะไรและต้องทำอะไรถึงจะเปิด (ไม่ใช่แท็บเปล่า)
  { href: '/core/chat', label: 'แชทคอมเมิร์ซ', icon: IconChat },
  { href: '/core/pos', label: 'POS', icon: IconPos },
  { href: '/core/manual', label: 'คู่มือการใช้งาน', icon: IconBook },
]

function AppsButton() {
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutside(useCallback(() => setOpen(false), []))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="แอปในเครือ"
        aria-label="แอปในเครือ"
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
      >
        <span className="grid grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="w-[3.5px] h-[3.5px] rounded-[1px]" style={{ background: NAVY }} />
          ))}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] bg-white border border-gray-200 rounded-xl shadow-[0_14px_36px_-12px_rgba(15,23,42,0.32)] z-30 p-2.5">
          <div className="grid grid-cols-3 gap-1">
            {APPS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                target={a.blank ? '_blank' : undefined}
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-2 px-1 py-3 rounded-lg hover:bg-[#eef4ff] transition-colors text-center"
              >
                <a.icon />
                <span className="text-[12.5px] text-gray-700 leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
          {/* ⚠️ ต้องเขียนบอกขอบเขตจริงของแผ่นแชท ไม่งั้นเข้าใจว่าย้าย Facebook/LINE มาแล้ว */}
          <p className="text-[11px] text-gray-400 leading-relaxed px-1.5 pt-2 pb-0.5 border-t border-gray-100 mt-1">
            แชทคอมเมิร์ซรับข้อความจากหน้าเว็บร้านได้แล้ว · Facebook กับ LINE ยังตอบที่แอป
            ZORT Social Commerce · แชทมาร์เก็ตเพลสยังอยู่ที่ Duoke
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * เครื่องหมาย "ST" แบบเดียวกับที่ ZORT ใช้ — ตัวอักษรน้ำเงินล้วน ไม่มีกรอบ
 * ใช้ทั้งหน้าชื่อบริษัท (ซ้าย) และหน้าชื่อบัญชีที่ล็อกอิน (ขวา) เหมือนของจริง
 */
export function StMark({ size = 15 }: { size?: number }) {
  return (
    <span
      className="font-black tracking-[-0.06em] leading-none select-none shrink-0"
      style={{ color: '#1f6fd0', fontSize: size }}
    >
      ST
    </span>
  )
}

export default function TopBarActions() {
  return (
    <div className="flex items-center gap-0.5">
      <BellButton />
      <HelpButton />
      <AppsButton />
    </div>
  )
}
