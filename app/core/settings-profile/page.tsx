'use client'
// ตั้งค่า → ข้อมูลส่วนตัว (ปิดแถว 37)
//
// ⚠️ **ยังไม่มีภาพจอ ZORT** ⇒ ไม่ได้ลอกผัง เขียนจากคำถามที่จอควรตอบ
//
// ZORT เมนูนี้ = โปรไฟล์ของคนที่ล็อกอินอยู่ (ชื่อ อีเมล เปลี่ยนรหัส ตั้งการแจ้งเตือน)
// ของเรา **ไม่มีบัญชีผู้ใช้จริง** — ล็อกอินด้วยรหัสผ่านล้วน ไม่มีชื่อผู้ใช้ ไม่มีอีเมล
// ⇒ จอนี้ตอบเท่าที่มีจริง: **ตอนนี้คุณล็อกอินเป็นใคร · เข้าได้ถึงไหน · จะเปลี่ยนรหัสยังไง**
//
// 🔴 **ห้ามทำฟอร์ม "เปลี่ยนรหัสผ่าน" บนจอนี้เด็ดขาด**
//    รหัสอยู่ใน env ที่ Netlify ฟอร์มบนเว็บเปลี่ยนไม่ได้จริง
//    ⇒ ฟอร์มที่กดแล้วไม่มีอะไรเกิดขึ้น อันตรายกว่าไม่มีฟอร์ม เพราะคนเชื่อว่าเปลี่ยนไปแล้ว
//       แล้วเดินจากไปโดยที่รหัสเดิมยังใช้ได้อยู่
//
// 🔴 **ห้ามแสดงค่าคุกกี้ `gucut_auth` ไม่ว่ากรณีใด — ค่าในนั้น "คือรหัสผ่าน" ตัวจริง**
//    (อ่านโค้ด app/api/auth/login/route.ts: res.cookies.set('gucut_auth', password))
//    จอนี้จึงถาม /api/auth/whoami ซึ่งคืนแค่ role กับชื่อ ไม่เคยคืนค่ารหัส
import { useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, Pill } from '@/components/zort'

interface Who { role?: 'admin' | 'staff' | null; name?: string; error?: string }

export default function SettingsProfilePage() {
  const [w, setW] = useState<Who | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/auth/whoami')
      .then((r) => r.json())
      .then((d: Who) => { if (alive) { setW(d); setLoading(false) } })
      .catch((e) => { if (alive) { setError(String(e?.message ?? e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  /* ⚠️ สามสถานะ ไม่ใช่สอง — โหลดไม่สำเร็จ ≠ ยังไม่ล็อกอิน
     ถ้ายุบรวม จอจะเขียนว่า "ยังไม่ล็อกอิน" ตอนที่จริง ๆ แค่เน็ตสะดุด */
  const role = w?.role ?? null

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ข้อมูลส่วนตัว"
        summary={
          <>
            ตอนนี้คุณล็อกอินเป็นใคร และเข้าได้ถึงไหน
            {' | '}
            <span className="text-gray-400">อ่านจากคุกกี้จริงของคุณ ไม่ใช่ค่าที่พิมพ์ไว้</span>
          </>
        }
      />

      {error && <ErrorBox title="ถามสิทธิ์ของคุณไม่ได้">{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
            <p className="text-[12px] text-gray-400 mb-1">ตอนนี้เข้าระบบเป็น</p>
            {role === 'admin' && (
              <>
                <p className="text-[17px] font-semibold text-gray-900 flex items-center gap-2">
                  👑 แอดมิน <Pill tone="green">เข้าได้ทุกหน้า</Pill>
                </p>
                <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">
                  เห็นยอดขาย ต้นทุน คูปอง และการตั้งค่าทั้งหมด
                </p>
              </>
            )}
            {role === 'staff' && (
              <>
                <p className="text-[17px] font-semibold text-gray-900 flex items-center gap-2">
                  🧑‍🔧 {w?.name || 'พนักงาน'} <Pill tone="blue">เฉพาะโอนสินค้า</Pill>
                </p>
                <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">
                  {w?.name
                    ? <>ล็อกอินด้วย<b>รหัสรายคน</b> ระบบจึงรู้ว่าเป็นคุณ</>
                    /* ⚠️ ไม่มีชื่อ = ใช้รหัสรวมรุ่นเก่า ⇒ ระบบแยกไม่ออกว่าใคร ต้องบอกตรง ๆ */
                    : <>ล็อกอินด้วย<b>รหัสรวมรุ่นเก่า</b> — ระบบ<b>แยกไม่ออกว่าเป็นใคร</b>
                      {' '}ขอรหัสรายคนจากเจ้าของร้านจะดีกว่า</>}
                </p>
              </>
            )}
            {role === null && (
              <p className="text-[15px] text-amber-800">
                ⚠️ ยังไม่ได้ล็อกอิน หรือรหัสในเครื่องนี้ใช้ไม่ได้แล้ว —{' '}
                <Link href="/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <p className="text-[14px] font-semibold text-gray-900 mb-1.5">การเข้าสู่ระบบครั้งนี้</p>
              <dl className="text-[12.5px] space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">อยู่ได้นาน</dt>
                  <dd className="text-gray-800">90 วัน นับจากวันที่ล็อกอิน</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">เก็บที่</dt>
                  <dd className="text-gray-800">คุกกี้ <code className="text-[11.5px]">gucut_auth</code></dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">สคริปต์ในหน้าอ่านได้ไหม</dt>
                  <dd className="text-emerald-700">ไม่ได้ (httpOnly)</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">ส่งผ่านเน็ตแบบเข้ารหัส</dt>
                  <dd className="text-emerald-700">ใช่ (secure)</dd>
                </div>
              </dl>
              {/* 🔴 ข้อเท็จจริงที่คนใช้ควรรู้ — ไม่ใช่รายละเอียดทางเทคนิคที่ซ่อนได้
                  คุกกี้ = ตัวรหัสผ่านเอง ⇒ เปลี่ยนรหัสที่ Netlify = ทุกเครื่องหลุดพร้อมกันทันที
                  ซึ่งเป็นเรื่องดีเวลาต้องไล่คนออก แต่ต้องรู้ล่วงหน้าว่าตัวเองก็หลุดด้วย */}
              <p className="text-[11.5px] text-gray-500 mt-2.5 leading-relaxed">
                ⚠️ ระบบนี้<b>ไม่มีบัญชีผู้ใช้</b> — คุกกี้เก็บ<b>ตัวรหัสผ่านเอง</b>
                {' '}(จอนี้จึงไม่แสดงค่าคุกกี้ให้เห็นเด็ดขาด) ·
                ผลตามมา: <b>เปลี่ยนรหัสเมื่อไหร่ ทุกเครื่องที่ใช้รหัสนั้นหลุดพร้อมกันทันที รวมเครื่องคุณเอง</b>
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4">
              <p className="text-[14px] font-semibold text-gray-900 mb-1.5">เปลี่ยนรหัสผ่าน</p>
              <p className="text-[12.5px] text-gray-600 leading-relaxed">
                ทำที่ <b>Netlify → Site settings → Environment variables</b> แล้ว deploy ใหม่ ·
                รหัสแอดมินคือ <code className="text-[11.5px]">SITE_PASSWORD</code> ·
                รหัสพนักงานรายคนคือ <code className="text-[11.5px]">STAFF_PASS_1..8</code>
              </p>
              {/* 🔴 อธิบายว่าทำไมไม่มีปุ่ม — ไม่งั้นคนรอบหน้าจะ "เติมให้ครบ" แล้วได้ฟอร์มหลอก */}
              <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2.5 leading-relaxed">
                ⚠️ <b>ไม่มีปุ่มเปลี่ยนรหัสบนจอนี้โดยตั้งใจ</b> — รหัสอยู่ใน env
                ฟอร์มบนเว็บเปลี่ยนไม่ได้จริง ปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้นอันตรายกว่าไม่มีปุ่ม
                เพราะคนจะเชื่อว่าเปลี่ยนแล้ว ทั้งที่รหัสเดิมยังใช้ได้อยู่
              </p>
              <p className="text-[12px] mt-2.5">
                <Link href="/core/settings-users" className="text-blue-600 hover:underline">
                  ดูรายชื่อผู้ใช้ทั้งหมดและสิทธิ์ →
                </Link>
              </p>
            </div>
          </div>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ZORT เมนูนี้มีชื่อ อีเมล และการแจ้งเตือนรายคน — ของเรา<b>ยังไม่มีบัญชีผู้ใช้จริง</b>
            {' '}จึงมีได้เท่านี้ (ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้) ·
            ยังไม่มีภาพจอ ZORT ของเมนูนี้ จึงยังไม่ได้จัดผังตาม ·
            อยากออกจากระบบเครื่องนี้เครื่องเดียว ใช้ปุ่ม{' '}
            <Link href="/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>{' '}
            แล้วออกจากระบบที่นั่น
          </p>
        </>
      )}
    </div>
  )
}
